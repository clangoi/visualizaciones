(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  const prod = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm = (a) => Math.hypot(a[0], a[1]);
  const ptos = (v) => `(${VIZ.fmt(v[0], 3)}, ${VIZ.fmt(v[1], 3)})`;

  function planoIgual(l, cx, cy, semi) {
    const m = { izq: 36, der: 12, sup: 12, inf: 26 };
    const pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw, ph) / (2 * semi);
    const hx = pw / (2 * s), hy = ph / (2 * s);
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen: m });
  }
  function flecha(ctx, x, y, dx, dy, color, ancho = 2.5) {
    const L = Math.hypot(dx, dy);
    if (L < 2) return;
    const a = Math.atan2(dy, dx), c = Math.min(10, L * 0.5), x1 = x + dx, y1 = y + dy;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1 - Math.cos(a) * c * 0.6, y1 - Math.sin(a) * c * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - c * Math.cos(a - 0.4), y1 - c * Math.sin(a - 0.4));
    ctx.lineTo(x1 - c * Math.cos(a + 0.4), y1 - c * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function flechaDir(ctx, p, pt, v, largo, color, etiqueta, desvio = 0) {
    const n = nrm(v);
    if (n < 1e-9) return;
    const x = p.sx(pt[0]), y = p.sy(pt[1]), dx = (v[0] / n) * largo, dy = (-v[1] / n) * largo;
    flecha(ctx, x, y, dx, dy, color);
    if (etiqueta) {
      ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(etiqueta, x + dx * 1.22 + (dx >= 0 ? 7 : -7), y + dy * 1.22 + desvio); ctx.restore();
    }
  }
  function arrastrable(lienzo, alMover) {
    let activo = false;
    const c = lienzo.canvas;
    c.style.cursor = 'crosshair';
    c.addEventListener('pointerdown', (ev) => { activo = true; c.setPointerCapture(ev.pointerId); alMover(lienzo.posicion(ev), true); });
    c.addEventListener('pointermove', (ev) => alMover(lienzo.posicion(ev), activo));
    c.addEventListener('pointerup', () => { activo = false; });
    c.addEventListener('pointerleave', () => alMover(null, false));
  }
  function rellenar(ctx, p, G) {
    const paso = 5;
    ctx.save();
    ctx.fillStyle = VIZ.alfa(C.s3, 0.2);
    for (let px = p.x0; px < p.x1; px += paso) for (let py = p.y1; py < p.y0; py += paso) {
      if (G(p.ix(px + paso / 2), p.iy(py + paso / 2)) <= 0) ctx.fillRect(px, py, Math.min(paso, p.x1 - px), Math.min(paso, p.y0 - py));
    }
    ctx.restore();
  }
  const estadoTxt = (ok) => `<span style="color:${ok ? C.s6 : C.s8}">${ok ? 'cumple' : 'falla'}</span>`;

  /* ---------- Problemas: min f s.a. h_i = 0, g_j ≤ 0 ---------- */

  const PROBLEMAS = {
    disco: {
      nombre: 'Disco: g₁ = x² + y² − 2 ≤ 0',
      f: (p) => (p[0] - 2) ** 2 + (p[1] - 2) ** 2, hs: [], gs: [{ nombre: 'g₁', fn: (p) => p[0] ** 2 + p[1] ** 2 - 2 }],
      niveles: [0.5, 1, 2, 3.5, 5, 8, 12, 17], falso: [-1, -1], centro: [0.8, 0.8], semi: 3.4,
    },
    triangulo: {
      nombre: 'Triángulo: x + y ≤ 2, x ≥ 0, y ≥ 0',
      f: (p) => (p[0] - 2) ** 2 + (p[1] - 1) ** 2, hs: [],
      gs: [{ nombre: 'g₁', fn: (p) => p[0] + p[1] - 2 }, { nombre: 'g₂', fn: (p) => -p[0] }, { nombre: 'g₃', fn: (p) => -p[1] }],
      niveles: [0.5, 1, 2, 3.5, 5, 8, 12], falso: [0, 0.5], centro: [1, 0.8], semi: 3.2,
    },
    mixto: {
      nombre: 'Mixto: h₁ = x + y − 2 = 0 y g₁ = x − 0,5 ≤ 0',
      f: (p) => (p[0] - 2) ** 2 + (p[1] - 2) ** 2, hs: [{ nombre: 'h₁', fn: (p) => p[0] + p[1] - 2 }], gs: [{ nombre: 'g₁', fn: (p) => p[0] - 0.5 }],
      niveles: [0.5, 1, 2, 3.5, 5, 8, 12], falso: [1, 1], centro: [1, 1], semi: 3.4,
    },
  };
  const LISTA = Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]);

  // Análisis KKT en un punto: multiplicadores por mínimos cuadrados sobre las restricciones activas.
  function analizar(P, x, eps) {
    const gf = O.grad(P.f, x);
    const hv = P.hs.map((h) => h.fn(x)), gv = P.gs.map((g) => g.fn(x));
    const act = P.gs.map((_, j) => j).filter((j) => Math.abs(gv[j]) <= eps);
    const cols = [...P.hs.map((h) => O.grad(h.fn, x)), ...act.map((j) => O.grad(P.gs[j].fn, x))];
    let w = [];
    if (cols.length) {
      const M = cols.map((a) => cols.map((b) => prod(a, b)));
      for (let i = 0; i < M.length; i++) M[i][i] += 1e-10;
      w = O.resolver(M, cols.map((a) => -prod(a, gf))) || cols.map(() => 0);
    }
    const r = [gf[0], gf[1]];
    cols.forEach((a, i) => { r[0] += w[i] * a[0]; r[1] += w[i] * a[1]; });
    const lam = w.slice(0, P.hs.length), mu = P.gs.map(() => 0);
    act.forEach((j, i) => { mu[j] = w[P.hs.length + i]; });
    const c = {
      est: nrm(r), prim: Math.max(0, ...hv.map(Math.abs), ...gv),
      dual: mu.length ? Math.min(0, ...mu) : 0, comp: Math.max(0, ...mu.map((m, j) => Math.abs(m * gv[j]))),
    };
    c.okEst = c.est <= eps * (1 + nrm(gf)); c.okPrim = c.prim <= eps; c.okDual = c.dual >= -eps; c.okComp = c.comp <= eps;
    c.ok = c.okEst && c.okPrim && c.okDual && c.okComp;
    return { gf, hv, gv, act, cols, lam, mu, r, c };
  }

  /* ---------- Fig. 1: calculadora KKT ---------- */

  function montarCalculadora(cuerpo) {
    let P = PROBLEMAS.disco, x = [0.9, 0.3], eps = 0.05, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'disco', alCambiar: (v) => { P = PROBLEMAS[v]; x = P.centro.slice(); dibujar(); } });
    ctl.rango({ etiqueta: 'Tolerancia ε', min: 0.005, max: 0.2, paso: 0.005, valor: eps, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { eps = v; dibujar(); } });
    ctl.boton('Resolver (Lagrangiano aumentado)', () => {
      x = O.restringido(P.f, P.hs.map((h) => h.fn), P.gs.map((g) => g.fn), [0, 0], { rho: 10, externas: 12 }).x;
      dibujar();
    }, { primario: true });
    ctl.boton('Candidato incorrecto', () => { x = P.falso.slice(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.66, altoMin: 290, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región g ≤ 0', forma: 'cuadro' },
      { color: C.tinta, texto: 'fronteras g = 0 y h = 0', forma: 'linea' },
      { color: C.s2, texto: '−∇f', forma: 'linea' },
      { color: C.s1, texto: '∇g activo', forma: 'linea' },
      { color: C.s7, texto: '∇h', forma: 'linea' },
      { color: C.s6, texto: 'candidato que cumple KKT', forma: 'punto' },
      { color: C.s8, texto: 'candidato que falla', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para elegir un candidato x: se calculan los multiplicadores por mínimos cuadrados con las restricciones a menos de ε de ser activas y se evalúan las cuatro condiciones. Pruebe «Resolver» y luego muévase un poco.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, P.centro[0], P.centro[1], P.semi);
      plano.ejes();
      const G = (a, b) => Math.max(-1, ...P.gs.map((g) => g.fn([a, b])));
      if (P.gs.length) rellenar(ctx, plano, G);
      ctx.save();
      plano.recortar();
      for (const c of P.niveles) ML.contorno(ctx, plano, (a, b) => P.f([a, b]), c, { color: C.eje, ancho: 1.2, paso: 6 });
      ctx.restore();
      for (const g of P.gs) ML.contorno(ctx, plano, (a, b) => g.fn([a, b]), 0, { color: C.tinta, ancho: 2.5, paso: 3 });
      for (const h of P.hs) ML.contorno(ctx, plano, (a, b) => h.fn([a, b]), 0, { color: C.tinta, ancho: 3, paso: 3 });
      const A = analizar(P, x, eps);
      A.cols.forEach((a, i) => flechaDir(ctx, plano, x, a, 42, i < P.hs.length ? C.s7 : C.s1, i < P.hs.length ? '∇h' : '∇' + P.gs[A.act[i - P.hs.length]].nombre, i * 8));
      flechaDir(ctx, plano, x, [-A.gf[0], -A.gf[1]], 56, C.s2, '−∇f');
      VIZ.marcador(ctx, plano.sx(x[0]), plano.sy(x[1]), A.c.ok ? C.s6 : C.s8, 7);
      const fallas = [!A.c.okEst && 'estacionariedad', !A.c.okPrim && 'factibilidad primal', !A.c.okDual && 'factibilidad dual (μ ≥ 0)', !A.c.okComp && 'holgura complementaria'].filter(Boolean);
      registro.textContent = A.c.ok ? `${ptos(x)} cumple las cuatro condiciones KKT con tolerancia ${VIZ.fmt(eps, 3)}: es un punto KKT (candidato a óptimo).`
        : `${ptos(x)} no es un punto KKT. Falla: ${fallas.join(', ')}.`;
      lectura.set([
        ['candidato x', ptos(x)], ['f(x)', VIZ.fmt(P.f(x), 4)], ['restricciones activas', A.act.length ? A.act.map((j) => P.gs[j].nombre).join(', ') : 'ninguna'],
        ...P.hs.map((h, i) => [`λ (${h.nombre})`, VIZ.fmt(A.lam[i], 3)]),
        ...P.gs.map((g, j) => [`μ (${g.nombre})`, VIZ.fmt(A.mu[j], 3)]),
      ]);
      caja.innerHTML = `<table class="tabla-datos sin-corte"><thead><tr><th>Condición</th><th>Medida</th><th>Valor</th><th>Estado</th></tr></thead><tbody>`
        + `<tr><td>Estacionariedad</td><td>‖∇f + Σλ∇h + Σμ∇g‖</td><td>${VIZ.fmt(A.c.est, 3)}</td><td>${estadoTxt(A.c.okEst)}</td></tr>`
        + `<tr><td>Factibilidad primal</td><td>máx. violación de h = 0 y g ≤ 0</td><td>${VIZ.fmt(A.c.prim, 3)}</td><td>${estadoTxt(A.c.okPrim)}</td></tr>`
        + `<tr><td>Factibilidad dual</td><td>mín. μ</td><td>${VIZ.fmt(P.gs.length ? Math.min(...A.mu) : 0, 3)}</td><td>${estadoTxt(A.c.okDual)}</td></tr>`
        + `<tr><td>Holgura complementaria</td><td>máx. |μ·g|</td><td>${VIZ.fmt(A.c.comp, 3)}</td><td>${estadoTxt(A.c.okComp)}</td></tr></tbody></table>`;
    }
    lienzo.alDibujar = dibujar;
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { x = q; dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt(P.f(q))}</b><br>` + [...P.hs, ...P.gs].map((s) => `${s.nombre} = <b>${VIZ.fmt(s.fn(q), 3)}</b>`).join('  '));
    });
    dibujar();
  }

  /* ---------- Fig. 2: calificación de restricciones (LICQ) ---------- */

  function montarLICQ(cuerpo) {
    let pot = 3, xc = 1, plano = null;
    const g1 = (x, y) => (x <= 1 ? y - Math.pow(1 - x, pot) : y + (x - 1));
    const g2 = (x, y) => -y;
    const grad1 = (x) => { const s = Math.max(0, 1 - x); return [pot === 1 ? 1 : pot * Math.pow(s, pot - 1), 1]; };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Exponente p de la cúspide (1 − x)^p', min: 1, max: 3, paso: 0.5, valor: pot, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pot = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Candidato: abscisa x sobre y = 0', min: 0.3, max: 1, paso: 0.01, valor: xc, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { xc = v; dibujar(); } });
    ctl.boton('Cúspide (LICQ falla)', () => { pot = 3; sync(); }, { primario: true });
    ctl.boton('Esquina (LICQ vale)', () => { pot = 1; sync(); });
    const sliders = cuerpo.querySelectorAll('input[type=range]');
    const sync = () => { sliders[0].value = pot; sliders[0].dispatchEvent(new Event('input')); };
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región factible', forma: 'cuadro' },
      { color: C.s1, texto: '∇g₁', forma: 'linea' },
      { color: C.s7, texto: '∇g₂', forma: 'linea' },
      { color: C.s2, texto: '−∇f (maximizar x)', forma: 'linea' },
      { color: C.s1, texto: 'cono de gradientes activos', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Maximizar x en la región g₁ = y − (1 − x)^p ≤ 0, g₂ = −y ≤ 0. El óptimo es siempre (1, 0). Con p &gt; 1 la región es una cúspide: los dos gradientes quedan alineados y ningún multiplicador reproduce −∇f. Con p = 1 (esquina) KKT sí vale.');

    // Mejor μ ≥ 0 para ∇f + Σ μ_j ∇g_j ≈ 0 (se prueban todas las combinaciones de soporte).
    function mejor(gf, G) {
      const cand = [[]];
      G.forEach((_, j) => cand.push([j]));
      if (G.length === 2) cand.push([0, 1]);
      let mejorR = { r: nrm(gf), mu: G.map(() => 0) };
      for (const S of cand) {
        if (!S.length) continue;
        const M = S.map((i) => S.map((j) => prod(G[i], G[j])));
        for (let i = 0; i < M.length; i++) M[i][i] += 1e-12;
        const w = O.resolver(M, S.map((i) => -prod(G[i], gf)));
        if (!w || w.some((v) => v < -1e-9)) continue;
        const mu = G.map(() => 0);
        S.forEach((i, k) => { mu[i] = w[k]; });
        const r = [gf[0], gf[1]];
        G.forEach((g, j) => { r[0] += mu[j] * g[0]; r[1] += mu[j] * g[1]; });
        if (nrm(r) < mejorR.r - 1e-12) mejorR = { r: nrm(r), mu };
      }
      return mejorR;
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, 0.35, 0.5, 1.15);
      plano.ejes();
      const G = (a, b) => Math.max(g1(a, b), g2(a, b), a - 1);
      rellenar(ctx, plano, G);
      ML.contorno(ctx, plano, (a, b) => Math.max(g1(a, b), g2(a, b)), 0, { color: C.tinta, ancho: 2.5, paso: 3 });
      const x = [xc, 0], gf = [-1, 0];
      const act = [];
      const tol = 1e-9;
      const gs = [[grad1(xc), g1(xc, 0), 'g₁', C.s1], [[0, -1], g2(xc, 0), 'g₂', C.s7]];
      for (const s of gs) if (Math.abs(s[1]) <= tol) act.push(s);
      const Gm = act.map((s) => s[0]);
      if (Gm.length === 2) {
        const [a, b] = Gm, na = nrm(a), nb = nrm(b), L = 110;
        const par = Math.abs(a[0] * b[1] - a[1] * b[0]) < 1e-9 * na * nb;
        ctx.save(); ctx.fillStyle = VIZ.alfa(C.s1, 0.16); ctx.strokeStyle = VIZ.alfa(C.s1, 0.5); ctx.lineWidth = 1;
        const X = plano.sx(x[0]), Y = plano.sy(x[1]);
        ctx.beginPath(); ctx.moveTo(X, Y);
        if (par) { ctx.lineTo(X + (a[0] / na) * L, Y - (a[1] / na) * L); ctx.moveTo(X, Y); ctx.lineTo(X + (b[0] / nb) * L, Y - (b[1] / nb) * L); ctx.lineWidth = 6; ctx.stroke(); }
        else { ctx.lineTo(X + (a[0] / na) * L, Y - (a[1] / na) * L); const m = [a[0] / na + b[0] / nb, a[1] / na + b[1] / nb]; const nm = nrm(m) || 1; ctx.lineTo(X + (m[0] / nm) * L * 1.2, Y - (m[1] / nm) * L * 1.2); ctx.lineTo(X + (b[0] / nb) * L, Y - (b[1] / nb) * L); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (Gm.length === 1) {
        const a = Gm[0], na = nrm(a), X = plano.sx(x[0]), Y = plano.sy(x[1]);
        ctx.save(); ctx.strokeStyle = VIZ.alfa(C.s1, 0.5); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + (a[0] / na) * 110, Y - (a[1] / na) * 110); ctx.stroke(); ctx.restore();
      }
      act.forEach((s, i) => flechaDir(ctx, plano, x, s[0], 52, s[3], '∇' + s[2], i * 10));
      flechaDir(ctx, plano, x, [-gf[0], -gf[1]], 66, C.s2, '−∇f');
      const m = mejor(gf, Gm);
      const det = Gm.length === 2 ? Gm[0][0] * Gm[1][1] - Gm[0][1] * Gm[1][0] : null;
      const kkt = m.r < 1e-7;
      VIZ.marcador(ctx, plano.sx(x[0]), plano.sy(x[1]), kkt ? C.s6 : C.s8, 7);
      const licq = Gm.length < 2 || Math.abs(det) > 1e-9;
      registro.textContent = xc < 1 ? `En (${VIZ.fmt(xc, 3)}, 0) solo g₂ está activa y ∇f = (−1, 0) no es múltiplo de ∇g₂ = (0, −1): no es KKT (ni óptimo; se puede avanzar a la derecha).`
        : kkt ? `En (1, 0) las dos restricciones están activas con gradientes independientes (LICQ). Se cumple KKT con μ₁ = ${VIZ.fmt(m.mu[0], 3)}, μ₂ = ${VIZ.fmt(m.mu[1], 3)}: −∇f está en el cono.`
          : `En (1, 0) los gradientes ∇g₁ = (0, 1) y ∇g₂ = (0, −1) son colineales (LICQ falla): su cono es una recta vertical y −∇f = (1, 0) no está en él. El mejor ajuste deja un residuo de ${VIZ.fmt(m.r, 3)}. El punto es óptimo y, sin embargo, no cumple KKT.`;
      lectura.set([
        ['candidato', `(${VIZ.fmt(xc, 3)}, 0)`], ['restricciones activas', act.length ? act.map((s) => s[2]).join(', ') : 'ninguna'],
        ['∇g₁', ptos(gs[0][0])], ['∇g₂', ptos(gs[1][0])], ['det[∇g₁ ∇g₂]', det == null ? '—' : VIZ.fmt(det, 3)],
        ['LICQ', licq ? 'se cumple' : 'falla'], ['mín. ‖∇f + Σμ∇g‖, μ ≥ 0', VIZ.fmt(m.r, 3)], ['¿KKT?', kkt ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const a = plano.ix(pos.x), b = plano.iy(pos.y);
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(a, 3)}, ${VIZ.fmt(b, 3)})<br>g₁ = <b>${VIZ.fmt(g1(a, b), 3)}</b>  g₂ = <b>${VIZ.fmt(g2(a, b), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: holgura complementaria en (g, μ) ---------- */

  function montarHolgura(cuerpo) {
    let a = -2, b = 1, cand = null, trail = [], pG = null, pM = null;
    const ctl = VIZ.controles(cuerpo);
    const sA = ctl.rango({ etiqueta: 'Centro a de f(x) = (x − a)²', min: -2, max: 4, paso: 0.05, valor: a, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { a = v; trail = []; dibujar(); } });
    ctl.rango({ etiqueta: 'Cota b de g(x) = x − b ≤ 0', min: -1, max: 3, paso: 0.05, valor: b, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { b = v; trail = []; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Quitar candidato', () => { cand = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 190, altoMax: 260 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Plano (g, μ): el conjunto que permite la holgura complementaria es la «L»');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 230, altoMax: 340 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'conjunto g ≤ 0, μ ≥ 0, μ·g = 0', forma: 'linea' },
      { color: C.s6, texto: 'punto KKT de la solución', forma: 'punto' },
      { color: C.s2, texto: 'candidato (clic en el plano)', forma: 'punto' },
      { color: C.s8, texto: 'infactible (g > 0 o μ < 0)', forma: 'cuadro' },
      { color: C.s4, texto: 'viola μ·g = 0', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el plano inferior para probar un candidato (g, μ): arriba se ubica x = b + g. Pulse «Reproducir» para barrer a: el punto KKT recorre la «L» (primero por el eje horizontal, con μ = 0, y luego por el vertical, con g = 0).');

    function iniciar() {
      a = -2; sA.valor = a; trail = [];
      return (function* () { while (a < 4 - 1e-9) { a = Math.round((a + 0.1) * 100) / 100; sA.valor = a; yield; } })();
    }
    const solucion = () => { const xs = Math.min(a, b); return { x: xs, g: xs - b, mu: Math.max(0, 2 * (a - b)) }; };
    let eje = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const s = solucion();
      if (!trail.length || Math.abs(trail[trail.length - 1][0] - s.g) + Math.abs(trail[trail.length - 1][1] - s.mu) > 1e-9) trail.push([s.g, s.mu]);
      if (trail.length > 400) trail.shift();
      eje = VIZ.plano(lienzo, { xmin: -3.5, xmax: 5.5, ymin: -0.5, ymax: 9 }, { etiquetaX: 'x', etiquetaY: 'f(x)', margen: { izq: 40 } });
      eje.ejes();
      ctx.save(); eje.recortar();
      ctx.fillStyle = VIZ.alfa(C.s8, 0.12); ctx.fillRect(eje.sx(b), eje.y1, eje.x1 - eje.sx(b), eje.y0 - eje.y1);
      VIZ.trazar(ctx, eje, Array.from({ length: 181 }, (_, i) => { const x = -3.5 + (i * 9) / 180; return [x, (x - a) ** 2]; }), C.tinta, 2.5);
      ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(eje.sx(b), eje.y1); ctx.lineTo(eje.sx(b), eje.y0); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      VIZ.marcador(ctx, eje.sx(s.x), eje.sy((s.x - a) ** 2), C.s6, 6.5);
      if (cand) { const xc = b + cand.g; if (xc > -3.5 && xc < 5.5) VIZ.marcador(ctx, eje.sx(xc), eje.sy((xc - a) ** 2), C.s2, 5.5); }
      dibujarPlano(s);
    }
    function dibujarPlano(s) {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      pG = VIZ.plano(lienzo2, { xmin: -4.5, xmax: 2.5, ymin: -2, ymax: 9 }, { etiquetaX: 'g(x) = x − b', etiquetaY: 'μ', margen: { izq: 40 } });
      pG.ejes();
      ctx.save(); pG.recortar();
      ctx.fillStyle = VIZ.alfa(C.s8, 0.12); ctx.fillRect(pG.sx(0), pG.y1, pG.x1 - pG.sx(0), pG.y0 - pG.y1); ctx.fillRect(pG.x0, pG.sy(0), pG.sx(0) - pG.x0, pG.y0 - pG.sy(0));
      ctx.fillStyle = VIZ.alfa(C.s4, 0.16); ctx.fillRect(pG.x0, pG.y1, pG.sx(0) - pG.x0, pG.sy(0) - pG.y1);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pG.x0, pG.sy(0)); ctx.lineTo(pG.sx(0), pG.sy(0)); ctx.lineTo(pG.sx(0), pG.y1); ctx.stroke();
      ctx.restore();
      VIZ.trazar(ctx, pG, trail, C.apagado, 1.5, [3, 3]);
      VIZ.marcador(ctx, pG.sx(s.g), pG.sy(s.mu), C.s6, 6.5);
      let txt = `Solución exacta de min (x − ${VIZ.fmt(a, 3)})² con x ≤ ${VIZ.fmt(b, 3)}: x* = ${VIZ.fmt(s.x, 3)}, ${s.mu > 0 ? `restricción activa (g = 0), μ = 2(a − b) = ${VIZ.fmt(s.mu, 3)} &gt; 0` : `restricción inactiva (g = ${VIZ.fmt(s.g, 3)} &lt; 0), μ = 0`}. Estacionariedad: 2(x − a) + μ = 0.`;
      const fil = [['a, b', `${VIZ.fmt(a, 3)}, ${VIZ.fmt(b, 3)}`], ['x*', VIZ.fmt(s.x, 3)], ['g(x*)', VIZ.fmt(s.g, 3)], ['μ*', VIZ.fmt(s.mu, 3)], ['μ*·g(x*)', VIZ.fmt(s.mu * s.g, 2)]];
      if (cand) {
        VIZ.marcador(ctx, pG.sx(cand.g), pG.sy(cand.mu), C.s2, 6);
        const x = b + cand.g, est = 2 * (x - a) + cand.mu;
        const fallas = [Math.abs(est) > 0.05 && `estacionariedad (2(x − a) + μ = ${VIZ.fmt(est, 3)} ≠ 0)`, cand.g > 0.02 && 'factibilidad primal (g &gt; 0)', cand.mu < -0.02 && 'factibilidad dual (μ &lt; 0)', Math.abs(cand.mu * cand.g) > 0.05 && `holgura complementaria (μ·g = ${VIZ.fmt(cand.mu * cand.g, 3)} ≠ 0)`].filter(Boolean);
        txt += fallas.length ? ` Candidato (g, μ) = (${VIZ.fmt(cand.g, 3)}, ${VIZ.fmt(cand.mu, 3)}) falla: ${fallas.join('; ')}.` : ` El candidato cumple las cuatro condiciones: es el punto KKT.`;
        fil.push(['candidato (g, μ)', `(${VIZ.fmt(cand.g, 3)}, ${VIZ.fmt(cand.mu, 3)})`], ['estacionariedad', VIZ.fmt(est, 3)], ['μ·g', VIZ.fmt(cand.mu * cand.g, 3)]);
      }
      registro.innerHTML = txt;
      lectura.set(fil);
    }
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!eje || !eje.dentro(pos.x, pos.y)) return tip.ocultar();
      const x = eje.ix(pos.x);
      tip.mostrar(pos.x, pos.y, `x = <b>${VIZ.fmt(x, 3)}</b><br>f = <b>${VIZ.fmt((x - a) ** 2)}</b><br>g = <b>${VIZ.fmt(x - b, 3)}</b> ${x <= b ? '(factible)' : '(infactible)'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo2.canvas.style.cursor = 'crosshair';
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo2.posicion(ev);
      if (!pG || !pG.dentro(pos.x, pos.y)) return tip2.ocultar();
      const g = pG.ix(pos.x), mu = pG.iy(pos.y);
      tip2.mostrar(pos.x, pos.y, `g = <b>${VIZ.fmt(g, 3)}</b>, μ = <b>${VIZ.fmt(mu, 3)}</b><br>μ·g = <b>${VIZ.fmt(mu * g, 3)}</b><br>${g > 0 ? 'infactible primal' : mu < 0 ? 'infactible dual' : Math.abs(mu * g) < 0.05 ? 'sobre la «L»' : 'viola holgura'}`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo2.canvas.addEventListener('click', (ev) => {
      const pos = lienzo2.posicion(ev);
      if (!pG || !pG.dentro(pos.x, pos.y)) return;
      cand = { g: pG.ix(pos.x), mu: pG.iy(pos.y) };
      dibujar();
    });
    rep.reiniciar();
    a = 3; sA.valor = a; trail = []; dibujar();
  }

  VIZ.registrarTema('kkt-conditions', {
    intro: String.raw`
      <p>Las <strong>condiciones de Karush–Kuhn–Tucker (KKT)</strong> son el equivalente, para problemas con desigualdades, de la regla «gradiente igual a cero». Dicen que en un
      óptimo el gradiente de la función objetivo queda equilibrado por los gradientes de las restricciones que están activas, cada uno con un peso (multiplicador) que no puede ser negativo.</p>
      <p>Son cuatro comprobaciones sencillas: que el equilibrio de gradientes se cumpla, que el punto sea factible, que los multiplicadores de desigualdad sean no negativos y que una restricción
      inactiva tenga multiplicador cero. Si las cuatro se cumplen, el punto es un <em>candidato</em> a óptimo; en problemas convexos, además, es un óptimo global.</p>`,
    visualizaciones: [
      {
        titulo: 'Calculadora KKT',
        descripcion: 'Haga clic para elegir un candidato y lea la tabla con las cuatro condiciones. Pruebe «Resolver (Lagrangiano aumentado)» para ver un punto KKT y «Candidato incorrecto» para ver cuál condición falla; luego reduzca la tolerancia ε.',
        montar: montarCalculadora,
      },
      {
        titulo: 'Calificación de restricciones (LICQ)',
        descripcion: 'En una cúspide los gradientes activos quedan alineados y KKT falla aunque el punto sea óptimo. Compare «Cúspide» y «Esquina» y mueva el candidato por la región.',
        montar: montarLICQ,
      },
      {
        titulo: 'Holgura complementaria',
        descripcion: 'Cambie a y b (o pulse «Reproducir» para barrer a) y vea que el par \\((g,\\mu)\\) de la solución siempre queda sobre la «L». Haga clic en el plano inferior para probar candidatos fuera de ella.',
        montar: montarHolgura,
      },
    ],
    teoria: String.raw`
      <h2>Enunciado</h2>
      <p>Para el problema \(\min f(x)\) sujeto a \(h_i(x)=0\) (\(i=1..m\)) y \(g_j(x)\le0\) (\(j=1..p\)), un punto \(x^*\) con multiplicadores \(\lambda\in\mathbb{R}^m\) y \(\mu\in\mathbb{R}^p\) cumple las condiciones KKT si</p>
      \[ \begin{aligned}
      &\text{(1) Estacionariedad:} && \nabla f(x^*)+\sum_i\lambda_i\nabla h_i(x^*)+\sum_j\mu_j\nabla g_j(x^*)=0,\\
      &\text{(2) Factibilidad primal:} && h_i(x^*)=0,\quad g_j(x^*)\le0,\\
      &\text{(3) Factibilidad dual:} && \mu_j\ge0,\\
      &\text{(4) Holgura complementaria:} && \mu_j\,g_j(x^*)=0\ \ \text{para todo }j.
      \end{aligned} \]
      <p>La condición (4) dice que, para cada \(j\), o bien \(\mu_j=0\) (restricción inactiva o sin presión) o bien \(g_j=0\) (activa). Equivale a que solo las restricciones activas aparezcan en (1).</p>
      <h2>Teorema (necesidad)</h2>
      <div class="recuadro"><p>Si \(x^*\) es un mínimo local y se cumple una <strong>calificación de restricciones</strong>, existen \(\lambda,\mu\) con (1)–(4). La más usada es <strong>LICQ</strong>: los gradientes de las restricciones activas
      (\(\nabla h_i\) y \(\nabla g_j\) con \(j\in A(x^*)\)) son linealmente independientes. Bajo LICQ, los multiplicadores son únicos.</p></div>
      <p>Cuando no se cumple ninguna calificación, un óptimo puede no ser punto KKT (figura 2: dos fronteras tangentes entre sí en una cúspide). También valen condiciones más débiles, como MFCQ o Slater; para restricciones lineales no hace falta ninguna.</p>
      <h2>Suficiencia y segundo orden</h2>
      <p>Si el problema es convexo (\(f\) y \(g_j\) convexas, \(h_i\) afines), todo punto KKT es un mínimo global. En general se exige además que, sobre el espacio crítico (direcciones tangentes a las restricciones activas con \(\mu_j>0\)), la Hessiana de la lagrangiana sea definida positiva:
      \(d^\top\nabla^2_{xx}L\,d>0\) (véase <a href="tema.html?id=constrained-nlp-solving">resolución de problemas restringidos</a>).</p>
      <h2>Cómo se verifica un candidato</h2>
      <pre><code>dado x:
    A ← {j : g_j(x) = 0}                  (restricciones activas)
    resolver  ∇f + Σ λ_i ∇h_i + Σ_{j∈A} μ_j ∇g_j = 0   por mínimos cuadrados
    si el residuo ≠ 0:                    no es KKT (falla 1)
    si h(x) ≠ 0 o g(x) &gt; 0:                no es KKT (falla 2)
    si algún μ_j &lt; 0:                     no es KKT (falla 3)   (4 se cumple por construcción, μ_j = 0 si j ∉ A)
    devolver «punto KKT»</code></pre>
      <h2>Ejemplo resuelto</h2>
      <p>\(\min (x-2)^2+(y-2)^2\) con \(x^2+y^2\le2\). En \(x^*=(1,1)\): \(g=0\) (activa), \(\nabla f=(-2,-2)\), \(\nabla g=(2,2)\), luego (1) da \(\mu=1\ge0\); (2), (3) y (4) se cumplen. En \((-1,-1)\), también sobre el borde,
      \(\nabla f=(-6,-6)\) y \(\nabla g=(-2,-2)\) dan \(\mu=-3<0\): falla (3) y no es un mínimo (es el peor punto del disco).</p>
      <h2>Conexiones</h2>
      <p>Con solo igualdades, KKT se reduce a <a href="tema.html?id=equality-constraints-lagrange">Lagrange</a>. La enumeración de qué restricciones están activas se estudia en
      <a href="tema.html?id=active-inactive-constraints">restricciones activas e inactivas</a>; los multiplicadores se interpretan en <a href="tema.html?id=multiplier-interpretation">su significado geométrico</a>. En programación lineal, KKT es exactamente la
      <a href="tema.html?id=complementary-slackness">holgura complementaria</a> entre primal y dual.</p>`,
  });
})();
