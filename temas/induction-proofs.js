(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Enunciados que se demuestran por inducción ---------- */

  const suma = (n, f) => { let s = 0; for (let i = 0; i <= n; i++) s += f(i); return s; };
  const ENUN = {
    suma: {
      nombre: '1 + 2 + … + n = n(n + 1)/2', n0: 1, izq: (n) => suma(n, (i) => i), der: (n) => (n * (n + 1)) / 2, ok: (n) => suma(n, (i) => i) === (n * (n + 1)) / 2,
      paso: (k) => [`S(${k + 1}) = S(${k}) + ${k + 1}`, `= ${(k * (k + 1)) / 2} + ${k + 1}  (hipótesis inductiva)`, `= ${((k + 1) * (k + 2)) / 2} = (${k + 1})(${k + 2})/2`],
    },
    geom: {
      nombre: '1 + 2 + 4 + … + 2ⁿ = 2ⁿ⁺¹ − 1', n0: 0, izq: (n) => suma(n, (i) => 2 ** i), der: (n) => 2 ** (n + 1) - 1, ok: (n) => suma(n, (i) => 2 ** i) === 2 ** (n + 1) - 1,
      paso: (k) => [`G(${k + 1}) = G(${k}) + 2^${k + 1}`, `= (2^${k + 1} − 1) + 2^${k + 1}  (hipótesis inductiva)`, `= 2·2^${k + 1} − 1 = 2^${k + 2} − 1`],
    },
    desig: {
      nombre: '2ⁿ > n²', n0: 5, izq: (n) => 2 ** n, der: (n) => n * n, ok: (n) => 2 ** n > n * n,
      paso: (k) => [`2^${k + 1} = 2·2^${k} > 2·${k}²  (hipótesis inductiva)`, `2·${k}² = ${2 * k * k} ≥ ${(k + 1) ** 2} = (${k} + 1)²  ${2 * k * k >= (k + 1) ** 2 ? '(cierto desde k = 3)' : '(falla: k es demasiado chico)'}`, `luego 2^${k + 1} > (${k + 1})²`],
    },
    fact: {
      nombre: 'n! > 2ⁿ', n0: 4, izq: (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }, der: (n) => 2 ** n,
      ok: (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f > 2 ** n; },
      paso: (k) => [`(${k + 1})! = ${k + 1}·${k}! > ${k + 1}·2^${k}  (hipótesis inductiva)`, `${k + 1}·2^${k} ≥ 2·2^${k} = 2^${k + 1}  (pues ${k + 1} ≥ 2)`, `luego (${k + 1})! > 2^${k + 1}`],
    },
    div6: {
      nombre: '6 divide a n³ − n', n0: 0, izq: (n) => n ** 3 - n, der: () => 6, ok: (n) => (n ** 3 - n) % 6 === 0, div: true,
      paso: (k) => [`(${k + 1})³ − (${k + 1}) = (${k}³ − ${k}) + 3${k}(${k} + 1)`, `${k}³ − ${k} = ${k ** 3 - k} es múltiplo de 6 (hipótesis)`, `${k}(${k} + 1) es par, luego 3·${k}(${k} + 1) = ${3 * k * (k + 1)} es múltiplo de 6`],
    },
    div3: {
      nombre: '3 divide a 4ⁿ − 1', n0: 0, izq: (n) => 4 ** n - 1, der: () => 3, ok: (n) => (4 ** n - 1) % 3 === 0, div: true,
      paso: (k) => [`4^${k + 1} − 1 = 4·(4^${k} − 1) + 3`, `4^${k} − 1 = ${4 ** k - 1} es múltiplo de 3 (hipótesis)`, `4·(…) + 3 = ${4 * (4 ** k - 1) + 3} es múltiplo de 3`],
    },
  };

  /* ---------- Fig. 1: la propiedad, el paso y la cadena ---------- */

  function montarEnunciados(cuerpo) {
    let clave = 'suma', k = 6;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Enunciado P(n)', opciones: Object.entries(ENUN).map(([c, v]) => [c, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; k = Math.max(k, ENUN[clave].n0); dibujar(); } });
    const rk = ctl.rango({ etiqueta: 'k (hipótesis P(k) ⇒ P(k + 1))', min: 0, max: 18, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'figura sin lienzo: las fichas muestran ✓ y ✗';
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada ficha es P(n): ✓ si es verdadera. El paso inductivo se prueba con álgebra para un k cualquiera; aquí se ve con números concretos para el k elegido.');

    function dibujar() {
      const E = ENUN[clave];
      k = Math.max(k, E.n0); rk.valor = k;
      fichas.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'P(n):'), ...Array.from({ length: 19 }, (_, i) => {
        const n = i, v = E.ok(n), sel = n === k || n === k + 1;
        return VIZ.ficha(`${n} ${v ? '✓' : '✗'}`, { color: n < E.n0 ? C.inactivo : sel ? C.s2 : v ? C.tinta : C.s8, tinta: n < E.n0 ? C.apagado : v ? null : C.s8, fondo: sel ? VIZ.alfa(C.s2, 0.15) : null });
      }));
      const filas = [k, k + 1].map((n) => {
        const l = E.izq(n), r = E.der(n);
        return VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, `n = ${n}`), VIZ.el('td', null, VIZ.entero(l)), VIZ.el('td', null, E.div ? `÷ ${r} → ${VIZ.entero(l / r)}` : VIZ.entero(r)), VIZ.el('td', null, E.ok(n) ? '✓' : '✗'));
      });
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, ''), VIZ.el('th', null, E.div ? 'valor' : 'lado izquierdo'), VIZ.el('th', null, E.div ? 'cociente' : 'lado derecho'), VIZ.el('th', null, 'P(n)'))),
        VIZ.el('tbody', null, filas)));
      registro.textContent = ['Paso inductivo con k = ' + k + ':', ...E.paso(k)].join('\n');
      lectura.set([['caso base', `n₀ = ${E.n0}`], ['P(k)', E.ok(k) ? 'verdadera' : 'falsa'], ['P(k + 1)', E.ok(k + 1) ? 'verdadera' : 'falsa'], ['implicación P(k) ⇒ P(k + 1)', !E.ok(k) || E.ok(k + 1) ? 'verdadera' : 'falsa']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: ¿desde dónde funciona el paso? ---------- */

  const FAM = {
    d1: { nombre: '2ⁿ > n²', P: (n) => 2 ** n > n * n },
    d2: { nombre: '3ⁿ > n³', P: (n) => 3 ** n > n ** 3 },
    d3: { nombre: '2ⁿ > 2n + 1', P: (n) => 2 ** n > 2 * n + 1 },
    d4: { nombre: 'n² > 3n', P: (n) => n * n > 3 * n },
    d5: { nombre: 'n! > 2ⁿ', P: (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f > 2 ** n; } },
  };
  const NN = 24;

  function montarPaso(cuerpo) {
    let clave = 'd1', base = 5;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Enunciado P(n)', opciones: Object.entries(FAM).map(([c, v]) => [c, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Caso base elegido n₀', min: 0, max: 12, valor: base, alCambiar: (v) => { base = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'P(n) es verdadera', forma: 'cuadro' },
      { color: C.tinta, texto: 'P(n) ⇒ P(n + 1) es verdadera', forma: 'cuadro' },
      { color: C.s8, texto: 'P(n) ⇒ P(n + 1) es falsa', forma: 'cuadro' },
      { color: C.s1, texto: 'P demostrada por la cadena desde n₀', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una implicación con premisa falsa es verdadera, así que el paso puede ser «cierto» en lugares donde P no vale. La cadena solo funciona si hay un caso base y todos los pasos siguientes son ciertos.');

    function dibujar() {
      const F = FAM[clave], { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const P = Array.from({ length: NN + 1 }, (_, n) => F.P(n));
      const imp = P.slice(0, NN).map((v, n) => !v || P[n + 1]);
      let fin = -1;
      if (P[base]) { fin = base; while (fin < NN && imp[fin]) fin++; }
      const x0 = 56, w = W - x0 - 8;
      [['P(n)', 40], ['paso', 84], ['cadena', 128]].forEach(([t, y]) => D.texto2(ctx, t, x0 - 6, y + 13, { alinea: 'right', color: C.tinta2, px: 10.5 }));
      D.tira(ctx, x0, 40, w, NN + 1, (n) => ({ fondo: P[n] ? C.s6 : C.neutro, texto: n, tinta: P[n] ? C.sobre : C.apagado }));
      D.tira(ctx, x0, 84, w, NN + 1, (n) => (n < NN ? { fondo: imp[n] ? C.tinta : C.s8, texto: imp[n] ? '✓' : '✗', tinta: C.sobre } : { fondo: C.superficie }));
      D.tira(ctx, x0, 128, w, NN + 1, (n) => (n >= base && n <= fin && P[base] ? { fondo: C.s1, texto: n, tinta: C.sobre } : { fondo: C.neutro }));
      let m = NN; while (m > 0 && P[m - 1]) m--;
      const rotos = imp.map((v, n) => (v ? -1 : n)).filter((n) => n >= 0);
      registro.textContent = !P[base]
        ? `P(${base}) es falsa: no hay caso base verdadero, la cadena no puede arrancar.`
        : rotos.some((n) => n >= base)
          ? `Con base n₀ = ${base} la cadena se rompe: P(${rotos.find((n) => n >= base)}) es verdadera y P(${rotos.find((n) => n >= base) + 1}) no.`
          : `Con base n₀ = ${base} todos los pasos siguientes son ciertos: P(n) vale para todo n ≥ ${base}.`;
      lectura.set([['P(n) verdadera para todo n ≥', String(m)], ['pasos falsos', rotos.length ? rotos.join(', ') : 'ninguno'], ['base elegida', `n₀ = ${base}`], ['demostrado hasta', P[base] ? (fin >= NN ? `n = ${NN} (todos los mostrados)` : `n = ${fin}`) : 'nada']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('induction-proofs', {
    intro: String.raw`
      <p>La inducción sirve para tres familias de enunciados que aparecen todo el tiempo: <strong>fórmulas de sumatorias</strong>, <strong>desigualdades</strong> y
      <strong>divisibilidad</strong>. En las tres el esquema es el mismo; lo que cambia es el truco algebraico del paso inductivo: escribir el caso \(k+1\)
      en términos del caso \(k\), usar la hipótesis y llegar al lado derecho que se quería.</p>
      <p>Hay un detalle sutil: en las desigualdades el caso base no siempre es 0 o 1, y el paso puede ser «cierto» incluso donde la propiedad es falsa. Por eso importa elegir bien el punto de partida.</p>`,
    visualizaciones: [
      {
        titulo: 'La propiedad, el caso k y el caso k + 1',
        descripcion: 'Elija un enunciado y un \\(k\\). Mire cómo el caso \\(k+1\\) se arma con el caso \\(k\\) más un término, y qué fichas P(n) son verdaderas.',
        montar: montarEnunciados,
      },
      {
        titulo: '¿Desde dónde funciona el paso?',
        descripcion: 'Cambie el caso base para un enunciado de desigualdad: la cadena solo arranca donde \\(P(n_0)\\) es verdadera y no se rompe después.',
        montar: montarPaso,
      },
    ],
    teoria: String.raw`
      <h2>Sumatorias</h2>
      <p>Para \(\sum_{i=1}^{n} i = \tfrac{n(n+1)}{2}\): el caso \(n=1\) da \(1 = 1\). Si vale para \(k\), entonces
      \[ \sum_{i=1}^{k+1} i = \frac{k(k+1)}{2} + (k+1) = \frac{(k+1)(k+2)}{2}. \]
      El truco es separar el último término y reconocer la suma anterior.</p>
      <h2>Desigualdades</h2>
      <p>Para \(2^n &gt; n^2\) con \(n \ge 5\): base \(32 &gt; 25\). Paso: \(2^{k+1} = 2\cdot 2^k &gt; 2k^2\), y \(2k^2 \ge (k+1)^2\) equivale a \(k^2 - 2k - 1 \ge 0\), cierto si \(k \ge 3\). Se encadenan las desigualdades y se
      <em>elige el caso base</em> donde el paso ya funciona. El enunciado es falso para \(n = 2,3,4\); por eso el caso base debe ser \(n_0 = 5\) y no menos.</p>
      <h2>Divisibilidad</h2>
      <p>Para \(3 \mid 4^n - 1\): se escribe \(4^{k+1} - 1 = 4(4^k - 1) + 3\). Si \(4^k - 1 = 3m\), el total es \(3(4m + 1)\). En general, se busca descomponer el caso \(k+1\) como
      <em>(múltiplo del caso \(k\)) + (algo claramente divisible)</em>.</p>
      <h2>Verdad vacía del paso</h2>
      <p>La implicación \(P(k) \to P(k+1)\) solo es falsa si \(P(k)\) es verdadera y \(P(k+1)\) falsa. Donde \(P(k)\) es falsa, el paso es verdadero «en vacío», pero no sirve para nada sin un caso base verdadero.
      Compare con los errores típicos en <a href="tema.html?id=induction-fallacies">Common Induction Fallacies</a>.</p>`,
  });
})();
