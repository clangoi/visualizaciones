(function () {
  'use strict';
  const { color: C } = VIZ;
  const NT = 100; // sistemas de la organización
  const CS = 0.2; // costo por sistema afectado y hora, en miles de USD (supuesto del modelo)
  const CR = 1.5; // costo por hora del equipo de respuesta, en miles de USD (supuesto del modelo)
  const mil = (v) => (v >= 1000 ? `${VIZ.fmt(v / 1000, 3)} M USD` : `${VIZ.fmt(v, 3)} mil USD`);
  const horas = (h) => (h >= 48 ? `${VIZ.fmt(h / 24, 3)} días` : `${VIZ.fmt(h, 3)} h`);

  // Sistemas afectados en la hora t: crece hasta detectar (d), se frena durante la contención (c),
  // se mantiene durante la erradicación (e) y baja a cero mientras se recuperan los servicios (r).
  function sistemas(t, p) {
    const { d, c, e, r, g } = p;
    const crece = (tt) => Math.min(NT, Math.exp(g * tt));
    if (t < d) return crece(t);
    const nd = crece(d), pico = Math.min(NT, nd * Math.exp((g * c) / 2));
    if (t < d + c) { const tau = t - d; return Math.min(NT, nd * Math.exp(g * (tau - (tau * tau) / (2 * c)))); }
    if (t < d + c + e) return pico;
    if (t < d + c + e + r) return pico * (1 - (t - d - c - e) / r);
    return 0;
  }
  function costoHasta(T, p) {
    let area = 0;
    const h = 0.25;
    for (let t = 0; t < T; t += h) area += sistemas(t + h / 2, p) * Math.min(h, T - t);
    const trabajo = Math.max(0, Math.min(T, p.d + p.c + p.e + p.r) - p.d);
    return CS * area + CR * trabajo;
  }
  const picoDe = (p) => sistemas(p.d + p.c, p);
  const FASES = [
    { n: 'Detección', col: C.s4 }, { n: 'Contención', col: C.s2 }, { n: 'Erradicación', col: C.s7 }, { n: 'Recuperación', col: C.s6 }, { n: 'Lecciones aprendidas', col: C.s1 },
  ];
  const fasesDe = (p) => [0, p.d, p.d + p.c, p.d + p.c + p.e, p.d + p.c + p.e + p.r, p.d + p.c + p.e + p.r + 8];
  const faseEn = (t, p) => { const f = fasesDe(p); for (let k = 0; k < 5; k++) if (t < f[k + 1]) return k; return 4; };

  /* ---------- Fig. 1: ciclo de vida del incidente ---------- */

  const NIVELES = {
    sin: { n: 'Sin plan de respuesta', d: 72, c: 24, e: 36, r: 72 },
    plan: { n: 'Plan escrito y equipo asignado', d: 24, c: 8, e: 12, r: 24 },
    sim: { n: 'Plan, simulacros y monitoreo 24×7', d: 4, c: 2, e: 6, r: 12 },
  };

  function montarCiclo(cuerpo) {
    let p = { ...NIVELES.plan, g: 0.12 }, t = 0, mensaje = '', hover = null, pl = null, fin = false;
    const ctl = VIZ.controles(cuerpo);
    const sNivel = ctl.selector({ etiqueta: 'Madurez del equipo', opciones: Object.entries(NIVELES).map(([k, v]) => [k, v.n]), valor: 'plan', alCambiar: (v) => { const n = NIVELES[v]; p.d = n.d; p.c = n.c; p.e = n.e; p.r = n.r; rD.valor = n.d; rC.valor = n.c; rE.valor = n.e; rR.valor = n.r; rep.reiniciar(); } });
    const rD = ctl.rango({ etiqueta: 'Tiempo hasta detectar', min: 1, max: 96, valor: p.d, formato: horas, alCambiar: (v) => { p.d = v; rep.reiniciar(); } });
    const rC = ctl.rango({ etiqueta: 'Tiempo de contención', min: 1, max: 48, valor: p.c, formato: horas, alCambiar: (v) => { p.c = v; rep.reiniciar(); } });
    const rE = ctl.rango({ etiqueta: 'Erradicación', min: 1, max: 48, valor: p.e, formato: horas, alCambiar: (v) => { p.e = v; rep.reiniciar(); } });
    const rR = ctl.rango({ etiqueta: 'Recuperación', min: 1, max: 96, valor: p.r, formato: horas, alCambiar: (v) => { p.r = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Propagación del ataque por hora', min: 0.03, max: 0.3, paso: 0.01, valor: p.g, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { p.g = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, FASES.map((f) => ({ color: f.col, texto: f.n })).concat([{ color: C.s8, texto: 'sistemas afectados', forma: 'linea' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Reproducir» para avanzar por las fases, o «Hasta el final». Cambie el nivel de madurez o los tiempos de cada fase y compare el área roja: mientras el ataque no se detecta, se expande sin freno. Pase el cursor para ver cada instante.');

    const total = () => fasesDe(p)[5];
    function iniciar() {
      t = 0; fin = false;
      mensaje = `Comienza el ataque. Todavía nadie lo sabe: 1 sistema comprometido y creciendo ${Math.round(p.g * 100)} % por hora.`;
      const dt = Math.max(1, Math.ceil(total() / 70)), tot = total();
      return (function* () {
        while (t < tot) {
          t = Math.min(tot, t + dt);
          const f = faseEn(t - 1e-6, p), a = sistemas(t, p);
          mensaje = [
            `Hora ${VIZ.fmt(t, 3)}: aún sin detectar; ${VIZ.fmt(a, 3)} sistemas comprometidos.`,
            `Hora ${VIZ.fmt(t, 3)}: el equipo aísla los sistemas y la propagación se frena; ${VIZ.fmt(a, 3)} comprometidos.`,
            `Hora ${VIZ.fmt(t, 3)}: se elimina la causa (credenciales, malware, vulnerabilidad); el ataque ya no avanza.`,
            `Hora ${VIZ.fmt(t, 3)}: se restauran los servicios desde respaldos; quedan ${VIZ.fmt(a, 3)} sistemas fuera.`,
            `Hora ${VIZ.fmt(t, 3)}: revisión posterior al incidente y cambios de procedimiento.`,
          ][f];
          fin = t >= tot;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const T = total(), pico = picoDe(p);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: T, ymin: 0, ymax: Math.max(10, NT) }, { etiquetaX: 'horas desde el inicio del ataque', etiquetaY: 'sistemas afectados', formatoX: (v) => String(Math.round(v)) });
      const f = fasesDe(p);
      FASES.forEach((fa, k) => {
        ctx.fillStyle = VIZ.alfa(fa.col, 0.16); ctx.fillRect(pl.sx(f[k]), pl.y1, pl.sx(f[k + 1]) - pl.sx(f[k]), pl.y0 - pl.y1);
      });
      pl.ejes();
      const pts = [], ghost = [];
      for (let k = 0; k <= 240; k++) { const tt = (T * k) / 240; (tt <= t ? pts : ghost).push([tt, sistemas(tt, p)]); }
      if (ghost.length) VIZ.trazar(ctx, pl, [pts[pts.length - 1] || [0, 1], ...ghost], C.tenue, 1.5, [3, 4]);
      if (pts.length) {
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(pl.sx(x), pl.sy(y)) : ctx.moveTo(pl.sx(x), pl.sy(y))));
        ctx.lineTo(pl.sx(pts[pts.length - 1][0]), pl.y0); ctx.lineTo(pl.sx(0), pl.y0); ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s8, 0.25); ctx.fill();
        VIZ.trazar(ctx, pl, pts, C.s8, 2.5);
      }
      ctx.save(); ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      FASES.forEach((fa, k) => { const w = pl.sx(f[k + 1]) - pl.sx(f[k]); if (w > 54) { ctx.fillStyle = C.tinta2; ctx.fillText(fa.n.replace('Lecciones aprendidas', 'Lecciones'), pl.sx(f[k]) + w / 2, pl.y1 + 3); } });
      ctx.restore();
      if (t > 0) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pl.sx(t), pl.y1); ctx.lineTo(pl.sx(t), pl.y0); ctx.stroke(); }
      if (hover != null) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); VIZ.marcador(ctx, pl.sx(hover), pl.sy(sistemas(hover, p)), C.s8, 4); }
      registro.textContent = mensaje;
      const fase = FASES[faseEn(Math.max(0, t - 1e-6), p)].n;
      lectura.set([
        ['hora', VIZ.fmt(t, 3)], ['fase', t === 0 ? 'ataque en curso' : fase], ['sistemas afectados', VIZ.fmt(sistemas(t, p), 3)],
        ['pico de sistemas', VIZ.fmt(pico, 3)], ['costo acumulado', mil(costoHasta(t, p))],
        ['MTTD · MTTR · total', fin ? `${horas(p.d)} · ${horas(p.c + p.e + p.r)} · ${horas(p.d + p.c + p.e + p.r)}` : '(al terminar)'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(total(), pl.ix(x)));
      dibujar();
      tip.mostrar(x, y, `hora <b>${VIZ.fmt(hover, 3)}</b>` + VIZ.filaTooltip(FASES[faseEn(hover, p)].col, FASES[faseEn(hover, p)].n, null) + `<br>sistemas afectados <b>${VIZ.fmt(sistemas(hover, p), 3)}</b><br>costo hasta aquí <b>${mil(costoHasta(hover, p))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    sNivel.valor = 'plan';
    rep.reiniciar();
  }

  /* ---------- Fig. 2: costo según el tiempo sin detectar ---------- */

  function montarCosto(cuerpo) {
    let semilla = 1, mejoraDet = 0, mejoraResp = 0, g = 0.12, inc = [], sel = -1, hover = -1, pl = null, base = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Mejora de detección (monitoreo)', min: 0, max: 0.9, paso: 0.05, valor: mejoraDet, formato: (v) => `−${Math.round(v * 100)} % de tiempo`, alCambiar: (v) => { mejoraDet = v; calcular(); } });
    ctl.rango({ etiqueta: 'Mejora de respuesta (plan y práctica)', min: 0, max: 0.9, paso: 0.05, valor: mejoraResp, formato: (v) => `−${Math.round(v * 100)} % de tiempo`, alCambiar: (v) => { mejoraResp = v; calcular(); } });
    ctl.rango({ etiqueta: 'Propagación del ataque por hora', min: 0.03, max: 0.3, paso: 0.01, valor: g, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { g = v; calcular(); } });
    ctl.boton('Nuevos incidentes', () => { semilla++; sel = -1; generar(); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'incidente simulado (40 por año)' }, { color: C.s2, texto: 'incidente seleccionado' }, { color: C.tinta, texto: 'modelo con tiempos medianos', forma: 'linea' },
      { color: C.apagado, texto: 'misma muestra sin mejoras', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    registro.textContent = 'Haga clic en un incidente para ver cuánto costó y cuál fue la fase más cara.';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un incidente con tiempos aleatorios (distribución log-normal). Mejore la detección y la respuesta: los puntos se desplazan a la izquierda y bajan. Fíjese en que el costo crece mucho más rápido que el tiempo sin detectar.');

    const MED = { d: 24, c: 8, e: 12, r: 24 };
    function generar() {
      const rnd = VIZ.semilla(semilla * 211), nor = () => VIZ.normal(rnd);
      base = Array.from({ length: 40 }, () => ({ d: MED.d * Math.exp(0.8 * nor()), c: MED.c * Math.exp(0.5 * nor()), e: MED.e * Math.exp(0.4 * nor()), r: MED.r * Math.exp(0.5 * nor()) }));
    }
    function calcular() {
      inc = base.map((b) => {
        const q = { d: Math.max(0.5, b.d * (1 - mejoraDet)), c: Math.max(0.5, b.c * (1 - mejoraResp)), e: Math.max(0.5, b.e * (1 - mejoraResp)), r: Math.max(0.5, b.r * (1 - mejoraResp)), g };
        const q0 = { ...b, g };
        return { q, costo: costoHasta(q.d + q.c + q.e + q.r + 1, q), costo0: costoHasta(b.d + b.c + b.e + b.r + 1, q0), q0 };
      });
      dibujar();
    }
    const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    function dibujar() {
      if (!inc.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 120, ymin: 1, ymax: 10000 }, { logY: true, etiquetaX: 'horas sin detectar el incidente', etiquetaY: 'costo del incidente (miles de USD)', formatoX: (v) => String(Math.round(v)), margen: { izq: 58 } });
      pl.ejes();
      const curva = (par) => { const o = []; for (let d = 0.5; d <= 120; d += 1.5) { const q = { d, c: MED.c * (1 - par), e: MED.e * (1 - par), r: MED.r * (1 - par), g }; o.push([d, costoHasta(d + q.c + q.e + q.r + 1, q)]); } return o; };
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, curva(0), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, curva(mejoraResp), C.tinta, 2.5);
      inc.forEach((r, k) => { if (k !== sel) VIZ.marcador(ctx, pl.sx(r.q.d), pl.sy(Math.max(1, r.costo)), C.s1, k === hover ? 6 : 4); });
      if (sel >= 0) VIZ.marcador(ctx, pl.sx(inc[sel].q.d), pl.sy(Math.max(1, inc[sel].costo)), C.s2, 7);
      ctx.restore();
      const mttd = media(inc.map((r) => r.q.d)), mttr = media(inc.map((r) => r.q.c + r.q.e + r.q.r));
      const cm = media(inc.map((r) => r.costo)), c0 = media(inc.map((r) => r.costo0));
      lectura.set([
        ['MTTD (tiempo medio de detección)', horas(mttd)], ['MTTR (tiempo medio de respuesta y recuperación)', horas(mttr)],
        ['costo medio por incidente', mil(cm)], ['costo anual de los 40 incidentes', mil(cm * 40)], ['ahorro frente a la muestra sin mejoras', `${mil((c0 - cm) * 40)} (${VIZ.fmt((1 - cm / c0) * 100, 3)} %)`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const mas = (x, y) => inc.findIndex((r) => Math.hypot(pl.sx(r.q.d) - x, pl.sy(Math.max(1, r.costo)) - y) < 9);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      const k = mas(x, y);
      if (k !== hover) { hover = k; dibujar(); }
      if (k < 0) return tip.ocultar();
      const r = inc[k];
      tip.mostrar(x, y, `<b>incidente ${k + 1}</b><br>detección ${horas(r.q.d)}<br>contención ${horas(r.q.c)}<br>erradicación + recuperación ${horas(r.q.e + r.q.r)}<br>costo <b>${mil(r.costo)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const k = mas(x, y);
      if (k < 0) return;
      sel = k; const r = inc[k], T = r.q.d + r.q.c + r.q.e + r.q.r + 1;
      const antes = costoHasta(r.q.d, r.q), durante = costoHasta(r.q.d + r.q.c, r.q) - antes, resto = costoHasta(T, r.q) - antes - durante;
      registro.textContent = `Incidente ${k + 1}: costó ${mil(r.costo)}. Hasta detectarlo ${mil(antes)}; durante la contención ${mil(durante)}; en erradicación y recuperación ${mil(resto)}. Con tiempos originales habría costado ${mil(r.costo0)}.`;
      dibujar();
    });
    generar();
    calcular();
  }

  VIZ.registrarTema('incident-management', {
    intro: String.raw`
      <p>Un <strong>incidente de seguridad</strong> es un evento que compromete la confidencialidad, la integridad o la disponibilidad: un ransomware, una cuenta robada, una filtración. Lo decisivo no es solo evitar los incidentes, que tarde o temprano ocurren,
      sino <strong>cuánto tarda la organización en notarlos y en controlarlos</strong>, porque el daño crece con el tiempo.</p>
      <p>La gestión de incidentes ordena la respuesta en fases: preparación, detección, contención, erradicación, recuperación y lecciones aprendidas. Medir los tiempos de cada una (MTTD y MTTR) permite saber dónde conviene invertir.</p>`,
    visualizaciones: [
      {
        titulo: 'Un incidente, fase por fase',
        descripcion: 'Reproduzca el incidente y observe cómo el ataque se propaga hasta que se detecta. Compare «Sin plan» con «Plan, simulacros y monitoreo»: cambian el pico de sistemas, la duración y el costo.',
        montar: montarCiclo,
      },
      {
        titulo: 'Costo según el tiempo sin detectar',
        descripcion: 'Mueva la mejora de detección y vea bajar los 40 incidentes por la curva; luego mejore solo la respuesta y compare. Haga clic en un punto para ver en qué fase se fue el dinero.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Fases de la respuesta</h2>
      <table>
        <tr><th>Fase</th><th>Pregunta</th><th>Ejemplo</th></tr>
        <tr><td>Preparación</td><td>¿Estamos listos?</td><td>plan de respuesta, roles, contactos, simulacros</td></tr>
        <tr><td>Detección y análisis</td><td>¿Qué está pasando?</td><td>alertas, registros, aviso de un usuario</td></tr>
        <tr><td>Contención</td><td>¿Cómo evitamos que se extienda?</td><td>aislar equipos, bloquear cuentas</td></tr>
        <tr><td>Erradicación</td><td>¿Cómo eliminamos la causa?</td><td>quitar malware, cerrar la vulnerabilidad</td></tr>
        <tr><td>Recuperación</td><td>¿Cómo volvemos a operar?</td><td>restaurar desde respaldos, vigilar de cerca</td></tr>
        <tr><td>Lecciones aprendidas</td><td>¿Qué cambiamos?</td><td>revisión posterior, mejoras del plan</td></tr>
      </table>
      <h2>Indicadores de tiempo</h2>
      <p>Con un incidente que comienza en \(t_0\), se detecta en \(t_d\), se contiene en \(t_c\), se erradica en \(t_e\) y se recupera en \(t_r\):</p>
      \[ \mathrm{TTD} = t_d - t_0, \qquad \mathrm{TTR} = t_r - t_d, \qquad \mathrm{MTTD} = \frac{1}{n}\sum_{i=1}^{n} \mathrm{TTD}_i, \qquad \mathrm{MTTR} = \frac{1}{n}\sum_{i=1}^{n} \mathrm{TTR}_i. \]
      <p>El tiempo total de exposición es \(\mathrm{MTTD} + \mathrm{MTTR}\). Como los tiempos son muy asimétricos (unos pocos incidentes largos), conviene reportar también la mediana.</p>
      <h2>Por qué el costo crece más rápido que el tiempo</h2>
      <p>Mientras el ataque no se detecta, los sistemas comprometidos crecen casi exponencialmente: \(N(t) \approx \min(N_{\max},\, e^{g t})\) con tasa horaria \(g\). Si cada sistema afectado cuesta \(c_s\) por hora y el equipo de respuesta \(c_r\) por hora,</p>
      \[ \text{Costo} = c_s \int_0^{T} N(t)\,dt \;+\; c_r\,(t_r - t_d). \]
      <p>Retrasar la detección tiene dos efectos: llega a más sistemas y todos ellos permanecen afectados durante las fases siguientes. Por eso el eje vertical de la segunda figura es logarítmico: una mejora modesta del tiempo de detección puede reducir el costo en un orden de magnitud.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con \(g = 0{,}12\) por hora, un ataque detectado a las 24 h llega a \(e^{2{,}88} \approx 17{,}8\) sistemas; uno detectado a las 4 h, a \(e^{0{,}48} \approx 1{,}6\). El primer caso afecta a unas \(11\) veces más sistemas en el momento de iniciar la contención,
      y todos permanecen fuera durante la erradicación y la recuperación. Si además la respuesta tarda la mitad, el área de sistemas afectados (y con ella el costo) se reduce todavía más.</p></div>
      <h2>Lecciones aprendidas</h2>
      <p>La revisión posterior sin culpables busca causas raíz, no personas: ¿qué alerta faltó?, ¿qué paso del plan no se pudo ejecutar?, ¿cuántos minutos se perdieron en decidir quién autorizaba aislar un servidor? Los cambios resultantes se prueban en el siguiente simulacro.</p>
      <h2>Conexiones</h2>
      <p>La recuperación depende de los <a href="tema.html?id=backups-disaster-recovery">respaldos y los objetivos RPO y RTO</a>; qué parte del negocio se prioriza al restaurar se decide con el análisis de impacto en
      <a href="tema.html?id=continuity-risk-mitigation">continuidad y mitigación</a>; y cómo suelen comenzar los incidentes se vio en <a href="tema.html?id=malware-phishing-social-engineering">malware, phishing e ingeniería social</a>.
      Los indicadores MTTD y MTTR se vigilan con <a href="tema.html?id=kpi-fundamentals">KPIs</a>.</p>`,
  });
})();
