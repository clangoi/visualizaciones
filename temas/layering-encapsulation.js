(function () {
  'use strict';
  const { color: C } = VIZ;
  const CAPAS = ['Aplicación', 'Transporte', 'Red', 'Enlace', 'Física'];
  const CABS = [['datos de aplicación', 0], ['cabecera TCP', 20], ['cabecera IP', 20], ['cabecera + cola Ethernet', 18]];

  function montarEncap(cuerpo) {
    let carga = 1000, k = 4;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Datos de la aplicación (bytes)', min: 10, max: 1460, paso: 10, valor: carga, alCambiar: (v) => { carga = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Capas que ya agregaron su cabecera', min: 1, max: 4, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 190 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'datos' }, { color: C.s2, texto: 'TCP (transporte)' }, { color: C.s3, texto: 'IP (red)' }, { color: C.s7, texto: 'Ethernet (enlace)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada capa recibe de la superior una unidad de datos y le agrega su propia cabecera: mensaje → segmento → datagrama → trama. El receptor las quita en orden inverso.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const tot = carga + 58, ancho = W - 150, esc = ancho / tot, cols = [C.s1, C.s2, C.s3, C.s7], nombres = ['Mensaje', 'Segmento', 'Datagrama', 'Trama'];
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      for (let i = 0; i < k; i++) {
        const y = 12 + i * 40, off = (k - 1 - i) * 0;
        let x = 130;
        // construir de adentro hacia afuera: cabeceras de las capas inferiores quedan a los lados
        const ordenes = [];
        for (let j = i; j >= 1; j--) ordenes.unshift(j);
        const izqs = ordenes.map((j) => CABS[j][1]), tamIzq = izqs.reduce((a, b) => a + b, 0) - (i >= 3 ? 0 : 0);
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.fillText(nombres[i], 122, y + 15);
        let xx = 130; const orden = i >= 3 ? [3, 2, 1, 0] : i === 2 ? [2, 1, 0] : i === 1 ? [1, 0] : [0];
        orden.forEach((j) => {
          const w = j === 0 ? carga * esc : CABS[j][1] * esc; ctx.fillStyle = cols[j]; ctx.fillRect(xx, y, Math.max(2, w - 1), 30);
          if (w > 26) { ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.fillText(j === 0 ? `${carga} B` : `${CABS[j][1]} B`, xx + w / 2, y + 15); }
          xx += w;
        });
        void x; void off; void tamIzq;
      }
      const sobre = [0, 20, 40, 58][k - 1];
      registro.textContent = `${nombres[k - 1]}: ${carga + sobre} bytes en total, de los cuales ${sobre} son cabeceras (${VIZ.fmt((sobre / (carga + sobre)) * 100, 3)} %).`;
      lectura.set([['tamaño total', `${carga + sobre} B`], ['sobrecosto (capas 2–4)', `${sobre} B`], ['eficiencia', `${VIZ.fmt((carga / (carga + sobre)) * 100, 3)} %`], ['con 10 bytes de datos', `${VIZ.fmt((10 / (10 + sobre)) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  function montarCamino(cuerpo) {
    let k = 0;
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 260 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'host emisor' }, { color: C.s2, texto: 'router' }, { color: C.s3, texto: 'host receptor' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Un router solo llega hasta la capa de red: reenvía datagramas sin mirar el transporte ni la aplicación. Los extremos son los únicos que procesan las cinco capas.');
    const Z = [0, 1, 2, 3, 4], seq = [[0, 'Emisor: la aplicación entrega el mensaje.'], [1, 'Emisor: transporte lo segmenta y agrega puertos.'], [2, 'Emisor: red agrega las direcciones IP.'], [3, 'Emisor: enlace agrega la dirección MAC del router.'], [4, 'Emisor: la capa física envía los bits.'], [4, 'Router: recibe los bits.'], [3, 'Router: el enlace quita la trama y comprueba errores.'], [2, 'Router: red consulta su tabla de reenvío y decide la salida.'], [3, 'Router: enlace agrega una trama nueva para el siguiente salto.'], [4, 'Router: envía los bits.'], [4, 'Receptor: recibe los bits.'], [3, 'Receptor: el enlace quita la trama.'], [2, 'Receptor: red verifica que es el destino.'], [1, 'Receptor: transporte entrega al puerto correcto.'], [0, 'Receptor: la aplicación recibe el mensaje.']];
    function iniciar() { k = 0; return (function* () { for (let j = 1; j <= seq.length; j++) { k = j; yield; } })(); }
    function dibujar() {
      lienzo.limpiar();
      VIZ.sor.flujo(lienzo, CAPAS, seq.map(([z], i) => ({ z, color: i < 5 ? C.s1 : i < 10 ? C.s2 : C.s3 })), k, { izq: 86 });
      registro.textContent = k ? `${k}. ${seq[k - 1][1]}` : 'Pulse «Un paso» para enviar un mensaje de un host a otro a través de un router.';
    }
    lienzo.alDibujar = dibujar;
    void Z;
    rep.reiniciar();
  }

  VIZ.registrarTema('layering-encapsulation', {
    intro: String.raw`
      <p>Una red es demasiado compleja para diseñarse de una pieza, así que se organiza en <strong>capas</strong>: cada una ofrece un servicio a la de arriba apoyándose en la de abajo, y se comunica con su homóloga en el otro extremo mediante un <strong>protocolo</strong>. En el modelo de Internet son cinco: aplicación, transporte, red, enlace y física.</p>
      <p>Para pasar el mensaje hacia abajo, cada capa lo <strong>encapsula</strong>: le agrega su cabecera con la información que necesita su protocolo. Al otro lado, cada capa quita su cabecera y entrega lo que queda.</p>`,
    visualizaciones: [
      { titulo: 'Encapsulación', descripcion: 'Agregue capas una a una y vea cómo crece la unidad de datos. Pruebe un mensaje de 10 bytes: casi todo es cabecera.', montar: montarEncap },
      { titulo: 'Un mensaje a través de un router', descripcion: 'Siga el recorrido por las capas del emisor, del router y del receptor. Observe hasta qué capa llega el router.', montar: montarCamino },
    ],
    teoria: String.raw`
      <h2>Las cinco capas</h2>
      <table class="tabla-datos"><tr><th class="izq">Capa</th><th class="izq">Unidad</th><th class="izq">Función</th><th class="izq">Ejemplos</th></tr>
      <tr><td class="izq">Aplicación</td><td class="izq">mensaje</td><td class="izq">lo que el usuario ve</td><td class="izq"><a href="tema.html?id=http-latency">HTTP</a>, <a href="tema.html?id=dns-hierarchy-caching">DNS</a>, SMTP</td></tr>
      <tr><td class="izq">Transporte</td><td class="izq">segmento</td><td class="izq">entre procesos (puertos)</td><td class="izq"><a href="tema.html?id=ports-multiplexing">TCP, UDP</a></td></tr>
      <tr><td class="izq">Red</td><td class="izq">datagrama</td><td class="izq">entre hosts (direcciones IP)</td><td class="izq"><a href="tema.html?id=longest-prefix-forwarding">IP</a></td></tr>
      <tr><td class="izq">Enlace</td><td class="izq">trama</td><td class="izq">entre nodos vecinos (MAC)</td><td class="izq"><a href="tema.html?id=ethernet-switching">Ethernet</a>, Wi-Fi</td></tr>
      <tr><td class="izq">Física</td><td class="izq">bits</td><td class="izq">señales en el medio</td><td class="izq">fibra, par trenzado, radio</td></tr></table>
      <h2>Costo de las cabeceras</h2>
      <p>Con cabeceras TCP (20 B), IP (20 B) y Ethernet (18 B), un mensaje de \(m\) bytes ocupa \(m + 58\) en el cable y la eficiencia es</p>
      \[ \eta(m) = \frac{m}{m + 58}. \]
      <p>Con \(m = 1\,460\), \(\eta \approx 96{,}2\,\%\); con \(m = 10\), \(\eta \approx 14{,}7\,\%\). Por eso conviene agrupar datos pequeños.</p>
      <h2>Por qué capas</h2>
      <p>Cada capa puede cambiar sin afectar a las demás mientras mantenga su interfaz: IPv6 sustituye a IPv4 sin tocar HTTP, y Wi-Fi reemplaza a Ethernet sin tocar TCP. El costo es redundancia y, a veces, rendimiento. Los <a href="tema.html?id=network-delays">retardos</a> se suman en cada salto, y la seguridad se puede añadir en distintas capas (<a href="tema.html?id=tls-key-exchange">TLS</a> en transporte, <a href="tema.html?id=ipsec-vpn">IPsec</a> en red).</p>`,
  });
})();
