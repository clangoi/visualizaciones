(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: el pipeline ---------- */

  const ETAPAS = [['Build'], ['Pruebas', 'unitarias'], ['Pruebas', 'integración'], ['Pruebas', 'aceptación'], ['Despliegue']];
  const TIPOS = ['error de compilación', 'defecto de lógica', 'defecto de integración', 'defecto de rendimiento o de uso'];
  // Probabilidad de que la etapa e detecte un defecto de tipo t, con cobertura de pruebas automáticas cob (0..1).
  function deteccion(e, t, cob) {
    if (e === 0) return t === 0 ? 1 : 0;
    if (e === 1) return t === 1 ? 0.85 * cob : 0;
    if (e === 2) return t === 2 ? 0.85 * cob : t === 1 ? 0.4 * cob : 0;
    if (e === 3) return t === 3 ? 0.7 * cob : t === 1 || t === 2 ? 0.3 * cob : 0;
    return 0;
  }
  const COMMITS = 30;

  function montarPipeline(cuerpo) {
    let semilla = 1, pDef = 0.3, cob = 0.6, commits = [], actual = -1, etapaAct = -1, msg = '', detenidos = [0, 0, 0, 0, 0], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Commits con defecto', min: 0.05, max: 0.6, paso: 0.05, valor: pDef, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pDef = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Cobertura de pruebas automáticas', min: 0, max: 1, paso: 0.1, valor: cob, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { cob = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Nuevos commits', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 150 + Math.ceil(COMMITS / Math.max(1, Math.floor(w / 21))) * 21 + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'commit que se evalúa' }, { color: C.s6, texto: 'desplegado sin defectos' },
      { color: C.s4, texto: 'detenido por el pipeline (defecto atrapado)' }, { color: C.s8, texto: 'desplegado con defecto (falla en producción)' },
      { color: C.inactivo, texto: 'aún no procesado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso evalúa un commit en una etapa. Con cobertura baja los defectos se escapan hasta producción; con cobertura alta casi todos se detienen antes. Pase el cursor sobre un commit para ver su historia.');

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 17 + 5);
      commits = Array.from({ length: COMMITS }, (_, i) => {
        const defecto = rnd() < pDef, r = rnd();
        const tipo = !defecto ? -1 : r < 0.15 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
        return { i, defecto, tipo, u: [rnd(), rnd(), rnd(), rnd()], res: null, etapa: -1, pasa: -1 };
      });
      actual = -1; etapaAct = -1; detenidos = [0, 0, 0, 0, 0];
      msg = `${COMMITS} commits esperan entrar al pipeline; cerca de ${Math.round(pDef * 100)} % traen algún defecto.`;
      return (function* () {
        for (const c of commits) {
          actual = c.i;
          for (let e = 0; e < ETAPAS.length; e++) {
            etapaAct = e; c.pasa = e;
            if (c.defecto && c.u[e] < deteccion(e, c.tipo, cob)) {
              c.res = 'detenido'; c.etapa = e; detenidos[e]++;
              msg = `Commit ${c.i + 1}: la etapa «${ETAPAS[e].join(' ')}» detecta un ${TIPOS[c.tipo]} y detiene el pipeline; el desarrollador lo corrige en minutos.`;
              yield; break;
            }
            if (e === ETAPAS.length - 1) {
              c.res = c.defecto ? 'falla' : 'ok';
              msg = c.defecto ? `Commit ${c.i + 1}: pasó todas las etapas con un ${TIPOS[c.tipo]} sin detectar; se despliega y falla en producción.` : `Commit ${c.i + 1}: sin defectos, se despliega a producción.`;
            } else msg = `Commit ${c.i + 1}: «${ETAPAS[e].join(' ')}» superada.`;
            yield;
          }
        }
        actual = -1; etapaAct = -1;
        msg = 'Todos los commits fueron procesados.';
      })();
    }
    function dibujar() {
      if (!commits.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const n = ETAPAS.length, gap = 14, bw = (W - 8 - gap * (n - 1)) / n, y0 = 14, bh = 62;
      const maxch = Math.max(...ETAPAS.flat().map((s) => s.length));
      const fpx = Math.max(8, Math.min(11, Math.floor(bw / (maxch * 0.62))));
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ETAPAS.forEach((nom, e) => {
        const x = 4 + e * (bw + gap), act = e === etapaAct && actual >= 0;
        ctx.fillStyle = act ? VIZ.alfa(C.s1, 0.15) : C.fondo2; ctx.fillRect(x, y0, bw, bh);
        ctx.strokeStyle = act ? C.s1 : C.eje; ctx.lineWidth = act ? 2.5 : 1.5; ctx.strokeRect(x + 1, y0 + 1, bw - 2, bh - 2);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(fpx, 600);
        nom.forEach((l, k) => ctx.fillText(l, x + bw / 2, y0 + 16 + k * (fpx + 4)));
        ctx.fillStyle = e === n - 1 ? C.tinta2 : detenidos[e] ? C.s4 : C.apagado; ctx.font = VIZ.fuente(11, 600);
        ctx.fillText(e === n - 1 ? `${commits.filter((c) => c.res === 'ok' || c.res === 'falla').length} desplegados` : `${detenidos[e]} detenidos`, x + bw / 2, y0 + bh + 14);
        if (e < n - 1) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + bw + 2, y0 + bh / 2); ctx.lineTo(x + bw + gap - 2, y0 + bh / 2); ctx.stroke();
        }
      });
      // Tira de commits
      const cs = 17, pad = 4, cols = Math.max(1, Math.floor((W - 8) / (cs + pad))), y1 = y0 + bh + 40;
      geo = { cs, pad, cols, y1 };
      ctx.font = VIZ.fuente(9, 600);
      commits.forEach((c) => {
        const x = 4 + (c.i % cols) * (cs + pad), y = y1 + Math.floor(c.i / cols) * (cs + pad);
        const col = c.res === 'ok' ? C.s6 : c.res === 'falla' ? C.s8 : c.res === 'detenido' ? C.s4 : c.i === actual ? C.s1 : C.inactivo;
        ctx.fillStyle = col; ctx.fillRect(x, y, cs, cs);
        if (c.i === actual) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, cs + 2, cs + 2); }
        ctx.fillStyle = c.res === 'detenido' ? C.tinta : C.sobre; ctx.textAlign = 'center';
        ctx.fillText(String(c.i + 1), x + cs / 2, y + cs / 2 + 0.5);
      });
      const act = commits[actual];
      if (act && etapaAct >= 0) {
        const x = 4 + etapaAct * (bw + gap) + bw / 2;
        VIZ.marcador(ctx, x, y0 + bh - 12, C.s1, 6);
      }
      registro.textContent = msg;
      const desp = commits.filter((c) => c.res === 'ok' || c.res === 'falla'), fallas = commits.filter((c) => c.res === 'falla').length;
      const defTot = commits.filter((c) => c.defecto && c.res).length, atr = detenidos.reduce((s, v) => s + v, 0);
      lectura.set([
        ['commits procesados', `${commits.filter((c) => c.res).length} de ${COMMITS}`],
        ['frecuencia de despliegue', `${desp.length} de ${COMMITS} commits llegan a producción`],
        ['defectos atrapados antes de producción', `${atr} de ${defTot}`],
        ['tasa de falla de cambios', desp.length ? `${VIZ.fmt((100 * fallas) / desp.length, 3)} %` : '—'],
        ['fallas en producción', String(fallas)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const col = Math.floor((x - 4) / (geo.cs + geo.pad)), fila = Math.floor((y - geo.y1) / (geo.cs + geo.pad));
      const i = fila * geo.cols + col, c = commits[i];
      if (col < 0 || col >= geo.cols || fila < 0 || !c) return tip.ocultar();
      const que = !c.res ? 'pendiente' : c.res === 'ok' ? 'desplegado sin defectos' : c.res === 'falla' ? 'desplegado con defecto: falla en producción' : `detenido en «${ETAPAS[c.etapa].join(' ')}»`;
      tip.mostrar(x, y, `commit <b>${c.i + 1}</b><br>${c.defecto ? 'contiene un ' + TIPOS[c.tipo] : 'sin defectos'}<br>${que}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: tamaño de lote y métricas ---------- */

  // Modelo mensual (30 días): cambios terminados por día lam, probabilidad de defecto por cambio q, automatización a.
  function lote(T, lam, q, a) {
    const n = lam * T, qEf = q * (1 - 0.8 * a), cfr = 1 - Math.pow(1 - qEf, n);
    const mttr = 1 + 0.4 * n, h = 8 - 7.9 * a, desp = 30 / T;
    const lead = T / 2 + h / 24;
    const horasDesp = desp * h, horasFalla = desp * cfr * mttr;
    return { T, n, cfr, mttr, h, desp, lead, horasDesp, horasFalla, total: horasDesp + horasFalla };
  }

  function montarLote(cuerpo) {
    let lam = 3, q = 0.04, a = 0.5, T = 7, pl1 = null, pl2 = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Días entre despliegues', min: 1, max: 30, valor: T, formato: (v) => `${v} d`, alCambiar: (v) => { T = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Automatización de pruebas y despliegue', min: 0, max: 1, paso: 0.1, valor: a, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Cambios terminados por día', min: 1, max: 6, valor: lam, formato: (v) => String(v), alCambiar: (v) => { lam = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Defectos por cambio (antes de pruebas)', min: 0.01, max: 0.1, paso: 0.01, valor: q, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { q = v; dibujar(); } });
    VIZ.subtitulo(cuerpo, 'Plazo de entrega de un cambio (días)');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 150, altoMax: 210 });
    const t1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Horas perdidas al mes');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 190, altoMax: 280 });
    const t2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'plazo de entrega', forma: 'linea' }, { color: C.s2, texto: 'trabajo de despliegue', forma: 'linea' },
      { color: C.s8, texto: 'recuperación de fallas', forma: 'linea' }, { color: C.tinta, texto: 'total', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en cualquiera de los gráficos para elegir el intervalo entre despliegues. Pruebe automatización 0 % (el óptimo se va a lotes grandes) y 100 % (conviene desplegar a diario).');

    const serie = (f) => Array.from({ length: 30 }, (_, i) => lote(i + 1, lam, q, a)).map((r) => [r.T, f(r)]);
    function dibujar() {
      const r = lote(T, lam, q, a);
      const todos = Array.from({ length: 30 }, (_, i) => lote(i + 1, lam, q, a));
      const mejor = todos.reduce((m, x) => (x.total < m.total ? x : m));
      // Panel 1
      let c = l1.ctx;
      l1.limpiar();
      pl1 = VIZ.plano(l1, { xmin: 1, xmax: 30, ymin: 0, ymax: lote(30, lam, q, a).lead * 1.1 }, { etiquetaX: 'días entre despliegues', formatoY: (v) => VIZ.fmt(v, 3) });
      pl1.ejes();
      VIZ.trazar(c, pl1, serie((x) => x.lead), C.s1, 2.5);
      guia(c, pl1);
      VIZ.marcador(c, pl1.sx(T), pl1.sy(r.lead), C.s1);
      // Panel 2
      c = l2.ctx;
      l2.limpiar();
      const ymax = Math.max(...todos.map((x) => x.total)) * 1.1;
      pl2 = VIZ.plano(l2, { xmin: 1, xmax: 30, ymin: 0, ymax }, { etiquetaX: 'días entre despliegues', formatoY: (v) => VIZ.entero(v) });
      pl2.ejes();
      VIZ.trazar(c, pl2, serie((x) => x.horasDesp), C.s2, 2);
      VIZ.trazar(c, pl2, serie((x) => x.horasFalla), C.s8, 2);
      VIZ.trazar(c, pl2, serie((x) => x.total), C.tinta, 2.5);
      guia(c, pl2);
      VIZ.marcador(c, pl2.sx(T), pl2.sy(r.horasDesp), C.s2, 4);
      VIZ.marcador(c, pl2.sx(T), pl2.sy(r.horasFalla), C.s8, 4);
      VIZ.marcador(c, pl2.sx(T), pl2.sy(r.total), C.tinta, 4.5);
      c.save(); c.font = VIZ.fuente(10, 600); c.fillStyle = C.s6; c.textAlign = 'center'; c.textBaseline = 'bottom';
      VIZ.marcador(c, pl2.sx(mejor.T), pl2.sy(mejor.total), C.s6, 5, 3);
      c.restore();
      registro.textContent = `Cada ${T} día(s) se juntan ${VIZ.fmt(r.n, 3)} cambios: ${VIZ.fmt(100 * r.cfr, 3)} % de los despliegues falla y arreglarlo toma ${VIZ.fmt(r.mttr, 3)} h. El mínimo de horas perdidas está en ${mejor.T} día(s) (${VIZ.fmt(mejor.total, 3)} h/mes, rombo verde).`;
      lectura.set([
        ['frecuencia de despliegue', `${VIZ.fmt(r.desp, 3)} por mes`],
        ['plazo de entrega', `${VIZ.fmt(r.lead, 3)} d`],
        ['tasa de falla de cambios', `${VIZ.fmt(100 * r.cfr, 3)} %`],
        ['tiempo de recuperación', `${VIZ.fmt(r.mttr, 3)} h`],
        ['horas perdidas al mes', `${VIZ.fmt(r.total, 3)} h`],
        ['intervalo óptimo', `${mejor.T} d`],
      ]);
    }
    function guia(c, pl) {
      c.strokeStyle = C.tinta; c.lineWidth = 1; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(pl.sx(T), pl.y1); c.lineTo(pl.sx(T), pl.y0); c.stroke(); c.setLineDash([]);
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    const interaccion = (l, tip, pl, panel) => {
      l.canvas.style.cursor = 'pointer';
      l.canvas.addEventListener('click', (ev) => {
        const { x, y } = l.posicion(ev);
        if (!pl() || !pl().dentro(x, y)) return;
        T = Math.max(1, Math.min(30, Math.round(pl().ix(x))));
        ctl.caja.querySelector('input[type=range]').value = T;
        ctl.caja.querySelector('output').textContent = `${T} d`;
        dibujar();
      });
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = l.posicion(ev);
        if (!pl() || !pl().dentro(x, y)) return tip.ocultar();
        const t = Math.max(1, Math.min(30, Math.round(pl().ix(x)))), r = lote(t, lam, q, a);
        tip.mostrar(x, y, `cada <b>${t}</b> d · ${VIZ.fmt(r.n, 3)} cambios por lote` + (panel === 1
          ? VIZ.filaTooltip(C.s1, 'plazo de entrega', `${VIZ.fmt(r.lead, 3)} d`)
          : VIZ.filaTooltip(C.s2, 'despliegue', `${VIZ.fmt(r.horasDesp, 3)} h`) + VIZ.filaTooltip(C.s8, `fallas (${VIZ.fmt(100 * r.cfr, 3)} %)`, `${VIZ.fmt(r.horasFalla, 3)} h`) + VIZ.filaTooltip(C.tinta, 'total', `${VIZ.fmt(r.total, 3)} h`)));
      });
      l.canvas.addEventListener('pointerleave', () => tip.ocultar());
    };
    interaccion(l1, t1, () => pl1, 1); interaccion(l2, t2, () => pl2, 2);
    dibujar();
  }

  /* ---------- Fig. 3: estrategias de despliegue ---------- */

  function montarEstrategias(cuerpo) {
    let e = 0.2, umbral = 300, c0 = 0.05, dwell = 10, rb = 20, curvas = null, pl = null;
    const REQ = 1000; // solicitudes por minuto
    const HOR = 90, DT = 0.25;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Solicitudes que falla la versión mala', min: 0.02, max: 0.5, paso: 0.01, valor: e, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { e = v; calcular(); } });
    ctl.rango({ etiqueta: 'Errores acumulados que disparan la alarma', min: 50, max: 1000, paso: 50, valor: umbral, formato: (v) => VIZ.entero(v), alCambiar: (v) => { umbral = v; calcular(); } });
    ctl.rango({ etiqueta: 'Tráfico inicial del canary', min: 0.01, max: 0.3, paso: 0.01, valor: c0, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { c0 = v; calcular(); } });
    ctl.rango({ etiqueta: 'Minutos entre etapas del canary', min: 3, max: 30, valor: dwell, formato: (v) => `${v} min`, alCambiar: (v) => { dwell = v; calcular(); } });
    ctl.rango({ etiqueta: 'Revertir un despliegue completo', min: 2, max: 60, valor: rb, formato: (v) => `${v} min`, alCambiar: (v) => { rb = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'todo de una vez', forma: 'linea' }, { color: C.s2, texto: 'canary (tráfico creciente por etapas)', forma: 'linea' },
      { color: C.s3, texto: 'blue-green (cambio instantáneo, reversión inmediata)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una versión con un defecto sale a producción en el minuto 0 con 1 000 solicitudes por minuto. Pase el cursor por el gráfico para ver cuántas solicitudes fallidas acumula cada estrategia. Pruebe bajar la tasa de fallas del defecto: el canary tarda más en notarlo.');

    function simular(frac, rev) {
      let err = 0, alarma = null, fin = null, t = 0;
      const pts = [[0, 0]];
      for (; t < HOR; t += DT) {
        let f = frac(t, alarma);
        if (fin != null && t >= fin) f = 0;
        err += REQ * f * e * DT;
        if (alarma == null && err >= umbral) { alarma = t; fin = t + rev; }
        pts.push([t + DT, err]);
      }
      return { pts, alarma, fin, total: err };
    }
    const etapas = () => [c0, 0.25, 0.5, 1].filter((x, i, v) => i === 0 || x > v[0]);
    function calcular() {
      const et = etapas();
      curvas = [
        { n: 'Todo de una vez', c: C.s1, r: simular(() => 1, rb) },
        { n: 'Canary', c: C.s2, r: simular((t, al) => { const k = Math.min(et.length - 1, Math.floor((al != null ? al : t) / dwell)); return et[k]; }, 2) },
        { n: 'Blue-green', c: C.s3, r: simular(() => 1, 1) },
      ];
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...curvas.map((q) => q.r.total), 1) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: HOR, ymin: 0, ymax }, { etiquetaX: 'minutos desde el despliegue', etiquetaY: 'solicitudes fallidas acumuladas', formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      curvas.forEach((q) => {
        VIZ.trazar(ctx, pl, q.r.pts, q.c, 2.5);
        if (q.r.alarma != null) VIZ.marcador(ctx, pl.sx(q.r.alarma), pl.sy(umbral), q.c, 4.5, 3);
      });
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(umbral)); ctx.lineTo(pl.x1, pl.sy(umbral)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('umbral de alarma (rombo = alarma)', pl.x1 - 4, pl.sy(umbral) - 3);
      const [u, ca, bg] = curvas;
      const mejor = curvas.reduce((m, q) => (q.r.total < m.r.total ? q : m));
      registro.textContent = `Fallas acumuladas: ${VIZ.entero(u.r.total)} (todo de una vez), ${VIZ.entero(ca.r.total)} (canary) y ${VIZ.entero(bg.r.total)} (blue-green). Con estos parámetros lo menos dañino es ${mejor.n.toLowerCase()}.`;
      const tAl = (q) => (q.r.alarma != null ? `${VIZ.fmt(q.r.alarma, 3)} min` : 'no se activa');
      lectura.set([
        ['alarma: todo de una vez', tAl(u)],
        ['alarma: canary', tAl(ca)],
        ['alarma: blue-green', tAl(bg)],
        ['fallas totales (u / c / b)', `${VIZ.entero(u.r.total)} / ${VIZ.entero(ca.r.total)} / ${VIZ.entero(bg.r.total)}`],
        ['canary frente a todo de una vez', u.r.total > 0 ? `${VIZ.fmt((100 * ca.r.total) / u.r.total, 3)} %` : '—'],
      ]);
    }
    lienzo.alDibujar = () => curvas && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !curvas || !pl.dentro(x, y)) return tip.ocultar();
      const t = Math.max(0, Math.min(HOR, pl.ix(x))), i = Math.round(t / DT);
      tip.mostrar(x, y, `minuto <b>${VIZ.fmt(t, 3)}</b>` + curvas.map((q) => VIZ.filaTooltip(q.c, q.n, VIZ.entero(q.r.pts[Math.min(i, q.r.pts.length - 1)][1]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('devops-ci-cd', {
    intro: String.raw`
      <p><strong>DevOps</strong> junta a desarrollo y operaciones en un mismo flujo de trabajo para que un cambio llegue a los usuarios de forma rápida y segura. Su columna vertebral es el <em>pipeline</em> de
      <strong>integración continua</strong> (cada <em>commit</em> se compila y se prueba automáticamente) y de <strong>entrega continua</strong> (lo que pasa las pruebas puede desplegarse en cualquier momento). Automatizar las comprobaciones
      reemplaza las grandes liberaciones trimestrales por cambios pequeños y frecuentes.</p>
      <p>La organización lo mide con cuatro indicadores: frecuencia de despliegue, plazo de entrega de un cambio, tasa de falla de cambios y tiempo de recuperación. Las figuras muestran cómo un pipeline
      detiene defectos, por qué desplegar poco a poco reduce el riesgo y cómo ciertas estrategias de despliegue limitan el daño de una versión defectuosa.</p>`,
    visualizaciones: [
      {
        titulo: 'Un pipeline de integración y entrega continua',
        descripcion: 'Reproduzca 30 commits por las etapas de build, pruebas y despliegue. Baje la cobertura de pruebas a 0 % y vea cuántos defectos llegan a producción; súbala y observe qué etapa detiene más.',
        montar: montarPipeline,
      },
      {
        titulo: 'Tamaño de lote y métricas DORA',
        descripcion: 'Mueva el intervalo entre despliegues: los lotes grandes alargan el plazo y fallan más, pero cada despliegue cuesta trabajo. Cambie la automatización y busque el intervalo con menos horas perdidas.',
        montar: montarLote,
      },
      {
        titulo: 'Estrategias de despliegue y radio de impacto',
        descripcion: 'Compare publicar todo de una vez, un canary por etapas y blue-green con una versión defectuosa. Baje la tasa de fallas y vea cómo el canary tarda más en activar la alarma; suba el tiempo de reversión y vea crecer el daño.',
        montar: montarEstrategias,
      },
    ],
    teoria: String.raw`
      <h2>Qué automatiza un pipeline</h2>
      <pre><code>cada commit en la rama principal:
    compilar y empaquetar (build)           ← falla rápido
    pruebas unitarias                       ← segundos
    pruebas de integración                  ← minutos
    despliegue a un entorno de aceptación   ← pruebas de usuario, de rendimiento
    despliegue a producción                 ← manual (entrega continua) o automático (despliegue continuo)</code></pre>
      <p>Cuanto antes se detecta un defecto, menos cuesta arreglarlo (ver <a href="tema.html?id=requirements-management">gestión de requerimientos</a>). La <em>pirámide de pruebas</em> pone muchas pruebas unitarias, rápidas y baratas,
      pocas de integración y muy pocas de extremo a extremo.</p>
      <h2>Las cuatro métricas</h2>
      <table>
        <tr><th>Métrica</th><th>Definición</th><th>Mide</th></tr>
        <tr><td>Frecuencia de despliegue</td><td>despliegues a producción por unidad de tiempo</td><td>velocidad</td></tr>
        <tr><td>Plazo de entrega (<em>lead time</em>)</td><td>tiempo desde que un cambio está terminado hasta que está en producción</td><td>velocidad</td></tr>
        <tr><td>Tasa de falla de cambios</td><td>\(\text{CFR} = \dfrac{\text{despliegues que causan una falla}}{\text{despliegues totales}}\)</td><td>estabilidad</td></tr>
        <tr><td>Tiempo de recuperación (MTTR)</td><td>tiempo medio en restablecer el servicio tras una falla</td><td>estabilidad</td></tr>
      </table>
      <p>Las investigaciones DORA muestran que velocidad y estabilidad <em>no</em> se oponen: los equipos mejores son los más rápidos y los más estables a la vez.</p>
      <h2>Modelo de las figuras</h2>
      <p>Si el equipo termina \(\lambda\) cambios por día y despliega cada \(T\) días, cada lote contiene \(n = \lambda T\) cambios. Si cada uno trae un defecto no detectado con probabilidad \(q_e\),</p>
      \[ \text{CFR}(T) = 1 - (1 - q_e)^{\lambda T}, \qquad \text{plazo medio} = \frac{T}{2} + \text{pipeline}, \qquad \text{MTTR}(T) = 1 + 0{,}4\,\lambda T \ \text{horas}. \]
      <p>(En un lote grande es más difícil saber cuál cambio causó la falla, de ahí que el MTTR crezca con \(n\).) Con \(h\) horas de trabajo por despliegue, las horas perdidas en 30 días son
      \(\frac{30}{T}\bigl(h + \text{CFR}(T)\cdot \text{MTTR}(T)\bigr)\). La automatización \(a\in[0,1]\) reduce ambos factores: \(q_e = q(1-0{,}8a)\) y \(h = 8 - 7{,}9a\) horas.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con \(\lambda = 3\) cambios por día y \(q = 4\,\%\): sin automatización (\(a=0\)) desplegar a diario consume \(30\cdot 8 = 240\) h al mes solo en el trabajo de cada despliegue (más 7,6 h de fallas), mientras que juntar 30 días
      de cambios (\(n=90\), CFR 97,5 %, MTTR 37 h) cuesta unas 44 h; sin automatizar, conviene el lote grande. Con automatización total (\(q_e = 0{,}8\,\%\), \(h = 0{,}1\) h) desplegar a diario cuesta \(3 + 1{,}6 \approx 4{,}6\) h
      y desplegar cada 7 días (\(n=21\), CFR 15,5 %, MTTR 9,4 h) cuesta \(0{,}4 + 6{,}3 \approx 6{,}7\) h: ahora lo mejor es desplegar con frecuencia. La automatización cambia cuál es el tamaño de lote óptimo.</p>
      <h2>Estrategias de despliegue</h2>
      <p>Una versión defectuosa genera errores a razón \(R\,f(t)\,e\) (\(R\): solicitudes por minuto, \(f\): fracción del tráfico que la recibe, \(e\): tasa de falla del defecto). Si la alarma se dispara al acumular \(U\) errores y revertir toma \(r\) minutos, el daño es
      \(\int_0^{t_a + r} R\,f(t)\,e\,dt\). El <em>canary</em> reduce \(f\) al comienzo, pero tarda más en acumular \(U\) cuando \(e\) o \(f\) son pequeños; <em>blue-green</em> mantiene dos entornos completos y conmuta el tráfico, de modo que revertir es casi inmediato.</p>
      <div class="recuadro"><p><strong>Idea central.</strong> Reducir el tamaño del lote, automatizar las comprobaciones y poder revertir rápido atacan la misma causa: el costo de equivocarse. Se mide con las cuatro métricas, y se mejora quitando fricción del pipeline, no pidiendo «más cuidado».</p></div>
      <h2>Conexiones</h2>
      <p>La entrega continua es la contraparte técnica de los métodos ágiles: <a href="tema.html?id=scrum">Scrum</a> y <a href="tema.html?id=waterfall-vs-agile">Waterfall vs Agile</a>. La disponibilidad que se protege con estas prácticas se calcula en
      <a href="tema.html?id=scalability-availability">escalabilidad y disponibilidad</a>, y la gestión de incidentes que sigue a una falla en <a href="tema.html?id=incident-management">gestión de incidentes</a>.
      Para elegir los indicadores de un equipo, vea <a href="tema.html?id=kpi-fundamentals">fundamentos de KPI</a>.</p>`,
  });
})();
