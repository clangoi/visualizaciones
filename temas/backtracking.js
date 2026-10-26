(function () {
  'use strict';
  const { color: C } = VIZ;
  const SOLUCIONES = { 1: 1, 2: 0, 3: 0, 4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724, 11: 2680, 12: 14200 };

  /* ---------- Fig. 1: n reinas ---------- */

  function montarReinas(cuerpo) {
    let n = 6, modo = 'primera', atacadas = true;
    let col, ev, cuenta, ultimaSol, parar, mensaje;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del tablero n', min: 4, max: 10, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Objetivo', opciones: [['primera', 'Detenerse en la primera solución'], ['todas', 'Encontrar todas las soluciones']], valor: modo,
      alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'sombrear casillas atacadas', valor: atacadas, alCambiar: (v) => { atacadas = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2.5, velMax: 11 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(w, 460) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'casilla que se prueba' },
      { color: C.s8, texto: 'conflicto con una reina ya colocada' },
      { color: VIZ.alfa(C.s8, 0.12), texto: 'atacada' },
      { color: C.s6, texto: 'solución encontrada' },
    ]);
    const registro = VIZ.nota(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);

    function iniciar() {
      col = new Array(n).fill(-1);
      ev = {};
      cuenta = { intentos: 0, nodos: 0, retrocesos: 0, soluciones: 0 };
      ultimaSol = null;
      parar = false;
      mensaje = `Se colocará una reina por fila, de arriba hacia abajo, probando las columnas de izquierda a derecha.`;
      function* colocar(fila) {
        if (fila === n) {
          cuenta.soluciones++;
          ultimaSol = col.slice();
          ev = { tipo: 'solucion' };
          mensaje = `¡Solución ${cuenta.soluciones}! ${modo === 'todas' ? 'Se retrocede para buscar más.' : ''}`;
          yield;
          if (modo === 'primera') parar = true;
          return;
        }
        for (let c = 0; c < n && !parar; c++) {
          cuenta.intentos++;
          let r = -1;
          for (let k = 0; k < fila; k++) if (col[k] === c || Math.abs(col[k] - c) === fila - k) { r = k; break; }
          if (r >= 0) {
            ev = { tipo: 'conflicto', fila, c, con: [r, col[r]] };
            mensaje = `Fila ${fila + 1}, columna ${c + 1}: atacada por la reina de la fila ${r + 1} → se poda esta rama.`;
            yield;
            continue;
          }
          col[fila] = c;
          cuenta.nodos++;
          ev = { tipo: 'colocar', fila, c };
          mensaje = `Fila ${fila + 1}, columna ${c + 1}: libre, se coloca la reina y se avanza a la fila siguiente.`;
          yield;
          yield* colocar(fila + 1);
          if (parar) return;
          col[fila] = -1;
          cuenta.retrocesos++;
          ev = { tipo: 'retroceder', fila, c };
          mensaje = `Retroceso: se quita la reina de la fila ${fila + 1}, columna ${c + 1}, y se prueba la siguiente columna.`;
          yield;
        }
      }
      return (function* () {
        yield* colocar(0);
        ev = { tipo: 'fin' };
        mensaje = modo === 'primera' && cuenta.soluciones ? 'Búsqueda detenida en la primera solución.' : `Búsqueda completa: ${cuenta.soluciones} soluciones.`;
      })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(W, H) - 4, c = lado / n, ox = (W - lado) / 2, oy = 2;
      const reinas = ev.tipo === 'fin' && ultimaSol && modo === 'primera' ? ultimaSol : col;
      const atacada = (f, k) => reinas.some((cc, r) => cc >= 0 && r !== f && (cc === k || Math.abs(cc - k) === Math.abs(r - f)));
      for (let f = 0; f < n; f++) {
        for (let k = 0; k < n; k++) {
          ctx.fillStyle = (f + k) % 2 ? C.neutro : C.superficie;
          ctx.fillRect(ox + k * c, oy + f * c, c, c);
          if (atacadas && reinas[f] !== k && atacada(f, k)) {
            ctx.fillStyle = VIZ.alfa(C.s8, 0.12);
            ctx.fillRect(ox + k * c, oy + f * c, c, c);
          }
        }
      }
      const marcar = (f, k, colr) => { ctx.strokeStyle = colr; ctx.lineWidth = 4; ctx.strokeRect(ox + k * c + 2, oy + f * c + 2, c - 4, c - 4); };
      if (ev.tipo === 'conflicto') {
        ctx.fillStyle = VIZ.alfa(C.s8, 0.35);
        ctx.fillRect(ox + ev.c * c, oy + ev.fila * c, c, c);
        ctx.strokeStyle = C.s8;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(ox + (ev.c + 0.5) * c, oy + (ev.fila + 0.5) * c);
        ctx.lineTo(ox + (ev.con[1] + 0.5) * c, oy + (ev.con[0] + 0.5) * c);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (ev.tipo === 'colocar') marcar(ev.fila, ev.c, C.s1);
      if (ev.tipo === 'retroceder') marcar(ev.fila, ev.c, C.apagado);
      const exito = ev.tipo === 'solucion' || (ev.tipo === 'fin' && modo === 'primera' && ultimaSol);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(c * 0.62)}px serif`;
      reinas.forEach((k, f) => {
        if (k < 0) return;
        ctx.fillStyle = exito ? C.s6 : C.tinta;
        ctx.fillText('♛', ox + (k + 0.5) * c, oy + (f + 0.55) * c);
      });
      if (ev.tipo === 'retroceder') {
        ctx.fillStyle = VIZ.alfa(C.tinta, 0.25);
        ctx.fillText('♛', ox + (ev.c + 0.5) * c, oy + (ev.fila + 0.55) * c);
      }
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 0.5, oy + 0.5, lado - 1, lado - 1);
      registro.textContent = mensaje;
      lectura.set([
        ['casillas probadas', VIZ.entero(cuenta.intentos)], ['reinas colocadas (nodos)', VIZ.entero(cuenta.nodos)],
        ['retrocesos', VIZ.entero(cuenta.retrocesos)], ['soluciones', String(cuenta.soluciones)], ['total de soluciones para n', String(SOLUCIONES[n])],
      ]);
    }
    lienzo.alDibujar = () => col && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: tamaño del espacio de búsqueda ---------- */

  function montarEspacio(cuerpo) {
    const datos = [];
    for (let n = 4; n <= 12; n++) {
      let nodos = 0;
      const todo = (1 << n) - 1;
      // Conteo con máscaras de bits: columnas y diagonales ocupadas.
      (function rec(cols, d1, d2) {
        if (cols === todo) return;
        let libres = todo & ~(cols | d1 | d2);
        while (libres) {
          const b = libres & -libres;
          libres ^= b;
          nodos++;
          rec(cols | b, ((d1 | b) << 1) & todo, (d2 | b) >> 1);
        }
      })(0, 0, 0);
      let fact = 1;
      for (let k = 2; k <= n; k++) fact *= k;
      datos.push({ n, fuerza: Math.pow(n, n), perm: fact, bt: nodos });
    }
    const SERIES = [['fuerza', 'Fuerza bruta: nⁿ tableros (una reina por fila)', C.s8], ['perm', 'Permutaciones: n! (una por fila y columna)', C.s2], ['bt', 'Backtracking: reinas colocadas', C.s1]];
    let hover = null;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, SERIES.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    VIZ.nota(cuerpo, 'Escala logarítmica. Para n = 12 la fuerza bruta revisaría casi 9 billones de tableros; el backtracking coloca unas 857 000 reinas.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 4, xmax: 12, ymin: 10, ymax: 1e14 }, { logY: true, etiquetaX: 'n', etiquetaY: 'configuraciones exploradas', ticksX: [4, 5, 6, 7, 8, 9, 10, 11, 12] });
      plano.ejes();
      for (const [k, , c] of SERIES) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d[k]]), c, 2);
        for (const d of datos) VIZ.marcador(ctx, plano.sx(d.n), plano.sy(d[k]), c, hover && hover.n === d.n ? 5 : 3.5);
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = datos.find((d) => d.n === Math.round(plano.ix(x)));
      dibujar();
      if (hover) tip.mostrar(x, y, `n = <b>${hover.n}</b>` + SERIES.map(([k, t, c]) => VIZ.filaTooltip(c, t.split(':')[0], VIZ.entero(hover[k]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('backtracking', {
    intro: String.raw`
      <p><strong>Backtracking</strong> (vuelta atrás) es una técnica para resolver problemas de búsqueda combinatoria construyendo la
      solución <em>paso a paso</em>: en cada paso se elige una opción, y si en algún momento la solución parcial ya no puede completarse
      de forma válida, se <strong>retrocede</strong> deshaciendo la última elección y probando la siguiente.</p>
      <p>Su poder está en la <strong>poda</strong>: al descartar una solución parcial se descartan de una vez todas las soluciones completas
      que la extienden. El ejemplo clásico es el problema de las \(n\) reinas: ubicar \(n\) reinas en un tablero de \(n \times n\) sin que dos
      se ataquen.</p>`,
    visualizaciones: [
      {
        titulo: 'El problema de las n reinas',
        descripcion: 'Una reina por fila, probando columnas de izquierda a derecha. Cuando una casilla está atacada, la línea roja muestra qué reina la ataca. Si ninguna columna sirve, se retrocede a la fila anterior.',
        montar: montarReinas,
      },
      {
        titulo: 'Cuánto poda la poda',
        descripcion: 'Número de configuraciones que se examinarían con distintas estrategias para encontrar todas las soluciones.',
        montar: montarEspacio,
      },
    ],
    teoria: String.raw`
      <h2>Esquema general</h2>
      <pre><code>backtrack(solución parcial x₁, …, xₖ):
    si es una solución completa: reportarla
    para cada opción c para xₖ₊₁:
        si (x₁, …, xₖ, c) es factible:      ▹ poda
            elegir c;  backtrack(x₁, …, xₖ, c);  deshacer c</code></pre>
      <p>El algoritmo recorre en profundidad el <strong>árbol del espacio de estados</strong>: la raíz es la solución vacía, cada nivel decide
      una variable y las hojas son soluciones completas. Es un <a href="tema.html?id=dfs">DFS</a> sobre un árbol implícito que nunca se
      construye en memoria: usa solo \(O(\text{profundidad})\) espacio.</p>

      <h2>Las n reinas</h2>
      <p>Representando la solución como \(x_i = \) columna de la reina en la fila \(i\), la restricción para dos filas \(i \ne j\) es</p>
      \[ x_i \ne x_j \quad\text{y}\quad |x_i - x_j| \ne |i - j|. \]
      <p>Las diagonales se identifican con \(i + x_i\) (constante en las «/») e \(i - x_i\) (constante en las «\»), de modo que verificar un
      conflicto es \(O(1)\) manteniendo tres arreglos (o máscaras de bits) de columnas y diagonales ocupadas.</p>
      <p>Tamaños del espacio de búsqueda: sin restricciones habría \(\binom{n^2}{n}\) formas de poner las reinas; con una por fila, \(n^n\); con
      una por fila y columna, \(n!\). El backtracking explora una fracción mínima de ellas, aunque sigue siendo exponencial: el número
      de soluciones crece aproximadamente como \((0.143\,n)^n\).</p>

      <h2>Cuándo funciona bien</h2>
      <ul>
        <li><strong>Podar temprano:</strong> verificar restricciones apenas se asigna cada variable, no al final.</li>
        <li><strong>Ordenar las decisiones:</strong> elegir primero la variable más restringida (<em>fail-first</em>) y probar primero los valores
        con más probabilidad de éxito.</li>
        <li><strong>Propagar restricciones:</strong> tras cada elección, eliminar valores imposibles de las demás variables (como en Sudoku).</li>
        <li><strong>Ramificación y acotamiento</strong> (<em>branch and bound</em>): en problemas de optimización, podar ramas cuya cota optimista
        no supera la mejor solución conocida.</li>
      </ul>
      <p>Backtracking es la base de los resolvedores de SAT (algoritmo DPLL), de la programación lógica (Prolog) y de muchos problemas
      NP-completos, donde en el peor caso no se conoce nada mejor que una búsqueda exponencial.</p>`,
  });
})();
