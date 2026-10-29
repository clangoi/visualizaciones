/* Sistemas distribuidos: flechas y nodos, diagramas espacio-tiempo, ejecuciones aleatorias con
   relojes de Lamport y vectoriales, y verificadores de consistencia (secuencial, causal y
   linealizable) para historias de lecturas y escrituras sobre registros compartidos. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

  /* ---------- Marcas básicas ---------- */

  // Flecha de (x0, y0) a (x1, y1); curva > 0 la arquea hacia la izquierda del sentido de avance.
  function flecha(ctx, x0, y0, x1, y1, { color = C.tinta2, ancho = 1.5, guiones = null, punta = true, curva = 0 } = {}) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const cx = (x0 + x1) / 2 + (dy / L) * curva, cy = (y0 + y1) / 2 - (dx / L) * curva;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = ancho;
    ctx.lineCap = 'round';
    if (guiones) ctx.setLineDash(guiones);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (curva) ctx.quadraticCurveTo(cx, cy, x1, y1); else ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    if (punta) {
      const t = curva ? Math.atan2(y1 - cy, x1 - cx) : Math.atan2(dy, dx);
      const s = 6 + ancho;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - s * Math.cos(t - 0.42), y1 - s * Math.sin(t - 0.42));
      ctx.lineTo(x1 - s * Math.cos(t + 0.42), y1 - s * Math.sin(t + 0.42));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Punto medio de la curva (para etiquetas).
    return curva ? { x: 0.25 * x0 + 0.5 * cx + 0.25 * x1, y: 0.25 * y0 + 0.5 * cy + 0.25 * y1 } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }

  // Etiqueta con fondo de superficie (opcionalmente con borde de color).
  function etiqueta(ctx, texto, x, y, { color = C.tinta, borde = null, fondo = C.superficie, tam = 11, peso = 500, alinear = 'center' } = {}) {
    ctx.save();
    ctx.font = VIZ.fuente(tam, peso);
    const w = ctx.measureText(texto).width + 8, h = tam + 5;
    const x0 = alinear === 'left' ? x : alinear === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = fondo;
    ctx.fillRect(x0, y - h / 2, w, h);
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 1.2; ctx.strokeRect(x0 + 0.5, y - h / 2 + 0.5, w - 1, h - 1); }
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x0 + w / 2, y + 0.5);
    ctx.restore();
    return w;
  }

  /* Nodo circular. est: { relleno, borde, texto (color), anillo, caido, r, peso, tam } */
  function nodo(ctx, x, y, texto, est = {}) {
    const r = est.r || 15;
    ctx.save();
    if (est.anillo) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4.5, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = est.anillo;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = est.caido ? C.neutro : est.relleno || C.superficie;
    ctx.fill();
    ctx.lineWidth = est.grosor || 1.5;
    ctx.strokeStyle = est.caido ? C.inactivo : est.borde || C.tinta;
    if (est.caido) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = est.caido ? C.inactivo : est.texto || C.tinta;
    ctx.font = VIZ.fuente(est.tam || 12, est.peso || 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y + 0.5);
    if (est.caido) {
      ctx.strokeStyle = C.s8;
      ctx.lineWidth = 2;
      const d = r * 0.55;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.5 - d, y - r - 2 - d * 0.3); ctx.lineTo(x + r * 0.5 + d * 0.6, y - r - 2 + d * 0.9);
      ctx.moveTo(x + r * 0.5 + d * 0.6, y - r - 2 - d * 0.3); ctx.lineTo(x + r * 0.5 - d, y - r - 2 + d * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Mensaje entre dos nodos (centros a y b, radio r): flecha recortada al borde y etiqueta opcional.
  function mensaje(ctx, a, b, r, { color = C.s1, ancho = 2, guiones = null, texto = null, curva = 0, colorTexto = null, enMedio = 0.5 } = {}) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const desv = curva ? Math.atan2(2 * curva, L) : 0;
    const rot = (x, y, ang) => [x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)];
    const [sx, sy] = rot(ux, uy, -desv), [ex, ey] = rot(-ux, -uy, desv);
    const x0 = a.x + sx * (r + 2), y0 = a.y + sy * (r + 2), x1 = b.x + ex * (r + 3), y1 = b.y + ey * (r + 3);
    const m = flecha(ctx, x0, y0, x1, y1, { color, ancho, guiones, curva });
    if (texto) {
      const px = enMedio === 0.5 ? m.x : x0 + (x1 - x0) * enMedio, py = enMedio === 0.5 ? m.y : y0 + (y1 - y0) * enMedio;
      etiqueta(ctx, texto, px, py, { color: colorTexto || color, borde: color, tam: 10 });
    }
  }

  // Posiciones de n puntos en círculo, el primero arriba y en sentido horario.
  function circulo(W, H, n, { margen = 36, cx = W / 2, cy = H / 2, radio } = {}) {
    const R = radio ?? Math.max(30, Math.min(W, H) / 2 - margen);
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a };
    });
  }

  // Índice del punto más cercano a (x, y) dentro de dmax, o −1.
  function cercano(pos, x, y, dmax = 22) {
    let mejor = -1, dm = dmax;
    pos.forEach((p, i) => { if (!p) return; const d = Math.hypot(p.x - x, p.y - y); if (d < dm) { dm = d; mejor = i; } });
    return mejor;
  }

  /* ---------- Diagrama espacio-tiempo ---------- */

  /* op: {
       procesos: ['P1', …], t: [tmin, tmax],
       eventos:    [{ p, t, relleno, anillo, r, texto (arriba), sub (abajo, tenue), colorTexto, abajo, fijo, forma }],
       mensajes:   [{ p0, t0, p1, t1, color, ancho, guiones, texto, hasta }]   (hasta < t1: mensaje en vuelo)
       intervalos: [{ p, t0, t1, texto, color, relleno, colorTexto }],
       corte:      [t por proceso] → polilínea, colorCorte,
       ahora:      t (línea vertical discontinua),
       margenIzq, sup, inf, colorProceso(p) }
     Devuelve geo { x(t), y(p), t(x), p(y), eventos: [{ x, y }] }. */
  function espacioTiempo(lienzo, op) {
    const { ctx, ancho: W, alto: H } = lienzo;
    const n = op.procesos.length;
    const izq = op.margenIzq ?? 38, der = 16, sup = op.sup ?? 30, inf = op.inf ?? 26;
    const [t0, t1] = op.t;
    const x = (t) => izq + ((t - t0) / (t1 - t0)) * (W - izq - der);
    const paso = n > 1 ? (H - sup - inf) / (n - 1) : 0;
    const y = (p) => (n > 1 ? sup + p * paso : H / 2);
    const geo = { x, y, t: (px) => t0 + ((px - izq) / (W - izq - der)) * (t1 - t0), p: (py) => Math.round((py - sup) / (paso || 1)), paso, izq, der, eventos: [] };

    ctx.save();
    ctx.textBaseline = 'middle';
    for (let p = 0; p < n; p++) {
      const yy = Math.round(y(p)) + 0.5;
      ctx.strokeStyle = C.eje;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(izq - 4, yy); ctx.lineTo(W - der, yy); ctx.stroke();
      ctx.fillStyle = C.eje;
      ctx.beginPath(); ctx.moveTo(W - der + 6, yy); ctx.lineTo(W - der, yy - 4); ctx.lineTo(W - der, yy + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = (op.colorProceso && op.colorProceso(p)) || C.tinta;
      ctx.font = VIZ.fuente(12, 600);
      ctx.textAlign = 'left';
      ctx.fillText(op.procesos[p], 2, yy);
    }
    if (op.ahora != null) {
      const xa = Math.round(x(op.ahora)) + 0.5;
      ctx.strokeStyle = C.apagado;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(xa, sup - 18); ctx.lineTo(xa, H - inf + 14); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const iv of op.intervalos || []) {
      const xa = x(iv.t0), xb = x(iv.t1), yy = y(iv.p), h = 18;
      ctx.fillStyle = iv.relleno || C.superficie;
      ctx.strokeStyle = iv.color || C.tinta;
      ctx.lineWidth = iv.grosor || 1.5;
      ctx.beginPath(); ctx.rect(xa, yy - h / 2, xb - xa, h); ctx.fill(); ctx.stroke();
      if (iv.texto) {
        ctx.font = VIZ.fuente(11, 500);
        ctx.fillStyle = iv.colorTexto || C.tinta;
        ctx.textAlign = 'center';
        const tw = ctx.measureText(iv.texto).width;
        ctx.fillText(iv.texto, (xa + xb) / 2, tw + 4 < xb - xa ? yy + 0.5 : yy - h / 2 - 8);
      }
    }
    ctx.restore();

    const R = 5;
    for (const m of op.mensajes || []) {
      const xa = x(m.t0), ya = y(m.p0), xb = x(m.t1), yb = y(m.p1);
      const L = Math.hypot(xb - xa, yb - ya) || 1, ux = (xb - xa) / L, uy = (yb - ya) / L;
      const en = m.hasta != null && m.hasta < m.t1;
      const f = en ? Math.max(0, (m.hasta - m.t0) / (m.t1 - m.t0)) : 1;
      const sx = xa + ux * R, sy = ya + uy * R;
      const ex = en ? xa + (xb - xa) * f : xb - ux * (R + 2), ey = en ? ya + (yb - ya) * f : yb - uy * (R + 2);
      if (en && f <= 0) continue;
      flecha(ctx, sx, sy, ex, ey, { color: m.color || C.tinta2, ancho: m.ancho || 1.5, guiones: m.guiones || (en ? [4, 3] : null), punta: !en });
      if (en) { ctx.fillStyle = m.color || C.tinta2; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill(); }
      if (m.texto) {
        const fm = en ? f / 2 : 0.5;
        etiqueta(ctx, m.texto, xa + (xb - xa) * fm, ya + (yb - ya) * fm, { color: m.colorTexto || m.color || C.tinta2, tam: 10 });
      }
    }

    if (op.corte) {
      ctx.save();
      ctx.strokeStyle = op.colorCorte || C.s7;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      op.corte.forEach((t, p) => {
        const px = x(t), py = y(p);
        if (p === 0) ctx.moveTo(px, py - Math.min(20, paso / 2 || 20));
        ctx.lineTo(px, py);
        if (p === n - 1) ctx.lineTo(px, py + Math.min(20, paso / 2 || 20));
      });
      ctx.stroke();
      ctx.restore();
    }

    // Eventos; las etiquetas que chocarían con la anterior del mismo proceso pasan al otro lado.
    const ultimo = {};
    (op.eventos || []).forEach((e) => {
      const ex = x(e.t), ey = y(e.p), r = e.r || R;
      geo.eventos.push({ x: ex, y: ey });
      if (e.anillo) {
        ctx.beginPath(); ctx.arc(ex, ey, r + 4, 0, Math.PI * 2);
        ctx.lineWidth = 2.5; ctx.strokeStyle = e.anillo; ctx.stroke();
      }
      VIZ.marcador(ctx, ex, ey, e.relleno || C.tinta, r, e.forma || 0);
      if (e.texto) {
        ctx.font = VIZ.fuente(e.tam || 11, 500);
        const w = ctx.measureText(e.texto).width;
        // Lado preferido; si choca con la etiqueta anterior del mismo proceso (o se sale del lienzo), el otro;
        // si ambos chocan, la etiqueta se omite salvo que sea fija (queda el tooltip).
        const yDe = (ab) => ey + (ab ? r + (e.sub ? 22 : 10) : -r - 9);
        const libre = (ab) => {
          const k = e.p + (ab ? 'b' : 'a');
          const yy = yDe(ab);
          return (ultimo[k] == null || ex - w / 2 >= ultimo[k] + 3) && yy - 7 >= 0 && yy + 7 <= H;
        };
        let abajo = !!e.abajo;
        if (!libre(abajo)) abajo = libre(!abajo) ? !abajo : e.fijo ? abajo : null;
        if (abajo != null) {
          ultimo[e.p + (abajo ? 'b' : 'a')] = ex + w / 2;
          const ty = yDe(abajo);
          ctx.fillStyle = C.superficie;
          ctx.fillRect(ex - w / 2 - 1, ty - 7, w + 2, 14);
          ctx.fillStyle = e.colorTexto || C.tinta;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(e.texto, ex, ty);
        }
      }
      if (e.sub) {
        ctx.font = VIZ.fuente(10, 400);
        const w = ctx.measureText(e.sub).width;
        ctx.fillStyle = C.superficie;
        ctx.fillRect(ex - w / 2 - 1, ey + r + 3, w + 2, 12);
        ctx.fillStyle = C.apagado;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.sub, ex, ey + r + 9);
      }
    });
    return geo;
  }

  /* ---------- Ejecuciones aleatorias con relojes ---------- */

  /* n procesos y unos k eventos, cada uno en un instante entero distinto (1, 2, …). Tipos: 'local', 'envio', 'recepcion'.
     Cada evento trae su reloj de Lamport L, su vector V, un nombre (a, b, c, … en orden de tiempo) y,
     si es de comunicación, el índice del evento par (par). Todo mensaje enviado se recibe. */
  function ejecucion({ n = 3, k = 12, semilla = 1, pLocal = 0.25, demoraMin = 2 } = {}) {
    const rnd = VIZ.semilla(semilla);
    const eventos = [], vuelo = [];
    const nuevo = (p, t, tipo, extra = {}) => { const e = { id: eventos.length, p, t, tipo, ...extra }; eventos.push(e); return e; };
    let t = 1;
    for (; t <= k; t++) {
      const p = Math.floor(rnd() * n);
      const pend = vuelo.filter((m) => m.a === p && t - m.t >= demoraMin);
      if (pend.length && (rnd() < 0.6 || t > k - 3)) {
        const m = pend[0];
        vuelo.splice(vuelo.indexOf(m), 1);
        const r = nuevo(p, t, 'recepcion', { par: m.id, de: m.p });
        eventos[m.id].par = r.id;
      } else if (rnd() < pLocal || n === 1) nuevo(p, t, 'local');
      else {
        let q = Math.floor(rnd() * (n - 1));
        if (q >= p) q++;
        const e = nuevo(p, t, 'envio', { a: q });
        vuelo.push({ id: e.id, p, a: q, t });
      }
    }
    while (vuelo.length) {
      const m = vuelo.shift();
      const tr = Math.max(t, m.t + demoraMin);
      const r = nuevo(m.a, tr, 'recepcion', { par: m.id, de: m.p });
      eventos[m.id].par = r.id;
      t = tr + 1;
    }
    eventos.sort((a, b) => a.t - b.t);
    const nuevoId = new Map(eventos.map((e, i) => [e.id, i]));
    eventos.forEach((e) => { e.id = nuevoId.get(e.id); if (e.par != null) e.par = nuevoId.get(e.par); });
    eventos.forEach((e, i) => { e.par = e.par == null ? null : e.par; e.nombre = LETRAS[i % 26]; });
    // Relojes
    const L = new Array(n).fill(0), V = Array.from({ length: n }, () => new Array(n).fill(0));
    const cuenta = new Array(n).fill(0);
    for (const e of eventos) {
      const p = e.p;
      e.k = ++cuenta[p];
      if (e.tipo === 'recepcion') {
        const s = eventos[e.par];
        e.Lprev = L[p];
        e.Vprev = V[p].slice();
        L[p] = Math.max(L[p], s.L) + 1;
        V[p] = V[p].map((v, i) => Math.max(v, s.V[i]));
      } else L[p]++;
      if (e.tipo !== 'recepcion') e.Vprev = V[p].slice();
      V[p][p]++;
      e.L = L[p];
      e.V = V[p].slice();
    }
    const tMax = eventos.length ? eventos[eventos.length - 1].t : 1;
    const mensajes = eventos.filter((e) => e.tipo === 'envio').map((e) => ({ e: e.id, r: e.par }));
    return { n, eventos, mensajes, tMax, antes: (a, b) => a !== b && precede(eventos[a].V, eventos[b].V) };
  }

  // V ≤ W componente a componente y V ≠ W.
  const menorIgual = (V, W) => V.every((v, i) => v <= W[i]);
  const precede = (V, W) => menorIgual(V, W) && V.some((v, i) => v < W[i]);
  const vec = (V) => `[${V.join(',')}]`;

  /* ---------- Historias y modelos de consistencia ---------- */

  /* Una operación: { p, tipo: 'W' | 'R', x, v, t0, t1 }. Toda variable empieza en 0 y los valores escritos
     en una misma variable son distintos, de modo que cada lectura indica de qué escritura leyó. */
  const textoOp = (o) => `${o.tipo}(${o.x})${o.v}`;

  // Busca un orden total de los índices S que respete pred (lista de predecesores por índice)
  // y en el que cada lectura devuelva la última escritura previa de su variable. Devuelve el orden o null.
  function buscarOrden(ops, S, pred, { pasos = null } = {}) {
    const memo = new Set(), orden = [], mem = {};
    const enS = new Set(S);
    const predS = (i) => pred[i].filter((j) => enS.has(j));
    const P = new Map(S.map((i) => [i, predS(i)]));
    function dfs(hecho) {
      if (orden.length === S.length) return true;
      const clave = hecho + '|' + Object.keys(mem).sort().map((k) => k + '=' + mem[k]).join(',');
      if (memo.has(clave)) return false;
      for (const i of S) {
        if (hecho & (1 << i)) continue;
        if (P.get(i).some((j) => !(hecho & (1 << j)))) continue;
        const o = ops[i];
        if (o.tipo === 'R' && (mem[o.x] ?? 0) !== o.v) { if (pasos) pasos.push({ tipo: 'falla', orden: orden.slice(), i }); continue; }
        const prev = mem[o.x];
        if (o.tipo === 'W') mem[o.x] = o.v;
        orden.push(i);
        if (pasos) pasos.push({ tipo: 'agrega', orden: orden.slice(), i });
        if (dfs(hecho | (1 << i))) return true;
        orden.pop();
        if (pasos) pasos.push({ tipo: 'retrocede', orden: orden.slice(), i });
        if (o.tipo === 'W') { if (prev === undefined) delete mem[o.x]; else mem[o.x] = prev; }
      }
      memo.add(clave);
      return false;
    }
    return dfs(0) ? orden.slice() : null;
  }

  // Predecesores inmediatos en orden de programa (operaciones previas del mismo proceso).
  function ordenPrograma(ops) {
    return ops.map((o, i) => ops.map((q, j) => j).filter((j) => ops[j].p === o.p && (ops[j].t0 < o.t0 || (ops[j].t0 === o.t0 && j < i))));
  }

  function secuencial(ops) {
    return buscarOrden(ops, ops.map((_, i) => i), ordenPrograma(ops));
  }

  // De qué escritura lee cada lectura (−1 = valor inicial, null = valor que nadie escribió).
  function escrituraLeida(ops) {
    return ops.map((o) => {
      if (o.tipo !== 'R') return undefined;
      if (o.v === 0) return -1;
      const j = ops.findIndex((w) => w.tipo === 'W' && w.x === o.x && w.v === o.v);
      return j < 0 ? null : j;
    });
  }

  // Orden causal: clausura transitiva de orden de programa ∪ «escribe en» (escritura → lectura que la lee).
  function ordenCausal(ops) {
    const n = ops.length;
    const r = Array.from({ length: n }, () => new Array(n).fill(false));
    const po = ordenPrograma(ops);
    po.forEach((l, i) => l.forEach((j) => { r[j][i] = true; }));
    escrituraLeida(ops).forEach((w, i) => { if (w != null && w >= 0) r[w][i] = true; });
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) if (r[i][k]) for (let j = 0; j < n; j++) if (r[k][j]) r[i][j] = true;
    return r;
  }

  // Causal: para cada proceso p existe un orden de (todas las escrituras + operaciones de p) que respeta el orden
  // causal y es legal. Devuelve { ok, ordenes: [orden o null por proceso], ciclo }.
  function causal(ops, nProc) {
    const r = ordenCausal(ops);
    const ciclo = ops.some((_, i) => r[i][i]);
    const pred = ops.map((_, i) => ops.map((_, j) => j).filter((j) => r[j][i]));
    const ordenes = [];
    for (let p = 0; p < nProc; p++) {
      const S = ops.map((o, i) => i).filter((i) => ops[i].tipo === 'W' || ops[i].p === p);
      ordenes.push(ciclo ? null : buscarOrden(ops, S, pred));
    }
    return { ok: !ciclo && ordenes.every(Boolean), ordenes, ciclo, relacion: r };
  }

  // Predecesores en tiempo real: j precede a i si j terminó antes de que i empezara.
  const precedenciaReal = (ops) => ops.map((o) => ops.map((_, j) => j).filter((j) => ops[j].t1 < o.t0));

  // Linealizable: devuelve { orden, puntos } (puntos de linealización dentro de cada intervalo) o null.
  function linealizable(ops, opciones) {
    const orden = buscarOrden(ops, ops.map((_, i) => i), precedenciaReal(ops), opciones);
    if (!orden) return null;
    const puntos = new Array(ops.length);
    let ultimo = -Infinity;
    for (const i of orden) {
      const o = ops[i];
      // Lo más temprano posible, pero después del anterior; se centra un poco si hay holgura.
      const p = Math.max(o.t0 + Math.min(0.15, (o.t1 - o.t0) * 0.25), ultimo + 0.12);
      puntos[i] = Math.min(p, o.t1);
      ultimo = puntos[i];
    }
    return { orden, puntos };
  }

  VIZ.dist = {
    LETRAS, flecha, etiqueta, nodo, mensaje, circulo, cercano, espacioTiempo, ejecucion, menorIgual, precede, vec,
    textoOp, buscarOrden, ordenPrograma, secuencial, escrituraLeida, ordenCausal, causal, precedenciaReal, linealizable,
  };
})();
