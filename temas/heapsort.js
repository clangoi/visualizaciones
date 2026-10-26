(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const MAX = 31;

  /* ---------- Fig. 1: montículo interactivo ---------- */

  function montarMonticulo(cuerpo) {
    let a = [], n = 0, ev = {}, listo = new Set(), mensaje = '', comp = 0, cola = null, velocidad = 3, instantaneo = false;

    const intercambiar = (i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
    function* subir(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        comp++;
        yield { cmp: [i, p] };
        if (a[i] <= a[p]) break;
        intercambiar(i, p);
        yield { mov: [i, p] };
        i = p;
      }
    }
    function* hundir(i, m) {
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let g = i;
        if (l < m) { comp++; yield { cmp: [l, g] }; if (a[l] > a[g]) g = l; }
        if (r < m) { comp++; yield { cmp: [r, g] }; if (a[r] > a[g]) g = r; }
        if (g === i) return;
        intercambiar(i, g);
        yield { mov: [i, g] };
        i = g;
      }
    }
    const ops = {
      *insertar(v) {
        if (listo.size) { a = a.slice(0, n); listo.clear(); }
        if (n >= MAX) { mensaje = `El montículo admite a lo más ${MAX} elementos en esta figura.`; return; }
        a[n] = v; n++;
        mensaje = `Insertar ${v}: se agrega al final (posición ${n - 1}) y sube mientras sea mayor que su padre.`;
        yield { mov: [n - 1] };
        yield* subir(n - 1);
        mensaje = `Insertado ${v}.`;
      },
      *extraer() {
        if (listo.size) { a = a.slice(0, n); listo.clear(); }
        if (!n) { mensaje = 'El montículo está vacío.'; return; }
        const max = a[0];
        mensaje = `Extraer el máximo (${max}): el último elemento pasa a la raíz y se hunde.`;
        intercambiar(0, n - 1);
        yield { mov: [0, n - 1] };
        n--; a.pop();
        yield* hundir(0, n);
        mensaje = `Extraído ${max}.`;
      },
      *construir(k) {
        listo.clear();
        a = Array.from({ length: k }, () => 1 + Math.floor(Math.random() * 99));
        n = k;
        mensaje = `Construcción de Floyd: se hunde cada nodo interno, desde ⌊n/2⌋ − 1 = ${(n >> 1) - 1} hasta la raíz.`;
        yield {};
        for (let i = (n >> 1) - 1; i >= 0; i--) yield* hundir(i, n);
        mensaje = `Montículo construido con ${comp} comparaciones (cota: 2n = ${2 * n}).`;
      },
      *heapsort() {
        listo.clear();
        mensaje = 'Heapsort: primero se asegura la propiedad de montículo…';
        for (let i = (n >> 1) - 1; i >= 0; i--) yield* hundir(i, n);
        const total = n;
        for (let m = n - 1; m > 0; m--) {
          mensaje = `Se intercambia la raíz (máximo, ${a[0]}) con la posición ${m}, que queda definitiva.`;
          intercambiar(0, m);
          listo.add(m);
          n = m;
          yield { mov: [0, m] };
          yield* hundir(0, m);
        }
        if (total) listo.add(0);
        n = 0;
        mensaje = `Arreglo ordenado con ${comp} comparaciones.`;
      },
    };

    function ejecutar(gen) {
      bucle.detener();
      comp = 0;
      cola = gen;
      if (instantaneo) { while (!cola.next().done); cola = null; ev = {}; dibujar(); return; }
      acum = 1;
      bucle.iniciar();
    }
    let acum = 0;
    const bucle = VIZ.bucle((dt) => {
      acum += (dt / 1000) * Math.pow(2, velocidad);
      while (acum >= 1) {
        acum -= 1;
        const r = cola.next();
        if (r.done) { cola = null; ev = {}; dibujar(); return false; }
        ev = r.value || {};
      }
      dibujar();
      return true;
    });

    const ctl = VIZ.controles(cuerpo);
    const entrada = ctl.numero({ etiqueta: 'Valor', min: 1, max: 99, valor: 50 });
    ctl.rango({ etiqueta: 'Velocidad', min: 0, max: 6, paso: 0.5, valor: velocidad, formato: (v) => `${+Math.pow(2, v).toFixed(1)} pasos/s`, alCambiar: (v) => { velocidad = v; } });
    ctl.casilla({ etiqueta: 'sin animación', valor: instantaneo, alCambiar: (v) => { instantaneo = v; } });
    ctl.boton('Insertar', () => ejecutar(ops.insertar(Math.max(1, Math.min(99, Math.round(entrada.valor) || 1)))), { primario: true });
    ctl.boton('Insertar aleatorio', () => { const v = 1 + Math.floor(Math.random() * 99); entrada.valor = v; ejecutar(ops.insertar(v)); });
    ctl.boton('Extraer máximo', () => ejecutar(ops.extraer()));
    ctl.boton('Construir con 15 aleatorios', () => ejecutar(ops.construir(15)));
    ctl.boton('Construir con 31 aleatorios', () => ejecutar(ops.construir(31)));
    ctl.boton('Heapsort', () => ejecutar(ops.heapsort()));

    const lienzo = VIZ.lienzo(cuerpo, { alto: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'comparación', forma: 'punto' },
      { color: C.s2, texto: 'intercambio', forma: 'punto' },
      { color: C.tinta, texto: 'ya ordenado (fuera del montículo)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    const nota = VIZ.nota(cuerpo, '');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cmp = new Set(ev.cmp || []), mov = new Set(ev.mov || []);
      const altura = n ? Math.floor(Math.log2(n)) : 0;
      const dy = 54, r = Math.min(15, (W - 20) / 34);
      const pos = (i) => {
        const d = Math.floor(Math.log2(i + 1)), k = i - (2 ** d - 1);
        return [((k + 0.5) / 2 ** d) * (W - 20) + 10, 26 + d * dy];
      };
      // Árbol (solo la parte que es montículo)
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.eje;
      for (let i = 1; i < n; i++) {
        const [x, y] = pos(i), [px, py] = pos((i - 1) >> 1);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const [x, y] = pos(i);
        const col = mov.has(i) ? C.s2 : cmp.has(i) ? C.s1 : null;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = col || C.superficie;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = col || C.tinta;
        ctx.stroke();
        ctx.fillStyle = col ? '#fff' : C.tinta;
        ctx.font = VIZ.fuente(r > 12 ? 12 : 10, 500);
        ctx.fillText(String(a[i]), x, y);
      }
      if (!n && !a.length) {
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(12);
        ctx.fillText('Montículo vacío: inserte valores o construya uno aleatorio.', W / 2, 80);
      }
      // Arreglo
      const yA = 26 + 4 * dy + 28;
      const celda = Math.min(36, (W - 20) / MAX);
      const ox = (W - celda * Math.max(a.length, 1)) / 2;
      for (let i = 0; i < a.length; i++) {
        const x = ox + i * celda;
        const col = mov.has(i) ? C.s2 : cmp.has(i) ? C.s1 : listo.has(i) ? C.tinta : null;
        ctx.fillStyle = col || C.superficie;
        ctx.fillRect(x + 1, yA, celda - 2, celda - 2);
        ctx.strokeStyle = col || C.eje;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1.5, yA + 0.5, celda - 3, celda - 3);
        ctx.fillStyle = col ? '#fff' : C.tinta;
        ctx.font = VIZ.fuente(celda > 28 ? 12 : 10, 500);
        ctx.fillText(String(a[i]), x + celda / 2, yA + celda / 2 - 1);
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(9);
        ctx.fillText(String(i), x + celda / 2, yA + celda + 8);
      }
      if (a.length) {
        ctx.fillStyle = C.tinta2;
        ctx.font = VIZ.fuente(11);
        ctx.textAlign = 'left';
        ctx.fillText('arreglo:', 4, yA - 10);
        if (n < a.length && n > 0) {
          const xs = ox + n * celda;
          ctx.strokeStyle = C.tinta;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(xs, yA - 6); ctx.lineTo(xs, yA + celda + 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      lectura.set([
        ['tamaño del montículo', String(n)],
        ['altura', n ? `${altura} = ⌊log₂ ${n}⌋` : '—'],
        ['máximo', n ? String(a[0]) : '—'],
        ['comparaciones (operación)', String(comp)],
      ]);
      nota.textContent = mensaje || 'En el arreglo, los hijos de la posición i están en 2i + 1 y 2i + 2, y su padre en ⌊(i − 1)/2⌋.';
    }
    lienzo.alDibujar = dibujar;
    instantaneo = true;
    ejecutar(ops.construir(15));
    instantaneo = false;
    mensaje = '';
    dibujar();
  }

  /* ---------- Fig. 2: construir un montículo en tiempo lineal ---------- */

  function montarConstruccion(cuerpo) {
    let tipo = 'aleatoria', hover = null;
    const tamanos = [];
    for (let n = 50; n <= 2000; n += 50) tamanos.push(n);

    function medir() {
      return tamanos.map((n) => {
        const base = VIZ.orden.generar(n, tipo, VIZ.semilla(n * 7));
        // Floyd
        let a = base.slice(), c1 = 0;
        const hundir = (i, m) => {
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let g = i;
            if (l < m) { c1++; if (a[l] > a[g]) g = l; }
            if (r < m) { c1++; if (a[r] > a[g]) g = r; }
            if (g === i) return;
            [a[i], a[g]] = [a[g], a[i]];
            i = g;
          }
        };
        for (let i = (n >> 1) - 1; i >= 0; i--) hundir(i, n);
        // Inserciones sucesivas
        const h = [];
        let c2 = 0;
        for (const v of base) {
          h.push(v);
          let i = h.length - 1;
          while (i > 0) {
            const p = (i - 1) >> 1;
            c2++;
            if (h[i] <= h[p]) break;
            [h[i], h[p]] = [h[p], h[i]];
            i = p;
          }
        }
        return { n, floyd: c1, ins: c2 };
      });
    }
    let datos = medir();
    const SERIES = [['floyd', 'Floyd (hundir desde abajo)', C.s1], ['ins', 'Inserciones sucesivas', C.s2]];

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Datos iniciales', opciones: VIZ.orden.DISTRIBUCIONES, valor: tipo, alCambiar: (v) => { tipo = v; datos = medir(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...SERIES.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })),
      { color: C.apagado, texto: 'referencias 2n y n log₂ n', forma: 'linea' },
    ]);
    VIZ.nota(cuerpo, 'Con datos ordenados de forma creciente, cada inserción sube hasta la raíz y el costo es Θ(n log n); la construcción de Floyd nunca supera 2n comparaciones.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(2000 * Math.log2(2000), ...datos.map((d) => d.ins)) * 1.05;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 2000, ymin: 0, ymax }, { etiquetaX: 'n', etiquetaY: 'comparaciones para construir', margen: { der: 70 } });
      plano.ejes();
      ctx.save();
      plano.recortar();
      VIZ.trazar(ctx, plano, [[0, 0], [2000, 4000]], C.apagado, 1, [3, 4]);
      const ref = [];
      for (let n = 2; n <= 2000; n += 20) ref.push([n, n * Math.log2(n)]);
      VIZ.trazar(ctx, plano, ref, C.apagado, 1, [3, 4]);
      for (const [k, , c] of SERIES) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d[k]]), c, 2);
        if (hover) VIZ.marcador(ctx, plano.sx(hover.n), plano.sy(hover[k]), c, 4);
      }
      ctx.restore();
      ctx.fillStyle = C.apagado;
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      ctx.fillText('2n', plano.x1 + 6, plano.sy(4000));
      ctx.fillText('n log₂ n', plano.x1 + 6, plano.sy(2000 * Math.log2(2000)));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const n = Math.round(plano.ix(x) / 50) * 50;
      hover = datos.find((d) => d.n === n) || null;
      dibujar();
      if (hover) tip.mostrar(x, y, `n = <b>${n}</b>` + SERIES.map(([k, t, c]) => VIZ.filaTooltip(c, t, VIZ.entero(hover[k]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('heapsort', {
    intro: String.raw`
      <p>Un <strong>heap</strong> (montículo binario de máximo) es un árbol binario casi completo en el que cada nodo es mayor o igual
      que sus hijos; por lo tanto, la raíz es el máximo. Como el árbol es casi completo, se guarda sin punteros en un arreglo:
      los hijos de la posición \(i\) están en \(2i+1\) y \(2i+2\).</p>
      <p>Es la implementación estándar de una <strong>cola de prioridad</strong>: insertar y extraer el máximo cuestan
      \(O(\log n)\). <strong>Heapsort</strong> usa un montículo para ordenar en el lugar en \(O(n\log n)\) garantizado.</p>`,
    visualizaciones: [
      {
        titulo: 'Operaciones de un montículo',
        descripcion: 'El mismo montículo visto como árbol y como arreglo. Inserte valores, extraiga el máximo, construya un montículo aleatorio o ejecute heapsort: la línea punteada del arreglo separa el montículo de la parte ya ordenada.',
        montar: montarMonticulo,
      },
      {
        titulo: 'Construir un montículo en tiempo lineal',
        descripcion: 'Comparaciones necesarias para construir un montículo de \\(n\\) elementos insertándolos uno a uno, frente al método de Floyd que hunde los nodos internos de abajo hacia arriba.',
        montar: montarConstruccion,
      },
    ],
    teoria: String.raw`
      <h2>Propiedad de montículo</h2>
      <p>Un arreglo \(a[0..n-1]\) es un montículo de máximo si \(a[\lfloor (i-1)/2 \rfloor] \ge a[i]\) para todo \(i \ge 1\). El árbol
      es <em>casi completo</em> (todos los niveles llenos salvo el último, que se llena de izquierda a derecha), así que su altura es
      \(h = \lfloor \log_2 n \rfloor\).</p>

      <h2>Operaciones</h2>
      <ul>
        <li><strong>Subir</strong> (<em>sift-up</em>): mientras el nodo sea mayor que su padre, se intercambian. Restaura la propiedad
        tras insertar al final. Costo \(O(h) = O(\log n)\).</li>
        <li><strong>Hundir</strong> (<em>sift-down</em>, <em>heapify</em>): mientras el nodo sea menor que su hijo mayor, se intercambian.
        Restaura la propiedad tras poner el último elemento en la raíz al extraer el máximo. Hace 2 comparaciones por nivel:
        \(O(\log n)\).</li>
        <li><strong>Consultar el máximo:</strong> \(O(1)\).</li>
      </ul>

      <h2>Construcción en tiempo lineal</h2>
      <p>Floyd (1964) observó que basta hundir cada nodo interno, desde \(\lfloor n/2 \rfloor - 1\) hasta la raíz. Un nodo a altura
      \(k\) cuesta \(O(k)\) y hay a lo más \(\lceil n/2^{k+1} \rceil\) nodos a altura \(k\):</p>
      \[ \sum_{k=0}^{\lfloor \log_2 n \rfloor} \left\lceil \frac{n}{2^{k+1}} \right\rceil O(k) \;=\; O\!\left(n \sum_{k \ge 0} \frac{k}{2^k}\right) = O(2n) = O(n). \]
      <p>La intuición: la mayoría de los nodos están cerca de las hojas y se hunden poco. Insertar uno por uno, en cambio, hace subir
      muchos nodos desde abajo y cuesta \(\Theta(n\log n)\) en el peor caso.</p>

      <h2>Heapsort</h2>
      <pre><code>construir montículo en a[0..n−1]
para m ← n − 1 hasta 1:
    intercambiar a[0] y a[m]     ▹ el máximo pasa a su lugar final
    hundir(0) en a[0..m−1]</code></pre>
      <p>Costo: \(O(n)\) para construir más \(n-1\) hundimientos de \(O(\log n)\), es decir \(\Theta(n\log n)\) en el peor caso, y solo
      \(O(1)\) memoria extra. Es <em>selection sort</em> con una estructura que encuentra el máximo en tiempo logarítmico.
      En la práctica es más lento que quicksort por su mal uso de la caché (los saltos \(i \to 2i+1\) recorren el arreglo de forma
      dispersa) y no es estable.</p>

      <h2>Colas de prioridad</h2>
      <p>Los montículos son la base de Dijkstra, Prim, la codificación de Huffman, la planificación de procesos y la mezcla de
      \(k\) listas ordenadas en \(O(n\log k)\). Variantes como los montículos de Fibonacci reducen <em>disminuir clave</em> a
      \(O(1)\) amortizado.</p>`,
  });
})();
