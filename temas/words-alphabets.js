(function () {
  'use strict';
  const { color: C } = VIZ;

  const ALFABETOS = { ab: ['a', 'b'], '01': ['0', '1'], abc: ['a', 'b', 'c'] };

  /* ---------- Fig. 1: palabras, concatenación y potencias ---------- */

  function montarPalabras(cuerpo) {
    let alf = ALFABETOS.ab, u = 'aba', v = 'bb', n = 2;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Alfabeto Σ', opciones: [['ab', '{a, b}'], ['01', '{0, 1}'], ['abc', '{a, b, c}']], valor: 'ab', alCambiar: (k) => { alf = ALFABETOS[k]; u = [...u].map((c, i) => (alf.includes(c) ? c : alf[i % alf.length])).join(''); v = [...v].map((c, i) => (alf.includes(c) ? c : alf[(i + 1) % alf.length])).join(''); cu.valor = u; cv.valor = v; dibujar(); } });
    const cu = ctl.texto({ etiqueta: 'Palabra u', valor: u, alCambiar: (x) => { u = x.replace(/\s/g, '').slice(0, 10); dibujar(); } });
    const cv = ctl.texto({ etiqueta: 'Palabra v', valor: v, alCambiar: (x) => { v = x.replace(/\s/g, '').slice(0, 10); dibujar(); } });
    ctl.rango({ etiqueta: 'Potencia n', min: 0, max: 4, valor: n, alCambiar: (x) => { n = x; dibujar(); } });
    ctl.boton('Intercambiar u y v', () => { [u, v] = [v, u]; cu.valor = u; cv.valor = v; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'símbolos de u' },
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'símbolos de v' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.s8, texto: 'símbolo fuera de Σ' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escriba palabras en u y v (hasta 10 símbolos). Pulse «Intercambiar» para ver que uv y vu casi nunca coinciden. Pase el cursor sobre una fila.');
    let filas = [];

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const celda = Math.max(14, Math.min(26, Math.floor((W - 120) / Math.max(10, (u.length + v.length) || 1, u.length * n || 1))));
      const un = u.repeat(n);
      filas = [
        { nom: 'u', txt: u, col: [[u.length, C.s1]], info: `u = ${u || 'ε'}` },
        { nom: 'v', txt: v, col: [[v.length, C.s2]], info: `v = ${v || 'ε'}` },
        { nom: 'uv', txt: u + v, col: [[u.length, C.s1], [v.length, C.s2]], info: `|uv| = |u| + |v| = ${u.length} + ${v.length}` },
        { nom: 'vu', txt: v + u, col: [[v.length, C.s2], [u.length, C.s1]], info: `|vu| = ${u.length + v.length}` },
        { nom: 'uⁿ', txt: un, col: Array.from({ length: n }, () => [u.length, C.s1]), info: `u^${n}, longitud ${n}·|u| = ${un.length}` },
        { nom: 'uᴿ', txt: [...u].reverse().join(''), col: [[u.length, C.s1]], info: 'inverso (se lee de derecha a izquierda)' },
      ];
      const x0 = 48, dy = 40;
      filas.forEach((f, r) => {
        const y = 14 + r * dy;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(f.nom, x0 - 10, y + celda / 2);
        const chars = [...f.txt];
        if (!chars.length) { ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText('ε', x0, y + celda / 2); return; }
        let k = 0;
        for (const [len, col] of f.col) {
          for (let t = 0; t < len; t++, k++) {
            const x = x0 + k * celda, mal = !alf.includes(chars[k]);
            ctx.fillStyle = VIZ.alfa(mal ? C.s8 : col, 0.3); ctx.strokeStyle = mal ? C.s8 : col; ctx.lineWidth = 1.5;
            ctx.fillRect(x, y, celda, celda); ctx.strokeRect(x + 0.5, y + 0.5, celda - 1, celda - 1);
            ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(14, celda - 6), 600); ctx.textAlign = 'center';
            ctx.fillText(chars[k], x + celda / 2, y + celda / 2 + 0.5);
          }
        }
      });
      const fuera = [...new Set([...(u + v)].filter((c) => !alf.includes(c)))];
      registro.textContent = fuera.length
        ? `Los símbolos ${fuera.map((c) => `«${c}»`).join(', ')} no pertenecen a Σ = {${alf.join(', ')}}: no son palabras sobre este alfabeto.`
        : `uv = «${u + v || 'ε'}» y vu = «${v + u || 'ε'}»: ${u + v === v + u ? 'coinciden (u y v son potencias de una misma palabra)' : 'son distintas, la concatenación no es conmutativa'}. La palabra vacía ε es el neutro: u·ε = ε·u = u.`;
      lectura.set([['|u|', String(u.length)], ['|v|', String(v.length)], ['|uv|', String(u.length + v.length)], [`|u^${n}|`, String(u.length * n)], ['prefijos de u', String(u.length + 1)], ['|u|ₐ (apariciones de ' + alf[0] + ')', String([...u].filter((c) => c === alf[0]).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), r = Math.floor((y - 14) / 40);
      if (r < 0 || r >= filas.length || y - 14 - r * 40 > 28) return tip.ocultar();
      tip.mostrar(x, y, filas[r].info);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: cuántas palabras hay ---------- */

  function montarConteo(cuerpo) {
    let k = 2, len = 3, hover = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del alfabeto |Σ|', min: 1, max: 4, valor: k, alCambiar: (v) => { k = v; actualizar(); } });
    ctl.rango({ etiqueta: 'Longitud n', min: 0, max: 6, valor: len, alCambiar: (v) => { len = v; actualizar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'palabras de longitud n: |Σ|ⁿ', forma: 'linea' },
      { color: C.s2, texto: 'palabras de longitud ≤ n', forma: 'linea' },
    ]);
    VIZ.subtitulo(cuerpo, 'Las primeras palabras de longitud n, en orden de longitud y luego alfabético');
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje vertical es logarítmico: una recta es crecimiento exponencial. Pase el cursor sobre el gráfico para leer valores exactos.');
    const LETRAS = 'abcd';
    const total = (kk, l) => (kk === 1 ? l + 1 : (Math.pow(kk, l + 1) - 1) / (kk - 1));

    function actualizar() { dibujar(); mostrarLista(); }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 10, ymin: 1, ymax: 1e6 }, { logY: true, etiquetaX: 'longitud n', etiquetaY: 'cantidad de palabras' });
      plano.ejes();
      const a = [], b = [];
      for (let l = 0; l <= 10; l++) { a.push([l, Math.pow(k, l)]); b.push([l, total(k, l)]); }
      VIZ.trazar(ctx, plano, b, C.s2, 2);
      VIZ.trazar(ctx, plano, a, C.s1, 2);
      VIZ.marcador(ctx, plano.sx(len), plano.sy(Math.pow(k, len)), C.s1, 5);
      VIZ.marcador(ctx, plano.sx(len), plano.sy(total(k, len)), C.s2, 5);
      if (hover != null) { VIZ.marcador(ctx, plano.sx(hover), plano.sy(Math.pow(k, hover)), C.s1, 4); }
      lectura.set([['|Σ|', String(k)], ['n', String(len)], ['|Σⁿ| = |Σ|ⁿ', VIZ.entero(Math.pow(k, len))], ['|Σ≤ⁿ|', VIZ.entero(total(k, len))], ['|Σ*|', 'infinito numerable']]);
    }
    function mostrarLista() {
      const cant = Math.pow(k, len), mostrar = Math.min(cant, 24), res = [];
      for (let i = 0; i < mostrar; i++) {
        let w = '', x = i;
        for (let t = 0; t < len; t++) { w = LETRAS[x % k] + w; x = Math.floor(x / k); }
        res.push(len ? w : 'ε');
      }
      lista.replaceChildren(VIZ.el('div', null, res.join('   ') + (cant > mostrar ? `   … (${VIZ.entero(cant - mostrar)} más)` : '')));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(10, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'longitud exacta', VIZ.entero(Math.pow(k, hover))) + VIZ.filaTooltip(C.s2, 'longitud ≤ n', VIZ.entero(total(k, hover))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    actualizar();
  }

  VIZ.registrarTema('words-alphabets', {
    intro: String.raw`
      <p>La teoría de autómatas parte de algo muy simple: un <strong>alfabeto</strong> es un conjunto finito de símbolos y una
      <strong>palabra</strong> es una sucesión finita de ellos. Un archivo, una línea de código o una cadena de ADN son palabras sobre
      alfabetos distintos. Todo lo que estudiaremos —máquinas, expresiones, gramáticas— se reduce a decidir qué palabras pertenecen a un conjunto.</p>
      <p>Las palabras se pegan unas con otras (<em>concatenación</em>) y esa operación, sencilla, tiene un neutro —la palabra vacía ε— y obliga a distinguir
      con cuidado el orden: <em>uv</em> no es <em>vu</em>.</p>`,
    visualizaciones: [
      {
        titulo: 'Palabras, concatenación y potencias',
        descripcion: 'Escriba dos palabras u y v: compare uv con vu, cambie la potencia n y pruebe palabras vacías o con símbolos fuera del alfabeto.',
        montar: montarPalabras,
      },
      {
        titulo: 'Cuántas palabras hay de cada longitud',
        descripcion: 'Aumente el alfabeto y la longitud: el número de palabras crece como \\(|\\Sigma|^n\\), por eso enumerar todas las entradas nunca es práctico.',
        montar: montarConteo,
      },
    ],
    teoria: String.raw`
      <h2>Alfabetos y palabras</h2>
      <p>Un <strong>alfabeto</strong> \(\Sigma\) es un conjunto finito y no vacío de símbolos. Una <strong>palabra</strong> sobre \(\Sigma\) es una sucesión finita
      \(w = a_1 a_2 \cdots a_n\) con \(a_i \in \Sigma\). El número \(n = |w|\) es su <strong>longitud</strong>. La <strong>palabra vacía</strong> \(\varepsilon\) es la única de longitud 0.
      Se escribe \(\Sigma^n\) para las palabras de longitud \(n\) y</p>
      \[ \Sigma^* = \bigcup_{n \ge 0} \Sigma^n, \qquad \Sigma^+ = \Sigma^* \setminus \{\varepsilon\}. \]
      <p>Hay exactamente \(|\Sigma|^n\) palabras de longitud \(n\), de modo que \(\Sigma^*\) es infinito numerable: se puede enumerar en orden de longitud y, dentro de cada una, alfabético
      (<em>orden lexicográfico por longitud</em>).</p>
      <h2>Concatenación y potencias</h2>
      <p>La concatenación de \(u = a_1\cdots a_m\) y \(v = b_1\cdots b_n\) es \(uv = a_1\cdots a_m b_1 \cdots b_n\). Cumple:</p>
      <ul>
        <li>asociativa: \((uv)w = u(vw)\);</li>
        <li>neutro: \(\varepsilon u = u \varepsilon = u\);</li>
        <li>longitudes: \(|uv| = |u| + |v|\);</li>
        <li><strong>no</strong> conmutativa en general: \(ab \ne ba\). Se cumple \(uv = vu\) si y solo si \(u\) y \(v\) son potencias de una misma palabra.</li>
      </ul>
      <p>La potencia se define por recursión: \(u^0 = \varepsilon\), \(u^{n+1} = u^n u\), de modo que \(|u^n| = n|u|\). El <em>inverso</em> de \(u = a_1\cdots a_n\) es \(u^R = a_n \cdots a_1\) y cumple \((uv)^R = v^R u^R\).</p>
      <div class="recuadro"><p>Una palabra \(x\) es <strong>prefijo</strong> de \(w\) si \(w = xy\) para algún \(y\); <strong>sufijo</strong> si \(w = yx\); y <strong>subpalabra</strong> si \(w = yxz\).
      Una palabra de longitud \(n\) tiene \(n+1\) prefijos y \(n+1\) sufijos (contando \(\varepsilon\) y a ella misma).</p></div>
      <h2>Lenguajes</h2>
      <p>Un <strong>lenguaje formal</strong> es cualquier subconjunto \(L \subseteq \Sigma^*\). Es el objeto central de toda la teoría: una máquina <em>reconoce</em> un lenguaje, una expresión regular o
      una gramática lo <em>describe</em>. Las operaciones entre lenguajes están en
      <a href="tema.html?id=language-operations">Operations on Formal Languages</a>, y la idea de «problema computacional» en
      <a href="tema.html?id=computational-problems">Languages as Computational Problems</a>.</p>`,
  });
})();
