(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  // Una función de p y q es un número de 4 bits: el bit i vale lo que da en la fila i (VV, VF, FV, FF).
  const OP = {
    not: { s: '¬', f: (a) => ~a & 15, ast: (a) => ({ k: 'not', a }) },
    and: { s: '∧', f: (a, b) => a & b, ast: (a, b) => ({ k: 'and', a, b }) },
    or: { s: '∨', f: (a, b) => a | b, ast: (a, b) => ({ k: 'or', a, b }) },
    imp: { s: '→', f: (a, b) => (~a | b) & 15, ast: (a, b) => ({ k: 'imp', a, b }) },
    iff: { s: '↔', f: (a, b) => ~(a ^ b) & 15, ast: (a, b) => ({ k: 'iff', a, b }) },
    xor: { s: '⊕', f: (a, b) => a ^ b, ast: (a, b) => ({ k: 'xor', a, b }) },
    nand: { s: '↑', f: (a, b) => ~(a & b) & 15, ast: (a, b) => ({ k: 'nand', a, b }) },
    nor: { s: '↓', f: (a, b) => ~(a | b) & 15, ast: (a, b) => ({ k: 'nor', a, b }) },
  };
  const NOMBRE = { 0: '⊥', 15: '⊤', 3: 'p', 5: 'q', 12: '¬p', 10: '¬q', 1: 'p ∧ q', 7: 'p ∨ q', 14: 'p ↑ q', 8: 'p ↓ q', 13: 'p → q', 11: 'q → p', 9: 'p ↔ q', 6: 'p ⊕ q', 2: 'p ∧ ¬q', 4: '¬p ∧ q' };
  const CONJ = {
    na: { n: '{¬, ∧}', ops: ['not', 'and'] },
    no: { n: '{¬, ∨}', ops: ['not', 'or'] },
    ni: { n: '{¬, →}', ops: ['not', 'imp'] },
    nand: { n: '{↑}  (NAND)', ops: ['nand'] },
    nor: { n: '{↓}  (NOR)', ops: ['nor'] },
    ifz: { n: '{→, ⊥}', ops: ['imp'], cons: [0] },
    ox: { n: '{↔, ⊕, ⊤}  (incompleto)', ops: ['iff', 'xor'], cons: [15] },
    ao: { n: '{∧, ∨}  (incompleto)', ops: ['and', 'or'] },
    ay: { n: '{∧, →}  (incompleto)', ops: ['and', 'imp'] },
    xo: { n: '{⊕, ∧}  (incompleto)', ops: ['xor', 'and'] },
    solo: { n: '{¬}  (incompleto)', ops: ['not'] },
    ii: { n: '{↔, ¬}  (incompleto)', ops: ['iff', 'not'] },
  };

  // Funciones alcanzables desde p y q con las operaciones dadas, cada una con una expresión mínima en profundidad.
  function clausura({ ops, cons = [] }) {
    const conoc = new Map([[3, { k: 'var', n: 'p' }], [5, { k: 'var', n: 'q' }]]);
    for (const c of cons) conoc.set(c, { k: 'const', v: c === 15 });
    for (let cambio = true; cambio;) {
      cambio = false;
      const L = [...conoc];
      for (const o of ops) {
        const O = OP[o];
        if (o === 'not') { for (const [m, a] of L) { const r = O.f(m); if (!conoc.has(r)) { conoc.set(r, O.ast(a)); cambio = true; } } continue; }
        for (const [m1, a1] of L) for (const [m2, a2] of L) { const r = O.f(m1, m2); if (!conoc.has(r)) { conoc.set(r, O.ast(a1, a2)); cambio = true; } }
      }
    }
    return conoc;
  }

  /* ---------- Fig. 1: qué funciones se alcanzan ---------- */

  function montarClausura(cuerpo) {
    let clave = 'na', cl = clausura(CONJ.na), geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conectivos disponibles', opciones: Object.entries(CONJ).map(([k, v]) => [k, v.n]), valor: clave, alCambiar: (v) => { clave = v; cl = clausura(CONJ[v]); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(4 * 84, 4 * (w / 4) * 0.7) + 8 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: VIZ.alfa(C.s1, 0.25), borde: C.s1, texto: 'se puede expresar con esos conectivos', forma: 'cuadro' }, { color: C.neutro, borde: C.eje, texto: 'no se puede', forma: 'cuadro' }, { color: C.s1, texto: 'fila de la tabla donde vale V', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada casilla es una de las 16 funciones de dos variables; sus cuatro puntos son las filas VV, VF, FV, FF. Pase el cursor para ver la expresión más corta. Un conjunto completo las alcanza todas.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cw = W / 4, ch = Math.min(84, cw * 0.7);
      geo = { cw, ch };
      for (let m = 0; m < 16; m++) {
        const x = (m % 4) * cw, y = Math.floor(m / 4) * ch + 4, ok = cl.has(m);
        D.caja(ctx, x + 3, y + 3, cw - 6, ch - 6, null, { relleno: ok ? VIZ.alfa(C.s1, 0.25) : C.neutro, borde: ok ? C.s1 : C.eje, radio: 6 });
        D.texto2(ctx, NOMBRE[m], x + cw / 2, y + ch * 0.35, { px: cw < 90 ? 11 : 13, peso: 600, color: ok ? C.tinta : C.apagado });
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(x + cw / 2 + (i - 1.5) * 14, y + ch * 0.7, 4, 0, 7);
          ctx.fillStyle = (m >> i) & 1 ? C.s1 : C.superficie; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = (m >> i) & 1 ? C.s1 : C.eje; ctx.stroke();
        }
      }
      const completo = cl.size === 16;
      registro.textContent = completo ? `Con ${CONJ[clave].n} se obtienen las 16 funciones: el conjunto es funcionalmente completo.` : `Con ${CONJ[clave].n} se obtienen ${cl.size} de 16 funciones: no es completo.`;
      lectura.set([['funciones alcanzables', `${cl.size} de 16`], ['¿completo?', completo ? 'sí' : 'no'], ['faltan', completo ? '—' : [...Array(16).keys()].filter((m) => !cl.has(m)).map((m) => NOMBRE[m]).slice(0, 5).join(', ') + (16 - cl.size > 5 ? '…' : '')]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const m = Math.floor((y - 4) / geo.ch) * 4 + Math.floor(x / geo.cw);
      if (m < 0 || m > 15) return tip.ocultar();
      tip.mostrar(x, y, `<b>${NOMBRE[m]}</b><br>${cl.has(m) ? 'expresión: <b>' + D.texto(cl.get(m)) + '</b>' : 'no se puede expresar'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: construya un conectivo con otros ---------- */

  function montarConstruccion(cuerpo) {
    const completos = ['na', 'no', 'ni', 'nand', 'nor', 'ifz'];
    let clave = 'nand', objetivo = 13, ast = null, cl = clausura(CONJ.nand);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Solo se permite usar', opciones: completos.map((k) => [k, CONJ[k].n]), valor: clave, alCambiar: (v) => { clave = v; cl = clausura(CONJ[v]); construir(); } });
    ctl.selector({ etiqueta: 'Función que se quiere construir', opciones: Object.keys(NOMBRE).map(Number).sort((a, b) => a - b).map((m) => [m, NOMBRE[m]]), valor: objetivo, alCambiar: (v) => { objetivo = +v; construir(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (ast ? D.altoArbol(ast) : 100) });
    cuerpo.dataset.sinLeyenda = 'solo se dibuja el árbol de la construcción';
    const tabla = D.tabla(cuerpo);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'La construcción más corta (en profundidad) con esos conectivos. La tabla comprueba que la expresión construida y la función pedida coinciden en las cuatro filas.');

    function construir() {
      ast = cl.get(objetivo) || null;
      lienzo.ajustar(true);
      const vars = ['p', 'q'];
      if (ast) tabla.poner({ vars, cols: [{ t: D.texto(ast), f: (v) => D.evalua(ast, v) }, { t: NOMBRE[objetivo], f: (v) => (objetivo >> D.valuaciones(vars).findIndex((w) => w.p === v.p && w.q === v.q)) & 1, fuerte: true }] });
      registro.textContent = `${NOMBRE[objetivo]}  ≡  ${D.texto(ast)}`;
    }
    function dibujar() { lienzo.limpiar(); if (ast) D.arbol(lienzo, ast, { borde: () => C.tinta2 }); }
    lienzo.alDibujar = () => dibujar();
    construir();
  }

  VIZ.registrarTema('functional-completeness', {
    intro: String.raw`
      <p>Hay \(2^{2^n}\) funciones booleanas de \(n\) variables: 16 con dos variables, 256 con tres. Los conectivos \(\neg,\land,\lor,\to,\leftrightarrow\) son solo una elección entre muchas posibles.
      Un conjunto de conectivos es <strong>funcionalmente completo</strong> si con él se puede expresar <em>cualquier</em> función booleana.</p>
      <p>Sorprende cuán poco hace falta: \(\{\neg, \land\}\), \(\{\neg, \to\}\) e incluso un solo conectivo, NAND, bastan. En electrónica por eso todo circuito digital puede construirse con compuertas NAND.</p>`,
    visualizaciones: [
      {
        titulo: 'Qué funciones se pueden expresar',
        descripcion: 'Elija un conjunto de conectivos y mire cuántas de las 16 funciones de dos variables alcanza. Compare conjuntos completos con otros como \\(\\{\\land, \\lor\\}\\).',
        montar: montarClausura,
      },
      {
        titulo: 'Construya un conectivo con otros',
        descripcion: 'Elija la función que quiere y los únicos conectivos permitidos. Vea el árbol de la construcción y compruebe en la tabla que coincide.',
        montar: montarConstruccion,
      },
    ],
    teoria: String.raw`
      <h2>Completitud funcional</h2>
      <p>Todo función booleana \(f : \{0,1\}^n \to \{0,1\}\) se escribe como una disyunción de conjunciones de literales (forma normal disyuntiva, ver <a href="tema.html?id=truth-table-normal-forms">normal forms from truth tables</a>): se toma un término por cada fila donde vale 1.
      Por eso \(\{\neg, \land, \lor\}\) es completo. Los demás conjuntos se prueban completos <em>expresando</em> \(\neg\), \(\land\), \(\lor\) con ellos.</p>
      <h2>Con un solo conectivo</h2>
      \[ \neg A \equiv A \uparrow A, \qquad A \land B \equiv (A \uparrow B) \uparrow (A \uparrow B), \qquad A \lor B \equiv (A \uparrow A) \uparrow (B \uparrow B). \]
      <p>Lo mismo vale con NOR (\(\downarrow\)). Son los únicos conectivos binarios completos por sí solos.</p>
      <h2>Conjuntos incompletos</h2>
      <p>Para mostrar que un conjunto no es completo se busca una propiedad que conserven todos sus conectivos y que algún otro no cumpla. Con \(\{\land, \lor\}\), toda fórmula vale 1 cuando todas las variables valen 1 (preserva \(\top\)), así que no se puede expresar \(\neg p\).
      Con \(\{\leftrightarrow, \neg\}\) toda función expresable es afín (lineal módulo 2 más una constante), y \(p \land q\) no lo es.</p>
      <h2>Teorema de Post</h2>
      <p>Un conjunto de funciones es completo si y solo si, para cada una de cinco clases —las que preservan 0, las que preservan 1, las monótonas, las autoduales y las afines— contiene alguna función que no pertenece a esa clase.
      Las leyes de reescritura de <a href="tema.html?id=logical-equivalence">equivalencia lógica</a> son las que se usan para pasar entre conjuntos.</p>`,
  });
})();
