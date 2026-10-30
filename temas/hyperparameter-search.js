(function () {
  'use strict';
  const { color: C } = VIZ;

  // Superficie de validación de ejemplo (no medida): la tasa de aprendizaje importa mucho; el decaimiento de pesos, poco.
  const sup = (lr, wd) => 0.93 * Math.exp(-((lr + 2.3) ** 2) / 0.5) * (0.75 + 0.25 * Math.exp(-((wd + 3.4) ** 2) / 6)) + 0.07;
  const REAL = (lr, wd, r) => Math.min(0.99, Math.max(0, sup(lr, wd) + 0.012 * VIZ.normal(r)));

  /* ---------- Fig. 1: cuadrícula frente a búsqueda aleatoria ---------- */

  function montarBusqueda(cuerpo) {
    let n = 16, semilla = 1, geo = null, g = [], a = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto (entrenamientos)', min: 4, max: 49, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.boton('Otra búsqueda aleatoria', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 380 : 560) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cuadrícula', forma: 'punto' }, { color: C.s2, texto: 'búsqueda aleatoria', forma: 'cuadro' }, { color: C.s6, texto: 'mejor punto de cada método', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Superficie de exactitud de validación de ejemplo (inventada, pero con la forma típica: la tasa de aprendizaje es decisiva y el decaimiento de pesos, secundario). Con el mismo presupuesto, la cuadrícula prueba pocos valores distintos de cada hiperparámetro; la búsqueda aleatoria, tantos como puntos.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 700, S = ancha ? Math.min(330, W * 0.4) : Math.min(W - 40, 320);
      const k = Math.max(2, Math.round(Math.sqrt(n))), r = VIZ.semilla(semilla * 13 + 1), rr = VIZ.semilla(semilla * 7 + 3);
      g = []; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { const lr = -4 + (5 * (i + 0.5)) / k, wd = -6 + (5 * (j + 0.5)) / k; g.push({ lr, wd, v: REAL(lr, wd, rr) }); }
      a = Array.from({ length: n }, () => { const lr = -4 + 5 * r(), wd = -6 + 5 * r(); return { lr, wd, v: REAL(lr, wd, rr) }; });
      lienzo.limpiar();
      const pintar = (x0, y0, puntos, col, tit, forma) => {
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(tit, x0, y0 - 6);
        for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const lr = -4 + (5 * (i + 0.5)) / 40, wd = -6 + (5 * (j + 0.5)) / 40; ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.min(1, sup(lr, wd) / 1))); ctx.globalAlpha = 0.5; ctx.fillRect(x0 + (i * S) / 40, y0 + S - ((j + 1) * S) / 40, S / 40 + 0.5, S / 40 + 0.5); }
        ctx.globalAlpha = 1; ctx.strokeStyle = C.eje; ctx.strokeRect(x0 + 0.5, y0 + 0.5, S, S);
        const mx = puntos.reduce((m, p) => (p.v > m.v ? p : m), puntos[0]);
        puntos.forEach((p) => VIZ.marcador(ctx, x0 + ((p.lr + 4) / 5) * S, y0 + S - ((p.wd + 6) / 5) * S, p === mx ? C.s6 : col, p === mx ? 6 : 4, forma));
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('tasa de aprendizaje (10^x) →', x0 + S / 2, y0 + S + 4); ctx.save(); ctx.translate(x0 - 10, y0 + S / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('decaimiento de pesos (10^x) →', 0, 0); ctx.restore();
        return mx;
      };
      const x2 = ancha ? 30 + S + 40 : 30, y1 = 28, y2 = ancha ? 28 : 28 + S + 56;
      const mg = pintar(30, y1, g, C.s1, `Cuadrícula (${k}×${k} = ${k * k} puntos)`, 0), ma = pintar(x2, y2, a, C.s2, `Aleatoria (${n} puntos)`, 1);
      geo = { x0: 30, y1, x2, y2, S };
      const dist = (p) => new Set(p.map((q) => q.lr.toFixed(4))).size;
      registro.textContent = `Mejor exactitud de validación: cuadrícula ${VIZ.fmt(100 * mg.v, 3)} %, aleatoria ${VIZ.fmt(100 * ma.v, 3)} %. Valores distintos de la tasa de aprendizaje probados: ${dist(g)} frente a ${dist(a)}.`;
      lectura.set([['mejor, cuadrícula', `${VIZ.fmt(100 * mg.v, 3)} %`], ['mejor, aleatoria', `${VIZ.fmt(100 * ma.v, 3)} %`], ['valores de lr probados (cuadrícula)', String(dist(g))], ['valores de lr probados (aleatoria)', String(dist(a))], ['óptimo real de la superficie', `${VIZ.fmt(100 * sup(-2.3, -3.4), 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!geo) return; const en = (x0, y0) => (x >= x0 && x <= x0 + geo.S && y >= y0 && y <= y0 + geo.S ? [-4 + (5 * (x - x0)) / geo.S, -6 + (5 * (y0 + geo.S - y)) / geo.S] : null), p = en(geo.x0, geo.y1) || en(geo.x2, geo.y2); if (p) tip.mostrar(x, y, `lr = 10^${VIZ.fmt(p[0], 2)}, decaimiento = 10^${VIZ.fmt(p[1], 2)}<br>exactitud media <b>${VIZ.fmt(100 * sup(...p), 3)} %</b>`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: elegir con la validación infla el resultado ---------- */

  function montarSesgo(cuerpo) {
    let nVal = 200, semilla = 1, res = [], hover = -1, pl = null;
    const NS = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ejemplos de validación', min: 50, max: 2000, paso: 50, valor: nVal, alCambiar: (v) => { nVal = v; calcular(); } });
    ctl.boton('Repetir el experimento', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'exactitud de validación del mejor candidato', forma: 'linea' }, { color: C.s1, texto: 'exactitud de prueba del mismo candidato', forma: 'linea' }, { color: C.apagado, texto: 'exactitud real de todos (70 %)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Se prueban n configuraciones que en realidad son todas igual de buenas (70 % de exactitud), y se elige la de mayor exactitud en validación. Esa cifra sale inflada por azar: el máximo de n estimaciones ruidosas supera a su media. La prueba, que no participó en la elección, da la cifra honesta. Promedio de 400 repeticiones.');
    function calcular() {
      const r = VIZ.semilla(semilla * 31 + nVal), p = 0.7, s = Math.sqrt((p * (1 - p)) / nVal);
      res = NS.map((n) => { let v = 0, t = 0; const R = 400; for (let q = 0; q < R; q++) { let mx = -1; for (let k = 0; k < n; k++) mx = Math.max(mx, p + s * VIZ.normal(r)); v += mx / R; t += (p + s * VIZ.normal(r)) / R; } return { n, v, t }; });
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: NS.length - 1, ymin: 0.66, ymax: 0.82 }, { etiquetaX: 'configuraciones probadas (n)', etiquetaY: 'exactitud', ticksX: NS.map((_, i) => i), formatoX: (v) => String(NS[Math.round(v)]), formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, 0.7], [NS.length - 1, 0.7]], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, pl, res.map((q, i) => [i, q.v]), C.s2, 2.5); VIZ.trazar(ctx, pl, res.map((q, i) => [i, q.t]), C.s1, 2.5);
      res.forEach((q, i) => { VIZ.marcador(ctx, pl.sx(i), pl.sy(q.v), C.s2, hover === i ? 6 : 4); VIZ.marcador(ctx, pl.sx(i), pl.sy(q.t), C.s1, hover === i ? 6 : 4); });
      const u = res[res.length - 1];
      registro.textContent = `Con ${u.n} configuraciones, la validación del «mejor» promete ${VIZ.fmt(100 * u.v, 3)} %, pero en la prueba rinde ${VIZ.fmt(100 * u.t, 3)} %: un optimismo de ${VIZ.fmt(100 * (u.v - u.t), 3)} puntos.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y) || !res.length) { hover = -1; tip.ocultar(); return dibujar(); } hover = Math.max(0, Math.min(NS.length - 1, Math.round(pl.ix(x)))); dibujar(); tip.mostrar(x, y, `<b>${NS[hover]}</b> configuraciones` + VIZ.filaTooltip(C.s2, 'validación', `${VIZ.fmt(100 * res[hover].v, 3)} %`) + VIZ.filaTooltip(C.s1, 'prueba', `${VIZ.fmt(100 * res[hover].t, 3)} %`)); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('hyperparameter-search', {
    intro: String.raw`
      <p>Los <strong>hiperparámetros</strong> —tasa de aprendizaje, tamaño del lote, número de capas, regularización— no los aprende el entrenamiento: los fija quien lo hace. Se eligen entrenando muchas veces y comparando el rendimiento en un conjunto de <strong>validación</strong> que el entrenamiento no usa.</p>
      <p>Cómo buscar y cómo evaluar importan. La <strong>búsqueda aleatoria</strong> suele superar a la cuadrícula con el mismo presupuesto cuando solo unos pocos hiperparámetros importan. Y cuantas más configuraciones se prueban, más se «sobreajusta» la validación: la cifra final debe medirse en un conjunto de <strong>prueba</strong> intocado.</p>`,
    visualizaciones: [
      { titulo: 'Cuadrícula frente a búsqueda aleatoria', descripcion: 'Con el mismo presupuesto, cuente cuántos valores distintos de la tasa de aprendizaje prueba cada método. Repita la búsqueda aleatoria varias veces.', montar: montarBusqueda },
      { titulo: 'Elegir con la validación infla el resultado', descripcion: 'Aumente el número de configuraciones probadas y compare la cifra de validación con la de prueba. Reduzca los ejemplos de validación y vea que el efecto crece.', montar: montarSesgo },
    ],
    teoria: String.raw`
      <h2>Métodos de búsqueda</h2>
      <table>
        <tr><th>Método</th><th>Idea</th><th>Cuándo</th></tr>
        <tr><td>Cuadrícula</td><td>Probar todas las combinaciones de una lista de valores</td><td>Pocos hiperparámetros (≤ 2–3)</td></tr>
        <tr><td>Aleatoria</td><td>Muestrear cada hiperparámetro de una distribución (a menudo log-uniforme)</td><td>Casi siempre mejor que la cuadrícula a igual costo</td></tr>
        <tr><td>Bayesiana</td><td>Modelar el rendimiento como función de los hiperparámetros y probar donde se espera mejorar</td><td>Entrenamientos muy caros</td></tr>
        <tr><td>Reducción sucesiva (<em>Hyperband</em>)</td><td>Entrenar muchas configuraciones poco tiempo y seguir solo con las mejores</td><td>Cuando se puede interrumpir el entrenamiento</td></tr>
      </table>
      <p>Si solo \(k\) de los \(d\) hiperparámetros importan, una cuadrícula de \(n\) puntos prueba \(n^{1/d}\) valores de cada uno; la aleatoria, \(n\) valores distintos de cada uno (Bergstra y Bengio, 2012). Las escalas de la tasa de aprendizaje y de la regularización se muestrean en escala logarítmica.</p>
      <h2>El sesgo de selección</h2>
      <p>Si se prueban \(n\) configuraciones con estimaciones ruidosas de desviación \(\sigma\approx\sqrt{p(1-p)/m}\) (con \(m\) ejemplos de validación), el máximo de las estimaciones está inflado en aproximadamente \(\sigma\sqrt{2\ln n}\). La solución es un conjunto de prueba separado, o una validación cruzada anidada.</p>
      <h2>Protocolo</h2>
      <ol>
        <li>Dividir en entrenamiento / validación / prueba (o validación cruzada).</li>
        <li>Buscar hiperparámetros con la validación (<a href="tema.html?id=supervised-learning">validación cruzada de k pliegues</a> si hay pocos datos).</li>
        <li>Reentrenar con los mejores y medir <em>una vez</em> en la prueba.</li>
      </ol>
      <div class="recuadro"><p>Los hiperparámetros de mayor efecto en redes profundas suelen ser la <a href="tema.html?id=learning-rate-momentum">tasa de aprendizaje</a>, su programa y el tamaño del lote; después, la <a href="tema.html?id=l1-l2-regularization">regularización</a> y el tamaño del modelo. Para decidir si vale la pena más datos, mire las <a href="tema.html?id=learning-curves">curvas de aprendizaje</a>.</p></div>`,
  });
})();
