(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const USUARIOS = [{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }, { id: 3, nombre: 'Carla' }];
  const PERFILES = [{ id: 1, bio: 'Docente', usuarioId: 1 }, { id: 2, bio: 'Diseñador', usuarioId: 2 }];
  const PEDIDOS = [{ id: 10, total: 50, usuarioId: 1 }, { id: 11, total: 20, usuarioId: 1 }, { id: 12, total: 75, usuarioId: 2 }];
  const PRODUCTOS = [{ id: 1, nombre: 'Lápiz' }, { id: 2, nombre: 'Cuaderno' }, { id: 3, nombre: 'Mochila' }];
  const PEDIDO_PRODUCTO = [{ pedidoId: 10, productoId: 1 }, { pedidoId: 10, productoId: 2 }, { pedidoId: 11, productoId: 3 }, { pedidoId: 12, productoId: 2 }, { pedidoId: 12, productoId: 3 }];

  const RELACIONES = {
    '1n': { t: 'Uno a muchos: Usuario → Pedidos', cod: 'Usuario.hasMany(Pedido);\nPedido.belongsTo(Usuario);   // agrega Pedido.usuarioId', fk: 'usuarioId' },
    '11': { t: 'Uno a uno: Usuario → Perfil', cod: 'Usuario.hasOne(Perfil);\nPerfil.belongsTo(Usuario);   // agrega Perfil.usuarioId (único)', fk: 'usuarioId' },
    nm: { t: 'Muchos a muchos: Pedidos ↔ Productos', cod: 'Pedido.belongsToMany(Producto, { through: "PedidoProducto" });\nProducto.belongsToMany(Pedido, { through: "PedidoProducto" });', fk: 'pedidoId, productoId' },
  };

  const tablaHtml = (titulo, cols, filas, resaltar = []) => el('div', null, el('p', { class: 'subtitulo-viz' }, titulo),
    el('div', { class: 'caja-desplazable' }, el('table', { class: 'tabla-datos texto' }, el('tr', null, ...cols.map((c) => el('th', { class: resaltar.includes(c) ? 'clave' : null }, c))), ...filas.map((f) => el('tr', null, ...cols.map((c) => el('td', null, String(f[c]))))))));

  /* ---------- Fig. 1: modelos, claves foráneas y include ---------- */

  function montarModelos(cuerpo) {
    let rel = '1n', incluir = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Asociación', valor: rel, opciones: Object.entries(RELACIONES).map(([k, r]) => [k, r.t]), alCambiar: (v) => { rel = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'consulta con include (JOIN)', valor: true, alCambiar: (v) => { incluir = v; dibujar(); } });
    const cod = el('pre', { class: 'codigo-bdd' }), tablas = el('div', { class: 'dos-columnas' }), sql = el('pre', { class: 'codigo-bdd' }), res = el('div', { class: 'caja-desplazable' });
    cuerpo.append(cod, tablas, el('p', { class: 'subtitulo-viz' }, 'Consulta y su SQL'), sql, res);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La columna subrayada es la <b>clave foránea</b>: cada asociación se traduce a una columna (o a una tabla intermedia) que enlaza filas de tablas distintas.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const r = RELACIONES[rel];
      cod.textContent = r.cod;
      let consulta, filasSql, tablasMostradas, resultado, cols;
      if (rel === '1n') {
        tablasMostradas = [tablaHtml('usuarios', ['id', 'nombre'], USUARIOS), tablaHtml('pedidos', ['id', 'total', 'usuarioId'], PEDIDOS, ['usuarioId'])];
        consulta = incluir ? 'Usuario.findAll({ include: Pedido })' : 'Usuario.findAll()';
        filasSql = incluir ? 'SELECT u.id, u.nombre, p.id AS pedido, p.total\nFROM usuarios u LEFT JOIN pedidos p ON p.usuarioId = u.id;' : 'SELECT id, nombre FROM usuarios;';
        cols = incluir ? ['nombre', 'pedido', 'total'] : ['id', 'nombre'];
        resultado = incluir ? USUARIOS.flatMap((u) => { const ps = PEDIDOS.filter((p) => p.usuarioId === u.id); return ps.length ? ps.map((p) => ({ nombre: u.nombre, pedido: p.id, total: p.total })) : [{ nombre: u.nombre, pedido: 'NULL', total: 'NULL' }]; }) : USUARIOS;
      } else if (rel === '11') {
        tablasMostradas = [tablaHtml('usuarios', ['id', 'nombre'], USUARIOS), tablaHtml('perfiles', ['id', 'bio', 'usuarioId'], PERFILES, ['usuarioId'])];
        consulta = incluir ? 'Usuario.findAll({ include: Perfil })' : 'Usuario.findAll()';
        filasSql = incluir ? 'SELECT u.id, u.nombre, f.bio\nFROM usuarios u LEFT JOIN perfiles f ON f.usuarioId = u.id;' : 'SELECT id, nombre FROM usuarios;';
        cols = incluir ? ['nombre', 'bio'] : ['id', 'nombre'];
        resultado = incluir ? USUARIOS.map((u) => ({ nombre: u.nombre, bio: (PERFILES.find((f) => f.usuarioId === u.id) || { bio: 'NULL' }).bio })) : USUARIOS;
      } else {
        tablasMostradas = [tablaHtml('pedidos', ['id', 'total'], PEDIDOS), tablaHtml('productos', ['id', 'nombre'], PRODUCTOS), tablaHtml('PedidoProducto (tabla intermedia)', ['pedidoId', 'productoId'], PEDIDO_PRODUCTO, ['pedidoId', 'productoId'])];
        consulta = incluir ? 'Pedido.findAll({ include: Producto })' : 'Pedido.findAll()';
        filasSql = incluir ? 'SELECT p.id, pr.nombre\nFROM pedidos p\n  JOIN PedidoProducto pp ON pp.pedidoId = p.id\n  JOIN productos pr ON pr.id = pp.productoId;' : 'SELECT id, total FROM pedidos;';
        cols = incluir ? ['pedido', 'producto'] : ['id', 'total'];
        resultado = incluir ? PEDIDO_PRODUCTO.map((x) => ({ pedido: x.pedidoId, producto: PRODUCTOS.find((p) => p.id === x.productoId).nombre })) : PEDIDOS;
      }
      tablas.replaceChildren(...tablasMostradas);
      sql.textContent = `${consulta}\n\n${filasSql}`;
      res.replaceChildren(el('table', { class: 'tabla-datos texto' }, el('tr', null, ...cols.map((c) => el('th', null, c))), ...resultado.map((f) => el('tr', null, ...cols.map((c) => el('td', null, String(f[c])))))));
      registro.textContent = incluir ? 'include le pide al ORM un JOIN: una sola consulta trae las filas relacionadas ya combinadas.' : 'Sin include solo se trae la tabla principal; los datos relacionados exigirían otras consultas.';
      lectura.set([['asociación', r.t.split(':')[0]], ['clave foránea', r.fk], ['filas del resultado', String(resultado.length)], ['consultas SQL', '1']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: el problema de las N+1 consultas ---------- */

  function montarNMasUno(cuerpo) {
    const est = { n: 20, ms: 5 };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Usuarios que se listan', min: 1, max: 200, valor: est.n, alCambiar: (v) => { est.n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de cada consulta (viaje a la BD)', min: 1, max: 20, valor: est.ms, formato: (v) => `${v} ms`, alCambiar: (v) => { est.ms = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 330 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [{ c: C.s8, t: 'carga perezosa: 1 + N consultas', f: (n) => 1 + n }, { c: C.s1, t: 'carga ansiosa (include): 1 consulta', f: () => 1 }];
    VIZ.leyenda(cuerpo, SER.map((s) => ({ color: s.c, texto: s.t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Listar usuarios y, dentro de un bucle, pedir los pedidos de cada uno produce una consulta por usuario. Con <code>include</code> basta una sola.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: 200, ymin: 0, ymax: 201 * est.ms * 1.05 }, { etiquetaX: 'usuarios (N)', etiquetaY: 'tiempo en consultas (ms)' });
      plano.ejes();
      SER.forEach((s) => VIZ.trazar(ctx, plano, Array.from({ length: 200 }, (_, i) => [i + 1, s.f(i + 1) * est.ms]), s.c, 2));
      SER.forEach((s) => VIZ.marcador(ctx, plano.sx(est.n), plano.sy(s.f(est.n) * est.ms), s.c, 4));
      lectura.set([['consultas (perezosa)', String(1 + est.n)], ['consultas (include)', '1'], ['tiempo perezosa', `${(1 + est.n) * est.ms} ms`], ['tiempo include', `≈ ${est.ms} ms`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!plano || !plano.dentro(x, y)) return tip.ocultar(); const n = Math.max(1, Math.round(plano.ix(x))); tip.mostrar(x, y, `N = <b>${n}</b>` + SER.map((s) => VIZ.filaTooltip(s.c, s.t.split(':')[0], `${s.f(n)} consulta(s) · ${s.f(n) * est.ms} ms`)).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('sequelize-associations', {
    intro: String.raw`
      <p>En una base de datos relacional los datos viven en <strong>tablas</strong> relacionadas por <strong>claves foráneas</strong>. Un <strong>ORM</strong> como <strong>Sequelize</strong>
      permite trabajar con ellas como si fueran objetos de JavaScript: cada <em>modelo</em> representa una tabla y cada instancia, una fila.</p>
      <p>Las <em>asociaciones</em> (<code>hasMany</code>, <code>belongsTo</code>, <code>belongsToMany</code>) declaran cómo se relacionan los modelos, y Sequelize genera las claves foráneas y los <code>JOIN</code> necesarios.</p>`,
    visualizaciones: [
      { titulo: 'Asociaciones y consultas con include', descripcion: 'Cambie el tipo de relación y alterne <code>include</code>: observe las tablas con su clave foránea, el SQL generado y el resultado.', montar: montarModelos },
      { titulo: 'El problema de las N+1 consultas', descripcion: 'Aumente el número de usuarios y compare cuántas consultas hace la carga perezosa y la ansiosa.', montar: montarNMasUno },
    ],
    teoria: String.raw`
      <h2>Modelos</h2>
      <pre><code>const Usuario = sequelize.define("Usuario", {
    nombre: { type: DataTypes.STRING, allowNull: false },
    email:  { type: DataTypes.STRING, unique: true },
});
await Usuario.create({ nombre: "Ana", email: "ana@ejemplo.com" });   // INSERT
await Usuario.findAll({ where: { nombre: "Ana" } });                 // SELECT … WHERE
await Usuario.update({ nombre: "Ana M." }, { where: { id: 1 } });    // UPDATE
await Usuario.destroy({ where: { id: 1 } });                         // DELETE</code></pre>
      <h2>Cardinalidad</h2>
      <table>
        <tr><th>Relación</th><th>Cómo se guarda</th></tr>
        <tr><td>uno a uno</td><td>clave foránea única en una de las tablas</td></tr>
        <tr><td>uno a muchos</td><td>clave foránea en el lado «muchos»</td></tr>
        <tr><td>muchos a muchos</td><td>tabla intermedia con ambas claves (clave primaria compuesta)</td></tr>
      </table>
      <h2>Costo de las consultas</h2>
      <p>Si cada consulta tarda \(c\) ms (casi todo es el viaje a la base de datos), listar \(N\) usuarios con sus pedidos cuesta</p>
      \[ T_{\text{perezosa}} = (1 + N)\,c \qquad \text{frente a} \qquad T_{\text{ansiosa}} \approx c + \text{costo del JOIN}. \]
      <p>Con \(N = 100\) y \(c = 5\) ms son 505 ms frente a unos 5 ms. Los ORM facilitan olvidar este costo, por eso conviene registrar las consultas generadas durante el desarrollo.</p>
      <div class="recuadro">Un ORM no sustituye entender SQL: es una capa de comodidad sobre las operaciones relacionales (<a href="tema.html?id=orm">ORM</a>, <a href="tema.html?id=sql">SQL</a> y <a href="tema.html?id=rdbms">bases relacionales</a>). La persistencia vive en el <em>modelo</em> de la <a href="tema.html?id=mvc-architecture">arquitectura MVC</a>.</div>`,
  });
})();
