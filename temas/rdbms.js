(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const CAPAS = [
    { id: 'cliente', nombre: 'Aplicación cliente', info: 'Envía texto SQL por una conexión (JDBC, psycopg, …) y recibe filas.' },
    { id: 'parser', nombre: 'Analizador (parser)', info: 'Revisa la sintaxis, resuelve nombres contra el catálogo y produce un árbol de la consulta.' },
    { id: 'optim', nombre: 'Optimizador', info: 'Reescribe el árbol en álgebra relacional y elige el plan físico de menor costo estimado.' },
    { id: 'ejec', nombre: 'Ejecutor', info: 'Recorre el plan con el modelo de iteradores: cada operador pide filas a sus hijos.' },
    { id: 'acceso', nombre: 'Métodos de acceso', info: 'Archivos heap, índices B+ y hash: traducen «filas con rol = 103» a números de página.' },
    { id: 'buffer', nombre: 'Gestor de buffer', info: 'Mantiene páginas en memoria; si la página no está, elige una víctima y la pide al disco.' },
    { id: 'disco', nombre: 'Gestor de disco', info: 'Lee y escribe páginas de tamaño fijo (4–16 KiB) en los archivos de la base.' },
  ];
  const LATERALES = [
    { id: 'tx', nombre: 'Transacciones y bloqueos', info: 'Da a cada transacción la ilusión de estar sola: bloqueos o versiones (MVCC).' },
    { id: 'log', nombre: 'Recuperación (bitácora)', info: 'Escribe cada cambio en la bitácora antes que en los datos, para rehacer o deshacer tras una caída.' },
    { id: 'catalogo', nombre: 'Catálogo', info: 'Metadatos: tablas, columnas, tipos, índices y estadísticas para el optimizador.' },
  ];

  const CONSULTAS = {
    hit: {
      sql: 'SELECT nombre FROM Alumnos WHERE rol = 103;',
      pasos: [
        ['cliente', 'La aplicación envía el texto de la consulta.'],
        ['parser', 'Árbol: SELECT [nombre] FROM [Alumnos] WHERE [rol = 103]. «Alumnos» existe y tiene las columnas nombre y rol.', 'catalogo'],
        ['optim', 'Hay un índice B+ sobre rol, y la condición es de igualdad sobre la clave: plan = búsqueda en el índice, sin recorrer la tabla.', 'catalogo'],
        ['ejec', 'π nombre ← IndexScan(Alumnos, rol = 103). El ejecutor llama next() sobre el operador raíz.'],
        ['acceso', 'El índice lleva de la raíz a la hoja: la fila está en la página 7 de Alumnos.'],
        ['buffer', 'La página 7 ya está en el buffer (acierto): no hace falta leer el disco.'],
        ['ejec', 'La fila sube por el plan; la proyección deja solo nombre = «Carla».'],
        ['cliente', 'El cliente recibe 1 fila. 0 lecturas de disco.'],
      ],
      lecturas: 0, escrituras: 0,
    },
    miss: {
      sql: "SELECT * FROM Alumnos WHERE carrera = 'Civil';",
      pasos: [
        ['cliente', 'La aplicación envía el texto de la consulta.'],
        ['parser', 'Árbol válido; carrera es una columna de Alumnos.', 'catalogo'],
        ['optim', 'No hay índice sobre carrera y las estadísticas dicen que un tercio de las filas cumple: plan = recorrido secuencial.', 'catalogo'],
        ['ejec', 'σ carrera = Civil ← SeqScan(Alumnos).'],
        ['acceso', 'El archivo heap de Alumnos ocupa las páginas 5 a 9; se piden en orden.'],
        ['buffer', 'Las páginas 5, 6, 8 y 9 no están en memoria (fallo): se eligen víctimas con LRU.'],
        ['disco', 'Se leen 4 páginas contiguas: una lectura secuencial, mucho más barata que cuatro al azar.'],
        ['buffer', 'Las páginas quedan en el buffer, fijadas mientras el operador las recorre.'],
        ['ejec', 'La selección descarta las filas de otras carreras y deja pasar 2.'],
        ['cliente', 'El cliente recibe 2 filas. 4 lecturas de disco.'],
      ],
      lecturas: 4, escrituras: 0,
    },
    update: {
      sql: 'UPDATE Inscripciones SET nota = 7.0 WHERE rol = 104 AND sigla = \'IIC2413\';',
      pasos: [
        ['cliente', 'La aplicación inicia una transacción y envía el UPDATE.'],
        ['parser', 'Árbol válido; la nota tiene una restricción CHECK entre 1.0 y 7.0.', 'catalogo'],
        ['optim', 'La condición fija la clave primaria completa: búsqueda en el índice de la clave.', 'catalogo'],
        ['ejec', 'Update ← IndexScan(Inscripciones, (104, IIC2413)).'],
        ['tx', 'Se toma un bloqueo exclusivo sobre la fila: otra transacción que quiera escribirla debe esperar.'],
        ['acceso', 'El índice entrega la página 12.'],
        ['buffer', 'Fallo: la página 12 se lee del disco.'],
        ['disco', 'Una lectura aleatoria.'],
        ['log', 'Registro de bitácora: <T7, Inscripciones(104,IIC2413), nota: 3.9 → 7.0>. Se escribe ANTES que la página (WAL).'],
        ['buffer', 'La página 12 se modifica en memoria y queda marcada como sucia; se escribirá al disco más tarde.'],
        ['tx', 'COMMIT: la bitácora se fuerza al disco y se liberan los bloqueos.'],
        ['cliente', '1 fila actualizada. 1 lectura de datos y 1 escritura secuencial de bitácora.'],
      ],
      lecturas: 1, escrituras: 1,
    },
  };

  function montarCapas(cuerpo) {
    let consulta = 'hit', k = -1, visitadas = new Set();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Consulta', valor: consulta,
      opciones: [['hit', 'búsqueda por clave (en buffer)'], ['miss', 'recorrido secuencial (al disco)'], ['update', 'actualización con bitácora']],
      alCambiar: (v) => { consulta = v; rep.reiniciar(); },
    });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });
    const sql = VIZ.el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(sql);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 372 : 360) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'capa que trabaja ahora' },
      { color: C.s1, texto: 'capas ya recorridas' },
      { color: C.s3, texto: 'componente consultado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance con «Un paso» y pase el cursor sobre una capa para leer qué hace.');

    function iniciar() {
      k = -1; visitadas = new Set();
      return (function* () {
        for (k = 0; k < CONSULTAS[consulta].pasos.length; k++) { visitadas.add(CONSULTAS[consulta].pasos[k][0]); yield; }
        k = CONSULTAS[consulta].pasos.length - 1;
      })();
    }

    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const q = CONSULTAS[consulta];
      sql.textContent = q.sql;
      const paso = k >= 0 ? q.pasos[k] : null;
      const angosto = W < 560;
      const anchoCol = angosto ? W - 20 : W * 0.6;
      const hCapa = angosto ? 34 : 38, gap = angosto ? 8 : 9;
      geo = [];
      CAPAS.forEach((c, i) => geo.push({ ...c, x: 10, y: 10 + i * (hCapa + gap), w: anchoCol, h: hCapa }));
      LATERALES.forEach((c, i) => {
        if (angosto) geo.push({ ...c, x: 10 + i * ((W - 20) / 3), y: 10 + CAPAS.length * (hCapa + gap) + 8, w: (W - 20) / 3 - 6, h: 44 });
        else geo.push({ ...c, x: anchoCol + 40, y: 10 + (i * 2 + 1) * (hCapa + gap), w: W - anchoCol - 50, h: hCapa });
      });
      // Flechas entre capas consecutivas.
      for (let i = 0; i < CAPAS.length - 1; i++) {
        const a = geo[i], b = geo[i + 1];
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a.x + a.w / 2, a.y + a.h); ctx.lineTo(b.x + b.w / 2, b.y); ctx.stroke();
      }
      for (const g of geo) {
        const ahora = paso && (paso[0] === g.id);
        const lado = paso && paso[2] === g.id;
        const col = ahora ? C.s2 : lado ? C.s3 : visitadas.has(g.id) ? C.s1 : C.tinta2;
        B.caja(ctx, g.x, g.y, g.w, g.h, null, { borde: col, ancho: ahora || lado ? 3 : 1.5, relleno: ahora ? VIZ.alfa(C.s2, 0.1) : C.superficie });
        ctx.fillStyle = ahora ? C.s2 : C.tinta;
        ctx.font = VIZ.fuente(angosto && g.h > 40 ? 10 : 12, 500);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const palabras = g.nombre.split(' ');
        if (angosto && g.h > 40 && palabras.length > 1) {
          const mitad = Math.ceil(palabras.length / 2);
          ctx.fillText(palabras.slice(0, mitad).join(' '), g.x + g.w / 2, g.y + g.h / 2 - 7);
          ctx.fillText(palabras.slice(mitad).join(' '), g.x + g.w / 2, g.y + g.h / 2 + 7);
        } else ctx.fillText(g.nombre, g.x + g.w / 2, g.y + g.h / 2 + 0.5);
      }
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
      // Cilindro de los archivos bajo la columna lateral.
      if (!angosto) {
        ctx.beginPath(); ctx.ellipse(W * 0.6 + 40 + (W - W * 0.6 - 50) / 2, H - 22, 30, 7, 0, 0, Math.PI * 2); ctx.stroke();
        B.texto(ctx, 'archivos de datos y bitácora', W * 0.6 + 40 + (W - W * 0.6 - 50) / 2, H - 6, { alinear: 'center', px: 10, color: C.apagado });
      }
      registro.textContent = paso ? `${k + 1}. ${CAPAS.concat(LATERALES).find((c) => c.id === paso[0]).nombre}: ${paso[1]}` : 'Pulse «Un paso» para seguir la consulta capa por capa.';
      const fin = rep.terminado;
      lectura.set([
        ['paso', `${Math.max(0, k + 1)} de ${q.pasos.length}`],
        ['capas recorridas', String(visitadas.size)],
        ['lecturas de disco', fin ? String(q.lecturas) : '…'],
        ['escrituras forzadas', fin ? String(q.escrituras) : '…'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.nombre}</b><br>${g.info}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('rdbms', {
    intro: String.raw`
      <p>Un <strong>sistema de gestión de bases de datos relacional</strong> (RDBMS: PostgreSQL, MySQL, SQL Server, Oracle, SQLite) es el
      programa que guarda las relaciones en disco y responde consultas SQL sobre ellas. Ofrece lo que un conjunto de archivos no ofrece:
      consultas declarativas, acceso concurrente seguro, recuperación ante fallas, control de acceso e independencia de los datos.</p>
      <p>Por dentro es una pila de capas. Cada una resuelve un problema distinto y le habla solo a la de abajo: el optimizador no sabe de
      sectores del disco, y el gestor de disco no sabe qué es una junta.</p>`,
    visualizaciones: [
      {
        titulo: 'El viaje de una consulta',
        descripcion: 'Siga tres consultas por las capas del motor. Compare la búsqueda que encuentra su página en memoria con la que debe ir al disco, y vea cuándo interviene la bitácora.',
        montar: montarCapas,
      },
    ],
    teoria: String.raw`
      <h2>Por qué no basta con archivos</h2>
      <table>
        <tr><th>Problema con archivos sueltos</th><th>Lo que aporta el RDBMS</th></tr>
        <tr><td>cada programa conoce el formato del archivo</td><td>independencia física y lógica de los datos</td></tr>
        <tr><td>cada consulta es un programa nuevo</td><td>SQL declarativo y un optimizador</td></tr>
        <tr><td>dos usuarios que escriben a la vez se pisan</td><td>control de concurrencia (aislamiento)</td></tr>
        <tr><td>un corte de luz deja datos a medias</td><td>atomicidad y durabilidad con bitácora</td></tr>
        <tr><td>datos duplicados que divergen</td><td>restricciones de integridad</td></tr>
        <tr><td>cualquiera lee todo</td><td>usuarios, roles y privilegios</td></tr>
      </table>

      <h2>Los tres niveles de abstracción</h2>
      <p>La arquitectura ANSI/SPARC separa el nivel <strong>externo</strong> (vistas de cada usuario), el <strong>conceptual</strong> (el
      esquema relacional) y el <strong>físico</strong> (archivos, páginas, índices). Cambiar un índice no obliga a cambiar las consultas
      (independencia física), y agregar una columna no obliga a cambiar las vistas que no la usan (independencia lógica).</p>

      <h2>Costo de una consulta</h2>
      <p>El optimizador elige entre planes equivalentes estimando su costo. En bases que no caben en memoria el término dominante son las
      transferencias de páginas entre disco y memoria, de modo que el modelo de costo más usado cuenta <strong>E/S de páginas</strong>:</p>
      \[ \text{costo}(\text{plan}) \approx \sum_{\text{operadores}} \#\text{páginas leídas} + \#\text{páginas escritas}. \]
      <p>Para estimarlo usa estadísticas del catálogo: número de páginas y filas de cada tabla, valores distintos por columna e histogramas,
      con los que calcula la <em>selectividad</em> de cada predicado.</p>

      <h2>Conexiones</h2>
      <p>Las capas inferiores se estudian en <a href="tema.html?id=arquitectura-so">arquitectura y sistema operativo</a>,
      <a href="tema.html?id=paginas-buffer">páginas y buffer</a> e <a href="tema.html?id=indices">índices</a>; el ejecutor, en el
      <a href="tema.html?id=iterador">modelo de iteradores</a>; las transacciones, en <a href="tema.html?id=acid">ACID</a> y
      <a href="tema.html?id=recuperacion">recuperación</a>.</p>`,
  });
})();
