(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  const LETRAS = 'ABCDEFGHIJKLMNOP';
  // Letra de cada actividad, en el orden en que aparecen en ejecuciones sin desvíos.
  function codigosDe(arbol) {
    const base = P.simular(arbol, 60, 7, { ruido: 0 }), orden = [];
    base.forEach((c) => P.trazaDe(c).forEach((a) => { if (!orden.includes(a)) orden.push(a); }));
    return Object.fromEntries(orden.map((a, i) => [a, LETRAS[i]]));
  }
  const PROCS = [['reclamos', 'Reclamos (bucle)'], ['pedidos', 'Pedidos (paralelo)']];
  const CODS = {};
  const codigos = (p) => CODS[p] || (CODS[p] = codigosDe(P.procesos[p].arbol));
  const textoTraza = (tr, cod) => tr.map((a) => cod[a]).join(' ');
  function claveDe(cuerpo, cod) {
    const caja = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(caja);
    return (c) => caja.replaceChildren(...Object.entries(c).map(([a, l]) => VIZ.ficha(`${l} = ${a}`)));
  }

  /* ---------- Fig. 1: distribución de variantes y cobertura ---------- */

  function montarFrecuencias(cuerpo) {
    let proc = 'reclamos', n = 300, ruido = 0.1, objetivo = 80, semilla = 1, sel = 0, vars = [], cum = [], plano = null, K = 1, k80 = 1, cod = codigos(proc);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCS, valor: proc, alCambiar: (v) => { proc = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 20, max: 500, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Desvíos (ruido)', min: 0, max: 0.4, paso: 0.05, valor: ruido, formato: (v) => Math.round(v * 100) + ' %', alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Cobertura buscada', min: 50, max: 100, paso: 5, valor: objetivo, formato: (v) => v + ' %', alCambiar: (v) => { objetivo = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'variantes necesarias para la cobertura', forma: 'cuadro' },
      { color: C.inactivo, texto: 'cola de variantes', forma: 'cuadro' },
      { color: C.s2, texto: 'variante seleccionada', forma: 'cuadro' },
      { color: C.tinta, texto: 'cobertura acumulada', forma: 'linea' },
    ]);
    const mostrarClave = claveDe(cuerpo, cod);
    const fichasSel = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichasSel);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las barras son el porcentaje de casos de cada variante, de la más frecuente a la menos; la línea suma ese porcentaje. Haga clic en una barra para ver su traza. Pruebe «Reclamos (bucle)» con 500 casos: el bucle crea muchas variantes raras. Suba los desvíos y vea crecer la cola.');

    function calcular() {
      cod = codigos(proc); mostrarClave(cod);
      const log = P.simular(P.procesos[proc].arbol, n, semilla * 17 + 3, { ruido });
      vars = P.variantes(log);
      let s = 0;
      cum = vars.map((v) => (s += v.n) / n);
      K = Math.min(vars.length, 40);
      k80 = cum.findIndex((c) => c >= objetivo / 100 - 1e-9) + 1;
      sel = Math.min(sel, vars.length - 1);
      dibujar();
    }
    function dibujar() {
      if (!vars.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0.5, xmax: K + 0.5, ymin: 0, ymax: 100 }, {
        etiquetaX: vars.length > K ? `variante (por frecuencia; se muestran ${K} de ${vars.length})` : 'variante (ordenada por frecuencia)',
        etiquetaY: '% de casos', formatoY: (v) => v + ' %', ticksX: K <= 20 ? Array.from({ length: K }, (_, i) => i + 1) : undefined,
      });
      plano.ejes();
      const ancho = Math.max(2, plano.sx(2) - plano.sx(1) - 2);
      for (let i = 0; i < K; i++) {
        const x = plano.sx(i + 1) - ancho / 2, y = plano.sy(100 * vars[i].n / n), base = plano.sy(0);
        ctx.fillStyle = i === sel ? C.s2 : i < k80 ? C.s1 : C.inactivo;
        ctx.beginPath(); ctx.roundRect(x, y, ancho, Math.max(1, base - y), [4, 4, 0, 0]); ctx.fill();
      }
      // Cobertura buscada.
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(objetivo)); ctx.lineTo(plano.x1, plano.sy(objetivo)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right';
      ctx.fillText(`objetivo ${objetivo} %`, plano.x1 - 2, plano.sy(objetivo) - 4);
      ctx.textAlign = 'start';
      VIZ.trazar(ctx, plano, cum.slice(0, K).map((c, i) => [i + 1, 100 * c]), C.tinta, 2);
      cum.slice(0, K).forEach((c, i) => { if (K <= 25) VIZ.marcador(ctx, plano.sx(i + 1), plano.sy(100 * c), C.tinta, 3); });
      fichasSel.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, `Variante ${sel + 1}:`), ...vars[sel].traza.map((a) => VIZ.ficha(cod[a])));
      const unicas = vars.filter((v) => v.n === 1).length;
      registro.textContent = `Variante ${sel + 1}: ${vars[sel].n} caso(s), ${VIZ.fmt(100 * vars[sel].n / n, 3)} % del registro; con las ${k80} primeras variantes se cubre el ${VIZ.fmt(100 * cum[k80 - 1], 3)} % de los casos.`;
      lectura.set([
        ['casos', String(n)],
        ['variantes distintas', String(vars.length)],
        [`variantes para ${objetivo} %`, `${k80} (${VIZ.fmt(100 * k80 / vars.length, 3)} % de las variantes)`],
        ['variantes de un solo caso', `${unicas} (${VIZ.fmt(100 * unicas / vars.length, 3)} %)`],
        ['la más frecuente', VIZ.fmt(100 * vars[0].n / n, 3) + ' %'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const rangoDe = (x, y) => {
      if (!plano || !plano.dentro(x, y)) return -1;
      const i = Math.round(plano.ix(x)) - 1;
      return i >= 0 && i < K ? i : -1;
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = rangoDe(x, y);
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `variante <b>${i + 1}</b><br>${textoTraza(vars[i].traza, cod)}<br>${VIZ.entero(vars[i].n)} casos (${VIZ.fmt(100 * vars[i].n / n, 3)} %)<br>acumulado <b>${VIZ.fmt(100 * cum[i], 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = rangoDe(x, y);
      if (i >= 0) { sel = i; dibujar(); }
    });
    calcular();
  }

  /* ---------- Fig. 2: comparar dos trazas (distancia de edición) ---------- */

  function montarComparar(cuerpo) {
    const cod = codigos('pedidos');
    const top = P.variantes(P.simular(P.procesos.pedidos.arbol, 200, 5)).slice(0, 8);
    let ia = 0, ib = 1, A = [], B = [], D = [], fase = 'tabla', actual = null, camino = [], ops = [], hover = null, celdas = 0;
    const ctl = VIZ.controles(cuerpo);
    const opciones = top.map((v, i) => [String(i), `v${i + 1} · ${textoTraza(v.traza, cod)}`]);
    ctl.selector({ etiqueta: 'Traza A (filas)', opciones, valor: String(ia), alCambiar: (v) => { ia = +v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Traza B (columnas)', opciones, valor: String(ib), alCambiar: (v) => { ib = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    let cs = 30;
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { cs = Math.max(20, Math.min(34, (w - 40) / (B.length + 2))); return Math.ceil(30 + (A.length + 2) * cs); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'celda que se calcula', forma: 'cuadro' },
      { color: C.s3, texto: 'celdas de las que depende', forma: 'cuadro' },
      { color: C.s6, texto: 'camino óptimo (alineación)', forma: 'cuadro' },
      { color: C.s8, texto: 'actividad distinta o sin pareja', forma: 'cuadro' },
    ]);
    const mostrarClave = claveDe(cuerpo, cod);
    mostrarClave(cod);
    const alineacion = VIZ.el('div');
    cuerpo.appendChild(alineacion);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La celda (i, j) guarda cuántas inserciones, borrados o sustituciones separan los primeros i pasos de A de los primeros j de B. Elija dos variantes y recorra el algoritmo; la última fila de fichas muestra la alineación resultante. Dos variantes que solo difieren en el orden de actividades en paralelo están a distancia 2.');

    const T = (a) => (a === null ? '—' : cod[a]);
    function iniciar() {
      A = top[ia].traza; B = top[ib].traza;
      D = Array.from({ length: A.length + 1 }, (_, i) => Array.from({ length: B.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : null)));
      fase = 'tabla'; actual = null; camino = []; ops = []; celdas = 0;
      lienzo.ajustar(true);
      return (function* () {
        for (let i = 1; i <= A.length; i++) for (let j = 1; j <= B.length; j++) {
          actual = [i, j];
          D[i][j] = Math.min(D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
          celdas++;
          yield;
        }
        fase = 'camino';
        let i = A.length, j = B.length;
        camino = [[i, j]]; actual = null;
        yield;
        while (i > 0 || j > 0) {
          if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) {
            ops.unshift({ a: A[i - 1], b: B[j - 1], t: A[i - 1] === B[j - 1] ? 'igual' : 'sust' }); i--; j--;
          } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.unshift({ a: A[i - 1], b: null, t: 'borrar' }); i--; }
          else { ops.unshift({ a: null, b: B[j - 1], t: 'insertar' }); j--; }
          camino.push([i, j]);
          yield;
        }
        fase = 'fin';
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = Math.max(8, (W - (B.length + 2) * cs) / 2), y0 = 6;
      const cx = (j) => x0 + (j + 1) * cs, cy = (i) => y0 + (i + 1) * cs;
      ctx.font = VIZ.fuente(12, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Encabezados.
      ctx.fillStyle = C.tinta2;
      for (let j = 0; j < B.length; j++) ctx.fillText(cod[B[j]], cx(j + 1) + cs / 2, y0 + cs / 2);
      for (let i = 0; i < A.length; i++) ctx.fillText(cod[A[i]], x0 + cs / 2, cy(i + 1) + cs / 2);
      const dep = actual ? [[actual[0] - 1, actual[1] - 1], [actual[0] - 1, actual[1]], [actual[0], actual[1] - 1]] : [];
      const enCamino = new Set(camino.map(([i, j]) => i + ',' + j));
      for (let i = 0; i <= A.length; i++) for (let j = 0; j <= B.length; j++) {
        const x = cx(j), y = cy(i), v = D[i][j];
        const esAct = actual && actual[0] === i && actual[1] === j, esDep = dep.some(([a, b]) => a === i && b === j);
        ctx.fillStyle = esAct ? VIZ.alfa(C.s2, 0.35) : enCamino.has(i + ',' + j) ? VIZ.alfa(C.s6, 0.3) : esDep ? VIZ.alfa(C.s3, 0.25) : v === null ? C.fondo2 : C.neutro;
        ctx.strokeStyle = esAct ? C.s2 : esDep ? C.s3 : enCamino.has(i + ',' + j) ? C.s6 : C.rejilla;
        ctx.lineWidth = esAct || enCamino.has(i + ',' + j) ? 2 : 1;
        ctx.fillRect(x, y, cs, cs); ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        if (hover && hover[0] === i && hover[1] === j) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2); }
        if (v !== null) { ctx.fillStyle = C.tinta; ctx.fillText(String(v), x + cs / 2, y + cs / 2 + 0.5); }
      }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const d = D[A.length][B.length];
      // Alineación como dos filas de fichas.
      if (fase === 'fin') {
        const fila = (lado) => VIZ.el('div', { class: 'fichas' }, VIZ.el('span', { class: 'fichas-titulo' }, lado === 'a' ? 'Traza A:' : 'Traza B:'),
          ...ops.map((o) => {
            const v = o[lado];
            if (v === null) return VIZ.ficha('—', { color: C.s8, tinta: C.s8 });
            return VIZ.ficha(cod[v], o.t === 'igual' ? {} : { color: C.s8, tinta: C.s8 });
          }));
        alineacion.replaceChildren(fila('a'), fila('b'));
      } else alineacion.replaceChildren();
      registro.textContent = fase === 'tabla'
        ? (actual ? `Celda (${actual[0]}, ${actual[1]}): ${T(A[actual[0] - 1])} frente a ${T(B[actual[1] - 1])}. Mínimo entre diagonal ${A[actual[0] - 1] === B[actual[1] - 1] ? '(iguales: +0)' : '(distintas: +1)'}, arriba +1 y a la izquierda +1 = ${D[actual[0]][actual[1]]}.`
          : 'Primera fila y primera columna: comparar con una traza vacía cuesta tantas operaciones como actividades haya.')
        : fase === 'camino' ? `Se recorre la tabla de vuelta desde (${A.length}, ${B.length}) siguiendo el origen de cada mínimo.`
          : `Alineación completa: ${ops.filter((o) => o.t !== 'igual').length} operación(es) de ${ops.length} columnas.`;
      lectura.set([
        ['longitud de A / B', `${A.length} / ${B.length}`],
        ['celdas calculadas', `${celdas} de ${A.length * B.length}`],
        ['distancia de edición', fase === 'tabla' && celdas < A.length * B.length ? '…' : String(d)],
        ['similitud 1 − d / máx', fase === 'tabla' && celdas < A.length * B.length ? '…' : VIZ.fmt(1 - d / Math.max(A.length, B.length), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const celdaEn = (x, y) => {
      const W = lienzo.ancho, x0 = Math.max(8, (W - (B.length + 2) * cs) / 2);
      const j = Math.floor((x - x0) / cs) - 1, i = Math.floor((y - 6) / cs) - 1;
      return i >= 0 && j >= 0 && i <= A.length && j <= B.length && D[i][j] !== null ? [i, j] : null;
    };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = celdaEn(x, y);
      if ((c && hover && c[0] === hover[0] && c[1] === hover[1]) || (!c && !hover)) { if (c) tip.mostrar(x, y, tipTexto(c)); return; }
      hover = c; dibujar();
      if (c) tip.mostrar(x, y, tipTexto(c)); else tip.ocultar();
    });
    const tipTexto = ([i, j]) => `d(${i}, ${j}) = <b>${D[i][j]}</b><br>A[1..${i}] = ${A.slice(0, i).map(T).join(' ') || '∅'}<br>B[1..${j}] = ${B.slice(0, j).map(T).join(' ') || '∅'}`;
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('traces-and-variants', {
    intro: String.raw`
      <p>Una <strong>traza</strong> es la secuencia de actividades de un caso, de principio a fin. Aunque un registro tenga miles de casos,
      muchos siguen exactamente la misma secuencia: cada secuencia distinta es una <strong>variante</strong> del proceso. Contar variantes es la forma más rápida de saber
      cuán regular, o cuán caótico, es un proceso.</p>
      <p>En casi todos los procesos reales las frecuencias de variantes tienen <strong>cola larga</strong>: unas pocas variantes cubren la mayoría de los casos y una
      multitud de variantes raras cubre el resto. Esa cola mezcla comportamiento legítimo, excepciones y ruido, y decide cuánto tendrá que simplificar un
      <a href="tema.html?id=process-discovery">algoritmo de descubrimiento</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Frecuencia de variantes y cobertura',
        descripcion: 'Fije la cobertura buscada y vea cuántas variantes hacen falta. Compare el proceso con paralelismo con el de bucle, y suba el ruido: la cola larga crece pero las primeras variantes casi no cambian.',
        montar: montarFrecuencias,
      },
      {
        titulo: 'Comparar dos trazas',
        descripcion: 'Elija dos variantes del proceso de pedidos y ejecute el algoritmo de distancia de edición. Pruebe con variantes que solo cambian el orden de dos actividades y con otras que omiten un paso.',
        montar: montarComparar,
      },
    ],
    teoria: String.raw`
      <h2>Trazas y variantes</h2>
      <p>Dado un conjunto de actividades \(A\), una <strong>traza</strong> es una secuencia \(\sigma \in A^*\). Un registro es un multiconjunto
      \(L \in \mathcal{B}(A^*)\): la misma traza puede aparecer varias veces. Se llama <strong>variante</strong> a cada elemento distinto del soporte de \(L\), y
      \(L(\sigma)\) es su frecuencia:</p>
      \[ |L| = \sum_{\sigma} L(\sigma), \qquad \text{cobertura}(k) = \frac{1}{|L|} \sum_{i=1}^{k} L(\sigma_{(i)}), \]
      <p>donde \(\sigma_{(1)}, \sigma_{(2)}, \ldots\) son las variantes ordenadas de mayor a menor frecuencia. La curva de cobertura es cóncava y creciente; cuanto más rápido sube, más regular es el proceso.</p>

      <h2>Qué produce una cola larga</h2>
      <ul>
        <li><strong>Paralelismo</strong>: \(k\) actividades concurrentes pueden registrarse en hasta \(k!\) órdenes distintos (ver <a href="tema.html?id=activity-lifecycle">ciclo de vida</a>).</li>
        <li><strong>Bucles</strong>: cada repetición posible es una variante nueva; con probabilidad de repetir \(p\), la probabilidad de la variante con \(r\) repeticiones decrece como \(p^r (1-p)\).</li>
        <li><strong>Excepciones y ruido</strong>: errores de registro, omisiones y retrabajos (<a href="tema.html?id=event-log-quality">calidad de datos</a>, <a href="tema.html?id=noise-and-incompleteness">ruido e incompletitud</a>).</li>
      </ul>

      <h2>Distancia entre trazas</h2>
      <p>La <strong>distancia de edición</strong> (Levenshtein) es el menor número de inserciones, borrados y sustituciones que convierten \(\sigma\) en \(\sigma'\):</p>
      \[ d(i,j) = \min\bigl( d(i-1,j-1) + [a_i \neq b_j],\; d(i-1,j) + 1,\; d(i,j-1) + 1 \bigr), \quad d(i,0)=i,\; d(0,j)=j. \]
      <pre><code>para i ← 1 hasta |σ|:
    para j ← 1 hasta |σ'|:
        d[i][j] ← mín(d[i−1][j−1] + (a[i] ≠ b[j]), d[i−1][j] + 1, d[i][j−1] + 1)
devolver d[|σ|][|σ'|]</code></pre>
      <p>Costo \(\Theta(|\sigma|\cdot|\sigma'|)\). Recorriendo la tabla desde la esquina final se recupera la alineación. Es la idea que reaparece en los
      <a href="tema.html?id=alignments">alineamientos entre traza y modelo</a>, y sirve para agrupar variantes parecidas antes de descubrir un modelo o para comparar
      <a href="tema.html?id=variant-comparison">grupos de variantes</a>.</p>`,
  });
})();
