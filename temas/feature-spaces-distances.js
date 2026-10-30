(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl, ML = VIZ.ml;

  const METRICAS = [
    ['l2', 'Euclidiana (L2)', (a, b) => Math.hypot(a.x - b.x, a.y - b.y)],
    ['l1', 'Manhattan (L1)', (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)],
    ['linf', 'Chebyshev (L∞)', (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))],
    ['coseno', 'Coseno (ángulo)', (a, b) => { const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y); return na && nb ? 1 - (a.x * b.x + a.y * b.y) / (na * nb) : 1; }],
  ];

  /* ---------- Fig. 1: la forma de la «bola» de vecinos ---------- */

  function montarMetricas(cuerpo) {
    let metrica = 'l2', k = 6, semilla = 1, pts = [], q = { x: 0.15, y: 0.1 }, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Distancia', opciones: METRICAS.map(([c, t]) => [c, t]), valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Vecinos k', min: 1, max: 20, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Nuevos puntos', () => { semilla++; generar(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.inactivo, texto: 'ejemplo', forma: 'punto' }, { color: C.s4, texto: 'vecino más cercano (k)', forma: 'punto' }, { color: C.s2, texto: 'consulta y frontera del k-ésimo vecino', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para mover la consulta. La línea naranja marca todos los puntos a la misma distancia del k-ésimo vecino: un círculo, un rombo, un cuadrado o, con el coseno, un par de rayos desde el origen.');
    function generar() { const r = VIZ.semilla(semilla); pts = Array.from({ length: 70 }, () => ({ x: r() * 2 - 1, y: r() * 2 - 1, c: 0 })); }
    const dist = () => METRICAS.find(([c]) => c === metrica)[2];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = ML.plano(lienzo);
      pl.ejes();
      const f = dist();
      const orden = pts.map((p, i) => ({ i, d: f(q, p) })).sort((a, b) => a.d - b.d);
      const radio = orden[k - 1].d;
      ctx.save(); pl.recortar();
      // Región a distancia ≤ radio (se pinta celda por celda para cualquier métrica).
      ctx.fillStyle = VIZ.alfa(C.s2, 0.1);
      for (let px = pl.x0; px < pl.x1; px += 5) for (let py = pl.y1; py < pl.y0; py += 5) if (f(q, { x: pl.ix(px + 2.5), y: pl.iy(py + 2.5) }) <= radio) ctx.fillRect(px, py, 5, 5);
      ML.contorno(ctx, pl, (x, y) => radio - f(q, { x, y }), 0, { color: C.s2, ancho: 2 });
      if (metrica === 'coseno') { ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.sy(0)); ctx.lineTo(pl.sx(q.x * 8), pl.sy(q.y * 8)); ctx.stroke(); }
      ctx.restore();
      const vec = new Set(orden.slice(0, k).map((e) => e.i));
      pts.forEach((p, i) => VIZ.marcador(ctx, pl.sx(p.x), pl.sy(p.y), vec.has(i) ? C.s4 : C.inactivo, vec.has(i) ? 5 : 3.5));
      VIZ.marcador(ctx, pl.sx(q.x), pl.sy(q.y), C.s2, 7, 6);
      registro.textContent = `Con ${METRICAS.find(([c]) => c === metrica)[1]} los ${k} vecinos más cercanos están a distancia ≤ ${VIZ.fmt(radio, 3)}.`;
      const otros = METRICAS.filter(([c]) => c !== metrica).map(([c, t, g]) => { const o2 = pts.map((p, i) => ({ i, d: g(q, p) })).sort((a, b) => a.d - b.d).slice(0, k).map((e) => e.i); return [`vecinos en común con ${t.split(' ')[0]}`, `${o2.filter((i) => vec.has(i)).length} de ${k}`]; });
      lectura.set([['radio del k-ésimo vecino', VIZ.fmt(radio, 3)], ...otros]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); if (pl && pl.dentro(x, y)) { q = { x: pl.ix(x), y: pl.iy(y) }; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const j = pl ? ML.cercano(pl, pts, x, y) : -1;
      if (j < 0) return tip.ocultar();
      tip.mostrar(x, y, `(${VIZ.fmt(pts[j].x, 2)}, ${VIZ.fmt(pts[j].y, 2)})<br>distancia a la consulta <b>${VIZ.fmt(dist()(q, pts[j]), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
    dibujar();
  }

  /* ---------- Fig. 2: la escala de cada característica decide quién manda ---------- */

  const ESC = Array.from({ length: 25 }, (_, i) => 10 ** (-2 + i / 6));
  function montarEscala(cuerpo) {
    let tipo = 'lunas', e = 1, semilla = 1, pts = [], acc = [], pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: ML.DATOS.filter(([c]) => ['manchas', 'lunas', 'circulos', 'xor'].includes(c)), valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Escala de x₂ (log₁₀)', min: -2, max: 2, paso: 0.1, valor: 0, formato: (v) => VIZ.fmt(10 ** v, 3), alCambiar: (v) => { e = 10 ** v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 360 });
    const l2 = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [...ML.leyendaClases(2), { color: C.s1, texto: 'exactitud de 5-NN (validación cruzada dejando uno fuera)', forma: 'linea' }, { color: C.s2, texto: 'escala elegida', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'A la izquierda los datos tal como los «ve» la distancia al multiplicar x₂ por la escala; a la derecha, la exactitud de 5-NN para cada escala. Con escalas extremas una sola característica decide y la exactitud cae.');
    function exactitud(s) {
      let ok = 0;
      for (let i = 0; i < pts.length; i++) {
        const d = pts.map((p, j) => [j === i ? Infinity : (p.x - pts[i].x) ** 2 + ((p.y - pts[i].y) * s) ** 2, p.c]).sort((a, b) => a[0] - b[0]).slice(0, 5);
        if ((d.reduce((t, v) => t + v[1], 0) / 5 > 0.5 ? 1 : 0) === pts[i].c) ok++;
      }
      return ok / pts.length;
    }
    function calcular() { pts = ML.datos(tipo, 100, 0.25, semilla * 5); acc = ESC.map(exactitud); dibujar(); }
    function dibujar() {
      if (!pts.length) return;
      {
        const { ctx } = l1;
        l1.limpiar();
        // Las coordenadas que mide la distancia: x₁ y x₂·e.
        const ymax = Math.max(1.2, 1.15 * e);
        const p = VIZ.plano(l1, { xmin: -1.15, xmax: 1.15, ymin: -ymax, ymax: ymax }, { etiquetaX: 'x₁', etiquetaY: 'x₂ · escala' });
        p.ejes();
        ctx.save(); p.recortar();
        pts.forEach((q) => VIZ.marcador(ctx, p.sx(q.x), p.sy(q.y * e), ML.CLASES[q.c], 4, q.c));
        ctx.restore();
      }
      {
        const { ctx } = l2;
        l2.limpiar();
        pl = VIZ.plano(l2, { xmin: -2, xmax: 2, ymin: 0.3, ymax: 1 }, { etiquetaX: 'escala de x₂ (potencia de 10)', etiquetaY: 'exactitud', formatoX: (v) => `10^${v}`, formatoY: (v) => `${Math.round(v * 100)} %` });
        pl.ejes();
        VIZ.trazar(ctx, pl, ESC.map((s, i) => [Math.log10(s), acc[i]]), C.s1, 2);
        const a = exactitud(e);
        VIZ.marcador(ctx, pl.sx(Math.log10(e)), pl.sy(a), C.s2, 6);
        const mejor = acc.reduce((m, v, i) => (v > acc[m] ? i : m), 0);
        registro.textContent = `Con x₂ × ${VIZ.fmt(e, 3)} el 5-NN acierta el ${VIZ.fmt(100 * a, 3)} % (el máximo, ${VIZ.fmt(100 * acc[mejor], 3)} %, ocurre con la escala ${VIZ.fmt(ESC[mejor], 2)}).`;
        lectura.set([['escala elegida', VIZ.fmt(e, 3)], ['exactitud', `${VIZ.fmt(100 * a, 3)} %`], ['mejor escala del barrido', VIZ.fmt(ESC[mejor], 2)], ['exactitud con x₂ × 0,01', `${VIZ.fmt(100 * acc[0], 3)} %`]]);
      }
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.max(0, Math.min(ESC.length - 1, Math.round((pl.ix(x) + 2) * 6)));
      tip.mostrar(x, y, `escala <b>${VIZ.fmt(ESC[i], 3)}</b><br>exactitud <b>${VIZ.fmt(100 * acc[i], 3)} %</b>`);
    });
    l2.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('feature-spaces-distances', {
    intro: String.raw`
      <p>Cada dato es un punto en un <strong>espacio de características</strong>: una coordenada por cada número que lo describe (la edad, el ingreso, un píxel). «Parecido» significa «cercano en ese espacio»,
      y la cercanía se mide con una <em>distancia</em>.</p>
      <p>Pero no hay una única distancia, ni un único espacio. Cambiar de distancia cambia la forma de la vecindad; y cambiar las unidades de una característica la estira o la aplasta. Por eso el espacio de características
      es la parte más importante del modelo, y el aprendizaje profundo se dedica a aprenderlo.</p>`,
    visualizaciones: [
      { titulo: 'La forma de una vecindad', descripcion: 'Cambie la distancia y observe cómo la vecindad pasa de círculo a rombo, cuadrado o ángulo. Con pocos vecinos la lista cambia poco; con muchos, bastante.', montar: montarMetricas },
      { titulo: 'Quién manda cuando cambia la escala', descripcion: 'Multiplique la segunda característica por una escala enorme o minúscula y mire cómo se hunde la exactitud de 5-NN.', montar: montarEscala },
    ],
    teoria: String.raw`
      <h2>Distancias</h2>
      <p>Para \(x, z \in \mathbb{R}^d\), la familia de Minkowski es</p>
      \[ d_p(x,z) = \Big(\sum_{j=1}^d |x_j - z_j|^p\Big)^{1/p}, \qquad d_1 = \text{Manhattan},\quad d_2 = \text{euclidiana},\quad d_\infty = \max_j |x_j - z_j|. \]
      <p>La <strong>distancia coseno</strong> ignora la longitud y compara solo la dirección:</p>
      \[ d_{\cos}(x,z) = 1 - \frac{x^\top z}{\lVert x\rVert\,\lVert z\rVert}. \]
      <p>Las bolas \(\{z : d(x,z)\le r\}\) tienen formas distintas: círculo (\(p=2\)), rombo (\(p=1\)), cuadrado (\(p=\infty\)) y, para el coseno, un cono que parte del origen.</p>
      <h2>Escalas</h2>
      <p>Si se multiplica la característica \(j\) por \(s_j\), la distancia euclidiana pasa a ser \(\sum_j s_j^2 (x_j - z_j)^2\): las características de mayor rango dominan. La solución habitual es
      <em>estandarizar</em> cada una a media 0 y varianza 1,</p>
      \[ x_j' = \frac{x_j - \mu_j}{\sigma_j}, \]
      <p>de modo que todas pesen igual a priori. Detalles en <a href="tema.html?id=feature-scaling">Feature Scaling</a> y <a href="tema.html?id=distance-metrics">Distance Metrics</a>.</p>
      <div class="recuadro"><p>Una red neuronal aprende una función \(\phi_\theta\) tal que la distancia \(\lVert \phi_\theta(x) - \phi_\theta(z)\rVert\) refleja el parecido que importa para la tarea. Es la idea de las
      <a href="tema.html?id=contrastive-learning">representaciones contrastivas</a>.</p></div>`,
  });
})();
