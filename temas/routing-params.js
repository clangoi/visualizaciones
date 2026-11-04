(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: el enrutador ---------- */

  const RUTAS = [
    { m: 'GET', p: '/usuarios' }, { m: 'GET', p: '/usuarios/:id' }, { m: 'POST', p: '/usuarios' }, { m: 'GET', p: '/usuarios/:id/pedidos' },
    { m: 'GET', p: '/usuarios/:id/pedidos/:pedidoId' }, { m: 'DELETE', p: '/usuarios/:id' },
  ];
  const compilar = (p) => ({ re: new RegExp('^' + p.replace(/:[A-Za-z]+/g, '([^/]+)') + '/?$'), nombres: [...p.matchAll(/:([A-Za-z]+)/g)].map((x) => x[1]) });
  const EJEMPLOS = ['GET /usuarios/7', 'GET /usuarios', 'POST /usuarios', 'GET /usuarios/7/pedidos?estado=pagado&pagina=2', 'GET /usuarios/7/pedidos/42', 'DELETE /usuarios/7', 'PUT /usuarios/7', 'GET /clientes'];

  function montarEnrutador(cuerpo) {
    let peticion = 'GET /usuarios/7/pedidos?estado=pagado&pagina=2', cuerpoJson = '{"nombre":"Ana"}';
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Petición (método y URL)', valor: peticion, alCambiar: (v) => { peticion = v; dibujar(); }, alEnter: (v) => { peticion = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', valor: peticion, opciones: [[peticion, '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], alCambiar: (v) => { peticion = v; campo.valor = v; dibujar(); } });
    const tabla = el('table', { class: 'tabla-datos texto' });
    const ctxPre = el('pre', { class: 'codigo-bdd' });
    cuerpo.append(el('div', { class: 'caja-desplazable' }, tabla), el('p', { class: 'subtitulo-viz' }, 'Lo que recibe el controlador (ctx)'), ctxPre);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El enrutador prueba las rutas en orden y usa la primera que coincide en método <em>y</em> en forma. Los segmentos con <code>:nombre</code> se convierten en parámetros.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';

    function dibujar() {
      const [m, ...resto] = peticion.trim().split(/\s+/), url = resto.join(' ') || '/';
      const [ruta, consulta = ''] = url.split('?');
      let ganadora = -1, params = {}, existeRuta = false;
      const filas = RUTAS.map((r, i) => {
        const { re, nombres } = compilar(r.p), mt = re.exec(ruta);
        if (mt) existeRuta = true;
        const ok = mt && r.m === m && ganadora < 0;
        if (ok) { ganadora = i; nombres.forEach((n, k) => { params[n] = mt[k + 1]; }); }
        return { r, ok, razon: !mt ? 'forma distinta' : r.m !== m ? 'método distinto' : ganadora === i ? 'COINCIDE' : 'ya hubo coincidencia' };
      });
      tabla.replaceChildren(el('tr', null, el('th', null, 'Ruta registrada'), el('th', null, 'Resultado')), ...filas.map((f) => el('tr', { class: f.ok ? 'activa' : null }, el('td', null, `${f.r.m} ${f.r.p}`), el('td', null, f.razon))));
      const query = Object.fromEntries(new URLSearchParams(consulta));
      ctxPre.textContent = ganadora >= 0 ? `ctx.params       = ${JSON.stringify(params)}\nctx.query        = ${JSON.stringify(query)}\nctx.request.body = ${m === 'POST' ? cuerpoJson : '(vacío)'}` : '(no hay controlador: la petición no coincide)';
      registro.textContent = ganadora >= 0 ? `Coincide con «${RUTAS[ganadora].m} ${RUTAS[ganadora].p}»: id y demás parámetros salen de la ruta; ?clave=valor sale de la consulta.` : existeRuta ? 'La URL existe pero con otro método: el servidor debería responder 405 Method Not Allowed.' : 'Ninguna ruta coincide: el servidor responde 404 Not Found.';
      lectura.set([['método', m], ['ruta', ruta], ['parámetros de ruta', String(Object.keys(params).length)], ['parámetros de consulta', String(Object.keys(query).length)], ['respuesta', ganadora >= 0 ? 'controlador' : existeRuta ? '405' : '404']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: filtrar, ordenar y paginar con la consulta ---------- */

  const PRODUCTOS = Array.from({ length: 30 }, (_, i) => {
    const r = VIZ.semilla(i + 5);
    return { id: i + 1, nombre: ['Lápiz', 'Cuaderno', 'Mochila', 'Regla', 'Estuche', 'Tijeras'][i % 6] + ` ${Math.floor(i / 6) + 1}`, precio: 5 + Math.floor(r() * 95) };
  });

  function montarPaginacion(cuerpo) {
    const est = { pagina: 2, limite: 5, orden: 'precio', min: 20 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'page', min: 1, max: 6, valor: est.pagina, alCambiar: (v) => { est.pagina = v; dibujar(); } });
    ctl.rango({ etiqueta: 'limit', min: 3, max: 15, valor: est.limite, alCambiar: (v) => { est.limite = v; dibujar(); } });
    ctl.rango({ etiqueta: 'min (precio mínimo)', min: 0, max: 80, paso: 5, valor: est.min, formato: (v) => `$${v}`, alCambiar: (v) => { est.min = v; dibujar(); } });
    ctl.selector({ etiqueta: 'sort', valor: est.orden, opciones: [['precio', 'precio ↑'], ['-precio', 'precio ↓'], ['nombre', 'nombre']], alCambiar: (v) => { est.orden = v; dibujar(); } });
    const url = el('pre', { class: 'codigo-bdd' });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(url, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los parámetros de consulta no identifican un recurso, lo <em>modifican</em>: filtran, ordenan y recortan la colección <code>/productos</code>.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      let l = PRODUCTOS.filter((p) => p.precio >= est.min);
      l = [...l].sort((a, b) => (est.orden === 'nombre' ? a.nombre.localeCompare(b.nombre) : est.orden === 'precio' ? a.precio - b.precio : b.precio - a.precio));
      const paginas = Math.max(1, Math.ceil(l.length / est.limite)), pagina = Math.min(est.pagina, paginas), ini = (pagina - 1) * est.limite, vis = l.slice(ini, ini + est.limite);
      url.textContent = `GET /productos?page=${pagina}&limit=${est.limite}&sort=${est.orden}&min=${est.min}`;
      tabla.replaceChildren(el('tr', null, el('th', null, 'id'), el('th', null, 'nombre'), el('th', null, 'precio')), ...vis.map((p) => el('tr', null, el('td', null, p.id), el('td', null, p.nombre), el('td', null, `$${p.precio}`))));
      registro.textContent = est.pagina > paginas ? `La página ${est.pagina} no existe con estos filtros: se muestra la ${paginas}.` : `Filtrar (precio ≥ ${est.min}) deja ${l.length} de ${PRODUCTOS.length}; se ordena y se toma el tramo [${ini}, ${ini + est.limite}).`;
      lectura.set([['coinciden con el filtro', String(l.length)], ['páginas', String(paginas)], ['en esta página', String(vis.length)], ['desplazamiento (offset)', String(ini)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('routing-params', {
    intro: String.raw`
      <p>El <strong>enrutador</strong> es la pieza que, ante una petición, decide qué código ejecutar según el <em>método</em> y la <em>ruta</em>.
      Además extrae de la petición los datos que el controlador necesita: los <strong>parámetros de ruta</strong> (<code>/usuarios/<b>7</b></code>), los <strong>parámetros de consulta</strong> (<code>?pagina=2</code>) y el <strong>cuerpo</strong> (JSON enviado con <code>POST</code>).</p>
      <p>Elegir bien dónde va cada dato —ruta, consulta o cuerpo— es parte del diseño de la API.</p>`,
    visualizaciones: [
      { titulo: 'El enrutador paso a paso', descripcion: 'Escriba o elija una petición y vea qué ruta coincide, qué parámetros se extraen y qué respuesta se daría si ninguna coincide.', montar: montarEnrutador },
      { titulo: 'Filtrar, ordenar y paginar', descripcion: 'Mueva <code>page</code>, <code>limit</code>, <code>min</code> y <code>sort</code> y observe cómo cambia la URL y el tramo de la colección devuelto.', montar: montarPaginacion },
    ],
    teoria: String.raw`
      <h2>Rutas con parámetros</h2>
      <pre><code>router.get("/usuarios/:id", async (ctx) =&gt; {
    const usuario = await Usuario.findByPk(ctx.params.id);   // :id → ctx.params.id
    if (!usuario) ctx.throw(404);
    ctx.body = usuario;
});</code></pre>
      <p>Un patrón como <code>/usuarios/:id/pedidos/:pedidoId</code> se compila a una expresión regular; las rutas se prueban en el orden en que se registraron, de modo que las más específicas (<code>/usuarios/nuevo</code>) deben ir antes que las genéricas (<code>/usuarios/:id</code>). Con \(r\) rutas, buscar una cuesta \(O(r)\) pruebas en el peor caso; los enrutadores grandes usan árboles de prefijos.</p>
      <h2>¿Dónde va cada dato?</h2>
      <table>
        <tr><th>Lugar</th><th>Para qué</th><th>Ejemplo</th></tr>
        <tr><td>Ruta</td><td>identificar el recurso</td><td><code>/productos/7</code></td></tr>
        <tr><td>Consulta</td><td>filtros, orden, paginación (opcionales)</td><td><code>?min=20&amp;sort=precio</code></td></tr>
        <tr><td>Cuerpo</td><td>datos para crear o modificar</td><td><code>{"nombre":"Ana"}</code></td></tr>
        <tr><td>Encabezados</td><td>metadatos: autenticación, formato</td><td><code>Authorization</code></td></tr>
      </table>
      <h2>Paginación</h2>
      <p>Con <code>limit</code> elementos por página y <code>total</code> resultados, hay \(\lceil \text{total}/\text{limit} \rceil\) páginas y la página \(p\) empieza en el desplazamiento \(\text{offset} = (p-1)\cdot\text{limit}\). La paginación por desplazamiento es simple pero costosa en tablas grandes; la basada en cursor (<code>?despues=id</code>) escala mejor.</p>
      <div class="recuadro">Valide siempre lo que llega: un <code>:id</code> o un <code>?limit</code> son texto que escribió el cliente. Estos datos los recibe el controlador tras atravesar el <a href="tema.html?id=middleware-pipeline">pipeline de middlewares</a>, y usan los métodos del <a href="tema.html?id=rest-api-crud">diseño REST</a>.</div>`,
  });
})();
