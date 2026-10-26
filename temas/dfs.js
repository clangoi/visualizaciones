(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const G = VIZ.grafo;

  const TIPOS = {
    arbol: { nombre: 'de árbol', color: C.s1, ancho: 3 },
    retorno: { nombre: 'de retorno', color: C.s8, ancho: 2, guiones: [6, 4] },
    avance: { nombre: 'de avance', color: C.s7, ancho: 2, guiones: [2, 3] },
    cruce: { nombre: 'de cruce', color: C.s3, ancho: 2, guiones: [8, 3, 2, 3] },
  };

  /* Estado y generador de un DFS completo (bosque), empezando en `inicio`. */
  function crearDFS(g, inicio) {
    const n = g.nodos.length, ady = G.adyacencia(g);
    const s = {
      color: new Array(n).fill(0), d: new Array(n).fill(0), f: new Array(n).fill(0),
      tipo: new Array(g.aristas.length).fill(null), pila: [], t: 0, orden: [], actual: -1, aristaActual: -1, mensaje: '',
    };
    const L = (i) => g.nodos[i].etiqueta;
    function* visitar(u, eppadre) {
      s.color[u] = 1; s.d[u] = ++s.t; s.pila.push(u); s.actual = u; s.aristaActual = -1;
      s.mensaje = `Se descubre ${L(u)} en el tiempo ${s.t} (pasa a gris y entra a la pila).`;
      yield;
      for (const { v, e } of ady[u]) {
        if (!g.dirigido && e === eppadre) continue;
        if (s.tipo[e]) continue;
        s.actual = u; s.aristaActual = e;
        if (s.color[v] === 0) {
          s.tipo[e] = 'arbol';
          s.mensaje = `${L(u)} → ${L(v)}: ${L(v)} es blanco, se explora (arista de árbol).`;
          yield;
          yield* visitar(v, e);
          s.actual = u; s.aristaActual = -1;
        } else {
          if (s.color[v] === 1) s.tipo[e] = 'retorno';
          else s.tipo[e] = s.d[u] < s.d[v] ? 'avance' : 'cruce';
          const por = { retorno: `${L(v)} está gris (en la pila): arista de retorno, hay un ciclo`, avance: `${L(v)} es negro y descendiente de ${L(u)}: arista de avance`, cruce: `${L(v)} es negro y ya terminó en otra rama: arista de cruce` }[s.tipo[e]];
          s.mensaje = `${L(u)} → ${L(v)}: ${por}.`;
          yield;
        }
      }
      s.color[u] = 2; s.f[u] = ++s.t; s.pila.pop(); s.orden.unshift(u); s.aristaActual = -1;
      s.mensaje = `${L(u)} no tiene más vecinos por explorar: termina en el tiempo ${s.t} (pasa a negro).`;
      yield;
    }
    s.gen = (function* () {
      yield* visitar(inicio, -1);
      for (let i = 0; i < n; i++) if (!s.color[i]) {
        s.mensaje = `Quedan vértices blancos: se inicia un nuevo árbol del bosque en ${L(i)}.`;
        yield;
        yield* visitar(i, -1);
      }
      s.actual = -1;
      s.mensaje = 'DFS terminado: todos los vértices son negros.';
    })();
    return s;
  }

  function estiloNodo(s, i) {
    if (s.color[i] === 1) return { relleno: C.s4, borde: C.tinta, anillo: i === s.actual ? C.s2 : null };
    if (s.color[i] === 2) return { relleno: C.tinta, borde: C.tinta, texto: C.sobre };
    return {};
  }
  function estiloArista(s, e) {
    if (e === s.aristaActual) return { color: C.s2, ancho: 3.5 };
    const t = s.tipo[e];
    return t ? TIPOS[t] : { color: C.eje };
  }

  /* ---------- Fig. 1: DFS con tiempos y clasificación ---------- */

  function montarDFS(cuerpo) {
    const est = { n: 9, grado: 2.6, dirigido: true, semilla: 5 };
    let g, s, inicio = 0;
    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, () => nuevo());
    ctl.casilla({ etiqueta: 'dirigido', valor: est.dirigido, alCambiar: (v) => { est.dirigido = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevo grafo', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.52, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta, texto: 'blanco: sin descubrir', forma: 'punto' },
      { color: C.s4, texto: 'gris: en la pila', forma: 'punto' },
      { color: C.tinta, texto: 'negro: terminado', forma: 'punto' },
      ...Object.values(TIPOS).map((t) => ({ color: t.color, texto: `arista ${t.nombre}`, forma: 'linea' })),
      { color: C.s2, texto: 'arista que se examina', forma: 'linea' },
    ]);
    const pila = G.estructura(cuerpo, 'Pila de recursión (fondo → tope):');
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Bajo cada vértice se muestra «descubrimiento / término». Haga clic en un vértice para iniciar el DFS desde él.');

    function nuevo() { g = G.generar({ n: est.n, grado: est.grado, dirigido: est.dirigido, semilla: est.semilla }); inicio = 0; rep.reiniciar(); }
    function iniciar() { s = crearDFS(g, inicio); s.mensaje = `Presione «Reproducir» o «Un paso» para recorrer desde ${g.nodos[inicio].etiqueta}.`; return s.gen; }
    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      geo = G.dibujar(lienzo, g, {
        nodo: (i) => ({ ...estiloNodo(s, i), anillo: i === s.actual ? C.s2 : i === inicio && !s.t ? C.s6 : null }),
        arista: (a, e) => estiloArista(s, e),
        debajo: (i) => (s.d[i] ? `${s.d[i]}/${s.f[i] || '·'}` : ''),
      });
      pila.set(s.pila.map((u) => ({ texto: g.nodos[u].etiqueta, fondo: C.s4 })));
      registro.textContent = s.mensaje;
      const cuenta = (t) => s.tipo.filter((x) => x === t).length;
      lectura.set([
        ['tiempo', String(s.t)],
        ['de árbol', String(cuenta('arbol'))], ['de retorno', String(cuenta('retorno'))],
        ...(g.dirigido ? [['de avance', String(cuenta('avance'))], ['de cruce', String(cuenta('cruce'))]] : []),
        ['¿tiene ciclos?', rep.terminado ? (cuenta('retorno') ? 'sí' : 'no') : '—'],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i >= 0) { inicio = i; rep.reiniciar(); }
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); lienzo.canvas.style.cursor = G.nodoEn(geo, x, y) >= 0 ? 'pointer' : 'default'; });
    nuevo();
  }

  /* ---------- Fig. 2: orden topológico ---------- */

  function montarTopologico(cuerpo) {
    const est = { n: 9, grado: 2.4, semilla: 8 };
    let g, s;
    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, () => nuevo());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevo DAG', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMax: 400 });
    VIZ.subtitulo(cuerpo, 'Orden topológico (vértices por tiempo de término decreciente)');
    const lineal = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'en la pila', forma: 'punto' },
      { color: C.tinta, texto: 'terminado', forma: 'punto' },
      { color: C.s1, texto: 'arista hacia la derecha (respeta el orden)', forma: 'linea' },
      { color: C.s2, texto: 'arista que se examina', forma: 'linea' },
    ]);
    const registro = VIZ.nota(cuerpo, '');

    function nuevo() { g = G.generar({ n: est.n, grado: est.grado, dirigido: true, orientacion: 'dag', semilla: est.semilla }); rep.reiniciar(); }
    function iniciar() { s = crearDFS(g, 0); s.mensaje = 'Cada vértice se agrega al inicio de la lista cuando termina.'; return s.gen; }
    function dibujar() {
      lienzo.limpiar();
      G.dibujar(lienzo, g, {
        nodo: (i) => ({ ...estiloNodo(s, i), anillo: i === s.actual ? C.s2 : null }),
        arista: (a, e) => (e === s.aristaActual ? { color: C.s2, ancho: 3 } : { color: C.apagado }),
        debajo: (i) => (s.d[i] ? `${s.d[i]}/${s.f[i] || '·'}` : ''),
      });
      // Orden lineal con arcos: en un orden topológico todos apuntan a la derecha.
      const { ctx, ancho: W, alto: H } = lineal;
      lineal.limpiar();
      const n = g.nodos.length, paso = (W - 40) / n, y = H - 30;
      const x = new Map();
      s.orden.forEach((u, k) => x.set(u, 20 + (n - s.orden.length + k + 0.5) * paso));
      for (const a of g.aristas) {
        if (!x.has(a.u) || !x.has(a.v)) continue;
        const x0 = x.get(a.u), x1 = x.get(a.v);
        const alto = Math.min(H - 50, Math.abs(x1 - x0) * 0.45);
        ctx.strokeStyle = x1 > x0 ? C.s1 : C.s8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y - 14);
        ctx.bezierCurveTo(x0, y - 14 - alto, x1, y - 14 - alto, x1, y - 16);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.moveTo(x1, y - 14); ctx.lineTo(x1 - 4, y - 22); ctx.lineTo(x1 + 4, y - 22); ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [u, xx] of x) {
        ctx.beginPath(); ctx.arc(xx, y, 13, 0, Math.PI * 2);
        ctx.fillStyle = C.tinta; ctx.fill();
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(12, 600);
        ctx.fillText(g.nodos[u].etiqueta, xx, y + 0.5);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10);
        ctx.fillText(`f=${s.f[u]}`, xx, y + 22);
      }
      if (!s.orden.length) {
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(12);
        ctx.fillText('(vacío: aún no termina ningún vértice)', W / 2, y);
      }
      registro.textContent = rep.terminado ? 'Listo: todas las aristas apuntan hacia la derecha. Ejecutar las tareas en este orden respeta todas las dependencias.' : s.mensaje;
    }
    lienzo.alDibujar = () => s && dibujar();
    lineal.alDibujar = () => s && dibujar();
    nuevo();
  }

  VIZ.registrarTema('dfs', {
    intro: String.raw`
      <p>La <strong>búsqueda en profundidad</strong> (DFS, <em>depth-first search</em>) explora un grafo avanzando siempre tan lejos como
      puede: desde el vértice actual va a un vecino no visitado, y desde ahí a otro, y solo retrocede cuando se queda sin opciones.
      Es la forma natural de recorrer un laberinto con la mano apoyada en la pared.</p>
      <p>Más allá de visitar todos los vértices, los <strong>tiempos</strong> en que DFS descubre y termina cada vértice, y el tipo de cada
      arista que encuentra, revelan la estructura del grafo: ciclos, orden topológico, componentes fuertemente conexas, puentes y
      puntos de articulación.</p>`,
    visualizaciones: [
      {
        titulo: 'DFS paso a paso',
        descripcion: 'Cada vértice pasa de blanco a gris al ser descubierto y a negro al terminar. Las aristas se clasifican según el color del vértice al que llegan.',
        montar: montarDFS,
      },
      {
        titulo: 'Orden topológico con DFS',
        descripcion: 'En un grafo dirigido acíclico (DAG), listar los vértices por tiempo de término decreciente da un orden en que toda arista va de izquierda a derecha.',
        montar: montarTopologico,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>DFS-visitar(u):
    color[u] ← gris;  t ← t + 1;  d[u] ← t
    para cada v en ady[u]:
        si color[v] = blanco:
            π[v] ← u;  DFS-visitar(v)
    color[u] ← negro;  t ← t + 1;  f[u] ← t

DFS(G):  para cada u en V: si color[u] = blanco: DFS-visitar(u)</code></pre>
      <p>Cada vértice se visita una vez y cada lista de adyacencia se recorre una vez: con listas de adyacencia el costo es
      \(\Theta(|V| + |E|)\). La recursión puede reemplazarse por una pila explícita.</p>

      <h2>Teorema del paréntesis</h2>
      <p>Para dos vértices \(u, v\), los intervalos \([d[u], f[u]]\) y \([d[v], f[v]]\) son disjuntos o uno está contenido en el otro;
      el segundo caso ocurre exactamente cuando uno es descendiente del otro en el bosque DFS. Si se escribe «(u» al descubrir y
      «u)» al terminar, se obtiene una expresión con paréntesis bien balanceados.</p>
      <p><strong>Teorema del camino blanco:</strong> \(v\) es descendiente de \(u\) si y solo si, en el tiempo \(d[u]\), existe un camino de
      \(u\) a \(v\) formado solo por vértices blancos.</p>

      <h2>Clasificación de aristas</h2>
      <p>Al examinar la arista \((u, v)\), el color de \(v\) la clasifica:</p>
      <table>
        <thead><tr><th>Color de \(v\)</th><th>Tipo</th><th>Significado</th></tr></thead>
        <tbody>
          <tr><td>blanco</td><td>de árbol</td><td>\(v\) se descubre desde \(u\)</td></tr>
          <tr><td>gris</td><td>de retorno</td><td>\(v\) es ancestro de \(u\): cierra un ciclo</td></tr>
          <tr><td>negro, \(d[u] &lt; d[v]\)</td><td>de avance</td><td>\(v\) es descendiente ya terminado</td></tr>
          <tr><td>negro, \(d[u] &gt; d[v]\)</td><td>de cruce</td><td>\(v\) está en otra rama u otro árbol</td></tr>
        </tbody>
      </table>
      <p>En un grafo <strong>no dirigido</strong> solo aparecen aristas de árbol y de retorno. En cualquier caso:</p>
      \[ G \text{ tiene un ciclo} \iff \text{DFS encuentra una arista de retorno}. \]

      <h2>Orden topológico</h2>
      <p>Un orden topológico de un DAG es una secuencia de sus vértices en la que toda arista \((u, v)\) tiene a \(u\) antes que a \(v\);
      existe si y solo si el grafo no tiene ciclos. Basta ordenar por \(f\) decreciente: si \((u,v)\) es una arista, \(v\) no puede ser gris
      cuando se examina (sería un ciclo), así que \(v\) es blanco —y termina dentro del intervalo de \(u\)— o ya es negro; en ambos casos
      \(f[v] &lt; f[u]\). El costo total es \(\Theta(|V| + |E|)\).</p>

      <h2>Otras aplicaciones</h2>
      <ul>
        <li><strong>Componentes fuertemente conexas</strong> (Kosaraju): DFS en \(G\), luego DFS en el grafo transpuesto procesando por \(f\) decreciente.</li>
        <li><strong>Puentes y puntos de articulación</strong> (Tarjan): comparando \(d[u]\) con el menor tiempo alcanzable desde el subárbol de \(u\).</li>
        <li><strong>Resolver laberintos y rompecabezas</strong>, y como esqueleto de <a href="tema.html?id=backtracking">backtracking</a>.</li>
      </ul>`,
  });
})();
