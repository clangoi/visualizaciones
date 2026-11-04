(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const N = ['A', 'B', 'C', 'D', 'E'], POS = [[0.1, 0.5], [0.35, 0.15], [0.5, 0.85], [0.75, 0.15], [0.92, 0.6]];
  const ARISTAS = [[0, 1, 2], [0, 2, 5], [1, 2, 1], [1, 3, 4], [2, 3, 2], [2, 4, 7], [3, 4, 3]];
  const INF = 99;

  function dibujarRed(lienzo, costos, opciones = {}) {
    const { ctx, ancho: W, alto: H } = lienzo, p = POS.map(([x, y]) => [20 + x * (W - 40), 20 + y * (H - 40)]);
    ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ARISTAS.forEach(([a, b], i) => {
      const [x0, y0] = p[a], [x1, y1] = p[b], res = (opciones.resaltar || []).some(([u, v]) => (u === a && v === b) || (u === b && v === a));
      ctx.strokeStyle = res ? C.s2 : C.eje; ctx.lineWidth = res ? 4 : 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; ctx.fillStyle = C.superficie; ctx.fillRect(mx - 9, my - 8, 18, 16); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10); ctx.fillText(String(costos[i]), mx, my + 0.5);
    });
    N.forEach((n, i) => {
      const [x, y] = p[i], st = opciones.estado ? opciones.estado[i] : 0;
      ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fillStyle = st === 2 ? C.tinta : st === 1 ? C.s4 : i === opciones.origen ? C.s6 : C.superficie; ctx.fill();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = i === opciones.origen ? 3 : 1.5; ctx.stroke();
      ctx.fillStyle = st === 2 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(12, 700); ctx.fillText(n, x, y + 0.5);
      if (opciones.etiqueta) { ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(opciones.etiqueta[i], x, y - 24); }
    });
  }

  function montarDV(cuerpo) {
    let ronda, tablas, costos, nodo = 0, msg, subido = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tabla del router', opciones: N.map((n, i) => [i, n]), valor: nodo, alCambiar: (v) => { nodo = +v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.casilla({ etiqueta: 'Tras converger, el costo B–C sube de 1 a 20', valor: subido, alCambiar: (v) => { subido = v; rep.reiniciar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 220 });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'router cuya tabla se muestra', forma: 'punto' }]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada ronda, todos los routers envían su vector de distancias a sus vecinos, y cada uno recalcula con Bellman–Ford: D(x→y) = mín sobre vecinos v de [ c(x,v) + D(v→y) ]. Al principio solo conocen a sus vecinos.');
    function reset() {
      costos = ARISTAS.map((a) => a[2]);
      tablas = N.map((_, i) => N.map((_, j) => ({ d: i === j ? 0 : INF, s: i === j ? '—' : '—' })));
      ARISTAS.forEach(([a, b], k) => { tablas[a][b] = { d: costos[k], s: N[b] }; tablas[b][a] = { d: costos[k], s: N[a] }; });
      ronda = 0; msg = 'Ronda 0: cada router conoce solo a sus vecinos directos.';
    }
    function gen2() {
      const nuevo = tablas.map((t) => t.map((x) => ({ ...x })));
      let cambio = 0;
      N.forEach((_, x) => N.forEach((_, y) => {
        if (x === y) return;
        let mejor = { d: INF, s: '—' };
        ARISTAS.forEach(([a, b], k) => { const v = a === x ? b : b === x ? a : -1; if (v < 0) return; const c = costos[k] + tablas[v][y].d; if (c < mejor.d) mejor = { d: Math.min(c, INF), s: N[v] }; });
        if (mejor.d !== nuevo[x][y].d || mejor.s !== nuevo[x][y].s) { nuevo[x][y] = mejor; cambio++; }
      }));
      tablas = nuevo; ronda++; return cambio;
    }
    function iniciar() {
      reset();
      if (subido) { while (gen2()); costos[2] = 20; ronda = 0; msg = 'El costo B–C subió a 20: los routers aún usan rutas viejas y deben reconverger.'; }
      return (function* () { for (;;) { const c = gen2(); msg = c ? `Ronda ${ronda}: ${c} entrada(s) de tablas cambiaron.` : `Ronda ${ronda}: nada cambió: las tablas convergieron.`; yield; if (!c) return; } })();
    }
    function dibujar() {
      if (!tablas) return;
      lienzo.limpiar();
      const t = tablas[nodo], res = [];
      N.forEach((_, j) => { if (j && 0) res.push(); });
      dibujarRed(lienzo, costos, { origen: nodo, etiqueta: N.map((_, j) => (j === nodo ? '0' : t[j].d >= INF ? '∞' : String(t[j].d))) });
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['destino', 'costo', 'siguiente salto'].map((h) => el('th', null, h))),
        N.map((n, j) => j === nodo ? null : el('tr', null, el('td', null, n), el('td', null, t[j].d >= INF ? '∞' : String(t[j].d)), el('td', null, t[j].s))).filter(Boolean)));
      registro.textContent = msg;
      lectura.set([['ronda', String(ronda)], ['router', N[nodo]], ['destinos alcanzados', `${t.filter((x, j) => j !== nodo && x.d < INF).length} de 4`]]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  function montarDijkstra(cuerpo) {
    let origen = 0, dist, prev, est, msg;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Origen', opciones: N.map((n, i) => [i, n]), valor: origen, alCambiar: (v) => { origen = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 220 });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'origen', forma: 'punto' }, { color: C.s4, texto: 'frontera (distancia provisoria)', forma: 'punto' }, { color: C.tinta, texto: 'definitivo', forma: 'punto' }, { color: C.s2, texto: 'árbol de caminos más cortos', forma: 'linea' }]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Estado de enlaces: cada router conoce el mapa completo y calcula por sí mismo los caminos más cortos. En cada paso se fija el nodo no definitivo más cercano y se relajan sus aristas.');
    const costos = ARISTAS.map((a) => a[2]);
    function iniciar() {
      dist = N.map((_, i) => (i === origen ? 0 : INF)); prev = N.map(() => -1); est = N.map((_, i) => (i === origen ? 1 : 0)); msg = `Distancia ${N[origen]} = 0; el resto, ∞.`;
      return (function* () {
        yield;
        for (;;) {
          let u = -1; N.forEach((_, i) => { if (est[i] !== 2 && dist[i] < INF && (u < 0 || dist[i] < dist[u])) u = i; });
          if (u < 0) { msg = 'Todos los nodos alcanzables son definitivos.'; return; }
          est[u] = 2; const cambios = [];
          ARISTAS.forEach(([a, b, c]) => { const v = a === u ? b : b === u ? a : -1; if (v < 0 || est[v] === 2) return; if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; est[v] = 1; cambios.push(`${N[v]}=${dist[v]}`); } });
          msg = `Se fija ${N[u]} (distancia ${dist[u]}).${cambios.length ? ' Se actualizan: ' + cambios.join(', ') + '.' : ' Ninguna mejora.'}`; yield;
        }
      })();
    }
    const primer = (j) => { let x = j; while (prev[x] !== origen && prev[x] >= 0) x = prev[x]; return prev[x] < 0 ? '—' : N[x]; };
    function dibujar() {
      if (!dist) return;
      lienzo.limpiar();
      const arbol = prev.map((p, i) => (p >= 0 && est[i] === 2 ? [p, i] : null)).filter(Boolean);
      dibujarRed(lienzo, costos, { origen, estado: est, resaltar: arbol, etiqueta: dist.map((d) => (d >= INF ? '∞' : String(d))) });
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['destino', 'distancia', 'predecesor', 'siguiente salto (tabla de reenvío)'].map((h) => el('th', null, h))),
        N.map((n, j) => j === origen ? null : el('tr', null, el('td', null, n), el('td', null, dist[j] >= INF ? '∞' : String(dist[j])), el('td', null, prev[j] >= 0 ? N[prev[j]] : '—'), el('td', null, est[j] === 2 ? primer(j) : '…'))).filter(Boolean)));
      registro.textContent = msg;
      lectura.set([['definitivos', `${est.filter((e) => e === 2).length} de 5`], ['origen', N[origen]], ['costo de relajación', 'O(E) en total']]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('routing-algorithms', {
    intro: String.raw`
      <p>Para construir las tablas de reenvío, los routers deben conocer los caminos de costo mínimo hacia todos los destinos. Hay dos grandes familias. En <strong>estado de enlaces</strong> (OSPF), cada router difunde a toda la red el estado de sus enlaces, todos tienen el mismo mapa completo y cada uno calcula sus caminos con el algoritmo de Dijkstra. En <strong>vector de distancias</strong> (RIP), cada router solo habla con sus vecinos y les cuenta lo que cree saber de todos los destinos; los caminos se construyen por consenso, con Bellman–Ford distribuido.</p>`,
    visualizaciones: [
      { titulo: 'Vector de distancias', descripcion: 'Avance ronda a ronda y observe cómo se propaga el conocimiento desde los vecinos. Luego suba el costo de B–C y vea la reconvergencia. Cambie de router para ver su tabla.', montar: montarDV },
      { titulo: 'Estado de enlaces con Dijkstra', descripcion: 'Elija un origen y avance: se fija el nodo más cercano y se relajan sus aristas. Al final aparece el árbol de caminos y la tabla de reenvío.', montar: montarDijkstra },
    ],
    teoria: String.raw`
      <h2>Ecuación de Bellman–Ford</h2>
      \[ D_x(y) = \min_{v \in \text{vecinos}(x)} \bigl\{\, c(x,v) + D_v(y) \,\bigr\}. \]
      <p>Cada router repite este cálculo cuando recibe el vector de un vecino. Con \(n\) routers converge en a lo más \(n-1\) rondas. Las malas noticias viajan lento: si un enlace falla, los routers pueden «contar hasta el infinito» (<em>count to infinity</em>), con bucles transitorios. Se mitiga con <em>horizonte dividido</em> (no anunciar a un vecino rutas aprendidas de él) y <em>envenenamiento de rutas</em>, y fijando un «infinito» pequeño (RIP usa 16).</p>
      <h2>Dijkstra (estado de enlaces)</h2>
      <pre><code>dist[origen] ← 0;  dist[otros] ← ∞
mientras haya nodos no definitivos alcanzables:
    u ← nodo no definitivo de menor dist;  marcar u definitivo
    para cada vecino v de u:
        si dist[u] + c(u,v) &lt; dist[v]:  dist[v] ← dist[u] + c(u,v);  prev[v] ← u</code></pre>
      <p>Con un montículo, cuesta \(O((V+E)\log V)\); la corrección es la misma de <a href="tema.html?id=bfs-dijkstra">Dijkstra</a> (costos no negativos). El siguiente salto hacia \(y\) es el primer nodo del camino.</p>
      <h2>Comparación</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Vector de distancias</th><th class="izq">Estado de enlaces</th></tr>
      <tr><td class="izq">información</td><td class="izq">distancias, solo a vecinos</td><td class="izq">mapa completo, a todos</td></tr>
      <tr><td class="izq">convergencia</td><td class="izq">lenta; bucles posibles</td><td class="izq">rápida</td></tr>
      <tr><td class="izq">mensajes</td><td class="izq">pocos, pero periódicos</td><td class="izq">inundación al cambiar un enlace</td></tr>
      <tr><td class="izq">memoria y CPU</td><td class="izq">bajas</td><td class="izq">mayores</td></tr></table>
      <p>En Internet, el enrutamiento <em>dentro</em> de cada sistema autónomo usa estos algoritmos (RIP, OSPF) y <em>entre</em> sistemas autónomos usa BGP, un protocolo de vector de caminos guiado por políticas. Las tablas resultantes se usan en <a href="tema.html?id=longest-prefix-forwarding">el reenvío por prefijo más largo</a>.</p>`,
  });
})();
