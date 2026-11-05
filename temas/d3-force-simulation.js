(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;
  const GRUPOS = [C.s1, C.s2, C.s3];

  /* ---------- Fig. 1: grafo con fuerzas ---------- */

  function montarGrafo(cuerpo) {
    let semilla = 3, nodos = [], enlaces = [], sim = null, arrastre = null;
    const op = { carga: -120, distancia: 40, fuerza: 0.06 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Carga (forceManyBody)', min: -400, max: 0, valor: op.carga, alCambiar: (v) => { op.carga = v; sim.op.carga = v; despertar(); } });
    ctl.rango({ etiqueta: 'Distancia del enlace', min: 10, max: 100, valor: op.distancia, alCambiar: (v) => { op.distancia = v; sim.op.distancia = v; despertar(); } });
    ctl.rango({ etiqueta: 'Atracción al centro', min: 0, max: 0.3, paso: 0.01, valor: op.fuerza, alCambiar: (v) => { op.fuerza = v; despertar(); } });
    ctl.boton('Nuevo grafo', () => { semilla++; crear(); }, { primario: true });
    ctl.boton('Reavivar', () => { sim.reavivar(1); despertar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, GRUPOS.map((c, i) => ({ color: c, texto: `grupo ${i + 1}` })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre un nodo: se fija bajo el cursor y los demás reaccionan. Con carga 0 los nodos se amontonan; con mucha carga y enlaces cortos, el grafo se tensa.');
    const bucle = VIZ.bucle(() => { for (let k = 0; k < 2; k++) sim.tick(); dibujar(); return sim.alpha > sim.alphaMin || arrastre != null; });
    const despertar = () => { sim.reavivar(0.6); bucle.iniciar(); };
    function crear() {
      const rnd = VIZ.semilla(semilla * 41), n = 20, W = lienzo.ancho || 600, H = lienzo.alto || 360;
      nodos = Array.from({ length: n }, (_, i) => ({ x: W / 2 + (rnd() - 0.5) * 40, y: H / 2 + (rnd() - 0.5) * 40, vx: 0, vy: 0, g: i % 3, id: i, r: 7 }));
      enlaces = [];
      for (let i = 1; i < n; i++) { const j = Math.floor(rnd() * i); enlaces.push({ s: i, t: nodos[j].g === nodos[i].g ? j : (i + 3 < n ? i + 3 : j) }); }
      for (let i = 0; i < 6; i++) { const a = Math.floor(rnd() * n), b = (a + 3) % n; enlaces.push({ s: a, t: b }); }
      sim = V.fuerzas(nodos, { enlaces, distancia: op.distancia, fuerzaEnlace: 0.3, carga: op.carga, centro: { x: W / 2, y: H / 2, fuerza: 1 }, objetivo: () => ({ x: lienzo.ancho / 2, y: lienzo.alto / 2, fuerza: op.fuerza }) });
      bucle.iniciar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
      for (const e of enlaces) { ctx.beginPath(); ctx.moveTo(nodos[e.s].x, nodos[e.s].y); ctx.lineTo(nodos[e.t].x, nodos[e.t].y); ctx.stroke(); }
      nodos.forEach((q) => { ctx.fillStyle = GRUPOS[q.g]; ctx.strokeStyle = q === arrastre ? C.tinta : C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.3); ctx.fill(); ctx.stroke(); });
      const ec = nodos.reduce((s, q) => s + q.vx * q.vx + q.vy * q.vy, 0);
      lectura.set([['alpha (temperatura)', VIZ.fmt(sim.alpha, 3)], ['iteraciones', VIZ.entero(sim.pasos)], ['energía cinética', VIZ.fmt(ec, 3)], ['estado', sim.alpha > sim.alphaMin ? 'enfriándose' : 'en reposo']]);
    }
    lienzo.alDibujar = () => nodos.length && dibujar();
    const sobre = (x, y) => nodos.find((q) => Math.hypot(q.x - x, q.y - y) < q.r + 5);
    lienzo.canvas.addEventListener('pointerdown', (ev) => { const { x, y } = lienzo.posicion(ev); const q = sobre(x, y); if (!q) return; arrastre = q; q.fx = x; q.fy = y; sim.op.alphaObjetivo = 0.3; lienzo.canvas.setPointerCapture(ev.pointerId); despertar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastre) { arrastre.fx = x; arrastre.fy = y; return; }
      const q = sobre(x, y);
      lienzo.canvas.style.cursor = q ? 'grab' : 'default';
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, `nodo <b>${q.id}</b> · grupo ${q.g + 1}<br>grado ${enlaces.filter((e) => e.s === q.id || e.t === q.id).length}`);
    });
    const soltar = () => { if (arrastre) { arrastre.fx = null; arrastre.fy = null; arrastre = null; sim.op.alphaObjetivo = 0; } };
    lienzo.canvas.addEventListener('pointerup', soltar); lienzo.canvas.addEventListener('pointerleave', () => { soltar(); tip.ocultar(); });
    crear();
  }

  /* ---------- Fig. 2: colisiones y agrupamiento ---------- */

  function montarBurbujas(cuerpo) {
    let agrupar = false, colision = true, nodos = [], sim = null;
    const NOM = ['Norte', 'Centro', 'Sur'];
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Agrupar por categoría (forceX)', valor: agrupar, alCambiar: (v) => { agrupar = v; despertar(); } });
    ctl.casilla({ etiqueta: 'Evitar solapes (forceCollide)', valor: colision, alCambiar: (v) => { colision = v; sim.op.colision = v ? 1 : null; despertar(); } });
    ctl.boton('Dispersar', () => { nodos.forEach((q) => { q.x = lienzo.ancho * (0.2 + Math.random() * 0.6); q.y = lienzo.alto * (0.2 + Math.random() * 0.6); }); despertar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, NOM.map((n, i) => ({ color: GRUPOS[i], texto: n })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El área de cada círculo es proporcional a su valor. Sin colisión los círculos se encimaban; con ella se empujan. Al agrupar, cada categoría se atrae a su propio centro.');
    const bucle = VIZ.bucle(() => { for (let k = 0; k < 2; k++) sim.tick(); dibujar(); return sim.alpha > sim.alphaMin; });
    const despertar = () => { sim.reavivar(0.7); bucle.iniciar(); };
    function crear() {
      const rnd = VIZ.semilla(77), W = lienzo.ancho, H = lienzo.alto;
      nodos = Array.from({ length: 36 }, (_, i) => { const v = 5 + rnd() * 95; return { x: W / 2 + (rnd() - 0.5) * 60, y: H / 2 + (rnd() - 0.5) * 60, vx: 0, vy: 0, g: i % 3, v: Math.round(v), r: 4 + Math.sqrt(v) * 1.5, id: i }; });
      sim = V.fuerzas(nodos, { distancia: 0, carga: 0, colision: 1, objetivo: (q) => ({ x: agrupar ? lienzo.ancho * (0.2 + 0.3 * q.g) : lienzo.ancho / 2, y: lienzo.alto / 2, fuerza: 0.12 }) });
      bucle.iniciar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      nodos.forEach((q) => { ctx.fillStyle = VIZ.alfa(GRUPOS[q.g], 0.85); ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.3); ctx.fill(); ctx.stroke(); });
      let sol = 0; for (let i = 0; i < nodos.length; i++) for (let j = i + 1; j < nodos.length; j++) if (Math.hypot(nodos[i].x - nodos[j].x, nodos[i].y - nodos[j].y) < nodos[i].r + nodos[j].r - 0.5) sol++;
      lectura.set([['círculos', String(nodos.length)], ['pares solapados', String(sol)], ['alpha', VIZ.fmt(sim.alpha, 3)]]);
    }
    lienzo.alDibujar = () => nodos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const q = nodos.find((m) => Math.hypot(m.x - x, m.y - y) < m.r);
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, `${NOM[q.g]} · ítem ${q.id}<br>valor <b>${q.v}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    crear();
  }

  VIZ.registrarTema('d3-force-simulation', {
    intro: String.raw`
      <p>Una <strong>simulación de fuerzas</strong> ubica nodos sin que nadie diga dónde: cada nodo se trata como una partícula, y fuerzas simples —repulsión entre todos, resortes en los enlaces, una atracción al centro— la empujan hasta que el conjunto se aquieta.</p>
      <p>Sirve para grafos (los nodos conectados quedan cerca) y también para burbujas, agrupamientos y evitar solapes: lo que importa es qué fuerzas se combinan.</p>`,
    visualizaciones: [
      { titulo: 'Un grafo que se acomoda solo', descripcion: 'Cambie carga, distancia y atracción al centro, y arrastre nodos para perturbar el equilibrio.', montar: montarGrafo },
      { titulo: 'Colisión y agrupamiento', descripcion: 'Active las fuerzas de colisión y de agrupamiento por categoría sobre círculos de distinto tamaño.', montar: montarBurbujas },
    ],
    teoria: String.raw`
      <h2>Modelo físico</h2>
      <p>Cada nodo \(i\) tiene posición \(\mathbf{x}_i\) y velocidad \(\mathbf{v}_i\). En cada <em>tick</em>, las fuerzas modifican las velocidades, éstas se amortiguan y luego se actualizan las posiciones:
      \[ \mathbf{v}_i \leftarrow (1 - \gamma)\Bigl(\mathbf{v}_i + \alpha \sum_k \mathbf{F}_k(i)\Bigr), \qquad \mathbf{x}_i \leftarrow \mathbf{x}_i + \mathbf{v}_i. \]
      La «temperatura» \(\alpha\) decae hacia cero (\(\alpha \leftarrow \alpha + (\alpha_{\text{obj}} - \alpha)\,\delta\)) y la simulación termina cuando \(\alpha < \alpha_{\min}\): es un <em>enfriamiento simulado</em> sin aleatoriedad.</p>
      <h2>Fuerzas habituales</h2>
      <table>
        <tr><th>Fuerza</th><th>Efecto</th><th>Costo por tick</th></tr>
        <tr><td>enlace</td><td>resorte hacia una distancia \(d\)</td><td>\(O(|E|)\)</td></tr>
        <tr><td>carga (many-body)</td><td>repulsión \(\propto 1/r^2\) entre todos los pares</td><td>\(O(n^2)\), o \(O(n \log n)\) con Barnes–Hut</td></tr>
        <tr><td>centro</td><td>mantiene el centroide en un punto</td><td>\(O(n)\)</td></tr>
        <tr><td>colisión</td><td>separa círculos que se solapan</td><td>\(O(n^2)\), o \(O(n\log n)\) con cuadrículas</td></tr>
        <tr><td>x / y</td><td>atrae a una coordenada objetivo</td><td>\(O(n)\)</td></tr>
      </table>
      <p>La fuerza de un enlace de longitud \(\ell\) con distancia deseada \(d\) y rigidez \(k\) es \(k\,(\ell - d)\) a lo largo del enlace, con la repulsión de carga \(-q/r^2\) actuando sobre cada par.</p>
      <h2>Diseño</h2>
      <p>Los resultados no son únicos: el estado inicial y las fijaciones cambian el dibujo final. Para comparar grafos entre sí hay que fijar la semilla. Ver <a href="tema.html?id=graph-layouts">layouts de grafos</a> y <a href="tema.html?id=node-link-vs-matrix">nodos y enlaces frente a matrices</a>.</p>`,
  });
})();
