(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.ejemplos;
  const CLAVES = ['par-a', 'termina-01', 'contiene-aba', 'div3'];
  const PALABRAS = { 'par-a': 'abaab', 'termina-01': '110101', 'contiene-aba': 'bbabab', div3: '1001' };

  /* ---------- Fig. 1: ejecución sobre diagrama, tabla y cinta ---------- */

  function montarEjecucion(cuerpo) {
    A.figuraEjecucion(cuerpo, {
      ejemplos: CLAVES.map((k) => ({ nombre: E[k].nombre, aut: E[k].aut, palabra: PALABRAS[k] })),
      tabla: true,
      alto: 240,
    });
  }

  /* ---------- Fig. 2: todas las palabras de una longitud ---------- */

  function montarMapa(cuerpo) {
    let k = 'par-a', n = 4, sel = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; sel = -1; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud n', min: 0, max: 6, valor: n, alCambiar: (v) => { n = v; sel = -1; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const cols = Math.max(1, Math.floor(w / 62)); return 20 + Math.ceil(Math.pow(E[k].alf.length, n) / cols) * 30 + 20; } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'palabra aceptada' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'palabra rechazada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una palabra para ver el recorrido completo de configuraciones (estado, resto de la entrada). El AFD reparte las |Σ|ⁿ palabras entre aceptadas y rechazadas.');
    let celdas = [];
    const recorrido = (w) => {
      const aut = E[k].aut, T = A.delta(aut);
      let q = aut.ini[0];
      const conf = [`(${aut.nombres[q]}, ${w || 'ε'})`];
      [...w].forEach((c, i) => { q = T[q][aut.alf.indexOf(c)]; conf.push(`(${aut.nombres[q]}, ${w.slice(i + 1) || 'ε'})`); });
      return { conf, q };
    };
    function dibujar() {
      const { ctx, ancho: W } = lienzo, alf = E[k].alf;
      lienzo.limpiar();
      const total = Math.pow(alf.length, n), cw = 58, cols = Math.max(1, Math.floor(W / (cw + 4)));
      celdas = [];
      let ok = 0;
      for (let i = 0; i < total; i++) {
        let w = '', x = i;
        for (let t = 0; t < n; t++) { w = alf[x % alf.length] + w; x = Math.floor(x / alf.length); }
        const acepta = A.acepta(E[k].aut, w); if (acepta) ok++;
        const cx = 4 + (i % cols) * (cw + 4), cy = 10 + Math.floor(i / cols) * 30, col = acepta ? C.s6 : C.s8;
        ctx.fillStyle = VIZ.alfa(col, 0.28); ctx.strokeStyle = i === sel ? C.tinta : col; ctx.lineWidth = i === sel ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(cx, cy, cw, 24, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(w || 'ε', cx + cw / 2, cy + 12.5, cw - 4);
        celdas.push({ x: cx, y: cy, w: cw, h: 24, pal: w, acepta });
      }
      lectura.set([['palabras de longitud n', String(total)], ['aceptadas', String(ok)], ['rechazadas', String(total - ok)], ['proporción aceptada', VIZ.fmt(ok / total, 3)]]);
      if (sel >= 0 && celdas[sel]) {
        const r = recorrido(celdas[sel].pal);
        registro.textContent = `Palabra «${celdas[sel].pal || 'ε'}»: ${r.conf.join(' ⊢ ')} → ${E[k].aut.fin.has(r.q) ? 'estado de aceptación' : 'estado de rechazo'}.`;
      } else registro.textContent = `Definición: ${E[k].nombre}. Haga clic en una palabra.`;
    }
    lienzo.alDibujar = dibujar;
    const buscar = (ev) => { const { x, y } = lienzo.posicion(ev); return celdas.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { sel = buscar(ev); dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = buscar(ev), { x, y } = lienzo.posicion(ev);
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${celdas[i].pal || 'ε'}</b>: ${celdas[i].acepta ? 'aceptada' : 'rechazada'}<br>termina en ${E[k].aut.nombres[recorrido(celdas[i].pal).q]}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dfa-basics', {
    intro: String.raw`
      <p>Un <strong>autómata finito determinista</strong> (AFD) es la máquina más sencilla que lee una palabra: tiene un número finito de <em>estados</em>, parte de uno inicial y, por cada símbolo de la entrada,
      salta a exactamente un estado siguiente. Al terminar la palabra, la acepta si quedó en un estado de aceptación. No tiene más memoria que su estado actual.</p>
      <p>Se dibuja como un grafo (diagrama de transición) o se escribe como una tabla. Ejecutarlo es seguir un único camino: por eso se llama <em>determinista</em>.</p>`,
    visualizaciones: [
      {
        titulo: 'Un AFD leyendo una palabra',
        descripcion: 'Elija un autómata, escriba una palabra y avance paso a paso: la cinta marca el símbolo leído, el diagrama el estado actual y la tabla la fila usada.',
        montar: montarEjecucion,
      },
      {
        titulo: 'Todas las palabras de longitud n',
        descripcion: 'El autómata clasifica cada palabra como aceptada o rechazada. Haga clic en una para ver su secuencia de configuraciones.',
        montar: montarMapa,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un AFD es una quíntupla \(M = (Q, \Sigma, \delta, q_0, F)\) donde</p>
      <ul>
        <li>\(Q\) es un conjunto finito de <strong>estados</strong>;</li>
        <li>\(\Sigma\) es el <strong>alfabeto</strong> de entrada;</li>
        <li>\(\delta : Q \times \Sigma \to Q\) es la <strong>función de transición</strong> (total en un AFD completo);</li>
        <li>\(q_0 \in Q\) es el estado inicial;</li>
        <li>\(F \subseteq Q\) es el conjunto de estados de aceptación.</li>
      </ul>
      <p>Si falta alguna transición, se interpreta que la palabra se rechaza (un «AFD parcial»); equivale a enviarla a un estado trampa que se queda en sí mismo.</p>
      <h2>Configuraciones y ejecución</h2>
      <p>Una <strong>configuración</strong> es un par \((q, w)\): el estado actual y la parte de la entrada que falta leer. Un paso de cómputo es</p>
      \[ (q, a w) \vdash (\delta(q, a), w). \]
      <p>Su cierre transitivo \(\vdash^*\) describe una ejecución completa. La <strong>función de transición extendida</strong> \(\hat\delta : Q \times \Sigma^* \to Q\) se define por</p>
      \[ \hat\delta(q, \varepsilon) = q, \qquad \hat\delta(q, wa) = \delta(\hat\delta(q, w), a). \]
      <p>El lenguaje aceptado es \(L(M) = \{ w \in \Sigma^* : \hat\delta(q_0, w) \in F \}\). Un AFD con \(|Q| = k\) estados procesa una palabra de longitud \(n\) en exactamente \(n\) pasos y usa memoria \(O(\log k)\), sin importar \(n\).</p>
      <h2>Representaciones</h2>
      <table>
        <tr><th>Forma</th><th>Para qué sirve</th></tr>
        <tr><td>Diagrama de transición</td><td>Ver la estructura: flecha de entrada al inicial, doble círculo en los finales, una flecha por símbolo.</td></tr>
        <tr><td>Tabla de transición</td><td>Programar el autómata: <code>estado = tabla[estado][símbolo]</code>.</td></tr>
        <tr><td>Quíntupla</td><td>Razonar y demostrar con precisión.</td></tr>
      </table>
      <pre><code>q ← q0
para cada símbolo a de w:
    q ← δ(q, a)
devolver (q ∈ F)</code></pre>
      <h2>Qué sigue</h2>
      <p>Cómo se diseña un AFD para un lenguaje dado en <a href="tema.html?id=dfa-construction">Building DFAs for Languages</a>; cómo se combinan en
      <a href="tema.html?id=dfa-product">Product Construction &amp; Complement</a>; y qué pasa si se permite elegir entre varios caminos en
      <a href="tema.html?id=nfa-basics">Nondeterministic Finite Automata</a>.</p>`,
  });
})();
