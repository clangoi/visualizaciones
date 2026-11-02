(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos compartidos ---------- */

  const TODOS = Object.values(P.personas).flat();
  const ROL_DE = {};
  for (const [r, ps] of Object.entries(P.personas)) ps.forEach((p) => { ROL_DE[p] = r; });
  const COLOR_ROL = { ventas: C.s1, bodega: C.s2, finanzas: C.s3, soporte: C.s4, gerencia: C.s5 };
  const PROCESOS = [['pedidos', 'Gestión de pedidos'], ['reclamos', 'Atención de reclamos']];

  function crearLog(proc, n, semilla, poliv) {
    const log = P.simular(P.procesos[proc].arbol, n, semilla);
    const rnd = VIZ.semilla(semilla * 97 + 5);
    for (const c of log) for (const e of c.eventos) if (rnd() < poliv) e.recurso = TODOS[Math.floor(rnd() * TODOS.length)];
    return log;
  }
  function posCircular(ids) {
    const pos = {};
    ids.forEach((id, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length; pos[id] = { x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a) }; });
    return pos;
  }

  // Aristas sin dirección (P.dibujarGrafo dibuja flechas): se trazan antes de los nodos con la misma geometría.
  function aristasPlanas(lienzo, pers, aristas) {
    const { ctx, ancho: W, alto: H } = lienzo, pos = posCircular(pers);
    ctx.lineCap = 'round';
    for (const e of aristas) {
      ctx.strokeStyle = e.color; ctx.lineWidth = e.ancho;
      ctx.beginPath();
      ctx.moveTo(44 + pos[e.de].x * (W - 88), 30 + pos[e.de].y * (H - 60));
      ctx.lineTo(44 + pos[e.a].x * (W - 88), 30 + pos[e.a].y * (H - 60));
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  // Red social de traspasos directos, sin dirección (peso = traspasos en ambos sentidos).
  function red(log) {
    const s = new Set(log.flatMap((c) => c.eventos.map((e) => e.recurso)));
    const pers = TODOS.filter((p) => s.has(p));
    const W = pers.map(() => pers.map(() => 0));
    for (const c of log) for (let i = 1; i < c.eventos.length; i++) {
      const a = pers.indexOf(c.eventos[i - 1].recurso), b = pers.indexOf(c.eventos[i].recurso);
      if (a !== b) { W[a][b]++; W[b][a]++; }
    }
    return { pers, W };
  }
  // Lista de adyacencia con las aristas de peso ≥ minimo, sin contar nodos quitados.
  function adyacencia(W, minimo, quitados) {
    const N = W.length;
    return Array.from({ length: N }, (_, i) => (quitados && quitados.has(i) ? [] : W[i].map((w, j) => (j !== i && w >= minimo && w > 0 && !(quitados && quitados.has(j)) ? j : -1)).filter((j) => j >= 0)));
  }
  function bfs(adj, s) {
    const N = adj.length, dist = Array(N).fill(-1), orden = [], pred = Array.from({ length: N }, () => []), sigma = Array(N).fill(0);
    dist[s] = 0; sigma[s] = 1;
    const cola = [s];
    for (let h = 0; h < cola.length; h++) {
      const v = cola[h]; orden.push(v);
      for (const w of adj[v]) {
        if (dist[w] < 0) { dist[w] = dist[v] + 1; cola.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
      }
    }
    return { dist, orden, pred, sigma };
  }
  // Grado, intermediación (Brandes, normalizada) y cercanía (Wasserman–Faust) de los nodos `vivos`.
  function centralidades(adj, vivos) {
    const N = adj.length, n = vivos.length;
    const grado = adj.map((a) => a.length), inter = Array(N).fill(0), cerca = Array(N).fill(0);
    for (const s of vivos) {
      const { dist, orden, pred, sigma } = bfs(adj, s);
      const delta = Array(N).fill(0);
      for (let k = orden.length - 1; k >= 0; k--) {
        const w = orden[k];
        for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) inter[w] += delta[w];
      }
      const alc = orden.length - 1, suma = orden.reduce((t, v) => t + dist[v], 0);
      cerca[s] = n > 1 && suma > 0 ? (alc / (n - 1)) * (alc / suma) : 0;
    }
    const norm = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0; // cada par se cuenta dos veces: (n−1)(n−2)/2 · 2
    return { grado: grado.map((g) => (n > 1 ? g / (n - 1) : 0)), gradoAbs: grado, inter: inter.map((v) => v * norm), cerca };
  }
  function componentes(adj, vivos) {
    const comp = Array(adj.length).fill(-1), lista = [];
    for (const s of vivos) {
      if (comp[s] >= 0) continue;
      const miembros = [], cola = [s]; comp[s] = lista.length;
      for (let h = 0; h < cola.length; h++) { miembros.push(cola[h]); for (const w of adj[cola[h]]) if (comp[w] < 0) { comp[w] = lista.length; cola.push(w); } }
      lista.push(miembros);
    }
    lista.sort((a, b) => b.length - a.length);
    lista.forEach((m, k) => m.forEach((v) => { comp[v] = k; }));
    return { comp, lista };
  }
  const MEDIDAS = [['grado', 'Grado'], ['inter', 'Intermediación'], ['cerca', 'Cercanía']];

  /* ---------- Fig. 1: tres medidas de centralidad ---------- */

  function montarMedidas(cuerpo) {
    let proc = 'pedidos', n = 150, poliv = 0.15, semilla = 1, minimo = 0.1, medida = 'inter', sel = -1, hover = -1;
    let R = null, cen = null, adj = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; calcular(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; calcular(); } });
    ctl.rango({ etiqueta: 'Peso mínimo de la arista', min: 0, max: 0.6, paso: 0.02, valor: minimo, formato: (v) => `${Math.round(v * 100)} % del máximo`, alCambiar: (v) => { minimo = v; recalcular(); } });
    ctl.selector({ etiqueta: 'Colorear por', opciones: MEDIDAS, valor: medida, alCambiar: (v) => { medida = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 290, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.1)), texto: 'centralidad baja' },
      { color: VIZ.css(VIZ.enRampa(0.55)), texto: 'media' },
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'alta (la mayor de la red tiene el color más oscuro)' },
      { color: C.s1, texto: 'traspaso entre personas (grosor = peso)', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una persona para destacarla en la tabla. Suba el peso mínimo y vea cómo las medidas cambian al quedar menos aristas; con la red desconectada, la cercanía penaliza a quienes alcanzan a pocos.');

    function calcular() { R = red(crearLog(proc, n, semilla, poliv)); sel = -1; recalcular(); }
    function recalcular() {
      const max = Math.max(1, ...R.W.flat());
      adj = adyacencia(R.W, minimo * max, null);
      cen = centralidades(adj, R.pers.map((_, i) => i));
      dibujar();
    }

    function dibujar() {
      if (!R) return;
      const N = R.pers.length, max = Math.max(1, ...R.W.flat());
      const vals = cen[medida], vmax = Math.max(1e-9, ...vals);
      const arcos = [];
      for (let i = 0; i < N; i++) for (const j of adj[i]) if (i < j) arcos.push({ de: R.pers[i], a: R.pers[j], ancho: 1.5 + 5 * R.W[i][j] / max, color: C.s1 });
      const nodos = R.pers.map((p, i) => ({ id: p, tipo: 'act', etiqueta: p, relleno: VIZ.css(VIZ.enRampa(0.08 + 0.92 * vals[i] / vmax)), borde: C.tinta, anillo: i === sel ? C.s2 : i === hover ? C.tinta2 : null }));
      lienzo.limpiar();
      aristasPlanas(lienzo, R.pers, arcos);
      geo = P.dibujarGrafo(lienzo, nodos, [], posCircular(R.pers));
      const orden = R.pers.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);
      const cab = VIZ.el('tr', null, ...['persona', 'rol', 'vecinos', 'grado', 'intermediación', 'cercanía'].map((t, k) => VIZ.el('th', { class: k < 2 ? 'izq' : '' }, t)));
      const filas = orden.map((i) => VIZ.el('tr', { class: i === sel ? 'activa' : '' },
        VIZ.el('td', { class: 'izq' }, R.pers[i]), VIZ.el('td', { class: 'izq' }, ROL_DE[R.pers[i]]), VIZ.el('td', null, String(cen.gradoAbs[i])),
        VIZ.el('td', null, VIZ.fmt(cen.grado[i], 3)), VIZ.el('td', null, VIZ.fmt(cen.inter[i], 3)), VIZ.el('td', null, VIZ.fmt(cen.cerca[i], 3))));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, cab), VIZ.el('tbody', null, ...filas)));
      const comp = componentes(adj, R.pers.map((_, i) => i));
      const aristasN = arcos.length, mejor = orden[0];
      lectura.set([
        ['personas / aristas', `${N} / ${aristasN}`],
        ['densidad', VIZ.fmt(N > 1 ? (2 * aristasN) / (N * (N - 1)) : 0, 3)],
        ['componentes conexas', String(comp.lista.length)],
        [`mayor ${MEDIDAS.find((m) => m[0] === medida)[1].toLowerCase()}`, `${R.pers[mejor]} (${VIZ.fmt(vals[mejor], 3)})`],
      ]);
      registro.textContent = sel >= 0
        ? `${R.pers[sel]}: ${cen.gradoAbs[sel]} vecinos, grado ${VIZ.fmt(cen.grado[sel], 3)}, intermediación ${VIZ.fmt(cen.inter[sel], 3)}, cercanía ${VIZ.fmt(cen.cerca[sel], 3)}.`
        : 'Grado: fracción de personas con las que se conecta. Intermediación: fracción de caminos más cortos que pasan por la persona. Cercanía: qué cerca está, en promedio, de todos los demás.';
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const nd = P.nodoEn(geo, x, y), h = nd ? R.pers.indexOf(nd.id) : -1;
      if (h !== hover) { hover = h; dibujar(); }
      if (h < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${R.pers[h]}</b> · ${ROL_DE[R.pers[h]]}` + VIZ.filaTooltip(C.s1, 'grado', VIZ.fmt(cen.grado[h], 3)) + VIZ.filaTooltip(C.s2, 'intermediación', VIZ.fmt(cen.inter[h], 3)) + VIZ.filaTooltip(C.s3, 'cercanía', VIZ.fmt(cen.cerca[h], 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const nd = geo && P.nodoEn(geo, x, y), i = nd ? R.pers.indexOf(nd.id) : -1;
      sel = i >= 0 && i !== sel ? i : -1;
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 2: ¿qué pasa si alguien se va? ---------- */

  function montarSalida(cuerpo) {
    let proc = 'pedidos', poliv = 0.15, semilla = 1, minimo = 0.15, orden = 'inter', quitados = new Set(), R = null, adj = null, base = null, msg = '', geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proc, alCambiar: (v) => { proc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Polivalencia', min: 0, max: 0.6, paso: 0.05, valor: poliv, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { poliv = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Peso mínimo de la arista', min: 0, max: 0.6, paso: 0.02, valor: minimo, formato: (v) => `${Math.round(v * 100)} % del máximo`, alCambiar: (v) => { minimo = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Quién se va primero', opciones: [['inter', 'Mayor intermediación'], ['grado', 'Mayor grado'], ['azar', 'Al azar']], valor: orden, alCambiar: (v) => { orden = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 290, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso retira a la persona más central según el criterio elegido. También puede hacer clic en cualquier persona para retirarla (o volver a incorporarla) y ver qué parte de la red queda comunicada.');

    const vivos = () => R.pers.map((_, i) => i).filter((i) => !quitados.has(i));
    function metricas() {
      const v = vivos(), a = adyacencia(R.W, minimo * Math.max(1, ...R.W.flat()), quitados);
      const cc = componentes(a, v), cen = centralidades(a, v);
      let suma = 0, pares = 0;
      if (cc.lista.length) for (const s of cc.lista[0]) { const d = bfs(a, s).dist; for (const t of cc.lista[0]) if (t > s) { suma += d[t]; pares++; } }
      const nV = v.length, posibles = (nV * (nV - 1)) / 2;
      const conectados = cc.lista.reduce((s, m) => s + (m.length * (m.length - 1)) / 2, 0);
      return { a, v, cc, cen, mayor: cc.lista.length ? cc.lista[0].length : 0, dMedia: pares ? suma / pares : NaN, incomunicados: posibles - conectados };
    }

    function iniciar() {
      const log = crearLog(proc, 150, semilla, poliv);
      R = red(log);
      quitados = new Set();
      base = metricas();
      msg = 'Red completa. Cada paso retira a una persona y recalcula las medidas.';
      const rnd = VIZ.semilla(semilla * 13 + 1);
      return (function* () {
        while (quitados.size < R.pers.length - 1) {
          const m = metricas();
          let cand;
          if (orden === 'azar') { const v = m.v; cand = v[Math.floor(rnd() * v.length)]; }
          else cand = m.v.slice().sort((x, z) => m.cen[orden][z] - m.cen[orden][x] || x - z)[0];
          quitados.add(cand);
          const d = metricas();
          msg = `Se va ${R.pers[cand]} (${ROL_DE[R.pers[cand]]}): quedan ${d.cc.lista.length} componente(s) y la mayor tiene ${d.mayor} de ${d.v.length} personas.`;
          yield;
        }
      })();
    }

    function dibujar() {
      if (!R) return;
      const m = metricas(), N = R.pers.length, max = Math.max(1, ...R.W.flat());
      const arcos = [];
      for (let i = 0; i < N; i++) for (const j of m.a[i]) if (i < j) arcos.push({ de: R.pers[i], a: R.pers[j], ancho: 1.5 + 5 * R.W[i][j] / max, color: C.s1 });
      const colorComp = (k) => VIZ.series[k % 8];
      const nodos = R.pers.map((p, i) => {
        const q = quitados.has(i);
        return { id: p, tipo: 'act', etiqueta: p, relleno: q ? C.neutro : C.superficie, borde: q ? C.tenue : colorComp(m.cc.comp[i]), colorTexto: q ? C.apagado : C.tinta, anillo: q ? null : i === hover ? C.tinta : colorComp(m.cc.comp[i]) };
      });
      lienzo.limpiar();
      aristasPlanas(lienzo, R.pers, arcos);
      geo = P.dibujarGrafo(lienzo, nodos, [], posCircular(R.pers));
      leyenda.set([
        ...m.cc.lista.slice(0, 5).map((c, k) => ({ color: colorComp(k), texto: k === 0 ? `componente principal (${c.length})` : `componente aislada (${c.length}): ${c.map((i) => R.pers[i]).join(', ')}` })),
        { color: C.neutro, texto: 'persona que se fue', borde: C.tenue },
      ]);
      registro.textContent = msg;
      const f = (x) => (isNaN(x) ? '—' : VIZ.fmt(x, 3));
      lectura.set([
        ['personas que quedan', `${m.v.length} de ${N}`],
        ['componentes', `${m.cc.lista.length} (antes ${base.cc.lista.length})`],
        ['mayor componente', `${m.mayor} (antes ${base.mayor})`],
        ['pares incomunicados', `${m.incomunicados} (antes ${base.incomunicados})`],
        ['distancia media en la mayor', `${f(m.dMedia)} (antes ${f(base.dMedia)})`],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const nd = P.nodoEn(geo, x, y), h = nd ? R.pers.indexOf(nd.id) : -1;
      if (h !== hover) { hover = h; dibujar(); }
      if (h < 0) return tip.ocultar();
      const q = quitados.has(h);
      tip.mostrar(x, y, `<b>${R.pers[h]}</b> · ${ROL_DE[R.pers[h]]}<br>${q ? 'ya se fue (clic para volver)' : 'clic para retirarla de la red'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (R) dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const nd = P.nodoEn(geo, x, y);
      if (!nd) return;
      const i = R.pers.indexOf(nd.id);
      if (quitados.has(i)) { quitados.delete(i); msg = `${nd.id} vuelve a la red.`; }
      else if (quitados.size < R.pers.length - 1) { quitados.add(i); const d = metricas(); msg = `Usted retira a ${nd.id}: quedan ${d.cc.lista.length} componente(s); la mayor tiene ${d.mayor} personas.`; }
      dibujar();
    });
    rep.reiniciar();
  }

  VIZ.registrarTema('social-network-centrality', {
    intro: String.raw`
      <p>Una vez construida la red social del proceso (por ejemplo, la de <a href="tema.html?id=handover-of-work">traspaso de trabajo</a>), la pregunta es
      <em>quiénes importan más</em>. La <strong>centralidad</strong> responde de tres maneras: quién tiene más conexiones (<em>grado</em>), quién está en el camino de
      otros (<em>intermediación</em>) y quién llega más rápido a todos (<em>cercanía</em>).</p>
      <p>Las tres no coinciden. Una persona con pocas conexiones puede ser el único puente entre dos equipos, y por eso es un riesgo organizacional:
      si se va, la red se parte.</p>`,
    visualizaciones: [
      {
        titulo: 'Grado, intermediación y cercanía',
        descripcion: 'Cambie la medida con la que se colorea la red y compare el orden de las personas en la tabla. Suba el peso mínimo para quedarse con los traspasos principales y observe quién conserva su posición.',
        montar: montarMedidas,
      },
      {
        titulo: 'Si una persona sale de la red',
        descripcion: 'Retire personas una a una, en orden de intermediación o al azar, o haga clic en las que quiera quitar. Compare cuántos pares quedan incomunicados al sacar al más central frente a sacar a alguien al azar.',
        montar: montarSalida,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Se trabaja sobre el grafo no dirigido \(G = (V, E)\) de la red social, con \(n = |V|\), donde hay arista entre \(p\) y \(q\) si su peso (por ejemplo, el traspaso en
      cualquier sentido) supera un umbral. Sea \(d(u,v)\) la longitud del camino más corto, \(\sigma_{st}\) el número de caminos más cortos de \(s\) a \(t\) y
      \(\sigma_{st}(v)\) cuántos pasan por \(v\).</p>
      <ul>
        <li><strong>Grado:</strong> \(C_D(v) = \dfrac{\deg(v)}{n-1}\). Mide actividad: con cuántas personas interactúa directamente.</li>
        <li><strong>Intermediación:</strong> \(C_B(v) = \dfrac{2}{(n-1)(n-2)} \displaystyle\sum_{s \ne v \ne t} \dfrac{\sigma_{st}(v)}{\sigma_{st}}\), fracción de los caminos más cortos que dependen de \(v\). Mide control del flujo.</li>
        <li><strong>Cercanía:</strong> \(C_C(v) = \dfrac{r_v}{n-1}\cdot\dfrac{r_v}{\sum_{u} d(v,u)}\), con \(r_v\) el número de personas alcanzables. Mide independencia: qué tan pocos intermediarios necesita. El primer factor
        corrige las redes desconectadas.</li>
      </ul>
      <h2>Cálculo: algoritmo de Brandes</h2>
      <pre><code>para cada s ∈ V:
    BFS desde s: distancias d, número de caminos σ, predecesores P[w]
    δ[v] ← 0 para todo v
    para w en orden inverso de la búsqueda:
        para v ∈ P[w]:  δ[v] ← δ[v] + σ[v]/σ[w] · (1 + δ[w])
        si w ≠ s:  C_B[w] ← C_B[w] + δ[w]
(dividir por el total de pares para normalizar)</code></pre>
      <p>Cuesta \(O(|V|\,|E|)\) en grafos sin peso, mucho menos que enumerar todos los caminos. La misma búsqueda por niveles de
      <a href="tema.html?id=bfs-dijkstra">BFS</a> entrega las distancias de la cercanía.</p>
      <h2>Personas clave y fragilidad</h2>
      <p>Quitar un nodo y recalcular indica la <em>dependencia</em> del proceso: cuántos pares quedan incomunicados y cuánto crece la distancia media. En general, retirar al nodo de mayor
      intermediación fragmenta la red con muchos menos retiros que hacerlo al azar. Un nodo cuya salida desconecta el grafo es un <em>punto de articulación</em>.</p>
      <div class="recuadro"><p><strong>Interpretación.</strong> La centralidad es una propiedad de la red <em>observada</em>: depende del umbral, del proceso y de si el registro
      captura todas las interacciones. Una persona central puede ser eficiente (coordinadora) o un cuello de botella; el contexto y la
      <a href="tema.html?id=resource-workload">carga de trabajo</a> ayudan a distinguirlo.</p></div>
      <h2>Conexiones</h2>
      <p>Las redes de <a href="tema.html?id=working-together">trabajo conjunto</a> también admiten estas medidas. Los mismos conceptos aparecen en el análisis de grafos en general.</p>`,
  });
})();
