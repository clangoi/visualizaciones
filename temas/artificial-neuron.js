(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  /* ---------- Fig. 1: una neurona traza una recta ---------- */

  function montarRecta(cuerpo) {
    let tipo = 'lineal', w1 = 1, w2 = -1, b = 0, semilla = 1, activ = 'escalon', pts = [], pl = null, errores = 0, i = 0, regla = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: [['lineal', 'Separable linealmente'], ['manchas', 'Dos manchas'], ['xor', 'XOR (no separable)']], valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Activación', opciones: [['escalon', 'Escalón (perceptrón)'], ['sigmoide', 'Sigmoid']], valor: activ, alCambiar: (v) => { activ = v; dibujar(); } });
    const rw1 = ctl.rango({ etiqueta: 'Peso w₁', min: -3, max: 3, paso: 0.1, valor: w1, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { w1 = v; dibujar(); } });
    const rw2 = ctl.rango({ etiqueta: 'Peso w₂', min: -3, max: 3, paso: 0.1, valor: w2, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { w2 = v; dibujar(); } });
    const rb = ctl.rango({ etiqueta: 'Sesgo b', min: -2, max: 2, paso: 0.05, valor: b, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { b = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2), { color: C.tinta, texto: 'frontera w·x + b = 0', forma: 'linea' }, { color: C.s2, texto: 'vector de pesos (apunta hacia la clase 1)', forma: 'linea' }, { color: C.s8, texto: 'ejemplo mal clasificado', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva los pesos y el sesgo a mano, o pulse Reproducir para aplicar la regla del perceptrón: cada paso revisa un ejemplo y, si está mal clasificado, empuja la frontera hacia él.');
    const sal = (x, y) => { const z = w1 * x + w2 * y + b; return activ === 'escalon' ? (z > 0 ? 1 : 0) : DL.ACT.sigmoide.f(z); };
    function iniciar() {
      pts = ML.datos(tipo, 60, 0.4, semilla * 9);
      w1 = 0.3; w2 = 0.2; b = 0; i = 0; errores = 0; regla = '';
      sincronizar();
      const orden = pts.slice();
      return (function* () {
        for (let e = 0; e < 40; e++) {
          let hubo = 0;
          for (const q of orden) {
            i++;
            const yhat = w1 * q.x + w2 * q.y + b > 0 ? 1 : 0, d = q.c - yhat;
            if (d !== 0) { w1 += 0.15 * d * q.x; w2 += 0.15 * d * q.y; b += 0.15 * d; hubo++; regla = `Ejemplo (${VIZ.fmt(q.x, 2)}, ${VIZ.fmt(q.y, 2)}) de clase ${q.c} mal clasificado: w ← w + 0,15·${d > 0 ? '+1' : '−1'}·x.`; sincronizar(); yield; }
          }
          if (!hubo) { regla = 'Una pasada completa sin errores: el perceptrón convergió.'; yield; return; }
        }
      })();
    }
    function sincronizar() { rw1.valor = w1; rw2.valor = w2; rb.valor = b; }
    function dibujar() {
      if (!pts.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = ML.plano(lienzo);
      pl.ejes();
      ctx.save(); pl.recortar();
      ML.regiones(ctx, pl, (x, y) => (activ === 'escalon' ? sal(x, y) : sal(x, y)), { paso: 7 });
      ML.contorno(ctx, pl, (x, y) => w1 * x + w2 * y + b, 0, { color: C.tinta, ancho: 2.5 });
      const nrm = Math.hypot(w1, w2) || 1, cx = (-b * w1) / (nrm * nrm), cy = (-b * w2) / (nrm * nrm);
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pl.sx(cx), pl.sy(cy)); ctx.lineTo(pl.sx(cx + (0.4 * w1) / nrm), pl.sy(cy + (0.4 * w2) / nrm)); ctx.stroke();
      ctx.restore();
      ML.puntos(ctx, pl, pts, { anillo: (q) => ((w1 * q.x + w2 * q.y + b > 0 ? 1 : 0) !== q.c ? C.s8 : null) });
      const mal = pts.filter((q) => (w1 * q.x + w2 * q.y + b > 0 ? 1 : 0) !== q.c).length;
      registro.textContent = regla || (mal === 0 ? 'Todos los ejemplos están bien clasificados.' : `${mal} ejemplos mal clasificados: ajuste los pesos.`);
      lectura.set([['errores', `${mal} de ${pts.length}`], ['w', `(${VIZ.fmt(w1, 2)}, ${VIZ.fmt(w2, 2)})`], ['sesgo b', VIZ.fmt(b, 2)], ['ejemplos revisados', String(i)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const X = pl.ix(x), Y = pl.iy(y), z = w1 * X + w2 * Y + b;
      tip.mostrar(x, y, `z = w·x + b = <b>${VIZ.fmt(z, 3)}</b><br>salida <b>${VIZ.fmt(sal(X, Y), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: una neurona como compuerta lógica ---------- */

  const COMPUERTAS = { and: ['AND', [1, 1, -1.5], (a, c) => a & c], or: ['OR', [1, 1, -0.5], (a, c) => a | c], nand: ['NAND', [-1, -1, 1.5], (a, c) => 1 - (a & c)], xor: ['XOR', [1, 1, -0.5], (a, c) => a ^ c] };
  function montarCompuertas(cuerpo) {
    let g = 'and', w = [1, 1, -1.5];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Compuerta objetivo', opciones: Object.entries(COMPUERTAS).map(([k, v]) => [k, v[0]]), valor: g, alCambiar: (v) => { g = v; w = COMPUERTAS[v][1].slice(); sinc(); dibujar(); } });
    const rs = [0, 1, 2].map((j) => ctl.rango({ etiqueta: ['Peso w₁', 'Peso w₂', 'Sesgo b'][j], min: -2, max: 2, paso: 0.1, valor: w[j], formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { w[j] = v; dibujar(); } }));
    const sinc = () => rs.forEach((r, j) => { r.valor = w[j]; });
    ctl.boton('Poner pesos conocidos', () => { w = COMPUERTAS[g][1].slice(); sinc(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 250 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'la neurona acierta', forma: 'cuadro' }, { color: C.s8, texto: 'la neurona falla', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Una neurona de escalón calcula 1 si w₁x₁ + w₂x₂ + b > 0. Con AND, OR y NAND basta una neurona; con XOR ninguna combinación de pesos acierta las cuatro filas. Intente encontrarla.');
    let filas = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      filas = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, c]) => { const z = w[0] * a + w[1] * c + w[2], y = z > 0 ? 1 : 0, t = COMPUERTAS[g][2](a, c); return { a, c, z, y, t, ok: y === t }; });
      const x0 = 14, ancho = Math.min(W - 28, 640), cols = ['x₁', 'x₂', 'z = w·x + b', 'salida', 'objetivo'], cw = ancho / cols.length;
      ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.apagado;
      cols.forEach((t, j) => ctx.fillText(t, x0 + (j + 0.5) * cw, 20));
      filas.forEach((r, i) => {
        const y = 38 + i * 44;
        ctx.fillStyle = VIZ.alfa(r.ok ? C.s6 : C.s8, 0.16); ctx.beginPath(); ctx.roundRect(x0, y, ancho, 38, 6); ctx.fill();
        ctx.strokeStyle = r.ok ? C.s6 : C.s8; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13);
        [r.a, r.c, VIZ.fmt(r.z, 2), r.y, r.t].forEach((v, j) => ctx.fillText(String(v), x0 + (j + 0.5) * cw, y + 19));
      });
      const bien = filas.filter((r) => r.ok).length;
      registro.textContent = bien === 4 ? `La neurona implementa ${COMPUERTAS[g][0]}: acierta las 4 filas.` : `Acierta ${bien} de 4 filas.${g === 'xor' ? ' Ningún par de pesos logra 4: XOR no es linealmente separable.' : ''}`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = filas[Math.floor((y - 38) / 44)];
      if (!r || y < 38) return tip.ocultar();
      tip.mostrar(x, y, `x = (${r.a}, ${r.c})<br>z = ${VIZ.fmt(w[0], 2)}·${r.a} + ${VIZ.fmt(w[1], 2)}·${r.c} + ${VIZ.fmt(w[2], 2)} = <b>${VIZ.fmt(r.z, 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('artificial-neuron', {
    intro: String.raw`
      <p>Una <strong>neurona artificial</strong> es la pieza mínima de una red: recibe números, multiplica cada uno por un <em>peso</em>, suma los resultados con un <em>sesgo</em> (<em>bias</em>) y pasa el total por una función
      de activación. Cada peso dice cuánto importa una entrada; el sesgo, cuán fácil es que la neurona se «encienda».</p>
      <p>Geométricamente, una neurona con dos entradas divide el plano con una recta. Una red es una colección de estas rectas combinadas en capas.</p>`,
    visualizaciones: [
      { titulo: 'Una neurona traza una recta', descripcion: 'Cambie \\(w_1\\), \\(w_2\\) y \\(b\\) y vea girar y desplazarse la frontera. Pulse Reproducir para que la regla del perceptrón la encuentre sola; pruebe con XOR, donde no puede converger.', montar: montarRecta },
      { titulo: 'La neurona como compuerta lógica', descripcion: 'Busque pesos que reproduzcan AND, OR y NAND, y compruebe que XOR es imposible con una sola neurona.', montar: montarCompuertas },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Con entradas \(x \in \mathbb{R}^d\), pesos \(w \in \mathbb{R}^d\) y sesgo \(b\):</p>
      \[ z = w^\top x + b = \sum_{j=1}^{d} w_j x_j + b, \qquad a = \sigma(z). \]
      <p>El perceptrón clásico usa el escalón \(\sigma(z) = \mathbb{1}[z > 0]\); las redes modernas usan <a href="tema.html?id=activation-functions">activaciones suaves</a> para poder derivar.</p>
      <h2>Regla del perceptrón</h2>
      <pre><code>repetir:
    para cada (x, y) en los datos:
        ŷ ← 1 si w·x + b &gt; 0, si no 0
        w ← w + η (y − ŷ) x
        b ← b + η (y − ŷ)
hasta que no haya errores</code></pre>
      <div class="recuadro"><p><strong>Teorema (Rosenblatt, Novikoff).</strong> Si los datos son linealmente separables con margen \(\gamma\) y \(\lVert x\rVert \le R\), el perceptrón comete a lo más \((R/\gamma)^2\) errores y converge.
      Si no lo son (XOR), no converge nunca.</p></div>
      <h2>Límite</h2>
      <p>Una neurona solo representa funciones separables por un hiperplano. XOR exige al menos dos neuronas ocultas: es el motivo de las <a href="tema.html?id=forward-propagation">redes multicapa</a>. Una introducción más amplia está en
      <a href="tema.html?id=neural-networks">Neural Networks</a>.</p>`,
  });
})();
