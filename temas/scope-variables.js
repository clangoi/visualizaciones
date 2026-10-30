(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: alcance de los cuantificadores ---------- */

  function montarAlcance(cuerpo) {
    const INI = '∀x (P(x) → ∃y R(x,y)) ∧ Q(y)';
    let ast = D.leer(INI);
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: INI, simbolos: ['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')'], alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], [INI, 'una variable libre y otra ligada'], ['∀x P(x) ∧ Q(x)', 'el alcance es solo P(x)'], ['∀x (P(x) ∧ Q(x))', 'el alcance incluye a Q(x)'], ['∃x P(x) → P(x)', 'x ligada y x libre a la vez'], ['∀x ∃y R(x,y)', 'sentencia (sin variables libres)'], ['∀x (P(x) → ∀x Q(x))', 'cuantificador que repite la variable']], valor: '', alCambiar: (v) => { if (v) { campo.valor = v; ast = D.leer(v); dibujar(); } } });
    const sal = VIZ.el('div', { class: 'formula-viz' });
    cuerpo.appendChild(sal);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El fondo de color marca el alcance de cada cuantificador. Una variable en negrita está ligada por el cuantificador de su color; una variable roja y subrayada es libre: no la liga ninguno.');

    function dibujar() {
      const tk = D.tokens(ast), col = (q) => VIZ.series[(q - 1) % 8];
      sal.replaceChildren(...tk.map((t) => {
        const fondo = t.amb.length ? VIZ.alfa(col(t.amb[t.amb.length - 1]), 0.18) : null;
        const clase = t.tipo === 'libre' ? 'tok libre' : t.tipo === 'lig' || t.tipo === 'cuant' ? 'tok lig' : 'tok';
        return VIZ.el('span', { class: clase, style: { background: fondo, color: t.tipo === 'lig' || t.tipo === 'cuant' ? col(t.q) : null } }, t.t);
      }));
      const cuantif = tk.filter((t) => t.tipo === 'cuant');
      fichas.replaceChildren(...cuantif.map((t) => VIZ.ficha(`${t.t}${tk.find((x) => x.ligadura && x.q === t.q).t}: alcance coloreado`, { color: col(t.q), fondo: VIZ.alfa(col(t.q), 0.18) })), ...(D.libres(ast).length ? [VIZ.ficha(`libre: ${D.libres(ast).join(', ')}`, { color: C.s8, tinta: C.s8 })] : []));
      const libres = D.libres(ast), ligadas = [...new Set(tk.filter((t) => t.tipo === 'lig' && !t.ligadura).map((t) => t.t))];
      const repetidas = cuantif.length !== new Set(tk.filter((t) => t.ligadura).map((t) => t.t)).size;
      registro.textContent = libres.length ? `Variables libres: ${libres.join(', ')}. La fórmula es abierta: su valor depende de qué elementos se asignen a ${libres.join(' y ')}.`
        : 'No tiene variables libres: es una sentencia (cerrada), verdadera o falsa en cada interpretación.' + (repetidas ? '\nUna variable se cuantifica dos veces: la interna oculta a la externa.' : '');
      lectura.set([['cuantificadores', String(cuantif.length)], ['variables libres', libres.join(', ') || 'ninguna'], ['variables ligadas', ligadas.join(', ') || 'ninguna'], ['¿sentencia?', libres.length ? 'no (abierta)' : 'sí (cerrada)']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: satisfacción con una asignación ---------- */

  const MODELO = { n: 4, rel: { P: { ar: 1, d: [true, false, true, false] }, Q: { ar: 1, d: [false, true, true, false] }, R: D.relacion(4, 2, (i, j) => (j === (i + 1) % 4) || (i === 2 && j === 2)) } };

  function montarSatisfaccion(cuerpo) {
    let ast = D.leer('∀y (R(x,y) → ∃z R(y,z))'), asig = { x: 0, y: 0, z: 0 };
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { etiqueta: 'Fórmula (variables libres x, y)', valor: '∀y (R(x,y) → ∃z R(y,z))', simbolos: ['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')'], alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; lienzo.ajustar(true); } });
    const opciones = Array.from({ length: 4 }, (_, i) => [i, D.nombreElem(i)]);
    ctl.selector({ etiqueta: 'Asignación de x', opciones, valor: 0, alCambiar: (v) => { asig.x = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Asignación de y', opciones, valor: 0, alCambiar: (v) => { asig.y = +v; dibujar(); } });
    const lm = VIZ.lienzo(cuerpo, { altoFn: () => D.altoModelo(MODELO) + 10 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'verdadera con la asignación', forma: 'cuadro' },
      { color: C.neutro, borde: C.apagado, texto: 'falsa', forma: 'cuadro' },
      { color: C.superficie, borde: C.inactivo, texto: '… depende de una variable ligada más arriba', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, la interpretación fija (4 elementos). El árbol muestra el valor de cada subfórmula bajo la asignación elegida; las que dependen de una variable ligada por un cuantificador no tienen valor aislado.');

    function dibujar() {
      lm.limpiar(); lm.ctx.save(); lm.ctx.translate(0, 4); D.dibujarModelo(lm, MODELO); lm.ctx.restore();
      lienzo.limpiar();
      const libres = D.libres(ast), a = {};
      for (const v of libres) a[v] = asig[v] ?? 0;
      const valorDe = (n) => (D.libres(n).every((v) => v in a) ? D.evaluaP(n, MODELO, a) : null);
      D.arbol(lienzo, ast, {
        relleno: (r) => { const v = valorDe(r.n); return v === null ? C.superficie : v ? VIZ.alfa(C.s1, 0.3) : C.neutro; },
        borde: (r) => { const v = valorDe(r.n); return v === null ? C.inactivo : v ? C.s1 : C.apagado; },
        nota: (r) => { const v = valorDe(r.n); return v === null ? '…' : v ? 'V' : 'F'; },
      });
      const v = D.evaluaP(ast, MODELO, a);
      registro.textContent = `Asignación: ${libres.length ? libres.map((x) => `${x} ↦ ${D.nombreElem(a[x])}`).join(', ') : '(no hace falta)'}\n` + `La fórmula es ${v ? 'verdadera' : 'falsa'} bajo esta asignación${libres.length ? '' : ' (es una sentencia: no depende de ninguna)'}.`;
      let ok = 0, tot = 0;
      if (libres.length <= 2) {
        const base = libres.length === 0 ? [{}] : libres.length === 1 ? [0, 1, 2, 3].map((i) => ({ [libres[0]]: i })) : [0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3].map((j) => ({ [libres[0]]: i, [libres[1]]: j })));
        base.forEach((b) => { tot++; if (D.evaluaP(ast, MODELO, b)) ok++; });
      }
      lectura.set([['variables libres', libres.join(', ') || 'ninguna'], ['valor', v ? 'V' : 'F'], ['asignaciones que la satisfacen', tot ? `${ok} de ${tot}` : '—']]);
    }
    lm.alDibujar = dibujar; lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('scope-variables', {
    intro: String.raw`
      <p>Un cuantificador no actúa sobre toda la fórmula, sino sobre una parte: su <strong>alcance</strong>. Las apariciones de una variable dentro del alcance de un cuantificador sobre esa misma variable están <strong>ligadas</strong>; las demás son <strong>libres</strong>.</p>
      <p>Una fórmula con variables libres no es verdadera ni falsa por sí misma: depende de qué elemento se asigne a cada una. Una fórmula sin variables libres es una <strong>sentencia</strong>, y es la que realmente tiene un valor en cada interpretación.</p>`,
    visualizaciones: [
      {
        titulo: 'El alcance de cada cuantificador',
        descripcion: 'Escriba fórmulas con varios cuantificadores y vea el fondo de cada alcance. Pruebe \\(\\forall x\\, P(x) \\land Q(x)\\) con y sin paréntesis, y una variable que aparece libre y ligada a la vez.',
        montar: montarAlcance,
      },
      {
        titulo: 'Satisfacción bajo una asignación',
        descripcion: 'Elija una asignación para las variables libres y siga el valor de cada subfórmula en un árbol, sobre una interpretación fija.',
        montar: montarSatisfaccion,
      },
    ],
    teoria: String.raw`
      <h2>Variables libres y ligadas</h2>
      <p>Por recursión estructural, el conjunto \(\operatorname{FV}(\varphi)\) de variables libres es:</p>
      \[ \operatorname{FV}(P(t_1,\dots,t_k)) = \{t_i \text{ que son variables}\}, \quad \operatorname{FV}(\neg A) = \operatorname{FV}(A), \quad \operatorname{FV}(A \circ B) = \operatorname{FV}(A) \cup \operatorname{FV}(B), \quad \operatorname{FV}(\forall x\,A) = \operatorname{FV}(A) \setminus \{x\}. \]
      <p>Una fórmula con \(\operatorname{FV}(\varphi) = \varnothing\) es una <em>sentencia</em>.</p>
      <h2>Convención de alcance</h2>
      <p>Aquí, \(\forall\) y \(\exists\) ligan tan fuerte como \(\neg\): «\(\forall x\,P(x) \land Q(x)\)» es \((\forall x\,P(x)) \land Q(x)\), y la \(x\) de \(Q\) queda libre. Para ampliar el alcance se usan paréntesis: \(\forall x\,(P(x) \land Q(x))\).</p>
      <h2>Satisfacción (Tarski)</h2>
      <p>Dada una interpretación \(\mathcal{I}\) y una asignación \(s\) de elementos a variables, \(\mathcal{I}, s \models \varphi\) se define por recursión:</p>
      \[ \mathcal{I}, s \models \forall x\,A \iff \mathcal{I}, s[x \mapsto d] \models A \text{ para todo } d, \qquad \mathcal{I}, s \models P(x) \iff s(x) \in P^{\mathcal{I}}. \]
      <p>Para una sentencia, el resultado no depende de \(s\): basta decir \(\mathcal{I} \models \varphi\).</p>
      <h2>Sustitución y captura</h2>
      <p>Al sustituir una variable por un término hay que cuidar que el término no quede <em>capturado</em>: en \(\exists y\,R(x,y)\), reemplazar \(x\) por \(y\) daría \(\exists y\,R(y,y)\), que dice otra cosa. Se resuelve renombrando la variable ligada (\(\alpha\)-conversión): \(\exists z\,R(y,z)\).
      La interpretación de estos símbolos es la de <a href="tema.html?id=predicates-domains">Predicates, Domains &amp; Interpretations</a>.</p>`,
  });
})();
