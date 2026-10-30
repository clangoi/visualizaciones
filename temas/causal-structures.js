(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const ESTRUCTURAS = {
    cadena: { nombre: 'Cadena X → Z → Y', g: M.dag([['X', 0.1, 0.5], ['Z', 0.5, 0.5], ['Y', 0.9, 0.5]], [[0, 1], [1, 2]]), coef: { '0,1': 1, '1,2': 1 }, orden: [0, 1, 2] },
    fork: { nombre: 'Fork X ← Z → Y', g: M.dag([['Z', 0.5, 0.12], ['X', 0.12, 0.85], ['Y', 0.88, 0.85]], [[0, 1], [0, 2]]), coef: { '0,1': 1, '0,2': 1 }, orden: [1, 0, 2] },
    collider: { nombre: 'Collider X → Z ← Y', g: M.dag([['X', 0.12, 0.15], ['Y', 0.88, 0.15], ['Z', 0.5, 0.88]], [[0, 2], [1, 2]]), coef: { '0,2': 1, '1,2': 1 }, orden: [0, 2, 1] },
  };

  /* ---------- Fig. 1: tres estructuras ---------- */

  function montarEstructuras(cuerpo) {
    let tipo = 'fork', z0 = 0, ancho = 0.5, cond = true, semilla = 1, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estructura', opciones: Object.entries(ESTRUCTURAS).map(([k, v]) => [k, v.nombre]), valor: tipo, alCambiar: (v) => { tipo = v; generar(); } });
    ctl.casilla({ etiqueta: 'condicionar en Z (franja)', valor: cond, alCambiar: (v) => { cond = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Z ≈', min: -2, max: 2, paso: 0.1, valor: z0, formato: (v) => v.toFixed(1), alCambiar: (v) => { z0 = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.3) : Math.min(380, Math.round(w * 0.4))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'nodo en el que se condiciona', forma: 'punto' },
      { color: C.s1, texto: 'datos con Z en la franja', forma: 'punto' },
      { color: C.inactivo, texto: 'resto', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En la cadena y el fork, X e Y se asocian, pero dentro de una franja de Z la asociación desaparece: Z bloquea el camino. En el collider ocurre al revés: X e Y son independientes y condicionar en Z abre el camino.');
    function generar() { const E = ESTRUCTURAS[tipo]; D = M.simularSCM(E.g, E.coef, 600, semilla); dibujar(); }
    let pl = null, ox = 0, oy = 0;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const E = ESTRUCTURAS[tipo], [ix, iz, iy] = E.orden;
      const vertical = W < 620, wG = vertical ? W : W * 0.36, hG = vertical ? H * 0.3 : H;
      VIZ.grafo.dibujar({ ...lienzo, ancho: wG, alto: hG, ctx }, E.g, { nodo: (i) => (i === iz && cond ? { relleno: C.s4, borde: C.s4 } : {}), arista: () => ({ color: C.apagado, ancho: 2 }) });
      ox = vertical ? 0 : wG; oy = vertical ? hG : 0;
      ctx.save(); ctx.translate(ox, oy);
      const zs = D.map((d) => d[iz]), sz = M.desv(zs);
      const enF = (d) => Math.abs(d[iz] / sz - z0) <= ancho / 2;
      const sub = { ...lienzo, ancho: W - ox, alto: H - oy, ctx };
      const R = Math.max(...D.map((d) => Math.max(Math.abs(d[ix]), Math.abs(d[iy])))) * 1.05;
      pl = VIZ.plano(sub, { xmin: -R, xmax: R, ymin: -R, ymax: R }, { etiquetaX: 'X', etiquetaY: 'Y', margen: { izq: 40 } });
      pl.ejes();
      const orden = D.slice().sort((a, b) => (cond ? enF(a) - enF(b) : 0));
      M.dispersion(ctx, pl, orden.map((d) => ({ x: d[ix], y: d[iy], f: enF(d) })), { color: (p) => (cond && p.f ? C.s1 : cond ? C.inactivo : C.tinta2), r: (p) => (cond && p.f ? 3.2 : 2.2) });
      ctx.restore();
      const r = (pts) => M.correlacion(pts.map((d) => d[ix]), pts.map((d) => d[iy]));
      const dentro = D.filter(enF);
      lectura.set([
        ['correlación de X e Y', VIZ.fmt(r(D), 3)],
        ['dentro de la franja de Z', dentro.length > 3 ? VIZ.fmt(r(dentro), 3) : '—'],
        ['correlación parcial dado Z', VIZ.fmt(M.correlacionParcial(D, ix, iy, [iz]), 3)],
        ['puntos en la franja', String(dentro.length)],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x - ox, y - oy)) return tip.ocultar();
      tip.mostrar(x, y, `X = <b>${VIZ.fmt(pl.ix(x - ox), 2)}</b>, Y = <b>${VIZ.fmt(pl.iy(y - oy), 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: la condición causal de Markov ---------- */

  const GRAFOS = {
    a: { nombre: 'Riego y lluvia', g: M.dag([['E', 0.5, 0.08], ['L', 0.15, 0.45], ['R', 0.85, 0.45], ['P', 0.5, 0.75], ['S', 0.5, 1]], [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]), nombres: ['estación', 'lluvia', 'riego', 'pasto mojado', 'resbaloso'] },
    b: { nombre: 'Cadena con atajo', g: M.dag([['A', 0.1, 0.2], ['B', 0.4, 0.2], ['C', 0.7, 0.2], ['D', 0.4, 0.85], ['F', 0.95, 0.85]], [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4]]), nombres: ['A', 'B', 'C', 'D', 'F'] },
  };
  function montarMarkov(cuerpo) {
    let cual = 'a', n = 2000, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Grafo', opciones: Object.entries(GRAFOS).map(([k, v]) => [k, v.nombre]), valor: cual, alCambiar: (v) => { cual = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Muestra n', min: 100, max: 5000, paso: 100, valor: n, alCambiar: (v) => { n = v; }, alSoltar: () => dibujar() });
    ctl.boton('Nuevos datos', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 220, altoMax: 300 });
    const tabla = M.tabla(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Datos generados con un modelo lineal sobre el grafo. Cada fila es una afirmación de Markov local y la mayor correlación parcial observada entre el nodo y uno de sus no descendientes dados sus padres: debería ser cercana a 0 (del orden de 2/√n).');
    function dibujar() {
      lienzo.limpiar();
      const { g, nombres } = GRAFOS[cual], k = g.nodos.length;
      const coef = Object.fromEntries(g.aristas.map((a, i) => [`${a.u},${a.v}`, [0.9, -0.7, 0.8, 0.6, 1, 0.75][i % 6]]));
      const D = M.simularSCM(g, coef, n, semilla);
      VIZ.grafo.dibujar(lienzo, g, { debajo: (i) => nombres[i], arista: () => ({ color: C.apagado, ancho: 1.8 }) });
      const filas = [];
      let peor = 0;
      for (let v = 0; v < k; v++) {
        const pa = g.aristas.filter((a) => a.v === v).map((a) => a.u), de = M.descendientes(g, v);
        const nd = g.nodos.map((_, u) => u).filter((u) => u !== v && !de.has(u) && !pa.includes(u));
        const pc = nd.map((u) => Math.abs(M.correlacionParcial(D, v, u, pa)));
        const mx = pc.length ? Math.max(...pc) : null;
        if (mx != null) peor = Math.max(peor, mx);
        filas.push([{ texto: `${nombres[v]} ⫫ {${nd.map((u) => nombres[u]).join(', ')}} | {${pa.map((u) => nombres[u]).join(', ')}}`, clase: 'izq' }, nd.length ? VIZ.fmt(mx, 3) : '— (nada que afirmar)']);
      }
      tabla.set([{ texto: 'afirmación de Markov local', clase: 'izq' }, 'máx |correlación parcial|'], filas);
      lectura.set([
        ['afirmaciones', String(filas.length)],
        ['mayor correlación parcial', VIZ.fmt(peor, 3)],
        ['umbral aproximado 2/√n', VIZ.fmt(2 / Math.sqrt(n), 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    cuerpo.dataset.sinLeyenda = 'nodos con nombre directo y aristas sin color';
    dibujar();
  }

  VIZ.registrarTema('causal-structures', {
    intro: String.raw`
      <p>Un <strong>grafo causal</strong> es un DAG en el que cada flecha \(A \to B\) significa «\(A\) es causa directa de \(B\)». Cualquier camino
      entre dos variables se arma con tres piezas: <strong>cadenas</strong> (\(X \to Z \to Y\)), <strong>forks</strong> o causas comunes
      (\(X \leftarrow Z \to Y\)) y <strong>colliders</strong> o efectos comunes (\(X \to Z \leftarrow Y\)).</p>
      <p>Cada pieza transmite o bloquea la dependencia de una manera distinta según si se condiciona en \(Z\). Con eso se leen del grafo
      todas las independencias que deben verse en los datos: la <strong>condición causal de Markov</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Cadenas, forks y colliders',
        descripcion: 'Datos generados por cada estructura. Active y desactive la franja de Z y compare la correlación de X e Y.',
        montar: montarEstructuras,
      },
      {
        titulo: 'La condición causal de Markov',
        descripcion: 'Las independencias que impone el grafo, comprobadas en datos simulados con correlaciones parciales.',
        montar: montarMarkov,
      },
    ],
    teoria: String.raw`
      <h2>Las tres piezas</h2>
      <table>
        <tr><th>Estructura</th><th>Sin condicionar</th><th>Condicionando en \(Z\)</th><th>Ejemplo</th></tr>
        <tr><td>Cadena \(X \to Z \to Y\)</td><td>dependientes</td><td>independientes</td><td>fumar → alquitrán → cáncer</td></tr>
        <tr><td>Fork \(X \leftarrow Z \to Y\)</td><td>dependientes</td><td>independientes</td><td>helados ← calor → ahogamientos</td></tr>
        <tr><td>Collider \(X \to Z \leftarrow Y\)</td><td>independientes</td><td>dependientes</td><td>talento → admisión ← esfuerzo</td></tr>
      </table>
      <p>En un collider, condicionar en un <em>descendiente</em> de \(Z\) también abre el camino.</p>
      <h2>Condición causal de Markov</h2>
      <div class="recuadro"><p>Si \(G\) es el grafo causal de las variables (y no hay causas comunes omitidas), cada variable es independiente de
      sus no descendientes dados sus padres:</p>
      \[ X_i \perp\!\!\!\perp \operatorname{NoDesc}(X_i) \mid \operatorname{Pa}(X_i). \]</div>
      <p>Equivale a que la distribución se factorice como en una <a href="tema.html?id=bayesian-networks">red bayesiana</a>:
      \(P(X_1, \dots, X_n) = \prod_i P(X_i \mid \operatorname{Pa}(X_i))\). Todas las demás independencias implicadas se obtienen con
      <a href="tema.html?id=d-separation">d-separación</a>.</p>
      <h2>Fidelidad</h2>
      <p>La condición de Markov dice qué independencias <em>deben</em> aparecer. La <strong>fidelidad</strong> (<em>faithfulness</em>) agrega que no
      aparecen otras: no hay cancelaciones exactas de efectos. Bajo ambas, las independencias de los datos determinan el grafo hasta su clase de
      equivalencia de Markov (los algoritmos de descubrimiento causal como PC se basan en esto). Cadenas y forks son equivalentes (implican lo
      mismo); un collider se distingue de ellos.</p>
      <h2>Modelo causal estructural</h2>
      <p>Un SCM asigna a cada variable una ecuación \(X_i := f_i(\operatorname{Pa}(X_i), U_i)\) con ruidos \(U_i\) independientes. Las figuras usan
      el caso lineal gaussiano \(X_i := \sum_j \beta_{ji} X_j + U_i\), donde independencia condicional equivale a correlación parcial cero.</p>`,
  });
})();