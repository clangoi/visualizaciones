(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const TODAS = [0, 1, 2, 3, 4, 5];
  const CONV = ['w1', 'b1', 'w2', 'b2'];
  const DOMINIOS = {
    ruido: { nombre: 'ruido muy alto (σ = 0,6)', ruido: 0.6, op: {} },
    inv: { nombre: 'contraste invertido', ruido: 0.15, op: { inv: true } },
    desp: { nombre: 'desplazamientos de ±2 píxeles', ruido: 0.15, op: { desp: 2 } },
  };

  // Red preentrenada en el dominio de origen (las seis figuras limpias); se calcula una sola vez.
  let PRE = null;
  function preentrenada() {
    if (PRE) return PRE;
    PRE = DL.cnnPequena(1);
    const r = VIZ.semilla(3);
    for (let e = 0; e < 50; e++) for (let b = 0; b < 10; b++) PRE.paso(Array.from({ length: 12 }, (_, k) => { const c = (b * 12 + k) % 6; return { img: DL.muestraImagen(c, r), c }; }), 0.03);
    return PRE;
  }

  /* ---------- Fig. 1: tres maneras de aprovechar una red preentrenada ---------- */

  function montarEstrategias(cuerpo) {
    let dom = 'inv', n = 5, semilla = 1, modelos = null, hist = [], base = 0, pl = null, ep = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Dominio nuevo', opciones: Object.entries(DOMINIOS).map(([k, v]) => [k, v.nombre]), valor: dom, alCambiar: (v) => { dom = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ejemplos por clase en el dominio nuevo', min: 1, max: 10, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    ctl.boton('Otros datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['desde cero (pesos al azar)', C.s2], ['extracción de características (convoluciones congeladas)', C.s1], ['ajuste fino (todo se entrena, tasa baja)', C.s6]];
    VIZ.leyenda(cuerpo, [...SER.map(([t, c]) => ({ color: c, texto: t, forma: 'linea' })), { color: C.apagado, texto: 'red preentrenada sin adaptar', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La red se preentrenó con las seis figuras limpias (364 parámetros). En el dominio nuevo hay muy pocos ejemplos etiquetados. La exactitud se mide con ejemplos nuevos del dominio nuevo; empezar desde lo ya aprendido llega más arriba y más rápido.');
    function iniciar() {
      const D = DOMINIOS[dom], pre = preentrenada(), r = VIZ.semilla(semilla * 13 + n);
      base = pre.evaluar(TODAS, 20, 99, D.ruido, D.op).acc;
      const crear = (modo) => { const m = DL.cnnPequena(5 + semilla); if (modo) m.copiar(pre); return m; };
      modelos = [crear(false), crear(true), crear(true)];
      const datos = []; for (const c of TODAS) for (let q = 0; q < n; q++) datos.push({ img: DL.muestraImagen(c, r, D.ruido, D.op), c });
      hist = [modelos.map((m) => m.evaluar(TODAS, 20, 99, D.ruido, D.op).acc)]; ep = 0;
      const cfg = [[0.03, []], [0.03, CONV], [0.01, []]];
      return (function* () {
        while (ep < 40) {
          const L = DL.mezclar(datos, r);
          modelos.forEach((m, i) => { for (let k = 0; k < L.length; k += 6) m.paso(L.slice(k, k + 6), cfg[i][0], 0.9, cfg[i][1]); });
          ep++; hist.push(modelos.map((m) => m.evaluar(TODAS, 20, 99, D.ruido, D.op).acc));
          yield;
        }
      })();
    }
    function dibujar() {
      if (!hist.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 40, ymin: 0, ymax: 1 }, { etiquetaX: 'época en el dominio nuevo', etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, base], [40, base]], C.apagado, 1.8, [4, 4]);
      SER.forEach(([, c], i) => VIZ.trazar(ctx, pl, hist.map((h, e) => [e, h[i]]), c, 2.5));
      const u = hist[hist.length - 1];
      registro.textContent = ep ? `Época ${ep}: desde cero ${VIZ.fmt(100 * u[0], 3)} %, extracción ${VIZ.fmt(100 * u[1], 3)} %, ajuste fino ${VIZ.fmt(100 * u[2], 3)} % (sin adaptar: ${VIZ.fmt(100 * base, 3)} %).` : `Sin adaptar, la red preentrenada acierta ${VIZ.fmt(100 * base, 3)} % en este dominio. Pulse Reproducir.`;
      lectura.set([['época', String(ep)], ['desde cero', `${VIZ.fmt(100 * u[0], 3)} %`], ['extracción de características', `${VIZ.fmt(100 * u[1], 3)} %`], ['ajuste fino', `${VIZ.fmt(100 * u[2], 3)} %`], ['ejemplos de entrenamiento', String(6 * n)], ['parámetros que se entrenan', '222 (extracción) · 364 (las otras)']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !hist.length) return tip.ocultar();
      const e = Math.max(0, Math.min(hist.length - 1, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `época <b>${e}</b>` + SER.map(([t, c], i) => VIZ.filaTooltip(c, t.split(' (')[0], `${VIZ.fmt(100 * hist[e][i], 3)} %`)).join('') + VIZ.filaTooltip(C.apagado, 'sin adaptar', `${VIZ.fmt(100 * base, 3)} %`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: congelar y descongelar capas ---------- */

  function montarCongelar(cuerpo) {
    let dom = 'inv', n = 4, c1 = true, c2 = false, lr = 0.01, semilla = 1, corridas = [], actual = null, geo = null, pl = null;
    const COL = [C.s1, C.s2, C.s3, C.s7, C.s4];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Dominio nuevo', opciones: Object.entries(DOMINIOS).map(([k, v]) => [k, v.nombre]), valor: dom, alCambiar: (v) => { dom = v; corridas = []; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Congelar capa convolucional 1', valor: c1, alCambiar: (v) => { c1 = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Congelar capa convolucional 2', valor: c2, alCambiar: (v) => { c2 = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Tasa de aprendizaje', opciones: [['0.003', '0,003'], ['0.01', '0,01'], ['0.03', '0,03']], valor: String(lr), alCambiar: (v) => { lr = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7, alTerminar: () => {} });
    ctl.boton('Borrar corridas anteriores', () => { corridas = []; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada corrida parte de la misma red preentrenada. Cambie qué capas están congeladas y reproduzca de nuevo: las corridas anteriores se conservan como líneas finas para compararlas. La capa densa final siempre se reentrena.');
    const nombre = () => `${c1 ? '❄ conv1' : 'conv1'} · ${c2 ? '❄ conv2' : 'conv2'} · densa · η = ${lr}`;
    function iniciar() {
      const D = DOMINIOS[dom], pre = preentrenada(), r = VIZ.semilla(semilla * 7 + 1);
      const m = DL.cnnPequena(5); m.copiar(pre);
      const datos = []; for (const c of TODAS) for (let q = 0; q < n; q++) datos.push({ img: DL.muestraImagen(c, r, D.ruido, D.op), c });
      const fijos = [...(c1 ? ['w1', 'b1'] : []), ...(c2 ? ['w2', 'b2'] : [])];
      const entren = (c1 ? 0 : 9 * 3 + 3) + (c2 ? 0 : 3 * 4 * 9 + 4) + 6 * 36 + 6;
      actual = { nombre: nombre(), fijos, datos, h: [m.evaluar(TODAS, 20, 99, D.ruido, D.op).acc], entren, color: COL[corridas.length % COL.length] };
      corridas = corridas.filter((q) => q !== actual).slice(-3); corridas.push(actual);
      return (function* () {
        for (let e = 0; e < 40; e++) {
          const L = DL.mezclar(datos, r);
          for (let k = 0; k < L.length; k += 6) m.paso(L.slice(k, k + 6), lr, 0.9, fijos);
          actual.h.push(m.evaluar(TODAS, 20, 99, D.ruido, D.op).acc);
          yield;
        }
      })();
    }
    function dibujar() {
      if (!actual) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 40, ymin: 0, ymax: 1 }, { etiquetaX: 'época', etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      corridas.forEach((q) => VIZ.trazar(ctx, pl, q.h.map((v, e) => [e, v]), q.color, q === actual ? 3 : 1.4));
      leyenda.set(corridas.map((q) => ({ color: q.color, texto: q.nombre, forma: 'linea' })));
      const u = actual.h[actual.h.length - 1];
      registro.textContent = `Época ${actual.h.length - 1}: exactitud ${VIZ.fmt(100 * u, 3)} %. Se entrenan ${actual.entren} de 364 parámetros.`;
      lectura.set([['exactitud actual', `${VIZ.fmt(100 * u, 3)} %`], ['mejor de la corrida', `${VIZ.fmt(100 * Math.max(...actual.h), 3)} %`], ['parámetros entrenables', `${actual.entren} de 364`], ['capas congeladas', `${(c1 ? 1 : 0) + (c2 ? 1 : 0)} de 2 convolucionales`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const e = Math.round(pl.ix(x));
      tip.mostrar(x, y, `época <b>${e}</b>` + corridas.filter((q) => q.h[e] != null).map((q) => VIZ.filaTooltip(q.color, q.nombre.split(' · η')[0], `${VIZ.fmt(100 * q.h[e], 3)} %`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('transfer-learning', {
    intro: String.raw`
      <p>Entrenar una red desde cero exige muchos datos etiquetados. Pero las primeras capas de una CNN aprenden características generales (bordes, texturas) que sirven para muchas tareas. El <strong>aprendizaje por transferencia</strong> (<em>transfer learning</em>) reutiliza una red ya entrenada en una tarea grande y la adapta a otra con pocos datos.</p>
      <p>Hay dos estrategias principales. <strong>Extracción de características</strong>: se congelan las capas convolucionales y solo se entrena una cabeza nueva. <strong>Ajuste fino</strong> (<em>fine-tuning</em>): se entrena toda la red, o parte de ella, con una tasa de aprendizaje baja, para no destruir lo aprendido. Cuando el dominio nuevo difiere del de origen (<em>cambio de dominio</em>), hay que adaptar también las capas convolucionales, y se ajusta más de la red.</p>`,
    visualizaciones: [
      { titulo: 'Desde cero, extracción o ajuste fino', descripcion: 'Con pocos ejemplos, compare las tres estrategias en un dominio con ruido, con contraste invertido o con desplazamientos. Mire la línea punteada: la red sin adaptar puede fallar por completo. Pruebe con 1 y con 10 ejemplos por clase.', montar: montarEstrategias },
      { titulo: 'Congelar y descongelar capas', descripcion: 'Elija qué capas se entrenan y con qué tasa; compare corridas superpuestas.', montar: montarCongelar },
    ],
    teoria: String.raw`
      <h2>Cuándo conviene cada estrategia</h2>
      <table>
        <tr><th></th><th>Datos nuevos pocos</th><th>Datos nuevos abundantes</th></tr>
        <tr><td><strong>Dominio parecido al de origen</strong></td><td>Extracción de características: se entrena solo la cabeza</td><td>Ajuste fino de las últimas capas, o de toda la red con tasa baja</td></tr>
        <tr><td><strong>Dominio distinto</strong></td><td>Ajuste fino de más capas, con cuidado (riesgo de sobreajuste)</td><td>Ajuste fino completo, o entrenar desde cero</td></tr>
      </table>
      <h2>Receta práctica</h2>
      <pre><code>modelo ← red preentrenada sin su cabeza
congelar todas las capas de modelo
agregar una cabeza nueva (capas densas con el número de clases nuevo)
entrenar la cabeza                         // extracción de características
descongelar las últimas k capas del modelo // ajuste fino
entrenar con una tasa de aprendizaje 10–100 veces menor</code></pre>
      <p>Las capas más cercanas a la entrada son más generales (bordes) y las más profundas, más específicas de la tarea original; por eso se descongelan de atrás hacia adelante y con tasas más bajas en las primeras capas (<em>tasas discriminativas</em>).</p>
      <h2>Por qué funciona</h2>
      <p>Si la tarea nueva se parece a la de origen, una buena representación \(\phi_{\theta_0}(x)\) ya hace casi lineal el problema; entrenar solo la cabeza \(h_w\) es un problema pequeño y bien condicionado:</p>
      \[ \min_{w}\; \frac1n\sum_{i=1}^n \ell\big(h_w(\phi_{\theta_0}(x_i)),\,y_i\big). \]
      <p>El ajuste fino además mueve \(\theta\) a partir de \(\theta_0\) (un punto de partida mucho mejor que uno aleatorio), y con una tasa baja los pasos son pequeños.</p>
      <div class="recuadro"><p><strong>Adaptación de dominio</strong> es el caso en que las clases son las mismas pero cambia la distribución de las entradas (otra cámara, otro contraste, otro ruido). Si el ajuste fino es demasiado agresivo, la red puede olvidar lo que sabía: <a href="tema.html?id=catastrophic-forgetting">olvido catastrófico</a>. Los modelos preentrenados más usados vienen de familias como <a href="tema.html?id=cnn-architectures">ResNet</a>; en Keras se cargan en una línea (<a href="tema.html?id=keras-models">Keras Models</a>).</p></div>`,
  });
})();
