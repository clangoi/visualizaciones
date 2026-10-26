/* Catálogo de secciones y temas.
   Para añadir un tema: agréguelo a una sección aquí y cree temas/<id>.js. */
window.CATALOGO = (function () {
  'use strict';

  // Glifos monocromos de 44×44 para las tarjetas.
  const g = (cuerpo) =>
    `<svg class="tarjeta-glifo" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${cuerpo}</svg>`;

  const secciones = [
    {
      id: 'fundamentos',
      nombre: 'Fundamentos',
      descripcion: 'Cómo medir el costo de un algoritmo y la idea más simple para buscar rápido.',
      temas: [
        {
          id: 'complejidad',
          titulo: 'Asymptotic Growth',
          resumen: 'Comparación de órdenes de crecimiento y la definición formal de O grande con su constante y n₀.',
          visualizaciones: 3,
          glifo: g('<path d="M6 38h32M6 38V6"/><path d="M6 36C18 34 26 28 34 8"/><path d="M6 34c10-4 20-7 32-9" stroke-dasharray="2 3"/>'),
        },
        {
          id: 'busqueda-binaria',
          titulo: 'Binary Search',
          resumen: 'Cómo dividir el espacio de búsqueda a la mitad en cada paso y el árbol de decisión que se forma.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="8" r="3"/><circle cx="12" cy="22" r="3"/><circle cx="32" cy="22" r="3"/><circle cx="6" cy="36" r="3"/><circle cx="18" cy="36" r="3"/><path d="M20 10l-6 10M24 10l6 10M10.5 24.5L7.5 33.5M13.5 24.5l3 9"/>'),
        },
      ],
    },
    {
      id: 'ordenamiento-sec',
      nombre: 'Ordenamiento',
      descripcion: 'Algoritmos para ordenar: cuadráticos, de dividir y conquistar, con montículos y de tiempo lineal.',
      temas: [
        {
          id: 'selection-sort',
          titulo: 'Selection Sort',
          resumen: 'Buscar el mínimo de lo que queda y llevarlo a su lugar: siempre n(n−1)/2 comparaciones.',
          visualizaciones: 2,
          glifo: g('<path d="M6 38V30M13 38V20M20 38V34M27 38V12M34 38V24"/><path d="M4 38h36"/><path d="M20 8v6M17 11l3 3 3-3"/>'),
        },
        {
          id: 'insertion-sort',
          titulo: 'Insertion Sort',
          resumen: 'Insertar cada elemento en el prefijo ordenado; su costo depende del número de inversiones.',
          visualizaciones: 2,
          glifo: g('<path d="M6 38V32M13 38V26M20 38V20M34 38V14"/><path d="M27 38V28" stroke-width="2.6"/><path d="M4 38h36"/><path d="M27 10c0-4-7-4-7 0" /><path d="M18 8l2 2 2-2"/>'),
        },
        {
          id: 'merge-sort',
          titulo: 'Merge Sort',
          resumen: 'Dividir, ordenar las mitades y mezclarlas: Θ(n log n) garantizado y estable.',
          visualizaciones: 3,
          glifo: g('<path d="M6 8h10M28 8h10M6 8v6M16 8v6M28 8v6M38 8v6"/><path d="M11 18l11 10M33 18L22 28"/><path d="M10 34h24v4H10z"/>'),
        },
        {
          id: 'quick-sort',
          titulo: 'Quick Sort',
          resumen: 'Particionar alrededor de un pivote; el efecto de la elección del pivote en el peor caso.',
          visualizaciones: 2,
          glifo: g('<path d="M6 38V28M12 38V22M18 38V30"/><path d="M22 38V10" stroke-width="2.6"/><path d="M26 38V18M32 38V14M38 38V24"/><path d="M4 38h36"/>'),
        },
        {
          id: 'heapsort',
          titulo: 'Heaps & Heapsort',
          resumen: 'Montículos binarios como árbol y como arreglo, colas de prioridad y ordenamiento en el lugar.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="8" r="4"/><circle cx="12" cy="20" r="4"/><circle cx="32" cy="20" r="4"/><circle cx="7" cy="33" r="3.5"/><circle cx="17" cy="33" r="3.5"/><path d="M19 11l-4 6M25 11l4 6M10 23.5l-2 6M14 23.5l2 6"/>'),
        },
        {
          id: 'linear-sorting',
          titulo: 'Linear-Time Sorting',
          resumen: 'Counting sort y radix sort: ordenar sin comparar en tiempo lineal.',
          visualizaciones: 2,
          glifo: g('<rect x="5" y="6" width="34" height="8"/><path d="M13.5 6v8M22 6v8M30.5 6v8"/><path d="M9 38V30M17 38V24M26 38V32M35 38V20"/><path d="M4 38h36"/>'),
        },
        {
          id: 'ordenamiento',
          titulo: 'Sorting Algorithms Compared',
          resumen: 'Todos los algoritmos de la sección lado a lado, con conteo de comparaciones y escrituras.',
          visualizaciones: 2,
          glifo: g('<path d="M6 38V30M13 38V22M20 38V26M27 38V14M34 38V8"/><path d="M4 38h36"/>'),
        },
      ],
    },
    {
      id: 'arboles',
      nombre: 'Árboles de búsqueda',
      descripcion: 'Diccionarios ordenados con operaciones en tiempo logarítmico y las técnicas para mantenerlos balanceados.',
      temas: [
        {
          id: 'bst',
          titulo: 'Binary Search Trees',
          resumen: 'Insertar, eliminar, buscar y recorrer; cómo el orden de inserción determina la altura.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="8" r="4"/><circle cx="12" cy="21" r="4"/><circle cx="32" cy="21" r="4"/><circle cx="26" cy="34" r="4"/><circle cx="38" cy="34" r="3"/><path d="M19.5 11l-5 7M24.5 11l5 7M30 24.5l-2 6M34 24.5l2.5 6.5"/>'),
        },
        {
          id: 'avl',
          titulo: 'AVL Trees',
          resumen: 'Factores de balance y rotaciones simples y dobles para mantener la altura logarítmica.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="10" r="4"/><circle cx="12" cy="24" r="4"/><circle cx="32" cy="24" r="4"/><path d="M19.5 13l-5 7.5M24.5 13l5 7.5"/><path d="M8 36c4 4 24 4 28 0" /><path d="M33 33l3 3-4 1"/>'),
        },
        {
          id: 'arboles-2-3',
          titulo: '2-3 Trees',
          resumen: 'Nodos de una o dos claves, divisiones al insertar y fusiones al eliminar; todas las hojas al mismo nivel.',
          visualizaciones: 1,
          glifo: g('<rect x="14" y="5" width="16" height="9"/><path d="M22 5v9"/><rect x="3" y="28" width="9" height="9"/><rect x="17" y="28" width="10" height="9"/><rect x="31" y="28" width="10" height="9"/><path d="M16 14l-8 14M22 14v14M28 14l8 14"/>'),
        },
        {
          id: 'red-black',
          titulo: 'Red-Black Trees',
          resumen: 'Árboles rojo-negro inclinados a la izquierda y su correspondencia exacta con árboles 2-3.',
          visualizaciones: 1,
          glifo: g('<circle cx="22" cy="8" r="4.5" fill="currentColor"/><circle cx="12" cy="22" r="4.5"/><circle cx="32" cy="22" r="4.5" fill="currentColor"/><circle cx="7" cy="36" r="3.5" fill="currentColor"/><circle cx="17" cy="36" r="3.5" fill="currentColor"/><path d="M19 11.5l-4.5 7M25 11.5l4.5 7M10 26l-2 6.5M14 26l2 6.5"/>'),
        },
      ],
    },
    {
      id: 'hashing',
      nombre: 'Hashing',
      descripcion: 'Diccionarios con operaciones en tiempo esperado constante.',
      temas: [
        {
          id: 'hash',
          titulo: 'Hash Tables',
          resumen: 'Encadenamiento y direccionamiento abierto: colisiones, sondeos y el efecto del factor de carga.',
          visualizaciones: 2,
          glifo: g('<rect x="5" y="8" width="8" height="8"/><rect x="5" y="18" width="8" height="8"/><rect x="5" y="28" width="8" height="8"/><path d="M13 12h6M13 32h6M27 32h4"/><rect x="19" y="8" width="8" height="8"/><rect x="19" y="28" width="8" height="8"/><rect x="31" y="28" width="8" height="8"/>'),
        },
      ],
    },
    {
      id: 'diseno',
      nombre: 'Diseño de algoritmos',
      descripcion: 'Estrategias generales para atacar problemas: explorar con poda, decidir codiciosamente o reutilizar subproblemas.',
      temas: [
        {
          id: 'backtracking',
          titulo: 'Backtracking',
          resumen: 'El problema de las n reinas: construir soluciones paso a paso y retroceder al encontrar un conflicto.',
          visualizaciones: 2,
          glifo: g('<rect x="6" y="6" width="32" height="32"/><path d="M14 6v32M22 6v32M30 6v32M6 14h32M6 22h32M6 30h32"/><path d="M8 8h4v4H8zM24 16h4v4h-4zM16 24h4v4h-4z" fill="currentColor"/>'),
        },
        {
          id: 'greedy',
          titulo: 'Greedy Algorithms',
          resumen: 'Selección de actividades, dar vuelto y códigos de Huffman: cuándo la mejor decisión local es óptima.',
          visualizaciones: 3,
          glifo: g('<circle cx="11" cy="14" r="7"/><circle cx="29" cy="13" r="5"/><circle cx="21" cy="30" r="4"/><circle cx="34" cy="30" r="3"/><path d="M11 11v6M29 11v4"/>'),
        },
        {
          id: 'dynamic-programming',
          titulo: 'Dynamic Programming',
          resumen: 'Subproblemas superpuestos, distancia de edición y mochila 0/1 llenando tablas paso a paso.',
          visualizaciones: 3,
          glifo: g('<rect x="6" y="6" width="32" height="32"/><path d="M14 6v32M22 6v32M30 6v32M6 14h32M6 22h32M6 30h32"/><path d="M14 22h8v8h-8z" fill="currentColor"/><path d="M18 18v-2M12 26h-2M14 18l-2-2"/>'),
        },
      ],
    },
    {
      id: 'grafos',
      nombre: 'Grafos',
      descripcion: 'Representaciones, recorridos, caminos más cortos y árboles de expansión mínima.',
      temas: [
        {
          id: 'graphs',
          titulo: 'Graphs',
          resumen: 'Definiciones y representaciones: matriz y listas de adyacencia sobre un grafo editable.',
          visualizaciones: 1,
          glifo: g('<circle cx="9" cy="10" r="4"/><circle cx="34" cy="9" r="4"/><circle cx="22" cy="23" r="4"/><circle cx="9" cy="35" r="4"/><circle cx="35" cy="34" r="4"/><path d="M12.5 12l6.5 8.5M31 11.5l-6 8.5M19 26l-7 6.5M25 26l7 6M13 10h17"/>'),
        },
        {
          id: 'dfs',
          titulo: 'DFS (Depth-First Search)',
          resumen: 'Búsqueda en profundidad con tiempos de descubrimiento y término, clasificación de aristas y orden topológico.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="7" r="3.5"/><circle cx="12" cy="19" r="3.5"/><circle cx="32" cy="19" r="3.5"/><circle cx="7" cy="32" r="3.5"/><circle cx="17" cy="32" r="3.5"/><path d="M20 10l-5.5 6.5M10 22l-2 6.5M14 22l2 6.5M24 10l5.5 6.5" /><path d="M22 7 12 19 7 32" stroke-width="2.6"/>'),
        },
        {
          id: 'bfs-dijkstra',
          titulo: 'BFS & Dijkstra',
          resumen: 'Caminos más cortos por capas con una cola y con pesos usando una cola de prioridad.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="22" r="3.5" fill="currentColor"/><circle cx="22" cy="22" r="10" stroke-dasharray="3 3"/><circle cx="22" cy="22" r="18" stroke-dasharray="3 3"/><circle cx="32" cy="22" r="2.5"/><circle cx="14" cy="38" r="2.5"/>'),
        },
        {
          id: 'bellman-ford',
          titulo: 'Bellman-Ford Algorithm',
          resumen: 'Caminos más cortos con pesos negativos y detección de ciclos negativos.',
          visualizaciones: 1,
          glifo: g('<circle cx="8" cy="22" r="4"/><circle cx="22" cy="9" r="4"/><circle cx="36" cy="22" r="4"/><circle cx="22" cy="35" r="4"/><path d="M11 19l8-7M25 12l8 7M33 25l-8 7M19 32l-8-7"/><path d="M15 21h-3M30 21h-3" /><text x="17" y="25" font-size="8" fill="currentColor" stroke="none">−3</text>'),
        },
        {
          id: 'kruskal',
          titulo: 'MST: Kruskal’s Algorithm',
          resumen: 'Árbol de expansión mínima agregando las aristas más livianas con union-find.',
          visualizaciones: 1,
          glifo: g('<circle cx="8" cy="10" r="3.5"/><circle cx="24" cy="7" r="3.5"/><circle cx="37" cy="17" r="3.5"/><circle cx="12" cy="30" r="3.5"/><circle cx="30" cy="36" r="3.5"/><path d="M11.5 9.5l9-2M9 13.5l2 13M15 32l12 3" stroke-width="2.6"/><path d="M27 8.5l7 6M34 20l-3 13" stroke-dasharray="2 3"/>'),
        },
        {
          id: 'prim',
          titulo: 'MST: Prim’s Algorithm',
          resumen: 'Árbol de expansión mínima que crece desde un vértice cruzando cortes.',
          visualizaciones: 1,
          glifo: g('<circle cx="22" cy="22" r="4" fill="currentColor"/><circle cx="8" cy="12" r="3.5" fill="currentColor"/><circle cx="36" cy="10" r="3.5"/><circle cx="10" cy="36" r="3.5"/><circle cx="35" cy="34" r="3.5"/><path d="M18.5 19.5l-7-5.5" stroke-width="2.6"/><path d="M25.5 19l7-6M19 25l-6 8M25.5 25l7 6.5" stroke-dasharray="2 3"/>'),
        },
        {
          id: 'caminos',
          titulo: 'Grid Pathfinding',
          resumen: 'BFS, DFS, Dijkstra, voraz y A* sobre una cuadrícula editable con muros y terreno costoso.',
          visualizaciones: 1,
          glifo: g('<rect x="6" y="6" width="32" height="32"/><path d="M6 17h11M27 6v15M17 28h21M17 17v11" /><path d="M10 34V24h12v-8h12V10" stroke-width="2.2"/>'),
        },
      ],
    },
    {
      id: 'representacion',
      nombre: 'Representación numérica',
      descripcion: 'Cómo una máquina finita guarda números reales y qué se pierde en el camino.',
      temas: [
        {
          id: 'punto-flotante',
          titulo: 'IEEE 754 Floating Point',
          resumen: 'Edite bit a bit un número de 16, 32 o 64 bits y observe la densidad irregular de los valores representables.',
          visualizaciones: 2,
          glifo: g('<rect x="4" y="16" width="6" height="12"/><rect x="12" y="16" width="12" height="12"/><rect x="26" y="16" width="14" height="12"/><path d="M16 16v12M20 16v12M30 16v12M35 16v12"/>'),
        },
      ],
    },
    {
      id: 'aprendizaje',
      nombre: 'Aprendizaje automático',
      descripcion: 'Optimización y agrupamiento: las piezas sobre las que se construyen los modelos.',
      temas: [
        {
          id: 'descenso-gradiente',
          titulo: 'Gradient Descent',
          resumen: 'GD, momento, Nesterov y Adam sobre superficies de pérdida con distinto condicionamiento.',
          visualizaciones: 2,
          glifo: g('<ellipse cx="22" cy="22" rx="18" ry="11"/><ellipse cx="22" cy="22" rx="11" ry="6.5"/><ellipse cx="22" cy="22" rx="4" ry="2.4"/><path d="M8 12l6 9 3-6 3 6 2-1" stroke-width="2"/>'),
        },
        {
          id: 'kmeans',
          titulo: 'k-Means Clustering',
          resumen: 'El algoritmo de Lloyd alternando asignación y actualización, con inicialización k-means++ y el método del codo.',
          visualizaciones: 2,
          glifo: g('<circle cx="12" cy="14" r="1.6" fill="currentColor"/><circle cx="8" cy="18" r="1.6" fill="currentColor"/><circle cx="14" cy="19" r="1.6" fill="currentColor"/><circle cx="30" cy="12" r="1.6" fill="currentColor"/><circle cx="34" cy="16" r="1.6" fill="currentColor"/><circle cx="22" cy="32" r="1.6" fill="currentColor"/><circle cx="27" cy="34" r="1.6" fill="currentColor"/><circle cx="24" cy="28" r="1.6" fill="currentColor"/><path d="M11 13l2 2m0-2l-2 2M31 13l2 2m0-2l-2 2M23 30l2 2m0-2l-2 2" stroke-width="1.3"/>'),
        },
      ],
    },
    {
      id: 'modelos',
      nombre: 'Modelos de computación',
      descripcion: 'Sistemas de reglas simples cuyo comportamiento colectivo puede ser sorprendentemente complejo.',
      temas: [
        {
          id: 'automatas',
          titulo: 'Cellular Automata',
          resumen: 'Las 256 reglas elementales de Wolfram y el Juego de la vida de Conway.',
          visualizaciones: 2,
          glifo: g('<path d="M20 6h4v4h-4zM16 10h4v4h-4zM24 10h4v4h-4zM12 14h4v4h-4zM28 14h4v4h-4zM8 18h4v4H8zM16 18h4v4h-4zM24 18h4v4h-4zM32 18h4v4h-4z" fill="currentColor" stroke="none"/><path d="M6 30h32M6 36h32" stroke-dasharray="4 2"/>'),
        },
      ],
    },
    {
      id: 'senales',
      nombre: 'Procesamiento de señales',
      descripcion: 'Descomponer señales en frecuencias: muestreo, espectros y series de Fourier.',
      temas: [
        {
          id: 'fourier',
          titulo: 'Fourier Transform',
          resumen: 'Componga una señal, observe su espectro discreto, el aliasing, la fuga espectral y el fenómeno de Gibbs.',
          visualizaciones: 2,
          glifo: g('<path d="M4 16c3-8 6-8 9 0s6 8 9 0 6-8 9 0 6 8 9 0"/><path d="M6 38V34M12 38V26M18 38V32M24 38V36M30 38V30M36 38V35"/>'),
        },
      ],
    },
  ];

  // Lista plana con referencias a la sección, útil para navegación.
  const temas = [];
  secciones.forEach((s, i) => {
    s.numero = String(i + 1).padStart(2, '0');
    s.temas.forEach((t, j) => {
      t.seccion = s;
      t.codigo = `${s.numero}.${j + 1}`;
      temas.push(t);
    });
  });

  return {
    secciones,
    temas,
    buscar(id) {
      return temas.find((t) => t.id === id) || null;
    },
  };
})();
