(function () {
  'use strict';
  const { color: C, el } = VIZ;

  function montarDemux(cuerpo) {
    let proto = 'tcp', sem = 1, pk;
    const CL = [['10.0.0.5', 'Ana'], ['10.0.0.9', 'Beto'], ['10.0.0.5', 'Ana'], ['172.16.2.1', 'Carla']];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Protocolo del servidor (puerto 80)', opciones: [['tcp', 'TCP'], ['udp', 'UDP']], valor: proto, alCambiar: (v) => { proto = v; reiniciar(); } });
    ctl.boton('Llega un segmento', () => llegar(), { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de segmentos y sockets, sin colores con significado';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El servidor escucha en el puerto 80. Con UDP, todos los segmentos para ese puerto van a un único socket; con TCP, cada conexión (IP origen, puerto origen) tiene su propio socket.');
    let socks, hist;
    function reiniciar() { socks = new Map(); hist = []; sem = 1; registro.textContent = 'Todavía no ha llegado ningún segmento.'; dibujar(); }
    function llegar() {
      const rnd = VIZ.semilla(sem++ * 5 + 3), c = CL[Math.floor(rnd() * CL.length)], pto = 49152 + Math.floor(rnd() * 3) * 7;
      const clave = proto === 'udp' ? ':80' : `${c[0]}:${pto}→:80`;
      if (!socks.has(clave)) socks.set(clave, socks.size + 1);
      hist.push({ ip: c[0], quien: c[1], pto, s: socks.get(clave) });
      registro.textContent = proto === 'udp' ? `Segmento de ${c[0]}:${pto}: UDP mira solo (IP destino, puerto destino); va al único socket.` : `Segmento de ${c[0]}:${pto}: TCP usa la tupla de 4 valores; ${hist.filter((h) => h.s === socks.get(clave)).length > 1 ? 'ya existe esa conexión.' : 'nuevo socket de conexión.'}`;
      dibujar();
    }
    function dibujar() {
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['#', 'origen (IP:puerto)', 'cliente', 'socket'].map((h) => el('th', null, h))),
        hist.slice(-8).map((h, i) => el('tr', null, el('td', null, String(hist.length - Math.min(8, hist.length) + i + 1)), el('td', null, `${h.ip}:${h.pto}`), el('td', null, h.quien), el('td', { style: { fontWeight: 600 } }, 'socket ' + h.s)))));
      lectura.set([['segmentos recibidos', String(hist.length)], ['sockets distintos en uso', String(socks.size)], ['identifica al socket', proto === 'udp' ? '(IP destino, puerto destino)' : '(IP orig., puerto orig., IP dest., puerto dest.)']]);
    }
    reiniciar();
  }

  function montarComparacion(cuerpo) {
    let n = 100, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Segmentos a enviar', min: 20, max: 1000, paso: 10, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'UDP: segmentos que se pierden', forma: 'linea' }, { color: C.s1, texto: 'TCP: transmisiones por segmento entregado', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con probabilidad de pérdida p, UDP entrega solo la fracción (1 − p) y no avisa; TCP entrega todo, pero necesita en promedio 1/(1 − p) transmisiones por segmento (más tiempo).');
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 0.5, ymin: 0, ymax: 2.1 }, { etiquetaX: 'probabilidad de pérdida p', etiquetaY: 'relativo', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      VIZ.trazar(ctx, plano, Array.from({ length: 51 }, (_, i) => [i / 100, 1 - (i / 100)]), C.s8, 2);
      VIZ.trazar(ctx, plano, Array.from({ length: 51 }, (_, i) => [i / 100, 1 / (1 - i / 100)]), C.s1, 2);
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.s8; ctx.textAlign = 'left'; ctx.fillText('fracción entregada por UDP', plano.sx(0.3), plano.sy(0.62));
      ctx.fillStyle = C.s1; ctx.fillText('transmisiones por segmento (TCP)', plano.sx(0.12), plano.sy(1.5));
      if (hover != null) { VIZ.marcador(ctx, plano.sx(hover), plano.sy(1 - hover), C.s8, 4); VIZ.marcador(ctx, plano.sx(hover), plano.sy(1 / (1 - hover)), C.s1, 4); }
      lectura.set([['con p = 5 %: UDP entrega', `${Math.round(n * 0.95)} de ${n}`], ['con p = 20 %: UDP entrega', `${Math.round(n * 0.8)} de ${n}`], ['con p = 20 %: TCP transmite', `≈ ${Math.round(n / 0.8)} segmentos`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(0.5, Math.round(plano.ix(x) * 100) / 100)); dibujar();
      tip.mostrar(x, y, `p = <b>${Math.round(hover * 100)} %</b>` + VIZ.filaTooltip(C.s8, 'UDP entrega', `${Math.round(n * (1 - hover))} de ${n}`) + VIZ.filaTooltip(C.s1, 'TCP transmite', `≈ ${Math.round(n / (1 - hover))}`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('ports-multiplexing', {
    intro: String.raw`
      <p>La capa de red entrega datagramas a un <em>host</em>; la de transporte los entrega al <em>proceso</em> correcto. Lo hace con <strong>puertos</strong>: el emisor <strong>multiplexa</strong> (reúne datos de varios sockets, les pone puertos de origen y destino y los pasa a la red) y el receptor <strong>demultiplexa</strong> (mira el puerto de destino y entrega al socket adecuado).</p>
      <p>Hay dos servicios. <strong>UDP</strong> agrega casi nada: entrega mensajes sueltos, sin conexión y sin garantías. <strong>TCP</strong> ofrece un flujo de bytes fiable, ordenado y con control de flujo y de congestión, a costa de establecer una conexión.</p>`,
    visualizaciones: [
      { titulo: 'Demultiplexación en el servidor', descripcion: 'Haga llegar segmentos al puerto 80 y vea cuántos sockets distintos crea un servidor UDP frente a uno TCP.', montar: montarDemux },
      { titulo: 'TCP frente a UDP bajo pérdidas', descripcion: 'Aumente la probabilidad de pérdida. UDP entrega cada vez menos; TCP sigue entregando todo, pero retransmite.', montar: montarComparacion },
    ],
    teoria: String.raw`
      <h2>Identificación del socket</h2>
      <ul><li><strong>UDP</strong>: la tupla (IP destino, puerto destino). Datagramas de distintos orígenes al mismo puerto llegan al mismo socket.</li>
      <li><strong>TCP</strong>: la tupla de cuatro (IP origen, puerto origen, IP destino, puerto destino). Un servidor web en el puerto 80 tiene un socket por conexión.</li></ul>
      <h2>Comparación</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">UDP</th><th class="izq">TCP</th></tr>
      <tr><td class="izq">conexión</td><td class="izq">no</td><td class="izq">sí (<a href="tema.html?id=tcp-connection">handshake</a>)</td></tr>
      <tr><td class="izq">entrega</td><td class="izq">sin garantía, puede perder o desordenar</td><td class="izq"><a href="tema.html?id=reliable-transfer">fiable y ordenada</a></td></tr>
      <tr><td class="izq">control</td><td class="izq">ninguno</td><td class="izq"><a href="tema.html?id=tcp-flow-control">flujo</a> y <a href="tema.html?id=tcp-congestion-control">congestión</a></td></tr>
      <tr><td class="izq">cabecera</td><td class="izq">8 bytes</td><td class="izq">20 bytes o más</td></tr>
      <tr><td class="izq">usos</td><td class="izq">DNS, voz, vídeo, juegos, QUIC</td><td class="izq">web, correo, archivos</td></tr></table>
      <p>UDP conviene cuando importa más la <em>puntualidad</em> que la completitud (una trama de vídeo atrasada ya no sirve) o cuando se quiere construir otro protocolo encima. La suma de verificación de UDP es la misma que se estudia en <a href="tema.html?id=error-detection-crc">detección de errores</a>.</p>
      <h2>Costo de la fiabilidad</h2>
      <p>Si cada segmento se pierde con probabilidad \(p\), el número de transmisiones por segmento entregado es geométrico con media \(1/(1-p)\): con \(p = 20\,\%\), 1,25 transmisiones por segmento. La programación de ambos tipos de socket está en <a href="tema.html?id=sockets-client-server">sockets</a>.</p>`,
  });
})();
