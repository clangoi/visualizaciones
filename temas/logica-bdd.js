(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  const pesos = (v) => (v == null ? null : '$' + VIZ.entero(v));
  const cuentasIniciales = () => B.rel('Cuentas', ['id', 'titular', 'saldo', 'sucursal'], [
    [1, 'Ana', 820000, 'Centro'], [2, 'Bruno', 150000, 'Norte'], [3, 'Carla', 640000, 'Centro'], [4, 'Diego', 90000, 'Sur'],
  ]);
  const verSaldos = (R) => B.rel(R.nombre, R.atributos, R.filas.map((f) => ({ ...f, saldo: pesos(f.saldo) })));

  /* ---------- Fig. 1: vistas virtuales y materializadas ---------- */

  function montarVistas(cuerpo) {
    let base, mat, mensaje, ops;
    const UMBRAL = 500000;
    const consulta = (R) => B.rel('', ['titular', 'saldo'], R.filas.filter((f) => f.saldo > UMBRAL).map((f) => ({ titular: f.titular, saldo: f.saldo })));
    function reiniciar() {
      base = cuentasIniciales(); mat = consulta(base); ops = 0;
      mensaje = 'La vista materializada se calculó ahora: coincide con la virtual.';
    }
    const ctl = VIZ.controles(cuerpo);
    const mod = (txt, f) => { f(); ops++; mensaje = txt + ' La vista virtual lo refleja de inmediato; la materializada sigue mostrando la copia antigua.'; dibujar(); };
    ctl.boton('Depositar $400.000 a Bruno', () => mod('UPDATE Cuentas SET saldo = saldo + 400000 WHERE id = 2.', () => { base.filas[1].saldo += 400000; }), { primario: true });
    ctl.boton('Retirar $300.000 de Carla', () => mod('UPDATE Cuentas SET saldo = saldo − 300000 WHERE id = 3.', () => { base.filas[2].saldo -= 300000; }));
    ctl.boton('Abrir cuenta de Elena', () => mod('INSERT INTO Cuentas VALUES (5, Elena, 1.200.000, Sur).', () => {
      if (!base.filas.some((f) => f.id === 5)) base.filas.push({ id: 5, titular: 'Elena', saldo: 1200000, sucursal: 'Sur' });
    }));
    ctl.boton('REFRESH MATERIALIZED VIEW', () => { mat = consulta(base); ops = 0; mensaje = 'REFRESH: se volvió a ejecutar la consulta y se guardó el resultado. Ambas vistas coinciden.'; dibujar(); });
    ctl.boton('Reiniciar', () => { reiniciar(); dibujar(); });
    const codigo = el('div', { class: 'codigo-bdd' },
      `CREATE VIEW SaldosAltos AS\n  SELECT titular, saldo FROM Cuentas WHERE saldo > 500000;\n\nCREATE MATERIALIZED VIEW SaldosAltosMat AS\n  SELECT titular, saldo FROM Cuentas WHERE saldo > 500000;`);
    cuerpo.appendChild(codigo);
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'fila de la tabla base que entra en la vista' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 'fila desactualizada en la materializada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Modifique la tabla base y compare las dos vistas; luego refresque la materializada.');

    function dibujar() {
      const virt = consulta(base);
      const clave = (f) => `${f.titular}|${f.saldo}`;
      const enVirt = new Set(virt.filas.map(clave)), enMat = new Set(mat.filas.map(clave));
      const viejas = mat.filas.filter((f) => !enVirt.has(clave(f))).length + virt.filas.filter((f) => !enMat.has(clave(f))).length;
      caja.replaceChildren(
        B.tabla(verSaldos(base), { titulo: 'Cuentas (tabla base)', fila: (f, i) => (base.filas[i].saldo > UMBRAL ? C.s1 : null) }),
        B.tabla(verSaldos(virt), { titulo: 'SaldosAltos (virtual)' }),
        B.tabla(verSaldos(mat), { titulo: 'SaldosAltosMat (materializada)', fila: (f, i) => (enVirt.has(clave(mat.filas[i])) ? null : C.s8) }));
      registro.textContent = mensaje;
      lectura.set([
        ['cambios sin refrescar', String(ops)],
        ['filas que difieren', String(viejas)],
        ['costo de leer la virtual', 'ejecuta la consulta'],
        ['costo de leer la materializada', 'lee una tabla'],
      ]);
    }
    reiniciar();
    dibujar();
  }

  /* ---------- Fig. 2: procedimiento almacenado con disparadores ---------- */

  const CODIGO = [
    'CREATE PROCEDURE transferir(origen INT, destino INT, monto INT) AS $$',
    'BEGIN',
    '  UPDATE Cuentas SET saldo = saldo - monto WHERE id = origen;',
    '  UPDATE Cuentas SET saldo = saldo + monto WHERE id = destino;',
    'END $$;  -- se ejecuta dentro de una transacción: COMMIT al terminar',
    '',
    'CREATE TRIGGER validar BEFORE UPDATE ON Cuentas FOR EACH ROW',
    '  WHEN (NEW.saldo < 0) EXECUTE RAISE EXCEPTION \'saldo insuficiente\';',
    '',
    'CREATE TRIGGER auditar AFTER UPDATE ON Cuentas FOR EACH ROW',
    '  EXECUTE INSERT INTO Auditoria VALUES (OLD.id, OLD.saldo, NEW.saldo, now());',
  ];

  function montarProcedimiento(cuerpo) {
    let monto = 300000, validar = true, auditar = true;
    let cuentas, auditoria, linea = -1, marcas = new Map(), mensaje = '', estado = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'transferir(1 → 4, monto)', valor: String(monto),
      opciones: [['300000', '$300.000'], ['900000', '$900.000 (más que el saldo)']],
      alCambiar: (v) => { monto = +v; rep.reiniciar(); },
    });
    ctl.casilla({ etiqueta: 'trigger validar', valor: validar, alCambiar: (v) => { validar = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'trigger auditar', valor: auditar, alCambiar: (v) => { auditar = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });
    const codigo = el('div', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const caja = B.grupoTablas(cuerpo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s2, 0.22), texto: 'línea que se ejecuta' },
      { color: VIZ.alfa(C.s1, 0.18), texto: 'fila modificada (sin confirmar)' },
      { color: VIZ.alfa(C.s6, 0.18), texto: 'confirmado' },
      { color: VIZ.alfa(C.s8, 0.18), texto: 'cambio deshecho' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pruebe el monto de $900.000 con y sin el trigger de validación: sin él, la cuenta 1 queda con saldo negativo.');

    function iniciar() {
      cuentas = cuentasIniciales();
      auditoria = B.rel('Auditoria', ['id', 'antes', 'despues', 'cuando'], []);
      linea = -1; marcas = new Map(); estado = 'sin iniciar';
      mensaje = `CALL transferir(1, 4, ${VIZ.entero(monto)})`;
      return (function* () {
        const copia = cuentas.filas.map((f) => ({ ...f }));
        linea = 1; estado = 'activa'; mensaje = 'BEGIN: comienza una transacción. Nada de lo que siga es visible para otros hasta el COMMIT.'; yield;
        const actualizar = function* (lin, id, delta, n) {
          linea = lin;
          const f = cuentas.filas.find((x) => x.id === id), nuevo = f.saldo + delta;
          mensaje = `UPDATE ${n}: cuenta ${id}, saldo ${pesos(f.saldo)} → ${pesos(nuevo)}.`; yield;
          if (validar) {
            linea = 7;
            if (nuevo < 0) { mensaje = `Trigger validar (BEFORE): NEW.saldo = ${pesos(nuevo)} < 0 → RAISE EXCEPTION. El UPDATE no se aplica.`; yield; return false; }
            mensaje = `Trigger validar (BEFORE): NEW.saldo = ${pesos(nuevo)} ≥ 0, se permite.`; yield;
          }
          const antes = f.saldo;
          f.saldo = nuevo; marcas.set(id, C.s1);
          if (auditar) {
            linea = 10;
            auditoria.filas.push({ id, antes: pesos(antes), despues: pesos(nuevo), cuando: `t${auditoria.filas.length + 1}` });
            mensaje = `Trigger auditar (AFTER): se inserta una fila en Auditoria con OLD.saldo y NEW.saldo.`; yield;
          }
          return true;
        };
        const ok1 = yield* actualizar(2, 1, -monto, 1);
        const ok = ok1 && (yield* actualizar(3, 4, monto, 2));
        if (ok) {
          linea = 4; estado = 'confirmada';
          cuentas.filas.forEach((f) => { if (marcas.has(f.id)) marcas.set(f.id, C.s6); });
          mensaje = 'COMMIT: los dos UPDATE y las filas de auditoría se vuelven permanentes juntos.';
        } else {
          linea = 4; estado = 'abortada';
          cuentas.filas.forEach((f, i) => { if (marcas.has(f.id)) marcas.set(f.id, C.s8); f.saldo = copia[i].saldo; });
          auditoria.filas = [];
          mensaje = 'ROLLBACK: la excepción aborta la transacción completa. También se deshacen las filas que alcanzó a insertar el trigger de auditoría.';
        }
        yield;
      })();
    }
    function dibujar() {
      codigo.replaceChildren(...CODIGO.map((t, i) => [i ? '\n' : '', i === linea ? el('span', { class: 'marca' }, t) : t]).flat());
      caja.replaceChildren(
        B.tabla(verSaldos(cuentas), { fila: (f) => marcas.get(f.id) }),
        B.tabla(auditoria, { vacio: '(sin filas)' }));
      registro.textContent = mensaje;
      const total = cuentas.filas.reduce((s, f) => s + f.saldo, 0);
      lectura.set([
        ['transacción', estado],
        ['suma de saldos', pesos(total)],
        ['saldo cuenta 1', pesos(cuentas.filas[0].saldo)],
        ['filas en Auditoria', String(auditoria.filas.length)],
      ]);
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('logica-bdd', {
    intro: String.raw`
      <p>Una base de datos no solo guarda datos: también puede guardar <strong>lógica</strong> que se ejecuta dentro del motor. Las
      <strong>vistas</strong> son consultas con nombre que se usan como tablas; los <strong>disparadores</strong> (<em>triggers</em>) son
      reglas que reaccionan solas a un INSERT, UPDATE o DELETE; y los <strong>procedimientos almacenados</strong> son programas que la
      aplicación invoca con <code>CALL</code>.</p>
      <p>Tener la lógica junto a los datos garantiza que se cumpla para <em>todas</em> las aplicaciones que usan la base y ahorra viajes
      por la red. El costo es que esa lógica es más difícil de versionar, probar y depurar que el código de la aplicación.</p>`,
    visualizaciones: [
      {
        titulo: 'Vista virtual y vista materializada',
        descripcion: 'Una vista virtual se recalcula en cada lectura; una materializada guarda el resultado y queda desactualizada hasta el próximo REFRESH.',
        montar: montarVistas,
      },
      {
        titulo: 'Procedimiento con disparadores',
        descripcion: 'Una transferencia entre cuentas, con un trigger que valida el saldo y otro que audita cada cambio. Avance línea por línea y pruebe el monto que deja saldo negativo.',
        montar: montarProcedimiento,
      },
    ],
    teoria: String.raw`
      <h2>Vistas</h2>
      <p>Una vista es una relación derivada \(V = Q(R_1, \dots, R_n)\). Cuando una consulta la menciona, el motor <em>expande</em> la
      definición y optimiza todo junto. Sirven para:</p>
      <ul>
        <li><strong>independencia lógica</strong>: si cambia el esquema, se redefine la vista y las aplicaciones no cambian;</li>
        <li><strong>seguridad</strong>: se otorga permiso sobre la vista y no sobre la tabla, para ocultar columnas o filas
        (ver <a href="tema.html?id=seguridad">seguridad</a>);</li>
        <li><strong>simplicidad</strong>: una junta compleja escrita una sola vez.</li>
      </ul>
      <p>Una vista es <em>actualizable</em> si cada fila de la vista corresponde a una sola fila de una tabla base (sin agregados, DISTINCT
      ni juntas ambiguas). <code>WITH CHECK OPTION</code> rechaza los cambios que harían que la fila saliera de la vista.</p>
      <h3>Vistas materializadas</h3>
      <p>Guardan el resultado. Leerlas cuesta lo que leer una tabla, pero cada cambio en las bases las deja obsoletas. Se refrescan
      completas o, cuando la consulta lo permite, de forma <em>incremental</em>: si \(V = \sigma_\theta(R)\) y se inserta \(\Delta R\),
      basta con agregar \(\sigma_\theta(\Delta R)\).</p>

      <h2>Disparadores</h2>
      <p>Siguen el modelo <strong>evento–condición–acción</strong>:</p>
      <pre><code>CREATE TRIGGER nombre
  {BEFORE | AFTER | INSTEAD OF} {INSERT | UPDATE | DELETE} ON tabla
  [FOR EACH ROW | FOR EACH STATEMENT]
  [WHEN (condición)]
  acción;</code></pre>
      <p>En los de fila, <code>OLD</code> y <code>NEW</code> son la tupla antes y después del cambio. Los BEFORE sirven para validar o corregir
      <code>NEW</code>; los AFTER, para efectos secundarios (auditoría, mantener tablas derivadas). Implementan restricciones que las claves
      no pueden expresar, como la participación total de la <a href="tema.html?id=ramakrishnan">notación de Ramakrishnan</a>.</p>
      <div class="recuadro">Un trigger que modifica otra tabla con triggers puede desencadenar una cascada difícil de seguir, e incluso un
      ciclo. Los motores limitan la profundidad de anidamiento, pero la regla práctica es mantener los triggers pequeños y pocos.</div>

      <h2>Procedimientos almacenados</h2>
      <p>Se escriben en un lenguaje procedural del motor (PL/pgSQL, T-SQL, PL/SQL) con variables, condicionales, ciclos y manejo de
      excepciones. Una sola llamada reemplaza varios viajes cliente–servidor, y el permiso <code>EXECUTE</code> permite que un usuario haga
      una transferencia sin tener permiso para actualizar saldos arbitrarios. Si se ejecutan dentro de una transacción, heredan sus
      garantías <a href="tema.html?id=acid">ACID</a>: una excepción a mitad de camino deshace todo.</p>`,
  });
})();
