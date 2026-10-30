(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const FRASE = ['el', 'gato', 'negro', 'caza', 'al', 'pequeño', 'ratón', 'gris'];
  const CAT = { el: 'art', al: 'art', gato: 'sus', ratón: 'sus', negro: 'adj', pequeño: 'adj', gris: 'adj', caza: 'verbo' };
  const CABEZAS = [
    ['palabra anterior', C.s1, (i, j) => (j === i - 1 ? 3 : 0)],
    ['misma categoría', C.s2, (i, j) => (CAT[FRASE[i]] === CAT[FRASE[j]] && i !== j ? 2.2 : 0)],
    ['adjetivo → su sustantivo', C.s3, (i, j) => (CAT[FRASE[i]] === 'adj' && CAT[FRASE[j]] === 'sus' && Math.abs(i - j) <= 2 ? 3 : 0) + (i === j ? 0.5 : 0)],
    ['vecindad (±2)', C.s7, (i, j) => (Math.abs(i - j) <= 2 ? 1.6 - 0.5 * Math.abs(i - j) : 0)],
  ];
  const softmax = (v) => { const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
  const matriz = (h) => FRASE.map((_, i) => softmax(FRASE.map((_, j) => CABEZAS[h][2](i, j))));
  const ent = (a) => -a.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);

  /* ---------- Fig. 1: cada cabeza mira distinto ---------- */

  function montarCabezas(cuerpo) {
    let activas = [true, true, true, true], sel = 1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(CABEZAS.map(([n, c], i) => ({ clave: String(i), texto: `cabeza ${i + 1}: ${n}`, color: c, activo: true })), (e) => { activas = [0, 1, 2, 3].map((i) => e[String(i)]); dibujar(); });
    ctl.selector({ etiqueta: 'Palabra que se mira', opciones: FRASE.map((w, i) => [String(i), w]), valor: String(sel), alCambiar: (v) => { sel = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 300 : 580) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'peso de atención (más oscuro = más atención)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cuatro cabezas con patrones de ejemplo que se parecen a los que se observan en modelos reales (palabra anterior, categoría, adjetivo–sustantivo, vecindad). Aquí están escritos a mano para ilustrar; en un modelo cada cabeza aprende los suyos. La quinta matriz es el promedio de las cabezas activas.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 700, c = ancha ? Math.min(22, (W - 40) / (5 * 9.4)) : Math.min(22, (W - 60) / 9);
      lienzo.limpiar(); geo = [];
      const Ms = [0, 1, 2, 3].map(matriz), act = Ms.filter((_, i) => activas[i]);
      const prom = FRASE.map((_, i) => FRASE.map((_, j) => (act.length ? act.reduce((s, M) => s + M[i][j], 0) / act.length : 0)));
      const paneles = [...Ms.map((M, i) => [M, `Cabeza ${i + 1}: ${CABEZAS[i][0]}`, activas[i]]), [prom, 'Promedio de las activas', true]];
      paneles.forEach(([M, t, a], k) => {
        const col = ancha ? k : k % 2, fila = ancha ? 0 : Math.floor(k / 2), x = 30 + col * (ancha ? 9.4 * c + 10 : 9.4 * c + 40), y = 22 + fila * (8 * c + 52);
        ctx.fillStyle = a ? C.tinta2 : C.inactivo; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(t, x, y - 4);
        ctx.globalAlpha = a ? 1 : 0.35; DL.mapa(ctx, M, x, y, 8 * c, 8 * c, { min: 0, max: 1 }); ctx.globalAlpha = 1;
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.strokeRect(x, y + sel * c, 8 * c, c);
        if (k === 0 || !ancha && col === 0) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; FRASE.forEach((w, i) => ctx.fillText(w, x - 3, y + (i + 0.5) * c)); }
        geo.push({ x, y, c, M, t });
      });
      const e = [...Ms.map((M) => M.reduce((s, f) => s + ent(f), 0) / 8), prom.reduce((s, f) => s + ent(f), 0) / 8];
      registro.textContent = `Palabra «${FRASE[sel]}»: ${CABEZAS.map(([n], h) => `cabeza ${h + 1} mira «${FRASE[Ms[h][sel].indexOf(Math.max(...Ms[h][sel]))]}»`).join('; ')}.`;
      lectura.set([...CABEZAS.map(([n], h) => [`entropía media, cabeza ${h + 1}`, `${VIZ.fmt(e[h], 3)} bits`]), ['entropía del promedio', `${VIZ.fmt(e[4], 3)} bits`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x < q.x + 8 * q.c && y >= q.y && y < q.y + 8 * q.c);
      if (!g) return tip.ocultar();
      const j = Math.floor((x - g.x) / g.c), i = Math.floor((y - g.y) / g.c);
      tip.mostrar(x, y, `${g.t}<br>«${FRASE[i]}» mira «${FRASE[j]}»: <b>${VIZ.fmt(100 * g.M[i][j], 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: repartir las dimensiones entre cabezas ---------- */

  function montarReparto(cuerpo) {
    let dm = 512, h = 8, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Dimensión del modelo', opciones: [['64', '64'], ['128', '128'], ['256', '256'], ['512', '512'], ['768', '768'], ['1024', '1024']], valor: String(dm), alCambiar: (v) => { dm = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Número de cabezas', opciones: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], valor: String(h), alCambiar: (v) => { h = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cada cabeza trabaja en un subespacio de d_k = d/h dimensiones', forma: 'cuadro' }, { color: C.s6, texto: 'concatenación → matriz de salida W_O', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La entrada de d dimensiones se proyecta a h subespacios de d/h dimensiones; cada cabeza hace su atención en el suyo; los resultados se concatenan y se mezclan con W_O. Con más cabezas no hay más parámetros: se reparte lo mismo en más patrones.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, dk = dm / h, ancho = W - 24, col = [C.s1, C.s2, C.s3, C.s7];
      lienzo.limpiar(); geo = [];
      const fila = (y, t, partes) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(t, 12, y); partes.forEach((p, i) => { const x = 12 + (i * ancho) / partes.length, w = ancho / partes.length - 2; ctx.fillStyle = VIZ.alfa(p.c, 0.3); ctx.strokeStyle = p.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y + 18, w, 34, 4); ctx.fill(); ctx.stroke(); if (w > 26) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.t, x + w / 2, y + 35); } geo.push({ x, y: y + 18, w, h: 34, tx: p.tip }); }); };
      fila(6, `Entrada: ${dm} dimensiones`, [{ c: C.apagado, t: `${dm}`, tip: `entrada x: ${dm} números` }]);
      fila(72, `Proyecciones por cabeza (Q, K, V): ${h} × ${dk} dimensiones`, Array.from({ length: h }, (_, i) => ({ c: col[i % 4], t: `${dk}`, tip: `cabeza ${i + 1}: d_k = ${dk}` })));
      fila(138, `Cada cabeza produce ${dk} números por palabra (atención sobre su subespacio)`, Array.from({ length: h }, (_, i) => ({ c: col[i % 4], t: `${dk}`, tip: `salida de la cabeza ${i + 1}` })));
      fila(204, `Concatenación (${dm}) y mezcla con W_O`, [{ c: C.s6, t: `${dm} × ${dm}`, tip: `W_O: ${dm}×${dm} parámetros` }]);
      const P = 4 * dm * dm;
      registro.textContent = `Con ${h} cabeza${h > 1 ? 's' : ''}: d_k = ${dm}/${h} = ${dk}. Parámetros de la capa de atención: 4·${dm}² = ${VIZ.entero(P)} (sin sesgos), los mismos para cualquier h.`;
      lectura.set([['d_k = d / h', String(dk)], ['parámetros (W_Q, W_K, W_V, W_O)', VIZ.entero(P)], ['matrices de atención', `${h} de n × n`], ['costo de los puntajes', `h·n²·${dk} = n²·${dm}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (g) tip.mostrar(x, y, g.tx); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('multi-head-attention', {
    intro: String.raw`
      <p>Una sola atención obliga a cada palabra a escoger un único patrón de mirada. Pero una frase tiene muchas relaciones a la vez: el adjetivo con su sustantivo, el verbo con su sujeto, la palabra con la anterior. La <strong>atención multi-cabeza</strong> (<em>multi-head attention</em>) ejecuta varias atenciones en paralelo, cada una con sus propias matrices \(W_Q,W_K,W_V\), de modo que cada <strong>cabeza</strong> puede especializarse en un tipo de relación.</p>
      <p>Para no encarecer el cálculo, cada cabeza trabaja en un subespacio más pequeño: con \(h\) cabezas, cada una usa \(d_k=d/h\) dimensiones. Sus resultados se concatenan y se mezclan con una última matriz.</p>`,
    visualizaciones: [
      { titulo: 'Cada cabeza mira distinto', descripcion: 'Apague y encienda cabezas y compare sus patrones y el promedio. Elija una palabra para ver su fila resaltada en cada una.', montar: montarCabezas },
      { titulo: 'Repartir las dimensiones', descripcion: 'Cambie el número de cabezas y la dimensión del modelo: \\(d_k\\) cambia, pero el número de parámetros no.', montar: montarReparto },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      \[ \operatorname{head}_i=\operatorname{Attention}\big(XW_Q^{(i)},\,XW_K^{(i)},\,XW_V^{(i)}\big),\qquad \operatorname{MHA}(X)=\big[\operatorname{head}_1;\dots;\operatorname{head}_h\big]\,W_O, \]
      <p>con \(W_Q^{(i)},W_K^{(i)}\in\mathbb{R}^{d\times d_k}\), \(W_V^{(i)}\in\mathbb{R}^{d\times d_v}\), \(d_k=d_v=d/h\) y \(W_O\in\mathbb{R}^{hd_v\times d}\).</p>
      <h2>Parámetros y costo</h2>
      <p>Los parámetros son \(3\cdot d\cdot d + d\cdot d = 4d^2\) (sin sesgos), independientemente de \(h\): se reparte el mismo presupuesto en varias miradas más angostas. El costo de los puntajes es \(h\cdot n^2\cdot d_k=n^2 d\), también independiente de \(h\).</p>
      <h2>Qué aprenden las cabezas</h2>
      <p>Estudios de modelos entrenados (p. ej. BERT) encuentran cabezas que atienden a la palabra siguiente o anterior, a delimitadores, a objetos directos de un verbo o a correferentes. No todas son útiles: muchas se pueden podar sin perder desempeño. Los patrones de la figura son ilustrativos y están escritos a mano.</p>
      <div class="recuadro"><p>La atención multi-cabeza se combina con una red por posición, conexiones residuales y normalización en cada capa: <a href="tema.html?id=transformer-block">Transformer Block</a>. Antes, el mecanismo básico: <a href="tema.html?id=self-attention-qkv">Self-Attention</a>.</p></div>`,
  });
})();
