(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: observar frente a intervenir ---------- */

  function montarCirugia(cuerpo) {
    let conf = 1, efecto = 0.5, intervenir = false, x0 = 1, semilla = 1, D = [], Di = [];
    const G = M.dag([['Z', 0.5, 0.1], ['X', 0.12, 0.85], ['Y', 0.88, 0.85]], [[0, 1], [0, 2], [1, 2]]);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Fuerza del confusor Z', min: 0, max: 1.5, paso: 0.05, valor: conf, formato: (v) => v.toFixed(2), alCambiar: (v) => { conf = v; generar(); } });
    ctl.rango({ etiqueta: 'Efecto causal X → Y', min: -1, max: 1, paso: 0.05, valor: efecto, formato: (v) => v.toFixed(2), alCambiar: (v) => { efecto = v; generar(); } });
    ctl.rango({ etiqueta: 'Valor x₀', min: -2, max: 2, paso: 0.1, valor: x0, formato: (v) => v.toFixed(1), alCambiar: (v) => { x0 = v; generar(); } });
    ctl.casilla({ etiqueta: 'mostrar el grafo intervenido do(X = x₀)', valor: intervenir, alCambiar: (v) => { intervenir = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.3) : Math.min(400, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'E[Y | X = x] (observar)', forma: 'linea' },
      { color: C.s1, texto: 'E[Y | do(X = x)] (intervenir)', forma: 'linea' },
      { color: C.tinta2, texto: 'datos observacionales', forma: 'punto' },
      { color: C.s4, texto: 'Y bajo do(X = x₀)', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Observar X = x₀ selecciona a los individuos que tienen ese valor, y con ellos un Z típico de ese grupo. Intervenir fija X = x₀ para todos sin tocar Z: la flecha Z → X desaparece. La diferencia entre las pendientes es el sesgo de confusión.');
    const coef = () => ({ '0,1': conf, '0,2': conf, '1,2': efecto });
    function generar() {
      D = M.simularSCM(G, coef(), 400, semilla);
      Di = M.simularSCM(G, coef(), 120, semilla + 99, { hacer: { 1: x0 } });
      dibujar();
    }
    let pl = null, ox = 0, oy = 0;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wG = vertical ? W : W * 0.3, hG = vertical ? H * 0.28 : H;
      VIZ.grafo.dibujar({ ...lienzo, ancho: wG, alto: hG, ctx }, G, {
        arista: (a) => (a.u === 0 && a.v === 1 && intervenir ? { color: C.s8, guiones: [4, 4], ancho: 1.5 } : { color: a.u === 1 ? C.s1 : C.apagado, ancho: 2 }),
        nodo: (i) => (i === 1 && intervenir ? { relleno: C.s4, borde: C.s4 } : {}),
        debajo: (i) => (i === 1 && intervenir ? `do(X = ${VIZ.fmt(x0, 2)})` : ''),
      });
      ox = vertical ? 0 : wG; oy = vertical ? hG : 0;
      ctx.save(); ctx.translate(ox, oy);
      pl = VIZ.plano({ ...lienzo, ancho: W - ox, alto: H - oy, ctx }, { xmin: -4, xmax: 4, ymin: -5, ymax: 5 }, { etiquetaX: 'X', etiquetaY: 'Y', margen: { izq: 40 } });
      pl.ejes();
      M.dispersion(ctx, pl, D.map((d) => ({ x: d[1], y: d[2] })), { color: () => VIZ.alfa(C.tinta2, 0.5), r: 2.2 });
      M.dispersion(ctx, pl, Di.map((d, i) => ({ x: d[1] + (((i * 37) % 11) - 5) * 0.015, y: d[2] })), { color: () => C.s4, r: 2.6 });
      const b = M.regresion(D, 2, [1]);
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, [[-4, b[0] - 4 * b[1]], [4, b[0] + 4 * b[1]]], C.s2, 2.5);
      VIZ.trazar(ctx, pl, [[-4, -4 * efecto], [4, 4 * efecto]], C.s1, 2.5);
      ctx.restore(); ctx.restore();
      const cerca = D.filter((d) => Math.abs(d[1] - x0) < 0.3);
      lectura.set([
        ['E[Y | X ≈ x₀] (datos)', cerca.length ? VIZ.fmt(M.media(cerca.map((d) => d[2])), 3) : '—'],
        ['E[Y | do(X = x₀)] (simulado)', VIZ.fmt(M.media(Di.map((d) => d[2])), 3)],
        ['pendiente observada', VIZ.fmt(b[1], 3)],
        ['efecto causal', VIZ.fmt(efecto, 3)],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x - ox, y - oy)) return tip.ocultar();
      const v = pl.ix(x - ox), b = M.regresion(D, 2, [1]);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(v, 2)}</b>` + VIZ.filaTooltip(C.s2, 'E[Y | X = x]', VIZ.fmt(b[0] + b[1] * v, 3)) + VIZ.filaTooltip(C.s1, 'E[Y | do(x)]', VIZ.fmt(efecto * v, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: mediadores ---------- */

  function montarMediacion(cuerpo) {
    let a = 0.8, b = 0.7, c = 0.3, semilla = 1, res = null, barras = [];
    const G = M.dag([['X', 0.1, 0.8], ['M', 0.5, 0.15], ['Y', 0.9, 0.8]], [[0, 1], [1, 2], [0, 2]]);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'X → M (a)', min: -1, max: 1, paso: 0.05, valor: a, formato: (v) => v.toFixed(2), alCambiar: (v) => { a = v; calcular(); } });
    ctl.rango({ etiqueta: 'M → Y (b)', min: -1, max: 1, paso: 0.05, valor: b, formato: (v) => v.toFixed(2), alCambiar: (v) => { b = v; calcular(); } });
    ctl.rango({ etiqueta: 'X → Y directo (c)', min: -1, max: 1, paso: 0.05, valor: c, formato: (v) => v.toFixed(2), alCambiar: (v) => { c = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.15) : Math.min(340, Math.round(w * 0.36))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor teórico', forma: 'cuadro' }, { color: C.s2, texto: 'estimado con intervenciones simuladas', forma: 'cuadro' }, { color: C.s3, texto: 'regresión observacional: Y ~ X (total), Y ~ X + M (directo)', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El efecto total de X es lo que cambia Y al intervenir X: c + a·b. El directo es el cambio con M fijada por intervención: c. Controlar por M en una regresión estima el directo, no el total: ajustar por un mediador cambia la pregunta. Pruebe c = −a·b: efecto total nulo con efectos parciales grandes.');
    function calcular() {
      const coef = { '0,1': a, '1,2': b, '0,2': c }, n = 3000;
      const y = (hacer) => M.media(M.simularSCM(G, coef, n, semilla + 7, { hacer }).map((d) => d[2]));
      const total = y({ 0: 1 }) - y({ 0: 0 }), directo = y({ 0: 1, 1: 0 }) - y({ 0: 0, 1: 0 });
      const D = M.simularSCM(G, coef, n, semilla);
      const rXM = M.regresion(D, 2, [0, 1]), rX = M.regresion(D, 2, [0]);
      res = { teo: [c + a * b, c, a * b], sim: [total, directo, total - directo], reg: [rX[1], rXM[1], rX[1] - rXM[1]] };
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wG = vertical ? W : W * 0.3, hG = vertical ? H * 0.3 : H;
      VIZ.grafo.dibujar({ ...lienzo, ancho: wG, alto: hG, ctx }, G, { arista: (e) => ({ color: C.apagado, ancho: 1 + 2 * Math.abs([a, b, c][e.u === 0 && e.v === 1 ? 0 : e.u === 1 ? 1 : 2]) }) });
      ctx.save();
      const ox = vertical ? 0 : wG, oy = vertical ? hG : 0;
      ctx.translate(ox, oy);
      const vals = [...res.teo, ...res.sim, ...res.reg];
      const lo = Math.min(-0.2, ...vals) * 1.1, hi = Math.max(0.2, ...vals) * 1.1;
      const pl = VIZ.plano({ ...lienzo, ancho: W - ox, alto: H - oy, ctx }, { xmin: -0.5, xmax: 2.5, ymin: lo, ymax: hi }, { etiquetaY: 'efecto sobre Y de subir X en 1', ticksX: [0, 1, 2], formatoX: (v) => ['total', 'directo', 'indirecto'][v] || '' });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[-0.5, 0], [2.5, 0]], C.eje, 1);
      const bw = (pl.sx(1) - pl.sx(0)) * 0.24;
      barras = [];
      [[res.teo, C.s1, 'teórico'], [res.sim, C.s2, 'intervenciones'], [res.reg, C.s3, 'regresión']].forEach(([v, col, t], j) => v.forEach((val, i) => {
        const x = pl.sx(i) - 1.5 * bw + j * bw, y0 = pl.sy(0), y1 = pl.sy(val);
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x + 1, Math.min(y0, y1), bw - 2, Math.abs(y1 - y0) || 1, val >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]); ctx.fill();
        barras.push({ x0: x + ox, x1: x + bw + ox, t, val, cual: ['total', 'directo', 'indirecto'][i] });
      }));
      ctx.restore();
      lectura.set([
        ['total c + ab', `${VIZ.fmt(res.teo[0], 3)} (simulado ${VIZ.fmt(res.sim[0], 3)})`],
        ['directo c', `${VIZ.fmt(res.teo[1], 3)} (simulado ${VIZ.fmt(res.sim[1], 3)})`],
        ['indirecto ab', VIZ.fmt(res.teo[2], 3)],
        ['coef. de X controlando M', VIZ.fmt(res.reg[1], 3)],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), q = barras.find((r) => x >= r.x0 && x <= r.x1);
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, `efecto ${q.cual} · ${q.t}<br><b>${VIZ.fmt(q.val, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('do-operator', {
    intro: String.raw`
      <p>El <strong>operador do</strong> de Judea Pearl separa dos preguntas que el lenguaje cotidiano confunde. \(P(Y \mid X = x)\) pregunta
      «entre quienes <em>tienen</em> \(X = x\), ¿cómo es \(Y\)?». \(P(Y \mid \operatorname{do}(X = x))\) pregunta «si <em>obligáramos</em> a todos a tener
      \(X = x\), ¿cómo sería \(Y\)?».</p>
      <p>Intervenir equivale a hacer <strong>cirugía en el grafo</strong>: se borran las flechas que entran en \(X\) y el resto del mecanismo queda
      igual. Con esa idea se definen los efectos causales y se razona sobre <strong>mediadores</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Observar frente a intervenir',
        descripcion: 'Con un confusor Z, la recta de regresión observada no coincide con el efecto de intervenir. Lleve el confusor a 0 y las dos rectas se juntan.',
        montar: montarCirugia,
      },
      {
        titulo: 'Efectos total, directo e indirecto',
        descripcion: 'X afecta a Y directamente y a través del mediador M. Compare los efectos teóricos, los que se miden interviniendo y lo que da una regresión.',
        montar: montarMediacion,
      },
    ],
    teoria: String.raw`
      <h2>Intervención</h2>
      <p>En un modelo causal estructural con ecuaciones \(X_i := f_i(\operatorname{Pa}_i, U_i)\), la intervención \(\operatorname{do}(X = x)\) reemplaza
      la ecuación de \(X\) por \(X := x\). La distribución resultante se obtiene con la <strong>factorización truncada</strong>:</p>
      \[ P(v_1, \dots, v_n \mid \operatorname{do}(X = x)) = \prod_{i : V_i \neq X} P(v_i \mid \operatorname{pa}_i)\ \Big|_{X = x}. \]
      <p>Se omite el factor \(P(x \mid \operatorname{pa}_X)\): \(X\) ya no depende de sus causas.</p>
      <h2>Efecto causal</h2>
      <p>Para \(X\) binaria, el efecto causal promedio es \(\mathrm{ATE} = \mathbb E[Y \mid \operatorname{do}(X = 1)] - \mathbb E[Y \mid \operatorname{do}(X = 0)]\)
      (ver <a href="tema.html?id=potential-outcomes">resultados potenciales</a>). En el modelo lineal \(Z \to X \to Y\), \(Z \to Y\):</p>
      \[ \mathbb E[Y \mid \operatorname{do}(x)] = \beta_{XY}\, x, \qquad \mathbb E[Y \mid x] = \Bigl(\beta_{XY} + \frac{\beta_{ZY}\,\beta_{ZX}}{\beta_{ZX}^2 + 1}\Bigr) x. \]
      <p>El término extra es el sesgo de confusión. Si se puede ajustar por \(Z\), \(P(y \mid \operatorname{do}(x)) = \sum_z P(y \mid x, z) P(z)\)
      (<a href="tema.html?id=backdoor-frontdoor">fórmula de ajuste</a>).</p>
      <h2>Mediación</h2>
      <p>Con \(X \to M \to Y\) y \(X \to Y\) lineales (coeficientes \(a, b, c\)):</p>
      <table>
        <tr><th>Efecto</th><th>Definición</th><th>Valor lineal</th></tr>
        <tr><td>Total</td><td>\(\mathbb E[Y \mid \operatorname{do}(x + 1)] - \mathbb E[Y \mid \operatorname{do}(x)]\)</td><td>\(c + ab\)</td></tr>
        <tr><td>Directo controlado</td><td>igual, con \(\operatorname{do}(M = m)\) fijo</td><td>\(c\)</td></tr>
        <tr><td>Indirecto</td><td>total − directo</td><td>\(ab\)</td></tr>
      </table>
      <div class="recuadro"><p>Ajustar por un mediador en una regresión no elimina un sesgo: cambia el estimando del efecto total al directo.
      Si además hubiera una causa común de \(M\) e \(Y\), condicionar en \(M\) (un collider en el camino \(X \to M \leftarrow U \to Y\)) introduciría sesgo.</p></div>`,
  });
})();