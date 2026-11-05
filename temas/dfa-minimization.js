(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  // AFD con estados duplicados e inalcanzables: lenguaje «número par de a».
  const REDUNDANTE = A.desdeTabla({ nombres: ['q0', 'q1', 'q2', 'q3', 'q4'], alf: ['a', 'b'], tabla: [[1, 2], [0, 3], [3, 0], [2, 1], [0, 4]], ini: 0, fin: [0, 2],
    pos: [[0, 0.5], [0.4, 0.1], [0.4, 0.9], [0.8, 0.5], [1, 0.9]] });
  const desdeRegex = (re) => { const r = A.deRegex(re); if (r.error) return r; const d = A.determinizar(r.nfa).dfa; d.nombres = d.nombres.map((_, i) => 'q' + i); return { dfa: d }; };
  const PRESETS = [
    { id: 'red', nombre: 'Par de a (con estados repetidos)', dfa: REDUNDANTE },
    { id: 'r1', nombre: '(a|b)*abb', re: '(a|b)*abb' },
    { id: 'r2', nombre: '(a|b)*a(a|b)', re: '(a|b)*a(a|b)' },
    { id: 'r3', nombre: '(ab|a)*b?', re: '(ab|a)*b?' },
    { id: 'r4', nombre: '(aa|bb)*', re: '(aa|bb)*' },
  ];
  const PALETA = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s6, C.s7, C.s8];

  // Controles comunes: elegir un preset o escribir una expresión.
  function elegir(ctl, alCambiar) {
    let id = 'red', re = '(a|b)*abb';
    const cargar = () => {
      const p = PRESETS.find((q) => q.id === id);
      return p.dfa ? { dfa: p.dfa } : desdeRegex(p.re);
    };
    ctl.selector({ etiqueta: 'Autómata', opciones: PRESETS.map((p) => [p.id, p.nombre]).concat([['otro', 'Mi expresión regular…']]), valor: id, alCambiar: (v) => { id = v; if (v === 'otro') { campo.input.focus(); alCambiar(desdeRegex(re)); } else alCambiar(cargar()); } });
    const campo = ctl.texto({ etiqueta: 'Mi expresión', valor: re, alCambiar: (v) => { re = v; id = 'otro'; alCambiar(desdeRegex(re)); }, alEnter: (v) => { re = v; alCambiar(desdeRegex(re)); } });
    return cargar;
  }

  /* ---------- Fig. 1: refinamiento de la partición ---------- */

  function montarParticion(cuerpo) {
    let d = null, hist = [], ronda = 0, min = null, error = null, geoI = null, geoD = null;
    const ctl = VIZ.controles(cuerpo);
    const cargar = elegir(ctl, (r) => { fijar(r); rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 700 ? 520 : 300) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: PALETA[0], texto: 'cada color es una clase de la partición actual', forma: 'cuadro' },
      { color: C.neutro, borde: C.inactivo, texto: 'estado inalcanzable (se elimina primero)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ronda 0: finales frente a no finales. En cada ronda dos estados de una misma clase se separan si, con algún símbolo, van a clases distintas. Cuando una ronda no separa nada, las clases son los estados del autómata mínimo.');

    function fijar(r) {
      error = r.error || null;
      if (error) return;
      const m = A.minimizar(r.dfa);
      d = m.depurado; hist = m.hist; min = m.min;
      d.pos = r.dfa.pos && d.n === r.dfa.n ? r.dfa.pos : null;
      lienzo.ajustar(true);
    }
    function iniciar() {
      if (!d && !error) fijar(cargar());
      ronda = 0;
      return (function* () { for (let i = 1; i < hist.length; i++) { ronda = i; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, vert = W < 700;
      lienzo.limpiar();
      if (error) { ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`Error en la expresión: ${error}.`, 12, H / 2); registro.textContent = 'Corrija la expresión.'; return; }
      const cls = hist[ronda], total = new Set(cls).size, ultima = ronda === hist.length - 1;
      const izq = vert ? { x: 0, y: 14, w: W, h: H / 2 - 14 } : { x: 0, y: 14, w: W * 0.55, h: H - 14 }, der = vert ? { x: 0, y: H / 2 + 14, w: W, h: H / 2 - 14 } : { x: W * 0.55, y: 14, w: W * 0.45, h: H - 14 };
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`AFD (ronda ${ronda}: ${total} clases)`, izq.x + 6, izq.y - 12); ctx.fillText(ultima ? 'AFD mínimo' : 'AFD mínimo (al terminar)', der.x + 6, der.y - 12);
      const col = (c) => PALETA[c % PALETA.length];
      geoI = A.dibujar(lienzo, d, { caja: izq, radio: d.n > 8 ? 13 : 16, nodo: (q) => ({ relleno: VIZ.alfa(col(cls[q]), 0.3), borde: col(cls[q]), ancho: 2.5 }) });
      const tenue = !ultima;
      geoD = A.dibujar(lienzo, min, { caja: der, radio: 17, pildora: min.nombres.some((n) => n.length > 5), nodo: () => (tenue ? { borde: C.inactivo, tinta: C.inactivo } : null), arista: () => (tenue ? { color: C.rejilla } : null) });
      const grupos = new Map();
      cls.forEach((c, q) => { if (!grupos.has(c)) grupos.set(c, []); grupos.get(c).push(d.nombres[q]); });
      const texto = [...grupos.values()].map((g) => '{' + g.join(', ') + '}').join('  ');
      registro.textContent = ronda === 0 ? `Partición inicial: ${texto}.` : `Ronda ${ronda}: ${texto}.${ultima ? ' Ya no se separa nada: esta es la partición final.' : ''}`;
      lectura.set([['estados del AFD (alcanzables, completo)', String(d.n)], ['clases ahora', String(total)], ['estados del mínimo', String(min.n)], ['rondas hasta estabilizar', String(hist.length - 1)]]);
    }
    lienzo.alDibujar = () => (d || error) && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!d) return;
      const { x, y } = lienzo.posicion(ev), q = geoI ? A.nodoEn(geoI, x, y) : -1;
      if (q < 0) return tip.ocultar();
      const cls = hist[ronda], mismos = d.nombres.filter((_, j) => cls[j] === cls[q]);
      tip.mostrar(x, y, `<b>${d.nombres[q]}</b><br>clase ${cls[q] + 1}: {${mismos.join(', ')}}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    fijar(cargar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: tabla de pares distinguibles ---------- */

  function montarTabla(cuerpo) {
    let d = null, pal = null, maxR = 0, ronda = 0, error = null, celdas = [];
    const ctl = VIZ.controles(cuerpo);
    const cargar = elegir(ctl, (r) => { fijar(r); rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(w, 60 + (d ? d.n : 5) * 34) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.3)), texto: 'distinguible: se muestra la palabra más corta que los separa' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'equivalentes: ninguna palabra los separa (se fusionan)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ronda k marca los pares que se distinguen con una palabra de longitud k. La ronda 0 usa ε (uno acepta y el otro no); cada ronda siguiente propaga: (p, q) se marca si, con un símbolo a, δ(p, a) y δ(q, a) ya estaban marcados. Pase el cursor por una celda.');

    function fijar(r) {
      error = r.error || null;
      if (error) return;
      d = A.minimizar(r.dfa).depurado; pal = A.distinguir(d);
      maxR = 0;
      for (let i = 0; i < d.n; i++) for (let j = 0; j < d.n; j++) if (pal[i][j] !== null) maxR = Math.max(maxR, pal[i][j].length);
      lienzo.ajustar(true);
    }
    function iniciar() {
      if (!d && !error) fijar(cargar());
      ronda = -1;
      return (function* () { for (let r = 0; r <= maxR; r++) { ronda = r; yield; } ronda = maxR + 1; yield; })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      if (error) { ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`Error en la expresión: ${error}.`, 12, H / 2); return; }
      const n = d.n, lado = Math.min(54, (W - 70) / n, (H - 46) / n), x0 = (W - lado * n) / 2 + 22, y0 = 30;
      celdas = [];
      ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.tinta2;
      for (let i = 0; i < n; i++) { ctx.fillText(d.nombres[i], x0 + (i + 0.5) * lado, y0 - 12); ctx.textAlign = 'right'; ctx.fillText(d.nombres[i], x0 - 6, y0 + (i + 0.5) * lado); ctx.textAlign = 'center'; }
      let marcados = 0, total = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = x0 + j * lado, y = y0 + i * lado;
        if (j >= i) { ctx.fillStyle = C.neutro; ctx.fillRect(x, y, lado, lado); ctx.strokeStyle = C.rejilla; ctx.strokeRect(x + 0.5, y + 0.5, lado - 1, lado - 1); continue; }
        total++;
        const w = pal[i][j], visible = w !== null && w.length <= ronda, final = ronda > maxR;
        if (visible) marcados++;
        ctx.fillStyle = visible ? VIZ.css(VIZ.enRampa(0.15 + 0.55 * (w.length / Math.max(1, maxR)))) : final && w === null ? VIZ.alfa(C.s6, 0.28) : C.superficie;
        ctx.strokeStyle = final && w === null ? C.s6 : C.rejilla; ctx.lineWidth = final && w === null ? 2 : 1;
        ctx.fillRect(x, y, lado, lado); ctx.strokeRect(x + 0.5, y + 0.5, lado - 1, lado - 1);
        if (visible) { ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.fillText(w || 'ε', x + lado / 2, y + lado / 2, lado - 4); }
        else if (final && w === null) { ctx.fillStyle = C.s6; ctx.font = VIZ.fuente(14, 700); ctx.fillText('≡', x + lado / 2, y + lado / 2); }
        celdas.push({ x, y, w: lado, i, j, pal: w });
      }
      const eq = total - [...Array(n).keys()].reduce((s, i) => s + [...Array(i).keys()].filter((j) => pal[i][j] !== null).length, 0);
      registro.textContent = ronda < 0 ? 'Pulse «Un paso»: la ronda 0 marca los pares (final, no final).' : ronda > maxR ? `Fin: ${eq} par(es) quedan sin marcar; sus estados son equivalentes y se fusionan.` : ronda === 0 ? 'Ronda 0 (palabra ε): se marcan los pares donde uno acepta y el otro no.' : `Ronda ${ronda}: se marcan los pares que una palabra de longitud ${ronda} separa.`;
      lectura.set([['pares de estados', String(total)], ['marcados (distinguibles)', String(marcados)], ['sin marcar al final', ronda > maxR ? String(eq) : '…'], ['palabra distinguidora más larga', maxR + ' símbolos']]);
    }
    lienzo.alDibujar = () => (d || error) && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = celdas.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.w);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `<b>${d.nombres[c.i]}</b> y <b>${d.nombres[c.j]}</b><br>${c.pal === null ? 'equivalentes' : 'los separa «' + (c.pal || 'ε') + '»'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    fijar(cargar());
    rep.reiniciar();
  }

  VIZ.registrarTema('dfa-minimization', {
    intro: String.raw`
      <p>Un mismo lenguaje tiene muchos autómatas, pero entre los deterministas hay <strong>uno solo que es el más pequeño</strong>, salvo el nombre de los estados. Se obtiene eliminando los estados inalcanzables y fusionando los que son <em>equivalentes</em>: los que ninguna palabra puede distinguir.</p>
      <p>Dos algoritmos clásicos lo calculan: el de <em>refinamiento de particiones</em> (Moore), que empieza con todos juntos y va separando, y el de la <em>tabla de pares</em>, que marca los pares distinguibles.</p>`,
    visualizaciones: [
      {
        titulo: 'Refinar la partición',
        descripcion: 'Avance ronda a ronda: cada color es una clase. Al estabilizarse, las clases son los estados del autómata mínimo que aparece a la derecha. Pruebe sus propias expresiones.',
        montar: montarParticion,
      },
      {
        titulo: 'Tabla de pares distinguibles',
        descripcion: 'Cada celda marca un par de estados con la palabra más corta que los separa; los que quedan sin marcar son equivalentes. Observe cómo la palabra crece ronda a ronda.',
        montar: montarTabla,
      },
    ],
    teoria: String.raw`
      <h2>Equivalencia de estados</h2>
      <p>En un AFD \(M\), los estados \(p\) y \(q\) son <strong>equivalentes</strong> (\(p \sim q\)) si para toda palabra \(w\): \(\hat\delta(p, w) \in F \iff \hat\delta(q, w) \in F\). Si no, alguna \(w\) los <strong>distingue</strong>. \(\sim\) es una relación de equivalencia, y es una congruencia: \(p \sim q \Rightarrow \delta(p,a) \sim \delta(q,a)\).</p>
      <h2>Algoritmo de refinamiento (Moore)</h2>
      <pre><code>eliminar estados inalcanzables; completar el AFD
P₀ ← { F, Q ∖ F }
repetir:
    Pₖ₊₁ ← separar p y q si existe a con δ(p,a), δ(q,a) en clases distintas de Pₖ
hasta que Pₖ₊₁ = Pₖ
estados del mínimo ← clases de la partición final</code></pre>
      <p>La relación «equivalentes con palabras de longitud \(\le k\)» es la partición \(P_k\); como hay a lo más \(n\) clases, el algoritmo termina en a lo más \(n-1\) rondas: \(O(n^2|\Sigma|)\). El algoritmo de <strong>Hopcroft</strong> logra \(O(n|\Sigma|\log n)\) refinando siempre por la clase más pequeña.</p>
      <h2>Tabla de pares</h2>
      <p>Se marca \((p,q)\) con \(\varepsilon\) si exactamente uno es final; luego, repetidamente, se marca \((p,q)\) con \(a\,w\) si \((\delta(p,a), \delta(q,a))\) está marcado con \(w\). Los pares sin marcar son equivalentes. La palabra con que se marca cada par es la <em>más corta</em> que lo distingue.</p>
      <h2>El autómata mínimo</h2>
      \[ M_{\min} = \bigl(Q/{\sim},\ \Sigma,\ [p] \xrightarrow{a} [\delta(p,a)],\ [q_0],\ \{[q] : q \in F\}\bigr). \]
      <div class="recuadro"><p><strong>Teorema.</strong> Para un lenguaje regular \(L\), el AFD completo con menos estados que lo reconoce es único salvo isomorfismo: \(M_{\min}\). Sus estados corresponden a las clases de Myhill-Nerode de \(L\) (<a href="tema.html?id=myhill-nerode">Myhill-Nerode Theorem</a>).</p></div>
      <h2>Usos</h2>
      <ul>
        <li>Comprobar equivalencia de autómatas: mínimos isomorfos (<a href="tema.html?id=regular-decision">Emptiness, Equivalence &amp; Inclusion</a>).</li>
        <li>Reducir el tamaño tras una <a href="tema.html?id=subset-construction">determinización</a>, para tablas más compactas en analizadores léxicos.</li>
        <li>Con un AFN no hay un mínimo único, y minimizarlo es PSPACE-difícil.</li>
      </ul>`,
  });
})();
