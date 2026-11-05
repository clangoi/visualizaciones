(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = Object.assign({}, A.ejemplos, A.ejemplosAFN);
  const CLAVES = ['par-a', 'termina-01', 'no-bb', 'a-antes-b', 'termina-aba'];

  /* ---------- Álgebra de expresiones con simplificación ---------- */

  const eps = { t: 'eps' };
  const igual = (x, y) => A.aTexto(x) === A.aTexto(y);
  const U = (x, y) => (!x ? y : !y ? x : igual(x, y) ? x : { t: 'uni', a: x, b: y });
  const K = (x, y) => (!x || !y ? null : x.t === 'eps' ? y : y.t === 'eps' ? x : { t: 'cat', a: x, b: y });
  const S = (x) => (!x || x.t === 'eps' ? eps : x.t === 'est' ? x : { t: 'est', a: x });
  const txt = (x) => (x ? A.aTexto(x) : '∅');

  // Estados desde los que se puede llegar a uno final (y alcanzables): los demás sobran en la eliminación.
  function utiles(aut) {
    const al = A.alcanzables(aut), vivos = new Set();
    for (let cambio = true; cambio;) {
      cambio = false;
      for (const e of aut.aristas) if (al.has(e.de) && al.has(e.a) && (aut.fin.has(e.a) || vivos.has(e.a)) && !vivos.has(e.de)) { vivos.add(e.de); cambio = true; }
      for (const q of aut.fin) if (al.has(q) && !vivos.has(q)) { vivos.add(q); cambio = true; }
    }
    return vivos;
  }
  // AFN generalizado: aristas etiquetadas con expresiones. Nuevo inicial = n, nuevo final = n + 1.
  function gnfa(aut) {
    const vivos = utiles(aut), n = aut.n, R = new Map();
    const poner = (i, j, x) => R.set(i + ',' + j, U(R.get(i + ',' + j), x));
    for (const e of aut.aristas) if (vivos.has(e.de) && vivos.has(e.a)) poner(e.de, e.a, e.s === A.E ? eps : { t: 'sim', c: e.s });
    for (const q of aut.ini) if (vivos.has(q)) poner(n, q, eps);
    for (const q of aut.fin) if (vivos.has(q)) poner(q, n + 1, eps);
    return { R, vivos, n };
  }
  function eliminar(g, q) {
    const R = new Map(g.R), vivos = new Set(g.vivos);
    const origenes = [g.n, ...vivos].filter((i) => i !== q), destinos = [...vivos, g.n + 1].filter((j) => j !== q);
    const lazo = S(R.get(q + ',' + q)), detalle = [];
    for (const i of origenes) for (const j of destinos) {
      const a = R.get(i + ',' + q), b = R.get(q + ',' + j);
      if (!a || !b) continue;
      const nuevo = K(K(a, lazo), b);
      R.set(i + ',' + j, U(R.get(i + ',' + j), nuevo));
      detalle.push([i, j]);
    }
    for (const k of [...R.keys()]) { const [i, j] = k.split(',').map(Number); if (i === q || j === q) R.delete(k); }
    vivos.delete(q);
    return { R, vivos, n: g.n, detalle, lazo };
  }
  function correr(aut, orden) {
    let g = gnfa(aut);
    const pasos = [{ g, q: -1 }];
    for (const q of orden) { if (!g.vivos.has(q)) continue; g = eliminar(g, q); pasos.push({ g, q }); }
    return { pasos, regex: g.R.get(g.n + ',' + (g.n + 1)) || null };
  }
  // Para dibujar: autómata con las etiquetas como expresiones.
  function aGrafico(aut, g) {
    const ids = [g.n, ...[...g.vivos].sort((x, y) => x - y), g.n + 1], m = new Map(ids.map((q, i) => [q, i]));
    const trans = [];
    for (const [k, x] of g.R) { const [i, j] = k.split(',').map(Number); trans.push([m.get(i), txt(x), m.get(j)]); }
    return A.construir({ n: ids.length, nombres: ids.map((q) => (q === g.n ? 'S' : q === g.n + 1 ? 'T' : aut.nombres[q])), alf: [], ini: [0], fin: [ids.length - 1], trans });
  }
  const permutaciones = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutaciones([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const todas = (alf, max) => { const r = ['']; let niv = ['']; for (let l = 1; l <= max; l++) { const s = []; for (const w of niv) for (const c of alf) s.push(w + c); r.push(...s); niv = s; } return r; };
  function verifica(aut, regex) {
    if (!regex) return A.palabras(aut, 6).length === 0;
    const r = A.parsear(A.aTexto(regex));
    if (r.error) return false;
    const nfa = A.thompson(r.ast);
    return todas(aut.alf, 6).every((w) => A.acepta(aut, w) === A.acepta(nfa, w));
  }

  /* ---------- Fig. 1: eliminación paso a paso ---------- */

  function montarPasos(cuerpo) {
    let k = 'termina-01', modo = 'num', corrida = null, paso = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Orden de eliminación', opciones: [['num', 'q0, q1, q2, …'], ['inv', 'al revés'], ['ini', 'primero los estados del medio']], valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado que se va a eliminar' },
      { color: C.s2, texto: 'aristas nuevas o modificadas', forma: 'linea' },
      { color: C.s6, texto: 'expresión final de S a T', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'S es un inicial nuevo y T un final nuevo. Al eliminar un estado q, cada camino i → q → j se reemplaza por una arista i → j con la expresión R(i,q) R(q,q)* R(q,j), unida a la que ya hubiera.');

    function ordenDe(aut) {
      const ids = [...utiles(aut)].sort((a, b) => a - b);
      if (modo === 'inv') return ids.reverse();
      if (modo === 'ini') return ids.filter((q) => !aut.ini.includes(q) && !aut.fin.has(q)).concat(ids.filter((q) => aut.fin.has(q) || aut.ini.includes(q)));
      return ids;
    }
    function iniciar() {
      corrida = correr(E[k].aut, ordenDe(E[k].aut));
      paso = 0;
      return (function* () { for (let i = 1; i < corrida.pasos.length; i++) { paso = i; yield; } })();
    }
    function dibujar() {
      const aut = E[k].aut, st = corrida.pasos[paso], g = st.g, graf = aGrafico(aut, g);
      lienzo.limpiar();
      const ids = [g.n, ...[...g.vivos].sort((x, y) => x - y), g.n + 1];
      const prox = paso + 1 < corrida.pasos.length ? corrida.pasos[paso + 1].q : -1;
      const modif = new Set((st.q >= 0 && st.g.detalle ? st.g.detalle : []).map(([i, j]) => `${ids.indexOf(i)},${ids.indexOf(j)}`));
      const final = paso === corrida.pasos.length - 1;
      A.dibujar(lienzo, graf, {
        maxEtiqueta: 46, pildora: false, radio: 16,
        nodo: (q) => (ids[q] === prox ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 3 } : null),
        arista: (de, a) => (final ? { color: C.s6, ancho: 3 } : modif.has(de + ',' + a) ? { color: C.s2, ancho: 2.5 } : null),
      });
      const r = corrida.regex;
      if (st.q >= 0) {
        const lazo = st.g.lazo;
        registro.textContent = `Se eliminó ${aut.nombres[st.q]}${lazo && lazo.t !== 'eps' ? ` (su bucle cuenta como ${txt(lazo)})` : ''}: ${st.g.detalle.length} arista(s) nueva(s) o modificada(s).${final ? `\nExpresión final: ${txt(r)}` : ''}`;
      } else registro.textContent = `Autómata generalizado inicial: ${prox >= 0 ? 'se eliminará ' + aut.nombres[prox] + ' primero.' : ''}`;
      lectura.set([['estados restantes (sin S, T)', String(g.vivos.size)], ['aristas', String(g.R.size)], ['expresión de S a T', final ? txt(r) : '(aún no)'], ['equivalente al autómata (|w| ≤ 6)', final ? (verifica(aut, r) ? 'sí' : 'NO') : '—']]);
    }
    lienzo.alDibujar = () => corrida && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el orden de eliminación importa ---------- */

  function montarOrden(cuerpo) {
    let k = 'par-a-par-b', filas = [], sel = 0, geo = [];
    const CL = ['par-a-par-b', 'termina-01', 'no-bb', 'a-antes-b', 'contiene-aba'];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Autómata', opciones: CL.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 230, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'longitud de la expresión según el orden' },
      { color: C.s2, texto: 'orden seleccionado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es un orden posible de eliminar los estados. Todos dan expresiones equivalentes, pero de tamaños muy distintos. Haga clic en una barra para ver su expresión.');
    function calcular() {
      const aut = E[k].aut, ids = [...utiles(aut)].sort((a, b) => a - b);
      filas = permutaciones(ids).map((o) => { const r = correr(aut, o).regex; return { orden: o, regex: r, largo: txt(r).length }; }).sort((a, b) => a.largo - b.largo);
      sel = 0;
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, aut = E[k].aut, n = filas.length;
      lienzo.limpiar();
      const izq = 40, inf = 26, base = H - inf, mx = Math.max(...filas.map((f) => f.largo)), paso = (W - izq - 10) / n;
      geo = [];
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, base + 0.5); ctx.lineTo(W - 6, base + 0.5); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(mx), izq - 6, 24); ctx.fillText('0', izq - 6, base);
      ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('caracteres', 4, 0); ctx.restore();
      filas.forEach((f, i) => {
        const h = (f.largo / mx) * (base - 16), x = izq + i * paso;
        ctx.fillStyle = i === sel ? C.s2 : C.s1;
        ctx.beginPath(); ctx.roundRect(x + 1, base - h, Math.max(2, paso - 2), h, [4, 4, 0, 0]); ctx.fill();
        geo.push({ x, w: paso, i });
      });
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${n} órdenes posibles, de menor a mayor tamaño`, (izq + W) / 2, base + 8);
      const f = filas[sel];
      registro.textContent = `Orden ${f.orden.map((q) => aut.nombres[q]).join(' → ')} (${f.largo} caracteres):\n${txt(f.regex)}`;
      lectura.set([['estados a eliminar', String(f.orden.length)], ['órdenes', String(n)], ['más corta', `${filas[0].largo} caracteres`], ['más larga', `${filas[n - 1].largo} caracteres`], ['equivalente al autómata', verifica(aut, f.regex) ? 'sí' : 'NO']]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    const hallar = (ev) => { const { x } = lienzo.posicion(ev); return geo.find((b) => x >= b.x && x < b.x + b.w); };
    lienzo.canvas.addEventListener('click', (ev) => { const b = hallar(ev); if (b) { sel = b.i; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const b = hallar(ev), { x, y } = lienzo.posicion(ev);
      if (!b) return tip.ocultar();
      const f = filas[b.i];
      tip.mostrar(x, y, `orden <b>${f.orden.map((q) => E[k].aut.nombres[q]).join(' → ')}</b><br>${f.largo} caracteres`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
    dibujar();
  }

  VIZ.registrarTema('state-elimination', {
    intro: String.raw`
      <p>El teorema de Kleene tiene dos mitades. La construcción de Thompson lleva expresiones a autómatas; la otra mitad, de <strong>autómatas a expresiones regulares</strong>, se hace <em>eliminando estados</em>.</p>
      <p>La idea: permitir que las aristas lleven expresiones regulares en lugar de símbolos, y quitar los estados uno a uno, reemplazando cada camino que pasaba por el estado eliminado por una arista con la expresión equivalente. Al final queda una sola arista del inicial al final, y su etiqueta es la expresión buscada.</p>`,
    visualizaciones: [
      {
        titulo: 'Eliminar estados paso a paso',
        descripcion: 'Avance con «Un paso»: cada eliminación reescribe las aristas que pasaban por el estado. Cambie el orden y compare la expresión final.',
        montar: montarPasos,
      },
      {
        titulo: 'El orden de eliminación importa',
        descripcion: 'Todas las permutaciones de estados dan expresiones equivalentes, pero de tamaño muy diferente. Haga clic en una barra para leer su expresión.',
        montar: montarOrden,
      },
    ],
    teoria: String.raw`
      <h2>AFN generalizado</h2>
      <p>Un AFN generalizado (GNFA) tiene aristas etiquetadas con expresiones regulares: una palabra lleva de \(p\) a \(q\) si se parte en trozos cuyas etiquetas se emparejan a lo largo de un camino. Se prepara el autómata original así:</p>
      <ol>
        <li>agregar un estado inicial nuevo \(S\) con una arista \(\varepsilon\) al antiguo inicial;</li>
        <li>agregar un estado final nuevo \(T\) y aristas \(\varepsilon\) desde cada antiguo final;</li>
        <li>fusionar aristas paralelas con la unión \(|\); la ausencia de arista equivale a \(\varnothing\).</li>
      </ol>
      <h2>Eliminar un estado</h2>
      <p>Para quitar \(q\) (distinto de \(S\) y \(T\)), cada par \((i, j)\) de estados restantes recibe</p>
      \[ R'(i, j) = R(i, j) \;\mid\; R(i, q)\, R(q, q)^{*}\, R(q, j). \]
      <p>El factor \(R(q,q)^*\) cubre las vueltas por el bucle de \(q\). Esta regla conserva el lenguaje, porque todo camino que pasaba por \(q\) se descompone en una entrada, cero o más vueltas y una salida.</p>
      <pre><code>mientras queden estados distintos de S y T:
    elegir un estado q
    para cada i, j distintos de q:
        R(i,j) ← R(i,j) | R(i,q) R(q,q)* R(q,j)
    eliminar q
devolver R(S, T)</code></pre>
      <h2>Tamaño del resultado</h2>
      <p>Cada eliminación puede multiplicar por 4 el tamaño de las etiquetas, así que el resultado puede ser de tamaño \(4^n\) en el peor caso, y se sabe que existen lenguajes cuyas expresiones deben ser de tamaño exponencial en el número de estados del AFD (Ehrenfeucht y Zeiger). El orden de eliminación y las simplificaciones (\(r\varepsilon = r\), \(\varnothing r = \varnothing\), \(\varnothing^* = \varepsilon\)) influyen mucho, como muestra la segunda figura.</p>
      <div class="recuadro"><p><strong>Variante.</strong> El algoritmo de McNaughton-Yamada calcula \(R^k_{ij}\), la expresión de los caminos de \(i\) a \(j\) que solo pasan por estados intermedios numerados \(\le k\):
      \(R^k_{ij} = R^{k-1}_{ij} \mid R^{k-1}_{ik}(R^{k-1}_{kk})^* R^{k-1}_{kj}\). Es la misma recurrencia, una versión «de programación dinámica» de la eliminación en orden \(1, 2, \dots, n\).</p></div>
      <h2>Con esto se cierra el teorema de Kleene</h2>
      <p>Expresión → autómata (<a href="tema.html?id=thompson-construction">Thompson</a>) y autómata → expresión (eliminación de estados): los lenguajes regulares son exactamente los reconocidos por autómatas finitos, y exactamente los descritos por expresiones regulares.</p>`,
  });
})();
