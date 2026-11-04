(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: saludo TLS 1.3 y 1.2 ---------- */

  function montarSaludo(cuerpo) {
    const est = { v: '1.3', cert: true };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Navegador' }, { nombre: 'Servidor' }],
      mensajes: () => {
        const falla = [{ de: 0, a: 0, texto: 'verifica el certificado ✕', color: C.s8, nota: 'El navegador comprueba la cadena de certificados: el nombre no coincide o no confía en la entidad emisora.' }, { de: 0, a: 1, texto: 'alerta: certificado inválido', color: C.s8, nota: 'Aborta el saludo y muestra una advertencia. No se envía ningún dato de la aplicación.' }];
        if (est.v === '1.3') {
          const m = [
            { de: 0, a: 1, texto: 'ClientHello + key_share', color: C.s1, nota: 'El cliente propone versiones y algoritmos, y ya envía su parte (g^a) del intercambio Diffie-Hellman: ahorra un viaje.' },
            { de: 1, a: 0, texto: 'ServerHello + key_share', color: C.s2, nota: 'El servidor elige los algoritmos y envía su parte (g^b). Ambos pueden calcular ya el secreto compartido.' },
            { de: 1, a: 0, texto: '{Certificate, Verify, Finished}', color: C.s3, nota: 'Desde aquí todo va cifrado: el servidor envía su certificado, una firma que prueba que posee la clave privada, y Finished.' },
          ];
          if (!est.cert) return [...m, ...falla];
          m.push({ de: 0, a: 0, texto: 'verifica el certificado ✓', color: C.s6, nota: 'El navegador valida la cadena de certificados, el nombre del sitio y las fechas.' });
          m.push({ de: 0, a: 1, texto: '{Finished}', color: C.s3, nota: 'El cliente confirma que el saludo no fue manipulado. 1 viaje de ida y vuelta en total.' });
          m.push({ de: 0, a: 1, texto: 'GET /  (cifrado)', color: C.s6, nota: 'Ya se pueden enviar datos de la aplicación, cifrados con la clave de sesión.' });
          m.push({ de: 1, a: 0, texto: '200 OK  (cifrado)', color: C.s6, nota: 'La respuesta también viaja cifrada y autenticada.' });
          return m;
        }
        const m = [
          { de: 0, a: 1, texto: 'ClientHello', color: C.s1, nota: 'El cliente propone versiones y suites de cifrado; envía un número aleatorio.' },
          { de: 1, a: 0, texto: 'ServerHello + Certificate + KeyExchange', color: C.s2, nota: 'El servidor elige los algoritmos, envía su certificado y su parte del intercambio de claves, firmada.' },
        ];
        if (!est.cert) return [...m, ...falla];
        m.push({ de: 0, a: 0, texto: 'verifica el certificado ✓', color: C.s6, nota: 'El navegador valida la cadena y el nombre del sitio.' });
        m.push({ de: 0, a: 1, texto: 'ClientKeyExchange + Finished', color: C.s1, nota: 'El cliente envía su parte del intercambio y activa el cifrado. Segundo viaje.' });
        m.push({ de: 1, a: 0, texto: 'Finished (cifrado)', color: C.s3, nota: 'El servidor confirma. Recién ahora, tras 2 viajes de ida y vuelta, puede enviarse la aplicación.' });
        m.push({ de: 0, a: 1, texto: 'GET /  (cifrado)', color: C.s6, nota: 'Datos de la aplicación, cifrados.' });
        m.push({ de: 1, a: 0, texto: '200 OK  (cifrado)', color: C.s6, nota: 'Respuesta cifrada.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Versión de TLS', valor: est.v, opciones: [['1.3', 'TLS 1.3 (1 viaje)'], ['1.2', 'TLS 1.2 (2 viajes)']], alCambiar: (v) => { est.v = v; reiniciar(); } });
        ctl.casilla({ etiqueta: 'el certificado del servidor es válido', valor: true, alCambiar: (v) => { est.cert = v; reiniciar(); } });
      },
      leyenda: [{ color: C.s1, texto: 'mensajes del cliente' }, { color: C.s2, texto: 'elección del servidor' }, { color: C.s3, texto: 'cifrados con las claves del saludo' }, { color: C.s6, texto: 'verificación y datos' }, { color: C.s8, texto: 'fallo' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['viajes antes de los datos', est.v === '1.3' ? '1' : '2'], ['resultado', est.cert ? 'canal seguro' : 'conexión abortada']],
      nota: 'El saludo logra tres cosas: <b>acordar una clave</b> sin enviarla, <b>autenticar al servidor</b> con su certificado y <b>proteger la integridad</b> de todo el saludo.',
    });
  }

  /* ---------- Fig. 2: costo en tiempo ---------- */

  function montarCosto(cuerpo) {
    const est = { rtt: 80 };
    let barras = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Latencia (RTT)', min: 5, max: 300, valor: est.rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { est.rtt = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s3, texto: 'TCP' }, { color: C.s7, texto: 'saludo TLS' }, { color: C.s2, texto: 'primera petición HTTP' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tiempo hasta recibir el primer byte de la respuesta. La reanudación de sesión (0-RTT) reutiliza claves de una visita anterior: más rápido, con un riesgo de repetición que el servidor debe controlar.');
    const MODOS = [{ t: 'HTTP sin cifrar', tls: 0 }, { t: 'HTTPS, TLS 1.2', tls: 2 }, { t: 'HTTPS, TLS 1.3', tls: 1 }, { t: 'TLS 1.3 con reanudación', tls: 0, esp: true }];
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const r = est.rtt, izq = Wd < 600 ? 100 : 170, total = 4 * r, esc = (ms) => izq + (ms / total) * (Wd - izq - 54);
      barras = [];
      MODOS.forEach((m, i) => {
        const y = 10 + i * 42, tcp = r, tls = m.tls * r, http = r;
        W.texto(ctx, m.t, izq - 8, y + 14, { tam: Wd < 600 ? 9 : 11, alinear: 'right' });
        let x = 0;
        [[tcp, C.s3], [tls, C.s7], [http, C.s2]].forEach(([w, c]) => { if (w > 0) { ctx.fillStyle = c; ctx.fillRect(esc(x), y, esc(x + w) - esc(x) - 1, 28); } x += w; });
        W.texto(ctx, `${Math.round(x)} ms`, esc(x) + 6, y + 14, { tam: 11, peso: 600, alinear: 'left' });
        barras.push({ y, m, total: x });
      });
      const base = r * 2, t12 = r * 4, t13 = r * 3;
      registro.textContent = `Con ${r} ms de latencia, el cifrado agrega ${t12 - base} ms con TLS 1.2 y ${t13 - base} ms con TLS 1.3 respecto de HTTP sin cifrar; con reanudación, casi nada.`;
      lectura.set([['HTTP', `${base} ms`], ['TLS 1.2', `${t12} ms`], ['TLS 1.3', `${t13} ms`], ['TLS 1.3 reanudado', `${base} ms`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = barras.find((q) => y >= q.y && y <= q.y + 28); if (!b) return tip.ocultar(); tip.mostrar(x, y, `<b>${b.m.t}</b><br>${Math.round(b.total)} ms hasta el primer byte`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('tls-handshake', {
    intro: String.raw`
      <p><strong>HTTPS</strong> es HTTP dentro de una conexión cifrada con <strong>TLS</strong> (<em>Transport Layer Security</em>). Antes de enviar la primera petición, navegador y servidor hacen un <strong>saludo</strong> (<em>handshake</em>)
      que cumple tres objetivos: acordar claves secretas sin enviarlas, comprobar que el servidor es quien dice ser y asegurar que nadie altera lo que se dicen.</p>
      <p>Después, todos los datos viajan cifrados con una clave simétrica de sesión. Quien intercepte el tráfico en una cafetería o en un enrutador solo ve bytes ininteligibles.</p>`,
    visualizaciones: [
      { titulo: 'El saludo TLS paso a paso', descripcion: 'Compare TLS 1.2 y 1.3 y haga inválido el certificado: vea cuándo se acuerda la clave y cuándo se aborta la conexión.', montar: montarSaludo },
      { titulo: 'Cuánto cuesta el cifrado', descripcion: 'Aumente la latencia y compare el tiempo hasta el primer byte con HTTP, TLS 1.2, TLS 1.3 y la reanudación de sesión.', montar: montarCosto },
    ],
    teoria: String.raw`
      <h2>Qué se negocia</h2>
      <ol>
        <li><strong>Versión y suite de cifrado</strong>: p. ej. <code>TLS_AES_256_GCM_SHA384</code> (cifrado simétrico + función hash).</li>
        <li><strong>Clave de sesión</strong>: mediante un intercambio <a href="tema.html?id=key-exchange-dh">Diffie-Hellman</a> (efímero, por lo que cada sesión tiene claves nuevas: <em>secreto hacia adelante</em>).</li>
        <li><strong>Autenticación</strong>: el servidor presenta un <a href="tema.html?id=digital-certificates">certificado</a> y firma el saludo con su clave privada.</li>
      </ol>
      <h2>Protección de los datos</h2>
      <p>Los datos se dividen en <em>registros</em> cifrados con AES-GCM o ChaCha20-Poly1305, que ofrecen a la vez <strong>confidencialidad</strong> (nadie lee) e <strong>integridad</strong> (cualquier alteración se detecta con una etiqueta de autenticación). Cada registro lleva un número de secuencia que impide repetirlo.</p>
      <h2>Costo</h2>
      <p>El tiempo hasta el primer byte es</p>
      \[ T = \underbrace{r}_{\text{TCP}} + \underbrace{k\,r}_{\text{TLS}} + \underbrace{r}_{\text{HTTP}}, \qquad k = 2\ (\text{TLS 1.2}),\ 1\ (\text{TLS 1.3}),\ 0\ (\text{reanudación}). \]
      <p>La criptografía asimétrica del saludo cuesta unos milisegundos de CPU; en la práctica lo que se nota es la latencia \(r\).</p>
      <div class="recuadro">HTTPS protege el <em>canal</em>, no al servidor: un sitio malicioso puede tener un certificado válido para su propio dominio. Y el cifrado extremo a extremo de los mensajes es otra cosa. Otras piezas del recorrido completo: <a href="tema.html?id=request-lifecycle">vida de una petición web</a> y <a href="tema.html?id=symmetric-asymmetric-crypto">cifrado simétrico y asimétrico</a>.</div>`,
  });
})();
