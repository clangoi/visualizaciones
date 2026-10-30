(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // log Γ(z) por la aproximación de Lanczos.
  const G = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    G.forEach((g, i) => { x += g / (z + i + 1); });
    const t = z + G.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  const betaPdf = (p, a, b) => (p <= 0 || p >= 1 ? 0 : Math.exp((a - 1) * Math.log(p) + (b - 1) * Math.log(1 - p) + lgamma(a + b) - lgamma(a) - lgamma(b)));
  // Intervalo central de probabilidad q de una densidad evaluada en una rejilla.
  function intervalo(xs, f, q = 0.95) {
    const dx = xs[1] - xs[0], acum = [];
    let s = 0;
    for (const v of f) { s += v * dx; acum.push(s); }
    const lo = xs[acum.findIndex((v) => v >= (s * (1 - q)) / 2)], hi = xs[acum.findIndex((v) => v >= s * (1 - (1 - q) / 2))];
    return [lo, hi];
  }

  /* ---------- Fig. 1: moneda con prior beta ---------- */

  function montarMoneda(cuerpo) {
    let a = 2, b = 2, pReal = 0.7, caras = 0, sellos = 0, semilla = 1, rnd = VIZ.semilla(1);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Prior a (caras previas + 1)', min: 0.5, max: 30, paso: 0.5, valor: a, formato: (v) => v.toFixed(1), alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Prior b (sellos previos + 1)', min: 0.5, max: 30, paso: 0.5, valor: b, formato: (v) => v.toFixed(1), alCambiar: (v) => { b = v; dibujar(); } });
    ctl.rango({ etiqueta: 'p real de la moneda', min: 0.05, max: 0.95, paso: 0.05, valor: pReal, formato: (v) => v.toFixed(2), alCambiar: (v) => { pReal = v; } });
    const lanzar = (k) => { for (let i = 0; i < k; i++) (rnd() < pReal ? caras++ : sellos++); dibujar(); };
    ctl.boton('Lanzar 1', () => lanzar(1), { primario: true });
    ctl.boton('Lanzar 10', () => lanzar(10));
    ctl.boton('Lanzar 100', () => lanzar(100));
    ctl.boton('Reiniciar', () => { caras = 0; sellos = 0; semilla++; rnd = VIZ.semilla(semilla); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'prior Beta(a, b)', forma: 'linea' },
      { color: C.s2, texto: 'verosimilitud (normalizada)', forma: 'linea' },
      { color: C.s1, texto: 'posterior Beta(a + caras, b + sellos)', forma: 'linea' },
      { color: C.s6, texto: 'p real', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El posterior es un compromiso entre el prior y la verosimilitud. Con pocos lanzamientos domina el prior; con muchos, los datos. Pruebe un prior fuerte equivocado (a = 30, b = 2 con p real 0,3).');
    const xs = Array.from({ length: 401 }, (_, i) => i / 400);
    let pl = null, curvas = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pri = xs.map((p) => betaPdf(p, a, b)), ver = xs.map((p) => betaPdf(p, caras + 1, sellos + 1)), pos = xs.map((p) => betaPdf(p, a + caras, b + sellos));
      curvas = { pri, ver, pos };
      const ymax = Math.min(40, Math.max(...pri, ...ver, ...pos)) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax }, { etiquetaX: 'p = probabilidad de cara', etiquetaY: 'densidad' });
      pl.ejes();
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, [[pReal, 0], [pReal, ymax]], C.s6, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, xs.map((p, i) => [p, pri[i]]), C.apagado, 2, [5, 4]);
      if (caras + sellos) VIZ.trazar(ctx, pl, xs.map((p, i) => [p, ver[i]]), C.s2, 2);
      const [lo, hi] = intervalo(xs, pos);
      ctx.fillStyle = VIZ.alfa(C.s1, 0.15); ctx.beginPath(); ctx.moveTo(pl.sx(lo), pl.sy(0));
      xs.forEach((p, i) => { if (p >= lo && p <= hi) ctx.lineTo(pl.sx(p), pl.sy(pos[i])); });
      ctx.lineTo(pl.sx(hi), pl.sy(0)); ctx.fill();
      VIZ.trazar(ctx, pl, xs.map((p, i) => [p, pos[i]]), C.s1, 2.5);
      ctx.restore();
      const A = a + caras, B = b + sellos;
      lectura.set([
        ['caras · sellos', `${caras} · ${sellos}`],
        ['MLE caras/n', caras + sellos ? VIZ.fmt(caras / (caras + sellos), 3) : '—'],
        ['media posterior · MAP', `${VIZ.fmt(A / (A + B), 3)} · ${A > 1 && B > 1 ? VIZ.fmt((A - 1) / (A + B - 2), 3) : '—'}`],
        ['intervalo creíble 95 % (sombreado)', `[${VIZ.fmt(lo, 3)}, ${VIZ.fmt(hi, 3)}]`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.round(pl.ix(x) * 400);
      tip.mostrar(x, y, `p = <b>${VIZ.fmt(xs[i], 3)}</b>` + VIZ.filaTooltip(C.apagado, 'prior', VIZ.fmt(curvas.pri[i], 3)) + VIZ.filaTooltip(C.s2, 'verosimilitud', VIZ.fmt(curvas.ver[i], 3)) + VIZ.filaTooltip(C.s1, 'posterior', VIZ.fmt(curvas.pos[i], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: la media con varianza conocida ---------- */

  function montarMedia(cuerpo) {
    let mu0 = 0, tau0 = 1, muReal = 3, semilla = 1, hover = null;
    const s = 2, N = 100;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Media del prior μ₀', min: -4, max: 6, paso: 0.1, valor: mu0, formato: (v) => v.toFixed(1), alCambiar: (v) => { mu0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Desviación del prior τ₀', min: 0.1, max: 5, paso: 0.1, valor: tau0, formato: (v) => v.toFixed(1), alCambiar: (v) => { tau0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'μ real', min: -2, max: 5, paso: 0.1, valor: muReal, formato: (v) => v.toFixed(1), alCambiar: (v) => { muReal = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'media posterior e intervalo creíble 95 %', forma: 'linea' },
      { color: C.s2, texto: 'MLE (media muestral) e intervalo de confianza 95 %', forma: 'linea' },
      { color: C.s6, texto: 'μ real', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Datos xᵢ ~ N(μ, 2²) que llegan de a uno. El posterior arranca en el prior y se mueve hacia la media muestral; con n grande ambos coinciden. Un τ₀ chico (prior seguro) tarda más en dejarse convencer.');
    let pl = null, filas = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(semilla), z = Array.from({ length: N }, () => VIZ.normal(rnd));
      filas = [];
      let sum = 0;
      for (let n = 1; n <= N; n++) {
        sum += muReal + s * z[n - 1];
        const xb = sum / n, prec = 1 / tau0 ** 2 + n / s ** 2, mp = (mu0 / tau0 ** 2 + (n * xb) / s ** 2) / prec, sp = Math.sqrt(1 / prec);
        filas.push({ n, xb, se: s / Math.sqrt(n), mp, sp, peso: (n / s ** 2) / prec });
      }
      const ys = filas.flatMap((f) => [f.mp - 2 * f.sp, f.mp + 2 * f.sp, f.xb - 2 * f.se, f.xb + 2 * f.se]);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: N, ymin: Math.max(-8, Math.min(...ys, muReal) - 0.3), ymax: Math.min(10, Math.max(...ys, muReal) + 0.3) }, { etiquetaX: 'n (datos observados)', etiquetaY: 'estimación de μ' });
      pl.ejes();
      const banda = (lo, hi, col) => { ctx.fillStyle = VIZ.alfa(col, 0.15); ctx.beginPath(); filas.forEach((f, i) => (i ? ctx.lineTo(pl.sx(f.n), pl.sy(lo(f))) : ctx.moveTo(pl.sx(f.n), pl.sy(lo(f))))); filas.slice().reverse().forEach((f) => ctx.lineTo(pl.sx(f.n), pl.sy(hi(f)))); ctx.fill(); };
      ctx.save(); pl.recortar();
      banda((f) => f.xb - 1.96 * f.se, (f) => f.xb + 1.96 * f.se, C.s2);
      banda((f) => f.mp - 1.96 * f.sp, (f) => f.mp + 1.96 * f.sp, C.s1);
      VIZ.trazar(ctx, pl, [[0, muReal], [N, muReal]], C.s6, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, filas.map((f) => [f.n, f.xb]), C.s2, 2);
      VIZ.trazar(ctx, pl, [[0, mu0], ...filas.map((f) => [f.n, f.mp])], C.s1, 2.5);
      ctx.restore();
      if (hover) { VIZ.marcador(ctx, pl.sx(hover.n), pl.sy(hover.mp), C.s1, 4); VIZ.marcador(ctx, pl.sx(hover.n), pl.sy(hover.xb), C.s2, 4); }
      const f5 = filas[4], fN = filas[N - 1];
      lectura.set([
        ['n = 5: posterior · MLE', `${VIZ.fmt(f5.mp, 3)} · ${VIZ.fmt(f5.xb, 3)}`],
        ['n = 100: posterior · MLE', `${VIZ.fmt(fN.mp, 3)} · ${VIZ.fmt(fN.xb, 3)}`],
        ['peso de los datos con n = 5', M.pct(f5.peso, 0)],
        ['n equivalente del prior σ²/τ₀²', VIZ.fmt(s ** 2 / tau0 ** 2, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = filas[Math.max(0, Math.min(N - 1, Math.round(pl.ix(x)) - 1))];
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover.n}</b>` + VIZ.filaTooltip(C.s1, 'posterior', `${VIZ.fmt(hover.mp, 3)} ± ${VIZ.fmt(1.96 * hover.sp, 3)}`) + VIZ.filaTooltip(C.s2, 'MLE', `${VIZ.fmt(hover.xb, 3)} ± ${VIZ.fmt(1.96 * hover.se, 3)}`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bayesian-estimation', {
    intro: String.raw`
      <p>La <a href="tema.html?id=maximum-likelihood">máxima verosimilitud</a> entrega un solo valor para cada parámetro. La
      <strong>inferencia bayesiana</strong> trata el parámetro como incierto: parte de una distribución <strong>a priori</strong> que
      resume lo que se sabe antes de ver datos y la actualiza con el teorema de Bayes hasta una distribución <strong>a posteriori</strong>.</p>
      <p>El resultado no es un número sino una distribución completa, de la que salen estimaciones puntuales e intervalos que
      se interpretan directamente como probabilidades sobre el parámetro.</p>`,
    visualizaciones: [
      {
        titulo: 'Una moneda con prior beta',
        descripcion: 'Lance la moneda y vea cómo el posterior se angosta alrededor de la proporción real. Cambie el prior para ver cuánto pesa con pocos datos.',
        montar: montarMoneda,
      },
      {
        titulo: 'La media con varianza conocida',
        descripcion: 'Estimación bayesiana y MLE de una media a medida que llegan los datos, con sus intervalos del 95 %.',
        montar: montarMedia,
      },
    ],
    teoria: String.raw`
      <h2>Teorema de Bayes para parámetros</h2>
      \[ p(\theta \mid D) = \frac{p(D \mid \theta)\, p(\theta)}{p(D)} \propto \text{verosimilitud} \times \text{prior}, \qquad p(D) = \int p(D \mid \theta)\,p(\theta)\,d\theta. \]
      <p>De la posterior se resumen: la <strong>media posterior</strong> (minimiza el error cuadrático esperado), el <strong>MAP</strong>
      (la moda, \(\arg\max_\theta p(\theta \mid D)\)) y un <strong>intervalo creíble</strong> \([a, b]\) con \(\Pr(a \le \theta \le b \mid D) = 0{,}95\).</p>
      <h2>Beta–binomial</h2>
      <p>Con prior \(\operatorname{Beta}(a, b)\) y \(k\) caras en \(n\) lanzamientos, la posterior es \(\operatorname{Beta}(a + k,\ b + n - k)\):</p>
      \[ \mathbb E[p \mid D] = \frac{a + k}{a + b + n}, \qquad \hat p_{\text{MAP}} = \frac{a + k - 1}{a + b + n - 2}. \]
      <p>El prior actúa como \(a - 1\) caras y \(b - 1\) sellos ya vistos. Con \(a = b = 1\) (uniforme), el MAP coincide con el MLE \(k/n\);
      la media posterior \((k + 1)/(n + 2)\) es la «regla de sucesión» de Laplace.</p>
      <h2>Normal con varianza conocida</h2>
      <p>Prior \(\mu \sim \mathcal N(\mu_0, \tau_0^2)\), datos \(x_i \sim \mathcal N(\mu, \sigma^2)\). La posterior es normal con <strong>precisiones</strong> que se suman:</p>
      \[ \frac{1}{\tau_n^2} = \frac{1}{\tau_0^2} + \frac{n}{\sigma^2}, \qquad
         \mu_n = \tau_n^2\Bigl(\frac{\mu_0}{\tau_0^2} + \frac{n\,\bar x}{\sigma^2}\Bigr). \]
      <p>La media posterior es un promedio ponderado entre \(\mu_0\) y \(\bar x\); el peso de los datos, \(\frac{n/\sigma^2}{1/\tau_0^2 + n/\sigma^2}\),
      tiende a 1. Es el fenómeno de <em>contracción</em> (<em>shrinkage</em>) hacia el prior.</p>
      <h2>Prior conjugado</h2>
      <p>Cuando prior y posterior son de la misma familia (beta–binomial, normal–normal, Dirichlet–multinomial, gamma–Poisson) la
      actualización es una fórmula cerrada. En otros casos se aproxima la posterior con MCMC o métodos variacionales.</p>
      <table>
        <tr><th></th><th>MLE</th><th>Bayes</th></tr>
        <tr><td>Parámetro</td><td>fijo y desconocido</td><td>variable aleatoria</td></tr>
        <tr><td>Resultado</td><td>\(\hat\theta\) y su error estándar</td><td>\(p(\theta \mid D)\)</td></tr>
        <tr><td>Intervalo</td><td>de confianza: cubre \(\theta\) en el 95 % de las repeticiones</td><td>creíble: \(\theta\) está ahí con prob. 0,95</td></tr>
        <tr><td>Pocos datos</td><td>puede sobreajustar</td><td>el prior regulariza</td></tr>
      </table>
      <p>En las <a href="tema.html?id=gaussian-mixture-models">mezclas gaussianas</a>, la probabilidad de pertenencia de cada punto es
      también una posterior: \(p(\text{componente} \mid x)\).</p>`,
  });
})();