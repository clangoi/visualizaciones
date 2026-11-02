(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const PROCESOS = [['reclamos', P.procesos.reclamos.nombre], ['pedidos', P.procesos.pedidos.nombre]];

  // Variantes con su ciclo medio y su contribución al tiempo total de todos los casos.
  function analizarVariantes(log) {
    const vs = P.variantes(log);
    const total = log.reduce((s, c) => s + P.tiempoCiclo(c), 0), media = total / log.length;
    vs.forEach((v, i) => {
      v.idx = i + 1;
      v.ciclos = v.casos.map(P.tiempoCiclo);
      v.media = P.media(v.ciclos);
      v.total = v.ciclos.reduce((s, x) => s + x, 0);
      v.parteTiempo = v.total / total;
      v.parteCasos = v.n / log.length;
      v.exceso = v.n * (v.media - media);
    });
    return { vs, total, media, n: log.length };
  }
  const nombre = (v) => `V${v.idx} · ${v.n} casos · ${P.dur(v.media)}`;
  function fichasTraza(cont, titulo, traza, color) {
    cont.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, titulo), ...traza.map((a) => VIZ.ficha(a, { color })));
  }
  function recortar(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 3 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  }

  /* ---------- Fig. 1: frecuencia frente a tiempo de ciclo ---------- */

  function montarDispersion(cuerpo) {
    let proceso = 'reclamos', n = 400, semilla = 1, logX = true, sel = 1;
    let an = null, vs = [], plano = null, pts = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; sel = 1; calcular(); } });
    ctl.rango({ etiqueta: 'Casos', min: 200, max: 1000, paso: 100, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.casilla({ etiqueta: 'Frecuencia en escala logarítmica', valor: logX, alCambiar: (v) => { logX = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'variante igual o más rápida que el promedio' },
      { color: C.s2, texto: 'variante más lenta que el promedio' },
      { color: C.tinta, texto: 'seleccionada (el tamaño indica su parte del tiempo total)', forma: 'punto' },
      { color: C.apagado, texto: 'ciclo medio global', forma: 'linea' },
    ]);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada círculo es una variante (secuencia de actividades distinta). Haga clic en un círculo o en una fila de la tabla para ver su traza. Busque variantes arriba del promedio y grandes: no son las más frecuentes, pero explican la lentitud.');

    function calcular() {
      an = analizarVariantes(P.simular(P.procesos[proceso].arbol, n, semilla, { espera: 12, llegada: 25 }));
      vs = an.vs.slice(0, 12);
      if (sel > vs.length) sel = 1;
      const tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ['variante', 'casos', '% casos', 'ciclo medio', 'vs promedio', '% del tiempo'].map((t, i) => VIZ.el('th', { class: i ? null : 'izq' }, t))),
        ...vs.map((v) => VIZ.el('tr', { class: 'clicable', 'data-v': v.idx },
          VIZ.el('td', { class: 'izq' }, 'V' + v.idx), VIZ.el('td', null, String(v.n)), VIZ.el('td', null, VIZ.fmt(100 * v.parteCasos, 3)),
          VIZ.el('td', null, P.dur(v.media)), VIZ.el('td', null, (v.media >= an.media ? '+' : '') + VIZ.fmt(v.media - an.media, 3) + ' min'), VIZ.el('td', null, VIZ.fmt(100 * v.parteTiempo, 3)))));
      tabla.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-v]'); if (tr) { sel = +tr.dataset.v; dibujar(); } });
      caja.replaceChildren(tabla);
      dibujar();
    }
    function dibujar() {
      if (!an) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const fmax = Math.max(...vs.map((v) => v.parteCasos)) * 100, fmin = Math.min(...vs.map((v) => v.parteCasos)) * 100;
      const ymax = Math.max(...vs.map((v) => v.media), an.media) * 1.12, ymin = Math.min(...vs.map((v) => v.media), an.media) * 0.85;
      const tx = (f) => (logX ? Math.log10(f) : f);
      const d = logX ? { xmin: tx(Math.max(0.05, fmin * 0.5)), xmax: tx(fmax * 1.5) } : { xmin: 0, xmax: fmax * 1.1 };
      const ticksX = logX ? [0.1, 0.3, 1, 3, 10, 30, 100].filter((f) => tx(f) >= d.xmin && tx(f) <= d.xmax).map(tx) : null;
      plano = VIZ.plano(lienzo, { ...d, ymin, ymax }, {
        etiquetaX: 'casos de la variante (%)', etiquetaY: 'ciclo medio (min)', ticksX: ticksX || undefined,
        formatoX: (v) => VIZ.fmt(logX ? Math.pow(10, v) : v, 2), formatoY: (v) => VIZ.fmt(v, 3),
      });
      plano.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath();
      ctx.moveTo(plano.x0, plano.sy(an.media)); ctx.lineTo(plano.x1, plano.sy(an.media)); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`promedio ${P.dur(an.media)}`, plano.x1 - 4, plano.sy(an.media) - 3);
      pts = vs.map((v) => ({ v, x: plano.sx(tx(v.parteCasos * 100)), y: plano.sy(v.media), r: 5 + 24 * Math.sqrt(v.parteTiempo) }));
      pts.slice().sort((a, b) => b.r - a.r).forEach((p) => {
        ctx.fillStyle = VIZ.alfa(p.v.media > an.media ? C.s2 : C.s1, 0.75);
        ctx.strokeStyle = p.v.idx === sel ? C.tinta : C.superficie; ctx.lineWidth = p.v.idx === sel ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (p.r > 9) ctx.fillText('V' + p.v.idx, p.x, p.y + 0.5);
      });
      for (const tr of caja.querySelectorAll('tr[data-v]')) tr.classList.toggle('activa', +tr.dataset.v === sel);
      const v = vs[sel - 1];
      fichasTraza(fichas, `V${v.idx}:`, v.traza, v.media > an.media ? C.s2 : C.s1);
      const lentas = vs.filter((q) => q.exceso > 0), masTiempo = vs.slice().sort((a, b) => b.parteTiempo - a.parteTiempo)[0];
      const peorExc = vs.slice().sort((a, b) => b.exceso - a.exceso)[0];
      lectura.set([
        ['variantes distintas', String(an.vs.length)],
        ['las 3 más frecuentes', `${VIZ.fmt(100 * an.vs.slice(0, 3).reduce((s, q) => s + q.parteCasos, 0), 3)} % de los casos`],
        ['ciclo medio global', P.dur(an.media)],
        ['más tiempo total', `V${masTiempo.idx} (${VIZ.fmt(100 * masTiempo.parteTiempo, 3)} %)`],
        ['mayor exceso sobre el promedio', `V${peorExc.idx} (+${VIZ.fmt(peorExc.exceso / 60, 3)} h·caso)`],
        ['variantes más lentas', `${lentas.length} de ${vs.length}`],
      ]);
      registro.textContent = `V${v.idx}: ${v.n} casos (${VIZ.fmt(100 * v.parteCasos, 3)} %), ciclo medio ${P.dur(v.media)} (${v.media >= an.media ? '+' : ''}${VIZ.fmt(v.media - an.media, 3)} min frente al promedio) y ${VIZ.fmt(100 * v.parteTiempo, 3)} % del tiempo total consumido.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return { x, y, p: pts.slice().sort((a, b) => a.r - b.r).find((q) => Math.hypot(q.x - x, q.y - y) <= q.r + 2) }; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, p } = bajo(ev);
      if (!p) return tip.ocultar();
      const v = p.v;
      tip.mostrar(x, y, `<b>V${v.idx}</b> · ${v.traza.length} actividades<br>casos <b>${v.n}</b> (${VIZ.fmt(100 * v.parteCasos, 3)} %)` +
        VIZ.filaTooltip(v.media > an.media ? C.s2 : C.s1, 'ciclo medio', P.dur(v.media)) + `<div>parte del tiempo total <b>${VIZ.fmt(100 * v.parteTiempo, 3)} %</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const { p } = bajo(ev); if (p) { sel = p.v.idx; dibujar(); } });
    calcular();
  }

  /* ---------- Fig. 2: dos variantes, actividad por actividad ---------- */

  // Tiempo medio por caso en cada actividad (servicio + espera previa) para una variante.
  function porActividad(v) {
    const m = new Map();
    for (const c of v.casos) c.eventos.forEach((e, k) => {
      if (!m.has(e.act)) m.set(e.act, { serv: 0, esp: 0, veces: 0 });
      const r = m.get(e.act); r.serv += e.fin - e.ini; r.veces++;
      if (k) r.esp += e.ini - c.eventos[k - 1].fin;
    });
    for (const r of m.values()) { r.serv /= v.n; r.esp /= v.n; r.veces /= v.n; r.tot = r.serv + r.esp; }
    return m;
  }

  function montarComparacion(cuerpo) {
    let proceso = 'reclamos', semilla = 1, ia = 0, ib = 0, orden = 'flujo', sel = '';
    let an = null, vs = [], filas = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; calcular(true); } });
    const selA = ctl.selector({ etiqueta: 'Variante A', opciones: [['0', '—']], valor: '0', alCambiar: (v) => { ia = +v; armar(); } });
    const selB = ctl.selector({ etiqueta: 'Variante B', opciones: [['0', '—']], valor: '0', alCambiar: (v) => { ib = +v; armar(); } });
    ctl.selector({ etiqueta: 'Ordenar por', opciones: [['flujo', 'orden en el flujo'], ['diferencia', 'diferencia B − A']], valor: orden, alCambiar: (v) => { orden = v; armar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(true); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 76 + 40 * Math.max(1, filas.length) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'variante A: tiempo medio en la actividad' },
      { color: C.s2, texto: 'variante B' },
    ]);
    const fA = VIZ.el('div', { class: 'fichas' }), fB = VIZ.el('div', { class: 'fichas' });
    cuerpo.append(fA, fB);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija dos variantes y mire en qué actividades difieren: cada fila es el tiempo medio por caso (servicio más espera previa) y a la derecha va la diferencia B − A. Haga clic en una fila para ver su detalle.');

    function calcular(reponer) {
      an = analizarVariantes(P.simular(P.procesos[proceso].arbol, 600, semilla, { espera: 12, llegada: 25 }));
      vs = an.vs.slice(0, 10);
      const opciones = vs.map((v, i) => [String(i), nombre(v)]);
      for (const s of [selA, selB]) s.select.replaceChildren(...opciones.map(([v, t]) => VIZ.el('option', { value: v }, t)));
      if (reponer) {
        ia = 0;
        ib = vs.map((v, i) => [v, i]).filter(([, i]) => i !== 0).sort((a, b) => b[0].media - a[0].media)[0][1];
      }
      selA.valor = String(ia); selB.valor = String(ib);
      sel = '';
      armar();
    }
    function armar() {
      const A = vs[ia], B = vs[ib], mA = porActividad(A), mB = porActividad(B);
      const nombres = [...new Set([...A.traza, ...B.traza])];
      filas = nombres.map((a) => ({ act: a, a: mA.get(a) || null, b: mB.get(a) || null, d: ((mB.get(a) || { tot: 0 }).tot) - ((mA.get(a) || { tot: 0 }).tot) }));
      if (orden === 'diferencia') filas.sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
      fichasTraza(fA, 'A:', A.traza, C.s1); fichasTraza(fB, 'B:', B.traza, C.s2);
      lienzo.ajustar(true);
    }
    function dibujar() {
      if (!filas.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      ctx.font = VIZ.fuente(11);
      const xe = Math.min(140, W * 0.34), xd = W - (W < 520 ? 60 : 78), top = 8, h = 40;
      const mx = Math.max(...filas.map((f) => Math.max(f.a ? f.a.tot : 0, f.b ? f.b.tot : 0))) * 1.05 || 1;
      const sx = (v) => xe + v / mx * (xd - xe);
      for (const v of VIZ.ticks(0, mx, Math.max(2, Math.floor((xd - xe) / 80)))) {
        const x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + filas.length * h); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(VIZ.fmt(v, 3), x, top + filas.length * h + 5);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('minutos por caso', xd, top + filas.length * h + 36);
      ctx.fillText('B − A', W - 6, top + filas.length * h + 36);
      geo = [];
      filas.forEach((f, i) => {
        const y = top + i * h;
        if (f.act === sel) { ctx.fillStyle = C.neutro; ctx.fillRect(0, y, W, h); }
        [[f.a, C.s1, 6], [f.b, C.s2, 21]].forEach(([r, c, dy]) => {
          if (r) { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(xe, y + dy - 3, Math.max(1, sx(r.tot) - xe), 12, [0, 4, 4, 0]); ctx.fill(); }
          else { ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('—', xe + 6, y + dy + 3); }
        });
        ctx.fillStyle = f.act === sel ? C.tinta : C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, f.act, xe - 12), xe - 8, y + h / 2);
        ctx.fillStyle = Math.abs(f.d) < 0.5 ? C.apagado : f.d > 0 ? C.s2 : C.s1; ctx.font = VIZ.fuente(11, 600);
        ctx.fillText((f.d > 0 ? '+' : '') + VIZ.fmt(f.d, 2), W - 6, y + h / 2);
        ctx.font = VIZ.fuente(11);
        geo.push({ f, y0: y, y1: y + h });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(xe + 0.5, top); ctx.lineTo(xe + 0.5, top + filas.length * h); ctx.stroke();
      const A = vs[ia], B = vs[ib], dc = B.media - A.media;
      const suma = filas.reduce((s, f) => s + f.d, 0);
      const mayor = filas.slice().sort((p, q) => Math.abs(q.d) - Math.abs(p.d))[0];
      lectura.set([
        ['ciclo medio A', P.dur(A.media)],
        ['ciclo medio B', P.dur(B.media)],
        ['diferencia B − A', `${dc >= 0 ? '+' : ''}${VIZ.fmt(dc, 3)} min`],
        ['suma de diferencias', `${suma >= 0 ? '+' : ''}${VIZ.fmt(suma, 3)} min`],
        ['actividad que más difiere', `${mayor.act} (${mayor.d >= 0 ? '+' : ''}${VIZ.fmt(mayor.d, 2)} min)`],
      ]);
      const g = filas.find((f) => f.act === sel);
      registro.textContent = g
        ? `${g.act}: A ${g.a ? `${VIZ.fmt(g.a.veces, 2)} vez/veces por caso, servicio ${VIZ.fmt(g.a.serv, 3)} + espera ${VIZ.fmt(g.a.esp, 3)} min` : 'no la ejecuta'}; B ${g.b ? `${VIZ.fmt(g.b.veces, 2)} vez/veces por caso, servicio ${VIZ.fmt(g.b.serv, 3)} + espera ${VIZ.fmt(g.b.esp, 3)} min` : 'no la ejecuta'}.`
        : `La suma de las diferencias por actividad (${VIZ.fmt(suma, 3)} min) es la diferencia de ciclo entre B y A (${VIZ.fmt(dc, 3)} min): cada minuto de más se atribuye a una actividad.`;
    }
    const fila = (e) => { const { y } = lienzo.posicion(e); return geo.find((g) => y >= g.y0 && y < g.y1); };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const g = fila(e), { x, y } = lienzo.posicion(e);
      if (!g) return tip.ocultar();
      const t = (r) => (r ? `servicio <b>${VIZ.fmt(r.serv, 3)}</b> + espera <b>${VIZ.fmt(r.esp, 3)}</b> = <b>${VIZ.fmt(r.tot, 3)}</b> min` : 'no la ejecuta');
      tip.mostrar(x, y, `<b>${g.f.act}</b>` + VIZ.filaTooltip(C.s1, 'A', t(g.f.a)) + VIZ.filaTooltip(C.s2, 'B', t(g.f.b)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (e) => { const g = fila(e); sel = g && g.f.act !== sel ? g.f.act : ''; dibujar(); });
    calcular(true);
  }

  VIZ.registrarTema('variant-performance', {
    intro: String.raw`
      <p>Un registro de eventos se agrupa en <strong>variantes</strong>: casos que ejecutan exactamente la misma secuencia de actividades. Cada variante tiene su propio tiempo de ciclo. Comparar frecuencia y tiempo de ciclo por variante revela algo que el promedio general oculta: la lentitud rara vez está repartida de manera pareja.</p>
      <p>Las variantes más frecuentes son el camino “normal”; las lentas suelen ser reprocesos, excepciones o rutas con muchas esperas. Lo que importa para actuar es la <em>contribución al tiempo total</em>: una variante rara y muy lenta puede pesar menos que una moderadamente lenta pero común.</p>`,
    visualizaciones: [
      {
        titulo: 'Frecuencia frente a tiempo de ciclo',
        descripcion: 'Cada círculo es una variante: posición horizontal, su frecuencia; vertical, su ciclo medio; tamaño, su parte del tiempo total. Busque círculos naranjos y grandes, y cambie a escala lineal para ver cómo la frecuencia domina la imagen.',
        montar: montarDispersion,
      },
      {
        titulo: 'Dos variantes, actividad por actividad',
        descripcion: 'Elija dos variantes y compare cuánto tiempo pasa cada una en cada actividad. Ordene por diferencia para ver primero lo que explica la brecha, y compruebe que la suma de diferencias iguala la diferencia de ciclos.',
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea \(V\) el conjunto de variantes de un registro de \(N\) casos, y para cada \(v\in V\) sean \(n_v\) sus casos y \(\bar T_v\) su tiempo de ciclo medio. Entonces</p>
      \[ \bar T = \frac1N\sum_{v} n_v\,\bar T_v, \qquad \text{contribución}(v) = \frac{n_v\,\bar T_v}{\sum_{u} n_u\,\bar T_u}, \qquad \text{exceso}(v)= n_v\,(\bar T_v - \bar T). \]
      <p>Los excesos suman cero: \(\sum_v \text{exceso}(v)=0\). Las variantes con exceso positivo son las que “empujan” el promedio hacia arriba, y su exceso mide cuántos minutos·caso se pierden respecto del promedio.</p>
      <h2>Frecuente no es lo mismo que costosa</h2>
      <p>La variante más frecuente tiene la mayor contribución solo si su \(\bar T_v\) no es bajo. Una variante con 5 % de los casos pero tres veces el ciclo medio aporta cerca de 15 % del tiempo total: por unidad de caso, es mucho más costosa. Como en un diagrama de Pareto, conviene ordenar por contribución o por exceso, no por frecuencia.</p>
      <h2>Comparar dos variantes</h2>
      <p>Para cada actividad \(a\), el tiempo medio por caso de la variante \(v\) es \(\tau_v(a) = \tfrac1{n_v}\sum_{c\in v}\sum_{i:\,a_i=a}(s_i\text{ servicio}+w_i\text{ espera previa})\). Como los tiempos de servicio y espera cubren exactamente el ciclo (salvo la espera del primer evento, que no se registra),</p>
      \[ \bar T_B-\bar T_A = \sum_a \bigl(\tau_B(a)-\tau_A(a)\bigr), \]
      <p>de modo que la diferencia de ciclo se reparte, sin residuo, entre las actividades; las de mayor diferencia absoluta explican la brecha.</p>
      <pre><code>variantes ← agrupar casos por secuencia de actividades
para cada variante v:
    T̄_v ← media de ciclos de sus casos
    contribución_v ← n_v · T̄_v / Σ_u n_u · T̄_u
ordenar por contribución (o por exceso) descendente
comparar A y B: Δ(a) ← τ_B(a) − τ_A(a) para cada actividad a</code></pre>
      <div class="recuadro">Con pocos casos por variante, el ciclo medio es ruidoso: una variante de tres casos puede parecer lenta por azar. Revise siempre \(n_v\) y la dispersión antes de concluir.</div>
      <h2>Conexiones</h2>
      <ul>
        <li>Cómo se obtienen las variantes: <a href="tema.html?id=traces-and-variants">Traces and Process Variants</a>.</li>
        <li>Distribución de los tiempos dentro de cada variante: <a href="tema.html?id=duration-distributions">Duration Distributions</a>.</li>
        <li>Comparación de comportamiento más allá del tiempo: <a href="tema.html?id=variant-comparison">Variant Comparison</a>.</li>
        <li>Si la lentitud viene de la espera: <a href="tema.html?id=waiting-and-service-time">Waiting and Service Time</a> y <a href="tema.html?id=bottleneck-analysis">Bottleneck Analysis</a>.</li>
      </ul>`,
  });
})();
