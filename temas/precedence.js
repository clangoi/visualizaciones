(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const RANGO = { not: 1, and: 2, nand: 2, or: 3, xor: 3, nor: 3, imp: 4, iff: 5 };

  /* ---------- Fig. 1: los paréntesis que no se escriben ---------- */

  function montarPrecedencia(cuerpo) {
    let ast = D.leer('¬p ∧ q ∨ r → s ↔ t');
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '¬p ∧ q ∨ r → s ↔ t', alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; lienzo.ajustar(true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    VIZ.leyenda(cuerpo, [{ color: C.superficie, borde: C.tinta2, texto: 'el número bajo cada conectivo es su orden de ligadura (1 = se aplica primero)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Orden de ligadura: ¬ liga más que ∧, este más que ∨, luego →, y al final ↔. El → asocia a la derecha: p → q → r es p → (q → r).');

    function dibujar() {
      lienzo.limpiar();
      D.arbol(lienzo, ast, { nota: (r) => (RANGO[r.n.k] ? String(RANGO[r.n.k]) : null) });
      registro.textContent = `Como se escribió:        ${D.texto(ast)}\nTotalmente parentizada: ${D.textoTotal(ast, false)}`;
      const total = D.textoTotal(ast, false);
      lectura.set([['conectivo principal', ast.k === 'var' ? '—' : D.etiqueta(ast)], ['paréntesis que faltaban', String((total.match(/\(/g) || []).length - (D.texto(ast).match(/\(/g) || []).length)], ['nodos', String(D.tam(ast))]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: la ambigüedad sin paréntesis ---------- */

  const OPS = { and: '∧', or: '∨', imp: '→', iff: '↔', nand: '↑' };

  // Todas las formas de parentizar x1 ∘ x2 ∘ … ∘ xn.
  function lecturas(op, vars) {
    if (vars.length === 1) return [{ k: 'var', n: vars[0] }];
    const out = [];
    for (let i = 1; i < vars.length; i++) for (const a of lecturas(op, vars.slice(0, i))) for (const b of lecturas(op, vars.slice(i))) out.push({ k: op, a, b });
    return out;
  }
  const catalan = (n) => { let c = 1; for (let i = 0; i < n; i++) c = (c * 2 * (2 * i + 1)) / (i + 2); return Math.round(c); };

  function montarAmbiguedad(cuerpo) {
    let op = 'imp', n = 4;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conectivo repetido', opciones: Object.entries(OPS).map(([k, s]) => [k, s]), valor: op, alCambiar: (v) => { op = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Variables', min: 2, max: 6, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    cuerpo.dataset.sinLeyenda = 'figura de tabla: no usa color con significado';
    const caja = VIZ.el('div', { class: 'caja-desplazable caja-alta' });
    cuerpo.appendChild(caja);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una forma de poner paréntesis a la misma cadena sin ellos. Si todas dan la misma función, el conectivo es asociativo y los paréntesis sobran; si no, la cadena es ambigua.');

    function dibujar() {
      const vars = Array.from({ length: n }, (_, i) => 'x' + (i + 1));
      const L = lecturas(op, vars), vals = D.valuaciones(vars);
      const firmas = L.map((a) => vals.map((v) => (D.evalua(a, v) ? 1 : 0)).join(''));
      const distintas = new Set(firmas).size;
      const filas = L.map((a, i) => VIZ.el('tr', null,
        VIZ.el('td', null, String(i + 1)), VIZ.el('td', { class: 'izq' }, D.textoTotal(a)),
        VIZ.el('td', null, String(firmas[i].split('').filter((c) => c === '1').length)), VIZ.el('td', null, firmas[i] === firmas[0] ? 'sí' : 'no')));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['#', 'lectura', `filas V de ${vals.length}`, 'igual a la #1'].map((t) => VIZ.el('th', null, t)))),
        VIZ.el('tbody', null, filas)));
      lectura.set([['lecturas posibles (Catalan)', String(catalan(n - 1))], ['funciones distintas', String(distintas)], ['¿ambigua?', distintas > 1 ? 'sí: hacen falta paréntesis' : 'no: da igual'], ['filas de la tabla', String(vals.length)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('precedence', {
    intro: String.raw`
      <p>Escribir todos los paréntesis vuelve las fórmulas ilegibles. Por eso se acuerdan <strong>reglas de precedencia</strong>: como en aritmética, \(2 + 3 \times 4\) significa \(2 + (3 \times 4)\) porque la multiplicación «liga más fuerte».
      En lógica, \(\neg\) liga más que \(\land\), este más que \(\lor\), luego \(\to\) y por último \(\leftrightarrow\).</p>
      <p>Las reglas son convenciones: sirven para reconstruir <em>un único</em> árbol sintáctico a partir del texto abreviado. Cuando no alcanzan —por ejemplo, con la misma operación repetida— hay ambigüedad, y a veces importa y a veces no.</p>`,
    visualizaciones: [
      {
        titulo: 'Los paréntesis que no se escriben',
        descripcion: 'Escriba una fórmula sin paréntesis y vea el árbol y la versión totalmente parentizada. Pruebe \\(p \\to q \\to r\\) y \\(p \\lor q \\land r\\).',
        montar: montarPrecedencia,
      },
      {
        titulo: 'Cuántas lecturas tiene una cadena',
        descripcion: 'Una cadena \\(x_1 \\circ x_2 \\circ \\cdots \\circ x_n\\) admite números de Catalan de lecturas. Compare cuántas funciones distintas producen con \\(\\land\\) y con \\(\\to\\).',
        montar: montarAmbiguedad,
      },
    ],
    teoria: String.raw`
      <h2>Convención de precedencia</h2>
      <table>
        <tr><th>Orden</th><th>Conectivo</th><th>Asociatividad</th></tr>
        <tr><td>1 (el que más liga)</td><td>\(\neg\)</td><td>prefijo</td></tr>
        <tr><td>2</td><td>\(\land\)</td><td>izquierda (da igual)</td></tr>
        <tr><td>3</td><td>\(\lor\)</td><td>izquierda (da igual)</td></tr>
        <tr><td>4</td><td>\(\to\)</td><td><strong>derecha</strong>: \(p \to q \to r \equiv p \to (q \to r)\)</td></tr>
        <tr><td>5</td><td>\(\leftrightarrow\)</td><td>izquierda (da igual)</td></tr>
      </table>
      <p>La asociatividad a la derecha de \(\to\) es la que se usa en la práctica, porque \(p \to (q \to r)\) es la lectura útil (equivale a \((p \land q) \to r\)), mientras que \((p \to q) \to r\) casi nunca se necesita.</p>
      <h2>Cuántas lecturas hay</h2>
      <p>Una cadena de \(n\) operandos unidos por el mismo conectivo binario se puede parentizar de
      \[ C_{n-1} = \frac{1}{n}\binom{2n-2}{n-1} \]
      maneras (números de Catalan: 1, 2, 5, 14, 42, …). Para \(\land, \lor, \leftrightarrow\) todas las lecturas son equivalentes, porque son asociativos. Para \(\to\) y \(\uparrow\) no: cuatro variables ya dan lecturas distintas.</p>
      <h2>Recomendación</h2>
      <p>Omita paréntesis solo cuando la convención sea inequívoca para quien lea; mezclar \(\land\) con \(\lor\) o encadenar \(\to\) conviene parentizarlo, aunque sobre. Las fórmulas se evalúan según su
      <a href="tema.html?id=syntax-trees">árbol sintáctico</a>, no según el texto, así que el árbol es lo que manda.</p>`,
  });
})();
