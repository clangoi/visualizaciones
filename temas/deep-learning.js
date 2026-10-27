(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat, ML = VIZ.ml;

  /* ---------- Fig. 1: regiones lineales de una red ReLU ---------- */

  function montarRegiones(cuerpo) {
    let L = 3, ancho = 8, semilla = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capas ocultas', min: 1, max: 8, valor: L, alCambiar: (v) => { L = v; calcular(); } });
    ctl.rango({ etiqueta: 'Neuronas por capa', min: 2, max: 16, valor: ancho, alCambiar: (v) => { ancho = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 280, altoMax: 440 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'borde entre regiones lineales', forma: 'linea' },
      { color: VIZ.css(VIZ.enRampa(0.8)), texto: 'salida de la red (más oscuro = mayor)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Compare 1 capa de 16 neuronas con 2 capas de 8: mismas neuronas, pero la red profunda suele cortar el plano en más regiones, porque cada capa vuelve a plegar lo que dejó la anterior.');

    let cuenta = 0, parametros = 0;
    function calcular() {
      const capas = [2, ...new Array(L).fill(ancho), 1];
      const net = P.red(capas, 'relu', semilla);
      // Sesgos aleatorios para que los cortes no pasen todos por el origen.
      const rnd = VIZ.semilla(semilla * 13);
      net.b.forEach((b) => b.forEach((_, i) => { b[i] = VIZ.normal(rnd) * 0.5; }));
      parametros = net.W.reduce((s, Wl, l) => s + Wl.length * Wl[0].length + net.b[l].length, 0);
      const { ctx, ancho: Wc, alto: Hc } = lienzo;
      lienzo.limpiar();
      const paso = 4, nx = Math.ceil(Wc / paso), ny = Math.ceil(Hc / paso);
      const patron = new Array(nx * ny), salida = new Float64Array(nx * ny);
      const esc = 2.2;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = [((i + 0.5) / nx - 0.5) * 2 * esc * (Wc / Hc), ((j + 0.5) / ny - 0.5) * 2 * esc];
        const c = P.adelante(net, x);
        let clave = '';
        for (let l = 1; l <= L; l++) for (const z of c.z[l - 1]) clave += z > 0 ? '1' : '0';
        patron[j * nx + i] = clave;
        salida[j * nx + i] = c.z[L][0];
      }
      let lo = Infinity, hi = -Infinity;
      for (const v of salida) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const borde = (i + 1 < nx && patron[k] !== patron[k + 1]) || (j + 1 < ny && patron[k] !== patron[k + nx]);
        ctx.fillStyle = borde ? C.tinta : VIZ.css(VIZ.enRampa(((salida[k] - lo) / (hi - lo || 1)) * 0.75));
        ctx.fillRect(i * paso, j * paso, paso, paso);
      }
      cuenta = new Set(patron).size;
      lectura.set([
        ['neuronas ocultas', String(L * ancho)],
        ['parámetros', VIZ.entero(parametros)],
        ['regiones lineales visibles', VIZ.entero(cuenta)],
        ['regiones por neurona', VIZ.fmt(cuenta / (L * ancho), 3)],
      ]);
    }
    lienzo.alDibujar = calcular;
    calcular();
  }

  /* ---------- Fig. 2: sobreajuste y regularización ---------- */

  function montarSobreajuste(cuerpo) {
    let l2 = 0, temprana = false, semilla = 4, ruido = 0.55;
    let net = null, mejor = null, historia = [], epoca = 0, entr = [], val = [];
    const MAX = 800;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Decaimiento de pesos λ (L2)', min: 0, max: 0.02, paso: 0.001, valor: l2, formato: (v) => v.toFixed(3), alCambiar: (v) => { l2 = v; reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido de los datos', min: 0.1, max: 1, paso: 0.05, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; datosNuevos(); } });
    ctl.casilla({ etiqueta: 'parada temprana (mostrar los pesos de menor pérdida de validación)', valor: temprana, alCambiar: (v) => { temprana = v; dibujar(); } });
    const bEntrenar = ctl.boton('Entrenar', () => { if (bucle.activo) bucle.detener(); else { if (epoca >= MAX) reiniciar(); bEntrenar.textContent = 'Pausar'; bucle.iniciar(); } }, { primario: true });
    ctl.boton('100 épocas', () => { bucle.detener(); for (let i = 0; i < 100 && epoca < MAX; i++) paso(); dibujar(); });
    ctl.boton('Reiniciar', () => reiniciar());
    ctl.boton('Nuevos datos', () => { semilla++; datosNuevos(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? Math.round(w * 0.75) * 2 + 16 : Math.round(Math.min(380, w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...ML.leyendaClases(2),
      { color: C.inactivo, texto: 'hueco: dato de validación', forma: 'punto' },
      { color: C.s1, texto: 'pérdida de entrenamiento', forma: 'linea' },
      { color: C.s2, texto: 'pérdida de validación', forma: 'linea' },
      { color: C.s6, texto: 'mínimo de validación (parada temprana)', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una red de 2 capas de 32 neuronas (1 185 parámetros) con solo 50 datos de entrenamiento. Sin regularización, la pérdida de entrenamiento sigue bajando mientras la de validación sube: la frontera se retuerce alrededor de cada punto.');

    const bucle = VIZ.bucle(() => {
      for (let i = 0; i < 6 && epoca < MAX; i++) paso();
      dibujar();
      return epoca < MAX;
    }, () => { bEntrenar.textContent = 'Entrenar'; });
    function datosNuevos() {
      entr = ML.datos('lunas', 50, ruido, semilla);
      val = ML.datos('lunas', 200, ruido, semilla + 500);
      reiniciar();
    }
    function reiniciar() {
      bucle.detener();
      net = P.red([2, 32, 32, 1], 'relu', semilla);
      historia = []; epoca = 0; mejor = null;
      dibujar();
    }
    const X = (pts) => pts.map((p) => [p.x * 1.5, p.y * 1.5]);
    function paso() {
      const pe = P.entrenar(net, X(entr), entr.map((p) => p.c), { lr: 0.003, l2 });
      const pv = P.perdidaMedia(net, X(val), val.map((p) => p.c));
      epoca++;
      historia.push([epoca, pe, pv]);
      if (!mejor || pv < mejor.pv) mejor = { pv, epoca, W: JSON.parse(JSON.stringify(net.W)), b: JSON.parse(JSON.stringify(net.b)) };
    }
    let geo = null;
    function dibujar() {
      if (!net) return;
      const { ctx, ancho, alto } = lienzo;
      lienzo.limpiar();
      const apilar = ancho < 560, wp = apilar ? ancho : ancho / 2 - 8, hp = apilar ? (alto - 16) / 2 : alto;
      const usar = temprana && mejor ? { ...net, W: mejor.W, b: mejor.b } : net;
      const f = (x, y) => P.adelante(usar, [x * 1.5, y * 1.5]).a[3][0];
      const sub = { ancho: wp, alto: hp, ctx };
      const p1 = ML.plano(sub);
      ML.regiones(ctx, p1, f, { paso: 6 });
      p1.ejes();
      ML.puntos(ctx, p1, val, { hueco: () => true, r: 2.5 });
      ML.puntos(ctx, p1, entr);
      ctx.save();
      ctx.translate(apilar ? 0 : wp + 16, apilar ? hp + 16 : 0);
      const sub2 = { ancho: wp, alto: hp, ctx };
      const ymax = Math.max(0.8, ...historia.map((h) => Math.min(h[2], 3))) * 1.05;
      const p2 = VIZ.plano(sub2, { xmin: 0, xmax: Math.max(100, epoca), ymin: 0, ymax }, { etiquetaX: 'época', etiquetaY: 'entropía cruzada', margen: { izq: 44 } });
      p2.ejes();
      VIZ.trazar(ctx, p2, historia.map((h) => [h[0], h[1]]), C.s1, 2);
      VIZ.trazar(ctx, p2, historia.map((h) => [h[0], Math.min(h[2], ymax)]), C.s2, 2);
      if (mejor) VIZ.marcador(ctx, p2.sx(mejor.epoca), p2.sy(mejor.pv), C.s6, 5.5);
      ctx.restore();
      geo = { p1 };
      const exacto = (pts) => pts.filter((p) => (f(p.x, p.y) > 0.5 ? 1 : 0) === p.c).length / pts.length;
      const h = historia[historia.length - 1];
      lectura.set([
        ['época', `${epoca} de ${MAX}`],
        ['pérdida entrenamiento / validación', h ? `${h[1].toFixed(3)} / ${h[2].toFixed(3)}` : '—'],
        ['exactitud entrenamiento', `${(100 * exacto(entr)).toFixed(1)} %`],
        ['exactitud validación', `${(100 * exacto(val)).toFixed(1)} %`],
        ['mínimo de validación', mejor ? `época ${mejor.epoca}` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      if (!geo.p1.dentro(x, y)) return tip.ocultar();
      const usar = temprana && mejor ? { ...net, W: mejor.W, b: mejor.b } : net;
      const p = P.adelante(usar, [geo.p1.ix(x) * 1.5, geo.p1.iy(y) * 1.5]).a[3][0];
      tip.mostrar(x, y, VIZ.filaTooltip(ML.CLASES[1], 'P(clase 1 | x)', p.toFixed(3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    new IntersectionObserver((e) => { if (!e[0].isIntersecting) bucle.detener(); }).observe(lienzo.canvas);
    datosNuevos();
  }

  VIZ.registrarTema('deep-learning', {
    intro: String.raw`
      <p>El <strong>aprendizaje profundo</strong> usa <a href="tema.html?id=neural-networks">redes neuronales</a> de muchas capas que
      aprenden directamente de los datos crudos (píxeles, audio, texto) las características que antes se diseñaban a mano, como
      <a href="tema.html?id=lbp">LBP</a> o <a href="tema.html?id=sift">SIFT</a>. Cada capa transforma la representación de la anterior,
      de bordes a texturas, de texturas a partes, de partes a objetos.</p>
      <p>Funciona porque se juntaron tres cosas hacia 2012: muchos datos etiquetados, GPU para entrenar rápido, y técnicas que
      hicieron posible entrenar redes profundas sin que el gradiente se perdiera (ReLU, buena inicialización, normalización) ni que
      la red memorizara los datos (regularización).</p>`,
    visualizaciones: [
      {
        titulo: 'La profundidad multiplica las regiones',
        descripcion: 'Una red ReLU es lineal por partes: corta el plano en regiones y en cada una calcula una función lineal. Mueva profundidad y anchura y cuente las regiones.',
        montar: montarRegiones,
      },
      {
        titulo: 'Sobreajuste y regularización',
        descripcion: 'Una red grande entrenada con pocos datos ruidosos. A la izquierda, la frontera aprendida; a la derecha, las pérdidas de entrenamiento y de validación por época.',
        montar: montarSobreajuste,
      },
    ],
    teoria: String.raw`
      <h2>Por qué la profundidad</h2>
      <p>Una red con una sola capa oculta suficientemente ancha aproxima cualquier función continua (teorema de aproximación
      universal), pero puede necesitar un número exponencial de neuronas. Con ReLU, una capa de \(n\) neuronas sobre una entrada de
      dimensión \(d\) crea a lo sumo \(\sum_{i=0}^{d} \binom{n}{i}\) regiones lineales: polinomial en \(n\). Apilando \(L\) capas, el máximo
      crece como \((n/d)^{d(L-1)} n^d\) (Montúfar et al., 2014): cada capa puede «plegar» el espacio y reutilizar la misma función en
      todos los pliegues. La profundidad permite funciones con estructura repetida y jerárquica usando pocos parámetros.</p>
      <h2>Ingredientes que lo hicieron posible</h2>
      <table>
        <tr><th>Problema</th><th>Solución</th></tr>
        <tr><td>gradientes que se desvanecen</td><td>ReLU, inicialización de Xavier y He, conexiones residuales (<a href="tema.html?id=backpropagation">retropropagación</a>)</td></tr>
        <tr><td>entrenamiento lento o inestable</td><td>descenso estocástico con momento o <a href="tema.html?id=descenso-gradiente">Adam</a>, normalización por lotes</td></tr>
        <tr><td>demasiados parámetros para los datos</td><td>convoluciones que comparten pesos (<a href="tema.html?id=cnn">CNN</a>), regularización, aumento de datos</td></tr>
        <tr><td>pocos datos etiquetados</td><td>transferencia: partir de una red entrenada en otra tarea grande</td></tr>
      </table>
      <h2>Regularización</h2>
      <ul>
        <li><strong>Decaimiento de pesos (L2)</strong>: minimizar \(L(\theta) + \frac{\lambda}{2}\lVert\theta\rVert^2\). Cada paso encoge los pesos
        hacia cero; fronteras más suaves.</li>
        <li><strong>Parada temprana</strong>: guardar los pesos de la época con menor pérdida de validación. Limita cuánto se alejan
        los pesos de su inicialización, con un efecto parecido a L2.</li>
        <li><strong><em>Dropout</em></strong>: en cada paso de entrenamiento se apaga cada neurona con probabilidad \(p\); la red no puede
        depender de ninguna neurona en particular. Equivale a promediar muchas redes más chicas.</li>
        <li><strong>Aumento de datos</strong>: entrenar con versiones giradas, recortadas o con otro brillo de cada imagen.</li>
      </ul>
      <div class="recuadro"><p>Las redes profundas modernas tienen más parámetros que datos y aun así generalizan. La regularización
      explícita ayuda, pero buena parte del efecto viene del propio descenso de gradiente estocástico, que entre las muchas soluciones
      que interpolan los datos tiende a encontrar las más simples. Es un tema de investigación abierto.</p></div>`,
  });
})();
