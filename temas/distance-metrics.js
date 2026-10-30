(function () {
  'use strict';
  const { color: C } = VIZ;
  const ML = VIZ.ml;

  const minkowski = (dx, dy, p) => (p === Infinity ? Math.max(Math.abs(dx), Math.abs(dy)) : (Math.abs(dx) ** p + Math.abs(dy) ** p) ** (1 / p));

  /* ---------- Fig. 1: la familia de Minkowski ---------- */

  function montarMinkowski(cuerpo) {
    let p = 2, A = { x: -0.55, y: -0.45 }, B = { x: 0.5, y: 0.35 };
    const valorP = (v) => (v >= 10 ? Infinity : v);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Exponente p', min: 0.5, max: 10, paso: 0.1, valor: p, formato: (v) => (v >= 10 ? '∞' : v.toFixed(1)), alCambiar: (v) => { p = valorP(v); dibujar(); } });
    ctl.boton('Manhattan (p = 1)', () => { p = 1; sync(); dibujar(); });
    ctl.boton('Euclidiana (p = 2)', () => { p = 2; sync(); dibujar(); }, { primario: true });
    ctl.boton('Chebyshev (p = ∞)', () => { p = Infinity; sync(); dibujar(); });
    const rP = ctl.caja.querySelector('input[type=range]');
    const sync = () => { rP.value = p === Infinity ? 10 : p; rP.dispatchEvent(new Event('input')); };
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s7, texto: 'bola de radio d_p(A, B) centrada en A', forma: 'linea' },
      { color: C.s2, texto: 'recorrido Manhattan (L1)', forma: 'linea' },
      { color: C.s1, texto: 'segmento euclidiano (L2)', forma: 'linea' },
      { color: C.s3, texto: 'mayor diferencia por coordenada (L∞)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para mover B. La bola reúne todos los puntos a la misma distancia de A que B: un rombo con p = 1, un círculo con p = 2 y un cuadrado con p = ∞. Con p &lt; 1 deja de ser convexa y ya no es una distancia.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const asp = lienzo.ancho / lienzo.alto;
      plano = ML.plano(lienzo, { dominio: { xmin: -1.2 * asp, xmax: 1.2 * asp, ymin: -1.2, ymax: 1.2 } });
      plano.ejes();
      const dp = minkowski(B.x - A.x, B.y - A.y, p);
      ctx.save(); plano.recortar();
      ML.contorno(ctx, plano, (x, y) => minkowski(x - A.x, y - A.y, p), dp, { color: C.s7, ancho: 2 });
      VIZ.trazar(ctx, plano, [[A.x, A.y], [B.x, A.y], [B.x, B.y]], C.s2, 2.5);
      VIZ.trazar(ctx, plano, [[A.x, A.y], [B.x, B.y]], C.s1, 2.5);
      const horiz = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y);
      VIZ.trazar(ctx, plano, horiz ? [[A.x, A.y - 0.06], [B.x, A.y - 0.06]] : [[A.x - 0.06, A.y], [A.x - 0.06, B.y]], C.s3, 4);
      ctx.restore();
      for (const [P, t] of [[A, 'A'], [B, 'B']]) {
        VIZ.marcador(ctx, plano.sx(P.x), plano.sy(P.y), C.tinta, 5.5);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(t, plano.sx(P.x) + 8, plano.sy(P.y) - 4);
      }
      const dx = B.x - A.x, dy = B.y - A.y;
      lectura.set([
        ['d₁ (Manhattan)', VIZ.fmt(minkowski(dx, dy, 1), 3)],
        ['d₂ (euclidiana)', VIZ.fmt(minkowski(dx, dy, 2), 3)],
        ['d∞ (Chebyshev)', VIZ.fmt(minkowski(dx, dy, Infinity), 3)],
        [`d_p con p = ${p === Infinity ? '∞' : VIZ.fmt(p, 2)}`, VIZ.fmt(dp, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      B = { x: plano.ix(x), y: plano.iy(y) };
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const dx = plano.ix(x) - A.x, dy = plano.iy(y) - A.y;
      tip.mostrar(x, y, `distancia a A<br>L1 <b>${VIZ.fmt(minkowski(dx, dy, 1), 3)}</b> · L2 <b>${VIZ.fmt(minkowski(dx, dy, 2), 3)}</b> · L∞ <b>${VIZ.fmt(minkowski(dx, dy, Infinity), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: coseno frente a euclidiana ---------- */

  function montarCoseno(cuerpo) {
    let a = { x: 3, y: 1 }, b = { x: 1.5, y: 2 }, c = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Multiplicar b por', min: 0.25, max: 4, paso: 0.05, valor: c, formato: (v) => `× ${v.toFixed(2)}`, alCambiar: (v) => { c = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'a (documento 1)', forma: 'linea' },
      { color: C.s2, texto: 'c · b (documento 2 repetido c veces)', forma: 'linea' },
      { color: C.s7, texto: 'ángulo θ (coseno)', forma: 'linea' },
      { color: C.s8, texto: 'distancia euclidiana', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los ejes son conteos de dos palabras. Haga clic para cambiar b. Copiar un documento varias veces (multiplicar b) cambia su distancia euclidiana a a, pero no el ángulo: el coseno no ve la longitud.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const asp = lienzo.ancho / lienzo.alto;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(6, 6 * asp * 0.9), ymin: 0, ymax: 6 }, { etiquetaX: 'conteo de «gato»', etiquetaY: 'conteo de «perro»', margen: { izq: 40 } });
      plano.ejes();
      const cb = { x: c * b.x, y: c * b.y };
      const flecha = (v, col) => {
        VIZ.trazar(ctx, plano, [[0, 0], [v.x, v.y]], col, 2.5);
        const ang = Math.atan2(plano.sy(v.y) - plano.sy(0), plano.sx(v.x) - plano.sx(0)), X = plano.sx(v.x), Y = plano.sy(v.y);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(X, Y);
        ctx.lineTo(X - 10 * Math.cos(ang - 0.4), Y - 10 * Math.sin(ang - 0.4)); ctx.lineTo(X - 10 * Math.cos(ang + 0.4), Y - 10 * Math.sin(ang + 0.4)); ctx.fill();
      };
      ctx.save(); plano.recortar();
      VIZ.trazar(ctx, plano, [[a.x, a.y], [cb.x, cb.y]], C.s8, 2, [5, 4]);
      const ta = Math.atan2(a.y, a.x), tb = Math.atan2(cb.y, cb.x), R = 1.2;
      const arco = [];
      for (let k = 0; k <= 30; k++) { const t = ta + ((tb - ta) * k) / 30; arco.push([R * Math.cos(t), R * Math.sin(t)]); }
      VIZ.trazar(ctx, plano, arco, C.s7, 2);
      flecha(a, C.s1); flecha(cb, C.s2);
      ctx.restore();
      const na = Math.hypot(a.x, a.y), nb = Math.hypot(cb.x, cb.y), cos = (a.x * cb.x + a.y * cb.y) / (na * nb);
      const jac = (Math.min(a.x, cb.x) + Math.min(a.y, cb.y)) / (Math.max(a.x, cb.x) + Math.max(a.y, cb.y));
      lectura.set([
        ['coseno', VIZ.fmt(cos, 3)],
        ['ángulo θ', `${VIZ.fmt((Math.acos(Math.min(1, cos)) * 180) / Math.PI, 3)}°`],
        ['distancia euclidiana', VIZ.fmt(Math.hypot(a.x - cb.x, a.y - cb.y), 3)],
        ['Jaccard ponderado', VIZ.fmt(jac, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      b = { x: Math.max(0.05, plano.ix(x)) / c, y: Math.max(0.05, plano.iy(y)) / c };
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('distance-metrics', {
    intro: String.raw`
      <p>Agrupar, buscar vecinos o detectar anomalías empieza siempre por la misma pregunta: ¿qué tan parecidos son dos objetos?
      Una <strong>distancia</strong> responde con un número que crece cuanto más distintos son; una <strong>similitud</strong>,
      con uno que crece cuanto más se parecen.</p>
      <p>No hay una medida correcta en general. La euclidiana mide «en línea recta», la Manhattan suma diferencias por coordenada,
      y el coseno ignora la magnitud y mira solo la dirección, lo que la hace preferida para texto.</p>`,
    visualizaciones: [
      {
        titulo: 'La familia de Minkowski',
        descripcion: 'Mueva p y observe la forma de la bola: de rombo (p = 1) a círculo (p = 2) a cuadrado (p = ∞). Las tres distancias se dibujan entre A y B.',
        montar: montarMinkowski,
      },
      {
        titulo: 'Coseno frente a euclidiana',
        descripcion: 'Dos documentos como vectores de conteos. Multiplique b y compare qué medida cambia.',
        montar: montarCoseno,
      },
    ],
    teoria: String.raw`
      <h2>Qué es una distancia</h2>
      <p>Una métrica \(d\) cumple, para todo \(x, y, z\):</p>
      \[ d(x, y) \ge 0, \quad d(x, y) = 0 \iff x = y, \quad d(x, y) = d(y, x), \quad d(x, z) \le d(x, y) + d(y, z). \]
      <p>La desigualdad triangular es la que permite podar en estructuras como los <a href="tema.html?id=kd-tree">árboles k-d</a>
      y los <a href="tema.html?id=ball-tree">ball trees</a>.</p>
      <h2>Minkowski</h2>
      \[ d_p(x, y) = \Bigl(\sum_{j=1}^d |x_j - y_j|^p\Bigr)^{1/p}, \qquad d_\infty(x, y) = \max_j |x_j - y_j|. \]
      <ul>
        <li>\(p = 1\), <strong>Manhattan</strong>: recorrido por una cuadrícula de calles. Menos sensible a una sola coordenada muy distinta.</li>
        <li>\(p = 2\), <strong>euclidiana</strong>: la única invariante a rotaciones.</li>
        <li>\(p = \infty\), <strong>Chebyshev</strong>: la peor coordenada decide.</li>
      </ul>
      <p>Para \(p &lt; 1\) la desigualdad triangular falla (la bola no es convexa). Siempre \(d_\infty \le d_2 \le d_1 \le \sqrt d\, d_2\).</p>
      <h2>Similitudes</h2>
      \[ \cos(x, y) = \frac{x \cdot y}{\lVert x\rVert\,\lVert y\rVert}, \qquad
         J(A, B) = \frac{|A \cap B|}{|A \cup B|}, \qquad
         J_w(x, y) = \frac{\sum_j \min(x_j, y_j)}{\sum_j \max(x_j, y_j)}. \]
      <p>El coseno es invariante a escalar cada vector, adecuado cuando la longitud refleja algo irrelevante (el largo de un
      documento). Jaccard compara conjuntos (canastas de compra, palabras presentes). La <strong>correlación de Pearson</strong>
      es el coseno de los vectores centrados. Una similitud \(s \in [0, 1]\) se vuelve disimilitud con \(1 - s\), aunque no
      siempre es métrica; \(\sqrt{2 - 2\cos}\) sí lo es (es la euclidiana entre vectores normalizados).</p>
      <h2>Otras</h2>
      <table>
        <tr><th>Medida</th><th>Para</th></tr>
        <tr><td>Hamming</td><td>vectores binarios o categóricos: número de posiciones distintas</td></tr>
        <tr><td><a href="tema.html?id=lda-qda">Mahalanobis</a></td><td>datos correlacionados: \(\sqrt{(x-y)^\top \Sigma^{-1} (x-y)}\)</td></tr>
        <tr><td>Gower</td><td>tablas mixtas: promedio de disimilitudes por tipo de columna</td></tr>
        <tr><td>Edición (Levenshtein)</td><td>cadenas de texto</td></tr>
      </table>`,
  });
})();