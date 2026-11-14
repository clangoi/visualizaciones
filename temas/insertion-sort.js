(function () {
  'use strict';

  VIZ.registrarTema('insertion-sort', {
    intro: String.raw`
      <p><strong>Insertion sort</strong> ordena como se ordena una mano de cartas: mantiene un prefijo ordenado y toma, uno por
      uno, los elementos siguientes para <em>insertarlos</em> en su lugar dentro del prefijo, desplazando hacia la derecha
      los que son mayores.</p>
      <p>Aunque en el peor caso es cuadrático, es muy rápido con datos casi ordenados y con arreglos pequeños, por lo que
      las implementaciones de bibliotecas reales lo usan como pieza de algoritmos híbridos.</p>`,
    parametros: [
      ['Datos iniciales (Fig. 1)', String.raw`El orden de partida. Aquí sí importa: con datos ordenados el algoritmo casi no trabaja y con datos invertidos hace el máximo.`],
      ['Tamaño n (Fig. 1)', String.raw`Cantidad de elementos que se ordenan.`],
      ['Velocidad y reproductor (Fig. 1)', String.raw`Reproducir avanza solo, Un paso muestra una comparación, Hasta el final termina y Reiniciar vuelve al arreglo inicial.`],
      ['Medida (Fig. 2)', String.raw`Comparaciones entre elementos o escrituras al arreglo.`],
      ['Escala vertical y casillas (Fig. 2)', String.raw`La escala logarítmica muestra el caso lineal como una recta muy por debajo de las curvas cuadráticas; las casillas ocultan o muestran cada distribución.`],
    ],
    visualizaciones: [
      {
        titulo: 'Insertion sort paso a paso',
        descripcion: 'La zona sombreada es el prefijo ya procesado. Cada elemento nuevo se desplaza hacia la izquierda mientras sea menor que su vecino. Compare las «inversiones iniciales» con el número de intercambios realizados.',
        ayuda: String.raw`<p>Las barras son los elementos. La zona sombreada a la izquierda es el prefijo ya ordenado; el elemento que entra se compara (azul) con su vecino izquierdo y se intercambia (naranja) mientras sea menor.</p>
          <ul>
          <li>Cada intercambio corrige exactamente una <em>inversión</em> (un par en orden equivocado), por eso «intercambios» termina igual a «inversiones iniciales».</li>
          <li><strong>Datos iniciales</strong>: con «Ya ordenada» no hay inversiones y cada elemento se compara una sola vez (costo lineal); con «Invertida» hay \(n(n-1)/2\) inversiones; con «Casi ordenada», pocas.</li>
          <li><strong>Tamaño n</strong>: con datos aleatorios las comparaciones quedan cerca de \(n^2/4\), la mitad de la referencia «n²/2».</li>
          </ul>`,
        montar: (c) => VIZ.orden.animacion(c, {
          alg: 'insercion', n: 32,
          lecturasExtra: (original, a, e) => [['inversiones iniciales', VIZ.entero(VIZ.orden.inversiones(original))], ['intercambios', VIZ.entero(e.esc / 2)]],
        }),
      },
      {
        titulo: 'Mejor, peor y caso promedio',
        descripcion: 'Con datos ya ordenados el costo es lineal; con datos invertidos, \\(n(n-1)/2\\); con datos aleatorios, cerca de \\(n^2/4\\). Use escala logarítmica para ver la recta del caso lineal.',
        ayuda: String.raw`<p>Cada curva es el costo de insertion sort medido para una distribución inicial, en función de \(n\). Las líneas punteadas \(n^2/2\) y \(n\log_2 n\) sirven de referencia.</p>
          <ul>
          <li>La curva «Invertida» coincide con \(n^2/2\) (peor caso), «Aleatoria» queda en la mitad (\(n^2/4\)) y «Ya ordenada» es casi plana: \(n-1\) comparaciones.</li>
          <li>En <strong>escala logarítmica</strong>, la curva de datos ordenados aparece como una recta de pendiente menor: es la diferencia entre costo lineal y cuadrático.</li>
          <li>Con <strong>Escrituras</strong> se cuenta el movimiento de datos, que es proporcional al número de inversiones.</li>
          </ul>`,
        montar: (c) => VIZ.orden.curvas(c, { series: 'distribuciones', alg: 'insercion' }),
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>para i ← 1 hasta n − 1:
    j ← i
    mientras j &gt; 0 y a[j − 1] &gt; a[j]:
        intercambiar a[j − 1] y a[j]
        j ← j − 1</code></pre>
      <p><strong>Invariante:</strong> al comenzar la iteración \(i\), el prefijo \(a[0..i-1]\) contiene los mismos elementos que
      originalmente, pero ordenados. Insertar \(a[i]\) en su lugar extiende el invariante a \(a[0..i]\).</p>

      <h2>Inversiones</h2>
      <p>Una <strong>inversión</strong> es un par de posiciones \(i &lt; j\) con \(a_i &gt; a_j\). Cada intercambio de vecinos
      adyacentes desordenados elimina <em>exactamente una</em> inversión y no crea otras. Como el arreglo ordenado no tiene
      inversiones, el número de intercambios es exactamente \(I\), el número de inversiones de la entrada, y el número de
      comparaciones está entre \(I\) y \(I + n - 1\):</p>
      \[ T(n) = \Theta(n + I). \]
      <ul>
        <li><strong>Mejor caso</strong> (ordenado): \(I = 0\), \(n-1\) comparaciones.</li>
        <li><strong>Peor caso</strong> (invertido): \(I = \binom{n}{2} = n(n-1)/2\).</li>
        <li><strong>Caso promedio</strong> (permutación aleatoria): cada par está invertido con probabilidad \(1/2\), así que por
        linealidad de la esperanza \(\mathbb{E}[I] = n(n-1)/4\).</li>
      </ul>
      <p>Esto también da una cota inferior: <em>cualquier</em> algoritmo que solo intercambie elementos adyacentes necesita
      \(\Omega(n^2)\) intercambios en promedio. Para superar esa barrera hay que mover elementos a distancia, como hacen
      Shell sort, merge sort o quicksort.</p>

      <h2>Propiedades</h2>
      <ul>
        <li><strong>Estable:</strong> un elemento nunca salta sobre otro igual (se detiene con \(a[j-1] \le a[j]\)).</li>
        <li><strong>En el lugar</strong> y <strong>en línea</strong>: puede ordenar los datos a medida que llegan.</li>
        <li><strong>Adaptativo:</strong> si cada elemento está a distancia a lo más \(k\) de su posición final, \(I \le nk\) y el
        costo es \(O(nk)\).</li>
      </ul>
      <p>Usando búsqueda binaria para hallar la posición de inserción las comparaciones bajan a \(O(n\log n)\), pero los
      desplazamientos siguen siendo \(\Theta(n^2)\) en el peor caso.</p>`,
  });
})();
