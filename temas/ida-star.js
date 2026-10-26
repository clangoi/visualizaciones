(function () {
  'use strict';
  const { color: C } = VIZ;
  const B = VIZ.busqueda, P = B.puzzle;
  const LETRAS = VIZ.grafo.LETRAS;

  /* ---------- Fig. 1: IDA* paso a paso sobre un árbol con costos ---------- */

  // Árbol al azar de profundidad 4 con costos en las aristas, dos hojas meta y una heurística admisible.
  function arbolAzar(semilla) {
    const rnd = VIZ.semilla(semilla);
    const raiz = { d: 0, hijos: [], costo: 0 };
    const todos = [raiz];
    let nivel = [raiz];
    for (let d = 1; d <= 4; d++) {
      const sig = [];
      for (const p of nivel) {
        const k = d === 1 ? 3 : d === 4 ? (rnd() < 0.5 ? 1 : 2) : 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < k && todos.length < 26; i++) {
          const h = { d, hijos: [], costo: 1 + Math.floor(rnd() * 4) };
          p.hijos.push(h); sig.push(h); todos.push(h);
        }
      }
      nivel = sig;
    }
    todos.forEach((n, i) => { n.etiqueta = LETRAS[i]; });
    const hojas = todos.filter((n) => !n.hijos.length && n.d >= 3);
    for (let i = 0; i < 2 && hojas.length; i++) hojas.splice(Math.floor(rnd() * hojas.length), 1)[0].meta = true;
    // h* por subárbol y h = fracción al azar de h* (admisible).
    (function hEst(n) {
      n.hs = n.meta ? 0 : Math.min(Infinity, ...n.hijos.map((c) => c.costo + hEst(c)));
      return n.hs;
    })(raiz);
    for (const n of todos) n.h = n.meta ? 0 : Number.isFinite(n.hs) ? Math.floor(n.hs * (0.35 + 0.65 * rnd())) : 1 + Math.floor(rnd() * 5);
    return { raiz, todos };
  }

  function montarPasoAPaso(cuerpo) {
    let semilla = 2, arbol = null;
    let umbral = 0, siguiente = Infinity, iter = 0, genIter = 0, genTotal = 0, hallado = null, actual = null, mensaje = '';
    let est = new Map(), fv = new Map(), historia = [];

    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevo árbol', () => { semilla++; arbol = arbolAzar(semilla); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'en la pila (camino actual)' },
      { color: C.s1, texto: 'expandido en esta iteración' },
      { color: C.superficie, borde: C.s8, texto: 'podado: f > umbral' },
      { color: C.superficie, borde: C.s2, texto: 'nodo actual', forma: 'punto' },
      { color: C.superficie, borde: C.tinta, texto: 'meta (cuadrado)' },
      { color: C.s6, texto: 'meta encontrada' },
    ]);
    const umbrales = VIZ.grafo.estructura(cuerpo, 'Iteraciones:');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los números en las aristas son costos. Bajo cada nodo aparece su heurística h o, si se visitó en esta iteración, f = g + h. Pase el cursor sobre un nodo para ver g, h y h*.');

    const g = new Map();
    function iniciar() {
      est = new Map(); fv = new Map(); g.clear(); historia = [];
      iter = 0; genIter = 0; genTotal = 0; hallado = null; actual = null;
      umbral = arbol.raiz.h; siguiente = Infinity;
      mensaje = `El primer umbral es h(${arbol.raiz.etiqueta}) = ${umbral}.`;
      function* dfs(n, gn) {
        const f = gn + n.h;
        g.set(n, gn); fv.set(n, f);
        genIter++; genTotal++;
        actual = n;
        if (f > umbral) {
          est.set(n, 'poda');
          siguiente = Math.min(siguiente, f);
          mensaje = `f(${n.etiqueta}) = ${gn} + ${n.h} = ${f} > ${umbral}: se poda. El menor f podado hasta ahora es ${siguiente}.`;
          yield;
          return false;
        }
        est.set(n, 'pila');
        if (n.meta) {
          hallado = n;
          mensaje = `${n.etiqueta} es meta con costo ${gn}. Como f nunca superó el umbral ${umbral} y h es admisible, la solución es óptima.`;
          yield;
          return true;
        }
        mensaje = `f(${n.etiqueta}) = ${gn} + ${n.h} = ${f} ≤ ${umbral}: se expande.`;
        yield;
        for (const h of n.hijos) if (yield* dfs(h, gn + h.costo)) return true;
        est.set(n, 'hecho');
        return false;
      }
      return (function* () {
        yield;
        for (;;) {
          iter++; est = new Map(); fv = new Map(); genIter = 0; siguiente = Infinity; actual = null;
          mensaje = `Iteración ${iter}: búsqueda en profundidad que poda todo nodo con f > ${umbral}.`;
          yield;
          const ok = yield* dfs(arbol.raiz, 0);
          historia.push({ umbral, gen: genIter, ok });
          if (ok) return;
          if (siguiente === Infinity) { mensaje = 'No se podó nada y no hay meta: no existe solución.'; return; }
          mensaje = `Fin de la iteración ${iter}: no hay meta con f ≤ ${umbral}. El nuevo umbral es el menor f podado: ${siguiente}.`;
          umbral = siguiente;
          actual = null;
          yield;
        }
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      geo = B.dibujarArbol(ctx, arbol.raiz, {
        x0: 8, y0: 26, ancho: W - 16, dy: 74,
        forma: (n) => (n.meta ? 'cuadro' : 'circulo'),
        estilo: (n) => {
          const e = est.get(n);
          const r = e ? {} : { borde: C.eje, texto: C.tinta2 };
          if (n === hallado) Object.assign(r, { relleno: C.s6, borde: C.s6, texto: C.sobre });
          else if (e === 'pila') r.relleno = C.s4;
          else if (e === 'hecho') Object.assign(r, { relleno: C.s1, borde: C.s1, texto: C.sobre });
          else if (e === 'poda') Object.assign(r, { borde: C.s8, guiones: [3, 2], texto: C.s8 });
          if (n === actual && !hallado) r.anillo = C.s2;
          return r;
        },
        arista: (p, h) => {
          const e = est.get(h);
          const base = { texto: String(h.costo) };
          if (e === 'poda') return { ...base, color: C.s8, guiones: [4, 3], colorTexto: C.s8 };
          if (e === 'pila' || (h === hallado)) return { ...base, color: h === hallado ? C.s6 : C.s4, ancho: 3 };
          if (e === 'hecho') return { ...base, color: C.s1, ancho: 2 };
          return base;
        },
        etiqueta: (n) => n.etiqueta,
        debajo: (n) => (fv.has(n) ? `f ${fv.get(n)}` : `h ${n.h}`),
        colorDebajo: (n) => (est.get(n) === 'poda' ? C.s8 : fv.has(n) ? C.tinta : C.apagado),
      });
      umbrales.set(historia.map((it, i) => ({ texto: `${i + 1}: ≤ ${it.umbral} (${it.gen} nodos)`, color: it.ok ? C.s6 : C.tinta })), 'ninguna terminada');
      registro.textContent = mensaje;
      lectura.set([
        ['iteración', String(iter)],
        ['umbral', String(umbral)],
        ['menor f podado', siguiente === Infinity ? '—' : String(siguiente)],
        ['generados en la iteración', String(genIter)],
        ['generados en total', String(genTotal)],
      ]);
    }
    lienzo.alDibujar = () => arbol && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const n = B.nodoArbolEn(geo, x, y);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `nodo <b>${n.etiqueta}</b>${n.meta ? ' (meta)' : ''}<br>h = <b>${n.h}</b> · h* = <b>${Number.isFinite(n.hs) ? n.hs : '∞'}</b>` +
        (fv.has(n) ? `<br>g = <b>${g.get(n)}</b> · f = <b>${fv.get(n)}</b>` : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    arbol = arbolAzar(semilla);
    rep.reiniciar();
  }

  /* ---------- Fig. 2: iteraciones de IDA* en el 8-puzzle ---------- */

  function montarPuzzle(cuerpo) {
    let semilla = 1, prof = 20, heur = 'manhattan', ida = null, astar = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Longitud óptima de la instancia', min: 8, max: 26, valor: prof, alSoltar: (v) => { prof = v; calcular(); } });
    ctl.selector({ etiqueta: 'Heurística', opciones: [['fuera', 'Fichas fuera de lugar'], ['manhattan', 'Manhattan'], ['conflicto', 'Manhattan + conflictos lineales']], valor: heur,
      alCambiar: (v) => { heur = v; calcular(); } });
    ctl.boton('Nueva instancia', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nodos generados en cada iteración de IDA*' },
      { color: C.s6, texto: 'iteración que encuentra la meta' },
      { color: C.apagado, texto: 'nodos generados por A*', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico; bajo cada barra, el umbral de f de esa iteración. Pase el cursor sobre una barra para ver sus valores.');

    function calcular() {
      const s = P.aDistancia(VIZ.semilla(semilla * 29 + prof), prof);
      const h = P.HEURISTICAS[heur].f;
      ida = P.idaEstrella(s, h, { limite: 2e6 });
      astar = P.aEstrella(s, h, { limite: 2e5 });
      dibujar();
    }

    let geo = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const its = ida.iteraciones, n = its.length;
      const ymax = Math.max(10, astar.generados, ...its.map((i) => i.generados)) * 3;
      const plano = VIZ.plano(lienzo, { xmin: -0.5, xmax: n - 0.5, ymin: 1, ymax }, {
        logY: true, etiquetaX: 'umbral de f', etiquetaY: 'nodos generados',
        formatoY: (v) => (v >= 1e4 ? `10^${Math.round(Math.log10(v))}` : VIZ.entero(v)),
        ticksX: its.map((_, i) => i), formatoX: (i) => String(its[i] ? its[i].umbral : ''),
      });
      plano.ejes();
      const w = Math.min(60, plano.sx(1) - plano.sx(0));
      its.forEach((it, i) => {
        const x = plano.sx(i) - w / 2 + 1, y = plano.sy(Math.max(1, it.generados));
        ctx.fillStyle = i === hover ? C.s2 : it.encontrado ? C.s6 : C.s1;
        ctx.beginPath();
        ctx.roundRect(x, y, w - 2, plano.y0 - y, [4, 4, 0, 0]);
        ctx.fill();
      });
      const ya = plano.sy(astar.generados);
      ctx.save();
      ctx.strokeStyle = C.apagado;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(plano.x0, ya); ctx.lineTo(plano.x1, ya); ctx.stroke();
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11);
      ctx.textAlign = 'left';
      ctx.fillText(`A*: ${VIZ.entero(astar.generados)}`, plano.x0 + 4, ya - 5);
      ctx.restore();
      geo = { plano, n };
      registro.textContent = ida.detenido
        ? `IDA* se detuvo tras ${VIZ.entero(ida.total)} nodos generados sin terminar: pruebe una heurística mejor o una instancia más corta.`
        : `IDA* encontró una solución de ${ida.costo} movimientos en ${n} iteraciones; la última genera ${VIZ.fmt((100 * its[n - 1].generados) / ida.total, 3)} % del total.`;
      lectura.set([
        ['iteraciones', String(n)],
        ['IDA*: generados', VIZ.entero(ida.total)],
        ['A*: generados', VIZ.entero(astar.generados)],
        ['IDA*: memoria', `${prof + 1} estados (la pila)`],
        ['A*: memoria', `${VIZ.entero(astar.memoria)} estados`],
      ]);
    }
    lienzo.alDibujar = () => ida && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = geo.plano.dentro(x, y) ? Math.round(geo.plano.ix(x)) : -1;
      if (i < 0 || i >= geo.n) { if (hover !== -1) { hover = -1; dibujar(); } return tip.ocultar(); }
      if (hover !== i) { hover = i; dibujar(); }
      const it = ida.iteraciones[i];
      tip.mostrar(x, y, `iteración <b>${i + 1}</b> · umbral <b>${it.umbral}</b><br><b>${VIZ.entero(it.generados)}</b> nodos generados` +
        (i ? `<br>×${VIZ.fmt(it.generados / Math.max(1, ida.iteraciones[i - 1].generados), 3)} respecto de la anterior` : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (ida) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('ida-star', {
    intro: String.raw`
      <p><a href="tema.html?id=a-star">A*</a> es óptimo, pero guarda todo lo que genera y se queda sin memoria en problemas como
      el 15-puzzle. <strong>IDA*</strong> (Korf, 1985) aplica la idea de la <a href="tema.html?id=iddfs">profundización
      iterativa</a> a A*: hace búsquedas en profundidad que podan todo nodo con \(f = g + h\) mayor que un umbral, y si no encuentra
      la meta, sube el umbral al menor \(f\) que lo superó.</p>
      <p>Solo guarda el camino actual, así que su memoria es lineal en la profundidad de la solución. A cambio, repite trabajo
      entre iteraciones y, al no recordar estados, puede revisitar el mismo estado por caminos distintos.</p>`,
    visualizaciones: [
      {
        titulo: 'IDA* paso a paso',
        descripcion: 'Cada iteración es una DFS limitada por f. Observe cómo el umbral sube exactamente al menor f podado y cómo los nodos de arriba se vuelven a generar en cada iteración.',
        montar: montarPasoAPaso,
      },
      {
        titulo: 'Iteraciones en el 8-puzzle',
        descripcion: 'Con una buena heurística cada iteración genera varias veces más nodos que la anterior, de modo que la última domina el total. Compare con A*: IDA* genera algo más, pero con memoria mínima.',
        montar: montarPuzzle,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>IDA*(s₀):
    umbral ← h(s₀)
    repetir:
        siguiente ← ∞
        si DFS(s₀, 0, umbral) encontró la meta: devolver la solución
        si siguiente = ∞: devolver «sin solución»
        umbral ← siguiente

DFS(u, g, umbral):
    f ← g + h(u)
    si f &gt; umbral:  siguiente ← min(siguiente, f);  devolver falso
    si u es meta: devolver verdadero
    para cada sucesor v de u (salvo el padre de u):
        si DFS(v, g + w(u, v), umbral): devolver verdadero
    devolver falso</code></pre>

      <h2>Corrección</h2>
      <p>Si \(h\) es admisible, IDA* devuelve una solución óptima. En la iteración con umbral \(\theta\), la DFS visita todo nodo
      alcanzable por un camino en que \(f \le \theta\). Sea \(C^*\) el costo óptimo: todo nodo de un camino óptimo tiene
      \(f \le C^*\). El umbral empieza en \(h(s_0) \le C^*\) y cada nuevo umbral es el menor \(f\) que se podó, así que nunca salta
      por encima de \(C^*\) sin pasar por él. En la primera iteración con \(\theta \ge C^*\) —que tiene \(\theta = C^*\)— el camino
      óptimo completo está dentro del umbral y se encuentra; ninguna meta más cara tiene \(f \le \theta\).</p>

      <h2>Costo</h2>
      <p><strong>Memoria:</strong> \(O(d)\), solo la pila del camino actual (o \(O(b\,d)\) si se guardan los hermanos pendientes).</p>
      <p><strong>Tiempo:</strong> si el número de nodos con \(f \le \theta\) crece en un factor \(\ge b' &gt; 1\) de una iteración a
      la siguiente, como en los rompecabezas, la última iteración domina y el total es \(O\big(\tfrac{b'}{b'-1}\big)\) veces el de
      ella, igual que en IDDFS. El caso malo es cuando casi todos los nodos tienen valores de \(f\) distintos (costos reales
      variados): cada iteración agrega pocos nodos y, si A* expande \(N\) nodos, IDA* puede generar \(\Theta(N^2)\).</p>
      <p>Korf, Reid y <strong>Edelkamp</strong> (2001) mostraron cómo predecir el número de nodos que genera IDA* en la iteración
      con umbral \(\theta\) sin ejecutarlo:</p>
      \[ E(\theta) = \sum_{i=0}^{\theta} N_i \, P(\theta - i), \]
      <p>donde \(N_i\) es el número de nodos a profundidad \(i\) del árbol de fuerza bruta y \(P(x)\) es la fracción de estados con
      \(h \le x\) (según la distribución de equilibrio de la heurística). La fórmula muestra que lo que importa no es el valor medio
      de \(h\) sino su distribución: cuántos estados tienen \(h\) bajo.</p>

      <h2>Duplicados y mejoras</h2>
      <p>IDA* explora un <em>árbol</em>: el mismo estado alcanzado por dos caminos (una <em>transposición</em>) se explora dos
      veces. Evitar deshacer el último movimiento elimina los ciclos de largo 2; tablas de transposición, poda de secuencias de
      movimientos equivalentes y el orden de los sucesores reducen el resto. Con buenas heurísticas
      (<a href="tema.html?id=pattern-databases">bases de datos de patrones</a>), IDA* resuelve óptimamente el 15-puzzle en
      milisegundos y el 24-puzzle en horas.</p>
      <p>La presentación sigue a Edelkamp y Schrödl, <em>Heuristic Search: Theory and Applications</em> (2012), capítulo de búsqueda
      con memoria lineal, donde también se estudian RBFS y A* con memoria limitada.</p>`,
  });
})();
