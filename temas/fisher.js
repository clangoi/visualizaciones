(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;
  const CLS = [C.s1, C.s2, C.s3];
  const DOM = { xmin: -2.6, xmax: 2.6, ymin: -2, ymax: 2 };

  // Datos compartidos por las dos figuras.
  const datos = { pts: [], K: 2, oyentes: [] };
  const op = { sep: 0.6, rho: 0.8, K: 2, semilla: 3 };
  function generar() {
    const rnd = VIZ.semilla(op.semilla), pts = [];
    // Clases alargadas en la dirección (1, 1) y separadas en una dirección oblicua: el eje que mejor separa no es el de mayor varianza.
    const centros = op.K === 2 ? [[-0.5, 0.5], [0.5, -0.5]] : [[-0.6, 0.6], [0.6, -0.6], [0.9, 0.9]];
    for (let c = 0; c < op.K; c++) for (let i = 0; i < 60; i++) {
      const z1 = VIZ.normal(rnd), z2 = VIZ.normal(rnd);
      const a = 0.55 * z1, b = 0.55 * (op.rho * z1 + Math.sqrt(1 - op.rho * op.rho) * z2);
      pts.push({ x: centros[c][0] * op.sep + a, y: centros[c][1] * op.sep + b, c });
    }
    datos.pts = pts; datos.K = op.K;
    datos.oyentes.forEach((f) => f());
  }
  const matrizX = () => datos.pts.map((p) => [p.x, p.y]);
  const etiquetas = () => datos.pts.map((p) => p.c);
  function estadisticas() {
    const X = matrizX(), y = etiquetas(), D = P.dispersion(X, y);
    const clases = P.porClase(X, y).map((g) => ({ mu: P.media(g), S: P.cov(g) }));
    const M = P.mul(P.inv(D.Sw), D.Sb);
    // Dirección de Fisher: vector propio principal de Sw⁻¹Sb (no simétrica): iteración de potencia.
    let w = [1, 0.3];
    for (let k = 0; k < 100; k++) { w = P.mulVec(M, w); const n = Math.hypot(...w) || 1; w = w.map((v) => v / n); }
    return { ...D, clases, w, J: M[0][0] + M[1][1], J1: P.fisher(X, y, [0]), J2: P.fisher(X, y, [1]) };
  }
  const Jtheta = (D, th) => {
    const w = [Math.cos(th), Math.sin(th)];
    return P.punto(w, P.mulVec(D.Sb, w)) / P.punto(w, P.mulVec(D.Sw, w));
  };

  /* ---------- Fig. 1: matrices de dispersión ---------- */

  function montarDispersion(cuerpo) {
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Clases', opciones: [['2', 'Dos'], ['3', 'Tres']], valor: String(op.K), alCambiar: (v) => { op.K = +v; generar(); } });
    ctl.rango({ etiqueta: 'Separación de medias', min: 0, max: 3, paso: 0.05, valor: op.sep, formato: (v) => v.toFixed(2), alCambiar: (v) => { op.sep = v; generar(); } });
    ctl.rango({ etiqueta: 'Correlación intra-clase ρ', min: -0.95, max: 0.95, paso: 0.05, valor: op.rho, formato: (v) => v.toFixed(2), alCambiar: (v) => { op.rho = v; generar(); } });
    ctl.boton('Nuevos datos', () => { op.semilla++; generar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...['clase 0', 'clase 1', 'clase 2'].map((t, c) => ({ color: CLS[c], texto: t, forma: c ? 'cuadro' : 'punto' })),
      { color: C.tinta, texto: 'media global y medias de clase (S_b)', forma: 'linea' },
      { color: C.eje, texto: 'elipse de cada clase: 2σ de su covarianza', forma: 'linea' },
      { color: C.apagado, texto: 'S_w, covarianza intra-clase promedio', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ponga ρ en 0 y luego en 0,9: con las clases alargadas en diagonal, cada eje por separado separa poco (J₁, J₂ bajos), pero juntos separan mucho más porque S_w⁻¹ «descuenta» la dirección del ruido.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂', margen: { izq: 40 } });
      plano.ejes();
      const E = estadisticas();
      E.clases.forEach((k, c) => P.elipse(ctx, plano, k.mu, k.S, 2, { color: CLS[c], ancho: 1.5, relleno: VIZ.alfa(CLS[c], 0.06) }));
      P.elipse(ctx, plano, E.mu, E.Sw, 2, { color: C.apagado, ancho: 1.5, guiones: [4, 4] });
      for (const p of datos.pts) VIZ.marcador(ctx, plano.sx(p.x), plano.sy(p.y), VIZ.alfa(CLS[p.c], 0.75), 3.5, p.c);
      ctx.save();
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 2;
      for (const k of E.clases) {
        ctx.beginPath(); ctx.moveTo(plano.sx(E.mu[0]), plano.sy(E.mu[1])); ctx.lineTo(plano.sx(k.mu[0]), plano.sy(k.mu[1])); ctx.stroke();
      }
      ctx.restore();
      E.clases.forEach((k, c) => VIZ.marcador(ctx, plano.sx(k.mu[0]), plano.sy(k.mu[1]), CLS[c], 6, c));
      VIZ.marcador(ctx, plano.sx(E.mu[0]), plano.sy(E.mu[1]), C.tinta, 5);
      const f = (M) => `[${M.map((r) => r.map((v) => VIZ.fmt(v, 2)).join(' ')).join('; ')}]`;
      lectura.set([
        ['S_w', f(E.Sw)],
        ['S_b', f(E.Sb)],
        ['J₁ (solo x₁)', E.J1.toFixed(3)],
        ['J₂ (solo x₂)', E.J2.toFixed(3)],
        ['J = tr(S_w⁻¹ S_b)', E.J.toFixed(3)],
      ]);
    }
    lienzo.alDibujar = () => datos.pts.length && dibujar();
    datos.oyentes.push(dibujar);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = VIZ.ml.cercano(plano, datos.pts, x, y);
      if (i < 0) return tip.ocultar();
      const p = datos.pts[i];
      tip.mostrar(x, y, VIZ.filaTooltip(CLS[p.c], `clase ${p.c}`) + `x₁ <b>${VIZ.fmt(p.x, 3)}</b><br>x₂ <b>${VIZ.fmt(p.y, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
  }

  /* ---------- Fig. 2: la dirección de proyección ---------- */

  function montarProyeccion(cuerpo) {
    let th = 0;
    const ctl = VIZ.controles(cuerpo);
    const rTh = ctl.rango({ etiqueta: 'Dirección θ', min: 0, max: 180, valor: 0, formato: (v) => `${v}°`, alCambiar: (v) => { th = (v * Math.PI) / 180; dibujar(); } });
    ctl.boton('Dirección de Fisher', () => {
      const w = estadisticas().w;
      let a = Math.atan2(w[1], w[0]);
      if (a < 0) a += Math.PI;
      th = a; rTh.valor = Math.round((a * 180) / Math.PI); dibujar();
    }, { primario: true });
    ctl.boton('Mayor varianza (PCA)', () => {
      const v = P.eigSim(P.cov(matrizX())).vectores[0];
      let a = Math.atan2(v[1], v[0]);
      if (a < 0) a += Math.PI;
      th = a; rTh.valor = Math.round((a * 180) / Math.PI); dibujar();
    });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 220, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Proyección sobre la dirección elegida');
    const lienzoH = VIZ.lienzo(cuerpo, { proporcion: 0.22, altoMin: 150, altoMax: 200 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'J(θ) = wᵀS_b w / wᵀS_w w', forma: 'linea' },
      { color: C.s6, texto: 'máximo: dirección de Fisher', forma: 'linea' },
      { color: C.s7, texto: 'dirección de mayor varianza', forma: 'linea' },
      { color: C.s4, texto: 'θ elegido', forma: 'linea' },
      ...['clase 0', 'clase 1', 'clase 2'].map((t, c) => ({ color: CLS[c], texto: `${t} proyectada` })),
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los datos son los de la figura anterior. Pulse «Mayor varianza» y luego «Dirección de Fisher»: con clases alargadas, la dirección de mayor varianza mezcla las clases y la de Fisher las separa.');

    let plano = null, E = null, curva = [];
    function dibujar() {
      if (!datos.pts.length) return;
      E = estadisticas();
      const { ctx } = lienzo;
      lienzo.limpiar();
      curva = [];
      for (let g = 0; g <= 180; g++) curva.push([g, Jtheta(E, (g * Math.PI) / 180)]);
      const jmax = Math.max(...curva.map((p) => p[1]));
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 180, ymin: 0, ymax: jmax * 1.15 || 1 }, { etiquetaX: 'θ (grados)', etiquetaY: 'J(θ)', margen: { izq: 46 } });
      plano.ejes();
      const vline = (g, col, guion) => VIZ.trazar(ctx, plano, [[g, 0], [g, jmax * 1.15]], col, 2, guion);
      let af = Math.atan2(E.w[1], E.w[0]); if (af < 0) af += Math.PI;
      const v = P.eigSim(P.cov(matrizX())).vectores[0];
      let ap = Math.atan2(v[1], v[0]); if (ap < 0) ap += Math.PI;
      vline((af * 180) / Math.PI, C.s6, [5, 4]);
      vline((ap * 180) / Math.PI, C.s7, [5, 4]);
      vline((th * 180) / Math.PI, C.s4);
      VIZ.trazar(ctx, plano, curva, C.tinta, 2);
      VIZ.marcador(ctx, plano.sx((th * 180) / Math.PI), plano.sy(Jtheta(E, th)), C.s4, 5);
      dibujarH();
      lectura.set([
        ['θ', `${Math.round((th * 180) / Math.PI)}°`],
        ['J(θ)', Jtheta(E, th).toFixed(3)],
        ['J máximo (Fisher)', Jtheta(E, af).toFixed(3)],
        ['J en la dirección de PCA', Jtheta(E, ap).toFixed(3)],
      ]);
    }
    function dibujarH() {
      const { ctx } = lienzoH;
      lienzoH.limpiar();
      const w = [Math.cos(th), Math.sin(th)];
      const z = datos.pts.map((p) => ({ v: p.x * w[0] + p.y * w[1], c: p.c }));
      const B = 40, zmin = -3.5, zmax = 3.5, h = Array.from({ length: datos.K }, () => new Array(B).fill(0));
      for (const q of z) { const b = Math.floor(((q.v - zmin) / (zmax - zmin)) * B); if (b >= 0 && b < B) h[q.c][b]++; }
      const hm = Math.max(...h.flat()) || 1;
      const pl = VIZ.plano(lienzoH, { xmin: zmin, xmax: zmax, ymin: 0, ymax: hm * 1.1 }, { etiquetaX: 'z = wᵀx', margen: { izq: 46 } });
      pl.ejes();
      const bw = pl.sx(zmin + (zmax - zmin) / B) - pl.sx(zmin);
      for (let c = 0; c < datos.K; c++) for (let b = 0; b < B; b++) {
        if (!h[c][b]) continue;
        ctx.fillStyle = VIZ.alfa(CLS[c], 0.55);
        ctx.fillRect(pl.sx(zmin + (b * (zmax - zmin)) / B) + 1, pl.sy(h[c][b]), bw - 2, pl.y0 - pl.sy(h[c][b]));
      }
    }
    lienzo.alDibujar = dibujar;
    lienzoH.alDibujar = () => E && dibujarH();
    datos.oyentes.push(dibujar);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const g = Math.round(plano.ix(x));
      tip.mostrar(x, y, `θ = <b>${g}°</b><br>J(θ) <b>${curva[g][1].toFixed(3)}</b><br>clic para elegir`);
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      const g = Math.min(180, Math.max(0, Math.round(plano.ix(x))));
      th = (g * Math.PI) / 180; rTh.valor = g; dibujar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
  }

  function montarTodo(montar) {
    return (cuerpo) => { montar(cuerpo); if (!datos.pts.length) generar(); else datos.oyentes[datos.oyentes.length - 1](); };
  }

  VIZ.registrarTema('fisher', {
    intro: String.raw`
      <p>Para comparar subconjuntos de características hace falta un número que diga qué tan bien separan las clases. El
      <strong>criterio de Fisher</strong> lo define con dos matrices de covarianza: la dispersión <em>dentro</em> de cada clase,
      que se quiere pequeña, y la dispersión <em>entre</em> las medias de las clases, que se quiere grande.</p>
      <p>El mismo cociente responde otra pregunta: ¿sobre qué recta conviene proyectar los datos para que las clases queden
      lo más separadas posible? Esa recta es el <strong>discriminante lineal de Fisher</strong>, y en general no coincide con
      la dirección de mayor varianza.</p>`,
    visualizaciones: [
      {
        titulo: 'Dispersión intra y entre clases',
        descripcion: 'Las elipses muestran la covarianza de cada clase; los segmentos negros, la dispersión de las medias. J resume ambas en un número.',
        montar: montarTodo(montarDispersion),
      },
      {
        titulo: 'La dirección de proyección',
        descripcion: 'Arriba, el cociente J(θ) para cada dirección; abajo, los datos proyectados sobre la dirección elegida. Haga clic en la curva para elegir θ.',
        montar: montarTodo(montarProyeccion),
      },
    ],
    teoria: String.raw`
      <h2>Matrices de dispersión</h2>
      <p>Con \(K\) clases, \(n_k\) muestras en la clase \(k\), media \(\mu_k\), covarianza \(\Sigma_k\), probabilidad
      \(p_k = n_k / n\) y media global \(\mu\):</p>
      \[ S_w = \sum_{k=1}^{K} p_k\, \Sigma_k, \qquad S_b = \sum_{k=1}^{K} p_k\, (\mu_k - \mu)(\mu_k - \mu)^\top. \]
      <p>\(S_w\) mide cuánto varían los objetos de una misma clase; \(S_b\), cuánto se alejan las medias de las clases de la
      media global. La covarianza total es \(S_t = S_w + S_b\).</p>
      <h2>Criterio para seleccionar características</h2>
      \[ J = \operatorname{tr}\!\left(S_w^{-1} S_b\right). \]
      <p>Es la suma de los valores propios de \(S_w^{-1} S_b\). No cambia si se reescala o se rota el espacio de características
      (cualquier transformación lineal invertible \(A\) cumple \(S_w \to A S_w A^\top\), \(S_b \to A S_b A^\top\)), y es
      <strong>monótono</strong>: agregar una característica nunca lo disminuye. Esta última propiedad es la que necesita
      <a href="tema.html?id=branch-and-bound">branch and bound</a>, y también explica por qué hay que comparar subconjuntos del
      mismo tamaño.</p>
      <h2>Discriminante lineal de Fisher</h2>
      <p>Proyectando sobre \(z = w^\top x\), la dispersión entre clases es \(w^\top S_b w\) y la de dentro, \(w^\top S_w w\). Fisher
      maximiza el cociente de Rayleigh</p>
      \[ J(w) = \frac{w^\top S_b\, w}{w^\top S_w\, w}. \]
      <p>Derivando, el óptimo cumple \(S_b w = \lambda S_w w\): \(w\) es el vector propio de \(S_w^{-1} S_b\) con mayor valor propio, y
      \(J(w^*) = \lambda_{\max}\). Con dos clases, \(S_b w\) siempre apunta en la dirección de \(\mu_1 - \mu_0\), así que</p>
      \[ w^* \propto S_w^{-1} (\mu_1 - \mu_0). \]
      <p>Con \(K\) clases, \(S_b\) tiene rango \(K - 1\) como máximo y hay a lo sumo \(K - 1\) direcciones útiles: LDA proyecta a
      \(K - 1\) dimensiones.</p>
      <h2>Fisher frente a PCA</h2>
      <p><a href="tema.html?id=pca">PCA</a> elige la dirección de mayor varianza total, sin mirar las clases. Si el ruido dentro de
      cada clase es más grande que la distancia entre medias y apunta en otra dirección, PCA proyecta justo sobre el ruido.
      Fisher divide por \(S_w\), y por eso «descuenta» la dirección del ruido.</p>
      <div class="recuadro"><p>Si además las clases son gaussianas con igual covarianza, la dirección de Fisher coincide con la
      frontera del clasificador bayesiano óptimo: es el clasificador <a href="tema.html?id=lda-qda">LDA</a>.</p></div>`,
  });
})();
