(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Redes de ejemplo ---------- */

  function red(nombre, plazas, trans, nota) {
    const ids = ['i', ...plazas, 'f'];
    const arcos = [];
    trans.forEach(([id, , e, s]) => { e.forEach((p) => arcos.push([p, id])); s.forEach((p) => arcos.push([id, p])); });
    return { nombre, nota, plazas: ids.map((id) => ({ id, nombre: id })), trans: trans.map(([id, n]) => ({ id, nombre: n })), arcos, ini: 'i', fin: 'f' };
  }
  const REDES = {
    and: red('Sana: AND-split y AND-join', ['p1', 'p2', 'p3', 'p4', 'p5'],
      [['ta', 'a', ['i'], ['p1']], ['ts', 's', ['p1'], ['p2', 'p3']], ['tb', 'b', ['p2'], ['p4']], ['tc', 'c', ['p3'], ['p5']], ['tj', 'j', ['p4', 'p5'], ['f']]],
      'Sana: las dos ramas se ejecutan en paralelo y la unión espera a ambas. Cada marcado puede seguir hasta [f].'),
    ciclo: red('Sana: elección y reintento', ['p1', 'p2'],
      [['ta', 'a', ['i'], ['p1']], ['tb', 'b', ['p1'], ['p2']], ['tc', 'c', ['p1'], ['p2']], ['td', 'd', ['p2'], ['f']], ['te', 'e', ['p2'], ['p1']]],
      'Sana: el ciclo p1 → p2 → p1 existe, pero en cualquier marcado todavía se puede elegir d y terminar.'),
    doble: red('Defectuosa: AND-split con XOR-join', ['p1', 'p2', 'p3', 'p4'],
      [['ta', 'a', ['i'], ['p1']], ['ts', 's', ['p1'], ['p2', 'p3']], ['tb', 'b', ['p2'], ['p4']], ['tc', 'c', ['p3'], ['p4']], ['td', 'd', ['p4'], ['f']]],
      'Defectuosa: las dos ramas paralelas confluyen en p4 como si fueran alternativas, y d se dispara dos veces.'),
    bloqueo: red('Defectuosa: XOR-split con AND-join', ['p1', 'p2', 'p3'],
      [['ta', 'a', ['i'], ['p1']], ['tb', 'b', ['p1'], ['p2']], ['tc', 'c', ['p1'], ['p3']], ['tj', 'j', ['p2', 'p3'], ['f']]],
      'Defectuosa: se elige b o c, pero j necesita ambas fichas; el caso queda atascado.'),
  };

  const clave = (m) => Object.keys(m).filter((p) => m[p] > 0).sort().map((p) => `${p}:${m[p]}`).join(',');
  const texto = (m) => {
    const t = Object.keys(m).filter((p) => m[p] > 0).sort().map((p) => (m[p] > 1 ? `${p}×${m[p]}` : p));
    return t.length ? t.join(' + ') : '∅';
  };
  const habilitadas = (r, m) => r.trans.filter((t) => P.habilitada(r, m, t.id));

  // Grafo de marcados completo en orden de descubrimiento (búsqueda en anchura).
  function explorar(r, tope = 30000, maxFichas = 6) {
    const ini = P.marcadoInicial(r);
    const estados = [{ m: ini, k: clave(ini), sal: [], nuevos: [] }];
    const indice = new Map([[estados[0].k, 0]]);
    const aristas = [];
    let truncado = false, noAcotada = false;
    for (let j = 0; j < estados.length; j++) {
      const e = estados[j];
      if (Object.values(e.m).some((v) => v > maxFichas)) { noAcotada = true; continue; }
      for (const t of habilitadas(r, e.m)) {
        const n = P.disparar(r, e.m, t.id), k = clave(n);
        let h = indice.get(k);
        if (h === undefined) {
          if (estados.length >= tope) { truncado = true; continue; }
          h = estados.length; indice.set(k, h); estados.push({ m: n, k, sal: [], nuevos: [] }); e.nuevos.push(h);
        }
        const ar = { de: j, a: h, t: t.nombre, tid: t.id };
        aristas.push(ar); e.sal.push(ar);
      }
    }
    // Estados desde los que se puede llegar al marcado final: búsqueda hacia atrás.
    const fin = indice.get(`${r.fin}:1`);
    const ent = estados.map(() => []);
    aristas.forEach((a) => ent[a.a].push(a.de));
    const llega = new Set();
    if (fin !== undefined) { const pila = [fin]; llega.add(fin); while (pila.length) { const u = pila.pop(); ent[u].forEach((v) => { if (!llega.has(v)) { llega.add(v); pila.push(v); } }); } }
    const bloqueos = estados.map((e, j) => j).filter((j) => !estados[j].sal.length && j !== fin && !((estados[j].m[r.fin] || 0) > 0));
    const sobrantes = estados.map((e, j) => j).filter((j) => (estados[j].m[r.fin] || 0) > 0 && j !== fin);
    const disparadas = new Set(aristas.map((a) => a.tid));
    const muertas = r.trans.filter((t) => !disparadas.has(t.id)).map((t) => t.nombre);
    const maxF = Math.max(1, ...estados.flatMap((e) => Object.values(e.m)));
    return { estados, aristas, fin, llega, bloqueos, sobrantes, muertas, maxF, truncado, noAcotada: noAcotada || truncado };
  }

  /* ---------- Dibujo ---------- */

  function orientar(pos, ancho, anchoCapa, altoCarril) {
    const g = new Map();
    for (const k in pos) { const c = pos[k].x.toFixed(4); g.set(c, (g.get(c) || 0) + 1); }
    const capas = g.size, carriles = Math.max(1, ...g.values());
    const vertical = capas * anchoCapa + 60 > ancho, r = {};
    for (const k in pos) r[k] = vertical ? { x: pos[k].y, y: pos[k].x } : pos[k];
    return { pos: r, alto: vertical ? capas * 54 + 50 : Math.max(210, carriles * altoCarril + 60) };
  }

  /* ---------- Fig. 1: grafo de alcanzabilidad ---------- */

  function montarAlcanzabilidad(cuerpo) {
    let clave0 = 'and', r = REDES[clave0], G = null, hecho = 0, sel = 0, resaltar = true, altoR = 220, altoG = 260, posR = null, posG = null, geoG = null, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Workflow net', opciones: Object.entries(REDES).map(([k, v]) => [k, v.nombre]), valor: clave0, alCambiar: (v) => { clave0 = v; r = REDES[v]; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Marcar estados que no pueden terminar', valor: resaltar, alCambiar: (v) => { resaltar = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    VIZ.subtitulo(cuerpo, 'La red, con el marcado elegido en el grafo de abajo');
    const lienzoR = VIZ.lienzo(cuerpo, { altoFn: () => altoR });
    VIZ.subtitulo(cuerpo, 'Grafo de alcanzabilidad: un nodo por marcado');
    const lienzoG = VIZ.lienzo(cuerpo, { altoFn: () => altoG });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'marcado inicial (borde) y final [f] (relleno)', forma: 'cuadro' },
      { color: C.s4, texto: 'descubierto, aún sin expandir', forma: 'cuadro' },
      { color: C.s8, texto: 'bloqueo, o estado que no puede terminar', forma: 'cuadro' },
      { color: C.s7, texto: 'ficha en f con fichas sobrantes', forma: 'cuadro' },
      { color: C.s1, texto: 'marcado elegido (se muestra en la red)', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca la búsqueda en anchura: cada paso expande un marcado y descubre sus sucesores. Haga clic en un marcado del grafo para verlo sobre la red. Compare las redes sanas con las defectuosas y fíjese en los nodos rojos y violetas.');

    function iniciar() {
      G = explorar(r);
      hecho = 0; sel = 0;
      posR = P.posDeRed(r);
      posG = P.disponer(G.estados.map((_, j) => String(j)), G.aristas.map((a) => [String(a.de), String(a.a)]));
      mensaje = `${r.nota} Marcado inicial: ${texto(G.estados[0].m)}.`;
      return (function* () {
        for (let j = 0; j < G.estados.length; j++) {
          const e = G.estados[j];
          hecho = j + 1; sel = j;
          const hab = e.sal.map((a) => a.t);
          mensaje = hab.length
            ? `Se expande [${texto(e.m)}]: habilita ${hab.join(', ')}` + (e.nuevos.length ? ` y descubre ${e.nuevos.length} marcado(s) nuevo(s).` : '; sus sucesores ya estaban en el grafo.')
            : `[${texto(e.m)}] no habilita nada: ${j === G.fin ? 'es el marcado final, terminación limpia.' : (e.m[r.fin] || 0) > 0 ? 'hay ficha en f pero con fichas sobrantes.' : 'es un bloqueo.'}`;
          yield;
        }
        mensaje = `Exploración completa: ${G.estados.length} marcados y ${G.aristas.length} arcos.`;
      })();
    }
    const descubiertos = () => {
      let d = 1;
      for (let j = 0; j < hecho; j++) d = Math.max(d, 1 + Math.max(j, ...G.estados[j].nuevos));
      return d;
    };

    function dibujar() {
      if (!G) return;
      const oR = orientar(posR, lienzoR.ancho, 64, 62);
      const oG = orientar(posG, lienzoG.ancho, 92, 54);
      if (oR.alto !== altoR || oG.alto !== altoG) { altoR = oR.alto; altoG = oG.alto; lienzoR.ajustar(true); lienzoG.ajustar(true); return; }
      const hab = new Set(habilitadas(r, G.estados[sel].m).map((t) => t.id));
      const rd = P.nodosDeRed(r, G.estados[sel].m, {
        plaza: (p) => ({ borde: p.id === r.ini ? C.s6 : C.tinta }),
        trans: (t) => ({ anillo: hab.has(t.id) ? C.s4 : null, relleno: hab.has(t.id) ? VIZ.alfa(C.s4, 0.18) : C.superficie }),
      });
      lienzoR.limpiar();
      P.dibujarGrafo(lienzoR, rd.nodos, rd.aristas, oR.pos, { etiquetasPlazas: true, fuente: 11, margenX: 40, margenY: 34 });

      const d = descubiertos();
      const terminado = hecho >= G.estados.length;
      const nodos = [], aristas = [];
      G.estados.forEach((e, j) => {
        if (j >= d) return;
        const expandido = j < hecho;
        const bloq = G.bloqueos.includes(j), sobra = G.sobrantes.includes(j);
        const sinSalida = resaltar && expandido && !G.llega.has(j) && !bloq && !sobra;
        let relleno = C.superficie, borde = C.tinta, colorTexto = C.tinta, anillo = null;
        if (j === 0) borde = C.s6;
        if (j === G.fin) { relleno = C.s6; borde = C.s6; colorTexto = C.sobre; }
        if (!expandido) anillo = C.s4;
        if (expandido && bloq) { borde = C.s8; relleno = VIZ.alfa(C.s8, 0.15); }
        if (expandido && sobra) { borde = C.s7; relleno = VIZ.alfa(C.s7, 0.15); }
        if (sinSalida) anillo = C.s8;
        if (j === sel) anillo = C.s1;
        nodos.push({ id: String(j), tipo: 'act', etiqueta: texto(e.m), relleno, borde, colorTexto, anillo });
      });
      G.aristas.forEach((a) => { if (a.de < hecho && a.a < d) aristas.push({ de: String(a.de), a: String(a.a), etiqueta: a.t, color: a.de === sel ? C.s2 : C.eje, ancho: a.de === sel ? 2.5 : 1.5, colorTexto: C.tinta, curva: posG[String(a.a)].x <= posG[String(a.de)].x && a.a !== a.de ? 34 : undefined }); });
      lienzoG.limpiar();
      geoG = P.dibujarGrafo(lienzoG, nodos, aristas, oG.pos, { fuente: 10, margenX: 44, margenY: 30 });

      registro.textContent = mensaje;
      const todos = G.estados.length;
      lectura.set([
        ['marcados descubiertos', terminado ? String(todos) : `${d} (de ${todos} en total)`],
        ['arcos', terminado ? String(G.aristas.length) : String(aristas.length)],
        ['acotada', terminado ? (G.noAcotada ? 'no' : `sí (máx. ${G.maxF} ficha${G.maxF > 1 ? 's' : ''} por plaza)`) : '—'],
        ['bloqueos', terminado ? String(G.bloqueos.length) : '—'],
        ['¿siempre puede terminar?', terminado ? (G.estados.every((_, j) => G.llega.has(j)) ? 'sí' : 'no: hay marcados desde los que [f] es inalcanzable') : '—'],
        ['terminación limpia', terminado ? (G.sobrantes.length ? 'no: ficha en f con fichas sobrantes' : 'sí') : '—'],
      ]);
    }
    lienzoR.alDibujar = dibujar; lienzoG.alDibujar = dibujar;
    lienzoG.canvas.style.cursor = 'pointer';
    lienzoG.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzoG.posicion(ev), g = geoG && P.nodoEn(geoG, x, y);
      if (!g) return;
      sel = +g.id;
      mensaje = `Marcado elegido: [${texto(G.estados[sel].m)}]; transiciones habilitadas: ${G.estados[sel].sal.map((a) => a.t).join(', ') || 'ninguna'}.`;
      dibujar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: tamaño del espacio de estados ---------- */

  // i → a → p1 → s → n ramas de k tareas en serie → j → f.
  function redParalela(n, k) {
    const plazas = ['p1'], trans = [['ta', 'a', ['i'], ['p1']]];
    const ini = [], fin = [];
    for (let j = 1; j <= n; j++) {
      for (let s = 0; s <= k; s++) plazas.push(`b${j}_${s}`);
      ini.push(`b${j}_0`); fin.push(`b${j}_${k}`);
      for (let s = 1; s <= k; s++) trans.push([`t${j}_${s}`, `t${j}_${s}`, [`b${j}_${s - 1}`], [`b${j}_${s}`]]);
    }
    trans.push(['ts', 's', ['p1'], ini], ['tj', 'j', fin, ['f']]);
    return red('', plazas, trans, '');
  }

  function montarEscala(cuerpo) {
    let n = 4, hover = -1, plano = null;
    const KS = [[1, C.s1], [2, C.s2], [3, C.s3]];
    const N = 6;
    const datos = KS.map(([k]) => Array.from({ length: N }, (_, i) => explorar(redParalela(i + 1, k), 50000).estados.length));
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ramas en paralelo (resaltadas)', min: 1, max: N, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, KS.map(([k, c]) => ({ color: c, texto: `${k} tarea${k > 1 ? 's' : ''} por rama`, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un número real de marcados, obtenido explorando por completo la red generada (a → AND-split → n ramas de k tareas → AND-join). El eje vertical es logarítmico: una recta es crecimiento exponencial.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...datos.flat()) * 1.6;
      plano = VIZ.plano(lienzo, { xmin: 0.7, xmax: N + 0.3, ymin: 1, ymax }, { logY: true, etiquetaX: 'ramas en paralelo n', etiquetaY: 'marcados alcanzables', ticksX: [1, 2, 3, 4, 5, 6], formatoX: (v) => String(v), formatoY: (v) => VIZ.entero(v) });
      plano.ejes();
      KS.forEach(([, c], s) => {
        VIZ.trazar(ctx, plano, datos[s].map((v, i) => [i + 1, v]), c, 2);
        datos[s].forEach((v, i) => VIZ.marcador(ctx, plano.sx(i + 1), plano.sy(v), c, i + 1 === n || i === hover ? 5.5 : 3.5));
      });
      ctx.save(); ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.sx(n), plano.y0); ctx.lineTo(plano.sx(n), plano.y1); ctx.stroke(); ctx.restore();
      const filas = KS.map(([k], s) => [`${k} tarea${k > 1 ? 's' : ''} por rama`, `${VIZ.entero(datos[s][n - 1])} marcados · ${2 + n * k} transiciones`]);
      lectura.set([...filas, ['fórmula (k + 1)ⁿ + 3', KS.map(([k]) => VIZ.entero((k + 1) ** n + 3)).join(' · ')]]);
      registro.textContent = `Con n = ${n} ramas, la red necesita pocas transiciones (${KS.map(([k]) => 2 + n * k).join(', ')}) pero su grafo de marcados tiene ${KS.map((_, s) => VIZ.entero(datos[s][n - 1])).join(', ')} estados: el paralelismo multiplica los estados.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(N - 1, Math.round(plano.ix(x)) - 1));
      if (i !== hover) { hover = i; dibujar(); }
      tip.mostrar(x, y, `<b>${i + 1}</b> rama${i ? 's' : ''} en paralelo` + KS.map(([k, c], s) => VIZ.filaTooltip(c, `${k} tarea${k > 1 ? 's' : ''} por rama`, VIZ.entero(datos[s][i]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('workflow-nets', {
    intro: String.raw`
      <p>Una <strong>workflow net</strong> es una red de Petri hecha para modelar casos que nacen y mueren: tiene una única plaza de inicio, una única plaza
      de fin, y todo nodo está en algún camino entre ambas. Un caso es una ficha que entra por el inicio; lo deseable es que siempre pueda llegar al fin y
      que, cuando llegue, no quede nada atrás.</p>
      <p>Para decidir si una red cumple eso se construye su <strong>grafo de alcanzabilidad</strong>: cada nodo es un marcado posible y cada arco, el disparo
      de una transición. Con él se detectan bloqueos, fichas sobrantes y marcados desde los que ya no se puede terminar.</p>`,
    visualizaciones: [
      {
        titulo: 'Grafo de alcanzabilidad paso a paso',
        descripcion: 'Expanda marcados uno a uno y haga clic en cualquiera para verlo sobre la red. Compare las redes sanas con las defectuosas: los nodos rojos y violetas delatan el problema.',
        montar: montarAlcanzabilidad,
      },
      {
        titulo: 'Cuántos marcados tiene un paralelismo',
        descripcion: 'Aumente las ramas en paralelo: la red crece linealmente y el grafo de marcados exponencialmente. Pase el cursor por los puntos para ver el conteo exacto.',
        montar: montarEscala,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una red de Petri \(N = (P, T, F)\) es una <em>workflow net</em> si:</p>
      <ol>
        <li>tiene una única plaza fuente \(i\) con \({}^{\bullet}i = \emptyset\) y una única plaza sumidero \(o\) con \(o^{\bullet} = \emptyset\);</li>
        <li>la red \(\bar N\), que se obtiene agregando una transición \(t^{*}\) de \(o\) a \(i\), es <em>fuertemente conexa</em> (todo nodo está en un camino de \(i\) a \(o\)).</li>
      </ol>
      <p>El marcado inicial es \([i]\) (una ficha en \(i\)) y el final deseado es \([o]\).</p>
      <h2>Grafo de alcanzabilidad</h2>
      <p>El conjunto \(R(N, M_0)\) de marcados alcanzables y los disparos entre ellos forman un sistema de transición, el grafo de alcanzabilidad (o de cobertura si la
      red no es acotada). Se calcula con una búsqueda en anchura:</p>
      <pre><code>R ← {M₀};  cola ← [M₀]
mientras cola no esté vacía:
    M ← sacar(cola)
    para cada t habilitada en M:
        M' ← disparar(t, M)
        agregar el arco M —t→ M'
        si M' ∉ R: R ← R ∪ {M'};  agregar M' a cola</code></pre>
      <h2>Propiedades que se leen en el grafo</h2>
      <ul>
        <li><strong>Acotamiento</strong>: si \(R\) es finito, la red es acotada; si una plaza puede crecer sin límite, hay infinitos marcados.</li>
        <li><strong>Bloqueo</strong>: un marcado sin arcos de salida distinto de \([o]\).</li>
        <li><strong>Opción de terminar</strong>: desde todo \(M \in R\) hay un camino a \([o]\), es decir, \([o]\) es alcanzable hacia atrás desde todos los nodos.</li>
        <li><strong>Terminación limpia</strong>: si \(M \ge [o]\) entonces \(M = [o]\) (no hay fichas sobrantes).</li>
        <li><strong>Vivacidad</strong>: toda transición aparece en algún arco del grafo (si no, es una transición muerta).</li>
      </ul>
      <div class="recuadro"><p><strong>Solidez.</strong> Una workflow net es <em>sound</em> si cumple la opción de terminar, la terminación limpia y no tiene
      transiciones muertas. Es la propiedad que se exige a un modelo de proceso; se estudia en <a href="tema.html?id=soundness">Soundness</a>.</p></div>
      <h2>Explosión de estados</h2>
      <p>Si el proceso tiene \(n\) ramas paralelas de \(k\) tareas en serie, el grafo de alcanzabilidad tiene \((k+1)^n + 3\) marcados mientras que la red
      tiene solo \(nk + 2\) transiciones. Por eso el análisis por alcanzabilidad es exacto pero caro, y en la práctica se usan reglas de reducción o
      técnicas estructurales para redes grandes.</p>
      <h2>Conexiones</h2>
      <p>Las redes de ejemplo vienen de la <a href="tema.html?id=petri-nets">teoría de redes de Petri</a>; el algoritmo
      <a href="tema.html?id=alpha-algorithm">Alfa</a> produce workflow nets pero no garantiza solidez (ver <a href="tema.html?id=alpha-limitations">sus límites</a>). Los
      <a href="tema.html?id=process-trees">árboles de procesos</a> son sound por construcción, y el <a href="tema.html?id=alignments">cálculo de alineamientos</a> recorre
      un producto de este grafo con la traza.</p>`,
  });
})();
