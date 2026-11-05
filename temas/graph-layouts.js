(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;
  const GCOL = [C.s1, C.s2, C.s3, C.s7];

  function grafo(n, semilla) {
    const r = VIZ.semilla(semilla * 17 + 3), g = Array.from({ length: n }, (_, i) => i % 4), E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < (g[i] === g[j] ? 0.45 : 0.04)) E.push([i, j]);
    return { n, g, E };
  }
  function cruces(P, E) {
    let c = 0; const o = (a, b, d) => Math.sign((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]));
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const [a, b] = E[i], [d, e] = E[j]; if (a === d || a === e || b === d || b === e) continue; if (o(P[a], P[b], P[d]) !== o(P[a], P[b], P[e]) && o(P[d], P[e], P[a]) !== o(P[d], P[e], P[b])) c++; }
    return c;
  }

  /* ---------- Fig. 1: cuatro layouts de la misma red ---------- */

  function montarLayouts(cuerpo) {
    let tipo = 'fuerza', semilla = 1, G = grafo(24, 1), P = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Layout', valor: tipo, opciones: [['circular', 'circular'], ['rejilla', 'rejilla'], ['azar', 'al azar'], ['fuerza', 'dirigido por fuerzas']], alCambiar: (v) => { tipo = v; calcular(); dibujar(); } });
    ctl.boton('Nueva red', () => { semilla++; G = grafo(24, semilla); calcular(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, GCOL.map((c, i) => ({ color: c, texto: `grupo ${i + 1}` })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todos los dibujos muestran la misma red. Compare cruces de enlaces y la longitud media de los enlaces: el layout por fuerzas minimiza la longitud y deja ver los grupos, aunque no garantiza el mínimo de cruces.');
    function calcular() {
      const { ancho: W, alto: H } = lienzo, n = G.n, r = VIZ.semilla(semilla * 3);
      if (tipo === 'circular') P = Array.from({ length: n }, (_, i) => { const k = [...Array(n).keys()].sort((a, b) => G.g[a] - G.g[b])[i]; return null || [k, W / 2 + Math.cos((i / n) * 6.283 - 1.57) * (Math.min(W, H) / 2 - 24), H / 2 + Math.sin((i / n) * 6.283 - 1.57) * (Math.min(W, H) / 2 - 24)]; }).sort((a, b) => a[0] - b[0]).map((p) => [p[1], p[2]]);
      else if (tipo === 'rejilla') { const c = Math.ceil(Math.sqrt(n)); P = Array.from({ length: n }, (_, i) => [30 + (i % c) * ((W - 60) / (c - 1)), 30 + Math.floor(i / c) * ((H - 60) / (Math.ceil(n / c) - 1))]); }
      else if (tipo === 'azar') P = Array.from({ length: n }, () => [30 + r() * (W - 60), 30 + r() * (H - 60)]);
      else {
        const nodos = Array.from({ length: n }, () => ({ x: W / 2 + (r() - 0.5) * 80, y: H / 2 + (r() - 0.5) * 80, vx: 0, vy: 0 }));
        const sim = V.fuerzas(nodos, { enlaces: G.E.map(([s, t]) => ({ s, t })), distancia: 36, carga: -140, centro: { x: W / 2, y: H / 2, fuerza: 1 }, objetivo: () => ({ x: W / 2, y: H / 2, fuerza: 0.03 }) });
        for (let k = 0; k < 300; k++) sim.tick();
        P = nodos.map((q) => [Math.max(16, Math.min(W - 16, q.x)), Math.max(16, Math.min(H - 16, q.y))]);
      }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.45); ctx.lineWidth = 1.2;
      G.E.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke(); });
      P.forEach((p, i) => { ctx.fillStyle = GCOL[G.g[i]]; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 6.3); ctx.fill(); ctx.stroke(); });
      const largo = G.E.reduce((s, [a, b]) => s + Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]), 0) / G.E.length;
      lectura.set([['nodos · enlaces', `${G.n} · ${G.E.length}`], ['cruces de enlaces', String(cruces(P, G.E))], ['longitud media de enlace', `${VIZ.fmt(largo, 3)} px`]]);
    }
    lienzo.alDibujar = () => { calcular(); dibujar(); };
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.cercano(P.map((p, i) => ({ px: p[0], py: p[1], i })), x, y, 10); if (!c) return tip.ocultar(); tip.mostrar(x, y, `nodo <b>${c.i}</b> · grupo ${G.g[c.i] + 1}<br>grado ${G.E.filter(([a, b]) => a === c.i || b === c.i).length}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular(); dibujar();
  }

  /* ---------- Fig. 2: grafo dirigido en capas ---------- */

  function montarCapas(cuerpo) {
    let capas = true, sel = -1;
    const NOM = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const E = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5], [4, 6], [5, 7], [6, 7], [7, 8]];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Layout del grafo dirigido', valor: 'capas', opciones: [['capas', 'por capas (jerárquico)'], ['fuerza', 'por fuerzas (sin dirección)']], alCambiar: (v) => { capas = v === 'capas'; calc(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'nodo' }, { color: C.s2, texto: 'camino desde el nodo elegido' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para resaltar todo lo que alcanza. En el layout por capas, la dirección se lee de arriba abajo sin flechas; por fuerzas la dirección se pierde salvo por las puntas de flecha.');
    const capa = Array(9).fill(0); for (const [a, b] of E) capa[b] = Math.max(capa[b], capa[a] + 1);
    let P = [];
    function calc() {
      const { ancho: W, alto: H } = lienzo;
      if (capas) { const nCapas = Math.max(...capa) + 1, grupos = Array.from({ length: nCapas }, () => []); capa.forEach((c, i) => grupos[c].push(i)); P = Array(9); grupos.forEach((g, c) => g.forEach((i, k) => { P[i] = [W * ((k + 1) / (g.length + 1)), 30 + c * ((H - 60) / (nCapas - 1))]; })); }
      else { const r = VIZ.semilla(3), nodos = Array.from({ length: 9 }, () => ({ x: W / 2 + (r() - 0.5) * 60, y: H / 2 + (r() - 0.5) * 60, vx: 0, vy: 0 })); const sim = V.fuerzas(nodos, { enlaces: E.map(([s, t]) => ({ s, t })), distancia: 60, carga: -200, centro: { x: W / 2, y: H / 2, fuerza: 1 } }); for (let k = 0; k < 300; k++) sim.tick(); P = nodos.map((q) => [q.x, q.y]); }
    }
    const alcanza = (s) => { const v = new Set([s]); let cambio = true; while (cambio) { cambio = false; for (const [a, b] of E) if (v.has(a) && !v.has(b)) { v.add(b); cambio = true; } } return v; };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const alc = sel >= 0 ? alcanza(sel) : new Set();
      E.forEach(([a, b]) => {
        const act = sel >= 0 && alc.has(a) && alc.has(b), [x0, y0] = P[a], [x1, y1] = P[b], d = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / d, uy = (y1 - y0) / d;
        ctx.strokeStyle = act ? C.s2 : sel >= 0 ? C.tenue : C.eje; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = act ? 3 : 1.5;
        ctx.beginPath(); ctx.moveTo(x0 + ux * 12, y0 + uy * 12); ctx.lineTo(x1 - ux * 14, y1 - uy * 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 - ux * 12, y1 - uy * 12); ctx.lineTo(x1 - ux * 20 - uy * 4, y1 - uy * 20 + ux * 4); ctx.lineTo(x1 - ux * 20 + uy * 4, y1 - uy * 20 - ux * 4); ctx.closePath(); ctx.fill();
      });
      P.forEach((p, i) => { ctx.fillStyle = alc.has(i) ? C.s2 : C.s1; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 12, 0, 6.3); ctx.fill(); ctx.stroke(); V.rotulo(ctx, NOM[i], p[0], p[1], { alinear: 'center', color: C.sobre, peso: 700, tam: 11 }); });
      registro.textContent = sel >= 0 ? `Desde ${NOM[sel]} se alcanzan ${alc.size - 1} nodo(s): ${[...alc].filter((q) => q !== sel).map((q) => NOM[q]).join(', ') || 'ninguno'}.` : `La capa de cada nodo es la longitud del camino más largo que llega a él: ${capa.map((c, i) => `${NOM[i]}=${c}`).join(', ')}.`;
    }
    lienzo.alDibujar = () => { calc(); dibujar(); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.cercano(P.map((p, i) => ({ px: p[0], py: p[1], i })), x, y, 14); sel = c && sel !== c.i ? c.i : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const c = V.cercano(P.map((p, i) => ({ px: p[0], py: p[1], i })), x, y, 14); if (!c) return tip.ocultar(); tip.mostrar(x, y, `${NOM[c.i]}: capa ${capa[c.i]}<br>entran ${E.filter((q) => q[1] === c.i).length} · salen ${E.filter((q) => q[0] === c.i).length}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calc(); dibujar();
  }

  VIZ.registrarTema('graph-layouts', {
    intro: String.raw`
      <p>Una red no trae posiciones: hay que <strong>inventarlas</strong>. El <em>layout</em> es el algoritmo que coloca cada nodo en el plano, y decide qué se ve: los grupos, las conexiones largas, el flujo.</p>
      <p>Un buen layout minimiza cruces de enlaces, mantiene cerca lo conectado y deja respirar a los nodos. Para grafos dirigidos acíclicos, además, hace evidente la dirección.</p>`,
    visualizaciones: [
      { titulo: 'Cuatro layouts de una misma red', descripcion: 'Compare circular, rejilla, azar y fuerzas en cruces de enlaces y longitud media.', montar: montarLayouts },
      { titulo: 'Grafo dirigido por capas', descripcion: 'Compare el layout jerárquico con uno por fuerzas y haga clic en un nodo para ver qué alcanza.', montar: montarCapas },
    ],
    teoria: String.raw`
      <h2>Criterios estéticos</h2>
      <ul>
        <li>minimizar el número de cruces de enlaces \(\chi(G)\),</li>
        <li>minimizar la suma de longitudes de enlace \(\sum_{(u,v) \in E} \lVert \mathbf{p}_u - \mathbf{p}_v \rVert\),</li>
        <li>evitar solapes de nodos y repartir el espacio,</li>
        <li>mostrar simetrías y grupos.</li>
      </ul>
      <p>Minimizar los cruces es NP-difícil, por lo que se usan heurísticas.</p>
      <h2>Familias de layouts</h2>
      <table>
        <tr><th>Layout</th><th>Idea</th><th>Cuándo</th></tr>
        <tr><td>circular</td><td>nodos sobre una circunferencia, agrupados por categoría</td><td>pocas decenas de nodos; comparar grupos</td></tr>
        <tr><td>dirigido por fuerzas</td><td>repulsión + resortes (ver <a href="tema.html?id=d3-force-simulation">simulación de fuerzas</a>)</td><td>redes generales, comunidades</td></tr>
        <tr><td>por capas (Sugiyama)</td><td>capa = camino más largo; reducción de cruces</td><td>grafos dirigidos acíclicos, flujos</td></tr>
        <tr><td>jerárquico / árbol</td><td>raíz arriba, hijos debajo</td><td>árboles</td></tr>
      </table>
      <h2>Layout por capas</h2>
      <p>Para un grafo dirigido acíclico, la capa de un nodo es
      \[ \ell(v) = \begin{cases} 0 & \text{si } v \text{ no tiene predecesores}, \\ 1 + \max_{u \to v} \ell(u) & \text{en otro caso,} \end{cases} \]
      de modo que todas las flechas apuntan hacia capas posteriores. Luego se ordenan los nodos dentro de cada capa para reducir cruces.</p>
      <div class="recuadro"><strong>Advertencia.</strong> La posición no es un dato: dos layouts del mismo grafo se ven muy distintos. Cuando el layout se usa para decir que dos nodos «están cerca», debe tener justificación (distancia en el grafo), no solo estética. Compare con la <a href="tema.html?id=node-link-vs-matrix">matriz de adyacencia</a>, que no necesita layout de nodos.</div>`,
  });
})();
