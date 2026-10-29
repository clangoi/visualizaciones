(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const PROD = (malo) => ['producir ítem', ...(malo ? ['P(mutex)', 'P(vacíos)'] : ['P(vacíos)', 'P(mutex)']), 'poner en el buffer', 'V(mutex)', 'V(llenos)'];
  const CONS = ['P(llenos)', 'P(mutex)', 'sacar del buffer', 'V(mutex)', 'V(vacíos)', 'consumir ítem'];
  const NOMBRES = ['Productor 1', 'Productor 2', 'Consumidor 1', 'Consumidor 2'];

  function montar(cuerpo) {
    const est = { n: 3, malo: false };
    let s, rnd = VIZ.semilla(3);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capacidad del buffer', min: 1, max: 6, valor: est.n, alCambiar: (v) => { est.n = v; reiniciar(); } });
    ctl.casilla({ etiqueta: 'Productor con P(mutex) antes de P(vacíos)', valor: est.malo, alCambiar: (v) => { est.malo = v; reiniciar(); } });
    NOMBRES.forEach((nm, i) => ctl.boton(`${nm.replace('Productor', 'Prod.').replace('Consumidor', 'Cons.')} avanza`, () => { avanzar(i); dibujar(); }));
    ctl.boton('10 pasos al azar', () => { for (let k = 0; k < 10; k++) { const listos = [0, 1, 2, 3].filter((i) => !s.bloq[i]); if (!listos.length) break; avanzar(listos[Math.floor(rnd() * listos.length)]); } dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 380 : 250) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'productores' }, { color: C.s2, texto: 'consumidores' },
      { color: C.s4, texto: 'bloqueado en un P()', forma: 'punto' }, { color: C.s8, texto: 'todos bloqueados: interbloqueo', forma: 'punto' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija qué proceso avanza una instrucción. Un proceso bloqueado en P() no avanza hasta que otro haga el V() correspondiente.');

    function reiniciar() {
      s = { sem: { mutex: 1, vacíos: est.n, llenos: 0 }, colas: { mutex: [], vacíos: [], llenos: [] }, buffer: [], pc: [0, 0, 0, 0], bloq: [false, false, false, false], item: 0, producidos: 0, consumidos: 0, log: 'Semáforos: mutex = 1, vacíos = capacidad, llenos = 0.' };
      dibujar();
    }
    const codigo = (i) => (i < 2 ? PROD(est.malo) : CONS);

    function avanzar(i) {
      if (s.bloq[i]) { s.log = `${NOMBRES[i]} está bloqueado: no puede avanzar.`; return; }
      const ins = codigo(i)[s.pc[i]];
      const m = ins.match(/^([PV])\(([^)]+)\)$/);
      if (m) {
        const [, op, sem] = m;
        if (op === 'P') {
          if (s.sem[sem] > 0) { s.sem[sem]--; s.log = `${NOMBRES[i]}: P(${sem}) pasa; ${sem} = ${s.sem[sem]}.`; }
          else { s.bloq[i] = true; s.colas[sem].push(i); s.log = `${NOMBRES[i]}: P(${sem}) con ${sem} = 0 → se bloquea.`; return; }
        } else {
          if (s.colas[sem].length) {
            const j = s.colas[sem].shift();
            s.bloq[j] = false; s.pc[j] = (s.pc[j] + 1) % codigo(j).length;
            s.log = `${NOMBRES[i]}: V(${sem}) despierta a ${NOMBRES[j]}, que completa su P(${sem}).`;
          } else { s.sem[sem]++; s.log = `${NOMBRES[i]}: V(${sem}); ${sem} = ${s.sem[sem]}.`; }
        }
      } else if (ins === 'producir ítem') { s.item++; s.log = `${NOMBRES[i]} produce el ítem ${s.item} (fuera de la sección crítica).`; }
      else if (ins === 'poner en el buffer') { s.buffer.push(i === 0 ? `a${s.item}` : `b${s.item}`); s.producidos++; s.log = `${NOMBRES[i]} pone un ítem en el buffer.`; }
      else if (ins === 'sacar del buffer') { s.buffer.shift(); s.consumidos++; s.log = `${NOMBRES[i]} saca un ítem del buffer.`; }
      else s.log = `${NOMBRES[i]} consume el ítem.`;
      s.pc[i] = (s.pc[i] + 1) % codigo(i).length;
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const todos = s.bloq.every(Boolean);
      // Buffer al centro, arriba.
      const bw = Math.min(46, (W - 40) / est.n), bx = W / 2 - (bw * est.n) / 2, by = 14;
      for (let k = 0; k < est.n; k++) {
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(bx + k * bw, by, bw, 30);
        if (k < s.buffer.length) { ctx.fillStyle = VIZ.alfa(C.s1, 0.25); ctx.fillRect(bx + k * bw + 2, by + 2, bw - 4, 26); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.buffer[k], bx + k * bw + bw / 2, by + 15); }
      }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.fillText('buffer', W / 2, by + 42);
      // Procesos
      const cw = angosto ? (W - 24) / 2 : (W - 40) / 4;
      for (let i = 0; i < 4; i++) {
        const x = angosto ? 8 + (i % 2) * (cw + 8) : 8 + i * (cw + 8), y = angosto ? 70 + Math.floor(i / 2) * 150 : 70;
        const col = i < 2 ? C.s1 : C.s2;
        ctx.strokeStyle = todos ? C.s8 : s.bloq[i] ? C.s4 : col; ctx.lineWidth = s.bloq[i] ? 3 : 1.5;
        ctx.strokeRect(x, y, cw, 140);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(NOMBRES[i] + (s.bloq[i] ? ' · bloqueado' : ''), x + 6, y + 12);
        ctx.font = VIZ.fuente(angosto ? 10 : 11);
        codigo(i).forEach((ins, j) => {
          const yy = y + 32 + j * 18;
          if (s.pc[i] === j) { ctx.fillStyle = s.bloq[i] ? VIZ.alfa(C.s4, 0.35) : VIZ.alfa(col, 0.15); ctx.fillRect(x + 3, yy - 8, cw - 6, 16); }
          ctx.fillStyle = s.pc[i] === j ? C.tinta : C.tinta2;
          ctx.fillText(`${s.pc[i] === j ? '▸' : ' '} ${ins}`, x + 6, yy);
        });
      }
      // Tabla de semáforos
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th', { class: 'izq' }, 'semáforo'), el('th', null, 'valor'), el('th', { class: 'izq' }, 'bloqueados en su cola')),
        Object.keys(s.sem).map((k) => el('tr', null, el('td', { class: 'izq' }, k), el('td', null, String(s.sem[k])),
          el('td', { class: 'izq' }, s.colas[k].map((j) => NOMBRES[j]).join(', ') || '—')))));
      registro.textContent = todos ? `${s.log} Los cuatro procesos están bloqueados: interbloqueo. Un productor tomó mutex y espera un espacio que solo un consumidor (bloqueado en mutex) podría liberar.` : s.log;
      lectura.set([
        ['en el buffer', `${s.buffer.length} de ${est.n}`],
        ['producidos', String(s.producidos)],
        ['consumidos', String(s.consumidos)],
        ['vacíos + llenos', `${s.sem.vacíos + s.sem.llenos} (≤ ${est.n})`],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    reiniciar();
  }

  VIZ.registrarTema('semaphores', {
    intro: String.raw`
      <p>Un <strong>semáforo</strong> (Dijkstra, 1965) es un contador entero con dos operaciones atómicas: <code>P</code> (esperar) lo decrementa y, si ya
      era cero, bloquea al proceso; <code>V</code> (señalar) lo incrementa o despierta a un proceso bloqueado. Con valor inicial 1 es un lock; con valor
      \(n\) cuenta recursos disponibles.</p>
      <p>El problema del <strong>productor–consumidor</strong> con buffer acotado usa los dos papeles a la vez: <code>mutex</code> protege el buffer, y
      <code>vacíos</code> y <code>llenos</code> cuentan espacios e ítems, de modo que el productor espera cuando el buffer está lleno y el consumidor cuando está
      vacío, sin consumir CPU mientras espera.</p>`,
    visualizaciones: [
      {
        titulo: 'Productores y consumidores',
        descripcion: 'Avance los procesos a mano o al azar y observe los valores de los semáforos y sus colas. Marque la casilla: con P(mutex) antes de P(vacíos), un productor puede quedarse dormido con el buffer tomado y todos se bloquean.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <pre><code>P(s):  si s &gt; 0:  s ← s − 1
       si no:   bloquear al proceso en la cola de s
V(s):  si hay procesos en la cola de s:  despertar a uno (completa su P)
       si no:   s ← s + 1</code></pre>
      <p>Ambas operaciones deben ser atómicas; el sistema operativo las implementa con instrucciones como <em>test-and-set</em> o deshabilitando interrupciones por un
      instante.</p>

      <h2>Productor–consumidor</h2>
      <pre><code>mutex ← 1;  vacíos ← N;  llenos ← 0

productor:                    consumidor:
    producir ítem                 P(llenos)
    P(vacíos)                     P(mutex)
    P(mutex)                      sacar del buffer
    poner en el buffer            V(mutex)
    V(mutex)                      V(vacíos)
    V(llenos)                     consumir ítem</code></pre>
      <p><strong>Invariante.</strong> En todo momento, \(\text{vacíos} + \text{llenos} + (\text{procesos entre P y V de esos semáforos}) = N\), y los ítems en el buffer están entre
      \(\text{llenos}\) y \(N - \text{vacíos}\). Por eso nunca se saca de un buffer vacío ni se pone en uno lleno.</p>

      <h2>El orden importa</h2>
      <p>Si el productor hace <code>P(mutex)</code> antes de <code>P(vacíos)</code> y el buffer está lleno, se bloquea en <code>vacíos</code> reteniendo <code>mutex</code>; el
      consumidor, que es el único que podría liberar un espacio, se bloquea en <code>mutex</code>. Es un <strong>interbloqueo</strong> con espera circular de dos procesos, como
      en los <a href="tema.html?id=dining-philosophers">filósofos comensales</a>. La regla práctica: esperar los recursos que cuentan antes de tomar el lock, y nunca dormir
      con un lock tomado.</p>

      <h2>En sistemas distribuidos</h2>
      <p>Sin memoria compartida, un semáforo se implementa con un servidor que guarda el contador (como el <a href="tema.html?id=mutual-exclusion">coordinador central</a>)
      o con algoritmos distribuidos. Servicios como ZooKeeper o etcd ofrecen locks y semáforos distribuidos sobre <a href="tema.html?id=raft">consenso</a>, con
      <em>leases</em> que expiran si el dueño cae, para no bloquear para siempre.</p>`,
  });
})();
