(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;

  /* Árbol de Narendra y Fukunaga: cada nivel quita una característica. Un nodo guarda las características que quedan (S),
     la que quitó y la lista de candidatas que puede pasar a sus hijos; así cada subconjunto final aparece una sola vez. */
  function construir(X, y, d, m, ordenar) {
    const R = d - m;
    let id = 0;
    function nodo(S, quitada, disponibles, nivel) {
      const n = { id: id++, S, quitada, nivel, J: P.fisher(X, y, S), hijos: [] };
      if (nivel === R) return n;
      let lista = disponibles.slice();
      if (ordenar) lista.sort((a, b) => P.fisher(X, y, S.filter((f) => f !== a)) - P.fisher(X, y, S.filter((f) => f !== b)));
      // El hijo i quita lista[i] y hereda las candidatas posteriores; necesita dejar suficientes para los niveles que faltan.
      for (let i = 0; i < lista.length; i++) {
        if (lista.length - i - 1 < R - nivel - 1) break;
        n.hijos.push(nodo(S.filter((f) => f !== lista[i]), lista[i], lista.slice(i + 1), nivel + 1));
      }
      return n;
    }
    const raiz = nodo([...Array(d).keys()], null, [...Array(d).keys()], 0);
    return { raiz, total: id };
  }

  // Búsqueda en profundidad con poda; con `ordenar`, los hijos se visitan de derecha a izquierda (el de mayor J primero).
  function* buscar(arbol, R, ordenar, est) {
    function* visitar(n) {
      est.actual = n;
      est.evaluados.add(n.id);
      if (n.J <= est.cota && n.nivel < R) {
        est.podados.add(n.id);
        est.mensaje = `J = ${n.J.toFixed(3)} ≤ cota ${est.cota.toFixed(3)}: se poda todo el subárbol (quitar más características solo puede bajar J).`;
        yield;
        return;
      }
      if (n.nivel === R) {
        if (n.J > est.cota) { est.cota = n.J; est.mejor = n; est.mensaje = `Hoja con J = ${n.J.toFixed(3)}: nueva mejor solución y nueva cota.`; }
        else est.mensaje = `Hoja con J = ${n.J.toFixed(3)}, no supera la cota ${est.cota.toFixed(3)}.`;
        yield;
        return;
      }
      est.mensaje = `J = ${n.J.toFixed(3)} > cota ${Number.isFinite(est.cota) ? est.cota.toFixed(3) : '−∞'}: se exploran sus ${n.hijos.length} hijos.`;
      yield;
      const hijos = ordenar ? n.hijos.slice().reverse() : n.hijos;
      for (const h of hijos) yield* visitar(h);
    }
    yield* visitar(arbol.raiz);
    est.actual = null;
    est.mensaje = `Terminado. Se evaluaron ${est.evaluados.size} de ${arbol.total} nodos.`;
  }

  // Coordenadas: hojas igualmente espaciadas, cada nodo interno centrado sobre sus hijos.
  function disponer(raiz) {
    let k = 0;
    const hojasTotales = (n) => (n.hijos.length ? n.hijos.reduce((s, h) => s + hojasTotales(h), 0) : 1);
    const total = hojasTotales(raiz), todos = [];
    (function rec(n) {
      todos.push(n);
      if (!n.hijos.length) { n.u = (k++ + 0.5) / total; return; }
      n.hijos.forEach(rec);
      n.u = (n.hijos[0].u + n.hijos[n.hijos.length - 1].u) / 2;
    })(raiz);
    return todos;
  }

  const ELEGIDAS = [0, 1, 2, 4, 6, 7]; // área, perímetro, redondez, intensidad, LBP₁, LBP₂
  const ABREV = ['área', 'perím', 'redond', 'intens', 'LBP₁', 'LBP₂'];

  /* ---------- Fig. 1: el árbol de búsqueda ---------- */

  function montarArbol(cuerpo) {
    let m = 2, ordenar = false, semilla = 1;
    let X = [], y = [], arbol = null, nodos = [], est = null;
    const d = ELEGIDAS.length;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Características a elegir m', min: 1, max: 4, valor: m, formato: (v) => `${v} de ${d}`, alCambiar: (v) => { m = v; preparar(); } });
    ctl.casilla({ etiqueta: 'ordenar los hijos por J', valor: ordenar, alCambiar: (v) => { ordenar = v; preparar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { semilla++; preparar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 90 + 70 * (d - m) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'sin evaluar', forma: 'punto' },
      { color: C.s1, texto: 'evaluado', forma: 'punto' },
      { color: C.s2, texto: 'nodo actual', forma: 'punto' },
      { color: C.s8, texto: 'podado (su subárbol no se visita)', forma: 'punto' },
      { color: C.s6, texto: 'mejor hoja', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada arista quita la característica indicada; la raíz tiene las seis. Pase el cursor por un nodo para ver su subconjunto. Active «ordenar los hijos»: la primera hoja ya es buena y se poda mucho más.');

    function preparar() {
      const datos = P.caracteristicas(semilla);
      X = datos.X.map((f) => ELEGIDAS.map((j) => f[j]));
      y = datos.y;
      arbol = construir(X, y, d, m, ordenar);
      nodos = disponer(arbol.raiz);
      lienzo.ajustar(true);
      rep.reiniciar();
    }
    function iniciar() {
      est = { actual: null, evaluados: new Set(), podados: new Set(), cota: -Infinity, mejor: null, mensaje: 'Se empieza por la raíz con las seis características.' };
      return buscar(arbol, d - m, ordenar, est);
    }
    const bajoPoda = (n) => {
      // Un nodo está bajo un nodo podado si algún ancestro fue podado.
      for (let p = n.padre; p; p = p.padre) if (est.podados.has(p.id)) return true;
      return false;
    };
    let geo = null;
    function dibujar() {
      if (!arbol || !est) return;
      const { ctx, ancho } = lienzo;
      lienzo.limpiar();
      const R = d - m, top = 26, dy = 70, x0 = 12, w = ancho - 24;
      const pos = (n) => [x0 + n.u * w, top + n.nivel * dy];
      const r = Math.max(5, Math.min(15, (w / Math.max(1, nodos.filter((n) => n.nivel === R).length)) * 0.38));
      geo = { pos, r };
      for (const n of nodos) for (const h of n.hijos) h.padre = n;
      ctx.save();
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const n of nodos) for (const h of n.hijos) {
        const [a, b] = pos(n), [c, e] = pos(h), fuera = est.podados.has(n.id) || bajoPoda(n);
        ctx.strokeStyle = fuera ? C.tenue : est.evaluados.has(h.id) ? C.s1 : C.eje;
        ctx.lineWidth = est.evaluados.has(h.id) && !fuera ? 2 : 1.2;
        if (fuera) ctx.setLineDash([3, 3]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, e); ctx.stroke();
        if (r >= 9) {
          ctx.fillStyle = fuera ? C.inactivo : C.tinta2;
          ctx.fillText(`−${ABREV[h.quitada]}`, a + (c - a) * 0.62 + (c < a ? -16 : c > a ? 16 : 0), b + (e - b) * 0.62);
        }
      }
      ctx.setLineDash([]);
      for (const n of nodos) {
        const [x, yy] = pos(n), fuera = bajoPoda(n);
        let col = C.superficie, borde = C.inactivo;
        if (est.mejor === n) { col = C.s6; borde = C.s6; }
        else if (est.actual === n) { col = C.s2; borde = C.s2; }
        else if (est.podados.has(n.id)) { col = C.superficie; borde = C.s8; }
        else if (est.evaluados.has(n.id)) { col = C.s1; borde = C.s1; }
        else if (fuera) borde = C.tenue;
        ctx.fillStyle = col;
        ctx.strokeStyle = borde;
        ctx.lineWidth = est.podados.has(n.id) ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (r >= 13 && est.evaluados.has(n.id)) {
          ctx.fillStyle = col === C.superficie ? C.tinta : C.sobre;
          ctx.font = VIZ.fuente(9);
          ctx.fillText(n.J.toFixed(2), x, yy);
        }
      }
      ctx.restore();
      registro.textContent = est.mensaje;
      const hojas = P.binomial(d, m);
      lectura.set([
        ['nodos evaluados', `${est.evaluados.size} de ${arbol.total}`],
        ['subconjuntos de tamaño m', String(hojas)],
        ['cota (mejor J)', Number.isFinite(est.cota) ? est.cota.toFixed(3) : '−∞'],
        ['mejor subconjunto', est.mejor ? est.mejor.S.map((j) => ABREV[j]).join(', ') : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y: yy } = lienzo.posicion(ev);
      const n = nodos.find((q) => { const [a, b] = geo.pos(q); return Math.hypot(a - x, b - yy) <= geo.r + 3; });
      if (!n) return tip.ocultar();
      tip.mostrar(x, yy, `{${n.S.map((j) => ABREV[j]).join(', ')}}<br>J <b>${n.J.toFixed(3)}</b>${est.evaluados.has(n.id) ? '' : '<br>(aún sin evaluar)'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
  }

  /* ---------- Fig. 2: evaluaciones frente a la búsqueda exhaustiva ---------- */

  function montarAhorro(cuerpo) {
    let m = 3;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Características a elegir m', min: 1, max: 6, valor: m, alCambiar: (v) => { m = v; }, alSoltar: calcular });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'branch and bound, hijos en orden fijo', forma: 'linea' },
      { color: C.s2, texto: 'branch and bound, hijos ordenados por J', forma: 'linea' },
      { color: C.tinta, texto: 'búsqueda exhaustiva: C(d, m)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Promedio sobre 8 conjuntos de datos. Eje vertical logarítmico; pase el cursor para leer los valores.');

    let series = [], plano = null;
    function contar(X, y, d, ordenar) {
      const arbol = construir(X, y, d, m, ordenar), est = { evaluados: new Set(), podados: new Set(), cota: -Infinity };
      for (const _ of buscar(arbol, d - m, ordenar, est));
      return est.evaluados.size;
    }
    function calcular() {
      const ds = [];
      for (let d = m + 1; d <= 9; d++) ds.push(d);
      const acum = ds.map(() => [0, 0]);
      for (let s = 1; s <= 8; s++) {
        const datos = P.caracteristicas(s * 17);
        ds.forEach((d, i) => {
          const X = datos.X.map((f) => f.slice(0, d)); // las 9 primeras (sin la constante)
          acum[i][0] += contar(X, datos.y, d, false) / 8;
          acum[i][1] += contar(X, datos.y, d, true) / 8;
        });
      }
      series = ds.map((d, i) => ({ d, fijo: acum[i][0], ord: acum[i][1], exh: P.binomial(d, m) }));
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...series.map((s) => Math.max(s.fijo, s.exh))) * 2;
      plano = VIZ.plano(lienzo, { xmin: m + 1, xmax: 9, ymin: 1, ymax }, { logY: true, etiquetaX: 'características d', etiquetaY: 'evaluaciones de J', ticksX: series.map((s) => s.d) });
      plano.ejes();
      for (const [k, col] of [['exh', C.tinta], ['fijo', C.s1], ['ord', C.s2]]) {
        VIZ.trazar(ctx, plano, series.map((s) => [s.d, s[k]]), col, 2);
        for (const s of series) VIZ.marcador(ctx, plano.sx(s.d), plano.sy(s[k]), col, 3.5);
      }
      const u = series[series.length - 1];
      lectura.set([
        ['d', String(u.d)],
        ['exhaustiva', VIZ.entero(u.exh)],
        ['B&B orden fijo', VIZ.fmt(u.fijo, 3)],
        ['B&B ordenado', VIZ.fmt(u.ord, 3)],
      ]);
    }
    lienzo.alDibujar = () => series.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const s = series.find((q) => q.d === Math.round(plano.ix(x)));
      if (!s) return tip.ocultar();
      tip.mostrar(x, y, `d = <b>${s.d}</b>, m = <b>${m}</b>` + VIZ.filaTooltip(C.tinta, 'exhaustiva', VIZ.entero(s.exh))
        + VIZ.filaTooltip(C.s1, 'orden fijo', VIZ.fmt(s.fijo, 3)) + VIZ.filaTooltip(C.s2, 'ordenado', VIZ.fmt(s.ord, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('branch-and-bound', {
    intro: String.raw`
      <p><strong>Branch and bound</strong> (ramificación y acotamiento) encuentra el mismo subconjunto óptimo que la
      <a href="tema.html?id=exhaustive-search">búsqueda exhaustiva</a> sin revisar todos los candidatos. Narendra y Fukunaga (1977)
      lo aplicaron a la selección de características: se parte del conjunto completo y se quitan características de a una,
      recorriendo un árbol.</p>
      <p>La clave es que el criterio sea <strong>monótono</strong>: quitar una característica nunca lo mejora. Entonces, si un
      nodo intermedio ya está por debajo de la mejor solución encontrada, nada de lo que cuelga de él puede ganarle, y todo su
      subárbol se descarta sin evaluarlo.</p>`,
    visualizaciones: [
      {
        titulo: 'El árbol de búsqueda',
        descripcion: 'Seis características y el criterio de Fisher. Cada nodo es un subconjunto; las hojas tienen exactamente m. Siga la búsqueda paso a paso y observe dónde se poda.',
        montar: montarArbol,
      },
      {
        titulo: 'Cuánto se ahorra',
        descripcion: 'Nodos evaluados por branch and bound, con y sin ordenar los hijos, frente al número de subconjuntos de la búsqueda exhaustiva.',
        montar: montarAhorro,
      },
    ],
    teoria: String.raw`
      <h2>Monotonía</h2>
      <p>Un criterio \(J\) es monótono si \(S_1 \subseteq S_2 \Rightarrow J(S_1) \le J(S_2)\). El
      <a href="tema.html?id=fisher">criterio de Fisher</a> \(\operatorname{tr}(S_w^{-1} S_b)\), la distancia de Mahalanobis entre
      clases y la distancia de Bhattacharyya lo son. La exactitud de un clasificador estimada con datos <strong>no</strong> lo es:
      agregar una característica ruidosa puede empeorarla.</p>
      <h2>El árbol</h2>
      <p>Para pasar de \(d\) a \(m\) características hay que quitar \(r = d - m\). Cada nivel del árbol quita una. Para que cada
      subconjunto final aparezca una sola vez, cada nodo tiene una lista ordenada de candidatas; el hijo \(i\) quita la candidata
      \(i\) y recibe solo las que vienen después. El nodo raíz tiene \(r + 1\) hijos como máximo, y el árbol tiene exactamente
      \(\binom{d}{m}\) hojas.</p>
      <h2>Algoritmo</h2>
      <pre><code>cota ← −∞
explorar(nodo):
    calcular J(nodo.S)
    si J(nodo.S) ≤ cota:  podar (no visitar sus hijos)
    si no, si nodo es hoja:  cota ← J(nodo.S);  S* ← nodo.S
    si no:  para cada hijo h:  explorar(h)
explorar(raíz);  devolver S*</code></pre>
      <div class="recuadro"><p><strong>Corrección.</strong> Si \(J(S) \le\) cota, toda hoja \(S' \subseteq S\) del subárbol cumple
      \(J(S') \le J(S) \le\) cota, así que ninguna puede mejorar la solución actual. Branch and bound devuelve el óptimo exacto.</p></div>
      <h2>Ordenar los hijos</h2>
      <p>La poda depende de encontrar pronto una cota alta. La versión mejorada ordena las candidatas de cada nodo por el valor de
      \(J\) al quitarlas: el hijo con mayor \(J\) (y menor subárbol) se explora primero y da una buena cota, y los hijos con
      \(J\) bajo, que tienen los subárboles más grandes, quedan para el final, cuando es más fácil podarlos.</p>
      <h2>Costo</h2>
      <p>En el peor caso (sin podas) se evalúan todos los nodos del árbol, más que \(\binom{d}{m}\). En la práctica, con un buen
      orden, se evalúa una fracción pequeña cuando \(m\) es cercano a \(d\) o a 0; el ahorro es menor cuando \(m \approx d/2\),
      donde el árbol es más ancho. Si el criterio no es monótono, branch and bound puede perder el óptimo, y conviene pasar a
      métodos aproximados como <a href="tema.html?id=sfs">SFS</a>.</p>`,
  });
})();
