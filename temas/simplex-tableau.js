/* El tableau del Simplex: iteraciones sobre la tabla, recorrido de vértices sobre el plano y pivoteo elegido por el usuario. */
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
  const nombreRegla = { dantzig: 'Dantzig (mayor costo reducido)', bland: 'Bland (menor índice)' };

  // Texto de lo que ocurre en una iteración del tableau (estado de VIZ.opt.simplex).
  function narrar(s, k, regla) {
    const m = s.T.length - 1, N = s.nombres.length;
    if (s.estado === 'optimo') return `Iteración ${k}: todos los costos reducidos son ≥ 0, así que ningún movimiento mejora z. Solución óptima: ${s.x.map((v, j) => `x${sub(j + 1)} = ${frac(v)}`).join(', ')}, z = ${frac(s.z)}.`;
    if (s.estado === 'noacotado') return `Iteración ${k}: entra ${bonito(s.nombres[s.entra])} pero ninguna fila tiene coeficiente positivo en su columna: el problema no está acotado.`;
    const neg = s.T[m].slice(0, N).map((v, j) => [j, v]).filter(([, v]) => v < -EPS);
    const rz = s.razones.map((r, i) => `${bonito(s.nombres[s.base[i]])}: ${Number.isFinite(r) ? frac(r) : '—'}`).join(', ');
    return `Iteración ${k}. Costos reducidos negativos: ${neg.map(([j, v]) => `${bonito(s.nombres[j])} (${frac(v)})`).join(', ')}. Regla ${nombreRegla[regla].split(' ')[0]}: entra ${bonito(s.nombres[s.entra])}. `
      + `Razones b/a: ${rz}. La mínima está en la fila de ${bonito(s.nombres[s.base[s.sale]])}, que sale; pivote = ${frac(s.T[s.sale][s.entra])}.`;
  }

  /* ---------- Fig. 1: iterar sobre el tableau ---------- */

  function montarIteraciones(cuerpo) {
    let c = [3, 2], regla = 'dantzig', est = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'c₁ (beneficio de x₁)', min: 0.5, max: 6, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'c₂ (beneficio de x₂)', min: 0.5, max: 6, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Regla de entrada', opciones: Object.entries(nombreRegla), valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const caja = VIZ.el('div');
    cuerpo.appendChild(caja);
    VIZ.leyenda(cuerpo, LEYENDA_TABLEAU);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada «Un paso» aplica el pivote marcado y muestra el siguiente tableau. La última fila contiene los costos reducidos (en negrita los negativos, que son candidatos a entrar); la columna «razón» es b / coeficiente de la columna entrante. Cambie c₁ y c₂ y observe cómo cambia el camino.');

    function iniciar() {
      est = [...O.simplex(c, A0, B0, { regla })];
      k = 0;
      return (function* () { while (k < est.length - 1) { k++; yield; } })();
    }
    function dibujar() {
      const s = est[k];
      caja.replaceChildren(htmlTableau(s));
      registro.textContent = narrar(s, k, regla);
      lectura.set([
        ['iteración', String(k)],
        ['base', s.base.map((q) => bonito(s.nombres[q])).join(', ')],
        ['vértice (x₁, x₂)', `(${frac(s.x[0])}, ${frac(s.x[1])})`],
        ['z actual', frac(s.z)],
        ['entra / sale', s.entra >= 0 ? `${bonito(s.nombres[s.entra])} / ${bonito(s.nombres[s.base[s.sale]])}` : '—'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el recorrido sobre el plano ---------- */

  function montarRecorrido(cuerpo) {
    let c = [3, 2], regla = 'dantzig', est = [], k = 0, plano = null, poli = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Regla de entrada', opciones: Object.entries(nombreRegla), valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, texto: 'región factible' },
      { color: C.s1, texto: 'vértices recorridos', forma: 'punto' },
      { color: C.s2, texto: 'vértice actual y próximo movimiento', forma: 'punto' },
      { color: C.s6, texto: 'óptimo', forma: 'punto' },
      { color: C.tinta2, texto: 'vector c (arrastre su punta)', forma: 'punto' },
      { color: C.apagado, texto: 'recta de nivel z = c·x', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre la punta del vector c (se redondea a medios): el Simplex vuelve a empezar desde el origen. La recta punteada es el nivel de z en el vértice actual; el algoritmo solo se mueve por aristas y z nunca baja.');

    function iniciar() {
      est = [...O.simplex(c, A0, B0, { regla })];
      k = 0;
      return (function* () { while (k < est.length - 1) { k++; yield; } })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 6.5, ymin: 0, ymax: 6.5 }, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      poli = region(A0, B0, 6.5);
      rellenar(ctx, plano, poli, C.neutro);
      A0.forEach((a, i) => recta(ctx, plano, a, B0[i], COL_R[i], { ancho: 1.5, texto: `R${sub(i + 1)}`, t: 0.1 + 0.14 * i }));
      const s = est[k], ultimo = k === est.length - 1;
      recta(ctx, plano, c, c[0] * s.x[0] + c[1] * s.x[1], C.apagado, { ancho: 1.5, guion: [4, 4] });
      for (let i = 0; i < k; i++) flecha(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), plano.sx(est[i + 1].x[0]), plano.sy(est[i + 1].x[1]), C.s1, 3);
      if (!ultimo) flecha(ctx, plano.sx(s.x[0]), plano.sy(s.x[1]), plano.sx(est[k + 1].x[0]), plano.sy(est[k + 1].x[1]), C.s2, 3, [6, 4]);
      for (const [x, y] of poli) VIZ.marcador(ctx, plano.sx(x), plano.sy(y), C.superficie, 4);
      for (let i = 0; i <= k; i++) VIZ.marcador(ctx, plano.sx(est[i].x[0]), plano.sy(est[i].x[1]), i === k ? (ultimo ? C.s6 : C.s2) : C.s1, i === k ? 7 : 5);
      // Vector c desde el origen.
      const tx = plano.sx(c[0]), ty = plano.sy(c[1]);
      flecha(ctx, plano.sx(0), plano.sy(0), tx, ty, C.tinta2, 2);
      VIZ.marcador(ctx, tx, ty, C.tinta2, 6);
      ctx.save();
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`c = (${frac(c[0])}, ${frac(c[1])})`, tx + 9, ty - 6);
      ctx.restore();
      registro.textContent = narrar(s, k, regla);
      lectura.set([
        ['iteración', String(k)],
        ['vértice actual', `(${frac(s.x[0])}, ${frac(s.x[1])})`],
        ['z = c·x', frac(s.z)],
        ['aristas recorridas', String(k)],
        ['vértices del polígono', String(poli.length)],
      ]);
    }
    lienzo.alDibujar = () => est.length && dibujar();
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
      if (Math.hypot(plano.sx(c[0]) - x, plano.sy(c[1]) - y) < 12) texto = `vector c = <b>(${frac(c[0])}, ${frac(c[1])})</b><br>z crece en esa dirección`;
      if (texto) tip.mostrar(x, y, texto); else tip.ocultar();
    }, () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: elija usted el pivote ---------- */

  const PROBLEMAS = {
    chvatal: { nombre: 'Tres variables (Chvátal)', c: [5, 4, 3], A: [[2, 3, 1], [4, 1, 2], [3, 4, 2]], b: [5, 11, 8] },
    lento: { nombre: 'Tres variables (Dantzig tarda más que Bland)', c: [3, 2, 4], A: [[1, 1, 2], [2, 0, 3], [2, 1, 3]], b: [4, 5, 7] },
    azar: { nombre: 'Cuatro variables al azar' },
  };
  function inicial(c, A, b) {
    const m = A.length, n = c.length;
    const T = A.map((f, i) => [...f, ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)), b[i]]);
    T.push([...c.map((v) => -v), ...Array(m).fill(0), 0]);
    return { T, base: Array.from({ length: m }, (_, i) => n + i), nombres: [...c.map((_, i) => 'x' + (i + 1)), ...A.map((_, i) => 's' + (i + 1))], n, m };
  }
  // Prueba de razón mínima para la columna j (empates: menor índice de la variable básica).
  function razon(st, j) {
    const { T, base, m } = st, N = st.nombres.length;
    const razones = T.slice(0, m).map((f) => (f[j] > EPS ? f[N] / f[j] : Infinity));
    let sale = -1, mr = Infinity;
    razones.forEach((r, i) => { if (r < mr - EPS || (Math.abs(r - mr) <= EPS && sale >= 0 && base[i] < base[sale])) { mr = r; sale = i; } });
    return { razones, sale };
  }
  function pivotar(st, j, sale) {
    const T = st.T.map((f) => f.slice()), p = T[sale][j];
    T[sale] = T[sale].map((v) => v / p);
    for (let i = 0; i <= st.m; i++) if (i !== sale && Math.abs(T[i][j]) > 0) { const f = T[i][j]; T[i] = T[i].map((v, q) => v - f * T[sale][q]); }
    const base = st.base.slice(); base[sale] = j;
    return { ...st, T, base };
  }
  const negativas = (st) => st.T[st.m].slice(0, st.nombres.length).map((v, j) => [j, v]).filter(([, v]) => v < -EPS);
  const solucion = (st) => { const x = Array(st.nombres.length).fill(0); st.base.forEach((q, i) => { x[q] = st.T[i][st.nombres.length]; }); return x; };
  // Mínimo número de pivotes hasta el óptimo entre todas las secuencias posibles de columnas entrantes (búsqueda en anchura).
  function minimoPivotes(st0) {
    let nivel = [st0], vistos = new Set([st0.base.join()]);
    for (let d = 0; d < 12 && nivel.length; d++) {
      const sig = [];
      for (const st of nivel) {
        const neg = negativas(st);
        if (!neg.length) return d;
        for (const [j] of neg) {
          const { sale } = razon(st, j);
          if (sale < 0) continue;
          const nuevo = pivotar(st, j, sale), clave = nuevo.base.join();
          if (!vistos.has(clave)) { vistos.add(clave); sig.push(nuevo); }
        }
      }
      nivel = sig;
    }
    return null;
  }

  function montarEleccion(cuerpo) {
    let clave = 'chvatal', semilla = 1, prob = null, hist = [], elec = -1, ref = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; preparar(); } });
    ctl.boton('Pivotar', () => aplicar(), { primario: true });
    ctl.boton('Sugerir Dantzig', () => {
      const neg = negativas(hist[hist.length - 1]);
      if (neg.length) { elec = neg.reduce((a, q) => (q[1] < a[1] ? q : a))[0]; dibujar(); }
    });
    ctl.boton('Deshacer', () => { if (hist.length > 1) { hist.pop(); elec = -1; dibujar(); } });
    ctl.boton('Reiniciar', () => preparar());
    ctl.boton('Nuevos datos', () => { semilla++; if (clave === 'azar') preparar(); });
    const caja = VIZ.el('div');
    cuerpo.appendChild(caja);
    VIZ.leyenda(cuerpo, LEYENDA_TABLEAU);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse el nombre de una columna con costo reducido negativo (borde azul): se previsualiza su prueba de razón. Luego «Pivotar». Intente llegar al óptimo en el menor número de pivotes y compare con Dantzig, Bland y el mínimo posible.');

    function preparar() {
      if (clave === 'azar') {
        const rnd = VIZ.semilla(semilla * 97 + 5), r = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
        prob = { c: Array.from({ length: 4 }, () => r(1, 9)), A: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => r(1, 9))), b: Array.from({ length: 4 }, () => r(20, 60)) };
      } else prob = PROBLEMAS[clave];
      hist = [inicial(prob.c, prob.A, prob.b)];
      elec = -1;
      ref = {
        dantzig: [...O.simplex(prob.c, prob.A, prob.b, { regla: 'dantzig' })].length - 1,
        bland: [...O.simplex(prob.c, prob.A, prob.b, { regla: 'bland' })].length - 1,
        minimo: minimoPivotes(hist[0]),
      };
      dibujar();
    }
    function aplicar() {
      const st = hist[hist.length - 1];
      if (elec < 0) { registro.textContent = negativas(st).length ? 'Primero pulse una columna con costo reducido negativo.' : 'Ya está en el óptimo.'; return; }
      const { sale } = razon(st, elec);
      if (sale < 0) return;
      hist.push(pivotar(st, elec, sale));
      elec = -1;
      dibujar();
    }
    function dibujar() {
      const st = hist[hist.length - 1], neg = negativas(st), N = st.nombres.length, hecho = !neg.length;
      let vista = { ...st, entra: -1, sale: -1, razones: [] };
      if (elec >= 0 && !hecho) { const r = razon(st, elec); vista = { ...st, entra: elec, sale: r.sale, razones: r.razones }; }
      caja.replaceChildren(htmlTableau(vista, { clic: hecho ? null : (j) => { elec = j; dibujar(); } }));
      const x = solucion(st), pasos = hist.length - 1;
      if (hecho) registro.textContent = `Óptimo en ${pasos} pivote${pasos === 1 ? '' : 's'}: z = ${frac(st.T[st.m][N])}. Dantzig necesita ${ref.dantzig}, Bland ${ref.bland} y el mínimo posible es ${ref.minimo}.`;
      else if (elec < 0) registro.textContent = `Candidatas a entrar: ${neg.map(([j, v]) => `${bonito(st.nombres[j])} (${frac(v)})`).join(', ')}. Cualquiera mejora z; elija una pulsando su columna.`;
      else {
        const gan = -st.T[st.m][elec] * vista.razones[vista.sale];
        registro.textContent = `Entraría ${bonito(st.nombres[elec])}: la razón mínima ${frac(vista.razones[vista.sale])} está en la fila de ${bonito(st.nombres[st.base[vista.sale]])}, que saldría. z subiría ${frac(gan)} (costo reducido ${frac(st.T[st.m][elec])} × razón). Pulse «Pivotar».`;
      }
      lectura.set([
        ['pivotes hechos', String(pasos)],
        ['z actual', frac(st.T[st.m][N])],
        ['solución x', '(' + x.slice(0, st.n).map(frac).join(', ') + ')'],
        ['Dantzig / Bland', `${ref.dantzig} / ${ref.bland} pivotes`],
        ['mínimo posible', ref.minimo == null ? '—' : `${ref.minimo} pivotes`],
      ]);
    }
    preparar();
  }

  VIZ.registrarTema('simplex-tableau', {
    intro: String.raw`
      <p>El <strong>tableau</strong> es la tabla donde el Simplex hace todo su trabajo: cada fila es una restricción escrita en función de las
      variables no básicas, y la última fila dice cuánto mejoraría el objetivo si una variable no básica empezara a crecer. En cada iteración se
      elige una variable que entra, se descubre cuál debe salir antes de violar alguna restricción y se reescribe la tabla.</p>
      <p>Cada tableau corresponde a un vértice; cada pivote, a un paso por una arista que no empeora \(z\). El algoritmo termina cuando ninguna
      variable puede mejorar el objetivo.</p>`,
    visualizaciones: [
      {
        titulo: 'Simplex paso a paso en el tableau',
        descripcion: 'Avance iteración por iteración y mire la columna entrante, la prueba de razón y la fila saliente. Cambie \\(c_1\\) y \\(c_2\\), y compare cómo cambian las variables que entran con la regla de Dantzig y la de Bland.',
        montar: montarIteraciones,
      },
      {
        titulo: 'El recorrido sobre el plano',
        descripcion: 'El camino de vértices en el plano que corresponde a cada tableau. Arrastre la punta del vector \\(c\\) para ver cómo cambia la ruta: siempre sube por aristas hasta que \\(c\\) forma un ángulo obtuso con todas las salientes.',
        montar: montarRecorrido,
      },
      {
        titulo: 'Elija usted la variable entrante',
        descripcion: 'Elija la columna que entra, vea la prueba de razón y pivote. Pruebe a vencer a Dantzig en el problema «Dantzig tarda más que Bland»: el mínimo posible lo dice la lectura.',
        montar: montarEleccion,
      },
    ],
    teoria: String.raw`
      <h2>El tableau</h2>
      <p>Para una base \(B\), el tableau es la matriz aumentada \([\,B^{-1}A \mid B^{-1}b\,]\) con una fila extra de <strong>costos reducidos</strong>:</p>
      \[ \bar c_j = c_B^\top B^{-1} a_j - c_j. \]
      <p>(En el convenio de la figura, la fila \(z\) guarda \(-c_j\) al inicio, así que una entrada negativa señala una variable que mejora el objetivo.)
      La esquina inferior derecha es el valor \(z = c_B^\top B^{-1} b\).</p>
      <h2>Algoritmo</h2>
      <pre><code>mientras exista j con costo reducido c̄ⱼ &lt; 0:
    elegir j                                  // variable entrante
    si a'ᵢⱼ ≤ 0 para todo i: devolver «no acotado»
    i* ← argmín { b'ᵢ / a'ᵢⱼ : a'ᵢⱼ &gt; 0 }       // prueba de razón mínima
    pivotear en (i*, j):
        fila i* ← fila i* / a'ᵢ*ⱼ
        para cada otra fila r (incluida z): fila r ← fila r − a'ᵣⱼ · fila i*
devolver la solución básica actual</code></pre>
      <p>La razón mínima garantiza que la variable saliente llega a cero justo cuando la entrante ha crecido todo lo posible sin hacer
      negativa ninguna otra: el nuevo vértice sigue siendo factible.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Para \(\max\, 3x_1 + 2x_2\) con \(x_1+x_2\le 5\), \(2x_1+x_2\le 8\), \(x_1+3x_2\le 12\), el tableau inicial (base \(s_1,s_2,s_3\)) es</p>
      <div class="caja-desplazable"><table class="tabla-datos sin-corte">
        <thead><tr><th class="izq">Base</th><th>x₁</th><th>x₂</th><th>s₁</th><th>s₂</th><th>s₃</th><th>LD</th><th>razón</th></tr></thead>
        <tbody>
          <tr><td class="izq">s₁</td><td>1</td><td>1</td><td>1</td><td>0</td><td>0</td><td>5</td><td>5</td></tr>
          <tr><td class="izq">s₂</td><td>2</td><td>1</td><td>0</td><td>1</td><td>0</td><td>8</td><td>4</td></tr>
          <tr><td class="izq">s₃</td><td>1</td><td>3</td><td>0</td><td>0</td><td>1</td><td>12</td><td>12</td></tr>
          <tr><td class="izq">z</td><td>−3</td><td>−2</td><td>0</td><td>0</td><td>0</td><td>0</td><td></td></tr>
        </tbody></table></div>
      <p>Entra \(x_1\) (costo reducido \(-3\)), la razón mínima \(4\) está en la fila de \(s_2\): sale \(s_2\). Tras pivotear en el \(2\), el vértice es \((4,0)\) con \(z = 12\) y
      la fila \(z\) queda \((0,\,-\tfrac12,\,0,\,\tfrac32,\,0\mid 12)\). Entra \(x_2\); las razones son \(2,\ 8,\ 3{,}2\), sale \(s_1\), y la fila \(z\) pasa a
      \((0,0,1,1,0\mid 13)\): todos los costos reducidos son no negativos y el óptimo es \((3,2)\) con \(z=13\). Los valores \(1\) y \(1\) bajo \(s_1\) y \(s_2\) son los
      <a href="tema.html?id=shadow-prices">precios sombra</a> de esas restricciones.</p>
      <h2>Por qué funciona</h2>
      <ul>
        <li><strong>Factibilidad:</strong> la prueba de razón conserva \(b' \ge 0\) en cada iteración.</li>
        <li><strong>Mejora:</strong> si la razón mínima es positiva, \(z\) aumenta en \(-\bar c_j \cdot \theta\) con \(\theta\) esa razón.</li>
        <li><strong>Optimalidad:</strong> si todos los \(\bar c_j \ge 0\), ninguna dirección que parte del vértice mejora \(z\) y, por convexidad, el vértice es óptimo global.</li>
        <li><strong>Terminación:</strong> hay finitas bases; si no hay degeneración \(z\) crece estrictamente y no se repite ninguna (con degeneración véase <a href="tema.html?id=degeneracy-cycling">Degeneracy and Cycling</a>).</li>
      </ul>
      <h2>Conexiones</h2>
      <p>Los símbolos del tableau salen de <a href="tema.html?id=standard-form">Standard Form and Slack Variables</a> y cada fila de una
      <a href="tema.html?id=basic-feasible-solutions">solución básica factible</a>. La elección de la columna entrante es el tema de
      <a href="tema.html?id=pivoting-rules">Pivoting Rules</a>; los casos en que la prueba de razón falla, el de
      <a href="tema.html?id=unbounded-infeasible">Unbounded and Infeasible Problems</a>.</p>`,
  });
})();
