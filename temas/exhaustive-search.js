(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;

  // Fila de casillas que muestra un subconjunto de características.
  function subconjunto(ctx, x, y, ancho, nombres, sub, color, titulo) {
    const d = nombres.length, c = ancho / d;
    ctx.save();
    ctx.font = VIZ.fuente(10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    nombres.forEach((t, j) => {
      const dentro = sub && sub.includes(j);
      ctx.fillStyle = dentro ? color : C.neutro;
      ctx.fillRect(x + j * c + 1, y, c - 2, 22);
      ctx.fillStyle = dentro ? C.sobre : C.apagado;
      ctx.fillText(c > 64 ? t : t.slice(0, Math.max(3, Math.floor(c / 8))), x + j * c + c / 2, y + 11);
    });
    ctx.fillStyle = C.tinta2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(titulo, x, y - 3);
    ctx.restore();
  }

  /* ---------- Fig. 1: recorrer todos los subconjuntos ---------- */

  function montarRecorrido(cuerpo) {
    let m = 3, semilla = 1;
    let datos = P.caracteristicas(semilla), evaluados = [], actual = null, mejor = null;
    const d = datos.nombres.length;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del subconjunto m', min: 1, max: 9, valor: m, formato: (v) => `${v} (${P.binomial(d, v)} subconjuntos)`, alCambiar: (v) => { m = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 9 });
    ctl.boton('Nuevos datos', () => { semilla++; datos = P.caracteristicas(semilla); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 320, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'subconjunto evaluado', forma: 'punto' },
      { color: C.s2, texto: 'subconjunto actual', forma: 'punto' },
      { color: C.s6, texto: 'mejor hasta ahora', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los subconjuntos se recorren en orden lexicográfico. Pase el cursor sobre un punto para ver qué características contiene. Con m = 2, el mejor par no es el de las dos mejores características individuales.');

    function iniciar() {
      evaluados = []; actual = null; mejor = null;
      return (function* () {
        for (const s of P.combinaciones(d, m)) {
          const J = P.fisher(datos.X, datos.y, s);
          actual = { s, J };
          evaluados.push(actual);
          if (!mejor || J > mejor.J) mejor = actual;
          yield;
        }
        actual = null;
      })();
    }
    let plano = null;
    function dibujar() {
      const { ctx, ancho } = lienzo;
      lienzo.limpiar();
      const total = P.binomial(d, m);
      subconjunto(ctx, 54, 18, ancho - 72, datos.nombres, actual && actual.s, C.s2, 'actual');
      subconjunto(ctx, 54, 62, ancho - 72, datos.nombres, mejor && mejor.s, C.s6, 'mejor');
      const jmax = Math.max(0.5, ...evaluados.map((e) => e.J)) * 1.1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(1, total - 1), ymin: 0, ymax: jmax }, { etiquetaX: 'subconjunto (orden lexicográfico)', etiquetaY: '', margen: { sup: 104 } });
      plano.ejes();
      ctx.save(); ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'bottom';
      ctx.fillText('J de Fisher', 4, plano.y1 - 6); ctx.restore();
      evaluados.forEach((e, i) => VIZ.marcador(ctx, plano.sx(i), plano.sy(e.J), e === mejor ? C.s6 : e === actual ? C.s2 : C.inactivo, e === mejor || e === actual ? 5 : 3));
      if (mejor) VIZ.marcador(ctx, plano.sx(evaluados.indexOf(mejor)), plano.sy(mejor.J), C.s6, 5.5);
      const nom = (s) => s.map((j) => datos.nombres[j]).join(', ');
      registro.textContent = actual
        ? `Evaluando {${nom(actual.s)}}: J = ${actual.J.toFixed(3)}${actual === mejor ? ' — nuevo mejor.' : '.'}`
        : evaluados.length ? `Terminado: ${evaluados.length} subconjuntos evaluados. El óptimo es {${nom(mejor.s)}}.` : `Se evaluarán los ${total} subconjuntos de ${m} entre ${d} características.`;
      lectura.set([
        ['evaluados', `${evaluados.length} de ${total}`],
        ['mejor J', mejor ? mejor.J.toFixed(3) : '—'],
        ['mejor subconjunto', mejor ? nom(mejor.s) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano) return;
      let m2 = -1, dm = 8;
      evaluados.forEach((e, i) => { const dd = Math.hypot(plano.sx(i) - x, plano.sy(e.J) - y); if (dd < dm) { dm = dd; m2 = i; } });
      if (m2 < 0) return tip.ocultar();
      const e = evaluados[m2];
      tip.mostrar(x, y, `{${e.s.map((j) => datos.nombres[j]).join(', ')}}<br>J <b>${e.J.toFixed(3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la explosión combinatoria ---------- */

  function montarExplosion(cuerpo) {
    let m = 5, velocidad = 6, dSel = 40;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del subconjunto m', min: 1, max: 20, valor: m, alCambiar: (v) => { m = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Evaluaciones por segundo', min: 3, max: 9, valor: velocidad, formato: (v) => `10^${v}`, alCambiar: (v) => { velocidad = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Características d', min: 5, max: 100, valor: dSel, alCambiar: (v) => { dSel = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'C(d, m): subconjuntos de tamaño m', forma: 'linea' },
      { color: C.s2, texto: '2^d: subconjuntos de cualquier tamaño', forma: 'linea' },
      { color: C.apagado, texto: 'un día, un siglo de cómputo', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eje vertical logarítmico. Pase el cursor para leer los valores. Con 100 características y m = 10 hay más de 10¹³ subconjuntos.');

    let plano = null;
    const tiempo = (n) => {
      const s = n / Math.pow(10, velocidad);
      if (s < 60) return `${VIZ.fmt(s, 3)} s`;
      if (s < 3600 * 24) return `${VIZ.fmt(s / 3600, 3)} h`;
      if (s < 3600 * 24 * 365) return `${VIZ.fmt(s / 86400, 3)} días`;
      return `${VIZ.fmt(s / (86400 * 365), 3)} años`;
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 5, xmax: 100, ymin: 1, ymax: 1e31 }, { logY: true, etiquetaX: 'características d', etiquetaY: 'subconjuntos', margen: { izq: 54, der: 70 },
        formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      plano.ejes();
      const ref = [[86400, 'un día'], [86400 * 365 * 100, 'un siglo']];
      for (const [s, t] of ref) {
        const v = s * Math.pow(10, velocidad);
        if (v > 1e31) continue;
        VIZ.trazar(ctx, plano, [[5, v], [100, v]], C.apagado, 1.2, [3, 4]);
        ctx.save(); ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textBaseline = 'middle';
        ctx.fillText(t, plano.x1 + 6, plano.sy(v)); ctx.restore();
      }
      const c = [], p = [];
      for (let d = 5; d <= 100; d++) { if (d >= m) c.push([d, Math.max(1, P.binomial(d, m))]); p.push([d, Math.pow(2, d)]); }
      ctx.save();
      plano.recortar();
      VIZ.trazar(ctx, plano, p, C.s2, 2);
      VIZ.trazar(ctx, plano, c, C.s1, 2);
      ctx.restore();
      if (dSel >= m) VIZ.marcador(ctx, plano.sx(dSel), plano.sy(P.binomial(dSel, m)), C.s1, 5);
      VIZ.marcador(ctx, plano.sx(dSel), plano.sy(Math.pow(2, dSel)), C.s2, 5);
      const n = dSel >= m ? P.binomial(dSel, m) : 0;
      lectura.set([
        ['C(d, m)', VIZ.fmt(n, 3)],
        ['tiempo para C(d, m)', tiempo(n)],
        ['2^d', VIZ.fmt(Math.pow(2, dSel), 3)],
        ['tiempo para 2^d', tiempo(Math.pow(2, dSel))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const d = Math.round(plano.ix(x));
      tip.mostrar(x, y, `d = <b>${d}</b>` + VIZ.filaTooltip(C.s1, `C(${d}, ${m})`, d >= m ? VIZ.fmt(P.binomial(d, m), 3) : '0')
        + VIZ.filaTooltip(C.s2, `2^${d}`, VIZ.fmt(Math.pow(2, d), 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('exhaustive-search', {
    intro: String.raw`
      <p>Si se tienen \(d\) características y se quiere quedarse con \(m\) de ellas, la única manera de <em>garantizar</em> el
      mejor subconjunto con un criterio arbitrario es probarlos todos. La <strong>búsqueda exhaustiva</strong> evalúa cada uno de
      los \(\binom{d}{m}\) subconjuntos y se queda con el de mayor puntaje.</p>
      <p>Es la referencia contra la que se comparan los demás métodos, y es perfectamente práctica con una decena de
      características. Con cien, en cambio, el número de combinaciones supera la edad del universo medida en microsegundos.</p>`,
    visualizaciones: [
      {
        titulo: 'Todos los subconjuntos de tamaño m',
        descripcion: 'Cada punto es un subconjunto de m de las diez características, evaluado con el criterio de Fisher J. Ejecute hasta el final y compare el mejor con las mejores características individuales.',
        montar: montarRecorrido,
      },
      {
        titulo: 'La explosión combinatoria',
        descripcion: 'Cuántos subconjuntos hay que evaluar según el número de características, y cuánto tardaría hacerlo a una velocidad dada.',
        montar: montarExplosion,
      },
    ],
    teoria: String.raw`
      <h2>Problema</h2>
      <p>Dado un criterio \(J(S)\) que mide la calidad de un subconjunto \(S \subseteq \{1, \dots, d\}\) de características
      (por ejemplo, el <a href="tema.html?id=fisher">criterio de Fisher</a> o la exactitud de un clasificador en validación), se busca</p>
      \[ S^* = \arg\max_{|S| = m} J(S). \]
      <h2>Algoritmo</h2>
      <pre><code>mejor ← −∞
para cada S ⊆ {1..d} con |S| = m:          (C(d, m) iteraciones)
    si J(S) &gt; mejor:  mejor ← J(S);  S* ← S
devolver S*</code></pre>
      <p>Las combinaciones se generan en orden lexicográfico incrementando el último índice que todavía puede crecer y
      reiniciando los siguientes, sin guardarlas todas.</p>
      <h2>Costo</h2>
      \[ \binom{d}{m} = \frac{d!}{m!\,(d - m)!}, \qquad \sum_{m=0}^{d} \binom{d}{m} = 2^d. \]
      <p>Para \(m\) fijo, \(\binom{d}{m} = \Theta(d^m)\): polinomial, pero de grado \(m\). Si también se busca el mejor tamaño, hay
      que recorrer los \(2^d\) subconjuntos. Cada evaluación de \(J\) con Fisher cuesta \(O(n m^2 + m^3)\) (matrices de dispersión
      e inversa), y con validación cruzada de un clasificador, mucho más.</p>
      <table>
        <tr><th>\(d\)</th><th>\(m\)</th><th class="num">\(\binom{d}{m}\)</th></tr>
        <tr><td>10</td><td>3</td><td class="num">120</td></tr>
        <tr><td>20</td><td>5</td><td class="num">15 504</td></tr>
        <tr><td>50</td><td>10</td><td class="num">≈ 1,03 · 10¹⁰</td></tr>
        <tr><td>100</td><td>10</td><td class="num">≈ 1,73 · 10¹³</td></tr>
      </table>
      <h2>Por qué no basta con las mejores individuales</h2>
      <p>Elegir las \(m\) características con mejor \(J\) individual es barato, pero ignora que dos características pueden ser
      redundantes (área y perímetro) o complementarias (dos que solo sirven juntas, ver <a href="tema.html?id=clean">clean</a>).
      Cover y Van Campenhout (1977) mostraron que, sin supuestos sobre \(J\), cualquier orden de los subconjuntos es posible: ningún
      método que no los revise todos garantiza el óptimo.</p>
      <div class="recuadro"><p>Si el criterio es <strong>monótono</strong>, <a href="tema.html?id=branch-and-bound">branch and
      bound</a> encuentra el mismo óptimo evaluando muchos menos subconjuntos. Si se acepta una solución aproximada,
      <a href="tema.html?id=sfs">SFS</a> necesita solo \(O(d\,m)\) evaluaciones.</p></div>`,
  });
})();
