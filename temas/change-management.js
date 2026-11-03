(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  const GRUPOS = [
    { n: 'Innovadores', cuenta: 5, lo: 0, hi: 0.05, c: VIZ.series[0] },
    { n: 'Adoptantes tempranos', cuenta: 27, lo: 0.05, hi: 0.2, c: VIZ.series[1] },
    { n: 'Mayoría temprana', cuenta: 68, lo: 0.2, hi: 0.5, c: VIZ.series[2] },
    { n: 'Mayoría tardía', cuenta: 68, lo: 0.5, hi: 0.8, c: VIZ.series[3] },
    { n: 'Rezagados', cuenta: 32, lo: 0.8, hi: 1, c: VIZ.series[6] },
  ];
  const N = 200, SEMANAS = 52, BASE = 0.03; // BASE: comunicación general que llega a todos
  const nombresGrupo = GRUPOS.map((g) => g.n);

  // Población y dinámica. Una persona adopta, con probabilidad 0,3 por semana, cuando la exposición supera su umbral.
  // exposición = (1 − w)·(vecinos que adoptaron) + w·(fracción global) + patrocinio + BASE;
  // umbral efectivo = umbral − capacitación (+ 0,3 si es resistente).
  function crear(o) {
    const rnd = VIZ.semilla(o.semilla * 7 + 3), din = VIZ.semilla(o.semilla * 7 + 999);
    const ag = [];
    GRUPOS.forEach((g, gi) => { for (let i = 0; i < g.cuenta; i++) ag.push({ g: gi, th: g.lo + (g.hi - g.lo) * rnd(), res: rnd() < o.res, ad: false }); });
    const orden = ag.map((_, i) => i);
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
    ag.forEach((a, i) => { a.id = orden[i]; }); // posición visible
    const vec = ag.map((_, i) => {
      const l = [];
      for (let d = 1; d <= 3; d++) for (const s of [-1, 1]) { let j = (i + s * d + N) % N; if (rnd() < 0.1) j = Math.floor(rnd() * N); l.push(j); }
      return l;
    });
    (o.campeones || []).forEach((id) => { const a = ag.find((x) => x.id === id); if (a) a.ad = true; });
    const s = {
      ag, semana: 0, curva: [], grupos: [],
      resumen() {
        const t = ag.filter((a) => a.ad).length / N;
        const gr = GRUPOS.map((g, gi) => ag.filter((a) => a.g === gi && a.ad).length / g.cuenta);
        s.curva.push(t); s.grupos.push(gr);
      },
      paso() {
        const gf = ag.filter((a) => a.ad).length / N;
        const nuevo = ag.map((a, i) => {
          if (a.ad) return true;
          const ex = (1 - o.w) * vec[i].filter((j) => ag[j].ad).length / 6 + o.w * gf + o.patro + BASE;
          return ex >= Math.max(0, a.th + (a.res ? 0.3 : 0) - o.capa) && din() < 0.3;
        });
        ag.forEach((a, i) => { a.ad = nuevo[i]; });
        s.semana++; s.resumen();
      },
    };
    s.resumen();
    return s;
  }
  const semanaDe = (curva, u) => { const i = curva.findIndex((v) => v >= u); return i < 0 ? null : i; };

  /* ---------- Fig. 1: difusión del cambio ---------- */

  function montarDifusion(cuerpo) {
    const O = { semilla: 1, patro: 0.08, capa: 0.12, res: 0.1, w: 0.5, campeones: [] };
    let sim = null, pl = null, hover = -1, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Patrocinio de la dirección', min: 0, max: 0.3, paso: 0.01, valor: O.patro, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { O.patro = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Capacitación (baja el umbral)', min: 0, max: 0.3, paso: 0.01, valor: O.capa, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { O.capa = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Personas resistentes', min: 0, max: 0.5, paso: 0.05, valor: O.res, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { O.res = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Peso del boca a boca global', min: 0, max: 1, paso: 0.1, valor: O.w, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { O.w = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevas personas', () => { O.semilla++; O.campeones = []; rep.reiniciar(); });
    const grid = VIZ.lienzo(cuerpo, { altoFn: (w) => 10 * Math.min(28, (w - 16) / 20) + 10 });
    const tip = VIZ.tooltip(grid);
    VIZ.leyenda(cuerpo, GRUPOS.map((g) => ({ color: g.c, texto: g.n, forma: 'punto' })).concat([
      { color: C.inactivo, texto: 'círculo vacío: aún no adopta', forma: 'punto' },
      { color: C.tinta, texto: 'anillo grueso: campeón del cambio', forma: 'punto' },
    ]));
    VIZ.subtitulo(cuerpo, 'Adopción en cada grupo y en toda la organización');
    const curva = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 320 });
    const tip2 = VIZ.tooltip(curva);
    VIZ.leyenda(cuerpo, GRUPOS.map((g) => ({ color: g.c, texto: g.n, forma: 'linea' })).concat([{ color: C.tinta, texto: 'toda la organización', forma: 'linea' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada círculo es una persona de 200; su umbral es la exposición que necesita para adoptar. Haga clic en un círculo para volverlo campeón del cambio (adopta desde el inicio) y reproduzca de nuevo. Los innovadores abren el camino y los rezagados llegan al final, si llegan.');

    function iniciar() {
      sim = crear(O);
      return (function* () {
        for (let t = 1; t <= SEMANAS; t++) {
          sim.paso();
          const n = sim.curva[t], dn = n - sim.curva[t - 1];
          registro.textContent = `Semana ${t}: ${pct(n)} de la organización adoptó el cambio (${dn > 0 ? '+' : ''}${VIZ.fmt(dn * N, 2)} personas). ${n < 0.16 ? 'La exposición solo alcanza a quienes tienen umbrales bajos.' : n < 0.84 ? 'Cada nueva adopción aumenta la exposición de los demás: fase de aceleración.' : 'Solo quedan los umbrales más altos.'}`;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = grid;
      grid.limpiar();
      const cell = Math.min(28, (W - 16) / 20), x0 = (W - 20 * cell) / 2;
      pos = [];
      for (const a of sim.ag) {
        const x = x0 + (a.id % 20 + 0.5) * cell, y = 5 + (Math.floor(a.id / 20) + 0.5) * cell, r = cell * 0.36;
        pos.push({ x, y, a });
        if (O.campeones.includes(a.id)) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        if (a.ad) { ctx.fillStyle = GRUPOS[a.g].c; ctx.fill(); } else { ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = C.inactivo; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      const { ctx: c2 } = curva;
      curva.limpiar();
      pl = VIZ.plano(curva, { xmin: 0, xmax: SEMANAS, ymin: 0, ymax: 1 }, { etiquetaX: 'semana', etiquetaY: 'adopción', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      GRUPOS.forEach((g, gi) => VIZ.trazar(c2, pl, sim.grupos.map((gr, t) => [t, gr[gi]]), g.c, 1.8));
      VIZ.trazar(c2, pl, sim.curva.map((v, t) => [t, v]), C.tinta, 3.5);
      if (hover >= 0 && hover < sim.curva.length) { c2.strokeStyle = C.eje; c2.lineWidth = 1; c2.beginPath(); c2.moveTo(pl.sx(hover), pl.y1); c2.lineTo(pl.sx(hover), pl.y0); c2.stroke(); VIZ.marcador(c2, pl.sx(hover), pl.sy(sim.curva[hover]), C.tinta, 4); }
      const u = sim.grupos[sim.grupos.length - 1];
      lectura.set([
        ['semana', String(sim.semana)],
        ['adopción total', pct(sim.curva[sim.semana])],
        ['innovadores y tempranos', pct((u[0] * 5 + u[1] * 27) / 32)],
        ['mayoría', pct((u[2] * 68 + u[3] * 68) / 136)],
        ['rezagados', pct(u[4])],
        ['semana en que se llega a 50 %', semanaDe(sim.curva, 0.5) === null ? 'aún no' : String(semanaDe(sim.curva, 0.5))],
      ]);
      if (sim.semana === 0) registro.textContent = `Semana 0: ${O.campeones.length ? `${O.campeones.length} campeones` : 'nadie'} adoptó el cambio. Pulse «Reproducir».`;
    }
    grid.alDibujar = () => sim && dibujar();
    curva.alDibujar = () => sim && dibujar();
    grid.canvas.style.cursor = 'pointer';
    const bajo = (ev) => { const { x, y } = grid.posicion(ev); return { x, y, p: pos.find((q) => Math.hypot(q.x - x, q.y - y) < 13) }; };
    grid.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, p } = bajo(ev);
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `<b>${nombresGrupo[p.a.g]}</b><br>umbral <b>${VIZ.fmt(p.a.th + (p.a.res ? 0.3 : 0) - O.capa, 2)}</b>${p.a.res ? ' (resistente)' : ''}<br>${p.a.ad ? 'ya adoptó' : 'aún no adopta'}`);
    });
    grid.canvas.addEventListener('pointerleave', () => tip.ocultar());
    grid.canvas.addEventListener('click', (ev) => {
      const { p } = bajo(ev);
      if (!p) return;
      const k = O.campeones.indexOf(p.a.id);
      if (k >= 0) O.campeones.splice(k, 1); else O.campeones.push(p.a.id);
      rep.reiniciar();
    });
    curva.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = curva.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip2.ocultar(); }
      hover = Math.min(SEMANAS, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      if (hover >= sim.curva.length) return tip2.ocultar();
      tip2.mostrar(x, y, `semana <b>${hover}</b>` + VIZ.filaTooltip(C.tinta, 'total', pct(sim.curva[hover])) + GRUPOS.map((g, gi) => VIZ.filaTooltip(g.c, g.n, pct(sim.grupos[hover][gi]))).join(''));
    });
    curva.canvas.addEventListener('pointerleave', () => { hover = -1; tip2.ocultar(); if (sim) dibujar(); });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: intervenciones ---------- */

  const ESC = [
    { n: 'Sin intervención', c: VIZ.series[0], capa: false, patro: false },
    { n: 'Solo capacitación', c: VIZ.series[1], capa: true, patro: false },
    { n: 'Solo patrocinio', c: VIZ.series[2], capa: false, patro: true },
    { n: 'Ambas', c: VIZ.series[3], capa: true, patro: true },
  ];

  function montarIntervenciones(cuerpo) {
    const O = { semilla: 1, capa: 0.15, patro: 0.1, res: 0.1, w: 0.5 };
    let runs = [], pl = null, hover = -1, geoB = null, hb = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Intensidad de la capacitación', min: 0, max: 0.3, paso: 0.01, valor: O.capa, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { O.capa = v; calcular(); } });
    ctl.rango({ etiqueta: 'Intensidad del patrocinio', min: 0, max: 0.3, paso: 0.01, valor: O.patro, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { O.patro = v; calcular(); } });
    ctl.rango({ etiqueta: 'Personas resistentes', min: 0, max: 0.5, paso: 0.05, valor: O.res, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { O.res = v; calcular(); } });
    ctl.boton('Nuevas personas', () => { O.semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 230, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ESC.map((e) => ({ color: e.c, texto: e.n, forma: 'linea' })));
    VIZ.subtitulo(cuerpo, 'Adopción alcanzada en la semana 52, por grupo');
    const barras = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 220, altoMax: 320 });
    const tip2 = VIZ.tooltip(barras);
    VIZ.leyenda(cuerpo, ESC.map((e) => ({ color: e.c, texto: e.n, forma: 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las cuatro curvas parten de las mismas 200 personas. La capacitación baja los umbrales, así que mueve sobre todo a la mayoría; el patrocinio suma exposición a todos, pero no alcanza a quienes tienen umbrales altos. Combinadas rinden más que por separado. Suba la resistencia y vea qué grupo se queda fuera.');

    function calcular() {
      runs = ESC.map((e) => {
        const s = crear({ semilla: O.semilla, res: O.res, w: O.w, capa: e.capa ? O.capa : 0, patro: e.patro ? O.patro : 0 });
        for (let t = 0; t < SEMANAS; t++) s.paso();
        return s;
      });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: SEMANAS, ymin: 0, ymax: 1 }, { etiquetaX: 'semana', etiquetaY: 'adopción total', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      ESC.forEach((e, i) => VIZ.trazar(ctx, pl, runs[i].curva.map((v, t) => [t, v]), e.c, 2.5));
      if (hover >= 0) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); ESC.forEach((e, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(runs[i].curva[hover]), e.c, 4)); }
      // barras agrupadas
      const { ctx: b, ancho: W, alto: H } = barras;
      barras.limpiar();
      const izq = 40, inf = 34, sup = 10, ancho = (W - izq - 8) / 5, bw = (ancho - 10) / 4;
      geoB = { izq, ancho, bw, sup, inf };
      b.font = VIZ.fuente(10); b.textAlign = 'right'; b.textBaseline = 'middle';
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const y = H - inf - v * (H - inf - sup);
        b.strokeStyle = C.rejilla; b.lineWidth = 1; b.beginPath(); b.moveTo(izq, y + 0.5); b.lineTo(W - 8, y + 0.5); b.stroke();
        b.fillStyle = C.apagado; b.fillText(`${Math.round(v * 100)} %`, izq - 6, y);
      }
      GRUPOS.forEach((g, gi) => {
        ESC.forEach((e, i) => {
          const v = runs[i].grupos[SEMANAS][gi], h = v * (H - inf - sup), x = izq + gi * ancho + 5 + i * bw;
          b.fillStyle = e.c; if (hb === gi) b.globalAlpha = 0.8;
          b.beginPath(); b.roundRect(x + 1, H - inf - h, bw - 2, h, [4, 4, 0, 0]); b.fill(); b.globalAlpha = 1;
        });
        b.fillStyle = C.tinta2; b.textAlign = 'center'; b.textBaseline = 'top';
        const nom = g.n.split(' ');
        nom.forEach((w, k) => b.fillText(w, izq + gi * ancho + ancho / 2, H - inf + 4 + k * 11));
      });
      b.strokeStyle = C.eje; b.beginPath(); b.moveTo(izq, H - inf + 0.5); b.lineTo(W - 8, H - inf + 0.5); b.stroke();
      const sem = runs.map((r) => semanaDe(r.curva, 0.5));
      registro.textContent = `Adopción final: ${ESC.map((e, i) => `${e.n.toLowerCase()} ${pct(runs[i].curva[SEMANAS])}`).join('; ')}.`;
      lectura.set(ESC.map((e, i) => [e.n, `${pct(runs[i].curva[SEMANAS])} · 50 % en ${sem[i] === null ? 'nunca' : `semana ${sem[i]}`}`]));
    }
    lienzo.alDibujar = () => runs.length && dibujar();
    barras.alDibujar = () => runs.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      hover = Math.min(SEMANAS, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `semana <b>${hover}</b>` + ESC.map((e, i) => VIZ.filaTooltip(e.c, e.n, pct(runs[i].curva[hover]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    barras.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = barras.posicion(ev);
      const gi = Math.floor((x - geoB.izq) / geoB.ancho);
      if (gi < 0 || gi > 4) { if (hb >= 0) { hb = -1; dibujar(); } return tip2.ocultar(); }
      if (gi !== hb) { hb = gi; dibujar(); }
      tip2.mostrar(x, y, `<b>${GRUPOS[gi].n}</b>` + ESC.map((e, i) => VIZ.filaTooltip(e.c, e.n, pct(runs[i].grupos[SEMANAS][gi]))).join(''));
    });
    barras.canvas.addEventListener('pointerleave', () => { hb = -1; tip2.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('change-management', {
    intro: String.raw`
      <p>Una tecnología nueva, un proceso rediseñado o un cambio de estructura solo generan valor cuando las personas los adoptan. La <strong>gestión del cambio</strong> es el conjunto de prácticas (comunicación, capacitación, patrocinio directivo, apoyo a quienes dudan) que acompañan a la organización desde el estado actual hasta el nuevo. La <strong>innovación organizacional</strong> es el cambio mismo: nuevas formas de trabajar, decidir o relacionarse con los clientes.</p>
      <p>Las personas no adoptan al mismo tiempo. Según Everett Rogers, hay innovadores, adoptantes tempranos, mayoría temprana, mayoría tardía y rezagados, cada uno con distinto <em>umbral</em> de exposición. Las figuras simulan una organización de 200 personas para ver cómo se propaga el cambio y qué intervención mueve a cada grupo.</p>`,
    visualizaciones: [
      {
        titulo: 'La difusión del cambio en la organización',
        descripcion: 'Reproduzca las 52 semanas y observe en qué orden adopta cada grupo. Convierta a algunas personas en campeones con clic, o aumente la resistencia, y compruebe que la curva en S se retrasa o se detiene.',
        montar: montarDifusion,
      },
      {
        titulo: 'Qué intervención mueve a cada grupo',
        descripcion: 'Compare cuatro escenarios con las mismas personas: sin intervención, con capacitación, con patrocinio y con ambas. Fíjese en las barras por grupo: cada intervención alcanza a segmentos distintos.',
        montar: montarIntervenciones,
      },
    ],
    teoria: String.raw`
      <h2>Curva de adopción de Rogers</h2>
      <table>
        <tr><th>Grupo</th><th>Proporción</th><th>Qué necesita para adoptar</th></tr>
        <tr><td>Innovadores</td><td>2,5 %</td><td>curiosidad; adoptan solos</td></tr>
        <tr><td>Adoptantes tempranos</td><td>13,5 %</td><td>una visión creíble; son los líderes de opinión</td></tr>
        <tr><td>Mayoría temprana</td><td>34 %</td><td>pruebas de que funciona y capacitación</td></tr>
        <tr><td>Mayoría tardía</td><td>34 %</td><td>presión de los pares y ver que ya es la norma</td></tr>
        <tr><td>Rezagados</td><td>16 %</td><td>obligación, o que el modo antiguo desaparezca</td></tr>
      </table>
      <p>La distribución acumulada tiene forma de S: lenta al comienzo, rápida cuando adopta la mayoría y lenta al final. Entre los adoptantes tempranos y la mayoría hay un «abismo» donde muchos cambios mueren si no se aprende de los primeros pilotos.</p>
      <h2>Modelo de umbrales</h2>
      <p>Cada persona \(i\) tiene un umbral \(\theta_i\). En cada semana está expuesta a</p>
      \[ E_i = (1-w)\,\frac{\text{vecinos que adoptaron}}{\text{vecinos}} + w\,A_t + p + b , \]
      <p>donde \(A_t\) es la fracción de la organización que ya adoptó, \(w\) el peso del boca a boca global, \(p\) el patrocinio y \(b\) la comunicación general. La persona adopta (con probabilidad 0,3 por semana) cuando \(E_i \ge \theta_i - c + 0{,}3\,r_i\), con \(c\) la capacitación y \(r_i = 1\) si es resistente. Así, la capacitación baja el umbral; el patrocinio sube la exposición; la resistencia sube el umbral de algunos y detiene la cadena cuando los umbrales de las personas que siguen son mayores que la exposición disponible.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Una persona de la mayoría temprana tiene \(\theta = 0{,}35\). Si el 20 % de la organización adoptó, un tercio de sus vecinos también, \(w = 0{,}5\), \(p = 0{,}08\) y \(b = 0{,}03\): \(E = 0{,}5\cdot 0{,}33 + 0{,}5\cdot 0{,}2 + 0{,}08 + 0{,}03 = 0{,}375\). Como \(0{,}375 \ge 0{,}35\), cumple la condición y adopta. Sin patrocinio tendría \(E = 0{,}295 &lt; 0{,}35\) y esperaría; en cambio, con una capacitación \(c = 0{,}12\) su umbral efectivo baja a \(0{,}23\) y adopta incluso sin patrocinio.</p></div>
      <h2>Qué hacer en la práctica</h2>
      <ul>
        <li>Identificar y apoyar a los <strong>campeones</strong> (adoptantes tempranos) y usar sus resultados como prueba social.</li>
        <li>Capacitar a la mayoría; patrocinar con acciones visibles, no solo con discursos.</li>
        <li>Escuchar a los resistentes: su rechazo suele señalar problemas reales del proceso.</li>
        <li>Medir la adopción con indicadores (ver <a href="tema.html?id=project-impact-measurement">impacto de proyectos de TI</a> y <a href="tema.html?id=adoption-success-evaluation">adopción y éxito de proyectos</a>).</li>
      </ul>
      <p>Se conecta con la <a href="tema.html?id=digitization-vs-transformation">transformación digital</a>, con la <a href="tema.html?id=ai-adoption-risks">adopción de IA</a> y con la <a href="tema.html?id=social-network-centrality">centralidad en redes</a>, que explica por qué los campeones bien conectados valen más.</p>`,
  });
})();
