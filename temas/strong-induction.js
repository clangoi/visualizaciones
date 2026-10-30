(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const menorDivisor = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; };

  /* ---------- Fig. 1: factorización en primos ---------- */

  function factorizar(n) {
    const d = menorDivisor(n);
    return d === n ? { t: String(n), n, primo: true, hs: [] } : { t: String(n), n, primo: false, hs: [factorizar(d), factorizar(n / d)] };
  }

  function montarFactores(cuerpo) {
    let n = 60, arbol = factorizar(n);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'n', min: 2, max: 120, valor: n, alCambiar: (v) => { n = v; arbol = factorizar(n); lienzo.ajustar(true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(arbol, 54, D.profGen) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'primo: caso base', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta2, texto: 'compuesto: se apoya en dos números menores', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para un compuesto n = a·b, ambos factores son menores que n: la hipótesis fuerte los cubre a los dos. Con inducción simple solo se podría usar n − 1, que no ayuda.');

    function dibujar() {
      lienzo.limpiar();
      D.arbol(lienzo, arbol, { ...D.GEN, fila: 54, relleno: (r) => (r.n.primo ? VIZ.alfa(C.s6, 0.3) : null), borde: (r) => (r.n.primo ? C.s6 : C.tinta2) });
      const primos = [];
      (function r(a) { if (a.primo) primos.push(a.n); else a.hs.forEach(r); })(arbol);
      const cuenta = {}; primos.forEach((p) => { cuenta[p] = (cuenta[p] || 0) + 1; });
      const txt = Object.entries(cuenta).map(([p, e]) => (e > 1 ? `${p}^${e}` : p)).join(' · ');
      registro.textContent = arbol.primo
        ? `${n} es primo: es su propia factorización (caso base, sin hipótesis).`
        : `${n} no es primo: ${n} = ${arbol.hs[0].n} · ${arbol.hs[1].n} con ${arbol.hs[0].n} < ${n} y ${arbol.hs[1].n} < ${n}.\nPor hipótesis inductiva fuerte, ambos son producto de primos; juntando las dos factorizaciones se obtiene la de ${n}.`;
      lectura.set([['n', String(n)], ['factorización', txt], ['factores primos (con repetición)', String(primos.length)], ['profundidad del árbol', String(D.profGen(arbol))]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: a qué casos anteriores se apoya cada caso ---------- */

  const DEP = {
    simple: ['P(n) se apoya solo en P(n − 1)', (n) => (n > 0 ? [n - 1] : [])],
    fib: ['P(n) se apoya en P(n − 1) y P(n − 2)', (n) => (n >= 2 ? [n - 1, n - 2] : [])],
    mitad: ['P(n) se apoya en P(⌊n/2⌋)', (n) => (n >= 2 ? [Math.floor(n / 2)] : [])],
    factores: ['P(n) se apoya en los factores de n', (n) => { if (n < 4) return []; const d = menorDivisor(n); return d === n ? [] : [d, n / d]; }],
  };
  const MAXN = 29;

  function montarDependencias(cuerpo) {
    let clave = 'fib', n = 20;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Qué casos usa el paso', opciones: Object.entries(DEP).map(([c, v]) => [c, v[0]]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Caso que se demuestra, n', min: 0, max: MAXN, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'caso que se demuestra', forma: 'cuadro' },
      { color: C.s2, texto: 'dependencia directa', forma: 'cuadro' },
      { color: C.s1, texto: 'casos necesarios, de forma indirecta', forma: 'cuadro' },
      { color: C.neutro, texto: 'no se necesita', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los arcos unen n con los casos de los que depende. Los casos azules son todos los que hay que haber probado antes: la inducción fuerte permite usar cualquiera de ellos.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const dep = DEP[clave][1], dir = new Set(dep(n)), cierre = new Set();
      (function r(k) { for (const d of dep(k)) if (!cierre.has(d)) { cierre.add(d); r(d); } })(n);
      const x0 = 8, cw = (W - 2 * x0) / (MAXN + 1), y = 120;
      D.tira(ctx, x0, y, W - 2 * x0, MAXN + 1, (i) => ({
        fondo: i === n ? C.s6 : dir.has(i) ? C.s2 : cierre.has(i) ? C.s1 : C.neutro, texto: cw >= 18 || i % 5 === 0 ? i : null, tinta: i === n || dir.has(i) || cierre.has(i) ? C.sobre : C.apagado,
      }), 28);
      for (const d of dir) {
        const a = x0 + (n + 0.5) * cw, b = x0 + (d + 0.5) * cw;
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a, y - 2); ctx.quadraticCurveTo((a + b) / 2, y - 20 - Math.abs(a - b) * 0.5, b, y - 2); ctx.stroke();
      }
      lectura.set([['n', String(n)], ['dependencias directas', dir.size ? [...dir].sort((a, b) => a - b).join(', ') : 'ninguna (caso base)'], ['casos necesarios en total', `${cierre.size} de ${n}`], ['basta inducción simple', [...dir].every((d) => d === n - 1) ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('strong-induction', {
    intro: String.raw`
      <p>En la inducción simple el caso \(k+1\) se apoya únicamente en el caso \(k\). Pero a veces la demostración necesita casos <em>más lejanos</em>: para factorizar un número en primos se usa que sus dos
      factores, que pueden estar muy por debajo, ya se saben factorizar.</p>
      <p>La <strong>inducción fuerte</strong> permite suponer que la propiedad vale para <em>todos</em> los casos anteriores. Aunque parece más potente, es equivalente a la simple;
      la diferencia es de comodidad y de claridad al escribir la prueba.</p>`,
    visualizaciones: [
      {
        titulo: 'Todo número es producto de primos',
        descripcion: 'Elija \\(n\\): si es compuesto se parte en dos factores menores, y así recursivamente hasta llegar a primos. Cada partición usa la hipótesis fuerte.',
        montar: montarFactores,
      },
      {
        titulo: 'De qué casos depende cada caso',
        descripcion: 'Compare qué casos necesita cada tipo de paso. Con la dependencia de \\(n-1\\) y \\(n-2\\) o de los factores, la inducción simple no basta.',
        montar: montarDependencias,
      },
    ],
    teoria: String.raw`
      <h2>El principio</h2>
      <div class="recuadro"><strong>Inducción fuerte.</strong> Si para todo \(n\)
      \[ \bigl(\forall k &lt; n\; P(k)\bigr) \to P(n), \]
      entonces \(\forall n\,P(n)\).</div>
      <p>No hay un «caso base» aparte: el caso \(n = 0\) es un paso con hipótesis vacía (no hay \(k &lt; 0\)), y debe demostrarse directamente. En la práctica, los casos pequeños que no admiten el argumento general se tratan por separado.</p>
      <h2>Ejemplo: factorización</h2>
      <p>Sea \(P(n)\): «\(n \ge 2\) es producto de primos». Si \(n\) es primo, es el producto de un solo primo. Si no lo es, \(n = ab\) con \(2 \le a, b &lt; n\); por hipótesis fuerte, \(a\) y \(b\) son productos de primos y también lo es \(n = ab\).
      Con inducción simple no se llega: \(n-1\) no dice nada sobre los factores de \(n\).</p>
      <h2>Ejemplo: recurrencias de dos términos</h2>
      <p>Para \(F_n &lt; 2^n\) con \(F_{n} = F_{n-1} + F_{n-2}\): se prueba \(F_0, F_1\) directamente, y para \(n \ge 2\), \(F_n &lt; 2^{n-1} + 2^{n-2} &lt; 2^n\), usando los <em>dos</em> casos anteriores.
      Los detalles del enfoque simple frente al fuerte están en <a href="tema.html?id=simple-vs-strong">Simple vs. Strong Induction</a>.</p>
      <h2>Validez</h2>
      <p>Se reduce a la inducción simple aplicada a \(Q(n) := P(0) \land \cdots \land P(n)\). Ahí sí el paso \(Q(k) \to Q(k+1)\) es exactamente el de la inducción fuerte para \(P(k+1)\).
      La recursión que toma varios casos anteriores se define en <a href="tema.html?id=recursive-definitions">Recursive Definitions</a>.</p>`,
  });
})();
