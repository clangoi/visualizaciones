(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  // Tres grupos de puntos en el plano; cada «vista» es el punto con un poco de ruido.
  const CENTROS = [[-0.6, -0.45], [0.55, -0.4], [0.05, 0.65]], COL = [C.s1, C.s2, C.s3];
  function datos(n, semilla) { const r = VIZ.semilla(semilla * 7 + 1); return Array.from({ length: n }, (_, i) => { const g = i % 3; return { g, x: CENTROS[g][0] + 0.2 * VIZ.normal(r), y: CENTROS[g][1] + 0.2 * VIZ.normal(r) }; }); }

  // Un paso de InfoNCE simétrico. Devuelve la pérdida; actualiza la red con optimizador `opt`.
  function paso(red, opt, lote, tau, rnd, sigma) {
    const A = [], B = [];
    lote.forEach((p) => { A.push([p.x + sigma * VIZ.normal(rnd), p.y + sigma * VIZ.normal(rnd)]); B.push([p.x + sigma * VIZ.normal(rnd), p.y + sigma * VIZ.normal(rnd)]); });
    const za = A.map((x) => DL.adelante(red, x).y), zb = B.map((x) => DL.adelante(red, x).y), n = lote.length;
    const nor = (z) => z.map((v) => v / (Math.hypot(...z) || 1)), ua = za.map(nor), ub = zb.map(nor);
    const S = ua.map((a) => ub.map((b) => (a[0] * b[0] + a[1] * b[1]) / tau));
    const sm = (f) => { const m = Math.max(...f), e = f.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
    const Pr = S.map(sm), Pc = S[0].map((_, j) => sm(S.map((f) => f[j])));
    let L = 0; for (let i = 0; i < n; i++) L -= (Math.log(Pr[i][i] + 1e-12) + Math.log(Pc[i][i] + 1e-12)) / (2 * n);
    const dS = Pr.map((f, i) => f.map((p, j) => (p - (i === j ? 1 : 0) + Pc[j][i] - (i === j ? 1 : 0)) / (2 * n)));
    const dua = ua.map((_, i) => [0, 1].map((k) => ub.reduce((s, b, j) => s + dS[i][j] * b[k], 0) / tau));
    const dub = ub.map((_, j) => [0, 1].map((k) => ua.reduce((s, a, i) => s + dS[i][j] * a[k], 0) / tau));
    const dz = (z, u, du) => { const nz = Math.hypot(...z) || 1, dot = u[0] * du[0] + u[1] * du[1]; return [(du[0] - dot * u[0]) / nz, (du[1] - dot * u[1]) / nz]; };
    const lot = [];
    A.forEach((x, i) => { const g = dz(za[i], ua[i], dua[i]); lot.push({ x, y: [za[i][0] - g[0] * 2 * n, za[i][1] - g[1] * 2 * n] }); });
    B.forEach((x, i) => { const g = dz(zb[i], ub[i], dub[i]); lot.push({ x, y: [zb[i][0] - g[0] * 2 * n, zb[i][1] - g[1] * 2 * n] }); });
    DL.entrenarPaso(red, lot, opt);
    return L;
  }
  const angulo = (red, p) => { const z = DL.adelante(red, [p.x, p.y]).y; return Math.atan2(z[1], z[0]); };

  /* ---------- Fig. 1: acercar los positivos y alejar los negativos ---------- */

  function montarEntrenar(cuerpo) {
    let tau = 0.3, sigma = 0.15, semilla = 1, red = null, opt = null, pts = [], ep = 0, perd = NaN, hist = [], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Temperatura τ', min: 0.05, max: 1, paso: 0.05, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Fuerza de la aumentación σ', min: 0.02, max: 0.4, paso: 0.01, valor: sigma, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { sigma = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4, velMax: 8 });
    ctl.boton('Otra semilla', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w > 640 ? 340 : 600) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...COL.map((c, i) => ({ color: c, texto: `grupo ${i + 1} (la red no lo conoce)`, forma: 'punto' })), { color: C.tinta, texto: 'círculo unitario de las representaciones', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Izquierda: los datos. Derecha: dónde cae cada punto en el círculo tras pasar por la red (2 → 16 → 2, normalizada). Nunca se usan los colores: solo se pide que dos vistas ruidosas del mismo punto queden cerca y que se alejen de las vistas de los demás. Los grupos aparecen solos.');
    function iniciar() {
      pts = datos(90, semilla); red = DL.red([2, 16, 2], { act: 'tanh', salida: 'lineal', semilla: semilla * 3 + 2 }); opt = DL.optimizador('adam', { lr: 0.01 }); ep = 0; perd = NaN; hist = [];
      const r = VIZ.semilla(semilla * 11);
      return (function* () { while (ep < 300) { for (let k = 0; k < 3; k++) { const L = DL.mezclar(pts.slice(), r).slice(0, 48); perd = paso(red, opt, L, tau, r, sigma); ep++; hist.push(perd); } yield; } })();
    }
    function dibujar() {
      if (!red) return;
      const { ctx, ancho: W, alto: H } = lienzo, ancha = W > 640, S = ancha ? Math.min(H - 20, W / 2 - 16) : Math.min(W - 16, 270);
      lienzo.limpiar();
      const X1 = 8, Y1 = 14, X2 = ancha ? W / 2 + 8 : 8, Y2 = ancha ? 14 : S + 50;
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('Datos de entrada', X1, Y1 - 2); ctx.fillText('Representaciones (ángulo en el círculo)', X2, Y2 - 2);
      ctx.strokeStyle = C.rejilla; ctx.strokeRect(X1 + 0.5, Y1 + 0.5, S, S);
      pts.forEach((p) => VIZ.marcador(ctx, X1 + ((p.x + 1.1) / 2.2) * S, Y1 + S - ((p.y + 1.1) / 2.2) * S, COL[p.g], 4, p.g));
      const cx = X2 + S / 2, cy = Y2 + S / 2, R = S / 2 - 12;
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      pts.forEach((p) => { const a = angulo(red, p); VIZ.marcador(ctx, cx + R * Math.cos(a), cy - R * Math.sin(a), COL[p.g], 4, p.g); });
      geo = { X1, Y1, S, cx, cy, R };
      // Medidas: concentración de cada grupo y separación.
      const ang = pts.map((p) => angulo(red, p)), med = [0, 1, 2].map((g) => { const a = ang.filter((_, i) => pts[i].g === g), s = a.reduce((t, v) => t + Math.sin(v), 0) / a.length, c = a.reduce((t, v) => t + Math.cos(v), 0) / a.length; return { r: Math.hypot(s, c), a: Math.atan2(s, c) }; });
      const dif = (u, v) => Math.abs(Math.atan2(Math.sin(u - v), Math.cos(u - v)));
      const sep = (dif(med[0].a, med[1].a) + dif(med[1].a, med[2].a) + dif(med[0].a, med[2].a)) / 3;
      registro.textContent = ep ? `Paso ${ep}: pérdida InfoNCE ${VIZ.fmt(perd, 3)}. Cada grupo se concentra (concentración ${med.map((m) => VIZ.fmt(m.r, 2)).join(' / ')}, 1 = todos en el mismo ángulo) y los grupos quedan separados ${VIZ.fmt((sep * 180) / Math.PI, 3)}° en promedio.` : 'Red sin entrenar: los puntos se reparten sin relación con los grupos.';
      lectura.set([['paso', String(ep)], ['pérdida InfoNCE', ep ? VIZ.fmt(perd, 3) : '—'], ['concentración de cada grupo', med.map((m) => VIZ.fmt(m.r, 2)).join(' · ')], ['separación media entre grupos', `${VIZ.fmt((sep * 180) / Math.PI, 3)}°`], ['pérdida de un modelo al azar', VIZ.fmt(Math.log(48), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !red) return tip.ocultar();
      const j = pts.findIndex((p) => Math.hypot(geo.X1 + ((p.x + 1.1) / 2.2) * geo.S - x, geo.Y1 + geo.S - ((p.y + 1.1) / 2.2) * geo.S - y) < 8);
      if (j >= 0) tip.mostrar(x, y, `punto (${VIZ.fmt(pts[j].x, 2)}, ${VIZ.fmt(pts[j].y, 2)})<br>ángulo en el círculo: <b>${VIZ.fmt((angulo(red, pts[j]) * 180) / Math.PI, 3)}°</b>`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la matriz de similitudes y la pérdida ---------- */

  function montarMatriz(cuerpo) {
    let tau = 0.5, n = 6, semilla = 1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Temperatura τ', min: 0.05, max: 2, paso: 0.05, valor: tau, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { tau = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ejemplos en el lote', min: 3, max: 10, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.boton('Otros vectores', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(46, (w - 130) / 10) * 8 + 90) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'pareja positiva (diagonal)', forma: 'cuadro' }, { color: C.s1, texto: 'peso softmax de cada pareja', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Fila i: cuánto se parece la vista A del ejemplo i a la vista B de cada ejemplo del lote (coseno / τ, luego softmax). La pérdida de la fila es −log(peso de la diagonal): baja si la pareja correcta recibe casi toda la masa. Con τ pequeña el softmax es muy exigente; con τ grande, todas las parejas parecen igual de buenas.');
    function dibujar() {
      const r = VIZ.semilla(semilla * 5 + 3), ua = [], ub = [];
      for (let i = 0; i < n; i++) { const a = r() * 2 * Math.PI, b = a + 0.45 * VIZ.normal(r); ua.push([Math.cos(a), Math.sin(a)]); ub.push([Math.cos(b), Math.sin(b)]); }
      const S = ua.map((a) => ub.map((b) => a[0] * b[0] + a[1] * b[1])), P = S.map((f) => { const m = Math.max(...f.map((v) => v / tau)), e = f.map((v) => Math.exp(v / tau - m)), z = e.reduce((s, v) => s + v, 0); return e.map((v) => v / z); });
      const L = -P.reduce((s, f, i) => s + Math.log(f[i] + 1e-12), 0) / n, acc = P.filter((f, i) => f.indexOf(Math.max(...f)) === i).length / n;
      const { ctx, ancho: W } = lienzo, c = Math.min(46, (W - 130) / 10), x0 = 100, y0 = 40;
      lienzo.limpiar();
      ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; for (let j = 0; j < n; j++) ctx.fillText(`B${j + 1}`, x0 + (j + 0.5) * c, y0 - 4);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; for (let i = 0; i < n; i++) ctx.fillText(`A${i + 1}`, x0 - 6, y0 + (i + 0.5) * c);
      DL.mapa(ctx, P, x0, y0, n * c, n * c, { min: 0, max: 1, valores: (v) => VIZ.fmt(v, 2) });
      ctx.strokeStyle = C.s6; ctx.lineWidth = 2.5; for (let i = 0; i < n; i++) ctx.strokeRect(x0 + i * c + 1, y0 + i * c + 1, c - 2, c - 2);
      geo = { x0, y0, c, S, P };
      registro.textContent = `Pérdida InfoNCE media ${VIZ.fmt(L, 3)} (un modelo al azar daría ${VIZ.fmt(Math.log(n), 3)}). La pareja correcta es la más parecida en ${Math.round(acc * n)} de ${n} filas.`;
      lectura.set([['pérdida', VIZ.fmt(L, 3)], ['al azar', VIZ.fmt(Math.log(n), 3)], ['aciertos de la pareja', `${Math.round(acc * n)} de ${n}`], ['peso medio de la diagonal', VIZ.fmt(P.reduce((s, f, i) => s + f[i], 0) / n, 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); if (!geo) return; const j = Math.floor((x - geo.x0) / geo.c), i = Math.floor((y - geo.y0) / geo.c); if (i >= 0 && i < n && j >= 0 && j < n) tip.mostrar(x, y, `A${i + 1} con B${j + 1}${i === j ? ' (positiva)' : ' (negativa)'}<br>coseno <b>${VIZ.fmt(geo.S[i][j], 3)}</b><br>peso <b>${VIZ.fmt(geo.P[i][j], 3)}</b>`); else tip.ocultar(); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('contrastive-learning', {
    intro: String.raw`
      <p>El <strong>aprendizaje contrastivo</strong> aprende representaciones sin etiquetas de clase: solo se necesita saber qué pares de datos «van juntos». Dos vistas del mismo ejemplo (una imagen recortada y girada de dos maneras, una frase y su traducción, una foto y su descripción) forman un <strong>par positivo</strong>; el resto de ejemplos del lote son <strong>negativos</strong>.</p>
      <p>La pérdida acerca los positivos y aleja los negativos en el espacio de representaciones. Para lograrlo, la red tiene que descartar lo que cambia entre vistas (ruido, recorte) y conservar lo que se mantiene (el contenido), y de paso agrupa lo parecido.</p>`,
    visualizaciones: [
      { titulo: 'Entrenar con pares positivos y negativos', descripcion: 'Entrene y observe cómo los tres grupos, que la red nunca vio etiquetados, se separan en el círculo. Pruebe con una aumentación pequeña y con una grande.', montar: montarEntrenar },
      { titulo: 'La matriz de similitudes y la pérdida', descripcion: 'Cambie la temperatura y el tamaño del lote y mire cómo se reparte el softmax entre la pareja correcta y las demás.', montar: montarMatriz },
    ],
    teoria: String.raw`
      <h2>Pérdida InfoNCE</h2>
      <p>Con un lote de \(N\) ejemplos, dos vistas \(x_i,x_i'\) de cada uno, un codificador \(f\) y \(u_i=f(x_i)/\lVert f(x_i)\rVert\), \(u_i'=f(x_i')/\lVert f(x_i')\rVert\):</p>
      \[ \ell_i = -\log\frac{\exp\!\big(u_i^\top u_i'/\tau\big)}{\sum_{j=1}^{N}\exp\!\big(u_i^\top u_j'/\tau\big)}, \qquad \mathcal{L}=\frac1N\sum_{i=1}^{N}\ell_i. \]
      <p>Es una entropía cruzada: identificar, entre \(N\) candidatos, cuál es el par verdadero. Con representaciones al azar, \(\mathcal{L}=\log N\). La pérdida acota por abajo la información mutua entre las dos vistas: \(I(x;x')\ge\log N-\mathcal{L}\), de ahí el nombre (<em>noise-contrastive estimation</em>).</p>
      <h2>Alineamiento y uniformidad</h2>
      <p>Wang e Isola descomponen el objetivo en dos propiedades: los positivos deben estar <em>alineados</em> (cerca) y las representaciones deben distribuirse <em>uniformemente</em> sobre la esfera (no colapsar a un solo punto). Los negativos son los que evitan el colapso.</p>
      <h2>Temperatura y negativos</h2>
      <ul>
        <li>\(\tau\) pequeña: la pérdida se concentra en los negativos más difíciles (los más parecidos).</li>
        <li>\(\tau\) grande: todos los negativos pesan igual, y la señal es más débil.</li>
        <li>Más negativos (lotes grandes, bancos de memoria) dan mejores representaciones.</li>
      </ul>
      <h2>Usos</h2>
      <p>SimCLR y MoCo (imágenes), CLIP (imagen y texto), embeddings de oraciones. Una vez aprendida la representación, se usa para clasificar con pocas etiquetas, buscar por similitud (<a href="tema.html?id=embedding-similarity">Embedding Similarity</a>) o como backbone para <a href="tema.html?id=transfer-learning">transferir</a>.</p>
      <div class="recuadro"><p>El truco de implementación de la figura: el gradiente de la pérdida respecto de cada representación se calcula a mano, y se retropropaga a través de la red con la maquinaria de siempre (<a href="tema.html?id=backpropagation">Backpropagation</a>).</p></div>`,
  });
})();
