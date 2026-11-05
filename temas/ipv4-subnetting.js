(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const IP = () => VIZ.sor.ip;

  function montarCalc(cuerpo) {
    let dir = '192.168.10.77', len = 26;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Dirección IPv4', valor: dir, alCambiar: (v) => { dir = v.trim(); dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud del prefijo /n', min: 8, max: 30, valor: len, alCambiar: (v) => { len = v; dibujar(); } });
    const bits = el('div', { class: 'fichas' });
    cuerpo.appendChild(bits);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'los bits de red y de host se distinguen en la fila de bits con etiquetas';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escriba una dirección y mueva el prefijo. Los primeros n bits identifican la subred (en color); el resto, el host dentro de ella.');
    function dibujar() {
      if (!IP().valida(dir)) { registro.textContent = 'Dirección no válida: use cuatro números de 0 a 255 separados por puntos.'; return; }
      const r = VIZ.sor.red(dir, len), a = IP().aEntero(dir), b = IP().binario(a).split('');
      let k = 0; const partes = b.map((c) => { if (c === '.') return [c, null]; k++; return [c, k <= len]; });
      bits.replaceChildren(...partes.map(([c, red]) => (red === null ? el('span', { class: 'ficha' }, '.') : VIZ.ficha(c, { color: red ? C.s1 : C.s2, tinta: red ? C.s1 : C.s2 }))));
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        [['dirección', IP().aTexto(a)], ['máscara', IP().aTexto(r.mascara)], ['dirección de red', IP().aTexto(r.red) + '/' + len], ['difusión (broadcast)', IP().aTexto(r.difusion)], ['primer host', IP().aTexto(r.primera)], ['último host', IP().aTexto(r.ultima)]]
          .map(([k2, v]) => el('tr', null, el('td', { class: 'izq' }, k2), el('td', null, v)))));
      registro.textContent = `Los ${len} bits en azul son la red y los ${32 - len} en naranja el host: ${VIZ.entero(r.total)} direcciones, ${VIZ.entero(r.hosts)} utilizables para hosts.`;
      lectura.set([['bits de red · host', `${len} · ${32 - len}`], ['direcciones', VIZ.entero(r.total)], ['hosts utilizables', VIZ.entero(r.hosts)], ['clase histórica', a >>> 31 === 0 ? 'A' : a >>> 30 === 2 ? 'B' : a >>> 29 === 6 ? 'C' : 'D/E']]);
    }
    dibujar();
  }

  function montarVLSM(cuerpo) {
    let n = [50, 25, 10, 2];
    const ctl = VIZ.controles(cuerpo);
    ['Ventas', 'Soporte', 'Laboratorio', 'Enlace al ISP'].forEach((nom, i) => ctl.numero({ etiqueta: `Hosts en ${nom}`, min: 1, max: 120, valor: n[i], alCambiar: (v) => { n[i] = v; dibujar(); } }));
    const lienzo = VIZ.lienzo(cuerpo, { alto: 90 });
    const tip = VIZ.tooltip(lienzo);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'Ventas' }, { color: C.s2, texto: 'Soporte' }, { color: C.s3, texto: 'Laboratorio' }, { color: C.s4, texto: 'Enlace al ISP' }, { color: C.neutro, borde: C.eje, texto: 'sin usar' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se reparte 192.168.1.0/24 (256 direcciones) con máscaras de largo variable (VLSM): primero las subredes más grandes, cada una alineada a su tamaño. Cada subred pierde 2 direcciones (red y difusión).');
    let bloques = [];
    function dibujar() {
      const nom = ['Ventas', 'Soporte', 'Laboratorio', 'Enlace al ISP'];
      const req = n.map((h, i) => ({ i, h, bits: Math.max(2, Math.ceil(Math.log2(h + 2))) })).sort((a, b) => b.h - a.h);
      let ptr = 0; bloques = [];
      for (const q of req) { const tam = 2 ** q.bits; if (ptr % tam) ptr += tam - (ptr % tam); bloques.push({ ...q, ini: ptr, tam, len: 32 - q.bits, nombre: nom[q.i] }); ptr += tam; }
      const ok = ptr <= 256;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 8, w = W - 16, y = 24, h = 40;
      ctx.fillStyle = C.neutro; ctx.fillRect(x0, y, w, h); ctx.strokeStyle = C.eje; ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, h - 1);
      bloques.forEach((b) => { ctx.fillStyle = VIZ.series[b.i]; ctx.fillRect(x0 + (b.ini / 256) * w, y, (b.tam / 256) * w - 1, h); ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('/' + b.len, x0 + ((b.ini + b.tam / 2) / 256) * w, y + h / 2); });
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('.0', x0, y - 10); ctx.textAlign = 'right'; ctx.fillText('.255', x0 + w, y - 10);
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['subred', 'hosts pedidos', 'prefijo', 'red', 'rango de hosts', 'difusión'].map((t, i) => el('th', { class: i === 0 ? 'izq' : '' }, t))),
        bloques.slice().sort((a, b) => a.ini - b.ini).map((b) => el('tr', null, el('td', { class: 'izq' }, b.nombre), el('td', null, String(b.h)), el('td', null, '/' + b.len), el('td', null, `192.168.1.${b.ini}`), el('td', null, `.${b.ini + 1} – .${b.ini + b.tam - 2}`), el('td', null, `192.168.1.${b.ini + b.tam - 1}`)))));
      registro.textContent = ok ? `Se usan ${ptr} de 256 direcciones; quedan ${256 - ptr}.` : `No caben: se necesitan ${ptr} direcciones y el bloque /24 solo tiene 256.`;
      lectura.set([['direcciones usadas', String(ptr)], ['libres', ok ? String(256 - ptr) : '—'], ['¿caben en el /24?', ok ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), u = ((x - 8) / (lienzo.ancho - 16)) * 256, b = bloques.find((q) => u >= q.ini && u < q.ini + q.tam);
      if (b && y > 24 && y < 64) tip.mostrar(x, y, `<b>${b.nombre}</b><br>192.168.1.${b.ini}/${b.len}<br>${b.tam - 2} hosts utilizables`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('ipv4-subnetting', {
    intro: String.raw`
      <p>Una dirección <strong>IPv4</strong> tiene 32 bits, escritos como cuatro números de 0 a 255 (<code>192.168.10.77</code>). Se divide en dos partes: los primeros <em>n</em> bits identifican la <strong>red</strong> y los restantes, el <strong>host</strong> dentro de ella. El número <em>n</em> es el prefijo (<code>/26</code>) y la <strong>máscara de subred</strong> es el patrón de n unos seguidos de ceros.</p>
      <p>Dividir una red en <strong>subredes</strong> (subnetting) permite usar bien las direcciones y aislar el tráfico: cada subred se comunica con las demás a través de un router.</p>`,
    visualizaciones: [
      { titulo: 'Red, host y máscara', descripcion: 'Mueva el prefijo y observe cómo cambian la dirección de red, la difusión y el número de hosts. Pruebe /24, /26 y /30.', montar: montarCalc },
      { titulo: 'Repartir un /24 con máscaras variables', descripcion: 'Dé el número de hosts de cada departamento: se asignan subredes alineadas, de la más grande a la más pequeña. Haga crecer una hasta que no quepan.', montar: montarVLSM },
    ],
    teoria: String.raw`
      <h2>Cálculo</h2>
      \[ \text{red} = \text{dirección} \wedge \text{máscara}, \qquad \text{difusión} = \text{red} \vee \lnot\text{máscara}, \qquad \text{hosts} = 2^{32-n} - 2. \]
      <p>La primera dirección (host todo ceros) nombra la red y la última (todo unos) es la de difusión; no se asignan a hosts. Para \(h\) hosts se necesita el menor \(k\) con \(2^k - 2 \ge h\), y el prefijo es \(32 - k\): 50 hosts → \(k = 6\) → <code>/26</code> (62 hosts).</p>
      <h2>Direccionamiento con clases y sin clases</h2>
      <p>Originalmente el prefijo se deducía de los primeros bits: clase A (<code>/8</code>), B (<code>/16</code>), C (<code>/24</code>). Esto desperdiciaba direcciones: una organización con 2 000 hosts debía tomar una clase B (65 534). Hoy se usa <strong>CIDR</strong> (<em>Classless Inter-Domain Routing</em>), con prefijos de cualquier largo, y los routers <a href="tema.html?id=longest-prefix-forwarding">agregan rutas</a>.</p>
      <h2>Reglas</h2>
      <ul><li>Direcciones privadas (no se encaminan en Internet): <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>, que se traducen con <a href="tema.html?id=nat-dhcp">NAT</a>.</li><li>Con VLSM las subredes se asignan de la mayor a la menor y se alinean a su tamaño, para no fragmentar.</li><li>Un enlace punto a punto usa <code>/30</code> (2 hosts) o <code>/31</code>.</li></ul>
      <p>IPv6 usa 128 bits (\(3{,}4\times 10^{38}\) direcciones), con prefijos de 64 bits para redes y sin difusión. Cómo se usan estas direcciones al reenviar paquetes está en <a href="tema.html?id=longest-prefix-forwarding">reenvío por prefijo más largo</a>.</p>`,
  });
})();
