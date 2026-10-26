(function () {
  'use strict';
  const { el, color: C } = VIZ;

  // log10 de n! (suma exacta hasta 2000, Stirling después).
  const log10Factorial = (n) => {
    if (n < 2) return 0;
    if (n <= 2000) { let s = 0; for (let k = 2; k <= n; k++) s += Math.log10(k); return s; }
    return (n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n)) / Math.LN10;
  };

  // Ocho órdenes de crecimiento; cada uno con su color fijo y su log10 (para tiempos enormes).
  const FUNCIONES = [
    { clave: 'c', nombre: '1', f: () => 1, log10: () => 0 },
    { clave: 'log', nombre: 'log₂ n', f: (n) => Math.log2(Math.max(n, 1)), log10: (n) => Math.log10(Math.max(Math.log2(n), 1e-9)) },
    { clave: 'raiz', nombre: '√n', f: (n) => Math.sqrt(n), log10: (n) => 0.5 * Math.log10(n) },
    { clave: 'n', nombre: 'n', f: (n) => n, log10: (n) => Math.log10(n) },
    { clave: 'nlog', nombre: 'n log₂ n', f: (n) => n * Math.log2(Math.max(n, 1)), log10: (n) => Math.log10(n * Math.max(Math.log2(n), 1e-9)) },
    { clave: 'n2', nombre: 'n²', f: (n) => n * n, log10: (n) => 2 * Math.log10(n) },
    { clave: 'exp', nombre: '2ⁿ', f: (n) => Math.pow(2, n), log10: (n) => n * Math.log10(2) },
    { clave: 'fact', nombre: 'n!', f: (n) => Math.pow(10, log10Factorial(Math.round(n))), log10: (n) => log10Factorial(n), entero: true },
  ];
  FUNCIONES.forEach((fn, i) => { fn.color = VIZ.series[i]; });

  /* ---------- Fig. 1: órdenes de crecimiento ---------- */

  function montarCrecimiento(cuerpo) {
    let nmax = 20, logY = false, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'n máximo', min: 4, max: 100, valor: nmax, alCambiar: (v) => { nmax = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Escala vertical', opciones: [['lin', 'Lineal'], ['log', 'Logarítmica']], valor: 'lin',
      alCambiar: (v) => { logY = v === 'log'; dibujar(); } });
    const visibles = ctl.casillas(FUNCIONES.map((fn) => ({ clave: fn.clave, texto: fn.nombre, color: fn.color, activo: fn.clave !== 'fact' })), dibujar);

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.52, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, FUNCIONES.map((fn) => ({ color: fn.color, texto: fn.nombre, forma: 'linea' })));
    VIZ.nota(cuerpo, 'Con escala lineal, el eje vertical se ajusta a la función más rápida visible: desactive 2ⁿ para ver cómo n² aplasta a n log n. Con escala logarítmica las potencias se vuelven rectas.');

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const act = FUNCIONES.filter((fn) => visibles[fn.clave]);
      let ymax = 2;
      for (const fn of act) ymax = Math.max(ymax, fn.f(nmax));
      ymax = Math.min(ymax * 1.04, 1e300);
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: nmax, ymin: logY ? 0.5 : 0, ymax }, {
        logY, etiquetaX: 'n', etiquetaY: 'f(n)', margen: { der: 84 },
      });
      plano.ejes();
      const etiquetas = [];
      ctx.save();
      plano.recortar();
      for (const fn of act) {
        const pts = [];
        if (fn.entero) for (let n = 1; n <= nmax; n++) pts.push([n, fn.f(n)]);
        else for (let k = 0; k <= 240; k++) { const n = 1 + ((nmax - 1) * k) / 240; pts.push([n, fn.f(n)]); }
        VIZ.trazar(ctx, plano, pts.map(([x, y]) => [x, Math.min(y, ymax * 4)]), fn.color, 2);
        etiquetas.push({ y: plano.sy(Math.min(fn.f(nmax), ymax)), fn });
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(Math.min(fn.f(hover), ymax * 4)), fn.color, 4);
      }
      ctx.restore();
      // Etiquetas directas al final de cada curva, separadas para no chocar.
      etiquetas.sort((a, b) => a.y - b.y);
      for (let i = 1; i < etiquetas.length; i++) etiquetas[i].y = Math.max(etiquetas[i].y, etiquetas[i - 1].y + 13);
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      for (const et of etiquetas) {
        ctx.fillStyle = et.fn.color;
        ctx.fillRect(plano.x1 + 6, et.y - 1, 8, 2);
        ctx.fillStyle = C.tinta2;
        ctx.fillText(et.fn.nombre, plano.x1 + 18, et.y);
      }
      if (hover != null) {
        const x = Math.round(plano.sx(hover)) + 0.5;
        ctx.strokeStyle = C.eje;
        ctx.beginPath(); ctx.moveTo(x, plano.y1); ctx.lineTo(x, plano.y0); ctx.stroke();
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.min(nmax, Math.max(1, Math.round(plano.ix(x))));
      dibujar();
      const filas = FUNCIONES.filter((fn) => visibles[fn.clave])
        .map((fn) => ({ fn, v: fn.f(hover) })).sort((a, b) => b.v - a.v)
        .map(({ fn, v }) => VIZ.filaTooltip(fn.color, fn.nombre, VIZ.fmt(v)));
      tip.mostrar(x, y, `<div>n = <b>${hover}</b></div>${filas.join('')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: tiempos reales ---------- */

  function formatearTiempo(log10Segundos) {
    const L = log10Segundos;
    if (L > 300) return `≈ 10^${Math.round(L - 7.5)} años`;
    const s = Math.pow(10, L);
    const unidades = [
      [1e-9, 'ns'], [1e-6, 'µs'], [1e-3, 'ms'], [1, 's'], [60, 'min'], [3600, 'h'], [86400, 'días'], [31557600, 'años'],
    ];
    if (s < 1e-9) return '< 1 ns';
    let u = unidades[0];
    for (const x of unidades) if (s >= x[0]) u = x;
    const v = s / u[0];
    if (u[1] === 'años' && v >= 1e4) {
      const edad = v / 1.38e10;
      return edad >= 1 ? `${VIZ.fmt(v, 2)} años (${VIZ.fmt(edad, 2)}× la edad del universo)` : `${VIZ.fmt(v, 2)} años`;
    }
    return `${VIZ.fmt(v, 3)} ${u[1]}`;
  }

  function montarTiempos(cuerpo) {
    let exp = 3, ops = 9;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño n', min: 1, max: 9, paso: 0.25, valor: exp,
      formato: (v) => VIZ.entero(Math.round(Math.pow(10, v))), alCambiar: (v) => { exp = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Operaciones por segundo', min: 6, max: 12, paso: 1, valor: ops,
      formato: (v) => `10^${v}`, alCambiar: (v) => { ops = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 8 * 34 + 30 });
    VIZ.nota(cuerpo, 'Barras en escala logarítmica de tiempo. La línea vertical marca un segundo; la siguiente, un año.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const n = Math.round(Math.pow(10, exp));
      const izq = 92, der = 18, filaH = 34;
      const filas = FUNCIONES.map((fn) => ({ fn, L: fn.log10(n) - ops }));
      // Eje: de 1 ns (−9) a 10^20 s; más allá se recorta.
      const xmin = -10, xmax = 20;
      const sx = (L) => izq + ((Math.min(Math.max(L, xmin), xmax) - xmin) / (xmax - xmin)) * (W - izq - der);
      ctx.font = VIZ.fuente(10);
      ctx.fillStyle = C.apagado;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const marcas = [[-9, '1 ns'], [-6, '1 µs'], [-3, '1 ms'], [0, '1 s'], [Math.log10(3600), '1 h'], [Math.log10(31557600), '1 año'], [Math.log10(31557600 * 1e3), 'mil años'], [Math.log10(4.35e17), 'universo']];
      for (const [L, t] of marcas) {
        const x = Math.round(sx(L)) + 0.5;
        ctx.strokeStyle = L === 0 || t === '1 año' ? C.apagado : C.rejilla;
        ctx.setLineDash(L === 0 || t === '1 año' ? [3, 3] : []);
        ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H - 22); ctx.stroke();
        ctx.setLineDash([]);
        if (W > 520 || L === 0 || t === '1 año' || t === 'universo') ctx.fillText(t, x, H - 18);
      }
      filas.forEach(({ fn, L }, i) => {
        const y = 6 + i * filaH;
        ctx.fillStyle = C.tinta;
        ctx.font = VIZ.fuente(12, 500);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(fn.nombre, izq - 12, y + 10);
        const x1 = sx(L);
        ctx.fillStyle = fn.color;
        ctx.beginPath();
        const w = Math.max(2, x1 - izq);
        if (ctx.roundRect) ctx.roundRect(izq, y + 3, w, 14, [0, 4, 4, 0]); else ctx.rect(izq, y + 3, w, 14);
        ctx.fill();
        if (L > xmax) {
          ctx.fillStyle = C.superficie;
          for (let k = 0; k < 3; k++) ctx.fillRect(W - der - 22 + k * 6, y + 3, 2, 14);
        }
        const texto = formatearTiempo(L);
        ctx.font = VIZ.fuente(11);
        ctx.textAlign = x1 + 8 + ctx.measureText(texto).width < W - der ? 'left' : 'right';
        const tx = ctx.textAlign === 'left' ? x1 + 8 : Math.min(x1, W - der) - 8;
        if (ctx.textAlign === 'right') {
          // Texto sobre la barra: fondo para que sea legible.
          const tw = ctx.measureText(texto).width;
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.fillRect(tx - tw - 4, y + 3, tw + 8, 14);
        }
        ctx.fillStyle = C.tinta2;
        ctx.fillText(texto, tx, y + 10);
        ctx.fillStyle = C.rejilla;
        ctx.fillRect(izq, y + filaH - 6, W - izq - der, 1);
      });
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 3: la definición de O grande ---------- */

  function montarDefinicion(cuerpo) {
    let a = 2, b = 10, d = 50, c = 3, N = 40;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'a (coef. de n²)', min: 0.5, max: 5, paso: 0.5, valor: a, alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'b (coef. de n)', min: -10, max: 40, paso: 1, valor: b, alCambiar: (v) => { b = v; dibujar(); } });
    ctl.rango({ etiqueta: 'd (constante)', min: 0, max: 300, paso: 5, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    ctl.rango({ etiqueta: 'constante c', min: 0.5, max: 10, paso: 0.1, valor: c, formato: (v) => v.toFixed(1), alCambiar: (v) => { c = v; dibujar(); } });
    ctl.rango({ etiqueta: 'n máximo', min: 10, max: 100, valor: N, alCambiar: (v) => { N = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'f(n) = a·n² + b·n + d', forma: 'linea' },
      { color: C.s2, texto: 'c·g(n) = c·n²', forma: 'linea' },
      { color: VIZ.alfa(C.s8, 0.25), texto: 'f(n) > c·g(n)' },
      { color: C.neutro, texto: 'n ≥ n₀ (la desigualdad se cumple)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);

    const f = (n) => a * n * n + b * n + d;
    const cg = (n) => c * n * n;

    // Menor entero n₀ ≥ 1 tal que (c−a)n² − bn − d ≥ 0 para todo n ≥ n₀.
    function calcularN0() {
      const k = c - a;
      if (Math.abs(k) < 1e-12) {
        if (b < 0) return Math.max(1, Math.ceil(d / -b));
        return b === 0 && d <= 0 ? 1 : null;
      }
      if (k < 0) return null;
      const disc = b * b + 4 * k * d;
      if (disc < 0) return 1;
      return Math.max(1, Math.ceil((b + Math.sqrt(disc)) / (2 * k) - 1e-9));
    }

    let plano = null, hover = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const n0 = calcularN0();
      let ymax = Math.max(f(N), cg(N)) * 1.05;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: N, ymin: 0, ymax }, { etiquetaX: 'n', etiquetaY: 'operaciones' });
      if (n0 != null && n0 <= N) {
        ctx.fillStyle = C.neutro;
        ctx.fillRect(plano.sx(n0), plano.y1, plano.x1 - plano.sx(n0), plano.y0 - plano.y1);
      }
      plano.ejes();
      ctx.save();
      plano.recortar();
      // Región donde f supera a c·g.
      ctx.fillStyle = VIZ.alfa(C.s8, 0.22);
      const pasos = 300;
      for (let k = 0; k < pasos; k++) {
        const n1 = (N * k) / pasos, n2 = (N * (k + 1)) / pasos;
        if (f(n1) > cg(n1) || f(n2) > cg(n2)) {
          ctx.beginPath();
          ctx.moveTo(plano.sx(n1), plano.sy(cg(n1)));
          ctx.lineTo(plano.sx(n2), plano.sy(cg(n2)));
          ctx.lineTo(plano.sx(n2), plano.sy(Math.max(f(n2), cg(n2))));
          ctx.lineTo(plano.sx(n1), plano.sy(Math.max(f(n1), cg(n1))));
          ctx.fill();
        }
      }
      const ptsF = [], ptsG = [];
      for (let k = 0; k <= pasos; k++) { const n = (N * k) / pasos; ptsF.push([n, f(n)]); ptsG.push([n, cg(n)]); }
      VIZ.trazar(ctx, plano, ptsG, C.s2, 2);
      VIZ.trazar(ctx, plano, ptsF, C.s1, 2);
      if (n0 != null && n0 <= N) {
        const x = Math.round(plano.sx(n0)) + 0.5;
        ctx.strokeStyle = C.tinta;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, plano.y1); ctx.lineTo(x, plano.y0); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.tinta;
        ctx.font = VIZ.fuente(11, 500);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`n₀ = ${n0}`, x + 6, plano.y1 + 4);
      }
      if (hover != null) {
        VIZ.marcador(ctx, plano.sx(hover), plano.sy(f(hover)), C.s1, 4);
        VIZ.marcador(ctx, plano.sx(hover), plano.sy(cg(hover)), C.s2, 4);
      }
      ctx.restore();

      let conclusion;
      if (n0 == null) conclusion = c < a ? `c < a: ninguna n₀ sirve con este c` : 'no existe n₀ con este c';
      else conclusion = `f(n) ≤ ${c.toFixed(1)}·n² para todo n ≥ ${n0}`;
      lectura.set([
        ['f(n)', `${a}n² ${b < 0 ? '−' : '+'} ${Math.abs(b)}n + ${d}`],
        ['n₀', n0 == null ? 'no existe' : String(n0)],
        ['conclusión', conclusion],
        ['lím f(n)/n²', String(a)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      if (!plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(N, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'f(n)', VIZ.fmt(f(hover), 5)) +
        VIZ.filaTooltip(C.s2, 'c·n²', VIZ.fmt(cg(hover), 5)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('complejidad', {
    intro: String.raw`
      <p>Para comparar algoritmos no basta con medir cuánto tardan en un computador concreto: el resultado depende del
      hardware, del lenguaje y de la entrada. El <strong>análisis asintótico</strong> describe cómo crece el número de
      operaciones cuando el tamaño de la entrada \(n\) tiende a infinito, ignorando constantes y términos de menor orden.
      Así, \(3n^2 + 10n + 50\) y \(n^2/2\) pertenecen a la misma clase, \(\Theta(n^2)\), porque para \(n\) grande la forma de la
      curva importa mucho más que su escala.</p>`,
    visualizaciones: [
      {
        titulo: 'Órdenes de crecimiento',
        descripcion: 'Las ocho clases más frecuentes en el análisis de algoritmos. Active o desactive funciones y cambie la escala para comparar.',
        montar: montarCrecimiento,
      },
      {
        titulo: '¿Cuánto tarda en la práctica?',
        descripcion: 'Tiempo que tomaría ejecutar f(n) operaciones a una velocidad dada. Un factor constante (un computador 1000 veces más rápido) desplaza todas las barras igual; el orden de crecimiento no cambia.',
        montar: montarTiempos,
      },
      {
        titulo: 'La definición de O grande',
        descripcion: 'Decir que \\(f(n) = O(n^2)\\) es afirmar que existe una constante \\(c\\) y un umbral \\(n_0\\) a partir del cual \\(f(n) \\le c\\,n^2\\). Ajuste los coeficientes de \\(f\\) y busque el menor \\(c\\) que funciona.',
        montar: montarDefinicion,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sean \(f, g : \mathbb{N} \to \mathbb{R}_{\ge 0}\).</p>
      \[
      \begin{aligned}
      f(n) = O(g(n)) &amp;\iff \exists\, c &gt; 0,\ n_0 \in \mathbb{N} : \ f(n) \le c\, g(n) \quad \forall n \ge n_0, \\
      f(n) = \Omega(g(n)) &amp;\iff \exists\, c &gt; 0,\ n_0 \in \mathbb{N} : \ f(n) \ge c\, g(n) \quad \forall n \ge n_0, \\
      f(n) = \Theta(g(n)) &amp;\iff f(n) = O(g(n)) \ \text{y}\ f(n) = \Omega(g(n)).
      \end{aligned}
      \]
      <p>\(O\) es una cota superior, \(\Omega\) una inferior y \(\Theta\) una cota ajustada. También se usan las versiones estrictas:
      \(f = o(g)\) si \(f(n)/g(n) \to 0\), y \(f = \omega(g)\) si \(f(n)/g(n) \to \infty\).</p>

      <h2>Criterio del límite</h2>
      <p>En la práctica, si el límite existe, basta calcular</p>
      \[ L = \lim_{n\to\infty} \frac{f(n)}{g(n)}: \qquad
      \begin{cases} L = 0 &amp; \Rightarrow f = o(g) \\ 0 &lt; L &lt; \infty &amp; \Rightarrow f = \Theta(g) \\ L = \infty &amp; \Rightarrow f = \omega(g). \end{cases} \]
      <p>Para \(f(n) = an^2 + bn + d\) y \(g(n) = n^2\) el límite es \(a\), así que \(f = \Theta(n^2)\). La figura 3 muestra el
      significado concreto: cualquier \(c &gt; a\) sirve, pero cuanto más cerca de \(a\), mayor debe ser \(n_0\). Resolviendo
      \((c-a)n^2 - bn - d \ge 0\):</p>
      \[ n_0 = \left\lceil \frac{b + \sqrt{b^2 + 4(c-a)d}}{2(c-a)} \right\rceil. \]

      <h2>La jerarquía</h2>
      <p>Para constantes \(0 &lt; \varepsilon &lt; 1 &lt; k\) y \(b &gt; 1\):</p>
      \[ 1 \;\prec\; \log n \;\prec\; n^{\varepsilon} \;\prec\; n \;\prec\; n\log n \;\prec\; n^k \;\prec\; b^n \;\prec\; n! \;\prec\; n^n \]
      <p>donde \(f \prec g\) significa \(f = o(g)\). Algunas consecuencias útiles:</p>
      <ul>
        <li>La base del logaritmo no importa: \(\log_a n = \log_b n / \log_b a\), que difiere solo en una constante.</li>
        <li>Todo polinomio es \(o\) de toda exponencial: \(\lim n^k / b^n = 0\) (aplicando l'Hôpital \(k\) veces).</li>
        <li>Por Stirling, \(\log n! = n\log n - n + O(\log n) = \Theta(n \log n)\), aunque \(n!\) crece más rápido que \(b^n\).</li>
      </ul>

      <h2>Por qué importa más que el hardware</h2>
      <p>Si un computador es \(k\) veces más rápido, en el mismo tiempo resuelve problemas de tamaño:</p>
      <table>
        <thead><tr><th>Costo</th><th>Nuevo tamaño alcanzable</th></tr></thead>
        <tbody>
          <tr><td>\(n\)</td><td>\(k\,n\)</td></tr>
          <tr><td>\(n^2\)</td><td>\(\sqrt{k}\,n\)</td></tr>
          <tr><td>\(n^3\)</td><td>\(\sqrt[3]{k}\,n\)</td></tr>
          <tr><td>\(2^n\)</td><td>\(n + \log_2 k\)</td></tr>
        </tbody>
      </table>
      <p>Un computador mil veces más rápido permite resolver un problema exponencial apenas con unas diez unidades más de tamaño.
      Mejorar el algoritmo, en cambio, cambia la forma de la curva.</p>

      <h2>Advertencias</h2>
      <p>La notación asintótica oculta constantes que en la práctica pueden ser decisivas: un algoritmo \(\Theta(n \log n)\) con
      constante grande puede ser más lento que uno \(\Theta(n^2)\) para todos los \(n\) que importan (por eso las bibliotecas
      usan inserción para arreglos pequeños). Además, describe un caso concreto —peor, promedio o mejor— que debe declararse
      explícitamente.</p>`,
  });
})();
