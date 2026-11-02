(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos compartidos ---------- */

  const TODOS = Object.values(P.personas).flat();
  const ROLES = Object.keys(P.personas);
  const ROL_DE = {};
  for (const [r, ps] of Object.entries(P.personas)) ps.forEach((p) => { ROL_DE[p] = r; });
  const COLOR_ROL = { ventas: C.s1, bodega: C.s2, finanzas: C.s3, soporte: C.s4, gerencia: C.s5 };
  const PROCESOS = [['pedidos', 'Gestión de pedidos'], ['reclamos', 'Atención de reclamos']];
  const EXTRAS = ['Marta', 'Nico', 'Olga', 'Pablo', 'Rosa']; // refuerzos para el rol clave de la figura 2

  function especializacion(cuentas) {
    const tot = cuentas.reduce((s, v) => s + v, 0), K = cuentas.length;
    if (K <= 1 || !tot) return 1;
    let H = 0;
    for (const v of cuentas) if (v > 0) H -= (v / tot) * Math.log2(v / tot);
    return 1 - H / Math.log2(K);
  }
  const pct = (v) => `${VIZ.fmt(100 * v, 3)} %`;

  /* ---------- Fig. 1: carga y utilización por persona ---------- */

  const METRICAS = {
    eventos: { nombre: 'Eventos ejecutados', fmt: (v) => VIZ.entero(v) },
    minutos: { nombre: 'Minutos de trabajo', fmt: (v) => `${VIZ.entero(v)} min` },
    util: { nombre: 'Utilización', fmt: (v) => pct(v) },
    espec: { nombre: 'Especialización', fmt: (v) => VIZ.fmt(v, 3) },
  };

  function montarCarga(cuerpo) {
    let proc = 'pedidos', lambda = 2.4, poliv = 0.1, semilla = 1, metrica = 'util', ordenar = false, sel = -1, hover = -1;
    let R = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; sel = -1; calcular(); } });
    ctl.rango({ etiqueta: 'Casos que llegan por hora', min: 0.6, max: 6, paso: 0.2, valor: lambda, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { lambda = v; calcular(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; calcular(); } });
    ctl.selector({ etiqueta: 'Medida', opciones: Object.entries(METRICAS).map(([k, m]) => [k, m.nombre]), valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Ordenar de mayor a menor', valor: ordenar, alCambiar: (v) => { ordenar = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const FILA = 28, SUP = 8, INF = 30, IZQ = 84, DER = 82;
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => SUP + INF + FILA * (R ? R.filas.length : 7) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...ROLES.map((r) => ({ color: COLOR_ROL[r], texto: `rol ${r}` })),
      { color: C.apagado, texto: 'referencia (media o límite de utilización)', forma: 'linea' },
    ]);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una barra para ver el perfil de actividades de esa persona. La utilización es el tiempo ocupado dividido por el tiempo observado; por encima de 100 % la carga no cabe en una persona.');

    function calcular() {
      const log = P.simular(P.procesos[proc].arbol, 200, semilla, { llegada: 60 / lambda });
      const rnd = VIZ.semilla(semilla * 97 + 5);
      for (const c of log) for (const e of c.eventos) if (rnd() < poliv) e.recurso = TODOS[Math.floor(rnd() * TODOS.length)];
      const t0 = Math.min(...log.map((c) => c.eventos[0].ini)), t1 = Math.max(...log.map((c) => c.eventos[c.eventos.length - 1].fin));
      const acts = P.actividades(log), horizonte = t1 - t0;
      const filas = TODOS.filter((p) => log.some((c) => c.eventos.some((e) => e.recurso === p))).map((p) => {
        const evs = log.flatMap((c) => c.eventos.filter((e) => e.recurso === p));
        const cuentas = acts.map((a) => evs.filter((e) => e.act === a).length);
        const minutos = evs.reduce((s, e) => s + (e.fin - e.ini), 0);
        return { p, eventos: evs.length, minutos, util: minutos / horizonte, espec: especializacion(cuentas), acts: acts.map((a, i) => [a, cuentas[i]]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) };
      });
      R = { filas, horizonte, t0, t1, casos: log.length };
      lienzo.ajustar(true);
    }

    function dibujar() {
      if (!R) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const filas = R.filas.map((f, i) => ({ ...f, i }));
      if (ordenar) filas.sort((a, b) => b[metrica] - a[metrica]);
      const vals = R.filas.map((f) => f[metrica]);
      const mx = metrica === 'util' ? Math.max(1.1, ...vals) * 1.05 : metrica === 'espec' ? 1 : Math.max(...vals) * 1.1;
      const x0 = IZQ, x1 = W - DER, px = (v) => x0 + (v / mx) * (x1 - x0);
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = C.rejilla; ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.lineWidth = 1;
      const ticks = metrica === 'util' ? [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= mx) : VIZ.ticks(0, mx, 4);
      for (const t of ticks) {
        ctx.beginPath(); ctx.moveTo(px(t) + 0.5, SUP); ctx.lineTo(px(t) + 0.5, H - INF); ctx.stroke();
        ctx.fillText(metrica === 'util' ? `${Math.round(t * 100)} %` : VIZ.fmt(t, 3), px(t), H - INF + 12);
      }
      filas.forEach((f, k) => {
        const y = SUP + k * FILA, v = f[metrica];
        ctx.fillStyle = COLOR_ROL[ROL_DE[f.p]];
        ctx.fillRect(4, y + FILA / 2 - 5, 10, 10);
        ctx.font = VIZ.fuente(11, f.i === sel ? 700 : 500); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(f.p, 20, y + FILA / 2);
        const alfa = f.i === hover || f.i === sel ? 1 : 0.85;
        ctx.fillStyle = VIZ.alfa(COLOR_ROL[ROL_DE[f.p]], alfa);
        ctx.beginPath(); ctx.roundRect(x0, y + 4, Math.max(1, px(v) - x0), FILA - 8, [0, 4, 4, 0]); ctx.fill();
        if (f.i === sel) { ctx.lineWidth = 2; ctx.strokeStyle = C.tinta; ctx.stroke(); }
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = metrica === 'util' && v > 1 ? C.s8 : C.tinta2; ctx.textAlign = 'left';
        ctx.fillText(METRICAS[metrica].fmt(v), Math.min(px(v) + 5, W - DER + 4), y + FILA / 2);
      });
      const ref = metrica === 'util' ? [[0.8, 'límite 80 %'], [1, '100 %']] : [[vals.reduce((s, v) => s + v, 0) / vals.length, 'media']];
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ref.forEach(([v, t], q) => {
        if (v > mx) return;
        ctx.beginPath(); ctx.moveTo(px(v), SUP); ctx.lineTo(px(v), H - INF); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(t, px(v), H - 4 - (q ? 0 : 0));
        ctx.textBaseline = 'middle'; ctx.setLineDash([3, 4]);
      });
      ctx.setLineDash([]); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      const u = R.filas.map((f) => f.util), kM = u.indexOf(Math.max(...u));
      const media = u.reduce((s, v) => s + v, 0) / u.length;
      lectura.set([
        ['casos / tiempo observado', `${R.casos} / ${P.dur(R.horizonte)}`],
        ['utilización media', pct(media)],
        ['más cargada', `${R.filas[kM].p} (${pct(u[kM])})`],
        ['desigualdad (máx. / media)', VIZ.fmt(u[kM] / media, 3)],
        ['personas sobre el 80 %', `${u.filter((v) => v > 0.8).length} de ${u.length}`],
      ]);
      fichas.replaceChildren(...(sel >= 0 ? [VIZ.el('span', { class: 'fichas-titulo' }, `${R.filas[sel].p}:`), ...R.filas[sel].acts.map(([a, v]) => VIZ.ficha(`${a} ${v} (${Math.round(100 * v / R.filas[sel].eventos)} %)`, { color: COLOR_ROL[ROL_DE[R.filas[sel].p]] }))] : [VIZ.el('span', { class: 'fichas-vacio' }, 'Haga clic en una barra para ver las actividades de la persona.')]));
      registro.textContent = sel >= 0
        ? `${R.filas[sel].p}: ${R.filas[sel].eventos} eventos, ${P.dur(R.filas[sel].minutos)} de trabajo, utilización ${pct(R.filas[sel].util)}, especialización ${VIZ.fmt(R.filas[sel].espec, 3)}.`
        : (u.some((v) => v > 1) ? 'Hay personas con más de 100 % de utilización: en la práctica el trabajo se acumula o se hace fuera del registro.' : 'La carga se mide con los datos del registro: eventos, minutos ocupados y proporción del tiempo observado.');
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    const filaEn = (y) => {
      const k = Math.floor((y - SUP) / FILA);
      if (k < 0 || k >= R.filas.length) return -1;
      const filas = R.filas.map((f, i) => ({ v: f[metrica], i }));
      if (ordenar) filas.sort((a, b) => b.v - a.v);
      return filas[k].i;
    };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!R) return;
      const { x, y } = lienzo.posicion(ev), i = filaEn(y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const f = R.filas[i];
      tip.mostrar(x, y, `<b>${f.p}</b> · ${ROL_DE[f.p]}` + VIZ.filaTooltip(COLOR_ROL[ROL_DE[f.p]], 'eventos', VIZ.entero(f.eventos)) + VIZ.filaTooltip(COLOR_ROL[ROL_DE[f.p]], 'tiempo ocupado', P.dur(f.minutos)) + VIZ.filaTooltip(COLOR_ROL[ROL_DE[f.p]], 'utilización', pct(f.util)) + VIZ.filaTooltip(COLOR_ROL[ROL_DE[f.p]], 'especialización', VIZ.fmt(f.espec, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (R) dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const i = filaEn(lienzo.posicion(ev).y);
      sel = i >= 0 && i !== sel ? i : -1;
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 2: colas por persona ---------- */

  // Simulación de colas: cada actividad pide una persona de su rol y espera si está ocupada.
  function simularCola(proc, nCasos, semilla, lambda, politica, k) {
    const log = P.simular(P.procesos[proc].arbol, nCasos, semilla, { espera: 0, llegada: 60 / lambda });
    const clave = proc === 'pedidos' ? 'bodega' : 'soporte';
    const usados = new Set(log.flatMap((c) => c.eventos.map((e) => e.rol)));
    const pools = {};
    for (const r of ROLES) pools[r] = P.personas[r].slice();
    pools[clave] = P.personas[clave].concat(EXTRAS).slice(0, k);
    const pers = [];
    for (const r of ROLES) if (usados.has(r)) for (const p of pools[r]) pers.push({ nombre: p, rol: r });
    const libre = {};
    pers.forEach((q) => { libre[q.nombre] = 0; });
    const rnd = VIZ.semilla(semilla * 31 + 7);
    const est = log.map((c) => ({ c, k: 0, ready: c.eventos[0].ini }));
    const total = log.reduce((s, c) => s + c.eventos.length, 0);
    const tareas = [];
    for (let h = 0; h < total; h++) {
      let b = -1;
      for (let i = 0; i < est.length; i++) if (est[i].k < est[i].c.eventos.length && (b < 0 || est[i].ready < est[b].ready)) b = i;
      const e = est[b], ev = e.c.eventos[e.k], pool = pools[ev.rol];
      let p;
      if (politica === 'libre') p = pool.reduce((m, x) => (libre[x] < libre[m] ? x : m), pool[0]);
      else if (politica === 'azar' || pool.length === 1) p = pool[Math.floor(rnd() * pool.length)];
      else p = rnd() < 0.5 ? pool[0] : pool[1 + Math.floor(rnd() * (pool.length - 1))];
      const ini = Math.max(e.ready, libre[p]), fin = ini + (ev.fin - ev.ini);
      libre[p] = fin;
      tareas.push({ p, caso: e.c.id, act: ev.act, ready: e.ready, start: ini, fin });
      e.ready = fin; e.k++;
    }
    const t0 = Math.min(...tareas.map((t) => t.ready)), t1 = Math.max(...tareas.map((t) => t.fin));
    const stats = pers.map((q) => {
      const ts = tareas.filter((t) => t.p === q.nombre);
      const esperas = ts.map((t) => t.start - t.ready);
      let pico = 0;
      for (const t of ts) { const en = ts.filter((u) => u.ready <= t.ready && t.ready < u.start).length; pico = Math.max(pico, en); }
      return { ...q, n: ts.length, util: ts.reduce((s, t) => s + t.fin - t.start, 0) / (t1 - t0), espera: P.media(esperas), pico };
    });
    return { pers, tareas, t0, t1, stats, clave };
  }

  function montarCola(cuerpo) {
    let proc = 'pedidos', lambda = 3, politica = 'sesgada', k = 3, semilla = 1, S = null, t = 0, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; lambdaC.valor = v === 'pedidos' ? 3 : 1.6; lambda = lambdaC.valor; k = P.personas[v === 'pedidos' ? 'bodega' : 'soporte'].length; kC.valor = k; rep.reiniciar(); } });
    const lambdaC = ctl.rango({ etiqueta: 'Casos que llegan por hora', min: 0.8, max: 6, paso: 0.2, valor: lambda, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { lambda = v; rep.reiniciar(); } });
    const kC = ctl.rango({ etiqueta: 'Personas en el rol clave (bodega o soporte)', min: 1, max: 5, valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Asignación del trabajo', opciones: [['sesgada', 'Sesgada: todos piden a la primera persona'], ['azar', 'Al azar entre el equipo'], ['libre', 'A quien quedaría libre antes']], valor: politica, alCambiar: (v) => { politica = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const FILA = 30, SUP = 6, IZQ = 112, DER = 70;
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => SUP * 2 + FILA * (S ? S.pers.length : 7) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'trabajando', forma: 'punto' },
      { color: C.inactivo, texto: 'libre', forma: 'punto' },
      { color: C.s4, texto: 'casos esperando a esta persona' },
      { color: C.s8, texto: 'cola máxima de toda la simulación', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso avanza el reloj de la simulación. Cada cuadro amarillo es un caso esperando a esa persona. Pase el cursor sobre una fila para ver su utilización y su espera media.');

    function iniciar() {
      S = simularCola(proc, 160, semilla, lambda, politica, k);
      t = S.t0;
      lienzo.ajustar(true);
      const NS = 90;
      return (function* () {
        for (let s = 1; s <= NS; s++) { t = S.t0 + ((S.t1 - S.t0) * s) / NS; yield; }
      })();
    }

    function dibujar() {
      if (!S) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const picoG = Math.max(1, ...S.stats.map((q) => q.pico));
      const unidad = Math.min(16, (W - IZQ - DER - 8) / picoG);
      const cola = S.pers.map((q) => S.tareas.filter((u) => u.p === q.nombre && u.ready <= t && t < u.start).length);
      const ocupado = S.pers.map((q) => S.tareas.some((u) => u.p === q.nombre && u.start <= t && t < u.fin));
      ctx.textBaseline = 'middle';
      S.pers.forEach((q, i) => {
        const y = SUP + i * FILA, cy = y + FILA / 2;
        if (i === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y, W, FILA); }
        ctx.fillStyle = COLOR_ROL[q.rol]; ctx.fillRect(4, cy - 5, 10, 10);
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(q.nombre, 20, cy);
        ctx.fillStyle = ocupado[i] ? C.s1 : C.inactivo;
        ctx.beginPath(); ctx.arc(IZQ - 18, cy, 6, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = C.s4;
        for (let j = 0; j < cola[i]; j++) ctx.fillRect(IZQ + j * unidad, cy - 8, Math.max(2, unidad - 2), 16);
        const pk = IZQ + S.stats[i].pico * unidad;
        ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(pk, cy - 11); ctx.lineTo(pk, cy + 11); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'right';
        ctx.fillText(`${cola[i]} en cola`, W - 4, cy);
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      const esperas = S.tareas.map((u) => u.start - u.ready);
      const peor = S.stats.reduce((m, q) => (q.espera > m.espera ? q : m), S.stats[0]);
      const util = S.stats.reduce((m, q) => (q.util > m.util ? q : m), S.stats[0]);
      lectura.set([
        ['tiempo simulado', P.dur(t - S.t0)],
        ['casos en cola ahora', String(cola.reduce((s, v) => s + v, 0))],
        ['espera media por actividad', P.dur(P.media(esperas))],
        ['cuello de botella (mayor espera)', `${peor.nombre}: ${P.dur(peor.espera)}`],
        ['mayor utilización', `${util.nombre}: ${pct(util.util)}`],
      ]);
      const fin = t >= S.t1 - 1e-9;
      registro.textContent = fin
        ? `Fin de la simulación: la espera media de ${peor.nombre} (${P.dur(peor.espera)}) es ${peor.espera > 0 && P.media(esperas) > 0 ? VIZ.fmt(peor.espera / P.media(esperas), 2) : '—'} veces la media general.`
        : `Reloj en ${P.dur(t - S.t0)}: ${ocupado.filter(Boolean).length} de ${S.pers.length} personas trabajan y ${cola.reduce((s, v) => s + v, 0)} casos esperan.`;
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!S) return;
      const { x, y } = lienzo.posicion(ev), i = Math.floor((y - SUP) / FILA);
      const h = i >= 0 && i < S.pers.length ? i : -1;
      if (h !== hover) { hover = h; dibujar(); }
      if (h < 0) return tip.ocultar();
      const q = S.stats[h];
      tip.mostrar(x, y, `<b>${q.nombre}</b> · ${q.rol}` + VIZ.filaTooltip(C.s1, 'actividades atendidas', String(q.n)) + VIZ.filaTooltip(C.s1, 'utilización', pct(q.util)) + VIZ.filaTooltip(C.s4, 'espera media', P.dur(q.espera)) + VIZ.filaTooltip(C.s8, 'cola máxima', String(q.pico)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (S) dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('resource-workload', {
    intro: String.raw`
      <p>Saber quién hace qué no basta: también importa <strong>cuánto</strong> hace cada persona. La <strong>carga de trabajo</strong> cuenta eventos y minutos por
      recurso; la <strong>utilización</strong> la compara con el tiempo disponible. Cuando una persona trabaja cerca del 100 % de su tiempo, cualquier variación
      forma una cola, y los casos esperan a esa persona aunque haya otras libres: es un <strong>cuello de botella organizacional</strong>.</p>
      <p>La causa suele ser la forma de asignar el trabajo (todos piden a quien conocen) más que la falta de gente. Por eso se mide la desigualdad de carga y se prueban
      redistribuciones antes de contratar.</p>`,
    visualizaciones: [
      {
        titulo: 'Carga, utilización y especialización',
        descripcion: 'Barras por persona, coloreadas por rol. Suba los casos por hora hasta que alguien supere el 100 % y cambie a «Especialización»; haga clic en una barra para ver su perfil de actividades.',
        montar: montarCarga,
      },
      {
        titulo: 'Colas y efecto de redistribuir',
        descripcion: 'Simulación de colas por persona. Con asignación sesgada se forma una cola frente a una sola persona aunque el equipo tenga holgura; pruebe «A quien quedaría libre antes» o agregue gente y compare esperas.',
        montar: montarCola,
      },
    ],
    teoria: String.raw`
      <h2>Medidas de carga</h2>
      <p>Para la persona \(r\) con eventos \(E_r\), cada uno con inicio \(s_e\) y fin \(f_e\), y un horizonte de observación \(T\):</p>
      \[ \text{eventos}_r = |E_r|, \qquad \text{trabajo}_r = \sum_{e \in E_r} (f_e - s_e), \qquad u_r = \frac{\text{trabajo}_r}{T}. \]
      <p>La utilización \(u_r\) es el porcentaje de tiempo ocupado. Con \(u_r &gt; 1\) la persona no puede haber hecho todo secuencialmente (trabajó fuera del registro o con
      varios casos a la vez). Para el perfil de actividades se usa la <a href="tema.html?id=organizational-perspective">especialización por entropía</a>.</p>
      <h2>Por qué aparecen las colas</h2>
      <p>En una cola de un servidor con llegadas aleatorias a tasa \(\lambda\) y servicio medio \(1/\mu\), la utilización es \(\rho = \lambda/\mu\). Para el modelo M/M/1 el tiempo medio de espera antes de ser atendido es</p>
      \[ W_q = \frac{\rho}{\mu\,(1-\rho)}, \]
      <p>que crece sin límite cuando \(\rho \to 1\): al pasar de 50 % a 90 % de utilización la espera se multiplica por 9. Este es el origen de la regla práctica de no
      planificar por encima de 80 %. Con \(c\) servidores y una cola común (la persona libre toma el siguiente caso) la espera cae mucho; con colas separadas por persona (asignación
      sesgada) un servidor puede saturarse mientras los demás están ociosos.</p>
      <h2>Simulación utilizada</h2>
      <pre><code>mientras queden actividades pendientes:
    tomar la actividad lista más antigua (caso c, rol ρ, duración d)
    elegir persona p del rol ρ según la política
    inicio ← máx(instante en que está lista, instante en que p queda libre)
    espera ← inicio − instante en que está lista
    libre[p] ← inicio + d;  la actividad siguiente de c queda lista en ese instante</code></pre>
      <p>Las políticas comparadas son: sesgada (la mitad del trabajo va a la primera persona), al azar entre el equipo, y a quien quedaría libre antes.</p>
      <div class="recuadro"><p><strong>Cuidado al interpretar.</strong> Un registro de eventos solo ve el trabajo registrado: la utilización real incluye correo, reuniones y
      otras tareas. Úsela para comparar personas y escenarios, no como medida absoluta.</p></div>
      <h2>Conexiones</h2>
      <p>La misma idea de espera y servicio por actividad se estudia en <a href="tema.html?id=waiting-and-service-time">tiempos de espera y de servicio</a> y en
      <a href="tema.html?id=bottleneck-analysis">análisis de cuellos de botella</a>. La estructura social del traspaso está en
      <a href="tema.html?id=handover-of-work">traspaso de trabajo</a>, y las personas críticas de la red en
      <a href="tema.html?id=social-network-centrality">centralidad</a>.</p>`,
  });
})();
