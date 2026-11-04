(function () {
  'use strict';
  const { color: C } = VIZ;

  function simular(alg, cap, sem, R = 70) {
    const rnd = VIZ.semilla(sem * 131 + cap), pts = []; let cwnd = 1, ss = 64, evs = [];
    for (let r = 0; r < R; r++) {
      pts.push(cwnd);
      if (cwnd >= cap) { // pérdida detectada por tres ACK duplicados
        if (rnd() < 0.12) { ss = Math.max(2, cwnd / 2); cwnd = 1; evs.push([r, 'timeout']); }
        else { ss = Math.max(2, cwnd / 2); cwnd = alg === 'reno' ? ss : 1; evs.push([r, '3 ACK dup.']); }
      } else if (cwnd < ss) cwnd = Math.min(cwnd * 2, Math.max(ss, 1)); else cwnd += 1;
    }
    return { pts, evs };
  }

  function montarCwnd(cuerpo) {
    let alg = 'reno', cap = 32, sem = 1, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Variante', opciones: [['reno', 'Reno (recuperación rápida)'], ['tahoe', 'Tahoe']], valor: alg, alCambiar: (v) => { alg = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Capacidad de la ruta (segmentos)', min: 8, max: 64, valor: cap, alCambiar: (v) => { cap = v; dibujar(); } });
    ctl.boton('Otra ejecución', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cwnd (ventana de congestión)', forma: 'linea' }, { color: C.s8, texto: 'pérdida', forma: 'punto' }, { color: C.apagado, texto: 'capacidad de la ruta', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un RTT. Inicio lento: cwnd se duplica por RTT hasta el umbral; luego suma 1 por RTT. Al perder, el umbral baja a la mitad. Tahoe vuelve siempre a 1; Reno, tras tres ACK duplicados, solo a la mitad.');
    let res, plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      res = simular(alg, cap, sem);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 70, ymin: 0, ymax: cap * 1.1 }, { etiquetaX: 'RTT', etiquetaY: 'cwnd (segmentos)' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, cap], [70, cap]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, res.pts.map((v, i) => [i, v]), C.s1, 2.5);
      res.evs.forEach(([r]) => VIZ.marcador(ctx, plano.sx(r), plano.sy(res.pts[r]), C.s8, 4.5));
      if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(res.pts[hover]), C.s1, 4);
      const media = res.pts.reduce((a, b) => a + b, 0) / res.pts.length;
      lectura.set([['cwnd media', `${VIZ.fmt(media, 3)} segmentos`], ['uso de la ruta', `${VIZ.fmt((media / cap) * 100, 3)} %`], ['pérdidas', String(res.evs.length)], ['regla', 'AIMD: +1 por RTT, ÷2 al perder']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(res.pts.length - 1, Math.round(plano.ix(x)))); dibujar();
      tip.mostrar(x, y, `RTT <b>${hover}</b><br>cwnd ${VIZ.fmt(res.pts[hover], 3)}${res.evs.find((e) => e[0] === hover) ? '<br>' + res.evs.find((e) => e[0] === hover)[1] : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  function montarEquidad(cuerpo) {
    let regla = 'aimd', x0 = 10, y0 = 40, hover = null;
    const CAP = 100;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Regla de ajuste', opciones: [['aimd', 'AIMD: suma 1, divide por 2'], ['aiad', 'AIAD: suma 1, resta 1'], ['mimd', 'MIMD: multiplica, divide']], valor: regla, alCambiar: (v) => { regla = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Velocidad inicial del flujo 1', min: 5, max: 90, valor: x0, alCambiar: (v) => { x0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Velocidad inicial del flujo 2', min: 5, max: 90, valor: y0, alCambiar: (v) => { y0 = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 420 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'trayectoria de (flujo 1, flujo 2)', forma: 'linea' }, { color: C.s8, texto: 'recta de capacidad x + y = 100', forma: 'linea' }, { color: C.s6, texto: 'reparto equitativo x = y', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos flujos comparten un enlace de 100. Si la suma pasa de 100 hay pérdida y ambos reducen. Solo AIMD converge al reparto equitativo; las otras reglas conservan o amplían la desigualdad.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: CAP, ymin: 0, ymax: CAP }, { etiquetaX: 'flujo 1', etiquetaY: 'flujo 2' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, CAP], [CAP, 0]], C.s8, 2); VIZ.trazar(ctx, plano, [[0, 0], [CAP, CAP]], C.s6, 2);
      let x = x0, y = y0; const pts = [[x, y]];
      for (let i = 0; i < 400; i++) {
        if (x + y > CAP) { if (regla === 'aimd') { x /= 2; y /= 2; } else if (regla === 'aiad') { x = Math.max(1, x - 1); y = Math.max(1, y - 1); } else { x *= 0.7; y *= 0.7; } }
        else if (regla === 'mimd') { x *= 1.05; y *= 1.05; } else { x += 1; y += 1; }
        pts.push([x, y]);
      }
      VIZ.trazar(ctx, plano, pts, VIZ.alfa(C.s1, 0.8), 1.5);
      VIZ.marcador(ctx, plano.sx(x0), plano.sy(y0), C.s1, 4.5);
      const u = pts[pts.length - 1], d = Math.abs(u[0] - u[1]);
      VIZ.marcador(ctx, plano.sx(u[0]), plano.sy(u[1]), C.s2, 5);
      lectura.set([['diferencia inicial', VIZ.fmt(Math.abs(x0 - y0), 3)], ['diferencia final', VIZ.fmt(d, 3)], ['resultado', d < Math.abs(x0 - y0) * 0.1 + 2 ? 'converge a la equidad' : 'no converge a la equidad']]);
      void W; void H;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('tcp-congestion-control', {
    intro: String.raw`
      <p>Si todos los emisores envían tan rápido como pueden, las colas de los routers se llenan, se pierden paquetes, se retransmite más, y la red entra en <strong>congestión</strong>. TCP regula su ritmo sin ayuda de la red: usa las pérdidas como señal y ajusta una <strong>ventana de congestión</strong> (<code>cwnd</code>).</p>
      <p>La regla es <strong>AIMD</strong> (<em>additive increase, multiplicative decrease</em>): subir despacio, sumando 1 segmento por RTT, y bajar rápido, a la mitad, cuando hay pérdidas. Eso produce el famoso «diente de sierra».</p>`,
    visualizaciones: [
      { titulo: 'La ventana de congestión', descripcion: 'Observe el inicio lento, el aumento lineal y la caída al perder. Compare Tahoe con Reno y cambie la capacidad de la ruta.', montar: montarCwnd },
      { titulo: 'Por qué AIMD y no otra regla', descripcion: 'Dos flujos con velocidades distintas: solo AIMD los lleva al reparto equitativo. Cambie la regla y las velocidades iniciales.', montar: montarEquidad },
    ],
    teoria: String.raw`
      <h2>Fases</h2>
      <pre><code>inicio lento:        cwnd ← 1;  por cada ACK:  cwnd ← cwnd + 1   # se duplica por RTT
                     hasta cwnd = umbral (ssthresh)
evitar congestión:   por cada RTT:  cwnd ← cwnd + 1
tres ACK duplicados: ssthresh ← cwnd / 2
                     Reno:  cwnd ← ssthresh      Tahoe:  cwnd ← 1
timeout:             ssthresh ← cwnd / 2;  cwnd ← 1</code></pre>
      <p>La ventana efectiva es \(\min(\text{cwnd},\ \text{rwnd})\) (ver <a href="tema.html?id=tcp-flow-control">control de flujo</a>). El timeout indica congestión más grave que los ACK duplicados, porque ningún segmento llegó.</p>
      <h2>Rendimiento medio</h2>
      <p>Con una ventana que oscila entre \(W/2\) y \(W\) en cada diente, el promedio es \(\tfrac34 W\) y el rendimiento medio</p>
      \[ \text{rend.} \approx \frac{3}{4}\frac{W\cdot\mathrm{MSS}}{\mathrm{RTT}}, \qquad \text{rend.} \approx \frac{1{,}22\,\mathrm{MSS}}{\mathrm{RTT}\sqrt{p}} \]
      <p>donde la segunda forma relaciona el rendimiento con la tasa de pérdidas \(p\): para llenar un enlace de 10 Gbps con RTT de 100 ms se necesitaría una pérdida de solo \(2\times10^{-10}\), motivo de variantes como CUBIC o BBR.</p>
      <h2>Equidad</h2>
      <p>Con dos flujos de velocidades \((x, y)\): el aumento aditivo mueve el punto en diagonal (conserva \(x-y\)); la disminución multiplicativa lo acerca al origen sobre la recta que une el punto con el origen y reduce la diferencia a la mitad. La combinación acerca el punto a la recta \(x = y\) (Chiu y Jain). Todo esto presupone que las pérdidas indican <a href="tema.html?id=network-delays">colas llenas</a>.</p>`,
  });
})();
