(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const NOMBRES_MAPA = [['simple', 'Pequeño (4×4)'], ['pasillo', 'Pasillo con muros'], ['trampas', 'Trampas']];

  /* ---------- Fig. 1: evaluar una política con la ecuación de Bellman ---------- */

  function montarEvaluacion(cuerpo) {
    let mapa = 'simple', pol = 'azar', gamma = 0.95, pr = 0.1, m = null, P = null, V = null, barridos = 0, res = [], exacto = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entorno', opciones: NOMBRES_MAPA, valor: mapa, alCambiar: (v) => { mapa = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Política que se evalúa', opciones: [['azar', 'Al azar (25 % cada acción)'], ['optima', 'Óptima']], valor: pol, alCambiar: (v) => { pol = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Descuento γ', min: 0.5, max: 0.99, paso: 0.01, valor: gamma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { gamma = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Probabilidad de resbalar', min: 0, max: 0.4, paso: 0.05, valor: pr, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pr = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const mm = DL.mundo(mapa); return Math.round(Math.min(78, (w * (w > 640 ? 0.55 : 0.96)) / mm.W) * mm.H + 12) + (w > 640 ? 0 : 150); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor V(s) positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }, { color: C.s6, texto: 'meta', forma: 'cuadro' }, { color: C.s8, texto: 'trampa', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barrido reemplaza V(s) por la recompensa esperada del siguiente paso más γ veces el valor de los estados a los que se llega, promediando según la política. Parte de V = 0 y la información de las recompensas «viaja» hacia atrás un paso por barrido; el gráfico de abajo muestra cuánto cambia V en cada barrido.');
    function iniciar() {
      m = DL.mundo(mapa); P = pol === 'azar' ? DL.politicaUniforme(m) : DL.valoresOptimos(m, gamma, pr).pol; V = new Float64Array(m.n); barridos = 0; res = [];
      exacto = new Float64Array(m.n); for (let k = 0; k < 1500; k++) exacto = DL.barrido(m, exacto, gamma, pr, P);
      return (function* () { while (barridos < 300) { const N = DL.barrido(m, V, gamma, pr, P); let d = 0; for (let k = 0; k < m.n; k++) d = Math.max(d, Math.abs(N[k] - V[k])); V = N; barridos++; res.push(d); yield; if (d < 1e-6) return; } })();
    }
    function dibujar() {
      if (!m) return;
      const { ctx, ancho: W } = lienzo, c = Math.min(78, (W * (W > 640 ? 0.55 : 0.96)) / m.W), ancha = W > 640;
      lienzo.limpiar();
      DL.dibujarMundo(ctx, m, 4, 4, c, { V, pol: P });
      const xg = ancha ? 4 + m.W * c + 40 : 4, yg = ancha ? 24 : 4 + m.H * c + 28, wg = ancha ? W - xg - 12 : W - 20, hg = ancha ? m.H * c - 30 : 100;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Cambio máximo de V en cada barrido (escala log)', xg, yg - 20);
      const pl = VIZ.plano({ ancho: W, alto: yg + hg + 40, ctx }, { xmin: 1, xmax: Math.max(10, res.length), ymin: 1e-7, ymax: 2 }, { logY: true, etiquetaX: 'barrido', margen: { izq: xg + 38, der: W - xg - wg, sup: yg, inf: 36 }, formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes(); VIZ.trazar(ctx, pl, res.map((d, k) => [k + 1, Math.max(d, 1e-7)]), C.s1, 2.5);
      const err = Math.max(...Array.from(V, (v, k) => Math.abs(v - exacto[k])));
      registro.textContent = barridos ? (res[res.length - 1] < 1e-6 ? `Converge tras ${barridos} barridos: V ya no cambia, y es la única solución de las ecuaciones de Bellman para esta política.` : `Barrido ${barridos}: cambio máximo ${VIZ.fmt(res[res.length - 1], 2)}; distancia al valor exacto ${VIZ.fmt(err, 2)}.`) : 'V parte en 0 en todos los estados.';
      lectura.set([['barridos', String(barridos)], ['cambio máximo', res.length ? VIZ.fmt(res[res.length - 1], 2) : '—'], ['distancia al valor exacto', VIZ.fmt(err, 2)], ['V(inicio)', VIZ.fmt(V[DL.celdaId(m, ...m.ini)], 3)], ['estados evaluados', String(DL.estados(m).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!m) return; const c = Math.min(78, (lienzo.ancho * (lienzo.ancho > 640 ? 0.55 : 0.96)) / m.W), j = Math.floor((x - 4) / c), i = Math.floor((y - 4) / c); if (i >= 0 && i < m.H && j >= 0 && j < m.W && m.mapa[i][j] !== '#') tip.mostrar(x, y, `V(${i + 1}, ${j + 1}) = <b>${VIZ.fmt(V[DL.celdaId(m, i, j)], 3)}</b><br>valor exacto ${VIZ.fmt(exacto[DL.celdaId(m, i, j)], 3)}`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: iteración de políticas ---------- */

  function montarIteracion(cuerpo) {
    let mapa = 'pasillo', gamma = 0.95, pr = 0, m = null, P = null, V = null, fase = '', nIter = 0, barridosTot = 0, msg = '', cambios = 0, optIter = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entorno', opciones: NOMBRES_MAPA, valor: mapa, alCambiar: (v) => { mapa = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Descuento γ', min: 0.5, max: 0.99, paso: 0.01, valor: gamma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { gamma = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Probabilidad de resbalar', min: 0, max: 0.4, paso: 0.05, valor: pr, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pr = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1, velMax: 5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const mm = DL.mundo(mapa); return Math.round(Math.min(66, (w - 12) / mm.W) * mm.H + 12); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'flechas: acciones de la política actual', forma: 'linea' }, { color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La iteración de políticas alterna dos pasos: evaluar la política actual (varios barridos hasta que V converge) y mejorarla (en cada estado, elegir la acción con mayor Q). Parte de una política al azar y se detiene cuando mejorar ya no la cambia: esa es la óptima.');
    function iniciar() {
      m = DL.mundo(mapa); P = DL.politicaUniforme(m); V = new Float64Array(m.n); nIter = 0; barridosTot = 0; cambios = 0; fase = 'inicio'; msg = 'Política inicial: al azar. Pulse «Un paso».';
      optIter = DL.valoresOptimos(m, gamma, pr).iter;
      return (function* () {
        for (;;) {
          fase = 'evaluar'; let b = 0;
          for (; b < 300; b++) { const N = DL.barrido(m, V, gamma, pr, P); let d = 0; for (let k = 0; k < m.n; k++) d = Math.max(d, Math.abs(N[k] - V[k])); V = N; barridosTot++; if (d < 1e-7) break; }
          msg = `Evaluación ${nIter + 1}: V converge tras ${b + 1} barridos con la política actual.`; yield;
          fase = 'mejorar'; const Q = DL.politicaVoraz(m, V, gamma, pr); let cam = 0;
          for (const [i, j] of DL.estados(m)) { const k = DL.celdaId(m, i, j), a0 = P[k].map((v, a) => (v > 0 ? a : -1)).filter((a) => a >= 0), a1 = Q[k].map((v, a) => (v > 0 ? a : -1)).filter((a) => a >= 0); if (a0.join() !== a1.join()) cam++; }
          P = Q; nIter++; cambios = cam; msg = cam ? `Mejora ${nIter}: la política cambia en ${cam} estados.` : `Mejora ${nIter}: ningún estado cambia. La política es óptima.`; yield;
          if (!cam) { fase = 'fin'; return; }
        }
      })();
    }
    function dibujar() {
      if (!m) return;
      const { ctx, ancho: W } = lienzo, c = Math.min(66, (W - 12) / m.W);
      lienzo.limpiar();
      DL.dibujarMundo(ctx, m, 4, 4, c, { V, pol: P, sinNumeros: c < 44 });
      registro.textContent = msg;
      lectura.set([['fase', fase === 'evaluar' ? 'evaluación' : fase === 'mejorar' ? 'mejora' : fase === 'fin' ? 'terminado' : '—'], ['iteraciones de políticas', String(nIter)], ['barridos de evaluación en total', String(barridosTot)], ['cambios en la última mejora', String(cambios)], ['barridos de iteración de valores', String(optIter)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!m) return; const c = Math.min(66, (lienzo.ancho - 12) / m.W), j = Math.floor((x - 4) / c), i = Math.floor((y - 4) / c); if (i >= 0 && i < m.H && j >= 0 && j < m.W && m.mapa[i][j] !== '#') { const q = [0, 1, 2, 3].map((a) => DL.qDe(m, V, i, j, a, gamma, pr)); tip.mostrar(x, y, `(${i + 1}, ${j + 1})  V = ${VIZ.fmt(V[DL.celdaId(m, i, j)], 3)}<br>` + q.map((v, a) => `Q(${DL.ACCIONES[a][2]}) = ${VIZ.fmt(v, 3)}`).join('<br>')); } else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('bellman-policy-iteration', {
    intro: String.raw`
      <p>El valor de un estado tiene una propiedad recursiva: es la recompensa que se espera al dar un paso más el valor (descontado) del estado al que se llega. Esa recursión es la <strong>ecuación de Bellman</strong>, y es la herramienta central del aprendizaje por refuerzo.</p>
      <p>Si se conoce el modelo del entorno, la ecuación se puede convertir en un algoritmo: <strong>evaluar</strong> una política repitiendo la ecuación hasta que los valores se estabilicen, y <strong>mejorarla</strong> escogiendo en cada estado la mejor acción según esos valores. Alternar ambas (<strong>iteración de políticas</strong>) converge a la política óptima.</p>`,
    visualizaciones: [
      { titulo: 'Evaluación de una política', descripcion: 'Vea cómo la información de la recompensa se propaga hacia atrás, un paso por barrido. Compare la política al azar con la óptima y cambie γ.', montar: montarEvaluacion },
      { titulo: 'Iteración de políticas', descripcion: 'Alterne evaluación y mejora y vea cómo cambian las flechas hasta que la política deja de moverse.', montar: montarIteracion },
    ],
    teoria: String.raw`
      <h2>Ecuaciones de Bellman</h2>
      <p>De esperanza (para una política \(\pi\)):</p>
      \[ V^\pi(s)=\sum_a \pi(a\mid s)\sum_{s'}P(s'\mid s,a)\big[r(s,a,s')+\gamma V^\pi(s')\big]. \]
      <p>De optimalidad:</p>
      \[ V^*(s)=\max_a\sum_{s'}P(s'\mid s,a)\big[r+\gamma V^*(s')\big],\qquad Q^*(s,a)=\sum_{s'}P(s'\mid s,a)\Big[r+\gamma\max_{a'}Q^*(s',a')\Big]. \]
      <h2>Algoritmos</h2>
      <pre><code>evaluación de políticas (π fija):
    V ← 0
    repetir hasta que el cambio sea &lt; ε:
        para cada s: V[s] ← Σₐ π(a|s) Σₛ' P(s'|s,a) [r + γ V[s']]

iteración de políticas:
    π ← política inicial
    repetir:
        V ← evaluación de π
        para cada s: π(s) ← argmaxₐ Σₛ' P(s'|s,a) [r + γ V[s']]
    hasta que π no cambie

iteración de valores:
    V ← 0
    repetir hasta converger:
        para cada s: V[s] ← maxₐ Σₛ' P(s'|s,a) [r + γ V[s']]</code></pre>
      <h2>Por qué convergen</h2>
      <p>El operador de Bellman \(T\) es una <em>contracción</em> de factor \(\gamma\) en la norma del máximo: \(\lVert TV-TW\rVert_\infty\le\gamma\lVert V-W\rVert_\infty\). Por el teorema del punto fijo de Banach, la iteración converge a un único punto fijo, y el error baja al menos como \(\gamma^k\). La iteración de políticas converge en un número finito de mejoras, a menudo muy pequeño.</p>
      <div class="recuadro"><p>Estos métodos exigen conocer \(P\) y recorrer todos los estados: no escalan a espacios grandes. El aprendizaje por refuerzo sin modelo (<a href="tema.html?id=reinforcement-learning">Q-learning</a>) y con redes para aproximar \(Q\) (<a href="tema.html?id=deep-q-network">Deep Q-Network</a>) los reemplazan por muestras de experiencia.</p></div>`,
  });
})();
