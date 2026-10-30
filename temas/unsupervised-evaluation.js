(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };
  // Silueta de cada punto: (b − a) / max(a, b).
  function siluetas(pts, et) {
    const d = (i, j) => Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), K = Math.max(...et) + 1;
    return pts.map((_, i) => {
      const prom = (g) => { const m = pts.map((__, j) => j).filter((j) => et[j] === g && j !== i); return m.length ? M.media(m.map((j) => d(i, j))) : 0; };
      const a = prom(et[i]), b = Math.min(...Array.from({ length: K }, (_, g) => g).filter((g) => g !== et[i]).map(prom));
      return et.filter((e) => e === et[i]).length > 1 ? (b - a) / Math.max(a, b) : 0;
    });
  }

  /* ---------- Fig. 1: el gráfico de silueta ---------- */

  function montarSilueta(cuerpo) {
    let tipo = 'manchas', k = 3, semilla = 1, pts = [], et = [], s = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'k-means con k', min: 2, max: 8, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.5) : Math.min(400, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En el gráfico de barras, una por punto, agrupadas por grupo y ordenadas. Silueta cercana a 1: el punto está bien dentro de su grupo; cerca de 0: en la frontera; negativa: probablemente en el grupo equivocado. Pruebe k = 2, 3 y 4 en «Tres manchas».');
    function generar() { pts = M.datos2d(tipo, 180, semilla); calcular(); }
    function calcular() { et = M.kmedias(pts, k, semilla).etiqueta; s = siluetas(pts, et); dibujar(); }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.5, hA = vertical ? H * 0.5 : H;
      ctx.save();
      const pl = planoDatos({ ...lienzo, ancho: wA, alto: hA, ctx });
      pl.ejes();
      M.dispersion(ctx, pl, pts, { color: (p, i) => M.colorGrupo(et[i]), forma: (p, i) => et[i], r: 3, hueco: (p, i) => s[i] < 0 });
      ctx.restore();
      ctx.save();
      const ox = vertical ? 0 : wA + 10, oy = vertical ? hA : 0;
      ctx.translate(ox, oy);
      const sub = { ...lienzo, ancho: W - ox, alto: H - oy, ctx };
      const pb = VIZ.plano(sub, { xmin: Math.min(-0.2, ...s), xmax: 1, ymin: 0, ymax: pts.length + 4 * k }, { etiquetaX: 'silueta', ticksY: [], margen: { izq: 24 } });
      pb.ejes();
      let y = 0;
      const filas = [];
      for (let g = 0; g < k; g++) {
        const v = pts.map((_, i) => i).filter((i) => et[i] === g).sort((a, b) => s[a] - s[b]);
        v.forEach((i) => { ctx.fillStyle = M.colorGrupo(g); const x0 = pb.sx(0), x1 = pb.sx(s[i]); ctx.fillRect(Math.min(x0, x1), pb.sy(y + 1), Math.abs(x1 - x0) || 0.5, Math.max(1, pb.sy(y) - pb.sy(y + 1))); filas.push({ y0: pb.sy(y + 1) + oy, y1: pb.sy(y) + oy, i }); y++; });
        y += 4;
      }
      const sm = M.media(s);
      VIZ.trazar(ctx, pb, [[sm, 0], [sm, pb.d.ymax]], C.tinta, 1.5, [4, 3]);
      VIZ.trazar(ctx, pb, [[0, 0], [0, pb.d.ymax]], C.eje, 1);
      ctx.restore();
      geo = { filas, ox };
      leyenda.set([...M.leyendaGrupos(k), { color: C.tinta, texto: 'silueta media', forma: 'linea' }]);
      lectura.set([
        ['silueta media', VIZ.fmt(sm, 3)],
        ['puntos con silueta negativa', String(s.filter((v) => v < 0).length)],
        ['ARI con los grupos reales', VIZ.fmt(M.randAjustado(et, pts.map((p) => p.g)), 3)],
      ]);
    }
    lienzo.alDibujar = () => s.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!geo || x < geo.ox) return tip.ocultar();
      const f = geo.filas.find((q) => y >= q.y0 && y <= q.y1);
      if (!f) return tip.ocultar();
      tip.mostrar(x, y, `grupo <b>${et[f.i] + 1}</b><br>silueta <b>${VIZ.fmt(s[f.i], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: elegir k con tres criterios ---------- */

  function montarCriterios(cuerpo) {
    let tipo = 'manchas', semilla = 1, filas = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['sil', 'silueta media (interno)', C.s1], ['estab', 'estabilidad bootstrap (ARI entre corridas)', C.s3], ['ari', 'ARI con los grupos reales (externo)', C.s2]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'k-means con k = 2 … 8. La silueta usa solo los datos; la estabilidad compara agrupamientos de remuestras bootstrap; el ARI externo solo existe cuando se conocen los grupos (aquí, porque los datos son sintéticos). En lunas y anillos, k-means no encuentra la estructura con ningún k.');
    function calcular() {
      const pts = M.datos2d(tipo, 160, semilla), verdad = pts.map((p) => p.g), rnd = VIZ.semilla(semilla * 3);
      filas = [];
      for (let k = 2; k <= 8; k++) {
        const base = M.kmedias(pts, k, semilla);
        const etiquetasDe = (cent) => pts.map((p) => { let m = 0; cent.forEach((q, j) => { if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < (p.x - cent[m].x) ** 2 + (p.y - cent[m].y) ** 2) m = j; }); return m; });
        const corridas = Array.from({ length: 8 }, (_, b) => { const re = pts.map(() => pts[Math.floor(rnd() * pts.length)]); return etiquetasDe(M.kmedias(re, k, semilla + b + 1).centros); });
        let st = 0, c = 0;
        for (let a = 0; a < corridas.length; a++) for (let b = a + 1; b < corridas.length; b++) { st += M.randAjustado(corridas[a], corridas[b]); c++; }
        filas.push({ k, sil: M.silueta(pts, base.etiqueta), estab: st / c, ari: M.randAjustado(base.etiqueta, verdad) });
      }
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 2, xmax: 8, ymin: Math.min(0, ...filas.map((f) => f.ari)), ymax: 1 }, { etiquetaX: 'k', etiquetaY: 'valor (mayor es mejor)' });
      pl.ejes();
      for (const [key, , col] of SER) {
        VIZ.trazar(ctx, pl, filas.map((f) => [f.k, f[key]]), col, 2);
        for (const f of filas) VIZ.marcador(ctx, pl.sx(f.k), pl.sy(f[key]), col, f === hover ? 5 : 3);
      }
      const mejor = (key) => filas.reduce((a, b) => (b[key] > a[key] ? b : a)).k;
      lectura.set([
        ['k con mayor silueta', String(mejor('sil'))],
        ['k más estable', String(mejor('estab'))],
        ['k con mayor ARI externo', String(mejor('ari'))],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = filas[Math.max(0, Math.min(6, Math.round(pl.ix(x)) - 2))];
      dibujar();
      tip.mostrar(x, y, `k = <b>${hover.k}</b>` + SER.map(([key, t, c]) => VIZ.filaTooltip(c, t.split(' (')[0], VIZ.fmt(hover[key], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('unsupervised-evaluation', {
    intro: String.raw`
      <p>Evaluar un agrupamiento es difícil porque no hay respuesta correcta con la que comparar. Se usan tres tipos de criterios:
      <strong>internos</strong> (qué tan compactos y separados son los grupos, usando solo los datos), <strong>externos</strong> (acuerdo con
      etiquetas conocidas, cuando existen) y de <strong>estabilidad</strong> (si el resultado se repite con datos ligeramente distintos).</p>
      <p>Ninguno basta solo: un criterio interno favorece las formas que el algoritmo ya supone, y la estabilidad puede ser alta para una
      partición mala pero consistente.</p>`,
    visualizaciones: [
      {
        titulo: 'El gráfico de silueta',
        descripcion: 'k-means con el k elegido y la silueta de cada punto. Los puntos huecos tienen silueta negativa.',
        montar: montarSilueta,
      },
      {
        titulo: 'Elegir k con tres criterios',
        descripcion: 'Silueta, estabilidad bootstrap y ARI externo para k = 2 … 8. Compare en qué conjuntos coinciden.',
        montar: montarCriterios,
      },
    ],
    teoria: String.raw`
      <h2>Criterios internos</h2>
      <p><strong>Silueta</strong> (Rousseeuw, 1987): con \(a(i)\) la distancia media de \(i\) a su grupo y \(b(i)\) la menor distancia media a otro grupo,</p>
      \[ s(i) = \frac{b(i) - a(i)}{\max\{a(i), b(i)\}} \in [-1, 1]. \]
      <p>Otros: Davies–Bouldin (menor es mejor), Calinski–Harabasz (cociente de dispersión entre y dentro de grupos), la inercia de k-means y su
      <a href="tema.html?id=kmeans">codo</a>, y para modelos probabilísticos, <a href="tema.html?id=gaussian-mixture-models">BIC</a>. Todos favorecen grupos convexos y
      compactos: no sirven para juzgar a <a href="tema.html?id=dbscan">DBSCAN</a> en formas alargadas.</p>
      <h2>Criterios externos</h2>
      <p>El <strong>índice de Rand ajustado</strong> compara dos particiones contando pares de puntos que ambas ponen juntos o separados, corregido por azar:</p>
      \[ \mathrm{ARI} = \frac{\sum_{ij} \binom{n_{ij}}{2} - \bigl[\sum_i \binom{a_i}{2} \sum_j \binom{b_j}{2}\bigr] / \binom n2}{\tfrac12\bigl[\sum_i \binom{a_i}{2} + \sum_j \binom{b_j}{2}\bigr] - \bigl[\sum_i \binom{a_i}{2} \sum_j \binom{b_j}{2}\bigr] / \binom n2}. \]
      <p>Vale 1 para particiones idénticas y ~0 para particiones al azar. Alternativas: información mutua normalizada, pureza.</p>
      <h2>Estabilidad</h2>
      <pre><code>para b ← 1 hasta B:
    remuestra (bootstrap) o submuestra de los datos
    agrupar y extender las etiquetas a todos los puntos
estabilidad ← ARI promedio entre pares de corridas</code></pre>
      <p>Un número de grupos «real» tiende a dar particiones que se repiten; uno arbitrario, particiones que cambian con cada muestra. Es la
      aplicación del <a href="tema.html?id=bootstrap">bootstrap</a> a resultados no supervisados (ver también
      <a href="tema.html?id=hyperparameter-sensitivity">sensibilidad a hiperparámetros</a>).</p>`,
  });
})();