(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  /* ---------- Fig. 1: memorizar los ejemplos frente a resumirlos en parámetros ---------- */

  function montarMemoria(cuerpo) {
    let tipo = 'lunas', k = 5, n = 80, semilla = 1, tr = [], va = [], consulta = null, pl = null, fk = null, fl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([c]) => c !== 'tres'), valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Vecinos k', min: 1, max: 25, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ejemplos guardados', min: 20, max: 200, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2), { color: C.inactivo, texto: 'hueco: dato de validación', forma: 'punto' }, { color: C.tinta, texto: 'frontera de k-NN', forma: 'linea' }, { color: C.s3, texto: 'frontera de la regresión logística', forma: 'linea' }, { color: C.s4, texto: 'vecinos de la consulta', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el plano para hacer una consulta: k-NN mide su distancia a todos los ejemplos guardados. La regresión logística, en cambio, ya no necesita los datos: bastan sus tres parámetros.');
    function calcular() {
      const p = ML.partir(ML.datos(tipo, n, 0.35, semilla * 11), 0.7, semilla);
      tr = p.entrenamiento; va = p.validacion;
      fk = DL.knn(tr, k); fl = DL.logistica(tr);
      dibujar();
    }
    function dibujar() {
      if (!fk) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = ML.plano(lienzo);
      pl.ejes();
      ctx.save(); pl.recortar();
      ML.regiones(ctx, pl, fk, { paso: 7 });
      ML.contorno(ctx, pl, fk, 0.5, { color: C.tinta, ancho: 2 });
      ML.contorno(ctx, pl, fl, 0.5, { color: C.s3, ancho: 2.5, guiones: [6, 4] });
      ctx.restore();
      ML.puntos(ctx, pl, tr);
      ML.puntos(ctx, pl, va, { hueco: () => true });
      let msg = 'Haga clic para hacer una consulta.';
      if (consulta) {
        const v = tr.map((q) => ({ q, d: Math.hypot(q.x - consulta.x, q.y - consulta.y) })).sort((a, b) => a.d - b.d).slice(0, k);
        ctx.save(); ctx.strokeStyle = C.s4; ctx.lineWidth = 2;
        for (const { q } of v) { ctx.beginPath(); ctx.moveTo(pl.sx(consulta.x), pl.sy(consulta.y)); ctx.lineTo(pl.sx(q.x), pl.sy(q.y)); ctx.stroke(); }
        ctx.restore();
        VIZ.marcador(ctx, pl.sx(consulta.x), pl.sy(consulta.y), C.tinta, 7, 6);
        const p1 = v.filter((e) => e.q.c === 1).length / v.length;
        msg = `Consulta: ${v.length} de los ${tr.length} ejemplos votan; ${VIZ.fmt(100 * p1, 3)} % pertenece a la clase 1. Se calcularon ${tr.length} distancias.`;
      }
      registro.textContent = msg;
      lectura.set([
        ['k-NN: exactitud en validación', `${VIZ.fmt(100 * DL.acierto(va, fk), 3)} %`],
        ['logística: exactitud en validación', `${VIZ.fmt(100 * DL.acierto(va, fl), 3)} %`],
        ['k-NN guarda', `${tr.length} ejemplos`],
        ['logística guarda', '3 parámetros'],
        ['distancias por consulta', String(tr.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (pl && pl.dentro(x, y)) { consulta = { x: pl.ix(x), y: pl.iy(y) }; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      tip.mostrar(x, y, `(${VIZ.fmt(pl.ix(x), 2)}, ${VIZ.fmt(pl.iy(y), 2)})<br>k-NN: P(1) = <b>${VIZ.fmt(fk(pl.ix(x), pl.iy(y)), 2)}</b><br>logística: P(1) = <b>${VIZ.fmt(fl(pl.ix(x), pl.iy(y)), 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: cuánto cuesta cada predicción ---------- */

  function montarCosto(cuerpo) {
    let d = 10, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dimensión d', min: 2, max: 100, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['k-NN por fuerza bruta: n·d', C.s2, (n) => n * d], ['k-NN con árbol k-d (d pequeña): d·log₂ n', C.s1, (n) => d * Math.log2(n)], ['modelo paramétrico: d', C.s6, () => d]];
    VIZ.leyenda(cuerpo, SER.map(([t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las dos escalas son logarítmicas. La fuerza bruta crece con el tamaño del conjunto de entrenamiento; un modelo ajustado cuesta lo mismo con 100 ejemplos que con un millón.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 10, xmax: 1e6, ymin: 1, ymax: 1e8 }, { logY: true, etiquetaX: 'ejemplos de entrenamiento n (escala log)', etiquetaY: 'operaciones por predicción', formatoY: (v) => (v >= 1000 ? `10^${Math.round(Math.log10(v))}` : String(v)), ticksX: [10, 100, 1e3, 1e4, 1e5, 1e6] });
      pl.ejes();
      const pts = (f) => Array.from({ length: 60 }, (_, i) => { const n = 10 * 10 ** (i / 12); return [n, f(n)]; });
      SER.forEach(([, c, f]) => VIZ.trazar(ctx, pl, pts(f), c, 2));
      if (hover) SER.forEach(([, c, f]) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(f(hover)), c, 4));
      lectura.set([['con n = 10⁶ (fuerza bruta)', VIZ.entero(1e6 * d)], ['con n = 10⁶ (modelo)', VIZ.entero(d)], ['cociente', `${VIZ.entero(1e6)}×`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(10, pl.ix(x));
      dibujar();
      tip.mostrar(x, y, `n = <b>${VIZ.entero(hover)}</b>` + SER.map(([t, c, f]) => VIZ.filaTooltip(c, t.split(':')[0], VIZ.entero(f(hover)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('instance-based-learning', {
    intro: String.raw`
      <p>En el aprendizaje <strong>basado en instancias</strong> el modelo no es una fórmula: son los propios ejemplos. Para predecir, se busca en la memoria cuáles se parecen más al dato nuevo y se imita lo que les pasó a ellos.
      También se le llama aprendizaje <em>perezoso</em> (<em>lazy</em>): no hay fase de entrenamiento, el trabajo se aplaza hasta la consulta.</p>
      <p>Esto da una frontera muy flexible, pero tiene un precio: hay que guardar todos los datos y cada predicción cuesta tanto como recorrerlos. Un modelo <em>paramétrico</em>, como una red, hace lo contrario: gasta tiempo al entrenar y luego predice casi gratis.</p>`,
    visualizaciones: [
      { titulo: 'Memorizar frente a resumir', descripcion: 'Compare la frontera de k-NN con la de una regresión logística. Pruebe «Dos lunas» con \\(k = 1\\) y con \\(k = 25\\), y haga clic para ver qué ejemplos votan.', montar: montarMemoria },
      { titulo: 'El costo de cada predicción', descripcion: 'Mueva la dimensión y recorra la curva: la fuerza bruta cuesta \\(n\\cdot d\\) operaciones por consulta; un modelo ajustado, solo \\(d\\).', montar: montarCosto },
    ],
    teoria: String.raw`
      <h2>El predictor</h2>
      <p>Dado un conjunto \(\mathcal{D} = \{(x_i, y_i)\}_{i=1}^n\) y una distancia \(d\), el predictor de los \(k\) vecinos más cercanos para un dato nuevo \(x\) es</p>
      \[ \hat y(x) = \operatorname*{arg\,max}_{c} \sum_{i \in N_k(x)} \mathbb{1}[y_i = c], \qquad N_k(x) = \text{los } k \text{ índices con menor } d(x, x_i). \]
      <p>En regresión se promedia: \(\hat y(x) = \frac{1}{k}\sum_{i \in N_k(x)} y_i\). Con \(k = 1\) la frontera pasa entre cada par de vecinos de distinta clase (diagrama de Voronoi) y el error de entrenamiento es cero.</p>
      <h2>Costos</h2>
      <table>
        <tr><th></th><th>Entrenar</th><th>Memoria</th><th>Predecir una consulta</th></tr>
        <tr><td>Basado en instancias (fuerza bruta)</td><td>\(O(1)\)</td><td>\(O(nd)\)</td><td>\(O(nd)\)</td></tr>
        <tr><td>Con <a href="tema.html?id=kd-tree">árbol k-d</a> (\(d\) pequeña)</td><td>\(O(n\log n)\)</td><td>\(O(nd)\)</td><td>\(O(\log n)\) en promedio</td></tr>
        <tr><td>Paramétrico (\(p\) parámetros)</td><td>\(O(\text{iteraciones}\cdot n\cdot p)\)</td><td>\(O(p)\)</td><td>\(O(p)\)</td></tr>
      </table>
      <div class="recuadro"><p>Cuando \(d\) crece, los árboles dejan de ayudar y todas las distancias se parecen entre sí: es la <a href="tema.html?id=curse-of-dimensionality">maldición de la dimensionalidad</a>. Ahí conviene aprender primero una representación compacta, que es precisamente lo que hace el aprendizaje profundo.</p></div>
      <h2>Conexiones</h2>
      <p>La página <a href="tema.html?id=knn">k-Nearest Neighbors</a> estudia el efecto de \(k\); <a href="tema.html?id=feature-spaces-distances">Feature Spaces &amp; Distances</a> muestra que el resultado depende de cómo se mide la cercanía.</p>`,
  });
})();
