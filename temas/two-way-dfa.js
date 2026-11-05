(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const L = '⊢', R = '⊣';

  // Un 2AFD: δ(q, símbolo) = [q', 'L' | 'R']. Estados halt: 'acepta' y 'rechaza'. Posición 0 = ⊢, n + 1 = ⊣.
  const MAQ = {
    penultimo: {
      nombre: 'El penúltimo símbolo es a', alf: ['a', 'b'], palabra: 'abba', ini: 'q0',
      nombres: ['q0', 'q1', 'q2', 'q3', 'acepta', 'rechaza'],
      d: { [`q0,${L}`]: ['q1', 'R'], 'q1,a': ['q1', 'R'], 'q1,b': ['q1', 'R'], [`q1,${R}`]: ['q2', 'L'], 'q2,a': ['q3', 'L'], 'q2,b': ['q3', 'L'], [`q2,${L}`]: ['rechaza', 'R'], 'q3,a': ['acepta', 'R'], 'q3,b': ['rechaza', 'R'], [`q3,${L}`]: ['rechaza', 'R'] },
      f: (w) => w.length >= 2 && w[w.length - 2] === 'a',
      pos: [[0, 0.3], [0.25, 0.3], [0.5, 0.3], [0.75, 0.3], [1, 0.05], [1, 0.8]],
    },
    extremos: {
      nombre: 'Primer y último símbolo iguales', alf: ['a', 'b'], palabra: 'abaa', ini: 'q0',
      nombres: ['q0', 'qa', 'qb', 'ca', 'cb', 'acepta', 'rechaza'],
      d: {
        [`q0,${L}`]: ['q0', 'R'], 'q0,a': ['qa', 'R'], 'q0,b': ['qb', 'R'], [`q0,${R}`]: ['rechaza', 'R'],
        'qa,a': ['qa', 'R'], 'qa,b': ['qa', 'R'], [`qa,${R}`]: ['ca', 'L'], 'qb,a': ['qb', 'R'], 'qb,b': ['qb', 'R'], [`qb,${R}`]: ['cb', 'L'],
        'ca,a': ['acepta', 'R'], 'ca,b': ['rechaza', 'R'], 'cb,b': ['acepta', 'R'], 'cb,a': ['rechaza', 'R'],
      },
      f: (w) => w.length > 0 && w[0] === w[w.length - 1],
      pos: [[0, 0.35], [0.3, 0.05], [0.3, 0.7], [0.62, 0.05], [0.62, 0.7], [1, 0.05], [1, 0.8]],
    },
    rebote: {
      nombre: 'Rebota entre a y b (puede ciclar)', alf: ['a', 'b'], palabra: 'aab', ini: 'q0',
      nombres: ['q0', 'q1', 'q2', 'acepta', 'rechaza'],
      d: { [`q0,${L}`]: ['q1', 'R'], 'q1,a': ['q1', 'R'], 'q1,b': ['q2', 'L'], [`q1,${R}`]: ['acepta', 'R'], 'q2,a': ['q2', 'L'], [`q2,${L}`]: ['q1', 'R'] },
      f: (w) => !w.includes('b'),
      pos: [[0, 0.5], [0.4, 0.2], [0.4, 0.85], [1, 0.2], [1, 0.85]],
    },
  };
  const CLAVES = Object.keys(MAQ);

  // Autómata para dibujar: la etiqueta de cada arista es «símbolo/dirección».
  function aGrafo(m) {
    const idx = (nm) => m.nombres.indexOf(nm), trans = [];
    for (const [k, [q2, dir]] of Object.entries(m.d)) { const [q, s] = k.split(','); trans.push([idx(q), `${s}/${dir === 'L' ? '←' : '→'}`, idx(q2)]); }
    return A.construir({ n: m.nombres.length, nombres: m.nombres, alf: [], ini: [idx(m.ini)], fin: [idx('acepta')], trans, pos: m.pos });
  }
  // Ejecuta hasta que se detiene o repite una configuración.
  function ejecutar(m, w, tope = 400) {
    const cinta = [L, ...w, R], conf = [{ q: m.ini, i: 0 }], vistos = new Map([[m.ini + '|0', 0]]);
    let estado = 'corre';
    for (let paso = 0; paso < tope; paso++) {
      const { q, i } = conf[conf.length - 1];
      if (q === 'acepta' || q === 'rechaza') { estado = q; break; }
      const t = m.d[`${q},${cinta[i]}`];
      if (!t) { estado = 'rechaza'; conf.push({ q: 'rechaza', i, atascado: true }); break; }
      const ni = i + (t[1] === 'R' ? 1 : -1);
      if (ni < 0 || ni >= cinta.length) { estado = 'rechaza'; conf.push({ q: 'rechaza', i, atascado: true }); break; }
      const c = { q: t[0], i: ni, via: `${q},${cinta[i]}` };
      const k = c.q + '|' + c.i;
      conf.push(c);
      if (vistos.has(k)) { estado = 'ciclo'; break; }
      vistos.set(k, conf.length - 1);
    }
    return { conf, estado, cinta };
  }

  /* ---------- Fig. 1: la cabeza va y viene ---------- */

  function montarEjecucion(cuerpo) {
    let k = 'penultimo', palabra = MAQ[k].palabra, r = null, paso = 0, grafo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: '2AFD', opciones: CLAVES.map((c) => [c, MAQ[c].nombre]), valor: k, alCambiar: (v) => { k = v; palabra = MAQ[k].palabra; campo.valor = palabra; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'Palabra', valor: palabra, alCambiar: (v) => { palabra = v.replace(/[^ab]/g, '').slice(0, 14); rep.reiniciar(); }, alEnter: (v) => { palabra = v.replace(/[^ab]/g, '').slice(0, 14); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado actual' },
      { color: C.s2, texto: 'transición y celda leídas', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'acepta' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'rechaza o cicla' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La cinta lleva marcadores ⊢ y ⊣ en los extremos. Cada transición dice a qué estado ir y hacia dónde mover la cabeza (← o →). Pruebe «rebota» con una b: el autómata entra en un ciclo y nunca termina.');

    function iniciar() { r = ejecutar(MAQ[k], palabra); grafo = aGrafo(MAQ[k]); paso = 0; return (function* () { for (let i = 1; i < r.conf.length; i++) { paso = i; yield; } })(); }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, m = MAQ[k], c = r.conf[paso], cinta = r.cinta, fin = paso === r.conf.length - 1;
      lienzo.limpiar();
      const celda = Math.max(18, Math.min(34, Math.floor((W - 20) / cinta.length))), x0 = (W - celda * cinta.length) / 2;
      cinta.forEach((ch, i) => {
        const esM = i === 0 || i === cinta.length - 1, actual = i === c.i;
        ctx.fillStyle = esM ? C.neutro : C.superficie; ctx.strokeStyle = actual ? C.s2 : C.rejilla; ctx.lineWidth = actual ? 3 : 1;
        ctx.fillRect(x0 + i * celda, 26, celda, celda); ctx.strokeRect(x0 + i * celda + 0.5, 26.5, celda - 1, celda - 1);
        ctx.fillStyle = esM ? C.apagado : C.tinta; ctx.font = VIZ.fuente(14, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ch, x0 + i * celda + celda / 2, 26 + celda / 2 + 0.5);
      });
      const hx = x0 + c.i * celda + celda / 2;
      ctx.fillStyle = C.s2; ctx.beginPath(); ctx.moveTo(hx, 26 + celda + 3); ctx.lineTo(hx - 6, 26 + celda + 12); ctx.lineTo(hx + 6, 26 + celda + 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText(c.q, hx, 26 + celda + 24);
      // historial de posiciones
      const yh = 26 + celda + 40;
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('recorrido de la cabeza (posición en cada paso):', 8, yh);
      const tr = r.conf.slice(0, paso + 1).map((q) => q.i);
      let txt = tr.join(' → '); if (txt.length > 90) txt = '… ' + txt.slice(-88);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 500); ctx.fillText(txt, 8, yh + 14);
      const ult = c.via, col = fin ? (r.estado === 'acepta' ? C.s6 : C.s8) : C.s1;
      const idx = m.nombres.indexOf(c.q);
      A.dibujar(lienzo, grafo, {
        caja: { x: 0, y: yh + 24, w: W, h: lienzo.alto - yh - 24 }, radio: 15, maxEtiqueta: 16,
        nodo: (q) => (q === idx ? { relleno: VIZ.alfa(col, 0.28), borde: col, ancho: 3 } : null),
        arista: (de, a, sims) => (ult && m.nombres[de] === ult.split(',')[0] && m.nombres[a] === c.q && sims.some((s) => s.startsWith(ult.split(',')[1] + '/')) ? { color: C.s2, ancho: 3 } : null),
      });
      registro.textContent = paso === 0 ? `Configuración inicial: estado ${m.ini}, cabeza en ⊢ (posición 0).` : c.atascado ? 'No hay transición definida: el autómata se detiene y rechaza.' : `Paso ${paso}: ${c.via.replace(',', ' leyendo ')} → ${c.q}, cabeza en la posición ${c.i}.${fin && r.estado === 'ciclo' ? ' Configuración repetida: el autómata ciclará para siempre (rechaza).' : ''}`;
      lectura.set([['pasos', String(paso)], ['estado', c.q], ['posición de la cabeza', String(c.i)], ['veredicto', fin ? (r.estado === 'acepta' ? 'acepta' : r.estado === 'ciclo' ? 'cicla (rechaza)' : 'rechaza') : 'en curso'], ['coincide con la definición', fin && m.f && r.estado !== 'ciclo' ? (m.f(palabra) === (r.estado === 'acepta') ? 'sí' : 'no') : '—']]);
    }
    lienzo.alDibujar = () => r && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: pasos del 2AFD frente a un AFD ---------- */

  function montarPasos(cuerpo) {
    let k = 'penultimo', datos = [], hover = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: '2AFD', opciones: CLAVES.map((c) => [c, MAQ[c].nombre]), valor: k, alCambiar: (v) => { k = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'pasos de un AFD: n', forma: 'linea' },
      { color: C.s2, texto: 'pasos del 2AFD en el peor caso medido', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El 2AFD recorre la entrada varias veces, así que gasta más pasos; a cambio puede necesitar menos estados. Ambos reconocen los mismos lenguajes (regulares).');
    function calcular() {
      const m = MAQ[k], rnd = VIZ.semilla(7);
      datos = [];
      for (let n = 1; n <= 16; n++) {
        let mx = 0;
        for (let t = 0; t < 40; t++) { const w = Array.from({ length: n }, () => (rnd() < 0.5 ? 'a' : 'b')).join(''); mx = Math.max(mx, ejecutar(m, w).conf.length - 1); }
        datos.push([n, mx]);
      }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 16, ymin: 0, ymax: Math.ceil(Math.max(...datos.map((d) => d[1]), 16) / 10) * 10 }, { etiquetaX: 'longitud de la palabra n', etiquetaY: 'pasos' });
      plano.ejes();
      VIZ.trazar(ctx, plano, datos.map(([n]) => [n, n]), C.s1, 2);
      VIZ.trazar(ctx, plano, datos, C.s2, 2);
      if (hover) { const d = datos[hover - 1]; VIZ.marcador(ctx, plano.sx(hover), plano.sy(d[1]), C.s2, 4); VIZ.marcador(ctx, plano.sx(hover), plano.sy(hover), C.s1, 4); }
      const m = MAQ[k], ult = datos[datos.length - 1];
      lectura.set([['estados del 2AFD (sin halt)', String(m.nombres.length - 2)], ['pasos del 2AFD, n = 16', String(ult[1])], ['pasos del AFD, n = 16', '16'], ['¿puede ciclar?', k === 'rebote' ? 'sí (no termina con una b)' : 'no']]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(16, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'AFD', hover) + VIZ.filaTooltip(C.s2, '2AFD (peor medido)', datos[hover - 1][1]));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('two-way-dfa', {
    intro: String.raw`
      <p>Un autómata finito normal lee su entrada una sola vez, de izquierda a derecha, y no puede volver atrás. Un <strong>autómata de dos direcciones</strong> (2AFD) puede mover su cabeza lectora también hacia la izquierda: puede ir al final de la palabra, regresar, releer.</p>
      <p>Parece una ventaja grande, y sin embargo <strong>no reconoce más lenguajes</strong>: solo los regulares. Lo que cambia es el costo: un 2AFD puede ser bastante más pequeño que cualquier AFD equivalente, a cambio de leer más veces la entrada.</p>`,
    visualizaciones: [
      {
        titulo: 'La cabeza va y viene',
        descripcion: 'Ejecute un 2AFD sobre una palabra con marcadores ⊢ y ⊣. Observe el recorrido de la cabeza y pruebe «rebota» con una b para ver un ciclo infinito.',
        montar: montarEjecucion,
      },
      {
        titulo: 'Pasos del 2AFD frente al AFD',
        descripcion: 'Un AFD siempre usa n pasos; un 2AFD puede usar más porque relee. Compare el peor caso medido sobre palabras aleatorias.',
        montar: montarPasos,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un 2AFD es \(M = (Q, \Sigma, \delta, q_0, q_{\text{acepta}}, q_{\text{rechaza}})\) que trabaja sobre la cinta \(\vdash w \dashv\) con marcadores en los extremos, y una función de transición</p>
      \[ \delta : Q \times (\Sigma \cup \{\vdash, \dashv\}) \to Q \times \{\leftarrow, \rightarrow\}. \]
      <p>Una <strong>configuración</strong> es un par \((q, i)\) con \(0 \le i \le |w|+1\): el estado y la posición de la cabeza. Un paso lee la celda \(i\), cambia de estado y se mueve a \(i \pm 1\). Hay tres desenlaces: llega a \(q_{\text{acepta}}\), llega a \(q_{\text{rechaza}}\), o <em>cicla</em> sin terminar nunca.</p>
      <h2>Detectar ciclos</h2>
      <p>Hay \(|Q|(|w|+2)\) configuraciones posibles. Si el cómputo supera ese número de pasos, alguna se repitió, y como \(\delta\) es determinista, se repetirá para siempre: la palabra no se acepta. Por eso el lenguaje de un 2AFD se define como las palabras que llevan a \(q_{\text{acepta}}\), y siempre se puede decidir en tiempo \(O(|Q|\cdot|w|)\).</p>
      <h2>Equivalencia con los AFD</h2>
      <div class="recuadro"><p><strong>Teorema (Rabin-Scott, Shepherdson).</strong> Los 2AFD (y los 2AFN) reconocen exactamente los lenguajes regulares.</p></div>
      <p>Idea de la demostración: se resume el comportamiento del autómata sobre un prefijo \(u\) con una <em>tabla de comportamiento</em> que, para cada estado con que la cabeza entra de nuevo a \(u\) desde la derecha, dice con qué estado sale por la derecha (o si cicla o acepta). Hay a lo más \((|Q|+1)^{|Q|}\) tablas, y la tabla de \(ua\) se calcula solo con la de \(u\) y el símbolo \(a\): esas tablas son los estados de un AFD equivalente.</p>
      <h2>Costo</h2>
      <table>
        <tr><th>Modelo</th><th>Pasos por palabra</th><th>Estados para un lenguaje dado</th></tr>
        <tr><td>AFD</td><td>exactamente \(n\)</td><td>los del mínimo</td></tr>
        <tr><td>2AFD</td><td>hasta \(O(|Q|\,n)\) antes de repetir una configuración</td><td>pueden ser exponencialmente menos que un AFD (\(2^{\Theta(n\log n)}\) en el peor caso para la conversión)</td></tr>
      </table>
      <h2>Para qué sirven</h2>
      <p>Modelan el procesamiento de documentos en que se necesita leer el principio y el final (comparar los extremos), y son la base de resultados sobre la complejidad de descripción de lenguajes regulares. Los AFN de dos direcciones también son regulares, pero la pregunta de si 2AFD y 2AFN tienen el mismo tamaño (la <em>conjetura de Sakoda-Sipser</em>) sigue abierta.</p>
      <p>Para una lectura rápida, siempre en una sola dirección, vea <a href="tema.html?id=dfa-basics">Deterministic Finite Automata</a>.</p>`,
  });
})();
