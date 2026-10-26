(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: el esqueleto común sobre un grafo ---------- */

  function montarEsqueleto(cuerpo) {
    VIZ.busqueda.figuraGrafo(cuerpo, {
      estrategias: [['bfs', 'Anchura (cola)'], ['dfs', 'Profundidad (pila)'], ['ucs', 'Costo uniforme (g)'], ['voraz', 'Voraz (h)'], ['astar', 'A* (g + h)']],
      estrategia: 'astar',
      semilla: 3,
    });
  }

  /* ---------- Fig. 2: crecimiento exponencial y ramificación efectiva ---------- */

  const nodos = (b, d) => { let s = 0, p = 1; for (let i = 0; i <= d; i++) { s += p; p *= b; } return s; };

  function montarCrecimiento(cuerpo) {
    let b = 3, be = 1.4, dmax = 24, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ramificación b (sin heurística)', min: 1.5, max: 4, paso: 0.1, valor: b, formato: (v) => v.toFixed(1), alCambiar: (v) => { b = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ramificación efectiva b* (con heurística)', min: 1.05, max: 3, paso: 0.05, valor: be, formato: (v) => v.toFixed(2), alCambiar: (v) => { be = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Profundidad de la solución d', min: 6, max: 40, valor: dmax, alCambiar: (v) => { dmax = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'sin heurística: 1 + b + … + bᵈ', forma: 'linea' },
      { color: C.s2, texto: 'con heurística: 1 + b* + … + (b*)ᵈ', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje vertical es logarítmico: una recta significa crecimiento exponencial. Pase el cursor para leer los valores en cada profundidad.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(10, nodos(b, dmax), nodos(be, dmax));
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: dmax, ymin: 1, ymax }, {
        logY: true, etiquetaX: 'profundidad d', etiquetaY: 'nodos generados',
        formatoY: (v) => (v >= 1e4 ? `10^${Math.round(Math.log10(v))}` : VIZ.entero(v)),
      });
      plano.ejes();
      for (const [x, c] of [[b, C.s1], [be, C.s2]]) {
        const pts = [];
        for (let d = 0; d <= dmax; d++) pts.push([d, nodos(x, d)]);
        VIZ.trazar(ctx, plano, pts, c, 2);
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(nodos(x, hover)), c, 4);
      }
      if (hover != null) {
        ctx.strokeStyle = C.eje;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(plano.sx(hover), plano.y1); ctx.lineTo(plano.sx(hover), plano.y0); ctx.stroke();
        ctx.setLineDash([]);
      }
      const nb = nodos(b, dmax), ne = nodos(be, dmax);
      lectura.set([
        ['sin heurística', VIZ.fmt(nb)],
        ['con heurística', VIZ.fmt(ne)],
        ['ahorro', `${VIZ.fmt(nb / ne)} veces`],
        ['a 10⁶ nodos/s', VIZ.fmt(nb / 1e6) + ' s vs ' + VIZ.fmt(ne / 1e6) + ' s'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(dmax, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `d = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, `b = ${b.toFixed(1)}`, VIZ.fmt(nodos(b, hover))) +
        VIZ.filaTooltip(C.s2, `b* = ${be.toFixed(2)}`, VIZ.fmt(nodos(be, hover))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('heuristic-search', {
    intro: String.raw`
      <p>Muchos problemas —armar un rompecabezas, planificar una ruta, ordenar acciones de un robot— se pueden plantear como
      <strong>encontrar un camino en un grafo de estados</strong>: cada vértice es una situación posible y cada arista, una acción.
      El grafo suele ser tan grande que no cabe en memoria; se genera sobre la marcha a partir del estado inicial.</p>
      <p>Todos los algoritmos de búsqueda comparten el mismo esqueleto: una lista <strong>ABIERTA</strong> de estados descubiertos
      pero no explorados y una lista <strong>CERRADA</strong> de estados ya expandidos. Lo único que cambia es <em>cuál</em> estado se
      saca de ABIERTA. La <strong>búsqueda heurística</strong> usa una estimación \(h\) de la distancia que falta hasta la meta para
      elegir bien, y así explora una fracción diminuta del espacio.</p>`,
    visualizaciones: [
      {
        titulo: 'Un esqueleto, cinco estrategias',
        descripcion: 'Ejecute la misma búsqueda cambiando solo el criterio con que se ordena ABIERTA. Compare cuántos vértices se expanden y si el camino es óptimo; con A* la frontera avanza «apuntando» a la meta.',
        montar: montarEsqueleto,
      },
      {
        titulo: 'Por qué hace falta una heurística',
        descripcion: 'Una buena heurística no cambia el carácter exponencial de la búsqueda, pero reduce la base: compare \\(b = 3\\) con una ramificación efectiva \\(b^* = 1.4\\) a profundidad 24.',
        montar: montarCrecimiento,
      },
    ],
    teoria: String.raw`
      <h2>Problemas de espacio de estados</h2>
      <p>Un <strong>problema de espacio de estados</strong> es una tupla \(P = (S, A, s_0, T)\): un conjunto de estados \(S\), un
      conjunto de acciones \(A\) donde cada \(a \in A\) transforma un estado en otro, un estado inicial \(s_0\) y un conjunto de
      estados meta \(T \subseteq S\). Si cada acción tiene un costo \(w(a) \ge 0\), una <strong>solución</strong> es una secuencia de
      acciones que lleva de \(s_0\) a algún \(t \in T\), y es <strong>óptima</strong> si su costo total es mínimo.</p>
      <p>El <em>grafo del problema</em> tiene a \(S\) como vértices y una arista por acción. Las búsquedas lo recorren generando
      sucesores sobre la marcha; el registro de lo explorado forma un <em>árbol de búsqueda</em>, que puede contener el mismo estado
      varias veces si no se detectan duplicados.</p>

      <h2>El algoritmo genérico</h2>
      <pre><code>ABIERTA ← {s₀};  CERRADA ← ∅;  g(s₀) ← 0
mientras ABIERTA ≠ ∅:
    u ← sacar de ABIERTA el estado con menor prioridad
    si u ∈ T: devolver el camino hasta u
    CERRADA ← CERRADA ∪ {u}
    para cada sucesor v de u:
        si v ∉ CERRADA y g(u) + w(u, v) &lt; g(v):
            g(v) ← g(u) + w(u, v);  padre(v) ← u
            insertar o actualizar v en ABIERTA
devolver «sin solución»</code></pre>
      <table>
        <thead><tr><th>Estrategia</th><th>Prioridad</th><th>¿Óptima?</th></tr></thead>
        <tbody>
          <tr><td>Anchura (BFS)</td><td>orden de llegada (cola)</td><td>solo con costos unitarios</td></tr>
          <tr><td>Profundidad (DFS)</td><td>orden inverso (pila)</td><td>no</td></tr>
          <tr><td>Costo uniforme (Dijkstra)</td><td>\(g(v)\)</td><td>sí</td></tr>
          <tr><td><a href="tema.html?id=greedy-best-first">Voraz</a></td><td>\(h(v)\)</td><td>no</td></tr>
          <tr><td><a href="tema.html?id=a-star">A*</a></td><td>\(f(v) = g(v) + h(v)\)</td><td>sí, si \(h\) es admisible</td></tr>
        </tbody>
      </table>

      <h2>Criterios para comparar algoritmos</h2>
      <ul>
        <li><strong>Completitud:</strong> ¿encuentra una solución siempre que exista?</li>
        <li><strong>Optimalidad:</strong> ¿la solución encontrada es de costo mínimo?</li>
        <li><strong>Tiempo:</strong> número de nodos generados o expandidos.</li>
        <li><strong>Memoria:</strong> número máximo de nodos guardados. Es el recurso que suele agotarse primero; de ahí la
        importancia de <a href="tema.html?id=iddfs">IDDFS</a> y de <a href="tema.html?id=ida-star">IDA*</a>.</li>
      </ul>
      <p>Si el árbol tiene factor de ramificación \(b\) y la solución está a profundidad \(d\), una búsqueda ciega genera</p>
      \[ N(b, d) = 1 + b + b^2 + \dots + b^d = \frac{b^{d+1} - 1}{b - 1} = \Theta(b^d) \]
      <p>nodos. Con \(b = 3\) y \(d = 24\) son unos \(4 \times 10^{11}\).</p>

      <h2>Ramificación efectiva</h2>
      <p>Para medir la calidad de una heurística se define la <strong>ramificación efectiva</strong> \(b^*\): si una búsqueda generó
      \(N\) nodos para encontrar una solución a profundidad \(d\), \(b^*\) es el factor de ramificación que tendría un árbol uniforme
      de profundidad \(d\) con esos nodos:</p>
      \[ N + 1 = 1 + b^* + (b^*)^2 + \dots + (b^*)^d. \]
      <p>Una heurística perfecta da \(b^* \approx 1\); una inútil, \(b^* \approx b\). Como el costo sigue siendo
      \((b^*)^d\), pasar de \(b^* = 1.5\) a \(1.3\) puede significar varios órdenes de magnitud. Las heurísticas se estudian en
      <a href="tema.html?id=heuristicas">Heuristic Functions</a> y en <a href="tema.html?id=pattern-databases">Pattern Databases</a>.</p>`,
  });
})();
