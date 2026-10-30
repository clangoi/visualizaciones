(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: todos los caballos son del mismo color ---------- */

  function montarCaballos(cuerpo) {
    let k = 4;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Paso de k a k + 1 caballos: k =', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'grupo A: los primeros k caballos', forma: 'linea' },
      { color: C.s2, texto: 'grupo B: los últimos k caballos', forma: 'linea' },
      { color: C.s3, texto: 'caballos comunes a A y B', forma: 'cuadro' },
      { color: C.s8, texto: 'no hay caballo común: el argumento falla', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La «demostración»: si k caballos cualesquiera son del mismo color, A y B lo son; como comparten caballos, todos los k + 1 tienen ese color. Pruebe k = 1.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const n = k + 1, x0 = 30, dx = Math.min(54, (W - 2 * x0) / Math.max(1, n - 1)), y = 100;
      const X = (i) => x0 + i * dx;
      const comun = Math.max(0, k - 1);
      for (const [a, b, c, dy, t] of [[0, k - 1, C.s1, -34, 'A'], [1, k, C.s2, 38, 'B']]) {
        ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(X(a) - 16, y + dy / 2.4); ctx.lineTo(X(a) - 16, y + dy); ctx.lineTo(X(b) + 16, y + dy); ctx.lineTo(X(b) + 16, y + dy / 2.4); ctx.stroke();
        D.texto2(ctx, t, X(a) - 24, y + dy, { color: c, px: 13, peso: 700, alinea: 'right' });
      }
      for (let i = 0; i < n; i++) {
        const ambos = i >= 1 && i <= k - 1;
        ctx.beginPath(); ctx.arc(X(i), y, 15, 0, 7);
        ctx.fillStyle = ambos ? VIZ.alfa(C.s3, 0.3) : C.superficie; ctx.fill();
        ctx.lineWidth = ambos ? 2.5 : 1.5; ctx.strokeStyle = ambos ? C.s3 : C.tinta; ctx.stroke();
        D.texto2(ctx, String(i + 1), X(i), y + 0.5, { px: 12, peso: 600 });
      }
      if (!comun) D.texto2(ctx, 'sin caballos comunes', W / 2, 168, { color: C.s8, px: 13, peso: 700 });
      registro.textContent = comun
        ? `Con k = ${k}, los grupos A = {1..${k}} y B = {2..${k + 1}} comparten ${comun} caballo${comun > 1 ? 's' : ''}: el color se transmite. El paso funciona.`
        : 'Con k = 1, A = {1} y B = {2} no comparten ningún caballo. El color del 1 y el del 2 no están relacionados: P(1) ⇒ P(2) es falso y toda la cadena se cae.';
      lectura.set([['caballos', String(n)], ['tamaño de A y de B', String(k)], ['caballos comunes', String(comun)], ['paso P(k) ⇒ P(k + 1)', comun ? 'válido' : 'falla']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: tres maneras de fallar ---------- */

  const primo = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  const FALLA = {
    sinBase: {
      nombre: 'Sin caso base: 1 + … + n = n(n+1)/2 + 1', P: (n) => n * (n + 1) / 2 === n * (n + 1) / 2 + 1,
      imp: () => true, dice: 'El paso funciona (sumar n + 1 a los dos lados conserva la igualdad) pero P(0) es falsa; la implicación es verdadera siempre y P no es verdadera nunca. Sin caso base no hay demostración.',
    },
    pasoFalso: {
      nombre: 'Paso falso: n < 100', P: (n) => n < 100, dice: 'El caso base P(0) es verdadero y la cadena avanza hasta 99, pero P(99) ⇒ P(100) es falso. Un solo paso roto basta: la inducción no concluye.',
    },
    pocosCasos: {
      nombre: 'Pocos casos: n² + n + 41 es primo', P: (n) => primo(n * n + n + 41), dice: 'Es verdadero para n = 0, …, 39, pero 40² + 40 + 41 = 41². Revisar muchos casos no sustituye al paso inductivo, y aquí el paso no se puede probar.',
    },
    inicioMalo: {
      nombre: 'Base insuficiente: 2ⁿ > n² desde n = 0', P: (n) => 2 ** n > n * n, dice: 'Hay caso base (P(0), P(1) son verdaderas) pero el paso P(1) ⇒ P(2) falla: 2 > 1 y 4 no es mayor que 4. Hay que empezar en n = 5, donde el paso ya funciona.',
    },
  };
  const M = 46;

  function montarFallas(cuerpo) {
    let clave = 'pasoFalso';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Intento de demostración', opciones: Object.entries(FALLA).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'P(n) verdadera', forma: 'cuadro' },
      { color: C.tinta, texto: 'paso P(n) ⇒ P(n + 1) verdadero', forma: 'cuadro' },
      { color: C.s8, texto: 'paso falso', forma: 'cuadro' },
      { color: C.s1, texto: 'cadena válida desde n = 0', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una demostración por inducción necesita las dos filas: base verdadera y todos los pasos verdaderos. Si falta alguna, la cadena azul no llega lejos.');

    function dibujar() {
      const F = FALLA[clave], { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const P = Array.from({ length: M + 1 }, (_, n) => F.P(n));
      const imp = Array.from({ length: M }, (_, n) => (F.imp ? F.imp(n) : !P[n] || P[n + 1]));
      let fin = -1;
      if (P[0]) { fin = 0; while (fin < M && imp[fin]) fin++; }
      const x0 = 56, w = W - x0 - 8;
      [['P(n)', 20], ['paso', 62], ['cadena', 104]].forEach(([t, y]) => D.texto2(ctx, t, x0 - 6, y + 13, { alinea: 'right', color: C.tinta2, px: 10.5 }));
      D.tira(ctx, x0, 20, w, M + 1, (n) => ({ fondo: P[n] ? C.s6 : C.neutro, texto: n % 5 === 0 || (w / (M + 1)) > 22 ? n : null, tinta: P[n] ? C.sobre : C.apagado }));
      D.tira(ctx, x0, 62, w, M + 1, (n) => (n < M ? { fondo: imp[n] ? C.tinta : C.s8 } : { fondo: C.superficie }));
      D.tira(ctx, x0, 104, w, M + 1, (n) => (P[0] && n <= fin ? { fondo: C.s1 } : { fondo: C.neutro }));
      registro.textContent = F.dice;
      const primeraF = P.findIndex((v) => !v);
      lectura.set([['caso base P(0)', P[0] ? 'verdadero' : 'falso'], ['primer n con P(n) falsa', primeraF < 0 ? `ninguno hasta ${M}` : String(primeraF)], ['pasos falsos', imp.map((v, n) => (v ? -1 : n)).filter((n) => n >= 0).slice(0, 4).join(', ') || 'ninguno'], ['la cadena demostrada llega a', P[0] ? (fin >= M ? `n = ${M}` : `n = ${fin}`) : 'ningún n']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('induction-fallacies', {
    intro: String.raw`
      <p>Una demostración por inducción puede parecer correcta y estar mal. Los errores caen casi siempre en uno de tres lugares: <strong>se olvida el caso base</strong>,
      <strong>el paso inductivo supone algo que no vale para valores pequeños</strong>, o <strong>se confunde comprobar varios casos con demostrar</strong>.</p>
      <p>El ejemplo más famoso es la «prueba» de que todos los caballos son del mismo color. Cada línea suena razonable; el defecto está en un único paso, y aprender a encontrarlo
      es la mejor forma de entender qué hace realmente la inducción.</p>`,
    visualizaciones: [
      {
        titulo: 'Todos los caballos son del mismo color',
        descripcion: 'Varíe \\(k\\) y mire cuántos caballos comparten los grupos A y B. Con \\(k = 1\\) no hay ninguno: ahí se rompe el argumento.',
        montar: montarCaballos,
      },
      {
        titulo: 'Cuatro maneras de fallar',
        descripcion: 'Cada enunciado rompe una pieza distinta: caso base, paso, verificación empírica o punto de partida. Compare las filas de P(n) y de los pasos.',
        montar: montarFallas,
      },
    ],
    teoria: String.raw`
      <h2>La falsa demostración de los caballos</h2>
      <p><em>Afirmación:</em> en todo conjunto de \(n\) caballos, todos tienen el mismo color. Base \(n=1\): trivial. Paso: dados \(k+1\) caballos, se separan los primeros \(k\) (grupo A) y los últimos \(k\)
      (grupo B). Por hipótesis, cada grupo es monocolor; como A y B comparten caballos, el color es el mismo y los \(k+1\) tienen un único color.</p>
      <div class="recuadro"><strong>El error:</strong> A y B comparten \(k-1\) caballos. Si \(k = 1\) no comparten ninguno y el argumento se rompe, justo al pasar de \(P(1)\) a \(P(2)\).
      Como \(P(2)\) es falsa, la cadena de implicaciones nunca arranca.</div>
      <h2>Lista de verificación</h2>
      <table>
        <tr><th>Error</th><th>Síntoma</th><th>Ejemplo</th></tr>
        <tr><td>Sin caso base</td><td>el paso es cierto pero \(P\) es falsa</td><td>\(\sum i = \tfrac{n(n+1)}{2} + 1\)</td></tr>
        <tr><td>Paso inválido en un valor</td><td>la implicación falla para algún \(k\)</td><td>«\(n &lt; 100\)», caballos</td></tr>
        <tr><td>Muchos casos, sin paso</td><td>se confunde evidencia con demostración</td><td>\(n^2 + n + 41\) primo hasta \(n = 39\)</td></tr>
        <tr><td>Hipótesis más fuerte que la usada</td><td>el paso usa \(P(k-1)\) y solo se supuso \(P(k)\)</td><td>ver <a href="tema.html?id=simple-vs-strong">inducción fuerte</a></td></tr>
      </table>
      <h2>Cómo revisar una prueba</h2>
      <p>Compruebe, con valores concretos, que el paso inductivo vale <em>para todos los \(k\) desde el caso base</em>, empezando por el más pequeño. El paso del primer valor suele ser el que se rompe.
      Para ver cuándo un paso sí es válido y desde dónde, use la segunda figura de <a href="tema.html?id=induction-proofs">Induction Proofs</a>.</p>`,
  });
})();
