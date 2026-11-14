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
    parametros: [
      ['Datos iniciales (Fig. 1)', String.raw`El orden de partida. Combinado con la elección del pivote, decide si las particiones salen equilibradas o vacías.`],
      ['Tamaño n (Fig. 1)', String.raw`Cantidad de elementos.`],
      ['Elección del pivote (Fig. 1 y 2)', String.raw`Qué elemento se usa para particionar: el último del subarreglo, uno al azar o la mediana entre el primero, el del medio y el último. Las dos últimas evitan el peor caso con datos ordenados.`],
      ['Velocidad y reproductor (Fig. 1)', String.raw`Reproducir avanza solo, Un paso muestra una comparación o intercambio, Hasta el final termina y Reiniciar vuelve al inicio.`],
      ['Medida, escala y casillas (Fig. 2)', String.raw`Elija comparaciones o escrituras, escala lineal o logarítmica, y qué distribuciones mostrar.`],
    ],
    visualizaciones: [
      {
        titulo: 'Quicksort paso a paso',
        descripcion: 'La barra violeta es el pivote, que se ubica al final del subarreglo sombreado. Las barras que lo superan se quedan atrás; las menores se intercambian hacia la izquierda. Pruebe datos <em>ya ordenados</em> con pivote «último elemento» y luego con «aleatorio».',
        ayuda: String.raw`<p>Las barras son los elementos. El tramo sombreado es el subarreglo que se está particionando y la barra violeta, su pivote. Las barras azules se comparan con el pivote; las naranjas se intercambian para dejar a la izquierda las menores. Al terminar, el pivote queda negro: ya está en su posición final.</p>
          <ul>
          <li><strong>Datos iniciales</strong> «Ya ordenada» con pivote <strong>último elemento</strong>: el pivote es siempre el máximo, cada partición deja un lado vacío y las comparaciones se acercan a «n²/2».</li>
          <li>Con pivote <strong>aleatorio</strong> o <strong>mediana de tres</strong> sobre los mismos datos, las particiones se equilibran y las comparaciones bajan a la zona de «n log₂ n».</li>
          <li><strong>Tamaño n</strong>: cuanto mayor, más se nota la diferencia entre un buen y un mal pivote.</li>
          </ul>`,
        montar: (c) => VIZ.orden.animacion(c, {
          alg: 'rapido', n: 40,
          extras: (ctl, api) => ctl.selector({ etiqueta: 'Elección del pivote', opciones: PIVOTES, valor: 'ultimo',
            alCambiar: (v) => { api.opciones.pivote = v; api.reiniciar(); } }),
        }),
      },
      {
        titulo: 'El efecto del pivote',
        descripcion: 'Comparaciones para cada distribución inicial. Con el último elemento como pivote, los datos ordenados o invertidos producen particiones vacías y costo cuadrático; elegir el pivote al azar o por mediana de tres lo evita.',
        ayuda: String.raw`<p>Cada curva es el número de comparaciones medido para una distribución inicial, con las referencias \(n^2/2\) y \(n\log_2 n\).</p>
          <ul>
          <li>Con pivote <strong>último elemento</strong>, las curvas «Ya ordenada» e «Invertida» suben hasta \(n^2/2\): es el peor caso.</li>
          <li>Cambie a <strong>aleatorio</strong> o <strong>mediana de tres</strong>: todas las curvas bajan juntas cerca de \(n\log_2 n\).</li>
          <li>«Pocos valores distintos» puede seguir siendo costosa con la partición de Lomuto, porque los elementos iguales se van todos a un lado.</li>
          </ul>`,
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
