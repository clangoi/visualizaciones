(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const INITS = [['cero', 'ceros', C.s1, () => 0], ['pequeña', 'pequeña (σ = 0,01)', C.s2, () => 0.01], ['xavier', 'Xavier (σ² = 1/n)', C.s6, () => 1], ['he', 'He (σ² = 2/n)', C.s7, () => Math.SQRT2], ['grande', 'grande (σ = 1)', C.s8, () => 1e9]];
  const N = 100;

  /* ---------- Fig. 1: la señal a través de una pila de capas según la inicialización ---------- */

  function montarSenal(cuerpo) {
    let act = 'tanh', L = 15, semilla = 1, res = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Activación', opciones: ['tanh', 'relu', 'sigmoide'].map((k) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; calcular(); } });
    ctl.rango({ etiqueta: 'Capas', min: 3, max: 30, valor: L, alCambiar: (v) => { L = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, INITS.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, `Pila de capas de ${N} neuronas con pesos aleatorios y 200 entradas de varianza 1. Se mide la desviación de las activaciones en cada capa (escala log). Una buena inicialización la mantiene cerca de una constante; una mala la lleva a cero o a la saturación.`);
    function calcular() {
      const A = DL.ACT[act];
      res = INITS.map(([k]) => {
        const r = VIZ.semilla(semilla * 11 + 5);
        const esc = { cero: 0, pequeña: 0.01, xavier: Math.sqrt(1 / N), he: Math.sqrt(2 / N), grande: 1 }[k];
        let a = Array.from({ length: 200 }, () => Array.from({ length: N }, () => VIZ.normal(r))), out = [];
        for (let l = 0; l < L; l++) {
          const W = Array.from({ length: N }, () => Array.from({ length: N }, () => VIZ.normal(r) * esc));
          a = a.map((x) => W.map((f) => A.f(f.reduce((s, w, i) => s + w * x[i], 0))));
          const fl = a.flat(), mu = fl.reduce((s, v) => s + v, 0) / fl.length;
          out.push(Math.sqrt(fl.reduce((s, v) => s + (v - mu) ** 2, 0) / fl.length));
        }
        return out;
      });
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: L, ymin: 1e-8, ymax: 1e2 }, { logY: true, etiquetaX: 'capa', etiquetaY: 'desviación de las activaciones', formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      res.forEach((s, i) => VIZ.trazar(ctx, pl, s.map((v, l) => [l + 1, Math.max(v, 1e-8)]), INITS[i][2], 2.2));
      if (hover > 0) res.forEach((s, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(Math.max(s[hover - 1], 1e-8)), INITS[i][2], 4));
      ctx.restore();
      const fin = res.map((s) => s[L - 1]);
      registro.textContent = `En la capa ${L}: ${INITS.map(([, t], i) => `${t.split(' ')[0]} → ${fin[i] < 1e-6 ? '≈ 0' : VIZ.fmt(fin[i], 2)}`).join('; ')}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res.length) { hover = -1; tip.ocultar(); return; }
      hover = Math.max(1, Math.min(L, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `capa <b>${hover}</b>` + res.map((s, i) => VIZ.filaTooltip(INITS[i][2], INITS[i][1].split(' (')[0], VIZ.fmt(s[hover - 1], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: entrenar con distintas inicializaciones ---------- */

  function montarEntrenamiento(cuerpo) {
    DL.entrenador(cuerpo, {
      controles: ['datos', 'capas', 'ocultas', 'act', 'init'],
      inicial: { datos: 'lunas', ruido: 0.2, n: 150, ocultas: 8, capas: 4, act: 'tanh', opt: 'sgd', lr: 0.3, lote: 16, init: 'cero' },
      nota: 'Con pesos en cero todas las neuronas de una capa reciben el mismo gradiente y siguen siendo idénticas: la red nunca rompe la simetría. Con σ = 0,01 la señal se apaga; con σ = 3 se satura. Xavier (tanh) y He (ReLU) entrenan.',
    });
  }

  VIZ.registrarTema('weight-initialization', {
    intro: String.raw`
      <p>Antes de entrenar, los pesos de una red tienen que partir de algún valor. Parece un detalle, pero decide si el entrenamiento arranca o no: ceros dejan a todas las neuronas iguales; valores demasiado pequeños apagan la señal en pocas capas; valores demasiado grandes la saturan o la hacen explotar.</p>
      <p>La regla de las inicializaciones modernas (<strong>Xavier</strong>, <strong>He</strong>) es elegir la varianza de los pesos según el número de entradas de la neurona, para que la <em>escala</em> de la señal se conserve de una capa a la siguiente.</p>`,
    visualizaciones: [
      { titulo: 'La señal capa por capa', descripcion: 'Compare cinco inicializaciones. Cambie a ReLU y vea que Xavier se apaga lentamente mientras He se sostiene; con 30 capas la diferencia es enorme.', montar: montarSenal },
      { titulo: 'Entrenar con ceros, pequeños o grandes', descripcion: 'Entrene una red de 4 capas con cada inicialización y compare la pérdida. Observe qué ocurre con ceros.', montar: montarEntrenamiento },
    ],
    teoria: String.raw`
      <h2>Conservar la varianza</h2>
      <p>Para una neurona \(z=\sum_{i=1}^{n} w_i x_i\) con pesos independientes de media 0 y varianza \(\sigma_w^2\), y entradas independientes de media 0 y varianza \(\operatorname{Var}(x)\):</p>
      \[ \operatorname{Var}(z) = n\,\sigma_w^2\,\operatorname{Var}(x). \]
      <p>Para que la varianza no cambie de una capa a otra hace falta \(\sigma_w^2 = 1/n\) (<strong>Xavier/Glorot</strong>, adecuada para tanh y sigmoide cerca de cero). Con ReLU, que anula la mitad de las entradas, la varianza se reduce a la mitad en cada capa, y se corrige con</p>
      \[ \sigma_w^2 = \frac{2}{n} \quad\text{(He)}. \]
      <p>Xavier suele escribirse con el promedio de entradas y salidas, \(\sigma_w^2 = 2/(n_{\text{in}}+n_{\text{out}})\), para conservar también la varianza del gradiente hacia atrás.</p>
      <h2>Qué falla en los otros casos</h2>
      <ul>
        <li><strong>Ceros:</strong> todas las neuronas de una capa calculan lo mismo y reciben el mismo gradiente; nunca se diferencian (simetría). Los <em>sesgos</em> sí pueden iniciarse en cero.</li>
        <li><strong>Muy pequeños:</strong> \(\operatorname{Var}(z)\) se multiplica por \(n\sigma_w^2\ll1\) en cada capa: la señal y el gradiente se desvanecen exponencialmente en la profundidad.</li>
        <li><strong>Muy grandes:</strong> con tanh o sigmoide las neuronas se saturan (derivada ≈ 0); con ReLU, la señal explota.</li>
      </ul>
      <div class="recuadro"><p>La inicialización, <a href="tema.html?id=batch-normalization">Batch Normalization</a> y las conexiones residuales (<a href="tema.html?id=cnn-architectures">ResNet</a>) atacan el mismo problema: mantener estable el flujo de señal y de gradiente en redes muy profundas.</p></div>
      <p>Véase también <a href="tema.html?id=activation-functions">gradientes desvanecientes</a>.</p>`,
  });
})();
