(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos: del pedido del cliente al cobro ---------- */

  const AREAS = [
    { id: 'Ventas', color: C.s1 }, { id: 'Finanzas', color: C.s2 }, { id: 'Bodega', color: C.s3 }, { id: 'Logística', color: C.s4 },
  ];
  const colorArea = (id) => AREAS.find((a) => a.id === id).color;
  // h: horas de trabajo efectivo de la actividad.
  const ACTS = [
    { id: 'reg', n: 'Registrar pedido', c: 'Registrar', area: 'Ventas', resp: 'Vendedor', ent: ['Solicitud del cliente'], sal: ['Pedido registrado'], h: 0.5 },
    { id: 'cre', n: 'Evaluar crédito', c: 'Crédito', area: 'Finanzas', resp: 'Analista de crédito', ent: ['Pedido registrado'], sal: ['Línea aprobada'], h: 2 },
    { id: 'res', n: 'Reservar stock', c: 'Reservar', area: 'Bodega', resp: 'Bodeguero', ent: ['Pedido registrado'], sal: ['Reserva de stock'], h: 1 },
    { id: 'pre', n: 'Preparar despacho', c: 'Preparar', area: 'Bodega', resp: 'Jefe de bodega', ent: ['Reserva de stock', 'Línea aprobada'], sal: ['Guía de despacho'], h: 2 },
    { id: 'fac', n: 'Emitir factura', c: 'Facturar', area: 'Finanzas', resp: 'Facturador', ent: ['Guía de despacho'], sal: ['Factura'], h: 0.5 },
    { id: 'ent', n: 'Entregar al cliente', c: 'Entregar', area: 'Logística', resp: 'Conductor', ent: ['Guía de despacho'], sal: ['Comprobante de entrega'], h: 6 },
    { id: 'cob', n: 'Registrar cobro', c: 'Cobrar', area: 'Finanzas', resp: 'Tesorero', ent: ['Factura', 'Comprobante de entrega'], sal: ['Pago aplicado'], h: 0.5 },
  ];
  const DOC_INICIAL = 'Solicitud del cliente';
  const porId = (id) => ACTS.find((a) => a.id === id);

  // Una actividad depende de otra cuando una de sus entradas es salida de la anterior.
  const ARISTAS = [];
  ACTS.forEach((b, j) => ACTS.slice(0, j).forEach((a) => {
    const d = b.ent.find((x) => a.sal.includes(x));
    if (d) ARISTAS.push({ de: a.id, a: b.id, doc: d });
  }));
  const RANGO = {};
  ACTS.forEach((a) => { RANGO[a.id] = Math.max(-1, ...ARISTAS.filter((e) => e.a === a.id).map((e) => RANGO[e.de])) + 1; });
  const MAXR = Math.max(...Object.values(RANGO));
  const TODOS_LOS_DOCS = new Set(ACTS.flatMap((a) => a.sal));

  // Ejecuta el proceso en orden: una actividad corre solo si no se omitió y tiene todas sus entradas.
  function evaluar(omit) {
    const disp = new Set([DOC_INICIAL]);
    const est = {};
    for (const a of ACTS) {
      if (omit.has(a.id)) { est[a.id] = { e: 'omitida', faltan: [] }; continue; }
      const faltan = a.ent.filter((d) => !disp.has(d));
      if (faltan.length) { est[a.id] = { e: 'bloqueada', faltan }; continue; }
      est[a.id] = { e: 'ok', faltan: [] };
      a.sal.forEach((d) => disp.add(d));
    }
    return { est, disp };
  }

  /* ---------- Fig. 1: actividades, entradas y salidas ---------- */

  function montarAnatomia(cuerpo) {
    const omit = new Set();
    let semilla = 1, mensaje = 'Todas las actividades se ejecutan: cada una recibe lo que produce otra. Haga clic en una actividad para omitirla.', geo = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Omitir una actividad al azar', () => {
      const libres = ACTS.filter((a) => !omit.has(a.id));
      if (!libres.length) return;
      alternar(libres[Math.floor(VIZ.semilla(semilla++ * 7919)() * libres.length)].id);
    }, { primario: true });
    ctl.boton('Restablecer', () => { omit.clear(); narrar(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 640 ? 330 : 4 * 64 + 16) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      ...AREAS.map((a) => ({ color: a.color, texto: a.id })),
      { color: C.s8, texto: 'bloqueada: falta una entrada' },
      { color: C.inactivo, texto: 'omitida' },
      { color: C.tinta2, texto: 'traspaso entre áreas', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una actividad (o en su fila de la tabla) para omitirla o volver a incluirla; pase el cursor para ver su entrada, salida y responsable. Las flechas gruesas son traspasos entre áreas.');

    function alternar(id) {
      if (omit.has(id)) omit.delete(id); else omit.add(id);
      narrar(); dibujar();
    }
    function narrar() {
      const ev = evaluar(omit);
      const bloq = ACTS.filter((x) => ev.est[x.id].e === 'bloqueada');
      if (!omit.size) { mensaje = 'Todas las actividades se ejecutan: cada una recibe lo que produce otra.'; return; }
      const faltan = [...new Set(bloq.flatMap((x) => ev.est[x.id].faltan))];
      mensaje = `Se omite ${[...omit].map((i) => `«${porId(i).n}»`).join(', ')}. ` + (bloq.length
        ? `No pueden ejecutarse ${bloq.map((x) => `«${x.n}»`).join(', ')} por falta de ${faltan.map((d) => `«${d}»`).join(', ')}.`
        : 'Ninguna otra actividad se queda sin entradas.')
        + (ev.disp.has('Pago aplicado') ? '' : ' El proceso ya no produce «Pago aplicado»: el resultado para el cliente se pierde.');
    }
    function tabla() {
      const ev = evaluar(omit);
      const filas = ACTS.map((a) => {
        const s = ev.est[a.id];
        const txt = s.e === 'ok' ? 'se ejecuta' : s.e === 'omitida' ? 'omitida' : `bloqueada (falta ${s.faltan.join(', ')})`;
        const tr = VIZ.el('tr', { class: 'clicable' + (s.e === 'omitida' ? ' tachada' : '') },
          VIZ.el('td', null, a.n), VIZ.el('td', null, a.area), VIZ.el('td', null, a.resp), VIZ.el('td', null, a.ent.join(', ')), VIZ.el('td', null, a.sal.join(', ')), VIZ.el('td', { style: { color: s.e === 'bloqueada' ? C.s8 : null } }, txt));
        tr.addEventListener('click', () => alternar(a.id));
        return tr;
      });
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
        VIZ.el('thead', null, VIZ.el('tr', null, ...['Actividad', 'Área', 'Responsable', 'Entrada', 'Salida', 'Estado'].map((t) => VIZ.el('th', null, t)))),
        VIZ.el('tbody', null, ...filas)));
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ev = evaluar(omit), est = ev.est;
      const estrecho = W < 640, NL = AREAS.length;
      const mx = estrecho ? 8 : 48, my = estrecho ? 30 : 8;
      // Bandas de las áreas funcionales.
      ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'top';
      AREAS.forEach((a, i) => {
        ctx.fillStyle = i % 2 ? C.superficie : C.fondo2;
        if (estrecho) {
          const bw = (W - 2 * mx) / NL;
          ctx.fillRect(mx + i * bw, 0, bw, H);
          ctx.fillStyle = a.color; ctx.fillRect(mx + i * bw + 4, 6, 8, 8);
          ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(a.id, mx + i * bw + 16, 5);
        } else {
          const bh = (H - 2 * my) / NL;
          ctx.fillRect(0, my + i * bh, W, bh);
          ctx.fillStyle = a.color; ctx.fillRect(6, my + i * bh + 5, 8, 8);
          ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(a.id.toUpperCase(), 18, my + i * bh + 4);
        }
      });
      const pos = {};
      ACTS.forEach((a) => {
        const l = (AREAS.findIndex((z) => z.id === a.area) + 0.5) / NL, r = RANGO[a.id] / MAXR;
        pos[a.id] = estrecho ? { x: l, y: r } : { x: r, y: l };
      });
      const nodos = ACTS.map((a) => {
        const s = est[a.id].e, col = colorArea(a.area);
        if (s === 'omitida') return { id: a.id, tipo: 'act', etiqueta: a.c, relleno: C.neutro, borde: C.inactivo, colorTexto: C.apagado, insignia: 'omitida', colorInsignia: C.apagado };
        if (s === 'bloqueada') return { id: a.id, tipo: 'act', etiqueta: a.c, relleno: VIZ.alfa(col, 0.18), borde: C.s8, anillo: C.s8, insignia: 'sin entrada', colorInsignia: C.s8 };
        return { id: a.id, tipo: 'act', etiqueta: a.c, relleno: VIZ.alfa(col, 0.22), borde: col };
      });
      const aristas = ARISTAS.map((e) => {
        const A = porId(e.de), B = porId(e.a), viva = est[e.de].e === 'ok' && est[e.a].e === 'ok', cruza = A.area !== B.area;
        return { de: e.de, a: e.a, ancho: viva && cruza ? 3 : 1.5, color: viva ? (cruza ? C.tinta2 : C.eje) : C.tenue, guiones: !viva };
      });
      geo = P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 10, margenX: mx, margenY: my });
      const ok = ACTS.filter((a) => est[a.id].e === 'ok');
      const traspasos = ARISTAS.filter((e) => est[e.de].e === 'ok' && est[e.a].e === 'ok' && porId(e.de).area !== porId(e.a).area).length;
      const docs = [...ev.disp].filter((d) => TODOS_LOS_DOCS.has(d)).length;
      registro.textContent = mensaje;
      lectura.set([
        ['actividades que se ejecutan', `${ok.length} de ${ACTS.length}`],
        ['bloqueadas por falta de entrada', String(ACTS.filter((a) => est[a.id].e === 'bloqueada').length)],
        ['documentos producidos', `${docs} de ${TODOS_LOS_DOCS.size}`],
        ['traspasos entre áreas', `${traspasos} de ${ARISTAS.filter((e) => porId(e.de).area !== porId(e.a).area).length}`],
        ['áreas que trabajan', String(new Set(ok.map((a) => a.area)).size)],
      ]);
      tabla();
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const g = P.nodoEn(geo, x, y);
      if (!g) return tip.ocultar();
      const a = porId(g.id);
      tip.mostrar(x, y, `<b>${a.n}</b><br>área <b>${a.area}</b>, ${a.resp}<br>entra: ${a.ent.join(', ')}<br>sale: ${a.sal.join(', ')}<br>trabajo: <b>${VIZ.fmt(a.h)} h</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const g = P.nodoEn(geo, x, y);
      if (g) alternar(g.id);
    });
    dibujar();
  }

  /* ---------- Fig. 2: el trabajo cruza departamentos ---------- */

  // Cada actividad empieza cuando terminó su último antecedente más la espera del traspaso (si cambia de área).
  function planificar(espera, integrado) {
    const w = espera * (integrado ? 0.2 : 1);
    const info = {};
    ACTS.forEach((a) => {
      const preds = ARISTAS.filter((e) => e.a === a.id).map((e) => porId(e.de));
      let ini = 0, via = null, esp = 0;
      preds.forEach((p) => {
        const e = p.area !== a.area ? w : 0, t = info[p.id].fin + e;
        if (via === null || t > ini + 1e-9) { ini = t; via = p.id; esp = e; }
      });
      info[a.id] = { a, ini, fin: ini + a.h, via, esp, preds };
    });
    const lead = Math.max(...ACTS.map((a) => info[a.id].fin));
    let cur = ACTS.find((a) => info[a.id].fin === lead).id;
    const ruta = [];
    while (cur) { ruta.unshift(cur); cur = info[cur].via; }
    const trabajo = ruta.reduce((s, id) => s + porId(id).h, 0);
    const esperas = ruta.reduce((s, id) => s + info[id].esp, 0);
    const traspasos = ruta.filter((id) => info[id].via && porId(info[id].via).area !== porId(id).area).length;
    const orden = ACTS.slice().sort((a, b) => info[a.id].ini - info[b.id].ini || ACTS.indexOf(a) - ACTS.indexOf(b));
    return { info, lead, ruta, trabajo, esperas, traspasos, orden, w };
  }

  function montarSilos(cuerpo) {
    let espera = 8, integrado = false, k = 0, plan = planificar(espera, integrado), rects = [], pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera por traspaso entre áreas', min: 0, max: 16, paso: 0.5, valor: espera, formato: (v) => `${v} h`, alCambiar: (v) => { espera = v; recalcular(); } });
    ctl.casilla({ etiqueta: 'Sistema compartido (espera × 0,2)', valor: integrado, alCambiar: (v) => { integrado = v; recalcular(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 640 ? 250 : 270) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...AREAS.map((a) => ({ color: a.color, texto: a.id })),
      { color: VIZ.alfa(C.apagado, 0.35), texto: 'espera por traspaso' },
      { color: C.tinta, texto: 'ruta crítica (borde grueso)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» o «Reproducir» para ver cómo el trabajo salta de un departamento a otro. Suba la espera por traspaso, o active el sistema compartido, y compare el tiempo total con el trabajo efectivo. Pase el cursor sobre una barra.');

    let mensaje = 'Pulse «Un paso»: se mostrará la primera actividad del caso.';
    function iniciar() {
      k = 0; mensaje = 'Pulse «Un paso»: se mostrará la primera actividad del caso.';
      return (function* () {
        for (k = 1; k <= ACTS.length; k++) {
          const a = plan.orden[k - 1], i = plan.info[a.id];
          const por = i.via
            ? `espera a «${porId(i.via).n}», que termina en t = ${VIZ.fmt(plan.info[i.via].fin)} h` + (i.esp > 0 ? `, y el traspaso de ${porId(i.via).area} a ${a.area} tarda ${VIZ.fmt(i.esp)} h` : ' (misma área: sin espera)')
            : 'no depende de ninguna otra';
          mensaje = `«${a.n}» (${a.area}) empieza en t = ${VIZ.fmt(i.ini)} h: ${por}. Trabaja ${VIZ.fmt(a.h)} h y termina en ${VIZ.fmt(i.fin)} h.`;
          yield;
        }
      })();
    }
    function recalcular() { plan = planificar(espera, integrado); dibujar(); }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const NL = AREAS.length;
      const xmax = Math.max(8, Math.ceil(plan.lead / 4) * 4);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: NL }, { etiquetaX: 'horas desde el pedido', ticksY: [], margen: { izq: W < 640 ? 66 : 80, sup: 10 } });
      const yc = (area) => pl.sy(NL - AREAS.findIndex((z) => z.id === area) - 0.5);
      const bh = (pl.y0 - pl.y1) / NL;
      AREAS.forEach((a, i) => {
        ctx.fillStyle = i % 2 ? C.superficie : C.fondo2;
        ctx.fillRect(pl.x0, pl.y1 + i * bh, pl.x1 - pl.x0, bh);
        ctx.fillStyle = a.color; ctx.fillRect(6, pl.y1 + i * bh + bh / 2 - 4, 8, 8);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(a.id, 18, pl.y1 + i * bh + bh / 2);
      });
      pl.ejes();
      rects = [];
      const vis = plan.orden.slice(0, k), enRuta = new Set(plan.ruta);
      // Conexiones y esperas de las actividades ya reveladas.
      vis.forEach((a) => {
        const i = plan.info[a.id];
        i.preds.forEach((p) => {
          if (!vis.includes(p)) return;
          const pi = plan.info[p.id];
          if (i.ini > pi.fin + 1e-9) {
            ctx.fillStyle = VIZ.alfa(C.apagado, 0.3);
            ctx.fillRect(pl.sx(pi.fin), yc(a.area) - 9, pl.sx(i.ini) - pl.sx(pi.fin), 18);
          }
          ctx.strokeStyle = p.area !== a.area ? C.tinta2 : C.eje; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(pl.sx(pi.fin), yc(p.area)); ctx.lineTo(pl.sx(pi.fin), yc(a.area)); ctx.lineTo(pl.sx(i.ini), yc(a.area)); ctx.stroke();
          ctx.setLineDash([]);
        });
      });
      vis.forEach((a, n) => {
        const i = plan.info[a.id], x = pl.sx(i.ini), w = Math.max(3, pl.sx(i.fin) - pl.sx(i.ini)), y = yc(a.area) - 11;
        ctx.fillStyle = colorArea(a.area);
        ctx.beginPath(); ctx.roundRect(x, y, w, 22, 4); ctx.fill();
        const grosor = n === k - 1 ? 3 : enRuta.has(a.id) ? 2.5 : 0;
        if (grosor) { ctx.lineWidth = grosor; ctx.strokeStyle = C.tinta; ctx.stroke(); }
        if (w > 46) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.c, x + w / 2, y + 11.5); }
        rects.push({ x, y, w, h: 22, a });
      });
      registro.textContent = mensaje;
      lectura.set([
        ['tiempo total del caso', `${VIZ.fmt(plan.lead)} h`],
        ['trabajo en la ruta crítica', `${VIZ.fmt(plan.trabajo)} h`],
        ['espera en la ruta crítica', `${VIZ.fmt(plan.esperas)} h`],
        ['trabajo / tiempo total', `${VIZ.fmt((plan.trabajo / plan.lead) * 100, 3)} %`],
        ['traspasos en la ruta', String(plan.traspasos)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = rects.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!r) return tip.ocultar();
      const i = plan.info[r.a.id];
      tip.mostrar(x, y, `<b>${r.a.n}</b><br>${r.a.area}, ${r.a.resp}<br>de ${VIZ.fmt(i.ini)} h a ${VIZ.fmt(i.fin)} h` + VIZ.filaTooltip(colorArea(r.a.area), 'trabajo', `${VIZ.fmt(r.a.h)} h`) + (i.esp > 0 ? VIZ.filaTooltip(C.apagado, 'espera previa', `${VIZ.fmt(i.esp)} h`) : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('business-process-anatomy', {
    intro: String.raw`
      <p>Un <strong>proceso de negocio</strong> es un conjunto de actividades coordinadas que transforma entradas (una solicitud, un documento, un material)
      en una salida que alguien valora: un pedido entregado, un crédito aprobado, un reclamo resuelto. Cada actividad tiene una entrada, una salida y un responsable,
      y casi siempre el trabajo no ocurre en un solo lugar: cruza varias <em>áreas funcionales</em> de la organización.</p>
      <p>Mirar la empresa por procesos, y no por departamentos, explica por qué un pedido que exige 11 horas de trabajo puede tardar casi dos días: el tiempo se
      pierde en los traspasos entre áreas, no en las tareas. Estas figuras descomponen un proceso real de pedido a cobro y siguen el trabajo entre departamentos.</p>`,
    visualizaciones: [
      {
        titulo: 'Actividades, entradas y salidas',
        descripcion: 'Cada actividad consume documentos y produce otros. Omita «Evaluar crédito» y vea qué actividades se bloquean; luego omita «Registrar cobro» y observe que nada se rompe, pero el proceso ya no cumple su propósito.',
        montar: montarAnatomia,
      },
      {
        titulo: 'El trabajo cruza los silos',
        descripcion: 'Avance paso a paso y mueva la espera por traspaso: el tiempo total crece mucho más que el trabajo. Active el sistema compartido y compare cuánto de las horas es trabajo efectivo.',
        montar: montarSilos,
      },
    ],
    teoria: String.raw`
      <h2>Definición y elementos</h2>
      <p>Un proceso de negocio es un conjunto de <em>actividades</em> relacionadas, ejecutadas por personas o sistemas, que convierte <em>entradas</em> en <em>salidas</em> para un cliente
      (interno o externo) y que se repite para cada <em>caso</em> (un pedido, una solicitud). Una actividad se descompone en <em>tareas</em>, la unidad mínima asignable a una persona.</p>
      <table>
        <tr><th>Elemento</th><th>Pregunta que responde</th><th>Ejemplo del pedido</th></tr>
        <tr><td>Actividad</td><td>¿qué se hace?</td><td>Evaluar crédito</td></tr>
        <tr><td>Entrada y salida</td><td>¿qué se recibe y qué se entrega?</td><td>entra «Pedido registrado», sale «Línea aprobada»</td></tr>
        <tr><td>Responsable</td><td>¿quién lo hace?</td><td>Analista de crédito</td></tr>
        <tr><td>Área funcional</td><td>¿en qué departamento ocurre?</td><td>Finanzas</td></tr>
        <tr><td>Caso</td><td>¿qué instancia se procesa?</td><td>el pedido n.º 1043</td></tr>
      </table>
      <p>Las dependencias no se inventan: una actividad \(B\) depende de \(A\) cuando alguna entrada de \(B\) es salida de \(A\). Si se omite \(A\), \(B\) se bloquea, y con ella todo lo que dependa de sus salidas; eso es lo que muestra la primera figura.</p>
      <h2>Silos y traspasos</h2>
      <p>Una organización por funciones optimiza cada departamento por separado. El proceso, en cambio, atraviesa varios: cada vez que el trabajo cambia de área ocurre un <em>traspaso</em>, con cola, espera de que alguien lo vea y, a menudo, información incompleta. Si \(T_{\text{trabajo}}\) es la suma del trabajo en la ruta crítica y \(T_{\text{espera}}\) la suma de las esperas:</p>
      \[ T_{\text{total}} = T_{\text{trabajo}} + T_{\text{espera}}, \qquad \eta = \frac{T_{\text{trabajo}}}{T_{\text{total}}}. \]
      <h3>Ejemplo resuelto</h3>
      <p>Con una espera de 8 h por traspaso, la ruta crítica del pedido es registrar (0,5 h) → evaluar crédito (2 h) → preparar despacho (2 h) → entregar (6 h) → cobrar (0,5 h), con 4 traspasos entre áreas:</p>
      \[ T_{\text{trabajo}} = 0{,}5+2+2+6+0{,}5 = 11\ \text{h}, \quad T_{\text{espera}} = 4 \cdot 8 = 32\ \text{h}, \quad T_{\text{total}} = 43\ \text{h}, \quad \eta \approx 25{,}6\ \%. \]
      <p>Con un sistema compartido que reduce cada espera a 1,6 h, \(T_{\text{total}} = 11 + 6{,}4 = 17{,}4\) h y \(\eta \approx 63\ \%\), sin acelerar ninguna tarea.</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Para acortar un proceso casi nunca se trabaja más rápido: se eliminan traspasos y esperas. Por eso se modela el flujo completo y no cada área por separado.</p></div>
      <h2>Conexiones</h2>
      <p>El mapa de actividades de una empresa se organiza en <a href="tema.html?id=process-maps">mapas de procesos</a>; quién hace, aprueba o solo se entera se fija con la <a href="tema.html?id=raci-matrix">matriz RACI</a>;
      los traspasos se dibujan como <a href="tema.html?id=bpmn-pools-lanes">carriles y piscinas</a> y se miden en los registros con el <a href="tema.html?id=handover-of-work">traspaso de trabajo</a>.
      El mismo proceso se analiza en <a href="tema.html?id=process-simulation">simulación y cuellos de botella</a> y en <a href="tema.html?id=continuous-improvement">mejora continua</a>;
      la visión por procesos es la base de la <a href="tema.html?id=value-chain">cadena de valor</a> y del <a href="tema.html?id=cross-department-flow">flujo de información entre departamentos</a>.</p>`,
  });
})();
