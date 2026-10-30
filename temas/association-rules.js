(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const P = M.PRODUCTOS;

  /* ---------- Fig. 1: una regla y su tabla de contingencia ---------- */

  function montarRegla(cuerpo) {
    let semilla = 1, T = M.transacciones(200, semilla), ant = { 5: true }, y = 6;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(P.map((p, i) => ({ clave: i, texto: p, activo: !!ant[i] })), (e) => { ant = e; dibujar(); });
    ctl.selector({ etiqueta: 'Consecuente Y', opciones: P.map((p, i) => [i, p]), valor: y, alCambiar: (v) => { y = +v; dibujar(); } });
    ctl.boton('Nuevas canastas', () => { semilla++; T = M.transacciones(200, semilla); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'contienen Y', forma: 'cuadro' },
      { color: C.neutro, texto: 'no contienen Y', borde: C.rejilla },
      { color: C.s2, texto: 'P(Y) en todas las canastas', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque el antecedente X (casillas) y elija el consecuente Y. El ancho de cada columna es la fracción de canastas con o sin X; la altura azul, la fracción que además tiene Y. Si la columna «con X» sube por encima de la línea naranja, X «empuja» a Y: lift &gt; 1.');
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const X = P.map((_, i) => i).filter((i) => ant[i] && i !== y), N = T.length;
      const conX = T.filter((t) => M.contiene(t, X)), sinX = T.filter((t) => !M.contiene(t, X));
      const nXY = conX.filter((t) => t.includes(y)).length, nY = T.filter((t) => t.includes(y)).length, nnXY = sinX.filter((t) => t.includes(y)).length;
      const izq = 50, der = W - 12, sup = 26, inf = H - 34, ancho = der - izq;
      const wX = (conX.length / N) * ancho;
      const col = (x0, w, n, nY2, titulo) => {
        const h = inf - sup, fy = n ? nY2 / n : 0;
        ctx.fillStyle = C.neutro; ctx.fillRect(x0 + 1, sup, Math.max(0, w - 2), h);
        ctx.fillStyle = C.s1; ctx.fillRect(x0 + 1, inf - fy * h, Math.max(0, w - 2), fy * h);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        if (w > 50) ctx.fillText(`${titulo} (${n})`, x0 + w / 2, inf + 6);
        if (w > 40 && fy * h > 16) { ctx.fillStyle = C.sobre; ctx.textBaseline = 'bottom'; ctx.fillText(M.pct(fy, 0), x0 + w / 2, inf - 3); }
      };
      col(izq, wX, conX.length, nXY, 'con X');
      col(izq + wX, ancho - wX, sinX.length, nnXY, 'sin X');
      const yY = inf - (nY / N) * (inf - sup);
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(izq, yY); ctx.lineTo(der, yY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const v of [0, 0.5, 1]) ctx.fillText(`${v * 100}%`, izq - 6, inf - v * (inf - sup));
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = C.tinta2; ctx.fillText(`regla: ${X.length ? M.nombreConj(X) : '∅'} → {${P[y]}}`, izq, 4);
      geo = { izq, wX, conX: conX.length, sinX: sinX.length, nXY, nnXY, sup, inf };
      const sop = nXY / N, sx = conX.length / N, sy = nY / N, conf = conX.length ? nXY / conX.length : NaN;
      lectura.set([
        ['soporte s(X ∪ Y)', M.pct(sop)],
        ['confianza P(Y | X)', Number.isFinite(conf) ? M.pct(conf) : '—'],
        ['lift = conf / s(Y)', Number.isFinite(conf) ? VIZ.fmt(conf / sy, 3) : '—'],
        ['leverage s(XY) − s(X)s(Y)', VIZ.fmt(sop - sx * sy, 3)],
        ['convicción (1 − s(Y)) / (1 − conf)', conf < 1 ? VIZ.fmt((1 - sy) / (1 - conf), 3) : '∞'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: py } = lienzo.posicion(ev);
      if (!geo || py < geo.sup || py > geo.inf || x < geo.izq) return tip.ocultar();
      const enX = x < geo.izq + geo.wX;
      tip.mostrar(x, py, enX ? `con X: <b>${geo.conX}</b> canastas<br>de ellas con Y: <b>${geo.nXY}</b>` : `sin X: <b>${geo.sinX}</b> canastas<br>de ellas con Y: <b>${geo.nnXY}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: todas las reglas ---------- */

  function montarTodas(cuerpo) {
    let semilla = 1, T = M.transacciones(300, semilla), minSop = 0.04, minConf = 0.4, R = [], hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Soporte mínimo', min: 0.01, max: 0.3, paso: 0.01, valor: minSop, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minSop = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Confianza mínima', min: 0, max: 1, paso: 0.05, valor: minConf, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minConf = v; dibujar(); } });
    ctl.boton('Nuevas canastas', () => { semilla++; T = M.transacciones(300, semilla); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.1)), texto: 'lift ≈ 1 (independientes)', forma: 'punto' },
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'lift alto', forma: 'punto' },
      { color: C.s8, texto: 'lift < 1 (se evitan)', forma: 'punto' },
      { color: C.neutro, texto: 'zona que no pasa los umbrales', borde: C.rejilla },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una regla X → Y con Y de un producto (de todos los itemsets con soporte ≥ 1 %). Pase el cursor para leerla. Observe reglas con confianza alta pero lift ≈ 1: Y es tan común que aparece con cualquier cosa.');
    function calcular() { R = M.reglas(T, M.apriori(T, 0.01, P.length)); dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const smax = Math.max(...R.map((r) => r.sop)) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: smax, ymin: 0, ymax: 1 }, { etiquetaX: 'soporte', etiquetaY: 'confianza', formatoX: (v) => `${Math.round(v * 100)}%`, formatoY: (v) => `${Math.round(v * 100)}%` });
      ctx.fillStyle = C.neutro;
      ctx.fillRect(pl.x0, pl.y1, pl.sx(Math.min(minSop, smax)) - pl.x0, pl.y0 - pl.y1);
      ctx.fillRect(pl.x0, pl.sy(minConf), pl.x1 - pl.x0, pl.y0 - pl.sy(minConf));
      pl.ejes();
      const lmax = Math.max(2, ...R.map((r) => r.lift));
      const orden = R.map((r, i) => i).sort((a, b) => R[a].lift - R[b].lift);
      for (const i of orden) {
        const r = R[i], pasa = r.sop >= minSop && r.conf >= minConf;
        const col = r.lift < 1 ? C.s8 : VIZ.css(VIZ.enRampa(Math.min(1, 0.1 + (r.lift - 1) / (lmax - 1))));
        ctx.globalAlpha = pasa ? 1 : 0.35;
        VIZ.marcador(ctx, pl.sx(r.sop), pl.sy(r.conf), col, i === hover ? 7 : 4.5);
        ctx.globalAlpha = 1;
      }
      const ok = R.filter((r) => r.sop >= minSop && r.conf >= minConf);
      const top = ok.slice().sort((a, b) => b.lift - a.lift)[0];
      lectura.set([
        ['reglas totales', String(R.length)],
        ['pasan ambos umbrales', String(ok.length)],
        ['de ellas con lift < 1,1', String(ok.filter((r) => r.lift < 1.1).length)],
        ['mayor lift entre las que pasan', top ? `${M.nombreConj(top.X)} → ${M.nombreConj(top.Y)} (${VIZ.fmt(top.lift, 3)})` : '—'],
      ]);
    }
    lienzo.alDibujar = () => R.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 9;
      if (pl) R.forEach((r, i) => { const d = Math.hypot(pl.sx(r.sop) - x, pl.sy(r.conf) - y); if (d < dm) { dm = d; m = i; } });
      if (m !== hover) { hover = m; dibujar(); }
      if (m < 0) return tip.ocultar();
      const r = R[m];
      tip.mostrar(x, y, `<b>${M.nombreConj(r.X)} → ${M.nombreConj(r.Y)}</b><br>soporte ${M.pct(r.sop)} · confianza ${M.pct(r.conf)}<br>lift <b>${VIZ.fmt(r.lift, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (R.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('association-rules', {
    intro: String.raw`
      <p>Una <strong>regla de asociación</strong> \(X \to Y\) dice «las canastas que contienen \(X\) suelen contener también \(Y\)».
      \(X\) es el <strong>antecedente</strong> y \(Y\) el <strong>consecuente</strong>, ambos conjuntos de ítems disjuntos.</p>
      <p>Para decidir si una regla vale la pena se usan tres números: el <strong>soporte</strong> (qué tan común es),
      la <strong>confianza</strong> (qué tan seguido se cumple) y el <strong>lift</strong> (cuánto más probable es \(Y\) cuando hay \(X\)).
      La confianza sola engaña: si casi todos compran pan, cualquier regla \(X \to \{\text{pan}\}\) tiene confianza alta.</p>`,
    visualizaciones: [
      {
        titulo: 'Una regla y su tabla de contingencia',
        descripcion: 'Arme una regla y compare la fracción con Y entre quienes tienen X y entre todos. Pruebe {cerveza} → {pañales} y {fruta} → {pan}.',
        montar: montarRegla,
      },
      {
        titulo: 'Todas las reglas',
        descripcion: 'Soporte, confianza y lift de todas las reglas con consecuente de un producto. Mueva los umbrales y vea cuáles sobreviven.',
        montar: montarTodas,
      },
    ],
    teoria: String.raw`
      <h2>Medidas</h2>
      <p>Para \(X \to Y\) con \(X \cap Y = \emptyset\):</p>
      \[ s(X \to Y) = s(X \cup Y), \qquad c(X \to Y) = \frac{s(X \cup Y)}{s(X)} = \hat P(Y \mid X), \qquad
         \operatorname{lift}(X \to Y) = \frac{c(X \to Y)}{s(Y)} = \frac{\hat P(X, Y)}{\hat P(X)\,\hat P(Y)}. \]
      <ul>
        <li><strong>lift = 1</strong>: \(X\) e \(Y\) son <a href="tema.html?id=conditional-independence">independientes</a> en los datos.</li>
        <li><strong>lift &gt; 1</strong>: aparecen juntos más de lo esperado por azar; <strong>lift &lt; 1</strong>: se evitan.</li>
        <li>El lift es simétrico: \(\operatorname{lift}(X \to Y) = \operatorname{lift}(Y \to X)\). La confianza no.</li>
      </ul>
      <p>Otras medidas: <em>leverage</em> \(s(XY) - s(X)s(Y)\) (diferencia en vez de cociente) y <em>convicción</em>
      \(\frac{1 - s(Y)}{1 - c(X \to Y)}\), que vale \(\infty\) para reglas que nunca fallan.</p>
      <h2>Minería de reglas</h2>
      <pre><code>1. Encontrar todos los itemsets Z con s(Z) ≥ minsup         ← lo caro (Apriori, FP-growth)
2. Para cada Z frecuente y cada Y ⊂ Z no vacío:
       X ← Z \ Y
       si s(Z) / s(X) ≥ minconf: emitir X → Y</code></pre>
      <p>El paso 2 no requiere volver a leer las transacciones: \(s(X)\) ya se conoce porque \(X \subset Z\) también es frecuente.
      La confianza de reglas generadas desde el mismo \(Z\) es anti-monótona en el consecuente: si \(X \to Y\) no alcanza
      <em>minconf</em>, tampoco lo hace \(X' \to Y'\) con \(Y \subset Y'\).</p>
      <h2>Interés y cautela</h2>
      <ul>
        <li>Con miles de ítems salen millones de reglas: hay que filtrar por lift, eliminar redundantes y mirar unas pocas.</li>
        <li>Una regla describe co-ocurrencia, no causa: que \(\{\text{cerveza}\} \to \{\text{pañales}\}\) tenga lift alto no dice que
        poner cerveza cerca de los pañales aumente las ventas (ver <a href="tema.html?id=correlation-causation">correlación y causalidad</a>).</li>
        <li>Al evaluar muchas reglas, algunas tendrán lift alto por azar; conviene validarlas en otros datos o con
        <a href="tema.html?id=permutation-test">pruebas de permutación</a>.</li>
      </ul>`,
  });
})();