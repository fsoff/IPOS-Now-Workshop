/* IPOS Now · Co-design workshop — participant view (phones) */
(function () {
  "use strict";
  const I = window.IPOS;
  const { h, icon, Store, Sync, ME, uid, toast, keyed, debounce, LS } = I;
  const mv = document.getElementById("mv");
  const PHONE = I.SESSIONS.filter(x => x.phone);

  let pick = null, lastLive, rendered = null, sub = null, chipsEl = null, panelEl = null;

  /* sync indicator */
  const syncEl = document.getElementById("sync");
  const sp = h("span", { class: "sync" }, h("span", { class: "dot" }), h("span", { class: "lbl" }));
  syncEl.append(sp);
  Sync.on(st => {
    sp.querySelector(".dot").className = "dot " + ({ local: "local", ok: "ok", busy: "busy", err: "err" }[st]);
    sp.querySelector(".lbl").textContent = { local: "Not connected", ok: "Connected", busy: "Sending…", err: "Reconnecting…" }[st];
  });

  const liveD = () => (Store.get("live") || { d: {} }).d || {};
  const target = () => pick || liveD().session || null;

  /* ---------- join ---------- */
  function join() {
    mv.innerHTML = "";
    const st = { fontSize: "16px", padding: "14px" };
    const name = h("input", { class: "input", placeholder: "Your name", value: ME.name || "", autocomplete: "name", style: st });
    const role = h("input", { class: "input", placeholder: "Role and organisation", value: ME.role || "", style: st });
    const go = () => {
      if (!name.value.trim()) { name.focus(); return; }
      I.setName(name.value, role.value); LS.set("ipos:joined", 1);
      Store.put({ id: "person:" + ME.id, k: "person", s: "ice", d: { name: ME.name, role: ME.role } });
      main();
    };
    [name, role].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") go(); }));
    mv.append(h("div", { class: "m-card enter", style: { marginTop: "6vh" } },
      h("div", { class: "label" }, "Co-design workshop"),
      h("div", { class: "h-xl", style: { fontSize: "44px" } }, "IPOS Now"),
      h("div", { class: "muted" }, "Introduce yourself: your name appears on the shared board."),
      name, role, h("button", { class: "btn dark m-send", onclick: go }, "Join")));
  }

  /* ---------- shared bits ---------- */
  function seg(list, active, on) {
    const el = h("div", { class: "seg", style: { gridTemplateColumns: `repeat(${list.length},1fr)` } });
    const draw = a => { el.innerHTML = ""; list.forEach(x => el.append(h("button", { class: x.id === a ? "on" : "", onclick: () => { draw(x.id); on(x.id); } }, x.icon || null, x.label))); };
    draw(active); el.set = draw;
    return el;
  }
  function send(btn) { btn.classList.remove("sent"); void btn.offsetWidth; btn.classList.add("sent"); toast("Sent to the board"); }

  function mine(container, filter, tagFn) {
    const draw = () => keyed(container, Store.list(r => r.p === ME.id && filter(r)), r => r.id, r => {
      const ta = h("textarea", { rows: 1 });
      const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
      const field = r.k === "stmt" ? null : "text";
      const save = debounce(() => {
        if (r.k === "stmt") { const m = ta.value.match(/^from\s+([\s\S]*?)\s+to\s+([\s\S]*)$/i); Store.patch(r.id, m ? { from: m[1].trim(), to: m[2].trim() } : { from: ta.value.trim(), to: "" }); }
        else Store.patch(r.id, { [field]: ta.value });
      }, 500);
      ta.addEventListener("input", () => { fit(); save(); });
      const tag = h("div", { class: "tag" });
      const el = h("div", { class: "m-item" }, h("div", { style: { flex: "1", display: "flex", flexDirection: "column", gap: "3px" } }, tag, ta),
        h("button", { title: "Remove", onclick: () => { const c = Store.del(r.id); toast("Removed", () => Store.restore(c)); } }, icon("x")));
      el._update = x => {
        if (document.activeElement !== ta) ta.value = x.k === "stmt" ? `From ${x.d.from || ""} to ${x.d.to || ""}` : (x.d.text || "");
        tag.textContent = tagFn ? tagFn(x) : ""; tag.style.display = tag.textContent ? "" : "none";
        el.dataset.c = x.d.color || "white";
        requestAnimationFrame(fit);
      };
      return el;
    }, (el, r) => el._update(r));
    draw();
    return draw;
  }

  function composer(ph, onSend, rows) {
    const ta = h("textarea", { class: "textarea", placeholder: ph, rows: rows || 3, style: { fontSize: "16px" } });
    const btn = h("button", { class: "btn dark m-send", onclick: () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } onSend(v); ta.value = ""; send(btn); } }, icon("upload"), "Send");
    return { ta, btn };
  }

  /* ---------- panels ---------- */
  const PANELS = {
    ice() {
      const ids = I.ICE.map(x => x.id);
      let q = ids.includes(liveD().q) ? liveD().q : ids[0], qPicked = false;
      const head = h("div");
      const s = seg(I.ICE.map((x, i) => ({ id: x.id, label: String(i + 1) })), q, id => { q = id; qPicked = true; drawHead(); upd(); });
      const c = composer("Write a card…", v => { const Q = I.ICE.find(x => x.id === q); Store.put({ id: uid("c"), k: "card", s: "ice", d: { q, text: v, color: Q.color } }); upd(); });
      const list = h("div", { class: "m-mine" });
      const me = h("div", { class: "m-me" }, h("span", null, "You: ", h("b", null, ME.name || "Guest"), ME.role ? " · " + ME.role : ""), h("button", { class: "btn sm ghost", onclick: join }, icon("edit"), "Edit"));
      function drawHead() {
        const Q = I.ICE.find(x => x.id === q);
        head.innerHTML = "";
        head.append(h("div", { class: "m-q" }, h("div", { class: "fig" }, I.figureImg(Q.img, I.FIG[Q.id])), h("div", null, h("div", { class: "h-m" }, Q.title), h("div", { class: "muted", style: { fontSize: "14px" } }, Q.sub))));
      }
      drawHead();
      const upd = mine(list, r => r.k === "card" && r.s === "ice" && r.d.q === q);
      return {
        el: [me, h("div", { class: "m-card" }, s, head, c.ta, c.btn), list],
        update() { const lq = liveD().q; if (!qPicked && ids.includes(lq) && lq !== q) { q = lq; s.set(q); drawHead(); } upd(); }
      };
    },
    s1() {
      const TABS = [{ id: "stand", label: "Stand" }, { id: "trust", label: "Trust" }, { id: "dots", label: "Dots" }];
      let tab = TABS.some(x => x.id === liveD().tab) ? liveD().tab : "stand", picked = false;
      const box = h("div", { style: { display: "contents" } });
      const s = seg(TABS, tab, id => { tab = id; picked = true; draw(); });
      let upd = () => { };
      function draw() {
        box.innerHTML = "";
        if (tab === "stand") {
          const id = "spis:" + ME.id;
          const card = h("div", { class: "m-card" });
          box.append(card);
          const save = patch => { const cur = Store.get(id); Store.put({ id, k: "spis", s: "s1", d: Object.assign({ now: null, aim: null, model: null }, cur ? cur.d : {}, patch) }); };
          const slider = (key, label) => {
            const cur = Store.get(id); const v = cur && cur.d[key] != null ? cur.d[key] : 50;
            const out = h("div", { class: "sl-out" });
            const r = h("input", { type: "range", min: 0, max: 100, value: v, class: "m-range" + (cur && cur.d[key] != null ? "" : " unset") });
            const show = () => { out.textContent = I.SPECTRUM[Math.min(3, Math.floor(r.value / 25))].label; };
            r.addEventListener("input", () => { r.classList.remove("unset"); show(); });
            r.addEventListener("change", () => save({ [key]: +r.value }));
            show();
            return h("div", { class: "sl" }, h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "label" }, label), out), r,
              h("div", { class: "sl-ticks" }, h("span", null, "Informational"), h("span", null, "Relational"), h("span", null, "Systems")));
          };
          card.append(h("div", { class: "h-m" }, "Where does IPOS Now sit?"),
            h("div", { class: "muted", style: { fontSize: "13.5px" } }, "From sharing information to brokering knowledge and innovation."),
            slider("now", "Today"), slider("aim", "In 13 months"));
          const mcard = h("div", { class: "m-card" }, h("div", { class: "h-m" }, "How does knowledge flow?"));
          const ms = h("div", { class: "seg", style: { gridTemplateColumns: "1fr" } });
          const drawM = () => { const cur = Store.get(id); ms.innerHTML = ""; I.MODELS.forEach(m => ms.append(h("button", { class: cur && cur.d.model === m.id ? "on" : "", onclick: () => { save({ model: m.id }); drawM(); } }, m.label, h("small", { style: { fontWeight: 400, opacity: .7 } }, m.desc)))); };
          drawM(); mcard.append(ms); box.append(mcard);
          upd = () => { };
        } else if (tab === "trust") {
          const id = "trust:" + ME.id;
          const card = h("div", { class: "m-card" }), tcard = h("div", { class: "m-card" });
          box.append(card, tcard);
          const get = () => { const r = Store.get(id); return Object.assign({ tokens: {} }, r ? r.d : {}); };
          const save = d => Store.put({ id, k: "trust", s: "s1", d });
          upd = () => {
            const d = get();
            card.innerHTML = ""; tcard.innerHTML = "";
            card.append(h("div", { class: "h-m" }, "How strong is IPOS Now today?"), h("div", { class: "muted", style: { fontSize: "13.5px" } }, "1 = weak · 5 = strong"));
            I.CRELE.forEach(cr => {
              const dots = h("div", { class: "dots5" });
              for (let v = 1; v <= 5; v++) dots.append(h("button", { class: d[cr.id] === v ? "on" : "", onclick: () => { const n = get(); n[cr.id] = n[cr.id] === v ? null : v; save(n); } }, v));
              card.append(h("div", { class: "rate-row" }, h("span", null, h("b", null, cr.label), h("br"), h("small", { class: "muted" }, cr.desc)), dots));
            });
            const used = Object.values(d.tokens).reduce((a, b) => a + b, 0), left = I.TOKENS - used;
            tcard.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("div", { class: "h-m" }, "What builds trust?"), h("span", { class: "pill" + (left ? " yellow" : "") }, left + " token" + (left === 1 ? "" : "s") + " left")),
              h("div", { class: "muted", style: { fontSize: "13.5px" } }, "Spend " + I.TOKENS + " tokens on what matters most for IPOS Now."));
            I.TRUST.forEach(t => {
              const n = d.tokens[t.id] || 0;
              tcard.append(h("div", { class: "tok-row" + (n ? " on" : "") }, h("span", null, t.label),
                h("div", { class: "tok" }, h("button", { disabled: !n ? true : null, onclick: () => { const x = get(); x.tokens = Object.assign({}, x.tokens, { [t.id]: Math.max(0, n - 1) }); save(x); } }, "−"),
                  h("b", null, n ? "●".repeat(n) : "·"),
                  h("button", { disabled: !left ? true : null, onclick: () => { const x = get(); x.tokens = Object.assign({}, x.tokens, { [t.id]: n + 1 }); save(x); } }, "+"))));
            });
          };
          upd();
        } else {
          let aud = null, prod = null, mode = "exchange", tones = [];
          const card = h("div", { class: "m-card" });
          const list = h("div", { class: "m-mine" });
          box.append(card, list);
          const chipsOf = (items, isOn, onTap) => h("div", { class: "pick" }, items.map(x => h("button", { class: isOn(x) ? "on" : "", onclick: () => onTap(x) }, x.name || x)));
          const other = h("input", { class: "input", placeholder: "Other product…", style: { fontSize: "16px" } });
          const onb = h("textarea", { class: "textarea", rows: 2, placeholder: "How do we engage or onboard them now? (optional)", style: { fontSize: "16px", minHeight: "64px" } });
          other.addEventListener("input", () => { if (other.value.trim()) { prod = null; drawCard(); other.focus(); } });
          function drawCard() {
            const keepOther = other.value, keepOnb = onb.value;
            card.innerHTML = "";
            card.append(h("div", { class: "h-m" }, "Connect an audience to a product"),
              h("div", { class: "label" }, "1 · Audience"), chipsOf(I.audiences(), x => x.id === aud, x => { aud = x.id; drawCard(); }),
              h("div", { class: "label" }, "2 · Product"), chipsOf(I.products(), x => x.id === prod, x => { prod = x.id; other.value = ""; drawCard(); }), other,
              h("div", { class: "label" }, "3 · Mode"), h("div", { class: "seg" }, I.MODES.map(m => h("button", { class: mode === m.id ? "on" : "", onclick: () => { mode = m.id; drawCard(); } }, m.label, h("small", { style: { fontWeight: 400, opacity: .7 } }, m.sub)))),
              h("div", { class: "label" }, "4 · Tone (up to two)"), chipsOf(I.TONES, x => tones.includes(x), x => { tones = tones.includes(x) ? tones.filter(y => y !== x) : tones.concat([x]).slice(-2); drawCard(); }),
              h("div", { class: "label" }, "5 · Onboarding"), onb);
            other.value = keepOther; onb.value = keepOnb;
            const btn = h("button", { class: "btn dark m-send", onclick: () => {
              const pt = other.value.trim();
              if (!aud || (!prod && !pt)) { toast("Choose an audience and a product"); return; }
              Store.put({ id: uid("dt"), k: "dot", s: "s1", d: Object.assign({ aud, mode, tones, onboard: onb.value.trim() }, prod ? { prod } : { prodText: pt }) });
              prod = null; tones = []; other.value = ""; onb.value = ""; send(btn); drawCard(); updList();
            } }, icon("upload"), "Connect");
            card.append(btn);
          }
          drawCard();
          const name = (l, id) => (l.find(x => x.id === id) || { name: "" }).name;
          const updList = mine(list, r => r.k === "dot" && r.s === "s1", x => name(I.audiences(), x.d.aud) + " → " + (name(I.products(), x.d.prod) || x.d.prodText || "") + " · " + ((I.MODES.find(m => m.id === x.d.mode) || {}).label || ""));
          upd = () => { updList(); };
        }
      }
      draw();
      return { el: [s, box], update() { const lt = liveD().tab; if (!picked && TABS.some(x => x.id === lt) && lt !== tab) { tab = lt; s.set(tab); draw(); } else upd(); } };
    },
    s2() {
      const ch = h("div", { class: "m-card" });
      const c = composer("A step to overcome it…", v => { const r = round(); if (!r) { toast("Wait for the emergency"); return; } Store.put({ id: uid("st"), k: "step", s: "s2", d: { round: r.id, text: v, slot: null } }); upd(); }, 2);
      const list = h("div", { class: "m-mine" });
      const round = () => { const cc = Store.get("s2:current"); return cc && Store.get(cc.d.id); };
      function drawCh() {
        const r = round();
        ch.innerHTML = "";
        if (!r) ch.append(h("div", { class: "label" }, "Emergency"), h("div", { class: "muted" }, "The emergency will appear here once drawn."));
        else ch.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "label" }, "Emergency " + (r.d.e + 1)), h("span", { class: "pill red" }, "Live")), h("div", { style: { fontSize: "18px", fontWeight: 500, lineHeight: 1.35 } }, r.d.text));
      }
      drawCh();
      const upd = mine(list, r => { const rr = round(); return r.k === "step" && rr && r.d.round === rr.id; });
      let last = round() && round().id;
      return { el: [ch, h("div", { class: "m-card" }, c.ta, c.btn), list], update() { const r = round(); if ((r && r.id) !== last) { last = r && r.id; drawCh(); } upd(); } };
    },
    s3() {
      let layer = "rock";
      const M = I.months();
      const sel = h("select", { class: "select", style: { fontSize: "16px" } }, h("option", { value: "" }, "Month (optional)"), M.map(m => h("option", { value: m.i }, m.n + " · " + m.label)));
      const s = seg(I.LAYERS.map(L => ({ id: L.id, label: L.label, icon: I.layerIcon(L.id) })), layer, id => { layer = id; sub.textContent = I.LAYERS.find(L => L.id === id).sub; });
      const sub = h("div", { class: "muted", style: { fontSize: "14px", textAlign: "center" } }, I.LAYERS[0].sub);
      const c = composer("Event, format or moment…", v => { Store.put({ id: uid("c"), k: "card", s: "s3", d: { layer, month: sel.value === "" ? null : +sel.value, text: v } }); sel.value = ""; upd(); }, 2);
      const list = h("div", { class: "m-mine" });
      const upd = mine(list, r => r.k === "card" && r.s === "s3", x => (I.LAYERS.find(L => L.id === x.d.layer) || { label: "" }).label + (x.d.month != null ? " · " + M[x.d.month].label : ""));
      return { el: [h("div", { class: "m-card" }, s, sub, c.ta, sel, c.btn), list], update: () => upd() };
    },
    s4() {
      const TABS = [{ id: "audit", label: "Toolkit audit" }, { id: "uses", label: "Uses of visuals" }];
      let tab = liveD().tab === "uses" ? "uses" : "audit", picked = false;
      const box = h("div", { style: { display: "contents" } });
      const s = seg(TABS, tab, id => { tab = id; picked = true; draw(); });
      let upd = () => { };
      function draw() {
        box.innerHTML = "";
        if (tab === "uses") {
          const c = composer("An idea for using visuals or interactivity…", v => { Store.put({ id: uid("c"), k: "card", s: "s4b", d: { text: v } }); upd(); });
          const list = h("div", { class: "m-mine" });
          box.append(h("div", { class: "m-card" }, h("div", { class: "h-m" }, "Uses of visuals"), c.ta, c.btn), list);
          upd = mine(list, r => r.k === "card" && r.s === "s4b");
        } else {
          const wrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });
          box.append(wrap);
          let lastFocus = null;
          upd = () => {
            const focus = (Store.get("s4:focus") || { d: {} }).d.id;
            const as = I.assets();
            const done = as.filter(a => { const v = Store.get("v:" + ME.id + ":" + a.id); return v && v.d.v; }).length;
            const ordered = focus ? [as.find(a => a.id === focus)].filter(Boolean).concat(as.filter(a => a.id !== focus)) : as;
            wrap.innerHTML = "";
            wrap.append(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("span", { class: "muted", style: { fontSize: "14px" } }, "Keep it, expand it, or let it go?"), h("span", { class: "pill" }, done + " / " + as.length)));
            ordered.forEach(a => {
              const vid = "v:" + ME.id + ":" + a.id; const cur = Store.get(vid); const val = cur && cur.d.v;
              const el = h("div", { class: "m-card vote" + (a.id === focus ? " focus" : "") + (val ? " voted" : "") },
                h("div", { class: "row", style: { justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" } }, h("b", null, a.name), a.id === focus ? h("span", { class: "pill red" }, "On screen") : (a.page ? h("span", { class: "muted", style: { fontSize: "12px", whiteSpace: "nowrap" } }, "p. " + a.page) : null)),
                h("div", { class: "vbtns" }, I.AUDIT_COLS.map(col => h("button", { class: "v-" + col.id + (val === col.id ? " on" : ""), onclick: () => Store.put({ id: vid, k: "vote", s: "s4", d: { asset: a.id, v: val === col.id ? null : col.id } }) }, col.label))));
              wrap.append(el);
            });
            if (focus && focus !== lastFocus) { lastFocus = focus; window.scrollTo({ top: 0, behavior: "smooth" }); }
          };
          upd();
        }
      }
      draw();
      return { el: [s, box], update() { const lt = liveD().tab; if (!picked && (lt === "uses" || lt === "audit") && lt !== tab) { tab = lt; s.set(tab); draw(); } else upd(); } };
    },
    s5() {
      let tab = "stmt";
      const box = h("div", { style: { display: "contents" } });
      const s = seg([{ id: "stmt", label: "From… to…" }, { id: "kpi", label: "KPI idea" }], tab, id => { tab = id; draw(); });
      const list = h("div", { class: "m-mine" });
      function draw() {
        box.innerHTML = "";
        if (tab === "stmt") {
          const f = h("input", { class: "input", placeholder: "From…", style: { fontSize: "16px" } }), t = h("input", { class: "input", placeholder: "To…", style: { fontSize: "16px" } });
          const b = h("button", { class: "btn dark m-send", onclick: () => { if (!f.value.trim() && !t.value.trim()) return; Store.put({ id: uid("fs"), k: "stmt", s: "s5", d: { from: f.value.trim(), to: t.value.trim() } }); f.value = t.value = ""; send(b); upd(); } }, icon("upload"), "Send");
          box.append(f, t, b);
        } else {
          const c = composer("A measurable indicator…", v => { Store.put({ id: uid("k"), k: "kpi", s: "s5", d: { text: v, obj: null, level: "outcome", source: "", owner: "" } }); upd(); }, 2);
          box.append(c.ta, c.btn);
        }
      }
      draw();
      const upd = mine(list, r => (r.k === "stmt" || r.k === "kpi") && r.s === "s5", x => x.k === "kpi" ? "KPI idea" : "");
      return { el: [h("div", { class: "m-card" }, s, box), list], update: () => upd() };
    }
  };

  function waiting() {
    return { el: [h("div", { class: "m-wait enter" },
      h("span", { style: { display: "contents" }, html: '<svg class="wave-anim" viewBox="0 0 120 40"><path d="M4 22c9 0 9-10 18-10s9 10 18 10 9-10 18-10 9 10 18 10 9-10 18-10 9 10 18 10"/></svg>' }),
      h("div", { class: "h-m" }, "Stay tuned"),
      h("div", null, "The next activity will open here."))], update() { } };
  }

  /* ---------- main ---------- */
  function drawChips() {
    const L = liveD().session, t = target();
    chipsEl.innerHTML = "";
    PHONE.forEach(x => chipsEl.append(h("button", { class: x.id === t ? "on" : "", onclick: () => { pick = x.id === L ? null : x.id; drawChips(); drawPanel(); } }, x.id === L ? h("span", { class: "livedot" }) : null, x.n ? "S" + x.n + " · " + x.title.split(":")[0] : x.label)));
    const on = chipsEl.querySelector(".on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }
  function drawPanel() {
    const t = target();
    if (t === rendered && sub) { sub.update(); return; }
    rendered = t;
    panelEl.innerHTML = "";
    const sess = I.sessionById(t);
    sub = t && PANELS[t] ? PANELS[t]() : waiting();
    if (t && PANELS[t]) panelEl.append(h("div", { class: "enter" }, h("div", { class: "label" }, sess.n ? "Session " + sess.n : sess.label), h("div", { class: "h-l", style: { marginTop: "2px" } }, sess.title)));
    [].concat(sub.el).forEach(e => { e.classList && e.classList.add("enter"); panelEl.append(e); });
  }
  function main() {
    mv.innerHTML = "";
    chipsEl = h("div", { class: "chips" });
    panelEl = h("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
    mv.append(chipsEl, panelEl);
    lastLive = liveD().session;
    drawChips(); drawPanel();
  }

  Store.on(ch => {
    if (!chipsEl) return;
    const L = liveD().session;
    if (L !== lastLive) { lastLive = L; pick = null; drawChips(); drawPanel(); return; }
    drawPanel();
  });

  Sync.start();
  if (!LS.get("ipos:joined", 0)) join(); else main();
})();
