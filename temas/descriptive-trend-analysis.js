(function () {
  'use strict';
  const { color: C } = VIZ;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const nombreMes = (m) => `${MESES[m % 12]} año ${1 + Math.floor(m / 12)}`;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  const media = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const desv = (a) => { const m = media(a); return Math.sqrt(media(a.map((v) => (v - m) ** 2))); };
  const mediana = (a) => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };

  // Serie base + tend·t + amp·sen(2πt/per) + ruido·N(0,1), reproducible con la semilla.
  // (Definida aquí: VIZ.si.serie llama a VIZ.normal(rnd) como si devolviera una función, pero devuelve un número.)
  function serie(semilla, n, { base = 100, tend = 0.5, amp = 10, per = 12, ruido = 4 } = {}) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, (_, t) => base + tend * t + amp * Math.sin((2 * Math.PI * t) / per) + ruido * VIZ.normal(rnd));
  }

  // Media móvil centrada de ventana w (para w par, 2×w con medios pesos en los extremos). NaN donde no está definida.
  function mediaMovil(x, w) {
    const n = x.length, h = Math.floor(w / 2), out = Array(n).fill(NaN);
    for (let t = h; t < n - h; t++) {
      if (w % 2) { let s = 0; for (let k = -h; k <= h; k++) s += x[t + k]; out[t] = s / w; }
      else { let s = 0.5 * (x[t - h] + x[t + h]); for (let k = -h + 1; k <= h - 1; k++) s += x[t + k]; out[t] = s / w; }
    }
    return out;
  }
  // Índice estacional: promedio por posición en el periodo de (x − tendencia), centrado en 0.
  function estacional(x, tend, per = 12) {
    const idx = Array.from({ length: per }, (_, k) => media(x.map((v, t) => (t % per === k && Number.isFinite(tend[t]) ? v - tend[t] : NaN)).filter(Number.isFinite)));
    const c = media(idx);
    return idx.map((v) => v - c);
  }
  const pendiente = (y) => {
    const pts = y.map((v, t) => [t, v]).filter((p) => Number.isFinite(p[1])), mt = media(pts.map((p) => p[0])), my = media(pts.map((p) => p[1]));
    return pts.reduce((s, p) => s + (p[0] - mt) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mt) ** 2, 0);
  };

  /* ---------- Fig. 1: descomposición ---------- */

  function montarDescomposicion(cuerpo) {
    const N = 48;
    let semilla = 1, tend = 0.8, amp = 12, ruido = 4, w = 12, x = [], T = [], Sx = [], R = [], hover = -1, pls = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tendencia verdadera', min: 0, max: 2, paso: 0.1, valor: tend, formato: (v) => `${VIZ.fmt(v, 2)} / mes`, alCambiar: (v) => { tend = v; calcular(); } });
    ctl.rango({ etiqueta: 'Amplitud estacional', min: 0, max: 30, valor: amp, alCambiar: (v) => { amp = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 12, paso: 0.5, valor: ruido, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ventana de la media móvil', min: 2, max: 14, valor: w, formato: (v) => `${v} meses`, alCambiar: (v) => { w = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const paneles = [['Serie observada y tendencia estimada', 0.34], ['Componente estacional estimado', 0.22], ['Residuo (ruido)', 0.22]].map(([t, prop]) => {
      VIZ.subtitulo(cuerpo, t);
      const l = VIZ.lienzo(cuerpo, { proporcion: prop, altoMin: prop > 0.3 ? 190 : 120, altoMax: prop > 0.3 ? 260 : 170 });
      return { l, tip: VIZ.tooltip(l) };
    });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'serie observada', forma: 'linea' }, { color: C.s2, texto: 'tendencia (media móvil)', forma: 'linea' }, { color: C.s3, texto: 'estacionalidad estimada' },
      { color: C.apagado, texto: 'estacionalidad verdadera', forma: 'linea' }, { color: C.s8, texto: 'residuo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La serie es tendencia + estacionalidad + ruido. Con una ventana de 12 meses, igual al periodo, la media móvil borra la estacionalidad y deja la tendencia; pruebe 5 o 7 y vea cómo se filtra parte del ciclo. Pase el cursor sobre cualquier panel para leer los tres componentes de un mes.');

    function calcular() {
      x = serie(semilla, N, { base: 100, tend, amp, per: 12, ruido });
      T = mediaMovil(x, w);
      const idx = estacional(x, T);
      Sx = x.map((_, t) => idx[t % 12]);
      R = x.map((v, t) => (Number.isFinite(T[t]) ? v - T[t] - Sx[t] : NaN));
      dibujar();
    }
    function dibujar() {
      pls = [];
      const lo = Math.min(...x) - 6, hi = Math.max(...x) + 6;
      const ex = amp * 1.35 + 2, er = Math.max(3 * ruido, 5);
      const defs = [
        { y: [lo, hi], f: (pl, ctx) => { VIZ.trazar(ctx, pl, x.map((v, t) => [t, v]), C.s1, 2); VIZ.trazar(ctx, pl, T.map((v, t) => [t, v]), C.s2, 3); }, m: [(t) => x[t], C.s1, (t) => T[t], C.s2] },
        { y: [-ex, ex], f: (pl, ctx) => {
          const w2 = pl.sx(1) - pl.sx(0) - 2;
          Sx.forEach((v, t) => { ctx.fillStyle = C.s3; const y0 = pl.sy(0), y1 = pl.sy(v); ctx.fillRect(pl.sx(t) - w2 / 2, Math.min(y0, y1), w2, Math.abs(y1 - y0)); });
          VIZ.trazar(ctx, pl, x.map((_, t) => [t, amp * Math.sin((2 * Math.PI * t) / 12)]), C.apagado, 1.5, [3, 4]);
        } },
        { y: [-er, er], f: (pl, ctx) => {
          const w2 = pl.sx(1) - pl.sx(0) - 2;
          R.forEach((v, t) => { if (!Number.isFinite(v)) return; ctx.fillStyle = C.s8; const y0 = pl.sy(0), y1 = pl.sy(v); ctx.fillRect(pl.sx(t) - w2 / 2, Math.min(y0, y1), w2, Math.abs(y1 - y0)); });
        } },
      ];
      defs.forEach((d, i) => {
        const { l } = paneles[i], { ctx } = l;
        l.limpiar();
        const pl = VIZ.plano(l, { xmin: -0.5, xmax: N - 0.5, ymin: d.y[0], ymax: d.y[1] }, { ticksX: [0, 12, 24, 36, 47], formatoX: (v) => String(v + 1), etiquetaX: i === 2 ? 'mes' : undefined, formatoY: (v) => VIZ.fmt(v, 3) });
        pl.ejes();
        if (i > 0) { ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke(); }
        pl.recortar && ctx.save();
        d.f(pl, ctx);
        pl.recortar && ctx.restore();
        if (hover >= 0) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y0); ctx.lineTo(pl.sx(hover), pl.y1); ctx.stroke();
          if (i === 0) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(x[hover]), C.s1, 4.5); if (Number.isFinite(T[hover])) VIZ.marcador(ctx, pl.sx(hover), pl.sy(T[hover]), C.s2, 4.5); }
        }
        pls[i] = pl;
      });
      const ok = R.filter(Number.isFinite), tOk = T.map((v, t) => (Number.isFinite(v) ? x[t] : NaN)).filter(Number.isFinite);
      const pendEst = pendiente(T), ampEst = (Math.max(...Sx) - Math.min(...Sx)) / 2, expl = 1 - Math.pow(desv(ok), 2) / Math.pow(desv(tOk), 2);
      registro.textContent = w % 12 === 0 ? `Ventana de ${w} meses = periodo estacional: cada promedio contiene un ciclo completo, así que la estacionalidad se cancela y queda la tendencia.`
        : `Ventana de ${w} meses: no coincide con el periodo de 12, así que parte del ciclo estacional queda dentro de la «tendencia» (se nota por su ondulación) y el residuo incluye lo que no se separó.`;
      lectura.set([
        ['pendiente real / estimada', `${VIZ.fmt(tend, 3)} / ${VIZ.fmt(pendEst, 3)} por mes`],
        ['amplitud estacional real / estimada', `${VIZ.fmt(amp, 3)} / ${VIZ.fmt(ampEst, 3)}`],
        ['desviación del ruido real / residuo', `${VIZ.fmt(ruido, 3)} / ${VIZ.fmt(desv(ok), 3)}`],
        ['varianza explicada por tendencia + estacionalidad', pct(Math.max(0, expl))],
        ['meses sin tendencia estimada', String(N - ok.length)],
      ]);
    }
    paneles.forEach(({ l, tip }, i) => {
      l.alDibujar = () => x.length && dibujar();
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x: px, y: py } = l.posicion(ev), pl = pls[i];
        if (!pl || !pl.dentro(px, py)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
        const t = Math.max(0, Math.min(N - 1, Math.round(pl.ix(px))));
        if (t !== hover) { hover = t; dibujar(); }
        tip.mostrar(px, py, `<b>${nombreMes(t)}</b>` + VIZ.filaTooltip(C.s1, 'observado', VIZ.fmt(x[t])) + VIZ.filaTooltip(C.s2, 'tendencia', Number.isFinite(T[t]) ? VIZ.fmt(T[t]) : 'no definida') +
          VIZ.filaTooltip(C.s3, 'estacional', VIZ.fmt(Sx[t])) + VIZ.filaTooltip(C.s8, 'residuo', Number.isFinite(R[t]) ? VIZ.fmt(R[t]) : '—'));
      });
      l.canvas.addEventListener('pointerleave', () => { hover = -1; paneles.forEach((p) => p.tip.ocultar()); if (x.length) dibujar(); });
    });
    calcular();
  }

  /* ---------- Fig. 2: variación interanual y anomalías ---------- */

  function montarAnomalias(cuerpo) {
    const N = 60;
    let semilla = 1, k = 3, mag = 30, nivel = false, choques = new Map([[22, 30], [41, -30]]), x = [], esp = [], res = [], sigma = 1, marcas = [], yoy = [], hover = -1, pl1 = null, pl2 = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de anomalía', min: 1.5, max: 4, paso: 0.1, valor: k, formato: (v) => `${VIZ.fmt(v, 2)} σ`, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Tamaño del choque que se agrega', min: -50, max: 50, paso: 5, valor: mag, alCambiar: (v) => { mag = v; } });
    ctl.casilla({ etiqueta: 'Cambio de nivel permanente desde el mes 36 (+20)', alCambiar: (v) => { nivel = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    ctl.boton('Quitar choques', () => { choques = new Map(); calcular(); });

    VIZ.subtitulo(cuerpo, 'Serie mensual y banda esperada');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 290 });
    const t1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Variación interanual (contra el mismo mes del año anterior)');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.24, altoMin: 140, altoMax: 200 });
    const t2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'serie', forma: 'linea' }, { color: C.s3, texto: 'rango esperado (tendencia + estación ± umbral)' }, { color: C.s8, texto: 'anomalía detectada' },
      { color: C.apagado, texto: 'choque inyectado no detectado' }, { color: C.s2, texto: 'variación interanual', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en la serie para agregar un choque del tamaño elegido en ese mes (otro clic lo quita). El detector marca los residuos que superan el umbral. Los 6 meses de cada extremo no tienen tendencia estimada y no se evalúan. Active el cambio de nivel: la variación interanual queda alta durante 12 meses.');

    function calcular() {
      const base = serie(semilla, N, { base: 100, tend: 0.6, amp: 12, per: 12, ruido: 3 });
      x = base.map((v, t) => v + (choques.get(t) || 0) + (nivel && t >= 36 ? 20 : 0));
      const T = mediaMovil(x, 12), idx = estacional(x, T);
      esp = x.map((_, t) => (Number.isFinite(T[t]) ? T[t] + idx[t % 12] : NaN));
      res = x.map((v, t) => v - esp[t]);
      const ok = res.filter(Number.isFinite), m0 = mediana(ok);
      sigma = 1.4826 * mediana(ok.map((r) => Math.abs(r - m0)));
      marcas = res.map((r) => Number.isFinite(r) && Math.abs(r - m0) > k * sigma);
      yoy = x.map((v, t) => (t >= 12 ? v / x[t - 12] - 1 : NaN));
      dibujar();
    }
    function dibujar() {
      const { ctx } = l1;
      l1.limpiar();
      pl1 = VIZ.plano(l1, { xmin: -0.5, xmax: N - 0.5, ymin: Math.min(...x) - 8, ymax: Math.max(...x) + 8 }, { ticksX: [0, 12, 24, 36, 48, 59], formatoX: (v) => String(v + 1), etiquetaX: 'mes' });
      pl1.ejes();
      ctx.fillStyle = VIZ.alfa(C.s3, 0.2);
      ctx.beginPath();
      let ini = true;
      for (let t = 0; t < N; t++) if (Number.isFinite(esp[t])) { const px = pl1.sx(t), py = pl1.sy(esp[t] + k * sigma); if (ini) ctx.moveTo(px, py); else ctx.lineTo(px, py); ini = false; }
      for (let t = N - 1; t >= 0; t--) if (Number.isFinite(esp[t])) ctx.lineTo(pl1.sx(t), pl1.sy(esp[t] - k * sigma));
      ctx.closePath(); ctx.fill();
      VIZ.trazar(ctx, pl1, x.map((v, t) => [t, v]), C.s1, 2);
      choques.forEach((_, t) => { if (!marcas[t]) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl1.sx(t), pl1.sy(x[t]), 7, 0, 7); ctx.stroke(); } });
      marcas.forEach((m, t) => { if (m) VIZ.marcador(ctx, pl1.sx(t), pl1.sy(x[t]), C.s8, 5); });
      if (hover >= 0) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl1.sx(hover), pl1.y0); ctx.lineTo(pl1.sx(hover), pl1.y1); ctx.stroke(); }
      const c2 = l2.ctx;
      l2.limpiar();
      const ys = yoy.filter(Number.isFinite), lim = Math.max(0.1, ...ys.map(Math.abs)) * 1.15;
      pl2 = VIZ.plano(l2, { xmin: -0.5, xmax: N - 0.5, ymin: -lim, ymax: lim }, { ticksX: [0, 12, 24, 36, 48, 59], formatoX: (v) => String(v + 1), formatoY: (v) => `${VIZ.fmt(v * 100, 2)} %` });
      pl2.ejes();
      c2.strokeStyle = C.apagado; c2.beginPath(); c2.moveTo(pl2.x0, pl2.sy(0)); c2.lineTo(pl2.x1, pl2.sy(0)); c2.stroke();
      VIZ.trazar(c2, pl2, yoy.map((v, t) => [t, v]), C.s2, 2);
      if (hover >= 0) { c2.strokeStyle = C.apagado; c2.lineWidth = 1; c2.beginPath(); c2.moveTo(pl2.sx(hover), pl2.y0); c2.lineTo(pl2.sx(hover), pl2.y1); c2.stroke(); if (Number.isFinite(yoy[hover])) VIZ.marcador(c2, pl2.sx(hover), pl2.sy(yoy[hover]), C.s2, 4.5); }
      const evaluables = [...choques.keys()].filter((t) => Number.isFinite(res[t])), acertados = evaluables.filter((t) => marcas[t]).length;
      const falsas = marcas.filter((m, t) => m && !choques.has(t)).length, total = marcas.filter(Boolean).length;
      registro.textContent = `Residuo = observado − (tendencia + estacionalidad). Con σ robusta = ${VIZ.fmt(sigma, 3)} y umbral ${VIZ.fmt(k, 2)} σ se marcan ${total} meses: ${acertados} de ${evaluables.length} choques evaluables y ${falsas} falsas alarmas.` +
        (nivel ? ' El cambio de nivel no es una anomalía puntual: la media móvil lo absorbe a medias y la variación interanual se mantiene alta 12 meses.' : '');
      lectura.set([
        ['choques inyectados', String(choques.size)],
        ['detectados', `${acertados} de ${evaluables.length} evaluables`],
        ['falsas alarmas', String(falsas)],
        ['σ del residuo (robusta)', VIZ.fmt(sigma, 3)],
        ['umbral en unidades', VIZ.fmt(k * sigma, 3)],
        ['variación interanual del último mes', pct(yoy[N - 1])],
      ]);
    }
    const mes = (l, pl, ev) => { const { x: px, y: py } = l.posicion(ev); return pl && pl.dentro(px, py) ? { t: Math.max(0, Math.min(N - 1, Math.round(pl.ix(px)))), px, py } : null; };
    [[l1, () => pl1, t1], [l2, () => pl2, t2]].forEach(([l, getPl, tip]) => {
      l.alDibujar = () => x.length && dibujar();
      l.canvas.addEventListener('pointermove', (ev) => {
        const h = mes(l, getPl(), ev);
        if (!h) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
        if (h.t !== hover) { hover = h.t; dibujar(); }
        const t = h.t;
        tip.mostrar(h.px, h.py, `<b>${nombreMes(t)}</b>` + VIZ.filaTooltip(C.s1, 'valor', VIZ.fmt(x[t])) + (Number.isFinite(esp[t]) ? VIZ.filaTooltip(C.s3, 'esperado', VIZ.fmt(esp[t])) + `residuo <b>${VIZ.fmt(res[t])}</b>${marcas[t] ? ' · anomalía' : ''}<br>` : 'sin tendencia estimada<br>') +
          (Number.isFinite(yoy[t]) ? VIZ.filaTooltip(C.s2, 'interanual', pct(yoy[t])) : ''));
      });
      l.canvas.addEventListener('pointerleave', () => { hover = -1; t1.ocultar(); t2.ocultar(); if (x.length) dibujar(); });
    });
    l1.canvas.style.cursor = 'crosshair';
    l1.canvas.addEventListener('click', (ev) => {
      const h = mes(l1, pl1, ev);
      if (!h) return;
      if (choques.has(h.t)) choques.delete(h.t); else choques.set(h.t, mag);
      calcular();
    });
    calcular();
  }

  VIZ.registrarTema('descriptive-trend-analysis', {
    intro: String.raw`
      <p>El <strong>análisis descriptivo</strong> responde «¿qué pasó?» antes de preguntar «¿por qué?» o «¿qué pasará?». Con una serie mensual de ventas, lo primero es separar lo que se repite de lo que cambia:
      una <em>tendencia</em> (hacia dónde va), una <em>estacionalidad</em> (el ciclo que se repite cada año) y un <em>ruido</em> que no se explica. Lo que sobra al quitar los dos primeros revela las anomalías.</p>
      <p>Las dos figuras trabajan con series simuladas reproducibles: en la primera descompone y ve cómo la ventana de la media móvil decide qué se considera tendencia; en la segunda detecta meses fuera de lo esperado y los compara con la variación interanual.</p>`,
    visualizaciones: [
      {
        titulo: 'Tendencia, estacionalidad y ruido',
        descripcion: 'Suba el ruido y observe cómo se ensucia el residuo pero la tendencia se mantiene. Cambie la ventana de 12 a 5 meses y vea reaparecer ondas en la «tendencia».',
        montar: montarDescomposicion,
      },
      {
        titulo: 'Anomalías y variación interanual',
        descripcion: 'Haga clic en la serie para inyectar choques y baje el umbral hasta que aparezcan falsas alarmas. Active el cambio de nivel y compare lo que ven el detector y la variación interanual.',
        montar: montarAnomalias,
      },
    ],
    teoria: String.raw`
      <h2>Modelo de descomposición</h2>
      <p>Una serie mensual \(x_t\) se modela como suma de tres componentes:</p>
      \[ x_t = T_t + E_t + R_t, \]
      <p>con \(T_t\) la tendencia, \(E_t\) un componente periódico de periodo \(p = 12\) (con \(E_{t+12} = E_t\) y \(\sum_{k} E_k = 0\)) y \(R_t\) el residuo. (Cuando la amplitud crece con el nivel se usa el modelo multiplicativo \(x_t = T_t E_t R_t\).)</p>
      <h3>Pasos de la descomposición clásica</h3>
      <pre><code>1. T ← media móvil centrada de ventana p        (la estacionalidad se cancela)
2. d ← x − T                                    (serie sin tendencia)
3. E[k] ← promedio de d en los meses con el mismo k; restar la media de E
4. R ← x − T − E</code></pre>
      <p>Para \(p\) par, la media móvil centrada de ventana \(p\) usa pesos \(\tfrac{1}{2p}\) en los extremos y \(\tfrac{1}{p}\) en el interior; quedan sin tendencia los primeros y los últimos \(p/2\) meses. Una ventana distinta del periodo no cancela el ciclo, que queda dentro de \(T_t\).</p>
      <h2>Variación interanual</h2>
      <p>Para comparar sin que la estacionalidad confunda, se compara cada mes con el mismo mes del año anterior:</p>
      \[ \text{VIA}_t = \frac{x_t}{x_{t-12}} - 1. \]
      <p>Si hay un cambio de nivel de \(+20\) en una serie con valores cercanos a 120, la variación interanual salta unos 17 % y se mantiene durante 12 meses, hasta que la base de comparación también incorpora el cambio.</p>
      <h2>Detección de anomalías</h2>
      <p>Un mes es anómalo si su residuo se aleja de la mediana más de \(k\) desviaciones robustas:</p>
      \[ \left| R_t - \tilde R \right| > k\,\hat\sigma, \qquad \hat\sigma = 1{,}4826\;\operatorname{mediana}\left(\left| R_t - \tilde R \right|\right). \]
      <p>El factor 1,4826 vuelve la desviación absoluta mediana comparable con la desviación estándar de una normal, y es robusta: los propios choques no inflan \(\hat\sigma\). Con \(k = 3\) y ruido normal se espera cerca de 0,3 % de falsas alarmas; con \(k = 2\), cerca del 5 %.</p>
      <div class="recuadro"><p><strong>Anomalía no es error.</strong> Un valor atípico puede ser un error de captura (ver <a href="tema.html?id=information-quality">calidad de la información</a>) o un hecho real, como una promoción. Un cambio de nivel no es atípico: es un cambio del proceso.</p></div>
      <h2>Conexiones</h2>
      <p>El análisis exploratorio general se trata en <a href="tema.html?id=exploratory-data-analysis">análisis exploratorio de datos</a>; los resultados se presentan en <a href="tema.html?id=dashboards-reports">tableros</a>, y la tendencia estimada es el punto de partida del
      <a href="tema.html?id=big-data-predictive">análisis predictivo</a>.</p>`,
  });
})();
