(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const { act, sec, xor, bucle } = P;

  // Atención de reclamos, con parámetros para poder comparar antes y después.
  function arbol(o = {}) {
    return sec(
      act('Recibir reclamo', { dur: 5, rol: 'soporte', costo: 8 }),
      act('Clasificar', { dur: 7, rol: 'soporte', costo: 10 }),
      bucle(act('Investigar', { dur: 30, rol: 'soporte', costo: 45 }), act('Pedir información', { dur: 10, rol: 'ventas', costo: 12 }), o.pBucle === undefined ? 0.35 : o.pBucle),
      xor([act('Aprobar compensación', { dur: 12, rol: 'gerencia', costo: 90 }), act('Rechazar reclamo', { dur: 6, rol: 'soporte', costo: 10 })], [0.45, 0.55]),
      act('Cerrar caso', { dur: 3, rol: 'soporte', costo: 4 }),
    );
  }
  const costoCaso = (c) => c.eventos.reduce((s, e) => s + e.costo, 0);
  const reprocesos = (c) => c.eventos.filter((e) => e.act === 'Pedir información').length;
  const media = P.media;
  const varianza = (a) => { const m = media(a); return a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, a.length - 1); };
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  const dinero = (v) => `$${VIZ.fmt(v, 4)}`;

  /* ---------- Fig. 1: del registro al KPI ---------- */

  const KPIS = [
    { id: 'ciclo', nombre: 'Tiempo de ciclo', unidad: 'tiempo', f: P.tiempoCiclo, fmt: P.dur, paso: 5, formula: 'casos con tiempo de ciclo ≤ meta / casos totales', cual: 'ciclo' },
    { id: 'costo', nombre: 'Costo por caso', unidad: 'costo', f: costoCaso, fmt: dinero, paso: 5, formula: 'casos con costo ≤ meta / casos totales', cual: 'costo' },
    { id: 'rep', nombre: 'Reprocesos por caso', unidad: 'calidad', f: reprocesos, fmt: (v) => String(Math.round(v)), paso: 1, entero: true, formula: 'casos con reprocesos ≤ meta / casos totales', cual: 'reprocesos' },
  ];

  function montarDefinir(cuerpo) {
    let semilla = 1, kpi = KPIS[0], vals = [], meta = 0, bins = [], hover = -1, pl = null;
    const log0 = () => P.simular(arbol(), 160, semilla, { espera: 25 });
    let log = log0();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ opciones: KPIS.map((k) => [k.id, `${k.nombre} (${k.unidad})`]), etiqueta: 'KPI', valor: kpi.id, alCambiar: (v) => { kpi = KPIS.find((k) => k.id === v); preparar(true); } });
    const rMeta = ctl.rango({ etiqueta: 'Meta (valor máximo aceptable)', min: 0, max: 100, valor: 50, formato: (v) => kpi.fmt(v), alCambiar: (v) => { meta = v; dibujar(); } });
    ctl.boton('Nuevos casos', () => { semilla++; log = log0(); preparar(false); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'caso que cumple la meta' }, { color: C.s8, texto: 'caso que la incumple' },
      { color: C.tinta, texto: 'meta', forma: 'linea' }, { color: C.apagado, texto: 'media del KPI', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra agrupa casos del registro simulado (160 reclamos). Cambie de KPI, mueva la meta y vea cómo el cumplimiento sale de contar casos, no de promediar. Pase el cursor sobre una barra para ver cuántos casos contiene.');

    function preparar(reiniciarMeta) {
      vals = log.map(kpi.f);
      const max = Math.max(...vals);
      const tope = kpi.entero ? Math.max(3, max) : Math.ceil(max / kpi.paso) * kpi.paso;
      rMeta.input.min = 0; rMeta.input.max = tope; rMeta.input.step = kpi.paso;
      if (reiniciarMeta) meta = kpi.entero ? 1 : Math.round(P.cuantil(vals, 0.7) / kpi.paso) * kpi.paso;
      meta = Math.min(meta, tope);
      rMeta.valor = meta; rMeta.refrescar();
      if (kpi.entero) bins = Array.from({ length: tope + 1 }, (_, i) => ({ a: i - 0.5, b: i + 0.5, c: i, n: 0, ok: 0 }));
      else { const nb = 14, w = tope / nb; bins = Array.from({ length: nb }, (_, i) => ({ a: i * w, b: (i + 1) * w, c: (i + 0.5) * w, n: 0, ok: 0 })); }
      dibujar();
    }
    function dibujar() {
      bins.forEach((b) => { b.n = 0; b.ok = 0; });
      vals.forEach((v) => {
        const b = bins.find((x, i) => v >= x.a && (v < x.b || i === bins.length - 1));
        if (b) { b.n++; if (v <= meta) b.ok++; }
      });
      const { ctx } = lienzo;
      lienzo.limpiar();
      const nmax = Math.max(...bins.map((b) => b.n)) || 1;
      const xmin = bins[0].a, xmax = bins[bins.length - 1].b;
      pl = VIZ.plano(lienzo, { xmin, xmax, ymin: 0, ymax: nmax * 1.12 }, { etiquetaX: kpi.nombre.toLowerCase(), etiquetaY: 'casos', formatoX: (v) => kpi.fmt(v), ticksX: kpi.entero ? bins.map((b) => b.c) : undefined, formatoY: (v) => String(Math.round(v)) });
      pl.ejes();
      bins.forEach((b, i) => {
        if (!b.n) return;
        const x = pl.sx(b.a) + 1, w = pl.sx(b.b) - pl.sx(b.a) - 2, y = pl.sy(b.n);
        ctx.fillStyle = b.c <= meta ? C.s6 : C.s8;
        if (i === hover) ctx.fillStyle = VIZ.alfa(b.c <= meta ? C.s6 : C.s8, 0.7);
        ctx.beginPath(); ctx.roundRect(x, y, w, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
      });
      const m = media(vals);
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(m), pl.y1); ctx.lineTo(pl.sx(m), pl.y0); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(meta), pl.y1 - 4); ctx.lineTo(pl.sx(meta), pl.y0); ctx.stroke();
      ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = meta > (xmin + xmax) / 2 ? 'right' : 'left'; ctx.textBaseline = 'top';
      ctx.fillText('meta', pl.sx(meta) + (meta > (xmin + xmax) / 2 ? -5 : 5), pl.y1 - 2);
      ctx.fillStyle = C.apagado; ctx.textAlign = m > (xmin + xmax) / 2 ? 'right' : 'left';
      ctx.fillText('media', pl.sx(m) + (m > (xmin + xmax) / 2 ? -5 : 5), pl.y1 + 12);
      ctx.restore();
      const cumplen = vals.filter((v) => v <= meta).length;
      registro.textContent = `Cumplimiento = ${kpi.formula} = ${cumplen} / ${vals.length} = ${pct(cumplen / vals.length)}. Meta: ${kpi.nombre.toLowerCase()} ≤ ${kpi.fmt(meta)}.`;
      lectura.set([
        ['media', kpi.fmt(m)],
        ['mediana', kpi.fmt(P.mediana(vals))],
        ['percentil 90', kpi.fmt(P.cuantil(vals, 0.9))],
        ['casos que cumplen', `${cumplen} de ${vals.length}`],
        ['cumplimiento', pct(cumplen / vals.length)],
      ]);
    }
    lienzo.alDibujar = () => vals.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const v = pl.ix(x), i = bins.findIndex((b) => v >= b.a && v < b.b);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0 || !bins[i].n) return tip.ocultar();
      const b = bins[i];
      tip.mostrar(x, y, `${kpi.entero ? 'valor' : 'entre'} <b>${kpi.entero ? b.c : kpi.fmt(b.a) + ' y ' + kpi.fmt(b.b)}</b><br>${b.n} casos` + VIZ.filaTooltip(b.c <= meta ? C.s6 : C.s8, b.c <= meta ? 'dentro de la meta' : 'fuera de la meta', null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (vals.length) dibujar(); });
    preparar(true);
  }

  /* ---------- Fig. 2: antes y después ---------- */

  function montarAntesDespues(cuerpo) {
    let semilla = 1, espera = 12, pBucle = 0.15, sla = 240, filas = [], hover = -1, zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera media tras el cambio', min: 2, max: 25, valor: espera, formato: (v) => `${v} min`, alCambiar: (v) => { espera = v; calcular(); } });
    ctl.rango({ etiqueta: 'Prob. de reproceso tras el cambio', min: 0, max: 0.5, paso: 0.01, valor: pBucle, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { pBucle = v; calcular(); } });
    ctl.rango({ etiqueta: 'SLA: ciclo máximo', min: 60, max: 480, paso: 10, valor: sla, formato: (v) => P.dur(v), alCambiar: (v) => { sla = v; calcular(); } });
    ctl.boton('Nuevos casos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 5 * 50 + 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'mejora respecto del estado actual' }, { color: C.s8, texto: 'empeora' }, { color: C.apagado, texto: 'sin cambio (0 %)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es el cambio porcentual de un KPI entre dos registros simulados de 250 reclamos (antes: espera media 25 min y 35 % de reproceso). Reduzca la espera o el reproceso y compare; pase el cursor para ver valores absolutos e incertidumbre.');

    function calcular() {
      const A = P.simular(arbol({ pBucle: 0.35 }), 250, semilla, { espera: 25 });
      const B = P.simular(arbol({ pBucle }), 250, semilla + 1000, { espera });
      const defs = [
        { n: 'Tiempo de ciclo medio', f: P.tiempoCiclo, fmt: P.dur, mejor: -1 },
        { n: 'Tiempo de ciclo p90', f: P.tiempoCiclo, fmt: P.dur, mejor: -1, q: 0.9 },
        { n: 'Cumplimiento de SLA', f: (c) => (P.tiempoCiclo(c) <= sla ? 1 : 0), fmt: pct, mejor: 1 },
        { n: 'Costo medio por caso', f: costoCaso, fmt: dinero, mejor: -1 },
        { n: 'Reprocesos por caso', f: reprocesos, fmt: (v) => VIZ.fmt(v, 3), mejor: -1 },
      ];
      filas = defs.map((d) => {
        const a = A.map(d.f), b = B.map(d.f);
        const va = d.q ? P.cuantil(a, d.q) : media(a), vb = d.q ? P.cuantil(b, d.q) : media(b);
        const se = d.q ? null : Math.sqrt(varianza(a) / a.length + varianza(b) / b.length);
        const rel = va ? (vb - va) / va : 0;
        return { ...d, va, vb, rel, se, signif: se !== null && Math.abs(vb - va) > 1.96 * se };
      });
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const lim = Math.max(0.5, ...filas.map((f) => Math.abs(f.rel))) * 1.15;
      const cx = W / 2, esc = (W / 2 - 52) / lim;
      zonas = [];
      filas.forEach((f, i) => {
        const y0 = 12 + i * 50;
        zonas.push([y0 - 4, y0 + 46]);
        ctx.fillStyle = i === hover ? C.neutro : 'transparent';
        ctx.fillRect(0, y0 - 4, W, 50);
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(f.n, 8, y0);
        const bien = (f.rel * f.mejor) >= 0;
        ctx.fillStyle = bien ? C.s6 : C.s8;
        const x = cx + Math.min(0, f.rel * esc), w = Math.max(1, Math.abs(f.rel * esc));
        ctx.beginPath(); ctx.roundRect(x, y0 + 18, w, 18, f.rel < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600);
        ctx.textAlign = f.rel < 0 ? 'right' : 'left';
        ctx.fillText(`${f.rel >= 0 ? '+' : '−'}${VIZ.fmt(Math.abs(f.rel) * 100, 3)} %${f.signif ? ' ●' : ''}`, f.rel < 0 ? x - 6 : x + w + 6, y0 + 22);
      });
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, 6); ctx.lineTo(cx, filas.length * 50 + 10); ctx.stroke();
      const f0 = filas[0], f3 = filas[3];
      registro.textContent = `Ciclo medio: ${P.dur(f0.va)} → ${P.dur(f0.vb)} (Δ = ${VIZ.fmt(f0.vb - f0.va, 3)} min ± ${VIZ.fmt(1.96 * f0.se, 2)}). ${f0.signif ? 'La diferencia supera el margen de error: es real con 95 % de confianza.' : 'La diferencia no supera el margen de error: podría ser ruido muestral.'} (● marca diferencias significativas)`;
      lectura.set([
        ['ciclo medio (antes → después)', `${P.dur(f0.va)} → ${P.dur(f0.vb)}`],
        ['SLA cumplido (antes → después)', `${pct(filas[2].va)} → ${pct(filas[2].vb)}`],
        ['costo por caso', `${dinero(f3.va)} → ${dinero(f3.vb)}`],
        ['KPIs que mejoran', `${filas.filter((f) => f.rel * f.mejor > 0).length} de 5`],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = zonas.findIndex(([a, b]) => y >= a && y < b);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const f = filas[i];
      tip.mostrar(x, y, `<b>${f.n}</b><br>antes <b>${f.fmt(f.va)}</b><br>después <b>${f.fmt(f.vb)}</b>` + (f.se !== null ? `<br>margen 95 %: ± ${f.fmt(Math.abs(1.96 * f.se))}` : '<br>percentil: sin margen calculado'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('kpi-definition', {
    intro: String.raw`
      <p>Un <strong>indicador clave de desempeño</strong> (KPI) convierte una pregunta vaga («¿atendemos bien?») en un número que se calcula del registro de eventos:
      el tiempo de ciclo medio, la fracción de casos que cumple un plazo, el costo por caso o la tasa de reproceso. Definir bien el KPI importa tanto como medirlo.</p>
      <p>Para que sirva, un KPI necesita una fórmula precisa, una unidad, una meta y un periodo de referencia. Con eso es posible comparar el proceso <em>antes</em> y
      <em>después</em> de un cambio sin discutir qué se entendía por «mejor».</p>`,
    visualizaciones: [
      {
        titulo: 'De los casos al KPI',
        descripcion: 'Elija un KPI y mueva la meta: el cumplimiento cambia al repartirse los casos entre dentro y fuera de ella. Pruebe una meta igual al percentil 90.',
        montar: montarDefinir,
      },
      {
        titulo: 'KPIs antes y después de un cambio',
        descripcion: 'Baje la espera y la probabilidad de reproceso y observe qué KPIs mejoran; reduzca el cambio hasta que la diferencia deje de ser significativa.',
        montar: montarAntesDespues,
      },
    ],
    teoria: String.raw`
      <h2>Definición de un KPI</h2>
      <p>Sea \(L\) un registro con casos \(c_1, \dots, c_n\). Un KPI de caso es una función \(x(c)\) (tiempo de ciclo, costo, número de reprocesos); el KPI del proceso es una
      agregación de esos valores y una <em>meta</em> \(m\):</p>
      \[ \bar{x} = \frac{1}{n}\sum_{i=1}^{n} x(c_i), \qquad \text{cumplimiento} = \frac{|\{c_i : x(c_i) \le m\}|}{n}. \]
      <table>
        <tr><th>Dimensión</th><th>Ejemplo</th><th>Cálculo desde el registro</th></tr>
        <tr><td>Tiempo</td><td>tiempo de ciclo</td><td>fin del último evento − inicio del primero</td></tr>
        <tr><td>Costo</td><td>costo por caso</td><td>suma del costo de los eventos del caso</td></tr>
        <tr><td>Calidad</td><td>tasa de reproceso</td><td>casos con una actividad repetida / casos totales</td></tr>
        <tr><td>Cumplimiento</td><td>cumplimiento de SLA</td><td>casos con ciclo ≤ plazo / casos totales</td></tr>
      </table>
      <h2>Comparación antes y después</h2>
      <p>La diferencia de medias entre dos periodos tiene error estándar</p>
      \[ \mathrm{EE} = \sqrt{\frac{s_A^2}{n_A} + \frac{s_B^2}{n_B}}, \]
      <p>y se considera distinta de cero con 95 % de confianza si \(|\bar{x}_B - \bar{x}_A| > 1{,}96\,\mathrm{EE}\). Con pocos casos, una mejora aparente puede ser solo variación aleatoria.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> Mejorar un KPI a costa de otro es frecuente: acelerar el cierre de casos puede aumentar los reprocesos. Se debe monitorear un conjunto balanceado.
      Las medias también ocultan la cola: complemente con percentiles (p90).</p></div>
      <h2>Conexiones</h2>
      <p>El tiempo de ciclo se desglosa en <a href="tema.html?id=waiting-and-service-time">espera y servicio</a>; los costos en <a href="tema.html?id=cost-mining">minería de costos</a>; y las metas
      organizan los proyectos <a href="tema.html?id=project-approaches">orientados a metas</a>. Qué intervenciones mueven cada KPI se estudia en
      <a href="tema.html?id=improvement-impact">oportunidades de mejora e impacto</a>.</p>`,
  });
})();
