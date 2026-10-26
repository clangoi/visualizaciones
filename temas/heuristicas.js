(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.busqueda.puzzle;

  const SERIES = [
    { clave: 'h1', nombre: 'h₁ fichas fuera de lugar', f: P.fueraDeLugar, color: C.s1 },
    { clave: 'h2', nombre: 'h₂ Manhattan', f: P.manhattan, color: C.s2 },
    { clave: 'h3', nombre: 'h₃ Manhattan + conflictos lineales', f: P.conflictoLineal, color: C.s3 },
  ];

  /* ---------- Fig. 1: tres heuristicas sobre un mismo estado ---------- */

  function montarComparar(cuerpo) {
    let semilla = 4, mezcla = 25, estado = P.mezclar(VIZ.semilla(4), 25), mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Movimientos al mezclar', min: 4, max: 80, valor: mezcla, alCambiar: (v) => { mezcla = v; } });
    ctl.boton('Mezclar', () => { semilla++; estado = P.mezclar(VIZ.semilla(semilla), mezcla); mensaje = `Se mezcló con ${mezcla} movimientos al azar.`; dibujar(); }, { primario: true });
    ctl.boton('Conflicto lineal', () => { estado = [3, 1, 2, 4, 5, 6, 7, 8, 0]; mensaje = '1, 2 y 3 están en su fila, pero el 3 va primero: Manhattan cuenta 4 movimientos y hacen falta muchos más.'; dibujar(); });
    ctl.boton('Meta', () => { estado = P.META.slice(); mensaje = 'Estado meta: todas las heurísticas valen 0.'; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w >= 560 ? 270 : 470) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.2), borde: C.tinta, texto: 'ficha fuera de lugar' },
      ...SERIES.map((s) => ({ color: s.color, texto: s.nombre })),
      { color: C.tinta, texto: 'h* distancia real' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una ficha vecina al hueco para moverla. El número pequeño en cada ficha es su distancia Manhattan a su casilla final.');

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancho = W >= 560;
      const lado = ancho ? Math.min(240, H - 20) : Math.min(240, W - 20);
      const bx = ancho ? 10 : Math.round((W - lado) / 2), by = 10;
      geo = { x: bx, y: by, lado };
      P.dibujarTablero(ctx, estado, bx, by, lado, {
        relleno: (v, i) => (v !== P.META[i] ? VIZ.alfa(C.s1, 0.2) : null),
        esquina: (v, i) => String(P.distFicha(v, i)),
      });
      // Barras
      const hs = P.hEstrella(estado);
      const filas = [...SERIES.map((s) => [s.nombre, s.f(estado), s.color]), ['h* distancia real', hs, C.tinta]];
      const x0 = ancho ? bx + lado + 30 : 14, x1 = W - 34;
      const y0 = ancho ? 22 : by + lado + 26, alto = 44;
      const max = Math.max(32, hs + 2);
      const sx = (v) => x0 + (v / max) * (x1 - x0);
      ctx.font = VIZ.fuente(11);
      filas.forEach(([nombre, v, c], k) => {
        const y = y0 + k * alto;
        ctx.fillStyle = C.tinta2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(nombre, x0, y + 10);
        ctx.fillStyle = C.neutro;
        ctx.fillRect(x0, y + 15, x1 - x0, 14);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.roundRect(x0, y + 15, Math.max(0, sx(v) - x0), 14, [0, 4, 4, 0]);
        ctx.fill();
        ctx.fillStyle = C.tinta;
        ctx.font = VIZ.fuente(12, 500);
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), sx(v) + 5, y + 22.5);
        ctx.font = VIZ.fuente(11);
      });
      ctx.save();
      ctx.strokeStyle = C.apagado;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(sx(hs), y0 + 12); ctx.lineTo(sx(hs), y0 + 4 * alto - 12); ctx.stroke();
      ctx.restore();
      const [h1, h2, h3] = SERIES.map((s) => s.f(estado));
      registro.textContent = mensaje || 'Todas las barras de color quedan a la izquierda de la línea de h*: las tres heurísticas son admisibles.';
      lectura.set([
        ['h₁', String(h1)], ['h₂', String(h2)], ['h₃', String(h3)], ['h*', String(hs)],
        ['h₃ / h*', hs ? VIZ.fmt(h3 / hs, 3) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const t = P.mover(estado, P.casillaEn(x, y, geo.x, geo.y, geo.lado));
      if (!t) return;
      estado = t;
      mensaje = '';
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: promedio de cada heurística según la distancia real ---------- */

  function montarPromedios(cuerpo) {
    let hover = null, rel = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Mostrar h / h* (precisión relativa)', valor: rel, alCambiar: (v) => { rel = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...SERIES.map((s) => ({ color: s.color, texto: s.nombre, forma: 'linea' })), { color: C.apagado, texto: 'heurística perfecta h = h*', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto promedia todos los estados del 8-puzzle que están a esa distancia real de la meta. Pase el cursor para ver los valores.');

    // Promedios por nivel, calculados una vez.
    const niveles = P.porNivel();
    const prom = SERIES.map(() => []);
    let domina = 0, total = 0;
    const globales = [0, 0, 0];
    niveles.forEach((l, d) => {
      const suma = [0, 0, 0];
      for (const c of l) {
        const s = P.decodificar(c);
        const v = SERIES.map((x) => x.f(s));
        v.forEach((x, k) => { suma[k] += x; globales[k] += x; });
        if (v[2] > v[1]) domina++;
      }
      total += l.length;
      suma.forEach((x, k) => prom[k].push(x / l.length));
    });
    const mediaH = niveles.reduce((a, l, d) => a + d * l.length, 0) / total;

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const D = niveles.length - 1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: D, ymin: 0, ymax: rel ? 1.05 : D }, {
        etiquetaX: 'distancia real h*', etiquetaY: rel ? 'h / h* promedio' : 'h promedio',
      });
      plano.ejes();
      VIZ.trazar(ctx, plano, rel ? [[1, 1], [D, 1]] : [[0, 0], [D, D]], C.apagado, 1.5, [3, 4]);
      SERIES.forEach((s, k) => {
        const pts = prom[k].map((v, d) => [d, rel ? (d ? v / d : NaN) : v]);
        VIZ.trazar(ctx, plano, pts, s.color, 2);
        if (hover != null && (!rel || hover > 0)) VIZ.marcador(ctx, plano.sx(hover), plano.sy(pts[hover][1]), s.color, 4);
      });
      lectura.set([
        ['h* medio', VIZ.fmt(mediaH, 3)],
        ...SERIES.map((s, k) => [`${s.nombre.split(' ')[0]} medio`, VIZ.fmt(globales[k] / total, 3)]),
        ['estados con h₃ > h₂', `${VIZ.fmt((100 * domina) / total, 3)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(niveles.length - 1, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `h* = <b>${hover}</b> · ${VIZ.entero(niveles[hover].length)} estados` +
        SERIES.map((s, k) => VIZ.filaTooltip(s.color, s.clave, VIZ.fmt(prom[k][hover], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('heuristicas', {
    intro: String.raw`
      <p>Una <strong>heurística</strong> \(h(s)\) estima cuánto cuesta llegar desde el estado \(s\) hasta la meta. Debe ser
      barata de calcular y, para que <a href="tema.html?id=a-star">A*</a> encuentre soluciones óptimas, no debe exagerar:
      una heurística <strong>admisible</strong> nunca supera el costo real \(h^*(s)\).</p>
      <p>Dentro de esa restricción, cuanto más grande, mejor: una heurística que se acerca a \(h^*\) poda más. La forma
      sistemática de obtener heurísticas admisibles es <strong>relajar</strong> el problema —quitarle reglas— y resolver la
      versión fácil de manera exacta.</p>`,
    visualizaciones: [
      {
        titulo: 'Tres heurísticas para el 8-puzzle',
        descripcion: 'Mueva fichas y observe que siempre \\(h_1 \\le h_2 \\le h_3 \\le h^*\\). Pruebe «Conflicto lineal»: dos fichas en su fila pero invertidas engañan a Manhattan.',
        montar: montarComparar,
      },
      {
        titulo: 'Qué tan informada es cada heurística',
        descripcion: 'Una heurística perfecta seguiría la diagonal. Active la precisión relativa: Manhattan recupera en promedio cerca de dos tercios de la distancia real.',
        montar: montarPromedios,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea \(h^*(s)\) el costo de una solución óptima desde \(s\). Una función \(h : S \to \mathbb{R}_{\ge 0}\) con \(h(t) = 0\)
      para toda meta \(t\) es</p>
      <ul>
        <li><strong>admisible</strong> si \(h(s) \le h^*(s)\) para todo \(s\);</li>
        <li><strong>consistente</strong> (o monótona) si \(h(u) \le w(u, v) + h(v)\) para toda acción de \(u\) a \(v\): una
        desigualdad triangular entre \(u\), \(v\) y la meta;</li>
        <li><strong>perfecta</strong> si \(h = h^*\).</li>
      </ul>
      <div class="recuadro"><strong>Consistente ⇒ admisible.</strong> Si \(s = v_0, v_1, \dots, v_k = t\) es un camino óptimo,
      sumando la desigualdad a lo largo del camino:
      \[ h(s) \le w(v_0, v_1) + h(v_1) \le \dots \le \sum_{i=1}^{k} w(v_{i-1}, v_i) + h(t) = h^*(s). \]</div>
      <p>Lo recíproco no vale, aunque las heurísticas obtenidas por relajación son siempre consistentes.</p>

      <h2>Heurísticas por relajación</h2>
      <p>Una ficha del 8-puzzle puede moverse de la casilla \(A\) a la \(B\) si \(A\) y \(B\) son vecinas <em>y</em> \(B\) es el
      hueco. Quitando condiciones:</p>
      <ul>
        <li>Si una ficha puede saltar a cualquier casilla, cada ficha fuera de lugar necesita exactamente un movimiento:
        \(h_1\) = número de fichas fuera de lugar.</li>
        <li>Si una ficha puede moverse a una casilla vecina aunque esté ocupada, cada ficha necesita tantos movimientos como su
        distancia Manhattan: \(h_2 = \sum_i |f_i - f_i^*| + |c_i - c_i^*|\).</li>
      </ul>
      <p>Toda solución del problema original es solución del relajado, así que el óptimo relajado no supera al original: la
      heurística es admisible. Además, cada acción cambia la heurística relajada en a lo más su costo, lo que da consistencia.</p>

      <h2>Conflictos lineales</h2>
      <p>Si dos fichas \(a\) y \(b\) están en su fila final pero en orden inverso, una de ellas tiene que salir de la fila y volver,
      lo que agrega al menos dos movimientos que Manhattan no cuenta. En cada fila y columna se calcula cuántas fichas hay que
      sacar para que las restantes queden en orden (el largo de la línea menos su subsecuencia creciente más larga) y se suma el
      doble a Manhattan:</p>
      \[ h_3(s) = h_2(s) + 2 \sum_{\text{líneas } L} \text{conflictos}(L). \]
      <p>Las fichas que salen de una línea no se vuelven a contar en la otra dirección, por lo que \(h_3\) sigue siendo admisible.</p>

      <h2>Dominancia</h2>
      <p>\(h_2\) <strong>domina</strong> a \(h_1\) si \(h_2(s) \ge h_1(s)\) para todo \(s\). Con heurísticas consistentes, A*
      expande todo nodo con \(f(s) &lt; C^*\) (el costo óptimo); como \(f = g + h\) es mayor con la heurística dominante, cada nodo
      que A* expande con \(h_2\) también lo expande con \(h_1\). En el 8-puzzle, \(h_1 \le h_2 \le h_3\).</p>
      <p>Si se tienen varias heurísticas admisibles \(h_a, h_b\) y ninguna domina a la otra, su máximo
      \(\max(h_a, h_b)\) es admisible y domina a ambas. Sumarlas en general <em>no</em> es admisible; la excepción son las
      <a href="tema.html?id=pattern-databases">bases de datos de patrones aditivas</a>.</p>

      <h2>Precisión y costo</h2>
      <p>Una heurística más precisa reduce la <a href="tema.html?id=heuristic-search">ramificación efectiva</a>, pero cuesta más
      calcularla. El caso extremo \(h = h^*\) haría que A* vaya directo a la meta, pero calcular \(h^*\) es tan difícil como resolver
      el problema. Las buenas heurísticas están en el medio: \(O(1)\) o \(O(n)\) por estado y lo más cerca posible de \(h^*\).</p>`,
  });
})();
