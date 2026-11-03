(function () {
  'use strict';
  const { color: C, fmt } = VIZ;
  const O = VIZ.opt;

  /* ---------- Utilidades de la figura ---------- */

  // Arrastre de asas sobre un lienzo. asas() → [[px, py], …]; mover(i, x, y) en píxeles.
  function interaccion(lienzo, { asas, mover, hover, salir, unico = false }) {
    const cv = lienzo.canvas;
    let arr = -1;
    const cerca = (x, y) => {
      let m = -1, d = 16;
      (asas ? asas() : []).forEach(([px, py], i) => { const q = Math.hypot(px - x, py - y); if (q < d) { d = q; m = i; } });
      return m;
    };
    cv.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = unico ? 0 : cerca(x, y);
      if (i < 0) return;
      arr = i;
      cv.setPointerCapture(ev.pointerId);
      mover(i, x, y);
    });
    cv.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arr >= 0) return mover(arr, x, y);
      cv.style.cursor = unico || cerca(x, y) >= 0 ? 'grab' : 'default';
      if (hover) hover(x, y);
    });
    const fin = () => { arr = -1; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (arr < 0 && salir) salir(); });
  }

  // Dibuja el polígono con relleno y borde.
  function trazarPoligono(ctx, plano, poli, relleno, borde, ancho = 2) {
    if (!poli.length) return;
    ctx.save();
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = ancho; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
  }

  // Recta a·x = b, extendida por todo el plano.
  function trazarRecta(ctx, plano, { a, b }, color, ancho = 1.5, guiones = [5, 4]) {
    const n2 = a[0] * a[0] + a[1] * a[1];
    if (!n2) return;
    const p0 = [(b * a[0]) / n2, (b * a[1]) / n2], d = [-a[1] / Math.sqrt(n2), a[0] / Math.sqrt(n2)];
    ctx.save();
    plano.recortar();
    ctx.strokeStyle = color;
    ctx.lineWidth = ancho;
    ctx.setLineDash(guiones);
    ctx.beginPath();
    ctx.moveTo(plano.sx(p0[0] - 100 * d[0]), plano.sy(p0[1] - 100 * d[1]));
    ctx.lineTo(plano.sx(p0[0] + 100 * d[0]), plano.sy(p0[1] + 100 * d[1]));
    ctx.stroke();
    ctx.restore();
  }

  // Etiqueta junto al lado del polígono que descansa sobre la restricción.
  function etiquetaLado(ctx, plano, poli, r, texto, color) {
    const sobre = poli.filter((v) => Math.abs(r.a[0] * v[0] + r.a[1] * v[1] - r.b) < 1e-6);
    if (sobre.length < 2) return;
    let u = sobre[0], w = sobre[0], mx = -1;
    for (const p of sobre) for (const q of sobre) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > mx) { mx = d; u = p; w = q; } }
    const nl = Math.hypot(r.a[0], r.a[1]);
    // Desplazamiento de 12 px en la dirección de la normal exterior (en píxeles el eje y se invierte).
    const px = plano.sx((u[0] + w[0]) / 2) + (12 * r.a[0]) / nl, py = plano.sy((u[1] + w[1]) / 2) - (12 * r.a[1]) / nl;
    ctx.save();
    ctx.font = VIZ.fuente(11, 600);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, px, py);
    ctx.restore();
  }

  // Extremos de f sobre una región {A x ≤ b} por rejilla fina más los vértices.
  function extremos(f, poli, paso = 0.02) {
    let mn = { v: Infinity, x: null }, mx = { v: -Infinity, x: null };
    const probar = (x, y) => { const v = f(x, y); if (v < mn.v) mn = { v, x: [x, y] }; if (v > mx.v) mx = { v, x: [x, y] }; };
    poli.forEach(([x, y]) => probar(x, y));
    const xs = poli.map((p) => p[0]), ys = poli.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const dentro = (x, y) => {
      for (let i = 0; i < poli.length; i++) {
        const p = poli[i], q = poli[(i + 1) % poli.length];
        if ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) < -1e-9) return false;
      }
      return true;
    };
    const area = poli.length > 2;
    if (area) for (let x = x0; x <= x1 + 1e-9; x += paso) for (let y = y0; y <= y1 + 1e-9; y += paso) if (dentro(x, y)) probar(x, y);
    return { mn, mx };
  }

  /* ---------- Modelo común de las dos primeras figuras ---------- */

  // x₁, x₂ ≥ 0 y cuatro restricciones; cada una como a·x ≤ b.
  const RESTR = [
    { a: [1, 1], b: 8, txt: 'x₁ + x₂ ≤ 8', corto: 'R1' },
    { a: [1, 0], b: 6, txt: 'x₁ ≤ 6', corto: 'R2' },
    { a: [0, 1], b: 5, txt: 'x₂ ≤ 5', corto: 'R3' },
    { a: [-1, 1], b: 3, txt: '−x₁ + x₂ ≤ 3', corto: 'R4' },
    { a: [-1, 0], b: 0, txt: 'x₁ ≥ 0', corto: 'x₁ ≥ 0' },
    { a: [0, -1], b: 0, txt: 'x₂ ≥ 0', corto: 'x₂ ≥ 0' },
  ];
  const POLI = O.poligono(RESTR).map((p) => p.map((v) => Math.round(v * 1e9) / 1e9));
  const DOM = { xmin: -1, xmax: 9, ymin: -1, ymax: 8 };
  const factible = (x, y, tol = 1e-9) => RESTR.every((r) => r.a[0] * x + r.a[1] * y <= r.b + tol);

  /* ---------- Fig. 1: arrastrar una solución ---------- */

  function montarPunto(cuerpo) {
    let c1 = 3, c2 = 2, sentido = 'max', P = [2, 2], plano = null, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Coeficiente c₁', min: -5, max: 5, paso: 0.5, valor: c1, alCambiar: (v) => { c1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Coeficiente c₂', min: -5, max: 5, paso: 0.5, valor: c2, alCambiar: (v) => { c2 = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Sentido', opciones: [['max', 'maximizar'], ['min', 'minimizar']], valor: sentido, alCambiar: (v) => { sentido = v; dibujar(); } });
    ctl.boton('Ir al óptimo', () => { P = mejor().x.slice(); dibujar(); }, { primario: true });
    ctl.boton('Punto al azar', () => {
      const r = VIZ.semilla(semilla++ * 97);
      P = [DOM.xmin + r() * (DOM.xmax - DOM.xmin), DOM.ymin + r() * (DOM.ymax - DOM.ymin)];
      dibujar();
    });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 290, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.22), borde: C.s1, texto: 'región factible' },
      { color: C.s6, texto: 'su solución (factible)', forma: 'punto' },
      { color: C.s8, texto: 'su solución (infactible)', forma: 'punto' },
      { color: C.s2, texto: 'curva de nivel de su solución', forma: 'linea' },
      { color: C.tinta, texto: 'óptimo', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.nota(cuerpo, 'Arrastre el punto (o haga clic en cualquier lugar del plano para llevarlo allí). Cambie los coeficientes y el sentido para mover la curva de nivel y el óptimo.');

    const signo = () => (sentido === 'max' ? 1 : -1);
    const f = (x, y) => c1 * x + c2 * y;
    function mejor() {
      const r = O.optimo2d(POLI, [signo() * c1, signo() * c2]);
      return { x: r.x, v: signo() * r.z };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const opt = mejor(), fp = f(P[0], P[1]), ok = factible(P[0], P[1]);
      trazarPoligono(ctx, plano, POLI, VIZ.alfa(C.s1, 0.2), C.s1, 2);
      RESTR.forEach((r) => { trazarRecta(ctx, plano, r, C.eje, 1, [3, 4]); etiquetaLado(ctx, plano, POLI, r, r.corto, C.tinta2); });
      // Curvas de nivel: la de la solución actual resaltada, el resto tenues.
      if (c1 || c2) {
        const sub = Math.max(Math.abs(c1), Math.abs(c2)) * 2;
        for (let k = -8; k <= 8; k++) VIZ.ml.contorno(ctx, plano, f, fp + k * sub, { color: C.tenue, ancho: 1 });
        VIZ.ml.contorno(ctx, plano, f, fp, { color: C.s2, ancho: 2 });
      }
      ctx.save();
      VIZ.marcador(ctx, plano.sx(opt.x[0]), plano.sy(opt.x[1]), C.tinta, 6, 6);
      ctx.font = VIZ.fuente(11, 600);
      ctx.fillStyle = C.tinta;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('óptimo', plano.sx(opt.x[0]) + 9, plano.sy(opt.x[1]) - 6);
      ctx.restore();
      VIZ.marcador(ctx, plano.sx(P[0]), plano.sy(P[1]), ok ? C.s6 : C.s8, 7);

      const viol = RESTR.filter((r) => r.a[0] * P[0] + r.a[1] * P[1] > r.b + 1e-9);
      const brecha = ok ? Math.abs(opt.v - fp) : NaN;
      registro.textContent = ok
        ? `(${fmt(P[0], 3)}, ${fmt(P[1], 3)}) cumple las 6 restricciones: es una solución factible con f = ${fmt(fp)}. `
          + (brecha < 1e-6 ? 'Es el óptimo: ninguna otra solución factible lo mejora.' : `El óptimo vale ${fmt(opt.v)}; faltan ${fmt(brecha)} para alcanzarlo.`)
        : `(${fmt(P[0], 3)}, ${fmt(P[1], 3)}) viola ${viol.map((r) => r.txt).join(' y ')}: no es una solución factible, aunque f = ${fmt(fp)} se pueda calcular.`;
      lectura.set([
        ['punto x', `(${fmt(P[0], 3)}, ${fmt(P[1], 3)})`],
        ['f(x)', fmt(fp)],
        ['factible', ok ? 'sí' : `no (${viol.length})`],
        ['óptimo f*', fmt(opt.v)],
        ['en x*', `(${fmt(opt.x[0], 3)}, ${fmt(opt.x[1], 3)})`],
        ['brecha', ok ? fmt(brecha) : '—'],
      ]);
      caja.innerHTML = '<table class="tabla-datos sin-corte"><tr><th class="izq">restricción</th><th>lado izq.</th><th>cota</th><th>holgura</th><th>estado</th></tr>'
        + RESTR.map((r) => {
          const l = r.a[0] * P[0] + r.a[1] * P[1], h = r.b - l, mal = h < -1e-9;
          return `<tr><td class="izq">${r.txt}</td><td>${fmt(l, 3)}</td><td>${fmt(r.b)}</td><td>${fmt(h, 3)}</td>`
            + `<td style="color:${mal ? C.s8 : h < 1e-9 ? C.s2 : C.s6}">${mal ? 'viola' : h < 1e-9 ? 'activa' : 'cumple'}</td></tr>`;
        }).join('') + '</table>';
    }
    lienzo.alDibujar = dibujar;

    const aPunto = (x, y) => [Math.round(plano.ix(x) * 100) / 100, Math.round(plano.iy(y) * 100) / 100];
    const info = (x, y) => {
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const [u, v] = aPunto(x, y);
      tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>f = <b>${fmt(f(u, v))}</b><br>${factible(u, v) ? 'factible' : 'infactible'}`);
    };
    interaccion(lienzo, {
      asas: () => (plano ? [[plano.sx(P[0]), plano.sy(P[1])]] : []),
      unico: true,
      mover: (i, x, y) => {
        P = aPunto(Math.min(plano.x1, Math.max(plano.x0, x)), Math.min(plano.y0, Math.max(plano.y1, y)));
        dibujar();
        info(x, y);
      },
      hover: info,
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Fig. 2: minimizar y maximizar ---------- */

  const OBJETIVOS = {
    lineal: { nombre: 'f = 3x₁ + 2x₂ (lineal)', f: (x, y) => 3 * x + 2 * y },
    distancia: { nombre: 'f = (x₁ − 4)² + (x₂ − 2)² (distancia al punto (4, 2))', f: (x, y) => (x - 4) ** 2 + (y - 2) ** 2 },
    producto: { nombre: 'f = x₁ · x₂ (producto)', f: (x, y) => x * y },
  };

  function montarSentido(cuerpo) {
    let clave = 'lineal', t = 0.5, equiv = false, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función objetivo', opciones: Object.entries(OBJETIVOS).map(([k, o]) => [k, o.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const sNivel = ctl.rango({ etiqueta: 'Nivel de la curva (de mín. a máx.)', min: 0, max: 1, paso: 0.01, valor: t, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { t = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Ver el problema equivalente: maximizar −f', valor: equiv, alCambiar: (v) => { equiv = v; dibujar(); } });
    ctl.boton('Nivel en el mínimo', () => { sNivel.valor = 0; t = 0; dibujar(); });
    ctl.boton('Nivel en el máximo', () => { sNivel.valor = 1; t = 1; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 290, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.22), borde: C.s1, texto: 'región factible' },
      { color: C.s2, texto: 'curva de nivel (parte factible)', forma: 'linea' },
      { color: C.s1, texto: 'mínimo de f', forma: 'punto' },
      { color: C.s7, texto: 'máximo de f', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el nivel de 0 a 100 %: la curva roza la región por primera vez en el mínimo y la abandona en el máximo. Pase el cursor por el plano para leer f.');

    const cache = {};
    const datos = () => (cache[clave] ||= extremos(OBJETIVOS[clave].f, POLI));

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const { f } = OBJETIVOS[clave], { mn, mx } = datos();
      const sg = equiv ? -1 : 1, g = (x, y) => sg * f(x, y);
      const nivel = mn.v + t * (mx.v - mn.v);
      trazarPoligono(ctx, plano, POLI, VIZ.alfa(C.s1, 0.2), null);
      // Curvas de nivel de fondo.
      for (let k = 1; k <= 9; k++) VIZ.ml.contorno(ctx, plano, g, sg * (mn.v + (k / 10) * (mx.v - mn.v)), { color: C.tenue, ancho: 1 });
      // Curva actual: tenue fuera de la región, resaltada dentro.
      VIZ.ml.contorno(ctx, plano, g, sg * nivel, { color: C.eje, ancho: 1.5, guiones: [4, 4] });
      ctx.save();
      ctx.beginPath();
      POLI.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
      ctx.closePath();
      ctx.clip();
      VIZ.ml.contorno(ctx, plano, g, sg * nivel, { color: C.s2, ancho: 3.5 });
      ctx.restore();
      trazarPoligono(ctx, plano, POLI, null, C.s1, 2);
      const marca = (p, color, forma, texto) => {
        VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), color, 6.5, forma);
        ctx.save();
        ctx.font = VIZ.fuente(11, 600);
        ctx.fillStyle = C.tinta;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(texto, plano.sx(p[0]) + 9, plano.sy(p[1]) - 6);
        ctx.restore();
      };
      marca(mn.x, C.s1, 0, equiv ? 'máx −f' : 'mín f');
      marca(mx.x, C.s7, 1, equiv ? 'mín −f' : 'máx f');
      const dentro = Math.abs(f(...mn.x) - nivel) < 1e-9 || (t > 0 && t < 1);
      registro.textContent = `La curva f = ${fmt(nivel)} ${dentro ? 'atraviesa' : 'solo roza'} la región. `
        + `Minimizar f equivale a maximizar −f: mín f = ${fmt(mn.v)} = −(máx −f) = −(${fmt(-mn.v)}). El punto óptimo es el mismo en ambos problemas.`;
      lectura.set([
        ['mín f', fmt(mn.v)],
        ['en', `(${fmt(mn.x[0], 3)}, ${fmt(mn.x[1], 3)})`],
        ['máx f', fmt(mx.v)],
        ['en', `(${fmt(mx.x[0], 3)}, ${fmt(mx.x[1], 3)})`],
        ['máx (−f)', fmt(-mn.v)],
        ['mín (−f)', fmt(-mx.v)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), v = plano.iy(y), fv = OBJETIVOS[clave].f(u, v);
      tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>f = <b>${fmt(fv)}</b><br>${factible(u, v) ? 'factible' : 'infactible'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: restricciones que vuelven el modelo infactible ---------- */

  const POR_DEFECTO = { W: 12, L: 15, D: 4 };

  function montarInfactible(cuerpo) {
    const est = { ...POR_DEFECTO };
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    const sW = ctl.rango({ etiqueta: 'Madera disponible W', min: 2, max: 24, paso: 0.5, valor: est.W, alCambiar: (v) => { est.W = v; dibujar(); } });
    const sL = ctl.rango({ etiqueta: 'Horas de trabajo L', min: 3, max: 24, paso: 0.5, valor: est.L, alCambiar: (v) => { est.L = v; dibujar(); } });
    const sD = ctl.rango({ etiqueta: 'Pedido mínimo D', min: 0, max: 14, paso: 0.1, valor: est.D, alCambiar: (v) => { est.D = v; dibujar(); } });
    ctl.boton('Relajar el pedido hasta hacerlo posible', () => {
      const m = mejorPedido();
      if (m == null) return;
      est.D = Math.floor(m * 10 + 1e-6) / 10; sD.valor = est.D; dibujar();
    }, { primario: true });
    ctl.boton('Valores iniciales', () => { Object.assign(est, POR_DEFECTO); sW.valor = est.W; sL.valor = est.L; sD.valor = est.D; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.9, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.5), texto: 'excluido por la madera' },
      { color: VIZ.alfa(C.s3, 0.5), texto: 'excluido por las horas' },
      { color: VIZ.alfa(C.s2, 0.5), texto: 'excluido por el pedido' },
      { color: VIZ.alfa(C.s6, 0.35), borde: C.s6, texto: 'región factible' },
      { color: C.tinta, texto: 'óptimo', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Suba el pedido mínimo D: las franjas de color van cubriendo la región hasta que no queda ningún punto sin tachar (la zona verde desaparece). Pase el cursor para ver qué restricciones viola cada punto.');

    const modelo = () => [
      { a: [2, 1], b: est.W, nombre: 'madera', txt: `2x₁ + x₂ ≤ ${fmt(est.W)}`, color: C.s1 },
      { a: [1, 3], b: est.L, nombre: 'horas', txt: `x₁ + 3x₂ ≤ ${fmt(est.L)}`, color: C.s3 },
      { a: [-1, -1], b: -est.D, nombre: 'pedido', txt: `x₁ + x₂ ≥ ${fmt(est.D)}`, color: C.s2 },
      { a: [-1, 0], b: 0, nombre: 'x₁ ≥ 0', txt: 'x₁ ≥ 0', color: C.apagado },
      { a: [0, -1], b: 0, nombre: 'x₂ ≥ 0', txt: 'x₂ ≥ 0', color: C.apagado },
    ];
    const vacio = (rs) => O.poligono(rs).length === 0;
    // Mayor pedido D para el que sigue habiendo solución: máx x₁ + x₂ con las demás restricciones.
    function mejorPedido() {
      const poli = O.poligono(modelo().filter((r) => r.nombre !== 'pedido'));
      return poli.length ? O.optimo2d(poli, [1, 1]).z : null;
    }
    // Subconjunto mínimo de restricciones sin solución común (se prueba por tamaño creciente).
    function conflicto(rs) {
      const n = rs.length;
      for (let k = 1; k <= n; k++) {
        const idx = [];
        const rec = (ini) => {
          if (idx.length === k) return vacio(idx.map((i) => rs[i])) ? idx.slice() : null;
          for (let i = ini; i < n; i++) { idx.push(i); const r = rec(i + 1); idx.pop(); if (r) return r; }
          return null;
        };
        const r = rec(0);
        if (r) return r.map((i) => rs[i]);
      }
      return [];
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: -1, xmax: 14, ymin: -1, ymax: 14 }, { etiquetaX: 'x₁ (mesas)', etiquetaY: 'x₂ (sillas)' });
      plano.ejes();
      const rs = modelo(), poli = O.poligono(rs);
      ctx.save();
      plano.recortar();
      ctx.clip();
      for (const r of rs) {
        const prohibida = O.poligono([{ a: [-r.a[0], -r.a[1]], b: -r.b }]);
        trazarPoligono(ctx, plano, prohibida, VIZ.alfa(r.color, r.color === C.apagado ? 0.1 : 0.2), null);
      }
      ctx.restore();
      rs.forEach((r) => trazarRecta(ctx, plano, r, r.color, 2, []));
      let z = null, xo = null;
      if (poli.length) {
        trazarPoligono(ctx, plano, poli, VIZ.alfa(C.s6, 0.35), C.s6, 2);
        const o = O.optimo2d(poli, [4, 3]);
        z = o.z; xo = o.x;
        VIZ.marcador(ctx, plano.sx(xo[0]), plano.sy(xo[1]), C.tinta, 6.5, 6);
      }
      const maxD = mejorPedido();
      if (poli.length) {
        registro.textContent = `Hay solución. La mejor ganancia 4x₁ + 3x₂ es ${fmt(z)} con ${fmt(xo[0], 3)} mesas y ${fmt(xo[1], 3)} sillas.`;
      } else {
        const c = conflicto(rs);
        registro.textContent = `Modelo infactible: ningún punto cumple a la vez ${c.map((r) => r.txt).join(', ')}. `
          + (maxD != null ? `Sin el pedido mínimo se podrían fabricar a lo sumo ${fmt(maxD)} unidades en total; por eso D no puede pasar de ${fmt(maxD)}.` : '');
      }
      const c = poli.length ? [] : conflicto(rs);
      lectura.set([
        ['estado', poli.length ? 'factible' : 'infactible'],
        ['ganancia máx.', poli.length ? fmt(z) : '—'],
        ['en x', poli.length ? `(${fmt(xo[0], 3)}, ${fmt(xo[1], 3)})` : '—'],
        ['D máximo posible', maxD == null ? '—' : fmt(maxD)],
        ['conflicto mínimo', c.length ? c.map((r) => r.nombre).join(' + ') : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), v = plano.iy(y);
      const malas = modelo().filter((r) => r.a[0] * u + r.a[1] * v > r.b + 1e-9);
      tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>ganancia <b>${fmt(4 * u + 3 * v)}</b><br>`
        + (malas.length ? 'viola: ' + malas.map((r) => `<b>${r.nombre}</b>`).join(', ') : 'cumple todas'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('optimization-problem-anatomy', {
    intro: String.raw`
      <p>Un <strong>problema de optimización</strong> pide elegir los valores de unas <em>variables de decisión</em> para que una
      <em>función objetivo</em> sea lo mejor posible, sin romper unas <em>restricciones</em>. Casi cualquier decisión con recursos limitados
      se puede escribir así: cuántas unidades fabricar, qué ruta tomar, cuánto invertir en cada activo.</p>
      <p>Cada punto del plano de variables es una solución candidata. Unas cumplen todas las restricciones (son <em>factibles</em>) y otras no;
      entre las factibles, la que tiene mejor valor del objetivo es la <em>óptima</em>. Aquí podrá mover una solución y ver cada una de estas
      piezas por separado.</p>`,
    visualizaciones: [
      {
        titulo: 'Una solución sobre la región factible',
        descripcion: 'Arrastre el punto dentro y fuera de la región azul y observe cómo cambian su factibilidad, su valor f(x) y la tabla de holguras. Cambie c₁, c₂ y el sentido: la curva de nivel naranja que pasa por el punto empuja el óptimo hacia otro vértice.',
        montar: montarPunto,
      },
      {
        titulo: 'Minimizar o maximizar',
        descripcion: 'Elija una función objetivo y desplace el nivel de 0 a 100 %: la curva roza la región primero en el mínimo y la deja en el máximo. Active el problema equivalente y compruebe que mín f = −máx(−f) y que el punto óptimo no cambia.',
        montar: montarSentido,
      },
      {
        titulo: 'Cuando las restricciones se contradicen',
        descripcion: 'Suba el pedido mínimo D, o baje la madera o las horas, hasta que la zona verde desaparezca. El modelo busca el grupo más pequeño de restricciones en conflicto y calcula hasta qué D habría solución.',
        montar: montarInfactible,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un problema de optimización en forma general es</p>
      \[ \min_{x \in \mathbb{R}^n} f(x) \quad \text{sujeto a} \quad g_i(x) \le 0\ (i = 1,\dots,m), \qquad h_j(x) = 0\ (j = 1,\dots,p). \]
      <ul>
        <li>Las <strong>variables de decisión</strong> \(x = (x_1,\dots,x_n)\) son lo que usted controla.</li>
        <li>La <strong>función objetivo</strong> \(f\) mide qué tan buena es una decisión.</li>
        <li>Las <strong>restricciones</strong> \(g_i, h_j\) describen lo que se puede hacer: capacidades, demandas, balances.</li>
        <li>El <strong>conjunto factible</strong> es \(F = \{x : g_i(x) \le 0,\ h_j(x) = 0\}\). Una solución es <em>factible</em> si \(x \in F\) e <em>infactible</em> en caso contrario.</li>
        <li>Una solución \(x^\ast \in F\) es <strong>óptima</strong> si \(f(x^\ast) \le f(x)\) para todo \(x \in F\); su valor \(f^\ast = f(x^\ast)\) es el <em>valor óptimo</em>.</li>
      </ul>
      <h2>Minimizar y maximizar son el mismo problema</h2>
      <p>Como \(\max_x f(x) = -\min_x (-f(x))\), basta estudiar uno de los dos sentidos. Los puntos óptimos coinciden y solo cambia el signo del valor:</p>
      \[ \max_{x \in F} f(x) = -\min_{x \in F} \bigl(-f(x)\bigr), \qquad \arg\max f = \arg\min (-f). \]
      <h2>Ejemplo resuelto</h2>
      <p>Maximizar \(3x_1 + 2x_2\) sujeto a \(x_1 + x_2 \le 8\), \(x_1 \le 6\), \(x_2 \le 5\), \(-x_1 + x_2 \le 3\), \(x_1, x_2 \ge 0\). La región es el polígono de vértices \((0,0)\), \((6,0)\), \((6,2)\), \((3,5)\), \((2,5)\) y \((0,3)\). Como el objetivo es lineal, su máximo está en un vértice:</p>
      <table>
        <tr><th class="izq">vértice</th><th>(0,0)</th><th>(6,0)</th><th>(6,2)</th><th>(3,5)</th><th>(2,5)</th><th>(0,3)</th></tr>
        <tr><td class="izq">\(3x_1 + 2x_2\)</td><td>0</td><td>18</td><td><strong>22</strong></td><td>19</td><td>16</td><td>6</td></tr>
      </table>
      <p>El óptimo es \(x^\ast = (6, 2)\) con \(f^\ast = 22\). En \(x^\ast\) están <em>activas</em> \(x_1 \le 6\) y \(x_1 + x_2 \le 8\) (se cumplen con igualdad).</p>
      <h2>Tres posibles desenlaces</h2>
      <ul>
        <li><strong>Hay óptimo</strong>: existe \(x^\ast \in F\) que mejora a todos los demás.</li>
        <li><strong>Infactible</strong>: \(F = \emptyset\); no hay candidato alguno (tercera figura). Un conjunto mínimo de restricciones sin punto común explica por qué.</li>
        <li><strong>No acotado</strong>: hay soluciones factibles con \(f\) tan buena como se quiera. Ver <a href="tema.html?id=existence-uniqueness">existencia y unicidad</a>.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>Si el óptimo es el mejor solo entre los vecinos, hablamos de <a href="tema.html?id=local-global-optima">óptimos locales y globales</a>. Cuando \(F\) y \(f\) son convexas, ambos coinciden (<a href="tema.html?id=convex-sets-functions">conjuntos y funciones convexas</a>). El mismo modelo puede escribirse de varias formas sin cambiar su óptimo (<a href="tema.html?id=equivalent-formulations">formulaciones equivalentes</a>), y según el tipo de variables y funciones se clasifica en <a href="tema.html?id=problem-classes">LP, ILP, MILP o NLP</a>.</p>`,
  });
})();
