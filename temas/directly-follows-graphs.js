(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const { act, sec, xor, y, bucle } = P;

  /* ---------- Procesos de ejemplo con nombres cortos ---------- */

  const PROCESOS = {
    pedidos: {
      nombre: 'Pedidos (con paralelismo)',
      arbol: sec(act('Registrar'), xor([act('Stock'), sec(act('Stock'), act('Reponer'))], [0.75, 0.25]),
        y(act('Envío'), act('Factura')), xor([act('Cobrar'), sec(act('Aviso'), act('Cobrar'))], [0.7, 0.3]), act('Despachar')),
    },
    reclamos: {
      nombre: 'Reclamos (con bucle)',
      arbol: sec(act('Recibir'), act('Clasificar'), bucle(act('Investigar'), act('Pedir'), 0.35),
        xor([act('Aprobar'), act('Rechazar')], [0.45, 0.55]), act('Cerrar')),
    },
  };

  /* ---------- Utilidades de dibujo ---------- */

  const INI = '#ini', FIN = '#fin';

  // Aristas del DFG con inicio y fin explícitos.
  function aristasDe(d) {
    const E = [];
    d.ini.forEach((n, a) => E.push({ de: INI, a, n }));
    d.aristas.forEach((e) => E.push({ de: e.de, a: e.a, n: e.n }));
    d.fin.forEach((n, a) => E.push({ de: a, a: FIN, n }));
    return E;
  }

  // Orienta la disposición según el ancho disponible y calcula el alto necesario.
  function orientar(pos, ancho) {
    const r = {}, g = new Map();
    for (const k in pos) {
      const c = pos[k].x.toFixed(4);
      g.set(c, (g.get(c) || 0) + 1);
    }
    const capas = g.size, carriles = Math.max(1, ...g.values());
    const v = capas * 76 + 60 > ancho;
    for (const k in pos) r[k] = v ? { x: pos[k].y, y: pos[k].x } : pos[k];
    return { pos: r, alto: v ? capas * 62 + 56 : Math.max(250, carriles * 66 + 60), vertical: v };
  }

  // Separa del eje a las actividades que otra arista «salta» (para que la arista no pase por detrás del nodo).
  function esquivar(pos, E) {
    const cuenta = new Map();
    for (const k in pos) cuenta.set(pos[k].x.toFixed(4), (cuenta.get(pos[k].x.toFixed(4)) || 0) + 1);
    const nueva = {};
    for (const k in pos) nueva[k] = { ...pos[k] };
    for (const k in pos) {
      if (cuenta.get(pos[k].x.toFixed(4)) > 1) continue;
      if (E.some((e) => pos[e.de] && pos[e.a] && pos[e.de].x < pos[k].x - 1e-6 && pos[e.a].x > pos[k].x + 1e-6)) nueva[k].y = 0.1;
    }
    return nueva;
  }

  // Un DFG de `log`. umbral: frecuencia mínima de arista; sel: nodo elegido; otro: DFG con el que se compara.
  function nodosYAristas(d, E, pos, o) {
    const nodos = [{ id: INI, tipo: 'inicio', borde: C.s6 }, { id: FIN, tipo: 'fin' }];
    d.acts.forEach((a) => nodos.push({ id: a, tipo: 'act', etiqueta: a, insignia: String(d.frec.get(a)), colorInsignia: C.tinta2, anillo: o.sel === a ? C.s1 : null }));
    if (o.sel === INI) nodos[0].anillo = C.s1;
    const maxN = Math.max(1, ...E.map((e) => e.n));
    const aristas = E.map((e) => {
      const visible = e.n >= o.umbral;
      const atras = pos[e.a] && pos[e.de] && pos[e.a].x <= pos[e.de].x && e.a !== e.de;
      const base = { de: e.de, a: e.a, curva: atras ? 34 : undefined };
      if (!visible) return { ...base, color: C.tenue, ancho: 1.2, guiones: true };
      const unico = o.otro && !o.otro.has(e.de + '\u0001' + e.a);
      const color = o.sel && e.de === o.sel ? C.s2 : unico ? C.s2 : C.s1;
      return { ...base, color, ancho: 1.5 + (3.5 * e.n) / maxN, etiqueta: e.n, colorTexto: C.tinta };
    });
    return { nodos, aristas };
  }

  /* ---------- Fig. 1: del registro al grafo ---------- */

  function montarDFG(cuerpo) {
    let clave = 'pedidos', n = 80, semilla = 1, pct = 0, sel = null, log = [], d = null, E = [], posBase = null, alto = 320, geo = null, vars = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: Object.entries(PROCESOS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; sel = null; generar(); } });
    ctl.rango({ etiqueta: 'Casos', min: 20, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; generar(); } });
    ctl.rango({ etiqueta: 'Frecuencia mínima de arista', min: 0, max: 60, valor: pct, formato: (v) => `${v} % de los casos`, alCambiar: (v) => { pct = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arista que se conserva (grosor = frecuencia)', forma: 'linea' },
      { color: C.tenue, texto: 'arista filtrada', forma: 'linea' },
      { color: C.s2, texto: 'salidas del nodo elegido', forma: 'linea' },
      { color: C.tinta2, texto: 'insignia: veces que ocurre la actividad', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una actividad (o en el inicio) para ver a dónde van sus casos y con qué frecuencia. Suba el filtro para quedarse con el camino principal: las aristas atenuadas desaparecen del modelo.');

    function generar() {
      log = P.simular(PROCESOS[clave].arbol, n, semilla * 7 + n);
      d = P.dfg(log); E = aristasDe(d); vars = P.variantes(log);
      posBase = esquivar(P.disponer([INI, ...d.acts, FIN], E.map((e) => [e.de, e.a])), E);
      dibujar();
    }
    function dibujar() {
      if (!d) return;
      const o = orientar(posBase, lienzo.ancho);
      if (o.alto !== alto) { alto = o.alto; lienzo.ajustar(true); return; }
      const umbral = Math.ceil((pct / 100) * log.length);
      const { nodos, aristas } = nodosYAristas(d, E, posBase, { umbral, sel });
      lienzo.limpiar();
      geo = P.dibujarGrafo(lienzo, nodos, aristas, o.pos, { fuente: 10, margenX: 44, margenY: 34 });
      const ok = (de, a) => d.n(de, a) >= umbral;
      const reproducibles = vars.filter((v) => {
        const t = v.traza;
        return (d.ini.get(t[0]) || 0) >= umbral && (d.fin.get(t[t.length - 1]) || 0) >= umbral && t.slice(1).every((b, i) => ok(t[i], b));
      }).reduce((s, v) => s + v.n, 0);
      const visibles = E.filter((e) => e.n >= umbral).length;
      lectura.set([
        ['casos / variantes', `${log.length} / ${vars.length}`],
        ['aristas visibles', `${visibles} de ${E.length}`],
        ['casos que el modelo aún reproduce', `${Math.round((100 * reproducibles) / log.length)} %`],
        ['umbral', `${umbral} ocurrencias`],
      ]);
      if (sel) {
        const sal = E.filter((e) => e.de === sel), tot = sal.reduce((s, e) => s + e.n, 0);
        lista.replaceChildren(...sal.sort((a, b) => b.n - a.n).map((e) => VIZ.el('div', null, `${sel === INI ? 'inicio' : sel} → ${e.a === FIN ? 'fin' : e.a}: ${e.n} de ${tot} (${Math.round((100 * e.n) / tot)} %)${e.n < umbral ? '   filtrada' : ''}`)));
        registro.textContent = `Salidas de ${sel === INI ? 'inicio' : sel}: ${sal.length} sucesores posibles.`;
      } else {
        lista.replaceChildren(VIZ.el('div', null, 'Elija un nodo para listar sus salidas.'));
        registro.textContent = `El grafo resume ${log.length} casos en ${d.acts.length} actividades y ${E.length} aristas; cada arista a → b cuenta cuántas veces b ocurrió justo después de a.`;
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y: yy } = lienzo.posicion(ev), g = geo && P.nodoEn(geo, x, yy);
      sel = g && g.id !== FIN && g.id !== sel ? g.id : null;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y: yy } = lienzo.posicion(ev), g = geo && P.nodoEn(geo, x, yy);
      if (!g || g.id === INI || g.id === FIN) return tip.ocultar();
      const ent = E.filter((e) => e.a === g.id).reduce((s, e) => s + e.n, 0), sal = E.filter((e) => e.de === g.id).reduce((s, e) => s + e.n, 0);
      tip.mostrar(x, yy, `<b>${g.id}</b><br>ocurre <b>${d.frec.get(g.id)}</b> veces<br>llegan <b>${ent}</b> · salen <b>${sal}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: lo que el DFG no distingue ---------- */

  const LOGS = {
    par: { nombre: 'Paralelo: b y c en cualquier orden', trazas: [['abcd', 5], ['acbd', 5]] },
    elec: { nombre: 'Elección: b o c', trazas: [['abd', 5], ['acd', 5]] },
    mixto: { nombre: 'Elección y orden: b, c o ambas', trazas: [['abd', 3], ['acd', 3], ['abcd', 2], ['acbd', 2]] },
    rep: { nombre: 'Repetición: b y c se alternan', trazas: [['abd', 3], ['acd', 3], ['abcbd', 2], ['acbcd', 2]] },
  };

  // Disposición fija para las cuatro actividades a, b, c, d.
  const POS2 = { [INI]: { x: 0, y: 0.5 }, a: { x: 0.2, y: 0.5 }, b: { x: 0.5, y: 0.2 }, c: { x: 0.5, y: 0.8 }, d: { x: 0.8, y: 0.5 }, [FIN]: { x: 1, y: 0.5 } };

  // Caminos del inicio al fin en el DFG, con a lo sumo L actividades.
  function caminos(d, L) {
    const res = [];
    const rec = (t) => {
      const u = t[t.length - 1];
      if (d.fin.has(u)) res.push(t.join(''));
      if (t.length >= L) return;
      for (const e of d.aristas) if (e.de === u) rec([...t, e.a]);
    };
    for (const a of d.ini.keys()) rec([a]);
    return [...new Set(res)];
  }

  function montarComparacion(cuerpo) {
    let A = 'par', B = 'rep', L = 6, altoA = 250, altoB = 250;
    const ctl = VIZ.controles(cuerpo);
    const opciones = Object.entries(LOGS).map(([k, v]) => [k, v.nombre]);
    ctl.selector({ etiqueta: 'Registro A', opciones, valor: A, alCambiar: (v) => { A = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Registro B', opciones, valor: B, alCambiar: (v) => { B = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud máxima de camino', min: 4, max: 8, valor: L, alCambiar: (v) => { L = v; dibujar(); } });
    VIZ.subtitulo(cuerpo, 'Grafo del registro A');
    const lienA = VIZ.lienzo(cuerpo, { altoFn: () => altoA });
    VIZ.subtitulo(cuerpo, 'Grafo del registro B');
    const lienB = VIZ.lienzo(cuerpo, { altoFn: () => altoB });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arista presente en ambos grafos', forma: 'linea' },
      { color: C.s2, texto: 'arista que solo está en este grafo', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Compare «Paralelo» con «Repetición»: sus grafos son idénticos, pero los comportamientos no. La tabla lista cada camino que algún grafo permite y si realmente aparece en cada registro. Un ✓ en «permite el grafo» sin ✓ en «aparece» es una traza que el DFG inventa.');

    function pintar(lienzo, log, otro, fijarAlto) {
      const d = P.dfg(log), E = aristasDe(d);
      const base = POS2;
      const o = orientar(base, lienzo.ancho);
      if (fijarAlto(o.alto)) return d;
      const claves = new Set(E.map((e) => e.de + '\u0001' + e.a));
      const { nodos, aristas } = nodosYAristas(d, E, base, { umbral: 0, otro });
      lienzo.limpiar();
      P.dibujarGrafo(lienzo, nodos, aristas, o.pos, { fuente: 11, margenX: 44, margenY: 32 });
      d.claves = claves;
      return d;
    }
    function dibujar() {
      const lA = P.logSimple(LOGS[A].trazas), lB = P.logSimple(LOGS[B].trazas);
      const dA = P.dfg(lA), dB = P.dfg(lB);
      const cA = new Set(aristasDe(dA).map((e) => e.de + '\u0001' + e.a)), cB = new Set(aristasDe(dB).map((e) => e.de + '\u0001' + e.a));
      let cambio = false;
      pintar(lienA, lA, cB, (h) => { if (h !== altoA) { altoA = h; cambio = true; lienA.ajustar(true); return true; } return false; });
      pintar(lienB, lB, cA, (h) => { if (h !== altoB) { altoB = h; cambio = true; lienB.ajustar(true); return true; } return false; });
      if (cambio) return;
      const vA = new Set(lA.map((c) => P.trazaDe(c).join(''))), vB = new Set(lB.map((c) => P.trazaDe(c).join('')));
      const pA = caminos(dA, L), pB = caminos(dB, L);
      const todas = [...new Set([...vA, ...vB, ...pA, ...pB])].sort((a, b) => a.length - b.length || a.localeCompare(b));
      const marca = (v) => (v ? '✓' : '—');
      const filas = todas.map((t) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, t), VIZ.el('td', null, marca(vA.has(t))), VIZ.el('td', null, marca(pA.includes(t))),
        VIZ.el('td', null, marca(vB.has(t))), VIZ.el('td', null, marca(pB.includes(t)))));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ...['traza', 'aparece en A', 'permite el grafo A', 'aparece en B', 'permite el grafo B'].map((t, i) => VIZ.el('th', { class: i ? null : 'izq' }, t))), ...filas));
      const mismas = cA.size === cB.size && [...cA].every((k) => cB.has(k));
      const inventadasA = pA.filter((t) => !vA.has(t)).length, inventadasB = pB.filter((t) => !vB.has(t)).length;
      const mismoLenguaje = vA.size === vB.size && [...vA].every((t) => vB.has(t));
      lectura.set([
        ['aristas A / B', `${cA.size} / ${cB.size}`],
        ['¿mismo grafo?', mismas ? 'sí' : 'no'],
        ['¿mismas trazas observadas?', mismoLenguaje ? 'sí' : 'no'],
        [`caminos inventados (≤ ${L})`, `A: ${inventadasA} · B: ${inventadasB}`],
      ]);
      registro.textContent = mismas && !mismoLenguaje
        ? 'Los dos registros tienen exactamente el mismo grafo de sucesión directa, aunque sus trazas son distintas: el DFG no puede distinguirlos.'
        : mismas ? 'Mismo grafo y mismas trazas observadas.' : 'Los grafos difieren: las aristas en naranja existen solo en uno de los dos registros.';
    }
    lienA.alDibujar = dibujar; lienB.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('directly-follows-graphs', {
    intro: String.raw`
      <p>El <strong>grafo de sucesión directa</strong> (<em>directly-follows graph</em>, DFG) es la vista más simple de un registro de eventos:
      cada actividad es un nodo y una flecha va de \(a\) a \(b\) si, en algún caso, \(b\) ocurrió inmediatamente después de \(a\). Se agregan un
      nodo de inicio y uno de fin, y cada flecha lleva el número de veces que se observó.</p>
      <p>Es lo que dibujan por defecto casi todas las herramientas comerciales, porque se calcula en una sola pasada y es fácil de leer. Su límite es
      igual de importante: solo ve pares consecutivos, así que no distingue un paralelismo de una elección repetida ni de un bucle.</p>`,
    visualizaciones: [
      {
        titulo: 'Del registro al grafo y su filtro',
        descripcion: 'Genere un registro, haga clic en una actividad para ver sus salidas y suba el filtro de frecuencia: el modelo se limpia, pero reproduce cada vez menos casos.',
        montar: montarDFG,
      },
      {
        titulo: 'Lo que el DFG no distingue',
        descripcion: 'Compare dos registros con el mismo grafo y comportamientos distintos. Mire la tabla: el grafo permite caminos que nunca ocurrieron.',
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(L\) un registro de eventos, es decir, un multiconjunto de trazas \(\sigma = \langle \sigma_1, \dots, \sigma_n \rangle\) sobre un conjunto de
      actividades \(A\). La relación de <em>sucesión directa</em> y su frecuencia son</p>
      \[ a &gt; b \iff \exists\, \sigma \in L,\ i:\ \sigma_i = a \wedge \sigma_{i+1} = b, \qquad f(a, b) = \sum_{\sigma \in L} \bigl|\{ i : \sigma_i = a,\ \sigma_{i+1} = b \}\bigr|. \]
      <p>El DFG es el grafo dirigido \((A \cup \{\triangleright, \square\},\ E)\) con arista \(a \to b\) cuando \(f(a, b) &gt; 0\); además
      \(\triangleright \to a\) con la frecuencia de las trazas que empiezan en \(a\) y \(a \to \square\) con la de las que terminan en \(a\).</p>
      <h2>Construcción</h2>
      <pre><code>para cada traza σ del registro:
    f(▷, σ₁) ← f(▷, σ₁) + 1
    para i ← 1 hasta |σ| − 1:
        f(σᵢ, σᵢ₊₁) ← f(σᵢ, σᵢ₊₁) + 1
    f(σ_|σ|, □) ← f(σ_|σ|, □) + 1</code></pre>
      <p>El costo es lineal en el número total de eventos: \(O(\sum_\sigma |\sigma|)\).</p>
      <h2>Filtrar por frecuencia</h2>
      <p>Con un umbral \(\theta\) se conservan solo las aristas con \(f(a, b) \ge \theta\). Es una simplificación: un caso se sigue
      <em>reproduciendo</em> únicamente si todas las aristas que usa sobreviven, de modo que al subir \(\theta\) la fracción de casos reproducibles
      baja. Se busca un punto medio entre un modelo legible y uno fiel; filtrar actividades raras o conservar las aristas necesarias para que cada
      actividad siga conectada son variantes habituales.</p>
      <h2>Qué no distingue</h2>
      <div class="recuadro"><p>Los registros \(\{abcd, acbd\}\) (paralelo), \(\{abd, acd, abcd, acbd\}\) (elección o ambos) y
      \(\{abd, acd, abcbd, acbcd\}\) (repetición) producen el <em>mismo</em> DFG: \(a \to b,\ a \to c,\ b \leftrightarrow c,\ b \to d,\ c \to d\).</p></div>
      <p>El grafo permite todos los caminos de \(\triangleright\) a \(\square\), también los que ningún caso siguió (por ejemplo \(abcbcd\)), y no
      expresa que dos ramas deben ocurrir <em>ambas</em>. Para separar paralelismo de elección hacen falta relaciones más finas, como las de la
      <a href="tema.html?id=footprint-matrix">matriz de huellas</a>, o un modelo con semántica de ficha como una <a href="tema.html?id=petri-nets">red de Petri</a>.</p>
      <h2>Conexiones</h2>
      <p>El DFG es el punto de partida del <a href="tema.html?id=heuristic-miner">Heuristic Miner</a> (que lo pondera por dependencia en vez de frecuencia
      bruta) y del <a href="tema.html?id=split-miner">Split Miner</a>, y la base de otros descubrimientos como el
      <a href="tema.html?id=inductive-miner">Inductive Miner</a>, que lo corta recursivamente. Un sistema de transición es un DFG donde cada nodo
      recuerda más pasado: ver <a href="tema.html?id=transition-systems">Transition Systems</a>.</p>`,
  });
})();
