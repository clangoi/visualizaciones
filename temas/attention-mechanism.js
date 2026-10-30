(function () {
  'use strict';
  const { color: C } = VIZ;

  // Conceptos con un ángulo cada uno; las palabras de ambos idiomas se escriben como vectores unitarios cerca del ángulo del concepto.
  const CONCEPTOS = { la: 0, casa: 60, blanca: 120, el: 180, gato: 240, negro: 300, duerme: 30, yo: 90, bebo: 150, agua: 210, fría: 270 };
  const EN = { the: 'la', house: 'casa', white: 'blanca', cat: 'gato', black: 'negro', sleeps: 'duerme', i: 'yo', drink: 'bebo', water: 'agua', cold: 'fría' };
  const FRASES = [
    { es: ['la', 'casa', 'blanca'], en: ['the', 'white', 'house'] },
    { es: ['el', 'gato', 'negro', 'duerme'], en: ['the', 'black', 'cat', 'sleeps'] },
    { es: ['yo', 'bebo', 'agua', 'fría'], en: ['i', 'drink', 'cold', 'water'] },
  ];
  const vecEs = (w, i) => { const a = ((CONCEPTOS[w] + 4 * Math.sin(i * 7 + 1)) * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; };
  const vecEn = (w, j) => { const c = w === 'the' ? (CONCEPTOS.la + CONCEPTOS.el) / 2 : CONCEPTOS[EN[w]]; const a = ((w === 'the' ? 0 : c) + 4 * Math.sin(j * 5 + 2)) * Math.PI / 180; return w === 'the' ? null : [Math.cos(a), Math.sin(a)]; };
  const softmax = (v) => { const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
  // Artículos: «la» y «el» se traducen ambos como «the», y se alinean con su artículo.
  function atencion(F, beta) {
    return F.en.map((w, j) => {
      let q;
      if (w === 'the') q = vecEs(F.es[0], 0); else q = vecEn(w, j);
      const k = F.es.map((x, i) => vecEs(x, i)), s = k.map((v) => beta * (q[0] * v[0] + q[1] * v[1]));
      return { a: softmax(s), q, k };
    });
  }

  /* ---------- Fig. 1: la matriz de alineamiento ---------- */

  function montarAlineamiento(cuerpo) {
    let ej = 1, beta = 6, geo = null, M = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Frase', opciones: FRASES.map((f, i) => [String(i), f.es.join(' ')]), valor: String(ej), alCambiar: (v) => { ej = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Agudeza β (1/temperatura)', min: 0, max: 15, paso: 0.5, valor: beta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { beta = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(64, (w - 130) / 6) * 0.85 * 5 + 64) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'peso de atención (más oscuro = más atención)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una palabra que el decodificador escribe; cada columna, una palabra de origen. La fila suma 1: es cómo reparte su atención. Los vectores de este ejemplo están diseñados a mano (traducciones cerca una de otra) para mostrar el patrón; en un modelo real se aprenden.');
    function dibujar() {
      const F = FRASES[ej], { ctx, ancho: W } = lienzo, n = F.es.length, c = Math.min(64, (W - 130) / Math.max(n, 3)), x0 = 110, y0 = 34;
      M = atencion(F, beta);
      lienzo.limpiar(); geo = { x0, y0, c };
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      F.es.forEach((w, i) => ctx.fillText(w, x0 + (i + 0.5) * c, y0 - 6));
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      F.en.forEach((w, j) => ctx.fillText(w, x0 - 8, y0 + (j + 0.5) * c * 0.85));
      DL_mapa(ctx, M.map((m) => m.a), x0, y0, n * c, F.en.length * c * 0.85);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('origen (español) →', x0, 4);
      const reorden = F.en.some((w, j) => M[j].a.indexOf(Math.max(...M[j].a)) !== j && w !== 'the');
      registro.textContent = `Máxima atención por palabra: ${F.en.map((w, j) => `${w} → ${F.es[M[j].a.indexOf(Math.max(...M[j].a))]} (${VIZ.fmt(100 * Math.max(...M[j].a), 3)} %)`).join('; ')}.${reorden ? ' Hay cruces: el orden de adjetivo y sustantivo cambia entre idiomas.' : ''}`;
      lectura.set([['palabras de origen', String(n)], ['palabras de destino', String(F.en.length)], ['agudeza β', VIZ.fmt(beta, 2)], ['entropía media de la atención', `${VIZ.fmt(M.reduce((s, m) => s - m.a.reduce((t, p) => t + (p > 0 ? p * Math.log2(p) : 0), 0), 0) / M.length, 3)} bits`]]);
    }
    const DL_mapa = (ctx, mat, x, y, w, h) => VIZ.dl.mapa(ctx, mat, x, y, w, h, { min: 0, max: 1, valores: (v) => VIZ.fmt(v, 2) });
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !M) return tip.ocultar();
      const F = FRASES[ej], i = Math.floor((x - geo.x0) / geo.c), j = Math.floor((y - geo.y0) / (geo.c * 0.85));
      if (i >= 0 && i < F.es.length && j >= 0 && j < F.en.length) tip.mostrar(x, y, `«${F.en[j]}» mira a «${F.es[i]}»: <b>${VIZ.fmt(100 * M[j].a[i], 3)} %</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el vector de contexto como suma ponderada ---------- */

  function montarContexto(cuerpo) {
    let ej = 1, j = 2, beta = 6, pl = null, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Frase', opciones: FRASES.map((f, i) => [String(i), f.es.join(' ')]), valor: String(ej), alCambiar: (v) => { ej = +v; j = Math.min(j, FRASES[ej].en.length - 1); sl.max = FRASES[ej].en.length; dibujar(); } });
    const sl = ctl.rango({ etiqueta: 'Palabra que se escribe (posición en el destino)', min: 1, max: 4, valor: j + 1, alCambiar: (v) => { j = Math.min(v - 1, FRASES[ej].en.length - 1); dibujar(); } });
    ctl.rango({ etiqueta: 'Agudeza β', min: 0, max: 15, paso: 0.5, valor: beta, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { beta = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'palabra de origen (tamaño = peso de atención)', forma: 'punto' }, { color: C.s2, texto: 'consulta del decodificador', forma: 'linea' }, { color: C.s6, texto: 'vector de contexto = Σ αᵢ·hᵢ', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los estados del codificador, aquí vectores de 2 dimensiones, se mezclan según los pesos de atención. Con β = 0 todos pesan lo mismo y el contexto cae en el centro (como un promedio); con β grande el contexto se pega a la palabra más parecida a la consulta.');
    function dibujar() {
      const F = FRASES[ej], { ctx } = lienzo, M = atencion(F, beta)[j];
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -1.3, xmax: 1.3, ymin: -1.3, ymax: 1.3 }, { etiquetaX: 'h₁', etiquetaY: 'h₂' });
      pl.ejes();
      ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.arc(pl.sx(0), pl.sy(0), Math.abs(pl.sx(1) - pl.sx(0)), 0, 7); ctx.stroke();
      const cx = M.a.reduce((s, a, i) => s + a * M.k[i][0], 0), cy = M.a.reduce((s, a, i) => s + a * M.k[i][1], 0);
      pos = M.k.map((v, i) => ({ x: pl.sx(v[0]), y: pl.sy(v[1]), w: F.es[i], a: M.a[i] }));
      pos.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 5 + 22 * p.a, 0, 7); ctx.fillStyle = VIZ.alfa(C.s1, 0.35); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.w, p.x, p.y - 8 - 22 * p.a); });
      ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.sy(0)); ctx.lineTo(pl.sx(M.q[0]), pl.sy(M.q[1])); ctx.stroke();
      VIZ.marcador(ctx, pl.sx(cx), pl.sy(cy), C.s6, 7, 6);
      const mejor = M.a.indexOf(Math.max(...M.a));
      registro.textContent = `Para escribir «${F.en[j]}», el decodificador compara su consulta con cada palabra de origen: la mayor atención va a «${F.es[mejor]}» (${VIZ.fmt(100 * M.a[mejor], 3)} %). El contexto resultante es (${VIZ.fmt(cx, 2)}, ${VIZ.fmt(cy, 2)}).`;
      lectura.set([...F.es.map((w, i) => [`peso de «${w}»`, `${VIZ.fmt(100 * M.a[i], 3)} %`]), ['contexto', `(${VIZ.fmt(cx, 2)}, ${VIZ.fmt(cy, 2)})`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), p = pos.find((q) => Math.hypot(q.x - x, q.y - y) < 14 + 22 * q.a);
      if (p) tip.mostrar(x, y, `<b>${p.w}</b><br>peso de atención ${VIZ.fmt(100 * p.a, 3)} %`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('attention-mechanism', {
    intro: String.raw`
      <p>Para traducir «la casa blanca», al escribir «white» uno no necesita recordar toda la frase: le basta mirar «blanca». El <strong>mecanismo de atención</strong> le da al decodificador esa capacidad: en cada paso, en vez de depender de un único vector de contexto, <em>consulta</em> todos los estados del codificador y se queda con una mezcla donde pesan más los relevantes.</p>
      <p>Esa mezcla es una suma ponderada: los pesos (los <em>attention scores</em>, tras un softmax) salen de comparar la consulta del decodificador con cada estado de origen. Todo es diferenciable, así que los pesos se aprenden junto con el resto de la red, y de paso muestran qué mira el modelo.</p>`,
    visualizaciones: [
      { titulo: 'La matriz de alineamiento', descripcion: 'Mire cómo se alinean las palabras de origen y de destino, incluidos los cruces por el orden distinto de adjetivo y sustantivo. Baje β a 0 y vea cómo la atención se reparte pareja.', montar: montarAlineamiento },
      { titulo: 'El contexto como suma ponderada', descripcion: 'Elija qué palabra se escribe y mueva β: el contexto se mueve entre el promedio y la palabra más relevante.', montar: montarContexto },
    ],
    teoria: String.raw`
      <h2>Atención de Bahdanau y de Luong</h2>
      <p>Sean \(h_1,\dots,h_n\) los estados del codificador y \(s_{j}\) el estado del decodificador al escribir la palabra \(j\). Para cada \(i\):</p>
      \[ e_{ji}=\operatorname{score}(s_j,h_i),\qquad \alpha_{ji}=\frac{\exp(e_{ji})}{\sum_{k=1}^{n}\exp(e_{jk})},\qquad c_j=\sum_{i=1}^{n}\alpha_{ji}\,h_i. \]
      <p>El contexto \(c_j\) cambia en cada paso. Formas habituales del puntaje:</p>
      <table>
        <tr><th>Nombre</th><th>\(\operatorname{score}(s,h)\)</th></tr>
        <tr><td>Producto punto (Luong)</td><td>\(s^\top h\)</td></tr>
        <tr><td>General</td><td>\(s^\top W h\)</td></tr>
        <tr><td>Aditiva (Bahdanau)</td><td>\(v^\top\tanh(W_1 s + W_2 h)\)</td></tr>
      </table>
      <p>El decodificador usa \(c_j\) junto con \(s_j\) para predecir \(y_j\): \(P(y_j\mid y_{<j},x)=\operatorname{softmax}\big(W[s_j;c_j]\big)\).</p>
      <h2>Qué se gana</h2>
      <ul>
        <li>Se elimina el cuello de botella: la información de cada palabra está disponible directamente, por largo que sea el texto.</li>
        <li>Hay un camino corto del gradiente entre cada palabra de salida y las de entrada.</li>
        <li>Interpretabilidad: la matriz \(\alpha\) es un alineamiento aproximado (aunque no una explicación causal fiable).</li>
      </ul>
      <div class="recuadro"><p>Una vez que la atención hace el trabajo, la recurrencia sobra. Los <a href="tema.html?id=self-attention-qkv">Transformers</a> la reemplazan por atención de cada palabra con todas las demás (<em>self-attention</em>), con consultas, claves y valores aprendidos.</p></div>`,
  });
})();
