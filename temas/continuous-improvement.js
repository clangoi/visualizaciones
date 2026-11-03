(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Proceso de ejemplo: pago de reclamos de seguro ---------- */

  // w: minutos de trabajo; e: minutos de espera antes de la actividad; tipo: va (agrega valor), nec (necesaria sin valor), des (desperdicio).
  const PASOS = [
    { n: 'Recibir reclamo', w: 10, e: 0, tipo: 'va' },
    { n: 'Digitar datos', w: 20, e: 120, tipo: 'nec' },
    { n: 'Verificar póliza', w: 15, e: 180, tipo: 'nec' },
    { n: 'Evaluar daño', w: 45, e: 240, tipo: 'va' },
    { n: 'Revisión duplicada', w: 20, e: 300, tipo: 'des' },
    { n: 'Pagar al cliente', w: 10, e: 120, tipo: 'va' },
  ];
  const P0 = 0.15; // fracción de casos que vuelve de «Evaluar daño» a «Verificar póliza»
  const BASE = { dup: true, eF: 1, capt: false, wF: 1, p: P0 };
  const COLOR_TIPO = { va: C.s1, nec: C.s4, des: C.s8 };
  const NOMBRE_TIPO = { va: 'agrega valor', nec: 'necesaria, sin valor para el cliente', des: 'desperdicio' };

  // Modelo del proceso con palancas: dup (mantiene la revisión duplicada), eF y wF (factores de espera y de trabajo),
  // capt (captura única de datos), p (probabilidad de reproceso).
  function modelo(c) {
    const pasos = PASOS.filter((s, i) => c.dup || i !== 4).map((s) => ({ ...s, w: s.w * c.wF * (c.capt && s.n === 'Digitar datos' ? 0.25 : 1), e: s.e * c.eF }));
    const R = pasos.filter((s) => s.n === 'Verificar póliza' || s.n === 'Evaluar daño').reduce((a, s) => a + s.w + s.e, 0);
    const rehacer = (c.p / (1 - c.p)) * R;
    const base = pasos.reduce((a, s) => a + s.w + s.e, 0);
    const va = pasos.filter((s) => s.tipo === 'va').reduce((a, s) => a + s.w, 0);
    return { pasos, rehacer, lead: base + rehacer, va, trabajo: pasos.reduce((a, s) => a + s.w, 0), p: c.p, espera: pasos.reduce((a, s) => a + s.e, 0) };
  }
  const h = (min) => `${VIZ.fmt(min / 60, 3)} h`;
  const L0 = modelo(BASE).lead;

  /* ---------- Fig. 1: Lean y el flujo de valor ---------- */

  function montarLean(cuerpo) {
    let red = 60, dup = true, capt = false, est = false, hover = null, rects = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Reducción de esperas (flujo continuo)', min: 0, max: 80, paso: 5, valor: red, formato: (v) => `${v} %`, alCambiar: (v) => { red = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Eliminar la revisión duplicada', valor: false, alCambiar: (v) => { dup = !v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Captura única de datos', valor: false, alCambiar: (v) => { capt = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Trabajo estándar (reproceso 7 %)', valor: false, alCambiar: (v) => { est = v; dibujar(); } });
    ctl.boton('Aplicar todo', () => { dup = false; capt = true; est = true; red = 60; cuerpo.querySelectorAll('.campo input[type="checkbox"]').forEach((i) => { i.checked = true; }); const r = cuerpo.querySelector('input[type="range"]'); r.value = 60; r.dispatchEvent(new Event('input')); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'trabajo que agrega valor' }, { color: C.s4, texto: 'necesario, sin valor para el cliente' },
      { color: C.s8, texto: 'desperdicio (redundancia y reproceso)' }, { color: C.tenue, texto: 'espera' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es un caso: espera (gris) y trabajo (color) por actividad, más el reproceso esperado al final. Observe lo poco que miden los tramos que agregan valor. Active las palancas de Lean y compare con «Hoy»; pase el cursor sobre un tramo.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const hoy = modelo(BASE), mej = modelo({ ...BASE, dup, eF: 1 - red / 100, capt, p: est ? 0.07 : P0 });
      const xmax = Math.max(4, Math.ceil(hoy.lead / 60 / 2) * 2);
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: 2 }, { etiquetaX: 'horas desde que llega el reclamo', ticksY: [], margen: { izq: W < 560 ? 62 : 74, sup: 8 } });
      pl.ejes();
      rects = [];
      [['Hoy', hoy], ['Con Lean', mej]].forEach(([nombre, m], i) => {
        const yc = pl.sy(1.5 - i);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(nombre, 4, yc);
        let t = 0;
        const seg = (dur, color, info) => {
          if (dur <= 0) return;
          const x = pl.sx(t / 60), w = pl.sx((t + dur) / 60) - x;
          const r = { x, y: yc - 17, w, h: 34, info };
          ctx.fillStyle = info === hover ? VIZ.alfa(color, 0.7) : color;
          ctx.fillRect(x, r.y, Math.max(w - (w > 3 ? 1 : 0), 0.8), 34);
          rects.push(r); t += dur;
        };
        m.pasos.forEach((s) => {
          seg(s.e, C.tenue, { t: 'Espera antes de «' + s.n + '»', d: s.e, c: C.tenue });
          seg(s.w, COLOR_TIPO[s.tipo], { t: s.n, d: s.w, c: COLOR_TIPO[s.tipo], tipo: s.tipo });
        });
        seg(m.rehacer, C.s8, { t: 'Reproceso esperado (' + Math.round(m.p * 100) + ' % de los casos)', d: m.rehacer, c: C.s8, tipo: 'des' });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(h(m.lead), Math.min(pl.sx(m.lead / 60) + 5, W - 46), yc - 24 < pl.y1 ? yc : yc);
      });
      const pce = (m) => (m.va / m.lead) * 100;
      registro.textContent = `Hoy un reclamo tarda ${h(hoy.lead)} y solo ${VIZ.fmt(hoy.va)} min son trabajo que agrega valor: eficiencia del flujo de ${VIZ.fmt(pce(hoy), 3)} %. ` +
        (mej.lead < hoy.lead - 0.01 ? `Con las palancas elegidas baja a ${h(mej.lead)} (${VIZ.fmt((1 - mej.lead / hoy.lead) * 100, 3)} % menos) y la eficiencia sube a ${VIZ.fmt(pce(mej), 3)} %.` : 'Active una palanca para ver el efecto.');
      lectura.set([
        ['tiempo de ciclo (hoy → mejorado)', `${h(hoy.lead)} → ${h(mej.lead)}`],
        ['trabajo que agrega valor', `${VIZ.fmt(hoy.va)} min (sin cambio)`],
        ['eficiencia del flujo', `${VIZ.fmt(pce(hoy), 3)} % → ${VIZ.fmt(pce(mej), 3)} %`],
        ['espera dentro del ciclo', `${VIZ.fmt((hoy.espera / hoy.lead) * 100, 3)} % → ${VIZ.fmt((mej.espera / mej.lead) * 100, 3)} %`],
        ['reproceso esperado', `${VIZ.fmt(hoy.rehacer, 3)} → ${VIZ.fmt(mej.rehacer, 3)} min por caso`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = rects.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      const hv = r ? r.info : null;
      if (hv !== hover) { hover = hv; dibujar(); }
      if (!r) return tip.ocultar();
      tip.mostrar(x, y, `<b>${r.info.t}</b><br>duración <b>${P.dur(r.info.d)}</b>` + (r.info.tipo ? VIZ.filaTooltip(r.info.c, NOMBRE_TIPO[r.info.tipo], null) : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: Six Sigma y la variabilidad ---------- */

  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const LSL = 12, USL = 36, OBJ = 24; // horas de respuesta al cliente: límites de especificación y objetivo
  const FASES = ['Definir', 'Medir', 'Analizar', 'Mejorar', 'Controlar'];

  function montarSigma(cuerpo) {
    const MU0 = 28, SD0 = 4;
    let mu = MU0, sd = SD0, largo = false, semilla = 1, fase = -1, zs = [], bins = [], hover = -1, pl = null;
    let mensaje = `La promesa al cliente es responder entre ${LSL} y ${USL} h. Avance por las fases de DMAIC o mueva la media y la variabilidad.`;
    const N = 300, BW = 2;
    const ctl = VIZ.controles(cuerpo);
    const rMu = ctl.rango({ etiqueta: 'Media del tiempo de respuesta', min: 14, max: 34, paso: 0.5, valor: mu, formato: (v) => `${v} h`, alCambiar: (v) => { mu = v; dibujar(); } });
    const rSd = ctl.rango({ etiqueta: 'Variabilidad (desviación estándar σ)', min: 1, max: 8, paso: 0.25, valor: sd, formato: (v) => `${v} h`, alCambiar: (v) => { sd = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Desplazamiento de largo plazo de 1,5σ', valor: largo, alCambiar: (v) => { largo = v; dibujar(); } });
    ctl.boton('Avanzar fase DMAIC', avanzar, { primario: true });
    ctl.boton('Nueva muestra', () => { semilla++; muestra(); dibujar(); });
    ctl.boton('Valores iniciales', () => { mu = MU0; sd = SD0; fase = -1; rMu.valor = mu; rSd.valor = sd; mensaje = 'Valores iniciales restablecidos.'; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'casos dentro de la especificación' }, { color: C.s8, texto: 'defectos: fuera de los límites' },
      { color: C.tinta2, texto: 'curva normal esperada', forma: 'linea' }, { color: C.tinta, texto: 'límites de especificación', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra cuenta casos de una muestra simulada de 300. Reduzca σ o centre la media y vea desaparecer los defectos; active el desplazamiento de largo plazo para pasar de la tabla a la práctica. «Avanzar fase DMAIC» aplica una mejora por etapa.');

    function muestra() {
      const rnd = VIZ.semilla(semilla * 313 + 5);
      zs = Array.from({ length: N }, () => VIZ.normal(rnd));
    }
    const muEf = () => (largo ? (mu >= OBJ ? mu + 1.5 * sd : mu - 1.5 * sd) : mu);
    function avanzar() {
      fase = (fase + 1) % FASES.length;
      const m = muEf();
      if (fase === 0) { mu = MU0; sd = SD0; rMu.valor = mu; rSd.valor = sd; mensaje = `Definir: la característica crítica para el cliente es el tiempo de respuesta, entre ${LSL} y ${USL} h; el objetivo es ${OBJ} h.`; }
      else if (fase === 1) { const v = zs.map((z) => m + sd * z); mensaje = `Medir: en 300 casos la media es ${VIZ.fmt(P.media(v), 3)} h y la desviación ${VIZ.fmt(Math.sqrt(v.reduce((a, x) => a + (x - P.media(v)) ** 2, 0) / (N - 1)), 3)} h; ${v.filter((x) => x < LSL || x > USL).length} casos incumplen.`; }
      else if (fase === 2) { const desc = Math.abs(m - OBJ), cpk = Math.min(USL - m, m - LSL) / (3 * sd), cp = (USL - LSL) / (6 * sd); mensaje = `Analizar: Cp = ${VIZ.fmt(cp, 3)} y Cpk = ${VIZ.fmt(cpk, 3)}. ` + (cp - cpk > 0.25 ? `El proceso está descentrado ${VIZ.fmt(desc, 2)} h del objetivo: centrarlo es lo más barato.` : 'La media está bien; el problema es la variabilidad.'); }
      else if (fase === 3) { sd = Math.max(1, Math.round(sd * 0.5 * 4) / 4); rSd.valor = sd; mensaje = `Mejorar: se estandariza el trabajo y σ baja a ${VIZ.fmt(sd)} h.`; }
      else { mu = OBJ; rMu.valor = mu; mensaje = `Controlar: se centra la media en ${OBJ} h y se instala un gráfico de control con límites ${VIZ.fmt(OBJ - 3 * sd)} h y ${VIZ.fmt(OBJ + 3 * sd)} h para sostener la mejora.`; }
      dibujar();
    }
    function calcular() {
      const m = muEf();
      const p = Phi((LSL - m) / sd) + 1 - Phi((USL - m) / sd);
      return { m, p, dpmo: p * 1e6, cp: (USL - LSL) / (6 * sd), cpk: Math.min(USL - m, m - LSL) / (3 * sd), z: Math.min(USL - mu, mu - LSL) / sd };
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const r = calcular();
      const xs = zs.map((z) => r.m + sd * z);
      const nb = Math.ceil(48 / BW);
      bins = Array.from({ length: nb }, (_, i) => ({ a: i * BW, b: (i + 1) * BW, n: 0 }));
      xs.forEach((x) => { const i = Math.min(nb - 1, Math.max(0, Math.floor(x / BW))); bins[i].n++; });
      const esp = (a, b) => N * (Phi((b - r.m) / sd) - Phi((a - r.m) / sd));
      const ymax = Math.max(...bins.map((b) => b.n), ...bins.map((b) => esp(b.a, b.b))) * 1.2 || 10;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 48, ymin: 0, ymax }, { etiquetaX: 'horas de respuesta', etiquetaY: 'casos', formatoY: (v) => String(Math.round(v)) });
      pl.ejes();
      bins.forEach((b, i) => {
        if (!b.n) return;
        const x = pl.sx(b.a) + 1, w = pl.sx(b.b) - pl.sx(b.a) - 2, y = pl.sy(b.n), dentro = b.a >= LSL && b.b <= USL;
        ctx.fillStyle = dentro ? C.s1 : C.s8;
        if (i === hover) ctx.fillStyle = VIZ.alfa(dentro ? C.s1 : C.s8, 0.7);
        ctx.beginPath(); ctx.roundRect(x, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
      });
      const curva = []; for (let x = 0; x <= 48; x += 0.5) curva.push([x, (N * BW * Math.exp(-0.5 * ((x - r.m) / sd) ** 2)) / (sd * Math.sqrt(2 * Math.PI))]);
      VIZ.trazar(ctx, pl, curva, C.tinta2, 2);
      ctx.save();
      [[LSL, 'LIE'], [USL, 'LSE']].forEach(([v, t]) => {
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(pl.sx(v), pl.y1); ctx.lineTo(pl.sx(v), pl.y0); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'top'; ctx.textAlign = v === LSL ? 'right' : 'left'; ctx.fillText(t, pl.sx(v) + (v === LSL ? -4 : 4), pl.y1 + 2);
      });
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.sx(OBJ), pl.y1); ctx.lineTo(pl.sx(OBJ), pl.y0); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.setLineDash([]); ctx.textAlign = 'center'; ctx.fillText('objetivo', pl.sx(OBJ), pl.y1 + 2);
      ctx.restore();
      const malos = xs.filter((x) => x < LSL || x > USL).length;
      registro.textContent = mensaje;
      lectura.set([
        ['Cp (potencial) / Cpk (real)', `${VIZ.fmt(r.cp, 3)} / ${VIZ.fmt(r.cpk, 3)}`],
        ['nivel sigma (corto plazo)', `${VIZ.fmt(r.z, 3)} σ`],
        ['defectos por millón (DPMO)', r.dpmo < 1 ? '<1' : VIZ.entero(r.dpmo)],
        ['rendimiento', `${VIZ.fmt((1 - r.p) * 100, 6)} %`],
        ['defectos en la muestra', `${malos} de ${N}`],
        ['media efectiva', `${VIZ.fmt(r.m, 3)} h${largo ? ' (con desplazamiento)' : ''}`],
      ]);
    }
    lienzo.alDibujar = () => zs.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const v = pl.ix(x), i = Math.min(bins.length - 1, Math.max(0, Math.floor(v / BW)));
      if (i !== hover) { hover = i; dibujar(); }
      const b = bins[i], r = calcular();
      tip.mostrar(x, y, `entre <b>${b.a}</b> y <b>${b.b}</b> h<br>casos: <b>${b.n}</b><br>esperados: <b>${VIZ.fmt(N * (Phi((b.b - r.m) / sd) - Phi((b.a - r.m) / sd)), 3)}</b>` + VIZ.filaTooltip(b.a >= LSL && b.b <= USL ? C.s1 : C.s8, b.a >= LSL && b.b <= USL ? 'dentro de la especificación' : 'defecto', null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (zs.length) dibujar(); });
    muestra();
    dibujar();
  }

  /* ---------- Fig. 3: comparación de enfoques en el tiempo ---------- */

  const ENFOQUES = [
    { id: 'pdca', n: 'PDCA / Kaizen', color: C.s1 },
    { id: 'lean', n: 'Lean', color: C.s2 },
    { id: 'six', n: 'Six Sigma', color: C.s3 },
    { id: 'll', n: 'Lean Six Sigma', color: C.s4 },
    { id: 'bpr', n: 'Reingeniería', color: C.s7 },
  ];
  const CASOS_MES = 400;

  // Estado del proceso en el mes t bajo cada enfoque.
  function configEn(t, id, o) {
    const c = { ...BASE };
    if (id === 'pdca') { const n = Math.floor(t / (12 / o.cpa)); c.eF *= 0.93 ** n; c.p *= 0.92 ** n; c.wF *= 0.99 ** n; }
    if ((id === 'lean' || id === 'll') && t >= 3) { c.dup = false; c.eF *= 1 - o.lean; c.capt = true; }
    if ((id === 'six' || id === 'll') && t >= 6) { c.p *= 1 - o.ss; c.wF *= 0.97; }
    if (id === 'll' && t >= 9) { c.eF *= 0.9; }
    if (id === 'bpr') {
      if (t >= o.bpr) { c.dup = false; c.eF *= 0.25; c.wF *= 0.5; c.capt = true; c.p *= 0.4; }
      else if (t >= o.bpr - 4) { c.eF *= 1.1; c.wF *= 1.1; }
    }
    return c;
  }
  function serie(id, o, metrica) {
    const pts = [];
    let acum = 0;
    for (let t = 0; t <= 24; t++) {
      const m = modelo(configEn(t, id, o));
      if (t > 0) acum += (CASOS_MES * (L0 - m.lead)) / 60;
      pts.push([t, metrica === 'ciclo' ? m.lead / 60 : metrica === 'defectos' ? m.p * 100 : acum]);
    }
    return pts;
  }
  const METRICAS = { ciclo: ['Tiempo de ciclo (h)', 'h'], defectos: ['Casos con reproceso (%)', '%'], ahorro: ['Horas de espera evitadas (acumuladas)', 'h'] };

  function montarComparacion(cuerpo) {
    const o = { cpa: 4, lean: 0.6, ss: 0.75, bpr: 9 };
    let metrica = 'ciclo', hoverT = null, pl = null, datos = {};
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Qué medir', opciones: Object.entries(METRICAS).map(([k, v]) => [k, v[0]]), valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ciclos PDCA por año', min: 1, max: 12, valor: o.cpa, alCambiar: (v) => { o.cpa = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Reducción de esperas con Lean', min: 20, max: 80, paso: 5, valor: o.lean * 100, formato: (v) => `${v} %`, alCambiar: (v) => { o.lean = v / 100; dibujar(); } });
    ctl.rango({ etiqueta: 'Reducción de defectos con Six Sigma', min: 30, max: 90, paso: 5, valor: o.ss * 100, formato: (v) => `${v} %`, alCambiar: (v) => { o.ss = v / 100; dibujar(); } });
    ctl.rango({ etiqueta: 'Mes de puesta en marcha de la reingeniería', min: 5, max: 20, valor: o.bpr, formato: (v) => `mes ${v}`, alCambiar: (v) => { o.bpr = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.apagado, texto: 'sin cambios', forma: 'linea' }, ...ENFOQUES.map((e) => ({ color: e.color, texto: e.n, forma: 'linea' }))]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un mes para comparar los enfoques. PDCA mejora poco a poco, Lean y Six Sigma dan saltos tras un proyecto, y la reingeniería empeora antes de mejorar. Mueva su mes de puesta en marcha y mire cuándo supera al resto.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      datos = {};
      ENFOQUES.forEach((e) => { datos[e.id] = serie(e.id, o, metrica); });
      const nada = serie('ninguno', o, metrica);
      const todos = [nada, ...Object.values(datos)].flat().map((p) => p[1]);
      const lo = Math.min(0, ...todos), hi = Math.max(...todos) * 1.08 || 1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 24, ymin: lo, ymax: hi }, { etiquetaX: 'meses', etiquetaY: METRICAS[metrica][0], ticksX: [0, 3, 6, 9, 12, 15, 18, 21, 24] });
      pl.ejes();
      VIZ.trazar(ctx, pl, nada, C.apagado, 2, [3, 4]);
      ENFOQUES.forEach((e) => VIZ.trazar(ctx, pl, datos[e.id], e.color, 2.5));
      const t = hoverT !== null ? hoverT : 24;
      if (hoverT !== null) {
        ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(t), pl.y1); ctx.lineTo(pl.sx(t), pl.y0); ctx.stroke(); ctx.restore();
        ENFOQUES.forEach((e) => VIZ.marcador(ctx, pl.sx(t), pl.sy(datos[e.id][t][1]), e.color, 4));
      }
      const u = METRICAS[metrica][1], val = (id) => datos[id][t][1];
      const fmt = (v) => `${VIZ.fmt(v, 3)} ${u}`;
      const mejor = ENFOQUES.slice().sort((a, b) => (metrica === 'ahorro' ? val(b.id) - val(a.id) : val(a.id) - val(b.id)))[0];
      const bpr = datos.bpr, otro = ENFOQUES.filter((e) => e.id !== 'bpr' && e.id !== 'll');
      const cruce = bpr.findIndex((p, m) => m >= o.bpr && otro.every((e) => (metrica === 'ahorro' ? p[1] >= datos[e.id][m][1] : p[1] <= datos[e.id][m][1])));
      registro.textContent = `Mes ${t}: ${METRICAS[metrica][0].toLowerCase()} sin cambios = ${fmt(nada[t][1])}; el mejor enfoque es ${mejor.n} (${fmt(val(mejor.id))}). ` +
        (metrica === 'ciclo' || metrica === 'ahorro' ? (cruce >= 0 ? `La reingeniería supera a PDCA, Lean y Six Sigma por separado desde el mes ${cruce}.` : 'En este horizonte la reingeniería no llega a superar a las mejoras graduales.') : '');
      lectura.set(ENFOQUES.map((e) => [e.n + (hoverT === null ? ' (mes 24)' : ` (mes ${t})`), fmt(val(e.id))]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hoverT = null; tip.ocultar(); return dibujar(); }
      hoverT = Math.max(0, Math.min(24, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `mes <b>${hoverT}</b>` + ENFOQUES.map((e) => VIZ.filaTooltip(e.color, e.n, VIZ.fmt(datos[e.id][hoverT][1], 3) + ' ' + METRICAS[metrica][1])).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hoverT = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('continuous-improvement', {
    intro: String.raw`
      <p>Mejorar un proceso no es una sola técnica. La <strong>mejora continua</strong> (PDCA, <em>kaizen</em>) hace cambios pequeños y constantes; <strong>Lean</strong> busca eliminar desperdicios, es decir,
      todo lo que el cliente no valora (esperas, repetición de trabajo, controles redundantes); <strong>Six Sigma</strong> reduce la variabilidad y los defectos con datos; y la <strong>reingeniería</strong> rediseña el proceso desde cero, a menudo apoyada en automatización.</p>
      <p>Aquí se aplican todas al mismo proceso, el pago de reclamos de un seguro, y se calcula el efecto de cada una: cuánto bajan el tiempo de ciclo y los defectos, y cuánto tardan en mostrar resultados.</p>`,
    visualizaciones: [
      {
        titulo: 'Lean: valor agregado frente a espera',
        descripcion: 'Un reclamo pasa más de 19 horas en el sistema para recibir apenas 65 minutos de trabajo que el cliente valora. Elimine la revisión duplicada y reduzca las esperas: observe qué palanca acorta más la barra.',
        montar: montarLean,
      },
      {
        titulo: 'Six Sigma: variabilidad y defectos',
        descripcion: 'Con la media centrada, reduzca σ y vea cómo desaparecen los defectos y sube el nivel sigma. Pruebe a descentrar la media: con σ pequeña igual hay defectos. Active el desplazamiento de 1,5σ para obtener los 3,4 DPMO de seis sigma.',
        montar: montarSigma,
      },
      {
        titulo: 'Los cuatro enfoques en el tiempo',
        descripcion: 'Compare 24 meses de PDCA, Lean, Six Sigma, Lean Six Sigma y reingeniería. Retrase la reingeniería y vea que empeora antes de mejorar; cambie la métrica a defectos o a horas evitadas.',
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>Cuatro enfoques, un mismo objetivo</h2>
      <table>
        <tr><th>Enfoque</th><th>Idea</th><th>Ritmo y riesgo</th><th>Herramienta típica</th></tr>
        <tr><td>Mejora continua (PDCA)</td><td>cambios pequeños y permanentes</td><td>gradual, bajo riesgo</td><td>ciclo Planificar–Hacer–Verificar–Actuar</td></tr>
        <tr><td>Lean</td><td>eliminar desperdicio y esperas</td><td>saltos tras talleres, riesgo bajo o medio</td><td>mapa de flujo de valor, flujo continuo, 5S</td></tr>
        <tr><td>Six Sigma</td><td>reducir variabilidad y defectos</td><td>proyectos de 3 a 6 meses</td><td>DMAIC, gráficos de control, Cp y Cpk</td></tr>
        <tr><td>Reingeniería / automatización</td><td>rediseño radical del proceso</td><td>un gran salto, riesgo alto y curva en J</td><td>nuevo modelo, automatización de tareas</td></tr>
      </table>
      <h2>Mejora continua: el ciclo PDCA</h2>
      <p>Cada ciclo planifica un cambio, lo prueba en pequeño, verifica con datos y estandariza lo que funcionó. Si cada ciclo reduce una variable en un factor \(r < 1\), tras \(n\) ciclos queda \(x_0\, r^{\,n}\). Con esperas que bajan 7 % por ciclo (\(r = 0{,}93\)) y 8 ciclos al año de 3 meses, las esperas quedan en \(0{,}93^{8} \approx 56\ \%\) al cabo de dos años.</p>
      <h2>Lean: valor, necesidad y desperdicio</h2>
      <p>Lean clasifica cada minuto del ciclo. El tiempo de ciclo es la suma de trabajo y espera, y la <em>eficiencia del flujo</em> mide qué parte del ciclo agrega valor:</p>
      \[ T = \sum_i (w_i + e_i) + \frac{p}{1-p}\,R, \qquad \eta = \frac{\sum_{i \in \text{valor}} w_i}{T}, \]
      <p>donde \(p\) es la fracción de casos que vuelve atrás y \(R\) el tiempo del tramo que se repite. Los siete desperdicios clásicos son espera, transporte, sobreprocesamiento, inventario, movimiento, sobreproducción y defectos; en servicios, la mayoría es espera, repetición y aprobaciones redundantes.</p>
      <h3>Ejemplo resuelto</h3>
      <p>En el proceso de reclamos, el trabajo suma 120 min, de los cuales 65 agregan valor, y las esperas suman 960 min. El tramo repetido (verificar y evaluar) es \(R = 15 + 180 + 45 + 240 = 480\) min y \(p = 0{,}15\):</p>
      \[ T = 120 + 960 + \tfrac{0{,}15}{0{,}85}\cdot 480 \approx 1165\ \text{min} \approx 19{,}4\ \text{h}, \qquad \eta = \tfrac{65}{1165} \approx 5{,}6\ \%. \]
      <p>Eliminar la revisión duplicada, reducir las esperas a 40 %, capturar los datos una sola vez y bajar el reproceso a 7 % deja \(T \approx 366\) min (6,1 h) y \(\eta \approx 18\ \%\). Ninguna tarea que agrega valor se aceleró: se quitó lo que sobraba.</p>
      <h2>Six Sigma: variabilidad y DMAIC</h2>
      <p>Para una característica con límites de especificación \(LIE\) y \(LSE\), media \(\mu\) y desviación \(\sigma\):</p>
      \[ C_p = \frac{LSE - LIE}{6\sigma}, \qquad C_{pk} = \frac{\min(LSE - \mu,\ \mu - LIE)}{3\sigma}, \qquad \text{nivel sigma } Z = \frac{\min(LSE - \mu,\ \mu - LIE)}{\sigma}. \]
      <p>La fracción de defectos de una normal es \(p = \Phi\!\left(\tfrac{LIE-\mu}{\sigma}\right) + 1 - \Phi\!\left(\tfrac{LSE-\mu}{\sigma}\right)\) y los defectos por millón son \(\text{DPMO} = 10^6\, p\). Por convención, el largo plazo desplaza la media \(1{,}5\sigma\) hacia un límite:</p>
      <table>
        <tr><th>Nivel sigma</th><th>DPMO (con desplazamiento de 1,5σ)</th><th>Rendimiento</th></tr>
        <tr><td>2</td><td>308.538</td><td>69,1 %</td></tr>
        <tr><td>3</td><td>66.807</td><td>93,3 %</td></tr>
        <tr><td>4</td><td>6.210</td><td>99,38 %</td></tr>
        <tr><td>5</td><td>233</td><td>99,977 %</td></tr>
        <tr><td>6</td><td>3,4</td><td>99,99966 %</td></tr>
      </table>
      <p>El método <strong>DMAIC</strong> ordena un proyecto en cinco fases: <em>Definir</em> el problema y lo crítico para el cliente, <em>Medir</em> el desempeño actual, <em>Analizar</em> las causas, <em>Mejorar</em> actuando sobre ellas y <em>Controlar</em> para que la mejora se mantenga.</p>
      <h2>Reingeniería y automatización</h2>
      <p>La reingeniería de procesos rediseña de raíz en lugar de ajustar: elimina pasos, paraleliza y automatiza. Sus resultados son los mayores, pero también el costo, el riesgo y la resistencia al cambio; es frecuente una <em>curva en J</em>: el desempeño empeora durante la transición y solo después supera al anterior. Automatizar un proceso sin simplificarlo antes solo acelera el desperdicio.</p>
      <div class="recuadro"><p><strong>Cómo elegir.</strong> Con esperas largas y pasos redundantes, parta por Lean; con resultados variables y defectos, por Six Sigma; con un proceso que ya no se sostiene, rediseñe. Mantener PDCA después de cualquier mejora evita que el proceso se degrade.</p></div>
      <h2>Conexiones</h2>
      <p>El diagnóstico de esperas se apoya en la <a href="tema.html?id=process-simulation">simulación de procesos</a> y en el <a href="tema.html?id=bottleneck-analysis">análisis de cuellos de botella</a>; el efecto de un cambio se mide con indicadores como los de <a href="tema.html?id=kpi-definition">definición de KPIs</a> y
      <a href="tema.html?id=improvement-impact">impacto de las mejoras</a>. El punto de partida es el <a href="tema.html?id=business-process-anatomy">flujo del trabajo entre áreas</a>; las inversiones se justifican como en <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a> y se gestionan con <a href="tema.html?id=change-management">gestión del cambio</a>.</p>`,
  });
})();
