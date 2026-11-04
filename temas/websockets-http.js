(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: ¿cómo se entera el cliente de un evento del servidor? ---------- */

  function montarTiempos(cuerpo) {
    const est = { intervalo: 5, tasa: 6 };
    let semilla = 1, eventos = [], marcas = [];
    const T = 60;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Intervalo de sondeo (polling)', min: 1, max: 15, valor: est.intervalo, formato: (v) => `${v} s`, alCambiar: (v) => { est.intervalo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Eventos del servidor por minuto', min: 1, max: 30, valor: est.tasa, alCambiar: (v) => { est.tasa = v; dibujar(); } });
    ctl.boton('Otros eventos', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'evento en el servidor' }, { color: C.s1, texto: 'petición de sondeo con datos' }, { color: C.inactivo, texto: 'petición de sondeo vacía (desperdicio)' }, { color: C.s6, texto: 'mensaje por WebSocket' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con sondeo, el cliente <em>pregunta</em> cada cierto tiempo: un evento espera hasta la siguiente pregunta. Con WebSocket el servidor <em>avisa</em> en cuanto ocurre.');
    const HTTP_BYTES = 800, WS_BYTES = 8; // cabeceras aproximadas por petición/respuesta y por mensaje
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(semilla * 23), n = Math.max(1, Math.round((est.tasa * T) / 60));
      eventos = Array.from({ length: n }, () => rnd() * (T - 1)).sort((a, b) => a - b);
      const esc = (t) => 70 + (t / T) * (Wd - 80), lat = [];
      marcas = [];
      const ticks = []; for (let t = est.intervalo; t <= T; t += est.intervalo) ticks.push(t);
      let previo = 0;
      ticks.forEach((t) => { const hay = eventos.filter((e) => e >= previo && e < t); hay.forEach((e) => lat.push(t - e)); marcas.push({ t, hay: hay.length }); previo = t; });
      W.texto(ctx, 'servidor', 4, 24, { tam: 10, alinear: 'left', color: C.tinta2 }); W.texto(ctx, 'sondeo', 4, 78, { tam: 10, alinear: 'left', color: C.tinta2 }); W.texto(ctx, 'WebSocket', 4, 140, { tam: 10, alinear: 'left', color: C.tinta2 });
      ctx.strokeStyle = C.rejilla; [24, 78, 140].forEach((y) => { ctx.beginPath(); ctx.moveTo(70, y + 0.5); ctx.lineTo(Wd - 10, y + 0.5); ctx.stroke(); });
      eventos.forEach((e) => {
        ctx.fillStyle = C.s2; ctx.fillRect(esc(e) - 2, 14, 4, 20);
        const sig = ticks.find((t) => t > e), x2 = sig ? esc(sig) : esc(T);
        ctx.strokeStyle = VIZ.alfa(C.s2, 0.5); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(esc(e), 34); ctx.lineTo(x2, 72); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.s6; ctx.beginPath(); ctx.arc(esc(e), 140, 4.5, 0, 7); ctx.fill();
        ctx.strokeStyle = C.s6; ctx.beginPath(); ctx.moveTo(esc(e), 34); ctx.lineTo(esc(e), 135); ctx.stroke();
      });
      marcas.forEach((m) => { ctx.fillStyle = m.hay ? C.s1 : C.inactivo; ctx.beginPath(); ctx.arc(esc(m.t), 78, m.hay ? 6 : 4, 0, 7); ctx.fill(); });
      [0, 15, 30, 45, 60].forEach((s) => W.texto(ctx, `${s} s`, Math.min(Wd - 14, Math.max(78, esc(s))), 176, { tam: 10, color: C.apagado }));
      const vacias = marcas.filter((m) => !m.hay).length, media = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : 0;
      registro.textContent = `En 60 s hubo ${eventos.length} evento(s): el sondeo hizo ${marcas.length} peticiones (${vacias} vacías) y los eventos esperaron en promedio ${VIZ.fmt(media, 3)} s; WebSocket los entregó al instante.`;
      lectura.set([['peticiones de sondeo', String(marcas.length)], ['vacías', `${vacias} (${marcas.length ? Math.round((vacias / marcas.length) * 100) : 0} %)`], ['latencia media del sondeo', `${VIZ.fmt(media, 3)} s`], ['cabeceras enviadas', `sondeo ${VIZ.entero(marcas.length * HTTP_BYTES)} B · WS ${VIZ.entero(eventos.length * WS_BYTES)} B`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const t = ((x - 70) / (lienzo.ancho - 80)) * T; const e = eventos.find((q) => Math.abs(q - t) < 1.2); const m = marcas.find((q) => Math.abs(q.t - t) < 1.2); if (y < 50 && e !== undefined) tip.mostrar(x, y, `evento en <b>${VIZ.fmt(e, 3)} s</b>`); else if (m && y > 55 && y < 100) tip.mostrar(x, y, `sondeo en <b>${m.t} s</b><br>${m.hay ? `${m.hay} evento(s) entregado(s)` : 'sin novedades'}`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: ciclo de vida de una conexión WebSocket ---------- */

  function montarCiclo(cuerpo) {
    const est = { push: true, cierre: true, corte: false };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Cliente' }, { nombre: 'Servidor' }],
      mensajes: () => {
        const m = [
          { de: 0, a: 1, texto: 'GET /chat  Upgrade: websocket', color: C.s1, nota: 'La conexión empieza como una petición HTTP normal que pide «cambiar de protocolo».' },
          { de: 1, a: 0, texto: '101 Switching Protocols', color: C.s2, nota: 'El servidor acepta. A partir de aquí la misma conexión TCP deja de hablar HTTP y habla WebSocket.' },
          { de: 0, a: 1, texto: 'mensaje: "hola"', color: C.s6, nota: 'El cliente envía un mensaje cuando quiere, sin nueva petición ni cabeceras HTTP.' },
        ];
        if (est.push) { m.push({ de: 1, a: 0, texto: 'mensaje: "Ana se conectó"', color: C.s6, nota: 'El servidor envía un mensaje sin que el cliente lo haya pedido: es la diferencia clave con HTTP.' }); m.push({ de: 1, a: 0, texto: 'mensaje: "nuevo mensaje de Beto"', color: C.s6, nota: 'Puede enviar tantos como quiera, en cuanto ocurran los eventos.' }); }
        m.push({ de: 0, a: 1, texto: 'ping', color: C.s3, nota: 'Cada cierto tiempo se envían ping/pong para comprobar que la conexión sigue viva.' });
        m.push({ de: 1, a: 0, texto: 'pong', color: C.s3, nota: 'El servidor responde.' });
        if (est.corte) { m.push({ de: 1, a: 1, texto: 'la red se cae ✕', color: C.s8, nota: 'La conexión se corta sin aviso: WebSocket no se reconecta solo.' }); m.push({ de: 0, a: 0, texto: 'onclose → reintentar con espera', color: C.s8, nota: 'El cliente debe detectar el cierre y reconectar, normalmente con retroceso exponencial (1 s, 2 s, 4 s…).' }); m.push({ de: 0, a: 1, texto: 'GET /chat  Upgrade (nuevo saludo)', color: C.s1, nota: 'Se repite el saludo HTTP y se restablece la sesión.' }); m.push({ de: 1, a: 0, texto: '101 Switching Protocols', color: C.s2, nota: 'Conexión restablecida.' }); }
        if (est.cierre) { m.push({ de: 0, a: 1, texto: 'close (1000)', color: C.s7, nota: 'El cliente cierra de forma ordenada con un código.' }); m.push({ de: 1, a: 0, texto: 'close (1000)', color: C.s7, nota: 'El servidor confirma y se libera la conexión.' }); }
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.casillas([{ clave: 'push', texto: 'el servidor envía mensajes por iniciativa propia', activo: true }, { clave: 'corte', texto: 'se corta la red', activo: false }, { clave: 'cierre', texto: 'cierre ordenado', activo: true }], (e) => { Object.assign(est, e); reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'solicitud HTTP de apertura' }, { color: C.s2, texto: 'cambio de protocolo' }, { color: C.s6, texto: 'mensajes WebSocket' }, { color: C.s3, texto: 'ping/pong' }, { color: C.s7, texto: 'cierre' }, { color: C.s8, texto: 'falla' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['mensajes de datos', String(msgs.slice(0, Math.max(0, hasta + 1)).filter((x) => /mensaje/.test(x.texto)).length)], ['peticiones HTTP', '1']],
      nota: 'Una sola solicitud HTTP abre un canal que luego es <em>bidireccional</em>: ambas partes pueden hablar cuando quieran, con cabeceras de solo unos bytes.',
    });
  }

  VIZ.registrarTema('websockets-http', {
    intro: String.raw`
      <p>HTTP funciona con <em>pregunta y respuesta</em>: el cliente pide y el servidor contesta; el servidor no puede hablar primero. Para un chat, una cotización en vivo o un juego, eso obliga a «preguntar cada tanto» (<em>polling</em>),
      con peticiones que casi siempre vuelven vacías y noticias que llegan tarde.</p>
      <p>Los <strong>WebSockets</strong> abren una conexión <strong>persistente y bidireccional</strong>: tras un saludo inicial por HTTP, cliente y servidor se envían mensajes en cualquier momento.</p>`,
    visualizaciones: [
      { titulo: 'Sondeo frente a WebSocket', descripcion: 'Cambie el intervalo de sondeo y la frecuencia de eventos: compare cuánto tardan en llegar los eventos y cuántas peticiones se desperdician.', montar: montarTiempos },
      { titulo: 'Ciclo de vida de una conexión', descripcion: 'Recorra el saludo de actualización, los mensajes en ambos sentidos, una caída de red con reconexión y el cierre.', montar: montarCiclo },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>HTTP (sondeo)</th><th>WebSocket</th></tr>
        <tr><td>Iniciativa</td><td>solo el cliente</td><td>ambos</td></tr>
        <tr><td>Conexión</td><td>una por petición (o reutilizada)</td><td>una, larga</td></tr>
        <tr><td>Cabeceras por mensaje</td><td>cientos de bytes</td><td>2 a 14 bytes</td></tr>
        <tr><td>Latencia de un evento</td><td>hasta un intervalo de sondeo</td><td>≈ un viaje de red</td></tr>
        <tr><td>Escalado</td><td>peticiones sin estado, fáciles de repartir</td><td>una conexión abierta por cliente: consume memoria y requiere balanceo</td></tr>
      </table>
      <h2>Costo del sondeo</h2>
      <p>Con intervalo \(\Delta\), un evento en un instante uniforme dentro del intervalo espera en promedio \(\Delta/2\), y con tasa de eventos \(\lambda\) la fracción de peticiones con datos es \(1 - e^{-\lambda \Delta}\) (el resto va vacío). Reducir \(\Delta\) baja la latencia pero multiplica las peticiones: un compromiso que WebSocket evita.</p>
      <h2>Uso en el navegador</h2>
      <pre><code>const ws = new WebSocket("wss://ejemplo.com/chat");   // wss = sobre TLS
ws.onopen    = () =&gt; ws.send("hola");
ws.onmessage = (e) =&gt; mostrar(e.data);
ws.onclose   = () =&gt; reconectar();</code></pre>
      <div class="recuadro">No es siempre la mejor opción: para actualizaciones solo del servidor al cliente existen los <em>Server-Sent Events</em>, más simples; para datos poco frecuentes, HTTP basta. La conexión debe cifrarse y autenticarse como cualquier otra (<a href="tema.html?id=tls-handshake">TLS</a>, <a href="tema.html?id=session-vs-token">sesión o token</a>). Compare con el modelo de pregunta y respuesta de <a href="tema.html?id=http-messages">HTTP</a>.</div>`,
  });
})();
