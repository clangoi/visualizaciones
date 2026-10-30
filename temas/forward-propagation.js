(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const TAM = [3, 4, 4, 2];
  const CAPAS = ['entrada', 'oculta 1', 'oculta 2', 'salida'];

  /* ---------- Fig. 1: la señal avanza capa por capa ---------- */

  function montarAvance(cuerpo) {
    let act = 'relu', semilla = 1, x = [0.8, -0.4, 0.5], red = null, pasoActual = 0, sel = null, pos = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Activación oculta', opciones: ['relu', 'tanh', 'sigmoide'].map((k) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; rep.reiniciar(); } });
    [0, 1, 2].forEach((j) => ctl.rango({ etiqueta: `Entrada x${j + 1}`, min: -1, max: 1, paso: 0.1, valor: x[j], formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { x[j] = v; rep.reiniciar(); } }));
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos pesos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'peso positivo / activación (más oscuro = más grande)', forma: 'linea' }, { color: C.s2, texto: 'peso negativo', forma: 'linea' }, { color: C.inactivo, texto: 'aún no calculado', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para calcular una capa a la vez. Haga clic en una neurona para ver su cuenta: suma ponderada, sesgo y activación.');
    function iniciar() {
      red = DL.red(TAM, { act, salida: 'lineal', semilla: semilla * 5 + 1, init: 'xavier' });
      red.b = red.b.map((v) => v.map((_, j) => ((j + semilla) % 3 - 1) * 0.1));
      pasoActual = 0; sel = null;
      return (function* () { for (let l = 1; l < TAM.length; l++) { pasoActual = l; yield; } })();
    }
    const F = () => DL.adelante(red, x);
    function dibujar() {
      if (!red) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const r = F();
      const valores = r.a.map((v, l) => (l <= pasoActual ? v : null));
      pos = DL.diagramaRed(ctx, 40, 24, W - 80, H - 60, TAM, { red, valores, r: 13, resaltarCapa: pasoActual });
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      pos.forEach((capa, l) => capa.forEach(([px, py], j) => { const v = r.a[l][j]; if (l <= pasoActual) { ctx.fillStyle = Math.abs(v) > 0.55 ? C.sobre : C.tinta; ctx.fillText(VIZ.fmt(v, 2).replace('-', '−'), px, py); } }));
      if (sel) { ctx.strokeStyle = C.s7; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(...pos[sel[0]][sel[1]], 17, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'bottom';
      pos.forEach((capa, l) => ctx.fillText(CAPAS[l], capa[0][0], 14));
      const salida = r.a[3];
      if (sel && sel[0] > 0) {
        const [l, j] = sel, w = red.W[l - 1][j], ent = r.a[l - 1];
        const t = w.map((wi, i) => `${VIZ.fmt(wi, 2)}·${VIZ.fmt(ent[i], 2)}`).join(' + ');
        registro.textContent = `Neurona ${j + 1} de «${CAPAS[l]}»: z = ${t} + ${VIZ.fmt(red.b[l - 1][j], 2)} = ${VIZ.fmt(r.z[l][j], 3)}; a = ${l === 3 ? 'z (salida lineal)' : DL.ACT[act].nombre + '(z)'} = ${VIZ.fmt(r.a[l][j], 3)}.`.replace(/-/g, '−');
      } else registro.textContent = pasoActual === 0 ? 'Entrada lista. Pulse «Un paso» para calcular la primera capa oculta.' : `Capa «${CAPAS[pasoActual]}» calculada a partir de la anterior: cada neurona hace z = Σ wᵢaᵢ + b y aplica la activación.`;
      lectura.set([['capas calculadas', `${pasoActual} de 3`], ['parámetros', VIZ.entero(DL.nParametros(TAM))], ['salida', pasoActual === 3 ? `(${VIZ.fmt(salida[0], 3)}, ${VIZ.fmt(salida[1], 3)})` : '—'], ['multiplicaciones', VIZ.entero(TAM.slice(1).reduce((s, m, l) => s + m * TAM[l], 0))]]);
    }
    lienzo.alDibujar = dibujar;
    const bajo = (ev) => {
      const { x: px, y: py } = lienzo.posicion(ev);
      if (!pos) return null;
      for (let l = 0; l < pos.length; l++) for (let j = 0; j < pos[l].length; j++) if (Math.hypot(px - pos[l][j][0], py - pos[l][j][1]) < 15) return [l, j];
      return null;
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { sel = bajo(ev); dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const q = bajo(ev), { x: px, y: py } = lienzo.posicion(ev);
      if (!q || q[0] > pasoActual) return tip.ocultar();
      const r = F();
      tip.mostrar(px, py, `${CAPAS[q[0]]}, neurona ${q[1] + 1}<br>a = <b>${VIZ.fmt(r.a[q[0]][q[1]], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: una capa es una multiplicación de matrices ---------- */

  function montarMatrices(cuerpo) {
    let capa = 1, act = 'relu', semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Capa', opciones: [['1', 'oculta 1 (3 → 4)'], ['2', 'oculta 2 (4 → 4)'], ['3', 'salida (4 → 2)']], valor: String(capa), alCambiar: (v) => { capa = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Activación', opciones: ['relu', 'tanh', 'sigmoide'].map((k) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; dibujar(); } });
    ctl.boton('Nuevos pesos', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 220, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cada neurona de la capa es una fila de W. La capa entera, para todas sus neuronas a la vez, es z = W·a + b. Pase el cursor por una celda para ver su valor.');
    let celdas = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const red = DL.red(TAM, { act, salida: 'lineal', semilla: semilla * 5 + 1, init: 'xavier' });
      const r = DL.adelante(red, [0.8, -0.4, 0.5]);
      const l = capa, Wm = red.W[l - 1], b = red.b[l - 1].map((v, j) => v + 0.1 * (j - 1)), a0 = r.a[l - 1];
      const z = Wm.map((f, j) => f.reduce((s, w, i) => s + w * a0[i], b[j]));
      const a1 = l === 3 ? z : z.map(DL.ACT[act].f);
      const tam = Math.min(46, (W - 120) / 13), x0 = 14, y0 = (H - 4 * tam) / 2;
      celdas = [];
      const bloque = (mat, x, etiqueta, nombre) => {
        const m = mat.length, n = mat[0].length, top = y0 + (4 - m) * tam / 2;
        DL.mapa(ctx, mat, x, top, n * tam, m * tam, { divergente: true, valores: (v) => VIZ.fmt(v, 2).replace('-', '−') });
        mat.forEach((f, i) => f.forEach((v, j) => celdas.push({ x: x + j * tam, y: top + i * tam, w: tam, h: tam, texto: `${nombre}[${i + 1}${n > 1 ? ',' + (j + 1) : ''}] = <b>${VIZ.fmt(v, 3)}</b>` })));
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(etiqueta, x + (n * tam) / 2, top + m * tam + 6);
        return x + n * tam;
      };
      const op = (x, t) => { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 14, H / 2 - 6); return x + 28; };
      let x = x0;
      x = bloque(Wm, x, 'W', 'W'); x = op(x, '·');
      x = bloque(a0.map((v) => [v]), x, 'a (entrada)', 'a'); x = op(x, '+');
      x = bloque(b.map((v) => [v]), x, 'b', 'b'); x = op(x, '=');
      x = bloque(z.map((v) => [v]), x, 'z', 'z'); x = op(x, l === 3 ? '=' : '→');
      bloque(a1.map((v) => [v]), x, l === 3 ? 'salida' : `${DL.ACT[act].nombre}(z)`, 'a');
      registro.textContent = `Capa «${CAPAS[l]}»: ${Wm.length}×${Wm[0].length} pesos, ${Wm.length} sesgos; ${Wm.length * Wm[0].length} multiplicaciones y ${Wm.length * (Wm[0].length - 1)} sumas más los sesgos.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celdas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (c) tip.mostrar(x, y, c.texto); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('forward-propagation', {
    intro: String.raw`
      <p>En una red <em>feedforward</em> la información viaja en un solo sentido: de la <strong>capa de entrada</strong>, por una o más <strong>capas ocultas</strong>, hasta la <strong>capa de salida</strong>. No hay ciclos ni memoria.
      A ese viaje, que convierte un dato en una predicción, se le llama <strong>propagación hacia adelante</strong> (<em>forward propagation</em>).</p>
      <p>En cada capa, cada neurona suma sus entradas ponderadas más un sesgo y aplica la activación. Todas las neuronas de una capa se calculan a la vez con una sola multiplicación de matrices, lo que permite aprovechar las GPU.</p>`,
    visualizaciones: [
      { titulo: 'La señal avanza capa por capa', descripcion: 'Avance con «Un paso» y haga clic en una neurona para ver su cálculo. Cambie las entradas y la activación y observe cuáles neuronas se encienden.', montar: montarAvance },
      { titulo: 'Una capa es un producto de matrices', descripcion: 'Elija una capa y compare las matrices con el diagrama de la figura anterior: cada fila de W es una neurona.', montar: montarMatrices },
    ],
    teoria: String.raw`
      <h2>Ecuaciones</h2>
      <p>Para una red de \(L\) capas, con \(a^{(0)} = x\):</p>
      \[ z^{(\ell)} = W^{(\ell)} a^{(\ell-1)} + b^{(\ell)}, \qquad a^{(\ell)} = f^{(\ell)}\big(z^{(\ell)}\big), \qquad \ell = 1,\dots,L, \qquad \hat y = a^{(L)}. \]
      <p>Aquí \(W^{(\ell)} \in \mathbb{R}^{n_\ell \times n_{\ell-1}}\) y \(b^{(\ell)}\in\mathbb{R}^{n_\ell}\). El número de parámetros es</p>
      \[ P = \sum_{\ell=1}^{L} \big(n_\ell\, n_{\ell-1} + n_\ell\big). \]
      <p>La red de la figura (3, 4, 4, 2) tiene \(4\cdot3+4 + 4\cdot4+4 + 2\cdot4+2 = 46\) parámetros.</p>
      <h2>Algoritmo</h2>
      <pre><code>a ← x
para ℓ ← 1 hasta L:
    z ← W[ℓ]·a + b[ℓ]
    a ← f[ℓ](z)          // en la salida: identidad, sigmoide o softmax
devolver a</code></pre>
      <h2>Costo</h2>
      <p>Cada capa cuesta \(O(n_\ell n_{\ell-1})\) multiplicaciones; para un lote de \(B\) ejemplos, \(Z = A W^\top + b\) es una multiplicación de matrices \(B\times n_{\ell-1}\) por \(n_{\ell-1}\times n_\ell\), que las GPU ejecutan en paralelo.</p>
      <div class="recuadro"><p>Los valores intermedios \(z^{(\ell)}\) y \(a^{(\ell)}\) se guardan durante el avance, porque la <a href="tema.html?id=backpropagation">retropropagación</a> los necesita para calcular los gradientes.</p></div>
      <p>La elección de \(f\) se analiza en <a href="tema.html?id=activation-functions">Activation Functions</a>; el papel de la profundidad, en <a href="tema.html?id=nonlinear-representation">Nonlinear Representation</a>.</p>`,
  });
})();
