(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: diagrama de Venn con pertenencia ---------- */

  // Estado de cada elemento: 0 fuera, 1 solo en A, 2 en ambos, 3 solo en B.
  const U = Array.from({ length: 12 }, (_, i) => i + 1);
  const EJEMPLOS = {
    pares: ['A = pares, B = múltiplos de 3', (x) => (x % 2 === 0 ? (x % 3 === 0 ? 2 : 1) : x % 3 === 0 ? 3 : 0)],
    sub: ['A ⊆ B (A está contenido en B)', (x) => (x <= 3 ? 2 : x <= 7 ? 3 : 0)],
    disj: ['A y B disjuntos', (x) => (x <= 4 ? 1 : x <= 8 ? 3 : 0)],
    igual: ['A = B', (x) => (x <= 6 ? 2 : 0)],
  };

  function montarVenn(cuerpo) {
    let est = U.map(EJEMPLOS.pares[1]), sitios = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplo', opciones: Object.entries(EJEMPLOS).map(([k, v]) => [k, v[0]]), valor: 'pares', alCambiar: (v) => { est = U.map(EJEMPLOS[v][1]); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: VIZ.alfa(C.s1, 0.35), borde: C.s1, texto: 'conjunto A', forma: 'cuadro' }, { color: VIZ.alfa(C.s2, 0.35), borde: C.s2, texto: 'conjunto B', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un elemento para moverlo entre las regiones (fuera → solo A → ambos → solo B). Observe cuándo A ⊆ B y cuándo A = B.');

    const enA = (e) => e === 1 || e === 2, enB = (e) => e === 2 || e === 3;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const r = Math.min(H * 0.36, W * 0.25), cy = H * 0.46, ax = W / 2 - r * 0.55, bx = W / 2 + r * 0.55;
      ctx.lineWidth = 1.5; ctx.strokeStyle = C.eje; ctx.strokeRect(6, 6, W - 12, H - 12);
      D.texto2(ctx, 'U', 18, 18, { color: C.apagado, px: 12 });
      for (const [x, c, t] of [[ax, C.s1, 'A'], [bx, C.s2, 'B']]) {
        ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fillStyle = VIZ.alfa(c, 0.18); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke();
        D.texto2(ctx, t, x + (t === 'A' ? -r * 0.8 : r * 0.8), cy - r - 10, { color: c, px: 14, peso: 700 });
      }
      const anclas = [[W / 2, H - 24, 7], [ax - r * 0.5, cy, 2], [W / 2, cy, 2], [bx + r * 0.5, cy, 2]];
      sitios = [];
      [0, 1, 2, 3].forEach((reg) => {
        const lista = U.filter((_, i) => est[i] === reg);
        const [px, py, cols] = anclas[reg];
        lista.forEach((x, k) => {
          const fila = Math.floor(k / cols), col = k % cols;
          const ancho = Math.min(cols, lista.length - fila * cols);
          sitios.push({ x, cx: px + (col - (ancho - 1) / 2) * 28, cy: py + (fila - (Math.ceil(lista.length / cols) - 1) / 2) * 26 });
        });
      });
      for (const s of sitios) {
        ctx.beginPath(); ctx.arc(s.cx, s.cy, 11, 0, 7); ctx.fillStyle = C.superficie; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = C.tinta; ctx.stroke();
        D.texto2(ctx, String(s.x), s.cx, s.cy + 0.5, { px: 11, peso: 600 });
      }
      const A = U.filter((_, i) => enA(est[i])), B = U.filter((_, i) => enB(est[i]));
      const sub = A.every((x) => B.includes(x)), sup = B.every((x) => A.includes(x));
      const lst = (L) => '{' + L.join(', ') + '}';
      lectura.set([
        ['A', lst(A)], ['B', lst(B)], ['A ∩ B', lst(A.filter((x) => B.includes(x)))], ['A ∪ B', lst([...new Set([...A, ...B])].sort((a, b) => a - b))],
        ['A ⊆ B', sub ? 'sí' : 'no'], ['B ⊆ A', sup ? 'sí' : 'no'], ['A = B', sub && sup ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return sitios.find((s) => Math.hypot(s.cx - x, s.cy - y) <= 12); };
    lienzo.canvas.addEventListener('click', (ev) => {
      const s = bajo(ev);
      if (!s) return;
      est[s.x - 1] = (est[s.x - 1] + 1) % 4;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const s = bajo(ev);
      if (!s) return tip.ocultar();
      const e = est[s.x - 1];
      const { x, y } = lienzo.posicion(ev);
      tip.mostrar(x, y, `<b>${s.x}</b> ${enA(e) ? '∈' : '∉'} A<br><b>${s.x}</b> ${enB(e) ? '∈' : '∉'} B`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el conjunto potencia ---------- */

  function montarPotencia(cuerpo) {
    let n = 3, sel = 5, nodos = [];
    const LET = 'abcd';
    const pop = (m) => m.toString(2).split('1').length - 1;
    const nom = (m) => (m ? '{' + [...LET.slice(0, n)].filter((_, i) => (m >> i) & 1).join(',') + '}' : '∅');
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Elementos de A', min: 2, max: 4, valor: n, alCambiar: (v) => { n = v; sel = Math.min(sel, (1 << n) - 1); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 480 ? 360 : 330) });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'conjunto elegido S', forma: 'cuadro' },
      { color: VIZ.alfa(C.s1, 0.35), borde: C.s1, texto: 'subconjuntos de S', forma: 'cuadro' },
      { color: VIZ.alfa(C.s2, 0.35), borde: C.s2, texto: 'conjuntos que contienen a S', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un conjunto del diagrama de Hasse. Una arista une X con X ∪ {x}: subir es agregar un elemento.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const N = 1 << n, niveles = Array.from({ length: n + 1 }, () => []);
      for (let m = 0; m < N; m++) niveles[pop(m)].push(m);
      nodos = [];
      const nw = 46;
      niveles.forEach((L, k) => L.forEach((m, i) => nodos.push({ m, x: ((i + 0.5) * W) / L.length, y: H - 26 - (k * (H - 52)) / n })));
      const P = new Map(nodos.map((o) => [o.m, o]));
      ctx.lineWidth = 1.5;
      for (const o of nodos) for (let b = 0; b < n; b++) if (!((o.m >> b) & 1)) {
        const q = P.get(o.m | (1 << b));
        ctx.strokeStyle = C.tenue; ctx.beginPath(); ctx.moveTo(o.x, o.y - 11); ctx.lineTo(q.x, q.y + 11); ctx.stroke();
      }
      for (const o of nodos) {
        const sub = (o.m & sel) === o.m, sup = (o.m & sel) === sel;
        const col = o.m === sel ? C.s6 : sub ? C.s1 : sup ? C.s2 : null;
        D.caja(ctx, o.x - nw / 2, o.y - 11, nw, 22, nom(o.m), {
          relleno: o.m === sel ? C.s6 : col ? VIZ.alfa(col, 0.2) : C.superficie, borde: col || C.eje, ancho: o.m === sel ? 2 : 1.5,
          tinta: o.m === sel ? C.sobre : C.tinta, fuente: VIZ.fuente(W < 480 ? 10 : 11, 500),
        });
      }
      const k = pop(sel);
      lectura.set([['|A|', String(n)], ['|𝒫(A)| = 2ⁿ', String(1 << n)], ['S elegido', nom(sel)], ['subconjuntos de S', String(2 ** k)], ['conjuntos que contienen a S', String(2 ** (n - k))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const o = nodos.find((q) => Math.abs(q.x - x) <= 24 && Math.abs(q.y - y) <= 13);
      if (o) { sel = o.m; dibujar(); }
    });
    dibujar();
  }

  VIZ.registrarTema('sets-subsets', {
    intro: String.raw`
      <p>Un <strong>conjunto</strong> es una colección de objetos distintos, sin orden ni repetición. Lo único que importa es la pregunta <em>«¿este objeto está o no está?»</em>:
      eso es la <strong>pertenencia</strong>, \(x \in A\).</p>
      <p>De la pertenencia se deduce todo lo demás. \(A\) es <strong>subconjunto</strong> de \(B\) si todo lo que está en \(A\) está también en \(B\); y dos conjuntos son
      iguales si tienen exactamente los mismos elementos. Con ellos se arman uniones, intersecciones y el conjunto de todos los subconjuntos.</p>`,
    visualizaciones: [
      {
        titulo: 'Pertenencia e inclusión en un diagrama de Venn',
        descripcion: 'Mueva elementos entre las regiones y vea cómo cambian \\(A \\cap B\\), \\(A \\cup B\\) y las preguntas \\(A \\subseteq B\\), \\(A = B\\).',
        montar: montarVenn,
      },
      {
        titulo: 'El conjunto potencia',
        descripcion: 'Con \\(n\\) elementos hay \\(2^n\\) subconjuntos. Elija uno y vea cuáles están dentro de él y cuáles lo contienen.',
        montar: montarPotencia,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones básicas</h2>
      \[ A \subseteq B \iff \forall x\,(x \in A \to x \in B) \qquad\qquad A = B \iff A \subseteq B \land B \subseteq A \]
      <p>La segunda equivalencia es la forma habitual de demostrar que dos conjuntos son iguales: probar las dos inclusiones. Se escribe \(A \subset B\) para la inclusión propia (\(A \subseteq B\), \(A \ne B\)).
      El conjunto vacío \(\varnothing\) es subconjunto de todo conjunto: la condición «\(x \in \varnothing \to \cdots\)» es verdadera por vacuidad.</p>
      <h2>Operaciones</h2>
      <table>
        <tr><th>Operación</th><th>Definición</th></tr>
        <tr><td>Unión</td><td>\(A \cup B = \{x : x \in A \lor x \in B\}\)</td></tr>
        <tr><td>Intersección</td><td>\(A \cap B = \{x : x \in A \land x \in B\}\)</td></tr>
        <tr><td>Diferencia</td><td>\(A \setminus B = \{x : x \in A \land x \notin B\}\)</td></tr>
        <tr><td>Complemento</td><td>\(A^c = U \setminus A\)</td></tr>
      </table>
      <p>Cada operación de conjuntos es la versión de un <a href="tema.html?id=connectives">conectivo lógico</a>; las leyes de De Morgan, por ejemplo, valen en ambos mundos.</p>
      <h2>Conjunto potencia</h2>
      <p>\(\mathcal{P}(A) = \{S : S \subseteq A\}\). Cada subconjunto corresponde a elegir, para cada elemento, «entra» o «no entra»:</p>
      \[ |\mathcal{P}(A)| = 2^{|A|}. \]
      <p>Con \(\subseteq\) como orden, \(\mathcal{P}(A)\) forma un reticulado (el diagrama de Hasse de la figura). La demostración de la fórmula es una buena aplicación de la
      <a href="tema.html?id=simple-induction">inducción</a>: al añadir un elemento nuevo, los subconjuntos se duplican (los que lo contienen y los que no).</p>`,
  });
})();
