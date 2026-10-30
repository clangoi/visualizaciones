(function () {
  'use strict';
  const { color: C } = VIZ;

  const TEXTO = 'el aprendizaje profundo aprende representaciones de los datos. una red neuronal recibe un texto y predice la siguiente letra. al repetir esa predicción letra por letra se genera un texto nuevo. cada letra depende de las letras anteriores, y por eso el modelo se llama autorregresivo. con un contexto corto el texto suena a ruido; con un contexto más largo se parece cada vez más al original. la temperatura controla qué tan atrevido es el modelo: una temperatura baja elige siempre la letra más probable y una temperatura alta da más sorpresas. los modelos de lenguaje modernos hacen lo mismo con palabras y fragmentos de palabras, y con miles de millones de parámetros. ';
  const VOC = Array.from(new Set(TEXTO)).sort();

  // Modelo de n-gramas de caracteres: cuenta qué letra sigue a cada contexto de hasta k letras.
  function entrenar(texto, K) {
    const cuentas = Array.from({ length: K + 1 }, () => new Map());
    for (let i = 0; i < texto.length; i++) for (let k = 0; k <= Math.min(K, i); k++) {
      const ctx = texto.slice(i - k, i), m = cuentas[k];
      if (!m.has(ctx)) m.set(ctx, new Map());
      const d = m.get(ctx); d.set(texto[i], (d.get(texto[i]) || 0) + 1);
    }
    return cuentas;
  }
  // Distribución sobre el vocabulario; usa el contexto más largo (≤ k) que se haya visto, con suavizado aditivo α.
  function dist(cuentas, contexto, k, alfa = 0.02) {
    for (let j = Math.min(k, contexto.length, cuentas.length - 1); j >= 0; j--) {
      const d = cuentas[j].get(contexto.slice(contexto.length - j));
      if (d) { const tot = [...d.values()].reduce((s, v) => s + v, 0); return { p: VOC.map((c) => ((d.get(c) || 0) + alfa) / (tot + alfa * VOC.length)), usado: j }; }
    }
    return { p: VOC.map(() => 1 / VOC.length), usado: 0 };
  }
  const visible = (c) => (c === ' ' ? '␣' : c === '\n' ? '↵' : c);

  /* ---------- Fig. 1: generar una letra por vez ---------- */

  function montarGenerar(cuerpo) {
    let K = 3, temp = 0.8, semilla = 1, cuentas = null, texto = '', ultima = null, geo = [];
    const SEMILLA_TXT = 'el ';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Contexto (letras que mira el modelo)', min: 0, max: 6, valor: K, alCambiar: (v) => { K = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Temperatura', min: 0.1, max: 2, paso: 0.05, valor: temp, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { temp = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 6 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 340 : 420) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'probabilidad de la siguiente letra', forma: 'cuadro' }, { color: C.s2, texto: 'letra elegida al muestrear', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso mira las últimas letras, calcula una distribución sobre la siguiente y sortea una. Con contexto 0 solo importa la frecuencia de cada letra; con contexto 6 el modelo casi copia frases del texto de entrenamiento. Temperatura baja: siempre la más probable; alta: más sorpresas.');
    function iniciar() {
      cuentas = entrenar(TEXTO, K); texto = SEMILLA_TXT; ultima = null;
      const r = VIZ.semilla(semilla * 13 + K);
      return (function* () {
        for (let n = 0; n < 160; n++) {
          const { p, usado } = dist(cuentas, texto, K), q = p.map((v) => v ** (1 / temp)), s = q.reduce((a, b) => a + b, 0), pr = q.map((v) => v / s);
          let u = r(), k = 0; while (k < pr.length - 1 && u > pr[k]) { u -= pr[k]; k++; }
          ultima = { pr, k, usado, ctx: texto.slice(-K || texto.length) };
          texto += VOC[k];
          yield;
        }
      })();
    }
    function dibujar() {
      if (!cuentas) return;
      const { ctx, ancho: W } = lienzo, ancha = W > 640;
      lienzo.limpiar(); geo = [];
      // Texto generado.
      const tw = ancha ? W * 0.5 - 16 : W - 16;
      ctx.font = VIZ.fuente(13); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      let x = 8, y = 6; const lineH = 20;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText('Texto generado', 8, y); y += 20; ctx.font = VIZ.fuente(13);
      for (let i = 0; i < texto.length; i++) {
        const w = ctx.measureText(texto[i]).width;
        if (x + w > tw) { x = 8; y += lineH; }
        ctx.fillStyle = i < SEMILLA_TXT.length ? C.apagado : i === texto.length - 1 ? C.s2 : C.tinta;
        ctx.fillText(texto[i], x, y); x += w;
      }
      // Distribución de la última letra.
      const bx = ancha ? W * 0.5 + 8 : 8, by = ancha ? 6 : Math.max(y + 36, 150), bw = ancha ? W * 0.5 - 20 : W - 16;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText(ultima ? `Siguiente letra tras «${ultima.ctx.replace(/ /g, '␣')}»` : 'Aún no hay predicciones', bx, by);
      if (ultima) {
        const top = ultima.pr.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, 8);
        top.forEach(([p, i], k) => {
          const yy = by + 22 + k * 24, ancho = Math.max(2, p * (bw - 70));
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(visible(VOC[i]), bx + 10, yy + 9);
          ctx.fillStyle = i === ultima.k ? C.s2 : C.s1; ctx.beginPath(); ctx.roundRect(bx + 26, yy, ancho, 18, [0, 4, 4, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.fillText(VIZ.fmt(100 * p, 3) + ' %', bx + 30 + ancho, yy + 9);
          geo.push({ x: bx, y: yy, w: bw, h: 18, t: `«${visible(VOC[i])}»: <b>${VIZ.fmt(100 * p, 3)} %</b>` });
        });
      }
      const H = ultima ? -ultima.pr.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0) : NaN;
      registro.textContent = ultima ? `Con contexto «${ultima.ctx.replace(/ /g, '␣')}» (se usó un contexto de ${ultima.usado} letra${ultima.usado === 1 ? '' : 's'}), el modelo eligió «${visible(VOC[ultima.k])}» con probabilidad ${VIZ.fmt(100 * ultima.pr[ultima.k], 3)} %.` : `Texto inicial: «${SEMILLA_TXT}». Pulse Reproducir para generar letra por letra.`;
      lectura.set([['letras generadas', String(texto.length - SEMILLA_TXT.length)], ['contexto del modelo', `${K} letra${K === 1 ? '' : 's'}`], ['entropía de la última distribución', ultima ? `${VIZ.fmt(H, 3)} bits` : '—'], ['letras del vocabulario', String(VOC.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (g) tip.mostrar(x, y, g.t); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: perplejidad según el contexto ---------- */

  function montarPerplejidad(cuerpo) {
    let alfa = 0.02, hover = -1, pl = null, filas = [];
    const corte = Math.floor(TEXTO.length * 0.75), TR = TEXTO.slice(0, corte), TE = TEXTO.slice(corte);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Suavizado α (escala log₁₀)', min: -3, max: 0, paso: 0.25, valor: Math.log10(alfa), formato: (v) => VIZ.fmt(10 ** v, 2), alCambiar: (v) => { alfa = 10 ** v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'texto de entrenamiento (75 %)', forma: 'linea' }, { color: C.s2, texto: 'texto no visto (25 %)', forma: 'linea' }, { color: C.apagado, texto: 'adivinar al azar (todas las letras iguales)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La perplejidad es el número efectivo de letras entre las que duda el modelo en cada paso: más baja es mejor. Más contexto reduce la perplejidad en el texto visto —memoriza—, pero en texto nuevo mejora y luego empeora: sobreajuste.');
    function perplejidad(cuentas, texto, k, ctxIni) {
      let s = 0; const hist = ctxIni;
      for (let i = 0; i < texto.length; i++) { const { p } = dist(cuentas, (hist + texto).slice(0, hist.length + i), k, alfa); s -= Math.log2(p[VOC.indexOf(texto[i])]); }
      return 2 ** (s / texto.length);
    }
    function calcular() {
      const cuentas = entrenar(TR, 7);
      filas = Array.from({ length: 8 }, (_, k) => ({ k, tr: perplejidad(cuentas, TR, k, ''), te: perplejidad(cuentas, TE, k, TR.slice(-8)) }));
      dibujar();
    }
    function dibujar() {
      if (!filas.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 7, ymin: 1, ymax: 60 }, { logY: true, etiquetaX: 'letras de contexto', etiquetaY: 'perplejidad (log)', formatoY: (v) => String(Math.round(v)), ticksY: [1, 2, 5, 10, 20, 50], ticksX: [0, 1, 2, 3, 4, 5, 6, 7] });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, VOC.length], [7, VOC.length]], C.apagado, 1.5, [4, 4]);
      [['tr', C.s1], ['te', C.s2]].forEach(([k, c]) => { VIZ.trazar(ctx, pl, filas.map((q) => [q.k, Math.min(q[k], 60)]), c, 2.5); filas.forEach((q) => VIZ.marcador(ctx, pl.sx(q.k), pl.sy(Math.min(q[k], 60)), c, 4)); });
      const mejor = filas.reduce((m, q) => (q.te < m.te ? q : m));
      registro.textContent = `Mejor contexto en texto nuevo: ${mejor.k} letra${mejor.k === 1 ? '' : 's'} (perplejidad ${VIZ.fmt(mejor.te, 3)}). Con 7 letras, el modelo «sabe» el texto visto (${VIZ.fmt(filas[7].tr, 3)}) pero duda mucho en el nuevo (${VIZ.fmt(filas[7].te, 3)}).`;
      lectura.set([['mejor contexto', String(mejor.k)], ['perplejidad mínima (texto nuevo)', VIZ.fmt(mejor.te, 3)], ['perplejidad con 7 letras (visto)', VIZ.fmt(filas[7].tr, 3)], ['letras del vocabulario', String(VOC.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !filas.length) return tip.ocultar();
      const q = filas[Math.max(0, Math.min(7, Math.round(pl.ix(x))))];
      tip.mostrar(x, y, `contexto <b>${q.k}</b>` + VIZ.filaTooltip(C.s1, 'visto', VIZ.fmt(q.tr, 3)) + VIZ.filaTooltip(C.s2, 'no visto', VIZ.fmt(q.te, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('autoregressive-generation', {
    intro: String.raw`
      <p>Un <strong>modelo de lenguaje</strong> asigna probabilidades a la siguiente pieza de un texto dado lo anterior. Si se sortea esa pieza, se agrega al texto y se repite, se obtiene <strong>generación autorregresiva</strong>: cada salida pasa a ser parte de la entrada del siguiente paso.</p>
      <p>Esta página usa el modelo de lenguaje más simple, uno que cuenta qué letra sigue a cada contexto de \(k\) letras; una red recurrente o un Transformer hacen lo mismo, pero con una función aprendida que generaliza a contextos no vistos. Lo que se aprende aquí —contexto, temperatura, perplejidad, sobreajuste— vale para todos.</p>`,
    visualizaciones: [
      { titulo: 'Generar letra por letra', descripcion: 'Genere con contexto 1, 3 y 6, y con temperaturas 0,3 y 1,5. Mire la distribución de la siguiente letra en cada paso.', montar: montarGenerar },
      { titulo: 'Perplejidad según el contexto', descripcion: 'Compare la perplejidad en el texto de entrenamiento y en uno no visto. ¿Cuántas letras de contexto convienen?', montar: montarPerplejidad },
    ],
    teoria: String.raw`
      <h2>Factorización autorregresiva</h2>
      <p>Por la regla de la cadena, la probabilidad de una secuencia es</p>
      \[ P(x_1,\dots,x_T)=\prod_{t=1}^{T}P(x_t\mid x_1,\dots,x_{t-1}). \]
      <p>Un modelo de \(k\) letras aproxima \(P(x_t\mid x_{t-k},\dots,x_{t-1})\) con conteos: \(\hat P(c\mid w)=\dfrac{N(w c)+\alpha}{N(w)+\alpha |V|}\), donde \(\alpha\) es un suavizado. Una RNN o un Transformer reemplazan esa tabla por una red que recibe todo el contexto.</p>
      <h2>Entrenamiento y generación</h2>
      <pre><code>entrenamiento:  minimizar −Σ log P(xₜ | x₁..xₜ₋₁)        // entropía cruzada
generación:     x ← texto inicial
                repetir:
                    p ← modelo(x)           // distribución sobre el vocabulario
                    s ← muestrear(p, temperatura)
                    x ← x + s</code></pre>
      <h2>Temperatura</h2>
      <p>Se divide el logaritmo de las probabilidades entre \(\tau\): \(p_i^{(\tau)}\propto p_i^{1/\tau}\). Con \(\tau\to0\) siempre se elige la más probable (texto repetitivo); con \(\tau=1\) se respeta el modelo; con \(\tau>1\) la distribución se aplana (más variada y más errores).</p>
      <h2>Perplejidad</h2>
      \[ \operatorname{PPL} = 2^{\,-\frac1T\sum_t \log_2 P(x_t\mid x_{<t})}. \]
      <p>Es el número de opciones igualmente probables entre las que «duda» el modelo. Adivinar al azar da \(|V|\); un buen modelo da mucho menos. Si baja en el entrenamiento y sube en datos nuevos, hay sobreajuste (<a href="tema.html?id=generalization-splits">Generalization</a>).</p>
      <div class="recuadro"><p>Los modelos de lenguaje modernos hacen exactamente esto, pero sobre <em>tokens</em> (fragmentos de palabras) y con un Transformer: <a href="tema.html?id=next-token-prediction">Next-Token Prediction</a>. Para secuencias con dependencia larga, véase <a href="tema.html?id=rnn-hidden-state">RNN</a>.</p></div>`,
  });
})();
