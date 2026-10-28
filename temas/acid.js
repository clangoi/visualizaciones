(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  /* ---------- Fig. 1: planificaciones concurrentes ---------- */

  // T1 transfiere 100 de A a B; T2 aplica 10 % de interés a ambas cuentas.
  const OPS = {
    1: [['R', 'A'], ['W', 'A', (v) => v - 100, 'A − 100'], ['R', 'B'], ['W', 'B', (v) => v + 100, 'B + 100']],
    2: [['R', 'A'], ['W', 'A', (v) => Math.round(v * 1.1), 'A · 1,1'], ['R', 'B'], ['W', 'B', (v) => Math.round(v * 1.1), 'B · 1,1']],
  };
  // Cada planificación es una secuencia de [transacción, índice de operación].
  const PLANES = {
    serial12: { nombre: 'serial: T1 y luego T2', orden: [[1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]] },
    serial21: { nombre: 'serial: T2 y luego T1', orden: [[2, 0], [2, 1], [2, 2], [2, 3], [1, 0], [1, 1], [1, 2], [1, 3]] },
    buena: { nombre: 'intercalada serializable', orden: [[1, 0], [1, 1], [2, 0], [2, 1], [1, 2], [1, 3], [2, 2], [2, 3]] },
    mala: { nombre: 'intercalada no serializable', orden: [[1, 0], [1, 1], [2, 0], [2, 1], [2, 2], [2, 3], [1, 2], [1, 3]] },
    perdida: { nombre: 'actualización perdida', orden: [[1, 0], [2, 0], [1, 1], [2, 1], [1, 2], [1, 3], [2, 2], [2, 3]] },
  };
  const INICIAL = { A: 1000, B: 500 };
  function ejecutar(orden) {
    const db = { ...INICIAL }, loc = { 1: {}, 2: {} };
    for (const [t, i] of orden) {
      const [tipo, x, f] = OPS[t][i];
      if (tipo === 'R') loc[t][x] = db[x]; else db[x] = f(loc[t][x]);
    }
    return db;
  }
  const SERIALES = [ejecutar(PLANES.serial12.orden), ejecutar(PLANES.serial21.orden)];

  function montarPlanificacion(cuerpo) {
    let plan = 'mala', k = 0, db, loc, aristas, mensaje;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Planificación', valor: plan, opciones: Object.entries(PLANES).map(([c, p]) => [c, p.nombre]), alCambiar: (v) => { plan = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 560 ? 340 : 230) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'operación pendiente' },
      { color: C.s2, texto: 'operación actual' },
      { color: C.tinta, texto: 'ejecutada' },
      { color: C.s8, texto: 'arista de un ciclo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre una operación. Cada par en conflicto (misma cuenta, transacciones distintas, al menos una escritura) agrega una arista al grafo de precedencia.');

    function iniciar() {
      db = { ...INICIAL }; loc = { 1: {}, 2: {} }; aristas = new Map(); k = -1;
      mensaje = `A = ${INICIAL.A}, B = ${INICIAL.B}. T1 transfiere 100 de A a B; T2 suma 10 % de interés a ambas.`;
      return (function* () {
        const orden = PLANES[plan].orden;
        for (k = 0; k < orden.length; k++) {
          const [t, i] = orden[k], [tipo, x, f, txt] = OPS[t][i];
          // Conflictos con operaciones anteriores de la otra transacción.
          for (let j = 0; j < k; j++) {
            const [u, h] = orden[j], [tipo2, x2] = OPS[u][h];
            if (u !== t && x2 === x && (tipo === 'W' || tipo2 === 'W')) aristas.set(`${u}${t}`, `${tipo2}${u}(${x}) antes de ${tipo}${t}(${x})`);
          }
          if (tipo === 'R') { loc[t][x] = db[x]; mensaje = `R${t}(${x}): T${t} lee ${x} = ${db[x]}.`; }
          else {
            const nuevo = f(loc[t][x]);
            const pisa = loc[t][x] !== db[x];
            mensaje = `W${t}(${x}): T${t} escribe ${x} = ${txt.replace(x, loc[t][x])} = ${nuevo}.` + (pisa ? ` Usó un valor viejo: ${x} valía ${db[x]} en la base.` : '');
            db[x] = nuevo;
          }
          yield;
        }
        const ciclo = aristas.has('12') && aristas.has('21');
        const igual = SERIALES.findIndex((s) => s.A === db.A && s.B === db.B);
        mensaje = `Final: A = ${db.A}, B = ${db.B}. ` + (ciclo
          ? `El grafo tiene un ciclo: no es serializable por conflictos.${igual < 0 ? ' Y el resultado no coincide con ninguna ejecución serial.' : ''}`
          : `Grafo acíclico: equivale a la ejecución serial ${aristas.has('21') ? 'T2, T1' : 'T1, T2'}.`);
      })();
    }

    let geo = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const orden = PLANES[plan].orden;
      const angosto = W < 560;
      const anchoLinea = angosto ? W : W * 0.68;
      const x0 = 40, paso = (anchoLinea - x0 - 10) / orden.length, bw = Math.min(64, paso - 4), bh = 30;
      const fila = (t) => (t === 1 ? 40 : 100);
      B.texto(ctx, 'T1', 8, fila(1), { color: C.tinta, px: 12, peso: 600 });
      B.texto(ctx, 'T2', 8, fila(2), { color: C.tinta, px: 12, peso: 600 });
      B.texto(ctx, 'tiempo →', x0, 140, { color: C.apagado, px: 10 });
      geo = [];
      orden.forEach(([t, i], j) => {
        const [tipo, x, , txt] = OPS[t][i];
        const cx = x0 + j * paso + paso / 2, cy = fila(t);
        const col = j === k && !rep.terminado ? C.s2 : j < k || rep.terminado ? C.tinta : C.inactivo;
        B.caja(ctx, cx - bw / 2, cy - bh / 2, bw, bh, `${tipo}(${x})`, { borde: col, tinta: col, ancho: j === k ? 3 : 1.5, px: bw < 48 ? 10 : 12 });
        geo.push({ x: cx, y: cy, w: bw, h: bh, html: `<b>${tipo}${t}(${x})</b>${txt ? `<br>escribe ${txt}` : '<br>lectura'}` });
      });
      // Valores actuales de la base.
      B.texto(ctx, `A = ${db.A}    B = ${db.B}    A + B = ${db.A + db.B}`, x0, 168, { color: C.tinta, px: 13, peso: 500 });
      B.texto(ctx, `locales  T1: ${JSON.stringify(loc[1]).replace(/"/g, '')}   T2: ${JSON.stringify(loc[2]).replace(/"/g, '')}`, x0, 192, { px: 11 });
      // Grafo de precedencia.
      const gx = angosto ? W / 2 : anchoLinea + (W - anchoLinea) / 2, gy = angosto ? 290 : H / 2;
      const n1 = { x: gx - 50, y: gy }, n2 = { x: gx + 50, y: gy };
      B.texto(ctx, 'grafo de precedencia', gx, gy - 56, { alinear: 'center', color: C.apagado, px: 10 });
      const ciclo = aristas.has('12') && aristas.has('21');
      if (aristas.has('12')) {
        ctx.strokeStyle = ciclo ? C.s8 : C.tinta; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(n1.x + 16, n1.y - 8); ctx.quadraticCurveTo(gx, gy - 34, n2.x - 18, n2.y - 9); ctx.stroke();
        B.flecha(ctx, n2.x - 26, n2.y - 14, n2.x - 16, n2.y - 8, ciclo ? C.s8 : C.tinta, 2);
      }
      if (aristas.has('21')) {
        ctx.strokeStyle = ciclo ? C.s8 : C.tinta; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(n2.x - 16, n2.y + 8); ctx.quadraticCurveTo(gx, gy + 34, n1.x + 18, n1.y + 9); ctx.stroke();
        B.flecha(ctx, n1.x + 26, n1.y + 14, n1.x + 16, n1.y + 8, ciclo ? C.s8 : C.tinta, 2);
      }
      for (const [n, t] of [[n1, 'T1'], [n2, 'T2']]) {
        ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        B.texto(ctx, t, n.x, n.y, { alinear: 'center', color: C.tinta, px: 12, peso: 600 });
      }
      registro.textContent = mensaje;
      lectura.set([
        ['A + B', String(db.A + db.B)],
        ['serial T1, T2', `A ${SERIALES[0].A} · B ${SERIALES[0].B}`],
        ['serial T2, T1', `A ${SERIALES[1].A} · B ${SERIALES[1].B}`],
        ['aristas', [...aristas.keys()].map((a) => `T${a[0]}→T${a[1]}`).join(' ') || '—'],
      ]);
    }
    lienzo.alDibujar = () => db && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => Math.abs(x - q.x) <= q.w / 2 && Math.abs(y - q.y) <= q.h / 2);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, g.html);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: atomicidad ante una falla ---------- */

  function montarFalla(cuerpo) {
    let falla = 2, conTx = false;
    const PASOS = ['leer A', 'escribir A − 300', 'leer B', 'escribir B + 300', 'COMMIT'];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'La falla ocurre después del paso', min: 0, max: 5, valor: falla, formato: (v) => (v === 5 ? 'sin falla' : v === 0 ? 'antes de empezar' : `${v}: ${PASOS[v - 1]}`), alCambiar: (v) => { falla = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'dentro de una transacción con bitácora', valor: conTx, alCambiar: (v) => { conTx = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 220, altoMax: 280 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'saldo guardado en disco' },
      { color: C.apagado, texto: 'saldo antes de la transferencia', forma: 'linea' },
      { color: C.s8, texto: 'dinero que desapareció' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el punto de falla. Sin transacción, una caída entre los pasos 2 y 4 hace desaparecer $300.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      let A = 1000, B2 = 500;
      if (falla >= 2) A -= 300;
      if (falla >= 4) B2 += 300;
      const confirmada = falla >= 5;
      let recup = '';
      if (conTx && !confirmada) { A = 1000; B2 = 500; recup = 'Al reiniciar, la bitácora muestra la transacción sin COMMIT: se deshace (UNDO) y A vuelve a 1000.'; }
      const total = A + B2;
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 3, ymin: 0, ymax: 1600 }, { etiquetaY: 'saldo', ticksX: [], margen: { inf: 26 } });
      plano.ejes();
      const barras = [['A', A, 1000], ['B', B2, 500], ['A + B', total, 1500]];
      barras.forEach(([t, v, antes], i) => {
        const x = plano.sx(i + 0.5), w = Math.min(90, (plano.sx(1) - plano.sx(0)) * 0.5);
        ctx.fillStyle = C.s1;
        ctx.beginPath(); ctx.roundRect(x - w / 2, plano.sy(v), w, plano.sy(0) - plano.sy(v), [4, 4, 0, 0]); ctx.fill();
        if (i === 2 && v < antes) { ctx.fillStyle = VIZ.alfa(C.s8, 0.35); ctx.fillRect(x - w / 2, plano.sy(antes), w, plano.sy(v) - plano.sy(antes)); }
        ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, plano.sy(antes)); ctx.lineTo(x + w / 2 + 8, plano.sy(antes)); ctx.stroke(); ctx.setLineDash([]);
        B.texto(ctx, `${t} = ${v}`, x, plano.sy(v) - 10, { alinear: 'center', color: C.tinta, px: 12, peso: 500 });
        B.texto(ctx, t, x, H - 12, { alinear: 'center', px: 11 });
      });
      registro.textContent = falla === 5 ? 'Sin falla: la transferencia termina y A + B se conserva.'
        : falla < 2 ? 'La falla ocurre antes de escribir nada: no hay daño.'
          : conTx ? recup
            : falla < 4 ? 'Sin transacción: A ya se debitó en disco pero B no alcanzó a acreditarse. Se perdieron $300.'
              : 'Ambas escrituras alcanzaron a llegar al disco: el resultado es correcto aunque faltara el COMMIT.';
      lectura.set([['A', String(A)], ['B', String(B2)], ['A + B', String(total)], ['invariante A + B = 1500', total === 1500 ? 'se cumple' : 'violado']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('acid', {
    intro: String.raw`
      <p>Una <strong>transacción</strong> es una secuencia de lecturas y escrituras que la base trata como una unidad lógica: transferir
      dinero son dos UPDATE, pero para el banco es un solo hecho. Las siglas <strong>ACID</strong> resumen lo que el motor garantiza.</p>
      <p><strong>A</strong>tomicidad: se hace todo o nada. <strong>C</strong>onsistencia: si la transacción respeta las reglas, la base pasa
      de un estado válido a otro válido. a<strong>I</strong>slamiento: aunque muchas transacciones corran a la vez, el resultado es como si
      corrieran de a una. <strong>D</strong>urabilidad: lo confirmado sobrevive a una caída.</p>`,
    visualizaciones: [
      {
        titulo: 'Planificaciones y serializabilidad',
        descripcion: 'Dos transacciones intercaladas de distintas formas. Compare el resultado de cada planificación con las dos ejecuciones seriales y mire si el grafo de precedencia tiene ciclo.',
        montar: montarPlanificacion,
      },
      {
        titulo: 'Atomicidad ante una caída',
        descripcion: 'Una transferencia de $300 de A a B que se interrumpe. Sin transacción el dinero puede desaparecer; con bitácora, la recuperación deshace lo incompleto.',
        montar: montarFalla,
      },
    ],
    teoria: String.raw`
      <h2>Planificaciones</h2>
      <p>Una <strong>planificación</strong> (<em>schedule</em>) es un intercalado de las operaciones de varias transacciones que respeta el
      orden dentro de cada una. Es <strong>serial</strong> si no intercala, y <strong>serializable</strong> si su efecto es el de alguna
      planificación serial.</p>
      <p>Dos operaciones están <strong>en conflicto</strong> si son de transacciones distintas, tocan el mismo dato y al menos una escribe.
      Intercambiar dos operaciones adyacentes que no están en conflicto no cambia el resultado.</p>
      <div class="recuadro"><strong>Teorema.</strong> Una planificación es serializable por conflictos si y solo si su <em>grafo de
      precedencia</em> (una arista \(T_i \to T_j\) por cada conflicto en que \(T_i\) va primero) es acíclico. Un orden topológico del grafo da
      la ejecución serial equivalente.</div>

      <h2>Anomalías</h2>
      <table>
        <tr><th>Anomalía</th><th>Patrón</th><th>La evita</th></tr>
        <tr><td>lectura sucia</td><td>\(W_1(x)\, R_2(x)\), y luego T1 aborta</td><td>READ COMMITTED</td></tr>
        <tr><td>lectura no repetible</td><td>\(R_1(x)\, W_2(x)\, R_1(x)\)</td><td>REPEATABLE READ</td></tr>
        <tr><td>actualización perdida</td><td>\(R_1(x)\, R_2(x)\, W_1(x)\, W_2(x)\)</td><td>REPEATABLE READ</td></tr>
        <tr><td>fantasma</td><td>un INSERT cambia el resultado de un predicado ya leído</td><td>SERIALIZABLE</td></tr>
      </table>

      <h2>Bloqueo en dos fases</h2>
      <p>El protocolo más clásico para obtener serializabilidad. Cada transacción pide un bloqueo compartido (S) para leer y exclusivo (X)
      para escribir, y</p>
      <pre><code>fase de crecimiento:  pedir bloqueos, no liberar ninguno
fase de decrecimiento: liberar bloqueos, no pedir ninguno</code></pre>
      <p>Toda planificación que cumple 2PL es serializable por conflictos: el instante en que cada transacción tiene todos sus bloqueos
      (su <em>punto de bloqueo</em>) ordena las transacciones. La versión <em>estricta</em> libera los X recién en el COMMIT, para evitar
      abortos en cascada. El precio son las esperas y los <em>deadlocks</em>, que el motor detecta con un grafo de espera y resuelve
      abortando una víctima.</p>

      <h2>Atomicidad y durabilidad</h2>
      <p>Las garantiza el gestor de <a href="tema.html?id=recuperacion">recuperación</a>: cada cambio se anota en una bitácora antes de
      llegar a los datos, de modo que tras una caída se puede rehacer lo confirmado y deshacer lo que no alcanzó a confirmarse.</p>`,
  });
})();
