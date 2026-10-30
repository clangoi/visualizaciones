(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  const COLG = [C.s1, C.s2, C.s3];

  /* ---------- Fig. 1: un mapa de palabras construido solo con a qué palabras acompañan ---------- */

  function montarMapa(cuerpo) {
    let semilla = 1, par = '0,1', sel = 'perro', E = null, pl = null, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejes mostrados', opciones: [['0,1', 'direcciones 1 y 2'], ['1,2', 'direcciones 2 y 3'], ['0,2', 'direcciones 1 y 3']], valor: par, alCambiar: (v) => { par = v; dibujar(); } });
    ctl.boton('Otro corpus', () => { semilla++; E = DL.embeddings(semilla); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    E = DL.embeddings(semilla);
    VIZ.leyenda(cuerpo, E.grupos.map(([n], i) => ({ color: COLG[i], texto: n, forma: i === 0 ? 'punto' : 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ninguna palabra viene con su categoría: el mapa sale solo de contar qué palabras aparecen cerca de cuáles (700 frases sintéticas, matriz de co-ocurrencia, PPMI y sus vectores propios). Haga clic en una palabra para ver sus vecinas más cercanas.');
    function dibujar() {
      const { ctx } = lienzo, [a, b] = par.split(',').map(Number);
      lienzo.limpiar();
      const pts = E.palabras.map((w) => [E.vec(w)[a], E.vec(w)[b]]), mx = Math.max(...pts.flat().map(Math.abs)) * 1.15;
      pl = VIZ.plano(lienzo, { xmin: -mx, xmax: mx, ymin: -mx, ymax: mx }, { etiquetaX: `dirección ${a + 1}`, etiquetaY: `dirección ${b + 1}` });
      pl.ejes();
      const vec = E.palabras.filter((w) => w !== sel).map((w) => [w, E.coseno(sel, w)]).sort((x, y) => y[1] - x[1]).slice(0, 3);
      pos = E.palabras.map((w, i) => ({ w, x: pl.sx(pts[i][0]), y: pl.sy(pts[i][1]), g: E.grupo(w) }));
      pos.forEach((p) => { if (p.w === sel) return; if (vec.some(([w]) => w === p.w)) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); const s = pos.find((q) => q.w === sel); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); } });
      pos.forEach((p) => { VIZ.marcador(ctx, p.x, p.y, COLG[p.g], p.w === sel ? 7 : 5, p.g); ctx.fillStyle = p.w === sel ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(11, p.w === sel ? 600 : 400); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(p.w, p.x + 8, p.y); });
      const mismos = vec.filter(([w]) => E.grupo(w) === E.grupo(sel)).length;
      registro.textContent = `Palabras más parecidas a «${sel}» por coseno: ${vec.map(([w, c]) => `${w} (${VIZ.fmt(c, 2)})`).join(', ')}. ${mismos} de 3 son de su misma categoría.`;
      lectura.set([['palabra elegida', sel], ['categoría real', E.grupos[E.grupo(sel)][0]], ['vecinas de la misma categoría', `${mismos} de 3`], ['frases del corpus', String(E.frases.length)], ['palabras distintas', String(E.vocab.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return pos.find((p) => Math.hypot(p.x - x, p.y - y) < 12); };
    lienzo.canvas.addEventListener('click', (ev) => { const p = bajo(ev); if (p) { sel = p.w; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const p = bajo(ev), { x, y } = lienzo.posicion(ev); if (p) tip.mostrar(x, y, `<b>${p.w}</b><br>${E.grupos[p.g][0]}<br>coseno con «${sel}»: ${VIZ.fmt(E.coseno(sel, p.w), 3)}`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: un autocodificador aprende una representación latente de un dato ---------- */

  function montarAuto(cuerpo) {
    let tipo = 'lunas', semilla = 1, red = null, opt = null, pts = [], ep = 0, perd = NaN, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([k]) => ['lunas', 'circulos', 'manchas', 'xor'].includes(k)), valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 8 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'dato original', forma: 'punto' }, { color: C.s2, texto: 'reconstrucción a partir de un solo número z', forma: 'punto' }, { color: C.tinta, texto: 'la curva que genera el decodificador al recorrer z', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una red 2 → 8 → 1 → 8 → 2 intenta devolver cada punto, pero debe pasarlo por un cuello de botella de un solo número z (la representación latente). Lo que aprende es una curva que pasa cerca de los datos: sus coordenadas intrínsecas.');
    const dec = (z) => { const h = red.W[2].map((f, j) => Math.tanh(f[0] * z + red.b[2][j])); return red.W[3].map((f, j) => f.reduce((t, w, i) => t + w * h[i], red.b[3][j])); };
    function iniciar() {
      pts = ML.datos(tipo, 100, 0.2, semilla * 5);
      red = DL.red([2, 8, 1, 8, 2], { act: 'tanh', salida: 'lineal', semilla: semilla * 3 + 1 }); opt = DL.optimizador('adam', { lr: 0.02 }); ep = 0; perd = NaN;
      const r = VIZ.semilla(semilla);
      return (function* () { while (ep < 400) { for (let k = 0; k < 5; k++) { const L = DL.mezclar(pts.map((q) => ({ x: [q.x, q.y], y: [q.x, q.y] })), r); for (let i = 0; i < L.length; i += 20) perd = DL.entrenarPaso(red, L.slice(i, i + 20), opt); ep++; } yield; } })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = ML.plano(lienzo); pl.ejes();
      const zs = Array.from({ length: 61 }, (_, i) => -1 + (2 * i) / 60), curva = zs.map((z) => dec(z));
      ctx.save(); pl.recortar(); VIZ.trazar(ctx, pl, curva, C.tinta, 2.5); ctx.restore();
      let err = 0;
      pts.forEach((q) => { const f = DL.adelante(red, [q.x, q.y]), rec = f.y; err += (rec[0] - q.x) ** 2 + (rec[1] - q.y) ** 2; ctx.strokeStyle = VIZ.alfa(C.apagado, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(q.x), pl.sy(q.y)); ctx.lineTo(pl.sx(rec[0]), pl.sy(rec[1])); ctx.stroke(); });
      pts.forEach((q) => { const rec = DL.adelante(red, [q.x, q.y]).y; VIZ.marcador(ctx, pl.sx(q.x), pl.sy(q.y), C.s1, 3.5); VIZ.marcador(ctx, pl.sx(rec[0]), pl.sy(rec[1]), C.s2, 2.5); });
      registro.textContent = ep ? `Época ${ep}: error de reconstrucción ${VIZ.fmt(err / pts.length, 3)} por punto, usando un solo número z por dato en lugar de dos.` : 'Red sin entrenar: las reconstrucciones se amontonan en un punto.';
      lectura.set([['época', String(ep)], ['error de reconstrucción', VIZ.fmt(err / pts.length, 3)], ['números por dato', '2 → 1 → 2'], ['parámetros', String(DL.nParametros([2, 8, 1, 8, 2]))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const j = pl ? ML.cercano(pl, pts, x, y) : -1;
      if (j < 0) return tip.ocultar();
      const q = pts[j], f = DL.adelante(red, [q.x, q.y]);
      tip.mostrar(x, y, `dato (${VIZ.fmt(q.x, 2)}, ${VIZ.fmt(q.y, 2)})<br>z = <b>${VIZ.fmt(f.a[2][0], 3)}</b><br>reconstrucción (${VIZ.fmt(f.y[0], 2)}, ${VIZ.fmt(f.y[1], 2)})`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('embeddings', {
    intro: String.raw`
      <p>Una red no entiende palabras, solo números. Un <strong>embedding</strong> asigna a cada palabra (o a cada dato) un vector de pocos cientos de números, aprendido de modo que lo parecido quede cerca. Es una <strong>representación latente</strong>: una descripción comprimida donde las direcciones del espacio capturan rasgos del significado.</p>
      <p>La idea que lo hace posible viene de la lingüística: <em>una palabra se conoce por las que la acompañan</em>. Dos palabras que aparecen en contextos parecidos reciben vectores parecidos, sin que nadie les diga qué significan.</p>`,
    visualizaciones: [
      { titulo: 'Un mapa de palabras desde sus contextos', descripcion: 'Mire cómo se agrupan animales, comidas y ciudades solo por sus compañeras de frase. Haga clic en una palabra y compare con sus vecinas.', montar: montarMapa },
      { titulo: 'Un autocodificador comprime un dato', descripcion: 'Entrene una red que pasa cada punto por un solo número y vea la curva que aprende a describir los datos.', montar: montarAuto },
    ],
    teoria: String.raw`
      <h2>De los contextos a los vectores</h2>
      <p>Se cuenta, para cada par de palabras \((i,j)\), cuántas veces aparecen a pocas palabras de distancia: \(N_{ij}\). La <em>información mutua puntual positiva</em> compara eso con lo esperado por azar:</p>
      \[ \operatorname{PPMI}_{ij} = \max\!\Big(0,\ \log\frac{N_{ij}\,N}{N_{i\cdot}\,N_{\cdot j}}\Big). \]
      <p>Los vectores propios dominantes de esa matriz (o una SVD truncada) dan embeddings de dimensión \(d\) pequeña. Word2Vec y GloVe aprenden vectores equivalentes con descenso de gradiente: en esencia factorizan esa misma matriz (Levy y Goldberg, 2014).</p>
      <h2>Qué se mide con ellos</h2>
      \[ \cos(u,v)=\frac{u^\top v}{\lVert u\rVert\,\lVert v\rVert}. \]
      <p>Un coseno cercano a 1 significa contextos parecidos (<a href="tema.html?id=embedding-similarity">Embedding Similarity</a>). En espacios de embeddings entrenados con corpus grandes aparecen además regularidades lineales, como \(\vec{\text{rey}}-\vec{\text{hombre}}+\vec{\text{mujer}}\approx\vec{\text{reina}}\).</p>
      <h2>Embeddings en las redes</h2>
      <ul>
        <li>En un modelo de lenguaje, la primera capa es una tabla de embeddings (\(|V|\times d\)), entrenada junto con el resto de la red.</li>
        <li>Un <em>autocodificador</em> aprende un embedding de cualquier dato obligándolo a pasar por un cuello de botella \(x\to z\to\hat x\), con pérdida \(\lVert x-\hat x\rVert^2\).</li>
        <li>Las <a href="tema.html?id=contrastive-learning">representaciones contrastivas</a> los aprenden acercando pares parecidos y alejando los distintos.</li>
      </ul>
      <div class="recuadro"><p>Los embeddings también heredan los sesgos de los datos de los que salen (por ejemplo, asociaciones de género con profesiones): ver <a href="tema.html?id=algorithmic-fairness">Algorithmic Fairness</a>. Para la página en contexto, véase <a href="tema.html?id=encoder-decoder">Encoder–Decoder</a>.</p></div>`,
  });
})();
