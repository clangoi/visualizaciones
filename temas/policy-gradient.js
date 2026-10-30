(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const GAMMA = 0.95;
  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: aprender la política directamente ---------- */

  function montarReinforce(cuerpo) {
    let mapa = 'simple', lr = 0.003, base = true, semilla = 1, m = null, ag = null, hist = [], opt0 = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entorno', opciones: [['simple', 'Pequeño (4×4)'], ['trampas', 'Trampas (difícil)']], valor: mapa, alCambiar: (v) => { mapa = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Tasa de aprendizaje', opciones: [['0.001', '0,001'], ['0.003', '0,003'], ['0.01', '0,01']], valor: String(lr), alCambiar: (v) => { lr = +v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Restar una línea base al retorno', valor: base, alCambiar: (v) => { base = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3, velMax: 7 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 700 ? 340 : 540) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'flechas: probabilidad de cada acción según la red (más largas = más probables)', forma: 'linea' }, { color: C.s2, texto: 'retorno por episodio (media móvil)', forma: 'linea' }, { color: C.s6, texto: 'valor óptimo V(inicio)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La red recibe la posición y devuelve probabilidades para las cuatro acciones; el agente sortea su acción. Al final de cada episodio, las acciones tomadas se hacen más probables si el retorno fue mejor que el promedio y menos probables si fue peor (REINFORCE). En «Trampas» suele quedar en un óptimo local: aprende a evitar el −1, pero no a llegar al +1.');
    function iniciar() {
      m = DL.mundo(mapa); opt0 = DL.valoresOptimos(m, GAMMA, 0); ag = DL.agenteREINFORCE(m, { semilla, lr, base, gamma: GAMMA }); hist = [];
      return (function* () { while (ag.episodios < 600) { for (let k = 0; k < 5; k++) { const r = ag.correr(40); hist.push({ G: r.G, exito: r.exito }); } yield; } })();
    }
    function dibujar() {
      if (!ag) return;
      const { ctx, ancho: W } = lienzo, ancha = W > 700, c = Math.min(70, (ancha ? W * 0.3 : W * 0.6) / m.W);
      lienzo.limpiar();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Política aprendida π(a | s)', 4, 2);
      DL.dibujarMundo(ctx, m, 4, 20, c, { pol: ag.politica(), sinNumeros: true });
      const yg = ancha ? 20 : 20 + m.H * c + 36, xg = ancha ? 4 + m.W * c + 30 : 4, wg = ancha ? W - xg - 12 : W - 14, hg = ancha ? m.H * c : 170;
      const suave = hist.map((h, i) => { const a = hist.slice(Math.max(0, i - 24), i + 1); return [i + 1, a.reduce((s, q) => s + q.G, 0) / a.length]; });
      pl = VIZ.plano({ ancho: W, alto: yg + hg + 44, ctx }, { xmin: 1, xmax: 600, ymin: -1, ymax: 0.8 }, { etiquetaX: 'episodio', etiquetaY: 'retorno', margen: { izq: xg + 36, der: W - xg - wg, sup: yg, inf: 40 } });
      pl.ejes(); VIZ.trazar(ctx, pl, [[1, opt0.V[DL.celdaId(m, ...m.ini)]], [600, opt0.V[DL.celdaId(m, ...m.ini)]]], C.s6, 1.8, [4, 4]);
      VIZ.trazar(ctx, pl, hist.map((h, i) => [i + 1, Math.max(-1, h.G)]), VIZ.alfa(C.s2, 0.15), 1); VIZ.trazar(ctx, pl, suave, C.s2, 2.5);
      const ult = hist.slice(-50), ex = ult.filter((h) => h.exito).length, pi0 = ag.pi(...m.ini);
      registro.textContent = hist.length ? `Episodio ${hist.length}: retorno medio de los últimos 50 = ${f2(ult.reduce((s, h) => s + h.G, 0) / ult.length)}; llega a la meta ${ex} de ${ult.length} veces. En el inicio, la red elige ${DL.ACCIONES.map((a, k) => `${a[2]} ${VIZ.fmt(100 * pi0[k], 2)} %`).join(', ')}.` : 'Política inicial: casi uniforme (25 % por acción).';
      lectura.set([['episodios', String(ag.episodios)], ['llega a la meta (últimos 50)', `${ex} de ${ult.length}`], ['probabilidad de la mejor acción en el inicio', `${VIZ.fmt(100 * Math.max(...pi0), 3)} %`], ['parámetros', String(ag.nParametros)], ['línea base', base ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), c = Math.min(70, (lienzo.ancho > 700 ? lienzo.ancho * 0.3 : lienzo.ancho * 0.6) / m.W); if (!ag) return; const j = Math.floor((x - 4) / c), i = Math.floor((y - 20) / c); if (i >= 0 && i < m.H && j >= 0 && j < m.W && m.mapa[i][j] !== '#' && !m.terminal(i, j)) tip.mostrar(x, y, `π(· | (${i + 1}, ${j + 1}))<br>` + ag.pi(i, j).map((p, a) => `${DL.ACCIONES[a][2]}  ${VIZ.fmt(100 * p, 3)} %`).join('<br>')); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la señal de cada acción ---------- */

  function montarSenal(cuerpo) {
    let G = 0.8, linea = 0.2, p = [0.4, 0.3, 0.2, 0.1], a = 0, usarBase = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Retorno del episodio G', min: -1, max: 1, paso: 0.05, valor: G, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { G = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Línea base b (promedio habitual)', min: -1, max: 1, paso: 0.05, valor: linea, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { linea = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Acción que se tomó', opciones: DL.ACCIONES.map((q, i) => [String(i), q[2]]), valor: String(a), alCambiar: (v) => { a = +v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Restar la línea base', valor: usarBase, alCambiar: (v) => { usarBase = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'probabilidad actual de cada acción', forma: 'cuadro' }, { color: C.s6, texto: 'la actualización la aumenta', forma: 'cuadro' }, { color: C.s8, texto: 'la actualización la disminuye', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gradiente de REINFORCE sobre los logits de una política softmax: para cada acción k, (A)·(1[k = a] − πₖ), con A = G − b la «ventaja». Si el episodio salió mejor que lo habitual (A > 0), la acción tomada se refuerza y las demás se reducen; si salió peor, ocurre lo contrario.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, A = usarBase ? G - linea : G, bw = Math.min(110, (W - 40) / 4 - 10), x0 = (W - 4 * (bw + 10)) / 2, base = 150;
      lienzo.limpiar();
      const g = p.map((q, k) => A * ((k === a ? 1 : 0) - q)), mx = Math.max(0.3, ...g.map(Math.abs));
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(x0 - 4, base); ctx.lineTo(x0 + 4 * (bw + 10), base); ctx.stroke();
      p.forEach((q, k) => { const x = x0 + k * (bw + 10), h = q * 80, d = (g[k] / mx) * 60; ctx.fillStyle = C.s1; ctx.globalAlpha = 0.45; ctx.fillRect(x, base - h, bw / 2 - 2, h); ctx.globalAlpha = 1; ctx.fillStyle = g[k] >= 0 ? C.s6 : C.s8; ctx.fillRect(x + bw / 2, g[k] >= 0 ? base - d : base, bw / 2 - 2, Math.max(2, Math.abs(d))); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(DL.ACCIONES[k][2] + (k === a ? ' ✓' : ''), x + bw / 2, base + 66); ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.fillText(`π = ${VIZ.fmt(q, 2)}`, x + bw / 4, base + 6); ctx.fillText(`∇ = ${f2(g[k])}`, x + (3 * bw) / 4, base + (g[k] >= 0 ? 6 : 6 + 0)); });
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.fillText(`Ventaja A = G${usarBase ? ' − b' : ''} = ${f2(A)}`, 12, 8);
      registro.textContent = A > 0 ? `El episodio salió mejor de lo habitual (A = ${f2(A)}): el gradiente sube la probabilidad de ${DL.ACCIONES[a][2]} y baja la de las otras.` : A < 0 ? `El episodio salió peor de lo habitual (A = ${f2(A)}): el gradiente baja la probabilidad de ${DL.ACCIONES[a][2]}.` : 'A = 0: no hay actualización.';
      lectura.set([['G', f2(G)], ['línea base b', usarBase ? f2(linea) : 'no se usa'], ['ventaja A', f2(A)], ['norma de la actualización', f2(Math.hypot(...g))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); tip.ocultar(); });
    dibujar();
  }

  VIZ.registrarTema('policy-gradient', {
    intro: String.raw`
      <p>Hasta ahora el agente aprendía el valor de las acciones y actuaba eligiendo la de mayor valor. Los <strong>métodos de gradiente de política</strong> toman otro camino: la propia red <em>es</em> la política. Recibe el estado y devuelve una distribución de probabilidad sobre las acciones; el agente sortea de ella, y los pesos se ajustan para que las acciones que llevaron a buenos retornos se vuelvan más probables.</p>
      <p>Tiene ventajas: maneja acciones continuas, permite políticas estocásticas y optimiza directamente lo que importa. Su costo es que el gradiente es ruidoso: un episodio es una muestra única del retorno, y por eso se resta una <strong>línea base</strong>.</p>`,
    visualizaciones: [
      { titulo: 'Aprender la política con REINFORCE', descripcion: 'Entrene con y sin línea base y con distintas tasas. Compare el comportamiento en «Pequeño» y en «Trampas».', montar: montarReinforce },
      { titulo: 'La señal de aprendizaje', descripcion: 'Mueva el retorno y la línea base y vea cómo cambia la actualización de las probabilidades.', montar: montarSenal },
    ],
    teoria: String.raw`
      <h2>Teorema del gradiente de política</h2>
      <p>Sea \(J(\theta)=\mathbb{E}_{\tau\sim\pi_\theta}[G(\tau)]\) el retorno esperado de la política \(\pi_\theta\). Entonces</p>
      \[ \nabla_\theta J(\theta)=\mathbb{E}_{\tau\sim\pi_\theta}\Big[\sum_{t}\nabla_\theta\log\pi_\theta(a_t\mid s_t)\,G_t\Big]. \]
      <p>(El «truco del logaritmo»: \(\nabla\pi=\pi\,\nabla\log\pi\).) Se estima con episodios simulados, y \(\theta\) sube por ascenso de gradiente.</p>
      <h2>REINFORCE con línea base</h2>
      \[ \theta\leftarrow\theta+\eta\sum_t\big(G_t-b(s_t)\big)\,\nabla_\theta\log\pi_\theta(a_t\mid s_t). \]
      <p>Restar una línea base \(b\) que no dependa de la acción no cambia la esperanza del gradiente, pero reduce mucho su varianza. Si \(b(s)=V^\pi(s)\) y se aprende con una segunda red, se obtiene un método <em>actor–crítico</em>: el actor es la política y el crítico estima \(V\).</p>
      <h2>Con una red softmax</h2>
      <p>Si los logits son \(z\) y \(\pi=\operatorname{softmax}(z)\), entonces \(\partial\log\pi_a/\partial z_k=\mathbb{1}[k=a]-\pi_k\): el gradiente sube el logit de la acción tomada y baja los demás en proporción a sus probabilidades. Se retropropaga a la red como cualquier gradiente de salida (<a href="tema.html?id=backpropagation">Backpropagation</a>).</p>
      <table>
        <tr><th></th><th>Basado en valor (DQN)</th><th>Gradiente de política</th></tr>
        <tr><td>Aprende</td><td>\(Q(s,a)\)</td><td>\(\pi(a\mid s)\)</td></tr>
        <tr><td>Acciones continuas</td><td>difícil</td><td>natural</td></tr>
        <tr><td>Eficiencia de datos</td><td>mayor (memoria de repetición)</td><td>menor (en política)</td></tr>
        <tr><td>Varianza</td><td>menor</td><td>mayor</td></tr>
      </table>
      <div class="recuadro"><p>PPO y TRPO limitan cuánto puede cambiar la política en cada actualización; son la base del ajuste de modelos de lenguaje con retroalimentación humana. Comparar con <a href="tema.html?id=deep-q-network">Deep Q-Network</a>.</p></div>`,
  });
})();
