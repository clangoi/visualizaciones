(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  const dinero = (v) => `$${VIZ.entero(v)}`;

  /* ---------- Fig. 1: de las fuentes a la decisión ---------- */

  const ETAPAS = [
    { n: 'Fuentes', d: 'Fuentes: los sistemas operativos (caja de tienda, sitio web, facturación) registran cada venta; están hechos para operar, no para analizar.' },
    { n: 'ETL', d: 'ETL: se extraen las filas, se corrigen formatos y claves, y se rechazan las inconsistentes antes de cargarlas.' },
    { n: 'Almacén', d: 'Almacén de datos: repositorio integrado e histórico, organizado por temas (ventas), donde todas las áreas consultan lo mismo.' },
    { n: 'Análisis', d: 'Análisis (BI): consultas, informes y tableros que resumen el almacén para responder preguntas del negocio.' },
    { n: 'Decisión', d: 'Decisión: una persona (o una regla) usa el informe para actuar; aquí, revisar el precio o el costo de lo que rinde poco.' },
  ];

  function montarFlujo(cuerpo) {
    let semilla = 1, minimo = 0.4, paso = 0, info = -1, datos = [], buenas = [], malas = 0, prod = [], cajas = [], barras = [], hover = -1;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Margen mínimo exigido', min: 0.3, max: 0.5, paso: 0.005, valor: minimo, formato: pct, alCambiar: (v) => { minimo = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w >= 620 ? 250 : 410) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'etapa pendiente' }, { color: C.s2, texto: 'etapa que acaba de ejecutarse' }, { color: C.tinta, texto: 'etapa completada' },
      { color: C.s1, texto: 'margen calculado' }, { color: C.s6, texto: 'margen suficiente' }, { color: C.s8, texto: 'bajo el mínimo' }, { color: C.tinta, texto: 'margen mínimo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para avanzar etapa por etapa, o «Reproducir». Haga clic en una etapa para leer qué hace, y mueva el margen mínimo para cambiar la decisión sin repetir el análisis.');

    function iniciar() {
      datos = S.ventas(semilla, 24, 14);
      const rnd = VIZ.semilla(semilla * 977 + 5);
      buenas = []; malas = 0;
      for (const f of datos) { if (rnd() < 0.04) malas++; else buenas.push(f); }
      const ing = S.agrupar(buenas, ['producto'], 'ingreso'), cos = S.agrupar(buenas, ['producto'], 'costo');
      prod = ing.map((g, i) => ({ nombre: g.clave[0], ingreso: g.valor, margen: 1 - cos[i].valor / g.valor }));
      paso = 0; info = -1;
      return (function* () { for (let k = 1; k <= 5; k++) { paso = k; info = -1; yield; } })();
    }
    const bajos = () => prod.filter((p) => p.margen < minimo);
    function texto() {
      if (info >= 0) return ETAPAS[info].d;
      if (paso === 0) return 'Hay 336 ventas simuladas en los sistemas operativos. Pulse «Un paso» para llevarlas hacia una decisión.';
      if (paso === 1) return `Extracción: ${datos.length} filas de ventas salen de los sistemas operativos.`;
      if (paso === 2) return `ETL: ${malas} filas se rechazan por datos incompletos o inconsistentes; ${buenas.length} se transforman y avanzan.`;
      if (paso === 3) return `Almacén: ${buenas.length} filas integradas por producto, región, canal y mes, conservadas con su historia.`;
      if (paso === 4) return `Análisis: el informe de margen por producto resume ${buenas.length} filas en ${prod.length} cifras comparables.`;
      const b = bajos();
      return b.length ? `Decisión: ${b.map((p) => p.nombre).join(' y ')} rinde${b.length > 1 ? 'n' : ''} menos que el ${pct(minimo)} exigido; conviene revisar precio o costo.` : `Decisión: ningún producto queda bajo el margen mínimo de ${pct(minimo)}; se mantiene la política de precios.`;
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ancha = W >= 620, pad = 8;
      const cont = [`${datos.length} filas`, `${malas} rechazadas`, `${buenas.length} filas`, `${prod.length} productos`, `${bajos().length} a revisar`];
      cajas = [];
      ETAPAS.forEach((e, i) => {
        const gap = ancha ? 26 : 14, w = ancha ? (W - 2 * pad - 4 * gap) / 5 : W - 2 * pad, h = ancha ? 84 : 42;
        const x = ancha ? pad + i * (w + gap) : pad, y = ancha ? 10 : 8 + i * (h + gap);
        cajas.push({ x, y, w, h });
        const alcanzada = paso >= i + 1, actual = paso === i + 1;
        ctx.save();
        ctx.fillStyle = alcanzada ? C.neutro : C.superficie;
        ctx.strokeStyle = actual ? C.s2 : alcanzada ? C.tinta : C.inactivo;
        ctx.lineWidth = actual ? 3 : 1.5;
        if (!alcanzada) ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = alcanzada ? C.tinta : C.apagado; ctx.textBaseline = 'middle';
        if (ancha) { ctx.textAlign = 'center'; ctx.fillText(e.n, x + w / 2, y + 30); ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; if (alcanzada) ctx.fillText(cont[i], x + w / 2, y + 56); }
        else { ctx.textAlign = 'left'; ctx.fillText(e.n, x + 12, y + h / 2); ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; if (alcanzada) ctx.fillText(cont[i], x + w - 12, y + h / 2); }
        if (i < 4) {
          ctx.strokeStyle = paso > i + 1 ? C.tinta : C.tenue; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2;
          const [x1, y1, x2, y2] = ancha ? [x + w + 3, y + h / 2, x + w + gap - 3, y + h / 2] : [x + w / 2, y + h + 2, x + w / 2, y + h + gap - 2];
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.beginPath();
          if (ancha) { ctx.moveTo(x2, y2); ctx.lineTo(x2 - 6, y2 - 4); ctx.lineTo(x2 - 6, y2 + 4); } else { ctx.moveTo(x2, y2); ctx.lineTo(x2 - 4, y2 - 6); ctx.lineTo(x2 + 4, y2 - 6); }
          ctx.fill();
        }
      });
      barras = [];
      if (paso >= 4) {
        const y0 = ancha ? 122 : 8 + 5 * 56 + 6, izq = 84, der = 54, esc = (v) => izq + (v / 0.6) * (W - izq - der);
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Margen por producto = (ingreso − costo) / ingreso', pad, y0);
        prod.forEach((p, i) => {
          const y = y0 + 22 + i * 30;
          ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = VIZ.fuente(11);
          ctx.fillText(p.nombre, pad, y + 11);
          ctx.fillStyle = paso >= 5 ? (p.margen < minimo ? C.s8 : C.s6) : C.s1;
          if (i === hover) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.7);
          ctx.beginPath(); ctx.roundRect(izq, y, esc(p.margen) - izq, 22, [0, 4, 4, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.fillText(pct(p.margen), esc(p.margen) + 6, y + 11);
          barras.push({ y, h: 22, p });
        });
        if (paso >= 5) {
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(esc(minimo), y0 + 18); ctx.lineTo(esc(minimo), y0 + 22 + 3 * 30); ctx.stroke();
        }
      }
      registro.textContent = texto();
      const ingTotal = buenas.reduce((s, f) => s + f.ingreso, 0), costoTotal = buenas.reduce((s, f) => s + f.costo, 0);
      lectura.set([
        ['filas extraídas', paso >= 1 ? String(datos.length) : '—'],
        ['rechazadas en el ETL', paso >= 2 ? String(malas) : '—'],
        ['filas en el almacén', paso >= 3 ? String(buenas.length) : '—'],
        ['ingreso consolidado', paso >= 3 ? dinero(ingTotal) : '—'],
        ['margen global', paso >= 4 ? pct(1 - costoTotal / ingTotal) : '—'],
        ['productos a revisar', paso >= 5 ? String(bajos().length) : '—'],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = cajas.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
      if (i >= 0) { info = i; dibujar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      lienzo.canvas.style.cursor = cajas.some((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) ? 'pointer' : 'default';
      const i = barras.findIndex((b) => y >= b.y && y <= b.y + b.h);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const p = barras[i].p;
      tip.mostrar(x, y, `<b>${p.nombre}</b><br>ingreso <b>${dinero(p.ingreso)}</b><br>margen <b>${pct(p.margen)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (datos.length) dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: modelo «qué pasa si» ---------- */

  const P0 = 100, Q0 = 1000; // precio y demanda mensual de referencia
  const PARAMS = [
    { k: 'precio', n: 'Precio' }, { k: 'elast', n: 'Elasticidad' }, { k: 'costo', n: 'Costo variable' }, { k: 'fijos', n: 'Costos fijos' },
  ];
  const demanda = (p, e) => Q0 * Math.pow(p / P0, -e);
  const utilidad = (m, p = m.precio) => demanda(p, m.elast) * (p - m.costo) - m.fijos;

  function montarQueSiPasa(cuerpo) {
    const m = { precio: 100, elast: 2, costo: 40, fijos: 20000 };
    let hover = null, zonas = [], pl = null;
    const ctl = VIZ.controles(cuerpo);
    const rP = ctl.rango({ etiqueta: 'Precio de venta', min: 50, max: 200, valor: m.precio, formato: (v) => `$${v}`, alCambiar: (v) => { m.precio = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Elasticidad de la demanda', min: 1.2, max: 4, paso: 0.1, valor: m.elast, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { m.elast = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo variable por unidad', min: 20, max: 80, valor: m.costo, formato: (v) => `$${v}`, alCambiar: (v) => { m.costo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costos fijos mensuales', min: 0, max: 60000, paso: 1000, valor: m.fijos, formato: dinero, alCambiar: (v) => { m.fijos = v; dibujar(); } });
    ctl.boton('Ir al precio óptimo', () => { const o = optimo(); m.precio = Math.round(Math.min(200, Math.max(50, o))); rP.valor = m.precio; dibujar(); }, { primario: true });

    VIZ.subtitulo(cuerpo, 'Utilidad mensual según el precio');
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'utilidad según el precio', forma: 'linea' }, { color: C.s2, texto: 'precio elegido' }, { color: C.s6, texto: 'precio óptimo' },
      { color: C.s1, texto: 'efecto de −10 % en un supuesto' }, { color: C.s2, texto: 'efecto de +10 %' },
    ]);
    VIZ.subtitulo(cuerpo, 'Sensibilidad: cuánto cambia la utilidad si cada supuesto varía ±10 %');
    const lienzo2 = VIZ.lienzo(cuerpo, { altoFn: () => 4 * 46 + 16 });
    const tip2 = VIZ.tooltip(lienzo2);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva cualquier supuesto: el modelo recalcula la demanda (1000 unidades a $100, con elasticidad e) y la utilidad. Pase el cursor sobre la curva para leer el valor de cada precio y sobre las barras para ver el efecto exacto. El segundo gráfico dice qué supuesto conviene investigar mejor.');

    function optimo() {
      let mejor = 50, u = -Infinity;
      for (let p = 50; p <= 200; p += 0.5) { const v = utilidad(m, p); if (v > u) { u = v; mejor = p; } }
      return mejor;
    }
    function sensib() {
      const base = utilidad(m);
      return PARAMS.map((q) => {
        const con = (f) => utilidad({ ...m, [q.k]: m[q.k] * f });
        return { ...q, lo: con(0.9) - base, hi: con(1.1) - base };
      }).sort((a, b) => Math.max(Math.abs(b.lo), Math.abs(b.hi)) - Math.max(Math.abs(a.lo), Math.abs(a.hi)));
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pts = [];
      for (let p = 50; p <= 200; p += 1) pts.push([p, utilidad(m, p)]);
      const ys = pts.map((q) => q[1]);
      const ymin = Math.min(0, ...ys), ymax = Math.max(1, ...ys) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 50, xmax: 200, ymin: ymin * 1.1, ymax }, { etiquetaX: 'precio', etiquetaY: 'utilidad mensual', formatoY: (v) => dinero(v), formatoX: (v) => `$${v}`, margen: { izq: 74 } });
      pl.ejes();
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(0)); ctx.lineTo(pl.x1, pl.sy(0)); ctx.stroke(); ctx.setLineDash([]);
      VIZ.trazar(ctx, pl, pts, C.s1, 2);
      const o = optimo();
      VIZ.marcador(ctx, pl.sx(o), pl.sy(utilidad(m, o)), C.s6, 6);
      VIZ.marcador(ctx, pl.sx(m.precio), pl.sy(utilidad(m)), C.s2, 6);
      if (hover != null) VIZ.marcador(ctx, pl.sx(hover), pl.sy(utilidad(m, hover)), C.tinta, 4);

      const sen = sensib();
      const { ctx: c2, ancho: W } = lienzo2;
      lienzo2.limpiar();
      const lim = Math.max(1, ...sen.map((s) => Math.max(Math.abs(s.lo), Math.abs(s.hi)))) * 1.25, izq = 104, cx = izq + (W - izq - 8) / 2, esc = (W - izq - 16) / 2 / lim;
      zonas = [];
      sen.forEach((s, i) => {
        const y = 8 + i * 46;
        zonas.push([y - 4, y + 42, s]);
        c2.fillStyle = i === hoverT() ? C.neutro : 'transparent'; c2.fillRect(0, y - 4, W, 46);
        c2.font = VIZ.fuente(11, 500); c2.fillStyle = C.tinta2; c2.textAlign = 'left'; c2.textBaseline = 'middle';
        c2.fillText(s.n, 6, y + 19);
        [[s.lo, C.s1, 4], [s.hi, C.s2, 22]].forEach(([d, col, dy]) => {
          const x = cx + Math.min(0, d * esc), w = Math.max(1, Math.abs(d * esc));
          c2.fillStyle = col; c2.beginPath(); c2.roundRect(x, y + dy - 4, w, 14, d < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0]); c2.fill();
          c2.fillStyle = C.tinta; c2.font = VIZ.fuente(10, 600); c2.textAlign = d < 0 ? 'right' : 'left';
          c2.fillText(dinero(d).replace('$-', '−$'), d < 0 ? x - 4 : x + w + 4, y + dy + 3);
        });
      });
      c2.strokeStyle = C.apagado; c2.lineWidth = 1.5; c2.beginPath(); c2.moveTo(cx, 2); c2.lineTo(cx, 4 * 46 + 8); c2.stroke();

      const uo = utilidad(m, o);
      registro.textContent = `Con precio $${m.precio} se venden ${VIZ.entero(demanda(m.precio, m.elast))} unidades y la utilidad es ${dinero(utilidad(m))}. ` +
        `El mejor precio ($${o}) daría ${dinero(uo)}; la fórmula P* = e·c/(e−1) da $${VIZ.fmt(m.elast * m.costo / (m.elast - 1), 4)}.`;
      lectura.set([
        ['unidades vendidas', VIZ.entero(demanda(m.precio, m.elast))],
        ['utilidad con el precio elegido', dinero(utilidad(m))],
        ['precio óptimo', `$${o}`],
        ['utilidad en el óptimo', dinero(uo)],
        ['margen unitario', `$${m.precio - m.costo}`],
        ['supuesto más sensible', sen[0].n],
      ]);
    }
    const hoverT = () => hoverTorn;
    let hoverTorn = -1;
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(50, Math.min(200, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `precio <b>$${hover}</b><br>demanda <b>${VIZ.entero(demanda(hover, m.elast))}</b> u.<br>utilidad <b>${dinero(utilidad(m, hover))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (pl && pl.dentro(x, y)) { m.precio = Math.max(50, Math.min(200, Math.round(pl.ix(x)))); rP.valor = m.precio; dibujar(); }
    });
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      const i = zonas.findIndex(([a, b]) => y >= a && y < b);
      if (i !== hoverTorn) { hoverTorn = i; dibujar(); }
      if (i < 0) return tip2.ocultar();
      const s = zonas[i][2];
      tip2.mostrar(x, y, `<b>${s.n}</b>` + VIZ.filaTooltip(C.s1, '−10 %', dinero(s.lo).replace('$-', '−$')) + VIZ.filaTooltip(C.s2, '+10 %', dinero(s.hi).replace('$-', '−$')));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => { hoverTorn = -1; tip2.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bi-dss', {
    intro: String.raw`
      <p>La <strong>inteligencia de negocios</strong> (<em>business intelligence</em>, BI) es el conjunto de procesos y herramientas que convierte los datos dispersos de una
      organización en información para decidir: se extraen de los sistemas operativos, se limpian, se guardan en un almacén y se resumen en informes y tableros.
      Los <strong>sistemas de soporte a decisiones</strong> (<em>decision support systems</em>, DSS) van un paso más allá: incorporan un <em>modelo</em> que permite explorar alternativas
      («¿qué pasa si subo el precio?») en lugar de solo mirar lo ocurrido.</p>
      <p>En la primera figura recorra la cadena completa con 336 ventas simuladas; en la segunda juegue con un modelo de precio y demanda, y vea qué supuesto pesa más en el resultado.</p>`,
    visualizaciones: [
      {
        titulo: 'De las fuentes a la decisión',
        descripcion: 'Avance etapa por etapa y observe cuántas filas sobreviven en cada una. Al final mueva el margen mínimo exigido: la misma tabla de resultados lleva a otra decisión.',
        montar: montarFlujo,
      },
      {
        titulo: 'Modelo «qué pasa si»',
        descripcion: 'Cambie el precio y la elasticidad y busque la cima de la curva; luego mire cuál supuesto mueve más la utilidad. Pruebe elasticidades cercanas a 1,2 y costos altos.',
        montar: montarQueSiPasa,
      },
    ],
    teoria: String.raw`
      <h2>Arquitectura de un sistema de BI</h2>
      <p>Una arquitectura clásica de BI tiene cinco capas, cada una con una tarea distinta:</p>
      <table>
        <tr><th>Capa</th><th>Qué hace</th><th>Ejemplo en una cadena comercial</th></tr>
        <tr><td>Fuentes</td><td>Registran las transacciones del día a día</td><td>Caja de tienda, sitio web, facturación</td></tr>
        <tr><td>ETL</td><td>Extrae, transforma y carga (ver <a href="tema.html?id=etl-process">el proceso ETL</a>)</td><td>Unifica formatos de fecha y códigos de región</td></tr>
        <tr><td>Almacén</td><td>Guarda datos integrados e históricos (ver <a href="tema.html?id=data-warehouse-marts">almacenes y data marts</a>)</td><td>Hechos de ventas por mes, región y producto</td></tr>
        <tr><td>Análisis</td><td>Consultas, informes, <a href="tema.html?id=olap-queries">cubos OLAP</a> y <a href="tema.html?id=dashboards-reports">tableros</a></td><td>Margen por producto, ventas por trimestre</td></tr>
        <tr><td>Decisión</td><td>Una persona o una regla actúa sobre lo visto</td><td>Revisar el precio de un producto de bajo margen</td></tr>
      </table>
      <h2>Tipos de decisión y de sistema</h2>
      <p>Según Simon y Gorry–Scott Morton, las decisiones se clasifican por cuán claro es el procedimiento para tomarlas:</p>
      <table>
        <tr><th>Decisión</th><th>Características</th><th>Apoyo típico</th></tr>
        <tr><td>Estructurada</td><td>Procedimiento conocido y repetible</td><td>Regla automática: reponer inventario bajo el punto de pedido</td></tr>
        <tr><td>Semiestructurada</td><td>Parte del procedimiento es conocida, parte requiere juicio</td><td>DSS con modelos: fijar el precio de una línea de productos</td></tr>
        <tr><td>No estructurada</td><td>Sin procedimiento: situaciones nuevas, inciertas</td><td>Información de contexto y discusión: entrar a un mercado nuevo</td></tr>
      </table>
      <p>El BI responde sobre todo <em>qué pasó</em> y <em>por qué</em>; un DSS agrega <em>qué pasaría si</em> y, con optimización, <em>qué conviene hacer</em>.</p>
      <h2>Ejemplo resuelto: modelo de precio</h2>
      <p>Con demanda de elasticidad constante \(e\) y costo variable \(c\) por unidad, la utilidad mensual es</p>
      \[ U(P) = Q(P)\,(P - c) - F, \qquad Q(P) = Q_0\left(\frac{P}{P_0}\right)^{-e}. \]
      <p>Derivando e igualando a cero, el precio que maximiza la utilidad (para \(e &gt; 1\)) no depende de \(Q_0\) ni de \(F\):</p>
      \[ P^{*} = \frac{e\,c}{e-1}. \]
      <p>Con \(e = 2\) y \(c = 40\) u.m., \(P^{*} = 80\); se venden \(1000\,(0{,}8)^{-2} \approx 1\,563\) unidades y, con \(F = 20\,000\), \(U = 1\,563\cdot 40 - 20\,000 \approx 42\,500\) u.m.
      A un precio de 100 se venden 1 000 unidades y \(U = 1\,000\cdot 60 - 20\,000 = 40\,000\) u.m.: el modelo cuantifica lo que cuesta no ajustar el precio.</p>
      <div class="recuadro"><p><strong>Análisis de sensibilidad.</strong> Variar un supuesto a la vez (±10 %) y registrar \(\Delta U\) ordena los supuestos por importancia. Es una herramienta simple, pero ignora que los
      supuestos pueden variar juntos; para eso se usan escenarios o simulación.</p></div>
      <h2>Conexiones</h2>
      <p>Los resultados del BI son la materia prima de los <a href="tema.html?id=kpi-fundamentals">indicadores de gestión</a>; los modelos de un DSS se extienden con
      <a href="tema.html?id=big-data-predictive">análisis predictivo</a>; y la calidad de lo que sale depende de la <a href="tema.html?id=information-quality">calidad de la información</a> que entra.</p>`,
  });
})();
