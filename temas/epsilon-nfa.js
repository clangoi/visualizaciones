(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.E;
  const EJ = {
    abc: { nombre: 'a*b*c* (tres ciclos encadenados)', aut: A.construir({ n: 3, ini: [0], fin: [2], trans: [[0, 'a', 0], [0, E, 1], [1, 'b', 1], [1, E, 2], [2, 'c', 2]], pos: [[0, 0.5], [0.5, 0.5], [1, 0.5]] }), palabra: 'aabcc' },
    uni: { nombre: 'ab* | c (de la construcción de Thompson)', aut: A.thompson(A.parsear('ab*|c').ast), palabra: 'abb' },
    est: { nombre: '(a|b)*abb (de la construcción de Thompson)', aut: A.thompson(A.parsear('(a|b)*abb').ast), palabra: 'babb' },
  };
  const CLAVES = Object.keys(EJ);
  const todas = (alf, max) => { const r = ['']; let niv = ['']; for (let l = 1; l <= max; l++) { const s = []; for (const w of niv) for (const c of alf) s.push(w + c); r.push(...s); niv = s; } return r; };

  /* ---------- Fig. 1: ε-clausura paso a paso ---------- */

  function montarClausura(cuerpo) {
    let k = 'abc', origen = 0, clausura = new Set([0]), frontera = [], paso = 0, geo = null, usadas = new Set();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'ε-AFN', opciones: CLAVES.map((c) => [c, EJ[c].nombre]), valor: k, alCambiar: (v) => { k = v; origen = EJ[k].aut.ini[0]; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (EJ[k].aut.n > 6 ? (w < 560 ? 340 : 290) : 210) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'ya está en la ε-clausura' },
      { color: VIZ.alfa(C.s4, 0.5), borde: C.s4, texto: 'en la frontera (por explorar)' },
      { color: C.s2, texto: 'ε-transición que se sigue', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un estado para calcular su ε-clausura: todos los estados alcanzables con cero o más transiciones ε (el propio estado siempre está). La tabla muestra la clausura de cada estado.');

    function iniciar() {
      const aut = EJ[k].aut;
      clausura = new Set([origen]); frontera = [origen]; usadas = new Set(); paso = 0;
      return (function* () {
        while (frontera.length) {
          const q = frontera.shift();
          for (const e of A.ady(aut)[q]) if (e.s === E) {
            usadas.add(q + '>' + e.a);
            if (!clausura.has(e.a)) { clausura.add(e.a); frontera.push(e.a); }
          }
          paso++;
          yield;
        }
      })();
    }
    function dibujar() {
      const aut = EJ[k].aut;
      lienzo.limpiar();
      geo = A.dibujar(lienzo, aut, {
        radio: aut.n > 8 ? 12 : 16,
        nodo: (q) => (frontera.includes(q) ? { relleno: VIZ.alfa(C.s4, 0.5), borde: C.s4, ancho: 3 } : clausura.has(q) ? { relleno: VIZ.alfa(C.s6, 0.28), borde: C.s6, ancho: q === origen ? 4 : 2.5 } : null),
        arista: (de, a, sims) => (sims.includes(E) && usadas.has(de + '>' + a) ? { color: C.s2, ancho: 3 } : sims.includes(E) ? { color: C.apagado, ancho: 1.5, guiones: [4, 3] } : null),
      });
      tabla.replaceChildren(VIZ.el('tr', null, VIZ.el('th', null, 'estado'), VIZ.el('th', null, 'ε-clausura')),
        ...aut.nombres.map((nm, q) => VIZ.el('tr', { class: q === origen ? 'activa' : null }, VIZ.el('td', { class: 'izq' }, nm), VIZ.el('td', null, A.nombreConj(aut, A.clausura(aut, new Set([q])))))));
      registro.textContent = frontera.length ? `Se explora ${aut.nombres[frontera[0]]}: sus ε-transiciones agregan estados a la clausura.` : `Clausura terminada: ε-clausura(${aut.nombres[origen]}) = ${A.nombreConj(aut, clausura)}.`;
      lectura.set([['estado de origen', aut.nombres[origen]], ['clausura (hasta ahora)', A.nombreConj(aut, clausura)], ['tamaño', String(clausura.size)], ['frontera', frontera.length ? frontera.map((q) => aut.nombres[q]).join(', ') : 'vacía']]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y); if (q >= 0) { origen = q; rep.reiniciar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y), aut = EJ[k].aut;
      if (q < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${aut.nombres[q]}</b><br>ε-clausura = ${A.nombreConj(aut, A.clausura(aut, new Set([q])))}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: eliminar ε-transiciones ---------- */

  function montarEliminar(cuerpo) {
    let k = 'abc', sel = -1, geoI = null, geoD = null, sin = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'ε-AFN', opciones: CLAVES.map((c) => [c, EJ[c].nombre]), valor: k, alCambiar: (v) => { k = v; sel = -1; recomputar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 700 ? 480 : 270) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado elegido (y su ε-clausura en el original)' },
      { color: C.s2, texto: 'transiciones nuevas desde ese estado', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un estado del autómata original. Con ε-clausura(q) = {…}, cada símbolo a lleva desde q a ε-clausura de lo alcanzado por a desde esa clausura; q es final si su clausura toca un final.');

    function recomputar() { sin = A.sinEpsilon(EJ[k].aut); lienzo.ajustar(true); }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, aut = EJ[k].aut, vert = W < 700;
      lienzo.limpiar();
      const izq = vert ? { x: 0, y: 14, w: W, h: H / 2 - 14 } : { x: 0, y: 14, w: W / 2, h: H - 14 }, der = vert ? { x: 0, y: H / 2 + 14, w: W, h: H / 2 - 14 } : { x: W / 2, y: 14, w: W / 2, h: H - 14 };
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('ε-AFN original', izq.x + 6, izq.y - 12); ctx.fillText('AFN equivalente sin ε', der.x + 6, der.y - 12);
      const cl = sel >= 0 ? A.clausura(aut, new Set([sel])) : new Set();
      geoI = A.dibujar(lienzo, aut, { caja: izq, radio: aut.n > 8 ? 12 : 15, nodo: (q) => (cl.has(q) ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: q === sel ? 4 : 2.5 } : null), arista: (de, a, sims) => (sims.includes(E) ? { color: C.apagado, guiones: [4, 3] } : null) });
      const idx = sin.nombres.map((nm) => aut.nombres.indexOf(nm));
      const nuevoSel = idx.indexOf(sel);
      geoD = A.dibujar(lienzo, sin, { caja: der, radio: sin.n > 8 ? 12 : 15, nodo: (q) => (q === nuevoSel ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 4 } : null), arista: (de, a) => (de === nuevoSel ? { color: C.s2, ancho: 3 } : null) });
      const ws = todas(aut.alf, 6), malas = ws.filter((w) => A.acepta(aut, w) !== A.acepta(sin, w)).length;
      registro.textContent = sel >= 0 ? `ε-clausura(${aut.nombres[sel]}) = ${A.nombreConj(aut, cl)}${nuevoSel < 0 ? '. Ese estado ya no es alcanzable y se elimina.' : `; ${aut.nombres[sel]} ${sin.fin.has(nuevoSel) ? 'pasa a ser final' : 'no es final'} en el nuevo autómata.`}` : 'Haga clic en un estado del autómata original.';
      lectura.set([['estados originales', String(aut.n)], ['estados sin ε (alcanzables)', String(sin.n)], ['ε-transiciones eliminadas', String(aut.aristas.filter((e) => e.s === E).length)], ['transiciones nuevas', String(sin.aristas.length)], [`discrepancias (|w| ≤ 6, ${ws.length} palabras)`, String(malas)]]);
    }
    lienzo.alDibujar = () => sin && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geoI, x, y); if (q >= 0) { sel = q === sel ? -1 : q; dibujar(); } });
    recomputar();
  }

  VIZ.registrarTema('epsilon-nfa', {
    intro: String.raw`
      <p>Un <strong>ε-AFN</strong> permite además transiciones que <em>no leen ningún símbolo</em>: el autómata puede cambiar de estado «gratis». Es cómodo para construir autómatas por piezas (unir dos autómatas, repetir uno) sin preocuparse de las conexiones símbolo a símbolo.</p>
      <p>No añade poder: la <strong>ε-clausura</strong> de un estado —todos los estados a los que se llega por transiciones ε— permite absorber esos saltos y obtener un AFN ordinario con el mismo lenguaje.</p>`,
    visualizaciones: [
      {
        titulo: 'Calcular la ε-clausura',
        descripcion: 'Elija un estado con un clic y avance: una búsqueda en anchura sigue solo las transiciones ε y reúne todos los estados alcanzables.',
        montar: montarClausura,
      },
      {
        titulo: 'Eliminar las ε-transiciones',
        descripcion: 'Compare el autómata con ε y su equivalente sin ε. Haga clic en un estado para ver su clausura y las transiciones nuevas que adquiere.',
        montar: montarEliminar,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un ε-AFN es \(N = (Q, \Sigma, \delta, I, F)\) con \(\delta : Q \times (\Sigma \cup \{\varepsilon\}) \to \mathcal{P}(Q)\). La <strong>ε-clausura</strong> de un conjunto \(S\) es el menor conjunto \(\operatorname{cl}(S) \supseteq S\) cerrado bajo ε-transiciones:</p>
      \[ q \in \operatorname{cl}(S) \ \wedge\ r \in \delta(q, \varepsilon) \ \Rightarrow\ r \in \operatorname{cl}(S). \]
      <p>Se calcula con una búsqueda en profundidad o anchura sobre las aristas ε, en tiempo \(O(|Q| + |\delta_\varepsilon|)\).</p>
      <h2>Ejecución</h2>
      <p>El conjunto de estados activos tras leer \(w\) es \(S_0 = \operatorname{cl}(I)\) y \(S_{i+1} = \operatorname{cl}\bigl(\bigcup_{q \in S_i} \delta(q, a_{i+1})\bigr)\). La palabra se acepta si \(S_n \cap F \neq \varnothing\).</p>
      <h2>Eliminación de ε-transiciones</h2>
      <p>Se construye el AFN \(N' = (Q, \Sigma, \delta', \operatorname{cl}(I), F')\) con</p>
      \[ \delta'(q, a) = \operatorname{cl}\bigl(\delta(\operatorname{cl}(\{q\}), a)\bigr), \qquad F' = \{ q : \operatorname{cl}(\{q\}) \cap F \neq \varnothing \}. \]
      <p>Se cumple \(L(N') = L(N)\), con los mismos estados y ninguna ε-transición. (Una variante equivalente deja \(\delta'(q,a) = \delta(\operatorname{cl}(q), a)\) y, en lugar de \(\operatorname{cl}(I)\), conserva \(I\) con \(F'\) ampliado.) Después se pueden podar los estados inalcanzables.</p>
      <div class="recuadro"><p>Con este paso un ε-AFN se convierte en AFN, y de ahí en AFD por <a href="tema.html?id=subset-construction">subconjuntos</a>. También se puede saltar el paso intermedio usando \(\operatorname{cl}\) dentro de la construcción por subconjuntos.</p></div>
      <h2>Conexiones</h2>
      <p>Los ε-AFN son el formato natural de la <a href="tema.html?id=thompson-construction">construcción de Thompson</a>, que traduce expresiones regulares a autómatas con \(O(|r|)\) estados.</p>`,
  });
})();
