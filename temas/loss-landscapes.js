(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  const TAM = [2, 6, 1];
  function datosDe(tipo, semilla) { return DL.pares(ML.datos(tipo, 90, 0.25, semilla * 3 + 1)); }
  function perdida(red, D) {
    let s = 0;
    for (const { x, y } of D) { const p = DL.adelante(red, x).y[0]; s -= y[0] * Math.log(p + 1e-12) + (1 - y[0]) * Math.log(1 - p + 1e-12); }
    return s / D.length;
  }
  function entrenar(D, semilla, epocas = 250) {
    const r = DL.red(TAM, { act: 'tanh', semilla }), o = DL.optimizador('adam', { lr: 0.05 }), rnd = VIZ.semilla(semilla);
    const ini = DL.aplanar(r);
    for (let e = 0; e < epocas; e++) { const L = DL.mezclar(D, rnd); for (let i = 0; i < L.length; i += 15) DL.entrenarPaso(r, L.slice(i, i + 15), o); }
    return { red: r, ini, fin: DL.aplanar(r) };
  }
  // Evalúa la pérdida en el vector de parámetros v (sin modificar la red base).
  const evaluar = (red, D, v) => { DL.fijar(red, v); return perdida(red, D); };

  /* ---------- Fig. 1: un corte bidimensional de la superficie ---------- */

  function montarCorte(cuerpo) {
    let tipo = 'lunas', rango = 1, semilla = 1, D = [], S = null, d1 = [], d2 = [], malla = null, pl = null;
    const N = 34;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([c]) => ['manchas', 'lunas', 'circulos', 'xor'].includes(c)), valor: tipo, alCambiar: (v) => { tipo = v; preparar(); } });
    ctl.rango({ etiqueta: 'Alcance del corte', min: 0.3, max: 3, paso: 0.1, valor: rango, formato: (v) => `±${VIZ.fmt(v, 2)}`, alCambiar: (v) => { rango = v; calcular(); } });
    ctl.boton('Otras direcciones', () => { semilla++; direcciones(); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: VIZ.css(VIZ.enRampa(0.05)), texto: 'pérdida baja', forma: 'cuadro' }, { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'pérdida alta', forma: 'cuadro' }, { color: C.s2, texto: 'red entrenada (centro del corte)', forma: 'punto' }, { color: C.tinta, texto: 'curvas de nivel', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `La red tiene ${DL.nParametros(TAM)} parámetros; aquí se ven solo dos direcciones aleatorias que pasan por la solución. Un corte distinto puede mostrar un valle, una meseta o una pared: pulse «Otras direcciones».`);
    function direcciones() {
      const r = VIZ.semilla(semilla * 97 + 5), n = S.fin.length;
      const dir = () => { const v = Array.from({ length: n }, () => VIZ.normal(r)); const nv = Math.hypot(...v), ns = Math.hypot(...S.fin); return v.map((q) => (q / nv) * ns * 0.5); };
      d1 = dir(); d2 = dir();
    }
    function preparar() { D = datosDe(tipo, 1); S = entrenar(D, 3); direcciones(); calcular(); }
    function calcular() {
      const red = DL.red(TAM, { act: 'tanh', semilla: 1 });
      malla = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => {
        const a = (-1 + (2 * j) / (N - 1)) * rango, b = (1 - (2 * i) / (N - 1)) * rango;
        return evaluar(red, D, S.fin.map((v, k) => v + a * d1[k] + b * d2[k]));
      }));
      DL.fijar(red, S.fin); dibujar();
    }
    function dibujar() {
      if (!malla) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -rango, xmax: rango, ymin: -rango, ymax: rango }, { etiquetaX: 'dirección 1', etiquetaY: 'dirección 2' });
      const mx = Math.min(Math.max(...malla.flat()), 3), mn = Math.min(...malla.flat()), cw = (pl.x1 - pl.x0) / N, ch = (pl.y0 - pl.y1) / N;
      malla.forEach((f, i) => f.forEach((v, j) => { ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.min(1, (v - mn) / (mx - mn)))); ctx.fillRect(pl.x0 + j * cw, pl.y1 + i * ch, cw + 0.6, ch + 0.6); }));
      const interp = (x, y) => { const j = Math.max(0, Math.min(N - 1.001, ((x + rango) / (2 * rango)) * (N - 1))), i = Math.max(0, Math.min(N - 1.001, ((rango - y) / (2 * rango)) * (N - 1))); const i0 = Math.floor(i), j0 = Math.floor(j), fi = i - i0, fj = j - j0; return malla[i0][j0] * (1 - fi) * (1 - fj) + malla[i0][j0 + 1] * (1 - fi) * fj + malla[i0 + 1][j0] * fi * (1 - fj) + malla[i0 + 1][j0 + 1] * fi * fj; };
      pl.ejes();
      [0.1, 0.2, 0.4, 0.7, 1.2, 2].forEach((v) => ML.contorno(ctx, pl, interp, v, { color: VIZ.alfa(C.tinta, 0.55), ancho: 1, paso: 6 }));
      VIZ.marcador(ctx, pl.sx(0), pl.sy(0), C.s2, 6);
      const centro = malla[Math.floor(N / 2)][Math.floor(N / 2)];
      registro.textContent = `En el centro la pérdida es ${VIZ.fmt(centro, 3)}; en las esquinas del corte llega a ${VIZ.fmt(Math.max(malla[0][0], malla[0][N - 1], malla[N - 1][0], malla[N - 1][N - 1]), 3)}.`;
      lectura.set([['pérdida en la solución', VIZ.fmt(centro, 3)], ['mínimo del corte', VIZ.fmt(mn, 3)], ['máximo del corte', VIZ.fmt(Math.max(...malla.flat()), 3)], ['parámetros', String(DL.nParametros(TAM))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !malla) return tip.ocultar();
      const j = Math.min(N - 1, Math.floor(((x - pl.x0) / (pl.x1 - pl.x0)) * N)), i = Math.min(N - 1, Math.floor(((y - pl.y1) / (pl.y0 - pl.y1)) * N));
      tip.mostrar(x, y, `pérdida <b>${VIZ.fmt(malla[i][j], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
  }

  /* ---------- Fig. 2: la pérdida a lo largo de un segmento entre dos soluciones ---------- */

  function montarSegmento(cuerpo) {
    let camino = 'ini', tipo = 'xor', semilla = 1, perfil = [], hover = null, pl = null, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Segmento', opciones: [['ini', 'inicialización → solución'], ['dos', 'solución A → solución B (otra semilla)']], valor: camino, alCambiar: (v) => { camino = v; calcular(); } });
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([c]) => ['manchas', 'lunas', 'circulos', 'xor'].includes(c)), valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.boton('Otra semilla', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'pérdida en θ(α) = (1−α)·θ_inicio + α·θ_fin', forma: 'linea' }, { color: C.s6, texto: 'extremos (α = 0 y α = 1)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Entre la inicialización y la solución la pérdida suele bajar sin barreras. Entre dos soluciones distintas puede haber una barrera: promediar los pesos de dos redes entrenadas por separado no da una buena red.');
    function calcular() {
      D = datosDe(tipo, 1);
      const A = entrenar(D, 3 + semilla * 2), B = entrenar(D, 100 + semilla * 5);
      const [u, v] = camino === 'ini' ? [A.ini, A.fin] : [A.fin, B.fin];
      const red = DL.red(TAM, { act: 'tanh', semilla: 1 });
      perfil = Array.from({ length: 61 }, (_, i) => { const a = -0.3 + (1.6 * i) / 60; return [a, evaluar(red, D, u.map((q, k) => (1 - a) * q + a * v[k]))]; });
      dibujar();
    }
    function dibujar() {
      if (!perfil.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -0.3, xmax: 1.3, ymin: 0, ymax: Math.min(3, Math.max(...perfil.map((q) => q[1])) * 1.05) }, { etiquetaX: 'α', etiquetaY: 'pérdida' });
      pl.ejes();
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, perfil, C.s1, 2.5);
      ctx.restore();
      const en = (a) => perfil.reduce((m, q) => (Math.abs(q[0] - a) < Math.abs(m[0] - a) ? q : m));
      [0, 1].forEach((a) => VIZ.marcador(ctx, pl.sx(a), pl.sy(Math.min(en(a)[1], 3)), C.s6, 6));
      if (hover != null) { const q = en(hover); VIZ.marcador(ctx, pl.sx(q[0]), pl.sy(Math.min(q[1], 3)), C.s1, 4); }
      const dentro = perfil.filter((q) => q[0] >= 0 && q[0] <= 1), extremo = Math.max(en(0)[1], en(1)[1]), barrera = Math.max(...dentro.map((q) => q[1])) - extremo;
      registro.textContent = barrera > 0.15 ? `Hay una barrera de ${VIZ.fmt(barrera, 3)} entre los dos extremos: el camino recto sube antes de bajar.` : 'No hay barrera: la pérdida baja (casi) monótonamente de un extremo al otro.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = pl.ix(x); dibujar();
      const q = perfil.reduce((m, r) => (Math.abs(r[0] - hover) < Math.abs(m[0] - hover) ? r : m));
      tip.mostrar(x, y, `α = <b>${VIZ.fmt(q[0], 2)}</b><br>pérdida <b>${VIZ.fmt(q[1], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('loss-landscapes', {
    intro: String.raw`
      <p>La pérdida de una red es una función de todos sus parámetros: una «superficie» con millones de dimensiones. No podemos verla entera, pero sí <strong>cortarla</strong>: elegir dos direcciones, moverse en ese plano y medir la pérdida en cada punto.</p>
      <p>Esos cortes muestran por qué entrenar es difícil —valles estrechos, mesetas, puntos de silla— y por qué a veces funciona tan bien: en alta dimensión, la mayoría de los puntos críticos son sillas y muchos mínimos tienen pérdidas parecidas.</p>`,
    visualizaciones: [
      { titulo: 'Un corte de la superficie de pérdida', descripcion: 'Se entrena una red pequeña y se mide la pérdida sobre un plano que pasa por la solución. Cambie las direcciones y el alcance, y compare las formas.', montar: montarCorte },
      { titulo: 'La pérdida a lo largo de un segmento', descripcion: 'Camine en línea recta de la inicialización a la solución, o de una solución a otra, y compruebe si hay barreras.', montar: montarSegmento },
    ],
    teoria: String.raw`
      <h2>Curvatura y puntos críticos</h2>
      <p>En un punto crítico \(\nabla\mathcal{L}(\theta^*)=0\), la matriz hessiana \(H=\nabla^2\mathcal{L}(\theta^*)\) clasifica el punto según sus valores propios \(\lambda_1\le\dots\le\lambda_P\):</p>
      <ul>
        <li>todos positivos: <strong>mínimo</strong> local;</li>
        <li>todos negativos: <strong>máximo</strong>;</li>
        <li>mezcla de signos: <strong>punto de silla</strong>.</li>
      </ul>
      <p>Para \(P\) grande y valores propios «aleatorios», la probabilidad de que todos sean positivos es minúscula: los puntos críticos de alta pérdida son casi siempre sillas, de las que el gradiente escapa; los mínimos locales están, en cambio, a pérdidas similares a la del mínimo global.</p>
      <h2>Cómo se hace un corte</h2>
      <p>Dados una solución \(\theta^*\) y dos direcciones aleatorias \(\delta,\eta\) (normalizadas respecto de la norma de los pesos), se grafica</p>
      \[ g(a,b)=\mathcal{L}(\theta^*+a\,\delta+b\,\eta). \]
      <p>Para comparar dos soluciones se usa la interpolación lineal \(\theta(\alpha)=(1-\alpha)\theta_A+\alpha\theta_B\). Que la pérdida sea casi monótona entre la inicialización y la solución (Goodfellow et al.) sugiere que el optimizador no necesita rodear grandes obstáculos.</p>
      <div class="recuadro"><p>Una barrera entre dos soluciones no implica que sean mínimos distintos para siempre; muchas veces existe un camino curvo sin barrera entre ellas (<em>mode connectivity</em>). Además, la simetría de las neuronas hace que permutarlas produzca otra solución equivalente.</p></div>
      <p>Las trayectorias sobre estas superficies se estudian en <a href="tema.html?id=adaptive-optimizers">Adaptive Optimizers</a>; el cálculo del gradiente, en <a href="tema.html?id=backpropagation">Backpropagation</a>.</p>`,
  });
})();
