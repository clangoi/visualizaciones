(function () {
  'use strict';
  const { color: C } = VIZ;
  const H = (n) => { let s = 0; for (let i = 1; i <= n; i++) s += 1 / i; return s; };

  // Mensajes en función del número de procesos n.
  const FAMILIAS = {
    eleccion: {
      nombre: 'Elección de líder',
      series: [
        { nombre: 'Bully, peor caso', f: (n) => (n - 1) ** 2 + n - 2, id: 'bully-algorithm' },
        { nombre: 'Bully, mejor caso', f: (n) => n - 1, id: 'bully-algorithm' },
        { nombre: 'Anillo con lista', f: (n) => 2 * n * n, id: 'ring-election' },
        { nombre: 'Chang–Roberts, peor caso', f: (n) => (n * (n + 1)) / 2 + n, id: 'ring-election' },
        { nombre: 'Chang–Roberts, promedio', f: (n) => n * H(n) + n, id: 'ring-election' },
      ],
    },
    exclusion: {
      nombre: 'Exclusión mutua (por entrada)',
      series: [
        { nombre: 'Servidor central', f: () => 3, id: 'mutual-exclusion' },
        { nombre: 'Ricart–Agrawala', f: (n) => 2 * (n - 1), id: 'mutual-exclusion' },
        { nombre: 'Maekawa (quórums √n)', f: (n) => 3 * Math.ceil(Math.sqrt(n)), id: 'mutual-exclusion' },
        { nombre: 'Lamport (con acuses)', f: (n) => 3 * (n - 1), id: 'mutual-exclusion' },
      ],
    },
    consenso: {
      nombre: 'Consenso y commit',
      series: [
        { nombre: 'Two-Phase Commit', f: (n) => 4 * (n - 1), id: 'two-phase-commit' },
        { nombre: 'Paxos / Raft (por valor, con líder)', f: (n) => 2 * (n - 1), id: 'raft' },
        { nombre: 'OM(1)', f: (n) => (n - 1) + (n - 1) * (n - 2), id: 'byzantine-generals' },
        { nombre: 'OM(2)', f: (n) => (n - 1) + (n - 1) * (n - 2) + (n - 1) * (n - 2) * (n - 3), id: 'byzantine-generals' },
        { nombre: 'Phase King (f = ⌊(n−1)/4⌋)', f: (n) => (Math.floor((n - 1) / 4) + 1) * (n * (n - 1) + n - 1), id: 'phase-king' },
      ],
    },
    difusion: {
      nombre: 'Difusión, orden y búsqueda',
      series: [
        { nombre: 'Probe/echo en un anillo (2|E|)', f: (n) => 2 * n, id: 'probe-echo' },
        { nombre: 'Probe/echo en un grafo completo', f: (n) => n * (n - 1), id: 'probe-echo' },
        { nombre: 'Multicast totalmente ordenado', f: (n) => (n - 1) + n * (n - 1), id: 'totally-ordered-multicast' },
        { nombre: 'Chord: búsqueda (saltos)', f: (n) => Math.max(1, 0.5 * Math.log2(n)), id: 'chord-dht' },
        { nombre: 'Chandy–Lamport (grafo completo)', f: (n) => n * (n - 1), id: 'chandy-lamport' },
      ],
    },
  };

  function montar(cuerpo) {
    const est = { fam: 'eleccion', nmax: 64 };
    let plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', valor: est.fam, opciones: Object.entries(FAMILIAS).map(([k, f]) => [k, f.nombre]), alCambiar: (v) => { est.fam = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Hasta n =', valor: '64', opciones: [['16', '16'], ['64', '64'], ['256', '256'], ['1024', '1 024']], alCambiar: (v) => { est.nmax = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, []);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ambos ejes en escala logarítmica: una recta de pendiente 1 es lineal, de pendiente 2 cuadrática, de pendiente 3 cúbica. Pase el cursor por el gráfico.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const fam = FAMILIAS[est.fam], ns = [];
      for (let n = 3; n <= est.nmax; n = Math.ceil(n * 1.15)) ns.push(n);
      if (ns[ns.length - 1] !== est.nmax) ns.push(est.nmax);
      const vals = fam.series.flatMap((s) => ns.map((n) => s.f(n)));
      plano = VIZ.plano(lienzo, { xmin: Math.log2(3), xmax: Math.log2(est.nmax), ymin: 1, ymax: Math.max(...vals) * 2 },
        { logY: true, etiquetaX: 'procesos n', etiquetaY: 'mensajes', formatoX: (v) => VIZ.entero(2 ** v), ticksX: [2, 3, 4, 5, 6, 7, 8, 9, 10].filter((e) => e <= Math.log2(est.nmax)), formatoY: (v) => (v >= 1e4 ? `10^${Math.round(Math.log10(v))}` : VIZ.entero(v)) });
      plano.ejes();
      fam.series.forEach((s, j) => {
        const col = VIZ.series[j];
        VIZ.trazar(ctx, plano, ns.map((n) => [Math.log2(n), s.f(n)]), col, 2);
        if (hover) VIZ.marcador(ctx, plano.sx(Math.log2(hover)), plano.sy(s.f(hover)), col, 4.5, j);
      });
      if (hover) { ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(plano.sx(Math.log2(hover)) + 0.5, plano.y1); ctx.lineTo(plano.sx(Math.log2(hover)) + 0.5, plano.y0); ctx.stroke(); }
      ley.set(fam.series.map((s, j) => ({ color: VIZ.series[j], texto: s.nombre, forma: 'linea' })));
      const n = hover || est.nmax;
      lectura.set([['n', VIZ.entero(n)], ...fam.series.map((s) => [s.nombre, VIZ.entero(s.f(n))])]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(3, Math.min(est.nmax, Math.round(2 ** plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `n = <b>${VIZ.entero(hover)}</b>` + FAMILIAS[est.fam].series.map((s, j) => VIZ.filaTooltip(VIZ.series[j], s.nombre, VIZ.entero(s.f(hover)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('message-complexity', {
    intro: String.raw`
      <p>En un algoritmo secuencial se cuentan operaciones; en uno distribuido, lo caro es comunicarse. Por eso los algoritmos distribuidos se comparan sobre todo por su
      <strong>complejidad de mensajes</strong> (cuántos mensajes envían en total) y su <strong>complejidad de tiempo</strong> (cuántas rondas, o cuántos retardos de mensaje en
      cadena, tardan en el peor caso), además del tamaño de los mensajes y de cuántas fallas toleran.</p>
      <p>Este tema reúne las fórmulas de los algoritmos de la sección para verlas lado a lado. Las diferencias entre \(O(n)\), \(O(n \log n)\), \(O(n^2)\) y \(O(n^3)\), invisibles
      con cinco procesos, deciden qué es practicable con mil.</p>`,
    visualizaciones: [
      {
        titulo: 'Mensajes según el número de procesos',
        descripcion: 'Elija un problema y compare los algoritmos. Extienda n hasta 1 024: las pendientes en escala log-log revelan el exponente de cada uno.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Medidas de costo</h2>
      <ul>
        <li><strong>Mensajes:</strong> total enviado en el peor caso (o en promedio, sobre entradas o elecciones al azar).</li>
        <li><strong>Tiempo:</strong> en un sistema síncrono, número de rondas; en uno asíncrono, la cadena más larga de mensajes que dependen uno del otro, suponiendo que cada uno tarda a lo más una unidad.</li>
        <li><strong>Bits:</strong> mensajes por tamaño. El anillo con lista envía \(O(n^2)\) mensajes de \(O(n)\) identificadores: \(O(n^3)\) bits.</li>
        <li><strong>Tolerancia:</strong> cuántas fallas, y de qué tipo, se toleran (\(n &gt; 2f\) para caídas con mayorías, \(n &gt; 3f\) para fallas bizantinas).</li>
      </ul>

      <h2>Resumen</h2>
      <table>
        <tr><th>Algoritmo</th><th>Mensajes</th><th>Tiempo</th><th>Fallas</th></tr>
        <tr><td><a href="tema.html?id=bully-algorithm">Bully</a></td><td>\(\Theta(n^2)\) peor, \(n-1\) mejor</td><td>\(O(1)\) rondas por nivel</td><td>Caídas, red síncrona</td></tr>
        <tr><td><a href="tema.html?id=ring-election">Chang–Roberts</a></td><td>\(\Theta(n^2)\) peor, \(\Theta(n\log n)\) promedio</td><td>\(O(n)\)</td><td>Ninguna</td></tr>
        <tr><td><a href="tema.html?id=mutual-exclusion">Ricart–Agrawala</a></td><td>\(2(n-1)\) por entrada</td><td>2 retardos</td><td>Ninguna</td></tr>
        <tr><td><a href="tema.html?id=probe-echo">Probe/echo</a></td><td>\(2|E|\)</td><td>\(O(D)\)</td><td>Ninguna</td></tr>
        <tr><td><a href="tema.html?id=chandy-lamport">Chandy–Lamport</a></td><td>\(|E|\) marcadores</td><td>\(O(D)\)</td><td>Ninguna; canales FIFO</td></tr>
        <tr><td><a href="tema.html?id=two-phase-commit">Two-Phase Commit</a></td><td>\(4(n-1)\)</td><td>4 retardos</td><td>Bloquea si cae el coordinador</td></tr>
        <tr><td><a href="tema.html?id=raft">Raft</a> / <a href="tema.html?id=paxos">Multi-Paxos</a></td><td>\(2(n-1)\) por valor</td><td>2 retardos</td><td>\(f\) caídas con \(2f+1\)</td></tr>
        <tr><td><a href="tema.html?id=byzantine-generals">OM(m)</a></td><td>\(O(n^{m+1})\)</td><td>\(m+1\) rondas</td><td>\(m\) bizantinas, \(n &gt; 3m\)</td></tr>
        <tr><td><a href="tema.html?id=phase-king">Phase King</a></td><td>\(O(f n^2)\)</td><td>\(2(f+1)\) rondas</td><td>\(f\) bizantinas, \(n &gt; 4f\)</td></tr>
        <tr><td><a href="tema.html?id=chord-dht">Chord</a></td><td>\(O(\log n)\) por búsqueda</td><td>\(O(\log n)\)</td><td>Con listas de sucesores</td></tr>
      </table>

      <h2>Cotas inferiores</h2>
      <p>Algunas cotas son inevitables, no defectos de un algoritmo: la elección en un anillo con comparaciones necesita \(\Omega(n\log n)\) mensajes (Frederickson y Lynch); el consenso
      con \(f\) fallas, incluso de caída, necesita \(f + 1\) rondas en un sistema síncrono; el acuerdo bizantino con mensajes orales requiere \(n &gt; 3f\) y \(\Omega(nf)\) mensajes; y en un
      sistema asíncrono el consenso determinista es imposible (FLP). Conocerlas dice cuándo dejar de buscar un algoritmo mejor y empezar a cambiar las hipótesis (aleatoriedad, detectores de fallas,
      firmas, sincronía parcial).</p>`,
  });
})();
