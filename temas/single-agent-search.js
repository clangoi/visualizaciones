(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.busqueda.puzzle;

  /* ---------- Fig. 1: jugar y resolver el 8-puzzle ---------- */

  function montarJugar(cuerpo) {
    let semilla = 1, mezcla = 30, estado = P.mezclar(VIZ.semilla(1), 30), origen = estado.slice();
    let propios = 0, movida = -1, solucion = null, k = 0, mensaje = '';

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Movimientos al mezclar', min: 4, max: 80, valor: mezcla, alCambiar: (v) => { mezcla = v; } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Mezclar', () => { semilla++; fijar(P.mezclar(VIZ.semilla(semilla), mezcla), `Se mezcló con ${mezcla} movimientos al azar.`); });
    ctl.boton('Estado más difícil', () => {
      const l = P.porNivel();
      fijar(P.decodificar(l[l.length - 1][semilla++ % 2]), `Uno de los dos estados que necesitan ${l.length - 1} movimientos.`);
    });
    ctl.boton('Meta', () => fijar(P.META.slice(), 'Estado meta.'));

    const lienzo = VIZ.lienzo(cuerpo, { alto: 300 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.22), borde: C.tinta, texto: 'ficha en su posición final' },
      { color: VIZ.alfa(C.s2, 0.3), borde: C.tinta, texto: 'ficha recién movida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una ficha vecina al hueco para moverla. «Reproducir» le pide a A* (con distancia Manhattan) la solución óptima desde la posición actual y la ejecuta; «Reiniciar» vuelve a esa posición.');

    function fijar(s, txt) {
      estado = s; origen = s.slice(); propios = 0; movida = -1; mensaje = txt;
      rep.reiniciar();
    }

    function iniciar() {
      estado = origen.slice();
      solucion = null; k = 0; movida = -1;
      return (function* () {
        const r = P.aEstrella(estado, P.manhattan);
        solucion = r;
        mensaje = r.costo === 0 ? 'Ya está en la meta.' : `A* expandió ${VIZ.entero(r.expandidos)} estados y encontró una solución de ${r.costo} movimientos.`;
        yield;
        for (k = 1; k < r.camino.length; k++) {
          const ant = r.camino[k - 1];
          estado = r.camino[k];
          movida = ant.indexOf(0); // la ficha ocupa el hueco anterior
          mensaje = `Movimiento ${k} de ${r.costo}: la ficha ${estado[movida]} se desliza al hueco. Quedan ${P.hEstrella(estado)}.`;
          yield;
        }
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(H - 20, W - 20, 280);
      const x = Math.round((W - lado) / 2), y = 10;
      geo = { x, y, lado };
      P.dibujarTablero(ctx, estado, x, y, lado, {
        relleno: (v, i) => (i === movida ? VIZ.alfa(C.s2, 0.3) : v === P.META[i] ? VIZ.alfa(C.s6, 0.22) : null),
      });
      registro.textContent = mensaje || 'Mueva fichas o pida la solución.';
      const hs = P.hEstrella(estado);
      lectura.set([
        ['sus movimientos', String(propios)],
        ['Manhattan h', String(P.manhattan(estado))],
        ['distancia óptima h*', String(hs)],
        ['A*: expandidos', solucion ? VIZ.entero(solucion.expandidos) : '—'],
        ['paso de la solución', solucion ? `${Math.min(k, solucion.costo)} / ${solucion.costo}` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = P.casillaEn(x, y, geo.x, geo.y, geo.lado);
      const t = P.mover(estado, i);
      if (!t) return;
      rep.detener();
      const antes = P.hEstrella(estado);
      movida = estado.indexOf(0); // la ficha ocupa el hueco anterior
      estado = t; origen = t.slice(); propios++;
      const despues = P.hEstrella(estado);
      mensaje = despues === 0 ? `¡Resuelto en ${propios} movimientos!` : despues < antes ? `Bien: ahora faltan ${despues} movimientos (óptimo).` : `Ese movimiento aleja la meta: ahora faltan ${despues}.`;
      const m = movida, txt = mensaje;
      rep.reiniciar();
      movida = m; mensaje = txt;
      dibujar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el espacio de estados por distancia a la meta ---------- */

  function montarEspacio(cuerpo) {
    let log = false, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Escala logarítmica', valor: log, alCambiar: (v) => { log = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'estados a esa distancia' },
      { color: C.apagado, texto: 'distancia media', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre una barra para ver cuántos estados necesitan exactamente ese número de movimientos.');

    const niveles = P.porNivel().map((l) => l.length);
    const total = niveles.reduce((a, b) => a + b, 0);
    const media = niveles.reduce((a, n, d) => a + n * d, 0) / total;
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const D = niveles.length;
      plano = VIZ.plano(lienzo, { xmin: -0.5, xmax: D - 0.5, ymin: log ? 1 : 0, ymax: Math.max(...niveles) * 1.08 }, {
        logY: log, etiquetaX: 'movimientos de la solución óptima', etiquetaY: 'estados',
        formatoY: (v) => VIZ.entero(v), ticksX: Array.from({ length: Math.ceil(D / 5) + 1 }, (_, i) => i * 5).filter((v) => v < D),
      });
      plano.ejes();
      const w = plano.sx(1) - plano.sx(0);
      niveles.forEach((n, d) => {
        const x = plano.sx(d) - w / 2 + 1, y = plano.sy(n);
        ctx.fillStyle = d === hover ? C.s2 : C.s1;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(1, w - 2), plano.y0 - y, [Math.min(4, w / 2), Math.min(4, w / 2), 0, 0]);
        ctx.fill();
      });
      ctx.save();
      ctx.strokeStyle = C.apagado;
      ctx.setLineDash([3, 4]);
      const xm = plano.sx(media);
      ctx.beginPath(); ctx.moveTo(xm, plano.y1); ctx.lineTo(xm, plano.y0); ctx.stroke();
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11);
      ctx.textAlign = 'right';
      ctx.fillText(`media ${VIZ.fmt(media, 3)}`, xm - 4, plano.y1 + 10);
      ctx.restore();
      lectura.set([
        ['estados alcanzables', VIZ.entero(total)],
        ['permutaciones', VIZ.entero(362880)],
        ['distancia máxima', String(niveles.length - 1)],
        ['distancia media', VIZ.fmt(media, 3)],
        ['estados a distancia máxima', String(niveles[niveles.length - 1])],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const d = plano && plano.dentro(x, y) ? Math.round(plano.ix(x)) : -1;
      if (d < 0 || d >= niveles.length) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = d;
      dibujar();
      tip.mostrar(x, y, `distancia <b>${d}</b><br><b>${VIZ.entero(niveles[d])}</b> estados (${VIZ.fmt((100 * niveles[d]) / total, 3)} %)`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('single-agent-search', {
    intro: String.raw`
      <p>En un problema de <strong>un solo agente</strong> nadie más actúa: el agente conoce el estado completo, cada acción tiene
      un efecto determinado y el objetivo es llegar a la meta con el menor costo posible. Los rompecabezas de fichas deslizantes, el
      cubo de Rubik, Sokoban o planificar una ruta son ejemplos clásicos.</p>
      <p>El <strong>8-puzzle</strong> es el ejemplo de referencia: ocho fichas en un tablero de 3 × 3 con un hueco, donde cada
      movimiento desliza una ficha vecina al hueco. Es lo bastante pequeño para conocer la distancia exacta de cada uno de sus
      estados, y lo bastante grande para que buscar a ciegas sea costoso. Sus parientes mayores, el 15-puzzle y el 24-puzzle, se
      resuelven óptimamente solo con las técnicas de esta sección.</p>`,
    visualizaciones: [
      {
        titulo: 'El 8-puzzle',
        descripcion: 'Intente resolverlo y compare su número de movimientos con la distancia óptima h*. Pruebe «Estado más difícil»: ningún estado está más lejos de la meta.',
        montar: montarJugar,
      },
      {
        titulo: 'Estados según su distancia a la meta',
        descripcion: 'Una búsqueda en anchura hacia atrás desde la meta da la distancia exacta de los 181 440 estados alcanzables. Observe que la mayoría está a más de 18 movimientos.',
        montar: montarEspacio,
      },
    ],
    teoria: String.raw`
      <h2>Formulación</h2>
      <p>Un problema de búsqueda de un solo agente es un problema de espacio de estados \((S, A, s_0, T)\) (ver
      <a href="tema.html?id=heuristic-search">Heuristic Search</a>) en el que el entorno es <em>completamente observable</em>,
      <em>determinista</em> y <em>estático</em>: el único que cambia el estado es el agente, y sabe exactamente qué produce cada
      acción. Por eso una solución es simplemente una secuencia de acciones, calculada antes de actuar.</p>
      <p>En el \((n^2 - 1)\)-puzzle, un estado es una permutación de las fichas y el hueco; hay a lo más cuatro acciones (mover el
      hueco arriba, abajo, izquierda o derecha), todas de costo 1.</p>

      <h2>Tamaño de los espacios de estados</h2>
      <table>
        <thead><tr><th>Problema</th><th>Estados alcanzables</th><th>Solución óptima más larga</th></tr></thead>
        <tbody>
          <tr><td>8-puzzle</td><td>\(9!/2 = 181\,440\)</td><td>31</td></tr>
          <tr><td>15-puzzle</td><td>\(16!/2 \approx 1.05 \times 10^{13}\)</td><td>80</td></tr>
          <tr><td>24-puzzle</td><td>\(25!/2 \approx 7.8 \times 10^{24}\)</td><td>desconocida</td></tr>
          <tr><td>Cubo de Rubik</td><td>\(\approx 4.3 \times 10^{19}\)</td><td>20</td></tr>
        </tbody>
      </table>
      <p>Solo la mitad de las permutaciones es alcanzable. Leyendo el tablero por filas y sin contar el hueco, cada movimiento
      horizontal no cambia el orden de las fichas, y uno vertical salta una ficha sobre otras dos, lo que cambia el número de
      <em>inversiones</em> en una cantidad par. En el tablero de 3 × 3 la paridad de las inversiones es un invariante: un estado es
      resoluble si y solo si tiene un número par de inversiones (como la meta, que tiene cero).</p>

      <h2>Resolver óptimamente</h2>
      <p>Encontrar la solución más corta del \((n^2 - 1)\)-puzzle es NP-difícil (Ratner y Warmuth, 1990), aunque encontrar
      <em>alguna</em> solución es fácil. Los hitos de la búsqueda heurística siguen a estos rompecabezas:</p>
      <ul>
        <li>8-puzzle: <a href="tema.html?id=a-star">A*</a> con distancia Manhattan expande unos pocos cientos o miles de estados.</li>
        <li>15-puzzle: <a href="tema.html?id=ida-star">IDA*</a> con distancia Manhattan (Korf, 1985) fue el primer método capaz de
        resolver instancias aleatorias, porque A* se queda sin memoria.</li>
        <li>24-puzzle: IDA* con <a href="tema.html?id=pattern-databases">bases de datos de patrones</a> aditivas (Korf y Felner, 2002).</li>
      </ul>

      <h2>Un agente frente a varios</h2>
      <p>Cuando hay otros agentes cuyas acciones no controlamos —un rival en un juego, por ejemplo—, una secuencia fija de acciones
      ya no sirve: hace falta una <em>estrategia</em> que responda a lo que hagan los demás. Ese es el tema de
      <a href="tema.html?id=multi-agent-search">Multi-Agent Search</a>.</p>`,
  });
})();
