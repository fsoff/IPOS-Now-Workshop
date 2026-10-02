/* IPOS Now · Co-design workshop — shared core
   Store (autosaved, offline-first), synchronisation, DOM helpers, drag & drop. */
(function () {
  "use strict";
  const W = window;

  /* ---------------- local storage ---------------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------------- configuration ---------------- */
  const ROLE = W.IPOS_ROLE || "phone";
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#\/?/, "").split("?")[0].indexOf("k=") === 0 ? location.hash.slice(1) : "");
  const device = LS.get("ipos:device", {});
  if (params.get("room")) device.room = params.get("room");
  if (params.get("brokers")) device.brokers = params.get("brokers").split(",");
  if (hash.get("k")) { device.key = hash.get("k"); history.replaceState(null, "", location.pathname + location.search); }
  const CFG = Object.assign({}, W.IPOS_CONFIG || {}, device);
  if (!CFG.room) CFG.room = "ipos-now-paris";
  if (!CFG.key && ROLE === "board") {
    const b = new Uint8Array(12); (W.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => b[i] = Math.random() * 256);
    device.key = CFG.key = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  }
  LS.set("ipos:device", device);

  function setDevice(patch) {
    const d = Object.assign(LS.get("ipos:device", {}), patch);
    LS.set("ipos:device", d);
  }

  /* ---------------- identity ---------------- */
  const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ME = LS.get("ipos:me", null) || { id: uid("p"), name: "", role: "" };
  LS.set("ipos:me", ME);
  function setName(n, role) { ME.name = (n || "").trim().slice(0, 40); if (role !== undefined) ME.role = (role || "").trim().slice(0, 60); LS.set("ipos:me", ME); }

  /* ---------------- section reset scopes ---------------- */
  const RESET = {
    ice: r => r.s === "ice" && r.k === "card",
    s1: r => ["s1", "s1f"].includes(r.s),
    s2: r => r.s === "s2",
    s3: r => r.s === "s3",
    s4: r => ["s4", "s4a", "s4b"].includes(r.s),
    s5: r => r.s === "s5",
    s6: r => r.k === "decision",
    close: r => r.k === "todo"
  };
  /* records the phones need to follow the room */
  const PUBLIC_IDS = ["live", "cfg", "resets", "s1:audiences", "s1:products", "s2:current", "s4:assets", "s4:focus"];

  /* ---------------- store ---------------- */
  const Store = {
    recs: {}, pending: {}, subs: new Set(),
    key() { return "ipos:data:" + CFG.room; },
    load() {
      const o = LS.get(this.key(), null);
      if (o) { this.recs = o.recs || {}; this.pending = ROLE === "phone" ? (o.pending || {}) : {}; }
    },
    persist() {
      clearTimeout(this._t);
      this._t = setTimeout(() => LS.set(this.key(), { recs: this.recs, pending: this.pending }), 120);
    },
    get(id) { const r = this.recs[id]; return r && !r.x ? r : null; },
    list(pred) {
      return Object.values(this.recs).filter(r => !r.x && pred(r)).sort((a, b) => (a.c || 0) - (b.c || 0));
    },
    put(rec) {
      const prev = this.recs[rec.id];
      const now = Math.max(Date.now(), (prev && prev.u ? prev.u + 1 : 0));
      const r = Object.assign({}, prev || {}, rec, {
        c: rec.c || (prev && prev.c) || now, u: now,
        a: rec.a !== undefined ? rec.a : (prev ? prev.a : ME.name),
        p: rec.p !== undefined ? rec.p : (prev ? prev.p : ME.id)
      });
      if (!rec.x) delete r.x;
      if (rec.x) r.x = 1;
      this.recs[r.id] = r;
      if (ROLE === "phone") this.pending[r.id] = r;
      this.persist(); Bus.post(r); Sync.kick(); this.emit([r]);
      return r;
    },
    patch(id, d) {
      const r = this.recs[id]; if (!r) return null;
      return this.put({ id, k: r.k, s: r.s, d: Object.assign({}, r.d, d) });
    },
    setDoc(id, k, s, d) { return this.put({ id, k, s, d, a: "", p: "board" }); },
    del(id) {
      const r = this.recs[id]; if (!r) return null;
      const copy = JSON.parse(JSON.stringify(r));
      this.put({ id, x: 1 });
      return copy;
    },
    restore(copy) { const r = Object.assign({}, copy); delete r.x; this.put(r); },
    /* same-origin updates and room state */
    merge(list) {
      const changed = [];
      for (const inc of list) {
        if (!inc || !inc.id) continue;
        const cur = this.recs[inc.id];
        const pend = this.pending[inc.id];
        if (pend && (pend.u || 0) > (inc.u || 0)) continue;
        if (cur && (cur.u || 0) > (inc.u || 0) && cur.p === inc.p) continue;
        if (cur && cur.u === inc.u && !!cur.x === !!inc.x) continue;
        this.recs[inc.id] = inc; changed.push(inc);
      }
      if (changed.length) { this.persist(); this.emit(changed); }
      return changed;
    },
    /* contributions arriving from phones (board side): keep board-only fields such as positions */
    mergeFromPhone(list) {
      const changed = [];
      for (const inc of list) {
        if (!inc || !inc.id || PUBLIC_IDS.includes(inc.id)) continue;
        const cur = this.recs[inc.id];
        if (cur && cur.pu && (inc.u || 0) <= cur.pu) continue;
        const r = Object.assign({}, cur || {}, inc, { d: Object.assign({}, cur ? cur.d : {}, inc.d || {}), pu: inc.u, u: Math.max(Date.now(), cur && cur.u ? cur.u + 1 : 0) });
        if (!inc.x) delete r.x;
        this.recs[r.id] = r; changed.push(r); Bus.post(r);
      }
      if (changed.length) { this.persist(); this.emit(changed); }
      return changed;
    },
    /* a reset announced by the board removes this phone's own contributions locally */
    applyResets() {
      const rs = this.get("resets"); if (!rs || ROLE !== "phone") return;
      const changed = [];
      Object.keys(rs.d || {}).forEach(sec => {
        const f = RESET[sec]; const ts = rs.d[sec]; if (!f) return;
        Object.values(this.recs).forEach(r => { if (!r.x && r.p === ME.id && f(r) && (r.c || 0) < ts) { r.x = 1; delete this.pending[r.id]; changed.push(r); } });
      });
      if (changed.length) { this.persist(); this.emit(changed); }
    },
    emit(ch) { this.subs.forEach(f => { try { f(ch); } catch (e) { console.error(e); } }); },
    on(f) { this.subs.add(f); return () => this.subs.delete(f); },
    dump() { return { room: CFG.room, exported: new Date().toISOString(), recs: Object.values(this.recs).filter(r => !r.x) }; }
  };

  /* same-device channel (several tabs or windows on one computer) */
  const Bus = {
    ch: null,
    init() {
      try { this.ch = new BroadcastChannel("ipos:" + CFG.room); this.ch.onmessage = e => Store.merge([e.data]); } catch (e) { this.ch = null; }
    },
    post(r) { if (this.ch) try { this.ch.postMessage(r); } catch (e) { } }
  };

  /* ---------------- relay: phones ⇄ board ----------------
     All data live inside the tool (board computer + each phone).
     Phones and board exchange end-to-end encrypted messages through public
     MQTT relays; the relays only pass messages on and cannot read them. */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const hex = buf => Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, "0")).join("");
  const b64 = u8 => { let s = ""; u8.forEach(x => s += String.fromCharCode(x)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  const Sync = {
    state: "local", subs: new Set(), clients: [], seen: new Set(), acks: [], role: ROLE,
    on(f) { this.subs.add(f); f(this.state); },
    set(s) { if (s !== this.state) { this.state = s; this.subs.forEach(f => f(s)); } },
    enabled() { return !!(W.mqtt && W.crypto && crypto.subtle && CFG.key && (CFG.brokers || []).length); },
    async prepare() {
      const raw = await crypto.subtle.digest("SHA-256", enc.encode("ipos-now|key|" + CFG.room + "|" + CFG.key));
      this.aes = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
      this.topic = "ipos-now/" + hex(await crypto.subtle.digest("SHA-256", enc.encode("ipos-now|topic|" + CFG.room + "|" + CFG.key))).slice(0, 32);
    },
    async seal(o) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.aes, enc.encode(JSON.stringify(o))));
      const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
      return b64(out);
    },
    async open(payload) {
      try {
        const u8 = unb64(typeof payload === "string" ? payload : dec.decode(payload));
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8.slice(0, 12) }, this.aes, u8.slice(12));
        return JSON.parse(dec.decode(pt));
      } catch (e) { return null; }
    },
    connected() { return this.clients.filter(c => c.connected).length; },
    refresh() {
      if (!this.enabled()) return this.set("local");
      const n = this.connected();
      this.set(!n ? "err" : (ROLE === "phone" && Object.keys(Store.pending).length ? "busy" : "ok"));
    },
    async publish(sub, o, retain) {
      if (!this.aes) return;
      o.mid = uid("m"); this.seen.add(o.mid);
      const payload = await this.seal(o);
      this.clients.forEach(c => { if (c.connected) try { c.publish(this.topic + "/" + sub, payload, { qos: 0, retain: !!retain }); } catch (e) { } });
    },
    async onMessage(topic, msg) {
      const o = await this.open(msg); if (!o || !o.mid || this.seen.has(o.mid)) return;
      this.seen.add(o.mid); if (this.seen.size > 4000) this.seen = new Set([...this.seen].slice(-2000));
      const sub = topic.slice(this.topic.length + 1);
      if (ROLE === "board") {
        if (sub === "up" && Array.isArray(o.recs)) {
          Store.mergeFromPhone(o.recs);
          o.recs.forEach(r => this.acks.push([r.id, r.u]));
          clearTimeout(this._a); this._a = setTimeout(() => { const a = this.acks.splice(0); if (a.length) this.publish("ack", { acks: a }); }, 300);
        } else if (sub === "hello") this.publishState();
      } else {
        if (sub === "state" && Array.isArray(o.recs)) { Store.merge(o.recs); Store.applyResets(); }
        else if (sub === "ack" && Array.isArray(o.acks)) {
          let n = 0;
          o.acks.forEach(([id, u]) => { const p = Store.pending[id]; if (p && (p.u || 0) <= u) { delete Store.pending[id]; n++; } });
          if (n) { Store.persist(); this.refresh(); }
        }
      }
    },
    publishState() {
      if (ROLE !== "board") return;
      clearTimeout(this._s);
      this._s = setTimeout(() => {
        const recs = PUBLIC_IDS.map(id => Store.recs[id]).filter(Boolean);
        const cur = Store.get("s2:current"); if (cur && Store.recs[cur.d.id]) recs.push(Store.recs[cur.d.id]);
        this.publish("state", { recs }, true);
      }, 250);
    },
    kick() {
      if (!this.enabled()) return;
      if (ROLE === "board") return;
      clearTimeout(this._k); this._k = setTimeout(() => this.push(), 200);
    },
    push() {
      const list = Object.values(Store.pending);
      if (!list.length || !this.connected()) { this.refresh(); return; }
      this.set("busy");
      for (let i = 0; i < list.length; i += 25) this.publish("up", { recs: list.slice(i, i + 25) });
    },
    async start() {
      if (!this.enabled()) { this.set("local"); return; }
      this.set("err");
      try { await this.prepare(); } catch (e) { this.set("local"); return; }
      const subs = ROLE === "board" ? ["up", "hello"] : ["state", "ack"];
      CFG.brokers.forEach(url => {
        let c;
        try { c = W.mqtt.connect(url, { clientId: "ipos_" + Math.random().toString(36).slice(2, 12), keepalive: 30, reconnectPeriod: 4000, connectTimeout: 9000, clean: true, protocolVersion: 4 }); } catch (e) { return; }
        c.on("connect", () => {
          c.subscribe(subs.map(s => this.topic + "/" + s), { qos: 0 });
          this.refresh();
          if (ROLE === "board") this.publishState(); else { this.publish("hello", {}); this.kick(); }
        });
        c.on("message", (t, m) => this.onMessage(t, m));
        ["close", "offline", "end"].forEach(ev => c.on(ev, () => this.refresh()));
        c.on("error", () => this.refresh());
        this.clients.push(c);
      });
      if (ROLE === "phone") setInterval(() => { if (Object.keys(Store.pending).length) this.push(); }, 7000);
      if (ROLE === "board") {
        Store.on(ch => { if (ch.some(r => PUBLIC_IDS.includes(r.id) || r.k === "round")) this.publishState(); });
        setInterval(() => this.publishState(), 30000);
      }
      document.addEventListener("visibilitychange", () => { if (!document.hidden) { this.refresh(); if (ROLE === "phone") { this.publish("hello", {}); this.kick(); } } });
    }
  };

  /* room-level settings (synchronised) */
  function setting(key) {
    const c = Store.get("cfg");
    if (c && c.d && c.d[key] !== undefined && c.d[key] !== "") return c.d[key];
    return CFG[key];
  }
  function setSetting(key, val) {
    const c = Store.get("cfg");
    Store.setDoc("cfg", "cfg", "all", Object.assign({}, c ? c.d : {}, { [key]: val }));
  }

  /* ---------------- files (IndexedDB, this device) ---------------- */
  const Files = {
    db() {
      if (this._db) return this._db;
      this._db = new Promise((res, rej) => {
        const r = indexedDB.open("ipos-files", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("f");
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      return this._db;
    },
    async put(k, blob) { const db = await this.db(); return new Promise((res, rej) => { const t = db.transaction("f", "readwrite"); t.objectStore("f").put(blob, k); t.oncomplete = res; t.onerror = rej; }); },
    async get(k) { try { const db = await this.db(); return await new Promise(res => { const q = db.transaction("f").objectStore("f").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } },
    async del(k) { const db = await this.db(); return new Promise(res => { const t = db.transaction("f", "readwrite"); t.objectStore("f").delete(k); t.oncomplete = res; }); }
  };

  /* ---------------- DOM helpers ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(3)) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }
  const svgNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(svgNS, tag);
    if (attrs) for (const k in attrs) { if (attrs[k] != null) { if (k === "text") el.textContent = attrs[k]; else if (k.startsWith("on")) el.addEventListener(k.slice(2), attrs[k]); else el.setAttribute(k, attrs[k]); } }
    kids.flat(3).forEach(c => c && el.appendChild(c));
    return el;
  }

  const ICONS = {
    back: '<path d="M15 6l-6 6 6 6"/>',
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    next: '<path d="M6 5l9 7-9 7zM18 5v14"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8a5 5 0 0 1 0 8"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    connect: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 8l8 8"/>',
    gavel: '<path d="M14 4l6 6M11 7l6 6M8 10l6-6M10 16l7-7"/><path d="M3 21l7-7"/>',
    drive: '<path d="M8 3h8l6 11-4 7H6l-4-7z"/><path d="M8 3l6 11M16 3L10 14M2 14h20"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
  };
  function icon(name, cls) {
    const span = document.createElement("span");
    span.style.display = "contents";
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : "") + ">" + (ICONS[name] || "") + "</svg>";
    return span.firstChild;
  }

  function debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function toast(msg, action, label) {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const t = h("div", { class: "toast" }, h("span", null, msg), action ? h("button", { onclick: () => { action(); t.remove(); } }, label || "Undo") : null);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5200);
  }
  function deleteWithUndo(id, what) {
    const copy = Store.del(id);
    if (copy) toast((what || "Item") + " removed", () => Store.restore(copy));
  }

  /* keyed list reconciliation with entry/exit animation */
  function keyed(container, items, key, create, update) {
    const map = container._map || (container._map = new Map());
    const seen = new Set();
    let i = 0;
    for (const it of items) {
      const k = key(it); seen.add(k);
      let el = map.get(k);
      if (!el) { el = create(it); map.set(k, el); if (container._ready) { el.classList.add("enter"); el.addEventListener("animationend", () => el.classList.remove("enter"), { once: true }); } }
      update && update(el, it);
      if (!el.parentNode || el.parentNode !== container) container.appendChild(el);
      const at = container.children[i];
      if (at !== el && !el.classList.contains("dragging")) container.insertBefore(el, at || null);
      i++;
    }
    map.forEach((el, k) => {
      if (!seen.has(k)) {
        map.delete(k);
        el.classList.add("leave");
        setTimeout(() => el.remove(), 240);
      }
    });
    container._ready = true;
  }

  /* inline editable text: click to edit, saves while typing */
  function editable(el, getValue, save, placeholder) {
    el.classList.add("txt");
    el.setAttribute("data-ph", placeholder || "Write…");
    el.spellcheck = false;
    const commit = debounce(() => save(el.innerText.replace(/\n$/, "")), 450);
    el.addEventListener("input", commit);
    el.addEventListener("keydown", e => { if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); el.blur(); } });
    el.addEventListener("blur", () => { save(el.innerText.replace(/\n$/, "")); el.contentEditable = "false"; });
    el._sync = () => { if (document.activeElement !== el) { const v = getValue() || ""; if (el.innerText !== v) el.textContent = v; } };
    el._edit = () => {
      el.contentEditable = "true";
      el.focus();
      const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    };
    el._sync();
    return el;
  }

  /* pointer helpers */
  function isInteractive(t) { return !!(t.closest && t.closest('button,input,textarea,select,a,[contenteditable="true"],.port,.swatches,.ladder,.months')); }

  /* free drag within a scrolling canvas; click without movement edits text */
  function dragFree(el, opts) {
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0 || isInteractive(e.target)) return;
      const sx = e.clientX, sy = e.clientY;
      const ox = el.offsetLeft, oy = el.offsetTop;
      let moved = false;
      el.setPointerCapture(e.pointerId);
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        if (!moved) { moved = true; el.classList.add("dragging"); opts.start && opts.start(); }
        el.style.left = Math.max(0, ox + dx) + "px"; el.style.top = Math.max(0, oy + dy) + "px";
        opts.move && opts.move(ox + dx, oy + dy);
      };
      const up = ev => {
        el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
        if (moved) { el.classList.remove("dragging"); opts.end(Math.max(0, ox + ev.clientX - sx), Math.max(0, oy + ev.clientY - sy), ev); }
        else if (opts.click) opts.click(ev);
      };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    });
  }

  /* transfer drag: a ghost follows the pointer, dropped on [data-drop] targets */
  function dragTransfer(el, opts) {
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0 || isInteractive(e.target)) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost = null, hot = null, moved = false, dx = 0, dy = 0;
      el.setPointerCapture(e.pointerId);
      const target = ev => {
        const list = document.elementsFromPoint(ev.clientX, ev.clientY);
        for (const n of list) { const d = n.closest && n.closest("[data-drop]"); if (d && (!opts.accept || opts.accept(d))) return d; }
        return null;
      };
      const move = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        if (!moved) {
          moved = true;
          const r = el.getBoundingClientRect(); dx = sx - r.left; dy = sy - r.top;
          ghost = el.cloneNode(true); ghost.classList.add("drag-ghost"); ghost.classList.remove("enter");
          ghost.style.width = r.width + "px"; document.body.appendChild(ghost);
          el.style.opacity = ".3";
        }
        ghost.style.left = ev.clientX - dx + "px"; ghost.style.top = ev.clientY - dy + "px";
        const t = target(ev);
        if (t !== hot) { hot && hot.classList.remove("drop-hot"); hot = t; hot && hot.classList.add("drop-hot"); }
      };
      const up = ev => {
        el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
        el.style.opacity = "";
        if (ghost) ghost.remove();
        hot && hot.classList.remove("drop-hot");
        if (moved) { const t = target(ev); if (t) opts.drop(t, ev); }
        else if (opts.click) opts.click(ev);
      };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    });
  }

  /* ---------------- shared content ---------------- */
  const COLORS = ["white", "yellow", "orange", "red", "purple", "blue", "green"];
  const SWATCH = { white: "#FFFFFF", yellow: "#F8EDC6", orange: "#FCE6CC", red: "#F7D6D6", purple: "#E4DFF2", blue: "#D9E8F6", green: "#DAEDD2" };

  function months() {
    const st = String(setting("start") || "2026-11").split("-");
    let y = +st[0] || 2026, m = (+st[1] || 11) - 1;
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const out = [];
    for (let i = 0; i < 13; i++) { out.push({ i, short: names[m], label: names[m] + " " + String(y).slice(2), n: "M" + (i + 1) }); m++; if (m > 11) { m = 0; y++; } }
    return out;
  }

  const SESSIONS = [
    { id: "ice", n: "", label: "Icebreaker", title: "Opening, tour de table and icebreaker", time: "09:30–10:00", tool: "Introductions · three questions on a shared board", phone: true },
    { id: "s1", n: "1", label: "Session 1", title: "IPOS Now, connecting the dots", time: "10:00–11:00", tool: "Where we stand · trust · audiences × products", phone: true },
    { id: "b1", n: "", label: "Break", title: "Desk stretch", time: "11:00–11:15", tool: "Guided stretching sequence", dark: true },
    { id: "s2", n: "2", label: "Session 2", title: "Emergency simulation", time: "11:15–12:00", tool: "Emergency generator · response path", phone: true },
    { id: "s3", n: "3", label: "Session 3", title: "Editorial backbone", time: "12:00–13:00", tool: "Rocks, waves and winds on a 13-month wall", phone: true },
    { id: "lunch", n: "", label: "Lunch", title: "Lunch", time: "13:00–14:00", muted: true },
    { id: "s4", n: "4", label: "Session 4", title: "Visual positioning, identity and tone", time: "14:00–15:15", tool: "Moodboard · toolkit audit vote · brainstorm", phone: true },
    { id: "b2", n: "", label: "Break", title: "Chorus: Ocean · IPOS · Now", time: "15:15–15:30", tool: "Conducted score for seven voices", dark: true },
    { id: "s5", n: "5", label: "Session 5", title: "IPOS Now: objectives and KPIs", time: "15:30–16:30", tool: "From… to… statements · KPI ladder", phone: true },
    { id: "s6", n: "6", label: "Session 6", title: "Calendar, outputs, content", time: "16:30–17:15", tool: "Shared Drive · decision log" },
    { id: "close", n: "", label: "Close", title: "The day in review", time: "17:15–17:30", tool: "Dashboard · priorities · printable log" }
  ];
  const sessionById = id => SESSIONS.find(x => x.id === id);

  const ICE = [
    { id: "hero", title: "Joan’s victory", sub: "Something IPOS has achieved — or how you see IPOS today.", color: "blue", img: ["assets/figures/joan.jpg"] },
    { id: "mach", title: "Machiavelli’s secret plan", sub: "Your secret, ambitious goal for IPOS Now.", color: "purple", img: ["assets/figures/machiavelli.jpg"] },
    { id: "fins", title: "It gets on my fins", sub: "In everyday work, what gets on your nerves? Late arrivals, endless threads, last-minute changes…", color: "red", img: ["assets/figures/annoyed.gif"] }
  ];

  /* ---- Session 1 · knowledge at the science–policy–society interface ---- */
  // Spectrum of intermediary and brokering functions (Harvey et al., 2012)
  const SPECTRUM = [
    { id: "info", label: "Information intermediary", short: "Infomediary", band: "Informational", desc: "Enabling access to information from multiple sources" },
    { id: "trans", label: "Knowledge translator", short: "Translator", band: "Informational", desc: "Helping people make sense of and apply information" },
    { id: "broker", label: "Knowledge broker", short: "Broker", band: "Relational", desc: "Improving knowledge use in decision-making; fostering co-production" },
    { id: "innov", label: "Innovation broker", short: "Innovation broker", band: "Systems", desc: "Influencing the wider context to facilitate innovation" }
  ];
  // Models of the science–policy interface (Dilling & Lemos, 2011; Dunn et al., 2018)
  const MODELS = [
    { id: "push", label: "Science push", desc: "Knowledge produced first, offered to policy" },
    { id: "pull", label: "Policy pull", desc: "Policy asks, science answers" },
    { id: "coprod", label: "Co-production", desc: "Questions and answers shaped together" }
  ];
  // Attributes of effective knowledge (Cash et al., 2003)
  const CRELE = [
    { id: "cred", label: "Credibility", desc: "Robust, trustworthy evidence" },
    { id: "rel", label: "Relevance", desc: "Useful to the decision at hand" },
    { id: "leg", label: "Legitimacy", desc: "Fair, inclusive, unbiased process" }
  ];
  // Strategies for building trust (Cvitanovic et al., 2021)
  const TRUST = [
    { id: "transp", label: "Transparent process" },
    { id: "noadv", label: "No advocacy for an outcome" },
    { id: "contact", label: "Regular, face-to-face contact" },
    { id: "indep", label: "Demonstrable independence" },
    { id: "limits", label: "Open about limits and uncertainty" },
    { id: "quality", label: "Data quality and traceability" },
    { id: "review", label: "Independent review" },
    { id: "listen", label: "Listening to feedback" },
    { id: "deliver", label: "Delivering what was asked" },
    { id: "success", label: "Sharing successes, humbly" },
    { id: "politics", label: "Sensitivity to politics" }
  ];
  const TOKENS = 5;

  const DEFAULT_AUDIENCES = [
    { id: "req", name: "Requesting States" },
    { id: "sup", name: "Supporting States" },
    { id: "un", name: "UN agencies" },
    { id: "fund", name: "Funders & philanthropies" },
    { id: "assess", name: "Global assessments" },
    { id: "sci", name: "Scientists" },
    { id: "ngo", name: "NGOs, civil society & field actors" },
    { id: "iplc", name: "Indigenous peoples & local communities" },
    { id: "priv", name: "Private sector" },
    { id: "media", name: "Media" },
    { id: "public", name: "Public & youth" }
  ];
  const DEFAULT_PRODUCTS = [
    { id: "brief", name: "Policy options brief" },
    { id: "summary", name: "Layered report summary" },
    { id: "post", name: "Social post · service" },
    { id: "carousel", name: "LinkedIn carousel" },
    { id: "video", name: "Short video · process" },
    { id: "infographic", name: "Infographic · data story" },
    { id: "map", name: "Interactive map / dashboard" },
    { id: "news", name: "Newsletter" },
    { id: "web", name: "Web page · explainer" },
    { id: "event", name: "Webinar · event" },
    { id: "pack", name: "Briefing pack · 1:1" },
    { id: "kit", name: "Onboarding kit" }
  ];
  const MODES = [
    { id: "inform", label: "Inform", sub: "one-way", color: "#9A9A9A" },
    { id: "exchange", label: "Exchange", sub: "two-way", color: "#2484C6" },
    { id: "cocreate", label: "Co-create", sub: "together", color: "#E06666" }
  ];
  const TONES = ["Informative", "Impartial", "Inclusive", "Urgent", "Hopeful", "Clear", "Human", "Concise"];
  function audiences() { const r = Store.get("s1:audiences"); return (r && r.d && r.d.list) || DEFAULT_AUDIENCES; }
  function products() { const r = Store.get("s1:products"); return (r && r.d && r.d.list) || DEFAULT_PRODUCTS; }

  /* ---- Session 4 · toolkit audit (pages of the IPOS branding toolkit) ---- */
  const DEFAULT_ASSETS = [
    { id: "t1", name: "Tone of voice: informative, impartial, inclusive, urgent", page: 9 },
    { id: "t2", name: "“Less that, more this” shifts", page: 10 },
    { id: "t3", name: "Message structure: focus, cohesion, call to act, repetition", page: 11 },
    { id: "t4", name: "Key messages per audience", page: 13 },
    { id: "t5", name: "Terminology", page: 18 },
    { id: "t6", name: "Logo “towards ipos” and variations", page: 23 },
    { id: "t7", name: "Co-branding with the UN Ocean Decade", page: 26 },
    { id: "t8", name: "Story categories and icons", page: 29 },
    { id: "t9", name: "Primary palette", page: 35 },
    { id: "t10", name: "Secondary palette: finance yellow, coral", page: 36 },
    { id: "t11", name: "Post formats: image, balanced, text", page: 38 },
    { id: "t12", name: "Service posts: action request, rapid response, ocean catalyst", page: 43 },
    { id: "t13", name: "People and events posts", page: 46 },
    { id: "t14", name: "Process post (video)", page: 48 },
    { id: "t15", name: "Typography", page: 51 },
    { id: "t16", name: "Iconography", page: 54 },
    { id: "t17", name: "Charts", page: 58 },
    { id: "t18", name: "Illustrations", page: 61 },
    { id: "t19", name: "Infographics", page: 63 },
    { id: "t20", name: "Photography", page: 65 }
  ];
  function assets() { const r = Store.get("s4:assets"); return (r && r.d && r.d.list) || DEFAULT_ASSETS; }

  const DEFAULT_EMERGENCIES = [
    "IPOS must issue an official statement on social media within the next five hours, after President Trump announces an invasion of the Mediterranean.",
    "IPOS must share a tailored policy brief with a Greek governmental body and a Turkish one: same topic, two adapted briefs, arranged so that both remain satisfied.",
    "A Housedada team member falls ill in the middle of a delivery week.",
    "An event went remarkably well: a LinkedIn carousel with the key results must be online within the next 20 hours to ride the momentum.",
    "A major newspaper publishes a misleading article about IPOS; a clear, visual correction is needed by tomorrow morning.",
    "A partner asks for a co-branding change two hours before the print deadline for a summit."
  ];
  function emergencies() { const r = Store.get("s2:emergencies"); return (r && r.d && r.d.list) || DEFAULT_EMERGENCIES; }

  const LAYERS = [
    { id: "rock", label: "Rocks", sub: "Fixed events and deadlines", color: "purple" },
    { id: "wave", label: "Waves", sub: "Recurring formats and cadences", color: "blue" },
    { id: "wind", label: "Winds", sub: "Opportunistic moments", color: "green" }
  ];
  const LAYER_ICON = {
    rock: '<path d="M3 19l4-8 3 2 4-7 7 13z" fill="currentColor" fill-opacity=".12"/><path d="M3 19l4-8 3 2 4-7 7 13z"/>',
    wave: '<path d="M2 14c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 19c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" opacity=".5"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/><path d="M3 19h6" opacity=".5"/>'
  };
  function layerIcon(id, cls) { const sp = document.createElement("span"); sp.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="' + (cls || "") + '">' + LAYER_ICON[id] + "</svg>"; return sp.firstChild; }

  const AUDIT_COLS = [
    { id: "keep", label: "Keep", color: "green" },
    { id: "expand", label: "Expand", color: "blue" },
    { id: "less", label: "Less relevant", color: "orange" },
    { id: "retire", label: "Retire", color: "red" }
  ];

  const FIG = {
    fins: '<svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#D6D6D6"/><g fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"><circle cx="125" cy="128" r="66"/><path d="M88 104l26 10M162 104l-26 10"/><path d="M95 172q30-24 60 0"/></g><circle cx="102" cy="128" r="5" fill="#111"/><circle cx="148" cy="128" r="5" fill="#111"/></svg>',
    hero: '<svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#D6D6D6"/><g fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M95 205V52"/><path d="M95 56c30-14 50 14 80 0v60c-30 14-50-14-80 0"/><path d="M150 205l26-90M163 160h28"/></g></svg>',
    mach: '<svg viewBox="0 0 250 250"><rect width="250" height="250" fill="#D6D6D6"/><g fill="none" stroke="#111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M70 170l-10-80 40 34 25-54 25 54 40-34-10 80z"/><path d="M70 192h110"/></g></svg>'
  };

  /* image with fallback chain, ending on a drawn monogram */
  function figureImg(list, fallbackSvg) {
    const img = new Image();
    let i = 0;
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    const wrap = document.createElement("div");
    wrap.style.display = "contents";
    img.onerror = () => { i++; if (i < list.length) img.src = list[i]; else { wrap.innerHTML = fallbackSvg; } };
    img.src = list[0];
    wrap.appendChild(img);
    return wrap;
  }

  function embedSlides(url) {
    if (!url) return "";
    url = url.trim();
    const m = url.match(/docs\.google\.com\/presentation\/d\/(e\/)?([a-zA-Z0-9_-]+)/);
    if (!m) return url;
    if (m[1]) return "https://docs.google.com/presentation/d/e/" + m[2] + "/embed?start=false&loop=false&delayms=5000";
    return "https://docs.google.com/presentation/d/" + m[2] + "/embed?start=false&loop=false&delayms=5000&rm=minimal";
  }
  function embedDrive(url) {
    if (!url) return "";
    const f = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (f) return "https://drive.google.com/embeddedfolderview?id=" + f[1] + "#grid";
    const d = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (d && /document|spreadsheets|presentation/.test(url)) return url.replace(/\/(edit|view)[^/]*$/, "/preview");
    return "";
  }

  function joinURL() {
    const u = new URL("m.html", location.href);
    u.search = ""; u.hash = "";
    u.searchParams.set("room", CFG.room);
    if (device.brokers) u.searchParams.set("brokers", device.brokers.join(","));
    return u.toString() + "#k=" + CFG.key;
  }

  W.IPOS = {
    LS, CFG, ROLE, RESET, PUBLIC_IDS, setDevice, ME, setName, uid, Store, Bus, Sync, setting, setSetting, Files,
    h, s, icon, debounce, esc, toast, deleteWithUndo, keyed, editable, dragFree, dragTransfer, isInteractive,
    COLORS, SWATCH, months, SESSIONS, sessionById, ICE, SPECTRUM, MODELS, CRELE, TRUST, TOKENS, DEFAULT_AUDIENCES, DEFAULT_PRODUCTS, MODES, TONES, audiences, products, DEFAULT_ASSETS, assets, DEFAULT_EMERGENCIES, emergencies,
    LAYERS, layerIcon, AUDIT_COLS, FIG, figureImg, embedSlides, embedDrive, joinURL
  };

  Store.load();
  Bus.init();
})();
