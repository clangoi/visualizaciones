(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Fig. 1: subproblemas superpuestos (Fibonacci) ---------- */

  function montarFibonacci(cuerpo) {
    let n = 6, memo = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'n', min: 2, max: 7, valor: n, alCambiar: (v) => { n = v; lienzo.ajustar(true); } });
    ctl.casilla({ etiqueta: 'usar memoización', valor: memo, alCambiar: (v) => { memo = v; lienzo.ajustar(true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => n * 52 + 30 });
    const leyenda = VIZ.leyenda(cuerpo);
    const lectura = VIZ.lectura(cuerpo);

    function arbol() {
      const vistos = new Set();
      let llamadas = 0;
      const rec = (k) => {
        llamadas++;
        const nodo = { k, izq: null, der: null, memo: false };
        if (memo && vistos.has(k)) { nodo.memo = true; return nodo; }
        if (k >= 2) { nodo.izq = rec(k - 1); nodo.der = rec(k - 2); }
        vistos.add(k);
        return nodo;
      };
      const raiz = rec(n);
      return { raiz, llamadas };
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const { raiz, llamadas } = arbol();
      VIZ.arbol.dibujarBinario(ctx, raiz, {
        x0: 6, y0: 20, ancho: W - 12, dy: 52,
        etiqueta: (q) => String(q.k),
        estilo: (q) => (q.memo ? { relleno: C.superficie, borde: VIZ.series[q.k], texto: C.tinta } : { relleno: VIZ.series[q.k], borde: VIZ.series[q.k], texto: '#fff' }),
      });
      leyenda.set([
        ...Array.from({ length: n + 1 }, (_, k) => ({ color: VIZ.series[k], texto: `fib(${k})`, forma: 'punto' })),
        ...(memo ? [{ color: C.superficie, borde: C.apagado, texto: 'resultado ya guardado (no recurre)', forma: 'punto' }] : []),
      ]);
      const fib = [0, 1];
      for (let k = 2; k <= 40; k++) fib.push(fib[k - 1] + fib[k - 2]);
      lectura.set([
        ['llamadas', String(llamadas)],
        ['sin memo: 2·F(n+1) − 1', String(2 * fib[n + 1] - 1)],
        ['con memo: 2n − 1', String(2 * n - 1)],
        ['fib(n)', String(fib[n])],
        ['sin memo para n = 40', VIZ.entero(2 * fib[41] - 1)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    VIZ.nota(cuerpo, 'Cada nodo es una llamada recursiva fib(k), coloreada según k. Sin memoización, los mismos subproblemas se recalculan una y otra vez; con ella, cada uno se calcula una sola vez.');
    dibujar();
  }

  /* Tabla genérica en canvas: filas × columnas con encabezados. */
  function dibujarTabla(ctx, W, o) {
    const { filas, cols, valor, encabFila, encabCol, estilo } = o;
    const c = Math.max(22, Math.min(40, (W - 70) / (cols + 1)));
    const ox = Math.max(4, (W - c * (cols + 1.6)) / 2), oy = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < cols; j++) {
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11, 600);
      ctx.fillText(encabCol(j), ox + (j + 1.6) * c, oy + c / 2);
    }
    for (let i = 0; i < filas; i++) {
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11, 600);
      ctx.fillText(encabFila(i), ox + 0.8 * c / 1.0 - 4, oy + (i + 1.5) * c);
      for (let j = 0; j < cols; j++) {
        const x = ox + (j + 1.1) * c, y = oy + (i + 1) * c;
        const est = estilo(i, j) || {};
        ctx.fillStyle = est.fondo || C.superficie;
        ctx.fillRect(x, y, c, c);
        ctx.strokeStyle = C.rejilla;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, c - 1, c - 1);
        if (est.borde) { ctx.strokeStyle = est.borde; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, c - 3, c - 3); }
        const v = valor(i, j);
        if (v != null) {
          ctx.fillStyle = est.texto || C.tinta;
          ctx.font = VIZ.fuente(c > 30 ? 12 : 10, 500);
          ctx.fillText(String(v), x + c / 2, y + c / 2 + 0.5);
        }
      }
    }
    return { c, ox, oy, alto: oy + (filas + 1) * c + 4 };
  }
  const altoTabla = (W, filas, cols) => { const c = Math.max(22, Math.min(40, (W - 70) / (cols + 1))); return 8 + (filas + 1) * c + 4; };

  /* ---------- Fig. 2: distancia de edición ---------- */

  function montarEdicion(cuerpo) {
    let a = 'algoritmo', b = 'logaritmo', D, i0, j0, camino, fase;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Palabra A', valor: a, alCambiar: (v) => { a = (v || 'a').slice(0, 14); rep.reiniciar(); } });
    ctl.texto({ etiqueta: 'Palabra B', valor: b, alCambiar: (v) => { b = (v || 'b').slice(0, 14); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 9 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => altoTabla(w, a.length + 1, b.length + 1) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'celda que se calcula' },
      { color: C.superficie, borde: C.s3, texto: 'celdas de las que depende' },
      { color: C.superficie, borde: C.s2, texto: 'camino de la solución' },
    ]);
    const alineacion = el('pre', { class: 'mono', style: { fontSize: '14px', margin: '12px 0 0', padding: '10px 12px', background: '#f6f6f4', border: '1px solid #e1e0d9', lineHeight: '1.5' } });
    cuerpo.appendChild(alineacion);
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);

    function iniciar() {
      const m = a.length, n = b.length;
      D = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null));
      i0 = -1; j0 = -1; camino = null; fase = 'llenar';
      registro.textContent = 'D[i][j] = distancia entre los primeros i caracteres de A y los primeros j de B.';
      return (function* () {
        for (let i = 0; i <= m; i++) {
          for (let j = 0; j <= n; j++) {
            i0 = i; j0 = j;
            if (!i) { D[i][j] = j; registro.textContent = `D[0][${j}] = ${j}: convertir la palabra vacía en «${b.slice(0, j)}» requiere ${j} inserciones.`; }
            else if (!j) { D[i][j] = i; registro.textContent = `D[${i}][0] = ${i}: borrar los ${i} primeros caracteres de A.`; }
            else {
              const igual = a[i - 1] === b[j - 1];
              const op = [D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (igual ? 0 : 1)];
              D[i][j] = Math.min(...op);
              registro.textContent = `D[${i}][${j}] = mín(borrar ${op[0]}, insertar ${op[1]}, ${igual ? `'${a[i - 1]}' = '${b[j - 1]}' sin costo` : `reemplazar '${a[i - 1]}'→'${b[j - 1]}'`} ${op[2]}) = ${D[i][j]}`;
            }
            yield;
          }
        }
        // Reconstrucción
        fase = 'camino';
        camino = new Set();
        const ops = [];
        let i = m, j = n;
        camino.add(`${i},${j}`);
        while (i > 0 || j > 0) {
          if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { ops.push([a[i - 1], b[j - 1], a[i - 1] === b[j - 1] ? ' ' : '*']); i--; j--; }
          else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push([a[i - 1], '-', 'B']); i--; }
          else { ops.push(['-', b[j - 1], 'I']); j--; }
          camino.add(`${i},${j}`);
        }
        ops.reverse();
        i0 = -1; j0 = -1;
        alineacion.textContent = `A: ${ops.map((o) => o[0]).join(' ')}\n   ${ops.map((o) => o[2]).join(' ')}\nB: ${ops.map((o) => o[1]).join(' ')}\n\n* reemplazo · B borrado · I inserción`;
        registro.textContent = `Distancia de edición = ${D[m][n]}. Siguiendo hacia atrás qué término dio el mínimo se recupera una secuencia óptima de operaciones.`;
        yield;
      })();
    }
    function dibujar() {
      if (lienzo.alto !== altoTabla(lienzo.ancho, a.length + 1, b.length + 1)) return lienzo.ajustar(true);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const dep = new Set();
      if (i0 > 0 && j0 > 0) ['-1,0', '0,-1', '-1,-1'].forEach((d) => { const [x, y] = d.split(',').map(Number); dep.add(`${i0 + x},${j0 + y}`); });
      else if (i0 > 0) dep.add(`${i0 - 1},${j0}`);
      else if (j0 > 0) dep.add(`${i0},${j0 - 1}`);
      const max = Math.max(a.length, b.length);
      dibujarTabla(ctx, W, {
        filas: a.length + 1, cols: b.length + 1,
        valor: (i, j) => D[i][j],
        encabFila: (i) => (i ? a[i - 1] : 'ε'), encabCol: (j) => (j ? b[j - 1] : 'ε'),
        estilo: (i, j) => {
          if (i === i0 && j === j0) return { fondo: C.s1, texto: '#fff' };
          const f = D[i][j] == null ? {} : { fondo: VIZ.css(VIZ.enRampa((D[i][j] / max) * 0.5, VIZ.rampa)), texto: C.tinta };
          if (camino && camino.has(`${i},${j}`)) f.borde = C.s2;
          if (dep.has(`${i},${j}`)) f.borde = C.s3;
          return f;
        },
      });
      if (fase === 'llenar') alineacion.textContent = 'La alineación aparecerá al terminar de llenar la tabla.';
      lectura.set([['|A|', String(a.length)], ['|B|', String(b.length)], ['celdas', String((a.length + 1) * (b.length + 1))], ['distancia', camino ? String(D[a.length][b.length]) : '—']]);
    }
    lienzo.alDibujar = () => D && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 3: mochila 0/1 ---------- */

  function montarMochila(cuerpo) {
    let nItems = 5, cap = 10, semilla = 3, items, T, i0, j0, elegidos, fase;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Objetos', min: 2, max: 7, valor: nItems, alCambiar: (v) => { nItems = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Capacidad W', min: 3, max: 16, valor: cap, alCambiar: (v) => { cap = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 9 });
    ctl.boton('Nuevos objetos', () => { semilla++; rep.reiniciar(); });
    const fichas = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 12px', fontFamily: 'var(--mono)', fontSize: '12.5px' } });
    cuerpo.appendChild(fichas);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => altoTabla(w, nItems + 1, cap + 1) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'celda que se calcula' },
      { color: C.superficie, borde: C.s3, texto: 'sin el objeto (arriba)' },
      { color: C.superficie, borde: C.s7, texto: 'con el objeto (arriba, w columnas a la izquierda)' },
      { color: C.superficie, borde: C.s2, texto: 'reconstrucción' },
    ]);
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);

    function iniciar() {
      const rnd = VIZ.semilla(semilla * 59 + nItems);
      items = Array.from({ length: nItems }, (_, k) => ({ nombre: String.fromCharCode(65 + k), w: 1 + Math.floor(rnd() * 6), v: 1 + Math.floor(rnd() * 10) }));
      T = Array.from({ length: nItems + 1 }, () => new Array(cap + 1).fill(null));
      i0 = -1; j0 = -1; elegidos = null; fase = 'llenar';
      registro.textContent = 'T[i][c] = mayor valor posible usando solo los primeros i objetos con capacidad c.';
      return (function* () {
        for (let i = 0; i <= nItems; i++) {
          for (let c = 0; c <= cap; c++) {
            i0 = i; j0 = c;
            if (!i) { T[i][c] = 0; registro.textContent = 'Sin objetos, el valor es 0.'; yield; continue; }
            const it = items[i - 1];
            const sin = T[i - 1][c];
            if (it.w > c) { T[i][c] = sin; registro.textContent = `T[${i}][${c}]: ${it.nombre} pesa ${it.w} > ${c}, no cabe → ${sin}.`; }
            else {
              const con = T[i - 1][c - it.w] + it.v;
              T[i][c] = Math.max(sin, con);
              registro.textContent = `T[${i}][${c}] = máx(sin ${it.nombre}: ${sin}, con ${it.nombre}: T[${i - 1}][${c - it.w}] + ${it.v} = ${con}) = ${T[i][c]}`;
            }
            yield;
          }
        }
        fase = 'camino';
        elegidos = new Set();
        let c = cap;
        for (let i = nItems; i > 0; i--) if (T[i][c] !== T[i - 1][c]) { elegidos.add(i); c -= items[i - 1].w; }
        i0 = -1; j0 = -1;
        registro.textContent = `Valor óptimo ${T[nItems][cap]}. Recorriendo desde T[n][W]: si el valor cambia respecto de la fila anterior, el objeto se usó.`;
        yield;
      })();
    }
    function dibujar() {
      if (lienzo.alto !== altoTabla(lienzo.ancho, nItems + 1, cap + 1)) return lienzo.ajustar(true);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      fichas.innerHTML = items.map((it, k) => `<span style="border:1.5px solid ${elegidos && elegidos.has(k + 1) ? C.s2 : '#0b0b0b'};background:${elegidos && elegidos.has(k + 1) ? C.s2 : '#fff'};color:${elegidos && elegidos.has(k + 1) ? '#fff' : '#0b0b0b'};padding:3px 10px">${it.nombre} · peso ${it.w} · valor ${it.v}</span>`).join('');
      const it = i0 > 0 ? items[i0 - 1] : null;
      const vmax = Math.max(1, ...T.flat().filter((x) => x != null));
      const ruta = new Set();
      if (elegidos) { let c = cap; for (let i = nItems; i >= 0; i--) { ruta.add(`${i},${c}`); if (elegidos.has(i)) c -= items[i - 1].w; } }
      dibujarTabla(ctx, W, {
        filas: nItems + 1, cols: cap + 1,
        valor: (i, j) => T[i][j],
        encabFila: (i) => (i ? items[i - 1].nombre : '∅'), encabCol: (j) => String(j),
        estilo: (i, j) => {
          if (i === i0 && j === j0) return { fondo: C.s1, texto: '#fff' };
          const f = T[i][j] == null ? {} : { fondo: VIZ.css(VIZ.enRampa((T[i][j] / vmax) * 0.5)) };
          if (it && i === i0 - 1 && j === j0) f.borde = C.s3;
          if (it && i === i0 - 1 && it.w <= j0 && j === j0 - it.w) f.borde = C.s7;
          if (ruta.has(`${i},${j}`)) f.borde = C.s2;
          return f;
        },
      });
      const pesoUsado = elegidos ? [...elegidos].reduce((s, i) => s + items[i - 1].w, 0) : null;
      lectura.set([['n · W', `${nItems} · ${cap} = ${nItems * cap}`], ['valor óptimo', elegidos ? String(T[nItems][cap]) : '—'], ['peso usado', pesoUsado != null ? `${pesoUsado} de ${cap}` : '—'], ['objetos', elegidos ? [...elegidos].sort().map((i) => items[i - 1].nombre).join(', ') || 'ninguno' : '—']]);
    }
    lienzo.alDibujar = () => T && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('dynamic-programming', {
    intro: String.raw`
      <p>La <strong>programación dinámica</strong> resuelve problemas descomponiéndolos en subproblemas más pequeños, como dividir y conquistar,
      pero con una diferencia clave: los subproblemas <em>se repiten</em>. En vez de resolverlos una y otra vez, se resuelve cada uno
      <strong>una sola vez</strong> y se guarda su respuesta en una tabla.</p>
      <p>El resultado suele ser espectacular: algoritmos exponenciales se vuelven polinomiales. La dificultad está en encontrar la
      <strong>recurrencia</strong> correcta, es decir, cómo se expresa la solución de un problema en términos de soluciones de subproblemas.</p>`,
    visualizaciones: [
      {
        titulo: 'Subproblemas superpuestos',
        descripcion: 'El árbol de llamadas de la definición recursiva de Fibonacci. Active la memoización para ver cuántas llamadas se evitan.',
        montar: montarFibonacci,
      },
      {
        titulo: 'Distancia de edición',
        descripcion: 'Mínimo número de inserciones, borrados y reemplazos de caracteres para transformar A en B. Cada celda depende de tres vecinas ya calculadas.',
        montar: montarEdicion,
      },
      {
        titulo: 'Mochila 0/1',
        descripcion: 'Elegir objetos que quepan en una mochila de capacidad W maximizando su valor total. Cada objeto se toma entero o no se toma.',
        montar: montarMochila,
      },
    ],
    teoria: String.raw`
      <h2>Cuándo aplica</h2>
      <ul>
        <li><strong>Subestructura óptima:</strong> una solución óptima se compone de soluciones óptimas de subproblemas.</li>
        <li><strong>Subproblemas superpuestos:</strong> la recursión natural vuelve a encontrarse con los mismos subproblemas muchas veces.</li>
      </ul>
      <p>Si los subproblemas no se repiten (como en merge sort), basta dividir y conquistar. Si se repiten, la programación dinámica
      convierte un árbol de recursión exponencial en un grafo acíclico de subproblemas, cuyo tamaño determina el costo:</p>
      \[ T = (\text{número de subproblemas}) \times (\text{trabajo por subproblema}). \]

      <h2>Memoización y tabulación</h2>
      <p><strong>Memoización</strong> (de arriba hacia abajo): se escribe la recursión y se guarda cada resultado la primera vez que se calcula.
      <strong>Tabulación</strong> (de abajo hacia arriba): se llena una tabla en un orden en que cada celda solo depende de celdas ya calculadas.
      Ambas tienen el mismo costo asintótico; la tabulación evita la pila de recursión y a menudo permite ahorrar memoria guardando solo las
      últimas filas.</p>
      <p>Para Fibonacci, la recursión ingenua hace \(2F_{n+1} - 1 = \Theta(\varphi^n)\) llamadas, con \(\varphi \approx 1.618\); con memoización, \(2n - 1\).</p>

      <h2>Distancia de edición (Levenshtein)</h2>
      <p>Sea \(D[i][j]\) la distancia entre los prefijos \(A[1..i]\) y \(B[1..j]\). La última operación de una transformación óptima es borrar
      \(A_i\), insertar \(B_j\) o alinear \(A_i\) con \(B_j\) (gratis si son iguales):</p>
      \[ D[i][j] = \min\begin{cases} D[i-1][j] + 1 \\ D[i][j-1] + 1 \\ D[i-1][j-1] + [A_i \ne B_j] \end{cases}
         \qquad D[i][0] = i,\quad D[0][j] = j. \]
      <p>Costo \(\Theta(mn)\) en tiempo; en memoria basta \(\Theta(\min(m,n))\) si solo se quiere el valor. Variantes de esta recurrencia
      se usan en correctores ortográficos, <code>diff</code> y alineamiento de secuencias de ADN (Needleman–Wunsch).</p>

      <h2>Mochila 0/1</h2>
      <p>Con objetos de pesos \(w_i\) y valores \(v_i\), y capacidad \(W\), sea \(T[i][c]\) el mejor valor usando los primeros \(i\) objetos con capacidad \(c\):</p>
      \[ T[i][c] = \begin{cases} T[i-1][c] &amp; \text{si } w_i &gt; c \\ \max\big(T[i-1][c],\; T[i-1][c - w_i] + v_i\big) &amp; \text{si no.} \end{cases} \]
      <p>El costo es \(\Theta(nW)\). Parece polinomial, pero \(W\) se escribe con \(\log W\) bits: el algoritmo es <strong>pseudopolinomial</strong>,
      exponencial en el tamaño de la entrada. No es una contradicción: el problema de la mochila es NP-difícil. A diferencia de la
      mochila fraccionaria (donde se pueden tomar partes de un objeto), aquí el criterio <a href="tema.html?id=greedy">codicioso</a> por
      valor/peso no es óptimo.</p>

      <h2>Receta</h2>
      <ol>
        <li>Definir con precisión qué significa cada subproblema (qué representa \(T[\dots]\)).</li>
        <li>Escribir la recurrencia pensando en la <em>última decisión</em> de una solución óptima.</li>
        <li>Identificar los casos base y un orden de cálculo compatible con las dependencias.</li>
        <li>Guardar qué opción dio el óptimo (o recalcularlo) para reconstruir la solución, no solo su valor.</li>
      </ol>
      <p>Otros ejemplos: <a href="tema.html?id=bellman-ford">Bellman-Ford</a>, Floyd–Warshall, la subsecuencia común más larga, la
      multiplicación óptima de matrices y el algoritmo de Viterbi.</p>`,
  });
})();
