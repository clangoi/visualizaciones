(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: el estado oculto recuerda el primer símbolo ---------- */

  function montarEstado(cuerpo) {
    let L = 10, H = 6, semilla = 1, red = null, opt = null, pasos = 0, perdida = NaN, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Pasos de ruido tras la señal', min: 3, max: 20, valor: L, alCambiar: (v) => { L = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Neuronas del estado oculto', min: 2, max: 12, valor: H, alCambiar: (v) => { H = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(100 + 2 * (H * Math.min(24, (w - 120) / (L + 1)) + 56)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'activación positiva del estado oculto', forma: 'cuadro' }, { color: C.s2, texto: 'negativa', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La entrada de cada secuencia es +1 o −1 en el primer paso y ruido después; la etiqueta es el signo del primer paso. La red solo ve un número por vez y debe guardar «el primero» en su estado oculto. Entrénela y compare los dos casos: los estados terminan distintos.');
    function iniciar() {
      red = DL.recurrente('rnn', H, semilla); opt = DL.optimizador('adam', { lr: 0.02 }); pasos = 0; perdida = NaN;
      const r = VIZ.semilla(semilla * 5 + 2);
      return (function* () { while (pasos < 400) { for (let k = 0; k < 10; k++) { const R = red.paso(Array.from({ length: 16 }, () => DL.secuenciaMemoria(L, r)), opt, 1); perdida = R.perdida; pasos++; } yield; } })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx, ancho: W } = lienzo, T = L + 1, c = Math.min(24, (W - 120) / T), r = VIZ.semilla(semilla * 91 + 3);
      lienzo.limpiar(); geo = [];
      const base = DL.secuenciaMemoria(L, r), ruidoComun = base.x.slice(1);
      [1, 0].forEach((bit, q) => {
        const x = [bit ? 1 : -1, ...ruidoComun], f = red.adelante(x), y0 = 8 + q * (H * c + 78);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`Secuencia con primer símbolo ${bit ? '+1' : '−1'}`, 8, y0);
        // Entrada.
        DL.mapa(ctx, [x], 100, y0 + 18, T * c, c, { divergente: true, min: -1.5, max: 1.5 });
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('entrada x', 94, y0 + 18 + c / 2);
        // Estados ocultos.
        const M = Array.from({ length: H }, (_, j) => f.cache.map((e) => e.h[j]));
        DL.mapa(ctx, M, 100, y0 + 24 + c, T * c, H * c, { divergente: true, min: -1, max: 1 });
        ctx.fillStyle = C.apagado; ctx.fillText('estado h', 94, y0 + 24 + c + (H * c) / 2);
        geo.push({ x: 100, y: y0 + 24 + c, c, M, x, bit });
        // Predicción.
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`P(primer símbolo = +1) = ${VIZ.fmt(f.p, 3)}  ${(f.p > 0.5) === !!bit ? '✓' : '✗'}`, 100, y0 + 30 + c + H * c);
      });
      registro.textContent = pasos ? `Tras ${pasos} pasos de entrenamiento (pérdida ${VIZ.fmt(perdida, 3)}), la predicción depende del primer símbolo aunque pasen ${L} pasos de ruido.` : 'Red sin entrenar: su estado oculto apenas distingue las dos secuencias.';
      let ok = 0; const rv = VIZ.semilla(444); for (let k = 0; k < 100; k++) { const e = DL.secuenciaMemoria(L, rv); if ((red.adelante(e.x).p > 0.5 ? 1 : 0) === e.y) ok++; }
      lectura.set([['pasos de entrenamiento', String(pasos)], ['pérdida', pasos ? VIZ.fmt(perdida, 3) : '—'], ['exactitud (100 secuencias nuevas)', `${ok} %`], ['parámetros', String(red.nParametros)], ['largo de la secuencia', String(T)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x < q.x + q.M[0].length * q.c && y >= q.y && y < q.y + q.M.length * q.c);
      if (!g) return tip.ocultar();
      const t = Math.floor((x - g.x) / g.c), j = Math.floor((y - g.y) / g.c);
      tip.mostrar(x, y, `paso <b>${t}</b>, neurona <b>${j + 1}</b><br>h = <b>${f2(g.M[j][t])}</b><br>entrada x = ${f2(g.x[t])}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cuánto dura el recuerdo de un impulso ---------- */

  function montarImpulso(cuerpo) {
    let a = 1, u = 1, hover = null, pl = null;
    const WS = [0.5, 0.9, 1.0, 1.4], COL = [C.s1, C.s3, C.s6, C.s2];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del impulso en t = 0', min: 0.1, max: 3, paso: 0.1, valor: a, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Peso de entrada u', min: 0.1, max: 2, paso: 0.1, valor: u, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { u = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, WS.map((w, i) => ({ color: COL[i], texto: `peso recurrente w = ${w}`, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Una sola neurona recurrente, h_t = tanh(w·h_{t−1} + u·x_t), con un impulso en t = 0 y entrada cero después. Con w pequeño el recuerdo se borra casi de inmediato; con w cerca de 1 dura mucho; con w > 1 la tanh lo mantiene saturado.');
    const serie = (w) => { const s = [Math.tanh(u * a)]; for (let t = 1; t <= 30; t++) s.push(Math.tanh(w * s[t - 1])); return s; };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 30, ymin: 0, ymax: 1.05 }, { etiquetaX: 'paso t', etiquetaY: 'estado h_t' });
      pl.ejes();
      WS.forEach((w, i) => { VIZ.trazar(ctx, pl, serie(w).map((v, t) => [t, v]), COL[i], 2.5); if (hover != null) VIZ.marcador(ctx, pl.sx(hover), pl.sy(serie(w)[hover]), COL[i], 4); });
      const h10 = WS.map((w) => serie(w)[10]);
      registro.textContent = `A los 10 pasos del impulso, el estado conserva ${h10.map((v, i) => `${VIZ.fmt(v / serie(WS[i])[0] * 100, 3)} % (w = ${WS[i]})`).join('; ')} de su valor inicial.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(30, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `t = <b>${hover}</b>` + WS.map((w, i) => VIZ.filaTooltip(COL[i], `w = ${w}`, VIZ.fmt(serie(w)[hover], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('rnn-hidden-state', {
    intro: String.raw`
      <p>Una red feedforward trata cada dato por separado. Pero muchos datos son <strong>secuencias</strong>: palabras de una frase, lecturas de un sensor, notas de una melodía; lo que importa de cada elemento depende de lo que vino antes.
      Una <strong>red recurrente</strong> (RNN) procesa la secuencia un paso a la vez y mantiene un <strong>estado oculto</strong> (<em>hidden state</em>) \(h_t\): un resumen, que ella misma aprende a escribir, de todo lo visto hasta \(t\).</p>
      <p>Los mismos pesos se usan en todos los pasos (como el kernel de una CNN se comparte en el espacio, aquí se comparte en el tiempo), así que la red acepta secuencias de cualquier largo con un número fijo de parámetros.</p>`,
    parametros: [
      ['Pasos de ruido tras la señal (Fig. 1)', String.raw`Cuántos pasos sin información separan el primer símbolo del final de la secuencia. Más pasos obligan al estado oculto a conservar el recuerdo durante más tiempo.`],
      ['Neuronas del estado oculto (Fig. 1)', String.raw`Tamaño de la memoria de la red. Con pocas neuronas hay menos capacidad para guardar el primer símbolo.`],
      ['Otra semilla y reproductor (Fig. 1)', String.raw`Otra semilla genera otros pesos y datos de entrenamiento; el reproductor entrena la red y la reinicia al cambiar un parámetro.`],
      ['Tamaño del impulso en t = 0 (Fig. 2)', String.raw`Intensidad de la entrada única que recibe la red en el primer paso. Escala todo el rastro del estado, pero no cambia cuánto tarda en desvanecerse.`],
      ['Peso de entrada u (Fig. 2)', String.raw`Cuánto pesa esa entrada al entrar en el estado. Con un peso mayor el estado arranca más lejos de cero.`],
    ],
    visualizaciones: [
      { titulo: 'El estado oculto guarda el pasado', descripcion: 'Entrene la red y compare el estado oculto de dos secuencias que solo difieren en su primer símbolo. Aumente los pasos de ruido para dificultar la memoria.',
        ayuda: String.raw`<p>Cada fila es una secuencia y cada columna, un paso de tiempo; las celdas muestran las neuronas del estado oculto: azul para activación positiva y naranja para negativa. Las dos secuencias solo difieren en su primer símbolo, así que cualquier diferencia entre sus estados es memoria de ese símbolo.</p>
          <ul>
          <li><strong>Pasos de ruido tras la señal</strong>: al aumentarlos, las diferencias entre ambos estados se apagan hacia el final; la red olvida el primer símbolo.</li>
          <li><strong>Neuronas del estado oculto</strong>: con más neuronas aparecen más filas y suele quedar más rastro de la señal inicial.</li>
          </ul>`, montar: montarEstado },
      { titulo: 'Cuánto dura un recuerdo', descripcion: 'Compare cuatro pesos recurrentes ante un impulso aislado y vea cuál «recuerda» más tiempo.',
        ayuda: String.raw`<p>Cada curva muestra el estado \(h_t\) en el tiempo \(t\) tras un único impulso en \(t=0\), una por cada peso recurrente de la leyenda.</p>
          <ul>
          <li><strong>Tamaño del impulso</strong>: sube o baja el punto de partida de todas las curvas en la misma proporción.</li>
          <li><strong>Peso de entrada u</strong>: cambia la altura del primer valor; las curvas con peso recurrente pequeño caen rápido y las de peso cercano a 1 persisten más.</li>
          </ul>`, montar: montarImpulso },
    ],
    teoria: String.raw`
      <h2>La recurrencia</h2>
      <p>Para una secuencia \(x_1,\dots,x_T\), con \(h_0=0\):</p>
      \[ h_t = \tanh\!\big(W_x\,x_t + W_h\,h_{t-1} + b\big), \qquad \hat y = \sigma\!\big(w_o^\top h_T + b_o\big). \]
      <p>Los parámetros \(W_x, W_h, b\) son los mismos en todos los pasos. El estado \(h_T\) depende de toda la secuencia, de modo que la red puede predecir a partir de ella. Según la tarea, la salida puede leerse solo al final (clasificar), en cada paso (etiquetar, predecir el siguiente), o usarse para generar (<a href="tema.html?id=autoregressive-generation">generación autorregresiva</a>).</p>
      <h2>Desplegada en el tiempo</h2>
      <p>Si se «desdobla» la red en \(T\) copias, una por paso, se obtiene una red feedforward de \(T\) capas con pesos compartidos. Eso permite entrenarla con <a href="tema.html?id=bptt-gradients">retropropagación a través del tiempo</a>.</p>
      <h2>Memoria de corto plazo</h2>
      <p>En la zona lineal de la tanh, un impulso \(x_0\) deja una huella \(h_t\approx W_h^{\,t}\,W_x x_0\). Su tamaño depende del radio espectral \(\rho(W_h)\): si \(\rho<1\) se desvanece como \(\rho^t\), y la red no puede recordar lejos; si \(\rho>1\) crece hasta que la tanh lo sature.</p>
      <div class="recuadro"><p>Una RNN «simple» tiene memoria de corto plazo en la práctica: aprender dependencias largas es difícil porque el gradiente también se desvanece o explota (<a href="tema.html?id=long-term-dependencies">Long-Term Dependencies</a>). Las celdas con puertas (<a href="tema.html?id=lstm-gates">LSTM</a>, <a href="tema.html?id=gru-gates">GRU</a>) resuelven buena parte del problema.</p></div>`,
  });
})();
