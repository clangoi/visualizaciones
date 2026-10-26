(function () {
  'use strict';
  const { color: C } = VIZ;
  const B = VIZ.busqueda;

  /* ---------- Fig. 1: minimax, alfa-beta y expectimax sobre un árbol de juego ---------- */

  // Árbol uniforme: niveles alternados MAX / MIN (o azar), hojas con valores enteros.
  function arbolJuego(b, D, semilla, azar) {
    const rnd = VIZ.semilla(semilla);
    const crear = (d) => {
      const n = { d, hijos: [], tipo: d === D ? 'hoja' : d % 2 === 0 ? 'max' : azar ? 'azar' : 'min' };
      if (d === D) n.valor = Math.floor(rnd() * 21);
      else for (let i = 0; i < b; i++) n.hijos.push(crear(d + 1));
      return n;
    };
    return crear(0);
  }
  // Valor exacto (para ordenar los hijos «mejor primero»).
  function valorExacto(n) {
    if (n.tipo === 'hoja') return n.valor;
    const v = n.hijos.map(valorExacto);
    return n.tipo === 'max' ? Math.max(...v) : n.tipo === 'min' ? Math.min(...v) : v.reduce((a, x) => a + x, 0) / v.length;
  }
  const fmtV = (v) => (v === Infinity ? '+∞' : v === -Infinity ? '−∞' : Number.isInteger(v) ? String(v) : VIZ.fmt(v, 3));

  function montarArbol(cuerpo) {
    let alg = 'alfabeta', b = 2, D = 4, semilla = 3, ordenar = false, raiz = null;
    let val = new Map(), ab = new Map(), est = new Map(), actual = null, hojas = 0, podados = 0, mensaje = '', mejor = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', opciones: [['minimax', 'Minimax'], ['alfabeta', 'Poda alfa-beta'], ['expectimax', 'Expectimax (MIN juega al azar)']], valor: alg,
      alCambiar: (v) => { alg = v; construir(); } });
    const rb = ctl.rango({ etiqueta: 'Jugadas por turno b', min: 2, max: 3, valor: b, alCambiar: (v) => { b = v; if (b === 3 && D > 3) { D = 3; rd.valor = 3; } construir(); } });
    const rd = ctl.rango({ etiqueta: 'Profundidad (turnos)', min: 2, max: 4, valor: D, alCambiar: (v) => { D = v; if (D > 3 && b === 3) { b = 2; rb.valor = 2; } construir(); } });
    ctl.casilla({ etiqueta: 'Ordenar: mejor jugada primero', valor: ordenar, alCambiar: (v) => { ordenar = v; construir(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos valores', () => { semilla++; construir(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + D * 70 + 24 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '△ es un turno de MAX, ▽ de MIN y ○ un evento al azar; los cuadrados son posiciones finales con su valor para MAX. Con alfa-beta, bajo cada nodo aparece su ventana [α, β] (en pantallas angostas se omite en el último nivel). Pase el cursor sobre un nodo para ver su valor.');

    function construir() {
      raiz = arbolJuego(b, D, semilla * 31 + b * 7 + D, alg === 'expectimax');
      if (ordenar) (function ord(n) {
        if (!n.hijos.length) return;
        n.hijos.sort((p, q) => (n.tipo === 'max' ? valorExacto(q) - valorExacto(p) : valorExacto(p) - valorExacto(q)));
        n.hijos.forEach(ord);
      })(raiz);
      leyenda.set([
        { color: C.s4, texto: 'en la pila de llamadas' },
        { color: C.s1, texto: 'valor calculado' },
        { color: C.superficie, borde: C.s2, texto: 'nodo actual', forma: 'punto' },
        ...(alg === 'alfabeta' ? [{ color: C.s8, texto: 'rama podada', forma: 'linea' }] : []),
        { color: C.s2, texto: 'jugada elegida', forma: 'linea' },
      ]);
      lienzo.ajustar(true);
      rep.reiniciar();
    }

    function iniciar() {
      val = new Map(); ab = new Map(); est = new Map(); actual = null; hojas = 0; podados = 0; mejor = null;
      mensaje = alg === 'expectimax' ? 'MAX elige el máximo; en los nodos de azar se promedian los hijos.' : 'MAX elige el máximo y MIN el mínimo, desde las hojas hacia arriba.';
      const marcarPoda = (n) => { est.set(n, 'poda'); podados++; n.hijos.forEach(marcarPoda); };
      function* visitar(n, alfa, beta) {
        actual = n;
        est.set(n, 'pila');
        if (alg === 'alfabeta') ab.set(n, [alfa, beta]);
        if (n.tipo === 'hoja') {
          hojas++;
          val.set(n, n.valor);
          est.set(n, 'hecho');
          mensaje = `Hoja evaluada: ${n.valor}.`;
          yield;
          return n.valor;
        }
        if (n.tipo === 'azar') {
          let suma = 0;
          mensaje = 'Nodo de azar: se promedian todos sus hijos (no se puede podar sin cotas).';
          yield;
          for (const h of n.hijos) { suma += yield* visitar(h, alfa, beta); actual = n; }
          const v = suma / n.hijos.length;
          val.set(n, v);
          est.set(n, 'hecho');
          mensaje = `Promedio de los hijos: ${fmtV(v)}.`;
          yield;
          return v;
        }
        const esMax = n.tipo === 'max';
        let v = esMax ? -Infinity : Infinity;
        val.set(n, v);
        mensaje = `Turno de ${esMax ? 'MAX' : 'MIN'}` + (alg === 'alfabeta' ? ` con ventana [${fmtV(alfa)}, ${fmtV(beta)}].` : '.');
        yield;
        for (let i = 0; i < n.hijos.length; i++) {
          const vh = yield* visitar(n.hijos[i], alfa, beta);
          actual = n;
          v = esMax ? Math.max(v, vh) : Math.min(v, vh);
          val.set(n, v);
          if (alg === 'alfabeta') {
            if (esMax) alfa = Math.max(alfa, v); else beta = Math.min(beta, v);
            ab.set(n, [alfa, beta]);
            if (alfa >= beta && i < n.hijos.length - 1) {
              n.hijos.slice(i + 1).forEach(marcarPoda);
              mensaje = esMax
                ? `MAX ya asegura ${fmtV(v)} ≥ β = ${fmtV(beta)}: MIN nunca dejará llegar aquí. Se podan ${n.hijos.length - i - 1} rama(s).`
                : `MIN ya asegura ${fmtV(v)} ≤ α = ${fmtV(alfa)}: MAX nunca elegirá esta rama. Se podan ${n.hijos.length - i - 1} rama(s).`;
              est.set(n, 'hecho');
              yield;
              return v;
            }
          }
          mensaje = `${esMax ? 'MAX' : 'MIN'} recibe ${fmtV(vh)}; su mejor valor hasta ahora es ${fmtV(v)}.`;
          yield;
        }
        est.set(n, 'hecho');
        return v;
      }
      return (function* () {
        yield;
        const v = yield* visitar(raiz, -Infinity, Infinity);
        actual = null;
        mejor = raiz.hijos.find((h) => val.get(h) === v && est.get(h) !== 'poda') || null;
        mensaje = `Valor del juego para MAX: ${fmtV(v)}. Jugada elegida: la rama ${raiz.hijos.indexOf(mejor) + 1}.`;
      })();
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      // Variante principal: desde la raíz, el hijo cuyo valor coincide con el del padre.
      const pv = new Set();
      if (mejor) {
        let n = raiz;
        while (n && n.hijos.length) {
          const v = val.get(n);
          const h = n.tipo === 'azar' ? null : n.hijos.find((x) => val.get(x) === v && est.get(x) !== 'poda');
          if (!h) break;
          pv.add(h);
          n = h;
        }
      }
      geo = B.dibujarArbol(ctx, raiz, {
        x0: 6, y0: 30, ancho: W - 12, dy: 70,
        forma: (n) => (n.tipo === 'hoja' ? 'cuadro' : n.tipo === 'azar' ? 'circulo' : n.tipo),
        estilo: (n) => {
          const e = est.get(n);
          let r = {};
          if (e === 'poda') r = { borde: C.tenue, texto: C.inactivo, guiones: [3, 2] };
          else if (e === 'pila') r = { relleno: C.s4 };
          else if (e === 'hecho') r = { relleno: C.s1, borde: C.s1, texto: C.sobre };
          if (n === actual) r.anillo = C.s2;
          return r;
        },
        arista: (p, h) => (pv.has(h) ? { color: C.s2, ancho: 3.5 } : est.get(h) === 'poda' && est.get(p) !== 'poda' ? { color: C.s8, ancho: 2, guiones: [4, 3] } : est.get(h) === 'poda' ? { color: C.tenue } : est.get(h) ? { color: C.s1, ancho: 2 } : null),
        etiqueta: (n) => (n.tipo === 'hoja' ? String(n.valor) : val.has(n) && Number.isFinite(val.get(n)) ? fmtV(val.get(n)) : ''),
        debajo: (n) => (alg === 'alfabeta' && ab.has(n) && n.tipo !== 'hoja' && (n.d < D - 1 || (W - 12) / Math.pow(b, D) >= 44) ? `[${fmtV(ab.get(n)[0])},${fmtV(ab.get(n)[1])}]` : ''),
      });
      registro.textContent = mensaje;
      const total = Math.pow(b, D);
      lectura.set([
        ['hojas evaluadas', `${hojas} de ${total}`],
        ['nodos podados', String(podados)],
        ['valor de la raíz', val.has(raiz) && Number.isFinite(val.get(raiz)) && est.get(raiz) === 'hecho' ? fmtV(val.get(raiz)) : '—'],
        ['mejor caso alfa-beta', `≈ ${Math.ceil(Math.pow(b, Math.ceil(D / 2)) + Math.pow(b, Math.floor(D / 2)) - 1)} hojas`],
      ]);
    }
    lienzo.alDibujar = () => raiz && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const n = B.nodoArbolEn(geo, x, y);
      if (!n) return tip.ocultar();
      const nombre = { max: 'MAX', min: 'MIN', azar: 'azar', hoja: 'posición final' }[n.tipo];
      tip.mostrar(x, y, `${nombre}<br>valor exacto <b>${fmtV(valorExacto(n))}</b>` + (val.has(n) ? `<br>valor calculado <b>${fmtV(val.get(n))}</b>` : '') +
        (est.get(n) === 'poda' ? '<br>podado: no se evaluó' : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    construir();
  }

  /* ---------- Fig. 2: gato (tres en línea) contra minimax ---------- */

  const LINEAS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const ganador = (t) => { for (const [a, b, c] of LINEAS) if (t[a] && t[a] === t[b] && t[a] === t[c]) return t[a]; return t.every((x) => x) ? 'empate' : null; };

  // Valor para O (la computadora): +, 0 o − con preferencia por ganar pronto. cont.n cuenta nodos.
  function minimax(t, turno, prof, alfa, beta, poda, cont) {
    cont.n++;
    const g = ganador(t);
    if (g === 'O') return 10 - prof;
    if (g === 'X') return prof - 10;
    if (g === 'empate') return 0;
    let mejor = turno === 'O' ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (t[i]) continue;
      t[i] = turno;
      const v = minimax(t, turno === 'O' ? 'X' : 'O', prof + 1, alfa, beta, poda, cont);
      t[i] = '';
      if (turno === 'O') { mejor = Math.max(mejor, v); alfa = Math.max(alfa, v); } else { mejor = Math.min(mejor, v); beta = Math.min(beta, v); }
      if (poda && alfa >= beta) break;
    }
    return mejor;
  }

  function montarGato(cuerpo) {
    let t = Array(9).fill(''), compuEmpieza = false, mostrar = true, ultima = -1, mensaje = '';
    let nMinimax = 0, nAlfaBeta = 0, valores = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'La computadora empieza', valor: compuEmpieza, alCambiar: (v) => { compuEmpieza = v; nueva(); } });
    ctl.casilla({ etiqueta: 'Mostrar el valor de cada jugada', valor: mostrar, alCambiar: (v) => { mostrar = v; dibujar(); } });
    ctl.boton('Nueva partida', () => nueva(), { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { alto: 300 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'X: usted' },
      { color: C.s1, texto: 'O: la computadora' },
      { color: C.s6, texto: 'jugada ganadora para usted' },
      { color: C.apagado, texto: 'lleva a empate' },
      { color: C.s8, texto: 'jugada perdedora' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una casilla vacía para jugar X. La computadora responde con la jugada que minimax considera mejor. Los valores suponen que ambos juegan perfecto desde ahí.');

    function nueva() {
      t = Array(9).fill(''); ultima = -1; nMinimax = 0; nAlfaBeta = 0;
      mensaje = 'Su turno: usted juega X.';
      if (compuEmpieza) jugarCompu();
      evaluar();
      dibujar();
    }
    function jugarCompu() {
      let mejor = -Infinity, jugada = -1;
      const c1 = { n: 0 }, c2 = { n: 0 };
      for (let i = 0; i < 9; i++) {
        if (t[i]) continue;
        t[i] = 'O';
        const v = minimax(t, 'X', 1, -Infinity, Infinity, true, c2);
        minimax(t, 'X', 1, -Infinity, Infinity, false, c1);
        t[i] = '';
        if (v > mejor) { mejor = v; jugada = i; }
      }
      t[jugada] = 'O';
      ultima = jugada;
      nMinimax = c1.n; nAlfaBeta = c2.n;
      const g = ganador(t);
      mensaje = g === 'O' ? 'La computadora gana.' : g === 'empate' ? 'Empate: con juego perfecto de ambos, el gato siempre termina así.' :
        `La computadora juega en la casilla ${jugada + 1}` + (mejor > 0 ? ': ya tiene la victoria asegurada.' : mejor === 0 ? '. Con juego perfecto, empate.' : '.');
    }
    // Para cada casilla libre, resultado de que X juegue ahí (con juego perfecto después).
    function evaluar() {
      valores = null;
      if (ganador(t)) return;
      valores = t.map((x, i) => {
        if (x) return null;
        t[i] = 'X';
        const v = minimax(t, 'O', 1, -Infinity, Infinity, true, { n: 0 });
        t[i] = '';
        return v;
      });
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const lado = Math.min(H - 20, W - 20, 280), x0 = Math.round((W - lado) / 2), y0 = 10, c = lado / 3;
      geo = { x0, y0, lado };
      ctx.strokeStyle = C.tinta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 1; k < 3; k++) {
        ctx.moveTo(x0 + k * c, y0 + 6); ctx.lineTo(x0 + k * c, y0 + lado - 6);
        ctx.moveTo(x0 + 6, y0 + k * c); ctx.lineTo(x0 + lado - 6, y0 + k * c);
      }
      ctx.stroke();
      const linea = LINEAS.find(([a, b, d]) => t[a] && t[a] === t[b] && t[a] === t[d]);
      t.forEach((v, i) => {
        const cx = x0 + (i % 3) * c + c / 2, cy = y0 + Math.floor(i / 3) * c + c / 2, r = c * 0.28;
        if (i === ultima) { ctx.fillStyle = VIZ.alfa(C.s2, 0.15); ctx.fillRect(cx - c / 2 + 4, cy - c / 2 + 4, c - 8, c - 8); }
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        if (v === 'X') {
          ctx.strokeStyle = C.tinta;
          ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
        } else if (v === 'O') {
          ctx.strokeStyle = C.s1;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        } else if (mostrar && valores && valores[i] != null) {
          const val = valores[i];
          const [txt, col] = val < 0 ? ['gana', C.s6] : val > 0 ? ['pierde', C.s8] : ['empata', C.apagado];
          ctx.fillStyle = col;
          ctx.font = VIZ.fuente(c >= 70 ? 12 : 10, 500);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(txt, cx, cy);
        }
      });
      if (linea) {
        const p = (i) => [x0 + (i % 3) * c + c / 2, y0 + Math.floor(i / 3) * c + c / 2];
        ctx.strokeStyle = C.s2;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(...p(linea[0])); ctx.lineTo(...p(linea[2])); ctx.stroke();
      }
      registro.textContent = mensaje;
      lectura.set([
        ['minimax: nodos', nMinimax ? VIZ.entero(nMinimax) : '—'],
        ['alfa-beta: nodos', nAlfaBeta ? VIZ.entero(nAlfaBeta) : '—'],
        ['ahorro de la poda', nMinimax ? `${VIZ.fmt(100 * (1 - nAlfaBeta / nMinimax), 3)} %` : '—'],
        ['casillas libres', String(t.filter((x) => !x).length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo || ganador(t)) return;
      const { x, y } = lienzo.posicion(ev);
      const i = P3(x, y);
      if (i < 0 || t[i]) return;
      t[i] = 'X';
      ultima = i;
      const g = ganador(t);
      if (g === 'X') mensaje = '¡Usted gana! (Solo es posible si la computadora no juega perfecto… o si hay un error.)';
      else if (g === 'empate') mensaje = 'Empate: con juego perfecto de ambos, el gato siempre termina así.';
      else jugarCompu();
      evaluar();
      dibujar();
    });
    function P3(x, y) {
      const { x0, y0, lado } = geo;
      if (x < x0 || y < y0 || x >= x0 + lado || y >= y0 + lado) return -1;
      return Math.floor((y - y0) / (lado / 3)) * 3 + Math.floor((x - x0) / (lado / 3));
    }
    nueva();
  }

  VIZ.registrarTema('multi-agent-search', {
    intro: String.raw`
      <p>Cuando hay más de un agente, el resultado ya no depende solo de nuestras acciones. En un <strong>juego de dos jugadores
      de suma cero</strong> —ajedrez, damas, gato— el otro agente es un adversario que elige lo peor para nosotros, y lo que se busca
      no es un camino sino una <strong>estrategia</strong>: qué hacer ante cada respuesta posible.</p>
      <p>El algoritmo <strong>minimax</strong> recorre el árbol de juego suponiendo que ambos juegan perfecto: MAX elige el mayor
      valor y MIN el menor. La <strong>poda alfa-beta</strong> obtiene el mismo resultado sin mirar ramas que no pueden influir en
      la decisión, y <strong>expectimax</strong> reemplaza al adversario por el azar (o por un rival que no es óptimo) promediando.</p>`,
    visualizaciones: [
      {
        titulo: 'Minimax, alfa-beta y expectimax',
        descripcion: 'Ejecute minimax y luego alfa-beta sobre los mismos valores: el valor de la raíz es idéntico, pero alfa-beta evalúa menos hojas. Active «mejor jugada primero» para ver la poda máxima.',
        montar: montarArbol,
      },
      {
        titulo: 'Gato contra minimax',
        descripcion: 'La computadora explora el árbol completo del juego y nunca pierde. Compare cuántos nodos visitaría minimax puro y cuántos con poda alfa-beta.',
        montar: montarGato,
      },
    ],
    teoria: String.raw`
      <h2>Juegos como búsqueda</h2>
      <p>Un juego de dos jugadores, por turnos, determinista y con información perfecta se describe con un estado inicial, una
      función que dice de quién es el turno, las jugadas legales, una prueba de término y una <em>utilidad</em> \(U(s)\) de cada
      posición final para MAX. En un juego de suma cero, la utilidad de MIN es \(-U(s)\). El <strong>valor minimax</strong> es</p>
      \[ V(s) = \begin{cases} U(s) &amp; s \text{ terminal} \\ \max_{s' \in \text{suc}(s)} V(s') &amp; \text{turno de MAX} \\
         \min_{s' \in \text{suc}(s)} V(s') &amp; \text{turno de MIN.} \end{cases} \]
      <p>Jugar hacia el hijo de mayor \(V\) es óptimo contra un rival óptimo, y nunca peor que \(V(s_0)\) contra cualquier rival.
      Minimax es una DFS: tiempo \(O(b^d)\) y memoria \(O(b\,d)\). El gato tiene 549 946 nodos en su árbol completo; el ajedrez,
      unos \(10^{120}\), por lo que en la práctica se corta a cierta profundidad y se usa una <em>función de evaluación</em>
      heurística en lugar de \(U\).</p>

      <h2>Poda alfa-beta</h2>
      <pre><code>ALFABETA(s, α, β):
    si s es terminal: devolver U(s)
    si es turno de MAX:
        v ← −∞
        para cada sucesor s':
            v ← max(v, ALFABETA(s', α, β));  α ← max(α, v)
            si α ≥ β: salir del ciclo            ▹ corte β
        devolver v
    si es turno de MIN:   (simétrico, con min y β ← min(β, v); corte α)</code></pre>
      <p>\(\alpha\) es el mejor valor que MAX ya tiene asegurado en el camino hasta \(s\), y \(\beta\) el mejor que tiene asegurado
      MIN. Si en un nodo MAX se obtiene \(v \ge \beta\), MIN, que decide más arriba, nunca permitirá llegar a él: el resto de sus
      hijos no importa.</p>
      <div class="recuadro"><strong>Corrección.</strong> Si \(\alpha &lt; V(s) &lt; \beta\), ALFABETA devuelve \(V(s)\) exacto;
      si \(V(s) \le \alpha\) devuelve un valor \(\le \alpha\), y si \(V(s) \ge \beta\) uno \(\ge \beta\). Con la ventana inicial
      \((-\infty, +\infty)\) el valor de la raíz es exactamente el de minimax.</div>
      <p><strong>Costo</strong> (Knuth y Moore, 1975): con el mejor orden posible se evalúan
      \(b^{\lceil d/2 \rceil} + b^{\lfloor d/2 \rfloor} - 1\) hojas, es decir \(O(b^{d/2})\): con el mismo tiempo se puede buscar
      el doble de profundo. Con orden aleatorio, del orden de \(b^{3d/4}\); con el peor orden no poda nada. De ahí la importancia de
      ordenar las jugadas (capturas primero, tablas de historia, profundización iterativa).</p>

      <h2>Expectimax</h2>
      <p>Si en lugar de un adversario hay azar (dados, cartas) o un rival que juega al azar, los nodos MIN se reemplazan por
      nodos de <em>azar</em> que devuelven el valor esperado:</p>
      \[ V(s) = \sum_{s'} P(s' \mid s)\, V(s'). \]
      <p>Expectimax ya no supone lo peor, así que puede aprovechar los errores de un rival imperfecto, pero es sensible a la
      escala de la función de evaluación (no solo a su orden) y la poda requiere cotas sobre los valores.</p>

      <h2>Más de dos agentes</h2>
      <p>Con \(n\) jugadores, cada nodo guarda un vector de utilidades y quien juega maximiza su componente (algoritmo
      max<sup>n</sup>); la variante <em>paranoica</em> supone que todos los demás se alían contra uno y vuelve a minimax. Cuando los
      agentes cooperan —varios robots que deben llegar a sus destinos sin chocar— el problema es de <em>búsqueda multiagente de
      caminos</em>: el estado conjunto crece como \(|V|^k\) con \(k\) agentes, y se usan
      <a href="tema.html?id=a-star">A*</a> sobre el espacio conjunto o métodos que resuelven cada agente por separado y reparan
      los conflictos. Para un solo agente, ver <a href="tema.html?id=single-agent-search">Single-Agent Search</a>.</p>`,
  });
})();
