(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const NOMBRES = ['P1', 'P2', 'A1', 'A2', 'A3'];
  const TIPO = {
    PREPARE: { color: C.s1, n: 'prepare' }, PROMISE: { color: C.s3, n: 'promise' },
    ACCEPT: { color: C.s2, n: 'accept' }, ACCEPTED: { color: C.s6, n: 'accepted' }, NACK: { color: C.s8, n: 'nack' },
  };

  const ESCENARIOS = {
    normal: { nombre: 'Un proponente', inicios: [[0, 0.3]], caidos: [], demora: () => 1 },
    caido: { nombre: 'Un aceptador caído', inicios: [[0, 0.3]], caidos: [4], demora: () => 1 },
    competencia: {
      nombre: 'Un segundo proponente llega tarde', inicios: [[0, 0.3], [1, 2.6]], caidos: [],
      demora: (m) => (m.tipo === 'ACCEPT' && m.de === 0 && m.a !== 2 ? 3.2 : 1),
    },
    duelo: {
      nombre: 'Proponentes en duelo', inicios: [[0, 0.3], [1, 1.2]], caidos: [], duelo: true,
      demora: (m) => (m.tipo === 'ACCEPT' ? (m.de === 1 ? 3 : 1.6) : 1),
    },
  };

  /* Paxos de un solo valor. Proponentes 0 y 1 (valores X e Y), aceptadores 2, 3, 4. El número de propuesta del proponente i en su intento k es 2k + i + 1. */
  function simular(esc) {
    const cfg = ESCENARIOS[esc], valores = ['X', 'Y'];
    const prop = [0, 1].map((i) => ({ intento: 0, n: 0, promesas: [], aceptados: 0, rechazado: false, activo: false, fase: '' }));
    const acep = [2, 3, 4].map(() => ({ prometido: 0, accN: 0, accV: null }));
    const agenda = [], msgs = [], eventos = [];
    let elegido = null;
    const votos = {};
    const enviar = (de, a, t, tipo, datos) => {
      const m = { de, a, t0: t, tipo, ...datos };
      m.t1 = t + cfg.demora(m);
      m.perdido = cfg.caidos.includes(a);
      msgs.push(m);
      if (!m.perdido) agenda.push({ t: m.t1, m });
    };
    const proponer = (i, t) => {
      const p = prop[i];
      p.n = 2 * p.intento + i + 1; p.intento++; p.promesas = []; p.aceptados = 0; p.rechazado = false; p.fase = 'prepare';
      eventos.push({ p: i, t, texto: `prepare(${p.n})`, color: C.s1, nota: `${NOMBRES[i]} inicia una propuesta con número ${p.n} y pide promesas a los aceptadores.` });
      for (let a = 2; a <= 4; a++) enviar(i, a, t, 'PREPARE', { n: p.n });
    };
    cfg.inicios.forEach(([i, t]) => agenda.push({ t, inicio: i }));
    for (let g = 0; g < 400 && agenda.length; g++) {
      agenda.sort((a, b) => a.t - b.t);
      const e = agenda.shift();
      if (e.inicio != null) { proponer(e.inicio, e.t); continue; }
      const m = e.m, t = e.t;
      if (m.a >= 2) {
        const A = acep[m.a - 2], nm = NOMBRES[m.a];
        if (m.tipo === 'PREPARE') {
          if (m.n > A.prometido) {
            A.prometido = m.n;
            enviar(m.a, m.de, t, 'PROMISE', { n: m.n, accN: A.accN, accV: A.accV });
            eventos.push({ p: m.a, t, texto: `prom ${m.n}${A.accV ? ` · (${A.accN},${A.accV})` : ''}`, color: C.s3, nota: `${nm} promete no aceptar propuestas menores que ${m.n}${A.accV ? ` y avisa que ya aceptó (${A.accN}, ${A.accV})` : ''}.` });
          } else { enviar(m.a, m.de, t, 'NACK', { n: A.prometido }); eventos.push({ p: m.a, t, texto: `rechaza ${m.n}`, color: C.s8, nota: `${nm} ya prometió ${A.prometido} > ${m.n}: rechaza.` }); }
        } else if (m.tipo === 'ACCEPT') {
          if (m.n >= A.prometido) {
            A.prometido = m.n; A.accN = m.n; A.accV = m.v;
            enviar(m.a, m.de, t, 'ACCEPTED', { n: m.n, v: m.v });
            eventos.push({ p: m.a, t, texto: `acepta (${m.n},${m.v})`, color: C.s6, nota: `${nm} acepta (${m.n}, ${m.v}).` });
            const k = `${m.n}`; votos[k] = (votos[k] || 0) + 1;
            if (votos[k] === 2 && !elegido) { elegido = { n: m.n, v: m.v, t }; eventos.push({ p: m.a, t: t + 0.001, texto: '', color: C.s6, nota: `Una mayoría (2 de 3) aceptó (${m.n}, ${m.v}): el valor ${m.v} queda elegido, aunque nadie lo sepa todavía.`, elegido: true }); }
          } else { enviar(m.a, m.de, t, 'NACK', { n: A.prometido }); eventos.push({ p: m.a, t, texto: `rechaza (${m.n},${m.v})`, color: C.s8, nota: `${nm} prometió ${A.prometido} > ${m.n}: rechaza la aceptación.` }); }
        }
      } else {
        const p = prop[m.a], nm = NOMBRES[m.a];
        if (m.n !== p.n && m.tipo !== 'NACK') continue; // respuesta a una propuesta vieja
        if (m.tipo === 'PROMISE' && p.fase === 'prepare') {
          p.promesas.push(m);
          if (p.promesas.length === 2) {
            const previa = p.promesas.filter((x) => x.accV).sort((x, y) => y.accN - x.accN)[0];
            const v = previa ? previa.accV : valores[m.a];
            p.fase = 'accept';
            eventos.push({ p: m.a, t, texto: `accept(${p.n},${v})`, color: C.s2, nota: previa ? `${nm} tiene mayoría de promesas y una ya aceptó (${previa.accN}, ${previa.accV}): debe proponer ${previa.accV}, no su propio valor.` : `${nm} tiene promesas de una mayoría, ninguna con valor previo: propone su valor ${v}.` });
            for (let a = 2; a <= 4; a++) enviar(m.a, a, t, 'ACCEPT', { n: p.n, v });
          }
        } else if (m.tipo === 'ACCEPTED' && p.fase === 'accept') {
          p.aceptados++;
          if (p.aceptados === 2) { p.fase = 'listo'; eventos.push({ p: m.a, t, texto: `sabe: ${m.v}`, color: C.s6, nota: `${nm} recibe la aceptación de una mayoría: sabe que ${m.v} fue elegido.` }); }
        } else if (m.tipo === 'NACK' && p.fase !== 'listo' && !p.rechazado && m.n > p.n) {
          p.rechazado = true; p.fase = 'esperando';
          const reintento = cfg.duelo && p.intento < 3 ? 0.2 : 1.5 + m.a * 1.5;
          eventos.push({ p: m.a, t, texto: 'rechazado', color: C.s8, nota: `${nm} fue rechazado: alguien prometió un número mayor. Reintentará con uno más alto${cfg.duelo && p.intento < 3 ? ' de inmediato' : ' tras esperar un tiempo al azar'}.` });
          agenda.push({ t: t + reintento, inicio: m.a });
        }
      }
    }
    eventos.sort((a, b) => a.t - b.t);
    const tMax = Math.max(...msgs.map((m) => m.t1), ...eventos.map((e) => e.t)) + 0.4;
    return { msgs, eventos, elegido, tMax, cfg };
  }

  function montar(cuerpo) {
    const est = { esc: 'normal' };
    let sim, k = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', valor: est.esc, opciones: Object.entries(ESCENARIOS).map(([c, e]) => [c, e.nombre]), alCambiar: (v) => { est.esc = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 300 : 300) });
    VIZ.leyenda(cuerpo, Object.values(TIPO).map((x) => ({ color: x.color, texto: x.n, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'P1 quiere elegir X y P2 quiere elegir Y. A1, A2 y A3 son los aceptadores; una mayoría son 2.');

    function iniciar() {
      sim = simular(est.esc);
      k = -1;
      return (function* () { for (k = 0; k < sim.eventos.length; k++) yield; k = sim.eventos.length; })();
    }
    function dibujar() {
      lienzo.limpiar();
      const fin = k >= sim.eventos.length;
      const ahora = k < 0 ? 0 : fin ? sim.tMax : sim.eventos[k].t;
      D.espacioTiempo(lienzo, {
        procesos: NOMBRES, t: [0, sim.tMax], sup: 30, inf: 22, margenIzq: 34,
        colorProceso: (p) => (sim.cfg.caidos.includes(p) ? C.inactivo : C.tinta),
        ahora: fin ? null : ahora,
        mensajes: sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).map((m) => {
          const t1 = m.perdido ? m.t0 + (m.t1 - m.t0) * 0.5 : m.t1;
          return { p0: m.de, t0: m.t0, p1: m.a, t1, hasta: ahora < t1 ? ahora : null, color: TIPO[m.tipo].color, ancho: 1.6, guiones: m.perdido ? [3, 3] : null };
        }),
        eventos: sim.eventos.filter((e, i) => i <= k && e.texto).map((e) => ({ p: e.p, t: e.t, relleno: e.color, texto: e.texto, colorTexto: e.color, tam: 10, anillo: sim.eventos[k] === e ? C.tinta : null, fijo: sim.eventos[k] === e })),
      });
      const e = !fin && k >= 0 ? sim.eventos[k] : null;
      registro.textContent = e ? e.nota : fin ? (sim.elegido ? `Se eligió ${sim.elegido.v} con la propuesta ${sim.elegido.n}. Toda propuesta posterior respeta ese valor: dos mayorías siempre comparten un aceptador.` : 'No se eligió ningún valor.')
        : sim.cfg.caidos.length ? 'A3 está caído: los mensajes que le llegan se pierden. Con 2 de 3 basta.' : 'Los aceptadores no han prometido ni aceptado nada.';
      const elegidoYa = sim.elegido && sim.elegido.t <= ahora;
      lectura.set([
        ['valor elegido', elegidoYa ? sim.elegido.v : '—'],
        ['mensajes', String(sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).length)],
        ['propuestas', String(sim.eventos.filter((x, i) => i <= k && x.texto.startsWith('prepare')).length)],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('paxos', {
    intro: String.raw`
      <p>El problema del <strong>consenso</strong> pide que varios procesos elijan un único valor entre los propuestos, aunque algunos fallen y los mensajes se
      demoren arbitrariamente. Es el corazón de toda replicación tolerante a fallas: decidir cuál es la próxima operación del registro, quién es el líder o si
      una transacción hace commit.</p>
      <p><strong>Paxos</strong> (Lamport, 1989/1998) lo resuelve con fallas de caída mientras una mayoría siga viva. Los <em>proponentes</em> numeran sus propuestas; en
      una primera fase obtienen de una mayoría de <em>aceptadores</em> la promesa de ignorar números menores y averiguan si ya se aceptó algún valor; en la segunda,
      piden aceptar un valor, que debe ser el ya aceptado si lo hay. Nunca se eligen dos valores distintos, aunque, con mala suerte, puede no terminar.</p>`,
    visualizaciones: [
      {
        titulo: 'Las dos fases de Paxos',
        descripcion: 'Avance evento por evento. En «Un segundo proponente llega tarde», P2 descubre que A1 ya aceptó X y propone X en lugar de Y. En «Proponentes en duelo», cada uno anula al otro hasta que uno espera más.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Requisitos del consenso</h2>
      <ul>
        <li><strong>Acuerdo:</strong> no se eligen dos valores distintos.</li>
        <li><strong>Validez:</strong> el valor elegido fue propuesto por alguien.</li>
        <li><strong>Terminación:</strong> los procesos correctos terminan decidiendo.</li>
      </ul>
      <p>Fischer, Lynch y Paterson (1985) probaron que en un sistema asíncrono con una sola falla de caída ningún algoritmo determinista garantiza las tres. Paxos
      garantiza siempre las dos primeras (<em>seguridad</em>) y la tercera cuando el sistema se porta bien por un tiempo y hay un único proponente activo (<em>vivacidad</em>).</p>

      <h2>Algoritmo</h2>
      <pre><code>Fase 1 (proponente, número n único y creciente):
    enviar PREPARE(n) a los aceptadores
Aceptador al recibir PREPARE(n):
    si n &gt; prometido:  prometido ← n;  responder PROMISE(n, (n_acept, v_acept))
Fase 2 (proponente, con PROMISE de una mayoría):
    v ← el valor con mayor n_acept entre las promesas, o el propio si no hay
    enviar ACCEPT(n, v)
Aceptador al recibir ACCEPT(n, v):
    si n ≥ prometido:  prometido ← n;  (n_acept, v_acept) ← (n, v);  responder ACCEPTED
Un valor está elegido cuando una mayoría aceptó la misma propuesta (n, v).</code></pre>

      <h2>Por qué no se eligen dos valores</h2>
      <div class="recuadro"><p><strong>Invariante.</strong> Si \((n, v)\) fue elegida, toda propuesta \((n', v')\) con \(n' &gt; n\) que llegue a la fase 2 tiene \(v' = v\).</p></div>
      <p>Sea \(Q\) la mayoría que aceptó \((n, v)\) y \(Q'\) la mayoría que prometió \(n'\). Dos mayorías se intersecan: algún aceptador \(a \in Q \cap Q'\). Ese aceptador
      tuvo que aceptar \(n\) antes de prometer \(n'\) (después de prometer \(n'\) habría rechazado \(n\)), así que su promesa informa una aceptación con número \(\ge n\). Por
      inducción sobre los números entre \(n\) y \(n'\), la de mayor número tiene valor \(v\), y el proponente de \(n'\) está obligado a usarlo.</p>

      <h2>En la práctica</h2>
      <p>Para evitar el duelo se elige un <strong>líder</strong> que sea el único proponente; con un líder estable, <strong>Multi-Paxos</strong> salta la fase 1 para cada nueva
      entrada del registro y decide cada valor en un solo viaje de ida y vuelta a una mayoría. Con \(2f + 1\) aceptadores tolera \(f\) caídas. Lo usan Chubby, Spanner y
      muchos almacenes replicados; <a href="tema.html?id=raft">Raft</a> es una reformulación con el mismo núcleo, pensada para ser más fácil de entender e implementar. Con fallas
      bizantinas hacen falta \(3f + 1\) réplicas (PBFT).</p>`,
  });
})();
