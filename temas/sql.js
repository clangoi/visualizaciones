(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: orden lógico de evaluación ---------- */

  const FILTROS = {
    no: { sql: null, f: () => true },
    nota: { sql: 'nota >= 5.0', f: (r) => r.nota >= 5 },
    inf: { sql: "carrera = 'Informática'", f: (r) => r.carrera === 'Informática' },
  };
  const AGREGADOS = {
    count: { sql: 'COUNT(*)', col: 'count', f: (g) => g.length },
    avg: { sql: 'AVG(nota)', col: 'avg', f: (g) => +(g.reduce((s, r) => s + r.nota, 0) / g.length).toFixed(2) },
    max: { sql: 'MAX(nota)', col: 'max', f: (g) => Math.max(...g.map((r) => r.nota)) },
  };

  function montarConsulta(cuerpo) {
    const o = { where: 'nota', group: 'carrera', agg: 'avg', having: true, order: true };
    let etapa = -1, tablaActual = null, grupos = null, mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'WHERE', valor: o.where, opciones: [['no', '(sin filtro)'], ['nota', 'nota >= 5.0'], ['inf', "carrera = 'Informática'"]], alCambiar: (v) => { o.where = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'GROUP BY', valor: o.group, opciones: [['carrera', 'carrera'], ['sigla', 'sigla'], ['nombre', 'nombre']], alCambiar: (v) => { o.group = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Agregado', valor: o.agg, opciones: Object.entries(AGREGADOS).map(([k, v]) => [k, v.sql]), alCambiar: (v) => { o.agg = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'HAVING COUNT(*) >= 2', valor: o.having, alCambiar: (v) => { o.having = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'ORDER BY agregado DESC', valor: o.order, alCambiar: (v) => { o.order = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const caja = B.grupoTablas(cuerpo);
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El texto de la consulta se escribe en otro orden que el que se evalúa: siga el resaltado.');

    const ETAPAS = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY'];
    function lineas() {
      const a = AGREGADOS[o.agg];
      return [
        ['SELECT', `SELECT ${o.group}, ${a.sql} AS ${a.col}`],
        ['FROM', 'FROM Alumnos JOIN Inscripciones USING (rol)'],
        ['WHERE', FILTROS[o.where].sql ? `WHERE ${FILTROS[o.where].sql}` : null],
        ['GROUP BY', `GROUP BY ${o.group}`],
        ['HAVING', o.having ? 'HAVING COUNT(*) >= 2' : null],
        ['ORDER BY', o.order ? `ORDER BY ${a.col} DESC` : null],
      ].filter((l) => l[1]);
    }
    function iniciar() {
      const { alumnos, inscripciones } = B.universidad();
      etapa = -1; tablaActual = null; grupos = null;
      mensaje = 'Pulse «Un paso»: el motor evalúa primero FROM, no SELECT.';
      return (function* () {
        const a = AGREGADOS[o.agg];
        etapa = 0; tablaActual = B.juntar(alumnos, inscripciones, 'FROM');
        mensaje = `FROM: la junta produce ${tablaActual.filas.length} filas, una por inscripción.`; yield;
        if (FILTROS[o.where].sql) {
          etapa = 1; const antes = tablaActual.filas.length;
          tablaActual = B.seleccionar(tablaActual, FILTROS[o.where].f, 'WHERE');
          mensaje = `WHERE: se filtran filas individuales; quedan ${tablaActual.filas.length} de ${antes}. Aquí todavía no existen los grupos, por eso WHERE no puede usar COUNT.`; yield;
        }
        etapa = 2;
        const m = new Map();
        tablaActual.filas.forEach((r) => { const k = r[o.group]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
        grupos = [...m];
        mensaje = `GROUP BY ${o.group}: ${grupos.length} grupos. Desde ahora cada grupo será una sola fila del resultado.`; yield;
        if (o.having) {
          etapa = 3; const antes = grupos.length;
          grupos = grupos.filter(([, g]) => g.length >= 2);
          mensaje = `HAVING: se filtran grupos completos; quedan ${grupos.length} de ${antes}.`; yield;
        }
        etapa = 4;
        let res = grupos.map(([k, g]) => ({ [o.group]: k, [a.col]: a.f(g) }));
        tablaActual = B.rel('SELECT', [o.group, a.col], res); grupos = null;
        mensaje = `SELECT: se calcula ${a.sql} en cada grupo y se proyectan las columnas pedidas. El alias ${a.col} recién existe aquí.`; yield;
        if (o.order) {
          etapa = 5;
          res = [...res].sort((x, y) => y[a.col] - x[a.col]);
          tablaActual = B.rel('ORDER BY', [o.group, a.col], res);
          mensaje = `ORDER BY ${a.col} DESC: puede usar el alias porque se evalúa después de SELECT.`; yield;
        }
        etapa = 6;
        mensaje = `Resultado: ${tablaActual.filas.length} filas.`;
      })();
    }
    function dibujar() {
      const actual = ETAPAS[etapa];
      codigo.replaceChildren(...lineas().map(([e, t], i) => [i ? '\n' : '', e === actual ? el('span', { class: 'marca' }, t) : t]).flat());
      if (grupos) {
        caja.replaceChildren(...grupos.map(([k, g], i) => B.tabla(B.rel(`grupo ${k}`, ['rol', 'nombre', 'carrera', 'sigla', 'nota'], g),
          { fila: () => VIZ.series[i % 8] })));
        ley.set(grupos.slice(0, 8).map(([k], i) => ({ color: VIZ.alfa(VIZ.series[i % 8], 0.18), texto: `grupo ${k}` })));
      } else {
        caja.replaceChildren(...(tablaActual ? [B.tabla(tablaActual, { maxFilas: 12 })] : []));
        ley.set([{ color: VIZ.alfa(C.s2, 0.22), texto: 'cláusula que se evalúa' }]);
      }
      registro.textContent = mensaje;
      lectura.set([
        ['etapa', etapa < 0 ? '—' : etapa >= 6 ? 'fin' : actual],
        ['filas', tablaActual ? String(tablaActual.filas.length) : '—'],
        ['grupos', grupos ? String(grupos.length) : '—'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: tipos de JOIN ---------- */

  function montarJoins(cuerpo) {
    const CURSOS = B.rel('Cursos', ['sigla', 'titulo', 'prof'], [
      ['IIC2413', 'Bases de Datos', 1], ['IIC2133', 'Estructuras', 2], ['MAT1610', 'Cálculo I', 3], ['IIC3633', 'Privacidad', null],
    ]);
    const PROFS = B.rel('Profesores', ['id', 'nombre'], [[1, 'Rosa'], [2, 'Tomás'], [4, 'Úrsula'], [5, 'Víctor']]);
    let tipo = 'left';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Tipo de junta', valor: tipo,
      opciones: [['inner', 'INNER JOIN'], ['left', 'LEFT OUTER JOIN'], ['right', 'RIGHT OUTER JOIN'], ['full', 'FULL OUTER JOIN'], ['cross', 'CROSS JOIN']],
      alCambiar: (v) => { tipo = v; dibujar(); },
    });
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const entradas = B.grupoTablas(cuerpo);
    VIZ.subtitulo(cuerpo, 'Resultado');
    const salida = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'par que cumple c.prof = p.id' },
      { color: VIZ.alfa(C.s2, 0.18), texto: 'solo izquierda (rellena con NULL)' },
      { color: VIZ.alfa(C.s3, 0.18), texto: 'solo derecha (rellena con NULL)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Privacidad no tiene profesor (NULL) y Úrsula y Víctor no dictan cursos: mire dónde aparecen según el tipo de junta.');

    function dibujar() {
      const atr = ['sigla', 'titulo', 'prof', 'id', 'nombre'];
      const filas = [], usadosP = new Set(), usadosC = new Set();
      if (tipo === 'cross') {
        CURSOS.filas.forEach((c) => PROFS.filas.forEach((p) => filas.push({ ...c, ...p, _t: c.prof === p.id ? 'par' : null })));
      } else {
        CURSOS.filas.forEach((c, i) => PROFS.filas.forEach((p, j) => {
          if (c.prof != null && c.prof === p.id) { filas.push({ ...c, ...p, _t: 'par' }); usadosC.add(i); usadosP.add(j); }
        }));
        if (tipo === 'left' || tipo === 'full') CURSOS.filas.forEach((c, i) => { if (!usadosC.has(i)) filas.push({ ...c, id: null, nombre: null, _t: 'izq' }); });
        if (tipo === 'right' || tipo === 'full') PROFS.filas.forEach((p, j) => { if (!usadosP.has(j)) filas.push({ sigla: null, titulo: null, prof: null, ...p, _t: 'der' }); });
      }
      const col = { par: C.s1, izq: C.s2, der: C.s3 };
      const nombre = { inner: 'INNER JOIN', left: 'LEFT OUTER JOIN', right: 'RIGHT OUTER JOIN', full: 'FULL OUTER JOIN', cross: 'CROSS JOIN' }[tipo];
      codigo.textContent = `SELECT *\nFROM Cursos c ${nombre} Profesores p${tipo === 'cross' ? '' : '\n  ON c.prof = p.id'};`;
      entradas.replaceChildren(
        B.tabla(CURSOS, { fila: (f, i) => (tipo === 'cross' ? null : usadosC.has(i) ? C.s1 : tipo === 'left' || tipo === 'full' ? C.s2 : null) }),
        B.tabla(PROFS, { fila: (f, j) => (tipo === 'cross' ? null : usadosP.has(j) ? C.s1 : tipo === 'right' || tipo === 'full' ? C.s3 : null) }));
      salida.replaceChildren(B.tabla(B.rel('resultado', atr, filas), { fila: (f) => col[f._t], maxFilas: 16 }));
      const n = (t) => filas.filter((f) => f._t === t).length;
      registro.textContent = {
        inner: 'INNER: solo los pares que cumplen la condición. Las filas sin pareja desaparecen, igual que en la junta del álgebra.',
        left: 'LEFT: todos los cursos; los que no tienen profesor aparecen con las columnas de Profesores en NULL.',
        right: 'RIGHT: todos los profesores; los que no dictan cursos aparecen con las columnas de Cursos en NULL.',
        full: 'FULL: unión de LEFT y RIGHT, sin repetir los pares.',
        cross: 'CROSS: el producto cartesiano, 4 · 4 = 16 filas, sin condición.',
      }[tipo] + ' NULL = NULL no es verdadero, así que el curso con prof NULL nunca forma par.';
      lectura.set([['filas', String(filas.length)], ['pares', String(n('par'))], ['solo izquierda', String(n('izq'))], ['solo derecha', String(n('der'))]]);
    }
    dibujar();
  }

  VIZ.registrarTema('sql', {
    intro: String.raw`
      <p><strong>SQL</strong> (<em>Structured Query Language</em>) es el lenguaje estándar de las bases relacionales. Es
      <em>declarativo</em>: se describe qué filas se quieren, no cómo encontrarlas, y el motor decide el algoritmo. Tiene una parte para
      definir esquemas (DDL: <code>CREATE</code>, <code>ALTER</code>), otra para manipular datos (DML: <code>SELECT</code>,
      <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>) y otra para permisos (DCL: <code>GRANT</code>, <code>REVOKE</code>).</p>
      <p>Su sintaxis engaña: una consulta empieza con <code>SELECT</code>, pero eso es casi lo último que se evalúa. Entender el
      <strong>orden lógico</strong> explica la mayoría de los errores comunes.</p>`,
    visualizaciones: [
      {
        titulo: 'Orden lógico de una consulta',
        descripcion: 'Arme la consulta con los controles y avance cláusula por cláusula. Observe la diferencia entre WHERE (filtra filas) y HAVING (filtra grupos).',
        montar: montarConsulta,
      },
      {
        titulo: 'Tipos de JOIN',
        descripcion: 'Cursos y Profesores con filas sin pareja en ambos lados. Cambie el tipo de junta y vea qué filas se conservan y cuáles se rellenan con NULL.',
        montar: montarJoins,
      },
    ],
    teoria: String.raw`
      <h2>Forma general</h2>
      <pre><code>SELECT [DISTINCT] expresiones          -- 5
FROM tablas y juntas                    -- 1
WHERE condición sobre filas             -- 2
GROUP BY columnas                       -- 3
HAVING condición sobre grupos           -- 4
ORDER BY expresiones                    -- 6
LIMIT n;                                -- 7</code></pre>
      <p>Su significado se puede escribir en <a href="tema.html?id=algebra-relacional">álgebra relacional</a> extendida con agrupación
      \(\gamma\) y ordenamiento \(\tau\):</p>
      \[ \tau_{\text{ORDER}}\Big(\pi_{\text{SELECT}}\big(\sigma_{\text{HAVING}}(\gamma_{\text{GROUP},\,\text{agregados}}(\sigma_{\text{WHERE}}(\text{FROM})))\big)\Big). \]
      <div class="recuadro">Consecuencias del orden: WHERE no puede usar agregados (los grupos no existen todavía); SELECT no puede mostrar
      una columna que no esté en GROUP BY ni dentro de un agregado (¿qué valor tomaría para el grupo?); ORDER BY sí puede usar los alias de
      SELECT.</div>

      <h2>NULL y la lógica de tres valores</h2>
      <p>Una comparación con NULL no es verdadera ni falsa sino <em>desconocida</em>. WHERE solo conserva las filas donde la condición es
      verdadera, así que <code>WHERE x = NULL</code> nunca devuelve nada; se escribe <code>WHERE x IS NULL</code>.</p>
      <table>
        <tr><th>AND</th><th>V</th><th>F</th><th>D</th></tr>
        <tr><td>V</td><td>V</td><td>F</td><td>D</td></tr>
        <tr><td>F</td><td>F</td><td>F</td><td>F</td></tr>
        <tr><td>D</td><td>D</td><td>F</td><td>D</td></tr>
      </table>
      <p>Los agregados ignoran los NULL, salvo <code>COUNT(*)</code>, que cuenta filas.</p>

      <h2>Subconsultas</h2>
      <pre><code>-- Alumnos inscritos en algún curso de 5 créditos
SELECT nombre FROM Alumnos a
WHERE EXISTS (SELECT 1 FROM Inscripciones i JOIN Cursos c USING (sigla)
              WHERE i.rol = a.rol AND c.creditos = 5);

-- Alumnos inscritos en TODOS los cursos de 10 créditos (división)
SELECT nombre FROM Alumnos a
WHERE NOT EXISTS (SELECT * FROM Cursos c WHERE c.creditos = 10
                  AND NOT EXISTS (SELECT * FROM Inscripciones i
                                  WHERE i.rol = a.rol AND i.sigla = c.sigla));</code></pre>
      <p>La doble negación expresa «para todo»: no existe un curso de 10 créditos en el que el alumno no esté inscrito.</p>

      <h2>Conexiones</h2>
      <p>Cada consulta se convierte en un plan de operadores físicos (<a href="tema.html?id=iterador">iteradores</a>,
      <a href="tema.html?id=nested-loop-join">juntas</a>, <a href="tema.html?id=external-merge-sort">ordenamiento externo</a> para
      ORDER BY y GROUP BY). Construir SQL concatenando texto del usuario abre la puerta a la
      inyección SQL (vea <a href="tema.html?id=seguridad">seguridad</a>).</p>`,
  });
})();
