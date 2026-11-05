(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  const TAREAS = {
    vacio: { nombre: '¿L(A) es vacío?', usaB: false, pred: (x) => x, hay: 'L(A) no es vacío', no: 'L(A) es vacío', desc: 'palabra aceptada por A' },
    equiv: { nombre: '¿L(A) = L(B)?', usaB: true, pred: (x, y) => x !== y, hay: 'A y B NO son equivalentes', no: 'A y B son equivalentes', desc: 'palabra que solo uno acepta' },
    incl: { nombre: '¿L(A) ⊆ L(B)?', usaB: true, pred: (x, y) => x && !y, hay: 'L(A) NO está incluido en L(B)', no: 'L(A) ⊆ L(B)', desc: 'palabra de A que B rechaza' },
    inter: { nombre: '¿L(A) ∩ L(B) es vacío?', usaB: true, pred: (x, y) => x && y, hay: 'la intersección NO es vacía', no: 'la intersección es vacía', desc: 'palabra aceptada por ambos' },
  };
  const PAREJAS = [['(a|b)*abb', '(a|b)*b'], ['(a|b)*', '(a*b*)*'], ['a*b*', '(ab)*'], ['(aa)*', 'a*'], ['a(a|b)*', 'b(a|b)*']];

  // AFD completo del producto sobre el alfabeto común y árbol de la búsqueda en anchura.
  function preparar(ra, rb, tarea) {
    const pa = A.deRegex(ra), pb = A.deRegex(tarea.usaB ? rb : ra);
    if (pa.error || pb.error) return { error: pa.error ? `A: ${pa.error}` : `B: ${pb.error}` };
    const alf = [...new Set([...A.alfabetoDe(pa.ast), ...A.alfabetoDe(pb.ast)])].sort();
    const norm = (x) => { const n = x.nfa; n.alf = alf; return A.determinizar(n).dfa; };
    const da = norm(pa), db = norm(pb);
    da.nombres = da.nombres.map((_, i) => 'A' + i); db.nombres = db.nombres.map((_, i) => 'B' + i);
    const { dfa, pares } = A.producto(da, db, tarea.pred);
    const padre = Array(dfa.n).fill(null);
    for (const e of dfa.aristas) if (e.a > e.de && padre[e.a] === null) padre[e.a] = { de: e.de, s: e.s };
    padre[0] = null;
    return { dfa, pares, padre, da, db, alf };
  }

  /* ---------- Fig. 1: búsqueda de testigos en el producto ---------- */

  function montarBusqueda(cuerpo) {
    let geo1 = null, tarea = 'equiv', ra = PAREJAS[0][0], rb = PAREJAS[0][1], prep = null, vistos = 0, testigo = -1, error = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Pregunta', opciones: Object.entries(TAREAS).map(([k, t]) => [k, t.nombre]), valor: tarea, alCambiar: (v) => { tarea = v; rep.reiniciar(); } });
    const ca = ctl.texto({ etiqueta: 'Expresión A', valor: ra, alCambiar: (v) => { ra = v; rep.reiniciar(); }, alEnter: (v) => { ra = v; rep.reiniciar(); } });
    const cb = ctl.texto({ etiqueta: 'Expresión B', valor: rb, alCambiar: (v) => { rb = v; rep.reiniciar(); }, alEnter: (v) => { rb = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...PAREJAS.map((p, i) => [i, `${p[0]}   vs   ${p[1]}`])], valor: '', alCambiar: (v) => { if (v === '') return; [ra, rb] = PAREJAS[+v]; ca.valor = ra; cb.valor = rb; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (prep && prep.dfa.n > 8 ? (w < 560 ? 360 : 310) : 240) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'par que se visita ahora' },
      { color: C.neutro, borde: C.tinta, texto: 'par ya visitado' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'par testigo' },
      { color: C.s2, texto: 'camino más corto hasta el testigo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todas las preguntas se reducen a alcanzabilidad: se construye el producto de los dos autómatas y se busca, en anchura, un par «testigo». La primera palabra que lo alcanza es la más corta.');

    function iniciar() {
      const t = TAREAS[tarea];
      prep = preparar(ra, rb, t); error = prep.error || null; vistos = 0; testigo = -1;
      lienzo.ajustar(true);
      if (error) return (function* () {})();
      return (function* () {
        for (let i = 0; i < prep.dfa.n; i++) { vistos = i + 1; if (prep.dfa.fin.has(i)) { testigo = i; yield; return; } yield; }
      })();
    }
    const palabraDe = (i) => { const w = []; while (prep.padre[i]) { w.unshift(prep.padre[i].s); i = prep.padre[i].de; } return w.join(''); };
    const caminoDe = (i) => { const s = new Set([i]); while (prep.padre[i]) { i = prep.padre[i].de; s.add(i); } return s; };
    function dibujar() {
      const { ctx, alto: H } = lienzo, t = TAREAS[tarea];
      lienzo.limpiar();
      if (error) { ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(error, 12, H / 2); registro.textContent = 'Corrija la expresión.'; lectura.set([['estado', 'error de sintaxis']]); return; }
      const d = prep.dfa, ruta = testigo >= 0 ? caminoDe(testigo) : new Set(), actual = vistos - 1;
      geo1 = A.dibujar(lienzo, d, {
        radio: d.n > 9 ? 13 : 16, pildora: true,
        nodo: (q) => (q === testigo ? { relleno: VIZ.alfa(C.s8, 0.28), borde: C.s8, ancho: 3 } : q === actual && vistos ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 3 } : q < vistos ? { relleno: C.neutro } : { borde: C.rejilla, tinta: C.inactivo }),
        arista: (de, a) => (ruta.has(de) && ruta.has(a) && prep.padre[a] && prep.padre[a].de === de ? { color: C.s2, ancho: 3 } : null),
      });
      const fin = vistos === d.n || testigo >= 0;
      registro.textContent = testigo >= 0
        ? `Testigo encontrado en el par ${d.nombres[testigo]}: la palabra «${palabraDe(testigo) || 'ε'}» es una ${t.desc}. ⇒ ${t.hay}.`
        : fin && vistos ? `Se visitaron los ${d.n} pares alcanzables sin hallar ningún testigo. ⇒ ${t.no}.` : vistos ? `Se visita el par ${d.nombres[actual]}: ¿es testigo? No.` : 'Pulse «Un paso» para empezar la búsqueda en anchura.';
      lectura.set([['pares alcanzables', String(d.n)], ['visitados', `${vistos} de ${d.n}`], ['pares testigo', String(d.fin.size)], ['palabra testigo', testigo >= 0 ? '«' + (palabraDe(testigo) || 'ε') + '»' : '—'], ['respuesta', fin && vistos ? (testigo >= 0 ? t.hay : t.no) : '…']]);
    }
    lienzo.alDibujar = () => prep && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!prep || error) return;
      const { x, y } = lienzo.posicion(ev);
      const hit = A.nodoEn({ pos: geo1.pos, r: 26 }, x, y);
      if (hit < 0) return tip.ocultar();
      tip.mostrar(x, y, `par <b>${prep.dfa.nombres[hit]}</b><br>se llega con «${palabraDe(hit) || 'ε'}»${prep.dfa.fin.has(hit) ? '<br>es un par testigo' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: alcanzabilidad, estados muertos y editor de finales ---------- */

  const BASE = A.construir({ n: 6, alf: ['a', 'b'], ini: [0], fin: [3],
    trans: [[0, 'a', 1], [0, 'b', 2], [1, 'a', 0], [1, 'b', 3], [2, ['a', 'b'], 2], [3, ['a', 'b'], 3], [4, 'a', 3], [4, 'b', 4], [5, 'a', 5], [5, 'b', 4]],
    pos: [[0, 0.45], [0.33, 0.1], [0.33, 0.85], [0.7, 0.3], [1, 0.1], [1, 0.8]] });

  function montarAlcanzabilidad(cuerpo) {
    let fin = new Set(BASE.fin), geo = null, info = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Restaurar finales', () => { fin = new Set(BASE.fin); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 260 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'útil: alcanzable y desde él se llega a un final' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'muerto: alcanzable pero sin camino a un final' },
      { color: C.neutro, borde: C.inactivo, texto: 'inalcanzable desde el inicial' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un estado para alternar si es de aceptación y vea cómo cambia el veredicto de vacuidad. Pase el cursor para ver la palabra más corta que llega a cada estado.');

    function analizar() {
      const aut = A.construir({ n: BASE.n, nombres: BASE.nombres, alf: BASE.alf, ini: BASE.ini, fin: [...fin], trans: BASE.aristas.map((e) => [e.de, e.s, e.a]), pos: BASE.pos });
      const dist = Array(aut.n).fill(null), palabra = Array(aut.n).fill(null);
      dist[0] = 0; palabra[0] = '';
      const cola = [0];
      for (let h = 0; h < cola.length; h++) for (const e of A.ady(aut)[cola[h]]) if (dist[e.a] === null) { dist[e.a] = dist[cola[h]] + 1; palabra[e.a] = palabra[cola[h]] + e.s; cola.push(e.a); }
      const co = new Set([...aut.fin]);
      for (let cambio = true; cambio;) { cambio = false; for (const e of aut.aristas) if (co.has(e.a) && !co.has(e.de)) { co.add(e.de); cambio = true; } }
      return { aut, dist, palabra, co };
    }
    function dibujar() {
      lienzo.limpiar();
      info = analizar();
      const { aut, dist, palabra, co } = info;
      geo = A.dibujar(lienzo, aut, {
        nodo: (q) => (dist[q] === null ? { relleno: C.neutro, borde: C.inactivo, tinta: C.inactivo } : co.has(q) ? { relleno: VIZ.alfa(C.s6, 0.28), borde: C.s6, ancho: 2.5 } : { relleno: VIZ.alfa(C.s8, 0.28), borde: C.s8, ancho: 2.5 }),
        arista: (de, a) => (dist[de] === null ? { color: C.inactivo, ancho: 1.5, guiones: [4, 3] } : null),
      });
      const utiles = aut.nombres.filter((_, q) => dist[q] !== null && co.has(q)).length;
      const acepta = [...aut.fin].filter((q) => dist[q] !== null).map((q) => ({ q, w: palabra[q], d: dist[q] })).sort((x, y) => x.d - y.d)[0];
      registro.textContent = acepta ? `L(A) no es vacío: la palabra más corta aceptada es «${acepta.w || 'ε'}» (longitud ${acepta.d} < n = ${aut.n}). Basta con buscar entre las palabras de longitud menor que el número de estados.` : 'L(A) es vacío: ningún estado de aceptación es alcanzable desde el inicial.';
      lectura.set([['estados', String(aut.n)], ['alcanzables', String(dist.filter((d) => d !== null).length)], ['inalcanzables', String(dist.filter((d) => d === null).length)], ['muertos (alcanzables)', String(aut.nombres.filter((_, q) => dist[q] !== null && !co.has(q)).length)], ['útiles', String(utiles)], ['¿L(A) vacío?', acepta ? 'no' : 'sí']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y); if (q < 0) return; if (fin.has(q)) fin.delete(q); else fin.add(q); dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y);
      if (q < 0 || !info) return tip.ocultar();
      tip.mostrar(x, y, `<b>${info.aut.nombres[q]}</b>${fin.has(q) ? ' · aceptación' : ''}<br>${info.dist[q] === null ? 'no se alcanza desde q0' : `se alcanza con «${info.palabra[q] || 'ε'}» (longitud ${info.dist[q]})`}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('regular-decision', {
    intro: String.raw`
      <p>Una gran ventaja de los lenguajes regulares es que muchas preguntas sobre ellos <strong>se pueden responder siempre</strong>, con un algoritmo: ¿acepta el autómata alguna palabra? ¿dos expresiones describen el mismo lenguaje? ¿un lenguaje está contenido en otro?</p>
      <p>Todas se reducen a una pregunta de alcanzabilidad en un grafo. Si la respuesta es «hay una palabra», el algoritmo entrega además un <em>testigo</em> (o un <em>contraejemplo</em>), que es la mejor explicación posible.</p>`,
    visualizaciones: [
      {
        titulo: 'Testigos en el autómata producto',
        descripcion: 'Escriba dos expresiones y elija la pregunta. La búsqueda en anchura recorre los pares de estados hasta hallar una palabra testigo, que además es la más corta.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Alcanzabilidad y estados muertos',
        descripcion: 'Clasifique los estados en útiles, muertos e inalcanzables, y alterne estados finales con un clic para ver cuándo el lenguaje se vacía.',
        montar: montarAlcanzabilidad,
      },
    ],
    teoria: String.raw`
      <h2>Vacuidad</h2>
      <p>\(L(M) \neq \varnothing\) si y solo si algún estado de \(F\) es alcanzable desde \(q_0\). Se resuelve con una búsqueda en anchura sobre el diagrama en \(O(|Q| + |\delta|)\), sin mirar las etiquetas. Si \(L(M) \ne \varnothing\), la palabra más corta aceptada tiene longitud menor que \(|Q|\) (el camino no repite estados).</p>
      <h2>Equivalencia e inclusión</h2>
      <p>Para AFD completos \(M_1, M_2\):</p>
      \[ L(M_1) \subseteq L(M_2) \iff L(M_1) \cap \overline{L(M_2)} = \varnothing, \qquad L(M_1) = L(M_2) \iff L(M_1) \triangle L(M_2) = \varnothing. \]
      <p>Se construye el <a href="tema.html?id=dfa-product">producto</a> con los pares de aceptación adecuados y se aplica la prueba de vacuidad. El costo es \(O(|Q_1||Q_2||\Sigma|)\). Si los autómatas son AFN o expresiones, primero se determinizan: el problema es <strong>PSPACE-completo</strong> y se resuelve en la práctica con la construcción de subconjuntos «perezosa».</p>
      <div class="recuadro"><p><strong>Alternativa.</strong> Dos AFD mínimos son equivalentes si y solo si son isomorfos (<a href="tema.html?id=dfa-minimization">DFA Minimization</a>). También sirve el algoritmo de Hopcroft-Karp, que usa unión-búsqueda sobre pares de estados y es casi lineal.</p></div>
      <h2>Otras propiedades decidibles</h2>
      <table>
        <tr><th>Pregunta</th><th>Cómo se decide</th></tr>
        <tr><td>¿\(w \in L\)?</td><td>simular, \(O(|w|)\) en un AFD</td></tr>
        <tr><td>¿\(L\) es finito?</td><td>no hay ciclo en un estado útil (alcanzable y desde el cual se llega a \(F\))</td></tr>
        <tr><td>¿\(L = \Sigma^*\)?</td><td>\(\overline{L} = \varnothing\)</td></tr>
        <tr><td>¿\(L_1 \cap L_2 = \varnothing\)?</td><td>producto + vacuidad</td></tr>
      </table>
      <h2>Contraste</h2>
      <p>Para lenguajes libres de contexto la vacuidad y la pertenencia se deciden, pero la equivalencia y la universalidad <strong>no</strong>. Esta es una razón práctica de peso para preferir lenguajes regulares cuando bastan.</p>`,
  });
})();
