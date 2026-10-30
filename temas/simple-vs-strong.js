(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: hipótesis disponibles ---------- */

  const MD = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; };
  const REC = {
    uno: ['depende de n − 1', (n) => (n >= 1 ? [n - 1] : [])],
    fib: ['depende de n − 1 y n − 2 (Fibonacci)', (n) => (n >= 2 ? [n - 1, n - 2] : [])],
    mitad: ['depende de ⌊n/2⌋ (representación binaria)', (n) => (n >= 2 ? [Math.floor(n / 2)] : [])],
    est: ['depende de n − 3 y n − 5 (estampillas)', (n) => [n - 3, n - 5].filter((d) => d >= 0)],
    primo: ['depende de los factores de n', (n) => { if (n < 4) return []; const d = MD(n); return d === n ? [] : [d, n / d]; }],
  };

  function montarHipotesis(cuerpo) {
    let clave = 'fib', n = 14;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Paso de la demostración', opciones: Object.entries(REC).map(([k, v]) => [k, v[0]]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Caso que se demuestra, n', min: 2, max: 30, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 170 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'hipótesis disponible', forma: 'cuadro' },
      { color: C.s6, texto: 'caso que se demuestra', forma: 'cuadro' },
      { color: C.s2, texto: 'caso que el paso necesita y está disponible', forma: 'cuadro' },
      { color: C.s8, texto: 'caso que el paso necesita y no se tiene', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Arriba solo se supone P(n − 1) (simple); abajo, P(0), …, P(n − 1) (fuerte). Cuando el paso necesita un caso que no está disponible, la inducción simple no alcanza.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const need = REC[clave][1](n), x0 = 90, w = W - x0 - 8, cnt = n + 1;
      const fila = (y, disp, titulo) => {
        D.texto2(ctx, titulo, x0 - 8, y + 14, { alinea: 'right', color: C.tinta2, px: 10.5 });
        D.tira(ctx, x0, y, w, cnt, (i) => {
          if (i === n) return { fondo: C.s6, texto: n, tinta: C.sobre };
          const d = disp(i), nec = need.includes(i);
          return { fondo: nec ? (d ? C.s2 : C.s8) : d ? VIZ.alfa(C.s1, 0.55) : C.neutro, texto: i, tinta: nec ? C.sobre : d ? C.tinta : C.apagado };
        }, 28);
      };
      fila(30, (i) => i === n - 1, 'simple');
      fila(90, (i) => i < n, 'fuerte');
      const falta = need.filter((d) => d !== n - 1);
      registro.textContent = need.length === 0
        ? `P(${n}) no necesita hipótesis: es un caso que se demuestra directamente.`
        : falta.length === 0
          ? `P(${n}) solo necesita P(${n - 1}): con inducción simple basta.`
          : `P(${n}) necesita ${need.map((d) => `P(${d})`).join(' y ')}. Con inducción simple solo se tiene P(${n - 1}), y falta ${falta.map((d) => `P(${d})`).join(', ')}.\nCon inducción fuerte están todos los casos anteriores: el paso se puede completar.`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: el menor contraejemplo ---------- */

  const primo = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const ENUN = {
    c41: ['n² + n + 41 es primo', (n) => primo(n * n + n + 41)],
    pot: ['2ⁿ > n²', (n) => 2 ** n > n * n],
    suma: ['0 + 1 + … + n = n(n + 1)/2', () => true],
    menor: ['n < 50', (n) => n < 50],
    par: ['n² − n es par', (n) => (n * n - n) % 2 === 0],
  };
  const T = 60;

  function montarContraejemplo(cuerpo) {
    let clave = 'c41';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Enunciado P(n)', opciones: Object.entries(ENUN).map(([k, v]) => [k, v[0]]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'P(n) verdadera', forma: 'cuadro' },
      { color: C.s8, texto: 'menor contraejemplo m', forma: 'cuadro' },
      { color: C.s1, texto: 'Q(n): P(0), …, P(n) todas verdaderas', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un enunciado falso siempre tiene un menor contraejemplo (buen orden). La fila de Q muestra cómo la inducción fuerte para P es inducción simple para Q.');

    function dibujar() {
      const [, P] = ENUN[clave], { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const v = Array.from({ length: T }, (_, n) => P(n));
      const m = v.indexOf(false);
      let q = -1; while (q + 1 < T && v[q + 1]) q++;
      const x0 = 56, w = W - x0 - 8;
      D.texto2(ctx, 'P(n)', x0 - 6, 33, { alinea: 'right', color: C.tinta2, px: 10.5 });
      D.texto2(ctx, 'Q(n)', x0 - 6, 83, { alinea: 'right', color: C.tinta2, px: 10.5 });
      D.tira(ctx, x0, 20, w, T, (n) => ({ fondo: n === m ? C.s8 : v[n] ? C.s6 : C.neutro, texto: n % 10 === 0 || n === m ? n : null, tinta: C.sobre }));
      D.tira(ctx, x0, 70, w, T, (n) => ({ fondo: n <= q ? C.s1 : C.neutro }));
      registro.textContent = m < 0
        ? `No se encontró ningún contraejemplo entre 0 y ${T - 1}. Si P tuviera uno, el conjunto de contraejemplos tendría un mínimo m ≥ 1 con P(0), …, P(m − 1) verdaderas; luego el paso fuerte «P(0) ∧ … ∧ P(m − 1) ⇒ P(m)» sería falso. Probar ese paso descarta los contraejemplos.`
        : `Menor contraejemplo: m = ${m}. Como P(0), …, P(${m - 1}) son verdaderas y P(${m}) no, el paso fuerte falla exactamente en m = ${m}. Una demostración válida no puede existir.`;
      lectura.set([['menor contraejemplo', m < 0 ? `ninguno hasta ${T - 1}` : String(m)], ['P verdadera hasta', m < 0 ? `${T - 1}` : String(m - 1)], ['cuántos falsos en 0…59', String(v.filter((x) => !x).length)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('simple-vs-strong', {
    intro: String.raw`
      <p>Hay tres principios que parecen distintos y dicen lo mismo: la <strong>inducción simple</strong>, la <strong>inducción fuerte</strong> y el <strong>buen orden</strong>.
      Cualquiera de ellos se puede deducir de otro; lo que cambia es cuál resulta más cómodo para cada demostración.</p>
      <p>La inducción simple es lo mejor cuando el paso depende solo del caso anterior. La fuerte, cuando depende de varios o de casos lejanos. Y el buen orden es la herramienta natural
      para argumentar por «el menor contraejemplo».</p>`,
    visualizaciones: [
      {
        titulo: 'Qué hipótesis hay disponibles',
        descripcion: 'Elija cómo depende \\(P(n)\\) de los casos anteriores. La fila de arriba muestra lo que ofrece la inducción simple; la de abajo, la fuerte. Vea cuándo falta algo.',
        montar: montarHipotesis,
      },
      {
        titulo: 'El menor contraejemplo',
        descripcion: 'Para enunciados verdaderos y falsos, ubique el menor contraejemplo \\(m\\). Observe que el paso falla justo ahí y cómo Q convierte la inducción fuerte en simple.',
        montar: montarContraejemplo,
      },
    ],
    teoria: String.raw`
      <h2>Los tres principios son equivalentes</h2>
      <table>
        <tr><th>Principio</th><th>Enunciado</th></tr>
        <tr><td>Inducción simple</td><td>\(P(0) \land \forall k\,(P(k) \to P(k+1)) \Rightarrow \forall n\,P(n)\)</td></tr>
        <tr><td>Inducción fuerte</td><td>\(\forall n\,\bigl((\forall k&lt;n\,P(k)) \to P(n)\bigr) \Rightarrow \forall n\,P(n)\)</td></tr>
        <tr><td>Buen orden</td><td>todo \(A \subseteq \mathbb{N}\) no vacío tiene mínimo</td></tr>
      </table>
      <h3>Simple ⇒ fuerte</h3>
      <p>Dada la hipótesis de la inducción fuerte, se aplica la simple a \(Q(n) := \forall k \le n\;P(k)\). Base: \(Q(0)\) es \(P(0)\), que sale de la hipótesis con \(n = 0\) (nada anterior). Paso: de \(Q(k)\) se deduce \(P(k+1)\) y por tanto \(Q(k+1)\).</p>
      <h3>Fuerte ⇒ buen orden</h3>
      <p>Sea \(A\) sin mínimo y \(P(n) := n \notin A\). Si \(n\) fuera el primer elemento de \(A\), sería mínimo; por tanto, si \(P(k)\) vale para todo \(k &lt; n\) entonces \(n \notin A\): \(P(n)\). Por inducción fuerte, \(A = \varnothing\).</p>
      <h3>Buen orden ⇒ simple</h3>
      <p>Si \(P(0)\) y \(P(k) \to P(k+1)\) valen pero \(\{n : \neg P(n)\}\ne\varnothing\), existe un mínimo \(m\). Como \(m \ne 0\), \(P(m-1)\) es verdadera, y entonces \(P(m)\) también: contradicción.</p>
      <h2>Cuándo usar cada una</h2>
      <p>Cuando el paso usa un solo caso previo, la simple es más sencilla. Si necesita dos o más casos, usted puede reforzar la propiedad (probar \(P(n) \land P(n+1)\) con inducción simple) o usar la fuerte directamente.
      Esto se ve en las <a href="tema.html?id=recursive-definitions">definiciones recursivas</a> y en los algoritmos de dividir y conquistar.</p>`,
  });
})();
