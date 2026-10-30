(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const FRASES = [['el', 'gato', 'persigue', 'al', 'ratón'], ['la', 'red', 'aprende', 'de', 'los', 'datos'], ['yo', 'leo', 'el', 'libro', 'que', 'tú', 'escribiste']];
  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');
  const ent = (a) => -a.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);

  /* ---------- Fig. 1: consulta, clave y valor de cada palabra ---------- */

  function montarMecanica(cuerpo) {
    let fr = 0, q = 1, d = 8, escalar = true, semilla = 1, geo = null, R = null, T = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Frase', opciones: FRASES.map((f, i) => [String(i), f.join(' ')]), valor: '0', alCambiar: (v) => { fr = +v; q = Math.min(q, FRASES[fr].length - 1); dibujar(); } });
    ctl.rango({ etiqueta: 'Dimensión de q y k (d_k)', min: 2, max: 128, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Dividir los puntajes por √d_k', valor: escalar, alCambiar: (v) => { escalar = v; dibujar(); } });
    ctl.boton('Otros pesos', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 330 : 430) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'puntaje q·k / peso de atención', forma: 'cuadro' }, { color: C.s2, texto: 'palabra que consulta', forma: 'cuadro' }, { color: C.s6, texto: 'salida: suma ponderada de los valores', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una palabra para que haga de «consulta». Todas generan una consulta q, una clave k y un valor v con matrices distintas; los pesos de este ejemplo son aleatorios y fijos (el patrón concreto no significa nada, importa el mecanismo). Sin la división por √d_k, al subir d_k los puntajes crecen y el softmax se vuelve casi un máximo duro.');
    function dibujar() {
      T = DL.transformerJuguete(semilla, d);
      const F = FRASES[fr], X = F.map((w) => T.emb(w)); R = T.atender(X, { escala: escalar });
      const { ctx, ancho: W, alto: H } = lienzo, n = F.length;
      lienzo.limpiar(); geo = { cajas: [] };
      const bw = Math.min(96, (W - 20) / n - 6), x0 = (W - n * (bw + 6)) / 2 + 3;
      F.forEach((w, i) => { const x = x0 + i * (bw + 6), act = i === q; ctx.fillStyle = act ? VIZ.alfa(C.s2, 0.25) : C.neutro; ctx.strokeStyle = act ? C.s2 : C.inactivo; ctx.lineWidth = act ? 3 : 1.5; ctx.beginPath(); ctx.roundRect(x, 8, bw, 32, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, act ? 600 : 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(w, x + bw / 2, 24); geo.cajas.push({ x, y: 8, w: bw, h: 32, i }); });
      const a = R.A[q], s = R.S[q], mx = Math.max(...s.map(Math.abs), 1e-9), bh = 70, yb = 70;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`puntaje  q·k${escalar ? ' / √d_k' : ''}  de «${F[q]}» con cada palabra`, 8, yb - 14);
      s.forEach((v, i) => { const x = x0 + i * (bw + 6), h = (Math.abs(v) / Math.max(mx, 1)) * (bh / 2 - 4); ctx.fillStyle = C.s1; ctx.globalAlpha = 0.55; ctx.fillRect(x + 6, v >= 0 ? yb + bh / 2 - h : yb + bh / 2, bw - 12, Math.max(1, h)); ctx.globalAlpha = 1; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.fillText(f2(v), x + bw / 2, yb + bh + 2); });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0, yb + bh / 2); ctx.lineTo(x0 + n * (bw + 6), yb + bh / 2); ctx.stroke();
      const yw = yb + bh + 30;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.fillText('peso de atención  α = softmax(puntajes)', 8, yw - 14);
      a.forEach((p, i) => { const x = x0 + i * (bw + 6), h = p * 70; ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x + 6, yw + 70 - h, bw - 12, Math.max(2, h), [4, 4, 0, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`${VIZ.fmt(100 * p, 3)} %`, x + bw / 2, yw + 68 - h); });
      const yo = yw + 96, o = R.O[q], mo = Math.max(...o.map(Math.abs), 1e-9);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(`salida de «${F[q]}»  =  Σ αᵢ·vᵢ  (primeras 8 de ${d} componentes)`, 8, yo - 14);
      o.slice(0, 8).forEach((v, k) => { const x = x0 + k * ((n * (bw + 6)) / 8), w = (n * (bw + 6)) / 8 - 6; ctx.fillStyle = v >= 0 ? C.s6 : C.s2; ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, Math.abs(v) / mo); ctx.fillRect(x, yo, w, 18); ctx.globalAlpha = 1; });
      const e = ent(a);
      registro.textContent = `«${F[q]}» reparte su atención: mayor peso en «${F[a.indexOf(Math.max(...a))]}» (${VIZ.fmt(100 * Math.max(...a), 3)} %). Entropía ${VIZ.fmt(e, 3)} bits de ${VIZ.fmt(Math.log2(n), 3)} posibles (${e < 0.3 * Math.log2(n) ? 'casi un máximo duro' : e > 0.9 * Math.log2(n) ? 'casi uniforme' : 'repartida'}).`;
      lectura.set([['consulta', F[q]], ['d_k', String(d)], ['escala', escalar ? '1/√d_k' : 'ninguna'], ['entropía de la atención', `${VIZ.fmt(e, 3)} bits`], ['peso máximo', `${VIZ.fmt(100 * Math.max(...a), 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), c = geo && geo.cajas.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (c) { q = c.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), c = geo && geo.cajas.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (c && R) tip.mostrar(x, y, `«${FRASES[fr][c.i]}»<br>peso desde «${FRASES[fr][q]}»: <b>${VIZ.fmt(100 * R.A[q][c.i], 3)} %</b>`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: la geometría de la atención en el plano ---------- */

  function montarGeometria(cuerpo) {
    let q = [0.8, 0.5], beta = 3, pl = null;
    const claves = [[0.9, 0.3, 'a'], [0.2, 0.9, 'b'], [-0.7, 0.5, 'c'], [-0.8, -0.4, 'd'], [0.1, -0.9, 'e'], [0.7, -0.6, 'f']], vals = [C.s1, C.s2, C.s3, C.s4, C.s7, C.s8];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Escala del puntaje (1/√d_k)', min: 0, max: 8, paso: 0.25, valor: beta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { beta = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'consulta q', forma: 'linea' }, { color: C.apagado, texto: 'claves kᵢ (el color identifica el valor vᵢ)', forma: 'punto' }, { color: C.tinta, texto: 'salida (mezcla de colores según los pesos)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para mover la consulta. El puntaje de cada clave es su producto punto con q: apunta a la clave en la dirección de q. El tamaño de cada círculo es su peso; la salida es la suma de los valores (colores) ponderada.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -1.4, xmax: 1.4, ymin: -1.4, ymax: 1.4 }, { etiquetaX: 'dimensión 1', etiquetaY: 'dimensión 2' });
      pl.ejes();
      const s = claves.map((k) => beta * (q[0] * k[0] + q[1] * k[1])), m = Math.max(...s), e = s.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0), a = e.map((v) => v / z);
      claves.forEach((k, i) => { ctx.beginPath(); ctx.arc(pl.sx(k[0]), pl.sy(k[1]), 6 + 30 * a[i], 0, 7); ctx.fillStyle = VIZ.alfa(vals[i], 0.3); ctx.fill(); ctx.strokeStyle = vals[i]; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(k[2], pl.sx(k[0]), pl.sy(k[1])); });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.sy(0)); ctx.lineTo(pl.sx(q[0]), pl.sy(q[1])); ctx.stroke();
      VIZ.marcador(ctx, pl.sx(q[0]), pl.sy(q[1]), C.tinta, 6, 6);
      const ox = a.reduce((t, p, i) => t + p * claves[i][0], 0), oy = a.reduce((t, p, i) => t + p * claves[i][1], 0);
      VIZ.marcador(ctx, pl.sx(ox), pl.sy(oy), C.tinta, 8, 3);
      const mi = a.indexOf(Math.max(...a));
      registro.textContent = `La clave «${claves[mi][2]}» recibe el ${VIZ.fmt(100 * a[mi], 3)} % de la atención. La salida cae en (${VIZ.fmt(ox, 2)}, ${VIZ.fmt(oy, 2)}), entre los valores, más cerca de los de mayor peso.`;
      lectura.set([...claves.map((k, i) => [`clave ${k[2]}`, `${VIZ.fmt(100 * a[i], 3)} %`]), ['entropía', `${VIZ.fmt(-a.reduce((t, p) => t + (p > 0 ? p * Math.log2(p) : 0), 0), 3)} bits`]]);
    }
    lienzo.alDibujar = dibujar;
    let arr = false;
    const mover = (ev) => { const { x, y } = lienzo.posicion(ev); if (pl && pl.dentro(x, y)) { q = [pl.ix(x), pl.iy(y)]; dibujar(); } };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arr = true; lienzo.canvas.setPointerCapture(ev.pointerId); mover(ev); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { if (arr) mover(ev); const { x, y } = lienzo.posicion(ev); if (pl && pl.dentro(x, y)) tip.mostrar(x, y, `q = (${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerup', () => { arr = false; });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('self-attention-qkv', {
    intro: String.raw`
      <p>En la <strong>autoatención</strong> (<em>self-attention</em>) cada palabra de una frase decide a cuáles de las demás mirar, y combina lo que encuentra. Para eso cada palabra se transforma de tres maneras: en una <strong>consulta</strong> (<em>query</em>, «qué busco»), una <strong>clave</strong> (<em>key</em>, «qué ofrezco») y un <strong>valor</strong> (<em>value</em>, «qué aporto si me eligen»).</p>
      <p>Una palabra compara su consulta con las claves de todas (producto punto), convierte esos puntajes en pesos con un softmax y suma los valores ponderados. Es un acceso a memoria «blando»: consulta una base de datos clave–valor cuyas filas son las propias palabras.</p>`,
    visualizaciones: [
      { titulo: 'Consulta, clave y valor', descripcion: 'Elija la palabra que consulta y recorra puntajes, pesos y salida. Suba \\(d_k\\) a 128 con y sin la división por \\(\\sqrt{d_k}\\).', montar: montarMecanica },
      { titulo: 'La geometría del producto punto', descripcion: 'Mueva la consulta por el plano y vea cómo la atención se concentra en las claves que apuntan hacia ella. Baje la escala a 0 para ver una mezcla uniforme.', montar: montarGeometria },
    ],
    teoria: String.raw`
      <h2>Atención de producto punto escalado</h2>
      <p>Con \(X\in\mathbb{R}^{n\times d}\) (una fila por palabra) y matrices aprendidas \(W_Q,W_K,W_V\):</p>
      \[ Q=XW_Q,\quad K=XW_K,\quad V=XW_V,\qquad \operatorname{Attention}(Q,K,V)=\operatorname{softmax}\!\Big(\frac{QK^\top}{\sqrt{d_k}}\Big)V. \]
      <p>La fila \(i\) de \(\operatorname{softmax}(QK^\top/\sqrt{d_k})\) es el vector de pesos \(\alpha_{i\cdot}\) de la palabra \(i\): no negativos y con suma 1. La salida de la palabra \(i\) es \(\sum_j\alpha_{ij}v_j\).</p>
      <h2>Por qué \(\sqrt{d_k}\)</h2>
      <p>Si las componentes de \(q\) y \(k\) son independientes con media 0 y varianza 1, \(q^\top k=\sum_{i=1}^{d_k}q_ik_i\) tiene media 0 y <em>varianza</em> \(d_k\). Sin dividir, a mayor \(d_k\), los puntajes tienen una desviación \(\sqrt{d_k}\) y el softmax se satura (un peso ≈ 1, el resto ≈ 0), con gradientes casi nulos. Dividir por \(\sqrt{d_k}\) devuelve la varianza a 1.</p>
      <h2>Costo</h2>
      <p>Calcular \(QK^\top\) cuesta \(O(n^2 d)\) y guardar los pesos, \(O(n^2)\) memoria: crece con el cuadrado del largo de la secuencia, pero todos los pares se calculan a la vez, en paralelo (<a href="tema.html?id=rnn-vs-transformer">RNN frente a Transformer</a>).</p>
      <div class="recuadro"><p>La autoatención no sabe el orden de las palabras: permutar las filas de \(X\) solo permuta las filas de la salida. El orden se añade con <a href="tema.html?id=positional-encoding">codificación posicional</a>. En la práctica se usan varias consultas en paralelo (<a href="tema.html?id=multi-head-attention">atención multi-cabeza</a>) y, al generar, se oculta el futuro (<a href="tema.html?id=masked-attention">atención enmascarada</a>).</p></div>`,
  });
})();
