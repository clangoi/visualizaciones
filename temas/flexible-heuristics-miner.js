(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const A = P.act;

  // Proceso de solicitudes: dos validaciones en paralelo, una decisión y dos formas de resolver.
  const ARBOL = P.sec(A('Recibir'), P.y(A('Validar'), A('Evaluar')), A('Decidir'),
    P.xor([A('Aprobar'), P.y(A('Rechazar'), A('Avisar'))], [0.6, 0.4]), A('Cerrar'));
  const LETRA = { Recibir: 'a', Validar: 'b', Evaluar: 'c', Decidir: 'd', Aprobar: 'e', Rechazar: 'f', Avisar: 'g', Cerrar: 'h' };
  const NOMBRE = Object.fromEntries(Object.entries(LETRA).map(([k, v]) => [v, k]));
  const nombres = (cuerpo, N) => cuerpo.appendChild(VIZ.el('div', { class: 'lista-mono' }, VIZ.el('div', null, Object.entries(N).map(([k, v]) => `${k} = ${v}`).join('  ·  '))));
  const f2 = (v) => VIZ.fmt(Math.round(v * 100) / 100, 3);

  function dependencias(trazas, tau, nu) {
    const frec = new Map(), par = new Map();
    for (const t of trazas) {
      t.forEach((a) => frec.set(a, (frec.get(a) || 0) + 1));
      for (let i = 0; i + 1 < t.length; i++) par.set(t[i] + t[i + 1], (par.get(t[i] + t[i + 1]) || 0) + 1);
    }
    const acts = [...frec.keys()].sort(), dep = new Set(), medida = {};
    for (const a of acts) for (const b of acts) {
      if (a === b) continue;
      const x = par.get(a + b) || 0, z = par.get(b + a) || 0, v = (x - z) / (x + z + 1);
      medida[a + b] = v;
      if (x >= nu && v >= tau) dep.add(a + b);
    }
    return { acts, dep, medida, frec };
  }

  // Enlaces (bindings) de entrada y salida: reproduce cada traza sobre el grafo de dependencias.
  // Una aparición x en i activa a y en j si x es una entrada de y, no hay otra y entre medias y ninguna
  // actividad intermedia de las entradas de y es sucesora directa de x (ella sería la causa).
  function enlaces(trazas, dep) {
    const sal = new Map(), ent = new Map();
    const suma = (m, a, clave) => { if (!m.has(a)) m.set(a, new Map()); const q = m.get(a); q.set(clave, (q.get(clave) || 0) + 1); };
    for (const t of trazas) {
      const salidas = t.map(() => new Set()), entradas = t.map(() => new Set());
      for (let j = 0; j < t.length; j++) {
        const y = t[j], ini = t.lastIndexOf(y, j - 1), visto = new Set();
        for (let i = j - 1; i >= Math.max(ini, 0) && j > 0; i--) {
          const x = t[i];
          if (!dep.has(x + y) || visto.has(x) || (x === y && i !== ini)) continue;
          visto.add(x);
          let bloqueada = false;
          for (let k = i + 1; k < j && !bloqueada; k++) if (dep.has(t[k] + y) && dep.has(x + t[k])) bloqueada = true;
          if (!bloqueada) { salidas[i].add(y); entradas[j].add(x); }
        }
      }
      t.forEach((a, i) => {
        if (salidas[i].size) suma(sal, a, [...salidas[i]].sort().join(''));
        if (entradas[i].size) suma(ent, a, [...entradas[i]].sort().join(''));
      });
    }
    return { sal, ent };
  }
  // Enlaces con frecuencia relativa al total de enlaces de la actividad ≥ theta.
  function filtrar(mapa, a, theta) {
    const m = mapa.get(a);
    if (!m) return [];
    const tot = [...m.values()].reduce((s, v) => s + v, 0);
    return [...m.entries()].filter(([, n]) => n / tot >= theta).map(([k, n]) => ({ set: [...k], n, frac: n / tot })).sort((x, z) => z.n - x.n);
  }
  function tipoCompuerta(binds) {
    const U = new Set(binds.flatMap((b) => b.set));
    if (U.size < 2) return null;
    if (binds.length === 1) return '+';
    if (binds.every((b) => b.set.length === 1)) return '×';
    const todos = binds.flatMap((b) => b.set);
    return todos.length === U.size ? '×+' : 'o';
  }
  const COLOR_TIPO = { '×': C.s1, '+': C.s3, '×+': C.s7, o: C.s4 };
  const fmtBind = (b) => `{${b.set.join(',')}}`;

  /* ---------- Fig. 1: de las dependencias a la C-Net ---------- */

  function montarCNet(cuerpo) {
    let n = 120, ruido = 0.06, semilla = 1, tau = 0.8, theta = 0.05, sel = 'd', datos = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de dependencia', min: 0.3, max: 0.98, paso: 0.02, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Frecuencia mínima de un enlace', min: 0, max: 0.4, paso: 0.01, valor: theta, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { theta = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ruido', min: 0, max: 0.3, paso: 0.02, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; nuevo(); } });
    ctl.boton('Nuevo registro', () => { semilla++; nuevo(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 290, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: '× elige un solo enlace (XOR)' },
      { color: VIZ.alfa(C.s3, 0.3), borde: C.s3, texto: '+ los activa a la vez (AND)' },
      { color: VIZ.alfa(C.s7, 0.3), borde: C.s7, texto: '×+ elige entre grupos que son AND' },
      { color: VIZ.alfa(C.s4, 0.3), borde: C.s4, texto: 'o mezcla (OR)' },
      { color: C.s2, texto: 'actividad elegida', forma: 'punto' },
    ]);
    nombres(cuerpo, NOMBRE);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una actividad para ver sus enlaces de entrada y de salida con sus frecuencias. Los rombos son los splits (después de la actividad) y los joins (antes de ella). Con ruido alto, suba la frecuencia mínima para que los enlaces raros dejen de crear compuertas OR.');

    function nuevo() {
      const log = P.simular(ARBOL, n, semilla, { ruido, espera: 5 });
      datos = log.map((c) => c.eventos.map((e) => LETRA[e.act]));
      dibujar();
    }
    function dibujar() {
      if (!datos) return;
      lienzo.limpiar();
      const D = dependencias(datos, tau, 2), E = enlaces(datos, D.dep);
      const sal = {}, ent = {};
      D.acts.forEach((a) => { sal[a] = filtrar(E.sal, a, theta); ent[a] = filtrar(E.ent, a, theta); });
      const ts = {}, tj = {};
      D.acts.forEach((a) => { ts[a] = tipoCompuerta(sal[a]); tj[a] = tipoCompuerta(ent[a]); });
      const nodos = D.acts.map((a) => ({ id: a, tipo: 'act', etiqueta: a, anillo: a === sel ? C.s2 : null }));
      const arcos = [], ids = [...D.acts];
      D.acts.forEach((a) => {
        if (ts[a]) { nodos.push({ id: 'S' + a, tipo: 'rombo', etiqueta: ts[a], relleno: VIZ.alfa(COLOR_TIPO[ts[a]], 0.3), borde: COLOR_TIPO[ts[a]] }); ids.push('S' + a); arcos.push({ de: a, a: 'S' + a }); }
        if (tj[a]) { nodos.push({ id: 'J' + a, tipo: 'rombo', etiqueta: tj[a], relleno: VIZ.alfa(COLOR_TIPO[tj[a]], 0.3), borde: COLOR_TIPO[tj[a]] }); ids.push('J' + a); arcos.push({ de: 'J' + a, a }); }
      });
      let aristas = 0;
      for (const x of D.acts) {
        const U = new Set(sal[x].flatMap((b) => b.set));
        for (const y of D.acts) {
          const Ui = new Set(ent[y].flatMap((b) => b.set));
          if (!U.has(y) && !Ui.has(x)) continue;
          aristas++;
          arcos.push({ de: ts[x] ? 'S' + x : x, a: tj[y] ? 'J' + y : y, ancho: 2 });
        }
      }
      const pos = P.disponer(ids, arcos.map((e) => [e.de, e.a]));
      geo = P.dibujarGrafo(lienzo, nodos, arcos, pos, { margenX: 24, margenY: 30 });
      const lin = (titulo, bs) => VIZ.el('div', null, `${titulo} `, bs.length ? bs.map((b) => `${fmtBind(b)}×${b.n}`).join('  ') : '—');
      lista.replaceChildren(
        VIZ.el('div', { class: 'activa' }, `Actividad ${sel} (${NOMBRE[sel] || ''})  ·  split: ${ts[sel] || 'ninguno'}  ·  join: ${tj[sel] || 'ninguno'}`),
        lin('enlaces de entrada:', ent[sel] || []), lin('enlaces de salida: ', sal[sel] || []));
      const nComp = Object.values(ts).filter(Boolean).length + Object.values(tj).filter(Boolean).length;
      registro.textContent = `Con τ = ${VIZ.fmt(tau, 2)} el grafo de dependencias tiene ${D.dep.size} aristas; sus enlaces más frecuentes (≥ ${Math.round(theta * 100)} %) generan ${nComp} compuertas.`;
      const bin = (m) => [...Object.values(m)].reduce((s, bs) => s + bs.length, 0);
      lectura.set([
        ['aristas de dependencia', String(D.dep.size)],
        ['compuertas (splits + joins)', String(nComp)],
        ['enlaces de salida / entrada', `${bin(sal)} / ${bin(ent)}`],
        ['casos', String(datos.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), nd = geo && P.nodoEn(geo, x, y);
      if (nd && NOMBRE[nd.id]) { sel = nd.id; dibujar(); }
    });
    nuevo();
  }

  /* ---------- Fig. 2: dependencias a larga distancia ---------- */

  function montarLarga(cuerpo) {
    let n = 80, mezcla = 0.1, semilla = 1, tauLD = 0.6, trazas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos que rompen la regla', min: 0, max: 0.5, paso: 0.02, valor: mezcla, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { mezcla = v; nuevo(); } });
    ctl.rango({ etiqueta: 'Umbral de larga distancia', min: 0.1, max: 0.98, paso: 0.02, valor: tauLD, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tauLD = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Casos', min: 20, max: 200, paso: 10, valor: n, alCambiar: (v) => { n = v; nuevo(); } });
    ctl.boton('Nuevo registro', () => { semilla++; nuevo(); }, { primario: true });
    const N2 = { a: 'Recibir', b: 'Pago con tarjeta', c: 'Pago por transferencia', d: 'Preparar', e: 'Emitir boleta', f: 'Emitir factura', g: 'Despachar' };
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 230, altoMax: 320 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'dependencia directa', forma: 'linea' },
      { color: C.s2, texto: 'dependencia de larga distancia detectada', forma: 'linea' },
    ]);
    nombres(cuerpo, N2);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const caja = VIZ.el('div', { class: 'caja-desplazable' }), tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El tipo de pago (b o c) decide el documento (e o f), pero entre ambos hay una actividad (d) que no depende de ninguno. El grafo local no puede expresarlo: acepta las cuatro combinaciones. Suba el umbral con casos que rompen la regla y la dependencia de larga distancia se pierde.');

    function nuevo() {
      const rnd = VIZ.semilla(semilla * 131 + 7), cuenta = new Map();
      for (let i = 0; i < n; i++) {
        const tarjeta = rnd() < 0.5;
        let doc = tarjeta ? 'e' : 'f';
        if (rnd() < mezcla) doc = doc === 'e' ? 'f' : 'e';
        const t = 'a' + (tarjeta ? 'b' : 'c') + 'd' + doc + 'g';
        cuenta.set(t, (cuenta.get(t) || 0) + 1);
      }
      trazas = [...cuenta.entries()];
      dibujar();
    }
    // |x ≫ y|: apariciones de x seguidas (antes de otra x) por alguna y.
    function ld(tr, x, y) {
      let k = 0, nx = 0, ny = 0;
      for (const [t, veces] of tr) {
        const s = [...t];
        s.forEach((a, i) => { if (a === x) { nx += veces; const sig = s.indexOf(x, i + 1), fin = sig < 0 ? s.length : sig; if (s.indexOf(y, i + 1) >= 0 && s.indexOf(y, i + 1) < fin) k += veces; } if (a === y) ny += veces; });
      }
      return { k, nx, ny, v: Math.min((2 * k - nx) / (nx + 1), (2 * k - ny) / (ny + 1)) };
    }
    function dibujar() {
      if (!trazas.length) return;
      lienzo.limpiar();
      const log = trazas.flatMap(([t, v]) => Array.from({ length: v }, () => [...t]));
      const D = dependencias(log, 0.8, 2), total = log.length;
      const locales = [...D.dep].map((k) => [k[0], k[1]]);
      const pares = [];
      for (const x of D.acts) for (const y of D.acts) {
        if (x === y || D.dep.has(x + y)) continue;
        const r = ld(trazas, x, y);
        if (D.frec.get(x) >= 0.9 * total || D.frec.get(y) >= 0.9 * total) continue;
        if (r.k > 0) pares.push({ x, y, ...r });
      }
      pares.sort((p, q) => q.v - p.v);
      const largas = pares.filter((p) => p.v >= tauLD);
      const pos = P.disponer(D.acts, locales);
      const nodos = D.acts.map((a) => ({ id: a, tipo: 'act', etiqueta: a }));
      const aristas = locales.map(([a, b]) => ({ de: a, a: b, ancho: 2 }));
      largas.forEach((p) => aristas.push({ de: p.x, a: p.y, color: C.s2, guiones: true, ancho: 2.5, curva: 34 }));
      P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: 34, margenY: 40 });
      lista.replaceChildren(...(pares.slice(0, 5).map((p) => VIZ.el('div', { class: p.v >= tauLD ? 'activa' : null },
        `${p.x} ≫ ${p.y}:  |${p.x}≫${p.y}| = ${p.k}  |${p.x}| = ${p.nx}  |${p.y}| = ${p.ny}   ⇒ ${f2(p.v)}  ${p.v >= tauLD ? '← se agrega' : ''}`))));
      // Las cuatro combinaciones que permite el grafo local frente a las que permite con las dependencias largas.
      const permite = (t) => largas.every((p) => t.includes(p.x) === t.includes(p.y));
      const combos = ['abdeg', 'abdfg', 'acdeg', 'acdfg'];
      const cuenta = new Map(trazas);
      const filas = combos.map((t) => {
        const ok = permite(t), veces = cuenta.get(t) || 0;
        return VIZ.el('tr', null,
          VIZ.el('td', { class: 'izq' }, t), VIZ.el('td', null, String(veces)), VIZ.el('td', { style: { color: C.s6 } }, '✓'),
          VIZ.el('td', { style: { color: ok ? C.s6 : C.s8 } }, ok ? '✓' : '✗'));
      });
      tabla.replaceChildren(VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'traza posible'), VIZ.el('th', null, 'casos'), VIZ.el('th', null, 'grafo local'), VIZ.el('th', null, 'con larga distancia'))), VIZ.el('tbody', null, filas));
      const nPerm = combos.filter(permite).length;
      const fuera = combos.filter((t) => !permite(t)).reduce((s, t) => s + (cuenta.get(t) || 0), 0);
      registro.textContent = largas.length
        ? `Se agregan ${largas.length} dependencia(s) de larga distancia: el modelo pasa de aceptar 4 combinaciones a ${nPerm}; ${fuera} de ${total} casos quedan fuera del modelo restringido.`
        : `Ninguna medida supera ${VIZ.fmt(tauLD, 2)}: el modelo sigue aceptando las 4 combinaciones, incluidas ${2} que nunca debieron ocurrir.`;
      lectura.set([
        ['dependencias directas', String(locales.length)],
        ['dependencias de larga distancia', String(largas.length)],
        ['combinaciones aceptadas', `${nPerm} de 4`],
        ['casos fuera del modelo', `${fuera} de ${total}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    nuevo();
  }

  VIZ.registrarTema('flexible-heuristics-miner', {
    intro: String.raw`
      <p>El <strong>Flexible Heuristics Miner</strong> (FHM) parte del grafo de dependencias del <a href="tema.html?id=heuristic-miner">Heuristic Miner</a> y
      lo convierte en una <a href="tema.html?id=causal-nets">C-Net</a>: a cada actividad le agrega <em>enlaces de entrada y de salida</em>, es decir, qué
      combinaciones de actividades se activaron juntas cada vez que ocurrió. Si las salidas ocurren siempre juntas, es un AND; si ocurre una sola cada vez, es
      un XOR; las mezclas aparecen como grupos o como OR.</p>
      <p>Además detecta <strong>dependencias de larga distancia</strong>: relaciones como «si se pagó con tarjeta, habrá boleta» que no son vecinas
      en las trazas y que un grafo local no puede expresar.</p>`,
    visualizaciones: [
      {
        titulo: 'De dependencias a C-Net',
        descripcion: 'Haga clic en d y compare sus enlaces: salidas {e} y {f,g} dan un split de grupos (×+); a abre {b,c} a la vez (AND). Suba el ruido y luego la frecuencia mínima para ver desaparecer los enlaces espurios.',
        montar: montarCNet,
      },
      {
        titulo: 'Dependencias de larga distancia',
        descripcion: 'El grafo local acepta cuatro combinaciones, pero solo dos aparecen en el registro. Aumente los casos que rompen la regla hasta que la dependencia b ⇢ e caiga bajo el umbral y desaparezca.',
        montar: montarLarga,
      },
    ],
    teoria: String.raw`
      <h2>Red causal (C-Net)</h2>
      <p>Una <a href="tema.html?id=causal-nets">C-Net</a> es una tupla \((A, a_i, a_o, D, I, O)\) con actividades \(A\), una actividad inicial y una final, un conjunto de
      dependencias \(D \subseteq A \times A\) y, para cada actividad \(a\), conjuntos de <em>enlaces</em>
      \(I(a) \subseteq \mathcal{P}(\mathrm{in}(a))\) y \(O(a) \subseteq \mathcal{P}(\mathrm{out}(a))\). Un enlace es un subconjunto de entradas (o de salidas) que se
      activan a la vez. Así:</p>
      <ul>
        <li>\(O(a) = \{\{b, c\}\}\): AND-split, \(a\) activa \(b\) y \(c\).</li>
        <li>\(O(a) = \{\{b\}, \{c\}\}\): XOR-split, \(a\) activa solo uno.</li>
        <li>\(O(a) = \{\{b\}, \{c, d\}\}\): elige entre \(b\) o el par \(c, d\) (la figura lo marca como ×+).</li>
        <li>\(O(a) = \{\{b\},\{c\},\{b,c\}\}\): OR-split.</li>
      </ul>
      <h2>Cómo se obtienen los enlaces</h2>
      <p>FHM reproduce cada traza sobre el grafo de dependencias y, para cada aparición de una actividad, anota el subconjunto de vecinos con los que se
      relacionó realmente. En esta página: una aparición de \(x\) en la posición \(i\) activa a \(y\) en la posición \(j > i\) si</p>
      <ol>
        <li>\(x\) es una entrada de \(y\) en el grafo, \(x\) no vuelve a aparecer y no hay otra \(y\) entre \(i\) y \(j\);</li>
        <li>no hay una actividad \(z\) entre ambas que sea entrada de \(y\) y sucesora directa de \(x\) (ella sería la causa más cercana).</li>
      </ol>
      <pre><code>para cada traza σ y cada aparición y en la posición j:
    para cada x ∈ entradas(y) con última aparición i &lt; j y sin otra y entre i y j:
        si ninguna z entre i y j cumple (z ∈ entradas(y) y x → z):
            salida[i] ← salida[i] ∪ {y};  entrada[j] ← entrada[j] ∪ {x}
contar cada subconjunto salida[i] y entrada[j] como un enlace de su actividad
conservar los enlaces con frecuencia relativa ≥ θ</code></pre>
      <p>El umbral \(\theta\) elimina enlaces producidos por ruido; los enlaces que quedan determinan el tipo de compuerta (todos de tamaño 1: XOR; uno solo: AND;
      grupos disjuntos: ×+; solapados: OR).</p>
      <h2>Dependencias de larga distancia</h2>
      <p>Para \(a, b\) sin dependencia directa, sea \(|a \gg b|\) el número de apariciones de \(a\) seguidas, antes de otra \(a\), por una \(b\). Se usa la medida</p>
      \[ a \Rightarrow^{l} b \;=\; \min\!\left( \frac{2\,|a \gg b| - |a|}{|a| + 1},\; \frac{2\,|a \gg b| - |b|}{|b| + 1} \right), \]
      <p>que es alta solo si <em>casi toda</em> \(a\) va seguida de \(b\) y casi toda \(b\) fue precedida de \(a\) (una forma de la medida de Weijters y Ribeiro). Se omiten los pares
      donde alguna actividad aparece en casi todos los casos, porque la relación sería trivial.</p>
      <p>Ejemplo del registro: con 40 casos de tarjeta y 40 de transferencia y ninguna mezcla, \(|b \gg e| = |b| = |e| = 40\) y la medida vale
      \(\tfrac{2\cdot 40 - 40}{41} \approx 0{,}98\). Si 4 de los 40 casos con tarjeta reciben factura, \(|b \gg e| = 36\), \(|e| = 40\) y la medida baja a \(\tfrac{72-40}{41} \approx 0{,}78\);
      con 40 % de mezclas ya no se distingue del azar.</p>
      <div class="recuadro"><p><strong>Por qué importa:</strong> una C-Net con dependencia larga acepta menos comportamiento. Mejora la <a href="tema.html?id=fitness-precision">precisión</a> sin perder
      <em>fitness</em> cuando la regla es real, pero un umbral demasiado permisivo agrega restricciones que el ruido ocasional vuelve falsas.</p></div>
      <h2>Conexiones</h2>
      <ul>
        <li>La salida de FHM se puede traducir a una <a href="tema.html?id=petri-nets">red de Petri</a> y verificar con <a href="tema.html?id=token-based-replay">reproducción de fichas</a>.</li>
        <li>Se parece al descubrimiento de compuertas del <a href="tema.html?id=split-miner">Split Miner</a>, pero con bindings explícitos en lugar de relaciones de concurrencia.</li>
        <li>Su sensibilidad al ruido se estudia en <a href="tema.html?id=noise-and-incompleteness">Noise and Incompleteness</a>.</li>
      </ul>`,
  });
})();
