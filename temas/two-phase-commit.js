(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  const ESCENARIOS = {
    ok: 'Todos votan sí',
    no: 'Un participante vota no',
    caePart: 'Un participante cae antes de votar',
    caeCoord: 'El coordinador cae antes de decidir',
    caeParcial: 'El coordinador cae a mitad del envío',
  };
  const MSJ = {
    PREPARE: { color: C.s1, texto: 'PREPARE' },
    SI: { color: C.s3, texto: 'sí' },
    NO: { color: C.s8, texto: 'no' },
    COMMIT: { color: C.s6, texto: 'COMMIT' },
    ABORT: { color: C.s8, texto: 'ABORT' },
    ACK: { color: C.apagado, texto: 'ack' },
    PREG: { color: C.s7, texto: '¿decisión?' },
    RESP: { color: C.s7, texto: '' },
  };
  const ESTADO_COLOR = { INIT: C.inactivo, WAIT: C.s4, READY: C.s4, COMMIT: C.s6, ABORT: C.s8, CAÍDO: C.inactivo };

  /* Proceso 0 = coordinador, 1..n = participantes. Devuelve eventos con su texto, mensajes y bloqueos. */
  function simular(n, esc, coop) {
    const ev = [], msgs = [], bloqueos = [];
    const N = (i) => `P${i}`;
    const evento = (p, t, nuevo, texto) => { ev.push({ p, t, estado: nuevo, texto }); };
    const enviar = (p0, t0, p1, t1, tipo, perdido = false) => msgs.push({ p0, t0, p1, t1, tipo, perdido });
    evento(0, 0.5, 'WAIT', `El coordinador escribe «inicio» en su bitácora y envía PREPARE a los ${n} participantes. Pasa a WAIT.`);
    const caidoPart = esc === 'caePart' ? n : -1;
    const votos = [];
    for (let i = 1; i <= n; i++) {
      const llega = 1.7 + 0.25 * i;
      if (i === caidoPart) {
        evento(i, 1.2, 'CAÍDO', `${N(i)} cae antes de recibir PREPARE: nunca votará.`);
        enviar(0, 0.5, i, llega, 'PREPARE', true);
        continue;
      }
      enviar(0, 0.5, i, llega, 'PREPARE');
      const si = !(esc === 'no' && i === 2);
      const tv = llega + 0.35;
      evento(i, tv, si ? 'READY' : 'ABORT', si
        ? `${N(i)} recibe PREPARE, deja todo listo en disco (bitácora «preparado») y vota sí. Pasa a READY: ya no puede abortar por su cuenta.`
        : `${N(i)} recibe PREPARE y vota no (por ejemplo, violó una restricción). Puede abortar de inmediato.`);
      const tl = tv + 1.3 + 0.2 * i;
      enviar(i, tv, 0, tl, si ? 'SI' : 'NO');
      votos.push({ i, si, tl });
    }
    const todos = votos.length === n;
    const td = todos ? Math.max(...votos.map((v) => v.tl)) + 0.3 : 7.2;
    const decision = todos && votos.every((v) => v.si) ? 'COMMIT' : 'ABORT';
    if (esc === 'caeCoord') {
      evento(0, td, 'CAÍDO', 'El coordinador recibió todos los votos, pero cae antes de escribir y enviar la decisión.');
    } else {
      const motivo = !todos ? 'Se cumple el plazo y falta un voto: el coordinador decide ABORT.' : decision === 'COMMIT' ? 'Llegaron todos los votos y todos son sí: el coordinador escribe COMMIT en su bitácora (punto de no retorno).' : 'Llegó un voto no: el coordinador decide ABORT.';
      const hasta = esc === 'caeParcial' ? 1 : n;
      evento(0, td, decision, motivo + (esc === 'caeParcial' ? ' Alcanza a enviarlo solo a P1 y cae.' : ` Envía GLOBAL-${decision} a todos.`));
      for (let i = 1; i <= hasta; i++) {
        const tl = td + 1.2 + 0.2 * i;
        if (i === caidoPart) { enviar(0, td, i, tl, decision, true); continue; }
        enviar(0, td, i, tl, decision);
        evento(i, tl, decision, `${N(i)} recibe GLOBAL-${decision}, lo aplica y libera sus locks.`);
        if (esc !== 'caeParcial') enviar(i, tl + 0.2, 0, tl + 1.3, 'ACK');
      }
      if (esc === 'caeParcial') evento(0, td + 0.15, 'CAÍDO', 'El coordinador cae tras enviar la decisión a P1.');
    }
    // Participantes en READY sin decisión: bloqueados.
    const tFin = 13;
    const conDecision = new Set(ev.filter((e) => e.p > 0 && (e.estado === 'COMMIT' || e.estado === 'ABORT')).map((e) => e.p));
    const listos = votos.filter((v) => v.si && !conDecision.has(v.i));
    for (const v of listos) {
      const tb = 8.6 + 0.2 * v.i;
      evento(v.i, tb, 'READY', `${N(v.i)} lleva demasiado tiempo en READY sin decisión. No puede decidir solo: otro pudo haber visto COMMIT o ABORT.`);
      let resuelto = null;
      if (coop) {
        for (let j = 1; j <= n; j++) {
          if (j === v.i || j === caidoPart) continue;
          const tl = tb + 1 + 0.1 * j;
          enviar(v.i, tb, j, tl, 'PREG');
          if (conDecision.has(j) && !resuelto) {
            enviar(j, tl + 0.15, v.i, tl + 1.1, 'RESP');
            resuelto = { t: tl + 1.1, de: j };
          }
        }
      }
      if (resuelto) {
        evento(v.i, resuelto.t, decision, `${N(resuelto.de)} ya conocía la decisión y se la comunica a ${N(v.i)}: ${decision}.`);
        bloqueos.push({ p: v.i, t0: tb, t1: resuelto.t });
      } else {
        bloqueos.push({ p: v.i, t0: tb, t1: tFin });
        if (coop) evento(v.i, tb + 1.8, 'READY', `Nadie vivo conoce la decisión: ${N(v.i)} sigue bloqueado, con los locks tomados, hasta que vuelva el coordinador.`);
      }
    }
    ev.sort((a, b) => a.t - b.t);
    return { ev, msgs, bloqueos, decision: esc === 'caeCoord' ? null : decision, tFin };
  }

  function montar(cuerpo) {
    const est = { n: 3, esc: 'ok', coop: false };
    let sim, k = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', valor: est.esc, opciones: Object.entries(ESCENARIOS), alCambiar: (v) => { est.esc = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Participantes', min: 2, max: 5, valor: est.n, alCambiar: (v) => { est.n = v; lienzo.ajustar(true); rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Preguntar a otros participantes', valor: est.coop, alCambiar: (v) => { est.coop = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (est.n + 1) * (w < 600 ? 52 : 58) + 40 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'PREPARE', forma: 'linea' },
      { color: C.s3, texto: 'voto sí', forma: 'linea' },
      { color: C.s6, texto: 'COMMIT', forma: 'linea' },
      { color: C.s8, texto: 'voto no / ABORT', forma: 'linea' },
      { color: C.s7, texto: 'consulta entre participantes', forma: 'linea' },
      { color: C.s4, texto: 'esperando / bloqueado', forma: 'linea' },
    ]);
    VIZ.subtitulo(cuerpo, 'Máquinas de estado (el número indica qué participantes están en cada estado):');
    const lienzo2 = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 360 : 190) });
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance evento por evento. Los procesos caídos tienen la línea discontinua desde que caen.');

    function iniciar() {
      sim = simular(est.n, est.esc, est.coop);
      k = -1;
      return (function* () { for (k = 0; k < sim.ev.length; k++) yield; k = sim.ev.length; })();
    }

    function estados(t) {
      const e = new Array(est.n + 1).fill('INIT');
      for (const x of sim.ev) if (x.t <= t + 1e-9) e[x.p] = x.estado;
      return e;
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ahora = k < 0 ? 0 : k >= sim.ev.length ? sim.tFin : sim.ev[k].t;
      const geo = D.espacioTiempo(lienzo, {
        procesos: ['Coord.', ...Array.from({ length: est.n }, (_, i) => `P${i + 1}`)], t: [0, sim.tFin], margenIzq: 52, sup: 26, inf: 22,
        ahora: k >= 0 && k < sim.ev.length ? ahora : null,
        mensajes: sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).map((m) => {
          const fin = m.perdido ? m.t0 + (m.t1 - m.t0) * 0.6 : m.t1;
          return { p0: m.p0, t0: m.t0, p1: m.p1, t1: fin, color: MSJ[m.tipo].color, ancho: 1.6, hasta: ahora < fin ? ahora : null, guiones: m.perdido ? [3, 3] : null };
        }),
        eventos: sim.ev.filter((e, i) => i <= k).map((e) => ({
          p: e.p, t: e.t, relleno: ESTADO_COLOR[e.estado], texto: e.estado, colorTexto: e.estado === 'CAÍDO' ? C.s8 : C.tinta2, tam: 10, anillo: sim.ev[k] === e ? C.s2 : null,
        })),
      });
      // Tramos: bloqueos y procesos caídos.
      ctx.save();
      ctx.lineCap = 'round';
      for (const b of sim.bloqueos) {
        if (b.t0 > ahora) continue;
        ctx.strokeStyle = VIZ.alfa(C.s4, 0.75); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(geo.x(b.t0), geo.y(b.p)); ctx.lineTo(geo.x(Math.min(b.t1, ahora)), geo.y(b.p)); ctx.stroke();
      }
      for (const e of sim.ev) {
        if (e.estado !== 'CAÍDO' || e.t > ahora) continue;
        ctx.strokeStyle = C.superficie; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(geo.x(e.t) + 8, geo.y(e.p)); ctx.lineTo(geo.x(sim.tFin), geo.y(e.p)); ctx.stroke();
        ctx.strokeStyle = C.inactivo; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(geo.x(e.t) + 8, geo.y(e.p)); ctx.lineTo(geo.x(sim.tFin), geo.y(e.p)); ctx.stroke(); ctx.setLineDash([]);
      }
      // Cruces en los mensajes perdidos.
      for (const m of sim.msgs) if (m.perdido && m.t0 + (m.t1 - m.t0) * 0.6 <= ahora) {
        const f = 0.6, x = geo.x(m.t0 + (m.t1 - m.t0) * f), y = geo.y(m.p0) + (geo.y(m.p1) - geo.y(m.p0)) * f;
        ctx.strokeStyle = C.s8; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
      }
      ctx.restore();
      dibujarMaquinas(estados(ahora));
      registro.textContent = k < 0 ? 'Una transacción tocó datos en varios servidores; el coordinador debe lograr que todos hagan commit o todos aborten.'
        : k >= sim.ev.length ? fin() : sim.ev[k].texto;
      const e = estados(ahora);
      const enviados = sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).length;
      lectura.set([
        ['decisión', e[0] === 'COMMIT' || e[0] === 'ABORT' ? e[0] : e.slice(1).find((x) => x === 'COMMIT') || (e[0] === 'CAÍDO' && !sim.decision ? 'desconocida' : '—')],
        ['mensajes', String(enviados)],
        ['bloqueados', String(sim.bloqueos.filter((b) => b.t0 <= ahora && b.t1 > ahora).length)],
        ['coordinador', e[0]],
      ]);
    }
    function fin() {
      const bl = sim.bloqueos.filter((b) => b.t1 >= sim.tFin);
      if (bl.length) return `${bl.map((b) => `P${b.p}`).join(', ')} ${bl.length > 1 ? 'quedan bloqueados' : 'queda bloqueado'} en READY: no puede${bl.length > 1 ? 'n' : ''} hacer commit ni abortar hasta que el coordinador se recupere y lea su bitácora.`;
      return `Fin: todos los participantes vivos terminaron en ${sim.decision}. Atomicidad: nadie hizo commit mientras otro abortaba.`;
    }

    function dibujarMaquinas(e) {
      const { ctx, ancho: W, alto: H } = lienzo2;
      lienzo2.limpiar();
      const angosto = W < 600;
      const MAQ = [
        { titulo: 'Coordinador', estados: ['INIT', 'WAIT', 'ABORT', 'COMMIT'], trans: [[0, 1, 'PREPARE'], [1, 2, 'algún no / timeout'], [1, 3, 'todos sí']] },
        { titulo: 'Participante', estados: ['INIT', 'READY', 'ABORT', 'COMMIT'], trans: [[0, 1, 'vota sí'], [0, 2, 'vota no'], [1, 2, 'ABORT'], [1, 3, 'COMMIT']] },
      ];
      MAQ.forEach((m, j) => {
        const ox = angosto ? 0 : (j * W) / 2, oy = angosto ? j * (H / 2) : 0, w = angosto ? W : W / 2, h = angosto ? H / 2 : H;
        const pos = [[0.13, 0.5], [0.45, 0.5], [0.83, 0.24], [0.83, 0.78]].map(([fx, fy]) => ({ x: ox + fx * w, y: oy + 22 + fy * (h - 34) }));
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(m.titulo, ox + 6, oy + 12);
        for (const [a, b, t] of m.trans) {
          const pa = pos[a], pb = pos[b];
          const dx = pb.x - pa.x, dy = pb.y - pa.y, L = Math.hypot(dx, dy);
          const curva = a === 0 && b === 2 ? 26 : 0;
          const medio = D.flecha(ctx, pa.x + (dx / L) * 34, pa.y + (dy / L) * 15, pb.x - (dx / L) * 36, pb.y - (dy / L) * 15, { color: C.eje, ancho: 1.5, curva });
          D.etiqueta(ctx, t, medio.x, medio.y - (angosto && Math.abs(dy) < 1 ? 11 : 0), { color: C.tinta2, tam: angosto ? 9 : 10, peso: 400 });
        }
        m.estados.forEach((s, i) => {
          const p = pos[i];
          const quienes = j === 0 ? (e[0] === s ? ['●'] : []) : e.slice(1).map((x, q) => (x === s ? String(q + 1) : null)).filter(Boolean);
          const activo = quienes.length > 0;
          ctx.fillStyle = activo ? VIZ.alfa(ESTADO_COLOR[s], 0.25) : C.superficie;
          ctx.strokeStyle = activo ? ESTADO_COLOR[s] : C.tinta; ctx.lineWidth = activo ? 2.5 : 1.5;
          ctx.beginPath(); ctx.roundRect(p.x - 33, p.y - 14, 66, 28, 6); ctx.fill(); ctx.stroke();
          ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center';
          ctx.fillText(s, p.x, p.y + 0.5);
          if (j === 1 && activo) D.etiqueta(ctx, quienes.map((q) => `P${q}`).join(' '), p.x, p.y + 24, { color: C.tinta, tam: 10 });
        });
        if (j === 0 && e[0] === 'CAÍDO') D.etiqueta(ctx, 'caído', ox + w - 40, oy + 12, { color: C.s8, borde: C.s8, tam: 10 });
        const caidos = j === 1 ? e.slice(1).map((x, q) => (x === 'CAÍDO' ? `P${q + 1}` : null)).filter(Boolean) : [];
        if (caidos.length) D.etiqueta(ctx, `${caidos.join(' ')} caído`, ox + w - 50, oy + 12, { color: C.s8, borde: C.s8, tam: 10 });
      });
    }
    lienzo.alDibujar = () => sim && dibujar();
    lienzo2.alDibujar = () => sim && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('two-phase-commit', {
    intro: String.raw`
      <p>Una transacción distribuida modifica datos en varios servidores, y debe ser <strong>atómica</strong>: o todos hacen
      <em>commit</em> o todos abortan. Cada servidor puede tener motivos locales para negarse (un conflicto, falta de espacio, una caída),
      así que nadie puede decidir solo.</p>
      <p>El <strong>commit en dos fases</strong> (2PC) resuelve esto con un coordinador. En la primera fase pregunta a todos si pueden comprometerse
      y cada uno, antes de responder sí, deja todo asegurado en disco. En la segunda fase el coordinador decide commit solo si todos dijeron
      sí, y comunica la decisión. Su debilidad es conocida: si el coordinador cae en el momento equivocado, los participantes quedan
      <strong>bloqueados</strong>.</p>`,
    visualizaciones: [
      {
        titulo: 'Commit en dos fases con fallas',
        descripcion: 'Recorra cada escenario evento por evento. En «El coordinador cae a mitad del envío», marque «Preguntar a otros participantes»: P1 conoce la decisión y desbloquea al resto. En «El coordinador cae antes de decidir», ni eso alcanza.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Protocolo</h2>
      <pre><code>Coordinador:
    escribir «inicio» en la bitácora;  enviar PREPARE a todos
    esperar votos (con timeout)
    si todos votaron sí:  escribir COMMIT en la bitácora;  enviar GLOBAL-COMMIT
    si no:                escribir ABORT;  enviar GLOBAL-ABORT
    esperar los ack;  escribir «fin»

Participante:
    al recibir PREPARE:
        si puede:  escribir «preparado» (con los cambios) en disco;  votar sí;  estado ← READY
        si no:     escribir ABORT;  votar no
    al recibir la decisión:  escribirla;  aplicarla;  liberar locks;  enviar ack</code></pre>
      <p>Las escrituras en la bitácora estable son lo que permite recuperarse: un participante que vuelve de una caída y encuentra «preparado» sin
      decisión sabe que debe preguntar; uno que no encuentra «preparado» puede abortar.</p>

      <h2>Propiedades</h2>
      <ul>
        <li><strong>Acuerdo:</strong> ningún par de procesos decide distinto.</li>
        <li><strong>Validez:</strong> si alguien vota no, la decisión es ABORT; si todos votan sí y no hay fallas, es COMMIT.</li>
        <li><strong>Terminación:</strong> solo si las fallas se reparan. 2PC es un protocolo <em>bloqueante</em>.</li>
      </ul>

      <h2>Timeouts y terminación</h2>
      <table>
        <tr><th>Quién espera</th><th>En estado</th><th>Acción segura</th></tr>
        <tr><td>Coordinador</td><td>WAIT</td><td>Abortar: nadie pudo haber hecho commit todavía</td></tr>
        <tr><td>Participante</td><td>INIT</td><td>Abortar unilateralmente</td></tr>
        <tr><td>Participante</td><td>READY</td><td>Preguntar a otros; si todos los vivos están en READY, <strong>esperar</strong></td></tr>
      </table>
      <p>Un participante en READY no puede abortar (el coordinador quizás decidió COMMIT y otro ya lo aplicó) ni hacer commit (quizás algún voto fue no).
      Si algún otro participante está en COMMIT, ABORT o incluso INIT, la decisión se deduce; si todos los vivos están en READY y el coordinador
      cayó, la incertidumbre es real: mientras tanto se mantienen los locks y los datos quedan inaccesibles.</p>

      <h2>Costo y alternativas</h2>
      <p>Con \(n\) participantes, sin fallas: \(4n\) mensajes (PREPARE, voto, decisión, ack) y dos escrituras forzadas a disco en el camino crítico
      de cada participante. Variantes:</p>
      <ul>
        <li><strong>Commit en tres fases</strong> (3PC): agrega un estado PRE-COMMIT para que nunca haya READY y COMMIT a la vez; no bloquea con
        fallas de caída y red síncrona, pero falla con particiones.</li>
        <li><strong>Paxos Commit</strong> (Gray y Lamport, 2006): replica la decisión del coordinador con consenso; con \(2f+1\) coordinadores tolera \(f\) caídas sin bloquear.</li>
        <li>Muchos sistemas (Spanner, CockroachDB) ejecutan 2PC sobre grupos replicados por consenso, de modo que «el coordinador» nunca cae del todo.</li>
      </ul>
      <p>Para que todos coincidan sin un coordinador confiable hacen falta algoritmos de consenso; con procesos maliciosos, los de
      <a href="tema.html?id=byzantine-generals">acuerdo bizantino</a>.</p>`,
  });
})();
