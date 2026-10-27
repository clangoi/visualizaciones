(function () {
  'use strict';
  const { color: C } = VIZ;
  const I = VIZ.img;
  const N = 48;

  const TEXTURAS = [['rayas', 'Rayas'], ['puntos', 'Puntos'], ['tablero', 'Tablero'], ['granulado', 'Granulado']];
  // Textura procedural rotada en `ang` radianes, con ruido gaussiano σ.
  function textura(tipo, ang, ruido, semilla) {
    const rnd = VIZ.semilla(semilla), im = I.crear(N, N);
    const ondas = Array.from({ length: 7 }, () => ({ a: rnd() * Math.PI, f: 0.5 + rnd() * 0.5, p: rnd() * 6.28 }));
    const c = Math.cos(ang), s = Math.sin(ang);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = c * (x - N / 2) + s * (y - N / 2), v = -s * (x - N / 2) + c * (y - N / 2);
      let val;
      if (tipo === 'rayas') val = 0.5 + 0.45 * Math.sin((2 * Math.PI * u) / 7);
      else if (tipo === 'puntos') {
        const a = ((u % 8) + 8) % 8 - 4, b = ((v % 8) + 8) % 8 - 4;
        val = 0.2 + 0.7 * Math.exp(-(a * a + b * b) / 3);
      } else if (tipo === 'tablero') val = 0.5 + 0.45 * Math.tanh(4 * Math.sin((Math.PI * u) / 5) * Math.sin((Math.PI * v) / 5));
      else val = 0.5 + ondas.reduce((t, o) => t + 0.12 * Math.sin(o.f * (Math.cos(o.a) * u + Math.sin(o.a) * v) + o.p), 0);
      im.d[y * N + x] = Math.min(1, Math.max(0, val + VIZ.normal(rnd) * ruido));
    }
    return im;
  }

  // Vecinos en orden antihorario desde la derecha: p = 0 … 7.
  const VEC = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
  function codigo(im, x, y) {
    const c = I.en(im, x, y);
    let k = 0;
    const bits = VEC.map(([dx, dy], p) => { const b = I.en(im, x + dx, y + dy) >= c ? 1 : 0; k += b << p; return b; });
    let U = 0;
    for (let p = 0; p < 8; p++) if (bits[p] !== bits[(p + 1) % 8]) U++;
    const unos = bits.reduce((a, b) => a + b, 0);
    return { k, bits, U, riu2: U <= 2 ? unos : 9 };
  }
  function histograma(im, tipo) {
    const B = tipo === 'riu2' ? 10 : 256, h = new Array(B).fill(0);
    let n = 0;
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const r = codigo(im, x, y); h[tipo === 'riu2' ? r.riu2 : r.k]++; n++; }
    return h.map((v) => v / n);
  }
  const chi2 = (a, b) => a.reduce((s, v, i) => s + (v + b[i] > 0 ? ((v - b[i]) ** 2) / (v + b[i]) : 0), 0);

  /* ---------- Fig. 1: el código de un píxel ---------- */

  function montarCodigo(cuerpo) {
    let tipo = 'rayas', ruido = 0.02, px = 22, py = 19;
    let im = null, lbp = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Textura', opciones: TEXTURAS, valor: tipo, alCambiar: (v) => { tipo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.15, paso: 0.01, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => I.paneles({ ancho: w }, 3, 1).alturaTotal });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'píxel central g_c' },
      { color: C.s1, texto: 'vecino ≥ g_c → bit 1' },
      { color: C.inactivo, texto: 'vecino < g_c → bit 0' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o pase el cursor por la textura o la imagen LBP para elegir el píxel. En la imagen LBP, el gris es el código: 0 negro, 255 blanco.');

    function calcular() {
      im = textura(tipo, 0.3, ruido, 5);
      lbp = I.crear(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) lbp.d[y * N + x] = codigo(im, x, y).k / 255;
      dibujar();
    }
    let geo = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const P = I.paneles(lienzo, 3, 1), a = P.pos(0), b = P.pos(1), c = P.pos(2);
      geo = { P, a, b };
      for (const [img, q, t] of [[im, a, 'textura'], [lbp, b, 'imagen LBP (código de cada píxel)']]) {
        I.dibujar(ctx, img, q.x, q.y, P.ancho, P.alto);
        I.rotulo(ctx, t, q.x, q.y);
        const e = P.ancho / N;
        ctx.save();
        ctx.strokeStyle = C.s2;
        ctx.lineWidth = 2;
        ctx.strokeRect(q.x + (px - 1) * e, q.y + (py - 1) * e, 3 * e, 3 * e);
        ctx.restore();
      }
      // Vecindario ampliado.
      const r = codigo(im, px, py), gc = I.en(im, px, py);
      const lado = Math.min(P.ancho, P.alto) * 0.62, e = lado / 3, x0 = c.x + (P.ancho - lado) / 2, y0 = c.y + 4;
      I.rotulo(ctx, `vecindario 3×3 de (${px}, ${py})`, c.x, c.y);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const v = I.en(im, px + i, py + j), X = x0 + (i + 1) * e, Y = y0 + (j + 1) * e;
        const g = Math.round(v * 255);
        ctx.fillStyle = VIZ.css([g, g, g]);
        ctx.fillRect(X, Y, e - 3, e - 3);
        const p = VEC.findIndex(([dx, dy]) => dx === i && dy === j);
        ctx.lineWidth = 3;
        ctx.strokeStyle = p < 0 ? C.s2 : r.bits[p] ? C.s1 : C.inactivo;
        ctx.strokeRect(X + 1.5, Y + 1.5, e - 6, e - 6);
        ctx.fillStyle = v > 0.55 ? C.tinta : C.sobre;
        ctx.font = VIZ.fuente(Math.max(10, e * 0.2), 500);
        ctx.fillText(v.toFixed(2), X + e / 2 - 1.5, Y + e / 2 - (p < 0 ? 1.5 : 8));
        if (p >= 0) {
          ctx.font = VIZ.fuente(Math.max(9, e * 0.16));
          ctx.fillText(`bit ${p}: ${r.bits[p]}`, X + e / 2 - 1.5, Y + e / 2 + 10);
        }
      }
      ctx.restore();
      // Código binario debajo.
      ctx.save();
      ctx.font = VIZ.fuente(12);
      ctx.fillStyle = C.tinta;
      ctx.textAlign = 'center';
      const yb = y0 + lado + 22;
      ctx.fillText(`${[...r.bits].reverse().join('')}₂ = ${r.k}`, c.x + P.ancho / 2, yb);
      ctx.fillStyle = C.tinta2;
      ctx.font = VIZ.fuente(11);
      ctx.fillText(`U = ${r.U} → ${r.U <= 2 ? `uniforme, ${r.riu2} unos` : 'no uniforme (9)'}`, c.x + P.ancho / 2, yb + 18);
      ctx.restore();
      registro.textContent = `g_c = ${gc.toFixed(3)}. Bits en orden p = 7…0: ${[...r.bits].reverse().join(' ')}. Código LBP = Σ s(g_p − g_c)·2^p = ${r.k}.`;
      lectura.set([
        ['código', String(r.k)],
        ['transiciones U', String(r.U)],
        ['clase riu2', String(r.riu2)],
        ['códigos distintos en la imagen', String(new Set(Array.from(lbp.d, (v) => Math.round(v * 255))).size)],
      ]);
    }
    lienzo.alDibujar = () => im && dibujar();
    const elegir = (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), { P } = geo;
      for (const q of [geo.a, geo.b]) {
        const i = Math.floor(((x - q.x) / P.ancho) * N), j = Math.floor(((y - q.y) / P.alto) * N);
        if (i >= 0 && j >= 0 && i < N && j < N && (i !== px || j !== py)) { px = i; py = j; dibujar(); }
      }
    };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', elegir);
    lienzo.canvas.addEventListener('click', elegir);
    calcular();
  }

  /* ---------- Fig. 2: histogramas y clasificación de texturas ---------- */

  function montarClasificar(cuerpo) {
    let clase = 'rayas', ang = 40, ruido = 0.04, desc = 'riu2', semilla = 9;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Muestra de prueba', opciones: TEXTURAS, valor: clase, alCambiar: (v) => { clase = v; calcular(); } });
    ctl.rango({ etiqueta: 'Rotación de la muestra', min: 0, max: 90, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido σ', min: 0, max: 0.2, paso: 0.01, valor: ruido, formato: (v) => v.toFixed(2), alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.selector({ etiqueta: 'Descriptor', opciones: [['riu2', 'LBP uniforme invariante a rotación (10)'], ['256', 'LBP básico (256 códigos)']], valor: desc,
      alCambiar: (v) => { desc = v; calcular(); } });
    ctl.boton('Otra muestra', () => { semilla++; calcular(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(w / 5) + 22 });
    const lienzoH = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 220, altoMax: 300 });
    const tip = VIZ.tooltip(lienzoH);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'histograma de la muestra' },
      { color: C.s1, texto: 'histograma de la referencia más cercana' },
      { color: C.s6, texto: 'clase asignada' },
      { color: C.s8, texto: 'error de clasificación' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las referencias son las cuatro texturas sin rotar. Rote la muestra de rayas con el LBP básico: el histograma cambia y la clase puede fallar; con el descriptor invariante casi no cambia.');

    let refs = [], q = null, hq = [], dist = [], gana = 0, plano = null;
    function calcular() {
      refs = TEXTURAS.map(([t]) => { const im = textura(t, 0, 0.02, 3); return { t, im, h: histograma(im, desc) }; });
      q = textura(clase, (ang * Math.PI) / 180, ruido, semilla);
      hq = histograma(q, desc);
      dist = refs.map((r) => chi2(hq, r.h));
      gana = dist.indexOf(Math.min(...dist));
      lienzo.redibujar();
      dibujarH();
    }
    lienzo.alDibujar = () => {
      if (!q) return;
      const { ctx, ancho } = lienzo;
      lienzo.limpiar();
      const sep = 10, l = (ancho - 4 * sep) / 5;
      refs.forEach((r, k) => {
        const x = k * (l + sep);
        I.dibujar(ctx, r.im, x, 18, l, l);
        I.rotulo(ctx, `${TEXTURAS[k][1]}  χ² ${dist[k].toFixed(2)}`, x, 18);
        if (k === gana) {
          ctx.save(); ctx.strokeStyle = r.t === clase ? C.s6 : C.s8; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, 19.5, l - 3, l - 3); ctx.restore();
        }
      });
      const x = 4 * (l + sep);
      I.dibujar(ctx, q, x, 18, l, l);
      I.rotulo(ctx, `muestra (${ang}°)`, x, 18);
    };
    function dibujarH() {
      const { ctx } = lienzoH;
      lienzoH.limpiar();
      const B = hq.length, ref = refs[gana].h;
      const ymax = Math.max(...hq, ...ref) * 1.1 || 1;
      plano = VIZ.plano(lienzoH, { xmin: -0.5, xmax: B - 0.5, ymin: 0, ymax }, {
        etiquetaX: desc === 'riu2' ? 'clase riu2 (0–8 uniformes, 9 resto)' : 'código LBP', etiquetaY: 'fracción de píxeles', margen: { izq: 46 },
        formatoX: (v) => String(Math.round(v)),
      });
      plano.ejes();
      const bw = plano.sx(1) - plano.sx(0);
      for (let i = 0; i < B; i++) {
        for (const [h, col, off] of [[ref, C.s1, 0], [hq, C.s2, 1]]) {
          if (!h[i]) continue;
          const x = plano.sx(i - 0.5) + (B > 20 ? 0 : 2 + off * (bw - 4) / 2), w = B > 20 ? Math.max(1, bw) : (bw - 4) / 2 - 1;
          ctx.fillStyle = B > 20 ? VIZ.alfa(col, 0.75) : col;
          ctx.beginPath();
          ctx.roundRect(x, plano.sy(h[i]), w, plano.y0 - plano.sy(h[i]), B > 20 ? 0 : [3, 3, 0, 0]);
          ctx.fill();
        }
      }
      lectura.set([
        ['clase asignada', TEXTURAS[gana][1]],
        ['clase real', TEXTURAS.find((t) => t[0] === clase)[1]],
        ['χ² a la correcta', dist[TEXTURAS.findIndex((t) => t[0] === clase)].toFixed(3)],
        ['χ² mínima', dist[gana].toFixed(3)],
      ]);
    }
    lienzoH.alDibujar = () => q && dibujarH();
    lienzoH.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzoH.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const i = Math.round(plano.ix(x));
      if (i < 0 || i >= hq.length) return tip.ocultar();
      tip.mostrar(x, y, `${desc === 'riu2' ? 'clase' : 'código'} <b>${i}</b>` + VIZ.filaTooltip(C.s2, 'muestra', VIZ.fmt(hq[i], 3))
        + VIZ.filaTooltip(C.s1, TEXTURAS[gana][1], VIZ.fmt(refs[gana].h[i], 3)));
    });
    lienzoH.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('lbp', {
    intro: String.raw`
      <p>Una <strong>textura</strong> no se reconoce por el valor de un píxel sino por cómo se relaciona con sus vecinos. Los
      <strong>patrones binarios locales</strong> (LBP, Ojala, Pietikäinen y Mäenpää, 2002) resumen esa relación en un número de
      8 bits: cada vecino aporta un 1 si es al menos tan claro como el centro, y un 0 si no.</p>
      <p>El histograma de esos códigos sobre una región es un descriptor de textura simple, rápido y robusto a cambios de
      iluminación: sumar una constante o multiplicar la imagen por un factor positivo no cambia ninguna comparación.</p>`,
    visualizaciones: [
      {
        titulo: 'El código de un píxel',
        descripcion: 'El vecindario 3×3 del píxel elegido, umbralizado por su valor central. Recorra las rayas: los códigos se repiten con la misma periodicidad que la textura.',
        montar: montarCodigo,
      },
      {
        titulo: 'Clasificar texturas por su histograma',
        descripcion: 'La muestra se asigna a la referencia con menor distancia χ² entre histogramas. Compare el descriptor básico con el invariante a la rotación.',
        montar: montarClasificar,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Para un píxel central de intensidad \(g_c\) y sus \(P\) vecinos \(g_0, \dots, g_{P-1}\) sobre un círculo de radio \(R\):</p>
      \[ \mathrm{LBP}_{P,R} = \sum_{p=0}^{P-1} s(g_p - g_c)\, 2^p, \qquad s(x) = \begin{cases} 1 &amp; x \ge 0 \\ 0 &amp; x &lt; 0. \end{cases} \]
      <p>Con \(P = 8\) y \(R = 1\) hay \(2^8 = 256\) códigos. Como solo importan los signos de las diferencias, el código es
      invariante a cualquier transformación monótona creciente de la intensidad.</p>
      <h2>Patrones uniformes e invariancia a la rotación</h2>
      <p>Sea \(U\) el número de transiciones 0/1 al recorrer los bits en círculo. Los patrones con \(U \le 2\) se llaman
      <em>uniformes</em>: corresponden a bordes, esquinas, puntos y zonas planas, y en imágenes naturales suman cerca del 90&nbsp;%
      de los códigos. Rotar la imagen rota los bits del código. El descriptor invariante a la rotación
      cuenta los unos de los patrones uniformes y junta todos los demás en una sola clase:</p>
      \[ \mathrm{LBP}^{riu2}_{P,R} = \begin{cases} \sum_p s(g_p - g_c) &amp; \text{si } U \le 2 \\ P + 1 &amp; \text{si no,} \end{cases} \]
      <p>con \(P + 2 = 10\) valores posibles para \(P = 8\). Hay versiones intermedias: los 58 patrones uniformes por separado más
      uno para el resto (59 casillas) son invariantes a la iluminación pero no a la rotación.</p>
      <h2>Descriptor y clasificación</h2>
      <pre><code>para cada píxel interior (x, y):
    k ← Σ_p s(I(vecino_p) − I(x, y)) · 2^p
    h[k] ← h[k] + 1
normalizar h para que sume 1
clase ← argmin_c χ²(h, h_c)</code></pre>
      <p>La distancia chi-cuadrado compara histogramas dando más peso a las casillas poco pobladas:</p>
      \[ \chi^2(h, h') = \sum_i \frac{(h_i - h'_i)^2}{h_i + h'_i}. \]
      <p>En la práctica la imagen se divide en celdas (por ejemplo, \(4 \times 4\)), se calcula un histograma por celda y se
      concatenan: así el descriptor guarda también dónde está cada textura, como en el reconocimiento de rostros de Ahonen et al.
      El vector resultante se usa luego con <a href="tema.html?id=knn">k vecinos</a>, una <a href="tema.html?id=svm">SVM</a> o pasa
      antes por <a href="tema.html?id=sfs">selección de características</a>.</p>
      <h2>Costo</h2>
      <p>\(P\) comparaciones por píxel: \(O(NP)\) para \(N\) píxeles, sin multiplicaciones. Por eso LBP se usa en sistemas de
      tiempo real y en hardware simple.</p>`,
  });
})();
