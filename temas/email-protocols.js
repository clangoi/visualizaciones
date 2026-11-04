(function () {
  'use strict';
  const { color: C } = VIZ;

  function montar(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Cliente de Ana', 'Servidor de Ana', 'Servidor de Beto', 'Cliente de Beto'],
      etiquetaCaso: 'Etapa',
      casos: [
        { id: 'todo', nombre: 'Recorrido completo del correo', msgs: () => [
          { de: 0, a: 1, texto: 'SMTP: enviar mensaje', color: C.s1, expl: 'Ana entrega el mensaje a su servidor de salida con SMTP (empuja el correo).' },
          { de: 1, a: 1, texto: 'consulta MX de dominio de Beto', color: C.s3, expl: 'El servidor de Ana busca en DNS el registro MX del dominio destino.' },
          { de: 1, a: 2, texto: 'HELO · MAIL FROM · RCPT TO · DATA', color: C.s1, nota: 'conexión TCP, puerto 25', expl: 'Entre servidores, SMTP transmite el mensaje con comandos de texto sobre TCP.' },
          { de: 2, a: 1, texto: '250 OK', color: C.s2, expl: 'El servidor de Beto acepta y guarda el mensaje en el buzón de Beto.' },
          { de: 3, a: 2, texto: 'IMAP/POP3: ¿correo nuevo?', color: C.s7, expl: 'Beto usa un protocolo de acceso (IMAP o POP3) para leer su buzón: aquí el cliente tira (pull).' },
          { de: 2, a: 3, texto: 'mensaje de Ana', color: C.s7 },
        ] },
        { id: 'smtp', nombre: 'Diálogo SMTP entre servidores', msgs: () => [
          { de: 1, a: 2, texto: 'TCP connect (puerto 25)', color: C.s1 },
          { de: 2, a: 1, texto: '220 beto.cl listo', color: C.s2 },
          { de: 1, a: 2, texto: 'HELO ana.cl', color: C.s1 },
          { de: 2, a: 1, texto: '250 hola ana.cl', color: C.s2 },
          { de: 1, a: 2, texto: 'MAIL FROM:<ana@ana.cl>', color: C.s1 },
          { de: 2, a: 1, texto: '250 OK', color: C.s2 },
          { de: 1, a: 2, texto: 'RCPT TO:<beto@beto.cl>', color: C.s1 },
          { de: 2, a: 1, texto: '250 OK', color: C.s2 },
          { de: 1, a: 2, texto: 'DATA … cuerpo … «.»', color: C.s1, expl: 'El cuerpo termina con una línea que contiene solo un punto.' },
          { de: 2, a: 1, texto: '250 mensaje aceptado', color: C.s2 },
          { de: 1, a: 2, texto: 'QUIT', color: C.s1 },
        ] },
      ],
      leyenda: [{ color: C.s1, texto: 'SMTP (envío)' }, { color: C.s7, texto: 'IMAP / POP3 (lectura)' }, { color: C.s2, texto: 'respuesta del servidor' }, { color: C.s3, texto: 'consulta DNS' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['protocolo de envío', 'SMTP (empuja)'], ['protocolo de lectura', 'IMAP / POP3 (tira)']],
    });
  }

  VIZ.registrarTema('email-protocols', {
    intro: String.raw`
      <p>El correo electrónico usa tres piezas: el <strong>agente de usuario</strong> (el cliente donde se escribe y lee), los <strong>servidores de correo</strong> con los buzones, y los <strong>protocolos</strong>. <strong>SMTP</strong> sirve para <em>enviar</em> (de cliente a servidor y entre servidores); <strong>POP3</strong> e <strong>IMAP</strong> sirven para <em>leer</em> el buzón.</p>
      <p>SMTP es un protocolo de texto sobre TCP, de empuje: quien tiene el mensaje se lo entrega al siguiente hasta llegar al servidor del destinatario.</p>`,
    visualizaciones: [
      { titulo: 'El viaje de un correo', descripcion: 'Recorra el camino de un mensaje de Ana a Beto y luego el diálogo de comandos SMTP entre los servidores.', montar },
    ],
    teoria: String.raw`
      <h2>SMTP</h2>
      <pre><code>S: 220 beto.cl listo
C: HELO ana.cl                    S: 250 hola
C: MAIL FROM:&lt;ana@ana.cl&gt;        S: 250 OK
C: RCPT TO:&lt;beto@beto.cl&gt;        S: 250 OK
C: DATA                           S: 354 escriba el mensaje, termine con «.»
C: …cabeceras y cuerpo…
C: .                              S: 250 aceptado
C: QUIT</code></pre>
      <p>Usa conexiones persistentes y envía todos los mensajes pendientes en una sola. El servidor de destino se encuentra con el registro MX del <a href="tema.html?id=dns-hierarchy-caching">DNS</a>. Si no responde, el servidor de origen reintenta durante días.</p>
      <h2>POP3 frente a IMAP</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">POP3</th><th class="izq">IMAP</th></tr>
      <tr><td class="izq">modelo</td><td class="izq">descarga y (normalmente) borra del servidor</td><td class="izq">el buzón vive en el servidor</td></tr>
      <tr><td class="izq">carpetas</td><td class="izq">no</td><td class="izq">sí, con estado compartido entre dispositivos</td></tr>
      <tr><td class="izq">varios dispositivos</td><td class="izq">incómodo</td><td class="izq">natural</td></tr></table>
      <h2>Comparación con HTTP</h2>
      <p>HTTP es de tirar (el cliente pide) y cada objeto va en su propia respuesta; SMTP es de empujar y mete todo en un único mensaje de texto ASCII de 7 bits (MIME codifica adjuntos). Ambos se apoyan en <a href="tema.html?id=ports-multiplexing">sockets TCP</a> y en la jerarquía de nombres; véase también <a href="tema.html?id=http-latency">HTTP</a>.</p>`,
  });
})();
