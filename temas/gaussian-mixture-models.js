(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const ML = VIZ.ml;

  const COV = [['completa', 'Completa'], ['diagonal', 'Diagonal'], ['esferica', 'Esférica']];
  const planoDatos = (l) => { const a = Math.max(1, (l.ancho / l.alto) * 0.95); return ML.plano(l, { dominio: { xmin: -1.15 * a, xmax: 1.15 * a, ymin: -1.15, ymax: 1.15 } }); };
  // Color de un punto: mezcla de los colores de las componentes ponderada por sus responsabilidades.
  function mezcla(r) {
    const c = [0, 0, 0];
    r.forEach((v, k) => { const [a, b, d] = VIZ.rgb(VIZ.series[k % 8]); c[0] += v * a; c[1] += v * b; c[2] += v * d; });
    return VIZ.css(c);
  }

  /* ---------- Fig. 1: EM paso a paso ---------- */

  function montarEM(cuerpo) {
    let tipo = 'alargadas', k = 3, cov = 'completa', semilla = 2, pts = [], est = null, hist = [], fase = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Componentes k', min: 1, max: 6, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Covarianza', opciones: COV, valor: cov, alCambiar: (v) => { cov = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Otro inicio', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El color de cada punto mezcla los colores de las componentes según su probabilidad de pertenencia: los puntos entre dos elipses quedan con un color intermedio. Pase el cursor para ver las probabilidades exactas.');
    function iniciar() {
      pts = M.datos2d(tipo, 240, 7);
      est = M.gmm(pts, k, { semilla, tipo: cov }); hist = [est.logv]; fase = 'Inicio desde k-means: covarianzas pequeñas y pesos iguales.';
      return (function* () {
        for (let it = 0; it < 150; it++) {
          est.m(); fase = `Paso M ${it + 1}: cada componente se reajusta con los puntos ponderados por su responsabilidad.`; yield;
          const antes = est.logv;
          est.e(); hist.push(est.logv); fase = `Paso E ${it + 1}: se recalculan las probabilidades de pertenencia. ℓ = ${VIZ.fmt(est.logv, 5)}.`; yield;
          if (Math.abs(est.logv - antes) < 1e-4) { fase = `Convergió en ${it + 1} iteraciones (ℓ cambia menos de 10⁻⁴).`; return; }
        }
      })();
    }
    let pl = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      pl = planoDatos(lienzo);
      pl.ejes();
      M.dispersion(ctx, pl, pts, { color: (p, i) => mezcla(est.resp[i]), r: 3.4 });
      est.comps.forEach((c, j) => { M.elipse(ctx, pl, c.mu, c.S, 1, VIZ.series[j], { ancho: 2.5 }); M.elipse(ctx, pl, c.mu, c.S, 2, VIZ.series[j], { ancho: 1.5, guiones: [5, 4] }); VIZ.marcador(ctx, pl.sx(c.mu[0]), pl.sy(c.mu[1]), VIZ.series[j], 5, 6); });
      // Recuadro con la curva de log-verosimilitud.
      if (hist.length > 1) {
        const w = Math.min(170, W * 0.32), h = 70, x0 = pl.x1 - w - 6, y0 = pl.y1 + 6;
        ctx.fillStyle = VIZ.alfa(C.superficie, 0.9); ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = C.rejilla; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
        const lo = Math.min(...hist), hi = Math.max(...hist);
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath();
        hist.forEach((v, i) => { const x = x0 + 6 + (i / Math.max(1, hist.length - 1)) * (w - 12), y = y0 + h - 8 - ((v - lo) / (hi - lo || 1)) * (h - 24); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('ℓ por iteración', x0 + 6, y0 + 3);
      }
      leyenda.set([...Array.from({ length: k }, (_, j) => ({ color: VIZ.series[j], texto: `componente ${j + 1}`, forma: 'linea' })), { color: mezcla([0.5, 0.5]), texto: 'punto compartido (mezcla de colores)', forma: 'punto' }]);
      registro.textContent = fase;
      const inciertos = est.resp.filter((r) => Math.max(...r) < 0.9).length;
      lectura.set([
        ['iteración', String(est.iter)],
        ['log-verosimilitud ℓ', VIZ.fmt(est.logv, 5)],
        ['pesos π', est.comps.map((c) => VIZ.fmt(c.pi, 2)).join(' · ')],
        ['puntos con máx. prob. < 0,9', String(inciertos)],
      ]);
    }
    lienzo.alDibujar = () => est && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let m = -1, dm = 10;
      if (pl) pts.forEach((p, i) => { const d = Math.hypot(pl.sx(p.x) - x, pl.sy(p.y) - y); if (d < dm) { dm = d; m = i; } });
      if (m < 0) return tip.ocultar();
      tip.mostrar(x, y, est.resp[m].map((v, j) => VIZ.filaTooltip(VIZ.series[j], `p(${j + 1} | x)`, VIZ.fmt(v, 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: elegir k con BIC ---------- */

  function montarBIC(cuerpo) {
    let tipo = 'manchas', cov = 'completa', semilla = 1, pts = [], filas = [], kSel = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos', opciones: M.DATOS2D, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.selector({ etiqueta: 'Covarianza', opciones: COV, valor: cov, alCambiar: (v) => { cov = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.3) : Math.min(380, Math.round(w * 0.4))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'BIC = −2ℓ + p ln n', forma: 'linea' },
      { color: C.s2, texto: 'AIC = −2ℓ + 2p', forma: 'linea' },
      { color: C.apagado, texto: '−2ℓ (siempre baja con k)', forma: 'linea' },
      { color: C.s6, texto: 'mínimo del BIC', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada k se ajusta una mezcla (mejor de 3 inicios). La verosimilitud siempre mejora con más componentes; BIC y AIC le restan una penalización por parámetro. Haga clic en el gráfico para ver el ajuste con ese k a la derecha.');
    function calcular() {
      pts = M.datos2d(tipo, 220, semilla);
      const n = pts.length;
      filas = [];
      for (let k = 1; k <= 8; k++) {
        let mejor = null;
        for (let s = 0; s < 3; s++) { const g = M.gmm(pts, k, { semilla: 11 * s + k, tipo: cov }); for (let i = 0; i < 80; i++) g.paso(); if (!mejor || g.logv > mejor.logv) mejor = g; }
        const p = mejor.parametros();
        filas.push({ k, g: mejor, m2l: -2 * mejor.logv, bic: -2 * mejor.logv + p * Math.log(n), aic: -2 * mejor.logv + 2 * p, p });
      }
      kSel = filas.reduce((a, b) => (b.bic < a.bic ? b : a)).k;
      dibujar();
    }
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wA = vertical ? W : W * 0.55, hA = vertical ? H * 0.5 : H;
      const ys = filas.flatMap((f) => [f.bic, f.aic, f.m2l]);
      const sub = { ...lienzo, ancho: wA, alto: hA, ctx };
      const pc = VIZ.plano(sub, { xmin: 1, xmax: 8, ymin: Math.min(...ys), ymax: Math.max(...ys) }, { etiquetaX: 'componentes k', etiquetaY: 'criterio (menor es mejor)', margen: { izq: 54 } });
      pc.ejes();
      for (const [key, col] of [['m2l', C.apagado], ['aic', C.s2], ['bic', C.s1]]) {
        VIZ.trazar(ctx, pc, filas.map((f) => [f.k, f[key]]), col, 2, key === 'm2l' ? [4, 3] : null);
        for (const f of filas) VIZ.marcador(ctx, pc.sx(f.k), pc.sy(f[key]), col, f.k === kSel ? 5 : 3);
      }
      const mejor = filas.reduce((a, b) => (b.bic < a.bic ? b : a));
      VIZ.marcador(ctx, pc.sx(mejor.k), pc.sy(mejor.bic), C.s6, 6);
      ctx.save();
      const ox = vertical ? 0 : wA, oy = vertical ? hA : 0;
      ctx.translate(ox, oy);
      const pl = planoDatos({ ...lienzo, ancho: vertical ? W : W - wA, alto: vertical ? H - hA : H, ctx });
      pl.ejes();
      const g = filas[kSel - 1].g;
      M.dispersion(ctx, pl, pts, { color: (p, i) => mezcla(g.resp[i]), r: 3 });
      g.comps.forEach((c, j) => M.elipse(ctx, pl, c.mu, c.S, 2, VIZ.series[j % 8], { ancho: 1.8 }));
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(`k = ${kSel}`, pl.x1 - 4, pl.y1 + 4);
      ctx.restore();
      geo = { pc };
      const aicMin = filas.reduce((a, b) => (b.aic < a.aic ? b : a));
      lectura.set([
        ['k con menor BIC', String(mejor.k)],
        ['k con menor AIC', String(aicMin.k)],
        [`parámetros con k = ${kSel}`, String(filas[kSel - 1].p)],
        ['grupos reales', String(new Set(pts.map((p) => p.g)).size)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    const kEn = (x, y) => (geo && geo.pc.dentro(x, y) ? Math.max(1, Math.min(8, Math.round(geo.pc.ix(x)))) : null);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), k = kEn(x, y); if (k) { kSel = k; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), k = kEn(x, y);
      if (!k) return tip.ocultar();
      const f = filas[k - 1];
      tip.mostrar(x, y, `k = <b>${k}</b>, p = <b>${f.p}</b>` + VIZ.filaTooltip(C.s1, 'BIC', VIZ.fmt(f.bic, 4)) + VIZ.filaTooltip(C.s2, 'AIC', VIZ.fmt(f.aic, 4)) + VIZ.filaTooltip(C.apagado, '−2ℓ', VIZ.fmt(f.m2l, 4)));

    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('gaussian-mixture-models', {
    intro: String.raw`
      <p>Un <strong>modelo de mezcla gaussiana</strong> (GMM) supone que los datos vienen de \(k\) poblaciones, cada una con
      distribución <a href="tema.html?id=multivariate-gaussian">gaussiana</a> propia. Para generar un punto se elige una componente
      con probabilidad \(\pi_j\) y luego se muestrea de su gaussiana.</p>
      <p>Agrupar es invertir ese proceso: estimar las componentes y calcular, para cada punto, la <strong>probabilidad de que
      venga de cada una</strong>. A diferencia de <a href="tema.html?id=kmeans">k-means</a>, la pertenencia es blanda y los grupos
      pueden ser elipses de distinto tamaño y orientación.</p>`,
    visualizaciones: [
      {
        titulo: 'EM paso a paso',
        descripcion: 'El algoritmo EM alterna asignar probabilidades (E) y reajustar las gaussianas (M). Pruebe covarianza esférica sobre manchas alargadas y compare.',
        montar: montarEM,
      },
      {
        titulo: 'Elegir k con BIC',
        descripcion: 'Criterios de información para k = 1 … 8. Compare dónde se minimizan BIC y AIC.',
        montar: montarBIC,
      },
    ],
    teoria: String.raw`
      <h2>Modelo</h2>
      \[ p(x) = \sum_{j=1}^{k} \pi_j\, \mathcal N(x \mid \mu_j, \Sigma_j), \qquad \pi_j \ge 0,\ \ \sum_j \pi_j = 1. \]
      <p>La probabilidad de pertenencia (<em>responsabilidad</em>) de la componente \(j\) para \(x_i\) es la posterior de Bayes:</p>
      \[ \gamma_{ij} = p(z_i = j \mid x_i) = \frac{\pi_j\, \mathcal N(x_i \mid \mu_j, \Sigma_j)}{\sum_l \pi_l\, \mathcal N(x_i \mid \mu_l, \Sigma_l)}. \]
      <h2>Algoritmo EM</h2>
      <p>Maximizar directamente \(\ell = \sum_i \log \sum_j \pi_j \mathcal N(x_i \mid \mu_j, \Sigma_j)\) es difícil por el logaritmo de una suma.
      EM alterna dos pasos que nunca disminuyen \(\ell\):</p>
      <pre><code>repetir hasta que ℓ deje de cambiar:
    E:  γ_ij ← π_j N(x_i | μ_j, Σ_j) / Σ_l π_l N(x_i | μ_l, Σ_l)
    M:  N_j ← Σ_i γ_ij
        π_j ← N_j / n
        μ_j ← (1/N_j) Σ_i γ_ij x_i
        Σ_j ← (1/N_j) Σ_i γ_ij (x_i − μ_j)(x_i − μ_j)ᵀ</code></pre>
      <p>El paso M es la <a href="tema.html?id=maximum-likelihood">máxima verosimilitud</a> ponderada. EM converge a un máximo
      <em>local</em>: conviene probar varios inicios (por ejemplo desde k-means) y quedarse con el de mayor \(\ell\).</p>
      <h2>k-means como caso límite</h2>
      <p>Con \(\Sigma_j = \sigma^2 I\) fija y \(\sigma \to 0\), las responsabilidades se vuelven 0 o 1 y EM es exactamente el algoritmo de
      Lloyd. GMM agrega covarianzas propias y pertenencia blanda.</p>
      <h2>Elegir k y el tipo de covarianza</h2>
      <p>La verosimilitud siempre crece con más componentes. Se penaliza el número de parámetros \(p\):</p>
      \[ \mathrm{BIC} = -2\ell + p \ln n, \qquad \mathrm{AIC} = -2\ell + 2p. \]
      <p>En 2-D, con covarianza completa cada componente aporta 2 (media) + 3 (covarianza) parámetros, más \(k - 1\) pesos. BIC penaliza
      más y tiende a elegir modelos más simples. Las covarianzas restringidas (diagonal, esférica) tienen menos parámetros y evitan
      el problema de singularidad: una componente que se colapsa sobre un punto hace \(\ell \to \infty\); se evita sumando un
      pequeño \(\varepsilon I\) a cada \(\Sigma_j\).</p>
      <p>Compare con el agrupamiento por densidad en <a href="tema.html?id=gmm-vs-dbscan">GMM frente a DBSCAN</a>.</p>`,
  });
})();