(function () {
  'use strict';
  const { color: C } = VIZ;

  // Frases de ejemplo escritas a mano. alin[j] = índice de la palabra de origen que corresponde a la palabra j de destino.
  const FRASES = [
    { es: ['la', 'casa', 'blanca'], en: ['the', 'white', 'house'], alin: [0, 2, 1] },
    { es: ['el', 'gato', 'negro', 'duerme'], en: ['the', 'black', 'cat', 'sleeps'], alin: [0, 2, 1, 3] },
    { es: ['yo', 'bebo', 'agua', 'fría'], en: ['i', 'drink', 'cold', 'water'], alin: [0, 1, 3, 2] },
    { es: ['ella', 'lee', 'un', 'libro', 'nuevo'], en: ['she', 'reads', 'a', 'new', 'book'], alin: [0, 1, 2, 4, 3] },
  ];

  /* ---------- Fig. 1: un solo vector no alcanza para frases largas ---------- */

  function montarCuello(cuerpo) {
    let V = 30, hover = -1, pl = null, res = [];
    const DIMS = [8, 16, 32, 64], COL = [C.s2, C.s4, C.s1, C.s6];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Palabras posibles (vocabulario)', min: 10, max: 100, valor: V, alCambiar: (v) => { V = v; calcular(); } });
    ctl.boton('Repetir con otros vectores', () => { calcular(Math.floor(Math.random() * 1e6)); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, DIMS.map((d, i) => ({ color: COL[i], texto: `contexto de ${d} números`, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Experimento real y sencillo: n palabras se codifican sumando vectores aleatorios (uno por palabra y posición) en un único vector de contexto, y se intenta recuperarlas una a una. Mientras n sea pequeño frente a la dimensión, casi todo se recupera; después, el vector se satura.');
    function calcular(sem = 7) {
      res = DIMS.map((d) => Array.from({ length: 24 }, (_, i) => {
        const n = i + 1, r = VIZ.semilla(sem + d * 101 + n); let ok = 0, tot = 0;
        for (let rep = 0; rep < 12; rep++) {
          const E = Array.from({ length: V }, () => Array.from({ length: d }, () => VIZ.normal(r) / Math.sqrt(d))), P = Array.from({ length: n }, () => Array.from({ length: d }, () => (r() < 0.5 ? -1 : 1)));
          const toks = Array.from({ length: n }, () => Math.floor(r() * V)), c = new Array(d).fill(0);
          toks.forEach((t, p) => { for (let k = 0; k < d; k++) c[k] += P[p][k] * E[t][k]; });
          toks.forEach((t, p) => { let mejor = 0, bm = -Infinity; for (let v = 0; v < V; v++) { let s = 0; for (let k = 0; k < d; k++) s += P[p][k] * E[v][k] * c[k]; if (s > bm) { bm = s; mejor = v; } } if (mejor === t) ok++; tot++; });
        }
        return ok / tot;
      }));
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 24, ymin: 0, ymax: 1.02 }, { etiquetaX: 'palabras en la frase (n)', etiquetaY: 'palabras recuperadas', formatoY: (v) => `${Math.round(v * 100)} %` });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[1, 1 / V], [24, 1 / V]], C.apagado, 1.2, [3, 4]);
      res.forEach((s, i) => { VIZ.trazar(ctx, pl, s.map((v, k) => [k + 1, v]), COL[i], 2.5); if (hover > 0) VIZ.marcador(ctx, pl.sx(hover), pl.sy(s[hover - 1]), COL[i], 4); });
      registro.textContent = `Con una frase de 20 palabras, un contexto de 16 números recupera el ${VIZ.fmt(100 * res[1][19], 3)} % de ellas; uno de 64, el ${VIZ.fmt(100 * res[3][19], 3)} %. La línea punteada es el azar (1 / ${V}).`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res.length) { hover = -1; tip.ocultar(); return; }
      hover = Math.max(1, Math.min(24, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `n = <b>${hover}</b>` + DIMS.map((d, i) => VIZ.filaTooltip(COL[i], `${d} números`, `${VIZ.fmt(100 * res[i][hover - 1], 3)} %`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: leer la frase y luego escribir la traducción ---------- */

  function montarFlujo(cuerpo) {
    let ej = 0, fase = 0, k = 0, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Frase', opciones: FRASES.map((f, i) => [String(i), f.es.join(' ')]), valor: '0', alCambiar: (v) => { ej = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1, velMax: 4 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 560 ? 300 : 360) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'el codificador lee una palabra', forma: 'cuadro' }, { color: C.s3, texto: 'vector de contexto', forma: 'cuadro' }, { color: C.s2, texto: 'el decodificador escribe una palabra', forma: 'cuadro' }, { color: C.inactivo, texto: 'aún no procesado', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El codificador lee la frase de origen de a una palabra y va actualizando su estado; el último estado es el vector de contexto. El decodificador parte de ese vector y emite la frase de destino de a una palabra, cada una condicionada a las anteriores, hasta producir «fin». Las traducciones de ejemplo están escritas a mano.');
    function iniciar() {
      const F = FRASES[ej]; fase = 0; k = 0; msg = 'Frase de origen lista. Pulse «Un paso».';
      return (function* () {
        for (let i = 0; i < F.es.length; i++) { fase = 1; k = i; msg = `Codificador: lee «${F.es[i]}» y actualiza su estado oculto h${i + 1}.`; yield; }
        fase = 2; k = F.es.length - 1; msg = 'El último estado del codificador es el vector de contexto: resume toda la frase en un solo vector.'; yield;
        for (let j = 0; j <= F.en.length; j++) { fase = 3; k = j; msg = j < F.en.length ? `Decodificador: con el contexto y lo ya escrito («${F.en.slice(0, j).join(' ') || 'inicio'}») emite «${F.en[j]}».` : 'Decodificador: emite «fin» y termina.'; yield; }
      })();
    }
    function dibujar() {
      const F = FRASES[ej], { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const n = Math.max(F.es.length, F.en.length + 1), bw = Math.min(110, (W - 16) / n - 10), bh = 34, gap = 10, x0 = (W - n * (bw + gap)) / 2;
      const caja = (x, y, t, col, act, hueco) => { ctx.fillStyle = act ? VIZ.alfa(col, 0.28) : C.neutro; ctx.strokeStyle = act ? col : C.inactivo; ctx.lineWidth = act ? 2.5 : 1.5; ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = act ? C.tinta : C.apagado; ctx.font = VIZ.fuente(12, act ? 600 : 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + bw / 2, y + bh / 2); };
      const yE = 28, yH = 88, yC = 156, yD = 212;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Codificador (español)', 8, 6);
      F.es.forEach((w, i) => { caja(x0 + i * (bw + gap), yE, w, C.s1, fase >= 1 && (fase > 1 || i <= k)); caja(x0 + i * (bw + gap), yH, `h${i + 1}`, C.s1, fase >= 1 && (fase > 1 || i <= k)); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + i * (bw + gap) + bw / 2, yE + bh); ctx.lineTo(x0 + i * (bw + gap) + bw / 2, yH); ctx.stroke(); if (i < F.es.length - 1) { ctx.beginPath(); ctx.moveTo(x0 + i * (bw + gap) + bw, yH + bh / 2); ctx.lineTo(x0 + (i + 1) * (bw + gap), yH + bh / 2); ctx.stroke(); } });
      const xc = x0 + ((F.es.length - 1) * (bw + gap)) / 2; caja(xc - 20, yC, 'contexto c', C.s3, fase >= 2);
      ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(x0 + (F.es.length - 1) * (bw + gap) + bw / 2, yH + bh); ctx.lineTo(xc - 20 + bw / 2, yC); ctx.stroke();
      ctx.fillStyle = C.tinta2; ctx.fillText('Decodificador (inglés)', 8, yC + bh + 8);
      [...F.en, 'fin'].forEach((w, j) => { const x = x0 + j * (bw + gap); caja(x, yD + 14, w, C.s2, fase === 3 ? j <= k : false); if (j > 0) { ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(x - gap, yD + 14 + bh / 2); ctx.lineTo(x, yD + 14 + bh / 2); ctx.stroke(); } });
      ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(xc - 20 + bw / 2, yC + bh); ctx.lineTo(x0 + bw / 2, yD + 14); ctx.stroke();
      registro.textContent = msg;
      lectura.set([['palabras de origen', String(F.es.length)], ['palabras de destino', String(F.en.length)], ['tamaño del contexto', 'un solo vector'], ['pasos del codificador', String(F.es.length)], ['pasos del decodificador', String(F.en.length + 1)]]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('encoder-decoder', {
    intro: String.raw`
      <p>Muchos problemas transforman una secuencia en <em>otra</em> de largo distinto: traducir una frase, resumir un texto, responder una pregunta. La arquitectura <strong>Sequence-to-Sequence</strong> (<em>Seq2Seq</em>) lo resuelve con dos redes: un <strong>codificador</strong> (<em>encoder</em>) lee la entrada y la resume en una representación latente; un <strong>decodificador</strong> (<em>decoder</em>) genera la salida, una palabra por vez, a partir de ella.</p>
      <p>La versión original resume toda la frase en <em>un solo vector</em>. Es elegante, pero crea un cuello de botella: cuanto más larga la frase, más información hay que comprimir en el mismo espacio. Esa limitación motivó el mecanismo de <a href="tema.html?id=attention-mechanism">atención</a>.</p>`,
    visualizaciones: [
      { titulo: 'El cuello de botella del vector de contexto', descripcion: 'Aumente el largo de la frase: la fracción de palabras recuperables cae más pronto con un contexto pequeño. Suba el vocabulario y compare.', montar: montarCuello },
      { titulo: 'Leer, resumir y escribir', descripcion: 'Avance paso a paso por la lectura del codificador y la escritura del decodificador en una traducción de ejemplo.', montar: montarFlujo },
    ],
    teoria: String.raw`
      <h2>Modelo</h2>
      <p>El codificador transforma la entrada \(x_1,\dots,x_n\) en estados \(h_1,\dots,h_n\) con \(h_i=f_{\text{enc}}(h_{i-1},x_i)\) y toma \(c=h_n\) como contexto. El decodificador modela la salida con la factorización autorregresiva:</p>
      \[ P(y_1,\dots,y_m\mid x)=\prod_{j=1}^{m}P\big(y_j\mid y_{<j},\,c\big), \qquad s_j=f_{\text{dec}}(s_{j-1},y_{j-1},c). \]
      <p>Se entrena con entropía cruzada sobre la palabra correcta en cada paso, usando <em>teacher forcing</em>: en entrenamiento, el decodificador recibe como entrada la palabra correcta anterior, no la suya. En inferencia genera una palabra, la reutiliza como entrada, y así hasta «fin» (<a href="tema.html?id=autoregressive-generation">generación autorregresiva</a>).</p>
      <h2>Representación latente</h2>
      <p>El vector \(c\) es una <em>representación latente</em> de la frase: una codificación densa de su significado (<a href="tema.html?id=embeddings">Embeddings</a>). Si dos frases tienen el mismo significado, deberían quedar cerca. Al ser de tamaño fijo, su capacidad es finita: con vectores aleatorios, \(n\) elementos superpuestos en \(d\) dimensiones se recuperan bien solo mientras \(n\ll d\); más allá, el ruido de los otros ahoga cada elemento.</p>
      <h2>Aplicaciones</h2>
      <ul><li>Traducción automática (la tarea original, 2014).</li><li>Resumen de textos, subtítulos de imágenes (codificador convolucional + decodificador recurrente), reconocimiento de voz.</li><li>Autocodificadores: la salida es la propia entrada, y el contexto es una compresión.</li></ul>
      <div class="recuadro"><p>Con atención, el decodificador deja de depender solo de \(c=h_n\) y consulta todos los estados \(h_i\) en cada paso. Los <a href="tema.html?id=self-attention-qkv">Transformers</a> mantienen la estructura codificador–decodificador, pero sin recurrencia.</p></div>`,
  });
})();
