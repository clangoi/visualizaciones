(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  // nivel: 0 = IA clásica, 1 = aprendizaje automático, 2 = aprendizaje profundo; (x, y) en el cuadro unitario.
  const TECNICAS = [
    { n: 'Reglas expertas', nivel: 0, y: 0.095, aprende: 'no', carac: 'a mano', txt: 'Un experto escribe «si … entonces …». No hay datos de entrenamiento: todo el conocimiento viene del programador.' },
    { n: 'Búsqueda A*', nivel: 0, y: 0.15, aprende: 'no', carac: 'a mano', txt: 'Explora estados con una heurística escrita a mano. Resuelve problemas sin aprender nada de ejemplos.' },
    { n: 'Regresión lineal', nivel: 1, y: 0.31, aprende: 'sí', carac: 'a mano', txt: 'Ajusta pesos a partir de ejemplos, pero las características (qué columnas usar) las elige una persona.' },
    { n: 'k-NN', nivel: 1, y: 0.415, aprende: 'sí', carac: 'a mano', txt: 'Guarda los ejemplos y compara distancias. Aprende de los datos, pero la distancia depende de las características elegidas.' },
    { n: 'Árbol de decisión', nivel: 1, y: 0.365, aprende: 'sí', carac: 'a mano', txt: 'Aprende umbrales sobre características dadas. Es interpretable, pero no inventa características nuevas.' },
    { n: 'SVM', nivel: 1, y: 0.465, aprende: 'sí', carac: 'a mano', txt: 'Aprende un margen máximo; con un kernel proyecta a otro espacio, aunque el kernel lo escoge una persona.' },
    { n: 'MLP', nivel: 2, y: 0.64, aprende: 'sí', carac: 'aprendidas', txt: 'Varias capas de neuronas: las capas ocultas construyen características a partir de las entradas.' },
    { n: 'CNN', nivel: 2, y: 0.77, aprende: 'sí', carac: 'aprendidas', txt: 'Aprende filtros que detectan bordes, texturas y formas directamente de los píxeles.' },
    { n: 'Transformer', nivel: 2, y: 0.9, aprende: 'sí', carac: 'aprendidas', txt: 'Aprende representaciones de secuencias con atención; es la base de los modelos de lenguaje actuales.' },
  ];
  const COLOR_NIVEL = [C.s3, C.s1, C.s2];
  const NOMBRE_NIVEL = ['inteligencia artificial', 'aprendizaje automático', 'aprendizaje profundo'];

  function montarConjuntos(cuerpo) {
    let sel = 8, geo = [];
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 480, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, NOMBRE_NIVEL.map((t, i) => ({ color: COLOR_NIVEL[i], texto: t, forma: 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una técnica para ver en qué conjunto vive y qué parte del trabajo aprende por sí sola.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      // Tres conjuntos anidados que comparten la base.
      const cx = W / 2, base = H - 6;
      const radios = [[W * 0.48, H * 0.49], [W * 0.38, H * 0.4], [W * 0.28, H * 0.25]];
      radios.forEach(([rx, ry], i) => {
        const cy = base - ry;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = VIZ.alfa(COLOR_NIVEL[i], 0.1); ctx.fill();
        ctx.strokeStyle = COLOR_NIVEL[i]; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(NOMBRE_NIVEL[i].toUpperCase(), cx, cy - ry + 6);
      });
      geo = TECNICAS.map((t, i) => ({ px: cx, py: H * t.y, t, i }));
      for (const { px, py, t, i } of geo) {
        ctx.font = VIZ.fuente(12, i === sel ? 600 : 400);
        const w = ctx.measureText(t.n).width + 14;
        ctx.beginPath(); ctx.roundRect(px - w / 2, py - 11, w, 22, 11);
        ctx.fillStyle = i === sel ? COLOR_NIVEL[t.nivel] : C.superficie; ctx.fill();
        ctx.lineWidth = i === sel ? 2 : 1.5; ctx.strokeStyle = COLOR_NIVEL[t.nivel]; ctx.stroke();
        ctx.fillStyle = i === sel ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.n, px, py);
      }
      const t = TECNICAS[sel];
      registro.textContent = `${t.n}: ${t.txt}`;
      lectura.set([['pertenece a', NOMBRE_NIVEL[t.nivel]], ['aprende de datos', t.aprende], ['características', t.carac], ['niveles que lo contienen', String(3 - t.nivel)]]);
    }
    function bajo(ev) {
      const { x, y } = lienzo.posicion(ev);
      return geo.find(({ px, py, t }) => Math.abs(x - px) < t.n.length * 3.6 + 8 && Math.abs(y - py) < 12);
    }
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const g = bajo(ev); if (g) { sel = g.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const g = bajo(ev), { x, y } = lienzo.posicion(ev);
      if (g) tip.mostrar(x, y, `<b>${g.t.n}</b><br>${NOMBRE_NIVEL[g.t.nivel]}<br>características ${g.t.carac}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: la regla de una persona frente a la regla aprendida ---------- */

  function montarReglas(cuerpo) {
    let tipo = 'lunas', ang = 20, desp = 0, semilla = 1, pts = [], red = null, opt = null, ep = 0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([k]) => ['manchas', 'lunas', 'circulos', 'xor'].includes(k)), valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Regla manual: ángulo', min: 0, max: 180, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Regla manual: desplazamiento', min: -0.8, max: 0.8, paso: 0.05, valor: desp, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { desp = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2), { color: C.tinta, texto: 'frontera de la red (aprendida)', forma: 'linea' }, { color: C.s8, texto: 'regla escrita a mano', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gire y desplace la recta roja para escribir su propia regla; luego pulse Reproducir y deje que una red de 8 neuronas ocultas aprenda la suya con los mismos datos.');
    const regla = (x, y) => { const a = (ang * Math.PI) / 180; return x * Math.sin(a) + y * Math.cos(a) - desp > 0 ? 1 : 0; };
    function iniciar() {
      pts = ML.datos(tipo, 160, 0.3, semilla * 7);
      red = DL.red([2, 8, 1], { act: 'tanh', semilla: semilla + 2 });
      opt = DL.optimizador('adam', { lr: 0.05 });
      ep = 0;
      const rnd = VIZ.semilla(semilla);
      return (function* () {
        while (ep < 400) {
          const lotes = DL.mezclar(DL.pares(pts), rnd);
          for (let i = 0; i < lotes.length; i += 16) DL.entrenarPaso(red, lotes.slice(i, i + 16), opt);
          ep++;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = ML.plano(lienzo);
      pl.ejes();
      ctx.save(); pl.recortar();
      if (ep > 0) {
        ML.regiones(ctx, pl, (x, y) => DL.predecir(red, [x, y])[0], { paso: 7 });
        ML.contorno(ctx, pl, (x, y) => DL.predecir(red, [x, y])[0], 0.5, { color: C.tinta, ancho: 2 });
      }
      ML.contorno(ctx, pl, (x, y) => (regla(x, y) ? 1 : -1), 0, { color: C.s8, ancho: 2.5, guiones: [6, 4] });
      ctx.restore();
      ML.puntos(ctx, pl, pts);
      const aR = Math.max(ML.exactitud(pts, regla), 0);
      const aN = ep ? ML.exactitud(pts, (x, y) => (DL.predecir(red, [x, y])[0] > 0.5 ? 1 : 0)) : NaN;
      registro.textContent = ep ? `Tras ${ep} épocas la red acierta el ${VIZ.fmt(100 * aN, 3)} % de los datos; su regla manual, el ${VIZ.fmt(100 * aR, 3)} %.` : 'La red aún no entrenó: ajuste su regla manual y compare después.';
      lectura.set([['regla manual', `${VIZ.fmt(100 * aR, 3)} %`], ['red entrenada', ep ? `${VIZ.fmt(100 * aN, 3)} %` : '—'], ['época', String(ep)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = pl ? ML.cercano(pl, pts, x, y) : -1;
      if (k < 0) return tip.ocultar();
      const q = pts[k];
      tip.mostrar(x, y, `(${VIZ.fmt(q.x, 2)}, ${VIZ.fmt(q.y, 2)})<br>clase real <b>${q.c}</b><br>regla manual <b>${regla(q.x, q.y)}</b>${ep ? `<br>red <b>${DL.predecir(red, [q.x, q.y])[0] > 0.5 ? 1 : 0}</b>` : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('ai-ml-dl', {
    intro: String.raw`
      <p>Los tres términos no son sinónimos: son <strong>conjuntos anidados</strong>. La <em>inteligencia artificial</em> es todo programa que se comporta de forma inteligente, aunque sus reglas
      las haya escrito una persona. El <em>aprendizaje automático</em> es la parte de la IA que ajusta sus parámetros a partir de ejemplos. Y el <em>aprendizaje profundo</em> es la parte del aprendizaje
      automático que usa redes neuronales de muchas capas para <strong>aprender también las características</strong> que antes se diseñaban a mano.</p>
      <p>La diferencia práctica es quién hace el trabajo difícil: en la IA clásica, la persona escribe las reglas; en el aprendizaje automático clásico, la persona elige las características y el algoritmo aprende
      los pesos; en el aprendizaje profundo, el algoritmo aprende ambas cosas.</p>`,
    visualizaciones: [
      { titulo: 'Tres conjuntos anidados', descripcion: 'Explore dónde cae cada técnica y qué parte del trabajo —reglas, características, pesos— queda en manos de una persona o del algoritmo.', montar: montarConjuntos },
      { titulo: 'Reglas escritas a mano frente a reglas aprendidas', descripcion: 'Intente separar las clases con una sola recta y compárela con una red entrenada. Pruebe «Círculos concéntricos» y «XOR», donde ninguna recta basta.', montar: montarReglas },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Un programa clásico recibe <em>datos</em> y <em>reglas</em> y produce respuestas. Un sistema de aprendizaje recibe <em>datos</em> y <em>respuestas</em> y produce las reglas:</p>
      \[ \text{programación clásica: } (\text{reglas}, \text{datos}) \to \text{respuestas} \qquad \text{aprendizaje: } (\text{datos}, \text{respuestas}) \to \text{reglas}. \]
      <p>Formalmente, el aprendizaje elige, dentro de una familia de funciones \(\{f_\theta\}\), los parámetros que minimizan una pérdida sobre los ejemplos:</p>
      \[ \hat\theta = \arg\min_\theta \; \frac{1}{n}\sum_{i=1}^{n} \ell\big(f_\theta(x_i),\, y_i\big). \]
      <h2>Qué añade la profundidad</h2>
      <p>En el aprendizaje automático clásico, \(f_\theta(x) = g_\theta(\phi(x))\) con una transformación \(\phi\) fija (bordes, histogramas, estadísticas) diseñada por una persona. En una red profunda,
      \(\phi\) también se aprende: es la composición de capas</p>
      \[ f_\theta(x) = f^{(L)}\!\big(\cdots f^{(2)}\big(f^{(1)}(x)\big)\cdots\big), \]
      <p>donde cada capa construye características más abstractas que la anterior. Es la idea de <em>aprendizaje de representaciones</em>.</p>
      <div class="recuadro"><p>Más profundo no siempre es mejor: con pocos datos tabulares y buenas características, un <a href="tema.html?id=decision-trees">árbol de decisión</a> o una
      <a href="tema.html?id=logistic-regression">regresión logística</a> suele ganar. El aprendizaje profundo destaca cuando hay muchos datos y las características son difíciles de escribir (imágenes, audio, texto).</p></div>
      <h2>Conexiones</h2>
      <p>Siga con <a href="tema.html?id=machine-learning">Machine Learning</a> para el flujo de trabajo, con <a href="tema.html?id=neural-networks">Neural Networks</a> para la neurona y con
      <a href="tema.html?id=deep-learning">Deep Learning</a> para la profundidad.</p>`,
  });
})();
