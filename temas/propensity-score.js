(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Regresión logística del tratamiento sobre x1, x2 y x2² (el modelo correcto para estos datos).
  const rasgos = (d) => [d.x1, d.x2, d.x2 * d.x2];
  const ajustarPS = (D) => M.logistica(D.map(rasgos), D.map((d) => d.t));

  /* ---------- Fig. 1: estimar e(x) y revisar el solapamiento ---------- */

  function montarPS(cuerpo) {
    let conf = 1.2, recorte = 0.05, semilla = 1, D = [], ps = null, e = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Confusión', min: 0, max: 3, paso: 0.1, valor: conf, formato: (v) => v.toFixed(1), alCambiar: (v) => { conf = v; generar(); } });
    ctl.rango({ etiqueta: 'Recortar e(x) fuera de [a, 1 − a]', min: 0, max: 0.2, paso: 0.01, valor: recorte, formato: (v) => `a = ${v.toFixed(2)}`, alCambiar: (v) => { recorte = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.45) : Math.min(400, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'tratado', forma: 'cuadro' }, { color: C.s1, texto: 'control', forma: 'punto' },
      { color: C.s7, texto: 'curvas e(x) = 0,2 · 0,5 · 0,8', forma: 'linea' },
      { color: C.neutro, texto: 'zona recortada (sin solapamiento)', borde: C.rejilla },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Primer panel: las covariables con las curvas de nivel del propensity score estimado por regresión logística. Segundo panel: la distribución de e(x) en cada grupo. Suba la confusión: los grupos se separan y aparecen zonas con solo tratados o solo controles.');
    function generar() { D = M.estudio(400, semilla, { conf }); ps = ajustarPS(D); e = D.map((d) => ps.p(rasgos(d))); dibujar(); }
    let ph = null, oh = { x: 0, y: 0 };
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.55 : H;
      ctx.save();
      const sub = { ...lienzo, ancho: wA, alto: hA, ctx }, a = Math.max(1, (wA / hA) * 0.95);
      const pl = VIZ.plano(sub, { xmin: -3.2 * a, xmax: 3.2 * a, ymin: -3.2, ymax: 3.2 }, { etiquetaX: 'edad', etiquetaY: 'gravedad', margen: { izq: 40 } });
      pl.ejes();
      ctx.save(); pl.recortar();
      for (const nv of [0.2, 0.5, 0.8]) VIZ.ml.contorno(ctx, pl, (x, y) => ps.p([x, y, y * y]), nv, { color: C.s7, ancho: nv === 0.5 ? 2 : 1.5, guiones: nv === 0.5 ? null : [4, 3] });
      ctx.restore();
      M.dispersion(ctx, pl, D.map((d, i) => ({ x: d.x1, y: d.x2, t: d.t, i })), { color: (p) => (p.t ? C.s2 : C.s1), forma: (p) => (p.t ? 1 : 0), r: 2.6, hueco: (p) => e[p.i] < recorte || e[p.i] > 1 - recorte });
      ctx.restore();
      ctx.save();
      oh = { x: vertical ? 0 : wA, y: vertical ? hA : 0 };
      ctx.translate(oh.x, oh.y);
      const sub2 = { ...lienzo, ancho: W - oh.x, alto: H - oh.y, ctx };
      const bins = 25, eT = e.filter((_, i) => D[i].t), eC = e.filter((_, i) => !D[i].t);
      const mx = Math.max(...[eT, eC].map((v) => { const c = new Array(bins).fill(0); v.forEach((x) => c[Math.min(bins - 1, Math.floor(x * bins))]++); return Math.max(...c); }));
      ph = VIZ.plano(sub2, { xmin: 0, xmax: 1, ymin: 0, ymax: mx * 1.1 }, { etiquetaX: 'propensity score e(x)', etiquetaY: 'cantidad' });
      ctx.fillStyle = C.neutro;
      ctx.fillRect(ph.x0, ph.y1, ph.sx(recorte) - ph.x0, ph.y0 - ph.y1); ctx.fillRect(ph.sx(1 - recorte), ph.y1, ph.x1 - ph.sx(1 - recorte), ph.y0 - ph.y1);
      ph.ejes();
      M.histograma(ctx, ph, eC, { min: 0, max: 1, bins, color: C.s1, alfa: 0.6 });
      M.histograma(ctx, ph, eT, { min: 0, max: 1, bins, color: C.s2, alfa: 0.6 });
      ctx.restore();
      const dentro = D.filter((_, i) => e[i] >= recorte && e[i] <= 1 - recorte);
      const w = D.map((d, i) => (d.t ? 1 / e[i] : 1 / (1 - e[i])));
      lectura.set([
        ['coeficientes (x1, x2, x2²)', ps.w.slice(1).map((v) => VIZ.fmt(v, 2)).join(' · ')],
        ['unidades dentro del recorte', `${dentro.length} de ${D.length}`],
        ['peso IPW máximo', VIZ.fmt(Math.max(...w), 3)],
        ['e(x) mín · máx', `${VIZ.fmt(Math.min(...e), 3)} · ${VIZ.fmt(Math.max(...e), 3)}`],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!ph || !ph.dentro(x - oh.x, y - oh.y)) return tip.ocultar();
      const v = ph.ix(x - oh.x), b = Math.floor(v * 25);
      const cnt = (t) => e.filter((q, i) => D[i].t === t && Math.floor(q * 25) === b).length;
      tip.mostrar(x, y, `e ∈ [${VIZ.fmt(b / 25, 2)}, ${VIZ.fmt((b + 1) / 25, 2)})` + VIZ.filaTooltip(C.s2, 'tratados', cnt(1)) + VIZ.filaTooltip(C.s1, 'controles', cnt(0)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: tres estimadores con el propensity score ---------- */

  function montarEstimadores(cuerpo) {
    let conf = 1.2, estratos = 5, semilla = 1, res = null, barras = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Confusión', min: 0, max: 3, paso: 0.1, valor: conf, formato: (v) => v.toFixed(1), alCambiar: (v) => { conf = v; }, alSoltar: () => calcular() });
    ctl.rango({ etiqueta: 'Estratos', min: 1, max: 20, valor: estratos, alCambiar: (v) => { estratos = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'diferencia ingenua', forma: 'cuadro' }, { color: C.s1, texto: 'estimadores del ATE', forma: 'cuadro' }, { color: C.s3, texto: 'estimador del ATT', forma: 'cuadro' },
      { color: C.s6, texto: 'ATE verdadero', forma: 'linea' }, { color: C.s4, texto: 'ATT verdadero', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con 1 estrato, estratificar es la diferencia ingenua; con 5 ya se elimina la mayor parte del sesgo (Cochran). IPW pondera a cada unidad por la inversa de la probabilidad del tratamiento que recibió. El matching por propensity estima el ATT, que aquí es mayor que el ATE porque los tratados son más graves.');
    function calcular() {
      const D = M.estudio(1500, semilla, { conf }), ps = ajustarPS(D), e = D.map((d) => Math.min(0.99, Math.max(0.01, ps.p(rasgos(d)))));
      const V = M.efectosVerdaderos(D);
      // Estratificación por cuantiles de e.
      const cortes = Array.from({ length: estratos + 1 }, (_, k) => M.cuantil(e, k / estratos));
      let est = 0, tot = 0;
      for (let k = 0; k < estratos; k++) {
        const g = D.filter((_, i) => e[i] >= cortes[k] && (k === estratos - 1 ? e[i] <= cortes[k + 1] : e[i] < cortes[k + 1]));
        const T = g.filter((d) => d.t), Cn = g.filter((d) => !d.t);
        if (!T.length || !Cn.length) continue;
        est += g.length * (M.media(T.map((d) => d.y)) - M.media(Cn.map((d) => d.y))); tot += g.length;
      }
      // IPW normalizado (Hájek).
      const wT = D.map((d, i) => (d.t ? 1 / e[i] : 0)), wC = D.map((d, i) => (d.t ? 0 : 1 / (1 - e[i])));
      const ipw = M.suma(D.map((d, i) => wT[i] * d.y)) / M.suma(wT) - M.suma(D.map((d, i) => wC[i] * d.y)) / M.suma(wC);
      const DE = D.map((d, i) => ({ ...d, e: e[i] }));
      const mt = M.emparejar(DE, (a, b) => Math.abs(a.e - b.e), { k: 1 });
      res = { V, items: [['ingenua', V.ingenuo, C.s8], ['estratos', est / tot, C.s1], ['IPW', ipw, C.s1], ['matching PS', mt.att, C.s3]] };
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const vals = [...res.items.map((x) => x[1]), res.V.ate, res.V.att];
      const pl = VIZ.plano(lienzo, { xmin: -0.5, xmax: 3.5, ymin: Math.min(0, ...vals) * 1.1, ymax: Math.max(...vals) * 1.15 }, { etiquetaY: 'efecto estimado', ticksX: [0, 1, 2, 3], formatoX: (v) => (res.items[v] || [''])[0] });
      pl.ejes();
      const bw = (pl.sx(1) - pl.sx(0)) * 0.55;
      barras = res.items.map(([t, v, col], i) => {
        const x = pl.sx(i) - bw / 2, y0 = pl.sy(0), y1 = pl.sy(v);
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, Math.min(y0, y1), bw, Math.abs(y1 - y0) || 1, v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]); ctx.fill();
        return { x0: x, x1: x + bw, t, v };
      });
      VIZ.trazar(ctx, pl, [[-0.5, res.V.ate], [3.5, res.V.ate]], C.s6, 2, [5, 4]);
      VIZ.trazar(ctx, pl, [[-0.5, res.V.att], [3.5, res.V.att]], C.s4, 2, [2, 3]);
      lectura.set([
        ['ATE verdadero · ATT verdadero', `${VIZ.fmt(res.V.ate, 3)} · ${VIZ.fmt(res.V.att, 3)}`],
        ...res.items.map(([t, v]) => [t, VIZ.fmt(v, 3)]),
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = barras.find((q) => x >= q.x0 && x <= q.x1);
      if (!b) return tip.ocultar();
      tip.mostrar(x, y, `${b.t}: <b>${VIZ.fmt(b.v, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('propensity-score', {
    intro: String.raw`
      <p>El <strong>propensity score</strong> \(e(x) = P(T = 1 \mid X = x)\) es la probabilidad de recibir el tratamiento dadas las covariables.
      Rosenbaum y Rubin (1983) mostraron que basta igualar este solo número entre tratados y controles para balancear <em>todas</em> las
      covariables que lo determinan.</p>
      <p>Así, un problema de ajuste en muchas dimensiones se vuelve unidimensional: se puede estratificar, emparejar o ponderar por \(e(x)\),
      que se estima con una <a href="tema.html?id=logistic-regression">regresión logística</a> u otro clasificador.</p>`,
    visualizaciones: [
      {
        titulo: 'Estimar e(x) y revisar el solapamiento',
        descripcion: 'El propensity score estimado y sus distribuciones por grupo. Donde no se solapan, no hay con quién comparar.',
        montar: montarPS,
      },
      {
        titulo: 'Tres estimadores con el propensity score',
        descripcion: 'Estratificación, ponderación por probabilidad inversa (IPW) y matching por e(x), frente al efecto verdadero.',
        montar: montarEstimadores,
      },
    ],
    teoria: String.raw`
      <h2>Propiedad de balance</h2>
      <div class="recuadro"><p>\(X \perp\!\!\!\perp T \mid e(X)\). Además, si hay ignorabilidad dado \(X\), \((Y(0), Y(1)) \perp\!\!\!\perp T \mid e(X)\):
      basta condicionar en el score.</p></div>
      <p>Entre unidades con el mismo \(e(x)\), la asignación es como al azar respecto de \(X\). El score es la «reducción» más gruesa de \(X\) que conserva esta propiedad.</p>
      <h2>Estimadores</h2>
      <ul>
        <li><strong>Estratificación</strong>: cortar \(\hat e\) en \(K\) cuantiles y promediar las diferencias de medias por estrato, ponderadas por su tamaño.
        Cinco estratos eliminan cerca del 90 % del sesgo por una covariable (Cochran, 1968).</li>
        <li><strong>Ponderación inversa (IPW)</strong>:
        \[ \widehat{\mathrm{ATE}} = \frac{1}{n}\sum_i \frac{T_i Y_i}{\hat e(X_i)} - \frac{1}{n}\sum_i \frac{(1 - T_i) Y_i}{1 - \hat e(X_i)}. \]
        Crea una pseudo-población en que el tratamiento no depende de \(X\). La versión normalizada (Hájek) divide por la suma de pesos.</li>
        <li><strong>Matching por score</strong>: emparejar con distancia \(|\hat e_i - \hat e_j|\) (a menudo en escala logit, con caliper de 0,2 desviaciones).</li>
      </ul>
      <h2>Solapamiento</h2>
      <p>Si \(\hat e(x)\) es cercano a 0 o 1, los pesos \(1/\hat e\) explotan y la estimación se vuelve inestable. Se recorta la muestra a la región de soporte común,
      por ejemplo \(\hat e \in [0{,}1;\ 0{,}9]\), a costa de cambiar la población objetivo.</p>
      <h2>Cuidados</h2>
      <p>El score debe estimarse con las covariables de confusión (pre-tratamiento), no con mediadores ni con variables que solo predicen el tratamiento
      (instrumentos), que aumentan la varianza. Un buen modelo de \(e\) no es el que mejor predice \(T\), sino el que produce
      <a href="tema.html?id=covariate-balance">balance</a>. Combinarlo con un modelo de resultado da estimadores
      <a href="tema.html?id=outcome-models">doblemente robustos</a>.</p>`,
  });
})();