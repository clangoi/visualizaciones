(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const COLG = [C.s1, C.s2, C.s3];
  const METRICAS = [['coseno', 'Coseno'], ['punto', 'Producto punto'], ['euclid', 'Distancia euclidiana (negativa)']];
  const sim = (a, b, m) => { const dot = a.reduce((s, v, i) => s + v * b[i], 0); return m === 'coseno' ? dot / ((Math.hypot(...a) * Math.hypot(...b)) || 1) : m === 'punto' ? dot : -Math.hypot(...a.map((v, i) => v - b[i])); };

  /* ---------- Fig. 1: la matriz de similitudes ---------- */

  function montarMatriz(cuerpo) {
    let metrica = 'coseno', semilla = 1, E = DL.embeddings(1), geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Medida', opciones: METRICAS, valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.boton('Otro corpus', () => { semilla++; E = DL.embeddings(semilla); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(26, (w - 110) / 18) * 18 + 80) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'más parecidas (más oscuro)', forma: 'cuadro' }, ...E.grupos.map(([n], i) => ({ color: COLG[i], texto: n, forma: 'cuadro' }))]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las 18 palabras están ordenadas por categoría: los bloques oscuros de la diagonal muestran que las palabras de una misma categoría son más parecidas entre sí que con las demás. El producto punto, a diferencia del coseno, también depende de la longitud de los vectores.');
    function dibujar() {
      const P = E.palabras.slice().sort((a, b) => E.grupo(a) - E.grupo(b)), n = P.length, { ctx, ancho: W } = lienzo, c = Math.min(26, (W - 110) / n), x0 = 92, y0 = 70;
      lienzo.limpiar();
      const M = P.map((a) => P.map((b) => sim(E.vec(a), E.vec(b), metrica)));
      const v = M.flat(), mn = Math.min(...v), mx = Math.max(...v);
      DL.mapa(ctx, M, x0, y0, n * c, n * c, { min: mn, max: mx });
      ctx.font = VIZ.fuente(9); P.forEach((w, i) => { ctx.fillStyle = COLG[E.grupo(w)]; ctx.fillRect(x0 + i * c, y0 - 8, c, 4); ctx.fillRect(x0 - 8, y0 + i * c, 4, c); ctx.save(); ctx.translate(x0 + (i + 0.5) * c, y0 - 12); ctx.rotate(-Math.PI / 2); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(w, 0, 0); ctx.restore(); ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(w, x0 - 12, y0 + (i + 0.5) * c); });
      geo = { x0, y0, c, P, M };
      const dentro = [], fuera = []; P.forEach((a, i) => P.forEach((b, j) => { if (i < j) (E.grupo(a) === E.grupo(b) ? dentro : fuera).push(M[i][j]); }));
      const media = (a) => a.reduce((s, q) => s + q, 0) / a.length;
      registro.textContent = `Con ${METRICAS.find((m) => m[0] === metrica)[1].toLowerCase()}: promedio ${VIZ.fmt(media(dentro), 3)} entre palabras de la misma categoría frente a ${VIZ.fmt(media(fuera), 3)} entre categorías distintas.`;
      lectura.set([['misma categoría (promedio)', VIZ.fmt(media(dentro), 3)], ['otra categoría (promedio)', VIZ.fmt(media(fuera), 3)], ['rango de valores', `${VIZ.fmt(mn, 3)} a ${VIZ.fmt(mx, 3)}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!geo) return; const j = Math.floor((x - geo.x0) / geo.c), i = Math.floor((y - geo.y0) / geo.c); if (i >= 0 && i < geo.P.length && j >= 0 && j < geo.P.length) tip.mostrar(x, y, `«${geo.P[i]}» y «${geo.P[j]}»<br>${METRICAS.find((m) => m[0] === metrica)[1]}: <b>${VIZ.fmt(geo.M[i][j], 3)}</b>`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: búsqueda semántica ---------- */

  function montarBusqueda(cuerpo) {
    let q = 'perro', metrica = 'coseno', escala = 1, tau = 0.2, E = DL.embeddings(1), geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Palabra de consulta', opciones: E.palabras.map((w) => [w, w]), valor: q, alCambiar: (v) => { q = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Medida', opciones: METRICAS, valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud de la consulta (× su valor)', min: 0.2, max: 4, paso: 0.1, valor: escala, formato: (v) => `× ${VIZ.fmt(v, 2)}`, alCambiar: (v) => { escala = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Temperatura del softmax', min: 0.02, max: 1, paso: 0.02, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, E.grupos.map(([n], i) => ({ color: COLG[i], texto: n, forma: 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se ordenan todas las palabras por su similitud con la consulta; a la derecha, el porcentaje que les asigna un softmax con la temperatura elegida (la forma en que una búsqueda semántica o la atención convierte puntajes en pesos). Estire la consulta: el coseno no cambia; el producto punto y la distancia, sí.');
    function dibujar() {
      const v = E.vec(q).map((x) => x * escala), { ctx, ancho: W } = lienzo;
      const filas = E.palabras.filter((w) => w !== q).map((w) => ({ w, s: sim(v, E.vec(w), metrica) })).sort((a, b) => b.s - a.s);
      const mx = Math.max(...filas.map((f) => f.s)), mn = Math.min(...filas.map((f) => f.s)), esc = metrica === 'coseno' ? 1 : Math.max(Math.abs(mx), Math.abs(mn), 1e-9);
      const e = filas.map((f) => Math.exp((f.s - mx) / (tau * (metrica === 'coseno' ? 1 : esc)))), z = e.reduce((a, b) => a + b, 0);
      lienzo.limpiar(); geo = [];
      const bw = W - 190;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`Palabras más parecidas a «${q}»`, 8, 4); ctx.textAlign = 'right'; ctx.fillText('softmax', W - 8, 4);
      filas.forEach((f, i) => { const y = 24 + i * 22, w = Math.max(2, ((f.s - Math.min(mn, 0)) / ((mx - Math.min(mn, 0)) || 1)) * bw * 0.9), g = E.grupo(f.w); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(f.w, 80, y + 8); ctx.fillStyle = COLG[g]; ctx.beginPath(); ctx.roundRect(86, y, w, 16, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(10); ctx.fillText(VIZ.fmt(f.s, 3), 90 + w, y + 8); ctx.textAlign = 'right'; ctx.font = VIZ.fuente(10, i < 3 ? 600 : 400); ctx.fillText(`${VIZ.fmt(100 * e[i] / z, 3)} %`, W - 8, y + 8); geo.push({ y, f, p: e[i] / z }); });
      const mismos = filas.slice(0, 5).filter((f) => E.grupo(f.w) === E.grupo(q)).length;
      registro.textContent = `Las 5 primeras: ${filas.slice(0, 5).map((f) => f.w).join(', ')} (${mismos} de la misma categoría que «${q}»). El softmax concentra el ${VIZ.fmt(100 * e.slice(0, 5).reduce((s, v2) => s + v2, 0) / z, 3)} % de su masa en esas cinco.`;
      lectura.set([['norma de la consulta', VIZ.fmt(Math.hypot(...v), 3)], ['más parecida', `${filas[0].w} (${VIZ.fmt(filas[0].s, 3)})`], ['menos parecida', `${filas[filas.length - 1].w} (${VIZ.fmt(filas[filas.length - 1].s, 3)})`], ['de la misma categoría en el top 5', `${mismos} de 5`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((r) => y >= r.y && y <= r.y + 16); if (g) tip.mostrar(x, y, `«${g.f.w}» (${E.grupos[E.grupo(g.f.w)][0]})<br>similitud <b>${VIZ.fmt(g.f.s, 3)}</b><br>peso softmax <b>${VIZ.fmt(100 * g.p, 3)} %</b>`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('embedding-similarity', {
    intro: String.raw`
      <p>Una vez que las palabras, frases, imágenes o usuarios están representados como vectores, «¿qué tan parecidos son?» se vuelve una pregunta geométrica. Hay varias maneras de contestarla, y la elección importa: el <strong>coseno</strong> mide el ángulo (la dirección), el <strong>producto punto</strong> mezcla ángulo y longitud, y la <strong>distancia euclidiana</strong> mide qué tan lejos están los extremos.</p>
      <p>Con la medida elegida se pueden buscar los vecinos de una consulta (<em>búsqueda semántica</em>), agrupar, recomendar, o ponderar valores en la atención. Es también la base del <a href="tema.html?id=contrastive-learning">aprendizaje contrastivo</a>, donde la red aprende los vectores para que esa similitud signifique algo.</p>`,
    visualizaciones: [
      { titulo: 'Matriz de similitudes', descripcion: 'Compare las tres medidas sobre las 18 palabras. Busque los bloques de cada categoría y compare cómo cambia la escala de colores.', montar: montarMatriz },
      { titulo: 'Búsqueda semántica', descripcion: 'Elija una consulta y mire sus vecinas más cercanas. Alargue la consulta y vea qué medidas cambian y cuáles no.', montar: montarBusqueda },
    ],
    teoria: String.raw`
      <h2>Las tres medidas</h2>
      <table>
        <tr><th>Medida</th><th>Fórmula</th><th>Rango</th><th>Depende de la longitud</th></tr>
        <tr><td>Coseno</td><td>\(\dfrac{u^\top v}{\lVert u\rVert\,\lVert v\rVert}\)</td><td>\([-1,1]\)</td><td>no</td></tr>
        <tr><td>Producto punto</td><td>\(u^\top v\)</td><td>\(\mathbb{R}\)</td><td>sí</td></tr>
        <tr><td>Distancia euclidiana</td><td>\(\lVert u-v\rVert\)</td><td>\([0,\infty)\)</td><td>sí</td></tr>
      </table>
      <p>Están conectadas: \(\lVert u-v\rVert^2=\lVert u\rVert^2+\lVert v\rVert^2-2\,u^\top v\). Si los vectores están normalizados (\(\lVert u\rVert=\lVert v\rVert=1\)), el coseno, el producto punto y la distancia ordenan los vecinos igual.</p>
      <h2>Del puntaje al peso</h2>
      <p>Para convertir una lista de similitudes \(s_1,\dots,s_n\) en pesos se usa el softmax con temperatura:</p>
      \[ w_i=\frac{e^{s_i/\tau}}{\sum_j e^{s_j/\tau}}. \]
      <p>Con \(\tau\) pequeña, casi todo el peso va al más parecido; con \(\tau\) grande, se reparte. Es la misma fórmula de la <a href="tema.html?id=self-attention-qkv">atención</a> y de la pérdida <a href="tema.html?id=contrastive-learning">InfoNCE</a>.</p>
      <h2>Búsqueda a gran escala</h2>
      <p>Con millones de vectores, comparar con todos cuesta \(O(nd)\) por consulta (<a href="tema.html?id=instance-based-learning">costo de las instancias</a>); se usan índices aproximados de vecinos (HNSW, cuantización de producto) que sacrifican una pequeña fracción de exactitud por velocidad.</p>
      <div class="recuadro"><p>Los embeddings capturan lo que hay en los datos de entrenamiento, incluidos sus sesgos: palabras de profesiones pueden quedar más cerca de un género que de otro. Medir esa asociación con similitudes es una forma de auditar un modelo (<a href="tema.html?id=algorithmic-fairness">Algorithmic Fairness</a>).</p></div>`,
  });
})();
