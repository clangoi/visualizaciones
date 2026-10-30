(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  // Forma estricta de la gramática: cada conectivo binario lleva sus paréntesis, incluso en la raíz.
  const estricta = (a) => (a.k === 'not' ? '¬' + estricta(a.a) : D.esBin(a) ? `(${estricta(a.a)} ${D.SIM[a.k]} ${estricta(a.b)})` : D.texto(a));

  /* ---------- Fig. 1: ¿es una fórmula bien formada? ---------- */

  const EJEMPLOS = ['(p ∧ q)', 'p ∧ q ∨ r', '(p ∧ q', 'p ∧ ∨ q', '¬¬p', '(p → (q → r))', 'p q', '¬(p ↔ ¬p)', '(p ∧ q) ∨', 'p → q → r'];

  function montarReconocedor(cuerpo) {
    let r = D.analizar('(p → ¬q) ∧ r');
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '(p → ¬q) ∧ r', alCambiar: (x) => { r = x; mostrar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir un ejemplo —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { campo.valor = v; r = D.analizar(v); mostrar(); } } });
    const sal = VIZ.el('div', { class: 'formula-viz' });
    cuerpo.appendChild(sal);
    cuerpo.dataset.sinLeyenda = 'figura de texto: el símbolo de error se marca en rojo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La gramática estricta exige paréntesis en cada conectivo binario. Con las convenciones de precedencia se aceptan abreviaturas, siempre que se pueda reconstruir un único árbol.');

    function mostrar() {
      const txt = campo.valor;
      if (r.error) {
        sal.replaceChildren(VIZ.el('span', null, txt.slice(0, r.pos)), VIZ.el('span', { class: 'tok', style: { color: C.s8, fontWeight: 700 } }, txt.slice(r.pos, r.pos + 1) || '▮'), VIZ.el('span', null, txt.slice(r.pos + 1)));
        registro.textContent = D.mensaje(txt, r);
        lectura.set([['¿fórmula bien formada?', 'no']]);
        return;
      }
      const a = r.ast, fuerte = estricta(a), norm = txt.replace(/\s+/g, '');
      sal.replaceChildren(VIZ.el('span', { style: { color: C.s6, fontWeight: 600 } }, D.texto(a)));
      const stricta = norm === fuerte.replace(/\s+/g, '');
      registro.textContent = stricta
        ? 'Es una fórmula bien formada según la gramática estricta: cada conectivo binario está entre paréntesis.'
        : `Es una fórmula si se aceptan las convenciones (precedencia, se omiten los paréntesis exteriores).\nForma estricta equivalente:  ${fuerte}`;
      lectura.set([['¿fórmula bien formada?', stricta ? 'sí (estricta)' : 'sí (con abreviaturas)'], ['variables', D.vars(a).join(', ') || '—'], ['tamaño', String(D.tam(a))], ['profundidad', String(D.prof(a))], ['conectivo principal', a.k === 'var' ? '—' : D.etiqueta(a)]]);
    }
    mostrar();
  }

  /* ---------- Fig. 2: derivación con la gramática ---------- */

  function generar(rnd, presupuesto) {
    const r = (p) => {
      if (p <= 0 || rnd() < 0.2) return { k: 'var', n: 'pqr'[Math.floor(rnd() * 3)] };
      if (rnd() < 0.25) return { k: 'not', a: r(p - 1) };
      const o = ['and', 'or', 'imp', 'iff'][Math.floor(rnd() * 4)];
      const izq = Math.floor((p - 1) * rnd());
      return { k: o, a: r(izq), b: r(p - 1 - izq) };
    };
    return r(presupuesto);
  }

  function montarGramatica(cuerpo) {
    let maxC = 3, semilla = 1, ast = null, pasos = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto de conectivos', min: 1, max: 6, valor: maxC, alCambiar: (v) => { maxC = v; nueva(); } });
    ctl.boton('Nueva fórmula', () => { semilla++; nueva(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (ast ? D.altoArbol(ast) : 120) });
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'φ todavía sin expandir', forma: 'cuadro' },
      { color: C.s2, texto: 'expansión de este paso', forma: 'cuadro' },
      { color: C.tinta, texto: 'ya expandido', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo, { grande: true });
    VIZ.nota(cuerpo, 'Gramática:  φ ::= p | q | r | ¬φ | (φ ∧ φ) | (φ ∨ φ) | (φ → φ) | (φ ↔ φ). Cada paso reemplaza el φ más a la izquierda.');

    const expandir = (n) => (n.k === 'var' ? [n.n] : n.k === 'not' ? ['¬', n.a] : ['(', n.a, ` ${D.SIM[n.k]} `, n.b, ')']);
    const regla = (n) => (n.k === 'var' ? `φ → ${n.n}` : n.k === 'not' ? 'φ → ¬φ' : `φ → (φ ${D.SIM[n.k]} φ)`);
    function nueva() { ast = generar(VIZ.semilla(semilla * 71 + maxC), maxC); pasos = D.derivar(ast, expandir); lienzo.ajustar(true); rep.reiniciar(); }
    function iniciar() { k = 0; return (function* () { for (k = 1; k < pasos.length; k++) yield; k = pasos.length - 1; })(); }
    function dibujar() {
      lienzo.limpiar();
      const hechos = new Set(pasos.slice(1, k + 1).map((p) => p.nodo)), actual = k > 0 ? pasos[k].nodo : null;
      D.arbol(lienzo, ast, { relleno: (r) => (hechos.has(r.n) ? C.superficie : C.neutro), borde: (r) => (r.n === actual ? C.s2 : hechos.has(r.n) ? C.tinta : C.inactivo), anillo: (r) => (r.n === actual ? C.s2 : null), texto: (r) => (hechos.has(r.n) ? C.tinta : C.apagado) });
      registro.textContent = pasos.slice(0, k + 1).map((p, i) => `${i ? '⇒' : ' '} ${D.formaTxt(p.forma, 'φ')}${i ? `     [${regla(p.nodo)}]` : ''}`).join('\n');
    }
    lienzo.alDibujar = () => ast && pasos.length && dibujar();
    nueva();
  }

  VIZ.registrarTema('wff', {
    intro: String.raw`
      <p>No toda sucesión de símbolos es una fórmula: «\(p \land \lor q\)» no significa nada. Una <strong>fórmula bien formada</strong> (fbf) es una cadena que se puede construir con las reglas de una <em>gramática</em>:
      las variables son fórmulas, y si \(A\) y \(B\) lo son, también lo son \(\neg A\), \((A \land B)\), \((A \lor B)\), \((A \to B)\) y \((A \leftrightarrow B)\).</p>
      <p>Esta definición es una <a href="tema.html?id=structural-definitions">definición estructural</a>. Que cada fórmula se pueda leer de una única manera —sin ambigüedad— es lo que permite después asignarle un significado.</p>`,
    visualizaciones: [
      {
        titulo: '¿Es una fórmula bien formada?',
        descripcion: 'Escriba o elija una cadena. Si está mal formada, se marca el primer símbolo que no encaja; si está bien, se muestra su forma estricta.',
        montar: montarReconocedor,
      },
      {
        titulo: 'Derivación con la gramática',
        descripcion: 'Genere una fórmula al azar y reproduzca su derivación: cada paso aplica una regla de la gramática al símbolo φ más a la izquierda.',
        montar: montarGramatica,
      },
    ],
    teoria: String.raw`
      <h2>Gramática</h2>
      <p>El conjunto \(\mathrm{FBF}\) de fórmulas sobre un conjunto \(V\) de variables es el menor conjunto tal que:</p>
      \[ \varphi \;::=\; p \;\mid\; \neg\varphi \;\mid\; (\varphi \land \varphi) \;\mid\; (\varphi \lor \varphi) \;\mid\; (\varphi \to \varphi) \;\mid\; (\varphi \leftrightarrow \varphi), \qquad p \in V. \]
      <h2>Lectura única</h2>
      <div class="recuadro"><strong>Teorema (lectura única).</strong> Toda fórmula es exactamente de una de las formas: una variable, \(\neg A\), o \((A \circ B)\), y en los dos últimos casos \(A\) y \(B\) quedan determinados.</div>
      <p>La prueba usa <a href="tema.html?id=structural-induction">inducción estructural</a>: en todo prefijo propio no vacío de una fórmula hay más «(» que «)». Por eso se puede decidir dónde termina cada operando, y el árbol sintáctico es único.
      Sin los paréntesis, \(p \land q \lor r\) tendría dos lecturas; la precedencia de operadores (ver <a href="tema.html?id=precedence">Operator Precedence</a>) es un convenio para abreviar.</p>
      <h2>Reconocimiento</h2>
      <p>Un reconocedor recorre la cadena de izquierda a derecha y lleva la cuenta de paréntesis abiertos: debe terminar en 0, y nunca puede ser negativa. Para la gramática de arriba basta un análisis descendente recursivo, que funciona en tiempo lineal.</p>
      <h2>Nomenclatura</h2>
      <ul>
        <li><em>Átomos</em> o <em>fórmulas atómicas</em>: las variables (y constantes \(\top, \bot\) si se incluyen).</li>
        <li><em>Conectivo principal</em>: el de la raíz del árbol sintáctico.</li>
        <li><em>Subfórmulas</em>: los textos que corresponden a los nodos del árbol (ver <a href="tema.html?id=syntax-trees">Syntax Trees</a>).</li>
      </ul>`,
  });
})();
