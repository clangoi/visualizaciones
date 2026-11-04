(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: ¿mismo origen? ---------- */

  const BASE = 'https://app.ejemplo.com';
  const DESTINOS = [
    'https://app.ejemplo.com/api/datos', 'https://app.ejemplo.com:8443/api', 'http://app.ejemplo.com/api', 'https://api.ejemplo.com/datos', 'https://ejemplo.com/', 'https://app.ejemplo.com.evil.com/', 'https://otro-sitio.org/api',
  ];
  const origen = (u) => { try { const x = new URL(u); return { esquema: x.protocol.slice(0, -1), host: x.hostname, puerto: x.port || (x.protocol === 'https:' ? '443' : '80') }; } catch (e) { return null; } };

  function montarOrigen(cuerpo) {
    let a = BASE, b = DESTINOS[1];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Página que ejecuta el script', valor: a, opciones: [BASE, 'http://localhost:3000', 'https://ejemplo.com'].map((u) => [u, u]), alCambiar: (v) => { a = v; dibujar(); } });
    const t = ctl.texto({ etiqueta: 'URL a la que pide datos', valor: b, alCambiar: (v) => { b = v; dibujar(); }, alEnter: (v) => { b = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', valor: b, opciones: DESTINOS.map((u) => [u, u]), alCambiar: (v) => { b = v; t.valor = v; dibujar(); } });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const veredicto = el('div', { class: 'fichas' });
    cuerpo.appendChild(veredicto);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos URL tienen el mismo origen solo si coinciden <b>esquema, host y puerto</b>. Fíjese en <code>app.ejemplo.com.evil.com</code>: parece del mismo sitio, pero su host es otro.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const o1 = origen(a), o2 = origen(b);
      if (!o2) { tabla.replaceChildren(); veredicto.replaceChildren(); registro.textContent = 'La URL no es válida.'; lectura.set([['origen', '—']]); return; }
      const filas = [['esquema', o1.esquema, o2.esquema], ['host', o1.host, o2.host], ['puerto', o1.puerto, o2.puerto]];
      tabla.replaceChildren(el('tr', null, ...['Componente', 'Página', 'Destino', '¿Igual?'].map((h) => el('th', null, h))),
        ...filas.map(([k, x, y]) => el('tr', null, el('td', null, k), el('td', null, x), el('td', null, y), el('td', null, VIZ.ficha(x === y ? 'sí' : 'NO', { color: x === y ? C.s6 : C.s8 })))));
      const igual = filas.every(([, x, y]) => x === y);
      veredicto.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Política del mismo origen:'), VIZ.ficha(igual ? 'mismo origen: el script puede leer la respuesta' : 'origen distinto: el navegador BLOQUEA la lectura (salvo CORS)', { color: igual ? C.s6 : C.s8, fondo: VIZ.alfa(igual ? C.s6 : C.s8, 0.2) }));
      registro.textContent = igual ? 'Mismo origen: no hay restricción entre estas páginas.' : `Difiere en ${filas.filter(([, x, y]) => x !== y).map(([k]) => k).join(' y ')}: es otro origen. La petición se puede enviar, pero el navegador no deja que el script lea la respuesta a menos que el servidor lo autorice con CORS.`;
      lectura.set([['origen de la página', `${o1.esquema}://${o1.host}:${o1.puerto}`], ['origen del destino', `${o2.esquema}://${o2.host}:${o2.puerto}`], ['componentes distintos', String(filas.filter(([, x, y]) => x !== y).length)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: CORS y la petición previa (preflight) ---------- */

  function montarCors(cuerpo) {
    const est = { tipo: 'simple', permitido: true, cred: false };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Navegador (app.ejemplo.com)' }, { nombre: 'api.otro.com' }],
      mensajes: () => {
        const m = [{ de: 0, a: 0, texto: 'fetch("https://api.otro.com/datos")', color: C.s1, nota: 'El script de app.ejemplo.com pide datos a otro origen.' }];
        if (est.tipo === 'previa') {
          m.push({ de: 0, a: 1, texto: 'OPTIONS (preflight)', color: C.s2, nota: 'Como la petición usa PUT y JSON, el navegador primero pregunta con OPTIONS si el servidor la permite.' });
          m.push({ de: 1, a: 0, texto: est.permitido ? '204 + Access-Control-Allow-*' : '204 sin Allow-Origin', color: est.permitido ? C.s6 : C.s8, nota: est.permitido ? 'El servidor responde con los orígenes, métodos y cabeceras permitidos.' : 'El servidor no autoriza ese origen.' });
          if (!est.permitido) { m.push({ de: 0, a: 0, texto: 'BLOQUEADA: ni se envía PUT', color: C.s8, nota: 'El navegador cancela la petición real: el servidor nunca recibe el PUT.' }); return m; }
          m.push({ de: 0, a: 1, texto: 'PUT /datos', color: C.s1, nota: 'La verificación previa pasó: ahora sí se envía la petición real.' });
        } else m.push({ de: 0, a: 1, texto: 'GET /datos  Origin: app.ejemplo.com', color: C.s1, nota: 'Una petición simple (GET) se envía directamente, con la cabecera Origin.' });
        m.push({ de: 1, a: 0, texto: est.permitido ? '200 + Allow-Origin' : '200 sin Allow-Origin', color: est.permitido ? C.s6 : C.s2, nota: est.permitido ? `El servidor incluye Access-Control-Allow-Origin${est.cred ? ' y Allow-Credentials: true' : ''}: autoriza a este origen.` : 'El servidor respondió y ejecutó la acción, pero sin la cabecera que autoriza al origen.' });
        m.push({ de: 0, a: 0, texto: est.permitido ? 'el script lee la respuesta' : 'BLOQUEADA la lectura', color: est.permitido ? C.s6 : C.s8, nota: est.permitido ? 'El navegador entrega la respuesta al script.' : 'El navegador oculta la respuesta al script y muestra un error CORS en la consola. Ojo: el servidor sí recibió y procesó la petición.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Tipo de petición', valor: est.tipo, opciones: [['simple', 'simple (GET)'], ['previa', 'con verificación previa (PUT con JSON)']], alCambiar: (v) => { est.tipo = v; reiniciar(); } });
        ctl.casillas([{ clave: 'permitido', texto: 'el servidor autoriza este origen (CORS)', activo: true }, { clave: 'cred', texto: 'con cookies (credentials)', activo: false }], (e) => { est.permitido = e.permitido; est.cred = e.cred; reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'petición' }, { color: C.s2, texto: 'verificación previa' }, { color: C.s6, texto: 'permitido' }, { color: C.s8, texto: 'bloqueado por el navegador' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['quién bloquea', est.permitido ? 'nadie' : 'el navegador, no el servidor'], ['peticiones HTTP', String(msgs.filter((x) => x.de !== x.a).length)]],
      nota: 'CORS no protege al servidor: es el navegador quien decide si el script puede <em>leer</em> la respuesta, según las cabeceras del servidor.',
    });
  }

  VIZ.registrarTema('same-origin-cors', {
    intro: String.raw`
      <p>Imagine que está conectado a su banco y abre otra pestaña con una página maliciosa. Si esa página pudiera pedir datos al banco y <em>leer</em> la respuesta, vería su saldo.
      Para impedirlo, los navegadores aplican la <strong>política del mismo origen</strong> (<em>Same-Origin Policy</em>): un script solo puede leer respuestas de su propio origen.</p>
      <p>A veces sí se necesita compartir recursos entre orígenes (una app en <code>app.ejemplo.com</code> y su API en <code>api.ejemplo.com</code>). <strong>CORS</strong> es el mecanismo con el que el <em>servidor</em> declara a quién autoriza.</p>`,
    visualizaciones: [
      { titulo: '¿Mismo origen o distinto?', descripcion: 'Compare esquema, host y puerto de dos URL. Pruebe cambiar solo el puerto, el esquema o el subdominio.', montar: montarOrigen },
      { titulo: 'CORS y la verificación previa', descripcion: 'Alterne petición simple y con verificación previa, y autorice o no el origen: vea quién bloquea y si el servidor llegó a recibir algo.', montar: montarCors },
    ],
    teoria: String.raw`
      <h2>Origen</h2>
      \[ \text{origen} = (\text{esquema},\ \text{host},\ \text{puerto}). \]
      <p>Dos URL tienen el mismo origen si las tres componentes son iguales: <code>https://a.com/x</code> y <code>https://a.com/y</code> sí; <code>http://a.com</code>, <code>https://a.com:8443</code> y <code>https://api.a.com</code> no.</p>
      <h2>Qué restringe la política</h2>
      <ul>
        <li>Un script <strong>no puede leer</strong> respuestas de otro origen ni acceder al DOM de un <code>iframe</code> de otro origen.</li>
        <li>Sí se pueden <em>incrustar</em> imágenes, scripts y hojas de estilo de otros orígenes, y <em>enviar</em> formularios (por eso existe <a href="tema.html?id=csrf-attack">CSRF</a>).</li>
      </ul>
      <h2>CORS</h2>
      <pre><code>Access-Control-Allow-Origin: https://app.ejemplo.com
Access-Control-Allow-Methods: GET, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true       (para enviar cookies)</code></pre>
      <p>Las peticiones «no simples» (métodos distintos de GET/POST/HEAD, o cabeceras personalizadas como <code>Authorization</code>, o JSON) van precedidas por una <em>verificación previa</em> <code>OPTIONS</code>, que cuesta un viaje de ida y vuelta adicional; el servidor puede cachearla con <code>Access-Control-Max-Age</code>.</p>
      <div class="recuadro">Errores frecuentes: usar <code>Access-Control-Allow-Origin: *</code> junto con cookies (no está permitido) o <em>reflejar</em> cualquier <code>Origin</code> recibido (equivale a desactivar la protección). CORS tampoco sustituye a la autenticación: un cliente que no sea un navegador ignora estas reglas.</div>`,
  });
})();
