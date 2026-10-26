(function () {
  'use strict';

  const PIVOTES = [['ultimo', 'Último elemento'], ['aleatorio', 'Aleatorio'], ['mediana3', 'Mediana de tres']];

  VIZ.registrarTema('quick-sort', {
    intro: String.raw`
      <p><strong>Quicksort</strong> también divide y conquista, pero hace el trabajo <em>antes</em> de recurrir: elige un elemento,
      el <strong>pivote</strong>, y <strong>particiona</strong> el arreglo dejando a su izquierda los menores y a su derecha los mayores.
      El pivote queda en su posición definitiva y basta ordenar recursivamente ambos lados; no hay que mezclar nada.</p>
      <p>Es el algoritmo de ordenamiento más usado en la práctica porque ordena en el lugar y tiene constantes muy pequeñas,
      pero su eficiencia depende de que los pivotes dividan el arreglo en partes de tamaño parecido.</p>`,
    visualizaciones: [
      {
        titulo: 'Quicksort paso a paso',
        descripcion: 'La barra violeta es el pivote, que se ubica al final del subarreglo sombreado. Las barras que lo superan se quedan atrás; las menores se intercambian hacia la izquierda. Pruebe datos <em>ya ordenados</em> con pivote «último elemento» y luego con «aleatorio».',
        montar: (c) => VIZ.orden.animacion(c, {
          alg: 'rapido', n: 40,
          extras: (ctl, api) => ctl.selector({ etiqueta: 'Elección del pivote', opciones: PIVOTES, valor: 'ultimo',
            alCambiar: (v) => { api.opciones.pivote = v; api.reiniciar(); } }),
        }),
      },
      {
        titulo: 'El efecto del pivote',
        descripcion: 'Comparaciones para cada distribución inicial. Con el último elemento como pivote, los datos ordenados o invertidos producen particiones vacías y costo cuadrático; elegir el pivote al azar o por mediana de tres lo evita.',
        montar: (c) => VIZ.orden.curvas(c, {
          series: 'distribuciones', alg: 'rapido',
          extras: (ctl, api) => ctl.selector({ etiqueta: 'Elección del pivote', opciones: PIVOTES, valor: 'ultimo',
            alCambiar: (v) => { api.opciones.pivote = v; api.recalcular(); } }),
        }),
      },
    ],
    teoria: String.raw`
      <h2>Partición de Lomuto</h2>
      <pre><code>partition(a, lo, hi):          ▹ pivote en a[hi]
    p ← a[hi];  i ← lo
    para j ← lo hasta hi − 1:
        si a[j] &lt; p:
            intercambiar a[i] y a[j];  i ← i + 1
    intercambiar a[i] y a[hi]
    devolver i</code></pre>
      <p><strong>Invariante:</strong> \(a[lo..i-1] &lt; p\) y \(a[i..j-1] \ge p\). Al terminar, el pivote se intercambia a la posición
      \(i\), que es su lugar definitivo. La partición hace exactamente \(m-1\) comparaciones para un subarreglo de tamaño \(m\).
      La partición de <em>Hoare</em>, con dos índices que avanzan desde los extremos, hace en promedio tres veces menos
      intercambios.</p>

      <h2>Peor y mejor caso</h2>
      <p>Si la partición deja \(k\) elementos a la izquierda: \(T(n) = T(k) + T(n-1-k) + \Theta(n)\).</p>
      <ul>
        <li><strong>Peor caso:</strong> el pivote es siempre el mínimo o el máximo (\(k = 0\)). Entonces
        \(T(n) = T(n-1) + \Theta(n) = \Theta(n^2)\); con el último elemento como pivote, ocurre con datos ya ordenados.
        Además la recursión alcanza profundidad \(n\).</li>
        <li><strong>Mejor caso:</strong> particiones balanceadas, \(T(n) = 2T(n/2) + \Theta(n) = \Theta(n\log n)\).</li>
        <li>Incluso particiones desbalanceadas en proporción fija, por ejemplo 1 a 9, dan
        \(T(n) = T(n/10) + T(9n/10) + \Theta(n) = \Theta(n\log n)\): la profundidad es \(\log_{10/9} n\).</li>
      </ul>

      <h2>Caso promedio</h2>
      <p>Con pivote aleatorio (o entrada aleatoria), sea \(z_1 &lt; \dots &lt; z_n\) el arreglo ordenado. Los elementos \(z_i\) y \(z_j\)
      se comparan a lo más una vez, y solo si uno de ellos es el <em>primer</em> pivote elegido dentro de \(\{z_i, \dots, z_j\}\);
      de otro modo, un pivote intermedio los separa para siempre. Esto ocurre con probabilidad \(2/(j-i+1)\), así que</p>
      \[ \mathbb{E}[C_n] = \sum_{i&lt;j} \frac{2}{j-i+1} = 2(n+1)H_n - 4n \;\approx\; 2n\ln n \;\approx\; 1.39\, n\log_2 n, \]
      <p>donde \(H_n = \sum_{k=1}^n 1/k \approx \ln n\). Es solo un 39 % más que la cota inferior, y como cada comparación es muy
      barata (recorrido secuencial, sin arreglo auxiliar), quicksort suele ser el más rápido en la práctica.</p>

      <h2>Elección del pivote</h2>
      <ul>
        <li><strong>Aleatorio:</strong> el costo esperado es \(O(n\log n)\) para <em>toda</em> entrada; el peor caso sigue existiendo
        pero ocurre con probabilidad despreciable.</li>
        <li><strong>Mediana de tres</strong> (primero, medio, último): evita el peor caso en datos ordenados y reduce el promedio a
        \(\approx 1.19\, n\log_2 n\) comparaciones.</li>
        <li><strong>Muchos repetidos:</strong> la partición de Lomuto degrada a \(\Theta(n^2)\) si todos los elementos son iguales;
        la partición en tres vías (menores, iguales, mayores) de Dijkstra lo resuelve.</li>
        <li><strong>Introsort</strong> (C++ <code>std::sort</code>) cambia a heapsort si la recursión es demasiado profunda,
        garantizando \(O(n\log n)\) en el peor caso.</li>
      </ul>
      <p>Recurrir primero en la parte más pequeña (y eliminar la recursión de cola en la otra) limita la pila a \(O(\log n)\).
      Quicksort <strong>no es estable</strong>.</p>`,
  });
})();
