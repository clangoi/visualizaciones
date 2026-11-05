(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const H = [['A', 'AA:11'], ['B', 'BB:22'], ['C', 'CC:33'], ['D', 'DD:44']];

  function montarSwitch(cuerpo) {
    let tabla, ori = 0, dst = 1, msg, tx, sem = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Origen', opciones: H.map(([n], i) => [i, n]), valor: ori, alCambiar: (v) => { ori = +v; } });
    ctl.selector({ etiqueta: 'Destino', opciones: H.map(([n], i) => [i, n]).concat([[9, 'difusión (FF:FF)']]), valor: dst, alCambiar: (v) => { dst = +v; } });
    ctl.boton('Enviar trama', () => enviar(), { primario: true });
    ctl.boton('Vaciar la tabla', () => { tabla = {}; msg = 'Tabla del switch vacía.'; tx = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 200 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'trama que el switch envía por inundación' }, { color: C.s6, texto: 'trama enviada solo al puerto correcto' }, { color: C.s8, texto: 'trama descartada (mismo puerto)', forma: 'punto' }]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'El switch aprende: al llegar una trama anota en qué puerto está su dirección de origen. Si el destino aún no está en la tabla (o es difusión), inunda por todos los puertos menos el de entrada.');
    function enviar() {
      if (ori === dst) { msg = 'Origen y destino son el mismo host.'; return dibujar(); }
      tabla[H[ori][1]] = ori;
      if (dst === 9) { tx = { ori, a: [0, 1, 2, 3].filter((i) => i !== ori), col: C.s2 }; msg = `${H[ori][0]} → difusión. El switch aprende que ${H[ori][1]} está en el puerto ${ori + 1} y la inunda.`; }
      else if (tabla[H[dst][1]] === undefined) { tx = { ori, a: [0, 1, 2, 3].filter((i) => i !== ori), col: C.s2 }; msg = `${H[ori][0]} → ${H[dst][0]}: destino desconocido. Aprende ${H[ori][1]} → puerto ${ori + 1} e inunda por los otros tres puertos.`; }
      else if (tabla[H[dst][1]] === ori) { tx = { ori, a: [], col: C.s8 }; msg = 'Destino en el mismo puerto de entrada: se filtra (se descarta).'; }
      else { tx = { ori, a: [dst], col: C.s6 }; msg = `${H[ori][0]} → ${H[dst][0]}: el switch conoce el puerto ${dst + 1} y reenvía solo allí. Los demás hosts no ven la trama.`; }
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const sx = W / 2, sy = 100, pos = [[W * 0.12, 40], [W * 0.12, 160], [W * 0.88, 40], [W * 0.88, 160]];
      ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.fillRect(sx - 40, sy - 24, 80, 48); ctx.strokeRect(sx - 40, sy - 24, 80, 48);
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('switch', sx, sy);
      H.forEach(([n, mac], i) => {
        const [x, y] = pos[i], vivo = tx && (tx.ori === i || tx.a.includes(i));
        ctx.strokeStyle = tx && tx.ori === i ? C.s1 : tx && tx.a.includes(i) ? tx.col : C.eje; ctx.lineWidth = vivo ? 4 : 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx + (x < sx ? -40 : 40), sy + (y < sy ? -10 : 10)); ctx.stroke();
        ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.fillRect(x - 26, y - 18, 52, 36); ctx.strokeRect(x - 26, y - 18, 52, 36);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 700); ctx.fillText(n, x, y - 5); ctx.font = VIZ.fuente(9); ctx.fillStyle = C.tinta2; ctx.fillText(mac, x, y + 9);
        ctx.fillStyle = C.apagado; ctx.fillText('puerto ' + (i + 1), x + (x < sx ? 36 : -36), y + (y < sy ? 24 : -24));
      });
      const entradas = Object.entries(tabla);
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' }, el('tr', null, ['dirección MAC', 'puerto'].map((h) => el('th', null, h))),
        entradas.length ? entradas.map(([m, p]) => el('tr', null, el('td', null, m), el('td', null, String(p + 1)))) : [el('tr', null, el('td', null, '—'), el('td', null, '—'))]));
      registro.textContent = msg;
    }
    lienzo.alDibujar = () => tabla && dibujar();
    tabla = {}; msg = 'Tabla vacía: pruebe A → B, luego B → A y A → B otra vez.'; tx = null; dibujar();
    void sem;
  }

  function montarARP(cuerpo) {
    VIZ.sor.figuraSecuencia(cuerpo, {
      actores: ['Host A (10.0.0.2)', 'Switch / red local', 'Host B (10.0.0.3)'],
      casos: [{ id: 'arp', nombre: 'ARP y envío de una trama', msgs: () => [
        { de: 0, a: 1, texto: 'ARP: ¿quién tiene 10.0.0.3?', color: C.s1, nota: 'trama a FF:FF:FF:FF:FF:FF', expl: 'A conoce la IP de B pero no su MAC: difunde una consulta ARP a toda la red local.' },
        { de: 1, a: 2, texto: 'consulta ARP (difusión)', color: C.s1, expl: 'El switch inunda la difusión por todos los puertos; todos la reciben, pero solo B responde.' },
        { de: 2, a: 0, texto: 'ARP: 10.0.0.3 está en BB:22', color: C.s2, nota: 'respuesta directa (unicast)', expl: 'B responde solo a A con su dirección MAC. A guarda el par IP↔MAC en su caché ARP.' },
        { de: 0, a: 2, texto: 'trama Ethernet a BB:22 con el datagrama IP', color: C.s1, expl: 'Ahora A puede construir la trama con la MAC de destino y enviarla; el switch ya aprendió dónde está BB:22.' },
      ] }],
      leyenda: [{ color: C.s1, texto: 'host A' }, { color: C.s2, texto: 'host B' }],
      lectura: (c, m, k) => [['mensajes', `${k} de ${m.length}`], ['A conoce la MAC de B', k >= 3 ? 'sí' : 'no']],
    });
  }

  VIZ.registrarTema('ethernet-switching', {
    intro: String.raw`
      <p>En una red local, los hosts se identifican por una dirección <strong>MAC</strong> de 48 bits, grabada en la tarjeta de red. <strong>Ethernet</strong> es la tecnología dominante: los hosts se conectan con cables a un <strong>switch</strong>, que reenvía cada trama solo al puerto del destinatario. El switch no necesita configuración: <em>aprende</em> mirando las direcciones de origen de las tramas que ve.</p>
      <p>Para pasar de una dirección IP a una MAC, un host usa <strong>ARP</strong>.</p>`,
    visualizaciones: [
      { titulo: 'Un switch que aprende', descripcion: 'Envíe tramas entre hosts. La primera vez el switch inunda; después, reenvía solo al puerto correcto. Pruebe la difusión y vacíe la tabla.', montar: montarSwitch },
      { titulo: 'ARP: de IP a MAC', descripcion: 'Siga cómo A descubre la MAC de B con una consulta de difusión antes de enviar su primera trama.', montar: montarARP },
    ],
    teoria: String.raw`
      <h2>Algoritmo del switch</h2>
      <pre><code>al recibir una trama por el puerto p:
    tabla[MAC_origen] ← p                       # auto-aprendizaje
    si MAC_destino es de difusión o no está en la tabla:  inundar por todos los puertos excepto p
    si no, sea q = tabla[MAC_destino]:
        si q = p:  descartar        # mismo segmento
        si no:     reenviar por q</code></pre>
      <p>Las entradas expiran tras unos minutos sin tráfico. Cada puerto es un <em>dominio de colisión</em> propio, así que un switch moderno con enlaces dedúplex evita las colisiones de <a href="tema.html?id=multiple-access-protocols">CSMA/CD</a>, a diferencia del concentrador (<em>hub</em>), que repetía todo por todos los puertos. Los switches forman un <em>árbol de expansión</em> (STP) para evitar bucles, y las VLAN dividen una red física en varios dominios de difusión.</p>
      <h2>Trama Ethernet</h2>
      <table class="tabla-datos"><tr><th>preámbulo</th><th>MAC destino</th><th>MAC origen</th><th>tipo</th><th>datos</th><th>CRC</th></tr><tr><td>8 B</td><td>6 B</td><td>6 B</td><td>2 B</td><td>46–1500 B</td><td>4 B</td></tr></table>
      <p>El CRC de 32 bits es la <a href="tema.html?id=error-detection-crc">detección de errores</a> de la trama. Una trama con errores se descarta; la fiabilidad la aportan capas superiores (<a href="tema.html?id=tcp-connection">TCP</a>).</p>
      <h2>Switch frente a router</h2>
      <p>El switch es de capa 2: reenvía por MAC, aprende solo y no conecta redes IP distintas. El router es de capa 3: reenvía por IP con una <a href="tema.html?id=longest-prefix-forwarding">tabla de rutas</a>. Para que un host sepa a quién entregar la trama en el siguiente salto, usa ARP: \(\text{tiempo de resolución} \approx 1\ \text{RTT local}\) y luego se guarda en caché.</p>`,
  });
})();
