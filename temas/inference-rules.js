(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const neg = (a) => (a.k === 'not' ? a.a : { k: 'not', a });
  const T = (a) => D.texto(a);

  /* ---------- Motor de inferencia hacia adelante ---------- */

  const PROBLEMAS = [
    { n: 'Cadena de implicaciones', p: ['p → q', 'q → r', 'p'], m: 'r' },
    { n: 'Tollens y silogismo disyuntivo', p: ['p → q', '¬q', 'p ∨ r'], m: 'r' },
    { n: 'Simplificación y dos pasos', p: ['p ∧ s', 'p → q', 'q → r'], m: 'r' },
    { n: 'Tollens encadenado', p: ['p → q', 'q → r', '¬r'], m: '¬p' },
    { n: 'Disyunción y condicional', p: ['p ∨ q', '¬p', 'q → r'], m: 'r' },
  ];

  // Aplica una vez cada regla posible (en orden fijo) y devuelve la primera línea nueva, o null.
  function paso(L) {
    const tiene = (a) => L.some((l) => T(l.ast) === T(a));
    const idx = (a) => L.findIndex((l) => T(l.ast) === T(a));
    const nuevo = (ast, regla, ref) => (tiene(ast) ? null : { ast, just: `${regla} ${ref.map((i) => i + 1).join(', ')}` });
    for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) {
      const A = L[i].ast, B = L[j].ast;
      let r = null;
      if (A.k === 'imp' && idx(A.a) >= 0) r = nuevo(A.b, 'Modus ponens', [i, idx(A.a)]);
      if (!r && A.k === 'imp' && idx(neg(A.b)) >= 0) r = nuevo(neg(A.a), 'Modus tollens', [i, idx(neg(A.b))]);
      if (!r && A.k === 'imp' && B.k === 'imp' && T(A.b) === T(B.a)) r = nuevo({ k: 'imp', a: A.a, b: B.b }, 'Silogismo hipotético', [i, j]);
      if (!r && A.k === 'or' && idx(neg(A.a)) >= 0) r = nuevo(A.b, 'Silogismo disyuntivo', [i, idx(neg(A.a))]);
      if (!r && A.k === 'or' && idx(neg(A.b)) >= 0) r = nuevo(A.a, 'Silogismo disyuntivo', [i, idx(neg(A.b))]);
      if (!r && A.k === 'and') r = nuevo(A.a, 'Simplificación', [i]) || nuevo(A.b, 'Simplificación', [i]);
      if (r) return r;
    }
    return null;
  }
  // Deriva hasta alcanzar la meta; en modo absurdo, hasta hallar una línea y su negación.
  function derivar(prem, meta, absurdo) {
    const L = prem.map((a) => ({ ast: D.leer(a), just: 'premisa' }));
    const M = D.leer(meta);
    if (absurdo) L.push({ ast: neg(M), just: 'supuesto: negación de la meta' });
    const contra = () => { for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (T(L[i].ast) === T(neg(L[j].ast))) return [i, j]; return null; };
    const nPrem = L.length;
    while (true) {
      if (absurdo ? contra() : L.some((l) => T(l.ast) === T(M))) break;
      const s = paso(L);
      if (!s) return { L, nPrem, meta: M, fin: null };
      L.push(s);
    }
    return { L, nPrem, meta: M, fin: absurdo ? contra() : [L.findIndex((l) => T(l.ast) === T(M))] };
  }

  function montar(cuerpo, absurdo) {
    let idx = 0, D_ = null, k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: PROBLEMAS.map((p, i) => [i, p.n]), valor: 0, alCambiar: (v) => { idx = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const meta = VIZ.registro(cuerpo);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, absurdo ? 'Se añade ¬meta como supuesto y se deriva hasta que aparezcan una fórmula y su negación: esa contradicción refuta el supuesto.' : 'En cada paso se aplica una regla válida a líneas anteriores y se agrega la conclusión como nueva línea, hasta obtener la meta.');

    function iniciar() {
      const P = PROBLEMAS[idx];
      D_ = derivar(P.p, P.m, absurdo);
      k = D_.nPrem;
      return (function* () { for (; k < D_.L.length; k++) yield; k = D_.L.length; })();
    }
    function dibujar() {
      const P = PROBLEMAS[idx];
      meta.textContent = `Premisas: ${P.p.join(' ;  ')}\nMeta: ${P.m}${absurdo ? '   (por reducción al absurdo)' : ''}`;
      lista.replaceChildren(...D_.L.slice(0, k).map((l, i) => VIZ.el('div', { class: i === k - 1 && k > D_.nPrem ? 'activa' : null }, `${i + 1}.  ${T(l.ast)}      [${l.just}]`)));
      const fin = k === D_.L.length;
      registro.textContent = !fin ? 'Pulse «Un paso» para aplicar la siguiente regla.'
        : !D_.fin ? 'No se pudo derivar con estas reglas.'
          : absurdo ? `Contradicción: las líneas ${D_.fin[0] + 1} y ${D_.fin[1] + 1} son ${T(D_.L[D_.fin[0]].ast)} y ${T(D_.L[D_.fin[1]].ast)}.\nComo el supuesto ¬(${P.m}) lleva a una contradicción, se concluye ${P.m}.`
            : `Meta alcanzada en la línea ${D_.fin[0] + 1}: ${P.m}. Por tanto las premisas implican ${P.m}.`;
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('inference-rules', {
    intro: String.raw`
      <p>En vez de recorrer tablas de verdad, el razonamiento formal avanza con <strong>reglas de inferencia</strong>: esquemas de argumento válidos que se aplican a líneas ya establecidas para obtener otras nuevas.
      Una <strong>demostración</strong> es una lista de líneas, cada una premisa o consecuencia de líneas anteriores por una regla.</p>
      <p>Otra estrategia es la <strong>reducción al absurdo</strong>: para probar una conclusión se supone su negación y se busca una contradicción. Si aparece, el supuesto era imposible.</p>`,
    visualizaciones: [
      {
        titulo: 'Derive la conclusión',
        descripcion: 'Elija un problema y avance paso a paso: el motor aplica modus ponens, tollens, silogismos y simplificación hasta llegar a la meta. Lea la justificación de cada línea.',
        montar: (c) => montar(c, false),
      },
      {
        titulo: 'Reducción al absurdo',
        descripcion: 'Los mismos problemas, pero agregando la negación de la meta como supuesto. El éxito se reconoce cuando aparecen una línea y su negación.',
        montar: (c) => montar(c, true),
      },
    ],
    teoria: String.raw`
      <h2>Reglas básicas</h2>
      <table>
        <tr><th>Nombre</th><th>Premisas</th><th>Conclusión</th></tr>
        <tr><td>Modus ponens</td><td>\(A \to B,\ A\)</td><td>\(B\)</td></tr>
        <tr><td>Modus tollens</td><td>\(A \to B,\ \neg B\)</td><td>\(\neg A\)</td></tr>
        <tr><td>Silogismo hipotético</td><td>\(A \to B,\ B \to C\)</td><td>\(A \to C\)</td></tr>
        <tr><td>Silogismo disyuntivo</td><td>\(A \lor B,\ \neg A\)</td><td>\(B\)</td></tr>
        <tr><td>Simplificación</td><td>\(A \land B\)</td><td>\(A\) (y \(B\))</td></tr>
        <tr><td>Conjunción</td><td>\(A,\ B\)</td><td>\(A \land B\)</td></tr>
        <tr><td>Adición</td><td>\(A\)</td><td>\(A \lor B\)</td></tr>
      </table>
      <p>Cada regla es una <a href="tema.html?id=logical-consequence">consecuencia lógica válida</a>, comprobable con una tabla de verdad; por eso las derivaciones son <em>correctas</em>: lo que se deriva se sigue de las premisas. Que bastan para derivar todo lo que se sigue (completitud) es un teorema más profundo.</p>
      <h2>Reducción al absurdo</h2>
      <p>Para probar \(\Gamma \vdash \varphi\) se supone \(\neg\varphi\) y se deriva una contradicción \(\bot\) (una fórmula junto con su negación) de \(\Gamma \cup \{\neg\varphi\}\). Como \(\Gamma \cup \{\neg\varphi\}\) resulta insatisfacible, vale \(\Gamma \models \varphi\)
      (ver <a href="tema.html?id=consequence-unsat">Consequence as Unsatisfiability</a>).</p>
      <h2>Límites del motor</h2>
      <p>Aplicar las reglas a ciegas no siempre llega a la meta con estas reglas solas (faltan, por ejemplo, reglas que cierren subdemostraciones). El método de <a href="tema.html?id=resolution-refutation">resolución</a> evita el problema con una sola regla, sobre cláusulas, y es completo para refutación.</p>`,
  });
})();
