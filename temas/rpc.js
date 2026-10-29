(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  /* ---------- Empaquetado (estilo XDR: enteros de 4 bytes big-endian, cadenas con largo) ---------- */

  const hex = (b) => b.toString(16).padStart(2, '0');
  const int32 = (v, little) => { const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; return little ? b.reverse() : b; };
  const leer32 = (b, little) => { const x = little ? b.slice().reverse() : b; return ((x[0] << 24) | (x[1] << 16) | (x[2] << 8) | x[3]) >>> 0; };

  const LLAMADAS = {
    suma: {
      texto: 'suma(3, 7)', proc: 1, args: [['int', 3], ['int', 7]],
      ejecutar: (a) => a[0] + a[1], firma: 'int suma(int a, int b)',
    },
    largo: {
      texto: 'largo("hola")', proc: 2, args: [['str', 'hola']],
      ejecutar: (a) => a[0].length, firma: 'int largo(string s)',
    },
    maximo: {
      texto: 'máximo([5, 2, 9])', proc: 3, args: [['arr', [5, 2, 9]]],
      ejecutar: (a) => Math.max(...a[0]), firma: 'int máximo(int[] v)',
    },
  };

  // Campos del mensaje: [{ nombre, bytes, tipo: 'cab' | 'arg' | 'res' }]
  function empaquetar(ll, xid, little) {
    const campos = [
      { nombre: 'xid', bytes: int32(xid, false), tipo: 'cab' },
      { nombre: 'proc', bytes: int32(ll.proc, false), tipo: 'cab' },
    ];
    for (const [t, v] of ll.args) {
      if (t === 'int') campos.push({ nombre: 'int', bytes: int32(v, little), tipo: 'arg' });
      else if (t === 'str') {
        campos.push({ nombre: 'largo', bytes: int32(v.length, little), tipo: 'arg' });
        const b = [...v].map((c) => c.charCodeAt(0));
        while (b.length % 4) b.push(0);
        campos.push({ nombre: `"${v}"`, bytes: b, tipo: 'arg' });
      } else {
        campos.push({ nombre: 'n', bytes: int32(v.length, little), tipo: 'arg' });
        v.forEach((x) => campos.push({ nombre: 'int', bytes: int32(x, little), tipo: 'arg' }));
      }
    }
    return campos;
  }
  // El servidor (big-endian) lee los argumentos.
  function desempaquetar(ll, campos) {
    const args = campos.filter((c) => c.tipo === 'arg');
    let k = 0;
    return ll.args.map(([t]) => {
      if (t === 'int') return leer32(args[k++].bytes, false);
      if (t === 'str') { const n = leer32(args[k++].bytes, false); const s = String.fromCharCode(...args[k++].bytes.slice(0, Math.min(n, 4096))); return s.slice(0, n); }
      const n = leer32(args[k++].bytes, false);
      const v = [];
      for (let i = 0; i < Math.min(n, 64); i++) v.push(leer32(args[k++].bytes, false));
      return n > 64 ? v.concat(['…']) : v;
    });
  }

  /* ---------- Fig. 1: anatomía de una llamada ---------- */

  const CARRILES = ['Cliente', 'Stub cliente', 'Red', 'Stub servidor', 'Servidor'];

  function montarAnatomia(cuerpo) {
    const est = { llamada: 'suma', sinCanonico: false };
    let pasos = [], k = -1, xid = 41;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Llamada', valor: est.llamada, opciones: Object.entries(LLAMADAS).map(([k2, l]) => [k2, l.texto]),
      alCambiar: (v) => { est.llamada = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Cliente little-endian sin formato canónico', valor: est.sinCanonico, alCambiar: (v) => { est.sinCanonico = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 470 : 440) });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'paso actual', forma: 'linea' },
      { color: C.tinta2, texto: 'paso ya realizado', forma: 'linea' },
      { color: C.s1, texto: 'bytes de argumentos', forma: 'cuadro' },
      { color: C.s6, texto: 'bytes del resultado', forma: 'cuadro' },
    ]);
    const tira = VIZ.grafo.estructura(cuerpo, 'Mensaje:');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El tiempo avanza hacia abajo. Active la casilla para ver qué pasa si el cliente envía sus enteros en su propio orden de bytes.');

    function iniciar() {
      const ll = LLAMADAS[est.llamada];
      xid++;
      const pedido = empaquetar(ll, xid, est.sinCanonico);
      const recibidos = desempaquetar(ll, pedido);
      const res = ll.ejecutar(recibidos);
      const resCampos = [{ nombre: 'xid', bytes: int32(xid, false), tipo: 'cab' }, { nombre: 'int', bytes: int32(res >>> 0, false), tipo: 'res' }];
      const fmtArgs = (a) => a.map((v) => (typeof v === 'string' ? `"${v}"` : Array.isArray(v) ? `[${v.join(', ')}]` : v)).join(', ');
      const nombre = ll.texto.split('(')[0];
      const malo = est.sinCanonico && ll.args.some(([t]) => t !== 'str') ? ' ¡Los bytes están invertidos: el servidor lee otros números!' : '';
      pasos = [
        { de: 0, a: 1, et: ll.texto, txt: `El cliente llama a ${ll.texto} como si fuera un procedimiento local; en realidad llama al stub del cliente, que tiene la misma firma: ${ll.firma}.` },
        { de: 1, a: 1, et: 'empaquetar', msj: pedido, txt: `El stub del cliente empaqueta (marshalling): identificador de transacción xid = ${xid}, número de procedimiento ${ll.proc} y los argumentos en ${est.sinCanonico ? 'el orden de bytes de su CPU (little-endian)' : 'formato canónico big-endian'}.` },
        { de: 1, a: 2, et: 'send()', msj: pedido, txt: 'El stub entrega el mensaje al sistema operativo, que lo envía por la red. El cliente queda bloqueado esperando.' },
        { de: 2, a: 3, et: 'recv()', msj: pedido, txt: 'El mensaje llega a la máquina del servidor y el sistema operativo se lo entrega al stub del servidor (el despachador elige el stub según proc).' },
        { de: 3, a: 3, et: 'desempaquetar', msj: pedido, txt: `El stub del servidor desempaqueta los argumentos: ${fmtArgs(recibidos)}.${malo}` },
        { de: 3, a: 4, et: `${nombre}(${fmtArgs(recibidos)})`, txt: `Llama al procedimiento real del servidor con argumentos ya convertidos a su representación local.` },
        { de: 4, a: 3, et: `return ${res}`, txt: `El servidor ejecuta y devuelve ${res} a su stub, como cualquier procedimiento local.` },
        { de: 3, a: 3, et: 'empaquetar', msj: resCampos, txt: 'El stub del servidor empaqueta el resultado con el mismo xid, para que el cliente pueda emparejar respuesta y pedido.' },
        { de: 3, a: 2, et: 'send()', msj: resCampos, txt: 'La respuesta viaja por la red.' },
        { de: 2, a: 1, et: 'recv()', msj: resCampos, txt: 'El stub del cliente recibe la respuesta y verifica que el xid coincida.' },
        { de: 1, a: 0, et: `return ${res}`, txt: `El stub desempaqueta y devuelve ${res}: el cliente continúa como si la llamada hubiera sido local.${malo ? ' Pero el resultado es incorrecto.' : ''}` },
      ];
      k = -1;
      return (function* () { for (k = 0; k < pasos.length; k++) yield; k = pasos.length - 1; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const sup = 36, inf = 12, izq = 8, der = 8;
      const xs = CARRILES.map((_, i) => izq + ((i + 0.5) * (W - izq - der)) / CARRILES.length);
      const dy = (H - sup - inf) / (pasos.length + 0.5);
      // Zonas de las dos máquinas.
      ctx.fillStyle = C.fondo2;
      const ancho = (W - izq - der) / CARRILES.length;
      ctx.fillRect(izq + 2, 0, ancho * 2 - 4, H);
      ctx.fillRect(izq + ancho * 3 + 2, 0, ancho * 2 - 4, H);
      ctx.font = VIZ.fuente(W < 600 ? 10 : 12, 600);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      CARRILES.forEach((c, i) => {
        ctx.fillStyle = C.tinta;
        const partes = W < 600 && c.includes(' ') ? c.split(' ') : [c];
        partes.forEach((t, j) => ctx.fillText(t, xs[i], 14 + j * 12 - (partes.length - 1) * 4));
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash(i === 2 ? [3, 4] : []);
        ctx.beginPath(); ctx.moveTo(xs[i], sup); ctx.lineTo(xs[i], H - inf); ctx.stroke();
      });
      ctx.setLineDash([]);
      pasos.forEach((p, i) => {
        const y = sup + (i + 0.75) * dy;
        const col = i === k ? C.s2 : i < k ? C.tinta2 : C.tenue;
        const anch = i === k ? 2.5 : 1.5;
        let xe;
        if (p.de === p.a) {
          // Trabajo local: un rectángulo de actividad.
          ctx.fillStyle = i <= k ? VIZ.alfa(col, 0.18) : C.superficie;
          ctx.strokeStyle = col; ctx.lineWidth = anch;
          ctx.beginPath(); ctx.rect(xs[p.de] - 6, y - dy * 0.35, 12, dy * 0.7); ctx.fill(); ctx.stroke();
          xe = xs[p.de] + 10;
        } else {
          D.flecha(ctx, xs[p.de] + (p.a > p.de ? 7 : -7), y, xs[p.a] + (p.a > p.de ? -7 : 7), y, { color: col, ancho: anch });
          xe = (xs[p.de] + xs[p.a]) / 2;
        }
        if (i <= k + 1) {
          const al = p.de === p.a ? 'left' : 'center';
          const yy = p.de === p.a ? y : y - 9;
          ctx.font = VIZ.fuente(W < 600 ? 9.5 : 11, i === k ? 600 : 400);
          let txt = p.et;
          const max = p.de === p.a ? W - xe - 4 : Math.abs(xs[p.a] - xs[p.de]) - 4;
          while (txt.length > 4 && ctx.measureText(txt).width > max) txt = txt.slice(0, -2) + '…';
          ctx.fillStyle = C.superficie;
          const tw = ctx.measureText(txt).width;
          ctx.fillRect(al === 'left' ? xe - 1 : xe - tw / 2 - 2, yy - 7, tw + 4, 14);
          ctx.fillStyle = i === k ? C.s2 : i < k ? C.tinta : C.apagado;
          ctx.textAlign = al;
          ctx.fillText(txt, xe, yy);
        }
      });
      const p = pasos[k];
      const msj = p && p.msj;
      const COL = { cab: C.tinta2, arg: C.s1, res: C.s6 };
      tira.set(msj ? msj.map((c) => ({ texto: `${c.nombre} ${c.bytes.map(hex).join('')}`, color: COL[c.tipo], tinta: c.tipo === 'cab' ? C.tinta2 : COL[c.tipo] })) : [],
        k < 0 ? 'aún no hay mensaje' : 'sin mensaje en este paso');
      registro.textContent = p ? p.txt : 'Pulse «Un paso» para seguir la llamada.';
      const bytes = msj ? msj.reduce((s, c) => s + c.bytes.length, 0) : 0;
      lectura.set([
        ['paso', `${Math.max(0, k + 1)} de ${pasos.length}`],
        ['bytes del mensaje', msj ? String(bytes) : '—'],
        ['mensajes por la red', String(pasos.slice(0, k + 1).filter((q) => q.de === 2 || q.a === 2).length / 2 | 0)],
      ]);
    }
    lienzo.alDibujar = () => pasos.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: semánticas ante fallas ---------- */

  const SEMANTICAS = {
    quizas: 'Quizás (sin reintentos)',
    almenos: 'Al menos una vez (reintentar)',
    alomas: 'A lo más una vez (reintentar + filtrar duplicados)',
  };

  // Una llamada «retirar 10» con pérdidas de mensajes. Devuelve la línea de tiempo y el resultado.
  function simularLlamada(sem, pPerdida, rnd, maxIntentos = 5) {
    const T = 4, viaje = 1.4, mensajes = [], eventos = [];
    let t = 0.5, ejecuciones = 0, exito = false, intentos = 0, saldo = 100;
    const vistos = new Map();
    while (intentos < (sem === 'quizas' ? 1 : maxIntentos) && !exito) {
      intentos++;
      const perdidoPed = rnd() < pPerdida;
      eventos.push({ p: 0, t, tipo: 'envio', intento: intentos });
      mensajes.push({ p0: 0, t0: t, p1: 1, t1: t + viaje, perdido: perdidoPed, tipo: 'ped', intento: intentos });
      if (!perdidoPed) {
        const ts = t + viaje;
        let dup = false;
        if (sem === 'alomas' && vistos.has(1)) dup = true;
        else { ejecuciones++; saldo -= 10; vistos.set(1, saldo); }
        eventos.push({ p: 1, t: ts, tipo: dup ? 'duplicado' : 'ejecuta' });
        const perdidoRes = rnd() < pPerdida;
        mensajes.push({ p0: 1, t0: ts + 0.25, p1: 0, t1: ts + 0.25 + viaje, perdido: perdidoRes, tipo: 'res' });
        if (!perdidoRes) { exito = true; eventos.push({ p: 0, t: ts + 0.25 + viaje, tipo: 'ok' }); break; }
      }
      t += T;
      if (sem !== 'quizas' && intentos < maxIntentos) eventos.push({ p: 0, t: t - 0.05, tipo: 'timeout' });
    }
    if (!exito) eventos.push({ p: 0, t: t - 0.05, tipo: 'error' });
    const tMax = Math.max(t, ...mensajes.map((m) => m.t1), ...eventos.map((e) => e.t)) + 0.6;
    return { mensajes, eventos, ejecuciones, exito, intentos, saldo, tMax };
  }

  function montarFallas(cuerpo) {
    const est = { sem: 'almenos', p: 0.35, semilla: 3 };
    let sim, stats, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Semántica', valor: est.sem, opciones: Object.entries(SEMANTICAS), alCambiar: (v) => { est.sem = v; nuevo(); } });
    ctl.rango({ etiqueta: 'Probabilidad de perder un mensaje', min: 0, max: 0.7, paso: 0.05, valor: est.p, formato: (v) => `${Math.round(v * 100)} %`,
      alCambiar: (v) => { est.p = v; nuevo(); } });
    ctl.boton('Nueva llamada', () => { est.semilla++; nuevo(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 200 : 190) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'pedido «retirar 10»', forma: 'linea' },
      { color: C.s6, texto: 'respuesta', forma: 'linea' },
      { color: C.s8, texto: 'mensaje perdido', forma: 'linea' },
      { color: C.s2, texto: 'ejecución en el servidor', forma: 'punto' },
      { color: C.s4, texto: 'timeout / duplicado filtrado', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.subtitulo(cuerpo, 'En 2 000 llamadas con esta semántica y esta probabilidad de pérdida:');
    const lectura2 = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La cuenta empieza con saldo 100 y cada ejecución descuenta 10. El cliente reintenta a lo más 5 veces.');

    function nuevo() {
      sim = simularLlamada(est.sem, est.p, VIZ.semilla(est.semilla * 7 + 1));
      const rnd = VIZ.semilla(99);
      stats = { 0: 0, 1: 0, mas: 0, fallo: 0, falloEjecutado: 0 };
      for (let i = 0; i < 2000; i++) {
        const s = simularLlamada(est.sem, est.p, rnd);
        if (s.ejecuciones === 0) stats[0]++; else if (s.ejecuciones === 1) stats[1]++; else stats.mas++;
        if (!s.exito) { stats.fallo++; if (s.ejecuciones > 0) stats.falloEjecutado++; }
      }
      dibujar();
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tMax = Math.max(sim.tMax, 9);
      const COL = { envio: C.s1, ejecuta: C.s2, duplicado: C.s4, ok: C.s6, timeout: C.s4, error: C.s8 };
      const TXT = { envio: '', ejecuta: 'ejecuta', duplicado: 'duplicado', ok: 'ok', timeout: 'timeout', error: 'error' };
      geo = D.espacioTiempo(lienzo, {
        procesos: ['C', 'S'], t: [0, tMax], margenIzq: 24, sup: 44, inf: 40,
        mensajes: sim.mensajes.map((m) => ({
          ...m, color: m.perdido ? C.s8 : m.tipo === 'ped' ? C.s1 : C.s6, hasta: m.perdido ? m.t0 + (m.t1 - m.t0) * 0.55 : null,
          guiones: m.perdido ? [4, 3] : null, texto: m.tipo === 'ped' ? `#${m.intento}` : null,
        })),
        eventos: sim.eventos.map((e) => ({ p: e.p, t: e.t, relleno: COL[e.tipo], texto: TXT[e.tipo] || null, colorTexto: COL[e.tipo], abajo: e.p === 1, forma: e.tipo === 'timeout' ? 3 : 0 })),
      });
      // Cruces sobre los mensajes perdidos.
      for (const m of sim.mensajes) if (m.perdido) {
        const f = 0.55, x = geo.x(m.t0 + (m.t1 - m.t0) * f), y = geo.y(m.p0) + (geo.y(m.p1) - geo.y(m.p0)) * f;
        ctx.strokeStyle = C.s8; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
      }
      const ej = sim.ejecuciones;
      registro.textContent = sim.exito
        ? `El cliente recibe respuesta tras ${sim.intentos} intento${sim.intentos > 1 ? 's' : ''}. El servidor ejecutó ${ej} ${ej === 1 ? 'vez' : 'veces'}: ${ej > 1 ? `se retiraron ${10 * ej} en lugar de 10.` : 'correcto.'}`
        : `El cliente se rinde tras ${sim.intentos} intento${sim.intentos > 1 ? 's' : ''} y reporta un error, ${ej ? `pero el servidor sí ejecutó ${ej} ${ej === 1 ? 'vez' : 'veces'}: el cliente no puede saberlo.` : 'y en efecto nada se ejecutó.'}`;
      lectura.set([
        ['intentos', String(sim.intentos)],
        ['ejecuciones', String(ej)],
        ['saldo final', String(sim.saldo)],
        ['el cliente ve', sim.exito ? 'éxito' : 'error'],
      ]);
      const pct = (v) => `${(v / 20).toFixed(1)} %`;
      lectura2.set([
        ['0 ejecuciones', pct(stats[0])],
        ['exactamente 1', pct(stats[1])],
        ['2 o más', pct(stats.mas)],
        ['error visto por el cliente', pct(stats.fallo)],
        ['error pero ejecutada', pct(stats.falloEjecutado)],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    nuevo();
  }

  VIZ.registrarTema('rpc', {
    intro: String.raw`
      <p>Una <strong>llamada a procedimiento remoto</strong> (RPC, Birrell y Nelson 1984) permite invocar una función que se ejecuta en
      otra máquina con la misma sintaxis que una llamada local. La ilusión la sostienen dos piezas generadas automáticamente a partir de
      la interfaz: el <strong>stub del cliente</strong>, que empaqueta los argumentos en un mensaje y espera la respuesta, y el
      <strong>stub del servidor</strong>, que desempaqueta, llama a la función real y devuelve el resultado por el mismo camino.</p>
      <p>La ilusión es imperfecta: no hay memoria compartida (no se pueden pasar punteros, solo copias), las máquinas pueden representar
      los datos de forma distinta, y sobre todo la red y el servidor pueden fallar. Ante un timeout, el cliente no sabe si el servidor
      alcanzó a ejecutar la llamada.</p>`,
    visualizaciones: [
      {
        titulo: 'Anatomía de una llamada',
        descripcion: 'Siga los once pasos de una llamada y observe los bytes del mensaje bajo el diagrama. Pruebe la casilla con <code>suma(3, 7)</code>: sin formato canónico, el servidor suma números enormes.',
        montar: montarAnatomia,
      },
      {
        titulo: 'Pérdidas, reintentos y duplicados',
        descripcion: 'Una operación que no es idempotente («retirar 10»). Con reintentos, una respuesta perdida provoca ejecuciones repetidas; filtrando duplicados por xid nunca hay más de una.',
        montar: montarFallas,
      },
    ],
    teoria: String.raw`
      <h2>Pasos de una llamada</h2>
      <ol>
        <li>El cliente llama al stub local con los argumentos.</li>
        <li>El stub los <strong>empaqueta</strong> (<em>marshalling</em>) junto con el identificador del procedimiento y un identificador de transacción.</li>
        <li>El sistema operativo envía el mensaje; el servidor lo recibe y lo entrega al stub correspondiente.</li>
        <li>El stub del servidor <strong>desempaqueta</strong> y llama al procedimiento; el resultado vuelve por el camino inverso.</li>
      </ol>
      <p>Los stubs se generan con un compilador a partir de una descripción de la interfaz (IDL): XDR/rpcgen en Sun RPC, Protocol Buffers en
      gRPC, Thrift, Java RMI. El enlazado (<em>binding</em>) se resuelve con un servicio de nombres o un <em>portmapper</em>.</p>

      <h2>Representación de datos</h2>
      <p>Un entero de 32 bits se guarda en un orden de bytes que depende de la CPU: \(3\) es <code>00 00 00 03</code> en big-endian y
      <code>03 00 00 00</code> en little-endian. Si el servidor interpreta mal el orden, lee \(3 \cdot 2^{24} = 50\,331\,648\). Por eso se usa un
      <strong>formato canónico</strong> (XDR: big-endian, todo alineado a 4 bytes) o un mensaje autodescrito que indica el orden. Las cadenas y
      arreglos van precedidos de su largo, y las estructuras con punteros se aplanan: llamada por <em>copia/restauración</em> en lugar de por referencia.</p>

      <h2>Semánticas ante fallas</h2>
      <p>Cinco cosas pueden fallar: no encontrar el servidor, perder el pedido, que el servidor caiga, perder la respuesta y que el cliente caiga.
      Lo esencial es que el cliente no distingue un pedido perdido de una respuesta perdida ni de un servidor caído.</p>
      <table>
        <tr><th>Semántica</th><th>Mecanismo</th><th>Ejecuciones</th><th>Adecuada para</th></tr>
        <tr><td>Quizás</td><td>Sin reintentos</td><td>0 o 1</td><td>Avisos sin importancia</td></tr>
        <tr><td>Al menos una vez</td><td>Reintentar hasta tener respuesta</td><td>\(\ge 1\) (si hay respuesta)</td><td>Operaciones idempotentes</td></tr>
        <tr><td>A lo más una vez</td><td>Reintentar; el servidor recuerda los xid y reenvía la respuesta guardada</td><td>0 o 1</td><td>Cualquier operación</td></tr>
        <tr><td>Exactamente una vez</td><td>Imposible en general si el servidor puede caer</td><td>1</td><td>—</td></tr>
      </table>
      <p>Una operación es <strong>idempotente</strong> si repetirla no cambia el resultado: «fijar saldo en 90» lo es, «retirar 10» no.
      Diseñar interfaces idempotentes (o con identificadores de operación) es la forma práctica de acercarse a «exactamente una vez».</p>

      <h2>Probabilidades</h2>
      <p>Si cada mensaje se pierde de forma independiente con probabilidad \(p\), un intento tiene éxito con probabilidad \((1-p)^2\). Con
      reintentos ilimitados, el número de intentos es geométrico con media \(1/(1-p)^2\). Con «al menos una vez», cada intento en que el
      pedido llega pero la respuesta se pierde ejecuta la operación de más: con \(p = 0.35\), alrededor de un tercio de las llamadas exitosas
      ejecutan dos o más veces.</p>`,
  });
})();
