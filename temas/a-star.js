(function () {
  'use strict';
  const { color: C } = VIZ;
  const B = VIZ.busqueda, P = B.puzzle;

  /* ---------- Fig. 1: A* paso a paso ---------- */

  function montarPasoAPaso(cuerpo) {
    B.figuraGrafo(cuerpo, {
      estrategias: [['astar', 'A*']],
      estrategia: 'astar',
      heuristicas: [
        ['euclidea', 'Línea recta (admisible)'],
        ['nula', 'Nula, h = 0 (Dijkstra)'],
        ['doble', '2 × línea recta (inadmisible)'],
        ['exacta', 'Exacta, h = h* (perfecta)'],
      ],
      heuristica: 'euclidea',
      semilla: 5,
    });
  }

  /* ---------- Fig. 2: nodos expandidos en el 8-puzzle según la heurística ---------- */

  const SERIES = [
    { clave: 'cero', nombre: 'h = 0 (costo uniforme)', corto: 'h = 0', color: C.s1 },
    { clave: 'fuera', nombre: 'fichas fuera de lugar', corto: 'fuera de lugar', color: C.s2 },
    { clave: 'manhattan', nombre: 'Manhattan', corto: 'Manhattan', color: C.s3 },
    { clave: 'conflicto', nombre: 'Manhattan + conflictos lineales', corto: '+ conflictos', color: C.s4 },
  ];
  const PROFS = Array.from({ length: 14 }, (_, i) => 2 + 2 * i); // 2, 4, …, 28

  // Ramificación efectiva: b* tal que 1 + b* + … + b*^d = N + 1.
  function bEfectiva(N, d) {
    let lo = 1, hi = 10;
    const suma = (b) => { let s = 0, p = 1; for (let i = 0; i <= d; i++) { s += p; p *= b; } return s; };
    for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (suma(m) < N + 1) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  function montarExpandidos(cuerpo) {
    let semilla = 1, instancias = 4, cancelar = null, hecho = 0, hover = null;
    let datos = SERIES.map(() => PROFS.map(() => []));
    const total = () => PROFS.length * instancias * SERIES.length;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Instancias por profundidad', min: 1, max: 10, valor: instancias, alCambiar: (v) => { instancias = v; }, alSoltar: () => calcular() });
    ctl.boton('Nuevas instancias', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, SERIES.map((s) => ({ color: s.color, texto: s.nombre, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escala logarítmica. Cada punto promedia los nodos expandidos por A* en instancias al azar con esa distancia óptima. Pase el cursor para ver los valores.');

    function calcular() {
      if (cancelar) cancelar();
      datos = SERIES.map(() => PROFS.map(() => []));
      hecho = 0;
      const rnd = VIZ.semilla(semilla * 101 + instancias);
      const gen = (function* () {
        for (let j = 0; j < PROFS.length; j++) {
          for (let k = 0; k < instancias; k++) {
            const s = P.aDistancia(rnd, PROFS[j]);
            for (let i = 0; i < SERIES.length; i++) {
              datos[i][j].push(P.aEstrella(s, P.HEURISTICAS[SERIES[i].clave].f, { limite: 2e5 }).expandidos);
              hecho++;
              yield;
            }
          }
        }
      })();
      cancelar = B.porPartes(gen, dibujar);
    }

    const media = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : NaN);
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 29, ymin: 1, ymax: 3e5 }, {
        logY: true, etiquetaX: 'longitud de la solución óptima', etiquetaY: 'nodos expandidos (promedio)',
        formatoY: (v) => (v >= 1e4 ? `10^${Math.round(Math.log10(v))}` : VIZ.entero(v)),
      });
      plano.ejes();
      SERIES.forEach((s, i) => {
        const pts = PROFS.map((d, j) => [d, media(datos[i][j])]);
        VIZ.trazar(ctx, plano, pts, s.color, 2);
        pts.forEach(([x, y]) => { if (Number.isFinite(y)) VIZ.marcador(ctx, plano.sx(x), plano.sy(Math.max(1, y)), s.color, hover === x ? 5 : 3.5, i); });
      });
      const listo = hecho >= total();
      registro.textContent = listo ? `Listo: ${VIZ.entero(total())} búsquedas con A*.` : `Calculando… ${Math.round((100 * hecho) / total())} % (${hecho} de ${total()} búsquedas).`;
      const j20 = PROFS.indexOf(20);
      lectura.set(SERIES.map((s, i) => {
        const m = media(datos[i][j20]);
        return [`b* (d = 20) ${s.corto}`, Number.isFinite(m) ? VIZ.fmt(bEfectiva(m, 20), 3) : '…'];
      }));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const j = Math.max(0, Math.min(PROFS.length - 1, Math.round((plano.ix(x) - 2) / 2)));
      hover = PROFS[j];
      dibujar();
      tip.mostrar(x, y, `solución de <b>${hover}</b> movimientos` + SERIES.map((s, i) => VIZ.filaTooltip(s.color, s.nombre, Number.isFinite(media(datos[i][j])) ? VIZ.entero(media(datos[i][j])) : '…')).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('a-star', {
    intro: String.raw`
      <p><strong>A*</strong> (Hart, Nilsson y Raphael, 1968) es el algoritmo central de la búsqueda heurística. Ordena la frontera
      por \(f(s) = g(s) + h(s)\): lo que ya costó llegar a \(s\) más lo que la heurística estima que falta. Así \(f(s)\) es una
      estimación del costo de la mejor solución que pasa por \(s\).</p>
      <p>Si la heurística es admisible, A* encuentra siempre una solución óptima, y entre los algoritmos que garantizan eso con la
      misma información, ninguno expande menos nodos. Su punto débil es la memoria: guarda todo lo que genera.</p>`,
    visualizaciones: [
      {
        titulo: 'A* paso a paso',
        descripcion: 'Compare las cuatro heurísticas en el mismo grafo: con h = 0 la frontera crece en todas direcciones; con la heurística exacta, A* va directo a la meta; con la inadmisible puede devolver un camino más caro.',
        montar: montarPasoAPaso,
      },
      {
        titulo: 'La heurística decide el costo',
        descripcion: 'Nodos expandidos por A* en el 8-puzzle con cuatro heurísticas admisibles. Una mejor heurística no elimina el crecimiento exponencial, pero reduce su base \\(b^*\\).',
        montar: montarExpandidos,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>A*(s₀):
    g(s₀) ← 0;  ABIERTA ← {s₀} con prioridad f(s₀) = h(s₀);  CERRADA ← ∅
    mientras ABIERTA ≠ ∅:
        u ← extraer de ABIERTA el estado con menor f
        si u es meta: devolver el camino hasta u
        CERRADA ← CERRADA ∪ {u}
        para cada sucesor v de u:
            g' ← g(u) + w(u, v)
            si g' &lt; g(v):                  ▹ camino mejor hacia v
                g(v) ← g';  padre(v) ← u
                insertar v en ABIERTA con f(v) = g(v) + h(v)   ▹ si v ∈ CERRADA, se reabre
    devolver «sin solución»</code></pre>
      <p>Casos particulares: con \(h \equiv 0\) es el algoritmo de Dijkstra (costo uniforme); con \(f = h\) es la
      <a href="tema.html?id=greedy-best-first">búsqueda voraz</a>.</p>

      <h2>Optimalidad</h2>
      <div class="recuadro"><strong>Teorema.</strong> Si \(h\) es admisible y los costos son positivos, A* devuelve una solución
      óptima.</div>
      <p>Sea \(C^*\) el costo óptimo. Mientras A* no termine, en ABIERTA hay algún nodo \(n\) de un camino óptimo cuyo prefijo ya
      tiene su \(g\) correcto, y \(f(n) = g^*(n) + h(n) \le g^*(n) + h^*(n) = C^*\). Si A* extrajera una meta \(t\) con
      \(g(t) &gt; C^*\), se tendría \(f(t) = g(t) &gt; C^* \ge f(n)\), y habría extraído \(n\) antes. Repitiendo el argumento,
      la primera meta extraída cuesta \(C^*\).</p>

      <h2>Heurísticas consistentes</h2>
      <p>Si \(h\) es <a href="tema.html?id=heuristicas">consistente</a>, \(f\) no decrece a lo largo de ningún camino:</p>
      \[ f(v) = g(u) + w(u, v) + h(v) \ge g(u) + h(u) = f(u). \]
      <p>Consecuencias: los nodos se extraen en orden no decreciente de \(f\); cuando un nodo se extrae, su \(g\) ya es óptimo, por
      lo que <strong>nunca se reabre</strong>; y el conjunto de nodos expandidos queda acotado por</p>
      \[ \{ s : f(s) &lt; C^* \} \subseteq \text{expandidos} \subseteq \{ s : f(s) \le C^* \}. \]
      <p>Esto da la <strong>eficiencia óptima</strong> de A*: cualquier algoritmo que garantice optimalidad con la misma
      heurística debe expandir todo nodo con \(f(s) &lt; C^*\), porque no puede descartar que allí haya una solución mejor. Con una
      heurística admisible pero inconsistente, A* sigue siendo óptimo, pero puede reabrir nodos, en el peor caso un número
      exponencial de veces.</p>

      <h2>Costo</h2>
      <p>El tiempo y la memoria son \(O(|V| \log |V| + |E|)\) en un grafo explícito, igual que Dijkstra. En espacios implícitos
      lo que importa es cuántos nodos tienen \(f &lt; C^*\): con un error de la heurística acotado por una constante el número es
      lineal en la profundidad, pero con el error relativo típico de la práctica sigue siendo exponencial, \((b^*)^d\).</p>
      <p>A* guarda todos los nodos generados, y en problemas como el 15-puzzle la memoria se agota en segundos. De ahí las
      variantes de memoria limitada como <a href="tema.html?id=ida-star">IDA*</a>.</p>

      <h2>A* ponderado</h2>
      <p>Con \(f(s) = g(s) + w\,h(s)\), \(w \ge 1\), la búsqueda confía más en la heurística: expande menos nodos y la solución
      encontrada cuesta a lo más \(w \cdot C^*\) si \(h\) es admisible. Se puede probar sobre una cuadrícula en
      <a href="tema.html?id=caminos">Grid Pathfinding</a> y en el 8-puzzle en
      <a href="tema.html?id=greedy-best-first">Greedy Best-First Search</a>.</p>`,
  });
})();
