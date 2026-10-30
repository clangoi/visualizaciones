(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: compare dos fórmulas ---------- */

  const PARES = [
    ['¬(p ∧ q)', '¬p ∨ ¬q', 'De Morgan'], ['¬(p ∨ q)', '¬p ∧ ¬q', 'De Morgan'], ['p → q', '¬q → ¬p', 'contrapositiva'], ['p → q', '¬p ∨ q', 'implicación como disyunción'],
    ['p ↔ q', '(p → q) ∧ (q → p)', 'bicondicional'], ['p ∧ (q ∨ r)', '(p ∧ q) ∨ (p ∧ r)', 'distributiva'], ['¬¬p', 'p', 'doble negación'],
    ['p → q', 'q → p', 'conversa (NO equivalente)'], ['p → q', '¬p → ¬q', 'inversa (NO equivalente)'], ['¬(p → q)', '¬p → ¬q', 'error frecuente (NO equivalente)'],
  ];

  function montarComparacion(cuerpo) {
    let A = D.leer(PARES[0][0]), B = D.leer(PARES[0][1]);
    const ctl = VIZ.controles(cuerpo);
    const ca = D.campoFormula(cuerpo, ctl, { etiqueta: 'Fórmula A', valor: PARES[0][0], alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(ca.valor, r); return; } A = r.ast; dibujar(); } });
    const cb = D.campoFormula(cuerpo, ctl, { etiqueta: 'Fórmula B', valor: PARES[0][1], simbolos: false, alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(cb.valor, r); return; } B = r.ast; dibujar(); } });
    ctl.selector({ etiqueta: 'Pares conocidos', opciones: PARES.map(([a, b, n], i) => [i, `${n}`]), valor: 0, alCambiar: (v) => { const [a, b] = PARES[+v]; ca.valor = a; cb.valor = b; A = D.leer(a); B = D.leer(b); dibujar(); } });
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: las filas rojas son las que difieren';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos fórmulas son equivalentes si tienen la misma columna de resultados. Las filas rojas son valuaciones que las distinguen: sirven de contraejemplo a la equivalencia.');

    function dibujar() {
      const vars = [...new Set([...D.vars(A), ...D.vars(B)])].sort();
      if (vars.length > 5) { registro.textContent = 'Use a lo más 5 variables en total.'; return; }
      const vals = D.valuaciones(vars);
      const dif = vals.filter((v) => D.evalua(A, v) !== D.evalua(B, v));
      tabla.poner({ vars, vals, cols: [{ t: D.texto(A), f: (v) => D.evalua(A, v) }, { t: D.texto(B), f: (v) => D.evalua(B, v) }, { t: 'A ↔ B', f: (v) => D.evalua(A, v) === D.evalua(B, v), fuerte: true }], clase: (v) => (D.evalua(A, v) !== D.evalua(B, v) ? 'contraejemplo' : '') });
      registro.textContent = dif.length ? `No son equivalentes: difieren en ${dif.length} de ${vals.length} filas, por ejemplo con ${D.valTexto(dif[0], vars)}.` : `Son equivalentes: coinciden en las ${vals.length} filas. A ↔ B es una tautología.`;
      lectura.set([['variables', vars.join(', ')], ['filas', String(vals.length)], ['filas distintas', String(dif.length)], ['A ≡ B', dif.length ? 'no' : 'sí']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: reescritura con leyes ---------- */

  function montarReescritura(cuerpo) {
    let historial = [{ ast: D.leer('¬(p → q) ∨ ¬(r ∧ ¬s)'), ley: 'fórmula inicial' }], ley = D.LEYES[0], aviso = '';
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '¬(p → q) ∨ ¬(r ∧ ¬s)', alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } historial = [{ ast: r.ast, ley: 'fórmula inicial' }]; aviso = ''; dibujar(); } });
    ctl.selector({ etiqueta: 'Ley a aplicar', opciones: D.LEYES.map((l) => [l.id, l.nombre]), valor: ley.id, alCambiar: (v) => { ley = D.LEYES.find((l) => l.id === v); } });
    ctl.boton('Aplicar la ley', () => {
      const r = D.aplicarLey(historial[historial.length - 1].ast, ley);
      if (!r) aviso = `La ley «${ley.nombre}» no se aplica a ninguna subfórmula de la fórmula actual.`;
      else { historial.push({ ast: r, ley: ley.nombre }); aviso = ''; }
      dibujar();
    }, { primario: true });
    ctl.boton('Deshacer', () => { if (historial.length > 1) historial.pop(); aviso = ''; dibujar(); });
    ctl.boton('Reiniciar', () => { historial = [historial[0]]; aviso = ''; dibujar(); });
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La ley se aplica a la primera subfórmula donde encaja (de arriba hacia abajo). Cada paso se verifica con una tabla de verdad: reescribir con una ley nunca cambia el significado.');

    function dibujar() {
      lista.replaceChildren(...historial.map((h, i) => VIZ.el('div', { class: i === historial.length - 1 ? 'activa' : null }, `${i}.  ${D.texto(h.ast)}    ${i ? `[${h.ley}]` : ''}`)));
      const ini = historial[0].ast, fin = historial[historial.length - 1].ast;
      registro.textContent = aviso || `Fórmula actual:  ${D.texto(fin)}`;
      lectura.set([['pasos', String(historial.length - 1)], ['equivalente a la inicial', D.equivalentes(ini, fin) ? 'sí (verificado por tabla)' : 'NO'], ['tamaño', `${D.tam(ini)} → ${D.tam(fin)}`]]);
    }
    dibujar();
  }

  VIZ.registrarTema('logical-equivalence', {
    intro: String.raw`
      <p>Dos fórmulas son <strong>lógicamente equivalentes</strong> si tienen el mismo valor de verdad bajo toda valuación: dicen lo mismo con otras palabras. Equivalencias como las <strong>leyes de De Morgan</strong>,
      la <strong>doble negación</strong> o la <strong>contrapositiva</strong> permiten reescribir una fórmula sin cambiar su significado.</p>
      <p>Hay dos maneras de establecerlas: comparar las tablas de verdad, o encadenar leyes conocidas. La primera es mecánica; la segunda es cómo se razona y simplifica a mano.</p>`,
    visualizaciones: [
      {
        titulo: 'Compare dos fórmulas',
        descripcion: 'Elija un par conocido o escriba el suyo y mire en qué filas difieren. Compare la contrapositiva (equivalente) con la conversa (no lo es).',
        montar: montarComparacion,
      },
      {
        titulo: 'Reescriba con leyes',
        descripcion: 'Aplique leyes una por una a una fórmula y vea cómo se transforma, sin que cambie su significado. Pruebe De Morgan, la implicación como disyunción y la doble negación.',
        montar: montarReescritura,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      \[ A \equiv B \iff \text{para toda valuación } v,\ \bar v(A) = \bar v(B) \iff A \leftrightarrow B \text{ es una tautología.} \]
      <p>La equivalencia es una relación de equivalencia (reflexiva, simétrica, transitiva) y es una <em>congruencia</em>: si \(A \equiv B\), reemplazar \(A\) por \(B\) dentro de cualquier fórmula no cambia su valor.
      Eso justifica reescribir subfórmulas.</p>
      <h2>Leyes principales</h2>
      <table>
        <tr><th>Nombre</th><th>Ley</th></tr>
        <tr><td>Doble negación</td><td>\(\neg\neg A \equiv A\)</td></tr>
        <tr><td>De Morgan</td><td>\(\neg(A \land B) \equiv \neg A \lor \neg B\), \(\neg(A \lor B) \equiv \neg A \land \neg B\)</td></tr>
        <tr><td>Implicación</td><td>\(A \to B \equiv \neg A \lor B \equiv \neg B \to \neg A\)</td></tr>
        <tr><td>Negación de la implicación</td><td>\(\neg(A \to B) \equiv A \land \neg B\)</td></tr>
        <tr><td>Bicondicional</td><td>\(A \leftrightarrow B \equiv (A \to B) \land (B \to A)\)</td></tr>
        <tr><td>Distributivas</td><td>\(A \land (B \lor C) \equiv (A \land B) \lor (A \land C)\) y la dual</td></tr>
        <tr><td>Absorción</td><td>\(A \lor (A \land B) \equiv A\)</td></tr>
      </table>
      <h2>Error frecuente</h2>
      <p>La conversa \(B \to A\) y la inversa \(\neg A \to \neg B\) <em>no</em> son equivalentes a \(A \to B\). Es la fuente de los argumentos inválidos (ver <a href="tema.html?id=logical-consequence">Logical Consequence</a>).</p>
      <h2>Aplicaciones</h2>
      <p>Las leyes de reescritura son las que usan los algoritmos de <a href="tema.html?id=cnf-dnf">conversión a forma normal</a>: eliminar \(\to\) y \(\leftrightarrow\), llevar las negaciones a los átomos y distribuir. Con un conjunto de conectivos suficiente, se puede expresar todo
      (ver <a href="tema.html?id=functional-completeness">Functionally Complete Sets</a>).</p>`,
  });
})();
