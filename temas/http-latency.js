(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarSecuencia(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Navegador', 'Servidor web'],
      casos: [
        { id: 'np', nombre: 'HTTP/1.0: conexión por objeto', msgs: () => [
          { de: 0, a: 1, texto: 'SYN', color: C.s1, nota: 'conexión 1', expl: 'Se abre una conexión TCP para el objeto base (1 RTT).' },
          { de: 1, a: 0, texto: 'SYN+ACK', color: C.s2 },
          { de: 0, a: 1, texto: 'ACK + GET /index.html', color: C.s1, expl: 'El navegador completa el handshake y pide el HTML.' },
          { de: 1, a: 0, texto: 'respuesta + FIN', color: C.s2, expl: 'El servidor responde y cierra la conexión (1 RTT más).' },
          { de: 0, a: 1, texto: 'SYN', color: C.s1, nota: 'conexión 2', expl: 'Para la imagen, una conexión TCP nueva: otro RTT solo de handshake.' },
          { de: 1, a: 0, texto: 'SYN+ACK', color: C.s2 },
          { de: 0, a: 1, texto: 'ACK + GET /img.png', color: C.s1 },
          { de: 1, a: 0, texto: 'respuesta + FIN', color: C.s2, expl: 'Dos objetos costaron 4 RTT más el tiempo de transmisión.' },
        ] },
        { id: 'pers', nombre: 'HTTP/1.1: conexión persistente', msgs: () => [
          { de: 0, a: 1, texto: 'SYN', color: C.s1, nota: 'una conexión', expl: 'Se abre una sola conexión TCP (1 RTT).' },
          { de: 1, a: 0, texto: 'SYN+ACK', color: C.s2 },
          { de: 0, a: 1, texto: 'ACK + GET /index.html', color: C.s1 },
          { de: 1, a: 0, texto: 'respuesta', color: C.s2, expl: 'El servidor responde y deja la conexión abierta.' },
          { de: 0, a: 1, texto: 'GET /img.png', color: C.s1, expl: 'La misma conexión se reutiliza: se ahorra el handshake.' },
          { de: 1, a: 0, texto: 'respuesta', color: C.s2, expl: 'Dos objetos costaron 3 RTT más la transmisión.' },
        ] },
        { id: 'pipe', nombre: 'Persistente con pipelining', msgs: () => [
          { de: 0, a: 1, texto: 'SYN', color: C.s1, nota: 'una conexión' },
          { de: 1, a: 0, texto: 'SYN+ACK', color: C.s2 },
          { de: 0, a: 1, texto: 'ACK + GET /index.html', color: C.s1, expl: 'Se pide el HTML.' },
          { de: 1, a: 0, texto: 'respuesta', color: C.s2, expl: 'Con el HTML se descubren los objetos referenciados.' },
          { de: 0, a: 1, texto: 'GET img1 · GET img2 · GET img3', color: C.s1, nota: 'varias solicitudes sin esperar', expl: 'Pipelining: se envían todas las solicitudes seguidas, sin esperar cada respuesta.' },
          { de: 1, a: 0, texto: 'img1 · img2 · img3', color: C.s2, expl: 'Tres objetos en un solo RTT adicional.' },
        ] },
      ],
      etiquetaCaso: 'Versión',
      leyenda: [{ color: C.s1, texto: 'navegador' }, { color: C.s2, texto: 'servidor' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['RTT para 2 objetos', { np: '4', pers: '3', pipe: '3 (y 1 por cada lote adicional)' }[c.id]]],
    });
  }

  function montarTiempo(cuerpo) {
    let rtt = 100, par = 1, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'RTT (ms)', min: 10, max: 300, paso: 10, valor: rtt, alCambiar: (v) => { rtt = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Conexiones paralelas (HTTP/1.0)', min: 1, max: 6, valor: par, alCambiar: (v) => { par = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s8, texto: 'HTTP/1.0 sin persistencia', forma: 'linea' }, { color: C.s1, texto: 'persistente', forma: 'linea' }, { color: C.s3, texto: 'persistente con pipelining', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tiempo de carga de una página con un HTML y n objetos pequeños (se ignora el tiempo de transmisión). Cada punto de red cuesta un RTT.');
    const np = (n) => (2 + 2 * Math.ceil(n / par)) * rtt - 0 * n, pers = (n) => (2 + n) * rtt + 0, pipe = (n) => (n ? 3 : 2) * rtt + rtt;
    const f = [np, (n) => 2 * rtt + rtt + n * rtt - rtt + rtt - rtt, (n) => 3 * rtt + (n ? rtt : 0)];
    // Definiciones: HTML: 2 RTT (handshake + GET). Cada objeto adicional: no persistente 2 RTT (secuenciales, /par); persistente 1 RTT; pipelining 1 RTT en total.
    const T = [(n) => 2 * rtt + 2 * rtt * Math.ceil(n / par), (n) => 2 * rtt + rtt * n, (n) => 2 * rtt + (n ? rtt : 0)];
    void np; void pers; void pipe; void f;
    let plano;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 20, ymin: 0, ymax: T[0](20) * 1.05 || 1 }, { etiquetaX: 'objetos en la página', etiquetaY: 'tiempo (ms)' });
      plano.ejes();
      [C.s8, C.s1, C.s3].forEach((col, i) => { VIZ.trazar(ctx, plano, Array.from({ length: 21 }, (_, n) => [n, T[i](n)]), col, 2); if (hover != null) VIZ.marcador(ctx, plano.sx(hover), plano.sy(T[i](hover)), col, 4); });
      lectura.set([['10 objetos: HTTP/1.0', `${T[0](10)} ms`], ['10 objetos: persistente', `${T[1](10)} ms`], ['10 objetos: pipelining', `${T[2](10)} ms`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.round(plano.ix(x))); dibujar();
      tip.mostrar(x, y, `<b>${hover}</b> objetos` + VIZ.filaTooltip(C.s8, 'HTTP/1.0', T[0](hover) + ' ms') + VIZ.filaTooltip(C.s1, 'persistente', T[1](hover) + ' ms') + VIZ.filaTooltip(C.s3, 'pipelining', T[2](hover) + ' ms'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('http-latency', {
    intro: String.raw`
      <p><strong>HTTP</strong> es el protocolo de la web: el cliente envía una solicitud (<code>GET /index.html</code>) y el servidor responde con un código de estado y el objeto. Es un protocolo <em>sin estado</em> que corre sobre TCP.</p>
      <p>Lo que más cuesta en una página no suele ser transmitir los bytes, sino los <strong>viajes de ida y vuelta</strong> (RTT): cada conexión TCP nueva cuesta uno solo en el saludo. Por eso la historia de HTTP es la de ahorrar RTT: conexiones persistentes, <em>pipelining</em> y, después, multiplexación.</p>`,
    visualizaciones: [
      { titulo: 'Cuántos RTT cuesta cada versión', descripcion: 'Compare los tres escenarios para una página con un HTML y una o varias imágenes, y cuente los RTT en cada paso.', montar: montarSecuencia },
      { titulo: 'Tiempo de carga frente a objetos', descripcion: 'Aumente los objetos y el RTT. Con muchas imágenes, la diferencia entre abrir una conexión por objeto y reutilizarla es enorme.', montar: montarTiempo },
    ],
    teoria: String.raw`
      <h2>Mensajes</h2>
      <pre><code>GET /index.html HTTP/1.1
Host: www.ejemplo.cl

HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 2048
…</code></pre>
      <p>Métodos: <code>GET</code>, <code>POST</code>, <code>PUT</code>, <code>DELETE</code>. Códigos: 2xx éxito, 3xx redirección, 4xx error del cliente, 5xx error del servidor. Las <em>cookies</em> añaden estado sobre un protocolo sin estado, y los <em>proxies</em> y cachés con <code>If-Modified-Since</code> evitan retransmitir.</p>
      <h2>Modelo de latencia</h2>
      <p>Una página con un HTML y \(n\) objetos pequeños, ignorando el tiempo de transmisión:</p>
      \[ T_{\text{1.0}} = 2\,\mathrm{RTT} + 2\,\mathrm{RTT}\left\lceil \frac{n}{k} \right\rceil, \qquad T_{\text{pers.}} = 2\,\mathrm{RTT} + n\,\mathrm{RTT}, \qquad T_{\text{pipe}} \approx 3\,\mathrm{RTT}, \]
      <p>donde \(k\) es el número de conexiones paralelas. Con RTT de 100 ms y 10 objetos: 2,2 s, 1,2 s y 0,3 s.</p>
      <h2>Evolución</h2>
      <ul><li>HTTP/1.1: persistente; el <em>pipelining</em> sufre bloqueo de cabeza de línea.</li><li>HTTP/2: multiplexa varios flujos en una conexión TCP.</li><li>HTTP/3: lo hace sobre QUIC (UDP), evitando que una pérdida detenga todos los flujos.</li></ul>
      <p>Cada conexión depende del <a href="tema.html?id=tcp-connection">handshake de TCP</a>, del <a href="tema.html?id=tcp-congestion-control">control de congestión</a> y de resolver el nombre con <a href="tema.html?id=dns-hierarchy-caching">DNS</a>; con HTTPS se agrega el <a href="tema.html?id=tls-key-exchange">saludo de TLS</a>.</p>`,
  });
})();
