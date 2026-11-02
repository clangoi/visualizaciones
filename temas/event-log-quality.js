(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  function fecha(min) {
    if (min === null || min === undefined) return 'NULL';
    const t = Math.round(min) + 480, d = Math.floor(t / 1440), r = t % 1440;
    return `${DIAS[d % 7]} ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  }
  function tabla(cabecera, filas, extra = '') {
    const t = VIZ.el('table', { class: 'tabla-datos sin-corte texto' });
    t.appendChild(VIZ.el('thead', null, VIZ.el('tr', null, cabecera.map((h) => VIZ.el('th', null, h)))));
    const tb = VIZ.el('tbody');
    for (const f of filas) {
      tb.appendChild(VIZ.el('tr', { class: f.activa ? 'activa' : null },
        f.c.map((c) => VIZ.el('td', c === 'NULL' || c === '∅' ? { class: 'vacia' } : null, c))));
    }
    t.appendChild(tb);
    return VIZ.el('div', { class: 'caja-desplazable ' + extra }, t);
  }

  /* ---------- Fig. 1: de tablas relacionales a eventos ---------- */

  // Base de datos de ejemplo: pedidos, facturas, envíos y pagos (puede haber varias facturas o envíos por pedido).
  function crearBD(semilla) {
    const rnd = VIZ.semilla(semilla);
    const pedido = [], factura = [], envio = [], pago = [];
    const CLIENTES = ['Textil Sur', 'Café Andes', 'Mar y Sol', 'Ferretería Sur', 'Libros del Valle'];
    for (let k = 1; k <= 5; k++) {
      const creado = k * 70 + Math.round(rnd() * 40);
      pedido.push({ id: 'P' + k, creado, cliente: CLIENTES[(k - 1 + Math.floor(rnd() * 2)) % 5] });
      const nf = rnd() < 0.3 ? 2 : 1, ne = rnd() < 0.3 ? 2 : 1;
      for (let i = 0; i < nf; i++) {
        const f = { id: 'F' + (factura.length + 1), pedido: 'P' + k, emitida: creado + 25 + i * 45 + Math.round(rnd() * 30) };
        factura.push(f);
        pago.push({ id: 'G' + (pago.length + 1), factura: f.id, pagado: rnd() < 0.85 ? f.emitida + 40 + Math.round(rnd() * 200) : null });
      }
      for (let i = 0; i < ne; i++) {
        const s = creado + 70 + i * 50 + Math.round(rnd() * 40);
        envio.push({ id: 'S' + (envio.length + 1), pedido: 'P' + k, salida: s, entrega: s + 50 + Math.round(rnd() * 90) });
      }
    }
    return { pedido, factura, envio, pago };
  }
  const COLUMNAS = [
    { k: 'creado', tabla: 'pedido', col: 'creado', act: 'Crear pedido' },
    { k: 'emitida', tabla: 'factura', col: 'emitida', act: 'Emitir factura' },
    { k: 'salida', tabla: 'envio', col: 'salida', act: 'Enviar' },
    { k: 'entrega', tabla: 'envio', col: 'entrega', act: 'Entregar' },
    { k: 'pagado', tabla: 'pago', col: 'pagado', act: 'Registrar pago' },
  ];
  const NOCION = { pedido: 'pedido', factura: 'factura', envio: 'envío' };

  function montarExtraccion(cuerpo) {
    let semilla = 4, noc = 'pedido', activas = { creado: true, emitida: true, salida: true, entrega: true, pagado: true }, bd, eventos = [], omitidas = 0, conFecha = 0, fase = 0, mensaje = '', ordenado = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Noción de caso (Case ID)', valor: noc,
      opciones: [['pedido', 'Un caso = un pedido'], ['factura', 'Un caso = una factura'], ['envio', 'Un caso = un envío']],
      alCambiar: (v) => { noc = v; rep.reiniciar(); },
    });
    ctl.casillas(COLUMNAS.map((c) => ({ clave: c.k, texto: `${c.tabla.toUpperCase()}.${c.col}`, activo: true })), (e) => { activas = e; rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    cuerpo.dataset.sinLeyenda = 'solo tablas, sin lienzo ni colores con significado';
    const zonaBD = VIZ.el('div', { class: 'tablas-bdd' });
    cuerpo.appendChild(zonaBD);
    VIZ.subtitulo(cuerpo, 'Registro de eventos construido');
    const zonaLog = VIZ.el('div');
    cuerpo.appendChild(zonaLog);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque qué columnas de fecha se convierten en eventos y elija qué es un caso; cada paso del reproductor lee una columna y genera un evento por fila con fecha, uniendo las tablas por sus claves. Con «un caso = una factura» o «un envío», los eventos del pedido se copian a cada caso, y los pagos pendientes (NULL) no generan evento.');

    function filasDe(c) { return bd[c.tabla]; }
    function pedidoDe(t, fila) { return t === 'pedido' ? fila.id : t === 'pago' ? bd.factura.find((f) => f.id === fila.factura).pedido : fila.pedido; }
    // Casos que le corresponden a una fila: ella misma si es de la tabla de casos; si no, todos los casos de su pedido.
    function casosDe(t, fila) {
      const tabCaso = noc === 'pedido' ? 'pedido' : noc;
      if (t === tabCaso) return [fila.id];
      const ped = pedidoDe(t, fila);
      return bd[tabCaso].filter((x) => (tabCaso === 'pedido' ? x.id : x.pedido) === ped).map((x) => x.id);
    }

    function iniciar() {
      bd = crearBD(semilla);
      eventos = []; omitidas = 0; conFecha = 0; fase = 0; ordenado = false; mensaje = '';
      return (function* () {
        for (const c of COLUMNAS) {
          if (!activas[c.k]) continue;
          let leidas = 0, nulos = 0, nuevos = 0;
          eventos.forEach((e) => { e.activa = false; });
          for (const f of filasDe(c)) {
            leidas++;
            if (f[c.col] === null) { nulos++; omitidas++; continue; }
            conFecha++;
            for (const caso of casosDe(c.tabla, f)) { eventos.push({ caso, act: c.act, ts: f[c.col], origen: `${c.tabla.toUpperCase()}.${c.col}`, activa: true }); nuevos++; }
          }
          fase++;
          mensaje = `Columna ${c.tabla.toUpperCase()}.${c.col} → actividad «${c.act}»: ${leidas} filas, ${nulos ? nulos + ' sin fecha (no generan evento), ' : ''}${nuevos} evento(s)${nuevos > leidas - nulos ? ' (algunos se copian a varios casos)' : ''}.`;
          yield;
        }
        eventos.forEach((e) => { e.activa = false; });
        eventos.sort((a, b) => (a.caso < b.caso ? -1 : a.caso > b.caso ? 1 : a.ts - b.ts));
        ordenado = true;
        mensaje = 'Se ordenó por Case ID y marca de tiempo: cada grupo de filas es una traza.';
        yield;
      })();
    }
    function dibujar() {
      zonaBD.replaceChildren(
        ...[['PEDIDO', ['id', 'creado', 'cliente'], bd.pedido.map((r) => [r.id, fecha(r.creado), r.cliente])],
          ['FACTURA', ['id', 'pedido', 'emitida'], bd.factura.map((r) => [r.id, r.pedido, fecha(r.emitida)])],
          ['ENVIO', ['id', 'pedido', 'salida', 'entrega'], bd.envio.map((r) => [r.id, r.pedido, fecha(r.salida), fecha(r.entrega)])],
          ['PAGO', ['id', 'factura', 'pagado'], bd.pago.map((r) => [r.id, r.factura, fecha(r.pagado)])]]
          .map(([nombre, cab, filas]) => VIZ.el('div', { class: 'tabla-bdd' }, VIZ.el('p', { class: 'tabla-bdd-titulo' }, nombre), tabla(cab, filas.map((c) => ({ c })))))
      );
      zonaLog.replaceChildren(eventos.length
        ? tabla(['Case ID', 'Actividad', 'Marca de tiempo', 'Origen'], eventos.map((e) => ({ activa: e.activa, c: [e.caso, e.act, fecha(e.ts), e.origen] })), 'caja-alta')
        : VIZ.el('div', { class: 'fichas' }, VIZ.el('span', { class: 'fichas-vacio' }, 'Aún no hay eventos: pulse «Un paso».')));
      registro.textContent = mensaje || 'Cada columna de fecha de una tabla es una actividad en potencia. Pulse «Un paso» para extraer la primera.';
      const casos = new Set(eventos.map((e) => e.caso));
      const porCaso = new Map();
      for (const e of eventos) { if (!porCaso.has(e.caso)) porCaso.set(e.caso, []); porCaso.get(e.caso).push(e); }
      const variantes = new Set([...porCaso.values()].map((l) => l.slice().sort((a, b) => a.ts - b.ts).map((e) => e.act).join('›')));
      lectura.set([
        ['eventos', String(eventos.length)],
        ['casos', String(casos.size)],
        ['variantes', ordenado || fase === COLUMNAS.filter((c) => activas[c.k]).length ? String(variantes.size) : '…'],
        ['filas sin fecha omitidas', String(omitidas)],
        ['eventos copiados por unión', String(eventos.length - conFecha)],
        ['caso es', NOCION[noc]],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: detectar y limpiar defectos ---------- */

  function montarCalidad(cuerpo) {
    let falt = 5, dup = 5, desfase = 45, corr = 0, semilla = 1, limpiarDup = true, limpiarVac = true;
    const verdad = P.simular(P.procesos.pedidos.arbol, 80, 31, { espera: 15, llegada: 60 });
    const filasVerdad = [];
    verdad.forEach((c) => c.eventos.forEach((e, i) => filasVerdad.push({ caso: c.id, act: e.act, ts: e.fin, rol: e.rol, i })));
    const sep = '\u0001';
    const trazasDe = (filas) => {
      const m = new Map();
      filas.forEach((f, k) => { if (!m.has(f.caso)) m.set(f.caso, []); m.get(f.caso).push({ ...f, k }); });
      const r = new Map();
      for (const [c, l] of m) r.set(c, l.sort((a, b) => a.ts - b.ts || a.k - b.k).map((e) => e.act || 'Ø'));
      return r;
    };
    const tv = trazasDe(filasVerdad);
    const paresV = new Set();
    for (const t of tv.values()) for (let i = 0; i + 1 < t.length; i++) paresV.add(t[i] + sep + t[i + 1]);
    const metricas = (filas) => {
      const t = trazasDe(filas), pares = new Set();
      let espurios = 0;
      for (const tr of t.values()) for (let i = 0; i + 1 < tr.length; i++) {
        const k = tr[i] + sep + tr[i + 1];
        if (!paresV.has(k)) { pares.add(k); espurios++; }
      }
      let iguales = 0;
      for (const [c, tr] of t) if (tv.has(c) && tr.join(sep) === tv.get(c).join(sep)) iguales++;
      return { variantes: new Set([...t.values()].map((x) => x.join(sep))).size, pares: pares.size, espurios, iguales: iguales / tv.size, eventos: filas.length };
    };
    let sucio = [], limpio = [], M = {}, def = {}, geo = null;

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Actividades faltantes', min: 0, max: 20, valor: falt, formato: (v) => v + ' %', alCambiar: (v) => { falt = v; calcular(); } });
    ctl.rango({ etiqueta: 'Eventos duplicados', min: 0, max: 20, valor: dup, formato: (v) => v + ' %', alCambiar: (v) => { dup = v; calcular(); } });
    ctl.rango({ etiqueta: 'Reloj de finanzas adelantado', min: -120, max: 120, paso: 5, valor: desfase, formato: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' min', alCambiar: (v) => { desfase = v; calcular(); } });
    const rCorr = ctl.rango({ etiqueta: 'Corrección aplicada a ese reloj', min: -120, max: 120, paso: 5, valor: corr, formato: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' min', alCambiar: (v) => { corr = v; calcular(); } });
    ctl.casillas([
      { clave: 'dup', texto: 'eliminar duplicados exactos', activo: true },
      { clave: 'vac', texto: 'descartar eventos sin actividad', activo: true },
    ], (e) => { limpiarDup = e.dup; limpiarVac = e.vac; calcular(); });
    ctl.boton('Estimar corrección', () => {
      let mejor = 0, mejorV = Infinity;
      for (let c = -150; c <= 150; c += 5) { const v = metricas(limpiar(sucio, c)).espurios; if (v < mejorV || (v === mejorV && Math.abs(c) < Math.abs(mejor))) { mejorV = v; mejor = c; } }
      corr = mejor; rCorr.valor = mejor; calcular();
    }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'variantes distintas', forma: 'cuadro' },
      { color: C.s8, texto: 'pares sucesivos que el proceso real no tiene', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El registro verdadero son 80 pedidos simulados. Se le inyectan faltantes, duplicados y un reloj desalineado en las actividades del sistema de finanzas. Pruebe cada limpieza por separado, luego «Estimar corrección» (busca el desfase que minimiza los pares espurios). Los eventos faltantes no se pueden recuperar: esos casos nunca vuelven a coincidir con la verdad.');

    function limpiar(filas, c) {
      let r = filas;
      if (limpiarDup) { const vistos = new Set(); r = r.filter((f) => { const k = f.caso + sep + f.act + sep + f.ts; if (vistos.has(k)) return false; vistos.add(k); return true; }); }
      if (limpiarVac) r = r.filter((f) => f.act !== '');
      if (c) r = r.map((f) => (f.rol === 'finanzas' ? { ...f, ts: f.ts - c } : f));
      return r;
    }
    function calcular() {
      const rnd = VIZ.semilla(semilla * 101 + 7);
      sucio = [];
      for (const f of filasVerdad) {
        const g = { ...f, act: rnd() < falt / 100 ? '' : f.act, ts: f.rol === 'finanzas' ? f.ts + desfase : f.ts };
        sucio.push(g);
        if (rnd() < dup / 100) sucio.push({ ...g });
      }
      limpio = limpiar(sucio, corr);
      M = { verdad: metricas(filasVerdad), sucio: metricas(sucio), limpio: metricas(limpio) };
      // Detección sobre el registro sucio (en el orden del archivo).
      const vistos = new Set();
      let duplicados = 0, vacias = 0;
      for (const f of sucio) { const k = f.caso + sep + f.act + sep + f.ts; if (vistos.has(k)) duplicados++; vistos.add(k); if (f.act === '') vacias++; }
      const ult = new Map();
      const atras = new Set();
      for (const f of sucio) { if (ult.has(f.caso) && f.ts < ult.get(f.caso)) atras.add(f.caso); ult.set(f.caso, Math.max(f.ts, ult.get(f.caso) ?? -Infinity)); }
      def = { duplicados, vacias, atras: atras.size };
      dibujar();
    }
    function dibujar() {
      if (!M.verdad) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = Math.min(66, W * 0.18), der = 14, sup = 10, grupo = (H - sup - 30) / 3;
      const maxV = Math.max(1, ...['verdad', 'sucio', 'limpio'].map((k) => Math.max(M[k].variantes, M[k].pares)));
      const escala = Math.ceil(maxV * 1.1 / 5) * 5, sx = (v) => izq + v / escala * (W - izq - der);
      geo = [];
      ctx.font = VIZ.fuente(11);
      ctx.textBaseline = 'middle';
      // Rejilla.
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
      for (const t of VIZ.ticks(0, escala, Math.max(2, Math.floor((W - izq - der) / 80)))) {
        ctx.beginPath(); ctx.moveTo(sx(t) + 0.5, sup); ctx.lineTo(sx(t) + 0.5, H - 24); ctx.stroke();
        ctx.fillText(String(t), sx(t), H - 12);
      }
      [['verdad', 'Verdad'], ['sucio', 'Sucio'], ['limpio', 'Limpio']].forEach(([k, t], i) => {
        const y = sup + i * grupo, h = Math.min(20, (grupo - 10) / 2);
        ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(11, 600); ctx.fillText(t, 2, y + grupo / 2 - 4);
        [['variantes', C.s1, 'variantes distintas'], ['pares', C.s8, 'pares espurios']].forEach(([m, col, nombre], j) => {
          const by = y + 4 + j * (h + 3), v = M[k][m];
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(izq, by, Math.max(2, sx(v) - izq), h, [0, 4, 4, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'left'; ctx.fillText(String(v), sx(v) + 5, by + h / 2);
          geo.push({ y0: by, y1: by + h, x1: sx(v), k, t, m, nombre, v });
        });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const d = def, ms = M.sucio, ml = M.limpio;
      registro.textContent = `Registro sucio: ${d.vacias} evento(s) sin actividad, ${d.duplicados} duplicado(s) exacto(s) y ${d.atras} caso(s) con marcas de tiempo que retroceden en el orden del archivo (señal de reloj desalineado). `
        + (ml.pares === 0 && ml.iguales > 0.99 ? 'Tras la limpieza, el registro coincide con la verdad.'
          : `Tras la limpieza quedan ${ml.pares} par(es) espurio(s) distintos y ${VIZ.fmt(100 * ml.iguales, 3)} % de los casos idénticos a la verdad.`);
      lectura.set([
        ['eventos: verdad / sucio / limpio', `${M.verdad.eventos} / ${ms.eventos} / ${ml.eventos}`],
        ['casos idénticos a la verdad (sucio)', VIZ.fmt(100 * ms.iguales, 3) + ' %'],
        ['casos idénticos a la verdad (limpio)', VIZ.fmt(100 * ml.iguales, 3) + ' %'],
        ['desfase restante del reloj', (desfase - corr > 0 ? '+' : desfase - corr < 0 ? '−' : '') + Math.abs(desfase - corr) + ' min'],
        ['variantes verdad → limpio', `${M.verdad.variantes} → ${ml.variantes}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo && geo.find((b) => y >= b.y0 && y <= b.y1 && x <= b.x1 + 30);
      if (!g) return tip.ocultar();
      const m = M[g.k];
      tip.mostrar(x, y, `<b>${g.t}</b>: ${g.nombre} <b>${g.v}</b><br>eventos ${m.eventos} · variantes ${m.variantes}<br>flechas espurias en total ${m.espurios}<br>casos idénticos a la verdad ${VIZ.fmt(100 * m.iguales, 3)} %`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('event-log-quality', {
    intro: String.raw`
      <p>Casi nunca existe un registro de eventos ya hecho: hay que <strong>extraerlo</strong> de las tablas de un sistema de información (ERP, CRM, bases de datos de aplicaciones)
      donde cada hecho es una fila con una fecha. Hay que decidir qué es un caso, qué columnas de fecha son actividades y cómo unir las tablas.
      Esas decisiones cambian el resultado: el mismo sistema da registros distintos según se mire por pedido, por factura o por envío.</p>
      <p>Después viene la <strong>calidad</strong>: valores faltantes, duplicados, relojes desalineados entre sistemas y eventos fuera de orden. Cualquier modelo descubierto
      hereda sus errores, así que conviene detectar, limpiar y medir el efecto antes de modelar.</p>`,
    visualizaciones: [
      {
        titulo: 'De tablas relacionales a eventos',
        descripcion: 'Ejecute la extracción columna por columna y cambie la noción de caso: con facturas o envíos como caso, los eventos del pedido se copian a cada caso y los pagos pendientes desaparecen.',
        montar: montarExtraccion,
      },
      {
        titulo: 'Detectar y limpiar defectos',
        descripcion: 'Inyecte faltantes, duplicados y un reloj adelantado, y compare variantes y flechas espurias antes y después de limpiar. Use «Estimar corrección» para el reloj.',
        montar: montarCalidad,
      },
    ],
    teoria: String.raw`
      <h2>Extracción desde un sistema de información</h2>
      <p>Una base relacional guarda <em>entidades</em> (pedido, factura, envío) con claves y columnas de fecha. Para formar un registro se eligen:</p>
      <ol>
        <li>la <strong>noción de caso</strong>: la entidad cuyo identificador será el Case ID;</li>
        <li>las <strong>actividades</strong>: columnas de fecha (o tablas de cambios de estado) que representan hechos del proceso;</li>
        <li>las <strong>uniones</strong> que llevan cada fila hasta su caso (por ejemplo PAGO → FACTURA → PEDIDO).</li>
      </ol>
      <pre><code>para cada columna de fecha c con actividad a(c) en tabla T:
    para cada fila f de T con f.c ≠ NULL:
        para cada caso k asociado a f (por unión):
            emitir evento (k, a(c), f.c)
ordenar los eventos por (Case ID, marca de tiempo)</code></pre>
      <div class="recuadro"><strong>Convergencia y divergencia.</strong> Si un pedido tiene dos facturas y el caso es el pedido, «Emitir factura» aparece dos veces en la misma traza (divergencia). Si el caso es la factura, «Crear pedido» se copia a ambos casos (convergencia): el mismo hecho cuenta dos veces. Los
      <a href="tema.html?id=object-centric-event-logs">registros centrados en objetos</a> evitan elegir un único caso.</div>

      <h2>Dimensiones de calidad</h2>
      <table>
        <tr><th>Defecto</th><th>Causa típica</th><th>Efecto en el modelo</th><th>Tratamiento</th></tr>
        <tr><td>Faltantes</td><td>campos sin llenar, eventos no instrumentados</td><td>saltos que el proceso no hace; trazas «incompletas»</td><td>descartar o imputar; no siempre recuperable</td></tr>
        <tr><td>Duplicados</td><td>reintentos, cargas repetidas</td><td>bucles espurios en el grafo</td><td>eliminar duplicados exactos</td></tr>
        <tr><td>Reloj desalineado</td><td>sistemas con hora distinta o zona horaria errónea</td><td>órdenes imposibles, relaciones causales invertidas</td><td>estimar y corregir el desfase por sistema</td></tr>
        <tr><td>Granularidad</td><td>solo se guarda la fecha, sin hora</td><td>empates: el orden es ambiguo</td><td>usar un orden secundario o aceptar paralelismo</td></tr>
        <tr><td>Fuera de orden</td><td>carga por lotes</td><td>ninguno si se ordena por marca de tiempo</td><td>ordenar siempre antes de formar las trazas</td></tr>
      </table>

      <h2>Medir el efecto</h2>
      <p>Si se conoce (o se aproxima) un comportamiento de referencia \(R\), el daño de los defectos se puede medir con el número de <a href="tema.html?id=traces-and-variants">variantes</a>
      y con los pares de sucesión que no están en \(R\):</p>
      \[ \text{espurios}(L) = \bigl| \{ (a,b) : a >_L b \} \setminus \{ (a,b) : a >_R b \} \bigr|. \]
      <p>La corrección del reloj se estima buscando el desfase \(\delta\) que minimiza esa cantidad (o, sin referencia, el número de relaciones causales contradictorias). Un registro limpio no es un registro verdadero: lo que no se registró no se recupera, y limpiar demasiado
      puede borrar el comportamiento excepcional que justamente interesa. El ruido que sobrevive influye en el <a href="tema.html?id=noise-and-incompleteness">descubrimiento</a>, y los intervalos requieren
      un <a href="tema.html?id=activity-lifecycle">ciclo de vida</a> fiable. Vea también cómo es la tabla final en <a href="tema.html?id=event-logs">registros de eventos</a>.</p>`,
  });
})();
