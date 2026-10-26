(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.grafo;

  /* Infraestructura común: grafo, origen elegido con clic y reproductor. */
  function montarBase(cuerpo, cfg) {
    const est = { n: 10, grado: 2.8, dirigido: false, semilla: cfg.semilla };
    let g, s, origen = 0, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, () => nuevo());
    ctl.casilla({ etiqueta: 'dirigido', valor: false, alCambiar: (v) => { est.dirigido = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, {
      iniciar: () => { s = cfg.crear(g, origen); return s.gen; },
      dibujar, velocidad: 1,
    });
    ctl.boton('Nuevo grafo', () => { est.semilla++; nuevo(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.52, altoMax: 460 });
    VIZ.leyenda(cuerpo, cfg.leyenda);
    const tira = G.estructura(cuerpo, cfg.tituloEstructura);
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un vértice para usarlo como origen. Al terminar, pase el cursor sobre un vértice para ver su camino más corto.');

    function nuevo() {
      g = G.generar({ n: est.n, grado: est.grado, dirigido: est.dirigido, orientacion: 'desde0', semilla: est.semilla, pesos: [1, 9] });
      origen = 0;
      rep.reiniciar();
    }
    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      const camino = new Set();
      if (rep.terminado && hover >= 0) for (let v = hover; s.padre[v] >= 0; v = s.padre[v]) camino.add(s.padreArista[v]);
      geo = G.dibujar(lienzo, g, {
        pesos: cfg.pesos,
        nodo: (i) => {
          const base = cfg.estiloNodo(s, i);
          return { ...base, anillo: i === s.actual ? C.s2 : i === origen && !s.pasos ? C.s6 : base.anillo };
        },
        arista: (a, e) => {
          if (camino.has(e)) return { color: C.s2, ancho: 4 };
          if (e === s.aristaActual) return { color: C.s2, ancho: 3 };
          if (s.padreArista.includes(e)) return { color: C.s1, ancho: 3 };
          return { color: '#c3c2b7' };
        },
        debajo: (i) => (s.dist[i] === Infinity ? '∞' : `${cfg.prefijo}${G.dist(s.dist[i])}`),
        colorDebajo: (i) => (i === s.mejorado ? C.s2 : C.tinta),
      });
      tira.set(cfg.estructura(s, g));
      registro.textContent = s.mensaje;
      lectura.set(cfg.lecturas(s, g));
    }
    lienzo.alDibujar = () => s && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i >= 0) { origen = i; rep.reiniciar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      lienzo.canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
      if (i !== hover) { hover = i; if (rep.terminado) dibujar(); }
    });
    nuevo();
  }

  /* ---------- BFS ---------- */

  function crearBFS(g, origen) {
    const n = g.nodos.length, ady = G.adyacencia(g), L = (i) => g.nodos[i].etiqueta;
    const s = {
      dist: new Array(n).fill(Infinity), padre: new Array(n).fill(-1), padreArista: new Array(n).fill(-1),
      estado: new Array(n).fill(0), cola: [origen], actual: -1, aristaActual: -1, mensaje: '', pasos: 0, mejorado: -1, maxNivel: 1,
    };
    s.dist[origen] = 0;
    s.estado[origen] = 1;
    s.mensaje = `El origen ${L(origen)} entra a la cola con distancia 0.`;
    s.gen = (function* () {
      while (s.cola.length) {
        const u = s.cola.shift();
        s.estado[u] = 2; s.actual = u; s.aristaActual = -1; s.pasos++; s.mejorado = -1;
        s.mensaje = `Se saca ${L(u)} del frente de la cola (distancia ${s.dist[u]}) y se revisan sus vecinos.`;
        yield;
        for (const { v, e } of ady[u]) {
          if (s.dist[v] !== Infinity) continue;
          s.dist[v] = s.dist[u] + 1; s.padre[v] = u; s.padreArista[v] = e; s.estado[v] = 1; s.cola.push(v);
          s.maxNivel = Math.max(s.maxNivel, s.dist[v]);
          s.aristaActual = e; s.mejorado = v;
          s.mensaje = `${L(v)} no había sido descubierto: d[${L(v)}] = d[${L(u)}] + 1 = ${s.dist[v]}, entra al final de la cola.`;
          yield;
        }
      }
      s.actual = -1; s.aristaActual = -1; s.mejorado = -1;
      s.mensaje = 'Cola vacía: BFS terminado. Las aristas azules forman el árbol de caminos más cortos (en número de aristas).';
    })();
    return s;
  }

  /* ---------- Dijkstra ---------- */

  function crearDijkstra(g, origen) {
    const n = g.nodos.length, ady = G.adyacencia(g), L = (i) => g.nodos[i].etiqueta;
    const s = {
      dist: new Array(n).fill(Infinity), padre: new Array(n).fill(-1), padreArista: new Array(n).fill(-1),
      final: new Array(n).fill(false), frontera: new Set([origen]), actual: -1, aristaActual: -1, mensaje: '', pasos: 0, mejorado: -1, relajaciones: 0, exitosas: 0,
    };
    s.dist[origen] = 0;
    s.mensaje = `d[${L(origen)}] = 0 y todas las demás distancias son ∞.`;
    s.gen = (function* () {
      while (s.frontera.size) {
        let u = -1;
        for (const v of s.frontera) if (u < 0 || s.dist[v] < s.dist[u] || (s.dist[v] === s.dist[u] && v < u)) u = v;
        s.frontera.delete(u);
        s.final[u] = true; s.actual = u; s.aristaActual = -1; s.pasos++; s.mejorado = -1;
        s.mensaje = `Se extrae ${L(u)}, el vértice de la frontera con menor distancia (${s.dist[u]}): su distancia ya es definitiva.`;
        yield;
        for (const { v, w, e } of ady[u]) {
          if (s.final[v]) continue;
          s.aristaActual = e; s.relajaciones++;
          const nd = s.dist[u] + w;
          if (nd < s.dist[v]) {
            const antes = s.dist[v];
            s.dist[v] = nd; s.padre[v] = u; s.padreArista[v] = e; s.frontera.add(v); s.exitosas++; s.mejorado = v;
            s.mensaje = `Relajar ${L(u)}–${L(v)}: ${s.dist[u]} + ${w} = ${nd} < ${G.dist(antes)}, se actualiza d[${L(v)}] = ${nd}.`;
          } else {
            s.mejorado = -1;
            s.mensaje = `Relajar ${L(u)}–${L(v)}: ${s.dist[u]} + ${w} = ${nd} ≥ ${s.dist[v]}, no mejora.`;
          }
          yield;
        }
      }
      s.actual = -1; s.aristaActual = -1; s.mejorado = -1;
      s.mensaje = 'Frontera vacía: todas las distancias son definitivas. Las aristas azules forman el árbol de caminos más cortos.';
    })();
    return s;
  }

  VIZ.registrarTema('bfs-dijkstra', {
    intro: String.raw`
      <p>¿Cuál es el camino más corto entre dos vértices? Si todas las aristas «cuestan» lo mismo, la respuesta la da la
      <strong>búsqueda en anchura</strong> (BFS): explorar el grafo por capas, primero los vecinos del origen, luego los vecinos de
      esos, y así sucesivamente. Si las aristas tienen pesos no negativos distintos, la generalización es el
      <strong>algoritmo de Dijkstra</strong>, que en vez de una cola usa una cola de prioridad ordenada por distancia.</p>`,
    visualizaciones: [
      {
        titulo: 'BFS: caminos con menos aristas',
        descripcion: 'Los vértices procesados se colorean según su distancia al origen: forman capas concéntricas. Bajo cada vértice, su distancia en número de aristas.',
        montar: (c) => montarBase(c, {
          semilla: 4, pesos: false, prefijo: 'd=', crear: crearBFS, tituloEstructura: 'Cola (frente → final):',
          estiloNodo: (s, i) => (s.estado[i] === 2 ? { relleno: VIZ.css(VIZ.enRampa(0.25 + 0.7 * (s.dist[i] / Math.max(1, s.maxNivel)))), borde: C.tinta, texto: s.dist[i] / Math.max(1, s.maxNivel) > 0.35 ? '#fff' : C.tinta } : s.estado[i] === 1 ? { relleno: C.s4 } : {}),
          estructura: (s, g) => s.cola.map((u) => ({ texto: `${g.nodos[u].etiqueta} (${s.dist[u]})`, fondo: C.s4 })),
          leyenda: [
            { color: C.s4, texto: 'en la cola', forma: 'punto' },
            { color: VIZ.rampa[3], texto: 'procesado, cerca', forma: 'punto' },
            { color: VIZ.rampa[11], texto: 'procesado, lejos', forma: 'punto' },
            { color: C.s1, texto: 'árbol BFS', forma: 'linea' },
            { color: C.s2, texto: 'arista actual / camino', forma: 'linea' },
          ],
          lecturas: (s) => [['procesados', String(s.estado.filter((x) => x === 2).length)], ['en cola', String(s.cola.length)], ['capas', String(Math.max(0, ...s.dist.filter((d) => d !== Infinity)) + 1)], ['inalcanzables', String(s.dist.filter((d) => d === Infinity).length)]],
        }),
      },
      {
        titulo: 'Dijkstra: caminos de menor peso',
        descripcion: 'Los números sobre las aristas son pesos. Los vértices negros tienen distancia definitiva; los amarillos están en la frontera con una distancia provisional que puede mejorar.',
        montar: (c) => montarBase(c, {
          semilla: 6, pesos: true, prefijo: '', crear: crearDijkstra, tituloEstructura: 'Cola de prioridad (menor → mayor):',
          estiloNodo: (s, i) => (s.final[i] ? { relleno: C.tinta, borde: C.tinta, texto: '#fff' } : s.frontera.has(i) ? { relleno: C.s4 } : {}),
          estructura: (s, g) => [...s.frontera].sort((a, b) => s.dist[a] - s.dist[b] || a - b).map((u) => ({ texto: `${g.nodos[u].etiqueta}: ${s.dist[u]}`, fondo: C.s4 })),
          leyenda: [
            { color: C.s4, texto: 'en la frontera (distancia provisional)', forma: 'punto' },
            { color: C.tinta, texto: 'distancia definitiva', forma: 'punto' },
            { color: C.s1, texto: 'mejor arista de llegada', forma: 'linea' },
            { color: C.s2, texto: 'arista que se relaja / camino', forma: 'linea' },
          ],
          lecturas: (s) => [['definitivos', String(s.final.filter(Boolean).length)], ['relajaciones', String(s.relajaciones)], ['exitosas', String(s.exitosas)], ['inalcanzables', s.pasos && !s.frontera.size ? String(s.dist.filter((d) => d === Infinity).length) : '—']],
        }),
      },
    ],
    teoria: String.raw`
      <h2>BFS</h2>
      <pre><code>BFS(G, s):
    d[v] ← ∞ para todo v;  d[s] ← 0;  Q ← [s]
    mientras Q no esté vacía:
        u ← sacar el frente de Q
        para cada v en ady[u]:
            si d[v] = ∞:
                d[v] ← d[u] + 1;  π[v] ← u;  agregar v al final de Q</code></pre>
      <p>Cada vértice entra a la cola una vez y cada lista de adyacencia se recorre una vez: \(\Theta(|V| + |E|)\).</p>
      <p><strong>Corrección.</strong> Sea \(\delta(s,v)\) el mínimo número de aristas de \(s\) a \(v\). La cola contiene en todo momento vértices
      con a lo más dos valores consecutivos de \(d\), en orden no decreciente. De ahí se deduce por inducción que los vértices se
      descubren en orden de \(\delta\) y que, al descubrirse, \(d[v] = \delta(s, v)\). Los punteros \(\pi\) forman el <em>árbol BFS</em>, que
      contiene un camino más corto a cada vértice alcanzable.</p>

      <h2>Dijkstra</h2>
      <p>Para pesos \(w(u,v) \ge 0\), Dijkstra mantiene estimaciones \(d[v] \ge \delta(s, v)\) y un conjunto \(S\) de vértices con distancia
      definitiva. En cada paso extrae de la frontera el vértice \(u\) con menor \(d[u]\), lo agrega a \(S\) y <strong>relaja</strong> sus aristas:</p>
      \[ d[v] \leftarrow \min\big(d[v],\; d[u] + w(u, v)\big). \]
      <p><strong>Invariante:</strong> al extraer \(u\), \(d[u] = \delta(s, u)\). Supongamos que no, y sea \(P\) un camino más corto a \(u\). Sea \(y\)
      el primer vértice de \(P\) fuera de \(S\) y \(x\) su predecesor (en \(S\)). Cuando se extrajo \(x\) se relajó \((x, y)\), así que
      \(d[y] = \delta(s, y)\). Como los pesos son no negativos, \(\delta(s,y) \le \delta(s,u) &lt; d[u]\), y entonces \(y\) tendría menor \(d\)
      que \(u\) y se habría extraído antes. Contradicción.</p>
      <p>BFS es el caso particular con todos los pesos iguales a 1: la cola FIFO ya está ordenada por distancia.</p>

      <h2>Costo según la cola de prioridad</h2>
      <table>
        <thead><tr><th>Implementación</th><th>Extraer mínimo</th><th>Disminuir clave</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td>Arreglo sin orden</td><td>\(O(|V|)\)</td><td>\(O(1)\)</td><td>\(O(|V|^2)\)</td></tr>
          <tr><td>Montículo binario</td><td>\(O(\log |V|)\)</td><td>\(O(\log |V|)\)</td><td>\(O((|V| + |E|)\log |V|)\)</td></tr>
          <tr><td>Montículo de Fibonacci</td><td>\(O(\log |V|)\) amort.</td><td>\(O(1)\) amort.</td><td>\(O(|E| + |V|\log |V|)\)</td></tr>
        </tbody>
      </table>
      <p>El arreglo conviene para grafos densos; el montículo binario, para grafos dispersos.</p>

      <h2>Pesos negativos</h2>
      <p>Si hay aristas negativas, el argumento falla: un camino que pasa por un vértice lejano puede volverse más barato después, cuando
      el destino ya fue marcado como definitivo. Para esos casos se usa <a href="tema.html?id=bellman-ford">Bellman-Ford</a>. Si además
      se tiene una buena estimación de la distancia restante a un destino, <a href="tema.html?id=caminos">A*</a> explora muchos menos vértices.</p>`,
  });
})();
