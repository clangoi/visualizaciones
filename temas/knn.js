(function () {
  'use strict';
  const { color: C } = VIZ;
  const ML = VIZ.ml;

  const METRICAS = {
    euclidiana: (a, b, x, y) => Math.hypot(a - x, b - y),
    manhattan: (a, b, x, y) => Math.abs(a - x) + Math.abs(b - y),
    chebyshev: (a, b, x, y) => Math.max(Math.abs(a - x), Math.abs(b - y)),
  };

  // Los k vecinos más cercanos de (x, y), por inserción en una lista ordenada (k es pequeño).
  function vecinos(pts, x, y, k, dist, excluir = -1) {
    const v = [];
    for (let i = 0; i < pts.length; i++) {
      if (i === excluir) continue;
      const d = dist(pts[i].x, pts[i].y, x, y);
      if (v.length < k || d < v[v.length - 1].d) {
        let j = v.length < k ? v.length : k - 1;
        if (v.length < k) v.push(null);
        while (j > 0 && v[j - 1].d > d) { v[j] = v[j - 1]; j--; }
        v[j] = { i, d };
      }
    }
    return v;
  }
  function votar(pts, vs, K, ponderado) {
    const votos = new Array(K).fill(0);
    for (const { i, d } of vs) votos[pts[i].c] += ponderado ? 1 / (d + 1e-6) : 1;
    const s = votos.reduce((a, b) => a + b, 0) || 1;
    return votos.map((v) => v / s);
  }
  const clase = (pr) => pr.indexOf(Math.max(...pr));

  /* ---------- Fig. 1: regiones de decisión ---------- */

  function montarRegiones(cuerpo) {
    let tipo = 'lunas', ruido = 0.35, n = 160, k = 5, metrica = 'euclidiana', ponderado = false, semilla = 3;
    let entr = [], val = [], K = 2, q = { x: 0.1, y: 0.2 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 1, paso: 0.05, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; generar(); } });
    ctl.rango({ etiqueta: 'Vecinos k', min: 1, max: 41, paso: 2, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Distancia', opciones: [['euclidiana', 'Euclidiana (L2)'], ['manhattan', 'Manhattan (L1)'], ['chebyshev', 'Chebyshev (L∞)']], valor: metrica,
      alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'voto ponderado por 1/distancia', valor: ponderado, alCambiar: (v) => { ponderado = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para mover el punto de consulta (estrella): se unen con él sus k vecinos y el contorno marca la distancia al k-ésimo. Con k = 1 la frontera sigue cada punto de entrenamiento; con k grande se suaviza.');

    function generar() {
      const pts = ML.datos(tipo, n, ruido, semilla);
      K = Math.max(...pts.map((p) => p.c)) + 1;
      ({ entrenamiento: entr, validacion: val } = ML.partir(pts, 0.7, semilla));
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const dist = METRICAS[metrica], kk = Math.min(k, entr.length);
      const prob = (x, y) => votar(entr, vecinos(entr, x, y, kk, dist), K, ponderado);
      plano = ML.plano(lienzo);
      ML.regiones(ctx, plano, prob, { paso: 6 });
      plano.ejes();
      const vq = vecinos(entr, q.x, q.y, kk, dist);
      // Contorno de la «bola» que contiene a los k vecinos, en la métrica elegida.
      ctx.save(); plano.recortar();
      const r = vq[vq.length - 1].d;
      ML.contorno(ctx, plano, (x, y) => dist(x, y, q.x, q.y), r, { color: C.s4, ancho: 1.5, guiones: [4, 3] });
      for (const { i } of vq) VIZ.trazar(ctx, plano, [[q.x, q.y], [entr[i].x, entr[i].y]], C.s4, 1.5);
      ctx.restore();
      ML.puntos(ctx, plano, entr, { anillo: (p) => (vq.some((v) => entr[v.i] === p) ? C.s4 : null) });
      ML.puntos(ctx, plano, val, { hueco: () => true });
      const pq = votar(entr, vq, K, ponderado);
      ctx.save(); ctx.fillStyle = ML.CLASES[clase(pq)]; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); VIZ.forma(ctx, plano.sx(q.x), plano.sy(q.y), 8, 6); ctx.fill(); ctx.stroke(); ctx.restore();
      leyenda.set([...ML.leyendaClases(K), { color: C.s4, texto: 'k vecinos del punto de consulta', forma: 'linea' }, { color: C.inactivo, texto: 'hueco: dato de validación', forma: 'punto' }]);
      const exact = (pts, excluirseAsiMismo) => pts.filter((p, j) => clase(votar(entr, vecinos(entr, p.x, p.y, kk, dist, excluirseAsiMismo ? j : -1), K, ponderado)) === p.c).length / pts.length;
      lectura.set([
        ['exactitud entrenamiento', `${(100 * exact(entr, false)).toFixed(1)} %`],
        ['exactitud validación', `${(100 * exact(val, false)).toFixed(1)} %`],
        ['votos del punto', pq.map((v, c) => `${c}: ${(v * 100).toFixed(0)}%`).join('  ')],
        ['radio del k-ésimo vecino', r.toFixed(3)],
      ]);
    }
    lienzo.alDibujar = () => entr.length && dibujar();
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      q = { x: plano.ix(x), y: plano.iy(y) };
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const pr = votar(entr, vecinos(entr, plano.ix(x), plano.iy(y), Math.min(k, entr.length), METRICAS[metrica]), K, ponderado);
      tip.mostrar(x, y, pr.map((p, c) => VIZ.filaTooltip(ML.CLASES[c], `clase ${c}`, `${(p * 100).toFixed(0)} %`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: error según k ---------- */

  function montarCurva(cuerpo) {
    let tipo = 'lunas', ruido = 0.5, n = 240, semilla = 7;
    let filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 1, paso: 0.05, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; }, alSoltar: calcular });
    ctl.rango({ etiqueta: 'Muestras', min: 40, max: 400, paso: 20, valor: n, alCambiar: (v) => { n = v; }, alSoltar: calcular });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'error de entrenamiento (incluye al propio punto)', forma: 'linea' },
      { color: C.s3, texto: 'error de entrenamiento sin el propio punto (dejar uno fuera)', forma: 'linea' },
      { color: C.s2, texto: 'error de validación', forma: 'linea' },
      { color: C.s6, texto: 'k con menor error de validación', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con k = 1 el error de entrenamiento es cero (cada punto es su propio vecino): no dice nada. Dejar el punto fuera da una estimación honesta casi sin costo. A la izquierda de la curva hay sobreajuste; a la derecha, subajuste.');

    function calcular() {
      const pts = ML.datos(tipo, n, ruido, semilla);
      const K = Math.max(...pts.map((p) => p.c)) + 1;
      const { entrenamiento: E, validacion: V } = ML.partir(pts, 0.6, semilla);
      const dist = METRICAS.euclidiana;
      filas = [];
      for (let k = 1; k <= Math.min(61, E.length - 1); k += 2) {
        const err = (pts2, loo) => pts2.filter((p, j) => clase(votar(E, vecinos(E, p.x, p.y, k, dist, loo ? j : -1), K, false)) !== p.c).length / pts2.length;
        filas.push({ k, entr: err(E, false), loo: err(E, true), val: err(V, false) });
      }
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.min(1, Math.max(0.1, ...filas.map((f) => Math.max(f.val, f.loo))) * 1.2);
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: filas[filas.length - 1].k, ymin: 0, ymax }, { etiquetaX: 'k (vecinos)', etiquetaY: 'error', formatoY: (v) => `${Math.round(v * 100)}%` });
      plano.ejes();
      VIZ.trazar(ctx, plano, filas.map((f) => [f.k, f.entr]), C.s1, 2);
      VIZ.trazar(ctx, plano, filas.map((f) => [f.k, f.loo]), C.s3, 2);
      VIZ.trazar(ctx, plano, filas.map((f) => [f.k, f.val]), C.s2, 2);
      const mejor = filas.reduce((m, f) => (f.val < m.val ? f : m), filas[0]);
      VIZ.marcador(ctx, plano.sx(mejor.k), plano.sy(mejor.val), C.s6, 5.5);
      lectura.set([
        ['mejor k (validación)', String(mejor.k)],
        ['error con ese k', `${(100 * mejor.val).toFixed(1)} %`],
        ['error con k = 1', `${(100 * filas[0].val).toFixed(1)} %`],
        ['mejor k (dejar uno fuera)', String(filas.reduce((m, f) => (f.loo < m.loo ? f : m), filas[0]).k)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const kx = plano.ix(x), f = filas.reduce((m, g) => (Math.abs(g.k - kx) < Math.abs(m.k - kx) ? g : m), filas[0]);
      tip.mostrar(x, y, `k = <b>${f.k}</b>` + VIZ.filaTooltip(C.s1, 'entrenamiento', `${(100 * f.entr).toFixed(1)} %`)
        + VIZ.filaTooltip(C.s3, 'dejar uno fuera', `${(100 * f.loo).toFixed(1)} %`) + VIZ.filaTooltip(C.s2, 'validación', `${(100 * f.val).toFixed(1)} %`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('knn', {
    intro: String.raw`
      <p>El clasificador de los <strong>k vecinos más cercanos</strong> (k-NN) no aprende ningún modelo: guarda los datos de
      entrenamiento y, para clasificar un punto nuevo, busca los \(k\) más parecidos y asigna la clase más votada entre ellos.</p>
      <p>Es simple, no supone ninguna forma para las fronteras y se adapta a clases de cualquier forma. A cambio, todo depende de
      dos decisiones: cuántos vecinos mirar y cómo medir la distancia. Y clasificar es caro, porque hay que comparar con todos
      los datos guardados.</p>`,
    visualizaciones: [
      {
        titulo: 'Regiones de decisión',
        descripcion: 'El color de cada zona es la clase que ganaría la votación. Mueva k y cambie la distancia: con Manhattan o Chebyshev las fronteras toman tramos horizontales, verticales o diagonales.',
        montar: montarRegiones,
      },
      {
        titulo: 'Error según k',
        descripcion: 'Error de entrenamiento y de validación para cada k impar. El mejor k equilibra el ruido (k chico) y el exceso de suavizado (k grande).',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Regla</h2>
      <p>Sea \(N_k(x)\) el conjunto de los \(k\) puntos de entrenamiento más cercanos a \(x\). La estimación de la probabilidad a
      posteriori y la decisión son</p>
      \[ \hat P(\omega_c \mid x) = \frac{1}{k}\sum_{i \in N_k(x)} [\,y_i = c\,], \qquad \hat y(x) = \arg\max_c \hat P(\omega_c \mid x). \]
      <p>Es una aproximación local de la <a href="tema.html?id=bayes">regla de Bayes</a>: en lugar de modelar \(p(x \mid \omega_c)\),
      cuenta cuántos vecinos de cada clase hay alrededor de \(x\). Con voto ponderado, cada vecino aporta \(1/d(x, x_i)\).</p>
      <h2>Algoritmo</h2>
      <pre><code>entrenar:  guardar (x₁, y₁) … (x_n, y_n)
clasificar x:
    calcular d(x, xᵢ) para todo i
    N ← los k índices de menor distancia
    devolver la clase más frecuente en N   (empates: menor distancia total)</code></pre>
      <p>Entrenar es inmediato y clasificar cuesta \(O(n\,d)\) por consulta. Con árboles k-d o búsquedas aproximadas (grafos HNSW) se
      baja a casi logarítmico en dimensiones bajas o moderadas.</p>
      <h2>Garantía asintótica</h2>
      <div class="recuadro"><p>Cover y Hart (1967): con infinitos datos, el error del vecino más cercano (\(k = 1\)) es a lo sumo el doble
      del error de Bayes \(E^*\): \(E^* \le E_{1\text{-NN}} \le 2E^*(1 - E^*)\). Si \(k \to \infty\) y \(k/n \to 0\), el error de k-NN converge a \(E^*\).</p></div>
      <h2>Elegir k y la distancia</h2>
      <ul>
        <li><strong>k chico</strong>: fronteras irregulares que siguen el ruido (alta varianza). <strong>k grande</strong>: fronteras
        suaves que pueden borrar clases pequeñas (alto sesgo). Se elige por <a href="tema.html?id=evaluacion">validación</a>; en dos
        clases, un \(k\) impar evita empates.</li>
        <li>Las distancias \(L_p\) dependen de las escalas: hay que <strong>normalizar</strong> las características, o usar
        <a href="tema.html?id=lda-qda">Mahalanobis</a>.</li>
        <li>En dimensión alta, todas las distancias se parecen (<em>maldición de la dimensión</em>); conviene reducir antes con
        <a href="tema.html?id=pca">PCA</a> o <a href="tema.html?id=sfs">selección de características</a>.</li>
      </ul>
      <h2>Error de entrenamiento</h2>
      <p>Medir el error sobre los mismos puntos guardados es engañoso: con \(k = 1\) cada punto se encuentra a sí mismo y el error es
      cero. Excluir el propio punto (<em>dejar uno fuera</em>) da una estimación casi insesgada sin separar datos, y con k-NN
      cuesta lo mismo que clasificar el conjunto de entrenamiento.</p>`,
  });
})();
