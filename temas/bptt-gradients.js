(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  /* ---------- Fig. 1: el gradiente hacia atrás en el tiempo ---------- */

  function montarGradiente(cuerpo) {
    let T = 25, escala = 1, recorte = 0, semilla = 1, normas = [], hover = -1, pl = null, total = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Largo de la secuencia T', min: 5, max: 50, valor: T, alCambiar: (v) => { T = v; calcular(); } });
    ctl.rango({ etiqueta: 'Escala de los pesos recurrentes', min: 0.3, max: 2.5, paso: 0.05, valor: escala, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { escala = v; calcular(); } });
    ctl.rango({ etiqueta: 'Recorte del gradiente (0 = ninguno)', min: 0, max: 5, paso: 0.25, valor: recorte, formato: (v) => (v ? VIZ.fmt(v, 2) : 'ninguno'), alCambiar: (v) => { recorte = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: '‖∂L/∂hₜ‖ llegando al paso t (relativo al último)', forma: 'cuadro' }, { color: C.s8, texto: 'gradiente que explota (más de 10× el último)', forma: 'cuadro' }, { color: C.s4, texto: 'gradiente que se desvanece (menos de 10⁻³)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se retropropaga el error de la salida a través de una RNN real, paso a paso, hasta t = 1. Con escala < 1 los factores de cada paso encogen el gradiente; con escala > 1 lo agrandan. El recorte limita la norma total del gradiente de los parámetros, no la de cada paso.');
    function calcular() {
      const red = DL.recurrente('rnn', 16, semilla, { escala }), r = VIZ.semilla(semilla * 3 + 1), e = DL.secuenciaMemoria(T - 1, r, 0.5);
      const g = red.gradiente([e], recorte);
      normas = g.normas.map((v) => v / g.normas[T - 1]); total = g.norma;
      dibujar();
    }
    function dibujar() {
      if (!normas.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: T, ymin: 1e-12, ymax: 1e8 }, { logY: true, etiquetaX: 'paso t (el error nace en t = T, a la derecha)', etiquetaY: 'norma del gradiente (relativa)', formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      const bw = (pl.x1 - pl.x0) / T, base = pl.sy(1);
      normas.forEach((v, i) => {
        const y = pl.sy(Math.max(v, 1e-12)); ctx.fillStyle = v > 10 ? C.s8 : v < 1e-3 ? C.s4 : C.s1;
        ctx.beginPath(); ctx.roundRect(pl.x0 + i * bw + 1, Math.min(y, base), bw - 2, Math.max(2, Math.abs(base - y)), 2); ctx.fill();
        if (i === hover) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
      });
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.x0, base); ctx.lineTo(pl.x1, base); ctx.stroke(); ctx.setLineDash([]);
      const primero = normas[0];
      registro.textContent = primero < 1e-3 ? `El primer paso recibe ${VIZ.fmt(primero, 2)} veces el gradiente del último: la red casi no puede aprender de lo que ocurrió al principio (gradiente desvaneciente).` : primero > 10 ? `El primer paso recibe ${VIZ.fmt(primero, 2)} veces el gradiente del último: los gradientes explotan; el recorte evita que una actualización destruya los pesos.` : `El primer paso recibe ${VIZ.fmt(primero, 2)} veces el gradiente del último: el flujo se conserva.`;
      lectura.set([['gradiente en t = 1 (relativo)', VIZ.fmt(primero, 3)], ['gradiente en t = T/2 (relativo)', VIZ.fmt(normas[Math.floor(T / 2)], 3)], ['norma del gradiente de los parámetros', VIZ.fmt(total, 3)], ['recorte activo', recorte ? (total >= recorte - 1e-9 ? 'sí' : 'no') : 'no usado']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !normas.length) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(T - 1, Math.floor((x - pl.x0) / ((pl.x1 - pl.x0) / T))); dibujar();
      tip.mostrar(x, y, `paso <b>${hover + 1}</b><br>‖∂L/∂h‖ relativo = <b>${VIZ.fmt(normas[hover], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: retropropagación truncada ---------- */

  function montarTruncada(cuerpo) {
    let T = 60, k = 20, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Largo de la secuencia T', min: 20, max: 100, paso: 5, valor: T, alCambiar: (v) => { T = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ventana de truncamiento k', min: 5, max: 100, paso: 5, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tramo de k pasos con gradiente completo', forma: 'cuadro' }, { color: C.s2, texto: 'dependencia de largo d que sí se aprende', forma: 'linea' }, { color: C.s8, texto: 'dependencia que cruza el corte (no se aprende)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En la retropropagación truncada el estado se arrastra de un tramo al siguiente, pero el gradiente no cruza el corte. Abajo, la fracción de pares (t − d, t) de una dependencia de largo d que caen dentro de un mismo tramo: se aprende solo lo que cabe en k.');
    const frac = (d) => (d >= k ? 0 : (k - d) / k);
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const x0 = 12, ancho = W - 24, ys = 22, nt = Math.ceil(T / k);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`Secuencia de ${T} pasos en ${nt} tramo(s) de ${Math.min(k, T)}`, x0, 2);
      for (let q = 0; q < nt; q++) {
        const a = q * k, b = Math.min(T, (q + 1) * k), xa = x0 + (a / T) * ancho, xb = x0 + (b / T) * ancho;
        ctx.fillStyle = VIZ.alfa(C.s1, 0.3); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(xa + 1, ys, xb - xa - 2, 30, 5); ctx.fill(); ctx.stroke();
      }
      const d = 12;
      [[2, 2 + d], [Math.max(3, k - 6), Math.max(3, k - 6) + d]].forEach(([a, b], i) => {
        if (b >= T) return;
        const cruza = Math.floor(a / k) !== Math.floor(b / k), xa = x0 + ((a + 0.5) / T) * ancho, xb = x0 + ((b + 0.5) / T) * ancho;
        ctx.strokeStyle = cruza ? C.s8 : C.s2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xa, ys + 34); ctx.bezierCurveTo(xa, ys + 60, xb, ys + 60, xb, ys + 34); ctx.stroke();
        ctx.fillStyle = cruza ? C.s8 : C.s2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.fillText(cruza ? 'cruza el corte' : 'dentro del tramo', (xa + xb) / 2, ys + 62 + i * 14);
      });
      const top = ys + 100;
      const pl2 = VIZ.plano({ ...lienzo, alto: H, ancho: W, ctx }, { xmin: 0, xmax: 100, ymin: 0, ymax: 1.05 }, { etiquetaX: 'largo de la dependencia d (fracción aprendible en el eje vertical)', margen: { sup: top } });
      pl2.ejes(); pl = pl2;
      VIZ.trazar(ctx, pl2, Array.from({ length: 101 }, (_, d2) => [d2, frac(d2)]), C.s1, 2.5);
      if (hover != null) VIZ.marcador(ctx, pl2.sx(hover), pl2.sy(frac(hover)), C.s1, 5);
      registro.textContent = `Con k = ${k}, una dependencia de largo ${d} se aprende en el ${VIZ.fmt(100 * frac(d), 3)} % de las posiciones; las de largo ≥ ${k} nunca. El costo por actualización crece solo con k, no con T.`;
      lectura.set([['tramos', String(nt)], ['memoria por actualización', `${Math.min(k, T)} pasos`], ['memoria sin truncar', `${T} pasos`], ['dependencias de largo ≥ k', 'no se aprenden']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(100, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `d = <b>${hover}</b><br>fracción aprendible <b>${VIZ.fmt(frac(hover), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bptt-gradients', {
    intro: String.raw`
      <p>Para entrenar una RNN se «desdobla» en el tiempo: una copia de la celda por paso, todas con los mismos pesos. El error de la salida se retropropaga por esa cadena de copias hasta el primer paso: <strong>retropropagación a través del tiempo</strong> (<em>Backpropagation Through Time</em>, BPTT).</p>
      <p>El problema es que en cada paso hacia atrás el gradiente se multiplica por la misma matriz de pesos y por la derivada de la activación. Si esos factores son menores que 1, el gradiente se <strong>desvanece</strong> y la red no aprende de lo lejano; si son mayores que 1, <strong>explota</strong>. Esto último se controla con <em>recorte del gradiente</em>.</p>`,
    visualizaciones: [
      { titulo: 'El gradiente hacia atrás en el tiempo', descripcion: 'Cambie la escala de los pesos y el largo y vea cómo la barra de cada paso crece o se encoge exponencialmente. Es un cálculo real sobre una RNN de 16 neuronas.', montar: montarGradiente },
      { titulo: 'Retropropagación truncada', descripcion: 'Con secuencias muy largas, el gradiente se corta cada k pasos. Mueva k y vea qué dependencias dejan de ser aprendibles.', montar: montarTruncada },
    ],
    teoria: String.raw`
      <h2>El gradiente a través del tiempo</h2>
      <p>Con \(h_t=\tanh(a_t)\), \(a_t=W_xx_t+W_hh_{t-1}+b\), y la pérdida \(\mathcal{L}\) evaluada en \(h_T\), la regla de la cadena da</p>
      \[ \frac{\partial \mathcal{L}}{\partial h_t}=\frac{\partial \mathcal{L}}{\partial h_T}\prod_{k=t+1}^{T}\frac{\partial h_k}{\partial h_{k-1}}, \qquad \frac{\partial h_k}{\partial h_{k-1}}=\operatorname{diag}\!\big(1-h_k^2\big)\,W_h. \]
      <p>Si \(\gamma\) acota la norma de cada factor, entonces \(\big\|\partial \mathcal{L}/\partial h_t\big\|\le \gamma^{\,T-t}\,\big\|\partial \mathcal{L}/\partial h_T\big\|\). Con \(\gamma<1\) (por ejemplo, el mayor valor singular de \(W_h\) menor que 1), el gradiente decae exponencialmente; la condición contraria es necesaria, pero no suficiente, para que explote.</p>
      <h2>Los parámetros acumulan todos los pasos</h2>
      \[ \frac{\partial\mathcal{L}}{\partial W_h}=\sum_{t=1}^{T}\frac{\partial\mathcal{L}}{\partial a_t}\,h_{t-1}^\top. \]
      <p>Los términos de pasos lejanos pesan poco cuando el gradiente se desvanece: la red aprende sobre todo de dependencias cortas.</p>
      <h2>Remedios</h2>
      <ul>
        <li><strong>Recorte del gradiente</strong> (<em>gradient clipping</em>): si \(\lVert g\rVert>\tau\), se reemplaza \(g\) por \(\tau\,g/\lVert g\rVert\). Resuelve la explosión, no el desvanecimiento.</li>
        <li><strong>Inicialización</strong> de \(W_h\) ortogonal o con radio espectral cercano a 1.</li>
        <li><strong>Celdas con puertas</strong> (<a href="tema.html?id=lstm-gates">LSTM</a>, <a href="tema.html?id=gru-gates">GRU</a>): caminos aditivos por los que el gradiente fluye casi sin multiplicarse.</li>
        <li><strong>BPTT truncada</strong>: retropropagar solo \(k\) pasos, a costa de no aprender dependencias más largas que \(k\).</li>
      </ul>
      <div class="recuadro"><p>El mismo producto de Jacobianos aparece en redes profundas <em>no</em> recurrentes (<a href="tema.html?id=activation-functions">gradientes desvanecientes</a>); lo especial aquí es que los factores comparten pesos y se repiten \(T\) veces.</p></div>`,
  });
})();
