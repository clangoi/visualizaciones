(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.gram;
  const PRESETS = [
    { nombre: 'aⁿbⁿ', txt: 'S -> aSb | ε' },
    { nombre: 'Paréntesis balanceados', txt: 'S -> (S)S | ε' },
    { nombre: 'Expresiones aritméticas', txt: 'E -> E+T | T; T -> T*F | F; F -> (E) | a' },
    { nombre: 'Palíndromos sobre {a, b}', txt: 'S -> aSa | bSb | a | b | ε' },
    { nombre: 'a⁺b⁺', txt: 'S -> AB; A -> aA | a; B -> bB | b' },
  ];
  const leer = (txt) => G.parsear(txt.replace(/;/g, '\n'));

  /* ---------- Fig. 1: derivar paso a paso y ver crecer el árbol ---------- */

  function montarDerivacion(cuerpo) {
    let txt = PRESETS[0].txt, modo = 'izq', semilla = 1, prof = 4, error = null, g = null, arbol = null, pasos = [], k = 0, reveladas = new Set(), nodos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: PRESETS.map((p, i) => [i, p.nombre]), valor: 0, alCambiar: (v) => { txt = PRESETS[+v].txt; campo.valor = txt; semilla++; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'O escriba la suya (reglas separadas por ;)', valor: txt, alCambiar: (v) => { txt = v; semilla++; rep.reiniciar(); }, alEnter: (v) => { txt = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Derivación', opciones: [['izq', 'por la izquierda'], ['der', 'por la derecha']], valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Profundidad máxima', min: 1, max: 7, valor: prof, alCambiar: (v) => { prof = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Otra palabra', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (arbol ? Math.max(170, G.altoArbol(arbol)) : 170) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'variable que se expande en este paso' },
      { color: VIZ.alfa(C.s4, 0.5), borde: C.s4, texto: 'variable pendiente de expandir' },
      { color: C.neutro, borde: C.rejilla, texto: 'terminal (hoja)' },
    ]);
    const forma = VIZ.el('div', { class: 'registro' });
    cuerpo.appendChild(forma);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso reemplaza una variable por el lado derecho de una de sus reglas. «Por la izquierda» elige siempre la variable más a la izquierda; «por la derecha», la más a la derecha. El árbol de derivación es el mismo en ambos casos.');

    function iniciar() {
      const r = leer(txt);
      error = r.error || null; g = r.g || null; arbol = null; pasos = []; k = 0; reveladas = new Set();
      if (g) {
        const rnd = VIZ.semilla(semilla * 97 + 3);
        arbol = G.aleatorio(g, rnd, prof);
        if (!arbol) error = 'La gramática no genera ninguna palabra (el símbolo inicial es improductivo).';
        else { pasos = G.derivacion(g, arbol, modo); reveladas = new Set([arbol]); }
      }
      lienzo.ajustar(true);
      return (function* () { for (let i = 1; i < pasos.length; i++) { k = i; for (const h of pasos[i].nodo.h) reveladas.add(h); yield; } })();
    }
    function dibujar() {
      const { ctx, alto: H } = lienzo;
      lienzo.limpiar();
      if (error) { forma.textContent = ''; ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(error, 12, H / 2); registro.textContent = 'Corrija la gramática.'; lectura.set([['estado', 'error']]); return; }
      const actual = k ? pasos[k].nodo : null, vis = (n) => reveladas.has(n);
      G.dibujarArbol(lienzo, arbol, { visible: vis, estilo: (n) => (n === actual ? { relleno: VIZ.alfa(C.s2, 0.3), borde: C.s2, ancho: 3 } : n.h && !n.h.length ? {} : (n.h && !n.visitado && vis(n) && pasos.slice(k + 1).some((p) => p.nodo === n)) ? { relleno: VIZ.alfa(C.s4, 0.5), borde: C.s4, ancho: 2 } : {}) });
      nodos = G.nodos(arbol).filter(vis);
      forma.textContent = pasos.slice(0, k + 1).map((p) => G.derTexto(p.forma)).join('  ⇒  ');
      const p = pasos[k], regla = p.regla >= 0 ? g.reglas[p.regla] : null;
      registro.textContent = regla ? `Paso ${k}: se usa ${G.reglaTexto(regla)} sobre la variable ${p.nodo.s}.` : `Se parte del símbolo inicial ${g.ini}.`;
      const fin = k === pasos.length - 1;
      lectura.set([['pasos', `${k} de ${pasos.length - 1}`], ['forma sentencial', G.derTexto(p.forma)], ['palabra generada', fin ? (G.fruto(arbol) || 'ε') : '…'], ['nodos del árbol', `${nodos.length} de ${G.tamano(arbol)}`], ['altura final', String(G.altura(arbol))]]);
    }
    lienzo.alDibujar = () => (arbol || error) && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!arbol) return;
      const { x, y } = lienzo.posicion(ev), n = G.nodoEn(arbol, x, y, (q) => reveladas.has(q));
      if (!n || !n.h) return tip.ocultar();
      tip.mostrar(x, y, `<b>${n.s}</b> → ${n.h.map((h) => h.s).join(' ')}<br>deriva «${G.fruto(n) || 'ε'}»`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: palabras del lenguaje y reconocimiento ---------- */

  function montarReconocer(cuerpo) {
    let txt = PRESETS[1].txt, palabra = '(())()', maxL = 6, g = null, error = null, arbol = null, cont = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: PRESETS.map((p, i) => [i, p.nombre]), valor: 1, alCambiar: (v) => { txt = PRESETS[+v].txt; campo.valor = txt; palabra = [['aabb'], ['(())()'], ['a+a*a'], ['abba'], ['aabbb']][+v][0]; cp.valor = palabra; dibujar(); } });
    const campo = ctl.texto({ etiqueta: 'Gramática (reglas separadas por ;)', valor: txt, alCambiar: (v) => { txt = v; dibujar(); }, alEnter: (v) => { txt = v; dibujar(); } });
    const cp = ctl.texto({ etiqueta: 'Palabra a reconocer', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, '').slice(0, 14); dibujar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, '').slice(0, 14); dibujar(); } });
    ctl.rango({ etiqueta: 'Largo máximo al listar', min: 2, max: 8, valor: maxL, alCambiar: (v) => { maxL = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (arbol ? Math.max(120, G.altoArbol(arbol)) : 120) });
    cuerpo.dataset.sinLeyenda = 'árbol de derivación: círculos = variables, cuadros = terminales';
    VIZ.subtitulo(cuerpo, 'Primeras palabras del lenguaje');
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las palabras se obtienen explorando todas las derivaciones por la izquierda; el reconocimiento prueba todas las formas de partir la palabra entre los símbolos de cada regla.');
    function dibujar() {
      const r = leer(txt);
      error = r.error || null; g = r.g || null; arbol = null; cont = 0;
      if (g) { const ts = G.arboles(g, palabra, 3); arbol = ts[0] || null; cont = G.contarArboles(g, palabra); }
      lienzo.ajustar(true);
      lienzo.limpiar();
      if (error) { lista.replaceChildren(); registro.textContent = error; lectura.set([['estado', 'error']]); return; }
      const ws = G.palabras(g, maxL, 40);
      lista.replaceChildren(VIZ.el('div', null, ws.length ? ws.map((w) => w || 'ε').join('   ') : '(ninguna palabra de ese largo)'));
      if (arbol) G.dibujarArbol(lienzo, arbol);
      registro.textContent = arbol ? `«${palabra || 'ε'}» pertenece a L(G): tiene ${cont >= 1e15 ? 'muchísimos' : cont} árbol(es) de derivación${cont > 1 ? ' (la palabra es ambigua en esta gramática)' : ''}. Se muestra el primero.` : `«${palabra || 'ε'}» no pertenece a L(G).`;
      lectura.set([['reglas', String(g.reglas.length)], ['variables', String(G.variables(g).length)], ['terminales', G.terminales(g).join(' ') || '—'], ['árboles para la palabra', String(cont)], ['palabras listadas', String(ws.length)]]);
    }
    lienzo.alDibujar = () => (arbol ? G.dibujarArbol(lienzo, arbol) : null);
    dibujar();
  }

  VIZ.registrarTema('cfg-derivations', {
    intro: String.raw`
      <p>Los autómatas finitos no pueden contar ni anidar: no reconocen \(a^nb^n\) ni los paréntesis balanceados. Las <strong>gramáticas libres de contexto</strong> (GLC) sí. Una gramática es un conjunto de <em>reglas de reescritura</em> «variable → cadena de variables y terminales». Se parte del símbolo inicial y se reemplaza una variable tras otra hasta que solo queden terminales.</p>
      <p>Cada derivación dibuja un <strong>árbol de derivación</strong>: la raíz es el símbolo inicial, los hijos de un nodo son los símbolos del lado derecho de la regla usada, y las hojas, leídas de izquierda a derecha, forman la palabra.</p>`,
    visualizaciones: [
      {
        titulo: 'Derivar y ver crecer el árbol',
        descripcion: 'Elija una gramática (o escriba la suya) y avance: se expande una variable por paso, por la izquierda o por la derecha, y el árbol de derivación aparece nodo a nodo.',
        montar: montarDerivacion,
      },
      {
        titulo: 'Palabras del lenguaje y reconocimiento',
        descripcion: 'Liste las palabras más cortas que genera la gramática y compruebe si una palabra pertenece, con su árbol de derivación y el número de árboles.',
        montar: montarReconocer,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una GLC es \(G = (V, \Sigma, P, S)\): \(V\) variables (no terminales), \(\Sigma\) terminales (con \(V\cap\Sigma = \varnothing\)), \(P \subseteq V \times (V \cup \Sigma)^*\) producciones \(A \to \alpha\) y \(S \in V\) el símbolo inicial. «Libre de contexto» significa que el lado izquierdo es <em>una sola variable</em>: se puede reemplazar sin mirar lo que la rodea.</p>
      <h2>Derivaciones</h2>
      <p>Si \(A \to \beta \in P\), entonces \(\alpha A \gamma \Rightarrow \alpha \beta \gamma\) es un paso de derivación, y \(\Rightarrow^*\) su cierre. El lenguaje generado es</p>
      \[ L(G) = \{ w \in \Sigma^* : S \Rightarrow^* w \}. \]
      <p>Un lenguaje es <strong>libre de contexto</strong> si lo genera alguna GLC; son exactamente los que reconoce un autómata con pila. Una derivación es <strong>por la izquierda</strong> si siempre reemplaza la variable más a la izquierda, y <strong>por la derecha</strong> si reemplaza la más a la derecha.</p>
      <h2>Ejemplo</h2>
      <p>\(S \to aSb \mid \varepsilon\) genera \(\{a^nb^n : n \ge 0\}\): \(S \Rightarrow aSb \Rightarrow aaSbb \Rightarrow aabb\). Y \(S \to (S)S \mid \varepsilon\) genera los paréntesis balanceados.</p>
      <h2>Árboles de derivación</h2>
      <p>Un <strong>árbol de derivación</strong> tiene raíz \(S\); cada nodo interno \(A\) con hijos \(X_1\cdots X_k\) corresponde a una producción \(A \to X_1\cdots X_k\) (o un hijo \(\varepsilon\) para \(A\to\varepsilon\)); las hojas son terminales o \(\varepsilon\). Su <em>fruto</em> es la palabra de las hojas. Hay una correspondencia uno a uno entre árboles y derivaciones por la izquierda (o por la derecha): la elección de <em>orden</em> de expansión no cambia el árbol, solo el de las reglas elegidas.</p>
      <div class="recuadro"><p><strong>Teorema.</strong> \(S \Rightarrow^* w\) si y solo si existe un árbol de derivación con raíz \(S\) y fruto \(w\), si y solo si existe una derivación por la izquierda de \(w\) desde \(S\).</p></div>
      <h2>Qué sigue</h2>
      <p>Una misma palabra puede tener varios árboles: <a href="tema.html?id=grammar-ambiguity">Grammar Ambiguity</a>. Las gramáticas suelen traer símbolos inútiles: <a href="tema.html?id=grammar-simplification">Useless Symbols &amp; Simplification</a>. Y se pueden llevar a una forma estándar: <a href="tema.html?id=chomsky-normal-form">Chomsky Normal Form &amp; CYK</a>.</p>`,
  });
})();
