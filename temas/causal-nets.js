(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Modelo: actividades con bindings de entrada y de salida ---------- */

  // Un binding es un conjunto de actividades; la lista de bindings de una actividad es un XOR de conjuntos (cada uno, un AND).
  const B = (...s) => ({ set: s, on: true });
  function diamante(on) {
    const m = {
      acts: ['a', 'b', 'c', 'd', 'e'], ini: 'a', fin: 'e',
      pos: { a: [0, 0.5], b: [0.33, 0.18], c: [0.33, 0.82], d: [0.66, 0.5], e: [1, 0.5] },
      ent: { a: [{ set: [], on: true, fijo: true }], b: [B('a')], c: [B('a')], d: [B('b'), B('c'), B('b', 'c')], e: [B('d')] },
      sal: { a: [B('b'), B('c'), B('b', 'c')], b: [B('d')], c: [B('d')], d: [B('e')], e: [{ set: [], on: true, fijo: true }] },
    };
    m.sal.a.forEach((x, i) => { x.on = on[0][i]; });
    m.ent.d.forEach((x, i) => { x.on = on[1][i]; });
    return m;
  }
  function bucle() {
    return {
      acts: ['a', 'b', 'c'], ini: 'a', fin: 'c',
      pos: { a: [0, 0.5], b: [0.5, 0.5], c: [1, 0.5] },
      ent: { a: [{ set: [], on: true, fijo: true }], b: [B('a'), B('b')], c: [B('b')] },
      sal: { a: [B('b')], b: [B('b'), B('c')], c: [{ set: [], on: true, fijo: true }] },
    };
  }
  const MODELOS = {
    or: { nombre: 'Diamante con OR (cualquier subconjunto)', crear: () => diamante([[true, true, true], [true, true, true]]) },
    xor: { nombre: 'Diamante con XOR (b o c)', crear: () => diamante([[true, true, false], [true, true, false]]) },
    and: { nombre: 'Diamante con AND (b y c)', crear: () => diamante([[false, false, true], [false, false, true]]) },
    bucle: { nombre: 'Bucle sobre b', crear: bucle },
  };

  const activos = (m, tipo, x) => m[tipo][x].filter((b) => b.on).map((b) => b.set);
  const nom = (s) => '{' + s.join(',') + '}';

  // Enlaces causales: x → y si algún binding de salida de x contiene y y algún binding de entrada de y contiene x.
  function enlaces(m) {
    const res = [];
    for (const x of m.acts) for (const y of m.acts) {
      const sale = m.sal[x].some((b) => b.set.includes(y)), entra = m.ent[y].some((b) => b.set.includes(x));
      if (!sale && !entra) continue;
      const sOn = m.sal[x].some((b) => b.on && b.set.includes(y)), eOn = m.ent[y].some((b) => b.on && b.set.includes(x));
      res.push({ de: x, a: y, sOn, eOn, vivo: sOn && eOn });
    }
    return res;
  }

  // Ejecuciones válidas: sucesión de (actividad, binding de entrada, binding de salida) que consume exactamente lo que se emite.
  function opciones(m, x, pend, primero) {
    const res = [];
    for (const I of activos(m, 'ent', x)) {
      if (primero ? I.length : (!I.length || !I.every((y) => (pend[y + '>' + x] || 0) > 0))) continue;
      for (const O of activos(m, 'sal', x)) res.push([I, O]);
    }
    return res;
  }
  function aplicar(pend, x, I, O) {
    const p = { ...pend };
    I.forEach((y) => { p[y + '>' + x]--; });
    O.forEach((z) => { p[x + '>' + z] = (p[x + '>' + z] || 0) + 1; });
    return p;
  }
  const limpia = (p) => Object.values(p).every((v) => v === 0);
  const pendientes = (p) => Object.keys(p).filter((k) => p[k] > 0).map((k) => (p[k] > 1 ? `${k.replace('>', '→')}×${p[k]}` : k.replace('>', '→')));

  function trazasValidas(m, largo) {
    const res = new Map();
    const rec = (pend, pasos, s) => {
      for (const x of m.acts) {
        if (x === m.ini) continue;
        for (const [I, O] of opciones(m, x, pend, false)) {
          const p2 = aplicar(pend, x, I, O), pasos2 = [...pasos, { a: x, I, O }], s2 = s + x;
          if (x === m.fin) { if (limpia(p2) && !res.has(s2)) res.set(s2, pasos2); continue; }
          if (pasos2.length < largo) rec(p2, pasos2, s2);
        }
      }
    };
    for (const [I, O] of opciones(m, m.ini, {}, true)) rec(aplicar({}, m.ini, I, O), [{ a: m.ini, I, O }], m.ini);
    return [...res.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b)).map((s) => ({ traza: s, pasos: res.get(s) }));
  }

  // Busca bindings que reproduzcan la secuencia `seq` (arreglo); devuelve los pasos o null.
  function testigo(m, seq, exigirFin) {
    const rec = (i, pend, pasos) => {
      if (i === seq.length) return !exigirFin || (seq[i - 1] === m.fin && limpia(pend)) ? pasos : null;
      const x = seq[i];
      if ((i === 0) !== (x === m.ini) || !m.acts.includes(x)) return null;
      for (const [I, O] of opciones(m, x, pend, i === 0)) {
        const r = rec(i + 1, aplicar(pend, x, I, O), [...pasos, { a: x, I, O }]);
        if (r) return r;
      }
      return null;
    };
    return rec(0, {}, []);
  }

  /* ---------- Dibujo ---------- */

  function nodosAristas(m, o = {}) {
    const nodos = m.acts.map((x) => ({ id: x, tipo: 'act', etiqueta: x, borde: x === m.ini ? C.s6 : x === m.fin ? C.tinta : C.tinta, anillo: o.activo === x ? C.s2 : null, relleno: x === m.fin ? C.neutro : C.superficie }));
    const aristas = enlaces(m).map((e) => {
      const k = e.de + '>' + e.a, n = o.pend ? o.pend[k] || 0 : 0;
      let color = e.vivo ? C.eje : C.s8, ancho = 1.5, guiones = !e.vivo, etiqueta;
      if (o.consumidos && o.consumidos.has(k)) { color = C.s2; ancho = 3; etiqueta = '−1'; }
      else if (n > 0) { color = C.s4; ancho = 3; etiqueta = n; }
      else if (o.sinColor) { color = e.vivo ? C.s1 : C.s8; ancho = e.vivo ? 2 : 1.5; }
      return { de: e.de, a: e.a, color, ancho, guiones, etiqueta, colorTexto: C.tinta, curva: e.de !== e.a && m.pos[e.a][0] <= m.pos[e.de][0] ? 30 : undefined };
    });
    return { nodos, aristas };
  }
  function dibujarCNet(lienzo, m, o) {
    const pos = {};
    m.acts.forEach((x) => { pos[x] = { x: m.pos[x][0], y: m.pos[x][1] }; });
    const { nodos, aristas } = nodosAristas(m, o);
    lienzo.limpiar();
    return P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 12, margenX: 44, margenY: 36 });
  }
  function bindingsTexto(m) {
    return m.acts.map((x) => {
      const e = activos(m, 'ent', x), s = activos(m, 'sal', x);
      return `${x}   entrada: ${x === m.ini ? '—' : e.length ? e.map(nom).join(' ∨ ') : '(ninguna)'}   salida: ${x === m.fin ? '—' : s.length ? s.map(nom).join(' ∨ ') : '(ninguna)'}`;
    });
  }
  // Motivo por el que no hay trazas válidas.
  function diagnostico(m) {
    for (const x of m.acts) for (const O of activos(m, 'sal', x)) for (const y of O) {
      if (!m.ent[y].some((b) => b.on && b.set.includes(x))) return `${x} emite una obligación hacia ${y}, pero ningún binding de entrada activo de ${y} la consume: quedaría pendiente.`;
    }
    for (const y of m.acts) for (const I of activos(m, 'ent', y)) for (const x of I) {
      if (!m.sal[x].some((b) => b.on && b.set.includes(y))) return `${y} espera una señal de ${x}, pero ningún binding de salida activo de ${x} se la envía.`;
    }
    return 'Los bindings activos no se combinan: alguna obligación nunca se consume o falta alguna actividad.';
  }

  /* ---------- Fig. 1: elegir bindings y ver las trazas ---------- */

  function montarBindings(cuerpo) {
    let clave = 'or', m = MODELOS[clave].crear(), largo = 8, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: Object.entries(MODELOS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; m = MODELOS[v].crear(); armar(); dibujar(); } });
    ctl.rango({ etiqueta: 'Máx. actividades por traza', min: 4, max: 10, valor: largo, alCambiar: (v) => { largo = v; dibujar(); } });
    const cont = VIZ.el('div');
    cuerpo.appendChild(cont);
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [
      { color: C.eje, texto: 'enlace causal con binding de salida y de entrada', forma: 'linea' },
      { color: C.s8, texto: 'enlace incompleto: falta uno de los dos bindings', forma: 'linea' },
      { color: C.s6, texto: 'actividad de inicio', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const trazasEl = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(trazasEl);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque o desmarque bindings: cada conjunto es un AND y la lista de conjuntos de una actividad es un XOR. Una traza es válida si cada obligación que emite una actividad la consume exactamente otra y no queda ninguna al terminar. Pruebe dejar solo {b,c} en la salida de a y quitar {b,c} de la entrada de d.');

    function armar() {
      cont.replaceChildren();
      const c2 = VIZ.controles(cont);
      const items = [];
      for (const x of m.acts) for (const tipo of ['sal', 'ent']) {
        if (m[tipo][x].length < 2) continue;
        m[tipo][x].forEach((b, i) => items.push({ clave: `${tipo}|${x}|${i}`, texto: `${tipo === 'sal' ? 'salida' : 'entrada'} de ${x}: ${nom(b.set)}`, activo: b.on }));
      }
      if (items.length) c2.casillas(items, (est) => { for (const k in est) { const [tipo, x, i] = k.split('|'); m[tipo][x][+i].on = est[k]; } dibujar(); });
    }
    function dibujar() {
      geo = dibujarCNet(lienzo, m, { sinColor: false });
      const tr = trazasValidas(m, largo);
      lista.replaceChildren(...bindingsTexto(m).map((t) => VIZ.el('div', null, t)));
      trazasEl.replaceChildren(VIZ.el('div', null, `Trazas válidas (≤ ${largo} actividades): ${tr.length}`), ...tr.slice(0, 16).map((t) => VIZ.el('div', null, t.traza.split('').join(' → '))), ...(tr.length > 16 ? [VIZ.el('div', null, `… y ${tr.length - 16} más`)] : []));
      const enl = enlaces(m);
      registro.textContent = tr.length ? `${tr.length} traza(s) válida(s). Cada una es una forma distinta de que las obligaciones emitidas coincidan con las consumidas.` : `Ninguna traza es válida. ${diagnostico(m)}`;
      lectura.set([
        ['trazas válidas', String(tr.length)],
        ['enlaces causales completos', `${enl.filter((e) => e.vivo).length} de ${enl.length}`],
        ['bindings activos', String(m.acts.reduce((s, x) => s + activos(m, 'ent', x).length + activos(m, 'sal', x).length, 0))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    armar();
    dibujar();
  }

  /* ---------- Fig. 2: ejecución de la C-Net ---------- */

  function montarEjecucion(cuerpo) {
    let clave = 'or', m = MODELOS[clave].crear(), entrada = 'abcde', pasos = [], hecho = 0, pend = {}, ult = null, consumidos = new Set(), mensaje = '', fallo = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: Object.entries(MODELOS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; m = MODELOS[v].crear(); const t = trazasValidas(m, 8); entrada = t.length ? t[Math.min(t.length - 1, 1)].traza : ''; caja.valor = entrada; rep.reiniciar(); } });
    const caja = ctl.texto({ etiqueta: 'Traza a ejecutar', valor: entrada, alCambiar: (v) => { entrada = v.trim().toLowerCase(); rep.reiniciar(); }, alEnter: (v) => { entrada = v.trim().toLowerCase(); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Otra traza válida', () => {
      const t = trazasValidas(m, 9);
      if (!t.length) return;
      const i = t.findIndex((q) => q.traza === entrada);
      entrada = t[(i + 1) % t.length].traza; caja.valor = entrada; rep.reiniciar();
    });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'obligación pendiente (número = cuántas)', forma: 'linea' },
      { color: C.s2, texto: 'obligación que consume el paso actual', forma: 'linea' },
      { color: C.s2, texto: 'actividad que se ejecuta ahora (anillo)', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada actividad elige un binding de entrada (qué obligaciones consume) y uno de salida (qué obligaciones emite). Escriba su propia traza, por ejemplo abde, acbde o abe, y vea dónde falla. «Otra traza válida» recorre las que admite el modelo.');

    function iniciar() {
      const seq = [...entrada];
      let k = seq.length, w = null;
      for (; k >= 0; k--) { w = k ? testigo(m, seq.slice(0, k), false) : []; if (w) break; }
      pasos = w || [];
      hecho = 0; pend = {}; ult = null; consumidos = new Set();
      const completa = pasos.length === seq.length;
      fallo = '';
      if (!completa) fallo = `La traza no es válida: «${seq[pasos.length]}» no puede ejecutarse en la posición ${pasos.length + 1} (ningún binding de entrada tiene todas sus obligaciones pendientes).`;
      mensaje = `Traza ${entrada || '(vacía)'}: ${pasos.length ? 'se ejecutará paso a paso.' : 'no se puede ejecutar ni el primer evento.'}`;
      return (function* () {
        for (const p of pasos) {
          consumidos = new Set(p.I.map((y) => y + '>' + p.a));
          pend = aplicar(pend, p.a, p.I, p.O);
          ult = p.a; hecho++;
          mensaje = `Ejecuta ${p.a}: consume ${p.I.length ? nom(p.I.map((y) => y + '→' + p.a)) : '∅'} y emite ${p.O.length ? nom(p.O.map((z) => p.a + '→' + z)) : '∅'}.`;
          yield;
        }
        consumidos = new Set();
        if (fallo) mensaje = fallo;
        else if (seq[seq.length - 1] !== m.fin) mensaje = `La traza termina en ${seq[seq.length - 1] || '—'}, no en la actividad final ${m.fin}.`;
        else if (!limpia(pend)) mensaje = `Quedan obligaciones sin consumir: ${pendientes(pend).join(', ')}. La traza no es válida.`;
        else mensaje = 'Traza válida: terminó en la actividad final sin obligaciones pendientes.';
        yield;
      })();
    }
    function dibujar() {
      dibujarCNet(lienzo, m, { pend, activo: ult, consumidos });
      registro.textContent = mensaje;
      lista.replaceChildren(...(pasos.length ? pasos.map((p, i) => VIZ.el('div', { class: i === hecho - 1 ? 'activa' : null }, `${i + 1}. ${p.a}   entrada ${p.I.length ? nom(p.I) : '∅'}   salida ${p.O.length ? nom(p.O) : '∅'}`)) : [VIZ.el('div', null, 'Sin pasos ejecutables.')]));
      const fin = rep.terminado || hecho >= pasos.length;
      lectura.set([
        ['pasos', `${hecho} de ${pasos.length}`],
        ['obligaciones pendientes', pendientes(pend).join(', ') || 'ninguna'],
        ['veredicto', !fin ? '—' : (!fallo && [...entrada].pop() === m.fin && limpia(pend) ? 'válida' : 'no válida')],
      ]);
    }
    lienzo.alDibujar = dibujar;
    caja.valor = entrada;
    rep.reiniciar();
  }

  VIZ.registrarTema('causal-nets', {
    intro: String.raw`
      <p>Una <strong>red causal</strong> (<em>causal net</em>, C-Net) describe un proceso solo con actividades y <em>enlaces causales</em> entre ellas, sin plazas ni
      fichas. Lo que decide el comportamiento son los <strong>bindings</strong>: cada actividad dice <em>de qué actividades</em> necesita señal de entrada y
      <em>a cuáles</em> la envía al terminar, como un XOR de conjuntos, y cada conjunto es un AND.</p>
      <p>Esto expresa de forma natural una elección inclusiva (cualquier subconjunto no vacío de ramas), algo que una red de Petri solo logra con transiciones
      silenciosas. Un registro de eventos es válido en la C-Net si se pueden asignar bindings que hagan coincidir lo que cada actividad emite con lo que otra consume.</p>`,
    visualizaciones: [
      {
        titulo: 'Bindings de entrada y de salida',
        descripcion: 'Active o desactive bindings y mire cómo cambia la lista de trazas válidas. Pruebe «Diamante con OR»; luego deje solo {b,c} en la salida de a y desmarque {b,c} en la entrada de d: no queda ninguna traza válida.',
        montar: montarBindings,
      },
      {
        titulo: 'Ejecutar una traza en la red causal',
        descripcion: 'Reproduzca una traza y siga las obligaciones pendientes. Escriba abe en el diamante: e no puede ejecutarse porque d nunca se ejecutó.',
        montar: montarEjecucion,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una red causal es una tupla \(C = (A, a_s, a_e, D, I, O)\) donde \(A\) es el conjunto de actividades, \(a_s\) la única actividad de inicio y \(a_e\) la
      única de fin, \(D \subseteq A \times A\) las dependencias causales, y para cada actividad \(a\):</p>
      \[ I(a) \subseteq \mathcal{P}\bigl(\{ x \mid (x, a) \in D \}\bigr), \qquad O(a) \subseteq \mathcal{P}\bigl(\{ y \mid (a, y) \in D \}\bigr) \]
      <p>son los <em>bindings de entrada</em> y de <em>salida</em>: conjuntos de conjuntos de actividades. Elegir un binding \(X \in I(a)\) significa «\(a\) necesita
      una señal de cada actividad de \(X\)», y \(Y \in O(a)\) significa «\(a\) envía una señal a cada actividad de \(Y\)». La lista de bindings es un XOR, y cada
      binding, un AND.</p>
      <h2>Secuencias de binding válidas</h2>
      <p>El estado es un multiconjunto de <em>obligaciones pendientes</em> \((x, y)\): \(x\) ya se ejecutó y \(y\) aún debe consumir su señal. Una ejecución es una sucesión
      \(\langle (a_1, X_1, Y_1), \dots, (a_n, X_n, Y_n) \rangle\) tal que:</p>
      <ol>
        <li>empieza en \(a_s\) y termina en \(a_e\);</li>
        <li>en cada paso, para todo \(x \in X_i\) existe una obligación pendiente \((x, a_i)\), que se consume, y se crea \((a_i, y)\) para todo \(y \in Y_i\);</li>
        <li>al terminar no queda ninguna obligación pendiente.</li>
      </ol>
      <p>La traza es la proyección \(\langle a_1, \dots, a_n \rangle\); es <em>válida</em> si existe una elección de bindings que cumpla 1–3.</p>
      <pre><code>pend ← ∅
para i ← 1 hasta n:
    elegir X ∈ I(aᵢ) con (x, aᵢ) ∈ pend para todo x ∈ X
    elegir Y ∈ O(aᵢ)
    pend ← pend − {(x, aᵢ) : x ∈ X} + {(aᵢ, y) : y ∈ Y}
aceptar si aₙ = a_e y pend = ∅</code></pre>
      <h2>Ejemplo: elección inclusiva</h2>
      <p>Con \(O(a) = \{\{b\}, \{c\}, \{b, c\}\}\) y \(I(d) = \{\{b\}, \{c\}, \{b, c\}\}\), las trazas válidas son \(abde\), \(acde\), \(abcde\) y \(acbde\). La red de
      Petri equivalente necesita compuertas silenciosas para decidir cuántas ramas se activan y esperar solo a esas; la C-Net lo dice directamente. Si solo
      se permite \(\{b, c\}\) en la salida de \(a\) pero no en la entrada de \(d\), la señal de \(c\) nunca se consume: no hay ninguna traza válida.</p>
      <div class="recuadro"><p><strong>Consistencia.</strong> Una C-Net es <em>sound</em> si para toda actividad hay al menos una secuencia válida que la ejecuta y
      toda secuencia parcial puede completarse. Los bindings «huérfanos» (que nunca se emparejan) se eliminan en la práctica.</p></div>
      <h2>Comparación y conexiones</h2>
      <table>
        <tr><th></th><th>Red causal</th><th><a href="tema.html?id=petri-nets">Red de Petri</a></th></tr>
        <tr><td>Nodos</td><td>solo actividades</td><td>plazas y transiciones</td></tr>
        <tr><td>Estado</td><td>obligaciones pendientes</td><td>marcado</td></tr>
        <tr><td>Elección inclusiva</td><td>directa</td><td>necesita transiciones silenciosas</td></tr>
        <tr><td>Actividades duplicadas</td><td>no admite</td><td>admite</td></tr>
      </table>
      <p>Las C-Nets son el modelo de salida del <a href="tema.html?id=flexible-heuristics-miner">Flexible Heuristics Miner</a>, que aprende los bindings contando qué
      combinaciones de entradas y salidas ocurren en el registro, y de la segunda familia de algoritmos de la <a href="tema.html?id=heuristic-miner">minería heurística</a>.
      Para comprobar conformidad contra una C-Net se aplican <a href="tema.html?id=alignments">alineamientos</a>, igual que con una red de Petri.</p>`,
  });
})();
