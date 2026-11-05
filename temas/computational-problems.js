(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;

  // Cuatro lenguajes sobre {a, b, c} y la memoria que exige reconocerlos, medida sobre la palabra dada.
  const LENGUAJES = [
    {
      id: 'par', nombre: 'Número par de a', maquina: 'autómata finito', nivel: 0,
      f: (w) => [...w].filter((c) => c === 'a').length % 2 === 0,
      memoria: (w) => ({ txt: '1 bit (paridad)', val: 1 }),
    },
    {
      id: 'anbn', nombre: 'aⁿbⁿ', maquina: 'autómata con pila', nivel: 1,
      f: (w) => /^(a*)(b*)$/.test(w) && w.replace(/b/g, '').length === w.replace(/a/g, '').length,
      memoria: (w) => { let h = 0, mx = 0; for (const c of w) { if (c === 'a') h++; else if (c === 'b') h = Math.max(0, h - 1); mx = Math.max(mx, h); } return { txt: `pila hasta ${mx}`, val: mx }; },
    },
    {
      id: 'anbncn', nombre: 'aⁿbⁿcⁿ', maquina: 'máquina de Turing (cinta lineal)', nivel: 2,
      f: (w) => { const m = w.match(/^(a*)(b*)(c*)$/); return !!m && m[1].length === m[2].length && m[2].length === m[3].length; },
      memoria: (w) => ({ txt: `${w.length} celdas de cinta`, val: w.length }),
    },
    {
      id: 'ww', nombre: 'ww (una palabra repetida)', maquina: 'máquina de Turing (cinta lineal)', nivel: 2,
      f: (w) => w.length % 2 === 0 && w.slice(0, w.length / 2) === w.slice(w.length / 2),
      memoria: (w) => ({ txt: `${w.length} celdas de cinta`, val: w.length }),
    },
  ];
  const NIVELES = ['autómata finito', 'autómata con pila', 'máquina de Turing'];

  /* ---------- Fig. 1: una palabra, cuatro lenguajes ---------- */

  function montarVeredicto(cuerpo) {
    let w = 'aabb';
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Palabra sobre {a, b, c}', valor: w, alCambiar: (v) => { w = v.replace(/[^abc]/g, '').slice(0, 24); campo.valor = w; actualizar(); }, alEnter: (v) => { w = v.replace(/[^abc]/g, ''); actualizar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ['', 'ε (vacía)'], ['aabb', 'aabb'], ['aabbcc', 'aabbcc'], ['abab', 'abab'], ['abcabc', 'abcabc'], ['aaabbb', 'aaabbb']], valor: '', alCambiar: (v) => { w = v; campo.valor = v; actualizar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto' });
    caja.appendChild(tabla);
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de texto: el veredicto va en palabras';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Escriba cualquier palabra de a, b y c. La columna «memoria» mide lo que una máquina razonable necesita para <em>esa</em> palabra; pruebe palabras largas de aⁿbⁿ.');
    function actualizar() {
      const filas = [VIZ.el('tr', null, ['Lenguaje', 'Veredicto', 'Máquina mínima', 'Memoria usada'].map((t) => VIZ.el('th', null, t)))];
      for (const L of LENGUAJES) {
        const ok = L.f(w), m = L.memoria(w);
        filas.push(VIZ.el('tr', null,
          VIZ.el('td', null, L.nombre),
          VIZ.el('td', { style: { color: ok ? C.s6 : C.s8, fontWeight: 700 } }, ok ? 'pertenece' : 'no pertenece'),
          VIZ.el('td', null, L.maquina),
          VIZ.el('td', null, m.txt)));
      }
      tabla.replaceChildren(...filas);
      registro.textContent = `Con la palabra «${w || 'ε'}» (longitud ${w.length}): ${LENGUAJES.filter((L) => L.f(w)).map((L) => L.nombre).join(', ') || 'no está en ninguno de los lenguajes'}.`;
    }
    actualizar();
  }

  /* ---------- Fig. 2: la memoria que exige aⁿbⁿ ---------- */

  // AFD mínimo del lenguaje finito { aᵏbᵏ : 0 ≤ k ≤ n }: sirve para ver que no existe un AFD para todo n.
  function afdAcotado(n) {
    const nombres = [], idx = {}, trans = [];
    const id = (k) => { if (!(k in idx)) { idx[k] = nombres.length; nombres.push(k); } return idx[k]; };
    for (let i = 0; i <= n; i++) id('a' + i);
    for (let r = 0; r <= n; r++) id('b' + r);
    id('x');
    for (let i = 0; i <= n; i++) {
      trans.push([id('a' + i), 'a', i < n ? id('a' + (i + 1)) : id('x')]);
      trans.push([id('a' + i), 'b', i >= 1 ? id('b' + (i - 1)) : id('x')]);
    }
    for (let r = 0; r <= n; r++) { trans.push([id('b' + r), 'b', r >= 1 ? id('b' + (r - 1)) : id('x')]); trans.push([id('b' + r), 'a', id('x')]); }
    trans.push([id('x'), 'a', id('x')], [id('x'), 'b', id('x')]);
    const fin = [id('a0'), id('b0')];
    return A.minimizar(A.construir({ n: nombres.length, nombres, alf: ['a', 'b'], ini: [id('a0')], fin, trans })).min;
  }

  function montarMemoria(cuerpo) {
    let hover = null, plano = null;
    const datos = [];
    for (let n = 1; n <= 12; n++) datos.push([n, afdAcotado(n).n]);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'estados del AFD mínimo para {aᵏbᵏ : k ≤ n}', forma: 'linea' },
      { color: C.s2, texto: 'estados de un autómata con pila (constante)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada n se construye y se minimiza el AFD del lenguaje truncado. Su tamaño crece sin cota: ningún autómata finito reconoce todo aⁿbⁿ. La pila, en cambio, guarda el contador.');
    const f = (n) => datos[n - 1][1];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 12, ymin: 0, ymax: Math.ceil((f(12) + 2) / 5) * 5 }, { etiquetaX: 'n (profundidad de anidamiento)', etiquetaY: 'estados' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, 3], [12, 3]], C.s2, 2);
      VIZ.trazar(ctx, plano, datos, C.s1, 2);
      for (const [n, v] of datos) VIZ.marcador(ctx, plano.sx(n), plano.sy(v), C.s1, n === hover ? 5 : 3.5);
      const sel = hover || 6;
      lectura.set([['n', String(sel)], ['estados del AFD mínimo', String(f(sel))], ['estados del autómata con pila', '3 (más una pila de altura n)'], ['relación', `≈ 2n + ${f(sel) - 2 * sel}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(12, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'AFD mínimo', f(hover)) + VIZ.filaTooltip(C.s2, 'con pila', 3));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('computational-problems', {
    intro: String.raw`
      <p>Un <strong>problema de decisión</strong> pregunta «¿esta entrada cumple la propiedad?». Si codificamos las entradas como palabras, el problema es exactamente un
      <strong>lenguaje</strong>: el conjunto de palabras cuya respuesta es «sí». Decidir si una palabra pertenece a un lenguaje es el problema computacional más básico.</p>
      <p>No todos los lenguajes exigen el mismo esfuerzo. Contar la paridad de las <em>a</em> cabe en un bit de memoria; comparar la cantidad de <em>a</em> y de <em>b</em> exige un contador sin cota;
      comparar tres cantidades o detectar una palabra repetida exige más aún. Las <strong>máquinas abstractas</strong> son precisamente escalones de memoria crecientes.</p>`,
    visualizaciones: [
      {
        titulo: 'Una palabra, cuatro lenguajes',
        descripcion: 'Escriba una palabra y vea si pertenece a cada lenguaje, qué máquina mínima lo reconoce y cuánta memoria usa. Pruebe aabb, abab y aabbcc.',
        montar: montarVeredicto,
      },
      {
        titulo: 'La memoria que exige aⁿbⁿ',
        descripcion: 'Cada punto es el autómata finito mínimo para las palabras aᵏbᵏ con k ≤ n: crece linealmente, así que ningún autómata finito reconoce el lenguaje completo.',
        montar: montarMemoria,
      },
    ],
    teoria: String.raw`
      <h2>Problemas de decisión y lenguajes</h2>
      <p>Un problema de decisión \(P\) con entradas codificadas en \(\Sigma^*\) se identifica con el lenguaje \(L_P = \{ w \in \Sigma^* : P(w) = \text{sí}\}\). Resolver \(P\) es construir una máquina que, dada \(w\), responda si \(w \in L_P\).
      La cantidad de lenguajes es enorme: \(\Sigma^*\) es numerable, de modo que \(\mathcal{P}(\Sigma^*)\) no lo es, mientras que las máquinas (descritas por palabras finitas) sí lo son.
      <strong>Casi todos los lenguajes no tienen ninguna máquina.</strong></p>
      <h2>Máquinas abstractas</h2>
      <p>Una máquina abstracta es un modelo matemático de cómputo con un control finito y un tipo de memoria. De menos a más poder:</p>
      <table>
        <tr><th>Máquina</th><th>Memoria</th><th>Lenguajes</th><th>Ejemplo</th></tr>
        <tr><td>Autómata finito</td><td>ninguna (solo el estado)</td><td>regulares</td><td>número par de \(a\)</td></tr>
        <tr><td>Autómata con pila</td><td>pila</td><td>libres de contexto</td><td>\(a^n b^n\)</td></tr>
        <tr><td>Máquina de Turing</td><td>cinta ilimitada</td><td>recursivamente enumerables / decidibles</td><td>\(a^n b^n c^n\), \(ww\)</td></tr>
      </table>
      <p>Esta jerarquía es la de Chomsky: cada clase contiene estrictamente a la anterior. Lo que cambia entre escalones no es la velocidad sino lo que se puede <em>recordar</em>.</p>
      <h2>Por qué \(a^nb^n\) no es regular</h2>
      <p>Para contar \(n\) letras \(a\) un autómata finito necesita distinguir \(n+1\) situaciones (haber leído \(0, 1, \dots, n\) letras \(a\)), así que con \(k\) estados no puede manejar \(n \ge k\).
      La figura 2 lo muestra numéricamente: el AFD mínimo de \(\{a^kb^k : k \le n\}\) tiene \(2n+3\) estados (contando el de error). El argumento formal es el
      <a href="tema.html?id=pumping-lemma">lema de bombeo</a> o, de forma más precisa, el teorema de
      <a href="tema.html?id=myhill-nerode">Myhill-Nerode</a>.</p>
      <div class="recuadro"><p>Los temas siguientes recorren el primer escalón: los lenguajes que reconoce un autómata finito
      (<a href="tema.html?id=dfa-basics">Deterministic Finite Automata</a>) y que también describen las expresiones regulares.</p></div>`,
  });
})();
