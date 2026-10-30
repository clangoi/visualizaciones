(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const MU_REAL = 2, SD_REAL = 1.2;
  const muestra = (n, semilla) => { const rnd = VIZ.semilla(semilla); return Array.from({ length: n }, () => MU_REAL + SD_REAL * VIZ.normal(rnd)); };
  const logv = (x, mu, s) => M.suma(x.map((v) => Math.log(M.normalPdf(v, mu, s))));
  const mle = (x) => { const m = M.media(x); return [m, Math.sqrt(M.media(x.map((v) => (v - m) ** 2)))]; };

  /* ---------- Fig. 1: ajustar a mano ---------- */

  function montarAjuste(cuerpo) {
    let n = 12, semilla = 1, x = muestra(n, semilla), mu = 0.8, s = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Datos n', min: 2, max: 60, valor: n, alCambiar: (v) => { n = v; x = muestra(n, semilla); dibujar(); } });
    const rMu = ctl.rango({ etiqueta: 'μ', min: -2, max: 6, paso: 0.05, valor: mu, formato: (v) => v.toFixed(2), alCambiar: (v) => { mu = v; dibujar(); } });
    const rS = ctl.rango({ etiqueta: 'σ', min: 0.2, max: 4, paso: 0.02, valor: s, formato: (v) => v.toFixed(2), alCambiar: (v) => { s = v; dibujar(); } });
    ctl.boton('Ir al máximo', () => { [mu, s] = mle(x); rMu.valor = mu; rS.valor = s; dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; x = muestra(n, semilla); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'densidad propuesta N(μ, σ²)', forma: 'linea' },
      { color: C.s2, texto: 'verosimilitud de cada dato: p(xᵢ | μ, σ)', forma: 'linea' },
      { color: C.tinta, texto: 'dato', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La verosimilitud es el producto de las alturas naranjas. Mueva μ y σ para hacerlo lo más grande posible: una campana muy angosta deja datos sin altura; una muy ancha, a todos bajos.');
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -3, xmax: 7, ymin: 0, ymax: 0.75 }, { etiquetaX: 'x', etiquetaY: 'densidad' });
      pl.ejes();
      VIZ.trazar(ctx, pl, Array.from({ length: 201 }, (_, i) => { const v = -3 + i * 0.05; return [v, M.normalPdf(v, mu, s)]; }), C.s1, 2.5);
      for (const v of x) VIZ.trazar(ctx, pl, [[v, 0], [v, M.normalPdf(v, mu, s)]], C.s2, 2);
      for (const v of x) VIZ.marcador(ctx, pl.sx(v), pl.y0, C.tinta, 4);
      const [m, sm] = mle(x);
      lectura.set([
        ['log-verosimilitud ℓ(μ, σ)', VIZ.fmt(logv(x, mu, s), 4)],
        ['máximo posible de ℓ', VIZ.fmt(logv(x, m, sm), 4)],
        ['μ estimada = media', VIZ.fmt(m, 3)],
        ['σ estimada = √(Σ(xᵢ − x̄)²/n)', VIZ.fmt(sm, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: px, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(px, y)) return tip.ocultar();
      const v = pl.ix(px), c = x.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
      tip.mostrar(px, y, `dato más cercano x = <b>${VIZ.fmt(c, 3)}</b><br>p(x | μ, σ) = <b>${VIZ.fmt(M.normalPdf(c, mu, s), 3)}</b><br>log p = <b>${VIZ.fmt(Math.log(M.normalPdf(c, mu, s)), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: la superficie de log-verosimilitud ---------- */

  function montarSuperficie(cuerpo) {
    let n = 15, semilla = 3, x = muestra(n, semilla), sel = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Datos n', min: 3, max: 400, valor: n, alCambiar: (v) => { n = v; x = muestra(n, semilla); dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; x = muestra(n, semilla); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'ℓ cerca del máximo' },
      { color: C.s7, texto: 'curvas ℓ = máx − 0,5 · 2 · 4.5', forma: 'linea' },
      { color: C.s6, texto: 'estimador de máxima verosimilitud', forma: 'punto' },
      { color: C.s2, texto: 'parámetros reales (μ = 2, σ = 1,2)', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La curva interior (ℓ = máx − 0,5) encierra aproximadamente una región de confianza del 39 %; la de −2, del 86 %. Suba n: la superficie se vuelve un pico angosto y el estimador se acerca al valor real. Haga clic para ver ℓ en otro punto.');
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0.4, ymax: 2.6 }, { etiquetaX: 'μ', etiquetaY: 'σ', margen: { izq: 44 } });
      const [m, sm] = mle(x), lmax = logv(x, m, sm);
      const paso = 6;
      for (let px = pl.x0; px < pl.x1; px += paso) for (let py = pl.y1; py < pl.y0; py += paso) {
        const d = lmax - logv(x, pl.ix(px + paso / 2), pl.iy(py + paso / 2));
        ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.exp(-d / 6)));
        ctx.globalAlpha = 0.85; ctx.fillRect(px, py, paso, paso); ctx.globalAlpha = 1;
      }
      pl.ejes();
      ctx.save(); pl.recortar();
      for (const c of [0.5, 2, 4.5]) VIZ.ml.contorno(ctx, pl, (a, b) => lmax - logv(x, a, b), c, { color: C.s7, ancho: c === 0.5 ? 2 : 1.5, guiones: c === 0.5 ? null : [4, 3] });
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(MU_REAL), pl.sy(SD_REAL), C.s2, 5, 1);
      VIZ.marcador(ctx, pl.sx(m), pl.sy(sm), C.s6, 6);
      if (sel) VIZ.marcador(ctx, pl.sx(sel[0]), pl.sy(sel[1]), C.tinta, 4);
      lectura.set([
        ['μ estimada ± error estándar σ/√n', `${VIZ.fmt(m, 3)} ± ${VIZ.fmt(sm / Math.sqrt(n), 3)}`],
        ['σ estimada ± σ/√(2n)', `${VIZ.fmt(sm, 3)} ± ${VIZ.fmt(sm / Math.sqrt(2 * n), 3)}`],
        ['ℓ máxima', VIZ.fmt(lmax, 4)],
        ['punto elegido: ℓ − máx', sel ? VIZ.fmt(logv(x, sel[0], sel[1]) - lmax, 3) : '— (haga clic)'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => { const { x: px, y } = lienzo.posicion(ev); if (pl && pl.dentro(px, y)) { sel = [pl.ix(px), pl.iy(y)]; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: px, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(px, y)) return tip.ocultar();
      const a = pl.ix(px), b = pl.iy(y);
      tip.mostrar(px, y, `μ = <b>${VIZ.fmt(a, 3)}</b>, σ = <b>${VIZ.fmt(b, 3)}</b><br>ℓ = <b>${VIZ.fmt(logv(x, a, b), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('maximum-likelihood', {
    intro: String.raw`
      <p>Tenemos datos y una familia de modelos con parámetros, por ejemplo una normal con media \(\mu\) y desviación \(\sigma\).
      ¿Qué parámetros elegir? La <strong>máxima verosimilitud</strong> (MLE) responde: los que hacen <strong>más probables los datos
      observados</strong>.</p>
      <p>Es el principio de estimación más usado en estadística y aprendizaje automático: está detrás de mínimos cuadrados, de la
      regresión logística y del algoritmo EM de las <a href="tema.html?id=gaussian-mixture-models">mezclas gaussianas</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Ajustar a mano',
        descripcion: 'Cada dato «vota» con la altura de la densidad en su posición. Busque μ y σ que maximicen el producto y luego compare con «Ir al máximo».',
        montar: montarAjuste,
      },
      {
        titulo: 'La superficie de log-verosimilitud',
        descripcion: 'ℓ(μ, σ) sobre todo el plano de parámetros. Observe cómo se angosta el pico al crecer n.',
        montar: montarSuperficie,
      },
    ],
    teoria: String.raw`
      <h2>Verosimilitud</h2>
      <p>Para datos independientes \(x_1, \dots, x_n\) con densidad \(p(x \mid \theta)\):</p>
      \[ L(\theta) = \prod_{i=1}^n p(x_i \mid \theta), \qquad \ell(\theta) = \log L(\theta) = \sum_{i=1}^n \log p(x_i \mid \theta), \qquad
         \hat\theta_{\text{MLE}} = \arg\max_\theta \ell(\theta). \]
      <p>\(L\) no es una probabilidad sobre \(\theta\): es una función de \(\theta\) con los datos fijos. Se maximiza el logaritmo porque
      convierte productos en sumas y evita números diminutos.</p>
      <h2>Caso normal</h2>
      \[ \ell(\mu, \sigma) = -\frac{n}{2}\log(2\pi\sigma^2) - \frac{1}{2\sigma^2}\sum_i (x_i - \mu)^2. \]
      <p>Igualando las derivadas a cero:</p>
      \[ \hat\mu = \bar x, \qquad \hat\sigma^2 = \frac1n \sum_i (x_i - \bar x)^2. \]
      <p>\(\hat\sigma^2\) divide por \(n\), no por \(n - 1\): es <strong>sesgado</strong> (\(\mathbb E[\hat\sigma^2] = \tfrac{n-1}{n}\sigma^2\)), aunque el sesgo
      desaparece con \(n\) grande. Maximizar \(\ell\) en \(\mu\) es minimizar \(\sum (x_i - \mu)^2\): mínimos cuadrados es MLE con ruido gaussiano.</p>
      <h2>Propiedades asintóticas</h2>
      <p>Bajo condiciones de regularidad, con \(n \to \infty\):</p>
      <ul>
        <li><strong>Consistencia</strong>: \(\hat\theta \to \theta\).</li>
        <li><strong>Normalidad</strong>: \(\hat\theta \approx \mathcal N\bigl(\theta, I(\theta)^{-1}/n\bigr)\), con \(I\) la información de Fisher (la curvatura
        esperada de \(-\ell\)). Para la media normal, el error estándar es \(\sigma/\sqrt n\).</li>
        <li><strong>Eficiencia</strong>: alcanza la cota de Cramér–Rao.</li>
        <li><strong>Invarianza</strong>: el MLE de \(g(\theta)\) es \(g(\hat\theta)\).</li>
      </ul>
      <p>La región \(\{\theta : \ell(\hat\theta) - \ell(\theta) \le c\}\) es un intervalo de confianza basado en la razón de verosimilitudes;
      con un parámetro, \(c = 1{,}92\) da el 95 %.</p>
      <h2>Límites</h2>
      <p>Con pocos datos el MLE sobreajusta (un solo dato da \(\hat\sigma = 0\)), y en mezclas la verosimilitud puede crecer sin límite si una
      componente se colapsa sobre un punto. Añadir información previa lleva a la <a href="tema.html?id=bayesian-estimation">estimación bayesiana</a>.</p>`,
  });
})();