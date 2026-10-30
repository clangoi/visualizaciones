(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Banda con el rango entre los cuantiles 10 % y 90 % de las repeticiones bootstrap.
  function banda(ctx, pl, filas, lo, hi, col) {
    ctx.fillStyle = VIZ.alfa(col, 0.18); ctx.beginPath();
    filas.forEach((f, i) => (i ? ctx.lineTo(pl.sx(f.x), pl.sy(lo(f))) : ctx.moveTo(pl.sx(f.x), pl.sy(lo(f)))));
    filas.slice().reverse().forEach((f) => ctx.lineTo(pl.sx(f.x), pl.sy(hi(f))));
    ctx.fill();
  }

  /* ---------- Fig. 1: DBSCAN según ε ---------- */

  function montarDBSCAN(cuerpo) {
    let tipo = 'manchas', minPts = 5, semilla = 1, filas = [], hover = null;
    const EPS = Array.from({ length: 24 }, (_, i) => 0.03 + i * 0.012);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'MinPts', min: 2, max: 15, valor: minPts, alCambiar: (v) => { minPts = v; }, alSoltar: () => calcular() });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.2) : Math.min(380, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'número de grupos (mediana y banda 10–90 % en 20 remuestras)', forma: 'linea' },
      { color: C.s2, texto: 'ARI con los datos completos (estabilidad)', forma: 'linea' },
      { color: C.s6, texto: 'meseta: grupos constantes y ARI alto', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada ε se corre DBSCAN sobre 20 remuestras de los datos. Un resultado confiable vive en una meseta: un rango de ε donde el número de grupos no cambia y las remuestras coinciden con el resultado completo. Un número de grupos que solo aparece en un ε puntual es frágil.');
    function calcular() {
      const pts = M.datos2d(tipo, 200, semilla, { ruido: 0.05 }), rnd = VIZ.semilla(semilla * 13);
      const muestras = Array.from({ length: 20 }, () => pts.map(() => Math.floor(rnd() * pts.length)));
      filas = EPS.map((eps) => {
        const base = M.dbscan(pts, eps, minPts);
        const K = [], ari = [];
        for (const idx of muestras) {
          const sub = idx.map((i) => pts[i]), R = M.dbscan(sub, eps, minPts);
          K.push(R.grupos);
          ari.push(M.randAjustado(R.etiqueta, idx.map((i) => base.etiqueta[i])));
        }
        return { x: eps, K: M.cuantil(K, 0.5), Klo: M.cuantil(K, 0.1), Khi: M.cuantil(K, 0.9), ari: M.media(ari), Kbase: base.grupos, verdad: M.randAjustado(base.etiqueta, pts.map((p) => p.g)) };
      });
      dibujar();
    }
    let pl = null, pl2 = null, oy = 0;
    function dibujar() {
      const { ctx, alto: H } = lienzo;
      lienzo.limpiar();
      const h1 = H * 0.55;
      const Kmax = Math.max(4, ...filas.map((f) => f.Khi));
      pl = VIZ.plano({ ...lienzo, alto: h1, ctx }, { xmin: EPS[0], xmax: EPS[EPS.length - 1], ymin: 0, ymax: Kmax + 0.5 }, { etiquetaY: 'grupos', margen: { izq: 44, inf: 22 } });
      // Meseta: ε donde la banda es de ancho 0 y el ARI ≥ 0,9.
      filas.forEach((f, i) => { if (f.Klo === f.Khi && f.ari >= 0.9 && f.K > 0) { const a = i ? (filas[i - 1].x + f.x) / 2 : f.x, b = i < filas.length - 1 ? (filas[i + 1].x + f.x) / 2 : f.x; ctx.fillStyle = VIZ.alfa(C.s6, 0.12); ctx.fillRect(pl.sx(a), pl.y1, pl.sx(b) - pl.sx(a), pl.y0 - pl.y1); } });
      pl.ejes();
      banda(ctx, pl, filas, (f) => f.Klo, (f) => f.Khi, C.s1);
      VIZ.trazar(ctx, pl, filas.map((f) => [f.x, f.K]), C.s1, 2);
      ctx.save(); oy = h1 + 4; ctx.translate(0, oy);
      pl2 = VIZ.plano({ ...lienzo, alto: H - oy, ctx }, { xmin: EPS[0], xmax: EPS[EPS.length - 1], ymin: 0, ymax: 1 }, { etiquetaX: 'ε', etiquetaY: 'ARI', margen: { izq: 44 } });
      pl2.ejes();
      VIZ.trazar(ctx, pl2, filas.map((f) => [f.x, f.ari]), C.s2, 2);
      if (hover) VIZ.trazar(ctx, pl2, [[hover.x, 0], [hover.x, 1]], C.apagado, 1, [3, 3]);
      ctx.restore();
      if (hover) VIZ.trazar(ctx, pl, [[hover.x, 0], [hover.x, Kmax + 0.5]], C.apagado, 1, [3, 3]);
      const meseta = filas.filter((f) => f.Klo === f.Khi && f.ari >= 0.9 && f.K > 0);
      lectura.set([
        ['ε en la meseta', meseta.length ? `${VIZ.fmt(meseta[0].x, 3)} – ${VIZ.fmt(meseta[meseta.length - 1].x, 3)}` : 'ninguno'],
        ['grupos en la meseta', meseta.length ? [...new Set(meseta.map((f) => f.K))].join(', ') : '—'],
        ['mejor ARI con los grupos reales', VIZ.fmt(Math.max(...filas.map((f) => f.verdad)), 3)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || x < pl.x0 || x > pl.x1) { hover = null; tip.ocultar(); return dibujar(); }
      const v = pl.ix(x);
      hover = filas.reduce((a, b) => (Math.abs(b.x - v) < Math.abs(a.x - v) ? b : a));
      dibujar();
      tip.mostrar(x, y, `ε = <b>${VIZ.fmt(hover.x, 3)}</b><br>grupos con todos los datos <b>${hover.Kbase}</b> (remuestras ${hover.Klo}–${hover.Khi})<br>ARI medio <b>${VIZ.fmt(hover.ari, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: un efecto causal según el caliper ---------- */

  function montarCaliper(cuerpo) {
    let conf = 1.4, semilla = 1, filas = [], hover = null;
    const CAL = [0.02, 0.04, 0.07, 0.1, 0.15, 0.2, 0.3, 0.45, 0.65, 1, 1.5, 2.5];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Confusión', min: 0, max: 2.5, paso: 0.1, valor: conf, formato: (v) => v.toFixed(1), alCambiar: (v) => { conf = v; }, alSoltar: () => calcular() });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 280, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'ATT estimado (banda 10–90 % en 30 remuestras bootstrap)', forma: 'linea' },
      { color: C.s4, texto: 'ATT verdadero de los tratados emparejados', forma: 'linea' },
      { color: C.s3, texto: 'tratados conservados (eje derecho, ×5)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Matching 1 a 1 por distancia euclidiana con caliper creciente (escala logarítmica). Con caliper chico la estimación es ruidosa y describe a pocos tratados; con caliper grande es estable pero sesgada. Si la conclusión cambia de signo o de magnitud a lo largo de un rango razonable, no es robusta.');
    function calcular() {
      const D = M.estudio(300, semilla, { conf }), rnd = VIZ.semilla(semilla * 3), dist = (a, b) => Math.hypot(a.x1 - b.x1, a.x2 - b.x2);
      const muestras = Array.from({ length: 30 }, () => D.map(() => D[Math.floor(rnd() * D.length)]));
      const nT = D.filter((d) => d.t).length;
      filas = CAL.map((c) => {
        const R = M.emparejar(D, dist, { caliper: c });
        const bs = muestras.map((S) => M.emparejar(S, dist, { caliper: c }).att).filter(Number.isFinite);
        return { x: Math.log10(c), c, att: R.att, lo: M.cuantil(bs, 0.1), hi: M.cuantil(bs, 0.9), verdad: M.media(R.pares.map((p) => D[p.i].tau)), ret: R.pares.length / nT };
      }).filter((f) => Number.isFinite(f.att));
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ys = filas.flatMap((f) => [f.lo, f.hi, f.verdad]), ymax = Math.max(5, ...ys) * 1.05;
      pl = VIZ.plano(lienzo, { xmin: filas[0].x, xmax: filas[filas.length - 1].x, ymin: Math.min(0, ...ys), ymax }, { etiquetaX: 'caliper (escala log)', etiquetaY: 'ATT', ticksX: [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2].map(Math.log10), formatoX: (v) => VIZ.fmt(10 ** v, 2) });
      pl.ejes();
      banda(ctx, pl, filas, (f) => f.lo, (f) => f.hi, C.s1);
      VIZ.trazar(ctx, pl, filas.map((f) => [f.x, f.att]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, filas.map((f) => [f.x, f.verdad]), C.s4, 2, [5, 4]);
      VIZ.trazar(ctx, pl, filas.map((f) => [f.x, f.ret * 5]), C.s3, 2);
      if (hover) for (const [v, col] of [[hover.att, C.s1], [hover.verdad, C.s4], [hover.ret * 5, C.s3]]) VIZ.marcador(ctx, pl.sx(hover.x), pl.sy(v), col, 4);
      const f0 = filas[0], f1 = filas[filas.length - 1];
      lectura.set([
        [`caliper ${VIZ.fmt(f0.c, 2)}: ATT · ancho de la banda`, `${VIZ.fmt(f0.att, 3)} · ${VIZ.fmt(f0.hi - f0.lo, 3)}`],
        [`caliper ${VIZ.fmt(f1.c, 2)}: ATT · ancho de la banda`, `${VIZ.fmt(f1.att, 3)} · ${VIZ.fmt(f1.hi - f1.lo, 3)}`],
        ['rango de estimaciones', `${VIZ.fmt(Math.min(...filas.map((f) => f.att)), 3)} – ${VIZ.fmt(Math.max(...filas.map((f) => f.att)), 3)}`],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const v = pl.ix(x);
      hover = filas.reduce((a, b) => (Math.abs(b.x - v) < Math.abs(a.x - v) ? b : a));
      dibujar();
      tip.mostrar(x, y, `caliper <b>${VIZ.fmt(hover.c, 3)}</b>` + VIZ.filaTooltip(C.s1, 'ATT estimado', `${VIZ.fmt(hover.att, 3)} [${VIZ.fmt(hover.lo, 3)}, ${VIZ.fmt(hover.hi, 3)}]`) + VIZ.filaTooltip(C.s4, 'verdadero', VIZ.fmt(hover.verdad, 3)) + VIZ.filaTooltip(C.s3, 'tratados conservados', M.pct(hover.ret, 0)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('hyperparameter-sensitivity', {
    intro: String.raw`
      <p>Casi todo resultado de minería de datos depende de decisiones del analista: \(\varepsilon\) y MinPts en DBSCAN, \(k\) en k-means, la perplejidad de
      t-SNE, el caliper de un matching, las covariables de un modelo. Si un pequeño cambio en una de ellas cambia la conclusión, la conclusión
      no es confiable.</p>
      <p>El <strong>análisis de robustez</strong> recorre un rango razonable de cada hiperparámetro y, con <a href="tema.html?id=bootstrap">bootstrap</a>,
      mide también cuánto varía el resultado con los datos. Lo que se busca son <strong>mesetas</strong>: zonas donde el resultado es estable en ambos sentidos.</p>`,
    visualizaciones: [
      {
        titulo: 'DBSCAN según ε',
        descripcion: 'Número de grupos y estabilidad a lo largo de ε, con remuestras bootstrap. Compare la meseta de «Tres manchas» con la de «Densidades distintas».',
        montar: montarDBSCAN,
      },
      {
        titulo: 'Un efecto causal según el caliper',
        descripcion: 'El ATT estimado por matching para distintos calipers, con su banda bootstrap y el valor verdadero.',
        montar: montarCaliper,
      },
    ],
    teoria: String.raw`
      <h2>Dos fuentes de variación</h2>
      <p>Para un resultado \(R(\lambda, D)\) que depende de un hiperparámetro \(\lambda\) y de los datos \(D\):</p>
      <ul>
        <li><strong>Sensibilidad</strong>: cómo cambia \(R\) con \(\lambda\) para \(D\) fijo.</li>
        <li><strong>Estabilidad</strong>: cómo cambia \(R\) con \(D\) (remuestras) para \(\lambda\) fijo.</li>
      </ul>
      <p>Un buen \(\lambda\) está en una región donde ambas son bajas. Para resultados categóricos (agrupamientos) se mide con el
      <a href="tema.html?id=unsupervised-evaluation">ARI entre corridas</a>; para numéricos, con bandas de cuantiles o intervalos bootstrap.</p>
      <h2>Procedimiento</h2>
      <pre><code>para cada λ en una rejilla razonable:
    R(λ) ← método(D, λ)
    para b ← 1 hasta B:  R_b(λ) ← método(D*_b, λ)
    resumir: valor, banda, acuerdo con R(λ)
informar el resultado junto con el rango de λ en que se sostiene</code></pre>
      <h2>Buenas prácticas</h2>
      <ul>
        <li>Fijar la rejilla <em>antes</em> de mirar resultados y reportarla completa (no solo el mejor punto): elegir \(\lambda\) mirando el resultado es una forma de
        sobreajuste («jardín de senderos que se bifurcan»).</li>
        <li>Separar los hiperparámetros que deberían importar poco (semillas, orden de los datos) de los sustantivos; los primeros miden ruido del método.</li>
        <li>En inferencia causal, presentar el efecto con varios métodos y especificaciones (<em>análisis multiverso</em>), junto con las
        <a href="tema.html?id=causal-refutation">pruebas de refutación</a> y el <a href="tema.html?id=bias-variance">compromiso entre sesgo y varianza</a>.</li>
        <li>En reducción de dimensionalidad, comparar mapas con varias perplejidades o valores de <code>n_neighbors</code>
        (<a href="tema.html?id=dimensionality-reduction-comparison">comparación de métodos</a>).</li>
      </ul>`,
  });
})();