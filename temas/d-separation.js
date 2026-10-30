(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const G = M.dag([['A', 0.12, 0.1], ['B', 0.88, 0.1], ['C', 0.5, 0.32], ['D', 0.5, 0.62], ['E', 0.08, 0.6], ['F', 0.35, 0.95], ['G', 0.88, 0.62]],
    [[0, 2], [1, 2], [2, 3], [0, 4], [4, 5], [3, 5], [1, 6], [6, 5]]);
  const L = G.nodos.map((n) => n.etiqueta);
  function textoCamino(cam) {
    let t = L[cam[0]];
    for (let k = 1; k < cam.length; k++) t += (M.flecha(G, cam[k - 1], cam[k]) ? ' → ' : ' ← ') + L[cam[k]];
    return t;
  }

  /* ---------- Fig. 1: caminos abiertos y bloqueados ---------- */

  function montarCaminos(cuerpo) {
    let x = 4, y = 6, Z = new Set([3]);
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Ejemplo: collider abierto', () => { x = 0; y = 1; Z = new Set([3]); dibujar(); }, { primario: true });
    ctl.boton('Ejemplo: bloqueado', () => { x = 0; y = 1; Z = new Set(); dibujar(); });
    ctl.boton('Quitar condicionamiento', () => { Z = new Set(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 380 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'X', forma: 'punto' }, { color: C.s7, texto: 'Y', forma: 'punto' },
      { color: C.s4, texto: 'condicionado (en Z)', forma: 'punto' },
      { color: C.s2, texto: 'camino abierto', forma: 'linea' },
      { color: C.s8, texto: 'nodo que bloquea un camino', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un nodo para cambiar su papel: X → Y → condicionado → ninguno. Se listan todos los caminos entre X e Y (ignorando la dirección de las flechas) y si quedan abiertos o bloqueados.');
    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      const cams = x >= 0 && y >= 0 ? M.caminos(G, x, y) : [];
      const res = cams.map((c) => ({ c, b: M.bloqueo(G, c, [...Z]) }));
      const abiertas = new Set(), bloq = new Set();
      res.forEach(({ c, b }) => { if (!b.bloqueado) for (let k = 1; k < c.length; k++) abiertas.add(`${Math.min(c[k - 1], c[k])},${Math.max(c[k - 1], c[k])}`); else bloq.add(b.en); });
      geo = VIZ.grafo.dibujar(lienzo, G, {
        nodo: (i) => (i === x ? { relleno: C.s1, borde: C.s1, texto: C.sobre } : i === y ? { relleno: C.s7, borde: C.s7, texto: C.sobre } : Z.has(i) ? { relleno: C.s4, borde: C.s4, anillo: bloq.has(i) ? C.s8 : null } : { anillo: bloq.has(i) ? C.s8 : null }),
        arista: (a) => (abiertas.has(`${Math.min(a.u, a.v)},${Math.max(a.u, a.v)}`) ? { color: C.s2, ancho: 3.5 } : { color: C.apagado, ancho: 1.5 }),
      });
      lista.replaceChildren(...(res.length ? res.map(({ c, b }) => VIZ.el('div', null,
        VIZ.el('span', { style: { color: b.bloqueado ? C.apagado : C.s2, fontWeight: b.bloqueado ? null : '600' } }, textoCamino(c)),
        `   ${b.bloqueado ? `bloqueado en ${L[b.en]} (${b.colisionador ? 'collider sin condicionar' : 'no collider condicionado'})` : 'abierto'}`))
        : [VIZ.el('div', null, 'Elija X e Y haciendo clic en dos nodos.')]));
      const sep = res.length && res.every((r) => r.b.bloqueado);
      registro.textContent = x < 0 || y < 0 ? 'Falta elegir X e Y.' : sep
        ? `${L[x]} y ${L[y]} están d-separados por {${[...Z].map((i) => L[i]).join(', ')}}: el grafo implica ${L[x]} ⫫ ${L[y]} | Z.`
        : `${L[x]} y ${L[y]} están d-conectados dado {${[...Z].map((i) => L[i]).join(', ')}}: hay ${res.filter((r) => !r.b.bloqueado).length} camino(s) abierto(s).`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => {
      const { x: px, y: py } = lienzo.posicion(e), i = VIZ.grafo.nodoEn(geo, px, py);
      if (i < 0) return;
      // Ciclo de papeles: ninguno → X → Y → condicionado → ninguno.
      if (i === x) { x = -1; y = i; Z.delete(i); }
      else if (i === y) { y = -1; Z.add(i); }
      else if (Z.has(i)) Z.delete(i);
      else x = i;
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: comprobarlo con datos ---------- */

  function montarDatos(cuerpo) {
    let Z = { 3: true }, n = 3000, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(L.map((t, i) => ({ clave: i, texto: `condicionar en ${t}`, activo: !!Z[i] })), (e) => { Z = e; dibujar(); });
    ctl.boton('Nuevos datos', () => { semilla++; dibujar(); }, { primario: true });
    const tabla = M.tabla(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    cuerpo.dataset.sinLeyenda = 'solo tabla';
    VIZ.nota(cuerpo, `Datos lineales gaussianos generados con el grafo de arriba (n = ${n}). Para cada par fuera de Z: el veredicto de d-separación y la correlación parcial observada dado Z. Los pares d-separados deberían tener correlación parcial cercana a 0; los d-conectados, en general, no.`);
    function dibujar() {
      const coef = Object.fromEntries(G.aristas.map((a, i) => [`${a.u},${a.v}`, [0.9, 0.8, 1, 0.7, 0.9, 0.8, 1, -0.8][i]]));
      const D = M.simularSCM(G, coef, n, semilla), zs = L.map((_, i) => i).filter((i) => Z[i]);
      const filas = [];
      let acuerdo = 0, total = 0;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        if (Z[i] || Z[j]) continue;
        const sep = M.dsep(G, i, j, zs), pc = M.correlacionParcial(D, i, j, zs), cero = Math.abs(pc) < 2.5 / Math.sqrt(n);
        total++; if (sep === cero) acuerdo++;
        filas.push([{ texto: `${L[i]}, ${L[j]}`, clase: 'izq' }, sep ? 'd-separados' : 'd-conectados', VIZ.fmt(pc, 3), { texto: sep === cero ? '✓' : '✗', estilo: { color: sep === cero ? C.s6 : C.s8 } }]);
      }
      tabla.set([{ texto: 'par', clase: 'izq' }, 'grafo', 'correlación parcial', 'coinciden'], filas);
      lectura.set([
        ['condicionando en', zs.length ? `{${zs.map((i) => L[i]).join(', ')}}` : '∅'],
        ['pares que coinciden', `${acuerdo} de ${total}`],
        ['umbral |r| ≈ 2,5/√n', VIZ.fmt(2.5 / Math.sqrt(n), 3)],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('d-separation', {
    intro: String.raw`
      <p>La <strong>d-separación</strong> es la regla para leer en un grafo causal qué independencias condicionales deben cumplir los datos.
      Dos variables están d-separadas por un conjunto \(Z\) si <strong>todos</strong> los caminos entre ellas están bloqueados; si queda uno
      abierto, están d-conectadas y en general serán dependientes.</p>
      <p>Bloquear un camino se decide nodo por nodo con las reglas de <a href="tema.html?id=causal-structures">cadenas, forks y colliders</a>.
      Es la herramienta que usan los criterios de <a href="tema.html?id=backdoor-frontdoor">ajuste causal</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Caminos abiertos y bloqueados',
        descripcion: 'Elija X, Y y un conjunto Z en el grafo, y vea qué caminos quedan abiertos. Con X = A e Y = B, condicionar en D (descendiente del collider C) abre el camino A → C ← B.',
        montar: montarCaminos,
      },
      {
        titulo: 'Comprobarlo con datos',
        descripcion: 'El veredicto de la d-separación para todos los pares frente a la correlación parcial en datos simulados con ese grafo.',
        montar: montarDatos,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un camino \(p\) (secuencia de aristas sin importar su dirección, sin repetir nodos) está <strong>bloqueado</strong> por \(Z\) si contiene un nodo \(m\) tal que:</p>
      <ol>
        <li>\(m\) es una cadena (\(\to m \to\)) o un fork (\(\leftarrow m \to\)) y \(m \in Z\); o</li>
        <li>\(m\) es un collider (\(\to m \leftarrow\)) y ni \(m\) ni ninguno de sus descendientes está en \(Z\).</li>
      </ol>
      <p>\(X\) e \(Y\) están <strong>d-separados</strong> por \(Z\), \(X \perp_G Y \mid Z\), si todo camino entre ellos está bloqueado.</p>
      <h2>Garantías</h2>
      <div class="recuadro"><p><strong>Corrección:</strong> si \(P\) cumple la condición de Markov respecto de \(G\), entonces
      \(X \perp_G Y \mid Z \Rightarrow X \perp\!\!\!\perp Y \mid Z\) en \(P\).<br>
      <strong>Completitud:</strong> si \(X\) e \(Y\) no están d-separados, existe alguna distribución compatible con \(G\) en que son dependientes (y, bajo
      fidelidad, lo son).</p></div>
      <h2>Algoritmo</h2>
      <p>Enumerar caminos es exponencial. El algoritmo <em>Bayes-ball</em> (o la búsqueda de alcanzabilidad de Koller y Friedman) decide la
      d-separación en tiempo lineal en el tamaño del grafo, recorriendo los nodos con estados «llegué desde un hijo» o «llegué desde un padre».
      Una prueba equivalente: \(X \perp_G Y \mid Z\) si y solo si \(X\) e \(Y\) quedan desconectados en el grafo moral del conjunto ancestral de
      \(X \cup Y \cup Z\) tras quitar \(Z\).</p>
      <h2>Usos</h2>
      <ul>
        <li>Decidir qué variables controlar (<a href="tema.html?id=backdoor-frontdoor">back-door</a>) y cuáles no (colliders, mediadores).</li>
        <li>Contrastar un grafo con datos: cada d-separación implicada es una prueba de independencia condicional que se puede hacer.</li>
        <li>Inferencia en <a href="tema.html?id=bayesian-networks">redes bayesianas</a>: saber qué evidencia es irrelevante para una consulta.</li>
      </ul>`,
  });
})();