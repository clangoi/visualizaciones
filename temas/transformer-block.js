(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const CAMINOS = [['sin', 'sin atajos ni normalización', C.s2], ['res', 'con conexiones residuales', C.s1], ['resln', 'con residuales y Layer Norm', C.s6]];

  // Pila de capas con atención y red por posición con pesos aleatorios; devuelve la desviación de las activaciones capa a capa.
  function pila(modo, L, semilla, ancho) {
    const d = 16, n = 8, r = VIZ.semilla(semilla * 7 + 1), N = (esc) => () => VIZ.normal(r) * esc;
    const mat = (a, b, e) => Array.from({ length: a }, () => Array.from({ length: b }, N(e)));
    let X = Array.from({ length: n }, () => Array.from({ length: d }, () => VIZ.normal(r))), out = [];
    const mv = (W, x) => W.map((f) => f.reduce((s, w, i) => s + w * x[i], 0)), ln = (x) => { const m = x.reduce((s, v) => s + v, 0) / d, v = x.reduce((s, q) => s + (q - m) ** 2, 0) / d; return x.map((q) => (q - m) / Math.sqrt(v + 1e-5)); };
    for (let l = 0; l < L; l++) {
      const WQ = mat(d, d, 1 / Math.sqrt(d)), WK = mat(d, d, 1 / Math.sqrt(d)), WV = mat(d, d, ancho / Math.sqrt(d)), W1 = mat(2 * d, d, ancho * Math.SQRT2 / Math.sqrt(d)), W2 = mat(d, 2 * d, ancho / Math.sqrt(2 * d));
      const entrada = modo === 'resln' ? X.map(ln) : X;
      const Q = entrada.map((x) => mv(WQ, x)), K = entrada.map((x) => mv(WK, x)), V = entrada.map((x) => mv(WV, x));
      const att = Q.map((q) => { const s = K.map((k) => q.reduce((t, v, i) => t + v * k[i], 0) / Math.sqrt(d)), m = Math.max(...s), e = s.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0); return V[0].map((_, c) => e.reduce((t, w, j) => t + (w / z) * V[j][c], 0)); });
      let Y = modo === 'sin' ? att : X.map((x, i) => x.map((v, c) => v + att[i][c]));
      const ent2 = modo === 'resln' ? Y.map(ln) : Y;
      const ffn = ent2.map((y) => mv(W2, mv(W1, y).map((v) => Math.max(0, v))));
      X = modo === 'sin' ? ffn : Y.map((y, i) => y.map((v, c) => v + ffn[i][c]));
      const fl = X.flat(), mu = fl.reduce((s, v) => s + v, 0) / fl.length;
      out.push(Math.sqrt(fl.reduce((s, v) => s + (v - mu) ** 2, 0) / fl.length));
    }
    return out;
  }

  /* ---------- Fig. 1: qué hacen los atajos y la normalización en una pila profunda ---------- */

  function montarPila(cuerpo) {
    let L = 24, ancho = 0.7, semilla = 1, res = null, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capas apiladas', min: 4, max: 48, valor: L, alCambiar: (v) => { L = v; calcular(); } });
    ctl.rango({ etiqueta: 'Escala de los pesos', min: 0.3, max: 1.6, paso: 0.05, valor: ancho, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { ancho = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CAMINOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Capas con autoatención y red por posición (ReLU), pesos aleatorios, 8 palabras de 16 dimensiones; se grafica la desviación de las activaciones tras cada capa. Sin atajos, la señal se apaga o explota con la profundidad; con atajos aditivos crece despacio; con Layer Norm se mantiene estable.');
    function calcular() { res = CAMINOS.map(([k]) => pila(k, L, semilla, ancho)); dibujar(); }
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: L, ymin: 1e-6, ymax: 1e6 }, { logY: true, etiquetaX: 'capa', etiquetaY: 'desviación de las activaciones', formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      res.forEach((s, i) => VIZ.trazar(ctx, pl, s.map((v, l) => [l + 1, Math.max(1e-6, Math.min(v, 1e6))]), CAMINOS[i][2], 2.5));
      if (hover > 0) res.forEach((s, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(1e-6, Math.min(s[hover - 1], 1e6))), CAMINOS[i][2], 4));
      ctx.restore();
      registro.textContent = `En la capa ${L}: sin atajos ${VIZ.fmt(res[0][L - 1], 2)}, con residuales ${VIZ.fmt(res[1][L - 1], 2)}, con residuales y Layer Norm ${VIZ.fmt(res[2][L - 1], 2)}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res) { hover = -1; tip.ocultar(); return; }
      hover = Math.max(1, Math.min(L, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `capa <b>${hover}</b>` + CAMINOS.map(([, t, c], i) => VIZ.filaTooltip(c, t.split(' ').slice(0, 3).join(' '), VIZ.fmt(res[i][hover - 1], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: de qué está hecho un Transformer ---------- */

  const MODELOS = { 'GPT-2 pequeño': [768, 12, 12, 3072, 50257, 1024], 'GPT-2 mediano': [1024, 16, 24, 4096, 50257, 1024], 'Transformer base (2017)': [512, 8, 6, 2048, 37000, 512] };
  function montarCuenta(cuerpo) {
    let d = 768, h = 12, L = 12, ff = 3072, V = 50257, pos = 1024, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Configuración conocida', opciones: [['', '— a medida —'], ...Object.keys(MODELOS).map((k) => [k, k])], valor: 'GPT-2 pequeño', alCambiar: (k) => { if (!k) return; [d, h, L, ff, V, pos] = MODELOS[k]; r.d.valor = d; r.L.valor = L; r.ff.valor = ff; dibujar(); } });
    const r = { d: ctl.rango({ etiqueta: 'Dimensión d', min: 64, max: 2048, paso: 64, valor: d, alCambiar: (v) => { d = v; dibujar(); } }), L: ctl.rango({ etiqueta: 'Capas', min: 1, max: 48, valor: L, alCambiar: (v) => { L = v; dibujar(); } }), ff: ctl.rango({ etiqueta: 'Dimensión de la red por posición', min: 128, max: 8192, paso: 128, valor: ff, alCambiar: (v) => { ff = v; dibujar(); } }) };
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'atención (W_Q, W_K, W_V, W_O)', forma: 'cuadro' }, { color: C.s2, texto: 'red por posición (2 capas densas)', forma: 'cuadro' }, { color: C.s3, texto: 'Layer Norm', forma: 'cuadro' }, { color: C.s7, texto: 'embeddings de palabras y posiciones', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Conteo exacto de parámetros por componente de un decodificador tipo GPT con embeddings de entrada y salida compartidos. Con la configuración de GPT-2 pequeño el total da ≈ 124 millones.');
    function dibujar() {
      const att = 4 * d * d + 4 * d, red = 2 * d * ff + ff + d, nor = 2 * 2 * d, emb = V * d, ps = pos * d, bloque = att + red + nor, tot = emb + ps + L * bloque + 2 * d;
      const partes = [['atención', L * att, C.s1], ['red por posición', L * red, C.s2], ['Layer Norm', L * nor + 2 * d, C.s3], ['embeddings', emb + ps, C.s7]];
      const { ctx, ancho: W } = lienzo; lienzo.limpiar(); geo = [];
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`Total: ${VIZ.entero(tot)} parámetros`, 12, 6);
      let x = 12; const anch = W - 24;
      partes.forEach(([n, v, c]) => { const w = (v / tot) * anch; ctx.fillStyle = VIZ.alfa(c, 0.85); ctx.fillRect(x, 28, Math.max(1, w), 40); if (w > 70) { ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle'; ctx.fillText(`${VIZ.fmt((100 * v) / tot, 3)} %`, x + 6, 48); } geo.push({ x, w, t: `${n}: ${VIZ.entero(v)} (${VIZ.fmt((100 * v) / tot, 3)} %)` }); x += w; });
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'top'; ctx.fillText('Un bloque (se repite L veces)', 12, 92);
      const bl = [['Layer Norm', nor / 2, C.s3], ['Atención multi-cabeza', att, C.s1], ['Layer Norm', nor / 2, C.s3], ['Red por posición', red, C.s2]], bt = bloque; x = 12;
      bl.forEach(([n, v, c]) => { const w = Math.max(60, (v / bt) * anch - 4); ctx.fillStyle = VIZ.alfa(c, 0.25); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, 114, w, 44, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(w > 90 ? n : 'LN', x + w / 2, 130); ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(VIZ.entero(v), x + w / 2, 146); geo.push({ x, w, t: `${n}: ${VIZ.entero(v)}`, y: 114 }); x += w + 6; });
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('x → [Layer Norm → atención] + x → [Layer Norm → red por posición] + x   (conexiones residuales con «+ x»)', 12, 176);
      registro.textContent = `Un bloque tiene ${VIZ.entero(bloque)} parámetros: ${VIZ.fmt((100 * att) / bloque, 3)} % en la atención y ${VIZ.fmt((100 * red) / bloque, 3)} % en la red por posición (que, con d_ff = ${ff}, pesa ${VIZ.fmt(red / att, 3)} veces lo que la atención).`;
      lectura.set([['total', VIZ.entero(tot)], ['por bloque', VIZ.entero(bloque)], ['embeddings', `${VIZ.fmt((100 * (emb + ps)) / tot, 3)} %`], ['memoria en float32', `${VIZ.fmt((tot * 4) / 1e9, 3)} GB`], ['cabezas × d_k', `${h} × ${d / h}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x <= q.x + q.w && (q.y ? y >= q.y && y <= q.y + 44 : y >= 28 && y <= 68)); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('transformer-block', {
    intro: String.raw`
      <p>Un <strong>Transformer</strong> es una pila de bloques idénticos. Cada bloque tiene dos subcapas: la <strong>atención multi-cabeza</strong>, que mezcla información <em>entre</em> palabras, y una <strong>red por posición</strong> (dos capas densas), que procesa cada palabra por separado. Alrededor de cada subcapa hay una <strong>conexión residual</strong> (se suma la entrada a la salida) y una <strong>normalización de capa</strong> (<em>Layer Norm</em>).</p>
      <p>Esos dos ingredientes alrededor son los que permiten apilar decenas de bloques: sin ellos, la señal y el gradiente se pierden o explotan, igual que en cualquier red profunda.</p>`,
    visualizaciones: [
      { titulo: 'Qué mantiene estable una pila profunda', descripcion: 'Apile 24 o 48 capas con pesos aleatorios y compare las tres variantes. Cambie la escala de los pesos y vea cuál resiste.', montar: montarPila },
      { titulo: 'De qué está hecho un Transformer', descripcion: 'Cambie la dimensión, las capas y el tamaño de la red por posición, o cargue la configuración de GPT-2 pequeño.', montar: montarCuenta },
    ],
    teoria: String.raw`
      <h2>Un bloque (pre-norm)</h2>
      \[ \begin{aligned} x' &= x+\operatorname{MHA}\big(\operatorname{LN}(x)\big),\\ y &= x' + \operatorname{FFN}\big(\operatorname{LN}(x')\big),\qquad \operatorname{FFN}(z)=W_2\,\phi(W_1 z+b_1)+b_2, \end{aligned} \]
      <p>con \(\phi\) = ReLU o GELU, \(W_1\in\mathbb{R}^{d_{ff}\times d}\), \(W_2\in\mathbb{R}^{d\times d_{ff}}\), habitualmente \(d_{ff}=4d\). El Transformer original aplicaba la normalización después de la suma (<em>post-norm</em>); hoy casi todos usan <em>pre-norm</em>, que entrena de forma más estable.</p>
      <h2>Layer Normalization</h2>
      <p>A diferencia de la <a href="tema.html?id=batch-normalization">normalización por lotes</a>, normaliza cada palabra por separado, a lo largo de sus \(d\) componentes, sin depender del lote ni del largo de la secuencia:</p>
      \[ \operatorname{LN}(x)=\gamma\odot\frac{x-\mu(x)}{\sqrt{\sigma^2(x)+\varepsilon}}+\beta, \qquad \mu=\tfrac1d\sum_i x_i,\ \ \sigma^2=\tfrac1d\sum_i (x_i-\mu)^2. \]
      <h2>Conexiones residuales</h2>
      <p>Cada subcapa aprende una corrección \(F(x)\) que se suma a \(x\): \(\partial y/\partial x=I+\partial F/\partial x\). El gradiente tiene siempre un camino directo a las capas anteriores (<a href="tema.html?id=cnn-architectures">igual que en ResNet</a>).</p>
      <h2>Parámetros</h2>
      <table>
        <tr><th>Componente</th><th>Parámetros por bloque</th></tr>
        <tr><td>Atención</td><td>\(4d^2+4d\)</td></tr>
        <tr><td>Red por posición</td><td>\(2\,d\,d_{ff}+d_{ff}+d\)</td></tr>
        <tr><td>Dos Layer Norm</td><td>\(4d\)</td></tr>
      </table>
      <div class="recuadro"><p>Con \(d_{ff}=4d\), la red por posición tiene el doble de parámetros que la atención. Los demás ingredientes —<a href="tema.html?id=multi-head-attention">multi-cabeza</a>, <a href="tema.html?id=positional-encoding">posición</a>, <a href="tema.html?id=masked-attention">máscara</a>— se combinan en <a href="tema.html?id=rnn-vs-transformer">la comparación con las RNN</a>.</p></div>`,
  });
})();
