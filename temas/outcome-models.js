(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Ajuste por mínimos cuadrados de y sobre las columnas de X (con intercepto).
  function mco(X, y) {
    const Z = X.map((x) => [1, ...x]), p = Z[0].length;
    const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (__, j) => M.suma(Z.map((f) => f[i] * f[j]))));
    const b = Array.from({ length: p }, (_, i) => M.suma(Z.map((f, r) => f[i] * y[r])));
    const w = VIZ.ml.resolver(A, b);
    return (x) => w[0] + x.reduce((s, v, j) => s + v * w[j + 1], 0);
  }

  /* ---------- Fig. 1: ajuste por regresión (T-learner) ---------- */

  function montarRegresion(cuerpo) {
    let modelo = 'lineal', conf = 1.6, semilla = 1, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo de resultado', opciones: [['lineal', 'Lineal en la gravedad'], ['cuadratico', 'Cuadrático en la gravedad']], valor: modelo, alCambiar: (v) => { modelo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Confusión', min: 0, max: 3, paso: 0.1, valor: conf, formato: (v) => v.toFixed(1), alCambiar: (v) => { conf = v; generar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'tratados y su modelo μ₁(x)', forma: 'cuadro' }, { color: C.s1, texto: 'controles y su modelo μ₀(x)', forma: 'punto' },
      { color: C.apagado, texto: 'curvas verdaderas E[Y(t) | x]', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se ajusta un modelo para cada grupo y el efecto se estima promediando μ₁(x) − μ₀(x) sobre todos los pacientes. Con mucha confusión casi no hay controles graves: el modelo de los controles tiene que extrapolar, y si es lineal cuando la realidad es curva, el error se traslada al efecto.');
    function generar() { D = M.estudio(300, semilla, { conf, het: 1 }); dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const f = (d) => (modelo === 'lineal' ? [d.x2] : [d.x2, d.x2 * d.x2]);
      const T = D.filter((d) => d.t), Cn = D.filter((d) => !d.t);
      const m1 = mco(T.map(f), T.map((d) => d.y)), m0 = mco(Cn.map(f), Cn.map((d) => d.y));
      const g = (x) => f({ x2: x });
      pl = VIZ.plano(lienzo, { xmin: -3, xmax: 3, ymin: -4, ymax: 16 }, { etiquetaX: 'gravedad', etiquetaY: 'resultado Y' });
      pl.ejes();
      M.dispersion(ctx, pl, D.map((d) => ({ x: d.x2, y: d.y, t: d.t })), { color: (p) => (p.t ? VIZ.alfa(C.s2, 0.6) : VIZ.alfa(C.s1, 0.6)), forma: (p) => (p.t ? 1 : 0), r: 2.4 });
      const xs = Array.from({ length: 61 }, (_, i) => -3 + i * 0.1);
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, xs.map((x) => [x, 1 + 1.5 * x + 0.8 * x * x]), C.apagado, 1.5, [4, 3]);
      VIZ.trazar(ctx, pl, xs.map((x) => [x, 3 + 2.3 * x + 0.8 * x * x]), C.apagado, 1.5, [4, 3]);
      VIZ.trazar(ctx, pl, xs.map((x) => [x, m0(g(x))]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, xs.map((x) => [x, m1(g(x))]), C.s2, 2.5);
      ctx.restore();
      const V = M.efectosVerdaderos(D), est = M.media(D.map((d) => m1(f(d)) - m0(f(d))));
      lectura.set([
        ['ATE estimado por regresión', VIZ.fmt(est, 3)],
        ['ATE verdadero', VIZ.fmt(V.ate, 3)],
        ['diferencia ingenua', VIZ.fmt(V.ingenuo, 3)],
        ['controles con gravedad > 1', String(Cn.filter((d) => d.x2 > 1).length)],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const v = pl.ix(x);
      tip.mostrar(x, y, `gravedad = <b>${VIZ.fmt(v, 2)}</b><br>efecto verdadero τ(x) = <b>${VIZ.fmt(2 + 0.8 * v, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: doble robustez ---------- */

  function montarRobustez(cuerpo) {
    let yOk = false, eOk = true, reps = 60, semilla = 1, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'modelo de resultado correcto (incluye gravedad²)', valor: yOk, alCambiar: (v) => { yOk = v; calcular(); } });
    ctl.casilla({ etiqueta: 'modelo de propensión correcto (incluye gravedad²)', valor: eOk, alCambiar: (v) => { eOk = v; calcular(); } });
    ctl.boton('Repetir', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'estimación en un estudio', forma: 'punto' }, { color: C.tinta, texto: 'promedio de los estudios', forma: 'linea' }, { color: C.s6, texto: 'ATE verdadero', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `${reps} estudios simulados de 500 pacientes. La regresión falla si su modelo está mal; IPW falla si el de propensión está mal; AIPW combina ambos y es insesgado si cualquiera de los dos es correcto. Desmarque ambos para verlo fallar.`);
    function calcular() {
      const est = { 'regresión': [], IPW: [], AIPW: [] }, ates = [];
      for (let r = 0; r < reps; r++) {
        const D = M.estudio(500, semilla * 1000 + r, { conf: 0.6 });
        ates.push(M.efectosVerdaderos(D).ate);
        const fy = (d) => (yOk ? [d.x1, d.x2, d.x2 * d.x2] : [d.x1, d.x2]), fe = (d) => (eOk ? [d.x1, d.x2, d.x2 * d.x2] : [d.x1, d.x2]);
        const T = D.filter((d) => d.t), Cn = D.filter((d) => !d.t);
        const m1 = mco(T.map(fy), T.map((d) => d.y)), m0 = mco(Cn.map(fy), Cn.map((d) => d.y));
        const ps = M.logistica(D.map(fe), D.map((d) => d.t)), e = D.map((d) => Math.min(0.99, Math.max(0.01, ps.p(fe(d)))));
        const mu1 = D.map((d) => m1(fy(d))), mu0 = D.map((d) => m0(fy(d)));
        est['regresión'].push(M.media(mu1.map((v, i) => v - mu0[i])));
        const wT = D.map((d, i) => (d.t ? 1 / e[i] : 0)), wC = D.map((d, i) => (d.t ? 0 : 1 / (1 - e[i])));
        est.IPW.push(M.suma(D.map((d, i) => wT[i] * d.y)) / M.suma(wT) - M.suma(D.map((d, i) => wC[i] * d.y)) / M.suma(wC));
        est.AIPW.push(M.media(D.map((d, i) => mu1[i] - mu0[i] + (d.t * (d.y - mu1[i])) / e[i] - ((1 - d.t) * (d.y - mu0[i])) / (1 - e[i]))));
      }
      res = { est, ate: M.media(ates) };
      dibujar();
    }
    let pl = null, nombres = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      nombres = Object.keys(res.est);
      const todos = nombres.flatMap((k) => res.est[k]);
      pl = VIZ.plano(lienzo, { xmin: -0.5, xmax: 2.5, ymin: Math.min(...todos, res.ate) - 0.2, ymax: Math.max(...todos, res.ate) + 0.2 }, { etiquetaY: 'ATE estimado', ticksX: [0, 1, 2], formatoX: (v) => nombres[v] || '' });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[-0.5, res.ate], [2.5, res.ate]], C.s6, 2, [5, 4]);
      nombres.forEach((k, i) => {
        res.est[k].forEach((v, r) => { ctx.fillStyle = VIZ.alfa(C.s1, 0.55); ctx.beginPath(); ctx.arc(pl.sx(i + (((r * 37) % 21) - 10) * 0.012), pl.sy(v), 2.8, 0, 2 * Math.PI); ctx.fill(); });
        const m = M.media(res.est[k]);
        VIZ.trazar(ctx, pl, [[i - 0.25, m], [i + 0.25, m]], C.tinta, 3);
      });
      lectura.set(nombres.map((k) => [`${k}: sesgo · desviación`, `${VIZ.fmt(M.media(res.est[k]) - res.ate, 3)} · ${VIZ.fmt(M.desv(res.est[k]), 3)}`]));
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.round(pl.ix(x));
      if (i < 0 || i > 2) return tip.ocultar();
      const v = res.est[nombres[i]];
      tip.mostrar(x, y, `<b>${nombres[i]}</b><br>promedio <b>${VIZ.fmt(M.media(v), 3)}</b><br>rango [${VIZ.fmt(Math.min(...v), 3)}, ${VIZ.fmt(Math.max(...v), 3)}]`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('outcome-models', {
    intro: String.raw`
      <p>En lugar de igualar grupos, se puede <strong>modelar el resultado</strong>: ajustar \(\mu_1(x) = \mathbb E[Y \mid T = 1, X = x]\) con los tratados y
      \(\mu_0(x)\) con los controles, y predecir para cada unidad lo que le habría pasado con y sin tratamiento. El efecto es el promedio de esas diferencias.</p>
      <p>Funciona tan bien como el modelo. Si los grupos se solapan poco, el modelo debe <strong>extrapolar</strong>, y un modelo mal especificado
      sesga el resultado. Los estimadores <strong>doblemente robustos</strong> combinan un modelo de resultado con uno de
      <a href="tema.html?id=propensity-score">propensión</a> y solo necesitan que uno de los dos sea correcto.</p>`,
    visualizaciones: [
      {
        titulo: 'Ajuste por regresión',
        descripcion: 'Un modelo por grupo (T-learner) y la diferencia promedio. Suba la confusión con el modelo lineal y luego cambie a cuadrático.',
        montar: montarRegresion,
      },
      {
        titulo: 'Doble robustez',
        descripcion: 'Regresión, IPW y AIPW en muchos estudios simulados, con modelos correctos o mal especificados.',
        montar: montarRobustez,
      },
    ],
    teoria: String.raw`
      <h2>Estimador por regresión (g-computación)</h2>
      \[ \widehat{\mathrm{ATE}} = \frac1n \sum_{i=1}^n \bigl(\hat\mu_1(X_i) - \hat\mu_0(X_i)\bigr), \qquad
         \widehat{\mathrm{ATT}} = \frac{1}{n_1} \sum_{i : T_i = 1} \bigl(Y_i - \hat\mu_0(X_i)\bigr). \]
      <p>Bajo ignorabilidad y con \(\hat\mu_t\) consistentes, ambos son consistentes. Con un solo modelo lineal \(Y = \alpha + \tau T + \beta^\top X\) el coeficiente
      \(\tau\) es el efecto si es homogéneo y el modelo es correcto; ajustar modelos separados (T-learner) permite efectos heterogéneos \(\tau(x)\).</p>
      <h2>Estimador doblemente robusto (AIPW)</h2>
      \[ \widehat{\mathrm{ATE}}_{\text{DR}} = \frac1n \sum_i \Bigl[\hat\mu_1(X_i) - \hat\mu_0(X_i)
         + \frac{T_i\,(Y_i - \hat\mu_1(X_i))}{\hat e(X_i)} - \frac{(1 - T_i)(Y_i - \hat\mu_0(X_i))}{1 - \hat e(X_i)}\Bigr]. \]
      <div class="recuadro"><p>Es consistente si \(\hat\mu\) <em>o</em> \(\hat e\) es correcto. Si \(\hat\mu\) es correcto, los términos de corrección tienen media 0;
      si \(\hat e\) es correcto, corrigen el sesgo de \(\hat\mu\) por ponderación inversa. Si ambos son correctos, alcanza la menor varianza posible entre
      estimadores regulares.</p></div>
      <h2>Modelos flexibles</h2>
      <p>Para evitar mala especificación se usan modelos de aprendizaje automático (bosques, boosting) para \(\mu\) y \(e\). Entonces conviene el ajuste
      cruzado (<em>cross-fitting</em>): estimar los modelos en una parte de los datos y evaluarlos en otra, como en el <em>double machine learning</em>.
      Variantes: S-learner (un modelo con \(T\) como variable), X-learner, bosques causales.</p>
      <h2>Cuándo desconfiar</h2>
      <p>Si el solapamiento es pobre, todos los métodos sufren: la regresión extrapola, IPW tiene pesos enormes. Revise el
      <a href="tema.html?id=covariate-balance">balance</a> y los valores de \(\hat e\), y valide con <a href="tema.html?id=causal-refutation">pruebas de refutación</a>.</p>`,
  });
})();