(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Una búsqueda en una tienda: 10 interacciones de interfaz, una llamada a la lógica y 3 consultas a datos.
     Cada configuración dice en qué nivel vive cada capa: 0 cliente, 1 servidor de aplicación, 2 servidor de datos. */
  const CAPAS = [
    { clave: 'ui', nombre: 'interfaz', color: C.s1 },
    { clave: 'logica', nombre: 'lógica', color: C.s2 },
    { clave: 'datos', nombre: 'datos', color: C.s3 },
  ];
  const CONFIGS = {
    terminal: { nombre: 'Terminal (todo en el servidor)', ui: 1, logica: 1, datos: 2 },
    delgado: { nombre: 'Cliente delgado (web clásica)', ui: 0, logica: 1, datos: 2 },
    grueso: { nombre: 'Cliente grueso (lógica en el cliente)', ui: 0, logica: 0, datos: 2 },
    dosNiveles: { nombre: 'Dos niveles (lógica junto a los datos)', ui: 0, logica: 2, datos: 2 },
  };
  const COSTO = { ui: 2, logica: 6, consulta: 4 }; // ms de CPU
  const INTERACCIONES = 10, CONSULTAS = 3, LAN = 0.5;

  function evaluar(cfg, rtt, clientes) {
    // Cruces de red de la operación.
    const cruces = [];
    if (cfg.ui !== 0) cruces.push({ entre: [0, cfg.ui], veces: INTERACCIONES, rtt });
    if (cfg.logica !== cfg.ui) cruces.push({ entre: [cfg.ui, cfg.logica], veces: 1, rtt: cfg.ui === 0 ? rtt : LAN });
    if (cfg.datos !== cfg.logica) cruces.push({ entre: [cfg.logica, cfg.datos], veces: CONSULTAS, rtt: cfg.logica === 0 ? rtt : LAN });
    const red = cruces.reduce((s, c) => s + c.veces * c.rtt, 0);
    const cpu = [0, 0, 0];
    cpu[cfg.ui] += INTERACCIONES * COSTO.ui;
    cpu[cfg.logica] += COSTO.logica;
    cpu[cfg.datos] += CONSULTAS * COSTO.consulta;
    // Cada cliente hace una búsqueda cada 2 s. Los servidores son compartidos: espera ≈ servicio · ρ/(1 − ρ) (cola M/M/1).
    const util = [0, cpu[1] * clientes / 2000, cpu[2] * clientes / 2000];
    const espera = util.map((u, i) => (i === 0 ? 0 : u >= 1 ? Infinity : cpu[i] * u / (1 - u)));
    const total = red + cpu[0] + cpu[1] + cpu[2] + espera[1] + espera[2];
    return { cruces, red, cpu, util, espera, total, capacidad: Math.floor(2000 / Math.max(cpu[1], cpu[2], 1e-9)) };
  }

  function montar(cuerpo) {
    const est = { cfg: 'delgado', rtt: 40, clientes: 100 };
    let hover = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Distribución de las capas', valor: est.cfg, opciones: Object.entries(CONFIGS).map(([k, c]) => [k, c.nombre]), alCambiar: (v) => { est.cfg = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Latencia cliente–servidor (ida y vuelta)', min: 1, max: 200, valor: est.rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { est.rtt = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Clientes simultáneos', min: 10, max: 400, paso: 10, valor: est.clientes, alCambiar: (v) => { est.clientes = v; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 240 : 220) });
    VIZ.leyenda(cuerpo, CAPAS.map((c) => ({ color: c.color, texto: c.nombre })));
    VIZ.subtitulo(cuerpo, 'Tiempo de respuesta de una búsqueda, por configuración:');
    const lienzo2 = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    const tip = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'red' }, { color: C.s1, texto: 'CPU del cliente' }, { color: C.s7, texto: 'CPU de los servidores' }, { color: C.s8, texto: 'espera en cola de los servidores' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una búsqueda: 10 interacciones de interfaz (2 ms c/u), la lógica (6 ms) y 3 consultas (4 ms c/u). Dentro del centro de datos la latencia es 0,5 ms. Cada cliente busca cada 2 s.');

    function dibujar() {
      const cfg = CONFIGS[est.cfg], r = evaluar(cfg, est.rtt, est.clientes);
      // Diagrama de niveles.
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const niveles = ['Cliente', 'Servidor de aplicación', 'Servidor de datos'];
      const cw = (W - 40) / 3, xs = niveles.map((_, i) => 20 + i * cw);
      niveles.forEach((nv, i) => {
        ctx.fillStyle = C.fondo2; ctx.fillRect(xs[i] + 6, 8, cw - 12, H - 16);
        ctx.font = VIZ.fuente(W < 600 ? 10 : 12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(W < 600 ? nv.replace('Servidor de ', 'S. ') : nv, xs[i] + cw / 2, 24);
        const capas = CAPAS.filter((c) => cfg[c.clave] === i);
        capas.forEach((c, j) => {
          const y = 48 + j * 44;
          ctx.fillStyle = VIZ.alfa(c.color, 0.18); ctx.strokeStyle = c.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(xs[i] + 16, y, cw - 32, 34, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 500); ctx.fillText(c.nombre, xs[i] + cw / 2, y + 17);
        });
        if (i > 0) {
          ctx.font = VIZ.fuente(10); ctx.fillStyle = r.util[i] >= 1 ? C.s8 : C.tinta2;
          ctx.fillText(capas.length ? `${W < 600 ? 'CPU' : 'uso de CPU'} ${r.util[i] >= 1 ? '≥ 100' : Math.round(r.util[i] * 100)} %` : 'sin uso', xs[i] + cw / 2, H - 22);
        }
      });
      r.cruces.forEach((c, k) => {
        const [a, b] = c.entre, y = H - 60 - k * 22;
        const x0 = xs[a] + cw / 2 + 10, x1 = xs[b] + cw / 2 - 10;
        VIZ.dist.flecha(ctx, x0, y, x1, y, { color: C.s4, ancho: 2 });
        VIZ.dist.flecha(ctx, x1, y + 5, x0, y + 5, { color: C.s4, ancho: 1.2 });
        VIZ.dist.etiqueta(ctx, `${c.veces} × ${c.rtt} ms`, (x0 + x1) / 2, y - 9, { color: C.tinta2, tam: 10 });
      });
      // Barras de todas las configuraciones.
      const c2 = lienzo2.ctx, W2 = lienzo2.ancho;
      lienzo2.limpiar();
      const claves = Object.keys(CONFIGS);
      const res = claves.map((k) => evaluar(CONFIGS[k], est.rtt, est.clientes));
      const finitos = res.map((x) => x.total).filter(Number.isFinite);
      const tmax = Math.max(50, ...finitos) * 1.1;
      const izq = W2 < 600 ? 92 : 130, der = 70, alto = 30;
      geo = { izq, der, alto };
      claves.forEach((k, i) => {
        const x = res[i], y = 12 + i * (alto + 14);
        c2.font = VIZ.fuente(W2 < 600 ? 10 : 11, k === est.cfg ? 600 : 400); c2.fillStyle = C.tinta; c2.textAlign = 'right'; c2.textBaseline = 'middle';
        c2.fillText(CONFIGS[k].nombre.split(' (')[0], izq - 8, y + alto / 2);
        const partes = [[x.red, C.s4], [x.cpu[0], C.s1], [x.cpu[1] + x.cpu[2], C.s7], [x.espera[1] + x.espera[2], C.s8]];
        let acc = 0;
        const esc = (v) => izq + (Math.min(v, tmax) / tmax) * (W2 - izq - der);
        for (const [v, col] of partes) {
          if (!(v > 0) || !Number.isFinite(v)) continue;
          const x0 = esc(acc), x1 = esc(acc + v);
          c2.fillStyle = hover < 0 || hover === i ? col : VIZ.alfa(col, 0.4);
          c2.fillRect(x0, y, Math.max(1, x1 - x0 - 1), alto);
          acc += v;
        }
        if (k === est.cfg) { c2.strokeStyle = C.tinta; c2.lineWidth = 1.5; c2.strokeRect(izq - 2, y - 3, W2 - izq - der + 4, alto + 6); }
        c2.font = VIZ.fuente(11, 500); c2.fillStyle = Number.isFinite(x.total) ? C.tinta : C.s8; c2.textAlign = 'left';
        c2.fillText(Number.isFinite(x.total) ? `${Math.round(x.total)} ms` : 'saturado', Math.min(esc(acc) + 6, W2 - der + 4), y + alto / 2);
      });
      const cuello = r.util[1] >= r.util[2] ? 'servidor de aplicación' : 'servidor de datos';
      registro.textContent = `${cfg.nombre}: ${r.cruces.reduce((s, c) => s + c.veces, 0)} idas y vueltas por la red, ${Math.round(r.red)} ms en la red. ` +
        (Number.isFinite(r.total) ? `El cuello de botella es el ${cuello}, que soporta hasta ${VIZ.entero(r.capacidad)} clientes.` : `El ${cuello} está saturado: con ${est.clientes} clientes su cola crece sin límite.`);
      lectura.set([
        ['respuesta', Number.isFinite(r.total) ? `${Math.round(r.total)} ms` : '∞'],
        ['en la red', `${Math.round(r.red)} ms`],
        ['CPU en el cliente', `${r.cpu[0]} ms`],
        ['capacidad', `${VIZ.entero(r.capacidad)} clientes`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = dibujar;
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      const i = Math.floor((y - 12 + 7) / (geo.alto + 14));
      const claves = Object.keys(CONFIGS);
      if (i < 0 || i >= claves.length || x < geo.izq) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = i;
      dibujar();
      const r = evaluar(CONFIGS[claves[i]], est.rtt, est.clientes);
      const f = (v) => (Number.isFinite(v) ? `${VIZ.fmt(v, 3)} ms` : '∞');
      tip.mostrar(x, y, `<b>${CONFIGS[claves[i]].nombre}</b>` + VIZ.filaTooltip(C.s4, 'red', f(r.red)) + VIZ.filaTooltip(C.s1, 'CPU cliente', f(r.cpu[0])) +
        VIZ.filaTooltip(C.s7, 'CPU servidores', f(r.cpu[1] + r.cpu[2])) + VIZ.filaTooltip(C.s8, 'espera', f(r.espera[1] + r.espera[2])));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('client-server', {
    intro: String.raw`
      <p>Un <strong>sistema distribuido</strong> es un conjunto de computadores independientes que se presenta a sus usuarios como un único sistema
      coherente. La forma más común de organizarlo es <strong>cliente-servidor</strong>: unos procesos ofrecen servicios y otros los piden, con un
      protocolo de pedido y respuesta. La aplicación se piensa en <strong>capas</strong> lógicas (interfaz, lógica de negocio, datos), y la
      arquitectura decide en qué máquinas, o <strong>niveles</strong>, vive cada una.</p>
      <p>Esa decisión no es estética: cada vez que dos capas quedan en máquinas distintas, cada llamada entre ellas paga la latencia de la red, y cada
      capa que se concentra en un servidor compartido se paga en su capacidad.</p>`,
    visualizaciones: [
      {
        titulo: 'Dónde poner cada capa',
        descripcion: 'Cambie la distribución y la latencia. Con la interfaz en el servidor, cada clic cruza la red; con la lógica en el cliente, cada consulta la cruza. Suba los clientes hasta saturar el servidor de la configuración elegida.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Capas y niveles</h2>
      <p>Una <strong>arquitectura en capas</strong> organiza el software de modo que cada capa solo usa los servicios de la de abajo: la pila de red
      (aplicación, transporte, red, enlace) o las tres capas lógicas de una aplicación. Los <strong>niveles</strong> (<em>tiers</em>) son la distribución física:</p>
      <table>
        <tr><th>Arquitectura</th><th>Cliente</th><th>Servidores</th><th>Ejemplo</th></tr>
        <tr><td>Un nivel / terminal</td><td>Solo presentación</td><td>Todo</td><td>Mainframe, escritorio remoto</td></tr>
        <tr><td>Dos niveles</td><td>Interfaz (y quizás lógica)</td><td>Datos (y lógica)</td><td>Aplicación con base de datos</td></tr>
        <tr><td>Tres niveles</td><td>Interfaz</td><td>Lógica \(\vert\) datos</td><td>Web: navegador, servidor de aplicación, base de datos</td></tr>
      </table>
      <p>El tiempo de respuesta de una operación es aproximadamente \(\sum_{\text{cruces}} k_i \cdot \text{RTT}_i + \sum \text{CPU} + \text{espera}\): agrupar en una
      misma máquina las capas que conversan mucho reduce \(k_i\). Un servidor compartido por \(N\) clientes con uso \(\rho\) agrega una espera que crece como
      \(\rho/(1-\rho)\) y explota al acercarse a la saturación (ver <a href="tema.html?id=scalability-load-balancing">escalabilidad</a>).</p>

      <h2>Middleware</h2>
      <p>El <strong>middleware</strong> es la capa de software entre el sistema operativo y las aplicaciones que oculta la distribución y la heterogeneidad:
      ofrece comunicación (<a href="tema.html?id=rpc">RPC</a>, invocación de objetos remotos, colas de mensajes,
      <a href="tema.html?id=pub-sub">publicación/suscripción</a>), nombres, seguridad, transacciones y replicación. Es a un sistema distribuido lo que el sistema
      operativo es a un computador.</p>

      <h2>Transparencia</h2>
      <table>
        <tr><th>Transparencia de…</th><th>Oculta</th></tr>
        <tr><td>Acceso</td><td>Diferencias de representación de datos y de forma de acceso</td></tr>
        <tr><td>Ubicación</td><td>Dónde está el recurso</td></tr>
        <tr><td>Migración / reubicación</td><td>Que el recurso se mueva (incluso mientras se usa)</td></tr>
        <tr><td>Replicación</td><td>Que existen varias copias</td></tr>
        <tr><td>Concurrencia</td><td>Que otros usuarios comparten el recurso</td></tr>
        <tr><td>Fallas</td><td>Las fallas y la recuperación de un componente</td></tr>
      </table>
      <p>La transparencia total es imposible y a veces indeseable: no se puede ocultar la latencia de un servidor al otro lado del mundo, ni distinguir un
      servidor lento de uno caído.</p>

      <h2>Escalabilidad e interoperabilidad</h2>
      <p>Un sistema escala en <strong>tamaño</strong> (más usuarios y recursos), en <strong>geografía</strong> (usuarios lejanos) y en <strong>administración</strong>
      (varias organizaciones). Las técnicas son ocultar la latencia (comunicación asíncrona, mover lógica al cliente), distribuir (particionar datos, DNS) y
      replicar (cachés, réplicas). La <strong>interoperabilidad</strong> exige interfaces descritas en un lenguaje neutro (IDL, OpenAPI, Protocol Buffers) y
      protocolos estándar, para que componentes de distintos fabricantes coexistan.</p>

      <h2>Servicios y eventos</h2>
      <p>En una <strong>arquitectura orientada a servicios</strong> (SOA y, en su versión de grano fino, microservicios) cada servicio encapsula sus datos y expone una
      interfaz por la red; los servicios se componen llamándose entre sí. En una <strong>arquitectura orientada a eventos</strong>, en cambio, los componentes
      reaccionan a eventos publicados en un bus, sin llamarse directamente: más desacoplados, pero con flujos más difíciles de seguir.</p>`,
  });
})();
