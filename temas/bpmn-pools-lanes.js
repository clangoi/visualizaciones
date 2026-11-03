(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Datos: compra de equipos entre cliente, empresa y transportista ---------- */

  const POOLS = ['Cliente', 'Empresa', 'Transporte'];
  const CARRILES = ['Ventas', 'Finanzas', 'Bodega'];
  // pool: 0 cliente, 1 empresa, 2 transporte. lane: carril dentro de la empresa. h: horas de trabajo.
  const TASKS = [
    { id: 't1', pool: 0, lane: 0, row: 1, n: 'Enviar orden de compra', h: 0.5 },
    { id: 't2', pool: 1, lane: 0, row: 2, n: 'Registrar orden', h: 0.5 },
    { id: 't3', pool: 1, lane: 1, row: 3, n: 'Evaluar crédito', h: 2 },
    { id: 't4', pool: 1, lane: 2, row: 4, n: 'Reservar stock', h: 1 },
    { id: 't5', pool: 1, lane: 2, row: 5, n: 'Preparar despacho', h: 3 },
    { id: 't6', pool: 2, lane: 0, row: 6, n: 'Transportar', h: 24 },
    { id: 't7', pool: 0, lane: 0, row: 7, n: 'Recibir equipos', h: 0.5 },
    { id: 't8', pool: 1, lane: 1, row: 8, n: 'Emitir factura', h: 0.5 },
    { id: 't9', pool: 0, lane: 0, row: 9, n: 'Pagar factura', h: 1 },
    { id: 't10', pool: 1, lane: 1, row: 10, n: 'Registrar pago', h: 0.5 },
  ];
  const porId = (id) => TASKS.find((t) => t.id === id);
  // Flujos de mensaje: cruzan de una piscina a otra.
  const MENSAJES = [['t1', 't2', 'Orden'], ['t5', 't6', 'Retiro'], ['t6', 't7', 'Equipos'], ['t7', 't8', 'Recepción'], ['t8', 't9', 'Factura'], ['t9', 't10', 'Pago']];
  // Flujos de secuencia: solo dentro de una piscina (pueden cruzar carriles).
  const SECUENCIAS = [['s', 't1'], ['t1', 't7'], ['t7', 't9'], ['t9', 'e1'], ['t2', 't3'], ['t3', 't4'], ['t4', 't5'], ['t5', 't8'], ['t8', 't10'], ['t10', 'e2']];
  const EVENTOS = { s: { pool: 0, lane: 0, row: 0, pos: 'inicio', n: 'Necesita equipos' }, e1: { pool: 0, lane: 0, row: 10, pos: 'fin', n: 'Compra cerrada' }, e2: { pool: 1, lane: 1, row: 11, pos: 'fin', n: 'Caso cerrado' } };
  const LANES0 = Object.fromEntries(TASKS.map((t) => [t.id, t.lane]));
  const colDe = (el, lanes) => (el.pool === 0 ? 0 : el.pool === 2 ? 4 : 1 + (lanes[el.id] !== undefined ? lanes[el.id] : el.lane));
  const pistaDe = (el, lanes) => (el.pool === 1 ? (lanes[el.id] !== undefined ? lanes[el.id] : el.lane) : -1);

  // Qué separa a una tarea de la anterior: un mensaje entre piscinas, un traspaso entre carriles o nada.
  function brecha(a, b, lanes) {
    if (a.pool !== b.pool) return 'msg';
    if (a.pool === 1 && pistaDe(a, lanes) !== pistaDe(b, lanes)) return 'traspaso';
    return null;
  }
  function cronograma(lanes, esp, lat) {
    const segs = [];
    let t = 0, trasp = 0, msgs = 0, trabajo = 0;
    TASKS.forEach((q, i) => {
      if (i) {
        const g = brecha(TASKS[i - 1], q, lanes);
        if (g) {
          const d = g === 'msg' ? lat : esp;
          segs.push({ tipo: g, ini: t, fin: t + d, de: TASKS[i - 1], q });
          t += d; if (g === 'msg') msgs++; else trasp++;
        }
      }
      segs.push({ tipo: 'trabajo', ini: t, fin: t + q.h, q });
      t += q.h; trabajo += q.h;
    });
    return { segs, total: t, trasp, msgs, trabajo };
  }

  /* ---------- Fig. 1: diagrama de colaboración ---------- */

  function montarColaboracion(cuerpo) {
    let k = 0, espera = 6, latencia = 3, verMensajes = true, mensaje = '', rects = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera por traspaso entre carriles', min: 0, max: 16, paso: 0.5, valor: espera, formato: (v) => `${v} h`, alCambiar: (v) => { espera = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Demora de un mensaje entre piscinas', min: 0, max: 12, paso: 0.5, valor: latencia, formato: (v) => `${v} h`, alCambiar: (v) => { latencia = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar flujos de mensaje', valor: verMensajes, alCambiar: (v) => { verMensajes = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 46 + 12 * 48 + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'flujo de secuencia (dentro de una piscina)', forma: 'linea' },
      { color: C.tinta2, texto: 'flujo de mensaje (entre piscinas, discontinuo)', forma: 'linea' },
      { color: C.s2, texto: 'tarea en curso', forma: 'punto' },
      { color: VIZ.alfa(C.s1, 0.3), texto: 'tarea terminada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance tarea por tarea. Las líneas continuas son secuencias dentro de una piscina (aunque cambien de carril); las discontinuas son mensajes entre piscinas distintas. Pase el cursor sobre una tarea para ver cómo recibe el trabajo.');

    function iniciar() {
      k = 0; mensaje = 'Pulse «Un paso»: el cliente envía su orden de compra.';
      return (function* () {
        for (k = 1; k <= TASKS.length; k++) {
          const q = TASKS[k - 1];
          let por = 'Es la primera tarea del caso.';
          if (k > 1) {
            const g = brecha(TASKS[k - 2], q, LANES0), a = TASKS[k - 2];
            if (g === 'msg') { const m = MENSAJES.find((x) => x[1] === q.id); por = `Llega el mensaje «${m ? m[2] : '…'}» desde ${POOLS[a.pool]}: cruza de piscina, por eso es un flujo de mensaje y tarda ${VIZ.fmt(latencia)} h.`; }
            else if (g === 'traspaso') por = `El trabajo pasa del carril ${CARRILES[a.lane]} al carril ${CARRILES[q.lane]} de la misma piscina (secuencia, no mensaje): traspaso de ${VIZ.fmt(espera)} h.`;
            else por = `Sigue en el mismo carril (${CARRILES[q.lane]}): sin espera.`;
          }
          mensaje = `«${q.n}» (${POOLS[q.pool]}${q.pool === 1 ? ' · ' + CARRILES[q.lane] : ''}). ${por}`;
          yield;
        }
      })();
    }

    function geometria(W) {
      const mx = 4, gp = 8, u = (W - 2 * mx - 2 * gp) / 5;
      const poolX = [mx, mx + u + gp, mx + 4 * u + 2 * gp], poolW = [u, 3 * u, u];
      const colX = (c) => (c === 0 ? poolX[0] + u / 2 : c <= 3 ? poolX[1] + (c - 1) * u + u / 2 : poolX[2] + u / 2);
      return { u, poolX, poolW, colX, rowY: (r) => 46 + r * 48 + 24 };
    }
    // Línea quebrada de un flujo de mensaje.
    function rutaMensaje(A, B) {
      const lado = B.x > A.x ? 1 : -1, xv = B.x - lado * 14;
      return [[A.x + lado * A.w / 2, A.y], [xv, A.y], [xv, B.y - B.h / 2]];
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const G = geometria(W), chico = G.u < 92, fz = chico ? 9 : 10;
      // Piscinas y carriles.
      POOLS.forEach((p, i) => {
        ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.rect(G.poolX[i], 2, G.poolW[i], H - 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.fondo2; ctx.fillRect(G.poolX[i] + 1, 3, G.poolW[i] - 2, 20);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(fz + 1, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p, G.poolX[i] + G.poolW[i] / 2, 13);
      });
      CARRILES.forEach((c, i) => {
        const x = G.poolX[1] + i * G.u;
        if (i) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 23); ctx.lineTo(x, H - 3); ctx.stroke(); }
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(fz, 600); ctx.textAlign = 'center'; ctx.fillText(c, x + G.u / 2, 34);
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(G.poolX[1], 43); ctx.lineTo(G.poolX[1] + G.poolW[1], 43); ctx.stroke();
      // Geometría de elementos.
      const geo = {};
      TASKS.forEach((q) => { geo[q.id] = { x: G.colX(colDe(q, LANES0)), y: G.rowY(q.row), w: G.u - 10, h: 36, q }; });
      Object.entries(EVENTOS).forEach(([id, e]) => { geo[id] = { x: G.colX(colDe(e, LANES0)), y: G.rowY(e.row), w: 22, h: 22, ev: e }; });
      const hechas = new Set(TASKS.slice(0, k).map((q) => q.id)), actual = k > 0 && k <= TASKS.length ? TASKS[k - 1].id : null;
      const activaSec = (a, b) => (hechas.has(a) || a === 's') && (hechas.has(b) || b === 'e1' && hechas.has('t9') || b === 'e2' && hechas.has('t10'));
      const flecha = (x, y, ang, lleno) => {
        ctx.beginPath(); ctx.moveTo(x - 8 * Math.cos(ang - 0.4), y - 8 * Math.sin(ang - 0.4)); ctx.lineTo(x, y); ctx.lineTo(x - 8 * Math.cos(ang + 0.4), y - 8 * Math.sin(ang + 0.4));
        if (lleno) { ctx.closePath(); ctx.fill(); } else ctx.stroke();
      };
      // Secuencias.
      SECUENCIAS.forEach(([a, b]) => {
        const A = geo[a], B = geo[b], viva = activaSec(a, b);
        ctx.strokeStyle = viva ? C.tinta : C.eje; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = viva ? 2.5 : 1.5; ctx.setLineDash([]);
        const y1 = A.y + A.h / 2, y2 = B.y - B.h / 2;
        const pts = Math.abs(A.x - B.x) < 2 ? [[A.x, y1], [B.x, y2]] : [[A.x, y1], [A.x, (y1 + y2) / 2], [B.x, (y1 + y2) / 2], [B.x, y2]];
        ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
        flecha(B.x, y2, Math.PI / 2, true);
      });
      // Mensajes.
      if (verMensajes) {
        MENSAJES.forEach(([a, b, nombre]) => {
          const A = geo[a], B = geo[b], pts = rutaMensaje(A, B), hecho = hechas.has(b), enCurso = b === actual;
          ctx.strokeStyle = hecho ? C.tinta2 : C.inactivo; ctx.lineWidth = enCurso ? 3 : hecho ? 2 : 1.5; ctx.setLineDash([5, 4]);
          ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = C.superficie; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 3.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
          const [x2, y2] = pts[2];
          flecha(x2, y2, Math.PI / 2, false);
          const mx = (pts[0][0] + pts[1][0]) / 2;
          ctx.font = VIZ.fuente(9, 600); const tw = ctx.measureText(nombre).width + 6;
          ctx.fillStyle = C.superficie; ctx.fillRect(mx - tw / 2, pts[0][1] - 15, tw, 12);
          ctx.fillStyle = hecho ? C.tinta2 : C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(nombre, mx, pts[0][1] - 9);
          if (enCurso) { ctx.fillStyle = C.s2; ctx.beginPath(); ctx.arc(x2, y2 - 12, 5, 0, 2 * Math.PI); ctx.fill(); }
        });
      }
      // Eventos y tareas.
      Object.entries(EVENTOS).forEach(([id, e]) => {
        const g = geo[id];
        ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = e.pos === 'fin' ? 4 : 1.5;
        ctx.beginPath(); ctx.arc(g.x, g.y, 10, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      });
      rects = [];
      TASKS.forEach((q) => {
        const g = geo[q.id], hecho = hechas.has(q.id);
        ctx.fillStyle = hecho ? VIZ.alfa(C.s1, 0.25) : C.superficie; ctx.strokeStyle = q.id === actual ? C.s2 : C.tinta; ctx.lineWidth = q.id === actual ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(fz - 1, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const pal = q.n.split(' '), ls = [];
        let cur = '';
        pal.forEach((p) => { const t = cur ? cur + ' ' + p : p; if (cur && ctx.measureText(t).width > g.w - 8) { ls.push(cur); cur = p; } else cur = t; });
        ls.push(cur);
        ls.slice(0, 3).forEach((t, i, a) => ctx.fillText(t, g.x, g.y + (i - (a.length - 1) / 2) * 11));
        rects.push({ x: g.x - g.w / 2, y: g.y - g.h / 2, w: g.w, h: g.h, q });
      });
      ctx.font = VIZ.fuente(fz - 1, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      Object.entries(EVENTOS).forEach(([id, e]) => { const g = geo[id]; ctx.fillText(e.n.length > 12 && chico ? e.n.split(' ')[0] : e.n, g.x, g.y + 13); });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      // Medidas.
      const cr = cronograma(LANES0, espera, latencia);
      let t = 0, lan = 0, men = 0;
      TASKS.forEach((q, i) => { if (i >= k) return; if (i) { const g = brecha(TASKS[i - 1], q, LANES0); if (g === 'msg') { t += latencia; men++; } else if (g === 'traspaso') { t += espera; lan++; } } t += q.h; });
      registro.textContent = mensaje;
      lectura.set([
        ['tareas terminadas', `${Math.min(k, TASKS.length)} de ${TASKS.length}`],
        ['traspasos entre carriles', `${lan} de ${cr.trasp}`],
        ['mensajes entre piscinas', `${men} de ${cr.msgs}`],
        ['tiempo transcurrido', `${VIZ.fmt(t, 4)} h`],
        ['tiempo total del caso', `${VIZ.fmt(cr.total, 4)} h`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = rects.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!r) return tip.ocultar();
      const q = r.q, i = TASKS.indexOf(q), g = i ? brecha(TASKS[i - 1], q, LANES0) : null;
      const m = MENSAJES.find((z) => z[1] === q.id);
      tip.mostrar(x, y, `<b>${q.n}</b><br>${POOLS[q.pool]}${q.pool === 1 ? ' · ' + CARRILES[q.lane] : ''}<br>trabajo: <b>${VIZ.fmt(q.h)} h</b><br>` +
        (i === 0 ? 'primera tarea' : g === 'msg' ? `recibe el mensaje «${m ? m[2] : ''}»` : g === 'traspaso' ? 'recibe el trabajo por un traspaso entre carriles' : 'sigue en el mismo carril'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: costo en tiempo de los traspasos ---------- */

  function montarTraspasos(cuerpo) {
    let espera = 6, latencia = 3, hover = null, rects = [], pl = null;
    const lanes = { ...LANES0 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Espera por traspaso entre carriles', min: 0, max: 16, paso: 0.5, valor: espera, formato: (v) => `${v} h`, alCambiar: (v) => { espera = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Demora de un mensaje entre piscinas', min: 0, max: 12, paso: 0.5, valor: latencia, formato: (v) => `${v} h`, alCambiar: (v) => { latencia = v; dibujar(); } });
    const selectores = {};
    ['t2', 't3', 't4', 't5'].forEach((id) => {
      selectores[id] = ctl.selector({ etiqueta: `Carril de «${porId(id).n}»`, opciones: CARRILES.map((c, i) => [String(i), c]), valor: String(lanes[id]), alCambiar: (v) => { lanes[id] = +v; dibujar(); } });
    });
    ctl.boton('Todo en un carril', () => { ['t2', 't3', 't4', 't5'].forEach((id) => { lanes[id] = 0; selectores[id].valor = '0'; }); dibujar(); }, { primario: true });
    ctl.boton('Diseño original', () => { ['t2', 't3', 't4', 't5'].forEach((id) => { lanes[id] = LANES0[id]; selectores[id].valor = String(LANES0[id]); }); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 230 : 210) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'trabajo' }, { color: C.s2, texto: 'traspaso entre carriles' }, { color: C.s4, texto: 'mensaje entre piscinas' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reasigne las cuatro tareas internas de la empresa a carriles distintos y mire cómo aparecen o desaparecen los segmentos naranjos. Los mensajes (amarillo) no se pueden eliminar sin cambiar de participantes. Pase el cursor sobre un segmento.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const mia = cronograma(lanes, espera, latencia), orig = cronograma(LANES0, espera, latencia), uno = cronograma(Object.fromEntries(TASKS.map((q) => [q.id, 0])), espera, latencia);
      const filas = [['Su asignación', mia], ['Diseño original', orig], ['Un solo carril', uno]];
      const xmax = Math.max(10, Math.ceil(Math.max(...filas.map((f) => f[1].total)) / 10) * 10);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: 3 }, { etiquetaX: 'horas desde el pedido', ticksY: [], margen: { izq: W < 560 ? 78 : 96, sup: 8 } });
      pl.ejes();
      rects = [];
      filas.forEach(([nombre, c], i) => {
        const yc = pl.sy(2.5 - i);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(nombre, 4, yc);
        c.segs.forEach((s) => {
          const x = pl.sx(s.ini), w = Math.max(1, pl.sx(s.fin) - x);
          ctx.fillStyle = s === hover ? VIZ.alfa(s.tipo === 'trabajo' ? C.s1 : s.tipo === 'msg' ? C.s4 : C.s2, 0.7) : s.tipo === 'trabajo' ? C.s1 : s.tipo === 'msg' ? C.s4 : C.s2;
          ctx.fillRect(x, yc - 13, Math.max(w - 1, 1), 26);
          rects.push({ x, y: yc - 13, w, h: 26, s, fila: nombre });
        });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left';
        ctx.fillText(`${VIZ.fmt(c.total, 4)} h`, Math.min(pl.sx(c.total) + 5, W - 44), yc - 21 < pl.y1 ? yc - 17 : yc + 0);
      });
      const perdida = mia.total - mia.trabajo;
      registro.textContent = `Su asignación: ${mia.trasp} traspasos entre carriles y ${mia.msgs} mensajes suman ${VIZ.fmt(perdida, 4)} h de espera sobre ${VIZ.fmt(mia.trabajo, 4)} h de trabajo. Con todo en un carril, el caso dura ${VIZ.fmt(uno.total, 4)} h (${VIZ.fmt(mia.total - uno.total, 3)} h menos).`;
      lectura.set([
        ['traspasos entre carriles', `${mia.trasp} (original ${orig.trasp})`],
        ['mensajes entre piscinas', String(mia.msgs)],
        ['tiempo total del caso', `${VIZ.fmt(mia.total, 4)} h`],
        ['espera sobre el total', `${VIZ.fmt((perdida / mia.total) * 100, 3)} %`],
        ['ahorro frente al diseño original', `${VIZ.fmt(orig.total - mia.total, 3)} h`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = rects.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      const h = r ? r.s : null;
      if (h !== hover) { hover = h; dibujar(); }
      if (!r) return tip.ocultar();
      const s = r.s;
      tip.mostrar(x, y, s.tipo === 'trabajo'
        ? `<b>${s.q.n}</b><br>${POOLS[s.q.pool]}<br>de ${VIZ.fmt(s.ini, 4)} h a ${VIZ.fmt(s.fin, 4)} h<br>trabajo <b>${VIZ.fmt(s.fin - s.ini)} h</b>`
        : `<b>${s.tipo === 'msg' ? 'Mensaje entre piscinas' : 'Traspaso entre carriles'}</b><br>de «${s.de.n}» a «${s.q.n}»<br>espera <b>${VIZ.fmt(s.fin - s.ini)} h</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bpmn-pools-lanes', {
    intro: String.raw`
      <p>Cuando en un proceso participan varios actores, BPMN los separa con <strong>piscinas</strong> (<em>pools</em>): una por participante autónomo, como el cliente, la empresa y el transportista.
      Dentro de una piscina, los <strong>carriles</strong> (<em>lanes</em>) reparten las tareas entre roles o departamentos, por ejemplo Ventas, Finanzas y Bodega.</p>
      <p>La diferencia es clave: el trabajo que cambia de carril sigue siendo un solo flujo de <em>secuencia</em>, pero lo que cruza de una piscina a otra solo puede ser un <strong>mensaje</strong>.
      Cada traspaso, entre carriles o entre piscinas, es un lugar donde el caso espera, y esa espera se paga en tiempo.</p>`,
    visualizaciones: [
      {
        titulo: 'Colaboración entre tres participantes',
        descripcion: 'Avance tarea por tarea y distinga las líneas continuas (secuencia) de las discontinuas (mensajes). Apague los mensajes para ver que cada piscina, por sí sola, parece un proceso completo.',
        montar: montarColaboracion,
      },
      {
        titulo: 'Cuánto cuestan los traspasos',
        descripcion: 'Mueva las cuatro tareas de la empresa entre carriles: cada cambio de carril agrega una espera. Compare su asignación con el diseño original y con «Todo en un carril», y suba la demora de los mensajes.',
        montar: montarTraspasos,
      },
    ],
    teoria: String.raw`
      <h2>Piscinas, carriles y flujos</h2>
      <table>
        <tr><th>Elemento</th><th>Qué representa</th><th>Reglas</th></tr>
        <tr><td>Piscina (<em>pool</em>)</td><td>un participante: organización o rol autónomo</td><td>contiene un proceso completo; se comunica con otras solo por mensajes</td></tr>
        <tr><td>Carril (<em>lane</em>)</td><td>una subdivisión de la piscina: rol, área o sistema</td><td>no es un participante distinto: comparte el proceso de la piscina</td></tr>
        <tr><td>Flujo de secuencia</td><td>orden de ejecución dentro de una piscina</td><td>puede cruzar carriles, nunca piscinas</td></tr>
        <tr><td>Flujo de mensaje</td><td>comunicación entre participantes</td><td>solo conecta elementos de piscinas distintas; línea discontinua con círculo de origen</td></tr>
      </table>
      <p>Una piscina de una organización externa suele dibujarse como <em>caja negra</em> (sin interior): solo importan los mensajes que intercambia con nosotros.</p>
      <h2>Costo en tiempo de los traspasos</h2>
      <p>Si \(d_i\) es el trabajo de la tarea \(i\), \(N_c\) el número de cambios de carril consecutivos dentro de una piscina, con espera media \(w_c\), y \(N_m\) el número de mensajes, con demora media \(w_m\):</p>
      \[ T = \sum_i d_i + N_c\, w_c + N_m\, w_m. \]
      <h3>Ejemplo resuelto</h3>
      <p>El trabajo suma \(0{,}5 + 0{,}5 + 2 + 1 + 3 + 24 + 0{,}5 + 0{,}5 + 1 + 0{,}5 = 33{,}5\) h. Con el diseño original hay \(N_c = 2\) (Ventas → Finanzas → Bodega) y \(N_m = 6\); con \(w_c = 6\) h y \(w_m = 3\) h:</p>
      \[ T = 33{,}5 + 2 \cdot 6 + 6 \cdot 3 = 63{,}5\ \text{h}. \]
      <p>Si una misma persona o un equipo hace las cuatro tareas internas, \(N_c = 0\) y \(T = 51{,}5\) h: se ahorran 12 h (19 %) sin acelerar ninguna tarea. Los 18 h de mensajes solo bajan si se acorta la comunicación (por ejemplo, integrando sistemas), porque cruzan participantes.</p>
      <div class="recuadro"><p><strong>Contrapeso.</strong> Los carriles existen por una razón: separación de funciones y control. Quien registra una orden no debería aprobar el crédito. Juntar carriles reduce traspasos pero puede romper un control; se decide caso a caso.</p></div>
      <h2>Conexiones</h2>
      <p>Los eventos que envían y reciben los mensajes se estudian en <a href="tema.html?id=bpmn-events-tasks">eventos, tareas y subprocesos</a>, y las decisiones en <a href="tema.html?id=bpmn-gateways">compuertas</a>.
      Quién ocupa cada carril se define con la <a href="tema.html?id=raci-matrix">matriz RACI</a>; los traspasos reales se miden con el <a href="tema.html?id=handover-of-work">traspaso de trabajo</a> en minería de procesos.
      El efecto de las esperas sobre el tiempo de ciclo se simula en <a href="tema.html?id=process-simulation">simulación de procesos</a>, y la visión de silos en <a href="tema.html?id=business-process-anatomy">anatomía de un proceso</a>.</p>`,
  });
})();
