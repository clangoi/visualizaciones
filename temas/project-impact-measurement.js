(function () {
  'use strict';
  const { color: C } = VIZ;

  const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const desv = (a) => { const m = media(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, a.length - 1)); };
  const cuantil = (a, q) => { const s = [...a].sort((x, y) => x - y), p = q * (s.length - 1), i = Math.floor(p); return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (p - i); };
  const Phi = (z) => {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  };
  const sg = (v, d = 3) => `${v >= 0 ? '+' : '−'}${VIZ.fmt(Math.abs(v), d)}`;
  const pc = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Fig. 1: antes y después en una sola cohorte ---------- */

  function montarAntesDespues(cuerpo) {
    let semilla = 1, efecto = -3, tend = -2, ruido = 3, n = 24, contra = true, datos = [], hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Efecto real del proyecto', min: -8, max: 0, paso: 0.5, valor: efecto, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { efecto = v; calcular(); } });
    ctl.rango({ etiqueta: 'Tendencia general sin proyecto', min: -6, max: 6, paso: 0.5, valor: tend, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { tend = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido de cada medición', min: 0.5, max: 6, paso: 0.5, valor: ruido, formato: (v) => `${v} min`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Sucursales con el proyecto', min: 6, max: 40, valor: n, formato: (v) => String(v), alCambiar: (v) => { n = v; calcular(); } });
    ctl.casilla({ etiqueta: 'Mostrar qué habría pasado sin proyecto', valor: contra, alCambiar: (v) => { contra = v; dibujar(); } });
    ctl.boton('Nuevas sucursales', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'sucursal que mejora (baja el tiempo)', forma: 'linea' }, { color: C.s8, texto: 'sucursal que empeora', forma: 'linea' },
      { color: C.s1, texto: 'promedio', forma: 'linea' }, { color: C.apagado, texto: 'sin proyecto (solo tendencia)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea es una sucursal que adoptó el sistema de turnos. Con tendencia −2 y efecto −3, el «antes y después» atribuye al proyecto unos −5 min. Ponga la tendencia en 0 y compare, o suba el ruido hasta que la mejora no sea distinguible del azar.');

    let est = null;
    function calcular() {
      const rnd = VIZ.semilla(semilla * 71 + 5), nor = () => VIZ.normal(rnd);
      datos = Array.from({ length: n }, (_, i) => { const b = 30 + 5 * nor(); return { i, a: b + ruido * nor(), d: b + tend + efecto + ruido * nor() }; });
      const dif = datos.map((u) => u.d - u.a), m = media(dif), ee = desv(dif) / Math.sqrt(n);
      est = { m, ee, t: m / ee, ma: media(datos.map((u) => u.a)), md: media(datos.map((u) => u.d)) };
      dibujar();
    }
    function dibujar() {
      if (!est) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const xa = W * 0.28, xd = W * 0.72, top = 34, bot = H - 34;
      const todos = datos.flatMap((u) => [u.a, u.d]), lo = Math.min(...todos) - 1, hi = Math.max(...todos) + 1;
      const sy = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
      geo = { xa, xd, sy, lo, hi, top, bot };
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('ANTES', xa, 6); ctx.fillText('DESPUÉS', xd, 6);
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      for (const x of [xa, xd]) { ctx.beginPath(); ctx.moveTo(x, top - 6); ctx.lineTo(x, bot + 4); ctx.stroke(); }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'middle';
      VIZ.ticks(lo, hi, 5).forEach((v) => { ctx.textAlign = 'right'; ctx.fillText(VIZ.fmt(v, 3), xa - 8, sy(v)); ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(v, 3), xd + 8, sy(v)); });
      ctx.save(); ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('min por atención', 4, 20); ctx.restore();
      datos.forEach((u) => {
        const mejora = u.d < u.a;
        ctx.strokeStyle = VIZ.alfa(mejora ? C.s6 : C.s8, u.i === hover ? 1 : 0.38); ctx.lineWidth = u.i === hover ? 2.5 : 1.2;
        ctx.beginPath(); ctx.moveTo(xa, sy(u.a)); ctx.lineTo(xd, sy(u.d)); ctx.stroke();
        ctx.fillStyle = VIZ.alfa(C.tinta2, u.i === hover ? 1 : 0.5);
        for (const [x, v] of [[xa, u.a], [xd, u.d]]) { ctx.beginPath(); ctx.arc(x, sy(v), u.i === hover ? 3.5 : 2.2, 0, Math.PI * 2); ctx.fill(); }
      });
      if (contra) {
        ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xa, sy(est.ma)); ctx.lineTo(xd, sy(est.ma + tend)); ctx.stroke(); ctx.restore();
        VIZ.marcador(ctx, xd, sy(est.ma + tend), C.apagado, 4);
      }
      VIZ.trazar(ctx, { sx: (x) => x, sy }, [[xa, est.ma], [xd, est.md]], C.s1, 4);
      VIZ.marcador(ctx, xa, sy(est.ma), C.s1, 6); VIZ.marcador(ctx, xd, sy(est.md), C.s1, 6);
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.s1; ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center'; ctx.fillText(VIZ.fmt(est.ma, 4), xa, sy(est.ma) - 9); ctx.fillText(VIZ.fmt(est.md, 4), xd, sy(est.md) - 9);
      const lim = 1.96 * est.ee, signif = Math.abs(est.m) > lim;
      registro.textContent = `Promedio antes ${VIZ.fmt(est.ma, 4)} min y después ${VIZ.fmt(est.md, 4)} min: Δ = ${sg(est.m)} min ± ${VIZ.fmt(lim, 2)} (95 %). ${signif ? 'La diferencia no es azar' : 'La diferencia podría ser azar'}, pero ${tend ? `incluye la tendencia general de ${sg(tend, 2)} min: el efecto del proyecto es solo ${sg(efecto, 2)} min.` : 'sin tendencia, el cambio observado sí estima el efecto.'}`;
      lectura.set([
        ['cambio observado Δ', `${sg(est.m)} min`], ['error estándar', `${VIZ.fmt(est.ee, 3)} min`],
        ['intervalo al 95 %', `${sg(est.m - lim, 3)} a ${sg(est.m + lim, 3)} min`],
        ['efecto real del proyecto', `${sg(efecto, 2)} min`], ['sesgo por tendencia', `${sg(est.m - efecto, 3)} min`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      let mejor = -1, md = 14;
      datos.forEach((u) => {
        const xa = geo.xa, xd = geo.xd, f = (x - xa) / (xd - xa);
        if (f < -0.1 || f > 1.1) return;
        const yl = geo.sy(u.a) + (geo.sy(u.d) - geo.sy(u.a)) * Math.min(1, Math.max(0, f));
        if (Math.abs(yl - y) < md) { md = Math.abs(yl - y); mejor = u.i; }
      });
      if (mejor !== hover) { hover = mejor; dibujar(); }
      if (mejor < 0) return tip.ocultar();
      const u = datos[mejor];
      tip.mostrar(x, y, `<b>Sucursal ${mejor + 1}</b><br>antes ${VIZ.fmt(u.a, 4)} min<br>después ${VIZ.fmt(u.d, 4)} min<br>cambio <b>${sg(u.d - u.a)} min</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: grupo de control y diferencia en diferencias ---------- */

  const NP = 24;
  function montarDiD(cuerpo) {
    let semilla = 1, efecto = -4, tend = -0.15, nivel = 4, dtend = 0, ruido = 0.8, t0 = 12, z = [], plano = null, hover = -1;
    const generar = () => { const rnd = VIZ.semilla(semilla * 53 + 1); z = Array.from({ length: 2 }, () => Array.from({ length: NP }, () => VIZ.normal(rnd))); };
    generar();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Efecto real del proyecto', min: -8, max: 0, paso: 0.5, valor: efecto, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { efecto = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tendencia común por mes', min: -0.4, max: 0.4, paso: 0.05, valor: tend, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { tend = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Diferencia de nivel inicial', min: -8, max: 8, paso: 1, valor: nivel, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { nivel = v; dibujar(); } });
    const rD = ctl.rango({ etiqueta: 'Tendencia extra del grupo con proyecto', min: -0.3, max: 0.3, paso: 0.05, valor: dtend, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { dtend = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido de los promedios', min: 0, max: 3, paso: 0.2, valor: ruido, formato: (v) => `${VIZ.fmt(v, 2)} min`, alCambiar: (v) => { ruido = v; dibujar(); } });
    const rT = ctl.rango({ etiqueta: 'Mes de implantación', min: 6, max: 18, valor: t0, formato: (v) => String(v), alCambiar: (v) => { t0 = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); dibujar(); }, { primario: true });
    ctl.boton('Tendencias paralelas', () => { dtend = 0; rD.valor = 0; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'sucursales con el proyecto', forma: 'linea' }, { color: C.s1, texto: 'sucursales de control', forma: 'linea' },
      { color: C.s2, texto: 'lo que habría pasado sin proyecto', forma: 'linea' }, { color: C.tinta, texto: 'implantación', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para mover la fecha de implantación. La brecha entre la línea naranja y su versión punteada es el efecto. Dé a «Tendencia extra» un valor distinto de cero y vea cómo la diferencia en diferencias deja de ser confiable.');

    const serie = () => {
      const T = [], K = [];
      for (let t = 0; t < NP; t++) {
        K.push(30 + tend * t + ruido * z[0][t]);
        T.push(30 + nivel + (tend + dtend) * t + (t >= t0 ? efecto : 0) + ruido * z[1][t]);
      }
      return { T, K };
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const { T, K } = serie();
      const mpre = (a) => media(a.slice(0, t0)), mpos = (a) => media(a.slice(t0));
      const gapPre = mpre(T) - mpre(K);
      const cf = K.map((v) => v + gapPre);
      const todos = [...T, ...K, ...cf], lo = Math.floor(Math.min(...todos) - 1), hi = Math.ceil(Math.max(...todos) + 1);
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: NP, ymin: lo, ymax: hi }, { etiquetaX: 'mes', etiquetaY: 'tiempo de atención (min)', formatoX: (v) => String(Math.round(v)), formatoY: (v) => String(Math.round(v)) });
      const { x0, x1, y0, y1 } = plano;
      ctx.fillStyle = C.neutro; ctx.fillRect(plano.sx(t0 + 0.5), y1, x1 - plano.sx(t0 + 0.5), y0 - y1);
      plano.ejes();
      VIZ.trazar(ctx, plano, K.map((v, t) => [t + 1, v]), C.s1, 2);
      VIZ.trazar(ctx, plano, T.map((v, t) => [t + 1, v]), C.s2, 2);
      VIZ.trazar(ctx, plano, cf.map((v, t) => [t + 1, v]).filter((p) => p[0] > t0), C.s2, 2, [4, 4]);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(plano.sx(t0 + 0.5), y1); ctx.lineTo(plano.sx(t0 + 0.5), y0); ctx.stroke();
      ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('implantación', plano.sx(t0 + 0.5) + 4, y1 + 3);
      if (hover >= 0) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plano.sx(hover + 1), y1); ctx.lineTo(plano.sx(hover + 1), y0); ctx.stroke();
        VIZ.marcador(ctx, plano.sx(hover + 1), plano.sy(T[hover]), C.s2, 4); VIZ.marcador(ctx, plano.sx(hover + 1), plano.sy(K[hover]), C.s1, 4);
      }
      const antesDespues = mpos(T) - mpre(T), corte = mpos(T) - mpos(K), did = (mpos(T) - mpre(T)) - (mpos(K) - mpre(K));
      registro.textContent = `Diferencia en diferencias = (${VIZ.fmt(mpos(T), 4)} − ${VIZ.fmt(mpre(T), 4)}) − (${VIZ.fmt(mpos(K), 4)} − ${VIZ.fmt(mpre(K), 4)}) = ${sg(did)} min. ${dtend ? 'Las tendencias no son paralelas: el supuesto se rompe y la estimación se sesga.' : 'Con tendencias paralelas, restar el cambio del grupo de control elimina la tendencia común y la diferencia de nivel.'}`;
      lectura.set([
        ['solo antes y después', `${sg(antesDespues)} min`], ['solo comparar grupos después', `${sg(corte)} min`],
        ['diferencia en diferencias', `${sg(did)} min`], ['efecto real', `${sg(efecto, 2)} min`],
        ['error de la diferencia en diferencias', `${sg(did - efecto)} min`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const k = Math.min(NP - 1, Math.max(0, Math.round(plano.ix(x)) - 1));
      if (k !== hover) { hover = k; dibujar(); }
      const { T, K } = serie();
      tip.mostrar(x, y, `mes <b>${k + 1}</b> ${k >= t0 ? '(con proyecto)' : '(antes)'}` + VIZ.filaTooltip(C.s2, 'con proyecto', VIZ.fmt(T[k], 4)) + VIZ.filaTooltip(C.s1, 'control', VIZ.fmt(K[k], 4)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      t0 = Math.min(18, Math.max(6, Math.round(plano.ix(x) - 0.5))); rT.valor = t0; dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 3: ¿efecto o azar? ---------- */

  const NS = 600, MAXN = 60, BINS = 31;
  function montarAzar(cuerpo) {
    let semilla = 1, efecto = -2, sigma = 4, n = 20, nula = [], alt = [], obs = 0, crit = 0, zNula = [], zAlt = [], zObs = [], hover = -1, geo = null, bins = [];
    const rnd0 = VIZ.semilla(4242);
    const bloque = () => Array.from({ length: NS }, () => Array.from({ length: 2 * MAXN }, () => VIZ.normal(rnd0)));
    zNula = bloque(); zAlt = bloque();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Efecto real del proyecto', min: -6, max: 0, paso: 0.5, valor: efecto, formato: (v) => `${sg(v, 2)} min`, alCambiar: (v) => { efecto = v; calcular(); } });
    ctl.rango({ etiqueta: 'Variabilidad del cambio por sucursal', min: 1, max: 8, paso: 0.5, valor: sigma, formato: (v) => `${v} min`, alCambiar: (v) => { sigma = v; calcular(); } });
    ctl.rango({ etiqueta: 'Sucursales por grupo', min: 5, max: MAXN, valor: n, formato: (v) => String(v), alCambiar: (v) => { n = v; calcular(); } });
    ctl.boton('Nuevo experimento', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.48, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'si el proyecto no hiciera nada (600 repeticiones)' }, { color: C.s2, texto: 'si el efecto fuera el real (600 repeticiones)' },
      { color: C.tinta, texto: 'su resultado', forma: 'linea' }, { color: C.apagado, texto: 'límites al 5 %', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Grises: diferencias en diferencias que saldrían por puro azar sin efecto. Naranjas: las que saldrían con el efecto real. Si su resultado cae dentro del gris, no se distingue del azar. Suba las sucursales o baje la variabilidad para ganar potencia.');

    const est = (zz, tau) => media(zz.slice(0, n).map((v) => sigma * v)) - media(zz.slice(n, 2 * n).map((v) => sigma * v)) + tau;
    function calcular() {
      nula = zNula.map((zz) => est(zz, 0)); alt = zAlt.map((zz) => est(zz, efecto));
      const rnd = VIZ.semilla(semilla * 29 + 3);
      zObs = Array.from({ length: 2 * MAXN }, () => VIZ.normal(rnd));
      obs = est(zObs, efecto);
      crit = cuantil(nula.map(Math.abs), 0.95);
      dibujar();
    }
    function dibujar() {
      if (!nula.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const se = sigma * Math.sqrt(2 / n), lim = Math.max(4 * se, Math.abs(efecto) + 3 * se, Math.abs(obs) * 1.1), w = (2 * lim) / BINS;
      const cuenta = (a) => { const c = Array(BINS).fill(0); a.forEach((v) => { const i = Math.floor((v + lim) / w); if (i >= 0 && i < BINS) c[i]++; }); return c; };
      const cn = cuenta(nula), ca = cuenta(alt);
      bins = { cn, ca, w, lim };
      const ymax = Math.max(...cn, ...ca) * 1.12;
      const plano = VIZ.plano(lienzo, { xmin: -lim, xmax: lim, ymin: 0, ymax }, { etiquetaX: 'diferencia en diferencias (min)', etiquetaY: 'repeticiones', formatoX: (v) => VIZ.fmt(v, 2), formatoY: (v) => String(Math.round(v)) });
      geo = plano;
      plano.ejes();
      for (let i = 0; i < BINS; i++) {
        const xa = plano.sx(-lim + i * w) + 0.5, wb = plano.sx(-lim + (i + 1) * w) - plano.sx(-lim + i * w) - 1;
        for (const [c, col, al] of [[cn[i], C.inactivo, 0.65], [ca[i], C.s2, 0.5]]) {
          if (!c) continue;
          ctx.fillStyle = VIZ.alfa(col, i === hover ? Math.min(1, al + 0.3) : al);
          ctx.beginPath(); ctx.roundRect(xa, plano.sy(c), wb, plano.y0 - plano.sy(c), [3, 3, 0, 0]); ctx.fill();
        }
      }
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      for (const x of [-crit, crit]) { ctx.beginPath(); ctx.moveTo(plano.sx(x), plano.y1); ctx.lineTo(plano.sx(x), plano.y0); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(plano.sx(obs), plano.y1 - 2); ctx.lineTo(plano.sx(obs), plano.y0); ctx.stroke();
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textBaseline = 'top'; ctx.textAlign = obs < 0 ? 'right' : 'left';
      ctx.fillText(`su resultado ${sg(obs, 3)}`, plano.sx(obs) + (obs < 0 ? -5 : 5), plano.y1 + 2);
      const p = nula.filter((v) => Math.abs(v) >= Math.abs(obs)).length / NS, potencia = alt.filter((v) => Math.abs(v) > crit).length / NS;
      registro.textContent = `Su resultado ${sg(obs, 3)} min: si el proyecto no hiciera nada, ${pc(p)} de las repeticiones darían un valor igual o más extremo (valor p). ${p < 0.05 ? 'Es menor que 5 %: el efecto se distingue del azar.' : 'No es menor que 5 %: con estos datos no se distingue del azar.'}`;
      lectura.set([
        ['resultado observado', `${sg(obs, 3)} min`], ['valor p', pc(p)],
        ['error estándar teórico', `${VIZ.fmt(se, 3)} min`], ['límite al 5 % (±)', `${VIZ.fmt(crit, 3)} min`],
        ['potencia del estudio', pc(potencia)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.dentro(x, y) || !bins.cn) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.floor((geo.ix(x) + bins.lim) / bins.w);
      if (i < 0 || i >= BINS) return tip.ocultar();
      if (i !== hover) { hover = i; dibujar(); }
      const a = -bins.lim + i * bins.w;
      tip.mostrar(x, y, `entre <b>${VIZ.fmt(a, 3)}</b> y <b>${VIZ.fmt(a + bins.w, 3)}</b> min` + VIZ.filaTooltip(C.inactivo, 'sin efecto', bins.cn[i]) + VIZ.filaTooltip(C.s2, 'con el efecto real', bins.ca[i]));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('project-impact-measurement', {
    intro: String.raw`
      <p>Después de implantar un proyecto de TI, por ejemplo un sistema de turnos en las sucursales, la pregunta es qué cambió <em>por causa del proyecto</em>. Comparar el indicador antes y después
      es el primer paso, pero mezcla el efecto del proyecto con todo lo demás que cambió en el mismo periodo: la estacionalidad, la economía, otras iniciativas.</p>
      <p>Para separar el efecto se usa una <strong>línea base</strong>, un <strong>grupo de control</strong> que no recibió el proyecto y la <strong>diferencia en diferencias</strong>. Luego se pregunta si
      lo medido supera lo que el azar produciría por sí solo. Esta es la base de decir, con honestidad, «el proyecto redujo el tiempo de atención en tantos minutos».</p>`,
    visualizaciones: [
      {
        titulo: 'Antes y después con una sola cohorte',
        descripcion: 'Cada línea es una sucursal. Con una tendencia general distinta de cero, el cambio observado no coincide con el efecto real; active la línea «sin proyecto» y compárelas. Suba el ruido y vea cuándo la mejora deja de ser significativa.',
        montar: montarAntesDespues,
      },
      {
        titulo: 'Grupo de control y diferencia en diferencias',
        descripcion: 'Con un grupo de control la tendencia común se resta. Mueva la implantación con un clic, cambie la diferencia de nivel y la tendencia común, y vea que la estimación sigue acertada; luego dé una tendencia extra al grupo con proyecto para romper el supuesto.',
        montar: montarDiD,
      },
      {
        titulo: '¿Efecto del proyecto o azar?',
        descripcion: 'Compare su resultado con lo que saldría por azar sin efecto (gris) y con el efecto real (naranja). Pruebe «Nuevo experimento» varias veces: con pocas sucursales el resultado cae a veces dentro del gris aunque el efecto exista.',
        montar: montarAzar,
      },
    ],
    teoria: String.raw`
      <h2>Definir la iniciativa y la línea base</h2>
      <p>Antes de implantar, defina qué indicador debe cambiar, en qué sentido y cuánto (la <em>hipótesis de impacto</em>), y mida durante varios periodos para conocer su nivel y su variabilidad normal: esa es la
      <strong>línea base</strong>. Sin ella, cualquier cifra posterior es una anécdota.</p>
      <h2>Antes y después</h2>
      <p>Para unidades \(i = 1,\dots,n\) con medición \(a_i\) antes y \(d_i\) después, el cambio medio y su error estándar son</p>
      \[ \bar{\Delta} = \frac{1}{n}\sum_i (d_i - a_i), \qquad \mathrm{EE} = \frac{s_\Delta}{\sqrt{n}}. \]
      <p>El cambio es significativo al 95 % si \(|\bar{\Delta}| &gt; 1{,}96\,\mathrm{EE}\). Pero \(\bar{\Delta}\) estima <em>efecto + tendencia</em>: con una tendencia general de −2 min y un efecto de −3 min, el análisis
      de antes y después atribuye −5 min al proyecto, un 67 % más que la verdad.</p>
      <h2>Diferencia en diferencias</h2>
      <p>Con un grupo de control \(K\) que no recibió el proyecto, y el grupo con proyecto \(T\):</p>
      \[ \widehat{\tau}_{\text{DiD}} = \big(\bar{y}_{T,\text{después}} - \bar{y}_{T,\text{antes}}\big) - \big(\bar{y}_{K,\text{después}} - \bar{y}_{K,\text{antes}}\big). \]
      <p>Resta la tendencia común y cancela las diferencias de nivel fijas entre grupos. Su supuesto es el de <em>tendencias paralelas</em>: sin el proyecto, ambos grupos habrían evolucionado igual. Se revisa
      mirando varios periodos previos: si las líneas ya divergían, la estimación está sesgada, y el sesgo es la diferencia de tendencias multiplicada por el tiempo transcurrido.</p>
      <h2>Efecto o azar</h2>
      <p>Si el cambio de cada sucursal varía con desviación \(\sigma\) y hay \(n\) por grupo, el estimador tiene error estándar</p>
      \[ \mathrm{EE}_{\text{DiD}} = \sigma\sqrt{\frac{2}{n}}. \]
      <p>Ejemplo: \(\sigma = 4\) y \(n = 20\) dan \(\mathrm{EE} \approx 1{,}26\) min y un límite al 5 % de \(1{,}96 \cdot 1{,}26 \approx 2{,}5\) min. Un efecto real de −2 min queda dentro del azar la mayor parte de las veces;
      la <strong>potencia</strong> (probabilidad de detectarlo) es \(\Phi(\tfrac{2}{1{,}26} - 1{,}96) \approx 35\ \%\). Para llegar a 80 % hacen falta unas 63 sucursales por grupo
      (\(n \approx 2(1{,}96 + 0{,}84)^2 \sigma^2/\tau^2\)).</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> Significativo no es lo mismo que importante: con muchas unidades, un efecto minúsculo puede ser significativo. Informe siempre la magnitud, el intervalo y
      el costo del proyecto. Y si los grupos no se asignaron al azar, piense en qué los hace distintos.</p></div>
      <h2>Conexiones</h2>
      <p>La decisión de invertir antes del proyecto se discute en <a href="tema.html?id=business-case">el caso de negocio</a> y <a href="tema.html?id=it-investment-decisions">las decisiones de inversión en TI</a>.
      La distinción entre correlación y causa se estudia en <a href="tema.html?id=correlation-causation">correlación y causalidad</a>; la comparación antes y después con minería de procesos, en
      <a href="tema.html?id=improvement-impact">oportunidades de mejora e impacto</a>. Los resultados se llevan a un <a href="tema.html?id=control-dashboards">tablero de control</a> y a la
      <a href="tema.html?id=adoption-success-evaluation">evaluación del éxito de la adopción</a>.</p>`,
  });
})();
