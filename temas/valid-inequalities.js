(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  const trazo = (ctx, plano, poli) => { ctx.beginPath(); poli.forEach((p, i) => (i ? ctx.lineTo(plano.sx(p[0]), plano.sy(p[1])) : ctx.moveTo(plano.sx(p[0]), plano.sy(p[1])))); ctx.closePath(); };
  const CAJA = { xmin: -1, xmax: 2000, ymin: -1, ymax: 5 };
  const pct = (v) => `${VIZ.fmt(100 * v, 3)} %`;

  /* ---------- Fig. 1: big-M flojo frente a ajustado ---------- */

  // Producción x (capacidad U) que exige abrir la planta y ∈ {0,1}:  max x − f·y  s.a.  x ≤ M·y,  x ≤ U,  0 ≤ y ≤ 1.
  const U = 100;
  function montarBigM(cuerpo) {
    let M = 500, f = 60, tight = false, plano = null;
    const ctl = VIZ.controles(cuerpo);
    const rM = ctl.rango({ etiqueta: 'Constante M de x ≤ M·y', min: U, max: 1000, paso: 50, valor: M, alCambiar: (v) => { M = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo fijo f', min: 10, max: 150, paso: 5, valor: f, alCambiar: (v) => { f = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Agregar la desigualdad válida x ≤ 100·y', valor: tight, alCambiar: (v) => { tight = v; dibujar(); } });
    ctl.boton('M ajustado (M = 100)', () => { M = U; rM.valor = M; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'región de la relajación' },
      { color: C.s6, texto: 'envoltura de las soluciones enteras', forma: 'linea' },
      { color: C.tinta2, texto: 'soluciones enteras (y = 0 ó 1)', forma: 'punto' },
      { color: C.s2, texto: 'óptimo relajado', forma: 'punto' },
      { color: C.s6, texto: 'óptimo entero', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se maximiza la ganancia \\(x - f\\,y\\): producir \\(x\\) unidades exige abrir la planta (\\(y = 1\\)), que cuesta \\(f\\). Con una \\(M\\) holgada la relajación abre solo la fracción \\(y = x/M\\) de la planta. Pase el cursor para ver cada punto.');

    const filas = () => {
      const r = [{ a: [1, -M], b: 0 }, { a: [1, 0], b: U }, { a: [0, 1], b: 1 }, { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }];
      if (tight) r.push({ a: [1, -U], b: 0 });
      return r;
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: U * 1.05, ymin: 0, ymax: 1.1 }, { etiquetaX: 'x (producción)', etiquetaY: 'y (planta abierta)', ticksY: [0, 0.25, 0.5, 0.75, 1] });
      plano.ejes();
      const poli = O.poligono(filas(), CAJA);
      const c = [1, -f];
      const lp = O.optimo2d(poli, c);
      const ipz = Math.max(0, U - f);
      trazo(ctx, plano, poli); ctx.fillStyle = VIZ.alfa(C.s1, 0.2); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke();
      // Envoltura entera: triángulo (0,0), (0,1), (U,1).
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.s6; ctx.lineWidth = 2;
      trazo(ctx, plano, [[0, 0], [0, 1], [U, 1]]); ctx.stroke(); ctx.restore();
      // Soluciones enteras: el origen y el segmento y = 1.
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(plano.sx(0), plano.sy(1)); ctx.lineTo(plano.sx(U), plano.sy(1)); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.beginPath(); ctx.arc(plano.sx(0), plano.sy(0), 4, 0, 7); ctx.fill();
      VIZ.marcador(ctx, plano.sx(ipz > 0 ? U : 0), plano.sy(ipz > 0 ? 1 : 0), C.s6, 6.5, 0);
      VIZ.marcador(ctx, plano.sx(lp.x[0]), plano.sy(lp.x[1]), C.s2, 6, 3);
      const gap = lp.z - ipz;
      lectura.set([
        ['óptimo relajado', `${VIZ.fmt(lp.z)} en (${VIZ.fmt(lp.x[0], 3)}; ${VIZ.fmt(lp.x[1], 3)})`],
        ['óptimo entero', VIZ.fmt(ipz)],
        ['brecha', `${VIZ.fmt(gap)}${ipz > 0 ? ' (' + pct(gap / ipz) + ')' : ''}`],
        ['fracción de planta pagada', pct(lp.x[1])],
      ]);
      registro.textContent = gap < 1e-9 ? 'La relajación coincide con el óptimo entero: la formulación es ajustada para esta ganancia.'
        : `Con M = ${M} la relajación produce x = ${VIZ.fmt(lp.x[0], 3)} abriendo solo y = ${VIZ.fmt(lp.x[1], 3)} de la planta y paga el ${pct(lp.x[1])} del costo fijo; ${ipz > 0 ? 'el entero abre la planta completa' : 'el entero no produce nada'}. Eso deja una brecha de ${VIZ.fmt(gap)}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const px = plano.ix(x), py = plano.iy(y);
      const ok = filas().every((r) => r.a[0] * px + r.a[1] * py <= r.b + 1e-9);
      const entero = (Math.abs(py) < 0.03 && px < 1) || (Math.abs(py - 1) < 0.03 && px >= 0 && px <= U);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(px, 3)}</b>, y = <b>${VIZ.fmt(py, 3)}</b><br>${ok ? 'dentro de la relajación' : 'fuera de la relajación'}${ok && !entero ? '<br>fraccionario: no corresponde a una decisión real' : ''}<br>ganancia ${VIZ.fmt(px - f * py)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: localización de instalaciones, débil frente a fuerte ---------- */

  function instancia(semilla, F = 3, K = 5) {
    const r = VIZ.semilla(semilla * 13 + 1);
    const fac = Array.from({ length: F }, () => [r(), r()]), cli = Array.from({ length: K }, () => [r(), r()]);
    return { fac, cli, c: fac.map((p) => cli.map((q) => Math.round(Math.hypot(p[0] - q[0], p[1] - q[1]) * 60))), F, K };
  }
  // min Σ f y + Σ c x   s.a.  Σ_i x_ij = 1,   (débil) Σ_j x_ij ≤ K y_i   o   (fuerte) x_ij ≤ y_i,   0 ≤ y ≤ 1,  y entero.
  function modelo(I, fijo, fuerte) {
    const { F, K } = I, n = F + F * K, idx = (i, j) => F + i * K + j;
    const cost = Array(n).fill(0);
    for (let i = 0; i < F; i++) { cost[i] = fijo; for (let j = 0; j < K; j++) cost[idx(i, j)] = I.c[i][j]; }
    const A = [], b = [], sen = [];
    for (let j = 0; j < K; j++) { const g = Array(n).fill(0); for (let i = 0; i < F; i++) g[idx(i, j)] = 1; A.push(g); b.push(1); sen.push('='); }
    if (fuerte) { for (let i = 0; i < F; i++) for (let j = 0; j < K; j++) { const g = Array(n).fill(0); g[idx(i, j)] = 1; g[i] = -1; A.push(g); b.push(0); sen.push('<='); } }
    else for (let i = 0; i < F; i++) { const g = Array(n).fill(0); for (let j = 0; j < K; j++) g[idx(i, j)] = 1; g[i] = -K; A.push(g); b.push(0); sen.push('<='); }
    for (let i = 0; i < F; i++) { const g = Array(n).fill(0); g[i] = 1; A.push(g); b.push(1); sen.push('<='); }
    return { n, cost, A, b, sen, enteras: Array.from({ length: n }, (_, k) => k < F), idx };
  }
  function resolver(I, fijo) {
    const res = {};
    for (const fuerte of [false, true]) {
      const M = modelo(I, fijo, fuerte);
      const lp = O.lp(M.cost, M.A, M.sen, M.b, { max: false });
      let fin; for (fin of O.ramificar(M.cost.map((v) => -v), M.A, M.sen, M.b, { enteras: M.enteras, maxNodos: 300 }));
      res[fuerte ? 'fuerte' : 'debil'] = { lp, ip: fin.incumbente ? { x: fin.incumbente.x, z: -fin.incumbente.z } : null, nodos: fin.nodos.length, filas: M.A.length };
    }
    return res;
  }

  function montarLocalizacion(cuerpo) {
    let semilla = 1, fijo = 15, vista = 'debil', I = instancia(semilla), R = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Costo fijo por instalación', min: 4, max: 80, valor: fijo, alCambiar: (v) => { fijo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Mostrar solución', opciones: [['debil', 'relajación débil'], ['fuerte', 'relajación fuerte'], ['entera', 'óptimo entero']], valor: vista, alCambiar: (v) => { vista = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla = semilla % 5 + 1; I = instancia(semilla); dibujar(); }, { primario: true });

    const mapa = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 250, altoMax: 400 });
    const tip = VIZ.tooltip(mapa);
    VIZ.subtitulo(cuerpo, 'Cota de cada formulación');
    const recta = VIZ.lienzo(cuerpo, { alto: 110 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'instalación (relleno ∝ y)', forma: 'cuadro' },
      { color: C.tinta2, texto: 'cliente', forma: 'punto' },
      { color: C.s2, texto: 'asignación (grosor ∝ x)', forma: 'linea' },
      { color: C.s3, texto: 'cota con formulación débil', forma: 'punto' },
      { color: C.s7, texto: 'cota con formulación fuerte', forma: 'punto' },
      { color: C.s6, texto: 'óptimo entero', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ambas formulaciones tienen el mismo óptimo entero. La débil agrega una restricción por instalación, \\(\\sum_j x_{ij} \\le 5\\,y_i\\); la fuerte, una por cada par, \\(x_{ij} \\le y_i\\). Cambie la vista para ver cuánto «abre» cada relajación cada instalación, y suba el costo fijo para ver cómo se mueve la brecha.');

    const NOM = ['A', 'B', 'C'];
    function dibujar() {
      R = resolver(I, fijo);
      const { ctx, ancho: W, alto: H } = mapa;
      mapa.limpiar();
      const sol = vista === 'entera' ? { x: R.fuerte.ip.x } : { x: R[vista].lp.x };
      const m = 26, X = (p) => m + p[0] * (W - 2 * m), Y = (p) => m + p[1] * (H - 2 * m);
      geo = [];
      const F = I.F, K = I.K;
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      for (let i = 0; i < F; i++) for (let j = 0; j < K; j++) {
        const v = sol.x[F + i * K + j];
        if (v < 0.01) continue;
        ctx.strokeStyle = C.s2; ctx.lineWidth = 1 + 5 * v; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(X(I.fac[i]), Y(I.fac[i])); ctx.lineTo(X(I.cli[j]), Y(I.cli[j])); ctx.stroke(); ctx.globalAlpha = 1;
      }
      I.cli.forEach((q, j) => {
        ctx.fillStyle = C.tinta2; ctx.beginPath(); ctx.arc(X(q), Y(q), 8, 0, 7); ctx.fill();
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(j + 1), X(q), Y(q) + 0.5);
        geo.push({ x: X(q), y: Y(q), r: 9, tipo: 'cliente', j });
      });
      I.fac.forEach((p, i) => {
        const y = sol.x[i];
        ctx.fillStyle = C.superficie; ctx.fillRect(X(p) - 15, Y(p) - 15, 30, 30);
        ctx.fillStyle = VIZ.alfa(C.s1, 0.12 + 0.88 * y); ctx.fillRect(X(p) - 15, Y(p) - 15, 30, 30);
        ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.strokeRect(X(p) - 15, Y(p) - 15, 30, 30);
        ctx.fillStyle = y > 0.6 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(NOM[i], X(p), Y(p) + 0.5);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'top'; ctx.fillText(`y = ${VIZ.fmt(y, 2)}`, X(p), Y(p) + 18);
        geo.push({ x: X(p), y: Y(p), r: 17, tipo: 'instalacion', i });
      });
      // Recta numérica de las cotas.
      const rc = recta, c2 = rc.ctx;
      rc.limpiar();
      const vals = [R.debil.lp.z, R.fuerte.lp.z, R.debil.ip.z];
      const lo = Math.min(...vals) - 4, hi = Math.max(...vals) + 4, izq = 24, der = rc.ancho - 24, sx = (v) => izq + ((v - lo) / (hi - lo)) * (der - izq);
      c2.strokeStyle = C.eje; c2.lineWidth = 2; c2.beginPath(); c2.moveTo(izq, 66); c2.lineTo(der, 66); c2.stroke();
      c2.fillStyle = VIZ.alfa(C.s1, 0.15); c2.fillRect(sx(R.debil.lp.z), 58, sx(R.debil.ip.z) - sx(R.debil.lp.z), 16);
      [[R.debil.lp.z, C.s3, 'débil', 40], [R.fuerte.lp.z, C.s7, 'fuerte', 20], [R.debil.ip.z, C.s6, 'entero', 88]].forEach(([v, col, t, yy]) => {
        VIZ.marcador(c2, sx(v), 66, col, 6);
        c2.fillStyle = C.tinta; c2.font = VIZ.fuente(11, 600); c2.textAlign = 'center'; c2.textBaseline = 'middle';
        c2.fillText(`${t} ${VIZ.fmt(v)}`, Math.min(Math.max(sx(v), 50), rc.ancho - 50), yy);
      });
      c2.fillStyle = C.apagado; c2.font = VIZ.fuente(10); c2.textAlign = 'left'; c2.fillText('menor costo →', izq, 104);
      const g = (a) => (R.debil.ip.z - a) / R.debil.ip.z;
      lectura.set([
        ['cota débil / fuerte', `${VIZ.fmt(R.debil.lp.z)} / ${VIZ.fmt(R.fuerte.lp.z)}`],
        ['óptimo entero', VIZ.fmt(R.debil.ip.z)],
        ['brecha débil / fuerte', `${pct(g(R.debil.lp.z))} / ${pct(g(R.fuerte.lp.z))}`],
        ['nodos de ramificación', `${R.debil.nodos} / ${R.fuerte.nodos}`],
        ['restricciones de enlace', `${I.F} / ${I.F * I.K}`],
      ]);
      registro.textContent = R.debil.lp.z >= R.debil.ip.z - 1e-6 ? 'Con este costo fijo ambas relajaciones ya son tan buenas como el óptimo.'
        : `La relajación débil abre fracciones de varias instalaciones y obtiene ${VIZ.fmt(R.debil.lp.z)}; la fuerte llega a ${VIZ.fmt(R.fuerte.lp.z)}${Math.abs(R.fuerte.lp.z - R.debil.ip.z) < 1e-6 ? ', que ya es el óptimo entero' : ', más cerca del óptimo ' + VIZ.fmt(R.debil.ip.z)}, y el árbol pasa de ${R.debil.nodos} a ${R.fuerte.nodos} nodos.`;
    }
    mapa.alDibujar = dibujar;
    recta.alDibujar = () => R && dibujar();
    mapa.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = mapa.posicion(ev), g = geo.find((q) => Math.hypot(q.x - x, q.y - y) <= q.r);
      if (!g || !R) return tip.ocultar();
      if (g.tipo === 'cliente') tip.mostrar(x, y, `cliente <b>${g.j + 1}</b><br>costo de servirlo desde A/B/C: ${I.c.map((f) => f[g.j]).join(' / ')}`);
      else tip.mostrar(x, y, `instalación <b>${NOM[g.i]}</b><br>costo fijo ${fijo}<br>costo de atender los clientes: ${I.c[g.i].join(', ')}`);
    });
    mapa.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('valid-inequalities', {
    intro: String.raw`
      <p>Un mismo problema entero puede escribirse con distintas restricciones que aceptan exactamente las mismas soluciones enteras y, sin embargo, tienen relajaciones lineales muy diferentes.
      Una <strong>formulación fuerte</strong> es aquella cuya relajación queda pegada a la envoltura convexa de las soluciones enteras; una débil deja una región mucho mayor, con puntos fraccionarios de apariencia engañosa.</p>
      <p>Una <strong>desigualdad válida</strong> es una restricción extra que cumplen todas las soluciones enteras. Agregarla no cambia el óptimo entero, pero puede recortar la relajación y mejorar la cota. En la práctica es la diferencia entre un árbol de ramificación de miles de nodos y uno de unos pocos.</p>`,
    visualizaciones: [
      {
        titulo: 'Big-M flojo frente a ajustado',
        descripcion: 'La condición \\(x \\le M y\\) liga la producción con la apertura de la planta. Suba \\(M\\) y la región relajada se abre hacia abajo: la relajación «paga» solo una fracción del costo fijo. Pulse «M ajustado» o marque la desigualdad válida \\(x \\le 100\\,y\\) y la región coincide con la envoltura verde.',
        montar: montarBigM,
      },
      {
        titulo: 'Localización: formulación débil frente a fuerte',
        descripcion: 'Tres instalaciones y cinco clientes. Compare la solución de la relajación débil (muchas instalaciones medio abiertas) con la fuerte, y con el óptimo entero. Fíjese en la recta de cotas y en cuántos nodos necesita cada formulación; mueva el costo fijo y pruebe «Nuevos datos».',
        montar: montarLocalizacion,
      },
    ],
    teoria: String.raw`
      <h2>Formulaciones y envoltura convexa</h2>
      <p>Una formulación de \(X \subseteq \mathbb{Z}^n\) es un poliedro \(P\) con \(P \cap \mathbb{Z}^n = X\). Entre todas las formulaciones, la mejor es \(\operatorname{conv}(X)\): si \(P = \operatorname{conv}(X)\), resolver el LP
      sobre \(P\) da directamente el óptimo entero. Dadas dos formulaciones \(P_1 \subseteq P_2\), la primera es <strong>más fuerte</strong>: su cota \(z_{LP}\) nunca es peor.</p>
      <p>Una desigualdad \(\pi^\top x \le \pi_0\) es <strong>válida</strong> si \(X \subseteq \{\pi^\top x \le \pi_0\}\); es una <strong>faceta</strong> si define una cara de dimensión máxima de \(\operatorname{conv}(X)\), es decir, la mejor desigualdad posible en su dirección. Los <a href="tema.html?id=cutting-planes">planos cortantes</a>
      agregan desigualdades válidas que el óptimo relajado viola; aquí se agregan desde el principio, al modelar.</p>
      <h2>Big-M flojo y ajustado</h2>
      <p>Para que una variable continua \(x\) solo sea positiva si una binaria \(y\) vale 1 se escribe \(x \le M y\). Cualquier \(M \ge U\) (la cota real de \(x\)) es correcta, pero la relajación con \(y \in [0,1]\) permite \(y = x/M\): a mayor \(M\), menos costo fijo paga la relajación.
      Con el objetivo \(\max\, x - f y\), \(x \le U\):</p>
      \[ z_{LP}(M) = U - f\,\frac{U}{M} \quad (f < M), \qquad z_{IP} = \max(0,\; U - f). \]
      <p>Con \(M = U\) y \(f &lt; U\) la brecha se anula. Con \(U = 100\), \(f = 60\) y \(M = 500\), la relajación vale \(100 - 12 = 88\) frente a \(z_{IP} = 40\). La regla práctica: <em>use la menor \(M\) que sea válida</em>; si no se conoce, derívela de los datos (capacidades, demanda máxima).
      Las desigualdades \(x \le U y\) son las facetas de la envoltura \(\operatorname{conv}\{(0,0)\} \cup \{(x,1) : 0 \le x \le U\}\).</p>
      <h2>Localización de instalaciones</h2>
      <p>Con instalaciones \(i\) (costo fijo \(f_i\)) y clientes \(j\) (costo \(c_{ij}\) de atenderlos desde \(i\)), las variables son \(y_i \in \{0,1\}\) y \(x_{ij} \in [0,1]\):</p>
      \[ \min \sum_i f_i y_i + \sum_{i,j} c_{ij} x_{ij} \quad \text{s.a.}\quad \sum_i x_{ij} = 1 \;\;\forall j. \]
      <p>La formulación <strong>débil</strong> enlaza con \(\sum_j x_{ij} \le n\,y_i\) (una por instalación); la <strong>fuerte</strong> usa \(x_{ij} \le y_i\) (una por par). Ambas aceptan las mismas soluciones enteras, pero la fuerte implica la débil sumando sobre \(j\), mientras que la débil permite, por ejemplo,
      \(y_i = 1/n\) con un solo cliente servido por entero. Cuesta más restricciones, pero la brecha y el árbol se reducen, como muestra la figura.</p>
      <h2>Más ejemplos</h2>
      <ul>
        <li><strong>Lot sizing:</strong> \(x_t \le M y_t\) con \(M = \sum_{s \ge t} d_s\) en lugar de una constante enorme; añadir las desigualdades \((\ell,S)\) cierra gran parte de la brecha.</li>
        <li><strong>Mochila:</strong> las desigualdades de cobertura \(\sum_{j \in C} x_j \le |C| - 1\) son válidas para cualquier conjunto \(C\) cuyo peso excede la capacidad.</li>
        <li><strong>Eliminación de subtours</strong> en rutas, agregadas solo cuando se violan.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>Una relajación ajustada se traduce en podas tempranas en <a href="tema.html?id=milp-branch-and-bound">ramificación y acotamiento</a> y en menor brecha, como se ve en <a href="tema.html?id=node-pruning-gap">poda y brecha de optimalidad</a>.
      Para el punto de partida, véase <a href="tema.html?id=lp-relaxation">relajación lineal</a>; para los modelos concretos, <a href="tema.html?id=lot-sizing">lot sizing</a> y <a href="tema.html?id=piecewise-linear">funciones lineales por tramos</a>.</p>`,
  });
})();
