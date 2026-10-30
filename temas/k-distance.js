(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  // Distancia al k-ésimo vecino (sin contarse a sí mismo) para cada punto.
  const kDist = (pts, k) => pts.map((p) => pts.map((q) => Math.hypot(p.x - q.x, p.y - q.y)).sort((a, b) => a - b)[k]);
  const planoDatos = (lienzo, caja) => {
    const ancho = caja ? caja.x1 - caja.x0 : lienzo.ancho, asp = Math.max(1, (ancho / lienzo.alto) * 0.95);
    return ML.plano(lienzo, { dominio: { xmin: -1.15 * asp, xmax: 1.15 * asp, ymin: -1.15, ymax: 1.15 }, margen: caja ? { izq: caja.x0 + 34, der: lienzo.ancho - caja.x1 + 8 } : { izq: 40 } });
  };

  /* ---------- Fig. 1: la k-distancia como densidad ---------- */

  function montarDensidad(cuerpo) {
    let tipo = 'densidades', k = 5, semilla = 2, pts = [], kd = [], hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'k', min: 1, max: 30, valor: k, alCambiar: (v) => { k = v; kd = kDist(pts, k); dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'k-distancia chica (zona densa)', forma: 'punto' },
      { color: VIZ.css(VIZ.enRampa(0.05)), texto: 'k-distancia grande (zona dispersa)', forma: 'punto' },
      { color: C.s2, texto: 'círculo de radio k-dist(p) y sus k vecinos', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un punto: el círculo es el menor que contiene a sus k vecinos. Su radio es una estimación inversa de la densidad local: ≈ k / (n · π r²).');
    function generar() { pts = M.datos2d(tipo, 220, semilla, { ruido: 0.06 }); kd = kDist(pts, k); hover = -1; dibujar(); }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      const lo = M.cuantil(kd, 0.02), hi = M.cuantil(kd, 0.98);
      const t = (v) => 1 - Math.min(1, Math.max(0, (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo) || 1)));
      if (hover >= 0) {
        const esc = pl.sx(1) - pl.sx(0), p = pts[hover];
        ctx.save(); pl.recortar();
        ctx.fillStyle = VIZ.alfa(C.s2, 0.08); ctx.strokeStyle = C.s2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pl.sx(p.x), pl.sy(p.y), kd[hover] * esc, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      M.dispersion(ctx, pl, pts, { color: (p, i) => VIZ.css(VIZ.enRampa(0.05 + 0.95 * t(kd[i]))), r: 4,
        anillo: (p, i) => (hover >= 0 && i !== hover && Math.hypot(p.x - pts[hover].x, p.y - pts[hover].y) <= kd[hover] + 1e-12 ? C.s2 : null) });
      lectura.set([
        ['k-distancia mediana', VIZ.fmt(M.cuantil(kd, 0.5), 3)],
        ['k-distancia mínima · máxima', `${VIZ.fmt(Math.min(...kd), 3)} · ${VIZ.fmt(Math.max(...kd), 3)}`],
        ['punto señalado', hover >= 0 ? `k-dist = ${VIZ.fmt(kd[hover], 3)}` : '—'],
      ]);
    }
    lienzo.alDibujar = () => pts.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m !== hover) { hover = m; dibujar(); }
      if (m < 0) return tip.ocultar();
      tip.mostrar(x, y, `k-dist<sub>${k}</sub> = <b>${VIZ.fmt(kd[m], 3)}</b><br>densidad ≈ <b>${VIZ.fmt(k / (pts.length * Math.PI * kd[m] ** 2), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    generar();
  }

  /* ---------- Fig. 2: el gráfico de k-distancias ordenadas ---------- */

  function montarCodo(cuerpo) {
    let tipo = 'manchas', k = 4, eps = 0.12, semilla = 3, pts = [], kd = [], orden = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'k (= MinPts − 1)', min: 1, max: 20, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    const rE = ctl.rango({ etiqueta: 'Umbral ε', min: 0.02, max: 0.5, paso: 0.005, valor: eps, formato: (v) => v.toFixed(3), alCambiar: (v) => { eps = v; dibujar(); } });
    ctl.boton('Ir al codo', () => { eps = codo(); rE.valor = eps; dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.25) : Math.min(380, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'k-dist ≤ ε (quedaría en un grupo denso)', forma: 'punto' },
      { color: C.s8, texto: 'k-dist > ε (candidato a ruido)', forma: 'punto' },
      { color: C.s2, texto: 'umbral ε', forma: 'linea' },
      { color: C.s6, texto: 'codo (máxima distancia a la cuerda)', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En el segundo panel, las k-distancias de todos los puntos ordenadas de mayor a menor. El codo separa los puntos de zonas densas (cola plana) del ruido (subida brusca): es la heurística clásica para elegir ε en DBSCAN.');
    function generar() { pts = M.datos2d(tipo, 240, semilla, { ruido: 0.08 }); calcular(); }
    function calcular() { kd = kDist(pts, k); orden = kd.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]); dibujar(); }
    // Codo: el punto de la curva ordenada más lejano a la recta entre sus extremos.
    function codo() {
      const n = orden.length, y0 = orden[0][0], y1 = orden[n - 1][0];
      let m = 0, dm = -1;
      orden.forEach(([v], i) => { const d = Math.abs((y1 - y0) * (i / (n - 1)) - (v - y0)) / Math.hypot(1, y1 - y0); if (d > dm) { dm = d; m = i; } });
      return orden[m][0];
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620;
      const cajaA = vertical ? { x0: 0, x1: W } : { x0: 0, x1: W * 0.48 };
      const hA = vertical ? H * 0.55 : H;
      ctx.save();
      const subL = { ...lienzo, ancho: cajaA.x1, alto: hA, ctx };
      const pl = planoDatos(subL);
      pl.ejes();
      M.dispersion(ctx, pl, pts, { color: (p, i) => (kd[i] <= eps ? C.s1 : C.s8), forma: (p, i) => (kd[i] <= eps ? 0 : 1), r: 3.5 });
      ctx.restore();
      ctx.save();
      const off = vertical ? { x: 0, y: hA + 6 } : { x: W * 0.5, y: 0 };
      ctx.translate(off.x, off.y);
      const subR = { ...lienzo, ancho: vertical ? W : W * 0.5, alto: vertical ? H - hA - 6 : H, ctx };
      const pr = VIZ.plano(subR, { xmin: 0, xmax: orden.length, ymin: 0, ymax: orden[0][0] * 1.05 }, { etiquetaX: 'puntos ordenados', etiquetaY: `${k}-distancia` });
      pr.ejes();
      VIZ.trazar(ctx, pr, orden.map(([v], i) => [i, v]), C.tinta2, 2);
      VIZ.trazar(ctx, pr, [[0, eps], [orden.length, eps]], C.s2, 2, [5, 4]);
      const c = codo(), ic = orden.findIndex(([v]) => v === c);
      VIZ.marcador(ctx, pr.sx(ic), pr.sy(c), C.s6, 5);
      ctx.restore();
      geo = { pr, off };
      const ruido = kd.filter((v) => v > eps).length;
      lectura.set([
        ['ε elegido', VIZ.fmt(eps, 3)],
        ['ε en el codo', VIZ.fmt(c, 3)],
        ['puntos con k-dist > ε', `${ruido} (${M.pct(ruido / pts.length, 0)})`],
        ['ruido real generado', String(pts.filter((p) => p.g < 0).length)],
      ]);
    }
    lienzo.alDibujar = () => orden.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const px = x - geo.off.x, py = y - geo.off.y;
      if (!geo.pr.dentro(px, py)) return tip.ocultar();
      const i = Math.max(0, Math.min(orden.length - 1, Math.round(geo.pr.ix(px))));
      tip.mostrar(x, y, `posición <b>${i + 1}</b><br>${k}-distancia <b>${VIZ.fmt(orden[i][0], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('k-distance', {
    intro: String.raw`
      <p>La <strong>k-distancia</strong> de un punto es la distancia a su k-ésimo vecino más cercano. Es la forma más simple de
      medir densidad local: en una zona densa, k vecinos caben en un círculo chico; en una zona vacía, hay que ir lejos a buscarlos.</p>
      <p>Es la pieza básica de varios métodos: la usa <a href="tema.html?id=dbscan">DBSCAN</a> para decidir qué es un punto
      núcleo, <a href="tema.html?id=local-outlier-factor">LOF</a> para definir la distancia de alcanzabilidad y
      <a href="tema.html?id=hdbscan">HDBSCAN</a> para la distancia núcleo; y por sí sola ya es un puntaje de anomalía.</p>`,
    visualizaciones: [
      {
        titulo: 'La k-distancia como densidad',
        descripcion: 'Cada punto coloreado por su k-distancia (escala logarítmica). Los puntos del ruido de fondo quedan claros; los de la mancha compacta, oscuros.',
        montar: montarDensidad,
      },
      {
        titulo: 'El gráfico de k-distancias ordenadas',
        descripcion: 'Mueva ε y vea qué puntos quedan sobre el umbral. «Ir al codo» lo pone en el quiebre de la curva.',
        montar: montarCodo,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Para un conjunto \(D\) y un punto \(p\), sea \(N_k(p)\) el conjunto de sus \(k\) vecinos más cercanos (sin contar a \(p\)). Entonces</p>
      \[ \operatorname{k-dist}(p) = \max_{o \in N_k(p)} d(p, o). \]
      <p>Si hay empates, \(N_k(p)\) puede tener más de \(k\) elementos: todos los que están a distancia \(\le \operatorname{k-dist}(p)\).</p>
      <h2>Estimador de densidad</h2>
      <p>La bola de radio \(r_k = \operatorname{k-dist}(p)\) contiene \(k\) de los \(n\) puntos, así que</p>
      \[ \hat f(p) \approx \frac{k}{n \cdot V_d\, r_k^{\,d}}, \]
      <p>donde \(V_d\) es el volumen de la bola unitaria en \(d\) dimensiones (\(\pi\) en el plano). Es el estimador de densidad de
      k vecinos: se adapta solo a la escala local, a diferencia de un histograma o de un núcleo de ancho fijo.</p>
      <h2>Como detector de anomalías</h2>
      <p>Ordenar los puntos por k-distancia (o por la distancia media a sus k vecinos) da un detector simple y sorprendentemente
      bueno. Su defecto: usa un umbral <em>global</em>. Un punto a distancia moderada de un grupo muy denso no se marca, aunque
      sea claramente anómalo respecto a sus vecinos; LOF corrige eso comparando con la densidad de los vecinos.</p>
      <h2>Elegir ε para DBSCAN</h2>
      <pre><code>calcular k-dist(p) para todo p, con k = MinPts − 1
ordenar de mayor a menor y graficar
ε ← valor en el «codo» de la curva</code></pre>
      <p>Los puntos a la izquierda del codo tienen k-distancia grande: serán ruido. El codo se puede localizar como el punto de la
      curva más lejano a la recta que une sus extremos. Calcular todas las k-distancias cuesta \(O(n^2)\) por fuerza bruta u
      \(O(n \log n)\) con un <a href="tema.html?id=kd-tree">árbol k-d</a>.</p>`,
  });
})();