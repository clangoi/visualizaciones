(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const leerLista = (txt) => txt.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const r = D.analizar(s); if (r.error) throw new Error(`«${s}»: ${r.error}`); return r.ast; });

  function veredicto(r, premisas, conclusion) {
    if (!premisas.length) return `Sin premisas, la conclusión es consecuencia solo si es una tautología: ${r.valido ? 'lo es' : 'no lo es'}.`;
    if (r.valido) return `Argumento VÁLIDO: en las ${r.nModelos} valuaciones que hacen verdaderas todas las premisas (filas verdes), la conclusión también es verdadera.${r.nModelos === 0 ? '\nNota: ninguna valuación satisface las premisas, así que la validez es vacía.' : ''}`;
    return `Argumento INVÁLIDO: con ${D.valTexto(r.contra.v, r.vars)} las premisas son verdaderas y la conclusión es falsa (fila roja). Esa valuación es un contraejemplo.`;
  }

  /* ---------- Fig. 1: premisas y conclusión a elección ---------- */

  const EJEMPLOS = [
    ['p → q; p', 'q', 'modus ponens'], ['p → q; q', 'p', 'afirmar el consecuente'], ['p ∨ q; ¬p', 'q', 'silogismo disyuntivo'], ['p → q; q → r', 'p → r', 'silogismo hipotético'],
    ['p ∧ q', 'p ∨ r', 'consecuencia sencilla'], ['p; ¬p', 'q', 'de una contradicción, todo'],
  ];

  function montarArgumento(cuerpo) {
    let prem = leerLista(EJEMPLOS[0][0]), conc = D.leer(EJEMPLOS[0][1]);
    const ctl = VIZ.controles(cuerpo);
    const cp = ctl.texto({ etiqueta: 'Premisas (separadas por «;»)', valor: EJEMPLOS[0][0], alCambiar: () => leer() });
    const cc = ctl.texto({ etiqueta: 'Conclusión', valor: EJEMPLOS[0][1], alCambiar: () => leer() });
    for (const c of [cp, cc]) { c.input.parentNode.classList.add('campo-formula'); c.input.addEventListener('input', () => leer()); }
    ctl.selector({ etiqueta: 'Ejemplos', opciones: EJEMPLOS.map(([a, b, n], i) => [i, n]), valor: 0, alCambiar: (v) => { const [a, b] = EJEMPLOS[+v]; cp.valor = a; cc.valor = b; leer(); } });
    D.simbolos(cuerpo, cp.input, ['¬', '∧', '∨', '→', '↔', '(', ')', ';']);
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: verde = premisas verdaderas, rojo = contraejemplo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Γ ⊨ φ significa: toda valuación que hace verdaderas todas las premisas hace verdadera la conclusión. Las filas verdes son los modelos de las premisas; una fila roja los refuta.');

    function leer() {
      try { prem = leerLista(cp.valor); conc = D.leer(cc.valor); } catch (e) { registro.textContent = e.message; return; }
      const r = D.tablaArgumento(tabla, prem, conc);
      if (r.vars.length > 5) { registro.textContent = 'Use a lo más 5 variables.'; return; }
      registro.textContent = veredicto(r, prem, conc);
      lectura.set([['premisas', String(prem.length)], ['modelos de las premisas', `${r.nModelos} de ${r.vals.length}`], ['contraejemplos', String(r.filas.filter((f) => f.contra).length)], ['Γ ⊨ φ', r.valido ? 'sí' : 'no']]);
    }
    leer();
  }

  /* ---------- Fig. 2: formas de argumento conocidas ---------- */

  const FORMAS = [
    { n: 'Modus ponens', p: ['p → q', 'p'], c: 'q', e: 'Si llueve, la calle se moja. Llueve. Luego la calle se moja.' },
    { n: 'Modus tollens', p: ['p → q', '¬q'], c: '¬p', e: 'Si llueve, la calle se moja. La calle no está mojada. Luego no llueve.' },
    { n: 'Silogismo hipotético', p: ['p → q', 'q → r'], c: 'p → r', e: 'Si estudio, apruebo. Si apruebo, me gradúo. Luego, si estudio, me gradúo.' },
    { n: 'Silogismo disyuntivo', p: ['p ∨ q', '¬p'], c: 'q', e: 'Voy al cine o al teatro. No voy al cine. Luego voy al teatro.' },
    { n: 'Dilema constructivo', p: ['p → q', 'r → s', 'p ∨ r'], c: 'q ∨ s', e: 'Si llueve me quedo; si hace sol salgo. Llueve o hace sol. Luego me quedo o salgo.' },
    { n: 'Falacia: afirmar el consecuente', p: ['p → q', 'q'], c: 'p', e: 'Si llueve, la calle se moja. La calle está mojada. Luego llovió (pudo ser el camión aljibe).' },
    { n: 'Falacia: negar el antecedente', p: ['p → q', '¬p'], c: '¬q', e: 'Si llueve, la calle se moja. No llueve. Luego la calle no está mojada.' },
    { n: 'Falacia: o inclusivo como exclusivo', p: ['p ∨ q', 'p'], c: '¬q', e: 'Estudio o trabajo. Estudio. Luego no trabajo (podía hacer ambas).' },
    { n: 'Explosión', p: ['p', '¬p'], c: 'q', e: 'Llueve y no llueve. Luego, cualquier cosa.' },
  ];

  function montarFormas(cuerpo) {
    let i = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Forma de argumento', opciones: FORMAS.map((f, k) => [k, f.n]), valor: 0, alCambiar: (v) => { i = +v; dibujar(); } });
    const ejemplo = VIZ.registro(cuerpo);
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: verde = premisas verdaderas, rojo = contraejemplo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las cinco primeras formas son válidas: su validez no depende del contenido sino de la forma. Las tres siguientes son falacias comunes: hay una fila roja que las refuta.');

    function dibujar() {
      const F = FORMAS[i], prem = F.p.map(D.leer), conc = D.leer(F.c);
      const r = D.tablaArgumento(tabla, prem, conc);
      ejemplo.textContent = `Ejemplo: ${F.e}\nForma:  ${F.p.join(' ;  ')}  ⊨  ${F.c}`;
      registro.textContent = veredicto(r, prem, conc);
      lectura.set([['forma', F.n], ['válida', r.valido ? 'sí' : 'no'], ['contraejemplo', r.contra ? D.valTexto(r.contra.v, r.vars) : '—']]);
    }
    dibujar();
  }

  VIZ.registrarTema('logical-consequence', {
    intro: String.raw`
      <p>Un <strong>argumento</strong> tiene premisas y una conclusión. Es <strong>válido</strong> si la verdad de las premisas garantiza la verdad de la conclusión: no hay manera de que las premisas sean todas verdaderas y la conclusión falsa.
      Esa idea, expresada con valuaciones, es la <strong>consecuencia lógica</strong> \(\Gamma \models \varphi\).</p>
      <p>La validez es una propiedad de la <em>forma</em> del argumento, no de su contenido: un argumento válido puede tener premisas falsas, y uno inválido puede tener todas sus partes verdaderas. Para refutar un argumento inválido basta un único <strong>contraejemplo</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Premisas y conclusión a su elección',
        descripcion: 'Escriba premisas (separadas por «;») y una conclusión. Las filas verdes son los modelos de las premisas; si alguna fila es roja, el argumento es inválido.',
        montar: montarArgumento,
      },
      {
        titulo: 'Formas de argumento conocidas',
        descripcion: 'Compare las reglas válidas (modus ponens, tollens, silogismos) con las falacias típicas. Cada falacia tiene una fila roja que la refuta.',
        montar: montarFormas,
      },
    ],
    teoria: String.raw`
      <h2>Consecuencia semántica</h2>
      <p>Para un conjunto de fórmulas \(\Gamma\) y una fórmula \(\varphi\):</p>
      \[ \Gamma \models \varphi \iff \text{toda valuación } v \text{ con } \bar v(\gamma) = 1 \text{ para cada } \gamma \in \Gamma \text{ cumple } \bar v(\varphi) = 1. \]
      <p>Si \(\Gamma = \varnothing\), \(\models \varphi\) significa que \(\varphi\) es una <a href="tema.html?id=tautologies">tautología</a>. Si \(\Gamma\) es insatisfacible, entonces \(\Gamma \models \varphi\) para toda \(\varphi\) (de una contradicción se sigue cualquier cosa).</p>
      <h2>Propiedades</h2>
      <ul>
        <li><em>Reflexividad:</em> \(\varphi \in \Gamma \Rightarrow \Gamma \models \varphi\).</li>
        <li><em>Monotonía:</em> \(\Gamma \models \varphi \Rightarrow \Gamma \cup \Delta \models \varphi\) (agregar premisas no invalida).</li>
        <li><em>Teorema de la deducción:</em> \(\Gamma \cup \{A\} \models B \iff \Gamma \models A \to B\).</li>
        <li><em>Refutación:</em> \(\Gamma \models \varphi \iff \Gamma \cup \{\neg\varphi\}\) es insatisfacible (ver <a href="tema.html?id=consequence-unsat">Consequence as Unsatisfiability</a>).</li>
      </ul>
      <h2>Validez frente a verdad</h2>
      <table>
        <tr><th>Premisas</th><th>Argumento</th><th>Conclusión</th></tr>
        <tr><td>verdaderas</td><td>válido</td><td>verdadera (garantizado)</td></tr>
        <tr><td>falsas</td><td>válido</td><td>puede ser verdadera o falsa</td></tr>
        <tr><td>verdaderas</td><td>inválido</td><td>puede ser falsa</td></tr>
      </table>
      <p>Para decidirlo se usa la tabla (aquí), o métodos más eficientes como la <a href="tema.html?id=resolution-refutation">resolución</a>. Reglas de inferencia que preservan la validez en <a href="tema.html?id=inference-rules">Inference Rules</a>.</p>`,
  });
})();
