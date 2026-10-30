(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: t-SNE en movimiento ---------- */

  function montarOptimizacion(cuerpo) {
    let tipo = 'cumulos', perp = 20, n = 150, semilla = 1, D = null, est = null, hover = -1;
    const ITER = 600, LOTE = 10;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS_ALTOS, valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Perplejidad', min: 2, max: 50, valor: perp, alCambiar: (v) => { perp = v; }, alSoltar: () => rep.reiniciar() });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse Reproducir. Las primeras 100 iteraciones usan «exageración temprana» (las atracciones se multiplican por 12) para formar grupos compactos; después se relajan. Pase el cursor sobre un punto para ver sus 10 vecinos en el espacio original.');
    function iniciar() {
      D = M.datosAltos(tipo, n, semilla);
      vec = null;
      est = M.tsne(D.X, { perplejidad: perp, semilla });
      return (function* () { while (est.iter < ITER) { for (let k = 0; k < LOTE; k++) est.paso(); yield; } })();
    }
    let plano = null, vec = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = M.planoIncrustacion(lienzo, est.Y);
      const P = est.Y.map((y) => ({ x: y[0], y: y[1] }));
      if (hover >= 0) {
        vec = vec || M.knnGrafo(D.X, 10);
        ctx.save(); ctx.strokeStyle = C.s4; ctx.lineWidth = 1.5;
        for (const v of vec[hover]) { ctx.beginPath(); ctx.moveTo(plano.sx(P[hover].x), plano.sy(P[hover].y)); ctx.lineTo(plano.sx(P[v.j].x), plano.sy(P[v.j].y)); ctx.stroke(); }
        ctx.restore();
      }
      M.dispersion(ctx, plano, P, { color: (p, i) => M.colorAlto(D, i), forma: (p, i) => M.formaAlto(D, i), r: 3.5 });
      leyenda.set([...M.leyendaAltos(tipo), { color: C.s4, texto: '10 vecinos en el espacio original', forma: 'linea' }]);
      registro.textContent = est.iter === 0 ? 'Inicio: puntos al azar muy cerca del origen.'
        : est.iter <= 100 ? `Iteración ${est.iter}: exageración temprana; los grupos se separan rápido.`
          : est.iter < ITER ? `Iteración ${est.iter}: ajuste fino; las distancias entre grupos se acomodan.` : `Terminado tras ${ITER} iteraciones.`;
      lectura.set([
        ['iteración', `${est.iter} / ${ITER}`],
        ['divergencia KL(P‖Q)', Number.isFinite(est.kl) ? VIZ.fmt(est.kl, 3) : '—'],
        ['perplejidad', String(perp)],
        ['dimensión original', String(D.d)],
      ]);
    }
    lienzo.alDibujar = () => est && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = plano ? M.cercanoIncrustacion(plano, est.Y, x, y) : -1;
      if (i !== hover) { hover = i; if (!rep.activo) dibujar(); }
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `punto <b>${i}</b><br>${D.g ? `grupo <b>${D.g[i] + 1}</b>` : `posición en el rollo <b>${VIZ.fmt(D.t[i], 2)}</b>`}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (!rep.activo && est) dibujar(); });
    M.alSalir(cuerpo, () => rep.detener());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: perplejidad y σ ---------- */

  function montarPerplejidad(cuerpo) {
    let perp = 10, semilla = 2, pts = [], i0 = 0, af = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Perplejidad', min: 2, max: 60, valor: perp, alCambiar: (v) => { perp = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'p(j | i): área ∝ probabilidad', forma: 'punto' },
      { color: C.s7, texto: 'círculos de radio σᵢ y 2σᵢ', forma: 'linea' },
      { color: C.inactivo, texto: 'otro punto', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un punto i. Su σᵢ se ajusta para que la distribución p(· | i) tenga «perplejidad» vecinos efectivos: en la mancha densa σᵢ es chico, en la dispersa, grande.');
    function generar() { pts = VIZ.min.datos2d('densidades', 140, semilla); i0 = 0; calcular(); }
    function calcular() {
      const X = pts.map((p) => [p.x, p.y]);
      af = M.afinidades(X.map((a) => X.map((b) => M.dist2(a, b))), perp);
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.ml.plano(lienzo, { dominio: { xmin: -1.15 * lienzo.ancho / lienzo.alto, xmax: 1.15 * lienzo.ancho / lienzo.alto, ymin: -1.15, ymax: 1.15 } });
      plano.ejes();
      const p = af.P[i0], s = af.sigmas[i0], mx = Math.max(...p);
      const escala = (plano.sx(1) - plano.sx(0));
      ctx.save(); plano.recortar();
      for (const k of [1, 2]) { ctx.strokeStyle = C.s7; ctx.lineWidth = 1.5; ctx.setLineDash(k === 2 ? [4, 4] : []); ctx.beginPath(); ctx.arc(plano.sx(pts[i0].x), plano.sy(pts[i0].y), k * s * escala, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.restore();
      pts.forEach((q, j) => {
        if (j === i0) return;
        const r = 2 + 12 * Math.sqrt(p[j] / mx);
        if (p[j] / mx > 0.01) VIZ.marcador(ctx, plano.sx(q.x), plano.sy(q.y), VIZ.alfa(C.s2, 0.35 + 0.65 * (p[j] / mx)), r);
        else VIZ.marcador(ctx, plano.sx(q.x), plano.sy(q.y), C.inactivo, 2.5);
      });
      VIZ.marcador(ctx, plano.sx(pts[i0].x), plano.sy(pts[i0].y), C.tinta, 6);
      const H = -M.suma(p.map((v) => (v > 0 ? v * Math.log2(v) : 0)));
      const orden = [...p].sort((a, b) => b - a);
      lectura.set([
        ['σᵢ', VIZ.fmt(s, 3)],
        ['perplejidad 2^H(Pᵢ)', VIZ.fmt(2 ** H, 3)],
        ['masa en los 5 más cercanos', M.pct(M.suma(orden.slice(0, 5)))],
        ['σ mínimo · máximo del conjunto', `${VIZ.fmt(Math.min(...af.sigmas), 3)} · ${VIZ.fmt(Math.max(...af.sigmas), 3)}`],
      ]);
    }
    lienzo.alDibujar = () => af && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const cerca = (x, y) => { let m = -1, dm = 12; pts.forEach((q, j) => { const d = Math.hypot(plano.sx(q.x) - x, plano.sy(q.y) - y); if (d < dm) { dm = d; m = j; } }); return m; };
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), j = plano ? cerca(x, y) : -1; if (j >= 0) { i0 = j; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), j = plano ? cerca(x, y) : -1;
      if (j < 0) return tip.ocultar();
      tip.mostrar(x, y, `p(${j} | ${i0}) = <b>${VIZ.fmt(af.P[i0][j], 3)}</b><br>σ<sub>${j}</sub> = <b>${VIZ.fmt(af.sigmas[j], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('t-sne', {
    intro: String.raw`
      <p><strong>t-SNE</strong> (<em>t-distributed Stochastic Neighbor Embedding</em>) es un método no lineal para visualizar datos
      de dimensión alta en dos dimensiones. En vez de preservar distancias, preserva <strong>quién es vecino de quién</strong>:
      convierte las distancias en probabilidades de ser vecinos y busca una disposición en el plano con probabilidades parecidas.</p>
      <p>Es excelente para revelar grupos, pero hay que leerlo con cuidado: el tamaño de los grupos y las distancias entre
      ellos en el dibujo no significan mucho, y el resultado depende de la <strong>perplejidad</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 't-SNE en movimiento',
        descripcion: 'El descenso de gradiente que acomoda los puntos en 2-D. Pruebe perplejidad 3 y 50 sobre los seis cúmulos: con valores chicos aparecen subgrupos falsos; con grandes se ve mejor la estructura de familias.',
        montar: montarOptimizacion,
      },
      {
        titulo: 'Perplejidad y σ',
        descripcion: 'La distribución de vecinos de un punto en el espacio original. Haga clic en puntos de zonas densas y dispersas y compare σᵢ.',
        montar: montarPerplejidad,
      },
    ],
    teoria: String.raw`
      <h2>Similitudes en el espacio original</h2>
      <p>Para cada punto \(x_i\) se define una distribución sobre los demás con un núcleo gaussiano de ancho propio \(\sigma_i\):</p>
      \[ p_{j \mid i} = \frac{\exp(-\lVert x_i - x_j\rVert^2 / 2\sigma_i^2)}{\sum_{k \ne i} \exp(-\lVert x_i - x_k\rVert^2 / 2\sigma_i^2)}, \qquad
         p_{ij} = \frac{p_{j \mid i} + p_{i \mid j}}{2n}. \]
      <p>\(\sigma_i\) se elige por bisección para que la <strong>perplejidad</strong> \(2^{H(P_i)}\), con
      \(H(P_i) = -\sum_j p_{j \mid i} \log_2 p_{j \mid i}\), sea igual a un valor fijado por el usuario (típicamente 5–50). La
      perplejidad es un «número efectivo de vecinos»: así cada punto mira un vecindario de tamaño parecido, sea su zona densa o no.</p>
      <h2>Similitudes en el plano</h2>
      <p>En el plano se usa una t de Student con un grado de libertad (cola pesada):</p>
      \[ q_{ij} = \frac{(1 + \lVert y_i - y_j\rVert^2)^{-1}}{\sum_{k \ne l} (1 + \lVert y_k - y_l\rVert^2)^{-1}}. \]
      <p>La cola pesada resuelve el <em>problema de hacinamiento</em>: en 2-D no hay espacio para que muchos puntos queden a
      distancia media de uno; con la t, los puntos moderadamente lejanos pueden alejarse bastante en el dibujo sin costo.</p>
      <h2>Optimización</h2>
      <p>Se minimiza la divergencia de Kullback–Leibler \(\mathrm{KL}(P \Vert Q) = \sum_{i \ne j} p_{ij} \log (p_{ij}/q_{ij})\) por descenso de gradiente:</p>
      \[ \frac{\partial\, \mathrm{KL}}{\partial y_i} = 4 \sum_{j} (p_{ij} - q_{ij})\,(y_i - y_j)\,(1 + \lVert y_i - y_j\rVert^2)^{-1}. \]
      <pre><code>Y ← puntos al azar cerca de 0
para t ← 1 hasta T:
    α ← 12 si t ≤ 100, si no 1        (exageración temprana)
    g ← gradiente con α·P en lugar de P
    v ← momento·v − η·g ;  Y ← Y + v</code></pre>
      <p>La versión exacta cuesta \(O(n^2)\) por iteración; Barnes–Hut la baja a \(O(n \log n)\).</p>
      <h2>Cómo leerlo</h2>
      <ul>
        <li>KL penaliza mucho poner lejos a vecinos (\(p\) alto, \(q\) bajo) y poco poner cerca a no vecinos: t-SNE preserva
        <strong>estructura local</strong>, no global.</li>
        <li>Los tamaños de los grupos no reflejan su dispersión real, y la distancia entre grupos no es confiable.</li>
        <li>Es estocástico y no da una función para proyectar puntos nuevos. Compárelo con <a href="tema.html?id=umap">UMAP</a>
        y <a href="tema.html?id=dimensionality-reduction-comparison">otros métodos</a>.</li>
      </ul>`,
  });
})();