(function () {
  'use strict';
  const { color: C } = VIZ;

  function montar(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Cliente', 'Servidor'],
      etiquetaCaso: 'Fase',
      casos: [
        { id: 'abrir', nombre: 'Establecer: saludo de 3 vías', msgs: (p) => [
          { de: 0, a: 1, texto: 'SYN seq=x', color: C.s1, nota: 'CLOSED → SYN_SENT', expl: 'El cliente elige un número de secuencia inicial x y envía SYN.', est: ['SYN_SENT', 'LISTEN'] },
          ...(p.perdida ? [{ de: 1, a: 0, texto: 'SYN+ACK (se pierde)', color: C.s2, perdido: true, expl: 'La respuesta se pierde en la red.', est: ['SYN_SENT', 'SYN_RCVD'] }, { de: 0, a: 1, texto: 'SYN seq=x (reintento)', color: C.s1, nota: 'vence el temporizador', expl: 'Tras el tiempo de espera, el cliente retransmite el SYN.', est: ['SYN_SENT', 'SYN_RCVD'] }] : []),
          { de: 1, a: 0, texto: 'SYN+ACK seq=y, ack=x+1', color: C.s2, nota: 'LISTEN → SYN_RCVD', expl: 'El servidor reconoce x y elige su propio número y.', est: ['SYN_SENT', 'SYN_RCVD'] },
          { de: 0, a: 1, texto: 'ACK ack=y+1', color: C.s1, nota: 'ESTABLISHED', expl: 'El cliente confirma y: la conexión está establecida en ambos lados (puede ya llevar datos).', est: ['ESTABLISHED', 'ESTABLISHED'] },
        ] },
        { id: 'datos', nombre: 'Intercambio con números de secuencia', msgs: () => [
          { de: 0, a: 1, texto: 'seq=1000, 500 B', color: C.s1, expl: 'El cliente envía 500 bytes; seq numera el primer byte del segmento.', est: ['ESTABLISHED', 'ESTABLISHED'] },
          { de: 1, a: 0, texto: 'ack=1500', color: C.s2, expl: 'El ACK es acumulativo e indica el siguiente byte esperado: 1500.', est: ['ESTABLISHED', 'ESTABLISHED'] },
          { de: 0, a: 1, texto: 'seq=1500, 500 B (se pierde)', color: C.s1, perdido: true, expl: 'Este segmento se pierde.', est: ['ESTABLISHED', 'ESTABLISHED'] },
          { de: 0, a: 1, texto: 'seq=2000, 500 B', color: C.s1, expl: 'El siguiente llega, pero el servidor espera el byte 1500.', est: ['ESTABLISHED', 'ESTABLISHED'] },
          { de: 1, a: 0, texto: 'ack=1500 (duplicado)', color: C.s2, expl: 'ACK duplicado: señala que falta el segmento que empieza en 1500.', est: ['ESTABLISHED', 'ESTABLISHED'] },
          { de: 0, a: 1, texto: 'seq=1500, 500 B (retransmisión)', color: C.s1, nota: 'por timeout o 3 ACK duplicados', expl: 'El cliente retransmite el segmento perdido.', est: ['ESTABLISHED', 'ESTABLISHED'] },
          { de: 1, a: 0, texto: 'ack=2500', color: C.s2, expl: 'Ahora el ACK acumulativo salta a 2500: ya llegaron ambos.', est: ['ESTABLISHED', 'ESTABLISHED'] },
        ] },
        { id: 'cerrar', nombre: 'Cerrar: 4 pasos', msgs: () => [
          { de: 0, a: 1, texto: 'FIN', color: C.s1, nota: 'ESTABLISHED → FIN_WAIT_1', expl: 'El cliente termina de enviar y manda FIN.', est: ['FIN_WAIT_1', 'ESTABLISHED'] },
          { de: 1, a: 0, texto: 'ACK', color: C.s2, nota: 'CLOSE_WAIT', expl: 'El servidor confirma. La conexión queda medio cerrada: el servidor aún puede enviar.', est: ['FIN_WAIT_2', 'CLOSE_WAIT'] },
          { de: 1, a: 0, texto: 'FIN', color: C.s2, nota: 'LAST_ACK', expl: 'Cuando el servidor termina de enviar, manda su propio FIN.', est: ['FIN_WAIT_2', 'LAST_ACK'] },
          { de: 0, a: 1, texto: 'ACK', color: C.s1, nota: 'TIME_WAIT (2·MSL)', expl: 'El cliente confirma y espera 2·MSL por si su ACK se pierde; el servidor se cierra.', est: ['TIME_WAIT', 'CLOSED'] },
        ] },
      ],
      params: [{ clave: 'perdida', etiqueta: 'Se pierde la respuesta del servidor (0 = no, 1 = sí)', min: 0, max: 1, valor: 0 }],
      leyenda: [{ color: C.s1, texto: 'cliente' }, { color: C.s2, texto: 'servidor' }, { color: C.s8, texto: 'segmento perdido', forma: 'punto' }],
      lectura: (c, m, k) => { const e = k ? m[k - 1].est : null; return [['mensajes', `${k} de ${m.length}`], ['estado del cliente', e ? e[0] : '—'], ['estado del servidor', e ? e[1] : '—']]; },
      nota: 'Avance con «Un paso». En el saludo de 3 vías active la pérdida de la respuesta para ver el temporizador y la retransmisión; los estados de TCP se muestran abajo.',
    });
  }

  VIZ.registrarTema('tcp-connection', {
    intro: String.raw`
      <p>Antes de intercambiar datos, TCP establece una <strong>conexión</strong>: ambos extremos acuerdan sus números de secuencia iniciales con un saludo de tres mensajes (<em>three-way handshake</em>). Después, cada byte del flujo está numerado, y los <strong>ACK</strong> permiten saber qué llegó. Al terminar, la conexión se cierra con otro intercambio.</p>
      <p>Que haya números de secuencia y confirmaciones es lo que permite detectar pérdidas, reordenamientos y duplicados.</p>`,
    visualizaciones: [
      { titulo: 'Abrir, usar y cerrar una conexión', descripcion: 'Recorra el saludo de 3 vías, un intercambio con una pérdida y el cierre. Active la pérdida del SYN+ACK en el saludo.', montar },
    ],
    teoria: String.raw`
      <h2>Saludo de tres vías</h2>
      <ol><li>Cliente → servidor: <code>SYN</code>, número de secuencia \(x\) (elegido al azar).</li><li>Servidor → cliente: <code>SYN+ACK</code>, secuencia \(y\), confirmación \(x+1\).</li><li>Cliente → servidor: <code>ACK</code> con confirmación \(y+1\); puede llevar ya datos.</li></ol>
      <p>Con dos mensajes no bastaría: el servidor no sabría si el cliente recibió su \(y\), ni habría protección contra SYN antiguos duplicados. La conexión costó 1 RTT antes de enviar el primer byte (ver su costo en <a href="tema.html?id=http-latency">HTTP</a>). Los números iniciales aleatorios dificultan que un atacante ciego falsifique segmentos; un exceso de SYN sin completar es el ataque <em>SYN flood</em>, contra el que se usan <em>SYN cookies</em>.</p>
      <h2>Números de secuencia y ACK</h2>
      <p>Cada segmento lleva el número de su primer byte; el ACK lleva el número del <em>siguiente byte esperado</em> (acumulativo). Un ACK repetido tres veces dispara la retransmisión rápida (ver <a href="tema.html?id=reliable-transfer">transferencia fiable</a>). El temporizador se calcula con el RTT medido: \(\text{RTO} = \text{RTT}_{\text{est}} + 4\,\text{RTT}_{\text{dev}}\), con \(\text{RTT}_{\text{est}} \leftarrow (1-\alpha)\text{RTT}_{\text{est}} + \alpha\,\text{muestra}\).</p>
      <h2>Cierre</h2>
      <p>Cada sentido se cierra por separado (FIN y su ACK), de modo que hacen falta cuatro mensajes; el que cierra primero queda en <code>TIME_WAIT</code> durante \(2\cdot\text{MSL}\) (típicamente 1–2 minutos) para absorber segmentos retrasados y reenviar el último ACK si se perdió. Los sockets implicados se describen en <a href="tema.html?id=ports-multiplexing">puertos y multiplexación</a>.</p>`,
  });
})();
