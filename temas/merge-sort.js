(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Merge sort ascendente: el arreglo después de cada pasada, con los bloques ya ordenados. */
  function montarPasadas(cuerpo) {
    let n = 32, tipo = 'aleatoria', semilla = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño n', min: 4, max: 64, valor: n, alCambiar: (v) => { n = v; lienzo.ajustar(true); } });
    ctl.selector({ etiqueta: 'Datos iniciales', opciones: VIZ.orden.DISTRIBUCIONES, valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; dibujar(); });

    const filaH = 58;
    const pasadas = () => Math.ceil(Math.log2(Math.max(2, n)));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (pasadas() + 1) * filaH + 8 });
    VIZ.leyenda(cuerpo, [
      { color: '#a9a8a0', texto: 'elemento' },
      { color: C.neutro, texto: 'bloque ordenado (alternado para distinguirlos)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);

    function dibujar() {
      if (lienzo.alto !== (pasadas() + 1) * filaH + 8) return lienzo.ajustar(true);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      let a = VIZ.orden.generar(n, tipo, VIZ.semilla(semilla * 97 + n));
      const izq = 118, der = 110;
      const paso = (W - izq - der) / n;
      const max = n;
      let total = 0;
      const filas = [{ a: a.slice(), ancho: 1, comp: 0 }];
      for (let w = 1; w < n; w *= 2) {
        const b = a.slice();
        let comp = 0;
        for (let lo = 0; lo < n; lo += 2 * w) {
          const mid = Math.min(lo + w, n), hi = Math.min(lo + 2 * w, n);
          let i = lo, j = mid, k = lo;
          while (i < mid && j < hi) { comp++; b[k++] = a[j] < a[i] ? a[j++] : a[i++]; }
          while (i < mid) b[k++] = a[i++];
          while (j < hi) b[k++] = a[j++];
        }
        a = b;
        total += comp;
        filas.push({ a: a.slice(), ancho: 2 * w, comp });
      }
      filas.forEach((f, r) => {
        const y0 = r * filaH + 6, base = y0 + filaH - 14;
        for (let lo = 0, b = 0; lo < n; lo += f.ancho, b++) {
          if (b % 2 === 0) {
            ctx.fillStyle = C.neutro;
            ctx.fillRect(izq + lo * paso, y0, Math.min(f.ancho, n - lo) * paso, base - y0 + 2);
          }
        }
        f.a.forEach((v, i) => {
          const h = (v / max) * (base - y0 - 4);
          ctx.fillStyle = r === filas.length - 1 ? C.tinta : '#a9a8a0';
          ctx.fillRect(izq + i * paso + (paso > 6 ? 1 : 0), base - h, Math.max(1, paso - (paso > 6 ? 2 : 0)), h);
        });
        ctx.font = VIZ.fuente(11);
        ctx.fillStyle = C.tinta2;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(r === 0 ? 'entrada' : `pasada ${r}`, 4, y0 + 14);
        ctx.fillStyle = C.apagado;
        ctx.fillText(`bloques de ${Math.min(f.ancho, n)}`, 4, y0 + 30);
        if (r > 0) ctx.fillText(`${f.comp} comparaciones`, W - der + 10, y0 + 22);
      });
      lectura.set([
        ['n', String(n)],
        ['pasadas', `${filas.length - 1} = ⌈log₂ ${n}⌉`],
        ['comparaciones totales', VIZ.entero(total)],
        ['n log₂ n', VIZ.entero(n * Math.log2(n))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('merge-sort', {
    intro: String.raw`
      <p><strong>Merge sort</strong> es el ejemplo clásico de <em>dividir y conquistar</em>: divide el arreglo en dos mitades,
      ordena cada una recursivamente y luego las <strong>mezcla</strong>. Mezclar dos secuencias ordenadas es fácil y rápido:
      basta comparar sus primeros elementos y sacar el menor, repitiendo hasta agotarlas.</p>
      <p>Su costo es \(\Theta(n \log n)\) siempre, sin importar los datos, y es estable. A cambio, necesita memoria auxiliar
      proporcional a \(n\).</p>`,
    visualizaciones: [
      {
        titulo: 'Merge sort paso a paso',
        descripcion: 'La zona sombreada es el subarreglo que se está mezclando. Las barras azules son los dos elementos que se comparan (uno de cada mitad); la naranja, la posición donde se escribe el menor.',
        montar: (c) => VIZ.orden.animacion(c, { alg: 'mezcla', n: 32 }),
      },
      {
        titulo: 'Las pasadas de la versión ascendente',
        descripcion: 'La variante <em>bottom-up</em> mezcla primero bloques de tamaño 1, luego 2, 4, 8… Cada fila muestra el arreglo tras una pasada; los bloques sombreados ya están ordenados. Cada pasada hace a lo más \\(n\\) comparaciones y hay \\(\\lceil \\log_2 n \\rceil\\) pasadas.',
        montar: montarPasadas,
      },
      {
        titulo: 'El costo casi no depende de los datos',
        descripcion: 'Comparaciones para distintas distribuciones. Todas quedan entre \\(\\tfrac12 n\\log_2 n\\) y \\(n \\log_2 n\\): con datos ya ordenados cada mezcla termina en cuanto se agota la mitad izquierda.',
        montar: (c) => VIZ.orden.curvas(c, { series: 'distribuciones', alg: 'mezcla' }),
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>mergesort(a, lo, hi):
    si lo ≥ hi: volver
    mid ← ⌊(lo + hi) / 2⌋
    mergesort(a, lo, mid)
    mergesort(a, mid + 1, hi)
    merge(a, lo, mid, hi)        ▹ usa un arreglo auxiliar</code></pre>
      <p>La mezcla copia \(a[lo..hi]\) a un auxiliar y vuelve a escribir el arreglo tomando, en cada paso, el menor de los primeros
      elementos de cada mitad. Si \(m\) es el tamaño total, hace a lo más \(m - 1\) comparaciones y exactamente \(m\) escrituras.
      Tomar el de la izquierda en caso de empate es lo que hace al algoritmo <strong>estable</strong>.</p>

      <h2>Recurrencia</h2>
      <p>Sea \(T(n)\) el costo para \(n\) elementos. Dividir es \(O(1)\) y mezclar es \(\Theta(n)\):</p>
      \[ T(n) = T\!\left(\lceil n/2 \rceil\right) + T\!\left(\lfloor n/2 \rfloor\right) + \Theta(n), \qquad T(1) = \Theta(1). \]
      <p><strong>Árbol de recursión.</strong> En el nivel \(k\) hay \(2^k\) subproblemas de tamaño \(n/2^k\), cuyo trabajo de mezcla
      suma \(\Theta(n)\). Hay \(\log_2 n\) niveles, por lo tanto \(T(n) = \Theta(n\log n)\). Para \(n\) potencia de 2 y contando
      comparaciones en el peor caso, la solución exacta es</p>
      \[ C(n) = n\log_2 n - n + 1. \]
      <p><strong>Teorema maestro.</strong> Para \(T(n) = a\,T(n/b) + f(n)\), si \(f(n) = \Theta(n^{\log_b a})\) entonces
      \(T(n) = \Theta(n^{\log_b a}\log n)\). Aquí \(a = b = 2\), \(\log_2 2 = 1\) y \(f(n) = \Theta(n)\).</p>

      <h2>Optimalidad</h2>
      <p>Todo algoritmo de ordenamiento por comparación necesita \(\lceil \log_2 n! \rceil = n\log_2 n - 1.44\,n + O(\log n)\)
      comparaciones en el peor caso (argumento del árbol de decisión). Merge sort está a menos de \(0.45\,n\) comparaciones de
      esa cota: es asintóticamente óptimo.</p>

      <h2>Memoria y variantes</h2>
      <ul>
        <li>Usa \(\Theta(n)\) memoria auxiliar para mezclar y \(O(\log n)\) para la pila de recursión. Existen mezclas en el lugar,
        pero son complicadas y lentas en la práctica.</li>
        <li>La versión <strong>ascendente</strong> (figura 2) evita la recursión: \(\lceil\log_2 n\rceil\) pasadas, cada una mezclando
        pares de bloques adyacentes.</li>
        <li>Es el algoritmo natural para <strong>ordenamiento externo</strong> (datos en disco) y para <strong>listas enlazadas</strong>,
        donde la mezcla no requiere memoria extra.</li>
        <li><strong>Timsort</strong> (Python, Java para objetos) detecta tramos ya ordenados en la entrada y los mezcla, logrando
        \(O(n)\) con datos ordenados y \(O(n\log n)\) en el peor caso.</li>
      </ul>`,
  });
})();
