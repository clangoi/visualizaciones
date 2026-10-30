(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const METODOS = [['pca', 'PCA', C.s1], ['tsne', 't-SNE', C.s2], ['umap', 'UMAP', C.s3]];
  const N = 240;
  const cache = new Map();
  // Las tres incrustaciones de un conjunto (se calculan una vez y las comparten ambas figuras).
  function incrustar(tipo, semilla) {
    const clave = `${tipo}|${semilla}`;
    if (cache.has(clave)) return cache.get(clave);
    const D = M.datosAltos(tipo, N, semilla);
    const ts = M.tsne(D.X, { perplejidad: 25, semilla });
    for (let i = 0; i < 500; i++) ts.paso();
    const um = M.umap(D.X, { vecinos: 15, distMin: 0.1, semilla, epocas: 200 });
    for (let i = 0; i < 200; i++) um.paso();
    const r = { D, Y: { pca: M.pca(D.X, 2).Y, tsne: ts.Y, umap: um.Y } };
    // Orden completo de vecinos en cada espacio, para medir preservación con cualquier k.
    const orden = (Z) => Z.map((a, i) => Z.map((b, j) => [j, M.dist2(a, b)]).filter(([j]) => j !== i).sort((u, v) => u[1] - v[1]).map(([j]) => j));
    r.ordenX = orden(D.X);
    r.ordenY = Object.fromEntries(Object.entries(r.Y).map(([k, Y]) => [k, orden(Y)]));
    const pares = (Z) => { const v = []; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) v.push(Math.sqrt(M.dist2(Z[i], Z[j]))); return v; };
    const dX = pares(D.X);
    r.global = Object.fromEntries(Object.entries(r.Y).map(([k, Y]) => [k, M.correlacion(dX, pares(Y))]));
    cache.set(clave, r);
    return r;
  }
  function preservacion(r, metodo, k) {
    let s = 0;
    for (let i = 0; i < N; i++) { const A = new Set(r.ordenX[i].slice(0, k)); s += r.ordenY[metodo][i].slice(0, k).filter((j) => A.has(j)).length / k; }
    return s / N;
  }

  /* ---------- Fig. 1: tres mapas de los mismos datos ---------- */

  function montarTres(cuerpo) {
    let tipo = 'cumulos', semilla = 1, R = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS_ALTOS, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? 3 * Math.round(w * 0.62) + 60 : Math.round(w / 3) + 26) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un punto de cualquier mapa: se marca en los tres junto con sus 10 vecinos más cercanos en el espacio original. Si los vecinos aparecen desperdigados, ese método rompió la estructura local.');
    function calcular() { R = incrustar(tipo, semilla); hover = -1; dibujar(); }
    let planos = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, h = vertical ? (H - 60) / 3 : H - 26, w = vertical ? W : W / 3;
      const vec = hover >= 0 ? new Set(R.ordenX[hover].slice(0, 10)) : null;
      planos = METODOS.map(([m, nombre], k) => {
        const x0 = vertical ? 0 : k * w, y0 = vertical ? k * (h + 20) + 20 : 22;
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(nombre, x0 + 6, y0 - 4);
        const pl = M.planoIncrustacion(lienzo, R.Y[m], { x0: x0 + 4, y0, x1: x0 + w - 4, y1: y0 + h });
        const P = R.Y[m].map((y) => ({ x: y[0], y: y[1] }));
        M.dispersion(ctx, pl, P, {
          color: (p, i) => (vec && !vec.has(i) && i !== hover ? C.tenue : M.colorAlto(R.D, i)),
          forma: (p, i) => M.formaAlto(R.D, i), r: 3,
          anillo: (p, i) => (i === hover ? C.tinta : vec && vec.has(i) ? C.s4 : null),
        });
        return { m, pl };
      });
      leyenda.set([...M.leyendaAltos(tipo), { color: C.s4, texto: 'vecinos originales del punto señalado', forma: 'linea' }]);
      lectura.set(METODOS.map(([m, nombre]) => [`${nombre}: local · global`, `${M.pct(preservacion(R, m, 10), 0)} · r = ${VIZ.fmt(R.global[m], 2)}`]));
    }
    lienzo.alDibujar = () => R && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let i = -1;
      for (const { m, pl } of planos) if (pl.dentro(x, y)) i = M.cercanoIncrustacion(pl, R.Y[m], x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const conservados = METODOS.map(([m, nombre]) => `${nombre} ${R.ordenY[m][i].slice(0, 10).filter((j) => R.ordenX[i].slice(0, 10).includes(j)).length}/10`).join(' · ');
      tip.mostrar(x, y, `punto <b>${i}</b><br>vecinos conservados: ${conservados}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (R) dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: local frente a global ---------- */

  function montarCurvas(cuerpo) {
    let tipo = 'cumulos', semilla = 1, R = null, filas = [], hover = null;
    const KS = [3, 5, 10, 15, 20, 30, 45, 60, 80, 110, 150, 200];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS_ALTOS, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...METODOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })), { color: C.apagado, texto: 'azar: k / (n − 1)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada k, la fracción de los k vecinos originales que siguen entre los k vecinos del mapa. Con k chico se mide estructura local; con k cercano a n, global. Pase el cursor sobre el gráfico.');
    function calcular() {
      R = incrustar(tipo, semilla);
      filas = KS.map((k) => ({ k, ...Object.fromEntries(METODOS.map(([m]) => [m, preservacion(R, m, k)])) }));
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 210, ymin: 0, ymax: 1 }, { etiquetaX: 'k (tamaño del vecindario)', etiquetaY: 'vecinos conservados', formatoY: (v) => `${Math.round(v * 100)}%` });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, 0], [210, 210 / (N - 1)]], C.apagado, 1.5, [3, 4]);
      for (const [m, , c] of METODOS) {
        VIZ.trazar(ctx, plano, filas.map((f) => [f.k, f[m]]), c, 2);
        for (const f of filas) VIZ.marcador(ctx, plano.sx(f.k), plano.sy(f[m]), c, f === hover ? 5 : 3);
      }
      lectura.set(METODOS.map(([m, nombre]) => [`${nombre}: k = 10 · correlación de distancias`, `${M.pct(preservacion(R, m, 10), 0)} · ${VIZ.fmt(R.global[m], 3)}`]));
    }
    lienzo.alDibujar = () => R && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const kx = plano.ix(x);
      hover = filas.reduce((a, b) => (Math.abs(b.k - kx) < Math.abs(a.k - kx) ? b : a));
      dibujar();
      tip.mostrar(x, y, `k = <b>${hover.k}</b>` + METODOS.map(([m, t, c]) => VIZ.filaTooltip(c, t, M.pct(hover[m]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (R) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('dimensionality-reduction-comparison', {
    intro: String.raw`
      <p>Ningún mapa de dos dimensiones puede conservar todo lo que hay en diez o en mil. Cada método de reducción decide qué
      sacrificar: <a href="tema.html?id=pca">PCA</a> conserva las direcciones de mayor varianza (estructura <strong>global</strong>,
      lineal); <a href="tema.html?id=t-sne">t-SNE</a> conserva los vecindarios (estructura <strong>local</strong>);
      <a href="tema.html?id=umap">UMAP</a> busca un punto intermedio.</p>
      <p>Comparar los mapas sobre los mismos datos, y medir qué conserva cada uno, evita sacar conclusiones de artefactos del método.</p>`,
    visualizaciones: [
      {
        titulo: 'Tres mapas de los mismos datos',
        descripcion: 'PCA, t-SNE y UMAP sobre el mismo conjunto. En el rollo suizo, PCA lo ve de costado; en los cúmulos, compare si las dos familias quedan separadas.',
        montar: montarTres,
      },
      {
        titulo: 'Local frente a global',
        descripcion: 'Preservación de vecinos según el tamaño del vecindario. Las curvas se cruzan: el mejor método depende de la escala que importe.',
        montar: montarCurvas,
      },
    ],
    teoria: String.raw`
      <h2>Medir lo que se conserva</h2>
      <p>Sean \(N_k(i)\) y \(\hat N_k(i)\) los \(k\) vecinos de \(i\) en el espacio original y en el mapa. La
      <strong>preservación de vecinos</strong> es</p>
      \[ Q(k) = \frac{1}{n} \sum_{i=1}^{n} \frac{|N_k(i) \cap \hat N_k(i)|}{k}, \]
      <p>que vale \(k/(n-1)\) en promedio para un mapa al azar y 1 para uno perfecto. Medidas relacionadas son la
      <em>confiabilidad</em> (<em>trustworthiness</em>, penaliza falsos vecinos en el mapa) y la <em>continuidad</em> (penaliza vecinos
      perdidos). Para la estructura global se usa la correlación entre las distancias por pares en ambos espacios.</p>
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>PCA</th><th>t-SNE</th><th>UMAP</th></tr>
        <tr><td>Tipo</td><td>lineal</td><td>no lineal</td><td>no lineal</td></tr>
        <tr><td>Conserva</td><td>varianza, distancias grandes</td><td>vecindarios</td><td>vecindarios y algo de topología global</td></tr>
        <tr><td>Determinista</td><td>sí</td><td>no</td><td>no (salvo semilla)</td></tr>
        <tr><td>Costo</td><td>\(O(nd^2)\)</td><td>\(O(n^2)\) exacto, \(O(n \log n)\) Barnes–Hut</td><td>\(\approx O(n^{1.14})\)</td></tr>
        <tr><td>Puntos nuevos</td><td>sí, \(z = W(x - \mu)\)</td><td>no</td><td>sí</td></tr>
        <tr><td>Ejes interpretables</td><td>sí (cargas)</td><td>no</td><td>no</td></tr>
      </table>
      <h2>Recomendaciones</h2>
      <ul>
        <li>Empiece por PCA: es rápido, reproducible y su <a href="tema.html?id=linear-projections">varianza explicada</a> dice cuánta
        estructura lineal hay. Es común aplicar PCA a ~50 dimensiones antes de t-SNE o UMAP.</li>
        <li>No interprete tamaños de grupos ni distancias entre grupos en t-SNE; en UMAP, con cautela.</li>
        <li>Pruebe varios valores de perplejidad o <code>n_neighbors</code> y varias semillas: lo que se mantiene es estructura; lo que
        cambia, artefacto (ver <a href="tema.html?id=hyperparameter-sensitivity">sensibilidad a hiperparámetros</a>).</li>
        <li>Los grupos que aparecen en un mapa no lineal son hipótesis: confírmelos con <a href="tema.html?id=hierarchical-clustering">clustering</a>
        en el espacio original.</li>
      </ul>`,
  });
})();