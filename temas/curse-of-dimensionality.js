(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const DIMS = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

  /* ---------- Fig. 1: las distancias se concentran ---------- */

  function montarConcentracion(cuerpo) {
    let id = 1, n = 150, semilla = 1, distancias = [], contraste = 0, d = DIMS[id];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dimensión d', min: 0, max: DIMS.length - 1, valor: id, formato: (v) => String(DIMS[v]), alCambiar: (v) => { id = v; calcular(); } });
    ctl.rango({ etiqueta: 'Puntos n', min: 50, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; }, alSoltar: calcular });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'distancias entre todos los pares (÷ la media)' }, { color: C.s2, texto: 'mínimo y máximo desde el primer punto', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Puntos uniformes en el cubo [0, 1]^d. Suba d: el histograma se vuelve una aguja alrededor de 1, el vecino más cercano y el más lejano quedan casi a la misma distancia y «el más cercano» pierde significado.');
    let mn = 0, mx = 0;
    function calcular() {
      d = DIMS[id];
      const rnd = VIZ.semilla(semilla * 101 + d);
      const X = Array.from({ length: n }, () => Array.from({ length: d }, rnd));
      distancias = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) distancias.push(Math.sqrt(M.dist2(X[i], X[j])));
      const m = M.media(distancias);
      distancias = distancias.map((v) => v / m);
      const desde0 = X.slice(1).map((x) => Math.sqrt(M.dist2(X[0], x)) / m);
      mn = Math.min(...desde0); mx = Math.max(...desde0);
      contraste = (mx - mn) / mn;
      dibujar();
    }
    let plano = null, conteos = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const bins = 50;
      const ymax = (() => { const c = new Array(bins).fill(0); for (const v of distancias) { const b = Math.floor((v / 2.2) * bins); if (b >= 0 && b < bins) c[b]++; } return Math.max(...c) / (distancias.length * (2.2 / bins)); })();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 2.2, ymin: 0, ymax: ymax * 1.08 }, { etiquetaX: 'distancia ÷ distancia media', etiquetaY: 'densidad' });
      plano.ejes();
      conteos = M.histograma(ctx, plano, distancias, { min: 0, max: 2.2, bins, color: C.s1, densidad: true });
      for (const v of [mn, mx]) VIZ.trazar(ctx, plano, [[v, 0], [v, ymax * 1.05]], C.s2, 2, [4, 3]);
      lectura.set([
        ['dimensión', String(d)],
        ['desv. / media de las distancias', VIZ.fmt(M.desv(distancias), 3)],
        ['contraste (máx − mín) / mín', VIZ.fmt(contraste, 3)],
        ['más cercano / más lejano', VIZ.fmt(mn / mx, 3)],
      ]);
    }
    lienzo.alDibujar = () => distancias.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const b = Math.floor((plano.ix(x) / 2.2) * 50);
      if (b < 0 || b >= 50) return tip.ocultar();
      tip.mostrar(x, y, `[${VIZ.fmt((b * 2.2) / 50, 3)}, ${VIZ.fmt(((b + 1) * 2.2) / 50, 3)})<br>densidad <b>${VIZ.fmt(conteos[b], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: el espacio se vacía ---------- */

  // Volumen de la bola de radio r en d dimensiones: π^{d/2} r^d / Γ(d/2 + 1), por recurrencia.
  function volBola(d, r) {
    let v = d % 2 ? 2 * r : Math.PI * r * r;
    for (let k = d % 2 ? 3 : 4; k <= d; k += 2) v *= (2 * Math.PI * r * r) / k;
    return d === 0 ? 1 : v;
  }

  function montarVolumen(cuerpo) {
    let borde = 0.05, frac = 0.1, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Grosor de la cáscara', min: 0.01, max: 0.2, paso: 0.01, valor: borde, formato: (v) => `${Math.round(v * 100)} % del lado`, alCambiar: (v) => { borde = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Fracción de datos a capturar', min: 0.01, max: 0.5, paso: 0.01, valor: frac, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { frac = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const SERIES = [
      [(d) => volBola(d, 0.5), C.s1, 'volumen de la bola inscrita'],
      [(d) => 1 - (1 - 2 * borde) ** d, C.s2, 'fracción del cubo en la cáscara exterior'],
      [(d) => frac ** (1 / d), C.s3, 'lado del subcubo que captura la fracción'],
    ];
    VIZ.leyenda(cuerpo, SERIES.map(([, c, t]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor para leer los valores en cada dimensión. En d = 10 la bola inscrita ocupa 0,25 % del cubo, y para tener el 10 % de los datos «cerca» hay que tomar un subcubo de lado 0,79.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 50, ymin: 0, ymax: 1 }, { etiquetaX: 'dimensión d', etiquetaY: 'fracción', formatoY: (v) => `${Math.round(v * 100)}%` });
      plano.ejes();
      for (const [f, c] of SERIES) {
        const pts = [];
        for (let d = 1; d <= 50; d++) pts.push([d, Math.min(1, f(d))]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(Math.min(1, f(hover))), c, 4);
      }
      const d10 = 10;
      lectura.set(SERIES.map(([f, , t]) => [`${t.split(' ').slice(0, 3).join(' ')} (d = ${d10})`, M.pct(f(d10), 2)]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(50, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `d = <b>${hover}</b>` + SERIES.map(([f, c, t]) => VIZ.filaTooltip(c, t, M.pct(f(hover), 2))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('curse-of-dimensionality', {
    intro: String.raw`
      <p>La intuición que tenemos en dos o tres dimensiones falla cuando hay cientos de características. En un espacio de
      dimensión alta casi todo el volumen está en las esquinas y en la cáscara exterior, los datos quedan muy dispersos y,
      lo más grave para la minería de datos, <strong>todas las distancias se parecen</strong>.</p>
      <p>Esto es la <strong>maldición de la dimensionalidad</strong>: los métodos basados en vecinos, densidad o agrupamiento
      pierden contraste, y la cantidad de datos necesaria para cubrir el espacio crece exponencialmente con \(d\).</p>`,
    visualizaciones: [
      {
        titulo: 'Las distancias se concentran',
        descripcion: 'Histograma de las distancias entre pares de puntos uniformes, divididas por su media. Suba la dimensión y mire cómo se angosta.',
        montar: montarConcentracion,
      },
      {
        titulo: 'El espacio se vacía',
        descripcion: 'Tres medidas del cubo unitario según la dimensión: cuánto ocupa la bola inscrita, cuánto la cáscara exterior y qué tan grande debe ser un «vecindario».',
        montar: montarVolumen,
      },
    ],
    teoria: String.raw`
      <h2>Concentración de las distancias</h2>
      <p>Si \(x, y\) son uniformes e independientes en \([0, 1]^d\), cada término \((x_j - y_j)^2\) tiene media \(1/6\) y varianza
      \(7/180\). Por la ley de los grandes números,</p>
      \[ \frac{\lVert x - y\rVert^2}{d} \to \frac16, \qquad
         \frac{\operatorname{sd}(\lVert x - y\rVert)}{\mathbb{E}\lVert x - y\rVert} = O\!\left(\frac{1}{\sqrt d}\right). \]
      <div class="recuadro"><p>Beyer et al. (1999): si la varianza relativa de las distancias tiende a 0, entonces para cualquier
      \(\varepsilon &gt; 0\), \(\Pr\bigl[d_{\max} \le (1 + \varepsilon)\, d_{\min}\bigr] \to 1\). El vecino más cercano y el más
      lejano se vuelven indistinguibles.</p></div>
      <p>Por eso la <a href="tema.html?id=distance-metrics">distancia</a> \(L_1\) o incluso \(L_p\) con \(p &lt; 1\) conserva algo más
      de contraste que \(L_2\) en dimensión alta.</p>
      <h2>Volumen</h2>
      <p>La bola de radio \(r\) en \(\mathbb{R}^d\) tiene volumen \(V_d(r) = \dfrac{\pi^{d/2}}{\Gamma(d/2 + 1)}\, r^d\). La inscrita en el cubo
      unitario (\(r = 1/2\)) ocupa una fracción que tiende a 0 más rápido que exponencialmente. La cáscara de grosor
      \(\varepsilon\) contiene \(1 - (1 - 2\varepsilon)^d \to 1\) del volumen.</p>
      <h2>Vecindarios que no son locales</h2>
      <p>Para capturar una fracción \(f\) de datos uniformes con un subcubo hace falta un lado \(e_d(f) = f^{1/d}\). Con \(d = 10\) y
      \(f = 0{,}1\), \(e = 0{,}79\): el «vecindario» abarca casi todo el rango de cada variable. Para mantener fija la densidad de
      datos, \(n\) debe crecer como \(c^d\).</p>
      <h2>Qué hacer</h2>
      <ul>
        <li>Reducir la dimensión: <a href="tema.html?id=pca">PCA</a>, <a href="tema.html?id=svd">SVD</a>,
        <a href="tema.html?id=t-sne">t-SNE</a>, <a href="tema.html?id=umap">UMAP</a>.</li>
        <li>Seleccionar características relevantes (<a href="tema.html?id=sfs">SFS</a>).</li>
        <li>Aprovechar que los datos reales suelen vivir cerca de una <strong>variedad de baja dimensión intrínseca</strong>: la
        maldición afecta según esa dimensión, no según el número de columnas.</li>
      </ul>`,
  });
})();