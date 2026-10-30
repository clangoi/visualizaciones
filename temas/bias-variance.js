(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const f = (x) => Math.sin(2.2 * x) + 0.3 * x;
  const SIGMA = 0.35, N = 40, REPS = 60;
  const XS = Array.from({ length: 81 }, (_, i) => -2 + i * 0.05);
  const entrenamiento = (rnd) => Array.from({ length: N }, () => { const x = rnd() * 4 - 2; return { x, y: f(x) + SIGMA * VIZ.normal(rnd) }; });
  // Regresión por k vecinos: promedio de y de los k puntos más cercanos.
  function knnReg(D, k) {
    const s = D.slice().sort((a, b) => a.x - b.x);
    return (x) => { const v = s.map((p) => [Math.abs(p.x - x), p.y]).sort((a, b) => a[0] - b[0]).slice(0, k); return M.media(v.map((q) => q[1])); };
  }
  // Ajusta REPS modelos sobre conjuntos independientes y descompone el error en la rejilla XS.
  function descomponer(k, semilla) {
    const rnd = VIZ.semilla(semilla * 97 + k), curvas = [];
    for (let r = 0; r < REPS; r++) { const g = knnReg(entrenamiento(rnd), k); curvas.push(XS.map(g)); }
    const media = XS.map((_, i) => M.media(curvas.map((c) => c[i])));
    const sesgo2 = M.media(XS.map((x, i) => (media[i] - f(x)) ** 2));
    const varianza = M.media(XS.map((_, i) => M.media(curvas.map((c) => (c[i] - media[i]) ** 2))));
    return { curvas, media, sesgo2, varianza, total: sesgo2 + varianza + SIGMA * SIGMA };
  }

  /* ---------- Fig. 1: muchos modelos, un promedio ---------- */

  function montarModelos(cuerpo) {
    let k = 5, semilla = 1, R = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Vecinos k (complejidad inversa)', min: 1, max: 40, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.boton('Otros conjuntos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 280, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: `modelo ajustado a uno de ${REPS} conjuntos de entrenamiento`, forma: 'linea' },
      { color: C.s2, texto: 'promedio de los modelos', forma: 'linea' },
      { color: C.s6, texto: 'función verdadera', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Cada línea azul es una regresión por k vecinos entrenada con ${N} puntos nuevos. Con k = 1 las líneas siguen el ruido y varían mucho de una a otra (varianza); con k = 40 todas son casi iguales pero aplanan la curva (sesgo).`);
    function calcular() { R = descomponer(k, semilla); dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -2, xmax: 2, ymin: -2.2, ymax: 2.2 }, { etiquetaX: 'x', etiquetaY: 'y' });
      pl.ejes();
      ctx.save(); pl.recortar();
      R.curvas.slice(0, 25).forEach((c) => VIZ.trazar(ctx, pl, XS.map((x, i) => [x, c[i]]), VIZ.alfa(C.s1, 0.3), 1.2));
      VIZ.trazar(ctx, pl, XS.map((x) => [x, f(x)]), C.s6, 2, [5, 4]);
      VIZ.trazar(ctx, pl, XS.map((x, i) => [x, R.media[i]]), C.s2, 3);
      ctx.restore();
      lectura.set([
        ['sesgo²', VIZ.fmt(R.sesgo2, 3)],
        ['varianza', VIZ.fmt(R.varianza, 3)],
        ['ruido irreducible σ²', VIZ.fmt(SIGMA * SIGMA, 3)],
        ['error esperado', VIZ.fmt(R.total, 3)],
      ]);
    }
    lienzo.alDibujar = () => R && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.max(0, Math.min(XS.length - 1, Math.round((pl.ix(x) + 2) / 0.05)));
      const vs = R.curvas.map((c) => c[i]);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(XS[i], 2)}</b><br>verdadero <b>${VIZ.fmt(f(XS[i]), 3)}</b> · promedio <b>${VIZ.fmt(R.media[i], 3)}</b><br>desviación entre modelos <b>${VIZ.fmt(M.desv(vs), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: la curva en U ---------- */

  function montarCurva(cuerpo) {
    let semilla = 1, filas = [], hover = null;
    const KS = [1, 2, 3, 4, 5, 7, 10, 14, 20, 28, 40];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Recalcular', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['sesgo2', 'sesgo²', C.s2], ['varianza', 'varianza', C.s1], ['total', 'error total', C.tinta]];
    VIZ.leyenda(cuerpo, [...SER.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })), { color: C.apagado, texto: 'ruido σ²', forma: 'linea' }, { color: C.s6, texto: 'mínimo del error', forma: 'punto' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje horizontal está invertido respecto de k: a la derecha, modelos más complejos (k chico). El sesgo baja y la varianza sube con la complejidad; el error total tiene un mínimo intermedio y nunca baja del ruido.');
    function calcular() { filas = KS.map((k) => ({ k, ...descomponer(k, semilla) })); dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const X = (k) => -Math.log(k);
      pl = VIZ.plano(lienzo, { xmin: X(40), xmax: X(1), ymin: 0, ymax: Math.max(...filas.map((r) => r.total)) * 1.1 }, { etiquetaX: 'complejidad (k vecinos, escala log invertida)', etiquetaY: 'error cuadrático', ticksX: [1, 2, 5, 10, 20, 40].map(X), formatoX: (v) => `k=${Math.round(Math.exp(-v))}` });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[X(40), SIGMA * SIGMA], [X(1), SIGMA * SIGMA]], C.apagado, 1.5, [3, 4]);
      for (const [key, , col] of SER) {
        VIZ.trazar(ctx, pl, filas.map((r) => [X(r.k), r[key]]), col, 2);
        if (hover) VIZ.marcador(ctx, pl.sx(X(hover.k)), pl.sy(hover[key]), col, 4);
      }
      const mejor = filas.reduce((a, b) => (b.total < a.total ? b : a));
      VIZ.marcador(ctx, pl.sx(X(mejor.k)), pl.sy(mejor.total), C.s6, 6);
      lectura.set([
        ['k con menor error', String(mejor.k)],
        ['error con k = 1', VIZ.fmt(filas[0].total, 3)],
        ['error con k = 40', VIZ.fmt(filas[filas.length - 1].total, 3)],
        ['error mínimo', VIZ.fmt(mejor.total, 3)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const v = pl.ix(x);
      hover = filas.reduce((a, b) => (Math.abs(-Math.log(b.k) - v) < Math.abs(-Math.log(a.k) - v) ? b : a));
      dibujar();
      tip.mostrar(x, y, `k = <b>${hover.k}</b>` + SER.map(([key, t, c]) => VIZ.filaTooltip(c, t, VIZ.fmt(hover[key], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('bias-variance', {
    intro: String.raw`
      <p>El error de un modelo sobre datos nuevos tiene dos fuentes que se pueden separar. El <strong>sesgo</strong> es cuánto se equivoca en promedio:
      un modelo demasiado simple no puede representar la realidad. La <strong>varianza</strong> es cuánto cambia según la muestra con que se entrenó:
      un modelo demasiado flexible aprende el ruido.</p>
      <p>Lo mismo vale para cualquier estimación en minería de datos: un efecto causal, un agrupamiento o una regla. Una estimación
      <strong>estable</strong> tiene poca varianza; una <strong>insesgada</strong> acierta en promedio. Reducir una suele aumentar la otra.</p>`,
    visualizaciones: [
      {
        titulo: 'Muchos modelos, un promedio',
        descripcion: 'Regresión por k vecinos entrenada con muchos conjuntos distintos. Compare la dispersión de las líneas con la distancia entre su promedio y la verdad.',
        montar: montarModelos,
      },
      {
        titulo: 'La curva en U',
        descripcion: 'Sesgo², varianza y error total según la complejidad del modelo.',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Descomposición</h2>
      <p>Si \(y = f(x) + \varepsilon\) con \(\mathbb E[\varepsilon] = 0\), \(\operatorname{var}(\varepsilon) = \sigma^2\), y \(\hat f_D\) se entrena con un conjunto aleatorio \(D\):</p>
      \[ \mathbb E_{D, \varepsilon}\bigl[(y - \hat f_D(x))^2\bigr] = \underbrace{\bigl(\mathbb E_D[\hat f_D(x)] - f(x)\bigr)^2}_{\text{sesgo}^2}
         + \underbrace{\operatorname{var}_D\bigl(\hat f_D(x)\bigr)}_{\text{varianza}} + \underbrace{\sigma^2}_{\text{ruido}}. \]
      <p>Para \(k\)-NN en un punto, aproximadamente, varianza \(\approx \sigma^2/k\) y sesgo creciente con \(k\) (se promedian puntos cada vez más lejanos).</p>
      <h2>Estimadores</h2>
      <p>La misma descomposición se aplica a un estimador \(\hat\theta\) de un parámetro: \(\mathrm{ECM}(\hat\theta) = \operatorname{sesgo}(\hat\theta)^2 + \operatorname{var}(\hat\theta)\).</p>
      <ul>
        <li>El <a href="tema.html?id=matching">matching</a> con caliper chico reduce el sesgo y aumenta la varianza (menos parejas).</li>
        <li>Recortar pesos extremos en <a href="tema.html?id=propensity-score">IPW</a> reduce la varianza a costa de algo de sesgo.</li>
        <li>Un prior en la <a href="tema.html?id=bayesian-estimation">estimación bayesiana</a> sesga hacia él pero reduce la varianza.</li>
      </ul>
      <h2>Cómo medirlo en la práctica</h2>
      <p>Solo hay un conjunto de datos, así que la varianza se aproxima con <a href="tema.html?id=bootstrap">bootstrap</a> o validación cruzada; el sesgo,
      con simulaciones en las que se conoce la verdad (como en estas figuras) o comparando métodos con supuestos distintos.</p>
      <div class="recuadro"><p>Una estimación muy precisa (varianza chica) puede estar muy lejos de la verdad. En inferencia causal el sesgo por confusión
      no disminuye con más datos: un intervalo de confianza angosto alrededor del valor equivocado.</p></div>`,
  });
})();