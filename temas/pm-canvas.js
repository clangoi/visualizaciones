(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;

  /* ---------- Datos: dos proyectos con su PM Canvas completo ---------- */

  const it = (id, txt, ref = [], extra = {}) => ({ id, txt, ref, ...extra });
  const TITULOS = { J: 'Justificativas', O: 'Objetivos SMART', B: 'Beneficios', P: 'Producto', R: 'Requisitos', I: 'Interesados', E: 'Equipo', M: 'Premisas', G: 'Grupos de entrega', T: 'Línea de tiempo', Q: 'Costos', X: 'Restricciones', K: 'Riesgos' };
  const ORDEN = ['J', 'O', 'B', 'P', 'R', 'I', 'E', 'M', 'G', 'T', 'Q', 'X', 'K'];
  const CASOS = {
    crm: {
      nombre: 'CRM para el equipo comercial',
      items: [
        it('J1', 'Se pierden ventas por responder tarde a los clientes'), it('J2', 'La información de clientes está dispersa en planillas'),
        it('O1', 'Bajar de 48 h a 12 h la primera respuesta al cliente en 9 meses', ['J1']), it('O2', 'Unificar el 100 % de la cartera en una base en 6 meses', ['J2']),
        it('B1', '+8 % de ventas por oportunidades atendidas a tiempo', ['O1']), it('B2', '−120 horas al mes de trabajo manual en planillas', ['O2']),
        it('P1', 'CRM en la nube integrado con correo y facturación', ['O1', 'O2']),
        it('R1', 'Registrar cada contacto con el cliente', ['P1', 'I2']), it('R2', 'Alertas de consultas sin responder', ['P1', 'I1']), it('R3', 'Importar y depurar las planillas', ['P1', 'I2']), it('R4', 'Integración con facturación', ['P1', 'I3']),
        it('I1', 'Gerente comercial (patrocinador)'), it('I2', 'Equipo de ventas'), it('I3', 'Área de finanzas'), it('I4', 'Proveedor del CRM'),
        it('E1', 'Líder de proyecto (50 %)'), it('E2', 'Analista de negocio'), it('E3', 'Consultor del proveedor'),
        it('M1', 'El proveedor entrega las licencias en la semana 2'), it('M2', 'Ventas dedica 4 h a la semana a las pruebas'),
        it('G1', 'Datos migrados', ['R3']), it('G2', 'CRM configurado con alertas', ['R1', 'R2']), it('G3', 'Integración y capacitación', ['R4']),
        it('T1', 'Datos migrados: 2 meses', ['G1'], { meses: 2 }), it('T2', 'CRM configurado: 3 meses', ['G2'], { meses: 3 }), it('T3', 'Integración y capacitación: 3 meses', ['G3'], { meses: 3 }),
        it('Q1', 'Migración: 90 mil', ['G1'], { monto: 90 }), it('Q2', 'Configuración: 160 mil', ['G2'], { monto: 160 }), it('Q3', 'Integración y capacitación: 110 mil', ['G3'], { monto: 110 }),
        it('X1', 'Presupuesto máximo: 400 mil', [], { limite: 'presupuesto', valor: 400 }), it('X2', 'Plazo máximo: 9 meses', [], { limite: 'plazo', valor: 9 }), it('X3', 'No se modifica el sistema de facturación'),
        it('K1', 'Datos duplicados retrasan la migración', ['G1']), it('K2', 'Baja adopción del equipo de ventas', ['G2', 'G3']), it('K3', 'Falla la integración con facturación', ['G3']), it('K4', 'Rotación del analista de negocio', ['G2']),
      ],
    },
    portal: {
      nombre: 'Portal de autoservicio para clientes',
      items: [
        it('J1', 'El 60 % de las llamadas son consultas de saldo y estado'), it('J2', 'Los clientes piden atención fuera de horario'),
        it('O1', 'Bajar del 60 % al 30 % las llamadas de consulta en 8 meses', ['J1']), it('O2', 'Atender el 40 % de las solicitudes fuera de horario por el portal en 8 meses', ['J2']),
        it('B1', 'Evitar contratar 2 agentes (70 mil al año)', ['O1']), it('B2', '+6 puntos de satisfacción (NPS)', ['O2']),
        it('P1', 'Portal web y app de autoservicio', ['O1', 'O2']),
        it('R1', 'Consulta de saldo y estado de pedidos', ['P1', 'I2']), it('R2', 'Registro seguro con doble factor', ['P1', 'I3']), it('R3', 'Solicitudes con seguimiento', ['P1', 'I2']), it('R4', 'Chat con derivación a un agente', ['P1', 'I4']),
        it('I1', 'Gerente de atención al cliente (patrocinador)'), it('I2', 'Clientes'), it('I3', 'Seguridad informática'), it('I4', 'Agentes del call center'),
        it('E1', 'Líder de proyecto'), it('E2', 'Tres desarrolladores'), it('E3', 'Diseñador de experiencia de usuario'),
        it('M1', 'El sistema de saldos expone una API estable'), it('M2', 'Los clientes tienen un correo verificado'),
        it('G1', 'Autenticación segura', ['R2']), it('G2', 'Consultas de saldo y pedidos', ['R1']), it('G3', 'Solicitudes y chat', ['R3', 'R4']),
        it('T1', 'Autenticación: 2 meses', ['G1'], { meses: 2 }), it('T2', 'Consultas: 3 meses', ['G2'], { meses: 3 }), it('T3', 'Solicitudes y chat: 3 meses', ['G3'], { meses: 3 }),
        it('Q1', 'Autenticación: 120 mil', ['G1'], { monto: 120 }), it('Q2', 'Consultas: 150 mil', ['G2'], { monto: 150 }), it('Q3', 'Solicitudes y chat: 180 mil', ['G3'], { monto: 180 }),
        it('X1', 'Presupuesto máximo: 500 mil', [], { limite: 'presupuesto', valor: 500 }), it('X2', 'Plazo máximo: 8 meses', [], { limite: 'plazo', valor: 8 }), it('X3', 'No se almacenan datos de tarjetas'),
        it('K1', 'Vulnerabilidad en la autenticación', ['G1']), it('K2', 'Baja adopción de clientes mayores', ['G2', 'G3']), it('K3', 'La API de saldos cambia sin aviso', ['G2']),
      ],
    },
  };

  // Validaciones de coherencia: cada una devuelve la lista de elementos que la incumplen.
  function validar(items, fuera) {
    const act = items.filter((x) => !fuera.has(x.id)), de = (k) => act.filter((x) => x.id[0] === k), has = (x, k) => x.ref.some((r) => r[0] === k && !fuera.has(r));
    const refiere = (k, id) => de(k).some((x) => x.ref.includes(id));
    const suma = (k, campo) => de(k).reduce((s, x) => s + (x[campo] || 0), 0);
    const limite = (t) => de('X').find((x) => x.limite === t);
    const checks = [
      { t: 'Toda justificativa tiene un objetivo que la atiende', mal: de('J').filter((j) => !refiere('O', j.id)).map((x) => x.id) },
      { t: 'Todo objetivo tiene un beneficio y un producto que lo cumple', mal: de('O').filter((o) => !refiere('B', o.id) || !refiere('P', o.id)).map((x) => x.id) },
      { t: 'Todo requisito nace de un interesado y pertenece al producto', mal: de('R').filter((r) => !has(r, 'I') || !has(r, 'P')).map((x) => x.id) },
      { t: 'Todo requisito se entrega en algún grupo de entrega', mal: de('R').filter((r) => !refiere('G', r.id)).map((x) => x.id) },
      { t: 'Todo grupo de entrega tiene plazo y costo', mal: de('G').filter((g) => !refiere('T', g.id) || !refiere('Q', g.id)).map((x) => x.id) },
      { t: 'Todo riesgo afecta a un grupo de entrega concreto', mal: de('K').filter((k) => !has(k, 'G')).map((x) => x.id) },
    ];
    const lp = limite('plazo'), lb = limite('presupuesto'), meses = suma('T', 'meses'), monto = suma('Q', 'monto');
    checks.push({ t: lp ? `La suma de plazos (${meses} meses) cabe en el plazo máximo (${lp.valor})` : 'Hay un plazo máximo declarado', mal: !lp ? ['X2'] : meses > lp.valor ? [lp.id, ...de('T').map((x) => x.id)] : [] });
    checks.push({ t: lb ? `La suma de costos (${monto} mil) cabe en el presupuesto (${lb.valor} mil)` : 'Hay un presupuesto máximo declarado', mal: !lb ? ['X1'] : monto > lb.valor ? [lb.id, ...de('Q').map((x) => x.id)] : [] });
    return { checks, meses, monto };
  }

  /* ---------- Fig. 1: el canvas completo ---------- */

  function envolver(txt, max) {
    const out = []; let linea = '';
    for (const p of txt.split(' ')) {
      if (linea && (linea + ' ' + p).length > max) { out.push(linea); linea = p; } else linea = linea ? linea + ' ' + p : p;
    }
    if (linea) out.push(linea);
    return out;
  }

  function montarCanvas(cuerpo) {
    let caso = CASOS.crm, sel = null, geo = null;
    const fuera = new Set();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proyecto', opciones: Object.entries(CASOS).map(([k, c]) => [k, c.nombre]), valor: 'crm', alCambiar: (v) => { caso = CASOS[v]; sel = null; fuera.clear(); lienzo.ajustar(true); } });
    const bQ = ctl.boton('Quitar o restaurar el elemento elegido', () => { if (!sel) return; if (fuera.has(sel)) fuera.delete(sel); else fuera.add(sel); dibujar(); }, { primario: true });
    ctl.boton('Restaurar todo', () => { fuera.clear(); dibujar(); });
    void bQ;

    const med = document.createElement('canvas').getContext('2d');
    function disponer(W) {
      const cols = W >= 720 ? 4 : W >= 470 ? 3 : 2, gap = 8, cw = (W - gap * (cols + 1)) / cols, chars = Math.max(10, Math.floor((cw - 26) / 6.3));
      const alt = Array(cols).fill(gap), bloques = [];
      for (const k of ORDEN) {
        const c = alt.indexOf(Math.min(...alt)), x = gap + c * (cw + gap), y = alt[c];
        let yy = y + 24; const items = [];
        for (const x2 of caso.items.filter((q) => q.id[0] === k)) {
          const lineas = envolver(`${x2.id} ${x2.txt}`, chars), h = lineas.length * 13 + 8;
          items.push({ it: x2, lineas, x: x + 6, y: yy, w: cw - 12, h }); yy += h + 4;
        }
        bloques.push({ k, x, y, w: cw, h: yy - y + 2, items }); alt[c] = yy + 6 + gap;
      }
      return { bloques, alto: Math.max(...alt) };
    }
    void med;

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => disponer(w).alto + 4 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'elemento elegido' }, { color: C.superficie, borde: C.s3, texto: 'relacionado con el elegido' },
      { color: C.superficie, borde: C.s8, texto: 'incumple una validación' }, { color: C.neutro, borde: C.inactivo, texto: 'quitado' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un elemento para ver con qué se relaciona y use «Quitar o restaurar» para sacarlo del canvas: las validaciones de abajo señalan qué quedó sin sustento. Pruebe quitar un objetivo, un requisito o un grupo de entrega, y también subir los costos quitando una restricción.');

    function dibujar() {
      if (!lienzo.ancho) return;
      const { ctx, ancho: W } = lienzo;
      const { bloques } = (geo = disponer(W));
      lienzo.limpiar();
      const v = validar(caso.items, fuera), malos = new Set(v.checks.flatMap((c) => c.mal));
      const it0 = sel && caso.items.find((q) => q.id === sel);
      const rel = new Set(it0 ? [...it0.ref, ...caso.items.filter((q) => q.ref.includes(sel)).map((q) => q.id)] : []);
      for (const b of bloques) {
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.x, b.y + 0.5); ctx.lineTo(b.x + b.w, b.y + 0.5); ctx.stroke();
        ctx.fillStyle = C.fondo2; ctx.fillRect(b.x, b.y + 1, b.w, b.h - 1);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(TITULOS[b.k].toUpperCase(), b.x + 6, b.y + 8);
        for (const q of b.items) {
          const x = q.it, quitado = fuera.has(x.id), es = x.id === sel;
          ctx.fillStyle = es ? VIZ.alfa(C.s1, 0.3) : quitado ? C.neutro : C.superficie; ctx.fillRect(q.x, q.y, q.w, q.h);
          ctx.save();
          if (quitado) ctx.setLineDash([3, 3]);
          ctx.lineWidth = es || (!quitado && malos.has(x.id)) || rel.has(x.id) ? 2 : 1;
          ctx.strokeStyle = quitado ? C.inactivo : es ? C.s1 : malos.has(x.id) ? C.s8 : rel.has(x.id) ? C.s3 : C.tenue;
          ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1); ctx.restore();
          ctx.fillStyle = quitado ? C.inactivo : C.tinta; ctx.font = VIZ.fuente(10.5, 400); ctx.textBaseline = 'top';
          q.lineas.forEach((l, i) => {
            ctx.fillText(l, q.x + 6, q.y + 5 + i * 13);
            if (quitado) { ctx.strokeStyle = C.inactivo; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x + 6, q.y + 11 + i * 13); ctx.lineTo(q.x + 6 + l.length * 6.3, q.y + 11 + i * 13); ctx.stroke(); }
          });
        }
      }
      const ok = v.checks.filter((c) => !c.mal.length).length;
      lista.replaceChildren(...v.checks.map((c) => VIZ.el('div', { style: { color: c.mal.length ? C.s8 : C.s6 } }, `${c.mal.length ? '✗' : '✓'} ${c.t}${c.mal.length ? ` — ${[...new Set(c.mal)].join(', ')}` : ''}`)));
      const quitadoTxt = fuera.size ? `Quitado: ${[...fuera].join(', ')}. ` : '';
      registro.textContent = sel
        ? `${sel}: «${it0.txt}». ${it0.ref.length ? `Se apoya en ${it0.ref.join(', ')}.` : 'No depende de otros elementos.'} ${rel.size - it0.ref.length ? `Lo usan ${[...rel].filter((r) => !it0.ref.includes(r)).join(', ')}.` : ''}`
        : `${quitadoTxt}Haga clic en un elemento del canvas. Las validaciones se calculan sobre las relaciones entre elementos y sobre las sumas de plazos y costos.`;
      lectura.set([
        ['validaciones cumplidas', `${ok} de ${v.checks.length}`],
        ['elementos en el canvas', `${caso.items.length - fuera.size} de ${caso.items.length}`],
        ['plazo total', `${v.meses} meses`], ['costo total', `${v.monto} mil`],
        ['elementos con problemas', String(new Set(v.checks.flatMap((c) => c.mal)).size)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const buscar = (x, y) => { if (!geo) return null; for (const b of geo.bloques) for (const q of b.items) if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return q; return null; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = buscar(x, y); sel = q ? (q.it.id === sel ? null : q.it.id) : null; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = buscar(x, y);
      if (!q) return tip.ocultar();
      const usa = caso.items.filter((z) => z.ref.includes(q.it.id)).map((z) => z.id);
      tip.mostrar(x, y, `<b>${q.it.id}</b> ${q.it.txt}<br>se apoya en: ${q.it.ref.join(', ') || '—'}<br>lo usan: ${usa.join(', ') || '—'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: objetivo SMART y coherencia con plazos y costos ---------- */

  const GRUPOS = [['Datos migrados', 2, 90], ['CRM configurado', 3, 160], ['Integración y capacitación', 3, 110]];
  const T0 = 48;

  function montarSmart(cuerpo) {
    let redac = 'c', just = 'j1', meta = 12, plazo = 9, ritmo = 22, presup = 400, plT = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Redacción del objetivo', opciones: [['a', 'a) «Mejorar la atención al cliente»'], ['b', 'b) «Reducir el tiempo de primera respuesta»'], ['c', 'c) «Reducir de 48 h a la meta la primera respuesta en el plazo»']], valor: redac, alCambiar: (v) => { redac = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Se justifica por', opciones: [['j1', 'ventas perdidas por responder tarde'], ['j2', 'renovar la imagen de las oficinas']], valor: just, alCambiar: (v) => { just = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Meta de primera respuesta', min: 4, max: 40, valor: meta, formato: (v) => `${v} h`, alCambiar: (v) => { meta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Plazo del objetivo', min: 3, max: 18, valor: plazo, formato: (v) => `${v} meses`, alCambiar: (v) => { plazo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Mejora mensual que el equipo logra', min: 5, max: 30, valor: ritmo, formato: (v) => `${v} %`, alCambiar: (v) => { ritmo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Presupuesto aprobado', min: 200, max: 600, paso: 10, valor: presup, formato: (v) => `${v} mil`, alCambiar: (v) => { presup = v; dibujar(); } });

    VIZ.subtitulo(cuerpo, 'Trayectoria de la primera respuesta');
    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 220, altoMax: 300 });
    const tip1 = VIZ.tooltip(l1);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'lo que el equipo logra', forma: 'linea' }, { color: C.s2, texto: 'lo que exige el objetivo', forma: 'linea' }, { color: C.s6, texto: 'mes en que se alcanza la meta' }, { color: C.apagado, texto: 'plazo', forma: 'linea' }]);
    VIZ.subtitulo(cuerpo, 'Grupos de entrega: plazo y costo');
    const l2 = VIZ.lienzo(cuerpo, { altoFn: () => 3 * 34 + 50 });
    const tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'grupo dentro del plazo y presupuesto' }, { color: C.s8, texto: 'grupo que excede el plazo del objetivo' }, { color: C.apagado, texto: 'plazo del objetivo', forma: 'linea' }]);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pruebe cada redacción: solo la c) cumple específico, medible y con plazo. Luego suba la ambición (meta baja o plazo corto) hasta que deje de ser alcanzable, y baje el plazo por debajo de 8 meses o el presupuesto por debajo de 360 mil para romper la coherencia con la línea de tiempo.');

    const total = { meses: GRUPOS.reduce((s, g) => s + g[1], 0), monto: GRUPOS.reduce((s, g) => s + g[2], 0) };
    const logro = (t) => T0 * Math.pow(1 - ritmo / 100, t);
    function dibujar() {
      const e = redac === 'c', tAlc = Math.log(meta / T0) / Math.log(1 - ritmo / 100);
      const crit = [
        ['Específico', redac !== 'a', redac === 'a' ? 'no dice qué cambia ni dónde' : 'nombra qué se mide'],
        ['Medible', e, e ? 'tiene valor inicial y meta' : 'falta el valor de partida y la meta'],
        ['Alcanzable', e && tAlc <= plazo + 1e-9, !e ? 'sin meta no se puede evaluar' : tAlc <= plazo ? `se alcanza en el mes ${VIZ.fmt(tAlc, 3)}` : `al ritmo actual tardaría ${VIZ.fmt(tAlc, 3)} meses`],
        ['Relevante', just === 'j1', just === 'j1' ? 'responde a un problema documentado' : 'no se vincula a ninguna justificativa del negocio'],
        ['Temporal', e, e ? `vence en el mes ${plazo}` : 'sin fecha límite'],
        ['Cabe en el plazo', total.meses <= plazo, `entregas: ${total.meses} meses frente a ${plazo}`],
        ['Cabe en el presupuesto', total.monto <= presup, `costos: ${total.monto} mil frente a ${presup} mil`],
      ];
      // Trayectoria.
      {
        const { ctx } = l1; l1.limpiar();
        plT = VIZ.plano(l1, { xmin: 0, xmax: 18, ymin: 0, ymax: T0 * 1.05 }, { etiquetaX: 'mes', etiquetaY: 'horas hasta la primera respuesta', margen: { izq: 46 } });
        plT.ejes();
        const pts = []; for (let t = 0; t <= 18.001; t += 0.25) pts.push([t, logro(t)]);
        VIZ.trazar(ctx, plT, pts, C.s1, 2.5);
        VIZ.trazar(ctx, plT, [[0, T0], [plazo, meta], [18, meta]], C.s2, 2, [5, 3]);
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(plT.sx(plazo), plT.y1); ctx.lineTo(plT.sx(plazo), plT.y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plT.x0, plT.sy(meta)); ctx.lineTo(plT.x1, plT.sy(meta)); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(`meta ${meta} h`, plT.x1 - 4, plT.sy(meta) - 3);
        if (tAlc <= 18) VIZ.marcador(ctx, plT.sx(tAlc), plT.sy(meta), tAlc <= plazo ? C.s6 : C.s8, 6);
      }
      // Línea de tiempo y costos.
      {
        const { ctx, ancho: W } = l2; l2.limpiar();
        const izq = 8, der = 10, sx = (m) => izq + (m / Math.max(18, total.meses, plazo)) * (W - izq - der);
        let m0 = 0, acum = 0;
        GRUPOS.forEach(([n, d, c], i) => {
          const y = 4 + i * 34, fuera = m0 + d > plazo;
          acum += c;
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`G${i + 1} ${n}`, izq, y);
          ctx.fillStyle = fuera ? C.s8 : C.s1; ctx.beginPath(); ctx.roundRect(sx(m0), y + 14, sx(m0 + d) - sx(m0) - 2, 16, 4); ctx.fill();
          ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${c} mil`, (sx(m0) + sx(m0 + d)) / 2 - 1, y + 23);
          m0 += d;
        });
        const yb = 4 + 3 * 34;
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(izq, yb + 0.5); ctx.lineTo(W - der, yb + 0.5); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const m of VIZ.ticks(0, Math.max(18, total.meses, plazo), Math.max(3, Math.floor(W / 60)))) ctx.fillText(String(m), sx(m), yb + 4);
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(sx(plazo), 2); ctx.lineTo(sx(plazo), yb); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'right'; ctx.fillText(`costo total ${acum} mil · ${total.meses} meses`, W - der, yb + 18);
      }
      fichas.replaceChildren(...crit.map(([n, ok]) => VIZ.ficha(`${ok ? '✓' : '✗'} ${n}`, { color: ok ? C.s6 : C.s8, tinta: ok ? C.s6 : C.s8 })));
      const mal = crit.filter((c) => !c[1]);
      registro.textContent = mal.length ? `Falla: ${mal.map((c) => `${c[0].toLowerCase()} (${c[2]})`).join('; ')}.` : `Cumple los cinco criterios SMART y es coherente con la línea de tiempo y el presupuesto. ${crit[2][2]}.`;
      lectura.set([
        ['criterios cumplidos', `${crit.filter((c) => c[1]).length} de ${crit.length}`],
        ['mejora mensual exigida', e ? pct(1 - Math.pow(meta / T0, 1 / plazo)) : '—'],
        ['mejora mensual lograda', pct(ritmo / 100)],
        ['mes en que se alcanza la meta', e ? `${VIZ.fmt(tAlc, 3)}` : '—'],
        ['entregas / plazo', `${total.meses} / ${plazo} meses`],
        ['costos / presupuesto', `${total.monto} / ${presup} mil`],
      ]);
    }
    l1.alDibujar = () => plT && dibujar(); l2.alDibujar = () => plT && dibujar();
    l1.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l1.posicion(ev);
      if (!plT || !plT.dentro(x, y)) return tip1.ocultar();
      const t = plT.ix(x), req = t >= plazo ? meta : T0 + (meta - T0) * (t / plazo);
      tip1.mostrar(x, y, `mes <b>${VIZ.fmt(t, 3)}</b>` + VIZ.filaTooltip(C.s1, 'logrado', `${VIZ.fmt(logro(t), 3)} h`) + VIZ.filaTooltip(C.s2, 'exigido', `${VIZ.fmt(req, 3)} h`));
    });
    l1.canvas.addEventListener('pointerleave', () => tip1.ocultar());
    l2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = l2.posicion(ev), i = Math.floor((y - 4) / 34);
      if (i < 0 || i > 2) return tip2.ocultar();
      const ini = GRUPOS.slice(0, i).reduce((s, g) => s + g[1], 0);
      tip2.mostrar(x, y, `<b>G${i + 1} ${GRUPOS[i][0]}</b><br>meses ${ini} a ${ini + GRUPOS[i][1]}<br>costo ${GRUPOS[i][2]} mil`);
    });
    l2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    dibujar();
  }

  VIZ.registrarTema('pm-canvas', {
    intro: String.raw`
      <p>El <strong>Project Model Canvas</strong> (PM Canvas) resume un proyecto en una sola hoja de trece bloques: por qué se hace (justificativas), qué se logrará (objetivos, beneficios), qué se entregará (producto, requisitos, grupos de entrega),
      quiénes participan (interesados, equipo), qué condiciona al proyecto (premisas, restricciones, riesgos) y cuánto cuesta y dura (línea de tiempo, costos). Se completa en equipo, en una reunión, antes de escribir un plan detallado.</p>
      <p>Su valor no está en llenar casilleros, sino en la <strong>coherencia</strong>: cada justificativa debe tener un objetivo, cada objetivo un beneficio medible y un producto, cada requisito un interesado que lo pida y un grupo de entrega que lo construya, y los plazos y costos deben caber en las restricciones.</p>`,
    visualizaciones: [
      {
        titulo: 'Un canvas completo y sus validaciones',
        descripcion: 'Haga clic en un elemento para ver qué otros lo sustentan o lo usan; quítelo y observe qué validaciones fallan. Pruebe quitar el objetivo O2, el requisito R4 o la restricción de plazo X2.',
        montar: montarCanvas,
      },
      {
        titulo: 'Objetivo SMART y coherencia con plazo y presupuesto',
        descripcion: 'Elija la redacción c) y suba el plazo hasta que el objetivo sea alcanzable al ritmo del equipo; después reduzca el plazo del objetivo a menos de 8 meses y vea que deja de ser coherente con la línea de tiempo.',
        montar: montarSmart,
      },
    ],
    teoria: String.raw`
      <h2>Los trece bloques</h2>
      <table>
        <tr><th>Pregunta</th><th>Bloques</th><th>Qué se verifica</th></tr>
        <tr><td>¿Por qué?</td><td>justificativas, objetivos SMART, beneficios</td><td>el problema es real y la meta lo resuelve de forma medible</td></tr>
        <tr><td>¿Qué?</td><td>producto, requisitos, grupos de entrega</td><td>lo que se construye cumple lo que se prometió</td></tr>
        <tr><td>¿Quién?</td><td>interesados, equipo</td><td>cada requisito tiene un dueño; el equipo cubre las entregas</td></tr>
        <tr><td>¿Cómo, con qué límites?</td><td>premisas, restricciones, riesgos</td><td>lo que se supone cierto, lo que no se puede cambiar, lo que puede fallar</td></tr>
        <tr><td>¿Cuándo y cuánto?</td><td>línea de tiempo, costos</td><td>caben en el plazo y presupuesto máximos</td></tr>
      </table>
      <h2>Objetivos SMART</h2>
      <p>Un objetivo bien formulado es <em>Specific</em> (específico), <em>Measurable</em> (medible), <em>Achievable</em> (alcanzable), <em>Relevant</em> (relevante) y <em>Time-bound</em> (con plazo). La alcanzabilidad se puede comprobar con números: si el proceso mejora una fracción
      \(\rho\) por mes a partir de un valor inicial \(x_0\), el valor tras \(t\) meses es \(x(t) = x_0 (1-\rho)^t\), y la meta \(m\) se alcanza en</p>
      \[ t^{*} = \frac{\ln(m / x_0)}{\ln(1 - \rho)}. \]
      <p>El objetivo es alcanzable si \(t^{*} \le \text{plazo}\); equivalentemente, la mejora mensual exigida \(1 - (m/x_0)^{1/\text{plazo}}\) no supera la capacidad \(\rho\).</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Bajar de \(x_0 = 48\) h a \(m = 12\) h en 9 meses exige mejorar \(1 - (12/48)^{1/9} = 1 - 0{,}857 = 14{,}3\,\%\) por mes. Si el equipo logra \(\rho = 22\,\%\), \(t^{*} = \ln(0{,}25)/\ln(0{,}78) \approx 5{,}6\) meses: es alcanzable con margen. Si solo lograra 10 %, \(t^{*} \approx 13{,}2\) meses: el objetivo es inalcanzable en 9.</p></div>
      <h2>Coherencia entre bloques</h2>
      <p>Cada validación es una condición sobre el grafo de relaciones del canvas: ningún elemento puede quedar «huérfano». Las sumas de plazos y costos de los grupos de entrega deben respetar las restricciones:
      \(\sum_g d_g \le D_{\max}\) (si las entregas son secuenciales) y \(\sum_g c_g \le P_{\max}\). Un riesgo sin grupo de entrega al que afecte no tiene dónde incorporarse el plan de respuesta. Quitar un solo bloque rompe varias validaciones a la vez: por eso conviene completar el canvas en grupo.</p>
      <h2>Conexiones</h2>
      <p>Las justificativas y beneficios provienen del <a href="tema.html?id=business-case">caso de negocio</a>; la línea de tiempo se detalla en <a href="tema.html?id=schedules-resources">cronogramas y recursos</a>; las restricciones forman la
      <a href="tema.html?id=triple-constraint">triple restricción</a>; los riesgos y los interesados se amplían en <a href="tema.html?id=project-risks-stakeholders">riesgos e interesados</a>;
      los requisitos se gestionan en <a href="tema.html?id=requirements-management">gestión de requisitos</a>, y el canvas es el primer producto del <a href="tema.html?id=project-lifecycle">ciclo de vida</a>.</p>`,
  });
})();
