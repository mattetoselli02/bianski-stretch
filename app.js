/* Bianski Stretch — logica dell'app */
(() => {
  'use strict';
  const { ES, ZONE, ATTREZZI, POS } = window.Esercizi;
  const MAN = window.Manichino;
  const BY = Object.fromEntries(ES.map(e => [e.id, e]));

  // ---------- utilità ----------
  const $ = s => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const fmt = s => { s = Math.round(s); const m = Math.floor(s / 60), r = s % 60; return r ? `${m}′${pad(r)}″` : `${m}′`; };
  const fmtMin = s => `${Math.round(s / 60)} min`;
  const LIVELLI = ['', 'Base', 'Intermedio', 'Avanzato'];
  const lvDots = n => `<span class="lv" aria-label="${LIVELLI[n]}">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600); }

  // ---------- momenti della giornata ----------
  const MOM = {
    risveglio: { nome: 'Risveglio', ora: '07:30', ene: 1, order: ['terra', 'ginocchio', 'seduta', 'piedi'], hold: 0.85, boost: ['schiena', 'collo', 'fianchi', 'anche'], txt: 'movimenti morbidi per svegliare il corpo' },
    pausa: { nome: 'Pausa', ora: '13:00', ene: 0.5, order: ['seduta', 'ginocchio', 'piedi'], pos: ['piedi', 'seduta'], hold: 0.9, boost: ['collo', 'spalle', 'schiena', 'braccia', 'petto', 'anche'], txt: 'collo, spalle e schiena, senza bisogno di stendersi' },
    allenamento: { nome: 'Dopo l\'allenamento', ora: '18:30', ene: 0, order: ['piedi', 'ginocchio', 'seduta', 'terra'], hold: 1, noDyn: true, boost: ['femorali', 'quadricipiti', 'polpacci', 'glutei', 'anche', 'adduttori'], txt: 'tenute per le gambe e le anche' },
    sera: { nome: 'Sera', ora: '21:00', ene: -0.5, order: ['piedi', 'ginocchio', 'seduta', 'terra'], hold: 1.05, boost: [], txt: 'tutto il corpo, dai piedi al tappetino' },
    nanna: { nome: 'Prima di dormire', ora: '22:45', ene: -1, order: ['ginocchio', 'seduta', 'terra'], pos: ['ginocchio', 'seduta', 'terra'], hold: 1.2, noDyn: true, boost: ['lombare', 'anche', 'glutei', 'collo'], txt: 'tenute lunghe e lente, si finisce stese' },
  };
  const momFromHour = h => h < 10 ? 'risveglio' : h < 16 ? 'pausa' : h < 22 ? 'sera' : 'nanna';

  // ---------- dati salvati ----------
  const KEY = 'bianski.v1', OLD_KEY = 'flessuosa.v1';
  const DEF = () => ({
    v: 1, creato: today(), configurato: false,
    profilo: { nome: '', livello: 2, zone: ['anche', 'femorali', 'lombare'], attrezzi: ['muro', 'cinghia', 'cuscino'], sessioni: [{ id: 's1', momento: 'risveglio', ora: '07:30', durata: 8 }, { id: 's2', momento: 'sera', ora: '21:30', durata: 15 }], voce: true, suoni: true, wake: true },
    storico: [], preferiti: [], varianti: {},
  });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY); if (raw) { const o = JSON.parse(raw); const d = DEF(); return { ...d, ...o, profilo: { ...d.profilo, ...(o.profilo || {}) } }; } } catch (e) { /* senza memoria */ }
    return DEF();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* senza memoria */ } }
  const P = () => S.profilo;

  // ---------- colori del manichino dal tema ----------
  let PAL = null;
  function pal() {
    if (PAL) return PAL;
    const cs = getComputedStyle(document.documentElement), g = n => MAN.hex(cs.getPropertyValue(n) || '#e98aa6');
    PAL = { body: g('--fig'), light: g('--fig-light'), dark: g('--fig-dark'), hair: g('--fig-hair'), mat: MAN.css(g('--mat')), matEdge: MAN.css(g('--mat-edge')), floor: MAN.css(g('--floor')), shadow: g('--shadow'), wall: MAN.css(g('--wall')), wood: g('--wood'), block: g('--block'), strap: g('--strap'), roller: g('--roller'), ball: g('--ball') };
    return PAL;
  }
  const repaintAll = () => { PAL = null; render(); };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaintAll); } catch (e) { }
  new MutationObserver(repaintAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- storico, giorni di fila ----------
  const counts = s => s.completa || s.fatto >= 0.6 * s.previsto;
  function doneDays() { const m = {}; S.storico.filter(counts).forEach(s => { m[s.data] = (m[s.data] || 0) + 1; }); return m; }
  function streak() {
    const d = doneDays(); let t = today(); if (!d[t]) t = addDays(t, -1);
    let n = 0; while (d[t]) { n++; t = addDays(t, -1); }
    return n;
  }
  function bestStreak() {
    const days = Object.keys(doneDays()).sort(); let best = 0, cur = 0, prev = null;
    for (const d of days) { cur = prev && diffDays(prev, d) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
    return best;
  }

  // ---------- generatore di sessioni ----------
  const PREP_FIRST = 8, PREP = 6, SWITCH = 5, MOVE = 4;
  function holdFor(ex, lv, mom) { const base = ex.tipo === 'd' ? [40, 45, 50][lv - 1] : [30, 40, 50][lv - 1]; return Math.max(20, Math.round(base * MOM[mom].hold / 5) * 5); }
  const itemTime = it => (it.ex.lato ? 2 : 1) * it.dur + (it.ex.lato ? SWITCH : 0);
  function sessionTime(items) {
    let t = 0; items.forEach((it, i) => { t += i === 0 ? PREP_FIRST : PREP + (items[i - 1].ex.pos !== it.ex.pos ? MOVE : 0); t += itemTime(it); });
    return t;
  }
  function orderItems(items, mom) {
    const ord = MOM[mom].order, idx = p => { const i = ord.indexOf(p); return i < 0 ? ord.length : i; };
    const first = items.filter(i => !i.serie), rep = items.filter(i => i.serie);
    const s = first.map((it, k) => ({ it, k })).sort((a, b) => idx(a.it.ex.pos) - idx(b.it.ex.pos) || (a.it.ex.tipo === 'd' ? 0 : 1) - (b.it.ex.tipo === 'd' ? 0 : 1) || a.k - b.k).map(x => x.it);
    return s.concat(rep);
  }
  function buildSession({ mom, minuti, seed }) {
    const pr = P(), lv = pr.livello, M = MOM[mom], target = minuti * 60;
    let pool = ES.filter(e => e.liv <= lv && e.attr.every(a => pr.attrezzi.includes(a)));
    if (M.pos) { const p2 = pool.filter(e => M.pos.includes(e.pos)); if (p2.length >= 4) pool = p2; }
    if (M.noDyn) { const p2 = pool.filter(e => e.tipo !== 'd'); if (p2.length >= 4) pool = p2; }
    const rand = rng(hashStr(seed));
    const last = {}; S.storico.forEach(s => (s.esercizi || []).forEach(id => { if (!last[id] || last[id] < s.data) last[id] = s.data; }));
    const t0 = today();
    const W = {}; Object.keys(ZONE).forEach(z => { W[z] = 1 + (pr.zone.includes(z) ? 2.2 : 0) + (M.boost.includes(z) ? 1.2 : 0); });
    const jit = Object.fromEntries(pool.map(e => [e.id, rand() * 1.6]));
    const score = e => {
      const zw = e.zone.reduce((s, z) => s + (W[z] || 0), 0) / (1 + 0.3 * (e.zone.length - 1));
      const days = last[e.id] ? Math.min(7, Math.max(0, diffDays(last[e.id], t0))) : 7;
      return zw + 1.2 * (1 - Math.abs(e.ene - M.ene) / 2) + days * 0.12 + jit[e.id] + (S.preferiti.includes(e.id) ? 0.6 : 0) + (lv >= 2 && e.liv === lv ? 0.5 : 0);
    };
    const chosen = [];
    for (;;) {
      let best = null, bs = -1e9;
      for (const e of pool) {
        if (chosen.some(c => c.ex.id === e.id)) continue;
        const sc = score(e); if (sc <= bs) continue;
        const trial = orderItems([...chosen, { ex: e, dur: holdFor(e, lv, mom) }], mom);
        if (sessionTime(trial) <= target + 10) { best = e; bs = sc; }
      }
      if (!best) break;
      chosen.push({ ex: best, dur: holdFor(best, lv, mom) });
      best.zone.forEach(z => { W[z] *= 0.55; });
    }
    let items = orderItems(chosen, mom);
    // se manca tempo: seconda serie degli esercizi a tenuta più adatti
    if (target - sessionTime(items) > 75) {
      const again = items.filter(i => i.ex.tipo === 's').slice().sort((a, b) => score(b.ex) - score(a.ex));
      for (const it of again) { const c = { ex: it.ex, dur: it.dur, serie: 2 }; if (sessionTime([...items, c]) <= target + 10) items.push(c); }
    }
    // allunga le tenute per arrivare alla durata scelta
    let guard = 0;
    while (sessionTime(items) + 5 <= target && guard++ < 400) {
      const cand = items.filter(i => i.dur < holdFor(i.ex, lv, mom) * 1.6).sort((a, b) => a.dur / holdFor(a.ex, lv, mom) - b.dur / holdFor(b.ex, lv, mom))[0];
      if (!cand) break;
      cand.dur += 5; if (sessionTime(items) > target + 5) { cand.dur -= 5; break; }
    }
    const zt = {}; items.forEach(i => i.ex.zone.forEach((z, k) => { zt[z] = (zt[z] || 0) + itemTime(i) / (k + 1); }));
    const focus = Object.entries(zt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([z]) => z);
    return { mom, minuti, items, total: sessionTime(items), focus, seed };
  }
  const variantOf = sid => S.varianti[`${today()}|${sid}`] || 0;
  const sessionFor = slot => buildSession({ mom: slot.momento, minuti: slot.durata, seed: `${today()}|${slot.id}|${variantOf(slot.id)}` });

  // ---------- navigazione ----------
  const VIEWS = { oggi: 'Oggi', esercizi: 'Esercizi', diario: 'Diario', profilo: 'Profilo' };
  let cur = 'oggi';
  function go(v) {
    cur = v;
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'));
    Object.keys(VIEWS).forEach(k => { $('#v-' + k).hidden = k !== v; });
    $('#title').textContent = v === 'oggi' ? (P().nome ? `Ciao ${P().nome}` : 'Oggi') : VIEWS[v];
    render(); scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => go(b.dataset.v));
  function render() {
    const d = new Date();
    $('#subtitle').textContent = cur === 'esercizi' ? `${ES.length} esercizi` : `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
    if (cur === 'oggi') renderOggi(); else if (cur === 'esercizi') renderLib(); else if (cur === 'diario') renderDiario(); else renderProfilo();
  }

  // ---------- miniature ----------
  const thumbQ = new Set();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); drawThumb(en.target); } }), { rootMargin: '200px' }) : null;
  function thumb(ex, side) { const c = document.createElement('canvas'); c.dataset.ex = ex.id; c.dataset.side = side || 'L'; c.setAttribute('aria-hidden', 'true'); if (io) io.observe(c); else thumbQ.add(c); return c; }
  function drawThumb(c) {
    const ex = BY[c.dataset.ex]; if (!ex || !c.isConnected) return;
    let e = ex; if (c.dataset.side === 'R') e = { ...ex, A: MAN.mirror(MAN.full(ex.A)), B: MAN.mirror(MAN.full(ex.B)), props: MAN.mirrorProps(ex.props), view: -(ex.view != null ? ex.view : 30) };
    MAN.snapshot(c, e, pal());
  }
  const flushThumbs = () => requestAnimationFrame(() => { thumbQ.forEach(drawThumb); thumbQ.clear(); });

  // ---------- OGGI ----------
  function bloomSVG() {
    const days = doneDays(), t = today(), d = parse(t), dow = (d.getDay() + 6) % 7, monday = addDays(t, -dow);
    const n = streak();
    let s = '';
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i), on = !!days[day], isT = day === t, fut = day > t;
      const fill = on ? 'var(--accent)' : fut ? 'var(--surface-2)' : 'var(--surface-3)';
      s += `<g transform="rotate(${i * 360 / 7})"><path class="petal" d="M0,-20 C 15,-30 16,-52 0,-66 C -16,-52 -15,-30 0,-20 Z" fill="${fill}" ${isT ? 'stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 3"' : ''}/></g>`;
    }
    s += `<circle r="25" fill="var(--surface)"/><text class="bloom-n" text-anchor="middle" y="9">${n}</text>`;
    $('#bloom').innerHTML = s;
    $('#bloom').setAttribute('aria-label', `${n} giorni di fila`);
    const best = bestStreak();
    $('#bloomMsg').textContent = n === 0 ? 'Si comincia oggi' : n === 1 ? '1 giorno di fila' : `${n} giorni di fila`;
    const doneToday = !!days[t];
    $('#bloomSub').textContent = doneToday ? `Oggi è fatta.${best > n ? ` Record: ${best} giorni.` : n > 1 ? ' È il tuo record.' : ''}` : n > 0 ? 'Fai una sessione oggi per non interrompere la serie.' : 'Basta una sessione al giorno per far sbocciare il fiore.';
    const dd = $('#bloomDays'); dd.replaceChildren();
    'LMMGVSD'.split('').forEach((L, i) => { const day = addDays(monday, i); const sp = el('span', (days[day] ? 'on' : '') + (day === t ? ' today' : ''), L); dd.append(sp); });
  }
  function renderOggi() {
    bloomSVG();
    const sb = $('#setupBanner'); sb.replaceChildren();
    if (!S.configurato) {
      const b = el('div', 'banner'); b.append(el('p', null, 'Scegli livello, zone e quante sessioni fare al giorno: le sessioni si adatteranno a te.'));
      const bt = el('button', 'btn sm', 'Personalizza'); bt.onclick = () => go('profilo'); b.append(bt); sb.append(b);
    }
    const list = $('#todayList'); list.replaceChildren();
    const slots = P().sessioni.slice().sort((a, b) => a.ora.localeCompare(b.ora));
    const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const doneSlots = new Set(S.storico.filter(s => s.data === today() && counts(s)).map(s => s.slot));
    const nextId = (slots.find(s => !doneSlots.has(s.id) && s.ora >= addMin(hm, -90)) || slots.find(s => !doneSlots.has(s.id)) || {}).id;
    if (!slots.length) list.append(el('div', 'empty', 'Nessuna sessione impostata. Aggiungine una dal Profilo.'));
    for (const slot of slots) {
      const ses = sessionFor(slot), done = doneSlots.has(slot.id);
      const c = el('div', 'ses' + (done ? ' done' : '') + (slot.id === nextId ? ' next' : ''));
      const h = el('div', 'ses-h'); const t = el('div', 't');
      t.append(el('b', null, MOM[slot.momento].nome), el('small', null, `${fmt(ses.total)} · ${ses.items.length} esercizi · ${LIVELLI[P().livello].toLowerCase()}`));
      h.append(t, el('span', 'time num', done ? `Fatta ✓` : slot.ora)); c.append(h);
      const ch = el('div', 'chips'); ses.focus.forEach(z => ch.append(el('span', 'chip tag', ZONE[z]))); c.append(ch);
      const st = el('div', 'strip');
      ses.items.forEach(it => { const m = el('button', 'mini'); m.append(thumb(it.ex), el('span', null, it.ex.nome)); m.onclick = () => openPlan(ses, slot); st.append(m); });
      c.append(st);
      const f = el('div', 'ses-f');
      const go1 = el('button', 'btn', done ? 'Rifalla' : 'Inizia'); if (done) go1.className = 'btn soft';
      go1.onclick = () => startPlayer(ses, { slot: slot.id, nome: MOM[slot.momento].nome });
      const sh = el('button', 'iconbtn'); sh.setAttribute('aria-label', 'Cambia esercizi'); sh.title = 'Cambia esercizi';
      sh.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M15 15l6 6M3 8V3h5M3 3l6 6"/></svg>';
      sh.onclick = () => { S.varianti[`${today()}|${slot.id}`] = variantOf(slot.id) + 1; save(); renderOggi(); toast('Nuovi esercizi per questa sessione'); };
      const pv = el('button', 'iconbtn'); pv.setAttribute('aria-label', 'Vedi gli esercizi'); pv.title = 'Vedi gli esercizi';
      pv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>';
      pv.onclick = () => openPlan(ses, slot);
      f.append(go1, pv, sh); c.append(f);
      list.append(c);
    }
    // sessione libera
    const r = $('#freeDur'); if (!r.dataset.init) { r.dataset.init = 1; r.value = 12; FREE.mom = momFromHour(now.getHours()); }
    const fm = $('#freeMom'); fm.replaceChildren();
    Object.entries(MOM).forEach(([k, m]) => { const b = el('button', 'chip', m.nome); b.setAttribute('aria-pressed', k === FREE.mom); b.onclick = () => { FREE.mom = k; renderFree(); }; fm.append(b); });
    renderFree();
    flushThumbs();
  }
  const FREE = { mom: 'sera' };
  function addMin(hm, m) { const [h, mi] = hm.split(':').map(Number); const t = Math.max(0, h * 60 + mi + m); return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; }
  function renderFree() {
    const r = $('#freeDur'); $('#freeVal').textContent = r.value; r.style.setProperty('--p', ((r.value - 7) / 23 * 100) + '%');
    document.querySelectorAll('#freeMom .chip').forEach((b, i) => b.setAttribute('aria-pressed', Object.keys(MOM)[i] === FREE.mom));
    $('#freeInfo').textContent = MOM[FREE.mom].txt;
  }
  $('#freeDur').oninput = renderFree;
  $('#freeGo').onclick = () => { const n = (S.libere = (S.libere || 0) + 1); save(); openPlan(buildSession({ mom: FREE.mom, minuti: +$('#freeDur').value, seed: `libera|${Date.now()}|${n}` }), null); };

  // ---------- fogli ----------
  let sheetViewer = null, sheetOnClose = null;
  function openSheet(fill, onClose) {
    closeSheet(true);
    const sc = $('#scrim'), sh = $('#sheet'), inn = $('#sheetIn');
    inn.replaceChildren(); fill(inn); sheetOnClose = onClose || null;
    sc.hidden = false; sh.hidden = false; inn.scrollTop = 0;
    requestAnimationFrame(() => { sc.classList.add('on'); sh.classList.add('on'); flushThumbs(); });
    document.body.style.overflow = 'hidden';
  }
  function closeSheet(instant) {
    const sc = $('#scrim'), sh = $('#sheet');
    if (sheetViewer) { sheetViewer.destroy(); sheetViewer = null; }
    if (sh.hidden) return;
    sc.classList.remove('on'); sh.classList.remove('on'); document.body.style.overflow = '';
    const fin = () => { sc.hidden = true; sh.hidden = true; };
    if (instant === true) fin(); else setTimeout(fin, 320);
    const f = sheetOnClose; sheetOnClose = null; if (f) f();
  }
  $('#scrim').onclick = () => closeSheet();
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#player').hidden) return; closeSheet(); } });
  function sheetHead(inn, title, back) {
    const h = el('div', 'sheet-h');
    if (back) { const b = el('button', 'x'); b.setAttribute('aria-label', 'Indietro'); b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>'; b.onclick = back; h.append(b); }
    const h2 = el('h2', null, title); h2.style.flex = '1'; h.append(h2);
    const x = el('button', 'x'); x.setAttribute('aria-label', 'Chiudi'); x.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.onclick = () => closeSheet();
    h.append(x); inn.append(h);
  }

  // anteprima di una sessione
  function openPlan(ses, slot) {
    openSheet(inn => {
      sheetHead(inn, slot ? MOM[slot.momento].nome : `Sessione libera · ${MOM[ses.mom].nome}`);
      const info = el('div', 'facts');
      [['Durata', fmt(ses.total)], ['Esercizi', String(ses.items.length)], ['Livello', LIVELLI[P().livello]]].forEach(([a, b]) => { const f = el('div', 'fact'); f.append(el('span', null, a), el('b', 'num', b)); info.append(f); });
      inn.append(info);
      const ch = el('div', 'chips'); ses.focus.forEach(z => ch.append(el('span', 'chip tag', ZONE[z]))); inn.append(ch);
      const pl = el('div', 'card plan'); pl.style.gap = '0';
      ses.items.forEach(it => {
        const r = el('button', 'plan-r'); r.append(thumb(it.ex));
        const m = el('div'); m.innerHTML = `<b>${esc(it.ex.nome)}${it.serie ? ' · 2ª serie' : ''}</b><small>${it.ex.lato ? 'per lato · ' : ''}${it.ex.tipo === 'd' ? 'in movimento' : 'tenuta'} · ${POS[it.ex.pos].toLowerCase()}</small>`;
        r.append(m, el('span', 'd num', it.ex.lato ? `2 × ${it.dur}″` : `${it.dur}″`));
        r.onclick = () => openExercise(it.ex, () => openPlan(ses, slot));
        pl.append(r);
      });
      inn.append(pl);
      const f = el('div', 'row');
      const b = el('button', 'btn grow', 'Inizia'); b.onclick = () => { closeSheet(true); startPlayer(ses, slot ? { slot: slot.id, nome: MOM[slot.momento].nome } : { slot: null, nome: 'Sessione libera' }); };
      f.append(b);
      if (slot) { const r = el('button', 'btn soft', 'Altri esercizi'); r.onclick = () => { S.varianti[`${today()}|${slot.id}`] = variantOf(slot.id) + 1; save(); openPlan(sessionFor(slot), slot); render(); }; f.append(r); }
      else { const r = el('button', 'btn soft', 'Altri esercizi'); r.onclick = () => openPlan(buildSession({ mom: ses.mom, minuti: ses.minuti, seed: ses.seed + '+' }), null); f.append(r); }
      inn.append(f);
    });
  }

  // scheda di un esercizio con manichino girabile
  function openExercise(ex, back) {
    openSheet(inn => {
      sheetHead(inn, ex.nome, back ? () => back() : null);
      const stg = el('div', 'stage'); const cv = el('canvas'); cv.setAttribute('aria-label', `Manichino 3D: ${ex.nome}. Trascina per girarlo.`); cv.setAttribute('role', 'img');
      const hint = el('div', 'hint'); hint.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 12a9 4 0 0 0 18 0M21 12a9 4 0 0 0-18 0"/><path d="M18 9l3 3-3 1"/></svg>Trascina per girare a 360°';
      const tools = el('div', 'tools');
      const rot = el('button', null, '360°'); rot.setAttribute('aria-pressed', 'false');
      tools.append(rot);
      let side = 'L';
      if (ex.lato) { const sd = el('button', null, 'Lato sinistro'); sd.onclick = () => { side = side === 'L' ? 'R' : 'L'; sd.textContent = side === 'L' ? 'Lato sinistro' : 'Lato destro'; sheetViewer.show(ex, { side }); }; tools.append(sd); }
      stg.append(cv, hint, tools); inn.append(stg);
      sheetViewer = new MAN.Viewer(cv, { pal, onTouch: () => { rot.setAttribute('aria-pressed', 'false'); } });
      sheetViewer.show(ex, { side });
      rot.onclick = () => { sheetViewer.auto = !sheetViewer.auto; rot.setAttribute('aria-pressed', sheetViewer.auto); };
      const fav = S.preferiti.includes(ex.id);
      const facts = el('div', 'facts');
      const dur = holdFor(ex, P().livello, 'sera');
      [['Livello', `${LIVELLI[ex.liv]}`], ['Posizione', POS[ex.pos]], ['Durata', ex.lato ? `${dur}″ per lato` : `${dur}″`]].forEach(([a, b]) => { const f = el('div', 'fact'); f.append(el('span', null, a), el('b', null, b)); facts.append(f); });
      inn.append(facts);
      const ch = el('div', 'chips'); ex.zone.forEach(z => ch.append(el('span', 'chip tag', ZONE[z]))); ex.attr.forEach(a => ch.append(el('span', 'chip static', ATTREZZI[a]))); if (ex.tipo === 'd') ch.append(el('span', 'chip static', 'In movimento')); inn.append(ch);
      const tx = el('div', 'txt'); tx.append(el('span', 'eyebrow', 'Come si fa'), el('p', null, ex.come)); inn.append(tx);
      const tx2 = el('div', 'txt'); tx2.append(el('span', 'eyebrow', 'Attenzione a'), el('p', null, ex.consigli)); inn.append(tx2);
      const vv = el('div', 'vars'); const v1 = el('div', 'var'); v1.innerHTML = `<b>Più facile</b>${esc(ex.facile)}`; const v2 = el('div', 'var'); v2.innerHTML = `<b>Più difficile</b>${esc(ex.difficile)}`; vv.append(v1, v2); inn.append(vv);
      const f = el('div', 'row');
      const tr = el('button', 'btn grow', 'Prova ora'); tr.onclick = () => { closeSheet(true); startPlayer({ mom: 'sera', minuti: 0, items: [{ ex, dur }], total: sessionTime([{ ex, dur }]), focus: ex.zone }, { slot: null, nome: ex.nome, prova: true }); };
      const fv = el('button', 'btn soft', fav ? '♥ Preferito' : '♡ Preferito');
      fv.onclick = () => { const i = S.preferiti.indexOf(ex.id); if (i >= 0) S.preferiti.splice(i, 1); else S.preferiti.push(ex.id); save(); fv.textContent = S.preferiti.includes(ex.id) ? '♥ Preferito' : '♡ Preferito'; if (cur === 'esercizi') renderLib(); };
      f.append(tr, fv); inn.append(f);
    });
  }

  // ---------- ESERCIZI ----------
  const LF = { q: '', zona: '', liv: '', pos: '', fav: false, mine: false };
  (function initFilters() {
    const z = $('#fZona'); z.append(new Option('Tutte le zone', '')); Object.entries(ZONE).forEach(([k, v]) => z.append(new Option(v, k)));
    const p = $('#fPos'); p.append(new Option('Ogni posizione', '')); Object.entries(POS).forEach(([k, v]) => p.append(new Option(v, k)));
    $('#q').oninput = e => { LF.q = e.target.value.trim().toLowerCase(); renderLib(); };
    z.onchange = e => { LF.zona = e.target.value; renderLib(); };
    $('#fLiv').onchange = e => { LF.liv = e.target.value; renderLib(); };
    p.onchange = e => { LF.pos = e.target.value; renderLib(); };
    $('#fFav').onclick = () => { LF.fav = !LF.fav; $('#fFav').setAttribute('aria-pressed', LF.fav); renderLib(); };
    $('#fMine').onclick = () => { LF.mine = !LF.mine; $('#fMine').setAttribute('aria-pressed', LF.mine); renderLib(); };
  })();
  function renderLib() {
    const list = ES.filter(e => (!LF.q || e.nome.toLowerCase().includes(LF.q) || e.zone.some(z => ZONE[z].toLowerCase().includes(LF.q)))
      && (!LF.zona || e.zone.includes(LF.zona)) && (!LF.liv || e.liv === +LF.liv) && (!LF.pos || e.pos === LF.pos)
      && (!LF.fav || S.preferiti.includes(e.id)) && (!LF.mine || e.attr.every(a => P().attrezzi.includes(a))));
    const g = $('#lib'); g.replaceChildren();
    $('#libCount').textContent = list.length === ES.length ? `${ES.length} esercizi` : `${list.length} di ${ES.length} esercizi`;
    if (!list.length) { const e = el('div', 'empty', LF.fav ? 'Nessun preferito ancora: tocca ♡ nella scheda di un esercizio.' : 'Nessun esercizio con questi filtri.'); e.style.gridColumn = '1/-1'; g.append(e); }
    list.forEach(e => {
      const c = el('button', 'excard'); c.append(thumb(e));
      const b = el('b', null, (S.preferiti.includes(e.id) ? '♥ ' : '') + e.nome);
      const s = el('small'); s.innerHTML = `${lvDots(e.liv)} ${POS[e.pos]}${e.lato ? ' · per lato' : ''}`;
      c.append(b, s); c.onclick = () => openExercise(e); g.append(c);
    });
    flushThumbs();
  }

  // ---------- DIARIO ----------
  let calMonth = null;
  function renderDiario() {
    const n = streak(), best = bestStreak(), valid = S.storico.filter(counts);
    const mins = S.storico.reduce((s, x) => s + x.fatto, 0) / 60;
    const ym = today().slice(0, 7);
    const monthDays = Object.keys(doneDays()).filter(d => d.startsWith(ym)).length;
    const st = $('#stats'); st.replaceChildren();
    [['Giorni di fila', n, best > n ? `record ${best}` : n ? 'è il tuo record' : 'parti oggi'], ['Sessioni', valid.length, 'in totale'], ['Minuti', Math.round(mins), 'di stretching'], ['Questo mese', monthDays, monthDays === 1 ? 'giorno attivo' : 'giorni attivi']]
      .forEach(([a, b, c]) => { const d = el('div', 'stat'); d.append(el('span', null, a), el('b', null, String(b)), el('em', null, c)); st.append(d); });
    if (!calMonth) calMonth = ym;
    const [y, m] = calMonth.split('-').map(Number);
    $('#calTitle').textContent = `${MESI[m - 1][0].toUpperCase() + MESI[m - 1].slice(1)} ${y}`;
    const cal = $('#cal'); cal.replaceChildren();
    'LMMGVSD'.split('').forEach(L => cal.append(el('span', 'dn', L)));
    const first = new Date(y, m - 1, 1), off = (first.getDay() + 6) % 7, nd = new Date(y, m, 0).getDate(), dd = doneDays(), t = today();
    for (let i = 0; i < off; i++) cal.append(el('span', 'd out'));
    for (let d = 1; d <= nd; d++) { const k = `${y}-${pad(m)}-${pad(d)}`, c = dd[k] || 0; cal.append(el('span', 'd' + (c >= 2 ? ' l2' : c ? ' l1' : '') + (k === t ? ' today' : ''), String(d))); }
    $('#calPrev').onclick = () => { const d = new Date(y, m - 2, 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; renderDiario(); };
    $('#calNext').onclick = () => { const d = new Date(y, m, 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; renderDiario(); };
    const h = $('#hist'); h.replaceChildren();
    const rows = S.storico.slice().sort((a, b) => b.ts - a.ts);
    $('#histCount').textContent = rows.length ? `${rows.length}` : '';
    if (!rows.length) h.append(el('div', 'empty', 'Qui compariranno le sessioni fatte, con data e minuti.'));
    rows.slice(0, 40).forEach(s => {
      const r = el('div', 'hist-r'); const d = parse(s.data);
      r.append(el('span', 'dt', `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`), el('b', null, `${s.nome}${s.completa ? '' : ' · interrotta'}`), el('span', 'v', fmt(s.fatto)));
      h.append(r);
    });
  }
  // backup
  const backupObj = () => ({ app: 'bianski-stretch', versione: 1, esportato: new Date().toISOString(), dati: S });
  async function shareOrDownload(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    try {
      const file = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return false; }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return true;
    } catch (e) { return false; }
  }
  $('#exp').onclick = async () => { const ok = await shareOrDownload(`bianski-stretch-backup-${today()}.json`, JSON.stringify(backupObj(), null, 1), 'application/json'); toast(ok ? 'Backup pronto' : 'Non sono riuscita a creare il file: usa "Copia il mio backup"'); };
  $('#imp').onclick = () => $('#impFile').click();
  $('#impFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => importText(r.result); r.readAsText(f); e.target.value = ''; };
  $('#bkCopy').onclick = async () => { const t = JSON.stringify(backupObj()); try { await navigator.clipboard.writeText(t); toast('Backup copiato'); } catch (e) { const ta = $('#bkText'); ta.value = t; ta.select(); toast('Seleziona e copia il testo'); } };
  $('#bkPaste').onclick = () => importText($('#bkText').value);
  function importText(txt) {
    let o; try { o = JSON.parse(txt); } catch (e) { toast('Il testo non è un backup valido'); return; }
    const d = o && o.dati; if (!d || !Array.isArray(d.storico) || !d.profilo) { toast('Il file non è un backup di Bianski Stretch'); return; }
    const ids = new Set(S.storico.map(s => s.id)); let added = 0;
    d.storico.forEach(s => { if (!ids.has(s.id)) { S.storico.push(s); added++; } });
    S.profilo = { ...DEF().profilo, ...d.profilo }; S.preferiti = [...new Set([...(S.preferiti || []), ...(d.preferiti || [])])]; S.configurato = true;
    save(); $('#bkText').value = ''; render(); toast(`Backup importato: ${added} ${added === 1 ? 'sessione aggiunta' : 'sessioni aggiunte'}`);
  }

  // ---------- PROFILO ----------
  const LIV_TXT = ['', 'Tenute da 30″ ed esercizi semplici.', 'Tenute da 40″ e posizioni più profonde.', 'Tenute da 50″ e posizioni da persona molto snodata, come spaccate e ponte.'];
  function renderProfilo() {
    const pr = P();
    document.querySelectorAll('#pLiv button').forEach(b => { b.setAttribute('aria-pressed', +b.dataset.v === pr.livello); b.onclick = () => { pr.livello = +b.dataset.v; changed(); renderProfilo(); }; });
    $('#pLivTxt').textContent = LIV_TXT[pr.livello];
    const z = $('#pZone'); z.replaceChildren();
    Object.entries(ZONE).forEach(([k, v]) => { const b = el('button', 'chip', v); b.setAttribute('aria-pressed', pr.zone.includes(k)); b.onclick = () => { const i = pr.zone.indexOf(k); if (i >= 0) pr.zone.splice(i, 1); else pr.zone.push(k); changed(); b.setAttribute('aria-pressed', pr.zone.includes(k)); $('#pZoneN').textContent = pr.zone.length ? `${pr.zone.length} scelte` : 'tutte uguali'; }; z.append(b); });
    $('#pZoneN').textContent = pr.zone.length ? `${pr.zone.length} scelte` : 'tutte uguali';
    renderSlots();
    const a = $('#pAtt'); a.replaceChildren();
    Object.entries(ATTREZZI).forEach(([k, v]) => { const b = el('button', 'chip', v); b.setAttribute('aria-pressed', pr.attrezzi.includes(k)); b.onclick = () => { const i = pr.attrezzi.indexOf(k); if (i >= 0) pr.attrezzi.splice(i, 1); else pr.attrezzi.push(k); changed(); b.setAttribute('aria-pressed', pr.attrezzi.includes(k)); }; a.append(b); });
    [['#pVoce', 'voce'], ['#pSuoni', 'suoni'], ['#pWake', 'wake']].forEach(([s, k]) => { const i = $(s); i.checked = !!pr[k]; i.onchange = () => { pr[k] = i.checked; changed(); }; });
    renderReminders();
    $('#offState').textContent = navigator.serviceWorker && navigator.serviceWorker.controller ? 'Pronta per l\'uso offline su questo telefono.' : 'L\'uso offline si attiva quando l\'app è aperta dal suo indirizzo su GitHub Pages.';
  }
  function changed() { S.configurato = true; save(); }
  function renderSlots() {
    const pr = P(), box = $('#pSes'); box.replaceChildren();
    $('#pSesN').textContent = `${pr.sessioni.length} al giorno`;
    pr.sessioni.forEach((s, i) => {
      const c = el('div', 'slot');
      const h = el('div', 'slot-h');
      const sel = el('select', 'input'); sel.id = 'mom-' + s.id; sel.setAttribute('aria-label', 'Momento');
      Object.entries(MOM).forEach(([k, m]) => sel.append(new Option(m.nome, k, false, k === s.momento)));
      sel.onchange = () => { s.momento = sel.value; changed(); renderReminders(); };
      const tm = el('input', 'input'); tm.type = 'time'; tm.value = s.ora; tm.id = 'ora-' + s.id; tm.setAttribute('aria-label', 'Orario');
      tm.onchange = () => { s.ora = tm.value || s.ora; changed(); renderReminders(); };
      h.append(sel, tm);
      if (pr.sessioni.length > 1) { const x = el('button', 'x'); x.setAttribute('aria-label', 'Elimina sessione'); x.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.onclick = () => { pr.sessioni.splice(i, 1); changed(); renderSlots(); renderReminders(); }; h.append(x); }
      c.append(h);
      const d = el('div', 'dur');
      const top = el('div', 'dur-top'); const b = el('b'); b.innerHTML = `<span>${s.durata}</span><small>min</small>`; top.append(b, el('span', 'small', MOM[s.momento].txt)); d.append(top);
      const r = el('input'); r.type = 'range'; r.min = 7; r.max = 30; r.step = 1; r.value = s.durata; r.id = 'dur-' + s.id; r.setAttribute('aria-label', 'Durata in minuti'); r.style.setProperty('--p', ((s.durata - 7) / 23 * 100) + '%');
      r.oninput = () => { s.durata = +r.value; b.firstChild.textContent = r.value; r.style.setProperty('--p', ((r.value - 7) / 23 * 100) + '%'); };
      r.onchange = () => { changed(); renderReminders(); };
      d.append(r); c.append(d);
      sel.addEventListener('change', () => { top.lastChild.textContent = MOM[s.momento].txt; });
      box.append(c);
    });
    $('#pSesAdd').hidden = pr.sessioni.length >= 4;
    $('#pSesAdd').onclick = () => {
      const used = new Set(pr.sessioni.map(s => s.momento)); const k = Object.keys(MOM).find(m => !used.has(m)) || 'sera';
      let id = 1; while (pr.sessioni.some(s => s.id === 's' + id)) id++;
      pr.sessioni.push({ id: 's' + id, momento: k, ora: MOM[k].ora, durata: 10 }); changed(); renderSlots(); renderReminders();
    };
  }
  const baseURL = () => location.origin && location.origin !== 'null' ? location.origin + location.pathname : 'https://<tuo-nome>.github.io/bianski-stretch/';
  function remText(s) { return `È ora dello stretching: ${MOM[s.momento].nome.toLowerCase()}, ${s.durata} minuti`; }
  function copyRow(label, value) {
    const w = el('div', 'field'); w.append(el('span', 'lbl', label));
    const c = el('div', 'copy'); const code = el('code', null, value); const b = el('button', 'btn sm ghost', 'Copia');
    b.onclick = async () => { try { await navigator.clipboard.writeText(value); toast('Copiato'); } catch (e) { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Testo selezionato: copialo'); } };
    c.append(code, b); w.append(c); return w;
  }
  function renderReminders() {
    const box = $('#remList'); box.replaceChildren();
    P().sessioni.slice().sort((a, b) => a.ora.localeCompare(b.ora)).forEach(s => {
      const c = el('div', 'slot'); c.append(el('b', null, `${MOM[s.momento].nome} · ore ${s.ora}`));
      c.append(copyRow('Testo della notifica', remText(s)), copyRow('Link della sessione (per "Apri URL")', `${baseURL()}?sessione=${s.id}`));
      box.append(c);
    });
  }
  $('#ics').onclick = async () => {
    const dt = today().replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    let t = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Bianski Stretch//IT\r\nCALSCALE:GREGORIAN\r\n';
    P().sessioni.forEach(s => {
      const [h, m] = s.ora.split(':'); const end = addMin(s.ora, s.durata).replace(':', '');
      t += `BEGIN:VEVENT\r\nUID:bianski-${s.id}-${dt}@bianski-stretch\r\nDTSTAMP:${stamp}\r\nDTSTART:${dt}T${h}${m}00\r\nDTEND:${dt}T${end}00\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Stretching · ${MOM[s.momento].nome}\r\nDESCRIPTION:${s.durata} minuti con Bianski Stretch\\n${baseURL()}?sessione=${s.id}\r\nURL:${baseURL()}?sessione=${s.id}\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${remText(s)}\r\nTRIGGER:PT0M\r\nEND:VALARM\r\nEND:VEVENT\r\n`;
    });
    t += 'END:VCALENDAR\r\n';
    const ok = await shareOrDownload('bianski-stretch-promemoria.ics', t, 'text/calendar');
    if (!ok) toast('Non sono riuscita a creare il file del calendario');
  };

  // ---------- PLAYER ----------
  let PL = null;
  let actx = null;
  function chime(freq = 660, dur = 0.35, vol = 0.18) {
    if (!P().suoni || !actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { }
  }
  let itVoice = null;
  function speak(txt) {
    if (!P().voce || !('speechSynthesis' in window)) return;
    try {
      if (!itVoice) { const vs = speechSynthesis.getVoices(); itVoice = vs.find(v => /it[-_]IT/i.test(v.lang) && /alice|federica|female|donna/i.test(v.name)) || vs.find(v => /^it/i.test(v.lang)) || null; }
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'it-IT'; if (itVoice) u.voice = itVoice; u.rate = 0.98; speechSynthesis.speak(u);
    } catch (e) { }
  }
  let wakeLock = null;
  async function lockScreen() { if (!P().wake || !('wakeLock' in navigator)) return; try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { } }
  document.addEventListener('visibilitychange', () => { if (PL && document.visibilityState === 'visible') lockScreen(); });

  function startPlayer(ses, meta) {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (e) { }
    if (P().voce && 'speechSynthesis' in window) { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { } }
    const steps = [];
    ses.items.forEach((it, i) => {
      const sides = it.ex.lato ? ['L', 'R'] : ['L'];
      sides.forEach((sd, j) => steps.push({ it, side: sd, j, prep: j > 0 ? SWITCH : i === 0 ? PREP_FIRST : PREP + (ses.items[i - 1].ex.pos !== it.ex.pos ? MOVE : 0), hold: it.dur }));
    });
    const total = steps.reduce((s, x) => s + x.prep + x.hold, 0);
    PL = { ses, meta, steps, i: 0, phase: 'prep', left: steps[0].prep, el: 0, paused: false, doneSecs: 0, total, last: performance.now(), start: Date.now(), ended: false };
    const pl = $('#player'); pl.hidden = false; document.body.style.overflow = 'hidden';
    pl.innerHTML = `<div class="pl-in">
      <div class="pl-top"><button class="x" id="plX" aria-label="Chiudi"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="pl-prog" id="plProg"></div><span class="small num" id="plLeft"></span></div>
      <div class="pl-stage"><canvas id="plCv" role="img" aria-label="Manichino 3D, trascina per girarlo"></canvas><span class="pl-badge" id="plBadge"></span></div>
      <div class="pl-info"><h3 id="plName"></h3><div class="ring"><svg viewBox="0 0 86 86"><circle cx="43" cy="43" r="38" fill="none" stroke="var(--surface-3)" stroke-width="7"/><circle id="plRing" cx="43" cy="43" r="38" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="238.8" stroke-dashoffset="0"/></svg><b id="plSec"></b></div><p id="plCue"></p></div>
      <div class="pl-next" id="plNext"></div>
      <div class="pl-ctrl"><button class="iconbtn" id="plPrev" aria-label="Indietro"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button><button class="play" id="plPlay" aria-label="Pausa"></button><button class="iconbtn" id="plSkip" aria-label="Avanti"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button></div>
    </div>`;
    const prog = $('#plProg'); ses.items.forEach(() => prog.append(el('i')));
    PL.viewer = new MAN.Viewer($('#plCv'), { pal });
    PL.viewer.mode = 'ext';
    $('#plX').onclick = () => endPlayer(false);
    $('#plPlay').onclick = () => { PL.paused = !PL.paused; setPlayIcon(); if (!PL.paused) PL.last = performance.now(); };
    $('#plPrev').onclick = () => { const s = PL.steps[PL.i]; if (PL.phase === 'hold' && s.hold - PL.left > 3) enterStep(PL.i, 'hold'); else enterStep(Math.max(0, PL.i - 1), 'prep'); };
    $('#plSkip').onclick = () => { if (PL.phase === 'prep') enterStep(PL.i, 'hold'); else nextStep(); };
    setPlayIcon(); lockScreen();
    enterStep(0, 'prep');
    PL.raf = requestAnimationFrame(tick);
  }
  function setPlayIcon() { $('#plPlay').innerHTML = PL.paused ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>'; $('#plPlay').setAttribute('aria-label', PL.paused ? 'Riprendi' : 'Pausa'); }
  function enterStep(i, phase) {
    const prevSide = PL.steps[PL.i] && PL.steps[PL.i].side, prevEx = PL.steps[PL.i] && PL.steps[PL.i].it.ex.id;
    PL.i = i; PL.phase = phase; const s = PL.steps[i];
    PL.left = phase === 'prep' ? s.prep : s.hold; PL.el = 0;
    const sameEx = prevEx === s.it.ex.id && PL.viewer.ex;
    PL.viewer.show(s.it.ex, { side: s.side, keepView: !!sameEx });
    if (sameEx && prevSide !== s.side) PL.viewer.yaw = -PL.viewer.yaw;
    const ex = s.it.ex;
    $('#plName').textContent = ex.nome + (s.it.serie ? ' · 2ª serie' : '');
    $('#plCue').textContent = ex.come;
    const badge = $('#plBadge');
    if (phase === 'prep') { badge.className = 'pl-badge prep'; badge.textContent = s.j > 0 ? 'Cambia lato' : i === 0 ? 'Preparati' : 'Prossimo'; }
    else { badge.className = 'pl-badge'; badge.textContent = ex.lato ? (s.side === 'L' ? 'Lato sinistro' : 'Lato destro') : ex.tipo === 'd' ? 'In movimento' : 'Tieni'; }
    const nx = PL.steps.slice(i + 1).find(x => x.it !== s.it);
    $('#plNext').textContent = nx ? `Dopo: ${nx.it.ex.nome}` : 'Ultimo esercizio';
    if (phase === 'prep') { speak(s.j > 0 ? 'Cambia lato' : `${i === 0 ? '' : 'Prossimo: '}${ex.nome}${ex.lato ? ', lato sinistro' : ''}`); chime(s.j > 0 ? 520 : 600, 0.3, 0.12); }
    else chime(880, 0.45, 0.16);
    updateUI();
  }
  function nextStep() {
    if (PL.phase === 'prep') { enterStep(PL.i, 'hold'); return; }
    if (PL.i + 1 >= PL.steps.length) { endPlayer(true); return; }
    enterStep(PL.i + 1, 'prep');
  }
  function tick(now) {
    if (!PL || PL.ended) return;
    PL.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.5, (now - PL.last) / 1000); PL.last = now;
    if (!PL.paused) {
      PL.left -= dt; PL.el += dt; PL.doneSecs += dt;
      const sec = Math.ceil(PL.left);
      if (PL.phase === 'hold' && sec <= 3 && sec >= 1 && sec !== PL.lastBeep) { PL.lastBeep = sec; chime(440, 0.12, 0.08); }
      if (PL.left <= 0) { PL.lastBeep = null; nextStep(); if (!PL || PL.ended) return; }
    }
    // posa del manichino
    const s = PL.steps[PL.i], ex = s.it.ex, e = PL.el;
    let t;
    if (PL.phase === 'prep') t = s.j > 0 ? 0 : 0;
    else if (ex.tipo === 'd') t = (1 - Math.cos(e / 3.6 * Math.PI * 2)) / 2;
    else { const a = Math.min(1, e / 3); t = (1 - Math.cos(Math.PI * a)) / 2; if (a >= 1) t = 1 - 0.035 * Math.sin((e - 3) * 0.9) ** 2; }
    PL.viewer.t = t;
    updateUI();
  }
  function updateUI() {
    const s = PL.steps[PL.i], full = PL.phase === 'prep' ? s.prep : s.hold, left = Math.max(0, PL.left);
    $('#plSec').textContent = Math.ceil(left);
    $('#plRing').style.strokeDashoffset = 238.8 * (1 - left / full);
    $('#plRing').style.stroke = PL.phase === 'prep' ? 'var(--lilla)' : 'var(--accent)';
    const idx = PL.ses.items.indexOf(s.it);
    const its = PL.steps.filter(x => x.it === s.it); const tot = its.reduce((a, x) => a + x.hold, 0);
    const doneIn = its.slice(0, its.indexOf(s)).reduce((a, x) => a + x.hold, 0) + (PL.phase === 'hold' ? s.hold - left : 0);
    [...$('#plProg').children].forEach((b, k) => { b.className = k < idx ? 'done' : k === idx ? 'cur' : ''; if (k === idx) b.style.setProperty('--p', (doneIn / tot * 100) + '%'); });
    const rem = PL.steps.slice(PL.i + 1).reduce((a, x) => a + x.prep + x.hold, 0) + left + (PL.phase === 'prep' ? s.hold : 0);
    $('#plLeft').textContent = fmt(rem);
  }
  function endPlayer(complete) {
    if (!PL || PL.ended) return;
    PL.ended = true; cancelAnimationFrame(PL.raf);
    try { speechSynthesis.cancel(); } catch (e) { }
    if (wakeLock) { wakeLock.release().catch(() => { }); wakeLock = null; }
    const fatto = Math.round(PL.doneSecs), previsto = PL.total;
    const before = streak();
    let saved = false;
    if (!PL.meta.prova && (complete || fatto >= 60)) {
      const ids = [...new Set(PL.steps.slice(0, complete ? PL.steps.length : PL.i + (PL.phase === 'hold' ? 1 : 0)).map(x => x.it.ex.id))];
      S.storico.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, data: today(), ts: Date.now(), slot: PL.meta.slot, nome: PL.meta.nome, momento: PL.ses.mom, previsto, fatto: complete ? previsto : fatto, completa: !!complete, esercizi: ids });
      save(); saved = true;
    }
    PL.viewer.destroy();
    const n = streak();
    const pl = $('#player');
    if (!saved) { const prova = PL.meta.prova; closePlayer(); if (!complete && !prova) toast('Sessione chiusa: sotto il minuto non la salvo'); return; }
    if (complete) speak(n > before ? `Brava! ${n === 1 ? 'Primo giorno' : n + ' giorni di fila'}.` : 'Brava, sessione completata.');
    pl.innerHTML = `<div class="pl-in"><div class="end">
      <svg width="120" height="120" viewBox="-70 -70 140 140" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map(i => `<path transform="rotate(${i * 360 / 7})" d="M0,-20 C 15,-30 16,-52 0,-66 C -16,-52 -15,-30 0,-20 Z" fill="var(--accent)" opacity="${0.45 + i * 0.08}"/>`).join('')}<circle r="22" fill="var(--surface)"/></svg>
      <h2>${complete ? 'Brava!' : 'Ben fatto'}</h2>
      <p class="muted" style="margin:0;max-width:34ch">${complete ? `${esc(PL.meta.nome)} completata.` : `Hai fatto ${fmt(fatto)} di ${esc(PL.meta.nome.toLowerCase())}.`} ${counts(S.storico[S.storico.length - 1]) ? (n > before ? 'Il fiore di oggi è sbocciato.' : '') : 'Per contare nei giorni di fila serve almeno il 60% della sessione.'}</p>
      <div class="stats"><div><b>${Math.round((complete ? previsto : fatto) / 60)}</b><span>minuti</span></div><div><b>${n}</b><span>${n === 1 ? 'giorno di fila' : 'giorni di fila'}</span></div></div>
      <button class="btn" id="plDone" style="min-width:200px">Chiudi</button></div></div>`;
    $('#plDone').onclick = closePlayer;
  }
  function closePlayer() { const pl = $('#player'); pl.hidden = true; pl.innerHTML = ''; document.body.style.overflow = ''; PL = null; render(); }

  // ---------- avvio ----------
  go('oggi');
  // link diretto a una sessione (Comandi Rapidi): ?sessione=s1 oppure #sessione-s1
  (function deepLink() {
    let id = null;
    try { id = new URLSearchParams(location.search).get('sessione'); } catch (e) { }
    const m = (location.hash || '').match(/^#sessione-(\w+)$/); if (!id && m) id = m[1];
    const slot = id && P().sessioni.find(s => s.id === id);
    if (slot) openPlan(sessionFor(slot), slot);
  })();
  if ('serviceWorker' in navigator && location.protocol === 'https:') { try { navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { } }

  // per i test
  window.__bianski = { buildSession, sessionTime, streak, S: () => S, go, openExercise, openPlan, startPlayer, sessionFor, PL: () => PL };
})();
