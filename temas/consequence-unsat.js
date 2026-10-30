(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const PROBLEMAS = [
    { n: 'Cadena de implicaciones (válido)', g: ['p → q', 'q → r', 'p'], f: 'r' },
    { n: 'Resolución sencilla (válido)', g: ['p ∨ q', '¬p ∨ r', '¬q ∨ r'], f: 'r' },
    { n: 'Afirmar el consecuente (inválido)', g: ['p → q', 'q'], f: 'p' },
    { n: 'Equivalencia por exclusión (válido)', g: ['p ∨ q', '¬p ∨ ¬q'], f: 'p ↔ ¬q' },
    { n: 'Un caso con premisa de sobra (válido)', g: ['p → (q ∨ r)', '¬q', 's'], f: 'p → r' },
    { n: 'Conclusión demasiado fuerte (inválido)', g: ['p ∨ q', 'q → r'], f: 'r' },
  ];
  const VARS = ['p', 'q', 'r', 's'];

  /* ---------- Fig. 1: los modelos de Γ dentro de los de φ ---------- */

  function montarModelos(cuerpo) {
    let idx = 0, k = 3, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: PROBLEMAS.map((p, i) => [i, p.n]), valor: 0, alCambiar: (v) => { idx = +v; k = PROBLEMAS[idx].g.length; rk.max = k; rk.valor = k; dibujar(); } });
    const rk = ctl.rango({ etiqueta: 'Premisas agregadas', min: 0, max: 3, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 250 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'modelo de las premisas agregadas', forma: 'punto' },
      { color: C.inactivo, texto: 'no es modelo', forma: 'punto' },
      { color: C.s6, texto: 'anillo: la conclusión vale V ahí', forma: 'linea' },
      { color: C.s8, texto: 'contraejemplo: premisas V y conclusión F', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las 16 valuaciones de p, q, r, s en una rejilla. Cada premisa agregada deja sin modelo a algunas. Γ ⊨ φ si y solo si todos los modelos que sobreviven están dentro del anillo verde.');

    function dibujar() {
      const P = PROBLEMAS[idx], { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const g = P.g.slice(0, k).map(D.leer), f = D.leer(P.f), vals = D.valuaciones(VARS);
      const cs = Math.min(54, (W - 40) / 4), ox = (W - 4 * cs) / 2, oy = 18;
      geo = { cs, ox, oy, vals };
      let nm = 0, nc = 0, nf = 0;
      vals.forEach((v, i) => {
        const x = ox + (i % 4) * cs + cs / 2, y = oy + Math.floor(i / 4) * cs + cs / 2;
        const mod = g.every((a) => D.evalua(a, v)), fv = D.evalua(f, v);
        if (mod) nm++; if (fv) nf++; if (mod && !fv) nc++;
        ctx.beginPath(); ctx.arc(x, y, cs * 0.3, 0, 7);
        ctx.fillStyle = mod ? (fv ? C.s1 : C.s8) : C.inactivo; ctx.fill();
        if (fv) { ctx.beginPath(); ctx.arc(x, y, cs * 0.3 + 5, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = C.s6; ctx.stroke(); }
        D.texto2(ctx, VARS.map((a) => (v[a] ? 'V' : 'F')).join(''), x, y + cs * 0.3 + 11, { px: 9.5, color: C.apagado });
      });
      const completo = k === P.g.length;
      registro.textContent = `Premisas agregadas: ${g.length ? g.map(D.texto).join(' ; ') : 'ninguna'}\nConclusión φ: ${P.f}\n` + (completo ? (nc ? `Hay ${nc} modelos de Γ fuera del anillo: Γ ⊭ φ.` : 'Todos los modelos de Γ están dentro del anillo: Γ ⊨ φ.') : 'Agregue todas las premisas para decidir.');
      lectura.set([['modelos de Γ (agregadas)', `${nm} de 16`], ['valuaciones con φ verdadera', `${nf} de 16`], ['contraejemplos', String(nc)], ['Γ ⊨ φ', completo ? (nc ? 'no' : 'sí') : '(faltan premisas)']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.ox) / geo.cs), r = Math.floor((y - geo.oy) / geo.cs);
      if (c < 0 || c > 3 || r < 0 || r > 3) return tip.ocultar();
      tip.mostrar(x, y, D.valTexto(geo.vals[r * 4 + c], VARS));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: refutar Γ ∪ {¬φ} con DPLL ---------- */

  function montarRefutacion(cuerpo) {
    let idx = 0, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: PROBLEMAS.map((p, i) => [i, p.n]), valor: 0, alCambiar: (v) => { idx = +v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (res ? D.altoArbol(res.raiz, 52, (n) => D.profGen(n, (m) => m.hijos)) : 100) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s8, 0.25), borde: C.s8, texto: 'conflicto: cláusula vacía', forma: 'cuadro' },
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'modelo de Γ ∪ {¬φ}', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta2, texto: 'decisión y propagación', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Si todas las ramas terminan en conflicto, Γ ∪ {¬φ} es insatisfacible y por tanto Γ ⊨ φ. Si alguna rama llega a un modelo, ese modelo es un contraejemplo.');

    function calcular() {
      const P = PROBLEMAS[idx];
      const todo = [...P.g.map(D.leer), { k: 'not', a: D.leer(P.f) }].reduce((s, a) => ({ k: 'and', a: s, b: a }));
      const cls = D.clausulas(todo);
      res = D.dpllArbol(cls);
      res.cls = cls;
      lienzo.ajustar(true);
    }
    function dibujar() {
      lienzo.limpiar();
      D.arbolDpll(lienzo, res.raiz);
      const P = PROBLEMAS[idx];
      let hoja = res.raiz; while (hoja.hijos.length && hoja.hijos.some((h) => h.sat)) hoja = hoja.hijos.find((h) => h.sat);
      registro.textContent = `Γ ∪ {¬φ}:  ${[...P.g, '¬(' + P.f + ')'].join(' ;  ')}\nCláusulas:  ${res.cls.map(D.clTxt).join(' ')}\n` + (res.sat ? `Satisfacible: contraejemplo con ${VARS.filter((v) => v in hoja.asig).map((v) => `${v}=${hoja.asig[v] ? 'V' : 'F'}`).join(', ')}. Γ ⊭ φ.` : 'Insatisfacible: Γ ⊨ φ.');
      lectura.set([['cláusulas', String(res.cls.length)], ['nodos de DPLL', String(res.nodos)], ['Γ ∪ {¬φ}', res.sat ? 'satisfacible' : 'insatisfacible'], ['Γ ⊨ φ', res.sat ? 'no' : 'sí']]);
    }
    lienzo.alDibujar = () => res && dibujar();
    calcular();
  }

  VIZ.registrarTema('consequence-unsat', {
    intro: String.raw`
      <p>Decidir si \(\Gamma \models \varphi\) parece pedir mirar <em>todas</em> las valuaciones que satisfacen \(\Gamma\). Hay una manera más cómoda de verlo: \(\varphi\) se sigue de \(\Gamma\) exactamente cuando
      <strong>es imposible</strong> tener \(\Gamma\) verdadero y \(\varphi\) falso a la vez, es decir, cuando \(\Gamma \cup \{\neg\varphi\}\) no tiene modelos.</p>
      <p>Así, la consecuencia se reduce a un problema de <a href="tema.html?id=satisfiability">satisfacibilidad</a>, y cualquier solucionador SAT sirve como demostrador de teoremas.</p>`,
    visualizaciones: [
      {
        titulo: 'Los modelos de Γ dentro de los de φ',
        descripcion: 'Agregue premisas una por una y vea cómo se reducen los modelos. Con todas, ¿alguno cae fuera del anillo verde? Si es así, es un contraejemplo.',
        montar: montarModelos,
      },
      {
        titulo: 'Refutar Γ ∪ {¬φ}',
        descripcion: 'Escribe la negación de la conclusión junto a las premisas y busca un modelo con DPLL. Todas las ramas en conflicto significan que la consecuencia es válida.',
        montar: montarRefutacion,
      },
    ],
    teoria: String.raw`
      <h2>La equivalencia</h2>
      <div class="recuadro"><strong>Teorema.</strong> \(\Gamma \models \varphi \iff \Gamma \cup \{\neg\varphi\}\) es insatisfacible.</div>
      <p><em>Prueba.</em> (\(\Rightarrow\)) Una valuación que satisfaga \(\Gamma\) satisface \(\varphi\), y por tanto no a \(\neg\varphi\). (\(\Leftarrow\)) Si toda valuación que satisface \(\Gamma\) satisface también \(\varphi\), ninguna satisface \(\Gamma \cup \{\neg\varphi\}\).</p>
      <h2>Consecuencias</h2>
      <ul>
        <li>\(\models \varphi\) (tautología) \(\iff\) \(\{\neg\varphi\}\) es insatisfacible.</li>
        <li>\(\Gamma \models \varphi \iff \models \bigwedge\Gamma \to \varphi\) (si \(\Gamma\) es finito).</li>
        <li>Comprobar consecuencia es coNP-completo; comprobar satisfacibilidad es NP-completo.</li>
      </ul>
      <h2>Contraejemplos</h2>
      <p>Cuando \(\Gamma \cup \{\neg\varphi\}\) es satisfacible, cada uno de sus modelos es un <strong>contraejemplo</strong> al argumento: hace verdaderas las premisas y falsa la conclusión. Un solucionador SAT que devuelve un modelo está entregando una refutación explícita.</p>
      <h2>Demostrar por contradicción</h2>
      <p>Es el esquema de «reducción al absurdo»: se supone la negación de lo que se quiere probar y se deriva una contradicción (ver <a href="tema.html?id=inference-rules">Inference Rules &amp; Proof by Contradiction</a>). El método de
      <a href="tema.html?id=resolution-refutation">resolución por refutación</a> lo hace de modo automático sobre cláusulas.</p>`,
  });
})();
