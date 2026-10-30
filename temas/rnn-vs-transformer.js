(function () {
  'use strict';
  const { color: C } = VIZ;

  /* ---------- Fig. 1: costo en función del largo de la secuencia ---------- */

  function montarCosto(cuerpo) {
    let d = 512, hover = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dimensión del modelo d', min: 64, max: 2048, paso: 64, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['RNN: operaciones n·d²', C.s2], ['autoatención: operaciones n²·d + n·d²', C.s1], ['RNN: pasos que deben ir en orden', C.apagado], ['autoatención: memoria de los pesos n²', C.s6]];
    VIZ.leyenda(cuerpo, SER.map(([t, c], i) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Costo por capa, en unidades de multiplicaciones (un solo ejemplo). La atención gasta más a partir de n ≈ d, pero todas sus operaciones son independientes y se pueden hacer a la vez; la RNN necesita n pasos secuenciales. La memoria n² es el límite de la atención con secuencias muy largas.');
    const F = [(n) => n * d * d, (n) => n * n * d + n * d * d, (n) => n, (n) => n * n];
    const NS = Array.from({ length: 61 }, (_, i) => 10 ** (1 + i / 15));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 1, xmax: 5, ymin: 10, ymax: 1e13 }, { logY: true, etiquetaX: 'largo de la secuencia n', etiquetaY: 'costo (escala log)', ticksX: [1, 2, 3, 4, 5], formatoX: (v) => VIZ.entero(10 ** v), formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      ctx.save(); pl.recortar();
      F.forEach((f, i) => VIZ.trazar(ctx, pl, NS.map((n) => [Math.log10(n), f(n)]), SER[i][1], 2.5, i === 2 ? [4, 4] : null));
      const cruce = d; if (Math.log10(cruce) >= 1 && Math.log10(cruce) <= 5) { ctx.strokeStyle = C.apagado; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(Math.log10(cruce)), pl.y0); ctx.lineTo(pl.sx(Math.log10(cruce)), pl.y1); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.fillText('n = d', pl.sx(Math.log10(cruce)) + 4, pl.y1 + 12); }
      if (hover) F.forEach((f, i) => VIZ.marcador(ctx, pl.sx(Math.log10(hover)), pl.sy(f(hover)), SER[i][1], 4));
      ctx.restore();
      const n = hover || 1000;
      registro.textContent = `Con d = ${d} y n = ${VIZ.entero(n)}: la atención cuesta ${VIZ.fmt(F[1](n) / F[0](n), 3)} veces lo que la RNN en operaciones, pero requiere 1 paso en vez de ${VIZ.entero(n)} pasos secuenciales.`;
      lectura.set([['n', VIZ.entero(n)], ['operaciones RNN', VIZ.entero(F[0](n))], ['operaciones autoatención', VIZ.entero(F[1](n))], ['pasos secuenciales RNN', VIZ.entero(n)], ['pasos secuenciales autoatención', '1'], ['memoria de pesos de atención', VIZ.entero(F[3](n))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.round(10 ** pl.ix(x)); dibujar();
      tip.mostrar(x, y, `n = <b>${VIZ.entero(hover)}</b>` + F.map((f, i) => VIZ.filaTooltip(SER[i][1], SER[i][0].split(':')[0] + (i % 2 ? ' (mem.)' : ''), VIZ.entero(f(hover)))).join('').slice(0, 600));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: cuánto influye la primera palabra en la última ---------- */

  function influencia(n, escala, semilla) {
    const d = 12, r = VIZ.semilla(semilla * 13 + n);
    const N = (e) => () => VIZ.normal(r) * e, M = (e) => Array.from({ length: d }, () => Array.from({ length: d }, N(e)));
    const Wh = M(escala / Math.sqrt(d)), Wx = M(1 / Math.sqrt(d)), WQ = M(1 / Math.sqrt(d)), WK = M(1 / Math.sqrt(d)), WV = M(1 / Math.sqrt(d));
    const X = Array.from({ length: n }, () => Array.from({ length: d }, () => VIZ.normal(r))), dx = Array.from({ length: d }, () => VIZ.normal(r) * 0.01);
    const mv = (W, x) => W.map((f) => f.reduce((s, w, i) => s + w * x[i], 0));
    const rnn = (Z) => { let h = new Array(d).fill(0); for (const x of Z) { const a = mv(Wh, h), b = mv(Wx, x); h = a.map((v, i) => Math.tanh(v + b[i])); } return h; };
    const att = (Z) => { const q = mv(WQ, Z[n - 1]), K = Z.map((z) => mv(WK, z)), V = Z.map((z) => mv(WV, z)), s = K.map((k) => q.reduce((t, v, i) => t + v * k[i], 0) / Math.sqrt(d)), m = Math.max(...s), e = s.map((v) => Math.exp(v - m)), zz = e.reduce((a, b) => a + b, 0); return V[0].map((_, c) => e.reduce((t, w, j) => t + (w / zz) * V[j][c], 0)); };
    const X2 = X.map((x, i) => (i === 0 ? x.map((v, c) => v + dx[c]) : x)), nd = Math.hypot(...dx);
    const dif = (A, B) => Math.hypot(...A.map((v, i) => v - B[i])) / nd;
    return [dif(rnn(X), rnn(X2)), dif(att(X), att(X2))];
  }

  function montarInfluencia(cuerpo) {
    let escala = 0.9, semilla = 1, res = [], hover = -1, pl = null;
    const NS = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Escala de los pesos recurrentes de la RNN', min: 0.4, max: 1.5, paso: 0.05, valor: escala, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { escala = v; calcular(); } });
    ctl.boton('Otros pesos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'RNN: el cambio llega a través de n pasos', forma: 'linea' }, { color: C.s1, texto: 'autoatención: la palabra final consulta directamente a la primera', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Se perturba un poco la primera palabra y se mide cuánto cambia la representación de la última (relativo a la perturbación). En la RNN la señal atraviesa n pasos y se desvanece (o explota); en la atención hay un camino de un solo paso, por largo que sea el texto. Pesos aleatorios, mediana de 10 repeticiones.');
    function calcular() {
      res = NS.map((n) => { const v = Array.from({ length: 10 }, (_, s) => influencia(n, escala, semilla * 10 + s)); return [0, 1].map((k) => { const a = v.map((q) => q[k]).sort((x, y) => x - y); return Math.max(1e-12, (a[4] + a[5]) / 2); }); });
      dibujar();
    }
    function dibujar() {
      if (!res.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 2, xmax: 128, ymin: 1e-12, ymax: 1e2 }, { logY: true, etiquetaX: 'largo de la secuencia n', etiquetaY: 'influencia de la 1.ª palabra en la última', ticksX: [2, 16, 32, 64, 96, 128], formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      [[0, C.s2], [1, C.s1]].forEach(([k, c]) => { VIZ.trazar(ctx, pl, NS.map((n, i) => [n, res[i][k]]), c, 2.5); NS.forEach((n, i) => VIZ.marcador(ctx, pl.sx(n), pl.sy(res[i][k]), c, 3.5)); });
      const u = res[res.length - 1];
      registro.textContent = `Con n = 128: la RNN transmite ${VIZ.fmt(u[0], 2)} de la perturbación y la autoatención, ${VIZ.fmt(u[1], 2)}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y) || !res.length) return tip.ocultar();
      const i = NS.reduce((m, n, k) => (Math.abs(n - pl.ix(x)) < Math.abs(NS[m] - pl.ix(x)) ? k : m), 0);
      tip.mostrar(x, y, `n = <b>${NS[i]}</b>` + VIZ.filaTooltip(C.s2, 'RNN', VIZ.fmt(res[i][0], 2)) + VIZ.filaTooltip(C.s1, 'autoatención', VIZ.fmt(res[i][1], 2)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('rnn-vs-transformer', {
    intro: String.raw`
      <p>Las RNN y los Transformers resuelven el mismo problema —modelar secuencias— con ideas opuestas. La RNN lee en orden y lleva un resumen en un estado que se actualiza paso a paso. El Transformer mira todas las posiciones a la vez y deja que cada una consulte directamente a las demás.</p>
      <p>De ahí salen dos diferencias prácticas: el <strong>camino</strong> que debe recorrer la información entre dos palabras (\(n\) pasos frente a uno) y el <strong>paralelismo</strong> (la RNN es secuencial; la atención, no). El costo, a cambio, es cuadrático en el largo del texto.</p>`,
    visualizaciones: [
      { titulo: 'Costo según el largo de la secuencia', descripcion: 'Compare operaciones, pasos secuenciales y memoria. Busque dónde la atención empieza a costar más que la RNN y cómo cambia con la dimensión d.', montar: montarCosto },
      { titulo: 'Cuánto llega de la primera palabra a la última', descripcion: 'Aumente el largo y observe cómo se apaga la influencia en una RNN y cómo se mantiene en la atención. Cambie la escala de los pesos recurrentes.', montar: montarInfluencia },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>RNN / LSTM / GRU</th><th>Transformer</th></tr>
        <tr><td>Operaciones por capa</td><td>\(O(n\,d^2)\)</td><td>\(O(n^2 d + n\,d^2)\)</td></tr>
        <tr><td>Pasos secuenciales</td><td>\(O(n)\)</td><td>\(O(1)\)</td></tr>
        <tr><td>Camino máximo entre dos posiciones</td><td>\(O(n)\)</td><td>\(O(1)\)</td></tr>
        <tr><td>Memoria de activaciones (una capa)</td><td>\(O(n\,d)\)</td><td>\(O(n^2 + n\,d)\)</td></tr>
        <tr><td>Información del orden</td><td>implícita en la recurrencia</td><td>debe añadirse (<a href="tema.html?id=positional-encoding">posición</a>)</td></tr>
        <tr><td>Generación de un token nuevo</td><td>\(O(d^2)\) (usa el estado)</td><td>\(O(n\,d)\) con caché de claves y valores</td></tr>
      </table>
      <h2>Por qué ganaron los Transformers</h2>
      <ul>
        <li><strong>Paralelismo.</strong> Entrenar una RNN sobre \(n\) pasos no se puede paralelizar en el tiempo; un Transformer procesa toda la secuencia a la vez y aprovecha las GPU (<a href="tema.html?id=gpu-training">GPU Training</a>).</li>
        <li><strong>Dependencias largas.</strong> Un camino de longitud 1 evita el desvanecimiento del gradiente a través del tiempo (<a href="tema.html?id=long-term-dependencies">Long-Term Dependencies</a>).</li>
        <li><strong>Escala.</strong> Al ser tan regulares (un bloque repetido), se escalan bien a miles de millones de parámetros.</li>
      </ul>
      <h2>Dónde siguen siendo útiles las RNN</h2>
      <p>Cuando el largo es muy grande o hay que procesar un flujo continuo con memoria constante, el costo cuadrático de la atención pesa; las RNN, y las variantes modernas de modelos de espacio de estados, usan memoria constante por paso. También se mantienen en dispositivos con poca memoria.</p>
      <div class="recuadro"><p>Para reducir el costo cuadrático existen atenciones dispersas, locales o aproximadas, y trucos como el <em>FlashAttention</em>, que reorganiza el cálculo para no materializar la matriz de pesos. Contexto: <a href="tema.html?id=transformer-block">Transformer Block</a>, <a href="tema.html?id=rnn-hidden-state">RNN</a>.</p></div>`,
  });
})();
