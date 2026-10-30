(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: tabla de verdad de una fórmula ---------- */

  function montarTabla(cuerpo) {
    let ast = D.leer('(p → q) ∧ (q → r)'), activa = -1;
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '(p → q) ∧ (q → r)', alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; activa = -1; dibujar(); } });
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: V y F se leen directamente';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una valuación (una asignación de V o F a las variables). Las columnas del medio son las subfórmulas, de la más simple a la completa. Haga clic en una fila para leerla.');

    function dibujar() {
      const vars = D.vars(ast);
      if (vars.length > 5) { registro.textContent = 'Use a lo más 5 variables (la tabla tiene 2ⁿ filas).'; return; }
      const subs = D.subformulas(ast).filter((s) => D.hijos(s.a).length);
      const cols = (subs.length ? subs : [{ txt: D.texto(ast), a: ast }]).map((s, i, L) => ({ t: s.txt, f: (v) => D.evalua(s.a, v), fuerte: i === L.length - 1 }));
      const vals = D.valuaciones(vars);
      const res = D.resultados(ast, vars);
      tabla.poner({ vars, cols, vals, activa, alClick: (i) => { activa = i; dibujar(); } });
      const nV = res.filter(Boolean).length;
      registro.textContent = activa >= 0 ? `Con ${D.valTexto(vals[activa], vars)} la fórmula vale ${res[activa] ? 'V' : 'F'}.` : 'Haga clic en una fila para fijar una valuación.';
      lectura.set([['variables', vars.join(', ') || '—'], ['filas (2ⁿ)', String(vals.length)], ['filas verdaderas', String(nV)], ['clasificación', D.clase(res)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: evaluación recursiva sobre el árbol ---------- */

  function montarEvaluacion(cuerpo) {
    let ast = D.leer('(p ∨ ¬q) → (p ∧ r)'), val = { p: true, q: false, r: true }, orden = [], hecho = new Set(), recs = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '(p ∨ ¬q) → (p ∧ r)', alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; for (const v of D.vars(ast)) if (!(v in val)) val[v] = true; lienzo.ajustar(true); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'verdadero (V)', forma: 'cuadro' },
      { color: C.neutro, borde: C.apagado, texto: 'falso (F)', forma: 'cuadro' },
      { color: C.superficie, borde: C.inactivo, texto: 'todavía sin evaluar', forma: 'cuadro' },
      { color: C.superficie, borde: C.s2, texto: 'nodo que se evalúa ahora', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una variable (hoja) para cambiar su valor. La evaluación sube desde las hojas: el valor de un nodo depende solo del de sus hijos.');

    function iniciar() {
      orden = []; hecho = new Set(); k = 0;
      (function post(a) { D.hijos(a).forEach(post); if (D.hijos(a).length) orden.push(a); })(ast);
      return (function* () { for (const a of orden) { hecho.add(a); k++; yield; } })();
    }
    function dibujar() {
      lienzo.limpiar();
      const actual = k ? orden[k - 1] : null;
      const sabe = (n) => D.hijos(n).length === 0 || hecho.has(n);
      recs = D.arbol(lienzo, ast, {
        relleno: (r) => (!sabe(r.n) ? C.superficie : D.evalua(r.n, val) ? VIZ.alfa(C.s1, 0.3) : C.neutro),
        borde: (r) => (r.n === actual ? C.s2 : !sabe(r.n) ? C.inactivo : D.evalua(r.n, val) ? C.s1 : C.apagado),
        anillo: (r) => (r.n === actual ? C.s2 : null),
        nota: (r) => (sabe(r.n) ? (D.evalua(r.n, val) ? 'V' : 'F') : null),
      });
      const vars = D.vars(ast);
      registro.textContent = actual ? `${D.texto(actual)} = ${D.evalua(actual, val) ? 'V' : 'F'}   (${D.hijos(actual).map((h) => D.evalua(h, val) ? 'V' : 'F').join(` ${D.etiqueta(actual)} `) || ''})` : 'Pulse «Un paso»: primero se leen los valores de las variables y luego se sube nodo por nodo.';
      lectura.set([['valuación', D.valTexto(val, vars)], ['nodos evaluados', `${k} de ${orden.length}`], ['valor de la fórmula', hecho.has(ast) || D.hijos(ast).length === 0 ? (D.evalua(ast, val) ? 'V' : 'F') : '—']]);
    }
    lienzo.alDibujar = () => orden.length >= 0 && ast && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = D.nodoEn(recs, x, y);
      if (r && r.n.k === 'var') { val[r.n.n] = !val[r.n.n]; rep.reiniciar(); }
    });
    rep.reiniciar();
  }

  VIZ.registrarTema('truth-tables', {
    intro: String.raw`
      <p>La <strong>semántica</strong> de la lógica proposicional dice qué significa una fórmula. Su significado depende de una <em>valuación</em>: una asignación de verdadero (V) o falso (F) a cada variable.
      Dada la valuación, el valor de cualquier fórmula queda determinado, calculándolo de las hojas hacia la raíz con las tablas de los conectivos.</p>
      <p>Como con \(n\) variables hay \(2^n\) valuaciones, se pueden listar todas: eso es la <strong>tabla de verdad</strong>. Es el método más directo para decidir qué es verdad siempre, a veces o nunca.</p>`,
    visualizaciones: [
      {
        titulo: 'La tabla de verdad',
        descripcion: 'Escriba una fórmula y lea su tabla con una columna por cada subfórmula. Haga clic en una fila para fijar una valuación.',
        montar: montarTabla,
      },
      {
        titulo: 'Evaluación recursiva sobre el árbol',
        descripcion: 'Fije una valuación haciendo clic en las variables y reproduzca la evaluación: cada nodo se calcula cuando ya se conocen sus hijos.',
        montar: montarEvaluacion,
      },
    ],
    teoria: String.raw`
      <h2>Valuaciones y evaluación</h2>
      <p>Una <strong>valuación</strong> es una función \(v : V \to \{0, 1\}\) (1 = verdadero). Se extiende a todas las fórmulas por recursión estructural:</p>
      \[ \begin{aligned}
        \bar v(p) &amp;= v(p), \\
        \bar v(\neg A) &amp;= 1 - \bar v(A), \\
        \bar v(A \land B) &amp;= \min(\bar v(A), \bar v(B)), \qquad \bar v(A \lor B) = \max(\bar v(A), \bar v(B)), \\
        \bar v(A \to B) &amp;= \max(1 - \bar v(A), \bar v(B)), \qquad \bar v(A \leftrightarrow B) = 1 \text{ si } \bar v(A) = \bar v(B).
      \end{aligned} \]
      <p>Que \(\bar v\) esté bien definida usa que la fórmula se lee de una única manera (<a href="tema.html?id=wff">lectura única</a>).</p>
      <h2>Tabla de verdad</h2>
      <p>Para una fórmula con \(n\) variables, la tabla tiene \(2^n\) filas. Es un algoritmo correcto y completo, pero exponencial: con 30 variables tendría más de mil millones de filas.
      Por eso son importantes los métodos que no recorren todas, como <a href="tema.html?id=satisfiability">DPLL</a> y la <a href="tema.html?id=resolution-rule">resolución</a>.</p>
      <h2>Costo de evaluar una valuación</h2>
      <p>Evaluar una sola valuación cuesta \(\Theta(\operatorname{tam}(\varphi))\), una visita por nodo. Calcular toda la tabla cuesta \(\Theta(2^n \cdot \operatorname{tam}(\varphi))\). Las propiedades de las fórmulas según su tabla —tautología, contradicción, contingencia— se ven en
      <a href="tema.html?id=tautologies">Tautologies, Contradictions &amp; Contingencies</a>.</p>`,
  });
})();
