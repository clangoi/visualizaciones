(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const METODOS = {
    GET: { seguro: true, idem: true, cuerpo: false, uso: 'leer un recurso' },
    POST: { seguro: false, idem: false, cuerpo: true, uso: 'crear un recurso o ejecutar una acción' },
    PUT: { seguro: false, idem: true, cuerpo: true, uso: 'reemplazar un recurso completo' },
    PATCH: { seguro: false, idem: false, cuerpo: true, uso: 'modificar parte de un recurso' },
    DELETE: { seguro: false, idem: true, cuerpo: false, uso: 'eliminar un recurso' },
  };
  const RECURSOS = { '/usuarios': 'colección', '/usuarios/7': 'elemento existente', '/usuarios/99': 'elemento inexistente', '/admin': 'zona restringida' };
  const FRASES = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 503: 'Service Unavailable' };
  const JSON_U = '{"id":7,"nombre":"Ana"}';

  // Lógica del servidor de ejemplo: devuelve [estado, encabezados, cuerpo, explicación].
  function servidor(m, ruta, { token, valido, caido }) {
    if (caido) return [503, { 'Retry-After': '30' }, '', 'El servidor no puede atender ahora: es un error suyo (5xx), no de la petición.'];
    if (ruta === '/admin') {
      return token ? [403, {}, '{"error":"requiere rol admin"}', 'Se sabe quién es usted (hay token) pero no tiene permiso: 403.']
        : [401, { 'WWW-Authenticate': 'Bearer' }, '{"error":"falta autenticación"}', 'No hay credenciales: el servidor pide autenticarse (401).'];
    }
    const col = ruta === '/usuarios', existe = ruta === '/usuarios/7';
    const permitidos = col ? ['GET', 'POST'] : ['GET', 'PUT', 'PATCH', 'DELETE'];
    if (!permitidos.includes(m)) return [405, { Allow: permitidos.join(', ') }, '', `Este recurso no admite ${m}; el encabezado Allow lista los métodos válidos.`];
    if (METODOS[m].cuerpo && !valido) return [400, {}, '{"error":"JSON inválido"}', 'El cuerpo enviado no se puede interpretar: error del cliente (400).'];
    if (!col && !existe) return [404, {}, '{"error":"no existe"}', 'El recurso pedido no existe (404).'];
    if (m === 'GET') return [200, { 'Content-Type': 'application/json' }, col ? `[${JSON_U}]` : JSON_U, 'Lectura correcta: 200 con el recurso en el cuerpo.'];
    if (m === 'POST') return [201, { Location: '/usuarios/8' }, '{"id":8}', 'Recurso creado: 201 y su nueva dirección en Location.'];
    if (m === 'DELETE') return [204, {}, '', 'Eliminado: 204, éxito sin cuerpo.'];
    return [200, { 'Content-Type': 'application/json' }, JSON_U, m === 'PUT' ? 'Reemplazo completo correcto.' : 'Modificación parcial correcta.'];
  }

  function montarPeticion(cuerpo) {
    const est = { m: 'GET', ruta: '/usuarios/7', token: false, valido: true, caido: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Método', valor: est.m, opciones: Object.keys(METODOS).map((k) => [k, k]), alCambiar: (v) => { est.m = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Recurso', valor: est.ruta, opciones: Object.entries(RECURSOS).map(([k, t]) => [k, `${k} — ${t}`]), alCambiar: (v) => { est.ruta = v; dibujar(); } });
    ctl.casillas([{ clave: 'token', texto: 'enviar token', activo: false }, { clave: 'valido', texto: 'cuerpo JSON válido', activo: true }, { clave: 'caido', texto: 'servidor con falla', activo: false }],
      (e) => { Object.assign(est, e); dibujar(); });
    const dos = el('div', { class: 'dos-columnas' });
    const pedido = el('pre', { class: 'codigo-bdd' }), respuesta = el('pre', { class: 'codigo-bdd' });
    dos.append(el('div', null, el('p', { class: 'subtitulo-viz' }, 'Solicitud del navegador'), pedido), el('div', null, el('p', { class: 'subtitulo-viz' }, 'Respuesta del servidor'), respuesta));
    cuerpo.appendChild(dos);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Combine métodos y recursos: pruebe <code>POST</code> sobre <code>/usuarios/7</code>, <code>DELETE</code> sobre <code>/usuarios/99</code> o <code>/admin</code> con y sin token.');

    function dibujar() {
      const meta = METODOS[est.m];
      const conCuerpo = meta.cuerpo && est.valido ? JSON_U : meta.cuerpo ? '{"nombre":' : '';
      const lineasP = [`${est.m} ${est.ruta} HTTP/1.1`, 'Host: api.ejemplo.com', 'Accept: application/json'];
      if (est.token) lineasP.push('Authorization: Bearer eyJhbGci…');
      if (conCuerpo) lineasP.push('Content-Type: application/json', `Content-Length: ${conCuerpo.length}`);
      pedido.textContent = lineasP.join('\n') + (conCuerpo ? `\n\n${conCuerpo}` : '');
      const [codigo, enc, cu, expl] = servidor(est.m, est.ruta, est);
      const fam = Math.floor(codigo / 100);
      const col = fam === 2 ? C.s6 : fam === 4 ? C.s2 : C.s8;
      const lineasR = [`HTTP/1.1 ${codigo} ${FRASES[codigo]}`, ...Object.entries(enc).map(([k, v]) => `${k}: ${v}`)];
      respuesta.replaceChildren(el('span', { class: 'dato', style: { background: VIZ.alfa(col, 0.3) } }, lineasR[0]), '\n' + lineasR.slice(1).join('\n') + (cu ? `\n\n${cu}` : ''));
      registro.textContent = expl;
      lectura.set([['método', `${est.m}: ${meta.uso}`], ['seguro (no modifica)', meta.seguro ? 'sí' : 'no'], ['idempotente', meta.idem ? 'sí' : 'no'], ['familia', `${fam}xx — ${fam === 2 ? 'éxito' : fam === 4 ? 'error del cliente' : 'error del servidor'}`]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: mapa de códigos de estado ---------- */

  const FAMILIAS = [
    { f: 1, nombre: 'Información', color: C.s3, codigos: [[100, 'Continue', 'El servidor recibió los encabezados; el cliente puede enviar el cuerpo.'], [101, 'Switching Protocols', 'Se cambia de protocolo, por ejemplo a WebSocket.']] },
    { f: 2, nombre: 'Éxito', color: C.s6, codigos: [[200, 'OK', 'La petición tuvo éxito.'], [201, 'Created', 'Se creó un recurso (típico de POST).'], [202, 'Accepted', 'Se aceptó para procesarla después.'], [204, 'No Content', 'Éxito sin cuerpo (típico de DELETE).']] },
    { f: 3, nombre: 'Redirección', color: C.s1, codigos: [[301, 'Moved Permanently', 'El recurso cambió de dirección para siempre.'], [302, 'Found', 'Redirección temporal.'], [304, 'Not Modified', 'Use su copia en caché: no cambió.'], [307, 'Temporary Redirect', 'Redirección temporal que conserva el método.'], [308, 'Permanent Redirect', 'Redirección permanente que conserva el método.']] },
    { f: 4, nombre: 'Error del cliente', color: C.s2, codigos: [[400, 'Bad Request', 'La petición está mal formada.'], [401, 'Unauthorized', 'Falta autenticación o es inválida.'], [403, 'Forbidden', 'Autenticado, pero sin permiso.'], [404, 'Not Found', 'El recurso no existe.'], [405, 'Method Not Allowed', 'Ese método no se admite aquí.'], [409, 'Conflict', 'Choca con el estado actual (por ejemplo, un duplicado).'], [422, 'Unprocessable Content', 'Sintaxis correcta pero datos inválidos.'], [429, 'Too Many Requests', 'Demasiadas peticiones: límite de uso superado.']] },
    { f: 5, nombre: 'Error del servidor', color: C.s8, codigos: [[500, 'Internal Server Error', 'Falla inesperada en el servidor.'], [502, 'Bad Gateway', 'Un intermediario recibió una respuesta inválida.'], [503, 'Service Unavailable', 'Servidor sobrecargado o en mantenimiento.'], [504, 'Gateway Timeout', 'Un intermediario esperó demasiado.']] },
  ];

  function montarCodigos(cuerpo) {
    let sel = 404, celdas = [];
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => FAMILIAS.length * 48 + 12 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, FAMILIAS.map((f) => ({ color: f.color, texto: `${f.f}xx ${f.nombre.toLowerCase()}` })));
    const registro = VIZ.registro(cuerpo, { grande: true });
    VIZ.nota(cuerpo, 'Haga clic en un código para ver qué significa; la primera cifra dice quién tuvo el problema.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      celdas = [];
      const izq = 34, w = (W - izq - 4) / 8;
      FAMILIAS.forEach((f, i) => {
        const y = 8 + i * 48;
        VIZ.web.texto(ctx, `${f.f}xx`, 4, y + 18, { tam: 12, peso: 600, alinear: 'left' });
        f.codigos.forEach(([c, n, d], j) => {
          const x = izq + j * w;
          const activa = c === sel;
          ctx.fillStyle = activa ? f.color : VIZ.alfa(f.color, 0.18);
          ctx.strokeStyle = f.color; ctx.lineWidth = activa ? 2.5 : 1.5;
          ctx.beginPath(); ctx.roundRect(x + 2, y, w - 4, 36, 4); ctx.fill(); ctx.stroke();
          VIZ.web.texto(ctx, String(c), x + w / 2, y + 18, { tam: 12, peso: 600, color: activa ? C.sobre : C.tinta });
          celdas.push({ x: x + 2, y, w: w - 4, h: 36, c, n, d, f });
        });
      });
      const s = celdas.find((k) => k.c === sel);
      registro.textContent = `${s.c} ${s.n} — ${s.d}`;
    }
    lienzo.alDibujar = dibujar;
    const buscar = (ev) => { const { x, y } = lienzo.posicion(ev); return celdas.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const k = buscar(ev); if (k) { sel = k.c; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const k = buscar(ev); if (!k) return tip.ocultar(); const { x, y } = lienzo.posicion(ev); tip.mostrar(x, y, `<b>${k.c}</b> ${k.n}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('http-messages', {
    intro: String.raw`
      <p><strong>HTTP</strong> es el idioma en que conversan navegador y servidor: el cliente envía una <em>solicitud</em> y el servidor responde con una <em>respuesta</em>.
      Ambas son texto con tres partes: una primera línea, encabezados (<em>headers</em>) y, a veces, un cuerpo.</p>
      <p>La solicitud dice <strong>qué hacer</strong> (el método: <code>GET</code>, <code>POST</code>, <code>PUT</code>, <code>PATCH</code>, <code>DELETE</code>) y <strong>sobre qué recurso</strong>.
      La respuesta dice <strong>cómo salió</strong> mediante un código de estado de tres cifras.</p>`,
    visualizaciones: [
      {
        titulo: 'Solicitud y respuesta HTTP',
        descripcion: 'Elija método y recurso, y active o desactive el token, el cuerpo válido y la falla del servidor: observe el código que devuelve y por qué.',
        montar: montarPeticion,
      },
      {
        titulo: 'Mapa de códigos de estado',
        descripcion: 'Los códigos se agrupan por su primera cifra. Haga clic en varios y compare, por ejemplo, 401 con 403 o 502 con 504.',
        montar: montarCodigos,
      },
    ],
    teoria: String.raw`
      <h2>Formato de los mensajes</h2>
      <pre><code>GET /usuarios/7 HTTP/1.1          HTTP/1.1 200 OK
Host: api.ejemplo.com              Content-Type: application/json
Accept: application/json           Content-Length: 24

                                   {"id":7,"nombre":"Ana"}</code></pre>
      <p>Una línea en blanco separa los encabezados del cuerpo. Encabezados frecuentes: <code>Host</code>, <code>Content-Type</code>, <code>Authorization</code>, <code>Cookie</code> / <code>Set-Cookie</code>, <code>Cache-Control</code>, <code>Location</code>.</p>
      <h2>Métodos</h2>
      <table>
        <tr><th>Método</th><th>Seguro</th><th>Idempotente</th><th>Típico</th></tr>
        <tr><td><code>GET</code></td><td>sí</td><td>sí</td><td>leer</td></tr>
        <tr><td><code>POST</code></td><td>no</td><td>no</td><td>crear / acciones</td></tr>
        <tr><td><code>PUT</code></td><td>no</td><td>sí</td><td>reemplazar</td></tr>
        <tr><td><code>PATCH</code></td><td>no</td><td>no (depende)</td><td>modificar parcialmente</td></tr>
        <tr><td><code>DELETE</code></td><td>no</td><td>sí</td><td>borrar</td></tr>
      </table>
      <p>Un método es <em>seguro</em> si no modifica el servidor, e <em>idempotente</em> si repetirlo \(k\) veces deja el mismo estado que hacerlo una vez: \(f^k(s) = f(s)\). La idempotencia permite reintentar sin miedo; repetir un <code>POST</code> puede crear dos recursos.</p>
      <h2>Códigos de estado</h2>
      <p>La primera cifra clasifica: 1xx informativo, 2xx éxito, 3xx redirección, 4xx culpa del cliente, 5xx culpa del servidor. La diferencia entre 401 (<em>no sé quién es</em>) y 403 (<em>sé quién es y no puede</em>) es una fuente clásica de errores.</p>
      <div class="recuadro">HTTP no tiene memoria: cada solicitud es independiente. Para recordar al usuario se agregan <a href="tema.html?id=cookies-sessions">cookies y sesiones</a>. Para cifrar el mensaje se usa <a href="tema.html?id=tls-handshake">HTTPS</a>. Su uso para diseñar servicios está en <a href="tema.html?id=rest-api-crud">REST</a>.</div>`,
  });
})();
