(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.gram;
  const PRESETS = [
    { nombre: 'aⁿbⁿ', txt: 'S -> aSb | ε', palabra: 'aabb' },
    { nombre: 'Ejemplo con ε, unitarias y reglas largas', txt: 'S -> ASB | ε; A -> aAS | a; B -> SbS | A | bb', palabra: 'aabb' },
    { nombre: 'Expresiones aritméticas', txt: 'E -> E+T | T; T -> T*F | F; F -> (E) | a', palabra: 'a+a*a' },
    { nombre: 'Palíndromos sobre {a, b}', txt: 'S -> aSa | bSb | a | b | ε', palabra: 'abba' },
  ];
  const leer = (txt) => G.parsear(txt.replace(/;/g, '\n'));

  /* ---------- Fig. 1: la transformación en cinco pasos ---------- */

  function montarPasos(cuerpo) {
    let txt = PRESETS[1].txt, pasos = [], k = 0, error = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: PRESETS.map((p, i) => [i, p.nombre]), valor: 1, alCambiar: (v) => { txt = PRESETS[+v].txt; campo.valor = txt; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'O escriba la suya (reglas separadas por ;)', valor: txt, alCambiar: (v) => { txt = v; rep.reiniciar(); }, alEnter: (v) => { txt = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'regla nueva en este paso' },
      { color: C.neutro, borde: C.rejilla, texto: 'regla que ya existía' },
    ]);
    const titulo = VIZ.el('p', { class: 'subtitulo-viz' });
    cuerpo.appendChild(titulo);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una gramática está en forma normal de Chomsky si toda regla es A → BC (dos variables, ninguna es el símbolo inicial) o A → a (un terminal), más S → ε si ε pertenece al lenguaje. El proceso: START, DEL, UNIT, limpiar, TERM y BIN.');
    function iniciar() {
      const r = leer(txt);
      error = r.error || null; pasos = r.g ? G.aCNF(r.g) : []; k = 0;
      return (function* () { for (let i = 1; i < pasos.length; i++) { k = i; yield; } })();
    }
    function dibujar() {
      if (error) { titulo.textContent = ''; lista.replaceChildren(); registro.textContent = error; lectura.set([['estado', 'error']]); return; }
      const p = pasos[k];
      titulo.textContent = `${k}/${pasos.length - 1} — ${p.titulo}`;
      const lineas = [];
      for (const v of G.variables(p.g)) {
        const rs = p.g.reglas.filter((r) => r.izq === v);
        if (!rs.length) continue;
        lineas.push(VIZ.el('div', null, `${v} → `, ...rs.flatMap((r, i) => [i ? VIZ.el('span', null, ' | ') : null, VIZ.el('span', { style: p.nuevas.has(G.clave(r)) ? { background: VIZ.alfa(C.s6, 0.28), fontWeight: 700 } : null }, G.derTexto(r.der))])));
      }
      lista.replaceChildren(...lineas);
      registro.textContent = p.texto;
      lectura.set([['variables', String(G.variables(p.g).length)], ['reglas', String(p.g.reglas.length)], ['reglas nuevas', String(p.nuevas.size)], ['símbolo inicial', p.g.ini], ['¿ya en forma normal?', G.esCNF(p.g) ? 'sí' : 'no']]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el algoritmo CYK ---------- */

  function montarCYK(cuerpo) {
    let txt = PRESETS[0].txt, palabra = PRESETS[0].palabra, gc = null, cyk = null, orden = [], paso = 0, error = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: PRESETS.map((p, i) => [i, p.nombre]), valor: 0, alCambiar: (v) => { txt = PRESETS[+v].txt; palabra = PRESETS[+v].palabra; campo.valor = txt; cp.valor = palabra; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'Gramática (se pasa a CNF)', valor: txt, alCambiar: (v) => { txt = v; rep.reiniciar(); }, alEnter: (v) => { txt = v; rep.reiniciar(); } });
    const cp = ctl.texto({ etiqueta: 'Palabra (hasta 10)', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, '').slice(0, 10); rep.reiniciar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, '').slice(0, 10); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 60 + Math.max(2, palabra.length) * Math.min(44, w / (palabra.length + 1.5)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'celda que se calcula' },
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'primera parte de la partición' },
      { color: VIZ.alfa(C.s3, 0.3), borde: C.s3, texto: 'segunda parte' },
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'contiene al símbolo inicial' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La celda (largo l, inicio i) guarda las variables que generan el trozo de la palabra que empieza en i y tiene l símbolos. Se llena por largo creciente: A está en la celda si hay una regla A → BC con B en la primera parte y C en la segunda, para alguna partición.');

    function iniciar() {
      const r = leer(txt);
      error = r.error || null; paso = 0; orden = [];
      if (r.g) {
        gc = G.aCNF(r.g).pop().g; cyk = G.cyk(gc, palabra);
        for (let l = 1; l <= palabra.length; l++) for (let i = 0; i + l <= palabra.length; i++) orden.push([i, l]);
      }
      lienzo.ajustar(true);
      return (function* () { for (let s = 1; s <= orden.length; s++) { paso = s; yield; } })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, n = palabra.length;
      lienzo.limpiar();
      if (error) { ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(error, 12, H / 2); registro.textContent = 'Corrija la gramática.'; return; }
      if (!n) { registro.textContent = 'Escriba una palabra no vacía (con la palabra vacía basta mirar si S → ε).'; lectura.set([['¿pertenece?', cyk.acepta ? 'sí' : 'no']]); return; }
      const cw = Math.min(50, (W - 20) / n), ch = Math.min(44, (H - 40) / n), x0 = (W - cw * n) / 2, yb = H - 28;
      const hecho = new Set(orden.slice(0, paso).map(([i, l]) => i + ',' + l)), act = paso ? orden[paso - 1] : null;
      geo = { cw, ch, x0, yb, n };
      let partes = null;
      if (act && act[1] > 1) {
        partes = [];
        for (let kk = 1; kk < act[1]; kk++) for (const r of gc.reglas) if (r.der.length === 2 && cyk.tabla[act[0]][kk].has(r.der[0]) && cyk.tabla[act[0] + kk][act[1] - kk].has(r.der[1])) partes.push({ k: kk, regla: r });
      }
      for (let l = 1; l <= n; l++) for (let i = 0; i + l <= n; i++) {
        const x = x0 + (i + (l - 1) / 2) * cw, y = yb - l * ch, k2 = i + ',' + l, esAct = act && act[0] === i && act[1] === l;
        const src1 = partes && partes.some((q) => i === act[0] && l === q.k), src2 = partes && partes.some((q) => i === act[0] + q.k && l === act[1] - q.k);
        const col = esAct ? C.s2 : src1 ? C.s1 : src2 ? C.s3 : hecho.has(k2) && cyk.tabla[i][l].has(gc.ini) && l === n ? C.s6 : null;
        ctx.fillStyle = col ? VIZ.alfa(col, 0.3) : hecho.has(k2) ? C.neutro : C.superficie; ctx.strokeStyle = col || C.rejilla; ctx.lineWidth = col ? 2.5 : 1;
        ctx.fillRect(x - cw / 2 + 1, y + 1, cw - 2, ch - 2); ctx.strokeRect(x - cw / 2 + 1.5, y + 1.5, cw - 3, ch - 3);
        if (hecho.has(k2)) { const s = [...cyk.tabla[i][l]].join(','); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s || '∅', x, y + ch / 2 + 0.5, cw - 6); }
      }
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [...palabra].forEach((c, i) => ctx.fillText(c, x0 + (i + 0.5) * cw, yb + 14));
      const fin = paso === orden.length;
      registro.textContent = !act ? 'Pulse «Un paso»: primero se llena la fila de largo 1 (reglas A → a), luego largo 2, 3…'
        : act[1] === 1 ? `Celda (largo 1, inicio ${act[0]}): «${palabra[act[0]]}» lo generan { ${[...cyk.tabla[act[0]][1]].join(', ') || '∅'} } (reglas A → ${palabra[act[0]]}).`
          : `Celda (largo ${act[1]}, inicio ${act[0]}) = «${palabra.slice(act[0], act[0] + act[1])}»: ${partes.length ? partes.map((q) => `${q.regla.izq} → ${q.regla.der.join(' ')} con partición ${q.k}+${act[1] - q.k}`).join('; ') : 'ninguna partición aplica'} ⇒ { ${[...cyk.tabla[act[0]][act[1]]].join(', ') || '∅'} }.`;
      if (fin) registro.textContent += cyk.acepta ? `  ✔ ${gc.ini} está en la celda superior: la palabra pertenece.` : `  ✘ ${gc.ini} no está en la celda superior: la palabra no pertenece.`;
      lectura.set([['gramática en CNF', `${gc.reglas.length} reglas, ${G.variables(gc).length} variables`], ['palabra', palabra], ['celdas', `${paso} de ${orden.length}`], ['veredicto', fin ? (cyk.acepta ? 'pertenece' : 'no pertenece') : '…'], ['costo', `O(n³·|G|) = ${n * n * n}·${gc.reglas.length}`]]);
    }
    lienzo.alDibujar = () => (cyk || error) && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !cyk) return;
      const { x, y } = lienzo.posicion(ev), l = Math.round((geo.yb - y) / geo.ch + 0.5) - 0, ll = Math.floor((geo.yb - y) / geo.ch + 1);
      void l;
      if (ll < 1 || ll > geo.n) return tip.ocultar();
      const i = Math.round((x - geo.x0) / geo.cw - 0.5 - (ll - 1) / 2);
      if (i < 0 || i + ll > geo.n || !orden.slice(0, paso).some(([a, b]) => a === i && b === ll)) return tip.ocultar();
      tip.mostrar(x, y, `«${palabra.slice(i, i + ll)}»<br>variables: ${[...cyk.tabla[i][ll]].join(', ') || '∅'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('chomsky-normal-form', {
    intro: String.raw`
      <p>Las gramáticas pueden tener reglas de formas muy distintas: producciones vacías, cadenas de variables, mezclas de terminales y variables. La <strong>forma normal de Chomsky</strong> (CNF) las reduce a solo dos tipos: <code>A → B C</code> (dos variables) y <code>A → a</code> (un terminal). Todo lenguaje libre de contexto se puede generar con una gramática en CNF.</p>
      <p>Es una forma estándar, cómoda para demostrar teoremas y para algoritmos: los árboles de derivación se vuelven <em>binarios</em>, y con ellos funciona el algoritmo <strong>CYK</strong>, que decide si una palabra pertenece al lenguaje en tiempo \(O(n^3)\).</p>`,
    visualizaciones: [
      {
        titulo: 'La transformación a CNF paso a paso',
        descripcion: 'Avance por los pasos START, DEL, UNIT, limpieza, TERM y BIN. Las reglas nuevas de cada paso aparecen resaltadas; la descripción explica qué se hizo y por qué.',
        montar: montarPasos,
      },
      {
        titulo: 'Decidir pertenencia con CYK',
        descripcion: 'La gramática se lleva a CNF y se llena la tabla triangular de CYK por largos crecientes. Si el símbolo inicial llega a la celda superior, la palabra pertenece.',
        montar: montarCYK,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una GLC está en <strong>forma normal de Chomsky</strong> si todas sus producciones son de la forma</p>
      \[ A \to BC \quad (B, C \in V \setminus \{S\}), \qquad A \to a \quad (a \in \Sigma), \qquad S \to \varepsilon \ \ (\text{solo si } \varepsilon \in L). \]
      <h2>Algoritmo de conversión</h2>
      <ol>
        <li><strong>START.</strong> Se agrega \(S_0 \to S\) con \(S_0\) nuevo inicial, para que el inicial nunca aparezca a la derecha.</li>
        <li><strong>DEL.</strong> Se calculan las variables anulables (\(A \Rightarrow^* \varepsilon\)). Cada regla \(A \to X_1\cdots X_k\) se reemplaza por todas las variantes que omiten algún subconjunto de variables anulables (sin dejar el lado derecho vacío), y se borran las reglas \(A \to \varepsilon\) (excepto \(S_0 \to \varepsilon\) si hace falta).</li>
        <li><strong>UNIT.</strong> Para cada par \((A, B)\) con \(A \Rightarrow^* B\) solo por reglas unitarias, se agrega \(A \to \alpha\) por cada regla no unitaria \(B \to \alpha\), y se borran las reglas \(A \to B\).</li>
        <li><strong>Limpieza.</strong> Se eliminan las variables inútiles (<a href="tema.html?id=grammar-simplification">Useless Symbols &amp; Simplification</a>).</li>
        <li><strong>TERM.</strong> En las reglas de largo \(\ge 2\), cada terminal \(a\) se sustituye por una variable nueva \(X_a\) con la regla \(X_a \to a\).</li>
        <li><strong>BIN.</strong> Una regla \(A \to B_1B_2\cdots B_k\) con \(k > 2\) se reemplaza por \(A \to B_1Y_1,\ Y_1 \to B_2Y_2,\ \dots,\ Y_{k-2} \to B_{k-1}B_k\), con \(Y_i\) variables nuevas.</li>
      </ol>
      <p>El orden importa: DEL antes de UNIT evita que reaparezcan reglas vacías. En el peor caso el tamaño pasa de \(|G|\) a \(O(|G|^2)\), y con la eliminación de producciones vacías en reglas largas puede crecer exponencialmente si no se binariza antes (por eso algunos textos hacen BIN primero).</p>
      <h2>Árboles binarios</h2>
      <p>En CNF todo árbol de derivación de una palabra de largo \(n \ge 1\) es binario con exactamente \(n\) hojas, \(n-1\) nodos internos con dos hijos y \(n\) nodos de la forma \(A \to a\): la derivación tiene exactamente \(2n - 1\) pasos. Esto es la base del algoritmo CYK y de una demostración sencilla del lema de bombeo para lenguajes libres de contexto.</p>
      <h2>Algoritmo CYK (Cocke-Younger-Kasami)</h2>
      <p>Sea \(w = w_1 \cdots w_n\) y \(T[i, l]\) el conjunto de variables que derivan \(w_i \cdots w_{i+l-1}\):</p>
      \[ T[i, 1] = \{ A : A \to w_i \in P \}, \qquad T[i, l] = \bigcup_{k=1}^{l-1} \{ A : A \to BC \in P,\ B \in T[i, k],\ C \in T[i+k, l-k] \}. \]
      <p>Entonces \(w \in L(G)\) si y solo si \(S \in T[1, n]\). Hay \(O(n^2)\) celdas, cada una con \(O(n)\) particiones y \(O(|G|)\) reglas: tiempo \(\Theta(n^3 |G|)\), memoria \(\Theta(n^2)\). Con una pequeña extensión, además de decidir, CYK recupera un árbol de derivación y, con probabilidades, el árbol más probable (análisis sintáctico probabilístico).</p>
      <div class="recuadro"><p>CYK funciona para <em>cualquier</em> GLC, incluidas las ambiguas, pero necesita la CNF. Los analizadores para gramáticas restringidas (LL, LR) son lineales, y el algoritmo de Earley generaliza CYK sin exigir la CNF, con costo \(O(n^3)\) en general.</p></div>`,
  });
})();
