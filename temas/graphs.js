(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const G = VIZ.grafo;

  function montar(cuerpo) {
    const est = { n: 7, grado: 2.6, dirigido: false, ponderado: false, semilla: 3 };
    let g, seleccion = -1, hover = -1;
    const nuevo = () => {
      g = G.generar({ n: est.n, grado: est.grado, dirigido: est.dirigido, semilla: est.semilla, pesos: [1, 9] });
      seleccion = -1;
      todo();
    };

    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, nuevo, { nMin: 3, nMax: 12 });
    ctl.casilla({ etiqueta: 'dirigido', valor: est.dirigido, alCambiar: (v) => { est.dirigido = v; nuevo(); } });
    ctl.casilla({ etiqueta: 'con pesos', valor: est.ponderado, alCambiar: (v) => { est.ponderado = v; todo(); } });
    ctl.boton('Nuevo grafo', () => { est.semilla++; nuevo(); }, { primario: true });
    ctl.boton('Quitar todas las aristas', () => { g.aristas = []; todo(); });

    const columnas = el('div', { class: 'dos-columnas' });
    const izq = el('div'), der = el('div');
    columnas.append(izq, der);
    cuerpo.appendChild(columnas);
    izq.appendChild(el('p', { class: 'nota-viz', style: { margin: '0 0 6px', fontWeight: 600, color: '#0b0b0b' } }, 'Grafo'));
    const lienzo = VIZ.lienzo(izq, { proporcion: 0.82, altoMax: 420 });
    der.appendChild(el('p', { class: 'nota-viz', style: { margin: '0 0 6px', fontWeight: 600, color: '#0b0b0b' } }, 'Matriz de adyacencia'));
    const matriz = VIZ.lienzo(der, { proporcion: 0.82, altoMax: 420 });
    cuerpo.appendChild(el('p', { class: 'nota-viz', style: { margin: '16px 0 6px', fontWeight: 600, color: '#0b0b0b' } }, 'Listas de adyacencia'));
    const listas = el('div', { class: 'mono', style: { fontSize: '13px', lineHeight: '1.8', border: '1px solid #e1e0d9', padding: '8px 12px' } });
    cuerpo.appendChild(listas);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo y luego en otro para agregar o quitar la arista entre ellos. Pase el cursor sobre un nodo para resaltar su fila en la matriz y su lista.');

    let geo = null;
    function dibujarGrafo() {
      lienzo.limpiar();
      const vecinos = new Set();
      if (hover >= 0) for (const a of g.aristas) { if (a.u === hover) vecinos.add(a.v); if (!g.dirigido && a.v === hover) vecinos.add(a.u); }
      geo = G.dibujar(lienzo, g, {
        pesos: est.ponderado,
        nodo: (i) => (i === seleccion ? { relleno: C.s2, borde: C.s2, texto: '#fff' } : i === hover ? { relleno: C.s1, borde: C.s1, texto: '#fff' } : vecinos.has(i) ? { anillo: C.s1 } : {}),
        arista: (a) => (hover >= 0 && (a.u === hover || (!g.dirigido && a.v === hover)) ? { color: C.s1, ancho: 2.5 } : { color: C.apagado }),
      });
    }
    function dibujarMatriz() {
      const { ctx, ancho: W, alto: H } = matriz;
      matriz.limpiar();
      const n = g.nodos.length;
      const c = Math.min(34, (Math.min(W, H) - 30) / (n + 1));
      const ox = (W - c * (n + 1)) / 2, oy = 4;
      const M = g.nodos.map(() => new Array(n).fill(0));
      for (const a of g.aristas) { M[a.u][a.v] = est.ponderado ? a.w : 1; if (!g.dirigido) M[a.v][a.u] = est.ponderado ? a.w : 1; }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i === hover ? C.s1 : C.tinta2;
        ctx.font = VIZ.fuente(11, 600);
        ctx.fillText(g.nodos[i].etiqueta, ox + (i + 1.5) * c, oy + c / 2);
        ctx.fillText(g.nodos[i].etiqueta, ox + c / 2, oy + (i + 1.5) * c);
        for (let j = 0; j < n; j++) {
          const x = ox + (j + 1) * c, y = oy + (i + 1) * c;
          const enFila = i === hover, enCol = !g.dirigido && j === hover;
          ctx.fillStyle = M[i][j] ? (enFila || enCol ? C.s1 : VIZ.alfa(C.s1, 0.22)) : enFila || enCol ? C.neutro : C.superficie;
          ctx.fillRect(x, y, c, c);
          ctx.strokeStyle = C.rejilla;
          ctx.strokeRect(x + 0.5, y + 0.5, c - 1, c - 1);
          ctx.fillStyle = M[i][j] && (enFila || enCol) ? '#fff' : M[i][j] ? C.tinta : '#c3c2b7';
          ctx.font = VIZ.fuente(c > 24 ? 12 : 10, M[i][j] ? 600 : 400);
          ctx.fillText(String(M[i][j]), x + c / 2, y + c / 2 + 0.5);
        }
      }
      if (g.dirigido) {
        ctx.fillStyle = C.apagado;
        ctx.font = VIZ.fuente(10);
        ctx.textAlign = 'left';
        ctx.fillText('fila = origen, columna = destino', ox, oy + (n + 1) * c + 12);
      }
    }
    function todo() {
      const ady = G.adyacencia(g);
      dibujarGrafo();
      dibujarMatriz();
      listas.replaceChildren(...g.nodos.map((nd, i) => el('div', { style: { background: i === hover ? 'rgba(42,120,214,0.12)' : 'transparent', padding: '0 4px' } },
        el('b', null, nd.etiqueta), ' → ',
        ady[i].length ? ady[i].map((x) => g.nodos[x.v].etiqueta + (est.ponderado ? `(${x.w})` : '')).join(' → ') : '∅')));
      const n = g.nodos.length, m = g.aristas.length;
      const max = g.dirigido ? n * (n - 1) : (n * (n - 1)) / 2;
      const grados = g.nodos.map((_, i) => ady[i].length);
      lectura.set([
        ['|V|', String(n)], ['|E|', String(m)], ['densidad |E| / máx', (m / max).toFixed(2)],
        [g.dirigido ? 'Σ grados de salida' : 'Σ grados = 2|E|', String(grados.reduce((s, x) => s + x, 0))],
        ['celdas de la matriz', String(n * n)], ['entradas de las listas', String(g.dirigido ? m : 2 * m)],
      ]);
    }
    lienzo.alDibujar = () => g && dibujarGrafo();
    matriz.alDibujar = () => g && dibujarMatriz();

    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      lienzo.canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
      if (i !== hover) { hover = i; todo(); }
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; todo(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i < 0) { seleccion = -1; return todo(); }
      if (seleccion < 0) { seleccion = i; return todo(); }
      if (seleccion !== i) {
        const k = g.aristas.findIndex((a) => (a.u === seleccion && a.v === i) || (!g.dirigido && a.u === i && a.v === seleccion));
        if (k >= 0) g.aristas.splice(k, 1);
        else g.aristas.push({ u: seleccion, v: i, w: 1 + Math.floor(Math.random() * 9) });
      }
      seleccion = -1;
      todo();
    });
    nuevo();
  }

  VIZ.registrarTema('graphs', {
    intro: String.raw`
      <p>Un <strong>grafo</strong> \(G = (V, E)\) es un conjunto de <em>vértices</em> unidos por <em>aristas</em>. Modela cualquier relación
      entre pares de objetos: calles entre intersecciones, enlaces entre páginas web, dependencias entre tareas, amistades en una red
      social o estados de un juego. Muchos problemas de computación se resuelven traduciéndolos a una pregunta sobre un grafo.</p>
      <p>Para trabajar con un grafo en un programa hay que decidir cómo representarlo. Las dos representaciones clásicas, la
      <strong>matriz</strong> y las <strong>listas de adyacencia</strong>, ofrecen costos muy distintos según la operación y la densidad del grafo.</p>`,
    visualizaciones: [
      {
        titulo: 'Un grafo y sus dos representaciones',
        descripcion: 'El mismo grafo dibujado, como matriz de adyacencia y como listas de adyacencia. Edítelo y observe cómo cambian ambas.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <ul>
        <li><strong>No dirigido:</strong> las aristas son pares no ordenados \(\{u, v\}\). <strong>Dirigido:</strong> pares ordenados \((u, v)\), de \(u\) hacia \(v\).</li>
        <li><strong>Ponderado:</strong> cada arista tiene un peso \(w(u,v) \in \mathbb{R}\) (distancia, costo, capacidad…).</li>
        <li><strong>Grado</strong> \(\deg(v)\): número de aristas incidentes. En dirigidos se distinguen grado de entrada y de salida.</li>
        <li><strong>Camino:</strong> secuencia de vértices consecutivamente adyacentes. <strong>Ciclo:</strong> camino que vuelve a su inicio.</li>
        <li><strong>Conexo:</strong> existe un camino entre todo par de vértices. Un <strong>árbol</strong> es un grafo conexo sin ciclos; tiene
        exactamente \(|V| - 1\) aristas.</li>
      </ul>
      <p><strong>Lema del apretón de manos.</strong> En un grafo no dirigido, cada arista aporta 2 a la suma de grados:</p>
      \[ \sum_{v \in V} \deg(v) = 2|E|. \]
      <p>Como consecuencia, el número de vértices de grado impar es par. Un grafo simple tiene a lo más \(\binom{|V|}{2}\) aristas, así que
      \(|E| = O(|V|^2)\). Se dice <em>denso</em> si \(|E| = \Theta(|V|^2)\) y <em>disperso</em> si \(|E| = O(|V|)\); la mayoría de los grafos reales son dispersos.</p>

      <h2>Representaciones</h2>
      <p>La <strong>matriz de adyacencia</strong> \(A\) es de \(|V| \times |V|\) con \(A_{uv} = 1\) (o \(w(u,v)\)) si hay arista y 0 si no. Las
      <strong>listas de adyacencia</strong> guardan, para cada vértice, la lista de sus vecinos.</p>
      <table>
        <thead><tr><th>Operación</th><th>Matriz</th><th>Listas</th></tr></thead>
        <tbody>
          <tr><td>Memoria</td><td>\(\Theta(|V|^2)\)</td><td>\(\Theta(|V| + |E|)\)</td></tr>
          <tr><td>¿Existe la arista \((u, v)\)?</td><td>\(O(1)\)</td><td>\(O(\deg(u))\)</td></tr>
          <tr><td>Recorrer los vecinos de \(u\)</td><td>\(\Theta(|V|)\)</td><td>\(\Theta(\deg(u))\)</td></tr>
          <tr><td>Recorrer todas las aristas</td><td>\(\Theta(|V|^2)\)</td><td>\(\Theta(|V| + |E|)\)</td></tr>
          <tr><td>Agregar una arista</td><td>\(O(1)\)</td><td>\(O(1)\)</td></tr>
        </tbody>
      </table>
      <p>Los algoritmos de recorrido (<a href="tema.html?id=dfs">DFS</a>, <a href="tema.html?id=bfs-dijkstra">BFS</a>) visitan los vecinos de cada vértice
      una vez; con listas cuestan \(\Theta(|V| + |E|)\), mientras que con matriz cuestan \(\Theta(|V|^2)\). Por eso las listas son la
      representación por defecto, y la matriz se prefiere para grafos densos o cuando se consulta mucho la existencia de aristas.</p>

      <h2>Álgebra de la matriz</h2>
      <p>La matriz tiene una propiedad notable: la entrada \((u, v)\) de \(A^k\) cuenta los caminos de exactamente \(k\) aristas de \(u\) a \(v\),
      porque \((A^k)_{uv} = \sum_{w} (A^{k-1})_{uw} A_{wv}\). En grafos no dirigidos \(A\) es simétrica, y sus valores propios (el
      <em>espectro</em> del grafo) revelan propiedades como la conectividad o la presencia de grupos.</p>`,
  });
})();
