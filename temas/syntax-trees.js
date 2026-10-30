(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const descendientes = (a) => [a, ...D.hijos(a).flatMap(descendientes)];

  /* ---------- Fig. 1: árbol sintáctico y subfórmulas ---------- */

  function montarArbol(cuerpo) {
    let ast = D.leer('¬(p ∧ q) → (r ∨ ¬p)'), sel = null, recs = [];
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '¬(p ∧ q) → (r ∨ ¬p)', alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; sel = null; lienzo.ajustar(true); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.s6, texto: 'subfórmula elegida (raíz del subárbol)', forma: 'cuadro' },
      { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'el resto del subárbol', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo: el subárbol que cuelga de él es una subfórmula, y su texto aparece abajo. La raíz es el conectivo principal.');

    function dibujar() {
      lienzo.limpiar();
      const sub = sel ? new Set(descendientes(sel)) : new Set();
      recs = D.arbol(lienzo, ast, { relleno: (r) => (sub.has(r.n) ? VIZ.alfa(C.s1, 0.2) : null), borde: (r) => (sub.has(r.n) ? C.s1 : C.tinta2), anillo: (r) => (r.n === sel ? C.s6 : null) });
      const todas = D.subformulas(ast);
      registro.textContent = sel ? `Subfórmula elegida:  ${D.texto(sel)}\nSus partes inmediatas:  ${D.hijos(sel).map((h) => D.texto(h)).join('   |   ') || '(es un átomo)'}` : `Fórmula completa:  ${D.texto(ast)}\nHaga clic en un nodo para aislar una subfórmula.`;
      lectura.set([['conectivo principal', ast.k === 'var' ? '—' : D.etiqueta(ast)], ['nodos', String(D.tam(ast))], ['subfórmulas distintas', String(todas.length)], ['profundidad', String(D.prof(ast))], ['variables', D.vars(ast).join(', ')]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = D.nodoEn(recs, x, y);
      sel = r ? r.n : null;
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: subfórmulas repetidas ---------- */

  function montarCompartidas(cuerpo) {
    let ast = D.leer('(p ∧ q) → ((p ∧ q) ∨ ¬(p ∧ q))');
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '(p ∧ q) → ((p ∧ q) ∨ ¬(p ∧ q))', alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; lienzo.ajustar(true); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ['(p ∧ q) → ((p ∧ q) ∨ ¬(p ∧ q))', 'tres copias de p ∧ q'], ['(p → q) ∧ (q → r) → (p → r)', 'silogismo hipotético'], ['(p ∨ q) ↔ (q ∨ p)', 'conmutatividad'], ['¬(p ∨ q) ↔ (¬p ∧ ¬q)', 'De Morgan']], valor: '', alCambiar: (v) => { if (v) { campo.valor = v; const r = D.analizar(v); ast = r.ast; lienzo.ajustar(true); } } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    VIZ.leyenda(cuerpo, [{ color: C.superficie, borde: C.tinta2, texto: 'subfórmula que aparece una sola vez', forma: 'cuadro' }, { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'cada color: una subfórmula repetida (ver fichas)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos nodos con el mismo color son la misma subfórmula escrita en lugares distintos. Un programa puede guardarla una vez y compartirla (un grafo en vez de un árbol).');

    function dibujar() {
      lienzo.limpiar();
      const cont = new Map();
      descendientes(ast).forEach((n) => { if (D.hijos(n).length) cont.set(D.texto(n), (cont.get(D.texto(n)) || 0) + 1); });
      const rep = [...cont].filter(([, c]) => c > 1).sort((a, b) => a[0].length - b[0].length);
      const color = new Map(rep.map(([t], i) => [t, VIZ.series[i % 8]]));
      D.arbol(lienzo, ast, { relleno: (r) => (color.has(D.texto(r.n)) && D.hijos(r.n).length ? VIZ.alfa(color.get(D.texto(r.n)), 0.3) : null), borde: (r) => (D.hijos(r.n).length && color.get(D.texto(r.n))) || C.tinta2 });
      fichas.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'repetidas:'), ...(rep.length ? rep.map(([t, c]) => VIZ.ficha(`${t}  ×${c}`, { color: color.get(t) })) : [VIZ.el('span', { class: 'fichas-vacio' }, 'ninguna')]));
      const distintas = D.subformulas(ast).length;
      registro.textContent = rep.length ? `Hay ${D.tam(ast)} nodos en el árbol pero solo ${distintas} subfórmulas distintas: compartiendo las repetidas se ahorran ${D.tam(ast) - distintas} nodos.` : 'Todas las subfórmulas con conectivos aparecen una sola vez.';
      lectura.set([['nodos del árbol', String(D.tam(ast))], ['subfórmulas distintas', String(distintas)], ['repetidas', String(rep.length)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('syntax-trees', {
    intro: String.raw`
      <p>Toda fórmula bien formada se lee de una sola manera, y esa lectura se dibuja como un <strong>árbol sintáctico</strong>: los átomos son las hojas, y cada conectivo es un nodo cuyos hijos son sus operandos.
      La raíz es el <em>conectivo principal</em>, el último que se aplica.</p>
      <p>Cada nodo del árbol corresponde a una <strong>subfórmula</strong>: el texto de todo lo que cuelga de él. Ver una fórmula como árbol es lo que permite evaluarla, simplificarla y demostrar cosas sobre ella.</p>`,
    visualizaciones: [
      {
        titulo: 'Árbol sintáctico y subfórmulas',
        descripcion: 'Escriba una fórmula y haga clic en los nodos: cada uno aísla una subfórmula. Compruebe que la raíz es el conectivo que se aplica al final.',
        montar: montarArbol,
      },
      {
        titulo: 'Subfórmulas repetidas',
        descripcion: 'Los nodos del mismo color son la misma subfórmula escrita varias veces. Pruebe los ejemplos y cuente cuántas subfórmulas distintas hay.',
        montar: montarCompartidas,
      },
    ],
    teoria: String.raw`
      <h2>Subfórmulas</h2>
      <p>El conjunto \(\operatorname{Sub}(\varphi)\) se define por recursión estructural:</p>
      \[ \operatorname{Sub}(p) = \{p\}, \quad \operatorname{Sub}(\neg A) = \{\neg A\} \cup \operatorname{Sub}(A), \quad \operatorname{Sub}(A \circ B) = \{A \circ B\} \cup \operatorname{Sub}(A) \cup \operatorname{Sub}(B). \]
      <p>Cada nodo del árbol aporta una subfórmula, pero puede haber menos subfórmulas que nodos, porque un mismo texto puede aparecer varias veces.</p>
      <h2>Cotas</h2>
      \[ |\operatorname{Sub}(\varphi)| \;\le\; \operatorname{tam}(\varphi). \]
      <p>Se prueba por <a href="tema.html?id=structural-induction">inducción estructural</a>.</p>
      <p>Con las subfórmulas compartidas, una fórmula se representa como un grafo dirigido acíclico (<em>DAG</em>); esa representación reduce de exponencial a lineal el tamaño de ciertas fórmulas, y se usa en los verificadores automáticos.</p>
      <h2>Para qué sirve el árbol</h2>
      <ul>
        <li><strong>Evaluar:</strong> se calcula de las hojas hacia la raíz (ver <a href="tema.html?id=truth-tables">tablas de verdad</a>).</li>
        <li><strong>Transformar:</strong> las leyes de equivalencia reescriben subárboles (ver <a href="tema.html?id=logical-equivalence">equivalencia lógica</a>).</li>
        <li><strong>Medir:</strong> tamaño y profundidad (ver <a href="tema.html?id=expression-metrics">métricas</a>).</li>
      </ul>`,
  });
})();
