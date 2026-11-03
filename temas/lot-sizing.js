(function () {
  'use strict';
  const { color: C } = VIZ;
  const T = 8;

  function demanda(semilla) {
    const rnd = VIZ.semilla(semilla * 71 + 5);
    return Array.from({ length: T }, () => 10 + 5 * Math.floor(rnd() * 11));
  }
  // Dado el vector de preparaciones y (y[0] siempre verdadero), produce en cada preparación
  // lo que se demanda hasta la siguiente. Devuelve producción, inventario final y costos.
  function plan(y, d, K, h) {
    const x = Array(T).fill(0), inv = Array(T).fill(0);
    let j = 0;
    for (let t = 0; t < T; t++) { if (y[t]) j = t; x[j] += d[t]; }
    let I = 0, mant = 0;
    for (let t = 0; t < T; t++) { I += x[t] - d[t]; inv[t] = I; mant += h * I; }
    const prep = K * y.filter(Boolean).length;
    return { x, inv, prep, mant, total: prep + mant };
  }
  // Wagner–Whitin: f[t] = mejor costo para cubrir los periodos 1..t; pred[t] = periodo de la última preparación.
  function wagnerWhitin(d, K, h) {
    const f = [0], pred = [0], cand = [];
    for (let t = 1; t <= T; t++) {
      let mejor = Infinity, jm = 1;
      cand[t] = [];
      for (let j = 1; j <= t; j++) {
        let mant = 0;
        for (let i = j; i <= t; i++) mant += (i - j) * d[i - 1];
        const c = f[j - 1] + K + h * mant;
        cand[t][j] = { c, mant: h * mant };
        if (c < mejor - 1e-9) { mejor = c; jm = j; }
      }
      f[t] = mejor; pred[t] = jm;
    }
    const y = Array(T).fill(false);
    for (let t = T; t >= 1; t = pred[t] - 1) y[pred[t] - 1] = true;
    return { f, pred, cand, y };
  }
  const yLoteALote = () => Array(T).fill(true);
  const yUnLote = () => Array.from({ length: T }, (_, t) => t === 0);

  /* ---------- Fig. 1: comparar políticas ---------- */

  function montarPoliticas(cuerpo) {
    let semilla = 1, K = 120, h = 2, d = demanda(semilla), y = yLoteALote(), mensaje = '', hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Costo de preparación K', min: 10, max: 400, paso: 10, valor: K, alCambiar: (v) => { K = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Mantención h por unidad y periodo', min: 0.5, max: 10, paso: 0.5, valor: h, alCambiar: (v) => { h = v; dibujar(); } });
    ctl.boton('Lote por lote', () => { y = yLoteALote(); mensaje = 'Lote por lote: se produce cada periodo exactamente su demanda (sin inventario, y_t = 1 siempre).'; dibujar(); });
    ctl.boton('Un solo lote', () => { y = yUnLote(); mensaje = 'Un solo lote: se produce todo en el periodo 1 y se mantiene inventario hasta el final.'; dibujar(); });
    ctl.boton('Óptimo (PD)', () => { y = wagnerWhitin(d, K, h).y; mensaje = 'Óptimo de Wagner–Whitin: la mejor combinación de preparaciones.'; dibujar(); }, { primario: true });
    ctl.boton('Nueva demanda', () => { semilla++; d = demanda(semilla); mensaje = ''; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'demanda dₜ' },
      { color: C.s1, texto: 'producción xₜ' },
      { color: C.s2, texto: 'inventario final Iₜ', forma: 'linea' },
      { color: C.s7, texto: 'preparación yₜ = 1' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una columna para encender o apagar la preparación de ese periodo (el periodo 1 siempre se prepara). La producción de cada preparación cubre la demanda hasta la siguiente.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const p = plan(y, d, K, h);
      const ymax = Math.max(20, ...p.x, ...p.inv) * 1.12;
      pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: T + 0.5, ymin: 0, ymax }, { etiquetaX: 'periodo t', etiquetaY: 'unidades', ticksX: Array.from({ length: T }, (_, i) => i + 1), formatoX: (v) => String(v), margen: { inf: 76 } });
      pl.ejes();
      const bw = (pl.sx(2) - pl.sx(1)) * 0.36;
      for (let t = 0; t < T; t++) {
        const xc = pl.sx(t + 1);
        if (t === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(xc - 2.1 * bw, pl.y1, 4.2 * bw, pl.y0 - pl.y1); }
      }
      for (let t = 0; t < T; t++) {
        const xc = pl.sx(t + 1);
        ctx.fillStyle = C.inactivo; ctx.beginPath(); ctx.roundRect(xc - bw - 1, pl.sy(d[t]), bw, pl.y0 - pl.sy(d[t]), [4, 4, 0, 0]); ctx.fill();
        if (p.x[t] > 0) { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(xc + 1, pl.sy(p.x[t]), bw, pl.y0 - pl.sy(p.x[t]), [4, 4, 0, 0]); ctx.fill(); }
      }
      VIZ.trazar(ctx, pl, p.inv.map((v, t) => [t + 1, v]), C.s2, 2);
      p.inv.forEach((v, t) => VIZ.marcador(ctx, pl.sx(t + 1), pl.sy(v), C.s2, 3.5));
      // Fila de preparaciones.
      const ys = pl.y0 + 28, lado = 22;
      ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.tinta2; ctx.fillText('yₜ', pl.x0 - 8, ys + lado / 2);
      for (let t = 0; t < T; t++) {
        const xc = pl.sx(t + 1);
        ctx.strokeStyle = y[t] ? C.s7 : C.eje; ctx.lineWidth = 1.5; ctx.fillStyle = y[t] ? C.s7 : C.superficie;
        ctx.beginPath(); ctx.roundRect(xc - lado / 2, ys, lado, lado, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = y[t] ? C.sobre : C.apagado; ctx.textAlign = 'center'; ctx.fillText(y[t] ? '1' : '0', xc, ys + lado / 2 + 0.5);
      }
      const ref = [['lote por lote', plan(yLoteALote(), d, K, h).total], ['un solo lote', plan(yUnLote(), d, K, h).total]];
      const opt = wagnerWhitin(d, K, h), copt = plan(opt.y, d, K, h).total;
      const nPrep = y.filter(Boolean).length;
      registro.textContent = mensaje || `Plan actual: ${nPrep} preparaciones, producción ${p.x.map((v) => v || '·').join(' ')}.`;
      lectura.set([
        ['costo de preparación', VIZ.fmt(p.prep)],
        ['costo de mantención', VIZ.fmt(p.mant)],
        ['costo total del plan', VIZ.fmt(p.total)],
        ['lote por lote', VIZ.fmt(ref[0][1])],
        ['un solo lote', VIZ.fmt(ref[1][1])],
        ['óptimo', `${VIZ.fmt(copt)}${p.total > copt + 1e-9 ? ` (+${VIZ.fmt(p.total - copt, 3)} de más)` : ' (¡óptimo!)'}`],
      ]);
    }
    lienzo.alDibujar = dibujar;

    const periodo = (x, y0) => { if (!pl) return -1; const t = Math.round(pl.ix(x)) - 1; return t >= 0 && t < T && x >= pl.x0 && x <= pl.x1 && y0 > pl.y1 && y0 < pl.y0 + 56 ? t : -1; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y: py } = lienzo.posicion(ev);
      const t = periodo(x, py);
      if (t < 0) return;
      if (t === 0) { mensaje = 'El periodo 1 siempre se prepara: no hay inventario inicial y y₁ = 0 dejaría sin cubrir su demanda.'; return dibujar(); }
      y[t] = !y[t];
      mensaje = y[t] ? `Se prepara en el periodo ${t + 1}: nueva producción para cubrir hasta el siguiente y = 1.` : `Se omite la preparación del periodo ${t + 1}: su demanda se produce antes y se guarda en inventario.`;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: py } = lienzo.posicion(ev);
      const t = periodo(x, py);
      if (t !== hover) { hover = t; dibujar(); }
      if (t < 0) return tip.ocultar();
      const p = plan(y, d, K, h);
      tip.mostrar(x, py, `periodo <b>${t + 1}</b><br>demanda <b>${d[t]}</b><br>producción <b>${p.x[t]}</b> ${y[t] ? '(y = 1)' : '(y = 0)'}<br>inventario final <b>${p.inv[t]}</b><br>mantención del periodo <b>${VIZ.fmt(h * p.inv[t])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: programación dinámica de Wagner–Whitin ---------- */

  function montarPD(cuerpo) {
    let semilla = 1, K = 120, h = 2, d = demanda(semilla), W = null, mensaje = '', hecho = [], actual = null, fila = 0, evaluados = 0, trazadas = 0, camino = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Preparación K', min: 10, max: 400, paso: 10, valor: K, alCambiar: (v) => { K = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Mantención h', min: 0.5, max: 10, paso: 0.5, valor: h, alCambiar: (v) => { h = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nueva demanda', () => { semilla++; d = demanda(semilla); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + T * 30 + 48 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'candidato que se evalúa (última preparación en j)' },
      { color: C.s1, texto: 'f(j−1) que se reutiliza' },
      { color: C.s6, texto: 'mínimo de la fila = f(t)' },
      { color: VIZ.alfa(C.s6, 0.25), borde: C.s6, texto: 'plan óptimo recuperado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La celda (t, j) es el costo de cubrir los periodos 1…t con una última preparación en j: f(j−1) + K + mantención de producir j…t en j. Pase el cursor sobre una celda para ver el desglose.');

    function iniciar() {
      W = wagnerWhitin(d, K, h);
      hecho = Array(T + 1).fill(false); actual = null; fila = 0; evaluados = 0; trazadas = 0; camino = [];
      mensaje = `f(0) = 0. Para cada t se prueban todas las últimas preparaciones j ≤ t y se queda la mejor (K = ${K}, h = ${h}).`;
      return (function* () {
        for (let t = 1; t <= T; t++) {
          fila = t;
          for (let j = 1; j <= t; j++) {
            actual = [t, j]; evaluados++;
            const c = W.cand[t][j];
            mensaje = `t = ${t}, j = ${j}: f(${j - 1}) = ${VIZ.fmt(W.f[j - 1])} + K = ${K} + mantención ${VIZ.fmt(c.mant)} = ${VIZ.fmt(c.c)}.`;
            if (j === t) { hecho[t] = true; mensaje += ` Mínimo de la fila: j = ${W.pred[t]} → f(${t}) = ${VIZ.fmt(W.f[t])}.`; }
            yield;
          }
        }
        actual = null;
        for (let t = T; t >= 1; t = W.pred[t] - 1) {
          camino.push([t, W.pred[t]]); trazadas++;
          mensaje = `Recuperación: en t = ${t} la mejor última preparación es j = ${W.pred[t]}: se produce ${d.slice(W.pred[t] - 1, t).reduce((a, b) => a + b, 0)} unidades en el periodo ${W.pred[t]} para cubrir ${W.pred[t]}…${t}.`;
          yield;
        }
        mensaje = `Plan óptimo: preparar en ${W.y.map((q, t) => (q ? t + 1 : 0)).filter(Boolean).join(', ')} con costo f(${T}) = ${VIZ.fmt(W.f[T])}.`;
      })();
    }

    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const L = 78, Tp = 34, ch = 30, cw = Math.min(54, (Wd - L - 2) / T);
      geo = { L, Tp, ch, cw };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = C.apagado;
      for (let j = 1; j <= T; j++) ctx.fillText(`j=${j}`, L + (j - 0.5) * cw, 12);
      ctx.textAlign = 'left'; ctx.fillText('t   f(t)', 2, 12);
      for (let t = 1; t <= T; t++) {
        const y = Tp + (t - 1) * ch;
        ctx.textAlign = 'left'; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11);
        ctx.fillText(String(t), 4, y + ch / 2);
        const visible = t <= fila;
        if (hecho[t]) { ctx.fillStyle = C.tinta; ctx.fillText(VIZ.fmt(W.f[t]), 24, y + ch / 2); }
        for (let j = 1; j <= t; j++) {
          const x = L + (j - 1) * cw, esActual = actual && actual[0] === t && actual[1] === j;
          const calculada = visible && (t < fila || !actual || j <= actual[1]);
          const enPlan = camino.slice(0, trazadas).some(([tt, jj]) => tt === t && jj === j);
          ctx.fillStyle = enPlan ? VIZ.alfa(C.s6, 0.25) : C.superficie; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
          if (calculada) {
            ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.fillText(VIZ.fmt(W.cand[t][j].c, 4), x + cw / 2, y + ch / 2);
          }
          const esMin = hecho[t] && W.pred[t] === j;
          if (esMin) { ctx.strokeStyle = C.s6; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
          if (enPlan) { ctx.strokeStyle = C.s6; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
          if (esActual) { ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
        }
      }
      if (actual && actual[1] >= 2) { // f(j−1) que se reutiliza
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.strokeRect(22, Tp + (actual[1] - 2) * ch + 4, L - 26, ch - 8);
      }
      // Demanda al pie.
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const yb = Tp + T * ch + 10;
      ctx.fillText(`demanda d₁…d₈: ${d.join('  ')}`, 2, yb);
      ctx.fillText(`K = ${K}   h = ${h}`, 2, yb + 18);
      registro.textContent = mensaje;
      const cLote = plan(yLoteALote(), d, K, h).total, cUno = plan(yUnLote(), d, K, h).total;
      lectura.set([
        ['candidatos evaluados', `${evaluados} / ${T * (T + 1) / 2}`],
        ['f(T) óptimo', hecho[T] ? VIZ.fmt(W.f[T]) : '…'],
        ['preparaciones del plan', trazadas >= camino.length && camino.length ? String(W.y.filter(Boolean).length) : '…'],
        ['lote por lote', VIZ.fmt(cLote)],
        ['un solo lote', VIZ.fmt(cUno)],
      ]);
    }
    lienzo.alDibujar = () => W && dibujar();

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const j = Math.floor((x - geo.L) / geo.cw) + 1, t = Math.floor((y - geo.Tp) / geo.ch) + 1;
      if (t < 1 || t > T || j < 1 || j > t || t > fila) return tip.ocultar();
      const c = W.cand[t][j], prep = j - 1 === 0 ? 0 : W.f[j - 1];
      tip.mostrar(x, y, `t = <b>${t}</b>, última preparación j = <b>${j}</b><br>f(${j - 1}) = <b>${VIZ.fmt(prep)}</b><br>preparación K = <b>${K}</b><br>mantención = <b>${VIZ.fmt(c.mant)}</b><br>total = <b>${VIZ.fmt(c.c)}</b><br>produce <b>${d.slice(j - 1, t).reduce((a, b) => a + b, 0)}</b> en j`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('lot-sizing', {
    intro: String.raw`
      <p>Preparar una máquina o hacer un pedido tiene un costo fijo, sin importar cuántas unidades se produzcan; guardar unidades en bodega también cuesta. Si se produce cada periodo
      exactamente lo que se vende, se paga mucha preparación; si se produce todo de una vez, se paga mucho almacenamiento. El <strong>dimensionamiento de lotes</strong>
      (<em>lot sizing</em>) busca el punto medio: decidir <em>cuándo</em> preparar y <em>cuánto</em> producir en cada preparación.</p>
      <p>La decisión «¿preparo este periodo?» es una variable binaria, y la cantidad es una variable continua que solo puede ser positiva si esa binaria vale 1. Ese enlace es el corazón de
      los modelos de planificación con costos fijos.</p>`,
    visualizaciones: [
      {
        titulo: 'Comparar políticas de producción',
        descripcion: 'Parta con «Lote por lote» y luego con «Un solo lote»; después active y apague preparaciones a mano. Suba K y verá que conviene producir menos veces; suba h y conviene lo contrario. «Óptimo (PD)» nunca pierde contra su plan.',
        montar: montarPoliticas,
      },
      {
        titulo: 'Programación dinámica de Wagner–Whitin',
        descripcion: 'Avance paso a paso: cada fila t prueba todas las últimas preparaciones j y guarda el mínimo. Cambie K y h y observe cómo cambia la columna del mínimo en cada fila y el plan recuperado.',
        montar: montarPD,
      },
    ],
    teoria: String.raw`
      <h2>Modelo con variable binaria de preparación</h2>
      <p>Con demanda \(d_t\) en los periodos \(t = 1,\dots,T\), sin inventario inicial, sea \(x_t \ge 0\) la producción, \(I_t \ge 0\) el inventario al final del periodo \(t\) y \(y_t \in \{0,1\}\) con \(y_t = 1\) si se prepara en \(t\):</p>
      \[
      \begin{aligned}
      \min\ & \sum_{t=1}^{T} \left( K\, y_t + h\, I_t \right) \\
      \text{s.a. } & I_{t-1} + x_t - d_t = I_t, \qquad I_0 = 0, \\
      & x_t \le M\, y_t, \qquad M = \sum_{s=t}^{T} d_s, \\
      & x_t, I_t \ge 0, \quad y_t \in \{0,1\}.
      \end{aligned}
      \]
      <p>La restricción \(x_t \le M y_t\) (<em>big-M</em>) hace que producir exija pagar \(K\). Fijar \(M\) igual a la demanda restante es lo más ajustado posible: un \(M\) enorme vuelve muy débil la relajación lineal, porque con \(y_t = x_t/M\) casi cero se «paga» una fracción minúscula de \(K\).
      Ese defecto motiva las <a href="tema.html?id=valid-inequalities">desigualdades válidas</a> y las <a href="tema.html?id=lp-relaxation">formulaciones fuertes</a>.</p>

      <h2>Propiedad de los planes óptimos</h2>
      <p>Hay siempre una solución óptima en la que \(I_{t-1}\, x_t = 0\) para todo \(t\): no se produce en un periodo que ya llega con inventario. Entonces cada preparación en \(j\) cubre exactamente la demanda de \(j, j+1, \dots, t\) para algún \(t \ge j\), y el problema se reduce a elegir en qué periodos partir los bloques.
      (Si en un plan se produjera con inventario positivo, se puede trasladar esa producción a la preparación anterior sin subir el costo, porque el costo es lineal.)</p>

      <h2>Algoritmo de Wagner–Whitin</h2>
      <p>Sea \(f(t)\) el mínimo costo de cubrir los periodos \(1,\dots,t\). Si la última preparación ocurre en \(j\), esa producción cubre \(j,\dots,t\) y las unidades de \(d_i\) se guardan \(i - j\) periodos:</p>
      \[ f(0) = 0, \qquad f(t) = \min_{1 \le j \le t}\Bigl\{ f(j-1) + K + h \sum_{i=j}^{t} (i - j)\, d_i \Bigr\}. \]
      <pre><code>f[0] ← 0
para t ← 1 hasta T:
    para j ← 1 hasta t:
        c ← f[j−1] + K + h · Σ_{i=j..t} (i − j) · d[i]
        si c &lt; f[t]: f[t] ← c; pred[t] ← j
t ← T
mientras t &gt; 0: preparar en pred[t]; t ← pred[t] − 1
devolver f[T]</code></pre>
      <p>Hay \(T(T+1)/2\) candidatos, así que con sumas acumuladas el costo es \(O(T^2)\): el problema con costo fijo y sin capacidad es fácil. Con capacidad por periodo deja de serlo y hace falta
      <a href="tema.html?id=milp-branch-and-bound">ramificación y acotamiento</a>.</p>

      <h2>Políticas simples</h2>
      <table>
        <tr><th>Política</th><th>Costo</th><th>Cuándo conviene</th></tr>
        <tr><td>lote por lote</td><td>\(T\,K\) (sin inventario)</td><td>\(K\) pequeño frente a \(h\)</td></tr>
        <tr><td>un solo lote</td><td>\(K + h\sum_t (t-1)\, d_t\)</td><td>\(K\) muy grande frente a \(h\)</td></tr>
        <tr><td>Wagner–Whitin</td><td>\(f(T)\), el mínimo posible</td><td>siempre; mezcla las dos ideas</td></tr>
      </table>
      <p>Para demanda constante la mejor frecuencia de pedido es la del lote económico, \(Q^* = \sqrt{2 K D / h}\); con demanda variable ese resultado ya no vale y se necesita la programación dinámica.</p>`,
  });
})();
