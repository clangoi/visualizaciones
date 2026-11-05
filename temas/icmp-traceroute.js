(function () {
  'use strict';
  const { color: C } = VIZ;

  function montar(cuerpo) {
    const A = ['Origen', 'Router 1', 'Router 2', 'Router 3', 'Destino'];
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: A,
      etiquetaCaso: 'Herramienta',
      casos: [
        { id: 'tr', nombre: 'traceroute (TTL creciente)', msgs: () => [
          { de: 0, a: 1, texto: 'paquete TTL = 1', color: C.s1, expl: 'traceroute envía un paquete con TTL 1.' },
          { de: 1, a: 0, texto: 'ICMP «TTL excedido»', color: C.s2, expl: 'El router 1 baja el TTL a 0, descarta el paquete y avisa al origen con ICMP: así se descubre el router 1 y su retardo.' },
          { de: 0, a: 2, texto: 'paquete TTL = 2', color: C.s1, expl: 'Ahora con TTL 2: el router 1 lo reenvía.' },
          { de: 2, a: 0, texto: 'ICMP «TTL excedido»', color: C.s2, expl: 'Expira en el router 2, que se identifica.' },
          { de: 0, a: 3, texto: 'paquete TTL = 3', color: C.s1 },
          { de: 3, a: 0, texto: 'ICMP «TTL excedido»', color: C.s2, expl: 'Router 3 identificado.' },
          { de: 0, a: 4, texto: 'paquete TTL = 4', color: C.s1, expl: 'Con TTL 4 el paquete llega al destino.' },
          { de: 4, a: 0, texto: 'ICMP «puerto inalcanzable»', color: C.s3, expl: 'El destino responde (el puerto elegido no existe a propósito): traceroute termina. Se obtuvo la lista Router 1 → 2 → 3 → destino.' },
        ] },
        { id: 'ping', nombre: 'ping (eco)', msgs: () => [
          { de: 0, a: 4, texto: 'ICMP echo request', color: C.s1, expl: 'ping envía una solicitud de eco al destino.' },
          { de: 4, a: 0, texto: 'ICMP echo reply', color: C.s2, expl: 'El destino responde con la misma carga: el tiempo de ida y vuelta es el RTT medido por ping.' },
        ] },
        { id: 'un', nombre: 'Destino inalcanzable', msgs: () => [
          { de: 0, a: 4, texto: 'paquete a una red sin ruta', color: C.s1 },
          { de: 2, a: 0, texto: 'ICMP «red inalcanzable»', color: C.s8, expl: 'El router 2 no tiene ruta hacia el destino: descarta el paquete y avisa al origen con ICMP.' },
        ] },
      ],
      leyenda: [{ color: C.s1, texto: 'paquete de prueba' }, { color: C.s2, texto: 'respuesta ICMP' }, { color: C.s8, texto: 'error', forma: 'punto' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['routers descubiertos', c.id === 'tr' ? String(Math.min(3, Math.floor(k / 2))) : '—']],
    });
  }

  VIZ.registrarTema('icmp-traceroute', {
    intro: String.raw`
      <p>IP envía paquetes «lo mejor posible», sin avisar si algo falla. <strong>ICMP</strong> (<em>Internet Control Message Protocol</em>) es el canal en el que routers y hosts informan de problemas: destino inalcanzable, tiempo excedido, solicitud de eco. Viaja dentro de paquetes IP, pero lo usan las capas de red, no las aplicaciones.</p>
      <p>Dos herramientas conocidas se basan en él: <code>ping</code> mide el RTT con mensajes de eco, y <code>traceroute</code> descubre la ruta usando el campo <strong>TTL</strong> de IP, que cada router decrementa.</p>`,
    visualizaciones: [
      { titulo: 'ping, traceroute y errores', descripcion: 'Siga cómo traceroute descubre uno a uno los routers con TTL creciente. Compare con ping y con un error de red inalcanzable.', montar },
    ],
    teoria: String.raw`
      <h2>TTL</h2>
      <p>El TTL (<em>time to live</em>) es un contador de 8 bits en la cabecera IP. Cada router lo disminuye en 1; si llega a 0, el router descarta el paquete y envía al origen un mensaje ICMP «tiempo excedido». Sin esto, un bucle de enrutamiento mantendría paquetes dando vueltas para siempre.</p>
      <pre><code>traceroute(destino):
    para ttl ← 1, 2, 3, …:
        enviar paquete con TTL = ttl
        esperar la respuesta ICMP;  anotar quién respondió y el tiempo
        si respondió el destino:  terminar</code></pre>
      <h2>Mensajes ICMP frecuentes</h2>
      <table class="tabla-datos"><tr><th>tipo</th><th class="izq">significado</th></tr><tr><td>0 / 8</td><td class="izq">respuesta / solicitud de eco (<code>ping</code>)</td></tr><tr><td>3</td><td class="izq">destino inalcanzable (red, host, puerto)</td></tr><tr><td>11</td><td class="izq">tiempo excedido (TTL = 0)</td></tr></table>
      <p>El número de saltos de una ruta es \(h\); traceroute envía \(h\) series de sondas. El RTT que mide incluye los retardos de cada salto (<a href="tema.html?id=network-delays">procesamiento, cola, transmisión y propagación</a>). Los routers deciden por dónde sigue el paquete con el <a href="tema.html?id=longest-prefix-forwarding">reenvío</a>; si no hay ruta, el aviso de «inalcanzable» es ICMP.</p>`,
  });
})();
