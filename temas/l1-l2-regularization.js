(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  /* ---------- Fig. 1: la red sobreajusta y la penalización la frena ---------- */

  function montarRed(cuerpo) {
    DL.entrenador(cuerpo, {
      controles: ['datos', 'ruido', 'ocultas', 'l2', 'l1'],
      inicial: { datos: 'lunas', ruido: 0.4, n: 70, ocultas: 24, capas: 1, act: 'tanh', opt: 'adam', lr: 0.05, l2: 0, l1: 0 },
      nota: 'Con 24 neuronas y pocos datos ruidosos, la red memoriza: la pérdida de entrenamiento cae y la de validación sube. Suba λ (L2) a 0,02–0,05 y la frontera se suaviza; pruebe también L1.',
      lectura: (st) => { const w = DL.aplanar(st.red); return [['‖θ‖² (suma de cuadrados)', VIZ.fmt(w.reduce((s, v) => s + v * v, 0), 3)], ['parámetros casi cero (|θ| < 0,01)', `${w.filter((v) => Math.abs(v) < 0.01).length} de ${w.length}`]]; },
    });
  }

  /* ---------- Fig. 2: la geometría de la penalización ---------- */

  // Minimiza ½(w−c)ᵀA(w−c) + λ‖w‖ₚ (p = 1 por descenso por coordenadas con umbral blando; p = 2 en forma cerrada).
  function resolver(A, c, lam, p) {
    if (p === 2) { // (A + λI) w = A c
      const M = [[A[0][0] + lam, A[0][1]], [A[1][0], A[1][1] + lam]], r = [A[0][0] * c[0] + A[0][1] * c[1], A[1][0] * c[0] + A[1][1] * c[1]];
      return ML.resolver(M, r);
    }
    const w = c.slice(), blando = (z, t) => Math.sign(z) * Math.max(0, Math.abs(z) - t);
    for (let it = 0; it < 300; it++) {
      for (let j = 0; j < 2; j++) { const o = 1 - j, resto = A[j][o] * (w[o] - c[o]); w[j] = blando(c[j] - resto / A[j][j], lam / A[j][j]); }
    }
    return w;
  }

  function montarGeometria(cuerpo) {
    let p = 1, lam = 0.8, rho = 0.6, hover = null, pl = null;
    const c = [1.6, 0.7];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Penalización', opciones: [['1', 'L1 (valor absoluto)'], ['2', 'L2 (cuadrados)']], valor: String(p), alCambiar: (v) => { p = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Fuerza λ', min: 0, max: 4, paso: 0.05, valor: lam, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { lam = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Correlación entre parámetros', min: -0.8, max: 0.8, paso: 0.05, valor: rho, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { rho = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'curvas de nivel de la pérdida de datos', forma: 'linea' }, { color: C.s2, texto: 'región permitida (‖w‖ₚ ≤ radio de la solución)', forma: 'linea' }, { color: C.s1, texto: 'camino de las soluciones al subir λ', forma: 'linea' }, { color: C.s6, texto: 'sin penalización (mínimo de los datos)', forma: 'punto' }, { color: C.tinta, texto: 'solución con penalización', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las elipses son la pérdida de datos; el rombo (L1) o el círculo (L2) es la región que la penalización permite. La solución es donde se tocan. El rombo tiene vértices sobre los ejes: allí un parámetro vale exactamente cero. Pase el cursor para leer la pérdida.');
    const mat = () => [[1, rho * Math.sqrt(2.2)], [rho * Math.sqrt(2.2), 2.2]];
    function dibujar() {
      const { ctx } = lienzo, A = mat();
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -1, xmax: 2.4, ymin: -1.4, ymax: 1.6 }, { etiquetaX: 'w₁', etiquetaY: 'w₂' });
      pl.ejes();
      const perdida = (x, y) => { const d = [x - c[0], y - c[1]]; return 0.5 * (d[0] * (A[0][0] * d[0] + A[0][1] * d[1]) + d[1] * (A[1][0] * d[0] + A[1][1] * d[1])); };
      ctx.save(); pl.recortar();
      [0.1, 0.35, 0.8, 1.5, 2.5, 4].forEach((v) => ML.contorno(ctx, pl, perdida, v, { color: C.eje, ancho: 1.4, paso: 5 }));
      const lams = Array.from({ length: 81 }, (_, i) => (i / 80) * 4);
      const ruta = lams.map((l) => resolver(A, c, l, p));
      VIZ.trazar(ctx, pl, ruta, C.s1, 2);
      const w = resolver(A, c, lam, p), r = p === 1 ? Math.abs(w[0]) + Math.abs(w[1]) : Math.hypot(w[0], w[1]);
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.beginPath();
      if (p === 1) { ctx.moveTo(pl.sx(r), pl.sy(0)); ctx.lineTo(pl.sx(0), pl.sy(r)); ctx.lineTo(pl.sx(-r), pl.sy(0)); ctx.lineTo(pl.sx(0), pl.sy(-r)); ctx.closePath(); }
      else ctx.ellipse(pl.sx(0), pl.sy(0), Math.abs(pl.sx(r) - pl.sx(0)), Math.abs(pl.sy(r) - pl.sy(0)), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      VIZ.marcador(ctx, pl.sx(c[0]), pl.sy(c[1]), C.s6, 6);
      VIZ.marcador(ctx, pl.sx(w[0]), pl.sy(w[1]), C.tinta, 6);
      const ceros = w.filter((v) => Math.abs(v) < 1e-6).length;
      registro.textContent = ceros ? `Con λ = ${VIZ.fmt(lam, 2)} la penalización L1 anula ${ceros} parámetro: el modelo se vuelve disperso.` : `Con λ = ${VIZ.fmt(lam, 2)} ambos parámetros se encogen hacia el origen (w = ${VIZ.fmt(w[0], 2)}, ${VIZ.fmt(w[1], 2)}) pero ninguno llega a cero.`;
      lectura.set([['w₁', VIZ.fmt(w[0], 3)], ['w₂', VIZ.fmt(w[1], 3)], ['parámetros exactamente cero', String(ceros)], ['pérdida de datos', VIZ.fmt(perdida(...w), 3)], [p === 1 ? '‖w‖₁' : '‖w‖₂', VIZ.fmt(r, 3)]]);
      hover = A;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const A = mat(), d = [pl.ix(x) - c[0], pl.iy(y) - c[1]];
      tip.mostrar(x, y, `(${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})<br>pérdida de datos <b>${VIZ.fmt(0.5 * (d[0] * (A[0][0] * d[0] + A[0][1] * d[1]) + d[1] * (A[1][0] * d[0] + A[1][1] * d[1])), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('l1-l2-regularization', {
    intro: String.raw`
      <p>Una red con muchos parámetros puede ajustar el ruido de los datos de entrenamiento. La <strong>regularización</strong> añade a la pérdida un término que castiga los pesos grandes, de modo que la red solo los use cuando valga la pena.</p>
      <p>La penalización <strong>L2</strong> (<em>weight decay</em>) suma el cuadrado de los pesos y los encoge de forma pareja; la <strong>L1</strong> suma sus valores absolutos y tiende a dejar muchos pesos <em>exactamente</em> en cero.</p>`,
    visualizaciones: [
      { titulo: 'Una red que memoriza', descripcion: 'Entrene con \\(\\lambda=0\\) y observe cómo diverge la pérdida de validación; luego active L2 o L1 y compare. Mire cuántos parámetros quedan cerca de cero.', montar: montarRed },
      { titulo: 'Por qué L1 produce ceros', descripcion: 'Mueva \\(\\lambda\\) y la correlación y vea dónde toca la elipse al rombo o al círculo. El rombo suele tocar en un vértice, sobre un eje.', montar: montarGeometria },
    ],
    teoria: String.raw`
      <h2>La pérdida regularizada</h2>
      \[ \tilde{\mathcal{L}}(\theta) = \mathcal{L}(\theta) + \lambda\,\Omega(\theta), \qquad \Omega_{L2}(\theta)=\tfrac12\lVert\theta\rVert_2^2,\quad \Omega_{L1}(\theta)=\lVert\theta\rVert_1. \]
      <p>El gradiente de la parte L2 es \(\lambda\theta\), así que cada paso de descenso es</p>
      \[ \theta \leftarrow \theta - \eta\big(\nabla\mathcal{L} + \lambda\theta\big) = (1-\eta\lambda)\,\theta - \eta\nabla\mathcal{L}, \]
      <p>es decir, un <em>decaimiento</em> de los pesos antes de aplicar el gradiente. El de la parte L1 es \(\lambda\,\operatorname{signo}(\theta)\): una fuerza constante hacia cero, sin importar el tamaño del peso.</p>
      <h2>Dos interpretaciones</h2>
      <ul>
        <li><strong>Restricción:</strong> minimizar \(\tilde{\mathcal{L}}\) equivale a minimizar \(\mathcal{L}\) sujeto a \(\Omega(\theta)\le r\) para algún \(r\) que depende de \(\lambda\). La figura muestra esa región: un círculo (L2) o un rombo (L1).</li>
        <li><strong>Bayesiana:</strong> L2 equivale a un <em>prior</em> gaussiano \(\theta_i\sim\mathcal{N}(0,1/\lambda)\) y L1 a uno de Laplace; el resultado es la solución <em>MAP</em> (máximo a posteriori).</li>
      </ul>
      <h2>Por qué L1 da dispersión</h2>
      <p>En una coordenada, con \(\mathcal{L}\) cuadrática de curvatura \(a\) y mínimo en \(c\), la solución con L1 es el <em>umbral blando</em></p>
      \[ \hat w = \operatorname{signo}(c)\,\max\!\big(0,\;|c| - \lambda/a\big), \]
      <p>que vale exactamente cero si \(|c| \le \lambda/a\). Con L2, en cambio, \(\hat w = c\,a/(a+\lambda)\): se encoge, pero nunca se anula.</p>
      <div class="recuadro"><p>L2 es la regularización por omisión en redes profundas (con AdamW se aplica como decaimiento desacoplado). L1 se usa cuando se desea poda o selección de variables. Otras formas de regularizar sin añadir términos: <a href="tema.html?id=dropout">Dropout</a>, detención temprana y más datos.</p></div>
      <p>Véase también <a href="tema.html?id=generalization-splits">Generalization &amp; Train/Test Splits</a> y <a href="tema.html?id=bias-variance">Bias–Variance Tradeoff</a>.</p>`,
  });
})();
