(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: un mismo dato, cinco modelos ---------- */

  function documentos(u) {
    return u.alumnos.filas.slice(0, 4).map((a) => ({
      _id: a.rol, nombre: a.nombre, carrera: a.carrera,
      cursos: u.inscripciones.filas.filter((i) => i.rol === a.rol).map((i) => ({ sigla: i.sigla, titulo: u.cursos.filas.find((c) => c.sigla === i.sigla).titulo, nota: i.nota })),
    }));
  }
  const CONSULTAS = {
    cursosDe: 'cursos de Ana',
    alumnosDe: 'alumnos de Bases de Datos',
  };
  const RESPUESTA = {
    relacional: {
      cursosDe: 'SELECT c.titulo FROM Alumnos a JOIN Inscripciones i USING (rol) JOIN Cursos c USING (sigla) WHERE a.nombre = \'Ana\';  → dos juntas, cualquier dirección es igual de fácil.',
      alumnosDe: 'SELECT a.nombre FROM Cursos c JOIN Inscripciones i USING (sigla) JOIN Alumnos a USING (rol) WHERE c.titulo = \'Bases de Datos\';  → la misma consulta al revés.',
    },
    documento: {
      cursosDe: 'db.alumnos.findOne({nombre: "Ana"}).cursos  → una sola lectura: el documento ya trae sus cursos embebidos.',
      alumnosDe: 'db.alumnos.find({"cursos.titulo": "Bases de Datos"})  → recorrer todos los documentos (o un índice sobre el campo anidado). El título del curso está copiado en cada alumno: cambiarlo exige actualizar muchos documentos.',
    },
    clavevalor: {
      cursosDe: 'GET alumno:101  → un acceso por clave; la aplicación debe saber que Ana es 101 e interpretar el valor.',
      alumnosDe: 'Imposible sin otra clave: hay que mantener a mano curso:IIC2413:alumnos → [101, 103, 104, 106] y actualizarla en cada inscripción.',
    },
    columnas: {
      cursosDe: 'SELECT cursos FROM alumnos WHERE rol = 101  → una fila; la familia «cursos» tiene una columna por sigla.',
      alumnosDe: 'Se modela una segunda tabla con clave de partición = sigla (alumnos_por_curso). En Cassandra se diseña una tabla por consulta.',
    },
    grafo: {
      cursosDe: 'MATCH (:Alumno {nombre:"Ana"})-[:INSCRITO]->(c:Curso) RETURN c.titulo  → seguir aristas desde un nodo.',
      alumnosDe: 'MATCH (a:Alumno)-[:INSCRITO]->(:Curso {titulo:"Bases de Datos"}) RETURN a.nombre  → las aristas se recorren en ambos sentidos sin junta.',
    },
  };

  function montarModelos(cuerpo) {
    const u = B.universidad();
    let modelo = 'documento', consulta = 'cursosDe';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Modelo', valor: modelo,
      opciones: [['relacional', 'relacional (tablas)'], ['documento', 'documentos (MongoDB)'], ['clavevalor', 'clave-valor (Redis)'], ['columnas', 'familias de columnas (Cassandra)'], ['grafo', 'grafo (Neo4j)']],
      alCambiar: (v) => { modelo = v; dibujar(); },
    });
    ctl.selector({ etiqueta: 'Consulta', valor: consulta, opciones: Object.entries(CONSULTAS), alCambiar: (v) => { consulta = v; dibujar(); } });
    const caja = el('div');
    cuerpo.appendChild(caja);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 340 });
    const leyenda = VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nodo Alumno', forma: 'punto' },
      { color: C.s2, texto: 'nodo Curso', forma: 'punto' },
      { color: C.tinta2, texto: 'arista INSCRITO {nota}', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un modelo y una consulta. Cada modelo hace fácil una consulta a costa de otra.');

    function dibujarGrafo() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const A = u.alumnos.filas, Cu = u.cursos.filas;
      const pa = (i) => ({ x: Math.max(60, W * 0.2), y: 24 + (i * (H - 48)) / (A.length - 1) });
      const pc = (i) => ({ x: Math.min(W - 90, W * 0.72), y: 40 + (i * (H - 80)) / (Cu.length - 1) });
      const ana = A.find((a) => a.nombre === 'Ana').rol;
      u.inscripciones.filas.forEach((ins) => {
        const a = pa(A.findIndex((x) => x.rol === ins.rol)), c = pc(Cu.findIndex((x) => x.sigla === ins.sigla));
        const resalta = consulta === 'cursosDe' ? ins.rol === ana : ins.sigla === 'IIC2413';
        ctx.strokeStyle = resalta ? C.tinta : C.tenue; ctx.lineWidth = resalta ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      });
      A.forEach((a, i) => { const p = pa(i); VIZ.marcador(ctx, p.x, p.y, C.s1, 7); B.texto(ctx, a.nombre, p.x - 14, p.y, { alinear: 'right', color: C.tinta, px: 12 }); });
      Cu.forEach((c, i) => { const p = pc(i); VIZ.marcador(ctx, p.x, p.y, C.s2, 7); B.texto(ctx, c.titulo, p.x + 14, p.y, { color: C.tinta, px: W < 500 ? 10 : 12 }); });
    }
    function dibujar() {
      const grafo = modelo === 'grafo';
      lienzo.envoltura.hidden = !grafo;
      leyenda.caja.hidden = !grafo;
      caja.replaceChildren();
      if (modelo === 'relacional') {
        const g = B.grupoTablas(caja);
        g.append(B.tabla(u.alumnos, { claves: ['rol'], maxFilas: 4 }), B.tabla(u.cursos, { claves: ['sigla'] }), B.tabla(u.inscripciones, { claves: ['rol', 'sigla'], maxFilas: 6 }));
      } else if (modelo === 'documento') {
        caja.appendChild(el('pre', { class: 'codigo-bdd caja-alta' }, JSON.stringify(documentos(u).slice(0, 2), null, 2) + '\n// … y un documento por cada alumno'));
      } else if (modelo === 'clavevalor') {
        const pares = documentos(u).map((d) => `alumno:${d._id}  →  "${JSON.stringify({ nombre: d.nombre, cursos: d.cursos.map((c) => c.sigla) }).replace(/"/g, '\\"')}"`);
        caja.appendChild(el('div', { class: 'lista-mono' }, ...pares.map((p) => el('div', null, p)), el('div', null, 'curso:IIC2413:alumnos  →  [101, 103, 104, 106]   (índice mantenido a mano)')));
      } else if (modelo === 'columnas') {
        const docs = documentos(u);
        const siglas = [...new Set(docs.flatMap((d) => d.cursos.map((c) => c.sigla)))];
        const R = B.rel('alumnos (familias: datos | cursos)', ['rol', 'datos:nombre', 'datos:carrera', ...siglas.map((s) => `cursos:${s}`)],
          docs.map((d) => Object.fromEntries([['rol', d._id], ['datos:nombre', d.nombre], ['datos:carrera', d.carrera], ...siglas.map((s) => [`cursos:${s}`, (d.cursos.find((c) => c.sigla === s) || {}).nota ?? null])])));
        const g = B.grupoTablas(caja);
        g.append(B.tabla(R, { claves: ['rol'], celda: (f, a) => (f[a] == null ? C.neutro : null) }));
      } else dibujarGrafo();
      registro.textContent = RESPUESTA[modelo][consulta];
      const rasgos = {
        relacional: ['esquema fijo', 'juntas', 'ACID'], documento: ['esquema flexible', 'datos embebidos', 'por documento'],
        clavevalor: ['sin esquema', 'solo GET/PUT', 'muy rápido'], columnas: ['filas anchas y dispersas', 'diseño por consulta', 'eventual o ajustable'],
        grafo: ['nodos y aristas', 'recorridos', 'ACID en Neo4j'],
      }[modelo];
      lectura.set([['esquema', rasgos[0]], ['acceso', rasgos[1]], ['consistencia', rasgos[2]]]);
    }
    lienzo.alDibujar = () => modelo === 'grafo' && dibujarGrafo();
    dibujar();
  }

  /* ---------- Fig. 2: hashing consistente ---------- */

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    // Mezcla final (fmix32 de MurmurHash3) para repartir bien claves parecidas.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function montarAnillo(cuerpo) {
    let nodos = 4, virtuales = false, previo = null, movidas = 0, movidasMod = 0, mensaje = '';
    const CLAVES = Array.from({ length: 60 }, (_, i) => `k${i}`);
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: '8 nodos virtuales por servidor', valor: virtuales, alCambiar: (v) => { virtuales = v; previo = null; mensaje = 'Se recalculó el anillo.'; dibujar(); } });
    ctl.boton('Agregar servidor', () => { if (nodos < 8) { cambiar(nodos + 1); } }, { primario: true });
    ctl.boton('Quitar servidor', () => { if (nodos > 2) cambiar(nodos - 1); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada clave pertenece al primer servidor que aparece en el anillo en sentido horario. Agregue o quite servidores y cuente cuántas claves cambian de dueño.');

    const puntos = (n) => {
      const p = [];
      for (let s = 0; s < n; s++) for (let v = 0; v < (virtuales ? 8 : 1); v++) p.push({ s, h: hash(`servidor${s}#${v}`) });
      return p.sort((a, b) => a.h - b.h);
    };
    const dueno = (h, P) => (P.find((p) => p.h >= h) || P[0]).s;
    const asignar = (n) => { const P = puntos(n); return CLAVES.map((k) => dueno(hash(k), P)); };
    function cambiar(n) {
      const antes = asignar(nodos), despues = asignar(n);
      movidas = antes.filter((s, i) => s !== despues[i]).length;
      movidasMod = CLAVES.filter((k) => Math.floor(hash(k) * 1e6) % nodos !== Math.floor(hash(k) * 1e6) % n).length;
      mensaje = `${n > nodos ? 'Entra' : 'Sale'} el servidor ${n > nodos ? n : nodos}: ${movidas} de ${CLAVES.length} claves cambian de dueño. Con hash(k) mod n se habrían movido ${movidasMod}.`;
      previo = antes; nodos = n;
      dibujar();
    }
    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 30;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const ang = (h) => -Math.PI / 2 + h * Math.PI * 2;
      const P = puntos(nodos), asig = asignar(nodos);
      geo = [];
      CLAVES.forEach((k, i) => {
        const a = ang(hash(k)), x = cx + Math.cos(a) * (r - 14), y = cy + Math.sin(a) * (r - 14);
        const movida = previo && previo[i] !== asig[i];
        VIZ.marcador(ctx, x, y, VIZ.series[asig[i]], movida ? 5 : 3.5, asig[i]);
        if (movida) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke(); }
        geo.push({ x, y, html: `clave <b>${k}</b><br>hash ${VIZ.fmt(hash(k), 3)}<br>servidor ${asig[i] + 1}` });
      });
      P.forEach((p) => {
        const a = ang(p.h), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        ctx.fillStyle = VIZ.series[p.s];
        ctx.beginPath(); ctx.rect(x - 6, y - 6, 12, 12); ctx.fill();
        ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, 12, 12);
        if (!virtuales) B.texto(ctx, `S${p.s + 1}`, cx + Math.cos(a) * (r + 18), cy + Math.sin(a) * (r + 18), { alinear: 'center', color: C.tinta, px: 11, peso: 600 });
      });
      leyenda.set([...Array(nodos)].map((_, s) => ({ color: VIZ.series[s], texto: `S${s + 1}: ${asig.filter((x) => x === s).length} claves` })));
      registro.textContent = mensaje || `${nodos} servidores en el anillo. Los cuadrados son posiciones de servidores; los puntos, claves.`;
      const cargas = [...Array(nodos)].map((_, s) => asig.filter((x) => x === s).length);
      lectura.set([
        ['servidores', String(nodos)],
        ['carga máx / ideal', `${Math.max(...cargas)} / ${VIZ.fmt(CLAVES.length / nodos, 3)}`],
        ['movidas (anillo)', previo ? String(movidas) : '—'],
        ['movidas (mod n)', previo ? String(movidasMod) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.hypot(q.x - x, q.y - y) < 7);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, g.html);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('nosql', {
    intro: String.raw`
      <p><strong>NoSQL</strong> («no solo SQL») agrupa bases que abandonan alguna pieza del modelo relacional para ganar otra cosa:
      esquemas flexibles, escalar horizontalmente a cientos de servidores o recorrer relaciones sin juntas. No hay un modelo NoSQL sino
      varios: documentos, clave-valor, familias de columnas y grafos.</p>
      <p>La idea central es diseñar el almacenamiento <strong>según las consultas</strong> que se harán, no según la estructura de los datos.
      Se desnormaliza a propósito: se copian datos para que cada consulta frecuente sea una sola lectura, y se paga en consistencia y en
      actualizaciones más difíciles.</p>`,
    visualizaciones: [
      {
        titulo: 'Los mismos datos en cinco modelos',
        descripcion: 'Alumnos, cursos e inscripciones como tablas, documentos, pares clave-valor, filas anchas y grafo. Cambie la consulta: lo que es una lectura en un modelo es un recorrido completo en otro.',
        montar: montarModelos,
      },
      {
        titulo: 'Hashing consistente',
        descripcion: 'Cómo una base distribuida reparte claves entre servidores. Al agregar un servidor solo se mueve ~1/n de las claves, en vez de casi todas. Active los nodos virtuales para equilibrar la carga.',
        montar: montarAnillo,
      },
    ],
    teoria: String.raw`
      <h2>Modelos</h2>
      <table>
        <tr><th>Modelo</th><th>Ejemplos</th><th>Unidad</th><th>Fuerte en</th></tr>
        <tr><td>documentos</td><td>MongoDB, CouchDB</td><td>documento JSON/BSON</td><td>agregados que se leen juntos</td></tr>
        <tr><td>clave-valor</td><td>Redis, DynamoDB</td><td>valor opaco por clave</td><td>cachés, sesiones, contadores</td></tr>
        <tr><td>familias de columnas</td><td>Cassandra, HBase, Bigtable</td><td>fila ancha y dispersa</td><td>escrituras masivas, series de tiempo</td></tr>
        <tr><td>grafos</td><td>Neo4j, Neptune</td><td>nodos y aristas con propiedades</td><td>recorridos de varios saltos</td></tr>
      </table>

      <h2>Teorema CAP</h2>
      <p>En un sistema distribuido, cuando hay una <strong>partición</strong> de red (P) hay que elegir entre <strong>consistencia</strong> (C:
      toda lectura ve la última escritura) y <strong>disponibilidad</strong> (A: toda petición recibe respuesta). PACELC agrega que, aun sin
      partición, hay que elegir entre latencia y consistencia.</p>
      <p>Muchas bases NoSQL ofrecen <strong>consistencia eventual</strong> (BASE: <em>basically available, soft state, eventually
      consistent</em>) y la ajustan por operación con <em>quórums</em>: con \(N\) réplicas, si una escritura espera \(W\) confirmaciones y
      una lectura consulta \(R\) réplicas,</p>
      \[ R + W &gt; N \;\Rightarrow\; \text{toda lectura ve la última escritura confirmada}. \]

      <h2>Hashing consistente</h2>
      <p>Con \(\text{servidor} = h(k) \bmod n\), cambiar \(n\) mueve casi todas las claves: una fracción \(1 - 1/n\) en promedio. En el
      <strong>anillo</strong>, servidores y claves se ubican en \([0, 1)\) con la misma función de hash, y cada clave pertenece al siguiente
      servidor en sentido horario. Agregar un servidor solo le quita claves a su vecino: se mueve en promedio \(1/(n+1)\) de las claves.</p>
      <div class="recuadro">Con un solo punto por servidor, la carga es muy desigual (el arco más largo puede ser \(\Theta(\log n / n)\)).
      Con \(v\) <strong>nodos virtuales</strong> por servidor la carga se concentra alrededor de \(1/n\). Lo usan Dynamo, Cassandra y
      Riak.</div>
      <p>Compárelo con el <a href="tema.html?id=hash">hashing</a> clásico de una tabla en memoria y con el
      <a href="tema.html?id=modelo-relacional">modelo relacional</a>, que normaliza en vez de copiar.</p>`,
  });
})();
