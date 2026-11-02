(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Ayudantes ---------- */

  // «abcd:3 acbd:2» → [['abcd', 3], ['acbd', 2]]; actividades a–j.
  function leerTrazas(txt) {
    const pares = [];
    for (const tok of String(txt).toLowerCase().split(/[\s,;]+/)) {
      if (!tok) continue;
      const [t, m] = tok.split(':');
      const traza = t.replace(/[^a-j]/g, '');
      if (traza) pares.push([traza, Math.max(1, Math.min(50, parseInt(m, 10) || 1))]);
    }
    return pares;
  }

  // Un modelo es un autómata determinista: inicio(), pasos(s) → [[act, s']], fin(s), clave(s).
  function modeloRed(red) {
    const tr = red.trans.filter((t) => !t.silenciosa);
    return {
      inicio: () => P.marcadoInicial(red),
      pasos: (m) => tr.filter((t) => P.habilitada(red, m, t.id)).map((t) => [t.nombre, P.disparar(red, m, t.id)]),
      fin: (m) => Object.keys(m).every((k) => (k === red.fin ? m[k] === 1 : !(m[k] > 0))),
      clave: (m) => Object.keys(m).filter((k) => m[k] > 0).sort().map((k) => k + m[k]).join(','),
    };
  }
  function arbolPrefijos(vars) {
    const nodos = [{ id: 's0', hijos: new Map(), fin: false }];
    for (const v of vars) {
      let u = nodos[0];
      for (const a of v.traza) {
        if (!u.hijos.has(a)) { const w = { id: 's' + nodos.length, hijos: new Map(), fin: false }; nodos.push(w); u.hijos.set(a, w); }
        u = u.hijos.get(a);
      }
      u.fin = true;
    }
    return nodos;
  }
  const modeloArbol = (nodos) => ({ inicio: () => nodos[0], pasos: (u) => [...u.hijos.entries()], fin: (u) => u.fin, clave: (u) => u.id });
  const modeloFlower = (acts) => ({ inicio: () => 'c', pasos: () => acts.map((a) => [a, 'c']), fin: () => true, clave: () => 'c' });

  function recorrer(m, traza) {
    let s = m.inicio();
    for (const a of traza) {
      const x = m.pasos(s).find(([b]) => b === a);
      if (!x) return null;
      s = x[1];
    }
    return s;
  }
  function contar(m, L) {
    const memo = new Map();
    const f = (s, r) => {
      const k = m.clave(s) + '|' + r;
      if (memo.has(k)) return memo.get(k);
      let t = m.fin(s) ? 1 : 0;
      if (r > 0) for (const [, s2] of m.pasos(s)) t += f(s2, r - 1);
      memo.set(k, t);
      return t;
    };
    return f(m.inicio(), L);
  }
  // Los cuatro criterios sobre las variantes del registro.
  function evaluar(m, vars, L) {
    let ok = 0, tot = 0;
    for (const v of vars) { tot += v.n; const s = recorrer(m, v.traza); if (s !== null && m.fin(s)) ok += v.n; }
    const pref = new Map();
    for (const v of vars) {
      for (let i = 0; i <= v.traza.length; i++) {
        const k = v.traza.slice(0, i).join('');
        if (!pref.has(k)) pref.set(k, { traza: v.traza.slice(0, i), n: 0, sig: new Set() });
        const e = pref.get(k); e.n += v.n;
        if (i < v.traza.length) e.sig.add(v.traza[i]);
      }
    }
    let esc = 0, hab = 0;
    for (const e of pref.values()) {
      const s = recorrer(m, e.traza);
      if (s === null) continue;
      const h = new Set(m.pasos(s).map((x) => x[0]));
      hab += e.n * h.size;
      esc += e.n * [...h].filter((a) => !e.sig.has(a)).length;
    }
    return { fitness: tot ? ok / tot : 0, precision: hab ? 1 - esc / hab : 1, aceptadas: contar(m, L) };
  }

  // Dibuja una red de Petri; plazas con id corto (p1, p2…), inicio y fin como círculos especiales.
  function dibujarRed(lienzo, red, pos, marcado, o = {}) {
    const { nodos, aristas } = P.nodosDeRed(red, marcado, {
      plaza: (p) => ({
        ...(p.id === red.ini ? { tipo: 'inicio' } : p.id === red.fin ? { tipo: 'fin' } : { etiqueta: p.id }),
        ...(o.plaza ? o.plaza(p) : {}),
      }),
      trans: (t) => (o.trans ? o.trans(t) : {}),
    });
    return P.dibujarGrafo(lienzo, nodos, aristas, pos, { etiquetasPlazas: true });
  }

  const EJ = {
    mixto: ['Elección y paralelo (clásico)', 'abcd:3 acbd:2 aed:2'],
    secuencia: ['Secuencia', 'abcd:6'],
    eleccion: ['Elección', 'abd:4 acd:3'],
    paralelo: ['Paralelo', 'abcd:3 acbd:3'],
    ciclo: ['Ciclo de longitud 3', 'abcf:3 abcdbcf:2 abcdbcdbcf:1'],
  };
  const opcionesEj = Object.entries(EJ).map(([k, v]) => [k, v[0]]);

  /* ---------- Fig. 1: del registro al modelo ---------- */

  function montarPlayIn(cuerpo) {
    let texto = EJ.mixto[1], dato = null, marcado = {}, traza = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    const selEj = ctl.selector({ etiqueta: 'Registro de ejemplo', opciones: opcionesEj, valor: 'mixto', alCambiar: (v) => { texto = EJ[v][1]; txt.valor = texto; compilar(); } });
    const txt = ctl.texto({ etiqueta: 'Trazas (traza:veces, actividades a–j)', valor: texto, alCambiar: (v) => { texto = v; compilar(); } });
    ctl.boton('Reiniciar fichas', () => reiniciar(), { primario: true });
    ctl.boton('Disparar al azar', () => {
      if (!dato) return;
      const hab = dato.alfa.red.trans.filter((t) => P.habilitada(dato.alfa.red, marcado, t.id));
      if (hab.length) disparar(hab[Math.floor(Math.random() * hab.length)]);
    });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'transición habilitada (clic para disparar)', forma: 'cuadro' },
      { color: C.tinta, texto: 'ficha en una plaza', forma: 'punto' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El registro de la izquierda es la única entrada: de él sale la red. Haga clic en una transición con anillo verde para jugar con las fichas; si llega al final, la lista dice si esa traza estaba en el registro. Edite las trazas para descubrir otro modelo.');

    function compilar() {
      const pares = leerTrazas(texto);
      const log = P.logSimple(pares);
      const acts = P.actividades(log);
      if (!log.length || acts.length > 10) { dato = null; dibujar(); return; }
      const alfa = P.alfa(log);
      const vars = P.variantes(log);
      const m = modeloRed(alfa.red);
      dato = { log, vars, alfa, pos: P.posDeRed(alfa.red), m };
      reiniciar();
    }
    function reiniciar() {
      if (dato) marcado = P.marcadoInicial(dato.alfa.red);
      traza = [];
      registro.textContent = 'La red nace con una ficha en «inicio». Dispare las transiciones habilitadas.';
      dibujar();
    }
    function disparar(t) {
      marcado = P.disparar(dato.alfa.red, marcado, t.id);
      traza.push(t.nombre);
      const ent = P.entradas(dato.alfa.red, t.id).join(', '), sal = P.salidas(dato.alfa.red, t.id).join(', ');
      registro.textContent = `Disparó ${t.nombre}: consume una ficha de {${ent}} y produce una en {${sal}}.`;
      if (dato.m.fin(marcado)) {
        const s = traza.join('');
        registro.textContent += dato.vars.some((v) => v.clave === traza.join('›')) ? ` Final alcanzado con «${s}», una traza del registro.` : ` Final alcanzado con «${s}», que NO está en el registro: comportamiento nuevo que el modelo generaliza.`;
      }
      dibujar();
    }
    function dibujar() {
      lienzo.limpiar();
      if (!dato) {
        registro.textContent = 'Escriba al menos una traza con letras de la a a la j.';
        lista.replaceChildren(VIZ.el('div', null, 'Sin registro válido.'));
        lectura.set([['casos', '0']]);
        return;
      }
      const { alfa, vars, log, m } = dato, red = alfa.red;
      const hab = new Set(red.trans.filter((t) => P.habilitada(red, marcado, t.id)).map((t) => t.id));
      geo = dibujarRed(lienzo, red, dato.pos, marcado, { trans: (t) => (hab.has(t.id) ? { anillo: C.s6, relleno: VIZ.alfa(C.s6, 0.15) } : {}) });
      lienzo.canvas.style.cursor = hab.size ? 'pointer' : 'default';
      const actual = traza.join('›');
      const filas = vars.map((v) => {
        const s = recorrer(m, v.traza), ok = s !== null && m.fin(s);
        return VIZ.el('div', { class: v.clave === actual && m.fin(marcado) ? 'activa' : null }, `${v.traza.join('')}  ×${v.n}  `, VIZ.el('span', { style: { color: ok ? C.s6 : C.s8, fontWeight: '600' } }, ok ? '✓ la red la reproduce' : '✗ la red no la reproduce'));
      });
      const plazas = red.plazas.filter((p) => p.id !== red.ini && p.id !== red.fin);
      lista.replaceChildren(...filas, VIZ.el('div', { style: { color: C.apagado } }, plazas.map((p) => `${p.id} = ${p.nombre}`).join('   ') || 'sin plazas intermedias'));
      const reprod = vars.filter((v) => { const s = recorrer(m, v.traza); return s !== null && m.fin(s); }).length;
      lectura.set([
        ['casos en el registro', String(log.length)],
        ['variantes', String(vars.length)],
        ['actividades (transiciones)', String(red.trans.length)],
        ['plazas descubiertas', String(red.plazas.length)],
        ['variantes reproducidas', `${reprod} de ${vars.length}`],
        ['traza disparada', traza.length ? traza.join('') : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!dato || !geo) return;
      const { x, y } = lienzo.posicion(ev), n = P.nodoEn(geo, x, y);
      if (!n) return;
      const t = dato.alfa.red.trans.find((u) => u.id === n.id);
      if (t && P.habilitada(dato.alfa.red, marcado, t.id)) disparar(t);
    });
    compilar();
  }

  /* ---------- Fig. 2: modelos candidatos ---------- */

  const EJ2 = {
    mixto: ['Elección y paralelo (clásico)', 'abcd:3 acbd:2 aed:2'],
    ruido: ['Con un caso raro', 'abcd:6 acbd:5 aed:4 abed:1'],
    secuencia: ['Registro pequeño', 'abc:4 abd:2'],
  };

  function montarCandidatos(cuerpo) {
    let texto = EJ2.mixto[1], mostrar = 'alfa', dato = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Registro de ejemplo', opciones: Object.entries(EJ2).map(([k, v]) => [k, v[0]]), valor: 'mixto', alCambiar: (v) => { texto = EJ2[v][1]; txt.valor = texto; compilar(); } });
    const txt = ctl.texto({ etiqueta: 'Trazas (traza:veces)', valor: texto, alCambiar: (v) => { texto = v; compilar(); } });
    const selM = ctl.selector({ etiqueta: 'Modelo dibujado', opciones: [['alfa', 'Descubierto por α'], ['flower', 'Modelo «flower»'], ['trazas', 'Modelo de trazas']], valor: mostrar, alCambiar: (v) => { mostrar = v; dibujar(); } });
    ctl.boton('Ver el siguiente modelo', () => { const o = ['alfa', 'flower', 'trazas']; mostrar = o[(o.indexOf(mostrar) + 1) % 3]; selM.valor = mostrar; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    cuerpo.dataset.sinLeyenda = 'el dibujo usa solo formas y etiquetas directas; el color no codifica nada';
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las tres filas se evalúan con las mismas trazas. Haga clic en una fila para dibujar ese modelo. «Aceptadas» cuenta todas las trazas de hasta L eventos que el modelo permite: compárela con las variantes del registro.');

    const NOMBRES = { alfa: 'Descubierto por α', flower: 'Modelo «flower»', trazas: 'Modelo de trazas' };
    function compilar() {
      const log = P.logSimple(leerTrazas(texto)), acts = P.actividades(log);
      if (!log.length || acts.length > 8) { dato = null; dibujar(); return; }
      const vars = P.variantes(log), L = Math.max(...vars.map((v) => v.traza.length)) + 2;
      const alfa = P.alfa(log), nodos = arbolPrefijos(vars);
      // Red del modelo flower: una plaza central y una transición por actividad.
      const rf = { plazas: [{ id: 'c', nombre: 'c' }], trans: acts.map((a) => ({ id: 't_' + a, nombre: a })), arcos: acts.flatMap((a) => [['c', 't_' + a], ['t_' + a, 'c']]), ini: 'c', fin: 'c' };
      const posF = { c: { x: 0.5, y: 0.5 } };
      acts.forEach((a, i) => { const ang = (2 * Math.PI * i) / acts.length - Math.PI / 2; posF['t_' + a] = { x: 0.5 + 0.42 * Math.cos(ang), y: 0.5 + 0.42 * Math.sin(ang) }; });
      const aristasT = [];
      nodos.forEach((u) => u.hijos.forEach((w, a) => aristasT.push({ de: u.id, a: w.id, etiqueta: a })));
      const modelos = {
        alfa: { m: modeloRed(alfa.red), tam: alfa.red.plazas.length + alfa.red.trans.length + alfa.red.arcos.length, red: alfa.red, pos: P.posDeRed(alfa.red) },
        flower: { m: modeloFlower(acts), tam: 1 + acts.length + 2 * acts.length, red: rf, pos: posF },
        trazas: { m: modeloArbol(nodos), tam: nodos.length + aristasT.length * 2, nodos, aristas: aristasT, pos: P.disponer(nodos.map((u) => u.id), aristasT.map((e) => [e.de, e.a])) },
      };
      for (const k of Object.keys(modelos)) modelos[k].ev = evaluar(modelos[k].m, vars, L);
      dato = { log, vars, L, modelos };
      dibujar();
    }
    function dibujar() {
      lienzo.limpiar();
      if (!dato) {
        registro.textContent = 'Escriba trazas con hasta 8 actividades distintas (letras a–j).';
        caja.replaceChildren(); lectura.set([['casos', '0']]);
        return;
      }
      const M = dato.modelos[mostrar];
      if (mostrar === 'trazas') {
        const nodos = M.nodos.map((u) => ({ id: u.id, tipo: u.id === 's0' ? 'inicio' : u.fin ? 'fin' : 'plaza' }));
        P.dibujarGrafo(lienzo, nodos, M.aristas, M.pos);
      } else dibujarRed(lienzo, M.red, M.pos, mostrar === 'flower' ? { c: 1 } : P.marcadoInicial(M.red));
      const fm = (x) => VIZ.fmt(x, 3);
      const filas = Object.keys(NOMBRES).map((k) => {
        const e = dato.modelos[k].ev;
        return VIZ.el('tr', { class: 'clicable' + (k === mostrar ? ' activa' : ''), onclick: () => { mostrar = k; selM_sync(); dibujar(); } },
          VIZ.el('td', { class: 'izq' }, NOMBRES[k]), VIZ.el('td', null, fm(e.fitness)), VIZ.el('td', null, fm(e.precision)),
          VIZ.el('td', null, VIZ.entero(e.aceptadas)), VIZ.el('td', null, String(dato.modelos[k].tam)));
      });
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['Modelo', 'Fitness', 'Precisión', `Aceptadas (≤ ${dato.L})`, 'Tamaño'].map((t, i) => VIZ.el('th', { class: i === 0 ? 'izq' : null }, t)))),
        VIZ.el('tbody', null, ...filas)));
      const e = dato.modelos[mostrar].ev;
      registro.textContent = mostrar === 'flower'
        ? 'El modelo flower acepta cualquier secuencia: reproduce todo (fitness 1) pero casi no dice nada (precisión baja, mucho comportamiento extra).'
        : mostrar === 'trazas'
          ? 'El modelo de trazas acepta exactamente las variantes vistas: fitness 1 y precisión 1, pero no generaliza y crece con el registro.'
          : e.fitness < 1 ? 'α no reproduce todas las trazas: el registro tiene un comportamiento que su modelo no admite.' : 'α reproduce el registro y permite algo más que las variantes vistas: generaliza.';
      lectura.set([
        ['variantes en el registro', String(dato.vars.length)],
        ['aceptadas por el modelo', VIZ.entero(e.aceptadas)],
        ['fitness', fm(e.fitness)],
        ['precisión', fm(e.precision)],
        ['tamaño (nodos + arcos)', String(dato.modelos[mostrar].tam)],
      ]);
    }
    function selM_sync() { selM.valor = mostrar; }
    lienzo.alDibujar = dibujar;
    compilar();
  }

  VIZ.registrarTema('process-discovery', {
    intro: String.raw`
      <p>El <strong>descubrimiento de procesos</strong> (<em>process discovery</em>, o <em>play-in</em>) recibe un
      <a href="tema.html?id=event-logs">registro de eventos</a> y devuelve un modelo, por ejemplo una
      <a href="tema.html?id=petri-nets">red de Petri</a>, que describa cómo parece funcionar el proceso. Nadie dibuja el modelo: sale de las trazas.</p>
      <p>Siempre hay muchos modelos posibles para un mismo registro. Uno acepta todo, otro memoriza las trazas vistas, y entre ambos hay una
      gama de compromisos. Medirlos con cuatro criterios (ajuste, precisión, generalización y simplicidad) es lo que permite decir cuál es mejor.</p>`,
    visualizaciones: [
      {
        titulo: 'Del registro a la red',
        descripcion: 'La red nace del registro con el algoritmo α. Dispare sus transiciones y vea si la traza que arma estaba en el registro; edite las trazas y observe cómo cambia el modelo.',
        montar: montarPlayIn,
      },
      {
        titulo: 'Tres modelos para las mismas trazas',
        descripcion: 'Compare el modelo flower, el modelo de trazas y el que descubre α. Fíjese en cuántas trazas acepta cada uno frente a las variantes del registro; agregue un caso raro y vea quién lo absorbe.',
        montar: montarCandidatos,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(L\) un registro (multiconjunto de trazas sobre un alfabeto \(A\) de actividades). Un <strong>algoritmo de descubrimiento</strong> es una función
      que asigna a \(L\) un modelo \(M\) con lenguaje \(\mathcal{L}(M) \subseteq A^*\) (el conjunto de trazas completas que el modelo permite). Se distinguen tres
      tareas relacionadas:</p>
      <ul>
        <li><strong>Play-in</strong>: del comportamiento observado \(L\) al modelo \(M\) (este tema).</li>
        <li><strong>Play-out</strong>: del modelo al comportamiento; es la simulación, como en <code>P.simular</code>, que genera registros de ejemplo.</li>
        <li><strong>Replay</strong>: reproducir \(L\) sobre \(M\) para medir conformidad, véase <a href="tema.html?id=token-based-replay">reproducción de fichas</a>.</li>
      </ul>
      <h2>Qué se espera de un modelo descubierto</h2>
      <p>La entrada es solo el registro, que casi nunca es completo: contiene una muestra del comportamiento posible. Por eso el modelo debe
      reproducir lo visto, pero también admitir lo plausible que no aparece y rechazar lo imposible. Se evalúa con cuatro criterios que tiran en
      sentidos opuestos:</p>
      <table>
        <tr><th>Criterio</th><th>Pregunta</th><th>Definición usada aquí</th></tr>
        <tr><td>Fitness (ajuste)</td><td>¿el modelo reproduce el registro?</td><td>\( \dfrac{|\{\sigma \in L : \sigma \in \mathcal{L}(M)\}|}{|L|} \)</td></tr>
        <tr><td>Precisión</td><td>¿el modelo permite mucho más de lo visto?</td><td>\( 1 - \dfrac{\sum_s n_s\,|\text{esc}(s)|}{\sum_s n_s\,|\text{hab}(s)|} \)</td></tr>
        <tr><td>Generalización</td><td>¿aceptaría trazas nuevas del mismo proceso?</td><td>se estima con registros no usados para descubrir</td></tr>
        <tr><td>Simplicidad</td><td>¿es pequeño y legible?</td><td>nodos más arcos (mide tamaño, no legibilidad)</td></tr>
      </table>
      <p>En la precisión, \(s\) recorre los prefijos del registro, \(n_s\) cuántos casos pasan por ese prefijo, \(\text{hab}(s)\) las actividades que el modelo
      permite después de \(s\) y \(\text{esc}(s)\) las habilitadas que nunca ocurrieron tras \(s\) en el registro (versión simplificada de la precisión por
      <em>escape de aristas</em>).</p>
      <h2>Dos modelos extremos</h2>
      <p>El <strong>modelo flower</strong> tiene una sola plaza y una transición por actividad que la deja igual: \(\mathcal{L}(M) = A^*\). Su fitness es 1 y su
      simplicidad es máxima, pero su precisión es mínima porque cualquier orden es válido. Para \(|A| = k\) acepta \(\sum_{j=0}^{\ell} k^j\) trazas de hasta
      \(\ell\) eventos, un número que explota.</p>
      <p>El <strong>modelo de trazas</strong> enumera una ruta por variante, o su forma compacta, el árbol de prefijos: \(\mathcal{L}(M)\) es exactamente el conjunto de
      variantes. Tiene fitness 1 y precisión 1 pero no generaliza, es tan grande como el registro y no revela estructura (paralelismo, elecciones, ciclos). Un buen
      algoritmo de descubrimiento se ubica entre ambos.</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Con fitness y precisión altos, el modelo describe el registro; la generalización indica si describe el
      <em>proceso</em>. Un modelo que memoriza sobreajusta y uno que lo acepta todo subajusta.</p></div>
      <h2>Algoritmos que veremos</h2>
      <p>Los temas siguientes recorren la familia clásica: la <a href="tema.html?id=footprint-matrix">matriz de huellas</a> resume los órdenes observados; el
      <a href="tema.html?id=alpha-algorithm">algoritmo α</a> la convierte en una red; <a href="tema.html?id=noise-and-incompleteness">el ruido y la incompletitud</a> y
      <a href="tema.html?id=alpha-limitations">sus límites</a> motivan a mineros más robustos como el <a href="tema.html?id=heuristic-miner">heurístico</a> y el
      <a href="tema.html?id=inductive-miner">inductivo</a>, comparados en <a href="tema.html?id=discovery-comparison">una comparación</a>. Las medidas se
      profundizan en <a href="tema.html?id=fitness-precision">fitness y precisión</a>, y las trazas de entrada se estudian en
      <a href="tema.html?id=traces-and-variants">trazas y variantes</a>.</p>`,
  });
})();
