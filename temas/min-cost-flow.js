(function () {
  'use strict';
  const { color: C } = VIZ;
  const num = (v) => VIZ.fmt(v);
  const EPS = 1e-9;
  const uds = (n) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;

  /* ---------- Red (S, A, B, C, D, T) ---------- */

  const NOD = [['S', 0.05, 0.5], ['A', 0.3, 0.12], ['B', 0.3, 0.88], ['C', 0.7, 0.12], ['D', 0.7, 0.88], ['T', 0.95, 0.5]];
  const PAR = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5], [1, 4]];
  // [capacidad, costo] de la red de ejemplo (la ruta más barata solo admite 1 unidad y el último camino necesita un retroceso).
  const EJEMPLO = [[1, 4], [3, 7], [2, 2], [2, 6], [3, 1], [2, 7], [2, 0], [2, 1], [3, 2]];
  function crearRed(semilla) {
    if (semilla === 0) return PAR.map(([de, a], i) => ({ de, a, cap: EJEMPLO[i][0], costo: EJEMPLO[i][1] }));
    for (let s = semilla; ; s++) {
      const rnd = VIZ.semilla(s * 104729 + 3);
      const red = PAR.map(([de, a]) => ({ de, a, cap: 1 + Math.floor(rnd() * 3), costo: Math.floor(rnd() * 9) }));
      if (VIZ.opt.flujoMaximo(6, red, 0, 5).valor >= 3) return red;
    }
  }
  // Arcos de la red residual: adelante (capacidad − flujo, costo c) y retroceso (flujo, costo −c).
  function residual(red, flujo) {
    const R = [];
    red.forEach((a, e) => {
      if (a.cap - flujo[e] > EPS) R.push({ u: a.de, v: a.a, e, dir: 1, c: a.costo, r: a.cap - flujo[e] });
      if (flujo[e] > EPS) R.push({ u: a.a, v: a.de, e, dir: -1, c: -a.costo, r: flujo[e] });
    });
    return R;
  }
  // Camino de costo mínimo de s a t en la residual (Bellman–Ford); null si no hay.
  function caminoMinimo(red, flujo, s, t) {
    const R = residual(red, flujo), d = Array(NOD.length).fill(Infinity), pr = Array(NOD.length).fill(-1);
    d[s] = 0;
    for (let k = 0; k < NOD.length; k++) {
      let cambio = false;
      R.forEach((q, i) => { if (d[q.u] + q.c < d[q.v] - EPS) { d[q.v] = d[q.u] + q.c; pr[q.v] = i; cambio = true; } });
      if (!cambio) break;
    }
    if (d[t] === Infinity) return null;
    const ruta = [];
    for (let v = t; v !== s; v = R[pr[v]].u) ruta.unshift(R[pr[v]]);
    return { ruta, costo: d[t], delta: Math.min(...ruta.map((q) => q.r)) };
  }
  // Ciclo de costo negativo en la residual (Bellman–Ford desde todos los nodos); null si no hay.
  function cicloNegativo(red, flujo) {
    const R = residual(red, flujo), n = NOD.length, d = Array(n).fill(0), pr = Array(n).fill(-1);
    let x = -1;
    for (let k = 0; k < n; k++) {
      x = -1;
      R.forEach((q, i) => { if (d[q.u] + q.c < d[q.v] - EPS) { d[q.v] = d[q.u] + q.c; pr[q.v] = i; x = q.v; } });
      if (x < 0) return null;
    }
    for (let k = 0; k < n; k++) x = R[pr[x]].u;
    const ciclo = [];
    let v = x;
    do { const q = R[pr[v]]; ciclo.unshift(q); v = q.u; } while (v !== x);
    return { ciclo, costo: ciclo.reduce((s, q) => s + q.c, 0), delta: Math.min(...ciclo.map((q) => q.r)) };
  }
  const costoDe = (red, flujo) => red.reduce((s, a, e) => s + a.costo * flujo[e], 0);
  const textoRuta = (ruta) => [NOD[ruta[0].u][0], ...ruta.map((q) => NOD[q.v][0])].join(' → ');
  const grafoDe = (red, flujo) => ({ dirigido: true, nodos: NOD.map(([l, x, y]) => ({ x, y, etiqueta: l })), aristas: red.map((a, e) => ({ u: a.de, v: a.a, w: `${Math.round(flujo[e])}/${a.cap} (${a.costo})` })) });

  /* ---------- Fig. 1: caminos mínimos sucesivos ---------- */

  function montarSucesivos(cuerpo) {
    let semilla = 0, D = 3, red = crearRed(semilla), est = null, curva = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Unidades a enviar', min: 1, max: 6, valor: D, alCambiar: (v) => { D = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Red aleatoria', () => { semilla++; red = crearRed(semilla); rep.reiniciar(); });
    ctl.boton('Red de ejemplo', () => { semilla = 0; red = crearRed(0); rep.reiniciar(); });
    VIZ.subtitulo(cuerpo, 'Red: flujo/capacidad (costo unitario)');
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 350 });
    VIZ.subtitulo(cuerpo, 'Costo total según las unidades enviadas');
    const graf = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 190, altoMax: 270 });
    const tip = VIZ.tooltip(graf);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'camino mínimo del paso', forma: 'linea' }, { color: C.s2, texto: 'retroceso (discontinuo): cancela flujo', forma: 'linea' },
      { color: C.s1, texto: 'arco con flujo', forma: 'linea' }, { color: C.s1, texto: 'costo del plan óptimo (curva)' },
      { color: C.apagado, texto: 'todo por el camino más barato (cota)', forma: 'linea' }, { color: C.s2, texto: 'estado actual', forma: 'punto' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso busca el camino más barato en la red residual, donde un arco con flujo vuelve como retroceso con costo negativo. Compare la curva: su pendiente (el costo unitario de cada camino) solo puede crecer. Pase el cursor por la curva para ver el costo para cada cantidad.');

    function iniciar() {
      // Curva completa con todo el flujo posible (para la gráfica) y plan de referencia.
      const completo = VIZ.opt.flujoCostoMinimo(6, red, 0, 5, 1000);
      let acum = 0, c = 0;
      const pts = [[0, 0]];
      completo.pasos.forEach((p) => { acum += p.f; c += p.f * p.costoUnitario; pts.push([acum, c]); });
      curva = { pts, max: acum, base: completo.pasos.length ? completo.pasos[0].costoUnitario : 0, pasos: completo.pasos };
      est = { flujo: red.map(() => 0), enviado: 0, costo: 0, ruta: null, hist: [], fase: 'inicio', msg: `Meta: enviar ${uds(D)} de S a T al menor costo.`, fin: false };
      return (function* () {
        while (est.enviado < D) {
          const cm = caminoMinimo(red, est.flujo, 0, 5);
          if (!cm) { est.fin = true; est.ruta = null; est.msg = `No hay más caminos: la red solo admite ${uds(est.enviado)}.`; yield; return; }
          const f = Math.min(cm.delta, D - est.enviado);
          est.ruta = cm.ruta; est.msg = `Camino mínimo ${textoRuta(cm.ruta)} con costo unitario ${num(cm.costo)}${cm.ruta.some((q) => q.dir < 0) ? ' (usa un retroceso con costo negativo)' : ''}; cabe${f === 1 ? '' : 'n'} ${uds(f)}.`;
          yield;
          cm.ruta.forEach((q) => { est.flujo[q.e] += q.dir * f; });
          est.enviado += f; est.costo += f * cm.costo; est.hist.push({ texto: textoRuta(cm.ruta), f, c: cm.costo, atras: cm.ruta.some((q) => q.dir < 0) });
          est.msg = `Se ${f === 1 ? 'envió' : 'enviaron'} ${uds(f)} a ${num(cm.costo)} cada una: total ${est.enviado}, costo ${num(est.costo)}.`;
          yield;
        }
        est.fin = true; est.ruta = null;
        est.msg = `Listo: ${uds(D)} enviadas con costo mínimo ${num(est.costo)}.`;
        yield;
      })();
    }
    const costoCurva = (u) => {
      const p = curva.pts;
      for (let i = 1; i < p.length; i++) if (u <= p[i][0] + EPS) return p[i - 1][1] + ((u - p[i - 1][0]) / (p[i][0] - p[i - 1][0])) * (p[i][1] - p[i - 1][1]);
      return NaN;
    };
    function dibujar() {
      if (!est) return;
      lienzo.limpiar();
      const enRuta = new Map();
      (est.ruta || []).forEach((q) => enRuta.set(q.e, q.dir));
      VIZ.grafo.dibujar(lienzo, grafoDe(red, est.flujo), {
        pesos: true,
        nodo: (i) => (i === 0 ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : i === 5 ? { relleno: C.s7, borde: C.s7, texto: C.sobre } : {}),
        arista: (a, e) => (enRuta.has(e) ? { color: C.s2, ancho: 4.5, guiones: enRuta.get(e) < 0 ? [6, 4] : null } : est.flujo[e] > 0 ? { color: C.s1, ancho: 1.5 + (3 * est.flujo[e]) / red[e].cap } : { color: C.eje, ancho: 1.5 }),
        colorPeso: (a, e) => (enRuta.has(e) ? C.s2 : est.flujo[e] > 0 ? C.s1 : C.tinta2),
      });
      graf.limpiar();
      const ymax = Math.max(1, curva.pts[curva.pts.length - 1][1], curva.base * curva.max) * 1.08;
      plano = VIZ.plano(graf, { xmin: 0, xmax: Math.max(1, curva.max), ymin: 0, ymax }, { etiquetaX: 'unidades enviadas', etiquetaY: 'costo total', formatoX: (v) => String(Math.round(v)), ticksX: Array.from({ length: curva.max + 1 }, (_, i) => i) });
      plano.ejes();
      VIZ.trazar(graf.ctx, plano, [[0, 0], [curva.max, curva.base * curva.max]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(graf.ctx, plano, curva.pts, C.s1, 2);
      curva.pts.forEach(([u, c]) => VIZ.marcador(graf.ctx, plano.sx(u), plano.sy(c), C.s1, 3.5));
      VIZ.marcador(graf.ctx, plano.sx(est.enviado), plano.sy(est.costo), C.s2, 5.5);
      lista.replaceChildren(...(est.hist.length ? est.hist.map((h, i) => VIZ.el('div', null, `${i + 1}. ${h.texto}  ×${h.f}  a ${num(h.c)}${h.atras ? '  (con retroceso)' : ''}`)) : [VIZ.el('div', null, 'Aún no se ha enviado nada.')]));
      registro.textContent = est.msg;
      const lib = VIZ.opt.flujoCostoMinimo(6, red, 0, 5, D);
      const neg = cicloNegativo(red, est.flujo);
      lectura.set([
        ['enviado', `${est.enviado} de ${D}`], ['costo actual', num(est.costo)],
        ['costo mínimo (VIZ.opt)', num(lib.costo)],
        ['ciclo negativo en la residual', neg ? `sí (${num(neg.costo)})` : 'no'],
        ['cota: todo por el camino barato', num(curva.base * D)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    graf.alDibujar = dibujar;
    graf.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = graf.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = Math.min(curva.max, Math.max(0, plano.ix(x)));
      let k = 0;
      while (k < curva.pasos.length - 1 && u > curva.pts[k + 1][0] + EPS) k++;
      const paso = curva.pasos[k];
      tip.mostrar(x, y, `<b>${num(u)}</b> unidades<br>costo óptimo <b>${num(costoCurva(u))}</b>` + (paso ? `<br>pendiente <b>${num(paso.costoUnitario)}</b> por unidad` : ''));
    });
    graf.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: optimalidad sin ciclos negativos ---------- */

  function montarCiclos(cuerpo) {
    let semilla = 0, D = 2, red = crearRed(semilla), est = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Unidades a enviar', min: 1, max: 4, valor: D, alCambiar: (v) => { D = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Red aleatoria', () => { semilla++; red = crearRed(semilla); rep.reiniciar(); });
    ctl.boton('Red de ejemplo', () => { semilla = 0; red = crearRed(0); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'ciclo de costo negativo en la residual (discontinuo: cancela flujo)', forma: 'linea' },
      { color: C.s1, texto: 'arco con flujo', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se parte de un flujo factible hallado sin mirar los costos (búsqueda en anchura). Cada paso encuentra un ciclo de costo negativo en la red residual y envía flujo por él: el costo baja y las unidades enviadas no cambian. Cuando no quedan ciclos negativos, el flujo es óptimo.');

    function inicial() {
      const f = red.map(() => 0);
      let env = 0;
      while (env < D) {
        const prev = new Map([[0, null]]), cola = [0];
        const R = residual(red, f);
        while (cola.length && !prev.has(5)) { const u = cola.shift(); for (const q of R) if (q.u === u && !prev.has(q.v)) { prev.set(q.v, q); cola.push(q.v); } }
        if (!prev.has(5)) break;
        const ruta = [];
        for (let v = 5; v !== 0; v = prev.get(v).u) ruta.unshift(prev.get(v));
        const d = Math.min(D - env, ...ruta.map((q) => q.r));
        ruta.forEach((q) => { f[q.e] += q.dir * d; });
        env += d;
      }
      return { f, env };
    }
    function iniciar() {
      const { f, env } = inicial();
      est = { flujo: f, enviado: env, ciclo: null, cancelados: 0, costo0: costoDe(red, f), fase: 'inicio', msg: '', hist: [] };
      est.msg = env < D ? `La red solo admite ${uds(env)}; se parte de un flujo de ${uds(env)} con costo ${num(est.costo0)}.` : `Flujo inicial de ${uds(D)} hallado sin considerar los costos: cuesta ${num(est.costo0)}.`;
      return (function* () {
        for (;;) {
          const cn = cicloNegativo(red, est.flujo);
          if (!cn) { est.ciclo = null; est.msg = `No quedan ciclos negativos en la red residual: el flujo es óptimo, con costo ${num(costoDe(red, est.flujo))}.`; yield; return; }
          est.ciclo = cn;
          est.msg = `Ciclo negativo ${textoRuta(cn.ciclo)} → ${NOD[cn.ciclo[0].u][0]}: costo ${num(cn.costo)} por unidad, caben ${uds(cn.delta)}.`;
          yield;
          cn.ciclo.forEach((q) => { est.flujo[q.e] += q.dir * cn.delta; });
          est.cancelados++; est.hist.push(`${textoRuta(cn.ciclo)} → ${NOD[cn.ciclo[0].u][0]}: ${uds(cn.delta)}, ahorro ${num(-cn.costo * cn.delta)}`);
          est.msg = `Se envían ${uds(cn.delta)} por el ciclo: el costo baja ${num(-cn.costo * cn.delta)} y ahora es ${num(costoDe(red, est.flujo))}.`;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!est) return;
      lienzo.limpiar();
      const enCiclo = new Map();
      (est.ciclo ? est.ciclo.ciclo : []).forEach((q) => enCiclo.set(q.e, q.dir));
      VIZ.grafo.dibujar(lienzo, grafoDe(red, est.flujo), {
        pesos: true,
        nodo: (i) => (i === 0 ? { relleno: C.s6, borde: C.s6, texto: C.sobre } : i === 5 ? { relleno: C.s7, borde: C.s7, texto: C.sobre } : {}),
        arista: (a, e) => (enCiclo.has(e) ? { color: C.s8, ancho: 4.5, guiones: enCiclo.get(e) < 0 ? [6, 4] : null } : est.flujo[e] > 0 ? { color: C.s1, ancho: 1.5 + (3 * est.flujo[e]) / red[e].cap } : { color: C.eje, ancho: 1.5 }),
        colorPeso: (a, e) => (enCiclo.has(e) ? C.s8 : est.flujo[e] > 0 ? C.s1 : C.tinta2),
      });
      lista.replaceChildren(...(est.hist.length ? est.hist.map((h, i) => VIZ.el('div', null, `${i + 1}. ${h}`)) : [VIZ.el('div', null, 'Ningún ciclo cancelado todavía.')]));
      registro.textContent = est.msg;
      const lib = VIZ.opt.flujoCostoMinimo(6, red, 0, 5, est.enviado);
      const costo = costoDe(red, est.flujo), neg = cicloNegativo(red, est.flujo);
      lectura.set([
        ['unidades enviadas', String(est.enviado)], ['costo inicial', num(est.costo0)], ['costo actual', num(costo)],
        ['costo mínimo (caminos sucesivos)', num(lib.costo)], ['ciclos cancelados', String(est.cancelados)],
        ['¿hay ciclo negativo?', neg ? 'sí' : 'no (óptimo ✓)'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('min-cost-flow', {
    intro: String.raw`
      <p>El problema de <strong>flujo de costo mínimo</strong> pide enviar una cantidad dada de flujo de un origen a un destino por una red con capacidades, pagando un costo por unidad en cada arco, de modo que el costo total sea el menor posible.
      Si no hubiera capacidades bastaría el camino más barato; con ellas, cuando el mejor camino se llena hay que recurrir a caminos más caros.</p>
      <p>La idea del método de <strong>caminos mínimos sucesivos</strong> es sencilla: enviar siempre por el camino más barato <em>de la red residual</em>. Ahí, un arco con flujo reaparece al revés con costo negativo, de modo que el algoritmo puede arrepentirse de un envío anterior si le conviene.
      El resultado es óptimo exactamente cuando la red residual no contiene ciclos de costo negativo.</p>`,
    visualizaciones: [
      {
        titulo: 'Caminos mínimos sucesivos',
        descripcion: 'Reproduzca el algoritmo con la red de ejemplo y 3 unidades: el último camino necesita un arco de retroceso, y la curva de abajo muestra que cada unidad adicional cuesta lo mismo o más que la anterior. Pruebe «Red aleatoria».',
        montar: montarSucesivos,
      },
      {
        titulo: 'Optimalidad: sin ciclos negativos',
        descripcion: 'Parta de un flujo que ignora los costos y cancele ciclos negativos uno a uno hasta no tener ninguno; el costo final coincide con el de los caminos sucesivos. Pruebe distintas cantidades de unidades.',
        montar: montarCiclos,
      },
    ],
    teoria: String.raw`
      <h2>Formulación</h2>
      <p>Sobre una red dirigida con capacidades \(u_{ij}\) y costos unitarios \(c_{ij}\), enviar \(v\) unidades de \(s\) a \(t\) al menor costo es el programa lineal</p>
      \[ \min \sum_{(i,j)} c_{ij} x_{ij} \quad \text{s.a.} \quad \sum_j x_{ij} - \sum_k x_{ki} = \begin{cases} v & i = s\\ -v & i = t\\ 0 & \text{otro caso}\end{cases},\qquad 0 \le x_{ij} \le u_{ij}. \]
      <p>Es el <a href="tema.html?id=network-flow-model">modelo de flujo en redes</a> con oferta \(v\) en \(s\) y demanda \(v\) en \(t\). Contiene al <a href="tema.html?id=shortest-path-lp">camino más corto</a> (\(v = 1\), sin capacidades), al <a href="tema.html?id=max-flow-min-cut">flujo máximo</a> (costos cero) y al <a href="tema.html?id=transportation-problem">transporte</a>.</p>
      <h2>Red residual con costos</h2>
      <p>Para un flujo \(x\), cada arco \((i,j)\) con \(x_{ij} < u_{ij}\) aporta un arco residual \(i\to j\) de costo \(+c_{ij}\) y capacidad \(u_{ij}-x_{ij}\); y si \(x_{ij} > 0\), un arco \(j \to i\) de costo \(-c_{ij}\) y capacidad \(x_{ij}\): enviar por él <em>quita</em> flujo del arco original y devuelve su costo.</p>
      <h2>Caminos mínimos sucesivos</h2>
      <pre><code>x ← 0;  enviado ← 0
mientras enviado &lt; v:
    P ← camino de costo mínimo de s a t en la residual (Bellman–Ford)
    si no existe P: devolver «infactible: solo caben enviado unidades»
    δ ← mínimo(capacidad residual de P, v − enviado)
    enviar δ por P;  enviado ← enviado + δ</code></pre>
      <p>Se necesita Bellman–Ford (o potenciales con Dijkstra) porque la residual tiene costos negativos, pero <em>nunca</em> tiene ciclos negativos si se parte de \(x = 0\) con costos no negativos.</p>
      <h2>Correctitud y convexidad</h2>
      <div class="recuadro"><p><strong>Teorema de optimalidad:</strong> un flujo factible \(x\) es de costo mínimo para su valor si y solo si su red residual no tiene ciclos de costo negativo.</p></div>
      <p><em>Si hay un ciclo negativo</em>, enviar una unidad por él mantiene la conservación en todos los nodos, es factible (usa capacidad residual) y reduce el costo: \(x\) no era óptimo. <em>Recíprocamente</em>, si \(x\) y \(x'\) son factibles con el mismo valor, \(x' - x\) se descompone en ciclos de la residual de \(x\); si ninguno es negativo, \(c^{\top}x' \ge c^{\top}x\). Por inducción, cada paso de caminos sucesivos conserva la ausencia de ciclos negativos, así que el flujo es óptimo en cada valor.</p>
      <p>Una consecuencia es que el costo mínimo \(z(v)\) es una función <strong>lineal por tramos y convexa</strong> de \(v\): la pendiente en cada tramo es el costo unitario del camino mínimo usado, y esas distancias solo pueden aumentar. Por eso la curva de la primera figura nunca se dobla hacia abajo, y por eso enviar todo por el camino más barato (la recta punteada) es solo una cota inferior: su capacidad es limitada y no es alcanzable más allá de ella.</p>
      <h2>Cancelación de ciclos</h2>
      <p>Alternativa: partir de cualquier flujo factible del valor deseado (por ejemplo, uno de <a href="tema.html?id=max-flow-min-cut">flujo máximo</a> que ignora costos) y, mientras la residual tenga un ciclo de costo negativo, enviar por él el cuello de botella \(\delta\); cada paso baja el costo en \(\delta\,|c(\text{ciclo})|\). Con datos enteros termina; es la segunda figura. La detección es un Bellman–Ford desde un origen virtual.</p>
      <h2>Ejemplo resuelto</h2>
      <p>En la red de ejemplo, el camino \(S\,A\,D\,T\) cuesta \(4+2+1 = 7\), pero su arco \(S\!\to\!A\) solo admite 1 unidad. El segundo camino, \(S\,B\,D\,T\), cuesta \(7+1+1 = 9\) y el tercero, \(S\,B\,D\,A\,C\,T\), cuesta \(7+1-2+6+0 = 12\): incluye el retroceso \(D\to A\) (costo \(-2\)), que desplaza una unidad que iba por \(A\!\to\!D\) hacia \(A\!\to\!C\). El costo total de 3 unidades es \(7+9+12 = 28\) y las pendientes \(7, 9, 12\) crecen, como exige la convexidad.</p>
      <h2>Costo y dualidad</h2>
      <p>El dual asigna un potencial \(\pi_i\) a cada nodo; la optimalidad equivale a que los costos reducidos \(c_{ij} - \pi_i + \pi_j\) tengan el signo correcto en los arcos vacíos y saturados (<a href="tema.html?id=complementary-slackness">holgura complementaria</a>). Las distancias que calcula el algoritmo son esos potenciales. Otras conexiones: <a href="tema.html?id=bellman-ford">Bellman–Ford</a> detecta ciclos negativos y el <a href="tema.html?id=simplex-tableau">Simplex</a> sobre redes avanza por árboles generadores.</p>`,
  });
})();
