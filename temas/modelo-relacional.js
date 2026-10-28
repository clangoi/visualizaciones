(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: superclaves y claves candidatas ---------- */

  const ALUMNOS = B.rel('Alumnos', ['rol', 'rut', 'nombre', 'carrera', 'ingreso'], [
    [101, '20.111.222-3', 'Ana', 'Informática', 2022], [102, '19.333.444-5', 'Bruno', 'Civil', 2021],
    [103, '21.555.666-7', 'Carla', 'Informática', 2023], [104, '20.777.888-9', 'Diego', 'Eléctrica', 2022],
    [105, '21.999.000-1', 'Ana', 'Civil', 2023], [106, '19.222.111-0', 'Felipe', 'Informática', 2021],
  ]);
  const esSuperclave = (R, X) => X.length > 0 && new Set(R.filas.map((f) => X.map((a) => f[a]).join('|'))).size === R.filas.length;

  function montarClaves(cuerpo) {
    const R = ALUMNOS;
    const ctl = VIZ.controles(cuerpo);
    const elegidos = ctl.casillas(R.atributos.map((a) => ({ clave: a, texto: a, activo: a === 'nombre' })), () => dibujar());
    ctl.boton('Probar {nombre, ingreso}', () => fijar(['nombre', 'ingreso']));
    ctl.boton('Probar {rol, nombre}', () => fijar(['rol', 'nombre']), { primario: true });
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'atributos elegidos X' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 'filas que coinciden en X' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque y desmarque atributos. Una instancia puede refutar que X sea clave, pero nunca demostrarlo.');

    const casillas = [...ctl.caja.querySelectorAll('.grupo-casillas input')];
    function fijar(X) {
      R.atributos.forEach((a, i) => { elegidos[a] = X.includes(a); casillas[i].checked = X.includes(a); });
      dibujar();
    }

    // Todas las claves candidatas de la instancia: superclaves minimales.
    function candidatas() {
      const n = R.atributos.length, sup = [];
      for (let m = 1; m < 1 << n; m++) {
        const X = R.atributos.filter((_, i) => m & (1 << i));
        if (esSuperclave(R, X)) sup.push(m);
      }
      return sup.filter((m) => !sup.some((o) => o !== m && (o & m) === o)).map((m) => R.atributos.filter((_, i) => m & (1 << i)));
    }
    const CANDIDATAS = candidatas();

    function dibujar() {
      const X = R.atributos.filter((a) => elegidos[a]);
      const cuenta = new Map();
      R.filas.forEach((f) => { const k = X.map((a) => f[a]).join('|'); cuenta.set(k, (cuenta.get(k) || 0) + 1); });
      const choca = (f) => X.length && cuenta.get(X.map((a) => f[a]).join('|')) > 1;
      caja.replaceChildren(B.tabla(R, {
        claves: X,
        fila: (f) => (choca(f) ? C.s8 : null),
        celda: (f, a) => (choca(f) ? null : elegidos[a] ? C.s1 : null),
      }));
      const sup = esSuperclave(R, X);
      const minimal = sup && X.every((a) => !esSuperclave(R, X.filter((b) => b !== a)));
      const repetidas = R.filas.filter(choca).length;
      registro.textContent = !X.length
        ? 'Elija al menos un atributo.'
        : !sup ? `{${X.join(', ')}} no es superclave: ${repetidas} filas comparten los mismos valores en X.`
          : minimal ? `{${X.join(', ')}} es clave candidata: identifica cada fila y ningún subconjunto propio lo hace.`
            : `{${X.join(', ')}} es superclave pero no minimal: puede quitar algún atributo y seguir identificando cada fila.`;
      lectura.set([
        ['|X|', String(X.length)],
        ['valores distintos de X', `${cuenta.size} de ${R.filas.length}`],
        ['¿superclave?', sup ? 'sí' : 'no'],
        ['¿clave candidata?', minimal ? 'sí' : 'no'],
        ['candidatas en la instancia', CANDIDATAS.map((k) => `{${k.join(',')}}`).join(' ')],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: integridad referencial ---------- */

  function montarIntegridad(cuerpo) {
    let politica = 'restrict', alumnos, inscritos, marcas, mensaje;
    function restablecer() {
      const u = B.universidad();
      alumnos = u.alumnos; inscritos = u.inscripciones;
      marcas = { a: new Map(), i: new Map() };
      mensaje = 'Estado inicial. Inscripciones.rol es una clave foránea que referencia Alumnos.rol.';
    }
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'ON DELETE', valor: politica,
      opciones: [['restrict', 'RESTRICT (rechazar)'], ['cascade', 'CASCADE (propagar)'], ['setnull', 'SET NULL']],
      alCambiar: (v) => { politica = v; restablecer(); mensaje = `Política cambiada a ${v.toUpperCase()}. Estado restablecido.`; dibujar(); },
    });
    const limpiar = () => { marcas = { a: new Map(), i: new Map() }; };
    ctl.boton('Borrar alumno 106', () => borrar(106), { primario: true });
    ctl.boton('Borrar alumno 105', () => borrar(105));
    ctl.boton('Inscribir 999 en IIC2413', () => {
      limpiar();
      mensaje = 'INSERT rechazado: no existe un alumno con rol 999 (violación de clave foránea).';
      dibujar();
    });
    ctl.boton('Insertar alumno 101 otra vez', () => {
      limpiar();
      alumnos.filas.forEach((f, k) => { if (f.rol === 101) marcas.a.set(k, C.s8); });
      mensaje = 'INSERT rechazado: ya existe una fila con rol 101 (violación de clave primaria).';
      dibujar();
    });
    ctl.boton('Inscribir 105 en IIC2413', () => {
      limpiar();
      if (!alumnos.filas.some((f) => f.rol === 105)) { mensaje = 'INSERT rechazado: el alumno 105 ya no existe.'; return dibujar(); }
      if (inscritos.filas.some((f) => f.rol === 105 && f.sigla === 'IIC2413')) { mensaje = 'INSERT rechazado: la inscripción ya existe (clave primaria {rol, sigla}).'; return dibujar(); }
      inscritos.filas.push({ rol: 105, sigla: 'IIC2413', nota: null });
      marcas.i.set(inscritos.filas.length - 1, C.s6);
      mensaje = 'INSERT aceptado: el rol 105 existe en Alumnos y el par (105, IIC2413) es nuevo.';
      dibujar();
    });
    ctl.boton('Restablecer', () => { restablecer(); dibujar(); });

    function borrar(rol) {
      limpiar();
      const ia = alumnos.filas.findIndex((f) => f.rol === rol);
      if (ia < 0) { mensaje = `No hay alumno ${rol}: ya fue borrado.`; return dibujar(); }
      const dep = inscritos.filas.map((f, k) => (f.rol === rol ? k : -1)).filter((k) => k >= 0);
      if (dep.length && politica === 'restrict') {
        marcas.a.set(ia, C.s8); dep.forEach((k) => marcas.i.set(k, C.s8));
        mensaje = `DELETE rechazado: ${dep.length} inscripciones referencian al alumno ${rol}.`;
        return dibujar();
      }
      alumnos.filas.splice(ia, 1);
      if (politica === 'cascade') {
        inscritos.filas = inscritos.filas.filter((f) => f.rol !== rol);
        mensaje = `Alumno ${rol} borrado; CASCADE borró también sus ${dep.length} inscripciones.`;
      } else if (politica === 'setnull') {
        dep.forEach((k) => { inscritos.filas[k].rol = null; marcas.i.set(k, C.s4); });
        mensaje = `Alumno ${rol} borrado; ${dep.length} inscripciones quedaron con rol NULL.`;
      } else mensaje = `Alumno ${rol} borrado: no tenía inscripciones que lo referencien.`;
      dibujar();
    }

    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.18), texto: 'fila insertada' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 'fila que causa el rechazo' },
      { color: VIZ.alfa(C.s4, 0.18), texto: 'clave foránea puesta en NULL' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie la política ON DELETE y borre al alumno 106, que tiene cuatro inscripciones.');

    function dibujar() {
      caja.replaceChildren(
        B.tabla(alumnos, { claves: ['rol'], fila: (f, k) => marcas.a.get(k) }),
        B.tabla(inscritos, { claves: ['rol', 'sigla'], fila: (f, k) => marcas.i.get(k) }));
      registro.textContent = mensaje;
      const huerfanas = inscritos.filas.filter((f) => f.rol == null).length;
      lectura.set([
        ['alumnos', String(alumnos.filas.length)],
        ['inscripciones', String(inscritos.filas.length)],
        ['con rol NULL', String(huerfanas)],
        ['política', politica.toUpperCase()],
      ]);
    }
    restablecer();
    dibujar();
  }

  VIZ.registrarTema('modelo-relacional', {
    intro: String.raw`
      <p>El <strong>modelo relacional</strong>, propuesto por Edgar F. Codd en 1970, representa los datos como <em>relaciones</em>: tablas
      cuyas filas (tuplas) son hechos y cuyas columnas (atributos) tienen un dominio. Una relación es un <em>conjunto</em>: no tiene filas
      repetidas ni un orden propio, y cada celda guarda un valor atómico.</p>
      <p>La idea clave es separar <em>qué</em> datos hay de <em>cómo</em> se guardan. Las relaciones se vinculan por valores, no por
      punteros: una inscripción sabe a qué alumno pertenece porque guarda su rol. Las <strong>claves</strong> y las
      <strong>restricciones de integridad</strong> son las reglas que mantienen ese vínculo coherente.</p>`,
    visualizaciones: [
      {
        titulo: 'Superclaves y claves candidatas',
        descripcion: 'Elija un conjunto de atributos X y vea si distingue todas las filas. Observe que {nombre} falla porque hay dos Ana, y que {rol, nombre} identifica pero no es minimal.',
        montar: montarClaves,
      },
      {
        titulo: 'Integridad referencial',
        descripcion: 'Inserte y borre filas bajo las tres políticas de ON DELETE. Pruebe a borrar al alumno 106 con RESTRICT, CASCADE y SET NULL.',
        montar: montarIntegridad,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Un <strong>esquema de relación</strong> \(R(A_1, \dots, A_n)\) es un nombre y una lista de atributos, cada uno con un dominio
      \(\text{dom}(A_i)\). Una <strong>instancia</strong> de \(R\) es un conjunto finito de tuplas</p>
      \[ r \subseteq \text{dom}(A_1) \times \cdots \times \text{dom}(A_n). \]
      <p>El número de atributos es el <em>grado</em> y el número de tuplas, la <em>cardinalidad</em>. Un <strong>esquema de base de datos</strong>
      es un conjunto de esquemas de relación junto con sus restricciones.</p>

      <h2>Claves</h2>
      <p>Un conjunto \(X\) de atributos es <strong>superclave</strong> de \(R\) si en toda instancia válida dos tuplas distintas difieren en
      algún atributo de \(X\):</p>
      \[ \forall\, t_1 \ne t_2 \in r:\; t_1[X] \ne t_2[X]. \]
      <p>Una <strong>clave candidata</strong> es una superclave minimal: ningún subconjunto propio es superclave. Se elige una como
      <strong>clave primaria</strong> (se subraya en el esquema). Una <strong>clave foránea</strong> \(Y\) en \(S\) que referencia la clave
      primaria \(X\) de \(R\) exige \(\pi_Y(s) \subseteq \pi_X(r)\), salvo los valores nulos.</p>
      <div class="recuadro">Ser clave es una afirmación sobre <em>todas</em> las instancias posibles, es decir, sobre el significado de los
      datos. Una instancia concreta solo puede refutarla: en la figura, {carrera, ingreso} identifica las filas de hoy, pero nada impide
      que mañana entre otro alumno de Civil de 2021.</div>

      <h2>Restricciones de integridad</h2>
      <table>
        <tr><th>Restricción</th><th>Exige</th><th>Se viola al</th></tr>
        <tr><td>de dominio</td><td>valores del tipo declarado</td><td>insertar o actualizar</td></tr>
        <tr><td>de entidad</td><td>clave primaria única y no nula</td><td>insertar una clave repetida</td></tr>
        <tr><td>referencial</td><td>cada clave foránea apunta a una fila existente</td><td>insertar en la hija o borrar en la madre</td></tr>
      </table>
      <p>Cuando se borra o actualiza una fila referenciada, SQL ofrece <code>RESTRICT</code>/<code>NO ACTION</code> (rechazar),
      <code>CASCADE</code> (propagar), <code>SET NULL</code> y <code>SET DEFAULT</code>.</p>
      <pre><code>CREATE TABLE Inscripciones (
  rol   INT REFERENCES Alumnos(rol) ON DELETE CASCADE,
  sigla CHAR(7) REFERENCES Cursos(sigla),
  nota  NUMERIC(2,1) CHECK (nota BETWEEN 1.0 AND 7.0),
  PRIMARY KEY (rol, sigla)
);</code></pre>

      <h2>Conexiones</h2>
      <p>Las consultas sobre relaciones se expresan en <a href="tema.html?id=algebra-relacional">álgebra relacional</a> y en
      <a href="tema.html?id=sql">SQL</a>. Qué atributos forman una clave se deduce de las
      <a href="tema.html?id=formas-normales">dependencias funcionales</a>, y el esquema suele obtenerse de un
      <a href="tema.html?id=diagrama-er">diagrama E/R</a>.</p>`,
  });
})();
