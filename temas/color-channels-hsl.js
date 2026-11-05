(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  // Conversión sRGB ↔ lineal, luminancia relativa (WCAG) y CIELAB para medir diferencias de color.
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const gam = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const luminancia = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  function lab([r, g, b]) {
    const R = lin(r), G = lin(g), B = lin(b);
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }
  const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  function hsl([h, s, l]) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  }
  const css = (rgb) => VIZ.css(rgb.map((v) => Math.max(0, Math.min(255, v))));

  /* ---------- Fig. 1: tono, saturación, luminancia ---------- */

  function montarHSL(cuerpo) {
    const e = { h: 210, s: 70, l: 50 };
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tono (H)', min: 0, max: 359, valor: e.h, formato: (v) => `${v}°`, alCambiar: (v) => { e.h = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Saturación (S)', min: 0, max: 100, valor: e.s, formato: (v) => `${v} %`, alCambiar: (v) => { e.s = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Luminosidad (L)', min: 5, max: 95, valor: e.l, formato: (v) => `${v} %`, alCambiar: (v) => { e.l = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 290 });
    cuerpo.dataset.sinLeyenda = 'cada franja está rotulada con el atributo que varía';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada franja varía un solo atributo y deja los otros dos fijos. Observe el cuadro de abajo: el mismo color convertido a gris muestra cuánta luminancia tiene realmente.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = 10, w = W - 20, n = 36;
      const franja = (y, tit, f) => { V.rotulo(ctx, tit, x0, y - 8, { tam: 11, peso: 600 }); for (let i = 0; i < n; i++) { ctx.fillStyle = css(hsl(f(i / (n - 1)))); ctx.fillRect(x0 + (w * i) / n, y, w / n + 1, 26); } };
      franja(28, 'Tono: ordena mal, separa categorías', (t) => [t * 359, e.s, e.l]);
      franja(82, 'Saturación: de gris a color puro', (t) => [e.h, t * 100, e.l]);
      franja(136, 'Luminosidad: de oscuro a claro, ordena bien', (t) => [e.h, e.s, 5 + t * 90]);
      const marc = [[e.h / 359, 28], [e.s / 100, 82], [(e.l - 5) / 90, 136]];
      marc.forEach(([t, y]) => { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(x0 + w * t - 2, y - 3, 4, 32); });
      const rgb = hsl([e.h, e.s, e.l]), Y = luminancia(rgb), gris = gam(Y);
      ctx.fillStyle = css(rgb); ctx.fillRect(x0, 190, 90, 80); V.rotulo(ctx, 'color elegido', x0 + 100, 210, { tam: 11, peso: 600 });
      ctx.fillStyle = css([gris, gris, gris]); ctx.fillRect(x0 + 100 + 0, 224, 90, 46); V.rotulo(ctx, 'luminancia equivalente', x0 + 200, 247, { tam: 11, color: C.tinta2 });
      ctx.strokeStyle = C.eje; ctx.strokeRect(x0 + 0.5, 190.5, 90, 80); ctx.strokeRect(x0 + 100.5, 224.5, 90, 46);
      const cw = (1.05) / (Y + 0.05);
      lectura.set([['RGB', rgb.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(', ')], ['luminancia relativa', VIZ.fmt(Y, 3)], ['contraste con blanco', `${VIZ.fmt(cw, 3)} : 1`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: paletas bajo daltonismo y escala de grises ---------- */

  const MAT = {
    deu: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    pro: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    tri: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  function simular(rgb, modo) {
    if (modo === 'normal') return rgb;
    if (modo === 'gris') { const g = gam(luminancia(rgb)); return [g, g, g]; }
    const L = rgb.map(lin), M = MAT[modo];
    return M.map((fila) => gam(Math.max(0, Math.min(1, fila[0] * L[0] + fila[1] * L[1] + fila[2] * L[2]))));
  }

  function montarSimulacion(cuerpo) {
    let modo = 'normal';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Visión', valor: modo, opciones: [['normal', 'normal'], ['deu', 'deuteranopia (sin verde)'], ['pro', 'protanopia (sin rojo)'], ['tri', 'tritanopia (sin azul)'], ['gris', 'escala de grises']], alCambiar: (v) => { modo = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 270 });
    cuerpo.dataset.sinLeyenda = 'cada fila rotula su paleta';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con visión normal ambas paletas categóricas se distinguen. Con deuteranopia o protanopia el arcoíris cae a un ΔE mínimo de 5 a 6,5, mientras que la paleta del sitio conserva 11 a 12; en grises ninguna paleta categórica se salva, y solo la rampa de luminancia conserva su orden. Los rótulos en rojo marcan ΔE menor que 10.');
    const PALETAS = [
      { n: 'categórica del sitio (8 colores)', col: VIZ.series.map(VIZ.rgb) },
      { n: 'arcoíris por tono', col: Array.from({ length: 8 }, (_, i) => hsl([i * 45, 90, 50])) },
      { n: 'rampa secuencial azul', col: [0, 2, 4, 6, 8, 10, 12].map((i) => VIZ.rgb(VIZ.rampa[i])) },
    ];
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const res = [];
      PALETAS.forEach((p, r) => {
        const y = 12 + r * 84, n = p.col.length, w = (W - 20) / n;
        V.rotulo(ctx, p.n, 10, y, { tam: 11, peso: 600 });
        const sim = p.col.map((c) => simular(c, modo));
        p.col.forEach((c, i) => { ctx.fillStyle = css(sim[i]); ctx.fillRect(10 + i * w, y + 12, w - 3, 38); });
        let mn = Infinity; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) mn = Math.min(mn, dE(sim[i], sim[j]));
        const adj = r === 2 ? Math.min(...sim.slice(1).map((c, i) => dE(c, sim[i]))) : mn;
        V.rotulo(ctx, `ΔE mínimo: ${VIZ.fmt(adj, 3)}`, 10, y + 64, { tam: 10, color: adj < 10 ? C.s8 : C.tinta2, peso: adj < 10 ? 700 : 400 });
        res.push(adj);
      });
      lectura.set([['categórica', VIZ.fmt(res[0], 3)], ['arcoíris', VIZ.fmt(res[1], 3)], ['rampa (vecinos)', VIZ.fmt(res[2], 3)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('color-channels-hsl', {
    intro: String.raw`
      <p>El color no es un solo canal sino tres: el <strong>tono</strong> (si es azul, naranjo, verde…), la <strong>saturación</strong> (cuán vivo o apagado) y la <strong>luminancia</strong> (cuán claro u oscuro). Cada uno comunica algo distinto.</p>
      <p>El tono identifica categorías pero no ordena; la luminancia y la saturación sí ordenan, aunque con poca precisión. Escoger mal entre ellos produce gráficos que parecen coloridos y no dicen nada.</p>`,
    visualizaciones: [
      { titulo: 'Tono, saturación y luminosidad', descripcion: 'Mueva cada atributo y compare las franjas; el cuadro gris muestra cuánta luminancia tiene el color elegido.', montar: montarHSL },
      { titulo: 'Paletas bajo daltonismo y en grises', descripcion: 'Aplique tres tipos de daltonismo y la escala de grises a tres paletas y lea la diferencia mínima entre colores.', montar: montarSimulacion },
    ],
    teoria: String.raw`
      <h2>Los tres atributos</h2>
      <table>
        <tr><th>Atributo</th><th>Tipo de información</th><th>Uso</th></tr>
        <tr><td>tono</td><td>identidad</td><td>categorías (pocas: 6 a 8 a lo más)</td></tr>
        <tr><td>luminancia</td><td>magnitud</td><td>valores ordenados, gradientes secuenciales</td></tr>
        <tr><td>saturación</td><td>magnitud (poco precisa)</td><td>énfasis, rampas de pocos pasos</td></tr>
      </table>
      <h2>Luminancia relativa y contraste</h2>
      <p>Para un color sRGB con componentes lineales \(R, G, B\), la luminancia relativa es
      \[ Y = 0{,}2126\,R + 0{,}7152\,G + 0{,}0722\,B, \]
      y el contraste entre dos luminancias es \(\dfrac{Y_1 + 0{,}05}{Y_2 + 0{,}05}\). El verde pesa mucho más que el azul: dos colores con igual «luminosidad» HSL pueden diferir mucho en luminancia real. Por eso HSL sirve para elegir, pero la luminancia se mide aparte.</p>
      <h2>Diferencia de color</h2>
      <p>Dos colores se distinguen bien si su distancia en el espacio CIELAB \(\Delta E = \sqrt{(\Delta L^*)^2 + (\Delta a^*)^2 + (\Delta b^*)^2}\) es grande (por encima de unas 10 unidades para marcas pequeñas).</p>
      <h2>Daltonismo</h2>
      <p>Cerca de un 8 % de los hombres tiene alguna deficiencia en la visión del color. Un rojo y un verde de igual luminancia son indistinguibles para ellos. Reglas: no codifique información <em>solo</em> con rojo contra verde, agregue una codificación redundante (forma, etiqueta directa) y verifique el diseño en grises.</p>
      <div class="recuadro"><strong>Nunca un arcoíris</strong> para magnitudes: su luminancia sube y baja sin orden y crea bordes falsos donde los datos no cambian.</div>
      <p>Ver también <a href="tema.html?id=perceptual-accuracy">precisión perceptual</a>.</p>`,
  });
})();
