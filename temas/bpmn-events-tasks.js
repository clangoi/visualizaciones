(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Símbolos BPMN ---------- */

  function sobre(ctx, x, y, f) { ctx.save(); ctx.translate(x, y); f(); ctx.restore(); }
  function sobreEnvelope(ctx, w, lleno) {
    const h = w * 0.7;
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta;
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h);
    if (lleno) ctx.fill(); else ctx.stroke();
    ctx.strokeStyle = lleno ? C.superficie : C.tinta;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, h * 0.08); ctx.lineTo(w / 2, -h / 2); ctx.stroke();
  }
  // Icono dentro de un evento: mensaje, temporizador o error.
  function iconoEvento(ctx, x, y, disp, lleno) {
    if (disp === 'none') return;
    sobre(ctx, x, y, () => {
      if (disp === 'msg') sobreEnvelope(ctx, 12, lleno);
      else if (disp === 'timer') {
        ctx.lineWidth = 1.2; ctx.strokeStyle = C.tinta;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2 * Math.PI); ctx.moveTo(0, 0); ctx.lineTo(0, -4); ctx.moveTo(0, 0); ctx.lineTo(3, 1); ctx.stroke();
      } else if (disp === 'error') {
        ctx.lineWidth = 1.6; ctx.strokeStyle = C.tinta; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-1.5, -2); ctx.lineTo(1.5, 1); ctx.lineTo(5, -6); ctx.stroke();
      }
    });
  }
  function evento(ctx, x, y, pos, disp, relleno, anillo) {
    ctx.fillStyle = relleno || C.superficie; ctx.strokeStyle = C.tinta;
    ctx.lineWidth = pos === 'fin' ? 4 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    if (pos === 'inter') { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, 2 * Math.PI); ctx.stroke(); }
    iconoEvento(ctx, x, y, disp, pos === 'fin');
    if (anillo) { ctx.strokeStyle = anillo; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 17, 0, 2 * Math.PI); ctx.stroke(); }
  }
  // Marcador de tipo de tarea en la esquina superior izquierda.
  function iconoTarea(ctx, x, y, tt) {
    sobre(ctx, x, y, () => {
      ctx.lineWidth = 1.2; ctx.strokeStyle = C.tinta; ctx.fillStyle = C.tinta;
      if (tt === 'user') { ctx.beginPath(); ctx.arc(0, -2.5, 2.6, 0, 2 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 6, 5, Math.PI, 2 * Math.PI); ctx.stroke(); }
      else if (tt === 'service') {
        ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 2 * Math.PI); ctx.stroke();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(3.6 * Math.cos(a), 3.6 * Math.sin(a)); ctx.lineTo(5.6 * Math.cos(a), 5.6 * Math.sin(a)); ctx.stroke(); }
      } else if (tt === 'send') sobreEnvelope(ctx, 11, true);
      else if (tt === 'receive') sobreEnvelope(ctx, 11, false);
      else if (tt === 'manual') { ctx.beginPath(); ctx.rect(-4, 0, 8, 5); ctx.stroke(); for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, -4.5); ctx.stroke(); } }
      else if (tt === 'script') { ctx.beginPath(); ctx.rect(-4, -5, 8, 10); ctx.stroke(); for (const dy of [-2, 0.5, 3]) { ctx.beginPath(); ctx.moveTo(-2, dy); ctx.lineTo(2, dy); ctx.stroke(); } }
    });
  }
  function lineasDe(ctx, texto, ancho, max) {
    const pal = String(texto).split(' '), res = [];
    let cur = '';
    pal.forEach((p) => {
      const t = cur ? cur + ' ' + p : p;
      if (cur && ctx.measureText(t).width > ancho) { res.push(cur); cur = p; } else cur = t;
    });
    if (cur) res.push(cur);
    return res.slice(0, max);
  }

  // Ruta ortogonal entre dos nodos geométricos {x, y, w, h, n}.
  function ruta(A, B, vert) {
    const gw = A.n.tipo === 'gw';
    if (!vert) {
      if (Math.abs(A.y - B.y) < 2) return [[A.x + A.w / 2, A.y], [B.x - B.w / 2, B.y]];
      if (gw) { const s = Math.sign(B.y - A.y); return [[A.x, A.y + s * A.h / 2], [A.x, B.y], [B.x - B.w / 2, B.y]]; }
      const xm = (A.x + A.w / 2 + B.x - B.w / 2) / 2;
      return [[A.x + A.w / 2, A.y], [xm, A.y], [xm, B.y], [B.x - B.w / 2, B.y]];
    }
    if (Math.abs(A.x - B.x) < 2) return [[A.x, A.y + A.h / 2], [B.x, B.y - B.h / 2]];
    if (gw) { const s = Math.sign(B.x - A.x); return [[A.x + s * A.w / 2, A.y], [B.x, A.y], [B.x, B.y - B.h / 2]]; }
    const ym = (A.y + A.h / 2 + B.y - B.h / 2) / 2;
    return [[A.x, A.y + A.h / 2], [A.x, ym], [B.x, ym], [B.x, B.y - B.h / 2]];
  }

  // Dibuja un modelo: nodos { id, tipo: ev|tarea|sub|gw, pos, disp, tt, etiqueta, extra, c, k, estado, ficha },
  // aristas [de, a, etiqueta?, activa?] y cajas [{ id, etiqueta, ids, altura }] (subprocesos expandidos).
  function dibujarBpmn(lienzo, m, vert) {
    const { ctx, ancho: W, alto: H } = lienzo;
    const mx = vert ? 34 : 40, my = vert ? 30 : 36;
    const maxC = Math.max(1e-9, ...m.nodos.map((n) => n.c));
    const paso = ((vert ? H - 2 * my : W - 2 * mx)) / maxC;
    const wT = vert ? Math.min(124, (W - 2 * mx) * 0.6) : Math.max(62, Math.min(104, paso - 16));
    const geo = new Map();
    m.nodos.forEach((n) => {
      const a = n.c / maxC, b = n.k;
      const x = vert ? mx + b * (W - 2 * mx) : mx + a * (W - 2 * mx), y = vert ? my + a * (H - 2 * my) : my + b * (H - 2 * my);
      const w = n.tipo === 'ev' ? 26 : n.tipo === 'gw' ? 30 : wT, h = n.tipo === 'ev' ? 26 : n.tipo === 'gw' ? 30 : vert ? 40 : 46;
      geo.set(n.id, { x, y, w, h, n });
    });
    // Cajas de subprocesos expandidos (de dentro hacia fuera).
    const cajas = (m.cajas || []).map((cj) => {
      const rs = cj.ids.map((i) => geo.get(i));
      const pad = 12 + 9 * (cj.altura || 0);
      const x0 = Math.min(...rs.map((g) => g.x - g.w / 2)) - pad, x1 = Math.max(...rs.map((g) => g.x + g.w / 2)) + pad;
      const y0 = Math.min(...rs.map((g) => g.y - g.h / 2)) - pad - 12, y1 = Math.max(...rs.map((g) => g.y + g.h / 2)) + pad;
      return { cj, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
    cajas.forEach((b) => {
      ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(b.cj.etiqueta + (b.cj.extra ? ` · ${b.cj.extra}` : '') + '  [−]', b.x + 8, b.y + 5);
    });
    // Secuencias.
    m.aristas.forEach(([de, a, etq, activa]) => {
      const A = geo.get(de), B = geo.get(a);
      const pts = ruta(A, B, vert);
      ctx.strokeStyle = activa ? C.tinta : C.eje; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = activa ? 2.5 : 1.5;
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
      const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2], ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4)); ctx.lineTo(x2 - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
      if (etq) {
        const lx = vert ? (pts[0][0] + pts[1][0]) / 2 : pts[0][0] + 15, ly = vert ? pts[0][1] - 8 : (pts[0][1] + pts[1][1]) / 2;
        ctx.font = VIZ.fuente(10, 600); const tw = ctx.measureText(etq).width + 6;
        ctx.fillStyle = C.superficie; ctx.fillRect(lx - tw / 2, ly - 7, tw, 14);
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(etq, lx, ly);
      }
    });
    // Nodos.
    ctx.font = VIZ.fuente(10, 500);
    m.nodos.forEach((n) => {
      const g = geo.get(n.id), hecho = n.estado === 'hecho' || n.estado === 'actual';
      const relleno = hecho ? VIZ.alfa(C.s1, 0.2) : C.superficie, anillo = n.estado === 'actual' ? C.s2 : null;
      if (n.tipo === 'ev') {
        evento(ctx, g.x, g.y, n.pos, n.disp, hecho ? VIZ.alfa(C.s1, 0.2) : C.superficie, anillo);
        if (n.etiqueta) {
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.textBaseline = 'top';
          const ls = lineasDe(ctx, n.etiqueta, vert ? Math.max(60, W - g.x - 36) : 92, 2);
          ctx.textAlign = vert ? 'left' : 'center';
          ls.forEach((t, i) => ctx.fillText(t, vert ? g.x + 24 : g.x, vert ? g.y - 6 - (ls.length - 1) * 6 + i * 12 : g.y + 20 + i * 12));
          ctx.textBaseline = 'middle';
        }
      } else if (n.tipo === 'gw') {
        ctx.fillStyle = relleno; ctx.strokeStyle = anillo || C.tinta; ctx.lineWidth = anillo ? 3 : 1.5;
        ctx.beginPath(); ctx.moveTo(g.x, g.y - 15); ctx.lineTo(g.x + 15, g.y); ctx.lineTo(g.x, g.y + 15); ctx.lineTo(g.x - 15, g.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(g.x - 5, g.y - 5); ctx.lineTo(g.x + 5, g.y + 5); ctx.moveTo(g.x + 5, g.y - 5); ctx.lineTo(g.x - 5, g.y + 5); ctx.stroke();
        if (n.etiqueta) { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = vert ? 'left' : 'center'; ctx.textBaseline = 'top'; ctx.fillText(n.etiqueta, vert ? g.x + 22 : g.x, vert ? g.y - 5 : g.y + 19); ctx.textBaseline = 'middle'; }
      } else {
        ctx.fillStyle = relleno; ctx.strokeStyle = anillo || C.tinta; ctx.lineWidth = anillo ? 3 : n.tipo === 'sub' ? 2 : 1.5;
        ctx.beginPath(); ctx.roundRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, 8); ctx.fill(); ctx.stroke();
        if (n.tt) iconoTarea(ctx, g.x - g.w / 2 + 11, g.y - g.h / 2 + 11, n.tt);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const ls = lineasDe(ctx, n.etiqueta, g.w - 14, 2), dy = n.tipo === 'sub' ? -5 : 2;
        ls.forEach((t, i) => ctx.fillText(t, g.x, g.y + dy + (i - (ls.length - 1) / 2) * 12));
        if (n.tipo === 'sub') {
          ctx.lineWidth = 1.2; ctx.strokeStyle = C.tinta; ctx.beginPath(); ctx.rect(g.x - 6, g.y + g.h / 2 - 15, 12, 12); ctx.moveTo(g.x - 3, g.y + g.h / 2 - 9); ctx.lineTo(g.x + 3, g.y + g.h / 2 - 9); ctx.moveTo(g.x, g.y + g.h / 2 - 12); ctx.lineTo(g.x, g.y + g.h / 2 - 6); ctx.stroke();
          if (n.extra) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9, 500); ctx.textAlign = 'left'; ctx.fillText(n.extra, g.x + 11, g.y + g.h / 2 - 9); }
        }
      }
      if (n.ficha) {
        const yy = g.y - g.h / 2 - 9;
        ctx.fillStyle = C.s2; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(g.x, yy, 6, 0, 2 * Math.PI); ctx.stroke(); ctx.fill();
      }
    });
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    return { geo, cajas };
  }
  const pasaAHoras = (h) => `${VIZ.fmt(h, 3)} h`;

  /* ---------- Fig. 1: armar eventos y tareas ---------- */

  const OP_INICIO = [['none', 'Sin disparador (a mano)'], ['msg', 'Mensaje recibido'], ['timer', 'Temporizador (fecha programada)']];
  const OP_TAREA = [['user', 'De usuario'], ['service', 'De servicio'], ['manual', 'Manual'], ['send', 'De envío'], ['receive', 'De recepción'], ['script', 'De script']];
  const OP_INTER = [['omitir', 'Sin evento intermedio'], ['msg', 'Esperar un mensaje'], ['timer', 'Esperar un plazo']];
  const OP_FIN = [['none', 'Fin normal'], ['msg', 'Fin con mensaje'], ['error', 'Fin con error']];
  const FRASE_INICIO = { none: 'una persona crea el caso a mano', msg: 'llega un mensaje (por ejemplo, un pedido)', timer: 'llega la fecha programada (por ejemplo, cada lunes)' };
  const FRASE_TAREA = { user: 'una persona hace la tarea en una pantalla', service: 'un sistema ejecuta la tarea llamando a un servicio', manual: 'alguien hace la tarea fuera de cualquier sistema', send: 'el proceso envía un mensaje a otro participante', receive: 'el proceso se detiene hasta recibir un mensaje', script: 'el motor de procesos ejecuta un script, sin llamar a nadie' };
  const QUIEN = { user: 'una persona', service: 'otro sistema', manual: 'una persona, sin sistema', send: 'el proceso (envía)', receive: 'el proceso (espera)', script: 'el motor de procesos' };
  const FRASE_INTER = { omitir: '', msg: ', luego la ficha espera un mensaje', timer: ', luego la ficha espera a que venza un plazo' };
  const FRASE_FIN = { none: 'termina el caso', msg: 'termina el caso enviando un mensaje', error: 'termina el caso con un error que otro proceso debe tratar' };

  function montarConstructor(cuerpo) {
    const est = { ini: 'msg', tt: 'user', inter: 'timer', fin: 'none', sub: false };
    let geo = null, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    const sel = {};
    const mk = (clave, etiqueta, ops) => { sel[clave] = ctl.selector({ etiqueta, opciones: ops, valor: est[clave], alCambiar: (v) => { est[clave] = v; dibujar(); } }); };
    mk('ini', 'Evento de inicio', OP_INICIO);
    mk('tt', 'Tipo de tarea', OP_TAREA);
    mk('inter', 'Evento intermedio', OP_INTER);
    mk('fin', 'Evento de fin', OP_FIN);
    ctl.casilla({ etiqueta: 'Tarea como subproceso colapsado', valor: false, alCambiar: (v) => { est.sub = v; dibujar(); } });
    ctl.boton('Combinación al azar', () => {
      const r = VIZ.semilla(Date.now() % 100000 + 17);
      const el = (ops) => ops[Math.floor(r() * ops.length)][0];
      est.ini = el(OP_INICIO); est.tt = el(OP_TAREA); est.inter = el(OP_INTER); est.fin = el(OP_FIN);
      dibujar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 4 * 74 + 60 : 150) });
    lienzo.canvas.style.cursor = 'pointer';
    cuerpo.dataset.sinLeyenda = 'diagrama de un solo color: el borde del evento (fino, doble, grueso) y el símbolo interior indican su tipo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie los selectores o haga clic en un elemento del diagrama para recorrer sus variantes. Borde fino = inicio, borde doble = intermedio, borde grueso = fin; el símbolo interior dice qué lo dispara o qué produce.');

    function dibujar() {
      const vert = lienzo.ancho < 560;
      const nodos = [
        { id: 'ini', tipo: 'ev', pos: 'inicio', disp: est.ini, etiqueta: { none: 'Inicio', msg: 'Pedido recibido', timer: 'Cada lunes' }[est.ini], c: 0, k: 0.5 },
        est.sub ? { id: 'tt', tipo: 'sub', etiqueta: 'Tramitar pedido', c: 1, k: 0.5 } : { id: 'tt', tipo: 'tarea', tt: est.tt, etiqueta: OP_TAREA.find((o) => o[0] === est.tt)[1] === 'Manual' ? 'Tarea manual' : 'Tarea ' + OP_TAREA.find((o) => o[0] === est.tt)[1].toLowerCase(), c: 1, k: 0.5 },
      ];
      let c = 2;
      if (est.inter !== 'omitir') nodos.push({ id: 'inter', tipo: 'ev', pos: 'inter', disp: est.inter, etiqueta: est.inter === 'msg' ? 'Llega la respuesta' : 'Pasan 2 días', c: c++, k: 0.5 });
      nodos.push({ id: 'fin', tipo: 'ev', pos: 'fin', disp: est.fin, etiqueta: { none: 'Fin', msg: 'Aviso enviado', error: 'Falló' }[est.fin], c, k: 0.5 });
      const aristas = nodos.slice(1).map((n, i) => [nodos[i].id, n.id]);
      lienzo.limpiar();
      geo = dibujarBpmn(lienzo, { nodos, aristas }, vert).geo;
      Object.keys(sel).forEach((k) => { sel[k].valor = est[k]; });
      const t = est.sub ? 'subproceso colapsado' : OP_TAREA.find((o) => o[0] === est.tt)[1].toLowerCase();
      mensaje = `Cuando ${FRASE_INICIO[est.ini]}, ` + (est.sub ? 'se ejecuta un subproceso que esconde varias tareas' : FRASE_TAREA[est.tt]) + FRASE_INTER[est.inter] + `; al final ${FRASE_FIN[est.fin]}.`;
      registro.textContent = mensaje;
      lectura.set([
        ['qué dispara el proceso', OP_INICIO.find((o) => o[0] === est.ini)[1].toLowerCase()],
        ['tipo de trabajo', est.sub ? 'subproceso (varias tareas)' : `tarea ${t}`],
        ['quién lo hace', est.sub ? 'varios participantes' : QUIEN[est.tt]],
        ['la ficha espera un evento', est.inter === 'omitir' ? 'no' : est.inter === 'msg' ? 'sí, un mensaje' : 'sí, un plazo'],
        ['cómo termina', OP_FIN.find((o) => o[0] === est.fin)[1].toLowerCase()],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      for (const g of geo.values()) {
        if (Math.abs(x - g.x) > g.w / 2 + 3 || Math.abs(y - g.y) > g.h / 2 + 3) continue;
        const id = g.n.id;
        const ciclo = (ops, v) => ops[(ops.findIndex((o) => o[0] === v) + 1) % ops.length][0];
        if (id === 'ini') est.ini = ciclo(OP_INICIO, est.ini);
        else if (id === 'tt') { if (est.sub) est.sub = false; else est.tt = ciclo(OP_TAREA, est.tt); }
        else if (id === 'inter') est.inter = ciclo(OP_INTER, est.inter);
        else if (id === 'fin') est.fin = ciclo(OP_FIN, est.fin);
        dibujar();
        return;
      }
    });
    dibujar();
  }

  /* ---------- Fig. 2: una ficha recorre el diagrama ---------- */

  const DUR_MIN = { val: 1, cob: 2, prep: 360, enc: 1, fail: 1 };
  const FLUJO = {
    nodos: [
      { id: 's', tipo: 'ev', pos: 'inicio', disp: 'msg', etiqueta: 'Pedido recibido', c: 0, k: 0.3, ayuda: 'evento de inicio de mensaje', texto: 'Evento de inicio de mensaje: el proceso nace cuando llega un pedido; sin mensaje no hay caso.' },
      { id: 'val', tipo: 'tarea', tt: 'service', etiqueta: 'Validar pedido', c: 1, k: 0.3, ayuda: 'tarea de servicio', texto: 'Tarea de servicio: un sistema valida datos y stock, sin intervención humana.' },
      { id: 'cob', tipo: 'tarea', tt: 'service', etiqueta: 'Cobrar con tarjeta', c: 2, k: 0.3, ayuda: 'tarea de servicio', texto: 'Tarea de servicio: llama a la pasarela de pago y recibe su respuesta.' },
      { id: 'x', tipo: 'gw', etiqueta: '¿Pago?', c: 3, k: 0.3, ayuda: 'compuerta exclusiva', texto: 'Compuerta exclusiva: la ficha sigue solo por una salida, según el resultado del pago.' },
      { id: 'prep', tipo: 'sub', etiqueta: 'Preparar y despachar', c: 4, k: 0.3, ayuda: 'subproceso colapsado', texto: 'Subproceso colapsado: un solo rectángulo con + esconde varias tareas (recoger, empacar, despachar).' },
      { id: 'esp', tipo: 'ev', pos: 'inter', disp: 'timer', etiqueta: 'Esperar plazo de devolución', c: 5, k: 0.3, ayuda: 'evento intermedio de temporizador', texto: 'Evento intermedio de temporizador: la ficha queda detenida hasta que vence el plazo de devolución.' },
      { id: 'enc', tipo: 'tarea', tt: 'send', etiqueta: 'Enviar encuesta', c: 6, k: 0.3, ayuda: 'tarea de envío', texto: 'Tarea de envío: manda un mensaje al cliente y sigue sin esperar respuesta.' },
      { id: 'fin1', tipo: 'ev', pos: 'fin', disp: 'none', etiqueta: 'Pedido completado', c: 7, k: 0.3, ayuda: 'evento de fin', texto: 'Evento de fin: el caso termina y no queda ninguna ficha en el diagrama.' },
      { id: 'fail', tipo: 'tarea', tt: 'send', etiqueta: 'Avisar rechazo', c: 4, k: 0.85, ayuda: 'tarea de envío', texto: 'Tarea de envío: avisa al cliente que su pago fue rechazado.' },
      { id: 'fin2', tipo: 'ev', pos: 'fin', disp: 'error', etiqueta: 'Pedido cancelado', c: 5, k: 0.85, ayuda: 'evento de fin de error', texto: 'Evento de fin de error: el caso termina sin cumplir su objetivo y deja constancia del error.' },
    ],
    aristas: [['s', 'val'], ['val', 'cob'], ['cob', 'x'], ['x', 'prep', 'sí'], ['x', 'fail', 'no'], ['prep', 'esp'], ['esp', 'enc'], ['enc', 'fin1'], ['fail', 'fin2']],
  };
  const CAMINOS = { ok: ['s', 'val', 'cob', 'x', 'prep', 'esp', 'enc', 'fin1'], rechazo: ['s', 'val', 'cob', 'x', 'fail', 'fin2'] };

  function montarRecorrido(cuerpo) {
    let escenario = 'ok', plazo = 2, visitados = [], actual = null, tiempo = 0, mensaje = '', alto = 250, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Resultado del pago', opciones: [['ok', 'Pago aprobado'], ['rechazo', 'Pago rechazado']], valor: escenario, alCambiar: (v) => { escenario = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Plazo del temporizador', min: 1, max: 10, valor: plazo, formato: (v) => `${v} d`, alCambiar: (v) => { plazo = v; if (visitados.length) { recalcular(); } dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'ficha: elemento que se ejecuta', forma: 'punto' },
      { color: VIZ.alfa(C.s1, 0.3), texto: 'ya recorrido' },
      { color: C.superficie, borde: C.tinta, texto: 'por recorrer' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance con «Un paso» y lea qué hace cada elemento. Cambie el resultado del pago para recorrer la otra rama y mueva el plazo del temporizador: es el único elemento cuyo tiempo depende de una espera, no de un trabajo.');

    const durDe = (id) => (id === 'esp' ? plazo * 1440 : DUR_MIN[id] || 0);
    function recalcular() { tiempo = visitados.reduce((s, i) => s + durDe(i), 0); }
    function iniciar() {
      visitados = []; actual = null; tiempo = 0; mensaje = 'Pulse «Un paso»: una ficha entra por el evento de inicio.';
      return (function* () {
        for (const id of CAMINOS[escenario]) {
          visitados.push(id); actual = id; recalcular();
          mensaje = FLUJO.nodos.find((n) => n.id === id).texto;
          yield;
        }
      })();
    }
    function dibujar() {
      const vert = lienzo.ancho < 620;
      const nuevo = vert ? 7 * 62 + 70 : 250;
      if (nuevo !== alto) { alto = nuevo; lienzo.ajustar(true); return; }
      const vis = new Set(visitados);
      const nodos = FLUJO.nodos.map((n) => ({ ...n, estado: n.id === actual ? 'actual' : vis.has(n.id) ? 'hecho' : null, ficha: n.id === actual, extra: n.id === 'prep' ? '6 h' : null, etiqueta: n.id === 'esp' ? `Esperar ${plazo} d` : n.etiqueta }));
      const aristas = FLUJO.aristas.map(([a, b, e]) => [a, b, e, vis.has(a) && vis.has(b)]);
      lienzo.limpiar();
      geo = dibujarBpmn(lienzo, { nodos, aristas }, vert).geo;
      const cam = CAMINOS[escenario], n = actual ? FLUJO.nodos.find((q) => q.id === actual) : null;
      registro.textContent = mensaje;
      lectura.set([
        ['elemento actual', n ? n.etiqueta : '—'],
        ['tipo', n ? n.ayuda : '—'],
        ['tiempo transcurrido', P.dur(tiempo)],
        ['elementos recorridos', `${visitados.length} de ${cam.length}`],
        ['final del caso', visitados.includes('fin1') ? 'completado' : visitados.includes('fin2') ? 'cancelado' : 'en curso'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      for (const g of geo.values()) {
        if (Math.abs(x - g.x) <= g.w / 2 + 3 && Math.abs(y - g.y) <= g.h / 2 + 3) {
          const d = durDe(g.n.id);
          return tip.mostrar(x, y, `<b>${g.n.etiqueta}</b><br>${g.n.ayuda}` + (d ? `<br>duración: <b>${P.dur(d)}</b>` : ''));
        }
      }
      tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 3: subprocesos colapsables ---------- */

  const tarea = (id, tt, etiqueta, dur) => ({ id, tipo: 'tarea', tt, etiqueta, dur });
  const ARBOL = [
    { id: 's', tipo: 'ev', pos: 'inicio', disp: 'msg', etiqueta: 'Orden recibida' },
    tarea('reg', 'user', 'Registrar orden', 0.2),
    { id: 'prep', tipo: 'sub', etiqueta: 'Preparar y despachar', hijos: [
      tarea('rec', 'manual', 'Recoger productos', 1),
      { id: 'emp', tipo: 'sub', etiqueta: 'Empacar', hijos: [tarea('ver', 'user', 'Verificar productos', 0.3), tarea('emb', 'manual', 'Embalar', 0.5), tarea('eti', 'service', 'Imprimir etiqueta', 0.1)] },
      tarea('tra', 'manual', 'Entregar al transportista', 0.5),
    ] },
    tarea('conf', 'receive', 'Confirmar entrega', 8),
    { id: 'e', tipo: 'ev', pos: 'fin', disp: 'none', etiqueta: 'Orden cerrada' },
  ];
  const contar = (items) => items.reduce((s, it) => s + 1 + (it.hijos ? contar(it.hijos) : 0), 0);
  const altura = (it) => (it.hijos ? 1 + Math.max(...it.hijos.map(altura)) : 0);
  const hojas = (it) => (it.hijos ? it.hijos.reduce((s, h) => s + hojas(h), 0) : it.tipo === 'tarea' ? 1 : 0);

  function montarSubprocesos(cuerpo) {
    const abiertos = new Set(), dur = { rec: 1, emb: 0.5 };
    let alto = 200, geo = null, cajas = [], mensaje = 'Haga clic en un subproceso (rectángulo con +) para expandirlo.';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Duración de «Embalar»', min: 0.1, max: 4, paso: 0.1, valor: dur.emb, formato: (v) => `${VIZ.fmt(v)} h`, alCambiar: (v) => { dur.emb = v; mensaje = `«Embalar» dura ${VIZ.fmt(v)} h: el total del subproceso cambia aunque esté colapsado.`; dibujar(); } });
    ctl.rango({ etiqueta: 'Duración de «Recoger productos»', min: 0.2, max: 4, paso: 0.1, valor: dur.rec, formato: (v) => `${VIZ.fmt(v)} h`, alCambiar: (v) => { dur.rec = v; mensaje = `«Recoger productos» dura ${VIZ.fmt(v)} h.`; dibujar(); } });
    ctl.boton('Expandir todo', () => { abiertos.add('prep'); abiertos.add('emp'); mensaje = 'Todos los subprocesos están expandidos: se ven todas las tareas.'; dibujar(); }, { primario: true });
    ctl.boton('Colapsar todo', () => { abiertos.clear(); mensaje = 'Todo colapsado: el diagrama vuelve a su vista general.'; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    lienzo.canvas.style.cursor = 'pointer';
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'diagrama de un solo color: el rectángulo con + es un subproceso colapsado y la caja con [−] uno expandido';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un rectángulo con + para expandirlo, y en una caja expandida para volver a colapsarla. Cambie las duraciones: el subproceso colapsado muestra siempre la suma de sus tareas.');

    const durDe = (it) => (it.hijos ? it.hijos.reduce((s, h) => s + durDe(h), 0) : it.tipo === 'tarea' ? (dur[it.id] !== undefined ? dur[it.id] : it.dur) : 0);
    // Aplana la secuencia: un subproceso abierto se reemplaza por sus hijos dentro de una caja.
    function aplanar(items, e) {
      let prev = null, primero = null;
      const ids = [];
      items.forEach((it) => {
        let ent, sal;
        if (it.hijos && abiertos.has(it.id)) {
          const ini = e.nodos.length;
          e.c += 0.5;
          const r = aplanar(it.hijos, e);
          e.c += 0.5;
          const mis = e.nodos.slice(ini).map((n) => n.id);
          e.cajas.push({ id: it.id, etiqueta: it.etiqueta, ids: mis, altura: altura(it) - 1, extra: pasaAHoras(durDe(it)) });
          ent = r.primero; sal = r.ultimo; ids.push(...mis);
        } else {
          const n = { id: it.id, tipo: it.tipo, pos: it.pos, disp: it.disp, tt: it.tt, etiqueta: it.etiqueta, c: e.c++, k: 0.5 };
          if (it.hijos) n.extra = pasaAHoras(durDe(it));
          e.nodos.push(n); ent = sal = it.id; ids.push(it.id);
        }
        if (prev) e.aristas.push([prev, ent]);
        prev = sal; if (!primero) primero = ent;
      });
      return { primero, ultimo: prev, ids };
    }
    function dibujar() {
      const e = { nodos: [], aristas: [], cajas: [], c: 0 };
      aplanar(ARBOL, e);
      const maxC = Math.max(...e.nodos.map((n) => n.c));
      const vert = (lienzo.ancho - 80) / maxC < 80;
      const nuevo = vert ? Math.round(maxC * 58 + 110) : 170 + 20 * Math.max(0, ...e.cajas.map((q) => q.altura + 1));
      if (nuevo !== alto) { alto = nuevo; lienzo.ajustar(true); return; }
      lienzo.limpiar();
      const r = dibujarBpmn(lienzo, e, vert);
      geo = r.geo; cajas = r.cajas;
      const total = durDe({ hijos: ARBOL }), sub = durDe(ARBOL[2]);
      const visibles = e.nodos.length, todos = contar(ARBOL) - ARBOL.filter((i) => i.hijos).length;
      const nivel = e.cajas.length ? Math.max(...e.cajas.map((q) => q.altura + 1)) : 0;
      registro.textContent = mensaje;
      lectura.set([
        ['tiempo total del caso', pasaAHoras(total)],
        ['«Preparar y despachar»', `${pasaAHoras(sub)} (${VIZ.fmt((sub / total) * 100, 3)} % del total)`],
        ['elementos visibles', `${visibles + e.cajas.length} de ${todos + 2}`],
        ['nivel de detalle', `${nivel} (0 = todo colapsado)`],
        ['tareas que ve hoy', `${e.nodos.filter((n) => n.tipo === 'tarea').length} de ${ARBOL.reduce((s, it) => s + hojas(it), 0)}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const alMover = (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      for (const g of geo.values()) {
        if (Math.abs(x - g.x) <= g.w / 2 + 3 && Math.abs(y - g.y) <= g.h / 2 + 3 && (g.n.tipo === 'tarea' || g.n.tipo === 'sub')) {
          const it = buscar(ARBOL, g.n.id);
          return tip.mostrar(x, y, `<b>${g.n.etiqueta}</b><br>${g.n.tipo === 'sub' ? `subproceso con ${hojas(it)} tareas` : 'tarea'}<br>duración: <b>${pasaAHoras(durDe(it))}</b>`);
        }
      }
      tip.ocultar();
    };
    function buscar(items, id) { for (const it of items) { if (it.id === id) return it; if (it.hijos) { const r = buscar(it.hijos, id); if (r) return r; } } return null; }
    lienzo.canvas.addEventListener('pointermove', alMover);
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      for (const g of geo.values()) {
        if (g.n.tipo === 'sub' && Math.abs(x - g.x) <= g.w / 2 && Math.abs(y - g.y) <= g.h / 2) {
          abiertos.add(g.n.id); mensaje = `Se expande «${g.n.etiqueta}»: ahora se ven sus ${buscar(ARBOL, g.n.id).hijos.length} elementos.`; dibujar(); return;
        }
      }
      // Caja expandida: la más pequeña que contiene el clic.
      const dentro = cajas.filter((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
      if (dentro) { abiertos.delete(dentro.cj.id); if (dentro.cj.id === 'prep') abiertos.delete('emp'); mensaje = `Se colapsa «${dentro.cj.etiqueta}»: vuelve a ser un solo rectángulo.`; dibujar(); }
    });
    dibujar();
  }

  VIZ.registrarTema('bpmn-events-tasks', {
    intro: String.raw`
      <p>En <strong>BPMN</strong>, un proceso se arma con tres piezas básicas. Los <strong>eventos</strong> (círculos) marcan que algo ocurre: un proceso <em>comienza</em> (borde fino),
      <em>espera</em> algo en el camino (borde doble) o <em>termina</em> (borde grueso); un símbolo interior dice qué lo dispara: un mensaje, un temporizador, un error.
      Las <strong>tareas</strong> (rectángulos redondeados) son el trabajo, y su ícono dice quién lo hace: una persona, un sistema, un envío de mensaje.</p>
      <p>Cuando un tramo del proceso es complejo, se agrupa en un <strong>subproceso</strong>: colapsado es un solo rectángulo con un +, expandido muestra su interior. Así un mismo diagrama
      sirve a la gerencia (vista general) y a quien lo ejecuta (detalle). Las compuertas, que deciden por dónde sigue la ficha, se estudian en <a href="tema.html?id=bpmn-gateways">compuertas BPMN</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Arme un inicio, una tarea y un fin',
        descripcion: 'Elija el disparador del inicio, el tipo de tarea, un evento intermedio y el tipo de fin, o haga clic en cada elemento: el diagrama cambia y la frase explica qué significa. Pruebe «Temporizador» como inicio y «Fin con error».',
        montar: montarConstructor,
      },
      {
        titulo: 'Una ficha recorre el pedido',
        descripcion: 'Avance paso a paso y lea qué hace cada tipo de elemento. Cambie a «Pago rechazado» para ver la otra rama, y mueva el plazo del temporizador: el tiempo transcurrido casi solo depende de la espera.',
        montar: montarRecorrido,
      },
      {
        titulo: 'Subprocesos colapsados y expandidos',
        descripcion: 'Expanda «Preparar y despachar» y luego «Empacar»: aparecen las tareas internas dentro de cajas. Cambie la duración de «Embalar» y compruebe que el subproceso colapsado la incluye.',
        montar: montarSubprocesos,
      },
    ],
    teoria: String.raw`
      <h2>Eventos</h2>
      <p>Un evento es algo que <em>sucede</em> durante el proceso. Según su posición en el flujo hay tres familias, y según su disparador cambia el símbolo interior:</p>
      <table>
        <tr><th>Posición</th><th>Borde</th><th>Qué hace con la ficha</th><th>Disparadores usuales</th></tr>
        <tr><td>Inicio</td><td>fino</td><td>crea la ficha (un caso)</td><td>sin tipo, mensaje, temporizador</td></tr>
        <tr><td>Intermedio</td><td>doble</td><td>la retiene hasta que ocurre algo, o emite algo</td><td>mensaje, temporizador, error</td></tr>
        <tr><td>Fin</td><td>grueso</td><td>consume la ficha y termina el caso</td><td>sin tipo, mensaje, error</td></tr>
      </table>
      <p>No todas las combinaciones existen: un evento de fin con temporizador no tiene sentido, porque nada puede «esperar» después de terminar. Un evento intermedio de temporizador retiene la ficha un tiempo \(\Delta\), de modo que el tiempo de ciclo de un caso es</p>
      \[ T = \sum_{i \in \text{tareas}} d_i + \sum_{j \in \text{temporizadores}} \Delta_j + \sum_{k \in \text{mensajes}} w_k, \]
      <p>donde \(d_i\) es el tiempo de trabajo, \(\Delta_j\) los plazos fijos y \(w_k\) la espera de cada mensaje externo.</p>
      <h2>Tareas y subprocesos</h2>
      <table>
        <tr><th>Tipo</th><th>Quién la ejecuta</th><th>Ejemplo</th></tr>
        <tr><td>Usuario</td><td>una persona usando un sistema</td><td>Registrar orden</td></tr>
        <tr><td>Servicio</td><td>otro sistema, vía una llamada</td><td>Cobrar con tarjeta</td></tr>
        <tr><td>Manual</td><td>una persona, sin sistema</td><td>Embalar</td></tr>
        <tr><td>Envío / recepción</td><td>el proceso envía o espera un mensaje</td><td>Enviar encuesta</td></tr>
        <tr><td>Script</td><td>el motor de procesos, internamente</td><td>Calcular el descuento</td></tr>
      </table>
      <p>Un <em>subproceso</em> encapsula una secuencia completa con su propio inicio y fin. Su duración es la suma de sus partes cuando el flujo es secuencial:
      \(d_{\text{sub}} = \sum_{i \in \text{hijos}} d_i\). En el ejemplo, con «Recoger productos» de 1 h y «Embalar» de 0,5 h:</p>
      \[ d_{\text{Empacar}} = 0{,}3 + 0{,}5 + 0{,}1 = 0{,}9\ \text{h}, \qquad d_{\text{Preparar}} = 1 + 0{,}9 + 0{,}5 = 2{,}4\ \text{h}, \qquad T = 0{,}2 + 2{,}4 + 8 = 10{,}6\ \text{h}. \]
      <div class="recuadro"><p><strong>Buena práctica.</strong> Un diagrama debería caber en una página: sobre unas 7 a 12 tareas, agrupe en subprocesos. El subproceso debe tener un nombre que describa un resultado («Preparar y despachar»), no una función («Bodega»).</p></div>
      <h2>Ejecución con fichas</h2>
      <p>La semántica de BPMN se explica con <em>fichas</em> que viajan por las secuencias: el evento de inicio crea una, cada tarea la consume y emite otra al terminar, la compuerta decide a dónde va y el evento de fin la consume. Un caso termina bien cuando no quedan fichas en el diagrama.</p>
      <h2>Conexiones</h2>
      <p>Las decisiones y los caminos en paralelo se expresan con <a href="tema.html?id=bpmn-gateways">compuertas</a>; cuando intervienen varios participantes se agregan <a href="tema.html?id=bpmn-pools-lanes">piscinas, carriles y flujos de mensaje</a>.
      El mismo modelo se puede traducir a una <a href="tema.html?id=petri-nets">red de Petri</a> y analizar con <a href="tema.html?id=soundness">soundness</a>; para estimar tiempos y colas con recursos limitados, véase
      <a href="tema.html?id=process-simulation">simulación de procesos</a>. Los niveles de detalle se relacionan con los <a href="tema.html?id=process-maps">mapas de procesos</a>.</p>`,
  });
})();
