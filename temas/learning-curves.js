(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  /* ---------- Fig. 1: curvas de entrenamiento y validación por época ---------- */

  function montarEpocas(cuerpo) {
    DL.entrenador(cuerpo, {
      controles: ['datos', 'ruido', 'n', 'ocultas', 'lr'],
      inicial: { datos: 'lunas', ruido: 0.35, n: 90, ocultas: 16, capas: 2, act: 'tanh', opt: 'adam', lr: 0.03 },
      nota: 'Diagnóstico: si ambas curvas bajan y se juntan, todo bien; si la de entrenamiento baja y la de validación sube, hay sobreajuste (deténgase donde la validación es mínima); si ambas quedan altas, falta capacidad o entrenamiento; si oscilan, la tasa es demasiado alta.',
      lectura: (st) => { const m = st.hist.reduce((a, q, i) => (q.lv < a[1] ? [i, q.lv] : a), [0, Infinity]); return [['mejor época (validación)', String(st.hist[m[0]].ep)], ['pérdida de validación mínima', VIZ.fmt(m[1], 3)]]; },
    });
  }

  /* ---------- Fig. 2: curvas de aprendizaje según el tamaño del conjunto ---------- */

  const TAMAÑOS = [16, 32, 64, 128, 256, 512];
  function montarTamano(cuerpo) {
    let ocultas = 8, tipo = 'lunas', semilla = 1, filas = [], hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([c]) => ['manchas', 'lunas', 'circulos', 'xor'].includes(c)), valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Capacidad (neuronas ocultas)', min: 1, max: 40, valor: ocultas, alCambiar: (v) => { ocultas = v; calcular(); } });
    ctl.boton('Otros datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'pérdida de entrenamiento', forma: 'linea' }, { color: C.s2, texto: 'pérdida de validación (300 ejemplos aparte)', forma: 'linea' }, { color: C.apagado, texto: 'ruido irreducible aproximado', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una red entrenada desde cero con ese número de ejemplos. Con pocos datos hay una brecha grande (alta varianza); al aumentar los datos se cierra. Si ambas curvas se juntan en un valor alto, más datos no ayudan: hace falta un modelo con más capacidad.');
    const perdida = (r, D) => D.reduce((s, q) => { const p = DL.adelante(r, [q.x, q.y]).y[0]; return s - (q.c * Math.log(p + 1e-12) + (1 - q.c) * Math.log(1 - p + 1e-12)); }, 0) / D.length;
    function calcular() {
      const val = ML.datos(tipo, 300, 0.35, 900 + semilla), todo = ML.datos(tipo, 520, 0.35, 77 + semilla);
      filas = TAMAÑOS.map((n) => {
        const D = todo.slice(0, n), r = DL.red([2, ocultas, 1], { act: 'tanh', semilla: semilla + 3 }), o = DL.optimizador('adam', { lr: 0.03 }), rnd = VIZ.semilla(semilla);
        const ep = 120;
        for (let e = 0; e < ep; e++) { const L = DL.mezclar(DL.pares(D), rnd); for (let i = 0; i < L.length; i += 16) DL.entrenarPaso(r, L.slice(i, i + 16), o); }
        return { n, lt: perdida(r, D), lv: perdida(r, val) };
      });
      dibujar();
    }
    function dibujar() {
      if (!filas.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: Math.log2(16), xmax: Math.log2(512), ymin: 0, ymax: Math.min(2, Math.max(...filas.map((q) => q.lv)) * 1.1) }, { etiquetaX: 'ejemplos de entrenamiento (escala log)', etiquetaY: 'pérdida', ticksX: TAMAÑOS.map(Math.log2), formatoX: (v) => String(Math.round(2 ** v)) });
      pl.ejes();
      VIZ.trazar(ctx, pl, filas.map((q) => [Math.log2(q.n), q.lt]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, filas.map((q) => [Math.log2(q.n), q.lv]), C.s2, 2.5);
      filas.forEach((q) => { VIZ.marcador(ctx, pl.sx(Math.log2(q.n)), pl.sy(q.lt), C.s1, 4); VIZ.marcador(ctx, pl.sx(Math.log2(q.n)), pl.sy(q.lv), C.s2, 4); });
      if (hover != null) { const q = filas[hover]; ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(pl.sx(Math.log2(q.n)), pl.y0); ctx.lineTo(pl.sx(Math.log2(q.n)), pl.y1); ctx.stroke(); }
      const u = filas[filas.length - 1], p = filas[0];
      registro.textContent = `Con ${p.n} ejemplos la brecha es ${VIZ.fmt(p.lv - p.lt, 3)}; con ${u.n}, ${VIZ.fmt(u.lv - u.lt, 3)}. ${u.lv > 0.45 ? 'La validación queda alta: el modelo tiene sesgo, más datos no bastan.' : 'La validación se acerca al entrenamiento: más datos ya aportan poco.'}`;
      lectura.set([['brecha con 16 ejemplos', VIZ.fmt(p.lv - p.lt, 3)], ['brecha con 512 ejemplos', VIZ.fmt(u.lv - u.lt, 3)], ['validación con 512', VIZ.fmt(u.lv, 3)], ['parámetros', String(DL.nParametros([2, ocultas, 1]))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !filas.length) { hover = null; tip.ocultar(); return dibujar(); }
      hover = filas.reduce((m, q, i) => (Math.abs(Math.log2(q.n) - pl.ix(x)) < Math.abs(Math.log2(filas[m].n) - pl.ix(x)) ? i : m), 0); dibujar();
      const q = filas[hover];
      tip.mostrar(x, y, `<b>${q.n}</b> ejemplos` + VIZ.filaTooltip(C.s1, 'entrenamiento', VIZ.fmt(q.lt, 3)) + VIZ.filaTooltip(C.s2, 'validación', VIZ.fmt(q.lv, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('learning-curves', {
    intro: String.raw`
      <p>Una <strong>curva de aprendizaje</strong> grafica cómo evoluciona la pérdida de entrenamiento y la de validación. Es la herramienta de diagnóstico más usada: dice si el modelo necesita más datos, más capacidad, menos capacidad, otra tasa de aprendizaje o parar antes.</p>
      <p>Hay dos formas de leerlas: contra las <em>épocas</em> (¿cuándo detener el entrenamiento?) y contra el <em>tamaño del conjunto</em> (¿conviene conseguir más datos?).</p>`,
    visualizaciones: [
      { titulo: 'Curvas por época', descripcion: 'Entrene y observe las dos curvas. Con 16 neuronas, pocos datos y mucho ruido, verá la validación subir tras un mínimo: es donde convendría detenerse.', montar: montarEpocas },
      { titulo: 'Curvas según el tamaño de los datos', descripcion: 'Con pocas neuronas, las curvas se juntan arriba; con muchas, la brecha es grande al principio y se cierra con datos.', montar: montarTamano },
    ],
    teoria: String.raw`
      <h2>Patrones típicos</h2>
      <table>
        <tr><th>Lo que se ve</th><th>Diagnóstico</th><th>Qué probar</th></tr>
        <tr><td>Entrenamiento alto, validación alta, juntas</td><td>Subajuste (sesgo alto)</td><td>Más capacidad, más épocas, mejores características</td></tr>
        <tr><td>Entrenamiento bajo, validación alta, brecha grande</td><td>Sobreajuste (varianza alta)</td><td>Más datos, <a href="tema.html?id=l1-l2-regularization">regularización</a>, <a href="tema.html?id=dropout">dropout</a>, menos capacidad, detención temprana</td></tr>
        <tr><td>Pérdida errática</td><td>Tasa de aprendizaje alta o lotes ruidosos</td><td>Bajar \(\eta\), subir el tamaño del lote</td></tr>
        <tr><td>Pérdida que no baja desde el inicio</td><td>Inicialización, tasa muy baja, error en los datos</td><td>Ver <a href="tema.html?id=weight-initialization">inicialización</a>; probar con pocos ejemplos hasta sobreajustarlos</td></tr>
      </table>
      <h2>Detención temprana</h2>
      <p>Se guarda el modelo de la época con menor pérdida de validación y se detiene el entrenamiento si no mejora durante \(k\) épocas (<em>paciencia</em>). Es una forma barata de regularización: limita cuánto puede alejarse la red de su inicialización.</p>
      <h2>Curvas según el tamaño</h2>
      <p>Para un modelo fijo, el error de entrenamiento aumenta con \(n\) (hay más que memorizar) y el de validación disminuye, y ambos tienden al mismo límite, el <em>error de Bayes</em> más el sesgo del modelo:</p>
      \[ \mathbb{E}[\text{error de validación}] - \mathbb{E}[\text{error de entrenamiento}] = O\!\left(\sqrt{\frac{\text{capacidad}}{n}}\right). \]
      <div class="recuadro"><p>Si las dos curvas ya se juntaron, conseguir más datos no ayuda; si hay una brecha grande que se cierra al aumentar \(n\), sí. Es la lectura práctica del <a href="tema.html?id=bias-variance">equilibrio entre sesgo y varianza</a>.</p></div>`,
  });
})();
