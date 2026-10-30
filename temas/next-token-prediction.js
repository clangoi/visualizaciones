(function () {
  'use strict';
  const { color: C } = VIZ;

  const SUST = [['gato', 'el'], ['perro', 'el'], ['niño', 'el'], ['modelo', 'el'], ['robot', 'el'], ['estudiante', 'el'], ['casa', 'la'], ['red', 'la'], ['máquina', 'la'], ['idea', 'la']];
  const VERB = ['come', 'mira', 'aprende', 'busca', 'crea'], ADV = ['rápido', 'despacio', 'mucho'], PREP = ['en', 'con', 'sobre'];

  // Corpus sintético con gramática simple; cada frase termina en «.».
  function corpus(semilla, n) {
    const r = VIZ.semilla(semilla * 7 + 5), el = (a) => a[Math.floor(r() * a.length)];
    const sn = () => { const [s, d] = el(SUST); return [d, s]; };
    return Array.from({ length: n }, () => { const f = [...sn(), el(VERB)]; if (r() < 0.5) f.push(...sn()); if (r() < 0.35) f.push(el(ADV)); if (r() < 0.3) f.push(el(PREP), ...sn()); f.push('.'); return f; });
  }
  const VOC = Array.from(new Set([...SUST.flatMap(([s, d]) => [s, d]), ...VERB, ...ADV, ...PREP, '.']));

  // Modelo de n-gramas de palabras (contexto de k palabras) con retroceso y suavizado α.
  function modelo(frases, K) {
    const m = Array.from({ length: K + 1 }, () => new Map());
    for (const f of frases) for (let i = 0; i < f.length; i++) for (let k = 0; k <= Math.min(K, i); k++) { const c = f.slice(i - k, i).join(' '), d = m[k].get(c) || new Map(); d.set(f[i], (d.get(f[i]) || 0) + 1); m[k].set(c, d); }
    return m;
  }
  function dist(m, ctx, K, alfa = 0.05) {
    for (let k = Math.min(K, ctx.length, m.length - 1); k >= 0; k--) { const d = m[k].get(ctx.slice(ctx.length - k).join(' ')); if (d) { const t = [...d.values()].reduce((a, b) => a + b, 0); return VOC.map((w) => ((d.get(w) || 0) + alfa) / (t + alfa * VOC.length)); } }
    return VOC.map(() => 1 / VOC.length);
  }

  /* ---------- Fig. 1: de las probabilidades a la palabra elegida ---------- */

  function montarMuestreo(cuerpo) {
    let temp = 1, topk = 0, topp = 1, semilla = 1, ctxIni = ['el'], texto = ['el'], M = modelo(corpus(1, 800), 2), ult = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Temperatura', min: 0.1, max: 2.5, paso: 0.05, valor: temp, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { temp = v; dibujar(); } });
    ctl.rango({ etiqueta: 'top-k (0 = todos)', min: 0, max: 15, valor: topk, formato: (v) => (v ? String(v) : 'todos'), alCambiar: (v) => { topk = v; dibujar(); } });
    ctl.rango({ etiqueta: 'top-p (masa acumulada)', min: 0.1, max: 1, paso: 0.05, valor: topp, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { topp = v; dibujar(); } });
    ctl.boton('Muestrear una palabra', () => { muestrear(); }, { primario: true });
    ctl.boton('Generar la frase', () => { for (let i = 0; i < 12 && texto[texto.length - 1] !== '.'; i++) muestrear(); });
    ctl.boton('Reiniciar', () => { texto = ['el']; ult = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 600 ? 380 : 440) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'probabilidad con la temperatura elegida', forma: 'cuadro' }, { color: C.inactivo, texto: 'descartada por top-k o top-p', forma: 'cuadro' }, { color: C.s2, texto: 'palabra muestreada', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    let rnd = VIZ.semilla(1);
    VIZ.nota(cuerpo, 'Un modelo de lenguaje produce una probabilidad para cada palabra del vocabulario. Cómo se elige una define el carácter del texto: temperatura baja o top-k = 1 da texto predecible y repetitivo; alta, más variado y con más errores. Modelo: trigramas entrenados con 800 frases sintéticas.');
    function filtrada() {
      const base = dist(M, texto.slice(-2), 2), lg = base.map((p) => Math.log(p) / temp), mx = Math.max(...lg), e = lg.map((v) => Math.exp(v - mx)), z = e.reduce((a, b) => a + b, 0), p = e.map((v) => v / z);
      const orden = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]); const mantiene = new Set(); let acum = 0;
      orden.forEach(([v, i], r) => { if ((topk && r >= topk) || (acum >= topp && r > 0)) return; mantiene.add(i); acum += v; });
      const masa = [...mantiene].reduce((s, i) => s + p[i], 0), q = p.map((v, i) => (mantiene.has(i) ? v / masa : 0));
      return { base, p, q, orden, mantiene };
    }
    function muestrear() { if (texto[texto.length - 1] === '.') texto = ['el']; const F = filtrada(); let u = rnd(), k = 0; while (k < F.q.length - 1 && u > F.q[k]) { u -= F.q[k]; k++; } ult = { palabra: VOC[k], prob: F.q[k], ctx: texto.slice(-2).join(' ') }; texto.push(VOC[k]); dibujar(); }
    function dibujar() {
      const F = filtrada(), { ctx, ancho: W } = lienzo, ancha = W > 600, top = F.orden.slice(0, 12);
      lienzo.limpiar(); geo = [];
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Texto generado', 8, 6);
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(14); ctx.fillText(texto.join(' ').replace(/ \./, '.'), 8, 26);
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText(`Siguiente palabra tras «${texto.slice(-2).join(' ')}» (12 más probables)`, 8, 62);
      const bw = Math.min(W - 150, 420);
      top.forEach(([v, i], k) => { const y = 84 + k * 24, w = Math.max(2, F.p[i] * bw), kept = F.mantiene.has(i); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, kept ? 600 : 400); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(VOC[i], 92, y + 9); ctx.fillStyle = ult && ult.palabra === VOC[i] && texto[texto.length - 1] === VOC[i] ? C.s2 : kept ? C.s1 : C.inactivo; ctx.beginPath(); ctx.roundRect(98, y, w, 18, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.fillText(`${VIZ.fmt(100 * F.p[i], 3)} %`, 102 + w, y + 9); geo.push({ x: 0, y, w: W, h: 18, t: `«${VOC[i]}»: ${VIZ.fmt(100 * F.p[i], 3)} % ${kept ? '' : '(descartada)'}` }); });
      const ent = -F.p.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0), masaKeep = [...F.mantiene].reduce((s, i) => s + F.p[i], 0);
      registro.textContent = ult ? `Tras «${ult.ctx}» salió «${ult.palabra}» (probabilidad renormalizada ${VIZ.fmt(100 * ult.prob, 3)} %). Se podían elegir ${F.mantiene.size} palabras.` : 'Pulse «Muestrear una palabra» o «Generar la frase».';
      lectura.set([['entropía de la distribución', `${VIZ.fmt(ent, 3)} bits`], ['palabras que quedan', `${F.mantiene.size} de ${VOC.length}`], ['masa de probabilidad conservada', `${VIZ.fmt(100 * masaKeep, 3)} %`], ['más probable', `${VOC[F.orden[0][1]]} (${VIZ.fmt(100 * F.p[F.orden[0][1]], 3)} %)`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((q) => y >= q.y && y <= q.y + q.h && x < 420); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el texto crudo es su propio profesor ---------- */

  function montarPreentrenamiento(cuerpo) {
    let semilla = 1, filas = [], hover = -1, pl = null, frase = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Otro corpus', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 600 ? 400 : 480) });
    const tip = VIZ.tooltip(lienzo);
    const COL = [C.s2, C.s1, C.s6];
    VIZ.leyenda(cuerpo, [{ color: COL[0], texto: 'contexto de 0 palabras (frecuencias)', forma: 'linea' }, { color: COL[1], texto: 'contexto de 1 palabra', forma: 'linea' }, { color: COL[2], texto: 'contexto de 2 palabras', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arriba, cómo se construyen los ejemplos: nadie los etiqueta, la siguiente palabra del propio texto es la respuesta. Abajo, la pérdida (entropía cruzada) en frases nuevas según cuántas frases se usaron para entrenar. Con más datos todos mejoran; los modelos con más contexto necesitan más datos para superar a los simples.');
    const NS = [4, 8, 16, 32, 64, 128, 256, 512, 1024];
    function calcular() {
      const test = corpus(900 + semilla, 300), todo = corpus(semilla, 1024);
      filas = NS.map((n) => { const out = { n }; [0, 1, 2].forEach((K) => { const m = modelo(todo.slice(0, n), K); let s = 0, t = 0; for (const f of test) for (let i = 0; i < f.length; i++) { s -= Math.log2(dist(m, f.slice(Math.max(0, i - K), i), K, 0.05)[VOC.indexOf(f[i])]); t++; } out[K] = s / t; }); return out; });
      frase = semilla % 10; dibujar();
    }
    function dibujar() {
      if (!filas.length) return;
      const { ctx, ancho: W } = lienzo, F = corpus(semilla, 12)[frase % 12];
      lienzo.limpiar();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('De una frase sin etiquetar salen varios ejemplos de entrenamiento (entrada → objetivo):', 8, 6);
      F.forEach((w, i) => { const y = 26 + i * 17; if (y > 110) return; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.fillText(`${(i ? F.slice(0, i).join(' ') : '‹inicio›')}  →  `, 8, y); const tw = ctx.measureText(`${(i ? F.slice(0, i).join(' ') : '‹inicio›')}  →  `).width; ctx.fillStyle = C.s2; ctx.font = VIZ.fuente(11, 600); ctx.fillText(w, 8 + tw, y); });
      const alto = lienzo.alto - 130;
      pl = VIZ.plano({ ancho: W, alto: lienzo.alto, ctx }, { xmin: Math.log2(4), xmax: Math.log2(1024), ymin: 0, ymax: 6 }, { etiquetaX: 'frases de entrenamiento (escala log)', etiquetaY: 'pérdida en frases nuevas (bits por palabra)', ticksX: [2, 4, 6, 8, 10], formatoX: (v) => String(Math.round(2 ** v)), margen: { sup: 130, izq: 54 } });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[2, Math.log2(VOC.length)], [10, Math.log2(VOC.length)]], C.apagado, 1.3, [4, 4]);
      [0, 1, 2].forEach((K) => { VIZ.trazar(ctx, pl, filas.map((f) => [Math.log2(f.n), Math.min(f[K], 6)]), COL[K], 2.5); if (hover >= 0) VIZ.marcador(ctx, pl.sx(Math.log2(filas[hover].n)), pl.sy(Math.min(filas[hover][K], 6)), COL[K], 4); });
      const u = filas[filas.length - 1];
      registro.textContent = `Con 1 024 frases: ${VIZ.fmt(u[0], 3)} bits sin contexto, ${VIZ.fmt(u[1], 3)} con 1 palabra y ${VIZ.fmt(u[2], 3)} con 2; adivinar al azar daría ${VIZ.fmt(Math.log2(VOC.length), 3)}.`;
      lectura.set([['pérdida, 0 palabras', `${VIZ.fmt(u[0], 3)} bits`], ['pérdida, 1 palabra', `${VIZ.fmt(u[1], 3)} bits`], ['pérdida, 2 palabras', `${VIZ.fmt(u[2], 3)} bits`], ['vocabulario', String(VOC.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !filas.length) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = filas.reduce((m, f, i) => (Math.abs(Math.log2(f.n) - pl.ix(x)) < Math.abs(Math.log2(filas[m].n) - pl.ix(x)) ? i : m), 0); dibujar();
      tip.mostrar(x, y, `<b>${filas[hover].n}</b> frases` + [0, 1, 2].map((K) => VIZ.filaTooltip(COL[K], `${K} palabras`, `${VIZ.fmt(filas[hover][K], 3)} bits`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('next-token-prediction', {
    intro: String.raw`
      <p>Un <strong>GPT</strong> (<em>Generative Pre-trained Transformer</em>) es, en el fondo, un solo mecanismo: dado el texto hasta ahora, producir una distribución de probabilidad sobre el <strong>siguiente token</strong>. Para generar, se elige uno, se agrega al texto y se repite (<a href="tema.html?id=autoregressive-generation">generación autorregresiva</a>).</p>
      <p>Su preentrenamiento es <strong>autosupervisado</strong>: no necesita etiquetas humanas, porque la respuesta correcta en cada posición es el token que de hecho viene en el texto. Eso permite aprender de billones de palabras. Y cómo se elige el token a partir de las probabilidades —temperatura, top-k, top-p— determina cuánto se parece a un resumen predecible o a una improvisación.</p>`,
    visualizaciones: [
      { titulo: 'De las probabilidades a la palabra elegida', descripcion: 'Cambie la temperatura, top-k y top-p y genere varias frases. Con temperatura 0,1 casi siempre sale la misma; con 2,5, cosas raras.', montar: montarMuestreo },
      { titulo: 'El texto crudo es su propio profesor', descripcion: 'Vea cómo una frase genera ejemplos de entrenamiento y cómo mejora la pérdida con más datos y más contexto.', montar: montarPreentrenamiento },
    ],
    teoria: String.raw`
      <h2>Entrenamiento</h2>
      <p>Para un texto \(x_1,\dots,x_T\) (tokens), la red con parámetros \(\theta\) minimiza la entropía cruzada de predecir cada token con los anteriores:</p>
      \[ \mathcal{L}(\theta)=-\frac1T\sum_{t=1}^{T}\log P_\theta\big(x_t\mid x_1,\dots,x_{t-1}\big). \]
      <p>Con <a href="tema.html?id=masked-attention">atención enmascarada</a>, las \(T\) predicciones se calculan en una sola pasada. Exactamente la misma pérdida de la <a href="tema.html?id=loss-functions-mle">máxima verosimilitud</a>: el modelo maximiza la probabilidad del texto de entrenamiento.</p>
      <h2>De los logits al token</h2>
      <p>La última capa produce logits \(z\in\mathbb{R}^{|V|}\), y</p>
      \[ P(w)=\frac{e^{z_w/\tau}}{\sum_{v}e^{z_v/\tau}}. \]
      <ul>
        <li><strong>Voraz</strong> (\(\tau\to0\)): siempre el más probable; determinista y repetitivo.</li>
        <li><strong>Temperatura</strong> \(\tau\): \(\tau<1\) afila; \(\tau>1\) aplana.</li>
        <li><strong>top-k</strong>: se conservan solo los \(k\) tokens más probables, y se renormaliza.</li>
        <li><strong>top-p</strong> (<em>nucleus</em>): se conserva el menor conjunto de tokens cuya probabilidad suma \(\ge p\).</li>
      </ul>
      <h2>Qué se aprende «gratis»</h2>
      <p>Para predecir bien el siguiente token hay que modelar gramática, hechos y, a veces, razonamientos: el objetivo es simple, pero la capacidad que exige es enorme. Tras el preentrenamiento se suele afinar (<em>fine-tuning</em>) con instrucciones humanas (<a href="tema.html?id=in-context-learning">aprendizaje en contexto</a>).</p>
      <div class="recuadro"><p>El modelo de esta página usa conteos de trigramas, no una red; el mecanismo de muestreo, en cambio, es el mismo que el de un modelo grande. Los tokens vienen de un tokenizador (<a href="tema.html?id=tokenization-bpe">BPE</a>).</p></div>`,
  });
})();
