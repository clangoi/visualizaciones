(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const deb64 = (s) => { try { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { return '?'; } };
  // Firma de DEMOSTRACIÓN: cuatro hashes FNV-1a de 32 bits con distinta semilla. No es criptográficamente segura.
  function firmar(datos, secreto) {
    const bytes = [];
    for (let k = 0; k < 4; k++) {
      let h = 2166136261 ^ (k * 16777619);
      for (const ch of `${secreto}\u0000${datos}\u0000${secreto}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
      for (let s = 24; s >= 0; s -= 8) bytes.push((h >>> s) & 255);
    }
    return b64(String.fromCharCode(...bytes));
  }

  /* ---------- Fig. 1: anatomía y verificación ---------- */

  function montarAnatomia(cuerpo) {
    const est = { nombre: 'ana', rol: 'usuario', secreto: 'clave-secreta', minutos: 0, atacante: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Nombre (claim «sub»)', valor: est.nombre, alCambiar: (v) => { est.nombre = v || 'ana'; dibujar(); } });
    ctl.selector({ etiqueta: 'Rol que emite el servidor', valor: est.rol, opciones: [['usuario', 'usuario'], ['admin', 'admin']], alCambiar: (v) => { est.rol = v; dibujar(); } });
    ctl.texto({ etiqueta: 'Secreto del servidor', valor: est.secreto, alCambiar: (v) => { est.secreto = v || 'x'; dibujar(); } });
    ctl.rango({ etiqueta: 'Tiempo transcurrido (el token dura 30 min)', min: 0, max: 60, valor: est.minutos, formato: (v) => `${v} min`, alCambiar: (v) => { est.minutos = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'un atacante cambia el rol a «admin» en el payload', valor: false, alCambiar: (v) => { est.atacante = v; dibujar(); } });
    const token = el('div', { class: 'codigo-bdd' });
    const dos = el('div', { class: 'dos-columnas' });
    const decH = el('pre', { class: 'codigo-bdd' }), decP = el('pre', { class: 'codigo-bdd' });
    dos.append(el('div', null, el('p', { class: 'subtitulo-viz' }, 'Header decodificado'), decH), el('div', null, el('p', { class: 'subtitulo-viz' }, 'Payload decodificado'), decP));
    cuerpo.append(token, dos);
    const verif = el('div', { class: 'fichas' });
    cuerpo.appendChild(verif);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El payload está solo <em>codificado</em> (base64), no cifrado: cualquiera puede leerlo. La firma garantiza que no fue <em>alterado</em>. (Aquí la firma usa un hash de demostración, no HMAC real.)');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';

    function dibujar() {
      const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
      const payloadOk = JSON.stringify({ sub: est.nombre, rol: est.rol, exp: 30 });
      const payloadEnviado = est.atacante ? JSON.stringify({ sub: est.nombre, rol: 'admin', exp: 30 }) : payloadOk;
      const h = b64(header), p = b64(payloadEnviado), sFirmada = firmar(`${h}.${b64(payloadOk)}`, est.secreto);
      token.replaceChildren(el('span', { class: 'dato', style: { background: VIZ.alfa(C.s1, 0.25) } }, h), '.', el('span', { class: 'dato', style: { background: VIZ.alfa(C.s2, 0.25) } }, p), '.', el('span', { class: 'dato', style: { background: VIZ.alfa(C.s3, 0.25) } }, sFirmada));
      decH.textContent = JSON.stringify(JSON.parse(deb64(h)), null, 2);
      decP.textContent = JSON.stringify(JSON.parse(deb64(p)), null, 2);
      const esperada = firmar(`${h}.${p}`, est.secreto), firmaValida = esperada === sFirmada, expirado = est.minutos >= 30;
      const ok = firmaValida && !expirado;
      verif.replaceChildren(el('span', { class: 'fichas-titulo' }, 'El servidor verifica:'),
        VIZ.ficha(firmaValida ? 'firma válida' : 'firma NO coincide', { color: firmaValida ? C.s6 : C.s8 }), VIZ.ficha(expirado ? 'expirado' : 'vigente', { color: expirado ? C.s8 : C.s6 }), VIZ.ficha(ok ? 'ACEPTADO' : 'RECHAZADO (401)', { color: ok ? C.s6 : C.s8, fondo: VIZ.alfa(ok ? C.s6 : C.s8, 0.2) }));
      registro.textContent = !firmaValida ? 'El payload cambió pero la firma sigue siendo la del original: el servidor recalcula la firma con su secreto y no coincide. Sin el secreto, el atacante no puede falsificarla.' : expirado ? 'La firma es correcta pero el claim exp venció: el token ya no sirve.' : 'La firma coincide y el token no expiró: el servidor confía en los claims sin consultar ninguna base de datos.';
      lectura.set([['tamaño del token', `${h.length + p.length + sFirmada.length + 2} caracteres`], ['rol aceptado', ok ? JSON.parse(deb64(p)).rol : '—'], ['consultas a base de datos', '0']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: token de acceso y de refresco ---------- */

  function montarRefresco(cuerpo) {
    const est = { acceso: false, refresco: true };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Cliente' }, { nombre: 'API' }, { nombre: 'Auth' }],
      mensajes: () => {
        const m = [{ de: 0, a: 1, texto: 'GET /datos  Bearer acceso', color: C.s1, nota: 'El cliente envía su token de acceso en el encabezado Authorization.' }];
        if (!est.acceso) { m.push({ de: 1, a: 0, texto: '200 datos', color: C.s6, nota: 'La API verifica la firma y la expiración sin consultar a nadie: responde.' }); return m; }
        m.push({ de: 1, a: 0, texto: '401 token expirado', color: C.s8, nota: 'El token de acceso dura poco (minutos): ya venció.' });
        m.push({ de: 0, a: 2, texto: 'POST /refresh  (token de refresco)', color: C.s2, nota: 'El cliente usa el token de refresco, de larga duración, para pedir uno nuevo.' });
        if (est.refresco) {
          m.push({ de: 2, a: 0, texto: 'nuevo acceso (+ refresco)', color: C.s6, nota: 'Auth comprueba que el refresco sea válido (y no esté revocado) y emite un token de acceso nuevo.' });
          m.push({ de: 0, a: 1, texto: 'GET /datos  Bearer nuevo', color: C.s1, nota: 'El cliente repite la petición original con el token nuevo.' });
          m.push({ de: 1, a: 0, texto: '200 datos', color: C.s6, nota: 'Esta vez se acepta; la persona nunca tuvo que volver a escribir su clave.' });
        } else {
          m.push({ de: 2, a: 0, texto: '401 refresco expirado', color: C.s8, nota: 'También el de refresco venció (o fue revocado).' });
          m.push({ de: 0, a: 0, texto: 'ir a la pantalla de login', color: C.s8, nota: 'No queda otra opción: la persona debe volver a autenticarse.' });
        }
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.casillas([{ clave: 'acceso', texto: 'el token de acceso ya expiró', activo: false }, { clave: 'refresco', texto: 'el token de refresco sigue vigente', activo: true }], (e) => { Object.assign(est, e); reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'petición con token' }, { color: C.s2, texto: 'renovación' }, { color: C.s6, texto: 'éxito' }, { color: C.s8, texto: 'rechazo' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['acceso dura', '15 minutos'], ['refresco dura', '7 días']],
      nota: 'Dos tokens equilibran seguridad y comodidad: si roban el de acceso, sirve poco tiempo; el de refresco viaja poco y puede revocarse en el servidor.',
    });
  }

  VIZ.registrarTema('jwt-tokens', {
    intro: String.raw`
      <p>Un <strong>JSON Web Token</strong> (JWT) es una credencial que el servidor entrega al iniciar sesión y que el cliente presenta en cada petición. A diferencia de una sesión, el token <em>contiene</em>
      los datos (quién es, qué rol tiene, hasta cuándo vale) y está <strong>firmado</strong>: el servidor puede verificarlo sin consultar ningún almacén.</p>
      <p>Tiene tres partes separadas por puntos: <code>header.payload.signature</code>. La firma impide modificar el contenido sin conocer el secreto, pero el contenido no está oculto.</p>`,
    visualizaciones: [
      { titulo: 'Anatomía y verificación de un JWT', descripcion: 'Cambie el rol, el secreto o el tiempo transcurrido, y active el ataque: vea por qué la firma delata un payload alterado.', montar: montarAnatomia },
      { titulo: 'Token de acceso y de refresco', descripcion: 'Simule la expiración del token de acceso y compare qué ocurre si el de refresco aún es válido o también venció.', montar: montarRefresco },
    ],
    teoria: String.raw`
      <h2>Estructura</h2>
      <pre><code>header    = base64url({ "alg": "HS256", "typ": "JWT" })
payload   = base64url({ "sub": "ana", "rol": "usuario", "exp": 1767225600 })
signature = HMAC-SHA256(header + "." + payload, secreto)
token     = header + "." + payload + "." + base64url(signature)</code></pre>
      <p>Las afirmaciones del payload se llaman <em>claims</em>: <code>sub</code> (sujeto), <code>exp</code> (expiración), <code>iat</code> (emisión), más los propios (<code>rol</code>). Para verificar, el servidor recalcula la firma y la compara con la recibida:</p>
      \[ \text{válido} \iff \text{HMAC}_k(h \,\|\, p) = s \;\wedge\; \text{ahora} < \text{exp}. \]
      <h2>Qué da y qué no da</h2>
      <ul>
        <li><strong>Integridad</strong>: cambiar un byte del payload invalida la firma. Con una clave de \(256\) bits, falsificarla por fuerza bruta requiere \(\sim 2^{256}\) intentos.</li>
        <li><strong>No confidencialidad</strong>: el payload se lee con base64; no guarde contraseñas ni datos sensibles.</li>
        <li><strong>Sin estado</strong>: no hay búsqueda en servidor; pero tampoco se puede «borrar» un token emitido antes de que expire (hace falta una lista de revocación o tiempos de vida cortos).</li>
      </ul>
      <h2>Acceso y refresco</h2>
      <p>El token de acceso dura minutos para limitar el daño de un robo; el de refresco, días, se guarda con más cuidado (cookie <code>HttpOnly</code>) y se verifica en el servidor, lo que permite revocarlo.</p>
      <div class="recuadro">Verifique siempre <code>alg</code> en el servidor (el ataque <code>alg: none</code>) y use secretos largos y aleatorios. Dónde guardar el token en el navegador (<code>localStorage</code> o cookie) cambia el riesgo ante <a href="tema.html?id=xss-injection">XSS</a> y <a href="tema.html?id=csrf-attack">CSRF</a>. Comparación en <a href="tema.html?id=session-vs-token">sesiones frente a tokens</a>.</div>`,
  });
})();
