(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml, M = VIZ.min;

  const f = (x) => Math.sin(2.4 * x) * 0.9 + 0.2 * x;

  // Ajuste polinomial por mínimos cuadrados con un ridge mínimo para estabilidad numérica.
  function ajustar(D, g) {
    const m = g + 1, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
    for (const { x, y } of D) for (let i = 0; i < m; i++) { b[i] += y * x ** i; for (let j = 0; j < m; j++) A[i][j] += x ** (i + j); }
    for (let i = 0; i < m; i++) A[i][i] += 1e-9;
    const w = ML.resolver(A, b);
    return (x) => w.reduce((s, c, i) => s + c * x ** i, 0);
  }
  const mse = (D, h) => M.media(D.map(({ x, y }) => (h(x) - y) ** 2));

  /* ---------- Fig. 1: error de entrenamiento y de prueba según la complejidad ---------- */

  function montarGrado(cuerpo) {
    let g = 3, n = 25, sigma = 0.25, semilla = 1, tr = [], te = [], filas = [], hov = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Grado del polinomio', min: 0, max: 14, valor: g, alCambiar: (v) => { g = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ejemplos de entrenamiento', min: 8, max: 80, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0.05, max: 0.6, paso: 0.05, valor: sigma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { sigma = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 360 });
    const l2 = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'entrenamiento', forma: 'punto' }, { color: C.s2, texto: 'prueba (nunca usada para ajustar)', forma: 'punto' }, { color: C.tinta, texto: 'modelo ajustado', forma: 'linea' }, { color: C.s6, texto: 'función verdadera', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El error de entrenamiento siempre baja al subir el grado; el de prueba baja y luego sube. Con pocos ejemplos o mucho ruido, el grado óptimo es menor.');
    function calcular() {
      const r = VIZ.semilla(semilla * 17);
      const gen = (m) => Array.from({ length: m }, () => { const x = r() * 3.2 - 1.6; return { x, y: f(x) + sigma * VIZ.normal(r) }; });
      tr = gen(n); te = gen(300);
      filas = Array.from({ length: 15 }, (_, d) => { const h = ajustar(tr, d); return { d, et: mse(tr, h), ep: mse(te, h) }; });
      dibujar();
    }
    let p2 = null;
    function dibujar() {
      if (!tr.length) return;
      const h = ajustar(tr, g), fila = filas[g];
      {
        const { ctx } = l1;
        l1.limpiar();
        const p = VIZ.plano(l1, { xmin: -1.6, xmax: 1.6, ymin: -2.2, ymax: 2.2 }, { etiquetaX: 'x', etiquetaY: 'y' });
        p.ejes();
        ctx.save(); p.recortar();
        VIZ.trazar(ctx, p, Array.from({ length: 161 }, (_, i) => [-1.6 + i * 0.02, f(-1.6 + i * 0.02)]), C.s6, 2, [5, 4]);
        te.slice(0, 60).forEach((q) => VIZ.marcador(ctx, p.sx(q.x), p.sy(q.y), VIZ.alfa(C.s2, 0.5), 2.5));
        tr.forEach((q) => VIZ.marcador(ctx, p.sx(q.x), p.sy(q.y), C.s1, 4));
        VIZ.trazar(ctx, p, Array.from({ length: 161 }, (_, i) => [-1.6 + i * 0.02, h(-1.6 + i * 0.02)]), C.tinta, 2.5);
        ctx.restore();
      }
      {
        const { ctx } = l2;
        l2.limpiar();
        p2 = VIZ.plano(l2, { xmin: 0, xmax: 14, ymin: 0, ymax: 1 }, { etiquetaX: 'grado del polinomio (complejidad)', etiquetaY: 'error cuadrático medio', ticksX: [0, 2, 4, 6, 8, 10, 12, 14] });
        p2.ejes();
        for (const [k, c] of [['et', C.s1], ['ep', C.s2]]) VIZ.trazar(ctx, p2, filas.map((q) => [q.d, Math.min(q[k], 1)]), c, 2);
        VIZ.trazar(ctx, p2, [[0, sigma * sigma], [14, sigma * sigma]], C.apagado, 1.5, [3, 4]);
        [['et', C.s1], ['ep', C.s2]].forEach(([k, c]) => VIZ.marcador(ctx, p2.sx(g), p2.sy(Math.min(fila[k], 1)), c, 5));
        const mejor = filas.reduce((m, q) => (q.ep < m.ep ? q : m));
        VIZ.marcador(ctx, p2.sx(mejor.d), p2.sy(Math.min(mejor.ep, 1)), C.s6, 6);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.fillText('ruido σ²', p2.x1, p2.sy(sigma * sigma) - 5);
        const diag = g < mejor.d ? 'subajuste: el modelo es demasiado simple' : g > mejor.d + 1 ? 'sobreajuste: el modelo memoriza el ruido' : 'cerca del equilibrio';
        registro.textContent = `Grado ${g}: error ${VIZ.fmt(fila.et, 3)} al entrenar y ${VIZ.fmt(fila.ep, 3)} en prueba — ${diag}.`;
        lectura.set([['error de entrenamiento', VIZ.fmt(fila.et, 3)], ['error de prueba', VIZ.fmt(fila.ep, 3)], ['brecha de generalización', VIZ.fmt(fila.ep - fila.et, 3)], ['mejor grado (prueba)', String(mejor.d)]]);
      }
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!p2 || !p2.dentro(x, y)) return tip.ocultar();
      const q = filas[Math.max(0, Math.min(14, Math.round(p2.ix(x))))];
      tip.mostrar(x, y, `grado <b>${q.d}</b>` + VIZ.filaTooltip(C.s1, 'entrenamiento', VIZ.fmt(q.et, 3)) + VIZ.filaTooltip(C.s2, 'prueba', VIZ.fmt(q.ep, 3)));
    });
    l2.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: comparación de modelos con la misma partición ---------- */

  const MODELOS = [
    ['k-NN, k = 1', C.s1, (tr) => DL.knn(tr, 1)],
    ['k-NN, k = 15', C.s3, (tr) => DL.knn(tr, 15)],
    ['regresión logística', C.s2, (tr) => DL.logistica(tr)],
    ['red de 12 neuronas', C.s7, (tr, sem) => {
      const r = DL.red([2, 12, 1], { act: 'tanh', semilla: sem }), o = DL.optimizador('adam', { lr: 0.05 }), rnd = VIZ.semilla(sem);
      for (let e = 0; e < 150; e++) { const L = DL.mezclar(DL.pares(tr), rnd); for (let i = 0; i < L.length; i += 16) DL.entrenarPaso(r, L.slice(i, i + 16), o); }
      return (x, y) => DL.predecir(r, [x, y])[0];
    }],
  ];
  function montarComparacion(cuerpo) {
    let tipo = 'lunas', ruido = 0.4, semilla = 1, res = [], hov = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([c]) => c !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 1, paso: 0.05, valor: ruido, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nueva partición', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'entrenamiento (barra vacía)', forma: 'cuadro' }, { color: C.s1, texto: 'prueba (barra llena, color del modelo)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada modelo se entrena con el 60 % de los datos y se evalúa en el resto. Una sola partición es ruidosa: pulse «Nueva partición» varias veces antes de declarar un ganador.');
    function calcular() {
      const p = ML.partir(ML.datos(tipo, 140, ruido, semilla * 3 + 1), 0.6, semilla);
      res = MODELOS.map(([n, c, mk], i) => { const h = mk(p.entrenamiento, semilla + i); return { n, c, tr: DL.acierto(p.entrenamiento, h), te: DL.acierto(p.validacion, h) }; });
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: res.length, ymin: 0.4, ymax: 1 }, { etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %`, ticksX: [], margen: { inf: 34 } });
      pl.ejes();
      const bw = (pl.x1 - pl.x0) / res.length;
      geo = { pl, bw };
      res.forEach((r, i) => {
        const x = pl.x0 + i * bw + bw * 0.14, w = bw * 0.34;
        ctx.strokeStyle = r.c; ctx.lineWidth = 2; ctx.fillStyle = VIZ.alfa(r.c, 0.05);
        ctx.beginPath(); ctx.roundRect(x, pl.sy(r.tr), w, pl.y0 - pl.sy(r.tr), [4, 4, 0, 0]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = r.c; ctx.beginPath(); ctx.roundRect(x + w + 2, pl.sy(r.te), w, pl.y0 - pl.sy(r.te), [4, 4, 0, 0]); ctx.fill();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(r.n, pl.x0 + (i + 0.5) * bw, pl.y0 + 8);
      });
      const mejor = res.reduce((m, r) => (r.te > m.te ? r : m));
      registro.textContent = `Mejor en prueba en esta partición: ${mejor.n} (${VIZ.fmt(100 * mejor.te, 3)} %). La brecha más grande entre entrenamiento y prueba es de ${VIZ.fmt(100 * Math.max(...res.map((r) => r.tr - r.te)), 3)} puntos.`;
      lectura.set(res.map((r) => [r.n, `${VIZ.fmt(100 * r.tr, 3)} % → ${VIZ.fmt(100 * r.te, 3)} %`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || x < geo.pl.x0 || x > geo.pl.x1) return tip.ocultar();
      const r = res[Math.min(res.length - 1, Math.floor((x - geo.pl.x0) / geo.bw))];
      tip.mostrar(x, y, `<b>${r.n}</b><br>entrenamiento ${VIZ.fmt(100 * r.tr, 3)} %<br>prueba ${VIZ.fmt(100 * r.te, 3)} %`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('generalization-splits', {
    intro: String.raw`
      <p>Un modelo no se juzga por lo bien que repite los ejemplos que ya vio, sino por lo bien que responde a datos <strong>nuevos</strong>. Esa capacidad se llama <em>generalización</em>.
      Para medirla se separa un <strong>conjunto de prueba</strong> que el modelo nunca usa para aprender.</p>
      <p>Si el modelo es demasiado simple, falla incluso en los datos de entrenamiento (<em>subajuste</em>, <em>underfitting</em>). Si es demasiado flexible, memoriza el ruido y falla en los datos nuevos (<em>sobreajuste</em>, <em>overfitting</em>).
      Comparar modelos solo tiene sentido con la misma partición y fijándose en la prueba, no en el entrenamiento.</p>`,
    visualizaciones: [
      { titulo: 'Subajuste y sobreajuste', descripcion: 'Suba el grado del polinomio y compare las dos curvas de error. Luego reduzca los ejemplos y vea cómo se adelanta el sobreajuste.', montar: montarGrado },
      { titulo: 'Comparar modelos con la misma partición', descripcion: 'Un modelo con exactitud 100 % en entrenamiento puede ser el peor en prueba. Pruebe con ruido alto y con «Círculos concéntricos».', montar: montarComparacion },
    ],
    teoria: String.raw`
      <h2>Riesgo verdadero y riesgo empírico</h2>
      <p>Lo que se quiere minimizar es el <em>riesgo</em>, el error esperado sobre la distribución real de los datos:</p>
      \[ R(f) = \mathbb{E}_{(x,y)\sim P}\big[\ell(f(x), y)\big], \qquad \hat R_{\text{train}}(f) = \frac{1}{n}\sum_{i=1}^n \ell(f(x_i), y_i). \]
      <p>Como \(P\) no se conoce, el entrenamiento minimiza \(\hat R_{\text{train}}\). Pero \(\hat R_{\text{train}}\) es un estimador <em>optimista</em> de \(R\), porque \(f\) se escogió mirando esos mismos datos. En cambio, el error en un conjunto de
      prueba independiente, \(\hat R_{\text{test}}\), es un estimador insesgado de \(R(\hat f)\), con desviación del orden \(1/\sqrt{m}\) para \(m\) ejemplos de prueba.</p>
      <h2>Brecha de generalización</h2>
      \[ \text{brecha} = R(\hat f) - \hat R_{\text{train}}(\hat f) \;\ge\; 0 \text{ (en promedio)}. \]
      <p>Crece con la complejidad del modelo y disminuye con el número de ejemplos. Por eso:</p>
      <ul>
        <li><strong>Subajuste:</strong> error alto en entrenamiento y en prueba; la brecha es pequeña. Remedio: más capacidad.</li>
        <li><strong>Sobreajuste:</strong> error bajo en entrenamiento y alto en prueba; la brecha es grande. Remedios: más datos, <a href="tema.html?id=l1-l2-regularization">regularización</a>, un modelo más simple.</li>
      </ul>
      <h2>Reglas de uso</h2>
      <ol>
        <li>Separe los conjuntos <em>antes</em> de mirar los datos; nada de la prueba debe influir en el entrenamiento (ni siquiera la media usada para estandarizar).</li>
        <li>Para elegir hiperparámetros, use un tercer conjunto de <em>validación</em> o <a href="tema.html?id=supervised-learning">validación cruzada</a>; reserve la prueba para la medición final.</li>
        <li>Con pocos datos, repita la partición: el resultado de una sola es ruidoso.</li>
      </ol>
      <p>La descomposición del error en sesgo y varianza se estudia en <a href="tema.html?id=bias-variance">Bias–Variance Tradeoff</a>.</p>`,
  });
})();
