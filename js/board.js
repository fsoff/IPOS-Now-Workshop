/* IPOS Now · Co-design workshop — facilitator board */
(function () {
  "use strict";
  const I = window.IPOS;
  const { h, s, icon, Store, Sync, setting, setSetting, editable, keyed, dragFree, dragTransfer, deleteWithUndo, toast, uid, COLORS, SWATCH } = I;

  const view = document.getElementById("view");
  const crumbs = document.getElementById("crumbs");
  const actionsEl = document.getElementById("topActions");
  const footLabel = document.getElementById("footLabel");

  let current = null;
  let raf = 0;

  /* ================= shell ================= */
  function live() { const r = Store.get("live"); return (r && r.d) || {}; }
  function setLive(d) { Store.setDoc("live", "state", "all", Object.assign({}, live(), d)); }

  function syncPill() {
    const el = h("span", { class: "sync hide-s" }, h("span", { class: "dot" }), h("span", { class: "lbl" }));
    const names = { local: "Saved on this computer", ok: "Phones can connect", busy: "Receiving…", err: "Relay offline · saved here" };
    Sync.on(st => { el.querySelector(".dot").className = "dot " + ({ local: "local", ok: "ok", busy: "busy", err: "err" }[st]); el.querySelector(".lbl").textContent = names[st]; });
    return el;
  }
  const SYNC_EL = syncPill();

  function topbar(sess) {
    crumbs.innerHTML = "";
    if (!sess) {
      crumbs.append(h("span", { class: "here" }, "IPOS Now · Co-design workshop"));
    } else {
      crumbs.append(
        h("a", { href: "#/" }, icon("home"), h("span", { style: { marginLeft: "6px" } }, "Workshop")),
        h("span", { class: "sep" }, "/"),
        h("span", { class: "here" }, (sess.n ? sess.label + " · " : sess.label + " · ") + sess.title)
      );
    }
    actionsEl.innerHTML = "";
    actionsEl.append(SYNC_EL);
    if (sess && sess.phone) {
      const L = live();
      const on = L.session === sess.id;
      actionsEl.append(h("button", { class: "btn" + (on ? " live" : ""), title: on ? "Phones are on this activity — click to pause" : "Send this activity to the phones", onclick: () => { setLive({ session: on ? null : sess.id }); topbar(sess); } }, h("span", { class: "dot" }), on ? "Live on phones" : "Send to phones"));
    }
    actionsEl.append(h("button", { class: "btn icon", title: "Join on phone", onclick: openQR }, icon("qr")));
    if (sess && sess.id !== "close") actionsEl.append(h("button", { class: "btn icon hide-s", title: "Log a decision", onclick: () => openDecision(sess.id) }, icon("gavel")));
    if (sess && I.RESET[sess.id]) actionsEl.append(h("button", { class: "btn icon ghost reset-btn hide-s", title: "Reset this section", onclick: () => askReset(sess) }, icon("reset")));
    if (!sess) actionsEl.append(h("button", { class: "btn icon", title: "Settings", onclick: openSettings }, icon("gear")));
    actionsEl.append(h("button", { class: "btn icon hide-s", title: "Full screen", onclick: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => { }); } }, icon("expand")));
    footLabel.textContent = sess ? (sess.n ? sess.n + " · " + sess.title : sess.label + (sess.id.startsWith("b") ? " · " + sess.title : "")) : "IPOS Now · Co-design workshop";
  }

  const ROUTES = { "": Landing, ice: Ice, s1: S1, b1: Stretch, s2: S2, s3: S3, s4: S4, b2: Chorus, s5: S5, s6: S6, close: Close };

  function route() {
    const id = (location.hash.replace(/^#\/?/, "") || "").split("/")[0];
    const fn = ROUTES[id] || Landing;
    if (current && current.destroy) current.destroy();
    view.innerHTML = "";
    const sess = I.sessionById(id);
    topbar(fn === Landing ? null : sess);
    current = fn(view, sess) || {};
    const first = view.firstElementChild; if (first) first.classList.add("view-in");
  }
  window.addEventListener("hashchange", route);

  Store.on(ch => {
    if (ch.some(r => r.id === "live")) { const id = (location.hash.replace(/^#\/?/, "") || "").split("/")[0]; topbar(ROUTES[id] && id ? I.sessionById(id) : null); }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => current && current.update && current.update(ch));
  });

  function frame(host, title, right) {
    const head = h("div", { class: "frame-head" }, h("div", { class: "h-l" }, title), h("div", { class: "row" }, right || []));
    const body = h("div", { class: "frame-body" });
    const f = h("div", { class: "frame" }, head, body);
    host.append(f);
    return { f, head, body };
  }

  function tabs(list, active, onChange) {
    const el = h("div", { class: "tabs" });
    const draw = a => { el.innerHTML = ""; list.forEach(t => el.append(h("button", { class: "tab" + (t.id === a ? " on" : ""), onclick: () => { draw(t.id); onChange(t.id); } }, t.dot ? h("span", { class: "dot", style: { background: t.dot, marginRight: "7px" } }) : null, t.label))); };
    draw(active);
    el.set = draw;
    return el;
  }

  /* ================= modals & drawers ================= */
  function closeOverlays() { document.querySelectorAll(".scrim,.drawer,.modal").forEach(n => n.remove()); }
  function modal(content) {
    closeOverlays();
    const scrim = h("div", { class: "scrim", onclick: closeOverlays });
    const m = h("div", { class: "modal" }, content);
    document.body.append(scrim, m);
    const esc = e => { if (e.key === "Escape") { closeOverlays(); document.removeEventListener("keydown", esc); } };
    document.addEventListener("keydown", esc);
    return m;
  }
  function drawer(title, content) {
    closeOverlays();
    const scrim = h("div", { class: "scrim", onclick: closeOverlays });
    const d = h("div", { class: "drawer" }, h("div", { class: "drawer-head" }, h("div", { class: "h-m" }, title), h("button", { class: "btn icon ghost", onclick: closeOverlays }, icon("x"))), h("div", { class: "drawer-body" }, content));
    document.body.append(scrim, d);
    const esc = e => { if (e.key === "Escape") { closeOverlays(); document.removeEventListener("keydown", esc); } };
    document.addEventListener("keydown", esc);
    return d;
  }

  function askReset(sess) {
    const f = I.RESET[sess.id];
    const n = Store.list(r => f(r) && r.p !== "board").length;
    modal([h("div", { class: "label" }, sess.n ? "Session " + sess.n : sess.label), h("div", { class: "h-l", style: { margin: "6px 0 10px" } }, "Reset this section?"),
      h("div", { class: "muted" }, n + (n === 1 ? " contribution" : " contributions") + " will be cleared from the board and from the phones. Other sections are not affected."),
      h("div", { class: "row", style: { justifyContent: "flex-end", marginTop: "18px" } }, h("button", { class: "btn ghost", onclick: closeOverlays }, "Cancel"),
        h("button", { class: "btn dark", onclick: () => { closeOverlays(); resetSection(sess.id); } }, icon("reset"), "Reset"))]);
  }
  function resetSection(id) {
    const f = I.RESET[id];
    const copies = Store.list(r => f(r) && r.p !== "board").map(r => Store.del(r.id));
    const extra = { s2: ["s2:current"], s4: ["s4:focus"] }[id] || [];
    extra.forEach(x => { const c2 = Store.del(x); if (c2) copies.push(c2); });
    const rs = Store.get("resets");
    const prevResets = rs ? JSON.parse(JSON.stringify(rs.d)) : {};
    Store.setDoc("resets", "doc", "all", Object.assign({}, prevResets, { [id]: Date.now() }));
    if (id === "s5") for (let i = 0; i < 3; i++) Store.put({ id: uid("obj"), k: "obj", s: "s5", d: { title: "", months: [] }, a: "", c: Date.now() + i });
    toast("Section reset", () => { if (id === "s5") Store.list(r => r.k === "obj").forEach(r => Store.del(r.id)); copies.forEach(c2 => Store.restore(c2)); Store.setDoc("resets", "doc", "all", prevResets); }, "Undo");
  }

  function openQR() {
    const url = I.joinURL();
    const qr = h("div", { id: "qr" });
    const m = modal([
      h("div", { class: "label" }, "Join from your phone"),
      h("div", { class: "h-l", style: { margin: "6px 0 18px" } }, "Scan to contribute"),
      h("div", { class: "qr-box" }, qr, h("div", { style: { flex: "1", minWidth: "180px", display: "flex", flexDirection: "column", gap: "10px" } },
        h("div", { class: "url" }, url),
        h("button", { class: "btn sm", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(url); toast("Link copied"); } }, icon("link"), "Copy link"),
        h("div", { class: "muted", style: { fontSize: "12.5px" } }, "The link carries this room’s private key: share it only with participants.")
      ))
    ]);
    if (window.qrcode) { try { const q = window.qrcode(0, "M"); q.addData(url); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); } catch (e) { qr.remove(); } }
    else qr.remove();
    return m;
  }

  function openDecision(sid) {
    const ta = h("textarea", { class: "textarea", placeholder: "Decision, owner, date…" });
    const save = () => { const t = ta.value.trim(); if (!t) return; Store.put({ id: uid("d"), k: "decision", s: sid, d: { text: t } }); closeOverlays(); toast("Decision logged"); };
    modal([h("div", { class: "label" }, "Decision log"), h("div", { class: "h-l", style: { margin: "6px 0 16px" } }, "Log a decision"), ta,
      h("div", { class: "row", style: { justifyContent: "flex-end", marginTop: "14px" } }, h("button", { class: "btn ghost", onclick: closeOverlays }, "Cancel"), h("button", { class: "btn dark", onclick: save }, icon("check"), "Save"))]);
    setTimeout(() => ta.focus(), 50);
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); });
  }

  function fileButton(label, key, after) {
    const inp = h("input", { type: "file", accept: "application/pdf", style: { display: "none" } });
    inp.addEventListener("change", async () => { const f = inp.files[0]; if (!f) return; await I.Files.put(key, f); toast("PDF stored on this computer"); after && after(); });
    return [inp, h("button", { class: "btn sm", onclick: () => inp.click() }, icon("upload"), label)];
  }

  function openSettings() {
    const field = (label, input, note) => h("div", { class: "field" }, h("label", { class: "label" }, label), input, note ? h("div", { class: "muted", style: { fontSize: "12px" } }, note) : null);
    const text = (key, ph) => { const i = h("input", { class: "input", value: setting(key) || "", placeholder: ph || "" }); i.addEventListener("change", () => setSetting(key, i.value.trim())); return i; };
    const room = h("input", { class: "input", value: I.CFG.room });
    const start = h("input", { class: "input", type: "month", value: setting("start") || "2026-11" });
    start.addEventListener("change", () => setSetting("start", start.value));
    const imp = h("input", { type: "file", accept: "application/json", style: { display: "none" } });
    imp.addEventListener("change", async () => {
      const f = imp.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); (j.recs || []).forEach(r => Store.put(r)); toast("Imported " + (j.recs || []).length + " items"); } catch (e) { toast("This file could not be read"); }
    });
    drawer("Settings", [
      h("div", { class: "label" }, "Room"),
      h("div", { class: "muted", style: { fontSize: "12.5px" } }, "Everything is saved on this computer. Phones send their contributions through encrypted relays (" + I.Sync.connected() + " of " + (I.CFG.brokers || []).length + " reachable now)."),
      field("Room name", room, "A new room starts a clean board; the current one stays on this computer."),
      h("div", { class: "row" },
        h("button", { class: "btn dark sm", onclick: () => { I.setDevice({ room: room.value.trim() || "ipos-now-paris" }); location.search = ""; } }, "Open room"),
        h("button", { class: "btn sm", onclick: () => { I.setDevice({ key: null }); location.reload(); } }, "New private key")),
      h("div", { class: "label", style: { marginTop: "10px" } }, "Content"),
      field("Session 1 · Google Slides link", text("slidesSession1", "https://docs.google.com/presentation/d/…")),
      field("Session 4 · Google Slides link", text("slidesSession4", "https://docs.google.com/presentation/d/…")),
      field("Session 4 · Identity audit (PDF link, optional)", text("auditUrl", "https://…pdf")),
      field("Session 6 · Shared Drive folder", text("drive", "https://drive.google.com/drive/folders/…")),
      field("Programme start", start, "First of the 13 months shown in Sessions 3 and 5."),
      h("div", { class: "label", style: { marginTop: "10px" } }, "PDFs on this computer"),
      h("div", { class: "row" }, fileButton("Session 1 deck", "s1deck"), fileButton("Session 4 deck", "s4deck"), fileButton("Identity audit", "s4audit")),
      h("div", { class: "label", style: { marginTop: "10px" } }, "Data"),
      h("div", { class: "row" },
        h("button", { class: "btn sm", onclick: () => { const b = new Blob([JSON.stringify(Store.dump(), null, 1)], { type: "application/json" }); const a = h("a", { href: URL.createObjectURL(b), download: "ipos-now-workshop-" + I.CFG.room + ".json" }); document.body.append(a); a.click(); a.remove(); } }, icon("download"), "Export JSON"),
        imp, h("button", { class: "btn sm", onclick: () => imp.click() }, icon("upload"), "Import JSON"),
        h("button", { class: "btn sm", onclick: () => { closeOverlays(); printLog(); } }, icon("print"), "Print day log"))
    ]);
  }

  /* ================= landing ================= */
  const GLYPH = { ice: "note", s1: "connect", b1: "reset", s2: "shuffle", s3: "flag", s4: "edit", b2: "sound", s5: "check", s6: "drive", close: "print", lunch: "minus" };
  function Landing(host) {
    const wrap = h("div", { class: "landing" });
    const grid = h("div", { class: "grid-agenda stagger" });
    const L = live();
    I.SESSIONS.forEach((x, i) => {
      const t = h(x.muted ? "div" : "a", { class: "tile" + (x.dark ? " dark" : "") + (x.muted ? " muted" : "") + (L.session === x.id ? " is-live" : ""), href: x.muted ? null : "#/" + x.id, style: { animationDelay: i * 45 + "ms" } },
        h("div", { class: "t-top" }, h("span", { class: "time" }, x.time), h("span", { class: "row" }, h("span", { class: "pill live-tag" }, h("span", { class: "dot pulse", style: { background: "#3BB765" } }), "On phones"), x.n ? h("span", { class: "pill " + ["", "blue", "orange", "red", "purple", "green", "yellow"][+x.n] }, "Session " + x.n) : (x.muted ? null : h("span", { class: "pill" + (x.dark ? "" : " yellow") }, x.label)))),
        h("div", { class: "t-title" }, x.title),
        x.tool ? h("div", { class: "t-desc" }, x.tool) : null);
      const g = icon(GLYPH[x.id] || "plus", "glyph"); t.append(g);
      grid.append(t);
    });
    wrap.append(
      h("div", { class: "hero" },
        h("div", null, h("div", { class: "row", style: { marginBottom: "14px" } }, h("span", { class: "pill" }, "Housedada"), h("span", { class: "pill" }, "×"), h("span", { class: "pill" }, "IPOS")),
          h("div", { class: "h-xl" }, "IPOS Now"),
          h("div", { class: "sub" }, "Co-design workshop · Strategic alignment")),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: openQR }, icon("phone"), "Join on phone"), h("a", { class: "btn dark", href: "#/close", style: { textDecoration: "none" } }, "Day in review"))),
      grid);
    host.append(wrap);
    return { update(ch) { if (ch.some(r => r.id === "live")) { host.innerHTML = ""; Landing(host); } } };
  }

  /* ================= cards & canvas ================= */
  function makeCard(id, opts) {
    opts = opts || {};
    const el = h("div", { class: "card", "data-id": id });
    const txt = h("div");
    editable(txt, () => { const r = Store.get(id); return r ? r.d.text : ""; }, v => { const r = Store.get(id); if (r && r.d.text !== v) Store.patch(id, { text: v }); }, opts.ph || "Write…");
    const au = h("span", { class: "au" });
    const tools = h("div", { class: "tools" },
      opts.colors === false ? null : h("div", { class: "swatches" }, COLORS.map(c => h("i", { style: { background: SWATCH[c] }, title: c, onclick: e => { e.stopPropagation(); Store.patch(id, { color: c }); } }))),
      h("button", { title: "Remove", onclick: e => { e.stopPropagation(); deleteWithUndo(id, "Card"); } }, icon("x")));
    el.append(txt, h("div", { class: "meta" }, au, tools));
    el._update = r => { txt._sync(); el.dataset.c = r.d.color || opts.color || "white"; au.textContent = r.a || ""; };
    el._edit = () => txt._edit();
    return el;
  }

  function Canvas(host, o) {
    const wrap = h("div", { class: "canvas-wrap" });
    const cv = h("div", { class: "canvas" });
    const links = o.links ? s("svg", { class: "links" }) : null;
    const layer = h("div");
    if (links) cv.append(links);
    cv.append(layer);
    if (o.corner) cv.append(o.corner);
    wrap.append(cv);
    const input = h("input", { placeholder: o.ph || "Add a card…" });
    const add = () => { const t = input.value.trim(); if (!t) return; Store.put(Object.assign({ id: uid("c"), k: "card", s: o.s, d: Object.assign({ text: t, color: o.color && o.color() }, o.extra ? o.extra() : {}) }, { a: "" })); input.value = ""; };
    input.addEventListener("keydown", e => { if (e.key === "Enter") add(); });
    const adder = h("div", { class: "adder" }, input, h("button", { class: "btn dark sm", onclick: add }, icon("plus"), "Add"), o.links ? h("span", { class: "muted", style: { fontSize: "12px", padding: "0 8px 0 2px" } }, "Drag ● to connect") : null);
    host.append(wrap, adder);

    let linkFrom = null, tmp = null;
    const W = () => Math.max(400, cv.clientWidth);
    const CW = 210, CELL_W = 228, CELL_H = 136, PAD = 18;

    function layout(items) {
      const w = W();
      const occ = [];
      if (o.reserve) occ.push({ x: 0, y: 0, w: o.reserve.w, h: o.reserve.h });
      const els = layer._map || new Map();
      items.forEach(r => { if (r.d.x != null) { const el = els.get(r.id); occ.push({ x: r.d.x * w, y: r.d.y, w: CW, h: el ? el.offsetHeight || 100 : 100 }); } });
      const cols = Math.max(1, Math.floor((w - PAD) / CELL_W));
      const pos = {};
      let slot = 0;
      items.forEach(r => {
        if (r.d.x != null) { pos[r.id] = { x: r.d.x * w, y: r.d.y }; return; }
        for (; slot < 4000; slot++) {
          const x = PAD + (slot % cols) * CELL_W, y = PAD + Math.floor(slot / cols) * CELL_H;
          const hit = occ.some(b => x < b.x + b.w + 8 && x + CW + 8 > b.x && y < b.y + b.h + 8 && y + 110 > b.y);
          if (!hit) { pos[r.id] = { x, y }; occ.push({ x, y, w: CW, h: 110 }); slot++; break; }
        }
      });
      return pos;
    }

    function drawLinks() {
      if (!links) return;
      links.innerHTML = "";
      const map = layer._map || new Map();
      Store.list(r => r.k === "link" && r.s === o.s).forEach(l => {
        const a = map.get(l.d.a), b = map.get(l.d.b);
        if (!a || !b) return;
        const ax = a.offsetLeft + a.offsetWidth, ay = a.offsetTop + a.offsetHeight / 2;
        const bx = b.offsetLeft, by = b.offsetTop + b.offsetHeight / 2;
        const dx = Math.max(40, Math.abs(bx - ax) / 2);
        const p = s("path", { d: `M${ax},${ay} C${ax + dx},${ay} ${bx - dx},${by} ${bx},${by}` });
        p.addEventListener("click", () => deleteWithUndo(l.id, "Connection"));
        p.appendChild(s("title", { text: "Click to remove" }));
        links.append(p);
      });
      if (tmp) links.append(tmp);
    }

    function update() {
      const items = Store.list(o.filter);
      keyed(layer, items, r => r.id, r => {
        const el = makeCard(r.id, { color: o.color && o.color(), ph: o.cardPh });
        dragFree(el, {
          move: () => drawLinks(),
          end: (x, y) => Store.patch(r.id, { x: x / W(), y: Math.round(y) }),
          click: () => el._edit()
        });
        if (o.links) {
          const port = h("div", { class: "port", title: "Drag to connect" });
          port.addEventListener("pointerdown", e => {
            e.stopPropagation(); e.preventDefault();
            linkFrom = r.id; el.classList.add("src"); cv.classList.add("linking");
            const rect = cv.getBoundingClientRect();
            const sx = el.offsetLeft + el.offsetWidth, sy = el.offsetTop + el.offsetHeight / 2;
            tmp = s("path", { d: "" });
            const mv = ev => { tmp.setAttribute("d", `M${sx},${sy} L${ev.clientX - rect.left + wrap.scrollLeft - (wrap.scrollLeft)},${ev.clientY - rect.top}`); drawLinks(); };
            const up = ev => {
              document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
              const t = document.elementsFromPoint(ev.clientX, ev.clientY).map(n => n.closest && n.closest(".card")).find(Boolean);
              if (t && t.dataset.id && t.dataset.id !== linkFrom) Store.put({ id: uid("l"), k: "link", s: o.s, d: { a: linkFrom, b: t.dataset.id } });
              el.classList.remove("src"); cv.classList.remove("linking"); tmp = null; linkFrom = null; drawLinks();
            };
            document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
          });
          el.append(port);
        }
        return el;
      }, (el, r) => el._update(r));
      const pos = layout(items);
      let maxY = o.reserve ? o.reserve.h : 0;
      items.forEach(r => {
        const el = layer._map.get(r.id); const p = pos[r.id]; if (!el || !p) return;
        if (!el.classList.contains("dragging")) { el.style.left = p.x + "px"; el.style.top = p.y + "px"; }
        maxY = Math.max(maxY, p.y + (el.offsetHeight || 100));
      });
      cv.style.height = Math.max(wrap.clientHeight, maxY + 120) + "px";
      drawLinks();
      if (o.onCount) o.onCount(items.length);
    }
    const ro = new ResizeObserver(() => update());
    ro.observe(wrap);
    update();
    return { update, destroy() { ro.disconnect(); } };
  }

  /* ================= figures (fallbacks) ================= */
  const FIG = I.FIG;

  /* ================= icebreaker ================= */
  function Ice(host, sess) {
    const ids = ["who"].concat(I.ICE.map(x => x.id));
    let q = ids.includes(live().q) ? live().q : "who";
    const count = h("span", { class: "pill counter" });
    const t = tabs([{ id: "who", label: "Who’s here" }].concat(I.ICE.map((x, i) => ({ id: x.id, label: (i + 1) + " · " + x.title, dot: `var(--${x.color})` }))), q, id => { q = id; if (live().session === "ice") setLive({ q }); draw(); });
    const fr = frame(host, "Icebreaker", [t, count]);
    let sub = null;
    function draw() {
      if (sub && sub.destroy) sub.destroy();
      fr.body.innerHTML = "";
      if (q === "who") { sub = People(fr.body); return; }
      const Q = I.ICE.find(x => x.id === q);
      const fig = h("div", { class: "fig" }, I.figureImg(Q.img, FIG[Q.id]));
      const corner = h("div", { class: "corner" }, fig, h("div", { class: "q" }, Q.title), h("div", { class: "qs" }, Q.sub));
      sub = Canvas(fr.body, { s: "ice", filter: r => r.k === "card" && r.s === "ice" && r.d.q === q, extra: () => ({ q }), color: () => Q.color, corner, reserve: { w: 290, h: 420 }, ph: "Add a card to this question…", onCount: n => count.textContent = n + (n === 1 ? " card" : " cards") });
    }
    function People(body) {
      const wrap = h("div", { class: "people scroll" });
      const grid = h("div", { class: "people-grid" });
      const empty = h("div", { class: "people-empty" }, h("div", { class: "h-l" }, "Scan, introduce yourself"), h("div", { class: "muted" }, "Names appear here as people join."));
      wrap.append(empty, grid); body.append(wrap);
      function fill() {
        const ps = Store.list(r => r.k === "person");
        count.textContent = ps.length + (ps.length === 1 ? " person" : " people");
        empty.style.display = ps.length ? "none" : "";
        keyed(grid, ps, r => r.id, r => h("div", { class: "person" }, h("div", { class: "pn" }), h("div", { class: "pr" })), (el, r) => {
          el.querySelector(".pn").textContent = r.d.name || "Guest";
          el.querySelector(".pr").textContent = r.d.role || "";
          el.style.setProperty("--hue", (Array.from(r.id).reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360);
        });
      }
      fill();
      return { update: fill };
    }
    draw();
    return { update: () => sub && sub.update && sub.update(), destroy: () => sub && sub.destroy && sub.destroy() };
  }

  /* ================= presentation ================= */
  function Presentation(host, o) {
    const box = h("div", { class: "pres" });
    host.append(box);
    let url = null, frameEl = null;
    async function draw() {
      box.innerHTML = "";
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      url = null;
      const link = setting(o.urlKey);
      if (link) url = o.kind === "slides" ? I.embedSlides(link) : link;
      else { const f = await I.Files.get(o.fileKey); if (f) url = URL.createObjectURL(f) + "#view=FitH"; }
      const bar = h("div", { class: "pres-bar" },
        h("button", { class: "btn sm", onclick: source }, icon("edit"), "Source"),
        h("button", { class: "btn icon", title: "Full screen", onclick: () => (box.requestFullscreen ? box.requestFullscreen() : null) }, icon("expand")));
      if (url) { frameEl = h("iframe", { src: url, allow: "fullscreen", allowfullscreen: true }); box.append(frameEl, bar); }
      else {
        const inp = h("input", { class: "input", placeholder: o.kind === "slides" ? "Paste a Google Slides link" : "Paste a PDF link", style: { maxWidth: "420px" } });
        inp.addEventListener("change", () => { setSetting(o.urlKey, inp.value.trim()); draw(); });
        box.append(h("div", { class: "ph" }, h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" } },
          h("div", { class: "h-l", style: { color: "#fff" } }, o.title),
          inp, h("div", { class: "row" }, fileButton("Or load a PDF", o.fileKey, draw)))));
      }
    }
    function source() {
      const inp = h("input", { class: "input", value: setting(o.urlKey) || "", placeholder: o.kind === "slides" ? "https://docs.google.com/presentation/d/…" : "https://…pdf" });
      modal([h("div", { class: "label" }, o.title), h("div", { class: "h-l", style: { margin: "6px 0 16px" } }, "Source"),
        h("div", { class: "field" }, h("label", { class: "label" }, o.kind === "slides" ? "Google Slides link" : "PDF link"), inp),
        h("div", { class: "row", style: { marginTop: "14px", justifyContent: "space-between" } },
          h("div", { class: "row" }, fileButton("Load PDF", o.fileKey, () => { setSetting(o.urlKey, ""); closeOverlays(); draw(); }), h("button", { class: "btn sm ghost", onclick: async () => { await I.Files.del(o.fileKey); setSetting(o.urlKey, ""); closeOverlays(); draw(); } }, "Clear")),
          h("button", { class: "btn dark", onclick: () => { setSetting(o.urlKey, inp.value.trim()); closeOverlays(); draw(); } }, "Save"))]);
    }
    draw();
    let last = setting(o.urlKey);
    function goto(page) {
      if (!frameEl || !url) return;
      const base = url.split("#")[0];
      frameEl.src = "about:blank";
      setTimeout(() => { frameEl.src = base + "#page=" + page + "&view=FitH"; }, 40);
    }
    return { goto, update(ch) { if (ch.some(r => r.id === "cfg") && setting(o.urlKey) !== last) { last = setting(o.urlKey); draw(); } } };
  }

  /* ================= session 1 · IPOS Now, connecting the dots ================= */
  function S1(host) {
    const TABS = [{ id: "canvas", label: "Canvas" }, { id: "stand", label: "Where we stand" }, { id: "trust", label: "Trust" }, { id: "dots", label: "Connecting the dots" }];
    let tab = TABS.some(x => x.id === live().tab) && live().session === "s1" ? live().tab : "stand";
    const t = tabs(TABS, tab, id => { tab = id; if (live().session === "s1") setLive({ tab }); draw(); });
    const fr = frame(host, "IPOS Now, connecting the dots", [t]);
    let sub = null;
    function draw() {
      if (sub && sub.destroy) sub.destroy();
      fr.body.innerHTML = "";
      if (tab === "canvas") sub = Presentation(fr.body, { urlKey: "slidesSession1", fileKey: "s1deck", kind: "slides", title: "Canvas and toolkit" });
      else if (tab === "stand") sub = Stand(fr.body);
      else if (tab === "trust") sub = Trust(fr.body);
      else sub = Dots(fr.body);
    }
    draw();
    return { update: ch => sub && sub.update && sub.update(ch), destroy: () => sub && sub.destroy && sub.destroy() };
  }

  function standData() {
    const rs = Store.list(r => r.k === "spis" && r.s === "s1");
    const now = rs.map(r => r.d.now).filter(v => v != null), aim = rs.map(r => r.d.aim).filter(v => v != null);
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const models = {}; I.MODELS.forEach(m => models[m.id] = rs.filter(r => r.d.model === m.id).length);
    return { rs, now, aim, mNow: mean(now), mAim: mean(aim), models };
  }
  const spectrumLabel = v => v == null ? "—" : I.SPECTRUM[Math.min(3, Math.floor(v / 25))].label;

  function Stand(body) {
    const root = h("div", { class: "stand" });
    const top = h("div", { class: "panel stand-top" });
    const bottom = h("div", { class: "panel stand-models" });
    root.append(top, bottom); body.append(root);
    const W = 1200, H = 430, L = 40, R = 40, PW = W - L - R;
    const X = v => L + v / 100 * PW;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "spectrum" });
    // bands
    [["Informational", 0, 50], ["Relational", 50, 75], ["Systems", 75, 100]].forEach(([n, a, b], i) => {
      svg.append(s("text", { x: X(a) + 4, y: 26, "font-size": 15, "font-style": "italic", fill: "#7A7A7A", text: n }));
      if (i) svg.append(s("line", { x1: X(a), x2: X(a), y1: 12, y2: 34, stroke: "#CFCFCF" }));
    });
    svg.append(s("line", { x1: L, x2: W - R, y1: 40, y2: 40, stroke: "#CFCFCF", "stroke-dasharray": "2 4" }));
    // nested ellipses evoking the spectrum
    [[100, "#E6E6E6"], [75, "#D8D8D8"], [50, "#C6C6C6"], [25, "#B0B0B0"]].forEach(([w, f]) => svg.append(s("rect", { x: L, y: 58, width: w / 100 * PW, height: 92, rx: 46, fill: f, opacity: .55 })));
    I.SPECTRUM.forEach((sp, i) => {
      const x = X(i * 25) + 18;
      svg.append(s("text", { x, y: 94, "font-size": 18, "font-weight": 700, fill: "#111", text: sp.label }));
      const words = sp.desc.split(" "); let l1 = "", l2 = "";
      words.forEach(w => { if (!l2 && (l1 + " " + w).length <= 34) l1 = (l1 + " " + w).trim(); else l2 = (l2 + " " + w).trim(); });
      svg.append(s("text", { x, y: 120, "font-size": 13, fill: "#4A4A4A", text: l1 }));
      if (l2) svg.append(s("text", { x, y: 137, "font-size": 13, fill: "#4A4A4A", text: l2 }));
    });
    svg.append(s("text", { x: L, y: 186, "font-size": 13, fill: "#9A9A9A", text: "Linear dissemination, from producer to user" }));
    svg.append(s("text", { x: W - R, y: 186, "font-size": 13, fill: "#9A9A9A", "text-anchor": "end", text: "Co-production of knowledge, social learning, innovation" }));
    svg.append(s("line", { x1: L, x2: W - R, y1: 200, y2: 200, stroke: "#9A9A9A", "stroke-width": 1.5, "marker-end": "url(#arr)" }));
    svg.append(s("defs", null, s("marker", { id: "arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: "#9A9A9A" })),
      s("marker", { id: "arr2", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, s("path", { d: "M0,0 L10,5 L0,10 z", fill: "#0B0B0B" }))));
    svg.append(s("text", { x: L, y: 250, "font-size": 12, "font-weight": 700, "letter-spacing": ".08em", fill: "#9A9A9A", text: "TODAY" }));
    svg.append(s("text", { x: L, y: 340, "font-size": 12, "font-weight": 700, "letter-spacing": ".08em", fill: "#9A9A9A", text: "IN 13 MONTHS" }));
    const dots = s("g"); const means = s("g");
    svg.append(dots, means);
    top.append(svg, h("div", { class: "cite" }, "Spectrum of intermediary and brokering functions, after Harvey, Lewin and Fisher (2012)."));
    const mrow = h("div", { class: "models" });
    bottom.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "h-m" }, "How does knowledge flow for IPOS Now?"), h("span", { class: "label counter mcount" })), mrow,
      h("div", { class: "cite" }, "Science push, policy pull and co-production (Dilling & Lemos, 2011; Burton, Wang & White, 2019)."));
    const segs = {};
    I.MODELS.forEach((m, i) => { const el = h("div", { class: "mseg", style: { background: ["#D9D9D9", "#9CC0E3", "#0B0B0B"][i], color: i === 2 ? "#fff" : "#111" } }, h("b", null, m.label), h("small", null, m.desc), h("span", { class: "mn" })); segs[m.id] = el; mrow.append(el); });
    const marks = {};
    function update() {
      const D = standData();
      // participant dots
      D.rs.forEach((r, i) => {
        const j = (i * 37 % 7) * 9 - 27;
        ["now", "aim"].forEach(k => {
          if (r.d[k] == null) return;
          const key = r.id + k; let g = marks[key];
          if (!g) { g = s("circle", { r: 9, cx: 0, cy: 0, class: "pdot", fill: k === "aim" ? "#0B0B0B" : "#fff", stroke: "#0B0B0B", "stroke-width": 2, opacity: .8 }); dots.append(g); marks[key] = g; }
          g.style.transform = `translate(${X(r.d[k])}px,${(k === "now" ? 270 : 360) + j}px)`;
        });
      });
      Object.keys(marks).forEach(k => { const id = k.replace(/(now|aim)$/, ""); const r = Store.get(id); if (!r || r.d[k.endsWith("now") ? "now" : "aim"] == null) { marks[k].remove(); delete marks[k]; } });
      means.innerHTML = "";
      if (D.mNow != null && D.mAim != null) {
        means.append(s("path", { d: `M${X(D.mNow)},292 C${X(D.mNow)},322 ${X(D.mAim)},312 ${X(D.mAim)},338`, fill: "none", stroke: "#0B0B0B", "stroke-width": 2.5, "marker-end": "url(#arr2)", class: "draw" }));
      }
      [["now", D.mNow, 232], ["aim", D.mAim, 412]].forEach(([k, v, y]) => {
        if (v == null) return;
        const anchor = X(v) > W - 200 ? "end" : X(v) < 200 ? "start" : "middle";
        means.append(s("line", { x1: X(v), x2: X(v), y1: k === "now" ? 238 : 380, y2: k === "now" ? 302 : 396, stroke: "#E06666", "stroke-width": 3, "stroke-linecap": "round" }));
        means.append(s("text", { x: X(v), y, "text-anchor": anchor, "font-size": 15, "font-weight": 700, fill: "#E06666", text: (k === "now" ? "Today · " : "Aim · ") + spectrumLabel(v) }));
      });
      const tot = Object.values(D.models).reduce((a, b) => a + b, 0);
      I.MODELS.forEach(m => { const n = D.models[m.id]; segs[m.id].style.flexGrow = tot ? Math.max(.25, n) : 1; segs[m.id].querySelector(".mn").textContent = tot ? Math.round(n / tot * 100) + "%" : ""; });
      bottom.querySelector(".mcount").textContent = D.rs.length + (D.rs.length === 1 ? " answer" : " answers");
    }
    update();
    return { update: ch => { if (!ch || ch.some(r => r.k === "spis")) update(); } };
  }

  function trustData() {
    const rs = Store.list(r => r.k === "trust" && r.s === "s1");
    const crele = {}; I.CRELE.forEach(c => { const v = rs.map(r => r.d[c.id]).filter(x => x != null); crele[c.id] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
    const tokens = I.TRUST.map(t => ({ t, n: rs.reduce((a, r) => a + ((r.d.tokens || {})[t.id] || 0), 0) })).sort((a, b) => b.n - a.n);
    return { rs, crele, tokens };
  }
  function Trust(body) {
    const root = h("div", { class: "trust" });
    const left = h("div", { class: "panel trust-tri" });
    const right = h("div", { class: "panel trust-bars" });
    root.append(left, right); body.append(root);
    left.append(h("div", { class: "h-m" }, "Trust triangle"), h("div", { class: "muted", style: { fontSize: "13px" } }, "How strong is IPOS Now today? Mean of answers, 1–5."));
    const holder = h("div", { class: "tri-holder" }); left.append(holder, h("div", { class: "cite" }, "Credibility, relevance and legitimacy (Cash et al., 2003)."));
    const list = h("div", { class: "tbars" });
    right.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "h-m" }, "What will build trust in IPOS Now?"), h("span", { class: "label counter tcount" })),
      h("div", { class: "muted", style: { fontSize: "13px" } }, "Each participant spends " + I.TOKENS + " tokens."), list,
      h("div", { class: "cite" }, "Strategies for building trust at the science–policy interface (Cvitanovic et al., 2021)."));
    function tri(D) {
      const S = 420, cx = S / 2, cy = S / 2 + 20, R = 160;
      const ang = i => -Math.PI / 2 + i * 2 * Math.PI / 3;
      const P = (i, v) => [cx + Math.cos(ang(i)) * R * v / 5, cy + Math.sin(ang(i)) * R * v / 5];
      const sv = s("svg", { viewBox: `0 0 ${S} ${S}` });
      for (let k = 1; k <= 5; k++) sv.append(s("polygon", { points: [0, 1, 2].map(i => P(i, k).join(",")).join(" "), fill: "none", stroke: k === 5 ? "#BDBDBD" : "#E2E2E2", "stroke-width": k === 5 ? 1.5 : 1 }));
      I.CRELE.forEach((c, i) => {
        sv.append(s("line", { x1: cx, y1: cy, x2: P(i, 5)[0], y2: P(i, 5)[1], stroke: "#E2E2E2" }));
        const [lx, ly] = P(i, 6.1);
        sv.append(s("text", { x: lx, y: ly + (i === 0 ? -4 : 12), "text-anchor": "middle", "font-size": 16, "font-weight": 700, fill: "#111", text: c.label }));
        const v = D.crele[c.id];
        sv.append(s("text", { x: lx, y: ly + (i === 0 ? 14 : 30), "text-anchor": "middle", "font-size": 13, fill: "#7A7A7A", text: v == null ? c.desc : v.toFixed(1) + " / 5" }));
      });
      if (I.CRELE.every(c => D.crele[c.id] != null)) {
        sv.append(s("polygon", { class: "tri-poly", points: I.CRELE.map((c, i) => P(i, D.crele[c.id]).join(",")).join(" "), fill: "rgba(36,132,198,.22)", stroke: "#2484C6", "stroke-width": 2.5, "stroke-linejoin": "round" }));
        I.CRELE.forEach((c, i) => { const [x, y] = P(i, D.crele[c.id]); sv.append(s("circle", { cx: x, cy: y, r: 6, fill: "#2484C6", stroke: "#fff", "stroke-width": 2 })); });
      }
      return sv;
    }
    function update() {
      const D = trustData();
      holder.innerHTML = ""; holder.append(tri(D));
      const max = Math.max(1, ...D.tokens.map(x => x.n));
      keyed(list, D.tokens, x => x.t.id, x => h("div", { class: "tbar" }, h("span", { class: "tlab" }, x.t.label), h("div", { class: "ttrack" }, h("i")), h("span", { class: "tn counter" })), (el, x) => {
        el.querySelector("i").style.width = (x.n / max * 100) + "%";
        el.querySelector(".tn").textContent = x.n;
        el.classList.toggle("lead", x.n > 0 && x === D.tokens[0]);
      });
      right.querySelector(".tcount").textContent = D.rs.length + (D.rs.length === 1 ? " answer" : " answers");
    }
    update();
    return { update: ch => { if (!ch || ch.some(r => r.k === "trust")) update(); } };
  }

  function dotsData() {
    const ds = Store.list(r => r.k === "dot" && r.s === "s1" && r.d.aud && r.d.prod);
    const links = {};
    ds.forEach(r => { const k = r.d.aud + "|" + r.d.prod + "|" + (r.d.mode || "inform"); (links[k] = links[k] || { aud: r.d.aud, prod: r.d.prod, mode: r.d.mode || "inform", n: 0, recs: [] }).n++; links[k].recs.push(r); });
    return { ds, links: Object.values(links) };
  }
  function Dots(body) {
    const root = h("div", { class: "dots" });
    const net = h("div", { class: "panel dots-net" });
    const side = h("div", { class: "panel dots-side" });
    root.append(net, side); body.append(root);
    let sel = null, hover = null;
    const legend = h("div", { class: "legend" }, I.MODES.map(m => h("span", { class: "lg" }, s("svg", { viewBox: "0 0 34 10", width: 34, height: 10 }, s("path", { d: "M1,5 H33", stroke: m.color, "stroke-width": m.id === "cocreate" ? 4 : 2.2, "stroke-dasharray": m.id === "inform" ? "4 4" : null })), h("b", null, m.label), h("small", null, " · " + m.sub))),
      h("button", { class: "btn sm ghost", onclick: editLists }, icon("edit"), "Lists"));
    const holder = h("div", { class: "net-holder" });
    net.append(legend, holder);
    function draw() {
      const A = I.audiences(), P = I.products(), D = dotsData();
      const W = 1000, rowA = 560 / Math.max(A.length, 1), rowP = 560 / Math.max(P.length, 1), H = 600;
      const ya = i => 30 + rowA * (i + .5), yp = i => 30 + rowP * (i + .5);
      const xa = 340, xp = W - 300;
      const sv = s("svg", { viewBox: `0 0 ${W} ${H}` });
      sv.append(s("text", { x: xa, y: 16, "text-anchor": "end", "font-size": 12, "font-weight": 700, "letter-spacing": ".08em", fill: "#9A9A9A", text: "AUDIENCES" }));
      sv.append(s("text", { x: xp, y: 16, "font-size": 12, "font-weight": 700, "letter-spacing": ".08em", fill: "#9A9A9A", text: "IPOS NOW PRODUCTS" }));
      const focus = hover || sel;
      const lg = s("g");
      sv.append(lg);
      D.links.sort((a, b) => ["inform", "exchange", "cocreate"].indexOf(a.mode) - ["inform", "exchange", "cocreate"].indexOf(b.mode)).forEach(l => {
        const ai = A.findIndex(a => a.id === l.aud), pi = P.findIndex(p => p.id === l.prod);
        if (ai < 0 || pi < 0) return;
        const m = I.MODES.find(x => x.id === l.mode) || I.MODES[0];
        const off = (["inform", "exchange", "cocreate"].indexOf(l.mode) - 1) * 5;
        const y1 = ya(ai) + off, y2 = yp(pi) + off;
        const on = !focus || focus === l.aud || focus === l.prod;
        const path = s("path", { d: `M${xa + 14},${y1} C${xa + 160},${y1} ${xp - 160},${y2} ${xp - 14},${y2}`, fill: "none", stroke: m.color, "stroke-width": (l.mode === "cocreate" ? 3 : 1.8) + Math.min(6, (l.n - 1) * 1.4), "stroke-dasharray": l.mode === "inform" ? "5 6" : null, opacity: on ? .9 : .07, class: "link" });
        path.append(s("title", { text: `${A[ai].name} → ${P[pi].name} · ${m.label} · ${l.n}` }));
        lg.append(path);
      });
      const deg = id => D.ds.filter(r => r.d.aud === id || r.d.prod === id).length;
      const node = (x, y, name, id, side) => {
        const on = !focus || focus === id || D.links.some(l => (l.aud === focus && l.prod === id) || (l.prod === focus && l.aud === id));
        const g = s("g", { class: "node" + (sel === id ? " sel" : ""), opacity: on ? 1 : .25, style: "cursor:pointer" });
        const r = 7 + Math.min(9, deg(id) * 1.3);
        g.append(s("circle", { cx: x, cy: y, r, fill: sel === id ? "#E06666" : "#0B0B0B" }));
        g.append(s("text", { x: side === "a" ? x - r - 10 : x + r + 10, y: y + 5, "text-anchor": side === "a" ? "end" : "start", "font-size": 15, "font-weight": sel === id ? 700 : 500, fill: "#111", text: name }));
        g.addEventListener("mouseenter", () => { hover = id; draw(); });
        g.addEventListener("mouseleave", () => { hover = null; draw(); });
        g.addEventListener("click", () => { sel = sel === id ? null : id; draw(); panel(); });
        sv.append(g);
      };
      A.forEach((a, i) => node(xa, ya(i), a.name, a.id, "a"));
      P.forEach((p, i) => node(xp, yp(i), p.name, p.id, "p"));
      if (!D.ds.length) sv.append(s("text", { x: W / 2, y: H / 2, "text-anchor": "middle", "font-size": 16, fill: "#9A9A9A", text: "Connections from the phones will appear here" }));
      holder.innerHTML = ""; holder.append(sv);
    }
    function panel() {
      if (side.contains(document.activeElement)) return;
      const A = I.audiences(), P = I.products(), D = dotsData();
      const nameOf = id => (A.find(a => a.id === id) || P.find(p => p.id === id) || { name: id }).name;
      const isAud = sel && A.some(a => a.id === sel);
      const rs = sel ? D.ds.filter(r => r.d.aud === sel || r.d.prod === sel) : D.ds;
      side.innerHTML = "";
      side.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "label" }, sel ? (isAud ? "Audience" : "Product") : "All connections"), sel ? h("button", { class: "btn sm ghost", onclick: () => { sel = null; draw(); panel(); } }, "Show all") : h("span", { class: "label counter" }, rs.length)));
      side.append(h("div", { class: "h-l", style: { fontSize: "22px" } }, sel ? nameOf(sel) : "Audiences × products"));
      // modes
      const tot = rs.length || 1;
      side.append(h("div", { class: "mode-bar" }, I.MODES.map(m => { const n = rs.filter(r => (r.d.mode || "inform") === m.id).length; return n ? h("div", { style: { flexGrow: n, background: m.color } }, m.label + " " + Math.round(n / tot * 100) + "%") : null; })));
      // tones
      const tc = {}; rs.forEach(r => (r.d.tones || []).forEach(t => tc[t] = (tc[t] || 0) + 1));
      const tones = Object.entries(tc).sort((a, b) => b[1] - a[1]);
      side.append(h("div", { class: "label" }, "Tone"), tones.length ? h("div", { class: "chip-list" }, tones.map(([t, n]) => h("div", { class: "chip" }, t, h("b", { style: { marginLeft: "6px" } }, n)))) : h("div", { class: "muted" }, "—"));
      // connections & onboarding
      side.append(h("div", { class: "label" }, "Connections and onboarding moves"));
      const list = h("div", { class: "dlist" });
      rs.slice().reverse().forEach(r => {
        const m = I.MODES.find(x => x.id === (r.d.mode || "inform"));
        list.append(h("div", { class: "ditem2" },
          h("div", { class: "dh" }, h("b", null, nameOf(r.d.aud)), " → ", nameOf(r.d.prod), h("span", { class: "mtag", style: { background: m.color } }, m.label)),
          r.d.onboard ? h("div", { class: "don" }, r.d.onboard) : null,
          h("div", { class: "dm" }, h("span", null, r.a || ""), h("button", { class: "x", title: "Remove", onclick: () => deleteWithUndo(r.id, "Connection") }, icon("x")))));
      });
      if (!rs.length) list.append(h("div", { class: "muted" }, "—"));
      side.append(list);
      // quick add
      const sa = h("select", { class: "select" }, A.map(a => h("option", { value: a.id, selected: sel === a.id ? true : null }, a.name)));
      const sp = h("select", { class: "select" }, P.map(p => h("option", { value: p.id, selected: sel === p.id ? true : null }, p.name)));
      const sm = h("select", { class: "select" }, I.MODES.map(m => h("option", { value: m.id }, m.label + " · " + m.sub)));
      const on = h("input", { class: "input", placeholder: "Onboarding move (optional)" });
      side.append(h("details", { class: "qadd" }, h("summary", null, "+ Add a connection"),
        h("div", { style: { display: "grid", gap: "6px", marginTop: "8px" } }, sa, sp, sm, on,
          h("button", { class: "btn dark sm", onclick: () => { Store.put({ id: uid("dt"), k: "dot", s: "s1", d: { aud: sa.value, prod: sp.value, mode: sm.value, tones: [], onboard: on.value.trim() }, a: "" }); } }, "Add"))));
    }
    function editLists() {
      const ta1 = h("textarea", { class: "textarea", style: { minHeight: "200px" } }), ta2 = h("textarea", { class: "textarea", style: { minHeight: "200px" } });
      ta1.value = I.audiences().map(a => a.name).join("\n"); ta2.value = I.products().map(p => p.name).join("\n");
      const toList = (txt, old) => txt.split("\n").map(x => x.trim()).filter(Boolean).map(n => (old.find(o => o.name === n) || { id: uid("n"), name: n }));
      drawer("Audiences and products", [h("div", { class: "label" }, "Audiences · one per line"), ta1, h("div", { class: "label" }, "Products · one per line"), ta2,
        h("div", { class: "row" }, h("button", { class: "btn dark", onclick: () => { Store.setDoc("s1:audiences", "doc", "s1", { list: toList(ta1.value, I.audiences()) }); Store.setDoc("s1:products", "doc", "s1", { list: toList(ta2.value, I.products()) }); closeOverlays(); } }, "Save"),
          h("button", { class: "btn ghost", onclick: () => { ta1.value = I.DEFAULT_AUDIENCES.map(a => a.name).join("\n"); ta2.value = I.DEFAULT_PRODUCTS.map(p => p.name).join("\n"); } }, "Restore defaults"))]);
    }
    draw(); panel();
    return { update: ch => { if (!ch || ch.some(r => r.k === "dot" || r.id === "s1:audiences" || r.id === "s1:products")) { draw(); panel(); } } };
  }

  /* ================= break 1 · desk stretch ================= */
  const BASE = '<path class="desk" d="M12 108H108"/>';
  const TORSO = '<path class="lim" d="M60 46V90M60 90L44 108M60 90L76 108"/>';
  const STRETCHES = [
    { name: "Neck release", cue: "Ear to shoulder, side to side", sec: 40,
      svg: BASE + TORSO + '<path class="lim" d="M42 52H78M42 52L38 82M78 52L82 82"/><g class="anim a-tilt"><circle class="hd" cx="60" cy="28" r="11"/><path class="lim" d="M60 39V48"/></g>' },
    { name: "Shoulder rolls", cue: "Lift, roll back, release", sec: 30,
      svg: BASE + TORSO + '<circle class="hd" cx="60" cy="28" r="11"/><g class="anim a-roll"><path class="lim" d="M42 52H78M42 52L38 82M78 52L82 82"/></g><path class="lim" d="M30 44a12 12 0 0 1 10-10M90 44a12 12 0 0 0-10-10" stroke-width="3" opacity=".45"/>' },
    { name: "Overhead reach", cue: "Fingers laced, palms up", sec: 30,
      svg: BASE + TORSO + '<circle class="hd" cx="60" cy="30" r="11"/><g class="anim a-reach"><path class="lim" d="M42 52H78M42 52L48 22L60 8M78 52L72 22L60 8"/></g>' },
    { name: "Seated twist", cue: "Rotate gently, then switch", sec: 40,
      svg: BASE + '<path class="lim" d="M60 90L44 108M60 90L76 108"/><circle class="hd" cx="60" cy="28" r="11"/><g class="anim a-twist"><path class="lim" d="M60 46V90M42 52H78M42 52L58 74L76 78M78 52L92 70"/></g>' },
    { name: "Wrists and fingers", cue: "Arm forward, ease fingers back", sec: 30,
      svg: BASE + TORSO + '<circle class="hd" cx="60" cy="28" r="11"/><path class="lim" d="M42 52H78M78 52H100M42 52L62 60L98 56"/><g class="anim a-wrist"><path class="lim" d="M100 52V36"/></g>' },
    { name: "Chest opener", cue: "Hands behind, shoulders open", sec: 30,
      svg: BASE + '<path class="lim" d="M60 90L44 108M60 90L76 108"/><circle class="hd" cx="60" cy="26" r="11"/><g class="anim a-open"><path class="lim" d="M60 42V90M40 50H80M40 50L50 84H70L80 50"/></g>' },
    { name: "Three deep breaths", cue: "In through the nose, long exhale", sec: 30,
      svg: BASE + '<g class="anim a-breath"><circle class="hd" cx="60" cy="28" r="11"/><path class="lim" d="M60 42V90M60 90L44 108M60 90L76 108M42 52H78M42 52L36 80M78 52L84 80"/></g><path class="lim" d="M84 26q8 0 12-6M84 34q12 0 18-8" stroke-width="3" opacity=".45"/>' }
  ];
  const figSvg = (x, cls) => `<svg viewBox="0 0 120 120" class="fig-svg ${cls || ""}">${x.svg}</svg>`;

  function Stretch(host) {
    const fr = frame(host, "Desk stretch", []);
    let idx = 0, left = STRETCHES[0].sec, running = false, timer = null;
    const root = h("div", { class: "stretch" });
    const stage = h("div", { class: "st-stage panel" });
    const list = h("div", { class: "st-list" });
    root.append(stage, list); fr.body.append(root);
    const C = 2 * Math.PI * 47;
    const ringFg = s("circle", { cx: 50, cy: 50, r: 47, stroke: "#0B0B0B", "stroke-dasharray": C, "stroke-dashoffset": 0, "stroke-linecap": "round", style: "transition:stroke-dashoffset 1s linear" });
    const ring = s("svg", { class: "ring", viewBox: "0 0 100 100" }, s("circle", { cx: 50, cy: 50, r: 47, stroke: "#E2E2E2" }), ringFg);
    const figBox = h("div", { class: "fig" });
    const name = h("div", { class: "st-name" }), cue = h("div", { class: "st-cue" }), time = h("div", { class: "st-time" });
    const playBtn = h("button", { class: "btn dark", onclick: () => toggle() });
    stage.append(h("div", { class: "st-ring" }, ring, figBox), name, cue, time,
      h("div", { class: "row" }, h("button", { class: "btn icon", title: "Restart", onclick: () => go(0) }, icon("reset")), playBtn, h("button", { class: "btn icon", title: "Next", onclick: () => go(idx + 1) }, icon("next"))));
    function render() {
      const x = STRETCHES[idx];
      figBox.innerHTML = figSvg(x);
      name.textContent = x.name; cue.textContent = x.cue;
      list.innerHTML = "";
      STRETCHES.forEach((y, i) => list.append(h("button", { class: "st-item" + (i === idx ? " on" : ""), onclick: () => go(i) }, h("span", { style: { display: "contents" }, html: figSvg(y) }), h("div", null, h("b", null, y.name), h("small", null, y.sec + " s")))));
      tick(true);
    }
    function tick(silent) {
      const x = STRETCHES[idx];
      ringFg.setAttribute("stroke-dashoffset", (C * (1 - left / x.sec)).toFixed(1));
      const total = STRETCHES.slice(idx).reduce((a, y, i) => a + (i === 0 ? left : y.sec), 0);
      time.textContent = `${left}s · ${idx + 1}/${STRETCHES.length} · ${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} left`;
      playBtn.innerHTML = ""; playBtn.append(icon(running ? "pause" : "play"), running ? "Pause" : (left === x.sec && idx === 0 ? "Start" : "Resume"));
    }
    function toggle() {
      running = !running;
      clearInterval(timer);
      if (running) timer = setInterval(() => { left--; if (left <= 0) { if (idx < STRETCHES.length - 1) { go(idx + 1, true); return; } running = false; clearInterval(timer); left = 0; } tick(); }, 1000);
      tick();
    }
    function go(i, keep) { idx = Math.max(0, Math.min(STRETCHES.length - 1, i)); left = STRETCHES[idx].sec; if (!keep) { running = false; clearInterval(timer); } render(); }
    render();
    return { destroy: () => clearInterval(timer) };
  }

  /* ================= session 2 · emergency simulation ================= */
  function S2(host) {
    const fr = frame(host, "Emergency simulation", []);
    const root = h("div", { class: "s2" });
    const left = h("div", { class: "s2-left" });
    const machine = h("div", { class: "machine" });
    const numReel = h("div", { class: "reel num" }, h("div", { class: "strip" }));
    const txtReel = h("div", { class: "reel" }, h("div", { class: "strip" }));
    const lever = h("button", { class: "btn lever", onclick: () => spin() }, icon("shuffle"), "Draw an emergency");
    machine.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("div", { class: "lights" }, Array.from({ length: 9 }, () => h("i"))), h("button", { class: "btn sm ghost", style: { color: "#bbb" }, onclick: editList }, icon("edit"), "List")), h("div", { class: "reels" }, numReel, txtReel), lever);
    const challenge = h("div", { class: "challenge panel" });
    const tray = h("div", { class: "tray panel" });
    left.append(machine, challenge, tray);
    const track = h("div", { class: "track panel" });
    root.append(left, track); fr.body.append(root);
    const roundsEl = h("div", { class: "rounds" });
    fr.head.lastChild.append(roundsEl);

    const LOOPS = 9;
    let spinning = false;
    function buildReels() {
      const list = I.emergencies();
      const ns = numReel.firstChild, ts = txtReel.firstChild;
      ns.innerHTML = ""; ts.innerHTML = "";
      for (let k = 0; k < LOOPS; k++) list.forEach((e, i) => { ns.append(h("div", { class: "cell" }, i + 1)); ts.append(h("div", { class: "cell" }, e)); });
      const r = currentRound(); const i = r ? r.d.e : 0;
      ns.style.transition = ts.style.transition = "none";
      ns.style.transform = ts.style.transform = `translateY(${-i * 120}px)`;
    }
    function currentRound() { const c = Store.get("s2:current"); return c && Store.get(c.d.id); }
    function spin() {
      if (spinning) return;
      const list = I.emergencies(); const prev = currentRound();
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && prev && i === prev.d.e) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
      spinning = true; machine.classList.add("spinning");
      const ns = numReel.firstChild, ts = txtReel.firstChild;
      const target = (LOOPS - 1) * list.length + i;
      ns.style.transition = "transform 2.6s cubic-bezier(.15,.72,.12,1)"; ts.style.transition = "transform 3.3s cubic-bezier(.15,.72,.12,1)";
      requestAnimationFrame(() => { ns.style.transform = `translateY(${-(target - list.length) * 120}px)`; ts.style.transform = `translateY(${-target * 120}px)`; });
      setTimeout(() => {
        spinning = false; machine.classList.remove("spinning");
        const id = uid("r");
        Store.put({ id, k: "round", s: "s2", d: { e: i, text: list[i], n: 6 }, a: "" });
        Store.setDoc("s2:current", "doc", "s2", { id });
        buildReels();
      }, 3400);
    }
    function editList() {
      const ta = h("textarea", { class: "textarea", style: { minHeight: "300px" } });
      ta.value = I.emergencies().join("\n\n");
      drawer("Emergencies", [h("div", { class: "muted", style: { fontSize: "13px" } }, "One emergency per paragraph."), ta,
        h("div", { class: "row" }, h("button", { class: "btn dark", onclick: () => { const list = ta.value.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean); if (list.length) { Store.setDoc("s2:emergencies", "doc", "s2", { list }); closeOverlays(); buildReels(); } } }, "Save"), h("button", { class: "btn ghost", onclick: () => { ta.value = I.DEFAULT_EMERGENCIES.join("\n\n"); } }, "Restore defaults"))]);
    }

    function stepEl(r) {
      const el = h("div", { class: "block", "data-id": r.id });
      const t = h("div");
      editable(t, () => { const x = Store.get(r.id); return x ? x.d.text : ""; }, v => { const x = Store.get(r.id); if (x && x.d.text !== v) Store.patch(r.id, { text: v }); }, "Step…");
      el.append(t, h("button", { class: "x", title: "Remove", onclick: () => deleteWithUndo(r.id, "Step") }, icon("x")));
      el._update = () => t._sync();
      dragTransfer(el, {
        drop: tgt => {
          const round = currentRound(); if (!round) return;
          const me = Store.get(r.id); const from = me.d.slot;
          if (tgt.dataset.drop === "tray") { Store.patch(r.id, { slot: null }); return; }
          const j = +tgt.dataset.drop.split(":")[1];
          const other = Store.list(x => x.k === "step" && x.d.round === round.id && x.d.slot === j && x.id !== r.id)[0];
          if (other) Store.patch(other.id, { slot: from == null || from >= round.d.n ? null : from });
          Store.patch(r.id, { slot: j });
        },
        click: () => t._edit()
      });
      return el;
    }

    const trayList = h("div", { class: "tray-list", "data-drop": "tray" });
    const stepIn = h("input", { class: "input", placeholder: "Add a step…" });
    stepIn.addEventListener("keydown", e => { if (e.key === "Enter" && stepIn.value.trim()) { const r = currentRound(); if (!r) { toast("Draw an emergency first"); return; } Store.put({ id: uid("st"), k: "step", s: "s2", d: { round: r.id, text: stepIn.value.trim(), slot: null }, a: "" }); stepIn.value = ""; } });
    tray.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "label" }, "Steps"), h("span", { class: "label counter tcount" })), trayList, stepIn);

    const grid = h("div", { class: "lane-grid" });
    const road = s("svg", { class: "road" });
    const trackHead = h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "18px", position: "relative", zIndex: 2 } });
    track.append(trackHead, h("div", { style: { position: "relative" } }, road, grid));
    let spotLists = [];

    function drawTrack() {
      const r = currentRound();
      const n = r ? r.d.n : 6;
      trackHead.innerHTML = "";
      trackHead.append(h("div", { class: "h-m" }, "Response path"),
        h("div", { class: "row" }, h("span", { class: "label" }, n + " steps"),
          h("button", { class: "btn icon", title: "Remove a step", disabled: !r || n <= 5 ? true : null, onclick: () => setN(n - 1) }, icon("minus")),
          h("button", { class: "btn icon", title: "Add a step", disabled: !r || n >= 10 ? true : null, onclick: () => setN(n + 1) }, icon("plus"))));
      grid.innerHTML = ""; spotLists = [];
      const cols = Math.ceil((n + 2) / 2);
      grid.style.gridTemplateColumns = `repeat(${cols}, minmax(140px, 1fr))`;
      const seq = [];
      seq.push(h("div", { class: "flag start" }, icon("flag"), "START"));
      for (let j = 0; j < n; j++) { const lst = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } }); spotLists.push(lst); seq.push(h("div", { class: "spot", "data-drop": "spot:" + j }, h("span", { class: "no" }, "STEP " + (j + 1)), lst)); }
      seq.push(h("div", { class: "flag finish" }, h("span", null, "FINISH")));
      seq.forEach((el, k) => {
        el.style.position = "relative"; el.style.zIndex = 1;
        if (k < cols) { el.style.gridRow = 1; el.style.gridColumn = k + 1; }
        else { el.style.gridRow = 2; el.style.gridColumn = cols - (k - cols); }
        grid.append(el);
      });
      requestAnimationFrame(() => {
        const pts = seq.map(el => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2]);
        const d = "M" + pts.map(p => p.join(",")).join(" L");
        road.setAttribute("viewBox", `0 0 ${grid.offsetWidth} ${grid.offsetHeight}`);
        road.style.width = grid.offsetWidth + "px"; road.style.height = grid.offsetHeight + "px";
        road.innerHTML = ""; road.append(s("path", { d }), s("path", { d, class: "dash" }));
      });
      grid._n = n;
    }
    function setN(n) {
      const r = currentRound(); if (!r) return;
      Store.list(x => x.k === "step" && x.d.round === r.id && x.d.slot != null && x.d.slot >= n).forEach(x => Store.patch(x.id, { slot: null }));
      Store.patch(r.id, { n });
    }
    function drawSteps() {
      const r = currentRound();
      const steps = r ? Store.list(x => x.k === "step" && x.d.round === r.id) : [];
      const n = r ? r.d.n : 6;
      const trayItems = steps.filter(x => x.d.slot == null || x.d.slot >= n);
      keyed(trayList, trayItems, x => x.id, stepEl, (el) => el._update());
      tray.querySelector(".tcount").textContent = trayItems.length + " to place";
      spotLists.forEach((lst, j) => {
        keyed(lst, steps.filter(x => x.d.slot === j), x => x.id, stepEl, el => el._update());
        lst.parentNode.classList.toggle("filled", !!lst.children.length);
      });
    }
    function drawChallenge() {
      const r = currentRound();
      challenge.innerHTML = "";
      if (!r) { challenge.append(h("div", { class: "label" }, "Challenge"), h("div", { class: "txt muted" }, "Pull the lever to draw an emergency.")); return; }
      challenge.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "label" }, "Emergency " + (r.d.e + 1)), h("span", { class: "pill red" }, "Live")), h("div", { class: "txt" }, r.d.text));
    }
    function drawRounds() {
      const rounds = Store.list(x => x.k === "round" && x.s === "s2");
      const cur = currentRound();
      roundsEl.innerHTML = "";
      rounds.forEach((r, i) => roundsEl.append(h("button", { class: "btn sm" + (cur && cur.id === r.id ? " dark" : ""), title: r.d.text, onclick: () => Store.setDoc("s2:current", "doc", "s2", { id: r.id }) }, "Round " + (i + 1) + " · E" + (r.d.e + 1))));
    }
    function all() { drawChallenge(); drawRounds(); if (!currentRound() || grid._n !== currentRound().d.n || !spotLists.length) drawTrack(); drawSteps(); }
    buildReels(); drawTrack(); all();
    const ro = new ResizeObserver(() => drawTrack() || drawSteps()); ro.observe(track);
    let lastRound = currentRound() && currentRound().id;
    return {
      update(ch) {
        if (ch.some(r => r.id === "s2:emergencies") && !spinning) buildReels();
        const cr = currentRound(); const cid = cr && cr.id;
        if (cid !== lastRound) { lastRound = cid; if (!spinning) buildReels(); drawTrack(); }
        else if (ch.some(r => r.k === "round")) drawTrack();
        all();
      },
      destroy: () => ro.disconnect()
    };
  }

  /* ================= session 3 · editorial backbone ================= */
  function S3(host) {
    const fr = frame(host, "Editorial backbone", [h("span", { class: "muted", style: { fontSize: "13px" } }, "Rocks · Waves · Winds across 13 months")]);
    const tl = h("div", { class: "tl" });
    fr.body.append(tl);
    let cells = {};
    function build() {
      tl.innerHTML = ""; cells = {};
      const M = I.months();
      const g = h("div", { class: "tl-grid", style: { gridTemplateColumns: `200px 210px repeat(13, 150px)` } });
      g.append(h("div", { class: "tl-h" }), h("div", { class: "tl-h" }, "To place"));
      M.forEach(m => g.append(h("div", { class: "tl-h" }, m.n, h("small", null, m.label))));
      I.LAYERS.forEach(L => {
        const cnt = h("span", { class: "pill counter" });
        g.append(h("div", { class: "tl-rowh" }, h("div", { class: "h-m", style: { color: `var(--${L.color})` } }, I.layerIcon(L.id, "lg"), h("span", { style: { color: "var(--ink)" } }, L.label)), h("div", { class: "muted", style: { fontSize: "12.5px" } }, L.sub), cnt));
        const mk = (key, isTray) => {
          const list = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } });
          const cell = h("div", { class: "tl-cell" + (isTray ? " tray" : ""), "data-drop": L.id + "|" + key }, list);
          if (isTray) cell.append(h("button", { class: "mini-add", onclick: () => { const id = uid("c"); Store.put({ id, k: "card", s: "s3", d: { layer: L.id, month: null, text: "" }, a: "" }); setTimeout(() => { const el = list._map && list._map.get(id); el && el._edit(); }, 60); } }, "+ Add"));
          cells[L.id + "|" + key] = list; g.append(cell);
        };
        mk("tray", true);
        M.forEach(m => mk(m.i));
        cells[L.id + "|cnt"] = cnt;
      });
      tl.append(g);
    }
    function cardFor(r) {
      const el = makeCard(r.id, { colors: false, ph: "Item…" });
      dragTransfer(el, { drop: t => { const [layer, key] = t.dataset.drop.split("|"); Store.patch(r.id, { layer, month: key === "tray" ? null : +key }); }, click: () => el._edit() });
      return el;
    }
    function fill() {
      const all = Store.list(r => r.k === "card" && r.s === "s3");
      I.LAYERS.forEach(L => {
        const mine = all.filter(r => (r.d.layer || "rock") === L.id);
        cells[L.id + "|cnt"].textContent = mine.length + " items";
        keyed(cells[L.id + "|tray"], mine.filter(r => r.d.month == null), r => r.id, cardFor, (el, r) => { el._update(r); el.dataset.c = { rock: "purple", wave: "blue", wind: "green" }[L.id]; });
        for (let i = 0; i < 13; i++) keyed(cells[L.id + "|" + i], mine.filter(r => r.d.month === i), r => r.id, cardFor, (el, r) => { el._update(r); el.dataset.c = { rock: "purple", wave: "blue", wind: "green" }[L.id]; });
      });
    }
    build(); fill();
    let start = setting("start");
    return { update(ch) { if (setting("start") !== start) { start = setting("start"); build(); } fill(); } };
  }

  /* ================= session 4 ================= */
  function S4(host) {
    const TABS = [{ id: "mood", label: "Moodboard" }, { id: "audit", label: "Toolkit audit" }, { id: "uses", label: "Uses of visuals" }];
    let tab = TABS.some(x => x.id === live().tab) && live().session === "s4" ? live().tab : "mood";
    const t = tabs(TABS, tab, id => { tab = id; if (live().session === "s4") setLive({ tab }); draw(); });
    const fr = frame(host, "Visual positioning, identity and tone", [t]);
    let sub = null;
    function draw() {
      if (sub && sub.destroy) sub.destroy();
      fr.body.innerHTML = "";
      if (tab === "mood") sub = Presentation(fr.body, { urlKey: "slidesSession4", fileKey: "s4deck", kind: "slides", title: "Visual trends" });
      else if (tab === "audit") sub = Audit(fr.body);
      else sub = Canvas(fr.body, { s: "s4b", filter: r => r.k === "card" && r.s === "s4b", links: true, color: () => "white", ph: "Add an idea…" });
    }
    draw();
    return { update: ch => sub && sub.update && sub.update(ch), destroy: () => sub && sub.destroy && sub.destroy() };
  }

  function auditData() {
    const votes = Store.list(r => r.k === "vote" && r.s === "s4");
    return I.assets().map((a, i) => {
      const vs = votes.filter(v => v.d.asset === a.id && v.d.v);
      const c = {}; I.AUDIT_COLS.forEach(col => c[col.id] = vs.filter(v => v.d.v === col.id).length);
      const n = vs.length;
      const best = I.AUDIT_COLS.slice().sort((x, y) => c[y.id] - c[x.id])[0];
      const share = n ? c[best.id] / n : 0;
      const verdict = n < 2 ? null : (share >= .6 ? best : "contested");
      return { a, i, c, n, best, share, verdict };
    });
  }
  function Audit(body) {
    const root = h("div", { class: "audit" });
    const pdf = h("div", { class: "audit-pdf" });
    const side = h("div", { class: "panel audit-side" });
    root.append(pdf, side); body.append(root);
    const pres = Presentation(pdf, { urlKey: "auditUrl", fileKey: "s4audit", kind: "pdf", title: "IPOS branding toolkit" });
    let order = "agenda";
    const sortTabs = tabs([{ id: "agenda", label: "Toolkit order" }, { id: "contested", label: "Most debated" }, { id: "verdict", label: "By verdict" }], order, id => { order = id; fill(); });
    const list = h("div", { class: "alist" });
    const count = h("span", { class: "label counter" });
    side.append(
      h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "h-m" }, "Keep or change?"), h("div", { class: "row" }, count, h("button", { class: "btn sm ghost", onclick: editAssets }, icon("edit"), "List"))),
      h("div", { class: "row", style: { justifyContent: "space-between" } }, h("div", { class: "row" }, I.AUDIT_COLS.map(c => h("span", { class: "pill " + c.color }, c.label))), sortTabs),
      list);
    function fill() {
      const D = auditData();
      const focus = (Store.get("s4:focus") || { d: {} }).d.id;
      const voters = new Set(Store.list(r => r.k === "vote" && r.s === "s4").map(r => r.p)).size;
      count.textContent = voters + (voters === 1 ? " voter" : " voters");
      let items = D.slice();
      if (order === "contested") items.sort((x, y) => (x.n < 2) - (y.n < 2) || x.share - y.share);
      if (order === "verdict") items.sort((x, y) => I.AUDIT_COLS.indexOf(x.best) - I.AUDIT_COLS.indexOf(y.best) || y.share - x.share);
      keyed(list, items, x => x.a.id, x => {
        const el = h("div", { class: "arow" });
        el.append(h("button", { class: "apage", title: "Show this page" }), h("div", { class: "aname" }), h("div", { class: "abar" }, I.AUDIT_COLS.map(c => h("i", { class: "c-" + c.id }))), h("span", { class: "averdict" }),
          h("button", { class: "btn sm afocus", title: "Show on screen and on phones" }, icon("phone")));
        el.querySelector(".apage").addEventListener("click", () => { const a = I.assets().find(y => y.id === x.a.id); if (a && a.page) pres.goto(a.page); });
        el.querySelector(".aname").addEventListener("click", () => { const a = I.assets().find(y => y.id === x.a.id); if (a && a.page) pres.goto(a.page); });
        el.querySelector(".afocus").addEventListener("click", () => { const a = I.assets().find(y => y.id === x.a.id); Store.setDoc("s4:focus", "doc", "s4", { id: x.a.id }); if (a && a.page) pres.goto(a.page); });
        return el;
      }, (el, x) => {
        el.querySelector(".apage").textContent = x.a.page ? "p. " + x.a.page : "—";
        el.querySelector(".aname").textContent = x.a.name;
        I.AUDIT_COLS.forEach(c => { const i = el.querySelector(".c-" + c.id); i.style.flexGrow = x.c[c.id]; i.title = c.label + ": " + x.c[c.id]; i.style.display = x.c[c.id] ? "" : "none"; });
        el.querySelector(".abar").classList.toggle("novote", !x.n);
        const v = el.querySelector(".averdict");
        v.className = "averdict" + (x.verdict === "contested" ? " contested" : x.verdict ? " v-" + x.verdict.id : "");
        v.textContent = !x.n ? "" : x.verdict === "contested" ? "Debate · " + x.n : x.verdict ? x.verdict.label + " · " + Math.round(x.share * 100) + "%" : x.n + " vote";
        el.classList.toggle("focus", focus === x.a.id);
      });
    }
    function editAssets() {
      const ta = h("textarea", { class: "textarea", style: { minHeight: "360px", fontFamily: "ui-monospace,monospace", fontSize: "13px" } });
      ta.value = I.assets().map(a => (a.page || "") + " | " + a.name).join("\n");
      drawer("Toolkit items", [h("div", { class: "muted", style: { fontSize: "13px" } }, "One item per line: page | name"), ta,
        h("div", { class: "row" }, h("button", { class: "btn dark", onclick: () => {
          const old = I.assets();
          const list = ta.value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(\d*)\s*\|\s*(.+)$/); const page = m && m[1] ? +m[1] : null, name = m ? m[2].trim() : l; return Object.assign({}, old.find(o => o.name === name) || { id: uid("t") }, { name, page }); });
          Store.setDoc("s4:assets", "doc", "s4", { list }); closeOverlays();
        } }, "Save"), h("button", { class: "btn ghost", onclick: () => { ta.value = I.DEFAULT_ASSETS.map(a => a.page + " | " + a.name).join("\n"); } }, "Restore defaults"))]);
    }
    fill();
    return { update: ch => { fill(); pres.update(ch); }, destroy: () => { } };
  }

  /* ================= break 2 · chorus ================= */
  const VOICES = [
    { id: "ms1", name: "Mezzo-soprano I", count: 1, color: "#F2A65A", hz: 440.00, enter: 4, pat: [["Ocean", 0, 2], ["IPOS", 2, 2], ["Now", 4, 3], ["Ocean", 8, 2], ["IPOS", 10, 2], ["Now", 12, 4]] },
    { id: "ms2", name: "Mezzo-soprano II", count: 1, color: "#F6C27F", hz: 369.99, enter: 3, pat: [["Ocean", 2, 2], ["IPOS", 4, 2], ["Now", 6, 2], ["Ocean", 10, 2], ["IPOS", 12, 2], ["Now", 14, 2]] },
    { id: "alt", name: "Contralto", count: 1, color: "#E8D9A0", hz: 293.66, enter: 2, pat: [["Now", 3, 1], ["Now", 7, 1], ["Now", 11, 1], ["Now", 15, 1]] },
    { id: "bar", name: "Mezzo-baritone · Countertenor", count: 3, color: "#9CC0E3", hz: 220.00, enter: 1, pat: [["I · POS", 0, 2], ["I · POS", 4, 2], ["I · POS", 8, 2], ["I · POS", 12, 2]] },
    { id: "bas", name: "Bass", count: 1, color: "#6F92C9", hz: 146.83, enter: 0, pat: [["Oceaaan", 0, 8], ["Oceaaan", 8, 8]] }
  ];
  const LOOPS = 7, BEATS = 16, COUNT_IN = 4;
  function Chorus(host) {
    const fr = frame(host, "Chorus · Ocean, IPOS, Now", []);
    const root = h("div", { class: "chorus" });
    let bpm = 66, playing = false, t0 = 0, pausedAt = -COUNT_IN, rafId = 0, click = true, guide = false, ac = null, lastBeat = -99, loopShown = -1;
    const big = h("div", { class: "ch-big" }, "Ready");
    const status = h("div", { class: "muted" });
    const prog = h("div", { style: { height: "4px", background: "#DCDCDC", borderRadius: "4px", flex: "1", minWidth: "120px", overflow: "hidden" } }, h("div", { style: { height: "100%", width: "0%", background: "#0B0B0B", transition: "width .2s linear" } }));
    const playBtn = h("button", { class: "btn dark", onclick: () => toggle() });
    const tempo = h("input", { type: "range", class: "range", min: 48, max: 96, value: bpm });
    const tempoLbl = h("span", { class: "label counter" }, bpm + " bpm");
    tempo.addEventListener("input", () => { const b = beatNow(); bpm = +tempo.value; tempoLbl.textContent = bpm + " bpm"; if (playing) t0 = performance.now() - (b + COUNT_IN) * 60000 / bpm; });
    const clickBtn = h("button", { class: "btn sm", onclick: () => { click = !click; drawBtns(); } });
    const guideBtn = h("button", { class: "btn sm", onclick: () => { guide = !guide; drawBtns(); } });
    function drawBtns() {
      clickBtn.innerHTML = ""; clickBtn.append(icon(click ? "sound" : "mute"), "Click");
      guideBtn.innerHTML = ""; guideBtn.append(icon("note"), guide ? "Guide tones on" : "Guide tones off");
      playBtn.innerHTML = ""; playBtn.append(icon(playing ? "pause" : "play"), playing ? "Pause" : "Conduct");
    }
    const bar = h("div", { class: "ch-bar" }, big, h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: "1", minWidth: "200px" } }, status, prog),
      h("button", { class: "btn icon", title: "Restart", onclick: () => { playing = false; pausedAt = -COUNT_IN; lastBeat = -99; loopShown = -1; frameDraw(); drawBtns(); } }, icon("reset")), playBtn,
      h("div", { class: "row" }, tempo, tempoLbl), clickBtn, guideBtn);
    const score = h("div", { class: "ch-score" });
    const head = s("svg", { viewBox: "0 0 1 1" });
    root.append(bar, score); fr.body.append(root);
    const lanes = VOICES.map(v => {
      const tr = h("div", { class: "lane-track" }, h("div", { class: "beats", style: { gridTemplateColumns: `repeat(${BEATS},1fr)` } }, Array.from({ length: BEATS }, () => h("i"))));
      const ph = h("div", { class: "playhead", style: { left: "0%" } });
      tr.append(ph);
      const hd = h("div", { class: "lane-h", style: { background: v.color }, title: "Tap for the starting note", onclick: () => tone(v.hz, 1.2, .18) }, h("b", null, v.name), h("small", null, (v.count > 1 ? v.count + " voices" : "1 voice") + " · enters loop " + (v.enter + 1)));
      const el = h("div", { class: "lane" }, hd, tr);
      score.append(el);
      return { v, el, tr, ph, notes: [] };
    });
    function pattern(v, loop) { return loop >= LOOPS - 1 ? [["NOW", 0, 12]] : v.pat; }
    function drawNotes(loop) {
      lanes.forEach(L => {
        L.notes.forEach(n => n.el.remove());
        L.notes = pattern(L.v, Math.max(0, loop)).map(([w, st, d]) => { const el = h("div", { class: "note", style: { left: `calc(${st / BEATS * 100}% + 3px)`, width: `calc(${d / BEATS * 100}% - 6px)`, background: L.v.color } }, w); L.tr.append(el); return { el, st, d }; });
      });
    }
    function beatNow() { return playing ? (performance.now() - t0) * bpm / 60000 - COUNT_IN : pausedAt; }
    function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === "suspended") ac.resume(); return ac; }
    function tone(hz, dur, vol, type) {
      const a = audio(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || "sine"; o.frequency.value = hz;
      const t = a.currentTime;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .05);
    }
    function toggle() {
      audio();
      if (playing) { pausedAt = beatNow(); playing = false; cancelAnimationFrame(rafId); }
      else { if (pausedAt >= LOOPS * BEATS) pausedAt = -COUNT_IN; t0 = performance.now() - (pausedAt + COUNT_IN) * 60000 / bpm; playing = true; loop(); }
      drawBtns();
    }
    function loop() { frameDraw(); if (playing) rafId = requestAnimationFrame(loop); }
    function frameDraw() {
      const b = beatNow();
      const total = LOOPS * BEATS;
      if (b >= total) { playing = false; pausedAt = total; drawBtns(); }
      const lp = Math.floor(Math.max(0, b) / BEATS);
      const inBeat = ((Math.max(0, b) % BEATS) + BEATS) % BEATS;
      if (lp !== loopShown) { loopShown = lp; drawNotes(lp); }
      const ib = Math.floor(b);
      if (playing && ib !== lastBeat) {
        lastBeat = ib;
        if (click) tone(ib < 0 ? 1320 : (((ib % 4) + 4) % 4 === 0 ? 1100 : 820), .06, ib < 0 ? .12 : .07, "triangle");
        if (guide && ib >= 0 && ib < total) lanes.forEach(L => { if (lp >= L.v.enter || lp >= LOOPS - 1) pattern(L.v, lp).forEach(([, st, d]) => { if (st === ib % BEATS) tone(L.v.hz, Math.min(2.5, d * 60 / bpm), .05); }); });
      }
      lanes.forEach(L => {
        const active = lp >= L.v.enter || lp >= LOOPS - 1;
        L.el.classList.toggle("rest", !active && b >= 0);
        L.el.classList.toggle("cue", !active && lp === L.v.enter - 1 && inBeat >= BEATS - 4);
        L.ph.style.left = (b < 0 ? 0 : inBeat / BEATS * 100) + "%";
        L.notes.forEach(n => n.el.classList.toggle("on", active && b >= 0 && b < total && inBeat >= n.st && inBeat < n.st + n.d));
      });
      if (b < 0) { big.textContent = playing ? String(Math.ceil(-b)) : "Ready"; status.textContent = "Count-in · " + bpm + " bpm"; }
      else if (b >= total) { big.textContent = "Bravi"; status.textContent = "End of the piece"; }
      else {
        const left = Math.max(0, (total - b) * 60 / bpm);
        big.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
        const nxt = VOICES.filter(v => v.enter === lp + 1).map(v => v.name);
        status.textContent = (lp >= LOOPS - 1 ? "Finale · everyone, NOW" : `Loop ${lp + 1} of ${LOOPS}`) + (nxt.length && lp < LOOPS - 1 ? ` · next: ${nxt.join(", ")}` : (lp === LOOPS - 2 ? " · next: finale" : ""));
      }
      prog.firstChild.style.width = Math.max(0, Math.min(100, b / total * 100)) + "%";
    }
    drawBtns(); drawNotes(0); frameDraw();
    return { destroy: () => { playing = false; cancelAnimationFrame(rafId); if (ac) ac.close(); } };
  }

  /* ================= session 5 · objectives & KPIs ================= */
  function S5(host) {
    const fr = frame(host, "IPOS Now: objectives and KPIs", [h("span", { class: "muted", style: { fontSize: "13px" } }, "Output → outcome → impact · max two KPIs per objective")]);
    const root = h("div", { class: "s5" });
    const pool = h("div", { class: "pool panel" });
    const table = h("div", { class: "otable" });
    root.append(pool, table); fr.body.append(root);

    // seed three objective rows once
    if (!Object.values(Store.recs).some(r => r.k === "obj")) for (let i = 0; i < 3; i++) Store.put({ id: "obj" + (i + 1), k: "obj", s: "s5", d: { title: "", months: [] }, a: "", c: Date.now() + i });

    // pool
    const fIn = h("input", { class: "input", placeholder: "From…" }), tIn = h("input", { class: "input", placeholder: "To…" }), kIn = h("input", { class: "input", placeholder: "KPI idea…" });
    const addS = () => { if (!fIn.value.trim() && !tIn.value.trim()) return; Store.put({ id: uid("fs"), k: "stmt", s: "s5", d: { from: fIn.value.trim(), to: tIn.value.trim() }, a: "" }); fIn.value = tIn.value = ""; fIn.focus(); };
    [fIn, tIn].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") addS(); }));
    kIn.addEventListener("keydown", e => { if (e.key === "Enter" && kIn.value.trim()) { Store.put({ id: uid("k"), k: "kpi", s: "s5", d: { text: kIn.value.trim(), obj: null, level: "outcome", source: "", owner: "" }, a: "" }); kIn.value = ""; } });
    const plist = h("div", { class: "pool-list" });
    const pcount = h("span", { class: "label counter" });
    pool.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "label" }, "Statements & KPI ideas"), pcount), plist,
      h("div", { style: { display: "grid", gap: "6px" } }, h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } }, fIn, tIn), kIn));

    function stmtEl(r) {
      const el = h("div", { class: "card stmt", "data-id": r.id });
      const f = h("div"), t = h("div");
      editable(f, () => (Store.get(r.id) || { d: {} }).d.from, v => Store.patch(r.id, { from: v }), "…");
      editable(t, () => (Store.get(r.id) || { d: {} }).d.to, v => Store.patch(r.id, { to: v }), "…");
      el.append(h("div", { class: "ft" }, h("span", null, "From"), f, h("span", null, "To"), t), h("div", { class: "meta" }, h("span", { class: "au" }), h("div", { class: "tools" }, h("button", { title: "Remove", onclick: e => { e.stopPropagation(); deleteWithUndo(r.id, "Statement"); } }, icon("x")))));
      el._update = x => { f._sync(); t._sync(); el.querySelector(".au").textContent = (x.a || "") + (x.d.used ? " · used" : ""); el.style.opacity = x.d.used ? ".55" : ""; el.dataset.c = "yellow"; };
      dragTransfer(el, {
        accept: d => d.dataset.drop.startsWith("obj:"),
        drop: tg => { const oid = tg.dataset.drop.split(":")[1]; const x = Store.get(r.id); Store.patch(oid, { title: `From ${x.d.from || "…"} to ${x.d.to || "…"}` }); Store.patch(r.id, { used: oid }); },
        click: ev => { (ev.target.closest(".txt") || f)._edit(); }
      });
      return el;
    }
    function kpiPoolEl(r) {
      const el = makeCard(r.id, { colors: false, ph: "KPI…" });
      el.insertBefore(h("div", { class: "kpi-tag" }, "KPI idea"), el.firstChild);
      dragTransfer(el, {
        accept: d => d.dataset.drop.startsWith("kpi:"),
        drop: tg => { const oid = tg.dataset.drop.split(":")[1]; const n = Store.list(x => x.k === "kpi" && x.d.obj === oid).length; if (n >= 2) { toast("Two KPIs per objective at most"); return; } Store.patch(r.id, { obj: oid }); },
        click: () => el._edit()
      });
      const up = el._update; el._update = x => { up(x); el.dataset.c = "blue"; };
      return el;
    }
    function fillPool() {
      const items = Store.list(r => (r.k === "stmt" && r.s === "s5") || (r.k === "kpi" && r.s === "s5" && !r.d.obj));
      pcount.textContent = items.length;
      keyed(plist, items, r => r.id, r => r.k === "stmt" ? stmtEl(r) : kpiPoolEl(r), (el, r) => el._update(r));
    }

    // table
    const headRow = h("div", { class: "orow ohead" });
    const rowsEl = h("div");
    const addRow = h("button", { class: "btn sm", onclick: () => Store.put({ id: uid("obj"), k: "obj", s: "s5", d: { title: "", months: [] }, a: "" }) }, icon("plus"), "Add objective");
    table.append(headRow, rowsEl, addRow);
    function drawHead() { headRow.innerHTML = ""; const M = I.months(); headRow.append(h("div", null, "Objective · From… to…"), h("div", null, "Months · " + M[0].label + " – " + M[12].label), h("div", null, "KPIs · source and owner required"), h("div")); }

    let paint = null;
    document.addEventListener("pointerup", endPaint);
    function endPaint() { if (paint) { Store.patch(paint.id, { months: [...paint.set].sort((a, b) => a - b) }); paint = null; } }

    function kpiEl(r) {
      const el = h("div", { class: "kpi", "data-id": r.id });
      const t = h("div", { class: "kt" });
      editable(t, () => (Store.get(r.id) || { d: {} }).d.text, v => Store.patch(r.id, { text: v }), "KPI…");
      t.addEventListener("click", () => t._edit());
      const lad = h("div", { class: "ladder" });
      const src = h("input", { placeholder: "Data source" }), own = h("input", { placeholder: "Owner" });
      const save = I.debounce(() => Store.patch(r.id, { source: src.value.trim(), owner: own.value.trim() }), 400);
      src.addEventListener("input", save); own.addEventListener("input", save);
      const warn = h("div", { class: "warnmsg" }, "Needs a data source and an owner, or it is dropped");
      el.append(h("button", { class: "x", title: "Back to the pool", onclick: () => Store.patch(r.id, { obj: null }) }, icon("x")), lad, t, h("div", { class: "kf" }, src, own), warn);
      el._update = x => {
        t._sync();
        lad.innerHTML = "";
        ["output", "outcome", "impact"].forEach((lv, i) => lad.append(h("button", { class: x.d.level === lv ? "on" : "", onclick: () => Store.patch(r.id, { level: lv }) }, (i ? "→ " : "") + lv[0].toUpperCase() + lv.slice(1))));
        if (document.activeElement !== src) src.value = x.d.source || "";
        if (document.activeElement !== own) own.value = x.d.owner || "";
        const bad = !(x.d.source && x.d.owner);
        el.classList.toggle("warn", bad); warn.style.display = bad ? "" : "none";
      };
      return el;
    }

    function rowEl(r) {
      const el = h("div", { class: "orow" });
      const n = h("div", { class: "obj-n" });
      const title = h("div", { class: "obj-title" });
      editable(title, () => (Store.get(r.id) || { d: {} }).d.title, v => Store.patch(r.id, { title: v }), "From … to …");
      title.classList.add("obj-title");
      title.addEventListener("click", () => title._edit());
      const months = h("div", { class: "months" });
      I.months().forEach(m => {
        const c = h("div", { class: "m", "data-i": m.i, title: m.label }, m.short);
        c.addEventListener("pointerdown", e => { e.preventDefault(); const cur = new Set((Store.get(r.id).d.months) || []); const on = !cur.has(m.i); paint = { id: r.id, on, set: cur }; on ? cur.add(m.i) : cur.delete(m.i); c.classList.toggle("on", on); months.releasePointerCapture && months.releasePointerCapture(e.pointerId); });
        c.addEventListener("pointerenter", () => { if (!paint || paint.id !== r.id) return; paint.on ? paint.set.add(m.i) : paint.set.delete(m.i); c.classList.toggle("on", paint.on); });
        months.append(c);
      });
      const span = h("div", { class: "muted", style: { fontSize: "12px" } });
      const kl = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
      const addK = h("button", { class: "mini-add", onclick: () => Store.put({ id: uid("k"), k: "kpi", s: "s5", d: { text: "", obj: r.id, level: "outcome", source: "", owner: "" }, a: "" }) }, "+ KPI");
      el.append(
        h("div", { class: "ocell", "data-drop": "obj:" + r.id }, n, title),
        h("div", { class: "ocell" }, months, span),
        h("div", { class: "ocell", "data-drop": "kpi:" + r.id }, kl, addK),
        h("button", { class: "row-x", title: "Remove objective", onclick: () => deleteWithUndo(r.id, "Objective") }, icon("x")));
      el._update = (x, i) => {
        n.textContent = "Objective " + (i + 1);
        title._sync();
        const set = new Set(paint && paint.id === r.id ? [...paint.set] : (x.d.months || []));
        [...months.children].forEach(c => c.classList.toggle("on", set.has(+c.dataset.i)));
        const ms = [...set].sort((a, b) => a - b); const M = I.months();
        span.textContent = ms.length ? `${ms.length} month${ms.length > 1 ? "s" : ""} · ${M[ms[0]].label} → ${M[ms[ms.length - 1]].label}` : "Click or drag across months";
        const ks = Store.list(k => k.k === "kpi" && k.d.obj === r.id);
        keyed(kl, ks, k => k.id, kpiEl, (e2, k) => e2._update(k));
        addK.style.display = ks.length >= 2 ? "none" : "";
      };
      return el;
    }
    function fillRows() {
      const rows = Store.list(r => r.k === "obj" && r.s === "s5");
      let i = 0;
      keyed(rowsEl, rows, r => r.id, rowEl, (el, r) => el._update(r, i++));
    }
    drawHead(); fillPool(); fillRows();
    let start = setting("start");
    return {
      update() { if (setting("start") !== start) { start = setting("start"); drawHead(); rowsEl.innerHTML = ""; rowsEl._map = null; } fillPool(); fillRows(); },
      destroy: () => document.removeEventListener("pointerup", endPaint)
    };
  }

  /* ================= session 6 ================= */
  function decisionPanel(cls) {
    const p = h("div", { class: "dlog " + (cls || "panel") });
    const list = h("div", { class: "dlog-list" });
    const inp = h("input", { class: "input", placeholder: "Log a decision…" });
    inp.addEventListener("keydown", e => { if (e.key === "Enter" && inp.value.trim()) { Store.put({ id: uid("d"), k: "decision", s: "s6", d: { text: inp.value.trim() } }); inp.value = ""; } });
    const cnt = h("span", { class: "label counter" });
    p.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "h-m" }, "Decision log"), cnt), list, inp);
    function fill() {
      const items = Store.list(r => r.k === "decision");
      cnt.textContent = items.length;
      keyed(list, items, r => r.id, r => {
        const t = h("div");
        editable(t, () => (Store.get(r.id) || { d: {} }).d.text, v => Store.patch(r.id, { text: v }), "Decision…");
        t.addEventListener("click", () => t._edit());
        const el = h("div", { class: "ditem" }, h("span", { class: "s" }, (I.sessionById(r.s) || { label: "" }).n ? "S" + I.sessionById(r.s).n : (I.sessionById(r.s) || { label: "—" }).label.toUpperCase()), t, h("button", { class: "x", onclick: () => deleteWithUndo(r.id, "Decision") }, icon("x")));
        el._update = () => t._sync();
        return el;
      }, el => el._update());
    }
    fill();
    return { el: p, update: fill };
  }

  function S6(host) {
    const fr = frame(host, "Calendar, outputs, content", []);
    const root = h("div", { class: "s6" });
    const left = h("div", { style: { position: "relative", display: "flex", flexDirection: "column", gap: "14px", minHeight: "0" } });
    const dp = decisionPanel();
    root.append(left, dp.el); fr.body.append(root);
    function drawLeft() {
      left.innerHTML = "";
      const url = setting("drive");
      if (!url) {
        const inp = h("input", { class: "input", placeholder: "Paste the shared Drive link", style: { maxWidth: "420px", background: "#222", color: "#fff", borderColor: "#333" } });
        inp.addEventListener("change", () => setSetting("drive", inp.value.trim()));
        left.append(h("div", { class: "drive-tile", style: { flex: "1" } }, h("div", { class: "label", style: { color: "#999" } }, "Shared workspace"), h("div", null, h("div", { class: "h-xl", style: { marginBottom: "18px" } }, "Google Drive"), inp)));
        return;
      }
      const emb = I.embedDrive(url);
      left.append(h("a", { class: "drive-tile", href: url, target: "_blank", rel: "noopener", style: { flex: emb ? "0 0 auto" : "1", gap: "18px" } },
        h("div", { class: "row", style: { justifyContent: "space-between" } }, h("div", { class: "label", style: { color: "#999" } }, "Shared workspace"), icon("drive")),
        h("div", { class: emb ? "h-l" : "h-xl" }, "Open the shared Drive ↗")));
      if (emb) left.append(h("div", { class: "panel", style: { flex: "1", overflow: "hidden", position: "relative" } }, h("iframe", { src: emb, style: { position: "absolute", inset: "0", width: "100%", height: "100%", border: "0" } })));
    }
    drawLeft();
    let d = setting("drive");
    return { update() { if (setting("drive") !== d) { d = setting("drive"); drawLeft(); } dp.update(); } };
  }

  /* ================= close · dashboard ================= */
  function snapshot() {
    const L = r => Store.list(r);
    const rounds = L(r => r.k === "round" && r.s === "s2");
    return {
      ice: I.ICE.map(q => ({ q, cards: L(r => r.k === "card" && r.s === "ice" && r.d.q === q.id && r.d.text) })),
      people: L(r => r.k === "person"),
      rounds: rounds.map((r, i) => { const steps = L(x => x.k === "step" && x.d.round === r.id && x.d.text); return { i, r, path: steps.filter(x => x.d.slot != null && x.d.slot < r.d.n).sort((a, b) => a.d.slot - b.d.slot), loose: steps.filter(x => x.d.slot == null || x.d.slot >= r.d.n) }; }),
      layers: I.LAYERS.map(Ly => ({ Ly, cards: L(r => r.k === "card" && r.s === "s3" && (r.d.layer || "rock") === Ly.id && r.d.text).sort((a, b) => (a.d.month == null ? 99 : a.d.month) - (b.d.month == null ? 99 : b.d.month)) })),
      ideas: L(r => r.k === "card" && r.s === "s4b" && r.d.text),
      links: L(r => r.k === "link" && r.s === "s4b"),
      objs: L(r => r.k === "obj" && r.s === "s5").map(o => ({ o, kpis: L(k => k.k === "kpi" && k.d.obj === o.id) })),
      stmts: L(r => r.k === "stmt" && r.s === "s5"),
      decisions: L(r => r.k === "decision"),
      todos: L(r => r.k === "todo")
    };
  }

  function Close(host) {
    const dash = h("div", { class: "dash" });
    const nav = h("div", { class: "dash-nav" },
      h("button", { class: "btn icon", onclick: () => dash.scrollBy({ left: -460 }) }, icon("left")),
      h("button", { class: "btn icon", onclick: () => dash.scrollBy({ left: 460 }) }, icon("right")),
      h("button", { class: "btn", onclick: () => { const t = dash.querySelector(".todo"); t && dash.scrollTo({ left: t.offsetLeft - 10 }); } }, "Priorities"),
      h("button", { class: "btn dark", onclick: printLog }, icon("print"), "Print day log"));
    const fr = frame(host, "The day in review", [nav]);
    fr.body.append(dash);
    dash.addEventListener("wheel", e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const body = e.target.closest(".dp-body");
      if (body && body.scrollHeight > body.clientHeight + 2) return;
      dash.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
    const M = I.months();

    const panel = (n, title, body, cls) => h("div", { class: "dpanel panel " + (cls || "") }, h("div", { class: "dp-n" }, n), h("div", { class: "h-m" }, title), h("div", { class: "dp-body" }, body));
    const chips = (cards, color) => cards.length ? h("div", { class: "chip-list" }, cards.map(c => h("div", { class: "chip", "data-c": c.d.color || color || "white" }, c.d.text))) : h("div", { class: "muted" }, "—");

    let todoPanel = null;
    function build() {
      const scroll = dash.scrollLeft;
      const S = snapshot();
      dash.innerHTML = "";
      dash.append(panel("ICEBREAKER", "Who we are, what we hope", [S.people.length ? h("div", { class: "chip-list" }, S.people.map(p => h("div", { class: "chip" }, h("b", null, p.d.name || "Guest"), p.d.role ? " · " + p.d.role : ""))) : null, S.ice.map(x => [h("div", { class: "label", style: { marginTop: "6px" } }, x.q.title), chips(x.cards, x.q.color)])]));
      dash.append(panel("SESSION 1", "IPOS Now, connecting the dots", s1Summary(), "wide"));
      dash.append(panel("SESSION 2", "Emergency protocols", S.rounds.length ? S.rounds.map(x => [h("div", { class: "label", style: { marginTop: "6px" } }, "Round " + (x.i + 1) + " · Emergency " + (x.r.d.e + 1)), h("div", { style: { fontSize: "13px", color: "var(--ink2)" } }, x.r.d.text), x.path.length ? h("div", { class: "mini-path" }, x.path.map(p => h("div", null, p.d.text))) : h("div", { class: "muted" }, "No path yet")]) : h("div", { class: "muted" }, "—")));
      dash.append(panel("SESSION 3", "Editorial backbone", S.layers.map(x => [h("div", { class: "label", style: { marginTop: "6px" } }, x.Ly.label + " · " + x.Ly.sub), x.cards.length ? h("div", { class: "chip-list" }, x.cards.map(c => h("div", { class: "chip", "data-c": { rock: "purple", wave: "blue", wind: "green" }[x.Ly.id] }, h("b", null, c.d.month != null ? M[c.d.month].label + " · " : ""), c.d.text))) : h("div", { class: "muted" }, "—")])));
      dash.append(panel("SESSION 4", "Identity and visuals", [s4Summary(), h("div", { class: "label", style: { marginTop: "8px" } }, "Uses of visuals"), chips(S.ideas)]));
      dash.append(panel("SESSION 5", "Objectives and KPIs", S.objs.map((x, i) => {
        const ms = (x.o.d.months || []).slice().sort((a, b) => a - b);
        return h("div", { style: { background: "var(--bg)", borderRadius: "12px", padding: "10px", display: "flex", flexDirection: "column", gap: "6px" } },
          h("div", { class: "label" }, "Objective " + (i + 1) + (ms.length ? " · " + M[ms[0]].label + " → " + M[ms[ms.length - 1]].label : "")),
          h("div", { style: { fontWeight: 600 } }, x.o.d.title || "—"),
          x.kpis.map(k => h("div", { style: { fontSize: "13px" } }, h("b", null, (k.d.level || "") + " · "), k.d.text || "", h("span", { class: "muted" }, " — " + (k.d.source || "no source") + ", " + (k.d.owner || "no owner")))));
      })));
      const dp = decisionPanel("dpanel panel"); dash.append(dp.el);
      // priorities
      todoPanel = h("div", { class: "dpanel panel todo" });
      const tlist = h("div", { class: "dp-body" });
      const tin = h("input", { class: "input", placeholder: "Add a pressing action…", style: { background: "#222", borderColor: "#333", color: "#fff" } });
      tin.addEventListener("keydown", e => { if (e.key === "Enter" && tin.value.trim()) { Store.put({ id: uid("t"), k: "todo", s: "close", d: { text: tin.value.trim(), owner: "", due: "", done: false } }); tin.value = ""; } });
      todoPanel.append(h("div", { class: "dp-n" }, "NEXT"), h("div", { class: "h-m" }, "Most pressing things to do"), tlist, tin);
      dash.append(todoPanel);
      todoPanel._list = tlist;
      fillTodos();
      dash.scrollLeft = scroll;
    }
    function fillTodos() {
      keyed(todoPanel._list, Store.list(r => r.k === "todo"), r => r.id, r => {
        const cb = h("input", { type: "checkbox", onchange: () => Store.patch(r.id, { done: cb.checked }) });
        const t = h("div", { class: "tt" });
        editable(t, () => (Store.get(r.id) || { d: {} }).d.text, v => Store.patch(r.id, { text: v }), "Action…");
        t.classList.add("tt"); t.addEventListener("click", () => t._edit());
        const ow = h("input", { placeholder: "Owner" }), du = h("input", { placeholder: "Deadline" });
        const save = I.debounce(() => Store.patch(r.id, { owner: ow.value.trim(), due: du.value.trim() }), 400);
        ow.addEventListener("input", save); du.addEventListener("input", save);
        const el = h("div", { class: "todo-item" }, cb, h("div", null, h("div", { style: { display: "flex", gap: "8px" } }, h("div", { style: { flex: "1" } }, t), h("button", { class: "x", onclick: () => deleteWithUndo(r.id, "Action") }, icon("x"))), h("div", { class: "tm" }, ow, du)));
        el._update = x => { t._sync(); cb.checked = !!x.d.done; el.classList.toggle("done", !!x.d.done); if (document.activeElement !== ow) ow.value = x.d.owner || ""; if (document.activeElement !== du) du.value = x.d.due || ""; };
        return el;
      }, (el, r) => el._update(r));
    }
    build();
    return {
      update(ch) {
        if (dash.contains(document.activeElement) && document.activeElement !== document.body) { if (ch.every(r => r.k === "todo")) fillTodos(); return; }
        if (ch.every(r => r.k === "todo")) fillTodos(); else build();
      }
    };
  }


  /* summaries for the day review and the printed log */
  function s1Summary() {
    const SD = standData(), TD = trustData(), DD = dotsData(), A = I.audiences(), P = I.products();
    const nm = (l, id) => (l.find(x => x.id === id) || { name: "?" }).name;
    const byAud = A.map(a => ({ a, rs: DD.ds.filter(r => r.d.aud === a.id) })).filter(x => x.rs.length);
    const tot = Object.values(SD.models).reduce((x, y) => x + y, 0);
    return [
      h("div", { class: "label" }, "Where we stand"),
      h("div", null, h("b", null, "Today: "), spectrumLabel(SD.mNow), h("br"), h("b", null, "In 13 months: "), spectrumLabel(SD.mAim)),
      tot ? h("div", { class: "muted", style: { fontSize: "13px" } }, I.MODELS.map(m => m.label + " " + Math.round(SD.models[m.id] / tot * 100) + "%").join(" · ")) : null,
      h("div", { class: "label", style: { marginTop: "6px" } }, "Trust"),
      h("div", { style: { fontSize: "13px" } }, I.CRELE.map(c => c.label + " " + (TD.crele[c.id] == null ? "—" : TD.crele[c.id].toFixed(1))).join(" · ")),
      h("div", { class: "chip-list" }, TD.tokens.filter(x => x.n).slice(0, 4).map(x => h("div", { class: "chip" }, x.t.label, h("b", { style: { marginLeft: "6px" } }, x.n)))),
      h("div", { class: "label", style: { marginTop: "6px" } }, "Connecting the dots"),
      byAud.length ? byAud.map(x => h("div", { style: { fontSize: "13px" } }, h("b", null, x.a.name + ": "), x.rs.map(r => nm(P, r.d.prod) + " (" + (I.MODES.find(m => m.id === r.d.mode) || I.MODES[0]).label.toLowerCase() + ")").join(", "))) : h("div", { class: "muted" }, "—")
    ];
  }
  function s4Summary() {
    const D = auditData().filter(x => x.n);
    if (!D.length) return h("div", { class: "muted" }, "—");
    return h("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } }, I.AUDIT_COLS.map(c => { const it = D.filter(x => x.verdict && x.verdict.id === c.id); return it.length ? [h("div", { class: "row", style: { marginTop: "6px" } }, h("span", { class: "pill " + c.color }, c.label)), h("div", { class: "chip-list" }, it.map(x => h("div", { class: "chip" }, x.a.name)))] : null; }),
      D.some(x => x.verdict === "contested") ? [h("div", { class: "row", style: { marginTop: "6px" } }, h("span", { class: "pill" }, "To debate")), h("div", { class: "chip-list" }, D.filter(x => x.verdict === "contested").map(x => h("div", { class: "chip" }, x.a.name)))] : null);
  }
  function s1Print() {
    const e = I.esc, SD = standData(), TD = trustData(), DD = dotsData(), A = I.audiences(), P = I.products();
    const nm = (l, id) => e((l.find(x => x.id === id) || { name: "?" }).name);
    const tot = Object.values(SD.models).reduce((x, y) => x + y, 0);
    let o = `<section class="pb"><h2>Session 1 · IPOS Now, connecting the dots</h2>`;
    o += `<h3>Where we stand</h3><p>Today: <b>${e(spectrumLabel(SD.mNow))}</b> · In 13 months: <b>${e(spectrumLabel(SD.mAim))}</b> <span class="meta">(${SD.rs.length} answers; Harvey, Lewin & Fisher, 2012)</span></p>`;
    if (tot) o += `<p>${I.MODELS.map(m => e(m.label) + " " + Math.round(SD.models[m.id] / tot * 100) + "%").join(" · ")}</p>`;
    o += `<h3>Trust</h3><p>${I.CRELE.map(c => e(c.label) + " " + (TD.crele[c.id] == null ? "—" : TD.crele[c.id].toFixed(1) + "/5")).join(" · ")}</p>`;
    o += `<table><tr><th>Trust-building strategy</th><th>Tokens</th></tr>${TD.tokens.filter(x => x.n).map(x => `<tr><td>${e(x.t.label)}</td><td>${x.n}</td></tr>`).join("")}</table>`;
    o += `<h3>Audiences × products</h3><table><tr><th>Audience</th><th>Product</th><th>Mode</th><th>Tone</th><th>Onboarding move</th></tr>${DD.ds.slice().sort((a, b) => A.findIndex(x => x.id === a.d.aud) - A.findIndex(x => x.id === b.d.aud)).map(r => `<tr><td>${nm(A, r.d.aud)}</td><td>${nm(P, r.d.prod)}</td><td>${e((I.MODES.find(m => m.id === r.d.mode) || I.MODES[0]).label)}</td><td>${e((r.d.tones || []).join(", "))}</td><td>${e(r.d.onboard || "")}</td></tr>`).join("")}</table>`;
    return o + `</section>`;
  }
  function s4PrintTable() {
    const e = I.esc, D = auditData();
    return `<table><tr><th>p.</th><th>Toolkit item</th>${I.AUDIT_COLS.map(c => `<th>${e(c.label)}</th>`).join("")}<th>Outcome</th></tr>${D.map(x => `<tr><td>${x.a.page || ""}</td><td>${e(x.a.name)}</td>${I.AUDIT_COLS.map(c => `<td>${x.c[c.id] || ""}</td>`).join("")}<td>${!x.n ? "—" : x.verdict === "contested" ? "To debate" : x.verdict ? e(x.verdict.label) : "—"}</td></tr>`).join("")}</table>`;
  }

  /* ================= print log ================= */
  function printLog() {
    const S = snapshot(); const M = I.months(); const e = I.esc;
    const list = arr => arr.length ? "<ul>" + arr.map(x => "<li>" + x + "</li>").join("") + "</ul>" : '<p class="meta">—</p>';
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    let html = `<h1>IPOS Now · Co-design workshop</h1><p class="meta">Strategic alignment · Day log · ${e(date)} · Housedada</p>`;
    html += `<section><h2>Icebreaker</h2>${S.people.length ? `<h3>Participants</h3>${list(S.people.map(p => `<b>${e(p.d.name || "Guest")}</b>${p.d.role ? " · " + e(p.d.role) : ""}`))}` : ""}${S.ice.map(x => `<h3>${e(x.q.title)}</h3><p class="meta">${e(x.q.sub)}</p>${list(x.cards.map(c => e(c.d.text) + (c.a ? ` <span class="meta">— ${e(c.a)}</span>` : "")))}`).join("")}</section>`;
    html += s1Print();
    html += `<section class="pb"><h2>Session 2 · Emergency simulation</h2>${S.rounds.map(x => `<h3>Round ${x.i + 1} · Emergency ${x.r.d.e + 1}</h3><p>${e(x.r.d.text)}</p><ol>${x.path.map(p => `<li>${e(p.d.text)}</li>`).join("")}</ol>${x.loose.length ? `<p class="meta">Unplaced: ${x.loose.map(p => e(p.d.text)).join(" · ")}</p>` : ""}`).join("") || '<p class="meta">—</p>'}</section>`;
    html += `<section class="pb"><h2>Session 3 · Editorial backbone</h2>${S.layers.map(x => `<h3>${e(x.Ly.label)} · ${e(x.Ly.sub)}</h3>${list(x.cards.map(c => (c.d.month != null ? `<b>${e(M[c.d.month].label)}</b> · ` : "") + e(c.d.text)))}`).join("")}</section>`;
    const idea = id => { const c = S.ideas.find(x => x.id === id); return c ? e(c.d.text) : "?"; };
    html += `<section class="pb"><h2>Session 4 · Visual positioning, identity and tone</h2><h3>Toolkit audit</h3>${s4PrintTable()}<h3>Uses of visuals</h3>${list(S.ideas.map(c => e(c.d.text)))}${S.links.length ? `<h3>Connections</h3>${list(S.links.map(l => idea(l.d.a) + " → " + idea(l.d.b)))}` : ""}</section>`;
    html += `<section class="pb"><h2>Session 5 · Objectives and KPIs</h2>${S.objs.map((x, i) => { const ms = (x.o.d.months || []).slice().sort((a, b) => a - b); return `<h3>Objective ${i + 1}: ${e(x.o.d.title || "—")}</h3><p class="meta">${ms.length ? "Months: " + ms.map(m => e(M[m].label)).join(", ") : "No months set"}</p><table><tr><th>KPI</th><th>Level</th><th>Data source</th><th>Owner</th></tr>${x.kpis.map(k => `<tr><td>${e(k.d.text)}</td><td>${e(k.d.level || "")}</td><td>${e(k.d.source || "—")}</td><td>${e(k.d.owner || "—")}</td></tr>`).join("")}</table>`; }).join("")}<h3>From… to… statements</h3>${list(S.stmts.map(x => "From " + e(x.d.from) + " to " + e(x.d.to)))}</section>`;
    html += `<section class="pb"><h2>Decision log</h2>${list(S.decisions.map(d => `<span class="meta">${e((I.sessionById(d.s) || { label: "" }).label)}</span> ${e(d.d.text)}`))}<h2 style="margin-top:14pt">Most pressing things to do</h2><table><tr><th></th><th>Action</th><th>Owner</th><th>Deadline</th></tr>${S.todos.map(t => `<tr><td>${t.d.done ? "✓" : "☐"}</td><td>${e(t.d.text)}</td><td>${e(t.d.owner || "")}</td><td>${e(t.d.due || "")}</td></tr>`).join("")}</table></section>`;
    html += `<div class="foot"><span>IPOS Now · Co-design workshop</span><span>HOUSEDADA</span></div>`;
    document.getElementById("print").innerHTML = html;
    setTimeout(() => window.print(), 60);
  }

  /* ================= boot ================= */
  /* products typed freely on phones join the product list */
  Store.on(ch => {
    ch.filter(r => r.k === "dot" && !r.x && r.d && r.d.prodText && !r.d.prod).forEach(r => {
      const list = I.products(); const name = r.d.prodText.trim();
      let p = list.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!p) { p = { id: uid("n"), name }; Store.setDoc("s1:products", "doc", "s1", { list: list.concat([p]) }); }
      Store.patch(r.id, { prod: p.id });
    });
  });
  Sync.start();
  route();
})();
