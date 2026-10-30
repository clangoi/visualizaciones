(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  // f(x, y) = ½ (x² + κ y²): la curvatura κ mide qué tan alargado es el valle.
  const f = (k) => (x, y) => 0.5 * (x * x + k * y * y);
  const g = (k) => (x, y) => [x, k * y];

  /* ---------- Fig. 1: el zigzag y la inercia ---------- */

  function montarMomentum(cuerpo) {
    let k = 20, lr = 0.06, beta = 0.9, t = 0, a = [-2.8, 1.2], b = [-2.8, 1.2], va = [0, 0], ra = [], rb = [], pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Curvatura κ (qué tan estrecho es el valle)', min: 2, max: 40, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tasa de aprendizaje η', min: 0.01, max: 0.12, paso: 0.005, valor: lr, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { lr = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Momentum β', min: 0, max: 0.97, paso: 0.01, valor: beta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { beta = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    const fondo = DL.cache(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'descenso de gradiente simple', forma: 'linea' }, { color: C.s2, texto: 'con momentum', forma: 'linea' }, { color: C.tenue, texto: 'curvas de nivel', forma: 'linea' }, { color: C.s6, texto: 'mínimo', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con un valle estrecho, el descenso simple rebota entre las paredes y avanza despacio por el fondo. El momentum acumula la velocidad a lo largo del fondo y amortigua los rebotes. Con η > 2/κ el descenso simple diverge.');
    function iniciar() {
      a = [-2.8, 1.2]; b = [-2.8, 1.2]; va = [0, 0]; t = 0; ra = [a.slice()]; rb = [b.slice()];
      return (function* () {
        while (t < 400) {
          const ga = g(k)(...a), gb = g(k)(...b);
          a = a.map((v, i) => v - lr * ga[i]);
          va = va.map((v, i) => beta * v - lr * gb[i]); b = b.map((v, i) => v + va[i]);
          t++; ra.push(a.slice()); rb.push(b.slice());
          if (Math.abs(a[0]) > 50 || Math.abs(a[1]) > 50) { a = [Math.max(-50, Math.min(50, a[0])), Math.max(-50, Math.min(50, a[1]))]; }
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -3.2, xmax: 3.2, ymin: -1.6, ymax: 1.6 }, { etiquetaX: 'θ₁', etiquetaY: 'θ₂' });
      pl.ejes();
      fondo(`k${k}`, (c) => [0.1, 0.4, 1, 2, 3.5, 5.5, 8].forEach((v) => ML.contorno(c, pl, f(k), v, { color: C.tenue, ancho: 1.3, paso: 6 })));
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, ra, C.s1, 1.8); VIZ.trazar(ctx, pl, rb, C.s2, 1.8);
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(0), pl.sy(0), C.s6, 6);
      VIZ.marcador(ctx, pl.sx(Math.max(-3.2, Math.min(3.2, a[0]))), pl.sy(Math.max(-1.6, Math.min(1.6, a[1]))), C.s1, 5);
      VIZ.marcador(ctx, pl.sx(b[0]), pl.sy(b[1]), C.s2, 5);
      const fa = f(k)(...a), fb = f(k)(...b);
      registro.textContent = fa > 1e3 ? `Con η = ${VIZ.fmt(lr, 3)} > 2/κ = ${VIZ.fmt(2 / k, 3)} el descenso simple diverge: cada paso se pasa del fondo y la pérdida crece.` : `Paso ${t}: pérdida ${VIZ.fmt(fa, 3)} sin momentum y ${VIZ.fmt(fb, 3)} con momentum.`;
      lectura.set([['paso', String(t)], ['pérdida simple', fa > 1e6 ? '> 10⁶' : VIZ.fmt(fa, 3)], ['pérdida con momentum', VIZ.fmt(fb, 3)], ['límite de estabilidad 2/κ', VIZ.fmt(2 / k, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `(${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})<br>pérdida <b>${VIZ.fmt(f(k)(pl.ix(x), pl.iy(y)), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: demasiado pequeña, adecuada y demasiado grande ---------- */

  function montarTasa(cuerpo) {
    let k = 10, decae = false, hover = null, pl = null, cur = [];
    const MULT = [0.05, 0.25, 0.9, 1.05];
    const COL = [C.s1, C.s6, C.s2, C.s8];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Curvatura κ', min: 2, max: 40, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Reducir η a la mitad cada 15 pasos', valor: decae, alCambiar: (v) => { decae = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const nombre = (m) => `η = ${VIZ.fmt((m * 2) / k, 3)} (${m < 0.5 ? 'demasiado pequeña' : m < 1 ? 'adecuada' : m < 1.01 ? 'casi la crítica' : 'mayor que 2/κ'})`;
    VIZ.leyenda(cuerpo, MULT.map((m, i) => ({ color: COL[i], texto: `${m} × (2/κ)`, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Las cuatro tasas se miden respecto de η* = 2/κ. Muy por debajo, la pérdida baja lentamente; cerca de η*, oscila; por encima, diverge. Reducir η con el tiempo permite empezar rápido y terminar con precisión.');
    function simular() {
      cur = MULT.map((m) => {
        let a = [-2.8, 1.2], lr = (m * 2) / k; const L = [f(k)(...a)];
        for (let t = 1; t <= 60; t++) {
          if (decae && t % 15 === 0) lr /= 2;
          const gg = g(k)(...a); a = a.map((v, i) => v - lr * gg[i]); L.push(Math.min(f(k)(...a), 1e8));
        }
        return L;
      });
    }
    function dibujar() {
      simular();
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 60, ymin: 1e-6, ymax: 1e6 }, { logY: true, etiquetaX: 'paso', etiquetaY: 'pérdida (escala log)', formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      cur.forEach((L, i) => VIZ.trazar(ctx, pl, L.map((v, t) => [t, Math.max(v, 1e-6)]), COL[i], 2));
      if (hover != null) cur.forEach((L, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(L[hover], 1e-6)), COL[i], 4));
      ctx.restore();
      registro.textContent = `η* = 2/κ = ${VIZ.fmt(2 / k, 3)}. Tras 60 pasos las pérdidas son ${cur.map((L, i) => `${VIZ.fmt(L[60], 2)} (${MULT[i]}·η*)`).join('; ')}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(60, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `paso <b>${hover}</b>` + cur.map((L, i) => VIZ.filaTooltip(COL[i], nombre(MULT[i]), VIZ.fmt(L[hover], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('learning-rate-momentum', {
    intro: String.raw`
      <p>La <strong>tasa de aprendizaje</strong> \(\eta\) es el tamaño del paso. Si es muy pequeña, el entrenamiento tarda una eternidad; si es muy grande, los pasos se pasan del mínimo y la pérdida oscila o crece sin parar. Es el hiperparámetro más importante de una red.</p>
      <p>Aun con una tasa razonable, el descenso de gradiente sufre en valles estrechos: el gradiente apunta casi perpendicular al fondo y el avance rebota entre las paredes. El <strong>momentum</strong> le añade <em>inercia</em>: cada paso recuerda la dirección de los anteriores, de modo que los rebotes se cancelan y el avance a lo largo del valle se acumula.</p>`,
    visualizaciones: [
      { titulo: 'Zigzag e inercia en un valle', descripcion: 'Estreche el valle (\\(\\kappa\\)) y compare los dos caminos. Suba \\(\\beta\\) a 0,95 y observe el sobreimpulso y el amortiguamiento.', montar: montarMomentum },
      { titulo: 'La tasa de aprendizaje y la estabilidad', descripcion: 'Cuatro tasas medidas respecto del umbral \\(2/\\kappa\\). Active la reducción periódica para ver cómo se suaviza la oscilación.', montar: montarTasa },
    ],
    teoria: String.raw`
      <h2>Tasa de aprendizaje en una cuadrática</h2>
      <p>Para \(\mathcal{L}(\theta)=\tfrac12\sum_i \lambda_i\theta_i^2\), el descenso de gradiente da \(\theta_i^{t+1} = (1-\eta\lambda_i)\,\theta_i^t\). Converge si \(|1-\eta\lambda_i|<1\) para todo \(i\), o sea</p>
      \[ 0 < \eta < \frac{2}{\lambda_{\max}}. \]
      <p>La velocidad queda dominada por la dirección más plana: el número de pasos crece con el <em>número de condición</em> \(\kappa=\lambda_{\max}/\lambda_{\min}\), y con la mejor \(\eta = 2/(\lambda_{\max}+\lambda_{\min})\) el error se reduce por paso en \(\frac{\kappa-1}{\kappa+1}\).</p>
      <h2>Momentum</h2>
      <p>La versión de la <em>bola pesada</em> mantiene una velocidad \(v\):</p>
      \[ v_{t+1} = \beta\, v_t - \eta\,\nabla\mathcal{L}(\theta_t), \qquad \theta_{t+1} = \theta_t + v_{t+1}. \]
      <p>Con \(\beta=0\) es el descenso simple. Para una cuadrática, la mejor elección acelera la convergencia de \(\frac{\kappa-1}{\kappa+1}\) a \(\frac{\sqrt\kappa-1}{\sqrt\kappa+1}\) por paso: la dependencia pasa de \(\kappa\) a \(\sqrt\kappa\).</p>
      <pre><code>v ← 0
repetir:
    g ← ∇L(θ)
    v ← β·v − η·g
    θ ← θ + v</code></pre>
      <h2>Programas de tasa</h2>
      <p>En la práctica se empieza con \(\eta\) relativamente grande y se reduce: decaimiento escalonado, exponencial o coseno. Una tasa grande explora rápido; una pequeña al final promedia el ruido del <a href="tema.html?id=sgd-minibatch">SGD</a>.</p>
      <p>Los optimizadores que ajustan \(\eta\) por parámetro se ven en <a href="tema.html?id=adaptive-optimizers">AdaGrad, RMSProp y Adam</a>.</p>`,
  });
})();
