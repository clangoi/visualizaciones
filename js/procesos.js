/* Minería de procesos (VIZ.proc): simulación de registros de eventos desde árboles de procesos,
   variantes, grafos de sucesión directa, matriz de huellas, algoritmo Alfa, redes de Petri con
   reproducción de fichas, disposición por capas y dibujo de redes y grafos de procesos. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = {};
  VIZ.proc = P;

  /* ---------- Árboles de procesos y simulación de registros ---------- */

  // Constructores: act(nombre, {dur, rol, costo}), sec, xor(pesos), y, bucle(hacer, rehacer, p).
  const act = (a, o = {}) => ({ t: 'act', a, dur: o.dur || 10, rol: o.rol || null, costo: o.costo || 0, espera: o.espera === undefined ? null : o.espera });
  const tau = () => ({ t: 'act', a: null });
  const sec = (...h) => ({ t: 'seq', h });
  const xor = (h, p) => ({ t: 'xor', h, p: p || h.map(() => 1) });
  const y = (...h) => ({ t: 'and', h });
  const bucle = (hacer, rehacer, p = 0.3) => ({ t: 'loop', h: [hacer, rehacer], p });
  Object.assign(P, { act, tau, sec, xor, y, bucle });

  // Roles → personas (para la perspectiva organizacional).
  P.personas = {
    ventas: ['Ana', 'Bruno'],
    bodega: ['Carla', 'Diego', 'Elisa'],
    finanzas: ['Fabio', 'Gala'],
    soporte: ['Hugo', 'Irene'],
    gerencia: ['Jaime'],
  };

  // Procesos de ejemplo. Se recorren con `P.simular`.
  P.procesos = {
    pedidos: {
      nombre: 'Gestión de pedidos',
      arbol: sec(
        act('Registrar pedido', { dur: 6, rol: 'ventas', costo: 20 }),
        xor([act('Verificar stock', { dur: 8, rol: 'bodega', costo: 15 }), sec(act('Verificar stock', { dur: 8, rol: 'bodega', costo: 15 }), act('Reponer stock', { dur: 25, rol: 'bodega', costo: 60 }))], [0.75, 0.25]),
        y(act('Preparar envío', { dur: 18, rol: 'bodega', costo: 40 }), act('Emitir factura', { dur: 9, rol: 'finanzas', costo: 25 })),
        xor([act('Cobrar al contado', { dur: 5, rol: 'finanzas', costo: 10 }), sec(act('Enviar recordatorio', { dur: 4, rol: 'finanzas', costo: 5 }), act('Cobrar al contado', { dur: 5, rol: 'finanzas', costo: 10 }))], [0.7, 0.3]),
        act('Despachar', { dur: 12, rol: 'bodega', costo: 30 }),
      ),
    },
    reclamos: {
      nombre: 'Atención de reclamos',
      arbol: sec(
        act('Recibir reclamo', { dur: 5, rol: 'soporte', costo: 8 }),
        act('Clasificar', { dur: 7, rol: 'soporte', costo: 10 }),
        bucle(act('Investigar', { dur: 30, rol: 'soporte', costo: 45 }), act('Pedir información', { dur: 10, rol: 'ventas', costo: 12 }), 0.35),
        xor([act('Aprobar compensación', { dur: 12, rol: 'gerencia', costo: 90 }), act('Rechazar reclamo', { dur: 6, rol: 'soporte', costo: 10 })], [0.45, 0.55]),
        act('Cerrar caso', { dur: 3, rol: 'soporte', costo: 4 }),
      ),
    },
  };

  const exp = (rnd, media) => -Math.log(1 - rnd()) * media;
  const gauss = (rnd, m, sd) => { const u = Math.max(1e-9, rnd()), v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // Lista de actividades (instancias) de una ejecución del árbol, con entrelazado aleatorio en los AND.
  function ejecutar(n, rnd, salida) {
    if (n.t === 'act') { if (n.a) salida.push(n); return; }
    if (n.t === 'seq') { n.h.forEach((h) => ejecutar(h, rnd, salida)); return; }
    if (n.t === 'xor') {
      const tot = n.p.reduce((s, v) => s + v, 0);
      let u = rnd() * tot, k = 0;
      while (k < n.h.length - 1 && u >= n.p[k]) { u -= n.p[k]; k++; }
      ejecutar(n.h[k], rnd, salida);
      return;
    }
    if (n.t === 'and') {
      const ramas = n.h.map((h) => { const s = []; ejecutar(h, rnd, s); return s; });
      const idx = ramas.map(() => 0);
      for (let rest = ramas.reduce((s, r) => s + r.length, 0); rest > 0; rest--) {
        const vivos = ramas.map((r, i) => (idx[i] < r.length ? i : -1)).filter((i) => i >= 0);
        const i = vivos[Math.floor(rnd() * vivos.length)];
        salida.push(ramas[i][idx[i]++]);
      }
      return;
    }
    if (n.t === 'loop') {
      ejecutar(n.h[0], rnd, salida);
      while (rnd() < n.p) { ejecutar(n.h[1], rnd, salida); ejecutar(n.h[0], rnd, salida); }
    }
  }

  // Registro: [{ id, eventos: [{ act, ini, fin, recurso, costo }] }] con tiempos en minutos.
  // opciones: { espera (media de espera entre actividades), ruido (prob. de alterar una traza), llegada }.
  P.simular = function (arbol, n, semilla = 1, o = {}) {
    const rnd = VIZ.semilla(semilla);
    const espera = o.espera === undefined ? 12 : o.espera;
    const llegada = o.llegada || 25;
    let reloj = 0;
    const log = [];
    for (let i = 0; i < n; i++) {
      reloj += exp(rnd, llegada);
      const lista = [];
      ejecutar(arbol, rnd, lista);
      if (o.ruido && rnd() < o.ruido && lista.length > 2) {
        const k = Math.floor(rnd() * (lista.length - 1));
        const quitar = rnd() < 0.5;
        if (quitar) lista.splice(k, 1); else [lista[k], lista[k + 1]] = [lista[k + 1], lista[k]];
      }
      let t = reloj;
      const eventos = lista.map((a) => {
        const esp = a.espera === null || a.espera === undefined ? exp(rnd, espera) : a.espera;
        const ini = t + esp;
        const fin = ini + Math.max(1, gauss(rnd, a.dur, a.dur * 0.25));
        t = fin;
        const pool = P.personas[a.rol] || ['—'];
        return { act: a.a, ini, fin, recurso: pool[Math.floor(rnd() * pool.length)], costo: a.costo * (0.8 + 0.4 * rnd()), rol: a.rol };
      });
      log.push({ id: 'C' + String(i + 1).padStart(3, '0'), eventos });
    }
    return log;
  };

  // Registro mínimo a partir de trazas escritas como cadenas de letras: [['abcd', 3], ['acbd', 2]].
  P.logSimple = function (trazas) {
    const log = [];
    let k = 0;
    for (const [s, veces] of trazas) {
      for (let i = 0; i < veces; i++) {
        let t = 0;
        log.push({ id: 'C' + (++k), eventos: [...s].map((a) => ({ act: a, ini: t, fin: ++t, recurso: '—', costo: 0 })) });
      }
    }
    return log;
  };
  P.trazaDe = (caso) => caso.eventos.map((e) => e.act);

  /* ---------- Variantes y grafo de sucesión directa ---------- */

  P.actividades = (log) => [...new Set(log.flatMap((c) => c.eventos.map((e) => e.act)))].sort();

  // Variantes ordenadas por frecuencia: [{ traza, clave, n, casos }].
  P.variantes = function (log) {
    const m = new Map();
    for (const c of log) {
      const tr = P.trazaDe(c), k = tr.join('›');
      if (!m.has(k)) m.set(k, { traza: tr, clave: k, n: 0, casos: [] });
      const v = m.get(k); v.n++; v.casos.push(c);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.clave.localeCompare(b.clave));
  };

  // DFG: frecuencias de actividades y de pares a>b, inicios y finales.
  P.dfg = function (log) {
    const acts = P.actividades(log);
    const frec = new Map(acts.map((a) => [a, 0]));
    const par = new Map(), ini = new Map(), fin = new Map();
    const suma = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    for (const c of log) {
      const tr = P.trazaDe(c);
      if (!tr.length) continue;
      tr.forEach((a) => frec.set(a, frec.get(a) + 1));
      suma(ini, tr[0]); suma(fin, tr[tr.length - 1]);
      for (let i = 0; i + 1 < tr.length; i++) suma(par, tr[i] + '\u0001' + tr[i + 1]);
    }
    const aristas = [...par.entries()].map(([k, n]) => { const [a, b] = k.split('\u0001'); return { de: a, a: b, n }; });
    return { acts, frec, par, ini, fin, aristas, n: (a, b) => par.get(a + '\u0001' + b) || 0 };
  };

  // Matriz de huellas: '→' causal, '←' causal inversa, '‖' paralelo, '#' sin relación.
  P.huella = function (log) {
    const d = P.dfg(log);
    const rel = {};
    for (const a of d.acts) {
      rel[a] = {};
      for (const b of d.acts) {
        const ab = d.n(a, b) > 0, ba = d.n(b, a) > 0;
        rel[a][b] = ab && ba ? '‖' : ab ? '→' : ba ? '←' : '#';
      }
    }
    return { acts: d.acts, rel, d };
  };

  /* ---------- Redes de Petri y algoritmo Alfa ---------- */

  // Red: { plazas: [{ id, nombre }], trans: [{ id, nombre, silenciosa }], arcos: [[de, a]], ini, fin }.
  P.entradas = (red, t) => red.arcos.filter((a) => a[1] === t).map((a) => a[0]);
  P.salidas = (red, t) => red.arcos.filter((a) => a[0] === t).map((a) => a[1]);
  P.habilitada = (red, m, t) => P.entradas(red, t).every((p) => (m[p] || 0) > 0);
  P.disparar = function (red, m, t) {
    const n = { ...m };
    P.entradas(red, t).forEach((p) => { n[p] = (n[p] || 0) - 1; });
    P.salidas(red, t).forEach((p) => { n[p] = (n[p] || 0) + 1; });
    return n;
  };
  P.marcadoInicial = (red) => ({ [red.ini]: 1 });

  // Algoritmo Alfa (α). Devuelve la red y los pasos intermedios para mostrarlos.
  P.alfa = function (log) {
    const h = P.huella(log), acts = h.acts, d = h.d;
    const Ti = [...d.ini.keys()].sort(), To = [...d.fin.keys()].sort();
    const caus = (a, b) => h.rel[a][b] === '→';
    const sin = (a, b) => h.rel[a][b] === '#';
    // Conjuntos de actividades mutuamente sin relación (incluida cada una consigo misma).
    const indep = [];
    const n = acts.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      const s = acts.filter((_, i) => mask & (1 << i));
      if (s.every((a) => s.every((b) => sin(a, b)))) indep.push(s);
    }
    const X = [];
    for (const A of indep) for (const B of indep) {
      if (A.every((a) => B.every((b) => caus(a, b)))) X.push({ A, B });
    }
    const incluye = (U, V) => U.every((u) => V.includes(u));
    const Y = X.filter((p) => !X.some((q) => q !== p && incluye(p.A, q.A) && incluye(p.B, q.B)));
    const plazas = [{ id: 'ini', nombre: 'inicio' }], trans = acts.map((a) => ({ id: 't_' + a, nombre: a })), arcos = [];
    Y.forEach((p, i) => {
      const id = 'p' + (i + 1);
      plazas.push({ id, nombre: `({${p.A.join(',')}},{${p.B.join(',')}})`, A: p.A, B: p.B });
      p.A.forEach((a) => arcos.push(['t_' + a, id]));
      p.B.forEach((b) => arcos.push([id, 't_' + b]));
    });
    plazas.push({ id: 'fin', nombre: 'fin' });
    Ti.forEach((a) => arcos.push(['ini', 't_' + a]));
    To.forEach((a) => arcos.push(['t_' + a, 'fin']));
    return { red: { plazas, trans, arcos, ini: 'ini', fin: 'fin' }, Ti, To, X, Y, huella: h };
  };

  // Reproducción de fichas (token-based replay) de una traza sobre la red; pasos para animar.
  P.reproducir = function (red, traza) {
    let m = P.marcadoInicial(red);
    let p = 1, c = 0, falt = 0;
    const pasos = [{ marcado: { ...m }, act: null, faltantes: [], p, c, m: falt }];
    for (const a of traza) {
      const t = red.trans.find((x) => x.nombre === a);
      if (!t) { pasos.push({ marcado: { ...m }, act: a, sinTransicion: true, faltantes: [], p, c, m: falt }); continue; }
      const faltan = [];
      for (const pl of P.entradas(red, t.id)) {
        if ((m[pl] || 0) <= 0) { m[pl] = 1; falt++; faltan.push(pl); }
      }
      c += P.entradas(red, t.id).length;
      m = P.disparar(red, m, t.id);
      p += P.salidas(red, t.id).length;
      pasos.push({ marcado: { ...m }, act: a, trans: t.id, faltantes: faltan, p, c, m: falt });
    }
    let rest = 0;
    if ((m[red.fin] || 0) > 0) { m[red.fin]--; c++; } else { falt++; c++; }
    for (const k of Object.keys(m)) rest += Math.max(0, m[k]);
    pasos.push({ marcado: { ...m }, act: null, final: true, faltantes: [], p, c, m: falt, r: rest });
    const r = rest;
    const fitness = 0.5 * (1 - falt / Math.max(1, c)) + 0.5 * (1 - r / Math.max(1, p));
    return { pasos, p, c, m: falt, r, fitness };
  };

  /* ---------- Disposición por capas ---------- */

  // nodos: [id], aristas: [[de, a]] → { id: { x, y } } con x, y en [0, 1], flujo de izquierda a derecha.
  P.disponer = function (nodos, aristas) {
    const sal = new Map(nodos.map((n) => [n, []])), ent = new Map(nodos.map((n) => [n, []]));
    for (const [a, b] of aristas) if (sal.has(a) && sal.has(b)) { sal.get(a).push(b); ent.get(b).push(a); }
    // Quitar aristas de retroceso con una búsqueda en profundidad.
    const estado = new Map(), atras = new Set();
    const inicios = nodos.filter((n) => !ent.get(n).length).concat(nodos);
    const dfs = (u) => {
      estado.set(u, 1);
      for (const v of sal.get(u)) {
        if (estado.get(v) === 1) atras.add(u + '\u0001' + v);
        else if (!estado.get(v)) dfs(v);
      }
      estado.set(u, 2);
    };
    inicios.forEach((n) => { if (!estado.get(n)) dfs(n); });
    const ok = aristas.filter(([a, b]) => a !== b && !atras.has(a + '\u0001' + b));
    const rank = new Map(nodos.map((n) => [n, 0]));
    for (let it = 0; it < nodos.length; it++) {
      let cambio = false;
      for (const [a, b] of ok) if (rank.get(b) < rank.get(a) + 1) { rank.set(b, rank.get(a) + 1); cambio = true; }
      if (!cambio) break;
    }
    const maxR = Math.max(0, ...rank.values());
    const capas = Array.from({ length: maxR + 1 }, () => []);
    nodos.forEach((n) => capas[rank.get(n)].push(n));
    const orden = new Map();
    capas.forEach((cp) => cp.forEach((n, i) => orden.set(n, i)));
    for (let barrido = 0; barrido < 6; barrido++) {
      const adelante = barrido % 2 === 0;
      for (const cp of (adelante ? capas : capas.slice().reverse())) {
        const bar = (n) => {
          const v = (adelante ? ent : sal).get(n).filter((u) => !atras.has(n + '\u0001' + u) && !atras.has(u + '\u0001' + n));
          return v.length ? v.reduce((t, u) => t + orden.get(u), 0) / v.length : orden.get(n);
        };
        cp.sort((x, z) => bar(x) - bar(z));
        cp.forEach((n, i) => orden.set(n, i));
      }
    }
    const alto = Math.max(1, ...capas.map((c) => c.length));
    const pos = {};
    capas.forEach((cp, r) => cp.forEach((n, i) => {
      pos[n] = { x: maxR ? r / maxR : 0.5, y: (i + 0.5) / cp.length * (cp.length / alto) + (1 - cp.length / alto) / 2 };
    }));
    return pos;
  };

  /* ---------- Dibujo de redes y grafos de procesos ---------- */

  // Nodo: { id, tipo: 'plaza'|'trans'|'act'|'rombo'|'tau'|'inicio'|'fin', etiqueta, relleno, borde, fichas, anillo }.
  // Arista: { de, a, etiqueta, ancho, color, guiones }. pos viene de P.disponer.
  P.dibujarGrafo = function (lienzo, nodos, aristas, pos, o = {}) {
    const { ctx, ancho: W, alto: H } = lienzo;
    const mx = o.margenX === undefined ? 44 : o.margenX, my = o.margenY === undefined ? 30 : o.margenY;
    ctx.font = VIZ.fuente(o.fuente || 11, 500);
    const tam = new Map();
    for (const n of nodos) {
      const w = n.tipo === 'plaza' || n.tipo === 'inicio' || n.tipo === 'fin' ? 26
        : n.tipo === 'tau' ? 10 : n.tipo === 'rombo' ? 30 : Math.max(36, ctx.measureText(n.etiqueta || '').width + 16);
      const h = n.tipo === 'plaza' || n.tipo === 'inicio' || n.tipo === 'fin' ? 26 : n.tipo === 'tau' ? 28 : n.tipo === 'rombo' ? 30 : 26;
      tam.set(n.id, { w, h });
    }
    const geo = new Map();
    for (const n of nodos) {
      const p = pos[n.id] || { x: 0.5, y: 0.5 };
      geo.set(n.id, { x: mx + p.x * (W - 2 * mx), y: my + p.y * (H - 2 * my), ...tam.get(n.id), n });
    }
    const borde = (g, dx, dy) => {
      const k = Math.hypot(dx, dy) || 1, ux = dx / k, uy = dy / k;
      if (g.n.tipo === 'plaza' || g.n.tipo === 'inicio' || g.n.tipo === 'fin') return [g.x + ux * g.w / 2, g.y + uy * g.h / 2];
      const t = Math.min(Math.abs(ux) > 1e-6 ? (g.w / 2) / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? (g.h / 2) / Math.abs(uy) : Infinity);
      return [g.x + ux * t, g.y + uy * t];
    };
    const dosSentidos = new Set(aristas.map((e) => e.de + '\u0001' + e.a));
    const flecha = (x, yy, ang, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x - 8 * Math.cos(ang - 0.4), yy - 8 * Math.sin(ang - 0.4));
      ctx.lineTo(x - 8 * Math.cos(ang + 0.4), yy - 8 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
    };
    const lineas = [];
    for (const e of aristas) {
      const A = geo.get(e.de), B = geo.get(e.a);
      if (!A || !B) continue;
      const color = e.color || C.eje, ancho = e.ancho || 1.5;
      ctx.strokeStyle = color; ctx.lineWidth = ancho;
      ctx.setLineDash(e.guiones ? [5, 4] : []);
      ctx.beginPath();
      let lx, ly, ang, p1, p2;
      if (e.de === e.a) {
        const x = A.x, yy = A.y - A.h / 2;
        ctx.moveTo(x - 8, yy); ctx.bezierCurveTo(x - 20, yy - 26, x + 20, yy - 26, x + 8, yy);
        ctx.stroke(); ctx.setLineDash([]);
        flecha(x + 8, yy, Math.PI * 0.75, color);
        lx = x; ly = yy - 22; ang = 0; p1 = [x, yy]; p2 = [x, yy];
      } else {
        const curvo = dosSentidos.has(e.a + '\u0001' + e.de) || e.curva || B.x < A.x - 1;
        let dx = B.x - A.x, dy = B.y - A.y;
        const k = Math.hypot(dx, dy) || 1;
        const off = curvo ? (e.curva || 26) * (B.x < A.x - 1 ? -1 : 1) : 0;
        const cx = (A.x + B.x) / 2 - dy / k * off, cy = (A.y + B.y) / 2 + dx / k * off;
        p1 = borde(A, cx - A.x, cy - A.y); p2 = borde(B, cx - B.x, cy - B.y);
        ctx.moveTo(p1[0], p1[1]);
        if (curvo) ctx.quadraticCurveTo(cx, cy, p2[0], p2[1]); else ctx.lineTo(p2[0], p2[1]);
        ctx.stroke(); ctx.setLineDash([]);
        ang = Math.atan2(p2[1] - (curvo ? cy : p1[1]), p2[0] - (curvo ? cx : p1[0]));
        flecha(p2[0], p2[1], ang, color);
        lx = curvo ? (p1[0] + 2 * cx + p2[0]) / 4 : (p1[0] + p2[0]) / 2; ly = curvo ? (p1[1] + 2 * cy + p2[1]) / 4 : (p1[1] + p2[1]) / 2;
      }
      if (e.etiqueta !== undefined && e.etiqueta !== null && e.etiqueta !== '') {
        ctx.font = VIZ.fuente(10, 500);
        const w = ctx.measureText(String(e.etiqueta)).width + 6;
        ctx.fillStyle = C.superficie; ctx.fillRect(lx - w / 2, ly - 7, w, 14);
        ctx.fillStyle = e.colorTexto || C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(e.etiqueta), lx, ly);
      }
      lineas.push({ e, p1, p2 });
    }
    ctx.setLineDash([]);
    for (const g of geo.values()) {
      const n = g.n;
      const relleno = n.relleno || C.superficie, trazo = n.borde || C.tinta;
      ctx.lineWidth = n.anillo ? 3 : 1.5;
      ctx.strokeStyle = n.anillo || trazo; ctx.fillStyle = relleno;
      ctx.beginPath();
      if (n.tipo === 'plaza') ctx.arc(g.x, g.y, g.w / 2, 0, 2 * Math.PI);
      else if (n.tipo === 'inicio') ctx.arc(g.x, g.y, g.w / 2, 0, 2 * Math.PI);
      else if (n.tipo === 'fin') { ctx.arc(g.x, g.y, g.w / 2, 0, 2 * Math.PI); }
      else if (n.tipo === 'rombo') { ctx.moveTo(g.x, g.y - g.h / 2); ctx.lineTo(g.x + g.w / 2, g.y); ctx.lineTo(g.x, g.y + g.h / 2); ctx.lineTo(g.x - g.w / 2, g.y); ctx.closePath(); }
      else if (n.tipo === 'act') ctx.roundRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h, 7);
      else if (n.tipo === 'tau') ctx.rect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
      else ctx.rect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
      ctx.fill(); ctx.stroke();
      if (n.tipo === 'fin') { ctx.beginPath(); ctx.arc(g.x, g.y, g.w / 2 - 4, 0, 2 * Math.PI); ctx.stroke(); }
      if (n.tipo === 'tau') { ctx.fillStyle = C.tinta; ctx.fillRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h); }
      if (n.tipo === 'rombo' && n.etiqueta) {
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.etiqueta, g.x, g.y + 0.5);
      } else if (n.etiqueta && n.tipo !== 'plaza' && n.tipo !== 'tau' && n.tipo !== 'inicio' && n.tipo !== 'fin') {
        ctx.fillStyle = n.colorTexto || C.tinta; ctx.font = VIZ.fuente(o.fuente || 11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.etiqueta, g.x, g.y + 0.5);
      } else if (n.etiqueta && (n.tipo === 'plaza') && o.etiquetasPlazas) {
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(9, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(n.etiqueta, g.x, g.y + g.h / 2 + 3);
      }
      if (n.fichas > 0) {
        ctx.fillStyle = C.tinta;
        if (n.fichas === 1) { ctx.beginPath(); ctx.arc(g.x, g.y, 4.5, 0, 2 * Math.PI); ctx.fill(); }
        else { ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n.fichas), g.x, g.y + 0.5); }
      }
      if (n.insignia) {
        ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(n.insignia).width + 8;
        ctx.fillStyle = n.colorInsignia || C.s2; ctx.beginPath(); ctx.roundRect(g.x - w / 2, g.y - g.h / 2 - 16, w, 14, 7); ctx.fill();
        ctx.fillStyle = C.sobre; ctx.fillText(n.insignia, g.x, g.y - g.h / 2 - 9);
      }
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    return { nodos: geo, lineas };
  };

  P.nodoEn = function (geo, x, yy) {
    for (const g of geo.nodos.values()) if (Math.abs(x - g.x) <= g.w / 2 + 3 && Math.abs(yy - g.y) <= g.h / 2 + 3) return g.n;
    return null;
  };

  // Atajos para convertir estructuras de este módulo en nodos y aristas dibujables.
  P.nodosDeRed = function (red, marcado = {}, o = {}) {
    const nodos = [
      ...red.plazas.map((p) => ({ id: p.id, tipo: 'plaza', etiqueta: p.nombre, fichas: marcado[p.id] || 0, ...(o.plaza ? o.plaza(p) : {}) })),
      ...red.trans.map((t) => ({ id: t.id, tipo: t.silenciosa ? 'tau' : 'trans', etiqueta: t.nombre, ...(o.trans ? o.trans(t) : {}) })),
    ];
    return { nodos, aristas: red.arcos.map(([de, a]) => ({ de, a })) };
  };
  P.posDeRed = (red) => P.disponer([...red.plazas.map((p) => p.id), ...red.trans.map((t) => t.id)], red.arcos);

  P.dur = function (min) {
    if (!isFinite(min)) return '—';
    if (min < 60) return VIZ.fmt(min, 3) + ' min';
    if (min < 1440) return VIZ.fmt(min / 60, 3) + ' h';
    return VIZ.fmt(min / 1440, 3) + ' d';
  };

  // Estadística pequeña usada por varios temas.
  P.media = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  P.mediana = (a) => { const s = a.slice().sort((x, z) => x - z); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
  P.cuantil = (a, q) => { const s = a.slice().sort((x, z) => x - z); if (!s.length) return NaN; const p = (s.length - 1) * q, i = Math.floor(p); return i + 1 < s.length ? s[i] + (p - i) * (s[i + 1] - s[i]) : s[i]; };
  P.duracionCaso = (c) => c.eventos[c.eventos.length - 1].fin - c.eventos[0].ini;
  P.tiempoCiclo = (c) => c.eventos[c.eventos.length - 1].fin - c.eventos[0].ini;
})();
