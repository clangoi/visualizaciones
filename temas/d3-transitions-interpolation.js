(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  const EASE = {
    lineal: (t) => t,
    suave: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    salida: (t) => 1 - Math.pow(1 - t, 3),
  };
  const mezcla = (a, b, t) => a + (b - a) * t;

  /* ---------- Fig. 1: galería de interpoladores ---------- */

  function montarInterpoladores(cuerpo) {
    let t = 0, ease = 'suave';
    const A = [30, 70, 45, 85, 20, 60], B = [75, 25, 90, 35, 65, 50];
    const TRI = [[0, -1], [0.87, 0.5], [-0.87, 0.5], [0, -1], [0.87, 0.5], [-0.87, 0.5], [0, -1], [0.87, 0.5]];
    const CUA = [[-0.7, -0.7], [0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0]];
    const ctl = VIZ.controles(cuerpo);
    const rt = ctl.rango({ etiqueta: 't', min: 0, max: 1, paso: 0.01, valor: t, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { t = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Aceleración', valor: ease, opciones: [['lineal', 'lineal'], ['suave', 'easeCubicInOut'], ['salida', 'easeCubicOut']], alCambiar: (v) => { ease = v; dibujar(); } });
    const bucle = VIZ.bucle((dt) => { t += dt / 1800; if (t >= 1) { t = 1; rt.valor = 1; dibujar(); return false; } rt.valor = t; dibujar(); }, () => {});
    ctl.boton('Animar', () => { bucle.detener(); t = 0; bucle.iniciar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 420 : 250) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'estado inicial (t = 0)' }, { color: C.s2, texto: 'estado final (t = 1)' }, { color: C.tinta, texto: 'estado intermedio' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El mismo parámetro t gobierna cuatro tipos de dato: un número, un color, una lista de valores y una forma. Mueva t a mano o pulse «Animar».');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const e = EASE[ease](t), col = W < 560 ? 1 : 2, cw = W / col, ch = col === 1 ? 105 : 125;
      const celda = (k) => ({ x: (k % col) * cw, y: Math.floor(k / col) * ch });
      // 1) número
      let o = celda(0);
      V.rotulo(ctx, 'interpolateNumber(0, 100)', o.x + 14, o.y + 14, { peso: 600 });
      const x0 = o.x + 14, x1 = o.x + cw - 24;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, o.y + 54); ctx.lineTo(x1, o.y + 54); ctx.stroke();
      VIZ.marcador(ctx, x0, o.y + 54, C.s1, 5); VIZ.marcador(ctx, x1, o.y + 54, C.s2, 5);
      VIZ.marcador(ctx, mezcla(x0, x1, e), o.y + 54, C.tinta, 6);
      V.rotulo(ctx, VIZ.fmt(mezcla(0, 100, e), 3), mezcla(x0, x1, e), o.y + 76, { alinear: 'center', color: C.tinta, peso: 600 });
      // 2) color
      o = celda(1);
      V.rotulo(ctx, 'interpolateRgb(azul, naranjo)', o.x + 14, o.y + 14, { peso: 600 });
      const c0 = VIZ.rgb(C.s1), c1 = VIZ.rgb(C.s2), n = 40;
      for (let i = 0; i < n; i++) { const u = i / (n - 1); ctx.fillStyle = VIZ.css(c0.map((v, k) => mezcla(v, c1[k], u))); ctx.fillRect(o.x + 14 + (cw - 38) * (i / n), o.y + 30, (cw - 38) / n + 1, 22); }
      ctx.fillStyle = VIZ.css(c0.map((v, k) => mezcla(v, c1[k], e))); ctx.beginPath(); ctx.roundRect(o.x + 14, o.y + 62, cw - 38, 28, 4); ctx.fill();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(o.x + 14 + (cw - 38) * e - 1, o.y + 28, 2, 26);
      // 3) lista de valores
      o = celda(2);
      V.rotulo(ctx, 'interpolateArray([…], […])', o.x + 14, o.y + 14, { peso: 600 });
      const bw = (cw - 38) / A.length;
      A.forEach((a, i) => {
        const x = o.x + 14 + i * bw, base = o.y + ch - 12, v = mezcla(a, B[i], e);
        ctx.fillStyle = VIZ.alfa(C.s1, 0.35); ctx.fillRect(x + 3, base - a * 0.7, bw / 2 - 4, a * 0.7);
        ctx.fillStyle = VIZ.alfa(C.s2, 0.35); ctx.fillRect(x + bw / 2, base - B[i] * 0.7, bw / 2 - 3, B[i] * 0.7);
        ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.roundRect(x + 8, base - v * 0.7, bw - 16, v * 0.7, [3, 3, 0, 0]); ctx.fill();
      });
      // 4) forma
      o = celda(3);
      V.rotulo(ctx, 'interpolar los puntos de un polígono', o.x + 14, o.y + 14, { peso: 600 });
      const cx = o.x + cw / 2, cy = o.y + 72, R = 34;
      for (const [P, col2] of [[TRI, C.s1], [CUA, C.s2]]) { ctx.strokeStyle = col2; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(cx + p[0] * R, cy + p[1] * R) : ctx.moveTo(cx + p[0] * R, cy + p[1] * R))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = VIZ.alfa(C.tinta, 0.2); ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath();
      TRI.forEach((p, i) => { const q = CUA[i], x = cx + mezcla(p[0], q[0], e) * R, y = cy + mezcla(p[1], q[1], e) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      lectura.set([['t', VIZ.fmt(t, 2)], ['t con aceleración', VIZ.fmt(e, 3)], ['número', VIZ.fmt(mezcla(0, 100, e), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: constancia del objeto entre dos estados ---------- */

  function montarConstancia(cuerpo) {
    let t = 0, clave = true;
    const rnd = VIZ.semilla(9);
    const A = Array.from({ length: 9 }, (_, i) => ({ id: i, x: 8 + rnd() * 84, y: 10 + rnd() * 80 }));
    const rnd2 = VIZ.semilla(31);
    const B = [...Array.from({ length: 9 }, (_, i) => i).filter((i) => i !== 2 && i !== 5).sort(() => rnd2() - 0.5), 9, 10].map((id) => ({ id, x: 8 + rnd2() * 84, y: 10 + rnd2() * 80 }));
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Emparejar por', valor: 'clave', opciones: [['clave', 'clave (id)'], ['indice', 'índice']], alCambiar: (v) => { clave = v === 'clave'; dibujar(); } });
    const rt = ctl.rango({ etiqueta: 't', min: 0, max: 1, paso: 0.01, valor: 0, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { t = v; dibujar(); } });
    const bucle = VIZ.bucle((dt) => { t += dt / 2000; if (t >= 1) { t = 1; rt.valor = 1; dibujar(); return false; } rt.valor = t; dibujar(); });
    ctl.boton('Animar', () => { bucle.detener(); t = 0; bucle.iniciar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 240, altoMax: 360 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'permanece (update)' }, { color: C.s6, texto: 'aparece (enter)' }, { color: C.s8, texto: 'desaparece (exit)' }, { color: C.apagado, texto: 'trayectoria', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Emparejando por clave, cada punto viaja a su nueva posición; por índice, un punto «se convierte» en otro y las trayectorias se cruzan. Anime y compare.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const px = (v) => 20 + (v / 100) * (W - 40), py = (v) => 14 + (v / 100) * (H - 28);
      ctx.strokeStyle = C.rejilla; ctx.strokeRect(20.5, 14.5, W - 41, H - 29);
      const e = EASE.suave(t);
      const pares = [], salen = [], entran = [];
      if (clave) {
        const mb = new Map(B.map((b) => [b.id, b]));
        for (const a of A) (mb.has(a.id) ? pares.push([a, mb.get(a.id)]) : salen.push(a));
        const ma = new Set(A.map((a) => a.id));
        for (const b of B) if (!ma.has(b.id)) entran.push(b);
      } else {
        const m = Math.min(A.length, B.length);
        for (let i = 0; i < m; i++) pares.push([A[i], B[i]]);
        A.slice(m).forEach((a) => salen.push(a)); B.slice(m).forEach((b) => entran.push(b));
      }
      let cruces = 0;
      pares.forEach(([a, b]) => { ctx.strokeStyle = C.tenue; ctx.beginPath(); ctx.moveTo(px(a.x), py(a.y)); ctx.lineTo(px(b.x), py(b.y)); ctx.stroke(); });
      for (let i = 0; i < pares.length; i++) for (let j = i + 1; j < pares.length; j++) { const [a, b] = pares[i], [c, d] = pares[j]; const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); if (o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)) cruces++; }
      pares.forEach(([a, b]) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(px(mezcla(a.x, b.x, e)), py(mezcla(a.y, b.y, e)), 7, 0, 6.3); ctx.fill(); V.rotulo(ctx, String(a.id), px(mezcla(a.x, b.x, e)), py(mezcla(a.y, b.y, e)), { alinear: 'center', tam: 9, color: C.sobre, peso: 700 }); });
      salen.forEach((a) => { ctx.globalAlpha = 1 - e; ctx.fillStyle = C.s8; ctx.beginPath(); ctx.arc(px(a.x), py(a.y), 7 * (1 - e * 0.5), 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; });
      entran.forEach((b) => { ctx.globalAlpha = e; ctx.fillStyle = C.s6; ctx.beginPath(); ctx.arc(px(b.x), py(b.y), 7 * (0.5 + e * 0.5), 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; });
      registro.textContent = `${pares.length} puntos se desplazan, ${entran.length} aparecen y ${salen.length} desaparecen. Trayectorias que se cruzan: ${cruces}.`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('d3-transitions-interpolation', {
    intro: String.raw`
      <p>Una <strong>transición</strong> lleva un atributo desde su valor actual hasta uno nuevo a lo largo del tiempo. Lo que hace posible ese camino es un <strong>interpolador</strong>: una función que, dado un parámetro \(t\) entre 0 y 1, devuelve el valor intermedio.</p>
      <p>Hay interpoladores de números, de colores, de listas, de cadenas y de formas. Con ellos un gráfico puede pasar de un estado a otro sin saltos, y la persona sigue el cambio.</p>`,
    visualizaciones: [
      { titulo: 'Un parámetro, cuatro tipos de dato', descripcion: 'Mueva t y observe cómo se interpola un número, un color, una lista de valores y una forma.', montar: montarInterpoladores },
      { titulo: 'Constancia del objeto', descripcion: 'Anime el paso entre dos conjuntos de puntos, emparejando por clave o por índice, y compare las trayectorias.', montar: montarConstancia },
    ],
    teoria: String.raw`
      <h2>Interpoladores</h2>
      <p>Para dos valores \(a\) y \(b\), el interpolador numérico es
      \[ \text{lerp}(a, b, t) = a + (b - a)\,t = (1-t)\,a + t\,b. \]
      Los demás se construyen componiendo: un color se interpola por componente (RGB, o mejor HSL/Lab para recorridos más parejos); una lista, elemento a elemento; una forma, punto a punto (si ambos polígonos tienen el mismo número de vértices).</p>
      <h2>Aceleración</h2>
      <p>La transición no avanza \(t\) linealmente en el tiempo: aplica una función \(f\) con \(f(0)=0,\ f(1)=1\), de modo que \(t' = f(t/D)\). Con <code>easeCubicInOut</code>, \(f(u) = 4u^3\) si \(u < 1/2\) y \(1 - (-2u+2)^3/2\) en otro caso. Ver <a href="tema.html?id=svg-animation">animación en SVG</a>.</p>
      <h2>Constancia del objeto</h2>
      <p>Una transición entre dos estados solo es legible si cada marca conserva su identidad: la que representa a «Valparaíso» antes debe ser la misma después. Eso exige emparejar por <strong>clave</strong> (ver <a href="tema.html?id=d3-data-join">data join</a>): las marcas con clave en ambos estados se desplazan, las nuevas aparecen y las que desaparecen se desvanecen.
      Emparejando por índice, los puntos «se transforman» en otros y la animación miente.</p>
      <pre><code>circulos.data(nuevos, d =&gt; d.id)
  .join(enter =&gt; enter.append("circle").attr("r", 0),
        update =&gt; update,
        exit =&gt; exit.transition().attr("r", 0).remove())
  .transition().duration(1000)
    .attr("cx", d =&gt; x(d.x))
    .attr("cy", d =&gt; y(d.y));</code></pre>`,
  });
})();
