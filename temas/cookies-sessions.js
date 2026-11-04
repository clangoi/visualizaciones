(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: inicio de sesión y cookie ---------- */

  const CASOS = { valida: 'cookie válida', expirada: 'sesión expirada en el servidor', inventada: 'cookie inventada o manipulada', sin: 'el navegador no envía cookies' };

  function montarLogin(cuerpo) {
    let caso = 'valida', logout = false;
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Navegador' }, { nombre: 'Servidor' }, { nombre: 'Almacén' }],
      mensajes: () => {
        const m = [
          { de: 0, a: 1, texto: 'POST /login (usuario, clave)', color: C.s1, nota: 'El usuario envía sus credenciales una sola vez.' },
          { de: 1, a: 1, texto: 'verifica la clave', color: C.s3, nota: 'El servidor compara la clave con el hash guardado (nunca con el texto).' },
          { de: 1, a: 2, texto: 'guardar sid → {usuario}', color: C.s3, nota: 'Crea una sesión con un identificador aleatorio e impredecible (sid) y guarda los datos en el servidor.' },
          { de: 1, a: 0, texto: 'Set-Cookie: sid=a9f3…', color: C.s2, nota: 'La respuesta incluye la cookie; el navegador la guardará y la reenviará sola.' },
          { de: 0, a: 1, texto: caso === 'sin' ? 'GET /perfil (sin Cookie)' : caso === 'inventada' ? 'GET /perfil  Cookie: sid=zzzz' : 'GET /perfil  Cookie: sid=a9f3…', color: C.s1, nota: caso === 'sin' ? 'Ahora el navegador no adjunta la cookie (por ejemplo, la borró el usuario).' : caso === 'inventada' ? 'Un atacante envía un sid que inventó.' : 'En cada petición posterior el navegador adjunta automáticamente la cookie.' },
        ];
        if (caso === 'sin') m.push({ de: 1, a: 0, texto: '401 Unauthorized', color: C.s8, nota: 'Sin cookie, el servidor no sabe quién es: HTTP no tiene memoria.' });
        else {
          m.push({ de: 1, a: 2, texto: 'buscar sid', color: C.s3, nota: 'El servidor busca el sid en su almacén de sesiones.' });
          if (caso === 'valida') { m.push({ de: 2, a: 1, texto: '{ usuario: "ana" }', color: C.s6, nota: 'Encuentra la sesión: ahora sabe que es Ana.' }); m.push({ de: 1, a: 0, texto: '200 perfil de Ana', color: C.s6, nota: 'Responde con los datos de esa persona.' }); } else { m.push({ de: 2, a: 1, texto: caso === 'expirada' ? 'expiró' : 'no existe', color: C.s8, nota: caso === 'expirada' ? 'La sesión superó su tiempo de vida y fue eliminada.' : 'Ningún sid coincide: no se puede adivinar uno válido porque es aleatorio y largo.' }); m.push({ de: 1, a: 0, texto: '401 → /login', color: C.s8, nota: 'El servidor pide iniciar sesión de nuevo.' }); }
        }
        if (logout && caso === 'valida') { m.push({ de: 0, a: 1, texto: 'POST /logout', color: C.s7, nota: 'El usuario cierra sesión.' }); m.push({ de: 1, a: 2, texto: 'borrar sid', color: C.s7, nota: 'El servidor elimina la sesión: la cookie robada deja de servir.' }); m.push({ de: 1, a: 0, texto: 'Set-Cookie: sid=; Max-Age=0', color: C.s7, nota: 'Y ordena al navegador borrar la cookie.' }); }
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Segunda petición', valor: caso, opciones: Object.entries(CASOS), alCambiar: (v) => { caso = v; reiniciar(); } });
        ctl.casilla({ etiqueta: 'terminar con cierre de sesión', valor: false, alCambiar: (v) => { logout = v; reiniciar(); } });
      },
      leyenda: [{ color: C.s1, texto: 'petición del navegador' }, { color: C.s3, texto: 'trabajo del servidor' }, { color: C.s2, texto: 'cookie' }, { color: C.s6, texto: 'éxito' }, { color: C.s8, texto: 'rechazo' }, { color: C.s7, texto: 'cierre' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['estado guardado en', 'el servidor'], ['el navegador solo guarda', 'un identificador']],
      nota: 'La cookie no contiene los datos del usuario, solo un <b>identificador</b>; los datos viven en el servidor. Pruebe una cookie inventada o una sesión expirada.',
    });
  }

  /* ---------- Fig. 2: expiración absoluta y deslizante ---------- */

  function montarExpiracion(cuerpo) {
    const est = { dur: 30, modo: 'desliza' };
    let semilla = 1, actividad = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Duración de la sesión', min: 5, max: 90, paso: 5, valor: est.dur, formato: (v) => `${v} min`, alCambiar: (v) => { est.dur = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Expiración', valor: est.modo, opciones: [['desliza', 'por inactividad (se renueva con cada uso)'], ['absoluta', 'absoluta (desde el inicio de sesión)']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    ctl.boton('Otra actividad', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 150 });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'sesión vigente' }, { color: C.s8, texto: 'sesión expirada' }, { color: C.s1, texto: 'petición atendida' }, { color: C.s2, texto: 'petición rechazada (debe iniciar sesión)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La expiración por inactividad mantiene la sesión mientras haya uso; la absoluta obliga a volver a autenticarse aunque haya actividad. Muchos sistemas combinan ambas.');
    const T = 240;
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const rnd = VIZ.semilla(semilla * 9);
      actividad = []; let t = 5;
      while (t < T) { actividad.push(Math.round(t)); t += rnd() < 0.65 ? 3 + rnd() * 12 : 25 + rnd() * 40; }
      const esc = (m) => 8 + (m / T) * (Wd - 16);
      let fin = est.dur, vivo = true, aceptadas = 0, rechazadas = 0, finVig = null;
      const resultado = actividad.map((a) => {
        if (vivo && a >= fin) { vivo = false; finVig = fin; }
        const ok = vivo; if (ok) { aceptadas++; if (est.modo === 'desliza') fin = a + est.dur; } else rechazadas++;
        return { a, ok };
      });
      if (finVig === null) finVig = Math.min(T, fin);
      ctx.fillStyle = C.s6; ctx.fillRect(esc(0), 50, esc(finVig) - esc(0), 18);
      ctx.fillStyle = C.s8; ctx.fillRect(esc(finVig), 50, esc(T) - esc(finVig), 18);
      resultado.forEach((r) => { ctx.fillStyle = r.ok ? C.s1 : C.s2; ctx.fillRect(esc(r.a) - 1.5, 78, 3, 22); });
      W.texto(ctx, 'sesión', 8, 40, { tam: 10, alinear: 'left', color: C.tinta2 });
      W.texto(ctx, 'peticiones', 8, 112, { tam: 10, alinear: 'left', color: C.tinta2 });
      [0, 60, 120, 180, 240].forEach((m) => W.texto(ctx, `${m} min`, Math.min(Wd - 20, Math.max(20, esc(m))), 134, { tam: 10, color: C.apagado }));
      registro.textContent = rechazadas ? `La sesión expiró a los ${Math.round(finVig)} min: ${rechazadas} petición(es) posteriores fueron rechazadas y exigen iniciar sesión otra vez.` : `La sesión sigue vigente durante todo el período: ${aceptadas} peticiones atendidas.`;
      lectura.set([['peticiones atendidas', String(aceptadas)], ['rechazadas', String(rechazadas)], ['expira a los', rechazadas || finVig < T ? `${Math.round(finVig)} min` : '> 240 min']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('cookies-sessions', {
    intro: String.raw`
      <p>HTTP es un protocolo <em>sin memoria</em>: cada petición es independiente y el servidor no sabe que la anterior vino de la misma persona. Para «recordar» a alguien se usa una <strong>sesión</strong>:
      tras iniciar sesión, el servidor guarda los datos del usuario y entrega al navegador una <strong>cookie</strong> con un identificador que este reenvía en cada petición.</p>
      <p>La cookie es solo el «ticket del guardarropa»: el abrigo (los datos) queda en el servidor.</p>`,
    visualizaciones: [
      { titulo: 'Inicio de sesión con cookie', descripcion: 'Recorra el login y la segunda petición; pruebe una cookie inventada, una sesión expirada o la ausencia de cookie.', montar: montarLogin },
      { titulo: 'Expiración de la sesión', descripcion: 'Cambie la duración y compare la expiración por inactividad con la absoluta frente a una misma secuencia de peticiones.', montar: montarExpiracion },
    ],
    teoria: String.raw`
      <h2>Cookies</h2>
      <pre><code>Set-Cookie: sid=a9f3c1…; Max-Age=1800; Path=/; HttpOnly; Secure; SameSite=Lax</code></pre>
      <table>
        <tr><th>Atributo</th><th>Efecto</th></tr>
        <tr><td><code>Max-Age</code> / <code>Expires</code></td><td>cuánto vive; sin él, se borra al cerrar el navegador</td></tr>
        <tr><td><code>HttpOnly</code></td><td>JavaScript no puede leerla (mitiga robo por <a href="tema.html?id=xss-injection">XSS</a>)</td></tr>
        <tr><td><code>Secure</code></td><td>solo se envía por HTTPS</td></tr>
        <tr><td><code>SameSite</code></td><td>limita su envío en peticiones entre sitios (mitiga <a href="tema.html?id=csrf-attack">CSRF</a>)</td></tr>
        <tr><td><code>Domain</code> / <code>Path</code></td><td>a qué sitios y rutas se adjunta</td></tr>
      </table>
      <h2>Sesión en el servidor</h2>
      <pre><code>login(usuario, clave):
    si hash(clave) ≠ guardado[usuario]: rechazar
    sid ← bytes aleatorios (≥ 128 bits)
    sesiones[sid] ← { usuario, creada: ahora }
    enviar Set-Cookie: sid
petición(sid):
    s ← sesiones[sid]
    si s no existe o ahora − s.ultimoUso &gt; duración: exigir login
    s.ultimoUso ← ahora</code></pre>
      <p>El identificador debe ser imposible de adivinar: con 128 bits de entropía, la probabilidad de acertar uno válido entre \(S\) sesiones es \(S / 2^{128}\), despreciable. Si la sesión se guarda en memoria del servidor se pierde al reiniciarlo; por eso se usan almacenes externos (Redis, base de datos).</p>
      <div class="recuadro">Al cerrar sesión hay que <em>borrar la sesión del servidor</em>, no solo la cookie del navegador. Compare esta idea con la autenticación sin estado en <a href="tema.html?id=jwt-tokens">JSON Web Tokens</a> y en <a href="tema.html?id=session-vs-token">sesiones frente a tokens</a>.</div>`,
  });
})();
