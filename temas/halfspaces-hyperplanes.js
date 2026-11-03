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

  /* ---------- Fig. 1: un hiperplano, su semiespacio y su normal ---------- */

  function montarSemiplano(cuerpo) {
    const a = [2, 1];
    let b = 6, P = [5.5, 4.5], inv = false, niveles = true, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'a₁', min: -4, max: 4, paso: 0.5, valor: a[0], alCambiar: (v) => { a[0] = v; dibujar(); } });
    ctl.rango({ etiqueta: 'a₂', min: -4, max: 4, paso: 0.5, valor: a[1], alCambiar: (v) => { a[1] = v; dibujar(); } });
    ctl.rango({ etiqueta: 'b', min: -10, max: 14, paso: 0.5, valor: b, alCambiar: (v) => { b = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Semiespacio a·x ≥ b', valor: inv, alCambiar: (v) => { inv = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Curvas de nivel de a·x', valor: niveles, alCambiar: (v) => { niveles = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'hiperplano a·x = b', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.2), texto: 'semiespacio', forma: 'cuadro' },
      { color: C.s2, texto: 'vector normal a (unitario, dibujado)', forma: 'linea' },
      { color: C.s7, texto: 'punto P', forma: 'punto' },
      { color: C.s3, texto: 'distancia de P al hiperplano', forma: 'linea' },
      { color: C.eje, texto: 'a·x = b ± k‖a‖', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para colocar P. Cambie a₁, a₂ y b: la recta gira o se desplaza, y la flecha naranja siempre sale perpendicular hacia el lado donde a·x crece.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: -3, xmax: 10, ymin: -3, ymax: 8 });
      pl.ejes();
      const na = norma(a);
      if (na < EPS) {
        texto(ctx, 'a = 0: no define un hiperplano (0 ≤ b es siempre cierto o siempre falso)', pl.x0 + 8, pl.y1 + 14, C.s8);
        registro.textContent = 'Con a = 0 la desigualdad no depende de x: no hay recta ni normal.';
        lectura.set([['a', '(0, 0)'], ['b', VIZ.fmt(b)]]);
        return;
      }
      const sg = inv ? -1 : 1;
      poligono(ctx, pl, VIZ.opt.poligono([{ a: [sg * a[0], sg * a[1]], b: sg * b }], pl.d), VIZ.alfa(C.s1, 0.14));
      if (niveles) for (let k = -12; k <= 12; k++) if (k) recta(ctx, pl, a, b + k * na, C.eje, 1, [2, 4]);
      recta(ctx, pl, a, b, C.s1, 3);
      const F = [(a[0] * b) / (na * na), (a[1] * b) / (na * na)], u = [a[0] / na, a[1] / na];
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.sy(0)); ctx.lineTo(pl.sx(F[0]), pl.sy(F[1])); ctx.stroke();
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(0), pl.sy(0), C.apagado, 3.5);
      const punta = [F[0] + 1.8 * u[0], F[1] + 1.8 * u[1]];
      flechaD(ctx, pl, F, punta, C.s2, 3);
      texto(ctx, 'a', pl.sx(punta[0]) + 8 * u[0] + 4, pl.sy(punta[1]) - 8 * u[1] - 4, C.s2, 'left', 13, 600);
      // Proyección de P sobre el hiperplano.
      const s = dot(a, P), t = (s - b) / (na * na), Q = [P[0] - t * a[0], P[1] - t * a[1]];
      ctx.save();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = C.s3; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pl.sx(P[0]), pl.sy(P[1])); ctx.lineTo(pl.sx(Q[0]), pl.sy(Q[1])); ctx.stroke();
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(Q[0]), pl.sy(Q[1]), C.s3, 3.5);
      VIZ.marcador(ctx, pl.sx(P[0]), pl.sy(P[1]), C.s7, 6);
      texto(ctx, 'P', pl.sx(P[0]) + 10, pl.sy(P[1]) - 10, C.s7, 'left', 12, 600);
      const ok = inv ? s >= b - EPS : s <= b + EPS, sen = inv ? '≥' : '≤';
      registro.textContent = `${lineal(a)} ${sen} ${VIZ.fmt(b)}: P ${ok ? 'cumple' : 'no cumple'} la desigualdad. Avanzar 1 unidad a lo largo de a/‖a‖ suma ‖a‖ = ${VIZ.fmt(na)} a a·x.`;
      lectura.set([
        ['a·P', VIZ.fmt(s)],
        ['b', VIZ.fmt(b)],
        [inv ? 'holgura a·P − b' : 'holgura b − a·P', VIZ.fmt(inv ? s - b : b - s)],
        ['distancia con signo (a·P − b)/‖a‖', VIZ.fmt((s - b) / na)],
        ['distancia del origen |b|/‖a‖', VIZ.fmt(Math.abs(b) / na)],
        ['P en el semiespacio', ok ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const colocar = (x, y) => { P = [dentroDe(pl.ix(x), pl.d.xmin, pl.d.xmax), dentroDe(pl.iy(y), pl.d.ymin, pl.d.ymax)]; dibujar(); };
    interaccion(lienzo, {
      tomar: (x, y) => { if (!pl) return false; colocar(x, y); return true; },
      mover: colocar,
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const p = [pl.ix(x), pl.iy(y)];
        tip.mostrar(x, y, `punto (<b>${VIZ.fmt(p[0], 3)}</b>, <b>${VIZ.fmt(p[1], 3)}</b>)<br>a·x = <b>${VIZ.fmt(dot(a, p))}</b>`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Fig. 2: intersección de semiespacios ---------- */

  function montarInterseccion(cuerpo) {
    const R = [
      { a: [1, 2], b: 10, color: C.s1, activa: true },
      { a: [3, 1], b: 15, color: C.s2, activa: true },
      { a: [-1, 1], b: 3, color: C.s3, activa: true },
      { a: [-1, -1], b: -2, color: C.s7, activa: true },
    ];
    const SIGNO = [{ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }];
    let nonneg = true, P = [2, 2], pl = null, vista = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas([
      ...R.map((r, i) => ({ clave: i, texto: `R${i + 1}`, color: r.color, activo: true })),
      { clave: 'n', texto: 'x₁, x₂ ≥ 0', color: C.tinta2, activo: true },
    ], (e) => { R.forEach((r, i) => { r.activa = e[i]; }); nonneg = e.n; dibujar(); });
    ctl.rango({ etiqueta: 'b de R1', min: 0, max: 14, paso: 0.5, valor: R[0].b, alCambiar: (v) => { R[0].b = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para colocar un punto de prueba y ver qué desigualdades cumple. Desactive restricciones o baje el b de R1 por debajo de 2: la intersección se agranda, se vuelve no acotada o queda vacía.');

    const lista2 = () => [...R.filter((r) => r.activa), ...(nonneg ? SIGNO : [])];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: -1.5, xmax: 9.5, ymin: -1.5, ymax: 8 });
      pl.ejes();
      const restr = lista2();
      const an = analizar(restr);
      vista = an;
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.18), null);
      // Lado prohibido de cada restricción, con un trazo tenue, y la recta.
      for (const r of R) if (r.activa) recta(ctx, pl, r.a, r.b, r.color, 2.5);
      if (nonneg) for (const r of SIGNO) recta(ctx, pl, r.a, r.b, C.tinta2, 2);
      poligono(ctx, pl, an.P, null, C.s6, 3);
      // Normales (hacia fuera de cada semiespacio) desde el punto de la recta más cercano al centro de la región.
      const cen = an.V.length ? [an.V.reduce((s, p) => s + p[0], 0) / an.V.length, an.V.reduce((s, p) => s + p[1], 0) / an.V.length] : [4, 3];
      for (const r of R) {
        if (!r.activa) continue;
        const na2 = dot(r.a, r.a), t = (dot(r.a, cen) - r.b) / na2, F = [cen[0] - t * r.a[0], cen[1] - t * r.a[1]], u = unit(r.a);
        if (F[0] < pl.d.xmin + 0.3 || F[0] > pl.d.xmax - 0.3 || F[1] < pl.d.ymin + 0.3 || F[1] > pl.d.ymax - 0.8) continue;
        flechaD(ctx, pl, F, [F[0] + 0.9 * u[0], F[1] + 0.9 * u[1]], r.color, 2);
      }
      for (const p of an.V) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), C.tinta, 4.5);
      const ok = restr.every((r) => dot(r.a, P) <= r.b + EPS);
      VIZ.marcador(ctx, pl.sx(P[0]), pl.sy(P[1]), ok ? C.s6 : C.s8, 6.5, ok ? 0 : 5);
      leyenda.set([
        ...R.map((r, i) => ({ color: r.color, texto: `R${i + 1}: ${lineal(r.a)} ≤ ${VIZ.fmt(r.b)}${r.activa ? '' : ' (apagada)'}`, forma: 'linea' })),
        { color: VIZ.alfa(C.s6, 0.3), texto: 'región factible (intersección)', forma: 'cuadro' },
        { color: C.tinta, texto: 'vértice', forma: 'punto' },
        { color: C.s6, texto: 'P factible', forma: 'punto' },
        { color: C.s8, texto: 'P infactible', forma: 'punto' },
      ]);
      const filas = R.map((r, i) => ({ r, i })).filter(({ r }) => r.activa).map(({ r, i }) => [`R${i + 1}`, r.a, r.b, r.color])
        .concat(nonneg ? [['x₁ ≥ 0', SIGNO[0].a, 0, C.tinta2], ['x₂ ≥ 0', SIGNO[1].a, 0, C.tinta2]] : []);
      lista.replaceChildren(...filas.map(([n, a, b, col]) => {
        const v = dot(a, P), cumple = v <= b + EPS;
        return VIZ.el('div', null, VIZ.el('span', { style: { color: col, fontWeight: '600' } }, n.padEnd(7, '\u00a0')),
          `${lineal(a)} = ${VIZ.fmt(v)} ${cumple ? '≤' : '>'} ${VIZ.fmt(b)}  `, VIZ.el('span', { style: { color: cumple ? C.s6 : C.s8 } }, cumple ? '✓' : '✗ viola'));
      }));
      const viol = restr.filter((r) => dot(r.a, P) > r.b + EPS).length;
      registro.textContent = an.vacio ? 'La intersección está vacía: ningún punto cumple todas las desigualdades a la vez.'
        : `${restr.length} semiplanos se intersecan en una región ${an.acotado ? 'acotada (un polígono)' : 'no acotada'} con ${an.V.length} vértice(s). P ${ok ? 'está dentro' : `queda fuera: viola ${viol}`}.`;
      lectura.set([
        ['semiespacios', String(restr.length)],
        ['vértices', String(an.V.length)],
        ['región', an.vacio ? 'vacía' : an.acotado ? 'acotada' : 'no acotada'],
        ['área', an.vacio ? '0' : an.acotado ? VIZ.fmt(area(an.P)) : '∞'],
        ['P factible', ok ? 'sí' : `no (viola ${viol})`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const colocar = (x, y) => { P = [dentroDe(pl.ix(x), pl.d.xmin, pl.d.xmax), dentroDe(pl.iy(y), pl.d.ymin, pl.d.ymax)]; dibujar(); };
    interaccion(lienzo, {
      tomar: (x, y) => { if (!pl) return false; colocar(x, y); return true; },
      mover: colocar,
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const v = vista.V.find((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 9);
        const restr = lista2();
        if (v) {
          const act = activas(restr, v).map((i) => restr[i]);
          tip.mostrar(x, y, `vértice (<b>${VIZ.fmt(v[0], 3)}</b>, <b>${VIZ.fmt(v[1], 3)}</b>)<br>${act.length} restricciones con igualdad`);
        } else {
          const p = [pl.ix(x), pl.iy(y)], c = restr.filter((r) => dot(r.a, p) <= r.b + EPS).length;
          tip.mostrar(x, y, `punto (<b>${VIZ.fmt(p[0], 3)}</b>, <b>${VIZ.fmt(p[1], 3)}</b>)<br>cumple <b>${c}</b> de ${restr.length}`);
        }
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  VIZ.registrarTema('halfspaces-hyperplanes', {
    intro: String.raw`
      <p>Una desigualdad lineal \(a_1x_1 + a_2x_2 \le b\) divide el plano en dos mitades: la recta \(a\cdot x = b\) y, a un lado, los puntos que la
      cumplen. En más dimensiones la recta es un <strong>hiperplano</strong> y cada mitad un <strong>semiespacio</strong>. El vector \(a\) es
      perpendicular al hiperplano y apunta hacia donde \(a\cdot x\) crece.</p>
      <p>Toda restricción de un problema de <a href="tema.html?id=problem-classes">programación lineal</a> es un semiespacio, y la región factible es su
      intersección. Entender esa intersección es el primer paso para ver por qué el óptimo vive en un
      <a href="tema.html?id=polyhedra-vertices">vértice</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Hiperplano, semiespacio y normal',
        descripcion: 'Mueva a₁, a₂ y b y observe que la flecha naranja sigue siendo perpendicular a la recta; arrastre P y compare su distancia con signo con la holgura \\(b - a\\cdot P\\).',
        montar: montarSemiplano,
      },
      {
        titulo: 'La región factible como intersección',
        descripcion: 'Active y desactive semiplanos, cambie el b de R1 y coloque puntos de prueba: pruebe b de R1 menor que 2 para ver una intersección vacía, o quite \\(x_1, x_2 \\ge 0\\) para obtener una región no acotada.',
        montar: montarInterseccion,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sean \(a \in \mathbb{R}^n\), \(a \ne 0\), y \(b \in \mathbb{R}\). El <strong>hiperplano</strong> es \(H = \{x : a^\top x = b\}\) y los dos
      <strong>semiespacios cerrados</strong> que determina son</p>
      \[ H^- = \{x : a^\top x \le b\}, \qquad H^+ = \{x : a^\top x \ge b\}. \]
      <p>Ambos son conjuntos <a href="tema.html?id=convex-sets-functions">convexos</a>. Si \(x, y\) cumplen \(a^\top x \le b\) y \(a^\top y \le b\), entonces para
      \(\lambda \in [0,1]\): \(a^\top(\lambda x + (1-\lambda)y) = \lambda a^\top x + (1-\lambda)a^\top y \le b\).</p>
      <h2>Vector normal y distancia</h2>
      <p>Si \(x_0, x_1 \in H\), entonces \(a^\top(x_1 - x_0) = 0\): \(a\) es ortogonal a toda dirección contenida en \(H\). El punto de \(H\) más cercano al origen es
      \(\dfrac{b}{\|a\|^2}\,a\), a distancia \(|b|/\|a\|\). Para un punto cualquiera \(p\), la distancia con signo al hiperplano y su proyección son</p>
      \[ d(p) = \frac{a^\top p - b}{\|a\|}, \qquad \pi(p) = p - \frac{a^\top p - b}{\|a\|^2}\,a. \]
      <p>Es negativa dentro de \(H^-\), cero sobre \(H\) y positiva fuera. La cantidad \(b - a^\top p\) (la <em>holgura</em>) es \(\|a\|\) veces la distancia al borde, y por eso
      multiplicar una restricción por una constante positiva no cambia el semiespacio.</p>
      <h2>La región factible</h2>
      <p>Un sistema \(Ax \le b\) con \(m\) filas es la intersección de \(m\) semiespacios: \(P = \bigcap_{i=1}^{m}\{x : a_i^\top x \le b_i\}\). Una intersección de conjuntos
      convexos es convexa, así que \(P\) lo es; puede ser vacía, acotada o no acotada. En 2-D se calcula recortando un polígono grande con cada semiplano
      (algoritmo de Sutherland–Hodgman), que es lo que dibuja la segunda figura.</p>
      <div class="recuadro"><p><strong>Dirección de mejora.</strong> Al maximizar \(c^\top x\), el gradiente \(c\) es la normal de las curvas de nivel \(c^\top x = z\) y apunta hacia donde
      el objetivo mejora. El óptimo es el último punto de \(P\) que toca una curva de nivel al desplazarla en la dirección \(c\);
      véase la <a href="tema.html?id=optimal-solution-geometry">geometría de las soluciones óptimas</a>.</p></div>
      <h2>Conexiones</h2>
      <ul>
        <li>Combinaciones de puntos y envolturas: <a href="tema.html?id=convex-combinations">combinaciones convexas</a>.</li>
        <li>Esquinas de la intersección: <a href="tema.html?id=polyhedra-vertices">poliedros, politopos y vértices</a> y <a href="tema.html?id=active-constraints-bfs">restricciones activas</a>.</li>
        <li>Las restricciones \(\le\) y \(\ge\) pasan a igualdades con <a href="tema.html?id=standard-form">variables de holgura</a>.</li>
      </ul>`,
  });
})();
