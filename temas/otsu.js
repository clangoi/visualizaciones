(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = 120, H = 80, BINS = 64;

  // Varianza entre clases σ_B²(t) para cada umbral t (índice de bin: el objeto es lo que queda sobre el bin t).
  function otsu(hist) {
    const n = hist.reduce((a, b) => a + b, 0), K = hist.length;
    let muT = 0;
    hist.forEach((h, i) => { muT += (i * h) / n; });
    const sb = new Array(K).fill(0);
    let w = 0, mu = 0, mejor = 0;
    for (let t = 0; t < K; t++) {
      w += hist[t] / n; mu += (t * hist[t]) / n;
      sb[t] = w > 0 && w < 1 ? (muT * w - mu) ** 2 / (w * (1 - w)) : 0;
      if (sb[t] > sb[mejor]) mejor = t;
    }
    let sT = 0;
    hist.forEach((h, i) => { sT += ((i - muT) ** 2 * h) / n; });
    return { sb, mejor, sT };
  }
  const aNivel = (t) => (t + 1) / BINS; // el umbral del bin t, en [0, 1]

  /* ---------- Fig. 1: una imagen, su histograma y el umbral ---------- */

  function montarImagen(cuerpo) {
    let tipo = 'monedas', ruido = 0.06, ilum = 0, semilla = 3, t = 20, im = null, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Imagen', opciones: [['monedas', 'Monedas'], ['celulas', 'Células'], ['texto', 'Trazos oscuros']], valor: tipo,
      alCambiar: (v) => { tipo = v; nueva(true); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.2, paso: 0.01, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; nueva(false); } });
    ctl.rango({ etiqueta: 'Iluminación no uniforme', min: 0, max: 1, paso: 0.05, valor: ilum, formato: (v) => v.toFixed(2), alCambiar: (v) => { ilum = v; nueva(false); } });
    const rUmbral = ctl.rango({ etiqueta: 'Umbral t', min: 0, max: BINS - 2, valor: t, formato: (v) => aNivel(v).toFixed(3), alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Umbral de Otsu', () => { t = res.mejor; rUmbral.valor = t; dibujar(); }, { primario: true });
    ctl.boton('Nueva imagen', () => { semilla++; nueva(true); });

    const PROP = W / H;
    const lienzoImg = VIZ.lienzo(cuerpo, { altoFn: (w) => VIZ.img.paneles({ ancho: w }, 2, PROP).alturaTotal });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.36, altoMin: 220, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'histograma' },
      { color: C.s2, texto: 'σ_B²(t), varianza entre clases', forma: 'linea' },
      { color: C.tinta, texto: 'umbral elegido / píxel > t', forma: 'linea' },
      { color: C.s6, texto: 'umbral de Otsu', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el histograma para fijar el umbral. Suba la iluminación no uniforme: el histograma deja de ser bimodal y ningún umbral global separa bien las monedas.');

    function nueva(reset) {
      im = VIZ.img.escena(tipo, W, H, semilla, { ruido, iluminacion: ilum });
      res = otsu(VIZ.img.histograma(im, BINS));
      if (reset) { t = res.mejor; rUmbral.valor = t; }
      lienzoImg.redibujar();
      dibujar();
    }

    lienzoImg.alDibujar = () => {
      if (!im) return;
      const { ctx } = lienzoImg;
      lienzoImg.limpiar();
      const P = VIZ.img.paneles(lienzoImg, 2, PROP);
      const a = P.pos(0), b = P.pos(1);
      VIZ.img.dibujar(ctx, im, a.x, a.y, P.ancho, P.alto);
      VIZ.img.rotulo(ctx, 'imagen en grises', a.x, a.y);
      VIZ.img.dibujar(ctx, VIZ.img.umbralizar(im, aNivel(t)), b.x, b.y, P.ancho, P.alto, { modo: 'binaria' });
      VIZ.img.rotulo(ctx, `píxeles con intensidad > ${aNivel(t).toFixed(3)}`, b.x, b.y);
    };

    let plano = null, hist = [];
    function dibujar() {
      if (!im) return;
      lienzoImg.redibujar();
      hist = VIZ.img.histograma(im, BINS);
      const { ctx } = lienzo;
      lienzo.limpiar();
      const hmax = Math.max(...hist);
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: hmax * 1.08 }, { etiquetaX: 'intensidad', etiquetaY: 'píxeles', margen: { izq: 46 } });
      plano.ejes();
      const bw = plano.sx(1 / BINS) - plano.sx(0);
      hist.forEach((h, i) => {
        if (!h) return;
        const x = plano.sx(i / BINS), y = plano.sy(h);
        ctx.fillStyle = C.inactivo;
        ctx.beginPath();
        ctx.roundRect(x + 1, y, Math.max(1, bw - 2), plano.y0 - y, [Math.min(4, bw / 3), Math.min(4, bw / 3), 0, 0]);
        ctx.fill();
      });
      const smax = Math.max(...res.sb) || 1;
      VIZ.trazar(ctx, plano, res.sb.map((s, i) => [aNivel(i), (s / smax) * hmax]), C.s2, 2);
      const linea = (v, col, guiones) => {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; if (guiones) ctx.setLineDash(guiones);
        ctx.beginPath(); ctx.moveTo(plano.sx(v), plano.y1); ctx.lineTo(plano.sx(v), plano.y0); ctx.stroke(); ctx.restore();
      };
      linea(aNivel(res.mejor), C.s6, [5, 4]);
      linea(aNivel(t), C.tinta);
      VIZ.marcador(ctx, plano.sx(aNivel(t)), plano.sy((res.sb[t] / smax) * hmax), C.s2, 4.5);
      const total = W * H, sobre = hist.slice(t + 1).reduce((a, b) => a + b, 0);
      lectura.set([
        ['umbral t', aNivel(t).toFixed(3)],
        ['Otsu t*', aNivel(res.mejor).toFixed(3)],
        ['varianza entre clases / máx.', VIZ.fmt(res.sb[t] / smax, 3)],
        ['separabilidad', VIZ.fmt(smax / res.sT, 3)],
        ['píxeles de objeto', `${((100 * sobre) / total).toFixed(1)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;

    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const i = Math.min(BINS - 1, Math.max(0, Math.floor(plano.ix(x) * BINS)));
      tip.mostrar(x, y, `intensidad <b>${(i / BINS).toFixed(3)}–${((i + 1) / BINS).toFixed(3)}</b><br>píxeles <b>${hist[i]}</b>`
        + VIZ.filaTooltip(C.s2, 'σ_B² con t aquí', VIZ.fmt(res.sb[i])));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      t = Math.min(BINS - 2, Math.max(0, Math.floor(plano.ix(x) * BINS)));
      rUmbral.valor = t;
      dibujar();
    });
    nueva(true);
  }

  /* ---------- Fig. 2: mezcla de dos gaussianas, Otsu frente al umbral de error mínimo ---------- */

  function montarMezcla(cuerpo) {
    let p = 0.15, sep = 0.4, s0 = 0.1, s1 = 0.05;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Proporción de objeto p', min: 0.02, max: 0.5, paso: 0.01, valor: p, formato: (v) => v.toFixed(2), alCambiar: (v) => { p = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Separación de medias', min: 0.1, max: 0.6, paso: 0.01, valor: sep, formato: (v) => v.toFixed(2), alCambiar: (v) => { sep = v; dibujar(); } });
    ctl.rango({ etiqueta: 'σ del fondo', min: 0.03, max: 0.15, paso: 0.005, valor: s0, formato: (v) => v.toFixed(3), alCambiar: (v) => { s0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'σ del objeto', min: 0.03, max: 0.15, paso: 0.005, valor: s1, formato: (v) => v.toFixed(3), alCambiar: (v) => { s1 = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: '(1 − p)·fondo', forma: 'linea' },
      { color: C.s2, texto: 'p·objeto', forma: 'linea' },
      { color: C.tinta, texto: 'histograma total', forma: 'linea' },
      { color: C.s6, texto: 'umbral de Otsu', forma: 'linea' },
      { color: C.s7, texto: 'umbral de error mínimo', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Baje la proporción de objeto a menos de 0,1 con σ distintas: Otsu se desplaza hacia la clase pequeña y su error crece, mientras el umbral de error mínimo sigue el cruce de las curvas.');

    const N = 400;
    const g = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
    const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
    function erf(x) { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); }
    let plano = null, m0 = 0, m1 = 0;
    const err = (t) => (1 - p) * (1 - Phi((t - m0) / s0)) + p * Phi((t - m1) / s1);

    function dibujar() {
      m0 = 0.5 - sep / 2; m1 = 0.5 + sep / 2;
      const f0 = (x) => (1 - p) * g(x, m0, s0), f1 = (x) => p * g(x, m1, s1);
      const xs = Array.from({ length: N }, (_, i) => i / (N - 1));
      const hist = xs.map((x) => f0(x) + f1(x));
      const r = otsu(hist);
      const tO = r.mejor / (N - 1);
      let tB = m0, emin = Infinity;
      for (let i = 0; i < N; i++) { const x = m0 + ((m1 - m0) * i) / (N - 1), e = err(x); if (e < emin) { emin = e; tB = x; } }
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...hist) * 1.1;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax }, { etiquetaX: 'intensidad', etiquetaY: 'densidad', margen: { izq: 46 } });
      plano.ejes();
      // Área de error de cada umbral: objeto bajo el umbral y fondo sobre él.
      ctx.save();
      plano.recortar();
      const sombra = (f, desde, hasta, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(plano.sx(desde), plano.y0);
        for (let i = 0; i <= 80; i++) { const x = desde + ((hasta - desde) * i) / 80; ctx.lineTo(plano.sx(x), plano.sy(f(x))); }
        ctx.lineTo(plano.sx(hasta), plano.y0);
        ctx.fill();
      };
      sombra(f0, tO, 1, VIZ.alfa(C.s1, 0.18));
      sombra(f1, 0, tO, VIZ.alfa(C.s2, 0.18));
      ctx.restore();
      VIZ.trazar(ctx, plano, xs.map((x) => [x, f0(x)]), C.s1, 2);
      VIZ.trazar(ctx, plano, xs.map((x) => [x, f1(x)]), C.s2, 2);
      VIZ.trazar(ctx, plano, xs.map((x, i) => [x, hist[i]]), C.tinta, 1.5, [2, 3]);
      for (const [v, col] of [[tO, C.s6], [tB, C.s7]]) {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(plano.sx(v), plano.y1); ctx.lineTo(plano.sx(v), plano.y0); ctx.stroke(); ctx.restore();
      }
      lectura.set([
        ['Otsu t*', tO.toFixed(3)],
        ['error mínimo t_B', tB.toFixed(3)],
        ['error con Otsu', `${(100 * err(tO)).toFixed(2)} %`],
        ['error mínimo', `${(100 * emin).toFixed(2)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const v = plano.ix(x);
      tip.mostrar(x, y, `intensidad <b>${v.toFixed(3)}</b>`
        + VIZ.filaTooltip(C.s1, 'fondo', VIZ.fmt((1 - p) * g(v, m0, s0)))
        + VIZ.filaTooltip(C.s2, 'objeto', VIZ.fmt(p * g(v, m1, s1)))
        + VIZ.filaTooltip(C.tinta, 'error si t = aquí', `${(100 * err(v)).toFixed(2)} %`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('otsu', {
    intro: String.raw`
      <p><strong>Segmentar</strong> es separar los píxeles del objeto de los del fondo. La forma más simple es un
      <strong>umbral</strong>: todo píxel más claro que \(t\) es objeto. El problema es elegir \(t\) sin mirar la imagen.</p>
      <p>El método de <strong>Otsu</strong> (1979) lo elige solo a partir del histograma: prueba todos los umbrales y se queda
      con el que deja las dos clases lo más separadas posible, es decir, con la mayor <em>varianza entre clases</em>.
      Funciona muy bien cuando el histograma tiene dos montes claros, y falla de maneras predecibles cuando no.</p>`,
    visualizaciones: [
      {
        titulo: 'Umbral de Otsu en una imagen',
        descripcion: 'La curva naranja es la varianza entre clases para cada umbral; Otsu toma su máximo. Mueva el umbral y compare la segmentación.',
        montar: montarImagen,
      },
      {
        titulo: 'Cuando las clases no están equilibradas',
        descripcion: 'Un histograma modelado como mezcla de dos gaussianas. Las zonas sombreadas son el error de Otsu: fondo tomado como objeto y objeto tomado como fondo.',
        montar: montarMezcla,
      },
    ],
    teoria: String.raw`
      <h2>Planteamiento</h2>
      <p>Sea \(p_i\) la fracción de píxeles con nivel \(i \in \{0, \dots, L-1\}\). Un umbral \(t\) divide los niveles en la clase
      \(C_0 = \{0..t\}\) (fondo) y \(C_1 = \{t+1..L-1\}\) (objeto), con probabilidades y medias</p>
      \[ \omega_0(t) = \sum_{i \le t} p_i, \quad \omega_1 = 1 - \omega_0, \quad
         \mu_0(t) = \frac{1}{\omega_0}\sum_{i \le t} i\,p_i, \quad \mu_1(t) = \frac{\mu_T - \omega_0\mu_0}{\omega_1}. \]
      <p>La varianza total se descompone en una parte <em>dentro</em> de las clases y otra <em>entre</em> ellas:</p>
      \[ \sigma_T^2 = \underbrace{\omega_0\sigma_0^2 + \omega_1\sigma_1^2}_{\sigma_W^2(t)} + \underbrace{\omega_0\omega_1(\mu_1 - \mu_0)^2}_{\sigma_B^2(t)}. \]
      <p>Como \(\sigma_T^2\) no depende de \(t\), minimizar la dispersión dentro de las clases equivale a maximizar \(\sigma_B^2\).
      Esta última solo necesita sumas acumuladas \(\omega(t) = \sum_{i\le t} p_i\) y \(\mu(t) = \sum_{i \le t} i\,p_i\):</p>
      \[ \sigma_B^2(t) = \frac{\big(\mu_T\,\omega(t) - \mu(t)\big)^2}{\omega(t)\,\big(1 - \omega(t)\big)}, \qquad t^* = \arg\max_t \sigma_B^2(t). \]
      <h2>Algoritmo</h2>
      <pre><code>calcular el histograma normalizado p₀ … p_{L−1}
μ_T ← Σ i·pᵢ;  ω ← 0;  μ ← 0;  mejor ← 0
para t ← 0 hasta L − 2:
    ω ← ω + p_t;   μ ← μ + t·p_t
    σ_B² ← (μ_T·ω − μ)² / (ω·(1 − ω))
    si σ_B² &gt; mejor: mejor ← σ_B²;  t* ← t
devolver t*</code></pre>
      <p>Una pasada sobre la imagen para el histograma y otra sobre los \(L\) niveles: \(\Theta(N + L)\) para \(N\) píxeles.
      La medida de calidad \(\eta = \sigma_B^2(t^*)/\sigma_T^2 \in [0, 1]\) indica qué tan separables son las clases.</p>
      <h2>Supuestos y límites</h2>
      <ul>
        <li><strong>Histograma bimodal.</strong> Otsu supone dos clases. Con iluminación no uniforme el fondo de un lado
        de la imagen se parece al objeto del otro: hay que corregir el fondo o usar umbrales <em>locales</em> (por ventanas).</li>
        <li><strong>Clases equilibradas.</strong> El criterio pondera por \(\omega_0\omega_1\), así que favorece particiones
        parecidas. Si el objeto ocupa el 3&nbsp;% de la imagen, el umbral se desplaza dentro de la clase pequeña.</li>
        <li><strong>Varianzas parecidas.</strong> El umbral de error mínimo (Kittler e Illingworth) modela cada clase como una
        gaussiana con su propia varianza y busca el cruce de \(\omega_0 \mathcal{N}(\mu_0, \sigma_0^2)\) y \(\omega_1 \mathcal{N}(\mu_1, \sigma_1^2)\),
        que es la regla de <a href="tema.html?id=bayes">decisión de Bayes</a> aplicada a la intensidad.</li>
      </ul>
      <div class="recuadro"><p>Otsu es un caso unidimensional del <a href="tema.html?id=fisher">criterio de Fisher</a> y de
      <a href="tema.html?id=kmeans">k-means</a> con \(k = 2\): las tres ideas buscan grupos compactos y separados.</p></div>
      <p>Después de umbralizar casi siempre se limpia el resultado con <a href="tema.html?id=morfologia">morfología</a> y se
      separan los objetos en componentes conexas, o se usa <a href="tema.html?id=region-growing">crecimiento de regiones</a>.</p>`,
  });
})();
