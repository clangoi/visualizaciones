(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.gram;
  const AMBIGUA = G.parsear('E -> E+E | E*E | (E) | a').g;
  const PRECEDENCIA = G.parsear('E -> E+T | T\nT -> T*F | F\nF -> (E) | a').g;
  const IZQUIERDA = G.parsear('E -> E+a | a').g;
  const GRAMATICAS = {
    amb: { nombre: 'Ambigua: E → E+E | E*E | (E) | a', g: AMBIGUA },
    prec: { nombre: 'Con precedencia: E → E+T | T, T → T*F | F, F → (E) | a', g: PRECEDENCIA },
  };
  const EJEMPLOS = ['a+a*a', 'a*a+a', 'a+a+a', 'a+a*a+a', '(a+a)*a'];

  /* ---------- Fig. 1: ver los árboles de una palabra ---------- */

  function montarArboles(cuerpo) {
    let gk = 'amb', palabra = 'a+a*a', idx = 0, arboles = [], total = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: Object.entries(GRAMATICAS).map(([k, v]) => [k, v.nombre]), valor: gk, alCambiar: (v) => { gk = v; idx = 0; recomputar(); } });
    const cp = ctl.texto({ etiqueta: 'Expresión (a, +, *, paréntesis)', valor: palabra, alCambiar: (v) => { palabra = v.replace(/[^a+*()]/g, '').slice(0, 13); idx = 0; recomputar(); }, alEnter: (v) => { palabra = v.replace(/[^a+*()]/g, '').slice(0, 13); idx = 0; recomputar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { palabra = v; cp.valor = v; idx = 0; recomputar(); } } });
    const sel = ctl.rango({ etiqueta: 'Árbol número', min: 1, max: 1, valor: 1, alCambiar: (v) => { idx = v - 1; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (arboles[idx] ? Math.max(170, G.altoArbol(arboles[idx])) : 150) });
    cuerpo.dataset.sinLeyenda = 'árbol de derivación: círculos = variables, cuadros = terminales';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con a = 2, el valor de la expresión depende del árbol: la gramática ambigua permite agrupar a+a*a como (a+a)*a o como a+(a*a). Una buena gramática de expresiones asigna un único árbol a cada palabra.');
    function recomputar() {
      const g = GRAMATICAS[gk].g;
      arboles = G.arboles(g, palabra, 30); total = G.contarArboles(g, palabra);
      sel.input.max = Math.max(1, arboles.length); sel.valor = 1; idx = 0;
      lienzo.ajustar(true); dibujar();
    }
    function dibujar() {
      lienzo.limpiar();
      const t = arboles[idx];
      if (t) G.dibujarArbol(lienzo, t);
      const vals = [...new Set(arboles.map((x) => G.evaluar(x)))];
      registro.textContent = !t ? `«${palabra}» no pertenece al lenguaje de esta gramática.` : total > 1 ? `Árbol ${idx + 1} de ${total}: su valor es ${G.evaluar(t)}. La palabra es AMBIGUA: hay ${total} formas distintas de agruparla${vals.length > 1 ? `, con valores distintos (${vals.join(', ')})` : ''}.` : `Único árbol de derivación: valor ${G.evaluar(t)}.`;
      lectura.set([['árboles de derivación', total >= 1e15 ? 'muchísimos' : String(total)], ['árbol mostrado', t ? `${idx + 1}` : '—'], ['valor (a = 2)', t ? String(G.evaluar(t)) : '—'], ['valores distintos', t ? String(vals.length) : '—'], ['¿ambigua para esta palabra?', total > 1 ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = () => arboles && dibujar();
    recomputar();
  }

  /* ---------- Fig. 2: el número de árboles crece como los números de Catalan ---------- */

  function montarCatalan(cuerpo) {
    let modo = 'suma', datos = [], plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Expresiones', opciones: [['suma', 'a+a+…+a (solo sumas)'], ['mixta', 'a+a*a+a*… (operadores alternados)']], valor: modo, alCambiar: (v) => { modo = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'gramática ambigua E → E+E | E*E | (E) | a', forma: 'linea' },
      { color: C.s1, texto: 'gramática con precedencia (E → E+T …)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con n operandos hay Cₙ₋₁ maneras de poner los paréntesis (números de Catalan: 1, 1, 2, 5, 14, 42, …). La gramática con precedencia fija una sola.');
    function palabraDe(n) { return Array.from({ length: n }, (_, i) => 'a' + (i < n - 1 ? (modo === 'suma' || i % 2 === 0 ? '+' : '*') : '')).join(''); }
    function calcular() {
      datos = [];
      for (let n = 1; n <= 10; n++) { const w = palabraDe(n); datos.push({ n, amb: G.contarArboles(AMBIGUA, w), prec: G.contarArboles(PRECEDENCIA, w), w }); }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 10, ymin: 1, ymax: 1e5 }, { logY: true, etiquetaX: 'n (operandos)', etiquetaY: 'árboles de derivación', ticksX: Array.from({ length: 10 }, (_, i) => i + 1) });
      plano.ejes();
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.prec]), C.s1, 2);
      VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d.amb]), C.s2, 2);
      for (const d of datos) { VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d.amb), C.s2, d.n === hover ? 5 : 3); VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d.prec), C.s1, d.n === hover ? 5 : 3); }
      const d = datos[(hover || 10) - 1];
      lectura.set([['operandos n', String(d.n)], ['expresión', d.w], ['árboles (ambigua)', VIZ.entero(d.amb)], ['árboles (con precedencia)', String(d.prec)]]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(10, Math.round(plano.ix(x))));
      dibujar();
      const d = datos[hover - 1];
      tip.mostrar(x, y, `n = <b>${hover}</b><br>${d.w}` + VIZ.filaTooltip(C.s2, 'ambigua', VIZ.entero(d.amb)) + VIZ.filaTooltip(C.s1, 'con precedencia', d.prec));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('grammar-ambiguity', {
    intro: String.raw`
      <p>Una gramática es <strong>ambigua</strong> si alguna palabra tiene dos o más árboles de derivación distintos. Para un lenguaje de programación es un defecto grave: cada árbol es una interpretación distinta, y el compilador no sabría si \(2+2\cdot 2\) vale 6 o 8.</p>
      <p>La ambigüedad es una propiedad de la <em>gramática</em>, no del lenguaje: casi siempre se puede reescribir la gramática de modo que cada palabra tenga un único árbol (por ejemplo, codificando la precedencia de los operadores). Hay, sin embargo, lenguajes <em>inherentemente ambiguos</em>.</p>`,
    visualizaciones: [
      {
        titulo: 'Los árboles de una misma expresión',
        descripcion: 'Escriba una expresión y recorra sus árboles de derivación con el deslizador: con la gramática ambigua a+a*a tiene dos, con valores 6 y 8; con la de precedencia, uno.',
        montar: montarArboles,
      },
      {
        titulo: 'Cuántos árboles hay',
        descripcion: 'Para n operandos la gramática ambigua tiene tantos árboles como números de Catalan, que crecen exponencialmente; la gramática con precedencia, uno solo.',
        montar: montarCatalan,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una GLC \(G\) es <strong>ambigua</strong> si existe \(w \in L(G)\) con dos árboles de derivación distintos, o equivalentemente con dos derivaciones por la izquierda (o por la derecha) distintas. Se dice que \(w\) es ambigua en \(G\). No basta con que haya dos derivaciones: derivar por la izquierda o por la derecha el mismo árbol no es ambigüedad.</p>
      <h2>Ejemplo: expresiones</h2>
      \[ E \to E + E \mid E * E \mid (E) \mid a. \]
      <p>La palabra \(a + a * a\) tiene dos árboles: \(E + (E * E)\) y \((E + E) * E\), con valores distintos. Para eliminar la ambigüedad se introducen <em>niveles</em> que codifican la precedencia (el producto liga más fuerte que la suma) y la asociatividad (a izquierda):</p>
      \[ E \to E + T \mid T, \qquad T \to T * F \mid F, \qquad F \to (E) \mid a. \]
      <p>Aquí \(*\) solo puede aparecer más profundo que \(+\), y la recursión por la izquierda fuerza la asociatividad a izquierda.</p>
      <h2>Cuántos árboles</h2>
      <p>Con una sola operación binaria, el número de árboles de \(a \oplus a \oplus \cdots \oplus a\) con \(n\) operandos es el número de Catalan</p>
      \[ C_{n-1} = \frac{1}{n}\binom{2n-2}{n-1} \sim \frac{4^{n}}{n^{3/2}\sqrt{\pi}}. \]
      <h2>Otros casos clásicos</h2>
      <ul>
        <li><strong>El «else» colgante.</strong> \(S \to \text{if } E \text{ then } S \mid \text{if } E \text{ then } S \text{ else } S \mid \dots\) hace ambigua a \(\text{if } a \text{ then if } b \text{ then } s_1 \text{ else } s_2\). Se resuelve emparejando cada \(\text{else}\) con el \(\text{if}\) más cercano.</li>
        <li><strong>Ambigüedad inherente.</strong> \(\{a^ib^jc^k : i = j \text{ o } j = k\}\) es libre de contexto, pero toda gramática que lo genera es ambigua.</li>
      </ul>
      <h2>Decidibilidad</h2>
      <div class="recuadro"><p>No existe un algoritmo que decida si una GLC arbitraria es ambigua (el problema es indecidible, por reducción desde el problema de correspondencia de Post). Sí se puede decidir para una palabra concreta, contando sus árboles, y existen condiciones suficientes (LL(1), LR(1)) que garantizan ausencia de ambigüedad.</p></div>
      <p>Para trabajar con una gramática hay que simplificarla primero (<a href="tema.html?id=grammar-simplification">Useless Symbols &amp; Simplification</a>); las formas normales (<a href="tema.html?id=chomsky-normal-form">Chomsky</a>) no eliminan la ambigüedad.</p>`,
  });
})();
