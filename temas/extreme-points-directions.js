(function () {
  'use strict';
  const { color: C } = VIZ;
  /* ---------- Ayudantes de geometría 2-D (propios de este archivo) ---------- */

  const EPS = 1e-9;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const norma = (a) => Math.hypot(a[0], a[1]);
  const SUB = ['x₁', 'x₂', 'x₃'];
  // Texto de una forma lineal: [2, −1] → «2x₁ − x₂».
  function lineal(a) {
    let s = '';
    a.forEach((v, i) => {
      if (Math.abs(v) < 1e-12) return;
      const m = Math.abs(v), t = (m === 1 ? '' : VIZ.fmt(m)) + SUB[i];
      s += s ? (v < 0 ? ' − ' : ' + ') + t : (v < 0 ? '−' : '') + t;
    });
    return s || '0';
  }
  // Quita puntos repetidos y colineales de un polígono convexo.
  function limpiar(P) {
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const Q = [];
    for (const p of P) if (!Q.length || d(p, Q[Q.length - 1]) > 1e-7) Q.push(p);
    while (Q.length > 1 && d(Q[0], Q[Q.length - 1]) <= 1e-7) Q.pop();
    let cambio = true;
    while (cambio && Q.length > 2) {
      cambio = false;
      for (let i = 0; i < Q.length; i++) {
        const p = Q[(i + Q.length - 1) % Q.length], q = Q[i], r = Q[(i + 1) % Q.length];
        const cr = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
        if (Math.abs(cr) <= 1e-9 * d(p, q) * d(q, r)) { Q.splice(i, 1); cambio = true; break; }
      }
    }
    return Q;
  }
  // Analiza { x : A x ≤ b }: vértices reales, aristas acotadas y semirrectas (las esquinas de la caja grande son artificiales).
  function analizar(restr) {
    const P = limpiar(VIZ.opt.poligono(restr));
    const n = P.length, art = P.map((p) => Math.abs(p[0]) > 999 || Math.abs(p[1]) > 999);
    const aristas = [], rayos = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (n === 2 && i === 1) break;
      if (n < 2 || j === i) break;
      if (!art[i] && !art[j]) aristas.push([P[i], P[j]]);
      else if (!art[i] && art[j]) rayos.push({ o: P[i], d: unit([P[j][0] - P[i][0], P[j][1] - P[i][1]]) });
      else if (art[i] && !art[j]) rayos.push({ o: P[j], d: unit([P[i][0] - P[j][0], P[i][1] - P[j][1]]) });
    }
    const V = P.filter((_, i) => !art[i]);
    return { P, V, aristas, rayos, acotado: n > 0 && !art.some(Boolean), vacio: n === 0 };
  }
  function unit(v) { const L = norma(v) || 1; return [v[0] / L, v[1] / L]; }
  // Direcciones extremas distintas (de las semirrectas del borde).
  function direcciones(an) {
    const D = [];
    for (const r of an.rayos) if (!D.some((d) => dot(d, r.d) > 1 - 1e-9)) D.push(r.d);
    return D;
  }
  // max c·x sobre la región: { estado: 'vacio' | 'noacotado' | 'optimo', z, V (vértices óptimos), semirrectas (óptimas), tipo }.
  function resolver2d(restr, c, an = analizar(restr)) {
    if (an.vacio) return { estado: 'vacio', an };
    const D = direcciones(an);
    if (D.some((d) => dot(c, d) > 1e-9)) return { estado: 'noacotado', an, dir: D.find((d) => dot(c, d) > 1e-9) };
    let z = -Infinity;
    for (const p of an.V) z = Math.max(z, dot(c, p));
    const V = an.V.filter((p) => dot(c, p) >= z - 1e-9);
    const sem = an.rayos.filter((r) => Math.abs(dot(c, r.d)) <= 1e-9 && V.some((p) => Math.hypot(p[0] - r.o[0], p[1] - r.o[1]) < 1e-7));
    const tipo = sem.length ? 'semirrecta' : V.length > 1 ? 'arista' : 'vertice';
    return { estado: 'optimo', an, z, V, semirrectas: sem, tipo };
  }
  function area(P) {
    let s = 0;
    P.forEach((p, i) => { const q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; });
    return Math.abs(s) / 2;
  }
  // Activas en un punto: índices i con |aᵢ·x − bᵢ| ≤ tol.
  const activas = (restr, p, tol = 1e-7) => restr.map((r, i) => (Math.abs(dot(r.a, p) - r.b) <= tol ? i : -1)).filter((i) => i >= 0);

  /* ---------- Dibujo 2-D ---------- */

  // Plano con la misma escala en ambos ejes (para que las perpendiculares se vean perpendiculares).
  function planoIgual(l, d) {
    const margen = { izq: 34, der: 12, sup: 16, inf: 30 };
    const pw = l.ancho - margen.izq - margen.der, ph = l.alto - margen.sup - margen.inf;
    const s = Math.min(pw / (d.xmax - d.xmin), ph / (d.ymax - d.ymin));
    const cx = (d.xmin + d.xmax) / 2, cy = (d.ymin + d.ymax) / 2, hx = pw / s / 2, hy = ph / s / 2;
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen, etiquetaX: 'x₁', etiquetaY: 'x₂' });
  }
  function poligono(ctx, pl, P, relleno, borde, ancho = 2) {
    if (P.length < 2) return;
    ctx.save();
    pl.recortar();
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(pl.sx(p[0]), pl.sy(p[1])) : ctx.moveTo(pl.sx(p[0]), pl.sy(p[1]))));
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = ancho; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
  }
  // Recta a·x = b recortada al gráfico.
  function recta(ctx, pl, a, b, color, ancho = 2, guion) {
    const d = pl.d, ext = 60;
    let p, q;
    if (Math.abs(a[1]) >= Math.abs(a[0])) {
      const x0 = d.xmin - ext, x1 = d.xmax + ext;
      p = [x0, (b - a[0] * x0) / a[1]]; q = [x1, (b - a[0] * x1) / a[1]];
    } else {
      const y0 = d.ymin - ext, y1 = d.ymax + ext;
      p = [(b - a[1] * y0) / a[0], y0]; q = [(b - a[1] * y1) / a[0], y1];
    }
    ctx.save();
    pl.recortar();
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    if (guion) ctx.setLineDash(guion);
    ctx.beginPath(); ctx.moveTo(pl.sx(p[0]), pl.sy(p[1])); ctx.lineTo(pl.sx(q[0]), pl.sy(q[1])); ctx.stroke();
    ctx.restore();
  }
  function flecha(ctx, x0, y0, x1, y1, color, ancho = 2) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 3) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, h = Math.min(11, L * 0.6);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * h * 0.6, y1 - uy * h * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * h + uy * h * 0.45, y1 - uy * h - ux * h * 0.45);
    ctx.lineTo(x1 - ux * h - uy * h * 0.45, y1 - uy * h + ux * h * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Flecha en coordenadas de datos.
  const flechaD = (ctx, pl, o, f, color, ancho) => flecha(ctx, pl.sx(o[0]), pl.sy(o[1]), pl.sx(f[0]), pl.sy(f[1]), color, ancho);
  function texto(ctx, t, x, y, color, alin = 'left', px = 11, peso = 400) {
    ctx.save();
    ctx.font = VIZ.fuente(px, peso); ctx.fillStyle = color; ctx.textAlign = alin; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
    ctx.restore();
  }
  // Arrastre con puntero: tomar(x, y) devuelve true si captura; mover(x, y) mientras se arrastra; pasar(x, y) sin botón.
  function interaccion(lienzo, { tomar, mover, pasar, salir }) {
    const cv = lienzo.canvas;
    let activo = false;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (ev) => {
      const p = lienzo.posicion(ev);
      if (tomar(p.x, p.y)) { activo = true; cv.setPointerCapture(ev.pointerId); ev.preventDefault(); }
    });
    cv.addEventListener('pointermove', (ev) => {
      const p = lienzo.posicion(ev);
      if (activo) mover(p.x, p.y); else if (pasar) pasar(p.x, p.y);
    });
    const fin = () => { activo = false; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (!activo && salir) salir(); });
  }
  const dentroDe = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ALTO_PLANO = { proporcion: 0.78, altoMin: 290, altoMax: 470 };

  // Poliedro de la primera figura: x₁, x₂ ≥ 0, x₁ + 2x₂ ≥ 2, x₁ − x₂ ≤ 5.
  const REGION = [{ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }, { a: [-1, -2], b: -2 }, { a: [1, -1], b: 5 }];

  /* ---------- Fig. 1: P = combinación convexa de vértices + combinación cónica de direcciones ---------- */

  function montarRepresentacion(cuerpo) {
    const an = analizar(REGION);
    const V = an.V.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const D = direcciones(an).sort((p, q) => p[0] - q[0]);
    const nV = V.length, nD = D.length, COLD = [C.s2, C.s3];
    let lam = [0.3, 0.4, 0.3], mu = [1, 1.5], P = [0, 0], fuera = false, criterio = 'min', pl = null;
    const ctl = VIZ.controles(cuerpo);
    const sl = V.map((v, i) => ctl.rango({
      etiqueta: `λ${'₁₂₃'[i]} (V${'₁₂₃'[i]})`, min: 0, max: 1, paso: 0.01, valor: lam[i], formato: (q) => VIZ.fmt(q, 2),
      alCambiar: (q) => { fijar(i, q); },
    }));
    const sm = D.map((d, j) => ctl.rango({
      etiqueta: `μ${'₁₂'[j]} (d${'₁₂'[j]})`, min: 0, max: 6, paso: 0.1, valor: mu[j], formato: (q) => VIZ.fmt(q, 2),
      alCambiar: (q) => { mu[j] = q; fuera = false; actualizar(); },
    }));
    ctl.selector({ etiqueta: 'Al arrastrar P, usar', opciones: [['min', 'mínimo de direcciones'], ['max', 'máximo de direcciones']], valor: criterio, alCambiar: (v) => { criterio = v; if (!fuera) resolverP(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'vértices V₁, V₂, V₃', forma: 'punto' },
      { color: VIZ.alfa(C.s1, 0.2), texto: 'conv(V₁, V₂, V₃)', forma: 'cuadro' },
      { color: C.s1, texto: 'q = Σ λᵢVᵢ (parte acotada)', forma: 'punto' },
      { color: C.s2, texto: 'μ₁d₁', forma: 'linea' },
      { color: C.s3, texto: 'μ₂d₂', forma: 'linea' },
      { color: C.s6, texto: 'P dentro del poliedro', forma: 'punto' },
      { color: C.s8, texto: 'P fuera: no hay representación', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre P: se calcula una representación (por programación lineal) y los deslizadores la muestran; o mueva los deslizadores y vea dónde llega P. Cambie el criterio: el mismo punto admite varias representaciones. Fuera del poliedro no existe ninguna.');
    const combinar = () => {
      const q = [0, 0];
      V.forEach((v, i) => { q[0] += lam[i] * v[0]; q[1] += lam[i] * v[1]; });
      const p = q.slice();
      D.forEach((d, j) => { p[0] += mu[j] * d[0]; p[1] += mu[j] * d[1]; });
      return { q, p };
    };
    function fijar(i, q) {
      const resto = 1 - q, s = lam.reduce((t, x, j) => (j === i ? t : t + x), 0);
      lam = lam.map((x, j) => (j === i ? q : s > 1e-9 ? (x * resto) / s : resto / (nV - 1)));
      fuera = false;
      actualizar();
    }
    function actualizar() {
      sl.forEach((s, i) => { s.valor = dentroDe(lam[i], 0, 1); });
      sm.forEach((s, j) => { s.valor = dentroDe(mu[j], 0, 6); });
      P = combinar().p;
      dibujar();
    }
    // Representación de P: λ ≥ 0, Σλ = 1, μ ≥ 0, Σ λᵢVᵢ + Σ μⱼdⱼ = P, con Σμ mínimo o máximo.
    function resolverP() {
      const A = [[...V.map((v) => v[0]), ...D.map((d) => d[0])], [...V.map((v) => v[1]), ...D.map((d) => d[1])], [...V.map(() => 1), ...D.map(() => 0)]];
      const r = VIZ.opt.lp([...V.map(() => 0), ...D.map(() => 1)], A, ['=', '=', '='], [P[0], P[1], 1], { max: criterio === 'max' });
      if (r.estado !== 'optimo') { fuera = true; return; }
      fuera = false;
      lam = r.x.slice(0, nV).map((v) => Math.max(0, v));
      const s = lam.reduce((t, x) => t + x, 0);
      lam = lam.map((x) => x / s);
      mu = r.x.slice(nV).map((v) => Math.max(0, v));
      sl.forEach((q, i) => { q.valor = dentroDe(lam[i], 0, 1); });
      sm.forEach((q, j) => { q.valor = dentroDe(mu[j], 0, 6); });
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: -1, xmax: 10, ymin: -1, ymax: 8 });
      pl.ejes();
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.12), C.s6, 2.5);
      poligono(ctx, pl, V, VIZ.alfa(C.s1, 0.2), C.s1, 1.5);
      const { q } = combinar();
      if (!fuera) {
        const m1 = [q[0] + mu[0] * D[0][0], q[1] + mu[0] * D[0][1]];
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.sy(0)); ctx.lineTo(pl.sx(q[0]), pl.sy(q[1])); ctx.stroke(); ctx.restore();
        flechaD(ctx, pl, q, m1, COLD[0], 3.5);
        flechaD(ctx, pl, m1, P, COLD[1], 3.5);
        VIZ.marcador(ctx, pl.sx(q[0]), pl.sy(q[1]), C.s1, 6, 1);
        texto(ctx, 'q', pl.sx(q[0]) + 10, pl.sy(q[1]) + 12, C.tinta, 'left', 12, 600);
      }
      V.forEach((v, i) => {
        VIZ.marcador(ctx, pl.sx(v[0]), pl.sy(v[1]), C.tinta, 5.5);
        texto(ctx, `V${'₁₂₃'[i]}`, pl.sx(v[0]) - 10, pl.sy(v[1]) + 14, C.tinta, 'right', 12, 600);
      });
      VIZ.marcador(ctx, pl.sx(P[0]), pl.sy(P[1]), fuera ? C.s8 : C.s6, 7, fuera ? 5 : 0);
      texto(ctx, 'P', pl.sx(P[0]) + 11, pl.sy(P[1]) - 10, C.tinta, 'left', 13, 600);
      const f = (v) => VIZ.fmt(v, 3);
      registro.textContent = fuera
        ? `P = (${f(P[0])}, ${f(P[1])}) no pertenece al poliedro: ninguna combinación convexa de vértices más combinación no negativa de direcciones llega hasta allí.`
        : `P = ${lam.map((l, i) => `${f(l)}·V${'₁₂₃'[i]}`).join(' + ')} + ${mu.map((m, j) => `${f(m)}·d${'₁₂'[j]}`).join(' + ')}, con Σλ = ${f(lam.reduce((t, x) => t + x, 0))}.`;
      lectura.set([
        ['λ', lam.map((l) => f(l)).join(', ')],
        ['μ', mu.map((m) => f(m)).join(', ')],
        ['q = Σ λᵢVᵢ', `(${f(q[0])}, ${f(q[1])})`],
        ['P', `(${f(P[0])}, ${f(P[1])})`],
        ['d₁, d₂', D.map((d) => `(${f(d[0])}, ${f(d[1])})`).join('  ')],
        ['P ∈ poliedro', fuera ? 'no' : 'sí'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const mover = (x, y) => { P = [dentroDe(pl.ix(x), pl.d.xmin, pl.d.xmax), dentroDe(pl.iy(y), pl.d.ymin, pl.d.ymax)]; resolverP(); dibujar(); };
    interaccion(lienzo, {
      tomar: (x, y) => { if (!pl) return false; mover(x, y); return true; },
      mover,
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const v = V.findIndex((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 10);
        if (v >= 0) tip.mostrar(x, y, `vértice V${'₁₂₃'[v]} = (<b>${VIZ.fmt(V[v][0], 3)}</b>, <b>${VIZ.fmt(V[v][1], 3)}</b>)<br>punto extremo del poliedro`);
        else tip.ocultar();
      },
      salir: () => tip.ocultar(),
    });
    actualizar();
  }

  /* ---------- Fig. 2: el LP, los vértices y las direcciones ---------- */

  const REGIONES = {
    dos: { nombre: 'No acotada: dos direcciones extremas', R: REGION },
    una: { nombre: 'Franja: una dirección extrema', R: [{ a: [-1, 0], b: 0 }, { a: [1, 0], b: 3 }, { a: [0, -1], b: -1 }] },
    acotada: { nombre: 'Acotada: sin direcciones', R: [...REGION, { a: [1, 1], b: 7 }] },
  };

  function montarLP(cuerpo) {
    let clave = 'dos', ang = 45, pl = null, info = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Región', opciones: Object.entries(REGIONES).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const rAng = ctl.rango({ etiqueta: 'Dirección de c', min: 0, max: 355, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'punto extremo (vértice)', forma: 'punto' },
      { color: C.s2, texto: 'dirección extrema d', forma: 'linea' },
      { color: C.s7, texto: 'objetivo c', forma: 'linea' },
      { color: C.s6, texto: 'óptimo de max c·x', forma: 'punto' },
      { color: C.s8, texto: 'dirección que mejora c sin límite (c·d > 0)', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gire c con el deslizador o arrastrando sobre el gráfico. El óptimo es el vértice de mayor c·v mientras todas las c·d sean ≤ 0; en cuanto una c·d sea positiva, el problema no tiene máximo.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: -1, xmax: 10, ymin: -1, ymax: 8 });
      pl.ejes();
      const R = REGIONES[clave].R, an = analizar(R);
      const V = an.V.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]), D = direcciones(an).sort((p, q) => p[0] - q[0]);
      const c = [Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
      const sol = resolver2d(R, c, an);
      info = { an, V };
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.15), C.s6, 2.5);
      if (sol.estado === 'optimo') recta(ctx, pl, c, sol.z, C.s7, 1.8, [6, 4]);
      D.forEach((d, j) => {
        const o = an.rayos.find((r) => dot(r.d, d) > 1 - 1e-9).o, mala = dot(c, d) > 1e-9;
        flechaD(ctx, pl, o, [o[0] + 2.2 * d[0], o[1] + 2.2 * d[1]], mala ? C.s8 : C.s2, 3.5);
        texto(ctx, `d${'₁₂'[j]}`, pl.sx(o[0] + 2.2 * d[0]) + 8, pl.sy(o[1] + 2.2 * d[1]) - 8, C.tinta, 'left', 12, 600);
      });
      const cen = [5.2, 3.2];
      flechaD(ctx, pl, cen, [cen[0] + 1.7 * c[0], cen[1] + 1.7 * c[1]], C.s7, 3);
      texto(ctx, 'c', pl.sx(cen[0] + 1.7 * c[0]) + 8, pl.sy(cen[1] + 1.7 * c[1]) - 8, C.tinta, 'left', 13, 600);
      V.forEach((v, i) => {
        VIZ.marcador(ctx, pl.sx(v[0]), pl.sy(v[1]), sol.estado === 'optimo' && sol.V.includes(v) ? C.s6 : C.tinta, sol.estado === 'optimo' && sol.V.includes(v) ? 8 : 5.5, sol.estado === 'optimo' && sol.V.includes(v) ? 6 : 0);
        texto(ctx, `V${'₁₂₃₄₅₆'[i]}`, pl.sx(v[0]) - 10, pl.sy(v[1]) + 14, C.tinta, 'right', 12, 600);
      });
      const f = (v) => VIZ.fmt(v, 3);
      const filas = [
        ...V.map((v, i) => [`V${'₁₂₃₄₅₆'[i]} = (${f(v[0])}, ${f(v[1])})`, 'c·v', f(dot(c, v)), sol.estado === 'optimo' && sol.V.includes(v)]),
        ...D.map((d, j) => [`d${'₁₂'[j]} = (${f(d[0])}, ${f(d[1])})`, 'c·d', f(dot(c, d)), dot(c, d) > 1e-9]),
      ];
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('tr', null, ...['punto o dirección', 'producto', 'valor', 'papel'].map((t) => VIZ.el('th', null, t))),
        ...filas.map(([n, p, v, marca], i) => VIZ.el('tr', { class: marca ? 'activa' : '' },
          VIZ.el('td', null, n), VIZ.el('td', null, p), VIZ.el('td', null, v),
          VIZ.el('td', null, i < V.length ? (marca ? 'óptimo' : '') : (marca ? 'c·d > 0: mejora sin límite' : 'c·d ≤ 0')) ))));
      registro.textContent = sol.estado === 'noacotado'
        ? `max c·x = +∞: avanzar desde cualquier punto factible en la dirección extrema (${f(sol.dir[0])}, ${f(sol.dir[1])}) aumenta c·x en ${f(dot(c, sol.dir))} por unidad de largo.`
        : sol.estado === 'optimo'
          ? `Todas las direcciones extremas cumplen c·d ≤ 0${D.length ? '' : ' (no hay ninguna)'}: el máximo ${VIZ.fmt(sol.z)} se alcanza en ${sol.V.length > 1 ? 'una arista, y en particular en sus vértices' : 'un vértice'}.`
          : 'Región vacía.';
      lectura.set([
        ['puntos extremos', String(V.length)],
        ['direcciones extremas', String(D.length)],
        ['c', `(${f(c[0])}, ${f(c[1])})`],
        ['max c·x', sol.estado === 'noacotado' ? '+∞' : sol.estado === 'optimo' ? VIZ.fmt(sol.z) : '—'],
        ['teorema', sol.estado === 'noacotado' ? 'existe d con c·d > 0' : 'óptimo en un vértice'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const girar = (x, y) => {
      const dx = pl.ix(x) - 5.2, dy = pl.iy(y) - 3.2;
      if (Math.hypot(dx, dy) < 0.2) return;
      ang = (Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 5) * 5 + 360) % 360;
      rAng.valor = ang;
      dibujar();
    };
    interaccion(lienzo, {
      tomar: (x, y) => { if (!pl) return false; girar(x, y); return true; },
      mover: girar,
      pasar: (x, y) => {
        if (!pl || !info) return tip.ocultar();
        const i = info.V.findIndex((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 10);
        if (i < 0) return tip.ocultar();
        const c = [Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)];
        tip.mostrar(x, y, `V${'₁₂₃₄₅₆'[i]} = (<b>${VIZ.fmt(info.V[i][0], 3)}</b>, <b>${VIZ.fmt(info.V[i][1], 3)}</b>)<br>c·v = <b>${VIZ.fmt(dot(c, info.V[i]))}</b>`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  VIZ.registrarTema('extreme-points-directions', {
    intro: String.raw`
      <p>Un poliedro, aunque tenga infinitos puntos, queda descrito por muy pocos datos: sus <strong>puntos extremos</strong> (los vértices, que no se pueden obtener como mezcla de otros dos puntos
      del poliedro) y, si no está acotado, sus <strong>direcciones extremas</strong> (los rayos a lo largo de los cuales se puede avanzar para siempre sin salir).</p>
      <p>El <strong>teorema de representación</strong> dice que todo punto es un vértice «promedio» más un desplazamiento hacia el infinito en esas direcciones. Con él se entiende de inmediato
      por qué un LP tiene su óptimo en un vértice, o ninguno si hay una dirección que mejora el objetivo sin límite.</p>`,
    visualizaciones: [
      {
        titulo: 'Un punto como vértices más direcciones',
        descripcion: 'Arrastre P por el poliedro y vea su descomposición \\(P = q + \\mu_1 d_1 + \\mu_2 d_2\\) con \\(q\\) en el triángulo de los vértices; cambie el criterio para ver otra representación del mismo punto y pruebe a salir del poliedro.',
        montar: montarRepresentacion,
      },
      {
        titulo: 'Direcciones extremas y el óptimo del LP',
        descripcion: 'Gire c y compare los valores c·v de los vértices con c·d de las direcciones: el problema es no acotado justo cuando alguna c·d es positiva. Cambie de región para ver el caso acotado y el de una sola dirección.',
        montar: montarLP,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea \(P=\{x : Ax\le b\}\) un poliedro no vacío. Un punto \(x\in P\) es <strong>extremo</strong> si no puede escribirse como \(x=\tfrac12(y+z)\) con \(y\ne z\) en \(P\).
      Si \(P\) no contiene rectas, los puntos extremos son exactamente los <a href="tema.html?id=polyhedra-vertices">vértices</a>.</p>
      <p>El <strong>cono de recesión</strong> es \(\operatorname{rec}(P)=\{d : Ad\le 0\}\). Un vector \(d\ne0\) es una <strong>dirección</strong> de \(P\) si \(x+td\in P\) para todo \(x\in P\) y todo \(t\ge0\).
      Es <strong>extrema</strong> si no es suma de dos direcciones no proporcionales; las direcciones extremas son los generadores mínimos del cono. En el plano corresponden a los lados no acotados de la frontera.</p>
      <h2>Teorema de representación</h2>
      <div class="recuadro"><p>Si \(P\) es un poliedro no vacío sin rectas, con puntos extremos \(v_1,\dots,v_k\) y direcciones extremas \(d_1,\dots,d_r\), entonces
      \[ P = \Big\{\sum_{i=1}^{k}\lambda_i v_i + \sum_{j=1}^{r}\mu_j d_j \;:\; \lambda_i\ge0,\ \sum_i\lambda_i=1,\ \mu_j\ge0\Big\}. \]
      Es decir, \(P=\operatorname{conv}(v_1,\dots,v_k)+\operatorname{cono}(d_1,\dots,d_r)\).</p></div>
      <p>La representación <em>no es única</em>: en la figura hay 3 vértices y 2 direcciones (5 incógnitas) y solo 3 ecuaciones. Encontrar una es un LP de factibilidad; si es infactible, el punto no pertenece a \(P\).
      Si \(P\) es acotado no hay direcciones y se recupera el hecho de que un politopo es la <a href="tema.html?id=convex-combinations">envoltura convexa</a> de sus vértices.</p>
      <h2>Consecuencia para la programación lineal</h2>
      <p>Para \(\max c^\top x\) sobre \(P\) y \(x=\sum\lambda_iv_i+\sum\mu_jd_j\) se tiene</p>
      \[ c^\top x = \sum_i\lambda_i\,c^\top v_i + \sum_j\mu_j\,c^\top d_j. \]
      <ul>
        <li>Si algún \(c^\top d_j>0\), se hace \(\mu_j\to\infty\) y el problema es <strong>no acotado</strong> (<a href="tema.html?id=unbounded-infeasible">problemas no acotados e infactibles</a>).</li>
        <li>Si todos \(c^\top d_j\le0\), lo mejor es \(\mu=0\) y \(\lambda\) concentrado en el mejor vértice: el óptimo existe y se alcanza en un <strong>punto extremo</strong>.</li>
      </ul>
      <p>Este es el argumento detrás de la geometría del <a href="tema.html?id=simplex-tableau">Simplex</a> y de la afirmación «basta mirar los vértices» de la
      <a href="tema.html?id=optimal-solution-geometry">geometría de las soluciones óptimas</a>.</p>
      <h2>Cálculo</h2>
      <pre><code>puntos extremos:     resolver A_S x = b_S para cada S de n filas independientes; conservar los factibles
direcciones extremas: resolver A_S d = 0 con d ≠ 0 y A d ≤ 0 para S de n − 1 filas independientes</code></pre>
      <p>En forma estándar \(\{x\ge0 : Ax=b\}\), los puntos extremos son las <a href="tema.html?id=basic-feasible-solutions">soluciones básicas factibles</a> y las direcciones extremas salen de columnas no básicas con
      todas las entradas del tableau \(\le0\).</p>`,
  });
})();
