(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: recorrido de una petición por MVC ---------- */

  const CASOS = {
    lista: { t: 'GET /productos', msgs: (v) => [
      { de: 0, a: 1, texto: 'GET /productos', color: C.s1, nota: 'El cliente envía la petición. El enrutador decide qué controlador la atiende.' },
      { de: 1, a: 2, texto: 'listar()', color: C.s2, nota: 'La ruta coincide con ProductosController.listar().' },
      { de: 2, a: 3, texto: 'Producto.findAll()', color: C.s3, nota: 'El controlador no sabe cómo se guardan los datos: se los pide al modelo.' },
      { de: 3, a: 2, texto: '[ {id:1…}, {id:7…} ]', color: C.s3, nota: 'El modelo consulta la base de datos y devuelve objetos del dominio.' },
      { de: 2, a: 4, texto: 'render(productos)', color: C.s7, nota: 'El controlador entrega los datos a la vista, que decide cómo mostrarlos.' },
      { de: 4, a: 0, texto: v === 'json' ? '200 JSON' : '200 HTML', color: C.s6, nota: `La vista da formato (${v === 'json' ? 'JSON para una API' : 'HTML para un navegador'}) y la respuesta vuelve al cliente.` },
    ] },
    uno: { t: 'GET /productos/7', msgs: (v) => [
      { de: 0, a: 1, texto: 'GET /productos/7', color: C.s1, nota: 'El enrutador extrae el parámetro id = 7 de la ruta.' },
      { de: 1, a: 2, texto: 'mostrar(id=7)', color: C.s2, nota: 'Se invoca ProductosController.mostrar con el id.' },
      { de: 2, a: 3, texto: 'Producto.findByPk(7)', color: C.s3, nota: 'El modelo busca un solo registro por clave primaria.' },
      { de: 3, a: 2, texto: '{ id:7, … }', color: C.s3, nota: 'El modelo devuelve el producto.' },
      { de: 2, a: 4, texto: 'render(producto)', color: C.s7, nota: 'El controlador pasa el producto a la vista.' },
      { de: 4, a: 0, texto: v === 'json' ? '200 JSON' : '200 HTML', color: C.s6, nota: 'La vista genera la respuesta.' },
    ] },
    crear: { t: 'POST /productos (datos válidos)', msgs: (v) => [
      { de: 0, a: 1, texto: 'POST /productos', color: C.s1, nota: 'El cliente envía los datos del nuevo producto en el cuerpo.' },
      { de: 1, a: 2, texto: 'crear(body)', color: C.s2, nota: 'El controlador recibe el cuerpo ya interpretado.' },
      { de: 2, a: 3, texto: 'Producto.create(body)', color: C.s3, nota: 'El controlador delega al modelo; las reglas de negocio y la validación viven en el modelo.' },
      { de: 3, a: 2, texto: 'producto creado', color: C.s3, nota: 'El modelo valida, guarda en la base de datos y devuelve el registro con su id.' },
      { de: 2, a: 4, texto: 'render(201)', color: C.s7, nota: 'El controlador elige la respuesta: éxito, código 201.' },
      { de: 4, a: 0, texto: v === 'json' ? '201 JSON' : '201 + redirección', color: C.s6, nota: 'La vista compone la respuesta final.' },
    ] },
    error: { t: 'POST /productos (precio inválido)', msgs: (v) => [
      { de: 0, a: 1, texto: 'POST /productos', color: C.s1, nota: 'El cliente envía un precio negativo.' },
      { de: 1, a: 2, texto: 'crear(body)', color: C.s2, nota: 'El controlador recibe el cuerpo.' },
      { de: 2, a: 3, texto: 'Producto.create(body)', color: C.s3, nota: 'El modelo intenta guardar.' },
      { de: 3, a: 2, texto: 'ValidationError', color: C.s8, guiones: [4, 3], nota: 'El modelo rechaza: «el precio debe ser mayor que 0». No se escribe nada en la base de datos.' },
      { de: 2, a: 4, texto: 'render(error)', color: C.s7, nota: 'El controlador convierte el error en una respuesta 422.' },
      { de: 4, a: 0, texto: v === 'json' ? '422 JSON' : '422 formulario con errores', color: C.s8, nota: 'La vista explica qué falló.' },
    ] },
  };

  function montarRecorrido(cuerpo) {
    let caso = 'lista', vista = 'json';
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Cliente' }, { nombre: 'Router' }, { nombre: 'Controlador' }, { nombre: 'Modelo' }, { nombre: 'Vista' }],
      mensajes: () => CASOS[caso].msgs(vista),
      controles(ctl, reiniciar) {
        ctl.selector({ etiqueta: 'Petición', valor: caso, opciones: Object.entries(CASOS).map(([k, c]) => [k, c.t]), alCambiar: (v) => { caso = v; reiniciar(); } });
        ctl.selector({ etiqueta: 'Formato de la vista', valor: vista, opciones: [['json', 'JSON (API)'], ['html', 'HTML (página)']], alCambiar: (v) => { vista = v; reiniciar(); } });
      },
      leyenda: [{ color: C.s1, texto: 'petición' }, { color: C.s2, texto: 'enrutamiento' }, { color: C.s3, texto: 'datos (modelo)' }, { color: C.s7, texto: 'presentación (vista)' }, { color: C.s6, texto: 'respuesta' }, { color: C.s8, texto: 'error' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['capa activa', hasta < 0 ? '—' : ['router', 'controlador', 'modelo', 'modelo', 'vista', 'respuesta'][hasta]], ['cambia la vista, no el modelo', vista.toUpperCase()]],
      nota: 'Cambie el formato de la vista: solo el último paso cambia. El controlador y el modelo no se enteran de cómo se muestran los datos.',
    });
  }

  /* ---------- Fig. 2: ¿en qué capa va este código? ---------- */

  const FRAGMENTOS = [
    ['SELECT * FROM productos WHERE precio > 100', 'M', 'Consultar datos es responsabilidad del modelo.'],
    ['<li>{{ producto.nombre }} — ${{ producto.precio }}</li>', 'V', 'Describir cómo se ve algo es trabajo de la vista.'],
    ['if (!ctx.state.usuario) ctx.throw(401)', 'C', 'Decidir qué hacer con la petición (y rechazarla) es del controlador.'],
    ['precio > 0 y nombre no vacío', 'M', 'Las reglas del negocio y su validación pertenecen al modelo.'],
    ['ctx.body = JSON.stringify(datos)', 'V', 'Formatear la respuesta es presentación.'],
    ['const p = await Producto.findByPk(ctx.params.id)', 'C', 'Coordinar: leer el parámetro y pedir los datos al modelo.'],
    ['calcularDescuento(cliente, producto)', 'M', 'Es una regla del dominio, no depende de HTTP.'],
    ['ctx.redirect("/productos")', 'C', 'Elegir a dónde va la petición después de procesarla es del controlador.'],
  ];
  const NOM = { M: 'Modelo', V: 'Vista', C: 'Controlador' };
  const COLOR = { M: C.s3, V: C.s7, C: C.s2 };

  function montarClasificar(cuerpo) {
    let orden = FRAGMENTOS.map((_, i) => i), resp = {}, comprobado = false, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Comprobar', () => { comprobado = true; dibujar(); }, { primario: true });
    ctl.boton('Mezclar', () => { semilla++; const r = VIZ.semilla(semilla); orden = [...orden].sort(() => r() - 0.5); resp = {}; comprobado = false; dibujar(); });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Asigne cada fragmento a su capa y pulse «Comprobar». Si no sabe, pregúntese: ¿cambiaría si pasamos de una web a una app móvil? (modelo: no; vista: sí).');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      tabla.replaceChildren(el('tr', null, el('th', null, 'Fragmento'), el('th', null, 'Capa'), el('th', null, 'Resultado')),
        ...orden.map((i) => {
          const [cod, ok, why] = FRAGMENTOS[i];
          const sel = el('select', null, el('option', { value: '' }, '—'), ...['M', 'V', 'C'].map((k) => el('option', { value: k }, NOM[k])));
          sel.value = resp[i] || '';
          sel.addEventListener('change', () => { resp[i] = sel.value; comprobado = false; dibujar(); });
          const bien = resp[i] === ok;
          return el('tr', null, el('td', null, cod), el('td', null, sel),
            el('td', null, comprobado ? (resp[i] ? VIZ.ficha(bien ? 'correcto' : `es ${NOM[ok]}`, { color: bien ? C.s6 : C.s8 }) : '—') : '', comprobado && resp[i] ? ` ${why}` : ''));
        }));
      const n = Object.values(resp).filter(Boolean).length, ok = FRAGMENTOS.filter((f, i) => resp[i] === f[1]).length;
      registro.textContent = comprobado ? `Acertó ${ok} de ${FRAGMENTOS.length}.` : `Asignados: ${n} de ${FRAGMENTOS.length}.`;
      lectura.set([['asignados', `${n} de ${FRAGMENTOS.length}`], ['aciertos', comprobado ? `${ok}` : '—']]);
    }
    dibujar();
  }

  VIZ.registrarTema('mvc-architecture', {
    intro: String.raw`
      <p>Cuando una aplicación crece, mezclar en un mismo archivo la consulta a la base de datos, las reglas del negocio y el HTML se vuelve inmanejable.
      <strong>MVC</strong> (<em>Model-View-Controller</em>) propone dividir el servidor en tres responsabilidades:</p>
      <p>el <strong>Modelo</strong> guarda los datos y las reglas del dominio, la <strong>Vista</strong> decide cómo se presentan, y el <strong>Controlador</strong> recibe la petición, coordina a los otros dos y elige la respuesta.
      Un <strong>enrutador</strong> conecta cada URL con el controlador adecuado.</p>`,
    visualizaciones: [
      { titulo: 'Recorrido de una petición', descripcion: 'Avance paso a paso por cuatro peticiones y cambie el formato de la vista: vea qué capas participan y cuáles no se ven afectadas.', montar: montarRecorrido },
      { titulo: '¿En qué capa va este código?', descripcion: 'Clasifique ocho fragmentos como modelo, vista o controlador y compruebe su criterio.', montar: montarClasificar },
    ],
    teoria: String.raw`
      <h2>Responsabilidades</h2>
      <table>
        <tr><th>Capa</th><th>Qué hace</th><th>Qué no debe hacer</th></tr>
        <tr><td>Modelo</td><td>entidades, validación, persistencia, reglas del negocio</td><td>conocer HTTP o HTML</td></tr>
        <tr><td>Vista</td><td>dar formato a los datos (HTML, JSON)</td><td>consultar la base de datos</td></tr>
        <tr><td>Controlador</td><td>leer la petición, llamar al modelo, elegir la respuesta</td><td>contener reglas del negocio</td></tr>
      </table>
      <h2>Por qué separar</h2>
      <ul>
        <li><strong>Cambio localizado</strong>: cambiar el diseño no toca la lógica; cambiar de base de datos no toca las vistas.</li>
        <li><strong>Pruebas</strong>: el modelo se prueba sin servidor web (<a href="tema.html?id=test-pyramid">pruebas unitarias</a>).</li>
        <li><strong>Trabajo en equipo</strong>: personas distintas pueden trabajar en capas distintas.</li>
      </ul>
      <h2>Estructura típica de un proyecto</h2>
      <pre><code>src/
  routes/        productos.js        // URL → controlador
  controllers/   productosController.js
  models/        producto.js         // Sequelize: tablas y validaciones
  views/         productos.json.js   // o plantillas HTML</code></pre>
      <p>En una API que solo devuelve JSON, la «vista» se reduce a serializar el modelo; en una aplicación con <a href="tema.html?id=component-tree-props">React</a>, la vista vive en el cliente y el servidor es solo modelo y controlador. El pipeline que precede al controlador se estudia en <a href="tema.html?id=middleware-pipeline">middleware</a>.</p>
      <div class="recuadro">Regla práctica: «controladores delgados, modelos gruesos». Si un controlador crece con cálculos y condiciones del negocio, esa lógica probablemente pertenece al modelo.</div>`,
  });
})();
