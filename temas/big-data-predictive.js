(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  const media = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

  // Serie base + tend·t + amp·sen(2πt/per) + ruido (definida aquí porque VIZ.si.serie usa VIZ.normal como si fuera un generador).
  function serie(semilla, n, { base = 100, tend = 0.5, amp = 10, per = 12, ruido = 4 } = {}) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: n }, (_, t) => base + tend * t + amp * Math.sin((2 * Math.PI * t) / per) + ruido * VIZ.normal(rnd));
  }

  /* ---------- Fig. 1: las tres V ---------- */

  const COORD = 30; // segundos de coordinación por cada duplicación del número de nodos
  function montarTresV(cuerpo) {
    let lev = 4.3, bytes = 1000, noEst = 0.4, vel = 100, sla = 4, hover = 0, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Velocidad: eventos por segundo', min: 2, max: 6, paso: 0.1, valor: lev, formato: (v) => `${VIZ.entero(Math.pow(10, v))} ev/s`, alCambiar: (v) => { lev = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño de cada evento', min: 200, max: 5000, paso: 100, valor: bytes, formato: (v) => `${VIZ.entero(v)} B`, alCambiar: (v) => { bytes = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Variedad: datos no estructurados', min: 0, max: 1, paso: 0.05, valor: noEst, formato: pct, alCambiar: (v) => { noEst = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Rendimiento de un nodo', min: 50, max: 400, paso: 10, valor: vel, formato: (v) => `${v} MB/s`, alCambiar: (v) => { vel = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Plazo para procesar un día', min: 1, max: 24, valor: sla, formato: (v) => `${v} h`, alCambiar: (v) => { sla = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tiempo de procesar un día de datos', forma: 'linea' }, { color: C.s8, texto: 'plazo exigido', forma: 'linea' }, { color: C.s6, texto: 'mínimo de nodos que cumple el plazo' }, { color: C.apagado, texto: 'ideal (sin coordinación)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva la velocidad de llegada, el tamaño de los eventos y la fracción de datos sin estructura (texto, imágenes, registros): el volumen diario y el tiempo en un solo servidor cambian. Pase el cursor sobre la curva para ver cuánto se gana con cada duplicación de nodos. El procesamiento de datos no estructurados se supone 3 veces más lento.');

    const calc = () => {
      const evs = Math.pow(10, lev), gbDia = (evs * 86400 * bytes) / 1e9, eq = gbDia * (1 + 2 * noEst);
      const T = (n) => (eq * 1000) / (n * vel) / 3600 + (COORD * Math.log2(n)) / 3600;
      let minN = null;
      for (let n = 1; n <= 4096; n++) if (T(n) <= sla) { minN = n; break; }
      return { evs, gbDia, eq, T, minN };
    };
    function dibujar() {
      const { ctx } = lienzo, k = calc();
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 8, ymin: 0.02, ymax: Math.max(k.T(1), sla) * 1.6 }, { logY: true, etiquetaX: 'nodos', etiquetaY: 'horas', ticksX: [0, 1, 2, 3, 4, 5, 6, 7, 8], formatoX: (v) => String(Math.pow(2, v)), formatoY: (v) => VIZ.fmt(v, 2), margen: { izq: 62 } });
      pl.ejes();
      const pts = [], ideal = [];
      for (let e = 0; e <= 8.001; e += 0.05) { pts.push([e, k.T(Math.pow(2, e))]); ideal.push([e, k.T(1) / Math.pow(2, e)]); }
      pl.recortar && ctx.save(); pl.recortar(); VIZ.trazar(ctx, pl, ideal, C.apagado, 1.5, [3, 4]); VIZ.trazar(ctx, pl, pts, C.s1, 2.5); ctx.restore();
      ctx.save(); ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(sla)); ctx.lineTo(pl.x1, pl.sy(sla)); ctx.stroke(); ctx.restore();
      if (k.minN && Math.log2(k.minN) <= 8) VIZ.marcador(ctx, pl.sx(Math.log2(k.minN)), pl.sy(k.T(k.minN)), C.s6, 6.5);
      if (hover) VIZ.marcador(ctx, pl.sx(Math.log2(hover)), pl.sy(k.T(hover)), C.s1, 4.5);
      const unaH = k.T(1), anio = k.gbDia * 365 / 1000;
      registro.textContent = `${VIZ.entero(k.evs)} eventos por segundo de ${bytes} B son ${VIZ.fmt(k.gbDia, 4)} GB al día (${VIZ.fmt(anio, 3)} TB al año). Con ${pct(noEst)} sin estructura equivalen a ${VIZ.fmt(k.eq, 4)} GB de datos «tabulares». ` +
        (unaH <= sla ? 'Un solo servidor basta.' : k.minN ? `Un servidor tardaría ${VIZ.fmt(unaH, 3)} h; hacen falta ${k.minN} nodos para cumplir ${sla} h.` : `Ni con 4096 nodos se cumple el plazo: la coordinación domina.`);
      lectura.set([
        ['volumen por día', `${VIZ.fmt(k.gbDia, 4)} GB`],
        ['volumen por año', `${VIZ.fmt(anio, 3)} TB`],
        ['velocidad', `${VIZ.fmt(k.evs * bytes / 1e6, 3)} MB/s`],
        ['variedad (no estructurado)', pct(noEst)],
        ['un servidor tarda', `${VIZ.fmt(unaH, 3)} h`],
        ['nodos mínimos para el plazo', k.minN ? String(k.minN) : 'ninguno'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = 0; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(256, Math.round(Math.pow(2, pl.ix(x)))));
      dibujar();
      const k = calc(), t = k.T(hover);
      tip.mostrar(x, y, `<b>${hover}</b> nodos<br>tiempo <b>${VIZ.fmt(t, 3)} h</b><br>aceleración <b>${VIZ.fmt(k.T(1) / t, 3)} ×</b> (ideal ${hover} ×)<br>eficiencia <b>${pct(k.T(1) / (t * hover))}</b><br>${t <= sla ? 'cumple el plazo' : 'no cumple el plazo'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = 0; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: pronóstico con regresión ---------- */

  const N2 = 48, H = 12;
  function regresion(ys) {
    const n = ys.length, mx = (n - 1) / 2, my = media(ys);
    let sxy = 0, sxx = 0;
    ys.forEach((y, t) => { sxy += (t - mx) * (y - my); sxx += (t - mx) ** 2; });
    const b = sxx ? sxy / sxx : 0;
    return { a: my - b * mx, b };
  }
  function montarPronostico(cuerpo) {
    let semilla = 1, k = 24, modelo = 'estacional', y = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    const rK = ctl.rango({ etiqueta: 'Meses de historia usados', min: 6, max: 36, valor: k, formato: (v) => `${v} meses`, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Modelo', opciones: [['lineal', 'Recta de tendencia'], ['estacional', 'Tendencia + estacionalidad']], valor: modelo, alCambiar: (v) => { modelo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; y = serie(semilla, N2, { base: 100, tend: 0.8, amp: 12, ruido: 4 }); dibujar(); }, { primario: true });
    y = serie(semilla, N2, { base: 100, tend: 0.8, amp: 12, ruido: 4 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'ventas observadas (historia)', forma: 'linea' }, { color: C.inactivo, texto: 'ventas que ocurrieron después (no usadas)', forma: 'linea' },
      { color: C.s2, texto: 'modelo ajustado y pronóstico', forma: 'linea' }, { color: C.s2, texto: 'banda ±2 error de ajuste' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El modelo solo ve los meses de historia; los 12 siguientes se pronostican y se comparan con lo que realmente ocurrió. Haga clic en el gráfico para mover el corte, o use el deslizador. Con menos de 12 meses de historia el modelo estacional no ha visto todas las estaciones.');

    function ajustar() {
      const h = y.slice(0, k), { a, b } = regresion(h);
      const res = h.map((v, t) => v - (a + b * t)), idx = Array(12).fill(0);
      if (modelo === 'estacional') {
        for (let m = 0; m < 12; m++) { const r = res.filter((_, t) => t % 12 === m); idx[m] = r.length ? media(r) : 0; }
        const c = media(idx.filter((_, m) => res.some((__, t) => t % 12 === m)));
        for (let m = 0; m < 12; m++) if (res.some((__, t) => t % 12 === m)) idx[m] -= c;
      }
      const f = (t) => a + b * t + (modelo === 'estacional' ? idx[t % 12] : 0);
      const ajuste = h.map((v, t) => v - f(t));
      const sd = Math.sqrt(media(ajuste.map((e) => e * e)));
      const fut = y.slice(k, k + H), err = fut.map((v, i) => v - f(k + i));
      return { f, a, b, sd, rmse: Math.sqrt(media(err.map((e) => e * e))), mape: media(fut.map((v, i) => Math.abs(err[i]) / v)), n: fut.length };
    }
    function dibujar() {
      const { ctx } = lienzo, m = ajustar();
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -0.5, xmax: N2 - 0.5, ymin: Math.min(...y) - 10, ymax: Math.max(...y) + 10 }, { ticksX: [0, 12, 24, 36, 47], formatoX: (v) => String(v + 1), etiquetaX: 'mes' });
      pl.ejes();
      const fin = Math.min(N2 - 1, k + H - 1);
      ctx.fillStyle = VIZ.alfa(C.s2, 0.14); ctx.beginPath();
      for (let t = k; t <= fin; t++) { const px = pl.sx(t), py = pl.sy(m.f(t) + 2 * m.sd); t === k ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      for (let t = fin; t >= k; t--) ctx.lineTo(pl.sx(t), pl.sy(m.f(t) - 2 * m.sd));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(k - 0.5), pl.y0); ctx.lineTo(pl.sx(k - 0.5), pl.y1); ctx.stroke(); ctx.setLineDash([]);
      VIZ.trazar(ctx, pl, y.map((v, t) => [t, v]).filter(([t]) => t >= k - 1), C.inactivo, 2);
      VIZ.trazar(ctx, pl, y.slice(0, k).map((v, t) => [t, v]), C.s1, 2.5);
      VIZ.trazar(ctx, pl, Array.from({ length: fin + 1 }, (_, t) => [t, m.f(t)]), C.s2, 2.5, null);
      if (hover >= 0) { ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y0); ctx.lineTo(pl.sx(hover), pl.y1); ctx.stroke(); VIZ.marcador(ctx, pl.sx(hover), pl.sy(y[hover]), hover < k ? C.s1 : C.inactivo, 4.5); VIZ.marcador(ctx, pl.sx(hover), pl.sy(m.f(hover)), C.s2, 4.5); }
      registro.textContent = `Con ${k} meses de historia, la recta es ventas ≈ ${VIZ.fmt(m.a, 4)} + ${VIZ.fmt(m.b, 3)}·mes. El pronóstico de los ${m.n} meses siguientes se desvía en promedio ${pct(m.mape)} de lo real (RMSE ${VIZ.fmt(m.rmse, 3)}); en la historia el error de ajuste es ${VIZ.fmt(m.sd, 3)}.`;
      lectura.set([
        ['historia usada', `${k} meses`],
        ['pendiente estimada / real', `${VIZ.fmt(m.b, 3)} / 0,8 por mes`],
        ['error de ajuste (historia)', VIZ.fmt(m.sd, 3)],
        ['error de pronóstico (RMSE)', VIZ.fmt(m.rmse, 3)],
        ['error porcentual medio (MAPE)', pct(m.mape)],
        ['pronóstico del mes siguiente', VIZ.fmt(m.f(k), 4)],
      ]);
      m.dib = true;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: py } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, py)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(N2 - 1, Math.round(pl.ix(x))));
      dibujar();
      const m = ajustar();
      tip.mostrar(x, py, `<b>mes ${hover + 1}</b> (${hover < k ? 'historia' : 'futuro'})` + VIZ.filaTooltip(hover < k ? C.s1 : C.inactivo, 'real', VIZ.fmt(y[hover])) + VIZ.filaTooltip(C.s2, hover < k ? 'ajustado' : 'pronóstico', VIZ.fmt(m.f(hover))) + `error <b>${VIZ.fmt(y[hover] - m.f(hover))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y: py } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, py)) return;
      k = Math.max(6, Math.min(36, Math.round(pl.ix(x)) + 1)); rK.valor = k; dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 3: error frente a cantidad de datos ---------- */

  const NS = [5, 10, 20, 40, 80, 160, 320, 640, 1280];
  const verdad = (x) => 50 + 6 * x - 0.35 * x * x; // ventas según gasto en publicidad (0–10)
  function ajustePoli(xs, ys, grado) {
    const m = grado + 1, A = Array.from({ length: m }, () => Array(m + 1).fill(0));
    xs.forEach((x, i) => {
      const u = (x - 5) / 5, p = Array.from({ length: m }, (_, j) => u ** j);
      for (let r = 0; r < m; r++) { for (let c = 0; c < m; c++) A[r][c] += p[r] * p[c]; A[r][m] += p[r] * ys[i]; }
    });
    for (let r = 0; r < m; r++) A[r][r] += 1e-6;
    for (let c = 0; c < m; c++) {
      let piv = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = c + 1; r < m; r++) { const f = A[r][c] / A[c][c]; for (let q = c; q <= m; q++) A[r][q] -= f * A[c][q]; }
    }
    const w = Array(m).fill(0);
    for (let r = m - 1; r >= 0; r--) { let s = A[r][m]; for (let c = r + 1; c < m; c++) s -= A[r][c] * w[c]; w[r] = s / A[r][r]; }
    return (x) => { const u = (x - 5) / 5; return w.reduce((s, wj, j) => s + wj * u ** j, 0); };
  }
  const MODELOS = [{ g: 1, n: 'Recta (grado 1)', c: C.s1 }, { g: 2, n: 'Parábola (grado 2)', c: C.s2 }, { g: 5, n: 'Polinomio de grado 5', c: C.s3 }];
  function montarCurva(cuerpo) {
    let p1g = null, semilla = 1, sigma = 8, gSel = 2, paso = 0, cache = null, hover = -1, pl = null, datosMuestra = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ruido de las ventas (σ)', min: 1, max: 15, valor: sigma, alCambiar: (v) => { sigma = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Modelo mostrado a la izquierda', opciones: MODELOS.map((m) => [m.g, m.n]), valor: gSel, alCambiar: (v) => { gSel = +v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    VIZ.subtitulo(cuerpo, 'Datos disponibles y modelo ajustado');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 280 });
    const t1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Error de pronóstico sobre ventas nuevas, según la cantidad de datos');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 280 });
    const t2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      ...MODELOS.map((m) => ({ color: m.c, texto: m.n, forma: 'linea' })), { color: C.apagado, texto: 'ruido irreducible (σ)', forma: 'linea' },
      { color: C.inactivo, texto: 'ventas observadas' }, { color: C.tinta, texto: 'relación verdadera', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso multiplica por dos los datos de entrenamiento. A la izquierda, un conjunto de datos y el modelo ajustado; a la derecha, el error promedio (12 repeticiones) sobre ventas nuevas. Observe que la recta se estanca por encima del ruido (sesgo) mientras el polinomio de grado 5 mejora mucho con más datos.');

    const rndTest = VIZ.semilla(999);
    const test = Array.from({ length: 300 }, () => { const x = rndTest() * 10; return [x, verdad(x)]; });
    function simular() {
      const clave = `${semilla}-${sigma}`;
      if (cache && cache.clave === clave) return cache;
      const rnd = VIZ.semilla(semilla * 101 + 7), nor = () => VIZ.normal(rnd);
      const rndTest2 = VIZ.semilla(5), ytest = test.map(([x]) => verdad(x) + sigma * VIZ.normal(rndTest2));
      const err = MODELOS.map(() => NS.map(() => 0)), primero = [];
      const R = 12;
      NS.forEach((n, i) => {
        for (let r = 0; r < R; r++) {
          const xs = Array.from({ length: n }, () => rnd() * 10), ys = xs.map((x) => verdad(x) + sigma * nor());
          if (r === 0) primero[i] = xs.map((x, j) => [x, ys[j]]);
          MODELOS.forEach((m, q) => { const f = ajustePoli(xs, ys, m.g); err[q][i] += Math.sqrt(media(test.map(([x], j) => (f(x) - ytest[j]) ** 2))) / R; });
        }
      });
      cache = { clave, err, primero };
      return cache;
    }
    function iniciar() { paso = 0; return (function* () { while (paso < NS.length - 1) { paso++; yield; } })(); }
    function dibujar() {
      const c = simular(), n = NS[paso], { ctx } = l1;
      l1.limpiar();
      const p1 = VIZ.plano(l1, { xmin: 0, xmax: 10, ymin: 20, ymax: 100 }, { etiquetaX: 'gasto en publicidad', etiquetaY: 'ventas', formatoX: (v) => String(v) });
      p1.ejes(); p1g = p1;
      datosMuestra = c.primero[paso];
      const mostrar = datosMuestra.slice(0, 300);
      mostrar.forEach(([x, y]) => { ctx.fillStyle = VIZ.alfa(C.inactivo, 0.7); ctx.beginPath(); ctx.arc(p1.sx(x), p1.sy(y), 3, 0, 7); ctx.fill(); });
      VIZ.trazar(ctx, p1, Array.from({ length: 101 }, (_, i) => [i / 10, verdad(i / 10)]), C.tinta, 1.5, [4, 3]);
      const mod = MODELOS.find((m) => m.g === gSel), f = ajustePoli(datosMuestra.map((d) => d[0]), datosMuestra.map((d) => d[1]), gSel);
      ctx.save(); p1.recortar(); VIZ.trazar(ctx, p1, Array.from({ length: 101 }, (_, i) => [i / 10, f(i / 10)]), mod.c, 2.5); ctx.restore();
      // curvas de error
      const c2 = l2.ctx;
      l2.limpiar();
      pl = VIZ.plano(l2, { xmin: 0, xmax: NS.length - 1, ymin: 0, ymax: Math.max(...c.err.flat().slice(0), sigma * 1.5) * 1.05 }, { etiquetaX: 'datos de entrenamiento', etiquetaY: 'error RMSE', ticksX: NS.map((_, i) => i), formatoX: (v) => String(NS[v]), formatoY: (v) => VIZ.fmt(v, 3) });
      pl.ejes();
      c2.save(); pl.recortar(); c2.strokeStyle = C.apagado; c2.lineWidth = 1.5; c2.setLineDash([3, 4]); c2.beginPath(); c2.moveTo(pl.x0, pl.sy(sigma)); c2.lineTo(pl.x1, pl.sy(sigma)); c2.stroke(); c2.restore();
      MODELOS.forEach((m, q) => { VIZ.trazar(c2, pl, c.err[q].slice(0, paso + 1).map((v, i) => [i, v]), m.c, 2.5); VIZ.marcador(c2, pl.sx(paso), pl.sy(c.err[q][paso]), m.c, 4.5); });
      if (hover >= 0 && hover <= paso) { c2.strokeStyle = C.apagado; c2.lineWidth = 1; c2.beginPath(); c2.moveTo(pl.sx(hover), pl.y0); c2.lineTo(pl.sx(hover), pl.y1); c2.stroke(); }
      const e = c.err[MODELOS.findIndex((m) => m.g === gSel)];
      registro.textContent = `Con ${n} datos, el ${mod.n.toLowerCase()} se equivoca en promedio ${VIZ.fmt(e[paso], 3)} unidades de venta (ruido irreducible: ${sigma}). ` +
        (paso ? `Al duplicar los datos el error cambió ${pct(e[paso] / e[paso - 1] - 1)}.` : 'Con tan pocos datos el modelo apenas puede aprender.');
      lectura.set([
        ['datos de entrenamiento', String(n)],
        ...MODELOS.map((m, q) => [`error: ${m.n.toLowerCase()}`, VIZ.fmt(c.err[q][paso], 3)]),
        ['ruido irreducible', String(sigma)],
        ['mejor modelo con estos datos', MODELOS.reduce((a, m, q) => (c.err[q][paso] < c.err[MODELOS.indexOf(a)][paso] ? m : a)).n],
      ]);
    }
    l1.alDibujar = () => cache && dibujar();
    l2.alDibujar = () => cache && dibujar();
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!p1g || !datosMuestra.length) return t1.ocultar();
      const d = datosMuestra.slice(0, 300).reduce((m, q) => (Math.hypot(p1g.sx(q[0]) - x, p1g.sy(q[1]) - y) < Math.hypot(p1g.sx(m[0]) - x, p1g.sy(m[1]) - y) ? q : m));
      if (Math.hypot(p1g.sx(d[0]) - x, p1g.sy(d[1]) - y) > 14) return t1.ocultar();
      t1.mostrar(x, y, `gasto <b>${VIZ.fmt(d[0], 3)}</b><br>ventas <b>${VIZ.fmt(d[1], 3)}</b><br>relación verdadera <b>${VIZ.fmt(verdad(d[0]), 3)}</b>`);
    });
    l1.canvas.addEventListener('pointerleave', () => t1.ocultar());
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return t2.ocultar(); }
      const i = Math.max(0, Math.min(paso, Math.round(pl.ix(x))));
      if (i !== hover) { hover = i; dibujar(); }
      const c = simular();
      t2.mostrar(x, y, `<b>${NS[i]}</b> datos` + MODELOS.map((m, q) => VIZ.filaTooltip(m.c, m.n, VIZ.fmt(c.err[q][i], 3))).join('') + `ruido irreducible <b>${sigma}</b>`);
    });
    l2.canvas.addEventListener('pointerleave', () => { hover = -1; t2.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('big-data-predictive', {
    intro: String.raw`
      <p><strong>Big data</strong> no es solo «muchos datos»: se caracteriza por el <em>volumen</em> (cuánto), la <em>velocidad</em> (con qué rapidez llegan) y la <em>variedad</em> (formatos distintos, muchos sin estructura). Cuando una de las tres supera lo que un servidor
      puede procesar, hace falta repartir el trabajo entre varios nodos. El <strong>análisis predictivo</strong> usa esos datos para estimar lo que vendrá, ajustando un modelo, como una regresión, a lo ocurrido.</p>
      <p>Las figuras muestran cuántos nodos exige una carga de datos, cómo un modelo simple pronostica ventas, y por qué más datos mejoran un modelo solo hasta cierto punto: lo decide también la forma del modelo.</p>`,
    visualizaciones: [
      {
        titulo: 'Volumen, velocidad y variedad',
        descripcion: 'Suba los eventos por segundo y la fracción no estructurada, y mire cuántos nodos necesita para cumplir el plazo. Observe que duplicar nodos no siempre duplica la velocidad.',
        montar: montarTresV,
      },
      {
        titulo: 'Pronóstico de ventas con regresión',
        descripcion: 'Mueva el corte de la historia y compare la recta con el modelo que agrega estacionalidad. Con 12 meses o menos el modelo estacional aún no conoce todas las estaciones.',
        montar: montarPronostico,
      },
      {
        titulo: 'Más datos, menos error (hasta cierto punto)',
        descripcion: 'Avance por duplicaciones de datos y compare los tres modelos. Observe quién mejora más y quién se detiene en un piso por encima del ruido.',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Las tres V</h2>
      <table>
        <tr><th>Característica</th><th>Significa</th><th>Ejemplo en una cadena comercial</th></tr>
        <tr><td>Volumen</td><td>Cantidad total de datos</td><td>Años de ventas de todas las tiendas</td></tr>
        <tr><td>Velocidad</td><td>Ritmo de llegada y de respuesta</td><td>Clics y pagos de la tienda web, segundo a segundo</td></tr>
        <tr><td>Variedad</td><td>Formatos distintos</td><td>Tablas, reseñas en texto, imágenes de productos, registros de sensores</td></tr>
      </table>
      <p>Con \(v\) eventos por segundo de \(b\) bytes, el volumen diario es \(D = 86\,400\,v\,b\). Si una fracción \(u\) de los datos no está estructurada y cuesta 3 veces más procesar, el volumen equivalente es \(D_{eq} = D\,(1 + 2u)\) y con \(n\) nodos de rendimiento \(r\) y coordinación \(c\) por duplicación:</p>
      \[ T(n) = \frac{D_{eq}}{n\,r} + c\,\log_2 n. \]
      <p><strong>Ejemplo.</strong> Con \(v = 20\,000\) ev/s, \(b = 1\,000\) B, \(u = 0{,}4\), \(r = 100\) MB/s y \(c = 30\) s: \(D = 1{,}73\) TB/día, \(D_{eq} = 3{,}11\) TB y \(T(1) = 8{,}6\) h. Para un plazo de 4 h,
      \(T(2) \approx 4{,}3\) h no alcanza y \(T(3) \approx 2{,}9\) h sí: bastan 3 nodos. Más allá, la aceleración queda por debajo de la ideal porque el término \(c\log_2 n\) no se reparte.</p>
      <h2>Regresión simple y pronóstico</h2>
      <p>El modelo de regresión lineal ajusta \(\hat y_t = a + b\,t\) por mínimos cuadrados (ver <a href="tema.html?id=linear-regression">regresión lineal</a>):</p>
      \[ b = \frac{\sum_t (t - \bar t)(y_t - \bar y)}{\sum_t (t - \bar t)^2}, \qquad a = \bar y - b\,\bar t. \]
      <p>Ejemplo: con ventas de 10, 12, 15 y 17 en los meses 1 a 4, \(\bar t = 2{,}5\), \(\bar y = 13{,}5\), \(b = 12/5 = 2{,}4\) y \(a = 7{,}5\), de modo que el pronóstico del mes 5 es \(7{,}5 + 2{,}4\cdot 5 = 19{,}5\).
      Para series con ciclos se agregan los índices estacionales (<a href="tema.html?id=descriptive-trend-analysis">descomposición</a>). La calidad del pronóstico se mide con datos que el modelo no vio:</p>
      \[ \mathrm{RMSE} = \sqrt{\frac{1}{m}\sum_{i=1}^{m}(y_i - \hat y_i)^2}, \qquad \mathrm{MAPE} = \frac{1}{m}\sum_{i=1}^{m}\frac{|y_i - \hat y_i|}{y_i}. \]
      <h2>Error y cantidad de datos</h2>
      <p>El error esperado sobre datos nuevos se descompone en tres términos (ver <a href="tema.html?id=bias-variance">sesgo y varianza</a>):</p>
      \[ \mathbb{E}[(y - \hat y)^2] = \underbrace{\sigma^2}_{\text{ruido}} + \underbrace{\text{sesgo}^2}_{\text{modelo demasiado simple}} + \underbrace{\text{varianza}}_{\approx\ \sigma^2 p / n}, \]
      <p>con \(p\) parámetros y \(n\) datos. Más datos reducen la varianza, que cae como \(1/n\), pero no el sesgo: una recta ajustada a una relación curva se estanca por encima del ruido, mientras un modelo flexible necesita muchos datos para dejar de sobreajustar. Por eso el valor de acumular datos depende de la complejidad del modelo; ver también las <a href="tema.html?id=learning-curves">curvas de aprendizaje</a>.</p>
      <div class="recuadro"><p><strong>Del dato a la decisión.</strong> Un pronóstico no decide: reduce incertidumbre. Un buen uso es traducirlo a una acción (cuánto inventario comprar) y a su costo de equivocarse, por ejemplo en los
      <a href="tema.html?id=bi-dss">sistemas de soporte a decisiones</a>.</p></div>
      <h2>Conexiones</h2>
      <p>Para modelos más ricos que la regresión, véase <a href="tema.html?id=machine-learning">aprendizaje automático</a> y su uso en <a href="tema.html?id=ai-ml-business">organizaciones</a>; los datos llegan al análisis a través del <a href="tema.html?id=etl-process">ETL</a>, y los
      riesgos de privacidad que acompañan a los datos masivos se tratan en <a href="tema.html?id=data-protection">protección de datos</a>.</p>`,
  });
})();
