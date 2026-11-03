/* Reglas de pivoteo: Dantzig frente a Bland en un mismo problema y número de iteraciones según la regla y el tamaño. */
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
  // Polígono de siete vértices: 3 caminos distintos según por dónde se salga del origen.
  const AP = [[1, 0], [3, 1], [1, 1], [1, 3], [0, 1]];
  const BP = [6, 20, 9, 19, 6];

  /* ---------- Simplex con tres reglas, para contar iteraciones ---------- */

  // Reglas: 'dantzig' (costo reducido más negativo), 'bland' (menor índice), 'mejora' (mayor aumento de z en esta iteración).
  function correr(c, A, b, regla) {
    const m = A.length, n = c.length, N = n + m;
    const T = A.map((f, i) => [...f, ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)), b[i]]);
    T.push([...c.map((v) => -v), ...Array(m).fill(0), 0]);
    const base = Array.from({ length: m }, (_, i) => n + i);
    const razon = (j) => {
      let s = -1, th = Infinity;
      for (let i = 0; i < m; i++) if (T[i][j] > EPS) { const r = T[i][N] / T[i][j]; if (r < th - EPS || (Math.abs(r - th) <= EPS && base[i] < base[s])) { th = r; s = i; } }
      return { s, th };
    };
    for (let it = 0; it < 20000; it++) {
      let e = -1;
      if (regla === 'bland') { for (let j = 0; j < N; j++) if (T[m][j] < -EPS) { e = j; break; } }
      else if (regla === 'dantzig') { let mn = -EPS; for (let j = 0; j < N; j++) if (T[m][j] < mn) { mn = T[m][j]; e = j; } }
      else {
        let mejor = -1;
        for (let j = 0; j < N; j++) if (T[m][j] < -EPS) {
          const { s, th } = razon(j);
          if (s < 0) return { iter: it, estado: 'noacotado' };
          const g = -T[m][j] * th;
          if (g > mejor + 1e-12) { mejor = g; e = j; }
        }
      }
      if (e < 0) return { iter: it, estado: 'optimo', z: T[m][N] };
      const { s } = razon(e);
      if (s < 0) return { iter: it, estado: 'noacotado' };
      const p = T[s][e];
      T[s] = T[s].map((v) => v / p);
      for (let i = 0; i <= m; i++) if (i !== s && T[i][e] !== 0) { const f = T[i][e]; T[i] = T[i].map((v, q) => v - f * T[s][q]); }
      base[s] = e;
    }
    return { iter: 20000, estado: 'tope' };
  }
  // Cubo de Klee–Minty de dimensión n.
  function kleeMinty(n) {
    const c = Array.from({ length: n }, (_, j) => 2 ** (n - 1 - j));
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j < i ? 2 ** (i - j + 1) : j === i ? 1 : 0)));
    return { c, A, b: Array.from({ length: n }, (_, i) => 5 ** (i + 1)) };
  }

  /* ---------- Fig. 1: dos reglas, un problema ---------- */

  function montarComparacion(cuerpo) {
    let c = [1, 4], estD = [], estB = [], t = 0, plano = null, poli = [];
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Alternar c: (1, 4) / (4, 1)', () => { c = c[0] > c[1] ? [1, 4] : [4, 1]; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 270, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, texto: 'región factible' },
      { color: C.s1, texto: 'camino de Dantzig', forma: 'linea' },
      { color: C.s2, texto: 'camino de Bland', forma: 'linea' },
      { color: C.tinta2, texto: 'vector c (arrastre su punta)', forma: 'punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre la punta del vector c para cambiar el objetivo. Las dos reglas parten del origen y avanzan a la vez, un pivote por paso. Con c₂ &gt; c₁ Dantzig sube por el eje x₂, mientras que Bland, que prefiere el menor índice, parte por x₁.');

    function iniciar() {
      estD = [...O.simplex(c, AP, BP, { regla: 'dantzig' })];
      estB = [...O.simplex(c, AP, BP, { regla: 'bland' })];
      t = 0;
      return (function* () { while (t < Math.max(estD.length, estB.length) - 1) { t++; yield; } })();
    }
    const nom = (s, i) => bonito(s.nombres[i]);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 7.5, ymin: 0, ymax: 7 }, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      poli = region(AP, BP, 8);
      rellenar(ctx, plano, poli, C.neutro);
      AP.forEach((a, i) => recta(ctx, plano, a, BP[i], C.tenue, { ancho: 1.5 }));
      const kD = Math.min(t, estD.length - 1), kB = Math.min(t, estB.length - 1);
      const camino = (est, k, col, ancho) => { for (let i = 0; i < k; i++) flecha(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), plano.sx(est[i + 1].x[0]), plano.sy(est[i + 1].x[1]), col, ancho); };
      camino(estD, kD, C.s1, 5);
      camino(estB, kB, C.s2, 2.5);
      for (const [x, y] of poli) VIZ.marcador(ctx, plano.sx(x), plano.sy(y), C.superficie, 4);
      VIZ.marcador(ctx, plano.sx(estD[kD].x[0]), plano.sy(estD[kD].x[1]), C.s1, 6.5);
      VIZ.marcador(ctx, plano.sx(estB[kB].x[0]), plano.sy(estB[kB].x[1]), C.s2, 4.5);
      const tx = plano.sx(c[0]), ty = plano.sy(c[1]);
      flecha(ctx, plano.sx(0), plano.sy(0), tx, ty, C.tinta2, 2);
      VIZ.marcador(ctx, tx, ty, C.tinta2, 6);
      ctx.save();
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`c = (${frac(c[0])}, ${frac(c[1])})`, tx + 9, ty - 6);
      ctx.restore();
      // Tabla de iteraciones de cada regla.
      const fila = (k) => {
        const f = (est) => {
          if (k > est.length - 1) return ['', '', ''];
          const s = est[k];
          return [s.entra >= 0 ? nom(s, s.entra) : 'óptimo', `(${frac(s.x[0])}, ${frac(s.x[1])})`, frac(s.z)];
        };
        return VIZ.el('tr', { class: k === t ? 'activa' : null }, VIZ.el('td', { class: 'izq' }, String(k)), f(estD).map((v) => VIZ.el('td', null, v)), f(estB).map((v) => VIZ.el('td', null, v)));
      };
      const hasta = Math.max(estD.length, estB.length) - 1;
      const filas = [];
      for (let k = 0; k <= Math.min(t, hasta); k++) filas.push(fila(k));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null,
          VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, ''), VIZ.el('th', { colspan: 3 }, 'Dantzig'), VIZ.el('th', { colspan: 3 }, 'Bland')),
          VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'it.'), ['entra', 'vértice', 'z', 'entra', 'vértice', 'z'].map((h) => VIZ.el('th', null, h)))),
        VIZ.el('tbody', null, filas)));
      const sD = estD[kD], sB = estB[kB];
      if (t === 0) {
        const s0 = estD[0];
        registro.textContent = `En el origen los costos reducidos son (${frac(s0.T[AP.length][0])}, ${frac(s0.T[AP.length][1])}). Dantzig elige ${nom(s0, s0.entra)} (el más negativo); Bland elige ${nom(estB[0], estB[0].entra)} (el de menor índice).`;
      } else {
        const d = sD.estado === 'optimo' ? 'Dantzig ya terminó' : `Dantzig: entra ${nom(sD, sD.entra)}`;
        const bl = sB.estado === 'optimo' ? 'Bland ya terminó' : `Bland: entra ${nom(sB, sB.entra)}`;
        registro.textContent = `Pivote ${t}. ${d} (z = ${frac(sD.z)}); ${bl} (z = ${frac(sB.z)}).`;
      }
      lectura.set([
        ['iteraciones Dantzig', sD.estado === 'optimo' ? String(estD.length - 1) : `${kD}…`],
        ['iteraciones Bland', sB.estado === 'optimo' ? String(estB.length - 1) : `${kB}…`],
        ['z óptimo', frac(estD[estD.length - 1].z)],
        ['¿mismo óptimo?', Math.abs(estD[estD.length - 1].z - estB[estB.length - 1].z) < 1e-7 ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = () => estD.length && dibujar();
    arrastre(lienzo, (x, y, abajo) => {
      if (!plano) return;
      if (abajo) {
        const q = (v) => Math.min(6, Math.max(0, Math.round(v * 2) / 2));
        let n = [q(plano.ix(x)), q(plano.iy(y))];
        if (n[0] === 0 && n[1] === 0) n = [0.5, 0];
        if (n[0] !== c[0] || n[1] !== c[1]) { c = n; rep.reiniciar(); }
      }
      let texto = '';
      for (const [vx, vy] of poli) if (Math.hypot(plano.sx(vx) - x, plano.sy(vy) - y) < 12) texto = `vértice <b>(${frac(vx)}, ${frac(vy)})</b><br>z = <b>${frac(c[0] * vx + c[1] * vy)}</b>`;
      if (Math.hypot(plano.sx(c[0]) - x, plano.sy(c[1]) - y) < 12) texto = `vector c = <b>(${frac(c[0])}, ${frac(c[1])})</b>`;
      if (texto) tip.mostrar(x, y, texto); else tip.ocultar();
    }, () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: iteraciones según la regla y la dimensión ---------- */

  const REGLAS = [['dantzig', 'Dantzig', C.s1], ['bland', 'Bland', C.s2], ['mejora', 'Mayor mejora', C.s3]];

  function montarEscala(cuerpo) {
    let familia = 'km', nMax = 8, semilla = 1, log = true, datos = [], hover = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Familia de problemas', opciones: [['km', 'Cubo de Klee–Minty'], ['azar', 'Aleatorios (A, b, c positivos)']], valor: familia, alCambiar: (v) => { familia = v; log = v === 'km'; chkLog.valor = log; calcular(); } });
    ctl.rango({ etiqueta: 'Dimensión máxima n', min: 3, max: 9, valor: nMax, alCambiar: (v) => { nMax = v; calcular(); } });
    const chkLog = ctl.casilla({ etiqueta: 'escala logarítmica', valor: log, alCambiar: (v) => { log = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...REGLAS.map(([, t, col]) => ({ color: col, texto: t, forma: 'linea' })),
      { color: C.apagado, texto: '2ⁿ − 1 (solo Klee–Minty)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre una dimensión para ver las iteraciones exactas. En Klee–Minty la regla de Dantzig recorre los 2ⁿ vértices del cubo deformado; con problemas aleatorios, las tres reglas son baratas. En los aleatorios cada punto es el promedio de 40 problemas.');

    function calcular() {
      datos = [];
      for (let n = 2; n <= nMax; n++) {
        const fila = { n };
        if (familia === 'km') {
          const { c, A, b } = kleeMinty(n);
          for (const [k] of REGLAS) fila[k] = correr(c, A, b, k).iter;
        } else {
          const rnd = VIZ.semilla(semilla * 1009 + n), K = 40, r = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
          for (const [k] of REGLAS) fila[k] = 0;
          fila.max = 0;
          for (let q = 0; q < K; q++) {
            const c = Array.from({ length: n }, () => r(1, 9)), A = Array.from({ length: n }, () => Array.from({ length: n }, () => r(1, 9))), b = Array.from({ length: n }, () => r(20, 99));
            for (const [k] of REGLAS) { const it = correr(c, A, b, k).iter; fila[k] += it / K; if (k === 'dantzig') fila.max = Math.max(fila.max, it); }
          }
        }
        datos.push(fila);
      }
      dibujar();
    }
    const refKM = (n) => 2 ** n - 1;
    function dibujar() {
      if (!datos.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tope = Math.max(...datos.flatMap((f) => [f.dantzig, f.bland, f.mejora, familia === 'km' ? refKM(f.n) : 0]));
      plano = VIZ.plano(lienzo, { xmin: 2, xmax: nMax, ymin: log ? 0.7 : 0, ymax: tope * (log ? 1.6 : 1.1) }, { etiquetaX: 'n (variables = restricciones)', etiquetaY: 'iteraciones', logY: log, ticksX: datos.map((f) => f.n) });
      plano.ejes();
      if (familia === 'km') VIZ.trazar(ctx, plano, datos.map((f) => [f.n, refKM(f.n)]), C.apagado, 1.5, [3, 4]);
      for (const [k, , col] of REGLAS) VIZ.trazar(ctx, plano, datos.map((f) => [f.n, Math.max(f[k], log ? 0.71 : 0)]), col, 2);
      for (const f of datos) for (const [k, , col] of REGLAS) VIZ.marcador(ctx, plano.sx(f.n), plano.sy(Math.max(f[k], log ? 0.71 : 0)), col, 3.5);
      if (hover != null) {
        ctx.save(); ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plano.sx(hover), plano.y1); ctx.lineTo(plano.sx(hover), plano.y0); ctx.stroke(); ctx.restore();
      }
      const u = datos[datos.length - 1];
      registro.textContent = familia === 'km'
        ? `Klee–Minty con n = ${u.n}: Dantzig necesita ${u.dantzig} pivotes (= 2^${u.n} − 1 = ${refKM(u.n)}), Bland ${u.bland} y la regla de mayor mejora ${u.mejora}. Los tres terminan en el mismo óptimo.`
        : `Con problemas aleatorios de dimensión ${u.n}: en promedio Dantzig ${VIZ.fmt(u.dantzig, 3)}, Bland ${VIZ.fmt(u.bland, 3)} y mayor mejora ${VIZ.fmt(u.mejora, 3)} pivotes (el peor caso de Dantzig fue ${u.max}).`;
      lectura.set([
        ['dimensión n', String(u.n)],
        ['Dantzig', familia === 'km' ? String(u.dantzig) : VIZ.fmt(u.dantzig, 3)],
        ['Bland', familia === 'km' ? String(u.bland) : VIZ.fmt(u.bland, 3)],
        ['mayor mejora', familia === 'km' ? String(u.mejora) : VIZ.fmt(u.mejora, 3)],
        ['vértices del cubo', familia === 'km' ? String(2 ** u.n) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(2, Math.min(nMax, Math.round(plano.ix(x))));
      dibujar();
      const f = datos.find((q) => q.n === hover);
      const fm = (v) => (familia === 'km' ? String(v) : VIZ.fmt(v, 3));
      tip.mostrar(x, y, `n = <b>${hover}</b>` + REGLAS.map(([k, t, col]) => VIZ.filaTooltip(col, t, fm(f[k]))).join('') + (familia === 'km' ? VIZ.filaTooltip(C.apagado, '2ⁿ − 1', refKM(hover)) : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('pivoting-rules', {
    intro: String.raw`
      <p>En cada iteración del Simplex suele haber varias variables que podrían entrar a la base: todas las que tengan costo reducido favorable.
      La <strong>regla de pivoteo</strong> es el criterio con el que se elige una. Cualquiera mejora el objetivo (o al menos no lo empeora), pero el
      camino entre vértices, y cuántas iteraciones lleva, depende de la elección.</p>
      <p>La regla de Dantzig prefiere la dirección que más baja el costo; la de Bland elige siempre el menor índice y garantiza que no habrá ciclos; la de mayor
      mejora mira cuánto subiría realmente \(z\). En la práctica el Simplex es rápido, pero en el peor caso puede ser exponencial.</p>`,
    visualizaciones: [
      {
        titulo: 'Dantzig frente a Bland en el mismo problema',
        descripcion: 'Ambas reglas parten del origen y avanzan juntas. Con \\(c=(1,4)\\) Dantzig llega en 2 pivotes y Bland da la vuelta por el otro lado del polígono en 5; con \\(c=(4,1)\\) ambas coinciden. Arrastre \\(c\\) y compare los recorridos.',
        montar: montarComparacion,
      },
      {
        titulo: 'Cuántas iteraciones hacen falta',
        descripcion: 'En el cubo de Klee–Minty la regla de Dantzig necesita \\(2^n-1\\) pivotes; observe cómo se separa de las otras dos al subir \\(n\\). Cambie a problemas aleatorios y vea que el peor caso casi nunca aparece.',
        montar: montarEscala,
      },
    ],
    teoria: String.raw`
      <h2>Direcciones de mejora</h2>
      <p>En un vértice con base \(B\), cada variable no básica \(x_j\) define una arista: aumentar \(x_j\) y ajustar las básicas. A lo largo de esa arista
      el objetivo cambia a razón \(-\bar c_j\) por unidad de \(x_j\) (con el signo del tableau, \(\bar c_j &lt; 0\) mejora). Las variables candidatas son las de costo reducido
      negativo, y la <em>regla de entrada</em> elige una. La variable saliente la fija la <a href="tema.html?id=simplex-tableau">prueba de razón</a>.</p>
      <h2>Reglas habituales</h2>
      <table>
        <thead><tr><th>Regla</th><th>Entra</th><th>Características</th></tr></thead>
        <tbody>
          <tr><td>Dantzig</td><td>\(\arg\min_j \bar c_j\)</td><td>barata (una pasada por la fila \(z\)); puede ciclar en problemas degenerados</td></tr>
          <tr><td>Bland</td><td>menor índice con \(\bar c_j &lt; 0\) (y menor índice entre los que empatan al salir)</td><td>nunca cicla; suele necesitar muchas más iteraciones</td></tr>
          <tr><td>Mayor mejora</td><td>\(\arg\max_j\; (-\bar c_j)\,\theta_j\)</td><td>menos pivotes, pero cada uno exige hacer la prueba de razón de todas las candidatas</td></tr>
          <tr><td>Arista más empinada (<em>steepest edge</em>, <em>devex</em>)</td><td>\(\arg\min_j \bar c_j / \lVert d_j\rVert\)</td><td>la mejor en la práctica; se usa en los resolvedores comerciales</td></tr>
        </tbody>
      </table>
      <h2>Ejemplo donde difieren</h2>
      <p>En la figura 1, en el origen los costos reducidos son \((-c_1,-c_2)\). Si \(c = (1,4)\), Dantzig mueve \(x_2\) (la columna \(-4\)) y sube por el eje vertical; Bland mueve \(x_1\) y
      avanza por el eje horizontal. Como el poliedro es plano y convexo, los dos recorridos rodean el polígono en sentidos opuestos y terminan en el mismo vértice óptimo, pero con distinta cantidad de aristas.</p>
      <h2>Complejidad</h2>
      <div class="recuadro"><p><strong>Klee–Minty (1972).</strong> Existe una familia de LP con \(n\) variables y \(n\) restricciones, un cubo deformado,
      en la que la regla de Dantzig visita los \(2^n\) vértices: \(2^n - 1\) pivotes.</p></div>
      \[ \max \sum_{j=1}^{n} 2^{\,n-j} x_j \quad\text{s.a.}\quad 2\sum_{j&lt;i} 2^{\,i-j} x_j + x_i \le 5^i,\ \ x \ge 0. \]
      <p>En la figura 2 se ve que la regla de Dantzig realiza exactamente \(2^n-1\) pivotes sobre este problema. Eso no contradice la rapidez observada: el Simplex tiene
      buen comportamiento <em>promedio</em> (Borgwardt, 1982) y <em>suavizado</em> (Spielman y Teng, 2004), es decir, polinomial si los datos reciben una perturbación aleatoria
      pequeña. Si existe una regla con número polinomial de pasos en el peor caso es una pregunta abierta, ligada a la conjetura de Hirsch sobre el diámetro de los poliedros
      (refutada por Santos en 2010 para politopos, aunque los diámetros conocidos siguen siendo pequeños). Los métodos de puntos interiores y el de elipsoides sí son polinomiales.</p>
      <h2>Conexiones</h2>
      <p>La regla de Bland es la herramienta contra el ciclaje: véase <a href="tema.html?id=degeneracy-cycling">Degeneracy and Cycling</a>. Los métodos de comparación de caminos en un poliedro
      se ven mejor desde <a href="tema.html?id=polyhedra-vertices">Polyhedra, Polytopes and Vertices</a>, y para un algoritmo con otra estrategia de elección, <a href="tema.html?id=milp-branch-and-bound">Branch and Bound for MILP</a>.</p>`,
  });
})();
