(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Población asimétrica: log-normal con μ = 0, σ = 0,8 (media e^{0,32}).
  const MEDIA_REAL = Math.exp(0.32);
  const muestra = (n, rnd) => Array.from({ length: n }, () => Math.exp(0.8 * VIZ.normal(rnd)));
  const ESTADISTICOS = { media: M.media, mediana: (v) => M.cuantil(v, 0.5), desv: M.desv };

  /* ---------- Fig. 1: remuestrear ---------- */

  function montarRemuestreo(cuerpo) {
    let n = 30, est = 'media', semilla = 1, X = [], cuentas = [], valores = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estadístico', opciones: [['media', 'Media'], ['mediana', 'Mediana'], ['desv', 'Desviación estándar']], valor: est, alCambiar: (v) => { est = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Tamaño de la muestra n', min: 5, max: 200, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Otra muestra', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 320, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'dato de la muestra original', forma: 'punto' },
      { color: C.s2, texto: 'veces que aparece en la remuestra actual', forma: 'cuadro' },
      { color: C.s1, texto: 'estadístico de cada remuestra', forma: 'cuadro' },
      { color: C.s7, texto: 'intervalo percentil 95 %', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba: la única muestra que tenemos. Cada paso sortea n datos con reposición (algunos salen varias veces, otros ninguna) y calcula el estadístico. Pulse «Hasta el final» para completar 1.000 remuestras.');
    function iniciar() {
      const rnd = VIZ.semilla(semilla * 13 + n);
      X = muestra(n, rnd).sort((a, b) => a - b);
      cuentas = new Array(n).fill(0); valores = [];
      const r2 = VIZ.semilla(semilla * 7);
      return (function* () {
        for (let b = 0; b < 1000; b++) {
          cuentas = new Array(n).fill(0);
          for (let i = 0; i < n; i++) cuentas[Math.floor(r2() * n)]++;
          valores.push(ESTADISTICOS[est](X.flatMap((x, i) => new Array(cuentas[i]).fill(x))));
          yield;
        }
      })();
    }
    let ph = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const xmax = Math.max(...X) * 1.05, hA = 90;
      const pa = VIZ.plano({ ...lienzo, alto: hA, ctx }, { xmin: 0, xmax, ymin: 0, ymax: 6 }, { ticksY: [], margen: { izq: 40, sup: 6, inf: 22 } });
      pa.ejes();
      X.forEach((x, i) => {
        VIZ.marcador(ctx, pa.sx(x), pa.y0 - 6, C.tinta2, 3.5);
        for (let k = 0; k < cuentas[i]; k++) { ctx.fillStyle = C.s2; ctx.fillRect(pa.sx(x) - 3, pa.y0 - 16 - k * 9, 6, 7); }
      });
      ctx.save(); ctx.translate(0, hA + 8);
      const t0 = ESTADISTICOS[est](X);
      const lo = valores.length ? Math.min(...valores, t0) : t0 * 0.7, hi = valores.length ? Math.max(...valores, t0) : t0 * 1.3;
      const span = (hi - lo) || 1, bins = 40, mn = lo - span * 0.05, mx = hi + span * 0.05;
      const c = new Array(bins).fill(0); valores.forEach((v) => c[Math.min(bins - 1, Math.floor(((v - mn) / (mx - mn)) * bins))]++);
      ph = VIZ.plano({ ...lienzo, alto: H - hA - 8, ctx }, { xmin: mn, xmax: mx, ymin: 0, ymax: Math.max(5, ...c) * 1.1 }, { etiquetaX: `${est} de cada remuestra`, etiquetaY: 'cantidad', margen: { izq: 40 } });
      ph.ejes();
      M.histograma(ctx, ph, valores, { min: mn, max: mx, bins, color: C.s1 });
      VIZ.trazar(ctx, ph, [[t0, 0], [t0, ph.d.ymax]], C.tinta, 2);
      let ic = null;
      if (valores.length >= 40) { ic = [M.cuantil(valores, 0.025), M.cuantil(valores, 0.975)]; VIZ.trazar(ctx, ph, [[ic[0], ph.d.ymax * 0.95], [ic[1], ph.d.ymax * 0.95]], C.s7, 3); }
      ctx.restore();
      ph.oy = hA + 8;
      registro.textContent = valores.length ? `Remuestra ${valores.length}: ${est} = ${VIZ.fmt(valores[valores.length - 1], 4)}; ${cuentas.filter((k) => !k).length} de los ${n} datos no salieron.` : 'Pulse Un paso para sacar la primera remuestra.';
      lectura.set([
        [`${est} de la muestra`, VIZ.fmt(t0, 4)],
        ['error estándar bootstrap', valores.length > 1 ? VIZ.fmt(M.desv(valores), 4) : '—'],
        ['intervalo percentil 95 %', ic ? `[${VIZ.fmt(ic[0], 4)}, ${VIZ.fmt(ic[1], 4)}]` : '—'],
        ['remuestras', String(valores.length)],
      ]);
    }
    lienzo.alDibujar = () => X.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!ph || !ph.dentro(x, y - ph.oy)) return tip.ocultar();
      const v = ph.ix(x);
      tip.mostrar(x, y, `${est} ≈ <b>${VIZ.fmt(v, 4)}</b><br>remuestras por debajo: <b>${M.pct(valores.filter((q) => q <= v).length / Math.max(1, valores.length), 1)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: ¿cubre el intervalo al valor real? ---------- */

  function montarCobertura(cuerpo) {
    let n = 20, semilla = 1, ints = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño de la muestra n', min: 5, max: 200, valor: n, alCambiar: (v) => { n = v; }, alSoltar: () => calcular() });
    ctl.boton('Repetir 200 estudios', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'intervalo que contiene la media real', forma: 'linea' }, { color: C.s8, texto: 'intervalo que no la contiene', forma: 'linea' }, { color: C.s6, texto: 'media real de la población', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea es un estudio: una muestra nueva de la población log-normal y su intervalo bootstrap percentil del 95 % para la media (200 remuestras). Se muestran los primeros 60. Con n chico la cobertura queda bajo el 95 % nominal: el bootstrap es aproximado y la asimetría lo afecta.');
    function calcular() {
      const rnd = VIZ.semilla(semilla * 101 + n);
      ints = Array.from({ length: 200 }, () => {
        const X = muestra(n, rnd), bs = [];
        for (let b = 0; b < 200; b++) { let s = 0; for (let i = 0; i < n; i++) s += X[Math.floor(rnd() * n)]; bs.push(s / n); }
        const lo = M.cuantil(bs, 0.025), hi = M.cuantil(bs, 0.975);
        return { lo, hi, m: M.media(X), cubre: lo <= MEDIA_REAL && MEDIA_REAL <= hi };
      });
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const V = ints.slice(0, 60), lo = Math.min(...V.map((v) => v.lo)), hi = Math.max(...V.map((v) => v.hi));
      pl = VIZ.plano(lienzo, { xmin: lo - 0.05, xmax: hi + 0.05, ymin: 0, ymax: V.length + 1 }, { etiquetaX: 'intervalo para la media', ticksY: [] });
      pl.ejes();
      V.forEach((v, i) => { VIZ.trazar(ctx, pl, [[v.lo, i + 1], [v.hi, i + 1]], v.cubre ? C.s1 : C.s8, 2); VIZ.marcador(ctx, pl.sx(v.m), pl.sy(i + 1), v.cubre ? C.s1 : C.s8, 2.5); });
      VIZ.trazar(ctx, pl, [[MEDIA_REAL, 0], [MEDIA_REAL, V.length + 1]], C.s6, 2, [5, 4]);
      const cob = ints.filter((v) => v.cubre).length / ints.length;
      lectura.set([
        ['cobertura en 200 estudios', M.pct(cob)],
        ['nominal', '95 %'],
        ['ancho medio del intervalo', VIZ.fmt(M.media(ints.map((v) => v.hi - v.lo)), 3)],
        ['fallan por arriba · por abajo', `${ints.filter((v) => v.lo > MEDIA_REAL).length} · ${ints.filter((v) => v.hi < MEDIA_REAL).length}`],
      ]);
    }
    lienzo.alDibujar = () => ints.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.round(pl.iy(y)) - 1, v = ints[i];
      if (!v || i >= 60) return tip.ocultar();
      tip.mostrar(x, y, `estudio ${i + 1}: [<b>${VIZ.fmt(v.lo, 3)}</b>, <b>${VIZ.fmt(v.hi, 3)}</b>]<br>${v.cubre ? 'contiene' : 'no contiene'} la media real ${VIZ.fmt(MEDIA_REAL, 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('bootstrap', {
    intro: String.raw`
      <p>Cualquier estimación —una media, un coeficiente, un efecto causal, el número de grupos— depende de la muestra que tocó.
      ¿Cuánto cambiaría con otra muestra? Lo ideal sería repetir el estudio muchas veces, pero solo hay una muestra.</p>
      <p>El <strong>bootstrap</strong> (Efron, 1979) simula esas repeticiones <strong>remuestreando con reposición</strong> la muestra que se tiene,
      como si fuera la población. La variabilidad del estadístico entre remuestras aproxima su error estándar y da intervalos de confianza
      sin fórmulas analíticas.</p>`,
    visualizaciones: [
      {
        titulo: 'Remuestrear',
        descripcion: 'Una muestra de 30 datos asimétricos, sus remuestras y la distribución bootstrap del estadístico. Compare la media con la mediana.',
        montar: montarRemuestreo,
      },
      {
        titulo: '¿Cubre el intervalo al valor real?',
        descripcion: 'Doscientos estudios independientes con su intervalo bootstrap. Suba n y vea cómo la cobertura se acerca al 95 %.',
        montar: montarCobertura,
      },
    ],
    teoria: String.raw`
      <h2>Idea</h2>
      <p>Sea \(\hat\theta = s(x_1, \dots, x_n)\). La distribución de muestreo de \(\hat\theta\) depende de la población \(F\), desconocida. El bootstrap la reemplaza por
      la distribución empírica \(\hat F_n\) (masa \(1/n\) en cada dato):</p>
      <pre><code>para b ← 1 hasta B:
    x* ← n sorteos con reposición de {x₁, …, x_n}
    θ*_b ← s(x*)
error estándar ≈ desviación de θ*₁, …, θ*_B
intervalo percentil ≈ [cuantil 2,5 %, cuantil 97,5 %] de θ*</code></pre>
      <p>Cada dato queda fuera de una remuestra con probabilidad \((1 - 1/n)^n \to e^{-1} \approx 36{,}8\,\%\); esos datos «fuera de la bolsa» sirven para validar
      modelos (como en los bosques aleatorios).</p>
      <h2>Intervalos</h2>
      <table>
        <tr><th>Método</th><th>Intervalo</th><th>Comentario</th></tr>
        <tr><td>Normal</td><td>\(\hat\theta \pm 1{,}96\, \widehat{\mathrm{se}}_{\text{boot}}\)</td><td>supone distribución simétrica</td></tr>
        <tr><td>Percentil</td><td>\([\theta^*_{(0{,}025)},\ \theta^*_{(0{,}975)}]\)</td><td>simple; cobertura baja con \(n\) chico</td></tr>
        <tr><td>Básico</td><td>\([2\hat\theta - \theta^*_{(0{,}975)},\ 2\hat\theta - \theta^*_{(0{,}025)}]\)</td><td>corrige sesgo de ubicación</td></tr>
        <tr><td>BCa</td><td>percentiles ajustados por sesgo y aceleración</td><td>más preciso, más costoso</td></tr>
      </table>
      <h2>Cuándo funciona y cuándo no</h2>
      <ul>
        <li>Funciona bien para estadísticos «suaves» (medias, regresiones, correlaciones) y \(n\) moderado.</li>
        <li>Falla para extremos (el máximo), con \(n\) muy chico, o con datos dependientes si se remuestrean filas sueltas (en series de tiempo se
        remuestrean bloques; en datos agrupados, grupos completos).</li>
        <li>Sirve para medir la <strong>estabilidad</strong> de resultados no supervisados: re-agrupar cada remuestra y ver si los grupos se repiten
        (ver <a href="tema.html?id=unsupervised-evaluation">evaluación no supervisada</a>), o la de un efecto causal estimado
        (<a href="tema.html?id=hyperparameter-sensitivity">sensibilidad</a>).</li>
      </ul>`,
  });
})();