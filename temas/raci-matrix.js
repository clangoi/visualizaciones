(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Datos: contratar a una persona ---------- */

  const ROLES = ['Jefatura', 'RR.HH.', 'Gerencia', 'TI', 'Finanzas'];
  const ACTS = ['Definir el perfil', 'Publicar la oferta', 'Preseleccionar', 'Entrevistar finalistas', 'Aprobar la contratación', 'Emitir oferta y contrato', 'Preparar puesto y accesos', 'Inducción'];
  // R: hace el trabajo. A: responde por el resultado. AR: ambas cosas a la vez. C: se le consulta. I: se le informa.
  const CICLO = ['', 'R', 'A', 'AR', 'C', 'I'];
  const VERDAD = [
    ['AR', 'C', 'I', '', 'C'],
    ['C', 'AR', '', 'C', ''],
    ['C', 'AR', '', '', ''],
    ['AR', 'R', '', '', ''],
    ['R', 'C', 'A', '', 'C'],
    ['I', 'AR', 'C', '', 'C'],
    ['C', 'A', '', 'R', ''],
    ['R', 'A', 'I', 'C', ''],
  ];
  const CON_ERRORES = [
    ['R', 'C', 'I', '', 'C'],
    ['C', 'AR', '', 'C', ''],
    ['A', 'AR', '', '', ''],
    ['AR', 'R', '', '', ''],
    ['', 'C', 'A', '', 'C'],
    ['I', 'AR', 'C', '', 'C'],
    ['C', 'AR', '', 'R', ''],
    ['R', 'AR', 'I', 'C', ''],
  ];
  const COLOR_RACI = { R: C.s1, A: C.s2, AR: C.s7, C: C.s3, I: C.inactivo };
  const tieneA = (v) => v === 'A' || v === 'AR';
  const tieneR = (v) => v === 'R' || v === 'AR';
  const copia = (m) => m.map((f) => f.slice());

  // Reglas de una matriz RACI. Las columnas desconocidas (null) no cuentan.
  function validar(M, limite) {
    const filas = M.map((f) => {
      const conocidas = f.filter((v) => v !== null);
      const nA = conocidas.filter(tieneA).length, nR = conocidas.filter(tieneR).length;
      return { nA, nR, sinA: nA === 0, dobleA: nA > 1, sinR: nR === 0 };
    });
    const carga = ROLES.map((_, r) => M.filter((f) => tieneR(f[r])).length);
    const cargaA = ROLES.map((_, r) => M.filter((f) => tieneA(f[r])).length);
    const sobre = carga.map((n) => n > limite);
    const buenas = filas.filter((f) => !f.sinA && !f.dobleA && !f.sinR).length;
    return { filas, carga, cargaA, sobre, buenas };
  }
  const textoEstado = (f, completo) => {
    const p = [];
    if (f.dobleA) p.push(`${f.nA} A (debe ser 1)`);
    if (f.sinA) p.push(completo ? 'sin A' : 'sin A todavía');
    if (f.sinR) p.push(completo ? 'sin R' : 'sin R todavía');
    return p.length ? p.join(', ') : 'correcta';
  };

  // Dibuja la tabla. opciones: { alClic(a, r), malas(a, r) → bool, limite, completo }.
  function dibujarTabla(caja, M, v, o) {
    const cab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'Actividad'), ...ROLES.map((r) => VIZ.el('th', null, r)), VIZ.el('th', { class: 'izq' }, 'Estado'));
    const filas = M.map((f, a) => {
      const malo = v.filas[a].sinA || v.filas[a].dobleA || v.filas[a].sinR;
      return VIZ.el('tr', null,
        VIZ.el('td', { class: 'izq' }, ACTS[a]),
        ...f.map((val, r) => {
          const mal = o.malas && o.malas(a, r);
          const td = VIZ.el('td', {
            class: o.alClic ? 'celda-clic' : null, tabindex: o.alClic ? '0' : null, title: o.alClic ? `${ACTS[a]} · ${ROLES[r]}` : null,
            style: { background: mal ? VIZ.alfa(C.s8, 0.3) : val ? VIZ.alfa(COLOR_RACI[val], 0.28) : null, color: val === null ? C.apagado : null, fontWeight: val ? '600' : null },
          }, val === null ? '?' : val || '·');
          if (o.alClic) {
            td.addEventListener('click', () => o.alClic(a, r));
            td.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.alClic(a, r); } });
          }
          return td;
        }),
        VIZ.el('td', { class: 'izq', style: { color: malo ? C.s8 : C.s6 } }, textoEstado(v.filas[a], o.completo)));
    });
    const pie = (txt, arr, mal) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, txt),
      ...arr.map((n, r) => VIZ.el('td', { style: { color: mal && mal[r] ? C.s8 : null, fontWeight: mal && mal[r] ? '600' : null } }, String(n))), VIZ.el('td'));
    caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
      VIZ.el('thead', null, cab), VIZ.el('tbody', null, ...filas),
      VIZ.el('tfoot', null, pie(o.limite === '—' ? 'Actividades R' : `Actividades R (máx. ${o.limite})`, v.carga, v.sobre), pie('Actividades A', v.cargaA))));
  }
  const LEYENDA = () => [
    { color: COLOR_RACI.R, texto: 'R: realiza' }, { color: COLOR_RACI.A, texto: 'A: responde por el resultado' }, { color: COLOR_RACI.AR, texto: 'AR: ambas' },
    { color: COLOR_RACI.C, texto: 'C: se le consulta' }, { color: COLOR_RACI.I, texto: 'I: se le informa' },
  ];

  /* ---------- Fig. 1: edición con validaciones ---------- */

  function montarEditor(cuerpo) {
    let M = copia(CON_ERRORES), limite = 4, mensaje = 'Matriz cargada con errores a propósito: busque las filas en rojo.';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Máx. actividades R por persona', min: 2, max: 8, valor: limite, alCambiar: (v) => { limite = v; mensaje = `Límite de carga: ${v} actividades R por persona.`; dibujar(); } });
    ctl.boton('Corregir automáticamente', corregir, { primario: true });
    ctl.boton('Cargar con errores', () => { M = copia(CON_ERRORES); mensaje = 'Matriz con errores: sin A, dos A, sin R y una persona sobrecargada.'; dibujar(); });
    ctl.boton('Cargar correcta', () => { M = copia(VERDAD); mensaje = 'Matriz correcta: una A y al menos una R por actividad.'; dibujar(); });
    ctl.boton('Vaciar', () => { M = ACTS.map(() => ROLES.map(() => '')); mensaje = 'Matriz vacía: todas las actividades están huérfanas.'; dibujar(); });
    VIZ.leyenda(cuerpo, LEYENDA());
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda (o use Enter) para recorrer los valores · R A AR C I. Cada actividad necesita exactamente una A y al menos una R; mueva el límite para ver quién queda sobrecargado.');

    function alClic(a, r) {
      M[a][r] = CICLO[(CICLO.indexOf(M[a][r]) + 1) % CICLO.length];
      mensaje = `«${ACTS[a]}» · ${ROLES[r]}: ${M[a][r] || 'sin participación'}.`;
      dibujar();
    }
    // Corrige lo que sí se puede decidir sin preguntar; la sobrecarga la decide una persona.
    function corregir() {
      const cambios = [];
      M.forEach((f, a) => {
        const idxA = f.map((v, r) => (tieneA(v) ? r : -1)).filter((r) => r >= 0);
        idxA.slice(1).forEach((r) => { f[r] = f[r] === 'AR' ? 'R' : 'C'; cambios.push(`«${ACTS[a]}»: ${ROLES[r]} deja la A`); });
        if (!idxA.length) {
          const r = f.findIndex(tieneR);
          if (r >= 0) { f[r] = 'AR'; cambios.push(`«${ACTS[a]}»: ${ROLES[r]} asume la A`); }
        }
        const rA = f.findIndex(tieneA);
        if (rA >= 0 && !f.some(tieneR)) { f[rA] = 'AR'; cambios.push(`«${ACTS[a]}»: ${ROLES[rA]} asume también la R`); }
      });
      const v = validar(M, limite), sobre = ROLES.filter((_, r) => v.sobre[r]);
      mensaje = (cambios.length ? `Se corrigieron ${cambios.length} casos (${cambios.join('; ')}).` : 'No había nada que corregir automáticamente.')
        + (sobre.length ? ` Queda sobrecarga en ${sobre.join(', ')}: reasigne a mano algunas R.` : '');
      dibujar();
    }
    function dibujar() {
      const v = validar(M, limite);
      dibujarTabla(caja, M, v, { alClic, limite, completo: true });
      registro.textContent = mensaje;
      const sobre = ROLES.filter((_, r) => v.sobre[r]);
      lectura.set([
        ['actividades sin problema', `${v.buenas} de ${ACTS.length}`],
        ['sin A (huérfanas)', String(v.filas.filter((f) => f.sinA).length)],
        ['con dos o más A', String(v.filas.filter((f) => f.dobleA).length)],
        ['sin R', String(v.filas.filter((f) => f.sinR).length)],
        ['personas sobrecargadas', sobre.length ? sobre.join(', ') : 'ninguna'],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: descubrir la matriz con entrevistas ---------- */

  // Lo que una persona declara sobre su propio papel: olvida consultas, se atribuye trabajo y se cree responsable.
  function declarar(a, r, semilla, sesgo, olvido, conRegistro) {
    const t = VERDAD[a][r];
    const u = VIZ.semilla(semilla * 7919 + r * 101 + a * 13)(), w = VIZ.semilla(semilla * 104729 + r * 57 + a * 29 + 5)();
    let d = t;
    if ((t === 'C' || t === 'I') && u < olvido) d = '';
    else if (t === 'R' && w < sesgo) d = 'AR';
    else if ((t === 'C' || t === 'I') && w < sesgo) d = 'R';
    else if (t === '' && w < sesgo / 3) d = 'R';
    if (conRegistro && tieneR(d) && !tieneR(t)) d = d === 'AR' && tieneA(t) ? 'A' : t;
    return d;
  }

  function montarEntrevistas(cuerpo) {
    let semilla = 1, sesgo = 0.3, olvido = 0.25, conRegistro = false, verdad = false, mensaje = 'Elija a quién entrevistar: cada persona declara su propia columna.';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Sesgo de autoinforme', min: 0, max: 0.8, paso: 0.05, valor: sesgo, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sesgo = v; mensaje = 'Con más sesgo, las personas se atribuyen más trabajo y más responsabilidad.'; dibujar(); } });
    ctl.rango({ etiqueta: 'Olvido de consultas', min: 0, max: 0.8, paso: 0.05, valor: olvido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { olvido = v; mensaje = 'Con más olvido, desaparecen las C e I de la matriz descubierta.'; dibujar(); } });
    const entrevistados = ctl.casillas(ROLES.map((r) => ({ clave: r, texto: `Entrevistar a ${r}`, activo: false })), (e) => {
      const n = ROLES.filter((r) => e[r]).length;
      mensaje = `${n} de ${ROLES.length} personas entrevistadas.`; dibujar();
    });
    ctl.casilla({ etiqueta: 'Contrastar con el registro de eventos', valor: conRegistro, alCambiar: (v) => { conRegistro = v; mensaje = v ? 'El registro del sistema muestra quién ejecutó cada actividad: corrige las R falsas, pero no dice quién es responsable final.' : 'Sin contraste: solo se usa lo que dijo cada persona.'; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar la matriz real (corregir)', valor: verdad, alCambiar: (v) => { verdad = v; dibujar(); } });
    ctl.boton('Entrevistar a todos', () => { ROLES.forEach((r) => { entrevistados[r] = true; }); cuerpo.querySelectorAll('.grupo-casillas input').forEach((i) => { i.checked = true; }); mensaje = 'Las cinco personas fueron entrevistadas.'; dibujar(); }, { primario: true });
    ctl.boton('Nueva muestra', () => { semilla++; mensaje = 'Nueva muestra: otras personas olvidan o exageran.'; dibujar(); });
    VIZ.leyenda(cuerpo, [...LEYENDA(), { color: VIZ.alfa(C.s8, 0.5), texto: 'declaración distinta de la realidad' }]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque a las personas que entrevista: cada una solo conoce su columna y tiende a exagerar. Los «?» son columnas aún desconocidas. Active «Mostrar la matriz real» para ver en rojo lo que se declaró mal.');

    function dibujar() {
      const M = ACTS.map((_, a) => ROLES.map((r, i) => (entrevistados[r] ? declarar(a, i, semilla, sesgo, olvido, conRegistro) : null)));
      const v = validar(M, 99);
      const conocidas = ROLES.filter((r) => entrevistados[r]).length;
      let total = 0, bien = 0;
      M.forEach((f, a) => f.forEach((d, r) => { if (d !== null) { total++; if (d === VERDAD[a][r]) bien++; } }));
      dibujarTabla(caja, M, v, { limite: '—', completo: conocidas === ROLES.length, malas: (a, r) => verdad && M[a][r] !== null && M[a][r] !== VERDAD[a][r] });
      const conflictos = v.filas.filter((f) => f.dobleA).length;
      registro.textContent = mensaje;
      lectura.set([
        ['columnas conocidas', `${conocidas} de ${ROLES.length}`],
        ['celdas correctas', total ? `${bien} de ${total} (${VIZ.fmt((bien / total) * 100, 3)} %)` : '—'],
        ['actividades con dos A en conflicto', String(conflictos)],
        ['actividades con exactamente una A', `${v.filas.filter((f) => f.nA === 1).length} de ${ACTS.length}`],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('raci-matrix', {
    intro: String.raw`
      <p>La <strong>matriz RACI</strong> responde una pregunta que casi toda organización contesta mal: <em>¿quién hace qué en este proceso?</em> Para cada actividad se marca
      quién es <strong>R</strong>esponsable de ejecutarla, quién es <strong>A</strong>probador (responde por el resultado), a quién se <strong>C</strong>onsulta y a quién solo se <strong>I</strong>nforma.</p>
      <p>Su valor está en las reglas: una sola A por actividad y al menos una R. Cuando faltan o sobran, el proceso tiene huérfanos, disputas o cuellos de botella en una persona.
      Por eso la matriz se valida como si fuera un dato y se construye entrevistando a las personas, sabiendo que cada una cuenta su versión.</p>`,
    visualizaciones: [
      {
        titulo: 'Edite la matriz y valide las reglas',
        descripcion: 'Parte de una matriz con errores: busque las filas sin A, con dos A o sin R, y a la persona sobrecargada. Corrija a mano, baje el límite de carga o pruebe «Corregir automáticamente».',
        montar: montarEditor,
      },
      {
        titulo: 'Descubrir el RACI con entrevistas',
        descripcion: 'Entreviste a una persona a la vez: cada una conoce solo su columna y la exagera. Entreviste a todos, active «Mostrar la matriz real» y vea qué errores aparecen; luego contraste con el registro de eventos.',
        montar: montarEntrevistas,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(M\) una matriz con una fila por actividad \(a\) y una columna por rol \(r\); cada celda vale \(R\), \(A\), \(C\), \(I\) o vacío (y \(A/R\) cuando una misma persona ejecuta y responde).</p>
      <table>
        <tr><th>Letra</th><th>Significado</th><th>Comunicación</th></tr>
        <tr><td>R (<em>Responsible</em>)</td><td>realiza la actividad; puede haber varias</td><td>—</td></tr>
        <tr><td>A (<em>Accountable</em>)</td><td>responde por el resultado y aprueba; exactamente una</td><td>—</td></tr>
        <tr><td>C (<em>Consulted</em>)</td><td>aporta opinión antes de decidir</td><td>bidireccional</td></tr>
        <tr><td>I (<em>Informed</em>)</td><td>se entera del resultado</td><td>unidireccional</td></tr>
      </table>
      <h2>Reglas de validación</h2>
      \[ \forall a:\ \bigl|\{ r : M_{ar} \in \{A, A/R\} \}\bigr| = 1, \qquad \bigl|\{ r : M_{ar} \in \{R, A/R\} \}\bigr| \ge 1, \qquad L_r = \bigl|\{ a : M_{ar} \in \{R, A/R\} \}\bigr| \le L_{\max}. \]
      <ul>
        <li><strong>Huérfana</strong>: sin A. Nadie responde, así que nadie decide ante un problema.</li>
        <li><strong>Doble A</strong>: dos personas creen mandar. Genera esperas y decisiones contradictorias.</li>
        <li><strong>Sin R</strong>: alguien aprueba algo que nadie ejecuta.</li>
        <li><strong>Sobrecarga</strong>: una persona con \(L_r\) alto es un cuello de botella; también delata exceso de C y de I, que vuelve lenta la actividad.</li>
      </ul>
      <h3>Ejemplo resuelto</h3>
      <p>En la matriz con errores, RR.HH. figura como R en las actividades 2, 3, 4, 6, 7 y 8, así que \(L_{\text{RR.HH.}} = 6 > 4\). Preseleccionar tiene dos A (Jefatura y RR.HH.) y Aprobar la contratación no tiene R. La
      corrección automática deja una sola A por fila (conserva la primera) y hace R a quien aprueba, pero repartir las seis R de RR.HH. exige decidir quién más puede ejecutar: es una decisión organizacional, no algorítmica.</p>
      <h2>Descubrir la matriz</h2>
      <p>Una matriz se levanta con entrevistas, observación y registros. Cada entrevistado informa sobre sí mismo con sesgo: tiende a olvidar las consultas, a atribuirse trabajo y a creerse responsable final.
      Si cada uno acierta una celda con probabilidad \(q\), una matriz de \(n\) celdas conocidas tiene en promedio \(qn\) celdas correctas; la <em>triangulación</em> con otra fuente sube \(q\). El registro de eventos del sistema
      corrige las R (quién ejecutó de verdad), pero no la A, que es una decisión de gobierno y solo se resuelve conversando.</p>
      <div class="recuadro"><p><strong>Variantes.</strong> RASCI agrega S (<em>Support</em>, apoyo), DACI usa D (<em>Driver</em>) y A como decisor, y RAPID reparte la decisión en roles. Las reglas de fondo no cambian: un solo decisor y trabajo asignado.</p></div>
      <h2>Conexiones</h2>
      <p>Las filas de la matriz son las actividades de un <a href="tema.html?id=business-process-anatomy">proceso de negocio</a>; las columnas se convierten en carriles en un diagrama <a href="tema.html?id=bpmn-pools-lanes">BPMN</a>.
      En los datos reales, las personas que ejecutan se leen en la <a href="tema.html?id=organizational-perspective">perspectiva organizacional</a> de la minería de procesos. La asignación de A y R depende de las
      <a href="tema.html?id=organizational-structures">estructuras organizacionales</a> y del <a href="tema.html?id=culture-governance">gobierno</a>, y de la forma en que se gestiona el cambio en <a href="tema.html?id=change-management">gestión del cambio</a>.</p>`,
  });
})();
