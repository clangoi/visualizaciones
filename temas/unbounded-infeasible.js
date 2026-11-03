/* Problemas no acotados e infactibles: detección en el tableau y fase 1 con variables artificiales. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* ---------- Ayudantes compartidos por los temas del Simplex ---------- */

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (i) => String(i).replace(/\d/g, (d) => SUB[+d]);
  const bonito = (nm) => nm.replace(/(\d+)/, (d) => sub(d)); // 'x1' → 'x₁'
  // Número como fracción exacta cuando el denominador es pequeño (los tableaux de ejemplo son racionales).
  function frac(v) {
    if (!Number.isFinite(v)) return VIZ.fmt(v);
    if (Math.abs(v) < 1e-9) return '0';
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-9) return String(r).replace('-', '−');
    for (let d = 2; d <= 60; d++) {
      const p = Math.round(v * d);
      if (Math.abs(v * d - p) < 1e-8 * d) return `${p < 0 ? '−' : ''}${Math.abs(p)}/${d}`;
    }
    return VIZ.fmt(v, 3);
  }
  // Expresión lineal «3x₁ − x₂» a partir de coeficientes y nombres.
  function expr(coefs, nombres) {
    let s = '';
    coefs.forEach((a, j) => {
      if (Math.abs(a) < 1e-12) return;
      const v = Math.abs(a) === 1 ? '' : frac(Math.abs(a));
      s += (s ? (a < 0 ? ' − ' : ' + ') : (a < 0 ? '−' : '')) + v + nombres[j];
    });
    return s || '0';
  }

  // Región { A x ≤ b, x ≥ 0 } dentro de [0, M]².
  function region(A, b, M = 8) {
    return O.poligono(A.map((a, i) => ({ a, b: b[i] })), { xmin: 0, xmax: M, ymin: 0, ymax: M });
  }
  // Extremos de la recta a·x = b recortada al dominio del plano (el par de puntos más alejados).
  function segmento(a, b, d) {
    const pts = [];
    if (Math.abs(a[1]) > 1e-12) for (const x of [d.xmin, d.xmax]) { const y = (b - a[0] * x) / a[1]; if (y >= d.ymin - 1e-9 && y <= d.ymax + 1e-9) pts.push([x, y]); }
    if (Math.abs(a[0]) > 1e-12) for (const y of [d.ymin, d.ymax]) { const x = (b - a[1] * y) / a[0]; if (x >= d.xmin - 1e-9 && x <= d.xmax + 1e-9) pts.push([x, y]); }
    let mejor = null, mx = -1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const q = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (q > mx) { mx = q; mejor = [pts[i], pts[j]]; }
    }
    return mejor;
  }
  function rellenar(ctx, plano, poli, color) {
    if (poli.length < 3) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Recta de una restricción con una etiqueta cerca del extremo superior (t desplaza la etiqueta a lo largo de la recta).
  function recta(ctx, plano, a, b, color, { ancho = 2, guion = null, texto = '', t = 0.12 } = {}) {
    const seg = segmento(a, b, plano.d);
    if (!seg) return;
    const [p, q] = seg[0][1] >= seg[1][1] ? seg : [seg[1], seg[0]];
    VIZ.trazar(ctx, plano, [p, q], color, ancho, guion);
    if (!texto) return;
    const x = plano.sx(p[0] + t * (q[0] - p[0])), y = plano.sy(p[1] + t * (q[1] - p[1]));
    ctx.save();
    ctx.font = VIZ.fuente(11, 600);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = x > plano.x1 - 40 ? 'right' : 'left';
    ctx.fillText(texto, x + (ctx.textAlign === 'left' ? 7 : -7), y + 9);
    ctx.restore();
  }
  // Pulsar o arrastrar sobre el lienzo: alPunto(x, y, arrastrando) en píxeles del lienzo.
  function arrastre(lienzo, alPunto, alSalir) {
    let abajo = false;
    const c = lienzo.canvas;
    c.style.cursor = 'crosshair';
    c.addEventListener('pointerdown', (ev) => { abajo = true; c.setPointerCapture(ev.pointerId); const { x, y } = lienzo.posicion(ev); alPunto(x, y, true); });
    c.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); alPunto(x, y, abajo); });
    const soltar = () => { abajo = false; };
    c.addEventListener('pointerup', soltar);
    c.addEventListener('pointercancel', soltar);
    c.addEventListener('pointerleave', () => { if (!abajo && alSalir) alSalir(); });
  }

  // Tableau como tabla HTML. est = { T, base, nombres, entra, sale, razones }.
  // Resalta la columna entrante, la fila saliente y el pivote. o.clic(j) hace pulsables las columnas con costo reducido negativo.
  function htmlTableau(est, o = {}) {
    const { T, base, nombres } = est, m = T.length - 1, N = nombres.length;
    const entra = o.entra ?? est.entra ?? -1, sale = o.sale ?? est.sale ?? -1, etiquetaZ = o.etiquetaZ || 'z';
    const razones = est.razones && est.razones.length ? est.razones : null;
    const fondo = (i, j) => {
      if (i === sale && j === entra) return { background: C.s7, color: C.sobre };
      if (j === entra) return { background: VIZ.alfa(C.s1, 0.16) };
      if (i === sale) return { background: VIZ.alfa(C.s2, 0.16) };
      return null;
    };
    const cab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'Base'),
      nombres.map((nm, j) => {
        const activa = o.clic && T[m][j] < -1e-9;
        return VIZ.el('th', { class: activa ? 'celda-clic' : null, title: activa ? 'Pulse para que entre a la base' : null, style: fondo(-1, j) || (activa ? { border: `1.5px solid ${C.s1}` } : null), onclick: activa ? () => o.clic(j) : null }, bonito(nm));
      }), VIZ.el('th', null, 'LD'), razones ? VIZ.el('th', null, 'razón') : null);
    const filas = T.slice(0, m).map((f, i) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq', style: fondo(i, -1) }, bonito(nombres[base[i]])),
      f.slice(0, N).map((v, j) => VIZ.el('td', { style: fondo(i, j) }, frac(v))),
      VIZ.el('td', { style: o.marcarCeros && Math.abs(f[N]) < 1e-9 ? { background: VIZ.alfa(C.s8, 0.2), fontWeight: 600 } : fondo(i, -1) }, frac(f[N])),
      razones ? VIZ.el('td', { style: fondo(i, -1) }, Number.isFinite(razones[i]) ? frac(razones[i]) : '—') : null));
    const fz = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, etiquetaZ),
      T[m].slice(0, N).map((v, j) => VIZ.el('td', { style: { ...(fondo(-1, j) || {}), ...(v < -1e-9 ? { fontWeight: 600 } : {}) } }, frac(v))),
      VIZ.el('td', { style: { fontWeight: 600 } }, frac(T[m][N])), razones ? VIZ.el('td') : null);
    return VIZ.el('div', { class: 'caja-desplazable' }, VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, cab), VIZ.el('tbody', null, filas, fz)));
  }
  const LEYENDA_TABLEAU = [
    { color: C.s1, texto: 'columna entrante' },
    { color: C.s2, texto: 'fila saliente' },
    { color: C.s7, texto: 'pivote' },
  ];

  // Modelo de referencia: max 3x₁ + 2x₂  s.a.  x₁ + x₂ ≤ 5,  2x₁ + x₂ ≤ 8,  x₁ + 3x₂ ≤ 12.  Óptimo (3, 2), z = 13.
  const A0 = [[1, 1], [2, 1], [1, 3]];
  const B0 = [5, 8, 12];
  const COL_R = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s7];
  // Flecha de (x0, y0) a (x1, y1) en píxeles.
  function flecha(ctx, x0, y0, x1, y1, color, ancho, guion) {
    const a = Math.atan2(y1 - y0, x1 - x0), h = 9;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho;
    if (guion) ctx.setLineDash(guion);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * h * 0.6, y1 - Math.sin(a) * h * 0.6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
    ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const EPS = 1e-9;

  /* ---------- Fig. 1: no acotado ---------- */

  function montarNoAcotado(cuerpo) {
    // R1: −x₁ + x₂ ≤ 2,  R2: x₁ − 2x₂ ≤ 4,  (opcional) R3: x₁ + x₂ ≤ 12.
    const AN = [[-1, 1], [1, -2], [1, 1]], BN = [2, 4, 12];
    let c = [1, 1], tapa = false, est = [], k = 0, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'c₁', min: -3, max: 3, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'c₂', min: -3, max: 3, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'agregar R₃: x₁ + x₂ ≤ 12', valor: tapa, alCambiar: (v) => { tapa = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const caja = VIZ.el('div');
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, texto: 'región factible (se corta en el borde del gráfico)' },
      { color: C.s1, texto: 'vértices recorridos', forma: 'punto' },
      { color: C.s8, texto: 'dirección de crecimiento sin límite', forma: 'linea' },
      ...LEYENDA_TABLEAU,
    ]);
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con c = (1, 1) la región se abre hacia arriba a la derecha y z crece sin límite: el tableau muestra una columna entrante sin coeficientes positivos. Pruebe agregar R₃ (la región se cierra), o un c con c₁ + c₂ ≤ 0 y c₁ ≤ 0 (el origen ya es óptimo).');

    const filas = () => (tapa ? 3 : 2);
    function iniciar() {
      est = [...O.simplex(c, AN.slice(0, filas()), BN.slice(0, filas()), { regla: 'dantzig' })];
      k = 0;
      return (function* () { while (k < est.length - 1) { k++; yield; } })();
    }
    // Dirección de la arista infinita: x_entrante = 1 y cada básica baja en proporción a su coeficiente.
    function direccion(s) {
      const d = Array(s.nombres.length).fill(0);
      d[s.entra] = 1;
      s.base.forEach((q, i) => { d[q] = -s.T[i][s.entra]; });
      return d.slice(0, 2);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 12, ymin: 0, ymax: 10 }, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const m = filas();
      const poli = O.poligono(AN.slice(0, m).map((a, i) => ({ a, b: BN[i] })), { xmin: 0, xmax: 12, ymin: 0, ymax: 10 });
      rellenar(ctx, plano, poli, C.neutro);
      AN.slice(0, m).forEach((a, i) => recta(ctx, plano, a, BN[i], COL_R[i], { texto: `R${sub(i + 1)}`, t: 0.1 + 0.2 * i }));
      const s = est[k];
      for (let i = 0; i < k; i++) flecha(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), plano.sx(est[i + 1].x[0]), plano.sy(est[i + 1].x[1]), C.s1, 3);
      for (let i = 0; i <= k; i++) VIZ.marcador(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), i === k ? C.s2 : C.s1, i === k ? 6 : 4.5);
      let d = null;
      if (s.estado === 'noacotado') {
        d = direccion(s);
        const L = 12 / Math.max(Math.abs(d[0]), Math.abs(d[1]), 1e-9);
        flecha(ctx, plano.sx(s.x[0]), plano.sy(s.x[1]), plano.sx(s.x[0] + d[0] * L), plano.sy(s.x[1] + d[1] * L), C.s8, 3, [7, 4]);
      }
      caja.replaceChildren(htmlTableau(s));
      const z = (v) => frac(v);
      if (s.estado === 'noacotado') {
        registro.textContent = `La columna de ${bonito(s.nombres[s.entra])} tiene costo reducido ${z(s.T[s.T.length - 1][s.entra])} < 0, pero todos sus coeficientes en las filas son ≤ 0: la razón mínima no existe. Se puede aumentar ${bonito(s.nombres[s.entra])} sin límite y z crece sin límite a lo largo de d = (${z(d[0])}, ${z(d[1])}) desde (${z(s.x[0])}, ${z(s.x[1])}).`;
      } else if (s.estado === 'optimo') {
        registro.textContent = `Óptimo en (${z(s.x[0])}, ${z(s.x[1])}) con z = ${z(s.z)}. ${tapa ? 'La restricción R₃ cierra la región y el problema queda acotado.' : 'Para este c la región abierta no deja crecer z.'}`;
      } else {
        const fin = s.razones.filter(Number.isFinite);
        registro.textContent = `Iteración ${k}: entra ${bonito(s.nombres[s.entra])}; razones ${s.razones.map((r) => (Number.isFinite(r) ? z(r) : '—')).join(', ')}. La mínima (${z(Math.min(...fin))}) fija la variable que sale.`;
      }
      lectura.set([
        ['iteración', String(k)],
        ['vértice', `(${z(s.x[0])}, ${z(s.x[1])})`],
        ['z actual', z(s.z)],
        ['estado', s.estado === 'noacotado' ? 'no acotado' : s.estado === 'optimo' ? 'óptimo' : 'iterando'],
        ['dirección d', d ? `(${z(d[0])}, ${z(d[1])})` : '—'],
        ['c·d', d ? z(c[0] * d[0] + c[1] * d[1]) : '—'],
      ]);
    }
    lienzo.alDibujar = () => est.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) return tip.ocultar();
      const px = plano.ix(x), py = plano.iy(y);
      const ok = AN.slice(0, filas()).every((a, i) => a[0] * px + a[1] * py <= BN[i] + 1e-9);
      tip.mostrar(x, y, `(${VIZ.fmt(px, 3)}, ${VIZ.fmt(py, 3)})<br>z = <b>${VIZ.fmt(c[0] * px + c[1] * py, 4)}</b><br>${ok ? 'factible' : 'no factible'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: infactible y fase 1 ---------- */

  // Fase 1: max −Σ artificiales. Devuelve la lista de estados con la forma del tableau de VIZ.opt.simplex.
  function fase1(A, sen, b) {
    const n = A[0].length, m = A.length;
    const nombres = A[0].map((_, j) => 'x' + (j + 1));
    const colExtra = [], colArt = [];
    sen.forEach((s, i) => { if (s !== '<=') colExtra[i] = nombres.length; if (s !== '=') nombres.push((s === '<=' ? 's' : 'e') + (i + 1)); });
    sen.forEach((s, i) => { if (s !== '<=') { colArt[i] = nombres.length; nombres.push('a' + (i + 1)); } });
    // Reasigna: la columna de holgura/exceso de la fila i.
    const idxExtra = []; { let q = n; sen.forEach((s, i) => { if (s !== '=') idxExtra[i] = q++; }); }
    const N = nombres.length;
    const T = A.map((f, i) => {
      const r = Array(N + 1).fill(0);
      f.forEach((v, j) => { r[j] = v; });
      if (sen[i] === '<=') r[idxExtra[i]] = 1; else if (sen[i] === '>=') r[idxExtra[i]] = -1;
      if (colArt[i] !== undefined) r[colArt[i]] = 1;
      r[N] = b[i];
      return r;
    });
    const w = Array(N + 1).fill(0);
    colArt.forEach((q) => { if (q !== undefined) w[q] = 1; });
    const base = sen.map((s, i) => (s === '<=' ? idxExtra[i] : colArt[i]));
    base.forEach((q, i) => { if (w[q] !== 0) for (let j = 0; j <= N; j++) w[j] -= w[q] * T[i][j]; });
    T.push(w);
    const estados = [];
    const punto = () => { const x = Array(N).fill(0); base.forEach((q, i) => { x[q] = T[i][N]; }); return x; };
    for (let it = 0; it < 30; it++) {
      let e = -1, mn = -EPS;
      for (let j = 0; j < N; j++) if (T[m][j] < mn) { mn = T[m][j]; e = j; }
      const x = punto();
      const copia = { T: T.map((f) => f.slice()), base: base.slice(), nombres, it, x: x.slice(0, n), z: T[m][N], full: x };
      if (e < 0) { estados.push({ ...copia, estado: 'optimo', entra: -1, sale: -1, razones: [] }); break; }
      const razones = T.slice(0, m).map((f) => (f[e] > EPS ? f[N] / f[e] : Infinity));
      let sale = -1, mr = Infinity;
      razones.forEach((r, i) => { if (r < mr - EPS || (Math.abs(r - mr) <= EPS && sale >= 0 && base[i] < base[sale])) { mr = r; sale = i; } });
      estados.push({ ...copia, estado: 'iterando', entra: e, sale, razones });
      const p = T[sale][e];
      T[sale] = T[sale].map((v) => v / p);
      for (let i = 0; i <= m; i++) if (i !== sale && T[i][e] !== 0) { const f = T[i][e]; T[i] = T[i].map((v, q) => v - f * T[sale][q]); }
      base[sale] = e;
    }
    return { estados, colArt: colArt.filter((q) => q !== undefined) };
  }

  function montarFase1(cuerpo) {
    // R1: x₁ + x₂ ≤ 6,  R2: 2x₁ + x₂ ≥ k,  R3: x₁ ≤ 3.  Máximo posible de 2x₁ + x₂ en R1 ∩ R3: 9.
    const A = [[1, 1], [2, 1], [1, 0]], SEN = ['<=', '>=', '<='];
    let kk = 6, res = null, est = [], k = 0, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'k (mínimo exigido en R₂)', min: 2, max: 12, paso: 1, valor: kk, alCambiar: (v) => { kk = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 250, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const caja = VIZ.el('div');
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, texto: 'región factible' },
      { color: C.s1, texto: 'puntos de la fase 1 (proyección en x₁, x₂)', forma: 'punto' },
      { color: C.s6, texto: 'fase 1 termina en w = 0', forma: 'punto' },
      { color: C.s8, texto: 'fase 1 termina con w > 0', forma: 'punto' },
      ...LEYENDA_TABLEAU,
    ]);
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La fase 1 minimiza la suma w de las variables artificiales (aquí a₂). El origen no cumple R₂, así que parte con a₂ = k. Si w llega a 0 se obtuvo una base factible; si se estanca en un valor positivo, el problema no tiene solución. Suba k por encima de 9: la región desaparece.');

    function iniciar() {
      res = fase1(A, SEN, [6, kk, 3]);
      est = res.estados;
      k = 0;
      return (function* () { while (k < est.length - 1) { k++; yield; } })();
    }
    const final = () => est[est.length - 1];
    const infactible = () => -final().z > 1e-7;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 8, ymin: 0, ymax: 9 }, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const rs = [{ a: [1, 1], b: 6 }, { a: [-2, -1], b: -kk }, { a: [1, 0], b: 3 }];
      const poli = O.poligono(rs, { xmin: 0, xmax: 8, ymin: 0, ymax: 9 });
      rellenar(ctx, plano, poli, C.neutro);
      rs.forEach((r, i) => recta(ctx, plano, r.a, r.b, COL_R[i], { texto: `R${sub(i + 1)}`, t: 0.1 + 0.15 * i }));
      if (poli.length < 3) {
        ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.s8; ctx.textAlign = 'center';
        ctx.fillText('región factible vacía', (plano.x0 + plano.x1) / 2, plano.y1 + 20);
        ctx.restore();
      }
      const s = est[k], fin = k === est.length - 1;
      for (let i = 0; i < k; i++) flecha(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), plano.sx(est[i + 1].x[0]), plano.sy(est[i + 1].x[1]), C.s1, 3);
      for (let i = 0; i <= k; i++) VIZ.marcador(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), i === k ? (fin ? (infactible() ? C.s8 : C.s6) : C.s2) : C.s1, i === k ? 7 : 4.5);
      caja.replaceChildren(htmlTableau(s, { etiquetaZ: '−w' }));
      const art = res.colArt.map((q) => s.full[q]).reduce((u, v) => u + v, 0);
      const bigM = O.lp([1, 2], A, SEN, [6, kk, 3], { max: true });
      if (!fin) {
        registro.textContent = `Fase 1, iteración ${k}: w = Σ artificiales = ${frac(-s.z)}. Entra ${bonito(s.nombres[s.entra])} (costo reducido ${frac(s.T[s.T.length - 1][s.entra])}), sale ${bonito(s.nombres[s.base[s.sale]])}.`;
      } else if (infactible()) {
        registro.textContent = `La fase 1 termina con w = ${frac(-s.z)} > 0: no se puede anular la artificial, es decir, R₂ exige más de lo que permiten R₁ y R₃ (el máximo de 2x₁ + x₂ allí es 9 < ${kk}). El problema es infactible.`;
      } else {
        registro.textContent = `La fase 1 termina con w = 0: se encontró una base factible, el punto (${frac(s.x[0])}, ${frac(s.x[1])}). Ahora la fase 2 optimiza el objetivo verdadero partiendo de ahí.`;
      }
      lectura.set([
        ['iteración (fase 1)', String(k)],
        ['w = Σ artificiales', frac(art)],
        ['punto (x₁, x₂)', `(${frac(s.x[0])}, ${frac(s.x[1])})`],
        ['resultado fase 1', fin ? (infactible() ? 'infactible' : 'factible') : 'en curso'],
        ['Big-M (opt.lp)', bigM.estado === 'optimo' ? `óptimo z = ${frac(bigM.z)} para max x₁ + 2x₂` : bigM.estado],
      ]);
    }
    lienzo.alDibujar = () => est.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) return tip.ocultar();
      const px = plano.ix(x), py = plano.iy(y);
      const v = [6 - px - py, 2 * px + py - kk, 3 - px];
      tip.mostrar(x, y, `(${VIZ.fmt(px, 3)}, ${VIZ.fmt(py, 3)})` + v.map((q, i) => VIZ.filaTooltip(COL_R[i], `holgura R${sub(i + 1)}`, VIZ.fmt(q, 3))).join('') + (v.every((q) => q >= 0) ? '<br>factible' : '<br>viola alguna restricción'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('unbounded-infeasible', {
    intro: String.raw`
      <p>No todo programa lineal tiene una solución óptima. Puede ser <strong>infactible</strong>, si las restricciones se contradicen y no queda ningún punto
      que las cumpla, o <strong>no acotado</strong>, si hay puntos factibles que mejoran el objetivo tanto como se quiera. El Simplex detecta ambos casos de forma natural.</p>
      <p>El no acotado aparece en el tableau como una columna entrante sin ningún coeficiente positivo: la prueba de razón no tiene con quién competir. El infactible
      se descubre antes de optimizar, con una <strong>fase 1</strong> que usa variables artificiales y trata de anularlas. En modelación, ambos casos casi siempre señalan un error del modelo.</p>`,
    visualizaciones: [
      {
        titulo: 'Detectar un problema no acotado',
        descripcion: 'Con \\(c=(1,1)\\) el Simplex avanza un par de pivotes y se detiene al ver una columna sin razones: la flecha roja es la dirección en que \\(z\\) crece sin fin. Agregue \\(R_3\\) y compruebe que la región se cierra.',
        montar: montarNoAcotado,
      },
      {
        titulo: 'Fase 1 e infactibilidad',
        descripcion: 'Avance la fase 1 con \\(k=6\\): \\(w\\) baja a 0 y aparece una base factible. Suba \\(k\\) por encima de 9: la región se vacía y \\(w\\) se queda positivo.',
        montar: montarFase1,
      },
    ],
    teoria: String.raw`
      <h2>Problemas no acotados</h2>
      <p>En un tableau, supongamos que la columna \(j\) tiene costo reducido \(\bar c_j &lt; 0\) y todos sus coeficientes son \(a'_{ij} \le 0\). Entonces la prueba de razón
      \(\min\{b'_i/a'_{ij} : a'_{ij} &gt; 0\}\) no tiene candidatos. Se puede aumentar \(x_j\) cuanto se quiera:</p>
      \[ x(t) = x^{*} + t\,d, \quad d_j = 1,\quad d_{B(i)} = -a'_{ij},\quad t \ge 0, \]
      <p>es factible para todo \(t\) (pues \(Ad = 0\) y \(d \ge 0\)), y su objetivo vale \(c^\top x^* + t\,c^\top d = z^* - t\,\bar c_j \to \infty\). Se dice que \(d\) es una
      <em>dirección extrema</em> del poliedro (véase <a href="tema.html?id=extreme-points-directions">Extreme Points and Extreme Directions</a>). Un LP es no acotado exactamente cuando
      es factible y existe una dirección \(d\) del poliedro con \(c^\top d &gt; 0\).</p>
      <div class="recuadro"><p><strong>Al modelar.</strong> Un problema no acotado casi siempre significa que falta una restricción real (capacidad, demanda, presupuesto) o que se escribió
      un signo al revés. Revise la dirección \(d\): dice qué variables crecen sin límite.</p></div>
      <h2>Problemas infactibles: fase 1</h2>
      <p>Cuando el origen no es factible (hay restricciones \(\ge\) o \(=\)), no se dispone de una base inicial. Se agrega una variable artificial \(a_i \ge 0\) a cada fila problemática y se resuelve</p>
      \[ \min\ w = \sum_i a_i \quad\text{s.a.}\quad Ax + (\text{holguras/excesos}) + a = b,\quad x, a \ge 0. \]
      <p>La base inicial (holguras y artificiales) es factible. Al terminar:</p>
      <ul>
        <li>\(w^* = 0\): se puede anular toda artificial; la base obtenida es una SBF del problema original y se pasa a la fase 2 con el objetivo real.</li>
        <li>\(w^* &gt; 0\): ninguna solución cumple todas las restricciones; el problema es <strong>infactible</strong>, y \(w^*\) mide cuánto se viola el sistema en el mejor de los casos.</li>
      </ul>
      <h2>Alternativa: Big-M</h2>
      <p>Se resuelve una sola fase con costo \(-M\) por cada artificial, con \(M\) enorme. Si al terminar queda una artificial positiva, el problema es infactible. Es simple de programar (así lo hace <code>VIZ.opt.lp</code> en las
      figuras de ramificación), pero un \(M\) muy grande causa errores numéricos y uno pequeño puede dar respuestas erróneas; por eso los resolvedores prefieren la fase 1.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con \(x_1 + x_2 \le 6\), \(x_1 \le 3\) y \(2x_1 + x_2 \ge k\), el máximo de \(2x_1+x_2\) sobre las dos primeras es \(2\cdot 3 + 3 = 9\), en \((3,3)\). Para \(k \le 9\) la fase 1 llega a \(w = 0\);
      para \(k &gt; 9\) termina en \((3,3)\) con \(w = k - 9\), lo que prueba la infactibilidad. En la figura 2, \(k = 12\) da \(w = 3\).</p>
      <h2>Las cuatro posibilidades</h2>
      <table>
        <thead><tr><th>Primal</th><th>Dual</th></tr></thead>
        <tbody>
          <tr><td>óptimo</td><td>óptimo (mismo valor)</td></tr>
          <tr><td>no acotado</td><td>infactible</td></tr>
          <tr><td>infactible</td><td>no acotado o infactible</td></tr>
        </tbody>
      </table>
      <p>Esto sale de la dualidad: véase <a href="tema.html?id=weak-duality">Weak Duality</a> y <a href="tema.html?id=strong-duality">Strong Duality</a>. Para el tableau en que se aplica la prueba de razón, <a href="tema.html?id=simplex-tableau">The Simplex Tableau</a>,
      y para el uso de las artificiales en enteros, <a href="tema.html?id=lp-relaxation">Linear Relaxation</a>.</p>`,
  });
})();
