(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const NOMBRES = { significativos: ['animal', 'comida', 'ciudad'], arbitrarios: ['X', 'Y', 'Z'] };
  const COL = [C.s1, C.s2, C.s3];
  const coseno = (a, b) => { const d = a.reduce((s, v, i) => s + v * b[i], 0); return d / ((Math.hypot(...a) * Math.hypot(...b)) || 1); };

  // Un «prompt»: k ejemplos por etiqueta (una fracción con la etiqueta cambiada) y una consulta. Las representaciones vienen con ruido.
  function evaluar(E, k, nombres, ruido, malas, semilla, reps = 120) {
    const r = VIZ.semilla(semilla), nz = (w) => { const v = E.vec(w), n = Math.hypot(...v); return v.map((x) => x + ruido * n * VIZ.normal(r) / Math.sqrt(v.length)); };
    let ok = 0, tot = 0;
    for (let q = 0; q < reps; q++) {
      const ej = E.grupos.map(([, ws]) => ws.slice().sort(() => r() - 0.5).slice(0, k));
      const etiq = ej.map((lista, g) => lista.map((w) => ({ w, e: r() < malas ? Math.floor(r() * 3) : g })));
      const usados = new Set(ej.flat()), prueba = E.palabras.filter((w) => !usados.has(w)).slice(0, 5);
      for (const w of prueba) {
        const v = nz(w); let punt = [0, 0, 0];
        if (k === 0) punt = nombres === 'significativos' ? NOMBRES.significativos.map((l) => E.asoc(l, w)) : [Math.random(), Math.random(), Math.random()];
        else { const protos = [0, 1, 2].map((e) => { const xs = etiq.flat().filter((q2) => q2.e === e); return xs.length ? xs.map((q2) => nz(q2.w)).reduce((s, u) => s.map((a, i) => a + u[i] / xs.length), new Array(v.length).fill(0)) : null; }); punt = protos.map((p) => (p ? coseno(v, p) : -1)); }
        if (punt.indexOf(Math.max(...punt)) === E.grupo(w)) ok++;
        tot++;
      }
    }
    return ok / tot;
  }

  /* ---------- Fig. 1: un prompt con ejemplos ---------- */

  function montarPrompt(cuerpo) {
    let k = 2, ruido = 1, malas = 0, nombres = 'arbitrarios', semilla = 1, E = DL.embeddings(1), prompt = null, consulta = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ejemplos por etiqueta en el prompt (k)', min: 0, max: 5, valor: k, alCambiar: (v) => { k = v; armar(); } });
    ctl.selector({ etiqueta: 'Nombres de las etiquetas', opciones: [['arbitrarios', 'arbitrarios (X, Y, Z)'], ['significativos', 'significativos (animal, comida, ciudad)']], valor: nombres, alCambiar: (v) => { nombres = v; armar(); } });
    ctl.rango({ etiqueta: 'Ejemplos con la etiqueta equivocada', min: 0, max: 0.6, paso: 0.05, valor: malas, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { malas = v; armar(); } });
    ctl.boton('Otro prompt', () => { semilla++; armar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 600 ? 380 : 460) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: COL[0], texto: 'etiqueta 1', forma: 'cuadro' }, { color: COL[1], texto: 'etiqueta 2', forma: 'cuadro' }, { color: COL[2], texto: 'etiqueta 3', forma: 'cuadro' }, { color: C.tinta, texto: 'consulta (pase el cursor o haga clic en una palabra)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El «modelo» ya no cambia: solo ve un prompt con k ejemplos etiquetados y debe clasificar una palabra nueva con las representaciones que tiene (embeddings con ruido). Con etiquetas arbitrarias y k = 0 no hay forma de saber qué significan: acierta al azar. Con k ≥ 1, el prompt mismo le enseña la tarea.');
    function armar() {
      const r = VIZ.semilla(semilla * 5 + k), nz = (w) => { const v = E.vec(w), n = Math.hypot(...v); return v.map((x) => x + ruido * n * VIZ.normal(r) / Math.sqrt(v.length)); };
      const ej = E.grupos.map(([, ws]) => ws.slice().sort(() => r() - 0.5).slice(0, k)), usados = new Set(ej.flat());
      prompt = ej.map((l, g) => l.map((w) => ({ w, e: r() < malas ? Math.floor(r() * 3) : g, v: nz(w) })));
      const pool = E.palabras.filter((w) => !usados.has(w)); consulta = consulta && pool.includes(consulta.w) ? { w: consulta.w, v: nz(consulta.w) } : { w: pool[Math.floor(r() * pool.length)], v: null };
      if (!consulta.v) consulta.v = nz(consulta.w);
      dibujar();
    }
    function clasificar() {
      if (k === 0) return nombres === 'significativos' ? NOMBRES.significativos.map((l) => E.asoc(l, consulta.w)) : [0, 0, 0];
      const protos = [0, 1, 2].map((e) => { const xs = prompt.flat().filter((q) => q.e === e); return xs.length ? xs.map((q) => q.v).reduce((s, u) => s.map((a, i) => a + u[i] / xs.length), new Array(consulta.v.length).fill(0)) : null; });
      return protos.map((p) => (p ? coseno(consulta.v, p) : -1));
    }
    function dibujar() {
      if (!prompt) return;
      const { ctx, ancho: W } = lienzo, nom = NOMBRES[nombres];
      lienzo.limpiar(); geo = [];
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Prompt', 8, 6);
      let y = 26; ctx.font = VIZ.fuente(12);
      const lineas = k === 0 ? [['(sin ejemplos) Clasifica la palabra con una de las etiquetas: ' + nom.join(', ') + '.', C.apagado]] : prompt.flatMap((l) => l.map((q) => [`${q.w} → ${nom[q.e]}`, COL[q.e]]));
      const orden = lineas.map((l, i) => [i, Math.sin(i * 12.9 + semilla) ]).sort((a, b) => a[1] - b[1]).map((a) => lineas[a[0]]);
      orden.slice(0, 14).forEach(([t, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(14, y + 8, 4, 0, 7); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textBaseline = 'top'; ctx.fillText(t, 26, y); y += 20; });
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.fillText(`${consulta.w} → ?`, 26, y + 4);
      const pt = clasificar(), mx = Math.max(...pt), pred = pt.indexOf(mx), real = E.grupo(consulta.w), xb = W > 600 ? W * 0.55 : 8, yb = W > 600 ? 26 : y + 40;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.fillText('Puntaje de cada etiqueta para la consulta', xb, yb - 20);
      const sc = k === 0 && nombres === 'arbitrarios' ? [1, 1, 1] : pt.map((v) => Math.exp(8 * (v - mx))), z = sc.reduce((a, b) => a + b, 0);
      nom.forEach((n, e) => { const yy = yb + e * 30, p = sc[e] / z; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(n, xb + 76, yy + 10); ctx.fillStyle = COL[e]; ctx.beginPath(); ctx.roundRect(xb + 82, yy, Math.max(2, p * 180), 20, [0, 4, 4, 0]); ctx.fill(); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.font = VIZ.fuente(11); ctx.fillText(`${VIZ.fmt(100 * p, 3)} %`, xb + 88 + p * 180, yy + 10); geo.push({ x: xb, y: yy, w: 300, h: 20, t: `${n}: ${VIZ.fmt(100 * p, 3)} %` }); });
      const acc = evaluar(E, k, nombres, ruido, malas, semilla * 9 + 1, 80);
      registro.textContent = k === 0 && nombres === 'arbitrarios' ? 'Sin ejemplos y con etiquetas sin significado, el modelo no puede saber qué responder: reparte igual.' : `La consulta «${consulta.w}» se clasifica como «${nom[pred]}» (${pred === real ? 'correcto' : 'incorrecto'}; su categoría real es «${E.grupos[real][0]}»).`;
      lectura.set([['ejemplos por etiqueta', String(k)], ['tipo de prompt', k === 0 ? 'zero-shot' : k === 1 ? 'one-shot' : 'few-shot'], ['exactitud media con este ajuste', `${VIZ.fmt(100 * acc, 3)} %`], ['ejemplos mal etiquetados', `${Math.round(malas * 100)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (g) tip.mostrar(x, y, g.t); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    armar();
  }

  /* ---------- Fig. 2: exactitud según el número de ejemplos ---------- */

  function montarCurva(cuerpo) {
    let ruido = 1, malas = 0, nombres = 'arbitrarios', E = DL.embeddings(1), res = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Nombres de las etiquetas', opciones: [['arbitrarios', 'arbitrarios (X, Y, Z)'], ['significativos', 'significativos (animal, comida, ciudad)']], valor: nombres, alCambiar: (v) => { nombres = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido de las representaciones', min: 0, max: 2.5, paso: 0.1, valor: ruido, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ejemplos con la etiqueta equivocada', min: 0, max: 0.6, paso: 0.05, valor: malas, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { malas = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'exactitud promedio de muchos prompts', forma: 'linea' }, { color: C.apagado, texto: 'azar (33 %)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'k = 0 es zero-shot; k = 1, one-shot; k ≥ 2, few-shot. Cada punto promedia 120 prompts distintos. Con etiquetas significativas el modelo ya sabe algo sin ejemplos (por sus asociaciones aprendidas); con etiquetas arbitrarias, todo viene del prompt.');
    function calcular() { res = [0, 1, 2, 3, 4, 5].map((k) => evaluar(E, k, nombres, ruido, malas, 31 + k)); dibujar(); }
    function dibujar() {
      if (!res.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 5, ymin: 0, ymax: 1.02 }, { etiquetaX: 'ejemplos por etiqueta (k)', etiquetaY: 'exactitud', formatoY: (v) => `${Math.round(v * 100)} %`, ticksX: [0, 1, 2, 3, 4, 5] });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, 1 / 3], [5, 1 / 3]], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, pl, res.map((v, k) => [k, v]), C.s1, 2.5);
      res.forEach((v, k) => VIZ.marcador(ctx, pl.sx(k), pl.sy(v), hover === k ? C.s2 : C.s1, hover === k ? 6 : 4.5));
      registro.textContent = `Exactitud: ${res.map((v, k) => `k=${k}: ${VIZ.fmt(100 * v, 3)} %`).join(' · ')}.`;
      lectura.set([['zero-shot (k = 0)', `${VIZ.fmt(100 * res[0], 3)} %`], ['one-shot (k = 1)', `${VIZ.fmt(100 * res[1], 3)} %`], ['few-shot (k = 5)', `${VIZ.fmt(100 * res[5], 3)} %`], ['ganancia de 0 a 5', `${VIZ.fmt(100 * (res[5] - res[0]), 3)} puntos`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res.length) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(5, Math.round(pl.ix(x)))); dibujar();
      tip.mostrar(x, y, `k = <b>${hover}</b> (${hover === 0 ? 'zero-shot' : hover === 1 ? 'one-shot' : 'few-shot'})<br>exactitud <b>${VIZ.fmt(100 * res[hover], 3)} %</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('in-context-learning', {
    intro: String.raw`
      <p>Los modelos de lenguaje grandes pueden hacer tareas nuevas <em>sin cambiar sus pesos</em>: basta describirlas en el texto de entrada, el <strong>prompt</strong>. Si el prompt solo explica la tarea, se habla de <strong>zero-shot</strong>; si incluye un ejemplo resuelto, <strong>one-shot</strong>; si incluye varios, <strong>few-shot</strong>.</p>
      <p>No hay entrenamiento en el sentido habitual: el modelo ya aprendió, durante el preentrenamiento, a continuar textos de todo tipo, y un prompt con ejemplos es un texto cuya continuación natural es la respuesta. A esa capacidad se le llama <strong>aprendizaje en contexto</strong> (<em>in-context learning</em>).</p>`,
    visualizaciones: [
      { titulo: 'Un prompt con ejemplos', descripcion: 'Cambie k y los nombres de las etiquetas. Con etiquetas arbitrarias, k = 0 no tiene respuesta posible; con k ≥ 1 el prompt define la tarea.', montar: montarPrompt },
      { titulo: 'Más ejemplos, mejor respuesta', descripcion: 'Compare zero-shot, one-shot y few-shot. Suba el ruido y la fracción de ejemplos equivocados y vea cuánto los resiente cada nivel.', montar: montarCurva },
    ],
    teoria: String.raw`
      <h2>Qué es y qué no es</h2>
      <p>Esta página es una <em>analogía mecánica</em>, no un modelo de lenguaje: la «predicción» se hace comparando el embedding de la consulta con el promedio de los ejemplos de cada etiqueta (prototipos), con representaciones que vienen de un corpus pequeño. Sirve para ver las propiedades cualitativas del aprendizaje en contexto:</p>
      <ul>
        <li>La tarea se especifica solo con el contexto: los pesos no cambian.</li>
        <li>Más ejemplos ayudan, con rendimientos decrecientes.</li>
        <li>Si las etiquetas tienen significado previo, existe alguna capacidad <em>zero-shot</em>; si son arbitrarias, depende por completo de los ejemplos.</li>
        <li>Los ejemplos erróneos perjudican, pero poco si la mayoría es correcta.</li>
      </ul>
      <h2>Formalmente</h2>
      <p>Dado un prompt \(p=(x_1,y_1,\dots,x_k,y_k,x_{*})\), el modelo produce \(P_\theta(y\mid p)\). El mismo \(\theta\) sirve para cualquier tarea que se pueda expresar en texto. En los modelos reales, el mecanismo no se conoce por completo; entre las hipótesis están cabezas de atención que copian patrones («cabezas de inducción») y una forma implícita de descenso de gradiente sobre los ejemplos durante la pasada hacia adelante.</p>
      <table>
        <tr><th>Modo</th><th>Prompt</th></tr>
        <tr><td>Zero-shot</td><td>«Clasifica la palabra en animal, comida o ciudad: pan →»</td></tr>
        <tr><td>One-shot</td><td>«perro → X; pan →»</td></tr>
        <tr><td>Few-shot</td><td>«perro → X; arroz → Y; roma → Z; pan →»</td></tr>
      </table>
      <div class="recuadro"><p>El aprendizaje en contexto no es magia: el rendimiento depende mucho del formato, del orden y de la elección de los ejemplos, y aparece con claridad solo en modelos grandes. Si se dispone de muchos ejemplos, entrenar de verdad (<a href="tema.html?id=transfer-learning">ajuste fino</a>) suele ser mejor. Se apoya en lo aprendido por <a href="tema.html?id=next-token-prediction">predicción del siguiente token</a>.</p></div>`,
  });
})();
