(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };
  const ajustarGMM = (pts, k) => {
    let mejor = null;
    for (let s = 0; s < 3; s++) { const g = M.gmm(pts, k, { semilla: 5 + 13 * s }); for (let i = 0; i < 80; i++) g.paso(); if (!mejor || g.logv > mejor.logv) mejor = g; }
    return mejor;
  };
  const argmax = (r) => r.indexOf(Math.max(...r));

  /* ---------- Fig. 1: lado a lado ---------- */

  function montarLados(cuerpo) {
    let tipo = 'lunas', k = 2, eps = 0.13, minPts = 5, ruido = 0.05, semilla = 1, pts = [], G = null, D = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'GMM: componentes k', min: 1, max: 6, valor: k, alCambiar: (v) => { k = v; G = ajustarGMM(pts, k); dibujar(); } });
    ctl.rango({ etiqueta: 'DBSCAN: ε', min: 0.04, max: 0.35, paso: 0.01, valor: eps, formato: (v) => v.toFixed(2), alCambiar: (v) => { eps = v; D = M.dbscan(pts, eps, minPts); dibujar(); } });
    ctl.rango({ etiqueta: 'DBSCAN: MinPts', min: 2, max: 15, valor: minPts, alCambiar: (v) => { minPts = v; D = M.dbscan(pts, eps, minPts); dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido de fondo', min: 0, max: 0.2, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; }, alSoltar: () => generar() });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.5) : Math.min(400, Math.round(w * 0.42))) });
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'GMM asigna todo punto a alguna componente (no conoce el ruido) y sus grupos son elipses. DBSCAN sigue cualquier forma y deja fuera el ruido, pero necesita que la densidad sea parecida en todos los grupos. Pruebe lunas, anillos y densidades distintas.');
    function generar() { pts = M.datos2d(tipo, 220, semilla, { ruido }); G = ajustarGMM(pts, k); D = M.dbscan(pts, eps, minPts); dibujar(); }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, w = vertical ? W : W / 2, h = vertical ? H / 2 : H;
      const etG = G.resp.map(argmax), etD = D.etiqueta;
      [['GMM', etG, (i) => false], ['DBSCAN', etD, (i) => D.tipo[i] === 'borde']].forEach(([nombre, et, hueco], j) => {
        ctx.save(); ctx.translate(vertical ? 0 : j * w, vertical ? j * h : 0);
        const pl = planoDatos({ ...lienzo, ancho: w, alto: h, ctx });
        pl.ejes();
        if (j === 0) G.comps.forEach((c, q) => M.elipse(ctx, pl, c.mu, c.S, 2, VIZ.series[q], { ancho: 1.5, guiones: [5, 4] }));
        M.dispersion(ctx, pl, pts, { color: (p, i) => (et[i] < 0 ? C.tinta : M.colorGrupo(et[i])), forma: (p, i) => (et[i] < 0 ? 5 : et[i]), hueco: (p, i) => hueco(i), r: 3.2 });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(nombre, pl.x1 - 4, pl.y1 + 4);
        ctx.restore();
      });
      const verdad = pts.map((p) => p.g);
      leyenda.set([...M.leyendaGrupos(Math.max(k, D.grupos, 1)), { color: C.tinta, texto: 'ruido de DBSCAN (cruz)', forma: 'cuadro' }, { color: C.s1, texto: 'elipse 2σ de cada componente', forma: 'linea' }]);
      lectura.set([
        ['ARI GMM · DBSCAN', `${VIZ.fmt(M.randAjustado(etG, verdad), 2)} · ${VIZ.fmt(M.randAjustado(etD, verdad), 2)}`],
        ['grupos DBSCAN', String(D.grupos)],
        ['ruido DBSCAN · ruido real', `${etD.filter((e) => e < 0).length} · ${verdad.filter((g) => g < 0).length}`],
        ['ℓ de la mezcla', VIZ.fmt(G.logv, 4)],
      ]);
    }
    lienzo.alDibujar = () => G && dibujar();
    generar();
  }

  /* ---------- Fig. 2: pertenencia blanda frente a dura ---------- */

  function montarBlanda(cuerpo) {
    let tipo = 'manchas', k = 3, semilla = 4, pts = [], G = null, D = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.rango({ etiqueta: 'GMM: componentes k', min: 2, max: 6, valor: k, alCambiar: (v) => { k = v; G = ajustarGMM(pts, k); dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.rampaGris[4], texto: 'fondo oscuro: GMM duda entre componentes (entropía alta)' },
      { color: C.s1, texto: 'color: grupo de DBSCAN (relleno núcleo, hueco borde)', forma: 'punto' },
      { color: C.tinta, texto: 'ruido de DBSCAN (cruz)', forma: 'cuadro' },
      { color: C.s8, texto: 'ruido para DBSCAN pero GMM seguro (p > 0,95)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un punto para comparar las probabilidades de GMM con la etiqueta de DBSCAN. GMM puede estar «muy seguro» de un punto que está lejos de todo: su probabilidad posterior es relativa a las componentes, no a la densidad.');
    function generar() { pts = M.datos2d(tipo, 220, semilla, { ruido: 0.06, dispersion: 1.3 }); G = ajustarGMM(pts, k); D = M.dbscan(pts, 0.12, 5); dibujar(); }
    let pl = null;
    const entropia = (r) => -M.suma(r.map((v) => (v > 1e-12 ? v * Math.log(v) : 0))) / Math.log(r.length);
    const resp = (x, y) => { const v = G.comps.map((c) => c.pi * M.gauss2(x, y, c.mu, c.S)), s = M.suma(v) || 1e-300; return v.map((u) => u / s); };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      const paso = 6;
      for (let px = pl.x0; px < pl.x1; px += paso) for (let py = pl.y1; py < pl.y0; py += paso) {
        const h = entropia(resp(pl.ix(px + paso / 2), pl.iy(py + paso / 2)));
        if (h < 0.02) continue;
        ctx.fillStyle = VIZ.css(VIZ.enRampa(h, VIZ.rampaGris)); ctx.fillRect(px, py, paso, paso);
      }
      pl.ejes();
      const seguroRuido = (i) => D.etiqueta[i] < 0 && Math.max(...G.resp[i]) > 0.95;
      M.dispersion(ctx, pl, pts, { color: (p, i) => (D.etiqueta[i] < 0 ? C.tinta : M.colorGrupo(D.etiqueta[i])), forma: (p, i) => (D.etiqueta[i] < 0 ? 5 : D.etiqueta[i]), hueco: (p, i) => D.tipo[i] === 'borde', r: 3.4, anillo: (p, i) => (seguroRuido(i) ? C.s8 : null) });
      const ruido = D.etiqueta.filter((e) => e < 0).length;
      lectura.set([
        ['puntos con GMM inseguro (máx < 0,8)', String(G.resp.filter((r) => Math.max(...r) < 0.8).length)],
        ['ruido según DBSCAN', String(ruido)],
        ['de ellos, GMM con p > 0,95', String(pts.filter((_, i) => seguroRuido(i)).length)],
        ['puntos de borde (DBSCAN)', String(D.tipo.filter((t) => t === 'borde').length)],
      ]);
    }
    lienzo.alDibujar = () => G && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      if (pl) pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return tip.ocultar();
      const dens = M.suma(G.comps.map((c) => c.pi * M.gauss2(pts[m].x, pts[m].y, c.mu, c.S)));
      tip.mostrar(x, y, G.resp[m].map((v, j) => VIZ.filaTooltip(VIZ.series[j], `GMM p(${j + 1} | x)`, VIZ.fmt(v, 3))).join('') + `densidad de la mezcla <b>${VIZ.fmt(dens, 3)}</b><br>DBSCAN: <b>${D.etiqueta[m] < 0 ? 'ruido' : `grupo ${D.etiqueta[m] + 1} (${D.tipo[m]})`}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  VIZ.registrarTema('gmm-vs-dbscan', {
    intro: String.raw`
      <p>Las <a href="tema.html?id=gaussian-mixture-models">mezclas gaussianas</a> y <a href="tema.html?id=dbscan">DBSCAN</a> responden
      de formas opuestas a la pregunta «¿qué es un grupo?». Para GMM, un grupo es una <strong>población con distribución
      gaussiana</strong>; para DBSCAN, una <strong>región densa</strong> separada de otras por zonas vacías.</p>
      <p>De esa diferencia salen todas las demás: forma de los grupos, tratamiento del ruido, si hay que fijar \(k\), y si la
      pertenencia es una probabilidad o una etiqueta.</p>`,
    visualizaciones: [
      {
        titulo: 'Lado a lado',
        descripcion: 'Los dos métodos sobre los mismos datos. Busque un conjunto donde cada uno gane claramente al otro.',
        montar: montarLados,
      },
      {
        titulo: 'Pertenencia blanda frente a dura',
        descripcion: 'El fondo muestra dónde GMM duda entre componentes; los colores, la respuesta de DBSCAN. Observe los puntos con anillo rojo.',
        montar: montarBlanda,
      },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>GMM</th><th>DBSCAN</th></tr>
        <tr><td>Grupo</td><td>componente gaussiana</td><td>conjunto conectado por densidad</td></tr>
        <tr><td>Forma</td><td>elipses (convexas)</td><td>cualquiera</td></tr>
        <tr><td>Número de grupos</td><td>se fija \(k\) (o se elige con BIC)</td><td>sale de los datos</td></tr>
        <tr><td>Ruido</td><td>no existe: todo punto pertenece a alguna componente</td><td>explícito</td></tr>
        <tr><td>Pertenencia</td><td>probabilidad \(p(j \mid x)\)</td><td>etiqueta (núcleo, borde, ruido)</td></tr>
        <tr><td>Densidades distintas</td><td>bien (cada componente tiene su \(\Sigma\))</td><td>mal (un solo \(\varepsilon\))</td></tr>
        <tr><td>Modelo generativo</td><td>sí: densidad \(p(x)\), muestrear, puntuar datos nuevos</td><td>no</td></tr>
        <tr><td>Dimensión alta</td><td>muchos parámetros (\(O(kd^2)\))</td><td>distancias poco informativas</td></tr>
      </table>
      <h2>Dos tipos de incertidumbre</h2>
      <p>La posterior \(p(j \mid x)\) de GMM mide <em>a cuál</em> componente pertenece \(x\), suponiendo que pertenece a alguna. Un punto
      lejos de todo pero más cerca de una componente que de las otras tiene \(p(j \mid x) \approx 1\). Para detectar ruido con GMM hay que
      mirar la <strong>densidad</strong> \(p(x) = \sum_j \pi_j \mathcal N(x \mid \mu_j, \Sigma_j)\) y marcar los puntos con \(p(x)\) bajo; o
      agregar una componente uniforme de fondo.</p>
      <h2>Cuándo usar cada uno</h2>
      <ul>
        <li><strong>GMM</strong>: cuando los grupos son aproximadamente elípticos, se necesita una probabilidad de pertenencia o un modelo
        de densidad, o los grupos se solapan.</li>
        <li><strong>DBSCAN / <a href="tema.html?id=hdbscan">HDBSCAN</a></strong>: formas arbitrarias, presencia de ruido, \(k\) desconocido.</li>
      </ul>
      <p>Ambos dependen de hiperparámetros (\(k\) y tipo de covarianza; \(\varepsilon\) y MinPts) y conviene revisar la
      <a href="tema.html?id=hyperparameter-sensitivity">sensibilidad</a> del resultado a ellos.</p>`,
  });
})();