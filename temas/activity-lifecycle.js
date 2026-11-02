(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  function fecha(min) {
    const t = Math.round(min) + 480, d = Math.floor(t / 1440), r = t % 1440;
    return `${DIAS[d % 7]} ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  }
  function tabla(cabecera, filas) {
    const caja = VIZ.el('div', { class: 'caja-desplazable caja-alta' });
    const t = VIZ.el('table', { class: 'tabla-datos sin-corte' });
    t.appendChild(VIZ.el('thead', null, VIZ.el('tr', null, cabecera.map((h) => VIZ.el('th', h.clase ? { class: h.clase } : null, h.texto || h)))));
    const tb = VIZ.el('tbody');
    for (const f of filas) {
      tb.appendChild(VIZ.el('tr', { class: f.activa ? 'activa' : null },
        f.c.map((c) => VIZ.el('td', c && c.clase ? { class: c.clase } : null, c && c.texto !== undefined ? c.texto : c))));
    }
    t.appendChild(tb);
    caja.appendChild(t);
    return caja;
  }
  const ORDEN = { schedule: 0, start: 1, complete: 2 };
  const MODOS = [
    ['complete', 'Solo complete (eventos atómicos)'],
    ['start', 'start + complete'],
    ['schedule', 'schedule + start + complete'],
  ];

  /* ---------- Fig. 1: emparejar start y complete ---------- */

  function montarEmparejar(cuerpo) {
    let caso = 1, modo = 'schedule', semilla = 21, items = [], evs = [], paso = 0, abiertas = [], planif = [], pares = [], actual = null, hover = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Caso', min: 1, max: 6, valor: caso, alCambiar: (v) => { caso = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Eventos registrados por actividad', opciones: MODOS, valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 44 + Math.max(items.length, 3) * 26 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'espera: de schedule a start', forma: 'cuadro' },
      { color: C.s1, texto: 'servicio: de start a complete', forma: 'cuadro' },
      { color: C.s2, texto: 'evento que se procesa ahora', forma: 'punto' },
      { color: C.tinta, texto: 'evento atómico (solo complete)', forma: 'punto' },
    ]);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const zonaTabla = VIZ.el('div');
    cuerpo.appendChild(zonaTabla);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija cuántos tipos de evento se registran y avance con el reproductor: cada start espera su complete (se empareja por nombre de actividad). Con solo complete es imposible separar espera y servicio. En la primera actividad no se conoce cuándo se habilitó, así que su espera se toma como cero.');

    function iniciar() {
      const log = P.simular(P.procesos.pedidos.arbol, 6, semilla, { espera: 18, llegada: 120 });
      const c = log[caso - 1];
      items = c.eventos.map((e, i) => ({ i, act: e.act, sched: i ? c.eventos[i - 1].fin : e.ini, ini: e.ini, fin: e.fin, recurso: e.recurso }));
      const tipos = modo === 'complete' ? ['complete'] : modo === 'start' ? ['start', 'complete'] : ['schedule', 'start', 'complete'];
      evs = [];
      for (const it of items) for (const tp of tipos) evs.push({ tp, i: it.i, t: tp === 'schedule' ? it.sched : tp === 'start' ? it.ini : it.fin, act: it.act, recurso: it.recurso });
      evs.sort((a, b) => a.t - b.t || ORDEN[a.tp] - ORDEN[b.tp] || a.i - b.i);
      paso = 0; abiertas = []; planif = []; pares = []; actual = null;
      lienzo.ajustar(true);
      return (function* () {
        for (const e of evs) {
          actual = e; paso++;
          if (e.tp === 'schedule') planif.push(e);
          else if (e.tp === 'start') {
            const k = planif.findIndex((x) => x.act === e.act);
            const sc = k >= 0 ? planif.splice(k, 1)[0] : null;
            abiertas.push({ ...e, espera: sc ? e.t - sc.t : null, sched: sc ? sc.t : null });
          } else if (e.tp === 'complete') {
            const k = abiertas.findIndex((x) => x.act === e.act);
            if (k >= 0) { const s = abiertas.splice(k, 1)[0]; pares.push({ i: e.i, act: e.act, ini: s.t, fin: e.t, servicio: e.t - s.t, espera: s.espera }); }
            else pares.push({ i: e.i, act: e.act, ini: null, fin: e.t, servicio: null, espera: null });
          }
          yield;
        }
        actual = null;
      })();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (!items.length) return;
      const izq = Math.min(112, W * 0.3), der = 10, sup = 6, fila = 26;
      const t0 = Math.min(...items.map((x) => x.sched)), t1 = Math.max(...items.map((x) => x.fin));
      const sx = (t) => izq + (t - t0) / (t1 - t0) * (W - izq - der);
      const ahora = actual ? actual.t : t0;
      geo = [];
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      items.forEach((it, i) => {
        const y = sup + i * fila + fila / 2;
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(izq, y); ctx.lineTo(W - der, y); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left';
        const nombre = it.act.length > 15 && izq < 110 ? it.act.slice(0, 14) + '…' : it.act;
        ctx.fillText(nombre, 2, y);
        const par = pares.find((p) => p.i === i);
        const ab = abiertas.find((a) => a.i === i);
        const pl = planif.find((a) => a.i === i);
        // Espera (solo si se registra schedule) y servicio, según el estado de la instancia.
        const hasta = (t) => sx(Math.min(ahora, t));
        if (modo === 'schedule') {
          if (pl) { ctx.fillStyle = VIZ.alfa(C.s4, 0.5); ctx.fillRect(sx(it.sched), y - 7, Math.max(2, hasta(it.ini) - sx(it.sched)), 14); }
          else if (ab && ab.sched !== null) { ctx.fillStyle = C.s4; ctx.fillRect(sx(ab.sched), y - 7, Math.max(2, sx(ab.t) - sx(ab.sched)), 14); }
          else if (par && par.espera !== null) { ctx.fillStyle = C.s4; ctx.fillRect(sx(par.ini - par.espera), y - 7, Math.max(2, sx(par.ini) - sx(par.ini - par.espera)), 14); }
        }
        if (modo !== 'complete') {
          if (par && par.ini !== null) { ctx.fillStyle = C.s1; ctx.fillRect(sx(par.ini), y - 7, Math.max(2, sx(par.fin) - sx(par.ini)), 14); }
          else if (ab) {
            ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
            ctx.strokeRect(sx(ab.t) + 0.5, y - 6.5, Math.max(2, hasta(it.fin) - sx(ab.t)), 13); ctx.setLineDash([]);
          }
        }
        if (par) geo.push({ x0: sx(par.ini === null ? par.fin : par.ini - (par.espera || 0)), x1: sx(par.fin), y, it, par });
        // Marcas de los eventos ya procesados.
        for (const e of evs.slice(0, paso)) {
          if (e.i !== i) continue;
          const filtrar = modo === 'complete' ? e.tp === 'complete' : true;
          if (!filtrar) continue;
          const esAct = e === actual;
          ctx.fillStyle = esAct ? C.s2 : C.tinta;
          ctx.beginPath();
          if (modo === 'complete') ctx.arc(sx(e.t), y, esAct ? 6 : 4.5, 0, 2 * Math.PI); else ctx.arc(sx(e.t), y, esAct ? 4.5 : 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      // Cursor de tiempo.
      if (actual) { ctx.strokeStyle = C.s2; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(sx(ahora), sup); ctx.lineTo(sx(ahora), sup + items.length * fila); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
      const yEje = sup + items.length * fila + 12;
      const nt = Math.max(1, Math.floor((W - izq) / 95));
      for (let k = 0; k <= nt; k++) { const t = t0 + (t1 - t0) * k / nt; ctx.fillText(fecha(t), Math.min(Math.max(sx(t), izq + 24), W - 30), yEje); }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

      fichas.replaceChildren(
        VIZ.el('span', { class: 'fichas-titulo' }, 'Start sin complete:'),
        ...(modo === 'complete' ? [VIZ.el('span', { class: 'fichas-vacio' }, 'no hay eventos start')]
          : abiertas.length ? abiertas.map((a) => VIZ.ficha(a.act, { color: C.s1 })) : [VIZ.el('span', { class: 'fichas-vacio' }, 'ninguno')]));
      zonaTabla.replaceChildren(tabla(
        ['#', 'Hora', 'Transición', 'Actividad'].map((t, i) => ({ texto: t, clase: i >= 2 ? 'izq' : null })),
        evs.map((e, k) => ({ activa: k === paso - 1, c: [String(k + 1), fecha(e.t), { texto: e.tp, clase: 'izq' }, { texto: e.act, clase: 'izq' }] }))));

      const con = pares.filter((p) => p.servicio !== null);
      const esp = pares.filter((p) => p.espera !== null);
      registro.textContent = !actual
        ? (paso ? 'Se procesaron todos los eventos.' : 'Pulse «Un paso» para leer el primer evento.')
        : actual.tp === 'schedule' ? `${fecha(actual.t)}: «${actual.act}» queda programada (schedule): está lista pero nadie la ha empezado.`
          : actual.tp === 'start' ? `${fecha(actual.t)}: comienza «${actual.act}» (start)${abiertas[abiertas.length - 1] && abiertas[abiertas.length - 1].espera !== null ? `; esperó ${P.dur(abiertas[abiertas.length - 1].espera)} desde que se programó` : ''}. Queda abierta hasta su complete.`
            : modo === 'complete' ? `${fecha(actual.t)}: «${actual.act}» (complete). Sin start no se sabe cuándo empezó: lo único medible es el tiempo desde el evento anterior.`
              : `${fecha(actual.t)}: termina «${actual.act}» (complete); se empareja con su start y la duración de servicio es ${P.dur(pares[pares.length - 1].servicio)}.`;
      const gaps = modo === 'complete' ? items.slice(1).map((x, i) => x.fin - items[i].fin) : [];
      lectura.set([
        ['eventos leídos', `${paso} de ${evs.length}`],
        ['actividades emparejadas', modo === 'complete' ? 'no aplica' : `${con.length} de ${items.length}`],
        ['servicio medio', modo === 'complete' ? 'no se puede medir' : con.length ? P.dur(P.media(con.map((p) => p.servicio))) : '—'],
        ['espera media', modo === 'schedule' ? (esp.length ? P.dur(P.media(esp.map((p) => p.espera))) : '—') : 'no se puede medir'],
        ['entre complete consecutivos', modo === 'complete' && paso === evs.length ? P.dur(P.media(gaps)) + ' (espera + servicio)' : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((b) => x >= b.x0 - 2 && x <= b.x1 + 2 && Math.abs(y - b.y) <= 9);
      if (!g) return tip.ocultar();
      const p = g.par;
      tip.mostrar(x, y, `<b>${p.act}</b><br>` + (p.servicio === null ? `complete ${fecha(p.fin)}<br>sin start: duración desconocida`
        : `start ${fecha(p.ini)} · complete ${fecha(p.fin)}<br>servicio <b>${P.dur(p.servicio)}</b>` + (p.espera !== null ? `<br>espera <b>${P.dur(p.espera)}</b>` : '')));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: actividades en paralelo y orden observado ---------- */

  function montarParalelo(cuerpo) {
    let inicioB = 12, durB = 14, cursor = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Inicio de «Emitir factura» (min)', min: 0, max: 50, valor: inicioB, alCambiar: (v) => { inicioB = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Duración de «Emitir factura» (min)', min: 4, max: 40, valor: durB, alCambiar: (v) => { durB = v; dibujar(); } });
    ctl.boton('Ejemplo: anidada', () => { inicioB = 12; durB = 14; sync(); }, { primario: true });
    ctl.boton('Ejemplo: secuencial', () => { inicioB = 34; durB = 10; sync(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 172 });
    const tip = VIZ.tooltip(lienzo);
    const sliders = ctl.caja.querySelectorAll('input[type=range]');
    function sync() { sliders[0].value = inicioB; sliders[1].value = durB; sliders.forEach((s) => s.dispatchEvent(new Event('input'))); }
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'Preparar envío (30 min)', forma: 'cuadro' },
      { color: C.s2, texto: 'Emitir factura', forma: 'cuadro' },
      { color: C.s3, texto: 'Despachar', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Preparar envío dura 30 minutos desde el minuto 0; Despachar empieza 4 minutos después de que ambas terminen. Mueva el inicio y la duración de Emitir factura. Haga clic en la línea de tiempo para fijar un instante y ver qué actividades están en curso.');

    const ACT = (A) => [
      { n: 'Preparar envío', a: 0, b: 30, c: C.s1 },
      { n: 'Emitir factura', a: A.inicioB, b: A.inicioB + A.durB, c: C.s2 },
      { n: 'Despachar', a: Math.max(30, A.inicioB + A.durB) + 4, b: Math.max(30, A.inicioB + A.durB) + 14, c: C.s3 },
    ];
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const acts = ACT({ inicioB, durB });
      const izq = Math.min(104, W * 0.28), der = 12, sup = 6, fila = 30, tmax = Math.ceil((acts[2].b + 4) / 10) * 10;
      const sx = (t) => izq + t / tmax * (W - izq - der);
      geo = { sx, izq, der, tmax, acts, sup, fila };
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      acts.forEach((a, i) => {
        const y = sup + i * fila + fila / 2;
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(izq, y); ctx.lineTo(W - der, y); ctx.stroke();
        ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.fillText(a.n.length > 14 && izq < 100 ? a.n.slice(0, 13) + '…' : a.n, 2, y);
        ctx.fillStyle = a.c; ctx.fillRect(sx(a.a), y - 8, Math.max(2, sx(a.b) - sx(a.a)), 16);
        ctx.fillStyle = C.tinta;
        for (const [t, r] of [[a.a, 3], [a.b, 4.5]]) { ctx.beginPath(); ctx.arc(sx(t), y, r, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5; ctx.stroke(); }
      });
      // Eje.
      ctx.fillStyle = C.apagado; ctx.textAlign = 'center';
      const yEje = sup + 3 * fila + 12;
      for (let t = 0; t <= tmax; t += 10) ctx.fillText(String(t), sx(t), yEje);
      ctx.textAlign = 'right'; ctx.fillText('min', W - 2, yEje + 12); ctx.textAlign = 'start';
      if (cursor !== null) {
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sx(cursor), sup); ctx.lineTo(sx(cursor), sup + 3 * fila); ctx.stroke(); ctx.setLineDash([]);
      }
      // Secuencias observadas.
      const porFin = acts.slice().sort((x, z) => x.b - z.b).map((a) => a.n), porInicio = acts.slice().sort((x, z) => x.a - z.a).map((a) => a.n);
      const letras = (s) => s.map((n) => ({ 'Preparar envío': 'P', 'Emitir factura': 'F', Despachar: 'D' }[n])).join(' ');
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 500);
      const yy = sup + 3 * fila + 38;
      ctx.fillText('Registro solo con complete:  ' + letras(porFin), 2, yy);
      ctx.fillText('Registro ordenado por start: ' + letras(porInicio), 2, yy + 18);
      ctx.textBaseline = 'alphabetic';
      const [P_, F_] = [acts[0], acts[1]];
      const solapan = F_.a < P_.b && P_.a < F_.b;
      const antes = P_.b <= F_.a ? 'Preparar → Emitir' : 'Emitir → Preparar';
      const cobertura = cursor === null ? null : acts.filter((a) => a.a <= cursor && cursor < a.b);
      registro.textContent = solapan
        ? `Preparar envío y Emitir factura se solapan ${VIZ.fmt(Math.min(P_.b, F_.b) - Math.max(P_.a, F_.a), 3)} min: son concurrentes. Con eventos atómicos el registro las muestra en orden «${letras(porFin)}», que parece una relación causal que no existe.`
        : `No se solapan: ${antes} es una relación real de sucesión; ambos registros coinciden (${letras(porFin)}).`;
      if (cobertura) registro.textContent += ` En el minuto ${VIZ.fmt(cursor, 3)} están en curso: ${cobertura.length ? cobertura.map((a) => a.n).join(' y ') : 'ninguna'}.`;
      lectura.set([
        ['solape P y F', solapan ? VIZ.fmt(Math.min(P_.b, F_.b) - Math.max(P_.a, F_.a), 3) + ' min' : 'ninguno'],
        ['orden por complete', letras(porFin)],
        ['orden por start', letras(porInicio)],
        ['orden de ambos coincide', porFin.join() === porInicio.join() ? 'sí' : 'no'],
        ['concurrencia máxima', String(Math.max(...Array.from({ length: Math.ceil(tmax * 4) }, (_, k) => acts.filter((a) => a.a <= k / 4 && k / 4 < a.b).length)))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || x < geo.izq) { cursor = null; return dibujar(); }
      cursor = Math.max(0, Math.min(geo.tmax, (x - geo.izq) / (lienzo.ancho - geo.izq - geo.der) * geo.tmax));
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = Math.floor((y - geo.sup) / geo.fila);
      const a = geo.acts[i];
      if (a && y < geo.sup + 3 * geo.fila && x >= geo.sx(a.a) - 3 && x <= geo.sx(a.b) + 3) tip.mostrar(x, y, `<b>${a.n}</b><br>start ${VIZ.fmt(a.a, 3)} min<br>complete ${VIZ.fmt(a.b, 3)} min<br>duración ${VIZ.fmt(a.b - a.a, 3)} min`);
      else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('activity-lifecycle', {
    intro: String.raw`
      <p>Muchos sistemas registran un solo evento por actividad, normalmente su finalización. Otros guardan el <strong>ciclo de vida</strong> completo:
      la actividad se <em>programa</em> (<code>schedule</code>), se <em>inicia</em> (<code>start</code>), puede <em>suspenderse</em> y <em>reanudarse</em>, y finalmente se
      <em>completa</em> (<code>complete</code>). Cada transición es un evento con su propia marca de tiempo.</p>
      <p>Esa información extra vale mucho: permite reconstruir <strong>cuánto duró</strong> una actividad, <strong>cuánto esperó</strong> antes de empezar y <strong>qué actividades se
      solaparon</strong>. Sin ella, la espera y el trabajo real se mezclan en un solo número y el paralelismo se confunde con una sucesión.</p>`,
    visualizaciones: [
      {
        titulo: 'Emparejar start y complete',
        descripcion: 'Ejecute el emparejamiento evento por evento con los tres niveles de detalle. Con solo complete no hay duraciones; al agregar start y luego schedule aparecen primero el servicio y después la espera.',
        montar: montarEmparejar,
      },
      {
        titulo: 'Actividades en paralelo',
        descripcion: 'Mueva el inicio y la duración de «Emitir factura» hasta que quede anidada dentro de «Preparar envío»: el registro con solo complete invierte su orden y sugiere una causalidad falsa.',
        montar: montarParalelo,
      },
    ],
    teoria: String.raw`
      <h2>Transiciones de ciclo de vida</h2>
      <p>El estándar XES define un atributo <code>lifecycle:transition</code> con un modelo de estados: una instancia de actividad pasa por
      <em>schedule</em> → <em>start</em> → <em>complete</em>, con posibles desvíos a <em>suspend</em>/<em>resume</em>, <em>abort</em> (<em>ate_abort</em>) o
      <em>skip</em>. Un registro puede ser <strong>atómico</strong> (una transición por instancia, casi siempre <em>complete</em>) o tener <strong>eventos con duración</strong>
      (al menos <em>start</em> y <em>complete</em>).</p>

      <h2>Reconstrucción de intervalos</h2>
      <p>Para una instancia \(x\) de la actividad \(a\) con eventos \(s_x\) (<em>schedule</em>), \(b_x\) (<em>start</em>) y \(e_x\) (<em>complete</em>):</p>
      \[ \text{espera}(x) = b_x - s_x, \qquad \text{servicio}(x) = e_x - b_x, \qquad \text{tiempo de actividad}(x) = e_x - s_x. \]
      <pre><code>abiertas ← lista vacía
para cada evento e en orden de tiempo:
    si e es start:    abiertas ← abiertas · e
    si e es complete: s ← primer start abierto con la misma actividad
                      abiertas ← abiertas − s
                      duración ← t(e) − t(s)</code></pre>
      <p>La regla «primer start abierto con el mismo nombre» (FIFO) es una heurística: si dos instancias de la misma actividad están abiertas en un mismo caso, el emparejamiento es ambiguo
      y conviene que el sistema registre un identificador de instancia.</p>

      <h2>Paralelismo e intervalos</h2>
      <p>Dos instancias con intervalos \([b_1,e_1]\) y \([b_2,e_2]\) son <strong>concurrentes</strong> si se solapan: \(b_1 &lt; e_2 \;\wedge\; b_2 &lt; e_1\). Si el registro solo conserva
      <em>complete</em>, ordenar por fin impone un orden total que puede contradecir la realidad: dos actividades anidadas (\(b_1 &lt; b_2 &lt; e_2 &lt; e_1\)) se verían como \(a_2 \to a_1\).
      Los algoritmos de descubrimiento tratan entonces como causal lo que es paralelo (ver <a href="tema.html?id=alpha-limitations">límites del algoritmo Alfa</a>).</p>
      <p>Con ciclo de vida completo se puede separar tiempo de espera y de servicio, base de los análisis de
      <a href="tema.html?id=waiting-and-service-time">espera y servicio</a> y de los <a href="tema.html?id=bottleneck-analysis">cuellos de botella</a>. También es el tipo de dato que más
      cuesta obtener: ver <a href="tema.html?id=event-log-quality">extracción y calidad</a>, y cómo aparece cada evento en el <a href="tema.html?id=event-logs">registro</a>.</p>`,
  });
})();
