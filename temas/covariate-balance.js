(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Covariables a revisar: las dos del estudio, transformaciones y una variable irrelevante.
  const COVS = [['edad', (d) => d.x1], ['gravedad', (d) => d.x2], ['gravedad²', (d) => d.x2 * d.x2], ['edad · gravedad', (d) => d.x1 * d.x2], ['ruido', (d) => d.x3]];
  const METODOS = [['ninguno', 'Sin ajuste'], ['nn', 'Vecino más cercano (euclidiana)'], ['ps', 'Matching por propensity score'], ['ipw', 'Ponderación IPW']];
  function datos(semilla, conf) {
    const rnd = VIZ.semilla(semilla + 500);
    return M.estudio(600, semilla, { conf }).map((d) => ({ ...d, x3: VIZ.normal(rnd) }));
  }
  /* Devuelve la muestra ajustada como lista de { d, w } (peso). */
  function ajustar(D, metodo) {
    if (metodo === 'ninguno') return D.map((d) => ({ d, w: 1 }));
    const ps = M.logistica(D.map((d) => [d.x1, d.x2, d.x2 * d.x2]), D.map((d) => d.t));
    const DE = D.map((d) => ({ ...d, e: Math.min(0.99, Math.max(0.01, ps.p([d.x1, d.x2, d.x2 * d.x2]))) }));
    if (metodo === 'ipw') return DE.map((d) => ({ d, w: d.t ? 1 / d.e : 1 / (1 - d.e) }));
    const dist = metodo === 'nn' ? (a, b) => Math.hypot(a.x1 - b.x1, a.x2 - b.x2) : (a, b) => Math.abs(a.e - b.e);
    const R = M.emparejar(DE, dist, { k: 1 }), peso = new Map();
    R.pares.forEach((p) => { peso.set(p.i, (peso.get(p.i) || 0) + 1); p.js.forEach((j) => peso.set(j, (peso.get(j) || 0) + 1)); });
    return [...peso.entries()].map(([i, w]) => ({ d: DE[i], w }));
  }
  const smdDe = (A, f) => { const D = A.map((a) => a.d), w = new Map(A.map((a) => [a.d, a.w])); return M.smd(D, f, (d) => w.get(d)); };

  /* ---------- Fig. 1: el gráfico de amor ---------- */

  function montarLove(cuerpo) {
    let metodo = 'ps', semilla = 1, conf = 0.6, D = datos(semilla, conf), filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ajuste', opciones: METODOS.slice(1), valor: metodo, alCambiar: (v) => { metodo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Confusión', min: 0, max: 2, paso: 0.1, valor: conf, formato: (v) => v.toFixed(1), alCambiar: (v) => { conf = v; }, alSoltar: () => { D = datos(semilla, conf); calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; D = datos(semilla, conf); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 260 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'antes del ajuste', forma: 'punto' }, { color: C.s1, texto: 'después del ajuste', forma: 'cuadro' },
      { color: C.apagado, texto: 'umbral |SMD| = 0,1', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una covariable; el punto, su diferencia de medias estandarizada entre tratados y controles. Un ajuste aceptable deja todas dentro de ±0,1. Suba la confusión: el solapamiento empeora y ningún método logra balance completo, en especial en gravedad² y en la interacción. El propensity score balancea en promedio, no en cada muestra.');
    function calcular() {
      const A0 = ajustar(D, 'ninguno'), A1 = ajustar(D, metodo);
      filas = COVS.map(([nombre, f]) => ({ nombre, antes: smdDe(A0, f), despues: smdDe(A1, f) }));
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const lim = Math.max(0.5, ...filas.map((f) => Math.max(Math.abs(f.antes), Math.abs(f.despues)))) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: -lim, xmax: lim, ymin: -0.5, ymax: COVS.length - 0.5 }, { etiquetaX: 'diferencia de medias estandarizada', ticksY: [], margen: { izq: Math.min(150, lienzo.ancho * 0.36) } });
      pl.ejes();
      for (const v of [-0.1, 0.1]) VIZ.trazar(ctx, pl, [[v, -0.5], [v, COVS.length - 0.5]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, [[0, -0.5], [0, COVS.length - 0.5]], C.eje, 1);
      filas.forEach((f, i) => {
        const y = COVS.length - 1 - i;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(f.nombre, pl.x0 - 8, pl.sy(y));
        VIZ.trazar(ctx, pl, [[f.antes, y], [f.despues, y]], C.tenue, 1.5);
        VIZ.marcador(ctx, pl.sx(f.antes), pl.sy(y), C.s8, 5);
        VIZ.marcador(ctx, pl.sx(f.despues), pl.sy(y), C.s1, 5, 1);
      });
      const malas = filas.filter((f) => Math.abs(f.despues) > 0.1);
      lectura.set([
        ['máx |SMD| antes', VIZ.fmt(Math.max(...filas.map((f) => Math.abs(f.antes))), 3)],
        ['máx |SMD| después', VIZ.fmt(Math.max(...filas.map((f) => Math.abs(f.despues))), 3)],
        ['covariables fuera de ±0,1', malas.length ? malas.map((f) => f.nombre).join(', ') : 'ninguna'],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      const i = COVS.length - 1 - Math.round(pl.iy(y));
      if (i < 0 || i >= COVS.length || x < 4) return tip.ocultar();
      tip.mostrar(x, y, `<b>${filas[i].nombre}</b>` + VIZ.filaTooltip(C.s8, 'antes', VIZ.fmt(filas[i].antes, 3)) + VIZ.filaTooltip(C.s1, 'después', VIZ.fmt(filas[i].despues, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  /* ---------- Fig. 2: distribuciones antes y después ---------- */

  function montarDistribuciones(cuerpo) {
    let metodo = 'ps', cov = 1, semilla = 1, D = datos(semilla, 0.8);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Covariable', opciones: COVS.map(([t], i) => [i, t]), valor: cov, alCambiar: (v) => { cov = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ajuste', opciones: METODOS, valor: metodo, alCambiar: (v) => { metodo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; D = datos(semilla, 0.8); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'tratados (densidad ponderada)', forma: 'linea' }, { color: C.s1, texto: 'controles (densidad ponderada)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Igualar medias no basta: también deben coincidir la dispersión y la forma. La razón de varianzas debería estar cerca de 1 y la distancia de Kolmogorov–Smirnov (máxima diferencia entre las funciones de distribución) cerca de 0.');
    let pl = null, curvas = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const A = ajustar(D, metodo), f = COVS[cov][1];
      const vals = A.map((a) => f(a.d)), lo = M.cuantil(vals, 0.005), hi = M.cuantil(vals, 0.995);
      const B = 30, h = (hi - lo) / B;
      const dens = (t) => { const c = new Array(B).fill(0); let W = 0; A.filter((a) => a.d.t === t).forEach((a) => { const b = Math.floor((f(a.d) - lo) / h); W += a.w; if (b >= 0 && b < B) c[b] += a.w; }); return c.map((v) => v / (W * h)); };
      curvas = { t: dens(1), c: dens(0), lo, h };
      pl = VIZ.plano(lienzo, { xmin: lo, xmax: hi, ymin: 0, ymax: Math.max(...curvas.t, ...curvas.c) * 1.1 }, { etiquetaX: COVS[cov][0], etiquetaY: 'densidad' });
      pl.ejes();
      for (const [k, col] of [['c', C.s1], ['t', C.s2]]) {
        const pts = [];
        curvas[k].forEach((v, b) => { pts.push([lo + b * h, v], [lo + (b + 1) * h, v]); });
        ctx.save(); ctx.beginPath(); ctx.moveTo(pl.sx(lo), pl.sy(0)); pts.forEach(([x, y]) => ctx.lineTo(pl.sx(x), pl.sy(y))); ctx.lineTo(pl.sx(hi), pl.sy(0)); ctx.fillStyle = VIZ.alfa(col, 0.15); ctx.fill(); ctx.restore();
        VIZ.trazar(ctx, pl, pts, col, 2);
      }
      const mom = (t) => { const S = A.filter((a) => a.d.t === t), W = M.suma(S.map((a) => a.w)), m = M.suma(S.map((a) => a.w * f(a.d))) / W; return { m, v: M.suma(S.map((a) => a.w * (f(a.d) - m) ** 2)) / W, S, W }; };
      const T = mom(1), Cn = mom(0);
      const cdf = (S, W, x) => M.suma(S.filter((a) => f(a.d) <= x).map((a) => a.w)) / W;
      let ks = 0;
      for (let q = 0; q <= 60; q++) { const x = lo + ((hi - lo) * q) / 60; ks = Math.max(ks, Math.abs(cdf(T.S, T.W, x) - cdf(Cn.S, Cn.W, x))); }
      lectura.set([
        ['medias tratados · controles', `${VIZ.fmt(T.m, 3)} · ${VIZ.fmt(Cn.m, 3)}`],
        ['SMD', VIZ.fmt((T.m - Cn.m) / Math.sqrt((T.v + Cn.v) / 2), 3)],
        ['razón de varianzas', VIZ.fmt(T.v / Cn.v, 3)],
        ['distancia KS', VIZ.fmt(ks, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const b = Math.floor((pl.ix(x) - curvas.lo) / curvas.h);
      if (b < 0 || b >= 30) return tip.ocultar();
      tip.mostrar(x, y, `${COVS[cov][0]} ≈ <b>${VIZ.fmt(pl.ix(x), 3)}</b>` + VIZ.filaTooltip(C.s2, 'tratados', VIZ.fmt(curvas.t[b], 3)) + VIZ.filaTooltip(C.s1, 'controles', VIZ.fmt(curvas.c[b], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('covariate-balance', {
    intro: String.raw`
      <p>El objetivo del <a href="tema.html?id=matching">matching</a> y de la <a href="tema.html?id=propensity-score">ponderación</a> es conseguir
      grupos de tratados y controles <strong>comparables</strong>: con la misma distribución de covariables, como si el tratamiento se hubiera
      asignado al azar. El <strong>balance de covariables</strong> es la manera de comprobar si se logró.</p>
      <p>A diferencia del efecto estimado, el balance se puede revisar <em>sin mirar el resultado</em>, lo que permite ajustar el diseño
      (cambiar el modelo, el caliper, las covariables) sin la tentación de buscar el efecto que se quiere encontrar.</p>`,
    visualizaciones: [
      {
        titulo: 'El gráfico de amor',
        descripcion: 'Diferencias de medias estandarizadas antes y después del ajuste para cada covariable (love plot). Compare los métodos.',
        montar: montarLove,
      },
      {
        titulo: 'Distribuciones antes y después',
        descripcion: 'La distribución completa de una covariable en cada grupo, con los pesos del ajuste.',
        montar: montarDistribuciones,
      },
    ],
    teoria: String.raw`
      <h2>Diferencia de medias estandarizada</h2>
      \[ \mathrm{SMD} = \frac{\bar x_T - \bar x_C}{\sqrt{(s_T^2 + s_C^2)/2}}. \]
      <p>No depende del tamaño de la muestra (a diferencia de una prueba \(t\), que con \(n\) grande marca diferencias irrelevantes y con \(n\) chico no detecta
      nada). Regla práctica: \(|\mathrm{SMD}| &lt; 0{,}1\) en todas las covariables; algunos aceptan 0,25. Con pesos, las medias y varianzas son ponderadas.</p>
      <h2>Más allá de las medias</h2>
      <ul>
        <li><strong>Razón de varianzas</strong> \(s_T^2 / s_C^2\): entre 0,5 y 2.</li>
        <li><strong>Kolmogorov–Smirnov</strong>: \(\max_x |F_T(x) - F_C(x)|\), compara distribuciones completas.</li>
        <li><strong>Interacciones y términos cuadráticos</strong>: si el resultado depende de \(x^2\) o de \(x_1 x_2\), también deben estar balanceados.</li>
      </ul>
      <h2>Ciclo de diseño</h2>
      <pre><code>repetir:
    estimar el propensity score (o elegir la distancia)
    emparejar o ponderar
    revisar el balance de todas las covariables y sus transformaciones
hasta que el balance sea aceptable
solo entonces: mirar Y y estimar el efecto</code></pre>
      <div class="recuadro"><p>El balance solo se puede revisar en las covariables <strong>medidas</strong>. Un confusor no observado puede seguir desbalanceado;
      eso se aborda con <a href="tema.html?id=causal-refutation">análisis de sensibilidad</a>.</p></div>`,
  });
})();