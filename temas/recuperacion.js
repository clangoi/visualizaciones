(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;

  // Bitácora: [tipo, transacción, dato, antes, después]. El punto de control va en la posición 6.
  const BITACORA = [
    ['start', 'T1'], ['upd', 'T1', 'A', 10, 20], ['start', 'T2'], ['upd', 'T2', 'B', 5, 15], ['commit', 'T1'],
    ['ckpt'], ['start', 'T3'], ['upd', 'T3', 'C', 7, 9], ['upd', 'T2', 'A', 20, 30], ['commit', 'T3'],
    ['upd', 'T2', 'D', 1, 2], ['commit', 'T2'],
  ];
  const INICIAL = { A: 10, B: 5, C: 7, D: 1 };
  // Páginas que el buffer alcanzó a escribir en disco antes de la caída (política steal / no-force).
  const ROBADAS = new Set([4, 9]);

  const texto = (r, lsn) => {
    if (r[0] === 'start') return `${lsn}  <${r[1]} start>`;
    if (r[0] === 'commit') return `${lsn}  <${r[1]} commit>`;
    if (r[0] === 'ckpt') return `${lsn}  <CHECKPOINT>`;
    if (r[0] === 'abort') return `${lsn}  <${r[1]} abort>`;
    if (r[0] === 'clr') return `${lsn}  <CLR ${r[1]}, ${r[2]} := ${r[3]}>`;
    return `${lsn}  <${r[1]}, ${r[2]}: ${r[3]} → ${r[4]}>`;
  };

  function montarRecuperacion(cuerpo) {
    let caida = 9, conCkpt = true;
    let log, disco, fase, actual, marcas, ganadoras, perdedoras, leidos, rehechos, deshechos, mensaje;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Caída después del LSN', min: 2, max: 12, valor: caida, alCambiar: (v) => { caida = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'punto de control en el LSN 6', valor: conCkpt, alCambiar: (v) => { conCkpt = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const dos = el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(dos);
    const izq = el('div'), der = el('div');
    dos.append(izq, der);
    VIZ.subtitulo(izq, 'Bitácora en disco');
    const lista = el('div', { class: 'lista-mono' });
    izq.appendChild(lista);
    VIZ.subtitulo(der, 'Datos en disco');
    const tabla = el('div');
    der.appendChild(tabla);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'registro que se lee' },
      { color: C.s6, texto: 'transacción ganadora (con commit)', forma: 'linea' },
      { color: C.s8, texto: 'perdedora (sin commit)', forma: 'linea' },
      { color: VIZ.alfa(C.s2, 0.22), texto: 'dato rehecho o deshecho ahora' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el punto de caída. Con el punto de control, el análisis y el rehacer empiezan en el LSN 6 en vez del 1.');

    function iniciar() {
      log = BITACORA.map((r, i) => ({ r, lsn: i + 1 })).filter((x) => x.lsn <= caida && (conCkpt || x.r[0] !== 'ckpt'));
      // Estado del disco al caer: lo volcado por el punto de control y las páginas robadas.
      disco = { ...INICIAL };
      for (const { r, lsn } of log) {
        if (r[0] !== 'upd') continue;
        if ((conCkpt && caida >= 6 && lsn < 6) || ROBADAS.has(lsn)) disco[r[2]] = r[4];
      }
      fase = 'caída'; actual = -1; marcas = new Set(); ganadoras = new Set(); perdedoras = new Set();
      leidos = 0; rehechos = 0; deshechos = 0;
      mensaje = `El sistema cae después del LSN ${caida}. El disco tiene una mezcla de valores viejos y nuevos.`;
      return (function* () {
        const ick = log.findIndex((x) => x.r[0] === 'ckpt');
        const desde = conCkpt && ick >= 0 ? ick : 0;
        // Análisis: qué transacciones confirmaron.
        fase = 'análisis';
        const vistas = new Set();
        // Con punto de control, las activas en el punto de control se conocen por el registro mismo.
        if (desde > 0) BITACORA.slice(0, 5).forEach((r) => { if (r[0] === 'start') vistas.add(r[1]); if (r[0] === 'commit') vistas.delete(r[1]); });
        for (let i = desde; i < log.length; i++) {
          const { r } = log[i];
          actual = i; leidos++;
          if (r[0] === 'start') vistas.add(r[1]);
          if (r[0] === 'commit') { vistas.delete(r[1]); ganadoras.add(r[1]); }
          mensaje = `Análisis: ${texto(r, log[i].lsn)}.`;
          yield;
        }
        BITACORA.slice(0, 5).forEach((r) => { if (r[0] === 'commit' && log.some((x) => x.r === r)) ganadoras.add(r[1]); });
        vistas.forEach((t) => perdedoras.add(t));
        actual = -1;
        mensaje = `Análisis terminado. Ganadoras: ${[...ganadoras].join(', ') || 'ninguna'}. Perdedoras: ${[...perdedoras].join(', ') || 'ninguna'}.`;
        yield;
        // Rehacer: repetir la historia desde el punto de partida.
        fase = 'rehacer';
        for (let i = desde; i < log.length; i++) {
          const { r } = log[i];
          if (r[0] !== 'upd') continue;
          actual = i; leidos++; rehechos++;
          marcas = new Set([r[2]]);
          const ya = disco[r[2]] === r[4];
          disco[r[2]] = r[4];
          mensaje = `Rehacer LSN ${log[i].lsn}: ${r[2]} := ${r[4]}${ya ? ' (ya estaba en disco: rehacer es idempotente)' : ''}. Se rehace también lo de las perdedoras: se repite la historia.`;
          yield;
        }
        // Deshacer: perdedoras hacia atrás, aunque haya que pasar antes del punto de control.
        fase = 'deshacer';
        for (let i = log.length - 1; i >= 0 && perdedoras.size; i--) {
          const { r } = log[i];
          if (r[0] !== 'upd' || !perdedoras.has(r[1])) continue;
          actual = i; leidos++; deshechos++;
          marcas = new Set([r[2]]);
          disco[r[2]] = r[3];
          log.push({ r: ['clr', r[1], r[2], r[3]], lsn: log.length + 1, nuevo: true });
          mensaje = `Deshacer LSN ${log[i].lsn} de ${r[1]}: ${r[2]} := ${r[3]}, y se anota un CLR para no repetirlo si hay otra caída.`;
          yield;
        }
        for (const t of perdedoras) log.push({ r: ['abort', t], lsn: log.length + 1, nuevo: true });
        actual = -1; marcas = new Set(); fase = 'listo';
        mensaje = `Recuperación terminada: los efectos de ${[...ganadoras].join(', ') || 'ninguna'} están en disco y no queda rastro de ${[...perdedoras].join(', ') || 'ninguna'}.`;
      })();
    }
    function dibujar() {
      lista.replaceChildren(...log.map((x, i) => {
        const t = x.r[1];
        const col = ganadoras.has(t) ? C.s6 : perdedoras.has(t) ? C.s8 : null;
        return el('div', { class: i === actual ? 'activa' : null, style: col ? { color: col } : null }, texto(x.r, x.lsn) + (x.nuevo ? '   ← nuevo' : ''));
      }));
      // Valor correcto de cada dato: el último escrito por una transacción confirmada (antes de la caída).
      const correcto = { ...INICIAL };
      const conf = new Set(BITACORA.slice(0, caida).filter((r) => r[0] === 'commit').map((r) => r[1]));
      BITACORA.slice(0, caida).forEach((r) => { if (r[0] === 'upd' && conf.has(r[1])) correcto[r[2]] = r[4]; });
      const R = B.rel('Disco', ['dato', 'valor', 'correcto'], Object.keys(disco).map((d) => [d, disco[d], correcto[d]]));
      tabla.replaceChildren(B.tabla(R, { titulo: false, fila: (f) => (marcas.has(f.dato) ? C.s2 : f.valor !== f.correcto && fase === 'listo' ? C.s8 : null) }));
      registro.textContent = mensaje;
      const malos = Object.keys(disco).filter((d) => disco[d] !== correcto[d]).length;
      lectura.set([
        ['fase', fase],
        ['registros leídos', String(leidos)],
        ['rehechos', String(rehechos)],
        ['deshechos', String(deshechos)],
        ['datos distintos del correcto', String(malos)],
      ]);
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('recuperacion', {
    intro: String.raw`
      <p>Para ser rápido, el motor modifica las páginas en memoria y las escribe al disco cuando le conviene. Eso significa que, en el
      instante de una caída, el disco puede tener cambios de transacciones que no confirmaron y le pueden faltar cambios de transacciones
      que sí confirmaron. La <strong>recuperación</strong> repara ambas cosas.</p>
      <p>La herramienta es la <strong>bitácora</strong> (<em>log</em>): un archivo secuencial donde cada cambio se anota, con su valor
      anterior y su valor nuevo, <em>antes</em> de que llegue a los datos. Con ella se puede <strong>rehacer</strong> lo confirmado y
      <strong>deshacer</strong> lo que no.</p>`,
    visualizaciones: [
      {
        titulo: 'Análisis, rehacer y deshacer',
        descripcion: 'Tres transacciones y una caída. Ejecute la recuperación y observe que al final cada dato tiene el valor de la última transacción confirmada.',
        montar: montarRecuperacion,
      },
    ],
    teoria: String.raw`
      <h2>Políticas de buffer</h2>
      <table>
        <tr><th></th><th>force (escribir al confirmar)</th><th>no-force</th></tr>
        <tr><td><strong>no-steal</strong> (no escribir páginas de transacciones activas)</td><td>no hace falta ni rehacer ni deshacer</td><td>solo rehacer</td></tr>
        <tr><td><strong>steal</strong></td><td>solo deshacer</td><td>rehacer y deshacer</td></tr>
      </table>
      <p>Los motores reales usan <strong>steal / no-force</strong>, la combinación más rápida y la que exige más de la recuperación: steal
      deja libre al buffer para elegir víctimas, y no-force evita escrituras aleatorias en cada COMMIT.</p>

      <h2>Escritura anticipada (WAL)</h2>
      <div class="recuadro"><strong>Regla WAL.</strong> (1) El registro de bitácora de un cambio llega al disco antes que la página
      modificada. (2) Todos los registros de una transacción llegan al disco antes de confirmar su COMMIT.</div>
      <p>La regla 1 permite deshacer (el valor anterior está a salvo); la 2 permite rehacer. El COMMIT cuesta una escritura
      <em>secuencial</em> de la bitácora en vez de escrituras aleatorias de páginas de datos.</p>

      <h2>El algoritmo (estilo ARIES)</h2>
      <pre><code>análisis:  leer desde el último CHECKPOINT; armar las transacciones activas
           y las páginas sucias
rehacer:   desde el registro más antiguo que pueda faltar en disco,
           reaplicar todo cambio (repetir la historia, incluso de perdedoras)
deshacer:  recorrer hacia atrás los cambios de las perdedoras,
           restaurar el valor anterior y anotar un CLR por cada uno</code></pre>
      <p>Rehacer es idempotente: aplicar dos veces «A := 30» deja A = 30. Los <em>registros de compensación</em> (CLR) hacen idempotente
      también el deshacer, por si el sistema vuelve a caer durante la recuperación.</p>

      <h2>Puntos de control</h2>
      <p>Sin ellos, la recuperación debe leer la bitácora desde el principio de los tiempos. Un <strong>punto de control</strong> anota qué
      transacciones estaban activas y qué páginas estaban sucias; el análisis parte de ahí. Deshacer, en cambio, puede tener que retroceder
      más allá del punto de control, hasta el primer registro de la perdedora más antigua.</p>
      <p>Esta maquinaria es la que da la atomicidad y la durabilidad de <a href="tema.html?id=acid">ACID</a>, y depende de cómo el
      <a href="tema.html?id=paginas-buffer">gestor de buffer</a> elige qué páginas escribir.</p>`,
  });
})();
