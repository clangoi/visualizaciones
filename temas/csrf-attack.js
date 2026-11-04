(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: el ataque paso a paso y sus defensas ---------- */

  function montarAtaque(cuerpo) {
    const est = { samesite: 'none', token: false, origin: false };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Navegador' }, { nombre: 'banco.com' }, { nombre: 'evil.com' }],
      mensajes: () => {
        const m = [
          { de: 0, a: 1, texto: 'login (Cookie de sesión)', color: C.s1, nota: 'Ana inicia sesión en el banco: el navegador guarda la cookie de sesión.' },
          { de: 0, a: 2, texto: 'visita evil.com', color: C.s2, nota: 'En otra pestaña, Ana abre un sitio malicioso (por un enlace o un anuncio).' },
          { de: 2, a: 0, texto: '<form action=banco.com/transferir>', color: C.s2, nota: 'La página de evil.com contiene un formulario oculto que se envía solo al cargar.' },
          { de: 0, a: 1, texto: est.samesite === 'none' ? 'POST /transferir + Cookie' : 'POST /transferir (sin cookie)', color: est.samesite === 'none' ? C.s8 : C.s3, nota: est.samesite === 'none' ? 'El navegador envía a banco.com la petición Y adjunta la cookie de Ana, aunque nació en otro sitio.' : `SameSite=${est.samesite}: el navegador no adjunta la cookie en una petición POST originada en otro sitio.` },
        ];
        if (est.samesite !== 'none') { m.push({ de: 1, a: 0, texto: '401 sin sesión', color: C.s6, nota: 'Sin cookie, el banco ve a un desconocido y rechaza. El ataque falla.' }); return m; }
        if (est.origin) { m.push({ de: 1, a: 1, texto: 'Origin ≠ banco.com ✕', color: C.s6, nota: 'El banco compara la cabecera Origin con su propio dominio y detecta que la petición viene de evil.com.' }); m.push({ de: 1, a: 0, texto: '403 rechazada', color: C.s6, nota: 'La rechaza: el ataque falla.' }); return m; }
        if (est.token) { m.push({ de: 1, a: 1, texto: 'falta el token CSRF ✕', color: C.s6, nota: 'El formulario legítimo incluye un token secreto por sesión. evil.com no puede leerlo (política del mismo origen), así que no puede incluirlo.' }); m.push({ de: 1, a: 0, texto: '403 rechazada', color: C.s6, nota: 'Sin token válido, rechaza: el ataque falla.' }); return m; }
        m.push({ de: 1, a: 1, texto: 'cookie válida → transferir', color: C.s8, nota: 'El banco ve una cookie de sesión válida y asume que Ana pidió la transferencia.' });
        m.push({ de: 1, a: 0, texto: '200 transferencia hecha', color: C.s8, nota: 'El dinero se transfirió sin que Ana lo supiera. Eso es CSRF: la petición es «auténtica» pero no es intencional.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Atributo SameSite de la cookie', valor: est.samesite, opciones: [['none', 'None (sin protección)'], ['lax', 'Lax'], ['strict', 'Strict']], alCambiar: (v) => { est.samesite = v; reiniciar(); } });
        ctl.casillas([{ clave: 'token', texto: 'token anti-CSRF en el formulario', activo: false }, { clave: 'origin', texto: 'el servidor verifica la cabecera Origin', activo: false }], (e) => { est.token = e.token; est.origin = e.origin; reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'acción legítima' }, { color: C.s2, texto: 'trampa del atacante' }, { color: C.s8, texto: 'ataque exitoso' }, { color: C.s6, texto: 'ataque bloqueado' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['resultado', msgs[msgs.length - 1].color === C.s8 ? 'transferencia no autorizada' : 'ataque bloqueado'], ['defensas activas', String([est.samesite !== 'none', est.token, est.origin].filter(Boolean).length)]],
      nota: 'El atacante nunca ve la cookie: se aprovecha de que el navegador la adjunta <em>automáticamente</em>. Active una defensa a la vez y compare en qué paso se detiene.',
    });
  }

  /* ---------- Fig. 2: cuándo se envía la cookie según SameSite ---------- */

  const ESCENARIOS = [
    { t: 'Ana escribe banco.com en la barra de direcciones', cross: false, ataque: false, tipo: 'nav' },
    { t: 'Ana hace clic en un enlace a banco.com desde otro sitio (GET)', cross: true, ataque: false, tipo: 'nav-get' },
    { t: 'evil.com envía un formulario POST a banco.com', cross: true, ataque: true, tipo: 'post' },
    { t: 'evil.com carga <img src="banco.com/…"> o hace fetch a banco.com', cross: true, ataque: true, tipo: 'sub' },
    { t: 'una página de banco.com llama a su propia API', cross: false, ataque: false, tipo: 'mismo' },
  ];
  const envia = (modo, e) => (modo === 'none' ? true : modo === 'strict' ? !e.cross : e.tipo !== 'post' && e.tipo !== 'sub' ? true : !e.cross);

  function montarMatriz(cuerpo) {
    let modo = 'lax';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'SameSite de la cookie de sesión', valor: modo, opciones: [['none', 'None'], ['lax', 'Lax (valor por omisión de los navegadores)'], ['strict', 'Strict']], alCambiar: (v) => { modo = v; dibujar(); } });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una petición es «entre sitios» cuando se origina en una página de otro sitio. <code>Lax</code> permite la navegación segura (clic en un enlace) pero no los envíos POST ni las cargas ocultas.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      tabla.replaceChildren(el('tr', null, el('th', null, 'Situación'), el('th', null, '¿Entre sitios?'), el('th', null, '¿Se envía la cookie?'), el('th', null, 'Efecto')),
        ...ESCENARIOS.map((e) => {
          const s = envia(modo, e);
          const efecto = e.ataque ? (s ? 'ATAQUE POSIBLE' : 'ataque bloqueado') : (s ? 'funciona' : 'se pierde la sesión (usuario debe volver a iniciar)');
          return el('tr', null, el('td', null, e.t), el('td', null, e.cross ? 'sí' : 'no'), el('td', null, VIZ.ficha(s ? 'sí' : 'no', { color: s ? C.s2 : C.s1 })), el('td', null, VIZ.ficha(efecto, { color: e.ataque && s ? C.s8 : e.ataque ? C.s6 : s ? C.s6 : C.s2 })));
        }));
      const expuestos = ESCENARIOS.filter((e) => e.ataque && envia(modo, e)).length, perdidos = ESCENARIOS.filter((e) => !e.ataque && !envia(modo, e)).length;
      registro.textContent = modo === 'none' ? 'Con SameSite=None toda petición lleva la cookie: la página depende de otras defensas contra CSRF.' : modo === 'lax' ? 'Lax bloquea los envíos y cargas ocultas entre sitios, que son la vía clásica de CSRF, sin molestar al clic en enlaces.' : 'Strict es lo más seguro, pero hasta un clic desde un correo llega «sin sesión»: el usuario debe iniciarla otra vez.';
      lectura.set([['ataques posibles', `${expuestos} de ${ESCENARIOS.filter((e) => e.ataque).length}`], ['usos legítimos afectados', String(perdidos)], ['SameSite', modo]]);
    }
    dibujar();
  }

  VIZ.registrarTema('csrf-attack', {
    intro: String.raw`
      <p>Los navegadores adjuntan <strong>automáticamente</strong> las cookies de un sitio a cualquier petición que se le haga, sin importar qué página la originó. Un atacante puede aprovecharlo:
      si usted está conectado a su banco y visita una página maliciosa, esta puede hacer que su navegador envíe una petición al banco <em>con su cookie de sesión</em>.</p>
      <p>Eso es <strong>CSRF</strong> (<em>Cross-Site Request Forgery</em>): el atacante no roba la sesión, la <em>usa</em> sin que usted lo sepa. Afecta a las acciones que cambian datos.</p>`,
    visualizaciones: [
      { titulo: 'Un ataque CSRF y sus defensas', descripcion: 'Recorra el ataque contra un banco y active una defensa a la vez (SameSite, token anti-CSRF, verificación de Origin) para ver dónde se corta.', montar: montarAtaque },
      { titulo: 'Cuándo se envía la cookie según SameSite', descripcion: 'Cambie el valor de SameSite y compare cinco situaciones: cuáles permiten el ataque y cuáles dejan sin sesión al usuario legítimo.', montar: montarMatriz },
    ],
    teoria: String.raw`
      <h2>Condiciones del ataque</h2>
      <ol>
        <li>La víctima tiene una sesión activa (cookie) en el sitio objetivo.</li>
        <li>La acción se puede disparar con una petición predecible (sin un secreto desconocido para el atacante).</li>
        <li>El navegador adjunta la cookie aunque la petición venga de otro sitio.</li>
      </ol>
      <p>Romper cualquiera de las tres basta.</p>
      <h2>Defensas</h2>
      <table>
        <tr><th>Defensa</th><th>Cómo funciona</th></tr>
        <tr><td><code>SameSite=Lax/Strict</code></td><td>el navegador no envía la cookie en peticiones entre sitios (POST, subrecursos)</td></tr>
        <tr><td>Token anti-CSRF</td><td>un valor aleatorio por sesión, incluido en el formulario y verificado; el atacante no puede leerlo por la política del mismo origen</td></tr>
        <tr><td>Verificar <code>Origin</code> / <code>Referer</code></td><td>rechazar peticiones cuyo origen no sea el propio sitio</td></tr>
        <tr><td>Confirmación extra</td><td>reautenticación o segundo factor para acciones críticas</td></tr>
      </table>
      <p>Un token de \(n\) bits aleatorios puede adivinarse con probabilidad \(2^{-n}\): con 128 bits, inviable.</p>
      <h2>CSRF y XSS</h2>
      <p>No son lo mismo: CSRF <em>usa</em> la sesión sin leerla; <a href="tema.html?id=xss-injection">XSS</a> ejecuta código dentro del sitio y puede leer el token anti-CSRF, por lo que un XSS anula esta defensa.</p>
      <div class="recuadro">Las API que usan tokens en el encabezado <code>Authorization</code> (no en cookies) no sufren CSRF clásico, porque el navegador no los adjunta solo; pero guardan el token donde XSS puede leerlo. Ver <a href="tema.html?id=session-vs-token">sesiones frente a tokens</a> y <a href="tema.html?id=same-origin-cors">política del mismo origen</a>.</div>`,
  });
})();
