(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarSockets(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Cliente', 'Servidor'],
      casos: [
        { id: 'tcp', nombre: 'TCP (orientado a conexión)', msgs: () => [
          { de: 1, a: 1, texto: 'socket · bind · listen', color: C.s2, expl: 'El servidor crea su socket, lo asocia a un puerto (bind) y queda escuchando (listen).' },
          { de: 0, a: 0, texto: 'socket()', color: C.s1, expl: 'El cliente crea un socket TCP.' },
          { de: 0, a: 1, texto: 'connect() → SYN', color: C.s1, nota: 'handshake de 3 vías', expl: 'connect() inicia el establecimiento de la conexión con el servidor.' },
          { de: 1, a: 1, texto: 'accept()', color: C.s2, nota: 'nuevo socket de conexión', expl: 'accept() devuelve un socket nuevo dedicado a este cliente; el de escucha sigue libre.' },
          { de: 0, a: 1, texto: 'send("GET /")', color: C.s1, expl: 'El cliente envía datos por la conexión.' },
          { de: 1, a: 0, texto: 'send("respuesta")', color: C.s2, expl: 'El servidor responde por el mismo socket.' },
          { de: 0, a: 1, texto: 'close()', color: C.s1, expl: 'El cliente cierra; el servidor lo notará al leer fin de archivo.' },
        ] },
        { id: 'udp', nombre: 'UDP (sin conexión)', msgs: () => [
          { de: 1, a: 1, texto: 'socket · bind', color: C.s2, expl: 'El servidor crea un socket UDP y lo asocia a un puerto. No hay listen ni accept.' },
          { de: 0, a: 0, texto: 'socket()', color: C.s1, expl: 'El cliente crea un socket UDP.' },
          { de: 0, a: 1, texto: 'sendto(dirección, "datos")', color: C.s1, nota: 'cada datagrama lleva destino', expl: 'Cada datagrama se envía con la dirección de destino; no hay conexión previa.' },
          { de: 1, a: 1, texto: 'recvfrom()', color: C.s2, expl: 'El servidor recibe un datagrama y conoce el origen.' },
          { de: 1, a: 0, texto: 'sendto(origen, "respuesta")', color: C.s2, expl: 'El servidor responde al origen del datagrama.' },
        ] },
      ],
      leyenda: [{ color: C.s1, texto: 'cliente' }, { color: C.s2, texto: 'servidor' }],
      lectura: (c, m, k) => [['llamadas hechas', String(k)], ['protocolo', c.id === 'tcp' ? 'TCP: flujo de bytes fiable' : 'UDP: datagramas sueltos'], ['conexión previa', c.id === 'tcp' ? 'sí' : 'no']],
    });
  }

  function montarDistribucion(cuerpo) {
    let F = 15, u = 0.3, d = 2, N = 10, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Archivo F (GB)', min: 1, max: 50, valor: F, alCambiar: (v) => { F = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Subida de cada par u (Mbps)', min: 0.1, max: 2, paso: 0.1, valor: u, alCambiar: (v) => { u = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Bajada de cada cliente d (Mbps)', min: 1, max: 10, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'cliente-servidor', forma: 'linea' }, { color: C.s1, texto: 'P2P', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tiempo para que N clientes obtengan el archivo. El servidor sube a 30 Mbps. En cliente-servidor crece linealmente con N; en P2P cada par que llega aporta capacidad de subida.');
    const us = 30, bits = () => F * 8e3; // Mb
    const cs = (n) => Math.max((n * bits()) / us, bits() / d) / 3600;
    const p2p = (n) => Math.max(bits() / us, bits() / d, (n * bits()) / (us + n * u)) / 3600;
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: cs(100) * 1.05 }, { etiquetaX: 'clientes N', etiquetaY: 'horas' });
      plano.ejes();
      VIZ.trazar(ctx, plano, Array.from({ length: 101 }, (_, n) => [n, cs(Math.max(1, n))]), C.s8, 2);
      VIZ.trazar(ctx, plano, Array.from({ length: 101 }, (_, n) => [n, p2p(Math.max(1, n))]), C.s1, 2);
      if (hover) { VIZ.marcador(ctx, plano.sx(hover), plano.sy(cs(hover)), C.s8, 4); VIZ.marcador(ctx, plano.sx(hover), plano.sy(p2p(hover)), C.s1, 4); }
      lectura.set([['N = 10', `${VIZ.fmt(cs(10), 3)} h · ${VIZ.fmt(p2p(10), 3)} h`], ['N = 100', `${VIZ.fmt(cs(100), 3)} h · ${VIZ.fmt(p2p(100), 3)} h`], ['mejora de P2P (N = 100)', `${VIZ.fmt(cs(100) / p2p(100), 3)}×`], ['(cliente-servidor · P2P)', '']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(1, Math.round(plano.ix(x))); dibujar();
      tip.mostrar(x, y, `N = <b>${hover}</b>` + VIZ.filaTooltip(C.s8, 'cliente-servidor', VIZ.fmt(cs(hover), 3) + ' h') + VIZ.filaTooltip(C.s1, 'P2P', VIZ.fmt(p2p(hover), 3) + ' h'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('sockets-client-server', {
    intro: String.raw`
      <p>Las aplicaciones de red siguen dos arquitecturas. En <strong>cliente-servidor</strong>, un servidor siempre activo con dirección fija atiende las solicitudes de muchos clientes (la web). En <strong>P2P</strong>, cualquier par a la vez pide y ofrece servicio, y la capacidad total crece con los usuarios (BitTorrent).</p>
      <p>Los procesos de una y otra se comunican a través de <strong>sockets</strong>, la puerta entre la aplicación y la capa de transporte: la aplicación escribe y lee en el socket y el sistema se encarga del resto.</p>`,
    visualizaciones: [
      { titulo: 'Programación con sockets', descripcion: 'Compare la secuencia de llamadas con TCP (connect, accept) y con UDP (sendto, recvfrom).', montar: montarSockets },
      { titulo: 'Cliente-servidor frente a P2P', descripcion: 'Aumente los clientes: el servidor se satura y el tiempo crece sin parar, pero en P2P casi no cambia. Pruebe una subida baja por par.', montar: montarDistribucion },
    ],
    teoria: String.raw`
      <h2>Direcciones y puertos</h2>
      <p>Un proceso se identifica en la red con la dirección IP del host y un <strong>puerto</strong> de 16 bits: web 80/443, correo 25, DNS 53. Ver cómo el transporte reparte los segmentos en <a href="tema.html?id=ports-multiplexing">multiplexación y puertos</a>.</p>
      <h2>Servidor TCP</h2>
      <pre><code>s ← socket(TCP);  bind(s, puerto);  listen(s)
mientras verdadero:
    c ← accept(s)           # bloquea hasta que llegue un cliente
    atender(c)              # recv / send sobre c
    close(c)</code></pre>
      <p>Cada <code>accept</code> da un socket nuevo; así un servidor puede atender varios clientes a la vez con un hilo o proceso por cliente (<a href="tema.html?id=threads-models">hilos</a>) o con E/S asíncrona.</p>
      <h2>Tiempo de distribución</h2>
      <p>Para repartir un archivo de \(F\) bits a \(N\) clientes, con subida del servidor \(u_s\), subida de cada par \(u_i\) y bajada mínima \(d_{\min}\):</p>
      \[ D_{\text{CS}} = \max\left\{\frac{N F}{u_s},\; \frac{F}{d_{\min}}\right\}, \qquad D_{\text{P2P}} \ge \max\left\{\frac{F}{u_s},\; \frac{F}{d_{\min}},\; \frac{N F}{u_s + \sum_i u_i}\right\}. \]
      <p>En cliente-servidor el tiempo crece linealmente con \(N\); en P2P, la capacidad de subida total también crece con \(N\), por lo que el tiempo se estabiliza. A cambio, P2P es difícil de administrar y exige incentivos para que los pares cooperen. Lea la <a href="tema.html?id=client-server">arquitectura cliente-servidor y de varias capas</a> y los <a href="tema.html?id=chord-dht">sistemas P2P estructurados</a>.</p>`,
  });
})();
