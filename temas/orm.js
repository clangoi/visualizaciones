(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: el problema de las N + 1 consultas ---------- */

  const ESTRATEGIAS = {
    perezosa: {
      nombre: 'carga perezosa (por defecto)',
      codigo: 'for autor in session.query(Autor):          # 1 consulta\n    print(autor.nombre, len(autor.libros))   # 1 consulta por autor',
      consultas: (n) => 1 + n,
      sql: (n) => ['SELECT id, nombre FROM autor;', ...Array.from({ length: n }, (_, i) => `SELECT * FROM libro WHERE autor_id = ${i + 1};`)],
    },
    join: {
      nombre: 'ansiosa con JOIN (joinedload)',
      codigo: 'q = session.query(Autor).options(joinedload(Autor.libros))\nfor autor in q:\n    print(autor.nombre, len(autor.libros))',
      consultas: () => 1,
      sql: () => ['SELECT autor.id, autor.nombre, libro.* FROM autor LEFT JOIN libro ON libro.autor_id = autor.id;'],
    },
    in: {
      nombre: 'ansiosa con IN (selectinload)',
      codigo: 'q = session.query(Autor).options(selectinload(Autor.libros))\nfor autor in q:\n    print(autor.nombre, len(autor.libros))',
      consultas: () => 2,
      sql: (n) => ['SELECT id, nombre FROM autor;', `SELECT * FROM libro WHERE autor_id IN (${Array.from({ length: Math.min(n, 8) }, (_, i) => i + 1).join(', ')}${n > 8 ? ', …' : ''});`],
    },
  };

  function montarN1(cuerpo) {
    let est = 'perezosa', n = 20, lat = 2, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', valor: est, opciones: Object.entries(ESTRATEGIAS).map(([k, v]) => [k, v.nombre]), alCambiar: (v) => { est = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Autores', min: 1, max: 100, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Latencia por consulta', min: 0.2, max: 20, paso: 0.2, valor: lat, formato: (v) => `${VIZ.fmt(v, 2)} ms`, alCambiar: (v) => { lat = v; dibujar(); } });
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    VIZ.subtitulo(cuerpo, 'SQL que emite el ORM');
    const log = el('div', { class: 'lista-mono caja-alta' });
    cuerpo.appendChild(log);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 200, altoMax: 280 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'perezosa: 1 + n', forma: 'linea' },
      { color: C.s2, texto: 'JOIN: 1', forma: 'linea' },
      { color: C.s3, texto: 'IN: 2', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El código de la aplicación es casi idéntico en las tres estrategias; lo que cambia es el SQL. Pase el cursor sobre el gráfico.');
    const SER = [['perezosa', C.s1], ['join', C.s2], ['in', C.s3]];
    let plano = null;
    function dibujar() {
      const E = ESTRATEGIAS[est];
      codigo.textContent = E.codigo;
      const sql = E.sql(n);
      log.replaceChildren(...sql.slice(0, 40).map((q, i) => el('div', null, `${String(i + 1).padStart(3, '\u00a0')}  ${q}`)), ...(sql.length > 40 ? [el('div', null, `… ${sql.length - 40} consultas más`)] : []));
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 105 }, { etiquetaX: 'autores n', etiquetaY: 'consultas' });
      plano.ejes();
      for (const [k, c] of SER) {
        const pts = [];
        for (let x = 0; x <= 100; x++) pts.push([x, ESTRATEGIAS[k].consultas(x)]);
        VIZ.trazar(ctx, plano, pts, c, k === est ? 3 : 1.5);
        VIZ.marcador(ctx, plano.sx(hover ?? n), plano.sy(ESTRATEGIAS[k].consultas(hover ?? n)), c, 4);
      }
      const q = E.consultas(n);
      lectura.set([
        ['consultas', String(q)],
        ['tiempo en latencia', `${VIZ.fmt(q * lat, 3)} ms`],
        ['frente a JOIN', `${VIZ.fmt(q, 3)}×`],
        ['filas transferidas', est === 'join' ? `${n * 5} (autor repetido por libro)` : `${n + n * 5}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.round(plano.ix(x)); dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + SER.map(([k, c]) => VIZ.filaTooltip(c, k, ESTRATEGIAS[k].consultas(hover))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: herencia → tablas ---------- */

  const OBJETOS = [
    { clase: 'Persona', id: 1, nombre: 'Rosa' },
    { clase: 'Alumno', id: 2, nombre: 'Ana', rol: 101, carrera: 'Informática' },
    { clase: 'Alumno', id: 3, nombre: 'Bruno', rol: 102, carrera: 'Civil' },
    { clase: 'Profesor', id: 4, nombre: 'Tomás', depto: 'DCC', oficina: 'B-12' },
  ];
  const CLASES = {
    Persona: ['id', 'nombre'],
    Alumno: ['rol', 'carrera'],
    Profesor: ['depto', 'oficina'],
  };

  function tablasDe(estrategia) {
    if (estrategia === 'unica') {
      const atr = ['id', 'tipo', 'nombre', 'rol', 'carrera', 'depto', 'oficina'];
      return [B.rel('persona', atr, OBJETOS.map((o) => ({ ...o, tipo: o.clase.toLowerCase(), rol: o.rol ?? null, carrera: o.carrera ?? null, depto: o.depto ?? null, oficina: o.oficina ?? null })))];
    }
    if (estrategia === 'concreta') {
      return Object.keys(CLASES).map((c) => {
        const atr = c === 'Persona' ? CLASES.Persona : [...CLASES.Persona, ...CLASES[c]];
        return B.rel(c.toLowerCase(), atr, OBJETOS.filter((o) => o.clase === c));
      });
    }
    return [
      B.rel('persona', ['id', 'nombre'], OBJETOS),
      B.rel('alumno', ['id', 'rol', 'carrera'], OBJETOS.filter((o) => o.clase === 'Alumno')),
      B.rel('profesor', ['id', 'depto', 'oficina'], OBJETOS.filter((o) => o.clase === 'Profesor')),
    ];
  }
  const RESUMEN = {
    unica: { sql: 'SELECT * FROM persona WHERE tipo = \'alumno\';', juntas: 0, poli: 'una consulta', texto: 'Tabla única: todo en una tabla con una columna discriminadora. Rápida, pero llena de NULL y sin NOT NULL posible en las columnas de subclase.' },
    concreta: { sql: 'SELECT * FROM alumno;', juntas: 0, poli: 'UNION de 3 tablas', texto: 'Tabla por clase concreta: cada clase con todas sus columnas. Sin NULL, pero «todas las personas» exige un UNION y los ids deben ser únicos entre tablas.' },
    unida: { sql: 'SELECT * FROM persona JOIN alumno USING (id);', juntas: 1, poli: 'LEFT JOIN de 3 tablas', texto: 'Tablas unidas: una tabla por clase con solo sus columnas propias. Normalizado y sin NULL, pero cargar un alumno exige una junta.' },
  };

  function montarHerencia(cuerpo) {
    let est = 'unica';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', valor: est, opciones: [['unica', 'tabla única (single table)'], ['concreta', 'tabla por clase concreta'], ['unida', 'tablas unidas (joined)']], alCambiar: (v) => { est = v; dibujar(); } });
    const clases = el('div', { class: 'codigo-bdd' },
      'class Persona:   id, nombre\nclass Alumno(Persona):   rol, carrera\nclass Profesor(Persona): depto, oficina');
    cuerpo.appendChild(clases);
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [{ color: VIZ.alfa(C.s4, 0.18), texto: 'celda NULL (columna que no aplica a esa clase)' }]);
    const sql = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(sql);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Compare cuántos NULL y cuántas juntas exige cada estrategia para las mismas cuatro instancias.');
    function dibujar() {
      const T = tablasDe(est);
      caja.replaceChildren(...T.map((R) => B.tabla(R, { claves: ['id'], celda: (f, a) => (f[a] == null ? C.s4 : null) })));
      const nulos = T.reduce((s, R) => s + R.filas.reduce((t, f) => t + R.atributos.filter((a) => f[a] == null).length, 0), 0);
      const r = RESUMEN[est];
      sql.textContent = `-- cargar los alumnos\n${r.sql}`;
      registro.textContent = r.texto;
      lectura.set([['tablas', String(T.length)], ['celdas NULL', String(nulos)], ['juntas para cargar un alumno', String(r.juntas)], ['«todas las personas»', r.poli]]);
    }
    dibujar();
  }

  VIZ.registrarTema('orm', {
    intro: String.raw`
      <p>Un <strong>ORM</strong> (<em>Object-Relational Mapping</em>: SQLAlchemy, Django ORM, Hibernate, ActiveRecord, Prisma) permite
      trabajar con la base como si fuera un conjunto de objetos: cada clase es una tabla, cada instancia una fila y cada referencia entre
      objetos una clave foránea. El programador escribe <code>autor.libros</code> y el ORM genera el SQL.</p>
      <p>La comodidad tiene un costo: los dos mundos no encajan del todo (<em>impedance mismatch</em>). Los objetos tienen identidad, herencia
      y navegación por punteros; las tablas tienen conjuntos, claves y juntas. Entender qué SQL se genera es la diferencia entre una página
      que carga en 20 ms y una que hace mil consultas.</p>`,
    visualizaciones: [
      {
        titulo: 'El problema de las N + 1 consultas',
        descripcion: 'Listar autores con su número de libros. Con carga perezosa el ORM hace una consulta por autor; con carga ansiosa, una o dos en total. Suba la latencia para ver el efecto en un servidor remoto.',
        montar: montarN1,
      },
      {
        titulo: 'Herencia en tablas',
        descripcion: 'Tres formas de guardar la jerarquía Persona → Alumno, Profesor. Cada una cambia los NULL, las juntas y lo que cuesta pedir «todas las personas».',
        montar: montarHerencia,
      },
    ],
    teoria: String.raw`
      <h2>Qué traduce un ORM</h2>
      <table>
        <tr><th>Mundo de objetos</th><th>Mundo relacional</th></tr>
        <tr><td>clase</td><td>tabla</td></tr>
        <tr><td>instancia</td><td>fila</td></tr>
        <tr><td>identidad del objeto</td><td>clave primaria</td></tr>
        <tr><td>referencia <code>libro.autor</code></td><td>clave foránea <code>libro.autor_id</code></td></tr>
        <tr><td>colección <code>autor.libros</code></td><td>consulta inversa sobre la clave foránea</td></tr>
        <tr><td>relación muchos a muchos</td><td>tabla intermedia</td></tr>
        <tr><td>herencia</td><td>una de tres estrategias (figura 2)</td></tr>
      </table>
      <p>Además, mantiene un <strong>mapa de identidad</strong> (dentro de una sesión, una fila corresponde a un único objeto en memoria) y
      una <strong>unidad de trabajo</strong> (acumula los cambios y los envía en una transacción al hacer <code>commit</code>).</p>

      <h2>N + 1 consultas</h2>
      <p>Con carga perezosa, cada acceso a una colección no cargada dispara una consulta. Recorrer \(n\) objetos y tocar una relación en
      cada uno cuesta \(1 + n\) viajes al servidor. Si cada viaje cuesta \(\ell\) de latencia, el tiempo es \((1 + n)\,\ell\) aunque cada
      consulta sea instantánea.</p>
      <div class="recuadro">La carga ansiosa con <code>JOIN</code> hace una sola consulta pero repite las columnas del autor en cada fila de
      libro (producto de la junta), y con dos colecciones anidadas el número de filas se multiplica. La carga con <code>IN</code> hace dos
      consultas y no repite datos: suele ser el mejor compromiso.</div>

      <h2>Ventajas y riesgos</h2>
      <ul>
        <li>Las consultas parametrizadas que genera el ORM evitan la inyección SQL… salvo que se use
        su vía de escape de SQL crudo concatenando texto.</li>
        <li>Las migraciones del esquema quedan versionadas junto al código.</li>
        <li>Las consultas analíticas (agregados, ventanas, CTE) suelen escribirse mejor en SQL directo.</li>
        <li>El ORM no reemplaza las <a href="tema.html?id=modelo-relacional">restricciones</a> de la base: una validación en la clase no
        protege de otra aplicación que escriba en la misma tabla.</li>
      </ul>`,
  });
})();
