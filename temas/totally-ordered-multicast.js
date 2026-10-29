(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;

  const OPS = [
    { p: 0, t: 0.5, texto: '+100', f: (x) => x + 100, color: C.s1 },
    { p: 2, t: 0.7, texto: '×1,01', f: (x) => Math.round(x * 1.01 * 100) / 100, color: C.s2 },
  ];

  /* Simulación por eventos. ordenado = false: cada réplica aplica una actualización apenas la recibe.
     ordenado = true: marcas de Lamport, cola ordenada por (marca, proceso) y acuses a todos; se entrega la cabeza cuando todos la acusaron. Canales FIFO. */
  function simular(n, ordenado, semilla, ops) {
    const rnd = VIZ.semilla(semilla);
    const reloj = new Array(n).fill(0), saldo = new Array(n).fill(1000);
    const cola = Array.from({ length: n }, () => []), acuses = Array.from({ length: n }, () => ({}));
    const entregado = Array.from({ length: n }, () => new Set());
    const ultimo = {}, agenda = [], msgs = [], eventos = [];
    const demora = (a, b, t) => { const k = `${a}-${b}`; const tl = Math.max(t + 0.6 + rnd() * 3.2, (ultimo[k] || 0) + 0.05); ultimo[k] = tl; return tl; };
    const enviar = (de, a, t, tipo, u, ts) => { const t1 = demora(de, a, t); const m = { p0: de, t0: t, p1: a, t1, tipo, u, ts }; msgs.push(m); agenda.push({ t: t1, m }); };
    const clave = (ts) => ts[0] * 100 + ts[1];
    const intentar = (p, t) => {
      for (;;) {
        cola[p].sort((x, y) => clave(x.ts) - clave(y.ts));
        const cab = cola[p][0];
        if (!cab) return;
        // El emisor no acusa su propio mensaje: recibirlo ya cuenta (FIFO).
        const ack = acuses[p][cab.u] || new Set();
        if (Array.from({ length: n }, (_, q) => q).some((q) => q !== p && q !== cab.de && !ack.has(q))) return;
        cola[p].shift();
        aplicar(p, cab.u, t + 0.01, true);
      }
    };
    const aplicar = (p, u, t, enCola) => {
      if (entregado[p].has(u)) return;
      entregado[p].add(u);
      saldo[p] = ops[u].f(saldo[p]);
      eventos.push({ p, t, tipo: 'entrega', u, saldo: saldo[p], enCola });
    };
    ops.forEach((o, u) => agenda.push({ t: o.t, envio: u }));
    for (let g = 0; g < 500 && agenda.length; g++) {
      agenda.sort((a, b) => a.t - b.t);
      const e = agenda.shift();
      if (e.envio != null) {
        const o = ops[e.envio], p = o.p;
        const ts = [++reloj[p], p];
        eventos.push({ p, t: e.t, tipo: 'envio', u: e.envio, ts });
        for (let q = 0; q < n; q++) if (q !== p) enviar(p, q, e.t, 'upd', e.envio, ts);
        if (ordenado) { cola[p].push({ u: e.envio, ts, de: p }); intentar(p, e.t); }
        else aplicar(p, e.envio, e.t + 0.01, false);
        continue;
      }
      const m = e.m, p = m.p1;
      reloj[p] = Math.max(reloj[p], m.ts ? m.ts[0] : 0) + 1;
      if (m.tipo === 'upd') {
        if (!ordenado) { aplicar(p, m.u, e.t, false); continue; }
        cola[p].push({ u: m.u, ts: m.ts, de: m.p0 });
        const ts = [++reloj[p], p];
        for (let q = 0; q < n; q++) if (q !== p) enviar(p, q, e.t, 'ack', m.u, ts);
        intentar(p, e.t);
      } else {
        (acuses[p][m.u] = acuses[p][m.u] || new Set()).add(m.p0);
        intentar(p, e.t);
      }
    }
    eventos.sort((a, b) => a.t - b.t);
    const tMax = Math.max(...eventos.map((x) => x.t), ...msgs.map((m) => m.t1)) + 0.5;
    return { msgs, eventos, saldo, tMax };
  }

  function montar(cuerpo) {
    const est = { n: 3, ordenado: false, semilla: 0 };
    let sim, k = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Multicast totalmente ordenado (Lamport + acuses)', valor: est.ordenado, alCambiar: (v) => { est.ordenado = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Otras demoras', () => { est.semilla = (est.semilla || buscar()) + 1; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 230 : 250) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'depósito +100 (de P1)', forma: 'linea' }, { color: C.s2, texto: 'interés ×1,01 (de P3)', forma: 'linea' },
      { color: C.tenue, texto: 'acuse', forma: 'linea' }, { color: C.s6, texto: 'réplicas iguales', forma: 'punto' }, { color: C.s8, texto: 'réplicas distintas', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tres réplicas de una cuenta con saldo 1000. Sobre cada entrega, la operación aplicada y el saldo resultante; sobre cada envío, la marca (reloj, proceso).');

    // Demoras en que, sin orden, las réplicas terminan distintas.
    function buscar() {
      for (let s = 1; s < 200; s++) { const r = simular(est.n, false, s * 13, OPS); if (new Set(r.saldo).size > 1) return s; }
      return 1;
    }
    function iniciar() {
      if (!est.semilla) est.semilla = buscar();
      sim = simular(est.n, est.ordenado, est.semilla * 13, OPS);
      k = -1;
      return (function* () { for (k = 0; k < sim.eventos.length; k++) yield; k = sim.eventos.length; })();
    }

    function dibujar() {
      lienzo.limpiar();
      const ahora = k < 0 ? 0 : k >= sim.eventos.length ? sim.tMax : sim.eventos[k].t;
      const vis = sim.eventos.filter((_, i) => i <= k);
      const saldos = new Array(est.n).fill(1000);
      vis.forEach((e) => { if (e.tipo === 'entrega') saldos[e.p] = e.saldo; });
      const fin = k >= sim.eventos.length;
      const iguales = new Set(sim.saldo).size === 1;
      D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: est.n }, (_, p) => P(p)), t: [0, sim.tMax], sup: 34, inf: 30,
        ahora: fin ? null : ahora,
        mensajes: sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).map((m) => ({
          p0: m.p0, t0: m.t0, p1: m.p1, t1: m.t1, hasta: ahora < m.t1 ? ahora : null,
          color: m.tipo === 'ack' ? C.tenue : OPS[m.u].color, ancho: m.tipo === 'ack' ? 1 : 2,
        })),
        eventos: vis.map((e) => e.tipo === 'envio'
          ? { p: e.p, t: e.t, relleno: OPS[e.u].color, texto: `(${e.ts[0]},${e.ts[1] + 1})`, tam: 10, abajo: true, fijo: true }
          : { p: e.p, t: e.t, relleno: fin ? (iguales ? C.s6 : C.s8) : C.tinta, texto: `${OPS[e.u].texto} → ${VIZ.fmt(e.saldo, 6)}`, tam: 10, fijo: true }),
      });
      const e = k >= 0 && !fin ? sim.eventos[k] : null;
      registro.textContent = !e && !fin ? 'P1 deposita 100 y P3 aplica un interés del 1 %, casi al mismo tiempo, y cada uno lo difunde a las tres réplicas.'
        : fin ? (iguales ? `Las tres réplicas aplicaron las operaciones en el mismo orden y terminan con ${VIZ.fmt(sim.saldo[0], 6)}.` : `Las réplicas terminan distintas (${sim.saldo.map((x) => VIZ.fmt(x, 6)).join(', ')}): aplicaron las mismas operaciones en distinto orden.`)
          : e.tipo === 'envio' ? `${P(e.p)} difunde ${OPS[e.u].texto} con marca (${e.ts[0]},${e.ts[1] + 1}).`
            : `${P(e.p)} aplica ${OPS[e.u].texto}: saldo ${VIZ.fmt(e.saldo, 6)}${e.enCola ? ' (era la cabeza de su cola y todos la acusaron)' : ''}.`;
      lectura.set([
        ...saldos.map((v, p) => [`saldo en ${P(p)}`, VIZ.fmt(v, 6)]),
        ['mensajes', String(sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).length)],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('totally-ordered-multicast', {
    intro: String.raw`
      <p>Para replicar un servicio, todas las réplicas deben ejecutar las mismas operaciones <em>en el mismo orden</em>. Si un cliente deposita 100 y otro aplica un
      interés del 1 % a la vez, una réplica puede calcular \((1000 + 100) \cdot 1{,}01 = 1111\) y otra \(1000 \cdot 1{,}01 + 100 = 1110\): ambas «correctas» y distintas.</p>
      <p>Un <strong>multicast totalmente ordenado</strong> entrega todos los mensajes a todos los destinatarios en el mismo orden. Con
      <a href="tema.html?id=lamport-clocks">relojes de Lamport</a> se logra sin un coordinador: cada mensaje lleva una marca, cada réplica los encola ordenados por
      (marca, proceso) y solo entrega la cabeza de la cola cuando sabe, por los acuses, que ya no puede llegar ninguno con marca menor.</p>`,
    visualizaciones: [
      {
        titulo: 'Réplicas de una cuenta',
        descripcion: 'Sin orden, cada réplica aplica las operaciones según le llegan y terminan distintas (rojo). Marque la casilla: las réplicas retienen cada operación hasta que todos la acusan y las aplican en el mismo orden (verde).',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <p>Supone canales confiables y FIFO, y procesos sin fallas.</p>
      <pre><code>difundir(m):  L ← L + 1;  m.marca ← (L, i);  enviar m a todos;  encolar m

al recibir m:  L ← max(L, m.marca) + 1
               encolar m (ordenada por marca);  enviar ACK(m) a todos

al recibir ACK:  L ← max(L, marca) + 1;  anotar el acuse

entregar la cabeza m de la cola cuando todos los demás procesos la acusaron</code></pre>

      <h2>Corrección</h2>
      <p>Sea \(m\) la cabeza en \(P_i\) y supongamos que todos la acusaron. Si existiera un mensaje \(m'\) de \(P_k\) con marca menor que aún no llega a \(P_i\): \(P_k\) envió
      \(m'\) antes que su ACK de \(m\) (pues el ACK tiene marca mayor que la de \(m\), y esta mayor que la de \(m'\)). Por FIFO, \(m'\) llega a \(P_i\) antes que ese ACK:
      contradicción. Así, cuando \(P_i\) entrega \(m\), ya tiene todos los mensajes de marca menor, y todas las réplicas entregan en el orden \((L, i)\), el mismo para todas.</p>

      <h2>Costo y variantes</h2>
      <p>Cada difusión cuesta \(n-1\) mensajes y \(n(n-1)\) acuses: \(O(n^2)\). Alternativas:</p>
      <ul>
        <li><strong>Secuenciador:</strong> un proceso asigna números de secuencia; \(O(n)\) mensajes, pero es un punto único de falla.</li>
        <li><strong>ISIS</strong> (Birman): cada receptor propone una marca y el emisor elige la máxima.</li>
        <li>Con fallas, el orden total es equivalente al <a href="tema.html?id=paxos">consenso</a>: los sistemas reales lo implementan con Paxos o
        <a href="tema.html?id=raft">Raft</a>, que replican un registro de operaciones ordenado.</li>
      </ul>
      <table>
        <tr><th>Orden</th><th>Garantía</th><th>Mecanismo típico</th></tr>
        <tr><td>FIFO</td><td>Los mensajes de un mismo emisor, en orden</td><td>Números de secuencia por emisor</td></tr>
        <tr><td>Causal</td><td>Si \(m \to m'\), \(m\) antes que \(m'\)</td><td><a href="tema.html?id=vector-clocks">Relojes vectoriales</a></td></tr>
        <tr><td>Total</td><td>Todos en el mismo orden</td><td>Lamport + acuses, secuenciador, consenso</td></tr>
      </table>
      <p>El orden total no implica el causal ni al revés; la combinación (orden total causal) es la base de la replicación de máquinas de estado.</p>`,
  });
})();
