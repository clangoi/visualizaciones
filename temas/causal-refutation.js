(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Estudio con un confusor opcional U que no se mide. Las columnas: [x1, x2, x2², t, y] (+ u al final).
  function datos(n, semilla, oculto) {
    const rnd = VIZ.semilla(semilla), N = () => VIZ.normal(rnd);
    return Array.from({ length: n }, () => {
      const x1 = N(), x2 = N(), u = N();
      const e = 1 / (1 + Math.exp(-(0.6 * x1 + 0.8 * x2 + oculto * u)));
      const t = rnd() < e ? 1 : 0;
      const y = 1 + x1 + 1.5 * x2 + 0.5 * x2 * x2 + 2 * t + 1.5 * oculto * u + N();
      return [x1, x2, x2 * x2, t, y, u];
    });
  }
  // Efecto estimado: coeficiente de t en la regresión de y sobre t y las covariables observadas.
  const estimar = (D, extra = []) => M.regresion(D, 4, [3, 0, 1, 2, ...extra])[1];

  /* ---------- Fig. 1: pruebas de refutación ---------- */

  function montarRefutar(cuerpo) {
    let oculto = 0, semilla = 1, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Confusor no medido U', min: 0, max: 1.5, paso: 0.1, valor: oculto, formato: (v) => v.toFixed(1), alCambiar: (v) => { oculto = v; }, alSoltar: () => calcular() });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 280, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'efecto estimado (punto) y rango del 95 % en 100 repeticiones', forma: 'linea' },
      { color: C.tinta, texto: 'estimación original', forma: 'linea' },
      { color: C.s6, texto: 'valor que debería dar la prueba', forma: 'cuadro' },
      { color: C.s8, texto: 'efecto real (2)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada prueba altera los datos de una forma cuyo resultado esperado se conoce. Un placebo debe dar ~0; una causa común al azar o un subconjunto no deben mover la estimación. Suba el confusor no medido: la estimación se sesga, pero las tres pruebas siguen pasando. No detectan lo que no se midió.');
    function calcular() {
      const D = datos(800, semilla, oculto), orig = estimar(D), rnd = VIZ.semilla(semilla * 5);
      const placebo = [], comun = [], sub = [];
      for (let k = 0; k < 100; k++) {
        const tp = M.barajar(D.map((d) => d[3]), rnd);
        placebo.push(estimar(D.map((d, i) => [d[0], d[1], d[2], tp[i], d[4]])));
        comun.push(estimar(D.map((d) => [...d.slice(0, 5), VIZ.normal(rnd)]), [5]));
        sub.push(estimar(D.filter(() => rnd() < 0.5)));
      }
      const resumen = (v) => ({ m: M.media(v), lo: M.cuantil(v, 0.025), hi: M.cuantil(v, 0.975), v });
      res = {
        orig,
        pruebas: [
          { nombre: 'placebo', esperado: 0, ...resumen(placebo), p: (placebo.filter((v) => Math.abs(v) >= Math.abs(orig)).length + 1) / 101 },
          { nombre: 'causa común al azar', esperado: orig, ...resumen(comun) },
          { nombre: 'subconjunto 50 %', esperado: orig, ...resumen(sub) },
        ],
      };
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const P = res.pruebas, vals = [res.orig, 2, ...P.flatMap((p) => [p.lo, p.hi])];
      pl = VIZ.plano(lienzo, { xmin: Math.min(...vals) - 0.3, xmax: Math.max(...vals) + 0.3, ymin: -0.5, ymax: P.length - 0.5 }, { etiquetaX: 'efecto estimado', ticksY: [], margen: { izq: Math.min(160, lienzo.ancho * 0.4) } });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[res.orig, -0.5], [res.orig, P.length - 0.5]], C.tinta, 2);
      VIZ.trazar(ctx, pl, [[2, -0.5], [2, P.length - 0.5]], C.s8, 2, [5, 4]);
      P.forEach((p, i) => {
        const y = P.length - 1 - i;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(p.nombre, pl.x0 - 8, pl.sy(y));
        ctx.fillStyle = VIZ.alfa(C.s6, 0.25); ctx.fillRect(pl.sx(p.esperado) - 5, pl.sy(y) - 12, 10, 24);
        VIZ.trazar(ctx, pl, [[p.lo, y], [p.hi, y]], C.s1, 3);
        VIZ.marcador(ctx, pl.sx(p.m), pl.sy(y), C.s1, 5);
      });
      lectura.set([
        ['estimación original', VIZ.fmt(res.orig, 3)],
        ['efecto real', '2'],
        ['placebo: media · p-valor', `${VIZ.fmt(P[0].m, 3)} · ${VIZ.fmt(P[0].p, 3)}`],
        ['cambio con causa común · subconjunto', `${VIZ.fmt(P[1].m - res.orig, 3)} · ${VIZ.fmt(P[2].m - res.orig, 3)}`],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl) return;
      const i = res.pruebas.length - 1 - Math.round(pl.iy(y)), p = res.pruebas[i];
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `<b>${p.nombre}</b><br>media <b>${VIZ.fmt(p.m, 3)}</b>, 95 % [${VIZ.fmt(p.lo, 3)}, ${VIZ.fmt(p.hi, 3)}]<br>esperado ≈ ${VIZ.fmt(p.esperado, 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: análisis de sensibilidad ---------- */

  function montarSensibilidad(cuerpo) {
    let semilla = 1, grid = null, sel = null;
    const G = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(420, Math.max(300, w * 0.55)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'el efecto estimado se mantiene' },
      { color: VIZ.css(VIZ.enRampa(0.1)), texto: 'el efecto se anula' },
      { color: C.s8, texto: 'frontera: efecto = 1 (la mitad del original)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada combinación de fuerzas se simula un confusor U que aumenta la probabilidad de tratamiento (horizontal) y reduce el resultado (vertical) y se recalcula el efecto sin poder ajustar por U. La pregunta: ¿qué tan fuerte tendría que ser un confusor no medido para cambiar la conclusión? Haga clic en una celda.');
    function calcular() {
      grid = G.map((gt) => G.map((gy) => estimar(datosSens(gt, gy))));
      dibujar();
    }
    function datosSens(gt, gy) {
      const rnd = VIZ.semilla(semilla * 11), N = () => VIZ.normal(rnd);
      return Array.from({ length: 600 }, () => {
        const x1 = N(), x2 = N(), u = N();
        const t = rnd() < 1 / (1 + Math.exp(-(0.6 * x1 + 0.8 * x2 + 2 * gt * u))) ? 1 : 0;
        return [x1, x2, x2 * x2, t, 1 + x1 + 1.5 * x2 + 0.5 * x2 * x2 + 2 * t - 2 * gy * u + N()];
      });
    }
    let geo = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pl = VIZ.plano(lienzo, { xmin: -0.075, xmax: 1.575, ymin: -0.075, ymax: 1.575 }, { etiquetaX: 'fuerza de U sobre el tratamiento', etiquetaY: 'fuerza de U sobre el resultado', margen: { izq: 48 } });
      pl.ejes();
      const k = G.length, cw = (pl.x1 - pl.x0) / k, ch = (pl.y0 - pl.y1) / k;
      geo = { pl, cw, ch };
      G.forEach((gt, i) => G.forEach((gy, j) => {
        const v = grid[i][j];
        ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.max(0, Math.min(1, v / 2.2))));
        ctx.fillRect(pl.x0 + i * cw + 0.5, pl.y0 - (j + 1) * ch + 0.5, cw - 1, ch - 1);
        if (cw > 30) { ctx.fillStyle = v > 1.2 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(VIZ.fmt(v, 2), pl.x0 + (i + 0.5) * cw, pl.y0 - (j + 0.5) * ch); }
      }));
      // Frontera efecto = 1 entre celdas.
      ctx.strokeStyle = C.s8; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        const a = grid[i][j] >= 1;
        if (i + 1 < k && a !== (grid[i + 1][j] >= 1)) { const x = pl.x0 + (i + 1) * cw; ctx.moveTo(x, pl.y0 - j * ch); ctx.lineTo(x, pl.y0 - (j + 1) * ch); }
        if (j + 1 < k && a !== (grid[i][j + 1] >= 1)) { const y = pl.y0 - (j + 1) * ch; ctx.moveTo(pl.x0 + i * cw, y); ctx.lineTo(pl.x0 + (i + 1) * cw, y); }
      }
      ctx.stroke();
      if (sel) { ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5; ctx.strokeRect(pl.x0 + sel[0] * cw + 1, pl.y0 - (sel[1] + 1) * ch + 1, cw - 2, ch - 2); }
      lectura.set([
        ['sin confusor (esquina inferior izquierda)', VIZ.fmt(grid[0][0], 3)],
        ['celda elegida', sel ? `${VIZ.fmt(grid[sel[0]][sel[1]], 3)} (fuerzas ${G[sel[0]]}, ${G[sel[1]]})` : '— (haga clic)'],
        ['celdas donde el efecto cae bajo 1', `${grid.flat().filter((v) => v < 1).length} de ${k * k}`],
      ]);
    }
    lienzo.alDibujar = () => grid && dibujar();
    const celda = (x, y) => { const i = Math.floor((x - geo.pl.x0) / geo.cw), j = Math.floor((geo.pl.y0 - y) / geo.ch); return i >= 0 && i < G.length && j >= 0 && j < G.length ? [i, j] : null; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => { const { x, y } = lienzo.posicion(e), c = geo && celda(x, y); if (c) { sel = c; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), c = geo && celda(x, y);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `U → T: <b>${G[c[0]]}</b>, U → Y: <b>${G[c[1]]}</b><br>efecto estimado <b>${VIZ.fmt(grid[c[0]][c[1]], 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('causal-refutation', {
    intro: String.raw`
      <p>Un efecto causal estimado con datos observacionales descansa en supuestos que no se pueden verificar del todo, sobre todo el de
      <strong>no confusión</strong>. Las <strong>pruebas de refutación</strong> (popularizadas por la biblioteca DoWhy) intentan romper la estimación:
      cambian los datos de maneras cuyo resultado esperado se conoce y comprueban que el método se comporta como debería.</p>
      <p>Pasar estas pruebas no demuestra que la estimación sea correcta, pero fallarlas sí revela problemas. El <strong>análisis de sensibilidad</strong>
      complementa: cuantifica cuán fuerte tendría que ser un confusor no medido para cambiar la conclusión.</p>`,
    visualizaciones: [
      {
        titulo: 'Pruebas de refutación',
        descripcion: 'Placebo, causa común aleatoria y subconjunto de datos, cada una repetida 100 veces. Suba el confusor no medido y observe qué pruebas lo notan.',
        montar: montarRefutar,
      },
      {
        titulo: 'Análisis de sensibilidad',
        descripcion: 'El efecto estimado bajo confusores no medidos de distinta fuerza. La línea roja separa donde la conclusión cambia.',
        montar: montarSensibilidad,
      },
    ],
    teoria: String.raw`
      <h2>Pruebas</h2>
      <table>
        <tr><th>Prueba</th><th>Qué se hace</th><th>Resultado esperado</th><th>Detecta</th></tr>
        <tr><td>Placebo</td><td>reemplazar \(T\) por una permutación al azar</td><td>efecto ≈ 0</td><td>un método que «encuentra» efectos donde no hay</td></tr>
        <tr><td>Causa común aleatoria</td><td>agregar una covariable independiente</td><td>sin cambio</td><td>inestabilidad numérica, sobreajuste</td></tr>
        <tr><td>Subconjunto</td><td>reestimar en submuestras</td><td>sin cambio (más ruido)</td><td>dependencia de unos pocos datos</td></tr>
        <tr><td>Resultado ficticio</td><td>reemplazar \(Y\) por una variable no afectada por \(T\)</td><td>efecto ≈ 0</td><td>confusión residual en ese resultado</td></tr>
      </table>
      <p>El placebo se vuelve una <a href="tema.html?id=permutation-test">prueba de permutación</a>: si la estimación original no se distingue de las
      estimaciones con tratamiento barajado, no hay evidencia de efecto.</p>
      <div class="recuadro"><p>Ninguna prueba de refutación puede detectar un confusor no medido que afecte a \(T\) y a \(Y\): los datos observados son
      compatibles con ambos mundos. Para eso está el análisis de sensibilidad.</p></div>
      <h2>Análisis de sensibilidad</h2>
      <p>Se postula un confusor \(U\) con efecto \(\gamma\) sobre el tratamiento y \(\delta\) sobre el resultado y se calcula el sesgo que produciría. En un modelo
      lineal el sesgo del coeficiente es aproximadamente \(\delta \cdot \operatorname{cov}(T, U \mid X)/\operatorname{var}(T \mid X)\): crece con el producto de ambas fuerzas.
      Variantes conocidas: el <em>E-value</em> (VanderWeele y Ding), el enfoque de Rosenbaum para matching (\(\Gamma\)) y las cotas de Cinelli y Hazlett con \(R^2\)
      parciales. Las fuerzas se suelen comparar con las de las covariables medidas más importantes («un confusor tan fuerte como la gravedad»).</p>
      <h2>Flujo de validación</h2>
      <ol>
        <li>Modelar (grafo causal) e identificar (<a href="tema.html?id=backdoor-frontdoor">back-door</a>).</li>
        <li>Estimar con dos o más métodos (<a href="tema.html?id=matching">matching</a>, <a href="tema.html?id=outcome-models">regresión, AIPW</a>).</li>
        <li>Refutar y medir la <a href="tema.html?id=bootstrap">incertidumbre</a> y la <a href="tema.html?id=hyperparameter-sensitivity">sensibilidad a decisiones</a>.</li>
      </ol>`,
  });
})();