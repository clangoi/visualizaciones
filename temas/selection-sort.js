(function () {
  'use strict';

  VIZ.registrarTema('selection-sort', {
    intro: String.raw`
      <p><strong>Selection sort</strong> construye el resultado de izquierda a derecha: en la iteración \(i\) busca el menor
      elemento de la parte aún desordenada \(a[i..n-1]\) y lo intercambia con \(a[i]\). Tras esa iteración, las primeras
      \(i+1\) posiciones contienen los \(i+1\) menores elementos, ya en su lugar definitivo.</p>
      <p>Es el algoritmo más fácil de analizar: su número de comparaciones no depende en absoluto de los datos.</p>`,
    visualizaciones: [
      {
        titulo: 'Selection sort paso a paso',
        descripcion: 'La barra violeta es la posición \\(i\\) que se está llenando; las azules, el mínimo provisional y el candidato que se compara con él. Las barras negras ya están en su posición final.',
        montar: (c) => VIZ.orden.animacion(c, { alg: 'seleccion', n: 32 }),
      },
      {
        titulo: 'El costo no depende de los datos',
        descripcion: 'Comparaciones medidas para distintas distribuciones iniciales: las cinco curvas coinciden con \\(n(n-1)/2\\). Cambie a «escrituras» para ver que, en cambio, el número de intercambios es a lo más \\(n-1\\).',
        montar: (c) => VIZ.orden.curvas(c, { series: 'distribuciones', alg: 'seleccion' }),
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>para i ← 0 hasta n − 2:
    m ← i
    para j ← i + 1 hasta n − 1:
        si a[j] &lt; a[m]: m ← j
    intercambiar a[i] y a[m]</code></pre>
      <p><strong>Invariante:</strong> al comenzar la iteración \(i\), el prefijo \(a[0..i-1]\) está ordenado y todo elemento del
      prefijo es menor o igual que todo elemento de \(a[i..n-1]\). La búsqueda del mínimo lo preserva y al terminar (\(i = n-1\))
      el arreglo completo está ordenado.</p>

      <h2>Análisis</h2>
      <p>La iteración \(i\) compara \(a[m]\) con cada uno de los \(n-1-i\) elementos restantes, sin importar sus valores:</p>
      \[ C(n) = \sum_{i=0}^{n-2} (n-1-i) = \sum_{k=1}^{n-1} k = \frac{n(n-1)}{2} = \Theta(n^2) \]
      <p>en el mejor, peor y caso promedio. En cambio, realiza a lo más \(n-1\) intercambios (\(3(n-1)\) asignaciones), lo que lo
      hace atractivo cuando escribir en memoria es mucho más caro que leer, por ejemplo en memorias flash.</p>
      <p>El número de veces que se actualiza el mínimo provisional sí depende de los datos: para una permutación aleatoria, en la
      iteración \(i\) es el número de nuevos mínimos de una secuencia aleatoria de largo \(n-i\), cuyo valor esperado es
      \(H_{n-i} - 1\). En total, \(\Theta(n \log n)\) actualizaciones esperadas.</p>

      <h2>Propiedades</h2>
      <ul>
        <li><strong>En el lugar:</strong> usa memoria extra \(O(1)\).</li>
        <li><strong>No es estable:</strong> el intercambio puede saltar un elemento sobre otro igual. Por ejemplo, en
        \([2_a, 2_b, 1]\) el primer intercambio produce \([1, 2_b, 2_a]\).</li>
        <li><strong>No es adaptativo:</strong> tarda lo mismo con datos ya ordenados.</li>
      </ul>
      <p>Si el mínimo se obtiene con una estructura más eficiente que un recorrido lineal —un montículo—, la misma idea da
      lugar a <a href="tema.html?id=heapsort">heapsort</a>, que ordena en \(\Theta(n\log n)\).</p>`,
  });
})();
