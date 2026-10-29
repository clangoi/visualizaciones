(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  /* ---------- Fig. 1: síncrona, asíncrona y con cola persistente ---------- */

  const MODOS = {
    sinc: 'Síncrona (RPC: el cliente espera)',
    asinc: 'Asíncrona transitoria (enviar y seguir)',
    cola: 'Asíncrona persistente (cola de mensajes)',
  };
  const RED = 0.8, SERVICIO = 1.6, TRABAJO = 1.2, N = 4;

  // Línea de tiempo: el cliente alterna trabajo local y envío de pedidos. caida: [t0, t1] en que el servidor no está.
  function simular(modo, caida) {
    const cli = [], srv = [], msgs = [], bloqueos = [];
    let t = 0.3, tSrv = 0, perdidos = 0, fallidos = 0;
    const abajo = (x) => caida && x >= caida[0] && x < caida[1];
    const pend = [];
    for (let i = 0; i < N; i++) {
      cli.push({ t0: t, t1: t + TRABAJO, tipo: 'trabajo' });
      t += TRABAJO;
      const llega = t + RED;
      if (modo === 'cola') {
        msgs.push({ p0: 0, t0: t, p1: 1, t1: t + RED * 0.5, tipo: 'ped', i });
        pend.push({ i, t: t + RED * 0.5 });
      } else if (abajo(llega)) {
        msgs.push({ p0: 0, t0: t, p1: 2, t1: llega, tipo: 'ped', i, perdido: true });
        if (modo === 'sinc') { const to = t + 2.5; bloqueos.push({ t0: t, t1: to, error: true }); t = to; fallidos++; } else perdidos++;
      } else {
        msgs.push({ p0: 0, t0: t, p1: 2, t1: llega, tipo: 'ped', i });
        const ini = Math.max(llega, tSrv), fin = ini + SERVICIO;
        srv.push({ t0: ini, t1: fin, i }); tSrv = fin;
        msgs.push({ p0: 2, t0: fin, p1: 0, t1: fin + RED, tipo: 'res', i });
        if (modo === 'sinc') { bloqueos.push({ t0: t, t1: fin + RED }); t = fin + RED; }
      }
      t += 0.1;
    }
    if (modo === 'cola') {
      // El broker entrega en orden cuando el servidor está disponible.
      for (const p of pend) {
        let ini = Math.max(p.t + RED * 0.5, tSrv);
        if (abajo(ini)) ini = caida[1];
        msgs.push({ p0: 1, t0: ini - RED * 0.5, p1: 2, t1: ini, tipo: 'ped', i: p.i });
        const fin = ini + SERVICIO;
        srv.push({ t0: ini, t1: fin, i: p.i }); tSrv = fin;
        msgs.push({ p0: 2, t0: fin, p1: 1, t1: fin + RED * 0.5, tipo: 'res', i: p.i });
      }
    }
    const fin = Math.max(t, ...srv.map((s) => s.t1 + RED), ...msgs.map((m) => m.t1));
    return { cli, srv, msgs, bloqueos, perdidos, fallidos, fin, tCliente: t, bloqueado: bloqueos.reduce((s, b) => s + b.t1 - b.t0, 0) };
  }

  function montarModos(cuerpo) {
    const est = { modo: 'sinc', caida: false };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Comunicación', valor: est.modo, opciones: Object.entries(MODOS), alCambiar: (v) => { est.modo = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'El servidor se desconecta un rato', valor: est.caida, alCambiar: (v) => { est.caida = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 220 : 210) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'trabajo local del cliente' }, { color: C.s4, texto: 'cliente bloqueado esperando' },
      { color: C.s2, texto: 'servidor atendiendo' }, { color: C.s8, texto: 'servidor desconectado / mensaje perdido' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El cliente debe hacer 4 trabajos locales y enviar un pedido después de cada uno. La fila «Cola» es el broker de mensajes, que guarda los pedidos.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const caida = est.caida ? [2.5, 9] : null;
      const r = simular(est.modo, caida);
      const tMax = Math.max(16, r.fin + 0.5);
      const geo = D.espacioTiempo(lienzo, {
        procesos: ['Cliente', 'Cola', 'Servidor'], t: [0, tMax], margenIzq: 66, sup: 22, inf: 22,
        colorProceso: (p) => (p === 1 && est.modo !== 'cola' ? C.tenue : C.tinta),
        intervalos: [
          ...r.cli.map((c) => ({ p: 0, t0: c.t0, t1: c.t1, color: C.s1, relleno: VIZ.alfa(C.s1, 0.25) })),
          ...r.bloqueos.map((b) => ({ p: 0, t0: b.t0, t1: b.t1, color: b.error ? C.s8 : C.s4, relleno: VIZ.alfa(C.s4, 0.3), texto: b.error ? 'timeout' : 'espera', colorTexto: b.error ? C.s8 : C.tinta })),
          ...r.srv.map((s) => ({ p: 2, t0: s.t0, t1: s.t1, color: C.s2, relleno: VIZ.alfa(C.s2, 0.25), texto: `#${s.i + 1}` })),
        ],
        mensajes: r.msgs.map((m) => ({ p0: m.p0, t0: m.t0, p1: m.p1, t1: m.perdido ? m.t0 + (m.t1 - m.t0) * 0.7 : m.t1, color: m.perdido ? C.s8 : m.tipo === 'ped' ? C.tinta2 : C.apagado, guiones: m.perdido || m.tipo === 'res' ? [4, 3] : null })),
      });
      if (caida) {
        ctx.fillStyle = VIZ.alfa(C.s8, 0.12);
        ctx.fillRect(geo.x(caida[0]), geo.y(2) - 14, geo.x(caida[1]) - geo.x(caida[0]), 28);
        D.etiqueta(ctx, 'desconectado', (geo.x(caida[0]) + geo.x(caida[1])) / 2, geo.y(2) + 22, { color: C.s8, tam: 10 });
      }
      const atendidos = r.srv.length;
      registro.textContent = est.modo === 'sinc'
        ? `El cliente pasa ${VIZ.fmt(r.bloqueado, 3)} unidades bloqueado esperando respuestas${r.fallidos ? ` y ${r.fallidos} llamada${r.fallidos > 1 ? 's terminan' : ' termina'} en timeout` : ''}. Acoplamiento total: si el servidor no está, el cliente no avanza.`
        : est.modo === 'asinc'
          ? `El cliente termina su trabajo en ${VIZ.fmt(r.tCliente, 3)} unidades sin esperar.${r.perdidos ? ` Pero ${r.perdidos} mensaje${r.perdidos > 1 ? 's se pierden' : ' se pierde'}: nadie los guardó mientras el servidor no estaba.` : ''}`
          : `El cliente no espera y la cola guarda los pedidos: el servidor los atiende todos${caida ? ' cuando vuelve' : ''}, aunque no estuviera activo al enviarlos.`;
      lectura.set([
        ['cliente termina en', VIZ.fmt(r.tCliente, 3)],
        ['tiempo bloqueado', VIZ.fmt(r.bloqueado, 3)],
        ['pedidos atendidos', `${atendidos} de ${N}`],
        ['perdidos o fallidos', String(r.perdidos + r.fallidos)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: reintentos y backoff ---------- */

  const POLITICAS = [
    { clave: 'fijo', nombre: 'Intervalo fijo (1 s)', color: C.s1 },
    { clave: 'exp', nombre: 'Backoff exponencial', color: C.s2 },
    { clave: 'jitter', nombre: 'Exponencial con jitter', color: C.s3 },
  ];

  // N clientes fallan en t = 0; el servidor vuelve en tVuelve y atiende a lo más cap pedidos por segundo (el exceso falla).
  function simularReintentos(pol, Nc, cap, tVuelve, rnd) {
    const T = 60, carga = new Array(T).fill(0), exito = new Array(Nc).fill(null);
    const prox = Array.from({ length: Nc }, () => 0), intento = new Array(Nc).fill(0);
    for (let t = 0; t < T; t++) {
      const llegan = [];
      for (let c = 0; c < Nc; c++) if (exito[c] == null && prox[c] === t) llegan.push(c);
      carga[t] = llegan.length;
      // Se atiende un subconjunto al azar de hasta cap pedidos.
      for (let i = llegan.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [llegan[i], llegan[j]] = [llegan[j], llegan[i]]; }
      // Sobrecargado, el servidor gasta su capacidad en pedidos que terminan en timeout: atiende c²/llegadas (colapso por congestión).
      const atiende = llegan.length <= cap ? llegan.length : Math.max(1, Math.round((cap * cap) / llegan.length));
      llegan.forEach((c, k) => {
        if (t >= tVuelve && k < atiende) { exito[c] = t; return; }
        intento[c]++;
        const base = Math.min(32, 2 ** (intento[c] - 1));
        const espera = pol === 'fijo' ? 1 : pol === 'exp' ? base : Math.max(1, Math.round(rnd() * base * 2));
        prox[c] = t + espera;
      });
    }
    const ok = exito.filter((x) => x != null);
    return { carga, intentos: carga.reduce((a, b) => a + b, 0), pico: Math.max(...carga.slice(tVuelve)), terminados: ok.length, ultimo: ok.length ? Math.max(...ok) : null };
  }

  function montarReintentos(cuerpo) {
    const est = { N: 200, cap: 20, vuelve: 10, semilla: 1 };
    let datos, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Clientes que reintentan', min: 20, max: 400, paso: 20, valor: est.N, alCambiar: (v) => { est.N = v; medir(); } });
    ctl.rango({ etiqueta: 'Capacidad del servidor (pedidos/s)', min: 5, max: 60, paso: 5, valor: est.cap, alCambiar: (v) => { est.cap = v; medir(); } });
    ctl.rango({ etiqueta: 'El servidor vuelve en t =', min: 0, max: 30, valor: est.vuelve, alCambiar: (v) => { est.vuelve = v; medir(); } });
    ctl.boton('Otra simulación', () => { est.semilla++; medir(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...POLITICAS.map((p) => ({ color: p.color, texto: p.nombre, forma: 'linea' })), { color: C.apagado, texto: 'capacidad del servidor', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todos los clientes fallan a la vez en t = 0 (el servidor cayó) y reintentan. Si llegan más pedidos que su capacidad c, el servidor se satura y solo completa c²/llegadas por segundo. El backoff duplica la espera en cada fallo, hasta 32 s. Pase el cursor por el gráfico.');

    function medir() {
      datos = POLITICAS.map((p, j) => ({ ...p, ...simularReintentos(p.clave, est.N, est.cap, est.vuelve, VIZ.semilla(est.semilla * 13 + j)) }));
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(est.cap * 1.5, ...datos.flatMap((d) => d.carga)) * 1.08;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 59, ymin: 0, ymax }, { etiquetaX: 'tiempo (s)', etiquetaY: 'pedidos que llegan por segundo' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, est.cap], [59, est.cap]], C.apagado, 1.5, [3, 4]);
      ctx.save(); ctx.fillStyle = VIZ.alfa(C.s8, 0.08); ctx.fillRect(plano.sx(0), plano.y1, plano.sx(est.vuelve) - plano.sx(0), plano.y0 - plano.y1); ctx.restore();
      for (const d of datos) VIZ.trazar(ctx, plano, d.carga.map((v, t) => [t, v]), d.color, 2);
      if (hover != null) {
        ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(plano.sx(hover) + 0.5, plano.y1); ctx.lineTo(plano.sx(hover) + 0.5, plano.y0); ctx.stroke();
        for (const d of datos) VIZ.marcador(ctx, plano.sx(hover), plano.sy(d.carga[hover]), d.color, 4);
      }
      lectura.set(datos.map((d) => [d.nombre, `${VIZ.entero(d.intentos)} intentos · ${d.terminados === est.N ? `todos listos en t = ${d.ultimo}` : `${d.terminados} de ${est.N} listos`}`]));
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(59, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `t = <b>${hover}</b>` + datos.map((d) => VIZ.filaTooltip(d.color, d.nombre, d.carga[hover])).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    medir();
  }

  VIZ.registrarTema('sync-async-communication', {
    intro: String.raw`
      <p>Dos procesos que se comunican pueden hacerlo de forma <strong>síncrona</strong>, como una llamada telefónica (el emisor espera la respuesta, como en
      <a href="tema.html?id=rpc">RPC</a>), o <strong>asíncrona</strong>, como un correo (el emisor deja el mensaje y sigue trabajando). Y el mensaje puede ser
      <strong>transitorio</strong> (se pierde si el receptor no está) o <strong>persistente</strong> (un intermediario lo guarda hasta entregarlo).</p>
      <p>La comunicación síncrona es simple de programar pero acopla a los procesos en el tiempo: el cliente no avanza si el servidor es lento o no está. Las
      colas de mensajes desacoplan, a cambio de que el emisor ya no sabe cuándo, ni si, su mensaje fue procesado. En ambos casos, ante una falla, hay que decidir
      cuánto esperar (<em>timeout</em>) y cómo reintentar.</p>`,
    visualizaciones: [
      {
        titulo: 'Síncrona, asíncrona y con cola',
        descripcion: 'Compare cuánto tarda el cliente en terminar sus 4 trabajos. Active la desconexión del servidor: la llamada síncrona termina en timeout, la asíncrona transitoria pierde mensajes y la cola los entrega después.',
        montar: montarModos,
      },
      {
        titulo: 'Reintentos y backoff',
        descripcion: 'Cuando el servidor vuelve, los reintentos a intervalo fijo llegan todos juntos y lo saturan una y otra vez. El backoff exponencial espacia los intentos; el jitter además los desincroniza.',
        montar: montarReintentos,
      },
    ],
    teoria: String.raw`
      <h2>Formas de comunicación</h2>
      <table>
        <tr><th></th><th>Transitoria</th><th>Persistente</th></tr>
        <tr><td>Síncrona</td><td>RPC, HTTP: el emisor espera la respuesta</td><td>Envío con confirmación de que la cola lo guardó</td></tr>
        <tr><td>Asíncrona</td><td>UDP, <em>sockets</em> sin acuse: enviar y olvidar</td><td>Colas de mensajes (AMQP, Kafka, SQS), correo electrónico</td></tr>
      </table>
      <p>La sincronización puede ocurrir en tres puntos: al entregar el mensaje al middleware, al entregarlo al receptor o al recibir la respuesta. Dentro de una
      máquina, la <strong>comunicación entre procesos</strong> (IPC) usa tuberías, memoria compartida o <em>sockets</em> locales; entre máquinas, mensajes por la red
      que hay que <a href="tema.html?id=rpc">serializar</a> (JSON, Protocol Buffers, XDR).</p>

      <h2>Timeouts</h2>
      <p>Un timeout es la única herramienta del emisor para decidir que algo falló, y siempre es una apuesta: si es corto, declara fallas que no lo son (y reintenta
      operaciones que sí se ejecutaron); si es largo, tarda en reaccionar. Se suele fijar a partir de la distribución de latencias medida (un percentil alto),
      como hacen los <a href="tema.html?id=failure-detectors">detectores de fallas</a>.</p>

      <h2>Reintentos y backoff exponencial</h2>
      <p>Tras el intento fallido \(k\), esperar</p>
      \[ t_k = \min\big(t_{\max},\ t_0 \cdot 2^{k-1}\big), \]
      <p>y con <strong>jitter</strong>, un valor al azar en \([0, t_k]\) o alrededor de él. Si \(N\) clientes fallan a la vez y reintentan a intervalo fijo, siguen llegando
      sincronizados en ráfagas de \(N\) (<em>thundering herd</em>). Un servidor sobrecargado no atiende \(c\) por segundo sino menos, porque gasta su trabajo en pedidos que expiran antes de responder (colapso por congestión), y la ráfaga se perpetúa. Con backoff, el número de intentos por cliente
      crece como \(O(\log)\) del tiempo de caída en vez de linealmente, y el jitter reparte las llegadas en el intervalo: la carga se acerca a \(c\). Es el mismo
      principio del backoff exponencial binario de Ethernet.</p>
      <div class="recuadro"><p>Reintentar solo es seguro si la operación es <strong>idempotente</strong> o el servidor filtra duplicados; si no, un reintento tras una
      respuesta perdida ejecuta dos veces (ver la semántica «a lo más una vez» en <a href="tema.html?id=rpc">RPC</a>).</p></div>`,
  });
})();
