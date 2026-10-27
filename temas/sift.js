(function () {
  'use strict';
  const { color: C } = VIZ;
  const I = VIZ.img;
  const W = 96, H = 64;
  const S0 = 1.2, K = Math.pow(2, 1 / 3), NIV = 9; // escalas σ_i = S0·K^i, i = 0 … NIV

  // Manchas claras y oscuras de varios tamaños y un borde recto (que da respuestas de borde).
  function imagen(semilla, ruido) {
    const rnd = VIZ.semilla(semilla), im = I.crear(W, H);
    const manchas = [];
    for (let k = 0, t = 0; k < 9 && t < 300; t++) {
      const s = 1.6 + rnd() * 4.2, m = { x: 6 + rnd() * (W - 12), y: 6 + rnd() * (H - 12), s, a: rnd() < 0.75 ? 0.5 : -0.35 };
      if (m.x > W * 0.72 || manchas.some((o) => Math.hypot(o.x - m.x, o.y - m.y) < 2.2 * (o.s + m.s))) continue;
      manchas.push(m); k++;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0.35 + (x > W * 0.8 ? 0.3 : 0);
      for (const m of manchas) v += m.a * Math.exp(-((x - m.x) ** 2 + (y - m.y) ** 2) / (2 * m.s * m.s));
      im.d[y * W + x] = Math.min(1, Math.max(0, v + VIZ.normal(rnd) * ruido));
    }
    im.manchas = manchas;
    return im;
  }

  // Espacio de escalas, diferencias de gaussianas y extremos en vecindarios 3×3×3.
  function detectar(im, umbral, quitarBordes) {
    const L = [], D = [];
    for (let i = 0; i <= NIV; i++) L.push(I.gauss(im, S0 * Math.pow(K, i)));
    for (let i = 0; i < NIV; i++) { const d = I.crear(W, H); for (let j = 0; j < W * H; j++) d.d[j] = L[i + 1].d[j] - L[i].d[j]; D.push(d); }
    const pts = [];
    for (let s = 1; s < NIV - 1; s++) for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const v = D[s].d[y * W + x];
      if (Math.abs(v) < umbral) continue;
      let max = true, min = true;
      for (let ds = -1; ds <= 1 && (max || min); ds++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!ds && !dx && !dy) continue;
        const u = D[s + ds].d[(y + dy) * W + x + dx];
        if (u >= v) max = false;
        if (u <= v) min = false;
      }
      if (!max && !min) continue;
      // Prueba de borde: razón de curvaturas principales del hessiano 2×2.
      const d = D[s].d, f = (i, j) => d[(y + j) * W + x + i];
      const dxx = f(1, 0) + f(-1, 0) - 2 * v, dyy = f(0, 1) + f(0, -1) - 2 * v, dxy = (f(1, 1) - f(1, -1) - f(-1, 1) + f(-1, -1)) / 4;
      const tr = dxx + dyy, det = dxx * dyy - dxy * dxy, r = 10;
      const borde = det <= 0 || (tr * tr) / det >= ((r + 1) ** 2) / r;
      if (quitarBordes && borde) continue;
      pts.push({ x, y, s, sigma: S0 * Math.pow(K, s), v, borde });
    }
    return { L, D, pts };
  }

  /* ---------- Fig. 1: espacio de escalas ---------- */

  function montarEscalas(cuerpo) {
    let semilla = 2, ruido = 0.01, umbral = 0.016, nivel = 4, bordes = true, im = null, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Escala de la DoG', min: 1, max: NIV - 2, valor: nivel, formato: (v) => `σ = ${(S0 * Math.pow(K, v)).toFixed(2)}`, alCambiar: (v) => { nivel = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Umbral de contraste', min: 0.002, max: 0.03, paso: 0.001, valor: umbral, formato: (v) => v.toFixed(3), alCambiar: (v) => { umbral = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.06, paso: 0.005, valor: ruido, formato: (v) => v.toFixed(3), alCambiar: (v) => { ruido = v; nueva(); } });
    ctl.casilla({ etiqueta: 'descartar respuestas de borde', valor: bordes, alCambiar: (v) => { bordes = v; calcular(); } });
    ctl.boton('Nueva imagen', () => { semilla++; nueva(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => I.paneles({ ancho: w }, 2, W / H).alturaTotal });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'punto de interés (radio ∝ σ)', forma: 'punto' },
      { color: C.s2, texto: 'detectado en la escala mostrada', forma: 'punto' },
      { color: C.s8, texto: 'respuesta de borde', forma: 'punto' },
      { color: C.inactivo, texto: 'DoG: gris medio = 0, claro > 0, oscuro < 0' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva la escala: cada mancha da su respuesta más fuerte cuando σ·√2 se parece a su radio, y ahí se detecta. Los círculos grandes entre manchas también son extremos reales: un hueco oscuro rodeado de manchas claras es una mancha a escala grande. Desmarque la casilla para ver los falsos puntos sobre el borde recto de la derecha.');

    function nueva() { im = imagen(semilla, ruido); calcular(); }
    function calcular() { res = detectar(im, umbral, bordes); dibujar(); }
    let geo = null;
    function dibujar() {
      if (!res) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const P = I.paneles(lienzo, 2, W / H), a = P.pos(0), b = P.pos(1), e = P.ancho / W;
      geo = { P, a, b, e };
      I.dibujar(ctx, im, a.x, a.y, P.ancho, P.alto);
      I.rotulo(ctx, `imagen y ${res.pts.length} puntos de interés`, a.x, a.y);
      const Dn = res.D[nivel], m = Math.max(1e-6, ...Array.from(Dn.d, Math.abs));
      I.dibujar(ctx, Dn, b.x, b.y, P.ancho, P.alto, { pixel: (i) => { const g = 127 + 127 * (Dn.d[i] / m); return [g, g, g]; } });
      I.rotulo(ctx, `DoG con σ = ${(S0 * Math.pow(K, nivel)).toFixed(2)}`, b.x, b.y);
      ctx.save();
      ctx.beginPath(); ctx.rect(a.x, a.y, P.ancho, P.alto); ctx.clip();
      for (const p of res.pts) {
        const actual = p.s === nivel;
        ctx.strokeStyle = p.borde ? C.s8 : actual ? C.s2 : C.s1;
        ctx.lineWidth = actual ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(a.x + (p.x + 0.5) * e, a.y + (p.y + 0.5) * e, p.sigma * Math.SQRT2 * e, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      for (const p of res.pts) if (p.s === nivel) VIZ.marcador(ctx, b.x + (p.x + 0.5) * e, b.y + (p.y + 0.5) * e, p.borde ? C.s8 : C.s2, 4);
      lectura.set([
        ['puntos', String(res.pts.length)],
        ['en esta escala', String(res.pts.filter((p) => p.s === nivel).length)],
        ['de borde', String(res.pts.filter((p) => p.borde).length)],
        ['manchas reales', String(im.manchas.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), { a, e } = geo;
      const p = res.pts.find((q) => Math.hypot(a.x + (q.x + 0.5) * e - x, a.y + (q.y + 0.5) * e - y) < Math.max(6, q.sigma * 1.4 * e));
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `posición <b>(${p.x}, ${p.y})</b><br>σ <b>${p.sigma.toFixed(2)}</b><br>DoG <b>${VIZ.fmt(p.v, 3)}</b>${p.borde ? '<br>respuesta de borde' : ''}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nueva();
  }

  /* ---------- Fig. 2: orientación dominante y descriptor ---------- */

  const P2 = 24, R = 8, BINS_O = 36;
  function parche(theta) {
    const im = I.crear(P2, P2), c = Math.cos(theta), s = Math.sin(theta);
    const sg = (z) => 1 / (1 + Math.exp(-z));
    for (let y = 0; y < P2; y++) for (let x = 0; x < P2; x++) {
      const dx = x + 0.5 - P2 / 2, dy = y + 0.5 - P2 / 2;
      const u = c * dx + s * dy, v = -s * dx + c * dy;
      im.d[y * P2 + x] = 0.15 + 0.6 * sg((u + 1) * 1.4) * sg((v + 2) * 1.4) + 0.3 * Math.exp(-((u + 4) ** 2 + (v - 4) ** 2) / 5);
    }
    return im;
  }
  // dom: orientación desde la que se miden las direcciones; si se omite, la dominante del parche.
  function describir(im, domFija) {
    const g = I.gradiente(im), cx = P2 / 2, cy = P2 / 2;
    const hist = new Array(BINS_O).fill(0);
    const peso = (dx, dy) => Math.exp(-(dx * dx + dy * dy) / (2 * (1.5 * R / 2) ** 2));
    for (let y = 0; y < P2; y++) for (let x = 0; x < P2; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > R * R) continue;
      const i = y * P2 + x, a = (g.ang[i] + 2 * Math.PI) % (2 * Math.PI);
      hist[Math.floor((a / (2 * Math.PI)) * BINS_O) % BINS_O] += g.mag[i] * peso(dx, dy);
    }
    const kmax = hist.indexOf(Math.max(...hist)), dom = domFija ?? ((kmax + 0.5) / BINS_O) * 2 * Math.PI;
    const desc = new Array(128).fill(0), c = Math.cos(-dom), s = Math.sin(-dom);
    for (let y = 0; y < P2; y++) for (let x = 0; x < P2; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const rx = c * dx - s * dy, ry = s * dx + c * dy;
      if (Math.abs(rx) >= R || Math.abs(ry) >= R) continue;
      const i = y * P2 + x, cel = Math.floor((ry + R) / 4) * 4 + Math.floor((rx + R) / 4);
      const rel = (((g.ang[i] - dom) % (2 * Math.PI)) + 4 * Math.PI) % (2 * Math.PI);
      desc[cel * 8 + (Math.floor(rel / (Math.PI / 4)) % 8)] += g.mag[i] * peso(dx, dy);
    }
    const norma = (v) => { const n = Math.hypot(...v) || 1; return v.map((t) => t / n); };
    const d = norma(norma(desc).map((t) => Math.min(t, 0.2)));
    return { g, hist, kmax, dom, desc: d };
  }

  function montarDescriptor(cuerpo) {
    let ang = 30, invariante = true;
    const ref = describir(parche(0));
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Rotación del parche', min: 0, max: 360, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'alinear con la orientación dominante', valor: invariante, alCambiar: (v) => { invariante = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(w / 2 - 10, 300)) + 20 });
    const lienzoD = VIZ.lienzo(cuerpo, { proporcion: 0.26, altoMin: 180, altoMax: 240 });
    const tip = VIZ.tooltip(lienzoD);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'gradiente de cada píxel', forma: 'linea' },
      { color: C.s2, texto: 'orientación dominante', forma: 'linea' },
      { color: C.s1, texto: 'descriptor del parche rotado' },
      { color: C.apagado, texto: 'descriptor sin rotar', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gire el parche: la orientación dominante gira con él y, medido desde ella, el descriptor casi no cambia. Desmarque la casilla para medir siempre desde el eje x y vea cómo se desordena.');

    let plano = null, actual = null;
    function dibujar() {
      const th = (ang * Math.PI) / 180, im = parche(th);
      const d = describir(im, invariante ? null : ref.dom);
      actual = d;
      const { ctx, ancho, alto } = lienzo;
      lienzo.limpiar();
      const lado = alto - 20, e = lado / P2;
      I.dibujar(ctx, im, 0, 18, lado, lado);
      I.rotulo(ctx, `parche rotado ${ang}°`, 0, 18);
      ctx.save();
      ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.8);
      ctx.lineWidth = 1;
      const gm = Math.max(...d.g.mag) || 1;
      for (let y = 2; y < P2 - 2; y += 2) for (let x = 2; x < P2 - 2; x += 2) {
        const i = y * P2 + x, l = (d.g.mag[i] / gm) * e * 2.6;
        if (l < 1) continue;
        const X = (x + 0.5) * e, Y = 18 + (y + 0.5) * e;
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(d.g.ang[i]) * l, Y + Math.sin(d.g.ang[i]) * l); ctx.stroke();
      }
      // Rejilla 4×4 del descriptor, girada según la orientación usada.
      const cx = lado / 2, cy = 18 + lado / 2;
      ctx.translate(cx, cy);
      ctx.rotate(d.dom);
      ctx.strokeStyle = VIZ.alfa(C.s2, 0.6);
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(k * 4 * e, -R * e); ctx.lineTo(k * 4 * e, R * e); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-R * e, k * 4 * e); ctx.lineTo(R * e, k * 4 * e); ctx.stroke();
      }
      ctx.strokeStyle = C.s2;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * e * 1.1, 0); ctx.stroke();
      ctx.restore();
      // Histograma de orientaciones en forma de rosa.
      const rx = lado + 24 + (ancho - lado - 24) / 2, ry = 18 + lado / 2, rmax = Math.min((ancho - lado - 24) / 2, lado / 2) - 14;
      I.rotulo(ctx, 'histograma de orientaciones (36 casillas)', lado + 24, 18);
      const hm = Math.max(...d.hist) || 1;
      ctx.save();
      ctx.strokeStyle = C.rejilla;
      ctx.beginPath(); ctx.arc(rx, ry, rmax, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < BINS_O; k++) {
        const a0 = (k / BINS_O) * 2 * Math.PI, a1 = ((k + 1) / BINS_O) * 2 * Math.PI, r = (d.hist[k] / hm) * rmax;
        ctx.fillStyle = k === d.kmax ? C.s2 : C.inactivo;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.arc(rx, ry, r, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      dibujarD();
    }
    lienzo.alDibujar = dibujar;
    const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    function dibujarD() {
      if (!actual) return;
      const { ctx } = lienzoD;
      lienzoD.limpiar();
      plano = VIZ.plano(lienzoD, { xmin: 0, xmax: 128, ymin: 0, ymax: 0.45 }, { etiquetaX: 'componente (celda × 8 orientaciones)', margen: { izq: 40 },
        ticksX: [0, 16, 32, 48, 64, 80, 96, 112, 128] });
      plano.ejes();
      const bw = plano.sx(1) - plano.sx(0);
      actual.desc.forEach((v, i) => {
        ctx.fillStyle = C.s1;
        ctx.fillRect(plano.sx(i) + 0.5, plano.sy(Math.min(v, 0.45)), Math.max(1, bw - 1), plano.y0 - plano.sy(Math.min(v, 0.45)));
      });
      VIZ.trazar(ctx, plano, ref.desc.flatMap((v, i) => [[i, v], [i + 1, v]]), C.apagado, 1.2);
      lectura.set([
        ['orientación dominante', `${((d2g(actual.dom) + 360) % 360).toFixed(0)}°`],
        ['rotación aplicada', `${ang}°`],
        ['distancia al descriptor sin rotar', dist(actual.desc, ref.desc).toFixed(3)],
      ]);
    }
    const d2g = (r) => (r * 180) / Math.PI;
    lienzoD.alDibujar = dibujarD;
    lienzoD.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzoD.posicion(ev);
      if (!plano || !plano.dentro(x, y) || !actual) return tip.ocultar();
      const i = Math.min(127, Math.max(0, Math.floor(plano.ix(x))));
      tip.mostrar(x, y, `celda <b>${Math.floor(i / 8)}</b>, orientación <b>${(i % 8) * 45}°</b>`
        + VIZ.filaTooltip(C.s1, 'rotado', actual.desc[i].toFixed(3)) + VIZ.filaTooltip(C.apagado, 'sin rotar', ref.desc[i].toFixed(3)));
    });
    lienzoD.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('sift', {
    intro: String.raw`
      <p><strong>SIFT</strong> (<em>Scale-Invariant Feature Transform</em>, Lowe, 2004) encuentra en una imagen puntos que se
      pueden volver a encontrar en otra foto del mismo objeto aunque esté más cerca, más lejos, girada o con otra iluminación.
      Tiene dos partes: un <strong>detector</strong>, que decide dónde y a qué escala hay algo distintivo, y un
      <strong>descriptor</strong>, que resume la vecindad de cada punto en un vector de 128 números.</p>
      <p>El detector busca manchas en el <em>espacio de escalas</em>: la imagen suavizada con gaussianas cada vez más anchas.
      El descriptor junta histogramas de direcciones de gradiente medidos desde la orientación propia del punto, lo que lo hace
      invariante a la rotación.</p>`,
    visualizaciones: [
      {
        titulo: 'Espacio de escalas y diferencia de gaussianas',
        descripcion: 'A la derecha, la diferencia de gaussianas en una escala; a la izquierda, los extremos detectados en todas las escalas, con radio proporcional a σ.',
        montar: montarEscalas,
      },
      {
        titulo: 'Orientación dominante y descriptor',
        descripcion: 'El parche se describe con 4 × 4 celdas y 8 direcciones por celda. Gire el parche y compare su descriptor (barras) con el del parche sin rotar (línea).',
        montar: montarDescriptor,
      },
    ],
    teoria: String.raw`
      <h2>Espacio de escalas</h2>
      <p>Sea \(L(x, y, \sigma) = G_\sigma * I\) la imagen suavizada con una gaussiana de desviación \(\sigma\). La
      <strong>diferencia de gaussianas</strong> entre escalas vecinas, separadas por un factor \(k\),</p>
      \[ D(x, y, \sigma) = L(x, y, k\sigma) - L(x, y, \sigma) \approx (k - 1)\,\sigma^2 \nabla^2 G * I, \]
      <p>aproxima el laplaciano normalizado por escala, que responde con fuerza a manchas de radio \(r \approx \sqrt{2}\,\sigma\).
      Lowe usa \(k = 2^{1/s}\) con \(s = 3\) escalas por octava y, al completar una octava, reduce la imagen a la mitad.</p>
      <h2>Detección de puntos</h2>
      <pre><code>para cada octava:
    L₀ … L_{s+2} ← suavizar con σ₀·kⁱ;   Dᵢ ← Lᵢ₊₁ − Lᵢ
    para cada píxel (x, y) y escala interior i:
        si D_i(x, y) es mayor o menor que sus 26 vecinos en 3×3×3:
            refinar la posición con una cuadrática (subpíxel y subescala)
            descartar si |D| &lt; umbral de contraste
            descartar si tr(H)² / det(H) ≥ (r + 1)² / r   (borde)
            asignar orientación y calcular el descriptor</code></pre>
      <p>La prueba de borde usa el hessiano \(H = \begin{pmatrix} D_{xx} &amp; D_{xy} \\ D_{xy} &amp; D_{yy} \end{pmatrix}\): en un borde una
      curvatura es grande y la otra casi nula, así que la razón \(\operatorname{tr}(H)^2/\det(H)\) es grande. Lowe usa \(r = 10\).</p>
      <h2>Orientación y descriptor</h2>
      <ol>
        <li>Se calcula el gradiente \((m, \theta)\) en una vecindad del punto, en la escala \(L\) donde se detectó.</li>
        <li>Un histograma de 36 casillas de \(\theta\), ponderado por \(m\) y una gaussiana, da la <strong>orientación dominante</strong>
        (con más de un pico alto se crea un punto por cada uno).</li>
        <li>Una ventana de \(16 \times 16\) girada según esa orientación se divide en \(4 \times 4\) celdas; cada celda acumula un
        histograma de 8 direcciones relativas: \(4 \cdot 4 \cdot 8 = 128\) componentes.</li>
        <li>El vector se normaliza, se recortan los valores sobre 0,2 (para bajar el peso de gradientes muy fuertes, típicos de
        cambios de iluminación no lineales) y se vuelve a normalizar.</li>
      </ol>
      <p>Lowe reparte cada contribución entre celdas y casillas vecinas por interpolación trilineal, para que el descriptor no
      salte cuando un gradiente cruza un borde de casilla. La figura usa casillas sin interpolar; por eso la distancia no llega
      exactamente a cero.</p>
      <h2>Correspondencias</h2>
      <p>Dos puntos se emparejan si sus descriptores están cerca en distancia euclidiana. Para descartar ambigüedades se usa la
      <strong>prueba de la razón</strong>: se acepta el vecino más cercano solo si \(d_1 / d_2 &lt; 0{,}8\), donde \(d_2\) es la
      distancia al segundo más cercano. Con muchas correspondencias se estima una transformación geométrica con RANSAC, o se
      cuantizan los descriptores en un <a href="tema.html?id=bag-of-words">vocabulario visual</a>.</p>
      <table>
        <tr><th>Invariancia</th><th>Mecanismo</th></tr>
        <tr><td>traslación</td><td>el descriptor se mide relativo al punto</td></tr>
        <tr><td>escala</td><td>extremos en el espacio de escalas, ventana proporcional a \(\sigma\)</td></tr>
        <tr><td>rotación</td><td>direcciones relativas a la orientación dominante</td></tr>
        <tr><td>iluminación</td><td>gradientes (no intensidades), normalización y recorte</td></tr>
      </table>`,
  });
})();
