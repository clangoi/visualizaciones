(function () {
  'use strict';
  const { el, color: C } = VIZ;

  const COLUMNAS = 41, FILAS = 23;
  const N = COLUMNAS * FILAS;
  const COSTO_BARRO = 5;
  const BARRO = '#d8cfbd';

  const ALGORITMOS = [
    ['bfs', 'Búsqueda en anchura (BFS)'],
    ['dfs', 'Búsqueda en profundidad (DFS)'],
    ['dijkstra', 'Dijkstra'],
    ['voraz', 'Primero el mejor (voraz)'],
    ['astar', 'A*'],
  ];

  /* Montículo binario mínimo con claves [prioridad, desempate, orden]. */
  class Monticulo {
    constructor() { this.d = []; }
    get tam() { return this.d.length; }
    menor(i, j) {
      const a = this.d[i], b = this.d[j];
      return a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
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

  function montar(cuerpo) {
    const muro = new Uint8Array(N);
    const costo = new Uint8Array(N).fill(1);
    let inicio = idx(11, 6), fin = idx(11, 34);

    // Estado de la búsqueda.
    const dist = new Float64Array(N);
    const padre = new Int32Array(N);
    const estado = new Uint8Array(N); // 0 nada · 1 frontera · 2 cerrado
    let camino = [], expandidos = 0, gen = null, terminado = false, maxDist = 1, optimo = null;

    let alg = 'astar', heur = 'manhattan', peso = 1, velocidad = 4, herramienta = 'muro';

    function idx(f, c) { return f * COLUMNAS + c; }
    const fila = (i) => Math.floor(i / COLUMNAS);
    const col = (i) => i % COLUMNAS;

    function vecinos(u) {
      const f = fila(u), c = col(u), r = [];
      if (f > 0) r.push(u - COLUMNAS);
      if (c < COLUMNAS - 1) r.push(u + 1);
      if (f < FILAS - 1) r.push(u + COLUMNAS);
      if (c > 0) r.push(u - 1);
      return r;
    }
    function h(u, tipo = heur) {
      const df = Math.abs(fila(u) - fila(fin)), dc = Math.abs(col(u) - col(fin));
      if (tipo === 'manhattan') return df + dc;
      if (tipo === 'euclidea') return Math.hypot(df, dc);
      return 0;
    }

    function* buscar(algoritmo, contar) {
      dist.fill(Infinity);
      padre.fill(-1);
      estado.fill(0);
      dist[inicio] = 0;
      estado[inicio] = 1;
      let n = 0;
      if (algoritmo === 'bfs' || algoritmo === 'dfs') {
        const lista = [inicio];
        let cabeza = 0;
        while (cabeza < lista.length) {
          const u = algoritmo === 'bfs' ? lista[cabeza++] : lista.pop();
          if (estado[u] === 2) continue;
          estado[u] = 2;
          n++;
          if (contar) expandidos = n;
          if (u === fin) break;
          const vs = vecinos(u);
          if (algoritmo === 'dfs') vs.reverse();
          for (const v of vs) {
            if (muro[v] || estado[v] === 2) continue;
            if (algoritmo === 'bfs' && estado[v] === 1) continue;
            dist[v] = dist[u] + costo[v];
            padre[v] = u;
            estado[v] = 1;
            lista.push(v);
          }
          yield;
        }
      } else {
        const pq = new Monticulo();
        let orden = 0;
        const prioridad = (v) => algoritmo === 'dijkstra' ? dist[v] : algoritmo === 'voraz' ? h(v) : dist[v] + peso * h(v);
        pq.push([prioridad(inicio), h(inicio), orden++, inicio]);
        while (pq.tam) {
          const u = pq.pop()[3];
          if (estado[u] === 2) continue;
          estado[u] = 2;
          n++;
          if (contar) expandidos = n;
          if (u === fin) break;
          for (const v of vecinos(u)) {
            if (muro[v] || estado[v] === 2) continue;
            const nd = dist[u] + costo[v];
            if (nd < dist[v]) {
              dist[v] = nd;
              padre[v] = u;
              estado[v] = 1;
              pq.push([prioridad(v), h(v), orden++, v]);
            }
          }
          yield;
        }
      }
    }

    function costoOptimo() {
      // Dijkstra independiente para comparar el costo obtenido con el mínimo.
      const d = new Float64Array(N).fill(Infinity);
      const cerrado = new Uint8Array(N);
      const pq = new Monticulo();
      d[inicio] = 0;
      pq.push([0, 0, 0, inicio]);
      let k = 0;
      while (pq.tam) {
        const u = pq.pop()[3];
        if (cerrado[u]) continue;
        cerrado[u] = 1;
        if (u === fin) return d[u];
        for (const v of vecinos(u)) {
          if (muro[v]) continue;
          const nd = d[u] + costo[v];
          if (nd < d[v]) { d[v] = nd; pq.push([nd, 0, ++k, v]); }
        }
      }
      return Infinity;
    }

    function reconstruir() {
      camino = [];
      if (estado[fin] !== 2) return;
      for (let v = fin; v !== -1; v = padre[v]) camino.push(v);
      camino.reverse();
    }

    function limpiarBusqueda() {
      bucle.detener();
      gen = null;
      terminado = false;
      camino = [];
      expandidos = 0;
      estado.fill(0);
      dist.fill(Infinity);
      dibujar();
    }

    function ejecutarCompleto() {
      const g = buscar(alg, true);
      while (!g.next().done);
      finalizar();
    }
    function finalizar() {
      terminado = true;
      gen = null;
      reconstruir();
      optimo = costoOptimo();
      maxDist = 1;
      for (let i = 0; i < N; i++) if (estado[i] && dist[i] < Infinity) maxDist = Math.max(maxDist, dist[i]);
      dibujar();
    }

    function iniciarAnimacion() {
      bucle.detener();
      gen = buscar(alg, true);
      terminado = false;
      camino = [];
      const opt = costoOptimo();
      maxDist = Number.isFinite(opt) ? Math.max(1, opt) : 60;
      bPlay.textContent = 'Pausar';
      bucle.iniciar();
    }

    const bucle = VIZ.bucle(() => {
      const pasos = Math.max(1, Math.round(Math.pow(1.9, velocidad - 1)));
      for (let k = 0; k < pasos; k++) {
        if (gen.next().done) { finalizar(); return false; }
      }
      dibujar();
      return true;
    }, () => { bPlay.textContent = 'Buscar'; });

    /* --- Generadores de escenarios --- */

    function escenarioInicial() {
      muro.fill(0);
      costo.fill(1);
      for (let f = 3; f < FILAS - 3; f++) muro[idx(f, 20)] = 1;
      for (let c = 14; c <= 20; c++) muro[idx(3, c)] = 1;
      for (let c = 20; c <= 26; c++) muro[idx(FILAS - 4, c)] = 1;
      for (let f = 6; f < 17; f++) for (let c = 25; c < 30; c++) costo[idx(f, c)] = COSTO_BARRO;
      inicio = idx(11, 6);
      fin = idx(11, 34);
    }
    function laberinto() {
      muro.fill(1);
      costo.fill(1);
      const rnd = Math.random;
      const pila = [[1, 1]];
      muro[idx(1, 1)] = 0;
      while (pila.length) {
        const [f, c] = pila[pila.length - 1];
        const opciones = [[-2, 0], [2, 0], [0, -2], [0, 2]]
          .map(([df, dc]) => [f + df, c + dc, f + df / 2, c + dc / 2])
          .filter(([nf, nc]) => nf > 0 && nf < FILAS - 1 && nc > 0 && nc < COLUMNAS - 1 && muro[idx(nf, nc)]);
        if (!opciones.length) { pila.pop(); continue; }
        const [nf, nc, mf, mc] = opciones[Math.floor(rnd() * opciones.length)];
        muro[idx(mf, mc)] = 0;
        muro[idx(nf, nc)] = 0;
        pila.push([nf, nc]);
      }
      // Abre algunos muros para crear ciclos: así los algoritmos difieren.
      for (let k = 0; k < 70; k++) {
        const f = 1 + Math.floor(rnd() * (FILAS - 2)), c = 1 + Math.floor(rnd() * (COLUMNAS - 2));
        if ((f + c) % 2 === 1) muro[idx(f, c)] = 0;
      }
      inicio = idx(1, 1);
      fin = idx(FILAS - 2, COLUMNAS - 2);
    }
    function aleatorio() {
      muro.fill(0);
      costo.fill(1);
      for (let i = 0; i < N; i++) {
        const r = Math.random();
        if (r < 0.27) muro[i] = 1;
        else if (r < 0.37) costo[i] = COSTO_BARRO;
      }
      muro[inicio] = muro[fin] = 0;
    }

    /* --- Controles --- */

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', opciones: ALGORITMOS, valor: alg, alCambiar: (v) => { alg = v; recalcular(); } });
    ctl.selector({ etiqueta: 'Heurística (voraz, A*)', opciones: [['manhattan', 'Manhattan |Δf|+|Δc|'], ['euclidea', 'Euclídea'], ['nula', 'Nula (h = 0)']], valor: heur,
      alCambiar: (v) => { heur = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Peso w de la heurística (A*)', min: 1, max: 5, paso: 0.25, valor: peso, formato: (v) => v.toFixed(2),
      alCambiar: (v) => { peso = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Velocidad', min: 1, max: 10, valor: velocidad, alCambiar: (v) => { velocidad = v; } });
    ctl.selector({ etiqueta: 'Pincel', opciones: [['muro', 'Muro'], ['barro', `Barro (costo ${COSTO_BARRO})`], ['borrar', 'Borrar']], valor: herramienta,
      alCambiar: (v) => { herramienta = v; } });
    const bPlay = ctl.boton('Buscar', () => (bucle.activo ? bucle.detener() : iniciarAnimacion()), { primario: true });
    ctl.boton('Resultado inmediato', () => { bucle.detener(); ejecutarCompleto(); });
    ctl.boton('Limpiar búsqueda', limpiarBusqueda);
    ctl.boton('Laberinto', () => { laberinto(); limpiarBusqueda(); });
    ctl.boton('Obstáculos aleatorios', () => { aleatorio(); limpiarBusqueda(); });
    ctl.boton('Vaciar', () => { muro.fill(0); costo.fill(1); limpiarBusqueda(); });
    ctl.boton('Escenario inicial', () => { escenarioInicial(); limpiarBusqueda(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.floor(w / COLUMNAS) * FILAS });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'inicio' },
      { color: C.s8, texto: 'meta' },
      { color: C.tinta, texto: 'muro' },
      { color: BARRO, texto: `barro (costo ${COSTO_BARRO})` },
      { color: VIZ.rampa[2], texto: 'expandido, cerca' },
      { color: VIZ.rampa[11], texto: 'expandido, lejos' },
      { color: C.s4, texto: 'frontera' },
      { color: C.s2, texto: 'camino', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dibuje arrastrando sobre la cuadrícula; arrastre los cuadros verde y rojo para mover el inicio y la meta. Tras una búsqueda completa, cada edición recalcula el resultado al instante. Pase el cursor sobre una celda para ver g, h y f.');

    function recalcular() {
      if (terminado) ejecutarCompleto();
      else if (gen) iniciarAnimacion();
      else dibujar();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar(C.superficie);
      const cs = Math.floor(W / COLUMNAS);
      const ox = Math.floor((W - cs * COLUMNAS) / 2);
      geo = { cs, ox };
      const md = maxDist;
      for (let i = 0; i < N; i++) {
        const x = ox + col(i) * cs, y = fila(i) * cs;
        let fondo = null;
        if (costo[i] > 1) fondo = BARRO;
        if (estado[i] === 2) {
          const t = Math.min(1, dist[i] / md);
          const rgb = VIZ.enRampa(0.12 + 0.8 * t);
          fondo = costo[i] > 1 ? VIZ.css(rgb.map((v, k) => v * 0.75 + VIZ.rgb(BARRO)[k] * 0.25 - 25)) : VIZ.css(rgb);
        } else if (estado[i] === 1) fondo = C.s4;
        if (muro[i]) fondo = C.tinta;
        if (fondo) {
          ctx.fillStyle = fondo;
          ctx.fillRect(x, y, cs, cs);
        }
        if (costo[i] > 1 && !muro[i] && cs >= 10) {
          ctx.fillStyle = VIZ.alfa(C.tinta2, 0.45);
          ctx.fillRect(x + cs * 0.3, y + cs * 0.3, 1.5, 1.5);
          ctx.fillRect(x + cs * 0.65, y + cs * 0.6, 1.5, 1.5);
        }
      }
      // Rejilla
      if (cs >= 8) {
        ctx.strokeStyle = VIZ.alfa(C.tinta, 0.07);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 0; c <= COLUMNAS; c++) { ctx.moveTo(ox + c * cs + 0.5, 0); ctx.lineTo(ox + c * cs + 0.5, FILAS * cs); }
        for (let f = 0; f <= FILAS; f++) { ctx.moveTo(ox, f * cs + 0.5); ctx.lineTo(ox + COLUMNAS * cs, f * cs + 0.5); }
        ctx.stroke();
      }
      // Camino
      if (camino.length > 1) {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = C.superficie;
        ctx.lineWidth = Math.max(4, cs * 0.42) + 3;
        const trazo = () => {
          ctx.beginPath();
          camino.forEach((v, k) => {
            const x = ox + col(v) * cs + cs / 2, y = fila(v) * cs + cs / 2;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          });
          ctx.stroke();
        };
        trazo();
        ctx.strokeStyle = C.s2;
        ctx.lineWidth = Math.max(3, cs * 0.42);
        trazo();
        ctx.restore();
      }
      // Inicio y meta
      for (const [i, c] of [[inicio, C.s6], [fin, C.s8]]) {
        const x = ox + col(i) * cs, y = fila(i) * cs;
        ctx.fillStyle = c;
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        ctx.strokeStyle = C.superficie;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
      }
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, 0.5, cs * COLUMNAS - 1, cs * FILAS - 1);

      let frontera = 0;
      for (let i = 0; i < N; i++) if (estado[i] === 1) frontera++;
      const costoCamino = camino.length ? dist[fin] : null;
      lectura.set([
        ['expandidos', VIZ.entero(expandidos)],
        ['en frontera', VIZ.entero(frontera)],
        ['largo del camino', camino.length ? `${camino.length - 1} pasos` : terminado ? 'sin camino' : '—'],
        ['costo del camino', costoCamino != null ? VIZ.entero(costoCamino) : '—'],
        ['costo óptimo', terminado && optimo != null ? (optimo === Infinity ? '∞' : VIZ.entero(optimo)) : '—'],
        ['¿óptimo?', terminado && camino.length ? (Math.abs(costoCamino - optimo) < 1e-9 ? 'sí' : 'no') : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    /* --- Interacción con el puntero --- */

    let arrastre = null; // 'inicio' | 'fin' | {valor}
    const celdaEn = (ev) => {
      if (!geo) return -1;
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.ox) / geo.cs), f = Math.floor(y / geo.cs);
      if (c < 0 || c >= COLUMNAS || f < 0 || f >= FILAS) return -1;
      return idx(f, c);
    };
    function pintar(i) {
      if (i < 0 || i === inicio || i === fin) return;
      if (arrastre.tipo === 'muro') { muro[i] = arrastre.valor; if (arrastre.valor) costo[i] = 1; }
      else if (arrastre.tipo === 'barro') { costo[i] = arrastre.valor ? COSTO_BARRO : 1; if (arrastre.valor) muro[i] = 0; }
      else { muro[i] = 0; costo[i] = 1; }
    }
    function trasEditar() {
      if (terminado) ejecutarCompleto();
      else if (gen) { bucle.detener(); gen = null; estado.fill(0); camino = []; expandidos = 0; dibujar(); }
      else dibujar();
    }
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const i = celdaEn(ev);
      if (i < 0) return;
      lienzo.canvas.setPointerCapture(ev.pointerId);
      tip.ocultar();
      if (i === inicio) arrastre = { tipo: 'inicio' };
      else if (i === fin) arrastre = { tipo: 'fin' };
      else {
        const valor = herramienta === 'muro' ? (muro[i] ? 0 : 1) : herramienta === 'barro' ? (costo[i] > 1 ? 0 : 1) : 0;
        arrastre = { tipo: herramienta, valor };
        pintar(i);
        trasEditar();
      }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = celdaEn(ev);
      if (arrastre) {
        if (i < 0) return;
        if (arrastre.tipo === 'inicio' || arrastre.tipo === 'fin') {
          if (muro[i] || i === inicio || i === fin) return;
          if (arrastre.tipo === 'inicio') inicio = i; else fin = i;
          trasEditar();
        } else {
          pintar(i);
          trasEditar();
        }
        return;
      }
      lienzo.canvas.style.cursor = i === inicio || i === fin ? 'grab' : 'crosshair';
      if (i < 0 || muro[i]) return tip.ocultar();
      const { x, y } = lienzo.posicion(ev);
      const g = dist[i];
      const hv = alg === 'astar' || alg === 'voraz' ? h(i) : null;
      let html = `celda (${fila(i)}, ${col(i)}) · costo de entrar ${costo[i]}`;
      if (estado[i]) {
        html += `<br>g = <b>${VIZ.fmt(g)}</b> (costo desde el inicio)`;
        if (hv != null) html += `<br>h = <b>${VIZ.fmt(hv)}</b> · f = <b>${VIZ.fmt(alg === 'voraz' ? hv : g + peso * hv)}</b>`;
        html += `<br>${estado[i] === 2 ? 'expandido' : 'en la frontera'}`;
      }
      tip.mostrar(x, y, html);
    });
    const soltar = () => { arrastre = null; };
    lienzo.canvas.addEventListener('pointerup', soltar);
    lienzo.canvas.addEventListener('pointercancel', soltar);
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());

    escenarioInicial();
    dibujar();
  }

  VIZ.registrarTema('caminos', {
    intro: String.raw`
      <p>Una cuadrícula es un <strong>grafo</strong>: cada celda libre es un vértice y hay una arista entre celdas vecinas
      (arriba, abajo, izquierda, derecha). Entrar a una celda tiene un costo —1 en terreno normal, ${COSTO_BARRO} en barro—, y el
      problema es encontrar un camino de costo mínimo entre el inicio y la meta.</p>
      <p>Todos los algoritmos que se muestran comparten el mismo esqueleto: mantienen una <em>frontera</em> de vértices descubiertos
      pero aún no explorados, y en cada paso sacan uno de ella para <em>expandirlo</em>. Lo único que cambia es <strong>qué vértice
      sacan</strong>: el más antiguo (BFS), el más reciente (DFS), el más barato (Dijkstra), el que parece más cercano a la meta (voraz)
      o el que equilibra ambos criterios (A*).</p>`,
    visualizaciones: [
      {
        titulo: 'Búsqueda de caminos en una cuadrícula',
        descripcion: 'El color de las celdas expandidas indica su distancia acumulada desde el inicio. Compare cuántas celdas expande cada algoritmo antes de llegar a la meta y si el camino que encuentra es óptimo.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Formulación</h2>
      <p>Sea \(G = (V, E)\) un grafo con pesos \(w : E \to \mathbb{R}_{\ge 0}\). El costo de un camino \(P = (v_0, v_1, \dots, v_k)\) es
      \(w(P) = \sum_{i=1}^{k} w(v_{i-1}, v_i)\), y la distancia \(\delta(s, v)\) es el mínimo de \(w(P)\) sobre todos los caminos de
      \(s\) a \(v\). En esta cuadrícula \(w(u, v)\) es el costo de la celda de llegada \(v\).</p>

      <h2>BFS y DFS</h2>
      <p>La <strong>búsqueda en anchura</strong> usa una cola (FIFO), por lo que explora los vértices en capas de igual número de
      aristas desde el origen. Si todos los pesos son iguales, la primera vez que alcanza un vértice lo hace por un camino mínimo;
      con pesos distintos (barro) ya no es óptima. La <strong>búsqueda en profundidad</strong> usa una pila (LIFO): avanza tanto como
      puede antes de retroceder. Encuentra <em>algún</em> camino, pero en general no el más corto. Ambas cuestan \(O(|V| + |E|)\).</p>

      <h2>Dijkstra</h2>
      <p>Mantiene una estimación \(d[v] \ge \delta(s,v)\) y extrae siempre el vértice de la frontera con menor \(d\). Al expandir
      \(u\) <em>relaja</em> cada arista \((u, v)\):</p>
      \[ d[v] \leftarrow \min\big(d[v],\; d[u] + w(u, v)\big). \]
      <p><strong>Invariante:</strong> cuando \(u\) se extrae, \(d[u] = \delta(s, u)\). Si existiera un camino más barato, este
      saldría del conjunto de vértices cerrados por algún vértice \(y\) de la frontera con \(d[y] \le \delta(s,u) &lt; d[u]\) —usando
      que los pesos son no negativos—, y entonces se habría extraído \(y\) antes que \(u\). Con un montículo binario el costo es
      \(O((|V| + |E|) \log |V|)\). Las celdas expandidas forman «anillos» de igual distancia alrededor del inicio.</p>

      <h2>Búsqueda informada: voraz y A*</h2>
      <p>Una <strong>heurística</strong> \(h(v)\) estima el costo restante de \(v\) a la meta. La búsqueda voraz ordena la frontera
      solo por \(h\): es rápida cuando hay pocos obstáculos, pero puede tomar desvíos costosos. A* ordena por</p>
      \[ f(v) = g(v) + h(v), \]
      <p>donde \(g(v) = d[v]\) es el costo ya pagado. Así \(f(v)\) estima el costo total de la mejor solución que pasa por \(v\).
      Dijkstra es el caso particular \(h \equiv 0\).</p>
      <ul>
        <li>\(h\) es <strong>admisible</strong> si nunca sobreestima: \(h(v) \le \delta(v, t)\). Entonces A* devuelve un camino óptimo.</li>
        <li>\(h\) es <strong>consistente</strong> si \(h(u) \le w(u,v) + h(v)\) para toda arista. Esto implica admisibilidad y garantiza
        que ningún vértice necesita expandirse dos veces.</li>
      </ul>
      <p>Con movimientos en cuatro direcciones y costo mínimo 1, la distancia Manhattan \(|\Delta f| + |\Delta c|\) es consistente
      (y la más informativa posible sin obstáculos); la euclídea también es admisible pero menos ajustada, por lo que A* expande más
      celdas con ella.</p>

      <h2>A* ponderado</h2>
      <p>Con \(f(v) = g(v) + w\,h(v)\) y \(w &gt; 1\), la búsqueda se vuelve más «codiciosa»: suele expandir muchas menos celdas a cambio
      de perder la garantía de optimalidad. Sin embargo, si \(h\) es admisible el costo encontrado está acotado:</p>
      \[ w(P) \le w \cdot \delta(s, t). \]
      <p>Pruebe aumentar el peso en el escenario inicial y observe cuándo el indicador «¿óptimo?» cambia a «no».</p>`,
  });
})();
