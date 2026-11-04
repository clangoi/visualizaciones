(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: una API REST en memoria ---------- */

  const INICIAL = () => [{ id: 1, titulo: 'Estudiar HTTP', hecha: true }, { id: 2, titulo: 'Probar la API', hecha: false }, { id: 3, titulo: 'Escribir pruebas', hecha: false }];
  const ACCIONES = {
    'GET /tareas': { m: 'GET', ruta: 'colección', crud: 'Read (listar)' }, 'GET /tareas/:id': { m: 'GET', ruta: 'elemento', crud: 'Read (uno)' },
    'POST /tareas': { m: 'POST', ruta: 'colección', crud: 'Create' }, 'PUT /tareas/:id': { m: 'PUT', ruta: 'elemento', crud: 'Update (reemplazo)' },
    'PATCH /tareas/:id': { m: 'PATCH', ruta: 'elemento', crud: 'Update (parcial)' }, 'DELETE /tareas/:id': { m: 'DELETE', ruta: 'elemento', crud: 'Delete' },
  };

  function montarApi(cuerpo) {
    let accion = 'GET /tareas', id = 2, datos = INICIAL(), sig = 4, ultimo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Endpoint', valor: accion, opciones: Object.keys(ACCIONES).map((k) => [k, k]), alCambiar: (v) => { accion = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Valor de :id', valor: String(id), opciones: [['1', '1'], ['2', '2'], ['3', '3'], ['9', '9 (no existe)']], alCambiar: (v) => { id = +v; dibujar(); } });
    ctl.boton('Enviar petición', () => enviar(), { primario: true });
    ctl.boton('Restablecer datos', () => { datos = INICIAL(); sig = 4; ultimo = null; dibujar(); });
    const dos = el('div', { class: 'dos-columnas' });
    const tabla = el('table', { class: 'tabla-datos texto' }), resp = el('pre', { class: 'codigo-bdd' });
    dos.append(el('div', null, el('p', { class: 'subtitulo-viz' }, 'Estado del servidor (tabla tareas)'), el('div', { class: 'caja-desplazable' }, tabla)), el('div', null, el('p', { class: 'subtitulo-viz' }, 'Última respuesta'), resp));
    cuerpo.appendChild(dos);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un endpoint y pulse «Enviar». Observe cómo cambia la tabla con cada operación CRUD y qué código de estado devuelve la API.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';

    function enviar() {
      const a = ACCIONES[accion], uno = a.ruta === 'elemento', t = datos.find((x) => x.id === id);
      let est, cu, nota;
      if (uno && !t) { est = [404, 'Not Found']; cu = '{ "error": "tarea no encontrada" }'; nota = `No existe una tarea con id ${id}: 404.`; } else if (a.m === 'GET') { est = [200, 'OK']; cu = JSON.stringify(uno ? t : datos, null, 1).replace(/\n\s*/g, ' '); nota = uno ? 'GET sobre un elemento: 200 y el recurso.' : 'GET sobre la colección: 200 y la lista.'; } else if (a.m === 'POST') { const n = { id: sig++, titulo: `Tarea nueva ${sig - 1}`, hecha: false }; datos.push(n); est = [201, 'Created']; cu = JSON.stringify(n); nota = 'POST crea un recurso nuevo: 201 Created con su representación (y Location: /tareas/' + n.id + ').'; } else if (a.m === 'PUT') { Object.assign(t, { titulo: 'Reemplazada', hecha: true }); est = [200, 'OK']; cu = JSON.stringify(t); nota = 'PUT reemplaza TODO el recurso con la representación enviada.'; } else if (a.m === 'PATCH') { t.hecha = !t.hecha; est = [200, 'OK']; cu = JSON.stringify(t); nota = 'PATCH modifica solo un campo: aquí, alterna «hecha».'; } else { datos = datos.filter((x) => x.id !== id); est = [204, 'No Content']; cu = ''; nota = 'DELETE elimina el recurso: 204 sin cuerpo. Repetirlo daría 404: la operación es idempotente en efecto, no en código.'; }
      ultimo = { est, cu, nota, accion: `${a.m} ${a.ruta === 'elemento' ? `/tareas/${id}` : '/tareas'}` };
      dibujar();
    }
    function dibujar() {
      tabla.replaceChildren(el('tr', null, el('th', null, 'id'), el('th', null, 'titulo'), el('th', null, 'hecha')), ...datos.map((t) => el('tr', { class: ultimo && ultimo.est[0] < 300 && ultimo.cu.includes(`"id":${t.id}`) ? 'activa' : null }, el('td', null, t.id), el('td', null, t.titulo), el('td', null, t.hecha ? 'sí' : 'no'))));
      const col = ultimo ? (ultimo.est[0] < 300 ? C.s6 : C.s2) : C.inactivo;
      resp.replaceChildren(ultimo ? el('span', { class: 'dato', style: { background: VIZ.alfa(col, 0.3) } }, `${ultimo.est[0]} ${ultimo.est[1]}`) : 'Aún no se envió ninguna petición.', ultimo ? `\n${ultimo.accion}\n${ultimo.cu}` : '');
      const a = ACCIONES[accion];
      registro.textContent = ultimo ? ultimo.nota : `Seleccionado: ${accion} → operación CRUD «${a.crud}».`;
      lectura.set([['operación CRUD', a.crud], ['recurso', a.ruta], ['filas en la tabla', String(datos.length)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: diseñe los endpoints ---------- */

  const TAREAS = [
    ['Listar todos los usuarios', 'GET', '/usuarios'], ['Ver el usuario 3', 'GET', '/usuarios/3'], ['Registrar un usuario nuevo', 'POST', '/usuarios'],
    ['Cambiar solo el correo del usuario 3', 'PATCH', '/usuarios/3'], ['Eliminar el usuario 3', 'DELETE', '/usuarios/3'], ['Listar los pedidos del usuario 3', 'GET', '/usuarios/3/pedidos'],
  ];
  const RUTAS = ['/usuarios', '/usuarios/3', '/usuarios/3/pedidos', '/obtenerUsuario?id=3', '/crearUsuario', '/usuarios/borrar/3'];

  function montarDiseno(cuerpo) {
    let resp = {}, comprobado = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Comprobar', () => { comprobado = true; dibujar(); }, { primario: true });
    ctl.boton('Borrar respuestas', () => { resp = {}; comprobado = false; dibujar(); });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'En REST los <b>recursos son sustantivos en plural</b> (<code>/usuarios</code>) y el <b>verbo</b> lo pone el método HTTP; evite verbos en la URL (<code>/crearUsuario</code>).');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      tabla.replaceChildren(el('tr', null, el('th', null, 'Qué se quiere hacer'), el('th', null, 'Método'), el('th', null, 'Ruta'), el('th', null, '')),
        ...TAREAS.map(([t, m, r], i) => {
          const sm = el('select', null, el('option', { value: '' }, '—'), ...['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((x) => el('option', { value: x }, x)));
          const sr = el('select', null, el('option', { value: '' }, '—'), ...RUTAS.map((x) => el('option', { value: x }, x)));
          sm.value = (resp[i] || {}).m || ''; sr.value = (resp[i] || {}).r || '';
          const cambia = () => { resp[i] = { m: sm.value, r: sr.value }; comprobado = false; dibujar(); };
          sm.addEventListener('change', cambia); sr.addEventListener('change', cambia);
          const ok = resp[i] && resp[i].m === m && resp[i].r === r;
          return el('tr', null, el('td', null, t), el('td', null, sm), el('td', null, sr), el('td', null, comprobado && resp[i] ? VIZ.ficha(ok ? 'correcto' : `${m} ${r}`, { color: ok ? C.s6 : C.s8 }) : ''));
        }));
      const ok = TAREAS.filter((t, i) => resp[i] && resp[i].m === t[1] && resp[i].r === t[2]).length;
      registro.textContent = comprobado ? `Acertó ${ok} de ${TAREAS.length}.` : 'Elija el método y la ruta de cada operación.';
    }
    dibujar();
  }

  /* ---------- Fig. 3: fetch y sus estados ---------- */

  const RESULTADOS = { '200': ['200 OK', C.s6], '404': ['404 Not Found', C.s2], '500': ['500 Server Error', C.s8], red: ['sin conexión', C.s8] };
  function montarFetch(cuerpo) {
    let caso = '200', comprobarOk = false;
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Tu código' }, { nombre: 'fetch()' }, { nombre: 'Servidor' }],
      mensajes: () => {
        const m = [{ de: 0, a: 1, texto: 'await fetch(url)', color: C.s1, nota: 'El código pide los datos; el estado de la interfaz pasa a «cargando».' }, { de: 1, a: 2, texto: 'GET /api/tareas', color: C.s1, nota: 'fetch envía la petición HTTP.' }];
        if (caso === 'red') { m.push({ de: 2, a: 2, texto: 'sin respuesta ✕', color: C.s8, nota: 'La red falla: no hay respuesta.' }); m.push({ de: 1, a: 0, texto: 'rechaza → catch', color: C.s8, nota: 'Solo un fallo de red hace que la promesa de fetch se RECHACE.' }); return m; }
        m.push({ de: 2, a: 1, texto: RESULTADOS[caso][0], color: RESULTADOS[caso][1], nota: `El servidor respondió ${RESULTADOS[caso][0]}.` });
        m.push({ de: 1, a: 0, texto: 'promesa cumplida', color: C.s6, nota: caso === '200' ? 'La promesa se cumple con un objeto Response.' : `¡Atención! Aunque el estado es ${caso}, fetch cumple la promesa: HTTP respondió, aunque sea con error.` });
        if (comprobarOk && caso !== '200') m.push({ de: 0, a: 0, texto: 'if (!res.ok) throw …', color: C.s8, nota: 'El código revisa res.ok (verdadero solo entre 200 y 299) y lanza el error a mano.' });
        else m.push({ de: 0, a: 0, texto: 'await res.json()', color: caso === '200' ? C.s6 : C.s8, nota: caso === '200' ? 'Se interpreta el cuerpo y se muestra la lista.' : 'Sin revisar res.ok, el código intenta leer un cuerpo de error como si fueran datos: error silencioso o mensaje confuso.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Respuesta del servidor', valor: caso, opciones: Object.entries(RESULTADOS).map(([k, v]) => [k, v[0]]), alCambiar: (v) => { caso = v; reiniciar(); } });
        ctl.casilla({ etiqueta: 'el código revisa response.ok', valor: false, alCambiar: (v) => { comprobarOk = v; reiniciar(); } });
      },
      leyenda: [{ color: C.s1, texto: 'petición' }, { color: C.s6, texto: 'éxito' }, { color: C.s2, texto: 'error del cliente' }, { color: C.s8, texto: 'error' }],
      lectura: (hasta) => [['paso', String(Math.max(0, hasta + 1))], ['¿rechaza la promesa?', caso === 'red' ? 'sí' : 'no'], ['res.ok', caso === '200' ? 'true' : caso === 'red' ? '—' : 'false']],
      nota: 'Trampa clásica: <code>fetch</code> no lanza error ante un 404 o un 500. Hay que comprobar <code>response.ok</code> (o el estado) explícitamente.',
    });
  }

  VIZ.registrarTema('rest-api-crud', {
    intro: String.raw`
      <p>Una <strong>API REST</strong> expone los datos de un servidor como <em>recursos</em> identificados por URL (<code>/tareas</code>, <code>/tareas/2</code>) y los manipula con los
      métodos HTTP. Las cuatro operaciones básicas de los datos, <strong>CRUD</strong> (crear, leer, actualizar, eliminar), se corresponden con <code>POST</code>, <code>GET</code>, <code>PUT/PATCH</code> y <code>DELETE</code>.</p>
      <p>El cliente (una página con <code>fetch</code>, una app móvil, otro servidor) no necesita saber cómo está hecho el servidor: solo el contrato de la API.</p>`,
    visualizaciones: [
      { titulo: 'Una API REST con CRUD', descripcion: 'Envíe cada tipo de petición sobre la colección o un elemento, incluso uno que no existe, y observe el estado devuelto y el cambio en la tabla.', montar: montarApi },
      { titulo: 'Diseñe los endpoints', descripcion: 'Asigne método y ruta a seis operaciones sobre usuarios y pedidos y compruebe si sigue las convenciones REST.', montar: montarDiseno },
      { titulo: 'Consumir una API con fetch', descripcion: 'Pruebe respuestas 200, 404, 500 y una caída de red, con y sin <code>response.ok</code>: ¿cuándo se rechaza la promesa?', montar: montarFetch },
    ],
    teoria: String.raw`
      <h2>Principios REST</h2>
      <ul>
        <li><strong>Recursos</strong> con identificador propio (URL) y una o varias representaciones (normalmente JSON).</li>
        <li><strong>Interfaz uniforme</strong>: los mismos métodos HTTP con el mismo significado en todos los recursos.</li>
        <li><strong>Sin estado</strong> (<em>stateless</em>): cada petición lleva todo lo necesario (por ejemplo, el token); el servidor no recuerda la anterior.</li>
        <li><strong>Cliente-servidor</strong> separados y <strong>cacheables</strong> cuando es posible.</li>
      </ul>
      <h2>CRUD y HTTP</h2>
      <table>
        <tr><th>Operación</th><th>Método y ruta</th><th>Éxito</th></tr>
        <tr><td>Crear</td><td><code>POST /tareas</code></td><td>201 + <code>Location</code></td></tr>
        <tr><td>Leer lista / uno</td><td><code>GET /tareas</code> · <code>GET /tareas/2</code></td><td>200</td></tr>
        <tr><td>Reemplazar / modificar</td><td><code>PUT</code> · <code>PATCH /tareas/2</code></td><td>200</td></tr>
        <tr><td>Eliminar</td><td><code>DELETE /tareas/2</code></td><td>204</td></tr>
      </table>
      <p>Errores: 400/422 (datos inválidos), 401/403 (autenticación/permisos), 404 (no existe), 409 (conflicto), 5xx (falla del servidor), según la <a href="tema.html?id=http-messages">tabla de códigos HTTP</a>.</p>
      <h2>Consumir una API</h2>
      <pre><code>const res = await fetch("/api/tareas", { headers: { Accept: "application/json" } });
if (!res.ok) throw new Error("HTTP " + res.status);   // fetch NO lo hace solo
const tareas = await res.json();</code></pre>
      <p>El <em>contrato</em> se documenta (por ejemplo con OpenAPI): rutas, parámetros, cuerpos y códigos de respuesta, de modo que el cliente pueda probarse sin el servidor real.</p>
      <div class="recuadro">REST no es un protocolo sino un estilo; muchas «APIs REST» solo cumplen algunas restricciones. Para filtrar y paginar colecciones, vea <a href="tema.html?id=routing-params">rutas y parámetros</a>; para asegurar el acceso, <a href="tema.html?id=session-vs-token">sesiones frente a tokens</a>.</div>`,
  });
})();
