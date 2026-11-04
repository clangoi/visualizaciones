(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: cómo conversan las partes de una extensión ---------- */

  const ESCENARIOS = {
    resaltar: { t: 'resaltar palabras en la página (clic en el icono)', msgs: [
      { de: 0, a: 1, texto: 'runtime.sendMessage("resaltar")', color: C.s1, nota: 'El usuario hace clic en el icono y el popup (una pequeña página HTML de la extensión) pide la acción al service worker.' },
      { de: 1, a: 1, texto: 'busca la pestaña activa', color: C.s2, nota: 'El service worker (background) puede usar las APIs de la extensión: chrome.tabs, chrome.storage…' },
      { de: 1, a: 2, texto: 'tabs.sendMessage(id, "resaltar")', color: C.s2, nota: 'Reenvía la orden al content script de esa pestaña.' },
      { de: 2, a: 3, texto: 'modifica el DOM', color: C.s6, nota: 'El content script vive en la página: puede leer y cambiar su DOM, pero solo ve un «mundo aislado» de JavaScript.' },
      { de: 2, a: 1, texto: 'respuesta: 12 coincidencias', color: C.s6, nota: 'Devuelve el resultado al background.' },
      { de: 1, a: 0, texto: 'respuesta al popup', color: C.s6, nota: 'El popup muestra «12 palabras resaltadas».' },
    ] },
    guardar: { t: 'guardar una preferencia', msgs: [
      { de: 0, a: 0, texto: 'el usuario cambia la opción', color: C.s1, nota: 'En el popup, el usuario activa una opción.' },
      { de: 0, a: 1, texto: 'storage.sync.set({ modo })', color: C.s2, nota: 'Se guarda con la API de la extensión (permiso «storage»); queda disponible en todos los dispositivos con la misma cuenta.' },
      { de: 1, a: 2, texto: 'storage.onChanged', color: C.s2, nota: 'Cualquier parte de la extensión puede suscribirse a los cambios.' },
      { de: 2, a: 3, texto: 'aplica el modo en la página', color: C.s6, nota: 'El content script actualiza la página según la nueva preferencia.' },
    ] },
    bloquear: { t: 'reaccionar a una petición de red', msgs: [
      { de: 3, a: 1, texto: 'la página pide un recurso', color: C.s1, nota: 'La página intenta cargar, por ejemplo, un script de seguimiento.' },
      { de: 1, a: 1, texto: 'declarativeNetRequest: ¿coincide con una regla?', color: C.s2, nota: 'En Manifest V3 las reglas de bloqueo se declaran de antemano; el navegador las aplica sin entregar la petición al código de la extensión (más privado y rápido).' },
      { de: 1, a: 3, texto: 'petición bloqueada', color: C.s8, nota: 'El recurso no se descarga.' },
      { de: 1, a: 0, texto: 'badge: 1 bloqueado', color: C.s6, nota: 'La extensión actualiza el contador del icono.' },
    ] },
  };

  function montarMensajes(cuerpo) {
    let caso = 'resaltar';
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Popup' }, { nombre: 'Background' }, { nombre: 'Content' }, { nombre: 'Página' }],
      mensajes: () => ESCENARIOS[caso].msgs,
      controles(ctl, reiniciar) { ctl.selector({ etiqueta: 'Escenario', valor: caso, opciones: Object.entries(ESCENARIOS).map(([k, e]) => [k, e.t]), alCambiar: (v) => { caso = v; reiniciar(); } }); },
      leyenda: [{ color: C.s1, texto: 'iniciativa del usuario o de la página' }, { color: C.s2, texto: 'API de la extensión' }, { color: C.s6, texto: 'resultado' }, { color: C.s8, texto: 'bloqueo' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['partes que intervienen', String(new Set(msgs.flatMap((m) => [m.de, m.a])).size)], ['mundo de ejecución', hasta >= 0 && msgs[hasta].a === 2 ? 'contenido (aislado)' : 'extensión']],
      nota: 'Cada parte vive en un contexto distinto y solo se comunican con mensajes: el popup y el service worker, con las APIs; el content script, con el DOM de la página.',
    });
  }

  /* ---------- Fig. 2: manifest, permisos y patrones de coincidencia ---------- */

  const PERMISOS = [
    { k: 'activeTab', riesgo: 1, que: 'accede a la pestaña actual solo cuando el usuario pulsa el icono' },
    { k: 'storage', riesgo: 1, que: 'guarda datos de la extensión' },
    { k: 'downloads', riesgo: 2, que: 'inicia y administra descargas' },
    { k: 'tabs', riesgo: 3, que: 'lee la URL y el título de todas las pestañas' },
    { k: 'history', riesgo: 4, que: 'lee y borra el historial de navegación' },
    { k: 'cookies', riesgo: 4, que: 'lee y escribe las cookies de los sitios permitidos' },
    { k: '<all_urls>', riesgo: 5, que: 'lee y modifica TODOS los sitios que visita', host: true },
  ];
  const URLS = ['https://ejemplo.com/', 'https://www.ejemplo.com/ruta', 'http://www.ejemplo.com/', 'https://api.ejemplo.com/v1/datos?x=1', 'https://otro.com/ejemplo.com/', 'ftp://ejemplo.com/'];
  function patron(p) {
    if (p === '<all_urls>') return /^(https?|ftp|file):\/\//;
    const m = /^(\*|https?|ftp):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/.exec(p.trim());
    if (!m) return null;
    const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const esquema = m[1] === '*' ? 'https?' : esc(m[1]);
    const host = m[2] === '*' ? '[^/]+' : m[2].startsWith('*.') ? `([^/]+\\.)?${esc(m[2].slice(2))}` : esc(m[2]);
    return new RegExp(`^${esquema}://${host}${esc(m[3]).replace(/\\\*/g, '.*')}$`);
  }

  function montarManifest(cuerpo) {
    const sel = new Set(['activeTab', 'storage']);
    let pat = 'https://*.ejemplo.com/*';
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(PERMISOS.map((p) => ({ clave: p.k, texto: p.k, activo: sel.has(p.k) })), (e) => { sel.clear(); Object.entries(e).forEach(([k, v]) => { if (v) sel.add(k); }); dibujar(); });
    ctl.texto({ etiqueta: 'Patrón del content script (matches)', valor: pat, alCambiar: (v) => { pat = v; dibujar(); }, alEnter: (v) => { pat = v; dibujar(); } });
    const manifest = el('pre', { class: 'codigo-bdd' }), tabla = el('table', { class: 'tabla-datos texto' }), aviso = el('div', { class: 'fichas' });
    cuerpo.append(manifest, aviso, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Principio de mínimo privilegio: pida solo los permisos que necesita. Pruebe patrones como <code>*://*/*</code>, <code>https://www.ejemplo.com/ruta*</code> o <code>&lt;all_urls&gt;</code>.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const lista = PERMISOS.filter((p) => sel.has(p.k)), perm = lista.filter((p) => !p.host).map((p) => p.k), host = lista.filter((p) => p.host).map((p) => p.k);
      manifest.textContent = JSON.stringify({ manifest_version: 3, name: 'Mi extensión', version: '1.0', permissions: perm, ...(host.length ? { host_permissions: host } : {}), background: { service_worker: 'background.js' }, content_scripts: [{ matches: [pat], js: ['content.js'] }], action: { default_popup: 'popup.html' } }, null, 2);
      const riesgo = lista.reduce((s, p) => s + p.riesgo, 0), nivel = riesgo >= 9 ? 'ALTO' : riesgo >= 4 ? 'MEDIO' : 'BAJO', col = nivel === 'ALTO' ? C.s8 : nivel === 'MEDIO' ? C.s2 : C.s6;
      aviso.replaceChildren(el('span', { class: 'fichas-titulo' }, 'Lo que vería el usuario al instalarla:'), ...(lista.length ? lista.map((p) => VIZ.ficha(p.que, { color: p.riesgo >= 4 ? C.s8 : p.riesgo >= 3 ? C.s2 : C.s6 })) : [VIZ.ficha('sin permisos especiales', { color: C.s6 })]), VIZ.ficha(`riesgo ${nivel}`, { color: col, fondo: VIZ.alfa(col, 0.2) }));
      const re = patron(pat);
      tabla.replaceChildren(el('tr', null, el('th', null, 'Página visitada'), el('th', null, '¿Se inyecta el content script?')),
        ...URLS.map((u) => { const ok = re ? re.test(u) : false; return el('tr', null, el('td', null, u), el('td', null, re ? VIZ.ficha(ok ? 'sí' : 'no', { color: ok ? C.s6 : C.inactivo }) : VIZ.ficha('patrón inválido', { color: C.s8 }))); }));
      const coincide = re ? URLS.filter((u) => re.test(u)).length : 0;
      registro.textContent = !re ? 'El patrón no es válido: debe tener la forma esquema://host/ruta, con * como comodín.' : sel.has('<all_urls>') || pat.trim() === '<all_urls>' || pat.trim() === '*://*/*' ? 'Con permisos sobre todos los sitios, un fallo o abuso de la extensión expone toda la navegación: es el caso de mayor riesgo.' : `El content script se inyecta en ${coincide} de las ${URLS.length} páginas de ejemplo.`;
      lectura.set([['permisos pedidos', String(lista.length)], ['riesgo acumulado', `${riesgo} (${nivel})`], ['páginas donde actúa', re ? `${coincide} de ${URLS.length}` : '—']]);
    }
    dibujar();
  }

  VIZ.registrarTema('browser-extensions', {
    intro: String.raw`
      <p>Una <strong>extensión de navegador</strong> es un pequeño programa web que añade funciones al navegador: bloquear anuncios, gestionar contraseñas, traducir, resaltar texto. Se construye con HTML, CSS y JavaScript,
      más un archivo <code>manifest.json</code> que declara qué es, qué partes tiene y qué permisos pide.</p>
      <p>Sus partes viven en contextos separados: el <strong>service worker</strong> (<em>background</em>) reacciona a eventos y usa las APIs del navegador; el <strong>popup</strong> es su pequeña interfaz; y los <strong>content scripts</strong> se inyectan en las páginas para leer y modificar su DOM.</p>`,
    visualizaciones: [
      { titulo: 'Mensajes entre las partes', descripcion: 'Recorra tres escenarios y vea qué parte inicia cada acción y cuál puede tocar la página o las APIs del navegador.', montar: montarMensajes },
      { titulo: 'Manifest, permisos y patrones', descripcion: 'Marque permisos y edite el patrón de coincidencia: vea el manifest resultante, el riesgo que percibiría el usuario y en qué páginas se inyecta el script.', montar: montarManifest },
    ],
    teoria: String.raw`
      <h2>Arquitectura</h2>
      <pre><code>manifest.json           declara: nombre, versión, permisos, scripts
background.js           service worker: eventos, alarmas, red, almacenamiento
popup.html + popup.js   interfaz al pulsar el icono
content.js              se inyecta en las páginas que coincidan con «matches»
                        ── mensajes (runtime.sendMessage / tabs.sendMessage) ──</code></pre>
      <ul>
        <li>El <em>service worker</em> no tiene DOM y se suspende cuando no hay eventos; no debe guardar estado solo en memoria.</li>
        <li>Un <em>content script</em> ve el DOM de la página pero ejecuta en un «mundo aislado»: sus variables no chocan con las de la página.</li>
        <li>Las partes solo se comunican por <strong>paso de mensajes</strong> serializables.</li>
      </ul>
      <h2>Permisos y patrones</h2>
      <p>Un patrón de coincidencia tiene la forma <code>esquema://host/ruta</code>, con <code>*</code> como comodín: <code>https://*.ejemplo.com/*</code> cubre el dominio y todos sus subdominios. Cuanto más amplio el patrón y más permisos, mayor es el daño potencial si la extensión es maliciosa o se compromete. Con \(p\) permisos de riesgo \(r_i\), el riesgo agregado crece al menos como \(\sum_i r_i\), por lo que conviene aplicar el <strong>mínimo privilegio</strong>.</p>
      <h2>Manifest V3</h2>
      <p>La versión actual reemplaza las páginas de fondo persistentes por service workers, exige que el código esté empaquetado (nada se carga remotamente) y sustituye el bloqueo programático de peticiones por reglas declarativas (<code>declarativeNetRequest</code>).</p>
      <div class="recuadro">Una extensión es una aplicación web con privilegios especiales, así que hereda sus riesgos (<a href="tema.html?id=xss-injection">inyección</a>, <a href="tema.html?id=same-origin-cors">política del mismo origen</a>) y los suyos: robo de datos de navegación. Las herramientas del propio navegador para depurarlas son parte del <a href="tema.html?id=web-roles-ecosystem">ecosistema de desarrollo</a>.</div>`,
  });
})();
