(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;

  const MIN_ANIO = 365 * 24 * 60;
  const duracion = (min) => (min >= 1440 ? `${VIZ.fmt(min / 1440, 3)} días` : min >= 60 ? `${VIZ.fmt(min / 60, 3)} h` : min >= 1 ? `${VIZ.fmt(min, 3)} min` : `${VIZ.fmt(min * 60, 3)} s`);
  const nueves = (a) => (a >= 1 ? Infinity : -Math.log10(1 - a));
  const pct = (a) => (a >= 1 ? '100 %' : `${(a * 100).toFixed(Math.min(9, Math.max(2, Math.ceil(nueves(a)))))} %`);

  /* ---------- Fig. 1: escalar hacia arriba o hacia los lados ---------- */

  // Máquina de s núcleos: capacidad con rendimientos decrecientes y precio creciente más que proporcional.
  const capVert = (s) => 120 * Math.pow(s, 0.8);       // solicitudes por segundo
  const precioVert = (s) => 1500 * Math.pow(s, 1.25);  // USD por año
  const NUCLEOS_MAX = 64, SERVIDOR_NUCLEOS = 2, N_MAX = 64;

  function montarEscalas(cuerpo) {
    let alfa = 0.02, beta = 0.0005, demanda = 1500, vert = [], horiz = [], pl = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Demanda a atender', min: 100, max: 3500, paso: 50, valor: demanda, formato: (v) => `${VIZ.entero(v)} sol/s`, alCambiar: (v) => { demanda = v; calcular(); } });
    ctl.rango({ etiqueta: 'Contención α (parte que no se paraleliza)', min: 0, max: 0.1, paso: 0.005, valor: alfa, formato: (v) => `${VIZ.fmt(v * 100, 3)} %`, alCambiar: (v) => { alfa = v; calcular(); } });
    ctl.rango({ etiqueta: 'Coordinación β entre servidores', min: 0, max: 0.002, paso: 0.0001, valor: beta, formato: (v) => `${VIZ.fmt(v * 100, 2)} %`, alCambiar: (v) => { beta = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: `vertical: una máquina más grande (hasta ${NUCLEOS_MAX} núcleos)`, forma: 'linea' },
      { color: C.s2, texto: `horizontal: más servidores de ${SERVIDOR_NUCLEOS} núcleos`, forma: 'linea' },
      { color: C.apagado, texto: 'demanda', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada curva muestra la capacidad que se logra gastando más. Suba la contención o la coordinación y vea cómo la curva horizontal se aplana (e incluso baja) mientras que la vertical sigue creciendo, pero a un precio mayor. Pase el cursor para comparar con el mismo presupuesto.');

    function calcular() {
      vert = Array.from({ length: NUCLEOS_MAX }, (_, i) => ({ k: i + 1, costo: precioVert(i + 1) / 1000, cap: capVert(i + 1) }));
      const c2 = capVert(SERVIDOR_NUCLEOS), p2 = precioVert(SERVIDOR_NUCLEOS);
      horiz = Array.from({ length: N_MAX }, (_, i) => { const n = i + 1; return { k: n, costo: n * p2 / 1000, cap: n * c2 / (1 + alfa * (n - 1) + beta * n * (n - 1)) }; });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...vert.map((p) => p.cap), ...horiz.map((p) => p.cap), demanda) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 280, ymin: 0, ymax }, { etiquetaX: 'costo anual (miles de USD)', etiquetaY: 'capacidad (solicitudes/s)', formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, demanda], [280, demanda]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, vert.map((p) => [p.costo, p.cap]), C.s1, 2);
      VIZ.trazar(ctx, pl, horiz.map((p) => [p.costo, p.cap]), C.s2, 2);
      if (hover) { VIZ.marcador(ctx, pl.sx(hover.v.costo), pl.sy(hover.v.cap), C.s1, 4.5); VIZ.marcador(ctx, pl.sx(hover.h.costo), pl.sy(hover.h.cap), C.s2, 4.5); }
      const v = vert.find((p) => p.cap >= demanda), h = horiz.find((p) => p.cap >= demanda);
      const nstar = beta > 0 ? Math.sqrt((1 - alfa) / beta) : Infinity;
      const pico = Math.max(...horiz.map((p) => p.cap));
      registro.textContent = `Para ${VIZ.entero(demanda)} sol/s: ${v ? `una sola máquina de ${v.k} núcleos cuesta $${VIZ.entero(v.costo * 1000)} al año` : `ninguna máquina de hasta ${NUCLEOS_MAX} núcleos alcanza`}; ${h ? `${h.k} servidores pequeños cuestan $${VIZ.entero(h.costo * 1000)}` : `ninguna cantidad de servidores pequeños alcanza (la capacidad se estanca en ${VIZ.entero(pico)} sol/s)`}.`;
      lectura.set([
        ['vertical: máquina necesaria', v ? `${v.k} núcleos, $${VIZ.entero(v.costo * 1000)}/año` : 'no existe'],
        ['horizontal: servidores necesarios', h ? `${h.k}, $${VIZ.entero(h.costo * 1000)}/año` : 'no alcanza'],
        ['eficiencia con 16 servidores', `${VIZ.fmt(100 * horiz[15].cap / (16 * capVert(SERVIDOR_NUCLEOS)), 3)} %`],
        ['servidores con la máxima capacidad', Number.isFinite(nstar) ? VIZ.fmt(nstar, 3) : 'sin límite'],
        ['si falla una unidad', 'vertical: se pierde todo; horizontal: se pierde 1/n'],
      ]);
    }
    lienzo.alDibujar = () => vert.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover) { hover = null; dibujar(); } return tip.ocultar(); }
      const c = pl.ix(x), mejor = (a) => a.reduce((m, p) => (p.costo <= c ? p : m), a[0]);
      hover = { v: mejor(vert), h: mejor(horiz) };
      dibujar();
      tip.mostrar(x, y, `presupuesto <b>$${VIZ.entero(c * 1000)}</b>/año` + VIZ.filaTooltip(C.s1, `vertical (${hover.v.k} núcleos)`, VIZ.entero(hover.v.cap) + ' sol/s') + VIZ.filaTooltip(C.s2, `horizontal (${hover.h.k} servidores)`, VIZ.entero(hover.h.cap) + ' sol/s'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); if (vert.length) dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: disponibilidad en serie y en paralelo ---------- */

  const CAPAS = [
    { n: 'Balanceador', fija: 0.9995 },
    { n: 'Web', fija: null },
    { n: 'Aplicación', fija: null },
    { n: 'Base de datos', fija: null },
  ];
  const MAX_REP = 4;

  function montarSerieParalelo(cuerpo) {
    let a = 0.995, rep = [1, 1, 1, 1], caidos = CAPAS.map(() => []), modo = 'rep', cajas = [], zonaCapas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Disponibilidad de cada servidor', opciones: [['0.99', '99 %'], ['0.995', '99,5 %'], ['0.999', '99,9 %'], ['0.9999', '99,99 %']], valor: '0.995',
      alCambiar: (v) => { a = +v; dibujar(); },
    });
    ctl.selector({
      etiqueta: 'Al hacer clic', opciones: [['rep', 'Cambiar réplicas de la capa'], ['fallo', 'Apagar o encender un servidor']], valor: 'rep',
      alCambiar: (v) => { modo = v; dibujar(); },
    });
    ctl.boton('Un servidor por capa', () => { rep = [1, 1, 1, 1]; caidos = CAPAS.map(() => []); dibujar(); });
    ctl.boton('Todo duplicado', () => { rep = [2, 2, 2, 2]; caidos = CAPAS.map(() => []); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 290 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'servidor en servicio' },
      { color: C.s8, texto: 'servidor apagado' },
      { color: C.superficie, borde: C.s8, texto: 'capa sin ningún servidor: el sistema cae' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las capas están en serie (todas deben funcionar) y los servidores de cada capa en paralelo (basta uno). Haga clic en una capa para agregar réplicas, o cambie a «Apagar o encender» para ver qué falla deja el sistema sin servicio. Pase el cursor para ver el aporte de cada capa.');

    const base = (i) => CAPAS[i].fija || a;
    const dispCapa = (i, r = rep[i]) => S.dispParalelo(...Array(r).fill(base(i)));
    const dispSis = (reps = rep) => S.dispSerie(...CAPAS.map((_, i) => dispCapa(i, reps[i])));
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      cajas = []; zonaCapas = [];
      const cw = (W - 16) / (CAPAS.length + 1), sh = 24;
      const ups = CAPAS.map((_, i) => rep[i] - caidos[i].length);
      const cae = ups.some((u) => u <= 0);
      CAPAS.forEach((c, i) => {
        const x = 8 + i * cw, w = cw - 14, mala = ups[i] <= 0;
        zonaCapas.push({ x: x - 3, y: 4, w: w + 6, h: 4 + MAX_REP * 30 + 6, i });
        ctx.fillStyle = C.neutro; ctx.strokeStyle = mala ? C.s8 : C.rejilla; ctx.lineWidth = mala ? 3 : 1;
        ctx.beginPath(); ctx.roundRect(x - 3, 4, w + 6, 4 + MAX_REP * 30 + 6, 4); ctx.fill(); ctx.stroke();
        for (let r = 0; r < rep[i]; r++) {
          const y = 10 + r * 30, abajo = caidos[i].includes(r);
          ctx.fillStyle = abajo ? C.s8 : C.s1; ctx.beginPath(); ctx.roundRect(x, y, w, sh, 4); ctx.fill();
          ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(abajo ? 'apagado' : 'activo', x + w / 2, y + sh / 2);
          cajas.push({ x, y, w, h: sh, i, r });
        }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(c.n, x + w / 2, 140);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2;
        ctx.fillText(`× ${rep[i]}`, x + w / 2, 156);
        ctx.fillText(pct(dispCapa(i)).replace(' %', ''), x + w / 2, 172);
        ctx.fillText(`${VIZ.fmt(nueves(dispCapa(i)), 3)} nueves`, x + w / 2, 188);
        if (i < CAPAS.length - 1) { ctx.fillStyle = C.apagado; ctx.fillText('×', x + w + 7, 70); }
      });
      const xt = 8 + CAPAS.length * cw, wt = cw - 14, A = dispSis();
      ctx.fillStyle = cae ? C.s8 : C.tinta; ctx.beginPath(); ctx.roundRect(xt, 10, wt, 84, 4); ctx.fill();
      ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Sistema', xt + wt / 2, 36); ctx.font = VIZ.fuente(10);
      ctx.fillText(cae ? 'SIN SERVICIO' : 'en servicio', xt + wt / 2, 56);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'top'; ctx.fillText(pct(A).replace(' %', ''), xt + wt / 2, 140);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(`${VIZ.fmt(nueves(A), 3)} nueves`, xt + wt / 2, 156);
      ctx.fillText('disponib. %', xt + wt / 2, 172);
      ctx.fillStyle = C.apagado; ctx.fillText('disponibilidad de cada capa, en %', 8 + (CAPAS.length * cw) / 2 - 20, 214);
      ctx.font = VIZ.fuente(10);
      const min = S.minutosCaidaAnual(A);
      const peor = CAPAS.map((_, i) => i).reduce((m, i) => (dispCapa(i) < dispCapa(m) ? i : m), 0);
      const mejor = rep.map((r, i) => (i === peor ? r + 1 : r));
      registro.textContent = cae
        ? `Capa «${CAPAS[ups.findIndex((u) => u <= 0)].n}» sin servidores activos: en una cadena en serie, basta que una capa caiga para que todo el sistema caiga.`
        : `El sistema en conjunto tiene ${pct(A)}, peor que su capa más débil («${CAPAS[peor].n}», ${pct(dispCapa(peor))}), porque las capas multiplican sus probabilidades de falla.`;
      lectura.set([
        ['disponibilidad del sistema', pct(A)],
        ['nueves', VIZ.fmt(nueves(A), 3)],
        ['caída esperada al año', duracion(min)],
        ['capa más débil', `${CAPAS[peor].n} (${rep[peor]} servidor${rep[peor] > 1 ? 'es' : ''})`],
        ['una réplica más en esa capa ahorra', rep[peor] >= MAX_REP ? 'ya tiene el máximo' : duracion(min - S.minutosCaidaAnual(dispSis(mejor))) + ' al año'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (modo === 'fallo') {
        const b = cajas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (!b) return;
        const k = caidos[b.i].indexOf(b.r);
        if (k >= 0) caidos[b.i].splice(k, 1); else caidos[b.i].push(b.r);
      } else {
        const z = zonaCapas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (!z) return;
        rep[z.i] = rep[z.i] % MAX_REP + 1; caidos[z.i] = caidos[z.i].filter((r) => r < rep[z.i]);
      }
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), z = zonaCapas.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (!z) return tip.ocultar();
      const i = z.i, u = 1 - base(i);
      tip.mostrar(x, y, `<b>${CAPAS[i].n}</b><br>cada servidor: <b>${pct(base(i))}</b><br>${rep[i]} en paralelo: 1 − ${VIZ.fmt(u, 3)}<sup>${rep[i]}</sup> = <b>${pct(dispCapa(i))}</b><br>caída de la capa: <b>${duracion(S.minutosCaidaAnual(dispCapa(i)))}</b> al año`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: nueves y redundancia ---------- */

  function montarNueves(cuerpo) {
    let objetivo = 4, beta = 0.02, hover = 0, pl = null;
    const COMPS = [[0.99, C.s1, '99 %'], [0.999, C.s2, '99,9 %'], [0.9999, C.s3, '99,99 %']];
    const RMAX = 6, YMIN = 0.001, YMAX = 1e6;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Objetivo de disponibilidad', min: 2, max: 6, paso: 0.5, valor: objetivo, formato: (v) => `${v} nueves (${pct(1 - Math.pow(10, -v))})`, alCambiar: (v) => { objetivo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Fallas de causa común', min: 0, max: 10, paso: 0.5, valor: beta * 100, formato: (v) => `${v} %`, alCambiar: (v) => { beta = v / 100; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...COMPS.map(([, c, t]) => ({ color: c, texto: `servidor de ${t}`, forma: 'linea' })),
      { color: C.tinta, texto: 'caída máxima del objetivo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada curva es la caída anual de un grupo de r servidores idénticos en paralelo (eje vertical logarítmico). Sin fallas de causa común cada réplica gana varios nueves; con 2 % de causa común la curva se aplana. Mueva el objetivo y observe cuántas réplicas hacen falta.');

    const dispReal = (a, r) => Math.min(1, S.dispParalelo(...Array(r).fill(1 - (1 - beta) * (1 - a))) - beta * (1 - a));
    const caida = (a, r) => Math.max(YMIN, S.minutosCaidaAnual(dispReal(a, r)));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0.7, xmax: RMAX + 0.3, ymin: YMIN, ymax: YMAX }, { logY: true, etiquetaX: 'servidores en paralelo (r)', etiquetaY: 'minutos de caída al año', ticksX: [1, 2, 3, 4, 5, 6], formatoY: (v) => (v >= 1 ? VIZ.entero(v) : String(v).replace('.', ',')) });
      pl.ejes();
      const meta = Math.pow(10, -objetivo) * MIN_ANIO;
      VIZ.trazar(ctx, pl, [[0.7, meta], [RMAX + 0.3, meta]], C.tinta, 2, [6, 3]);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`meta: ${duracion(meta)}`, pl.x1 - 4, pl.sy(meta) - 3);
      const necesarias = [];
      COMPS.forEach(([a, c]) => {
        const pts = Array.from({ length: RMAX }, (_, i) => [i + 1, caida(a, i + 1)]);
        VIZ.trazar(ctx, pl, pts, c, 2);
        pts.forEach(([r, m]) => VIZ.marcador(ctx, pl.sx(r), pl.sy(m), c, r === hover ? 5.5 : 3.5));
        let n = null;
        for (let r = 1; r <= RMAX; r++) if (1 - dispReal(a, r) <= Math.pow(10, -objetivo) * (1 + 1e-9)) { n = r; break; }
        necesarias.push(n);
      });
      const limite = beta > 0 ? duracion(beta * MIN_ANIO * 0.01) : null;
      registro.textContent = beta > 0
        ? `Con ${VIZ.fmt(beta * 100, 2)} % de fallas de causa común, ningún número de réplicas baja de β·(1−a) de indisponibilidad: para un servidor de 99 % ese piso es ${duracion(beta * MIN_ANIO * 0.01)} al año, por mucho que se agreguen servidores.`
        : 'Sin causas comunes, cada réplica multiplica la indisponibilidad por (1 − a): ganancia exponencial, pero irreal si los servidores comparten energía, red, versión de software o error humano.';
      lectura.set([
        ['meta', `${objetivo} nueves = ${duracion(meta)} al año`],
        ...COMPS.map(([a], i) => [`réplicas con servidores de ${COMPS[i][2]}`, necesarias[i] ? `${necesarias[i]}` : `más de ${RMAX} o inalcanzable`]),
        ['piso por causa común (servidor de 99 %)', limite ? limite + ' al año' : 'sin piso'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover) { hover = 0; dibujar(); } return tip.ocultar(); }
      const r = Math.max(1, Math.min(RMAX, Math.round(pl.ix(x))));
      if (r !== hover) { hover = r; dibujar(); }
      tip.mostrar(x, y, `<b>${r}</b> servidor${r > 1 ? 'es' : ''} en paralelo` + COMPS.map(([a, c, t]) => VIZ.filaTooltip(c, `de ${t}`, `${pct(dispReal(a, r))}, ${duracion(S.minutosCaidaAnual(dispReal(a, r)))}/año`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = 0; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('scalability-availability', {
    intro: String.raw`
      <p>Dos preguntas rigen el diseño de una infraestructura: <strong>¿qué pasa cuando crece la demanda?</strong> (escalabilidad) y <strong>¿qué pasa cuando algo falla?</strong> (disponibilidad). Se puede escalar
      <em>verticalmente</em>, comprando una máquina más grande, u <em>horizontalmente</em>, sumando más máquinas; y se puede ganar disponibilidad con réplicas que toman el relevo.</p>
      <p>Ambas ideas se calculan: la capacidad rinde cada vez menos por cada peso adicional, y la disponibilidad se mide en «nueves» que se traducen en minutos de caída al año. Con esos números, una frase como «necesitamos alta disponibilidad»
      se vuelve una decisión de ingeniería y de presupuesto. Para el reparto de solicitudes entre servidores, véase también <a href="tema.html?id=scalability-load-balancing">escalabilidad y balanceo de carga</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Escalar hacia arriba o hacia los lados',
        descripcion: 'Compare el costo de lograr una capacidad con una máquina grande o con muchas pequeñas. Suba la contención α y la coordinación β: llega un punto en que sumar servidores deja de ayudar.',
        montar: montarEscalas,
      },
      {
        titulo: 'Disponibilidad en serie y en paralelo',
        descripcion: 'Agregue réplicas a cada capa y mire cómo cambia la disponibilidad del sistema; luego apague servidores para ver cuántos puede perder una capa antes de que todo caiga.',
        montar: montarSerieParalelo,
      },
      {
        titulo: 'Nueves y minutos de caída',
        descripcion: 'Elija cuántos nueves necesita y vea cuántas réplicas lo logran con servidores de distinta calidad. Active las fallas de causa común y observe que las curvas dejan de caer.',
        montar: montarNueves,
      },
    ],
    teoria: String.raw`
      <h2>Escalabilidad</h2>
      <p>Un sistema es <em>escalable</em> si mantiene su desempeño al crecer la carga agregando recursos. En <strong>escalado vertical</strong> se cambia por una máquina más potente (simple, sin cambiar la aplicación, pero con un tope físico, un precio que sube más que la capacidad
      y un único punto de falla). En <strong>escalado horizontal</strong> se suman nodos y se reparte el trabajo (casi sin tope y con tolerancia a fallas, pero exige que la aplicación sea distribuible).</p>
      <p>La ley de escalabilidad universal modela la capacidad de \(n\) nodos, cada uno de capacidad \(C_1\), con una fracción \(\alpha\) de trabajo que se serializa (contención) y un costo \(\beta\) de coordinación entre pares:</p>
      \[ C(n) = \frac{n\,C_1}{1 + \alpha\,(n-1) + \beta\,n\,(n-1)}. \]
      <p>Con \(\beta = 0\) se obtiene la ley de Amdahl, con cota \(C_1/\alpha\). Con \(\beta > 0\) la capacidad tiene un máximo en \(n^{*} = \sqrt{(1-\alpha)/\beta}\) y después disminuye: más servidores empeoran el sistema.</p>
      <h2>Disponibilidad</h2>
      <p>La disponibilidad \(A\) es la fracción del tiempo en que el servicio funciona; la indisponibilidad es \(1 - A\), y la caída esperada al año es \((1-A) \times 525\,600\) minutos. Para componentes independientes:</p>
      \[ A_{\text{serie}} = \prod_{i} A_i, \qquad A_{\text{paralelo}} = 1 - \prod_{i} (1 - A_i). \]
      <table>
        <tr><th>Nueves</th><th>Disponibilidad</th><th>Caída al año</th></tr>
        <tr><td>2</td><td>99 %</td><td>3,65 días</td></tr>
        <tr><td>3</td><td>99,9 %</td><td>8,76 horas</td></tr>
        <tr><td>4</td><td>99,99 %</td><td>52,6 minutos</td></tr>
        <tr><td>5</td><td>99,999 %</td><td>5,26 minutos</td></tr>
        <tr><td>6</td><td>99,9999 %</td><td>31,5 segundos</td></tr>
      </table>
      <h2>Ejemplo resuelto</h2>
      <p>Una aplicación necesita tres capas en serie: web (99,5 %), aplicación (99,5 %) y base de datos (99,9 %).</p>
      \[ A = 0{,}995 \times 0{,}995 \times 0{,}999 = 0{,}98903 \quad\Rightarrow\quad 5\,763\ \text{min} \approx 96\ \text{h al año}. \]
      <p>Duplicando web y aplicación (\(1 - 0{,}005^2 = 0{,}999975\) cada una): \(A = 0{,}999975^2 \times 0{,}999 = 0{,}99895\), unas 9,2 horas al año. Duplicando también la base de datos (\(1 - 0{,}001^2 = 0{,}999999\)):
      \(A = 0{,}99995 \times 0{,}999999 = 0{,}999949\), unos 27 minutos al año. La capa más débil es siempre la mejor candidata a recibir la siguiente réplica.</p>
      <h2>Los límites de la redundancia</h2>
      <p>La fórmula en paralelo supone fallas independientes. Si una fracción \(\beta\) de las fallas afecta a todas las réplicas a la vez (energía, red, un error de configuración desplegado a todos, una actualización defectuosa), con indisponibilidad \(u = 1 - a\) por servidor:</p>
      \[ 1 - A(r) = \beta\,u + \big((1-\beta)\,u\big)^{r}. \]
      <p>Por grande que sea \(r\), la indisponibilidad no baja de \(\beta u\). Por eso la redundancia se complementa con diversidad (zonas, proveedores, versiones) y no solo con más servidores iguales.</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Escalar sirve para absorber la demanda; replicar sirve para sobrevivir a las fallas. A veces la misma pieza hace las dos cosas (varios servidores detrás de un balanceador), pero se justifican con cálculos distintos.</p></div>
      <h2>Conexiones</h2>
      <p>El reparto de carga entre nodos se estudia en <a href="tema.html?id=scalability-load-balancing">balanceo de carga</a>; la propagación de fallas por la pila, en <a href="tema.html?id=it-infrastructure-layers">capas de la infraestructura</a>;
      las respuestas lentas por saturación, en <a href="tema.html?id=client-server-architectures">arquitecturas cliente-servidor</a>; y el costo de la redundancia frente a la nube, en <a href="tema.html?id=cloud-vs-on-premise-costs">costos de la nube y del entorno local</a>.</p>`,
  });
})();
