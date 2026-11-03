(function () {
  'use strict';
  const { color: C } = VIZ;

  const recortar = (ctx, texto, max) => {
    if (ctx.measureText(texto).width <= max) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: mapa de indicadores ---------- */

  // fin: financiero; adel: adelantado (de proceso); kpi: clave para la estrategia (si no, métrica operacional).
  const INDICADORES = [
    { n: 'Ingresos trimestrales', fin: true, adel: false, kpi: true, f: 'ventas netas del trimestre', ej: 'Mide el resultado cuando ya no se puede corregir.' },
    { n: 'Margen operacional', fin: true, adel: false, kpi: true, f: '(ingresos − costos operacionales) / ingresos', ej: 'Resume la rentabilidad del periodo.' },
    { n: 'Presupuesto ejecutado', fin: true, adel: false, kpi: false, f: 'gasto real / gasto presupuestado', ej: 'Control contable; no dice si el gasto creó valor.' },
    { n: 'Valor del pipeline', fin: true, adel: true, kpi: true, f: 'Σ monto de oportunidades abiertas × probabilidad de cierre', ej: 'Anticipa los ingresos de los próximos trimestres.' },
    { n: 'Costo por cliente nuevo', fin: true, adel: true, kpi: false, f: 'gasto de marketing / clientes nuevos', ej: 'Señala si el crecimiento será caro antes de que se vea en el margen.' },
    { n: 'Fuga de clientes', fin: false, adel: false, kpi: true, f: 'clientes perdidos / clientes al inicio del periodo', ej: 'Resultado de la experiencia acumulada del cliente.' },
    { n: 'NPS', fin: false, adel: false, kpi: true, f: '% promotores − % detractores', ej: 'Encuesta trimestral: resume lo ocurrido.' },
    { n: 'Rotación de personal', fin: false, adel: false, kpi: false, f: 'salidas del periodo / dotación promedio', ej: 'Cuando sube, el daño ya ocurrió.' },
    { n: 'Tiempo de primera respuesta', fin: false, adel: true, kpi: true, f: 'mediana de minutos entre la solicitud y la primera respuesta', ej: 'Cambia hoy y predice la satisfacción de mañana.' },
    { n: 'Disponibilidad del servicio', fin: false, adel: true, kpi: true, f: 'minutos en servicio / minutos del periodo', ej: 'Caídas de hoy son fugas de clientes futuras.' },
    { n: 'Horas de capacitación', fin: false, adel: true, kpi: false, f: 'horas de formación / empleado', ej: 'Métrica de insumo: útil si se vincula con un resultado.' },
    { n: 'Cobertura de pruebas', fin: false, adel: true, kpi: false, f: 'líneas cubiertas por pruebas / líneas totales', ej: 'Métrica de proceso que anticipa defectos en producción.' },
  ];
  const FILTROS = [
    ['todos', 'Todos', () => true],
    ['fin', 'Solo financieros', (i) => i.fin],
    ['nofin', 'Solo no financieros', (i) => !i.fin],
    ['adel', 'Solo adelantados (de proceso)', (i) => i.adel],
    ['rez', 'Solo rezagados (de resultado)', (i) => !i.adel],
    ['kpi', 'Solo KPI (clave)', (i) => i.kpi],
  ];

  function montarMapa(cuerpo) {
    let filtro = FILTROS[0], sel = 3, hover = -1, chips = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Resaltar', opciones: FILTROS.map((f) => [f[0], f[1]]), valor: 'todos', alCambiar: (v) => { filtro = FILTROS.find((f) => f[0] === v); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'KPI: ligado a un objetivo estratégico' },
      { color: C.superficie, borde: C.tinta2, texto: 'métrica operacional: apoya la gestión diaria' },
      { color: C.sobre, borde: C.s2, texto: 'indicador seleccionado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un indicador para ver su clasificación y su fórmula; pase el cursor para el ejemplo. Cambie «Resaltar» para ver solo un tipo.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ml = 4, top = 26, midX = ml + (W - 2 * ml) / 2, h1 = 4 * 30 + 12, h2 = 3 * 30 + 12;
      const cuadrantes = [
        { fin: true, adel: true, x: ml, y: top, w: midX - ml, h: h1 },
        { fin: false, adel: true, x: midX, y: top, w: W - ml - midX, h: h1 },
        { fin: true, adel: false, x: ml, y: top + h1, w: midX - ml, h: h2 },
        { fin: false, adel: false, x: midX, y: top + h1, w: W - ml - midX, h: h2 },
      ];
      ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillStyle = C.tinta2;
      ctx.fillText('FINANCIEROS', ml + (midX - ml) / 2, 12);
      ctx.fillText('NO FINANCIEROS', midX + (W - ml - midX) / 2, 12);
      chips = [];
      cuadrantes.forEach((q, qi) => {
        ctx.fillStyle = qi === 0 || qi === 3 ? C.neutro : C.fondo2;
        ctx.fillRect(q.x, q.y, q.w, q.h);
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1);
        ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.apagado; ctx.textAlign = 'left';
        ctx.fillText(q.adel ? 'ADELANTADOS (proceso)' : 'REZAGADOS (resultado)', q.x + 8, q.y + 11);
        let k = 0;
        INDICADORES.forEach((ind, idx) => {
          if (ind.fin !== q.fin || ind.adel !== q.adel) return;
          const r = { x: q.x + 6, y: q.y + 22 + k * 30, w: q.w - 12, h: 25, idx };
          k++;
          chips.push(r);
          const activo = filtro[2](ind);
          ctx.globalAlpha = activo ? 1 : 0.28;
          ctx.fillStyle = ind.kpi ? C.s1 : C.superficie;
          ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
          ctx.lineWidth = idx === sel ? 3 : 1.5;
          ctx.strokeStyle = idx === sel ? C.s2 : ind.kpi ? C.s1 : C.tinta2;
          ctx.stroke();
          ctx.font = VIZ.fuente(10.5, idx === sel || idx === hover ? 600 : 500);
          ctx.fillStyle = ind.kpi ? C.sobre : C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(recortar(ctx, ind.n, r.w - 14), r.x + 8, r.y + r.h / 2 + 0.5);
          ctx.globalAlpha = 1;
        });
      });
      // Flecha de causalidad: lo adelantado empuja a lo rezagado.
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.fillStyle = C.apagado;
      const ax = W - 12, ay0 = top + h1 - 18, ay1 = top + h1 + 22;
      ctx.beginPath(); ctx.moveTo(ax, ay0); ctx.lineTo(ax, ay1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax - 4, ay1 - 6); ctx.lineTo(ax + 4, ay1 - 6); ctx.lineTo(ax, ay1); ctx.closePath(); ctx.fill();

      const ind = INDICADORES[sel];
      registro.textContent = `${ind.n}: indicador ${ind.fin ? 'financiero' : 'no financiero'}, ${ind.adel ? 'adelantado (de proceso)' : 'rezagado (de resultado)'}, ${ind.kpi ? 'KPI' : 'métrica operacional'}. Fórmula: ${ind.f}.`;
      const act = INDICADORES.filter(filtro[2]);
      lectura.set([
        ['indicadores resaltados', `${act.length} de ${INDICADORES.length}`],
        ['financieros / no financieros', `${INDICADORES.filter((i) => i.fin).length} / ${INDICADORES.filter((i) => !i.fin).length}`],
        ['adelantados / rezagados', `${INDICADORES.filter((i) => i.adel).length} / ${INDICADORES.filter((i) => !i.adel).length}`],
        ['KPI / métricas', `${INDICADORES.filter((i) => i.kpi).length} / ${INDICADORES.filter((i) => !i.kpi).length}`],
      ]);
    }
    const buscar = (x, y) => chips.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'default';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = buscar(x, y);
      const nuevo = r ? r.idx : -1;
      lienzo.canvas.style.cursor = r ? 'pointer' : 'default';
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (!r) return tip.ocultar();
      const i = INDICADORES[r.idx];
      tip.mostrar(x, y, `<b>${i.n}</b><br>${i.fin ? 'financiero' : 'no financiero'} · ${i.adel ? 'adelantado' : 'rezagado'}<br>${i.ej}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = buscar(x, y);
      if (r) { sel = r.idx; dibujar(); }
    });
    dibujar();
  }

  /* ---------- Fig. 2: un KPI mal definido induce mala conducta ---------- */

  // Modelo estilizado de un centro de atención: p = esfuerzo por acortar las llamadas (0 a 1).
  const tmo = (p) => 12 - 8 * p; // duración media de la llamada (min)
  const llam = (p) => 60 / tmo(p); // llamadas atendidas por hora por agente
  const fcr = (p) => 0.88 - 0.55 * p * p; // fracción resuelta en el primer contacto
  const resh = (p) => llam(p) * fcr(p); // casos efectivamente resueltos por hora
  const csat = (p) => 100 * (0.8 * fcr(p) + 0.2 * (0.5 + 0.5 * p)); // satisfacción (0–100)
  const PASOS = Array.from({ length: 101 }, (_, i) => i / 100);
  const maxDe = (f) => Math.max(...PASOS.map(f));

  const KPIS = [
    { id: 'llamadas', nombre: 'Llamadas atendidas por hora', valor: llam, fmt: (v) => `${VIZ.fmt(v, 3)} llamadas/h`, smart: [1, 1, 0, 0, 0],
      texto: 'Sin meta ni plazo, y premia colgar rápido: no mide si el problema del cliente se resolvió.' },
    { id: 'fcr', nombre: 'Resolución al primer contacto', valor: fcr, fmt: (v) => `${VIZ.fmt(v * 100, 3)} %`, smart: [1, 1, 1, 1, 0],
      texto: 'Mide lo importante para el cliente, pero ignora la productividad y le falta periodicidad.' },
    { id: 'equilibrado', nombre: 'Casos resueltos por hora con resolución ≥ 70 %', valor: (p) => (fcr(p) >= 0.7 ? resh(p) : 0), fmt: (v) => `${VIZ.fmt(v, 3)} casos/h`, smart: [1, 1, 1, 1, 1],
      texto: 'Combina productividad y calidad, tiene umbral y se mide cada semana por equipo.' },
  ];
  const SMART = ['S', 'M', 'A', 'R', 'T'];
  const SMART_NOMBRE = ['específico', 'medible', 'alcanzable', 'relevante', 'con plazo'];

  function montarConducta(cuerpo) {
    let kpi = KPIS[0], p = 0.3, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Definición del KPI', opciones: KPIS.map((k) => [k.id, k.nombre]), valor: kpi.id, alCambiar: (v) => { kpi = KPIS.find((k) => k.id === v); dibujar(); } });
    const rP = ctl.rango({ etiqueta: 'Esfuerzo por acortar llamadas', min: 0, max: 100, valor: p * 100, formato: (v) => `${v} %`, alCambiar: (v) => { p = v / 100; dibujar(); } });
    ctl.boton('Que el equipo optimice el KPI', () => {
      let mejor = 0, vm = -Infinity;
      for (const q of PASOS) { const v = kpi.valor(q); if (v > vm + 1e-9) { vm = v; mejor = q; } }
      p = mejor; rP.valor = Math.round(p * 100); dibujar();
    }, { primario: true });
    ctl.boton('Volver al 30 %', () => { p = 0.3; rP.valor = 30; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'llamadas por hora', forma: 'linea' },
      { color: C.s1, texto: 'casos resueltos por hora (valor real)', forma: 'linea' },
      { color: C.s3, texto: 'satisfacción del cliente', forma: 'linea' },
      { color: C.tinta, texto: 'conducta actual', forma: 'linea' },
    ]);
    const smart = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(smart);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada curva se muestra como porcentaje de su propio máximo. Elija un KPI y pulse «Que el equipo optimice»: el equipo se mueve donde ese KPI se maximiza, aunque el valor real caiga. Haga clic en el gráfico para fijar el esfuerzo.');

    const SER = [[llam, C.s2, 'llamadas por hora', (v) => VIZ.fmt(v, 3)], [resh, C.s1, 'casos resueltos por hora', (v) => VIZ.fmt(v, 3)], [csat, C.s3, 'satisfacción', (v) => VIZ.fmt(v, 3)]];
    const maximos = SER.map(([f]) => maxDe(f));
    const pOptReal = PASOS.reduce((a, q) => (resh(q) > resh(a) ? q : a), 0);

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 108 }, { etiquetaX: 'esfuerzo por acortar llamadas', etiquetaY: '% del máximo', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => `${Math.round(v)}` });
      plano.ejes();
      SER.forEach(([f, c], k) => VIZ.trazar(ctx, plano, PASOS.map((q) => [q, (f(q) / maximos[k]) * 100]), c, 2));
      // Óptimo real
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(plano.sx(pOptReal), plano.y1); ctx.lineTo(plano.sx(pOptReal), plano.y0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'top';
      ctx.textAlign = pOptReal > 0.6 ? 'right' : 'left';
      ctx.fillText('óptimo real', plano.sx(pOptReal) + (pOptReal > 0.6 ? -4 : 4), plano.y1 + 2);
      ctx.restore();
      // Conducta actual
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(plano.sx(p), plano.y1); ctx.lineTo(plano.sx(p), plano.y0); ctx.stroke();
      SER.forEach(([f, c], k) => VIZ.marcador(ctx, plano.sx(p), plano.sy((f(p) / maximos[k]) * 100), c, 4.5));
      if (hover != null) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plano.sx(hover), plano.y1); ctx.lineTo(plano.sx(hover), plano.y0); ctx.stroke();
      }
      // Fichas SMART
      smart.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'SMART:'), ...SMART.map((l, i) => VIZ.ficha(`${l} ${kpi.smart[i] ? '✓' : '✗'} ${SMART_NOMBRE[i]}`, { color: kpi.smart[i] ? C.s6 : C.s8, tinta: kpi.smart[i] ? C.s6 : C.s8 })));
      const real = resh(p), perdida = (1 - real / resh(pOptReal)) * 100;
      registro.textContent = `${kpi.nombre}: ${kpi.texto} Con ${Math.round(p * 100)} % de esfuerzo, el KPI vale ${kpi.fmt(kpi.valor(p))} y se resuelven ${VIZ.fmt(real, 3)} casos por hora${perdida > 0.5 ? ` (${VIZ.fmt(perdida, 2)} % menos que el mejor posible)` : ''}.`;
      lectura.set([
        ['duración de la llamada', `${VIZ.fmt(tmo(p), 3)} min`],
        ['llamadas por hora', VIZ.fmt(llam(p), 3)],
        ['resolución al primer contacto', `${VIZ.fmt(fcr(p) * 100, 3)} %`],
        ['casos resueltos por hora', VIZ.fmt(real, 3)],
        ['satisfacción', `${VIZ.fmt(csat(p), 3)} / 100`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover != null) { hover = null; dibujar(); } return tip.ocultar(); }
      hover = Math.round(plano.ix(x) * 100) / 100;
      dibujar();
      tip.mostrar(x, y, `esfuerzo <b>${Math.round(hover * 100)} %</b>` + SER.map(([f, c, t, fm]) => VIZ.filaTooltip(c, t, fm(f(hover)))).join('') + `<br>resolución 1.er contacto <b>${VIZ.fmt(fcr(hover) * 100, 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      p = Math.min(1, Math.max(0, Math.round(plano.ix(x) * 100) / 100)); rP.valor = Math.round(p * 100); dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('kpi-fundamentals', {
    intro: String.raw`
      <p>Un <strong>indicador clave de desempeño</strong> (<em>Key Performance Indicator</em>, KPI) es un número que resume qué tan bien una organización avanza hacia un objetivo
      estratégico: los ingresos del trimestre, la fuga de clientes o la disponibilidad de un servicio. No todo lo que se puede medir es un KPI: una <em>métrica operacional</em>
      (horas de capacitación, líneas cubiertas por pruebas) apoya la gestión diaria, y solo se vuelve clave cuando se conecta con un objetivo.</p>
      <p>Los indicadores se clasifican por su naturaleza (<em>financieros</em> o <em>no financieros</em>) y por su momento: los <em>rezagados</em> miden resultados ya ocurridos y los
      <em>adelantados</em> miden procesos que anticipan esos resultados. Un indicador mal definido es peor que ninguno, porque las personas se ajustan a lo que se mide.</p>`,
    visualizaciones: [
      {
        titulo: 'Mapa de indicadores',
        descripcion: 'Doce indicadores clasificados como financieros o no financieros, adelantados o rezagados. Haga clic en uno para ver su fórmula y use «Resaltar» para aislar un tipo, por ejemplo solo los adelantados.',
        montar: montarMapa,
      },
      {
        titulo: 'Un KPI mal definido induce mala conducta',
        descripcion: 'Un centro de atención se mide primero por «llamadas por hora». Pulse «Que el equipo optimice» con cada definición y compare cuántos casos se resuelven de verdad y cómo queda la satisfacción.',
        montar: montarConducta,
      },
    ],
    teoria: String.raw`
      <h2>Qué es un KPI</h2>
      <p>Un KPI es una función de datos de la organización, con fórmula, unidad, fuente, periodicidad y responsable, que se compara con una meta. Para un conjunto de observaciones \(x_1,\dots,x_n\):</p>
      \[ \text{KPI} = g(x_1,\dots,x_n), \qquad \text{desviación} = \frac{\text{KPI} - \text{meta}}{\text{meta}}. \]
      <p>El mismo cálculo con otra definición («llamadas» frente a «casos resueltos») cambia las decisiones que la gente toma.</p>
      <h2>Clasificación</h2>
      <table>
        <tr><th>Criterio</th><th>Tipos</th><th>Ejemplo</th></tr>
        <tr><td>Naturaleza</td><td>financiero / no financiero</td><td>margen operacional / NPS</td></tr>
        <tr><td>Momento</td><td>rezagado (resultado) / adelantado (proceso)</td><td>fuga de clientes / tiempo de primera respuesta</td></tr>
        <tr><td>Rol</td><td>KPI (estratégico) / métrica operacional</td><td>disponibilidad / horas de capacitación</td></tr>
      </table>
      <p>Un tablero sano mezcla ambos momentos: los rezagados confirman si la estrategia funcionó, los adelantados permiten corregir a tiempo. Una cadena habitual es
      <em>capacitación → tiempo de respuesta → satisfacción → retención → ingresos</em>.</p>
      <h2>Atributos de un buen indicador: SMART</h2>
      <p>Específico (qué se mide y cómo se calcula), <strong>M</strong>edible (hay dato confiable), <strong>A</strong>lcanzable (la meta es posible), <strong>R</strong>elevante (se vincula con un objetivo)
      y con <strong>T</strong>iempo (periodicidad y plazo). A esto se suma que cada indicador tenga un dueño que pueda influir en él.</p>
      <h2>Ejemplo resuelto: «llamadas por hora»</h2>
      <p>En el modelo de la figura, el esfuerzo \(p\) por acortar llamadas reduce la duración \(t(p) = 12 - 8p\) minutos y la resolución al primer contacto \(r(p) = 0{,}88 - 0{,}55\,p^2\).
      Los casos resueltos por hora son</p>
      \[ R(p) = \frac{60}{12 - 8p}\; r(p). \]
      <p>Con \(p=0{,}3\): \(t = 9{,}6\) min, \(60/t = 6{,}25\) llamadas/h, \(r = 0{,}83\) y \(R \approx 5{,}2\) casos/h. Si el KPI es «llamadas por hora», el equipo lleva \(p\) a 1: 15 llamadas/h,
      pero \(r = 0{,}33\) y \(R \approx 4{,}95\) casos/h, con una satisfacción mucho menor. El máximo real está cerca de \(p \approx 0{,}7\). Un KPI con piso de calidad
      (\(r \ge 0{,}70\)) lleva a \(p \approx 0{,}57\) y \(R \approx 5{,}7\) casos/h.</p>
      <div class="recuadro"><p><strong>Ley de Goodhart.</strong> Cuando una medida se convierte en objetivo, deja de ser una buena medida. Defina cada KPI junto con una medida de calidad que lo contrapese.</p></div>
      <h2>Conexiones</h2>
      <p>La forma de calcular un KPI desde un registro de eventos se estudia en <a href="tema.html?id=kpi-definition">definición de KPIs en minería de procesos</a>. Los KPI se organizan como
      <a href="tema.html?id=okr-framework">objetivos y resultados clave</a>, se alinean en un <a href="tema.html?id=strategy-aligned-indicators">mapa estratégico</a>, se acompañan de
      <a href="tema.html?id=targets-thresholds">metas y umbrales</a> y se presentan en <a href="tema.html?id=control-dashboards">tableros de control</a>.</p>`,
  });
})();
