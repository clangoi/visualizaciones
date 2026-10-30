(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const OBJETIVOS = {
    seno: ['Seno', (x) => Math.sin(2.5 * x)],
    valor: ['Valor absoluto', (x) => Math.abs(x) * 1.6 - 0.8],
    escalon: ['Escalón', (x) => (x > 0.1 ? 0.8 : -0.8)],
    parabola: ['Parábola', (x) => 2 * x * x - 0.9],
    onda: ['Onda doble', (x) => Math.sin(5 * x) * 0.7],
  };
  const XS = Array.from({ length: 161 }, (_, i) => -1.6 + i * 0.02);

  /* ---------- Fig. 1: una red de una capa oculta aproxima una curva ---------- */

  function montarAproximacion(cuerpo) {
    let objetivo = 'seno', h = 6, act = 'relu', semilla = 1, red = null, opt = null, ep = 0, datos = [], pl = null, perdida = NaN, piezas = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función objetivo', opciones: Object.entries(OBJETIVOS).map(([k, v]) => [k, v[0]]), valor: objetivo, alCambiar: (v) => { objetivo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Neuronas ocultas', min: 1, max: 20, valor: h, alCambiar: (v) => { h = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Activación', opciones: ['relu', 'tanh', 'sigmoide', 'lineal'].map((k) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Mostrar el aporte de cada neurona', valor: piezas, alCambiar: (v) => { piezas = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 8 });
    ctl.boton('Otra inicialización', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'función objetivo', forma: 'linea' }, { color: C.tinta, texto: 'salida de la red', forma: 'linea' }, { color: C.s3, texto: 'aporte de cada neurona oculta', forma: 'linea' }, { color: C.s1, texto: 'ejemplos de entrenamiento', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con ReLU, la red es una suma de «codos»: cada neurona aporta una pieza que se dobla en un punto. Con «Lineal» las piezas nunca se doblan y la salida es una recta, sin importar cuántas neuronas haya.');
    function iniciar() {
      const f = OBJETIVOS[objetivo][1], r = VIZ.semilla(semilla * 3 + 1);
      datos = Array.from({ length: 50 }, (_, i) => { const x = -1.5 + (3 * i) / 49; return { x: [x], y: [f(x) + 0.03 * VIZ.normal(r)] }; });
      red = DL.red([1, h, 1], { act, salida: 'lineal', init: 'xavier', semilla: semilla * 11 + h });
      for (const fila of red.W[0]) fila[0] *= 2.2;
      red.b[0] = red.b[0].map((_, j) => -1.4 + (2.8 * (j + 0.5)) / h);
      opt = DL.optimizador('adam', { lr: 0.03 }); ep = 0;
      return (function* () { while (ep < 3000) { for (let k = 0; k < 10; k++) { perdida = DL.entrenarPaso(red, datos, opt); ep++; } yield; } })();
    }
    const aporte = (j, x) => red.W[1][0][j] * DL.ACT[act].f(red.W[0][j][0] * x + red.b[0][j]);
    function dibujar() {
      if (!red) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -1.6, xmax: 1.6, ymin: -1.6, ymax: 1.6 }, { etiquetaX: 'x', etiquetaY: 'y' });
      pl.ejes();
      ctx.save(); pl.recortar();
      if (piezas) for (let j = 0; j < h; j++) VIZ.trazar(ctx, pl, XS.map((x) => [x, aporte(j, x) + red.b[1][0] / h]), VIZ.alfa(C.s3, 0.7), 1.2);
      VIZ.trazar(ctx, pl, XS.map((x) => [x, OBJETIVOS[objetivo][1](x)]), C.apagado, 2, [5, 4]);
      VIZ.trazar(ctx, pl, XS.map((x) => [x, DL.predecir(red, [x])[0]]), C.tinta, 2.5);
      ctx.restore();
      datos.forEach((d) => VIZ.marcador(ctx, pl.sx(d.x[0]), pl.sy(d.y[0]), C.s1, 2.5));
      registro.textContent = ep ? `Época ${ep}: error cuadrático medio ${VIZ.fmt(2 * perdida, 3)}.` : 'Red recién inicializada: sus «codos» están repartidos de forma pareja.';
      lectura.set([['neuronas ocultas', String(h)], ['parámetros', String(DL.nParametros([1, h, 1]))], ['época', String(ep)], ['error cuadrático medio', ep ? VIZ.fmt(2 * perdida, 3) : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !red) return tip.ocultar();
      const X = pl.ix(x);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(X, 2)}</b>` + VIZ.filaTooltip(C.apagado, 'objetivo', VIZ.fmt(OBJETIVOS[objetivo][1](X), 3)) + VIZ.filaTooltip(C.tinta, 'red', VIZ.fmt(DL.predecir(red, [X])[0], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: fronteras no lineales en el plano ---------- */

  function montarFronteras(cuerpo) {
    DL.entrenador(cuerpo, {
      controles: ['datos', 'capas', 'ocultas', 'act'],
      inicial: { datos: 'xor', ocultas: 6, capas: 1, act: 'tanh', ruido: 0.15, n: 160, lr: 0.05 },
      nota: 'Pruebe «XOR» o «Círculos concéntricos» con activación Lineal: ninguna cantidad de capas ni de neuronas cruza la barrera de la recta. Con Tanh o ReLU, bastan unas pocas neuronas.',
    });
  }

  VIZ.registrarTema('nonlinear-representation', {
    intro: String.raw`
      <p>Una neurona sola solo traza rectas. Pero al combinar varias neuronas con activaciones no lineales, una red puede dibujar curvas arbitrarias: cada neurona oculta aporta una pieza sencilla —un escalón suavizado, un codo— y la capa de salida las suma con pesos.</p>
      <p>Más neuronas permiten más piezas y, por tanto, una aproximación más fina. Sin activación no lineal, en cambio, todas las capas se colapsan en una sola transformación lineal y la red no puede resolver ni siquiera XOR.</p>`,
    visualizaciones: [
      { titulo: 'Una curva como suma de piezas', descripcion: 'Entrene la red y mire las curvas verdes finas: sumadas dan la salida negra. Pruebe «Onda doble» con 3 y con 15 neuronas, y compare ReLU con Tanh.', montar: montarAproximacion },
      { titulo: 'Fronteras no lineales en el plano', descripcion: 'Entrene una red sobre datos que ninguna recta puede separar y compare la activación lineal con las no lineales.', montar: montarFronteras },
    ],
    teoria: String.raw`
      <h2>Sin no linealidad no hay profundidad</h2>
      <p>Si todas las activaciones son lineales, la red de dos capas es</p>
      \[ W^{(2)}\big(W^{(1)}x + b^{(1)}\big) + b^{(2)} = \underbrace{W^{(2)}W^{(1)}}_{W'}\,x + \underbrace{W^{(2)}b^{(1)} + b^{(2)}}_{b'}, \]
      <p>que es una sola capa lineal. Ninguna profundidad la hace más expresiva.</p>
      <h2>Teorema de aproximación universal</h2>
      <div class="recuadro"><p>Sea \(f\) una función continua en un conjunto compacto \(K\subset\mathbb{R}^d\) y \(\sigma\) una activación continua no polinómica. Para todo \(\varepsilon>0\) existen \(h\), pesos \(v_j, b_j\in\mathbb{R}\) y \(w_j\in\mathbb{R}^d\) tales que
      \[ \sup_{x\in K}\Big| f(x) - \sum_{j=1}^{h} v_j\,\sigma(w_j^\top x + b_j)\Big| < \varepsilon. \]</p></div>
      <p>El teorema garantiza que existe una red con una capa oculta suficientemente ancha, pero no dice cuán ancha ni cómo encontrarla con descenso de gradiente.</p>
      <h2>Con ReLU: funciones lineales por tramos</h2>
      <p>Una red ReLU con una capa oculta de \(h\) neuronas, en una dimensión, es lineal por tramos con a lo más \(h+1\) tramos. Con más capas el número de tramos puede crecer de forma <em>exponencial</em> en la profundidad,
      que es la razón por la que, para una cantidad dada de neuronas, las redes profundas son más expresivas que las anchas (ver <a href="tema.html?id=deep-learning">Deep Learning</a>).</p>
      <p>La función de activación se analiza en <a href="tema.html?id=activation-functions">Activation Functions</a>.</p>`,
  });
})();
