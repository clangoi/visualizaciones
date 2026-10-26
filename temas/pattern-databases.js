(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.busqueda.puzzle;

  /* ---------- Construcción de una base de datos de patrones ----------
     Estado abstracto: posiciones de las fichas del patrón (en orden) y del hueco, codificadas en base 9.
     aditiva = false: todo movimiento cuesta 1 (BFS).
     aditiva = true: solo cuestan los movimientos de fichas del patrón (BFS 0-1); la consulta toma el mínimo sobre el hueco. */
  function construir(fichas, aditiva) {
    const k = fichas.length, tam = Math.pow(9, k + 1);
    const dist = new Int8Array(tam).fill(-1);
    const cod = (p, b) => { let c = 0; for (const x of p) c = c * 9 + x; return c * 9 + b; };
    const decod = (c) => {
      const b = c % 9, p = new Array(k);
      c = (c - b) / 9;
      for (let j = k - 1; j >= 0; j--) { p[j] = c % 9; c = (c - p[j]) / 9; }
      return [p, b];
    };
    let capa = [cod(fichas.map((v) => v - 1), 8)], d = 0, estados = 0;
    while (capa.length) {
      const sig = [];
      for (let i = 0; i < capa.length; i++) {
        const c = capa[i];
        if (dist[c] >= 0) continue;
        dist[c] = d;
        estados++;
        const [p, b] = decod(c);
        for (const m of [-3, 3, -1, 1]) {
          const n = b + m;
          if (n < 0 || n > 8 || (Math.abs(m) === 1 && Math.floor(n / 3) !== Math.floor(b / 3))) continue;
          const j = p.indexOf(n);
          const q = j >= 0 ? p.map((x, t) => (t === j ? b : x)) : p;
          const cn = cod(q, n);
          if (dist[cn] >= 0) continue;
          if (aditiva && j < 0) capa.push(cn); else sig.push(cn);
        }
      }
      capa = sig;
      d++;
    }
    const posiciones = (s) => fichas.map((v) => s.indexOf(v));
    return {
      fichas, aditiva, estados, entradas: aditiva ? Math.pow(9, k) : tam,
      h(s) {
        const p = posiciones(s);
        if (!aditiva) return dist[cod(p, s.indexOf(0))];
        let m = Infinity;
        for (let b = 0; b < 9; b++) { const v = dist[cod(p, b)]; if (v >= 0 && v < m) m = v; }
        return m;
      },
    };
  }
  const cache = new Map();
  function pdb(fichas, aditiva) {
    const clave = fichas.join('') + (aditiva ? 'a' : 's');
    if (!cache.has(clave)) cache.set(clave, construir(fichas, aditiva));
    return cache.get(clave);
  }

  /* ---------- Fig. 1: abstracción y consulta ---------- */

  function montarAbstraccion(cuerpo) {
    let A = [1, 2, 3, 4], tipo = 'aditiva', semilla = 3, estado = P.mezclar(VIZ.semilla(3), 40), mensaje = '';
    const complemento = () => [1, 2, 3, 4, 5, 6, 7, 8].filter((v) => !A.includes(v));

    const ctl = VIZ.controles(cuerpo);
    ctl.casillas([1, 2, 3, 4, 5, 6, 7, 8].map((v) => ({ clave: v, texto: `ficha ${v}`, activo: A.includes(v) })), (e) => {
      const nuevo = [1, 2, 3, 4, 5, 6, 7, 8].filter((v) => e[v]);
      if (nuevo.length < 2 || nuevo.length > 6) {
        mensaje = `El patrón A debe tener entre 2 y 6 fichas (el resto forma el patrón B, también de 2 a 6). Se mantiene A = {${A.join(', ')}}.`;
      } else { A = nuevo; mensaje = ''; }
      dibujar();
    });
    ctl.selector({ etiqueta: 'Tipo de base de datos', opciones: [['aditiva', 'Aditivas (A + B)'], ['simple', 'Simples (máx(A, B))']], valor: tipo,
      alCambiar: (v) => { tipo = v; mensaje = ''; dibujar(); } });
    ctl.boton('Mezclar', () => { semilla++; estado = P.mezclar(VIZ.semilla(semilla), 40); mensaje = ''; dibujar(); }, { primario: true });
    ctl.boton('Meta', () => { estado = P.META.slice(); mensaje = ''; dibujar(); });

    const columnas = (w) => (w >= 620 ? 3 : 2);
    const ladoDe = (w) => Math.min(200, Math.floor((w - 20 * (columnas(w) + 1)) / columnas(w)));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (columnas(w) === 3 ? 1 : 2) * (ladoDe(w) + 44) + 6 });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.25), borde: C.tinta, texto: 'fichas del patrón A' },
      { color: VIZ.alfa(C.s2, 0.25), borde: C.tinta, texto: 'fichas del patrón B' },
      { color: C.tenue, borde: C.tinta, texto: 'ficha indistinguible («no importa»)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque las fichas del patrón A; las demás forman el patrón B. Haga clic en una ficha del tablero de la izquierda, vecina al hueco, para moverla.');

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const B = complemento();
      const pa = pdb(A, tipo === 'aditiva'), pb = pdb(B, tipo === 'aditiva');
      const ha = pa.h(estado), hb = pb.h(estado);
      const comb = tipo === 'aditiva' ? ha + hb : Math.max(ha, hb);
      const cols = columnas(W), lado = ladoDe(W);
      const sep = (W - cols * lado) / (cols + 1);
      const celdas = [
        ['estado', null, `h* = ${P.hEstrella(estado)}`],
        ['A', A, `A: ${ha}`],
        ['B', B, `B: ${hb}`],
      ];
      celdas.forEach(([nombre, fichas, txt], k) => {
        const c = k % cols, f = Math.floor(k / cols);
        const x = Math.round(sep + c * (lado + sep)), y = 6 + f * (lado + 44);
        if (!fichas) geo = { x, y, lado };
        const colorP = nombre === 'A' ? C.s1 : C.s2;
        P.dibujarTablero(ctx, estado, x, y, lado, {
          relleno: (v) => (!fichas ? (A.includes(v) ? VIZ.alfa(C.s1, 0.25) : VIZ.alfa(C.s2, 0.25)) : fichas.includes(v) ? VIZ.alfa(colorP, 0.25) : C.tenue),
          texto: (v) => (!fichas || fichas.includes(v) ? C.tinta : C.tenue),
        });
        ctx.fillStyle = C.tinta;
        ctx.font = VIZ.fuente(12, 500);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(!fichas ? `estado · ${txt}` : `abstracción ${nombre} · h = ${nombre === 'A' ? ha : hb}`, x + lado / 2, y + lado + 8);
      });
      const md = P.manhattan(estado), hs = P.hEstrella(estado);
      registro.textContent = mensaje || (tipo === 'aditiva'
        ? `Las bases de A y B cuentan movimientos disjuntos, así que se pueden sumar: h = ${ha} + ${hb} = ${comb} ≤ h* = ${hs}.`
        : `Cada base cuenta todos los movimientos de su abstracción; sumarlas podría sobreestimar, así que se toma el máximo: h = máx(${ha}, ${hb}) = ${comb}.`);
      lectura.set([
        ['h combinada', String(comb)],
        ['Manhattan', String(md)],
        ['h*', String(hs)],
        ['estados abstractos A', VIZ.entero(pa.estados)],
        ['estados abstractos B', VIZ.entero(pb.estados)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const t = P.mover(estado, P.casillaEn(x, y, geo.x, geo.y, geo.lado));
      if (t) { estado = t; mensaje = ''; dibujar(); }
    });
    dibujar();
  }

  /* ---------- Fig. 2: precisión comparada sobre todos los estados ---------- */

  const PARTICIONES = [
    ['1234', '1 2 3 4 | 5 6 7 8'],
    ['1245', '1 2 4 5 | 3 6 7 8'],
    ['147', '1 4 7 | 2 3 5 6 8'],
    ['123', '1 2 3 | 4 5 6 7 8'],
    ['123456', '1 2 3 4 5 6 | 7 8'],
  ];

  function montarPrecision(cuerpo) {
    let part = '1234', hover = null, series = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Partición A | B', opciones: PARTICIONES, valor: part, alCambiar: (v) => { part = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const NOMBRES = [
      { nombre: 'Manhattan', color: C.s1 },
      { nombre: 'máx(A, B) simples', color: C.s2 },
      { nombre: 'A + B aditivas', color: C.s3 },
    ];
    VIZ.leyenda(cuerpo, [...NOMBRES.map((s) => ({ color: s.color, texto: s.nombre, forma: 'linea' })), { color: C.apagado, texto: 'h = h*', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto promedia todos los estados que están a esa distancia real de la meta. Pase el cursor para ver los valores.');

    const niveles = P.porNivel();
    function calcular() {
      const A = part.split('').map(Number), B = [1, 2, 3, 4, 5, 6, 7, 8].filter((v) => !A.includes(v));
      const sa = pdb(A, false), sb = pdb(B, false), aa = pdb(A, true), ab = pdb(B, true);
      const f = [P.manhattan, (s) => Math.max(sa.h(s), sb.h(s)), (s) => aa.h(s) + ab.h(s)];
      const prom = f.map(() => []), glob = [0, 0, 0];
      let mejor = 0, total = 0;
      niveles.forEach((l) => {
        const suma = [0, 0, 0];
        for (const c of l) {
          const s = P.decodificar(c);
          const v = f.map((g) => g(s));
          v.forEach((x, k) => { suma[k] += x; glob[k] += x; });
          if (v[2] > v[0]) mejor++;
        }
        total += l.length;
        suma.forEach((x, k) => prom[k].push(x / l.length));
      });
      series = { prom, glob, total, mejor, entradas: sa.entradas + sb.entradas + aa.entradas + ab.entradas };
      dibujar();
    }

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const D = niveles.length - 1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: D, ymin: 0, ymax: D }, { etiquetaX: 'distancia real h*', etiquetaY: 'h promedio' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, 0], [D, D]], C.apagado, 1.5, [3, 4]);
      NOMBRES.forEach((s, k) => {
        const pts = series.prom[k].map((v, d) => [d, v]);
        VIZ.trazar(ctx, plano, pts, s.color, 2);
        if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(pts[hover][1]), s.color, 4);
      });
      lectura.set([
        ...NOMBRES.map((s, k) => [`${s.nombre}: media`, VIZ.fmt(series.glob[k] / series.total, 3)]),
        ['aditiva > Manhattan', `${VIZ.fmt((100 * series.mejor) / series.total, 3)} % de los estados`],
      ]);
    }
    lienzo.alDibujar = () => series && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(niveles.length - 1, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `h* = <b>${hover}</b>` + NOMBRES.map((s, k) => VIZ.filaTooltip(s.color, s.nombre, VIZ.fmt(series.prom[k][hover], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('pattern-databases', {
    intro: String.raw`
      <p>Las heurísticas como Manhattan consideran cada ficha por separado e ignoran cómo se estorban entre sí. Una
      <strong>base de datos de patrones</strong> (PDB, Culberson y Schaeffer, 1998) captura esas interacciones para un subconjunto
      de fichas, el <em>patrón</em>: se olvidan las demás fichas («no importa» dónde estén), se resuelve <em>exactamente</em> ese
      problema abstracto para todos sus estados y se guardan las distancias en una tabla.</p>
      <p>Durante la búsqueda, la heurística de un estado es una consulta a la tabla: tiempo constante y, como la abstracción
      solo puede acortar caminos, siempre admisible. Con varios patrones disjuntos y contando solo los movimientos de las fichas
      de cada patrón, los valores incluso se pueden <strong>sumar</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Abstraer, precalcular, consultar',
        descripcion: 'Elija qué fichas forman el patrón A y compare las dos formas de combinar las bases: el máximo de bases simples o la suma de bases aditivas. Ambas son siempre \\(\\le h^*\\).',
        montar: montarAbstraccion,
      },
      {
        titulo: 'Más informadas que Manhattan',
        descripcion: 'La suma de bases aditivas domina a Manhattan (con patrones de una ficha sería exactamente Manhattan). Pruebe distintas particiones: los patrones más grandes capturan más interacciones.',
        montar: montarPrecision,
      },
    ],
    teoria: String.raw`
      <h2>Abstracciones</h2>
      <p>Una <strong>abstracción</strong> es una función \(\phi : S \to S'\) que lleva cada estado a un estado de un espacio más
      pequeño, de modo que toda acción \(u \to v\) del problema original corresponde a una acción \(\phi(u) \to \phi(v)\) (o a no
      moverse) en el abstracto. En el 8-puzzle con patrón \(A\), \(\phi(s)\) conserva la posición del hueco y de las fichas de
      \(A\) y reemplaza las demás por fichas indistinguibles.</p>
      <div class="recuadro"><strong>Admisibilidad.</strong> Sea \(h_\phi(s) = \delta'(\phi(s), \phi(t))\), la distancia en el espacio
      abstracto. Todo camino \(s \to t\) de costo \(c\) se proyecta en un camino \(\phi(s) \to \phi(t)\) de costo \(\le c\); por lo
      tanto \(h_\phi(s) \le h^*(s)\). El mismo argumento sobre una sola acción da consistencia:
      \(h_\phi(u) \le w(u, v) + h_\phi(v)\).</div>

      <h2>Construcción</h2>
      <p>Se hace una búsqueda en anchura <em>hacia atrás</em> desde la meta abstracta y se guarda la distancia de cada estado
      abstracto. Con \(k\) fichas en el patrón del 8-puzzle hay \(9!/(8-k)!\) estados abstractos (posiciones del hueco y de las
      \(k\) fichas): 15 120 para \(k = 4\), 181 440 para \(k = 6\). En el 15-puzzle, el patrón «borde» de 7 fichas más el hueco da
      \(16!/8! \approx 5.2 \times 10^8\) entradas, que caben en 500 MB con un byte por entrada.</p>
      <pre><code>CONSTRUIR(φ):
    tabla[φ(t)] ← 0;  cola ← [φ(t)]
    mientras cola no vacía:
        u ← sacar de cola
        para cada predecesor abstracto v de u sin entrada en tabla:
            tabla[v] ← tabla[u] + 1;  agregar v a cola
h(s) = tabla[φ(s)]</code></pre>

      <h2>Combinar varias bases</h2>
      <p>Si se tienen bases para los patrones \(A\) y \(B\), \(\max(h_A, h_B)\) es admisible. La suma \(h_A + h_B\) en general
      <em>no</em> lo es, porque ambas cuentan los movimientos de las fichas indistinguibles y el mismo movimiento se cobraría dos
      veces.</p>
      <p><strong>Bases aditivas disjuntas</strong> (Korf y Felner, 2002): si los patrones son disjuntos y cada base cuenta solo los
      movimientos de <em>sus</em> fichas (los demás cuestan 0), cada movimiento real se cobra en a lo más una base, y</p>
      \[ h(s) = \sum_{i} h_{A_i}(s) \le h^*(s). \]
      <p>La distancia Manhattan es el caso extremo con un patrón por ficha. Con bases aditivas de 6 fichas (más reflexiones),
      IDA* resolvió por primera vez instancias al azar del 24-puzzle.</p>

      <h2>Más allá de los rompecabezas</h2>
      <p>Las PDB se usan en el cubo de Rubik (Korf, 1997), en alineamiento de secuencias y en planificación automática, donde
      <strong>Edelkamp</strong> (2001) mostró cómo construirlas automáticamente a partir de la descripción del problema
      eligiendo qué variables abstraer, y cómo representarlas en forma compacta con diagramas de decisión binarios
      (<em>PDB simbólicas</em>). Otras mejoras son la compresión (guardar un valor por grupo de entradas) y las consultas
      adicionales por simetría.</p>`,
  });
})();
