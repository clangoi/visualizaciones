/* Búsqueda heurística: montículo, el 8-puzzle (estados, heurísticas, A*, IDA*, distancias exactas),
   dibujo de árboles generales y una figura de búsqueda «primero el mejor» sobre un grafo,
   compartidos por los temas de la sección. */
(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Montículo binario mínimo ---------- */

  // Elementos: arreglos [k1, k2, …, dato]; se comparan lexicográficamente por todas las claves salvo la última.
  class Monticulo {
    constructor() { this.d = []; }
    get tam() { return this.d.length; }
    menor(i, j) {
      const a = this.d[i], b = this.d[j];
      for (let k = 0; k < a.length - 1; k++) if (a[k] !== b[k]) return a[k] < b[k];
      return false;
    }
    push(x) {
      const d = this.d;
      d.push(x);
      let i = d.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!this.menor(i, p)) break;
        [d[i], d[p]] = [d[p], d[i]];
        i = p;
      }
    }
    pop() {
      const d = this.d;
      const top = d[0], ult = d.pop();
      if (d.length) {
        d[0] = ult;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < d.length && this.menor(l, m)) m = l;
          if (r < d.length && this.menor(r, m)) m = r;
          if (m === i) break;
          [d[i], d[m]] = [d[m], d[i]];
          i = m;
        }
      }
      return top;
    }
  }

  /* ---------- 8-puzzle ----------
     Un estado es un arreglo de 9 números (0 = hueco) leído por filas. Su código es el número
     decimal de 9 cifras que forman (la meta es 123456780). */

  const META = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  const codigo = (s) => s.reduce((a, v) => a * 10 + v, 0);
  function decodificar(c) {
    const s = new Array(9);
    for (let i = 8; i >= 0; i--) { s[i] = c % 10; c = Math.floor(c / 10); }
    return s;
  }
  const FACT = [40320, 5040, 720, 120, 24, 6, 2, 1, 1];
  // Rango de Lehmer: biyección entre permutaciones de 9 elementos y 0 … 9! − 1.
  function rango(s) {
    let r = 0;
    for (let i = 0; i < 8; i++) {
      let m = 0;
      for (let j = i + 1; j < 9; j++) if (s[j] < s[i]) m++;
      r += m * FACT[i];
    }
    return r;
  }
  // Movimientos del hueco: arriba, abajo, izquierda, derecha (el número que se mueve va en sentido contrario).
  const MOVS = [-3, 3, -1, 1];
  function sucesores(s) {
    const b = s.indexOf(0), r = [];
    for (const d of MOVS) {
      const n = b + d;
      if (n < 0 || n > 8 || (Math.abs(d) === 1 && Math.floor(n / 3) !== Math.floor(b / 3))) continue;
      const t = s.slice();
      t[b] = t[n];
      t[n] = 0;
      r.push({ s: t, ficha: s[n] });
    }
    return r;
  }
  function resoluble(s) {
    let inv = 0;
    const v = s.filter((x) => x);
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i] > v[j]) inv++;
    return inv % 2 === 0;
  }

  function fueraDeLugar(s) {
    let h = 0;
    for (let i = 0; i < 9; i++) if (s[i] && s[i] !== META[i]) h++;
    return h;
  }
  const distFicha = (v, i) => { const j = v - 1; return Math.abs(Math.floor(i / 3) - Math.floor(j / 3)) + Math.abs((i % 3) - (j % 3)); };
  function manhattan(s) {
    let h = 0;
    for (let i = 0; i < 9; i++) if (s[i]) h += distFicha(s[i], i);
    return h;
  }
  // Fichas que hay que sacar de una línea para que las que pertenecen a ella queden en orden: largo − subsecuencia creciente más larga.
  function sacar(objetivos) {
    const n = objetivos.length;
    if (n < 2) return 0;
    const lis = new Array(n).fill(1);
    for (let i = 1; i < n; i++) for (let j = 0; j < i; j++) if (objetivos[j] < objetivos[i]) lis[i] = Math.max(lis[i], lis[j] + 1);
    return n - Math.max(...lis);
  }
  function conflictosLineales(s) {
    let c = 0;
    for (let k = 0; k < 3; k++) {
      const fila = [], col = [];
      for (let j = 0; j < 3; j++) {
        const vf = s[k * 3 + j], vc = s[j * 3 + k];
        if (vf && Math.floor((vf - 1) / 3) === k) fila.push((vf - 1) % 3);
        if (vc && (vc - 1) % 3 === k) col.push(Math.floor((vc - 1) / 3));
      }
      c += sacar(fila) + sacar(col);
    }
    return c;
  }
  const conflictoLineal = (s) => manhattan(s) + 2 * conflictosLineales(s);

  const HEURISTICAS = {
    cero: { nombre: 'Nula (h = 0)', f: () => 0 },
    fuera: { nombre: 'Fichas fuera de lugar', f: fueraDeLugar },
    manhattan: { nombre: 'Manhattan', f: manhattan },
    conflicto: { nombre: 'Manhattan + conflictos lineales', f: conflictoLineal },
  };

  // Distancia exacta a la meta de los 181 440 estados alcanzables (BFS hacia atrás, se calcula una vez).
  let tabla = null, niveles = null;
  function distancias() {
    if (tabla) return tabla;
    tabla = new Int8Array(362880).fill(-1);
    niveles = [];
    const cola = new Int32Array(181440);
    let ini = 0, fin = 0;
    cola[fin++] = codigo(META);
    tabla[rango(META)] = 0;
    while (ini < fin) {
      const c = cola[ini++];
      const s = decodificar(c);
      const d = tabla[rango(s)];
      (niveles[d] = niveles[d] || []).push(c);
      for (const { s: t } of sucesores(s)) {
        const r = rango(t);
        if (tabla[r] < 0) { tabla[r] = d + 1; cola[fin++] = codigo(t); }
      }
    }
    return tabla;
  }
  const hEstrella = (s) => distancias()[rango(s)];
  const porNivel = () => { distancias(); return niveles; };
  // Estado al azar cuya solución óptima tiene exactamente d movimientos.
  function aDistancia(rnd, d) {
    const nv = porNivel();
    const l = nv[Math.max(0, Math.min(nv.length - 1, d))];
    return decodificar(l[Math.floor(rnd() * l.length)]);
  }

  /* A* (y variantes) sobre el 8-puzzle. op: { peso = 1, voraz = false, limite } */
  function aEstrella(s0, h, op = {}) {
    const peso = op.peso ?? 1, limite = op.limite ?? 5e5;
    const g = new Map(), padre = new Map(), cerrado = new Set();
    const pq = new Monticulo();
    const c0 = codigo(s0);
    g.set(c0, 0);
    padre.set(c0, -1);
    const h0 = h(s0);
    pq.push([op.voraz ? h0 : peso * h0, h0, 0, c0]);
    let orden = 0, expandidos = 0, generados = 1, memoria = 1;
    while (pq.tam) {
      const [, , , c] = pq.pop();
      if (cerrado.has(c)) continue;
      cerrado.add(c);
      expandidos++;
      if (c === 123456780) {
        const camino = [];
        for (let x = c; x !== -1; x = padre.get(x)) camino.push(decodificar(x));
        camino.reverse();
        return { camino, costo: camino.length - 1, expandidos, generados, memoria };
      }
      if (expandidos > limite) break;
      const gc = g.get(c);
      for (const { s: t } of sucesores(decodificar(c))) {
        const ct = codigo(t);
        if (cerrado.has(ct)) continue;
        generados++;
        const ng = gc + 1;
        if (g.has(ct) && g.get(ct) <= ng) continue;
        g.set(ct, ng);
        padre.set(ct, c);
        const ht = h(t);
        pq.push([op.voraz ? ht : ng + peso * ht, ht, ++orden, ct]);
      }
      memoria = Math.max(memoria, g.size);
    }
    return { camino: null, costo: Infinity, expandidos, generados, memoria, detenido: expandidos > limite };
  }

  /* IDA*: búsquedas en profundidad con umbral creciente sobre f = g + h. No deshace el último movimiento. */
  function idaEstrella(s0, h, op = {}) {
    const limite = op.limite ?? 3e6;
    const iteraciones = [];
    let umbral = h(s0), total = 0, detenido = false;
    const s = s0.slice();
    let solucion = -1;
    for (let it = 0; it < 60 && solucion < 0 && !detenido; it++) {
      let generados = 0, siguiente = Infinity;
      const dfs = (g, previo) => {
        const f = g + h(s);
        if (f > umbral) { siguiente = Math.min(siguiente, f); return false; }
        if (s.every((v, i) => v === META[i])) { solucion = g; return true; }
        const b = s.indexOf(0);
        for (const d of MOVS) {
          const n = b + d;
          if (n === previo || n < 0 || n > 8 || (Math.abs(d) === 1 && Math.floor(n / 3) !== Math.floor(b / 3))) continue;
          generados++;
          if (total + generados > limite) { detenido = true; return false; }
          s[b] = s[n]; s[n] = 0;
          const ok = dfs(g + 1, b);
          s[n] = s[b]; s[b] = 0;
          if (ok || detenido) return ok;
        }
        return false;
      };
      dfs(0, -1);
      total += generados;
      iteraciones.push({ umbral, generados, encontrado: solucion >= 0 });
      umbral = siguiente;
      if (!Number.isFinite(umbral)) break;
    }
    return { iteraciones, total, costo: solucion, detenido };
  }

  /* Dibuja un tablero de 3 × 3. o: { relleno(v, i), texto(v, i), esquina(v, i) → texto pequeño } */
  function dibujarTablero(ctx, s, x, y, lado, o = {}) {
    const c = lado / 3, gap = Math.max(2, c * 0.05);
    ctx.save();
    ctx.fillStyle = C.neutro;
    ctx.fillRect(x, y, lado, lado);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    s.forEach((v, i) => {
      if (!v) return;
      const px = x + (i % 3) * c + gap, py = y + Math.floor(i / 3) * c + gap, w = c - 2 * gap;
      ctx.fillStyle = (o.relleno && o.relleno(v, i)) || C.superficie;
      ctx.beginPath();
      ctx.roundRect(px, py, w, w, 4);
      ctx.fill();
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = (o.texto && o.texto(v, i)) || C.tinta;
      ctx.font = VIZ.fuente(Math.max(12, Math.min(26, c * 0.38)), 500);
      ctx.fillText(String(v), px + w / 2, py + w / 2 + 1);
      const esq = o.esquina && o.esquina(v, i);
      if (esq != null && c >= 34) {
        ctx.font = VIZ.fuente(10);
        ctx.fillStyle = (o.colorEsquina && o.colorEsquina(v, i)) || C.tinta2;
        ctx.textAlign = 'right';
        ctx.fillText(esq, px + w - 4, py + 9);
        ctx.textAlign = 'center';
      }
    });
    ctx.strokeStyle = C.tinta;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, lado - 1, lado - 1);
    ctx.restore();
  }
  // Casilla del tablero bajo (px, py), o −1.
  function casillaEn(px, py, x, y, lado) {
    if (px < x || py < y || px >= x + lado || py >= y + lado) return -1;
    return Math.floor((py - y) / (lado / 3)) * 3 + Math.floor((px - x) / (lado / 3));
  }
  // Mueve la ficha de la casilla i si es vecina del hueco; devuelve el nuevo estado o null.
  function mover(s, i) {
    const b = s.indexOf(0);
    if (i < 0 || !(Math.abs(i - b) === 3 || (Math.abs(i - b) === 1 && Math.floor(i / 3) === Math.floor(b / 3)))) return null;
    const t = s.slice();
    t[b] = t[i];
    t[i] = 0;
    return t;
  }
  // Paseo aleatorio de k movimientos sin deshacer el anterior.
  function mezclar(rnd, k, s = META) {
    let t = s.slice(), previo = -1;
    for (let i = 0; i < k; i++) {
      const b = t.indexOf(0);
      const op = sucesores(t).filter((x) => x.s.indexOf(0) !== previo);
      t = op[Math.floor(rnd() * op.length)].s;
      previo = b;
    }
    return t;
  }

  /* ---------- Árboles generales ----------
     Nodos { hijos: [] }. Las hojas se reparten a lo ancho y cada padre se centra sobre sus hijos.
     o: { x0, y0, ancho, dy, radio, visible(n), estilo(n) → {relleno, borde, texto, anillo, guiones},
          forma(n) → 'circulo' | 'cuadro' | 'max' | 'min', etiqueta(n), debajo(n), colorDebajo(n),
          arista(p, h) → {color, ancho, guiones, texto, colorTexto} } */
  function dibujarArbol(ctx, raiz, o) {
    const pos = new Map();
    let hojas = 0;
    (function contar(n, d) {
      if (!n.hijos || !n.hijos.length) { pos.set(n, { i: hojas++, d }); return; }
      n.hijos.forEach((h) => contar(h, d + 1));
      const a = pos.get(n.hijos[0]).i, b = pos.get(n.hijos[n.hijos.length - 1]).i;
      pos.set(n, { i: (a + b) / 2, d });
    })(raiz, 0);
    const paso = o.ancho / Math.max(1, hojas);
    const r = o.radio || Math.max(7, Math.min(15, paso * 0.38));
    for (const p of pos.values()) { p.x = o.x0 + (p.i + 0.5) * paso; p.y = o.y0 + p.d * o.dy; }
    const visible = o.visible || (() => true);
    // Aristas
    for (const [n, p] of pos) {
      if (!n.hijos || !visible(n)) continue;
      for (const h of n.hijos) {
        if (!visible(h)) continue;
        const q = pos.get(h);
        const est = (o.arista && o.arista(n, h)) || {};
        ctx.save();
        ctx.strokeStyle = est.color || C.eje;
        ctx.lineWidth = est.ancho || 1.5;
        if (est.guiones) ctx.setLineDash(est.guiones);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + r);
        ctx.lineTo(q.x, q.y - r);
        ctx.stroke();
        ctx.restore();
        if (est.texto != null) {
          const mx = (p.x + q.x) / 2, my = (p.y + r + q.y - r) / 2;
          ctx.font = VIZ.fuente(10, 500);
          const tw = ctx.measureText(est.texto).width + 6;
          ctx.fillStyle = C.superficie;
          ctx.fillRect(mx - tw / 2, my - 7, tw, 14);
          ctx.fillStyle = est.colorTexto || C.tinta2;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(est.texto, mx, my + 0.5);
        }
      }
    }
    // Nodos
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [n, p] of pos) {
      if (!visible(n)) continue;
      const est = (o.estilo && o.estilo(n)) || {};
      const forma = (o.forma && o.forma(n)) || 'circulo';
      const trazar = (rr) => {
        ctx.beginPath();
        if (forma === 'cuadro') ctx.rect(p.x - rr * 0.9, p.y - rr * 0.9, rr * 1.8, rr * 1.8);
        else if (forma === 'max' || forma === 'min') {
          const s = forma === 'max' ? 1 : -1, k = rr * 1.25;
          ctx.moveTo(p.x, p.y - s * k);
          ctx.lineTo(p.x + k * 0.98, p.y + s * k * 0.62);
          ctx.lineTo(p.x - k * 0.98, p.y + s * k * 0.62);
          ctx.closePath();
        } else ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      };
      if (est.anillo) {
        ctx.save();
        trazar(r + 4.5);
        ctx.lineWidth = 3;
        ctx.strokeStyle = est.anillo;
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      trazar(r);
      ctx.fillStyle = est.relleno || C.superficie;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = est.borde || C.tinta;
      if (est.guiones) ctx.setLineDash(est.guiones);
      ctx.stroke();
      ctx.restore();
      const txt = o.etiqueta ? o.etiqueta(n) : '';
      if (txt !== '' && txt != null) {
        ctx.fillStyle = est.texto || C.tinta;
        ctx.font = VIZ.fuente(r >= 12 ? 12 : 10, 500);
        ctx.fillText(txt, p.x, p.y + (forma === 'max' ? 3 : forma === 'min' ? -3 : 0.5));
      }
      const bajo = o.debajo && o.debajo(n);
      if (bajo != null && bajo !== '') {
        ctx.font = VIZ.fuente(10, 500);
        const tw = ctx.measureText(bajo).width + 6;
        const by = p.y + r + (forma === 'max' ? 3 : forma === 'min' ? 7 : 5) + 6;
        ctx.fillStyle = VIZ.alfa(C.superficie, 0.9);
        ctx.fillRect(p.x - tw / 2, by - 7, tw, 14);
        ctx.fillStyle = (o.colorDebajo && o.colorDebajo(n)) || C.tinta2;
        ctx.fillText(bajo, p.x, by + 0.5);
      }
    }
    return { pos, r };
  }
  function nodoArbolEn(geo, x, y) {
    if (!geo) return null;
    let mejor = null, dm = geo.r + 5;
    for (const [n, p] of geo.pos) { const d = Math.hypot(p.x - x, p.y - y); if (d < dm) { dm = d; mejor = n; } }
    return mejor;
  }

  /* ---------- Cálculo por partes ----------
     Ejecuta un generador en tramos de ~20 ms para no congelar la página; alAvanzar() se llama tras cada tramo.
     Devuelve una función que cancela el cálculo. */
  function porPartes(gen, alAvanzar, alTerminar) {
    let vivo = true;
    const tramo = () => {
      if (!vivo) return;
      const t0 = performance.now();
      let r;
      do r = gen.next(); while (!r.done && performance.now() - t0 < 20);
      if (alAvanzar) alAvanzar();
      if (r.done) { vivo = false; if (alTerminar) alTerminar(); } else setTimeout(tramo, 0);
    };
    setTimeout(tramo, 0);
    return () => { vivo = false; };
  }

  /* ---------- Figura: primero el mejor sobre un grafo ----------
     cfg: { estrategias: [[id, nombre]], estrategia, heuristicas: [[id, nombre]], heuristica, semilla } */
  const ESTRATEGIAS = {
    bfs: { clave: 'orden', nombre: 'anchura' },
    dfs: { clave: 'orden', nombre: 'profundidad' },
    ucs: { clave: 'g', nombre: 'costo uniforme' },
    voraz: { clave: 'h', nombre: 'voraz' },
    astar: { clave: 'f', nombre: 'A*' },
  };
  const K = 11; // unidades de costo por unidad de distancia en el plano

  function figuraGrafo(cuerpo, cfg) {
    const G = VIZ.grafo;
    let estrategia = cfg.estrategia, heur = cfg.heuristica || 'euclidea';
    let n = 9, semilla = cfg.semilla || 3;
    let g = null, ady = null, s = 0, t = 0, hv = [];
    // Estado de la búsqueda
    let gv = [], padre = [], est = [], abierta = [], actual = -1, camino = [], examinada = -1;
    let expandidos = 0, generados = 0, optimo = Infinity, mensaje = '', fin = false;

    const ctl = VIZ.controles(cuerpo);
    if (cfg.estrategias.length > 1) ctl.selector({ etiqueta: 'Estrategia', opciones: cfg.estrategias, valor: estrategia, alCambiar: (v) => { estrategia = v; rep.reiniciar(); } });
    if (cfg.heuristicas && cfg.heuristicas.length > 1) ctl.selector({ etiqueta: 'Heurística', opciones: cfg.heuristicas, valor: heur, alCambiar: (v) => { heur = v; calcularH(); rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Vértices', min: 6, max: 13, valor: n, alCambiar: (v) => { n = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevo grafo', () => { semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.52, altoMin: 320, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.s6, texto: 'inicio', forma: 'punto' },
      { color: C.superficie, borde: C.s8, texto: 'meta', forma: 'punto' },
      { color: C.s4, texto: 'en la frontera (ABIERTA)' },
      { color: C.s1, texto: 'expandido (CERRADA)' },
      { color: C.superficie, borde: C.s2, texto: 'se expande ahora', forma: 'punto' },
      { color: C.s2, texto: 'camino encontrado', forma: 'linea' },
    ]);
    const abiertaUI = G.estructura(cuerpo, 'ABIERTA:');
    const cerradaUI = G.estructura(cuerpo, 'CERRADA:');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Bajo cada vértice aparece su heurística h y, cuando ya se descubrió, g (costo pagado desde el inicio). Haga clic en un vértice para elegirlo como meta; Mayús + clic lo elige como inicio.');

    const L = (i) => g.nodos[i].etiqueta;
    const plano = (i) => ({ x: g.nodos[i].x * 1.6, y: g.nodos[i].y });
    const eu = (i, j) => { const a = plano(i), b = plano(j); return Math.hypot(a.x - b.x, a.y - b.y); };

    function nuevo() {
      g = G.generar({ n, grado: 2.6, semilla: semilla * 7 + n });
      const rnd = VIZ.semilla(semilla * 13 + n);
      // Pesos ≥ distancia en el plano: la heurística euclídea queda admisible y consistente.
      for (const a of g.aristas) a.w = Math.ceil(K * eu(a.u, a.v)) + Math.floor(rnd() * 4);
      ady = G.adyacencia(g);
      s = 0;
      t = g.nodos.length - 1;
      calcularH();
      rep.reiniciar();
    }
    function calcularH() {
      hv = g.nodos.map((_, i) => {
        const e = Math.floor(K * eu(i, t));
        return heur === 'nula' ? 0 : heur === 'doble' ? 2 * e : heur === 'exacta' ? distancia(i, t) : e;
      });
    }
    function distancia(a, b) {
      const d = g.nodos.map(() => Infinity), hecho = g.nodos.map(() => false);
      d[a] = 0;
      for (;;) {
        let u = -1;
        d.forEach((x, i) => { if (!hecho[i] && x < Infinity && (u < 0 || x < d[u])) u = i; });
        if (u < 0) return d[b];
        hecho[u] = true;
        for (const { v, w } of ady[u]) d[v] = Math.min(d[v], d[u] + w);
      }
    }
    const clave = (e) => {
      const k = ESTRATEGIAS[estrategia].clave;
      return k === 'orden' ? e.orden : k === 'g' ? gv[e.v] : k === 'h' ? hv[e.v] : gv[e.v] + hv[e.v];
    };
    function ordenAbierta() {
      const a = abierta.slice();
      if (estrategia === 'bfs') a.sort((p, q) => p.orden - q.orden);
      else if (estrategia === 'dfs') a.sort((p, q) => q.orden - p.orden);
      else a.sort((p, q) => clave(p) - clave(q) || hv[p.v] - hv[q.v] || p.orden - q.orden);
      return a;
    }
    const nombreClave = () => ({ g: 'g', h: 'h', f: 'f' })[ESTRATEGIAS[estrategia].clave];

    function iniciar() {
      const N = g.nodos.length;
      gv = new Array(N).fill(Infinity);
      padre = new Array(N).fill(-1);
      est = new Array(N).fill(0);
      gv[s] = 0;
      est[s] = 1;
      abierta = [{ v: s, orden: 0 }];
      actual = -1; examinada = -1; camino = []; expandidos = 0; generados = 1; fin = false;
      optimo = distancia(s, t);
      mensaje = `ABIERTA contiene solo el inicio ${L(s)}. Estrategia: ${ESTRATEGIAS[estrategia].nombre}.`;
      return (function* () {
        let orden = 1;
        while (abierta.length) {
          const e = ordenAbierta()[0];
          abierta = abierta.filter((x) => x !== e);
          const u = e.v;
          actual = u;
          examinada = -1;
          est[u] = 2;
          if (u === t) {
            for (let v = t; v !== -1; v = padre[v]) camino.push(v);
            camino.reverse();
            fin = true;
            mensaje = `Se extrae la meta ${L(t)} con g = ${gv[t]}: termina. Camino ${camino.map(L).join('–')}` +
              (gv[t] === optimo ? ' (óptimo).' : `, pero el óptimo cuesta ${optimo}.`);
            yield;
            return;
          }
          expandidos++;
          const nuevos = [], mejorados = [];
          for (const { v, w, e: ar } of ady[u]) {
            if (est[v] === 2) continue;
            const ng = gv[u] + w;
            if (est[v] === 0) {
              est[v] = 1; gv[v] = ng; padre[v] = u;
              abierta.push({ v, orden: orden++ });
              generados++;
              nuevos.push(L(v));
              examinada = ar;
            } else if (estrategia !== 'bfs' && estrategia !== 'dfs' && ng < gv[v]) {
              gv[v] = ng; padre[v] = u;
              mejorados.push(L(v));
              examinada = ar;
            }
          }
          const k = ESTRATEGIAS[estrategia].clave;
          mensaje = `Se expande ${L(u)}` + (k === 'orden' ? '' : ` (${nombreClave()} = ${k === 'g' ? gv[u] : k === 'h' ? hv[u] : `${gv[u]} + ${hv[u]} = ${gv[u] + hv[u]}`})`) +
            `. ${nuevos.length ? `Entran a ABIERTA: ${nuevos.join(', ')}.` : 'No hay vecinos nuevos.'}` +
            (mejorados.length ? ` Se mejora g de ${mejorados.join(', ')}.` : '');
          yield;
        }
        actual = -1;
        mensaje = 'ABIERTA quedó vacía: no hay camino.';
      })();
    }

    let geo = null;
    function dibujar() {
      if (!g) return;
      lienzo.limpiar();
      const enCamino = new Set();
      for (let i = 1; i < camino.length; i++) enCamino.add(`${Math.min(camino[i - 1], camino[i])}-${Math.max(camino[i - 1], camino[i])}`);
      geo = G.dibujar(lienzo, g, {
        pesos: true,
        arista: (a) => {
          const k = `${Math.min(a.u, a.v)}-${Math.max(a.u, a.v)}`;
          if (enCamino.has(k)) return { color: C.s2, ancho: 4 };
          if ((padre[a.v] === a.u || padre[a.u] === a.v) && est[a.u] && est[a.v]) return { color: C.s1, ancho: 3 };
          return null;
        },
        nodo: (i) => {
          const r = est[i] === 2 ? { relleno: C.s1, texto: C.sobre, borde: C.s1 } : est[i] === 1 ? { relleno: C.s4 } : {};
          if (i === actual && !fin) r.anillo = C.s2;
          else if (i === s) r.anillo = C.s6;
          else if (i === t) r.anillo = C.s8;
          return r;
        },
        debajo: (i) => (gv[i] < Infinity ? `g${gv[i]} h${hv[i]}` : `h${hv[i]}`),
      });
      const k = ESTRATEGIAS[estrategia].clave;
      abiertaUI.set(ordenAbierta().map((e) => ({ texto: k === 'orden' ? L(e.v) : `${L(e.v)} ${clave(e)}`, fondo: VIZ.alfa(C.s4, 0.25), color: C.s4 })));
      abiertaUI.titulo(k === 'orden' ? (estrategia === 'bfs' ? 'ABIERTA (cola):' : 'ABIERTA (pila, tope a la izquierda):') : `ABIERTA (ordenada por ${nombreClave()}):`);
      cerradaUI.set(est.map((x, i) => (x === 2 ? i : -1)).filter((i) => i >= 0).map((i) => ({ texto: L(i), color: C.s1 })), 'vacía');
      registro.textContent = mensaje;
      lectura.set([
        ['expandidos', String(expandidos)],
        ['generados', String(generados)],
        ['costo encontrado', fin ? String(gv[t]) : '—'],
        ['costo óptimo', optimo === Infinity ? '∞' : String(optimo)],
        ['¿óptimo?', fin ? (gv[t] === optimo ? 'sí' : 'no') : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i < 0) return;
      if (ev.shiftKey) { if (i !== t) s = i; } else if (i !== s) { t = i; calcularH(); }
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i < 0) return tip.ocultar();
      const f = gv[i] + hv[i];
      tip.mostrar(x, y, `vértice <b>${L(i)}</b><br>h = <b>${hv[i]}</b> · h* = <b>${distancia(i, t)}</b>` +
        (gv[i] < Infinity ? `<br>g = <b>${gv[i]}</b> · f = g + h = <b>${f}</b>` : '<br>aún no descubierto'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());

    nuevo();
  }

  VIZ.busqueda = {
    Monticulo, porPartes, dibujarArbol, nodoArbolEn, figuraGrafo,
    puzzle: {
      META, codigo, decodificar, rango, sucesores, resoluble, fueraDeLugar, manhattan, distFicha, conflictosLineales, conflictoLineal,
      HEURISTICAS, distancias, hEstrella, porNivel, aDistancia, aEstrella, idaEstrella, dibujarTablero, casillaEn, mover, mezclar,
    },
  };
})();
