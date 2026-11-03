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

  /* ---------- Fig. 1: editar restricciones y contar ---------- */

  function montarEditar(cuerpo) {
    let n = 5, semilla = 1, nonneg = true, R = [], pl = null, an = null;
    const SIGNO = [{ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Restricciones iniciales', min: 2, max: 9, valor: n, alCambiar: (v) => { n = v; generar(); dibujar(); } });
    ctl.casilla({ etiqueta: 'Incluir x₁, x₂ ≥ 0', valor: nonneg, alCambiar: (v) => { nonneg = v; dibujar(); } });
    ctl.boton('Nuevas restricciones', () => { semilla++; generar(); dibujar(); }, { primario: true });
    ctl.boton('Quitar la última', () => { R.pop(); dibujar(); });
    ctl.boton('Quitar todas', () => { R = []; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'restricción que forma una arista', forma: 'linea' },
      { color: C.inactivo, texto: 'restricción redundante', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.3), texto: 'poliedro (región factible)', forma: 'cuadro' },
      { color: C.tinta, texto: 'vértice', forma: 'punto' },
      { color: C.s2, texto: 'dirección de una arista no acotada', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para agregar una restricción que pasa por ese punto y deja fuera el lado alejado de la región: si el punto está dentro, la recorta; si está fuera, queda redundante. Desmarque x₁, x₂ ≥ 0 para obtener un poliedro no acotado.');
    function generar() {
      const rnd = VIZ.semilla(semilla * 37 + n);
      R = Array.from({ length: n }, (_, i) => {
        const t = ((i + 0.5 + (rnd() - 0.5) * 0.6) / n) * (Math.PI / 2);
        let a = [Math.max(0, Math.round(4 * Math.cos(t))), Math.max(0, Math.round(4 * Math.sin(t)))];
        if (!a[0] && !a[1]) a = [1, 1];
        return { a, b: Math.round(norma(a) * (3.4 + rnd() * 1.8)) };
      });
    }
    const todas = () => [...R, ...(nonneg ? SIGNO : [])];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: -1, xmax: 10, ymin: -1, ymax: 8 });
      pl.ejes();
      const restr = todas();
      an = analizar(restr);
      const facetas = restr.map((r) => an.P.filter((p) => Math.abs(dot(r.a, p) - r.b) < 1e-6).length >= 2);
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.2), null);
      restr.forEach((r, i) => { if (!facetas[i]) recta(ctx, pl, r.a, r.b, C.inactivo, 1.5, [5, 4]); });
      restr.forEach((r, i) => { if (facetas[i]) recta(ctx, pl, r.a, r.b, C.s1, 2.5); });
      poligono(ctx, pl, an.P, null, C.s6, 3);
      for (const ry of an.rayos) flechaD(ctx, pl, ry.o, [ry.o[0] + 1.3 * ry.d[0], ry.o[1] + 1.3 * ry.d[1]], C.s2, 2.5);
      for (const p of an.V) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), C.tinta, 5);
      lista.replaceChildren(...(restr.length ? restr.map((r, i) => VIZ.el('div', null,
        `${lineal(r.a)} ≤ ${VIZ.fmt(r.b)}`.padEnd(18, '\u00a0'),
        VIZ.el('span', { style: { color: facetas[i] ? C.s1 : C.apagado } }, facetas[i] ? '  arista' : '  redundante'))) : [VIZ.el('div', null, 'Sin restricciones: el espacio completo.')]));
      const red = facetas.filter((f) => !f).length, E = an.aristas.length;
      registro.textContent = an.vacio ? 'La región es vacía: las restricciones son incompatibles.'
        : `${restr.length} restricciones (${red} redundantes) definen un ${an.acotado ? 'politopo' : 'poliedro no acotado'} con ${an.V.length} vértices, ${E} aristas acotadas${an.rayos.length ? ` y ${an.rayos.length} semirrectas` : ''}.`;
      lectura.set([
        ['restricciones', String(restr.length)],
        ['redundantes', String(red)],
        ['vértices', String(an.V.length)],
        ['aristas acotadas', String(E)],
        ['semirrectas', String(an.rayos.length)],
        ['región', an.vacio ? 'vacía' : an.acotado ? 'politopo (acotado)' : 'poliedro no acotado'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    interaccion(lienzo, {
      tomar: (x, y) => {
        if (!pl || !pl.dentro(x, y) || R.length >= 14) return false;
        const p = [pl.ix(x), pl.iy(y)];
        const cen = an && an.V.length ? [an.V.reduce((s, q) => s + q[0], 0) / an.V.length, an.V.reduce((s, q) => s + q[1], 0) / an.V.length] : [0, 0];
        let u = unit([p[0] - cen[0], p[1] - cen[1]]);
        if (norma([p[0] - cen[0], p[1] - cen[1]]) < 1e-6) u = [1, 1];
        u = [+u[0].toFixed(2), +u[1].toFixed(2)];
        R.push({ a: u, b: +dot(u, p).toFixed(2) });
        dibujar();
        return false;
      },
      mover: () => {},
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y) || !an) return tip.ocultar();
        const v = an.V.find((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 10);
        if (!v) return tip.ocultar();
        const act = activas(todas(), v, 1e-6);
        tip.mostrar(x, y, `vértice (<b>${VIZ.fmt(v[0], 3)}</b>, <b>${VIZ.fmt(v[1], 3)}</b>)<br>${act.length} restricciones activas`);
      },
      salir: () => tip.ocultar(),
    });
    generar();
    dibujar();
  }

  /* ---------- Fig. 2: un poliedro 3-D proyectado ---------- */

  function resolver3(M, v) {
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(M);
    if (Math.abs(d) < 1e-9) return null;
    return [0, 1, 2].map((k) => det(M.map((fila, i) => fila.map((x, j) => (j === k ? v[i] : x)))) / d);
  }
  function rango3(filas) {
    const M = filas.map((f) => f.slice());
    let r = 0;
    for (let c = 0; c < 3 && r < M.length; c++) {
      let p = r;
      for (let i = r + 1; i < M.length; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
      if (Math.abs(M[p][c]) < 1e-7) continue;
      [M[r], M[p]] = [M[p], M[r]];
      for (let i = 0; i < M.length; i++) if (i !== r) { const k = M[i][c] / M[r][c]; for (let j = c; j < 3; j++) M[i][j] -= k * M[r][j]; }
      r++;
    }
    return r;
  }
  // Vértices, aristas y caras de { x ∈ ℝ³ : A x ≤ b } acotado.
  function poliedro3(R) {
    const V = [];
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) for (let k = j + 1; k < R.length; k++) {
      const x = resolver3([R[i].a, R[j].a, R[k].a], [R[i].b, R[j].b, R[k].b]);
      if (!x || !R.every((r) => dot3(r.a, x) <= r.b + 1e-7)) continue;
      if (!V.some((q) => Math.hypot(q.x[0] - x[0], q.x[1] - x[1], q.x[2] - x[2]) < 1e-6)) V.push({ x });
    }
    V.forEach((v) => { v.act = R.map((r, i) => (Math.abs(dot3(r.a, v.x) - r.b) < 1e-7 ? i : -1)).filter((i) => i >= 0); });
    const E = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
      const com = V[i].act.filter((q) => V[j].act.includes(q));
      if (com.length >= 2 && rango3(com.map((q) => R[q].a)) === 2) E.push([i, j]);
    }
    const F = R.map((_, q) => {
      const T = V.map((v, i) => i).filter((i) => V[i].act.includes(q));
      if (T.length < 3) return null;
      const d = T.slice(1).map((i) => V[i].x.map((c, k) => c - V[T[0]].x[k]));
      return rango3(d) >= 2 ? T : null;
    });
    return { V, E, F };
  }
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  function montarSolido(cuerpo) {
    const BASE = [];
    for (let i = 0; i < 3; i++) {
      const e = [0, 0, 0]; e[i] = 1;
      BASE.push({ a: e.map((v) => -v), b: 0 }, { a: e, b: 3 });
    }
    const CORTES = [
      { a: [1, 1, 1], b: 7, nombre: 'corte 1' },
      { a: [-1, -1, -1], b: -2, nombre: 'corte 2' },
      { a: [1, 1, 0], b: 5, nombre: 'corte 3' },
      { a: [-1, 0, 1], b: 2, nombre: 'corte 4' },
    ];
    const act = [true, false, false, false];
    let yaw = 0.7, pit = 0.45, sel = -1, vsel = -1, hover = -1, proy = [], res = null, R = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(CORTES.map((c, i) => ({ clave: i, texto: `Corte ${i + 1}: ${lineal(c.a)} ${i === 1 ? '≥ 2' : `≤ ${c.b}`}`, activo: act[i] })), (e) => { CORTES.forEach((_, i) => { act[i] = e[i]; }); recalcular(); dibujar(); });
    ctl.rango({ etiqueta: 'b del corte 1', min: 2, max: 9, paso: 0.5, valor: CORTES[0].b, alCambiar: (v) => { CORTES[0].b = v; recalcular(); dibujar(); } });
    const rGiro = ctl.rango({ etiqueta: 'Giro', min: -180, max: 180, paso: 5, valor: Math.round((yaw * 180) / Math.PI / 5) * 5, formato: (v) => `${v}°`, alCambiar: (v) => { yaw = (v * Math.PI) / 180; dibujar(); } });
    const rInc = ctl.rango({ etiqueta: 'Inclinación', min: -80, max: 80, paso: 5, valor: Math.round((pit * 180) / Math.PI / 5) * 5, formato: (v) => `${v}°`, alCambiar: (v) => { pit = (v * Math.PI) / 180; dibujar(); } });
    const selCara = ctl.selector({ etiqueta: 'Resaltar cara', opciones: [['-1', 'ninguna']], valor: '-1', alCambiar: (v) => { sel = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'vértice (3 restricciones activas)', forma: 'punto' },
      { color: C.s7, texto: 'vértice degenerado (más de 3 activas)', forma: 'punto' },
      { color: C.tinta2, texto: 'arista (más clara = más lejos)', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.3), texto: 'cara resaltada', forma: 'cuadro' },
      { color: C.s2, texto: 'aristas del vértice elegido', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre el sólido para girarlo (o use los deslizadores) y haga clic en un vértice para ver sus aristas y las restricciones que se anulan allí. Pruebe el corte 1 con b = 6: pasa justo por tres vértices del cubo y crea vértices degenerados.');
    const nombre = (i) => `${lineal(R[i].a)} ≤ ${VIZ.fmt(R[i].b)}`;
    function recalcular() {
      R = [...BASE, ...CORTES.filter((_, i) => act[i])];
      res = poliedro3(R);
      selCara.select.replaceChildren(...[['-1', 'ninguna'], ...R.map((r, i) => [String(i), `${nombre(i)}${res.F[i] ? '' : ' (sin cara)'}`])].map(([v, t]) => VIZ.el('option', { value: v }, t)));
      if (sel >= R.length || (sel >= 0 && !res.F[sel])) sel = -1;
      selCara.valor = String(sel);
      if (vsel >= res.V.length) vsel = -1;
    }
    function proyectar(x) {
      const p = [x[0] - 1.5, x[1] - 1.5, x[2] - 1.5];
      const cy = Math.cos(yaw), sy = Math.sin(yaw), X = cy * p[0] - sy * p[1], Y = sy * p[0] + cy * p[1];
      return [X, p[2] * Math.cos(pit) - Y * Math.sin(pit), Y * Math.cos(pit) + p[2] * Math.sin(pit)];
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const s = Math.min(W, H) / 5.6, cx = W / 2, cy = H / 2;
      proy = res.V.map((v) => { const q = proyectar(v.x); return [cx + s * q[0], cy - s * q[1], q[2]]; });
      if (sel >= 0 && res.F[sel]) {
        const T = res.F[sel], r = R[sel];
        // Ordena los vértices de la cara alrededor de su centro, en una base del plano.
        const c0 = [0, 1, 2].map((k) => T.reduce((t, i) => t + res.V[i].x[k], 0) / T.length);
        const n3 = r.a, ref = Math.abs(n3[0]) < 0.9 * Math.hypot(...n3) ? [1, 0, 0] : [0, 1, 0];
        const e1 = [n3[1] * ref[2] - n3[2] * ref[1], n3[2] * ref[0] - n3[0] * ref[2], n3[0] * ref[1] - n3[1] * ref[0]];
        const e2 = [n3[1] * e1[2] - n3[2] * e1[1], n3[2] * e1[0] - n3[0] * e1[2], n3[0] * e1[1] - n3[1] * e1[0]];
        const orden = T.slice().sort((i, j) => {
          const di = res.V[i].x.map((c, k) => c - c0[k]), dj = res.V[j].x.map((c, k) => c - c0[k]);
          return Math.atan2(dot3(di, e2), dot3(di, e1)) - Math.atan2(dot3(dj, e2), dot3(dj, e1));
        });
        ctx.beginPath();
        orden.forEach((i, k) => (k ? ctx.lineTo(proy[i][0], proy[i][1]) : ctx.moveTo(proy[i][0], proy[i][1])));
        ctx.closePath();
        ctx.fillStyle = VIZ.alfa(C.s1, 0.3); ctx.fill();
      }
      ctx.lineCap = 'round';
      const ds = proy.map((p) => p[2]), dMin = Math.min(...ds), dMax = Math.max(...ds);
      const cerca = (d) => 0.3 + (0.7 * (d - dMin)) / (dMax - dMin || 1); // más cerca del observador = más oscuro
      res.E.forEach(([i, j]) => {
        const resalta = vsel >= 0 && (i === vsel || j === vsel);
        ctx.strokeStyle = resalta ? C.s2 : VIZ.alfa(C.tinta2, cerca((proy[i][2] + proy[j][2]) / 2)); ctx.lineWidth = resalta ? 3.5 : 1.8;
        ctx.beginPath(); ctx.moveTo(proy[i][0], proy[i][1]); ctx.lineTo(proy[j][0], proy[j][1]); ctx.stroke();
      });
      res.V.forEach((v, i) => VIZ.marcador(ctx, proy[i][0], proy[i][1], VIZ.alfa(v.act.length > 3 ? C.s7 : C.tinta, cerca(proy[i][2])), i === vsel || i === hover ? 7 : 5));
      const nV = res.V.length, nE = res.E.length, nF = res.F.filter(Boolean).length, deg = res.V.filter((v) => v.act.length > 3).length;
      registro.textContent = vsel >= 0
        ? `Vértice (${res.V[vsel].x.map((c) => VIZ.fmt(c, 3)).join(', ')}): ${res.V[vsel].act.length} restricciones activas (${res.V[vsel].act.map(nombre).join('; ')}) y ${res.E.filter(([i, j]) => i === vsel || j === vsel).length} aristas.`
        : `${R.length} restricciones dan un politopo con ${nV} vértices, ${nE} aristas y ${nF} caras: V − E + F = ${nV - nE + nF}.`;
      lectura.set([
        ['restricciones', String(R.length)], ['vértices V', String(nV)], ['aristas E', String(nE)], ['caras F', String(nF)],
        ['V − E + F (Euler)', String(nV - nE + nF)], ['vértices degenerados', String(deg)],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.style.cursor = 'grab';
    let previo = null, movido = false;
    const cercano = (x, y) => { let m = -1, d = 12; proy.forEach((p, i) => { const q = Math.hypot(p[0] - x, p[1] - y); if (q < d) { d = q; m = i; } }); return m; };
    interaccion(lienzo, {
      tomar: (x, y) => { previo = [x, y]; movido = false; return true; },
      mover: (x, y) => {
        if (Math.hypot(x - previo[0], y - previo[1]) > 3) movido = true;
        yaw += (x - previo[0]) * 0.01; pit = dentroDe(pit + (y - previo[1]) * 0.01, -1.4, 1.4); previo = [x, y];
        if (yaw > Math.PI) yaw -= 2 * Math.PI; if (yaw < -Math.PI) yaw += 2 * Math.PI;
        rGiro.valor = Math.round((yaw * 180) / Math.PI / 5) * 5; rInc.valor = Math.round((pit * 180) / Math.PI / 5) * 5;
        dibujar();
      },
      pasar: (x, y) => {
        const h = cercano(x, y);
        if (h !== hover) { hover = h; dibujar(); }
        if (h < 0) return tip.ocultar();
        const v = res.V[h];
        tip.mostrar(x, y, `vértice (<b>${v.x.map((c) => VIZ.fmt(c, 3)).join('</b>, <b>')}</b>)<br>${v.act.length} restricciones activas${v.act.length > 3 ? ' (degenerado)' : ''}`);
      },
      salir: () => { hover = -1; tip.ocultar(); dibujar(); },
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      if (movido) return;
      const p = lienzo.posicion(ev), h = cercano(p.x, p.y);
      vsel = h === vsel ? -1 : h;
      dibujar();
    });
    recalcular();
    dibujar();
  }

  /* ---------- Fig. 3: región no acotada y direcciones extremas ---------- */

  function montarNoAcotado(cuerpo) {
    let theta = 40, phi = 45, pl = null;
    const PIVOTE = [3, 2];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ángulo de la normal de R', min: 0, max: 180, paso: 5, valor: theta, formato: (v) => `${v}°`, alCambiar: (v) => { theta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Dirección del objetivo c', min: 0, max: 90, paso: 5, valor: phi, formato: (v) => `${v}°`, alCambiar: (v) => { phi = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'restricción móvil R (pasa por (3, 2))', forma: 'linea' },
      { color: C.tinta2, texto: 'x₁ ≥ 0 y x₂ ≥ 0', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.3), texto: 'región factible', forma: 'cuadro' },
      { color: C.s2, texto: 'dirección extrema d (cono de recesión)', forma: 'linea' },
      { color: C.s7, texto: 'objetivo c', forma: 'linea' },
      { color: C.s6, texto: 'óptimo de max c·x', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gire la normal de R de 0° a 180°: entre 0° y 90° exclusive la región es un triángulo (politopo); en 0°, 90° y más allá se abre y aparecen direcciones extremas. Con una dirección d tal que c·d > 0 el objetivo crece sin límite.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: -1, xmax: 10, ymin: -1, ymax: 8 });
      pl.ejes();
      const t = (theta * Math.PI) / 180, a = [Math.cos(t), Math.sin(t)].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
      const restr = [{ a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }, { a, b: dot(a, PIVOTE) }];
      const an = analizar(restr), D = direcciones(an);
      const c = [Math.cos((phi * Math.PI) / 180), Math.sin((phi * Math.PI) / 180)];
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.2), null);
      recta(ctx, pl, [-1, 0], 0, C.tinta2, 2); recta(ctx, pl, [0, -1], 0, C.tinta2, 2);
      recta(ctx, pl, a, dot(a, PIVOTE), C.s1, 2.5);
      poligono(ctx, pl, an.P, null, C.s6, 3);
      const ext = resolver2d(restr, c, an);
      D.forEach((d, i) => {
        const ori = an.rayos.find((r) => dot(r.d, d) > 1 - 1e-9).o;
        flechaD(ctx, pl, ori, [ori[0] + 2 * d[0], ori[1] + 2 * d[1]], C.s2, 3);
        texto(ctx, `d${'₁₂'[i]}`, pl.sx(ori[0] + 2 * d[0]) + 8, pl.sy(ori[1] + 2 * d[1]) - 8, C.tinta, 'left', 13, 600);
      });
      flechaD(ctx, pl, [8.2, 0.6], [8.2 + 1.3 * c[0], 0.6 + 1.3 * c[1]], C.s7, 3);
      texto(ctx, 'c', pl.sx(8.2 + 1.3 * c[0]) + 8, pl.sy(0.6 + 1.3 * c[1]) - 6, C.tinta, 'left', 13, 600);
      for (const p of an.V) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), ext.estado === 'optimo' && ext.V.includes(p) ? C.s6 : C.tinta, ext.V && ext.V.includes(p) ? 7 : 5);
      const txtD = D.map((d) => `(${VIZ.fmt(d[0], 3)}, ${VIZ.fmt(d[1], 3)})`).join(', ');
      registro.textContent = an.acotado ? 'Región acotada (politopo): el cono de recesión {d : A d ≤ 0} se reduce a {0}, no hay direcciones extremas y el máximo existe siempre.'
        : ext.estado === 'noacotado' ? `Región no acotada con ${D.length} dirección(es) extrema(s); como c·d = ${VIZ.fmt(dot(c, ext.dir), 3)} > 0 para d = (${VIZ.fmt(ext.dir[0], 3)}, ${VIZ.fmt(ext.dir[1], 3)}), el objetivo crece sin límite.`
          : `Región no acotada, pero c·d ≤ 0 en todas sus direcciones extremas: el máximo existe y vale ${VIZ.fmt(ext.z)}.`;
      lectura.set([
        ['región', an.acotado ? 'politopo' : 'poliedro no acotado'],
        ['vértices', String(an.V.length)],
        ['aristas acotadas', String(an.aristas.length)],
        ['direcciones extremas', D.length ? txtD : 'ninguna'],
        ['max c·x', ext.estado === 'noacotado' ? '+∞' : ext.estado === 'vacio' ? '—' : VIZ.fmt(ext.z)],
      ]);
      geo = { an };
    }
    let geo = null;
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !geo || !pl.dentro(x, y)) return tip.ocultar();
      const v = geo.an.V.find((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 10);
      if (v) tip.mostrar(x, y, `vértice (<b>${VIZ.fmt(v[0], 3)}</b>, <b>${VIZ.fmt(v[1], 3)}</b>)`);
      else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('polyhedra-vertices', {
    intro: String.raw`
      <p>Un <strong>poliedro</strong> es el conjunto de soluciones de un sistema finito de desigualdades lineales; si además está acotado se llama <strong>politopo</strong>.
      Es la forma de toda región factible de un LP. Sus «esquinas» son los <strong>vértices</strong>, y los segmentos que unen vértices vecinos son las <strong>aristas</strong>.</p>
      <p>Tres hechos guían todo el tema: más restricciones no siempre dan más vértices (algunas son redundantes), un poliedro puede ser no acotado (y entonces tiene
      semirrectas además de aristas), y el número de vértices puede crecer muy rápido con la dimensión, aunque en el plano nunca supera el de restricciones.</p>`,
    visualizaciones: [
      {
        titulo: 'Edite las restricciones y cuente',
        descripcion: 'Haga clic para agregar restricciones y quitarlas con los botones; observe cuáles son redundantes y que, en un politopo plano, vértices y aristas son siempre iguales en número.',
        montar: montarEditar,
      },
      {
        titulo: 'Un poliedro en 3-D',
        descripcion: 'Gire el cubo, active cortes y compruebe la fórmula de Euler \\(V - E + F = 2\\); con el corte 1 en b = 6 aparecen vértices degenerados, donde se anulan más de tres restricciones.',
        montar: montarSolido,
      },
      {
        titulo: 'Regiones no acotadas y direcciones',
        descripcion: 'Gire la restricción móvil y observe cómo el politopo se abre y gana direcciones extremas; después gire c y busque cuándo el objetivo deja de estar acotado.',
        montar: montarNoAcotado,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Un <strong>poliedro</strong> es \(P=\{x\in\mathbb{R}^n : Ax\le b\}\), una intersección finita de <a href="tema.html?id=halfspaces-hyperplanes">semiespacios</a>. Es convexo y cerrado.
      Un <strong>politopo</strong> es un poliedro acotado; equivale a la <a href="tema.html?id=convex-combinations">envoltura convexa</a> de un conjunto finito de puntos.</p>
      <p>Un punto \(x\in P\) es un <strong>vértice</strong> si no es combinación convexa estricta de otros dos puntos de \(P\); equivalentemente, si las restricciones activas en \(x\) tienen rango \(n\)
      (ver <a href="tema.html?id=active-constraints-bfs">restricciones activas</a>). Una <strong>cara</strong> se obtiene fijando como igualdad algunas desigualdades; las de dimensión 0 son vértices, las de dimensión 1
      aristas y las de dimensión \(n-1\) facetas.</p>
      <h2>Cuántos vértices</h2>
      <ul>
        <li>En el plano, un polígono tiene tantos vértices como aristas, y no más que restricciones (las redundantes no aportan arista).</li>
        <li>En \(\mathbb{R}^3\) un politopo satisface la <strong>fórmula de Euler</strong> \(V - E + F = 2\).</li>
        <li>Con \(m\) restricciones en dimensión \(n\), el teorema de la cota superior de McMullen acota \(V\) por \(O(m^{\lfloor n/2\rfloor})\); el cubo \([0,1]^n\) tiene solo \(2n\) restricciones y \(2^n\) vértices.</li>
        <li>Enumerar vértices probando todos los subconjuntos de \(n\) restricciones cuesta \(\binom{m}{n}\) sistemas lineales; es lo que hace el programa de la segunda figura.</li>
      </ul>
      <pre><code>para cada subconjunto S de n restricciones:
    resolver A_S x = b_S                   # si es singular, saltar
    si A x ≤ b:  x es un vértice            # factible
dos vértices son vecinos si sus restricciones activas comunes tienen rango n − 1</code></pre>
      <h2>Regiones no acotadas</h2>
      <p>El <strong>cono de recesión</strong> de \(P\) es \(\{d : Ad\le 0\}\): las direcciones en que se puede avanzar sin salir de \(P\) partiendo de cualquier punto. \(P\) es acotado si y solo si ese cono es \(\{0\}\).
      Sus generadores son las <a href="tema.html?id=extreme-points-directions">direcciones extremas</a>. Si el LP es \(\max c^\top x\), el objetivo no está acotado exactamente cuando existe una dirección
      extrema con \(c^\top d>0\).</p>
      <div class="recuadro"><p><strong>Si \(P\) tiene algún vértice</strong> (no contiene rectas) y el LP tiene óptimo, alguno de sus vértices es óptimo; véase la
      <a href="tema.html?id=optimal-solution-geometry">geometría de las soluciones óptimas</a>.</p></div>
      <h2>Conexiones</h2>
      <p>Un vértice del poliedro en forma estándar es una <a href="tema.html?id=basic-feasible-solutions">solución básica factible</a>, y el método <a href="tema.html?id=simplex-tableau">Simplex</a> se mueve de vértice en vértice por las aristas.</p>`,
  });
})();
