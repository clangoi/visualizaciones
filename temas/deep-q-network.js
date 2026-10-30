(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');
  const MAPA = 'simple', GAMMA = 0.95;

  /* ---------- Fig. 1: una red aprende Q(s, a) ---------- */

  function montarEntrenamiento(cuerpo) {
    let lr = 0.005, semilla = 1, m = null, ag = null, opt = null, hist = [], pl = null, eps = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tasa de aprendizaje', opciones: [['0.002', '0,002'], ['0.005', '0,005'], ['0.02', '0,02']], valor: String(lr), alCambiar: (v) => { lr = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 360 : 560) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'max Q(s, ·) de la red', forma: 'cuadro' }, { color: C.tinta, texto: 'flecha: acción voraz de la red', forma: 'linea' }, { color: C.s2, texto: 'retorno de cada episodio (suavizado)', forma: 'linea' }, { color: C.s6, texto: 'valor óptimo V(inicio)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La red recibe la posición (fila, columna) y devuelve cuatro números: Q(s, ↑), Q(s, →), Q(s, ↓), Q(s, ←). Aprende solo de la experiencia (memoria de repetición + red objetivo + ε-voraz, que baja de 1 a 0,05). A la izquierda, lo que aprendió; en el medio, el valor óptimo calculado con el modelo, para comparar.');
    let opt0 = null;
    function iniciar() {
      m = DL.mundo(MAPA); opt0 = DL.valoresOptimos(m, GAMMA, 0); ag = DL.agenteDQN(m, { semilla, lr, gamma: GAMMA }); hist = [];
      return (function* () { while (ag.episodios < 200) { for (let k = 0; k < 2; k++) { const r = ag.correr(40); hist.push({ G: r.G, eps: r.eps, exito: r.exito }); } yield; } })();
    }
    function dibujar() {
      if (!ag) return;
      const { ctx, ancho: W } = lienzo, ancha = W > 700, c = Math.min(70, (ancha ? W * 0.28 : W * 0.45) / m.W * 1.0);
      lienzo.limpiar();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('Q aprendida (max por casilla)', 4, 2); DL.dibujarMundo(ctx, m, 4, 20, c, { V: ag.Vred(), pol: ag.politicaGreedy() });
      const x2 = ancha ? 4 + m.W * c + 28 : 4 + m.W * c + 12; ctx.fillText('Valor óptimo (con el modelo)', x2, 2); DL.dibujarMundo(ctx, m, x2, 20, c, { V: opt0.V, pol: opt0.pol });
      // Curva de retornos.
      const yg = ancha ? 20 : 20 + m.H * c + 40, xg = ancha ? x2 + m.W * c + 40 : 4, wg = ancha ? W - xg - 10 : W - 14, hg = ancha ? m.H * c : 160;
      const suave = hist.map((h, i) => { const a = hist.slice(Math.max(0, i - 9), i + 1); return [i + 1, a.reduce((s, q) => s + q.G, 0) / a.length]; });
      pl = VIZ.plano({ ancho: W, alto: yg + hg + 44, ctx }, { xmin: 1, xmax: 200, ymin: -1, ymax: 0.8 }, { etiquetaX: 'episodio', etiquetaY: 'retorno', margen: { izq: xg + 36, der: W - xg - wg, sup: yg, inf: 40 } });
      pl.ejes(); VIZ.trazar(ctx, pl, [[1, opt0.V[DL.celdaId(m, ...m.ini)]], [200, opt0.V[DL.celdaId(m, ...m.ini)]]], C.s6, 1.8, [4, 4]);
      VIZ.trazar(ctx, pl, hist.map((h, i) => [i + 1, Math.max(-1, h.G)]), VIZ.alfa(C.s2, 0.25), 1); VIZ.trazar(ctx, pl, suave, C.s2, 2.5);
      const u = hist[hist.length - 1], ult = hist.slice(-20), ex = ult.filter((h) => h.exito).length;
      let err = 0, n = 0; const V = ag.Vred(); for (const [i, j] of DL.estados(m)) { err += Math.abs(V[DL.celdaId(m, i, j)] - opt0.V[DL.celdaId(m, i, j)]); n++; }
      registro.textContent = hist.length ? `Episodio ${hist.length}: retorno ${f2(u.G)}, ε = ${VIZ.fmt(u.eps, 2)}. En los últimos ${ult.length}, llega a la meta ${ex} veces. Error medio de V frente al óptimo: ${VIZ.fmt(err / n, 3)}.` : 'Red sin entrenar: sus Q son casi cero y la política no significa nada. Pulse Reproducir.';
      lectura.set([['episodios', String(ag.episodios)], ['pasos de experiencia', VIZ.entero(ag.pasos)], ['transiciones en memoria', VIZ.entero(ag.memoria)], ['llega a la meta (últimos 20)', `${ex} de ${ult.length}`], ['error medio |V − V*|', hist.length ? VIZ.fmt(err / n, 3) : '—'], ['parámetros de la red', String(ag.nParametros)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), c = Math.min(70, (lienzo.ancho > 700 ? lienzo.ancho * 0.28 : lienzo.ancho * 0.45) / m.W); if (!ag) return; const j = Math.floor((x - 4) / c), i = Math.floor((y - 20) / c); if (i >= 0 && i < m.H && j >= 0 && j < m.W && m.mapa[i][j] !== '#' && !m.terminal(i, j)) { const q = ag.q(i, j); tip.mostrar(x, y, `(${i + 1}, ${j + 1})<br>` + q.map((v, a) => `Q(${DL.ACCIONES[a][2]}) = ${f2(v)}`).join('<br>')); } else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el objetivo de aprendizaje de un paso ---------- */

  function montarObjetivo(cuerpo) {
    let ag = null, m = null, sel = [1, 0], act = 2, trained = false, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Entrenar la red (150 episodios)', () => { for (let k = 0; k < 150; k++) ag.correr(40); trained = true; dibujar(); }, { primario: true });
    ctl.boton('Red nueva', () => { ag = DL.agenteDQN(m, { semilla: 5 }); trained = false; dibujar(); });
    ctl.selector({ etiqueta: 'Acción a evaluar', opciones: DL.ACCIONES.map((a, i) => [String(i), a[2]]), valor: String(act), alCambiar: (v) => { act = +v; dibujar(); } });
    m = DL.mundo(MAPA); ag = DL.agenteDQN(m, { semilla: 5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 330 : 520) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'casilla elegida', forma: 'cuadro' }, { color: C.s1, texto: 'Q(s, a) que predice la red', forma: 'cuadro' }, { color: C.s6, texto: 'objetivo: r + γ·máx Q(s′, ·)', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una casilla y elija una acción. La red predice Q(s, a); el entorno da una recompensa r y una casilla siguiente s′; el objetivo es r + γ·máx Q(s′, ·). Entrenar es reducir la diferencia (el error TD) con descenso de gradiente. En una red bien entrenada, la diferencia es casi cero en todas partes.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 700, c = Math.min(66, ancha ? W * 0.3 / m.W : W * 0.7 / m.W);
      lienzo.limpiar();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Elija una casilla', 4, 2);
      DL.dibujarMundo(ctx, m, 4, 20, c, { V: ag.Vred(), sinNumeros: true });
      geo = { c };
      ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.strokeRect(4 + sel[1] * c + 1, 20 + sel[0] * c + 1, c - 2, c - 2);
      const [i, j] = sel, esT = m.terminal(i, j) || m.mapa[i][j] === '#', q = esT ? [0, 0, 0, 0] : ag.q(i, j);
      const tr = esT ? null : m.transiciones(i, j, act, 0)[0], q2 = tr ? ag.q(tr.i, tr.j) : [0, 0, 0, 0], sig = tr && !m.terminal(tr.i, tr.j) ? Math.max(...q2) : 0, obj = tr ? tr.r + GAMMA * sig : 0;
      const bx = ancha ? 4 + m.W * c + 40 : 4, by = ancha ? 20 : 20 + m.H * c + 24, bw = ancha ? W - bx - 20 : W - 20;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText(esT ? 'Casilla sin acciones' : `Salida de la red en (${i + 1}, ${j + 1})`, bx, by - 18 + 2);
      const esc = Math.max(1, ...q.map(Math.abs), Math.abs(obj));
      const barra = (k, y, v, col, etq) => { const w = (Math.abs(v) / esc) * (bw - 120), x0 = bx + 110; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(etq, bx + 104, y + 10); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(v >= 0 ? x0 : x0 - w, y, Math.max(2, w), 20, 4); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.fillText(f2(v), x0 + (v >= 0 ? w : 0) + 6, y + 10); };
      q.forEach((v, a) => barra(a, by + a * 26, v, a === act ? C.s1 : VIZ.alfa(C.s1, 0.4), `Q(${DL.ACCIONES[a][2]})${a === act ? ' ←' : ''}`));
      if (tr) { const y2 = by + 4 * 26 + 12; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.fillText(`Tras ${DL.ACCIONES[act][2]}: recompensa ${f2(tr.r)}, nueva casilla (${tr.i + 1}, ${tr.j + 1})${m.terminal(tr.i, tr.j) ? ' (terminal)' : ''}`, bx, y2); barra(0, y2 + 20, obj, C.s6, 'objetivo'); barra(0, y2 + 48, obj - q[act], C.s8, 'error TD'); }
      registro.textContent = tr ? `r + γ·máx Q(s′) = ${f2(tr.r)} + ${VIZ.fmt(GAMMA, 2)}·${f2(sig)} = ${f2(obj)}. La red predice ${f2(q[act])}: error TD ${f2(obj - q[act])}${trained ? '' : ' (red sin entrenar: grande)'}.` : 'Elija una casilla libre que no sea meta ni trampa.';
      lectura.set([['red entrenada', trained ? 'sí' : 'no'], ['Q(s, a)', f2(q[act])], ['objetivo', f2(obj)], ['error TD', f2(obj - q[act])], ['valor óptimo V*(s)', f2(DL.valoresOptimos(m, GAMMA, 0).V[DL.celdaId(m, i, j)])]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), j = Math.floor((x - 4) / geo.c), i = Math.floor((y - 20) / geo.c); if (i >= 0 && i < m.H && j >= 0 && j < m.W && m.mapa[i][j] !== '#') { sel = [i, j]; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), j = Math.floor((x - 4) / geo.c), i = Math.floor((y - 20) / geo.c); if (geo && i >= 0 && i < m.H && j >= 0 && j < m.W) tip.mostrar(x, y, `casilla (${i + 1}, ${j + 1})`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('deep-q-network', {
    intro: String.raw`
      <p>Con unas pocas casillas, la función de valor se puede guardar en una tabla: una celda para cada par estado–acción. Pero en un videojuego, el «estado» es una imagen de miles de píxeles, y hay más estados posibles que átomos en el universo. La tabla es imposible.</p>
      <p>Una <strong>Deep Q-Network</strong> (DQN) reemplaza la tabla por una red neuronal que recibe el estado y devuelve el valor \(Q(s,a)\) de cada acción. Como la red generaliza, estados parecidos reciben valores parecidos. Se entrena para que \(Q(s,a)\) se parezca a \(r+\gamma\max_{a'}Q(s',a')\), usando solo la experiencia que el agente va acumulando.</p>`,
    visualizaciones: [
      { titulo: 'Aprender Q con una red', descripcion: 'Entrene la DQN y compare lo que aprende con el valor óptimo calculado con el modelo. Mire cómo el retorno sube y ε baja.', montar: montarEntrenamiento },
      { titulo: 'El objetivo de un paso', descripcion: 'Elija una casilla y una acción y compare la predicción de la red con el objetivo r + γ·máx Q(s′). Entrene y vea cómo el error TD se achica.', montar: montarObjetivo },
    ],
    teoria: String.raw`
      <h2>Q-learning con una red</h2>
      <p>El Q-learning tabular actualiza \(Q(s,a)\leftarrow Q(s,a)+\alpha\,\delta\) con el <em>error TD</em> \(\delta=r+\gamma\max_{a'}Q(s',a')-Q(s,a)\). Con una red \(Q_\theta\), esa actualización se convierte en un paso de descenso de gradiente sobre la pérdida</p>
      \[ \mathcal{L}(\theta)=\mathbb{E}_{(s,a,r,s')}\Big[\big(r+\gamma\max_{a'}Q_{\theta^-}(s',a')-Q_\theta(s,a)\big)^2\Big], \]
      <p>donde \(\theta^-\) son los parámetros de la <a href="tema.html?id=replay-target-networks">red objetivo</a> y la esperanza se toma sobre una <a href="tema.html?id=replay-target-networks">memoria de repetición</a>. El objetivo se trata como constante: el gradiente solo pasa por \(Q_\theta(s,a)\).</p>
      <h2>Algoritmo</h2>
      <pre><code>inicializar la red Q (θ) y la red objetivo (θ⁻ ← θ), la memoria D vacía
para cada episodio:
    s ← estado inicial
    mientras no termine:
        a ← aleatoria con probabilidad ε; si no, argmaxₐ Q(s, a; θ)
        ejecutar a; observar r, s′; guardar (s, a, r, s′, fin) en D
        tomar un lote de D; y ← r + γ·maxₐ′ Q(s′, a′; θ⁻)   (y ← r si es terminal)
        un paso de gradiente sobre (y − Q(s, a; θ))²
        cada C pasos: θ⁻ ← θ</code></pre>
      <h2>Por qué es delicado</h2>
      <p>Combina tres ingredientes que, juntos, pueden divergir (la «tríada letal»): aproximación de funciones, <em>bootstrapping</em> (el objetivo depende de la propia red) y aprendizaje fuera de política. La memoria de repetición y la red objetivo existen para estabilizarlo.</p>
      <div class="recuadro"><p>DQN (Mnih et al., 2015) alcanzó nivel humano en muchos juegos de Atari con una CNN que recibía los píxeles de la pantalla. Aquí la entrada son dos números; la idea es la misma. Los métodos que aprenden la política directamente, sin pasar por \(Q\), se ven en <a href="tema.html?id=policy-gradient">Policy Gradient</a>.</p></div>`,
  });
})();
