/* Catálogo de secciones y temas.
   Para añadir un tema: agréguelo a una sección aquí y cree temas/<id>.js. */
window.CATALOGO = (function () {
  'use strict';

  // Glifos monocromos de 44×44 para las tarjetas.
  const g = (cuerpo) =>
    `<svg class="tarjeta-glifo" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${cuerpo}</svg>`;

  const secciones = [
    {
      id: 'algoritmos',
      nombre: 'Algoritmos',
      descripcion: 'Procedimientos fundamentales y la forma en que su costo crece con el tamaño de la entrada.',
      temas: [
        {
          id: 'ordenamiento',
          titulo: 'Algoritmos de ordenamiento',
          resumen: 'Burbuja, inserción, selección, mezcla, rápido y montículo paso a paso, con conteo de comparaciones.',
          visualizaciones: 2,
          glifo: g('<path d="M6 38V30M13 38V22M20 38V26M27 38V14M34 38V8"/><path d="M4 38h36"/>'),
        },
        {
          id: 'busqueda-binaria',
          titulo: 'Búsqueda binaria',
          resumen: 'Cómo dividir el espacio de búsqueda a la mitad en cada paso y el árbol de decisión que se forma.',
          visualizaciones: 2,
          glifo: g('<circle cx="22" cy="8" r="3"/><circle cx="12" cy="22" r="3"/><circle cx="32" cy="22" r="3"/><circle cx="6" cy="36" r="3"/><circle cx="18" cy="36" r="3"/><path d="M20 10l-6 10M24 10l6 10M10.5 24.5L7.5 33.5M13.5 24.5l3 9"/>'),
        },
        {
          id: 'complejidad',
          titulo: 'Crecimiento asintótico',
          resumen: 'Comparación de órdenes de crecimiento y la definición formal de O grande con su constante y n₀.',
          visualizaciones: 3,
          glifo: g('<path d="M6 38h32M6 38V6"/><path d="M6 36C18 34 26 28 34 8"/><path d="M6 34c10-4 20-7 32-9" stroke-dasharray="2 3"/>'),
        },
      ],
    },
    {
      id: 'grafos',
      nombre: 'Grafos',
      descripcion: 'Recorridos y caminos mínimos sobre grafos representados como cuadrículas.',
      temas: [
        {
          id: 'caminos',
          titulo: 'Búsqueda de caminos',
          resumen: 'BFS, DFS, Dijkstra, voraz y A* sobre una cuadrícula editable con muros y terreno costoso.',
          visualizaciones: 1,
          glifo: g('<rect x="6" y="6" width="32" height="32"/><path d="M6 17h11M27 6v15M17 28h21M17 17v11" /><path d="M10 34V24h12v-8h12V10" stroke-width="2.2"/>'),
        },
      ],
    },
    {
      id: 'estructuras',
      nombre: 'Estructuras de datos',
      descripcion: 'Formas de organizar información para que las operaciones frecuentes sean rápidas.',
      temas: [
        {
          id: 'hash',
          titulo: 'Tablas hash',
          resumen: 'Encadenamiento y direccionamiento abierto: colisiones, sondeos y el efecto del factor de carga.',
          visualizaciones: 2,
          glifo: g('<rect x="5" y="8" width="8" height="8"/><rect x="5" y="18" width="8" height="8"/><rect x="5" y="28" width="8" height="8"/><path d="M13 12h6M13 32h6M27 32h4"/><rect x="19" y="8" width="8" height="8"/><rect x="19" y="28" width="8" height="8"/><rect x="31" y="28" width="8" height="8"/>'),
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
          titulo: 'Punto flotante IEEE 754',
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
          titulo: 'Descenso de gradiente',
          resumen: 'GD, momento, Nesterov y Adam sobre superficies de pérdida con distinto condicionamiento.',
          visualizaciones: 2,
          glifo: g('<ellipse cx="22" cy="22" rx="18" ry="11"/><ellipse cx="22" cy="22" rx="11" ry="6.5"/><ellipse cx="22" cy="22" rx="4" ry="2.4"/><path d="M8 12l6 9 3-6 3 6 2-1" stroke-width="2"/>'),
        },
        {
          id: 'kmeans',
          titulo: 'Agrupamiento k-medias',
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
          titulo: 'Autómatas celulares',
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
          titulo: 'Transformada de Fourier',
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
