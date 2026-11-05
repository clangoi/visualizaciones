/* Visualización de información (VIZ.vis): escalas lineales, datos sintéticos reproducibles, gráfico de barras
   sobre canvas con áreas de impacto para tooltips, y utilidades de texto y recorte compartidas por los temas
   de visualización. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = {};
  VIZ.vis = V;

  // Escala lineal dominio → rango, con inversa (.inv) y recorte opcional.
  V.lin = function (d0, d1, r0, r1) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
    f.inv = (p) => d0 + ((p - r0) / (r1 - r0 || 1)) * (d1 - d0);
    f.d = [d0, d1]; f.r = [r0, r1];
    return f;
  };

  // Nombres de ejemplo para datos categóricos (ciudades, productos…).
  V.CIUDADES = ['Arica', 'Iquique', 'Calama', 'La Serena', 'Valparaíso', 'Santiago', 'Rancagua', 'Talca', 'Concepción', 'Temuco', 'Valdivia', 'Puerto Montt'];
  V.PRODUCTOS = ['Café', 'Té', 'Pan', 'Leche', 'Queso', 'Jugo', 'Arroz', 'Aceite'];
  V.MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // Puntos (x, y) con correlación r entre 0 y 1 en el cuadro [0, 100]².
  V.nube = function (rnd, n, r = 0.7, grupos = 1) {
    const N = VIZ.normal;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const g = i % grupos;
      const cx = grupos === 1 ? 50 : 25 + (50 * (g % 2)) + (g > 1 ? 8 : 0), cy = grupos === 1 ? 50 : 30 + 40 * ((g >> 1) & 1) + (g === 2 ? 0 : 0);
      const a = N(rnd), b = N(rnd);
      const x = cx + 14 * a, y = cy + 14 * (r * a + Math.sqrt(1 - r * r) * b);
      pts.push({ x: Math.max(1, Math.min(99, x)), y: Math.max(1, Math.min(99, y)), g, id: i });
    }
    return pts;
  };

  // Serie de valores positivos con tendencia y estacionalidad.
  V.serie = function (rnd, n, base = 50, tendencia = 0.4, amp = 12, ruido = 5) {
    return Array.from({ length: n }, (_, i) => Math.max(1, base + tendencia * i + amp * Math.sin((i / 12) * 2 * Math.PI) + ruido * VIZ.normal(rnd)));
  };

  /* Barras verticales u horizontales con etiquetas. items: [{ nombre, valor }].
     op: { color(i, it) → relleno, max, horizontal, margen: { izq, der, sup, inf }, formato, etiquetaValor }.
     Devuelve { rects: [{ x, y, w, h, i }], base, escala } para tooltips y clics. */
  V.barras = function (lienzo, items, op = {}) {
    const { ctx, ancho: W, alto: H } = lienzo;
    const m = Object.assign({ izq: op.horizontal ? 78 : 34, der: 14, sup: 12, inf: op.horizontal ? 18 : 30 }, op.margen || {});
    const max = op.max || Math.max(1, ...items.map((d) => d.valor)) * 1.08;
    const rects = [];
    const fmt = op.formato || ((v) => VIZ.fmt(v, 3));
    ctx.save();
    if (op.horizontal) {
      const paso = (H - m.sup - m.inf) / items.length;
      const esc = V.lin(0, max, m.izq, W - m.der);
      items.forEach((d, i) => {
        const y = m.sup + i * paso + 2, h = Math.max(2, paso - 4), w = Math.max(0, esc(d.valor) - m.izq);
        ctx.fillStyle = op.color ? op.color(i, d) : C.s1;
        ctx.beginPath(); ctx.roundRect(m.izq, y, w, h, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(d.nombre, m.izq - 6, y + h / 2);
        if (op.etiquetaValor !== false && w > 30) { ctx.fillStyle = C.sobre; ctx.textAlign = 'right'; ctx.fillText(fmt(d.valor), m.izq + w - 5, y + h / 2); }
        rects.push({ x: m.izq, y, w, h, i });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(m.izq + 0.5, m.sup); ctx.lineTo(m.izq + 0.5, H - m.inf); ctx.stroke();
      ctx.restore();
      return { rects, base: m.izq, escala: esc };
    }
    const paso = (W - m.izq - m.der) / items.length;
    const esc = V.lin(0, max, H - m.inf, m.sup);
    items.forEach((d, i) => {
      const x = m.izq + i * paso + 2, w = Math.max(2, paso - 4), y = esc(d.valor), h = Math.max(0, H - m.inf - y);
      ctx.fillStyle = op.color ? op.color(i, d) : C.s1;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, [4, 4, 0, 0]); ctx.fill();
      if (paso > 22 || i % 2 === 0) {
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(d.nombre, x + w / 2, H - m.inf + 6);
      }
      rects.push({ x, y, w, h, i });
    });
    ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(m.izq, H - m.inf + 0.5); ctx.lineTo(W - m.der, H - m.inf + 0.5); ctx.stroke();
    ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const t of VIZ.ticks(0, max, 4)) {
      const y = esc(t);
      if (y < m.sup - 2) continue;
      ctx.fillText(fmt(t), m.izq - 6, y);
      ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(m.izq, y + 0.5); ctx.lineTo(W - m.der, y + 0.5); ctx.stroke();
    }
    ctx.restore();
    return { rects, base: H - m.inf, escala: esc };
  };


  /* Simulación de fuerzas al estilo de d3-force. nodos: [{ x, y, vx, vy, r?, fx?, fy? }].
     opciones (modificables en vivo): enlaces [{ s, t }] con índices, distancia, fuerzaEnlace, carga (negativa repele),
     centro { x, y, fuerza }, colision (margen o null), objetivo(n) → { x, y, fuerza } para atraer cada nodo.
     sim.tick() avanza un paso; sim.alpha es la «temperatura»; sim.reavivar(a) la sube. */
  V.fuerzas = function (nodos, op) {
    const sim = { nodos, op, alpha: 1, alphaMin: 0.001, decaimiento: 0.0228, friccion: 0.4, pasos: 0 };
    sim.reavivar = (a = 1) => { sim.alpha = Math.max(sim.alpha, a); };
    sim.tick = function () {
      const a = (sim.alpha += ((op.alphaObjetivo || 0) - sim.alpha) * sim.decaimiento);
      const n = nodos.length;
      for (const e of op.enlaces || []) {
        const s = nodos[e.s], t = nodos[e.t];
        let dx = t.x + t.vx - s.x - s.vx, dy = t.y + t.vy - s.y - s.vy;
        const l = Math.hypot(dx, dy) || 1e-6, k = ((l - op.distancia) / l) * a * (op.fuerzaEnlace ?? 0.3);
        dx *= k; dy *= k; t.vx -= dx * 0.5; t.vy -= dy * 0.5; s.vx += dx * 0.5; s.vy += dy * 0.5;
      }
      if (op.carga) {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const A = nodos[i], B = nodos[j];
          let dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy;
          if (l2 < 1) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; l2 = 1; }
          const w = (op.carga * a) / Math.max(l2, 30);
          A.vx += dx * w; A.vy += dy * w; B.vx -= dx * w; B.vy -= dy * w;
        }
      }
      if (op.objetivo) for (const q of nodos) { const o = op.objetivo(q); if (o) { q.vx += (o.x - q.x) * o.fuerza * a; q.vy += (o.y - q.y) * o.fuerza * a; } }
      if (op.colision != null) {
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const A = nodos[i], B = nodos[j];
          let dx = B.x + B.vx - A.x - A.vx, dy = B.y + B.vy - A.y - A.vy;
          const l = Math.hypot(dx, dy) || 1e-6, m = A.r + B.r + op.colision;
          if (l < m) { const k = ((m - l) / l) * 0.5; dx *= k; dy *= k; B.vx += dx; B.vy += dy; A.vx -= dx; A.vy -= dy; }
        }
      }
      for (const q of nodos) {
        if (q.fx != null) { q.x = q.fx; q.vx = 0; } else { q.vx *= 1 - sim.friccion; q.x += q.vx; }
        if (q.fy != null) { q.y = q.fy; q.vy = 0; } else { q.vy *= 1 - sim.friccion; q.y += q.vy; }
      }
      if (op.centro) {
        let mx = 0, my = 0; for (const q of nodos) { mx += q.x; my += q.y; }
        mx = mx / n - op.centro.x; my = my / n - op.centro.y;
        for (const q of nodos) { q.x -= mx * (op.centro.fuerza ?? 1); q.y -= my * (op.centro.fuerza ?? 1); }
      }
      sim.pasos++;
    };
    return sim;
  };


  // Tabla de ventas sintética: una fila por mes, región y categoría (12 × 4 × 3 = 144 filas).
  V.REGIONES = ['Norte', 'Centro', 'Sur', 'Austral'];
  V.CATEGORIAS = ['Bebidas', 'Panadería', 'Lácteos'];
  V.ventas = function (semilla = 1) {
    const rnd = VIZ.semilla(semilla * 101 + 7), filas = [];
    V.REGIONES.forEach((region, r) => V.CATEGORIAS.forEach((cat, c) => {
      const base = 40 + r * 15 + c * 10 - (r === 3 ? 12 : 0);
      for (let m = 0; m < 12; m++) {
        const ventas = Math.max(5, base * (1 + 0.25 * Math.sin(((m + c * 2) / 12) * 2 * Math.PI) + 0.02 * m) + 6 * VIZ.normal(rnd));
        const pedidos = Math.round(ventas / (0.9 + 0.5 * rnd() + c * 0.25) * 4);
        filas.push({ mes: m, region, cat, ventas: Math.round(ventas * 10) / 10, pedidos, unidades: Math.round(pedidos * (2 + rnd())), costo: Math.round(ventas * (0.55 + 0.15 * rnd()) * 10) / 10 });
      }
    }));
    return filas;
  };
  // Agrupa filas por una clave y agrega una métrica: suma, promedio, conteo, max.
  V.agrupar = function (filas, clave, valor, agg = 'suma') {
    const m = new Map();
    for (const f of filas) { const k = clave(f); if (!m.has(k)) m.set(k, []); m.get(k).push(valor(f)); }
    return [...m].map(([k, v]) => ({ clave: k, valor: agg === 'suma' ? v.reduce((a, b) => a + b, 0) : agg === 'promedio' ? v.reduce((a, b) => a + b, 0) / v.length : agg === 'conteo' ? v.length : Math.max(...v), n: v.length }));
  };

  // Devuelve el rectángulo (con .i) bajo el punto, o null.
  V.bajo = (rects, x, y) => rects.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;

  // Punto más cercano de una lista [{ px, py }] dentro de un radio (px).
  V.cercano = function (lista, x, y, radio = 14) {
    let mejor = null, dm = radio * radio;
    for (const p of lista) {
      const d = (p.px - x) ** 2 + (p.py - y) ** 2;
      if (d < dm) { dm = d; mejor = p; }
    }
    return mejor;
  };

  // Recorta una cadena a un ancho máximo en caracteres.
  V.corto = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

  // Rótulo con fondo para anotar sobre un canvas.
  V.rotulo = function (ctx, t, x, y, { color = C.tinta2, tam = 11, peso = 400, alinear = 'left' } = {}) {
    ctx.save();
    ctx.fillStyle = color; ctx.font = VIZ.fuente(tam, peso); ctx.textAlign = alinear; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
    ctx.restore();
  };


  // Elemento SVG: V.svg('circle', { cx: 5, r: 3, onclick: fn }, hijos…). Los hijos pueden ser nodos o texto.
  const NS = 'http://www.w3.org/2000/svg';
  V.svg = function (tag, attrs, ...hijos) {
    const e = document.createElementNS(NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const h of hijos.flat()) if (h != null) e.append(h.nodeType ? h : String(h));
    return e;
  };

  // Contenedor con un <svg> que escala con el ancho (viewBox fijo). Devuelve el elemento <svg>.
  V.lienzoSvg = function (padre, ancho, alto, extra) {
    const svg = V.svg('svg', Object.assign({ viewBox: `0 0 ${ancho} ${alto}`, role: 'img' }, extra || {}));
    padre.appendChild(VIZ.el('div', { class: 'lienzo-svg' }, svg));
    return svg;
  };

  // Posición del puntero en las unidades de usuario de un <svg> (o de un <g> con transformaciones).
  V.puntoSvg = function (svg, ev, nodo) {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const m = (nodo || svg).getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };

  // Escapa texto para insertarlo como HTML en tooltips o paneles de código.
  V.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
})();
