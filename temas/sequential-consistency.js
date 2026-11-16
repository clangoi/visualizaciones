(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;

  /* ---------- Historias ---------- */

  // Una historia se escribe como una lista de procesos, cada uno con sus operaciones en orden de programa.
  const h = (...procs) => procs.flatMap((ops, p) => ops.map((s, j) => {
    const m = s.match(/^([WR])\((\w)\)(\d+)$/);
    return { p, tipo: m[1], x: m[2], v: +m[3], t0: j * 1.1, t1: j * 1.1 + 0.9 };
  }));

  const EJEMPLOS = {
    valida: {
      nombre: 'Dos escrituras vistas igual',
      ops: () => h(['W(x)1'], ['W(x)2'], ['R(x)2', 'R(x)1'], ['R(x)2', 'R(x)1']),
      nota: 'P3 y P4 ven las dos escrituras en el mismo orden: primero la de P2 y después la de P1.',
    },
    invalida: {
      nombre: 'Dos escrituras vistas distinto',
      ops: () => h(['W(x)1'], ['W(x)2'], ['R(x)2', 'R(x)1'], ['R(x)1', 'R(x)2']),
      nota: 'P3 necesita W(x)2 antes de W(x)1 y P4 lo contrario: ningún orden total satisface a ambos.',
    },
    sb: {
      nombre: 'Buffers de escritura',
      ops: () => h(['W(x)1', 'R(y)0'], ['W(y)1', 'R(x)0']),
      nota: 'Cada lectura debe ir antes de la escritura del otro, pero cada escritura va antes de su propia lectura: se forma un ciclo.',
    },
    mp: {
      nombre: 'Paso de mensaje',
      ops: () => h(['W(x)1', 'W(y)1'], ['R(y)1', 'R(x)0']),
      nota: 'Si P2 ve y = 1, ya pasó W(x)1, que va antes en P1; leer después x = 0 es imposible.',
    },
    azar: { nombre: 'Al azar', ops: null },
  };

  function azar(semilla) {
    const rnd = VIZ.semilla(semilla);
    const n = 3, procs = [], sig = { x: 1, y: 1 };
    const escritos = { x: [0], y: [0] };
    for (let p = 0; p < n; p++) {
      const ops = [];
      const k = 2 + (rnd() < 0.5 ? 1 : 0);
      for (let j = 0; j < k; j++) {
        const x = rnd() < 0.5 ? 'x' : 'y';
        if (rnd() < 0.45) { ops.push(`W(${x})${sig[x]}`); escritos[x].push(sig[x]); sig[x]++; } else ops.push(`R(${x})?`);
      }
      procs.push(ops);
    }
    // Las lecturas eligen un valor escrito por alguien (o el inicial).
    return h(...procs.map((ops) => ops.map((s) => (s.endsWith('?') ? s.replace('?', String(escritos[s[2]][Math.floor(rnd() * escritos[s[2]].length)])) : s))));
  }

  // Cuenta intercalaciones que respetan el orden de programa y cuántas de ellas son legales.
  function contar(ops, nProc) {
    const porProc = Array.from({ length: nProc }, (_, p) => ops.map((o, i) => i).filter((i) => ops[i].p === p));
    let total = 0, legales = 0;
    const idx = new Array(nProc).fill(0), mem = {};
    (function rec(ok) {
      let alguno = false;
      for (let p = 0; p < nProc; p++) {
        if (idx[p] >= porProc[p].length) continue;
        alguno = true;
        const o = ops[porProc[p][idx[p]]];
        const prev = mem[o.x];
        const bien = ok && (o.tipo === 'W' || (mem[o.x] ?? 0) === o.v);
        if (o.tipo === 'W') mem[o.x] = o.v;
        idx[p]++;
        rec(bien);
        idx[p]--;
        if (o.tipo === 'W') { if (prev === undefined) delete mem[o.x]; else mem[o.x] = prev; }
      }
      if (!alguno) { total++; if (ok) legales++; }
    })(true);
    return { total, legales };
  }

  /* ---------- Fig. 1: buscar un orden total ---------- */

  function montarHistoria(cuerpo) {
    const est = { ej: 'valida', semilla: 1 };
    let ops, nProc = 3, geo = null, cajas = [];
    const ctl = VIZ.controles(cuerpo);
    const selHist = ctl.selector({ etiqueta: 'Historia', valor: est.ej, opciones: Object.entries(EJEMPLOS).map(([k, e]) => [k, e.nombre]),
      alCambiar: (v) => { est.ej = v; cargar(); } });
    ctl.boton('Otra al azar', () => { est.ej = 'azar'; selHist.valor = 'azar'; est.semilla++; cargar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => Math.max(150, nProc * 52 + 34) });
    lienzo.canvas.style.cursor = 'pointer';
    const ley = VIZ.leyenda(cuerpo, []);
    const tira = VIZ.grafo.estructura(cuerpo, 'Orden total:');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una lectura R para cambiar el valor que devolvió. Todas las variables empiezan en 0.');

    function cargar() {
      const e = EJEMPLOS[est.ej];
      ops = e.ops ? e.ops() : azar(est.semilla * 53);
      nProc = Math.max(...ops.map((o) => o.p)) + 1;
      lienzo.ajustar(true);
    }

    function dibujar() {
      lienzo.limpiar();
      const orden = D.secuencial(ops);
      const pos = new Map((orden || []).map((i, k) => [i, k]));
      const maxJ = Math.max(...ops.map((o) => o.t1));
      geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: nProc }, (_, p) => P(p)), t: [-0.15, Math.max(maxJ + 0.25, 4.2)], sup: 26, inf: 20,
        colorProceso: (p) => VIZ.series[p],
        intervalos: ops.map((o, i) => ({
          p: o.p, t0: o.t0, t1: o.t1, color: VIZ.series[o.p], relleno: o.tipo === 'W' ? VIZ.alfa(VIZ.series[o.p], 0.14) : C.superficie,
          texto: D.textoOp(o) + (orden ? `  ·${pos.get(i) + 1}` : ''), grosor: o.tipo === 'R' ? 2 : 1.5,
        })),
      });
      cajas = ops.map((o) => ({ x0: geo.x(o.t0), x1: geo.x(o.t1), y: geo.y(o.p) }));
      ley.set([
        ...Array.from({ length: nProc }, (_, p) => ({ color: VIZ.series[p], texto: `operaciones de ${P(p)}` })),
        { color: C.superficie, borde: C.tinta, texto: 'lectura (clic para cambiar)' },
      ]);
      tira.set(orden ? orden.map((i) => ({ texto: D.textoOp(ops[i]), color: VIZ.series[ops[i].p], tinta: VIZ.series[ops[i].p] })) : [],
        'no existe ningún orden total válido');
      const nota = EJEMPLOS[est.ej].nota;
      const original = EJEMPLOS[est.ej].ops && JSON.stringify(EJEMPLOS[est.ej].ops()) === JSON.stringify(ops);
      registro.textContent = orden
        ? `Secuencialmente consistente: el orden de abajo respeta el orden de programa de cada proceso y cada lectura devuelve la última escritura anterior. ${original ? nota : ''}`
        : `No es secuencialmente consistente. ${original ? nota : 'Toda intercalación que respeta el orden de programa deja alguna lectura sin la última escritura.'}`;
      const c = contar(ops, nProc);
      lectura.set([
        ['secuencial', orden ? 'sí' : 'no'],
        ['causal', D.causal(ops, nProc).ok ? 'sí' : 'no'],
        ['intercalaciones', VIZ.entero(c.total)],
        ['legales', VIZ.entero(c.legales)],
      ]);
    }
    lienzo.alDibujar = () => ops && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = cajas.findIndex((c) => x >= c.x0 && x <= c.x1 && Math.abs(y - c.y) <= 12);
      if (i < 0 || ops[i].tipo !== 'R') return;
      const o = ops[i];
      const vals = [0, ...ops.filter((w) => w.tipo === 'W' && w.x === o.x).map((w) => w.v)];
      o.v = vals[(vals.indexOf(o.v) + 1) % vals.length];
      dibujar();
    });
    cargar();
  }

  /* ---------- Fig. 2: la prueba de buffers de escritura ---------- */

  // Programa: P1: x ← 1; r1 ← y.   P2: y ← 1; r2 ← x.
  const PROG = [[['W', 'x'], ['R', 'y']], [['W', 'y'], ['R', 'x']]];

  function estadoInicial() { return { pc: [0, 0], buf: [[], []], mem: { x: 0, y: 0 }, r: [null, null], log: [] }; }
  const copiar = (s) => ({ pc: s.pc.slice(), buf: s.buf.map((b) => b.slice()), mem: { ...s.mem }, r: s.r.slice(), log: s.log.slice() });

  // Acciones posibles: ejecutar la siguiente instrucción de P o vaciar la primera escritura de su buffer.
  function acciones(s, tso) {
    const a = [];
    for (let p = 0; p < 2; p++) {
      if (s.pc[p] < 2) a.push(['ejec', p]);
      if (tso && s.buf[p].length) a.push(['vaciar', p]);
    }
    return a;
  }
  function aplicar(s, [tipo, p], tso) {
    const t = copiar(s);
    if (tipo === 'vaciar') { const [x, v] = t.buf[p].shift(); t.mem[x] = v; t.log.push(`buffer de ${P(p)} → memoria: ${x} = ${v}`); return t; }
    const [op, x] = PROG[p][t.pc[p]++];
    if (op === 'W') {
      if (tso) { t.buf[p].push([x, 1]); t.log.push(`${P(p)}: ${x} ← 1 queda en su buffer`); }
      else { t.mem[x] = 1; t.log.push(`${P(p)}: ${x} ← 1 en memoria`); }
    } else {
      const propio = t.buf[p].filter(([y]) => y === x).pop();
      const v = propio ? propio[1] : t.mem[x];
      t.r[p] = v;
      t.log.push(`${P(p)}: r${p + 1} ← ${x} = ${v}${propio ? ' (de su propio buffer)' : ''}`);
    }
    return t;
  }
  const terminado = (s) => s.pc[0] === 2 && s.pc[1] === 2 && !s.buf[0].length && !s.buf[1].length;

  // Todos los resultados alcanzables (r1, r2) y cuántas ejecuciones llevan a cada uno.
  function explorar(tso) {
    const res = {};
    (function rec(s) {
      if (terminado(s)) { const k = s.r.join(','); res[k] = (res[k] || 0) + 1; return; }
      for (const a of acciones(s, tso)) rec(aplicar(s, a, tso));
    })(estadoInicial());
    return res;
  }

  function montarTSO(cuerpo) {
    let tso = false, s = estadoInicial(), rnd = VIZ.semilla(5);
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Con buffers de escritura (TSO, x86)', valor: tso, alCambiar: (v) => { tso = v; s = estadoInicial(); dibujar(); } });
    ctl.boton('P1 ejecuta', () => hacer(['ejec', 0]));
    ctl.boton('P2 ejecuta', () => hacer(['ejec', 1]));
    ctl.boton('Vaciar buffer de P1', () => hacer(['vaciar', 0]));
    ctl.boton('Vaciar buffer de P2', () => hacer(['vaciar', 1]));
    ctl.boton('Al azar hasta el final', () => { while (!terminado(s)) { const a = acciones(s, tso); s = aplicar(s, a[Math.floor(rnd() * a.length)], tso); } dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => { s = estadoInicial(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 300 : 196) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'P1' }, { color: C.s2, texto: 'P2' },
      { color: C.s4, texto: 'escritura en un buffer, aún invisible para el otro' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija el próximo paso con los botones. Sin buffers, cada escritura va directo a la memoria compartida.');

    function hacer(a) {
      if (!acciones(s, tso).some((x) => x[0] === a[0] && x[1] === a[1])) {
        registro.textContent = a[0] === 'ejec' ? `${P(a[1])} ya ejecutó sus dos instrucciones.` : tso ? `El buffer de ${P(a[1])} está vacío.` : 'Sin buffers de escritura no hay nada que vaciar: marque la casilla.';
        return;
      }
      s = aplicar(s, a, tso);
      dibujar();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const cw = angosto ? (W - 24) / 2 : Math.min(240, W * 0.28);
      const cajas = [{ x: 8, y: 10 }, { x: W - 8 - cw, y: 10 }];
      const mem = angosto ? { x: W / 2 - 80, y: 196, w: 160, h: 90 } : { x: W / 2 - 90, y: 36, w: 180, h: 110 };
      const memPts = {};
      ['x', 'y'].forEach((v, i) => {
        memPts[v] = { x: mem.x + mem.w / 2, y: mem.y + 38 + i * 28 };
      });
      // Memoria
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.fillStyle = C.fondo2; ctx.fillRect(mem.x, mem.y, mem.w, mem.h); ctx.strokeRect(mem.x, mem.y, mem.w, mem.h);
      ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('memoria compartida', mem.x + mem.w / 2, mem.y + 14);
      ctx.font = VIZ.fuente(14, 500);
      for (const v of ['x', 'y']) ctx.fillText(`${v} = ${s.mem[v]}`, memPts[v].x, memPts[v].y);
      // Procesadores
      for (let p = 0; p < 2; p++) {
        const { x, y } = cajas[p], col = VIZ.series[p];
        const hh = angosto ? 176 : 172;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x, y, cw, hh);
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = col; ctx.textAlign = 'left';
        ctx.fillText(P(p), x + 10, y + 16);
        ctx.font = VIZ.fuente(13, 400);
        PROG[p].forEach(([op, v], j) => {
          const txt = op === 'W' ? `${v} ← 1` : `r${p + 1} ← ${v}`;
          const yy = y + 42 + j * 24;
          const hecho = s.pc[p] > j, actual = s.pc[p] === j;
          ctx.fillStyle = hecho ? C.tinta : actual ? C.tinta : C.apagado;
          ctx.fillText(`${actual ? '▸ ' : '  '}${txt}`, x + 10, yy);
          if (hecho) { ctx.fillStyle = C.apagado; ctx.fillText('✓', x + cw - 22, yy); }
        });
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 500);
        ctx.fillText(`r${p + 1} = ${s.r[p] == null ? '—' : s.r[p]}`, x + 10, y + 100);
        // Buffer
        const by = y + 120;
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 400);
        ctx.fillText(tso ? 'buffer de escritura' : 'sin buffer', x + 10, by);
        if (tso) {
          ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.strokeRect(x + 10, by + 10, cw - 20, 26);
          s.buf[p].forEach(([v, val], j) => {
            ctx.fillStyle = C.s4; ctx.fillRect(x + 14 + j * 56, by + 14, 50, 18);
            ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.fillText(`${v}=${val}`, x + 39 + j * 56, by + 23); ctx.textAlign = 'left';
          });
        }
        // Conexión con la memoria
        if (!angosto) {
          const ax = p === 0 ? x + cw : x, ay = y + 81;
          ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(p === 0 ? mem.x : mem.x + mem.w, mem.y + mem.h / 2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // Tabla de resultados alcanzables
      const res = explorar(tso), sc = explorar(false);
      const fila = (k) => {
        const n = res[k] || 0, prohibido = !sc[k];
        return el('tr', { class: terminado(s) && s.r.join(',') === k ? 'activa' : null },
          el('td', { class: 'izq' }, `r1 = ${k[0]}, r2 = ${k[2]}`),
          el('td', { style: { color: n ? (prohibido ? C.s8 : C.tinta) : C.apagado } }, n ? `${n} ${n === 1 ? 'ejecución' : 'ejecuciones'}` : 'imposible'),
          el('td', { class: 'izq' }, prohibido ? (n ? 'no es secuencialmente consistente' : 'prohibido por la consistencia secuencial') : 'permitido'));
      };
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th', { class: 'izq' }, 'resultado'), el('th', null, 'alcanzable'), el('th', { class: 'izq' }, '')),
        ['0,0', '0,1', '1,0', '1,1'].map(fila)));
      registro.textContent = s.log.length ? s.log[s.log.length - 1] + (terminado(s) ? `. Fin: (r1, r2) = (${s.r.join(', ')})${s.r[0] === 0 && s.r[1] === 0 ? ' — ¡ninguna intercalación secuencial produce esto!' : '.'}` : '.') : 'Ambos procesadores están listos para ejecutar su primera instrucción.';
      lectura.set([
        ['r1', s.r[0] == null ? '—' : String(s.r[0])],
        ['r2', s.r[1] == null ? '—' : String(s.r[1])],
        ['ejecuciones posibles', VIZ.entero(Object.values(res).reduce((a, v) => a + v, 0))],
        ['modelo', tso ? 'TSO' : 'secuencial'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('sequential-consistency', {
    intro: String.raw`
      <p>Cuando varios procesos leen y escriben datos compartidos (una memoria multiprocesador o un almacén replicado), hay que decir qué
      valores puede devolver una lectura. Ese contrato es el <strong>modelo de consistencia</strong>. El más intuitivo, propuesto por
      Lamport (1979), es la <strong>consistencia secuencial</strong>: el resultado debe ser el de <em>alguna</em> intercalación de las operaciones
      de todos los procesos en un único orden total, respetando el orden de programa de cada uno.</p>
      <p>No importa el tiempo real: una escritura puede «ocurrir» en el orden total después de una lectura que en el reloj vino más tarde. Lo
      único exigido es que todos los procesos estén de acuerdo en un mismo orden. Los procesadores modernos, por eficiencia, ni siquiera
      garantizan eso.</p>`,
    parametros: [
      ['Historia (Fig. 1)', String.raw`Cinco opciones: «Dos escrituras vistas igual», «Dos escrituras vistas distinto», «Buffers de escritura», «Paso de mensaje» y «Al azar». Cada una es una lista de operaciones por proceso, en orden de programa; algunas admiten un único orden total y otras no. Todas las variables parten en 0.`],
      ['Otra al azar (Fig. 1)', String.raw`Genera otra historia aleatoria de tres procesos (y fija el selector en «Al azar») para ver si admite o no un orden total.`],
      ['Con buffers de escritura (TSO, x86) (Fig. 2)', String.raw`Casilla desmarcada por omisión. Al marcarla (o desmarcarla) se reinicia la ejecución. Con buffers, cada escritura queda primero en el buffer de su procesador y solo se publica en la memoria al vaciarlo; sin ellos, cada escritura va directa a la memoria y el sistema es secuencialmente consistente.`],
      ['P1 ejecuta, P2 ejecuta, Vaciar buffer de P1, Vaciar buffer de P2 (Fig. 2)', String.raw`Eligen qué paso ocurre a continuación. «P1 ejecuta» y «P2 ejecuta» corren la siguiente instrucción de ese procesador (x ← 1 y luego r1 ← y, o y ← 1 y luego r2 ← x). «Vaciar buffer» publica en la memoria la escritura más antigua pendiente de ese procesador; solo tiene efecto con buffers y si hay algo pendiente (si no, el registro lo avisa).`],
      ['Al azar hasta el final y Reiniciar (Fig. 2)', String.raw`«Al azar hasta el final» completa la ejecución con pasos aleatorios (incluido vaciar buffers); «Reiniciar» vuelve al estado inicial, con las variables en 0.`],
    ],
    visualizaciones: [
      {
        titulo: 'Buscar un orden total',
        descripcion: 'Cada fila es un proceso y sus operaciones en orden de programa; el número tras el punto es la posición en el orden total encontrado. Cambie el valor de una lectura y observe cuándo deja de existir un orden.',
        ayuda: String.raw`<p>Cada fila es un proceso (P1, P2, …) con sus operaciones como cajas a lo largo del tiempo, en orden de programa; el color de las cajas identifica al proceso. Las escrituras W(x)v llevan relleno tenue y las lecturas R(x)v son cajas blancas, que se pueden cambiar con un clic (recorren los valores escritos para esa variable). Si existe un orden total válido, cada caja lleva al final «·k», su posición en él, y debajo se lista «Orden total:» con las operaciones en ese orden; si no, dice «no existe ningún orden total válido». La lectura indica si la historia es secuencial y causal, cuántas intercalaciones respetan el orden de programa y cuántas son legales (cada lectura devuelve la última escritura anterior).</p>
          <ul>
          <li><strong>Historia</strong>: «Dos escrituras vistas igual» tiene orden total; «Dos escrituras vistas distinto», «Buffers de escritura» y «Paso de mensaje» no, y la nota explica por qué.</li>
          <li><strong>Clic en una lectura</strong>: cambia el valor devuelto; rompe o restablece el orden total.</li>
          <li><strong>Otra al azar</strong>: la historia aleatoria puede o no ser secuencialmente consistente.</li>
          </ul>`,
        montar: montarHistoria,
      },
      {
        titulo: 'La prueba de buffers de escritura',
        descripcion: 'Dos procesadores escriben su variable y leen la del otro. Sin buffers, el resultado (0, 0) es imposible; con buffers de escritura, como en x86, aparece.',
        ayuda: String.raw`<p>A la izquierda el procesador P1 (borde azul) y a la derecha P2 (borde naranja), con sus dos instrucciones (marcadas con ▸ la siguiente y ✓ las hechas), el registro r1 o r2 y, con buffers, el contenido de su buffer de escritura (cajas amarillas, escrituras aún invisibles para el otro). En el centro, la memoria compartida con x e y. Debajo, una tabla de los cuatro resultados (r1, r2) con cuántas ejecuciones los alcanzan y si la consistencia secuencial los permite; la fila del resultado final se resalta, y el rojo marca los alcanzables solo con buffers. La lectura da r1, r2, el número de ejecuciones posibles y el modelo.</p>
          <ul>
          <li><strong>Con buffers de escritura</strong> desactivado: el resultado (0, 0) figura como imposible.</li>
          <li><strong>Con buffers de escritura</strong> activado: si ambos leen antes de vaciar sus buffers, el resultado es (0, 0), que ningún orden total explica; la tabla lo marca como no secuencialmente consistente.</li>
          <li><strong>Botones de paso</strong>: permiten armar a mano el intercalado; una lectura toma primero el valor de la propia escritura pendiente del procesador, si la hay.</li>
          </ul>`,
        montar: montarTSO,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una <strong>historia</strong> \(H\) es el conjunto de operaciones \(W(x)v\) y \(R(x)v\) de cada proceso, con su orden de programa \(\prec_i\).
      Una secuencia \(S\) de todas las operaciones es <strong>legal</strong> si cada lectura \(R(x)v\) devuelve el valor de la última \(W(x)\) que la
      precede en \(S\) (o el valor inicial).</p>
      <div class="recuadro"><p>\(H\) es <strong>secuencialmente consistente</strong> si existe una secuencia legal \(S\) que contiene todas sus
      operaciones y respeta todos los órdenes de programa: \(a \prec_i b \Rightarrow a\) precede a \(b\) en \(S\).</p></div>

      <h2>Verificación</h2>
      <p>La búsqueda de la figura prueba en profundidad las intercalaciones que respetan el orden de programa y poda cuando una lectura no ve la
      última escritura. Con \(n\) procesos de \(k\) operaciones hay</p>
      \[ \frac{(nk)!}{(k!)^n} \]
      <p>intercalaciones. Decidir si una historia es secuencialmente consistente es NP-completo en general (Gibbons y Korach, 1997), aunque
      se vuelve polinomial si cada lectura indica de qué escritura leyó y hay una sola variable.</p>

      <h2>Composición</h2>
      <p>La consistencia secuencial no es <em>local</em>: dos objetos que por separado son secuencialmente consistentes pueden no serlo juntos.
      La <a href="tema.html?id=linearizability">linealizabilidad</a> sí lo es, porque exige además respetar el tiempo real.</p>

      <h2>Buffers de escritura y TSO</h2>
      <p>En la prueba SB (<em>store buffering</em>):</p>
      <pre><code>P1:  x ← 1;  r1 ← y          P2:  y ← 1;  r2 ← x</code></pre>
      <p>En cualquier intercalación secuencial alguna escritura va primero, y la lectura del otro proceso, que va después de ella en su propio
      programa, la ve: \((r_1, r_2) = (0, 0)\) es imposible. En x86 (modelo TSO, <em>total store order</em>) cada núcleo tiene un buffer FIFO de
      escrituras; una lectura puede adelantarse a una escritura previa a otra dirección, y \((0, 0)\) ocurre de verdad. El algoritmo de Peterson
      y el de Dekker dejan de ser correctos. Las barreras de memoria (<code>mfence</code>) vacían el buffer y restauran el orden.</p>
      <table>
        <tr><th>Modelo</th><th>Orden que garantiza</th><th>Ejemplos</th></tr>
        <tr><td>Linealizable</td><td>Un orden total que respeta el tiempo real</td><td>Registros atómicos, etcd, Spanner</td></tr>
        <tr><td>Secuencial</td><td>Un orden total que respeta cada programa</td><td>Modelo de referencia</td></tr>
        <tr><td>TSO</td><td>Las escrituras en orden total; una lectura puede adelantar a una escritura</td><td>x86, SPARC</td></tr>
        <tr><td><a href="tema.html?id=causal-consistency">Causal</a></td><td>Solo el orden causal; escrituras concurrentes en cualquier orden</td><td>COPS, MongoDB con sesiones</td></tr>
      </table>`,
  });
})();
