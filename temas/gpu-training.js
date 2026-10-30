(function () {
  'use strict';
  const { color: C } = VIZ;

  // Modelo ilustrativo (no una medición): cada dispositivo tiene un cómputo máximo efectivo, un tamaño de lote al que alcanza la mitad
  // de su ocupación y una sobrecarga fija por paso.
  const DISP = [
    { n: 'CPU (8 núcleos)', c: C.s2, tflops: 0.3, mitad: 3, over: 0.0008, vram: 64, bytes: 4 },
    { n: 'GPU, float32', c: C.s1, tflops: 20, mitad: 96, over: 0.004, vram: 16, bytes: 4 },
    { n: 'GPU, precisión mixta (float16)', c: C.s6, tflops: 70, mitad: 160, over: 0.004, vram: 16, bytes: 2 },
  ];
  const GB = 1e9;

  /* ---------- Fig. 1: lote, ocupación y memoria ---------- */

  function montarLote(cuerpo) {
    let gf = 8, params = 25, actMB = 40, lote = 64, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Cómputo por ejemplo (GFLOP, adelante + atrás)', min: -1, max: 2, paso: 0.1, valor: Math.log10(gf), formato: (v) => VIZ.fmt(10 ** v, 3), alCambiar: (v) => { gf = 10 ** v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parámetros (millones)', min: 1, max: 500, valor: params, alCambiar: (v) => { params = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Activaciones por ejemplo (MB)', min: 5, max: 400, valor: actMB, alCambiar: (v) => { actMB = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño del lote (marcador)', min: 0, max: 12, paso: 0.25, valor: Math.log2(lote), formato: (v) => VIZ.entero(2 ** v), alCambiar: (v) => { lote = 2 ** v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...DISP.map((d) => ({ color: d.c, texto: d.n, forma: 'linea' })), { color: C.s8, texto: 'sin memoria suficiente (el lote no cabe)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Modelo simplificado con cifras ilustrativas, no mediciones. Con lotes chicos la GPU está subocupada y domina la sobrecarga; al crecer el lote el rendimiento se acerca al máximo del dispositivo, hasta que la memoria se agota. Los pesos, sus gradientes y el estado de Adam ocupan 16 bytes por parámetro (float32).');
    const mem = (d, B) => (params * 1e6 * (d.bytes === 2 ? 14 : 16) + actMB * 1e6 * (d.bytes === 2 ? 0.5 : 1) * B) / GB;
    const paso = (d, B) => d.over + (B * gf * 1e9) / (d.tflops * 1e12 * (B / (B + d.mitad)));
    const tput = (d, B) => B / paso(d, B);
    const maxB = (d) => Math.max(0, Math.floor(((d.vram * GB - params * 1e6 * (d.bytes === 2 ? 14 : 16)) / (actMB * 1e6 * (d.bytes === 2 ? 0.5 : 1)))));
    const BS = Array.from({ length: 49 }, (_, i) => 2 ** (i / 4));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 12, ymin: 1, ymax: 1e5 }, { logY: true, etiquetaX: 'tamaño del lote', etiquetaY: 'ejemplos por segundo (log)', ticksX: [0, 2, 4, 6, 8, 10, 12], formatoX: (v) => VIZ.entero(2 ** v), formatoY: (v) => (v >= 1000 ? `${VIZ.fmt(v / 1000, 2)} k` : String(v)) });
      pl.ejes();
      ctx.save(); pl.recortar();
      DISP.forEach((d) => {
        const m = maxB(d), ok = BS.filter((b) => b <= m), mal = BS.filter((b) => b > m);
        VIZ.trazar(ctx, pl, ok.map((b) => [Math.log2(b), tput(d, b)]), d.c, 2.5);
        if (mal.length) VIZ.trazar(ctx, pl, [...(ok.length ? [ok[ok.length - 1]] : []), ...mal].map((b) => [Math.log2(b), tput(d, b)]), C.s8, 1.5, [4, 4]);
      });
      ctx.restore();
      const lg = Math.log2(lote);
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(lg), pl.y0); ctx.lineTo(pl.sx(lg), pl.y1); ctx.stroke(); ctx.setLineDash([]);
      DISP.forEach((d) => { if (lote <= maxB(d)) VIZ.marcador(ctx, pl.sx(lg), pl.sy(tput(d, lote)), d.c, 5); });
      if (hover != null) DISP.forEach((d) => { if (2 ** hover <= maxB(d)) VIZ.marcador(ctx, pl.sx(hover), pl.sy(tput(d, 2 ** hover)), d.c, 3.5); });
      const g = DISP[1];
      registro.textContent = `Con lote ${VIZ.entero(lote)}: ${DISP.map((d) => (lote <= maxB(d) ? `${d.n.split(',')[0]} ${VIZ.entero(tput(d, lote))} ej/s` : `${d.n.split(',')[0]} sin memoria`)).join('; ')}.`;
      lectura.set([['lote máximo en GPU float32', VIZ.entero(maxB(g))], ['memoria con el lote elegido (GPU f32)', `${VIZ.fmt(mem(g, lote), 3)} GB de ${g.vram}`], ['tiempo de un paso (GPU f32)', `${VIZ.fmt(paso(g, lote) * 1000, 3)} ms`], ['aceleración de la GPU sobre la CPU', lote <= maxB(g) ? `${VIZ.fmt(tput(g, lote) / tput(DISP[0], lote), 3)}×` : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.round(pl.ix(x) * 4) / 4; dibujar();
      const B = 2 ** hover;
      tip.mostrar(x, y, `lote <b>${VIZ.entero(B)}</b>` + DISP.map((d) => VIZ.filaTooltip(d.c, d.n.split(',')[0] + (d.bytes === 2 ? ' mixta' : ''), B <= maxB(d) ? `${VIZ.entero(tput(d, B))} ej/s` : 'sin memoria')).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: entrenar con varias GPU ---------- */

  function montarEscalado(cuerpo) {
    let bw = 25, gf = 8, params = 100, B = 128, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ancho de banda entre GPU (GB/s)', min: 4, max: 400, valor: bw, alCambiar: (v) => { bw = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Parámetros (millones)', min: 5, max: 1000, valor: params, alCambiar: (v) => { params = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Lote por GPU', min: 16, max: 512, paso: 16, valor: B, alCambiar: (v) => { B = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'escalado ideal', forma: 'linea' }, { color: C.s1, texto: 'con la comunicación del gradiente', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Paralelismo de datos: cada GPU procesa su propio lote y, antes de actualizar, todas promedian los gradientes (all-reduce). Ese intercambio cuesta ~ 2·(N−1)/N · tamaño del modelo / ancho de banda, y no disminuye al agregar GPU. Modelo ilustrativo.');
    const tCalc = () => 0.004 + (B * gf * 1e9) / (20e12 * (B / (B + 96)));
    const tCom = (N) => (N === 1 ? 0 : (2 * (N - 1)) / N * (params * 1e6 * 4) / (bw * GB) + 0.0005 * Math.log2(N));
    const speed = (N) => (N * tCalc()) / (tCalc() + tCom(N));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 16, ymin: 0, ymax: 16.5 }, { etiquetaX: 'número de GPU', etiquetaY: 'aceleración', ticksX: [1, 2, 4, 8, 12, 16] });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[1, 1], [16, 16]], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, pl, Array.from({ length: 16 }, (_, i) => [i + 1, speed(i + 1)]), C.s1, 2.5);
      if (hover) VIZ.marcador(ctx, pl.sx(hover), pl.sy(speed(hover)), C.s1, 5);
      const N = hover || 8;
      registro.textContent = `Con ${N} GPU: cómputo ${VIZ.fmt(tCalc() * 1000, 3)} ms + comunicación ${VIZ.fmt(tCom(N) * 1000, 3)} ms por paso; aceleración ${VIZ.fmt(speed(N), 3)}× de ${N}× ideal (eficiencia ${VIZ.fmt(100 * speed(N) / N, 3)} %).`;
      lectura.set([['cómputo por paso', `${VIZ.fmt(tCalc() * 1000, 3)} ms`], [`comunicación con ${N} GPU`, `${VIZ.fmt(tCom(N) * 1000, 3)} ms`], ['aceleración', `${VIZ.fmt(speed(N), 3)}×`], ['eficiencia', `${VIZ.fmt(100 * speed(N) / N, 3)} %`], ['lote global', VIZ.entero(B * N)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(16, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `<b>${hover}</b> GPU<br>aceleración ${VIZ.fmt(speed(hover), 3)}×<br>eficiencia ${VIZ.fmt(100 * speed(hover) / hover, 3)} %`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('gpu-training', {
    intro: String.raw`
      <p>Entrenar una red es, casi por completo, multiplicar matrices enormes. Las <strong>GPU</strong> tienen miles de núcleos pequeños que hacen esas multiplicaciones en paralelo; por eso un entrenamiento que tardaría semanas en una CPU toma horas. Las <strong>TPU</strong> son aceleradores diseñados específicamente para ese cálculo.</p>
      <p>Pero usarlas bien exige tres cosas: lotes suficientemente grandes para mantenerlas ocupadas, memoria para pesos, gradientes y activaciones, y, si hay varias, un buen reparto del trabajo para que la comunicación no se coma la ganancia.</p>`,
    visualizaciones: [
      { titulo: 'Tamaño del lote, ocupación y memoria', descripcion: 'Suba el lote y mire cómo el rendimiento de la GPU se acerca a su máximo, y cuándo la memoria se agota. Compare precisión mixta y float32.', montar: montarLote },
      { titulo: 'Entrenar con varias GPU', descripcion: 'Aumente el número de GPU con un ancho de banda bajo y con uno alto, y compruebe que la aceleración se aleja del ideal.', montar: montarEscalado },
    ],
    teoria: String.raw`
      <h2>Por qué la GPU gana</h2>
      <p>Una capa densa o convolucional para un lote de \(B\) ejemplos es una multiplicación de matrices con \(\approx 2BP\) operaciones para \(P\) parámetros. Esa operación tiene mucho paralelismo y alta <em>intensidad aritmética</em> (muchas operaciones por byte leído), justo lo que una GPU hace bien.</p>
      <h2>Memoria durante el entrenamiento</h2>
      <p>Con Adam y float32, cada parámetro requiere \(4+4+8=16\) bytes (peso, gradiente y dos momentos), además de las activaciones, que crecen con el lote:</p>
      \[ \text{memoria} \approx 16\,P + B\cdot a, \]
      <p>con \(a\) la memoria de activaciones por ejemplo. Si no cabe, se reduce \(B\), se usa <em>precisión mixta</em> (float16/bfloat16, que casi duplica velocidad y reduce memoria), <em>acumulación de gradientes</em> (varios micro-lotes antes de actualizar) o <em>checkpointing</em> de activaciones (recomputarlas en vez de guardarlas).</p>
      <h2>Paralelismo</h2>
      <ul>
        <li><strong>De datos:</strong> cada GPU tiene una copia del modelo y procesa un lote distinto; se promedian los gradientes con <em>all-reduce</em>. Es lo más simple y común.</li>
        <li><strong>De modelo / de tubería:</strong> cuando el modelo no cabe en una GPU, se reparten sus capas o sus tensores.</li>
      </ul>
      <p>Con \(N\) GPU, el tiempo por paso es \(t_{\text{cálculo}} + t_{\text{comunicación}}\), donde un all-reduce en anillo mueve \(2\frac{N-1}{N}\cdot 4P\) bytes por GPU. La aceleración es</p>
      \[ S(N) = \frac{N\,t_{\text{cálculo}}}{t_{\text{cálculo}} + t_{\text{com}}(N)} \;<\; N. \]
      <div class="recuadro"><p>Costo y energía crecen con el número de GPU-horas: ver <a href="tema.html?id=training-cost">Training Cost &amp; Compute</a>. En Keras, la distribución se activa con <code>tf.distribute.MirroredStrategy()</code> (<a href="tema.html?id=keras-models">Keras Models</a>). Un lote global muy grande exige además subir la tasa de aprendizaje y usar calentamiento (<a href="tema.html?id=learning-rate-momentum">Learning Rate</a>).</p></div>`,
  });
})();
