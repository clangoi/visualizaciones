(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarNodal(cuerpo) {
    let L = 12000, R = 10, d = 1000, v = 2, proc = 0.1, rho = 50;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del paquete L (bits)', min: 500, max: 24000, paso: 500, valor: L, alCambiar: (x) => { L = x; dibujar(); } });
    ctl.rango({ etiqueta: 'Velocidad del enlace R (Mbps)', min: 1, max: 1000, valor: R, alCambiar: (x) => { R = x; dibujar(); } });
    ctl.rango({ etiqueta: 'Distancia (km)', min: 1, max: 20000, paso: 100, valor: d, alCambiar: (x) => { d = x; dibujar(); } });
    ctl.rango({ etiqueta: 'Tráfico en la cola (ρ = La/R)', min: 0, max: 98, valor: rho, formato: (x) => x + ' %', alCambiar: (x) => { rho = x; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'procesamiento' }, { color: C.s4, texto: 'cola' }, { color: C.s2, texto: 'transmisión L/R' }, { color: C.s3, texto: 'propagación d/s' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Retardo en un salto: dnodal = dproc + dcola + dtrans + dprop. La propagación usa 2 × 10⁸ m/s (fibra o cobre); la transmisión depende del tamaño y de la velocidad del enlace.');
    let partes = [];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const trans = L / (R * 1e6) * 1e3, prop = d * 1e3 / (v * 1e8) * 1e3, q = rho >= 100 ? Infinity : trans * (rho / 100) / (1 - rho / 100) / 2 * 2 / 2 * 1; // M/M/1 aproximado: ρ/(1−ρ) · L/R / 2
      const cola = (rho / 100 / (1 - rho / 100)) * trans / 2 * 1;
      partes = [['procesamiento', proc, C.s1], ['cola', cola, C.s4], ['transmisión', trans, C.s2], ['propagación', prop, C.s3]];
      const total = partes.reduce((a, p) => a + p[1], 0), izq = 14, ancho = W - 28; let x = izq;
      partes.forEach(([n, vv, col]) => { const w = (vv / total) * ancho; ctx.fillStyle = col; ctx.fillRect(x, 30, Math.max(0, w - 1), 44); x += w; });
      ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.tinta; ctx.fillText(`retardo total en un salto: ${VIZ.fmt(total, 4)} ms`, izq, 100);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.fillText('0', izq, 18); ctx.textAlign = 'right'; ctx.fillText(`${VIZ.fmt(total, 3)} ms`, izq + ancho, 18);
      void q;
      lectura.set([['transmisión L/R', `${VIZ.fmt(trans, 3)} ms`], ['propagación', `${VIZ.fmt(prop, 3)} ms`], ['cola', `${VIZ.fmt(cola, 3)} ms`], ['dominante', partes.slice().sort((a, b) => b[1] - a[1])[0][0]]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev); if (y < 30 || y > 74) return tip.ocultar();
      const total = partes.reduce((a, p) => a + p[1], 0); let acc = 14; const w = lienzo.ancho - 28;
      for (const [n, vv] of partes) { const wi = (vv / total) * w; if (x >= acc && x < acc + wi) return tip.mostrar(x, y, `<b>${n}</b><br>${VIZ.fmt(vv, 4)} ms`); acc += wi; }
      tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  function montarCola(cuerpo) {
    let hover = null;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'retardo de cola medio (múltiplos de L/R)', forma: 'linea' }, { color: C.s8, texto: 'ρ ≥ 1: la cola crece sin límite', forma: 'linea' }]);
    VIZ.nota(cuerpo, 'Con intensidad de tráfico ρ = L·a/R, el retardo de cola crece sin límite al acercarse a 1: cerca de la saturación, un pequeño aumento de tráfico multiplica el retardo.');
    const q = (r) => r / (1 - r) / 2; // M/D/1 en unidades de L/R: ρ/(2(1−ρ))
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: 10 }, { etiquetaX: 'intensidad de tráfico ρ', etiquetaY: 'cola (× L/R)' });
      plano.ejes(); ctx.save(); plano.recortar();
      VIZ.trazar(ctx, plano, Array.from({ length: 200 }, (_, i) => [i / 200 * 0.995, q(i / 200 * 0.995)]), C.s1, 2.5);
      ctx.restore();
      ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(plano.sx(1), plano.y0); ctx.lineTo(plano.sx(1), plano.y1); ctx.stroke(); ctx.setLineDash([]);
      if (hover) VIZ.marcador(ctx, plano.sx(hover), plano.sy(Math.min(10, q(hover))), C.s1, 4.5);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0.01, Math.min(0.99, plano.ix(x))); dibujar();
      tip.mostrar(x, y, `ρ = <b>${VIZ.fmt(hover, 3)}</b><br>cola ${VIZ.fmt(q(hover), 3)} × L/R`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('network-delays', {
    intro: String.raw`
      <p>Un paquete que cruza un router sufre cuatro retardos: el de <strong>procesamiento</strong> (leer su cabecera y decidir), el de <strong>cola</strong> (esperar su turno), el de <strong>transmisión</strong> (poner todos sus bits en el enlace) y el de <strong>propagación</strong> (que la señal viaje por el medio). Cada uno depende de cosas distintas, y por eso la red puede ser lenta por razones muy diferentes.</p>
      <p>El retardo de cola es el más caprichoso: depende de cuánto tráfico llega y se dispara cuando el enlace se acerca a su capacidad.</p>`,
    visualizaciones: [
      { titulo: 'Los cuatro retardos de un salto', descripcion: 'Un paquete de 12 000 bits en un enlace de 10 Mbps tarda 1,2 ms en transmitirse; a 1 000 km, la propagación es 5 ms. Cambie las magnitudes y vea cuál domina.', montar: montarNodal },
      { titulo: 'Cola e intensidad de tráfico', descripcion: 'Recorra la curva con el cursor: el retardo de cola crece sin límite cuando ρ se acerca a 1.', montar: montarCola },
    ],
    teoria: String.raw`
      <h2>Retardo en un salto</h2>
      \[ d_{\text{nodal}} = d_{\text{proc}} + d_{\text{cola}} + d_{\text{trans}} + d_{\text{prop}}, \qquad d_{\text{trans}} = \frac{L}{R}, \quad d_{\text{prop}} = \frac{d}{s}. \]
      <p>La transmisión depende del tamaño del paquete \(L\) y de la velocidad \(R\); la propagación, de la distancia \(d\) y de la velocidad de la señal \(s\approx 2\times10^8\) m/s. Un paquete de 1 500 bytes a 1 Gbps se transmite en 12 µs, pero cruzar un océano (6 000 km) toma 30 ms: la <strong>propagación</strong> no se arregla con ancho de banda.</p>
      <h2>Cola</h2>
      <p>Si llegan paquetes a razón de \(a\) por segundo, la <em>intensidad de tráfico</em> es \(\rho = La/R\). Para llegadas aleatorias y servicio determinista (M/D/1) el retardo de cola medio es</p>
      \[ d_{\text{cola}} = \frac{\rho}{2(1-\rho)}\cdot\frac{L}{R}. \]
      <p>Con \(\rho = 0{,}5\), es la mitad de un tiempo de transmisión; con \(\rho = 0{,}9\), 4,5; con \(0{,}99\), 49,5. Si \(\rho \ge 1\) la cola crece sin límite y el router descarta paquetes: es el origen de la pérdida en <a href="tema.html?id=tcp-congestion-control">congestión</a>.</p>
      <h2>Extremo a extremo y rendimiento</h2>
      <p>El retardo total suma los retardos de cada salto. El <em>rendimiento</em> (<em>throughput</em>) de una conexión está limitado por su enlace más lento (el <em>cuello de botella</em>): \(\min(R_1, \dots, R_h)\). Ver el reparto de la capacidad entre paquetes en <a href="tema.html?id=packet-switching">conmutación de paquetes</a>.</p>`,
  });
})();
