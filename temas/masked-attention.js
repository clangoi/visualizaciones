(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const FRASE = ['el', 'modelo', 'predice', 'la', 'siguiente', 'palabra'];
  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: ocultar el futuro, fila por fila ---------- */

  function montarMascara(cuerpo) {
    let causal = true, relleno = false, fila = 0, geo = null, A = null, S = null, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Máscara causal (no mirar el futuro)', valor: causal, alCambiar: (v) => { causal = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Enmascarar la última palabra como relleno (padding)', valor: relleno, alCambiar: (v) => { relleno = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1, velMax: 4 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(60, (w - 150) / 6) * 6 + 80) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'peso de atención', forma: 'cuadro' }, { color: C.tenue, texto: 'prohibido: puntaje = −∞, peso = 0', forma: 'cuadro' }, { color: C.s2, texto: 'fila que se calcula', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance fila por fila. Con la máscara causal, la palabra i solo ve las palabras 1 … i; al generar texto no hay futuro que mirar, y al entrenar se simula esa situación para todas las posiciones a la vez. La máscara de relleno oculta posiciones vacías.');
    function iniciar() {
      const T = DL.transformerJuguete(2, 8), R = T.atender(FRASE.map((w) => T.emb(w)), { causal, relleno: relleno ? FRASE.map((_, j) => j === FRASE.length - 1) : null });
      A = R.A; S = R.S; fila = -1; msg = 'Matriz de puntajes calculada; las celdas prohibidas se hunden a −∞ antes del softmax.';
      return (function* () { for (let i = 0; i < FRASE.length; i++) { fila = i; const vis = A[i].filter((p) => p > 0).length; msg = `«${FRASE[i]}» ${causal ? `ve las ${i + 1} primeras palabras` : 've todas las palabras'}${relleno ? ' menos el relleno' : ''}: ${vis} posiciones con peso > 0.`; yield; } fila = FRASE.length; msg = 'Todas las filas calculadas: con la máscara, la matriz de pesos es triangular inferior.'; })();
    }
    function dibujar() {
      if (!A) return;
      const { ctx, ancho: W } = lienzo, n = FRASE.length, c = Math.min(60, (W - 150) / n), x0 = 110, y0 = 40;
      lienzo.limpiar();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; FRASE.forEach((w, j) => ctx.fillText(w, x0 + (j + 0.5) * c, y0 - 6));
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; FRASE.forEach((w, i) => ctx.fillText(w, x0 - 8, y0 + (i + 0.5) * c));
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('palabra que consulta ↓     palabra consultada →', 8, 4);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = x0 + j * c, y = y0 + i * c, hecho = i <= fila, prohibido = (causal && j > i) || (relleno && j === n - 1);
        if (!hecho) { ctx.fillStyle = C.neutro; ctx.fillRect(x + 1, y + 1, c - 2, c - 2); continue; }
        if (prohibido) { ctx.fillStyle = C.tenue; ctx.fillRect(x + 1, y + 1, c - 2, c - 2); ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('−∞', x + c / 2, y + c / 2); continue; }
        ctx.fillStyle = VIZ.css(VIZ.enRampa(Math.min(1, A[i][j] * 1.1))); ctx.fillRect(x + 1, y + 1, c - 2, c - 2);
        ctx.fillStyle = A[i][j] > 0.45 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(VIZ.fmt(A[i][j], 2), x + c / 2, y + c / 2);
      }
      if (fila >= 0 && fila < n) { ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.strokeRect(x0, y0 + fila * c, n * c, c); }
      geo = { x0, y0, c };
      registro.textContent = msg;
      lectura.set([['fila calculada', fila < 0 ? '—' : String(Math.min(fila + 1, n))], ['celdas permitidas', `${A.flat().filter((p) => p > 0).length} de ${n * n}`], ['máscara', causal ? 'causal' + (relleno ? ' + relleno' : '') : relleno ? 'solo relleno' : 'ninguna']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !A) return tip.ocultar();
      const j = Math.floor((x - geo.x0) / geo.c), i = Math.floor((y - geo.y0) / geo.c);
      if (i >= 0 && i < FRASE.length && j >= 0 && j < FRASE.length && i <= fila) tip.mostrar(x, y, `«${FRASE[i]}» → «${FRASE[j]}»<br>peso <b>${VIZ.fmt(A[i][j], 3)}</b>${A[i][j] === 0 ? ' (enmascarado)' : ''}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el futuro no puede filtrarse ---------- */

  function montarFuga(cuerpo) {
    let causal = true, p = 3, semilla = 1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Máscara causal', valor: causal, alCambiar: (v) => { causal = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Palabra que se cambia (posición)', min: 1, max: FRASE.length, valor: p + 1, alCambiar: (v) => { p = v - 1; dibujar(); } });
    ctl.boton('Cambiar por otra palabra', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 250 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'la salida no cambió', forma: 'cuadro' }, { color: C.s8, texto: 'la salida cambió', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se reemplaza una palabra por otra y se compara la salida de cada posición antes y después. Con máscara causal, las posiciones anteriores no pueden enterarse del cambio: la predicción de la palabra i depende solo de las anteriores. Sin máscara, el modelo «espiaría» el futuro al entrenar.');
    function dibujar() {
      const T = DL.transformerJuguete(2, 8), X = FRASE.map((w) => T.emb(w)), Y = X.map((x, k) => (k === p ? T.emb(`otra${semilla}`) : x));
      const o1 = T.atender(X, { causal }).O, o2 = T.atender(Y, { causal }).O, dif = o1.map((f, i) => Math.hypot(...f.map((v, k) => v - o2[i][k])));
      const { ctx, ancho: W } = lienzo, n = FRASE.length, bw = Math.min(110, (W - 30) / n - 8), x0 = (W - n * (bw + 8)) / 2;
      lienzo.limpiar(); geo = [];
      const mx = Math.max(...dif, 1);
      FRASE.forEach((w, i) => {
        const x = x0 + i * (bw + 8), cambia = dif[i] > 1e-9, h = (dif[i] / mx) * 110;
        ctx.fillStyle = C.neutro; ctx.strokeStyle = i === p ? C.s2 : C.inactivo; ctx.lineWidth = i === p ? 3 : 1.5; ctx.beginPath(); ctx.roundRect(x, 8, bw, 30, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, i === p ? 600 : 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i === p ? `${w} → otra` : w, x + bw / 2, 23);
        ctx.fillStyle = cambia ? C.s8 : C.s6; ctx.beginPath(); ctx.roundRect(x + 8, 190 - Math.max(3, h), bw - 16, Math.max(3, h), [4, 4, 0, 0]); ctx.fill();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'bottom'; ctx.fillText(VIZ.fmt(dif[i], 2), x + bw / 2, 188 - Math.max(3, h));
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'top'; ctx.fillText(cambia ? 'cambió' : 'igual', x + bw / 2, 198);
        geo.push({ x, w: bw, i });
      });
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('cambio en la salida de cada posición (norma)', 8, 46);
      const antes = dif.slice(0, p).filter((v) => v > 1e-9).length;
      registro.textContent = causal ? `Con máscara causal, cambiar la palabra ${p + 1} no altera ninguna de las ${p} anteriores y sí cambia ${dif.slice(p).filter((v) => v > 1e-9).length} de las que la siguen (incluida ella).` : `Sin máscara, el cambio alcanza a ${antes} de las ${p} posiciones anteriores: la información viaja del futuro al pasado.`;
      lectura.set([['posiciones anteriores afectadas', `${antes} de ${p}`], ['posiciones posteriores afectadas', `${dif.slice(p + 1).filter((v) => v > 1e-9).length} de ${n - p - 1}`], ['máscara', causal ? 'causal' : 'ninguna']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo && geo.find((q) => x >= q.x && x <= q.x + q.w); if (g) tip.mostrar(x, y, `«${FRASE[g.i]}»`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('masked-attention', {
    intro: String.raw`
      <p>Para <em>generar</em> texto, el modelo predice cada palabra viendo solo las anteriores. Pero entrenar palabra por palabra sería lentísimo. El truco de los Transformers es procesar la frase completa de una vez y <strong>enmascarar</strong> la atención: a la palabra \(i\) se le prohíbe mirar las posiciones \(j>i\). Así se entrenan en paralelo todos los pasos de la generación, sin que ninguno vea la respuesta.</p>
      <p>La máscara se aplica antes del softmax, sumando \(-\infty\) a los puntajes prohibidos: tras la exponencial, su peso es exactamente 0. Otra máscara, la de <em>relleno</em>, oculta las posiciones vacías que se agregan para igualar el largo de las frases de un lote.</p>`,
    visualizaciones: [
      { titulo: 'Ocultar el futuro', descripcion: 'Avance fila por fila con la máscara causal y, luego, apáguela y compare. Active la máscara de relleno para ocultar también la última palabra.', montar: montarMascara },
      { titulo: 'El futuro no puede filtrarse', descripcion: 'Cambie una palabra y mire qué posiciones cambian. Con máscara, solo las que la siguen.', montar: montarFuga },
    ],
    teoria: String.raw`
      <h2>Atención enmascarada</h2>
      \[ \operatorname{Attention}(Q,K,V)=\operatorname{softmax}\!\Big(\frac{QK^\top}{\sqrt{d_k}}+M\Big)V,\qquad M_{ij}=\begin{cases}0 & j\le i\\ -\infty & j>i.\end{cases} \]
      <p>Como \(e^{-\infty}=0\), cada fila del resultado sigue sumando 1 sobre las posiciones permitidas, y los pesos de la matriz son triangulares inferiores.</p>
      <h2>Paralelismo en el entrenamiento, secuencialidad en la generación</h2>
      <ul>
        <li><strong>Entrenamiento (<em>teacher forcing</em>):</strong> se pasa la frase completa; la posición \(i\) produce una distribución sobre la palabra \(i+1\) y se compara con la real. Una sola pasada calcula \(n\) predicciones.</li>
        <li><strong>Generación:</strong> se produce una palabra, se agrega a la entrada y se repite. Para no recalcular, se guardan las claves y valores de las posiciones anteriores (<em>KV cache</em>).</li>
      </ul>
      <h2>Tres usos de la atención en un Transformer completo</h2>
      <table>
        <tr><th>Dónde</th><th>Consulta</th><th>Claves y valores</th><th>Máscara</th></tr>
        <tr><td>Autoatención del codificador</td><td>entrada</td><td>entrada</td><td>solo relleno</td></tr>
        <tr><td>Autoatención del decodificador</td><td>salida parcial</td><td>salida parcial</td><td>causal</td></tr>
        <tr><td>Atención cruzada</td><td>decodificador</td><td>codificador</td><td>solo relleno</td></tr>
      </table>
      <div class="recuadro"><p>Los modelos tipo GPT son solo el decodificador con máscara causal (<a href="tema.html?id=next-token-prediction">Next-Token Prediction</a>); los tipo BERT usan solo el codificador, sin máscara causal, y aprenden a rellenar palabras ocultas. Detalles de la capa en <a href="tema.html?id=transformer-block">Transformer Block</a>.</p></div>`,
  });
})();
