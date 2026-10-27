(function () {
  'use strict';
  const { color: C } = VIZ;
  const XMIN = -4, XMAX = 6, N = 501;

  // Estado compartido por las dos figuras.
  const op = { p1: 0.5, mu1: 0, s1: 1, mu2: 2, s2: 1, c12: 1, c21: 1 };
  const oyentes = [];
  const avisar = () => oyentes.forEach((f) => f());

  const gauss = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
  const Phi = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));
  const xs = Array.from({ length: N }, (_, i) => XMIN + ((XMAX - XMIN) * i) / (N - 1));

  // Densidades ponderadas, posteriores y la decisión de mínimo riesgo en cada x.
  function modelo() {
    const f1 = xs.map((x) => op.p1 * gauss(x, op.mu1, op.s1)), f2 = xs.map((x) => (1 - op.p1) * gauss(x, op.mu2, op.s2));
    const post1 = f1.map((v, i) => v / (v + f2[i] || 1e-300));
    // Decidir ω₁ si c₁₂·P(ω₁|x) > c₂₁·P(ω₂|x): equivocarse con un ω₁ cuesta c₁₂.
    const decide1 = f1.map((v, i) => op.c12 * v >= op.c21 * f2[i]);
    const umbrales = [];
    for (let i = 1; i < N; i++) if (decide1[i] !== decide1[i - 1]) umbrales.push((xs[i] + xs[i - 1]) / 2);
    const dx = xs[1] - xs[0];
    let e1 = 0, e2 = 0;
    for (let i = 0; i < N; i++) { if (!decide1[i]) e1 += f1[i] * dx; else e2 += f2[i] * dx; }
    return { f1, f2, post1, decide1, umbrales, e1, e2, riesgo: op.c12 * e1 + op.c21 * e2 };
  }

  /* ---------- Fig. 1: la regla de decisión ---------- */

  function montarRegla(cuerpo) {
    const ctl = VIZ.controles(cuerpo);
    const r = (etiqueta, clave, min, max, paso) => ctl.rango({ etiqueta, min, max, paso, valor: op[clave], formato: (v) => v.toFixed(2), alCambiar: (v) => { op[clave] = v; avisar(); } });
    r('A priori P(ω₁)', 'p1', 0.02, 0.98, 0.01);
    r('Media de ω₂', 'mu2', -1, 5, 0.05);
    r('σ de ω₁', 's1', 0.3, 2.5, 0.05);
    r('σ de ω₂', 's2', 0.3, 2.5, 0.05);
    r('Costo de decidir ω₂ si es ω₁ (c₁₂)', 'c12', 0.1, 10, 0.1);
    r('Costo de decidir ω₁ si es ω₂ (c₂₁)', 'c21', 0.1, 10, 0.1);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.36, altoMin: 220, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Probabilidades a posteriori');
    const lienzoP = VIZ.lienzo(cuerpo, { proporcion: 0.2, altoMin: 140, altoMax: 180 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'P(ω₁)·p(x | ω₁) y P(ω₁ | x)', forma: 'linea' },
      { color: C.s2, texto: 'P(ω₂)·p(x | ω₂) y P(ω₂ | x)', forma: 'linea' },
      { color: C.tinta, texto: 'umbral de decisión', forma: 'linea' },
      { color: C.s8, texto: 'probabilidad de error (área)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La franja bajo el eje muestra qué clase se decide en cada x. Haga σ de ω₂ mucho mayor que σ de ω₁: aparecen dos umbrales, porque lejos en ambas colas gana la clase más ancha.');

    let plano = null, M = null;
    function dibujar() {
      M = modelo();
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...M.f1, ...M.f2) * 1.12;
      plano = VIZ.plano(lienzo, { xmin: XMIN, xmax: XMAX, ymin: 0, ymax }, { etiquetaX: 'x', etiquetaY: 'P(ω)·p(x | ω)', margen: { izq: 46, inf: 50 } });
      plano.ejes();
      // Áreas de error: la clase verdadera queda del lado de la otra decisión.
      ctx.save();
      ctx.fillStyle = VIZ.alfa(C.s8, 0.3);
      ctx.beginPath();
      ctx.moveTo(plano.sx(XMIN), plano.y0);
      for (let i = 0; i < N; i++) ctx.lineTo(plano.sx(xs[i]), plano.sy(M.decide1[i] ? M.f2[i] : M.f1[i]));
      ctx.lineTo(plano.sx(XMAX), plano.y0);
      ctx.fill();
      // Franja de decisión.
      for (let i = 0; i < N - 1; i++) {
        ctx.fillStyle = M.decide1[i] ? C.s1 : C.s2;
        ctx.fillRect(plano.sx(xs[i]), plano.y0 + 26, plano.sx(xs[i + 1]) - plano.sx(xs[i]) + 0.5, 6);
      }
      ctx.restore();
      VIZ.trazar(ctx, plano, xs.map((x, i) => [x, M.f1[i]]), C.s1, 2);
      VIZ.trazar(ctx, plano, xs.map((x, i) => [x, M.f2[i]]), C.s2, 2);
      for (const u of M.umbrales) VIZ.trazar(ctx, plano, [[u, 0], [u, ymax]], C.tinta, 1.5, [5, 4]);
      dibujarP();
      lectura.set([
        ['umbrales', M.umbrales.map((u) => VIZ.fmt(u, 3)).join(', ') || 'ninguno'],
        ['error en la clase 1', VIZ.fmt(M.e1, 3)],
        ['error en la clase 2', VIZ.fmt(M.e2, 3)],
        ['probabilidad de error', VIZ.fmt(M.e1 + M.e2, 3)],
        ['riesgo esperado', VIZ.fmt(M.riesgo, 3)],
      ]);
    }
    function dibujarP() {
      const { ctx } = lienzoP;
      lienzoP.limpiar();
      const pl = VIZ.plano(lienzoP, { xmin: XMIN, xmax: XMAX, ymin: 0, ymax: 1 }, { etiquetaX: 'x', margen: { izq: 46 } });
      pl.ejes();
      VIZ.trazar(ctx, pl, xs.map((x, i) => [x, M.post1[i]]), C.s1, 2);
      VIZ.trazar(ctx, pl, xs.map((x, i) => [x, 1 - M.post1[i]]), C.s2, 2);
      const nivel = op.c21 / (op.c12 + op.c21);
      VIZ.trazar(ctx, pl, [[XMIN, nivel], [XMAX, nivel]], C.apagado, 1, [3, 4]);
      ctx.save(); ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado;
      ctx.fillText(`decidir ω₁ si P(ω₁|x) > ${nivel.toFixed(2)}`, pl.x0 + 6, pl.sy(nivel) - 5); ctx.restore();
      for (const u of M.umbrales) VIZ.trazar(ctx, pl, [[u, 0], [u, 1]], C.tinta, 1.5, [5, 4]);
    }
    lienzo.alDibujar = dibujar;
    lienzoP.alDibujar = () => M && dibujarP();
    oyentes.push(dibujar);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const i = Math.round(((plano.ix(x) - XMIN) / (XMAX - XMIN)) * (N - 1));
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(xs[i], 3)}</b>` + VIZ.filaTooltip(C.s1, 'P(ω₁ | x)', VIZ.fmt(M.post1[i], 3))
        + VIZ.filaTooltip(C.s2, 'P(ω₂ | x)', VIZ.fmt(1 - M.post1[i], 3)) + `decide <b>ω${M.decide1[i] ? 1 : 2}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el riesgo de cada umbral ---------- */

  function montarRiesgo(cuerpo) {
    let t = 0;
    const ctl = VIZ.controles(cuerpo);
    const rT = ctl.rango({ etiqueta: 'Umbral t (decidir ω₂ si x > t)', min: XMIN, max: XMAX, paso: 0.05, valor: t, formato: (v) => v.toFixed(2), alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Ir al mínimo', () => { t = minimo; rT.valor = t; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 240, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'c₁₂·P(ω₁)·P(x > t | ω₁): ω₁ tomados por ω₂', forma: 'linea' },
      { color: C.s2, texto: 'c₂₁·P(ω₂)·P(x ≤ t | ω₂): ω₂ tomados por ω₁', forma: 'linea' },
      { color: C.tinta, texto: 'riesgo total R(t)', forma: 'linea' },
      { color: C.s6, texto: 'mínimo', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Usa los mismos parámetros de la figura anterior. Suba el costo c₁₂: cuesta más equivocarse con ω₁, y el umbral óptimo se corre a la derecha para cubrir más de ω₁.');

    let plano = null, curva = [], minimo = 0;
    const partes = (u) => [op.c12 * op.p1 * (1 - Phi(u, op.mu1, op.s1)), op.c21 * (1 - op.p1) * Phi(u, op.mu2, op.s2)];
    function dibujar() {
      curva = xs.map((x) => [x, ...partes(x)]);
      let im = 0;
      curva.forEach((c, i) => { if (c[1] + c[2] < curva[im][1] + curva[im][2]) im = i; });
      minimo = curva[im][0];
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...curva.map((c) => Math.max(c[1], c[2], c[1] + c[2]))) * 1.08 || 1;
      plano = VIZ.plano(lienzo, { xmin: XMIN, xmax: XMAX, ymin: 0, ymax: Math.min(ymax, Math.max(op.c12, op.c21) * 1.05) }, { etiquetaX: 'umbral t', etiquetaY: 'riesgo', margen: { izq: 46 } });
      plano.ejes();
      ctx.save(); plano.recortar();
      VIZ.trazar(ctx, plano, curva.map((c) => [c[0], c[1]]), C.s1, 2);
      VIZ.trazar(ctx, plano, curva.map((c) => [c[0], c[2]]), C.s2, 2);
      VIZ.trazar(ctx, plano, curva.map((c) => [c[0], c[1] + c[2]]), C.tinta, 2.5);
      ctx.restore();
      const [a, b] = partes(t);
      VIZ.marcador(ctx, plano.sx(minimo), plano.sy(curva[im][1] + curva[im][2]), C.s6, 5.5);
      VIZ.trazar(ctx, plano, [[t, 0], [t, plano.d.ymax]], C.s4, 1.5);
      VIZ.marcador(ctx, plano.sx(t), plano.sy(a + b), C.s4, 4.5);
      lectura.set([
        ['R(t)', VIZ.fmt(a + b, 3)],
        ['umbral óptimo', VIZ.fmt(minimo, 3)],
        ['R mínimo', VIZ.fmt(curva[im][1] + curva[im][2], 3)],
        ['exceso sobre el mínimo', VIZ.fmt(a + b - curva[im][1] - curva[im][2], 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    oyentes.push(dibujar);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), [a, b] = partes(u);
      tip.mostrar(x, y, `t = <b>${VIZ.fmt(u, 3)}</b>` + VIZ.filaTooltip(C.s1, 'ω₁ → ω₂', VIZ.fmt(a, 3)) + VIZ.filaTooltip(C.s2, 'ω₂ → ω₁', VIZ.fmt(b, 3))
        + VIZ.filaTooltip(C.tinta, 'R(t)', VIZ.fmt(a + b, 3)));
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      t = Math.round(plano.ix(x) * 20) / 20; rT.valor = t; dibujar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('bayes', {
    intro: String.raw`
      <p>La <strong>teoría de decisión bayesiana</strong> responde qué clase asignar a un objeto cuando sus características no
      determinan la clase con certeza. Combina lo que se sabía antes de medir (las probabilidades <em>a priori</em>), lo que dice la
      medición (las <em>verosimilitudes</em>) y lo que cuesta cada tipo de error.</p>
      <p>El resultado es una regla óptima: ningún otro clasificador que use la misma información tiene menor riesgo esperado.
      Por eso sirve de referencia para todos los demás, y los clasificadores gaussianos, como <a href="tema.html?id=lda-qda">LDA y QDA</a>,
      son esta regla con las densidades estimadas a partir de los datos.</p>`,
    visualizaciones: [
      {
        titulo: 'La regla de decisión de Bayes',
        descripcion: 'Dos clases con verosimilitud gaussiana. Cambie la probabilidad a priori y los costos y observe cómo se mueve el umbral y cambia el área de error.',
        montar: montarRegla,
      },
      {
        titulo: 'El riesgo de cada umbral',
        descripcion: 'Para una regla de un solo umbral, el riesgo es la suma de dos curvas que se cruzan; el mínimo es el umbral de Bayes. Haga clic para elegir t.',
        montar: montarRiesgo,
      },
    ],
    teoria: String.raw`
      <h2>Teorema de Bayes</h2>
      <p>Con clases \(\omega_1, \dots, \omega_K\), probabilidades a priori \(P(\omega_k)\) y densidades condicionales \(p(x \mid \omega_k)\),
      la probabilidad a posteriori de cada clase después de observar \(x\) es</p>
      \[ P(\omega_k \mid x) = \frac{p(x \mid \omega_k)\, P(\omega_k)}{p(x)}, \qquad p(x) = \sum_j p(x \mid \omega_j)\, P(\omega_j). \]
      <h2>Mínimo error</h2>
      <p>Si todos los errores cuestan lo mismo, la regla que minimiza la probabilidad de error elige la clase más probable a
      posteriori (MAP). Como \(p(x)\) es común a todas, basta comparar los numeradores:</p>
      \[ \hat\omega(x) = \arg\max_k\; p(x \mid \omega_k)\, P(\omega_k), \qquad
         P(\text{error}) = \int \big(1 - \max_k P(\omega_k \mid x)\big)\, p(x)\, dx. \]
      <p>Esta es la <em>tasa de error de Bayes</em>: la mínima alcanzable con estas características. Para bajarla hay que medir
      otras características, no cambiar de clasificador.</p>
      <h2>Mínimo riesgo</h2>
      <p>Sea \(c_{ij}\) el costo de decidir \(\omega_j\) cuando la clase es \(\omega_i\) (con \(c_{ii} = 0\)). El riesgo condicional de decidir
      \(\omega_j\) es \(R(\omega_j \mid x) = \sum_i c_{ij}\, P(\omega_i \mid x)\), y la regla de Bayes elige la decisión de menor riesgo.
      Con dos clases, se decide \(\omega_1\) si</p>
      \[ \frac{p(x \mid \omega_1)}{p(x \mid \omega_2)} &gt; \frac{c_{21}\, P(\omega_2)}{c_{12}\, P(\omega_1)}. \]
      <p>El lado izquierdo es la <em>razón de verosimilitud</em> y el derecho un umbral que depende solo de los priores y los costos.
      Subir \(c_{12}\) (equivocarse con un \(\omega_1\) es caro) baja el umbral y agranda la región de \(\omega_1\).</p>
      <h2>Caso gaussiano en una dimensión</h2>
      <p>Con \(p(x \mid \omega_k) = \mathcal{N}(\mu_k, \sigma_k^2)\), tomar logaritmos da una ecuación de segundo grado en \(x\): hay
      hasta dos umbrales. Si \(\sigma_1 = \sigma_2 = \sigma\), el término cuadrático se cancela y queda un solo umbral</p>
      \[ t = \frac{\mu_1 + \mu_2}{2} + \frac{\sigma^2}{\mu_2 - \mu_1}\,\ln\frac{c_{12}\, P(\omega_1)}{c_{21}\, P(\omega_2)}. \]
      <p>Con priores y costos iguales, el umbral está en el punto medio de las medias. En varias dimensiones, el mismo razonamiento
      lleva a fronteras lineales (covarianzas iguales) o cuadráticas (distintas): ver <a href="tema.html?id=lda-qda">LDA y QDA</a>.
      Si además se supone que las características son independientes dentro de cada clase, se obtiene
      <a href="tema.html?id=naive-bayes">Naive Bayes</a>.</p>
      <div class="recuadro"><p>En la práctica \(P(\omega_k)\) y \(p(x \mid \omega_k)\) no se conocen: se estiman con datos de entrenamiento.
      La regla es óptima solo en la medida en que esas estimaciones sean buenas.</p></div>`,
  });
})();
