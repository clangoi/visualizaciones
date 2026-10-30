(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const CL = [['p', 'q'], ['¬p', 'r'], ['¬q', '¬r'], ['p', '¬r'], ['¬p', '¬q'], ['q', 'r', 's'], ['¬s', 'p'], ['¬q', 's'], ['p'], ['¬p']];
  const OPC = CL.map((c, i) => [i, `${i + 1}.  ${D.clTxt(c)}`]);

  /* ---------- Fig. 1: resolver dos cláusulas ---------- */

  function montarResolver(cuerpo) {
    let i = 0, j = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Primera cláusula', opciones: OPC, valor: i, alCambiar: (v) => { i = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Segunda cláusula', opciones: OPC, valor: j, alCambiar: (v) => { j = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta2, texto: 'cláusulas padre', forma: 'cuadro' },
      { color: VIZ.alfa(C.s2, 0.25), borde: C.s2, texto: 'literales complementarios (pivote)', forma: 'cuadro' },
      { color: VIZ.alfa(C.s6, 0.25), borde: C.s6, texto: 'resolvente', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija dos cláusulas. Si una contiene l y la otra ¬l, la resolvente reúne los demás literales de ambas. Si no hay pares complementarios, no hay resolvente.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const a = CL[i], b = CL[j], rs = D.resolventes(a, b);
      const ancho = Math.min(W * 0.4, 200);
      const pivotes = new Set(rs.flatMap((r) => [r.lit, D.neg(r.lit)]));
      const caja = (c, cx) => {
        const lits = c.length ? c : ['□'], w = Math.min(ancho, 20 + lits.length * 36);
        D.caja(ctx, cx - w / 2, 24, w, 36, null, { borde: C.tinta2 });
        lits.forEach((l, k) => {
          const x = cx - ((lits.length - 1) * 30) / 2 + k * 30, piv = pivotes.has(l);
          if (piv) D.caja(ctx, x - 14, 31, 28, 22, null, { relleno: VIZ.alfa(C.s2, 0.25), borde: C.s2, radio: 11 });
          D.texto2(ctx, l, x, 43, { px: 14, peso: 600 });
        });
      };
      caja(a, W * 0.27); caja(b, W * 0.73);
      const primero = rs.find((r) => !r.trivial) || rs[0];
      if (primero) {
        D.flecha(ctx, W * 0.27 + 20, 64, W / 2 - 20, 112, C.tinta2); D.flecha(ctx, W * 0.73 - 20, 64, W / 2 + 20, 112, C.tinta2);
        D.texto2(ctx, `pivote ${primero.lit.replace('¬', '')}`, W / 2, 84, { px: 11, color: C.s2, peso: 600 });
        const lits = primero.res.length ? primero.res : ['□'], w = 28 + lits.length * 36;
        D.caja(ctx, W / 2 - w / 2, 116, w, 40, lits.join('   '), { relleno: VIZ.alfa(primero.trivial ? C.s4 : C.s6, 0.25), borde: primero.trivial ? C.s4 : C.s6, ancho: 2, fuente: VIZ.fuente(14, 600) });
      } else D.texto2(ctx, 'sin literales complementarios: no hay resolvente', W / 2, 130, { color: C.apagado, px: 13 });
      registro.textContent = !rs.length ? `${D.clTxt(a)} y ${D.clTxt(b)} no tienen un literal y su complemento: no se puede resolver.`
        : rs.map((r) => `Pivote ${r.lit.replace('¬', '')}:  res(${D.clTxt(a)}, ${D.clTxt(b)}) = ${D.clTxt(r.res)}${r.trivial ? '   (trivial: contiene p y ¬p, se descarta)' : r.res.length ? '' : '   ← cláusula vacía: contradicción'}`).join('\n');
      lectura.set([['pares complementarios', String(rs.length)], ['resolventes útiles', String(rs.filter((r) => !r.trivial).length)], ['¿cláusula vacía?', rs.some((r) => !r.res.length) ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: la resolvente es consecuencia de los padres ---------- */

  const PARES = [
    ['{p, q} y {¬p, r}', ['p', 'q'], ['¬p', 'r']],
    ['{p, q, r} y {¬p, s}', ['p', 'q', 'r'], ['¬p', 's']],
    ['{p} y {¬p, q}', ['p'], ['¬p', 'q']],
    ['{p, q} y {¬p, ¬q}', ['p', 'q'], ['¬p', '¬q']],
  ];

  function montarSolidez(cuerpo) {
    let k = 0, dos = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cláusulas padre', opciones: PARES.map((p, n) => [n, p[0]]), valor: k, alCambiar: (v) => { k = +v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Regla incorrecta: eliminar dos pares complementarios a la vez', valor: dos, alCambiar: (v) => { dos = v; dibujar(); } });
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: verde = padres verdaderos, rojo = resolvente falsa con padres verdaderos';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La regla es correcta si, en toda fila donde las dos cláusulas padre son verdaderas, la resolvente también lo es. Active la regla incorrecta con {p, q} y {¬p, ¬q}: aparece una fila roja.');

    function dibujar() {
      const [, a, b] = PARES[k];
      const rs = D.resolventes(a, b);
      let res = rs[0] ? rs[0].res : [...a, ...b];
      if (dos && rs.length > 1) res = a.filter((l) => !rs.some((r) => r.lit === l)).concat(b.filter((l) => !rs.some((r) => D.neg(r.lit) === l)));
      else if (!rs.length) res = [];
      const f = (c) => D.astDeForma([c], 'cnf');
      const A = f(a), B = f(b), R = f(res);
      const vars = [...new Set([...D.vars(A), ...D.vars(B), ...D.vars(R)])].sort();
      const vals = D.valuaciones(vars);
      const mal = vals.filter((v) => D.evalua(A, v) && D.evalua(B, v) && !D.evalua(R, v));
      tabla.poner({ vars, vals, cols: [{ t: D.clTxt(a), f: (v) => D.evalua(A, v) }, { t: D.clTxt(b), f: (v) => D.evalua(B, v) }, { t: `resolvente ${D.clTxt(res)}`, f: (v) => D.evalua(R, v), fuerte: true }], clase: (v) => (D.evalua(A, v) && D.evalua(B, v) ? (D.evalua(R, v) ? 'modelo' : 'contraejemplo') : '') });
      registro.textContent = mal.length ? `Regla INCORRECTA: con ${D.valTexto(mal[0], vars)} las dos cláusulas son verdaderas y «${D.clTxt(res)}» es falsa. De premisas verdaderas se derivó algo falso.`
        : `Regla correcta en este caso: en las ${vals.filter((v) => D.evalua(A, v) && D.evalua(B, v)).length} filas donde ambas cláusulas son verdaderas, la resolvente también lo es.`;
      lectura.set([['resolvente usada', D.clTxt(res)], ['filas con padres verdaderos', String(vals.filter((v) => D.evalua(A, v) && D.evalua(B, v)).length)], ['filas que la refutan', String(mal.length)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('resolution-rule', {
    intro: String.raw`
      <p>La <strong>regla de resolución</strong> es una única regla de inferencia que trabaja sobre <a href="tema.html?id=literals-clauses">cláusulas</a>. Si una cláusula contiene un literal \(l\) y otra contiene su complemento \(\neg l\),
      se pueden juntar los literales restantes de ambas: la <strong>resolvente</strong>.</p>
      <p>Piénsela como un caso general de dos reglas conocidas: de \(p \lor q\) y \(\neg p \lor r\) se concluye \(q \lor r\), lo que incluye el modus ponens (\(\neg p \lor q\) es \(p \to q\)) y el silogismo disyuntivo.</p>`,
    visualizaciones: [
      {
        titulo: 'Resuelva dos cláusulas',
        descripcion: 'Elija dos cláusulas y observe el pivote y la resolvente. Pruebe pares sin literales complementarios y el par \\(\\{p\\}\\), \\(\\{\\neg p\\}\\), que da la cláusula vacía.',
        montar: montarResolver,
      },
      {
        titulo: 'La resolvente es consecuencia de los padres',
        descripcion: 'Compruebe en la tabla de verdad que la resolvente se sigue de las dos cláusulas padre. Active la regla incorrecta y busque la fila que la refuta.',
        montar: montarSolidez,
      },
    ],
    teoria: String.raw`
      <h2>La regla</h2>
      \[ \frac{C \cup \{l\} \qquad D \cup \{\neg l\}}{C \cup D} \]
      <p>Aquí \(C\) y \(D\) son conjuntos de literales y \(l\) es el <em>literal de resolución</em> o pivote. Si \(C = D = \varnothing\), la resolvente es la cláusula vacía \(\Box\), que es insatisfacible.</p>
      <h2>Corrección</h2>
      <div class="recuadro"><strong>Lema.</strong> \(C \cup \{l\},\ D \cup \{\neg l\} \models C \cup D\).</div>
      <p>Sea \(v\) una valuación que satisface ambas premisas. Si \(v(l) = 1\), entonces \(v(\neg l) = 0\) y la segunda cláusula necesita algún literal de \(D\) verdadero. Si \(v(l) = 0\), la primera necesita algún literal de \(C\) verdadero. En ambos casos \(C \cup D\) se satisface.</p>
      <h2>Se resuelve sobre un solo literal a la vez</h2>
      <p>Si las cláusulas tienen dos pares complementarios, como \(\{p,q\}\) y \(\{\neg p,\neg q\}\), la resolvente sobre \(p\) es \(\{q, \neg q\}\), una tautología (se descarta), no \(\Box\). Eliminar los dos pares a la vez daría una cláusula vacía, y las dos premisas son satisfacibles:
      la regla sería incorrecta.</p>
      <h2>Qué sigue</h2>
      <p>Aplicada repetidamente hasta obtener \(\Box\), la resolución es un método de <a href="tema.html?id=resolution-refutation">refutación</a> correcto y completo para lógica proposicional: un conjunto de cláusulas es insatisfacible si y solo si se deriva \(\Box\).</p>`,
  });
})();
