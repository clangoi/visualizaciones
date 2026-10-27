(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat, ML = VIZ.ml;

  /* ---------- Fig. 1: matriz de confusión y curva ROC ---------- */

  function montarROC(cuerpo) {
    let sep = 1.5, prev = 0.3, n = 400, t = 0.8, semilla = 2;
    let pos = [], neg = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Separación entre clases (d′)', min: 0, max: 4, paso: 0.1, valor: sep, formato: (v) => v.toFixed(1), alCambiar: (v) => { sep = v; generar(); } });
    ctl.rango({ etiqueta: 'Fracción de positivos', min: 0.02, max: 0.5, paso: 0.01, valor: prev, formato: (v) => v.toFixed(2), alCambiar: (v) => { prev = v; generar(); } });
    const rT = ctl.rango({ etiqueta: 'Umbral de decisión', min: -3, max: 6, paso: 0.05, valor: t, formato: (v) => v.toFixed(2), alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 190, altoMax: 260 });
    const tip = VIZ.tooltip(lienzo);
    const lienzo2 = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? Math.min(w, 340) + 230 : Math.min(340, w / 2.2)) });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'positivos (clase de interés)' },
      { color: C.s1, texto: 'negativos' },
      { color: C.tinta, texto: 'umbral: se predice positivo a la derecha', forma: 'linea' },
      { color: C.s4, texto: 'punto de operación en la ROC', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la curva ROC para elegir un umbral. Baje la fracción de positivos a 0,05: la exactitud sube aunque el clasificador no cambie, mientras la precisión cae. La curva ROC y su área no dependen de esa fracción.');

    function generar() {
      const rnd = VIZ.semilla(semilla), np = Math.round(n * prev);
      pos = Array.from({ length: np }, () => sep + VIZ.normal(rnd));
      neg = Array.from({ length: n - np }, () => VIZ.normal(rnd));
      dibujar();
    }
    const conteo = (u) => {
      const VP = pos.filter((s) => s > u).length, FN = pos.length - VP, FP = neg.filter((s) => s > u).length, VN = neg.length - FP;
      return { VP, FN, FP, VN };
    };
    function roc() {
      const umbrales = [Infinity, ...[...pos, ...neg].sort((a, b) => b - a), -Infinity];
      return umbrales.map((u) => { const c = conteo(u); return { u, fpr: c.FP / (neg.length || 1), tpr: c.VP / (pos.length || 1) }; });
    }
    let plano = null, plR = null, curva = [], geo = null;
    function dibujar() {
      // Histogramas de puntajes.
      {
        const { ctx } = lienzo;
        lienzo.limpiar();
        const B = 45, lo = -3.5, hi = 6.5, h = (xs) => { const r = new Array(B).fill(0); for (const s of xs) { const b = Math.floor(((s - lo) / (hi - lo)) * B); if (b >= 0 && b < B) r[b]++; } return r; };
        const hp = h(pos), hn = h(neg), m = Math.max(...hp, ...hn) || 1;
        plano = VIZ.plano(lienzo, { xmin: lo, xmax: hi, ymin: 0, ymax: m * 1.1 }, { etiquetaX: 'puntaje del clasificador', etiquetaY: 'objetos', margen: { izq: 44 } });
        plano.ejes();
        const bw = plano.sx(lo + (hi - lo) / B) - plano.sx(lo);
        for (const [hh, col] of [[hn, C.s1], [hp, C.s2]]) hh.forEach((v, b) => {
          if (!v) return;
          ctx.fillStyle = VIZ.alfa(col, 0.6);
          ctx.fillRect(plano.sx(lo + (b * (hi - lo)) / B) + 1, plano.sy(v), bw - 2, plano.y0 - plano.sy(v));
        });
        VIZ.trazar(ctx, plano, [[t, 0], [t, m * 1.1]], C.tinta, 2);
      }
      // ROC y matriz de confusión.
      const { ctx, ancho, alto } = lienzo2;
      lienzo2.limpiar();
      const apilar = ancho < 560, lado = apilar ? Math.min(ancho, 340) : Math.min(alto, ancho / 2);
      const sub = { ancho: lado, alto: lado, ctx };
      plR = VIZ.plano(sub, { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, { etiquetaX: 'tasa de falsos positivos', etiquetaY: 'tasa de verdaderos positivos', margen: { izq: 44 } });
      plR.ejes();
      curva = roc();
      VIZ.trazar(ctx, plR, [[0, 0], [1, 1]], C.apagado, 1, [3, 4]);
      VIZ.trazar(ctx, plR, curva.map((p) => [p.fpr, p.tpr]), C.tinta, 2);
      let auc = 0;
      for (let i = 1; i < curva.length; i++) auc += (curva[i].fpr - curva[i - 1].fpr) * (curva[i].tpr + curva[i - 1].tpr) / 2;
      const c = conteo(t), fpr = c.FP / (neg.length || 1), tpr = c.VP / (pos.length || 1);
      VIZ.marcador(ctx, plR.sx(fpr), plR.sy(tpr), C.s4, 6);
      // Matriz de confusión.
      const x0 = apilar ? 110 : lado + 130, y0 = apilar ? lado + 70 : 70, celda = Math.min(90, apilar ? (ancho - 130) / 2 : (ancho - x0 - 20) / 2);
      const M = [[c.VP, c.FN], [c.FP, c.VN]], tot = n;
      P.matriz(ctx, x0, y0, celda, M, {
        t: (i, j) => M[i][j] / tot * 1.6,
        texto: (i, j) => `${['VP', 'FN', 'FP', 'VN'][i * 2 + j]} ${M[i][j]}`,
        filas: ['real +', 'real −'],
        columnas: ['predicho +', 'predicho −'],
      });
      geo = { apilar };
      const precision = c.VP / (c.VP + c.FP || 1), rec = tpr, f1 = (2 * precision * rec) / (precision + rec || 1);
      lectura.set([
        ['exactitud', `${((100 * (c.VP + c.VN)) / tot).toFixed(1)} %`],
        ['precisión', `${(100 * precision).toFixed(1)} %`],
        ['exhaustividad (sensibilidad)', `${(100 * rec).toFixed(1)} %`],
        ['especificidad', `${(100 * (1 - fpr)).toFixed(1)} %`],
        ['F1', f1.toFixed(3)],
        ['área bajo la ROC', auc.toFixed(3)],
      ]);
    }
    lienzo.alDibujar = () => pos.length && dibujar();
    lienzo2.alDibujar = () => pos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), c = conteo(u);
      tip.mostrar(x, y, `umbral <b>${u.toFixed(2)}</b><br>VP ${c.VP}, FP ${c.FP}, FN ${c.FN}, VN ${c.VN}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    const masCercano = (x, y) => curva.reduce((m, p) => {
      const d = Math.hypot(plR.sx(p.fpr) - x, plR.sy(p.tpr) - y);
      return d < m.d ? { p, d } : m;
    }, { p: null, d: 24 }).p;
    lienzo2.canvas.style.cursor = 'pointer';
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      const p = plR && masCercano(x, y);
      if (!p || !Number.isFinite(p.u)) return tip2.ocultar();
      tip2.mostrar(x, y, `umbral <b>${p.u.toFixed(2)}</b><br>FPR <b>${p.fpr.toFixed(3)}</b>, TPR <b>${p.tpr.toFixed(3)}</b>`);
    });
    lienzo2.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      const p = plR && masCercano(x, y);
      if (!p || !Number.isFinite(p.u)) return;
      t = p.u - 1e-6; rT.valor = Math.max(-3, Math.min(6, t)); dibujar();
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    generar();
  }

  /* ---------- Fig. 2: variabilidad de la estimación ---------- */

  function knn5(E) {
    return (x, y) => {
      const d = E.map((q) => [(q.x - x) ** 2 + (q.y - y) ** 2, q.c]).sort((a, b) => a[0] - b[0]).slice(0, 5);
      return d.filter((v) => v[1] === 1).length >= 3 ? 1 : 0;
    };
  }
  function lda(E) {
    const g = [0, 1].map((k) => E.filter((q) => q.c === k).map((q) => [q.x, q.y]));
    if (g.some((v) => v.length < 2)) return () => 0;
    const mu = g.map((v) => P.media(v)), Sp = P.ceros(2, 2);
    g.forEach((v, k) => { const S = P.cov(v, mu[k]); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Sp[i][j] += (S[i][j] * (v.length - 1)) / (E.length - 2); });
    const Si = P.inv(Sp);
    return (x, y) => (P.mahal2([x, y], mu[1], Si) < P.mahal2([x, y], mu[0], Si) ? 1 : 0);
  }
  const exact = (f, T) => T.filter((q) => f(q.x, q.y) === q.c).length / T.length;
  function pliegues(pts, k, rnd) {
    const a = pts.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return Array.from({ length: k }, (_, f) => a.filter((_, i) => i % k === f));
  }
  function validacionCruzada(pts, k, entrenar, rnd) {
    const F = pliegues(pts, k, rnd);
    let ok = 0;
    F.forEach((T, f) => { const E = F.filter((_, g) => g !== f).flat(); ok += exact(entrenar(E), T) * T.length; });
    return ok / pts.length;
  }

  function montarVariabilidad(cuerpo) {
    let n = 60, clasif = 'knn', tipo = 'lunas', semilla = 1;
    const METODOS = [['entr', 'medida en entrenamiento', C.s8], ['hold', 'hold-out 70/30', C.s1], ['cv5', 'validación cruzada, 5 pliegues', C.s2],
      ['cv10', 'validación cruzada, 10 pliegues', C.s3], ['loo', 'dejar uno fuera', C.s7]];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter((d) => d[0] !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.selector({ etiqueta: 'Clasificador', opciones: [['knn', '5 vecinos más cercanos'], ['lda', 'LDA']], valor: clasif, alCambiar: (v) => { clasif = v; calcular(); } });
    ctl.rango({ etiqueta: 'Muestras n', min: 20, max: 200, paso: 10, valor: n, alCambiar: (v) => { n = v; }, alSoltar: calcular });
    ctl.boton('Repetir con otros datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...METODOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'punto' })),
      { color: C.tinta, texto: 'exactitud real (medida con 1000 datos nuevos)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es la estimación obtenida con un conjunto de n datos distinto, de los 30 que se muestrean. La medida en entrenamiento es optimista; hold-out es el que más varía. Con n pequeño, todos varían mucho más de lo que sugiere un solo número.');

    let res = null, plano = null;
    function calcular() {
      const entrenar = clasif === 'knn' ? knn5 : lda;
      const rnd = VIZ.semilla(semilla * 101);
      const R = 30, est = METODOS.map(() => []), reales = [];
      for (let r = 0; r < R; r++) {
        const pts = ML.datos(tipo, n, 0.45, semilla * 1000 + r), prueba = ML.datos(tipo, 1000, 0.45, 77777 + r);
        const f = entrenar(pts);
        reales.push(exact(f, prueba));
        est[0].push(exact(f, pts));
        const { entrenamiento, validacion } = ML.partir(pts, 0.7, semilla * 31 + r);
        est[1].push(exact(entrenar(entrenamiento), validacion));
        est[2].push(validacionCruzada(pts, 5, entrenar, rnd));
        est[3].push(validacionCruzada(pts, 10, entrenar, rnd));
        est[4].push(validacionCruzada(pts, pts.length, entrenar, rnd));
      }
      res = { est, real: reales.reduce((a, b) => a + b, 0) / R, reales };
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = res.est.flat();
      const lo = Math.max(0, Math.min(...todos, res.real) - 0.05), hi = Math.min(1, Math.max(...todos, res.real) + 0.05);
      plano = VIZ.plano(lienzo, { xmin: lo, xmax: hi, ymin: -0.5, ymax: METODOS.length - 0.5 }, { etiquetaX: 'exactitud estimada', margen: { izq: 12, sup: 10 },
        formatoX: (v) => `${Math.round(v * 100)}%`, ticksY: [] });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[res.real, -0.5], [res.real, METODOS.length - 0.5]], C.tinta, 2, [5, 4]);
      const rj = VIZ.semilla(3);
      METODOS.forEach(([, t, col], i) => {
        const fila = METODOS.length - 1 - i, xs = res.est[i];
        ctx.save(); ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'bottom';
        ctx.fillText(t, plano.x0 + 4, plano.sy(fila + 0.3)); ctx.restore();
        for (const v of xs) VIZ.marcador(ctx, plano.sx(v), plano.sy(fila - 0.1 + (rj() - 0.5) * 0.24), VIZ.alfa(col, 0.8), 3.5);
        const m = xs.reduce((a, b) => a + b, 0) / xs.length;
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(plano.sx(m), plano.sy(fila + 0.12)); ctx.lineTo(plano.sx(m), plano.sy(fila - 0.32)); ctx.stroke(); ctx.restore();
      });
      const resumen = (i) => {
        const xs = res.est[i], m = xs.reduce((a, b) => a + b, 0) / xs.length, s = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
        return `${(100 * (m - res.real)).toFixed(1)} ± ${(100 * s).toFixed(1)}`;
      };
      lectura.set([
        ['exactitud real', `${(100 * res.real).toFixed(1)} %`],
        ...METODOS.map(([, t], i) => [`${t}: sesgo ± desv.`, `${resumen(i)} pts`]),
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const fila = Math.round(plano.iy(y)), i = METODOS.length - 1 - fila;
      if (i < 0 || i >= METODOS.length) return tip.ocultar();
      const xs = res.est[i], m = xs.reduce((a, b) => a + b, 0) / xs.length;
      tip.mostrar(x, y, VIZ.filaTooltip(METODOS[i][2], METODOS[i][1]) + `media <b>${(100 * m).toFixed(1)} %</b><br>rango <b>${(100 * Math.min(...xs)).toFixed(0)}–${(100 * Math.max(...xs)).toFixed(0)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('evaluacion', {
    intro: String.raw`
      <p>Un clasificador se evalúa con datos que <strong>no vio</strong> al entrenar. Hay que decidir dos cosas: qué medir (la
      exactitud no basta cuando una clase es rara o cuando los errores tienen costos distintos) y cómo estimarlo con los pocos datos
      disponibles sin engañarse.</p>
      <p>La <strong>matriz de confusión</strong> y la <strong>curva ROC</strong> responden lo primero; <em>hold-out</em> y la
      <strong>validación cruzada</strong>, lo segundo. Toda estimación es una variable aleatoria: con otro conjunto de datos daría otro
      número.</p>`,
    visualizaciones: [
      {
        titulo: 'Matriz de confusión y curva ROC',
        descripcion: 'Puntajes de un clasificador para positivos y negativos. Cada umbral da una matriz de confusión y un punto de la curva ROC.',
        montar: montarROC,
      },
      {
        titulo: 'Cuánto varía la estimación',
        descripcion: 'Treinta conjuntos de n datos de la misma distribución, cada uno evaluado con cinco métodos. La línea negra es la exactitud real del clasificador.',
        montar: montarVariabilidad,
      },
    ],
    teoria: String.raw`
      <h2>Matriz de confusión</h2>
      <table>
        <tr><th></th><th>predicho positivo</th><th>predicho negativo</th></tr>
        <tr><td>real positivo</td><td>VP (verdadero positivo)</td><td>FN (falso negativo)</td></tr>
        <tr><td>real negativo</td><td>FP (falso positivo)</td><td>VN (verdadero negativo)</td></tr>
      </table>
      <p>De ella salen todas las medidas:</p>
      \[ \text{exactitud} = \frac{VP + VN}{n}, \quad \text{precisión} = \frac{VP}{VP + FP}, \quad
         \text{exhaustividad} = \frac{VP}{VP + FN}, \quad \text{especificidad} = \frac{VN}{VN + FP}, \quad F_1 = \frac{2PR}{P + R}. \]
      <p>Con clases desbalanceadas, la exactitud engaña: si el 2&nbsp;% de las piezas es defectuoso, declarar todo «sin defecto» da 98&nbsp;%
      de exactitud y no detecta nada. La precisión depende de la proporción de positivos; la exhaustividad y la especificidad, no.</p>
      <h2>Curva ROC</h2>
      <p>Al mover el umbral sobre un puntaje continuo, la curva ROC traza la tasa de verdaderos positivos (exhaustividad) contra la de falsos
      positivos (\(1 -\) especificidad). Un clasificador al azar sigue la diagonal; uno perfecto pasa por \((0, 1)\). El área bajo la curva
      (AUC) es la probabilidad de que un positivo al azar reciba más puntaje que un negativo al azar:</p>
      \[ \text{AUC} = P(s^+ &gt; s^-). \]
      <p>Con puntajes gaussianos de varianza 1 separados por \(d'\), \(\text{AUC} = \Phi(d'/\sqrt{2})\). La elección del punto de operación
      depende de los costos: es la <a href="tema.html?id=bayes">regla de Bayes</a> con un umbral sobre el puntaje.</p>
      <h2>Estimar el desempeño</h2>
      <pre><code>hold-out:          entrenar con el 70 %, medir en el 30 % restante
validación cruzada: dividir en k pliegues
                    para f ← 1 hasta k: entrenar sin el pliegue f, medir en él
                    promediar los k resultados
dejar uno fuera:    validación cruzada con k = n</code></pre>
      <ul>
        <li>El error medido en los datos de entrenamiento es <strong>optimista</strong>: el modelo ya se ajustó a ellos.</li>
        <li>Hold-out es honesto pero usa pocos datos para medir: su varianza es alta, y entrena con menos datos de los disponibles.</li>
        <li>La validación cruzada usa todos los datos para medir y casi todos para entrenar. Con \(k = 5\) o 10 suele ser el mejor
        compromiso; dejar uno fuera tiene sesgo mínimo pero no siempre menor varianza, y cuesta \(n\) entrenamientos.</li>
      </ul>
      <div class="recuadro"><p>Todo lo que se decide mirando los datos de validación (las características elegidas por
      <a href="tema.html?id=sfs">SFS</a>, el \(k\) de <a href="tema.html?id=knn">k-NN</a>, el umbral) contamina esa validación. El número que se
      informa debe salir de un conjunto de prueba que no se usó para ninguna decisión, o de una validación cruzada anidada.</p></div>`,
  });
})();
