(function () {
  'use strict';
  const { color: C } = VIZ;

  const fmtN = (v) => (v >= 1e12 ? `${VIZ.fmt(v / 1e12, 3)} billones` : v >= 1e9 ? `${VIZ.fmt(v / 1e9, 3)} mil millones` : v >= 1e6 ? `${VIZ.fmt(v / 1e6, 3)} millones` : VIZ.entero(v));
  const fmtT = (s) => (s < 120 ? `${VIZ.fmt(s, 3)} s` : s < 7200 ? `${VIZ.fmt(s / 60, 3)} min` : s < 172800 ? `${VIZ.fmt(s / 3600, 3)} h` : s < 86400 * 400 ? `${VIZ.fmt(s / 86400, 3)} días` : `${VIZ.fmt(s / 86400 / 365, 3)} años`);

  /* ---------- Fig. 1: cuánto cuesta entrenar ---------- */

  const REF = [['ResNet-50 en ImageNet', 25.6e6, 1.2e6 * 90], ['BERT-base', 110e6, 3.3e9], ['GPT-2 (1.5 B)', 1.5e9, 40e9], ['GPT-3 (175 B)', 175e9, 300e9]];
  function montarCalculadora(cuerpo) {
    let lp = 9, ld = 11, gpus = 64, util = 0.4, precio = 2, hover = -1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Parámetros N (10^x)', min: 6, max: 12, paso: 0.1, valor: lp, formato: (v) => fmtN(10 ** v), alCambiar: (v) => { lp = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Datos de entrenamiento D, en tokens o ejemplos (10^x)', min: 6, max: 13, paso: 0.1, valor: ld, formato: (v) => fmtN(10 ** v), alCambiar: (v) => { ld = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Número de GPU', min: 1, max: 4096, valor: gpus, formato: VIZ.entero, alCambiar: (v) => { gpus = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Utilización del cómputo máximo', min: 0.1, max: 0.7, paso: 0.05, valor: util, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { util = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Precio por GPU-hora (USD)', min: 0.5, max: 8, paso: 0.5, valor: precio, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { precio = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'su configuración', forma: 'cuadro' }, { color: C.apagado, texto: 'modelos de referencia (cifras publicadas, aproximadas)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Regla práctica: entrenar un modelo Transformer cuesta ≈ 6·N·D operaciones de punto flotante (2 en el paso hacia adelante y 4 en el hacia atrás, por parámetro y por dato). La GPU de ejemplo rinde 150 TFLOP/s en el mejor caso (precisión mixta); la utilización real suele ser de 30–50 %. Cifras de orden de magnitud, no presupuestos.');
    function dibujar() {
      const N = 10 ** lp, D = 10 ** ld, flop = 6 * N * D, pico = 150e12, seg = flop / (gpus * pico * util), horasGPU = (seg / 3600) * gpus, usd = horasGPU * precio, kwh = (horasGPU * 0.7) * 1.2, co2 = kwh * 0.4;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar(); geo = [];
      const filas = [['su configuración', flop, C.s1], ...REF.map(([n, np, nd]) => [n, 6 * np * nd, C.apagado])], mx = Math.log10(Math.max(...filas.map((f) => f[1])) * 3), mn = 17, bw = W - 220;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Operaciones de entrenamiento (escala log)', 8, 6);
      filas.forEach(([n, v, col], i) => { const y = 30 + i * 36, w = Math.max(3, ((Math.log10(v) - mn) / (mx - mn)) * bw); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, i === 0 ? 600 : 400); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(n, 160, y + 11); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(168, y, w, 22, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(11); ctx.fillText(`${VIZ.fmt(v / 1e18, 3)} ExaFLOP`, 174 + w, y + 11); geo.push({ y, h: 22, t: `${n}: ${VIZ.fmt(v, 3)} FLOP` }); });
      registro.textContent = `${fmtN(N)} parámetros × ${fmtN(D)} datos ≈ ${VIZ.fmt(flop, 3)} FLOP: con ${VIZ.entero(gpus)} GPU tardaría ${fmtT(seg)} y costaría ≈ ${VIZ.entero(usd)} USD.`;
      lectura.set([['operaciones totales', `${VIZ.fmt(flop, 3)} FLOP`], ['tiempo con las GPU elegidas', fmtT(seg)], ['GPU-horas', VIZ.entero(horasGPU)], ['costo de cómputo', `${VIZ.entero(usd)} USD`], ['energía (con 1,2 de PUE)', `${VIZ.entero(kwh)} kWh`], ['CO₂ (0,4 kg/kWh)', `${VIZ.entero(co2)} kg`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((r) => y >= r.y && y <= r.y + r.h); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: dados un presupuesto de cómputo, ¿modelo grande o más datos? ---------- */

  // Ajuste de Hoffmann et al. (2022): L(N, D) = E + A / N^α + B / D^β.
  const E0 = 1.69, A0 = 406.4, B0 = 410.7, AL = 0.34, BE = 0.28;
  const perdida = (N, D) => E0 + A0 / N ** AL + B0 / D ** BE;
  function montarEscala(cuerpo) {
    let lc = 22, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto de cómputo C (10^x FLOP)', min: 18, max: 25, paso: 0.1, valor: lc, formato: (v) => `10^${VIZ.fmt(v, 3)}`, alCambiar: (v) => { lc = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'pérdida estimada L(N, D) con C = 6·N·D fijo', forma: 'linea' }, { color: C.s6, texto: 'reparto que minimiza la pérdida', forma: 'punto' }, { color: C.apagado, texto: 'pérdida irreducible E', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con el cómputo fijo, un modelo más grande ve menos datos (D = C / 6N). Si el modelo es chico, falta capacidad; si es enorme, falta entrenamiento. Se usa la forma funcional y las constantes ajustadas por Hoffmann et al. (2022) como ilustración del orden de magnitud: no son una medición de su modelo.');
    const Ns = Array.from({ length: 80 }, (_, i) => 10 ** (6 + (i * 7) / 79));
    function dibujar() {
      const C0 = 10 ** lc, { ctx } = lienzo, L = (N) => perdida(N, C0 / (6 * N)), mejor = Ns.reduce((a, b) => (L(b) < L(a) ? b : a));
      lienzo.limpiar();
      const lo = Math.min(...Ns.map(L)), hi = Math.min(Math.max(...Ns.map(L)), lo + 3);
      pl = VIZ.plano(lienzo, { xmin: 6, xmax: 13, ymin: Math.min(E0, lo) - 0.05, ymax: hi }, { etiquetaX: 'parámetros N (10^x)', etiquetaY: 'pérdida estimada', formatoX: (v) => `10^${VIZ.fmt(v, 2)}` });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[6, E0], [13, E0]], C.apagado, 1.4, [4, 4]);
      ctx.save(); pl.recortar(); VIZ.trazar(ctx, pl, Ns.map((N) => [Math.log10(N), L(N)]), C.s1, 2.5); ctx.restore();
      VIZ.marcador(ctx, pl.sx(Math.log10(mejor)), pl.sy(L(mejor)), C.s6, 7);
      if (hover >= 0) VIZ.marcador(ctx, pl.sx(hover), pl.sy(L(10 ** hover)), C.s1, 5);
      const Dm = C0 / (6 * mejor);
      registro.textContent = `Con 10^${VIZ.fmt(lc, 3)} FLOP, conviene un modelo de ≈ ${fmtN(mejor)} parámetros entrenado con ≈ ${fmtN(Dm)} datos (${VIZ.fmt(Dm / mejor, 3)} datos por parámetro); pérdida estimada ${VIZ.fmt(L(mejor), 3)}.`;
      lectura.set([['N óptimo', fmtN(mejor)], ['D óptimo', fmtN(Dm)], ['datos por parámetro', VIZ.fmt(Dm / mejor, 3)], ['pérdida mínima estimada', VIZ.fmt(L(mejor), 3)], ['pérdida irreducible E', VIZ.fmt(E0, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); } hover = pl.ix(x); dibujar(); const N = 10 ** hover, D = 10 ** lc / (6 * N); tip.mostrar(x, y, `N = <b>${fmtN(N)}</b><br>D = ${fmtN(D)}<br>pérdida <b>${VIZ.fmt(perdida(N, D), 3)}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('training-cost', {
    intro: String.raw`
      <p>Entrenar un modelo grande no es solo un problema de algoritmos: es de <strong>presupuesto</strong>. El cómputo necesario crece con el tamaño del modelo y con la cantidad de datos, y se paga en GPU-horas, en dinero, en electricidad y en emisiones. Hoy, entrenar un modelo de lenguaje de frontera cuesta de millones a cientos de millones de dólares; entrenar uno pequeño en una GPU de escritorio cuesta unos pocos dólares.</p>
      <p>Una pregunta práctica es cómo repartir un presupuesto fijo entre <em>un modelo más grande</em> y <em>más datos</em>. Las leyes de escalamiento empíricas muestran que ambos deben crecer juntos.</p>`,
    visualizaciones: [
      { titulo: 'Calculadora de costo de entrenamiento', descripcion: 'Elija parámetros, datos y GPU y lea tiempo, dinero y energía. Compare con modelos conocidos.', montar: montarCalculadora },
      { titulo: 'Modelo grande o más datos', descripcion: 'Con el cómputo fijo, recorra el tamaño del modelo y encuentre el reparto que minimiza la pérdida estimada.', montar: montarEscala },
    ],
    teoria: String.raw`
      <h2>Cuántas operaciones</h2>
      <p>Una pasada hacia adelante de un Transformer con \(N\) parámetros cuesta \(\approx 2N\) operaciones por token y la retropropagación, \(\approx 4N\). Para \(D\) tokens:</p>
      \[ C\approx 6\,N\,D\ \text{FLOP}. \]
      <p>GPT-3 (\(N=175\times10^9\), \(D=300\times10^9\)) da \(\approx3{,}2\times10^{23}\) FLOP, consistente con lo publicado. El tiempo es \(C/(\text{GPU}\times\text{pico}\times\text{utilización})\); el costo, las GPU-horas por el precio; la energía, las GPU-horas por la potencia (≈ 0,7 kW por GPU con su servidor) por el PUE del centro de datos.</p>
      <h2>Leyes de escalamiento</h2>
      <p>Kaplan et al. (2020) y Hoffmann et al. (2022, «Chinchilla») ajustan la pérdida de modelos de lenguaje con</p>
      \[ L(N,D)=E+\frac{A}{N^{\alpha}}+\frac{B}{D^{\beta}}, \]
      <p>donde \(E\) es la pérdida irreducible (la entropía del texto), y los otros dos términos son el error por tener un modelo finito y por tener datos finitos. Con \(C=6ND\) fijo, el mínimo se alcanza con \(N\) y \(D\) proporcionales a \(C^{0{,}5}\): del orden de 20 tokens por parámetro. Muchos modelos anteriores estaban «subentrenados» (demasiado grandes para sus datos).</p>
      <h2>Otros costos</h2>
      <ul>
        <li><strong>Datos:</strong> obtenerlos, limpiarlos y etiquetarlos suele costar más que el cómputo; en lenguaje, quedan pocos textos nuevos de calidad.</li>
        <li><strong>Inferencia:</strong> si el modelo se usa mucho, su costo acumulado supera al del entrenamiento: motivo para entrenar modelos más pequeños durante más tiempo.</li>
        <li><strong>Huella ambiental:</strong> depende de la energía y de cuán limpia sea la red eléctrica donde corre.</li>
      </ul>
      <div class="recuadro"><p>Más cómputo no es la única vía: <a href="tema.html?id=transfer-learning">transferir</a> un modelo ya entrenado, usar precisión mixta o <a href="tema.html?id=gpu-training">varias GPU</a> bien aprovechadas reducen mucho el costo. Y medir antes de entrenar: <a href="tema.html?id=learning-curves">curvas de aprendizaje</a> en versiones pequeñas.</p></div>`,
  });
})();
