(function () {
  'use strict';
  const { el, color: C } = VIZ;
  const G = VIZ.grafo;

  function montar(cuerpo) {
    const est = { n: 7, grado: 2.6, semilla: 3 };
    let g, s, origen = 0, temprano = true;
    const L = (i) => g.nodos[i].etiqueta;

    const ctl = VIZ.controles(cuerpo);
    G.controlesGrafo(ctl, est, () => nuevo(), { nMin: 4, nMax: 10 });
    ctl.casilla({ etiqueta: 'terminar si una pasada no cambia nada', valor: temprano, alCambiar: (v) => { temprano = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevo grafo', () => { est.semilla++; nuevo(); });
    ctl.boton('Agregar un ciclo negativo', () => { agregarCicloNegativo(); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMax: 440 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'arista que se relaja', forma: 'linea' },
      { color: C.s1, texto: 'mejor arista de llegada', forma: 'linea' },
      { color: C.s8, texto: 'peso negativo / ciclo negativo', forma: 'linea' },
      { color: C.superficie, borde: C.s2, texto: 'distancia recién mejorada', forma: 'punto' },
    ]);
    const tira = G.estructura(cuerpo, 'Orden de las aristas:');
    const registro = VIZ.nota(cuerpo, '');
    const tablaCaja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(tablaCaja);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un vértice para usarlo como origen. La tabla muestra d[v] al final de cada pasada.');

    function nuevo() {
      g = G.generar({ n: est.n, grado: est.grado, dirigido: true, orientacion: 'desde0', negativos: true, semilla: est.semilla });
      origen = 0;
      rep.reiniciar();
    }
    function agregarCicloNegativo() {
      // Agrega la arista inversa de una arista (u, v) con peso suficientemente negativo: u → v → u queda negativo.
      const alcanzable = new Set([origen]);
      for (let cambio = true; cambio;) {
        cambio = false;
        for (const a of g.aristas) if (alcanzable.has(a.u) && !alcanzable.has(a.v)) { alcanzable.add(a.v); cambio = true; }
      }
      const candidatas = g.aristas.filter((a) => alcanzable.has(a.u) && !g.aristas.some((b) => b.u === a.v && b.v === a.u));
      if (!candidatas.length) return;
      const a = candidatas[Math.floor(Math.random() * candidatas.length)];
      g.aristas.push({ u: a.v, v: a.u, w: -(a.w + 2) });
    }

    function iniciar() {
      const n = g.nodos.length;
      s = {
        dist: new Array(n).fill(Infinity), padre: new Array(n).fill(-1), padreArista: new Array(n).fill(-1),
        pasada: 0, arista: -1, mejorado: -1, historia: [], cambios: 0, relajaciones: 0, ciclo: null, mensaje: '',
      };
      s.dist[origen] = 0;
      s.historia.push(s.dist.slice());
      s.mensaje = `d[${L(origen)}] = 0; las demás distancias son ∞. Se harán hasta |V| − 1 = ${n - 1} pasadas sobre todas las aristas.`;
      return (function* () {
        for (let p = 1; p < n; p++) {
          s.pasada = p;
          let cambio = false;
          for (let e = 0; e < g.aristas.length; e++) {
            const { u, v, w } = g.aristas[e];
            s.arista = e; s.mejorado = -1; s.relajaciones++;
            if (s.dist[u] !== Infinity && s.dist[u] + w < s.dist[v]) {
              const antes = s.dist[v];
              s.dist[v] = s.dist[u] + w; s.padre[v] = u; s.padreArista[v] = e; s.mejorado = v; cambio = true; s.cambios++;
              s.mensaje = `Pasada ${p}: (${L(u)}, ${L(v)}) mejora d[${L(v)}]: ${G.dist(s.dist[u])} + ${G.dist(w)} = ${G.dist(s.dist[v])} < ${G.dist(antes)}.`;
            } else {
              s.mensaje = `Pasada ${p}: (${L(u)}, ${L(v)}) no mejora${s.dist[u] === Infinity ? ` (d[${L(u)}] = ∞)` : ''}.`;
            }
            yield;
          }
          s.historia.push(s.dist.slice());
          s.arista = -1; s.mejorado = -1;
          if (!cambio && temprano) {
            s.mensaje = `La pasada ${p} no cambió ninguna distancia: ya son definitivas y no hay ciclos negativos alcanzables.`;
            yield;
            return;
          }
        }
        // Pasada de verificación.
        s.pasada = n;
        for (let e = 0; e < g.aristas.length; e++) {
          const { u, v, w } = g.aristas[e];
          s.arista = e;
          if (s.dist[u] !== Infinity && s.dist[u] + w < s.dist[v]) {
            // Retroceder |V| veces asegura caer dentro del ciclo.
            s.padre[v] = u; s.padreArista[v] = e;
            let x = v;
            for (let k = 0; k < n; k++) x = s.padre[x];
            const ciclo = new Set();
            let y = x;
            do { ciclo.add(s.padreArista[y]); y = s.padre[y]; } while (y !== x && ciclo.size <= n);
            s.ciclo = ciclo;
            s.mensaje = `Verificación: (${L(u)}, ${L(v)}) todavía mejora tras |V| − 1 pasadas → hay un ciclo de peso negativo (en rojo). Las distancias no están definidas.`;
            yield;
            return;
          }
          s.mensaje = `Verificación: ninguna arista puede mejorar todavía… (${L(u)}, ${L(v)})`;
          yield;
        }
        s.arista = -1;
        s.mensaje = 'Ninguna arista mejora en la pasada de verificación: no hay ciclos negativos y las distancias son correctas.';
      })();
    }

    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      geo = G.dibujar(lienzo, g, {
        pesos: true,
        nodo: (i) => (i === origen ? { relleno: C.tinta, borde: C.tinta, texto: C.sobre, anillo: i === s.mejorado ? C.s2 : null } : { anillo: i === s.mejorado ? C.s2 : null }),
        arista: (a, e) => {
          if (s.ciclo && s.ciclo.has(e)) return { color: C.s8, ancho: 4 };
          if (e === s.arista) return { color: C.s2, ancho: 3.5 };
          if (s.padreArista.includes(e)) return { color: C.s1, ancho: 2.5 };
          return { color: C.eje };
        },
        debajo: (i) => G.dist(s.dist[i]),
        colorDebajo: (i) => (i === s.mejorado ? C.s2 : C.tinta),
      });
      tira.set(g.aristas.map((a, e) => ({ texto: `${L(a.u)}→${L(a.v)}`, fondo: e === s.arista ? C.s2 : C.sobre, tinta: e === s.arista ? C.sobre : a.w < 0 ? C.s8 : C.tinta, color: e === s.arista ? C.s2 : C.eje })));
      registro.textContent = s.mensaje;
      // Tabla de distancias por pasada.
      const n = g.nodos.length;
      const filas = s.historia.map((d, p) => el('tr', null, el('td', { class: 'izq' }, p === 0 ? 'inicio' : `pasada ${p}`),
        ...d.map((x, i) => {
          const cambio = p > 0 && x !== s.historia[p - 1][i];
          return el('td', { style: cambio ? { color: C.s2, fontWeight: '700' } : null }, G.dist(x));
        })));
      tablaCaja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th'), ...g.nodos.map((nd) => el('th', null, nd.etiqueta))),
        ...filas));
      lectura.set([
        ['pasada', s.pasada ? (s.pasada >= n ? 'verificación' : `${s.pasada} de ${n - 1}`) : '—'],
        ['relajaciones', String(s.relajaciones)], ['mejoras', String(s.cambios)],
        ['|V|·|E|', String(n * g.aristas.length)],
        ['ciclo negativo', s.ciclo ? 'sí' : rep.terminado ? 'no' : '—'],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = G.nodoEn(geo, x, y);
      if (i >= 0) { origen = i; rep.reiniciar(); }
    });
    nuevo();
  }

  VIZ.registrarTema('bellman-ford', {
    intro: String.raw`
      <p>El algoritmo de <strong>Bellman-Ford</strong> calcula caminos más cortos desde un origen en grafos dirigidos que pueden tener
      <strong>pesos negativos</strong>, donde Dijkstra falla. Pesos negativos aparecen, por ejemplo, al modelar ganancias además de costos,
      o en arbitraje de divisas (usando \(-\log\) de las tasas de cambio).</p>
      <p>Su idea es simple y robusta: relajar <em>todas</em> las aristas, una y otra vez, \(|V|-1\) veces. Además, detecta si existe un
      <strong>ciclo de peso negativo</strong>, en cuyo caso los caminos más cortos no están definidos.</p>`,
    visualizaciones: [
      {
        titulo: 'Bellman-Ford pasada a pasada',
        descripcion: 'En cada pasada se recorren las aristas en el orden indicado y se intenta mejorar la distancia de su destino. Use «Agregar un ciclo negativo» para ver la detección.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>Bellman-Ford(G, w, s):
    d[v] ← ∞ para todo v;  d[s] ← 0
    repetir |V| − 1 veces:
        para cada arista (u, v):
            si d[u] + w(u, v) &lt; d[v]:  d[v] ← d[u] + w(u, v);  π[v] ← u
    para cada arista (u, v):
        si d[u] + w(u, v) &lt; d[v]:  devolver «hay un ciclo negativo»
    devolver d</code></pre>
      <p>Costo \(\Theta(|V|\cdot|E|)\): más lento que Dijkstra, \(O((|V|+|E|)\log|V|)\), pero sin restricciones de signo.</p>

      <h2>Por qué bastan \(|V| - 1\) pasadas</h2>
      <p>Si no hay ciclos negativos alcanzables, existe un camino más corto <em>simple</em> \(s = v_0, v_1, \dots, v_k = v\) con \(k \le |V| - 1\)
      aristas. <strong>Lema:</strong> tras la pasada \(i\), \(d[v_i] = \delta(s, v_i)\). Por inducción: tras la pasada \(i-1\), \(d[v_{i-1}]\) ya es
      correcto, y en la pasada \(i\) se relaja \((v_{i-1}, v_i)\), con lo que</p>
      \[ d[v_i] \le d[v_{i-1}] + w(v_{i-1}, v_i) = \delta(s, v_{i-1}) + w(v_{i-1}, v_i) = \delta(s, v_i). \]
      <p>Como siempre se cumple \(d[v] \ge \delta(s, v)\), la igualdad queda establecida. Tras \(|V| - 1\) pasadas, todos los vértices
      alcanzables tienen su distancia correcta. Si una pasada completa no cambia nada, ninguna posterior lo hará, y se puede terminar antes.</p>

      <h2>Detección de ciclos negativos</h2>
      <p>Si existe un ciclo \(c = (v_0, \dots, v_k = v_0)\) alcanzable con \(\sum w(v_{i-1}, v_i) &lt; 0\), alguna arista del ciclo sigue relajándose
      para siempre. En efecto, si ninguna pudiera relajarse, \(d[v_i] \le d[v_{i-1}] + w(v_{i-1}, v_i)\) para todo \(i\); sumando sobre el ciclo,
      los \(d\) se cancelan y queda \(0 \le \sum w\), una contradicción. Por eso, si tras \(|V| - 1\) pasadas aún hay una arista que mejora,
      hay un ciclo negativo. Siguiendo los punteros \(\pi\) desde ese vértice \(|V|\) veces se llega a un vértice del ciclo y se puede reconstruir.</p>

      <h2>Relación con programación dinámica</h2>
      <p>Sea \(d_k(v)\) el costo mínimo de un camino de \(s\) a \(v\) con a lo más \(k\) aristas. Entonces</p>
      \[ d_k(v) = \min\Big(d_{k-1}(v),\; \min_{(u,v) \in E} \big(d_{k-1}(u) + w(u,v)\big)\Big), \]
      <p>y Bellman-Ford calcula \(d_{|V|-1}\). Es un ejemplo clásico de <a href="tema.html?id=dynamic-programming">programación dinámica</a>
      (Bellman inventó el término). La misma idea, ejecutada de forma distribuida, es la base de protocolos de enrutamiento por
      vector de distancias como RIP.</p>`,
  });
})();
