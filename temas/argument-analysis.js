(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: del lenguaje natural a la lógica ---------- */

  const ARGS = [
    { t: ['Si hay sol, voy a la playa.', 'Voy a la playa.'], c: 'Luego, hay sol.', v: 'p = hay sol, q = voy a la playa', p: ['p → q', 'q'], k: 'p' },
    { t: ['Si estudio, apruebo.', 'No apruebo.'], c: 'Luego, no estudié.', v: 'p = estudio, q = apruebo', p: ['p → q', '¬q'], k: '¬p' },
    { t: ['O gano la lotería o sigo trabajando.', 'No gané la lotería.'], c: 'Luego, sigo trabajando.', v: 'p = gano la lotería, q = sigo trabajando', p: ['p ∨ q', '¬p'], k: 'q' },
    { t: ['Si el acusado es culpable, tenía un motivo.', 'Si tenía un motivo, tuvo oportunidad.', 'El acusado no tuvo oportunidad.'], c: 'Luego, no es culpable.', v: 'p = es culpable, q = tenía motivo, r = tuvo oportunidad', p: ['p → q', 'q → r', '¬r'], k: '¬p' },
    { t: ['Estudio o juego.', 'Si juego, no apruebo.', 'Apruebo.'], c: 'Luego, estudio.', v: 'p = estudio, q = juego, r = apruebo', p: ['p ∨ q', 'q → ¬r', 'r'], k: 'p' },
    { t: ['Si llueve, la calle se moja.', 'La calle está mojada.'], c: 'Luego, llovió.', v: 'p = llueve, q = la calle se moja', p: ['p → q', 'q'], k: 'p' },
    { t: ['Si trabajo o estudio, me canso.', 'No me canso.'], c: 'Luego, no estudio.', v: 'p = trabajo, q = estudio, r = me canso', p: ['(p ∨ q) → r', '¬r'], k: '¬q' },
  ];

  function montarLenguaje(cuerpo) {
    let i = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Argumento', opciones: ARGS.map((a, k) => [k, `${k + 1}. ${a.c.replace('Luego, ', '→ ')}`]), valor: 0, alCambiar: (v) => { i = +v; dibujar(); } });
    const texto = VIZ.registro(cuerpo);
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: verde = premisas verdaderas, rojo = contraejemplo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El procedimiento: 1) asignar una letra a cada oración simple, 2) formalizar premisas y conclusión, 3) buscar una valuación con premisas verdaderas y conclusión falsa. Si existe, el argumento es inválido y esa valuación lo refuta.');

    function dibujar() {
      const A = ARGS[i], prem = A.p.map(D.leer), conc = D.leer(A.k);
      texto.textContent = A.t.join('\n') + '\n' + A.c + '\n\nVariables: ' + A.v + '\nFormalización: ' + A.p.join(' ;  ') + '  ⊨  ' + A.k;
      const r = D.tablaArgumento(tabla, prem, conc);
      const ctr = r.contra;
      registro.textContent = r.valido ? 'Argumento válido: no hay valuación que haga verdaderas las premisas y falsa la conclusión.'
        : `Argumento inválido. Contraejemplo: ${r.vars.map((x) => `${x} ${ctr.v[x] ? 'verdadera' : 'falsa'}`).join(', ')}. Las premisas se cumplen y la conclusión no.`;
      lectura.set([['válido', r.valido ? 'sí' : 'no'], ['modelos de las premisas', `${r.nModelos} de ${r.vals.length}`], ['contraejemplos', String(r.filas.filter((f) => f.contra).length)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: caballeros y bribones ---------- */

  // Un caballero siempre dice la verdad y un bribón siempre miente: X es caballero ⇔ (lo que dice X es verdadero).
  const ACERT = [
    { n: 'Un solo habitante', e: ['A: «Los dos somos bribones.»'], v: ['a', 'b'], r: ['a ↔ (¬a ∧ ¬b)'] },
    { n: 'Dos habitantes que se acusan', e: ['A: «B es caballero.»', 'B: «A y yo somos de distinto tipo.»'], v: ['a', 'b'], r: ['a ↔ b', 'b ↔ ¬(a ↔ b)'] },
    { n: 'Tres habitantes', e: ['A: «B y C son del mismo tipo.»', 'B: «A y C son de tipos distintos.»', 'C: «A es caballero.»'], v: ['a', 'b', 'c'], r: ['a ↔ (b ↔ c)', 'b ↔ ¬(a ↔ c)', 'c ↔ a'] },
    { n: 'Una condición', e: ['A: «Si yo soy caballero, B también lo es.»', 'B: «Yo soy bribón.»'], v: ['a', 'b'], r: ['a ↔ (a → b)', 'b ↔ ¬b'] },
    { n: 'Una afirmación sobre la cantidad', e: ['A: «Al menos uno de nosotros es bribón.»', 'B: «A es caballero.»'], v: ['a', 'b'], r: ['a ↔ (¬a ∨ ¬b)', 'b ↔ a'] },
  ];

  function montarAcertijo(cuerpo) {
    let i = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Acertijo', opciones: ACERT.map((a, k) => [k, a.n]), valor: 0, alCambiar: (v) => { i = +v; dibujar(); } });
    const texto = VIZ.registro(cuerpo);
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: las filas verdes son las asignaciones consistentes';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada frase se traduce a «X es caballero si y solo si lo que dice es verdad». Las filas verdes son las únicas asignaciones consistentes con todas las frases: los modelos del conjunto de restricciones.');

    function dibujar() {
      const P = ACERT[i], rs = P.r.map(D.leer), vals = D.valuaciones(P.v);
      const ok = (v) => rs.every((a) => D.evalua(a, v));
      tabla.poner({ vars: P.v, vals, cols: [...rs.map((a) => ({ t: D.texto(a), f: (v) => D.evalua(a, v) })), { t: 'todas', f: (v) => ok(v), fuerte: true }], clase: (v) => (ok(v) ? 'modelo' : '') });
      const sol = vals.filter(ok);
      texto.textContent = `${P.e.join('\n')}\n\nVariables: ${P.v.map((v, k) => `${v} = ${'ABC'[k]} es caballero`).join(', ')}`;
      registro.textContent = sol.length === 1 ? `Solución única: ${P.v.map((v, k) => `${'ABC'[k]} es ${sol[0][v] ? 'caballero' : 'bribón'}`).join(', ')}.`
        : sol.length ? `Hay ${sol.length} soluciones.` : 'Sin solución: las frases son inconsistentes (ninguna asignación las cumple todas).';
      lectura.set([['restricciones', String(rs.length)], ['asignaciones posibles', String(vals.length)], ['soluciones', String(sol.length)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('argument-analysis', {
    intro: String.raw`
      <p>Los argumentos de la vida diaria no vienen con letras ni con símbolos. Analizarlos tiene tres pasos: <strong>formalizar</strong> (asignar letras a las oraciones simples y escribir las premisas y la conclusión como fórmulas),
      <strong>decidir</strong> si la conclusión se sigue, y, si no se sigue, <strong>explicar el fallo</strong> con un contraejemplo.</p>
      <p>Los acertijos de caballeros y bribones muestran la misma idea al revés: en lugar de decidir una conclusión, se buscan todas las valuaciones que son consistentes con las frases, es decir, los <em>modelos</em>.</p>`,
    visualizaciones: [
      {
        titulo: 'Del lenguaje natural a la lógica',
        descripcion: 'Siete argumentos de la vida diaria con su formalización. Ubique los inválidos y lea el contraejemplo que los refuta en lenguaje común.',
        montar: montarLenguaje,
      },
      {
        titulo: 'Caballeros y bribones',
        descripcion: 'En esta isla los caballeros siempre dicen la verdad y los bribones siempre mienten. Las filas verdes son las asignaciones consistentes con lo que dicen.',
        montar: montarAcertijo,
      },
    ],
    teoria: String.raw`
      <h2>Método</h2>
      <ol>
        <li><strong>Simbolizar:</strong> cada oración simple recibe una variable; las partículas «y», «o», «si… entonces», «no» son conectivos.</li>
        <li><strong>Formalizar</strong> premisas \(\gamma_1, \dots, \gamma_n\) y conclusión \(\varphi\).</li>
        <li><strong>Buscar un contraejemplo:</strong> una valuación con \(\gamma_i\) verdaderas y \(\varphi\) falsa. Si no existe, \(\{\gamma_1,\dots,\gamma_n\} \models \varphi\).</li>
      </ol>
      <h2>Cuidado con las traducciones</h2>
      <ul>
        <li>«Si \(p\) entonces \(q\)» no dice «si no \(p\) entonces no \(q\)» (negar el antecedente) ni «si \(q\) entonces \(p\)» (afirmar el consecuente).</li>
        <li>«O» puede ser inclusivo (\(\lor\)) o exclusivo (\(\oplus\)). En la lógica se toma el inclusivo salvo que se aclare.</li>
        <li>Una oración compuesta puede esconder una negación: «no es el caso que \(p\) y \(q\)» es \(\neg(p \land q)\), no \(\neg p \land \neg q\).</li>
      </ul>
      <h2>Acertijos como problemas de satisfacción</h2>
      <p>Cada frase de un habitante \(X\) con contenido \(\varphi\) impone la restricción \(X \leftrightarrow \varphi\). Un acertijo bien planteado tiene un único modelo; si hay varios, está subdeterminado; si no hay ninguno, es inconsistente.
      Es exactamente el problema de <a href="tema.html?id=satisfiability">satisfacibilidad</a> aplicado a un conjunto de restricciones.</p>
      <p>Para razonar sobre premisas con cuantificadores («todos los hombres son mortales») hace falta la <a href="tema.html?id=predicates-domains">lógica de predicados</a>.</p>`,
  });
})();
