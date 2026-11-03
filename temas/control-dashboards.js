(function () {
  'use strict';
  const { color: C } = VIZ;

  const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const desv = (a) => { const m = media(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, a.length - 1)); };
  const recortar = (ctx, texto, max) => {
    if (ctx.measureText(texto).width <= max) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: tablero por nivel ---------- */

  // mej: +1 si más es mejor, −1 si menos es mejor; tol: fracción de tolerancia amarilla.
  const NIVELES = {
    direccion: { nombre: 'Dirección (estratégico)', periodo: 'mensual', kpis: [
      { n: 'Ingresos', u: 'M$', base: 100, tend: 0.8, amp: 6, ruido: 3, meta: 112, mej: 1 },
      { n: 'Margen operacional', u: '%', base: 18, tend: 0.05, amp: 1, ruido: 0.8, meta: 19.5, mej: 1 },
      { n: 'NPS', u: 'pts', base: 40, tend: 0.3, amp: 2, ruido: 2, meta: 46, mej: 1 },
      { n: 'Fuga de clientes', u: '%', base: 3.2, tend: -0.02, amp: 0.3, ruido: 0.3, meta: 2.8, mej: -1 },
      { n: 'Proyectos en plazo', u: '%', base: 72, tend: 0.4, amp: 3, ruido: 3, meta: 80, mej: 1 },
      { n: 'Disponibilidad', u: '%', base: 99.5, tend: 0.005, amp: 0.1, ruido: 0.12, meta: 99.8, mej: 1 },
    ] },
    gerencia: { nombre: 'Gerencia de TI (táctico)', periodo: 'mensual', kpis: [
      { n: 'Tickets resueltos en SLA', u: '%', base: 86, tend: 0.2, amp: 2, ruido: 2, meta: 92, mej: 1 },
      { n: 'Tiempo de resolución', u: 'h', base: 9, tend: -0.08, amp: 0.8, ruido: 0.7, meta: 7, mej: -1 },
      { n: 'Costo en la nube', u: 'M$', base: 40, tend: 0.6, amp: 1.5, ruido: 1.5, meta: 48, mej: -1 },
      { n: 'Cambios sin incidente', u: '%', base: 91, tend: 0.1, amp: 1, ruido: 1.5, meta: 95, mej: 1 },
      { n: 'Incidentes críticos', u: 'N.º', base: 6, tend: -0.05, amp: 1, ruido: 1.2, meta: 4, mej: -1 },
      { n: 'Proyectos con presupuesto', u: '%', base: 78, tend: 0.3, amp: 2, ruido: 2.5, meta: 85, mej: 1 },
    ] },
    operacion: { nombre: 'Mesa de ayuda (operativo)', periodo: 'semanal', kpis: [
      { n: 'Tickets abiertos', u: 'N.º', base: 120, tend: 1.2, amp: 10, ruido: 8, meta: 110, mej: -1 },
      { n: 'Primera respuesta', u: 'min', base: 28, tend: -0.2, amp: 3, ruido: 3, meta: 20, mej: -1 },
      { n: 'Resueltos por agente al día', u: 'N.º', base: 14, tend: 0.05, amp: 1, ruido: 1.2, meta: 16, mej: 1 },
      { n: 'Reaperturas', u: '%', base: 8, tend: -0.05, amp: 0.8, ruido: 1, meta: 6, mej: -1 },
      { n: 'Satisfacción (CSAT)', u: '%', base: 83, tend: 0.15, amp: 1.5, ruido: 2, meta: 88, mej: 1 },
      { n: 'Cola en espera', u: 'N.º', base: 22, tend: 0.3, amp: 4, ruido: 4, meta: 15, mej: -1 },
    ] },
  };
  const NP = 24;

  function montarTablero(cuerpo) {
    let semilla = 1, nivel = 'direccion', corte = 24, cuantos = 6, series = [], sel = 0, hover = null, tiles = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Nivel de la audiencia', opciones: Object.entries(NIVELES).map(([k, v]) => [k, v.nombre]), valor: nivel, alCambiar: (v) => { nivel = v; sel = 0; generar(); lienzo.ajustar(true); } });
    ctl.rango({ etiqueta: 'Indicadores en el tablero', min: 3, max: 6, valor: cuantos, formato: (v) => String(v), alCambiar: (v) => { cuantos = v; if (sel >= v) sel = 0; lienzo.ajustar(true); } });
    ctl.rango({ etiqueta: 'Periodo del corte', min: 12, max: NP, valor: corte, formato: (v) => `${v} de ${NP}`, alCambiar: (v) => { corte = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const columnas = (w) => (w < 560 ? 2 : 3);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.ceil(cuantos / columnas(w)) * 132 + 6 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'cumple la meta', forma: 'punto' }, { color: C.s4, texto: 'dentro de 5 % de la meta', forma: 'punto' }, { color: C.s8, texto: 'fuera de tolerancia', forma: 'punto' },
      { color: C.tinta, texto: 'meta', forma: 'linea' }, { color: C.s1, texto: 'indicador (24 periodos)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie el nivel: la dirección ve resultados mensuales; la mesa de ayuda, indicadores semanales de operación. Mueva el corte para ver el tablero en un periodo anterior; haga clic en un cuadro para su detalle; pase el cursor sobre la línea para ver cada periodo.');

    function generar() {
      const rnd = VIZ.semilla(semilla * 37 + Object.keys(NIVELES).indexOf(nivel) * 1000 + 11);
      series = NIVELES[nivel].kpis.map((k) => Array.from({ length: NP }, (_, t) => Math.max(0, k.base + k.tend * t + k.amp * Math.sin((2 * Math.PI * t) / 12) + k.ruido * VIZ.normal(rnd))));
      dibujar();
    }
    const estado = (k, v) => {
      const r = k.mej > 0 ? v / k.meta : k.meta / Math.max(v, 1e-9);
      return r >= 1 ? 0 : r >= 0.95 ? 1 : 2;
    };
    const COL = [C.s6, C.s4, C.s8], NOM = ['cumple la meta', 'cerca de la meta', 'fuera de tolerancia'];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const kp = NIVELES[nivel].kpis.slice(0, cuantos), cols = columnas(W), g = 8, tw = (W - g * (cols - 1)) / cols, th = 124;
      tiles = [];
      kp.forEach((k, i) => {
        const x = (i % cols) * (tw + g), y = Math.floor(i / cols) * (th + 8) + 2, s = series[i], v = s[corte - 1], e = estado(k, v);
        const prev = corte > 1 ? s[corte - 2] : v, dv = prev ? (v - prev) / prev : 0, mejora = dv * k.mej >= 0;
        tiles.push({ x, y, w: tw, h: th, i });
        ctx.fillStyle = C.superficie; ctx.fillRect(x, y, tw, th);
        ctx.strokeStyle = i === sel ? C.s1 : C.rejilla; ctx.lineWidth = i === sel ? 3 : 1.5; ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
        ctx.fillStyle = COL[e]; ctx.fillRect(x, y, 5, th);
        ctx.font = VIZ.fuente(10.5, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(recortar(ctx, k.n, tw - 20), x + 12, y + 8);
        ctx.font = VIZ.fuente(20, 600); ctx.fillStyle = C.tinta;
        const txt = VIZ.fmt(v, 3);
        ctx.fillText(txt, x + 12, y + 24);
        const wTxt = ctx.measureText(txt).width;
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado;
        ctx.fillText(k.u, x + 16 + wTxt, y + 36);
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = mejora ? C.s6 : C.s8; ctx.textAlign = 'right';
        ctx.fillText(`${dv >= 0 ? '▲' : '▼'} ${VIZ.fmt(Math.abs(dv) * 100, 2)} %`, x + tw - 8, y + 10);
        ctx.fillStyle = C.apagado; ctx.fillText(`meta ${VIZ.fmt(k.meta, 3)}`, x + tw - 8, y + 24);
        // Sparkline
        const sx0 = x + 12, sx1 = x + tw - 10, sy0 = y + th - 10, sy1 = y + 58;
        const vis = s.slice(0, corte), lo = Math.min(...s, k.meta), hi = Math.max(...s, k.meta), pad = (hi - lo || 1) * 0.1;
        const px = (t) => sx0 + (t / (NP - 1)) * (sx1 - sx0), py = (val) => sy0 - ((val - (lo - pad)) / (hi - lo + 2 * pad)) * (sy0 - sy1);
        ctx.fillStyle = C.neutro; ctx.fillRect(px(corte - 1), sy1 - 4, sx1 - px(corte - 1) + 4, sy0 - sy1 + 8);
        ctx.setLineDash([3, 3]); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx0, py(k.meta)); ctx.lineTo(sx1, py(k.meta)); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
        vis.forEach((val, t) => (t ? ctx.lineTo(px(t), py(val)) : ctx.moveTo(px(t), py(val)))); ctx.stroke();
        VIZ.marcador(ctx, px(corte - 1), py(v), COL[e], 4);
        if (hover && hover.i === i) {
          const t = hover.t;
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px(t), sy1 - 4); ctx.lineTo(px(t), sy0 + 4); ctx.stroke();
          VIZ.marcador(ctx, px(t), py(s[t]), C.s1, 4);
        }
        tiles[i].px = px; tiles[i].sy1 = sy1 - 4;
      });
      const k = NIVELES[nivel].kpis[sel], s = series[sel], v = s[corte - 1], e = estado(k, v);
      const pasados = s.slice(Math.max(0, corte - 3), corte), rezago = s.slice(Math.max(0, corte - 6), Math.max(1, corte - 3));
      const tendencia = media(pasados) - media(rezago);
      registro.textContent = `${k.n}: ${VIZ.fmt(v, 4)} ${k.u} en el periodo ${corte}, ${NOM[e]} (meta ${VIZ.fmt(k.meta, 3)}, ${k.mej > 0 ? 'más es mejor' : 'menos es mejor'}). Promedio de los últimos 3 periodos frente a los 3 anteriores: ${tendencia >= 0 ? '+' : '−'}${VIZ.fmt(Math.abs(tendencia), 3)} ${k.u}, tendencia ${tendencia * k.mej >= 0 ? 'favorable' : 'desfavorable'}.`;
      const est = NIVELES[nivel].kpis.slice(0, cuantos).map((kk, i) => estado(kk, series[i][corte - 1]));
      lectura.set([
        ['audiencia', NIVELES[nivel].nombre], ['frecuencia', NIVELES[nivel].periodo],
        ['en verde', `${est.filter((x) => x === 0).length} de ${cuantos}`], ['en amarillo', String(est.filter((x) => x === 1).length)], ['en rojo', String(est.filter((x) => x === 2).length)],
      ]);
    }
    const buscar = (x, y) => tiles.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    lienzo.alDibujar = () => series.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = buscar(x, y);
      if (!r) { if (hover) { hover = null; dibujar(); } return tip.ocultar(); }
      const k = NIVELES[nivel].kpis[r.i];
      if (y >= r.sy1) {
        const t = Math.min(NP - 1, Math.max(0, Math.round(((x - r.px(0)) / (r.px(NP - 1) - r.px(0))) * (NP - 1))));
        hover = { i: r.i, t }; dibujar();
        tip.mostrar(x, y, `<b>${k.n}</b><br>periodo <b>${t + 1}</b>: ${VIZ.fmt(series[r.i][t], 4)} ${k.u}` + VIZ.filaTooltip(COL[estado(k, series[r.i][t])], NOM[estado(k, series[r.i][t])], null) + (t >= corte ? '<br>(posterior al corte)' : ''));
      } else {
        if (hover) { hover = null; dibujar(); }
        tip.mostrar(x, y, `<b>${k.n}</b><br>meta ${VIZ.fmt(k.meta, 3)} ${k.u}<br>${k.mej > 0 ? 'más es mejor' : 'menos es mejor'}`);
      }
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const r = buscar(x, y); if (r) { sel = r.i; dibujar(); } });
    generar();
  }

  /* ---------- Fig. 2: reglas de intervención ---------- */

  const NT = 48, BASE = 20, BASE_MEDIA = 100, SIGMA = 2;
  const REGLAS = [
    { id: 'r1', n: 'Un punto fuera de ±3σ', c: () => C.s8, forma: 0 },
    { id: 'r2', n: 'N periodos seguidos a la baja', c: () => C.s2, forma: 2 },
    { id: 'r3', n: '7 periodos del mismo lado de la media', c: () => C.s7, forma: 1 },
    { id: 'r4', n: '2 de 3 puntos bajo −2σ', c: () => C.s4, forma: 3 },
  ];

  function montarReglas(cuerpo) {
    let semilla = 1, deriva = 0.25, inicio = 30, nTend = 5, t = BASE - 1, z = [], activas = [true, true, true, true], hover = -1, plano = null;
    const generar = () => { const rnd = VIZ.semilla(semilla * 61 + 9); z = Array.from({ length: NT }, () => VIZ.normal(rnd)); };
    generar();
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Deriva por periodo', min: 0, max: 1, paso: 0.05, valor: deriva, formato: (v) => `−${v} σ`, alCambiar: (v) => { deriva = v; dibujar(); } });
    ctl.rango({ etiqueta: 'La deriva empieza en el periodo', min: 22, max: 40, valor: inicio, formato: (v) => String(v), alCambiar: (v) => { inicio = v; dibujar(); } });
    ctl.rango({ etiqueta: 'N de la regla de tendencia', min: 3, max: 8, valor: nTend, formato: (v) => String(v), alCambiar: (v) => { nTend = v; dibujar(); } });
    ctl.casillas(REGLAS.map((r, i) => ({ clave: i, texto: r.n, color: r.c(), activo: true })), (e) => { activas = REGLAS.map((_, i) => e[i]); dibujar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...REGLAS.map((r) => ({ color: r.c(), texto: r.n })),
      { color: C.tinta, texto: 'media de la línea base', forma: 'linea' }, { color: C.apagado, texto: '±2σ y ±3σ', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca el tiempo periodo a periodo. Los primeros 20 periodos fijan la línea base; luego el indicador se desliza hacia abajo. Active una regla a la vez para comparar cuál avisa primero y cuál da avisos falsos antes de la deriva.');

    function iniciar() {
      t = BASE - 1;
      return (function* () { for (let k = BASE; k < NT; k++) { t = k; yield; } })();
    }
    const v = (k) => BASE_MEDIA + SIGMA * z[k] - deriva * SIGMA * Math.max(0, k + 1 - inicio);
    const vals = () => Array.from({ length: NT }, (_, k) => v(k));
    function evaluar() {
      const x = vals(), b = x.slice(0, BASE), mu = media(b), sd = desv(b);
      const al = REGLAS.map(() => Array(NT).fill(false));
      for (let k = BASE; k <= t; k++) {
        al[0][k] = Math.abs(x[k] - mu) > 3 * sd;
        let seg = true; for (let j = 0; j < nTend; j++) if (!(x[k - j] < x[k - j - 1])) seg = false;
        al[1][k] = seg;
        let lado = k >= 6; for (let j = 0; j < 7 && lado; j++) if (!(Math.sign(x[k - j] - mu) === Math.sign(x[k] - mu) && x[k] !== mu)) lado = false;
        al[2][k] = lado;
        al[3][k] = [0, 1, 2].filter((j) => x[k - j] < mu - 2 * sd).length >= 2 && x[k] < mu - 2 * sd;
      }
      return { x, mu, sd, al };
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const { x, mu, sd, al } = evaluar();
      const lo = 100 - 3 * SIGMA - 16, hi = 100 + 3 * SIGMA + 5;
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: NT, ymin: lo, ymax: hi }, { etiquetaX: 'periodo', etiquetaY: 'valor del indicador', formatoX: (q) => String(Math.round(q)), formatoY: (q) => String(Math.round(q)) });
      const { x0, x1, y0, y1 } = plano;
      ctx.fillStyle = C.neutro; ctx.fillRect(x0, y1, plano.sx(BASE) - x0, y0 - y1);
      plano.ejes();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('línea base', x0 + 4, y1 + 3);
      ctx.save();
      ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.beginPath(); ctx.moveTo(x0, plano.sy(mu)); ctx.lineTo(x1, plano.sy(mu)); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = C.apagado;
      for (const m of [2, 3]) for (const sg of [-1, 1]) { ctx.setLineDash(m === 3 ? [4, 4] : [1, 4]); ctx.beginPath(); ctx.moveTo(x0, plano.sy(mu + sg * m * sd)); ctx.lineTo(x1, plano.sy(mu + sg * m * sd)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('+3σ', x1 - 2, plano.sy(mu + 3 * sd) - 1); ctx.fillText('−3σ', x1 - 2, plano.sy(mu - 3 * sd) - 1);
      ctx.restore();
      VIZ.trazar(ctx, plano, x.slice(0, t + 1).map((val, k) => [k + 1, val]), C.s1, 1.8);
      x.slice(0, t + 1).forEach((val, k) => VIZ.marcador(ctx, plano.sx(k + 1), plano.sy(val), C.s1, k === hover ? 4.5 : 2.8));
      // Alertas: anillos concéntricos por regla
      const primera = REGLAS.map((_, r) => (activas[r] ? al[r].findIndex(Boolean) : -1));
      REGLAS.forEach((r, ri) => {
        if (!activas[ri]) return;
        al[ri].forEach((a, k) => {
          if (!a) return;
          ctx.strokeStyle = r.c(); ctx.lineWidth = 2; ctx.beginPath(); VIZ.forma(ctx, plano.sx(k + 1), plano.sy(x[k]), 6 + ri * 2.5, r.forma); ctx.stroke();
        });
      });
      const conAlerta = primera.filter((k) => k >= 0);
      const intervenir = conAlerta.length ? Math.min(...conAlerta) : -1;
      if (intervenir >= 0) {
        ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(plano.sx(intervenir + 1), y1); ctx.lineTo(plano.sx(intervenir + 1), y0); ctx.stroke(); ctx.restore();
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textBaseline = 'top'; ctx.textAlign = intervenir > NT * 0.6 ? 'right' : 'left';
        ctx.fillText('intervenir', plano.sx(intervenir + 1) + (intervenir > NT * 0.6 ? -4 : 4), y1 + 16);
      }
      const falsa = (r) => primera[r] >= 0 && primera[r] + 1 <= inicio;
      registro.textContent = t < BASE
        ? `Línea base: periodos 1 a ${BASE}, con media ${VIZ.fmt(mu, 4)} y σ = ${VIZ.fmt(sd, 3)}. Pulse «Reproducir» para ver pasar el tiempo.`
        : `Periodo ${t + 1}: valor ${VIZ.fmt(x[t], 4)}. ${intervenir < 0 ? 'Ninguna regla activa ha dado alerta.' : `Primera alerta en el periodo ${intervenir + 1}${intervenir + 1 <= inicio ? ', antes de que empiece la deriva: falsa alarma' : ` (${intervenir + 1 - inicio} periodo${intervenir + 1 - inicio > 1 ? 's' : ''} después de que empezó la deriva)`}.`}`;
      lectura.set([
        ['media y σ de la línea base', `${VIZ.fmt(mu, 4)} y ${VIZ.fmt(sd, 3)}`],
        ...REGLAS.map((r, i) => [r.n.replace('N periodos', `${nTend} periodos`), !activas[i] ? 'desactivada' : primera[i] < 0 ? 'sin alerta' : `periodo ${primera[i] + 1}${falsa(i) ? ' (falsa)' : ''}`]),
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const k = Math.min(t, Math.max(0, Math.round(plano.ix(x)) - 1));
      if (k !== hover) { hover = k; dibujar(); }
      const { x: xs, mu, sd, al } = evaluar();
      const reglas = REGLAS.filter((_, i) => al[i][k] && activas[i]).map((r) => VIZ.filaTooltip(r.c(), r.n.replace('N periodos', `${nTend} periodos`), null)).join('');
      tip.mostrar(x, y, `periodo <b>${k + 1}</b><br>valor <b>${VIZ.fmt(xs[k], 4)}</b><br>(${VIZ.fmt((xs[k] - mu) / sd, 2)} σ de la media)${reglas}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('control-dashboards', {
    intro: String.raw`
      <p>Un <strong>tablero de control</strong> reúne pocos indicadores, con su meta, su estado y su tendencia, para que quien gestiona decida rápido si debe intervenir.
      No es un reporte exhaustivo: cada nivel de la organización necesita un tablero distinto. La dirección mira resultados mensuales; una mesa de ayuda, la cola de hoy.</p>
      <p>Un buen tablero también dice <em>cuándo</em> actuar. Un valor en rojo puede ser ruido; una tendencia sostenida, aunque aún esté en verde, puede ser la señal. Las reglas de intervención
      convierten el seguimiento del tiempo en decisiones: cuántos periodos de caída son demasiados, o cuándo un punto está fuera de lo esperable.</p>`,
    visualizaciones: [
      {
        titulo: 'Tablero por nivel de la organización',
        descripcion: 'Cambie el nivel de la audiencia y la cantidad de indicadores; mueva el periodo del corte y vea cómo cambian colores y variaciones. Pase el cursor sobre una línea para ver cada periodo.',
        montar: montarTablero,
      },
      {
        titulo: 'Cuándo intervenir: reglas sobre la tendencia',
        descripcion: 'Reproduzca el tiempo con una deriva suave y compare cuál regla avisa primero. Suba la deriva para detectar antes; baje N y verá alertas falsas antes de que empiece la deriva.',
        montar: montarReglas,
      },
    ],
    teoria: String.raw`
      <h2>Qué debe tener un tablero</h2>
      <ul>
        <li><strong>Pocos indicadores</strong> (de 5 a 9 por pantalla): cada uno ligado a un objetivo y con un responsable.</li>
        <li><strong>Meta y estado</strong> visibles: color por <a href="tema.html?id=targets-thresholds">umbrales</a>, nunca solo el número.</li>
        <li><strong>Contexto temporal</strong>: variación frente al periodo anterior y una línea de tendencia pequeña.</li>
        <li><strong>Nivel adecuado</strong>: estratégico (mensual o trimestral, pocos indicadores de resultado), táctico (mensual, indicadores de proceso) y operativo (diario o semanal, para actuar ya).</li>
      </ul>
      <p>La variación porcentual de un indicador \(x\) entre dos periodos es</p>
      \[ \Delta\% = \frac{x_t - x_{t-1}}{x_{t-1}}, \]
      <p>y se interpreta según el sentido del indicador: subir es bueno para ingresos y malo para fuga de clientes. Ejemplo: si los ingresos pasan de 100 a 106 millones, \(\Delta\% = +6\ \%\), favorable; si la fuga pasa de 3,0 % a 3,3 %, \(\Delta\% = +10\ \%\), desfavorable.</p>
      <h2>Reglas de intervención</h2>
      <p>Con una línea base de media \(\mu\) y desviación \(\sigma\) (estimadas en un periodo estable), el comportamiento esperado de un indicador estable queda dentro de \(\mu \pm 3\sigma\). Reglas habituales:</p>
      <table>
        <tr><th>Regla</th><th>Condición</th><th>Falsa alarma por periodo (datos estables)</th></tr>
        <tr><td>Fuera de control</td><td>\(|x_t - \mu| &gt; 3\sigma\)</td><td>≈ 0,27 %</td></tr>
        <tr><td>Tendencia</td><td>N descensos seguidos</td><td>≈ \(1/(N+1)!\) (con N = 5: ≈ 0,14 %)</td></tr>
        <tr><td>Racha</td><td>7 periodos del mismo lado</td><td>≈ \(2\cdot(1/2)^7 \approx 1{,}6\ \%\)</td></tr>
        <tr><td>Dos de tres</td><td>2 de 3 puntos bajo \(\mu - 2\sigma\)</td><td>≈ 0,10 %</td></tr>
      </table>
      <p>Una deriva lenta pasa inadvertida para la regla de ±3σ: un indicador que baja 0,25σ por periodo recorre 3σ en unos 12 periodos. Las reglas de tendencia y de racha avisan antes, a costa de
      más falsas alarmas. Usar varias reglas combina sensibilidad y robustez.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> Un tablero con demasiados rojos genera fatiga de alertas: la gente deja de mirarlos. Ajuste umbrales con la variabilidad real del indicador.</p></div>
      <h2>Conexiones</h2>
      <p>Qué indicadores incluir sale de la <a href="tema.html?id=strategy-aligned-indicators">alineación con la estrategia</a>; sus metas, de <a href="tema.html?id=targets-thresholds">metas y umbrales</a>.
      Cuando el tablero alerta, el análisis posterior de qué cambió se apoya en la <a href="tema.html?id=project-impact-measurement">medición del impacto</a> de proyectos y decisiones, y los modelos
      de visualización en <a href="tema.html?id=dashboards-reports">tableros e informes de gestión</a>.</p>`,
  });
})();
