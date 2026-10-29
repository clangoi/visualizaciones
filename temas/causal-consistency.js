(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;

  const h = (...procs) => procs.flatMap((ops, p) => ops.map((s, j) => {
    const m = s.match(/^([WR])\((\w)\)(\d+)$/);
    return { p, tipo: m[1], x: m[2], v: +m[3], t0: j * 1.1, t1: j * 1.1 + 0.9 };
  }));

  const EJEMPLOS = {
    viola: {
      nombre: 'Causa vista después del efecto',
      ops: () => h(['W(x)1'], ['R(x)1', 'W(x)2'], ['R(x)2', 'R(x)1'], ['R(x)1', 'R(x)2']),
      nota: 'P2 escribió 2 después de leer 1, así que W(x)1 → W(x)2. P3 las ve al revés: no es causal (ni secuencial).',
    },
    concurrentes: {
      nombre: 'Escrituras concurrentes',
      ops: () => h(['W(x)1'], ['W(x)2'], ['R(x)2', 'R(x)1'], ['R(x)1', 'R(x)2']),
      nota: 'W(x)1 y W(x)2 son concurrentes: cada proceso puede verlas en un orden distinto. Es causal pero no secuencial.',
    },
    mensaje: {
      nombre: 'Paso de mensaje',
      ops: () => h(['W(x)1', 'W(y)1'], ['R(y)1', 'R(x)0']),
      nota: 'P2 leyó y = 1, que P1 escribió después de x = 1; esa lectura hace que W(x)1 sea causa de R(x)0. No es causal.',
    },
    transitiva: {
      nombre: 'Cadena de tres procesos',
      ops: () => h(['W(x)1'], ['R(x)1', 'W(y)1'], ['R(y)1', 'R(x)1']),
      nota: 'W(x)1 → R(x)1 → W(y)1 → R(y)1: cuando P3 ve y = 1 ya debe ver x = 1. Es causal (y secuencial).',
    },
    azar: { nombre: 'Al azar', ops: null },
  };

  function azar(semilla) {
    const rnd = VIZ.semilla(semilla);
    const procs = [], sig = { x: 1, y: 1 }, escritos = { x: [0], y: [0] };
    for (let p = 0; p < 3; p++) {
      const ops = [];
      for (let j = 0; j < 2 + (rnd() < 0.5 ? 1 : 0); j++) {
        const x = rnd() < 0.5 ? 'x' : 'y';
        if (rnd() < 0.45) { ops.push(`W(${x})${sig[x]}`); escritos[x].push(sig[x]); sig[x]++; } else ops.push(`R(${x})?`);
      }
      procs.push(ops);
    }
    return h(...procs.map((ops) => ops.map((s) => (s.endsWith('?') ? s.replace('?', String(escritos[s[2]][Math.floor(rnd() * escritos[s[2]].length)])) : s))));
  }

  /* ---------- Fig. 1: historias causales ---------- */

  function montarHistoria(cuerpo) {
    const est = { ej: 'viola', semilla: 3 };
    let ops, nProc = 4, cajas = [];
    const ctl = VIZ.controles(cuerpo);
    const selHist = ctl.selector({ etiqueta: 'Historia', valor: est.ej, opciones: Object.entries(EJEMPLOS).map(([k, e]) => [k, e.nombre]),
      alCambiar: (v) => { est.ej = v; cargar(); } });
    ctl.boton('Otra al azar', () => { est.ej = 'azar'; selHist.valor = 'azar'; est.semilla++; cargar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => Math.max(150, nProc * 52 + 34) });
    lienzo.canvas.style.cursor = 'pointer';
    const ley = VIZ.leyenda(cuerpo, []);
    VIZ.subtitulo(cuerpo, 'Lo que ve cada proceso: todas las escrituras más sus propias operaciones, en un orden que respeta la causalidad.');
    const vistas = el('div');
    cuerpo.appendChild(vistas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una lectura R para cambiar el valor que devolvió. Todas las variables empiezan en 0.');

    function cargar() {
      const e = EJEMPLOS[est.ej];
      ops = e.ops ? e.ops() : azar(est.semilla * 61);
      nProc = Math.max(...ops.map((o) => o.p)) + 1;
      lienzo.ajustar(true);
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const res = D.causal(ops, nProc);
      const seq = D.secuencial(ops);
      const leida = D.escrituraLeida(ops);
      const maxJ = Math.max(...ops.map((o) => o.t1));
      const geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: nProc }, (_, p) => P(p)), t: [-0.15, Math.max(maxJ + 0.25, 4.2)], sup: 26, inf: 20,
        colorProceso: (p) => (res.ordenes[p] ? C.tinta : C.s8),
        intervalos: ops.map((o) => ({
          p: o.p, t0: o.t0, t1: o.t1, color: C.tinta, relleno: o.tipo === 'W' ? C.neutro : C.superficie, texto: D.textoOp(o), grosor: o.tipo === 'R' ? 2 : 1.5,
        })),
      });
      cajas = ops.map((o) => ({ x0: geo.x(o.t0), x1: geo.x(o.t1), y: geo.y(o.p) }));
      // Relación «escribe en»: de cada escritura a las lecturas que la leen.
      leida.forEach((w, i) => {
        if (w == null || w < 0) return;
        const a = cajas[w], b = cajas[i];
        const misma = ops[w].p === ops[i].p;
        D.flecha(ctx, (a.x0 + a.x1) / 2, a.y + (b.y > a.y ? 9 : -9), (b.x0 + b.x1) / 2, b.y + (b.y > a.y ? -9 : 9),
          { color: C.s3, ancho: 1.8, guiones: [5, 3], curva: misma ? 24 : 0 });
      });
      ley.set([
        { color: C.neutro, borde: C.tinta, texto: 'escritura' },
        { color: C.superficie, borde: C.tinta, texto: 'lectura (clic para cambiar)' },
        { color: C.s3, texto: 'escribe en (de qué escritura lee)', forma: 'linea' },
        { color: C.s8, texto: 'proceso sin vista causal válida', forma: 'cuadro' },
      ]);
      vistas.replaceChildren();
      for (let p = 0; p < nProc; p++) {
        const tira = VIZ.grafo.estructura(vistas, `Vista de ${P(p)}:`);
        const orden = res.ordenes[p];
        tira.set(orden ? orden.map((i) => ({ texto: D.textoOp(ops[i]), color: ops[i].p === p ? C.tinta : C.eje, tinta: ops[i].p === p ? C.tinta : C.tinta2 }))
          : [{ texto: 'no existe', color: C.s8, tinta: C.s8 }]);
      }
      const e = EJEMPLOS[est.ej];
      const original = e.ops && JSON.stringify(e.ops()) === JSON.stringify(ops);
      const malos = res.ordenes.map((o, p) => (o ? null : P(p))).filter(Boolean);
      registro.textContent = original ? e.nota
        : res.ciclo ? 'El orden causal tiene un ciclo (una lectura depende de una escritura posterior en su propio proceso): no es causal.'
          : res.ok ? `Causal: cada proceso tiene una vista legal que respeta la causalidad.${seq ? ' También es secuencial.' : ' Pero no secuencial: las vistas no coinciden en un orden único.'}`
            : `No es causal: ${malos.join(', ')} no ${malos.length > 1 ? 'pueden' : 'puede'} ordenar las escrituras respetando la causalidad.`;
      lectura.set([
        ['causal', res.ok ? 'sí' : 'no'],
        ['secuencial', seq ? 'sí' : 'no'],
        ['pares causales', String(res.relacion.flat().filter(Boolean).length)],
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

  /* ---------- Fig. 2: entrega causal en réplicas ---------- */

  const REPLICAS = ['A', 'B', 'C'];

  // envios: [{ r, t }] instantes de publicación; demora(m, destino) da la latencia de la red.
  function simular(envios, demora, causal) {
    const n = REPLICAS.length;
    const entregados = REPLICAS.map(() => []), buffer = REPLICAS.map(() => []);
    const msgs = [], entregas = [], cola = [];
    envios.forEach((e, k) => cola.push({ t: e.t, tipo: 'envio', r: e.r, k }));
    const deps = [];
    const entregar = (r, k, t, llegada) => {
      const anomalia = !deps[k].every((d) => entregados[r].includes(d));
      entregados[r].push(k);
      entregas.push({ r, k, t, llegada, anomalia });
    };
    const procesar = (r, t) => {
      let hubo = true;
      while (hubo) {
        hubo = false;
        for (const b of buffer[r]) {
          if (deps[b.k].every((d) => entregados[r].includes(d))) {
            buffer[r].splice(buffer[r].indexOf(b), 1);
            entregar(r, b.k, t, b.llegada);
            hubo = true;
            break;
          }
        }
      }
    };
    for (let g = 0; g < 500 && cola.length; g++) {
      cola.sort((a, b) => a.t - b.t || (a.tipo === 'llegada' ? -1 : 1));
      const ev = cola.shift();
      if (ev.tipo === 'envio') {
        deps[ev.k] = entregados[ev.r].slice();
        msgs[ev.k] = { k: ev.k, r: ev.r, t: ev.t, deps: deps[ev.k] };
        entregar(ev.r, ev.k, ev.t, ev.t);
        for (let q = 0; q < n; q++) if (q !== ev.r) cola.push({ t: ev.t + demora(ev.k, q), tipo: 'llegada', r: q, k: ev.k, de: ev.r, t0: ev.t });
      } else {
        msgs[ev.k].llegadas = msgs[ev.k].llegadas || [];
        msgs[ev.k].llegadas.push({ r: ev.r, t: ev.t });
        if (!causal || deps[ev.k].every((d) => entregados[ev.r].includes(d))) { entregar(ev.r, ev.k, ev.t, ev.t); if (causal) procesar(ev.r, ev.t); }
        else buffer[ev.r].push({ k: ev.k, llegada: ev.t });
      }
    }
    const tMax = Math.max(...entregas.map((e) => e.t), ...msgs.flatMap((m) => (m.llegadas || []).map((l) => l.t))) + 0.6;
    return { msgs, entregas, tMax };
  }

  const CLASICO = {
    envios: [{ r: 0, t: 0.6 }, { r: 1, t: 3 }],
    demoras: { '0-1': 1.2, '0-2': 6, '1-0': 1.2, '1-2': 1.2 },
    textos: ['«Perdí mi gato»', '«¡Qué pena!»'],
  };

  function montarReplicas(cuerpo) {
    const est = { esc: 'clasico', causal: false, semilla: 2 };
    let datos, sim, tAct = 0, pasos = [];
    const ctl = VIZ.controles(cuerpo);
    const selEsc = ctl.selector({ etiqueta: 'Escenario', valor: est.esc, opciones: [['clasico', 'Publicación y respuesta'], ['azar', 'Seis mensajes al azar']],
      alCambiar: (v) => { est.esc = v; nuevo(); } });
    ctl.casilla({ etiqueta: 'Entrega causal (relojes vectoriales)', valor: est.causal, alCambiar: (v) => { est.causal = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Nuevos datos', () => { est.semilla++; est.esc = 'azar'; selEsc.valor = 'azar'; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 230 : 250) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'mensaje en la red', forma: 'linea' },
      { color: C.s4, texto: 'retenido hasta tener sus causas', forma: 'linea' },
      { color: C.tinta, texto: 'entrega', forma: 'punto' },
      { color: C.s8, texto: 'entrega antes que una causa (anomalía)', forma: 'punto' },
    ]);
    const vistas = el('div');
    cuerpo.appendChild(vistas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada réplica difunde sus mensajes a las otras dos. Un mensaje depende de todo lo que su réplica ya había mostrado al publicarlo.');

    function nuevo() {
      if (est.esc === 'clasico') datos = { envios: CLASICO.envios, demora: (k, q) => CLASICO.demoras[`${CLASICO.envios[k].r}-${q}`], textos: CLASICO.textos };
      else {
        const rnd = VIZ.semilla(est.semilla * 89);
        const envios = Array.from({ length: 6 }, (_, k) => ({ r: Math.floor(rnd() * 3), t: 0.5 + k * 1.3 + rnd() * 0.8 }));
        const tabla = envios.map(() => REPLICAS.map(() => 0.6 + rnd() * rnd() * 7));
        datos = { envios, demora: (k, q) => tabla[k][q], textos: null };
      }
      rep.reiniciar();
    }

    function iniciar() {
      sim = simular(datos.envios, datos.demora, est.causal);
      pasos = [...new Set([...sim.entregas.map((e) => e.t), ...sim.msgs.flatMap((m) => (m.llegadas || []).map((l) => l.t))])].sort((a, b) => a - b);
      tAct = 0;
      return (function* () { for (const t of pasos) { tAct = t; yield; } tAct = sim.tMax; })();
    }

    const nombre = (k) => `m${k + 1}`;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ent = sim.entregas.filter((e) => e.t <= tAct + 1e-9);
      const mensajes = [];
      for (const m of sim.msgs) for (const l of m.llegadas || []) {
        if (m.t > tAct) continue;
        mensajes.push({ p0: m.r, t0: m.t, p1: l.r, t1: l.t, color: C.s1, ancho: 1.6, hasta: l.t > tAct ? tAct : null, texto: l.r === (m.r + 1) % 3 ? nombre(m.k) : null, colorTexto: C.s1 });
      }
      const geo = D.espacioTiempo(lienzo, {
        procesos: REPLICAS, t: [0, Math.max(sim.tMax, 8)], ahora: tAct < sim.tMax ? tAct : null, sup: 28, inf: 26,
        mensajes,
        eventos: ent.map((e) => ({ p: e.r, t: e.t, relleno: e.anomalia ? C.s8 : C.tinta, texto: nombre(e.k), colorTexto: e.anomalia ? C.s8 : C.tinta, r: 4.5 })),
      });
      // Retenciones: tramo amarillo desde la llegada hasta la entrega (o hasta ahora).
      ctx.save();
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const m of sim.msgs) for (const l of m.llegadas || []) {
        if (l.t > tAct) continue;
        const e = sim.entregas.find((x) => x.r === l.r && x.k === m.k);
        const fin = Math.min(e ? e.t : tAct, tAct);
        if (fin - l.t < 1e-6) continue;
        ctx.strokeStyle = VIZ.alfa(C.s4, 0.75);
        ctx.beginPath(); ctx.moveTo(geo.x(l.t), geo.y(l.r)); ctx.lineTo(geo.x(fin), geo.y(l.r)); ctx.stroke();
      }
      ctx.restore();
      vistas.replaceChildren();
      REPLICAS.forEach((r, i) => {
        const tira = VIZ.grafo.estructura(vistas, `Pantalla de ${r}:`);
        tira.set(ent.filter((e) => e.r === i).map((e) => ({
          texto: datos.textos ? `${nombre(e.k)} ${datos.textos[e.k]}` : nombre(e.k),
          color: e.anomalia ? C.s8 : C.tinta, tinta: e.anomalia ? C.s8 : C.tinta,
        })), 'nada aún');
      });
      const anom = ent.filter((e) => e.anomalia);
      const ultimo = ent.length ? ent[ent.length - 1] : null;
      const retenidos = sim.entregas.filter((e) => e.t - e.llegada > 1e-6);
      if (tAct >= sim.tMax) {
        registro.textContent = anom.length
          ? `Sin entrega causal hubo ${anom.length} anomalía${anom.length > 1 ? 's' : ''}: alguna réplica mostró una respuesta antes del mensaje al que responde.`
          : est.causal ? `Ninguna anomalía. Se retuvieron ${retenidos.length} entrega${retenidos.length === 1 ? '' : 's'} hasta que llegaron sus causas.` : 'Esta vez la red entregó todo en un orden compatible con la causalidad.';
      } else if (ultimo && Math.abs(ultimo.t - tAct) < 1e-9) {
        const m = sim.msgs[ultimo.k];
        registro.textContent = ultimo.r === m.r
          ? `${REPLICAS[m.r]} publica ${nombre(m.k)}${m.deps.length ? `, que depende de ${m.deps.map(nombre).join(', ')}` : ''}.`
          : `${REPLICAS[ultimo.r]} entrega ${nombre(ultimo.k)}${ultimo.anomalia ? ` sin haber entregado ${m.deps.filter((d) => !ent.some((e) => e.r === ultimo.r && e.k === d && e.t <= ultimo.t)).map(nombre).join(', ')}: anomalía.` : ultimo.t > ultimo.llegada ? ' que estaba retenido: ya llegaron sus causas.' : '.'}`;
      } else registro.textContent = est.causal ? 'Un mensaje llega pero sus causas aún no: queda retenido.' : 'Los mensajes viajan por la red.';
      lectura.set([
        ['tiempo', VIZ.fmt(Math.min(tAct, sim.tMax), 3)],
        ['entregas', `${ent.length} de ${sim.entregas.length}`],
        ['anomalías', String(anom.length)],
        ['retenidos', String(retenidos.filter((e) => e.t <= tAct).length)],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    nuevo();
  }

  VIZ.registrarTema('causal-consistency', {
    intro: String.raw`
      <p>La <a href="tema.html?id=sequential-consistency">consistencia secuencial</a> obliga a todos a ver las escrituras en un mismo orden,
      y eso exige coordinación costosa entre réplicas. La <strong>consistencia causal</strong> (Ahamad et al., 1995) pide menos: solo las
      escrituras relacionadas causalmente deben verse en el mismo orden por todos. Dos escrituras concurrentes, que nadie relacionó,
      pueden aparecer en órdenes distintos en distintas réplicas.</p>
      <p>Es el modelo que evita las anomalías que notan las personas: ver una respuesta antes de la pregunta, o un comentario en una foto
      que todavía no aparece. Y, a diferencia de la consistencia fuerte, se puede implementar sin bloquear aunque la red se particione.</p>`,
    visualizaciones: [
      {
        titulo: 'Historias causales',
        descripcion: 'Las flechas aguamarina dicen de qué escritura leyó cada lectura; junto con el orden de programa forman el orden causal. Bajo el diagrama, la vista de cada proceso.',
        montar: montarHistoria,
      },
      {
        titulo: 'Entrega causal en réplicas',
        descripcion: 'En «Publicación y respuesta», C recibe la respuesta de B antes que la publicación de A. Active la entrega causal: C la retiene (tramo amarillo) hasta tener la publicación.',
        montar: montarReplicas,
      },
    ],
    teoria: String.raw`
      <h2>Orden causal de una historia</h2>
      <p>Para operaciones sobre registros, la causalidad potencial \(\leadsto\) es la clausura transitiva de:</p>
      <ul>
        <li><strong>orden de programa:</strong> \(a\) antes que \(b\) en el mismo proceso;</li>
        <li><strong>escribe en:</strong> \(a = W(x)v\) y \(b = R(x)v\) lee ese valor.</li>
      </ul>
      <p>Es la versión, para memoria compartida, de la relación <a href="tema.html?id=lamport-clocks">ocurre antes</a> de Lamport.</p>
      <div class="recuadro"><p>Una historia es <strong>causalmente consistente</strong> si para cada proceso \(P_i\) existe una secuencia legal
      formada por todas las escrituras y todas las operaciones de \(P_i\) que respeta \(\leadsto\).</p></div>
      <p>Cada proceso tiene su propia vista; lo que se exige es que ninguna vista invierta un par causal. La consistencia secuencial pide una sola
      vista para todos, así que secuencial \(\Rightarrow\) causal, pero no al revés.</p>

      <h2>Implementación: entrega causal</h2>
      <p>Cada réplica \(i\) lleva un vector \(V_i\), donde \(V_i[j]\) cuenta los mensajes de \(j\) ya entregados. Al difundir, adjunta su vector;
      la réplica \(k\) que recibe un mensaje \(m\) de \(j\) con vector \(W\) lo <strong>retiene</strong> hasta que</p>
      \[ W[j] = V_k[j] + 1 \quad\text{y}\quad W[l] \le V_k[l] \ \ \forall l \ne j, \]
      <p>es decir, hasta que \(m\) sea el siguiente de \(j\) y \(k\) haya entregado todo lo que \(j\) conocía al enviarlo
      (Birman, Schiper y Stephenson, 1991). Luego entrega y hace \(V_k[j] \leftarrow V_k[j] + 1\).</p>
      <pre><code>al recibir (m, W) de j:
    agregar a la cola de retenidos
    mientras haya (m', W') de j' retenido con W'[j'] = V[j'] + 1 y W'[l] ≤ V[l] ∀ l ≠ j':
        entregar m';  V[j'] ← V[j'] + 1</code></pre>
      <p>Retener nunca bloquea para siempre si los canales son confiables: las causas de \(m\) fueron enviadas antes y terminan llegando.</p>

      <h2>Por qué es importante</h2>
      <p>Por el teorema CAP, un sistema que debe seguir respondiendo durante una partición de la red no puede ser linealizable. La consistencia
      causal es, en un sentido preciso, el modelo más fuerte alcanzable con disponibilidad total y latencia baja (Mahajan, Alvisi y Dahlin, 2011).
      Sistemas como COPS, Eiger y las sesiones causales de MongoDB la ofrecen, a menudo combinada con las garantías
      <a href="tema.html?id=client-centric-consistency">centradas en el cliente</a>, que son sus piezas para una sola sesión.</p>`,
  });
})();
