(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const FUNCIONES = [['sigmoide', C.s1], ['tanh', C.s2], ['relu', C.s6], ['lrelu', C.s7]];

  /* ---------- Fig. 1: las funciones y sus derivadas ---------- */

  function montarCurvas(cuerpo) {
    let activas = { sigmoide: true, tanh: true, relu: true, lrelu: false }, hover = null, pl = [null, null];
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas(FUNCIONES.map(([k, c]) => ({ clave: k, texto: DL.ACT[k].nombre, color: c, activo: activas[k] })), (e) => { activas = e; dibujar(); });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const lf = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 240, altoMax: 340 });
    const ld = VIZ.lienzo(cols, { proporcion: 0.85, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lf), tip2 = VIZ.tooltip(ld);
    VIZ.leyenda(cuerpo, [...FUNCIONES.map(([k, c]) => ({ color: c, texto: DL.ACT[k].nombre, forma: 'linea' })), { color: C.s8, texto: 'zona saturada de Sigmoid (f′ menor que 0,05)', forma: 'cuadro' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'A la izquierda, f(z); a la derecha, su derivada f′(z), que es lo que multiplica al gradiente en la retropropagación. Pase el cursor para leer valores exactos.');
    const XS = Array.from({ length: 241 }, (_, i) => -6 + i * 0.05);
    function panel(l, derivada) {
      const { ctx } = l;
      l.limpiar();
      const p = VIZ.plano(l, derivada ? { xmin: -6, xmax: 6, ymin: -0.05, ymax: 1.15 } : { xmin: -6, xmax: 6, ymin: -1.3, ymax: 2.2 }, { etiquetaX: 'z', etiquetaY: derivada ? "f′(z)" : 'f(z)' });
      p.ejes();
      if (derivada) { // zona donde la derivada de la sigmoide es menor que 0,05
        ctx.fillStyle = VIZ.alfa(C.s8, 0.07);
        for (const [a, b] of [[-6, -2.95], [2.95, 6]]) ctx.fillRect(p.sx(a), p.y1, p.sx(b) - p.sx(a), p.y0 - p.y1);
      }
      ctx.save(); p.recortar();
      for (const [k, c] of FUNCIONES) if (activas[k]) VIZ.trazar(ctx, p, XS.map((z) => [z, derivada ? DL.ACT[k].d(z) : DL.ACT[k].f(z)]), c, 2);
      if (hover != null) for (const [k, c] of FUNCIONES) if (activas[k]) VIZ.marcador(ctx, p.sx(hover), p.sy(derivada ? DL.ACT[k].d(hover) : DL.ACT[k].f(hover)), c, 4);
      ctx.restore();
      return p;
    }
    function dibujar() {
      pl = [panel(lf, false), panel(ld, true)];
      const z = hover ?? 2;
      lectura.set(FUNCIONES.filter(([k]) => activas[k]).map(([k]) => [`${DL.ACT[k].nombre} en z = ${VIZ.fmt(z, 2)}`, `f = ${VIZ.fmt(DL.ACT[k].f(z), 3)} · f′ = ${VIZ.fmt(DL.ACT[k].d(z), 3)}`]));
    }
    lf.alDibujar = dibujar; ld.alDibujar = dibujar;
    for (const [l, t, i] of [[lf, tip, 0], [ld, tip2, 1]]) {
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = l.posicion(ev);
        if (!pl[i] || !pl[i].dentro(x, y)) { hover = null; t.ocultar(); return dibujar(); }
        hover = Math.round(pl[i].ix(x) * 20) / 20;
        dibujar();
        t.mostrar(x, y, `z = <b>${VIZ.fmt(hover, 2)}</b>` + FUNCIONES.filter(([k]) => activas[k]).map(([k, c]) => VIZ.filaTooltip(c, DL.ACT[k].nombre, VIZ.fmt(i ? DL.ACT[k].d(hover) : DL.ACT[k].f(hover), 3))).join(''));
      });
      l.canvas.addEventListener('pointerleave', () => { hover = null; t.ocultar(); dibujar(); });
    }
    dibujar();
  }

  /* ---------- Fig. 2: el gradiente a través de varias capas ---------- */

  function montarGradiente(cuerpo) {
    let act = 'sigmoide', L = 8, w = 1, x0 = 0.5, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Activación', opciones: FUNCIONES.map(([k]) => [k, DL.ACT[k].nombre]), valor: act, alCambiar: (v) => { act = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Capas', min: 2, max: 20, valor: L, alCambiar: (v) => { L = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Peso w de cada capa', min: 0.3, max: 4, paso: 0.1, valor: w, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { w = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Entrada x', min: -3, max: 3, paso: 0.1, valor: x0, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { x0 = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: '|gradiente| en la capa (relativo a la última)', forma: 'cuadro' }, { color: C.s8, texto: 'menor que 10⁻³: casi no aprende', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una cadena de capas con una neurona cada una: a_ℓ = f(w·a_{ℓ−1}). El gradiente que llega a la capa ℓ es el producto de los factores w·f′(z) de todas las capas posteriores.');
    let datos = [];
    function calcular() {
      const A = DL.ACT[act]; let a = x0; const f = [];
      for (let l = 1; l <= L; l++) { const z = w * a; f.push(w * A.d(z)); a = A.f(z); }
      // Gradiente relativo en la capa l: producto de factores de l+1 … L (el de la última capa es 1).
      datos = Array.from({ length: L }, (_, i) => f.slice(i + 1).reduce((s, v) => s * v, 1));
    }
    function dibujar() {
      calcular();
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mn = 1e-8, mx = 1e4;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: L, ymin: mn, ymax: mx }, { logY: true, etiquetaX: 'capa (1 = más cercana a la entrada)', etiquetaY: '|gradiente|', ticksX: Array.from({ length: L }, (_, i) => i + 0.5), formatoX: (v) => String(Math.round(v + 0.5)), formatoY: (v) => `10^${Math.round(Math.log10(v))}` });
      pl.ejes();
      const bw = (pl.x1 - pl.x0) / L;
      datos.forEach((v, i) => {
        const val = Math.max(Math.abs(v), mn), y = pl.sy(val), base = pl.sy(1);
        ctx.fillStyle = Math.abs(v) < 1e-3 ? C.s8 : C.s1;
        ctx.beginPath();
        ctx.roundRect(pl.x0 + i * bw + 2, Math.min(y, base), bw - 4, Math.max(2, Math.abs(base - y)), 3);
        ctx.fill();
        if (i === hover) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
      });
      ctx.strokeStyle = C.apagado; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(1)); ctx.lineTo(pl.x1, pl.sy(1)); ctx.stroke(); ctx.setLineDash([]);
      const primero = Math.abs(datos[0]);
      registro.textContent = primero < 1e-3 ? `La capa 1 recibe un gradiente ${VIZ.fmt(primero, 2)} veces el de la última: el gradiente se desvanece.` : primero > 1e3 ? `La capa 1 recibe un gradiente ${VIZ.fmt(primero, 2)} veces el de la última: el gradiente explota.` : `La capa 1 recibe ${VIZ.fmt(primero, 2)} veces el gradiente de la última: se conserva razonablemente.`;
      lectura.set([['gradiente en la capa 1', VIZ.fmt(primero, 3)], ['factor máximo por capa', VIZ.fmt(w * Math.max(...XS().map((z) => DL.ACT[act].d(z))), 3)], ['capas', String(L)]]);
    }
    const XS = () => Array.from({ length: 121 }, (_, i) => -6 + i * 0.1);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return; }
      hover = Math.min(L - 1, Math.floor((x - pl.x0) / ((pl.x1 - pl.x0) / L)));
      tip.mostrar(x, y, `capa <b>${hover + 1}</b><br>|gradiente| = <b>${VIZ.fmt(Math.abs(datos[hover]), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); });
    dibujar();
  }

  VIZ.registrarTema('activation-functions', {
    intro: String.raw`
      <p>Sin <strong>función de activación</strong>, una red de cien capas sería equivalente a una sola capa lineal. Es la activación la que introduce la no linealidad que permite representar curvas y fronteras complicadas.</p>
      <p>Las tres clásicas son <em>Sigmoid</em> (comprime a \((0,1)\)), <em>Tanh</em> (comprime a \((-1,1)\)) y <em>ReLU</em> (deja pasar lo positivo y apaga lo negativo). Su forma importa también para el entrenamiento: la <strong>derivada</strong> dice cuánto de la señal de error
      atraviesa la neurona, y en las colas de la sigmoide y la tanh es casi cero: la neurona está <em>saturada</em>.</p>`,
    visualizaciones: [
      { titulo: 'Funciones y derivadas', descripcion: 'Compare las formas y fíjese en dónde se aplanan las derivadas. Active Leaky ReLU para ver cómo evita la zona de derivada cero.', montar: montarCurvas },
      { titulo: 'Gradientes desvanecientes', descripcion: 'Con Sigmoid y \\(w = 1\\), el gradiente se reduce a una fracción diminuta en pocas capas. Cambie a ReLU, o suba \\(w\\) con Sigmoid, y observe la diferencia.', montar: montarGradiente },
    ],
    teoria: String.raw`
      <h2>Las funciones</h2>
      <table>
        <tr><th>Nombre</th><th>\(f(z)\)</th><th>\(f'(z)\)</th><th>Rango</th><th>Derivada máxima</th></tr>
        <tr><td>Sigmoid</td><td>\(\dfrac{1}{1+e^{-z}}\)</td><td>\(f(1-f)\)</td><td>\((0,1)\)</td><td>\(1/4\) en \(z=0\)</td></tr>
        <tr><td>Tanh</td><td>\(\dfrac{e^z-e^{-z}}{e^z+e^{-z}}\)</td><td>\(1-f^2\)</td><td>\((-1,1)\)</td><td>\(1\) en \(z=0\)</td></tr>
        <tr><td>ReLU</td><td>\(\max(0,z)\)</td><td>\(\mathbb{1}[z>0]\)</td><td>\([0,\infty)\)</td><td>\(1\)</td></tr>
        <tr><td>Leaky ReLU</td><td>\(\max(\alpha z, z)\)</td><td>\(1\) o \(\alpha\)</td><td>\(\mathbb{R}\)</td><td>\(1\)</td></tr>
      </table>
      <p>Tanh es una sigmoide reescalada y centrada en cero: \(\tanh z = 2\sigma(2z) - 1\).</p>
      <h2>Saturación y gradientes desvanecientes</h2>
      <p>Una neurona está <em>saturada</em> cuando \(|f'(z)|\approx 0\). Por la regla de la cadena, el gradiente de la pérdida respecto de la capa \(\ell\) en una red de \(L\) capas es</p>
      \[ \frac{\partial \mathcal{L}}{\partial z_\ell} = \frac{\partial \mathcal{L}}{\partial z_L}\prod_{k=\ell+1}^{L} w_k\, f'(z_{k-1}). \]
      <p>Con sigmoide, cada factor es a lo más \(|w|/4\). Si \(|w| < 4\), el producto decrece como \((|w|/4)^{L-\ell}\): <em>gradientes desvanecientes</em>. Si los factores superan 1, el producto crece sin control: <em>gradientes explosivos</em>.</p>
      <div class="recuadro"><p>ReLU tiene derivada exactamente 1 donde está activa, así que el producto no se encoge en la parte activa. Su riesgo es la «neurona muerta»: si \(z<0\) para todos los datos, el gradiente es 0 y no se recupera; Leaky ReLU lo evita.</p></div>
      <h2>Representación de funciones no lineales</h2>
      <p>Una red con una capa oculta y activación no polinómica puede aproximar cualquier función continua en un conjunto compacto (<em>teorema de aproximación universal</em>). Véalo en
      <a href="tema.html?id=nonlinear-representation">Nonlinear Representation</a>; el cálculo del gradiente, en <a href="tema.html?id=backpropagation">Backpropagation</a>.</p>`,
  });
})();
