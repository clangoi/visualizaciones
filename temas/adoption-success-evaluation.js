(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;

  /* ---------- Fig. 1: estrategias de implementación ---------- */

  const UNIDADES = [['Ventas', 120], ['Bodega', 80], ['Finanzas', 60], ['Compras', 150], ['Soporte', 90], ['RR. HH.', 40], ['Producción', 100], ['Gerencia', 60]];
  const USUARIOS = UNIDADES.reduce((s, u) => s + u[1], 0);
  const ESTRATEGIAS = [
    ['bigbang', 'Big bang (todos a la vez)'], ['paralelo', 'Paralelo (ambos sistemas por 6 semanas)'],
    ['piloto', 'Piloto (una unidad y luego todas)'], ['fases', 'Por fases (grupos cada 3 semanas)'],
  ];
  const T = 30, GO = 6; // semanas totales y semana de puesta en marcha
  const COSTO_SEMANA = 0.8, COSTO_DEFECTO = 0.15; // miles de USD por usuario-semana, y por usuario afectado por un defecto

  // Semana en que cada unidad pasa al sistema nuevo según la estrategia.
  function corte(est) {
    return UNIDADES.map((u, i) => {
      if (est === 'bigbang' || est === 'paralelo') return GO;
      if (est === 'piloto') return u[0] === 'RR. HH.' ? GO : GO + 6;
      return GO + 3 * Math.floor(i / 2);
    });
  }
  // Simula semana a semana; los defectos se descubren a razón creciente con la raíz de los usuarios en producción.
  function simular(est, defectos, capacitacion) {
    const cut = corte(est), d0 = 0.35 * (1 - 0.7 * capacitacion), tau = 3;
    let restantes = defectos;
    const sem = [{ t: 0, adop: 0, prod: 0, doble: 0, inc: 0, desc: 0, afectados: 0 }];
    let aP = 0, aD = 0, aI = 0, afectados = 0;
    for (let t = 1; t <= T; t++) {
      let vivos = 0, prod = 0, doble = 0;
      UNIDADES.forEach(([, n], i) => {
        if (t < cut[i]) return;
        vivos += n;
        prod += COSTO_SEMANA * n * d0 * Math.exp(-(t - cut[i]) / tau);
        if (est === 'paralelo' && t < GO + 6) doble += COSTO_SEMANA * n * 0.25;
      });
      const desc = restantes * (1 - Math.exp(-1.1 * Math.sqrt(vivos / USUARIOS)));
      const inc = desc * vivos * COSTO_DEFECTO * (est === 'paralelo' && t < GO + 6 ? 0.2 : 1);
      restantes -= desc; afectados += desc * vivos;
      aP += prod; aD += doble; aI += inc;
      sem.push({ t, adop: vivos / USUARIOS, prod: aP, doble: aD, inc: aI, desc, vivos, afectados });
    }
    return sem;
  }
  const totalDe = (s) => s.prod + s.doble + s.inc;

  function montarEstrategias(cuerpo) {
    let est = 'bigbang', defectos = 6, cap = 0.5, semana = 0, datos = [], g1 = null, g2 = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', opciones: ESTRATEGIAS, valor: est, alCambiar: (v) => { est = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Defectos latentes del sistema', min: 1, max: 12, valor: defectos, formato: (v) => String(v), alCambiar: (v) => { defectos = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Capacitación previa', min: 0, max: 1, paso: 0.1, valor: cap, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { cap = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    VIZ.subtitulo(cuerpo, 'Usuarios que ya trabajan en el sistema nuevo');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.28, altoMin: 140, altoMax: 200 });
    const t1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Costo acumulado de la transición (miles de USD)');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 180, altoMax: 270 });
    const t2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'usuarios en el sistema nuevo', forma: 'linea' }, { color: C.s2, texto: 'productividad perdida mientras aprenden' },
      { color: C.s4, texto: 'doble operación (ambos sistemas)' }, { color: C.s8, texto: 'incidentes por defectos' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ocho unidades (700 usuarios) cambian de sistema desde la semana 6. Reproduzca cada estrategia y compare el total en la lectura: el big bang concentra el riesgo, el paralelo paga doble, el piloto y las fases exponen pocos usuarios a los defectos.');

    function iniciar() {
      datos = simular(est, defectos, cap);
      semana = 0;
      return (function* () { while (semana < T) { semana++; yield; } })();
    }
    function dibujar() {
      if (!datos.length) return;
      const cut = corte(est);
      // Panel 1
      let c = l1.ctx;
      l1.limpiar();
      g1 = VIZ.plano(l1, { xmin: 0, xmax: T, ymin: 0, ymax: 105 }, { etiquetaX: 'semana', formatoY: (v) => `${Math.round(v)} %`, ticksY: [0, 50, 100] });
      g1.ejes();
      const ptsAll = datos.map((d) => [d.t, 100 * d.adop]);
      VIZ.trazar(c, g1, ptsAll, VIZ.alfa(C.s1, 0.3), 2);
      VIZ.trazar(c, g1, ptsAll.slice(0, semana + 1), C.s1, 2.5);
      c.strokeStyle = C.tinta; c.lineWidth = 1; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(g1.sx(semana), g1.y1); c.lineTo(g1.sx(semana), g1.y0); c.stroke(); c.setLineDash([]);
      VIZ.marcador(c, g1.sx(semana), g1.sy(100 * datos[semana].adop), C.s1);
      // Panel 2: áreas apiladas
      c = l2.ctx;
      l2.limpiar();
      const ymax = Math.max(...datos.map(totalDe), 10) * 1.08;
      g2 = VIZ.plano(l2, { xmin: 0, xmax: T, ymin: 0, ymax }, { etiquetaX: 'semana', formatoY: (v) => VIZ.entero(v) });
      g2.ejes();
      const capas = [['prod', C.s2], ['doble', C.s4], ['inc', C.s8]];
      let base = datos.map(() => 0);
      capas.forEach(([k, col]) => {
        const sup = datos.map((d, i) => base[i] + d[k]);
        c.beginPath();
        for (let i = 0; i <= semana; i++) c[i ? 'lineTo' : 'moveTo'](g2.sx(datos[i].t), g2.sy(sup[i]));
        for (let i = semana; i >= 0; i--) c.lineTo(g2.sx(datos[i].t), g2.sy(base[i]));
        c.closePath(); c.fillStyle = VIZ.alfa(col, 0.85); c.fill();
        base = sup;
      });
      c.strokeStyle = C.tinta; c.lineWidth = 1; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(g2.sx(semana), g2.y1); c.lineTo(g2.sx(semana), g2.y0); c.stroke(); c.setLineDash([]);
      const d = datos[semana];
      const todas = ESTRATEGIAS.map(([id, n]) => ({ id, n, s: simular(id, defectos, cap)[T] }));
      const mejor = todas.reduce((m, x) => (totalDe(x.s) < totalDe(m.s) ? x : m));
      const enCurso = UNIDADES.filter((u, i) => semana >= cut[i]).map((u) => u[0]);
      registro.textContent = semana === 0
        ? `Estrategia «${ESTRATEGIAS.find((e) => e[0] === est)[1]}». El sistema se construye hasta la semana ${GO}; después comienza el cambio de las unidades.`
        : semana < GO ? `Semana ${semana}: el sistema aún se prepara; nadie lo usa todavía.`
          : `Semana ${semana}: ${enCurso.length} de ${UNIDADES.length} unidades ya usan el sistema (${Math.round(100 * d.adop)} % de los usuarios). Esta semana se descubrieron ${VIZ.fmt(d.desc, 2)} defectos que afectaron a ${VIZ.entero(d.vivos)} usuarios; costo acumulado ${VIZ.entero(totalDe(d))} mil USD.`;
      lectura.set([
        ['costo acumulado', `${VIZ.entero(totalDe(d))} mil USD`],
        ['  productividad / doble / incidentes', `${VIZ.entero(d.prod)} / ${VIZ.entero(d.doble)} / ${VIZ.entero(d.inc)}`],
        ['usuarios afectados por defectos', VIZ.entero(d.afectados || 0)],
        ['costo final: ' + todas.map((x) => x.n.split(' ')[0].toLowerCase()).join(' · '), todas.map((x) => VIZ.entero(totalDe(x.s))).join(' · ')],
        ['menor costo final con estos parámetros', mejor.n.split(' (')[0]],
      ]);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    const hover = (l, tip, g) => {
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = l.posicion(ev);
        if (!g() || !datos.length || !g().dentro(x, y)) return tip.ocultar();
        const t = Math.max(0, Math.min(T, Math.round(g().ix(x)))), d = datos[t];
        tip.mostrar(x, y, `semana <b>${t}</b><br>en el sistema nuevo <b>${Math.round(100 * d.adop)} %</b>` + VIZ.filaTooltip(C.s2, 'productividad', VIZ.entero(d.prod)) + VIZ.filaTooltip(C.s4, 'doble operación', VIZ.entero(d.doble)) + VIZ.filaTooltip(C.s8, 'incidentes', VIZ.entero(d.inc)));
      });
      l.canvas.addEventListener('pointerleave', () => tip.ocultar());
    };
    hover(l1, t1, () => g1); hover(l2, t2, () => g2);
    rep.reiniciar();
  }

  /* ---------- Fig. 2: adopción y evaluación del éxito ---------- */

  const MESES = 36, PLAN = { inversion: 1000, go: 6, beneficio: 120, operacion: 15, techo: 0.9, k: 0.8 };
  const TASA_MES = 0.01;
  const adop = (t, go, techo, k) => (t < go ? 0 : techo / (1 + Math.exp(-k * (t - go - 4))));

  function flujos(go, inversion, techo, k) {
    const cuotas = Math.max(1, Math.round(go)); // la inversión se paga en los meses previos a la puesta en marcha
    return Array.from({ length: MESES + 1 }, (_, t) => (t < cuotas ? -inversion / cuotas : 0) + (t >= go ? PLAN.beneficio * adop(t, go, techo, k) - PLAN.operacion : 0));
  }

  function montarExito(cuerpo) {
    let retraso = 0.3, sobre = 0.2, techo = 0.6, vel = 0.4, sat = 3, g1 = null, filas = [], zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Retraso de la puesta en marcha', min: 0, max: 1, paso: 0.05, valor: retraso, formato: (v) => `+${Math.round(v * 100)} %`, alCambiar: (v) => { retraso = v; calcular(); } });
    ctl.rango({ etiqueta: 'Sobrecosto de la inversión', min: 0, max: 1, paso: 0.05, valor: sobre, formato: (v) => `+${Math.round(v * 100)} %`, alCambiar: (v) => { sobre = v; calcular(); } });
    ctl.rango({ etiqueta: 'Techo de adopción real', min: 0.2, max: 1, paso: 0.05, valor: techo, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { techo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Velocidad de adopción', min: 0.2, max: 1.2, paso: 0.1, valor: vel, formato: (v) => String(v), alCambiar: (v) => { vel = v; calcular(); } });
    ctl.rango({ etiqueta: 'Satisfacción de los usuarios', min: 1, max: 5, paso: 0.5, valor: sat, formato: (v) => `${v} / 5`, alCambiar: (v) => { sat = v; calcular(); } });
    VIZ.subtitulo(cuerpo, 'Uso del sistema: esperado y real (% de los usuarios)');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 160, altoMax: 230 });
    const t1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Evaluación del éxito (% de lo planificado)');
    const l2 = VIZ.lienzo(cuerpo, { altoFn: () => 6 * 38 + 18 });
    const t2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'uso esperado en el plan', forma: 'linea' }, { color: C.s1, texto: 'uso real', forma: 'linea' },
      { color: C.s6, texto: 'cumple (95 % o más)' }, { color: C.s4, texto: 'en riesgo (75 a 95 %)' }, { color: C.s8, texto: 'fracaso parcial (menos de 75 %)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El plan: inversión de 1 000 mil USD, puesta en marcha en el mes 6, 90 % de uso y 120 mil USD mensuales de beneficio pleno. Mueva los controles para construir un proyecto «a tiempo y en presupuesto» que igual fracasa, o uno atrasado que sí entrega valor. Pase el cursor sobre las barras para ver el detalle.');

    function calcular() {
      const go = PLAN.go * (1 + retraso), inv = PLAN.inversion * (1 + sobre);
      const fp = flujos(PLAN.go, PLAN.inversion, PLAN.techo, PLAN.k), fr = flujos(go, inv, techo, vel);
      const benTotal = (goX, tX, kX) => Array.from({ length: MESES + 1 }, (_, t) => PLAN.beneficio * adop(t, goX, tX, kX)).reduce((s, x) => s + x, 0);
      const bp = benTotal(PLAN.go, PLAN.techo, PLAN.k), br = benTotal(go, techo, vel);
      const vp = S.vpn(fp, TASA_MES), vr = S.vpn(fr, TASA_MES);
      const t18 = 18, ap = adop(t18, PLAN.go, PLAN.techo, PLAN.k), ar = adop(t18, go, techo, vel);
      filas = [
        { n: 'Plazo (puesta en marcha)', v: (100 * PLAN.go) / go, det: `plan: mes ${PLAN.go} · real: mes ${VIZ.fmt(go, 3)}`, leccion: 'estimar con holguras y vigilar las dependencias críticas' },
        { n: 'Presupuesto', v: (100 * PLAN.inversion) / inv, det: `plan: ${VIZ.entero(PLAN.inversion)} · real: ${VIZ.entero(inv)} mil USD`, leccion: 'controlar el alcance y reestimar en cada hito' },
        { n: 'Uso a los 18 meses', v: ap ? (100 * ar) / ap : 0, det: `esperado ${Math.round(100 * ap)} % · real ${Math.round(100 * ar)} %`, leccion: 'invertir en capacitación, patrocinio y rediseño de los procesos de trabajo' },
        { n: 'Beneficios realizados', v: (100 * br) / bp, det: `plan: ${VIZ.entero(bp)} · real: ${VIZ.entero(br)} mil USD en ${MESES} meses`, leccion: 'los beneficios no ocurren solos: asignar dueños y medirlos' },
        { n: 'Valor presente neto', v: vp > 0 ? (100 * vr) / vp : 0, det: `plan: ${VIZ.entero(vp)} · real: ${VIZ.entero(vr)} mil USD`, leccion: 'revisar el caso de negocio con los datos reales' },
        { n: 'Satisfacción', v: (100 * sat) / 4, det: `meta: 4 de 5 · real: ${sat} de 5`, leccion: 'escuchar a los usuarios y corregir la usabilidad' },
      ];
      const pr = S.recuperacion(fp), rr = S.recuperacion(fr);
      const prom = filas.reduce((s, f) => s + Math.min(100, Math.max(0, f.v)), 0) / filas.length;
      const peor = filas.reduce((m, f) => (f.v < m.v ? f : m));
      const aTiempo = filas[0].v >= 95 && filas[1].v >= 95;
      registro.textContent = `${aTiempo && filas[3].v < 75 ? 'Proyecto a tiempo y en presupuesto, pero que no entrega valor: ' : ''}el punto más débil es «${peor.n.toLowerCase()}» (${VIZ.fmt(Math.max(0, peor.v), 3)} % de lo planificado). Lección: ${peor.leccion}.`;
      lectura.set([
        ['índice de éxito (promedio, tope 100)', `${VIZ.fmt(prom, 3)} %`],
        ['VPN real (1 % mensual)', `${VIZ.entero(vr)} mil USD`],
        ['recuperación de la inversión', rr == null ? 'no en 36 meses' : `mes ${VIZ.fmt(rr, 3)} (plan: mes ${VIZ.fmt(pr, 3)})`],
        ['retorno a 36 meses (beneficio neto / inversión)', `${VIZ.fmt(100 * S.retorno(inv, fr.reduce((s, x, t) => s + (x > 0 || t >= go ? x : 0), 0) + inv), 3)} %`],
        ['dimensiones en rojo', `${filas.filter((f) => f.v < 75).length} de ${filas.length}`],
      ]);
      calcular.datos = { go, techo, vel };
      dibujar();
    }
    const colorDe = (v) => (v >= 95 ? C.s6 : v >= 75 ? C.s4 : C.s8);
    function dibujar() {
      if (!filas.length) return;
      const d = calcular.datos;
      // Curvas de uso
      let c = l1.ctx;
      l1.limpiar();
      g1 = VIZ.plano(l1, { xmin: 0, xmax: MESES, ymin: 0, ymax: 100 }, { etiquetaX: 'mes', formatoY: (v) => `${Math.round(v)} %`, ticksY: [0, 25, 50, 75, 100] });
      g1.ejes();
      const serie = (go, techo0, k) => Array.from({ length: MESES + 1 }, (_, t) => [t, 100 * adop(t, go, techo0, k)]);
      VIZ.trazar(c, g1, serie(PLAN.go, PLAN.techo, PLAN.k), C.apagado, 2, [6, 4]);
      VIZ.trazar(c, g1, serie(d.go, d.techo, d.vel), C.s1, 2.5);
      // Barras de evaluación
      c = l2.ctx;
      l2.limpiar();
      const { ancho: W } = l2;
      const x0 = W < 520 ? 118 : 190, x1 = W - 56, max = 150, esc = (x1 - x0) / max;
      zonas = [];
      c.textBaseline = 'middle';
      filas.forEach((f, i) => {
        const y = 8 + i * 38, v = Math.max(0, Math.min(max, f.v));
        c.font = VIZ.fuente(11, 500); c.fillStyle = C.tinta2; c.textAlign = 'left';
        const partes = f.n.split(' ');
        if (W < 520 && partes.length > 1) { c.fillText(partes.slice(0, Math.ceil(partes.length / 2)).join(' '), 4, y + 7); c.fillText(partes.slice(Math.ceil(partes.length / 2)).join(' '), 4, y + 21); } else c.fillText(f.n, 4, y + 14);
        c.fillStyle = colorDe(f.v);
        c.beginPath(); c.roundRect(x0, y + 2, Math.max(1, v * esc), 24, [0, 4, 4, 0]); c.fill();
        c.fillStyle = C.tinta; c.font = VIZ.fuente(12, 600); c.textAlign = 'left';
        c.fillText(`${VIZ.fmt(f.v, 3)} %`, x0 + Math.max(1, v * esc) + 6, y + 14);
        zonas.push([y, y + 34]);
      });
      c.strokeStyle = C.tinta; c.lineWidth = 1.5; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(x0 + 100 * esc, 2); c.lineTo(x0 + 100 * esc, filas.length * 38 + 6); c.stroke(); c.setLineDash([]);
      c.font = VIZ.fuente(10); c.fillStyle = C.tinta2; c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText('plan = 100 %', x0 + 100 * esc, filas.length * 38 + 6);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!g1 || !g1.dentro(x, y)) return t1.ocultar();
      const t = Math.max(0, Math.min(MESES, Math.round(g1.ix(x)))), d = calcular.datos;
      t1.mostrar(x, y, `mes <b>${t}</b>` + VIZ.filaTooltip(C.apagado, 'esperado', `${VIZ.fmt(100 * adop(t, PLAN.go, PLAN.techo, PLAN.k), 3)} %`) + VIZ.filaTooltip(C.s1, 'real', `${VIZ.fmt(100 * adop(t, d.go, d.techo, d.vel), 3)} %`));
    });
    l1.canvas.addEventListener('pointerleave', () => t1.ocultar());
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev);
      const i = zonas.findIndex(([a, b]) => y >= a && y < b);
      if (i < 0) return t2.ocultar();
      const f = filas[i];
      t2.mostrar(x, y, `<b>${f.n}</b><br>${f.det}<br>${VIZ.fmt(f.v, 3)} % de lo planificado`);
    });
    l2.canvas.addEventListener('pointerleave', () => t2.ocultar());
    calcular();
  }

  VIZ.registrarTema('adoption-success-evaluation', {
    intro: String.raw`
      <p>Un sistema de información no crea valor al instalarse, sino cuando las personas lo usan para trabajar distinto. Por eso la <strong>implementación</strong> es una decisión de gestión: cambiar todo de golpe (<em>big bang</em>),
      operar los dos sistemas en <em>paralelo</em>, probar con un <em>piloto</em> o avanzar <em>por fases</em> reparte de modo distinto el riesgo, el costo y el esfuerzo de aprendizaje de la organización.</p>
      <p>Después de la puesta en marcha hay que evaluar el éxito con varios criterios a la vez: plazo, presupuesto, <em>uso real</em> frente al esperado, beneficios efectivamente obtenidos y satisfacción. Un proyecto puede cumplir plazo y
      presupuesto y aun así fracasar si nadie adopta la tecnología. Las figuras simulan una implementación y el cuadro de evaluación del resultado.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuatro estrategias de implementación',
        descripcion: 'Reproduzca la implementación de un sistema en ocho unidades. Compare big bang, paralelo, piloto y por fases: suba los defectos latentes y vea cómo el big bang concentra el costo en incidentes, mientras el paralelo paga doble operación.',
        montar: montarEstrategias,
      },
      {
        titulo: 'Adopción y evaluación del éxito',
        descripcion: 'Baje el techo de adopción manteniendo plazo y presupuesto: las barras de plazo y costo siguen verdes pero el uso, los beneficios y el VPN se ponen rojos. Luego pruebe un proyecto atrasado con alta adopción.',
        montar: montarExito,
      },
    ],
    teoria: String.raw`
      <h2>Estrategias de implementación</h2>
      <table>
        <tr><th>Estrategia</th><th>Cómo es</th><th>Ventaja</th><th>Riesgo o costo</th></tr>
        <tr><td>Big bang</td><td>todos pasan al sistema nuevo en una fecha</td><td>rápida, sin interfaces entre sistemas</td><td>todo el negocio expuesto a los defectos</td></tr>
        <tr><td>Paralelo</td><td>ambos sistemas funcionan y se comparan resultados</td><td>se puede volver atrás</td><td>doble trabajo; los usuarios dejan de lado el sistema nuevo</td></tr>
        <tr><td>Piloto</td><td>una unidad lo usa primero</td><td>aprendizaje con poco daño</td><td>el piloto puede no representar a los demás</td></tr>
        <tr><td>Por fases</td><td>grupos de unidades o módulos, uno tras otro</td><td>riesgo y capacitación repartidos</td><td>convivencia prolongada de sistemas</td></tr>
      </table>
      <h2>Modelo de la simulación</h2>
      <p>Con \(V_t\) usuarios en el sistema nuevo de un total \(U\) y \(D_t\) defectos latentes, se descubre cada semana la fracción \(1-e^{-1{,}1\sqrt{V_t/U}}\) de los restantes (los usuarios que están en producción los exponen, y un grupo pequeño de usuarios intensivos descubre
      proporcionalmente más). Cada defecto descubierto afecta a los \(V_t\) usuarios, a razón de 0,15 mil USD por usuario afectado (0,2 de eso si aún se opera en paralelo). Además, cada unidad pierde productividad tras el cambio:</p>
      \[ \text{pérdida}_i(t) = n_i\,c\,d_0\,e^{-(t-s_i)/\tau}, \qquad d_0 = 0{,}35\,(1 - 0{,}7\,\text{capacitación}), \quad \tau = 3\ \text{semanas}, \]
      <p>con \(n_i\) usuarios, \(c = 0{,}8\) mil USD por usuario-semana y \(s_i\) la semana de cambio. La operación en paralelo agrega 25 % de trabajo duplicado.</p>
      <h2>Adopción y éxito</h2>
      <p>La <em>adopción</em> depende de la utilidad percibida y la facilidad de uso (modelo de aceptación tecnológica) y, en la práctica, de la capacitación, el apoyo de la jefatura y de que el trabajo se rediseñe en torno al sistema. Se modela como una curva logística con techo \(L\) y velocidad \(k\):</p>
      \[ a(t) = \frac{L}{1 + e^{-k\,(t - t_0 - 4)}}, \qquad \text{beneficio}(t) = B\,a(t), \]
      <p>con \(t_0\) el mes de puesta en marcha y \(B\) el beneficio mensual a uso pleno. El éxito se evalúa contra el plan en varias dimensiones: plazo, costo, beneficios realizados, valor presente neto (\(\text{VPN}=\sum_t F_t/(1+i)^t\)) y satisfacción. Ninguna sola basta.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Plan: inversión de 1 000 mil USD, puesta en marcha en el mes 6, 90 % de uso y 120 mil USD de beneficio mensual a uso pleno, con 15 mil de operación. Un proyecto que se atrasa 30 % (mes 7,8) y se pasa del presupuesto en 20 % (1 200 mil) saca 77 % en plazo y 83 % en presupuesto.
      Si además el uso se estanca en 60 % y crece despacio (velocidad 0,4), el beneficio mensual máximo baja de 108 a 72 mil USD: el VPN a 36 meses, que en el plan es de unos 922 mil USD, pasa a unos −129 mil aunque el sistema «funcione». La causa no es técnica: es adopción.</p>
      <div class="recuadro"><p><strong>Lecciones aprendidas.</strong> Al cierre se documenta qué se esperaba, qué ocurrió y por qué. Los patrones frecuentes son: estimaciones optimistas (plazo y costo), falta de dueño de los beneficios, capacitación tardía y pruebas con datos que no representan la operación.
      Una revisión posterior a la implementación a los 6 o 12 meses compara los beneficios reales con los del caso de negocio.</p></div>
      <h2>Conexiones</h2>
      <p>La eficacia del cambio depende de la <a href="tema.html?id=change-management">gestión del cambio</a>. Los beneficios esperados se justifican en el <a href="tema.html?id=business-case">caso de negocio</a> y las
      <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>; los criterios de éxito son los de <a href="tema.html?id=triple-constraint">alcance, tiempo, costo y calidad</a>. La elección previa del sistema se vio en
      <a href="tema.html?id=buy-vs-build">comprar o construir</a>, y la medición posterior del impacto en <a href="tema.html?id=project-impact-measurement">impacto de proyectos tecnológicos</a>.</p>`,
  });
})();
