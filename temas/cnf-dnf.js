(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: transformación paso a paso ---------- */

  function montarPasos(cuerpo) {
    let ast = D.leer('(p ↔ q) → ¬(r ∧ s)'), tipo = 'cnf', pasos = [], k = 0, error = '';
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '(p ↔ q) → ¬(r ∧ s)', alCambiar: (r) => { if (r.error) { error = D.mensaje(campo.valor, r); registro.textContent = error; return; } error = ''; ast = r.ast; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Forma normal', opciones: [['cnf', 'CNF (conjunción de cláusulas)'], ['dnf', 'DNF (disyunción de términos)']], valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5, velMax: 4 });
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso aplica una familia de leyes y se comprueba con una tabla de verdad que la fórmula sigue siendo equivalente a la original.');

    function iniciar() {
      pasos = D.pasosNormal(ast, tipo);
      k = 0;
      return (function* () { for (k = 1; k < pasos.length; k++) yield; k = pasos.length - 1; })();
    }
    function dibujar() {
      if (error) { registro.textContent = error; return; }
      const vars = D.vars(ast), ok = vars.length <= 8;
      const lineas = pasos.slice(0, k + 1).map((p, i) => {
        const eq = !ok ? '' : D.equivalentes(ast, p.ast) ? '  ✓ equivalente' : '  ✗ ¡no equivalente!';
        return `${i}. ${p.nombre}${i ? eq : ''}\n   ${D.texto(p.ast)}`;
      });
      if (k === pasos.length - 1) {
        const g = D.forma(ast, tipo);
        lineas.push(`\nComo conjunto de ${tipo === 'cnf' ? 'cláusulas' : 'términos'} (sin repetidos ni absorbidos):\n   ${g.length ? g.map(D.clTxt).join(', ') : tipo === 'cnf' ? '∅  (la fórmula es una tautología)' : '∅  (la fórmula es insatisfacible)'}`);
      }
      registro.textContent = lineas.join('\n');
      const final = D.forma(ast, tipo);
      lectura.set([['paso', `${k} de ${pasos.length - 1}`], ['tamaño de la fórmula actual', String(D.tam(pasos[k].ast))], [tipo === 'cnf' ? 'cláusulas finales' : 'términos finales', String(final.length)], ['literales finales', String(final.reduce((s, c) => s + c.length, 0))]]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la explosión de tamaño ---------- */

  const FAM = {
    dnf: { nombre: '(x₁ ∧ y₁) ∨ … ∨ (xₙ ∧ yₙ)  — compacta en DNF', build: (n, o, i) => Array.from({ length: n }, (_, j) => ({ k: i, a: { k: 'var', n: 'x' + j }, b: { k: 'var', n: 'y' + j } })).reduce((s, t) => ({ k: o, a: s, b: t })) },
    cnf: { nombre: '(x₁ ∨ y₁) ∧ … ∧ (xₙ ∨ yₙ)  — compacta en CNF', build: (n, o, i) => Array.from({ length: n }, (_, j) => ({ k: i, a: { k: 'var', n: 'x' + j }, b: { k: 'var', n: 'y' + j } })).reduce((s, t) => ({ k: o, a: s, b: t })) },
  };
  const memo = {};
  function serie(clave) {
    if (memo[clave]) return memo[clave];
    const [o, i] = clave === 'dnf' ? ['or', 'and'] : ['and', 'or'];
    return (memo[clave] = Array.from({ length: 10 }, (_, q) => {
      const a = FAM[clave].build(q + 1, o, i);
      return { n: q + 1, tam: D.tam(a), cnf: D.forma(a, 'cnf').length, dnf: D.forma(a, 'dnf').length };
    }));
  }

  function montarExplosion(cuerpo) {
    let clave = 'dnf', n = 6, pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Familia de fórmulas', opciones: Object.entries(FAM).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'n (pares de variables)', min: 1, max: 10, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tamaño de la fórmula original (nodos)', forma: 'linea' }, { color: C.s2, texto: 'cláusulas de su CNF', forma: 'linea' }, { color: C.s3, texto: 'términos de su DNF', forma: 'linea' }, { color: C.apagado, texto: '2ⁿ', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una fórmula pequeña puede tener una forma normal exponencialmente grande: pasar de ∨ de ∧ a ∧ de ∨ obliga a elegir un literal de cada término. Sin embargo, la forma normal contraria es del mismo tamaño.');

    function dibujar() {
      const S = serie(clave), { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 10, ymin: 1, ymax: 2000 }, { logY: true, etiquetaX: 'n', etiquetaY: 'tamaño', ticksX: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], formatoX: (v) => String(v) });
      pl.ejes();
      VIZ.trazar(ctx, pl, S.map((o) => [o.n, 2 ** o.n]), C.apagado, 1.5, [3, 4]);
      for (const [k, c] of [['tam', C.s1], ['cnf', C.s2], ['dnf', C.s3]]) {
        VIZ.trazar(ctx, pl, S.map((o) => [o.n, Math.max(1, o[k])]), c, 2);
        S.forEach((o) => VIZ.marcador(ctx, pl.sx(o.n), pl.sy(Math.max(1, o[k])), c, o.n === (hover > 0 ? hover : n) ? 5 : 3));
      }
      const o = S[(hover > 0 ? hover : n) - 1];
      lectura.set([['n', String(o.n)], ['tamaño original', String(o.tam)], ['cláusulas en CNF', VIZ.entero(o.cnf)], ['términos en DNF', VIZ.entero(o.dnf)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover > 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      hover = Math.max(1, Math.min(10, Math.round(pl.ix(x))));
      dibujar();
      const o = serie(clave)[hover - 1];
      tip.mostrar(x, y, `n = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'tamaño original', o.tam) + VIZ.filaTooltip(C.s2, 'cláusulas CNF', VIZ.entero(o.cnf)) + VIZ.filaTooltip(C.s3, 'términos DNF', VIZ.entero(o.dnf)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('cnf-dnf', {
    intro: String.raw`
      <p>Toda fórmula es equivalente a otra de forma muy regular. En la <strong>forma normal conjuntiva</strong> (CNF) es una conjunción de cláusulas (\(\land\) de \(\lor\) de literales); en la <strong>disyuntiva</strong> (DNF), una disyunción de términos
      (\(\lor\) de \(\land\) de literales).</p>
      <p>La transformación es mecánica: eliminar los conectivos derivados, llevar las negaciones hasta las variables con De Morgan y distribuir. Es el primer paso de casi todos los demostradores automáticos,
      aunque tiene un costo: puede hacer crecer la fórmula exponencialmente.</p>`,
    visualizaciones: [
      {
        titulo: 'Transforme paso a paso',
        descripcion: 'Escriba una fórmula y reproduzca la conversión. Cada paso se verifica con una tabla de verdad. Pruebe la DNF y compare.',
        montar: montarPasos,
      },
      {
        titulo: 'La explosión de tamaño',
        descripcion: 'Con \\(n\\) pares de variables, una fórmula de tamaño lineal necesita \\(2^n\\) cláusulas en una de las dos formas. Cambie la familia y vea la asimetría.',
        montar: montarExplosion,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <ol>
        <li>Eliminar \(\leftrightarrow\): \(A \leftrightarrow B \equiv (A \to B) \land (B \to A)\).</li>
        <li>Eliminar \(\to\): \(A \to B \equiv \neg A \lor B\).</li>
        <li>Pasar a forma normal negativa (NNF): De Morgan y doble negación hasta que \(\neg\) solo afecte a variables.</li>
        <li>Distribuir: \(A \lor (B \land C) \equiv (A \lor B) \land (A \lor C)\) para CNF (o \(\land\) sobre \(\lor\) para DNF).</li>
        <li>Simplificar: quitar cláusulas con \(p\) y \(\neg p\) (son tautologías) y literales repetidos.</li>
      </ol>
      <p>Cada paso es una <a href="tema.html?id=logical-equivalence">equivalencia lógica</a>, de modo que el resultado es equivalente a la fórmula original.</p>
      <h2>El costo de distribuir</h2>
      <p>La fórmula \(\bigvee_{i=1}^{n}(x_i \land y_i)\) tiene \(3n-1\) nodos, pero su CNF necesita una cláusula por cada manera de elegir \(x_i\) o \(y_i\) en cada término: \(2^n\) cláusulas. Pasa algo análogo con
      \(\bigwedge_i (x_i \lor y_i)\) en DNF. No es un defecto del algoritmo: se puede demostrar que cualquier CNF equivalente tiene ese tamaño.</p>
      <h2>Transformación de Tseitin</h2>
      <p>Si basta con <em>equisatisfacibilidad</em> (no equivalencia), se introduce una variable nueva por cada subfórmula y se escriben sus definiciones como cláusulas. El resultado tiene tamaño lineal y es satisfacible si y solo si la fórmula original lo es;
      es lo que usan en la práctica los solucionadores SAT (<a href="tema.html?id=satisfiability">Satisfiability</a>).</p>
      <h2>Unicidad</h2>
      <p>La CNF no es única: existen la <em>canónica</em> (una cláusula por cada fila falsa de la tabla de verdad) y formas mínimas (ver <a href="tema.html?id=truth-table-normal-forms">Normal Forms from Truth Tables</a>).</p>`,
  });
})();
