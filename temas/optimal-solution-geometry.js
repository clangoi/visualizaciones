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

  const SIGNO = [{ a: [-1, 0], b: 0, nombre: 'x₁ ≥ 0' }, { a: [0, -1], b: 0, nombre: 'x₂ ≥ 0' }];
  const REGIONES = {
    acotada: { nombre: 'Polígono acotado', R: [{ a: [1, 0], b: 6 }, { a: [1, 1], b: 9 }, { a: [0, 1], b: 5 }, { a: [-1, 1], b: 3 }] },
    abierta: { nombre: 'Región no acotada', R: [{ a: [0, 1], b: 5 }, { a: [-1, 1], b: 3 }] },
    vacia: { nombre: 'Región vacía', R: [{ a: [1, 1], b: -1 }] },
  };
  const completas = (clave) => [...SIGNO, ...REGIONES[clave].R.map((r, i) => ({ ...r, nombre: `R${i + 1}` }))].map((r, i) => ({ ...r, color: VIZ.series[i] }));
  const textoR = (r) => (r.nombre.startsWith('R') ? `${r.nombre}: ${lineal(r.a)} ≤ ${r.b}` : r.nombre);
  const DOM = { xmin: -1.5, xmax: 9, ymin: -1, ymax: 7 };
  const grados = (a) => (a * Math.PI) / 180;

  /* ---------- Fig. 1: gire el objetivo ---------- */

  function montarGiro(cuerpo) {
    let clave = 'acotada', ang = 20, minimizar = false, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Región', opciones: Object.entries(REGIONES).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const rAng = ctl.rango({ etiqueta: 'Ángulo de c', min: 0, max: 359, paso: 1, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Minimizar c·x', valor: minimizar, alCambiar: (v) => { minimizar = v; dibujar(); } });
    ctl.boton('Saltar al siguiente ángulo de arista', () => {
      const R = completas(clave), off = minimizar ? 180 : 0;
      const normales = [...new Set(R.map((r) => Math.round((Math.atan2(r.a[1], r.a[0]) * 180) / Math.PI + 360 + off) % 360))].sort((p, q) => p - q);
      ang = normales.find((q) => q > ang) ?? normales[0];
      rAng.valor = ang;
      dibujar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), texto: 'región factible', forma: 'cuadro' },
      { color: C.s7, texto: 'dirección de mejora y curva de nivel óptima', forma: 'linea' },
      { color: C.s6, texto: 'conjunto de óptimos', forma: 'linea' },
      { color: C.s8, texto: 'dirección que mejora sin límite', forma: 'linea' },
      { color: C.tenue, texto: 'otras curvas de nivel', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre el gráfico para girar c, o use el deslizador y el botón de salto. Cuando la curva de nivel óptima coincide con una arista aparece un segmento entero de óptimos; en la región abierta, algunos ángulos no tienen óptimo.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, DOM);
      pl.ejes();
      const R = completas(clave), sg = minimizar ? -1 : 1;
      const w = [sg * Math.cos(grados(ang)), sg * Math.sin(grados(ang))].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
      const an = analizar(R), sol = resolver2d(R, w, an);
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.15), null);
      if (sol.estado === 'optimo') {
        for (let k = -8; k <= 8; k++) if (k) recta(ctx, pl, w, sol.z + k * 1.5, C.tenue, 1, [3, 4]);
        recta(ctx, pl, w, sol.z, C.s7, 2.2, [6, 4]);
      }
      poligono(ctx, pl, an.P, null, C.s6, 2);
      R.forEach((r) => recta(ctx, pl, r.a, r.b, C.eje, 1));
      if (sol.estado === 'optimo') {
        if (sol.V.length > 1) { ctx.save(); ctx.strokeStyle = C.s6; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pl.sx(sol.V[0][0]), pl.sy(sol.V[0][1])); ctx.lineTo(pl.sx(sol.V[sol.V.length - 1][0]), pl.sy(sol.V[sol.V.length - 1][1])); ctx.stroke(); ctx.restore(); }
        for (const r of sol.semirrectas) flechaD(ctx, pl, r.o, [r.o[0] + 3 * r.d[0], r.o[1] + 3 * r.d[1]], C.s6, 5);
        for (const p of sol.V) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), C.s6, 8, 6);
      } else if (sol.estado === 'noacotado') {
        for (const r of an.rayos) if (dot(w, r.d) > 1e-9) flechaD(ctx, pl, r.o, [r.o[0] + 3 * r.d[0], r.o[1] + 3 * r.d[1]], C.s8, 4);
        for (const p of an.V) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), C.tinta, 4.5);
      } else texto(ctx, 'sin puntos factibles', pl.sx(3), pl.sy(3), C.s8, 'center', 14, 600);
      if (sol.estado !== 'optimo') for (const p of an.V) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), C.tinta, 4.5);
      const o = [7.2, 0.4];
      flechaD(ctx, pl, o, [o[0] + 1.5 * w[0], o[1] + 1.5 * w[1]], C.s7, 3);
      texto(ctx, minimizar ? '−c' : 'c', pl.sx(o[0] + 1.5 * w[0]) + 8, pl.sy(o[1] + 1.5 * w[1]) - 6, C.tinta, 'left', 13, 600);
      const f = (v) => VIZ.fmt(v, 4), c = [Math.cos(grados(ang)), Math.sin(grados(ang))].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
      let msg, tipo;
      if (sol.estado === 'vacio') { tipo = 'ninguno (región vacía)'; msg = 'La región factible es vacía: no hay óptimo porque no hay soluciones.'; }
      else if (sol.estado === 'noacotado') { tipo = 'no existe (no acotado)'; msg = `Existe una dirección extrema d = (${f(sol.dir[0])}, ${f(sol.dir[1])}) con ${minimizar ? 'c·d < 0' : 'c·d > 0'}: avanzar por ella mejora el objetivo sin límite, no hay óptimo.`; }
      else if (sol.tipo === 'vertice') { tipo = 'un vértice'; msg = `Óptimo único en el vértice (${f(sol.V[0][0])}, ${f(sol.V[0][1])}): la curva de nivel apenas toca la región en ese punto.`; }
      else if (sol.tipo === 'arista') { tipo = 'una arista (óptimos alternativos)'; const rr = R.filter((r) => Math.abs(r.a[0] * w[1] - r.a[1] * w[0]) < 1e-9 && dot(r.a, w) > 0 && sol.V.every((p) => Math.abs(dot(r.a, p) - r.b) < 1e-6)); msg = `c es perpendicular a ${rr.length ? textoR(rr[0]) : 'una restricción'}: la curva de nivel óptima coincide con la arista, así que todos sus puntos son óptimos (además de sus dos vértices).`; }
      else { tipo = 'una semirrecta (óptimos alternativos)'; msg = 'La curva de nivel óptima coincide con una arista no acotada: hay infinitos óptimos a lo largo de una semirrecta, y aun así el valor óptimo es finito.'; }
      registro.textContent = msg;
      lectura.set([
        ['ángulo de c', `${ang}°`],
        ['c', `(${f(c[0])}, ${f(c[1])})`],
        [minimizar ? 'valor mínimo de c·x' : 'valor máximo de c·x', sol.estado === 'optimo' ? f(sg * sol.z) : sol.estado === 'noacotado' ? (minimizar ? '−∞' : '+∞') : '—'],
        ['el óptimo es', tipo],
        ['vértices óptimos', sol.estado === 'optimo' ? String(sol.V.length) : '0'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    const girar = (x, y) => {
      const dx = pl.ix(x) - 7.2, dy = pl.iy(y) - 0.4;
      if (Math.hypot(dx, dy) < 0.15) return;
      let a = Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + (minimizar ? 180 : 0);
      ang = ((a % 360) + 360) % 360;
      rAng.valor = ang;
      dibujar();
    };
    interaccion(lienzo, {
      tomar: (x, y) => { if (!pl) return false; girar(x, y); return true; },
      mover: girar,
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const p = [pl.ix(x), pl.iy(y)], c = [Math.cos(grados(ang)), Math.sin(grados(ang))];
        tip.mostrar(x, y, `punto (<b>${VIZ.fmt(p[0], 3)}</b>, <b>${VIZ.fmt(p[1], 3)}</b>)<br>c·x = <b>${VIZ.fmt(dot(c, p))}</b>`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Fig. 2: el gradiente dentro del cono de normales ---------- */

  function montarCono(cuerpo) {
    let ang = 30, sel = 0, pl = null;
    const R = completas('acotada'), an = analizar(R), V = an.V;
    const ctl = VIZ.controles(cuerpo);
    const rAng = ctl.rango({ etiqueta: 'Ángulo de c', min: 0, max: 355, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    ctl.boton('Siguiente vértice', () => { sel = (sel + 1) % V.length; dibujar(); }, { primario: true });
    ctl.boton('Ir al vértice óptimo', () => { const k = datos().findIndex((d) => d.optimo); if (k >= 0) { sel = k; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s7, texto: 'objetivo c (arranca en el vértice elegido)', forma: 'linea' },
      { color: C.tinta2, texto: 'normales aᵢ de las restricciones activas', forma: 'linea' },
      { color: VIZ.alfa(C.s1, 0.3), texto: 'cono de las normales: c dentro ⇒ óptimo', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.2), texto: 'cono sin c: el vértice no es óptimo', forma: 'cuadro' },
      { color: C.s6, texto: 'vértice óptimo', forma: 'punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un vértice (o use el botón) y gire c. En un vértice, c = y₁a₁ + y₂a₂ con y ≥ 0 si y solo si c cae dentro del cono de las dos normales; esos y son los multiplicadores del dual. El único vértice con y ≥ 0 es el óptimo.');
    const cvec = () => [Math.cos(grados(ang)), Math.sin(grados(ang))].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
    function datos() {
      const c = cvec();
      return V.map((v) => {
        const act = activas(R, v, 1e-6), [a1, a2] = [R[act[0]].a, R[act[1]].a];
        const det = a1[0] * a2[1] - a1[1] * a2[0];
        const y = [(c[0] * a2[1] - c[1] * a2[0]) / det, (a1[0] * c[1] - a1[1] * c[0]) / det].map((q) => (Math.abs(q) < 1e-12 ? 0 : q));
        return { v, act, y, optimo: y[0] >= -1e-9 && y[1] >= -1e-9, z: dot(c, v) };
      });
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, DOM);
      pl.ejes();
      const D = datos(), c = cvec(), d = D[sel];
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.12), null);
      R.forEach((r) => recta(ctx, pl, r.a, r.b, r.color, 1.8));
      poligono(ctx, pl, an.P, null, C.s6, 2.5);
      const L = 2.6, u1 = unit(R[d.act[0]].a), u2 = unit(R[d.act[1]].a), bis = unit([u1[0] + u2[0], u1[1] + u2[1]]);
      const en = (k) => [d.v[0] + L * k[0], d.v[1] + L * k[1]];
      poligono(ctx, pl, [d.v, en(u1), en([bis[0] * 1.3, bis[1] * 1.3]), en(u2)], d.optimo ? VIZ.alfa(C.s1, 0.3) : VIZ.alfa(C.s8, 0.18), null);
      [u1, u2].forEach((u, k) => { flechaD(ctx, pl, d.v, [d.v[0] + 1.5 * u[0], d.v[1] + 1.5 * u[1]], C.tinta2, 2.5); texto(ctx, `a${'₁₂'[k]}`, pl.sx(d.v[0] + 1.5 * u[0]) + 8, pl.sy(d.v[1] + 1.5 * u[1]) - 6, C.tinta, 'left', 12, 600); });
      flechaD(ctx, pl, d.v, [d.v[0] + 2 * c[0], d.v[1] + 2 * c[1]], C.s7, 3.5);
      texto(ctx, 'c', pl.sx(d.v[0] + 2 * c[0]) + 8, pl.sy(d.v[1] + 2 * c[1]) - 6, C.tinta, 'left', 13, 700);
      D.forEach((q, i) => VIZ.marcador(ctx, pl.sx(q.v[0]), pl.sy(q.v[1]), q.optimo ? C.s6 : C.tinta, i === sel ? 8 : 5.5, q.optimo ? 6 : 0));
      const f = (v) => VIZ.fmt(v, 3), nm = d.act.map((i) => R[i].nombre);
      registro.textContent = d.optimo
        ? `En (${f(d.v[0])}, ${f(d.v[1])}) las restricciones activas son ${nm.join(' y ')} y c = ${f(d.y[0])}·a₁ + ${f(d.y[1])}·a₂ con ambos coeficientes ≥ 0: c está en el cono, ningún movimiento factible mejora, el vértice es óptimo.`
        : `En (${f(d.v[0])}, ${f(d.v[1])}) c = ${f(d.y[0])}·a₁ + ${f(d.y[1])}·a₂ y ${d.y[0] < -1e-9 ? 'y₁ < 0' : 'y₂ < 0'}: c queda fuera del cono, así que se puede mejorar saliendo de la restricción ${nm[d.y[0] < -1e-9 ? 0 : 1]} por la arista vecina.`;
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('tr', null, ...['vértice', 'activas', 'y₁', 'y₂', 'c·v', 'veredicto'].map((t) => VIZ.el('th', null, t))),
        ...D.map((q, i) => VIZ.el('tr', { class: 'clicable' + (i === sel ? ' activa' : ''), onclick: () => { sel = i; dibujar(); } },
          VIZ.el('td', null, `(${f(q.v[0])}, ${f(q.v[1])})`), VIZ.el('td', null, q.act.map((k) => R[k].nombre).join(', ')),
          VIZ.el('td', { style: { color: q.y[0] < -1e-9 ? C.s8 : null } }, f(q.y[0])), VIZ.el('td', { style: { color: q.y[1] < -1e-9 ? C.s8 : null } }, f(q.y[1])),
          VIZ.el('td', null, f(q.z)), VIZ.el('td', null, q.optimo ? 'óptimo' : 'mejorable')))));
      lectura.set([
        ['vértice elegido', `(${f(d.v[0])}, ${f(d.v[1])})`],
        ['activas', nm.join(', ')],
        ['y₁, y₂', `${f(d.y[0])}, ${f(d.y[1])}`],
        ['c ∈ cono de las normales', d.optimo ? 'sí' : 'no'],
        ['c·v', f(d.z)],
        ['vértices óptimos', String(D.filter((q) => q.optimo).length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    interaccion(lienzo, {
      tomar: (x, y) => {
        if (!pl) return false;
        const i = V.findIndex((v) => Math.hypot(pl.sx(v[0]) - x, pl.sy(v[1]) - y) < 14);
        if (i >= 0) { sel = i; dibujar(); }
        return false;
      },
      mover: () => {},
      pasar: (x, y) => {
        if (!pl) return;
        const D = datos(), i = V.findIndex((v) => Math.hypot(pl.sx(v[0]) - x, pl.sy(v[1]) - y) < 10);
        if (i < 0) return tip.ocultar();
        tip.mostrar(x, y, `vértice (<b>${VIZ.fmt(V[i][0], 3)}</b>, <b>${VIZ.fmt(V[i][1], 3)}</b>)<br>y = (<b>${VIZ.fmt(D[i].y[0], 3)}</b>, <b>${VIZ.fmt(D[i].y[1], 3)}</b>)<br>${D[i].optimo ? 'óptimo' : 'mejorable'}`);
      },
      salir: () => tip.ocultar(),
    });
    void rAng;
    dibujar();
  }

  VIZ.registrarTema('optimal-solution-geometry', {
    intro: String.raw`
      <p>Para optimizar \(c^\top x\) sobre una región poligonal, imagine una recta perpendicular a \(c\) que se desliza en la dirección de mejora hasta el último punto en que aún toca la región.
      Ese último contacto es el óptimo, y casi siempre es una <strong>esquina</strong>. Cuando la recta queda paralela a un lado, el contacto es una <strong>arista entera</strong> y hay infinitos óptimos con el mismo valor.</p>
      <p>Si la región es abierta en la dirección de mejora, la recta nunca deja de tocar: el problema es <strong>no acotado</strong> y no hay óptimo. Y si no hay puntos factibles, tampoco. Estos son los únicos casos posibles de un LP, y por eso los algoritmos basta con que recorran vértices.</p>`,
    visualizaciones: [
      {
        titulo: 'Gire la función objetivo',
        descripcion: 'Gire c por toda la circunferencia: el óptimo salta de vértice en vértice y, en los ángulos 0°, 45°, 90°, 135°, 180° y 270°, se extiende a una arista. Cambie a la región no acotada y busque los ángulos sin óptimo.',
        montar: montarGiro,
      },
      {
        titulo: 'c dentro del cono de normales',
        descripcion: 'Elija un vértice y gire c: solo en el óptimo c cae dentro del cono que forman las normales de las restricciones activas. Los coeficientes que expresan c en esas normales son los multiplicadores (variables duales).',
        montar: montarCono,
      },
    ],
    teoria: String.raw`
      <h2>Los tres resultados posibles</h2>
      <p>Para \(\max\{c^\top x : x\in P\}\) con \(P\) un <a href="tema.html?id=polyhedra-vertices">poliedro</a> ocurre exactamente una de estas tres cosas:</p>
      <ol>
        <li>\(P=\emptyset\): el problema es <strong>infactible</strong>.</li>
        <li>\(P\neq\emptyset\) y existe una dirección \(d\) de \(P\) con \(c^\top d>0\): el problema es <strong>no acotado</strong>.</li>
        <li>Existe una solución óptima. Si \(P\) tiene algún vértice, <strong>al menos un vértice es óptimo</strong>.</li>
      </ol>
      <p>Esto sale directamente del <a href="tema.html?id=extreme-points-directions">teorema de representación</a>: \(c^\top x=\sum\lambda_i c^\top v_i+\sum\mu_j c^\top d_j\).</p>
      <h2>Conjunto de óptimos</h2>
      <p>El conjunto de soluciones óptimas \(P^*=\{x\in P : c^\top x=z^*\}\) es una <strong>cara</strong> de \(P\): la intersección de \(P\) con el hiperplano de apoyo \(c^\top x=z^*\). En el plano es un vértice, una arista (o semirrecta) o todo \(P\)
      (si \(c=0\)). Es una arista exactamente cuando \(c\) es un múltiplo positivo de la normal \(a_i\) de una restricción que define esa arista: en la figura, a los ángulos que son normales de R1 (0°), R2 (45°), R3 (90°), R4 (135°) y de las restricciones de signo (180° y 270°).
      Entonces hay <strong>óptimos alternativos</strong> y el óptimo es único solo si \(P^*\) es un punto.</p>
      <h2>Condición geométrica de optimalidad en un vértice</h2>
      <div class="recuadro"><p>Un vértice \(\bar x\) con restricciones activas \(a_i^\top x\le b_i,\ i\in I\), es óptimo para \(\max c^\top x\) si y solo si
      \[ c=\sum_{i\in I}y_i\,a_i,\qquad y_i\ge0, \]
      es decir, si \(c\) pertenece al <strong>cono generado por las normales activas</strong>.</p></div>
      <p>Si algún \(y_i<0\), se puede relajar esa restricción moviéndose a lo largo de la arista que la deja de tener activa, y \(c^\top x\) crece. Los \(y_i\) completan, con ceros en las restricciones inactivas, una
      solución dual factible que alcanza el mismo valor: son los <a href="tema.html?id=complementary-slackness">precios sombra</a> y la prueba de optimalidad de la
      <a href="tema.html?id=strong-duality">dualidad fuerte</a>. En un vértice degenerado el cono puede escribirse con varios conjuntos de normales y los \(y\) dejan de ser únicos.</p>
      <h2>Para el algoritmo</h2>
      <pre><code>desde un vértice x̄ con activas I:
    resolver c = Σ y_i a_i   (i ∈ I)
    si todos y_i ≥ 0:  x̄ es óptimo
    si no:  moverse por la arista que suelta la restricción con y_i &lt; 0</code></pre>
      <p>Ese es el paso del método <a href="tema.html?id=simplex-tableau">Simplex</a>, donde \(y_i\) son los costos reducidos cambiados de signo. Cuando el LP exige variables enteras, el óptimo deja de estar necesariamente en un vértice
      (véase la <a href="tema.html?id=lp-relaxation">relajación lineal</a>).</p>`,
  });
})();
