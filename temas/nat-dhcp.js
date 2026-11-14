(function () {
  'use strict';
  const { color: C, el } = VIZ;

  function montarDHCP(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Cliente nuevo', 'Servidor DHCP'],
      casos: [{ id: 'dora', nombre: 'Obtener una dirección (DORA)', msgs: () => [
        { de: 0, a: 1, texto: 'DHCP Discover', color: C.s1, nota: '0.0.0.0 → 255.255.255.255 (difusión)', expl: 'El cliente aún no tiene dirección: pregunta por difusión si hay algún servidor DHCP.' },
        { de: 1, a: 0, texto: 'DHCP Offer', color: C.s2, nota: 'ofrece 192.168.0.23, 1 hora', expl: 'El servidor ofrece una dirección, la máscara, la puerta de enlace, el DNS y el tiempo de préstamo.' },
        { de: 0, a: 1, texto: 'DHCP Request', color: C.s1, nota: 'acepta 192.168.0.23', expl: 'El cliente acepta una oferta (por difusión, para que otros servidores sepan que la rechazó).' },
        { de: 1, a: 0, texto: 'DHCP ACK', color: C.s2, nota: 'confirma el préstamo', expl: 'El servidor confirma; el cliente configura su interfaz y puede usar la red.' },
        { de: 0, a: 1, texto: 'Renovar a mitad del plazo', color: C.s1, punteado: true, expl: 'A la mitad del tiempo de préstamo el cliente pide renovarlo; si no, la dirección vuelve al conjunto.' },
      ] }],
      leyenda: [{ color: C.s1, texto: 'cliente' }, { color: C.s2, texto: 'servidor' }],
      lectura: (c, m, k) => [['paso', `${k} de ${m.length}`], ['dirección', k >= 4 ? '192.168.0.23/24' : 'sin dirección'], ['préstamo', k >= 4 ? '1 hora' : '—']],
    });
  }

  function montarNAT(cuerpo) {
    let tabla, sel = 0, msg, sig;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Host interno', opciones: [[0, 'A · 192.168.0.2'], [1, 'B · 192.168.0.3']], valor: 0, alCambiar: (v) => { sel = +v; } });
    ctl.boton('Abrir conexión a Internet', () => abrir(), { primario: true });
    ctl.boton('Respuesta del servidor', () => responder());
    ctl.boton('Paquete no solicitado desde fuera', () => externo());
    ctl.boton('Reiniciar', () => reiniciar());
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de traducciones, sin colores con significado';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El router NAT tiene una sola dirección pública (203.0.113.9). Al salir, reescribe origen y puerto y recuerda la traducción; al volver la respuesta, la deshace. Lo que nadie pidió desde dentro se descarta.');
    const HOSTS = ['192.168.0.2', '192.168.0.3'];
    function reiniciar() { tabla = []; sig = 5001; msg = 'La tabla de traducción NAT está vacía.'; dibujar(); }
    function abrir() { const pi = 40000 + tabla.length * 13 + sel * 7; const e = { ip: HOSTS[sel], pi, pp: sig++ }; tabla.push(e); msg = `Sale ${e.ip}:${e.pi} → 93.184.216.34:80. El NAT lo reescribe como 203.0.113.9:${e.pp} y guarda la entrada.`; dibujar(); }
    function responder() { const e = tabla.filter((q) => q.ip === HOSTS[sel]).pop(); msg = e ? `Llega 93.184.216.34:80 → 203.0.113.9:${e.pp}. La tabla dice que es de ${e.ip}:${e.pi}: se reescribe el destino y se entrega al host.` : `No hay conexión abierta desde ${HOSTS[sel]}: no hay nada que responder.`; dibujar(); }
    function externo() { msg = 'Llega un paquete a 203.0.113.9:6000 sin entrada en la tabla: el NAT no sabe a qué host interno entregarlo y lo descarta (por eso un host tras NAT no es alcanzable desde fuera).'; dibujar(); }
    function dibujar() {
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['lado LAN (IP:puerto)', 'lado WAN (IP:puerto)'].map((h) => el('th', null, h))),
        tabla.length ? tabla.map((e) => el('tr', null, el('td', null, `${e.ip}:${e.pi}`), el('td', null, `203.0.113.9:${e.pp}`))) : [el('tr', null, el('td', null, '—'), el('td', null, '—'))]));
      registro.textContent = msg;
      lectura.set([['entradas en la tabla', String(tabla.length)], ['direcciones públicas usadas', '1'], ['puertos disponibles (16 bits)', '≈ 60 000']]);
    }
    reiniciar();
  }

  VIZ.registrarTema('nat-dhcp', {
    intro: String.raw`
      <p>Un computador recién conectado no sabe qué dirección usar. <strong>DHCP</strong> se la presta: el cliente pregunta por difusión y un servidor le entrega una dirección, la máscara, la puerta de enlace y el servidor DNS durante un tiempo limitado.</p>
      <p>Pero las direcciones IPv4 públicas escasean, así que las redes domésticas y de empresas usan direcciones privadas (<code>192.168.x.x</code>) y un router con <strong>NAT</strong> traduce hacia una única dirección pública, distinguiendo las conexiones por el puerto.</p>`,
    parametros: [
      ['Un paso y reproductor (Fig. 1)', String.raw`Avanzan o reinician los cuatro mensajes DORA (Discover, Offer, Request, ACK) y la renovación del préstamo.`],
      ['Host interno (Fig. 2)', String.raw`Qué equipo de la red privada inicia la conexión, A o B. Cada uno tiene su dirección privada y obtiene su propia entrada en la tabla.`],
      ['Abrir conexión, Respuesta del servidor, Paquete no solicitado, Reiniciar (Fig. 2)', String.raw`Simulan una conexión saliente que crea una traducción, la respuesta que la usa, un paquete desde fuera sin entrada previa (se descarta) y el vaciado de la tabla.`],
    ],
    visualizaciones: [
      { titulo: 'DHCP: obtener una dirección', descripcion: 'Siga los cuatro mensajes (Discover, Offer, Request, ACK) y vea cuándo el cliente ya tiene dirección.',
        ayuda: String.raw`<p>Las flechas azules son mensajes del cliente y las naranjas, del servidor DHCP. Muestra en orden cómo el cliente, sin dirección (0.0.0.0), la solicita por difusión, recibe una oferta, la acepta y recibe la confirmación.</p>
          <ul>
          <li>Cada paso avanza un mensaje; solo tras el ACK el cliente tiene dirección, y la última flecha punteada es la renovación a mitad del plazo.</li>
          </ul>`, montar: montarDHCP },
      { titulo: 'La tabla de traducción de un NAT', descripcion: 'Abra conexiones desde A y B, haga llegar respuestas y pruebe un paquete externo sin solicitud previa.',
        ayuda: String.raw`<p>La tabla de traducción asocia (IP privada, puerto) con (IP pública, puerto externo). El registro explica el efecto de cada acción.</p>
          <ul>
          <li><strong>Abrir conexión a Internet</strong>: añade una fila para el host elegido con un puerto externo nuevo.</li>
          <li><strong>Respuesta del servidor</strong>: se traduce de vuelta gracias a esa fila y llega al host interno.</li>
          <li><strong>Paquete no solicitado desde fuera</strong>: no coincide con ninguna fila y se descarta; el NAT no deja entrar tráfico no iniciado desde dentro.</li>
          </ul>`, montar: montarNAT },
    ],
    teoria: String.raw`
      <h2>DHCP</h2>
      <p>Funciona sobre UDP (puertos 67 y 68). Los mensajes iniciales usan difusión porque el cliente no tiene dirección ni sabe la del servidor. El préstamo se renueva a \(T/2\) y, si falla, se reintenta hasta \(7T/8\). Con préstamos cortos, un conjunto pequeño de direcciones atiende a muchos dispositivos que van y vienen.</p>
      <h2>NAT</h2>
      <pre><code>saliente:  (IP_int, p_int) → (IP_pub, p_nuevo);   tabla[p_nuevo] ← (IP_int, p_int)
entrante:  destino (IP_pub, p) → buscar tabla[p] → reescribir destino a (IP_int, p_int)
           si no existe la entrada: descartar</code></pre>
      <p>Con un campo de puerto de 16 bits, una dirección pública sostiene unas 60 000 conexiones simultáneas. Ventajas: ahorra direcciones y oculta la red interna. Inconvenientes: rompe la <em>transparencia extremo a extremo</em> (un servidor tras NAT no es alcanzable desde fuera sin reglas especiales o <em>hole punching</em>), obliga al router a mirar puertos (capa de transporte) y complica protocolos que llevan direcciones dentro de sus datos. Con IPv6 no se necesita NAT, por abundancia de direcciones.</p>
      <p>Las direcciones privadas se explican en <a href="tema.html?id=ipv4-subnetting">IPv4 y subredes</a>; el router decide la salida con <a href="tema.html?id=longest-prefix-forwarding">reenvío por prefijo</a>, y los puertos son los de <a href="tema.html?id=ports-multiplexing">multiplexación</a>.</p>`,
  });
})();
