/* Grafos: generador de grafos aleatorios casi planos, dibujo con pesos y flechas,
   y utilidades compartidas por los temas de grafos. */
(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // ¿Se cruzan los segmentos pq y rs (sin contar extremos compartidos)?
  function cruzan(p, q, r, s) {
    const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (p === r || p === s || q === r || q === s) return false;
    return o(p, q, r) !== o(p, q, s) && o(r, s, p) !== o(r, s, q);
  }

  /* op: { n, grado (promedio deseado), dirigido, orientacion: 'aleatoria'|'dag'|'desde0',
           pesos: [min, max], negativos (pesos con potenciales, sin ciclos negativos), semilla } */
  function generar(op = {}) {
    const n = op.n || 8;
    const rnd = VIZ.semilla(op.semilla || 1);
    const pts = [];
    for (let t = 0; pts.length < n && t < 5000; t++) {
      const p = { x: 0.04 + rnd() * 0.92, y: 0.06 + rnd() * 0.88 };
      const minimo = Math.max(0.12, 0.42 / Math.sqrt(n));
      if (pts.every((q) => Math.hypot((q.x - p.x) * 1.6, q.y - p.y) > minimo)) pts.push(p);
    }
    pts.sort((a, b) => a.x - b.x);
    const nodos = pts.map((p, i) => ({ ...p, etiqueta: LETRAS[i] }));
    const N = nodos.length;
    const pares = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) pares.push([i, j, Math.hypot((nodos[i].x - nodos[j].x) * 1.6, nodos[i].y - nodos[j].y)]);
    pares.sort((a, b) => a[2] - b[2]);
    // Primero un árbol (Kruskal euclidiano) para asegurar conexión; luego aristas cortas que no crucen.
    const padre = nodos.map((_, i) => i);
    const raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
    const elegidas = [];
    for (const [i, j] of pares) {
      if (raiz(i) !== raiz(j)) { padre[raiz(i)] = raiz(j); elegidas.push([i, j]); }
    }
    const objetivo = Math.round((N * (op.grado || 2.6)) / 2);
    for (const [i, j] of pares) {
      if (elegidas.length >= objetivo) break;
      if (elegidas.some(([a, b]) => (a === i && b === j))) continue;
      if (elegidas.some(([a, b]) => cruzan(nodos[i], nodos[j], nodos[a], nodos[b]))) continue;
      elegidas.push([i, j]);
    }
    const [wmin, wmax] = op.pesos || [1, 9];
    const potencial = nodos.map(() => Math.floor(rnd() * 6));
    // Orden de descubrimiento desde 0 para orientar «hacia afuera».
    const nivel = new Array(N).fill(Infinity);
    if (op.orientacion === 'desde0') {
      nivel[0] = 0;
      const q = [0];
      for (let h = 0; h < q.length; h++) for (const [a, b] of elegidas) {
        const u = q[h], v = a === u ? b : b === u ? a : -1;
        if (v >= 0 && nivel[v] === Infinity) { nivel[v] = nivel[u] + 1; q.push(v); }
      }
    }
    const aristas = elegidas.map(([i, j]) => {
      let u = i, v = j;
      if (op.dirigido) {
        if (op.orientacion === 'dag') { /* de izquierda a derecha (índices crecientes) */ }
        else if (op.orientacion === 'desde0') { if (nivel[j] < nivel[i] || (nivel[i] === nivel[j] && rnd() < 0.5)) { u = j; v = i; } if (rnd() < 0.18) [u, v] = [v, u]; }
        else if (rnd() < 0.5) { u = j; v = i; }
      }
      let w = wmin + Math.floor(rnd() * (wmax - wmin + 1));
      if (op.negativos) w = 1 + Math.floor(rnd() * 5) + potencial[u] - potencial[v];
      return { u, v, w };
    });
    return { nodos, aristas, dirigido: !!op.dirigido };
  }

  // Listas de adyacencia: ady[u] = [{ v, w, e }] (en no dirigidos, ambas direcciones), ordenadas por etiqueta.
  function adyacencia(g) {
    const ady = g.nodos.map(() => []);
    g.aristas.forEach((a, e) => {
      ady[a.u].push({ v: a.v, w: a.w, e });
      if (!g.dirigido) ady[a.v].push({ v: a.u, w: a.w, e });
    });
    ady.forEach((l) => l.sort((p, q) => p.v - q.v));
    return ady;
  }

  /* Dibuja el grafo. o: { nodo(i) → {relleno, borde, texto, anillo}, arista(a, e) → {color, ancho, guiones, flecha},
     debajo(i) → texto bajo el nodo, pesos: bool, colorPeso(a, e) } */
  function dibujar(lienzo, g, o = {}) {
    const { ctx, ancho: W, alto: H } = lienzo;
    const m = 26;
    const pos = g.nodos.map((p) => ({ x: m + p.x * (W - 2 * m), y: m + p.y * (H - 2 * m - 12) }));
    const r = Math.max(11, Math.min(16, W / 50));
    const existe = new Set(g.aristas.map((a) => `${a.u}-${a.v}`));
    // Aristas
    g.aristas.forEach((a, e) => {
      const est = (o.arista && o.arista(a, e)) || {};
      const p = pos[a.u], q = pos[a.v];
      const doble = g.dirigido && existe.has(`${a.v}-${a.u}`);
      const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const curva = doble ? 18 : 0;
      const cx = (p.x + q.x) / 2 + nx * curva, cy = (p.y + q.y) / 2 + ny * curva;
      // Puntos de inicio y fin recortados al borde de los nodos.
      const a0 = Math.atan2(cy - p.y, cx - p.x), a1 = Math.atan2(cy - q.y, cx - q.x);
      const x0 = p.x + Math.cos(a0) * r, y0 = p.y + Math.sin(a0) * r;
      const x1 = q.x + Math.cos(a1) * (r + (g.dirigido ? 2 : 0)), y1 = q.y + Math.sin(a1) * (r + (g.dirigido ? 2 : 0));
      ctx.save();
      ctx.strokeStyle = est.color || C.eje;
      ctx.lineWidth = est.ancho || 1.5;
      if (est.guiones) ctx.setLineDash(est.guiones);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      if (curva) ctx.quadraticCurveTo(cx, cy, x1, y1); else ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      if (g.dirigido) {
        const ang = Math.atan2(y1 - cy, x1 - cx);
        const t = curva ? ang : Math.atan2(dy, dx);
        const s = 6 + (est.ancho || 1.5);
        ctx.fillStyle = est.color || C.apagado;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - s * Math.cos(t - 0.42), y1 - s * Math.sin(t - 0.42));
        ctx.lineTo(x1 - s * Math.cos(t + 0.42), y1 - s * Math.sin(t + 0.42));
        ctx.closePath();
        ctx.fill();
      }
      if (o.pesos) {
        const mx = curva ? 0.25 * p.x + 0.5 * cx + 0.25 * q.x : (p.x + q.x) / 2;
        const my = curva ? 0.25 * p.y + 0.5 * cy + 0.25 * q.y : (p.y + q.y) / 2;
        const txt = String(a.w).replace('-', '−');
        ctx.font = VIZ.fuente(11, 500);
        const tw = ctx.measureText(txt).width + 8;
        ctx.fillStyle = C.superficie;
        ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
        ctx.fillStyle = (o.colorPeso && o.colorPeso(a, e)) || (a.w < 0 ? C.s8 : C.tinta2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, mx, my + 0.5);
      }
      ctx.restore();
    });
    // Nodos
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    g.nodos.forEach((nd, i) => {
      const { x, y } = pos[i];
      const est = (o.nodo && o.nodo(i)) || {};
      if (est.anillo) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4.5, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = est.anillo;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = est.relleno || C.superficie;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = est.borde || C.tinta;
      ctx.stroke();
      ctx.fillStyle = est.texto || C.tinta;
      ctx.font = VIZ.fuente(12, 600);
      ctx.fillText(nd.etiqueta, x, y + 0.5);
      const bajo = o.debajo && o.debajo(i);
      if (bajo != null && bajo !== '') {
        ctx.font = VIZ.fuente(11, 500);
        const tw = ctx.measureText(bajo).width + 8;
        ctx.fillStyle = VIZ.alfa(C.superficie, 0.92);
        ctx.fillRect(x - tw / 2, y + r + 3, tw, 15);
        ctx.fillStyle = (o.colorDebajo && o.colorDebajo(i)) || C.tinta;
        ctx.fillText(bajo, x, y + r + 11);
      }
    });
    return { pos, r };
  }

  function nodoEn(geo, x, y) {
    if (!geo) return -1;
    let mejor = -1, dm = geo.r + 6;
    geo.pos.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < dm) { dm = d; mejor = i; } });
    return mejor;
  }

  // Tira de «fichas» para mostrar una cola, pila o cola de prioridad.
  function estructura(padre, titulo) {
    const caja = el('div', { class: 'fichas' });
    const etiqueta = el('span', { class: 'fichas-titulo' }, titulo);
    padre.appendChild(caja);
    return {
      set(items, vacio = 'vacía') {
        caja.replaceChildren(etiqueta, ...(items.length
          ? items.map((it) => VIZ.ficha(it.texto, it))
          : [el('span', { class: 'fichas-vacio' }, vacio)]));
      },
      titulo(t) { etiqueta.textContent = t; },
    };
  }

  // Controles comunes: número de nodos, densidad y botón «Nuevo grafo».
  function controlesGrafo(ctl, estado, alCambiar, { nMin = 5, nMax = 14 } = {}) {
    ctl.rango({ etiqueta: 'Nodos', min: nMin, max: nMax, valor: estado.n, alCambiar: (v) => { estado.n = v; alCambiar(); } });
    ctl.rango({ etiqueta: 'Densidad (grado medio)', min: 2, max: 4, paso: 0.2, valor: estado.grado, formato: (v) => v.toFixed(1),
      alCambiar: (v) => { estado.grado = v; alCambiar(); } });
  }

  const dist = (d) => (d === Infinity ? '∞' : String(d).replace('-', '−'));

  VIZ.grafo = { generar, adyacencia, dibujar, nodoEn, estructura, controlesGrafo, LETRAS, dist };
})();
