(function () {
  'use strict';
  const { color: C } = VIZ;
  const CLASES = ['bosque', 'ciudad', 'playa'];
  const COL = [C.s1, C.s2, C.s3];

  // Patrones locales reales (desconocidos para el método) y cuánto aparece cada uno en cada clase de imagen.
  // Las tres clases tienen casi la misma media de descriptores: solo las distingue la proporción de cada patrón.
  const PATRONES = [[-0.75, 0], [0.75, 0], [0, 0.75], [0, -0.75], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [0, 0]];
  const PESOS = [
    [4, 4, 0.5, 0.5, 2, 2, 0.3, 0.3, 1],
    [0.5, 0.5, 4, 4, 0.3, 0.3, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 4],
  ];

  // Imágenes de una clase: cada una es una bolsa de descriptores 2D.
  function imagenes(porClase, nDesc, sigma, semilla) {
    const rnd = VIZ.semilla(semilla), res = [];
    for (let c = 0; c < 3; c++) for (let m = 0; m < porClase; m++) {
      // Variación propia de la imagen en las proporciones de patrones.
      const w = PESOS[c].map((p) => p * (0.4 + 1.2 * rnd()));
      const tot = w.reduce((a, b) => a + b, 0);
      const desc = [];
      for (let i = 0; i < nDesc; i++) {
        let r = rnd() * tot, k = 0;
        while (r > w[k] && k < w.length - 1) { r -= w[k]; k++; }
        desc.push([PATRONES[k][0] + VIZ.normal(rnd) * sigma, PATRONES[k][1] + VIZ.normal(rnd) * sigma]);
      }
      res.push({ c, desc });
    }
    return res;
  }

  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const cercano = (p, V) => { let m = 0, dm = Infinity; V.forEach((v, j) => { const d = d2(p, v); if (d < dm) { dm = d; m = j; } }); return m; };
  // k-means con inicialización k-means++.
  function vocabulario(pts, k, semilla) {
    const rnd = VIZ.semilla(semilla);
    const V = [pts[Math.floor(rnd() * pts.length)].slice()];
    const D = pts.map((p) => d2(p, V[0]));
    while (V.length < k) {
      const tot = D.reduce((a, b) => a + b, 0);
      let r = rnd() * tot, i = 0;
      while (i < pts.length - 1 && r > D[i]) { r -= D[i]; i++; }
      V.push(pts[i].slice());
      pts.forEach((p, j) => { D[j] = Math.min(D[j], d2(p, V[V.length - 1])); });
    }
    for (let it = 0; it < 25; it++) {
      const s = V.map(() => [0, 0, 0]);
      for (const p of pts) { const j = cercano(p, V); s[j][0] += p[0]; s[j][1] += p[1]; s[j][2]++; }
      let mov = 0;
      V.forEach((v, j) => { if (s[j][2]) { const n = [s[j][0] / s[j][2], s[j][1] / s[j][2]]; mov += d2(n, v); V[j] = n; } });
      if (mov < 1e-10) break;
    }
    return V;
  }
  const histograma = (img, V) => {
    const h = new Array(V.length).fill(0);
    for (const p of img.desc) h[cercano(p, V)]++;
    return h.map((v) => v / img.desc.length);
  };
  const chi2 = (a, b) => a.reduce((s, v, i) => s + (v + b[i] > 0 ? ((v - b[i]) ** 2) / (v + b[i]) : 0), 0);
  // Exactitud de 1-NN con χ² entre histogramas.
  function evaluar(entr, prueba, V) {
    const He = entr.map((im) => histograma(im, V));
    let ok = 0;
    for (const im of prueba) {
      const h = histograma(im, V);
      let m = 0, dm = Infinity;
      He.forEach((g, j) => { const d = chi2(h, g); if (d < dm) { dm = d; m = j; } });
      if (entr[m].c === im.c) ok++;
    }
    return ok / prueba.length;
  }

  /* ---------- Fig. 1: el vocabulario y el histograma de una imagen ---------- */

  function montarVocabulario(cuerpo) {
    let k = 9, sigma = 0.1, semilla = 3, sel = 0;
    let imgs = [], V = [], todos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Palabras k', min: 2, max: 24, valor: k, alCambiar: (v) => { k = v; aprender(); } });
    ctl.rango({ etiqueta: 'Dispersión de los descriptores', min: 0.03, max: 0.25, paso: 0.01, valor: sigma, formato: (v) => v.toFixed(2), alCambiar: (v) => { sigma = v; nuevos(); } });
    ctl.boton('Otra imagen', () => { sel = (sel + 7) % imgs.length; dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; nuevos(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...CLASES.map((t, c) => ({ color: COL[c], texto: `descriptor de una imagen de ${t}`, forma: c === 0 ? 'punto' : 'cuadro' })),
      { color: C.tinta, texto: 'palabra visual (centroide)' },
      { color: C.s4, texto: 'descriptores de la imagen elegida' },
    ]);
    VIZ.subtitulo(cuerpo, 'Histograma de palabras de la imagen elegida');
    const lienzoH = VIZ.lienzo(cuerpo, { proporcion: 0.2, altoMin: 140, altoMax: 200 });
    const tipH = VIZ.tooltip(lienzoH);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic sobre un descriptor para elegir la imagen a la que pertenece. Las líneas grises separan las celdas de Voronoi: todo descriptor que cae en una celda cuenta como esa palabra.');

    function nuevos() {
      imgs = imagenes(10, 40, sigma, semilla);
      todos = imgs.flatMap((im, i) => im.desc.map((p) => ({ p, i, c: im.c })));
      aprender();
    }
    function aprender() { V = vocabulario(todos.map((t) => t.p), k, semilla * 13 + k); dibujar(); }

    let plano = null;
    const DOM = { xmin: -1.25, xmax: 1.25, ymin: -1.15, ymax: 1.15 };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'descriptor, componente 1', etiquetaY: 'componente 2', margen: { izq: 40 } });
      plano.ejes();
      // Bordes de Voronoi entre palabras.
      const paso = 3, nx = Math.ceil((plano.x1 - plano.x0) / paso), ny = Math.ceil((plano.y0 - plano.y1) / paso);
      const et = [];
      for (let i = 0; i <= nx; i++) { et.push([]); for (let j = 0; j <= ny; j++) et[i].push(cercano([plano.ix(plano.x0 + i * paso), plano.iy(plano.y1 + j * paso)], V)); }
      ctx.fillStyle = C.eje;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        if (et[i][j] !== et[i + 1][j] || et[i][j] !== et[i][j + 1]) ctx.fillRect(plano.x0 + i * paso, plano.y1 + j * paso, 1.5, 1.5);
      }
      for (const t of todos) if (t.i !== sel) VIZ.marcador(ctx, plano.sx(t.p[0]), plano.sy(t.p[1]), VIZ.alfa(COL[t.c], 0.55), 3, t.c);
      for (const t of todos) if (t.i === sel) {
        ctx.save(); ctx.strokeStyle = C.s4; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(plano.sx(t.p[0]), plano.sy(t.p[1]), 6.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        VIZ.marcador(ctx, plano.sx(t.p[0]), plano.sy(t.p[1]), COL[t.c], 3.5, t.c);
      }
      ctx.save();
      ctx.font = VIZ.fuente(11, 500);
      V.forEach((v, j) => {
        const x = plano.sx(v[0]), y = plano.sy(v[1]);
        ctx.strokeStyle = C.superficie; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.fillStyle = C.tinta;
        ctx.fillText(String(j + 1), x + 7, y - 6);
      });
      ctx.restore();
      dibujarH();
    }
    lienzo.alDibujar = () => V.length && dibujar();

    let planoH = null, h = [];
    function dibujarH() {
      const { ctx } = lienzoH;
      lienzoH.limpiar();
      h = histograma(imgs[sel], V);
      planoH = VIZ.plano(lienzoH, { xmin: 0.5, xmax: k + 0.5, ymin: 0, ymax: Math.max(...h) * 1.15 || 1 }, { etiquetaX: 'palabra', margen: { izq: 40 },
        ticksX: Array.from({ length: k }, (_, j) => j + 1), formatoY: (v) => `${Math.round(v * 100)}%` });
      planoH.ejes();
      const bw = planoH.sx(1) - planoH.sx(0);
      h.forEach((v, j) => {
        if (!v) return;
        ctx.fillStyle = COL[imgs[sel].c];
        ctx.beginPath();
        ctx.roundRect(planoH.sx(j + 0.5) + 1, planoH.sy(v), bw - 2, planoH.y0 - planoH.sy(v), [4, 4, 0, 0]);
        ctx.fill();
      });
      const usadas = h.filter((v) => v > 0).length;
      lectura.set([
        ['imagen', `${sel + 1} (${CLASES[imgs[sel].c]})`],
        ['descriptores', String(imgs[sel].desc.length)],
        ['palabras usadas', `${usadas} de ${k}`],
        ['dimensión del vector', String(k)],
      ]);
    }
    lienzoH.alDibujar = () => imgs.length && dibujarH();
    lienzoH.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzoH.posicion(ev);
      if (!planoH || !planoH.dentro(x, y)) return tipH.ocultar();
      const j = Math.round(planoH.ix(x)) - 1;
      if (j < 0 || j >= k) return tipH.ocultar();
      tipH.mostrar(x, y, `palabra <b>${j + 1}</b><br>${Math.round(h[j] * imgs[sel].desc.length)} descriptores (<b>${(h[j] * 100).toFixed(1)} %</b>)`);
    });
    lienzoH.canvas.addEventListener('pointerleave', () => tipH.ocultar());

    const masCercano = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = null, dm = 10;
      for (const t of todos) { const d = Math.hypot(plano.sx(t.p[0]) - x, plano.sy(t.p[1]) - y); if (d < dm) { dm = d; m = t; } }
      return { m, x, y };
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { m } = masCercano(ev); if (m) { sel = m.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { m, x, y } = masCercano(ev);
      if (!m) return tip.ocultar();
      tip.mostrar(x, y, `imagen <b>${m.i + 1}</b> (${CLASES[m.c]})<br>palabra <b>${cercano(m.p, V) + 1}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevos();
  }

  /* ---------- Fig. 2: exactitud según el tamaño del vocabulario ---------- */

  function montarExactitud(cuerpo) {
    let sigma = 0.15, nDesc = 25, semilla = 5, kSel = 9;
    let curva = [], base = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dispersión de los descriptores', min: 0.03, max: 0.3, paso: 0.01, valor: sigma, formato: (v) => v.toFixed(2), alCambiar: (v) => { sigma = v; }, alSoltar: calcular });
    ctl.rango({ etiqueta: 'Descriptores por imagen', min: 5, max: 100, paso: 5, valor: nDesc, alCambiar: (v) => { nDesc = v; }, alSoltar: calcular });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'bolsa de palabras + 1-NN con χ²', forma: 'linea' },
      { color: C.apagado, texto: 'referencias punteadas: media de los descriptores + 1-NN, y azar (1/3)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto entrena un vocabulario con 30 imágenes y clasifica otras 30. Pase el cursor sobre la curva. Con pocos descriptores por imagen, los histogramas son ruidosos y un vocabulario grande deja de ayudar.');

    function calcular() {
      const entr = imagenes(10, nDesc, sigma, semilla), prueba = imagenes(10, nDesc, sigma, semilla + 1000);
      const pts = entr.flatMap((im) => im.desc);
      curva = [];
      for (let k = 1; k <= 30; k++) curva.push([k, evaluar(entr, prueba, vocabulario(pts, k, semilla * 7 + k))]);
      // Línea base: cada imagen resumida por la media de sus descriptores.
      const m = (im) => im.desc.reduce((s, p) => [s[0] + p[0] / im.desc.length, s[1] + p[1] / im.desc.length], [0, 0]);
      const Me = entr.map(m);
      base = prueba.filter((im) => entr[cercano(m(im), Me)].c === im.c).length / prueba.length;
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 30, ymin: 0, ymax: 1 }, { etiquetaX: 'palabras en el vocabulario k', etiquetaY: 'exactitud en prueba',
        formatoY: (v) => `${Math.round(v * 100)}%`, margen: { der: 70 } });
      plano.ejes();
      for (const [v, t] of [[base, 'media'], [1 / 3, 'azar']]) {
        VIZ.trazar(ctx, plano, [[1, v], [30, v]], C.apagado, 1.2, [3, 4]);
        ctx.save(); ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'middle';
        ctx.fillText(t, plano.x1 + 6, plano.sy(v)); ctx.restore();
      }
      VIZ.trazar(ctx, plano, curva, C.s1, 2);
      for (const [k, a] of curva) VIZ.marcador(ctx, plano.sx(k), plano.sy(a), C.s1, k === kSel ? 5 : 3);
      const mejor = curva.reduce((m, p) => (p[1] > m[1] ? p : m), curva[0]);
      lectura.set([
        ['mejor k', String(mejor[0])],
        ['exactitud con el mejor k', `${(mejor[1] * 100).toFixed(1)} %`],
        ['exactitud con k = 1', `${(curva[0][1] * 100).toFixed(1)} %`],
        ['media de descriptores', `${(base * 100).toFixed(1)} %`],
      ]);
    }
    lienzo.alDibujar = () => curva.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { tip.ocultar(); return; }
      kSel = Math.min(30, Math.max(1, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `k = <b>${kSel}</b>` + VIZ.filaTooltip(C.s1, 'bolsa de palabras', `${(curva[kSel - 1][1] * 100).toFixed(1)} %`)
        + VIZ.filaTooltip(C.apagado, 'media', `${(base * 100).toFixed(1)} %`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); kSel = 0; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('bag-of-words', {
    intro: String.raw`
      <p>Un detector como <a href="tema.html?id=sift">SIFT</a> entrega un número distinto de descriptores en cada imagen, y en
      cualquier orden. Un clasificador, en cambio, necesita un vector de largo fijo. La <strong>bolsa de palabras visuales</strong>
      (<em>bag of visual words</em>, Sivic y Zisserman, 2003; Csurka et al., 2004) resuelve el problema igual que en texto: se
      arma un <em>vocabulario</em> agrupando descriptores y cada imagen se representa por cuántas veces aparece cada palabra.</p>
      <p>Se pierde la posición de cada descriptor (por eso «bolsa»), pero se conserva qué tipo de patrones locales tiene la
      imagen y en qué proporción, que suele bastar para reconocer escenas y categorías de objetos.</p>`,
    visualizaciones: [
      {
        titulo: 'Vocabulario visual',
        descripcion: 'Descriptores de 30 imágenes de tres clases (en 2D para poder verlos) y las k palabras que encuentra k-means. Cambie k y observe cómo cambia el histograma de una misma imagen.',
        montar: montarVocabulario,
      },
      {
        titulo: 'Exactitud según el tamaño del vocabulario',
        descripcion: 'Clasificación por el vecino más cercano entre histogramas, para cada tamaño de vocabulario, comparada con resumir cada imagen por la media de sus descriptores.',
        montar: montarExactitud,
      },
    ],
    teoria: String.raw`
      <h2>Representación</h2>
      <p>Sea \(\{d_1, \dots, d_n\}\) el conjunto de descriptores de una imagen (\(d_i \in \mathbb{R}^{128}\) con SIFT). Dado un
      vocabulario \(V = \{v_1, \dots, v_k\}\), la <em>cuantización</em> asigna cada descriptor a su palabra más cercana y la imagen
      queda representada por el histograma normalizado</p>
      \[ h_j = \frac{1}{n}\,\big|\{\, i : j = \arg\min_{l} \lVert d_i - v_l \rVert \,\}\big|, \qquad j = 1, \dots, k. \]
      <h2>Algoritmo</h2>
      <pre><code>entrenamiento:
    juntar los descriptores de todas las imágenes de entrenamiento
    V ← k-means(descriptores, k)                 (vocabulario)
    para cada imagen: h ← histograma de palabras
    entrenar un clasificador sobre los vectores h
prueba:
    extraer descriptores, cuantizar con V, histograma h, clasificar</code></pre>
      <p>El vocabulario se aprende con <a href="tema.html?id=kmeans">k-means</a> sin usar las etiquetas. Con SIFT se usan
      vocabularios de cientos a decenas de miles de palabras; para cuantizar rápido se usan árboles de vocabulario
      (k-means jerárquico).</p>
      <h2>Tamaño del vocabulario</h2>
      <ul>
        <li><strong>Pocas palabras:</strong> patrones distintos caen en la misma palabra y el histograma no distingue las clases.</li>
        <li><strong>Demasiadas palabras:</strong> cada palabra recibe pocos descriptores, los histogramas de imágenes parecidas
        dejan de coincidir y el vector se vuelve ralo y ruidoso.</li>
      </ul>
      <p>El mejor \(k\) depende de cuántos descriptores hay por imagen y de cuán dispersos son: se elige por
      <a href="tema.html?id=evaluacion">validación cruzada</a>.</p>
      <h2>Comparación de histogramas y mejoras</h2>
      <p>Para histogramas se usan la distancia \(\chi^2\), la intersección \(\sum_j \min(h_j, h'_j)\) o kernels basados en ellas
      con una <a href="tema.html?id=svm">SVM</a>. Como en texto, se pondera con <em>tf-idf</em> para bajar el peso de las palabras
      que aparecen en todas las imágenes. La <em>pirámide espacial</em> (Lazebnik et al., 2006) recupera algo de la posición:
      concatena histogramas de la imagen completa, de sus 4 cuadrantes y de 16 sub-bloques. Fisher vectors y VLAD guardan,
      además del conteo, el residuo promedio \(d_i - v_j\) de cada palabra.</p>
      <p>Las <a href="tema.html?id=cnn">redes convolucionales</a> reemplazaron este esquema hacia 2012, pero su estructura es
      parecida: descriptores locales, una codificación y un agrupamiento (<em>pooling</em>) sobre la imagen.</p>`,
  });
})();
