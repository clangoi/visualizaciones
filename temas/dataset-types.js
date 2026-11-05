(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const V = VIZ.vis;

  const EST = [
    { n: 'Plaza Italia', x: 52, y: 40, cap: 24 }, { n: 'Baquedano', x: 60, y: 46, cap: 18 }, { n: 'Providencia', x: 74, y: 38, cap: 30 },
    { n: 'U. de Chile', x: 40, y: 60, cap: 14 }, { n: 'Santa Lucía', x: 46, y: 52, cap: 20 }, { n: 'Los Leones', x: 84, y: 30, cap: 26 },
    { n: 'Barrio Lastarria', x: 50, y: 58, cap: 12 }, { n: 'Parque Bustamante', x: 66, y: 62, cap: 16 },
  ];
  const VIAJES = [[0, 1, 40], [0, 4, 25], [1, 2, 35], [2, 5, 22], [3, 4, 30], [4, 6, 28], [6, 3, 15], [1, 7, 18], [7, 2, 10], [4, 0, 33], [5, 2, 12]];

  /* ---------- Fig. 1: un fenómeno, tres abstracciones ---------- */

  function montarAbstracciones(cuerpo) {
    let vista = 'tabla', sel = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Abstracción', valor: vista, opciones: [['tabla', 'Tabla: ítems y atributos'], ['red', 'Red: nodos y enlaces'], ['espacio', 'Espacial: posición geográfica']], alCambiar: (v) => { vista = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'estación' }, { color: C.s2, texto: 'estación seleccionada' }, { color: C.apagado, texto: 'viajes entre estaciones', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Son las mismas ocho estaciones y once rutas. Haga clic en una estación: queda seleccionada en las tres vistas. Cada abstracción hace fácil una pregunta distinta.');
    const TXT = {
      tabla: 'Tabla: cada fila es una estación y cada columna un atributo (capacidad, coordenadas). Fácil: ordenar y buscar por atributo.',
      red: 'Red: cada estación es un nodo y cada ruta un enlace con un peso (viajes). Fácil: ver conexiones y centralidad.',
      espacio: 'Espacial: lo que importa es la posición geográfica. Fácil: ver cercanía y distribución en el territorio.',
    };
    let hit = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      hit = [];
      if (vista === 'tabla') {
        const cols = ['estación', 'capacidad', 'x', 'y'], cw = [W * 0.44, W * 0.2, W * 0.15, W * 0.15], rh = Math.min(30, (H - 30) / 9);
        let x = 10; cols.forEach((c, i) => { V.rotulo(ctx, c, x + (i ? cw[i] - 14 : 6), 14, { tam: 10, peso: 600, alinear: i ? 'right' : 'left', color: C.apagado }); x += cw[i]; });
        EST.forEach((e, k) => {
          const y = 26 + k * rh;
          ctx.fillStyle = k === sel ? VIZ.alfa(C.s2, 0.2) : k % 2 ? C.neutro : C.superficie; ctx.fillRect(6, y, W - 12, rh);
          let xx = 10; [e.n, e.cap, e.x, e.y].forEach((v, i) => { V.rotulo(ctx, String(v), xx + (i ? cw[i] - 14 : 6), y + rh / 2, { tam: 12, alinear: i ? 'right' : 'left', color: k === sel ? C.tinta : C.tinta2, peso: k === sel ? 700 : 400 }); xx += cw[i]; });
          hit.push({ x: 6, y, w: W - 12, h: rh, i: k });
        });
      } else {
        const circ = vista === 'red', pos = (e, k) => (circ ? [W / 2 + Math.cos((k / 8) * 6.283 - 1.57) * Math.min(W, H) * 0.36, H / 2 + Math.sin((k / 8) * 6.283 - 1.57) * Math.min(W, H) * 0.36] : [20 + (e.x / 100) * (W - 40), 20 + (e.y / 100) * (H - 40)]);
        const P = EST.map(pos);
        VIAJES.forEach(([a, b, w]) => { ctx.strokeStyle = VIZ.alfa(C.apagado, sel < 0 || sel === a || sel === b ? 0.8 : 0.2); ctx.lineWidth = circ ? w / 10 : 1; ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke(); });
        if (vista === 'espacio') { ctx.strokeStyle = C.rejilla; ctx.strokeRect(10.5, 10.5, W - 21, H - 21); V.rotulo(ctx, 'N ↑', W - 36, 24, { tam: 11, color: C.apagado }); }
        EST.forEach((e, k) => { const r = vista === 'espacio' ? 4 + e.cap / 3.2 : 9; ctx.fillStyle = k === sel ? C.s2 : VIZ.alfa(C.s1, 0.85); ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P[k][0], P[k][1], r, 0, 6.3); ctx.fill(); ctx.stroke(); if (circ) V.rotulo(ctx, e.n, P[k][0], P[k][1] + (P[k][1] > H / 2 ? 20 : -18), { alinear: 'center', tam: 10, color: C.tinta2 }); hit.push({ x: P[k][0] - r, y: P[k][1] - r, w: 2 * r, h: 2 * r, i: k }); });
      }
      registro.textContent = TXT[vista] + (sel >= 0 ? ` Seleccionada: ${EST[sel].n}.` : '');
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hit, x, y); sel = h && sel !== h.i ? h.i : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hit, x, y); if (!h) return tip.ocultar(); const e = EST[h.i], g = VIAJES.filter((q) => q[0] === h.i || q[1] === h.i).length; tip.mostrar(x, y, `<b>${e.n}</b><br>capacidad ${e.cap} · ${g} rutas`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: explorar una red ---------- */

  function montarRed(cuerpo) {
    let umbral = 15, sel = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Peso mínimo del enlace (viajes)', min: 0, max: 40, valor: umbral, alCambiar: (v) => { umbral = v; dibujar(); } });
    ctl.boton('Quitar selección', () => { sel = -1; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'nodo (tamaño = grado)' }, { color: C.s2, texto: 'nodo seleccionado' }, { color: C.s3, texto: 'vecino del seleccionado' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Suba el peso mínimo: los enlaces débiles desaparecen y la red se parte en componentes. Haga clic en un nodo para ver sus vecinos y su grado.');
    let hit = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const n = EST.length, P = EST.map((_, k) => [W / 2 + Math.cos((k / n) * 6.283 - 1.57) * Math.min(W, H) * 0.36, H / 2 + Math.sin((k / n) * 6.283 - 1.57) * Math.min(W, H) * 0.36]);
      const E = VIAJES.filter((q) => q[2] >= umbral);
      const grado = EST.map((_, k) => E.filter((q) => q[0] === k || q[1] === k).length);
      const vec = new Set(sel >= 0 ? E.filter((q) => q[0] === sel || q[1] === sel).map((q) => (q[0] === sel ? q[1] : q[0])) : []);
      E.forEach(([a, b, w]) => { const act = sel < 0 || a === sel || b === sel; ctx.strokeStyle = act ? (sel >= 0 ? C.tinta2 : C.apagado) : C.tenue; ctx.lineWidth = 1 + w / 12; ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke(); });
      hit = [];
      EST.forEach((e, k) => { const r = 7 + grado[k] * 2.2; ctx.fillStyle = k === sel ? C.s2 : vec.has(k) ? C.s3 : C.s1; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P[k][0], P[k][1], r, 0, 6.3); ctx.fill(); ctx.stroke(); V.rotulo(ctx, V.corto(e.n, 12), P[k][0], P[k][1] + (P[k][1] > H / 2 ? r + 11 : -r - 10), { alinear: 'center', tam: 10 }); hit.push({ x: P[k][0] - r, y: P[k][1] - r, w: 2 * r, h: 2 * r, i: k }); });
      // componentes conexas
      const padre = EST.map((_, k) => k); const raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
      E.forEach(([a, b]) => { padre[raiz(a)] = raiz(b); });
      const comp = new Set(EST.map((_, k) => raiz(k))).size;
      lectura.set([['nodos · enlaces', `${n} · ${E.length}`], ['componentes conexas', String(comp)], ['grado máximo', String(Math.max(...grado))], ['seleccionado', sel >= 0 ? `${EST[sel].n}: grado ${grado[sel]}` : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hit, x, y); sel = h && sel !== h.i ? h.i : -1; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const h = V.bajo(hit, x, y); if (!h) return tip.ocultar(); tip.mostrar(x, y, `<b>${EST[h.i].n}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('dataset-types', {
    intro: String.raw`
      <p>Un mismo fenómeno puede describirse con distintas <strong>abstracciones de datos</strong>. Los viajes en bicicleta compartida son una <em>tabla</em> (estaciones y sus atributos), una <em>red</em> (estaciones unidas por rutas) y un conjunto <em>espacial</em> (puntos en el territorio). Cada una vuelve fácil unas preguntas y difíciles otras.</p>
      <p>Elegir la abstracción es parte del diseño: determina qué codificaciones son posibles.</p>`,
    visualizaciones: [
      { titulo: 'Un fenómeno, tres abstracciones', descripcion: 'Alterne entre tabla, red y mapa para las mismas estaciones; la selección se conserva entre vistas.', montar: montarAbstracciones },
      { titulo: 'Atributos de una red', descripcion: 'Filtre los enlaces por peso y vea cómo cambian el grado, los vecinos y las componentes conexas.', montar: montarRed },
    ],
    teoria: String.raw`
      <h2>Tipos de conjuntos de datos</h2>
      <table>
        <tr><th>Tipo</th><th>Estructura</th><th>Ejemplo</th></tr>
        <tr><td>tabla</td><td>ítems (filas) × atributos (columnas)</td><td>clientes con edad, comuna, gasto</td></tr>
        <tr><td>red (grafo)</td><td>nodos y enlaces, ambos con atributos</td><td>estaciones y viajes</td></tr>
        <tr><td>campo</td><td>valores en posiciones continuas</td><td>temperatura sobre un territorio</td></tr>
        <tr><td>geométrico</td><td>formas y posiciones</td><td>límites de comunas, rutas</td></tr>
      </table>
      <h2>Redes</h2>
      <p>Una red \(G = (V, E)\) tiene nodos \(V\) y enlaces \(E\), dirigidos o no, con peso o sin él. El <em>grado</em> de un nodo es el número de enlaces que lo tocan: \(\deg(v) = |\{ e \in E : v \in e \}|\), y \(\sum_v \deg(v) = 2|E|\) en una red no dirigida. Una <em>componente conexa</em> es un conjunto maximal de nodos alcanzables entre sí.</p>
      <h2>Datos espaciales</h2>
      <p>Los datos con posición geográfica (<em>georreferenciados</em>) tienen una dimensión privilegiada: la ubicación. Un mapa conserva distancias y vecindad, a costa de que las posiciones ya no puedan usarse para otro atributo. Ver <a href="tema.html?id=choropleth-symbol-maps">mapas coropléticos y de símbolos</a>.</p>
      <div class="recuadro"><strong>Idea.</strong> Derivar una abstracción de otra es legítimo (de una tabla de viajes se obtiene una red), pero cada derivación pierde algo: la red pierde el orden temporal si no se agrega como atributo.</div>
      <p>Las codificaciones de redes se comparan en <a href="tema.html?id=node-link-vs-matrix">nodos y enlaces frente a matrices</a>; los tipos de atributo en <a href="tema.html?id=data-types-attributes">tipos de datos</a>.</p>`,
  });
})();
