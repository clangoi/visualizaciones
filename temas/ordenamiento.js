(function () {
  'use strict';
  const { el, color: C } = VIZ;

  const intercambiar = (a, i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };

  /* Cada algoritmo es un generador que ordena `a` en el lugar,
     acumula conteos en `e` y emite eventos para la animación:
     cmp: índices comparados · mov: índices escritos · piv: pivote · rango: subarreglo activo. */
  const ALGORITMOS = {
    burbuja: {
      nombre: 'Burbuja',
      *fn(a, e) {
        const n = a.length;
        for (let i = 0; i < n - 1; i++) {
          let cambio = false;
          for (let j = 0; j < n - 1 - i; j++) {
            e.comp++;
            yield { cmp: [j, j + 1] };
            if (a[j] > a[j + 1]) {
              intercambiar(a, j, j + 1);
              e.esc += 2;
              cambio = true;
              yield { mov: [j, j + 1] };
            }
          }
          e.listo.add(n - 1 - i);
          if (!cambio) break;
        }
      },
    },
    seleccion: {
      nombre: 'Selección',
      *fn(a, e) {
        const n = a.length;
        for (let i = 0; i < n - 1; i++) {
          let m = i;
          for (let j = i + 1; j < n; j++) {
            e.comp++;
            yield { cmp: [m, j], piv: i };
            if (a[j] < a[m]) m = j;
          }
          if (m !== i) {
            intercambiar(a, i, m);
            e.esc += 2;
            yield { mov: [i, m] };
          }
          e.listo.add(i);
        }
      },
    },
    insercion: {
      nombre: 'Inserción',
      *fn(a, e) {
        for (let i = 1; i < a.length; i++) {
          let j = i;
          while (j > 0) {
            e.comp++;
            yield { cmp: [j - 1, j], rango: [0, i] };
            if (a[j - 1] > a[j]) {
              intercambiar(a, j - 1, j);
              e.esc += 2;
              yield { mov: [j - 1, j], rango: [0, i] };
              j--;
            } else break;
          }
        }
      },
    },
    mezcla: {
      nombre: 'Mezcla (merge sort)',
      *fn(a, e) {
        const aux = a.slice();
        function* ordenar(lo, hi) {
          if (hi <= lo) return;
          const mid = (lo + hi) >> 1;
          yield* ordenar(lo, mid);
          yield* ordenar(mid + 1, hi);
          for (let k = lo; k <= hi; k++) aux[k] = a[k];
          let i = lo, j = mid + 1;
          for (let k = lo; k <= hi; k++) {
            if (i > mid) a[k] = aux[j++];
            else if (j > hi) a[k] = aux[i++];
            else {
              e.comp++;
              yield { cmp: [i, j], rango: [lo, hi] };
              a[k] = aux[j] < aux[i] ? aux[j++] : aux[i++];
            }
            e.esc++;
            yield { mov: [k], rango: [lo, hi] };
          }
        }
        yield* ordenar(0, a.length - 1);
      },
    },
    rapido: {
      nombre: 'Rápido (quicksort)',
      *fn(a, e) {
        function* ordenar(lo, hi) {
          if (lo >= hi) {
            if (lo === hi) e.listo.add(lo);
            return;
          }
          const p = a[hi]; // pivote de Lomuto: último elemento
          let i = lo;
          for (let j = lo; j < hi; j++) {
            e.comp++;
            yield { cmp: [j, hi], piv: hi, rango: [lo, hi] };
            if (a[j] < p) {
              if (i !== j) {
                intercambiar(a, i, j);
                e.esc += 2;
                yield { mov: [i, j], piv: hi, rango: [lo, hi] };
              }
              i++;
            }
          }
          if (i !== hi) {
            intercambiar(a, i, hi);
            e.esc += 2;
            yield { mov: [i, hi], rango: [lo, hi] };
          }
          e.listo.add(i);
          yield* ordenar(lo, i - 1);
          yield* ordenar(i + 1, hi);
        }
        yield* ordenar(0, a.length - 1);
      },
    },
    monticulo: {
      nombre: 'Montículo (heapsort)',
      *fn(a, e) {
        const n = a.length;
        function* hundir(i, m) {
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let g = i;
            if (l < m) { e.comp++; yield { cmp: [l, g], rango: [0, m - 1] }; if (a[l] > a[g]) g = l; }
            if (r < m) { e.comp++; yield { cmp: [r, g], rango: [0, m - 1] }; if (a[r] > a[g]) g = r; }
            if (g === i) return;
            intercambiar(a, i, g);
            e.esc += 2;
            yield { mov: [i, g], rango: [0, m - 1] };
            i = g;
          }
        }
        for (let i = (n >> 1) - 1; i >= 0; i--) yield* hundir(i, n);
        for (let m = n - 1; m > 0; m--) {
          intercambiar(a, 0, m);
          e.esc += 2;
          e.listo.add(m);
          yield { mov: [0, m] };
          yield* hundir(0, m);
        }
      },
    },
  };
  const CLAVES = Object.keys(ALGORITMOS);

  const DISTRIBUCIONES = [
    ['aleatoria', 'Aleatoria'],
    ['casi', 'Casi ordenada'],
    ['invertida', 'Invertida'],
    ['pocos', 'Pocos valores distintos'],
    ['ordenada', 'Ya ordenada'],
  ];

  function generar(n, tipo, rnd) {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    const barajar = () => { for (let i = n - 1; i > 0; i--) intercambiar(a, i, Math.floor(rnd() * (i + 1))); };
    switch (tipo) {
      case 'aleatoria': barajar(); break;
      case 'casi':
        for (let k = 0; k < Math.max(1, Math.round(n / 12)); k++) {
          const i = Math.floor(rnd() * (n - 3));
          intercambiar(a, i, i + 1 + Math.floor(rnd() * 3));
        }
        break;
      case 'invertida': a.reverse(); break;
      case 'pocos':
        for (let i = 0; i < n; i++) a[i] = Math.ceil(((1 + Math.floor(rnd() * 4)) * n) / 4);
        break;
      default: break;
    }
    return a;
  }

  /* ---------- Fig. 1: animación paso a paso ---------- */

  function montarAnimacion(cuerpo) {
    let n = 48, tipo = 'aleatoria', alg = 'rapido', velocidad = 5;
    let semilla = 7;
    let a, e, gen, ev, terminado;

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', opciones: CLAVES.map((k) => [k, ALGORITMOS[k].nombre]), valor: alg,
      alCambiar: (v) => { alg = v; reiniciar(false); } });
    ctl.selector({ etiqueta: 'Datos iniciales', opciones: DISTRIBUCIONES, valor: tipo,
      alCambiar: (v) => { tipo = v; reiniciar(true); } });
    ctl.rango({ etiqueta: 'Tamaño n', min: 8, max: 160, valor: n, alCambiar: (v) => { n = v; reiniciar(true); } });
    ctl.rango({ etiqueta: 'Velocidad', min: 1, max: 10, valor: velocidad,
      formato: (v) => { const p = Math.pow(2, v - 4); return p < 1 ? `1 paso / ${1 / p} cuadros` : `${p} pasos / cuadro`; },
      alCambiar: (v) => { velocidad = v; } });
    const bPlay = ctl.boton('Reproducir', () => (bucle.activo ? bucle.detener() : iniciar()), { primario: true });
    ctl.boton('Un paso', () => { bucle.detener(); paso(); dibujar(); });
    ctl.boton('Nuevos datos', () => { semilla++; reiniciar(true); });
    ctl.boton('Reiniciar', () => reiniciar(false));

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: '#a9a8a0', texto: 'sin ordenar' },
      { color: C.s1, texto: 'comparación' },
      { color: C.s2, texto: 'escritura / intercambio' },
      { color: C.s7, texto: 'pivote o posición fija' },
      { color: C.tinta, texto: 'en su posición final' },
    ]);
    const lectura = VIZ.lectura(cuerpo);

    let original = null;
    function reiniciar(nuevos) {
      bucle.detener();
      if (nuevos || !original || original.length !== n) original = generar(n, tipo, VIZ.semilla(semilla * 7919 + n));
      a = original.slice();
      e = { comp: 0, esc: 0, pasos: 0, listo: new Set() };
      gen = ALGORITMOS[alg].fn(a, e);
      ev = {};
      terminado = false;
      dibujar();
    }

    function paso() {
      if (terminado) return false;
      const r = gen.next();
      if (r.done) {
        terminado = true;
        ev = {};
        for (let i = 0; i < a.length; i++) e.listo.add(i);
        return false;
      }
      ev = r.value;
      e.pasos++;
      return true;
    }

    let acumulado = 0;
    const bucle = VIZ.bucle(() => {
      acumulado += Math.pow(2, velocidad - 4);
      while (acumulado >= 1) {
        acumulado -= 1;
        if (!paso()) { dibujar(); return false; }
      }
      dibujar();
      return true;
    }, () => { bPlay.textContent = 'Reproducir'; });

    function iniciar() {
      if (terminado) reiniciar(false);
      acumulado = 1;
      bPlay.textContent = 'Pausar';
      bucle.iniciar();
    }

    let geom = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 8, der = 8, sup = 10, inf = 18;
      const anchoUtil = W - izq - der;
      const paso = anchoUtil / a.length;
      const hueco = paso > 7 ? 2 : paso > 3 ? 1 : 0;
      const max = Math.max(...a);
      const base = H - inf;
      geom = { izq, paso };

      if (ev.rango) {
        ctx.fillStyle = C.neutro;
        ctx.fillRect(izq + ev.rango[0] * paso, sup - 4, (ev.rango[1] - ev.rango[0] + 1) * paso, base - sup + 4);
      }
      const cmp = new Set(ev.cmp || []), mov = new Set(ev.mov || []);
      for (let i = 0; i < a.length; i++) {
        const h = Math.max(2, (a[i] / max) * (base - sup));
        let col = '#a9a8a0';
        if (e.listo.has(i)) col = C.tinta;
        if (ev.piv === i) col = C.s7;
        if (cmp.has(i)) col = C.s1;
        if (mov.has(i)) col = C.s2;
        ctx.fillStyle = col;
        const x = izq + i * paso + hueco / 2, w = Math.max(1, paso - hueco);
        ctx.beginPath();
        if (ctx.roundRect && w > 4) ctx.roundRect(x, base - h, w, h, [Math.min(4, w / 2), Math.min(4, w / 2), 0, 0]);
        else ctx.rect(x, base - h, w, h);
        ctx.fill();
      }
      ctx.strokeStyle = C.eje;
      ctx.beginPath();
      ctx.moveTo(izq, base + 0.5);
      ctx.lineTo(W - der, base + 0.5);
      ctx.stroke();
      if (terminado) {
        ctx.font = VIZ.fuente(11);
        ctx.fillStyle = C.tinta2;
        ctx.textBaseline = 'top';
        ctx.fillText('ordenado', izq, base + 4);
      }

      lectura.set([
        ['algoritmo', ALGORITMOS[alg].nombre.split(' ')[0]],
        ['n', String(a.length)],
        ['comparaciones', VIZ.entero(e.comp)],
        ['escrituras', VIZ.entero(e.esc)],
        ['n² / 2', VIZ.entero((a.length * a.length) / 2)],
        ['n log₂ n', VIZ.entero(a.length * Math.log2(a.length))],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (ev2) => {
      if (!geom) return;
      const { x, y } = lienzo.posicion(ev2);
      const i = Math.floor((x - geom.izq) / geom.paso);
      if (i < 0 || i >= a.length) return tip.ocultar();
      tip.mostrar(x, y, `posición <b>${i}</b><br>valor <b>${a[i]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());

    reiniciar(true);
  }

  /* ---------- Fig. 2: costo empírico frente a n ---------- */

  function montarCurvas(cuerpo) {
    let metrica = 'comp', tipo = 'aleatoria', logY = false;
    const tamanos = [];
    for (let n = 10; n <= 200; n += 10) tamanos.push(n);
    const cache = {};

    function datos() {
      if (cache[tipo]) return cache[tipo];
      const res = {};
      for (const k of CLAVES) res[k] = [];
      for (const n of tamanos) {
        const base = generar(n, tipo, VIZ.semilla(1000 + n));
        for (const k of CLAVES) {
          const a = base.slice();
          const e = { comp: 0, esc: 0, listo: new Set() };
          const g = ALGORITMOS[k].fn(a, e);
          while (!g.next().done);
          res[k].push({ n, comp: e.comp, esc: e.esc });
        }
      }
      return (cache[tipo] = res);
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Medida', opciones: [['comp', 'Comparaciones'], ['esc', 'Escrituras al arreglo']], valor: metrica,
      alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Datos iniciales', opciones: DISTRIBUCIONES, valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Escala vertical', opciones: [['lin', 'Lineal'], ['log', 'Logarítmica']], valor: 'lin',
      alCambiar: (v) => { logY = v === 'log'; dibujar(); } });
    const visibles = ctl.casillas(CLAVES.map((k, i) => ({ clave: k, texto: ALGORITMOS[k].nombre.split(' ')[0], color: VIZ.series[i] })), dibujar);

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...CLAVES.map((k, i) => ({ color: VIZ.series[i], texto: ALGORITMOS[k].nombre.split(' ')[0], forma: 'linea' })),
      { color: C.apagado, texto: 'referencias n²/2 y n log₂ n', forma: 'linea' },
    ]);
    VIZ.nota(cuerpo, 'Cada punto es una ejecución real del algoritmo sobre un arreglo de tamaño n. Cambie a escala logarítmica para comparar los algoritmos O(n log n) entre sí.');

    let plano = null, hoverN = null;
    function dibujar() {
      const D = datos();
      const { ctx } = lienzo;
      lienzo.limpiar();
      let ymax = 1;
      for (const [i, k] of CLAVES.entries()) {
        if (!visibles[k]) continue;
        for (const p of D[k]) ymax = Math.max(ymax, p[metrica]);
        void i;
      }
      ymax *= 1.05;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 200, ymin: logY ? 10 : 0, ymax }, {
        logY, etiquetaX: 'tamaño de la entrada n',
        etiquetaY: metrica === 'comp' ? 'comparaciones' : 'escrituras',
        margen: { izq: 60, der: 74 },
      });
      plano.ejes();
      ctx.save();
      plano.recortar();
      const ref = [
        ['n²/2', (n) => (n * n) / 2],
        ['n log₂ n', (n) => n * Math.log2(n)],
      ];
      const etiquetas = [];
      for (const [nombre, f] of ref) {
        const pts = [];
        for (let n = 2; n <= 200; n += 2) pts.push([n, f(n)]);
        VIZ.trazar(ctx, plano, pts, C.apagado, 1, [3, 4]);
        etiquetas.push({ y: plano.sy(f(200)), texto: nombre, color: C.apagado });
      }
      CLAVES.forEach((k, i) => {
        if (!visibles[k]) return;
        const pts = D[k].map((p) => [p.n, Math.max(p[metrica], logY ? 10 : 0)]);
        VIZ.trazar(ctx, plano, pts, VIZ.series[i], 2);
        if (hoverN != null) {
          const p = D[k].find((q) => q.n === hoverN);
          VIZ.marcador(ctx, plano.sx(p.n), plano.sy(Math.max(p[metrica], logY ? 10 : 0)), VIZ.series[i], 4);
        }
      });
      ctx.restore();
      // Etiquetas directas para las referencias a la derecha del área.
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      for (const et of etiquetas) {
        if (et.y < plano.y1 || et.y > plano.y0) continue;
        ctx.fillStyle = C.apagado;
        ctx.fillText(et.texto, plano.x1 + 6, et.y);
      }
      if (hoverN != null) {
        const x = Math.round(plano.sx(hoverN)) + 0.5;
        ctx.strokeStyle = C.eje;
        ctx.beginPath();
        ctx.moveTo(x, plano.y1);
        ctx.lineTo(x, plano.y0);
        ctx.stroke();
      }
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hoverN = null; tip.ocultar(); return dibujar(); }
      const n = Math.min(200, Math.max(10, Math.round(plano.ix(x) / 10) * 10));
      hoverN = n;
      dibujar();
      const D = datos();
      const filas = CLAVES.map((k, i) => ({ k, i, v: D[k].find((p) => p.n === n)[metrica] }))
        .filter((f) => visibles[f.k]).sort((p, q) => q.v - p.v)
        .map((f) => VIZ.filaTooltip(VIZ.series[f.i], ALGORITMOS[f.k].nombre.split(' ')[0], VIZ.entero(f.v)));
      tip.mostrar(x, y, `<div>n = <b>${n}</b></div>${filas.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hoverN = null; tip.ocultar(); dibujar(); });

    dibujar();
  }

  VIZ.registrarTema('ordenamiento', {
    intro: String.raw`
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
        montar: montarAnimacion,
      },
      {
        titulo: 'Costo frente al tamaño de la entrada',
        descripcion: 'Número de comparaciones (o escrituras) medido al ejecutar cada algoritmo para n = 10, 20, …, 200. Pase el cursor sobre el gráfico para leer los valores.',
        montar: montarCurvas,
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
