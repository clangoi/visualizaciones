(function () {
  'use strict';
  const { color: C } = VIZ;
  const XM = 100;
  const FUN = {
    escala: { nombre: 'economía de escala: 15·√x', f: (x) => 15 * Math.sqrt(x) },
    cuadratica: { nombre: 'costo creciente: 0.03·x²', f: (x) => 0.03 * x * x },
    sigmoide: { nombre: 'curva en S: 150/(1+e^(−(x−50)/15))', f: (x) => 150 / (1 + Math.exp(-(x - 50) / 15)) },
  };
  const interp = (nodos, f, x) => {
    let i = 0;
    while (i < nodos.length - 2 && x > nodos[i + 1]) i++;
    const a = nodos[i], b = nodos[i + 1], t = (x - a) / (b - a);
    return { y: (1 - t) * f(a) + t * f(b), tramo: i, t };
  };
  const errTramo = (f, a, b) => {
    let m = 0;
    for (let k = 0; k <= 30; k++) { const x = a + ((b - a) * k) / 30; m = Math.max(m, Math.abs(f(x) - interp([a, b], f, x).y)); }
    return m;
  };
  // Nodos equiespaciados, o adaptativos: tramos de igual error máximo (búsqueda binaria de la tolerancia).
  function nodosDe(f, k, modo) {
    if (modo === 'igual') return Array.from({ length: k + 1 }, (_, i) => (XM * i) / k);
    const construir = (e) => {
      const n = [0];
      while (n[n.length - 1] < XM - 1e-9 && n.length < 60) {
        const a = n[n.length - 1];
        let lo = a, hi = XM;
        if (errTramo(f, a, XM) <= e) { n.push(XM); break; }
        for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (errTramo(f, a, m) <= e) lo = m; else hi = m; }
        n.push(Math.max(lo, a + 1e-3));
      }
      return n;
    };
    let lo = 0, hi = 200;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (construir(m).length - 1 <= k) hi = m; else lo = m; }
    return construir(hi);
  }

  /* ---------- Fig. 1: aproximar por tramos ---------- */

  function montarAproximacion(cuerpo) {
    let clave = 'escala', k = 4, modo = 'igual', nodos = [], hover = null, pl1 = null, pl2 = null, errMax = 0, errMed = 0;
    const recalcular = () => {
      const f = FUN[clave].f;
      nodos = nodosDe(f, k, modo);
      errMax = 0; errMed = 0;
      for (let i = 0; i <= 400; i++) { const x = (XM * i) / 400, e = Math.abs(f(x) - interp(nodos, f, x).y); errMax = Math.max(errMax, e); errMed += e / 401; }
    };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: Object.entries(FUN).map(([c, q]) => [c, q.nombre]), valor: clave, alCambiar: (v) => { clave = v; recalcular(); dibujar(); } });
    ctl.selector({ etiqueta: 'Nodos', opciones: [['igual', 'equiespaciados'], ['adaptativo', 'adaptativos (igual error)']], valor: modo, alCambiar: (v) => { modo = v; recalcular(); dibujar(); } });
    ctl.rango({ etiqueta: 'Tramos', min: 1, max: 10, valor: k, alCambiar: (v) => { k = v; recalcular(); dibujar(); } });
    recalcular();

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 340, altoMax: 480 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'función real f(x)', forma: 'linea' },
      { color: C.s1, texto: 'aproximación lineal por tramos g(x)', forma: 'linea' },
      { color: C.s2, texto: 'nodos xᵢ' },
      { color: C.s8, texto: 'error |f − g|' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor por el gráfico: el tooltip muestra en qué tramo está x y los pesos λ del modelo, que son distintos de cero solo para los dos nodos vecinos. Abajo se ve el error en cada punto.');

    function dibujar() {
      const { ctx, ancho: W, alto: Hh } = lienzo;
      lienzo.limpiar();
      const f = FUN[clave].f, h2 = 90, h1 = Hh - h2;
      const ymax = Math.max(...Array.from({ length: 101 }, (_, i) => f(i))) * 1.08;
      pl1 = VIZ.plano({ ctx, ancho: W, alto: h1 }, { xmin: 0, xmax: XM, ymin: 0, ymax }, { etiquetaY: 'costo', margen: { inf: 24 }, ticksX: VIZ.ticks(0, XM, 10), formatoX: () => '' });
      pl1.ejes();
      VIZ.trazar(ctx, pl1, Array.from({ length: 201 }, (_, i) => [(XM * i) / 200, f((XM * i) / 200)]), C.tinta2, 2);
      VIZ.trazar(ctx, pl1, nodos.map((x) => [x, f(x)]), C.s1, 2.5);
      nodos.forEach((x) => VIZ.marcador(ctx, pl1.sx(x), pl1.sy(f(x)), C.s2, 4));
      if (hover != null) {
        const q = interp(nodos, f, hover);
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl1.sx(hover), pl1.y0); ctx.lineTo(pl1.sx(hover), pl1.y1); ctx.stroke();
        VIZ.marcador(ctx, pl1.sx(hover), pl1.sy(f(hover)), C.tinta2, 3.5); VIZ.marcador(ctx, pl1.sx(hover), pl1.sy(q.y), C.s1, 3.5);
      }
      ctx.save(); ctx.translate(0, h1);
      const em = Math.max(errMax * 1.2, 0.5);
      pl2 = VIZ.plano({ ctx, ancho: W, alto: h2 }, { xmin: 0, xmax: XM, ymin: 0, ymax: em }, { etiquetaX: 'cantidad x', etiquetaY: 'error', margen: { sup: 18, inf: 40 }, ticksY: [0, em / 2, em].map((v) => +v.toPrecision(2)) });
      pl2.ejes();
      ctx.beginPath(); ctx.moveTo(pl2.sx(0), pl2.sy(0));
      for (let i = 0; i <= 300; i++) { const x = (XM * i) / 300; ctx.lineTo(pl2.sx(x), pl2.sy(Math.abs(f(x) - interp(nodos, f, x).y))); }
      ctx.lineTo(pl2.sx(XM), pl2.sy(0)); ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s8, 0.25); ctx.fill();
      ctx.strokeStyle = C.s8; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      pl2.off = h1;
      const real = nodos.length - 1;
      registro.textContent = `${real} tramo(s) con nodos en ${nodos.map((x) => VIZ.fmt(x, 3)).join(', ')}.`;
      lectura.set([
        ['tramos', String(real)],
        ['binarias en el modelo', real > 1 ? String(real) : '0 (es una recta)'],
        ['error máximo', VIZ.fmt(errMax, 3)],
        ['error medio', VIZ.fmt(errMed, 3)],
        ['f convexa o cóncava', clave === 'cuadratica' ? 'convexa: no necesita binarias al minimizar' : clave === 'escala' ? 'cóncava: necesita binarias al minimizar' : 'mixta: necesita binarias'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl1 || x < pl1.x0 || x > pl1.x1) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(XM, pl1.ix(x))); dibujar();
      const f = FUN[clave].f, q = interp(nodos, f, hover);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(hover, 4)}</b><br>f(x) = <b>${VIZ.fmt(f(hover), 4)}</b><br>g(x) = <b>${VIZ.fmt(q.y, 4)}</b><br>error <b>${VIZ.fmt(Math.abs(f(hover) - q.y), 3)}</b><br>tramo <b>${q.tramo + 1}</b> (z = 1)<br>λ${q.tramo} = <b>${VIZ.fmt(1 - q.t, 3)}</b>, λ${q.tramo + 1} = <b>${VIZ.fmt(q.t, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: optimizar con tramos y binarias ---------- */

  const NODOS1 = [0, 40, 80, 120];
  const Q2 = 0.06;
  function montarOptimizacion(cuerpo) {
    let Dm = 100, desc = 0.25, binarias = true, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Demanda a cubrir', min: 20, max: 160, paso: 5, valor: Dm, alCambiar: (v) => { Dm = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Descuento por tramo', min: 0, max: 0.4, paso: 0.05, valor: desc, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { desc = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Exigir un solo tramo activo (binarias)', valor: binarias, alCambiar: (v) => { binarias = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo total real (con binarias)', forma: 'linea' },
      { color: C.s2, texto: 'relajación sin binarias (λ libres)', forma: 'linea' },
      { color: C.s6, texto: 'óptimo mostrado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El proveedor 1 cobra 10 por unidad y baja el precio un cierto porcentaje en los tramos 40–80 y 80–120; el proveedor 2 cuesta 0.06·x² (cada unidad adicional es más cara). Pase el cursor por el gráfico para ver el costo de comprar x al proveedor 1 y el resto al 2.');

    const pend = (j) => 10 * Math.max(0, 1 - desc * j);
    const f1 = (x) => { let c = 0; for (let j = 0; j < 3; j++) { const a = NODOS1[j], b = NODOS1[j + 1]; if (x > a) c += pend(j) * (Math.min(x, b) - a); } return c; };
    const f2 = (x) => Q2 * x * x;
    const total = (x1) => f1(x1) + f2(Dm - x1);
    const chord = (x) => (f1(NODOS1[3]) / NODOS1[3]) * x;
    const relaj = (x1) => chord(x1) + f2(Dm - x1);
    // Mínimo exacto de una recta + parábola convexa en un intervalo [a, b] de x1.
    function minTramo(beta, a, b, base) {
      const lo = Math.max(a, 0), hi = Math.min(b, Dm, NODOS1[3]);
      if (lo > hi) return null;
      const x = Math.max(lo, Math.min(hi, Dm - beta / (2 * Q2)));
      return { x, c: base(x) };
    }
    function resolver() {
      let mejor = null;
      for (let j = 0; j < 3; j++) { const q = minTramo(pend(j), NODOS1[j], NODOS1[j + 1], total); if (q && (!mejor || q.c < mejor.c)) mejor = { ...q, tramo: j + 1 }; }
      const r = minTramo(f1(NODOS1[3]) / NODOS1[3], 0, NODOS1[3], relaj);
      return { exacto: mejor, relajado: r };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xmax = Math.min(Dm, NODOS1[3]), r = resolver();
      const pts = (g) => Array.from({ length: 241 }, (_, i) => { const x = (xmax * i) / 240; return [x, g(x)]; });
      const ys = [...pts(total), ...pts(relaj)].map((p) => p[1]);
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: Math.max(xmax, 1), ymin: Math.min(...ys) * 0.9, ymax: Math.max(...ys) * 1.05 }, { etiquetaX: 'unidades compradas al proveedor 1 (x₁)', etiquetaY: 'costo total' });
      pl.ejes();
      ctx.save(); pl.recortar();
      NODOS1.slice(1, 3).forEach((x) => { if (x < xmax) { ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(x), pl.y0); ctx.lineTo(pl.sx(x), pl.y1); ctx.stroke(); } });
      ctx.restore();
      VIZ.trazar(ctx, pl, pts(relaj), C.s2, 2, [6, 4]);
      VIZ.trazar(ctx, pl, pts(total), C.s1, 2.5);
      const mostrado = binarias ? r.exacto : r.relajado;
      if (r.exacto) VIZ.marcador(ctx, pl.sx(r.exacto.x), pl.sy(r.exacto.c), binarias ? C.s6 : C.s1, binarias ? 6 : 4);
      if (r.relajado) VIZ.marcador(ctx, pl.sx(r.relajado.x), pl.sy(r.relajado.c), binarias ? C.s2 : C.s6, binarias ? 4 : 6);
      if (hover != null) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y0); ctx.lineTo(pl.sx(hover), pl.y1); ctx.stroke();
        VIZ.marcador(ctx, pl.sx(hover), pl.sy(total(hover)), C.s1, 3.5); VIZ.marcador(ctx, pl.sx(hover), pl.sy(relaj(hover)), C.s2, 3.5);
      }
      registro.textContent = mostrado ? (binarias
        ? `Con binarias: comprar x₁ = ${VIZ.fmt(mostrado.x, 4)} al proveedor 1 (tramo ${r.exacto.tramo}) y ${VIZ.fmt(Dm - mostrado.x, 4)} al 2; costo ${VIZ.fmt(mostrado.c, 5)}.`
        : `Sin binarias el modelo cree que puede pagar ${VIZ.fmt(mostrado.c, 5)} comprando x₁ = ${VIZ.fmt(mostrado.x, 4)}: pero ese costo real sería ${VIZ.fmt(total(mostrado.x), 5)}.`) : '';
      lectura.set([
        ['demanda', String(Dm)],
        ['óptimo real (binarias)', r.exacto ? `${VIZ.fmt(r.exacto.c, 5)} con x₁ = ${VIZ.fmt(r.exacto.x, 4)}` : '—'],
        ['relajación (sin binarias)', r.relajado ? `${VIZ.fmt(r.relajado.c, 5)} con x₁ = ${VIZ.fmt(r.relajado.x, 4)}` : '—'],
        ['brecha de la relajación', r.exacto && r.relajado ? VIZ.fmt(r.exacto.c - r.relajado.c, 4) : '—'],
        ['costo real de la solución relajada', r.relajado ? VIZ.fmt(total(r.relajado.x), 5) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(Math.min(Dm, NODOS1[3]), pl.ix(x))); dibujar();
      tip.mostrar(x, y, `x₁ = <b>${VIZ.fmt(hover, 4)}</b>, x₂ = <b>${VIZ.fmt(Dm - hover, 4)}</b>` + VIZ.filaTooltip(C.s1, 'costo real', VIZ.fmt(total(hover), 5)) + VIZ.filaTooltip(C.s2, 'relajación', VIZ.fmt(relaj(hover), 5)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('piecewise-linear', {
    intro: String.raw`
      <p>Muchos costos no son proporcionales a la cantidad: comprar más sale más barato por unidad (descuentos por volumen), producir más exige horas extra (costo creciente) o la tarifa cambia por escalones. Un modelo lineal no los representa, pero se puede
      <strong>aproximar la curva por tramos rectos</strong> y dejar que el modelo elija en qué tramo está.</p>
      <p>Si la curva es convexa y se minimiza, basta con programación lineal. Si no (como con los descuentos por volumen), hacen falta variables binarias que indiquen el tramo activo; sin ellas, el modelo «hace trampa» y combina puntos de tramos distintos para obtener un costo menor que el real.</p>`,
    visualizaciones: [
      {
        titulo: 'Aproximar una curva por tramos',
        descripcion: 'Aumente el número de tramos y vea cómo baja el error máximo; cambie a nodos adaptativos y compare con los equiespaciados. En la curva en S los tramos largos fallan en las esquinas.',
        montar: montarAproximacion,
      },
      {
        titulo: 'Descuentos por volumen y binarias',
        descripcion: 'Suba el descuento: la curva real tiene codos cóncavos y la relajación sin binarias (naranja) queda por debajo, con un óptimo distinto y un costo imposible. Con descuento 0 ambas coinciden.',
        montar: montarOptimizacion,
      },
    ],
    teoria: String.raw`
      <h2>Aproximación lineal por tramos</h2>
      <p>Dados nodos \(0 = x_0 &lt; x_1 &lt; \dots &lt; x_k\), la función lineal por tramos \(g\) interpola \(f\) en los nodos y es recta entre ellos: en \([x_{i-1}, x_i]\),
      \(g(x) = f(x_{i-1}) + \frac{f(x_i) - f(x_{i-1})}{x_i - x_{i-1}}(x - x_{i-1})\). Para una \(f\) con segunda derivada acotada, el error de un tramo de ancho \(h\) cumple \(|f - g| \le \frac{h^2}{8}\max|f''|\), así que duplicar los tramos divide el error por cuatro.
      Con tramos de igual error (nodos adaptativos) se concentran los nodos donde la curvatura es grande.</p>

      <h2>Modelo con variables \(\lambda\) y binarias</h2>
      <p>Cada punto se escribe como combinación convexa de los nodos y solo pueden ser positivos los dos nodos de un mismo tramo:</p>
      \[
      \begin{aligned}
      x &= \sum_{i=0}^{k} \lambda_i x_i, \qquad y = \sum_{i=0}^{k} \lambda_i f(x_i), \qquad \sum_i \lambda_i = 1, \quad \lambda_i \ge 0, \\
      \lambda_0 &\le z_1, \qquad \lambda_i \le z_i + z_{i+1}\ (0 &lt; i &lt; k), \qquad \lambda_k \le z_k, \qquad \sum_{j=1}^{k} z_j = 1, \quad z_j \in \{0,1\}.
      \end{aligned}
      \]
      <p>La binaria \(z_j = 1\) marca el tramo activo. Es la condición SOS2 («a lo más dos \(\lambda\) consecutivos distintos de cero»). Una formulación alternativa usa una binaria por tramo y la cantidad \(x_j\) dentro de él con \(x_{j-1} z_j \le x_j \le x_j^{\max} z_j\), de modo que la función vale \(\sum_j (a_j z_j + b_j x_j)\).</p>

      <h2>Cuándo se necesitan las binarias</h2>
      <p>Si se minimiza una función <em>convexa</em> (pendientes crecientes), las \(\lambda\) libres ya eligen sin trampa dos nodos vecinos, porque la combinación de dos nodos lejanos queda por encima de la curva. Con una función <em>cóncava</em> (descuentos, economías de escala) ocurre lo contrario: la mejor mezcla libre es la cuerda entre los extremos, que está por debajo de la curva, y la relajación
      subestima el costo. En la segunda figura, la relajación sin binarias paga \(f_1\) como si fuera la cuerda de 0 a 120 y compra siempre en el extremo que le conviene; la solución con binarias es correcta, pero cuesta resolver un problema entero.
      Es la misma idea que las <a href="tema.html?id=lp-relaxation">relajaciones lineales</a>: cuanto más floja la formulación, más se aleja de la verdad.</p>

      <h2>Elección del número de tramos</h2>
      <p>Cada tramo agrega una binaria; con \(k\) tramos hay \(2^k\) combinaciones de activación en el peor caso del árbol de <a href="tema.html?id=milp-branch-and-bound">ramificación</a>. Hay que equilibrar el error de modelado, \(O(1/k^2)\), con el costo de resolver; con una codificación logarítmica bastan \(\lceil \log_2 k \rceil\) binarias. Estas funciones aparecen también en
      <a href="tema.html?id=unit-commitment">planificación de generación</a> (costos de combustible convexos) y en <a href="tema.html?id=problem-classes">problemas MILP</a> que linealizan modelos no lineales.</p>`,
  });
})();
