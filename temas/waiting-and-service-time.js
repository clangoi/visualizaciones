(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const PROCESOS = [['pedidos', P.procesos.pedidos.nombre], ['reclamos', P.procesos.reclamos.nombre]];

  // Estadísticas por actividad. La espera de un evento es el hueco desde el fin del evento anterior del
  // mismo caso; el primer evento de un caso no tiene espera registrada (se excluye del promedio).
  function porActividad(log) {
    const m = new Map();
    let serv = 0, esp = 0;
    for (const c of log) {
      c.eventos.forEach((e, k) => {
        if (!m.has(e.act)) m.set(e.act, { act: e.act, n: 0, nEsp: 0, serv: 0, esp: 0, pos: 0, esperas: [], servicios: [] });
        const r = m.get(e.act), s = e.fin - e.ini;
        r.n++; r.serv += s; r.pos += k; r.servicios.push(s); serv += s;
        if (k) { const w = e.ini - c.eventos[k - 1].fin; r.nEsp++; r.esp += w; r.esperas.push(w); esp += w; }
      });
    }
    const filas = [...m.values()].map((r) => ({ ...r, mServ: r.serv / r.n, mEsp: r.nEsp ? r.esp / r.nEsp : 0, posMedia: r.pos / r.n, porCaso: r.n / log.length }));
    return { filas, serv, esp, ciclo: serv + esp, valor: serv / (serv + esp) };
  }

  // Congestión por actividad: multiplica la espera previa de cada actividad (colas más largas donde hay
  // menos capacidad) y desplaza los eventos siguientes. Así las esperas dejan de ser uniformes.
  const CONGESTION = {
    pedidos: { 'Reponer stock': 1.2, 'Preparar envío': 3.5, 'Emitir factura': 0.6, 'Cobrar al contado': 0.5, 'Despachar': 1.5 },
    reclamos: { 'Aprobar compensación': 3.5, 'Investigar': 1.8, 'Clasificar': 0.5, 'Cerrar caso': 0.4 },
  };
  function congestionar(log, f) {
    return log.map((c) => {
      let prev = 0;
      const eventos = c.eventos.map((e, k) => {
        const ini = k ? prev + (e.ini - c.eventos[k - 1].fin) * (f[e.act] === undefined ? 1 : f[e.act]) : e.ini;
        prev = ini + (e.fin - e.ini);
        return { ...e, ini, fin: prev };
      });
      return { ...c, eventos };
    });
  }

  function recortar(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 3 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  }

  /* ---------- Fig. 1: espera y servicio por actividad ---------- */

  function montarDescomposicion(cuerpo) {
    let proceso = 'pedidos', espera = 12, orden = 'flujo', semilla = 1, sel = '', est = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; sel = ''; calcular(); } });
    ctl.selector({ etiqueta: 'Ordenar por', opciones: [['flujo', 'orden en el flujo'], ['total', 'tiempo total'], ['espera', 'espera']], valor: orden, alCambiar: (v) => { orden = v; lienzo.ajustar(true); } });
    ctl.rango({ etiqueta: 'Espera media entre actividades (min)', min: 0, max: 60, valor: espera, alCambiar: (v) => { espera = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 66 + 30 * (est ? est.filas.length : 8) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'servicio medio (actividad en ejecución)' },
      { color: C.s2, texto: 'espera media antes de la actividad' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una barra para ver su detalle. Cada barra es el promedio por ejecución; cambie la espera media y vea qué actividades dejan de estar dominadas por el servicio.');

    function calcular() {
      const log = congestionar(P.simular(P.procesos[proceso].arbol, 300, semilla, { espera, llegada: 25 }), CONGESTION[proceso]);
      est = porActividad(log);
      const ciclos = log.map(P.tiempoCiclo);
      const cm = P.media(ciclos);
      lectura.set([
        ['ciclo medio', P.dur(cm)],
        ['servicio por caso', P.dur(est.serv / log.length)],
        ['espera por caso', P.dur(est.esp / log.length)],
        ['proporción de valor', `${VIZ.fmt(100 * est.valor, 3)} %`],
        ['comprobación', `servicio + espera = ${P.dur((est.serv + est.esp) / log.length)}`],
      ]);
      if (!est.filas.some((r) => r.act === sel)) sel = '';
      lienzo.ajustar(true);
    }
    const ordenadas = () => est.filas.slice().sort((a, b) => (orden === 'flujo' ? a.posMedia - b.posMedia : orden === 'total' ? (b.mServ + b.mEsp) - (a.mServ + a.mEsp) : b.mEsp - a.mEsp));
    function dibujar() {
      if (!est) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const filas = ordenadas();
      ctx.font = VIZ.fuente(11);
      const xe = Math.min(150, W * 0.38), xd = W - 14, top = 8, h = 30;
      const maxT = Math.max(...filas.map((r) => r.mServ + r.mEsp)) * 1.08;
      const sx = (t) => xe + t / maxT * (xd - xe);
      for (const v of VIZ.ticks(0, maxT, Math.max(2, Math.floor((xd - xe) / 80)))) {
        const x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + filas.length * h); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(VIZ.fmt(v, 3), x, top + filas.length * h + 5);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('minutos por ejecución', xd, top + filas.length * h + 36);
      geo = [];
      filas.forEach((r, i) => {
        const y = top + i * h + 4, alto = h - 10, xs = sx(r.mServ), xt = sx(r.mServ + r.mEsp);
        if (r.act === sel) { ctx.fillStyle = C.neutro; ctx.fillRect(0, top + i * h, W, h); }
        ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(xe, y, Math.max(1, xs - xe), alto, r.mEsp > 0 ? 0 : [0, 4, 4, 0]); ctx.fill();
        if (r.mEsp > 0) { ctx.fillStyle = C.s2; ctx.beginPath(); ctx.roundRect(xs, y, Math.max(1, xt - xs), alto, [0, 4, 4, 0]); ctx.fill(); }
        ctx.fillStyle = r.act === sel ? C.tinta : C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, r.act, xe - 12), xe - 8, y + alto / 2 + 1);
        ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(r.mServ + r.mEsp, 3), xt + 5, y + alto / 2 + 1);
        geo.push({ r, y0: top + i * h, y1: top + (i + 1) * h });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(xe + 0.5, top); ctx.lineTo(xe + 0.5, top + filas.length * h); ctx.stroke();
      if (sel) {
        const r = est.filas.find((q) => q.act === sel), tot = r.mServ + r.mEsp;
        registro.textContent = `${r.act}: ${VIZ.fmt(r.porCaso, 3)} ejecución(es) por caso; servicio ${P.dur(r.mServ)} (P90 ${P.dur(P.cuantil(r.servicios, 0.9))}), espera ${P.dur(r.mEsp)} (P90 ${P.dur(P.cuantil(r.esperas, 0.9))}). ` +
          `La espera es ${VIZ.fmt(100 * r.mEsp / tot, 3)} % del tiempo de la actividad y aporta ${VIZ.fmt(100 * r.porCaso * tot / ((est.serv + est.esp) / 300), 3)} % del ciclo medio.`;
      } else registro.textContent = 'Haga clic en una actividad para ver su detalle.';
    }
    const fila = (ev) => { const { y } = lienzo.posicion(ev); return geo.find((g) => y >= g.y0 && y < g.y1); };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const g = fila(ev), { x, y } = lienzo.posicion(ev);
      if (!g) return tip.ocultar();
      const r = g.r;
      tip.mostrar(x, y, `<b>${r.act}</b>` + VIZ.filaTooltip(C.s1, 'servicio', P.dur(r.mServ)) + VIZ.filaTooltip(C.s2, 'espera', r.nEsp ? P.dur(r.mEsp) : 'sin dato (primera)') +
        `<div>proporción de valor <b>${VIZ.fmt(100 * r.mServ / (r.mServ + r.mEsp), 3)} %</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const g = fila(ev); sel = g && g.r.act !== sel ? g.r.act : ''; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: qué pasa si cambia la espera ---------- */

  function montarEfecto(cuerpo) {
    // Una sola simulación con espera media 1: las esperas son proporcionales a la media (exponenciales),
    // de modo que W_a(e) = e · W_a(1) para los mismos casos.
    const log = congestionar(P.simular(P.procesos.pedidos.arbol, 400, 7, { espera: 1, llegada: 25 }), CONGESTION.pedidos);
    const est = porActividad(log);
    const serv = est.serv / log.length;
    const espPorAct = new Map(est.filas.map((r) => [r.act, r.esp / log.length]));
    const acts = est.filas.slice().sort((a, b) => a.posMedia - b.posMedia).map((r) => r.act);
    let e0 = 20, objetivo = 'todas', reduccion = 50, hover = null, pA = null, pB = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera media del entorno (min)', min: 0, max: 60, valor: e0, alCambiar: (v) => { e0 = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Reducir la espera de', opciones: [['todas', 'todas las actividades'], ...acts.slice(1).map((a) => [a, a])], valor: objetivo, alCambiar: (v) => { objetivo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Reducción de esa espera', min: 0, max: 100, paso: 5, valor: reduccion, formato: (v) => v + ' %', alCambiar: (v) => { reduccion = v; dibujar(); } });
    VIZ.subtitulo(cuerpo, 'Tiempo de ciclo medio según la espera');
    const la = VIZ.lienzo(cuerpo, { proporcion: 0.36, altoMin: 200, altoMax: 290 });
    const ta = VIZ.tooltip(la);
    VIZ.subtitulo(cuerpo, 'Proporción de valor (servicio / ciclo)');
    const lb = VIZ.lienzo(cuerpo, { proporcion: 0.28, altoMin: 160, altoMax: 220 });
    const tb = VIZ.tooltip(lb);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'servicio (no depende de la espera)' },
      { color: C.s2, texto: 'espera después de la reducción' },
      { color: C.apagado, texto: 'sin reducción', forma: 'linea' },
      { color: C.s6, texto: 'proporción con reducción', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el cursor sobre los gráficos para leer cualquier espera media. Elija una sola actividad y una reducción para ver cuánto se gana al atacar su espera frente a atacar todas.');

    const espera = (e) => {
      let s = 0;
      for (const [a, w] of espPorAct) s += w * e * (1 - (reduccion / 100) * (objetivo === 'todas' || objetivo === a ? 1 : 0));
      return s;
    };
    const base = (e) => [...espPorAct.values()].reduce((s, w) => s + w * e, 0);
    const prop = (e, conRed) => serv / (serv + (conRed ? espera(e) : base(e)));
    function dibujar() {
      const emax = 60;
      let ctx = la.ctx;
      la.limpiar();
      pA = VIZ.plano(la, { xmin: 0, xmax: emax, ymin: 0, ymax: (serv + base(emax)) * 1.08 }, { etiquetaY: 'minutos', formatoY: (v) => VIZ.fmt(v, 3) });
      pA.ejes();
      const xs = []; for (let e = 0; e <= emax; e += 2) xs.push(e);
      ctx.fillStyle = VIZ.alfa(C.s1, 0.55);
      ctx.beginPath(); ctx.moveTo(pA.sx(0), pA.sy(0)); xs.forEach((e) => ctx.lineTo(pA.sx(e), pA.sy(serv))); ctx.lineTo(pA.sx(emax), pA.sy(0)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = VIZ.alfa(C.s2, 0.55);
      ctx.beginPath(); xs.forEach((e, i) => (i ? ctx.lineTo(pA.sx(e), pA.sy(serv + espera(e))) : ctx.moveTo(pA.sx(e), pA.sy(serv + espera(e)))));
      for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(pA.sx(xs[i]), pA.sy(serv)); ctx.closePath(); ctx.fill();
      VIZ.trazar(ctx, pA, xs.map((e) => [e, serv + base(e)]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pA, xs.map((e) => [e, serv + espera(e)]), C.s2, 2);
      VIZ.trazar(ctx, pA, [[0, serv], [emax, serv]], C.s1, 2);
      const eh = hover === null ? e0 : hover;
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(pA.sx(eh), pA.y0); ctx.lineTo(pA.sx(eh), pA.y1); ctx.stroke(); ctx.setLineDash([]);
      VIZ.marcador(ctx, pA.sx(eh), pA.sy(serv + espera(eh)), C.s2, 4.5);
      ctx = lb.ctx;
      lb.limpiar();
      pB = VIZ.plano(lb, { xmin: 0, xmax: emax, ymin: 0, ymax: 1 }, { etiquetaY: 'proporción', etiquetaX: 'espera media entre actividades (min)', formatoY: (v) => VIZ.fmt(v, 2) });
      pB.ejes();
      VIZ.trazar(ctx, pB, xs.map((e) => [e, prop(e, false)]), C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pB, xs.map((e) => [e, prop(e, true)]), C.s6, 2);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(pB.sx(eh), pB.y0); ctx.lineTo(pB.sx(eh), pB.y1); ctx.stroke(); ctx.setLineDash([]);
      VIZ.marcador(ctx, pB.sx(eh), pB.sy(prop(eh, true)), C.s6, 4.5);
      const antes = serv + base(eh), despues = serv + espera(eh);
      lectura.set([
        ['espera media', `${VIZ.fmt(eh, 3)} min`],
        ['ciclo sin reducción', P.dur(antes)],
        ['ciclo con reducción', P.dur(despues)],
        ['ahorro', `${P.dur(antes - despues)} (${VIZ.fmt(100 * (antes - despues) / antes, 3)} %)`],
        ['proporción de valor', `${VIZ.fmt(100 * prop(eh, false), 3)} % → ${VIZ.fmt(100 * prop(eh, true), 3)} %`],
      ]);
      registro.textContent = `Con espera media de ${VIZ.fmt(eh, 3)} min el servicio es ${VIZ.fmt(100 * prop(eh, false), 3)} % del ciclo. ` +
        (reduccion ? `Reducir ${reduccion} % la espera de ${objetivo === 'todas' ? 'todas las actividades' : '«' + objetivo + '»'} baja el ciclo a ${P.dur(despues)}.` : 'No se aplica ninguna reducción.');
    }
    la.alDibujar = dibujar; lb.alDibujar = dibujar;
    const mover = (lienzo, plano, tt) => (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = plano();
      if (!p || !p.dentro(x, y)) { hover = null; tt.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(60, p.ix(x)));
      dibujar();
      tt.mostrar(x, y, `espera media <b>${VIZ.fmt(hover, 3)} min</b>` + VIZ.filaTooltip(C.s1, 'servicio', P.dur(serv)) +
        VIZ.filaTooltip(C.s2, 'espera', P.dur(espera(hover))) + VIZ.filaTooltip(C.s6, 'proporción de valor', `${VIZ.fmt(100 * prop(hover, true), 3)} %`));
    };
    for (const [l, p, t] of [[la, () => pA, ta], [lb, () => pB, tb]]) {
      l.canvas.addEventListener('pointermove', mover(l, p, t));
      l.canvas.addEventListener('pointerleave', () => { hover = null; t.ocultar(); dibujar(); });
    }
    dibujar();
  }

  VIZ.registrarTema('waiting-and-service-time', {
    intro: String.raw`
      <p>El tiempo que un caso pasa en una actividad no es todo trabajo. Se descompone en <strong>tiempo de servicio</strong> (<em>service time</em>, el intervalo en que alguien ejecuta la actividad) y <strong>tiempo de espera</strong> (<em>waiting time</em>, el hueco entre que la actividad anterior terminó y esta empezó). En muchos procesos reales la espera supera con holgura al servicio.</p>
      <p>Separar ambos cambia las decisiones: si domina el servicio hay que acelerar el trabajo; si domina la espera hay que mirar colas, traspasos y capacidad. La razón entre servicio y ciclo se llama <em>proporción de valor</em> o eficiencia del flujo.</p>`,
    visualizaciones: [
      {
        titulo: 'Servicio y espera por actividad',
        descripcion: 'Cada barra suma servicio (azul) y espera previa (naranjo) de una actividad. Suba la espera media y vea qué actividades cambian de color dominante; ordene por espera para encontrar las peores.',
        montar: montarDescomposicion,
      },
      {
        titulo: 'Efecto de variar la espera',
        descripcion: 'Con los mismos 400 casos se escala la espera (con colas más largas en unas actividades que en otras). Compare reducir la espera de todas las actividades con atacar solo una: el ahorro y la proporción de valor cambian según dónde se acumula la espera.',
        montar: montarEfecto,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Para un evento \(e_i\) de un caso, con inicio \(s_i\) y fin \(f_i\), el <em>servicio</em> es \(f_i - s_i\) y la <em>espera</em> es \(w_i = s_i - f_{i-1}\) para \(i\ge2\). El primer evento no tiene espera registrada: el caso no existe en el registro antes de él. Con actividades secuenciales,</p>
      \[ T_c = \sum_i (f_i - s_i) + \sum_{i\ge 2} w_i = S_c + W_c, \qquad \text{proporción de valor} = \frac{\sum_c S_c}{\sum_c (S_c + W_c)} . \]
      <p>Por actividad \(a\) se promedian ambos términos sobre sus ocurrencias, y su aporte al ciclo medio es \(\bar n_a(\bar s_a + \bar w_a)/\bar T\), donde \(\bar n_a\) es el número medio de ejecuciones por caso (mayor que 1 si hay repeticiones).</p>
      <h2>Cálculo</h2>
      <pre><code>para cada caso c:
    para i ← 1 hasta m:
        serv[a_i] ← serv[a_i] + (f_i − s_i)
        si i &gt; 1: esp[a_i] ← esp[a_i] + (s_i − f_{i−1})
promedios ← sumas / ocurrencias
proporción ← Σ serv / (Σ serv + Σ esp)</code></pre>
      <h2>Análisis</h2>
      <p>Si las esperas son exponenciales de media \(\mu\) y hay \(k\) esperas por caso, \(\mathbb E[W_c]=k\mu\), así que el ciclo crece linealmente con \(\mu\) pero la proporción de valor \(S/(S+k\mu)\) decae hiperbólicamente: las primeras unidades de espera dañan más la eficiencia que las últimas. Por eso reducir la espera de una sola actividad ahorra \(\bar n_a\,\bar w_a\,r\) (con \(r\) la fracción eliminada), proporcional a cuánto de la espera total concentra.</p>
      <div class="recuadro">Una espera alta no siempre es un problema del proceso: puede ser espera <em>del cliente</em> o de un tercero. Distinga quién tiene la pelota antes de actuar.</div>
      <h2>Conexiones</h2>
      <ul>
        <li>El ciclo completo y su relación con el WIP: <a href="tema.html?id=cycle-time-throughput">Cycle Time and Throughput</a>.</li>
        <li>Visualizar la espera sobre el modelo para ubicar el cuello de botella: <a href="tema.html?id=bottleneck-analysis">Bottleneck Analysis</a>.</li>
        <li>La espera varía mucho entre casos; su distribución se estudia en <a href="tema.html?id=duration-distributions">Duration Distributions</a>.</li>
      </ul>`,
  });
})();
