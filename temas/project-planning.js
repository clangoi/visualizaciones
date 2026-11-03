(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  // Actividades: d = duración normal (días), m = duración mínima si se acelera, k = costo por día acelerado (miles de USD), p = precedentes.
  const ACT = [
    { id: 'A', n: 'Diseño', d: 4, m: 2, k: 3, p: [] },
    { id: 'B', n: 'Permisos', d: 3, m: 2, k: 5, p: [] },
    { id: 'C', n: 'Cimientos', d: 5, m: 3, k: 4, p: [0, 1] },
    { id: 'D', n: 'Estructura', d: 6, m: 4, k: 6, p: [2] },
    { id: 'E', n: 'Instalaciones', d: 4, m: 3, k: 2, p: [2] },
    { id: 'F', n: 'Cubierta', d: 3, m: 2, k: 3, p: [3] },
    { id: 'G', n: 'Acabados', d: 5, m: 3, k: 5, p: [3, 4] },
    { id: 'H', n: 'Inspección', d: 2, m: 1, k: 2, p: [5, 6] },
  ];
  const N = ACT.length;
  const SUC = ACT.map((_, i) => ACT.reduce((s, a, j) => (a.p.includes(i) ? [...s, j] : s), []));
  const D0 = ACT.map((a) => a.d);
  const EPS = 1e-7;

  // Método del camino crítico: inicios y fines más tempranos y más tardíos, holguras.
  function cpm(d) {
    const ES = [], EF = [], LS = Array(N), LF = Array(N);
    for (let i = 0; i < N; i++) { ES[i] = Math.max(0, ...ACT[i].p.map((p) => EF[p])); EF[i] = ES[i] + d[i]; }
    const T = Math.max(...EF);
    for (let i = N - 1; i >= 0; i--) { LF[i] = Math.min(T, ...SUC[i].map((j) => LS[j])); LS[i] = LF[i] - d[i]; }
    const hold = ES.map((e, i) => LS[i] - e);
    return { ES, EF, LS, LF, T, hold, crit: hold.map((h) => Math.abs(h) < EPS) };
  }
  // LP del camino crítico: min T con s_j ≥ s_i + d_i y T ≥ s_j + d_j (variables s_1..s_n, T).
  function lpDuracion(d) {
    const A = [], b = [];
    ACT.forEach((a, j) => a.p.forEach((i) => { const f = Array(N + 1).fill(0); f[j] = 1; f[i] = -1; A.push(f); b.push(d[i]); }));
    ACT.forEach((_, j) => { const f = Array(N + 1).fill(0); f[N] = 1; f[j] = -1; A.push(f); b.push(d[j]); });
    const c = Array(N + 1).fill(0); c[N] = 1;
    const r = O.lp(c, A, A.map(() => '>='), b, { max: false });
    return r.estado === 'optimo' ? { s: r.x.slice(0, N), T: r.x[N] } : null;
  }
  // LP de aceleración: min Σ k_i c_i con inicios s_i, reducciones c_i ≤ d_i − m_i y todo terminado antes del plazo.
  function lpAcelerar(plazo) {
    const A = [], b = [], sen = [];
    const fila = () => Array(2 * N).fill(0);
    ACT.forEach((a, j) => a.p.forEach((i) => { const f = fila(); f[j] = 1; f[i] = -1; f[N + i] = 1; A.push(f); b.push(ACT[i].d); sen.push('>='); }));
    ACT.forEach((a, i) => { const f = fila(); f[i] = 1; f[N + i] = -1; A.push(f); b.push(plazo - a.d); sen.push('<='); });
    const c = fila();
    ACT.forEach((a, i) => { c[N + i] = a.k; });
    const cotas = Array.from({ length: 2 * N }, (_, j) => (j < N ? [0, Infinity] : [0, ACT[j - N].d - ACT[j - N].m]));
    const r = O.lp(c, A, sen, b, { max: false, cotas });
    if (r.estado !== 'optimo') return null;
    const red = r.x.slice(N).map((v) => Math.round(v * 1e6) / 1e6);
    return { red, costo: r.z, d: ACT.map((a, i) => a.d - red[i]) };
  }

  // Diagrama de Gantt: barras en el inicio más temprano, holgura punteada, conexiones entre precedentes.
  function gantt(lienzo, c, o = {}) {
    const { ctx } = lienzo, estrecho = lienzo.ancho < 520;
    const xmax = o.xmax || Math.max(24, c.T + 1);
    const pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: N }, { etiquetaX: 'día', ticksY: [], margen: { izq: estrecho ? 30 : 128, sup: 8, inf: 40 } });
    pl.ejes();
    const fh = (pl.y0 - pl.y1) / N, hb = Math.min(22, fh * 0.62), yc = (i) => pl.y1 + (i + 0.5) * fh;
    ctx.save();
    ctx.strokeStyle = C.eje; ctx.lineWidth = 1;
    ACT.forEach((a, j) => a.p.forEach((i) => {
      ctx.beginPath();
      ctx.moveTo(pl.sx(c.EF[i]), yc(i)); ctx.lineTo(pl.sx(c.EF[i]) + 3, yc(i)); ctx.lineTo(pl.sx(c.ES[j]) - 3, yc(j)); ctx.lineTo(pl.sx(c.ES[j]), yc(j));
      ctx.stroke();
    }));
    ctx.restore();
    ACT.forEach((a, i) => {
      const y0 = yc(i) - hb / 2;
      if (o.sel === i) { ctx.fillStyle = C.neutro; ctx.fillRect(0, pl.y1 + i * fh, lienzo.ancho, fh); }
      if (o.original && o.original[i] > c.EF[i] - c.ES[i] + EPS) {
        ctx.save();
        ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.strokeRect(pl.sx(c.ES[i]) + 0.5, y0 + 0.5, pl.sx(c.ES[i] + o.original[i]) - pl.sx(c.ES[i]), hb);
        ctx.restore();
      }
      if (c.hold[i] > EPS) {
        ctx.save();
        ctx.fillStyle = VIZ.alfa(C.inactivo, 0.18);
        ctx.strokeStyle = C.inactivo; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.fillRect(pl.sx(c.EF[i]), y0 + hb * 0.25, pl.sx(c.LF[i]) - pl.sx(c.EF[i]), hb * 0.5);
        ctx.strokeRect(pl.sx(c.EF[i]) + 0.5, y0 + hb * 0.25 + 0.5, pl.sx(c.LF[i]) - pl.sx(c.EF[i]), hb * 0.5);
        ctx.restore();
      }
      ctx.fillStyle = c.crit[i] ? C.s2 : C.s1;
      ctx.beginPath();
      ctx.roundRect(pl.sx(c.ES[i]), y0, Math.max(2, pl.sx(c.EF[i]) - pl.sx(c.ES[i])), hb, 4);
      ctx.fill();
      ctx.save();
      ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const dur = c.EF[i] - c.ES[i];
      if (pl.sx(c.EF[i]) - pl.sx(c.ES[i]) > 14) ctx.fillText(VIZ.fmt(dur, 3), (pl.sx(c.ES[i]) + pl.sx(c.EF[i])) / 2, yc(i));
      ctx.textAlign = 'right'; ctx.fillStyle = o.sel === i ? C.tinta : C.tinta2; ctx.font = VIZ.fuente(11, o.sel === i ? 600 : 400);
      ctx.fillText(estrecho ? a.id : `${a.id}  ${a.n}`, pl.x0 - 8, yc(i));
      ctx.restore();
      if (o.lp) {
        ctx.save();
        ctx.fillStyle = C.tinta; ctx.strokeStyle = C.superficie; ctx.lineWidth = 1.5;
        ctx.beginPath(); VIZ.forma(ctx, pl.sx(o.lp[i]), yc(i) + hb / 2 + 5, 3.2, 3); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    });
    return { pl, fh };
  }
  const ruta = (c) => ACT.map((a, i) => (c.crit[i] ? { a, i } : null)).filter(Boolean).sort((p, q) => c.ES[p.i] - c.ES[q.i] || p.i - q.i).map((x) => x.a.id).join(' → ');
  const filaInfo = (c, i, d) => `<b>${ACT[i].id} · ${ACT[i].n}</b><br>duración <b>${VIZ.fmt(d[i], 3)}</b> días<br>inicio temprano <b>${VIZ.fmt(c.ES[i], 3)}</b> · tardío <b>${VIZ.fmt(c.LS[i], 3)}</b><br>fin temprano <b>${VIZ.fmt(c.EF[i], 3)}</b> · tardío <b>${VIZ.fmt(c.LF[i], 3)}</b><br>holgura <b>${VIZ.fmt(c.hold[i], 3)}</b> días${c.crit[i] ? ' (crítica)' : ''}`
    + (ACT[i].p.length ? `<br>precede: ${ACT[i].p.map((p) => ACT[p].id).join(', ')}` : '<br>sin precedentes');

  /* ---------- Fig. 1: camino crítico ---------- */

  function montarCritico(cuerpo) {
    const d = D0.slice();
    let sel = 3, c = null, lp = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const selector = ctl.selector({ etiqueta: 'Actividad', opciones: ACT.map((a, i) => [i, `${a.id} · ${a.n}`]), valor: sel, alCambiar: (v) => { sel = +v; rg.valor = d[sel]; dibujar(); } });
    const rg = ctl.rango({ etiqueta: 'Duración de la actividad', min: 1, max: 12, valor: d[sel], formato: (v) => `${v} días`, alCambiar: (v) => { d[sel] = v; dibujar(); } });
    ctl.boton('Restablecer duraciones', () => { d.splice(0, N, ...D0); rg.valor = d[sel]; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'actividad crítica (holgura 0)' },
      { color: C.s1, texto: 'actividad con holgura' },
      { color: VIZ.alfa(C.inactivo, 0.18), texto: 'holgura: cuánto puede retrasarse', borde: C.inactivo },
      { color: C.tinta, texto: 'inicio que devuelve el programa lineal', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila (o use el selector) para elegir una actividad y cambie su duración. Si alarga una crítica, el proyecto se alarga igual; si alarga una con holgura, nada cambia hasta agotarla.');

    function dibujar() {
      c = cpm(d);
      lp = lpDuracion(d);
      lienzo.limpiar();
      geo = gantt(lienzo, c, { sel, lp: lp ? lp.s : null });
      const dif = lp ? Math.abs(lp.T - c.T) : NaN;
      registro.textContent = `${ACT[sel].id} · ${ACT[sel].n} dura ${d[sel]} días y tiene holgura ${VIZ.fmt(c.hold[sel], 3)}: `
        + (c.crit[sel] ? 'es crítica, cada día que se alargue alarga el proyecto.' : `puede retrasarse hasta ${VIZ.fmt(c.hold[sel], 3)} días sin afectar el plazo total.`);
      lectura.set([
        ['duración mínima (LP)', lp ? `${VIZ.fmt(lp.T, 4)} días` : '—'],
        ['hacia adelante y atrás', `${c.T} días`],
        ['diferencia LP − CPM', Number.isFinite(dif) ? VIZ.fmt(dif) : '—'],
        ['actividades críticas', `${c.crit.filter(Boolean).length} de ${N}`],
        ['ruta crítica', ruta(c)],
      ]);
    }
    const fila = (ev) => { const { x, y } = lienzo.posicion(ev); return geo && y >= geo.pl.y1 && y <= geo.pl.y0 ? Math.min(N - 1, Math.floor((y - geo.pl.y1) / geo.fh)) : -1; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const i = fila(ev); if (i >= 0) { sel = i; selector.valor = i; rg.valor = d[i]; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const i = fila(ev), { x, y } = lienzo.posicion(ev);
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, filaInfo(c, i, d));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = () => c && dibujar();
    dibujar();
  }

  /* ---------- Fig. 2: aceleración al menor costo ---------- */

  function montarAceleracion(cuerpo) {
    const tNormal = cpm(D0).T, tMin = cpm(ACT.map((a) => a.m)).T;
    let plazo = tNormal - 3, sol = null, c = null, curva = [], geo = null, plC = null;
    const ctl = VIZ.controles(cuerpo);
    const rg = ctl.rango({ etiqueta: 'Plazo exigido', min: tMin, max: tNormal, valor: plazo, formato: (v) => `${v} días`, alCambiar: (v) => { plazo = v; dibujar(); } });
    ctl.boton('Plazo normal', () => { plazo = tNormal; rg.valor = plazo; dibujar(); });
    ctl.boton('Plazo mínimo', () => { plazo = tMin; rg.valor = plazo; dibujar(); }, { primario: true });

    VIZ.subtitulo(cuerpo, 'Plan acelerado');
    const lienzoG = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    const tipG = VIZ.tooltip(lienzoG);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'actividad crítica en el plan acelerado' },
      { color: C.s1, texto: 'actividad con holgura' },
      { color: C.apagado, texto: 'duración normal (días ganados)', forma: 'linea' },
    ]);
    VIZ.subtitulo(cuerpo, 'Costo de acelerar según el plazo');
    const lienzoC = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 200, altoMax: 300 });
    const tipC = VIZ.tooltip(lienzoC);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo mínimo de cumplir el plazo', forma: 'linea' },
      { color: C.tinta, texto: 'plazo elegido' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Recorra el plazo de día en día: el programa lineal decide qué actividades acelerar. El costo crece cada vez más rápido porque primero se aceleran las actividades baratas y después las caras. Haga clic en la curva para fijar el plazo.');

    for (let D = tMin; D <= tNormal; D++) { const r = lpAcelerar(D); curva.push({ D, costo: r ? r.costo : NaN }); }
    function dibujar() {
      sol = lpAcelerar(plazo);
      if (!sol) return;
      c = cpm(sol.d);
      lienzoG.limpiar();
      geo = gantt(lienzoG, c, { original: D0, xmax: tNormal + 2 });
      // Curva
      lienzoC.limpiar();
      const ctx = lienzoC.ctx, zmax = Math.max(...curva.map((q) => q.costo));
      plC = VIZ.plano(lienzoC, { xmin: tMin - 0.5, xmax: tNormal + 0.5, ymin: 0, ymax: zmax * 1.1 }, { etiquetaX: 'plazo (días)', etiquetaY: 'costo de aceleración (miles de USD)', ticksX: curva.map((q) => q.D), formatoX: (v) => String(v) });
      plC.ejes();
      VIZ.trazar(ctx, plC, curva.map((q) => [q.D, q.costo]), C.s1, 2.5);
      curva.forEach((q) => VIZ.marcador(ctx, plC.sx(q.D), plC.sy(q.costo), C.s1, 3));
      VIZ.marcador(ctx, plC.sx(plazo), plC.sy(sol.costo), C.tinta, 6);
      const ac = ACT.map((a, i) => (sol.red[i] > EPS ? `${a.id} −${VIZ.fmt(sol.red[i], 3)}` : null)).filter(Boolean);
      const prev = plazo < tNormal ? curva.find((q) => q.D === plazo + 1) : null, marg = prev ? sol.costo - prev.costo : null;
      registro.textContent = plazo >= tNormal ? `Con el plazo normal (${tNormal} días) no hace falta acelerar nada: costo 0.`
        : `Para terminar en ${plazo} días se aceleran ${ac.join(', ')} (días de reducción) a un costo de ${VIZ.fmt(sol.costo, 4)} mil USD.`;
      lectura.set([
        ['plazo', `${plazo} días (normal ${tNormal}, mínimo ${tMin})`],
        ['costo de aceleración', `${VIZ.fmt(sol.costo, 4)} mil USD`],
        ['días recortados', `${tNormal - plazo}`],
        ['costo del último día', marg == null ? '—' : `${VIZ.fmt(marg, 3)} mil USD`],
        ['actividades críticas', ruta(c)],
      ]);
    }
    const fila = (ev) => { const { y } = lienzoG.posicion(ev); return geo && y >= geo.pl.y1 && y <= geo.pl.y0 ? Math.min(N - 1, Math.floor((y - geo.pl.y1) / geo.fh)) : -1; };
    lienzoG.canvas.addEventListener('pointermove', (ev) => {
      const i = fila(ev), { x, y } = lienzoG.posicion(ev);
      if (i < 0 || !sol) return tipG.ocultar();
      tipG.mostrar(x, y, filaInfo(c, i, sol.d) + `<br>acelerada <b>${VIZ.fmt(sol.red[i], 3)}</b> de ${ACT[i].d - ACT[i].m} días posibles (${ACT[i].k} mil USD/día)`);
    });
    lienzoG.canvas.addEventListener('pointerleave', () => tipG.ocultar());
    const plazoDe = (ev) => { const { x, y } = lienzoC.posicion(ev); return plC && plC.dentro(x, y) ? Math.max(tMin, Math.min(tNormal, Math.round(plC.ix(x)))) : null; };
    lienzoC.canvas.style.cursor = 'pointer';
    lienzoC.canvas.addEventListener('pointermove', (ev) => {
      const D = plazoDe(ev), { x, y } = lienzoC.posicion(ev);
      if (D == null) return tipC.ocultar();
      const q = curva.find((t) => t.D === D), p = curva.find((t) => t.D === D + 1);
      tipC.mostrar(x, y, `plazo <b>${D} días</b><br>costo <b>${VIZ.fmt(q.costo, 4)}</b> mil USD${p ? `<br>el día ${D + 1} → ${D} cuesta <b>${VIZ.fmt(q.costo - p.costo, 3)}</b>` : ''}`);
    });
    lienzoC.canvas.addEventListener('pointerleave', () => tipC.ocultar());
    lienzoC.canvas.addEventListener('click', (ev) => { const D = plazoDe(ev); if (D != null) { plazo = D; rg.valor = D; dibujar(); } });
    lienzoG.alDibujar = () => sol && dibujar();
    lienzoC.alDibujar = () => sol && dibujar();
    dibujar();
  }

  VIZ.registrarTema('project-planning', {
    intro: String.raw`
      <p>Un proyecto es un conjunto de actividades con duraciones y <em>precedencias</em>: no se pueden levantar muros antes de hacer los
      cimientos. ¿Cuánto dura el proyecto como mínimo? Lo decide la cadena de actividades más larga, el <strong>camino crítico</strong>: cualquier
      retraso en ella retrasa todo, mientras que las demás actividades tienen <em>holgura</em>.</p>
      <p>Ese cálculo es un programa lineal con una variable de inicio por actividad. Y si el plazo es demasiado largo, el mismo modelo decide
      qué actividades <em>acelerar</em> (con horas extra, más cuadrillas) para cumplir al menor costo.</p>`,
    visualizaciones: [
      {
        titulo: 'Camino crítico y holguras',
        descripcion: 'Alargue o acorte una actividad crítica (naranja) y compruebe que el proyecto cambia igual que ella; haga lo mismo con una que tiene holgura y vea que no pasa nada hasta agotarla. La marca negra bajo cada barra es el inicio que devuelve el programa lineal.',
        montar: montarCritico,
      },
      {
        titulo: 'Acelerar el proyecto al menor costo',
        descripcion: 'Baje el plazo día a día. Observe qué actividades se aceleran primero (las más baratas del camino crítico), cuándo aparece un segundo camino crítico y por qué cada día cuesta más que el anterior.',
        montar: montarAceleracion,
      },
    ],
    teoria: String.raw`
      <h2>El camino crítico como programa lineal</h2>
      <p>Sean \(s_i\) el instante de inicio de la actividad \(i\) y \(d_i\) su duración. Si \(i\) debe terminar antes de que \(j\) comience, se escribe
      la restricción lineal \(s_j \ge s_i + d_i\). Con una variable \(T\) para el fin del proyecto:</p>
      \[ \min\ T \quad \text{s.a.}\quad s_j - s_i \ge d_i \ \ (i \to j),\qquad T - s_j \ge d_j \ \ (\forall j),\qquad s \ge 0. \]
      <p>Su valor óptimo es la longitud del camino más largo del grafo de precedencias. Por eso el dual de este LP es un
      <a href="tema.html?id=shortest-path-lp">problema de camino</a> (en este caso, de camino máximo): las variables duales de las restricciones
      que son activas valen 1 sobre el camino crítico y 0 fuera de él.</p>
      <h2>Algoritmo: pasada hacia adelante y hacia atrás</h2>
      <pre><code>para cada actividad i en orden topológico:
    ES[i] ← máx{EF[p] : p precede a i}    (0 si no tiene)
    EF[i] ← ES[i] + d[i]
T ← máx EF[i]
para cada actividad i en orden inverso:
    LF[i] ← mín{LS[j] : i precede a j}    (T si no tiene sucesores)
    LS[i] ← LF[i] − d[i]
holgura[i] ← LS[i] − ES[i]               crítica si holgura = 0</code></pre>
      <p>Cuesta \(O(n + e)\) con \(n\) actividades y \(e\) precedencias. En el ejemplo, \(A \to C \to D \to G \to H\) dura \(4+5+6+5+2 = 22\) días;
      \(B\) tiene holgura 1, \(E\) tiene 2 y \(F\) tiene 2.</p>
      <p>El LP puede situar cada actividad con holgura en cualquier inicio entre \(ES\) y \(LS\); por eso el rombo de la primera figura no siempre
      coincide con el borde izquierdo de la barra, pero la duración total sí es la misma.</p>
      <h2>Aceleración (crashing)</h2>
      <p>Cada actividad puede acortarse hasta \(m_i\) días a un costo de \(k_i\) por día. Con \(c_i\) los días recortados:</p>
      \[ \min \sum_i k_i c_i \quad \text{s.a.}\quad s_j \ge s_i + (d_i - c_i)\ \ (i \to j),\quad s_i + d_i - c_i \le D,\quad 0 \le c_i \le d_i - m_i. \]
      <p>Como la matriz de restricciones es de flujo en red (<em>totalmente unimodular</em>), para plazos \(D\) enteros el óptimo tiene reducciones enteras.
      El costo \(C(D)\) es <strong>convexo y lineal por tramos</strong>: cada día adicional recortado cuesta al menos lo que costó el anterior, porque
      primero se acelera lo más barato y, a medida que otros caminos se vuelven críticos, hay que acelerar en paralelo
      (el mínimo corte del grafo de actividades críticas).</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Acelerar una actividad con holgura es gastar dinero sin ganar tiempo. El LP lo sabe: solo acelera
      actividades del camino crítico, y cuando hay varios caminos críticos paralelos acelera una actividad de cada uno.</p></div>
      <h2>Conexiones</h2>
      <ul>
        <li>El modelo es un caso de <a href="tema.html?id=network-flow-model">flujo en redes</a> y su dual es de <a href="tema.html?id=min-cost-flow">flujo de costo mínimo</a>.</li>
        <li>Si los recursos (cuadrillas, grúas) también son limitados, aparecen variables binarias y el problema pasa a ser entero:
        <a href="tema.html?id=problem-classes">LP, ILP, MILP y NLP</a>.</li>
        <li>Comparar la variación del costo con el plazo es un análisis de sensibilidad: <a href="tema.html?id=rhs-ranges">rangos de disponibilidad de recursos</a>.</li>
      </ul>`,
  });
})();
