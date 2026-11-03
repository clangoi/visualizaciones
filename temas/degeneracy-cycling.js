/* Degeneración y ciclaje: vértices sobredeterminados, pivotes sin mejora, el ejemplo de Beale y las defensas (Bland, perturbación). */
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
  const clave = (base) => base.slice().sort((a, b) => a - b).join(',');
  const enZero = (s) => s.base.filter((_, i) => Math.abs(s.T[i][s.nombres.length]) < EPS);
  const nombreBase = (s) => '{' + s.base.map((q) => bonito(s.nombres[q])).join(', ') + '}';

  /* ---------- Fig. 1: un vértice sobredeterminado ---------- */

  function montarVertice(cuerpo) {
    const AD = [[1, 1], [2, 1], [1, 3]];
    let c = [1, 4], b1 = 5.6, regla = 'bland', est = [], k = 0, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'b₁ (lado derecho de R₁)', min: 4.6, max: 6.6, paso: 0.2, valor: b1, alCambiar: (v) => { b1 = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'c₁', min: 1, max: 5, valor: c[0], alCambiar: (v) => { c[0] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'c₂', min: 1, max: 5, valor: c[1], alCambiar: (v) => { c[1] = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Regla', opciones: [['bland', 'Bland'], ['dantzig', 'Dantzig']], valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const caja = VIZ.el('div');
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, texto: 'región factible' },
      { color: C.s1, texto: 'vértices recorridos', forma: 'punto' },
      { color: C.s2, texto: 'vértice actual', forma: 'punto' },
      { color: C.s8, texto: 'vértice degenerado / básica en cero', forma: 'punto' },
      ...LEYENDA_TABLEAU,
    ]);
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con b₁ = 5,6 las rectas R₁, R₂ y R₃ se cortan en (2,4; 3,2): tres restricciones activas en un plano de dos dimensiones. Ese vértice tiene una variable básica en cero (celda roja del tableau) y el algoritmo puede pivotear sin avanzar. Mueva b₁ unas décimas y la degeneración desaparece.');

    function iniciar() {
      est = [...O.simplex(c, AD, [b1, 8, 12], { regla })];
      k = 0;
      return (function* () { while (k < est.length - 1) { k++; yield; } })();
    }
    const activas = (x, y) => [x, y, ...AD.map((a, i) => [b1, 8, 12][i] - a[0] * x - a[1] * y)].filter((v) => Math.abs(v) < 1e-7).length;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 6.5, ymin: 0, ymax: 6 }, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const bb = [b1, 8, 12];
      const poli = region(AD, bb, 8);
      rellenar(ctx, plano, poli, C.neutro);
      AD.forEach((a, i) => recta(ctx, plano, a, bb[i], COL_R[i], { texto: `R${sub(i + 1)}`, t: 0.1 + 0.14 * i }));
      const s = est[k];
      for (let i = 0; i < k; i++) flecha(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), plano.sx(est[i + 1].x[0]), plano.sy(est[i + 1].x[1]), C.s1, 3);
      for (const [x, y] of poli) {
        const deg = activas(x, y) > 2;
        VIZ.marcador(ctx, plano.sx(x), plano.sy(y), deg ? C.s8 : C.superficie, deg ? 6 : 4);
      }
      for (let i = 0; i <= k; i++) VIZ.marcador(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), i === k ? C.s2 : C.s1, i === k ? 5 : 4);
      caja.replaceChildren(htmlTableau(s, { marcarCeros: true }));
      const ceros = enZero(s).map((q) => bonito(s.nombres[q]));
      const sinMejora = est.slice(0, k).filter((e, i) => e.estado === 'iterando' && Math.abs(est[i + 1].z - e.z) < EPS).length;
      let txt;
      if (s.estado === 'optimo') txt = `Óptimo en (${frac(s.x[0])}, ${frac(s.x[1])}) con z = ${frac(s.z)}.${ceros.length ? ` La base queda degenerada: ${ceros.join(', ')} vale 0.` : ''}`;
      else {
        const finitas = s.razones.filter(Number.isFinite), mr = Math.min(...finitas);
        const empate = finitas.filter((r) => Math.abs(r - mr) < EPS).length > 1;
        txt = `Iteración ${k}: entra ${bonito(s.nombres[s.entra])}, sale ${bonito(s.nombres[s.base[s.sale]])} (razón mínima ${frac(mr)}).`
          + (mr < EPS ? ' La razón es 0: el pivote cambia de base, pero el vértice y z no cambian (pivote degenerado).'
            : empate ? ' Empate en la razón mínima: la fila que no sale quedará en 0, así que el próximo vértice será degenerado.' : '');
      }
      registro.textContent = txt;
      lectura.set([
        ['iteración', String(k)],
        ['vértice', `(${frac(s.x[0])}, ${frac(s.x[1])})`],
        ['z', frac(s.z)],
        ['básicas en cero', ceros.length ? ceros.join(', ') : 'ninguna'],
        ['pivotes sin mejora', String(sinMejora)],
      ]);
    }
    lienzo.alDibujar = () => est.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      const px = plano.ix(x), py = plano.iy(y);
      const poli = region(AD, [b1, 8, 12], 8);
      const v = poli.find(([vx, vy]) => Math.hypot(plano.sx(vx) - x, plano.sy(vy) - y) < 12);
      if (!v) return tip.ocultar();
      void px; void py;
      tip.mostrar(x, y, `vértice <b>(${frac(v[0])}, ${frac(v[1])})</b><br>restricciones activas: <b>${activas(v[0], v[1])}</b>${activas(v[0], v[1]) > 2 ? '<br>más de 2: degenerado' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el ciclo de Beale ---------- */

  // max 3/4 x₁ − 20 x₂ + 1/2 x₃ − 6 x₄  s.a.  ¼x₁ − 8x₂ − x₃ + 9x₄ ≤ 0,  ½x₁ − 12x₂ − ½x₃ + 3x₄ ≤ 0,  x₃ ≤ 1.
  const BEALE = { c: [3 / 4, -20, 1 / 2, -6], A: [[1 / 4, -8, -1, 9], [1 / 2, -12, -1 / 2, 3], [0, 0, 1, 0]], b: [0, 0, 1] };
  const ESTRATEGIAS = [['dantzig', 'Dantzig (empates: menor índice)'], ['bland', 'Bland'], ['perturbar', 'Dantzig con b perturbado']];

  function montarCiclo(cuerpo) {
    let modo = 'dantzig', exp = 3, est = [], k = 0, ciclo = -1, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', opciones: ESTRATEGIAS, valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'perturbación ε = 10^−k (k)', min: 2, max: 6, valor: exp, alCambiar: (v) => { exp = v; if (modo === 'perturbar') rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 280 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'iteración', forma: 'punto' },
      { color: C.s8, texto: 'base ya vista (ciclo)', forma: 'punto' },
      { color: C.s6, texto: 'óptimo', forma: 'punto' },
      ...LEYENDA_TABLEAU,
    ]);
    const caja = VIZ.el('div');
    cuerpo.appendChild(caja);
    VIZ.subtitulo(cuerpo, 'Bases visitadas');
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con Dantzig, el objetivo se queda en 0 durante seis pivotes y la base vuelve a la inicial: el algoritmo giraría para siempre sin llegar al óptimo z = 5/4. Bland y la perturbación de b rompen los empates y terminan.');

    function iniciar() {
      const e = Math.pow(10, -exp);
      const b = modo === 'perturbar' ? [e, e * e, 1 + e ** 3] : BEALE.b;
      const vistas = new Map();
      est = []; ciclo = -1; k = 0;
      for (const s of O.simplex(BEALE.c, BEALE.A, b, { regla: modo === 'bland' ? 'bland' : 'dantzig', maxIter: 30 })) {
        const cl = clave(s.base);
        est.push(s);
        if (s.estado === 'ciclaje') { est.pop(); break; }
        if (vistas.has(cl)) { ciclo = vistas.get(cl); break; }
        vistas.set(cl, est.length - 1);
      }
      return (function* () { while (k < est.length - 1) { k++; yield; } })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const vis = est.slice(0, k + 1), zs = est.map((s) => s.z);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(6, est.length - 1), ymin: -0.1, ymax: Math.max(1.5, Math.max(...zs) * 1.15) }, { etiquetaX: 'iteración', etiquetaY: 'z', ticksX: Array.from({ length: Math.max(7, est.length) }, (_, i) => i) });
      plano.ejes();
      VIZ.trazar(ctx, plano, vis.map((s, i) => [i, s.z]), C.s1, 2);
      vis.forEach((s, i) => {
        const rep2 = ciclo >= 0 && i === est.length - 1 && i <= k;
        VIZ.marcador(ctx, plano.sx(i), plano.sy(s.z), rep2 ? C.s8 : s.estado === 'optimo' ? C.s6 : C.s1, i === k ? 6 : 4);
      });
      const s = est[k];
      caja.replaceChildren(htmlTableau(s, { marcarCeros: true }));
      const repetida = ciclo >= 0 && k === est.length - 1;
      lista.replaceChildren(...vis.map((q, i) => VIZ.el('div', { class: i === k ? 'activa' : null },
        `it. ${i}: ${nombreBase(q)}  z = ${frac(q.z)}${ciclo >= 0 && i === est.length - 1 ? `  ← repite it. ${ciclo}` : ''}`)));
      if (repetida) registro.textContent = `La base ${nombreBase(s)} es la de la iteración ${ciclo}: después de ${est.length - 1 - ciclo} pivotes sin mejora volvimos al mismo tableau. Con la misma regla los pasos se repetirán eternamente (ciclaje).`;
      else if (s.estado === 'optimo') registro.textContent = `Óptimo: x₁ = ${frac(s.x[0])}, x₃ = ${frac(s.x[2])}, z = ${VIZ.fmt(s.z, 6)}. Se llegó en ${k} pivotes${modo === 'perturbar' ? '; con la perturbación z solo difiere de 5/4 en un término del orden de ε.' : '.'}`;
      else {
        const mr = Math.min(...s.razones.filter(Number.isFinite));
        registro.textContent = `Iteración ${k}: entra ${bonito(s.nombres[s.entra])}, sale ${bonito(s.nombres[s.base[s.sale]])}, razón mínima ${VIZ.fmt(mr, 3)}${mr < EPS ? ': pivote degenerado, z no cambia' : ''}.`;
      }
      lectura.set([
        ['iteración', String(k)],
        ['z', VIZ.fmt(s.z, 6)],
        ['base', nombreBase(s)],
        ['pivotes sin mejora', String(vis.slice(0, -1).filter((q, i) => Math.abs(vis[i + 1].z - q.z) < 1e-12).length)],
        ['estado', repetida ? 'ciclo' : s.estado === 'optimo' ? 'óptimo' : 'iterando'],
      ]);
    }
    lienzo.alDibujar = () => est.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      const i = Math.round(plano.ix(x));
      if (i < 0 || i > k || !plano.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `iteración <b>${i}</b><br>z = <b>${VIZ.fmt(est[i].z, 6)}</b><br>base ${nombreBase(est[i])}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('degeneracy-cycling', {
    intro: String.raw`
      <p>Un vértice es <strong>degenerado</strong> cuando pasan por él más restricciones activas de las necesarias. En el tableau se nota porque
      alguna variable básica vale cero. Allí la prueba de razón puede dar \(0\): se cambia de base, pero no se avanza ni un milímetro y el objetivo no mejora.</p>
      <p>Con mala suerte, una sucesión de esos pivotes vuelve a la base de partida y el algoritmo <strong>cicla</strong> para siempre. Es raro en la práctica, pero existen
      ejemplos construidos a propósito, y hay reglas simples que lo impiden: la de Bland y la perturbación del lado derecho.</p>`,
    visualizaciones: [
      {
        titulo: 'Un vértice sobredeterminado',
        descripcion: 'Con \\(b_1=5{,}6\\) tres rectas se cortan en un punto: observe la celda roja (variable básica en cero) y los pivotes que no mejoran \\(z\\). Cambie \\(b_1\\) unas décimas para ver desaparecer la degeneración.',
        montar: montarVertice,
      },
      {
        titulo: 'El ciclo de Beale',
        descripcion: 'En un problema de tres restricciones, Dantzig con desempate por menor índice da seis pivotes sin mejora y regresa a la base inicial. Pruebe Bland o la perturbación de \\(b\\), y mire cómo el objetivo sí llega a \\(5/4\\).',
        montar: montarCiclo,
      },
    ],
    teoria: String.raw`
      <h2>Qué es la degeneración</h2>
      <p>Una solución básica factible es <strong>degenerada</strong> si alguna variable básica vale cero, es decir, si \(B^{-1}b\) tiene una componente nula. Geométricamente, en
      \(\mathbb{R}^n\) el vértice está en la intersección de <em>más</em> de \(n\) hiperplanos (como tres rectas en el plano). Entonces ese vértice corresponde a varias bases distintas
      (véase <a href="tema.html?id=basic-feasible-solutions">Basic Feasible Solutions</a>), y es lo habitual en modelos con estructura (asignaciones, redes, planificación).</p>
      <h2>Pivotes sin mejora</h2>
      <p>Si la variable entrante \(x_j\) tiene la razón mínima \(\theta = 0\), el cambio de objetivo es \(-\bar c_j\,\theta = 0\): el vértice no cambia, solo la base que lo describe.
      Una sucesión de pivotes degenerados puede dejar el tableau como al principio:</p>
      <div class="recuadro"><p><strong>Ciclaje.</strong> Si el algoritmo visita una base dos veces, repetirá la misma secuencia indefinidamente, pues cada paso depende solo de la base actual y de la regla.</p></div>
      <h2>Un ejemplo clásico (Beale)</h2>
      \[ \max\ \tfrac34 x_1 - 20x_2 + \tfrac12 x_3 - 6x_4 \quad\text{s.a.}\quad \begin{cases} \tfrac14 x_1 - 8x_2 - x_3 + 9x_4 \le 0\\ \tfrac12 x_1 - 12x_2 - \tfrac12 x_3 + 3x_4 \le 0\\ x_3 \le 1 \end{cases}\quad x\ge 0. \]
      <p>Con la regla de Dantzig y desempates por menor índice, el algoritmo recorre las bases \(\{s_1,s_2,s_3\} \to \{x_1,s_2,s_3\} \to \{x_1,x_2,s_3\} \to \{x_3,x_2,s_3\} \to \cdots\) y, tras seis pivotes
      con \(z=0\), vuelve a \(\{s_1,s_2,s_3\}\). El óptimo es \(x=(1,0,1,0)\) con \(z = \tfrac54\), y se alcanza con la regla de Bland (siete pivotes).</p>
      <h2>Cómo evitarlo</h2>
      <ul>
        <li><strong>Regla de Bland.</strong> Entra la variable de menor índice con costo reducido negativo; sale, entre las de razón mínima, la de menor índice. Garantiza terminar (se demuestra que un ciclo obligaría a una contradicción sobre la variable de mayor índice que entra y sale en él). Suele ser lenta.</li>
        <li><strong>Perturbación.</strong> Se cambia \(b\) por \(b + (\varepsilon, \varepsilon^2, \dots, \varepsilon^m)\): con \(\varepsilon\) pequeño el problema deja de ser degenerado, ya no hay empates y el algoritmo avanza. Al final se hace \(\varepsilon \to 0\). La <strong>regla lexicográfica</strong> simula esta perturbación sin elegir un \(\varepsilon\) concreto: desempata comparando filas completas del tableau en orden lexicográfico.</li>
        <li><strong>En la práctica.</strong> Los resolvedores perturban ligeramente los datos y cambian de regla si detectan estancamiento; el ciclaje exacto es extremadamente raro, pero el <em>estancamiento</em> (muchos pivotes sin mejora) sí ocurre.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>El criterio de Bland es una de las <a href="tema.html?id=pivoting-rules">Pivoting Rules</a>. La degeneración también aparece como multiplicidad de soluciones duales (véase <a href="tema.html?id=shadow-prices">Shadow Prices</a>)
      y como inestabilidad de la base en <a href="tema.html?id=basis-stability">Stability of Optimal Bases</a>.</p>`,
  });
})();
