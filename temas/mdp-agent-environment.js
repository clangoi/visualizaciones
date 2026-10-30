(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const NOMBRES_MAPA = [['simple', 'Pequeño (4×4)'], ['pasillo', 'Pasillo con muros'], ['trampas', 'Trampas']];
  const POLITICAS = [['azar', 'Al azar'], ['optima', 'Óptima (calculada con el modelo)'], ['derecha', 'Siempre a la derecha, luego abajo']];
  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  function politica(m, clave, gamma, pr) {
    if (clave === 'azar') return DL.politicaUniforme(m);
    if (clave === 'optima') return DL.valoresOptimos(m, gamma, pr).pol;
    return Array.from({ length: m.n }, (_, k) => { const i = Math.floor(k / m.W), j = k % m.W, p = [0, 0, 0, 0]; if (m.libre(i, j + 1)) p[1] = 1; else p[2] = 1; return p; });
  }

  /* ---------- Fig. 1: el ciclo agente–entorno ---------- */

  function montarCiclo(cuerpo) {
    let mapa = 'simple', pol = 'optima', pr = 0.2, gamma = 0.95, semilla = 1, m = null, P = null, estado = null, hist = [], geo = null, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entorno', opciones: NOMBRES_MAPA, valor: mapa, alCambiar: (v) => { mapa = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Política del agente', opciones: POLITICAS, valor: pol, alCambiar: (v) => { pol = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Probabilidad de resbalar', min: 0, max: 0.6, paso: 0.05, valor: pr, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pr = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Descuento γ', min: 0.5, max: 0.99, paso: 0.01, valor: gamma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { gamma = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    ctl.boton('Otro episodio', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const mm = DL.mundo(mapa); return Math.round(Math.min(70, (w * (w > 600 ? 0.5 : 0.96)) / mm.W) * mm.H + 14); } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.tinta, texto: 'agente', forma: 'punto' }, { color: C.s6, texto: 'meta (+1)', forma: 'cuadro' }, { color: C.s8, texto: 'trampa (−1)', forma: 'cuadro' }, { color: C.s2, texto: 'recorrido', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso es una vuelta del ciclo: el agente observa su estado, elige una acción según su política, el entorno responde con una recompensa y un nuevo estado. Con probabilidad de resbalar > 0, la misma acción puede llevar a lugares distintos. Cada recompensa pesa γ^t.');
    function iniciar() {
      m = DL.mundo(mapa); P = politica(m, pol, gamma, pr); hist = []; estado = { pos: m.ini.slice(), t: 0, G: 0, f: 1, fin: false }; msg = 'El agente está en la casilla de inicio.';
      const r = VIZ.semilla(semilla * 17 + 3);
      return (function* () {
        while (!estado.fin && estado.t < 60) {
          const [i, j] = estado.pos, p = P[DL.celdaId(m, i, j)]; let u = r(), a = 0; while (a < 3 && u > p[a]) { u -= p[a]; a++; }
          const tr = m.transiciones(i, j, a, pr); let v = r(), k = 0; while (k < tr.length - 1 && v > tr[k].p) { v -= tr[k].p; k++; }
          const s = tr[k], desv = tr.length > 1 && k > 0;
          estado.G += estado.f * s.r; estado.f *= gamma; estado.t++; estado.pos = [s.i, s.j]; estado.fin = m.terminal(s.i, s.j);
          hist.push({ t: estado.t, de: [i, j], a, r: s.r, a2: [s.i, s.j], desv });
          msg = `t = ${estado.t}: en (${i + 1}, ${j + 1}) elige ${DL.ACCIONES[a][2]}${desv ? ' pero resbala' : ''}; recibe ${f2(s.r)} y pasa a (${s.i + 1}, ${s.j + 1}).${estado.fin ? (m.mapa[s.i][s.j] === 'G' ? ' ¡Meta!' : ' Cae en una trampa.') : ''}`;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!m) return;
      const { ctx, ancho: W } = lienzo, c = Math.min(70, (W * (W > 600 ? 0.5 : 0.96)) / m.W);
      lienzo.limpiar();
      DL.dibujarMundo(ctx, m, 4, 4, c, { pol: P, agente: estado.pos, ruta: [m.ini, ...hist.map((h) => h.a2)], sinNumeros: true });
      geo = { c };
      // Tabla de pasos.
      const xt = W > 600 ? 4 + m.W * c + 24 : 4, yt = W > 600 ? 8 : 4 + m.H * c + 14;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('t   estado → acción → recompensa', xt, yt);
      hist.slice(-9).forEach((h, k) => { ctx.fillStyle = h.desv ? C.s2 : C.tinta; ctx.font = VIZ.fuente(11); ctx.fillText(`${String(h.t).padStart(2)}  (${h.de[0] + 1},${h.de[1] + 1}) ${DL.ACCIONES[h.a][2]} ${f2(h.r).padStart(6)}  γ^${h.t - 1}=${VIZ.fmt(gamma ** (h.t - 1), 2)}`, xt, yt + 18 + k * 17); });
      registro.textContent = msg;
      lectura.set([['pasos', String(estado.t)], ['retorno sin descontar', f2(hist.reduce((s, h) => s + h.r, 0))], ['retorno descontado G', f2(estado.G)], ['política', POLITICAS.find((q) => q[0] === pol)[1]], ['resbalones', String(hist.filter((h) => h.desv).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!geo || !m) return; const j = Math.floor((x - 4) / geo.c), i = Math.floor((y - 4) / geo.c); if (i >= 0 && i < m.H && j >= 0 && j < m.W && m.mapa[i][j] !== '#') tip.mostrar(x, y, `casilla (${i + 1}, ${j + 1})<br>${m.mapa[i][j] === 'G' ? 'meta, recompensa +1' : m.mapa[i][j] === 'X' ? 'trampa, recompensa −1' : 'recompensa por paso −0.04'}`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la distribución de los retornos ---------- */

  function montarRetornos(cuerpo) {
    let mapa = 'trampas', pol = 'optima', pr = 0.2, gamma = 0.95, res = null, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Entorno', opciones: NOMBRES_MAPA, valor: mapa, alCambiar: (v) => { mapa = v; calcular(); } });
    ctl.selector({ etiqueta: 'Política', opciones: POLITICAS, valor: pol, alCambiar: (v) => { pol = v; calcular(); } });
    ctl.rango({ etiqueta: 'Probabilidad de resbalar', min: 0, max: 0.6, paso: 0.05, valor: pr, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pr = v; calcular(); } });
    ctl.rango({ etiqueta: 'Descuento γ', min: 0.5, max: 0.99, paso: 0.01, valor: gamma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { gamma = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'cantidad de episodios con ese retorno', forma: 'cuadro' }, { color: C.s2, texto: 'promedio (estimación del valor del estado inicial)', forma: 'linea' }, { color: C.s6, texto: 'valor exacto V(inicio) por programación dinámica', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se simulan 600 episodios. Un mismo agente obtiene retornos distintos por azar (resbalones, política estocástica); el <b>valor</b> del estado inicial es el promedio de esos retornos. La política «Óptima» maximiza ese promedio, no cada episodio.');
    function calcular() {
      const m = DL.mundo(mapa), P = politica(m, pol, gamma, pr), r = VIZ.semilla(77);
      const E = Array.from({ length: 600 }, () => DL.episodio(m, P, gamma, pr, r, 80));
      let V = new Float64Array(m.n); if (pol === 'optima') V = DL.valoresOptimos(m, gamma, pr).V; else { for (let k = 0; k < 400; k++) V = DL.barrido(m, V, gamma, pr, P); }
      res = { E, v0: V[DL.celdaId(m, ...m.ini)], m }; dibujar();
    }
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo, G = res.E.map((e) => e.G), lo = Math.min(...G, -1.2), hi = Math.max(...G, 1.2), B = 24, cuenta = new Array(B).fill(0);
      G.forEach((v) => { cuenta[Math.min(B - 1, Math.floor(((v - lo) / (hi - lo)) * B))]++; });
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: lo, xmax: hi, ymin: 0, ymax: Math.max(...cuenta) * 1.1 }, { etiquetaX: 'retorno descontado G', etiquetaY: 'episodios' });
      pl.ejes();
      const bw = (pl.x1 - pl.x0) / B;
      cuenta.forEach((n, i) => { ctx.fillStyle = hover === i ? C.s2 : C.s1; ctx.beginPath(); ctx.roundRect(pl.x0 + i * bw + 1, pl.sy(n), bw - 2, pl.y0 - pl.sy(n), [3, 3, 0, 0]); ctx.fill(); });
      const media = G.reduce((s, v) => s + v, 0) / G.length;
      ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.strokeStyle = C.s2; ctx.beginPath(); ctx.moveTo(pl.sx(media), pl.y0); ctx.lineTo(pl.sx(media), pl.y1); ctx.stroke(); ctx.strokeStyle = C.s6; ctx.beginPath(); ctx.moveTo(pl.sx(res.v0), pl.y0); ctx.lineTo(pl.sx(res.v0), pl.y1); ctx.stroke(); ctx.setLineDash([]);
      const meta = res.E.filter((e) => e.terminal && res.m.mapa[e.ruta[e.ruta.length - 1][0]][e.ruta[e.ruta.length - 1][1]] === 'G').length;
      registro.textContent = `Retorno medio ${VIZ.fmt(media, 3)} (valor exacto ${VIZ.fmt(res.v0, 3)}); llega a la meta en el ${VIZ.fmt((100 * meta) / res.E.length, 3)} % de los episodios.`;
      lectura.set([['retorno medio', VIZ.fmt(media, 3)], ['V(inicio) exacto', VIZ.fmt(res.v0, 3)], ['llegan a la meta', `${VIZ.fmt((100 * meta) / res.E.length, 3)} %`], ['pasos medios', VIZ.fmt(res.E.reduce((s, e) => s + e.pasos, 0) / res.E.length, 3)], ['mejor / peor retorno', `${VIZ.fmt(Math.max(...G), 2)} / ${VIZ.fmt(Math.min(...G), 2)}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!pl || !pl.dentro(x, y) || !res) { hover = -1; tip.ocultar(); return; } const G = res.E.map((e) => e.G), lo = Math.min(...G, -1.2), hi = Math.max(...G, 1.2), i = Math.min(23, Math.floor(((pl.ix(x) - lo) / (hi - lo)) * 24)); hover = i; dibujar(); tip.mostrar(x, y, `retorno entre ${VIZ.fmt(lo + (i * (hi - lo)) / 24, 2)} y ${VIZ.fmt(lo + ((i + 1) * (hi - lo)) / 24, 2)}<br><b>${G.filter((v) => Math.min(23, Math.floor(((v - lo) / (hi - lo)) * 24)) === i).length}</b> episodios`); });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('mdp-agent-environment', {
    intro: String.raw`
      <p>En el <strong>aprendizaje por refuerzo</strong> no hay respuestas correctas dadas: un <strong>agente</strong> actúa en un <strong>entorno</strong> y solo recibe una señal de <strong>recompensa</strong>. En cada paso el agente observa un <strong>estado</strong>, elige una <strong>acción</strong>, el entorno le devuelve una recompensa y pasa a otro estado. El objetivo es acumular la mayor recompensa posible a lo largo del tiempo.</p>
      <p>El marco matemático es el <strong>proceso de decisión de Markov</strong> (MDP): el siguiente estado y la recompensa dependen solo del estado y la acción actuales. La <strong>política</strong> \(\pi\) es la regla con que el agente elige acciones.</p>`,
    visualizaciones: [
      { titulo: 'El ciclo estado–acción–recompensa', descripcion: 'Avance paso a paso con distintas políticas y probabilidad de resbalar. Mire cómo la recompensa se descuenta con \\(\\gamma^t\\).', montar: montarCiclo },
      { titulo: 'El retorno varía; su promedio es el valor', descripcion: 'Simule 600 episodios y compare el histograma de retornos con el valor exacto del estado inicial.', montar: montarRetornos },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un MDP es una tupla \((\mathcal{S},\mathcal{A},P,R,\gamma)\): estados, acciones, la dinámica \(P(s'\mid s,a)\), la recompensa \(R(s,a,s')\) y el factor de descuento \(\gamma\in[0,1)\).</p>
      <p>La interacción produce una trayectoria \(s_0,a_0,r_1,s_1,a_1,r_2,\dots\) El <strong>retorno descontado</strong> desde el instante \(t\) es</p>
      \[ G_t = r_{t+1}+\gamma\,r_{t+2}+\gamma^2 r_{t+3}+\cdots=\sum_{k=0}^{\infty}\gamma^k\,r_{t+k+1}. \]
      <h2>Valor de un estado y de una acción</h2>
      \[ V^\pi(s)=\mathbb{E}_\pi\!\big[G_t\mid s_t=s\big],\qquad Q^\pi(s,a)=\mathbb{E}_\pi\!\big[G_t\mid s_t=s,\,a_t=a\big]. \]
      <p>El objetivo es una política \(\pi^*\) que maximice \(V^\pi(s)\) en todos los estados. En el mundo de la figura, el entorno es <em>estocástico</em>: con probabilidad \(p\) la acción resbala hacia un lado.</p>
      <h2>Propiedad de Markov</h2>
      <p>\(P(s_{t+1}\mid s_t,a_t,s_{t-1},a_{t-1},\dots)=P(s_{t+1}\mid s_t,a_t)\): el estado resume todo lo relevante del pasado. Si no se cumple (observación parcial), se amplía el estado con una memoria (p. ej. una <a href="tema.html?id=rnn-hidden-state">RNN</a>).</p>
      <div class="recuadro"><p>Cómo calcular \(V\) y \(Q\) cuando se conoce el modelo: <a href="tema.html?id=bellman-policy-iteration">ecuaciones de Bellman</a>. Cuando no se conoce: aprendizaje por interacción, como <a href="tema.html?id=reinforcement-learning">Q-learning</a> y su versión con redes (<a href="tema.html?id=deep-q-network">Deep Q-Network</a>).</p></div>`,
  });
})();
