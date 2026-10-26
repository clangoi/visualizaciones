(function () {
  'use strict';

  VIZ.registrarTema('ordenamiento', {
    intro: String.raw`
      <p>Esta página compara lado a lado los algoritmos de ordenamiento que se estudian por separado en esta sección.</p>
      <p>Ordenar es reorganizar una secuencia \(a_0, a_1, \dots, a_{n-1}\) para que quede en orden no decreciente.
      Es uno de los problemas más estudiados de la computación porque aparece en todas partes —bases de datos,
      búsqueda, compresión, gráficos— y porque ilustra con claridad cómo distintas estrategias para resolver
      un mismo problema pueden tener costos radicalmente diferentes.</p>
      <p>Los algoritmos que se muestran son <em>por comparación</em>: la única forma que tienen de obtener información
      sobre los datos es preguntar si \(a_i &lt; a_j\). Contar cuántas veces hacen esa pregunta es la medida natural de su costo.</p>`,
    visualizaciones: [
      {
        titulo: 'Ordenamiento paso a paso',
        descripcion: 'Cada barra es un elemento y su altura es su valor. Elija un algoritmo y una distribución inicial; observe qué pares compara y cuándo escribe. Pruebe quicksort con datos <em>ya ordenados</em> para ver su peor caso.',
        montar: (c) => VIZ.orden.animacion(c, { selector: true, alg: 'rapido', n: 48 }),
      },
      {
        titulo: 'Costo frente al tamaño de la entrada',
        descripcion: 'Número de comparaciones (o escrituras) medido al ejecutar cada algoritmo para n = 10, 20, …, 200. Pase el cursor sobre el gráfico para leer los valores.',
        montar: (c) => VIZ.orden.curvas(c, { series: 'algoritmos' }),
      },
    ],
    teoria: String.raw`
      <h2>Modelo de costo</h2>
      <p>Se mide el tiempo de un algoritmo como una función \(T(n)\) del tamaño de la entrada, contando operaciones
      elementales (comparaciones o escrituras). Interesa el comportamiento cuando \(n\) crece, por lo que se usa
      notación asintótica: \(T(n) = \Theta(g(n))\) significa que existen constantes \(c_1, c_2 &gt; 0\) y \(n_0\) tales que
      \(c_1 g(n) \le T(n) \le c_2 g(n)\) para todo \(n \ge n_0\).</p>

      <table>
        <thead><tr><th>Algoritmo</th><th>Mejor caso</th><th>Caso promedio</th><th>Peor caso</th><th>Memoria extra</th><th>Estable</th></tr></thead>
        <tbody>
          <tr><td>Burbuja</td><td>\(\Theta(n)\)</td><td>\(\Theta(n^2)\)</td><td>\(\Theta(n^2)\)</td><td>\(O(1)\)</td><td>sí</td></tr>
          <tr><td>Selección</td><td>\(\Theta(n^2)\)</td><td>\(\Theta(n^2)\)</td><td>\(\Theta(n^2)\)</td><td>\(O(1)\)</td><td>no</td></tr>
          <tr><td>Inserción</td><td>\(\Theta(n)\)</td><td>\(\Theta(n^2)\)</td><td>\(\Theta(n^2)\)</td><td>\(O(1)\)</td><td>sí</td></tr>
          <tr><td>Mezcla</td><td>\(\Theta(n \log n)\)</td><td>\(\Theta(n \log n)\)</td><td>\(\Theta(n \log n)\)</td><td>\(O(n)\)</td><td>sí</td></tr>
          <tr><td>Rápido</td><td>\(\Theta(n \log n)\)</td><td>\(\Theta(n \log n)\)</td><td>\(\Theta(n^2)\)</td><td>\(O(\log n)\) pila</td><td>no</td></tr>
          <tr><td>Montículo</td><td>\(\Theta(n \log n)\)</td><td>\(\Theta(n \log n)\)</td><td>\(\Theta(n \log n)\)</td><td>\(O(1)\)</td><td>no</td></tr>
        </tbody>
      </table>

      <h2>Algoritmos cuadráticos e inversiones</h2>
      <p>Selección siempre recorre el resto del arreglo para hallar el mínimo, así que hace exactamente</p>
      \[ \sum_{i=0}^{n-2} (n-1-i) = \frac{n(n-1)}{2} \]
      <p>comparaciones, sin importar los datos. Inserción, en cambio, depende de cuán desordenada esté la entrada.
      Una <strong>inversión</strong> es un par \((i, j)\) con \(i &lt; j\) y \(a_i &gt; a_j\). Cada intercambio de elementos
      adyacentes elimina exactamente una inversión, por lo que inserción realiza \(I\) intercambios y a lo más \(I + n - 1\)
      comparaciones, donde \(I\) es el número de inversiones. Para una permutación aleatoria, cada par está invertido con
      probabilidad \(1/2\):</p>
      \[ \mathbb{E}[I] = \binom{n}{2}\cdot\frac{1}{2} = \frac{n(n-1)}{4}. \]
      <p>Por eso inserción es excelente con datos <em>casi ordenados</em> (pocas inversiones) y se usa como caso base
      en implementaciones híbridas como Timsort o introsort.</p>

      <h2>Dividir y conquistar: mezcla</h2>
      <p>Merge sort divide el arreglo en dos mitades, las ordena recursivamente y las mezcla en tiempo lineal.
      Su costo satisface la recurrencia</p>
      \[ T(n) = 2\,T\!\left(\tfrac{n}{2}\right) + \Theta(n), \qquad T(1) = \Theta(1). \]
      <p>El árbol de recursión tiene \(\log_2 n\) niveles y cada nivel realiza trabajo \(\Theta(n)\) en total,
      de modo que \(T(n) = \Theta(n \log n)\). Formalmente, es el segundo caso del <strong>teorema maestro</strong>: para
      \(T(n) = a\,T(n/b) + f(n)\) con \(f(n) = \Theta(n^{\log_b a})\), se tiene \(T(n) = \Theta(n^{\log_b a}\log n)\);
      aquí \(a = b = 2\) y \(n^{\log_2 2} = n\).</p>

      <h2>Quicksort y el pivote</h2>
      <p>Quicksort elige un pivote, particiona el arreglo en menores y mayores, y recurre en ambas partes. Si la partición
      deja \(k\) elementos a un lado, \(T(n) = T(k) + T(n-1-k) + \Theta(n)\). Con particiones balanceadas se obtiene
      \(\Theta(n\log n)\); en el peor caso (\(k = 0\) siempre, lo que ocurre aquí con datos ya ordenados porque el pivote es el
      último elemento) se obtiene</p>
      \[ T(n) = T(n-1) + \Theta(n) = \Theta(n^2). \]
      <p>Si el pivote se elige al azar, el número esperado de comparaciones es</p>
      \[ \mathbb{E}[C_n] = 2(n+1)H_n - 4n \approx 2n\ln n \approx 1.39\, n\log_2 n, \]
      <p>donde \(H_n = \sum_{k=1}^{n} 1/k\) es el número armónico. La idea clave de la demostración: los elementos de rangos
      \(i &lt; j\) se comparan si y solo si uno de ellos es el primer pivote elegido entre \(\{i, \dots, j\}\), lo que ocurre con
      probabilidad \(2/(j-i+1)\).</p>

      <h2>Cota inferior para ordenar por comparación</h2>
      <p>Cualquier algoritmo por comparación puede verse como un <strong>árbol de decisión</strong> binario: cada nodo es una
      comparación y cada hoja una permutación de salida. Como debe distinguir las \(n!\) permutaciones posibles, el árbol
      tiene al menos \(n!\) hojas y su altura \(h\) cumple \(2^h \ge n!\). Usando la aproximación de Stirling:</p>
      \[ h \;\ge\; \log_2 n! \;=\; n\log_2 n - n\log_2 e + O(\log n) \;=\; \Omega(n \log n). \]
      <p>Por lo tanto mezcla y montículo son <em>asintóticamente óptimos</em>. Esta cota no aplica a métodos que no comparan,
      como counting sort o radix sort, que aprovechan la estructura de las claves para lograr tiempo lineal.</p>`,
  });
})();
