(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = Object.assign({}, A.ejemplosAFN, {
    'a-o-b-final': { nombre: 'Penúltimo símbolo es a', alf: ['a', 'b'],
      aut: A.construir({ n: 3, ini: [0], fin: [2], trans: [[0, ['a', 'b'], 0], [0, 'a', 1], [1, ['a', 'b'], 2]], pos: [[0, 0.5], [0.5, 0.5], [1, 0.5]] }) },
  });
  const CLAVES = Object.keys(E);

  /* ---------- Fig. 1: determinización paso a paso ---------- */

  function montarPasos(cuerpo) {
    let k = 'tercero-final', paso = 0, res = null, parcial = null, geoD = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'AFN', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 700 ? 520 : 330) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'subconjunto que se procesa (y sus estados en el AFN)' },
      { color: VIZ.alfa(C.s4, 0.5), borde: C.s4, texto: 'subconjunto nuevo, en la cola' },
      { color: C.s2, texto: 'transición recién calculada', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada estado del AFD es un subconjunto de estados del AFN. Por cada subconjunto y cada símbolo se calcula a dónde pueden ir <em>todos</em> sus estados a la vez; si el resultado es nuevo, se agrega a la cola.');

    function iniciar() {
      res = A.determinizar(E[k].aut);
      paso = 0;
      return (function* () { for (let i = 0; i < res.pasos.length; i++) { paso = i + 1; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, nfa = E[k].aut, vert = W < 700;
      lienzo.limpiar();
      const pasos = res.pasos.slice(0, paso), ult = pasos[pasos.length - 1];
      const descubiertos = [0];
      pasos.forEach((p) => { if (p.nuevo) descubiertos.push(p.a); });
      const idx = new Map(descubiertos.map((s, i) => [s, i]));
      parcial = A.construir({
        n: descubiertos.length, nombres: descubiertos.map((s) => res.dfa.nombres[s]), alf: res.dfa.alf, ini: [0],
        fin: descubiertos.map((s, i) => (res.dfa.fin.has(s) ? i : -1)).filter((i) => i >= 0), trans: pasos.map((p) => [idx.get(p.de), p.s, idx.get(p.a)]),
      });
      const act = ult ? res.subs[ult.de] : res.subs[0];
      const mitad = vert ? { x: 0, y: 0, w: W, h: H / 3 } : { x: 0, y: 0, w: W * 0.4, h: H };
      const otra = vert ? { x: 0, y: H / 3, w: W, h: (H * 2) / 3 } : { x: W * 0.4, y: 0, w: W * 0.6, h: H };
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('AFN', mitad.x + 6, mitad.y + 4); ctx.fillText('AFD en construcción', otra.x + 6, otra.y + 4);
      A.dibujar(lienzo, nfa, { caja: mitad, radio: 14, nodo: A.estiloConjunto(act, { color: C.s1 }) });
      const enCola = new Set(descubiertos.map((s, i) => (ult && s !== ult.de && !pasos.some((p) => p.de === s) ? i : -1)).filter((i) => i >= 0));
      const idAct = ult ? idx.get(ult.de) : 0;
      geoD = A.dibujar(lienzo, parcial, {
        caja: { x: otra.x, y: otra.y + 14, w: otra.w, h: otra.h - 14 }, radio: 18,
        nodo: (q) => (q === idAct ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 3 } : enCola.has(q) ? { relleno: VIZ.alfa(C.s4, 0.5), borde: C.s4, ancho: 2 } : null),
        arista: (de, a, sims) => (ult && idx.get(ult.de) === de && idx.get(ult.a) === a && sims.includes(ult.s) ? { color: C.s2, ancho: 3 } : null),
      });
      // tabla de subconjuntos
      const alf = res.dfa.alf;
      tabla.replaceChildren(VIZ.el('tr', null, VIZ.el('th', null, 'subconjunto'), alf.map((s) => VIZ.el('th', null, s))),
        ...descubiertos.map((s, i) => VIZ.el('tr', { class: i === idAct ? 'activa' : null },
          VIZ.el('td', { class: 'izq' }, (i === 0 ? '→ ' : '') + (res.dfa.fin.has(s) ? '* ' : '') + res.dfa.nombres[s]),
          alf.map((sym) => { const p = pasos.find((x) => x.de === s && x.s === sym); return VIZ.el('td', { class: p ? null : 'vacia' }, p ? res.dfa.nombres[p.a] : '…'); }))));
      registro.textContent = ult
        ? `δ(${res.dfa.nombres[ult.de]}, ${ult.s}) = ${A.nombreConj(nfa, ult.T)} — ${ult.nuevo ? 'subconjunto nuevo: se agrega al AFD.' : 'ya existe: solo se agrega la transición.'}`
        : `El estado inicial del AFD es el subconjunto de los iniciales del AFN: ${res.dfa.nombres[0]}.`;
      lectura.set([['estados del AFN', String(nfa.n)], ['estados del AFD (hasta ahora)', String(parcial.n)], ['cota 2ⁿ', String(Math.pow(2, nfa.n))], ['pasos', `${paso} de ${res.pasos.length}`]]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = geoD ? A.nodoEn(geoD, x, y) : -1;
      if (q < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${parcial.nombres[q]}</b>${parcial.fin.has(q) ? '<br>contiene un estado final del AFN' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: subconjuntos alcanzables frente a 2ⁿ ---------- */

  function montarAlcanzables(cuerpo) {
    let k = 'aa-o-bb', sel = -1, celdas = [], res = null, palabras = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'AFN', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; sel = -1; recomputar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const n = E[k].aut.n, cols = Math.max(2, Math.floor(w / 120)); return 20 + Math.ceil(Math.pow(2, n) / cols) * 38 + 10; } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'subconjunto alcanzable (con la palabra más corta que lo produce)' },
      { color: C.neutro, borde: C.rejilla, texto: 'subconjunto que nunca aparece' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'alcanzable y de aceptación' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se muestran los 2ⁿ subconjuntos posibles de estados del AFN. La construcción por subconjuntos crea solo los alcanzables; a menudo son muchos menos que 2ⁿ. Haga clic en uno para ver con qué palabra se llega.');

    function recomputar() {
      res = A.determinizar(E[k].aut);
      palabras = [''];
      res.pasos.forEach((p) => { if (p.nuevo) palabras[p.a] = palabras[p.de] + p.s; });
      lienzo.ajustar(true);
    }
    const clave = (S) => A.ord(S).join(',');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, nfa = E[k].aut, n = nfa.n, total = Math.pow(2, n);
      lienzo.limpiar();
      const alc = new Map(res.subs.map((S, i) => [clave(S), i]));
      const cols = Math.max(2, Math.floor(W / 120)), cw = (W - 8) / cols;
      celdas = [];
      for (let m = 0; m < total; m++) {
        const S = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => m & (1 << i)));
        const i = alc.get(clave(S)), cx = 4 + (m % cols) * cw, cy = 8 + Math.floor(m / cols) * 38;
        const fin = A.hayFinal(nfa, S), col = i === undefined ? C.rejilla : fin ? C.s6 : C.s1;
        ctx.fillStyle = i === undefined ? C.neutro : VIZ.alfa(col, 0.28); ctx.strokeStyle = i === sel ? C.tinta : col; ctx.lineWidth = i !== undefined && i === sel ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(cx + 2, cy, cw - 4, 32, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = i === undefined ? C.inactivo : C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(A.nombreConj(nfa, S), cx + cw / 2, cy + (i === undefined ? 16 : 10), cw - 8);
        if (i !== undefined) { ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText('«' + (palabras[i] || 'ε') + '»', cx + cw / 2, cy + 23, cw - 8); }
        celdas.push({ x: cx + 2, y: cy, w: cw - 4, h: 32, i, S, fin });
      }
      registro.textContent = sel >= 0 ? `El subconjunto ${res.dfa.nombres[sel]} se alcanza leyendo «${palabras[sel] || 'ε'}», y nunca con una palabra más corta.` : `Alcanzables: ${res.dfa.n} de ${total} posibles (${VIZ.fmt((100 * res.dfa.n) / total, 3)} %).`;
      lectura.set([['estados del AFN', String(n)], ['subconjuntos posibles 2ⁿ', String(total)], ['alcanzables', String(res.dfa.n)], ['de aceptación', String(res.dfa.fin.size)]]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const hallar = (ev) => { const { x, y } = lienzo.posicion(ev); return celdas.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); };
    lienzo.canvas.addEventListener('click', (ev) => { const c = hallar(ev); sel = c && c.i !== undefined ? c.i : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const c = hallar(ev), { x, y } = lienzo.posicion(ev);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `<b>${A.nombreConj(E[k].aut, c.S)}</b><br>${c.i === undefined ? 'no es alcanzable' : 'alcanzable con «' + (palabras[c.i] || 'ε') + '»'}${c.fin ? '<br>contiene un estado final' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recomputar();
  }

  VIZ.registrarTema('subset-construction', {
    intro: String.raw`
      <p>Para simular un AFN sin adivinar basta con llevar la cuenta de <strong>todos los estados en que podría estar</strong> después de cada símbolo. Ese conjunto es una fotografía completa de la situación: lo que pueda pasar en el futuro depende solo de él.
      Tratar cada posible conjunto como un estado nuevo da un autómata <em>determinista</em>.</p>
      <p>Esa es la <strong>construcción por subconjuntos</strong>. Siempre funciona; su costo es que el AFD puede tener hasta \(2^n\) estados si el AFN tenía \(n\), aunque en muchos autómatas se alcanzan solo unos pocos.</p>`,
    visualizaciones: [
      {
        titulo: 'Determinizar paso a paso',
        descripcion: 'Avance con «Un paso»: cada paso calcula el destino de un subconjunto con un símbolo. Observe a la izquierda qué estados del AFN componen el subconjunto actual.',
        montar: montarPasos,
      },
      {
        titulo: 'Subconjuntos alcanzables frente a 2ⁿ',
        descripcion: 'De todos los subconjuntos de estados posibles, solo algunos aparecen. Haga clic en uno alcanzable para ver la palabra más corta que lleva a él.',
        montar: montarAlcanzables,
      },
    ],
    teoria: String.raw`
      <h2>Construcción</h2>
      <p>Dado un AFN \(N = (Q, \Sigma, \delta, I, F)\) sin ε-transiciones, se define el AFD \(D = (2^Q, \Sigma, \delta_D, I, F_D)\) con</p>
      \[ \delta_D(S, a) = \bigcup_{q \in S} \delta(q, a), \qquad F_D = \{ S \subseteq Q : S \cap F \neq \varnothing \}. \]
      <p>Si el AFN tiene ε-transiciones, se usa \(\delta_D(S, a) = \varepsilon\text{-clausura}\bigl(\bigcup_{q\in S}\delta(q,a)\bigr)\) y el estado inicial es la ε-clausura de \(I\)
      (<a href="tema.html?id=epsilon-nfa">ε-NFA and ε-Closure</a>).</p>
      <pre><code>cola ← [ I ];  visitados ← { I }
mientras cola no vacía:
    S ← sacar(cola)
    para cada símbolo a de Σ:
        T ← ⋃ δ(q, a) para q ∈ S
        si T ∉ visitados: agregar T a visitados y a cola
        δD(S, a) ← T</code></pre>
      <h2>Corrección</h2>
      <p>Por inducción sobre \(|w|\) se demuestra \(\hat\delta_D(I, w) = \hat\delta_N(I, w)\): el estado del AFD es exactamente el conjunto de estados en que puede estar el AFN. Luego \(w\) lo acepta el AFD si y solo si ese conjunto corta a \(F\), es decir, si el AFN tiene una ejecución aceptante.
      De aquí: <strong>AFD y AFN reconocen los mismos lenguajes</strong>.</p>
      <h2>Costo</h2>
      <ul>
        <li>Cota superior: \(2^n\) estados (el conjunto potencia). Se construyen solo los <em>alcanzables</em>, que a menudo son pocos.</li>
        <li>Tiempo: \(O(|\Sigma| \cdot m)\) para \(m\) subconjuntos alcanzables, más el costo de cada unión de conjuntos.</li>
        <li>La cota exponencial no se puede mejorar en general: ver <a href="tema.html?id=subset-blowup">State Explosion in Determinization</a>.</li>
        <li>El resultado no es necesariamente mínimo: se puede reducir después con <a href="tema.html?id=dfa-minimization">DFA Minimization</a>.</li>
      </ul>`,
  });
})();
