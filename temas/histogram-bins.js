(function () {
  'use strict';
  const { color: C } = VIZ;
  const V = VIZ.vis;

  function generar(tipo, n, semilla) {
    const r = VIZ.semilla(semilla * 97 + 3), N = () => VIZ.normal(r);
    return Array.from({ length: n }, (_, i) => {
      if (tipo === 'normal') return 50 + 12 * N();
      if (tipo === 'bimodal') return i % 2 ? 35 + 7 * N() : 68 + 7 * N();
      return 20 + Math.exp(2.2 + 0.6 * N()) * 2.2;
    });
  }
  const cuantil = (a, q) => { const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, i = Math.floor(p); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); };
  const desv = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

  /* ---------- Fig. 1: cuántos intervalos ---------- */

  function montarHistograma(cuerpo) {
    const e = { tipo: 'bimodal', n: 200, regla: 'manual', k: 12, semilla: 1 };
    let datos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Distribución', valor: e.tipo, opciones: [['normal', 'normal'], ['bimodal', 'bimodal (dos grupos)'], ['asim', 'asimétrica a la derecha']], alCambiar: (v) => { e.tipo = v; generarD(); dibujar(); } });
    ctl.rango({ etiqueta: 'Observaciones n', min: 30, max: 800, paso: 10, valor: e.n, alCambiar: (v) => { e.n = v; generarD(); dibujar(); } });
    ctl.selector({ etiqueta: 'Regla para los intervalos', valor: e.regla, opciones: [['manual', 'manual (control inferior)'], ['sturges', 'Sturges'], ['scott', 'Scott'], ['fd', 'Freedman–Diaconis']], alCambiar: (v) => { e.regla = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Intervalos (modo manual)', min: 2, max: 60, valor: e.k, alCambiar: (v) => { e.k = v; if (e.regla === 'manual') dibujar(); } });
    ctl.boton('Nueva muestra', () => { e.semilla++; generarD(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    cuerpo.dataset.sinLeyenda = 'serie única: cada barra es un intervalo y su altura el conteo';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con la distribución bimodal, pocos intervalos fusionan los dos grupos; demasiados vuelven el gráfico ruidoso. Compare las tres reglas y pase el cursor sobre una barra.');
    function generarD() { datos = generar(e.tipo, e.n, e.semilla); }
    let barras = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mn = Math.min(...datos), mx = Math.max(...datos), n = datos.length;
      let k = e.k;
      if (e.regla === 'sturges') k = Math.ceil(Math.log2(n)) + 1;
      else if (e.regla === 'scott') k = Math.ceil((mx - mn) / (3.49 * desv(datos) * Math.pow(n, -1 / 3)));
      else if (e.regla === 'fd') k = Math.ceil((mx - mn) / (2 * (cuantil(datos, 0.75) - cuantil(datos, 0.25)) * Math.pow(n, -1 / 3)));
      k = Math.max(2, Math.min(80, k));
      const h = (mx - mn) / k, cuentas = new Array(k).fill(0);
      for (const d of datos) cuentas[Math.min(k - 1, Math.floor((d - mn) / h))]++;
      const plano = VIZ.plano(lienzo, { xmin: mn, xmax: mx, ymin: 0, ymax: Math.max(...cuentas) * 1.12 }, { etiquetaX: 'valor', etiquetaY: 'frecuencia' });
      plano.ejes();
      barras = [];
      cuentas.forEach((c, i) => { const x0 = plano.sx(mn + i * h), x1 = plano.sx(mn + (i + 1) * h), y = plano.sy(c); ctx.fillStyle = C.s1; ctx.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), plano.y0 - y); barras.push({ x: x0, y, w: x1 - x0, h: plano.y0 - y, i, c, a: mn + i * h, b: mn + (i + 1) * h }); });
      lectura.set([['intervalos k', String(k)], ['ancho del intervalo', VIZ.fmt(h, 3)], ['regla', { manual: 'manual', sturges: 'k = ⌈log₂ n⌉ + 1', scott: 'h = 3,49 σ n^(−1/3)', fd: 'h = 2 RIC n^(−1/3)' }[e.regla]], ['modas visibles', String(cuentas.filter((c, i) => c > 0 && c >= (cuentas[i - 1] || 0) && c >= (cuentas[i + 1] || 0) && c > Math.max(...cuentas) * 0.5).length)]]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = V.bajo(barras, x, y); if (!b) return tip.ocultar(); tip.mostrar(x, y, `[${VIZ.fmt(b.a, 3)}, ${VIZ.fmt(b.b, 3)})<br>frecuencia <b>${b.c}</b>`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generarD(); dibujar();
  }

  /* ---------- Fig. 2: densidad con núcleo ---------- */

  function montarDensidad(cuerpo) {
    let bw = 6;
    const datos = generar('bimodal', 120, 4);
    const ctl = VIZ.controles(cuerpo);
    const sl = ctl.rango({ etiqueta: 'Ancho de banda h', min: 1, max: 20, paso: 0.5, valor: bw, alCambiar: (v) => { bw = v; dibujar(); } });
    ctl.boton('Regla de Silverman', () => { bw = Math.min(20, Math.max(1, Math.round(1.06 * desv(datos) * Math.pow(datos.length, -0.2) * 2) / 2)); sl.valor = bw; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 330 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'densidad estimada', forma: 'linea' }, { color: C.tinta2, texto: 'cada observación (alfombra)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La curva es la suma de campanas gaussianas, una por observación. Con h pequeño sigue el ruido; con h grande oculta los dos grupos. La regla de Silverman propone un valor intermedio.');
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mn = Math.min(...datos) - 10, mx = Math.max(...datos) + 10;
      const f = (x) => datos.reduce((s, d) => s + Math.exp(-0.5 * ((x - d) / bw) ** 2), 0) / (datos.length * bw * Math.sqrt(2 * Math.PI));
      const pts = Array.from({ length: 200 }, (_, i) => { const x = mn + ((mx - mn) * i) / 199; return [x, f(x)]; });
      const ymax = Math.max(...pts.map((p) => p[1])) * 1.15;
      const plano = VIZ.plano(lienzo, { xmin: mn, xmax: mx, ymin: 0, ymax }, { etiquetaX: 'valor', etiquetaY: 'densidad', formatoY: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y)))); ctx.lineTo(plano.sx(mx), plano.y0); ctx.lineTo(plano.sx(mn), plano.y0); ctx.closePath(); ctx.fillStyle = VIZ.alfa(C.s2, 0.15); ctx.fill();
      VIZ.trazar(ctx, plano, pts, C.s2, 2.5);
      ctx.strokeStyle = VIZ.alfa(C.tinta2, 0.5); ctx.lineWidth = 1; datos.forEach((d) => { ctx.beginPath(); ctx.moveTo(plano.sx(d) + 0.5, plano.y0); ctx.lineTo(plano.sx(d) + 0.5, plano.y0 - 9); ctx.stroke(); });
      let picos = 0; for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] > pts[i - 1][1] && pts[i][1] >= pts[i + 1][1] && pts[i][1] > ymax * 0.15) picos++;
      lectura.set([['ancho de banda h', VIZ.fmt(bw, 3)], ['modas detectadas', String(picos)], ['Silverman', VIZ.fmt(1.06 * desv(datos) * Math.pow(datos.length, -0.2), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('histogram-bins', {
    intro: String.raw`
      <p>Un <strong>histograma</strong> responde a la pregunta «¿cómo se reparten los valores?». Divide el rango en intervalos iguales y dibuja la cantidad de observaciones que cae en cada uno. Parece un gráfico de barras, pero no lo es: el eje horizontal es continuo y las barras se tocan.</p>
      <p>Su única decisión de diseño —cuántos intervalos— cambia la historia: con pocos se pierde la forma; con demasiados, solo se ve ruido.</p>`,
    visualizaciones: [
      { titulo: 'El número de intervalos', descripcion: 'Cambie la distribución, el tamaño de la muestra y la regla para elegir intervalos; con la bimodal busque cuándo los dos grupos se funden.', montar: montarHistograma },
      { titulo: 'Densidad con núcleo gaussiano', descripcion: 'Varíe el ancho de banda y compare con la regla de Silverman; la curva reemplaza los intervalos por una suma de campanas.', montar: montarDensidad },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Dado un rango \([a, b]\) y \(k\) intervalos de ancho \(h = (b-a)/k\), la frecuencia del intervalo \(j\) es \(c_j = |\{ x_i : a + (j-1)h \le x_i < a + jh \}|\) y la estimación de densidad
      \[ \hat f(x) = \frac{c_j}{n\,h} \quad \text{si } x \text{ está en el intervalo } j. \]
      El área total es 1, por lo que se pueden comparar histogramas de muestras de distinto tamaño.</p>
      <h2>Reglas para elegir \(k\)</h2>
      <table>
        <tr><th>Regla</th><th>Fórmula</th><th>Supuesto</th></tr>
        <tr><td>Sturges</td><td>\(k = \lceil \log_2 n \rceil + 1\)</td><td>casi normal; \(n\) moderado</td></tr>
        <tr><td>Scott</td><td>\(h = 3{,}49\,\hat\sigma\,n^{-1/3}\)</td><td>casi normal</td></tr>
        <tr><td>Freedman–Diaconis</td><td>\(h = 2\,\text{RIC}\,n^{-1/3}\)</td><td>robusta a atípicos</td></tr>
      </table>
      <h2>Núcleo gaussiano</h2>
      <p>La densidad con núcleo suaviza cada observación con una campana de ancho \(h\):
      \[ \hat f_h(x) = \frac{1}{n h}\sum_{i=1}^{n} \varphi\!\left(\frac{x - x_i}{h}\right), \qquad \varphi(u) = \frac{e^{-u^2/2}}{\sqrt{2\pi}}. \]
      La regla de Silverman toma \(h \approx 1{,}06\,\hat\sigma\,n^{-1/5}\). Compromiso <em>sesgo–varianza</em>: \(h\) pequeño reduce el sesgo pero aumenta el ruido; \(h\) grande hace lo contrario.</p>
      <div class="recuadro"><strong>Recomendación.</strong> Pruebe varios anchos. Si una conclusión (por ejemplo, «hay dos grupos») aparece solo con un valor de \(h\), desconfíe de ella.</div>
      <p>Compare con el gráfico de barras y otros en <a href="tema.html?id=chart-selection">selección de gráficos</a>.</p>`,
  });
})();
