(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Red de n pares. Plana: cada par se conecta con ~d pares al azar. Con superpares: una fracción f son superpares, conectados entre sí
     (~d enlaces), y cada par débil cuelga de un superpar que indexa sus archivos. */
  function crear(n, f, semilla) {
    const rnd = VIZ.semilla(semilla);
    const pos = Array.from({ length: n }, () => ({ x: 0.05 + rnd() * 0.9, y: 0.07 + rnd() * 0.86 }));
    const nSup = Math.max(2, Math.round(n * f));
    // Superpares: los primeros nSup (los más «potentes»).
    const plana = Array.from({ length: n }, () => new Set());
    const unir = (g, a, b) => { if (a !== b) { g[a].add(b); g[b].add(a); } };
    const cerca = (i, cand, k) => cand.filter((j) => j !== i).sort((a, b) => Math.hypot(pos[a].x - pos[i].x, pos[a].y - pos[i].y) - Math.hypot(pos[b].x - pos[i].x, pos[b].y - pos[i].y)).slice(0, k);
    const todos = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < n; i++) { cerca(i, todos, 2).forEach((j) => unir(plana, i, j)); unir(plana, i, Math.floor(rnd() * n)); }
    const sup = todos.slice(0, nSup);
    const red = Array.from({ length: n }, () => new Set());
    for (const s of sup) { cerca(s, sup, 2).forEach((j) => unir(red, s, j)); unir(red, s, sup[Math.floor(rnd() * nSup)]); }
    const padre = todos.map((i) => (i < nSup ? i : cerca(i, sup, 1)[0]));
    for (let i = nSup; i < n; i++) unir(red, i, padre[i]);
    // Archivos: el recurso buscado lo tienen 2 pares débiles al azar.
    const tienen = new Set();
    while (tienen.size < 2) tienen.add(nSup + Math.floor(rnd() * (n - nSup)));
    return { n, pos, plana: plana.map((s) => [...s]), red: red.map((s) => [...s]), sup: new Set(sup), padre, tienen };
  }

  // Inundación sin TTL hasta encontrar (cuenta mensajes y saltos). En la red jerárquica la consulta viaja solo entre superpares,
  // y cada superpar responde por los archivos de sus hijos sin preguntarles.
  function buscar(g, origen, jerarquica) {
    const ady = jerarquica ? g.red : g.plana;
    const tiene = (v) => (jerarquica ? g.sup.has(v) && [...g.tienen].some((t) => g.padre[t] === v) : g.tienen.has(v));
    const inicio = jerarquica ? g.padre[origen] : origen;
    const visto = new Set([inicio]), aristas = [];
    let frontera = [inicio], mensajes = jerarquica && inicio !== origen ? 1 : 0, saltos = 0, hallado = tiene(inicio) ? inicio : -1;
    if (jerarquica && inicio !== origen) aristas.push([origen, inicio]);
    while (frontera.length && hallado < 0) {
      saltos++;
      const nueva = [];
      for (const u of frontera) for (const w of ady[u]) {
        if (jerarquica && !g.sup.has(w)) continue;
        mensajes++; aristas.push([u, w]);
        if (!visto.has(w)) { visto.add(w); nueva.push(w); if (hallado < 0 && tiene(w)) hallado = w; }
      }
      frontera = nueva;
    }
    return { mensajes, saltos, visitados: visto.size, aristas, hallado };
  }

  function montar(cuerpo) {
    const est = { n: 60, f: 0.12, semilla: 2, origen: 30 };
    let g, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Pares', min: 20, max: 120, paso: 10, valor: est.n, alCambiar: (v) => { est.n = v; est.origen = Math.min(est.origen, v - 1); nuevo(); } });
    ctl.rango({ etiqueta: 'Fracción de superpares', min: 0.05, max: 0.4, paso: 0.01, valor: est.f, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { est.f = v; nuevo(); } });
    ctl.boton('Nueva red', () => { est.semilla++; nuevo(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 520 : 300) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'superpar', forma: 'punto' }, { color: C.inactivo, texto: 'par débil', forma: 'punto' },
      { color: C.s1, texto: 'quien busca', forma: 'punto' }, { color: C.s6, texto: 'tiene el archivo', forma: 'punto' },
      { color: C.s2, texto: 'mensajes de la búsqueda', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba (o a la izquierda), la red plana; abajo (o a la derecha), la misma red con superpares. Haga clic en un par para que la búsqueda parta de él.');

    function nuevo() { g = crear(est.n, est.f, est.semilla * 41 + est.n); dibujar(); }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const paneles = angosto ? [{ x: 0, y: 18, w: W, h: H / 2 - 24 }, { x: 0, y: H / 2 + 18, w: W, h: H / 2 - 24 }] : [{ x: 0, y: 18, w: W / 2 - 10, h: H - 22 }, { x: W / 2 + 10, y: 18, w: W / 2 - 10, h: H - 22 }];
      const res = [buscar(g, est.origen, false), buscar(g, est.origen, true)];
      geo = [];
      [false, true].forEach((jer, k) => {
        const P = paneles[k], ady = jer ? g.red : g.plana, r = res[k];
        const pt = (i) => ({ x: P.x + 8 + g.pos[i].x * (P.w - 16), y: P.y + 4 + g.pos[i].y * (P.h - 8) });
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(jer ? 'Con superpares' : 'Red plana', P.x + 4, P.y - 2);
        ady.forEach((l, a) => l.forEach((b) => { if (a < b) { const p = pt(a), q = pt(b); ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }));
        const usadas = new Set(r.aristas.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
        ady.forEach((l, a) => l.forEach((b) => { if (a < b && usadas.has(`${a}-${b}`)) { const p = pt(a), q = pt(b); ctx.strokeStyle = VIZ.alfa(C.s2, 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }));
        for (let i = 0; i < g.n; i++) {
          const p = pt(i), sup = g.sup.has(i);
          const col = i === est.origen ? C.s1 : g.tienen.has(i) ? C.s6 : jer && sup ? C.tinta : jer ? C.inactivo : C.tinta2;
          VIZ.marcador(ctx, p.x, p.y, col, i === est.origen || g.tienen.has(i) ? 5.5 : jer && sup ? 5 : 3.2, jer && sup ? 1 : 0);
          if (k === 0) geo[i] = p;
        }
      });
      const [pl, je] = res;
      registro.textContent = `Red plana: ${pl.mensajes} mensajes y ${pl.visitados} pares tocados para encontrar el archivo. Con superpares: ${je.mensajes} mensajes, porque la consulta solo recorre los ${g.sup.size} superpares, que conocen los archivos de sus pares débiles.`;
      lectura.set([
        ['mensajes, red plana', String(pl.mensajes)],
        ['mensajes, superpares', String(je.mensajes)],
        ['saltos, plana / superpares', `${pl.saltos} / ${je.saltos}`],
        ['carga de cada superpar', `≈ ${VIZ.fmt(g.n / g.sup.size, 3)} pares`],
      ]);
    }
    lienzo.alDibujar = () => g && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = VIZ.dist.cercano(geo, x, y, 12);
      if (i >= 0) { est.origen = i; dibujar(); }
    });
    nuevo();
  }

  VIZ.registrarTema('super-peers', {
    intro: String.raw`
      <p>Una red <strong>peer-to-peer</strong> es una <strong>red superpuesta</strong> (<em>overlay</em>): los pares se conectan con enlaces lógicos sobre Internet, sin servidores
      centrales. Su topología puede ser <strong>estructurada</strong>, como un anillo de <a href="tema.html?id=chord-dht">Chord</a>, o <strong>no estructurada</strong>, un grafo casi
      aleatorio donde buscar significa <a href="tema.html?id=flooding-random-walk">inundar o caminar al azar</a>.</p>
      <p>Los pares no son iguales: unos tienen buena conexión y están siempre encendidos, otros entran y salen. Las redes <strong>jerárquicas</strong> (KaZaA, Gnutella 0.6, Skype en sus
      inicios) aprovechan esto: los pares fuertes se vuelven <strong>superpares</strong>, indexan los archivos de un grupo de pares débiles y solo ellos participan en las búsquedas.</p>`,
    visualizaciones: [
      {
        titulo: 'Red plana y red con superpares',
        descripcion: 'La misma búsqueda por inundación en las dos topologías. Con superpares se toca una fracción pequeña de la red. Baje la fracción de superpares: cada uno indexa más pares y carga con más trabajo.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Redes superpuestas</h2>
      <p>Un enlace de la red superpuesta es una conexión entre dos pares que puede atravesar muchos enrutadores físicos. Por eso dos vecinos lógicos pueden estar en continentes distintos:
      una buena red superpuesta es <em>consciente de la topología</em> y prefiere vecinos cercanos en latencia. Las topologías más comunes son:</p>
      <table>
        <tr><th>Tipo</th><th>Búsqueda</th><th>Ejemplos</th></tr>
        <tr><td>Centralizada</td><td>Índice en un servidor, transferencia P2P</td><td>Napster, trackers de BitTorrent</td></tr>
        <tr><td>No estructurada</td><td>Inundación o caminatas, \(O(n)\) mensajes en el peor caso</td><td>Gnutella 0.4</td></tr>
        <tr><td>Jerárquica</td><td>Inundación entre superpares</td><td>KaZaA, Gnutella 0.6</td></tr>
        <tr><td>Estructurada (DHT)</td><td>Enrutamiento por identificadores, \(O(\log n)\) saltos</td><td>Chord, Kademlia, Pastry</td></tr>
      </table>

      <h2>Costo con superpares</h2>
      <p>Si una fracción \(f\) de los \(n\) pares son superpares, una búsqueda por inundación recorre el grafo de superpares: del orden de \(f n\) nodos y \(2|E_{\text{sup}}|\) mensajes en lugar
      de \(2|E|\). Cada superpar atiende a unos \(1/f\) pares débiles, guarda su índice y responde por ellos. El compromiso: \(f\) chico reduce el tráfico pero concentra carga y hace
      a la red más frágil (si un superpar cae, sus pares débiles deben reconectarse); \(f\) grande se parece a la red plana.</p>
      <p>Elegir superpares es un problema de <a href="tema.html?id=bully-algorithm">elección</a> distribuida con criterios de capacidad, tiempo conectado y ubicación; los pares débiles
      suelen conectarse a dos o más superpares para tolerar fallas. En el enrutamiento estructurado, el mismo principio aparece como nodos con más vecinos o con
      <a href="tema.html?id=consistent-hashing">más nodos virtuales</a>.</p>`,
  });
})();
