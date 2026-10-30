(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: el comportamiento de cada conectivo ---------- */

  const CON = {
    not: { s: '¬', nombre: 'negación', un: true, f: (p) => !p, frase: (P) => `No ${P}` },
    and: { s: '∧', nombre: 'conjunción', f: (p, q) => p && q, frase: (P, Q) => `${P} y ${Q}` },
    or: { s: '∨', nombre: 'disyunción', f: (p, q) => p || q, frase: (P, Q) => `${P} o ${Q} (o ambas)` },
    imp: { s: '→', nombre: 'implicación', f: (p, q) => !p || q, frase: (P, Q) => `Si ${P}, entonces ${Q}` },
    iff: { s: '↔', nombre: 'bicondicional', f: (p, q) => p === q, frase: (P, Q) => `${P} si y solo si ${Q}` },
    xor: { s: '⊕', nombre: 'o exclusivo', f: (p, q) => p !== q, frase: (P, Q) => `O ${P} o ${Q}, pero no ambas` },
  };
  const P_TXT = 'llueve', Q_TXT = 'hay clases';

  function montarConectivo(cuerpo) {
    let clave = 'imp', p = true, q = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conectivo', opciones: Object.entries(CON).map(([k, v]) => [k, `${v.s}  ${v.nombre}`]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.casilla({ etiqueta: `p = «${P_TXT}» es verdadera`, valor: p, alCambiar: (v) => { p = v; dibujar(); } });
    ctl.casilla({ etiqueta: `q = «${Q_TXT}» es verdadera`, valor: q, alCambiar: (v) => { q = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [{ color: VIZ.alfa(C.s1, 0.35), borde: C.s1, texto: 'verdadero (V)', forma: 'cuadro' }, { color: C.neutro, borde: C.eje, texto: 'falso (F)', forma: 'cuadro' }]);
    const tabla = D.tabla(cuerpo);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cambie los valores de p y q y observe la salida. Compare la fila resaltada de la tabla con la lectura en español.');

    const caja = (x, y, v, t) => D.caja(lienzo.ctx, x, y, 56, 34, `${t} = ${v ? 'V' : 'F'}`, { relleno: v ? VIZ.alfa(C.s1, 0.35) : C.neutro, borde: v ? C.s1 : C.eje, ancho: 2, fuente: VIZ.fuente(13, 600) });
    function dibujar() {
      const K = CON[clave], { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const r = K.un ? K.f(p) : K.f(p, q), xo = W / 2 - 28;
      caja(20, K.un ? 58 : 24, p, 'p');
      if (!K.un) caja(20, 92, q, 'q');
      D.flecha(ctx, 78, K.un ? 75 : 41, xo - 2, K.un ? 75 : 62, C.tinta2);
      if (!K.un) D.flecha(ctx, 78, 109, xo - 2, 88, C.tinta2);
      D.caja(ctx, xo, 52, 56, 46, K.s, { fuente: VIZ.fuente(22, 600), borde: C.tinta, ancho: 2 });
      D.flecha(ctx, xo + 58, 75, W - 84, 75, C.tinta2);
      caja(W - 82, 58, r, K.un ? '¬p' : `p${K.s}q`);
      const vars = K.un ? ['p'] : ['p', 'q'];
      const vals = D.valuaciones(vars);
      tabla.poner({ vars, cols: [{ t: K.un ? '¬p' : `p ${K.s} q`, f: (v) => (K.un ? K.f(v.p) : K.f(v.p, v.q)), fuerte: true }], activa: vals.findIndex((v) => v.p === p && (K.un || v.q === q)) });
      const frase = K.frase(P_TXT, Q_TXT);
      registro.textContent = `${frase[0].toUpperCase()}${frase.slice(1)}.\nEs ${r ? 'verdadera' : 'falsa'} cuando «${P_TXT}» es ${p ? 'verdadera' : 'falsa'}${K.un ? '' : ` y «${Q_TXT}» es ${q ? 'verdadera' : 'falsa'}`}.`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: del español a la lógica ---------- */

  const FRASES = [
    { t: 'Si llueve, me mojo.', v: 'p = llueve, q = me mojo', ok: 'p → q' },
    { t: 'Voy al cine solo si termino la tarea.', v: 'p = voy al cine, q = termino la tarea', ok: 'p → q' },
    { t: 'No es cierto que llueva y haga frío.', v: 'p = llueve, q = hace frío', ok: '¬(p ∧ q)' },
    { t: 'Ni llueve ni hace frío.', v: 'p = llueve, q = hace frío', ok: '¬p ∧ ¬q' },
    { t: 'Me mojo a menos que lleve paraguas.', v: 'p = me mojo, q = llevo paraguas', ok: '¬q → p' },
    { t: 'Apruebo si y solo si estudio.', v: 'p = apruebo, q = estudio', ok: 'p ↔ q' },
    { t: 'Para aprobar es necesario estudiar.', v: 'p = apruebo, q = estudio', ok: 'p → q' },
    { t: 'Estudiar es suficiente para aprobar.', v: 'p = apruebo, q = estudio', ok: 'q → p' },
    { t: 'O toma té o toma café, no ambos.', v: 'p = toma té, q = toma café', ok: 'p ⊕ q' },
  ];

  function montarTraduccion(cuerpo) {
    let i = 0, ast = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Oración', opciones: FRASES.map((f, k) => [k, f.t]), valor: i, alCambiar: (v) => { i = +v; campo.valor = ''; evaluar({ ast: null }); } });
    const campo = D.campoFormula(cuerpo, ctl, { etiqueta: 'Su traducción (variables p y q)', valor: '', simbolos: ['¬', '∧', '∨', '→', '↔', '⊕', '(', ')'], alCambiar: (r) => evaluar(r) });
    ctl.boton('Mostrar una respuesta', () => { campo.valor = FRASES[i].ok; evaluar(D.analizar(campo.valor)); });
    const registro = VIZ.registro(cuerpo);
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: las filas rojas son las que difieren';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La traducción es correcta si es lógicamente equivalente a la respuesta de referencia: tiene la misma tabla de verdad. Las filas rojas muestran dónde difieren.');

    function evaluar(r) {
      const F = FRASES[i], ref = D.leer(F.ok);
      ast = r.ast || null;
      lectura.set([['variables', F.v], ['fórmula escrita', ast ? D.texto(ast) : '—']]);
      if (r.error) { registro.textContent = D.mensaje(campo.valor, r); tabla.poner({ vars: ['p', 'q'], cols: [{ t: 'referencia', f: (v) => D.evalua(ref, v) }] }); return; }
      if (!ast) { registro.textContent = `«${F.t}»\n${F.v}.\nEscriba una fórmula con p y q.`; tabla.poner({ vars: ['p', 'q'], cols: [{ t: 'referencia', f: (v) => D.evalua(ref, v) }] }); return; }
      const extra = D.vars(ast).filter((v) => v !== 'p' && v !== 'q');
      const eq = !extra.length && D.equivalentes(ast, ref);
      tabla.poner({ vars: ['p', 'q'], cols: [{ t: D.texto(ast), f: (v) => D.evalua(ast, v) }, { t: 'referencia', f: (v) => D.evalua(ref, v) }], clase: (v) => (D.evalua(ast, v) !== D.evalua(ref, v) ? 'contraejemplo' : '') });
      registro.textContent = extra.length ? `Use solo las variables p y q (aparece ${extra.join(', ')}).`
        : eq ? '✓ Correcta: su fórmula es equivalente a la de referencia.' : '✗ No equivalente: en las filas rojas su fórmula y la de referencia dan valores distintos.';
    }
    evaluar({ ast: null });
  }

  VIZ.registrarTema('connectives', {
    intro: String.raw`
      <p>Una <strong>proposición</strong> es una oración que es verdadera o falsa, pero no ambas: «llueve», «7 es primo». Con <strong>conectivos</strong> se arman proposiciones más grandes: «llueve <em>y</em> hace frío»,
      «<em>si</em> llueve <em>entonces</em> me mojo». Lo único que importa de una proposición compuesta es su valor de verdad, y este depende solo de los valores de las partes.</p>
      <p>La lógica proposicional deja de lado el contenido de las oraciones y se queda con ese esqueleto: variables \(p, q, r, \dots\) que valen V o F, y los conectivos \(\neg,\ \land,\ \lor,\ \to,\ \leftrightarrow\).</p>`,
    visualizaciones: [
      {
        titulo: 'Cada conectivo con su tabla de verdad',
        descripcion: 'Elija un conectivo y cambie los valores de \\(p\\) y \\(q\\). Preste atención a la implicación: es falsa en una sola fila.',
        montar: montarConectivo,
      },
      {
        titulo: 'Del español a la lógica',
        descripcion: 'Traduzca oraciones usando solo \\(p\\) y \\(q\\). Algunas son engañosas: «solo si», «a menos que», «ni… ni».',
        montar: montarTraduccion,
      },
    ],
    teoria: String.raw`
      <h2>Los conectivos</h2>
      <table>
        <tr><th>Símbolo</th><th>Nombre</th><th>Se lee</th><th>Verdadero cuando…</th></tr>
        <tr><td>\(\neg p\)</td><td>negación</td><td>no \(p\)</td><td>\(p\) es falso</td></tr>
        <tr><td>\(p \land q\)</td><td>conjunción</td><td>\(p\) y \(q\)</td><td>ambos son verdaderos</td></tr>
        <tr><td>\(p \lor q\)</td><td>disyunción</td><td>\(p\) o \(q\)</td><td>al menos uno es verdadero</td></tr>
        <tr><td>\(p \to q\)</td><td>implicación</td><td>si \(p\) entonces \(q\)</td><td>no ocurre «\(p\) verdadero y \(q\) falso»</td></tr>
        <tr><td>\(p \leftrightarrow q\)</td><td>bicondicional</td><td>\(p\) si y solo si \(q\)</td><td>ambos tienen el mismo valor</td></tr>
      </table>
      <h2>Traducciones habituales</h2>
      <ul>
        <li>«\(p\) solo si \(q\)», «para \(p\) es necesario \(q\)»: \(p \to q\).</li>
        <li>«\(p\) si \(q\)», «\(q\) es suficiente para \(p\)»: \(q \to p\).</li>
        <li>«\(p\) a menos que \(q\)»: \(\neg q \to p\) (equivalente a \(p \lor q\)).</li>
        <li>«ni \(p\) ni \(q\)»: \(\neg p \land \neg q\), que es \(\neg(p \lor q)\).</li>
      </ul>
      <h2>La implicación es la más engañosa</h2>
      <p>\(p \to q\) solo es falsa cuando \(p\) es verdadero y \(q\) falso. Si \(p\) es falso, la implicación es verdadera sin importar \(q\) («verdad vacía»): la promesa «si llueve, me mojo» no se rompe en un día sin lluvia.
      Esto es lo que hace funcionar la <a href="tema.html?id=simple-induction">inducción</a>, donde el paso \(P(k) \to P(k+1)\) se cumple trivialmente donde \(P(k)\) es falsa.</p>
      <p>Las fórmulas formadas con estos conectivos tienen una gramática precisa, que se estudia en <a href="tema.html?id=wff">Well-Formed Formulas</a>.</p>`,
  });
})();
