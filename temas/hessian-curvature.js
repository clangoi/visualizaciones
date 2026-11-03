(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  // Formato con signo menos tipográfico (U+2212) y ceros numéricos limpios.
  const fm = (v, d) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v, d).replace(/-/g, '−');

  const FUN = {
    cuenco: { nombre: 'Cuenco inclinado: x² + xy + 2y²', d: [-3, 3, -3, 3], p0: [1.4, 0.9], f: (x, y) => x * x + x * y + 2 * y * y },
    valle: { nombre: 'Valle curvo (banana)', d: [-2, 2, -1, 3], p0: [-1, 1.8], f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2 },
    silla: { nombre: 'Silla de montar: x² − y²', d: [-2, 2, -2, 2], p0: [0.8, 0.6], f: (x, y) => x * x - y * y },
    cubica: { nombre: 'x³ − 3x + y²', d: [-3, 3, -2.5, 2.5], p0: [1.6, 1.0], f: (x, y) => x ** 3 - 3 * x + y * y },
    ondas: { nombre: 'Colinas y hoyos', d: [-3.2, 3.2, -3.2, 3.2], p0: [0.8, -0.4], f: (x, y) => 2 * Math.sin(x) * Math.sin(y) + 0.12 * (x * x + y * y) },
    himmelblau: { nombre: 'Cuatro valles (Himmelblau)', d: [-5, 5, -5, 5], p0: [1.2, 1.0], f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2 },
  };
  const OPC_FUN = Object.entries(FUN).map(([k, v]) => [k, v.nombre]);
  const grad = (f, p) => O.grad((q) => f(q[0], q[1]), p);
  const hess = (f, p) => O.hess((q) => f(q[0], q[1]), p);
  const TOL = 1e-3;
  // Definición según el signo de los valores propios.
  function definicion(ev) {
    if (ev.every((v) => v > TOL)) return { clave: 'pos', texto: 'definida positiva', color: C.s1 };
    if (ev.every((v) => v < -TOL)) return { clave: 'neg', texto: 'definida negativa', color: C.s8 };
    if (ev.some((v) => v > TOL) && ev.some((v) => v < -TOL)) return { clave: 'ind', texto: 'indefinida', color: C.s2 };
    if (ev.every((v) => v > -TOL)) return { clave: 'spos', texto: 'semidefinida positiva', color: C.s3 };
    return { clave: 'sneg', texto: 'semidefinida negativa', color: C.s3 };
  }

  /* ---------- Ayudantes de mapa con la misma escala en x e y ---------- */

  function planoIgual(l, d, m = { izq: 38, der: 12, sup: 12, inf: 26 }) {
    const [x0, x1, y0, y1] = d;
    const aw = l.ancho - m.izq - m.der, ah = l.alto - m.sup - m.inf;
    const s = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    const dw = (aw - s * (x1 - x0)) / 2, dh = (ah - s * (y1 - y0)) / 2;
    return VIZ.plano(l, { xmin: x0, xmax: x1, ymin: y0, ymax: y1 }, { margen: { izq: m.izq + dw, der: m.der + dw, sup: m.sup + dh, inf: m.inf + dh } });
  }
  function muestras(f, d, G = 100) {
    const [x0, x1, y0, y1] = d;
    const v = new Float64Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) v[j * (G + 1) + i] = f(x0 + ((x1 - x0) * i) / G, y1 - ((y1 - y0) * j) / G);
    const ord = Float64Array.from(v).sort();
    return { v, G, q: (p) => ord[Math.min(ord.length - 1, Math.max(0, Math.round(p * (ord.length - 1))))] };
  }
  function imagenGris(m) {
    const { v, G } = m, lo = m.q(0.02), hi = m.q(0.98);
    const off = document.createElement('canvas');
    off.width = off.height = G + 1;
    const o = off.getContext('2d'), img = o.createImageData(G + 1, G + 1);
    for (let k = 0; k < v.length; k++) {
      const rgb = VIZ.enRampa(Math.sqrt(Math.min(1, Math.max(0, (v[k] - lo) / (hi - lo || 1)))), VIZ.rampaGris);
      img.data[4 * k] = rgb[0]; img.data[4 * k + 1] = rgb[1]; img.data[4 * k + 2] = rgb[2]; img.data[4 * k + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    return off;
  }
  function capaMapa(l, p, f, img, niveles) {
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement('canvas');
    off.width = l.canvas.width; off.height = l.canvas.height;
    const o = off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.imageSmoothingEnabled = true;
    o.drawImage(img, p.x0, p.y1, p.x1 - p.x0, p.y0 - p.y1);
    for (const n of niveles) VIZ.ml.contorno(o, p, f, n, { color: VIZ.alfa(C.tinta2, 0.55), ancho: 1, paso: 4 });
    o.strokeStyle = C.tinta; o.lineWidth = 1;
    o.strokeRect(p.x0 + 0.5, p.y1 + 0.5, p.x1 - p.x0 - 1, p.y0 - p.y1 - 1);
    return off;
  }
  function flecha(ctx, x0, y0, x1, y1, color, w = 2.5) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4));
    ctx.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Largo (en píxeles) de la flecha de un gradiente: crece con ‖∇f‖ pero se mantiene visible.
  function largoFlecha(ng, gmax) { return Math.max(16, Math.min(90, (90 * ng) / (gmax || 1))); }
  function gradMax(def) {
    const [x0, x1, y0, y1] = def.d;
    let mx = 0;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) {
      const g = grad(def.f, [x0 + ((x1 - x0) * i) / 16, y0 + ((y1 - y0) * j) / 16]);
      mx = Math.max(mx, Math.hypot(g[0], g[1]));
    }
    return mx * 0.6;
  }
  // Mapa común: fondo, curvas de nivel y punto. Devuelve { dibujarBase, plano }.
  function crearMapa(lienzo) {
    let m = null, img = null, capa = null, clave = '', plano = null, niveles = [];
    return {
      get plano() { return plano; },
      preparar(def) {
        m = muestras(def.f, def.d, 100);
        img = imagenGris(m);
        niveles = Array.from({ length: 14 }, (_, k) => m.q(0.03) + (m.q(0.97) - m.q(0.03)) * (((k + 0.5) / 14) ** 1.6));
        clave = '';
      },
      base(def, id) {
        const { ctx, ancho: W, alto: H } = lienzo;
        lienzo.limpiar();
        plano = planoIgual(lienzo, def.d);
        plano.ejes();
        const k2 = `${W}x${H}|${id}`;
        if (k2 !== clave) { capa = capaMapa(lienzo, plano, def.f, img, niveles); clave = k2; }
        ctx.drawImage(capa, 0, 0, W, H);
        return plano;
      },
    };
  }
  const alturaMapa = (w) => Math.max(280, Math.min(500, w * 0.85));

  // Tabla de una matriz 2×2 (HTML) dentro de una caja desplazable.
  function tablaMatriz(padre, titulo) {
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    padre.appendChild(caja);
    return {
      set(M) {
        caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
          VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, titulo), VIZ.el('th', null, '∂/∂x'), VIZ.el('th', null, '∂/∂y')),
          ...M.map((f, i) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, i ? '∂/∂y' : '∂/∂x'), ...f.map((v) => VIZ.el('td', null, fm(v, 4)))))));
      },
    };
  }

  /* ---------- Fig. 1: la Hessiana en un punto y su aproximación cuadrática ---------- */

  function montarHessiana(cuerpo) {
    let clave = 'cuenco', P = FUN[clave].p0.slice(), modelo = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; P = FUN[v].p0.slice(); preparar(); dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar el modelo cuadrático de Taylor', valor: modelo, alCambiar: (v) => { modelo = v; dibujar(); } });
    ctl.boton('Punto inicial', () => { P = FUN[clave].p0.slice(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'curva de nivel real de f por el punto', forma: 'linea' },
      { color: C.s7, texto: 'curva del modelo cuadrático (mismo nivel)', forma: 'linea' },
      { color: C.s1, texto: 'dirección propia con λ > 0 (curva hacia arriba)', forma: 'linea' },
      { color: C.s8, texto: 'dirección propia con λ < 0 (curva hacia abajo)', forma: 'linea' },
    ]);
    const tabla = tablaMatriz(cuerpo, 'H(p)');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para mover el punto p. Cerca de p la curva real y la del modelo casi coinciden; lejos se separan. Las flechas apuntan en las direcciones de máxima y mínima curvatura, siempre perpendiculares entre sí.');

    function preparar() { mapa.preparar(FUN[clave]); }
    function dibujar() {
      const def = FUN[clave], f = def.f, { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      const f0 = f(P[0], P[1]), g = grad(f, P), H = hess(f, P), pr = O.propios(H);
      const px = plano.sx(P[0]), py = plano.sy(P[1]);
      ctx.save();
      plano.recortar();
      VIZ.ml.contorno(ctx, plano, f, f0, { color: C.s2, ancho: 6, paso: 3 });
      if (modelo) {
        const q = (x, y) => { const dx = x - P[0], dy = y - P[1]; return f0 + g[0] * dx + g[1] * dy + 0.5 * (H[0][0] * dx * dx + 2 * H[0][1] * dx * dy + H[1][1] * dy * dy); };
        VIZ.ml.contorno(ctx, plano, q, f0, { color: C.s7, ancho: 2, paso: 3 });
      }
      for (const { valor, vector } of pr) {
        const col = valor > TOL ? C.s1 : valor < -TOL ? C.s8 : C.apagado;
        for (const sg of [1, -1]) flecha(ctx, px, py, px + sg * 56 * vector[0], py - sg * 56 * vector[1], col, 2.5);
      }
      VIZ.marcador(ctx, px, py, C.tinta, 5);
      ctx.restore();
      const ev = pr.map((q) => q.valor), def2 = definicion(ev);
      tabla.set(H);
      registro.textContent = `H es simétrica (∂²f/∂x∂y = ∂²f/∂y∂x). Valores propios ${fm(ev[0], 3)} y ${fm(ev[1], 3)}: Hessiana ${def2.texto}${def2.clave === 'ind' ? ' → en p la superficie sube en unas direcciones y baja en otras' : def2.clave === 'pos' ? ' → localmente convexa' : def2.clave === 'neg' ? ' → localmente cóncava' : ''}.`;
      lectura.set([
        ['p', `(${fm(P[0], 3)}, ${fm(P[1], 3)})`],
        ['λ mín (curvatura menor)', fm(ev[0], 3)],
        ['λ máx (curvatura mayor)', fm(ev[1], 3)],
        ['traza = λ₁ + λ₂', fm(H[0][0] + H[1][1], 3)],
        ['det = λ₁ · λ₂', fm(H[0][0] * H[1][1] - H[0][1] * H[1][0], 3)],
        ['tipo', def2.texto],
      ]);
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    let arrastre = false;
    const poner = (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(x, y)) return;
      P = [plano.ix(x), plano.iy(y)];
      dibujar();
    };
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arrastre = true; lienzo.canvas.setPointerCapture(ev.pointerId); poner(ev); });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = false; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (arrastre) poner(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const f = FUN[clave].f, qx = plano.ix(x), qy = plano.iy(y), H = hess(f, [qx, qy]);
      tip.mostrar(x, y, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(f(qx, qy), 4)}</b><br>H = [${fm(H[0][0], 3)}, ${fm(H[0][1], 3)}; ${fm(H[1][0], 3)}, ${fm(H[1][1], 3)}]`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    dibujar();
  }

  /* ---------- Fig. 2: curvatura direccional dᵀHd ---------- */

  const PRESETS = {
    pos: { nombre: 'Definida positiva (cuenco)', H: [3, 1, 2] },
    neg: { nombre: 'Definida negativa (colina)', H: [-3, 0.8, -1.5] },
    ind: { nombre: 'Indefinida (silla)', H: [2, 1.5, -1] },
    spos: { nombre: 'Semidefinida (valle plano)', H: [2, 2, 2] },
  };
  function montarCurvatura(cuerpo) {
    let a = 3, b = 1, c = 2, theta = 25, plano = null, plano2 = null;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Ejemplo de Hessiana', opciones: Object.entries(PRESETS).map(([k, v]) => [k, v.nombre]), valor: 'pos', alCambiar: (v) => { [a, b, c] = PRESETS[v].H; sA.valor = a; sB.valor = b; sC.valor = c; dibujar(); } });
    const sA = ctl.rango({ etiqueta: 'H₁₁ = ∂²f/∂x²', min: -4, max: 4, paso: 0.1, valor: a, formato: (v) => fm(v, 2), alCambiar: (v) => { a = v; dibujar(); } });
    const sB = ctl.rango({ etiqueta: 'H₁₂ = ∂²f/∂x∂y', min: -4, max: 4, paso: 0.1, valor: b, formato: (v) => fm(v, 2), alCambiar: (v) => { b = v; dibujar(); } });
    const sC = ctl.rango({ etiqueta: 'H₂₂ = ∂²f/∂y²', min: -4, max: 4, paso: 0.1, valor: c, formato: (v) => fm(v, 2), alCambiar: (v) => { c = v; dibujar(); } });
    const sT = ctl.rango({ etiqueta: 'Dirección d (ángulo)', min: 0, max: 360, valor: theta, formato: (v) => v + '°', alCambiar: (v) => { theta = v; dibujar(); } });
    void sel;

    const kap = (t) => { const r = (t * Math.PI) / 180, u = Math.cos(r), v = Math.sin(r); return a * u * u + 2 * b * u * v + c * v * v; };
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(280, Math.min(440, w * 0.7)) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'curvatura positiva (κ > 0): la superficie se curva hacia arriba', forma: 'linea' },
      { color: C.s8, texto: 'curvatura negativa (κ < 0): hacia abajo', forma: 'linea' },
      { color: C.apagado, texto: 'κ = ±1 (referencia)', forma: 'linea' },
      { color: C.tinta, texto: 'direcciones propias', forma: 'linea' },
    ]);
    VIZ.subtitulo(cuerpo, 'Corte de la superficie en la dirección d: φ(t) = ½ κ t²');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 190, altoMax: 260 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'corte en la dirección d', forma: 'linea' },
      { color: C.s3, texto: 'corte en la dirección de mayor curvatura', forma: 'linea' },
      { color: C.s7, texto: 'corte en la dirección de menor curvatura', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva los tres sliders para construir cualquier Hessiana 2×2, o haga clic en el gráfico polar para elegir la dirección. La curvatura κ(θ) = dᵀHd oscila entre los valores propios.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pr = O.propios([[a, b], [b, c]]), ev = pr.map((q) => q.valor);
      const R = Math.max(1.2, Math.abs(ev[0]), Math.abs(ev[1])) * 1.15;
      plano = planoIgual(lienzo, [-R, R, -R, R], { izq: 40, der: 14, sup: 12, inf: 26 });
      plano.ejes();
      ctx.save();
      plano.recortar();
      // Círculo de referencia κ = ±1
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(plano.sx(0), plano.sy(0), plano.sx(1) - plano.sx(0), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      // Curva polar r = |κ(θ)|, coloreada por signo
      for (let t = 0; t < 360; t += 2) {
        const k1 = kap(t), k2 = kap(t + 2), r1 = (t * Math.PI) / 180, r2 = ((t + 2) * Math.PI) / 180;
        ctx.strokeStyle = (k1 + k2) / 2 >= 0 ? C.s1 : C.s8; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(plano.sx(Math.abs(k1) * Math.cos(r1)), plano.sy(Math.abs(k1) * Math.sin(r1)));
        ctx.lineTo(plano.sx(Math.abs(k2) * Math.cos(r2)), plano.sy(Math.abs(k2) * Math.sin(r2)));
        ctx.stroke();
      }
      // Direcciones propias
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      for (const q of pr) {
        ctx.beginPath(); ctx.moveTo(plano.sx(-R * q.vector[0]), plano.sy(-R * q.vector[1])); ctx.lineTo(plano.sx(R * q.vector[0]), plano.sy(R * q.vector[1])); ctx.stroke();
      }
      ctx.setLineDash([]);
      const k = kap(theta), r = (theta * Math.PI) / 180;
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(plano.sx(0), plano.sy(0)); ctx.lineTo(plano.sx(R * Math.cos(r) * 0.95), plano.sy(R * Math.sin(r) * 0.95)); ctx.stroke();
      VIZ.marcador(ctx, plano.sx(Math.abs(k) * Math.cos(r)), plano.sy(Math.abs(k) * Math.sin(r)), k >= 0 ? C.s1 : C.s8, 5.5);
      ctx.restore();

      const def = definicion(ev);
      registro.textContent = `κ(${theta}°) = dᵀHd = ${fm(k, 3)}: ${k > TOL ? 'la superficie se curva hacia arriba' : k < -TOL ? 'la superficie se curva hacia abajo' : 'no se curva (plana a segundo orden)'} en esa dirección. Hessiana ${def.texto}.`;
      lectura.set([
        ['κ(θ) = dᵀHd', fm(k, 3)],
        ['λ mín', fm(ev[0], 3)],
        ['λ máx', fm(ev[1], 3)],
        ['H₁₁ · H₂₂ − H₁₂²', fm(a * c - b * b, 3)],
        ['tipo', def.texto],
        ['κ siempre dentro de', `[${fm(ev[0], 3)}, ${fm(ev[1], 3)}]`],
      ]);
      dibujarCorte(ev, pr);
    }
    function dibujarCorte(ev) {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const L = 2, M = Math.max(0.5 * Math.max(Math.abs(ev[0]), Math.abs(ev[1]), Math.abs(kap(theta))) * L * L, 0.5) * 1.1;
      plano2 = VIZ.plano(lienzo2, { xmin: -L, xmax: L, ymin: -M, ymax: M }, { etiquetaX: 't', etiquetaY: 'φ(t)' });
      plano2.ejes();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plano2.x0, plano2.sy(0) + 0.5); ctx.lineTo(plano2.x1, plano2.sy(0) + 0.5); ctx.stroke();
      const parab = (kk) => Array.from({ length: 81 }, (_, i) => { const t = -L + (2 * L * i) / 80; return [t, 0.5 * kk * t * t]; });
      ctx.save(); plano2.recortar();
      VIZ.trazar(ctx, plano2, parab(ev[1]), C.s3, 1.5);
      VIZ.trazar(ctx, plano2, parab(ev[0]), C.s7, 1.5);
      VIZ.trazar(ctx, plano2, parab(kap(theta)), C.s2, 3);
      ctx.restore();
    }
    lienzo.alDibujar = () => dibujar();
    lienzo2.alDibujar = () => dibujar();
    const angulo = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return null;
      return ((Math.atan2(plano.iy(y), plano.ix(x)) * 180) / Math.PI + 360) % 360;
    };
    lienzo.canvas.addEventListener('click', (ev) => { const t = angulo(ev); if (t != null) { theta = Math.round(t); sT.valor = theta; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const t = angulo(ev), { x, y } = lienzo.posicion(ev);
      if (t == null) return tip.ocultar();
      tip.mostrar(x, y, `θ = <b>${Math.round(t)}°</b><br>κ(θ) = <b>${fm(kap(t), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (!plano2 || !plano2.dentro(x, y)) return tip2.ocultar();
      const t = plano2.ix(x);
      tip2.mostrar(x, y, `t = <b>${fm(t, 3)}</b>` + VIZ.filaTooltip(C.s2, 'dirección d', fm(0.5 * kap(theta) * t * t, 3)));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: mapa de convexidad e indicatriz de curvatura ---------- */

  const cacheConv = {};
  function mapaConvexidad(clave, G = 70) {
    if (cacheConv[clave]) return cacheConv[clave];
    const def = FUN[clave], [x0, x1, y0, y1] = def.d;
    const off = document.createElement('canvas');
    off.width = off.height = G + 1;
    const o = off.getContext('2d'), img = o.createImageData(G + 1, G + 1);
    const cnt = { pos: 0, neg: 0, ind: 0 };
    const col = { pos: VIZ.rgb(C.s1), neg: VIZ.rgb(C.s8), ind: VIZ.rgb(C.s2) };
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const H = hess(def.f, [x0 + ((x1 - x0) * i) / G, y1 - ((y1 - y0) * j) / G]);
      const ev = O.propios(H).map((q) => q.valor);
      const k = ev[0] > -TOL ? 'pos' : ev[1] < TOL ? 'neg' : 'ind'; // semidefinidas cuentan como convexas / cóncavas
      cnt[k]++;
      const q = 4 * (j * (G + 1) + i);
      img.data[q] = col[k][0]; img.data[q + 1] = col[k][1]; img.data[q + 2] = col[k][2]; img.data[q + 3] = 80;
    }
    o.putImageData(img, 0, 0);
    const tot = (G + 1) * (G + 1);
    return (cacheConv[clave] = { img: off, pos: cnt.pos / tot, neg: cnt.neg / tot, ind: cnt.ind / tot });
  }

  function montarConvexidad(cuerpo) {
    let clave = 'ondas', P = FUN[clave].p0.slice(), zona = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; P = FUN[v].p0.slice(); preparar(); dibujar(); } });
    ctl.casilla({ etiqueta: 'Colorear la región según la Hessiana', valor: zona, alCambiar: (v) => { zona = v; dibujar(); } });
    ctl.boton('Punto inicial', () => { P = FUN[clave].p0.slice(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.45), texto: 'H ⪰ 0: localmente convexa', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.45), texto: 'H ⪯ 0: localmente cóncava', forma: 'cuadro' },
      { color: VIZ.alfa(C.s2, 0.45), texto: 'H indefinida: silla', forma: 'cuadro' },
      { color: C.tinta, texto: 'indicatriz dᵀHd = ±c en el punto elegido', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic para elegir el punto. La indicatriz es una elipse donde H es definida y dos hipérbolas (azul y roja) donde es indefinida: sus ejes largos apuntan hacia donde la superficie se curva menos. Compare la fracción convexa de una función convexa con la de «Colinas y hoyos».');

    let conv = null;
    function preparar() { mapa.preparar(FUN[clave]); conv = mapaConvexidad(clave); }
    function dibujar() {
      const def = FUN[clave], f = def.f, { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      if (zona) { ctx.imageSmoothingEnabled = false; ctx.drawImage(conv.img, plano.x0, plano.y1, plano.x1 - plano.x0, plano.y0 - plano.y1); ctx.imageSmoothingEnabled = true; }
      const H = hess(f, P), pr = O.propios(H), ev = pr.map((q) => q.valor), px = plano.sx(P[0]), py = plano.sy(P[1]);
      ctx.save();
      plano.recortar();
      // Indicatriz: r(θ) = s / √|κ(θ)|, un color por signo de κ
      const kap = (t) => H[0][0] * Math.cos(t) ** 2 + 2 * H[0][1] * Math.cos(t) * Math.sin(t) + H[1][1] * Math.sin(t) ** 2;
      const sc = 38 * Math.sqrt(Math.max(Math.abs(ev[0]), Math.abs(ev[1]), 1e-6));
      for (const signo of [1, -1]) {
        ctx.strokeStyle = signo > 0 ? C.s1 : C.s8; ctx.lineWidth = 2.5;
        ctx.beginPath();
        let abierto = false;
        for (let t = 0; t <= 2 * Math.PI + 0.001; t += 0.02) {
          const k = kap(t);
          if (signo * k <= 1e-3) { abierto = false; continue; }
          const r = sc / Math.sqrt(Math.abs(k));
          if (r > 170) { abierto = false; continue; }
          const X = px + r * Math.cos(t), Y = py - r * Math.sin(t);
          abierto ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          abierto = true;
        }
        ctx.stroke();
      }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      for (const q of pr) { ctx.beginPath(); ctx.moveTo(px - 60 * q.vector[0], py + 60 * q.vector[1]); ctx.lineTo(px + 60 * q.vector[0], py - 60 * q.vector[1]); ctx.stroke(); }
      ctx.setLineDash([]);
      VIZ.marcador(ctx, px, py, C.tinta, 5);
      ctx.restore();
      const d = definicion(ev);
      registro.textContent = d.clave === 'pos' ? 'H ≻ 0: la indicatriz es una elipse; en todas las direcciones la superficie se curva hacia arriba.'
        : d.clave === 'neg' ? 'H ≺ 0: la indicatriz es una elipse; en todas las direcciones la superficie se curva hacia abajo.'
          : d.clave === 'ind' ? 'H indefinida: dos pares de hipérbolas; la superficie sube en unas direcciones y baja en otras, así que no es convexa ni cóncava aquí.'
            : 'H semidefinida: la indicatriz se abre en dos rectas; en una dirección la curvatura es nula.';
      lectura.set([
        ['p', `(${fm(P[0], 3)}, ${fm(P[1], 3)})`],
        ['λ₁, λ₂', `${fm(ev[0], 3)} ; ${fm(ev[1], 3)}`],
        ['tipo de H', d.texto],
        ['región convexa', `${fm(conv.pos * 100, 3)} % del dominio`],
        ['región cóncava', `${fm(conv.neg * 100, 3)} %`],
        ['región de silla', `${fm(conv.ind * 100, 3)} %`],
      ]);
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    let arrastre = false;
    const poner = (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(x, y)) return;
      P = [plano.ix(x), plano.iy(y)];
      dibujar();
    };
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arrastre = true; lienzo.canvas.setPointerCapture(ev.pointerId); poner(ev); });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = false; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (arrastre) poner(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const qx = plano.ix(x), qy = plano.iy(y), ev2 = O.propios(hess(FUN[clave].f, [qx, qy])).map((q) => q.valor);
      tip.mostrar(x, y, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(FUN[clave].f(qx, qy), 4)}</b><br>λ = ${fm(ev2[0], 3)} ; ${fm(ev2[1], 3)}<br><b>${definicion(ev2).texto}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    dibujar();
  }

  VIZ.registrarTema('hessian-curvature', {
    intro: String.raw`
      <p>El gradiente dice hacia dónde sube una función; la <strong>Hessiana</strong> dice cómo se <em>curva</em>. Es la matriz de todas las
      segundas derivadas parciales, y reúne en un solo objeto la curvatura de la superficie en cada dirección: dónde se dobla hacia arriba
      como un cuenco, dónde hacia abajo como una colina y dónde hace las dos cosas a la vez, como una silla de montar.</p>
      <p>Sus <strong>valores propios</strong> son las curvaturas extremas y sus vectores propios las direcciones donde ocurren. Si todos son
      positivos, el punto es localmente convexo (y, si además el gradiente se anula, un mínimo); si hay de ambos signos, es una silla. Las tres figuras
      calculan la Hessiana numéricamente, la descomponen y muestran en qué regiones es convexa la función.</p>`,
    visualizaciones: [
      {
        titulo: 'La Hessiana en un punto y su modelo cuadrático',
        descripcion: 'La tabla muestra \\(H(p)\\) calculada por diferencias finitas y las flechas sus direcciones propias. La curva violeta es la curva de nivel del modelo cuadrático de Taylor sobre la real (naranja ancha): en una función cuadrática coinciden; pruebe «Himmelblau» o «banana» y vea cuánto se separan lejos de \\(p\\).',
        montar: montarHessiana,
      },
      {
        titulo: 'Curvatura según la dirección',
        descripcion: 'Construya una Hessiana con los tres sliders. El gráfico polar muestra \\(\\kappa(\\theta) = d^\\top H d\\) (azul si es positiva, rojo si es negativa); abajo, el corte de la superficie en esa dirección. Pruebe los cuatro ejemplos: cuenco, colina, silla y valle plano.',
        montar: montarCurvatura,
      },
      {
        titulo: 'Mapa de convexidad e indicatriz',
        descripcion: 'El color indica dónde la Hessiana es semidefinida positiva (azul), negativa (rojo) o indefinida (naranja). Haga clic en una región de cada color y observe cómo la indicatriz pasa de elipse a hipérbola.',
        montar: montarConvexidad,
      },
    ],
    teoria: String.raw`
      <h2>La matriz Hessiana</h2>
      <p>Para \(f:\mathbb{R}^n\to\mathbb{R}\) dos veces diferenciable con continuidad, la Hessiana en \(x\) es la matriz de segundas derivadas</p>
      \[ \nabla^2 f(x) = \begin{pmatrix} \dfrac{\partial^2 f}{\partial x_1^2} & \dfrac{\partial^2 f}{\partial x_1\partial x_2} & \cdots \\[6pt] \dfrac{\partial^2 f}{\partial x_2\partial x_1} & \dfrac{\partial^2 f}{\partial x_2^2} & \cdots \\ \vdots & \vdots & \ddots \end{pmatrix}. \]
      <p>Por el teorema de Schwarz es <strong>simétrica</strong>, así que tiene \(n\) valores propios reales y vectores propios ortogonales. Numéricamente se aproxima con diferencias finitas;
      en dos variables, \(\partial_{xx}f\approx\dfrac{f(x+h)-2f(x)+f(x-h)}{h^2}\) y \(\partial_{xy}f\approx\dfrac{f(x+h,y+h)-f(x+h,y-h)-f(x-h,y+h)+f(x-h,y-h)}{4h^2}\).</p>

      <h2>Aproximación cuadrática de Taylor</h2>
      \[ f(x+d) = f(x) + \nabla f(x)^\top d + \tfrac12\, d^\top \nabla^2 f(x)\, d + o(\|d\|^2). \]
      <p>El tercer término es la <em>curvatura</em>. Es lo que dibuja la curva violeta de la figura 1 y la base del método de Newton.</p>

      <h2>Curvatura direccional</h2>
      <p>Para un vector unitario \(u\), la función de una variable \(\varphi(t)=f(x+tu)\) cumple \(\varphi'(0)=\nabla f(x)\cdot u\) y</p>
      \[ \varphi''(0) = u^\top \nabla^2 f(x)\, u =: \kappa(u). \]
      <p>Si \(H=Q\Lambda Q^\top\) con \(\lambda_1\le\dots\le\lambda_n\) y \(u=\sum_i c_i q_i\) con \(\sum c_i^2=1\), entonces \(\kappa(u)=\sum_i \lambda_i c_i^2\), un promedio de los valores propios.
      Por tanto (Rayleigh)</p>
      \[ \lambda_{\min} \le \kappa(u) \le \lambda_{\max}, \]
      <p>con igualdad exactamente en los vectores propios. En el plano, \(\kappa(\theta)=\lambda_1\cos^2(\theta-\alpha)+\lambda_2\sin^2(\theta-\alpha)\): la curva polar de la figura 2.</p>

      <h2>Definición de la matriz y convexidad</h2>
      <table>
        <tr><th>\(H\) es…</th><th>Valores propios</th><th>\(d^\top H d\)</th><th>Significado local</th></tr>
        <tr><td>definida positiva \(\succ0\)</td><td>todos \(&gt;0\)</td><td>\(&gt;0\) para \(d\neq0\)</td><td>cuenco (estrictamente convexa)</td></tr>
        <tr><td>semidefinida positiva \(\succeq0\)</td><td>todos \(\ge0\)</td><td>\(\ge0\)</td><td>convexa, quizá con valles planos</td></tr>
        <tr><td>definida negativa \(\prec0\)</td><td>todos \(&lt;0\)</td><td>\(&lt;0\)</td><td>colina (estrictamente cóncava)</td></tr>
        <tr><td>indefinida</td><td>de ambos signos</td><td>cambia de signo</td><td>silla</td></tr>
      </table>
      <p>En dos variables, el <strong>criterio de Sylvester</strong> lo resume: \(H\succ0\iff H_{11}&gt;0\) y \(\det H=H_{11}H_{22}-H_{12}^2&gt;0\); \(H\prec0\iff H_{11}&lt;0\) y \(\det H&gt;0\); \(\det H&lt;0\) implica indefinida.
      Además \(\operatorname{tr}H=\lambda_1+\lambda_2\) y \(\det H=\lambda_1\lambda_2\).</p>
      <div class="recuadro"><p><strong>Teorema.</strong> Una función dos veces diferenciable sobre un conjunto convexo abierto es convexa si y solo si \(\nabla^2 f(x)\succeq0\) para todo \(x\) del conjunto.
      Si \(\nabla^2 f(x)\succ0\) en todo el conjunto, es estrictamente convexa.</p></div>
      <p>La figura 3 colorea en azul la región donde esto se cumple. Para el cuenco \(f=x^2+xy+2y^2\) es todo el plano (Hessiana constante \(\begin{pmatrix}2&amp;1\\1&amp;4\end{pmatrix}\)); para \(x^2-y^2\), nunca.</p>

      <h2>Indicatriz de curvatura</h2>
      <p>La curva \(\{d:\ d^\top H d=\pm c\}\) se llama indicatriz. Si \(H\succ0\) es una elipse con semiejes \(\sqrt{c/\lambda_i}\) a lo largo de los vectores propios: es más larga donde la curvatura es menor.
      Si \(H\) es indefinida, son dos hipérbolas conjugadas y las asíntotas son las direcciones de curvatura nula.</p>

      <h2>Número de condición</h2>
      <p>Para \(H\succ0\), \(\kappa_2(H)=\lambda_{\max}/\lambda_{\min}\) mide cuán alargadas son las curvas de nivel. Un valor grande hace lento al <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a>
      (\(O(\kappa\log\frac1\varepsilon)\) iteraciones), mientras que el método de Newton es insensible a él.</p>

      <h2>Conexiones</h2>
      <p>La Hessiana decide si un <a href="tema.html?id=stationary-points">punto estacionario</a> es mínimo, máximo o silla, y es la pieza de las
      <a href="tema.html?id=unconstrained-optimality-conditions">condiciones de optimalidad de segundo orden</a>. El gradiente se estudia en
      <a href="tema.html?id=gradients-directional-derivatives">Gradientes y derivadas direccionales</a> y la geometría de las curvas de nivel en
      <a href="tema.html?id=surfaces-contours">Superficies y curvas de nivel</a>.</p>`,
  });
})();
