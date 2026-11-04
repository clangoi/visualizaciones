(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const REGLAS = [
    ['permitir', 'tcp', 'cualquiera', '192.168.0.10', '80', 'servidor web'],
    ['permitir', 'tcp', 'cualquiera', '192.168.0.10', '443', 'servidor web seguro'],
    ['permitir', 'tcp', 'LAN', 'cualquiera', '80, 443', 'navegación saliente'],
    ['permitir', 'udp', 'LAN', 'cualquiera', '53', 'DNS saliente'],
    ['denegar', 'tcp', 'cualquiera', 'LAN', '22', 'SSH desde fuera'],
  ];
  const PAQ = [
    ['Internet', '192.168.0.10', 'tcp', 80, false, 'visita a la web'], ['Internet', '192.168.0.10', 'tcp', 443, false, 'visita a la web (TLS)'], ['Internet', '192.168.0.5', 'tcp', 22, false, 'intento de SSH a un PC'],
    ['LAN', 'Internet', 'tcp', 443, false, 'el PC navega'], ['Internet', 'LAN', 'tcp', 51000, true, 'respuesta de una página'], ['LAN', 'Internet', 'udp', 53, false, 'consulta DNS'],
    ['Internet', 'LAN', 'udp', 40000, true, 'respuesta DNS'], ['Internet', '192.168.0.5', 'tcp', 3389, false, 'escritorio remoto'], ['LAN', 'Internet', 'tcp', 25, false, 'envío de correo directo'],
    ['Internet', '192.168.0.10', 'tcp', 22, false, 'SSH al servidor'], ['Internet', 'LAN', 'tcp', 60000, false, 'conexión entrante sin solicitud'], ['Internet', 'LAN', 'tcp', 52000, true, 'respuesta de una descarga'],
  ];

  function evaluar(p, defecto, estado) {
    const [or, de, pr, pt, resp] = p, destino = de === '192.168.0.10' ? 'srv' : or === 'Internet' ? 'lan' : 'ext';
    if (estado && resp) return { v: 'permitir', r: 'tabla de conexiones (estado)' };
    const reglas = [
      [pr === 'tcp' && or === 'Internet' && de === '192.168.0.10' && pt === 80, 1], [pr === 'tcp' && or === 'Internet' && de === '192.168.0.10' && pt === 443, 2],
      [pr === 'tcp' && or === 'LAN' && (pt === 80 || pt === 443), 3], [pr === 'udp' && or === 'LAN' && pt === 53, 4],
      [pr === 'tcp' && or === 'Internet' && de !== 'Internet' && pt === 22, 5],
    ];
    void destino;
    const k = reglas.find(([ok]) => ok);
    return k ? { v: REGLAS[k[1] - 1][0], r: `regla ${k[1]}` } : { v: defecto, r: 'política por omisión' };
  }

  function montar(cuerpo) {
    let defecto = 'denegar', estado = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Política por omisión', opciones: [['denegar', 'Denegar lo no previsto'], ['permitir', 'Permitir lo no previsto']], valor: defecto, alCambiar: (v) => { defecto = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Firewall con estado (recuerda las conexiones salientes)', valor: estado, alCambiar: (v) => { estado = v; dibujar(); } });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla con el veredicto de cada paquete en texto y color';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las reglas se examinan en orden y gana la primera que coincide. Sin estado, las respuestas a conexiones salientes (puertos altos) quedan bloqueadas; con estado, se aceptan solo si corresponden a una conexión iniciada desde dentro.');
    function dibujar() {
      const res = PAQ.map((p) => evaluar(p, defecto, estado));
      caja.replaceChildren(
        el('table', { class: 'tabla-datos sin-corte' }, el('tr', null, ['#', 'regla', 'protocolo', 'origen', 'destino', 'puerto', 'acción'].map((h) => el('th', null, h))),
          REGLAS.map((r, i) => el('tr', null, el('td', null, String(i + 1)), el('td', null, r[5]), el('td', null, r[1]), el('td', null, r[2]), el('td', null, r[3]), el('td', null, r[4]), el('td', { style: { fontWeight: 600 } }, r[0])))),
        el('table', { class: 'tabla-datos sin-corte' }, el('tr', null, ['paquete', 'origen → destino', 'proto:puerto', 'decide', 'resultado'].map((h) => el('th', null, h))),
          PAQ.map((p, i) => el('tr', null, el('td', null, p[5]), el('td', null, `${p[0]} → ${p[1]}`), el('td', null, `${p[2]}:${p[3]}`), el('td', null, res[i].r), el('td', { style: { color: res[i].v === 'permitir' ? C.s6 : C.s8, fontWeight: 600 } }, res[i].v === 'permitir' ? 'PASA' : 'BLOQUEADO')))));
      const ok = res.filter((x) => x.v === 'permitir').length, malo = PAQ.filter((p, i) => !p[4] && res[i].v === 'permitir' && p[0] === 'Internet' && p[1] !== '192.168.0.10').length;
      lectura.set([['paquetes que pasan', `${ok} de ${PAQ.length}`], ['legítimos bloqueados', String(PAQ.filter((p, i) => (p[4] || p[0] === 'LAN' || (p[1] === '192.168.0.10' && (p[3] === 80 || p[3] === 443))) && res[i].v !== 'permitir').length)], ['entradas indebidas permitidas', String(malo)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('firewall-filtering', {
    intro: String.raw`
      <p>Un <strong>firewall</strong> es un guardia en el borde de una red: examina cada paquete que entra o sale y decide si pasa o se descarta, según una lista ordenada de <strong>reglas</strong> sobre las cabeceras (direcciones, protocolo, puertos). Así se reduce lo que queda expuesto: solo lo que se permite explícitamente es alcanzable desde fuera.</p>
      <p>Un filtro <em>sin estado</em> mira cada paquete por separado; uno <em>con estado</em> recuerda las conexiones y reconoce las respuestas a lo que se pidió desde dentro.</p>`,
    visualizaciones: [
      { titulo: 'Reglas, política y estado', descripcion: 'Con la política «denegar», ¿qué pasa con las respuestas a una consulta DNS? Active el firewall con estado y observe qué cambia. Luego cambie a «permitir».', montar },
    ],
    teoria: String.raw`
      <h2>Filtrado de paquetes</h2>
      <pre><code>para cada paquete p que cruza el firewall:
    para cada regla r en orden:
        si p coincide con r (origen, destino, protocolo, puertos):
            aplicar r.acción;  parar
    aplicar la política por omisión</code></pre>
      <p>Conviene la política <strong>denegar por omisión</strong>: se permite solo lo necesario, y los errores de omisión son más seguros que los de comisión. El orden importa: una regla general colocada antes de una específica la deja inalcanzable. Los firewalls clásicos filtran en las capas de red y transporte; los de aplicación (proxies, WAF) inspeccionan además el contenido.</p>
      <h2>Con estado</h2>
      <p>Mantiene una tabla de conexiones (como el <a href="tema.html?id=nat-dhcp">NAT</a>): cuando un host interno abre una conexión saliente, se anota la tupla; los paquetes entrantes de esa conexión pasan sin regla propia. Sin estado habría que abrir todos los puertos altos (> 1024) hacia dentro para que funcionen las respuestas, lo que dejaría la red expuesta. El costo es memoria por conexión.</p>
      <h2>Límites</h2>
      <ul><li>Un firewall no ve dentro del tráfico cifrado (<a href="tema.html?id=tls-handshake">TLS</a>) ni de un <a href="tema.html?id=ipsec-vpn">túnel VPN</a>.</li><li>No protege de ataques desde dentro ni de vulnerabilidades en los servicios permitidos.</li><li>La seguridad perimetral es una capa; se combina con cifrado y autenticación en otras (<a href="tema.html?id=symmetric-encryption-mac">cifrado y MAC</a>).</li></ul>
      <p>Las reglas se expresan con prefijos (<a href="tema.html?id=ipv4-subnetting">subredes</a>) y puertos (<a href="tema.html?id=ports-multiplexing">transporte</a>).</p>`,
  });
})();
