(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;
  const P = M.PRODUCTOS;

  /* ---------- Fig. 1: contar canastas ---------- */

  function montarCanastas(cuerpo) {
    let semilla = 1, T = M.transacciones(30, semilla), elegidos = { 0: true, 4: true };
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(P.map((p, i) => ({ clave: i, texto: p, activo: !!elegidos[i] })), (e) => { elegidos = e; dibujar(); });
    ctl.boton('Nuevas canastas', () => { semilla++; T = M.transacciones(30, semilla); dibujar(); }, { primario: true });
    const tabla = M.tabla(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    cuerpo.dataset.sinLeyenda = 'tabla sin colores con significado; las filas que contienen el conjunto se resaltan';
    VIZ.nota(cuerpo, 'Marque productos para formar un itemset X. Las filas resaltadas son las transacciones que contienen todos los productos de X; su fracción es el soporte.');
    function dibujar() {
      const X = P.map((_, i) => i).filter((i) => elegidos[i]);
      const filas = T.map((t, r) => [{ texto: `T${r + 1}`, clase: 'izq' }, ...P.map((_, i) => (t.includes(i) ? (X.includes(i) ? '●' : '○') : ''))]);
      tabla.set([{ texto: 'id', clase: 'izq' }, ...P], filas);
      // Resalta las filas que contienen X.
      [...tabla.tabla.querySelectorAll('tbody tr')].forEach((tr, r) => tr.classList.toggle('activa', X.length > 0 && M.contiene(T[r], X)));
      const n = T.filter((t) => M.contiene(t, X)).length;
      lectura.set([
        ['itemset X', X.length ? M.nombreConj(X) : '∅'],
        ['cuenta σ(X)', String(n)],
        ['soporte s(X) = σ(X) / N', M.pct(n / T.length)],
        ['itemsets posibles con 8 productos', VIZ.entero(2 ** P.length - 1)],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: el soporte de todos los itemsets pequeños ---------- */

  function montarSoportes(cuerpo) {
    let semilla = 1, T = M.transacciones(200, semilla), minSop = 0.1, tam = '12', barras = [], hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Soporte mínimo', min: 0.01, max: 0.5, paso: 0.01, valor: minSop, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minSop = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Tamaños', opciones: [['1', 'solo 1 producto'], ['12', '1 y 2 productos'], ['123', '1, 2 y 3 productos']], valor: tam, alCambiar: (v) => { tam = v; calcular(); } });
    ctl.boton('Nuevas canastas', () => { semilla++; T = M.transacciones(200, semilla); calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'frecuente (s ≥ mínimo)' }, { color: C.inactivo, texto: 'infrecuente' }, { color: C.s2, texto: 'soporte mínimo', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '200 canastas sintéticas. Las barras son todos los itemsets de los tamaños elegidos, ordenados por soporte. Observe que ningún itemset tiene más soporte que sus subconjuntos.');
    function calcular() {
      const conj = [];
      const n = P.length, maxT = Math.max(...tam.split('').map(Number));
      (function gen(desde, X) {
        if (X.length && tam.includes(String(X.length))) conj.push(X);
        if (X.length === maxT) return;
        for (let i = desde; i < n; i++) gen(i + 1, [...X, i]);
      })(0, []);
      barras = conj.map((X) => ({ X, s: M.soporte(T, X) })).filter((b) => b.s > 0).sort((a, b) => b.s - a.s);
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: barras.length, ymin: 0, ymax: Math.max(...barras.map((b) => b.s)) * 1.08 }, { etiquetaY: 'soporte', ticksX: [], formatoY: (v) => `${Math.round(v * 100)}%` });
      pl.ejes();
      const w = (pl.x1 - pl.x0) / barras.length;
      barras.forEach((b, i) => {
        ctx.fillStyle = i === hover ? C.s2 : b.s >= minSop ? C.s1 : C.inactivo;
        const y = pl.sy(b.s);
        ctx.beginPath(); ctx.roundRect(pl.x0 + i * w + 1, y, Math.max(1, w - 2), pl.y0 - y, [Math.min(4, w / 2), Math.min(4, w / 2), 0, 0]); ctx.fill();
        if (w > 13) { ctx.save(); ctx.translate(pl.x0 + i * w + w / 2, pl.y0 - 4); ctx.rotate(-Math.PI / 2); ctx.fillStyle = b.s >= minSop ? C.sobre : C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; if (pl.y0 - y > 60) ctx.fillText(b.X.map((j) => P[j]).join('+'), 0, 0); ctx.restore(); }
      });
      VIZ.trazar(ctx, pl, [[0, minSop], [barras.length, minSop]], C.s2, 2, [5, 4]);
      const fr = barras.filter((b) => b.s >= minSop);
      lectura.set([
        ['itemsets mostrados', String(barras.length)],
        ['frecuentes', String(fr.length)],
        ['el más frecuente de tamaño 2', (() => { const d = barras.find((b) => b.X.length === 2); return d ? `${M.nombreConj(d.X)} ${M.pct(d.s, 0)}` : '—'; })()],
      ]);
    }
    lienzo.alDibujar = () => barras.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = pl && pl.dentro(x, y) ? Math.floor(((x - pl.x0) / (pl.x1 - pl.x0)) * barras.length) : -1;
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0 || i >= barras.length) return tip.ocultar();
      tip.mostrar(x, y, `${M.nombreConj(barras[i].X)}<br>soporte <b>${M.pct(barras[i].s)}</b> (${Math.round(barras[i].s * T.length)} canastas)`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('itemsets-support', {
    intro: String.raw`
      <p>El <strong>análisis de canastas</strong> busca qué productos se compran juntos. Cada compra es una <strong>transacción</strong>,
      un conjunto de ítems, y cualquier conjunto de ítems es un <strong>itemset</strong>. El primer paso es encontrar los
      <strong>itemsets frecuentes</strong>: los que aparecen en una fracción suficiente de las transacciones.</p>
      <p>Esa fracción es el <strong>soporte</strong>. Es simple de calcular para un itemset, pero con \(d\) productos hay \(2^d - 1\)
      itemsets posibles: con mil productos, más que átomos en el universo. Todo el área de patrones frecuentes trata de
      evitar contarlos todos.</p>`,
    visualizaciones: [
      {
        titulo: 'Contar canastas',
        descripcion: 'Elija productos y vea qué transacciones los contienen a todos. Agregue un producto más: el soporte nunca sube.',
        montar: montarCanastas,
      },
      {
        titulo: 'El soporte de los itemsets pequeños',
        descripcion: 'Todos los itemsets de tamaño 1 a 3 ordenados por soporte, con el umbral de soporte mínimo.',
        montar: montarSoportes,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea \(I = \{i_1, \dots, i_d\}\) el conjunto de ítems y \(T = \{t_1, \dots, t_N\}\) las transacciones, con \(t_j \subseteq I\).
      Para un itemset \(X \subseteq I\):</p>
      \[ \sigma(X) = |\{t \in T : X \subseteq t\}|, \qquad s(X) = \frac{\sigma(X)}{N}. \]
      <p>\(X\) es <strong>frecuente</strong> si \(s(X) \ge \text{minsup}\). Un itemset de \(k\) ítems se llama \(k\)-itemset.</p>
      <h2>Monotonía del soporte</h2>
      <div class="recuadro"><p>Si \(X \subseteq Y\), entonces \(s(Y) \le s(X)\): toda transacción que contiene a \(Y\) contiene a \(X\).
      En consecuencia, todo subconjunto de un itemset frecuente es frecuente, y todo superconjunto de uno infrecuente es infrecuente
      (propiedad <em>anti-monótona</em>, o principio Apriori).</p></div>
      <p>Esa propiedad es la que permite <a href="tema.html?id=apriori">podar</a> la búsqueda sin perder itemsets frecuentes.</p>
      <h2>Representación</h2>
      <p>Las transacciones se pueden ver como una matriz binaria \(N \times d\) (la tabla de la figura). En la práctica es muy dispersa,
      y se guarda horizontalmente (lista de ítems por transacción) o verticalmente (lista de transacciones por ítem, los
      <em>tidsets</em>: el soporte de \(X \cup Y\) es el tamaño de la intersección de sus tidsets, la idea de Eclat).</p>
      <h2>Costo de la fuerza bruta</h2>
      <p>Contar el soporte de todos los itemsets cuesta \(O(N \cdot w \cdot 2^d)\) comparaciones (\(w\): ancho medio de una transacción).
      La <a href="tema.html?id=itemset-lattice">retícula de itemsets</a> muestra cuántos de esos conjuntos se pueden descartar.</p>`,
  });
})();