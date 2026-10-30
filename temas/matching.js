(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const planoCov = (l, margen) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return VIZ.plano(l, { xmin: -3.2 * a, xmax: 3.2 * a, ymin: -3.2, ymax: 3.2 }, { etiquetaX: 'edad (estandarizada)', etiquetaY: 'gravedad', margen: margen || { izq: 40 } }); };
  function distancia(D, tipo) {
    if (tipo === 'mahalanobis') {
      const { S } = M.covarianza(D.map((d) => [d.x1, d.x2]));
      return (a, b) => M.mahalanobis2(a.x1, a.x2, [b.x1, b.x2], S);
    }
    return (a, b) => Math.hypot(a.x1 - b.x1, a.x2 - b.x2);
  }

  /* ---------- Fig. 1: vecino más cercano ---------- */

  function montarVecinos(cuerpo) {
    let metrica = 'euclidiana', k = 1, caliper = 1, reemplazo = true, semilla = 2, D = M.estudio(160, semilla, { conf: 1.4 });
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Distancia', opciones: [['euclidiana', 'Euclidiana'], ['mahalanobis', 'Mahalanobis']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Controles por tratado k', min: 1, max: 5, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Caliper (distancia máxima)', min: 0.05, max: 2, paso: 0.05, valor: caliper, formato: (v) => (v >= 2 ? '∞' : v.toFixed(2)), alCambiar: (v) => { caliper = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'con reemplazo (un control puede usarse varias veces)', valor: reemplazo, alCambiar: (v) => { reemplazo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; D = M.estudio(160, semilla, { conf: 1.4 }); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'tratado', forma: 'cuadro' }, { color: C.s1, texto: 'control', forma: 'punto' },
      { color: C.s4, texto: 'pareja', forma: 'linea' },
      { color: C.s8, texto: 'tratado sin pareja (fuera del caliper)', forma: 'linea' },
      { color: C.inactivo, texto: 'control no usado', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los tratados se concentran arriba (más graves). Cada uno se compara con sus k controles más parecidos. Un caliper chico descarta tratados sin buenos controles: menos sesgo, pero el efecto se estima para un grupo distinto.');
    let pl = null, R = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoCov(lienzo);
      pl.ejes();
      R = M.emparejar(D, distancia(D, metrica), { k, caliper: caliper >= 2 ? Infinity : caliper, reemplazo });
      const usados = new Set(R.pares.flatMap((p) => p.js)), conPareja = new Set(R.pares.map((p) => p.i));
      ctx.save(); pl.recortar();
      for (const p of R.pares) for (const j of p.js) VIZ.trazar(ctx, pl, [[D[p.i].x1, D[p.i].x2], [D[j].x1, D[j].x2]], C.s4, 1.5);
      ctx.restore();
      M.dispersion(ctx, pl, D.map((d) => ({ x: d.x1, y: d.x2, d })), {
        color: (p, i) => (p.d.t ? C.s2 : usados.has(i) ? C.s1 : C.inactivo), forma: (p) => (p.d.t ? 1 : 0), r: 3.4,
        anillo: (p, i) => (p.d.t && !conPareja.has(i) ? C.s8 : null),
      });
      const V = M.efectosVerdaderos(D);
      const attSub = M.media(R.pares.map((p) => D[p.i].tau));
      lectura.set([
        ['ATT estimado por matching', VIZ.fmt(R.att, 3)],
        ['ATT verdadero (tratados emparejados)', VIZ.fmt(attSub, 3)],
        ['diferencia ingenua', VIZ.fmt(V.ingenuo, 3)],
        ['tratados sin pareja · controles usados', `${R.descartados} · ${usados.size}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      let m = -1, dm = 9;
      if (pl) D.forEach((d, i) => { const q = Math.hypot(pl.sx(d.x1) - x, pl.sy(d.x2) - y); if (q < dm) { dm = q; m = i; } });
      if (m < 0) return tip.ocultar();
      const d = D[m], p = R.pares.find((q) => q.i === m);
      tip.mostrar(x, y, `${d.t ? 'tratado' : 'control'}: Y = <b>${VIZ.fmt(d.y, 3)}</b>${p ? `<br>media de sus controles <b>${VIZ.fmt(M.media(p.js.map((j) => D[j].y)), 3)}</b>` : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: matching exacto por estratos (CEM) ---------- */

  function montarCEM(cuerpo) {
    let cortes = 4, semilla = 3, D = M.estudio(500, semilla, { conf: 1.4 }), filas = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Cortes por covariable', min: 1, max: 14, valor: cortes, alCambiar: (v) => { cortes = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; D = M.estudio(500, semilla, { conf: 1.4 }); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.4) : Math.min(400, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'celda con tratados y controles (se usa)' },
      { color: C.neutro, texto: 'celda descartada', borde: C.rejilla },
      { color: C.s8, texto: '|sesgo| del ATT estimado', forma: 'linea' },
      { color: C.s1, texto: 'tratados conservados', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Matching exacto «grueso»: cada covariable se corta en intervalos y se comparan tratados y controles de la misma celda. Pocos cortes dejan celdas heterogéneas (sesgo); muchos dejan celdas sin pareja (se pierden tratados y crece la varianza).');
    function cem(D, q) {
      const b = (v) => Math.min(q - 1, Math.max(0, Math.floor(((v + 3) / 6) * q)));
      const celdas = new Map();
      D.forEach((d) => { const c = `${b(d.x1)},${b(d.x2)}`; if (!celdas.has(c)) celdas.set(c, []); celdas.get(c).push(d); });
      let suma = 0, nT = 0, verdad = 0;
      for (const g of celdas.values()) {
        const T = g.filter((d) => d.t), Cn = g.filter((d) => !d.t);
        if (!T.length || !Cn.length) continue;
        const mc = M.media(Cn.map((d) => d.y));
        T.forEach((d) => { suma += d.y - mc; verdad += d.tau; nT++; });
      }
      return { celdas, att: suma / nT, verdad: verdad / nT, nT, b };
    }
    function calcular() { filas = Array.from({ length: 14 }, (_, i) => { const r = cem(D, i + 1); return { q: i + 1, sesgo: Math.abs(r.att - r.verdad), ret: r.nT / D.filter((d) => d.t).length }; }); dibujar(); }
    let pc = null, oc = { x: 0, y: 0 };
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.55 : H;
      ctx.save();
      const pl = planoCov({ ...lienzo, ancho: wA, alto: hA, ctx });
      const r = cem(D, cortes), ancho = 6 / cortes;
      for (let i = 0; i < cortes; i++) for (let j = 0; j < cortes; j++) {
        const g = r.celdas.get(`${i},${j}`) || [], ok = g.some((d) => d.t) && g.some((d) => !d.t);
        ctx.fillStyle = ok ? VIZ.alfa(C.s3, 0.18) : C.neutro;
        ctx.fillRect(pl.sx(-3 + i * ancho), pl.sy(-3 + (j + 1) * ancho), pl.sx(-3 + (i + 1) * ancho) - pl.sx(-3 + i * ancho), pl.sy(-3 + j * ancho) - pl.sy(-3 + (j + 1) * ancho));
      }
      pl.ejes();
      M.dispersion(ctx, pl, D.map((d) => ({ x: d.x1, y: d.x2, d })), { color: (p) => (p.d.t ? C.s2 : C.s1), forma: (p) => (p.d.t ? 1 : 0), r: 2.4 });
      ctx.restore();
      ctx.save();
      oc = { x: vertical ? 0 : wA, y: vertical ? hA : 0 };
      ctx.translate(oc.x, oc.y);
      pc = VIZ.plano({ ...lienzo, ancho: W - oc.x, alto: H - oc.y, ctx }, { xmin: 1, xmax: 14, ymin: 0, ymax: Math.max(1, ...filas.map((f) => f.sesgo)) * 1.05 }, { etiquetaX: 'cortes por covariable', etiquetaY: '|sesgo| · fracción conservada' });
      pc.ejes();
      VIZ.trazar(ctx, pc, filas.map((f) => [f.q, f.sesgo]), C.s8, 2);
      VIZ.trazar(ctx, pc, filas.map((f) => [f.q, f.ret * pc.d.ymax]), C.s1, 2);
      const f = filas[cortes - 1];
      VIZ.marcador(ctx, pc.sx(cortes), pc.sy(f.sesgo), C.s8, 5); VIZ.marcador(ctx, pc.sx(cortes), pc.sy(f.ret * pc.d.ymax), C.s1, 5);
      if (hover) VIZ.trazar(ctx, pc, [[hover.q, 0], [hover.q, pc.d.ymax]], C.apagado, 1, [3, 3]);
      ctx.restore();
      lectura.set([
        ['ATT estimado (CEM)', VIZ.fmt(r.att, 3)],
        ['ATT verdadero de los conservados', VIZ.fmt(r.verdad, 3)],
        ['tratados conservados', `${r.nT} de ${D.filter((d) => d.t).length}`],
        ['diferencia ingenua', VIZ.fmt(M.efectosVerdaderos(D).ingenuo, 3)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pc || !pc.dentro(x - oc.x, y - oc.y)) { if (hover) { hover = null; dibujar(); } return tip.ocultar(); }
      hover = filas[Math.max(0, Math.min(13, Math.round(pc.ix(x - oc.x)) - 1))];
      dibujar();
      tip.mostrar(x, y, `${hover.q} cortes` + VIZ.filaTooltip(C.s8, '|sesgo|', VIZ.fmt(hover.sesgo, 3)) + VIZ.filaTooltip(C.s1, 'tratados conservados', M.pct(hover.ret, 0)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('matching', {
    intro: String.raw`
      <p>Si el tratamiento no se asignó al azar, los tratados y los controles difieren en sus covariables y compararlos directamente
      mezcla el efecto del tratamiento con esas diferencias. El <strong>matching</strong> construye, para cada tratado, un «gemelo»
      no tratado con covariables parecidas, y compara solo entre gemelos.</p>
      <p>Hay que decidir qué es «parecido»: la <strong>distancia</strong> entre covariables, cuántos controles usar, cuánta diferencia tolerar
      (el <em>caliper</em>) y si el matching es <strong>exacto</strong> (mismas categorías) o <strong>inexacto</strong> (vecinos cercanos).</p>`,
    visualizaciones: [
      {
        titulo: 'Vecino más cercano',
        descripcion: 'Cada tratado (cuadrado naranjo) unido a sus controles más cercanos. Cambie la distancia, k y el caliper y compare el ATT estimado con el verdadero.',
        montar: montarVecinos,
      },
      {
        titulo: 'Matching exacto por estratos',
        descripcion: 'Coarsened exact matching: la rejilla define los estratos. El segundo gráfico muestra el sesgo y la fracción de tratados conservados según el número de cortes.',
        montar: montarCEM,
      },
    ],
    teoria: String.raw`
      <h2>Estimador del ATT por matching</h2>
      <p>Con \(\mathcal J(i)\) los controles emparejados con el tratado \(i\):</p>
      \[ \widehat{\mathrm{ATT}} = \frac{1}{n_1} \sum_{i : T_i = 1} \Bigl( Y_i - \frac{1}{|\mathcal J(i)|} \sum_{j \in \mathcal J(i)} Y_j \Bigr). \]
      <p>Imputa el contrafactual \(Y_i(0)\) con los resultados de los gemelos. Bajo ignorabilidad dado \(X\), si los gemelos tienen las mismas \(X\), el
      estimador es insesgado. Para el ATE se empareja también cada control con tratados.</p>
      <h2>Distancias</h2>
      <table>
        <tr><th>Distancia</th><th>Fórmula</th><th>Comentario</th></tr>
        <tr><td>Exacta</td><td>0 si \(x_i = x_j\), si no \(\infty\)</td><td>ideal con pocas covariables discretas</td></tr>
        <tr><td>Euclidiana</td><td>\(\lVert x_i - x_j\rVert\)</td><td>depende de las escalas (<a href="tema.html?id=feature-scaling">escalar</a> antes)</td></tr>
        <tr><td>Mahalanobis</td><td>\(\sqrt{(x_i - x_j)^\top S^{-1}(x_i - x_j)}\)</td><td>invariante a escala, considera correlaciones</td></tr>
        <tr><td><a href="tema.html?id=propensity-score">Propensity score</a></td><td>\(|e(x_i) - e(x_j)|\)</td><td>reduce todas las covariables a una</td></tr>
      </table>
      <h2>Decisiones y compromisos</h2>
      <ul>
        <li><strong>k controles por tratado</strong>: más controles reducen la varianza, pero los más lejanos agregan sesgo.</li>
        <li><strong>Caliper</strong>: descartar parejas lejanas reduce el sesgo, pero cambia la población: el efecto estimado ya no es el ATT de todos.</li>
        <li><strong>Con o sin reemplazo</strong>: con reemplazo, las parejas son mejores pero algunos controles pesan mucho.</li>
        <li><strong>Coarsened exact matching</strong>: discretizar cada covariable y emparejar exactamente dentro de cada celda; el número de cortes controla
        el compromiso sesgo–tamaño. Con muchas covariables las celdas se vacían (<a href="tema.html?id=curse-of-dimensionality">maldición de la dimensionalidad</a>).</li>
      </ul>
      <p>Después de emparejar hay que revisar el <a href="tema.html?id=covariate-balance">balance de covariables</a>: el matching es un medio para
      lograr grupos comparables, no un fin.</p>`,
  });
})();