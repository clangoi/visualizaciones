(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const TIPOS = [['rnn', 'RNN simple', C.s2], ['lstm', 'LSTM', C.s1], ['gru', 'GRU', C.s6]];

  /* ---------- Fig. 1: cuánto gradiente llega desde lejos ---------- */

  function montarFlujo(cuerpo) {
    let T = 40, escala = 0.7, sesgo = 3, hover = -1, pl = null, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Escala de los pesos recurrentes', min: 0.3, max: 1.6, paso: 0.05, valor: escala, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { escala = v; calcular(); } });
    ctl.rango({ etiqueta: 'Sesgo de las puertas de memoria (olvido de la LSTM, actualización de la GRU)', min: -2, max: 4, paso: 0.25, valor: sesgo, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { sesgo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Largo de la secuencia', min: 10, max: 60, valor: T, alCambiar: (v) => { T = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, TIPOS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mediana de 8 inicializaciones, con 16 neuronas, de la norma de ∂L/∂hₜ respecto de la del último paso (cálculo real de BPTT). Una puerta con sesgo alto casi no «olvida», y deja pasar el gradiente a lo largo de decenas de pasos; con sesgo bajo, el efecto se invierte.');
    function calcular() {
      res = TIPOS.map(([k]) => {
        const corridas = Array.from({ length: 8 }, (_, s) => {
          const m = DL.recurrente(k, 16, s + 1, { escala, sesgoMemoria: sesgo }), r = VIZ.semilla(s + 3);
          const g = m.gradiente([DL.secuenciaMemoria(T - 1, r, 0.5)]);
          return g.normas.map((v) => v / g.normas[T - 1]);
        });
        return Array.from({ length: T }, (_, t) => { const v = corridas.map((c) => c[t]).sort((a, b) => a - b); return (v[3] + v[4]) / 2; });
      });
      dibujar();
    }
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: T, ymin: 1e-14, ymax: 1e4 }, { logY: true, etiquetaX: 'paso t (el error nace en t = T)', etiquetaY: 'gradiente relativo', formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      res.forEach((s, i) => VIZ.trazar(ctx, pl, s.map((v, t) => [t + 1, Math.max(v, 1e-14)]), TIPOS[i][2], 2.5));
      if (hover > 0) res.forEach((s, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(s[hover - 1], 1e-14)), TIPOS[i][2], 4));
      ctx.restore();
      const u = res.map((s) => s[0]), mejor = u.indexOf(Math.max(...u));
      registro.textContent = `Con ${T} pasos, el primer paso recibe ${TIPOS.map(([, t], i) => `${VIZ.fmt(u[i], 2)} (${t})`).join('; ')} del gradiente del último. El que más conserva: ${TIPOS[mejor][1]}.`;
      lectura.set(TIPOS.map(([, t], i) => [`${t}: gradiente en t = 1`, VIZ.fmt(u[i], 2)]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res) { hover = -1; tip.ocultar(); return; }
      hover = Math.max(1, Math.min(T, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `paso <b>${hover}</b>` + TIPOS.map(([, t, c], i) => VIZ.filaTooltip(c, t, VIZ.fmt(res[i][hover - 1], 2))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: entrenar en «recordar el primer símbolo» ---------- */

  function montarEntrenamiento(cuerpo) {
    let tipo = 'lstm', L = 12, ruido = 1, semilla = 1, red = null, hist = [], pasos = 0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Celda', opciones: TIPOS.map(([k, t]) => [k, t]), valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Pasos entre la señal y la respuesta', min: 3, max: 40, valor: L, alCambiar: (v) => { L = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ruido de los pasos intermedios', min: 0.2, max: 2, paso: 0.1, valor: ruido, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { ruido = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'exactitud en secuencias nuevas', forma: 'linea' }, { color: C.s2, texto: 'pérdida de entrenamiento (suavizada)', forma: 'linea' }, { color: C.apagado, texto: 'azar (50 %)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La etiqueta es el signo del primer paso; los demás son ruido. A mayor separación, más difícil. El resultado depende de la semilla: repita varias veces antes de sacar conclusiones. Una RNN con inicialización de radio espectral ≈ 1 puede resolver separaciones cortas; con ruido alto y separaciones largas suele fallar.');
    function iniciar() {
      red = DL.recurrente(tipo, 8, semilla, { escala: 1, sesgoMemoria: tipo === 'gru' ? 1 : 1 }); const opt = DL.optimizador('adam', { lr: 0.01 }), r = VIZ.semilla(semilla * 7 + L), rv = VIZ.semilla(555);
      hist = [{ p: 0, acc: 0.5, perd: 0.69 }]; pasos = 0; let sua = 0.69;
      return (function* () {
        while (pasos < 600) {
          for (let k = 0; k < 20; k++) { const R = red.paso(Array.from({ length: 16 }, () => DL.secuenciaMemoria(L, r, ruido)), opt, 1); sua = 0.9 * sua + 0.1 * R.perdida; pasos++; }
          let ok = 0; for (let q = 0; q < 60; q++) { const e = DL.secuenciaMemoria(L, rv, ruido); if ((red.adelante(e.x).p > 0.5 ? 1 : 0) === e.y) ok++; }
          hist.push({ p: pasos, acc: ok / 60, perd: sua }); yield;
        }
      })();
    }
    function dibujar() {
      if (!hist.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 600, ymin: 0, ymax: 1.05 }, { etiquetaX: 'pasos de entrenamiento', etiquetaY: 'exactitud / pérdida' });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, 0.5], [600, 0.5]], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, pl, hist.map((h) => [h.p, Math.min(h.perd, 1.05)]), C.s2, 2);
      VIZ.trazar(ctx, pl, hist.map((h) => [h.p, h.acc]), C.s1, 2.5);
      const u = hist[hist.length - 1];
      registro.textContent = u.acc > 0.9 ? `${TIPOS.find((t) => t[0] === tipo)[1]} resuelve la tarea (${VIZ.fmt(100 * u.acc, 3)} %) con ${L} pasos entre la señal y la respuesta.` : `Tras ${u.p} pasos acierta ${VIZ.fmt(100 * u.acc, 3)} %${u.p >= 300 && u.acc < 0.65 ? ': no ha logrado encontrar la señal en el ruido' : ''}.`;
      lectura.set([['pasos', String(u.p)], ['exactitud', `${VIZ.fmt(100 * u.acc, 3)} %`], ['pérdida', VIZ.fmt(u.perd, 3)], ['parámetros', String(red.nParametros)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !hist.length) return tip.ocultar();
      const h = hist.reduce((m, q) => (Math.abs(q.p - pl.ix(x)) < Math.abs(m.p - pl.ix(x)) ? q : m));
      tip.mostrar(x, y, `paso <b>${h.p}</b>` + VIZ.filaTooltip(C.s1, 'exactitud', `${VIZ.fmt(100 * h.acc, 3)} %`) + VIZ.filaTooltip(C.s2, 'pérdida', VIZ.fmt(h.perd, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('long-term-dependencies', {
    intro: String.raw`
      <p>Muchas tareas dependen de algo que ocurrió muy atrás: el sujeto de una frase que concuerda con un verbo diez palabras después, un cierre de paréntesis, el estado de una señal hace cien pasos. Una RNN simple tiene una memoria <strong>de corto plazo</strong>: la información de pasos lejanos se diluye en el estado, y, al entrenar, el gradiente que viene de ellos se <strong>desvanece</strong> (o <strong>explota</strong>).</p>
      <p>Las celdas con puertas, <strong>LSTM</strong> y <strong>GRU</strong>, añaden un camino por el que el estado pasa casi intacto de un paso al siguiente, y una puerta aprendida decide cuánto conservar. Así el gradiente puede viajar a lo largo de muchos pasos.</p>`,
    visualizaciones: [
      { titulo: 'Cuánto gradiente llega desde lejos', descripcion: 'Compare los tres tipos de celda. Suba el sesgo de las puertas de memoria a 3 y la escala a 0,7: la RNN pierde el gradiente y las puertas lo conservan. Con sesgo 0, ocurre lo contrario.', montar: montarFlujo },
      { titulo: 'Recordar el primer símbolo', descripcion: 'Entrene cada celda en la tarea de recordar el primer símbolo entre ruido. Cambie la separación y repita varias veces con distintas semillas.', montar: montarEntrenamiento },
    ],
    teoria: String.raw`
      <h2>Corto y largo plazo</h2>
      <p>En una RNN simple, la influencia de \(x_s\) sobre \(h_t\) pasa por un producto de \(t-s\) Jacobianos \(\operatorname{diag}(1-h_k^2)\,W_h\). Su norma decrece o crece como \(\gamma^{\,t-s}\): la memoria efectiva es del orden de \(1/\ln(1/\gamma)\) pasos. Es el mismo problema del <a href="tema.html?id=bptt-gradients">gradiente a través del tiempo</a>.</p>
      <h2>Camino aditivo</h2>
      <p>La LSTM mantiene un estado de celda \(c_t\) con actualización <em>aditiva</em>:</p>
      \[ c_t = f_t\odot c_{t-1} + i_t\odot g_t, \qquad \frac{\partial c_t}{\partial c_{t-1}}=\operatorname{diag}(f_t) + \cdots \]
      <p>Si la puerta de olvido \(f_t\) vale casi 1, el gradiente pasa de \(c_t\) a \(c_{t-1}\) casi sin cambio. Por eso se inicializa su sesgo en un valor positivo. En la GRU, \(h_t=(1-z_t)\odot n_t+z_t\odot h_{t-1}\) cumple el mismo papel con \(z_t\).</p>
      <table>
        <tr><th>Celda</th><th>Camino del gradiente</th><th>Factor típico por paso</th></tr>
        <tr><td>RNN</td><td>multiplicativo: \(\operatorname{diag}(1-h^2)\,W_h\)</td><td>\(\gamma\) (ni se controla ni se aprende)</td></tr>
        <tr><td>LSTM</td><td>aditivo en \(c_t\)</td><td>\(f_t\) (aprendido)</td></tr>
        <tr><td>GRU</td><td>aditivo en \(h_t\)</td><td>\(z_t\) (aprendido)</td></tr>
      </table>
      <div class="recuadro"><p>Las puertas ayudan, pero no son magia: la LSTM y la GRU también olvidan si sus puertas se cierran, y una secuencia de miles de pasos sigue siendo difícil. Los <a href="tema.html?id=transformer-block">Transformers</a> evitan la recurrencia: cada paso mira a todos los anteriores directamente (<a href="tema.html?id=rnn-vs-transformer">comparación</a>).</p></div>
      <p>Detalles de cada celda en <a href="tema.html?id=lstm-gates">LSTM</a> y <a href="tema.html?id=gru-gates">GRU</a>.</p>`,
  });
})();
