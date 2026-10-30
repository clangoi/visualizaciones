(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: las dos puertas de la GRU ---------- */

  function montarPuertas(cuerpo) {
    let H = 6, L = 8, semilla = 1, red = null, pasos = 0, perdida = NaN, bit = 1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Primer símbolo de la secuencia', opciones: [['1', '+1 (clase 1)'], ['0', '−1 (clase 0)']], valor: '1', alCambiar: (v) => { bit = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pasos de ruido', min: 3, max: 16, valor: L, alCambiar: (v) => { L = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const c = Math.min(24, (w - 130) / (L + 1)); return Math.round(34 + c + 3 * (H * c + 34)); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }, { color: C.tinta, texto: 'puertas z y r: 0 (cerrada) a 1 (abierta)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una GRU de 6 unidades aprende a recordar el primer símbolo. La puerta de actualización z vale cerca de 1 cuando la unidad conserva su estado anterior; la de reinicio r decide cuánto del pasado se usa para calcular el candidato.');
    function iniciar() {
      red = DL.recurrente('gru', H, semilla); const opt = DL.optimizador('adam', { lr: 0.02 }), r = VIZ.semilla(semilla * 5 + 2); pasos = 0; perdida = NaN;
      return (function* () { while (pasos < 300) { for (let k = 0; k < 10; k++) { const R = red.paso(Array.from({ length: 16 }, () => DL.secuenciaMemoria(L, r)), opt, 1); perdida = R.perdida; pasos++; } yield; } })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx, ancho: W } = lienzo, T = L + 1, c = Math.min(24, (W - 130) / T), r = VIZ.semilla(semilla * 9 + 1), ruidoComun = DL.secuenciaMemoria(L, r).x.slice(1);
      const x = [bit ? 1 : -1, ...ruidoComun], f = red.adelante(x);
      lienzo.limpiar(); geo = [];
      const filas = [['puerta de actualización z (1 = conservar)', (e) => e.z, false], ['puerta de reinicio r', (e) => e.r, false], ['estado h', (e) => e.h, true]];
      let y = 8;
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      DL.mapa(ctx, [x], 126, y, T * c, c, { divergente: true, min: -1.5, max: 1.5 }); ctx.fillText('entrada x', 120, y + c / 2); geo.push({ x: 126, y, c, M: [x], nombre: 'entrada x' });
      y += c + 18;
      filas.forEach(([nombre, fn, div]) => {
        const M = Array.from({ length: H }, (_, j) => f.cache.map((e) => fn(e)[j]));
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(nombre, 126, y - 2);
        DL.mapa(ctx, M, 126, y, T * c, H * c, div ? { divergente: true, min: -1, max: 1 } : { min: 0, max: 1 });
        geo.push({ x: 126, y, c, M, nombre });
        y += H * c + 34;
      });
      registro.textContent = pasos ? `Tras ${pasos} pasos (pérdida ${VIZ.fmt(perdida, 3)}): la GRU predice P(+1) = ${VIZ.fmt(f.p, 3)} para esta secuencia.` : 'GRU sin entrenar: z ronda 1/2 en todas partes, así que el estado se renueva a la mitad en cada paso.';
      const zm = f.cache.slice(1).map((e) => e.z.reduce((s, v) => s + v, 0) / H);
      lectura.set([['pasos de entrenamiento', String(pasos)], ['P(primer símbolo = +1)', VIZ.fmt(f.p, 3)], ['z medio durante el ruido', VIZ.fmt(zm.reduce((s, v) => s + v, 0) / zm.length, 3)], ['parámetros', String(red.nParametros)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x < q.x + q.M[0].length * q.c && y >= q.y && y < q.y + q.M.length * q.c);
      if (!g) return tip.ocultar();
      const t = Math.floor((x - g.x) / g.c), j = Math.floor((y - g.y) / g.c);
      tip.mostrar(x, y, `${g.nombre}<br>paso <b>${t}</b>, unidad <b>${j + 1}</b>: <b>${f2(g.M[j][t])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cuántos parámetros cuesta cada celda ---------- */

  const CELDAS = [['RNN simple', 1, C.s2], ['GRU', 3, C.s6], ['LSTM', 4, C.s1]];
  function montarParametros(cuerpo) {
    let d = 64, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño de la entrada d', min: 1, max: 512, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CELDAS.map(([n, , c]) => ({ color: c, texto: n, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Parámetros de una capa recurrente con H unidades: g·H·(H + d + 1), con g = 1 para la RNN simple, 3 para la GRU y 4 para la LSTM. A igual H, la GRU tiene 3/4 de los parámetros de la LSTM.');
    const P = (g, H) => g * H * (H + d + 1);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 8, xmax: 512, ymin: 0, ymax: P(4, 512) * 1.05 }, { etiquetaX: 'unidades ocultas H', etiquetaY: 'parámetros', formatoY: (v) => (v >= 1e6 ? `${VIZ.fmt(v / 1e6, 2)} M` : v >= 1e3 ? `${Math.round(v / 1e3)} k` : String(v)) });
      pl.ejes();
      CELDAS.forEach(([, g, c]) => { VIZ.trazar(ctx, pl, Array.from({ length: 64 }, (_, i) => { const H = 8 + i * 8; return [H, P(g, H)]; }), c, 2.5); if (hover > 0) VIZ.marcador(ctx, pl.sx(hover), pl.sy(P(g, hover)), c, 4); });
      const H = hover > 0 ? hover : 128;
      registro.textContent = `Con H = ${H} y d = ${d}: RNN ${VIZ.entero(P(1, H))}, GRU ${VIZ.entero(P(3, H))}, LSTM ${VIZ.entero(P(4, H))} parámetros.`;
      lectura.set(CELDAS.map(([n, g]) => [`${n} (H = ${H})`, VIZ.entero(P(g, H))]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.max(8, Math.round(pl.ix(x) / 8) * 8); dibujar();
      tip.mostrar(x, y, `H = <b>${hover}</b>` + CELDAS.map(([n, g, c]) => VIZ.filaTooltip(c, n, VIZ.entero(P(g, hover)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('gru-gates', {
    intro: String.raw`
      <p>La <strong>GRU</strong> (<em>Gated Recurrent Unit</em>) logra casi lo mismo que la LSTM con una celda más simple: no tiene una memoria separada, solo el estado \(h_t\), y dos puertas en lugar de tres.</p>
      <p>La <strong>puerta de actualización</strong> \(z_t\) elige, unidad por unidad, cuánto del estado anterior se conserva y cuánto se reemplaza; la <strong>puerta de reinicio</strong> \(r_t\) decide cuánto del pasado se usa al calcular el candidato. Es una interpolación entre «quedarse igual» y «renovarse».</p>`,
    visualizaciones: [
      { titulo: 'Las dos puertas de la GRU', descripcion: 'Entrene la GRU y observe cómo evolucionan z y r durante la secuencia. Compare las secuencias que empiezan con +1 y con −1.', montar: montarPuertas },
      { titulo: 'GRU, LSTM y RNN: costo en parámetros', descripcion: 'Compare el número de parámetros a medida que crece el estado oculto. A igual tamaño, la GRU es un 25 % más pequeña que la LSTM.', montar: montarParametros },
    ],
    teoria: String.raw`
      <h2>Ecuaciones</h2>
      \[ \begin{aligned} z_t &= \sigma(W_z x_t + U_z h_{t-1} + b_z) && \text{actualización} \\ r_t &= \sigma(W_r x_t + U_r h_{t-1} + b_r) && \text{reinicio} \\ n_t &= \tanh\!\big(W_n x_t + r_t\odot(U_n h_{t-1}) + b_n\big) && \text{candidato} \\ h_t &= (1-z_t)\odot n_t + z_t\odot h_{t-1} && \text{nuevo estado} \end{aligned} \]
      <p>(Existen variantes que aplican \(r_t\) antes de \(U_n\); la anterior es la que usan PyTorch y cuDNN.)</p>
      <h2>Lectura</h2>
      <ul>
        <li>Si \(z_t\approx1\): \(h_t\approx h_{t-1}\). El estado pasa intacto, como una puerta de olvido de la LSTM abierta, y el gradiente también.</li>
        <li>Si \(z_t\approx0\): \(h_t\approx n_t\). El estado se reescribe.</li>
        <li>Si \(r_t\approx0\): el candidato ignora el pasado y depende solo de la entrada.</li>
      </ul>
      <h2>GRU frente a LSTM</h2>
      <table>
        <tr><th></th><th>LSTM</th><th>GRU</th></tr>
        <tr><td>Estados</td><td>\(c_t\) y \(h_t\)</td><td>solo \(h_t\)</td></tr>
        <tr><td>Puertas</td><td>3 (entrada, olvido, salida)</td><td>2 (actualización, reinicio)</td></tr>
        <tr><td>Parámetros</td><td>\(4H(H+d+1)\)</td><td>\(3H(H+d+1)\)</td></tr>
        <tr><td>Rendimiento</td><td colspan="2">Muy parecido en la mayoría de las tareas; ninguna gana de forma sistemática</td></tr>
      </table>
      <div class="recuadro"><p>La actualización \(h_t=(1-z_t)n_t+z_t h_{t-1}\) es, igual que en la LSTM, un camino casi aditivo: de ahí viene su capacidad de recordar a largo plazo (<a href="tema.html?id=long-term-dependencies">Long-Term Dependencies</a>). Compare la celda con la de la <a href="tema.html?id=lstm-gates">LSTM</a>.</p></div>`,
  });
})();
