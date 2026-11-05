(function () {
  'use strict';
  const { color: C } = VIZ;
  const MAXL = 4;

  // Lenguajes sobre {a, b} definidos por una propiedad; se muestran sus palabras de longitud ≤ 4.
  const LENGUAJES = {
    L1: { nombre: 'L₁ = termina en a', f: (w) => w.endsWith('a') },
    L2: { nombre: 'L₂ = contiene «bb»', f: (w) => w.includes('bb') },
    L3: { nombre: 'L₃ = longitud par', f: (w) => w.length % 2 === 0 },
    L4: { nombre: 'L₄ = {a, ab}', f: (w) => w === 'a' || w === 'ab' },
    L5: { nombre: 'L₅ = {ε, b}', f: (w) => w === '' || w === 'b' },
  };
  const TODAS = (() => { const r = ['']; let niv = ['']; for (let l = 1; l <= MAXL; l++) { const s = []; for (const w of niv) for (const c of 'ab') s.push(w + c); r.push(...s); niv = s; } return r; })();
  const conj = (f) => new Set(TODAS.filter(f));

  /* ---------- Fig. 1: operaciones booleanas y concatenación ---------- */

  function montarOperaciones(cuerpo) {
    let A = 'L1', B = 'L2', op = 'union';
    const OPS = {
      union: { nombre: 'A ∪ B', f: (a, b) => (w) => a(w) || b(w) },
      inter: { nombre: 'A ∩ B', f: (a, b) => (w) => a(w) && b(w) },
      comp: { nombre: 'Aᶜ = Σ* ∖ A', f: (a) => (w) => !a(w) },
      dif: { nombre: 'A ∖ B', f: (a, b) => (w) => a(w) && !b(w) },
      cat: { nombre: 'A · B (concatenación)', f: null },
    };
    const ctl = VIZ.controles(cuerpo);
    const opts = Object.entries(LENGUAJES).map(([k, v]) => [k, v.nombre]);
    ctl.selector({ etiqueta: 'Lenguaje A', opciones: opts, valor: A, alCambiar: (v) => { A = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Lenguaje B', opciones: opts, valor: B, alCambiar: (v) => { B = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Operación', opciones: Object.entries(OPS).map(([k, v]) => [k, v.nombre]), valor: op, alCambiar: (v) => { op = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 330 : 280) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'pertenece a A' },
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'pertenece a B' },
      { color: C.s6, texto: 'pertenece al resultado' },
      { color: C.inactivo, texto: 'no pertenece', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada columna es una longitud (0 a 4) y cada celda una palabra sobre {a, b}. Las tres filas muestran A, B y el resultado. Con la concatenación solo se ven las palabras de longitud ≤ 4.');
    let celdas = [];

    function resultado() {
      const a = LENGUAJES[A].f, b = LENGUAJES[B].f;
      if (op !== 'cat') return conj(OPS[op].f(a, b));
      const R = new Set(), sa = conj(a), sb = conj(b);
      for (const x of sa) for (const y of sb) if ((x + y).length <= MAXL) R.add(x + y);
      return R;
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const SA = conj(LENGUAJES[A].f), SB = conj(LENGUAJES[B].f), SR = resultado();
      const filas = [['A', SA, C.s1], ['B', SB, C.s2], [OPS[op].nombre.split(' ')[0], SR, C.s6]];
      const x0 = 30, ancho = W - x0 - 6, dyFila = (lienzo.alto - 24) / 3;
      celdas = [];
      const porLong = Array.from({ length: MAXL + 1 }, (_, l) => TODAS.filter((w) => w.length === l));
      const colW = (l) => (ancho * Math.pow(2, l)) / (Math.pow(2, MAXL + 1) - 1);
      ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      let xc = x0;
      porLong.forEach((ws, l) => { ctx.fillStyle = C.apagado; ctx.fillText(`n=${l}`, xc + colW(l) / 2, 2); xc += colW(l); });
      filas.forEach(([nom, S, col], r) => {
        const y = 18 + r * dyFila, alto = Math.min(34, dyFila - 10);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(nom, x0 - 6, y + alto / 2);
        let x = x0;
        porLong.forEach((ws, l) => {
          const cw = colW(l) / ws.length;
          ws.forEach((w, k) => {
            const en = S.has(w), cx = x + k * cw;
            ctx.fillStyle = en ? (r === 2 ? C.s6 : VIZ.alfa(col, 0.3)) : C.neutro; ctx.strokeStyle = en ? (r === 2 ? C.s6 : col) : C.rejilla; ctx.lineWidth = en ? 1.5 : 1;
            ctx.fillRect(cx + 0.5, y, cw - 1, alto); ctx.strokeRect(cx + 1, y + 0.5, cw - 2, alto - 1);
            if (cw >= 13) { ctx.fillStyle = en ? (r === 2 ? C.sobre : C.tinta) : C.inactivo; ctx.font = VIZ.fuente(cw > 24 ? 10 : 8, 600); ctx.textAlign = 'center'; ctx.fillText(w || 'ε', cx + cw / 2, y + alto / 2 + 0.5, cw - 2); }
            celdas.push({ x: cx, y, w: cw, h: alto, pal: w, a: SA.has(w), b: SB.has(w), r: SR.has(w) });
          });
          x += colW(l);
        });
      });
      const total = TODAS.length;
      registro.textContent = op === 'cat'
        ? 'A·B = { xy : x ∈ A, y ∈ B }. Se unen todas las palabras de A con todas las de B; con A = {a, ab} y B = {ε, b} salen a, ab, abb.'
        : `${OPS[op].nombre}: una palabra está en el resultado según la regla ${op === 'union' ? '«en A o en B»' : op === 'inter' ? '«en A y en B»' : op === 'comp' ? '«no está en A»' : '«en A pero no en B»'}.`;
      lectura.set([['|A| (n ≤ 4)', String(SA.size)], ['|B| (n ≤ 4)', String(SB.size)], ['|resultado| (n ≤ 4)', String(SR.size)], ['palabras consideradas', String(total)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = celdas.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `<b>${c.pal || 'ε'}</b><br>en A: ${c.a ? 'sí' : 'no'} · en B: ${c.b ? 'sí' : 'no'}<br>en resultado: ${c.r ? 'sí' : 'no'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: estrella de Kleene por niveles ---------- */

  function montarEstrella(cuerpo) {
    let base = 'a, bb', k = 0, mas = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Lenguaje base L (palabras separadas por comas)', valor: base, alCambiar: (v) => { base = v; k = Math.min(k, 4); dibujar(); }, alEnter: (v) => { base = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Potencias hasta Lᵏ', min: 0, max: 4, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Clausura positiva L⁺ (sin L⁰)', valor: mas, alCambiar: (v) => { mas = v; dibujar(); } });
    const cajaNiv = VIZ.el('div', { class: 'registro grande' });
    cuerpo.appendChild(cajaNiv);
    cuerpo.dataset.sinLeyenda = 'figura de texto: cada línea indica a qué potencia pertenecen sus palabras';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pruebe «a, b» (todo Σ*), «ab» (potencias de ab), «ε, a» (L⁰ ya es parte de L) o «aa, aaa» (los lenguajes unarios crecen despacio).');

    function dibujar() {
      const L = [...new Set(base.split(',').map((s) => s.trim().replace(/^ε$/, '')).filter((s, i, a) => s !== undefined))];
      const niveles = [new Set([''])];
      for (let i = 1; i <= k; i++) {
        const sig = new Set();
        for (const x of niveles[i - 1]) for (const y of L) sig.add(x + y);
        niveles.push(sig);
      }
      const lineas = [];
      const todo = new Set();
      niveles.forEach((S, i) => {
        if (mas && i === 0) return;
        const ws = [...S].sort((x, y) => x.length - y.length || (x < y ? -1 : 1));
        ws.forEach((w) => todo.add(w));
        const txt = ws.slice(0, 14).map((w) => w || 'ε').join(', ') + (ws.length > 14 ? `, … (${ws.length})` : '');
        lineas.push(VIZ.el('div', null, VIZ.el('b', null, `L${i === 0 ? '⁰' : i === 1 ? '¹' : i === 2 ? '²' : i === 3 ? '³' : '⁴'} `), `= { ${txt} }`));
      });
      cajaNiv.replaceChildren(...lineas);
      const orden = [...todo].sort((x, y) => x.length - y.length || (x < y ? -1 : 1));
      registro.textContent = `${mas ? 'L⁺' : 'L*'} hasta k = ${k}: { ${orden.slice(0, 18).map((w) => w || 'ε').join(', ')}${orden.length > 18 ? ', …' : ''} }`;
      const sin = niveles.map((S) => S.size);
      lectura.set([['|L|', String(new Set(L).size)], [`|L^${k}|`, String(niveles[k].size)], [`|${mas ? 'L⁺' : 'L*'}| acumulado`, String(todo.size)], ['¿ε ∈ L*?', 'siempre (L⁰ = {ε})'], ['tamaños |Lⁱ|', sin.join(', ')]]);
    }
    dibujar();
  }

  VIZ.registrarTema('language-operations', {
    intro: String.raw`
      <p>Un lenguaje es un conjunto de palabras, y los conjuntos se pueden combinar. Además de la unión, la intersección y el complemento, hay dos operaciones
      propias de las palabras: la <strong>concatenación</strong> de lenguajes (pegar una palabra de cada uno) y la <strong>estrella de Kleene</strong> (pegar cualquier cantidad de palabras del mismo lenguaje).</p>
      <p>Estas operaciones son los ladrillos de las expresiones regulares: un lenguaje regular es el que se obtiene de lenguajes finitos usando solo unión, concatenación y estrella.</p>`,
    visualizaciones: [
      {
        titulo: 'Operaciones entre dos lenguajes',
        descripcion: 'Elija dos lenguajes y una operación: la fila inferior pinta las palabras (hasta longitud 4) que pertenecen al resultado. Pase el cursor sobre una celda.',
        montar: montarOperaciones,
      },
      {
        titulo: 'La estrella de Kleene nivel a nivel',
        descripcion: 'Escriba un lenguaje base y suba k: cada nivel \\(L^k\\) pega k palabras; la estrella es la unión de todos los niveles.',
        montar: montarEstrella,
      },
    ],
    teoria: String.raw`
      <h2>Operaciones de conjuntos</h2>
      <p>Para \(A, B \subseteq \Sigma^*\):</p>
      \[ A \cup B = \{w : w \in A \lor w \in B\}, \quad A \cap B = \{w : w \in A \land w \in B\}, \quad \overline{A} = \Sigma^* \setminus A. \]
      <p>Valen las leyes de De Morgan: \(\overline{A \cup B} = \overline{A} \cap \overline{B}\) y \(\overline{A \cap B} = \overline{A} \cup \overline{B}\). El complemento depende del alfabeto: \(\overline{A}\) se calcula respecto de \(\Sigma^*\).</p>
      <h2>Concatenación</h2>
      \[ A \cdot B = \{ xy : x \in A,\ y \in B \}. \]
      <p>Es asociativa, tiene neutro \(\{\varepsilon\}\) y absorbente \(\varnothing\) (\(A\cdot\varnothing = \varnothing\)), pero no es conmutativa. Distribuye sobre la unión:
      \(A(B \cup C) = AB \cup AC\); sobre la intersección solo se cumple \(A(B\cap C) \subseteq AB \cap AC\). Si \(A\) y \(B\) son finitos, \(|AB| \le |A|\,|B|\) (puede ser menor si distintos pares producen la misma palabra).</p>
      <h2>Potencias y estrella de Kleene</h2>
      \[ L^0 = \{\varepsilon\}, \quad L^{k+1} = L^k \cdot L, \qquad L^* = \bigcup_{k \ge 0} L^k, \qquad L^+ = \bigcup_{k \ge 1} L^k = L \cdot L^*. \]
      <p>Observaciones:</p>
      <ul>
        <li>\(\varepsilon \in L^*\) siempre, incluso si \(L = \varnothing\): \(\varnothing^* = \{\varepsilon\}\).</li>
        <li>\(L^* = L^+\) si y solo si \(\varepsilon \in L\).</li>
        <li>\((L^*)^* = L^*\) y \(\Sigma^*\) es la estrella del alfabeto visto como lenguaje de palabras de un símbolo.</li>
        <li>Si \(L\) tiene alguna palabra no vacía, \(L^*\) es infinito.</li>
      </ul>
      <h2>Lo que viene</h2>
      <p>La clase de lenguajes obtenidos de los finitos con \(\cup\), \(\cdot\) y \(^*\) es la de los <strong>lenguajes regulares</strong>
      (<a href="tema.html?id=regex-semantics">Regular Expressions</a>). Que además se cierre bajo intersección y complemento se ve construyendo autómatas
      (<a href="tema.html?id=dfa-product">Product Construction</a>).</p>`,
  });
})();
