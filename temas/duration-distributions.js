(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const PROCESOS = [['reclamos', P.procesos.reclamos.nombre], ['pedidos', P.procesos.pedidos.nombre]];

  function recortar(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 3 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  }

  /* ---------- Fig. 1: histograma, cuantiles y SLA ---------- */

  function montarHistograma(cuerpo) {
    let proceso = 'reclamos', n = 400, cajas = 20, semilla = 1, sla = 0;
    let ciclos = [], orden = [], bins = [], plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; calcular(true); } });
    ctl.rango({ etiqueta: 'Casos', min: 100, max: 1000, paso: 50, valor: n, alCambiar: (v) => { n = v; calcular(false); } });
    ctl.rango({ etiqueta: 'Barras', min: 5, max: 40, valor: cajas, alCambiar: (v) => { cajas = v; dibujar(); } });
    ctl.boton('SLA en el percentil 90', () => { sla = P.cuantil(ciclos, 0.9); dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(false); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'casos que cumplen el SLA' },
      { color: C.s8, texto: 'casos que lo incumplen' },
      { color: C.s2, texto: 'media', forma: 'linea' },
      { color: C.s7, texto: 'mediana', forma: 'linea' },
      { color: C.tinta, texto: 'SLA (plazo)', forma: 'linea' },
      { color: C.apagado, texto: 'valla de atípicos Q3 + 1,5·RIC', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el histograma para fijar el plazo (SLA) en ese valor. Pase el cursor sobre una barra para ver cuántos casos hay. Compare la media con la mediana: si la cola es larga, la media se aleja hacia la derecha.');

    function calcular(reponer) {
      const log = P.simular(P.procesos[proceso].arbol, n, semilla, { espera: 12, llegada: 25 });
      ciclos = log.map(P.tiempoCiclo);
      orden = ciclos.slice().sort((a, b) => a - b);
      if (reponer || !sla) sla = P.cuantil(ciclos, 0.9);
      dibujar();
    }
    function dibujar() {
      if (!ciclos.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mx = orden[orden.length - 1] * 1.02, ancho = mx / cajas;
      bins = Array.from({ length: cajas }, (_, i) => ({ a: i * ancho, b: (i + 1) * ancho, n: 0 }));
      orden.forEach((v) => { bins[Math.min(cajas - 1, Math.floor(v / ancho))].n++; });
      const ymax = Math.max(...bins.map((b) => b.n)) * 1.28;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: mx, ymin: 0, ymax }, { etiquetaY: 'casos', etiquetaX: 'tiempo de ciclo (min)', formatoX: (v) => VIZ.fmt(v, 3), formatoY: (v) => String(Math.round(v)) });
      plano.ejes();
      bins.forEach((b, i) => {
        const xa = plano.sx(b.a) + 1, xb = plano.sx(b.b) - 1, y = plano.sy(b.n);
        ctx.fillStyle = (b.a + b.b) / 2 > sla ? C.s8 : C.s1;
        if (hover === i) ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.roundRect(xa, y, Math.max(1, xb - xa), plano.y0 - y, [4, 4, 0, 0]); ctx.fill();
        ctx.globalAlpha = 1;
      });
      const q1 = P.cuantil(ciclos, 0.25), q3 = P.cuantil(ciclos, 0.75), valla = q3 + 1.5 * (q3 - q1);
      const media = P.media(ciclos), med = P.mediana(ciclos);
      const lineas = [[media, C.s2, 'media', null], [med, C.s7, 'mediana', null], [sla, C.tinta, 'SLA', [6, 3]], [valla, C.apagado, 'valla', [3, 4]]];
      lineas.forEach(([v, c, , g]) => {
        if (v > mx) return;
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2; if (g) ctx.setLineDash(g);
        ctx.beginPath(); ctx.moveTo(plano.sx(v), plano.y0); ctx.lineTo(plano.sx(v), plano.y1 + 12); ctx.stroke(); ctx.restore();
      });
      // Etiquetas escalonadas para que no choquen cuando media y mediana están cerca.
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'middle';
      lineas.slice().sort((a, b) => a[0] - b[0]).forEach(([v, c, t], i) => {
        if (v > mx) return;
        const y = plano.y1 + 6 + (i % 4) * 12, texto = `${t} ${VIZ.fmt(v, 3)}`;
        const x = plano.sx(v), w = ctx.measureText(texto).width, derecha = x + 5 + w < lienzo.ancho - 4;
        ctx.fillStyle = C.superficie; ctx.fillRect(derecha ? x + 3 : x - w - 7, y - 6, w + 4, 12);
        ctx.fillStyle = c === C.apagado ? C.tinta2 : c; ctx.textAlign = derecha ? 'left' : 'right';
        ctx.fillText(texto, derecha ? x + 5 : x - 5, y);
      });
      const cumple = ciclos.filter((v) => v <= sla).length / ciclos.length;
      const atip = ciclos.filter((v) => v > valla).length;
      lectura.set([
        ['media / mediana', `${P.dur(media)} / ${P.dur(med)} (×${VIZ.fmt(media / med, 3)})`],
        ['percentil 90', P.dur(P.cuantil(ciclos, 0.9))],
        ['percentil 95', P.dur(P.cuantil(ciclos, 0.95))],
        ['máximo', P.dur(orden[orden.length - 1])],
        ['cumplen el SLA', `${VIZ.fmt(100 * cumple, 3)} %`],
        ['atípicos (sobre la valla)', `${atip} casos`],
      ]);
      registro.textContent = `Con un plazo de ${P.dur(sla)} cumplen ${VIZ.fmt(100 * cumple, 3)} % de los casos. ` +
        (media > med * 1.1 ? `La media (${P.dur(media)}) supera a la mediana (${P.dur(med)}): la cola derecha tira de ella; prometer plazos con la media dejaría fuera a muchos casos.` : 'Media y mediana son parecidas: la distribución es casi simétrica.');
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover !== null) { hover = null; dibujar(); } return tip.ocultar(); }
      const v = plano.ix(x), i = bins.findIndex((b) => v >= b.a && v < b.b);
      if (i !== hover) { hover = i < 0 ? null : i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const b = bins[i];
      tip.mostrar(x, y, `${VIZ.fmt(b.a, 3)} – ${VIZ.fmt(b.b, 3)} min` + VIZ.filaTooltip((b.a + b.b) / 2 > sla ? C.s8 : C.s1, 'casos', `${b.n} (${VIZ.fmt(100 * b.n / ciclos.length, 3)} %)`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      sla = Math.max(1, plano.ix(x)); dibujar();
    });
    calcular(true);
  }

  /* ---------- Fig. 2: cajas por grupo y valores atípicos ---------- */

  function montarCajas(cuerpo) {
    let proceso = 'reclamos', medida = 'ciclo', factor = 1.5, semilla = 1, sel = '';
    let grupos = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; sel = ''; calcular(); } });
    ctl.selector({ etiqueta: 'Medida', opciones: [['ciclo', 'tiempo de ciclo por variante'], ['servicio', 'servicio por actividad'], ['espera', 'espera por actividad']], valor: medida, alCambiar: (v) => { medida = v; sel = ''; calcular(); } });
    ctl.rango({ etiqueta: 'Largo de bigotes (× RIC)', min: 1, max: 3, paso: 0.5, valor: factor, alCambiar: (v) => { factor = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 70 + 38 * Math.max(1, grupos.length) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'caja: Q1 a Q3 (mitad central)' },
      { color: C.tinta, texto: 'mediana', forma: 'linea' },
      { color: C.s2, texto: 'media', forma: 'punto' },
      { color: C.s8, texto: 'atípico (fuera de los bigotes)', forma: 'punto' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila para listar sus casos atípicos. Alargue los bigotes (más veces el rango intercuartílico) y vea cómo algunos puntos dejan de ser atípicos; compare la posición de la media (rombo) con la de la mediana.');

    function calcular() {
      const log = P.simular(P.procesos[proceso].arbol, 400, semilla, { espera: 12, llegada: 25 });
      const g = new Map();
      const poner = (k, v, id) => { if (!g.has(k)) g.set(k, []); g.get(k).push({ v, id }); };
      if (medida === 'ciclo') {
        P.variantes(log).slice(0, 6).forEach((va, i) => va.casos.forEach((c) => poner(`V${i + 1} · ${va.n} casos`, P.tiempoCiclo(c), c.id)));
      } else {
        for (const c of log) c.eventos.forEach((e, k) => {
          if (medida === 'servicio') poner(e.act, e.fin - e.ini, c.id);
          else if (k) poner(e.act, e.ini - c.eventos[k - 1].fin, c.id);
        });
      }
      grupos = [...g.entries()].map(([nombre, datos]) => ({ nombre, datos })).filter((q) => q.datos.length >= 8);
      lienzo.ajustar(true);
    }
    function resumir(q) {
      const v = q.datos.map((d) => d.v).sort((a, b) => a - b);
      const q1 = P.cuantil(v, 0.25), md = P.cuantil(v, 0.5), q3 = P.cuantil(v, 0.75), ric = q3 - q1;
      const lo = q1 - factor * ric, hi = q3 + factor * ric;
      const dentro = v.filter((x) => x >= lo && x <= hi);
      return { q1, md, q3, ric, media: P.media(v), lo: dentro[0], hi: dentro[dentro.length - 1], atipicos: q.datos.filter((d) => d.v < lo || d.v > hi), n: v.length, min: v[0], max: v[v.length - 1] };
    }
    function dibujar() {
      if (!grupos.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      ctx.font = VIZ.fuente(11);
      const xe = Math.min(150, W * 0.36), xd = W - 14, top = 8, h = 38;
      const res = grupos.map(resumir);
      const mx = Math.max(...res.map((r) => r.max)) * 1.04;
      const sx = (v) => xe + v / mx * (xd - xe);
      for (const v of VIZ.ticks(0, mx, Math.max(2, Math.floor((xd - xe) / 80)))) {
        const x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + grupos.length * h); ctx.stroke();
        ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(VIZ.fmt(v, 3), x, top + grupos.length * h + 5);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('minutos', xd, top + grupos.length * h + 36);
      geo = [];
      grupos.forEach((q, i) => {
        const r = res[i], yc = top + i * h + h / 2;
        if (q.nombre === sel) { ctx.fillStyle = C.neutro; ctx.fillRect(0, top + i * h, W, h); }
        ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx(r.lo), yc); ctx.lineTo(sx(r.q1), yc); ctx.moveTo(sx(r.q3), yc); ctx.lineTo(sx(r.hi), yc);
        ctx.moveTo(sx(r.lo), yc - 6); ctx.lineTo(sx(r.lo), yc + 6); ctx.moveTo(sx(r.hi), yc - 6); ctx.lineTo(sx(r.hi), yc + 6); ctx.stroke();
        ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(sx(r.q1), yc - 9, Math.max(2, sx(r.q3) - sx(r.q1)), 18, 3); ctx.fill();
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx(r.md), yc - 9); ctx.lineTo(sx(r.md), yc + 9); ctx.stroke();
        VIZ.marcador(ctx, sx(r.media), yc, C.s2, 4, 3);
        r.atipicos.forEach((d) => VIZ.marcador(ctx, sx(d.v), yc, C.s8, 2.8));
        ctx.fillStyle = q.nombre === sel ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(recortar(ctx, q.nombre, xe - 10), xe - 8, yc);
        geo.push({ q, r, y0: top + i * h, y1: top + (i + 1) * h });
      });
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xe + 0.5, top); ctx.lineTo(xe + 0.5, top + grupos.length * h); ctx.stroke();
      const tot = res.reduce((s, r) => s + r.atipicos.length, 0), cant = res.reduce((s, r) => s + r.n, 0);
      const peor = res.map((r, i) => [r, grupos[i]]).sort((a, b) => b[0].atipicos.length / b[0].n - a[0].atipicos.length / a[0].n)[0];
      lectura.set([
        ['grupos', String(grupos.length)],
        ['observaciones', String(cant)],
        ['atípicos', `${tot} (${VIZ.fmt(100 * tot / cant, 3)} %)`],
        ['grupo con más atípicos', `${peor[1].nombre} (${VIZ.fmt(100 * peor[0].atipicos.length / peor[0].n, 3)} %)`],
      ]);
      const g = geo.find((x) => x.q.nombre === sel);
      if (g) {
        const ord = g.r.atipicos.slice().sort((a, b) => b.v - a.v);
        lista.replaceChildren(...(ord.length ? ord.slice(0, 8).map((d) => VIZ.el('div', null, `${d.id}   ${P.dur(d.v)}`)) : [VIZ.el('div', null, 'Sin atípicos con este largo de bigotes.')]),
          ...(ord.length > 8 ? [VIZ.el('div', null, `… y ${ord.length - 8} más`)] : []));
        registro.textContent = `${sel}: mediana ${P.dur(g.r.md)}, media ${P.dur(g.r.media)}, RIC ${P.dur(g.r.ric)}; ${g.r.atipicos.length} de ${g.r.n} fuera de los bigotes [${P.dur(g.r.lo)}, ${P.dur(g.r.hi)}].`;
      } else {
        lista.replaceChildren(VIZ.el('div', null, 'Elija una fila para ver sus casos atípicos.'));
        registro.textContent = 'Los bigotes llegan al dato más lejano dentro de Q1 − k·RIC y Q3 + k·RIC; lo que queda fuera se marca como atípico.';
      }
    }
    const fila = (e) => { const { y } = lienzo.posicion(e); return geo.find((g) => y >= g.y0 && y < g.y1); };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const g = fila(e), { x, y } = lienzo.posicion(e);
      if (!g) return tip.ocultar();
      const r = g.r;
      tip.mostrar(x, y, `<b>${g.q.nombre}</b> (n = ${r.n})<br>Q1 <b>${P.dur(r.q1)}</b> · mediana <b>${P.dur(r.md)}</b> · Q3 <b>${P.dur(r.q3)}</b><br>media <b>${P.dur(r.media)}</b><br>bigotes <b>${P.dur(r.lo)}</b> a <b>${P.dur(r.hi)}</b><br>atípicos <b>${r.atipicos.length}</b> (máx. ${P.dur(r.max)})`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (e) => { const g = fila(e); sel = g && g.q.nombre !== sel ? g.q.nombre : ''; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('duration-distributions', {
    intro: String.raw`
      <p>El promedio esconde casi todo lo importante de una duración. Dos procesos con el mismo tiempo de ciclo medio pueden tener una mayoría de casos rápidos y unos pocos extremadamente lentos, y es esa <em>cola</em> la que suele generar reclamos y multas. Por eso se examina la <strong>distribución</strong> completa: histograma, cuantiles y valores atípicos.</p>
      <p>Con la distribución se puede responder lo que importa en la práctica: ¿qué fracción de los casos cumple un plazo comprometido (<em>SLA</em>, acuerdo de nivel de servicio)? ¿Cuáles son los casos atípicos que conviene investigar uno por uno? ¿La mediana representa mejor al caso típico que la media?</p>`,
    visualizaciones: [
      {
        titulo: 'Histograma, cuantiles y plazo',
        descripcion: 'Las barras agrupan los tiempos de ciclo; el rojo marca los casos fuera del plazo. Haga clic para mover el SLA y vea cómo cambia el cumplimiento; compare media y mediana en el proceso de reclamos, que tiene bucles y cola larga.',
        montar: montarHistograma,
      },
      {
        titulo: 'Cajas y casos atípicos',
        descripcion: 'Cada caja resume un grupo (variante o actividad). Cambie la medida y alargue los bigotes: los puntos rojos son candidatos a investigar; haga clic en una fila para ver sus casos.',
        montar: montarCajas,
      },
    ],
    teoria: String.raw`
      <h2>Resúmenes de una distribución</h2>
      <p>Dadas las duraciones ordenadas \(x_{(1)}\le\dots\le x_{(n)}\), el cuantil de orden \(q\) se obtiene por interpolación lineal: con \(h=(n-1)q\) y \(i=\lfloor h\rfloor\),</p>
      \[ Q(q) = x_{(i+1)} + (h-i)\,\bigl(x_{(i+2)}-x_{(i+1)}\bigr). \]
      <p>La <em>mediana</em> es \(Q(0{,}5)\), el <em>rango intercuartílico</em> es \(\mathrm{RIC}=Q(0{,}75)-Q(0{,}25)\) y los percentiles 90 y 95 describen la cola. La media \(\bar x\) es sensible a los valores extremos; la mediana no. Un cociente \(\bar x/\mathrm{mediana}\) mucho mayor que 1 delata <strong>asimetría a la derecha</strong>, típica de duraciones: son positivas, y los reprocesos o esperas acumuladas alargan algunos casos sin acortar ninguno.</p>
      <h2>Valores atípicos</h2>
      <p>La regla de Tukey declara atípico todo valor fuera del intervalo</p>
      \[ \bigl[\,Q_1 - k\cdot\mathrm{RIC},\; Q_3 + k\cdot\mathrm{RIC}\,\bigr], \qquad k = 1{,}5 \text{ habitualmente.} \]
      <p>En un diagrama de caja, los <em>bigotes</em> llegan al dato más extremo dentro de ese intervalo. Con \(k\) mayor se marcan menos casos. Un atípico no es un error: suele ser un caso con reproceso, una espera larga o un dato mal registrado, y merece revisión individual.</p>
      <h2>Cumplimiento de un SLA</h2>
      <p>Si el plazo es \(\tau\), el cumplimiento es la función de distribución empírica \(\hat F(\tau)=\tfrac1n\#\{c: T_c\le\tau\}\). Fijar el plazo en la media suele dar cumplimientos cercanos a 60–70 % en distribuciones asimétricas; para prometer 90 % hay que fijarlo en el percentil 90.</p>
      <pre><code>ordenar tiempos de ciclo
para cada barra [a, b): contar casos con a ≤ T &lt; b
cumplimiento(τ) ← #{T ≤ τ} / n
valla ← Q3 + k · (Q3 − Q1)
atípicos ← { c : T_c &gt; valla }</code></pre>
      <h2>Conexiones</h2>
      <ul>
        <li>Medias, ciclo y throughput: <a href="tema.html?id=cycle-time-throughput">Cycle Time and Throughput</a>.</li>
        <li>Qué parte del ciclo es espera: <a href="tema.html?id=waiting-and-service-time">Waiting and Service Time</a>.</li>
        <li>Qué variantes concentran la cola: <a href="tema.html?id=variant-performance">Variant Performance Analysis</a>.</li>
        <li>Valores atípicos y ruido en los datos de entrada: <a href="tema.html?id=event-log-quality">Event Log Extraction and Quality</a>.</li>
      </ul>`,
  });
})();
