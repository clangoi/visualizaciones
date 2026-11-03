(function () {
  'use strict';
  const { color: C } = VIZ;

  const recortar = (ctx, texto, max) => {
    if (ctx.measureText(texto).width <= max) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: mapa estratégico ---------- */

  const PERSPECTIVAS = ['Financiera', 'Cliente', 'Procesos internos', 'Aprendizaje y crecimiento'];
  // p: perspectiva (0 arriba); c: columna (0 izquierda, 1 derecha)
  const OBJ = [
    { id: 'F1', n: 'Crecer ingresos', p: 0, c: 0, ind: 'ingresos recurrentes (M$)' },
    { id: 'F2', n: 'Mejorar margen', p: 0, c: 1, ind: 'margen operacional (%)' },
    { id: 'C1', n: 'Clientes fieles', p: 1, c: 0, ind: 'fuga de clientes (%)' },
    { id: 'C2', n: 'Servicio rápido', p: 1, c: 1, ind: 'tiempo de primera respuesta (h)' },
    { id: 'P1', n: 'Entrega confiable', p: 2, c: 0, ind: 'entregas sin reproceso (%)' },
    { id: 'P2', n: 'Automatizar operaciones', p: 2, c: 1, ind: 'transacciones sin intervención (%)' },
    { id: 'A1', n: 'Personal capacitado', p: 3, c: 0, ind: 'horas de capacitación por persona' },
    { id: 'A2', n: 'Datos confiables', p: 3, c: 1, ind: 'registros sin errores (%)' },
  ];
  const IDX = Object.fromEntries(OBJ.map((o, i) => [o.id, i]));
  // [origen, destino, peso con liderazgo en costos, peso con servicio superior]
  const ENLACES = [
    ['A1', 'P1', 0.6, 0.6], ['A1', 'P2', 0.4, 0.3], ['A2', 'P2', 0.5, 0.4], ['A2', 'C2', 0.2, 0.5],
    ['P1', 'C1', 0.3, 0.5], ['P1', 'C2', 0.4, 0.5], ['P2', 'C2', 0.3, 0.4], ['P2', 'F2', 0.8, 0.3],
    ['C2', 'C1', 0.3, 0.9], ['C1', 'F1', 0.5, 0.8], ['C2', 'F1', 0.2, 0.5],
  ];
  const ORDEN = ['A1', 'A2', 'P1', 'P2', 'C2', 'C1', 'F1', 'F2']; // orden topológico (de abajo hacia arriba)
  const MESES_POR_NIVEL = 3;

  function montarMapa(cuerpo) {
    let estr = 0, sel = 6, mejora = 20, hover = -1, cajas = [], efecto = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', opciones: [['0', 'Liderazgo en costos'], ['1', 'Servicio superior']], valor: '0', alCambiar: (v) => { estr = +v; dibujar(); } });
    ctl.rango({ etiqueta: 'Mejora lograda en el objetivo elegido', min: 0, max: 30, valor: mejora, formato: (v) => `+${v} pts`, alCambiar: (v) => { mejora = v; dibujar(); } });
    ctl.boton('Probar con «Personal capacitado»', () => { sel = 6; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 4 * 82 + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'efecto que se propaga', forma: 'linea' }, { color: C.tenue, texto: 'relación sin efecto', forma: 'linea' },
      { color: C.s2, texto: 'objetivo intervenido' }, { color: C.s6, texto: 'objetivo que mejora' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un objetivo para intervenirlo y mueva la mejora: cada flecha traslada una fracción del efecto hacia arriba. Cambie de estrategia y vea cómo los mismos esfuerzos rinden distinto.');

    const peso = (e) => e[2 + estr];
    function calcular() {
      efecto = OBJ.map(() => 0);
      efecto[sel] = mejora;
      for (const id of ORDEN) {
        const j = IDX[id];
        for (const e of ENLACES) if (e[1] === id) efecto[j] += peso(e) * efecto[IDX[e[0]]];
        if (j === sel) efecto[j] = mejora; // la intervención fija el valor del objetivo elegido
      }
    }
    function dibujar() {
      calcular();
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const bh = 82, nw = Math.min(150, W * 0.4), nh = 44;
      cajas = OBJ.map((o) => ({ x: o.c === 0 ? W * 0.3 - nw / 2 + 24 : W * 0.74 - nw / 2 + 8, y: 6 + o.p * bh + 26, w: nw, h: nh }));
      // Bandas de perspectiva
      PERSPECTIVAS.forEach((p, i) => {
        ctx.fillStyle = i % 2 ? C.fondo2 : C.neutro; ctx.fillRect(0, 6 + i * bh, W, bh - 4);
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(p.toUpperCase(), 8, 6 + i * bh + 5);
      });
      // Enlaces
      const maxE = Math.max(1, ...efecto);
      ENLACES.forEach((e) => {
        const a = cajas[IDX[e[0]]], b = cajas[IDX[e[1]]], f = peso(e) * efecto[IDX[e[0]]];
        const x1 = a.x + a.w / 2 + (b.x - a.x) * 0.1, y1 = a.y, x2 = b.x + b.w / 2 - (b.x - a.x) * 0.1, y2 = b.y + b.h;
        ctx.strokeStyle = f > 0.01 ? C.s1 : C.tenue; ctx.lineWidth = f > 0.01 ? 1.5 + (f / maxE) * 4 : 1.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath();
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4)); ctx.lineTo(x2 - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
      });
      // Objetivos
      OBJ.forEach((o, i) => {
        const r = cajas[i], mejora_i = efecto[i];
        ctx.fillStyle = i === sel ? VIZ.alfa(C.s2, 0.22) : mejora_i > 0.01 ? VIZ.alfa(C.s6, 0.16) : C.superficie;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
        ctx.lineWidth = i === hover ? 3 : 1.5; ctx.strokeStyle = i === sel ? C.s2 : mejora_i > 0.01 ? C.s6 : C.tinta2; ctx.stroke();
        ctx.font = VIZ.fuente(10.5, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, `${o.id} ${o.n}`, r.w - 8), r.x + r.w / 2, r.y + 15);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = mejora_i > 0.01 ? C.tinta : C.apagado;
        ctx.fillText(mejora_i > 0.01 ? `+${VIZ.fmt(mejora_i, 3)} pts` : '—', r.x + r.w / 2, r.y + 32);
      });
      const o = OBJ[sel], nivel = o.p;
      registro.textContent = `Se interviene «${o.n}» (indicador: ${o.ind}) con +${mejora} pts. ${o.p === 0 ? 'Ya es un objetivo financiero: el resultado es directo.' : `El efecto sube ${nivel} nivel${nivel > 1 ? 'es' : ''}: cada flecha multiplica por su peso y los resultados financieros tardan unos ${nivel * MESES_POR_NIVEL} meses.`}`;
      lectura.set([
        ['estrategia', estr ? 'servicio superior' : 'liderazgo en costos'],
        ['efecto en «Crecer ingresos»', efecto[0] > 0.01 ? `+${VIZ.fmt(efecto[0], 3)} pts` : 'nulo'],
        ['efecto en «Mejorar margen»', efecto[1] > 0.01 ? `+${VIZ.fmt(efecto[1], 3)} pts` : 'nulo'],
        ['objetivos alcanzados', `${efecto.filter((v) => v > 0.01).length} de ${OBJ.length}`],
        ['demora hasta lo financiero', nivel === 0 ? 'ninguna' : `≈ ${nivel * MESES_POR_NIVEL} meses`],
      ]);
    }
    const buscar = (x, y) => cajas.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = buscar(x, y);
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const o = OBJ[i], ent = ENLACES.filter((e) => e[1] === o.id).map((e) => `${e[0]} (${VIZ.fmt(peso(e), 2)})`).join(', ') || 'ninguno';
      tip.mostrar(x, y, `<b>${o.id} ${o.n}</b><br>indicador: ${o.ind}<br>recibe de: ${ent}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const i = buscar(x, y); if (i >= 0) { sel = i; dibujar(); } });
    dibujar();
  }

  /* ---------- Fig. 2: matriz objetivo – indicador – iniciativa ---------- */

  const OBJS = [
    { id: 'O1', n: 'Crecer ingresos' }, { id: 'O2', n: 'Fidelizar clientes' }, { id: 'O3', n: 'Reducir costos operativos' },
    { id: 'O4', n: 'Proteger los datos de clientes' }, { id: 'O5', n: 'Innovar en servicios digitales' },
  ];
  const INDS = [
    { n: 'Ingresos recurrentes', d: 'M$ por mes' }, { n: 'NPS', d: 'promotores − detractores' }, { n: 'Fuga de clientes', d: '% mensual' },
    { n: 'Costo por transacción', d: '$ por operación' }, { n: 'Horas de capacitación', d: 'horas por persona' }, { n: 'Visitas al sitio', d: 'sesiones por mes' },
    { n: 'Funciones lanzadas', d: 'cantidad por trimestre' }, { n: 'Incidentes de seguridad', d: 'cantidad por mes' },
  ];
  const INICS = [
    { n: 'Nuevo CRM', d: 'proyecto de TI' }, { n: 'Portal de autoservicio', d: 'proyecto de TI' }, { n: 'Automatizar facturación', d: 'proyecto de procesos' },
    { n: 'Migrar a la nube', d: 'proyecto de TI' }, { n: 'Plan de respaldos', d: 'proyecto de TI' }, { n: 'Rediseño de la intranet', d: 'proyecto de comunicaciones' },
  ];
  // Vínculos iniciales: [fila, objetivo]
  const INI_I = [[0, 0], [1, 1], [2, 1], [3, 2], [6, 4]];
  const INI_N = [[0, 0], [0, 1], [1, 1], [1, 4], [2, 2], [3, 2], [4, 3]];
  const SUG_I = [[7, 3], [5, 4]], SUG_N = [];

  function montarMatriz(cuerpo) {
    let mi = new Set(INI_I.map((p) => p.join())), mn = new Set(INI_N.map((p) => p.join())), hover = null, geo = null, ultimo = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Aplicar sugerencias', () => {
      SUG_I.forEach((p) => mi.add(p.join())); SUG_N.forEach((p) => mn.add(p.join()));
      ultimo = 'Se vinculó «Incidentes de seguridad» con O4 y «Visitas al sitio» con O5.'; dibujar();
    }, { primario: true });
    ctl.boton('Quitar todos los vínculos', () => { mi = new Set(); mn = new Set(); ultimo = 'Sin vínculos, todo está sin alinear.'; dibujar(); });
    ctl.boton('Restablecer', () => { mi = new Set(INI_I.map((p) => p.join())); mn = new Set(INI_N.map((p) => p.join())); ultimo = ''; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 50 + (INDS.length + INICS.length) * 22 + 30 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'indicador que mide el objetivo', forma: 'punto' }, { color: C.s3, texto: 'iniciativa que apunta al objetivo' },
      { color: C.s8, texto: 'hueco u huérfano (sin vínculo)' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' }, ...OBJS.map((o) => VIZ.el('div', null, `${o.id}  ${o.n}`)));
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda para vincular o desvincular un indicador o una iniciativa con un objetivo. Bajo cada objetivo se cuenta «indicadores · iniciativas»; en rojo, lo que está en 0. Pruebe «Aplicar sugerencias».');

    const cuenta = () => {
      const oi = OBJS.map((_, c) => INDS.filter((_, r) => mi.has(`${r},${c}`)).length), on = OBJS.map((_, c) => INICS.filter((_, r) => mn.has(`${r},${c}`)).length);
      const hi = INDS.map((_, r) => OBJS.filter((_, c) => mi.has(`${r},${c}`)).length), hn = INICS.map((_, r) => OBJS.filter((_, c) => mn.has(`${r},${c}`)).length);
      return { oi, on, hi, hn };
    };
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const lw = Math.min(150, W * 0.38), cw = (W - lw - 6) / OBJS.length, y0 = 50, rh = 22;
      geo = { lw, cw, y0, rh };
      const { oi, on, hi, hn } = cuenta();
      ctx.textBaseline = 'middle';
      OBJS.forEach((o, c) => {
        const x = lw + c * cw;
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center';
        ctx.fillText(o.id, x + cw / 2, 14);
        ctx.font = VIZ.fuente(10); ctx.fillStyle = oi[c] ? C.tinta2 : C.s8; ctx.fillText(String(oi[c]), x + cw / 2 - 9, 34);
        ctx.fillStyle = C.apagado; ctx.fillText('·', x + cw / 2, 34);
        ctx.fillStyle = on[c] ? C.tinta2 : C.s8; ctx.fillText(String(on[c]), x + cw / 2 + 9, 34);
      });
      const filas = [...INDS.map((x, r) => ({ ...x, r, tipo: 'i' })), ...INICS.map((x, r) => ({ ...x, r, tipo: 'n' }))];
      filas.forEach((f, k) => {
        const y = y0 + k * rh + (f.tipo === 'n' ? 8 : 0);
        f.y = y;
        if (k % 2) { ctx.fillStyle = C.fondo2; ctx.fillRect(0, y, W, rh); }
        const huerfano = (f.tipo === 'i' ? hi[f.r] : hn[f.r]) === 0;
        ctx.font = VIZ.fuente(10, huerfano ? 600 : 400); ctx.fillStyle = huerfano ? C.s8 : C.tinta; ctx.textAlign = 'left';
        ctx.fillText(recortar(ctx, f.n, lw - 8), 6, y + rh / 2);
        OBJS.forEach((_, c) => {
          const cx = lw + c * cw + cw / 2, cy = y + rh / 2, on_ = (f.tipo === 'i' ? mi : mn).has(`${f.r},${c}`);
          const esHover = hover && hover.tipo === f.tipo && hover.r === f.r && hover.c === c;
          ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.strokeRect(lw + c * cw + 0.5, y + 0.5, cw - 1, rh - 1);
          if (esHover) { ctx.fillStyle = C.neutro; ctx.fillRect(lw + c * cw + 1, y + 1, cw - 2, rh - 2); }
          if (on_) {
            ctx.fillStyle = f.tipo === 'i' ? C.s1 : C.s3; ctx.beginPath();
            if (f.tipo === 'i') ctx.arc(cx, cy, 6, 0, Math.PI * 2); else ctx.rect(cx - 5.5, cy - 5.5, 11, 11);
            ctx.fill();
          } else if (esHover) { ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke(); }
        });
      });
      ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left';
      geo.filas = filas;
      const hueco = OBJS.map((o, c) => ({ o, sinI: !oi[c], sinN: !on[c] })).filter((g) => g.sinI || g.sinN);
      const huI = INDS.filter((_, r) => !hi[r]), huN = INICS.filter((_, r) => !hn[r]);
      const lig = INDS.length + INICS.length - huI.length - huN.length;
      registro.textContent = ultimo || (hueco.length || huI.length || huN.length
        ? `Problemas: ${hueco.map((g) => `${g.o.id} sin ${g.sinI && g.sinN ? 'indicador ni iniciativa' : g.sinI ? 'indicador (no se puede saber si avanza)' : 'iniciativa (nadie trabaja en él)'}`).join('; ')}${huI.length ? `; indicadores huérfanos: ${huI.map((x) => x.n).join(', ')}` : ''}${huN.length ? `; iniciativas huérfanas: ${huN.map((x) => x.n).join(', ')}` : ''}.`
        : 'Todo objetivo tiene indicador e iniciativa, y todo indicador e iniciativa responde a un objetivo.');
      lectura.set([
        ['objetivos sin indicador', String(oi.filter((v) => !v).length)], ['objetivos sin iniciativa', String(on.filter((v) => !v).length)],
        ['indicadores huérfanos', String(huI.length)], ['iniciativas huérfanas', String(huN.length)],
        ['alineación', `${VIZ.fmt((lig / (INDS.length + INICS.length)) * 100, 3)} %`],
      ]);
    }
    const celda = (x, y) => {
      if (!geo || x < geo.lw) return null;
      const c = Math.floor((x - geo.lw) / geo.cw);
      if (c < 0 || c >= OBJS.length) return null;
      const f = geo.filas.find((f) => y >= f.y && y < f.y + geo.rh);
      return f ? { tipo: f.tipo, r: f.r, c, f } : null;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = celda(x, y);
      hover = h; dibujar();
      if (!h) return tip.ocultar();
      const set = h.tipo === 'i' ? mi : mn, on_ = set.has(`${h.r},${h.c}`);
      tip.mostrar(x, y, `<b>${h.f.n}</b> (${h.f.d})<br>${OBJS[h.c].id} ${OBJS[h.c].n}<br>${on_ ? 'vinculado: clic para quitar' : 'sin vínculo: clic para vincular'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const h = celda(x, y);
      if (!h) return;
      const set = h.tipo === 'i' ? mi : mn, k = `${h.r},${h.c}`;
      if (set.has(k)) set.delete(k); else set.add(k);
      ultimo = `${set.has(k) ? 'Vinculado' : 'Desvinculado'}: ${h.f.n} ↔ ${OBJS[h.c].id}.`;
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('strategy-aligned-indicators', {
    intro: String.raw`
      <p>Una estrategia se vuelve ejecutable cuando cada <strong>objetivo estratégico</strong> tiene al menos un indicador que muestra si avanza y al menos una
      <strong>iniciativa</strong> (proyecto o programa) que lo mueve. Si falta uno de los tres eslabones, la organización mide cosas que nadie usa, o trabaja en proyectos
      cuyo efecto nunca verá.</p>
      <p>El <em>cuadro de mando integral</em> (<em>Balanced Scorecard</em>) ordena los objetivos en cuatro perspectivas (financiera, cliente, procesos internos y aprendizaje y crecimiento)
      conectadas por relaciones de causa y efecto: el <strong>mapa estratégico</strong>. Con él se detectan huecos, indicadores huérfanos e iniciativas sin propósito.</p>`,
    visualizaciones: [
      {
        titulo: 'Mapa estratégico y propagación del efecto',
        descripcion: 'Elija un objetivo de las perspectivas inferiores, por ejemplo «Personal capacitado», y suba la mejora: el efecto se traslada por las flechas hasta los objetivos financieros. Cambie de estrategia y compare.',
        montar: montarMapa,
      },
      {
        titulo: 'Matriz objetivo – indicador – iniciativa',
        descripcion: 'Vincule indicadores e iniciativas con los objetivos. Busque los números en rojo bajo cada objetivo y las filas en rojo, que son huecos y huérfanos, y resuélvalos con vínculos o «Aplicar sugerencias».',
        montar: montarMatriz,
      },
    ],
    teoria: String.raw`
      <h2>Perspectivas del cuadro de mando integral</h2>
      <table>
        <tr><th>Perspectiva</th><th>Pregunta</th><th>Indicadores típicos</th></tr>
        <tr><td>Financiera</td><td>¿Cómo nos ven los accionistas?</td><td>ingresos, margen, retorno</td></tr>
        <tr><td>Cliente</td><td>¿Cómo nos ven los clientes?</td><td>fuga, NPS, tiempo de respuesta</td></tr>
        <tr><td>Procesos internos</td><td>¿En qué debemos ser excelentes?</td><td>reprocesos, tiempo de ciclo, automatización</td></tr>
        <tr><td>Aprendizaje y crecimiento</td><td>¿Podemos seguir mejorando?</td><td>capacitación, calidad de los datos, clima</td></tr>
      </table>
      <p>Las flechas del mapa van de abajo hacia arriba: la capacitación y los datos confiables mejoran los procesos, los procesos mejoran la experiencia del cliente y esta, los resultados financieros.</p>
      <h2>Propagación del efecto</h2>
      <p>Si un objetivo \(j\) recibe efectos de varios objetivos \(i\) con pesos \(w_{ij}\), y \(e_i\) es la mejora de cada uno, el efecto acumulado se calcula en orden topológico:</p>
      \[ e_j = \sum_{i \to j} w_{ij}\, e_i . \]
      <p>Ejemplo con servicio superior: una mejora de 20 puntos en «Servicio rápido» llega a «Clientes fieles» con peso 0,9 (18 pts) y a «Crecer ingresos» con 0,5 por la vía directa y 0,8 por la fiel:
      \(e_{F1} = 0{,}5\cdot 20 + 0{,}8\cdot 18 = 24{,}4\) pts. Con liderazgo en costos los pesos son 0,3, 0,5 y 0,2, y el efecto baja a \(0{,}2\cdot 20 + 0{,}5\cdot 6 = 7\) pts.
      La misma inversión rinde según la estrategia elegida. Los pesos reales se estiman con datos históricos (correlaciones con retardo) y juicio experto.</p>
      <h2>Alineación: huecos y huérfanos</h2>
      <p>Sea \(O\) el conjunto de objetivos, \(I\) el de indicadores y \(N\) el de iniciativas, con relaciones \(m \subseteq I \times O\) y \(a \subseteq N \times O\). Hay problemas cuando:</p>
      <ul>
        <li>un objetivo \(o\) no tiene ningún \((i,o) \in m\): <em>no se puede saber si avanza</em>;</li>
        <li>un objetivo no tiene ningún \((n,o) \in a\): <em>nadie trabaja para lograrlo</em>;</li>
        <li>un indicador no pertenece a ninguna pareja de \(m\) o una iniciativa a ninguna de \(a\): <em>huérfanos</em>, que consumen esfuerzo sin propósito estratégico.</li>
      </ul>
      <p>Una medida simple de alineación es la fracción de indicadores e iniciativas con al menos un vínculo; en la figura, de 14 filas, 10 están vinculadas al inicio (71 %) y quedan huérfanos «Horas de capacitación», «Visitas al sitio», «Incidentes de seguridad» y «Rediseño de la intranet». Tras aplicar las sugerencias la cifra sube a 86 % (12 de 14) y O4 deja de estar sin indicador.</p>
      <div class="recuadro"><p><strong>Regla práctica.</strong> Cada objetivo tiene de 1 a 3 indicadores (de resultado y de proceso) y cada indicador responde a un objetivo. Un indicador sin objetivo se elimina o se justifica.</p></div>
      <h2>Conexiones</h2>
      <p>Los criterios para definir cada indicador están en <a href="tema.html?id=kpi-fundamentals">fundamentos de KPI</a>. Los objetivos se pueden expresar como
      <a href="tema.html?id=okr-framework">OKR</a>, las metas se fijan en <a href="tema.html?id=targets-thresholds">metas y umbrales</a> y el alineamiento entre negocio y tecnología se trata en
      <a href="tema.html?id=strategic-alignment">alineamiento estratégico de TI</a>.</p>`,
  });
})();
