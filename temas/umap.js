(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: el grafo difuso de vecinos ---------- */

  function montarGrafo(cuerpo) {
    let tipo = 'densidades', k = 8, semilla = 3, pts = [], G = null, sel = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'Vecinos k', min: 2, max: 30, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arista: opacidad ∝ peso de la unión difusa', forma: 'linea' },
      { color: C.s2, texto: 'aristas del punto elegido (peso dirigido)', forma: 'linea' },
      { color: C.s7, texto: 'radio ρᵢ (vecino más cercano)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un punto. Su vecino más cercano siempre recibe peso 1 (la distancia se mide desde ρᵢ) y σᵢ se ajusta para que la suma de pesos sea log₂ k: cada punto queda conectado aunque esté en una zona poco densa.');
    function generar() { pts = M.datos2d(tipo, 140, semilla); sel = 0; calcular(); }
    function calcular() { G = M.grafoDifuso(pts.map(M.xy), k); dibujar(); }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const asp = lienzo.ancho / lienzo.alto;
      plano = VIZ.ml.plano(lienzo, { dominio: { xmin: -1.15 * asp, xmax: 1.15 * asp, ymin: -1.15, ymax: 1.15 } });
      plano.ejes();
      ctx.save(); plano.recortar();
      for (const e of G.aristas) {
        ctx.strokeStyle = VIZ.alfa(C.s1, 0.08 + 0.6 * e.w); ctx.lineWidth = 0.5 + 1.5 * e.w;
        ctx.beginPath(); ctx.moveTo(plano.sx(pts[e.i].x), plano.sy(pts[e.i].y)); ctx.lineTo(plano.sx(pts[e.j].x), plano.sy(pts[e.j].y)); ctx.stroke();
      }
      const vs = G.vecinos[sel], rho = vs[0].d;
      let lo = 0, hi = Infinity, s = 1;
      for (let it = 0; it < 64; it++) { const t = M.suma(vs.map((v) => Math.exp(-Math.max(0, v.d - rho) / s))); if (t > Math.log2(k)) { hi = s; s = (lo + hi) / 2; } else { lo = s; s = hi === Infinity ? s * 2 : (lo + hi) / 2; } }
      for (const v of vs) {
        const w = Math.exp(-Math.max(0, v.d - rho) / s);
        ctx.strokeStyle = VIZ.alfa(C.s2, 0.25 + 0.75 * w); ctx.lineWidth = 1 + 2.5 * w;
        ctx.beginPath(); ctx.moveTo(plano.sx(pts[sel].x), plano.sy(pts[sel].y)); ctx.lineTo(plano.sx(pts[v.j].x), plano.sy(pts[v.j].y)); ctx.stroke();
      }
      const esc = plano.sx(1) - plano.sx(0);
      ctx.strokeStyle = C.s7; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(plano.sx(pts[sel].x), plano.sy(pts[sel].y), rho * esc, 0, 2 * Math.PI); ctx.stroke();
      ctx.restore();
      M.dispersion(ctx, plano, pts, { color: () => C.tinta2, r: 2.8 });
      VIZ.marcador(ctx, plano.sx(pts[sel].x), plano.sy(pts[sel].y), C.s2, 6);
      // Componentes conexas del grafo.
      const padre = pts.map((_, i) => i), raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
      for (const e of G.aristas) padre[raiz(e.i)] = raiz(e.j);
      lectura.set([
        ['ρᵢ del punto elegido', VIZ.fmt(rho, 3)],
        ['σᵢ del punto elegido', VIZ.fmt(s, 3)],
        ['aristas del grafo', String(G.aristas.length)],
        ['componentes conexas', String(new Set(pts.map((_, i) => raiz(i))).size)],
      ]);
    }
    lienzo.alDibujar = () => G && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const cerca = (x, y) => { let m = -1, dm = 12; pts.forEach((q, j) => { const d = Math.hypot(plano.sx(q.x) - x, plano.sy(q.y) - y); if (d < dm) { dm = d; m = j; } }); return m; };
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), j = plano ? cerca(x, y) : -1; if (j >= 0) { sel = j; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), j = plano ? cerca(x, y) : -1;
      if (j < 0) return tip.ocultar();
      const e = G.aristas.find((a) => (a.i === sel && a.j === j) || (a.j === sel && a.i === j));
      tip.mostrar(x, y, `punto <b>${j}</b><br>peso con el elegido <b>${e ? VIZ.fmt(e.w, 3) : '0'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: la disposición en el plano ---------- */

  function montarDisposicion(cuerpo) {
    let tipo = 'rollo', vecinos = 15, distMin = 0.1, semilla = 1, D = null, est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS_ALTOS, valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'n_neighbors', min: 3, max: 50, valor: vecinos, alCambiar: (v) => { vecinos = v; }, alSoltar: () => rep.reiniciar() });
    ctl.rango({ etiqueta: 'min_dist', min: 0, max: 0.99, paso: 0.01, valor: distMin, formato: (v) => v.toFixed(2), alCambiar: (v) => { distMin = v; }, alSoltar: () => rep.reiniciar() });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 5 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Parte desde una incrustación espectral del grafo. En cada época, las aristas del grafo atraen a sus extremos y unos pocos puntos al azar se repelen. Con el rollo suizo, n_neighbors chico rompe el rollo en trozos; grande, lo desenrolla como una banda.');
    function iniciar() {
      D = M.datosAltos(tipo, 300, semilla);
      est = M.umap(D.X, { vecinos, distMin, semilla, epocas: 200 });
      return (function* () { while (est.epoca < est.epocas) { est.paso(); yield; } })();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = M.planoIncrustacion(lienzo, est.Y);
      M.dispersion(ctx, plano, est.Y.map((y) => ({ x: y[0], y: y[1] })), { color: (p, i) => M.colorAlto(D, i), forma: (p, i) => M.formaAlto(D, i), r: 3.5 });
      leyenda.set(M.leyendaAltos(tipo));
      lectura.set([
        ['época', `${est.epoca} / ${est.epocas}`],
        ['aristas del grafo difuso', VIZ.entero(est.aristas.length)],
        ['curva 1/(1 + a d^{2b})', `a = ${VIZ.fmt(est.a, 3)}, b = ${VIZ.fmt(est.b, 3)}`],
        ['vecinos conservados (k = 10)', est.epoca === est.epocas ? M.pct(M.preservacionVecinos(D.X, est.Y, 10)) : '— (al terminar)'],
      ]);
    }
    lienzo.alDibujar = () => est && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = plano ? M.cercanoIncrustacion(plano, est.Y, x, y) : -1;
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `punto <b>${i}</b><br>${D.g ? `grupo <b>${D.g[i] + 1}</b>` : `posición en el rollo <b>${VIZ.fmt(D.t[i], 2)}</b>`}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    M.alSalir(cuerpo, () => rep.detener());
    rep.reiniciar();
  }

  VIZ.registrarTema('umap', {
    intro: String.raw`
      <p><strong>UMAP</strong> (<em>Uniform Manifold Approximation and Projection</em>) es, como <a href="tema.html?id=t-sne">t-SNE</a>,
      un método no lineal para llevar datos de muchas dimensiones a dos o tres. Trabaja en dos pasos: construye un
      <strong>grafo de vecinos</strong> ponderado en el espacio original y luego busca una disposición en el plano cuyo grafo se le parezca.</p>
      <p>Suele ser más rápido que t-SNE, conserva algo más de la estructura global y tiene dos perillas fáciles de interpretar:
      cuántos vecinos mirar (<code>n_neighbors</code>) y qué tan juntos se permite dibujar los puntos (<code>min_dist</code>).</p>`,
    visualizaciones: [
      {
        titulo: 'El grafo difuso de vecinos',
        descripcion: 'Los k vecinos de cada punto, con pesos que decaen desde el vecino más cercano. Suba k y observe cuándo el grafo pasa de varias componentes a una sola.',
        montar: montarGrafo,
      },
      {
        titulo: 'La disposición en el plano',
        descripcion: 'El descenso estocástico que acomoda el grafo en 2-D. Compare min_dist 0 (grupos muy apretados) con 0,8 (puntos repartidos).',
        montar: montarDisposicion,
      },
    ],
    teoria: String.raw`
      <h2>Grafo en el espacio original</h2>
      <p>Para cada punto \(x_i\) se toman sus \(k\) vecinos más cercanos. Con \(\rho_i\) la distancia al más cercano, los pesos dirigidos son</p>
      \[ w_{i \to j} = \exp\!\Bigl(-\frac{\max(0,\; d(x_i, x_j) - \rho_i)}{\sigma_i}\Bigr), \qquad \text{con } \sigma_i \text{ tal que } \sum_{j} w_{i \to j} = \log_2 k. \]
      <p>Restar \(\rho_i\) garantiza que todo punto tenga al menos una arista de peso 1 (supuesto de que los datos cubren la
      variedad de manera uniforme, cada uno con su propia escala local). Los dos sentidos se combinan con la
      <strong>unión difusa</strong>:</p>
      \[ w_{ij} = w_{i \to j} + w_{j \to i} - w_{i \to j}\, w_{j \to i}. \]
      <h2>Disposición en el plano</h2>
      <p>En el plano, la similitud entre \(y_i\) y \(y_j\) es \(v_{ij} = \bigl(1 + a\,\lVert y_i - y_j\rVert^{2b}\bigr)^{-1}\), con \(a, b\)
      ajustados a partir de <code>min_dist</code>. Se minimiza la entropía cruzada entre los dos grafos difusos:</p>
      \[ \mathcal{L} = \sum_{i &lt; j} \Bigl[\, w_{ij} \log \frac{w_{ij}}{v_{ij}} + (1 - w_{ij}) \log \frac{1 - w_{ij}}{1 - v_{ij}} \Bigr]. \]
      <p>El primer término atrae a los vecinos; el segundo repele a los no vecinos. A diferencia de KL en t-SNE, el segundo
      término sí castiga dibujar juntos a puntos lejanos, lo que ayuda a la estructura global.</p>
      <pre><code>Y ← inicio espectral (o PCA)
para época ← 1 hasta E:
    para cada arista (i, j), con probabilidad ∝ w_ij:
        mover y_i y y_j uno hacia el otro          (atracción)
        para m muestras negativas k al azar:
            alejar y_i de y_k                         (repulsión)
    reducir la tasa de aprendizaje</code></pre>
      <p>El muestreo negativo hace que cada época cueste \(O(nk)\) en lugar de \(O(n^2)\); los vecinos se buscan con índices
      aproximados (NN-descent).</p>
      <h2>t-SNE frente a UMAP</h2>
      <table>
        <tr><th></th><th>t-SNE</th><th>UMAP</th></tr>
        <tr><td>Vecindario</td><td>perplejidad (gaussiana)</td><td>\(k\) vecinos (exponencial desde \(\rho_i\))</td></tr>
        <tr><td>Similitud en 2-D</td><td>t de Student</td><td>\(1/(1 + a d^{2b})\)</td></tr>
        <tr><td>Pérdida</td><td>KL</td><td>entropía cruzada</td></tr>
        <tr><td>Puntos nuevos</td><td>no</td><td>sí (transformación aprendida)</td></tr>
      </table>
      <p>Esta página usa una versión simplificada (\(a, b\) aproximados, vecinos exactos), suficiente para ver el efecto de los parámetros.</p>`,
  });
})();