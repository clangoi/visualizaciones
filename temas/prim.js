(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.grafo;

  function montar(cuerpo) {
    const est = { n: 10, grado: 3, semilla: 7 };
    let g, s, raiz = 0;
    const L = (i) => g.nodos[i].etiqueta;
    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, () => nuevo());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevo grafo', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.52, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'vértice en el árbol', forma: 'punto' },
      { color: C.s4, texto: 'vértice en la frontera', forma: 'punto' },
      { color: C.s1, texto: 'arista del árbol', forma: 'linea' },
      { color: C.s4, texto: 'mejor arista hacia cada vértice de la frontera', forma: 'linea' },
      { color: C.s2, texto: 'arista que se examina', forma: 'linea' },
    ]);
    const tira = G.estructura(cuerpo, 'Cola de prioridad por clave:');
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Bajo cada vértice se muestra su clave: el peso de la arista más liviana que lo conecta con el árbol. Haga clic en un vértice para empezar desde él.');

    function nuevo() { g = G.generar({ n: est.n, grado: est.grado, semilla: est.semilla, pesos: [1, 15] }); raiz = 0; rep.reiniciar(); }

    function iniciar() {
      const n = g.nodos.length, ady = G.adyacencia(g);
      s = { clave: new Array(n).fill(Infinity), padreArista: new Array(n).fill(-1), enArbol: new Array(n).fill(false), actual: -1, arista: -1, peso: 0, mensaje: '', mejorado: -1 };
      s.clave[raiz] = 0;
      s.mensaje = `Se empieza desde ${L(raiz)} con clave 0; las demás claves son ∞.`;
      return (function* () {
        for (let paso = 0; paso < n; paso++) {
          let u = -1;
          for (let i = 0; i < n; i++) if (!s.enArbol[i] && s.clave[i] < Infinity && (u < 0 || s.clave[i] < s.clave[u])) u = i;
          if (u < 0) { s.mensaje = 'Quedan vértices con clave ∞: el grafo no es conexo.'; return; }
          s.enArbol[u] = true; s.actual = u; s.arista = -1; s.mejorado = -1;
          if (s.padreArista[u] >= 0) {
            s.peso += g.aristas[s.padreArista[u]].w;
            const a = g.aristas[s.padreArista[u]];
            s.mensaje = `Se extrae ${L(u)} (clave ${s.clave[u]}): la arista ${L(a.u)}–${L(a.v)} es la más liviana que cruza el corte y entra al árbol.`;
          } else s.mensaje = `Se extrae ${L(u)}, la raíz.`;
          yield;
          for (const { v, w, e } of ady[u]) {
            if (s.enArbol[v]) continue;
            s.arista = e;
            if (w < s.clave[v]) {
              const antes = s.clave[v];
              s.clave[v] = w; s.padreArista[v] = e; s.mejorado = v;
              s.mensaje = `${L(u)}–${L(v)} pesa ${w} < ${G.dist(antes)}: la clave de ${L(v)} baja a ${w}.`;
            } else {
              s.mejorado = -1;
              s.mensaje = `${L(u)}–${L(v)} pesa ${w} ≥ ${s.clave[v]}: ${L(v)} ya tiene una conexión más barata.`;
            }
            yield;
          }
        }
        s.actual = -1; s.arista = -1; s.mejorado = -1;
        s.mensaje = `Todos los vértices están en el árbol: el árbol de expansión mínima pesa ${s.peso}.`;
      })();
    }

    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      const arbol = new Set(), candidata = new Set();
      g.nodos.forEach((_, i) => { if (s.padreArista[i] >= 0) (s.enArbol[i] ? arbol : candidata).add(s.padreArista[i]); });
      geo = G.dibujar(lienzo, g, {
        pesos: true,
        nodo: (i) => ({
          ...(s.enArbol[i] ? { relleno: C.tinta, borde: C.tinta, texto: C.sobre } : s.clave[i] < Infinity ? { relleno: C.s4 } : {}),
          anillo: i === s.actual ? C.s2 : i === s.mejorado ? C.s2 : null,
        }),
        arista: (a, e) => {
          if (e === s.arista) return { color: C.s2, ancho: 4 };
          if (arbol.has(e)) return { color: C.s1, ancho: 3.5 };
          if (candidata.has(e)) return { color: C.s4, ancho: 3, guiones: [6, 4] };
          const cruza = s.enArbol[a.u] !== s.enArbol[a.v];
          return { color: cruza ? C.apagado : C.tenue, ancho: cruza ? 1.5 : 1.2 };
        },
        debajo: (i) => (s.enArbol[i] ? '' : G.dist(s.clave[i])),
        colorDebajo: (i) => (i === s.mejorado ? C.s2 : C.tinta),
      });
      tira.set(g.nodos.map((_, i) => i).filter((i) => !s.enArbol[i] && s.clave[i] < Infinity).sort((a, b) => s.clave[a] - s.clave[b] || a - b)
        .map((i) => ({ texto: `${L(i)}: ${s.clave[i]}`, fondo: C.s4 })));
      registro.textContent = s.mensaje;
      lectura.set([
        ['vértices en el árbol', `${s.enArbol.filter(Boolean).length} de ${g.nodos.length}`],
        ['peso acumulado', String(s.peso)],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i >= 0) { raiz = i; rep.reiniciar(); }
    });
    nuevo();
  }

  VIZ.registrarTema('prim', {
    intro: String.raw`
      <p>El <strong>algoritmo de Prim</strong> construye un árbol de expansión mínima haciendo crecer <em>un solo árbol</em> desde un vértice
      inicial: en cada paso agrega la arista más liviana que conecta el árbol con un vértice que aún no está en él. Es muy parecido a
      <a href="tema.html?id=bfs-dijkstra">Dijkstra</a>, pero la prioridad de cada vértice es el peso de <em>una</em> arista, no la longitud de un camino.</p>
      <p>Compare con <a href="tema.html?id=kruskal">Kruskal</a>, que hace crecer un bosque y lo va uniendo: con el mismo grafo ambos obtienen
      el mismo peso total.</p>`,
    visualizaciones: [
      {
        titulo: 'Prim paso a paso',
        descripcion: 'Las aristas grises más oscuras cruzan el corte entre el árbol (negro) y el resto. La línea amarilla discontinua es, para cada vértice de la frontera, su arista más barata hacia el árbol.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>Prim(G, w, r):
    clave[v] ← ∞ para todo v;  clave[r] ← 0;  Q ← V
    mientras Q no esté vacía:
        u ← extraer de Q el vértice de menor clave
        para cada v en ady[u] con v ∈ Q:
            si w(u, v) &lt; clave[v]:
                clave[v] ← w(u, v);  π[v] ← u</code></pre>
      <p>Las aristas \((\pi[v], v)\) de los vértices extraídos forman el MST.</p>

      <h2>Corrección</h2>
      <p>Sea \(S\) el conjunto de vértices ya en el árbol. Para cada \(v \notin S\), \(\mathit{clave}[v]\) es el peso de la arista más liviana entre
      \(v\) y \(S\). Por lo tanto, el vértice de menor clave aporta la arista más liviana que cruza el corte \((S, V \setminus S)\), y por la
      <strong>propiedad del corte</strong> (ver <a href="tema.html?id=kruskal">Kruskal</a>) agregarla mantiene la invariante «las aristas
      elegidas están contenidas en algún MST».</p>

      <h2>Costo</h2>
      <table>
        <thead><tr><th>Cola de prioridad</th><th>Costo total</th><th>Conveniente para</th></tr></thead>
        <tbody>
          <tr><td>Arreglo de claves (búsqueda lineal del mínimo)</td><td>\(O(|V|^2)\)</td><td>grafos densos</td></tr>
          <tr><td>Montículo binario</td><td>\(O(|E|\log|V|)\)</td><td>grafos dispersos</td></tr>
          <tr><td>Montículo de Fibonacci</td><td>\(O(|E| + |V|\log|V|)\)</td><td>teóricamente óptimo entre estos</td></tr>
        </tbody>
      </table>
      <p>Con el montículo binario hay \(|V|\) extracciones y hasta \(|E|\) disminuciones de clave, cada una \(O(\log|V|)\). En grafos densos
      (\(|E| \approx |V|^2\)), la versión con arreglo es mejor que Kruskal, que debe ordenar \(\Theta(|V|^2)\) aristas.</p>

      <h2>Prim frente a Dijkstra</h2>
      <p>La única diferencia está en la actualización: Prim usa \(\mathit{clave}[v] \leftarrow w(u, v)\), Dijkstra usa
      \(d[v] \leftarrow d[u] + w(u, v)\). El árbol de caminos más cortos de Dijkstra y el MST de Prim, en general, son distintos: el
      primero minimiza la distancia desde la raíz a cada vértice; el segundo, la suma de todos los pesos.</p>

      <h2>Propiedad del ciclo</h2>
      <p>La propiedad dual del corte: si \(e\) es la arista estrictamente más pesada de algún ciclo, entonces \(e\) no pertenece a ningún MST.
      Esto justifica el algoritmo «inverso» que elimina aristas de la más pesada a la más liviana mientras el grafo siga conexo.</p>`,
  });
})();
