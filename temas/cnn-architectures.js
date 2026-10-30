(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  // Cifras aproximadas de los artículos originales (ILSVRC, error top-5 en el conjunto de prueba).
  const REDES = [
    { n: 'AlexNet', año: 2012, capas: 8, params: 61, err: 16.4, c: C.s1, idea: 'Cinco capas convolucionales y tres densas, ReLU, dropout y entrenamiento en dos GPU. Inició la era de las CNN profundas.' },
    { n: 'VGG-16', año: 2014, capas: 16, params: 138, err: 7.3, c: C.s2, idea: 'Solo convoluciones de 3×3 apiladas en bloques, con pooling entre bloques. Muy regular, pero con 138 millones de parámetros (la mayoría en las capas densas).' },
    { n: 'Inception (GoogLeNet)', año: 2014, capas: 22, params: 7, err: 6.7, c: C.s3, idea: 'Módulos con ramas paralelas (1×1, 3×3, 5×5, pooling) y convoluciones 1×1 que reducen canales. 7 millones de parámetros: mucho más eficiente.' },
    { n: 'ResNet-152', año: 2015, capas: 152, params: 60, err: 3.6, c: C.s6, idea: 'Conexiones residuales: cada bloque aprende una corrección F(x) que se suma a la entrada, x + F(x). Permitió entrenar más de 100 capas.' },
  ];

  /* ---------- Fig. 1: comparar las arquitecturas ---------- */

  function montarComparacion(cuerpo) {
    let eje = 'params', sel = 3, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Eje horizontal', opciones: [['params', 'parámetros (millones, escala log)'], ['capas', 'profundidad (capas)'], ['año', 'año de la competencia']], valor: eje, alCambiar: (v) => { eje = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, REDES.map((r) => ({ color: r.c, texto: r.n, forma: 'punto' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El tamaño de cada círculo es proporcional a la profundidad. Haga clic en una arquitectura para leer su idea central. Cifras aproximadas de los artículos originales (ILSVRC, error top-5).');
    const X = (r) => (eje === 'params' ? Math.log10(r.params) : eje === 'capas' ? r.capas : r.año);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const dom = eje === 'params' ? { xmin: 0.5, xmax: 2.4 } : eje === 'capas' ? { xmin: 0, xmax: 170 } : { xmin: 2011.5, xmax: 2015.5 };
      const pl = VIZ.plano(lienzo, { ...dom, ymin: 0, ymax: 19 }, { etiquetaX: eje === 'params' ? 'parámetros (millones)' : eje === 'capas' ? 'capas con parámetros' : 'año', etiquetaY: 'error top-5 (%)', formatoX: eje === 'params' ? (v) => VIZ.fmt(10 ** v, 3) : eje === 'año' ? (v) => String(Math.round(v)) : undefined, ticksX: eje === 'params' ? [0.5, 1, 1.5, 2] : eje === 'año' ? [2012, 2013, 2014, 2015] : undefined });
      pl.ejes(); geo = [];
      REDES.forEach((r, i) => {
        const x = pl.sx(X(r)), y = pl.sy(r.err), rad = 6 + Math.sqrt(r.capas) * 1.7;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = VIZ.alfa(r.c, 0.35); ctx.fill();
        ctx.lineWidth = i === sel ? 3.5 : 2; ctx.strokeStyle = r.c; ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, i === sel ? 600 : 400); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(r.n, x, y - rad - 4);
        geo.push({ x, y, rad, r, i });
      });
      const r = REDES[sel];
      registro.textContent = `${r.n}: ${r.idea}`;
      lectura.set([['arquitectura', r.n], ['año', String(r.año)], ['capas', String(r.capas)], ['parámetros', `${VIZ.fmt(r.params, 3)} M`], ['error top-5', `${VIZ.fmt(r.err, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return geo.find((g) => Math.hypot(x - g.x, y - g.y) < g.rad + 4); };
    lienzo.canvas.addEventListener('click', (ev) => { const g = bajo(ev); if (g) { sel = g.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const g = bajo(ev), { x, y } = lienzo.posicion(ev); if (g) tip.mostrar(x, y, `<b>${g.r.n}</b> (${g.r.año})<br>${g.r.capas} capas · ${g.r.params} M parámetros<br>error top-5 ${g.r.err} %`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: por qué las conexiones residuales permiten ir más profundo ---------- */

  function normaProducto(L, escala, residual, semilla) {
    const n = 16, r = VIZ.semilla(semilla * 13 + 1), out = [];
    let v = Array.from({ length: n }, () => VIZ.normal(r)); // gradiente que llega desde la salida
    const nv0 = Math.hypot(...v);
    for (let l = 0; l < L; l++) {
      const G = Array.from({ length: n }, () => Array.from({ length: n }, () => (VIZ.normal(r) * escala) / Math.sqrt(n)));
      const Gv = G.map((f) => f.reduce((s, g, i) => s + g * v[i], 0));
      v = residual ? v.map((x, i) => x + Gv[i]) : Gv;
      out.push(Math.hypot(...v) / nv0);
    }
    return out;
  }

  function montarResidual(cuerpo) {
    let L = 30, escala = 0.8, semilla = 1, hover = -1, pl = null, plano = [], res = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Profundidad (capas)', min: 5, max: 100, valor: L, alCambiar: (v) => { L = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Escala de la transformación por capa', min: 0.2, max: 1.4, paso: 0.05, valor: escala, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { escala = v; dibujar(); } });
    ctl.boton('Otros pesos', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'red sin atajos: g ← J·g', forma: 'linea' }, { color: C.s6, texto: 'red residual: g ← (I + J)·g', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Se retropropaga un gradiente aleatorio por capas con matrices J aleatorias (16×16). Se muestra su norma relativa tras cada capa hacia atrás. La conexión residual suma la identidad, que deja pasar el gradiente intacto aunque J lo encoja.');
    function dibujar() {
      plano = normaProducto(L, escala, false, semilla); res = normaProducto(L, escala, true, semilla);
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: L, ymin: 1e-8, ymax: 1e8 }, { logY: true, etiquetaX: 'capas atravesadas hacia atrás', etiquetaY: 'norma del gradiente (relativa)', formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, plano.map((v, i) => [i + 1, Math.max(v, 1e-8)]), C.s2, 2.5);
      VIZ.trazar(ctx, pl, res.map((v, i) => [i + 1, Math.max(v, 1e-8)]), C.s6, 2.5);
      if (hover > 0) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(plano[hover - 1], 1e-8)), C.s2, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(res[hover - 1], 1e-8)), C.s6, 4); }
      ctx.restore();
      registro.textContent = `Tras ${L} capas, el gradiente de la red sin atajos mide ${VIZ.fmt(plano[L - 1], 2)} veces el original; el de la red residual, ${VIZ.fmt(res[L - 1], 2)} veces.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !plano.length) { hover = -1; tip.ocultar(); return; }
      hover = Math.max(1, Math.min(L, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `capa <b>${hover}</b>` + VIZ.filaTooltip(C.s2, 'sin atajos', VIZ.fmt(plano[hover - 1], 3)) + VIZ.filaTooltip(C.s6, 'residual', VIZ.fmt(res[hover - 1], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('cnn-architectures', {
    intro: String.raw`
      <p>La competencia <em>ImageNet</em> (ILSVRC) empujó entre 2012 y 2015 una carrera de arquitecturas: <strong>AlexNet</strong> mostró que una CNN profunda entrenada con GPU superaba por mucho a los métodos clásicos; <strong>VGG</strong> demostró el poder de apilar convoluciones simples de \(3\times3\);
      <strong>Inception</strong> hizo más con menos parámetros usando ramas paralelas; y <strong>ResNet</strong> permitió entrenar redes de más de cien capas gracias a las conexiones residuales.</p>
      <p>Cada una resolvió un problema concreto: cómo crecer en profundidad sin que el entrenamiento se rompa y sin que el costo se dispare.</p>`,
    visualizaciones: [
      { titulo: 'Cuatro arquitecturas', descripcion: 'Compare error, tamaño y profundidad. Cambie el eje horizontal y busque la que consigue menos error con menos parámetros.', montar: montarComparacion },
      { titulo: 'Por qué funcionan las conexiones residuales', descripcion: 'Aumente la profundidad y reduzca la escala de cada capa: sin atajos el gradiente desaparece; con ellos se conserva.', montar: montarResidual },
    ],
    teoria: String.raw`
      <h2>Las ideas de cada una</h2>
      <table>
        <tr><th>Red</th><th>Idea central</th><th>Efecto</th></tr>
        <tr><td>AlexNet</td><td>ReLU, dropout, GPU, aumento de datos</td><td>Entrenamiento rápido de una red profunda</td></tr>
        <tr><td>VGG</td><td>Bloques de \(3\times3\) apilados: dos de \(3\times3\) ven lo que uno de \(5\times5\) con menos parámetros (\(18C^2\) frente a \(25C^2\))</td><td>Diseño uniforme y fácil de reutilizar</td></tr>
        <tr><td>Inception</td><td>Ramas paralelas \(1\times1\), \(3\times3\), \(5\times5\) y convoluciones \(1\times1\) que reducen canales</td><td>Menos parámetros, múltiples escalas</td></tr>
        <tr><td>ResNet</td><td>\(y = x + F(x)\)</td><td>Gradiente que fluye por el atajo; profundidad de 100+ capas</td></tr>
      </table>
      <h2>El bloque residual</h2>
      <p>En lugar de aprender la transformación completa \(H(x)\), la capa aprende el <em>residuo</em> \(F(x)=H(x)-x\):</p>
      \[ y = x + F(x), \qquad \frac{\partial \mathcal{L}}{\partial x} = \frac{\partial \mathcal{L}}{\partial y}\Big(I + \frac{\partial F}{\partial x}\Big). \]
      <p>El término \(I\) garantiza que el gradiente llegue a las capas iniciales sin importar lo que haga \(F\). Para \(L\) bloques, la derivada total contiene un término que es el producto de identidades: un camino directo de la salida a la entrada.</p>
      <div class="recuadro"><p>Sin atajos, redes de 56 capas entrenaban <em>peor</em> que las de 20 incluso en el conjunto de entrenamiento (problema de <em>degradación</em>). Con atajos, 152 capas mejoran el resultado. La misma idea reaparece en los <a href="tema.html?id=transformer-block">Transformers</a>.</p></div>
      <h2>Convoluciones 1×1</h2>
      <p>Una convolución \(1\times1\) mezcla los canales en cada posición, sin mirar a los vecinos. Reduce \(C_{\text{in}}\) a \(C_{\text{out}}\) canales con solo \(C_{\text{in}}C_{\text{out}}\) parámetros; es el «cuello de botella» que usan Inception y las ResNet profundas.</p>
      <p>Véase <a href="tema.html?id=cnn">Convolutional Neural Networks</a> y <a href="tema.html?id=transfer-learning">Transfer Learning</a> para reutilizar estas redes ya entrenadas.</p>`,
  });
})();
