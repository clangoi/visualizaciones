(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: conexión TCP paso a paso, con pérdida opcional ---------- */

  function montarConexion(cuerpo) {
    let perdida = 'ninguna', segmentos = 3;
    const lista = () => {
      const m = [
        { de: 0, a: 1, texto: 'SYN seq=100', color: C.s1, nota: 'El cliente abre la conexión: SYN con su número de secuencia inicial (100).' },
        { de: 1, a: 0, texto: 'SYN-ACK 300, ack=101', color: C.s3, nota: 'El servidor acepta: elige su secuencia (300) y confirma la del cliente (ack = 101).' },
        { de: 0, a: 1, texto: 'ACK ack=301', color: C.s1, nota: 'El cliente confirma. Conexión establecida tras 1,5 viajes de ida y vuelta: ya puede enviar datos.' },
      ];
      for (let k = 0; k < segmentos; k++) {
        const seq = 101 + k * 100;
        const mala = (perdida === 'datos' && k === 1);
        m.push({ de: 0, a: 1, texto: `datos seq=${seq}${mala ? ' ✕' : ''}`, color: mala ? C.s8 : C.s2, guiones: mala ? [4, 4] : null, nota: mala ? `El segmento ${seq} se pierde en la red: el servidor nunca lo recibe.` : `Segmento de 100 bytes que empieza en ${seq}.` });
        if (mala) {
          m.push({ de: 0, a: 0, texto: 'temporizador vence: retransmitir', color: C.s8, nota: 'Sin ACK antes de vencer el temporizador (RTO), el cliente asume la pérdida y reenvía.' });
          m.push({ de: 0, a: 1, texto: `datos seq=${seq} (reenvío)`, color: C.s4, nota: 'Retransmisión del mismo segmento.' });
        }
        const ackPerdido = perdida === 'ack' && k === 1;
        m.push({ de: 1, a: 0, texto: `ACK ack=${seq + 100}${ackPerdido ? ' ✕' : ''}`, color: ackPerdido ? C.s8 : C.s3, guiones: ackPerdido ? [4, 4] : null, nota: ackPerdido ? 'El ACK se pierde: el cliente creerá que el segmento no llegó.' : `El servidor confirma que recibió todo hasta antes del byte ${seq + 100}.` });
        if (ackPerdido) {
          m.push({ de: 0, a: 1, texto: `datos seq=${seq} (reenvío)`, color: C.s4, nota: 'El cliente retransmite aunque el servidor ya tenía los datos; el servidor los descarta por número de secuencia.' });
          m.push({ de: 1, a: 0, texto: `ACK ack=${seq + 100}`, color: C.s3, nota: 'Nuevo ACK: ahora sí llega.' });
        }
      }
      m.push({ de: 0, a: 1, texto: 'FIN', color: C.s7, nota: 'El cliente no tiene más datos: pide cerrar su lado de la conexión.' });
      m.push({ de: 1, a: 0, texto: 'ACK + FIN', color: C.s7, nota: 'El servidor confirma y cierra el suyo.' });
      m.push({ de: 0, a: 1, texto: 'ACK', color: C.s7, nota: 'Último ACK; la conexión queda cerrada.' });
      return m;
    };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Cliente' }, { nombre: 'Servidor' }],
      mensajes: lista,
      controles(ctl, reiniciar) {
        ctl.rango({ etiqueta: 'Segmentos de datos', min: 1, max: 5, valor: segmentos, alCambiar: (v) => { segmentos = v; reiniciar(); } });
        ctl.selector({ etiqueta: 'Falla de la red', valor: perdida, opciones: [['ninguna', 'ninguna'], ['datos', 'se pierde un segmento'], ['ack', 'se pierde un ACK']], alCambiar: (v) => { perdida = v; reiniciar(); } });
      },
      leyenda: [{ color: C.s1, texto: 'establecer' }, { color: C.s2, texto: 'datos' }, { color: C.s3, texto: 'confirmaciones' }, { color: C.s4, texto: 'reenvío' }, { color: C.s8, texto: 'pérdida' }, { color: C.s7, texto: 'cierre' }],
      lectura(hasta, msgs) {
        const vistos = msgs.slice(0, Math.max(0, hasta + 1));
        return [['paquetes enviados', String(vistos.filter((x) => x.de !== x.a).length)], ['retransmisiones', String(vistos.filter((x) => /reenvío/.test(x.texto)).length)], ['viajes antes de enviar datos', '1,5']];
      },
      nota: 'Provoque una pérdida y observe: TCP garantiza la entrega reenviando lo que no fue confirmado, a costa de esperar.',
    });
  }

  /* ---------- Fig. 2: rendimiento de la ventana deslizante ---------- */

  function montarRendimiento(cuerpo) {
    let perdida = 0.5, ancho = 100;
    const VENTANAS = [{ w: 1, c: C.s8, t: 'ventana de 1 segmento (parar y esperar)' }, { w: 10, c: C.s2, t: 'ventana de 10 segmentos' }, { w: 64, c: C.s1, t: 'ventana de 64 segmentos' }];
    const MSS = 1460 * 8; // bits por segmento
    // Tasa efectiva en Mb/s: ventana·MSS/RTT, acotada por el ancho de banda y reducida por las pérdidas (reenvíos).
    const tasa = (w, rtt) => Math.min(ancho, ((w * MSS) / (rtt / 1000) / 1e6) * Math.pow(1 - perdida / 100, 1));
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ancho de banda', min: 10, max: 1000, paso: 10, valor: ancho, formato: (v) => `${v} Mb/s`, alCambiar: (v) => { ancho = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pérdida de paquetes', min: 0, max: 10, paso: 0.5, valor: perdida, formato: (v) => `${v} %`, alCambiar: (v) => { perdida = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, VENTANAS.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con latencias altas, un solo segmento en vuelo desperdicia el enlace: lo que importa es el producto ancho de banda × RTT.');
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 300, ymin: 0, ymax: ancho * 1.05 }, { etiquetaX: 'RTT (ms)', etiquetaY: 'velocidad efectiva (Mb/s)' });
      plano.ejes();
      for (const s of VENTANAS) {
        const pts = [];
        for (let r = 1; r <= 300; r += 1) pts.push([r, tasa(s.w, r)]);
        VIZ.trazar(ctx, plano, pts, s.c, 2);
      }
      const bdp = (ancho * 1e6 * 0.05) / MSS;
      lectura.set([['ancho de banda', `${ancho} Mb/s`], ['segmentos para llenar el enlace a 50 ms', VIZ.entero(bdp)], ['con 1 segmento y 50 ms', `${VIZ.fmt(tasa(1, 50), 3)} Mb/s`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const r = Math.max(1, Math.round(plano.ix(x)));
      tip.mostrar(x, y, `RTT = <b>${r} ms</b>` + VENTANAS.map((s) => VIZ.filaTooltip(s.c, `ventana ${s.w}`, `${VIZ.fmt(tasa(s.w, r), 3)} Mb/s`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('tcp-handshake', {
    intro: String.raw`
      <p>Internet reenvía paquetes sin garantías: pueden perderse, duplicarse o llegar en desorden. <strong>TCP</strong> construye encima un canal confiable y ordenado
      entre dos programas, y lo primero que hace es <strong>establecer una conexión</strong> con un saludo de tres pasos.</p>
      <p>Después numera cada byte, exige confirmaciones (<em>ACK</em>) y reenvía lo que no fue confirmado. Esa fiabilidad tiene un costo en viajes de ida y vuelta, que explica por qué la latencia domina el tiempo de carga de una página.</p>`,
    visualizaciones: [
      {
        titulo: 'Saludo de tres vías, datos y cierre',
        descripcion: 'Recorra la conexión y luego pruebe «se pierde un segmento» o «se pierde un ACK»: observe quién reenvía y por qué.',
        montar: montarConexion,
      },
      {
        titulo: 'Ventana deslizante y velocidad efectiva',
        descripcion: 'Con RTT creciente, la velocidad de una ventana pequeña se hunde; una ventana grande mantiene el enlace lleno. Suba la pérdida y compare.',
        montar: montarRendimiento,
      },
    ],
    teoria: String.raw`
      <h2>Handshake de tres vías</h2>
      <pre><code>cliente → servidor : SYN, seq = x
servidor → cliente : SYN-ACK, seq = y, ack = x + 1
cliente → servidor : ACK, ack = y + 1</code></pre>
      <p>Los números iniciales (\(x\), \(y\)) se eligen al azar: evitan confundir segmentos de conexiones anteriores y dificultan que un atacante los adivine. Un viaje y medio de espera ocurre antes del primer byte de datos.</p>
      <h2>Confiabilidad</h2>
      <ul>
        <li><strong>Número de secuencia y ACK acumulativo</strong>: <code>ack = n</code> significa «recibí todo hasta el byte \(n-1\)».</li>
        <li><strong>Retransmisión</strong>: si el ACK no llega antes del <em>RTO</em> (que se estima a partir del RTT medido) o llegan tres ACK duplicados, se reenvía.</li>
        <li><strong>Control de flujo</strong>: la ventana anunciada por el receptor limita cuánto puede haber sin confirmar.</li>
        <li><strong>Control de congestión</strong>: el emisor crece su ventana (inicio lento, luego aumento aditivo) y la reduce a la mitad ante una pérdida.</li>
      </ul>
      <h2>Rendimiento</h2>
      <p>Con una ventana de \(W\) bytes y un tiempo de ida y vuelta \(\text{RTT}\), el emisor no puede superar</p>
      \[ \text{velocidad} \le \frac{W}{\text{RTT}}, \qquad W_{\text{óptima}} = \text{ancho de banda} \times \text{RTT}. \]
      <p>Este producto se llama <em>producto ancho de banda-retardo</em>. Un enlace de 100 Mb/s con RTT de 50 ms necesita unos 625 KB en vuelo para llenarse.</p>
      <h2>Cierre</h2>
      <p>Cada sentido se cierra por separado con <code>FIN</code> y su ACK, por eso hay cuatro mensajes (o tres si el servidor combina ACK y FIN).</p>
      <div class="recuadro">TCP entrega bytes en orden pero no sabe de «mensajes». UDP, en cambio, envía datagramas sueltos sin conexión ni garantías, y por eso lo usan DNS y el vídeo en tiempo real. La seguridad se añade encima con <a href="tema.html?id=tls-handshake">TLS</a>.</div>`,
  });
})();
