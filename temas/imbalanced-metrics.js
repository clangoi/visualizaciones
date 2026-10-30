(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const f = (v) => (Number.isFinite(v) ? VIZ.fmt(100 * v, 3) + ' %' : '—');
  const Phi = (z) => M.Phi(z);
  const pdf = (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

  /* ---------- Fig. 1: la matriz de confusión y por qué la exactitud engaña ---------- */

  function montarMatriz(cuerpo) {
    let prev = 0.05, sep = 2, umbral = 1, N = 1000, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Prevalencia de la clase positiva', min: 0.005, max: 0.5, paso: 0.005, valor: prev, formato: (v) => `${VIZ.fmt(100 * v, 3)} %`, alCambiar: (v) => { prev = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Separación de las clases (d′)', min: 0.5, max: 4, paso: 0.1, valor: sep, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { sep = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Umbral de decisión', min: -2, max: 5, paso: 0.05, valor: umbral, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { umbral = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 340 : 640) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'clase negativa (puntaje ~ N(0, 1))', forma: 'linea' }, { color: C.s2, texto: 'clase positiva (puntaje ~ N(d′, 1))', forma: 'linea' }, { color: C.s6, texto: 'verdadero (VP / VN)', forma: 'cuadro' }, { color: C.s8, texto: 'error (FP / FN)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una población de 1 000 casos. El modelo da un puntaje; se declara «positivo» si supera el umbral. Con una prevalencia de 1–5 %, un modelo que siempre dice «negativo» acierta 95–99 %: la exactitud no sirve. Mire precisión y exhaustividad, y mueva el umbral.');
    function medidas() { const P = N * prev, Ng = N - P, vp = P * (1 - Phi(umbral - sep)), fn = P - vp, fp = Ng * (1 - Phi(umbral)), vn = Ng - fp; const ex = (vp + vn) / N, pre = vp / (vp + fp || 1), rec = vp / (vp + fn || 1); return { vp, fn, fp, vn, ex, pre: vp + fp ? pre : NaN, rec, f1: pre + rec ? (2 * pre * rec) / (pre + rec) : NaN, esp: vn / (vn + fp || 1), base: 1 - prev }; }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 700, me = medidas();
      lienzo.limpiar();
      const wp = ancha ? W * 0.55 : W - 60, hp = 170;
      pl = VIZ.plano({ ancho: W, alto: 230, ctx }, { xmin: -4, xmax: 7, ymin: 0, ymax: 0.45 }, { etiquetaX: 'puntaje del modelo', margen: { izq: 40, der: W - 40 - wp, sup: 10, inf: 36 } });
      pl.ejes();
      const xs = Array.from({ length: 221 }, (_, i) => -4 + (i * 11) / 220);
      VIZ.trazar(ctx, pl, xs.map((x) => [x, (1 - prev) * pdf(x, 0, 1)]), C.s1, 2.5); VIZ.trazar(ctx, pl, xs.map((x) => [x, prev * pdf(x, sep, 1)]), C.s2, 2.5);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(umbral), pl.y0); ctx.lineTo(pl.sx(umbral), pl.y1); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('predice positivo →', pl.sx(umbral) + 4, pl.y1 + 2);
      // Matriz de confusión.
      const cx = ancha ? 40 + wp + 20 : 20, cy = ancha ? 40 : 270, c = Math.min(86, ancha ? (W - cx - 110) / 2 : (W - 130) / 2);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('predicho −', cx + 90 + c / 2, cy - 4); ctx.fillText('predicho +', cx + 90 + c * 1.5, cy - 4);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('real −', cx + 84, cy + c / 2); ctx.fillText('real +', cx + 84, cy + c * 1.5);
      [[me.vn, 0, 0, C.s6, 'VN'], [me.fp, 1, 0, C.s8, 'FP'], [me.fn, 0, 1, C.s8, 'FN'], [me.vp, 1, 1, C.s6, 'VP']].forEach(([v, col, fila, color, n]) => { const x = cx + 90 + col * c, y = cy + fila * c; ctx.fillStyle = VIZ.alfa(color, 0.22); ctx.fillRect(x, y, c - 3, c - 3); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, c - 3, c - 3); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, x + c / 2, y + c * 0.3); ctx.font = VIZ.fuente(16, 600); ctx.fillText(VIZ.fmt(v, 3), x + c / 2, y + c * 0.62); });
      // Barras de métricas.
      const by = ancha ? 250 : 270 + 2 * c + 24; const mets = [['exactitud', me.ex, C.s1], ['precisión', me.pre, C.s2], ['exhaustividad', me.rec, C.s3], ['F1', me.f1, C.s7], ['exactitud de «todo negativo»', me.base, C.apagado]]; const bw = W - 190;
      mets.forEach(([n, v, col], i) => { const y = by + i * 22; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(n, 170, y + 8); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(176, y, Math.max(2, (Number.isFinite(v) ? v : 0) * bw), 16, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(f(v), 180 + (Number.isFinite(v) ? v : 0) * bw, y + 8); });
      registro.textContent = me.ex > me.base + 0.002 ? `Exactitud ${f(me.ex)}, superior a la de «todo negativo» (${f(me.base)}); precisión ${f(me.pre)} y exhaustividad ${f(me.rec)}.` : `La exactitud (${f(me.ex)}) no supera la de un modelo que siempre dice «negativo» (${f(me.base)}): no está aportando nada.`;
      lectura.set([['positivos reales', VIZ.fmt(N * prev, 3)], ['verdaderos positivos', VIZ.fmt(me.vp, 3)], ['falsos positivos', VIZ.fmt(me.fp, 3)], ['precisión', f(me.pre)], ['exhaustividad (sensibilidad)', f(me.rec)], ['especificidad', f(me.esp)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) return tip.ocultar(); tip.mostrar(x, y, `puntaje <b>${VIZ.fmt(pl.ix(x), 2)}</b><br>negativos: ${VIZ.fmt((1 - prev) * pdf(pl.ix(x), 0, 1), 3)}<br>positivos: ${VIZ.fmt(prev * pdf(pl.ix(x), sep, 1), 3)}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: elegir el umbral según el costo de cada error ---------- */

  function montarCosto(cuerpo) {
    let prev = 0.05, sep = 2, cFN = 20, cFP = 1, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Prevalencia', min: 0.005, max: 0.5, paso: 0.005, valor: prev, formato: (v) => `${VIZ.fmt(100 * v, 3)} %`, alCambiar: (v) => { prev = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Separación d′', min: 0.5, max: 4, paso: 0.1, valor: sep, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { sep = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de un falso negativo', min: 1, max: 100, valor: cFN, alCambiar: (v) => { cFN = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de un falso positivo', min: 1, max: 100, valor: cFP, alCambiar: (v) => { cFP = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'exhaustividad', forma: 'linea' }, { color: C.s1, texto: 'precisión', forma: 'linea' }, { color: C.s7, texto: 'F1', forma: 'linea' }, { color: C.s8, texto: 'costo esperado por caso (escala a la derecha)', forma: 'linea' }, { color: C.s6, texto: 'umbral de menor costo', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Subir el umbral gana precisión y pierde exhaustividad. El umbral «natural» (el que maximiza F1) rara vez es el que conviene: depende de qué cuesta más, perder un caso positivo o dar una falsa alarma. Pase el cursor para leer cada curva.');
    const TS = Array.from({ length: 111 }, (_, i) => -2 + i * 0.06);
    const at = (t) => { const rec = 1 - Phi(t - sep), fp = 1 - Phi(t), pre = (prev * rec) / (prev * rec + (1 - prev) * fp || 1), f1 = pre + rec ? (2 * pre * rec) / (pre + rec) : 0, costo = prev * (1 - rec) * cFN + (1 - prev) * fp * cFP; return { t, rec, pre, f1, costo }; };
    function dibujar() {
      const { ctx } = lienzo, F = TS.map(at), mc = Math.max(...F.map((q) => q.costo)), mejor = F.reduce((a, b) => (b.costo < a.costo ? b : a)), bf = F.reduce((a, b) => (b.f1 > a.f1 ? b : a));
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -2, xmax: 4.6, ymin: 0, ymax: 1.02 }, { etiquetaX: 'umbral', etiquetaY: 'métrica', margen: { der: 56 } });
      pl.ejes();
      [['rec', C.s2], ['pre', C.s1], ['f1', C.s7]].forEach(([k, c]) => VIZ.trazar(ctx, pl, F.map((q) => [q.t, q[k]]), c, 2.3));
      VIZ.trazar(ctx, pl, F.map((q) => [q.t, q.costo / (mc || 1)]), C.s8, 2.3, [5, 3]);
      ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`${VIZ.fmt(mc, 2)} máx.`, pl.x1 + 6, pl.sy(1)); ctx.fillText('0', pl.x1 + 6, pl.sy(0));
      VIZ.marcador(ctx, pl.sx(mejor.t), pl.sy(mejor.costo / (mc || 1)), C.s6, 6);
      if (hover >= 0) { ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(pl.sx(F[hover].t), pl.y0); ctx.lineTo(pl.sx(F[hover].t), pl.y1); ctx.stroke(); }
      registro.textContent = `El umbral de menor costo es ${VIZ.fmt(mejor.t, 2)} (exhaustividad ${f(mejor.rec)}, precisión ${f(mejor.pre)}); el que maximiza F1 es ${VIZ.fmt(bf.t, 2)}. ${Math.abs(mejor.t - bf.t) > 0.3 ? 'No coinciden: elegir por F1 saldría más caro.' : 'Aquí casi coinciden.'}`;
      lectura.set([['umbral de menor costo', VIZ.fmt(mejor.t, 2)], ['costo por caso en ese umbral', VIZ.fmt(mejor.costo, 3)], ['umbral de máximo F1', VIZ.fmt(bf.t, 2)], ['costo por caso en el umbral F1', VIZ.fmt(bf.costo, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); } hover = Math.max(0, Math.min(TS.length - 1, Math.round((pl.ix(x) + 2) / 0.06))); dibujar(); const q = at(TS[hover]); tip.mostrar(x, y, `umbral <b>${VIZ.fmt(q.t, 2)}</b>` + VIZ.filaTooltip(C.s2, 'exhaustividad', f(q.rec)) + VIZ.filaTooltip(C.s1, 'precisión', f(q.pre)) + VIZ.filaTooltip(C.s7, 'F1', f(q.f1)) + VIZ.filaTooltip(C.s8, 'costo/caso', VIZ.fmt(q.costo, 3))); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('imbalanced-metrics', {
    intro: String.raw`
      <p>La <strong>exactitud</strong> (<em>accuracy</em>) —la fracción de aciertos— es la métrica más intuitiva y la más engañosa. Si solo 1 de cada 100 transacciones es fraude, un modelo que dice siempre «no es fraude» acierta el 99 % y no sirve para nada.</p>
      <p>Por eso se mira cómo se reparten los aciertos y los errores en una <strong>matriz de confusión</strong>, y de ella se derivan la <strong>precisión</strong> (de lo que declaró positivo, ¿cuánto lo era?) y la <strong>exhaustividad</strong> (<em>recall</em>: de los positivos reales, ¿cuántos encontró?). La elección entre ambas depende de qué error sale más caro.</p>`,
    visualizaciones: [
      { titulo: 'Matriz de confusión y la paradoja de la exactitud', descripcion: 'Baje la prevalencia a 1 % y compare la exactitud del modelo con la de «todo negativo». Mueva el umbral y vea cómo cambian precisión y exhaustividad.', montar: montarMatriz },
      { titulo: 'Elegir el umbral según el costo', descripcion: 'Ponga que un falso negativo cuesta 20 veces más que un falso positivo y compare el umbral óptimo con el de máximo F1.', montar: montarCosto },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Con VP, FP, VN, FN (verdaderos y falsos positivos y negativos):</p>
      \[ \text{exactitud}=\frac{VP+VN}{VP+FP+VN+FN},\quad \text{precisión}=\frac{VP}{VP+FP},\quad \text{exhaustividad}=\frac{VP}{VP+FN}, \]
      \[ F_1=\frac{2\cdot\text{precisión}\cdot\text{exhaustividad}}{\text{precisión}+\text{exhaustividad}},\qquad F_\beta=\frac{(1+\beta^2)\,P\,R}{\beta^2P+R}. \]
      <p>\(F_1\) es la media armónica; \(F_\beta\) pesa \(\beta\) veces más la exhaustividad que la precisión (\(\beta=2\) si perder positivos es peor).</p>
      <h2>Efecto de la prevalencia</h2>
      <p>La precisión depende de la prevalencia \(\pi\): por la regla de Bayes,</p>
      \[ \text{precisión}=\frac{\pi\cdot\text{exh}}{\pi\cdot\text{exh}+(1-\pi)\cdot\text{FPR}}. \]
      <p>Con \(\pi=0{,}01\), una tasa de falsos positivos de 5 % hace que la gran mayoría de las alertas sean falsas, aunque el modelo parezca «bueno».</p>
      <h2>Con varias clases</h2>
      <p>Se calcula por clase y se promedia: <em>macro</em> (todas las clases pesan igual), <em>micro</em> (se suman los conteos) o <em>ponderado</em> por soporte. La macro revela fallos en clases raras que la exactitud oculta.</p>
      <div class="recuadro"><p>El umbral es una decisión de negocio, no una propiedad del modelo: se recorre y se elige según los costos. La curva ROC y el AUC, que no dependen del umbral, se ven en <a href="tema.html?id=evaluacion">Classifier Evaluation</a>. Si los datos están desbalanceados, también se pueden usar pesos por clase, sobremuestreo o ajustar la pérdida (<a href="tema.html?id=loss-functions-mle">pérdidas</a>).</p></div>`,
  });
})();
