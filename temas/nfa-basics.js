(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.ejemplosAFN;
  const CLAVES = Object.keys(E);
  const PALABRAS = { 'tercero-final': '0110', 'aa-o-bb': 'abab', 'termina-aba': 'abaaba', 'dos-iniciales': 'baba' };

  /* ---------- Fig. 1: conjunto de estados activos ---------- */

  function montarConjuntos(cuerpo) {
    A.figuraEjecucion(cuerpo, {
      ejemplos: CLAVES.map((k) => ({ nombre: E[k].nombre, aut: E[k].aut, palabra: PALABRAS[k] })),
      tabla: true,
      alto: 230,
      nota: 'En un AFN la máquina está, a la vez, en un <em>conjunto</em> de estados. Si algún estado de ese conjunto es de aceptación al terminar, la palabra se acepta. Pruebe «dos estados iniciales».',
    });
  }

  /* ---------- Fig. 2: árbol de ejecuciones ---------- */

  function construirArbol(aut, w, tope = 300) {
    let cnt = 0;
    function rec(q, i) {
      cnt++;
      const nodo = { q, i, h: [] };
      if (i === w.length) { nodo.fin = aut.fin.has(q); nodo.ruta = nodo.fin; return nodo; }
      const sig = aut.aristas.filter((e) => e.de === q && e.s === w[i]);
      if (!sig.length) { nodo.muerto = true; return nodo; }
      for (const e of sig) if (cnt < tope) nodo.h.push(rec(e.a, i + 1));
      nodo.ruta = nodo.h.some((x) => x.ruta);
      return nodo;
    }
    const raices = aut.ini.map((q) => rec(q, 0));
    return { raices, cortado: cnt >= tope, total: cnt };
  }

  function montarArbol(cuerpo) {
    let k = 'tercero-final', w = '10110', solo = false, arb = null, nodos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; w = PALABRAS[v]; campo.valor = w; recomputar(); } });
    const campo = ctl.texto({ etiqueta: 'Palabra (hasta 9 símbolos)', valor: w, alCambiar: (v) => { w = v.replace(/\s/g, '').slice(0, 9); recomputar(); }, alEnter: (v) => { w = v.replace(/\s/g, '').slice(0, 9); recomputar(); } });
    ctl.casilla({ etiqueta: 'Mostrar solo los caminos que aceptan', valor: solo, alCambiar: (v) => { solo = v; recomputar(); } });
    let nHojas = 1;
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => Math.max(200, 50 + nHojas * 24) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'termina en aceptación' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'se bloquea (sin transición) o termina rechazando' },
      { color: C.s6, texto: 'camino que lleva a aceptar', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada ramificación es una elección del autómata. Basta con que <em>una</em> rama acepte para que la palabra pertenezca al lenguaje. Pase el cursor sobre un nodo para ver su prefijo leído.');

    function recomputar() {
      arb = construirArbol(E[k].aut, w);
      let n = 0;
      const rec = (x) => { if (solo && !x.ruta) return; if (!x.h.length || (solo && !x.h.some((y) => y.ruta))) n++; else x.h.forEach(rec); };
      arb.raices.forEach(rec);
      nHojas = Math.max(1, n);
      lienzo.ajustar(true);
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, aut = E[k].aut;
      lienzo.limpiar();
      const dx = Math.min(80, (W - 70) / Math.max(1, w.length)), x0 = 36;
      ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.apagado; ctx.fillText('ε', x0, 10);
      [...w].forEach((c, i) => { ctx.fillStyle = C.tinta2; ctx.fillText(c, x0 + (i + 0.5) * dx, 10); });
      let fila = 0;
      nodos = [];
      const colocar = (x) => {
        if (solo && !x.ruta) return null;
        const hijos = x.h.map(colocar).filter(Boolean);
        x._h = hijos;
        x._y = hijos.length ? (hijos[0]._y + hijos[hijos.length - 1]._y) / 2 : 28 + fila++ * 24;
        x._x = x0 + x.i * dx;
        return x;
      };
      const raices = arb.raices.map(colocar).filter(Boolean);
      const pintar = (x) => {
        for (const h of x._h) {
          ctx.strokeStyle = h.ruta ? C.s6 : C.eje; ctx.lineWidth = h.ruta ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(x._x, x._y); ctx.lineTo(h._x, h._y); ctx.stroke();
          pintar(h);
        }
      };
      raices.forEach(pintar);
      const nodo = (x) => {
        const col = x.fin ? C.s6 : x.muerto || (x.i === w.length && !x.fin) ? C.s8 : C.tinta;
        const hoja = !x._h.length;
        ctx.fillStyle = hoja && col !== C.tinta ? VIZ.alfa(col, 0.28) : C.superficie; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x._x, x._y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (aut.fin.has(x.q)) { ctx.beginPath(); ctx.arc(x._x, x._y, 6.5, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(9, 600); ctx.fillText(aut.nombres[x.q], x._x, x._y + 0.5);
        if (x.muerto && !solo) { ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(12, 700); ctx.fillText('✗', x._x + 18, x._y); }
        nodos.push(x);
        x._h.forEach(nodo);
      };
      raices.forEach(nodo);
      const hojasT = [], rec = (x) => { if (!x.h.length) hojasT.push(x); else x.h.forEach(rec); };
      arb.raices.forEach(rec);
      const acept = hojasT.filter((x) => x.fin).length, bloq = hojasT.filter((x) => x.muerto).length;
      registro.textContent = acept ? `Hay ${acept} ejecución(es) que terminan en aceptación: la palabra «${w || 'ε'}» se acepta.` : `Ninguna de las ${hojasT.length} ejecuciones termina en aceptación: la palabra «${w || 'ε'}» se rechaza.${arb.cortado ? ' (Árbol recortado.)' : ''}`;
      lectura.set([['ejecuciones (hojas)', String(hojasT.length)], ['aceptan', String(acept)], ['se bloquean', String(bloq)], ['nodos del árbol', String(arb.total)], ['veredicto', acept ? 'acepta' : 'rechaza']]);
    }
    lienzo.alDibujar = () => arb && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = nodos.find((q) => Math.hypot(q._x - x, q._y - y) < 12);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `<b>${E[k].aut.nombres[n.q]}</b> tras leer «${w.slice(0, n.i) || 'ε'}»${n.muerto ? '<br>sin transición con «' + w[n.i] + '»' : ''}${n.fin ? '<br>estado de aceptación' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recomputar();
  }

  VIZ.registrarTema('nfa-basics', {
    intro: String.raw`
      <p>En un AFD cada símbolo lleva a un único estado. Un <strong>autómata finito no determinista</strong> (AFN) relaja esa regla: desde un estado, un mismo símbolo puede llevar a varios estados, a ninguno, o la máquina puede partir de varios estados iniciales.
      Se puede imaginar que el autómata «adivina» el camino correcto, o que explora todos a la vez.</p>
      <p>Una palabra se acepta si <em>existe</em> al menos una ejecución que la lee completa y termina en un estado de aceptación. Esto no da más poder: todo AFN se puede simular con un AFD, aunque quizás con muchos más estados.</p>`,
    visualizaciones: [
      {
        titulo: 'Estados activos a la vez',
        descripcion: 'Avance sobre una palabra y vea cómo el conjunto de estados activos crece, se reparte o se vacía. Acepta si al final hay algún estado final en el conjunto.',
        montar: montarConjuntos,
      },
      {
        titulo: 'Árbol de ejecuciones',
        descripcion: 'Cada ramificación es una elección no determinista. Pruebe palabras que aceptan por un solo camino y active «solo caminos que aceptan».',
        montar: montarArbol,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un AFN es \(N = (Q, \Sigma, \delta, I, F)\) con \(Q\), \(\Sigma\), \(F\) como en un AFD, un conjunto de estados iniciales \(I \subseteq Q\) (muchas definiciones piden uno solo) y la transición como relación:</p>
      \[ \delta : Q \times \Sigma \to \mathcal{P}(Q). \]
      <p>Se extiende a conjuntos y palabras: \(\hat\delta(S, \varepsilon) = S\) y \(\hat\delta(S, wa) = \bigcup_{q \in \hat\delta(S, w)} \delta(q, a)\). El lenguaje aceptado es</p>
      \[ L(N) = \{ w \in \Sigma^* : \hat\delta(I, w) \cap F \neq \varnothing \}. \]
      <h2>Ejecuciones y caminos de aceptación</h2>
      <p>Una <em>ejecución</em> sobre \(w = a_1\cdots a_n\) es una sucesión \(q_0, q_1, \dots, q_n\) con \(q_0 \in I\) y \(q_i \in \delta(q_{i-1}, a_i)\). Las ejecuciones forman un árbol; las que se bloquean mueren y la palabra se acepta si <strong>alguna</strong> hoja a profundidad \(n\) cae en \(F\).
      El número de ejecuciones puede crecer exponencialmente con \(n\), pero el conjunto de estados activos nunca supera \(|Q|\): ésa es la base de la simulación eficiente (ver <a href="tema.html?id=nfa-simulation">Simulating NFAs Efficiently</a>).</p>
      <h2>DFA frente a NFA</h2>
      <table>
        <tr><th></th><th>AFD</th><th>AFN</th></tr>
        <tr><td>transición</td><td>\(Q \times \Sigma \to Q\)</td><td>\(Q \times \Sigma \to \mathcal{P}(Q)\)</td></tr>
        <tr><td>ejecuciones por palabra</td><td>exactamente una</td><td>cero, una o muchas</td></tr>
        <tr><td>poder expresivo</td><td colspan="2">el mismo: los lenguajes regulares</td></tr>
        <tr><td>tamaño para un lenguaje</td><td>puede ser exponencial</td><td>suele ser menor</td></tr>
        <tr><td>complemento</td><td>intercambiar \(F\) y \(Q \setminus F\)</td><td>exige determinizar</td></tr>
      </table>
      <div class="recuadro"><p><strong>Equivalencia.</strong> Todo AFD es un AFN. Y todo AFN con \(n\) estados tiene un AFD equivalente con a lo más \(2^n\) estados, mediante la
      <a href="tema.html?id=subset-construction">construcción por subconjuntos</a>. La figura 1 es, en el fondo, esa construcción en acción.</p></div>`,
  });
})();
