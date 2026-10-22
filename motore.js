/* Bianski Stretch — motore del manichino 3D (nessuna libreria esterna, funziona offline).
   Assi: Y in alto; il manichino guarda verso +Z; la sua sinistra è +X. Misure in metri.

   Una posa è un oggetto con questi campi (tutti facoltativi, angoli in gradi):
     r:  [x, z, beccheggio, imbardata, rollio, giro]   bacino: posizione a terra e orientamento
                                                beccheggio + = si inclina in avanti (90 = prona, -90 = supina)
                                                imbardata + = ruota verso la sua sinistra; rollio + = si inclina verso destra; giro = rotazione sul proprio asse lungo (+ verso sinistra)
     y:  altezza fissa del bacino (solo se è seduta su un supporto; altrimenti il manichino si appoggia da solo a terra)
     sp: [flessione, lato, torsione]            colonna; flessione + = in avanti, lato + = verso destra, torsione + = verso sinistra
     nk: [flessione, lato, torsione]            collo
     aL / aR: [flessione, abduzione, orizzontale, rotazione, gomito]   braccia
                flessione + = avanti/su (180 = sopra la testa), abduzione + = di lato, orizzontale + = davanti al corpo
     lL / lR: [flessione, abduzione, orizzontale, rotazione, ginocchio, caviglia]   gambe
                flessione + = gamba in avanti, ginocchio + = si piega, caviglia + = punta tesa
*/
(function (root) {
  'use strict';
  const D = Math.PI / 180;
  // ---------- matrici 3×3 (righe) ----------
  const Rx = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const Ry = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const Rz = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  function mul(A, B) {
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return o;
  }
  const M = (...ms) => ms.reduce(mul);
  const ap = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const at = (P, R, v) => add(P, ap(R, v));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ---------- posa di riposo e utilità ----------
  const REST = { r: [0, 0, 0, 0, 0, 0], sp: [0, 0, 0], nk: [0, 0, 0], aL: [0, 8, 0, 0, 12], aR: [0, 8, 0, 0, 12], lL: [0, 3, 0, 4, 0, 0], lR: [0, 3, 0, 4, 0, 0] };
  const KEYS = ['r', 'sp', 'nk', 'aL', 'aR', 'lL', 'lR'];
  function full(p) {
    const o = {};
    for (const k of KEYS) { const d = REST[k], v = (p && p[k]) || []; o[k] = d.map((x, i) => v[i] == null ? x : v[i]); }
    if (p && p.y != null) o.y = p.y;
    if (p && p.su) o.su = [].concat(p.su);
    return o;
  }
  function lerp(A, B, t) {
    const o = {};
    for (const k of KEYS) o[k] = A[k].map((x, i) => x + (B[k][i] - x) * t);
    if (A.y != null || B.y != null) { const ya = A.y != null ? A.y : B.y, yb = B.y != null ? B.y : A.y; o.y = ya + (yb - ya) * t; }
    if (A.su || B.su) o.su = (A.su && B.su) ? A.su.map((s, i) => B.su[i] ? { ...s, h: s.h + (B.su[i].h - s.h) * t } : s) : (t < 0.5 ? A.su : B.su) || undefined;
    if (!o.su) delete o.su;
    return o;
  }
  // lato opposto: scambia destra e sinistra
  function mirror(p) {
    const o = { r: [-p.r[0], p.r[1], p.r[2], -p.r[3], -p.r[4], -p.r[5]], sp: [p.sp[0], -p.sp[1], -p.sp[2]], nk: [p.nk[0], -p.nk[1], -p.nk[2]], aL: p.aR.slice(), aR: p.aL.slice(), lL: p.lR.slice(), lR: p.lL.slice() };
    if (p.y != null) o.y = p.y;
    if (p.su) o.su = p.su.map(s => ({ ...s, a: swapLR(s.a), b: s.b ? swapLR(s.b) : s.b }));
    return o;
  }
  const swapLR = s => s.replace(/L$/, '§').replace(/R$/, 'L').replace(/§$/, 'R');
  function mirrorProps(props) {
    return (props || []).map(q => {
      const o = JSON.parse(JSON.stringify(q));
      if (o.p) o.p[0] = -o.p[0];
      if (o.a && Array.isArray(o.a)) o.a[0] = -o.a[0];
      if (o.b && Array.isArray(o.b)) o.b[0] = -o.b[0];
      if (typeof o.a === 'string') o.a = swapLR(o.a);
      if (typeof o.b === 'string') o.b = swapLR(o.b);
      if (o.rot) o.rot = -o.rot;
      if (o.nx != null) o.nx = -o.nx;
      if (o.at) { o.at = { ...o.at, a: swapLR(o.at.a), b: o.at.b ? swapLR(o.at.b) : o.at.b }; }
      if (o.dx) o.dx = -o.dx;
      return o;
    });
  }

  // ---------- cinematica: dalla posa ai pezzi del manichino ----------
  function build(pose) {
    const p = full(pose);
    const [px, pz, pitch, yaw, roll, spin] = p.r;
    const R0 = M(Ry(yaw), Rx(pitch), Rz(roll), Ry(spin));
    const O = [px, 0, pz];
    const J = {};
    J.hipL = at(O, R0, [0.085, 0, 0]); J.hipR = at(O, R0, [-0.085, 0, 0]);
    J.pelvis = O;
    const B0 = at(O, R0, [0, 0.04, -0.005]);
    const R1 = M(R0, Rx(p.sp[0] / 2), Rz(p.sp[1] / 2), Ry(p.sp[2] / 2));
    J.waist = at(B0, R1, [0, 0.19, 0]);
    const R2 = M(R1, Rx(p.sp[0] / 2), Rz(p.sp[1] / 2), Ry(p.sp[2] / 2));
    J.chest = at(J.waist, R2, [0, 0.2, 0.01]);
    J.neck = at(J.waist, R2, [0, 0.29, 0]);
    J.shL = at(J.waist, R2, [0.16, 0.255, 0]); J.shR = at(J.waist, R2, [-0.16, 0.255, 0]);
    const R3 = M(R2, Rx(p.nk[0]), Rz(p.nk[1]), Ry(p.nk[2]));
    J.neckTop = at(J.neck, R3, [0, 0.075, 0.005]);
    J.head = at(J.neckTop, R3, [0, 0.1, 0.015]);
    J.bun = at(J.head, R3, [0, 0.055, -0.095]);
    J.nose = at(J.head, R3, [0, -0.005, 0.098]);
    const arm = (side, a) => {
      const s = side === 'L' ? 1 : -1;
      const Ra = M(R2, Ry(-s * a[2]), Rx(-a[0]), Rz(s * a[1]), Ry(s * a[3]));
      const S = J['sh' + side];
      const E = at(S, Ra, [0, -0.28, 0]);
      const Rf = M(Ra, Rx(-a[4]));
      const W = at(E, Rf, [0, -0.245, 0]);
      J['el' + side] = E; J['wr' + side] = W; J['hand' + side] = at(W, Rf, [0, -0.085, 0]);
    };
    const leg = (side, l) => {
      const s = side === 'L' ? 1 : -1;
      const Rl = M(R0, Ry(-s * l[2]), Rx(-l[0]), Rz(s * l[1]), Ry(s * l[3]));
      const H = J['hip' + side];
      const K = at(H, Rl, [0, -0.43, 0]);
      const Rs = M(Rl, Rx(l[4]));
      const A = at(K, Rs, [0, -0.42, 0]);
      const Rf = M(Rs, Rx(l[5]));
      J['kn' + side] = K; J['an' + side] = A;
      J['heel' + side] = at(A, Rf, [0, -0.036, -0.045]);
      J['foot' + side] = at(A, Rf, [0, -0.04, 0.15]);
    };
    arm('L', p.aL); arm('R', p.aR); leg('L', p.lL); leg('R', p.lR);

    // pezzi: capsule rastremate [a, b, raggio a, raggio b] e sfere
    const C = (a, b, ra, rb, part) => ({ t: 'cap', a: J[a], b: J[b], ra, rb, part });
    const S = (c, r, part) => ({ t: 'sph', c: J[c], r, part });
    const prims = [
      C('hipL', 'hipR', 0.098, 0.098, 'body'),
      { t: 'cap', a: at(O, R0, [0, 0.03, 0]), b: J.waist, ra: 0.118, rb: 0.088, part: 'body' },
      { t: 'cap', a: J.waist, b: J.chest, ra: 0.092, rb: 0.112, part: 'body' },
      C('shL', 'shR', 0.058, 0.058, 'body'),
      C('neck', 'neckTop', 0.04, 0.038, 'body'),
      S('head', 0.098, 'head'), S('bun', 0.048, 'hair'),
    ];
    for (const s of ['L', 'R']) {
      prims.push(
        C('hip' + s, 'kn' + s, 0.074, 0.05, 'leg' + s), C('kn' + s, 'an' + s, 0.05, 0.032, 'leg' + s),
        C('heel' + s, 'foot' + s, 0.034, 0.03, 'leg' + s),
        C('sh' + s, 'el' + s, 0.044, 0.034, 'arm' + s), C('el' + s, 'wr' + s, 0.034, 0.025, 'arm' + s),
        C('wr' + s, 'hand' + s, 0.027, 0.022, 'arm' + s));
    }
    // appoggio a terra: il punto più basso tocca il pavimento (y = 0), salvo altezza fissa
    let dy;
    if (p.y != null) dy = p.y;
    else {
      let minY = 1e9;
      for (const q of prims) {
        if (q.t === 'cap') minY = Math.min(minY, q.a[1] - q.ra, q.b[1] - q.rb);
        else minY = Math.min(minY, q.c[1] - q.r);
      }
      dy = -minY;
      // appoggi: un punto del corpo resta almeno a una certa altezza (rullo, blocco, cuscino)
      for (const s of p.su || []) { const A = J[s.a], B = J[s.b || s.a], f = s.f == null ? 0.5 : s.f; dy = Math.max(dy, s.h - (A[1] + (B[1] - A[1]) * f)); }
    }
    const shift = v => { v[1] += dy; };
    for (const k in J) shift(J[k]);
    // le capsule del tronco create con at() non sono in J: spostale una volta sola
    const seen = new Set();
    for (const q of prims) for (const v of q.t === 'cap' ? [q.a, q.b] : [q.c]) { if (!Object.values(J).includes(v) && !seen.has(v)) { seen.add(v); shift(v); } }
    return { J, prims };
  }

  // ---------- oggetti di scena ----------
  // {t:'wall', z|x: posizione}  {t:'box', p:[x,y,z], s:[larghezza,altezza,profondità], rot, c:'chair'|'block'|'step'}
  // {t:'strap', a:'handL', b:'footL'}  {t:'roller', a:[x,y,z], b:[x,y,z]}  {t:'ball', p:[x,y,z]}  {t:'chair', p:[x,z], rot}
  function sceneProps(props, J) {
    const out = [];
    const pt = v => typeof v === 'string' ? J[v] : v;
    for (let q of props || []) {
      if (q.at) {
        const A = J[q.at.a], B = J[q.at.b || q.at.a], f = q.at.f == null ? 0.5 : q.at.f;
        const c = [A[0] + (B[0] - A[0]) * f + (q.dx || 0), 0, A[2] + (B[2] - A[2]) * f + (q.dz || 0)];
        if (q.t === 'box') q = { ...q, p: [c[0], q.s[1] / 2, c[2]], rot: q.rot != null ? q.rot : Math.atan2(B[0] - A[0], B[2] - A[2]) / D };
        else if (q.t === 'ball') q = { ...q, p: [c[0], q.r || 0.045, c[2]] };
        else if (q.t === 'roller') {
          let dx = B[0] - A[0], dz = B[2] - A[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const ax = q.axis === 'x' ? [1, 0] : q.axis === 'z' ? [0, 1] : [-dz, dx];
          q = { ...q, a: [c[0] - ax[0] * 0.3, 0.075, c[2] - ax[1] * 0.3], b: [c[0] + ax[0] * 0.3, 0.075, c[2] + ax[1] * 0.3] };
        }
      }
      if (q.t === 'wall') out.push({ t: 'wall', axis: q.x != null ? 'x' : 'z', v: q.x != null ? q.x : q.z });
      else if (q.t === 'box') out.push({ t: 'box', p: q.p, s: q.s, rot: q.rot || 0, c: q.c || 'block' });
      else if (q.t === 'chair') {
        const [x, z] = q.p, r = q.rot || 0, h = q.h || 0.46;
        const R = Ry(r), o = (v) => add([x, 0, z], ap(R, v));
        out.push({ t: 'box', p: o([0, h - 0.025, 0]), s: [0.44, 0.05, 0.42], rot: r, c: 'chair' });
        out.push({ t: 'box', p: o([0, h + 0.22, -0.2]), s: [0.42, 0.4, 0.04], rot: r, c: 'chair' });
        for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) out.push({ t: 'cap', a: o([lx, 0.01, lz]), b: o([lx, h - 0.05, lz]), ra: 0.018, rb: 0.018, part: 'chair' });
      } else if (q.t === 'strap') out.push({ t: 'strap', a: pt(q.a), b: pt(q.b) });
      else if (q.t === 'roller') out.push({ t: 'cap', a: q.a, b: q.b, ra: 0.075, rb: 0.075, part: 'roller' });
      else if (q.t === 'ball') out.push({ t: 'sph', c: q.p, r: q.r || 0.04, part: 'ball' });
    }
    return out;
  }

  // ---------- telecamera e proiezione ----------
  function camera(target, yaw, pitch, dist, w, h, fov = 34) {
    const cp = Math.cos(pitch * D);
    const C = [target[0] + dist * Math.sin(yaw * D) * cp, target[1] + dist * Math.sin(pitch * D), target[2] + dist * Math.cos(yaw * D) * cp];
    const f = norm(sub(target, C));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    const F = (Math.min(w, h * 1.15) / 2) / Math.tan(fov / 2 * D);
    return {
      C, f, r, u, F, w, h, dist,
      proj(p) { const v = sub(p, C); const z = dot(v, f); return [w / 2 + F * dot(v, r) / z, h / 2 - F * dot(v, u) / z, z]; },
    };
  }

  // ---------- colori ----------
  function hex(c) { c = c.trim(); if (c[0] === '#') { if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; } const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [200, 120, 150]; }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, al = 1) => al >= 1 ? `rgb(${c.map(Math.round).join(',')})` : `rgba(${c.map(Math.round).join(',')},${al})`;

  // ---------- scena → lista di forme 2D ordinate per profondità ----------
  // pal: { body, light, dark, hair, mat, matEdge, floor, shadow, wall, wood, block, strap, roller, ball }
  function drawList(pose, props, view, w, h, pal) {
    const { J, prims } = build(pose);
    const items = prims.concat(sceneProps(props, J));
    const cam = camera(view.target, view.yaw, view.pitch, view.dist, w, h);
    const out = [];
    const P = pal;
    // pavimento: ombra morbida e tappetino
    const ring = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; ring.push(cam.proj([view.target[0] + Math.cos(a) * 1.25, 0, view.target[2] + Math.sin(a) * 1.25])); }
    out.push({ k: 'poly', pts: ring, fill: P.floor, a: 1 });
    if (view.mat) {
      const { cx, cz, len, ang } = view.mat;
      const ca = Math.cos(ang * D), sa = Math.sin(ang * D);
      const c4 = [[-0.31, -len / 2], [0.31, -len / 2], [0.31, len / 2], [-0.31, len / 2]].map(([a, b]) => cam.proj([cx + a * ca + b * sa, 0.002, cz - a * sa + b * ca]));
      out.push({ k: 'poly', pts: c4, fill: P.mat, a: 1, stroke: P.matEdge });
    }
    // ombre proiettate sul pavimento
    for (const q of items) {
      if (q.t === 'cap' && q.part !== 'chair') { const a = cam.proj([q.a[0], 0.004, q.a[2]]), b = cam.proj([q.b[0], 0.004, q.b[2]]); out.push({ k: 'cap', a, b, ra: q.ra * cam.F / a[2] * 0.95, rb: q.rb * cam.F / b[2] * 0.95, flat: P.shadow, al: 0.16 }); }
      else if (q.t === 'sph') { const c = cam.proj([q.c[0], 0.004, q.c[2]]); out.push({ k: 'cap', a: c, b: c, ra: q.r * cam.F / c[2], rb: q.r * cam.F / c[2], flat: P.shadow, al: 0.16 }); }
    }
    // oggetti 3D
    const solid = [];
    const depthOf = v => dot(sub(v, cam.C), cam.f);
    const tgtDepth = depthOf(view.target);
    const tone = (base, z) => { const k = Math.max(-1, Math.min(1, (z - tgtDepth) / 0.7)); return mix(base, k > 0 ? P.dark : P.light, Math.abs(k) * (k > 0 ? 0.5 : 0.25)); };
    for (const q of items) {
      if (q.t === 'cap' || q.t === 'sph') {
        const a = cam.proj(q.t === 'cap' ? q.a : q.c), b = q.t === 'cap' ? cam.proj(q.b) : a;
        const ra = (q.t === 'cap' ? q.ra : q.r) * cam.F / a[2], rb = (q.t === 'cap' ? q.rb : q.r) * cam.F / b[2];
        const base = q.part === 'hair' ? P.hair : q.part === 'chair' ? P.wood : q.part === 'roller' ? P.roller : q.part === 'ball' ? P.ball : P.body;
        // per le capsule lunghe la profondità è quella del punto più vicino alla telecamera, così il tronco copre gli arti dietro
        const z = q.t === 'sph' ? a[2] - (q.r * 0.6) : (a[2] + b[2]) / 2;
        solid.push({ z, k: 'cap', a, b, ra, rb, col: tone(base, z), sph: q.t === 'sph' });
      } else if (q.t === 'strap') {
        const a = cam.proj(q.a), b = cam.proj(q.b);
        solid.push({ z: Math.min(a[2], b[2]) - 0.02, k: 'line', a, b, col: P.strap, wpx: 0.022 * cam.F / ((a[2] + b[2]) / 2) });
      } else if (q.t === 'box') {
        const [x, y, z] = q.p, [sx, sy, sz] = q.s; const R = Ry(q.rot);
        const v = []; for (const dx of [-1, 1]) for (const dyy of [-1, 1]) for (const dz of [-1, 1]) v.push(add([x, y, z], ap(R, [dx * sx / 2, dyy * sy / 2, dz * sz / 2])));
        const faces = [[0, 1, 3, 2, [-1, 0, 0]], [4, 6, 7, 5, [1, 0, 0]], [0, 4, 5, 1, [0, -1, 0]], [2, 3, 7, 6, [0, 1, 0]], [0, 2, 6, 4, [0, 0, -1]], [1, 5, 7, 3, [0, 0, 1]]];
        const base = q.c === 'chair' || q.c === 'step' ? P.wood : q.c === 'cushion' ? (P.cushion || P.block) : P.block;
        for (const [i0, i1, i2, i3, n] of faces) {
          const N = ap(R, n); const ctr = [x + N[0] * sx / 2, y + N[1] * sy / 2, z + N[2] * sz / 2];
          if (dot(N, sub(cam.C, ctr)) <= 0) continue;
          const lit = 0.55 + 0.45 * Math.max(0, dot(N, norm([-0.4, 0.8, 0.45])));
          solid.push({ z: depthOf([x, y, z]) + 0.001, k: 'poly', pts: [v[i0], v[i1], v[i2], v[i3]].map(cam.proj), fill: css(mix(P.dark, base, lit)), a: 1 });
        }
      } else if (q.t === 'wall') {
        const s = 1.0, H = 1.7, tx = view.target[0], tz = view.target[2];
        const pts = q.axis === 'z' ? [[tx - s, 0, q.v], [tx + s, 0, q.v], [tx + s, H, q.v], [tx - s, H, q.v]] : [[q.v, 0, tz - s], [q.v, 0, tz + s], [q.v, H, tz + s], [q.v, H, tz - s]];
        const pp = pts.map(cam.proj);
        if (pp.some(p => p[2] < 0.2)) continue;
        const zc = depthOf(q.axis === 'z' ? [tx, 0.8, q.v] : [q.v, 0.8, tz]);
        const front = zc < tgtDepth;
        solid.push({ z: front ? -1e9 : 1e9, k: 'poly', pts: pp, fill: P.wall, a: front ? 0.2 : 0.9, stroke: P.matEdge });
      }
    }
    solid.sort((a, b) => b.z - a.z);
    return { list: out.concat(solid), cam, J };
  }

  // ---------- disegno su canvas ----------
  function capPath(g, a, b, ra, rb, begin = true) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (begin) g.beginPath();
    if (L < 0.5 || L < Math.abs(ra - rb)) { const r = Math.max(ra, rb), c = L < 0.5 ? a : (ra > rb ? a : b); g.moveTo(c[0] + Math.max(r, .5), c[1]); g.arc(c[0], c[1], Math.max(r, 0.5), 0, Math.PI * 2); g.closePath(); return; }
    const ang = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / L)));
    g.moveTo(a[0] + Math.max(ra, .3) * Math.cos(ang + al), a[1] + Math.max(ra, .3) * Math.sin(ang + al));
    g.arc(a[0], a[1], Math.max(ra, 0.3), ang + al, ang - al + Math.PI * 2);
    g.arc(b[0], b[1], Math.max(rb, 0.3), ang - al, ang + al);
    g.closePath();
  }
  function paint(ctx, dl, pal) {
    // ombre: un'unica forma riempita una volta sola, così non si scuriscono dove si sovrappongono
    const sh = dl.list.filter(s => s.flat);
    if (sh.length) {
      ctx.save(); ctx.globalAlpha = 0.13; ctx.fillStyle = css(sh[0].flat);
      ctx.beginPath();
      for (const s of sh) capPath(ctx, s.a, s.b, s.ra, s.rb, false);
      ctx.fill('nonzero'); ctx.restore();
    }
    for (const s of dl.list) {
      if (s.k === 'poly') {
        ctx.globalAlpha = s.a; ctx.beginPath(); s.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        ctx.fillStyle = Array.isArray(s.fill) ? css(s.fill) : s.fill; ctx.fill();
        if (s.stroke) { ctx.strokeStyle = Array.isArray(s.stroke) ? css(s.stroke) : s.stroke; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.globalAlpha = 1;
      } else if (s.k === 'line') {
        ctx.strokeStyle = css(s.col); ctx.lineWidth = Math.max(1.5, s.wpx); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); ctx.stroke();
      } else if (s.k === 'cap') {
        if (s.flat) continue;
        capPath(ctx, s.a, s.b, s.ra, s.rb);
        // ombreggiatura cilindrica: chiaro dal lato della luce (in alto a sinistra), scuro dall'altro
        const mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2, r = Math.max(s.ra, s.rb);
        let nx, ny;
        if (s.sph || Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < 1) { nx = -0.6; ny = -0.8; }
        else { const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); nx = -(s.b[1] - s.a[1]) / L; ny = (s.b[0] - s.a[0]) / L; if (nx * -0.6 + ny * -0.8 < 0) { nx = -nx; ny = -ny; } }
        const g = s.sph ? ctx.createRadialGradient(mx + nx * r * 0.45, my + ny * r * 0.45, r * 0.1, mx, my, r * 1.05)
          : ctx.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
        g.addColorStop(0, css(mix(s.col, pal.light, 0.55)));
        g.addColorStop(s.sph ? 0.5 : 0.35, css(s.col));
        g.addColorStop(1, css(mix(s.col, pal.dark, 0.38)));
        ctx.fillStyle = g; ctx.fill();
      }
    }
  }

  // ---------- inquadratura: centro e distanza in base all'ingombro delle pose ----------
  function frame(poses, props) {
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of poses) {
      const { J } = build(p);
      const pts = Object.values(J);
      for (const q of props || []) { if (q.t === 'box' && q.p) pts.push(q.p); if (q.t === 'chair') pts.push([q.p[0], 0.5, q.p[1]]); }
      for (const v of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], v[i]); hi[i] = Math.max(hi[i], v[i]); }
    }
    lo[1] = 0;
    const c = [(lo[0] + hi[0]) / 2, (hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const ext = Math.max(hi[0] - lo[0], hi[1] * 1.25, hi[2] - lo[2]) + 0.35;
    // tappetino lungo la direzione più estesa
    const dx = hi[0] - lo[0], dz = hi[2] - lo[2];
    const mat = { cx: c[0], cz: c[2], len: Math.max(1.75, Math.max(dx, dz) + 0.4), ang: dx > dz ? 90 : 0 };
    return { target: c, ext, mat };
  }

  // ---------- visore interattivo ----------
  // new Viewer(canvas, { pal: () => palette }) ; v.show(ex, {side, mode}) ; v.setT(t) ; v.destroy()
  class Viewer {
    constructor(canvas, opt = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.opt = opt;
      this.yaw = 30; this.pitch = 14; this.zoom = 1; this.auto = false; this.t = 0; this.anim = null; this.alive = true;
      this.ptrs = new Map(); this._bind(); this._loop = this._loop.bind(this); this.raf = requestAnimationFrame(this._loop);
    }
    show(ex, o = {}) {
      this.ex = ex; this.side = o.side || 'L'; if (o.mode) this.mode = o.mode; else if (!this.mode) this.mode = 'loop'; this.t0 = performance.now();
      let A = full(ex.A), B = full(ex.B), props = ex.props || [];
      if (this.side === 'R') { A = mirror(A); B = mirror(B); props = mirrorProps(props); }
      this.A = A; this.B = B; this.props = props;
      this.fr = frame([A, B], props);
      if (!o.keepView) { this.yaw = (ex.view != null ? ex.view : 30) * (this.side === 'R' ? -1 : 1); this.pitch = ex.pitch != null ? ex.pitch : 14; this.zoom = 1; }
      this.dirty = true;
    }
    pose(t) { return lerp(this.A, this.B, t); }
    _bind() {
      const c = this.c;
      c.style.touchAction = 'none';
      c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, [e.clientX, e.clientY]); this.auto = false; this.opt.onTouch && this.opt.onTouch(); });
      c.addEventListener('pointermove', e => {
        if (!this.ptrs.has(e.pointerId)) return;
        const prev = this.ptrs.get(e.pointerId); const cur = [e.clientX, e.clientY];
        if (this.ptrs.size === 1) { this.yaw -= (cur[0] - prev[0]) * 0.55; this.pitch = Math.max(-8, Math.min(80, this.pitch + (cur[1] - prev[1]) * 0.35)); }
        else if (this.ptrs.size === 2) {
          const others = [...this.ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
          const d0 = Math.hypot(prev[0] - others[0], prev[1] - others[1]), d1 = Math.hypot(cur[0] - others[0], cur[1] - others[1]);
          if (d0 > 0) this.zoom = Math.max(0.6, Math.min(1.8, this.zoom * d1 / d0));
        }
        this.ptrs.set(e.pointerId, cur); this.dirty = true;
      });
      const up = e => { this.ptrs.delete(e.pointerId); };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(0.6, Math.min(1.8, this.zoom * (e.deltaY < 0 ? 1.08 : 0.93))); this.dirty = true; }, { passive: false });
      c.addEventListener('dblclick', () => this.resetView());
    }
    resetView() { if (this.ex) { this.yaw = (this.ex.view != null ? this.ex.view : 30) * (this.side === 'R' ? -1 : 1); this.pitch = this.ex.pitch != null ? this.ex.pitch : 14; this.zoom = 1; this.dirty = true; } }
    _loop(now) {
      if (!this.alive) return;
      this.raf = requestAnimationFrame(this._loop);
      if (!this.ex) return;
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (this.auto && !reduce) { this.yaw += 0.35; this.dirty = true; }
      let t;
      if (this.mode === 'still') t = 1;
      else if (this.mode === 'ext') t = this.t; // tempo guidato dall'esterno (player)
      else {
        const el = (now - this.t0) / 1000;
        if (this.ex.tipo === 'd') t = (1 - Math.cos(el / 3.2 * Math.PI * 2)) / 2;
        else { const ph = el % 7; t = ph < 2 ? (1 - Math.cos(Math.PI * ph / 2)) / 2 : ph < 5.6 ? 1 - 0.04 * Math.sin((ph - 2) * 1.75) ** 2 : 1 - (1 - Math.cos(Math.PI * (ph - 5.6) / 1.4)) / 2; }
        if (reduce) t = 1;
      }
      if (t !== this.lastT) { this.lastT = t; this.dirty = true; }
      const dpr = Math.min(2.5, root.devicePixelRatio || 1), w = this.c.clientWidth, h = this.c.clientHeight;
      if (this.c.width !== Math.round(w * dpr) || this.c.height !== Math.round(h * dpr)) { this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); this.dirty = true; }
      if (!this.dirty || !w || !h) return;
      this.dirty = false;
      const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const pal = this.opt.pal();
      const fr = this.fr;
      const dist = (fr.ext / 2) / Math.tan(17 * D) * 1.12 / this.zoom * Math.max(1, (h * 1.15) / w * 0.82) + 0.4;
      const dl = drawList(this.pose(t), this.props, { target: fr.target, yaw: this.yaw, pitch: this.pitch, dist, mat: fr.mat }, w, h, pal);
      paint(ctx, dl, pal);
    }
    destroy() { this.alive = false; cancelAnimationFrame(this.raf); }
  }

  // ---------- anteprima statica (per le miniature) ----------
  function snapshot(canvas, ex, pal, o = {}) {
    const dpr = Math.min(2, root.devicePixelRatio || 1), w = canvas.clientWidth || o.w || 120, h = canvas.clientHeight || o.h || 120;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const B = full(ex.B), A = full(ex.A), fr = frame([A, B], ex.props);
    const yaw = o.yaw != null ? o.yaw : (ex.view != null ? ex.view : 30);
    const dist = (fr.ext / 2) / Math.tan(17 * D) * 1.05 + 0.3;
    paint(ctx, drawList(B, ex.props, { target: fr.target, yaw, pitch: ex.pitch != null ? ex.pitch : 14, dist, mat: fr.mat }, w, h, pal), pal);
  }

  const api = { build, full, lerp, mirror, mirrorProps, frame, drawList, camera, paint, Viewer, snapshot, hex, mix, css, D };
  root.Manichino = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
