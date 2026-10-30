(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const A = [0, 1, 2], B = [3, 4, 5], CONV = ['w1', 'b1', 'w2', 'b2'];
  const NOMA = A.map((c) => DL.NOMBRES_IMAGEN[c][1]).join(', '), NOMB = B.map((c) => DL.NOMBRES_IMAGEN[c][1]).join(', ');
  const ESTRATEGIAS = {
    total: ['Ajuste fino completo', { lr: 0.03, fijos: [], repaso: 0 }],
    baja: ['Ajuste fino con tasa baja (0,003)', { lr: 0.003, fijos: [], repaso: 0 }],
    congelar: ['Convoluciones congeladas', { lr: 0.03, fijos: CONV, repaso: 0 }],
    repaso: ['Repaso: 50 % de ejemplos de A', { lr: 0.03, fijos: [], repaso: 0.5 }],
  };

  let PRE = null;
  function preentrenada() {
    if (PRE) return PRE;
    PRE = DL.cnnPequena(1);
    const r = VIZ.semilla(3);
    for (let e = 0; e < 50; e++) for (let b = 0; b < 10; b++) PRE.paso(Array.from({ length: 12 }, (_, k) => { const c = A[(b * 12 + k) % 3]; return { img: DL.muestraImagen(c, r), c }; }), 0.03);
    return PRE;
  }
  // Una corrida completa de la tarea B; devuelve la historia de exactitudes en A y en B.
  function correr(est, epocas, semilla, alPaso) {
    const m = DL.cnnPequena(1); m.copiar(preentrenada());
    const { lr, fijos, repaso } = est[1], r = VIZ.semilla(semilla * 3 + 4), h = [{ a: m.evaluar(A, 15, 5).acc, b: m.evaluar(B, 15, 6).acc, d: 0 }];
    const ref = m.copia();
    const epoca = () => {
      for (let b = 0; b < 8; b++) {
        const L = Array.from({ length: 12 }, () => { const usaA = r() < repaso, c = (usaA ? A : B)[Math.floor(r() * 3)]; return { img: DL.muestraImagen(c, r), c }; });
        m.paso(L, lr, 0.9, fijos);
      }
      h.push({ a: m.evaluar(A, 15, 5).acc, b: m.evaluar(B, 15, 6).acc, d: m.norma(CONV, ref) });
    };
    return { h, epoca, m };
  }

  /* ---------- Fig. 1: aprender B y olvidar A ---------- */

  function montarOlvido(cuerpo) {
    let clave = 'total', corr = null, pl = null, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia al aprender la tarea B', opciones: Object.entries(ESTRATEGIAS).map(([k, v]) => [k, v[0]]), valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: `tarea A (ya aprendida): ${NOMA}`, forma: 'linea' }, { color: C.s2, texto: `tarea B (nueva): ${NOMB}`, forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La red ya sabe la tarea A (100 %). Ahora se entrena solo con ejemplos de B. Al terminar acierta B, pero A cae a cero: los mismos pesos que codificaban A se reutilizaron para B. Mezclar ejemplos de A («repaso») es la defensa más simple.');
    function iniciar() { corr = correr(ESTRATEGIAS[clave], 30, semilla); return (function* () { for (let e = 0; e < 30; e++) { corr.epoca(); yield; } })(); }
    function dibujar() {
      if (!corr) return;
      const { ctx } = lienzo, h = corr.h;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 30, ymin: 0, ymax: 1.02 }, { etiquetaX: 'época entrenando B', etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      VIZ.trazar(ctx, pl, h.map((q, e) => [e, q.a]), C.s1, 2.5); VIZ.trazar(ctx, pl, h.map((q, e) => [e, q.b]), C.s2, 2.5);
      const u = h[h.length - 1];
      registro.textContent = h.length === 1 ? `Antes de entrenar B: A ${VIZ.fmt(100 * u.a, 3)} %, B ${VIZ.fmt(100 * u.b, 3)} %.` : `Época ${h.length - 1}: A ${VIZ.fmt(100 * u.a, 3)} % (perdió ${VIZ.fmt(100 * (h[0].a - u.a), 3)} puntos), B ${VIZ.fmt(100 * u.b, 3)} %.`;
      lectura.set([['A (vieja)', `${VIZ.fmt(100 * u.a, 3)} %`], ['B (nueva)', `${VIZ.fmt(100 * u.b, 3)} %`], ['olvido de A', `${VIZ.fmt(100 * (h[0].a - u.a), 3)} puntos`], ['cambio de los filtros ‖Δθ‖', VIZ.fmt(u.d, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !corr) return tip.ocultar();
      const q = corr.h[Math.max(0, Math.min(corr.h.length - 1, Math.round(pl.ix(x))))], e = corr.h.indexOf(q);
      tip.mostrar(x, y, `época <b>${e}</b>` + VIZ.filaTooltip(C.s1, 'tarea A', `${VIZ.fmt(100 * q.a, 3)} %`) + VIZ.filaTooltip(C.s2, 'tarea B', `${VIZ.fmt(100 * q.b, 3)} %`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el costo de aprender rápido ---------- */

  const LRS = [0.001, 0.003, 0.01, 0.03];
  function montarBarrido(cuerpo) {
    let repaso = false, res = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Con repaso (50 % de ejemplos de A)', valor: repaso, alCambiar: (v) => { repaso = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 250, altoMax: 350 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'exactitud en A tras 30 épocas', forma: 'cuadro' }, { color: C.s2, texto: 'exactitud en B tras 30 épocas', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Una tasa de aprendizaje baja olvida más despacio pero también aprende B más despacio: es el dilema entre plasticidad (aprender lo nuevo) y estabilidad (conservar lo viejo). El repaso lo resuelve a costa de guardar datos antiguos.');
    function calcular() {
      res = LRS.map((lr) => { const c = correr(['', { lr, fijos: [], repaso: repaso ? 0.5 : 0 }], 30, 1); for (let e = 0; e < 30; e++) c.epoca(); const u = c.h[c.h.length - 1]; return { lr, a: u.a, b: u.b }; });
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: LRS.length, ymin: 0, ymax: 1.05 }, { etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %`, ticksX: [], margen: { inf: 34 } });
      pl.ejes();
      const bw = (pl.x1 - pl.x0) / LRS.length;
      geo = { pl, bw };
      res.forEach((r, i) => {
        [[r.a, C.s1, 0.12], [r.b, C.s2, 0.5]].forEach(([v, c, off]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(pl.x0 + i * bw + bw * off, pl.sy(v), bw * 0.34, Math.max(2, pl.y0 - pl.sy(v)), [4, 4, 0, 0]); ctx.fill(); });
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`η = ${VIZ.fmt(r.lr, 3)}`, pl.x0 + (i + 0.5) * bw, pl.y0 + 8);
      });
      registro.textContent = repaso ? 'Con repaso, A se conserva con todas las tasas; la de 0,001 apenas llega a aprender B en 30 épocas.' : 'Sin repaso, A se pierde con todas las tasas; subirla solo acelera la llegada a B.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || x < geo.pl.x0 || x > geo.pl.x1) return tip.ocultar();
      const r = res[Math.min(res.length - 1, Math.floor((x - geo.pl.x0) / geo.bw))];
      tip.mostrar(x, y, `η = <b>${VIZ.fmt(r.lr, 3)}</b><br>A: ${VIZ.fmt(100 * r.a, 3)} %<br>B: ${VIZ.fmt(100 * r.b, 3)} %`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('catastrophic-forgetting', {
    intro: String.raw`
      <p>Una red que ya sabe hacer la tarea A y se entrena después con la tarea B puede <strong>olvidar</strong> A casi por completo. No es un defecto del algoritmo, sino de la manera de aprender: el descenso de gradiente solo minimiza la pérdida de B, y si los pesos que codificaban A estorban, los modifica. A este fenómeno se le llama <strong>olvido catastrófico</strong>.</p>
      <p>Importa cada vez que se hace ajuste fino de un modelo preentrenado, o cuando un sistema debe aprender de forma continua sin volver a entrenar con todos los datos anteriores.</p>`,
    visualizaciones: [
      { titulo: 'Aprender B y olvidar A', descripcion: 'Compare las cuatro estrategias. Fíjese en que congelar las convoluciones no evita el olvido (la cabeza cambia), mientras que mezclar ejemplos de A sí.', montar: montarOlvido },
      { titulo: 'Plasticidad frente a estabilidad', descripcion: 'Con y sin repaso, mire cómo cambia la exactitud final en A y en B para cuatro tasas de aprendizaje.', montar: montarBarrido },
    ],
    teoria: String.raw`
      <h2>Por qué ocurre</h2>
      <p>Sean \(\theta_A\) los pesos tras aprender A. Entrenar con la pérdida \(\mathcal{L}_B\) da pasos \(\theta\leftarrow\theta-\eta\nabla\mathcal{L}_B(\theta)\), que no tienen ningún término que proteja \(\mathcal{L}_A\). Si \(\mathcal{L}_A\) y \(\mathcal{L}_B\) comparten parámetros, bajar \(\mathcal{L}_B\) suele subir \(\mathcal{L}_A\):</p>
      \[ \mathcal{L}_A(\theta) \approx \mathcal{L}_A(\theta_A) + \tfrac12(\theta-\theta_A)^\top H_A(\theta-\theta_A), \]
      <p>donde \(H_A\) es la hessiana de la tarea A: moverse en las direcciones en que \(H_A\) es grande, aunque sea poco, la arruina. Además, la capa de salida de softmax baja la probabilidad de las clases que no aparecen en B.</p>
      <h2>Remedios</h2>
      <ul>
        <li><strong>Repaso (<em>experience replay</em>):</strong> mezclar un subconjunto de datos de A (o datos generados) con los de B. Es lo más robusto.</li>
        <li><strong>Regularización hacia \(\theta_A\):</strong> penalizar el movimiento de los pesos importantes. <em>Elastic Weight Consolidation</em> añade \(\tfrac{\lambda}{2}\sum_i F_i(\theta_i-\theta_{A,i})^2\), con \(F_i\) la información de Fisher de A.</li>
        <li><strong>Arquitectura:</strong> congelar capas, o añadir módulos nuevos para B (<em>adapters</em>, redes progresivas) y mantener intactos los de A.</li>
        <li><strong>Tasas bajas:</strong> reducen el olvido, pero también el aprendizaje de B.</li>
      </ul>
      <div class="recuadro"><p>Al hacer <a href="tema.html?id=transfer-learning">ajuste fino</a> de un modelo grande, el olvido se reduce descongelando solo algunas capas, con tasas bajas y con pocas épocas. Congelar solo las convoluciones no basta si la cabeza (la capa de salida) se reentrena sin datos de las clases antiguas, como se ve en la primera figura.</p></div>
      <p>El mismo problema se estudia como <em>aprendizaje continuo</em>; el repaso es el análogo de la <a href="tema.html?id=replay-target-networks">memoria de repetición</a> del aprendizaje por refuerzo.</p>`,
  });
})();
