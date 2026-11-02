(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const { act, sec, xor, bucle } = P;

  const VOLUMEN = 1200; // reclamos por mes, para convertir ahorro por caso en ahorro mensual
  const costoCaso = (c) => c.eventos.reduce((s, e) => s + e.costo, 0);
  const reprocesos = (c) => c.eventos.filter((e) => e.act === 'Pedir información').length;
  const dinero = (v) => `$${VIZ.entero(v)}`;

  // Atención de reclamos; las opciones o describen la intervención aplicada.
  function arbol(o) {
    return sec(
      act('Recibir reclamo', { dur: 5, rol: 'soporte', costo: 8 }),
      o.clasificar ? act('Clasificar', { dur: 1, rol: 'soporte', costo: 2 }) : act('Clasificar', { dur: 7, rol: 'soporte', costo: 10 }),
      bucle(act('Investigar', { dur: o.plantillas ? 20 : 30, rol: 'soporte', costo: o.plantillas ? 32 : 45 }), act('Pedir información', { dur: 10, rol: 'ventas', costo: 12 }), o.pBucle),
      xor([o.aprobar ? act('Aprobar compensación', { dur: 8, rol: 'gerencia', costo: 60 }) : act('Aprobar compensación', { dur: 12, rol: 'gerencia', costo: 90 }), act('Rechazar reclamo', { dur: 6, rol: 'soporte', costo: 10 })], [0.45, 0.55]),
      o.cierre ? act('Cerrar caso', { dur: 1, rol: 'soporte', costo: 0.5 }) : act('Cerrar caso', { dur: 3, rol: 'soporte', costo: 4 }),
    );
  }
  const INTERV = [
    { id: 'espera', nombre: 'Priorizar la cola de trabajo (espera −40 %)', corto: 'cola', esfuerzo: 8, aplicar: (o) => { o.espera *= 0.6; } },
    { id: 'clasificar', nombre: 'Automatizar «Clasificar»', corto: 'clasificar', esfuerzo: 12, aplicar: (o) => { o.clasificar = true; } },
    { id: 'reproceso', nombre: 'Eliminar reproceso con una lista de verificación (35 % → 12 %)', corto: 'reproceso', esfuerzo: 10, aplicar: (o) => { o.pBucle = 0.12; } },
    { id: 'aprobar', nombre: 'Aprobar automáticamente compensaciones menores', corto: 'aprobación', esfuerzo: 20, aplicar: (o) => { o.aprobar = true; } },
    { id: 'plantillas', nombre: 'Plantillas para «Investigar» (30 → 20 min)', corto: 'plantillas', esfuerzo: 15, aplicar: (o) => { o.plantillas = true; } },
    { id: 'cierre', nombre: 'Cierre automático del caso', corto: 'cierre', esfuerzo: 5, aplicar: (o) => { o.cierre = true; } },
  ];
  const opciones = (set) => { const o = { pBucle: 0.35, espera: 20 }; INTERV.forEach((i) => { if (set.has(i.id)) i.aplicar(o); }); return o; };

  // Valores esperados exactos de una ejecución del árbol (n: actividades, d: servicio, c: costo, r: reprocesos).
  function esperado(n) {
    const suma = (a, b, k = 1) => ({ n: a.n + k * b.n, d: a.d + k * b.d, c: a.c + k * b.c, r: a.r + k * b.r });
    if (n.t === 'act') return n.a ? { n: 1, d: n.dur, c: n.costo, r: n.a === 'Pedir información' ? 1 : 0 } : { n: 0, d: 0, c: 0, r: 0 };
    if (n.t === 'seq' || n.t === 'and') return n.h.reduce((s, h) => suma(s, esperado(h)), { n: 0, d: 0, c: 0, r: 0 });
    if (n.t === 'xor') { const tot = n.p.reduce((s, v) => s + v, 0); return n.h.reduce((s, h, i) => suma(s, esperado(h), n.p[i] / tot), { n: 0, d: 0, c: 0, r: 0 }); }
    const h = esperado(n.h[0]), r = esperado(n.h[1]);
    return suma(h, suma(r, h), n.p / (1 - n.p));
  }
  function exacto(set) {
    const o = opciones(set), e = esperado(arbol(o));
    return { ciclo: e.d + (e.n - 1) * o.espera, costo: e.c, rep: e.r, esf: INTERV.filter((i) => set.has(i.id)).reduce((s, i) => s + i.esfuerzo, 0) };
  }
  function simulado(set, semilla, n, sla) {
    const o = opciones(set), log = P.simular(arbol(o), n, semilla, { espera: o.espera }), t = log.map(P.tiempoCiclo);
    return { ciclo: P.media(t), costo: P.media(log.map(costoCaso)), rep: P.media(log.map(reprocesos)), sla: t.filter((v) => v <= sla).length / n };
  }

  /* ---------- Fig. 1: antes y después de una intervención ---------- */

  function montarSimular(cuerpo) {
    let semilla = 1, sla = 240, set = new Set(['espera']), cols = [], hover = -1, zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(INTERV.map((i) => ({ clave: i.id, texto: i.nombre, activo: set.has(i.id) })), (e) => { set = new Set(Object.keys(e).filter((k) => e[k])); calcular(); });
    ctl.rango({ etiqueta: 'SLA: ciclo máximo', min: 90, max: 480, paso: 10, valor: sla, formato: (v) => P.dur(v), alCambiar: (v) => { sla = v; calcular(); } });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.inactivo, texto: 'situación actual (100 %)' }, { color: C.s6, texto: 'después: mejora' }, { color: C.s8, texto: 'después: empeora' }, { color: C.apagado, texto: '100 %', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque una o varias intervenciones y compare 400 reclamos simulados antes y después. Las barras muestran cada KPI como porcentaje del estado actual; pase el cursor para ver el valor simulado y el valor esperado exacto calculado sobre el modelo.');

    function calcular() {
      const A = simulado(new Set(), semilla, 400, sla), B = simulado(set, semilla, 400, sla);
      const EA = exacto(new Set()), EB = exacto(set);
      cols = [
        { n: 'Ciclo medio', a: A.ciclo, b: B.ciclo, ea: EA.ciclo, eb: EB.ciclo, mejor: -1, fmt: P.dur },
        { n: 'Costo por caso', a: A.costo, b: B.costo, ea: EA.costo, eb: EB.costo, mejor: -1, fmt: (v) => `$${VIZ.fmt(v, 4)}` },
        { n: 'Cumplimiento SLA', a: A.sla, b: B.sla, ea: null, eb: null, mejor: 1, fmt: (v) => `${VIZ.fmt(v * 100, 3)} %` },
        { n: 'Reprocesos', a: A.rep, b: B.rep, ea: EA.rep, eb: EB.rep, mejor: -1, fmt: (v) => VIZ.fmt(v, 3) },
      ];
      const dc = EA.costo - EB.costo;
      lectura.set([
        ['ciclo esperado', `${P.dur(EA.ciclo)} → ${P.dur(EB.ciclo)}`],
        ['reducción del ciclo', `${VIZ.fmt((1 - EB.ciclo / EA.ciclo) * 100, 3)} %`],
        ['ahorro por caso', `$${VIZ.fmt(dc, 3)}`],
        ['ahorro mensual (1 200 casos)', dinero(dc * VOLUMEN)],
        ['esfuerzo', `${EB.esf} días-persona`],
      ]);
      registro.textContent = set.size ? `Con ${set.size} intervención(es) el ciclo esperado pasa de ${P.dur(EA.ciclo)} a ${P.dur(EB.ciclo)}; esfuerzo total ${EB.esf} días-persona.` : 'Sin intervenciones: el estado actual se compara consigo mismo.';
      dibujar();
    }
    function dibujar() {
      if (!cols.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const rel = cols.map((c) => (c.a ? c.b / c.a : 1));
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: cols.length, ymin: 0, ymax: Math.max(1.25, ...rel) * 1.08 }, { etiquetaY: '% del estado actual', ticksX: [], formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      zonas = [];
      cols.forEach((c, i) => {
        const w = (pl.x1 - pl.x0) / cols.length, x = pl.x0 + i * w, bw = Math.min(46, w * 0.32);
        zonas.push([x, x + w]);
        if (i === hover) { ctx.fillStyle = C.neutro; ctx.fillRect(x, pl.y1, w, pl.y0 - pl.y1); }
        [[x + w / 2 - bw - 2, 1, C.inactivo], [x + w / 2 + 2, rel[i], (rel[i] - 1) * c.mejor >= 0 ? C.s6 : C.s8]].forEach(([bx, v, col]) => {
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(bx, pl.sy(v), bw, pl.y0 - pl.sy(v), [4, 4, 0, 0]); ctx.fill();
        });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${Math.round(rel[i] * 100)} %`, x + w / 2 + 2 + bw / 2, pl.sy(rel[i]) - 4);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textBaseline = 'top';
        ctx.fillText(c.n, x + w / 2, pl.y0 + 8);
      });
      VIZ.trazar(ctx, pl, [[0, 1], [cols.length, 1]], C.apagado, 1.5, [3, 4]);
      lienzo.pl = pl;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = lienzo.pl && lienzo.pl.dentro(x, y) ? zonas.findIndex(([a, b]) => x >= a && x < b) : -1;
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const c = cols[i];
      tip.mostrar(x, y, `<b>${c.n}</b>` + VIZ.filaTooltip(C.inactivo, 'antes (simulado)', c.fmt(c.a)) + VIZ.filaTooltip(C.s1, 'después (simulado)', c.fmt(c.b)) + (c.ea !== null ? `<br>esperado exacto: ${c.fmt(c.ea)} → ${c.fmt(c.eb)}` : '<br>depende de la dispersión: solo simulado'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: ganancia frente a esfuerzo ---------- */

  const METRICAS = [
    { id: 'ciclo', corto: 'Menos tiempo de ciclo', nombre: 'Reducción del tiempo de ciclo', f: (b, s) => (1 - s.ciclo / b.ciclo) * 100 },
    { id: 'costo', corto: 'Ahorro de costo', nombre: 'Ahorro de costo por caso', f: (b, s) => (1 - s.costo / b.costo) * 100 },
    { id: 'rep', corto: 'Menos reprocesos', nombre: 'Reducción de reprocesos', f: (b, s) => (1 - s.rep / b.rep) * 100 },
  ];

  function montarPortafolio(cuerpo) {
    let metrica = METRICAS[0], presupuesto = 30, puntos = [], frontera = [], mejor = null, fijo = null, hover = null, pl = null;
    // 2⁶ combinaciones de intervenciones, con valores esperados exactos.
    const base = exacto(new Set());
    const todos = [];
    for (let m = 0; m < 1 << INTERV.length; m++) {
      const set = new Set(INTERV.filter((_, i) => m & (1 << i)).map((i) => i.id));
      todos.push({ set, k: set.size, ...exacto(set) });
    }
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ganancia', opciones: METRICAS.map((m) => [m.id, m.corto]), valor: metrica.id, alCambiar: (v) => { metrica = METRICAS.find((m) => m.id === v); calcular(); } });
    ctl.rango({ etiqueta: 'Presupuesto de esfuerzo', min: 0, max: 70, valor: presupuesto, formato: (v) => `${v} días-persona`, alCambiar: (v) => { presupuesto = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'una combinación posible', forma: 'punto' }, { color: C.s1, texto: 'intervención individual', forma: 'punto' },
      { color: C.s2, texto: 'frontera eficiente', forma: 'linea' }, { color: C.s6, texto: 'mejor combinación dentro del presupuesto', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una de las 64 combinaciones de intervenciones, calculada con el modelo. Mueva el presupuesto (línea vertical) y vea cuál conviene; haga clic en un punto para fijar su detalle. Las ganancias no se suman: dos intervenciones sobre la misma espera se solapan.');

    function calcular() {
      puntos = todos.map((p) => ({ ...p, g: metrica.f(base, p) }));
      puntos.sort((a, b) => a.esf - b.esf || b.g - a.g);
      frontera = [];
      let top = -Infinity;
      for (const p of puntos) if (p.g > top + 1e-9) { frontera.push(p); top = p.g; }
      mejor = puntos.filter((p) => p.esf <= presupuesto).reduce((m, p) => (!m || p.g > m.g ? p : m), null);
      dibujar();
    }
    const nombres = (p) => (p.k ? INTERV.filter((i) => p.set.has(i.id)).map((i) => i.corto).join(' + ') : 'ninguna');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const gmax = Math.max(...puntos.map((p) => p.g)) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 72, ymin: 0, ymax: Math.max(5, gmax) }, { etiquetaX: 'esfuerzo (días-persona)', etiquetaY: metrica.nombre.toLowerCase() + ' (%)', formatoY: (v) => `${VIZ.fmt(v, 3)}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      ctx.fillStyle = VIZ.alfa(C.s6, 0.06); ctx.fillRect(pl.sx(0), pl.y1, pl.sx(presupuesto) - pl.sx(0), pl.y0 - pl.y1);
      ctx.restore();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pl.sx(presupuesto), pl.y1); ctx.lineTo(pl.sx(presupuesto), pl.y0); ctx.stroke(); ctx.setLineDash([]);
      VIZ.trazar(ctx, pl, frontera.flatMap((p, i) => (i ? [[p.esf, frontera[i - 1].g], [p.esf, p.g]] : [[p.esf, p.g]])).concat([[72, frontera[frontera.length - 1].g]]), C.s2, 2);
      puntos.forEach((p) => { if (p.k !== 1 && p !== mejor) VIZ.marcador(ctx, pl.sx(p.esf), pl.sy(p.g), C.inactivo, 3.5); });
      puntos.forEach((p) => { if (p.k === 1) VIZ.marcador(ctx, pl.sx(p.esf), pl.sy(p.g), C.s1, 5, 1); });
      if (mejor) VIZ.marcador(ctx, pl.sx(mejor.esf), pl.sy(mejor.g), C.s6, 7);
      const resaltar = fijo || hover;
      if (resaltar) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.sx(resaltar.esf), pl.sy(resaltar.g), 10, 0, 2 * Math.PI); ctx.stroke(); }
      const ref = fijo || mejor;
      registro.textContent = mejor ? `Con ${presupuesto} días-persona la mejor combinación es «${nombres(mejor)}»: ${metrica.nombre.toLowerCase()} de ${VIZ.fmt(mejor.g, 3)} % con ${mejor.esf} días.` : 'No alcanza ni para una intervención.';
      lectura.set([
        ['combinación elegida', ref ? nombres(ref) : '—'],
        ['esfuerzo', ref ? `${ref.esf} días-persona` : '—'],
        ['ganancia', ref ? `${VIZ.fmt(ref.g, 3)} %` : '—'],
        ['ganancia por día-persona', ref && ref.esf ? `${VIZ.fmt(ref.g / ref.esf, 3)} puntos` : '—'],
        ['suma de ganancias individuales', ref && ref.k > 1 ? `${VIZ.fmt(puntos.filter((p) => p.k === 1 && ref.set.has([...p.set][0])).reduce((s, p) => s + p.g, 0), 3)} %` : '—'],
      ]);
    }
    const cercano = (x, y) => puntos.reduce((m, p) => { const d = Math.hypot(pl.sx(p.esf) - x, pl.sy(p.g) - y); return d < 11 && (!m || d < m.d) ? { p, d } : m; }, null);
    lienzo.alDibujar = () => puntos.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), h = pl && cercano(x, y);
      hover = h ? h.p : null; dibujar();
      if (!h) return tip.ocultar();
      tip.mostrar(x, y, `<b>${nombres(h.p)}</b><br>esfuerzo <b>${h.p.esf}</b> días-persona<br>${metrica.nombre.toLowerCase()} <b>${VIZ.fmt(h.p.g, 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), h = cercano(x, y); fijo = h ? h.p : null; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('improvement-impact', {
    intro: String.raw`
      <p>Encontrar un cuello de botella no es todavía una mejora: hay que decidir <em>qué cambiar</em>, estimar <em>cuánto ganaría</em> el proceso y cuánto
      <em>cuesta</em> hacerlo. Las intervenciones típicas son reducir esperas, automatizar una actividad y eliminar reprocesos.</p>
      <p>Con un modelo de proceso con tiempos y costos se puede simular cada intervención, medir el impacto en los KPIs y ordenar las opciones por ganancia frente a esfuerzo
      antes de tocar el proceso real.</p>`,
    visualizaciones: [
      {
        titulo: 'Simular intervenciones y medir el impacto',
        descripcion: 'Marque intervenciones y vea el efecto en ciclo, costo, SLA y reprocesos. Pruebe «priorizar la cola» solo y luego junto con la lista de verificación.',
        montar: montarSimular,
      },
      {
        titulo: 'Ganancia frente a esfuerzo',
        descripcion: 'Las 64 combinaciones posibles y su frontera eficiente. Mueva el presupuesto para ver qué cartera conviene y cambie la métrica de ganancia.',
        montar: montarPortafolio,
      },
    ],
    teoria: String.raw`
      <h2>Valor esperado exacto de un modelo</h2>
      <p>Para un árbol de proceso, las cantidades esperadas de una ejecución se calculan recursivamente. Si \(\mathbb{E}[X]\) es el valor esperado de una cantidad aditiva
      (número de actividades, servicio, costo):</p>
      \[ \mathbb{E}[\text{seq}(A,B)] = \mathbb{E}[A] + \mathbb{E}[B], \qquad \mathbb{E}[\times(A_i;p_i)] = \sum_i p_i\,\mathbb{E}[A_i], \]
      \[ \mathbb{E}[\circlearrowleft(H,R;p)] = \mathbb{E}[H] + \frac{p}{1-p}\bigl(\mathbb{E}[R] + \mathbb{E}[H]\bigr). \]
      <p>Con \(N\) actividades esperadas, servicio total \(S\) y espera media \(w\) entre actividades, el tiempo de ciclo esperado es \(S + (N-1)\,w\). Esto explica por qué
      reducir la espera suele rendir más que acelerar una actividad: la espera se paga \(N - 1\) veces.</p>
      <h2>Evaluar una intervención</h2>
      <pre><code>modelo' ← aplicar(intervención, modelo)
registro' ← simular(modelo', n)
para cada KPI k:  impacto_k ← (k(registro) − k(registro')) / k(registro)
ahorro mensual ← (costo − costo') × volumen mensual</code></pre>
      <div class="recuadro"><p><strong>Las ganancias no son aditivas.</strong> Dos intervenciones sobre el mismo recurso (por ejemplo, menos espera y menos reproceso) se solapan: la
      suma de ganancias individuales sobrestima la combinada. Por eso se evalúa cada combinación sobre el modelo completo.</p></div>
      <h2>Ganancia frente a esfuerzo</h2>
      <p>Cada combinación \(S\) tiene un esfuerzo \(e(S)\) y una ganancia \(g(S)\). Elegir la mejor dentro de un presupuesto \(B\) es un problema de mochila:
      \(\max_S g(S)\) sujeto a \(e(S) \le B\). La <em>frontera eficiente</em> contiene las combinaciones que ninguna otra supera con igual o menor esfuerzo. Con solo seis
      intervenciones basta enumerar \(2^6 = 64\) subconjuntos.</p>
      <p>Las estimaciones son tan buenas como el modelo: una intervención que cambia el comportamiento de las personas no se captura reduciendo una duración. Los KPIs usados se
      definen en <a href="tema.html?id=kpi-definition">definición de KPIs</a>; los candidatos a intervención salen del <a href="tema.html?id=bottleneck-analysis">análisis de cuellos de botella</a> y de la
      <a href="tema.html?id=cost-mining">minería de costos</a>.</p>`,
  });
})();
