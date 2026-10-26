(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.grafo;

  function montar(cuerpo) {
    const est = { n: 10, grado: 3, semilla: 7 };
    let g, s;
    const L = (i) => g.nodos[i].etiqueta;
    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, () => nuevo());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevo grafo', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.52, altoMax: 460 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'arista del árbol', forma: 'linea' },
      { color: C.s2, texto: 'arista que se examina', forma: 'linea' },
      { color: C.s8, texto: 'rechazada (formaría un ciclo)', forma: 'linea' },
      { color: VIZ.series[2], texto: 'colores de nodo = componente actual', forma: 'punto' },
    ]);
    const tira = G.estructura(cuerpo, 'Aristas ordenadas por peso:');
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);

    function nuevo() { g = G.generar({ n: est.n, grado: est.grado, semilla: est.semilla, pesos: [1, 15] }); rep.reiniciar(); }

    function iniciar() {
      const n = g.nodos.length;
      const orden = g.aristas.map((_, e) => e).sort((a, b) => g.aristas[a].w - g.aristas[b].w || a - b);
      const padre = g.nodos.map((_, i) => i), rango = new Array(n).fill(0);
      const raiz = (x) => (padre[x] === x ? x : (padre[x] = raiz(padre[x])));
      s = { orden, estado: new Array(g.aristas.length).fill(null), actual: -1, peso: 0, aceptadas: 0, padre, colorDe: new Map(), mensaje: '', raiz };
      s.mensaje = `Se ordenan las ${g.aristas.length} aristas por peso. Cada vértice empieza como su propia componente.`;
      const libre = () => { const usados = new Set(s.colorDe.values()); for (let c = 0; ; c++) if (!usados.has(c)) return c; };
      return (function* () {
        for (const e of orden) {
          if (s.aceptadas === n - 1) break;
          const { u, v, w } = g.aristas[e];
          s.actual = e;
          const ru = raiz(u), rv = raiz(v);
          if (ru !== rv) {
            const cu = s.colorDe.get(ru), cv = s.colorDe.get(rv);
            let nueva, vieja;
            if (rango[ru] < rango[rv]) { padre[ru] = rv; nueva = rv; vieja = ru; }
            else { padre[rv] = ru; nueva = ru; vieja = rv; if (rango[ru] === rango[rv]) rango[ru]++; }
            s.colorDe.delete(vieja);
            s.colorDe.set(nueva, cu ?? cv ?? libre());
            s.estado[e] = 'aceptada'; s.peso += w; s.aceptadas++;
            s.mensaje = `${L(u)}–${L(v)} (peso ${w}) une dos componentes distintas: se acepta y las componentes se fusionan.`;
          } else {
            s.estado[e] = 'rechazada';
            s.mensaje = `${L(u)}–${L(v)} (peso ${w}): ambos extremos ya están en la misma componente, cerraría un ciclo → se descarta.`;
          }
          yield;
        }
        s.actual = -1;
        s.mensaje = s.aceptadas === n - 1
          ? `Se aceptaron |V| − 1 = ${n - 1} aristas: el árbol de expansión mínima pesa ${s.peso}.`
          : 'Se agotaron las aristas: el grafo no es conexo y el resultado es un bosque.';
      })();
    }

    function dibujar() {
      lienzo.limpiar();
      G.dibujar(lienzo, g, {
        pesos: true,
        colorPeso: (a, e) => (s.estado[e] === 'aceptada' ? C.s1 : s.estado[e] === 'rechazada' ? C.eje : C.tinta2),
        nodo: (i) => {
          const r = s.raiz(i), c = s.colorDe.get(r);
          return c != null ? { relleno: VIZ.series[c % 8], borde: C.tinta, texto: C.sobre } : {};
        },
        arista: (a, e) => {
          if (e === s.actual) return { color: C.s2, ancho: 4 };
          if (s.estado[e] === 'aceptada') return { color: C.s1, ancho: 3.5 };
          if (s.estado[e] === 'rechazada') return { color: VIZ.alfa(C.s8, 0.5), ancho: 1.5, guiones: [4, 4] };
          return { color: C.eje };
        },
      });
      tira.set(s.orden.map((e) => {
        const a = g.aristas[e], st = s.estado[e];
        return {
          texto: `${L(a.u)}${L(a.v)}:${a.w}${st === 'rechazada' ? ' ✗' : st === 'aceptada' ? ' ✓' : ''}`,
          fondo: e === s.actual ? C.s2 : st === 'aceptada' ? C.s1 : C.sobre,
          tinta: e === s.actual || st === 'aceptada' ? C.sobre : st === 'rechazada' ? C.inactivo : C.tinta,
          color: e === s.actual ? C.s2 : st === 'aceptada' ? C.s1 : C.eje,
        };
      }));
      registro.textContent = s.mensaje;
      const comps = new Set(g.nodos.map((_, i) => s.raiz(i))).size;
      lectura.set([
        ['aristas aceptadas', `${s.aceptadas} de ${g.nodos.length - 1}`],
        ['peso acumulado', String(s.peso)],
        ['componentes', String(comps)],
        ['padre (union-find)', s.padre.map((p, i) => `${L(i)}→${L(p)}`).filter((x, i) => s.padre[i] !== i).join(' ') || '—'],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    nuevo();
  }

  VIZ.registrarTema('kruskal', {
    intro: String.raw`
      <p>Dado un grafo no dirigido, conexo y con pesos, un <strong>árbol de expansión mínima</strong> (MST, <em>minimum spanning tree</em>) es
      un subconjunto de aristas que conecta todos los vértices, sin ciclos, con el menor peso total posible. Es el problema de unir
      ciudades con la menor cantidad de cable, o de diseñar una red con el menor costo.</p>
      <p>El <strong>algoritmo de Kruskal</strong> es <a href="tema.html?id=greedy">codicioso</a>: recorre las aristas de la más liviana a la más
      pesada y acepta cada una salvo que cierre un ciclo con las ya elegidas. Para detectar ciclos rápidamente usa una estructura
      <strong>union-find</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Kruskal paso a paso',
        descripcion: 'Los vértices del mismo color pertenecen a la misma componente del bosque que se va formando (los blancos aún están solos). Una arista se acepta si une dos componentes distintas.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Propiedad del corte</h2>
      <p>Un <strong>corte</strong> \((S, V \setminus S)\) es una partición de los vértices; una arista lo <em>cruza</em> si tiene un extremo en cada lado.</p>
      <div class="recuadro"><p><strong>Teorema.</strong> Sea \(A\) un conjunto de aristas contenido en algún MST y sea \((S, V\setminus S)\) un corte que
      ninguna arista de \(A\) cruza. Si \(e\) es una arista de peso mínimo que cruza el corte, entonces \(A \cup \{e\}\) también está contenido en
      algún MST.</p></div>
      <p><strong>Demostración</strong> (intercambio). Sea \(T\) un MST que contiene \(A\). Si \(e \in T\), listo. Si no, agregar \(e = (u,v)\) a \(T\)
      forma un ciclo, que debe cruzar el corte en otra arista \(e'\). Entonces \(T' = T - e' + e\) es un árbol de expansión con
      \(w(T') = w(T) - w(e') + w(e) \le w(T)\), así que \(T'\) también es mínimo y contiene \(A \cup \{e\}\).</p>
      <p>Kruskal es correcto porque cuando acepta \(e = (u, v)\), la componente de \(u\) define un corte que no cruza ninguna arista
      elegida, y \(e\) es la más liviana que lo cruza (las anteriores más livianas ya fueron procesadas).</p>

      <h2>Algoritmo</h2>
      <pre><code>Kruskal(G, w):
    A ← ∅;  crear un conjunto {v} por cada vértice
    para cada arista (u, v) en orden de peso creciente:
        si find(u) ≠ find(v):
            A ← A ∪ {(u, v)};  union(u, v)
    devolver A</code></pre>

      <h2>Union-find</h2>
      <p>Representa una partición como un bosque: cada conjunto es un árbol y su raíz es el representante. <code>find</code> sube hasta la raíz;
      <code>union</code> cuelga una raíz de la otra. Con dos heurísticas:</p>
      <ul>
        <li><strong>Unión por rango:</strong> se cuelga el árbol más bajo del más alto, lo que acota la altura por \(\log_2 n\).</li>
        <li><strong>Compresión de caminos:</strong> tras un <code>find</code>, todos los nodos visitados apuntan directo a la raíz.</li>
      </ul>
      <p>Juntas, \(m\) operaciones cuestan \(O(m\,\alpha(n))\), donde \(\alpha\) es la inversa de la función de Ackermann: \(\alpha(n) \le 4\) para
      cualquier \(n\) que quepa en el universo observable (Tarjan, 1975).</p>

      <h2>Costo</h2>
      \[ T = \underbrace{O(|E|\log|E|)}_{\text{ordenar}} + \underbrace{O(|E|\,\alpha(|V|))}_{\text{union-find}} = O(|E|\log|V|), \]
      <p>usando que \(\log|E| \le \log|V|^2 = 2\log|V|\). El ordenamiento domina; si los pesos son enteros pequeños, puede ordenarse en
      tiempo lineal. Si todos los pesos son distintos, el MST es único.</p>`,
  });
})();
