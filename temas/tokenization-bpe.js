(function () {
  'use strict';
  const { color: C } = VIZ;

  const PALABRAS = [['cantar', 8], ['cantando', 5], ['cantaba', 4], ['canción', 3], ['cantante', 3], ['bailar', 7], ['bailando', 5], ['bailaba', 4], ['baile', 4], ['bailarín', 2], ['correr', 6], ['corriendo', 5], ['corría', 3], ['carrera', 3]];
  const FIN = '·';
  const COLS = [C.s1, C.s2, C.s3, C.s7, C.s4, C.s6];

  // Entrena BPE: devuelve la lista de fusiones en orden, y la segmentación de cada palabra tras k fusiones.
  function entrenar(palabras, K) {
    let segs = palabras.map(([w, f]) => ({ w, f, t: [...w, FIN] })), fusiones = [];
    for (let k = 0; k < K; k++) {
      const cuenta = new Map();
      segs.forEach((s) => { for (let i = 0; i + 1 < s.t.length; i++) { const p = `${s.t[i]}\u0001${s.t[i + 1]}`; cuenta.set(p, (cuenta.get(p) || 0) + s.f); } });
      if (!cuenta.size) break;
      let mejor = null; for (const [p, c] of cuenta) if (!mejor || c > mejor[1]) mejor = [p, c];
      const [a, b] = mejor[0].split('\u0001'); fusiones.push({ a, b, n: mejor[1] });
      segs = segs.map((s) => { const t = []; for (let i = 0; i < s.t.length; i++) { if (i + 1 < s.t.length && s.t[i] === a && s.t[i + 1] === b) { t.push(a + b); i++; } else t.push(s.t[i]); } return { ...s, t }; });
    }
    return { fusiones, segs };
  }
  // Aplica las fusiones, en orden, a una palabra cualquiera.
  function tokenizar(palabra, fusiones) {
    let t = [...palabra, FIN];
    for (const { a, b } of fusiones) { const u = []; for (let i = 0; i < t.length; i++) { if (i + 1 < t.length && t[i] === a && t[i + 1] === b) { u.push(a + b); i++; } else u.push(t[i]); } t = u; }
    return t;
  }
  const mostrar = (t) => t.replace(FIN, '·');

  /* ---------- Fig. 1: fusionar los pares más frecuentes ---------- */

  function montarFusiones(cuerpo) {
    let todas = entrenar(PALABRAS, 60).fusiones, MAX = todas.length, k = 0, texto = 'cantando y bailando', geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Texto a segmentar (palabras separadas por espacios)', valor: texto, alCambiar: (v) => { texto = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5, velMax: 5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 440 : 520) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cada recuadro es un token; los colores se alternan', forma: 'cuadro' }, { color: C.apagado, texto: '· marca el fin de palabra', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se parte de letras sueltas. Cada paso funde el par de símbolos contiguo más frecuente en un símbolo nuevo (el vocabulario crece de a uno). Escriba abajo una palabra nueva —por ejemplo «cantador» o «bailemos»— y vea cómo se segmenta con lo aprendido.');
    function iniciar() { k = 0; return (function* () { for (let i = 1; i <= MAX; i++) { k = i; yield; } })(); }
    function dibujar() {
      const fus = todas.slice(0, k), { ctx, ancho: W } = lienzo, ancha = W > 640;
      lienzo.limpiar(); geo = [];
      const dibTokens = (t, x, y, maxW) => { let cx = x; t.forEach((s, i) => { ctx.font = VIZ.fuente(12); const w = ctx.measureText(mostrar(s)).width + 10; if (cx + w > x + maxW) return; ctx.fillStyle = VIZ.alfa(COLS[i % 6], 0.22); ctx.strokeStyle = COLS[i % 6]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx, y, w, 22, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(mostrar(s), cx + 5, y + 11); geo.push({ x: cx, y, w, h: 22, t: `token «${mostrar(s)}»` }); cx += w + 3; }); };
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Corpus (palabra × frecuencia)', 8, 6);
      const anchoL = ancha ? Math.min(560, W * 0.65) : W - 16;
      PALABRAS.forEach(([w, f], i) => { const y = 26 + i * 27; ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`×${f}`, 34, y + 11); dibTokens(tokenizar(w, fus), 42, y, anchoL - 42); });
      const xr = ancha ? anchoL + 16 : 8, yr = ancha ? 6 : 26 + PALABRAS.length * 27 + 16;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Últimas fusiones', xr, yr);
      fus.slice(-7).reverse().forEach((m, i) => { ctx.fillStyle = i === 0 ? C.tinta : C.apagado; ctx.font = VIZ.fuente(11, i === 0 ? 600 : 400); ctx.fillText(`${mostrar(m.a)} + ${mostrar(m.b)} → ${mostrar(m.a + m.b)}  (${m.n}×)`, xr, yr + 20 + i * 18); });
      const yt = ancha ? yr + 20 + 7 * 18 + 22 : yr + 20 + 7 * 18 + 16;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText('Su texto', xr, yt);
      texto.split(/\s+/).filter(Boolean).slice(0, 6).forEach((w, i) => dibTokens(tokenizar(w.toLowerCase(), fus), xr, yt + 20 + i * 28, ancha ? W - xr - 8 : W - 16));
      const tot = PALABRAS.reduce((s, [, f]) => s + f, 0), tk = PALABRAS.reduce((s, [w, f]) => s + f * tokenizar(w, fus).length, 0);
      registro.textContent = k ? `Fusión ${k}: «${mostrar(fus[k - 1].a)}» + «${mostrar(fus[k - 1].b)}» → «${mostrar(fus[k - 1].a + fus[k - 1].b)}» (aparecía ${fus[k - 1].n} veces).` : 'Punto de partida: una letra por token (más el marcador de fin de palabra).';
      const letras = new Set(PALABRAS.flatMap(([w]) => [...w, FIN]));
      lectura.set([['fusiones', String(k)], ['tamaño del vocabulario', String(letras.size + k)], ['tokens por palabra (promedio ponderado)', VIZ.fmt(tk / tot, 3)], ['tokens para el corpus completo', VIZ.entero(tk)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo && geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: vocabulario grande o secuencia larga ---------- */

  function montarCompromiso(cuerpo) {
    let hover = -1, pl = null;
    const curva = (() => { const arr = []; const letras = new Set(PALABRAS.flatMap(([w]) => [...w, FIN])).size, tot = PALABRAS.reduce((s, [, f]) => s + f, 0), all = entrenar(PALABRAS, 60).fusiones; for (let k = 0; k <= all.length; k++) { const fus = all.slice(0, k); arr.push({ k, V: letras + k, tpp: PALABRAS.reduce((s, [w, f]) => s + f * tokenizar(w, fus).length, 0) / tot }); } return arr; })();
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tokens por palabra (secuencia más corta = menos cálculo)', forma: 'linea' }, { color: C.s2, texto: 'tamaño del vocabulario (más filas en la tabla de embeddings)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cada fusión añade un token al vocabulario y acorta algunas secuencias. Al principio ganar es barato; después los tokens nuevos son raros y las secuencias casi no se acortan. Los vocabularios reales (30 000 – 100 000 tokens) eligen el punto de equilibrio con el costo de la tabla de embeddings y del softmax final.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: curva.length - 1, ymin: 0, ymax: 1.05 }, { etiquetaX: 'fusiones realizadas', etiquetaY: 'valor relativo al inicio', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      const MAXK = curva.length - 1, t0 = curva[0].tpp, v0 = curva[MAXK].V;
      VIZ.trazar(ctx, pl, curva.map((c) => [c.k, c.tpp / t0]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, curva.map((c) => [c.k, c.V / v0]), C.s2, 2.5);
      if (hover >= 0) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(curva[hover].tpp / t0), C.s1, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(curva[hover].V / v0), C.s2, 4); }
      const c = curva[hover >= 0 ? hover : MAXK];
      registro.textContent = `Con ${c.k} fusiones: ${VIZ.fmt(c.tpp, 3)} tokens por palabra (${VIZ.fmt(100 * c.tpp / t0, 3)} % del inicio) con un vocabulario de ${c.V} símbolos.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(curva.length - 1, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `fusiones <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'tokens/palabra', VIZ.fmt(curva[hover].tpp, 3)) + VIZ.filaTooltip(C.s2, 'vocabulario', String(curva[hover].V)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('tokenization-bpe', {
    intro: String.raw`
      <p>Los modelos de lenguaje no leen letras ni palabras enteras, sino <strong>tokens</strong>: fragmentos intermedios. Si el vocabulario fuera de letras, las secuencias serían larguísimas; si fuera de palabras, haría falta una entrada por cada conjugación, nombre propio y errata, y cualquier palabra nueva sería desconocida.</p>
      <p>La <strong>codificación por pares de bytes</strong> (<em>Byte-Pair Encoding</em>, BPE) encuentra un punto medio automáticamente: parte de letras y va fundiendo, una y otra vez, el par más frecuente. Las raíces y terminaciones comunes («cant», «ando», «bail») se vuelven tokens; una palabra rara se descompone en trozos conocidos.</p>`,
    visualizaciones: [
      { titulo: 'Fusionar el par más frecuente', descripcion: 'Reproduzca las fusiones y mire cómo aparecen fragmentos compartidos (raíces y terminaciones) antes de que cada palabra sea un único token. Escriba una palabra nueva y vea cómo se segmenta.', montar: montarFusiones },
      { titulo: 'Vocabulario grande o secuencias largas', descripcion: 'Recorra la curva del compromiso: cada token extra acorta menos que el anterior.', montar: montarCompromiso },
    ],
    teoria: String.raw`
      <h2>Algoritmo de entrenamiento</h2>
      <pre><code>vocabulario ← caracteres del corpus (+ marcador de fin de palabra)
repetir M veces:
    contar los pares de símbolos contiguos en el corpus, ponderados por frecuencia
    (a, b) ← el par más frecuente
    crear el símbolo «ab»; reemplazar toda aparición del par (a, b) por «ab»
    guardar la fusión (a, b)
devolver el vocabulario y la lista ordenada de fusiones</code></pre>
      <p>Para tokenizar un texto nuevo se parte en letras y se aplican las fusiones <em>en el mismo orden</em>. Así cualquier palabra queda cubierta: en el peor caso, letra por letra.</p>
      <h2>Variantes</h2>
      <ul>
        <li><strong>BPE a nivel de bytes</strong> (GPT-2 y posteriores): parte de los 256 bytes, de modo que ningún texto, en ningún idioma o emoji, es «desconocido».</li>
        <li><strong>WordPiece</strong> (BERT) y <strong>Unigram / SentencePiece</strong>: eligen los fragmentos por verosimilitud, no solo por frecuencia.</li>
      </ul>
      <h2>Consecuencias prácticas</h2>
      <ul>
        <li>El modelo ve tokens, no letras: por eso le cuesta contar letras de una palabra o invertirla.</li>
        <li>Los idiomas poco representados en el corpus del tokenizador se parten en más tokens por palabra: cuestan más y caben menos en el contexto.</li>
        <li>El tamaño del vocabulario \(V\) fija el de la tabla de <a href="tema.html?id=embeddings">embeddings</a> (\(V\times d\)) y el de la capa de salida (<a href="tema.html?id=next-token-prediction">softmax sobre \(V\)</a>).</li>
      </ul>`,
  });
})();
