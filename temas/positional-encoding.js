(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const pe = (pos, i, d) => { const k = Math.floor(i / 2), w = 1 / 10000 ** ((2 * k) / d); return i % 2 === 0 ? Math.sin(pos * w) : Math.cos(pos * w); };
  const f2 = (v) => VIZ.fmt(v, 3).replace('-', '−');

  /* ---------- Fig. 1: el patrón sinusoidal ---------- */

  function montarMapa(cuerpo) {
    let d = 32, n = 40, geo = null, dimSel = 4;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Dimensión del modelo d', min: 8, max: 64, paso: 4, valor: d, alCambiar: (v) => { d = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Posiciones', min: 10, max: 80, paso: 5, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Dimensión que se grafica a la derecha', min: 0, max: 31, valor: dimSel, alCambiar: (v) => { dimSel = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 600 ? 340 : 480) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor positivo', forma: 'cuadro' }, { color: C.s2, texto: 'valor negativo', forma: 'cuadro' }, { color: C.s6, texto: 'valor de la dimensión elegida a lo largo de las posiciones', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es la codificación de una posición; cada columna, una dimensión. Las primeras dimensiones oscilan rápido (frecuencia alta) y las últimas, muy despacio: es como un sistema de numeración con relojes de distinta velocidad.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo, ancha = W > 600, mw = ancha ? W * 0.5 - 30 : W - 50, cw = mw / d, ch = Math.min(6, 280 / n);
      lienzo.limpiar();
      const M = Array.from({ length: n }, (_, p) => Array.from({ length: d }, (_, i) => pe(p, i, d)));
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('posición ↓   dimensión →', 40, 4);
      DL.mapa(ctx, M, 40, 20, d * cw, n * ch, { divergente: true, min: -1, max: 1 });
      ctx.strokeStyle = C.s6; ctx.lineWidth = 2; const ds = Math.min(dimSel, d - 1); ctx.strokeRect(40 + ds * cw, 20, cw, n * ch);
      geo = { x: 40, y: 20, cw, ch, M };
      const px = ancha ? W * 0.5 + 64 : 50, py = ancha ? 20 : 40 + n * ch, pw = ancha ? W * 0.5 - 84 : W - 80, ph = ancha ? 220 : 160;
      const pl = VIZ.plano({ ancho: W, alto: py + ph + 40, ctx }, { xmin: 0, xmax: n - 1, ymin: -1.1, ymax: 1.1 }, { etiquetaX: 'posición', margen: { izq: px, der: W - px - pw, sup: py, inf: 40 } });
      pl.ejes();
      VIZ.trazar(ctx, pl, M.map((f, p) => [p, f[ds]]), C.s6, 2.5);
      const w = 1 / 10000 ** ((2 * Math.floor(ds / 2)) / d);
      registro.textContent = `Dimensión ${ds + 1}: ${ds % 2 === 0 ? 'seno' : 'coseno'} de frecuencia ${VIZ.fmt(w, 3)} rad/posición; periodo ≈ ${VIZ.fmt((2 * Math.PI) / w, 3)} posiciones.`;
      lectura.set([['dimensión graficada', String(ds + 1)], ['frecuencia', VIZ.fmt(w, 3)], ['periodo', `${VIZ.fmt((2 * Math.PI) / w, 3)} posiciones`], ['valores distintos por posición', String(d)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = Math.floor((x - geo.x) / geo.cw), p = Math.floor((y - geo.y) / geo.ch);
      if (i >= 0 && i < d && p >= 0 && p < n) tip.mostrar(x, y, `posición <b>${p}</b>, dimensión <b>${i + 1}</b><br>${i % 2 === 0 ? 'sen' : 'cos'} = <b>${f2(geo.M[p][i])}</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: sin posición, el orden no existe ---------- */

  const FRASE = ['el', 'perro', 'muerde', 'al', 'cartero'];
  function montarOrden(cuerpo) {
    let usarPE = false, perm = [0, 1, 2, 3, 4], semilla = 1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Sumar la codificación posicional a cada palabra', valor: usarPE, alCambiar: (v) => { usarPE = v; dibujar(); } });
    ctl.boton('Reordenar las palabras', () => { const r = VIZ.semilla(Math.floor(Math.random() * 1e6)); do { perm = [0, 1, 2, 3, 4]; for (let i = 4; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } } while (perm.every((v, i) => v === i)); dibujar(); }, { primario: true });
    ctl.boton('Orden original', () => { perm = [0, 1, 2, 3, 4]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 600 ? 300 : 380) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'salida de la atención de cada palabra (primeras 8 componentes)', forma: 'cuadro' }, { color: C.s6, texto: 'la salida de cada palabra no cambia al reordenar', forma: 'cuadro' }, { color: C.s8, texto: 'la salida cambia al reordenar', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una capa de autoatención, con pesos aleatorios fijos, procesa la frase en su orden original y en uno reordenado. Sin codificación posicional, cada palabra recibe exactamente la misma salida en ambos casos: la capa no distingue «el perro muerde al cartero» de «al cartero muerde el perro».');
    function dibujar() {
      const T = DL.transformerJuguete(3, 16), d = 16;
      const emb = (w, p) => T.emb(w).map((v, i) => v + (usarPE ? pe(p, i, d) : 0));
      const orig = T.atender(FRASE.map((w, p) => emb(w, p))).O, reord = T.atender(perm.map((k, p) => emb(FRASE[k], p))).O;
      // Salida de cada palabra (identificada por su índice original) en cada orden.
      const enReord = FRASE.map((_, k) => reord[perm.indexOf(k)]);
      const dif = FRASE.map((_, k) => Math.hypot(...orig[k].map((v, i) => v - enReord[k][i])));
      const { ctx, ancho: W } = lienzo, c = Math.min(26, (W - 150) / 8);
      lienzo.limpiar(); geo = [];
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`Orden de lectura: ${perm.map((k) => FRASE[k]).join(' ')}`, 8, 6);
      [['Salida en el orden original', orig, 0], ['Salida de las mismas palabras tras reordenar', enReord, 1]].forEach(([t, O, q]) => {
        const y = 34 + q * (FRASE.length * c + 40);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(t, 100, y - 3);
        DL.mapa(ctx, O.map((f) => f.slice(0, 8)), 100, y, 8 * c, FRASE.length * c, { divergente: true, min: -2, max: 2 });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; FRASE.forEach((w, k) => ctx.fillText(w, 94, y + (k + 0.5) * c));
        geo.push({ x: 100, y, c, O });
      });
      const y2 = 34 + 2 * (FRASE.length * c + 40) - 24;
      FRASE.forEach((w, k) => { ctx.fillStyle = dif[k] < 1e-9 ? C.s6 : C.s8; ctx.beginPath(); ctx.roundRect(100 + 8 * c + 18, 34 + k * c + 3, 10, c - 6, 3); ctx.fill(); });
      const maxd = Math.max(...dif);
      registro.textContent = perm.every((v, i) => v === i) ? 'Reordene las palabras para comparar.' : maxd < 1e-9 ? 'Cada palabra recibe exactamente la misma salida: la atención es equivariante a permutaciones, por eso no distingue el orden.' : `La salida de las palabras cambia hasta ${VIZ.fmt(maxd, 3)} (norma): la posición sí influye en el resultado.`;
      lectura.set([['diferencia máxima tras reordenar', VIZ.fmt(maxd, 3)], ['codificación posicional', usarPE ? 'sí' : 'no'], ['palabras cuya salida cambia', `${dif.filter((v) => v > 1e-9).length} de ${FRASE.length}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = geo.find((q) => x >= q.x && x < q.x + 8 * q.c && y >= q.y && y < q.y + FRASE.length * q.c);
      if (!g) return tip.ocultar();
      const k = Math.floor((y - g.y) / g.c), j = Math.floor((x - g.x) / g.c);
      tip.mostrar(x, y, `«${FRASE[k]}», componente ${j + 1}: <b>${f2(g.O[k][j])}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('positional-encoding', {
    intro: String.raw`
      <p>Una RNN conoce el orden porque procesa las palabras una tras otra. La autoatención, en cambio, mira todas a la vez y trata la frase como un <em>conjunto</em>: «el perro muerde al cartero» y «al cartero muerde el perro» tendrían las mismas salidas por palabra. Para que el orden importe hay que <strong>inyectarlo</strong>.</p>
      <p>La <strong>codificación posicional</strong> (<em>positional encoding</em>) suma a cada palabra un vector que depende de su posición. En el Transformer original son senos y cosenos de distintas frecuencias; cada posición obtiene un «código» único y las distancias se vuelven fáciles de calcular.</p>`,
    visualizaciones: [
      { titulo: 'El patrón sinusoidal', descripcion: 'Cambie la dimensión del modelo y observe cómo las primeras columnas oscilan rápido y las últimas, lento. Elija una dimensión para ver su onda.', montar: montarMapa },
      { titulo: 'Sin posición, el orden no existe', descripcion: 'Reordene las palabras con y sin codificación posicional y compare las salidas de la capa de atención.', montar: montarOrden },
    ],
    teoria: String.raw`
      <h2>Codificación sinusoidal</h2>
      <p>Para la posición \(p\) y las dimensiones \(2k\) y \(2k+1\):</p>
      \[ \operatorname{PE}(p,2k)=\sin\!\Big(\frac{p}{10000^{2k/d}}\Big),\qquad \operatorname{PE}(p,2k+1)=\cos\!\Big(\frac{p}{10000^{2k/d}}\Big). \]
      <p>Las frecuencias forman una progresión geométrica, de \(1\) a \(1/10000\) rad por posición. Se suma a la embedding de la palabra: \(x_p'=x_p+\operatorname{PE}(p)\).</p>
      <h2>Propiedades</h2>
      <ul>
        <li><strong>Posiciones relativas:</strong> \(\operatorname{PE}(p+\delta)\) es una transformación lineal (una rotación en cada par seno/coseno) de \(\operatorname{PE}(p)\), con una matriz que solo depende de \(\delta\). Así el modelo puede aprender a atender a «la palabra 3 posiciones atrás».</li>
        <li><strong>Longitud no vista:</strong> la fórmula se puede evaluar en posiciones mayores que las del entrenamiento (aunque en la práctica se extrapola mal).</li>
        <li><strong>Sin parámetros:</strong> no hay nada que aprender, a diferencia de las posiciones <em>aprendidas</em> (una tabla \(L\times d\)) que usan GPT-2 o BERT.</li>
      </ul>
      <h2>Equivarianza a permutaciones</h2>
      <p>Sin posición, si \(P\) es una matriz de permutación, entonces \(\operatorname{Attention}(PX)=P\,\operatorname{Attention}(X)\): reordenar la entrada solo reordena la salida, de modo que ninguna salida depende del orden de las demás palabras.</p>
      <div class="recuadro"><p>Variantes modernas codifican la posición <em>relativa</em> dentro de la atención (RoPE, ALiBi) en vez de sumarla a la entrada. Para el uso en el bloque completo, véase <a href="tema.html?id=transformer-block">Transformer Block</a>.</p></div>`,
  });
})();
