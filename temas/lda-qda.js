(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat, ML = VIZ.ml;

  // Escenarios: medias y covarianzas reales de cada clase.
  const ESCENARIOS = {
    iguales: { nombre: 'Covarianzas iguales', clases: [[[-0.35, 0.25], [[0.06, 0.04], [0.04, 0.05]]], [[0.35, -0.2], [[0.06, 0.04], [0.04, 0.05]]]] },
    distintas: { nombre: 'Covarianzas distintas', clases: [[[-0.1, 0.1], [[0.012, 0], [0, 0.012]]], [[0.15, -0.1], [[0.22, 0.05], [0.05, 0.12]]]] },
    cruzadas: { nombre: 'Elipses cruzadas', clases: [[[0, 0], [[0.18, 0], [0, 0.01]]], [[0, 0.05], [[0.01, 0], [0, 0.18]]]] },
    tres: { nombre: 'Tres clases', clases: [[[-0.45, 0.35], [[0.03, 0.02], [0.02, 0.04]]], [[0.4, 0.3], [[0.05, -0.02], [-0.02, 0.02]]], [[0, -0.45], [[0.02, 0], [0, 0.06]]]] },
  };
  function muestrear(esc, n, semilla) {
    const rnd = VIZ.semilla(semilla), pts = [];
    esc.clases.forEach(([mu, S], c) => {
      const a = Math.sqrt(S[0][0]), b = S[0][1] / a, d = Math.sqrt(Math.max(1e-9, S[1][1] - b * b)); // Cholesky 2×2
      for (let i = 0; i < n; i++) {
        const z1 = VIZ.normal(rnd), z2 = VIZ.normal(rnd), q = { x: mu[0] + a * z1, y: mu[1] + b * z1 + d * z2, c };
        if (Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1) pts.push(q);
      }
    });
    return pts;
  }

  // Ajusta el clasificador y devuelve las funciones discriminantes g_k(x) (mayor es mejor).
  function ajustar(pts, tipo) {
    const K = Math.max(...pts.map((p) => p.c)) + 1, n = pts.length;
    const grupos = Array.from({ length: K }, (_, k) => pts.filter((p) => p.c === k).map((p) => [p.x, p.y]));
    const mus = grupos.map((g) => P.media(g)), Ss = grupos.map((g, k) => P.cov(g, mus[k]));
    const Sp = P.ceros(2, 2);
    grupos.forEach((g, k) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Sp[i][j] += (Ss[k][i][j] * (g.length - 1)) / (n - K); });
    const priores = grupos.map((g) => g.length / n);
    const covs = tipo === 'qda' ? Ss : tipo === 'euclidea' ? grupos.map(() => [[0.04, 0], [0, 0.04]]) : grupos.map(() => Sp);
    const invs = covs.map(P.inv), logdets = covs.map((S) => Math.log(P.det(S)));
    const g = (x, y) => mus.map((mu, k) => {
      const d2 = P.mahal2([x, y], mu, invs[k]);
      if (tipo === 'qda') return -0.5 * d2 - 0.5 * logdets[k] + Math.log(priores[k]);
      if (tipo === 'lda') return -0.5 * d2 + Math.log(priores[k]);
      return -0.5 * d2; // Mahalanobis o euclidiana: media más cercana, sin priores
    });
    const prob = (x, y) => { const v = g(x, y), m = Math.max(...v), e = v.map((t) => Math.exp(t - m)), s = e.reduce((a, b) => a + b, 0); return e.map((t) => t / s); };
    const pred = (x, y) => { const v = g(x, y); return v.indexOf(Math.max(...v)); };
    const parametros = tipo === 'qda' ? K * 5 + K - 1 : tipo === 'euclidea' ? K * 2 : K * 2 + 3 + (tipo === 'lda' ? K - 1 : 0);
    return { K, mus, covs, prob, pred, parametros };
  }

  /* ---------- Fig. 1: LDA, QDA y distancia mínima ---------- */

  function montarClasificadores(cuerpo) {
    let esc = 'distintas', tipo = 'qda', n = 60, semilla = 4;
    let entr = [], prueba = [], mod = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: Object.entries(ESCENARIOS).map(([k, e]) => [k, e.nombre]), valor: esc, alCambiar: (v) => { esc = v; generar(); } });
    ctl.selector({ etiqueta: 'Clasificador', opciones: [['lda', 'LDA (covarianza común)'], ['qda', 'QDA (covarianza por clase)'], ['mahalanobis', 'Mahalanobis a la media'], ['euclidea', 'Euclidiana a la media']], valor: tipo,
      alCambiar: (v) => { tipo = v; entrenar(); } });
    ctl.rango({ etiqueta: 'Muestras por clase', min: 6, max: 150, valor: n, alCambiar: (v) => { n = v; generar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los puntos huecos son de prueba. Con «Elipses cruzadas», LDA no puede separar las clases (sus medias casi coinciden) y QDA sí. Con pocas muestras por clase, QDA estima mal sus covarianzas y LDA suele ganar en prueba.');

    function generar() {
      const pts = muestrear(ESCENARIOS[esc], 2 * n, semilla);
      const { entrenamiento, validacion } = ML.partir(pts, 0.5, semilla + 9);
      entr = entrenamiento; prueba = validacion;
      entrenar();
    }
    function entrenar() { mod = ajustar(entr, tipo); dibujar(); }
    let plano = null;
    function dibujar() {
      if (!mod) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = ML.plano(lienzo);
      ML.regiones(ctx, plano, mod.prob, { paso: 5 });
      plano.ejes();
      ctx.save(); plano.recortar();
      mod.mus.forEach((mu, k) => P.elipse(ctx, plano, mu, mod.covs[k], 2, { color: ML.CLASES[k], ancho: 2, guiones: [5, 4] }));
      ctx.restore();
      ML.puntos(ctx, plano, entr);
      ML.puntos(ctx, plano, prueba, { hueco: () => true });
      mod.mus.forEach((mu, k) => VIZ.marcador(ctx, plano.sx(mu[0]), plano.sy(mu[1]), C.tinta, 5.5, k));
      leyenda.set([
        ...ML.leyendaClases(mod.K),
        { color: C.tinta, texto: 'media estimada', forma: 'punto' },
        { color: C.eje, texto: 'elipse: 2σ de la covarianza que usa el clasificador', forma: 'linea' },
      ]);
      lectura.set([
        ['exactitud entrenamiento', `${(100 * ML.exactitud(entr, mod.pred)).toFixed(1)} %`],
        ['exactitud prueba', `${(100 * ML.exactitud(prueba, mod.pred)).toFixed(1)} %`],
        ['parámetros estimados', String(mod.parametros)],
        ['frontera', tipo === 'qda' ? 'cuadrática' : 'lineal'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const pr = mod.prob(plano.ix(x), plano.iy(y));
      tip.mostrar(x, y, pr.map((p, k) => VIZ.filaTooltip(ML.CLASES[k], `P(clase ${k} | x)`, p.toFixed(3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: distancia de Mahalanobis ---------- */

  function montarMahalanobis(cuerpo) {
    let s1 = 0.4, s2 = 0.12, ang = 35, q = [0.05, 0.42];
    const A = [-0.3, -0.1], B = [0.45, 0.25];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'σ en el eje mayor', min: 0.05, max: 0.6, paso: 0.01, valor: s1, formato: (v) => v.toFixed(2), alCambiar: (v) => { s1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'σ en el eje menor', min: 0.05, max: 0.6, paso: 0.01, valor: s2, formato: (v) => v.toFixed(2), alCambiar: (v) => { s2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Orientación', min: 0, max: 180, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 520 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'clase A: curvas de Mahalanobis 1, 2 y 3', forma: 'linea' },
      { color: C.s2, texto: 'clase B: curvas de Mahalanobis 1, 2 y 3', forma: 'linea' },
      { color: C.tinta, texto: 'frontera por Mahalanobis', forma: 'linea' },
      { color: C.apagado, texto: 'frontera euclidiana (mediatriz)', forma: 'linea' },
      { color: C.s4, texto: 'punto de consulta', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para mover el punto de consulta. Póngalo en la zona entre las dos fronteras: queda más cerca de una media en línea recta y de la otra en desviaciones estándar.');

    let plano = null;
    function cov() {
      const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      return [[c * c * s1 * s1 + s * s * s2 * s2, c * s * (s1 * s1 - s2 * s2)], [c * s * (s1 * s1 - s2 * s2), s * s * s1 * s1 + c * c * s2 * s2]];
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = ML.plano(lienzo);
      plano.ejes();
      const S = cov(), Si = P.inv(S);
      ctx.save(); plano.recortar();
      for (const [mu, col] of [[A, C.s1], [B, C.s2]]) for (const k of [1, 2, 3]) P.elipse(ctx, plano, mu, S, k, { color: VIZ.alfa(col, 1 - k * 0.22), ancho: 1.5 });
      ML.contorno(ctx, plano, (x, y) => P.mahal2([x, y], A, Si) - P.mahal2([x, y], B, Si), 0, { color: C.tinta, ancho: 2 });
      ML.contorno(ctx, plano, (x, y) => (x - A[0]) ** 2 + (y - A[1]) ** 2 - (x - B[0]) ** 2 - (y - B[1]) ** 2, 0, { color: C.apagado, ancho: 1.5, guiones: [5, 4] });
      ctx.restore();
      VIZ.marcador(ctx, plano.sx(A[0]), plano.sy(A[1]), C.s1, 6, 0);
      VIZ.marcador(ctx, plano.sx(B[0]), plano.sy(B[1]), C.s2, 6, 1);
      ctx.save(); ctx.font = VIZ.fuente(12, 500); ctx.fillStyle = C.tinta;
      ctx.fillText('A', plano.sx(A[0]) + 9, plano.sy(A[1]) - 8); ctx.fillText('B', plano.sx(B[0]) + 9, plano.sy(B[1]) - 8); ctx.restore();
      for (const [mu, col] of [[A, C.s1], [B, C.s2]]) VIZ.trazar(ctx, plano, [mu, q], VIZ.alfa(col, 0.7), 1.5, [2, 3]);
      VIZ.marcador(ctx, plano.sx(q[0]), plano.sy(q[1]), C.s4, 6);
      const dEA = Math.hypot(q[0] - A[0], q[1] - A[1]), dEB = Math.hypot(q[0] - B[0], q[1] - B[1]);
      const dMA = Math.sqrt(P.mahal2(q, A, Si)), dMB = Math.sqrt(P.mahal2(q, B, Si));
      lectura.set([
        ['euclidiana a A / B', `${dEA.toFixed(3)} / ${dEB.toFixed(3)}`],
        ['más cerca (euclidiana)', dEA < dEB ? 'A' : 'B'],
        ['Mahalanobis a A / B', `${dMA.toFixed(2)} / ${dMB.toFixed(2)}`],
        ['más cerca (Mahalanobis)', dMA < dMB ? 'A' : 'B'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      q = [plano.ix(x), plano.iy(y)];
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('lda-qda', {
    intro: String.raw`
      <p>Si cada clase se modela con una distribución <strong>normal multivariada</strong>, la
      <a href="tema.html?id=bayes">regla de Bayes</a> se puede escribir en fórmulas cerradas. Con una covarianza común para todas las
      clases, las fronteras son rectas: es el <strong>análisis discriminante lineal</strong> (LDA). Con una covarianza propia por clase,
      las fronteras son cónicas: el <strong>análisis discriminante cuadrático</strong> (QDA).</p>
      <p>Ambos se apoyan en la <strong>distancia de Mahalanobis</strong>, que mide qué tan lejos está un punto de una media en unidades
      de desviación estándar, teniendo en cuenta que los datos pueden variar más en unas direcciones que en otras.</p>`,
    visualizaciones: [
      {
        titulo: 'Clasificadores gaussianos',
        descripcion: 'Regiones de decisión de cuatro clasificadores que estiman medias y covarianzas a partir de los datos. La intensidad del color es la probabilidad a posteriori.',
        montar: montarClasificadores,
      },
      {
        titulo: 'Distancia de Mahalanobis frente a euclidiana',
        descripcion: 'Dos clases con la misma covarianza. Cambie la forma de la covarianza y vea cómo la frontera de Mahalanobis se separa de la mediatriz euclidiana.',
        montar: montarMahalanobis,
      },
    ],
    teoria: String.raw`
      <h2>Distancia de Mahalanobis</h2>
      \[ d_M(x, \mu) = \sqrt{(x - \mu)^\top \Sigma^{-1} (x - \mu)}. \]
      <p>Con \(\Sigma = I\) es la distancia euclidiana. En general, sus curvas de nivel son elipses con los ejes de los vectores propios
      de \(\Sigma\), y equivale a la distancia euclidiana después de <em>blanquear</em> los datos con \(\Sigma^{-1/2}\). Que \(d_M = 2\) significa
      «a dos desviaciones estándar», sea cual sea la dirección.</p>
      <h2>Funciones discriminantes</h2>
      <p>Con \(p(x \mid \omega_k) = \mathcal{N}(\mu_k, \Sigma_k)\), el logaritmo de \(p(x \mid \omega_k)P(\omega_k)\) da, quitando constantes,</p>
      \[ g_k(x) = -\tfrac12 (x - \mu_k)^\top \Sigma_k^{-1} (x - \mu_k) - \tfrac12 \ln |\Sigma_k| + \ln P(\omega_k), \]
      <p>y se asigna la clase con mayor \(g_k\).</p>
      <table>
        <tr><th>Clasificador</th><th>Supuesto</th><th>\(g_k(x)\)</th><th>Frontera</th></tr>
        <tr><td>QDA</td><td>\(\Sigma_k\) distinta por clase</td><td>la expresión completa</td><td>cuadrática</td></tr>
        <tr><td>LDA</td><td>\(\Sigma_k = \Sigma\) común</td><td>\(w_k^\top x + b_k\), con \(w_k = \Sigma^{-1}\mu_k\)</td><td>lineal</td></tr>
        <tr><td>Mahalanobis</td><td>\(\Sigma\) común, priores iguales</td><td>\(-d_M(x, \mu_k)^2\)</td><td>lineal</td></tr>
        <tr><td>Euclidiana</td><td>\(\Sigma = \sigma^2 I\), priores iguales</td><td>\(-\lVert x - \mu_k\rVert^2\)</td><td>mediatrices</td></tr>
      </table>
      <p>En LDA, el término \(x^\top \Sigma^{-1} x\) es el mismo para todas las clases y se cancela: por eso la frontera es lineal. Con dos
      clases, su normal es \(\Sigma^{-1}(\mu_1 - \mu_0)\), la <a href="tema.html?id=fisher">dirección de Fisher</a>.</p>
      <h2>Estimación</h2>
      <pre><code>para cada clase k:
    μ_k ← media de sus muestras;   Σ_k ← covarianza de sus muestras
    P(ω_k) ← n_k / n
Σ ← Σ_k (n_k − 1) Σ_k / (n − K)          (covarianza combinada, para LDA)
clasificar x:  argmax_k g_k(x)</code></pre>
      <h2>Sesgo y varianza</h2>
      <p>En \(d\) dimensiones, QDA estima \(K\) matrices con \(d(d+1)/2\) parámetros cada una; LDA, una sola. Con pocos datos o muchas
      características, las covarianzas de QDA son ruidosas o singulares, y LDA (más rígido) generaliza mejor aunque su supuesto sea
      falso. El análisis discriminante regularizado (Friedman, 1989) interpola entre ambos con
      \(\Sigma_k(\alpha) = \alpha \Sigma_k + (1 - \alpha)\Sigma\), y además encoge hacia la diagonal.</p>`,
  });
})();
