(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: las puertas a lo largo de una secuencia ---------- */

  function montarPuertas(cuerpo) {
    let H = 6, L = 8, semilla = 1, red = null, pasos = 0, perdida = NaN, bit = 1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Primer símbolo de la secuencia', opciones: [['1', '+1 (clase 1)'], ['0', '−1 (clase 0)']], valor: '1', alCambiar: (v) => { bit = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pasos de ruido', min: 3, max: 16, valor: L, alCambiar: (v) => { L = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const c = Math.min(24, (w - 130) / (L + 1)); return Math.round(34 + c + 4 * (H * c + 34)); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }, { color: C.tinta, texto: 'puertas: 0 (cerrada) a 1 (abierta), oscuro = abierta', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una LSTM de 6 celdas aprende a recordar el primer símbolo. Mire cuando se abre la puerta de entrada (al ver la señal), cuánto se mantiene abierta la de olvido (conservar la memoria) y cómo evoluciona la celda de memoria c.');
    function iniciar() {
      red = DL.recurrente('lstm', H, semilla); const opt = DL.optimizador('adam', { lr: 0.02 }), r = VIZ.semilla(semilla * 5 + 2); pasos = 0; perdida = NaN;
      return (function* () { while (pasos < 300) { for (let k = 0; k < 10; k++) { const R = red.paso(Array.from({ length: 16 }, () => DL.secuenciaMemoria(L, r)), opt, 1); perdida = R.perdida; pasos++; } yield; } })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx, ancho: W } = lienzo, T = L + 1, c = Math.min(24, (W - 130) / T), r = VIZ.semilla(semilla * 9 + 1), ruidoComun = DL.secuenciaMemoria(L, r).x.slice(1);
      const x = [bit ? 1 : -1, ...ruidoComun], f = red.adelante(x);
      lienzo.limpiar(); geo = [];
      const filas = [['puerta de entrada i', (e) => e.i, false], ['puerta de olvido f', (e) => e.f, false], ['puerta de salida o', (e) => e.o, false], ['celda de memoria c', (e) => e.c, true]];
      let y = 8;
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      DL.mapa(ctx, [x], 126, y, T * c, c, { divergente: true, min: -1.5, max: 1.5 }); ctx.fillText('entrada x', 120, y + c / 2); geo.push({ x: 126, y, c, M: [x], nombre: 'entrada x' });
      y += c + 18;
      filas.forEach(([nombre, fn, div]) => {
        const M = Array.from({ length: H }, (_, j) => f.cache.map((e) => fn(e)[j]));
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(nombre, 126, y - 2);
        DL.mapa(ctx, M, 126, y, T * c, H * c, div ? { divergente: true, min: -2, max: 2 } : { min: 0, max: 1, gris: false });
        geo.push({ x: 126, y, c, M, nombre });
        y += H * c + 34;
      });
      registro.textContent = pasos ? `Tras ${pasos} pasos de entrenamiento (pérdida ${VIZ.fmt(perdida, 3)}): la LSTM predice P(+1) = ${VIZ.fmt(f.p, 3)} para esta secuencia.` : 'LSTM sin entrenar: sus puertas se parecen entre sí y casi no distinguen la señal del ruido.';
      const fm = f.cache.map((e) => e.f.reduce((s, v) => s + v, 0) / H);
      lectura.set([['pasos de entrenamiento', String(pasos)], ['P(primer símbolo = +1)', VIZ.fmt(f.p, 3)], ['apertura media de la puerta de olvido', `${VIZ.fmt(fm.reduce((s, v) => s + v, 0) / fm.length, 3)}`], ['parámetros', String(red.nParametros)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x < q.x + q.M[0].length * q.c && y >= q.y && y < q.y + q.M.length * q.c);
      if (!g) return tip.ocultar();
      const t = Math.floor((x - g.x) / g.c), j = Math.floor((y - g.y) / g.c);
      tip.mostrar(x, y, `${g.nombre}<br>paso <b>${t}</b>, celda <b>${j + 1}</b>: <b>${f2(g.M[j][t])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: por dentro de una celda LSTM en un paso ---------- */

  function montarCelda(cuerpo) {
    let xv = 0.8, hp = 0.5, cp = 1, f = 0.9, i = 0.2, g = 0.6, o = 0.8;
    const ctl = VIZ.controles(cuerpo);
    const sl = (et, k, mn, mx, v) => ctl.rango({ etiqueta: et, min: mn, max: mx, paso: 0.05, valor: v, formato: (q) => VIZ.fmt(q, 2), alCambiar: (q) => { ({ f: () => { f = q; }, i: () => { i = q; }, g: () => { g = q; }, o: () => { o = q; }, c: () => { cp = q; } })[k](); dibujar(); } });
    sl('Memoria anterior c(t−1)', 'c', -2, 2, cp); sl('Puerta de olvido f', 'f', 0, 1, f); sl('Puerta de entrada i', 'i', 0, 1, i); sl('Candidato g', 'g', -1, 1, g); sl('Puerta de salida o', 'o', 0, 1, o);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las puertas son números entre 0 y 1 que multiplican. Con f = 1 e i = 0 la memoria pasa intacta; con f = 0 se borra; con i grande se escribe el candidato g. La salida visible h es la memoria comprimida por tanh y filtrada por la puerta de salida.');
    let items = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const c = f * cp + i * g, tc = Math.tanh(c), h = o * tc;
      const barras = [['c(t−1)', cp, 2], ['× f', f, 1], ['i × g', i * g, 1], ['c(t)', c, 2.5], ['tanh c(t)', tc, 1], ['× o', o, 1], ['h(t)', h, 1]];
      const bw = (W - 40) / barras.length, base = H / 2 + 10, esc = (H / 2 - 36) / 2.5;
      items = [];
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(14, base); ctx.lineTo(W - 14, base); ctx.stroke();
      barras.forEach(([n, v], k) => {
        const x = 20 + k * bw, hh = v * esc, esOp = n.startsWith('×') || n.startsWith('i ×');
        ctx.fillStyle = v >= 0 ? C.s1 : C.s2; ctx.globalAlpha = esOp ? 0.55 : 1;
        ctx.beginPath(); ctx.roundRect(x + bw * 0.15, v >= 0 ? base - hh : base, bw * 0.7, Math.max(2, Math.abs(hh)), 4); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = v >= 0 ? 'bottom' : 'top'; ctx.fillText(f2(v), x + bw / 2, v >= 0 ? base - hh - 3 : base - hh + 3);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'top'; ctx.fillText(n, x + bw / 2, H - 22);
        items.push({ x: x + bw * 0.15, w: bw * 0.7, n, v });
      });
      registro.textContent = `c(t) = ${f2(f)}·${f2(cp)} + ${f2(i)}·${f2(g)} = ${f2(c)};  h(t) = ${f2(o)}·tanh(${f2(c)}) = ${f2(h)}.  ${f > 0.9 && i < 0.1 ? 'La memoria casi no cambia.' : f < 0.1 && i < 0.1 ? 'La memoria casi se borra.' : i > 0.8 && f < 0.3 ? 'La memoria se sobrescribe con el candidato.' : ''}`;
      lectura.set([['c(t−1)', f2(cp)], ['aporte del pasado f·c(t−1)', f2(f * cp)], ['aporte nuevo i·g', f2(i * g)], ['c(t)', f2(c)], ['h(t)', f2(h)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = items.find((s) => x >= s.x && x <= s.x + s.w);
      if (q) tip.mostrar(x, y, `${q.n} = <b>${f2(q.v)}</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('lstm-gates', {
    intro: String.raw`
      <p>La <strong>LSTM</strong> (<em>Long Short-Term Memory</em>) separa dos cosas que la RNN simple mezcla en un solo vector: lo que <em>recuerda</em> (la <strong>celda de memoria</strong> \(c_t\)) y lo que <em>muestra</em> (el estado \(h_t\)). Tres <strong>puertas</strong>, números entre 0 y 1 que se calculan a partir de la entrada y del estado anterior, controlan qué se olvida, qué se escribe y qué se muestra.</p>
      <p>Lo importante es que la memoria se actualiza <em>sumando</em>, no multiplicando por una matriz: así el gradiente puede atravesar muchos pasos sin desvanecerse.</p>`,
    visualizaciones: [
      { titulo: 'Las puertas a lo largo de una secuencia', descripcion: 'Entrene la LSTM y compare las puertas con el primer símbolo +1 y −1. Observe cuándo se abre la de entrada y cómo se mantiene la memoria durante el ruido.', montar: montarPuertas },
      { titulo: 'Por dentro de una celda', descripcion: 'Mueva las puertas y vea cómo se combinan la memoria anterior y el candidato nuevo para dar la memoria actual y la salida.', montar: montarCelda },
    ],
    teoria: String.raw`
      <h2>Ecuaciones</h2>
      <p>Con \([h_{t-1},x_t]\) la concatenación del estado anterior y la entrada, y \(\sigma\) la sigmoide:</p>
      \[ \begin{aligned} i_t &= \sigma(W_i[h_{t-1},x_t]+b_i) && \text{puerta de entrada} \\ f_t &= \sigma(W_f[h_{t-1},x_t]+b_f) && \text{puerta de olvido} \\ o_t &= \sigma(W_o[h_{t-1},x_t]+b_o) && \text{puerta de salida} \\ g_t &= \tanh(W_g[h_{t-1},x_t]+b_g) && \text{candidato} \\ c_t &= f_t\odot c_{t-1} + i_t\odot g_t && \text{memoria} \\ h_t &= o_t\odot\tanh(c_t) && \text{estado visible} \end{aligned} \]
      <h2>Parámetros</h2>
      <p>Con \(H\) celdas y entrada de tamaño \(d\), hay cuatro bloques \((H\times(H+d)\) pesos y \(H\) sesgos): \(4\,H\,(H+d+1)\) parámetros, cuatro veces los de una RNN simple. Es habitual inicializar \(b_f\) en 1 para que la memoria parta abierta.</p>
      <h2>El gradiente</h2>
      <p>Si se ignoran las dependencias a través de las puertas, \(\partial c_t/\partial c_{t-1}=\operatorname{diag}(f_t)\): un producto de números entre 0 y 1 que la red aprende, no una matriz fija. Si \(f_t\approx1\), el gradiente se conserva a lo largo de cientos de pasos (<a href="tema.html?id=long-term-dependencies">Long-Term Dependencies</a>).</p>
      <div class="recuadro"><p>Variantes: conexiones de mirilla (<em>peepholes</em>), LSTM bidireccional (lee la secuencia en ambos sentidos), LSTM apiladas. La <a href="tema.html?id=gru-gates">GRU</a> simplifica la celda a dos puertas.</p></div>`,
  });
})();
