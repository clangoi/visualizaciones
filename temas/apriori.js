(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const P = M.PRODUCTOS;

  const corto = (X) => X.map((i) => P[i]).join(' + ');

  /* ---------- Fig. 1: Apriori nivel por nivel ---------- */

  function montarNiveles(cuerpo) {
    let semilla = 1, minSop = 0.12, T = [], niveles = [], vista = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Soporte mínimo', min: 0.03, max: 0.4, paso: 0.01, valor: minSop, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minSop = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevas canastas', () => { semilla++; rep.reiniciar(); });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'frecuente: pasa a L_k' },
      { color: C.s8, texto: 'contado e infrecuente' },
      { color: C.tenue, texto: '✂ podado sin contar (un subconjunto no es frecuente)' },
      { color: C.inactivo, texto: 'candidato aún sin contar' },
    ]);
    const caja = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nivel genera candidatos de tamaño k uniendo frecuentes de tamaño k − 1, poda los que tienen algún subconjunto infrecuente y solo entonces cuenta su soporte recorriendo las 200 canastas.');
    function iniciar() {
      T = M.transacciones(200, semilla);
      niveles = M.apriori(T, minSop, P.length);
      vista = [];
      return (function* () {
        for (const nv of niveles) {
          const v = { k: nv.k, fase: 'generar', nv };
          vista.push(v);
          registro.dataset.msg = nv.k === 1 ? 'Nivel 1: cada producto es un candidato.' : `Nivel ${nv.k}: ${nv.candidatos.length} candidatos al unir pares de L${nv.k - 1} que comparten sus primeros ${nv.k - 2} ítems.`;
          yield;
          if (nv.candidatos.some((c) => c.podado)) { v.fase = 'podar'; registro.dataset.msg = `Poda: ${nv.candidatos.filter((c) => c.podado).length} candidatos tienen un subconjunto de tamaño ${nv.k - 1} infrecuente; se descartan sin contar.`; yield; }
          v.fase = 'contar';
          registro.dataset.msg = `Conteo: ${nv.candidatos.filter((c) => !c.podado).length} candidatos contados en una pasada; ${nv.frecuentes.length} alcanzan el soporte mínimo.`;
          yield;
        }
        registro.dataset.msg = `Terminado: no quedan candidatos de tamaño ${niveles.length + 1}.`;
      })();
    }
    function dibujar() {
      caja.replaceChildren(...vista.map((v) => {
        const fichas = v.nv.candidatos.map((c) => {
          const txt = `${c.podado && v.fase !== 'generar' ? '✂ ' : ''}${corto(c.X)}${v.fase === 'contar' && !c.podado ? ` ${Math.round(c.sop * 100)}%` : ''}`;
          if (v.fase === 'generar' || (!c.podado && v.fase === 'podar')) return VIZ.ficha(txt, { color: C.inactivo, tinta: C.tinta2 });
          if (c.podado) return VIZ.ficha(txt, { color: C.tenue, tinta: C.apagado });
          return c.sop >= minSop ? VIZ.ficha(txt, { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) }) : VIZ.ficha(txt, { color: C.s8, tinta: C.s8 });
        });
        return VIZ.el('div', null, VIZ.el('span', { class: 'fichas-titulo' }, `C${v.k}`), VIZ.el('span', { class: 'fichas' }, ...fichas));
      }));
      registro.textContent = registro.dataset.msg || 'Pulse Un paso para generar los candidatos de tamaño 1.';
      const contados = niveles.slice(0, vista.length).reduce((s, nv) => s + nv.candidatos.filter((c) => !c.podado).length, 0);
      lectura.set([
        ['niveles procesados', String(vista.length)],
        ['itemsets frecuentes hallados', String(vista.filter((v) => v.fase === 'contar').reduce((s, v) => s + v.nv.frecuentes.length, 0))],
        ['candidatos contados', String(contados)],
        ['itemsets posibles (2⁸ − 1)', '255'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cuánto ahorra la poda ---------- */

  const D = 20;
  function canastasGrandes(semilla) {
    const rnd = VIZ.semilla(semilla), patrones = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9, 10, 11], [2, 12], [13, 14, 15]];
    return Array.from({ length: 400 }, () => {
      const c = new Set();
      for (const p of patrones) if (rnd() < 0.25) p.forEach((i) => { if (rnd() < 0.9) c.add(i); });
      for (let i = 0; i < D; i++) if (rnd() < 0.08) c.add(i);
      return [...c].sort((a, b) => a - b);
    });
  }
  const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

  function montarAhorro(cuerpo) {
    let semilla = 1, minSop = 0.08, T = canastasGrandes(semilla), filas = [], hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Soporte mínimo', min: 0.02, max: 0.3, paso: 0.01, valor: minSop, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minSop = v; calcular(); } });
    ctl.boton('Nuevas canastas', () => { semilla++; T = canastasGrandes(semilla); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['bruta', 'todos los k-itemsets C(20, k)', C.inactivo], ['generados', 'candidatos generados', C.s4], ['contados', 'contados tras la poda', C.s1], ['frecuentes', 'frecuentes', C.s6]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '400 canastas con 20 productos y cinco patrones plantados. Escala logarítmica: la fuerza bruta contaría más de un millón de itemsets; Apriori cuenta unos cientos.');
    function calcular() {
      const nv = M.apriori(T, minSop, D);
      filas = nv.map((n) => ({ k: n.k, bruta: comb(D, n.k), generados: n.candidatos.length, contados: n.candidatos.filter((c) => !c.podado).length, frecuentes: n.frecuentes.length }));
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const K = filas.length;
      pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: K + 0.5, ymin: 0.8, ymax: Math.max(...filas.map((f) => f.bruta)) * 2 }, { etiquetaX: 'tamaño k', etiquetaY: 'itemsets (escala log)', logY: true, ticksX: filas.map((f) => f.k), formatoX: (v) => String(v), formatoY: (v) => VIZ.entero(v) });
      pl.ejes();
      const w = Math.min(60, (pl.x1 - pl.x0) / K) * 0.8, bw = w / SER.length;
      filas.forEach((f, i) => SER.forEach(([key, , col], j) => {
        const v = f[key]; if (!v) return;
        const x = pl.sx(f.k) - w / 2 + j * bw, y = pl.sy(v);
        ctx.fillStyle = i === hover ? VIZ.alfa(col, 0.7) : col;
        ctx.beginPath(); ctx.roundRect(x + 1, y, Math.max(1, bw - 2), pl.y0 - y, [3, 3, 0, 0]); ctx.fill();
      }));
      const tot = (key) => M.suma(filas.map((f) => f[key]));
      lectura.set([
        ['contados por Apriori', VIZ.entero(tot('contados'))],
        ['podados sin contar', VIZ.entero(tot('generados') - tot('contados'))],
        ['frecuentes', VIZ.entero(tot('frecuentes'))],
        ['fuerza bruta (2²⁰ − 1)', VIZ.entero(2 ** D - 1)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(filas.length - 1, Math.round(pl.ix(x)) - 1));
      if (i !== hover) { hover = i; dibujar(); }
      const f = filas[i];
      tip.mostrar(x, y, `k = <b>${f.k}</b>` + SER.map(([key, t, c]) => VIZ.filaTooltip(c, t, VIZ.entero(f[key]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (filas.length) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('apriori', {
    intro: String.raw`
      <p><strong>Apriori</strong> (Agrawal y Srikant, 1994) encuentra todos los <a href="tema.html?id=itemsets-support">itemsets frecuentes</a>
      sin contar los \(2^d\) posibles. Avanza por niveles: primero los de un ítem, luego los de dos, y así, y en cada nivel solo
      considera candidatos cuyos subconjuntos ya resultaron frecuentes.</p>
      <p>La idea descansa en el <strong>principio de monotonía</strong>: si \(\{\text{pan}, \text{leche}\}\) no es frecuente, ningún
      superconjunto suyo puede serlo, así que toda esa rama se descarta sin mirar los datos.</p>`,
    visualizaciones: [
      {
        titulo: 'Apriori nivel por nivel',
        descripcion: 'Generación de candidatos, poda y conteo en cada nivel. Baje el soporte mínimo para ver niveles más profundos y más podas.',
        montar: montarNiveles,
      },
      {
        titulo: 'Cuánto ahorra la poda',
        descripcion: 'Por tamaño k: itemsets posibles, candidatos generados, los que de verdad se cuentan y los frecuentes.',
        montar: montarAhorro,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>L₁ ← {ítems con soporte ≥ minsup}
k ← 2
mientras L_{k−1} ≠ ∅:
    C_k ← unir(L_{k−1})                   ← pares que comparten k − 2 ítems
    C_k ← {c ∈ C_k : todo (k−1)-subconjunto de c está en L_{k−1}}   ← poda
    para cada transacción t: incrementar σ(c) para c ∈ C_k, c ⊆ t
    L_k ← {c ∈ C_k : σ(c)/N ≥ minsup}
    k ← k + 1
devolver ⋃ L_k</code></pre>
      <h2>Generación de candidatos</h2>
      <p>Con los itemsets ordenados, se unen \(A = (a_1, \dots, a_{k-2}, x)\) y \(B = (a_1, \dots, a_{k-2}, y)\) con \(x &lt; y\) en
      \((a_1, \dots, a_{k-2}, x, y)\). Esto produce cada candidato una sola vez y garantiza que dos de sus subconjuntos sean frecuentes; la poda
      revisa los \(k - 2\) restantes.</p>
      <div class="recuadro"><p><strong>Corrección.</strong> Todo \(k\)-itemset frecuente \(Z\) tiene sus \(k\) subconjuntos de tamaño \(k - 1\)
      frecuentes (monotonía); en particular los dos que comparten los primeros \(k - 2\) ítems de \(Z\) están en \(L_{k-1}\), así que \(Z\) se genera y
      no se poda. Ningún itemset frecuente se pierde.</p></div>
      <h2>Costo</h2>
      <ul>
        <li>Una pasada sobre los datos por nivel: \(k_{\max}\) pasadas.</li>
        <li>El número de candidatos puede ser enorme si hay itemsets frecuentes largos: uno de 20 ítems obliga a generar sus \(2^{20}\) subconjuntos.</li>
        <li>Bajar <em>minsup</em> aumenta rápidamente los candidatos.</li>
      </ul>
      <h2>Alternativas</h2>
      <p><strong>FP-growth</strong> comprime las transacciones en un árbol de prefijos y crece patrones sin generar candidatos (dos pasadas).
      <strong>Eclat</strong> usa la representación vertical e intersecta listas de transacciones. Para resumir la salida se usan los
      itemsets <a href="tema.html?id=itemset-lattice">maximales y cerrados</a>.</p>`,
  });
})();