(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  // Traza en ctx la curva elegida por los puntos pts = [[x, y], …] (en píxeles).
  function trazarCurva(ctx, pts, tipo, tension) {
    const n = pts.length;
    ctx.beginPath();
    if (tipo === 'lineal') { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); return; }
    if (tipo === 'escalon') {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) { const m = (pts[i - 1][0] + pts[i][0]) / 2; ctx.lineTo(m, pts[i - 1][1]); ctx.lineTo(m, pts[i][1]); ctx.lineTo(pts[i][0], pts[i][1]); }
      return;
    }
    if (tipo === 'base') {
      const a = [pts[0], pts[0], ...pts, pts[n - 1], pts[n - 1]];
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i + 3 < a.length; i++) {
        const [p, q, r, s] = [a[i], a[i + 1], a[i + 2], a[i + 3]];
        ctx.bezierCurveTo((2 * q[0] + r[0]) / 3, (2 * q[1] + r[1]) / 3, (q[0] + 2 * r[0]) / 3, (q[1] + 2 * r[1]) / 3, (q[0] + 4 * r[0] + s[0]) / 6, (q[1] + 4 * r[1] + s[1]) / 6);
        void p;
      }
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
      return;
    }
    if (tipo === 'cardinal') {
      const k = (1 - tension) / 6;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
        ctx.bezierCurveTo(p1[0] + k * (p2[0] - p0[0]), p1[1] + k * (p2[1] - p0[1]), p2[0] - k * (p3[0] - p1[0]), p2[1] - k * (p3[1] - p1[1]), p2[0], p2[1]);
      }
      return;
    }
    // monótona en x (Fritsch–Carlson): nunca se pasa de los datos.
    const sec = [], t = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) sec.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
    t[0] = sec[0]; t[n - 1] = sec[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = sec[i - 1] * sec[i] <= 0 ? 0 : (sec[i - 1] + sec[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (sec[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / sec[i], b = t[i + 1] / sec[i], h = Math.hypot(a, b);
      if (h > 3) { t[i] = (3 * a * sec[i]) / h; t[i + 1] = (3 * b * sec[i]) / h; }
    }
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const dx = (pts[i + 1][0] - pts[i][0]) / 3;
      ctx.bezierCurveTo(pts[i][0] + dx, pts[i][1] + t[i] * dx, pts[i + 1][0] - dx, pts[i + 1][1] - t[i + 1] * dx, pts[i + 1][0], pts[i + 1][1]);
    }
  }

  /* ---------- Fig. 1: generador de líneas y curvas ---------- */

  function montarLinea(cuerpo) {
    const est = { curva: 'monotona', tension: 0, datos: 'salto', puntos: true, area: false };
    const D = { salto: [10, 10, 11, 10, 10, 60, 62, 61, 60, 62, 61, 61], suave: [20, 28, 35, 33, 45, 52, 48, 40, 36, 44, 58, 66] };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Curva (d3.curve…)', valor: est.curva, opciones: [['lineal', 'curveLinear'], ['escalon', 'curveStep'], ['base', 'curveBasis'], ['cardinal', 'curveCardinal'], ['monotona', 'curveMonotoneX']], alCambiar: (v) => { est.curva = v; dibujar(); } });
    ctl.rango({ etiqueta: 'tension (solo cardinal)', min: 0, max: 1, paso: 0.1, valor: est.tension, alCambiar: (v) => { est.tension = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Datos', valor: est.datos, opciones: [['salto', 'con un salto brusco'], ['suave', 'cambios graduales']], alCambiar: (v) => { est.datos = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar los datos', valor: true, alCambiar: (v) => { est.puntos = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Generador de área', valor: false, alCambiar: (v) => { est.area = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'curva generada', forma: 'linea' }, { color: C.s2, texto: 'dato original', forma: 'punto' }, { color: C.s8, texto: 'valor por debajo de 0 (sobreimpulso)' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con datos de salto brusco compare cardinal y monótona: la primera «rebota» por debajo de los datos, la segunda nunca. Pase el cursor por un punto para leerlo.');
    let pts = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const v = D[est.datos];
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 11, ymin: -12, ymax: 80 }, { etiquetaX: 'mes', etiquetaY: 'valor', formatoX: (x) => V.MESES[Math.round(x)] || '' });
      plano.ejes();
      pts = v.map((y, i) => [plano.sx(i), plano.sy(y)]);
      const y0 = plano.sy(0);
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(plano.x0, y0); ctx.lineTo(plano.x1, y0); ctx.stroke(); ctx.setLineDash([]);
      if (est.area) { trazarCurva(ctx, pts, est.curva, est.tension); ctx.lineTo(pts[pts.length - 1][0], y0); ctx.lineTo(pts[0][0], y0); ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s1, 0.18); ctx.fill(); }
      ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.s1; ctx.lineJoin = 'round'; trazarCurva(ctx, pts, est.curva, est.tension); ctx.stroke(); ctx.restore();
      // Marca de sobreimpulso: muestra la curva por debajo de 0.
      if (est.curva === 'cardinal' || est.curva === 'base') {
        ctx.save(); ctx.beginPath(); ctx.rect(plano.x0, y0, plano.x1 - plano.x0, plano.y0 - y0 + 1); ctx.clip(); ctx.lineWidth = 3; ctx.strokeStyle = C.s8; trazarCurva(ctx, pts, est.curva, est.tension); ctx.stroke(); ctx.restore();
      }
      if (est.puntos) pts.forEach((p) => VIZ.marcador(ctx, p[0], p[1], C.s2, 3.5));
      lectura.set([['curva', ({ lineal: 'curveLinear', escalon: 'curveStep', base: 'curveBasis', cardinal: 'curveCardinal', monotona: 'curveMonotoneX' })[est.curva]], ['pasa por los datos', est.curva === 'base' ? 'no (los aproxima)' : 'sí'], ['puede salirse del rango de los datos', est.curva === 'cardinal' || est.curva === 'base' ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = V.cercano(pts.map((p, i) => ({ px: p[0], py: p[1], i })), x, y, 14);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `${V.MESES[c.i]}: <b>${D[est.datos][c.i]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: áreas apiladas y desplazamiento ---------- */

  function montarApilado(cuerpo) {
    let modo = 'none', foco = -1;
    const NOM = ['Web', 'Móvil', 'Tienda'], COL = [C.s1, C.s2, C.s3];
    const rnd = VIZ.semilla(11);
    const datos = NOM.map((_, k) => V.serie(rnd, 12, 20 + k * 8, 0.8, 7 - k * 2, 2.5).map((v) => Math.round(v)));
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Desplazamiento (stackOffset)', valor: modo, opciones: [['none', 'apilado normal'], ['expand', 'normalizado (proporciones)'], ['silhouette', 'centrado (silueta)']], alCambiar: (v) => { modo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, NOM.map((n, i) => ({ color: COL[i], texto: n })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada capa es el área entre una línea inferior y otra superior. Cambie el desplazamiento: las alturas relativas se leen mejor normalizadas; las tendencias globales, en el apilado normal. Pase el cursor sobre un mes.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tot = Array.from({ length: 12 }, (_, i) => datos.reduce((s, d) => s + d[i], 0));
      const alt = (i) => (modo === 'expand' ? 1 : 1) * tot[i];
      const base = Array.from({ length: 12 }, (_, i) => (modo === 'silhouette' ? -tot[i] / 2 : 0));
      const k = (i) => (modo === 'expand' ? 1 / tot[i] : 1);
      const lo = Math.min(...base), hi = modo === 'expand' ? 1 : Math.max(...tot.map((t, i) => base[i] + t));
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 11, ymin: modo === 'expand' ? 0 : Math.min(lo, 0), ymax: hi * 1.05 }, { etiquetaX: 'mes', formatoX: (x) => V.MESES[Math.round(x)] || '', formatoY: (y) => (modo === 'expand' ? `${Math.round(y * 100)} %` : String(Math.round(y))) });
      plano.ejes();
      void alt;
      let inf = base.map((b, i) => b * k(i));
      NOM.forEach((_, s) => {
        const sup = inf.map((b, i) => b + datos[s][i] * k(i));
        ctx.beginPath();
        sup.forEach((v, i) => (i ? ctx.lineTo(plano.sx(i), plano.sy(v)) : ctx.moveTo(plano.sx(i), plano.sy(v))));
        for (let i = 11; i >= 0; i--) ctx.lineTo(plano.sx(i), plano.sy(inf[i]));
        ctx.closePath();
        ctx.fillStyle = VIZ.alfa(COL[s], foco === -1 || foco === s ? 0.85 : 0.25); ctx.fill();
        ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5; ctx.stroke();
        inf = sup;
      });
      lectura.set([['total en dic', String(tot[11])], ['modo', modo === 'none' ? 'valores absolutos' : modo === 'expand' ? 'cada mes suma 100 %' : 'centrado en el eje']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (foco !== -1) { foco = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(11, Math.round(plano.ix(x))));
      const tot = datos.reduce((s, d) => s + d[i], 0);
      tip.mostrar(x, y, `<b>${V.MESES[i]}</b>` + NOM.map((n, s) => VIZ.filaTooltip(COL[s], n, `${datos[s][i]} (${Math.round((100 * datos[s][i]) / tot)} %)`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('d3-shape-generators', {
    intro: String.raw`
      <p>Un <strong>generador</strong> de D3 es una función que recibe datos y devuelve la cadena <code>d</code> de un <code>&lt;path&gt;</code>. El de <em>línea</em> une los puntos; el de <em>área</em> rellena entre dos líneas; el de <em>apilado</em> calcula las alturas de varias series una sobre otra.</p>
      <p>La decisión de diseño está en la <strong>curva</strong> que une los puntos: una curva suave se ve elegante, pero puede inventar valores que los datos nunca tuvieron.</p>`,
    visualizaciones: [
      { titulo: 'Generador de líneas y tipos de curva', descripcion: 'Cambie el tipo de curva y los datos; con el salto brusco observe el sobreimpulso en rojo de las curvas que no son monótonas.', montar: montarLinea },
      { titulo: 'Áreas apiladas', descripcion: 'Alterne entre apilado, normalizado y centrado, y pase el cursor sobre un mes para leer cada serie.', montar: montarApilado },
    ],
    teoria: String.raw`
      <h2>Generador de línea</h2>
      <pre><code>const linea = d3.line()
    .x(d =&gt; x(d.fecha))
    .y(d =&gt; y(d.valor))
    .curve(d3.curveMonotoneX);
svg.append("path").attr("d", linea(datos));</code></pre>
      <p>Los datos se convierten a pantalla con <a href="tema.html?id=d3-scales-axes">escalas</a> y el resultado es un trazado como los de <a href="tema.html?id=svg-paths-curves">SVG paths</a>.</p>
      <h2>Curvas</h2>
      <table>
        <tr><th>Curva</th><th>Propiedad</th></tr>
        <tr><td>lineal</td><td>fiel: solo une los datos con rectas</td></tr>
        <tr><td>escalón</td><td>apropiada si el valor se mantiene hasta el siguiente cambio</td></tr>
        <tr><td>B-spline (basis)</td><td>suave, pero no pasa por los datos</td></tr>
        <tr><td>cardinal / Catmull–Rom</td><td>pasa por los datos; puede sobrepasarlos</td></tr>
        <tr><td>monótona en x</td><td>pasa por los datos y no crea extremos nuevos</td></tr>
      </table>
      <p>En la cardinal con tensión \(\tau\), los puntos de control del tramo \(P_i \to P_{i+1}\) son
      \[ C_1 = P_i + \tfrac{1-\tau}{6}(P_{i+1} - P_{i-1}), \qquad C_2 = P_{i+1} - \tfrac{1-\tau}{6}(P_{i+2} - P_i). \]
      Con \(\tau = 1\) vuelve a ser lineal.</p>
      <h2>Área y apilado</h2>
      <p>El generador de área usa dos funciones, \(y_0(x)\) y \(y_1(x)\). Para series \(s_1, \dots, s_m\) apiladas, la capa \(j\) va de \(y_0^{(j)} = \sum_{k<j} s_k\) a \(y_1^{(j)} = y_0^{(j)} + s_j\).
      Con normalización se divide por el total, \(s_j / \sum_k s_k\); con silueta se resta la mitad del total para centrar.</p>
      <div class="recuadro"><strong>Advertencia.</strong> Solo la capa de abajo tiene base común: comparar la altura de las demás exige restar a ojo. Para comparar series entre sí, líneas separadas son más precisas (ver <a href="tema.html?id=perceptual-accuracy">precisión perceptual</a>).</div>`,
  });
})();
