(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: toda vista es una proyección ---------- */

  function nube(semilla) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd), X = [], g = [];
    const centros = [[-1.6, 0.4, -0.8], [1.2, 1.1, 0.6], [0.4, -1.4, 0.9]];
    const ejes = centros.map(() => { const v = [N(), N(), N()], n = Math.hypot(...v); return v.map((x) => x / n); });
    for (let i = 0; i < 150; i++) {
      const k = i % 3, t = N() * 0.9;
      X.push(centros[k].map((c, j) => c + ejes[k][j] * t + N() * 0.22));
      g.push(k);
    }
    const mu = [0, 1, 2].map((j) => M.media(X.map((x) => x[j])));
    return { X: X.map((x) => x.map((v, j) => v - mu[j])), g };
  }
  const base = (th, ph) => [[Math.cos(th), Math.sin(th), 0], [-Math.sin(ph) * Math.sin(th), Math.sin(ph) * Math.cos(th), Math.cos(ph)]];
  const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  function montarVistas(cuerpo) {
    let semilla = 3, D = nube(semilla), th = 0.3, ph = 0.25;
    const ctl = VIZ.controles(cuerpo);
    const rT = ctl.rango({ etiqueta: 'Azimut θ', min: 0, max: 360, valor: Math.round((th * 180) / Math.PI), formato: (v) => `${Math.round(v)}°`, alCambiar: (v) => { th = (v * Math.PI) / 180; dibujar(); } });
    const rP = ctl.rango({ etiqueta: 'Elevación φ', min: -90, max: 90, valor: Math.round((ph * 180) / Math.PI), formato: (v) => `${Math.round(v)}°`, alCambiar: (v) => { ph = (v * Math.PI) / 180; dibujar(); } });
    ctl.boton('Vista PCA', () => {
      const { componentes } = M.pca(D.X, 2);
      const [a, b] = componentes;
      let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      if (n[2] < 0) n = n.map((v) => -v);
      ph = Math.asin(Math.min(1, n[2])); th = Math.atan2(n[0], -n[1]);
      if (th < 0) th += 2 * Math.PI;
      rT.valor = (th * 180) / Math.PI; rP.valor = (ph * 180) / Math.PI;
      dibujar();
    }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; D = nube(semilla); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    VIZ.leyenda(cuerpo, [...M.leyendaGrupos(3, 'cúmulo'), { color: C.apagado, texto: 'ejes x, y, z originales', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre el gráfico para girar la nube 3-D. Lo que ve es la proyección ortogonal sobre el plano de la pantalla. Busque una vista donde los cúmulos se separen y compárela con «Vista PCA», el plano de máxima varianza.');
    let arr = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const [e1, e2] = base(th, ph);
      const P = D.X.map((x, i) => ({ x: punto(x, e1), y: punto(x, e2), g: D.g[i] }));
      const asp = W / H, R = 3.2;
      const plano = VIZ.plano(lienzo, { xmin: -R * asp, xmax: R * asp, ymin: -R, ymax: R }, { margen: { izq: 36 } });
      plano.ejes();
      // Ejes originales proyectados, en la esquina.
      const cx = plano.x0 + 46, cy = plano.y0 - 46;
      ['x', 'y', 'z'].forEach((t, j) => {
        const u = [0, 0, 0]; u[j] = 1;
        const px = cx + 34 * punto(u, e1), py = cy - 34 * punto(u, e2);
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, cx + 44 * punto(u, e1), cy - 44 * punto(u, e2));
      });
      M.dispersion(ctx, plano, P, { color: (p) => M.colorGrupo(p.g), forma: (p) => p.g, r: 3.5 });
      const total = M.suma([0, 1, 2].map((j) => M.varianza(D.X.map((x) => x[j]))));
      const ret = M.varianza(P.map((p) => p.x)) + M.varianza(P.map((p) => p.y));
      const mejor = M.pca(D.X, 2).varianzas;
      lectura.set([
        ['varianza retenida en esta vista', M.pct(ret / total)],
        ['máximo posible (PCA)', M.pct((mejor[0] + mejor[1]) / total)],
        ['error cuadrático medio de reconstrucción', VIZ.fmt(total - ret, 3)],
        ['varianza total', VIZ.fmt(total, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'grab';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arr = { ...lienzo.posicion(ev), th, ph }; lienzo.canvas.setPointerCapture(ev.pointerId); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!arr) return;
      const { x, y } = lienzo.posicion(ev);
      th = (((arr.th - (x - arr.x) / 120) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      ph = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, arr.ph + (y - arr.y) / 120));
      rT.valor = (th * 180) / Math.PI; rP.valor = (ph * 180) / Math.PI;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointerup', () => { arr = null; });
    dibujar();
  }

  /* ---------- Fig. 2: proyecciones aleatorias ---------- */

  function montarAleatorias(cuerpo) {
    const d = 300, n = 60;
    let k = 20, semilla = 1, X = [], razonesR = [], razonesP = [], coordPCA = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dimensión de destino k', min: 2, max: 150, valor: k, alCambiar: (v) => { k = v; }, alSoltar: () => calcular() });
    ctl.boton('Otra proyección', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'proyección aleatoria gaussiana', forma: 'cuadro' },
      { color: C.s2, texto: 'PCA a k dimensiones', forma: 'cuadro' },
      { color: C.apagado, texto: '1 ± ε de Johnson–Lindenstrauss', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `${n} puntos en ${d} dimensiones sin estructura (ruido gaussiano). Cada barra cuenta pares cuya distancia proyectada dividida por la original cae en ese rango. La proyección aleatoria se centra en 1 y se angosta al subir k; PCA siempre acorta distancias.`);
    function calcular() {
      const rnd = VIZ.semilla(semilla * 7 + k);
      if (!X.length) {
        const r0 = VIZ.semilla(99);
        X = Array.from({ length: n }, () => Array.from({ length: d }, () => VIZ.normal(r0)));
        // PCA por la matriz de Gram n × n (más barata que la covarianza d × d): coordenadas √λᵣ · uᵣ.
        const mu = Array.from({ length: d }, (_, j) => M.media(X.map((x) => x[j])));
        const Xc = X.map((x) => x.map((v, j) => v - mu[j]));
        const G = Xc.map((a) => Xc.map((b) => M.suma(a.map((v, j) => v * b[j]))));
        const { valores, vectores } = M.eigSim(G);
        coordPCA = X.map((_, i) => valores.map((l, r) => Math.sqrt(Math.max(0, l)) * vectores[r][i]));
      }
      const R = Array.from({ length: k }, () => Array.from({ length: d }, () => VIZ.normal(rnd) / Math.sqrt(k)));
      const Y = X.map((x) => R.map((r) => M.suma(r.map((v, j) => v * x[j]))));
      const Z = coordPCA.map((z) => z.slice(0, k));
      razonesR = []; razonesP = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const o = Math.sqrt(M.dist2(X[i], X[j]));
        razonesR.push(Math.sqrt(M.dist2(Y[i], Y[j])) / o);
        razonesP.push(Math.sqrt(M.dist2(Z[i], Z[j])) / o);
      }
      dibujar();
    }
    let plano = null, cR = [], cP = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const bins = 60, mn = 0, mx = 2;
      const dens = (v) => { const c = new Array(bins).fill(0); v.forEach((x) => { const b = Math.floor(((x - mn) / (mx - mn)) * bins); if (b >= 0 && b < bins) c[b]++; }); return c.map((x) => x / (v.length * ((mx - mn) / bins))); };
      const ymax = Math.max(...dens(razonesR), ...dens(razonesP)) * 1.08;
      plano = VIZ.plano(lienzo, { xmin: mn, xmax: mx, ymin: 0, ymax }, { etiquetaX: 'distancia proyectada ÷ distancia original', etiquetaY: 'densidad' });
      plano.ejes();
      cP = M.histograma(ctx, plano, razonesP, { min: mn, max: mx, bins, color: C.s2, densidad: true, alfa: 0.75 });
      cR = M.histograma(ctx, plano, razonesR, { min: mn, max: mx, bins, color: C.s1, densidad: true, alfa: 0.75 });
      const eps = Math.sqrt((8 * Math.log(n)) / k);
      for (const v of [1 - eps, 1 + eps]) if (v > mn && v < mx) VIZ.trazar(ctx, plano, [[v, 0], [v, ymax]], C.apagado, 1.5, [3, 4]);
      lectura.set([
        ['aleatoria: mín – máx', `${VIZ.fmt(Math.min(...razonesR), 3)} – ${VIZ.fmt(Math.max(...razonesR), 3)}`],
        ['PCA: mín – máx', `${VIZ.fmt(Math.min(...razonesP), 3)} – ${VIZ.fmt(Math.max(...razonesP), 3)}`],
        ['ε de JL para k (≈ √(8 ln n / k))', VIZ.fmt(eps, 3)],
        ['costo de la proyección aleatoria', `O(n·d·k), sin mirar los datos`],
      ]);
    }
    lienzo.alDibujar = () => razonesR.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const b = Math.floor((plano.ix(x) / 2) * 60);
      if (b < 0 || b >= 60) return tip.ocultar();
      tip.mostrar(x, y, `razón ≈ <b>${VIZ.fmt((b + 0.5) / 30, 3)}</b>` + VIZ.filaTooltip(C.s1, 'aleatoria', VIZ.fmt(cR[b], 3)) + VIZ.filaTooltip(C.s2, 'PCA', VIZ.fmt(cP[b], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('linear-projections', {
    intro: String.raw`
      <p>Una <strong>proyección lineal</strong> manda cada punto \(x \in \mathbb{R}^d\) a \(Wx \in \mathbb{R}^k\) con \(k &lt; d\).
      Mirar una nube 3-D en una pantalla ya es proyectar: cada ángulo de vista es una matriz \(W\) distinta, y algunas muestran
      la estructura mucho mejor que otras.</p>
      <p>¿Qué proyección elegir? <a href="tema.html?id=pca">PCA</a> busca la que retiene más <strong>varianza explicada</strong>.
      Las <strong>proyecciones aleatorias</strong>, sorprendentemente, preservan bien todas las distancias si \(k\) es del orden
      de \(\log n\), sin mirar los datos.</p>`,
    visualizaciones: [
      {
        titulo: 'Toda vista es una proyección',
        descripcion: 'Gire la nube y observe cuánta varianza retiene cada vista. Ninguna supera a la vista PCA.',
        montar: montarVistas,
      },
      {
        titulo: 'Proyecciones aleatorias',
        descripcion: 'Cuánto cambian las distancias entre pares al proyectar de 300 a k dimensiones. Mueva k y compare la forma de los dos histogramas.',
        montar: montarAleatorias,
      },
    ],
    teoria: String.raw`
      <h2>Proyección ortogonal</h2>
      <p>Si \(W \in \mathbb{R}^{k \times d}\) tiene filas ortonormales (\(W W^\top = I_k\)), la proyección de \(x\) es \(z = Wx\) y su
      reconstrucción en \(\mathbb{R}^d\) es \(\hat x = W^\top z\). Para datos centrados,</p>
      \[ \underbrace{\tfrac1n \textstyle\sum_i \lVert x_i\rVert^2}_{\text{varianza total}}
         = \underbrace{\tfrac1n \textstyle\sum_i \lVert W x_i\rVert^2}_{\text{varianza retenida}}
         + \underbrace{\tfrac1n \textstyle\sum_i \lVert x_i - W^\top W x_i\rVert^2}_{\text{error de reconstrucción}}. \]
      <p>Maximizar la varianza retenida es lo mismo que minimizar el error: ambos llevan a las \(k\) primeras componentes principales.</p>
      <h2>Varianza explicada</h2>
      <p>Con valores propios \(\lambda_1 \ge \dots \ge \lambda_d\) de la covarianza, la fracción explicada por \(k\) componentes es
      \(\sum_{i \le k} \lambda_i / \sum_i \lambda_i\). Se suele elegir \(k\) para retener 90–95 %, o en el «codo» del gráfico de
      sedimentación (<em>scree plot</em>). Ver también la <a href="tema.html?id=svd">SVD</a>.</p>
      <h2>Johnson–Lindenstrauss</h2>
      <div class="recuadro"><p>Para \(n\) puntos y \(0 &lt; \varepsilon &lt; 1\), si \(k \ge \dfrac{4 \ln n}{\varepsilon^2/2 - \varepsilon^3/3}\),
      una matriz \(R\) con entradas \(\mathcal N(0, 1/k)\) cumple con alta probabilidad, para todo par,</p>
      \[ (1 - \varepsilon)\,\lVert x - y\rVert^2 \le \lVert Rx - Ry\rVert^2 \le (1 + \varepsilon)\,\lVert x - y\rVert^2. \]</div>
      <p>La cota no depende de \(d\). Las proyecciones aleatorias son baratas, no necesitan datos para construirse y sirven
      antes de buscar vecinos o como primer paso de una SVD aleatorizada.</p>
      <h2>PCA frente a aleatoria</h2>
      <table>
        <tr><th></th><th>PCA</th><th>Aleatoria</th></tr>
        <tr><td>Criterio</td><td>máxima varianza</td><td>preservar todas las distancias (aprox.)</td></tr>
        <tr><td>Distancias</td><td>siempre se acortan (\(\le\))</td><td>se conservan en promedio</td></tr>
        <tr><td>Costo</td><td>\(O(nd^2 + d^3)\)</td><td>\(O(ndk)\)</td></tr>
        <tr><td>Datos con estructura de baja dimensión</td><td>la encuentra</td><td>no la aprovecha</td></tr>
      </table>
      <p>Ambas son lineales: no pueden «desenrollar» una variedad curva como el rollo suizo; para eso están
      <a href="tema.html?id=t-sne">t-SNE</a> y <a href="tema.html?id=umap">UMAP</a>.</p>`,
  });
})();