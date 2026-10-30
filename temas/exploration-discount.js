(function () {
  'use strict';
  const { color: C } = VIZ;

  const EPS = [0, 0.02, 0.1, 0.3], COL = [C.s2, C.s4, C.s1, C.s6];

  /* ---------- Fig. 1: ε-greedy en un bandido de 5 brazos ---------- */

  function montarBandido(cuerpo) {
    let semilla = 1, optimista = false, medias = [], res = [], hover = -1, pl = null;
    const T = 600;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Estimaciones iniciales optimistas (Q₀ = 3)', valor: optimista, alCambiar: (v) => { optimista = v; calcular(); } });
    ctl.boton('Otras máquinas', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...EPS.map((e, i) => ({ color: COL[i], texto: `ε = ${e}${e === 0 ? ' (siempre explotar)' : ''}`, forma: 'linea' })), { color: C.apagado, texto: 'recompensa media del mejor brazo', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cinco máquinas tragamonedas con recompensas medias desconocidas (σ = 1). Con probabilidad ε el agente prueba un brazo al azar (explorar); si no, juega el que parece mejor (explotar). Promedio de 150 repeticiones. Sin explorar, el agente se aferra al primer brazo aceptable.');
    function calcular() {
      const r0 = VIZ.semilla(semilla * 3 + 1); medias = Array.from({ length: 5 }, () => VIZ.normal(r0));
      const mejor = Math.max(...medias);
      res = EPS.map((e, k) => { const prom = new Float64Array(T), opt = new Float64Array(T), r = VIZ.semilla(100 + k + semilla * 7);
        for (let rep = 0; rep < 150; rep++) { const Q = new Array(5).fill(optimista ? 3 : 0), N = new Array(5).fill(0); for (let t = 0; t < T; t++) { let a = r() < e ? Math.floor(r() * 5) : Q.indexOf(Math.max(...Q)); const rew = medias[a] + VIZ.normal(r); N[a]++; Q[a] += (rew - Q[a]) / N[a]; prom[t] += rew / 150; opt[t] += (medias[a] === mejor ? 1 : 0) / 150; } }
        return { prom, opt }; });
      calcular.mejor = mejor; dibujar();
    }
    function suave(a) { const s = []; for (let t = 0; t < a.length; t += 5) { let z = 0, n = 0; for (let q = Math.max(0, t - 10); q <= Math.min(a.length - 1, t + 10); q++) { z += a[q]; n++; } s.push([t, z / n]); } return s; }
    function dibujar() {
      if (!res.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: T, ymin: Math.min(0, ...medias) - 0.2, ymax: calcular.mejor + 0.4 }, { etiquetaX: 'paso', etiquetaY: 'recompensa media obtenida' });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, calcular.mejor], [T, calcular.mejor]], C.apagado, 1.5, [4, 4]);
      res.forEach((r, i) => VIZ.trazar(ctx, pl, suave(r.prom), COL[i], 2.3));
      if (hover >= 0) res.forEach((r, i) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(r.prom[hover]), COL[i], 4));
      const fin = res.map((r) => r.prom.slice(-100).reduce((s, v) => s + v, 0) / 100);
      registro.textContent = `Recompensa media en los últimos 100 pasos: ${EPS.map((e, i) => `ε = ${e}: ${VIZ.fmt(fin[i], 3)}`).join('; ')} (el mejor brazo da ${VIZ.fmt(calcular.mejor, 3)}).`;
      lectura.set(EPS.map((e, i) => [`ε = ${e}: elige el mejor brazo`, `${VIZ.fmt(100 * res[i].opt.slice(-100).reduce((s, v) => s + v, 0) / 100, 3)} %`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y) || !res.length) { hover = -1; tip.ocultar(); return; } hover = Math.max(0, Math.min(T - 1, Math.round(pl.ix(x)))); dibujar(); tip.mostrar(x, y, `paso <b>${hover}</b>` + EPS.map((e, i) => VIZ.filaTooltip(COL[i], `ε = ${e}`, VIZ.fmt(res[i].prom[hover], 3))).join('')); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: el descuento decide cuánto pesa el futuro ---------- */

  function montarDescuento(cuerpo) {
    let R1 = 1, T1 = 3, R2 = 3, T2 = 12, gamma = 0.9, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Recompensa cercana R₁', min: 0.5, max: 5, paso: 0.5, valor: R1, alCambiar: (v) => { R1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pasos hasta R₁', min: 1, max: 20, valor: T1, alCambiar: (v) => { T1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Recompensa lejana R₂', min: 0.5, max: 10, paso: 0.5, valor: R2, alCambiar: (v) => { R2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Pasos hasta R₂', min: 1, max: 40, valor: T2, alCambiar: (v) => { T2 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Descuento γ', min: 0.5, max: 0.999, paso: 0.001, valor: gamma, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { gamma = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor presente de la recompensa cercana', forma: 'linea' }, { color: C.s2, texto: 'valor presente de la lejana', forma: 'linea' }, { color: C.s6, texto: 'γ en el que cambia la decisión', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos recompensas, una cercana y otra lejana y mayor. Su valor presente es R·γ^t. Con γ pequeño el agente es «impaciente» y prefiere la cercana; con γ cercano a 1, espera por la grande. Mueva γ y busque el punto de cruce.');
    const vp = (R, T, g) => R * g ** T;
    const cruce = () => { let lo = 0.5, hi = 0.9999; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (vp(R2, T2, m) > vp(R1, T1, m)) hi = m; else lo = m; } return vp(R2, T2, 0.9999) > vp(R1, T1, 0.9999) && vp(R2, T2, 0.5) < vp(R1, T1, 0.5) ? hi : null; };
    function dibujar() {
      const { ctx } = lienzo, gs = Array.from({ length: 200 }, (_, i) => 0.5 + (0.4999 * i) / 199);
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: 1, ymin: 0, ymax: Math.max(R1, R2) * 1.05 }, { etiquetaX: 'descuento γ', etiquetaY: 'valor presente' });
      pl.ejes();
      VIZ.trazar(ctx, pl, gs.map((g) => [g, vp(R1, T1, g)]), C.s1, 2.5); VIZ.trazar(ctx, pl, gs.map((g) => [g, vp(R2, T2, g)]), C.s2, 2.5);
      const g0 = cruce(); if (g0) VIZ.marcador(ctx, pl.sx(g0), pl.sy(vp(R1, T1, g0)), C.s6, 6);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(gamma), pl.y0); ctx.lineTo(pl.sx(gamma), pl.y1); ctx.stroke(); ctx.setLineDash([]);
      const a = vp(R1, T1, gamma), b = vp(R2, T2, gamma);
      registro.textContent = `Con γ = ${VIZ.fmt(gamma, 3)}: la cercana vale ${VIZ.fmt(a, 3)} y la lejana ${VIZ.fmt(b, 3)}: el agente prefiere la ${a > b ? 'cercana' : 'lejana'}.${g0 ? ` Cambia de decisión en γ ≈ ${VIZ.fmt(g0, 3)}.` : ''}`;
      lectura.set([['valor presente cercana', VIZ.fmt(a, 3)], ['valor presente lejana', VIZ.fmt(b, 3)], ['decisión', a > b ? 'cercana' : 'lejana'], ['horizonte efectivo 1/(1 − γ)', `${VIZ.fmt(1 / (1 - gamma), 3)} pasos`], ['γ de cruce', g0 ? VIZ.fmt(g0, 3) : 'no existe']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y)) return tip.ocultar(); const g = pl.ix(x); tip.mostrar(x, y, `γ = <b>${VIZ.fmt(g, 3)}</b>` + VIZ.filaTooltip(C.s1, 'cercana', VIZ.fmt(vp(R1, T1, g), 3)) + VIZ.filaTooltip(C.s2, 'lejana', VIZ.fmt(vp(R2, T2, g), 3))); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('exploration-discount', {
    intro: String.raw`
      <p>Un agente que aprende por prueba y error enfrenta dos tensiones. La primera es <strong>explorar o explotar</strong>: ¿repite la acción que mejor le ha ido hasta ahora (explotar) o prueba otras por si hubiera algo mejor (explorar)? Sin explorar puede quedar atrapado en una opción mediocre; explorando todo el tiempo, nunca aprovecha lo aprendido.</p>
      <p>La segunda es <strong>cuánto importa el futuro</strong>. El factor de descuento \(\gamma\) pondera las recompensas lejanas: con \(\gamma\) cercano a 0 el agente solo mira lo inmediato; cercano a 1, planifica a largo plazo.</p>`,
    visualizaciones: [
      { titulo: 'Explorar o explotar en un bandido', descripcion: 'Compare ε = 0, 0,02, 0,1 y 0,3. Active las estimaciones optimistas y vea cómo ε = 0 también explora.', montar: montarBandido },
      { titulo: 'Impaciencia y paciencia', descripcion: 'Enfrente una recompensa cercana pequeña a una lejana grande y mueva γ para ver cuándo cambia la preferencia.', montar: montarDescuento },
    ],
    teoria: String.raw`
      <h2>Estrategias de exploración</h2>
      <ul>
        <li><strong>ε-voraz</strong>: con probabilidad \(1-\varepsilon\) la acción de mayor \(Q\); con \(\varepsilon\), una al azar. Se suele reducir \(\varepsilon\) con el tiempo (p. ej. de 1 a 0,05).</li>
        <li><strong>Softmax / Boltzmann</strong>: \(\pi(a)\propto e^{Q(a)/\tau}\); las acciones mejores se eligen más, pero todas tienen alguna probabilidad.</li>
        <li><strong>Optimismo ante la incertidumbre</strong>: empezar con estimaciones altas, o sumar una bonificación a las acciones poco probadas (UCB: \(Q(a)+c\sqrt{\ln t/N(a)}\)).</li>
      </ul>
      <p>Estimación incremental del valor de un brazo: \(Q_{n+1}=Q_n+\tfrac1{n+1}\,(r_{n+1}-Q_n)\), el promedio móvil de las recompensas observadas.</p>
      <h2>Descuento</h2>
      <p>El valor presente de una recompensa \(r\) recibida dentro de \(t\) pasos es \(\gamma^t r\). Para \(\gamma<1\), el retorno de una secuencia de recompensas acotadas por \(r_{\max}\) está acotado:</p>
      \[ |G_t|\le\sum_{k\ge0}\gamma^k r_{\max}=\frac{r_{\max}}{1-\gamma}, \qquad \text{horizonte efectivo}\approx\frac{1}{1-\gamma}. \]
      <p>Entre dos opciones \((R_1,t_1)\) y \((R_2,t_2)\) con \(t_1<t_2\) y \(R_1<R_2\), el agente prefiere la lejana si y solo si \(\gamma^{\,t_2-t_1}>R_1/R_2\), es decir, \(\gamma>(R_1/R_2)^{1/(t_2-t_1)}\).</p>
      <div class="recuadro"><p>En redes profundas, la exploración es un problema difícil: ε-voraz basta en entornos pequeños, pero en juegos con recompensas escasas se necesitan bonificaciones de curiosidad. Véase <a href="tema.html?id=deep-q-network">Deep Q-Network</a> (que usa ε-voraz) y el marco general en <a href="tema.html?id=mdp-agent-environment">Markov Decision Processes</a>.</p></div>`,
  });
})();
