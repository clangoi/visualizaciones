(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: GRANT y REVOKE en cascada ---------- */

  const USUARIOS = ['DBA', 'Ana', 'Bruno', 'Carla', 'Diego'];
  const PASOS = [
    ['grant', 'DBA', 'Ana', true], ['grant', 'DBA', 'Bruno', true], ['grant', 'Ana', 'Carla', true],
    ['grant', 'Carla', 'Diego', false], ['grant', 'Bruno', 'Carla', false], ['revoke', 'DBA', 'Ana'],
  ];
  // Quién tiene el privilegio y quién puede otorgarlo, partiendo del dueño.
  function estado(aristas) {
    const tiene = new Set(['DBA']), opcion = new Set(['DBA']), validas = new Set();
    let cambio = true;
    while (cambio) {
      cambio = false;
      aristas.forEach((a, i) => {
        if (validas.has(i) || !opcion.has(a.de)) return;
        validas.add(i); tiene.add(a.a); if (a.opcion) opcion.add(a.a); cambio = true;
      });
    }
    return { tiene, opcion, validas };
  }

  function montarGrant(cuerpo) {
    let modo = 'cascade', aristas = [], k = -1, borradas = [], mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'REVOKE', valor: modo, opciones: [['cascade', 'CASCADE'], ['restrict', 'RESTRICT']], alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 320 });
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'GRANT … WITH GRANT OPTION', forma: 'linea' },
      { color: C.tinta2, texto: 'GRANT sin opción (línea delgada)', forma: 'linea' },
      { color: C.s8, texto: 'otorgamiento revocado o abandonado', forma: 'linea' },
      { color: C.s6, texto: 'usuario con SELECT', forma: 'punto' },
      { color: C.inactivo, texto: 'sin SELECT', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Al revocar a Ana, Carla conserva SELECT porque Bruno también se lo dio, pero pierde la opción de otorgarlo: el permiso que dio a Diego queda abandonado.');
    const sql = (p) => (p[0] === 'grant' ? `-- ${p[1]}:\nGRANT SELECT ON Notas TO ${p[2]}${p[3] ? ' WITH GRANT OPTION' : ''};` : `-- ${p[1]}:\nREVOKE SELECT ON Notas FROM ${p[2]} ${modo.toUpperCase()};`);
    function iniciar() {
      aristas = []; k = -1; borradas = [];
      mensaje = 'DBA es dueño de la tabla Notas y tiene todos los privilegios sobre ella.';
      return (function* () {
        for (k = 0; k < PASOS.length; k++) {
          const p = PASOS[k];
          if (p[0] === 'grant') {
            aristas.push({ de: p[1], a: p[2], opcion: p[3] });
            mensaje = `${p[1]} otorga SELECT a ${p[2]}${p[3] ? ' con opción de otorgarlo a otros' : ''}.`;
          } else {
            const i = aristas.findIndex((a) => a.de === p[1] && a.a === p[2]);
            const resto = aristas.filter((_, j) => j !== i);
            const st = estado(resto);
            const abandonadas = resto.filter((_, j) => !st.validas.has(j));
            if (modo === 'restrict' && abandonadas.length) {
              mensaje = `REVOKE … RESTRICT falla: ${abandonadas.map((a) => `${a.de} → ${a.a}`).join(', ')} dependen del privilegio de ${p[2]}. No cambia nada.`;
            } else {
              borradas = [aristas[i], ...abandonadas];
              aristas = resto.filter((_, j) => st.validas.has(j));
              mensaje = `Se revoca DBA → Ana${abandonadas.length ? ` y, en cascada, ${abandonadas.map((a) => `${a.de} → ${a.a}`).join(', ')}: quien lo otorgó ya no tiene la opción de otorgarlo` : ''}.`;
            }
          }
          yield;
        }
        k = PASOS.length - 1;
      })();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      codigo.textContent = k >= 0 ? sql(PASOS[k]) : '-- (sin sentencias aún)';
      const pos = {
        DBA: { x: W * 0.1, y: H / 2 }, Ana: { x: W * 0.36, y: H * 0.22 }, Bruno: { x: W * 0.36, y: H * 0.78 },
        Carla: { x: W * 0.64, y: H / 2 }, Diego: { x: W * 0.9, y: H / 2 },
      };
      const st = estado(aristas);
      const flechaEntre = (a, col, grueso, guiones) => {
        const p = pos[a.de], q = pos[a.a], ang = Math.atan2(q.y - p.y, q.x - p.x), r = 22;
        ctx.setLineDash(guiones || []);
        B.flecha(ctx, p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, q.x - Math.cos(ang) * r, q.y - Math.sin(ang) * r, col, grueso ? 3 : 1.5, 9);
        ctx.setLineDash([]);
      };
      borradas.forEach((a) => flechaEntre(a, C.s8, a.opcion, [5, 4]));
      aristas.forEach((a) => flechaEntre(a, a.opcion ? C.tinta : C.tinta2, a.opcion));
      for (const u of USUARIOS) {
        const p = pos[u], tiene = st.tiene.has(u);
        ctx.fillStyle = tiene ? C.s6 : C.inactivo;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill();
        B.texto(ctx, u, p.x, p.y, { alinear: 'center', color: C.sobre, px: 11, peso: 600 });
        if (st.opcion.has(u) && u !== 'DBA') B.texto(ctx, 'puede otorgar', p.x, p.y + 32, { alinear: 'center', px: 10, color: C.apagado });
      }
      registro.textContent = mensaje;
      lectura.set([
        ['con SELECT', [...st.tiene].filter((u) => u !== 'DBA').join(', ') || '—'],
        ['pueden otorgar', [...st.opcion].filter((u) => u !== 'DBA').join(', ') || '—'],
        ['otorgamientos vigentes', String(aristas.length)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: roles y seguridad por filas ---------- */

  const ROLES = {
    alumno: { 'SELECT Notas': 'propias', 'UPDATE Notas': 'no', 'SELECT Cursos': 'sí', 'SELECT Auditoria': 'no', 'DELETE Notas': 'no' },
    ayudante: { 'SELECT Notas': 'de sus cursos', 'UPDATE Notas': 'de sus cursos', 'SELECT Cursos': 'sí', 'SELECT Auditoria': 'no', 'DELETE Notas': 'no' },
    profesor: { 'SELECT Notas': 'sí', 'UPDATE Notas': 'sí', 'SELECT Cursos': 'sí', 'SELECT Auditoria': 'no', 'DELETE Notas': 'no' },
    auditor: { 'SELECT Notas': 'no', 'UPDATE Notas': 'no', 'SELECT Cursos': 'sí', 'SELECT Auditoria': 'sí', 'DELETE Notas': 'no' },
  };
  const PERSONAS = { 'Ana (rol 101)': ['alumno', 101], 'Carla (rol 103)': ['alumno', 103], 'Felipe (ayudante de IIC2133)': ['ayudante', 'IIC2133'], 'Rosa (profesora)': ['profesor'], 'Olga (auditora)': ['auditor'] };
  const ACCIONES = Object.keys(ROLES.alumno);

  function montarRoles(cuerpo) {
    const { inscripciones } = B.universidad();
    let persona = 'Ana (rol 101)', accion = 'SELECT Notas';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Usuario', valor: persona, opciones: Object.keys(PERSONAS).map((p) => [p, p]), alCambiar: (v) => { persona = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Acción', valor: accion, opciones: ACCIONES.map((a) => [a, a]), alCambiar: (v) => { accion = v; dibujar(); } });
    const matriz = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(matriz);
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'rol del usuario y acción pedida' },
      { color: VIZ.alfa(C.s6, 0.18), texto: 'permitido / fila visible' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 'denegado' },
    ]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Los permisos se asignan a roles, no a personas. Elija un usuario y una acción: la matriz decide si puede, y la política por filas decide qué filas ve.');
    function dibujar() {
      const [rol, dato] = PERSONAS[persona];
      const R = B.rel('permisos por rol', ['rol', ...ACCIONES], Object.entries(ROLES).map(([r, p]) => ({ rol: r, ...p })));
      matriz.replaceChildren(B.tabla(R, {
        titulo: 'Matriz de permisos (RBAC)',
        celda: (f, a) => (f.rol === rol && a === accion ? (f[a] === 'no' ? C.s8 : C.s6) : f.rol === rol || a === accion ? C.s1 : null),
      }));
      const permiso = ROLES[rol][accion];
      let filtro = null;
      if (accion.endsWith('Notas') && permiso !== 'no') {
        if (permiso === 'propias') filtro = { sql: `rol = ${dato}`, f: (i) => i.rol === dato };
        else if (permiso === 'de sus cursos') filtro = { sql: `sigla IN (SELECT sigla FROM Ayudantias WHERE usuario = current_user)  -- ${dato}`, f: (i) => i.sigla === dato };
        else filtro = { sql: 'true', f: () => true };
      }
      codigo.textContent = [
        'CREATE ROLE alumno; CREATE ROLE ayudante; CREATE ROLE profesor; CREATE ROLE auditor;',
        'GRANT SELECT ON Notas TO alumno, ayudante, profesor;',
        'GRANT UPDATE (nota) ON Notas TO ayudante, profesor;',
        'ALTER TABLE Notas ENABLE ROW LEVEL SECURITY;',
        "CREATE POLICY propias ON Notas TO alumno USING (rol = current_setting('app.rol')::int);",
        'CREATE POLICY ayudantia ON Notas TO ayudante USING (sigla IN (SELECT sigla FROM Ayudantias WHERE usuario = current_user));',
      ].join('\n');
      if (filtro) {
        caja.replaceChildren(B.tabla(B.rel('Notas', inscripciones.atributos, inscripciones.filas), { titulo: `Notas vistas por ${persona.split(' ')[0]}`, fila: (f) => (filtro.f(f) ? C.s6 : null), tachada: (f) => !filtro.f(f) }));
      } else caja.replaceChildren();
      const ve = filtro ? inscripciones.filas.filter(filtro.f).length : 0;
      registro.textContent = permiso === 'no'
        ? `${accion}: DENEGADO. El rol ${rol} no tiene ese privilegio; el motor rechaza la sentencia antes de ejecutarla.`
        : filtro ? `${accion}: permitido para el rol ${rol}, con la política por filas «${filtro.sql}». ${accion.startsWith('SELECT') ? 've' : 'puede modificar'} ${ve} de ${inscripciones.filas.length} filas.`
          : `${accion}: permitido para el rol ${rol}.`;
    }
    dibujar();
  }

  VIZ.registrarTema('seguridad', {
    intro: String.raw`
      <p>La <strong>seguridad</strong> de una base de datos protege tres cosas: la <strong>confidencialidad</strong> (que solo lean quienes
      deben), la <strong>integridad</strong> (que solo modifiquen quienes deben y de formas válidas) y la <strong>disponibilidad</strong> (que
      el sistema responda). Se construye en capas: autenticación de usuarios, control de acceso, cifrado, auditoría y respaldo.</p>
      <p>El control de acceso de SQL es <em>discrecional</em>: el dueño de un objeto otorga privilegios con <code>GRANT</code> y los quita con
      <code>REVOKE</code>, y quien recibe un privilegio con <code>WITH GRANT OPTION</code> puede volver a otorgarlo. Eso forma un grafo cuyas
      consecuencias no siempre son obvias.</p>`,
    visualizaciones: [
      {
        titulo: 'GRANT y REVOKE en cascada',
        descripcion: 'Cinco usuarios se pasan el privilegio SELECT sobre Notas. Avance hasta el REVOKE final y compare CASCADE con RESTRICT.',
        montar: montarGrant,
      },
      {
        titulo: 'Roles y seguridad por filas',
        descripcion: 'Control de acceso basado en roles, con políticas que filtran filas según quién pregunta. Pruebe la misma acción con un alumno, un ayudante y la auditora.',
        montar: montarRoles,
      },
    ],
    teoria: String.raw`
      <h2>Control de acceso discrecional</h2>
      <pre><code>GRANT privilegios ON objeto TO usuarios [WITH GRANT OPTION];
REVOKE [GRANT OPTION FOR] privilegios ON objeto FROM usuarios {CASCADE | RESTRICT};</code></pre>
      <p>Los privilegios son <code>SELECT</code>, <code>INSERT</code>, <code>UPDATE</code> (opcionalmente por columna), <code>DELETE</code>,
      <code>REFERENCES</code>, <code>EXECUTE</code>, entre otros. El <strong>grafo de otorgamientos</strong> tiene una arista por cada GRANT.
      Un usuario tiene el privilegio si hay un camino desde el dueño en el que cada otorgante tenía la opción de otorgar.</p>
      <div class="recuadro">Al revocar, se eliminan también los otorgamientos que quedan <em>abandonados</em>: los que ya no tienen un camino
      válido desde el dueño. <code>RESTRICT</code> rechaza el REVOKE si existe alguno; <code>CASCADE</code> los elimina.</div>

      <h2>Roles y mínimo privilegio</h2>
      <p>En el control basado en roles (RBAC) los privilegios se otorgan a roles y los usuarios reciben roles. Cambiar de cargo es cambiar
      de rol, no revisar cien GRANT. El principio de <strong>mínimo privilegio</strong> dice que cada rol tenga solo lo necesario: la
      aplicación web no necesita <code>DROP TABLE</code>, y un analista no necesita ver RUT.</p>
      <p>Las <a href="tema.html?id=logica-bdd">vistas</a> y las <strong>políticas por filas</strong> (<em>row-level security</em>) refinan el
      control: el mismo SELECT devuelve filas distintas según quién lo ejecuta. Los <strong>procedimientos almacenados</strong> con
      <code>SECURITY DEFINER</code> permiten una operación concreta sin otorgar el privilegio general.</p>

      <h2>Las otras capas</h2>
      <table>
        <tr><th>Capa</th><th>Mecanismos</th></tr>
        <tr><td>autenticación</td><td>contraseñas con hash lento (bcrypt, scram-sha-256), certificados, autenticación de dos factores</td></tr>
        <tr><td>red</td><td>TLS en las conexiones, la base no expuesta a internet, listas de IP permitidas</td></tr>
        <tr><td>cifrado en reposo</td><td>cifrado del disco o de la tabla (TDE), de columnas sensibles, de respaldos</td></tr>
        <tr><td>auditoría</td><td>registro de quién leyó o modificó qué, protegido contra borrado</td></tr>
        <tr><td>disponibilidad</td><td>réplicas, respaldos probados, límites de recursos por usuario</td></tr>
      </table>
      <p>Los ataques más comunes no rompen ninguna de estas capas: las rodean, por ejemplo con
      inyección SQL a través de la aplicación, que se conecta con un usuario legítimo.</p>`,
  });
})();
