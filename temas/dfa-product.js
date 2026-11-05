(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.ejemplos;
  const CLAVES = ['par-a', 'par-b', 'contiene-aba', 'no-bb', 'a-antes-b', 'mod3'];
  const OPS = {
    union: { nombre: 'unión A ∪ B', f: (x, y) => x || y, def: (a, b) => (w) => a(w) || b(w) },
    inter: { nombre: 'intersección A ∩ B', f: (x, y) => x && y, def: (a, b) => (w) => a(w) && b(w) },
    dif: { nombre: 'diferencia A ∖ B', f: (x, y) => x && !y, def: (a, b) => (w) => a(w) && !b(w) },
    sim: { nombre: 'diferencia simétrica A △ B', f: (x, y) => x !== y, def: (a, b) => (w) => a(w) !== b(w) },
  };
  const opciones = CLAVES.map((c) => [c, E[c].nombre]);

  /* ---------- Fig. 1: el autómata producto ---------- */

  function montarProducto(cuerpo) {
    let ka = 'par-a', kb = 'no-bb', op = 'inter', palabra = 'abbab', pos = 0, trazaA = [], trazaB = [], prod = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata A', opciones, valor: ka, alCambiar: (v) => { ka = v; recomputar(); } });
    ctl.selector({ etiqueta: 'Autómata B', opciones, valor: kb, alCambiar: (v) => { kb = v; recomputar(); } });
    ctl.selector({ etiqueta: 'Operación', opciones: Object.entries(OPS).map(([k, v]) => [k, v.nombre]), valor: op, alCambiar: (v) => { op = v; recomputar(); } });
    ctl.texto({ etiqueta: 'Palabra', valor: palabra, alCambiar: (v) => { palabra = v.replace(/[^ab]/g, ''); rep.reiniciar(); }, alEnter: (v) => { palabra = v.replace(/[^ab]/g, ''); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 60 + (prod && prod.dfa.n > 6 ? (w < 560 ? 340 : 290) : 220) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'par de estados actual (pA, pB)' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'termina en un par que acepta' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'termina en un par que rechaza' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada estado del producto es un par (estado de A, estado de B): el producto ejecuta A y B a la vez. Solo cambia qué pares aceptan: eso es la operación. Pase el cursor sobre un par.');

    function recomputar() { prod = A.producto(E[ka].aut, E[kb].aut, OPS[op].f); lienzo.ajustar(true); rep.reiniciar(); }
    function iniciar() {
      if (!prod) prod = A.producto(E[ka].aut, E[kb].aut, OPS[op].f);
      pos = 0;
      const d = prod.dfa, T = A.delta(d);
      trazaA = [prod.pares[d.ini[0]][0]]; trazaB = [prod.pares[d.ini[0]][1]]; trazaP = [d.ini[0]];
      return (function* () { for (const c of palabra) { const q = T[trazaP[pos]][d.alf.indexOf(c)]; trazaP.push(q); pos++; yield; } })();
    }
    let trazaP = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, d = prod.dfa, q = trazaP[pos];
      lienzo.limpiar();
      A.cinta(ctx, palabra, { x: 0, y: 6, ancho: W, actual: pos < palabra.length ? pos : -1 });
      const fin = pos === palabra.length, acepta = d.fin.has(q), col = fin ? (acepta ? C.s6 : C.s8) : C.s1;
      geo = A.dibujar(lienzo, d, {
        caja: { x: 0, y: 44, w: W, h: H - 44 },
        radio: d.n > 6 ? 17 : 19,
        nodo: (i) => (i === q ? { relleno: VIZ.alfa(col, 0.28), borde: col, ancho: 3 } : null),
        arista: (de, a, sims) => (pos > 0 && trazaP[pos - 1] === de && trazaP[pos] === a && sims.includes(palabra[pos - 1]) ? { color: C.s2, ancho: 3 } : null),
      });
      const [p, r] = prod.pares[q];
      const A_ = E[ka].aut, B_ = E[kb].aut, enA = A_.fin.has(p), enB = B_.fin.has(r);
      registro.textContent = `Par actual (${A_.nombres[p]}, ${B_.nombres[r]}): A ${enA ? 'acepta' : 'rechaza'}, B ${enB ? 'acepta' : 'rechaza'} → ${OPS[op].nombre} ${acepta ? 'acepta' : 'rechaza'}${fin ? ' (fin de la palabra)' : ''}.`;
      lectura.set([['estados de A × B', `${A.completar(A_).n} × ${A.completar(B_).n} = ${A.completar(A_).n * A.completar(B_).n}`], ['estados alcanzables del producto', String(d.n)], ['aceptan', String(d.fin.size)], ['leídos', `${pos} de ${palabra.length}`]]);
    }
    lienzo.alDibujar = () => prod && trazaP.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y);
      if (q < 0) return tip.ocultar();
      const [p, r] = prod.pares[q];
      tip.mostrar(x, y, `<b>${prod.dfa.nombres[q]}</b><br>A: ${E[ka].significado[p] || '—'}<br>B: ${E[kb].significado[r] || '—'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recomputar();
  }

  /* ---------- Fig. 2: tamaños y leyes de De Morgan ---------- */

  function montarLeyes(cuerpo) {
    let ka = 'contiene-aba', kb = 'par-b';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata A', opciones, valor: ka, alCambiar: (v) => { ka = v; actualizar(); } });
    ctl.selector({ etiqueta: 'Autómata B', opciones, valor: kb, alCambiar: (v) => { kb = v; actualizar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de texto';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'El producto de n y m estados tiene a lo más n·m; el mínimo suele ser menor. Las dos últimas filas verifican las leyes de De Morgan buscando una palabra donde los autómatas difieran (búsqueda en anchura).');

    function actualizar() {
      const a = E[ka].aut, b = E[kb].aut, filas = [VIZ.el('tr', null, ['Autómata', 'Alcanzables', 'Mínimo', 'Palabras ≤ 6'].map((t) => VIZ.el('th', null, t)))];
      const info = (nom, d) => { const mn = A.minimizar(d).min; filas.push(VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, nom), VIZ.el('td', null, String(A.podar(d).n)), VIZ.el('td', null, String(mn.n)), VIZ.el('td', null, String(A.conteo(d, 6).reduce((s, x) => s + x, 0))))); };
      info('A', a); info('B', b);
      info('complemento de A', A.complemento(a));
      for (const [k, o] of Object.entries(OPS)) info(o.nombre, A.producto(a, b, o.f).dfa);
      // De Morgan: ¬(A ∪ B) = ¬A ∩ ¬B  y  A ∖ B = A ∩ ¬B
      const u = A.producto(a, b, OPS.union.f).dfa;
      const izq = A.complemento(u), der = A.producto(A.complemento(a), A.complemento(b), OPS.inter.f).dfa;
      const t1 = A.buscarProducto(izq, der, (x, y) => x !== y);
      const t2 = A.buscarProducto(A.producto(a, b, OPS.dif.f).dfa, A.producto(a, A.complemento(b), OPS.inter.f).dfa, (x, y) => x !== y);
      filas.push(VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, '¬(A ∪ B) ≡ ¬A ∩ ¬B'), VIZ.el('td', { style: { color: t1.palabra === null ? C.s6 : C.s8, fontWeight: 700 }, colspan: 3 }, t1.palabra === null ? `equivalentes (${t1.visitados} pares recorridos)` : `difieren en «${t1.palabra}»`)));
      filas.push(VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'A ∖ B ≡ A ∩ ¬B'), VIZ.el('td', { style: { color: t2.palabra === null ? C.s6 : C.s8, fontWeight: 700 }, colspan: 3 }, t2.palabra === null ? `equivalentes (${t2.visitados} pares recorridos)` : `difieren en «${t2.palabra}»`)));
      tabla.replaceChildren(...filas);
      registro.textContent = `A = ${E[ka].nombre}; B = ${E[kb].nombre}. Los lenguajes regulares son cerrados bajo unión, intersección, complemento y diferencia: el resultado siempre es otro AFD.`;
    }
    actualizar();
  }

  VIZ.registrarTema('dfa-product', {
    intro: String.raw`
      <p>Si ya se tienen autómatas para dos lenguajes, ¿se puede construir uno para su unión o intersección? Sí, con el <strong>autómata producto</strong>: corre los dos a la vez, y su estado es el par de estados actuales.
      La única diferencia entre unión, intersección o diferencia es <em>qué pares</em> se declaran de aceptación.</p>
      <p>El <strong>complemento</strong> es aún más simple: en un AFD completo basta con intercambiar los estados de aceptación y de rechazo.</p>`,
    visualizaciones: [
      {
        titulo: 'El autómata producto en marcha',
        descripcion: 'Elija dos autómatas y una operación; el diagrama es el producto. Avance sobre una palabra y vea cómo se mueve el par (estado de A, estado de B).',
        montar: montarProducto,
      },
      {
        titulo: 'Tamaños y leyes de De Morgan',
        descripcion: 'Compare los estados de cada construcción y compruebe, buscando una palabra distinguidora, que \\(\\overline{A\\cup B} = \\overline{A}\\cap\\overline{B}\\).',
        montar: montarLeyes,
      },
    ],
    teoria: String.raw`
      <h2>Construcción del producto</h2>
      <p>Sean \(M_1 = (Q_1, \Sigma, \delta_1, p_0, F_1)\) y \(M_2 = (Q_2, \Sigma, \delta_2, r_0, F_2)\) AFD completos sobre el mismo alfabeto. El producto es \(M = (Q_1 \times Q_2,\ \Sigma,\ \delta,\ (p_0, r_0),\ F)\) con</p>
      \[ \delta((p, r), a) = (\delta_1(p, a), \delta_2(r, a)). \]
      <p>Por inducción sobre \(|w|\) se cumple \(\hat\delta((p_0, r_0), w) = (\hat\delta_1(p_0, w), \hat\delta_2(r_0, w))\). Por lo tanto, según el conjunto de aceptación \(F\):</p>
      <table>
        <tr><th>Operación</th><th>\(F\)</th><th>Lenguaje</th></tr>
        <tr><td>unión</td><td>\(F_1 \times Q_2 \;\cup\; Q_1 \times F_2\)</td><td>\(L_1 \cup L_2\)</td></tr>
        <tr><td>intersección</td><td>\(F_1 \times F_2\)</td><td>\(L_1 \cap L_2\)</td></tr>
        <tr><td>diferencia</td><td>\(F_1 \times (Q_2 \setminus F_2)\)</td><td>\(L_1 \setminus L_2\)</td></tr>
        <tr><td>dif. simétrica</td><td>\((F_1 \times \overline{F_2}) \cup (\overline{F_1} \times F_2)\)</td><td>\(L_1 \triangle L_2\)</td></tr>
      </table>
      <p>Solo hace falta construir los pares <em>alcanzables</em> desde \((p_0, r_0)\), a lo más \(|Q_1|\cdot|Q_2|\).</p>
      <h2>Complemento</h2>
      <p>Si \(M\) es un AFD <strong>completo</strong>, \(\overline{M} = (Q, \Sigma, \delta, q_0, Q \setminus F)\) reconoce \(\Sigma^* \setminus L(M)\). La completitud es imprescindible: si falta una transición, una palabra que «se cae» del autómata
      se rechaza en \(M\) y también en \(\overline{M}\). Con un AFN esto no funciona sin antes <a href="tema.html?id=subset-construction">determinizar</a>.</p>
      <h2>Consecuencias</h2>
      <ul>
        <li>La clase de lenguajes regulares es cerrada bajo \(\cup, \cap, \overline{\ \ }, \setminus, \triangle\).</li>
        <li>Con el producto se resuelven problemas de decisión: \(L_1 = L_2\) si y solo si \(L_1 \triangle L_2 = \varnothing\) (ver <a href="tema.html?id=regular-decision">Emptiness, Equivalence &amp; Inclusion</a>).</li>
        <li>Cota inferior: el producto necesita en el peor caso \(|Q_1|\cdot|Q_2|\) estados incluso tras minimizar.</li>
      </ul>`,
  });
})();
