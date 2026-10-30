(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const GAMMA = 0.95;
  const VARIANTES = [['ambos', 'repetición + red objetivo', { }, C.s6], ['soloRep', 'solo memoria de repetición', { objetivo: false }, C.s1], ['soloObj', 'solo red objetivo', { replay: false }, C.s4], ['ninguno', 'ninguno (Q-learning con red, un paso)', { replay: false, objetivo: false }, C.s2]];

  /* ---------- Fig. 1: ablación de los dos ingredientes ---------- */

  function montarAblacion(cuerpo) {
    let semilla = 2, m = null, ags = [], hist = [], opt0 = null, hover = -1, pls = [null, null];
    const ctl = VIZ.controles(cuerpo);
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const l1 = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 340 }), l2 = VIZ.lienzo(cols, { proporcion: 0.9, altoMin: 260, altoMax: 340 });
    const tip1 = VIZ.tooltip(l1), tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, VARIANTES.map(([, t, , c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cuatro agentes DQN idénticos, salvo por los dos ingredientes, aprenden el mismo mundo. Izquierda: retorno promedio de los últimos 10 episodios. Derecha: error medio entre el valor que estima la red y el valor óptimo exacto. Los resultados varían con la semilla: repita varias veces.');
    function iniciar() {
      m = DL.mundo('simple'); opt0 = DL.valoresOptimos(m, GAMMA, 0);
      ags = VARIANTES.map(([, , cfg]) => DL.agenteDQN(m, { semilla, gamma: GAMMA, ...cfg })); hist = VARIANTES.map(() => []);
      const V0 = opt0.V;
      return (function* () { while (ags[0].episodios < 150) { ags.forEach((ag, k) => { const r = ag.correr(40), V = ag.Vred(); let e = 0, n = 0; for (const [i, j] of DL.estados(m)) { e += Math.abs(V[DL.celdaId(m, i, j)] - V0[DL.celdaId(m, i, j)]); n++; } hist[k].push({ G: r.G, err: e / n, exito: r.exito }); }); yield; } })();
    }
    function panel(l, tipo, i) {
      const { ctx } = l; l.limpiar();
      const dom = tipo === 'G' ? { xmin: 1, xmax: 150, ymin: -1, ymax: 0.8 } : { xmin: 1, xmax: 150, ymin: 0, ymax: 1 };
      const p = VIZ.plano(l, dom, { etiquetaX: 'episodio', etiquetaY: tipo === 'G' ? 'retorno (media móvil)' : 'error de V (media)' }); p.ejes(); pls[i] = p;
      hist.forEach((h, k) => { const pts = h.map((q, e) => { const a = h.slice(Math.max(0, e - 9), e + 1); return [e + 1, tipo === 'G' ? a.reduce((s, z) => s + z.G, 0) / a.length : Math.min(1, a.reduce((s, z) => s + z.err, 0) / a.length)]; }); VIZ.trazar(ctx, p, pts, VARIANTES[k][3], 2.3); });
      if (tipo === 'G') VIZ.trazar(ctx, p, [[1, opt0.V[DL.celdaId(m, ...m.ini)]], [150, opt0.V[DL.celdaId(m, ...m.ini)]]], C.apagado, 1.4, [4, 4]);
    }
    function dibujar() {
      if (!ags.length) return;
      panel(l1, 'G', 0); panel(l2, 'E', 1);
      const u = hist.map((h) => h.slice(-20)), nombre = (k) => VARIANTES[k][1].split(' (')[0];
      registro.textContent = hist[0].length ? `Episodio ${hist[0].length}. Error de V en los últimos 20: ${VARIANTES.map((_, k) => `${nombre(k)}: ${VIZ.fmt(u[k].reduce((s, q) => s + q.err, 0) / Math.max(1, u[k].length), 2)}`).join(' · ')}.` : 'Pulse Reproducir para entrenar los cuatro agentes a la vez.';
      lectura.set(VARIANTES.map(([, t], k) => [`${t.split(' (')[0]}: llega a la meta (últimos 20)`, `${u[k].filter((q) => q.exito).length} de ${u[k].length}`]));
    }
    l1.alDibujar = dibujar; l2.alDibujar = dibujar;
    [[l1, tip1, 'G', 0], [l2, tip2, 'E', 1]].forEach(([l, t, tipo, i]) => {
      l.canvas.addEventListener('pointermove', (ev) => { const { x, y } = l.posicion(ev); if (!pls[i] || !pls[i].dentro(x, y) || !hist.length || !hist[0].length) return t.ocultar(); const e = Math.max(0, Math.min(hist[0].length - 1, Math.round(pls[i].ix(x)) - 1)); t.mostrar(x, y, `episodio <b>${e + 1}</b>` + VARIANTES.map(([, tx, , c], k) => { const a = hist[k].slice(Math.max(0, e - 9), e + 1); return VIZ.filaTooltip(c, tx.split(' (')[0].replace('repetición + red objetivo', 'ambos'), VIZ.fmt(tipo === 'G' ? a.reduce((s, z) => s + z.G, 0) / a.length : a.reduce((s, z) => s + z.err, 0) / a.length, 3)); }).join('')); });
      l.canvas.addEventListener('pointerleave', () => t.ocultar());
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: repetición priorizada ---------- */

  function montarPriorizada(cuerpo) {
    let alfa = 0.6, semilla = 1, ag = null, m = null, listo = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Reunir experiencia (60 episodios)', () => { m = DL.mundo('simple'); ag = DL.agenteDQN(m, { semilla, gamma: GAMMA, priorizado: true, episodiosEps: 40 }); for (let k = 0; k < 60; k++) ag.correr(40); listo = true; dibujar(); }, { primario: true });
    ctl.boton('Otra semilla', () => { semilla++; listo = false; dibujar(); });
    ctl.rango({ etiqueta: 'Exponente de prioridad α (0 = uniforme)', min: 0, max: 1.5, paso: 0.1, valor: alfa, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { alfa = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 340 : 560) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'más oscuro = más transiciones / más probabilidad de ser muestreada', forma: 'cuadro' }, { color: C.s6, texto: 'transiciones que terminan en la meta', forma: 'cuadro' }, { color: C.apagado, texto: 'resto', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con un muestreo uniforme, cada transición guardada tiene la misma probabilidad. Con prioridad, la probabilidad crece con el error TD |δ|^α: las transiciones sorprendentes, como llegar a la meta (poco frecuentes y muy informativas), se repiten más. Se corrige el sesgo resultante con pesos de importancia.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 700;
      lienzo.limpiar();
      if (!listo) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(12); ctx.textAlign = 'left'; ctx.fillText('Pulse «Reunir experiencia» para entrenar un agente y mirar su memoria.', 12, 24); registro.textContent = 'Aún no hay memoria.'; return; }
      const mem = ag.datosMemoria(), pr = mem.map((t) => (t.prio + 0.02) ** alfa), zP = pr.reduce((s, v) => s + v, 0), c = Math.min(66, (ancha ? W * 0.28 : W * 0.45) / m.W);
      const cnt = new Float64Array(m.n), pb = new Float64Array(m.n); mem.forEach((t, k) => { const id = DL.celdaId(m, t.s[0], t.s[1]); cnt[id] += 1 / mem.length; pb[id] += pr[k] / zP; });
      const pinta = (V, x0, tit) => { ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(tit, x0, 2); const mx = Math.max(...V); for (let i = 0; i < m.H; i++) for (let j = 0; j < m.W; j++) { const ch = m.mapa[i][j], v = V[DL.celdaId(m, i, j)]; ctx.fillStyle = ch === '#' ? C.tinta : VIZ.css(VIZ.enRampa(Math.min(1, v / (mx || 1)))); ctx.fillRect(x0 + j * c + 1, 20 + i * c + 1, c - 2, c - 2); if (ch !== '#') { ctx.fillStyle = v / (mx || 1) > 0.55 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${VIZ.fmt(100 * v, 2)} %`, x0 + (j + 0.5) * c, 20 + (i + 0.5) * c); } } };
      pinta(cnt, 4, 'Muestreo uniforme: fracción por casilla'); const x2 = 4 + m.W * c + 24; pinta(pb, x2, 'Con prioridad: fracción por casilla');
      const meta = mem.map((t, k) => (t.fin && m.mapa[t.s2[0]][t.s2[1]] === 'G' ? k : -1)).filter((k) => k >= 0), pU = meta.length / mem.length, pP = meta.reduce((s, k) => s + pr[k] / zP, 0);
      const by = ancha ? 20 : 20 + m.H * c + 28, bx = ancha ? x2 + m.W * c + 30 : 4, bw = ancha ? W - bx - 14 : W - 20;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Fracción del muestreo que corresponde a llegar a la meta', bx, by - 16);
      [['uniforme', pU, C.apagado], ['con prioridad', pP, C.s6]].forEach(([t, v, col], i) => { const y = by + 8 + i * 34; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.fillText(t, bx, y); ctx.fillStyle = col; ctx.fillRect(bx + 100, y - 2, Math.max(2, v * Math.max(60, bw - 170) * 4), 18); ctx.fillStyle = C.tinta; ctx.fillText(`${VIZ.fmt(100 * v, 3)} %`, bx + 106 + v * Math.max(60, bw - 170) * 4, y); });
      const mp = Math.max(...pr) / (zP / mem.length);
      registro.textContent = `La memoria tiene ${mem.length} transiciones; ${meta.length} (${VIZ.fmt(100 * pU, 3)} %) llegan a la meta. Con α = ${VIZ.fmt(alfa, 2)} se muestrean el ${VIZ.fmt(100 * pP, 3)} % de las veces: ${pU ? VIZ.fmt(pP / pU, 3) : '—'} veces más.`;
      lectura.set([['transiciones en memoria', String(mem.length)], ['llegadas a la meta en memoria', String(meta.length)], ['peso en muestreo uniforme', `${VIZ.fmt(100 * pU, 3)} %`], ['peso con prioridad', `${VIZ.fmt(100 * pP, 3)} %`], ['mayor probabilidad relativa a la media', `${VIZ.fmt(mp, 3)}×`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('replay-target-networks', {
    intro: String.raw`
      <p>Entrenar una red con la experiencia de un agente rompe dos supuestos del aprendizaje supervisado: los datos consecutivos están <em>muy correlacionados</em> (el agente ve lo mismo una y otra vez) y los «objetivos» <em>se mueven</em> (dependen de la propia red). Dos ideas lo arreglan.</p>
      <p>La <strong>memoria de repetición</strong> (<em>experience replay</em>) guarda las transiciones y entrena con lotes tomados al azar de ellas, rompiendo la correlación y reutilizando cada experiencia. La <strong>red objetivo</strong> (<em>target network</em>) es una copia congelada de la red que calcula los objetivos y se actualiza solo cada tanto, para que el objetivo deje de moverse en cada paso. Una mejora es la <strong>repetición priorizada</strong>, que muestrea con más frecuencia las transiciones más sorprendentes.</p>`,
    visualizaciones: [
      { titulo: 'Con y sin los dos ingredientes', descripcion: 'Entrene cuatro agentes a la vez y compare retorno y error de valor. Repita con varias semillas: el ingrediente que más ayuda cambia de una a otra.', montar: montarAblacion },
      { titulo: 'Repetición priorizada', descripcion: 'Junte experiencia y suba α: las llegadas a la meta, que son raras, pasan a muestrearse mucho más.', montar: montarPriorizada },
    ],
    teoria: String.raw`
      <h2>Memoria de repetición</h2>
      <p>Una memoria circular \(\mathcal{D}\) de capacidad \(N\) guarda \((s,a,r,s',\text{fin})\). Cada paso se toma un lote de tamaño \(B\) al azar. Ventajas: (1) se rompe la correlación temporal, de modo que los lotes se parecen más a datos independientes; (2) cada transición se usa muchas veces, lo que da eficiencia de datos; (3) se promedia sobre muchas políticas antiguas, lo que suaviza el aprendizaje.</p>
      <h2>Red objetivo</h2>
      <p>El objetivo \(y=r+\gamma\max_{a'}Q_{\theta^-}(s',a')\) usa parámetros \(\theta^-\) que se copian de \(\theta\) cada \(C\) pasos (o se actualizan lentamente, \(\theta^-\leftarrow\tau\theta+(1-\tau)\theta^-\)). Sin ella, cada actualización cambia también el objetivo y el aprendizaje puede oscilar o divergir: se «persigue su propia cola».</p>
      <h2>Repetición priorizada</h2>
      <p>Se asigna a cada transición una prioridad \(p_i=|\delta_i|+\epsilon\) y se muestrea con probabilidad</p>
      \[ P(i)=\frac{p_i^{\alpha}}{\sum_k p_k^{\alpha}}, \]
      <p>donde \(\alpha=0\) es el muestreo uniforme. Como esto cambia la distribución de los datos, se corrige con pesos de importancia \(w_i=\big(N\,P(i)\big)^{-\beta}\), normalizados por su máximo, que multiplican el error de cada transición. Ayuda sobre todo con recompensas escasas.</p>
      <div class="recuadro"><p>La memoria de repetición es el análogo en refuerzo del <em>repaso</em> que evita el <a href="tema.html?id=catastrophic-forgetting">olvido catastrófico</a>. Contexto del algoritmo completo: <a href="tema.html?id=deep-q-network">Deep Q-Network</a>.</p></div>`,
  });
})();
