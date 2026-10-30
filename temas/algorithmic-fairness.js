(function () {
  'use strict';
  const { color: C } = VIZ;

  const GRUPOS = [['grupo A', C.s1], ['grupo B', C.s2]];
  const f = (v) => (Number.isFinite(v) ? `${VIZ.fmt(100 * v, 3)} %` : '—');

  // Población sintética: la capacidad real de pago q es igual de buena en ambos grupos; el puntaje del modelo está desplazado en B
  // (datos históricos que subestiman al grupo B) y B es menos frecuente entre los solicitantes.
  function poblacion(semilla, desplazo, difBase) {
    const r = VIZ.semilla(semilla * 11 + 5), P = [];
    for (let i = 0; i < 4000; i++) { const g = r() < 0.6 ? 0 : 1, q = VIZ.normal(r) + (g === 1 ? -difBase : 0), paga = r() < 1 / (1 + Math.exp(-2 * q)) ? 1 : 0, s = q + 0.6 * VIZ.normal(r) - (g === 1 ? desplazo : 0); P.push({ g, q, paga, s }); }
    return P;
  }
  function metricas(P, tA, tB) {
    return [0, 1].map((g) => { const L = P.filter((p) => p.g === g), t = g ? tB : tA, ap = L.filter((p) => p.s > t), vp = ap.filter((p) => p.paga).length, pos = L.filter((p) => p.paga).length, neg = L.length - pos, fp = ap.length - vp; return { n: L.length, acept: ap.length / L.length, tpr: vp / (pos || 1), fpr: fp / (neg || 1), prec: ap.length ? vp / ap.length : NaN, base: pos / L.length }; });
  }
  const exactitud = (P, tA, tB) => P.filter((p) => ((p.s > (p.g ? tB : tA)) ? 1 : 0) === p.paga).length / P.length;

  /* ---------- Fig. 1: umbral único o por grupo ---------- */

  function montarUmbrales(cuerpo) {
    let desplazo = 0.5, difBase = 0, tA = 0, tB = 0, mismo = true, semilla = 1, P = poblacion(1, 0.5, 0), geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Sesgo de los datos: puntaje de B desplazado', min: 0, max: 1.5, paso: 0.1, valor: desplazo, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { desplazo = v; P = poblacion(semilla, desplazo, difBase); dibujar(); } });
    ctl.rango({ etiqueta: 'Diferencia real de capacidad de pago de B', min: 0, max: 1, paso: 0.1, valor: difBase, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { difBase = v; P = poblacion(semilla, desplazo, difBase); dibujar(); } });
    ctl.rango({ etiqueta: 'Umbral para A', min: -1.5, max: 1.5, paso: 0.05, valor: tA, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tA = v; if (mismo) { tB = v; rb.valor = v; } dibujar(); } });
    const rb = ctl.rango({ etiqueta: 'Umbral para B', min: -1.5, max: 1.5, paso: 0.05, valor: tB, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tB = v; mismo = false; cm.valor = false; dibujar(); } });
    const cm = ctl.casilla({ etiqueta: 'Mismo umbral para ambos', valor: mismo, alCambiar: (v) => { mismo = v; if (v) { tB = tA; rb.valor = tA; } dibujar(); } });
    ctl.boton('Otra población', () => { semilla++; P = poblacion(semilla, desplazo, difBase); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 340 : 520) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, GRUPOS.map(([n, c]) => ({ color: c, texto: n, forma: 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cuatro mil solicitantes sintéticos: la capacidad de pago real es igual de buena en los dos grupos, pero el modelo se entrenó con datos que subestiman al grupo B. Con el mismo umbral, personas igual de solventes de B son rechazadas más a menudo. Compare las tres medidas de equidad al mover los umbrales.');
    function dibujar() {
      const me = metricas(P, tA, mismo ? tA : tB), { ctx, ancho: W } = lienzo, ancha = W > 640, ex = exactitud(P, tA, mismo ? tA : tB);
      lienzo.limpiar(); geo = [];
      const filas = [['tasa de aceptación', 'acept', 'paridad demográfica'], ['tasa de verdaderos positivos (solventes aceptados)', 'tpr', 'igualdad de oportunidades'], ['tasa de falsos positivos (no solventes aceptados)', 'fpr', 'igualdad de oportunidades'], ['precisión de las aceptaciones', 'prec', 'paridad predictiva']];
      const w1 = ancha ? W - 20 : W - 20, bw = Math.min(260, w1 - 300);
      filas.forEach(([t, k, nombre], i) => {
        const y = 12 + i * 78;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`${t}  (${nombre})`, 10, y);
        me.forEach((m, g) => { const yy = y + 20 + g * 22, w = Math.max(2, (Number.isFinite(m[k]) ? m[k] : 0) * bw); ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillText(GRUPOS[g][0], 62, yy + 8); ctx.fillStyle = GRUPOS[g][1]; ctx.beginPath(); ctx.roundRect(68, yy, w, 16, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(f(m[k]), 72 + w, yy + 8); geo.push({ y: yy, h: 16, t: `${GRUPOS[g][0]}: ${t} = ${f(m[k])}` }); });
        const dif = Math.abs((me[0][k] || 0) - (me[1][k] || 0)); ctx.fillStyle = dif > 0.05 ? C.s8 : C.s6; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`brecha ${VIZ.fmt(100 * dif, 3)} puntos`, 90 + bw + 90, y + 42);
      });
      registro.textContent = `Exactitud global ${f(ex)}. Aceptación: A ${f(me[0].acept)} frente a B ${f(me[1].acept)}. Entre los solventes, se acepta al ${f(me[0].tpr)} de A y al ${f(me[1].tpr)} de B (brecha de oportunidades ${VIZ.fmt(100 * Math.abs(me[0].tpr - me[1].tpr), 3)} puntos).`;
      lectura.set([['exactitud global', f(ex)], ['brecha de aceptación', `${VIZ.fmt(100 * Math.abs(me[0].acept - me[1].acept), 3)} puntos`], ['brecha de oportunidades (TPR)', `${VIZ.fmt(100 * Math.abs(me[0].tpr - me[1].tpr), 3)} puntos`], ['brecha de falsos positivos', `${VIZ.fmt(100 * Math.abs(me[0].fpr - me[1].fpr), 3)} puntos`], ['solicitantes A / B', `${me[0].n} / ${me[1].n}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((q) => y >= q.y && y <= q.y + q.h); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el precio de la equidad ---------- */

  function montarCompromiso(cuerpo) {
    let desplazo = 0.8, difBase = 0, semilla = 1, P = null, curva = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Sesgo de los datos (desplazo de B)', min: 0, max: 1.5, paso: 0.1, valor: desplazo, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { desplazo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Diferencia real de capacidad de B', min: 0, max: 1, paso: 0.1, valor: difBase, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { difBase = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'exactitud global', forma: 'linea' }, { color: C.s8, texto: 'brecha de oportunidades |TPR_A − TPR_B|', forma: 'linea' }, { color: C.s6, texto: 'umbral de B con brecha mínima', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se fija el umbral de A en 0 y se recorre el de B. Bajar el umbral de B acepta más solicitantes de B (también más no solventes). Si los datos están sesgados, el punto de menor brecha puede aumentar la exactitud o reducirla un poco; si además los grupos difieren de verdad, hay que elegir qué definición de equidad se quiere.');
    const TB = Array.from({ length: 61 }, (_, i) => -1.5 + (3 * i) / 60);
    function calcular() { P = poblacion(semilla, desplazo, difBase); curva = TB.map((t) => { const m = metricas(P, 0, t); return { t, ex: exactitud(P, 0, t), br: Math.abs(m[0].tpr - m[1].tpr), acB: m[1].acept }; }); dibujar(); }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -1.5, xmax: 1.5, ymin: 0, ymax: 1 }, { etiquetaX: 'umbral aplicado al grupo B (A fijo en 0)', etiquetaY: 'fracción', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      VIZ.trazar(ctx, pl, curva.map((q) => [q.t, q.ex]), C.s1, 2.5); VIZ.trazar(ctx, pl, curva.map((q) => [q.t, q.br]), C.s8, 2.5);
      const mb = curva.reduce((a, b) => (b.br < a.br ? b : a)), eq = curva.find((q) => Math.abs(q.t) < 0.03);
      VIZ.marcador(ctx, pl.sx(mb.t), pl.sy(mb.br), C.s6, 6);
      if (hover >= 0) { ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(pl.sx(curva[hover].t), pl.y0); ctx.lineTo(pl.sx(curva[hover].t), pl.y1); ctx.stroke(); }
      registro.textContent = `Con el mismo umbral (0): exactitud ${f(eq.ex)} y brecha ${f(eq.br)}. Con el umbral de B en ${VIZ.fmt(mb.t, 2)}: brecha ${f(mb.br)} y exactitud ${f(mb.ex)} (${mb.ex >= eq.ex ? 'más' : 'menos'} que antes).`;
      lectura.set([['brecha con umbral único', f(eq.br)], ['exactitud con umbral único', f(eq.ex)], ['umbral de B con menor brecha', VIZ.fmt(mb.t, 2)], ['brecha mínima', f(mb.br)], ['exactitud en ese umbral', f(mb.ex)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y) || !curva.length) { hover = -1; tip.ocultar(); return dibujar(); } hover = Math.max(0, Math.min(60, Math.round((pl.ix(x) + 1.5) / 0.05))); dibujar(); const q = curva[hover]; tip.mostrar(x, y, `umbral de B <b>${VIZ.fmt(q.t, 2)}</b>` + VIZ.filaTooltip(C.s1, 'exactitud', f(q.ex)) + VIZ.filaTooltip(C.s8, 'brecha TPR', f(q.br)) + `<br>aceptación de B ${f(q.acB)}`); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('algorithmic-fairness', {
    intro: String.raw`
      <p>Un modelo entrenado con datos del pasado aprende, junto con las regularidades útiles, las desigualdades del pasado. Si en los datos un grupo fue rechazado más a menudo, el modelo reproducirá esa pauta aunque nunca se le diga a qué grupo pertenece una persona: otras variables (código postal, historial) lo delatan. A eso se le llama <strong>sesgo algorítmico</strong>.</p>
      <p>La <strong>equidad</strong> se mide con criterios que comparan el trato a los grupos: ¿se acepta la misma fracción de cada uno (paridad demográfica)?, ¿se acepta la misma fracción de los que de verdad cumplirían (igualdad de oportunidades)?, ¿son igual de confiables las aceptaciones (paridad predictiva)? Los tres no se pueden cumplir a la vez salvo en casos triviales, y elegir cuál importa es una decisión ética, no técnica.</p>`,
    visualizaciones: [
      { titulo: 'Un umbral o uno por grupo', descripcion: 'Con el mismo umbral, compare las cuatro medidas por grupo. Luego baje el umbral de B hasta igualar las oportunidades y vea qué pasa con las otras.', montar: montarUmbrales },
      { titulo: 'El precio de la equidad', descripcion: 'Recorra el umbral de B y observe la exactitud y la brecha. Cambie el sesgo de los datos y la diferencia real entre los grupos.', montar: montarCompromiso },
    ],
    teoria: String.raw`
      <h2>Criterios</h2>
      <p>Sea \(\hat Y\) la decisión, \(Y\) el resultado real (por ejemplo, «paga») y \(A\) el grupo.</p>
      <table>
        <tr><th>Criterio</th><th>Condición</th></tr>
        <tr><td>Paridad demográfica</td><td>\(P(\hat Y=1\mid A=a)\) igual para todo \(a\)</td></tr>
        <tr><td>Igualdad de oportunidades</td><td>\(P(\hat Y=1\mid Y=1,A=a)\) igual (TPR igual)</td></tr>
        <tr><td>Probabilidades igualadas</td><td>TPR <em>y</em> FPR iguales entre grupos</td></tr>
        <tr><td>Paridad predictiva</td><td>\(P(Y=1\mid\hat Y=1,A=a)\) igual (precisión igual)</td></tr>
        <tr><td>Calibración</td><td>\(P(Y=1\mid \text{puntaje}=s,A=a)=s\) para todo grupo</td></tr>
      </table>
      <h2>Incompatibilidades</h2>
      <div class="recuadro"><p><strong>Teorema (Chouldechova; Kleinberg, Mullainathan y Raghavan).</strong> Si la prevalencia \(P(Y=1\mid A=a)\) es distinta entre grupos y el clasificador no es perfecto, es imposible tener a la vez calibración (o paridad predictiva) e igualdad de TPR y FPR.</p></div>
      <p>Las diferencias de tasas de resultados reales entre grupos, que pueden ser a su vez consecuencia de desigualdades sociales, hacen que satisfacer una definición viole las otras. Por eso la elección debe discutirse con quienes se ven afectados.</p>
      <h2>Dónde nace el sesgo y cómo se mitiga</h2>
      <ul>
        <li><strong>Datos:</strong> muestreo desparejo, etiquetas que reflejan decisiones humanas sesgadas, variables que sustituyen a la sensible.</li>
        <li><strong>Modelo:</strong> optimiza la exactitud promedio, que favorece al grupo más numeroso.</li>
        <li><strong>Uso:</strong> un modelo bueno aplicado a una población distinta puede fallar.</li>
        <li><strong>Mitigación:</strong> antes (reponderar, aumentar datos), durante (agregar un término de equidad a la pérdida) o después del entrenamiento (umbrales por grupo, como en la figura). Todas tienen costos y límites legales según el contexto.</li>
      </ul>
      <p>Los modelos también heredan sesgos en las representaciones (<a href="tema.html?id=embeddings">Embeddings</a>) y de los datos de preentrenamiento (<a href="tema.html?id=next-token-prediction">Next-Token Prediction</a>). Medir con métricas por grupo: <a href="tema.html?id=imbalanced-metrics">Classification Metrics</a>. Sobre la privacidad de los datos: <a href="tema.html?id=privacidad-diferencial">Differential Privacy</a>.</p>`,
  });
})();
