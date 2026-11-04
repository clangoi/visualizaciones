(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: verificar una cadena de certificados ---------- */

  const ESCENARIOS = {
    valido: { t: 'certificado correcto', ok: [1, 1, 1, 1, 1, 1] },
    expirado: { t: 'certificado vencido', ok: [1, 1, 0, 1, 1, 1] },
    nombre: { t: 'el nombre no coincide con el sitio', ok: [1, 1, 1, 0, 1, 1] },
    autofirmado: { t: 'autofirmado (sin entidad de confianza)', ok: [1, 1, 1, 1, 1, 0] },
    revocado: { t: 'revocado por robo de la clave', ok: [1, 1, 1, 1, 0, 1] },
    intermedio: { t: 'falta el certificado intermedio', ok: [1, 0, 1, 1, 1, 0] },
  };
  const COMPROBACIONES = ['La firma de la hoja se verifica con la clave del intermedio', 'La firma del intermedio se verifica con la clave de la raíz', 'Las fechas de validez incluyen hoy', 'El nombre del sitio está en el certificado', 'No figura en las listas de revocación', 'La raíz está en el almacén de confianza del sistema'];
  const FICHA = {
    raiz: { t: 'AC Raíz (en el almacén del sistema)', campos: ['Sujeto: AC Raíz Global', 'Emisor: AC Raíz Global (se firma a sí misma)', 'Válido: 2015 – 2040', 'Clave pública: RSA 4096 bits'] },
    inter: { t: 'AC Intermedia', campos: ['Sujeto: AC Intermedia 1', 'Emisor: AC Raíz Global', 'Válido: 2022 – 2032', 'Clave pública: RSA 2048 bits'] },
    hoja: { t: 'Certificado del sitio', campos: ['Sujeto: www.ejemplo.com', 'Emisor: AC Intermedia 1', 'Válido: 2026 – 2027', 'Clave pública: ECDSA P-256', 'Nombres alternativos: ejemplo.com, www.ejemplo.com'] },
  };

  function montarCadena(cuerpo) {
    let caso = 'valido', sel = 'hoja', cajas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', valor: caso, opciones: Object.entries(ESCENARIOS).map(([k, e]) => [k, e.t]), alCambiar: (v) => { caso = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 200 });
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'comprobación superada' }, { color: C.s8, texto: 'comprobación fallida' }, { color: C.s1, texto: 'certificado elegido (clic)' }]);
    const tabla = el('table', { class: 'tabla-datos texto' }), campos = el('pre', { class: 'codigo-bdd' });
    cuerpo.append(el('div', { class: 'caja-desplazable' }, tabla), campos);
    const registro = VIZ.registro(cuerpo, { grande: true });
    VIZ.nota(cuerpo, 'Haga clic en un certificado de la cadena para ver sus campos. El navegador confía en el sitio solo si <b>todas</b> las comprobaciones se cumplen.');
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const ok = ESCENARIOS[caso].ok, w = Math.min(190, Wd * 0.7), x = (Wd - w) / 2;
      const nodos = [['raiz', 'AC Raíz', 14, ok[5]], ['inter', caso === 'intermedio' ? 'AC Intermedia (falta)' : 'AC Intermedia', 76, ok[1]], ['hoja', 'www.ejemplo.com', 138, ok[2] && ok[3] && ok[4] && ok[0]]];
      cajas = [];
      nodos.forEach(([k, t, y, bien]) => {
        const falta = k === 'inter' && caso === 'intermedio', borde = bien ? C.s6 : C.s8;
        W.caja(ctx, x, y, w, 40, caso === 'autofirmado' && k === 'raiz' ? 'sin raíz conocida' : t, { borde: sel === k ? C.s1 : borde, relleno: sel === k ? VIZ.alfa(C.s1, 0.14) : VIZ.alfa(borde, 0.12), tam: 12, peso: 600, guiones: falta ? [4, 3] : null, grosor: sel === k ? 3 : 1.5 });
        cajas.push({ k, x, y, w, h: 40 });
      });
      [[14 + 40, 76], [76 + 40, 138]].forEach(([a, b]) => { VIZ.dist.flecha(ctx, Wd / 2, b, Wd / 2, a, { color: C.tinta2 }); });
      W.texto(ctx, 'firma a', Wd / 2 + 10, 62, { tam: 10, alinear: 'left', color: C.apagado }); W.texto(ctx, 'firma a', Wd / 2 + 10, 124, { tam: 10, alinear: 'left', color: C.apagado });
      tabla.replaceChildren(...COMPROBACIONES.map((c, i) => el('tr', null, el('td', null, c), el('td', null, VIZ.ficha(ok[i] ? 'OK' : 'FALLA', { color: ok[i] ? C.s6 : C.s8 })))));
      campos.textContent = `${FICHA[sel].t}\n${FICHA[sel].campos.map((x) => '  ' + x).join('\n')}`;
      const todos = ok.every(Boolean);
      registro.textContent = todos ? 'Todas las comprobaciones pasan: el candado aparece y la conexión continúa.' : `Falla: «${COMPROBACIONES[ok.indexOf(0)]}». El navegador muestra una advertencia de seguridad.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev); const c = cajas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (c) { sel = c.k; dibujar(); } });
    dibujar();
  }

  /* ---------- Fig. 2: hombre en el medio ---------- */

  function montarMitm(cuerpo) {
    const est = { ignora: false, confiaCa: false };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Navegador' }, { nombre: 'Atacante' }, { nombre: 'banco.com' }],
      mensajes: () => {
        const m = [
          { de: 0, a: 1, texto: 'ClientHello (banco.com)', color: C.s1, nota: 'Ana intenta abrir banco.com desde una red WiFi controlada por un atacante, que intercepta la conexión.' },
          { de: 1, a: 0, texto: 'su propio certificado', color: C.s8, nota: 'El atacante responde presentando un certificado que él mismo generó, haciéndose pasar por banco.com.' },
        ];
        if (est.confiaCa) { m.push({ de: 0, a: 0, texto: 'cadena válida ✓ (raíz instalada)', color: C.s8, nota: 'El certificado fue emitido por una raíz que el atacante logró instalar en el equipo (por ejemplo, con malware): el navegador no tiene cómo detectar la trampa.' }); } else {
          m.push({ de: 0, a: 0, texto: 'cadena inválida ✕', color: C.s6, nota: 'El navegador comprueba la cadena: no termina en una entidad de confianza ni el nombre coincide con banco.com.' });
          if (!est.ignora) { m.push({ de: 0, a: 0, texto: 'ADVERTENCIA: conexión no privada', color: C.s6, nota: 'El navegador detiene la conexión y muestra una pantalla de advertencia. El ataque falla.' }); return m; }
          m.push({ de: 0, a: 0, texto: 'el usuario pulsa «continuar»', color: C.s8, nota: 'Ana ignora la advertencia y acepta de todos modos.' });
        }
        m.push({ de: 0, a: 1, texto: 'clave + datos cifrados (usuario, clave)', color: C.s8, nota: 'El navegador cifra con la clave acordada con el atacante, pensando que habla con el banco.' });
        m.push({ de: 1, a: 1, texto: 'descifra y lee las credenciales', color: C.s8, nota: 'El atacante lee todo. Luego puede reenviarlo al banco real para que Ana no note nada.' });
        m.push({ de: 1, a: 2, texto: 'reenvía con otra conexión TLS', color: C.s8, nota: 'Mantiene dos conexiones cifradas: una con la víctima y otra con el banco, y ve todo lo que pasa entre ellas.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.casillas([{ clave: 'ignora', texto: 'el usuario ignora la advertencia', activo: false }, { clave: 'confiaCa', texto: 'el atacante instaló su propia raíz en el equipo', activo: false }], (e) => { Object.assign(est, e); reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'petición legítima' }, { color: C.s8, texto: 'acción del atacante' }, { color: C.s6, texto: 'defensa que funciona' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['el atacante lee la sesión', msgs.some((x) => /descifra/.test(x.texto)) ? 'sí' : 'no'], ['depende de', est.confiaCa ? 'una raíz instalada' : est.ignora ? 'la decisión del usuario' : 'nada: se bloquea']],
      nota: 'Los certificados convierten «el servidor dice ser banco.com» en una afirmación verificable. Sin ellos, el cifrado protegería los datos… pero de cara a la persona equivocada.',
    });
  }

  VIZ.registrarTema('digital-certificates', {
    intro: String.raw`
      <p>El cifrado asegura que nadie lea un mensaje, pero no responde a una pregunta previa: <em>¿con quién estoy hablando de verdad?</em> Un atacante puede interponerse y presentarse como su banco.</p>
      <p>Un <strong>certificado digital</strong> responde con una cadena de confianza: el servidor presenta su clave pública junto con una firma de una <strong>entidad certificadora</strong> (AC) que garantiza que esa clave pertenece a ese nombre; esa AC a su vez está firmada por otra, hasta llegar a una <em>raíz</em> que su navegador ya conoce.</p>`,
    visualizaciones: [
      { titulo: 'Verificación de la cadena de confianza', descripcion: 'Elija escenarios (vencido, nombre incorrecto, autofirmado, revocado…) y vea qué comprobación falla. Haga clic en cada certificado para ver sus campos.', montar: montarCadena },
      { titulo: 'Qué impide el hombre en el medio', descripcion: 'Siga a un atacante que presenta su propio certificado. Compare lo que ocurre si el usuario ignora la advertencia o si el atacante instaló una raíz.', montar: montarMitm },
    ],
    teoria: String.raw`
      <h2>Qué contiene un certificado</h2>
      <ul>
        <li><strong>Sujeto</strong> (el nombre del sitio, y nombres alternativos), <strong>clave pública</strong> del sujeto.</li>
        <li><strong>Emisor</strong> y <strong>firma digital</strong> del emisor sobre todo lo anterior.</li>
        <li><strong>Período de validez</strong> (desde, hasta) y usos permitidos.</li>
      </ul>
      <h2>Validación</h2>
      <pre><code>validar(cadena, nombre):
    para cada certificado c en la cadena (hoja → raíz):
        verificar firma(c) con la clave pública del emisor
        verificar fechas y que no esté revocado
    verificar que la raíz esté en el almacén de confianza
    verificar que «nombre» esté en el sujeto o nombres alternativos de la hoja</code></pre>
      <p>Una firma digital sobre el resumen \(H(c)\) se verifica con \(\text{Verif}_{\text{pub}}(H(c), s)\): solo quien tiene la clave privada del emisor pudo producirla (<a href="tema.html?id=symmetric-asymmetric-crypto">RSA y firma</a>). Si la cadena tiene \(k\) eslabones, se hacen \(k\) verificaciones, y basta que una falle para rechazar todo.</p>
      <h2>Revocación y emisión</h2>
      <p>Si se roba una clave privada, el certificado se <em>revoca</em> y el navegador lo consulta en una lista (CRL) o servicio en línea (OCSP). Las AC emiten certificados tras comprobar que el solicitante controla el dominio (p. ej. con Let's Encrypt, de forma automática y gratuita). Los certificados duran cada vez menos (meses) para acotar el daño.</p>
      <div class="recuadro">Un certificado válido prueba <em>quién</em> es el servidor, no que sea <em>honesto</em>: un sitio de phishing puede tener un certificado perfecto para su propio dominio. El candado dice «la conexión es privada», no «el sitio es confiable». Vea el saludo completo en <a href="tema.html?id=tls-handshake">TLS</a>.</div>`,
  });
})();
