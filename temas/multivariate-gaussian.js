(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const plano2 = (l, R = 3.2) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return VIZ.plano(l, { xmin: -R * a, xmax: R * a, ymin: -R, ymax: R }, { etiquetaX: 'x₁', etiquetaY: 'x₂', margen: { izq: 40 } }); };
  const sigma = (s1, s2, r) => [[s1 * s1, r * s1 * s2], [r * s1 * s2, s2 * s2]];
  function fondoDensidad(ctx, pl, mu, S, paso = 5) {
    const pmax = M.gauss2(mu[0], mu[1], mu, S);
    for (let px = pl.x0; px < pl.x1; px += paso) for (let py = pl.y1; py < pl.y0; py += paso) {
      const v = M.gauss2(pl.ix(px + paso / 2), pl.iy(py + paso / 2), mu, S) / pmax;
      if (v < 0.01) continue;
      ctx.globalAlpha = 0.15 + 0.6 * v; ctx.fillStyle = VIZ.css(VIZ.enRampa(v));
      ctx.fillRect(px, py, paso, paso); ctx.globalAlpha = 1;
    }
  }

  /* ---------- Fig. 1: la forma de Σ ---------- */

  function montarForma(cuerpo) {
    let s1 = 1.4, s2 = 0.7, r = 0.6, muestras = true, semilla = 1, Z = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'σ₁', min: 0.2, max: 2, paso: 0.05, valor: s1, formato: (v) => v.toFixed(2), alCambiar: (v) => { s1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'σ₂', min: 0.2, max: 2, paso: 0.05, valor: s2, formato: (v) => v.toFixed(2), alCambiar: (v) => { s2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Correlación ρ', min: -0.95, max: 0.95, paso: 0.05, valor: r, formato: (v) => v.toFixed(2), alCambiar: (v) => { r = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'mostrar 300 muestras', valor: muestras, alCambiar: (v) => { muestras = v; dibujar(); } });
    ctl.boton('Nuevas muestras', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.9)), texto: 'densidad alta' },
      { color: C.s7, texto: 'elipses de Mahalanobis 1, 2 y 3', forma: 'linea' },
      { color: C.s2, texto: 'ejes: vectores propios × √λ', forma: 'linea' },
      { color: C.tinta2, texto: 'muestra', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor: compare la distancia euclidiana al centro con la de Mahalanobis. Dos puntos a la misma distancia euclidiana pueden estar a 1 o a 3 «desviaciones» según la dirección.');
    function generar() { const rnd = VIZ.semilla(semilla); Z = Array.from({ length: 300 }, () => [VIZ.normal(rnd), VIZ.normal(rnd)]); dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = plano2(lienzo);
      const S = sigma(s1, s2, r), mu = [0, 0];
      fondoDensidad(ctx, pl, mu, S);
      pl.ejes();
      if (muestras) {
        // x = L z con L la factorización de Cholesky de Σ.
        const L = [[s1, 0], [r * s2, s2 * Math.sqrt(1 - r * r)]];
        ctx.fillStyle = C.tinta2;
        for (const z of Z) { const x = L[0][0] * z[0], y = L[1][0] * z[0] + L[1][1] * z[1]; ctx.beginPath(); ctx.arc(pl.sx(x), pl.sy(y), 1.8, 0, 2 * Math.PI); ctx.fill(); }
      }
      for (const k of [1, 2, 3]) M.elipse(ctx, pl, mu, S, k, C.s7, { ancho: k === 1 ? 2.5 : 1.5, guiones: k === 1 ? null : [5, 4] });
      const { valores, vectores } = M.eigSim(S);
      vectores.forEach((v, j) => { const l = Math.sqrt(valores[j]); VIZ.trazar(ctx, pl, [[-v[0] * l, -v[1] * l], [v[0] * l, v[1] * l]], C.s2, 2.5); });
      lectura.set([
        ['Σ', `[[${VIZ.fmt(S[0][0], 3)}, ${VIZ.fmt(S[0][1], 3)}], [${VIZ.fmt(S[1][0], 3)}, ${VIZ.fmt(S[1][1], 3)}]]`],
        ['valores propios λ₁, λ₂', `${VIZ.fmt(valores[0], 3)}, ${VIZ.fmt(valores[1], 3)}`],
        ['det Σ (área² de la elipse)', VIZ.fmt(M.det2(S), 3)],
        ['masa dentro de la elipse 1 · 2 · 3', '39,3 % · 86,5 % · 98,9 %'],
      ]);
    }
    lienzo.alDibujar = () => Z.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const a = pl.ix(x), b = pl.iy(y), S = sigma(s1, s2, r);
      tip.mostrar(x, y, `euclidiana <b>${VIZ.fmt(Math.hypot(a, b), 3)}</b><br>Mahalanobis <b>${VIZ.fmt(M.mahalanobis2(a, b, [0, 0], S), 3)}</b><br>densidad <b>${VIZ.fmt(M.gauss2(a, b, [0, 0], S), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: marginales y condicionales ---------- */

  function montarCondicional(cuerpo) {
    let r = 0.7, x0 = 1, s1 = 1, s2 = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Correlación ρ', min: -0.95, max: 0.95, paso: 0.05, valor: r, formato: (v) => v.toFixed(2), alCambiar: (v) => { r = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Observar x₁ = x₀', min: -2.5, max: 2.5, paso: 0.05, valor: x0, formato: (v) => v.toFixed(2), alCambiar: (v) => { x0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'σ₂', min: 0.3, max: 2, paso: 0.05, valor: s2, formato: (v) => v.toFixed(2), alCambiar: (v) => { s2 = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.3) : Math.min(380, Math.round(w * 0.4))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'corte x₁ = x₀', forma: 'linea' },
      { color: C.s6, texto: 'recta de regresión E[x₂ | x₁]', forma: 'linea' },
      { color: C.s1, texto: 'condicional p(x₂ | x₁ = x₀)', forma: 'linea' },
      { color: C.apagado, texto: 'marginal p(x₂)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Saber x₁ desplaza la media de x₂ a lo largo de la recta de regresión y achica su varianza en un factor 1 − ρ². Con ρ = 0, observar x₁ no cambia nada: independencia.');
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.55 : H;
      const S = sigma(s1, s2, r);
      ctx.save();
      const pl = plano2({ ...lienzo, ancho: wA, alto: hA, ctx }, 3.2);
      fondoDensidad(ctx, pl, [0, 0], S);
      pl.ejes();
      M.elipse(ctx, pl, [0, 0], S, 1, C.s7, { ancho: 1.5 }); M.elipse(ctx, pl, [0, 0], S, 2, C.s7, { ancho: 1.5, guiones: [5, 4] });
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, [[-6, (-6 * r * s2) / s1], [6, (6 * r * s2) / s1]], C.s6, 2);
      VIZ.trazar(ctx, pl, [[x0, -6], [x0, 6]], C.s4, 2.5);
      ctx.restore();
      ctx.restore();
      const mc = (r * s2 * x0) / s1, sc = s2 * Math.sqrt(1 - r * r);
      ctx.save();
      const ox = vertical ? 0 : wA, oy = vertical ? hA : 0;
      ctx.translate(ox, oy);
      const sub = { ...lienzo, ancho: vertical ? W : W - wA, alto: vertical ? H - hA : H, ctx };
      const ymax = M.normalPdf(0, 0, sc) * 1.1;
      const pd = VIZ.plano(sub, { xmin: -3.2, xmax: 3.2, ymin: 0, ymax }, { etiquetaX: 'x₂', etiquetaY: 'densidad' });
      pd.ejes();
      const curva = (m, s) => Array.from({ length: 161 }, (_, i) => { const v = -3.2 + (i * 6.4) / 160; return [v, M.normalPdf(v, m, s)]; });
      VIZ.trazar(ctx, pd, curva(0, s2), C.apagado, 2, [5, 4]);
      VIZ.trazar(ctx, pd, curva(mc, sc), C.s1, 2.5);
      VIZ.trazar(ctx, pd, [[mc, 0], [mc, M.normalPdf(mc, mc, sc)]], C.s1, 1, [2, 3]);
      ctx.restore();
      geo = { pd, ox, oy, mc, sc };
      lectura.set([
        ['E[x₂ | x₁ = x₀] = ρ σ₂/σ₁ · x₀', VIZ.fmt(mc, 3)],
        ['sd(x₂ | x₁) = σ₂ √(1 − ρ²)', VIZ.fmt(sc, 3)],
        ['sd marginal σ₂', VIZ.fmt(s2, 3)],
        ['varianza explicada por x₁', M.pct(r * r, 0)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.pd.dentro(x - geo.ox, y - geo.oy)) return tip.ocultar();
      const v = geo.pd.ix(x - geo.ox);
      tip.mostrar(x, y, `x₂ = <b>${VIZ.fmt(v, 3)}</b>` + VIZ.filaTooltip(C.s1, 'condicional', VIZ.fmt(M.normalPdf(v, geo.mc, geo.sc), 3)) + VIZ.filaTooltip(C.apagado, 'marginal', VIZ.fmt(M.normalPdf(v, 0, s2), 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('multivariate-gaussian', {
    intro: String.raw`
      <p>La <strong>distribución gaussiana multivariada</strong> es la generalización de la campana a varias dimensiones. Queda
      descrita por un vector de medias \(\mu\) y una <strong>matriz de covarianza</strong> \(\Sigma\), que dice cuánto varía cada
      variable y cuánto varían juntas.</p>
      <p>Sus curvas de nivel son elipses: \(\Sigma\) fija su tamaño, su orientación y su excentricidad. Es la pieza básica de los
      <a href="tema.html?id=gaussian-mixture-models">modelos de mezcla</a>, de <a href="tema.html?id=lda-qda">LDA y QDA</a> y del
      análisis de <a href="tema.html?id=pca">componentes principales</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'La forma de Σ',
        descripcion: 'Mueva las desviaciones y la correlación y observe cómo giran y se estiran las elipses. Los ejes de la elipse son los vectores propios de Σ.',
        montar: montarForma,
      },
      {
        titulo: 'Marginales y condicionales',
        descripcion: 'Fije un valor de x₁ y compare la distribución de x₂ antes y después de observarlo.',
        montar: montarCondicional,
      },
    ],
    teoria: String.raw`
      <h2>Densidad</h2>
      \[ \mathcal{N}(x \mid \mu, \Sigma) = \frac{1}{(2\pi)^{d/2} |\Sigma|^{1/2}} \exp\!\Bigl(-\tfrac12 (x - \mu)^\top \Sigma^{-1} (x - \mu)\Bigr). \]
      <p>El exponente es la <strong>distancia de Mahalanobis</strong> al cuadrado, \(\Delta^2 = (x - \mu)^\top \Sigma^{-1}(x - \mu)\): los puntos
      con igual \(\Delta\) forman una elipse. Con \(\Sigma = V \Lambda V^\top\), los ejes de la elipse son las columnas de \(V\) y sus
      semiejes miden \(\Delta\sqrt{\lambda_i}\).</p>
      <p>En 2-D, \(\Delta^2\) sigue una \(\chi^2_2\), así que la masa dentro de la elipse \(\Delta = k\) es \(1 - e^{-k^2/2}\): 39,3 %, 86,5 % y 98,9 % para \(k = 1, 2, 3\).</p>
      <h2>Covarianza en 2-D</h2>
      \[ \Sigma = \begin{pmatrix} \sigma_1^2 &amp; \rho\sigma_1\sigma_2 \\ \rho\sigma_1\sigma_2 &amp; \sigma_2^2 \end{pmatrix}, \qquad |\rho| &lt; 1. \]
      <p>\(\Sigma\) debe ser simétrica y definida positiva. Los modelos suelen restringirla para tener menos parámetros:</p>
      <table>
        <tr><th>Tipo</th><th>Forma</th><th>Parámetros en \(d\) dimensiones</th></tr>
        <tr><td>Esférica</td><td>\(\sigma^2 I\)</td><td>1</td></tr>
        <tr><td>Diagonal</td><td>\(\operatorname{diag}(\sigma_1^2, \dots, \sigma_d^2)\)</td><td>\(d\)</td></tr>
        <tr><td>Completa</td><td>cualquiera</td><td>\(d(d+1)/2\)</td></tr>
      </table>
      <h2>Marginales y condicionales</h2>
      <p>Si \(x = (x_a, x_b)\) es gaussiana, ambas marginales y las condicionales también lo son:</p>
      \[ x_b \mid x_a \sim \mathcal{N}\bigl(\mu_b + \Sigma_{ba}\Sigma_{aa}^{-1}(x_a - \mu_a),\ \ \Sigma_{bb} - \Sigma_{ba}\Sigma_{aa}^{-1}\Sigma_{ab}\bigr). \]
      <p>La media condicional es lineal en \(x_a\) (la recta de regresión) y la covarianza condicional no depende del valor observado.
      Para gaussianas, correlación cero equivale a independencia; en general, no.</p>
      <h2>Muestrear</h2>
      <p>Con la factorización de Cholesky \(\Sigma = LL^\top\) y \(z \sim \mathcal N(0, I)\), \(x = \mu + Lz\) tiene distribución \(\mathcal N(\mu, \Sigma)\).</p>`,
  });
})();