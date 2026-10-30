(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const PROBLEMAS = [
    { n: 'Cadena de implicaciones (válido)', g: ['p → q', 'q → r', 'p'], f: 'r' },
    { n: 'Resolución sencilla (válido)', g: ['p ∨ q', '¬p ∨ r', '¬q ∨ r'], f: 'r' },
    { n: 'Afirmar el consecuente (inválido)', g: ['p → q', 'q'], f: 'p' },
    { n: 'Equivalencia por exclusión (válido)', g: ['p ∨ q', '¬p ∨ ¬q'], f: 'p ↔ ¬q' },
    { n: 'Con una premisa de sobra (válido)', g: ['p → (q ∨ r)', '¬q', 's'], f: 'p → r' },
  ];
  const clausulasDe = (P) => D.clausulas([...P.g.map(D.leer), { k: 'not', a: D.leer(P.f) }].reduce((s, a) => ({ k: 'and', a: s, b: a })));
  const correr = (P, estrategia = 'ancho', tope = 400) => { const R = D.resolucion(clausulasDe(P), { estrategia }); for (let k = 0; k < tope && !R.listo(); k++) R.paso(); return R; };

  /* ---------- Fig. 1: saturación por resolución ---------- */

  function montarSaturacion(cuerpo) {
    let idx = 0, R = null, nuevos = new Set(), par = null, fin = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: PROBLEMAS.map((p, i) => [i, p.n]), valor: 0, alCambiar: (v) => { idx = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    const intro = VIZ.registro(cuerpo);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso resuelve un par de cláusulas y agrega la resolvente, si es nueva. Si aparece □, el conjunto es insatisfacible; si se agotan los pares sin □, es satisfacible.');

    function iniciar() {
      const P = PROBLEMAS[idx];
      R = D.resolucion(clausulasDe(P));
      nuevos = new Set(); par = null; fin = '';
      intro.textContent = `Γ: ${P.g.join(' ;  ')}\nφ: ${P.f}      →  se resuelve Γ ∪ {¬φ} en forma clausal`;
      return (function* () {
        yield;
        for (let k = 0; k < 400; k++) {
          const s = R.paso();
          if (!s) { fin = 'sin'; return; }
          par = [s.i, s.j]; nuevos = new Set(s.nuevos);
          if (R.vacia >= 0) { fin = 'vacia'; yield; return; }
          yield;
        }
      })();
    }
    function dibujar() {
      lista.replaceChildren(...R.cl.map((c, i) => VIZ.el('div', { class: nuevos.has(i) ? 'activa' : null },
        `${String(i + 1).padStart(2)}.  ${D.clTxt(c.c).padEnd(16)} ${c.padres ? `[${c.padres[0] + 1}, ${c.padres[1] + 1} sobre ${D.varDe(c.lit)}]` : '[inicial]'}${par && par.includes(i) ? '   ← padre' : ''}`)));
      registro.textContent = fin === 'vacia' ? `Se derivó □ (cláusula ${R.vacia + 1}): Γ ∪ {¬φ} es insatisfacible, luego Γ ⊨ φ.`
        : fin === 'sin' ? 'No quedan pares por resolver y no apareció □: el conjunto es satisfacible, luego Γ ⊭ φ.' : par ? `Se resolvieron las cláusulas ${par[0] + 1} y ${par[1] + 1}.` : 'Cláusulas iniciales. Pulse «Un paso».';
      lectura.set([['cláusulas', String(R.cl.length)], ['pares resueltos', String(R.pares)], ['resolventes generadas', String(R.generadas)], ['resultado', fin === 'vacia' ? 'válido' : fin === 'sin' ? 'inválido' : 'en curso']]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: árbol de la refutación ---------- */

  function montarArbol(cuerpo) {
    let idx = 0, arbol = null, R = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: PROBLEMAS.map((p, i) => [i, p.n]), valor: 0, alCambiar: (v) => { idx = +v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (arbol ? D.altoArbol(arbol, 56, D.profGen) : 90) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'cláusula inicial (hoja)', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta2, texto: 'resolvente', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.2), borde: C.s8, texto: '□: contradicción', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El árbol de refutación tiene en las hojas las cláusulas de partida y en la raíz la cláusula vacía. Cada nodo interior es la resolvente de sus dos hijos.');

    function calcular() {
      R = correr(PROBLEMAS[idx]);
      const nodo = (k) => ({ t: D.clTxt(R.cl[k].c), ini: !R.cl[k].padres, hs: R.cl[k].padres ? R.cl[k].padres.map(nodo) : [] });
      arbol = R.vacia >= 0 ? nodo(R.vacia) : null;
      lienzo.ajustar(true);
    }
    function dibujar() {
      lienzo.limpiar();
      if (!arbol) { D.texto2(lienzo.ctx, 'No se derivó □: el conjunto es satisfacible, no hay refutación.', lienzo.ancho / 2, 44, { color: C.s6, px: 13, peso: 600 }); }
      else D.arbol(lienzo, arbol, { ...D.GEN, fila: 56, relleno: (r) => (r.n.ini ? VIZ.alfa(C.s1, 0.2) : r.n.t === '□' ? VIZ.alfa(C.s8, 0.2) : null), borde: (r) => (r.n.ini ? C.s1 : r.n.t === '□' ? C.s8 : C.tinta2) });
      const P = PROBLEMAS[idx];
      const usadas = arbol ? R.derivacion().length : 0;
      registro.textContent = `Γ: ${P.g.join(' ;  ')}\nφ: ${P.f}\n` + (arbol ? 'Refutación encontrada: Γ ∪ {¬φ} es insatisfacible, luego Γ ⊨ φ.' : 'Saturación sin □: Γ ⊭ φ.');
      lectura.set([['cláusulas totales', String(R.cl.length)], ['cláusulas en la refutación', arbol ? String(usadas) : '—'], ['altura del árbol', arbol ? String(D.profGen(arbol)) : '—'], ['resultado', arbol ? 'válido' : 'inválido']]);
    }
    lienzo.alDibujar = () => R && dibujar();
    calcular();
  }

  VIZ.registrarTema('resolution-refutation', {
    intro: String.raw`
      <p>La resolución se usa para <strong>refutar</strong>: se parte de un conjunto de cláusulas y se aplica la regla una y otra vez agregando resolventes. Si en algún momento aparece la <strong>cláusula vacía</strong> \(\Box\),
      que no tiene ningún literal y por tanto es falsa siempre, el conjunto de partida era insatisfacible.</p>
      <p>Para probar que \(\Gamma \models \varphi\) se resuelve \(\Gamma \cup \{\neg\varphi\}\): si se llega a \(\Box\), la conclusión se sigue. Es el motor de muchos demostradores automáticos.</p>`,
    visualizaciones: [
      {
        titulo: 'Saturación por resolución',
        descripcion: 'Avance paso a paso: cada paso resuelve un par y agrega la nueva cláusula. Compare los problemas válidos, que terminan en □, con el inválido, que se satura sin □.',
        montar: montarSaturacion,
      },
      {
        titulo: 'Árbol de la refutación',
        descripcion: 'Cuando hay refutación, se dibuja el árbol de las cláusulas necesarias: hojas son datos y la raíz es \\(\\Box\\). Mire su altura y cuántas cláusulas intervienen.',
        montar: montarArbol,
      },
    ],
    teoria: String.raw`
      <h2>Método</h2>
      <ol>
        <li>Pasar \(\Gamma \cup \{\neg\varphi\}\) a <a href="tema.html?id=cnf-dnf">CNF</a> y escribirlo como conjunto de cláusulas \(S\).</li>
        <li>Mientras no aparezca \(\Box\) y haya pares sin resolver: elegir dos cláusulas con literales complementarios y agregar su resolvente.</li>
        <li>Si aparece \(\Box\): \(S\) es insatisfacible. Si se agotan los pares: \(S\) es satisfacible.</li>
      </ol>
      <h2>Corrección y completitud</h2>
      <div class="recuadro"><strong>Teorema.</strong> Un conjunto finito de cláusulas \(S\) es insatisfacible si y solo si \(\Box\) se deriva de \(S\) por resolución.</div>
      <p><em>Corrección:</em> cada resolvente es consecuencia de sus padres (ver <a href="tema.html?id=resolution-rule">la regla</a>), así que \(\Box\) derivable implica que \(S\) no tiene modelos. <em>Completitud:</em> por inducción sobre el número de variables:
      se separa \(S\) según una variable \(p\) en \(S_p\) y \(S_{\neg p}\), cada uno refutable con una variable menos, y se reúnen las refutaciones.</p>
      <h2>Terminación</h2>
      <p>Con un número finito de variables, hay finitas cláusulas posibles (sin literales repetidos), así que la saturación termina: se llega a \(\Box\) o a un conjunto cerrado bajo resolución. La cantidad de cláusulas puede ser exponencial; con buenas
      <a href="tema.html?id=clause-selection">estrategias de selección</a> se evita explorar casi todas.</p>
      <h2>Relación con la consecuencia</h2>
      <p>Esta es la versión automática de la equivalencia entre consecuencia e insatisfacibilidad (ver <a href="tema.html?id=consequence-unsat">Consequence as Unsatisfiability</a>).</p>`,
  });
})();
