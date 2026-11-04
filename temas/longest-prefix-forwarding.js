(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const TABLA = [['0.0.0.0/0', 'ISP (ruta por omisión)', 0], ['200.23.0.0/16', 'enlace A', 1], ['200.23.16.0/20', 'enlace B', 2], ['200.23.18.0/24', 'enlace C', 3], ['200.23.18.128/25', 'enlace D', 4], ['10.0.0.0/8', 'red interna', 5]];

  function montar(cuerpo) {
    let dir = '200.23.18.200';
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Dirección de destino', valor: dir, alCambiar: (v) => { dir = v.trim(); dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['200.23.18.200', '200.23.18.200'], ['200.23.18.20', '200.23.18.20'], ['200.23.17.5', '200.23.17.5'], ['200.23.99.1', '200.23.99.1'], ['10.1.2.3', '10.1.2.3'], ['8.8.8.8', '8.8.8.8']], valor: dir, alCambiar: (v) => { dir = v; dibujar(); } });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla donde la ruta elegida se marca con texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Varias rutas pueden coincidir con la dirección; el router elige la de prefijo más largo, la más específica. La ruta por omisión (/0) coincide siempre, pero solo gana si no hay otra.');
    function dibujar() {
      if (!VIZ.sor.ip.valida(dir)) { registro.textContent = 'Dirección no válida.'; return; }
      const a = VIZ.sor.ip.aEntero(dir);
      const filas = TABLA.map(([p, sal]) => { const [r, l] = p.split('/'); const m = VIZ.sor.ip.mascara(+l), ok = ((a & m) >>> 0) === ((VIZ.sor.ip.aEntero(r) & m) >>> 0); return { p, sal, l: +l, ok }; });
      const cand = filas.filter((f) => f.ok), mejor = cand.reduce((x, y) => (y.l > x.l ? y : x), cand[0]);
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['prefijo', 'salida', '¿coincide?', 'largo'].map((h, i) => el('th', { class: i === 1 ? 'izq' : '' }, h))),
        filas.map((f) => el('tr', null, el('td', { style: f === mejor ? { fontWeight: 600, color: C.s6 } : { color: f.ok ? C.tinta : C.apagado } }, (f === mejor ? '▸ ' : '') + f.p), el('td', { class: 'izq' }, f.sal), el('td', null, f.ok ? 'sí' : 'no'), el('td', null, '/' + f.l)))));
      registro.textContent = mejor ? `${dir}: coinciden ${cand.length} entradas; gana ${mejor.p} (el prefijo más largo, /${mejor.l}) y el paquete sale por «${mejor.sal}».` : 'Sin ruta: se descarta el paquete y se envía ICMP «destino inalcanzable».';
      lectura.set([['coincidencias', String(cand.length)], ['prefijo elegido', mejor ? mejor.p : '—'], ['salida', mejor ? mejor.sal : '—']]);
    }
    dibujar();
  }

  VIZ.registrarTema('longest-prefix-forwarding', {
    intro: String.raw`
      <p>Un <strong>router</strong> hace dos cosas distintas. El <strong>enrutamiento</strong> (<em>routing</em>) es construir la tabla de rutas, con algoritmos que corren cada pocos segundos. El <strong>reenvío</strong> (<em>forwarding</em>) es lo que hace con cada paquete: mirar la dirección de destino, buscarla en la tabla y sacar el paquete por la interfaz correspondiente, en nanosegundos.</p>
      <p>Como la tabla guarda <em>prefijos</em> (no direcciones sueltas), una dirección puede coincidir con varios. Se aplica la regla del <strong>prefijo más largo</strong>.</p>`,
    visualizaciones: [
      { titulo: 'Buscar en una tabla de reenvío', descripcion: 'Elija o escriba una dirección. Observe qué entradas coinciden y cuál gana. Pruebe 200.23.18.200 y 200.23.18.20, que solo difieren en el último byte.', montar },
    ],
    teoria: String.raw`
      <h2>Regla</h2>
      <pre><code>para cada entrada (prefijo/n, salida) de la tabla:
    si los primeros n bits de destino = los de prefijo:  es candidata
devolver la candidata con mayor n         # prefijo más largo</code></pre>
      <p>Esto permite <strong>agregar rutas</strong>: un ISP anuncia un solo <code>200.23.0.0/16</code> en lugar de cientos de rutas, y a la vez permite excepciones más específicas (<code>/24</code>, <code>/25</code>) que ganan sobre la general. Los routers de Internet usan estructuras especiales (árboles de prefijos, TCAM) para buscar a la velocidad de la línea.</p>
      <h2>Datagramas frente a circuitos virtuales</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th class="izq">Datagramas (Internet)</th><th class="izq">Circuitos virtuales</th></tr>
      <tr><td class="izq">decisión</td><td class="izq">por paquete, según la dirección de destino</td><td class="izq">por una etiqueta de circuito fijada al establecerlo</td></tr>
      <tr><td class="izq">estado en routers</td><td class="izq">solo la tabla de rutas</td><td class="izq">una entrada por conexión</td></tr>
      <tr><td class="izq">ante una falla</td><td class="izq">los paquetes siguientes toman otra ruta</td><td class="izq">el circuito se rompe y se debe rehacer</td></tr>
      <tr><td class="izq">ejemplos</td><td class="izq">IP</td><td class="izq">ATM, MPLS, Frame Relay</td></tr></table>
      <h2>Qué hace el router por paquete</h2>
      <p>Decrementa el TTL (si llega a 0, lo descarta y avisa por <a href="tema.html?id=icmp-traceroute">ICMP</a>), recalcula la suma de verificación de la cabecera, busca la ruta y entrega al enlace, donde una nueva trama (<a href="tema.html?id=ethernet-switching">Ethernet</a>) lleva el paquete al siguiente salto. Las tablas se calculan con <a href="tema.html?id=routing-algorithms">algoritmos de enrutamiento</a>. Las direcciones y máscaras se explican en <a href="tema.html?id=ipv4-subnetting">subredes</a>.</p>`,
  });
})();
