(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;
  const PROCESOS = [['pedidos', P.procesos.pedidos.nombre], ['reclamos', P.procesos.reclamos.nombre]];
  const INI = '▶', FIN = '■';

  // Congestión por actividad: multiplica la espera previa de cada actividad (colas más largas donde hay
  // menos capacidad) y desplaza los eventos siguientes. Así las esperas dejan de ser uniformes.
  const CONGESTION = {
    pedidos: { 'Reponer stock': 1.2, 'Preparar envío': 3.5, 'Emitir factura': 0.6, 'Cobrar al contado': 0.5, 'Despachar': 1.5 },
    reclamos: { 'Aprobar compensación': 3.5, 'Investigar': 1.8, 'Clasificar': 0.5, 'Cerrar caso': 0.4 },
  };
  function congestionar(log, f) {
    return log.map((c) => {
      let prev = 0;
      const eventos = c.eventos.map((e, k) => {
        const ini = k ? prev + (e.ini - c.eventos[k - 1].fin) * (f[e.act] === undefined ? 1 : f[e.act]) : e.ini;
        prev = ini + (e.fin - e.ini);
        return { ...e, ini, fin: prev };
      });
      return { ...c, eventos };
    });
  }

  // Servicio y espera medios por actividad y espera media por arista (a → b), con inicio y fin añadidos.
  function analizar(log) {
    const nodos = new Map(), aristas = new Map();
    const nodo = (a) => { if (!nodos.has(a)) nodos.set(a, { act: a, n: 0, serv: 0, esp: 0, nEsp: 0 }); return nodos.get(a); };
    const arista = (a, b) => { const k = a + '\u0001' + b; if (!aristas.has(k)) aristas.set(k, { de: a, a: b, n: 0, esp: 0 }); return aristas.get(k); };
    for (const c of log) {
      const ev = c.eventos;
      ev.forEach((e, k) => {
        const r = nodo(e.act); r.n++; r.serv += e.fin - e.ini;
        const w = k ? e.ini - ev[k - 1].fin : 0;
        const ar = arista(k ? ev[k - 1].act : INI, e.act); ar.n++; ar.esp += w;
        if (k) { r.esp += w; r.nEsp++; }
      });
      arista(ev[ev.length - 1].act, FIN).n++;
    }
    for (const r of nodos.values()) { r.mServ = r.serv / r.n; r.mEsp = r.nEsp ? r.esp / r.nEsp : 0; r.mTot = r.mServ + r.mEsp; }
    for (const e of aristas.values()) e.m = e.n ? e.esp / e.n : 0;
    return { nodos, aristas: [...aristas.values()], n: log.length };
  }

  // Camino de mayor tiempo medio (servicio de nodos + espera de aristas) quitando las aristas de retroceso.
  function caminoCritico(an) {
    const sal = new Map([[INI, []], [FIN, []]]);
    for (const a of an.nodos.keys()) sal.set(a, []);
    for (const e of an.aristas) sal.get(e.de).push(e);
    const estado = new Map(), atras = new Set();
    (function dfs(u) {
      estado.set(u, 1);
      for (const e of sal.get(u)) {
        if (estado.get(e.a) === 1) atras.add(e); else if (!estado.get(e.a)) dfs(e.a);
      }
      estado.set(u, 2);
    })(INI);
    const memo = new Map();
    const mejor = (u) => {
      if (u === FIN) return { v: 0, via: [] };
      if (memo.has(u)) return memo.get(u);
      let b = { v: -1, via: [] };
      for (const e of sal.get(u)) {
        if (atras.has(e)) continue;
        const peso = e.m + (e.a === FIN ? 0 : an.nodos.get(e.a).mServ), r = mejor(e.a);
        if (peso + r.v > b.v) b = { v: peso + r.v, via: [e, ...r.via] };
      }
      memo.set(u, b);
      return b;
    };
    const r = mejor(INI);
    return { aristas: new Set(r.via), tiempo: r.v, espera: r.via.reduce((s, e) => s + e.m, 0), acts: r.via.map((e) => e.a).filter((a) => a !== FIN) };
  }

  /* ---------- Fig. 1: mapa de calor sobre el grafo ---------- */

  function montarMapa(cuerpo) {
    let proceso = 'pedidos', metrica = 'espera', k = 2, ver = true, semilla = 1, sel = '';
    let an = null, camino = null, geo = null, pos = null, capas = 8;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso', opciones: PROCESOS, valor: proceso, alCambiar: (v) => { proceso = v; sel = ''; calcular(); } });
    ctl.selector({ etiqueta: 'Colorear por', opciones: [['espera', 'espera media'], ['servicio', 'servicio medio'], ['total', 'espera + servicio']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Actividades críticas', min: 0, max: 4, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar camino crítico', valor: ver, alCambiar: (v) => { ver = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (capas * 112 > w - 100 ? 70 + 62 * capas : 430) });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una actividad para ver su detalle. Cambie «Colorear por» para ver cómo la espera (que vive en las flechas y se asigna a la actividad que sigue) y el servicio señalan lugares distintos; ajuste cuántas actividades críticas se marcan.');

    const valorNodo = (r) => (metrica === 'espera' ? r.mEsp : metrica === 'servicio' ? r.mServ : r.mTot);
    function calcular() {
      const log = congestionar(P.simular(P.procesos[proceso].arbol, 300, semilla, { espera: 12, llegada: 25 }), CONGESTION[proceso]);
      an = analizar(log);
      camino = caminoCritico(an);
      const ids = [INI, ...an.nodos.keys(), FIN];
      const base = P.disponer(ids, an.aristas.map((e) => [e.de, e.a]));
      // Capas por flujo; las actividades opcionales (menos del 90 % de los casos) se apartan del eje
      // central, alternando de lado, para que las flechas que las saltan no pasen por detrás.
      const xs = [...new Set(ids.map((id) => Math.round(base[id].x * 1000)))].sort((a, b) => a - b);
      capas = xs.length;
      let lado = 1;
      pos = {};
      ids.forEach((id) => { pos[id] = { r: xs.indexOf(Math.round(base[id].x * 1000)) / Math.max(1, capas - 1), lane: 0.5 }; });
      ids.slice().sort((a, b) => pos[a].r - pos[b].r).forEach((id) => {
        const r = an.nodos.get(id);
        if (r && r.n / an.n < 0.9) { pos[id].lane = 0.5 + 0.3 * lado; lado = -lado; }
      });
      lienzo.ajustar(true);
    }
    function dibujar() {
      if (!an) return;
      const vertical = capas * 112 > lienzo.ancho - 100;
      const vals = [...an.nodos.values()].map(valorNodo);
      const vmax = Math.max(...vals, 1e-9);
      const emax = Math.max(...an.aristas.map((e) => e.m), 1e-9), fmax = Math.max(...an.aristas.map((e) => e.n));
      const col = (t) => VIZ.css(VIZ.enRampa(0.1 + 0.9 * t));
      const crit = [...an.nodos.values()].sort((a, b) => valorNodo(b) - valorNodo(a)).slice(0, k).map((r) => r.act);
      const nodos = [{ id: INI, tipo: 'inicio', relleno: C.s6, borde: C.s6 }, { id: FIN, tipo: 'fin', borde: C.tinta }];
      for (const r of an.nodos.values()) {
        const t = valorNodo(r) / vmax, oscuro = 0.1 + 0.9 * t > 0.55;
        const rank = crit.indexOf(r.act);
        nodos.push({
          id: r.act, tipo: 'act', etiqueta: r.act, relleno: col(t), colorTexto: oscuro ? C.sobre : C.tinta,
          borde: C.tinta, anillo: r.act === sel ? C.s7 : rank >= 0 ? C.s8 : null,
          insignia: rank >= 0 ? `#${rank + 1}` : null, colorInsignia: C.s8,
        });
      }
      const aristas = an.aristas.map((e) => {
        const enCamino = ver && camino.aristas.has(e), usaEspera = metrica !== 'servicio';
        return {
          de: e.de, a: e.a, etiqueta: e.de === INI || e.a === FIN ? '' : usaEspera ? VIZ.fmt(e.m, 2) : String(e.n),
          ancho: enCamino ? 4 : 1.5 + 2.5 * e.n / fmax, color: enCamino ? C.s2 : usaEspera && e.m > 0 ? col(e.m / emax) : C.eje,
        };
      });
      const pp = {};
      for (const id of Object.keys(pos)) pp[id] = vertical ? { x: pos[id].lane, y: pos[id].r } : { x: pos[id].r, y: pos[id].lane };
      lienzo.limpiar();
      geo = P.dibujarGrafo(lienzo, nodos, aristas, pp, vertical ? { margenX: 66, margenY: 26 } : { margenX: 56, margenY: 40 });
      leyenda.set([
        { color: col(0), texto: metrica === 'servicio' ? 'servicio bajo' : 'valor bajo' },
        { color: col(1), texto: metrica === 'servicio' ? 'servicio alto' : 'valor alto' },
        { color: C.s8, texto: 'actividad crítica (mayor valor)', forma: 'punto' },
        { color: C.s7, texto: 'seleccionada', forma: 'punto' },
        { color: C.s2, texto: 'camino de mayor tiempo medio', forma: 'linea' },
      ]);
      const etiqueta = metrica === 'espera' ? 'espera media' : metrica === 'servicio' ? 'servicio medio' : 'espera + servicio';
      const peor = [...an.nodos.values()].sort((a, b) => valorNodo(b) - valorNodo(a))[0];
      lectura.set([
        [`mayor ${etiqueta}`, `${peor.act}: ${P.dur(valorNodo(peor))}`],
        ['tiempo del camino crítico', P.dur(camino.tiempo)],
        ['espera dentro del camino', `${VIZ.fmt(100 * camino.espera / camino.tiempo, 3)} %`],
        ['actividades del camino', String(camino.acts.length)],
      ]);
      if (sel && an.nodos.has(sel)) {
        const r = an.nodos.get(sel);
        registro.textContent = `${sel}: ${VIZ.fmt(100 * r.n / an.n, 3)} % de los casos la ejecutan (${r.n} veces); servicio medio ${P.dur(r.mServ)}, espera media previa ${P.dur(r.mEsp)}${r.mEsp > r.mServ ? ': aquí domina la espera, el cuello está antes de la actividad, no en ella' : ': domina el servicio, la actividad misma es lenta'}.`;
      } else registro.textContent = `Camino de mayor tiempo medio: ${camino.acts.join(' › ')} (${P.dur(camino.tiempo)}). Los números de las flechas son ${metrica === 'servicio' ? 'ejecuciones' : 'minutos de espera media'}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = geo && P.nodoEn(geo, x, y);
      if (!n || !an.nodos.has(n.id)) return tip.ocultar();
      const r = an.nodos.get(n.id);
      tip.mostrar(x, y, `<b>${r.act}</b>` + VIZ.filaTooltip(C.s1, 'servicio medio', P.dur(r.mServ)) + VIZ.filaTooltip(C.s2, 'espera media previa', P.dur(r.mEsp)) + `<div>ejecuciones <b>${r.n}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = geo && P.nodoEn(geo, x, y);
      sel = n && an.nodos.has(n.id) && n.id !== sel ? n.id : '';
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 2: utilización y capacidad (M/M/c) ---------- */

  // Probabilidad de espera de Erlang C para c servidores y carga ofrecida a (en erlangs).
  function erlangC(c, a) {
    const rho = a / c;
    if (rho >= 1) return 1;
    let suma = 0, term = 1;
    for (let j = 0; j < c; j++) { suma += term; term *= a / (j + 1); }
    const top = term / (1 - rho);
    return top / (suma + top);
  }

  function montarCapacidad(cuerpo) {
    const log = P.simular(P.procesos.pedidos.arbol, 400, 11, { espera: 12, llegada: 25 });
    const por = new Map();
    for (const c of log) for (const e of c.eventos) {
      if (!por.has(e.rol)) por.set(e.rol, { rol: e.rol, visitas: 0, serv: 0 });
      const r = por.get(e.rol); r.visitas++; r.serv += e.fin - e.ini;
    }
    const roles = [...por.values()].map((r) => ({ rol: r.rol, v: r.visitas / log.length, s: r.serv / r.visitas, c0: P.personas[r.rol].length }))
      .sort((a, b) => b.v * b.s - a.v * a.s);
    let lam = 3, cap = Object.fromEntries(roles.map((r) => [r.rol, r.c0])), geo = [], previo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Llegada de casos (por hora)', min: 1, max: 6, paso: 0.5, valor: lam, alCambiar: (v) => { lam = v; dibujar(); } });
    ctl.boton('Capacidad original', () => { roles.forEach((r) => { cap[r.rol] = r.c0; }); previo = null; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 70 + 64 * roles.length });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'utilización por debajo de 70 %' },
      { color: C.s4, texto: 'entre 70 % y 90 %' },
      { color: C.s8, texto: 'por encima de 90 % (la cola se dispara)' },
      { color: C.tinta, texto: 'personas del rol', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un rol para sumarle una persona (después de 6 vuelve a 1). Suba la llegada hasta saturar el rol más cargado, agréguele capacidad y vea cómo el cuello de botella pasa a otro rol.');

    function evaluar() {
      return roles.map((r) => {
        const c = cap[r.rol], a = (lam / 60) * r.v * r.s, rho = a / c;
        const wq = rho >= 1 ? Infinity : erlangC(c, a) * r.s / (c * (1 - rho));
        return { ...r, c, a, rho, wq, porCaso: r.v * wq };
      });
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ev = evaluar();
      const xe = Math.min(96, W * 0.25), xd = W - 14, top = 8, h = 64;
      const sx = (rho) => xe + Math.min(rho, 1.2) / 1.2 * (xd - xe);
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const x = Math.round(sx(v)) + 0.5;
        ctx.strokeStyle = v === 1 ? C.apagado : C.rejilla; ctx.setLineDash(v === 1 ? [3, 4] : []);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + ev.length * h); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`${Math.round(v * 100)} %`, x, top + ev.length * h + 5);
      }
      ctx.fillStyle = C.tinta2; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('utilización ρ = λ·s / c', xd, top + ev.length * h + 36);
      geo = [];
      ev.forEach((r, i) => {
        const y = top + i * h, color = r.rho >= 0.9 ? C.s8 : r.rho >= 0.7 ? C.s4 : C.s1;
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(xe, y + 10, Math.max(1, sx(r.rho) - xe), 20, [0, 4, 4, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(r.rol, xe - 8, y + 20);
        for (let j = 0; j < r.c; j++) { ctx.beginPath(); ctx.arc(xe - 12 - j * 9, y + 42, 3.5, 0, 2 * Math.PI); ctx.fill(); }
        ctx.textAlign = 'left'; ctx.font = VIZ.fuente(11);
        const t = `ρ = ${VIZ.fmt(100 * r.rho, 3)} %`;
        const dentro = sx(r.rho) - xe > ctx.measureText(t).width + 10;
        ctx.fillStyle = dentro ? C.sobre : C.tinta; ctx.fillText(t, dentro ? xe + 6 : sx(r.rho) + 6, y + 20);
        ctx.fillStyle = C.tinta2;
        ctx.fillText(`espera en cola: ${isFinite(r.wq) ? P.dur(r.wq) : '∞ (no se estabiliza)'} por visita`, xe + 6, y + 48);
        geo.push({ r, y0: y, y1: y + h });
      });
      const tot = ev.reduce((s, r) => s + r.porCaso, 0);
      const cuello = ev.slice().sort((a, b) => b.rho - a.rho)[0];
      lectura.set([
        ['cuello de botella', `${cuello.rol} (ρ = ${VIZ.fmt(100 * cuello.rho, 3)} %)`],
        ['espera en colas por caso', isFinite(tot) ? P.dur(tot) : '∞'],
        ['personas en total', String(ev.reduce((s, r) => s + r.c, 0))],
        ['llegada', `${VIZ.fmt(lam, 2)} casos/h`],
      ]);
      const ahora = { cuello: cuello.rol, rho: cuello.rho, tot };
      registro.textContent = previo && (previo.cuello !== ahora.cuello || previo.tot !== ahora.tot)
        ? `Antes el cuello era ${previo.cuello} (ρ = ${VIZ.fmt(100 * previo.rho, 3)} %, espera ${isFinite(previo.tot) ? P.dur(previo.tot) : '∞'} por caso); ahora es ${ahora.cuello} (ρ = ${VIZ.fmt(100 * ahora.rho, 3)} %, espera ${isFinite(tot) ? P.dur(tot) : '∞'}).`
        : `Cuello actual: ${cuello.rol}. Agregarle una persona reduce su ρ a ${VIZ.fmt(100 * cuello.a / (cuello.c + 1), 3)} %.`;
      previo = ahora;
    }
    const fila = (e) => { const { y } = lienzo.posicion(e); return geo.find((g) => y >= g.y0 && y < g.y1); };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const g = fila(e), { x, y } = lienzo.posicion(e);
      if (!g) return tip.ocultar();
      const r = g.r;
      tip.mostrar(x, y, `<b>${r.rol}</b>, ${r.c} persona(s)<br>visitas por caso <b>${VIZ.fmt(r.v, 3)}</b> · servicio <b>${P.dur(r.s)}</b><br>carga ofrecida <b>${VIZ.fmt(r.a, 3)}</b> erlangs<br>cola por caso <b>${isFinite(r.porCaso) ? P.dur(r.porCaso) : '∞'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (e) => { const g = fila(e); if (!g) return; cap[g.r.rol] = cap[g.r.rol] >= 6 ? 1 : cap[g.r.rol] + 1; dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('bottleneck-analysis', {
    intro: String.raw`
      <p>Un <strong>cuello de botella</strong> (<em>bottleneck</em>) es la actividad o el recurso que limita el rendimiento de todo el proceso: allí se forman las colas y se pierde tiempo. Se reconoce en el modelo coloreando cada actividad según su espera o servicio medios, como un <em>mapa de calor</em> sobre el grafo de procesos.</p>
      <p>Las <em>actividades críticas</em> son las de mayor valor en la métrica elegida, y el <em>camino crítico</em> es la ruta del modelo con mayor tiempo medio. Pero un cuello de botella no se arregla marcándolo: hay que preguntarse si lo que falta es capacidad, y qué cuello aparece después de agregarla.</p>`,
    visualizaciones: [
      {
        titulo: 'Mapa de calor sobre el modelo',
        descripcion: 'El color sigue la espera o el servicio medio; el naranjo marca el camino de mayor tiempo medio y el rojo, las actividades críticas. Alterne entre espera y servicio: muestran cuellos distintos.',
        montar: montarMapa,
      },
      {
        titulo: 'Utilización y capacidad',
        descripcion: 'La espera en cola crece de forma explosiva cuando la utilización se acerca a 100 %. Aumente la llegada, sume personas al rol saturado y observe cómo el cuello de botella se desplaza a otro rol.',
        montar: montarCapacidad,
      },
    ],
    teoria: String.raw`
      <h2>Detectar el cuello de botella</h2>
      <p>Con el registro se calculan, para cada actividad \(a\), el servicio medio \(\bar s_a\) y la espera media previa \(\bar w_a\). La espera pertenece a la <em>flecha</em> \(a\to b\) del grafo de sucesión directa (el hueco entre el fin de \(a\) y el inicio de \(b\)); aquí se le atribuye también a \(b\), que es quien “hace esperar”. Una actividad es <em>crítica</em> si maximiza \(\bar w_a\), \(\bar s_a\) o \(\bar w_a+\bar s_a\), según lo que se busque.</p>
      <h2>Camino crítico</h2>
      <p>Se quitan las aristas de retroceso (bucles) mediante una búsqueda en profundidad y, en el grafo acíclico resultante, se busca el camino que maximiza</p>
      \[ \sum_{a\in\pi}\bar s_a + \sum_{(a\to b)\in\pi}\bar w_{a\to b} . \]
      <pre><code>mejor(u) ← 0                       si u = fin
mejor(u) ← max sobre aristas (u→v) no de retroceso:
               espera(u→v) + servicio(v) + mejor(v)
camino crítico ← reconstruir desde mejor(inicio)</code></pre>
      <p>Costo \(O(|V|+|E|)\) con memoización. El resultado es un camino de <em>tiempo medio máximo</em>, no necesariamente el más frecuente; en un grafo con ramas alternativas (XOR) rara vez lo recorre un caso concreto, por eso conviene cruzarlo con la frecuencia.</p>
      <h2>Utilización y colas</h2>
      <p>Si un rol atiende \(c\) personas con tiempo de servicio medio \(s\) y recibe visitas a tasa \(\lambda_r\), su carga ofrecida es \(a=\lambda_r s\) (en erlangs) y su utilización \(\rho = a/c\). En el modelo M/M/c, la espera media en cola por visita es</p>
      \[ W_q = \frac{C(c,a)\; s}{c\,(1-\rho)}, \qquad C(c,a)=\frac{\dfrac{a^c}{c!\,(1-\rho)}}{\displaystyle\sum_{j=0}^{c-1}\frac{a^j}{j!}+\frac{a^c}{c!\,(1-\rho)}}, \]
      <p>válida si \(\rho<1\); con \(\rho\ge 1\) la cola crece sin límite. La fórmula supone llegadas de Poisson y servicio exponencial: es una aproximación que la figura usa para mostrar la forma de la curva, no una predicción exacta de este registro.</p>
      <div class="recuadro">Agregar capacidad al cuello de botella solo mejora el proceso hasta que otro rol pasa a ser el más cargado. La mejora se mide en el ciclo completo, no en la actividad intervenida.</div>
      <h2>Conexiones</h2>
      <ul>
        <li>Separación del tiempo en espera y servicio: <a href="tema.html?id=waiting-and-service-time">Waiting and Service Time</a>.</li>
        <li>Carga por recurso: <a href="tema.html?id=resource-workload">Resource Workload and Bottlenecks</a>.</li>
        <li>El grafo sobre el que se pinta el mapa: <a href="tema.html?id=directly-follows-graphs">Directly-Follows Graphs</a>.</li>
        <li>Relación entre WIP, ciclo y tasa: <a href="tema.html?id=cycle-time-throughput">Cycle Time and Throughput</a>.</li>
      </ul>`,
  });
})();
