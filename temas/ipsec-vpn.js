(function () {
  'use strict';
  const { color: C } = VIZ;

  function montarFormato(cuerpo) {
    let modo = 'tunel', datos = 100;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modo', opciones: [['orig', 'Sin IPsec'], ['transp', 'Transporte'], ['tunel', 'Túnel']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Datos de la aplicación (bytes)', min: 20, max: 1400, paso: 10, valor: datos, alCambiar: (v) => { datos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 150 });
    VIZ.leyenda(cuerpo, [{ color: C.s3, texto: 'cabecera IP' }, { color: C.s2, texto: 'ESP (cabecera, cola, autenticación)' }, { color: C.s1, texto: 'TCP' }, { color: C.s4, texto: 'datos' }, { color: C.s7, texto: 'región cifrada', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'ESP agrega una cabecera (SPI y número de secuencia), una cola (relleno) y una etiqueta de autenticación (MAC). En modo túnel, el datagrama original completo va dentro, cifrado, con una cabecera IP nueva.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo; lienzo.limpiar();
      const IP = 20, TCP = 20, E = 8, COLA = 2, AUT = 12;
      const partes = { orig: [['IP', IP, C.s3, 0], ['TCP', TCP, C.s1, 0], ['datos', datos, C.s4, 0]], transp: [['IP', IP, C.s3, 0], ['ESP', E, C.s2, 0], ['TCP', TCP, C.s1, 1], ['datos', datos, C.s4, 1], ['cola', COLA, C.s2, 1], ['aut.', AUT, C.s2, 0]], tunel: [['IP nuevo', IP, C.s3, 0], ['ESP', E, C.s2, 0], ['IP orig.', IP, C.s3, 1], ['TCP', TCP, C.s1, 1], ['datos', datos, C.s4, 1], ['cola', COLA, C.s2, 1], ['aut.', AUT, C.s2, 0]] }[modo];
      const tot = partes.reduce((a, p) => a + p[1], 0), x0 = 10, ancho = W - 20, esc = ancho / (IP * 2 + TCP + E + COLA + AUT + datos);
      let x = x0; ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      const cif = [];
      partes.forEach(([n, b, col, c]) => { ctx.fillStyle = col; ctx.fillRect(x, 30, Math.max(1, b * esc - 1), 44); if (b * esc > 22) { ctx.fillStyle = C.sobre; ctx.fillText(n, x + (b * esc) / 2, 52, b * esc - 2); } if (c) cif.push([x, x + b * esc]); x += b * esc; });
      if (cif.length) { ctx.strokeStyle = C.s7; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cif[0][0], 86); ctx.lineTo(cif[cif.length - 1][1], 86); ctx.stroke(); ctx.fillStyle = C.s7; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('cifrado', cif[0][0], 100); }
      if (modo !== 'orig') { ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + (partes[0][1] * esc), 116); ctx.lineTo(x - AUT * esc - 1, 116); ctx.stroke(); ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('autenticado (ESP + todo lo cifrado)', x0 + partes[0][1] * esc, 130); }
      const base = IP + TCP + datos;
      registro.textContent = { orig: 'Sin protección: cualquiera en el camino lee y puede alterar el contenido, incluido el puerto TCP.', transp: 'Modo transporte: se protege el segmento TCP y los datos; la cabecera IP original queda visible (protege de extremo a extremo entre dos hosts).', tunel: 'Modo túnel: el datagrama original (con sus direcciones) viaja cifrado dentro de otro; los espías solo ven las direcciones de los dos gateways.' }[modo];
      lectura.set([['tamaño total', `${tot} B`], ['sobrecosto de IPsec', `${tot - base} B`], ['eficiencia', `${VIZ.fmt((datos / tot) * 100, 3)} %`], ['ve un espía', modo === 'orig' ? 'todo' : modo === 'transp' ? 'direcciones IP' : 'solo los gateways']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  function montarVPN(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Host A (10.1.0.5)', 'Gateway 1 (198.51.100.1)', 'Internet (espía)', 'Gateway 2 (203.0.113.1)', 'Host B (10.2.0.7)'],
      etiquetaCaso: 'Conexión',
      casos: [
        { id: 'vpn', nombre: 'Con VPN (túnel IPsec)', msgs: () => [
          { de: 0, a: 1, texto: '10.1.0.5 → 10.2.0.7', color: C.s1, nota: 'datagrama normal (en la red privada)', expl: 'A envía un datagrama a B por su red privada, hasta su gateway.' },
          { de: 1, a: 2, texto: '198.51.100.1 → 203.0.113.1 [ESP: ░░░░]', color: C.s7, nota: 'el original va cifrado dentro', expl: 'El gateway 1 cifra y autentica el datagrama completo y lo encapsula en otro con las direcciones de los gateways.' },
          { de: 2, a: 3, texto: 'el espía solo ve gateway↔gateway', color: C.s7, expl: 'En Internet, el espía ve tamaño y direcciones de los gateways, pero no el contenido ni las direcciones privadas.' },
          { de: 3, a: 4, texto: '10.1.0.5 → 10.2.0.7', color: C.s1, nota: 'descifrado y verificado', expl: 'El gateway 2 verifica la autenticación, descifra y entrega el datagrama original a B en su red privada.' },
        ] },
        { id: 'sin', nombre: 'Sin VPN (por Internet)', msgs: () => [
          { de: 0, a: 1, texto: '10.1.0.5 → 10.2.0.7', color: C.s1, expl: 'Las direcciones privadas no se pueden encaminar en Internet.' },
          { de: 1, a: 2, texto: 'contenido en claro', color: C.s8, expl: 'Con otra ruta sin protección, el espía ve cabeceras y datos completos y podría alterarlos.' },
          { de: 2, a: 3, texto: 'el espía lee y modifica', color: C.s8 },
          { de: 3, a: 4, texto: 'B recibe lo que el espía dejó', color: C.s1, expl: 'B no puede saber si el mensaje fue alterado.' },
        ] },
      ],
      leyenda: [{ color: C.s1, texto: 'datagrama original' }, { color: C.s7, texto: 'cifrado por el túnel' }, { color: C.s8, texto: 'expuesto', forma: 'punto' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['confidencialidad', c.id === 'vpn' ? 'sí (ESP)' : 'no'], ['integridad y origen', c.id === 'vpn' ? 'sí (MAC de ESP)' : 'no']],
    });
  }

  VIZ.registrarTema('ipsec-vpn', {
    intro: String.raw`
      <p><strong>IPsec</strong> protege en la capa de red: cifra y autentica los propios datagramas IP, de modo que cualquier aplicación queda protegida sin cambiarla. Su protocolo principal para el tráfico es <strong>ESP</strong> (<em>Encapsulating Security Payload</em>): agrega una cabecera, una cola y una etiqueta de autenticación (un MAC).</p>
      <p>Con él se construye una <strong>VPN</strong> (red privada virtual): dos redes distantes se conectan por Internet mediante un <strong>túnel</strong>, donde cada datagrama privado viaja cifrado dentro de otro datagrama entre los gateways.</p>`,
    visualizaciones: [
      { titulo: 'Qué agrega ESP', descripcion: 'Compare un datagrama sin protección, con ESP en modo transporte y en modo túnel: qué se cifra, qué se autentica y cuánto crece.', montar: montarFormato },
      { titulo: 'Un túnel VPN entre dos redes', descripcion: 'Siga un datagrama entre redes privadas con y sin VPN. Observe las direcciones que ve un espía en Internet.', montar: montarVPN },
    ],
    teoria: String.raw`
      <h2>Asociación de seguridad</h2>
      <p>Antes de enviar tráfico, los extremos negocian (con IKE, que usa <a href="tema.html?id=tls-key-exchange">intercambio de claves tipo Diffie–Hellman</a>) una <em>asociación de seguridad</em> (SA) unidireccional: algoritmos, claves y un identificador SPI que viaja en la cabecera ESP. Cada paquete lleva además un número de secuencia contra <em>repeticiones</em>.</p>
      <h2>Modos</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Transporte</th><th class="izq">Túnel</th></tr>
      <tr><td class="izq">protege</td><td class="izq">segmento (TCP/UDP + datos)</td><td class="izq">datagrama IP completo</td></tr>
      <tr><td class="izq">cabecera IP</td><td class="izq">la original</td><td class="izq">una nueva (gateways)</td></tr>
      <tr><td class="izq">uso típico</td><td class="izq">host a host</td><td class="izq">VPN sitio a sitio o de acceso remoto</td></tr>
      <tr><td class="izq">sobrecosto aprox.</td><td class="izq">22–36 B</td><td class="izq">42–56 B</td></tr></table>
      <pre><code>emisor (ESP, túnel):
    D ← datagrama original;  añadir cola (relleno + tipo)
    C ← cifrar(clave_enc, D + cola)
    T ← MAC(clave_aut, ESP_cabecera + C)
    enviar [IP nueva | ESP cabecera | C | T]
receptor: verificar T;  descifrar C;  entregar D</code></pre>
      <h2>Comparación con TLS</h2>
      <p>IPsec actúa en la capa de red: protege todo el tráfico y el sistema, sin tocar las aplicaciones, pero es más complejo de configurar. TLS actúa en la de transporte y protege una conexión de aplicación. Ambos usan <a href="tema.html?id=symmetric-encryption-mac">cifrado simétrico con MAC</a> para los datos. El tráfico que queda dentro de la red privada se filtra con un <a href="tema.html?id=firewall-filtering">firewall</a>. El túnel y el <a href="tema.html?id=layering-encapsulation">encapsulamiento</a> son la misma idea: un datagrama dentro de otro.</p>`,
  });
})();
