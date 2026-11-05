(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarBuffer(cuerpo) {
    let B = 64, lee = 20, env = 40, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Búfer del receptor (KB)', min: 8, max: 128, paso: 8, valor: B, alCambiar: (v) => { B = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Lectura de la aplicación (KB/RTT)', min: 0, max: 80, valor: lee, alCambiar: (v) => { lee = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Capacidad de la red (KB/RTT)', min: 10, max: 100, valor: env, alCambiar: (v) => { env = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'ocupación del búfer', forma: 'linea' }, { color: C.s2, texto: 'ventana anunciada rwnd', forma: 'linea' }, { color: C.s3, texto: 'lo que el emisor envía por RTT', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada ronda (un RTT) el emisor envía lo que permite rwnd; la aplicación del receptor lee menos que eso, el búfer se llena y la ventana baja hasta ajustar el envío a la lectura. Con lectura 0, la ventana llega a cero.');
    let ocup = [], rw = [], sd = [];
    function simular() {
      let o = 0, w = B, E = [], O = [], W = []; const R = 40;
      for (let r = 0; r < R; r++) { const s = Math.min(w, env); o = Math.min(B, o + s); E.push(s); o = Math.max(0, o - lee); O.push(o); w = B - o; W.push(w); }
      ocup = O; rw = W; sd = E;
    }
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar(); simular();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 40, ymin: 0, ymax: Math.max(B, env) * 1.08 }, { etiquetaX: 'RTT', etiquetaY: 'KB' });
      plano.ejes();
      [[ocup, C.s1], [rw, C.s2], [sd, C.s3]].forEach(([d, col]) => { VIZ.trazar(ctx, plano, d.map((v, i) => [i + 1, v]), col, 2); if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(d[hover - 1]), col, 3.5); });
      lectura.set([['envío en régimen', `${VIZ.fmt(sd[39], 3)} KB/RTT`], ['rwnd final', `${VIZ.fmt(rw[39], 3)} KB`], ['cuello de botella', lee < Math.min(env, B) ? 'la aplicación receptora' : 'la red']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.min(40, Math.round(plano.ix(x)))); dibujar();
      tip.mostrar(x, y, `RTT <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'ocupación', VIZ.fmt(ocup[hover - 1], 3) + ' KB') + VIZ.filaTooltip(C.s2, 'rwnd', VIZ.fmt(rw[hover - 1], 3) + ' KB') + VIZ.filaTooltip(C.s3, 'enviado', VIZ.fmt(sd[hover - 1], 3) + ' KB'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  function montarVentana(cuerpo) {
    let rtt = 50, Rm = 100, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'RTT (ms)', min: 5, max: 300, paso: 5, valor: rtt, alCambiar: (v) => { rtt = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Velocidad del enlace (Mbps)', min: 10, max: 1000, paso: 10, valor: Rm, alCambiar: (v) => { Rm = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'rendimiento = mín(W / RTT, R)', forma: 'linea' }, { color: C.apagado, texto: 'producto ancho de banda–retardo', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El rendimiento de una conexión TCP está limitado por la ventana W dividida por el RTT. Para llenar el enlace hace falta que W alcance el producto ancho de banda–retardo (BDP).');
    const bdp = () => (Rm * 1e6 * rtt / 1e3) / 8 / 1024; // KB
    const thr = (W) => Math.min((W * 1024 * 8) / (rtt / 1e3) / 1e6, Rm);
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const xm = Math.max(256, bdp() * 1.5);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: xm, ymin: 0, ymax: Rm * 1.1 }, { etiquetaX: 'ventana W (KB)', etiquetaY: 'Mbps' });
      plano.ejes();
      VIZ.trazar(ctx, plano, Array.from({ length: 201 }, (_, i) => [(i * xm) / 200, thr((i * xm) / 200)]), C.s1, 2.5);
      VIZ.trazar(ctx, plano, [[bdp(), 0], [bdp(), Rm * 1.1]], C.apagado, 1.5, [3, 4]);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText('BDP', plano.sx(bdp()) + 4, plano.sy(Rm * 0.2));
      if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(thr(hover)), C.s1, 4.5);
      lectura.set([['producto ancho de banda–retardo', `${VIZ.fmt(bdp(), 3)} KB`], ['con W = 64 KB', `${VIZ.fmt(thr(64), 3)} Mbps`], ['ventana de 64 KB llena el enlace', thr(64) >= Rm - 1e-6 ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, plano.ix(x)); dibujar();
      tip.mostrar(x, y, `W = <b>${VIZ.fmt(hover, 3)}</b> KB<br>rendimiento ${VIZ.fmt(thr(hover), 3)} Mbps`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('tcp-flow-control', {
    intro: String.raw`
      <p>El <strong>control de flujo</strong> impide que un emisor rápido desborde a un receptor lento. El receptor de TCP tiene un búfer de tamaño limitado y, en cada ACK, anuncia cuánto espacio libre le queda: la <strong>ventana de recepción</strong> (<code>rwnd</code>). El emisor nunca tiene más de <code>rwnd</code> bytes sin confirmar.</p>
      <p>Esa misma ventana determina el rendimiento: como el emisor solo puede enviar una ventana por cada RTT, la velocidad máxima es \(W/\mathrm{RTT}\).</p>`,
    visualizaciones: [
      { titulo: 'La ventana anunciada y el búfer', descripcion: 'Haga que la aplicación lea más lento que la red: el búfer se llena y rwnd baja hasta igualar el ritmo de lectura. Con lectura 0 llega a cero.', montar: montarBuffer },
      { titulo: 'Ventana y rendimiento', descripcion: 'Con RTT largos y enlaces rápidos, una ventana pequeña desperdicia el enlace. Busque cuánta ventana hace falta (BDP).', montar: montarVentana },
    ],
    teoria: String.raw`
      <h2>Ventana de recepción</h2>
      \[ \text{rwnd} = \text{tamaño del búfer} - (\text{último byte recibido} - \text{último byte leído por la aplicación}). \]
      <p>El emisor mantiene \(\text{último enviado} - \text{último confirmado} \le \text{rwnd}\). Si <code>rwnd</code> llega a 0, el emisor sigue enviando segmentos de 1 byte (<em>sondas</em>) para enterarse de cuándo se reabre; si no, un ACK perdido con la ventana reabierta bloquearía la conexión.</p>
      <h2>Rendimiento y producto ancho de banda–retardo</h2>
      \[ \text{rendimiento} \le \frac{W}{\mathrm{RTT}}, \qquad \text{BDP} = R \cdot \mathrm{RTT}. \]
      <p>Con \(R = 1\) Gbps y RTT = 100 ms, el BDP es 12,5 MB; con la ventana clásica de 64 KB, el rendimiento máximo es solo 5,2 Mbps. La opción <em>window scaling</em> amplía la ventana hasta 1 GB.</p>
      <h2>Flujo frente a congestión</h2>
      <p>El control de flujo protege al <em>receptor</em>; el de <a href="tema.html?id=tcp-congestion-control">congestión</a> protege a la <em>red</em>. El emisor usa \(\min(\text{rwnd},\ \text{cwnd})\). La idea de ventana deslizante viene de la <a href="tema.html?id=reliable-transfer">transferencia fiable</a>, y es el mismo patrón de espera por búfer lleno del <a href="tema.html?id=bounded-buffer-condvars">productor–consumidor</a>.</p>`,
  });
})();
