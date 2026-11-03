(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  // Formato con signo menos tipográfico (U+2212) y ceros numéricos limpios.
  const fm = (v, d) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v, d).replace(/-/g, '−');
  const grad = (f, p) => O.grad((q) => f(q[0], q[1]), p);
  const hess = (f, p) => O.hess((q) => f(q[0], q[1]), p);
  const TOL = 1e-3;

  /* Casos de estudio centrados en el origen, donde ∇f = 0. */
  const CASOS = {
    cuenco: { nombre: 'x² + y²  (mínimo estricto)', d: [-2, 2, -2, 2], f: (x, y) => x * x + y * y },
    cuartica: { nombre: 'x⁴ + y²  (mínimo con H singular)', d: [-2, 2, -2, 2], f: (x, y) => x ** 4 + y * y },
    cubo: { nombre: 'x³ + y²  (cumple lo necesario, no es mínimo)', d: [-2, 2, -2, 2], f: (x, y) => x ** 3 + y * y },
    silla: { nombre: 'x² − y²  (silla)', d: [-2, 2, -2, 2], f: (x, y) => x * x - y * y },
    colina: { nombre: '−x² − y²  (máximo)', d: [-2, 2, -2, 2], f: (x, y) => -x * x - y * y },
    valle: { nombre: '(x − y)²  (valle plano: mínimos no estrictos)', d: [-2, 2, -2, 2], f: (x, y) => (x - y) ** 2 },
    mixto: { nombre: 'x² − y⁴  (H ⪰ 0 pero no es mínimo)', d: [-2, 2, -2, 2], f: (x, y) => x * x - y ** 4 },
  };
  const OPC_CASOS = Object.entries(CASOS).map(([k, v]) => [k, v.nombre]);

  /* Funciones para el método de Newton. */
  const NEWTON = {
    cubica: { nombre: 'x³ − 3x + y² (mínimo en (1, 0), silla en (−1, 0))', d: [-3, 3, -2.5, 2.5], p0: [-0.6, 1.5], f: (x, y) => x ** 3 - 3 * x + y * y },
    himmelblau: { nombre: 'Himmelblau (cuatro mínimos, un máximo, cuatro sillas)', d: [-5, 5, -5, 5], p0: [-0.5, -0.3], f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2 },
    valle: { nombre: 'Valle curvo (banana)', d: [-2, 2, -1, 3], p0: [-1.2, 1.6], f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2 },
    pozo: { nombre: '(x² − 1)² + y² (doble pozo, silla en el origen)', d: [-2, 2, -1.6, 1.6], p0: [0.2, 1.0], f: (x, y) => (x * x - 1) ** 2 + y * y },
    ondas: { nombre: 'Colinas y hoyos', d: [-3.2, 3.2, -3.2, 3.2], p0: [0.8, -0.4], f: (x, y) => 2 * Math.sin(x) * Math.sin(y) + 0.12 * (x * x + y * y) },
  };
  const OPC_NEWTON = Object.entries(NEWTON).map(([k, v]) => [k, v.nombre]);

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

  /* ---------- Fig. 1: lista de verificación de condiciones ---------- */

  function montarCondiciones(cuerpo) {
    let clave = 'cuartica', P = [0, 0], r = 0.5;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Caso', opciones: OPC_CASOS, valor: clave, alCambiar: (v) => { clave = v; P = [0, 0]; preparar(); dibujar(); } });
    ctl.rango({ etiqueta: 'Radio r del anillo de prueba', min: 0.05, max: 1.5, paso: 0.05, valor: r, formato: (v) => fm(v, 3), alCambiar: (v) => { r = v; dibujar(); } });
    ctl.boton('Volver al punto estacionario', () => { P = [0, 0]; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(260, Math.min(420, w * 0.75)) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'f(p + d) > f(p): sube', forma: 'punto' },
      { color: C.s8, texto: 'f(p + d) < f(p): baja', forma: 'punto' },
      { color: C.inactivo, texto: 'f(p + d) = f(p): igual', forma: 'punto' },
      { color: C.tinta, texto: 'punto de prueba p', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Lista de verificación en p');
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.subtitulo(cuerpo, 'Variación de f sobre el anillo: f(p + r(cos φ, sen φ)) − f(p)');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.28, altoMin: 170, altoMax: 240 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'sube', forma: 'cuadro' },
      { color: C.s8, texto: 'baja', forma: 'cuadro' },
      { color: C.tinta, texto: 'variación Δf(φ)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un caso y compare la lista con lo que hace realmente f sobre el anillo. Haga clic en el mapa para alejar el punto de prueba (la primera condición falla). En «x⁴ + y²» y «x³ + y²» la Hessiana es la misma y la conclusión es opuesta.');

    function preparar() { mapa.preparar(CASOS[clave]); }
    let anillo = null, plano2 = null;
    const si = (b) => (b ? '<b>sí</b>' : 'no');
    function dibujar() {
      const def = CASOS[clave], f = def.f, { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      const g = grad(f, P), ng = Math.hypot(g[0], g[1]), H = hess(f, P), ev = O.propios(H).map((q) => q.valor);
      const f0 = f(P[0], P[1]);
      // Anillo de prueba
      const N = 120;
      anillo = Array.from({ length: N + 1 }, (_, k) => {
        const a = (2 * Math.PI * k) / N, x = P[0] + r * Math.cos(a), y = P[1] + r * Math.sin(a);
        return { a, x, y, df: f(x, y) - f0 };
      });
      const eps = 1e-9 + 1e-9 * Math.abs(f0);
      const col = (df) => (df > eps ? C.s6 : df < -eps ? C.s8 : C.inactivo);
      ctx.save();
      plano.recortar();
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(plano.sx(P[0]), plano.sy(P[1]), Math.abs(plano.sx(r) - plano.sx(0)), 0, 7); ctx.stroke(); ctx.setLineDash([]);
      for (let k = 0; k < N; k += 2) VIZ.marcador(ctx, plano.sx(anillo[k].x), plano.sy(anillo[k].y), col(anillo[k].df), 3.2);
      VIZ.marcador(ctx, plano.sx(P[0]), plano.sy(P[1]), C.tinta, 5);
      ctx.restore();

      const mn = Math.min(...anillo.map((q) => q.df)), mx = Math.max(...anillo.map((q) => q.df));
      const c1 = ng < 1e-6, c2 = c1 && ev[0] > -TOL, c3 = c1 && ev[0] > TOL, c3n = c1 && ev[1] < -TOL;
      const real = mn < -eps ? 'baja' : mx > eps ? (mn >= -eps ? 'sube' : '') : 'plana';
      const filas = [
        ['1. Necesaria de 1.er orden: ∇f(p) = 0', `‖∇f‖ = ${fm(ng, 3)}`, c1],
        ['2. Necesaria de 2.º orden: H(p) ⪰ 0', `λ mín = ${fm(ev[0], 3)}`, c2],
        ['3. Suficiente: ∇f(p) = 0 y H(p) ≻ 0', `λ mín = ${fm(ev[0], 3)} > 0`, c3],
      ];
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('tr', null, VIZ.el('th', null, 'Condición'), VIZ.el('th', null, 'Valor calculado'), VIZ.el('th', null, '¿Se cumple?')),
        ...filas.map(([t, v, ok]) => VIZ.el('tr', null, VIZ.el('td', null, t), VIZ.el('td', null, v), VIZ.el('td', { style: { color: ok ? C.s6 : C.s8, fontWeight: 600 } }, ok ? 'sí' : 'no')))));
      let veredicto;
      if (!c1) veredicto = 'No es estacionario: −∇f es dirección de descenso, así que p no puede ser un mínimo local.';
      else if (c3) veredicto = 'Mínimo local estricto: se cumple la condición suficiente.';
      else if (c3n) veredicto = 'Máximo local estricto (H ≺ 0): no es un mínimo.';
      else if (!c2) veredicto = 'Falla la condición necesaria de 2.º orden: H tiene un valor propio negativo, hay una dirección de curvatura negativa. No es mínimo (es silla o máximo).';
      else veredicto = `Prueba no concluyente: cumple lo necesario pero no lo suficiente (H singular). El anillo muestra que f ${real === 'baja' ? 'BAJA en alguna dirección: no es mínimo local' : real === 'sube' ? 'sube en todas las direcciones: es un mínimo (estricto) pese a H singular' : 'no cambia: mínimo no estricto'}.`;
      registro.textContent = veredicto;
      lectura.set([
        ['p', `(${fm(P[0], 3)}, ${fm(P[1], 3)})`],
        ['‖∇f(p)‖', fm(ng, 3)],
        ['λ(H)', `${fm(ev[0], 3)} ; ${fm(ev[1], 3)}`],
        ['mín Δf en el anillo', fm(mn, 3)],
        ['máx Δf en el anillo', fm(mx, 3)],
      ]);
      void si;
      dibujarAnillo(eps);
    }
    function dibujarAnillo(eps) {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      let M = 1e-9;
      for (const q of anillo) M = Math.max(M, Math.abs(q.df));
      plano2 = VIZ.plano(lienzo2, { xmin: 0, xmax: 360, ymin: -M * 1.1, ymax: M * 1.1 }, { etiquetaX: 'φ (grados)', etiquetaY: 'Δf', ticksX: [0, 45, 90, 135, 180, 225, 270, 315, 360] });
      const p = plano2;
      ctx.save(); p.recortar();
      for (let k = 0; k < anillo.length - 1; k++) {
        const m = (anillo[k].df + anillo[k + 1].df) / 2;
        if (Math.abs(m) <= eps) continue;
        ctx.fillStyle = VIZ.alfa(m > 0 ? C.s6 : C.s8, 0.12);
        ctx.fillRect(p.sx(k * 3), p.y1, p.sx(3) - p.sx(0) + 0.5, p.y0 - p.y1);
      }
      ctx.restore();
      p.ejes();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x0, p.sy(0) + 0.5); ctx.lineTo(p.x1, p.sy(0) + 0.5); ctx.stroke();
      VIZ.trazar(ctx, p, anillo.map((q, k) => [k * 3, q.df]), C.tinta, 2);
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    lienzo2.alDibujar = () => anillo && dibujarAnillo(1e-9);
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (!anillo || !plano2 || !plano2.dentro(x, y)) return tip2.ocultar();
      const k = Math.max(0, Math.min(119, Math.round(plano2.ix(x) / 3)));
      tip2.mostrar(x, y, `φ = <b>${k * 3}°</b><br>Δf = <b>${fm(anillo[k].df, 3)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(x, y)) return;
      P = [plano.ix(x), plano.iy(y)];
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const f = CASOS[clave].f, qx = plano.ix(x), qy = plano.iy(y);
      tip.mostrar(x, y, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(f(qx, qy), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    dibujar();
  }

  /* ---------- Fig. 2: Newton como búsqueda de ∇f = 0 ---------- */

  function montarNewton(cuerpo) {
    let clave = 'cubica', S = NEWTON[clave].p0.slice(), metodo = 'puro';
    let x = S.slice(), tray = [], hist = [], msg = '', mu = 0, ult = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_NEWTON, valor: clave, alCambiar: (v) => { clave = v; S = NEWTON[v].p0.slice(); preparar(); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Método', opciones: [['puro', 'Newton puro: x ← x − H⁻¹∇f'], ['reg', 'Newton regularizado: (H + μI) d = −∇f con búsqueda lineal']], valor: metodo, alCambiar: (v) => { metodo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Punto inicial', () => { S = NEWTON[clave].p0.slice(); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'paso que baja f', forma: 'linea' },
      { color: C.s8, texto: 'paso que sube f (Newton se va a un máximo o una silla)', forma: 'linea' },
      { color: C.tinta, texto: 'iterado actual', forma: 'punto' },
      { color: C.apagado, texto: 'punto inicial', forma: 'cuadro' },
    ]);
    VIZ.subtitulo(cuerpo, 'Norma del gradiente ‖∇f‖ en cada iteración (escala logarítmica)');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.26, altoMin: 170, altoMax: 240 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: '‖∇f(xₖ)‖', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el mapa para elegir el punto inicial y ejecute los pasos. Con «x³ − 3x + y²», empiece cerca de (−1, 0): Newton puro converge a la silla; el método regularizado la evita. Una convergencia cuadrática hace caer ‖∇f‖ cada vez más rápido.');

    const F = () => NEWTON[clave].f;
    function preparar() { mapa.preparar(NEWTON[clave]); }
    function iniciar() {
      x = S.slice(); tray = [x.slice()]; ult = null; mu = 0;
      const fx = (q) => F()(q[0], q[1]);
      hist = [Math.hypot(...grad(F(), x))];
      msg = `Punto inicial (${fm(x[0], 3)}, ${fm(x[1], 3)}).`;
      return (function* () {
        for (let k = 0; k < 60; k++) {
          const g = grad(F(), x), ng = Math.hypot(g[0], g[1]);
          if (ng < 1e-9) { msg = `‖∇f‖ = ${fm(ng, 2)} < 10⁻⁹: punto estacionario alcanzado. ${tipoTexto(x)}`; yield; return; }
          const H = O.hess(fx, x), ev = O.propios(H).map((q) => q.valor);
          mu = metodo === 'reg' && ev[0] < 0.1 ? 0.1 - ev[0] : 0;
          const d = O.resolver([[H[0][0] + mu, H[0][1]], [H[1][0], H[1][1] + mu]], [-g[0], -g[1]]);
          if (!d || !d.every(Number.isFinite)) { msg = 'H es singular: no se puede resolver H d = −∇f.'; yield; return; }
          let t = 1, xn = [x[0] + d[0], x[1] + d[1]];
          const f0 = F()(x[0], x[1]), sl = g[0] * d[0] + g[1] * d[1];
          if (metodo === 'reg') {
            while (F()(xn[0], xn[1]) > f0 + 1e-4 * t * sl && t > 1e-10) { t /= 2; xn = [x[0] + t * d[0], x[1] + t * d[1]]; }
          }
          const fn = F()(xn[0], xn[1]);
          if (!Number.isFinite(fn) || Math.abs(xn[0]) > 1e3 || Math.abs(xn[1]) > 1e3) { msg = 'El paso se dispara fuera del dominio.'; yield; return; }
          ult = { sube: fn > f0 + 1e-12, ev, mu, t, sl };
          tray.push({ p: xn.slice(), sube: ult.sube });
          x = xn;
          hist.push(Math.hypot(...grad(F(), x)));
          msg = `Paso ${k + 1}: λ mín(H) = ${fm(ev[0], 3)}${ev[0] <= 0 ? ' (H no es definida positiva)' : ''}; ∇f·d = ${fm(sl, 3)} ${sl < 0 ? '(d desciende)' : '(d NO desciende: apunta hacia un máximo o una silla)'}${mu ? `; se usó μ = ${fm(mu, 3)} y t = ${fm(t, 2)}` : ''}.`;
          yield;
        }
        msg = 'Se agotaron las 60 iteraciones.';
      })();
    }
    function tipoTexto(p) {
      const ev = O.propios(O.hess((q) => F()(q[0], q[1]), p)).map((q) => q.valor);
      return ev.every((v) => v > TOL) ? 'Es un mínimo local (H ≻ 0).' : ev.every((v) => v < -TOL) ? 'Es un máximo local (H ≺ 0).' : ev.some((v) => v > TOL) && ev.some((v) => v < -TOL) ? 'Es un punto de silla (H indefinida).' : 'H es singular: no se puede clasificar con segundo orden.';
    }
    let plano2 = null;
    function dibujar() {
      const def = NEWTON[clave], { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      ctx.save();
      plano.recortar();
      for (let k = 1; k < tray.length; k++) {
        const a = k === 1 ? S : tray[k - 1].p, b = tray[k].p;
        VIZ.trazar(ctx, plano, [a, b], VIZ.alfa(C.superficie, 0.85), 5);
        VIZ.trazar(ctx, plano, [a, b], tray[k].sube ? C.s8 : C.s1, 2.2);
      }
      tray.slice(1).forEach((q) => { ctx.fillStyle = q.sube ? C.s8 : C.s1; ctx.beginPath(); ctx.arc(plano.sx(q.p[0]), plano.sy(q.p[1]), 2.6, 0, 7); ctx.fill(); });
      ctx.fillStyle = C.apagado; ctx.fillRect(plano.sx(S[0]) - 4, plano.sy(S[1]) - 4, 8, 8);
      VIZ.marcador(ctx, plano.sx(x[0]), plano.sy(x[1]), C.tinta, 5.5);
      ctx.restore();
      registro.textContent = msg;
      const g = grad(def.f, x), ev = O.propios(O.hess((q) => def.f(q[0], q[1]), x)).map((q) => q.valor);
      lectura.set([
        ['iteración', String(hist.length - 1)],
        ['f(x)', fm(def.f(x[0], x[1]), 5)],
        ['‖∇f‖', fm(Math.hypot(g[0], g[1]), 3)],
        ['λ(H)', `${fm(ev[0], 3)} ; ${fm(ev[1], 3)}`],
        ['x', `(${fm(x[0], 5)}, ${fm(x[1], 5)})`],
      ]);
      dibujarNorma();
    }
    function dibujarNorma() {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const n = Math.max(6, hist.length);
      const mx = Math.max(...hist, 1e-3);
      plano2 = VIZ.plano(lienzo2, { xmin: 0, xmax: n - 1, ymin: 1e-12, ymax: mx * 10 }, { logY: true, etiquetaX: 'iteración k', etiquetaY: '‖∇f‖' });
      plano2.ejes();
      ctx.save(); plano2.recortar();
      VIZ.trazar(ctx, plano2, hist.map((v, k) => [k, Math.max(v, 1e-13)]), C.s1, 2);
      hist.forEach((v, k) => VIZ.marcador(ctx, plano2.sx(k), plano2.sy(Math.max(v, 1e-13)), C.s1, 3.5));
      ctx.restore();
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    lienzo2.alDibujar = () => dibujarNorma();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo2.posicion(ev);
      if (!plano2 || !plano2.dentro(mx, my)) return tip2.ocultar();
      const k = Math.round(plano2.ix(mx));
      if (k < 0 || k >= hist.length) return tip2.ocultar();
      tip2.mostrar(mx, my, `k = <b>${k}</b><br>‖∇f‖ = <b>${fm(hist[k], 3)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(mx, my)) return;
      S = [plano.ix(mx), plano.iy(my)];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(mx, my)) return tip.ocultar();
      const qx = plano.ix(mx), qy = plano.iy(my), g = grad(F(), [qx, qy]);
      tip.mostrar(mx, my, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(F()(qx, qy), 4)}</b><br>‖∇f‖ = ${fm(Math.hypot(g[0], g[1]), 3)}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    rep.reiniciar();
  }

  VIZ.registrarTema('unconstrained-optimality-conditions', {
    intro: String.raw`
      <p>¿Cómo saber si un punto es un mínimo? Sin restricciones, la respuesta se construye en dos capas. La <strong>condición de primer orden</strong>
      es necesaria: en un mínimo local el gradiente tiene que ser cero. Pero eso también ocurre en máximos y sillas, así que se mira la curvatura:
      la <strong>condición de segundo orden</strong> pide que la Hessiana no tenga direcciones de curvatura negativa y, si es estrictamente positiva, garantiza
      que el punto es un mínimo.</p>
      <p>Hay una zona gris: cuando la Hessiana es singular, la prueba puede no concluir. Los ejemplos clásicos \(x^4\) y \(x^3\) tienen la misma
      Hessiana en el origen y, sin embargo, uno es un mínimo y el otro no. La primera figura enfrenta cada condición con lo que f hace realmente
      alrededor del punto; la segunda muestra el método de Newton, que busca precisamente los puntos donde \(\nabla f=0\).</p>`,
    visualizaciones: [
      {
        titulo: 'Condiciones necesarias y suficientes frente a la realidad',
        descripcion: 'La lista de verificación evalúa las tres condiciones en \\(p\\); el anillo de puntos muestra si f sube o baja alrededor. Compare «\\(x^4 + y^2\\)» con «\\(x^3 + y^2\\)»: misma Hessiana singular, resultados opuestos. Haga clic en el mapa para mover \\(p\\) fuera del origen.',
        montar: montarCondiciones,
      },
      {
        titulo: 'Newton como búsqueda de ∇f = 0',
        descripcion: 'Ejecute Newton paso a paso y observe dónde termina. En «\\(x^3 - 3x + y^2\\)» empiece cerca de \\((-1, 0)\\): el método puro converge a una silla. Cambie al método regularizado, que impone dirección de descenso, y compare cómo cae \\(\\|\\nabla f\\|\\).',
        montar: montarNewton,
      },
    ],
    teoria: String.raw`
      <h2>Mínimo local sin restricciones</h2>
      <p>Un punto \(x^*\) es un <strong>mínimo local</strong> de \(f\) si existe \(\varepsilon&gt;0\) con \(f(x)\ge f(x^*)\) para todo \(\|x-x^*\|&lt;\varepsilon\); es <em>estricto</em> si la desigualdad es estricta para \(x\neq x^*\).
      En los resultados siguientes \(f\) es dos veces diferenciable con continuidad.</p>

      <h2>Condiciones necesarias</h2>
      <div class="recuadro"><p><strong>Primer orden.</strong> Si \(x^*\) es un mínimo local, entonces \(\nabla f(x^*)=0\).<br>
      <strong>Segundo orden.</strong> Si \(x^*\) es un mínimo local, entonces además \(\nabla^2 f(x^*)\succeq 0\) (semidefinida positiva).</p></div>
      <p><em>Idea de la prueba.</em> Para cualquier dirección \(d\), \(\varphi(t)=f(x^*+td)\) tiene un mínimo local en \(t=0\), de modo que \(\varphi'(0)=\nabla f(x^*)\cdot d=0\) y \(\varphi''(0)=d^\top\nabla^2 f(x^*)d\ge 0\).
      Como vale para todo \(d\), se obtienen ambas condiciones. \(\square\)</p>

      <h2>Condición suficiente</h2>
      <div class="recuadro"><p><strong>Segundo orden suficiente.</strong> Si \(\nabla f(x^*)=0\) y \(\nabla^2 f(x^*)\succ 0\) (definida positiva), entonces \(x^*\) es un mínimo local estricto.</p></div>
      <p><em>Idea de la prueba.</em> Con \(\lambda_{\min}&gt;0\) el desarrollo de Taylor da \(f(x^*+d)=f(x^*)+\tfrac12 d^\top Hd+o(\|d\|^2)\ge f(x^*)+\tfrac12\lambda_{\min}\|d\|^2+o(\|d\|^2)\), que es mayor que \(f(x^*)\) para \(d\) pequeño no nulo. \(\square\)</p>

      <h2>Qué no dicen: contraejemplos</h2>
      <table>
        <tr><th>Función</th><th>En el origen</th><th>Conclusión</th></tr>
        <tr><td>\(x^2+y^2\)</td><td>\(\nabla f=0,\ H=2I\succ0\)</td><td>mínimo estricto (suficiente)</td></tr>
        <tr><td>\(x^4+y^2\)</td><td>\(\nabla f=0,\ H=\operatorname{diag}(0,2)\succeq0\)</td><td>es mínimo, pero la condición suficiente <em>no</em> se cumple: no es necesaria</td></tr>
        <tr><td>\(x^3+y^2\)</td><td>\(\nabla f=0,\ H=\operatorname{diag}(0,2)\succeq0\)</td><td>cumple las necesarias y <em>no</em> es mínimo (\(f&lt;0\) si \(x&lt;0\))</td></tr>
        <tr><td>\(x^2-y^4\)</td><td>\(\nabla f=0,\ H=\operatorname{diag}(2,0)\succeq0\)</td><td>tampoco es mínimo: \(f(0,y)=-y^4\)</td></tr>
        <tr><td>\(x^2-y^2\)</td><td>\(\nabla f=0,\ H=\operatorname{diag}(2,-2)\)</td><td>falla la necesaria de 2.º orden: silla</td></tr>
        <tr><td>\((x-y)^2\)</td><td>\(\nabla f=0,\ H\succeq0\) singular</td><td>mínimos no estrictos a lo largo de la recta \(x=y\)</td></tr>
      </table>
      <p>Cuando la Hessiana es singular hay que mirar derivadas de orden superior (\(x^4\) frente a \(x^3\)). La primera figura lo comprueba muestreando \(f\) en un anillo, que es evidencia, no demostración.</p>

      <h2>El caso convexo</h2>
      <p>Si \(f\) es convexa, la condición de primer orden ya es <em>suficiente</em>, y global: \(\nabla f(x^*)=0\Rightarrow x^*\) es mínimo global, porque \(f(y)\ge f(x^*)+\nabla f(x^*)^\top(y-x^*)=f(x^*)\).
      Si además es estrictamente convexa, el mínimo es único. Véase <a href="tema.html?id=convex-sets-functions">conjuntos y funciones convexos</a> y
      <a href="tema.html?id=local-global-optima">óptimos locales y globales</a>.</p>

      <h2>El método de Newton</h2>
      <p>Para resolver \(\nabla f(x)=0\), se linealiza el gradiente en el iterado: \(\nabla f(x_k+d)\approx\nabla f(x_k)+\nabla^2 f(x_k)d=0\), lo que da</p>
      <pre><code>x ← x₀
mientras ‖∇f(x)‖ &gt; ε:
    resolver H(x) d = −∇f(x)
    x ← x + d</code></pre>
      <p>Si \(x_0\) está cerca de un punto estacionario con \(H\) no singular, converge <em>cuadráticamente</em>: \(\|x_{k+1}-x^*\|\le M\|x_k-x^*\|^2\); en la figura 2, el número de cifras correctas de \(\|\nabla f\|\) se duplica en cada paso.
      Pero Newton resuelve una ecuación, no minimiza: converge igual a máximos y a sillas. El paso \(d\) es de descenso solo si \(\nabla f^\top H^{-1}\nabla f&gt;0\), lo que se asegura cuando \(H\succ0\).
      La versión <em>regularizada</em> resuelve \((H+\mu I)d=-\nabla f\) con \(\mu\ge0\) lo bastante grande para que \(H+\mu I\succ0\), y controla el tamaño del paso con búsqueda lineal; así cada iteración desciende.</p>

      <h2>Conexiones</h2>
      <p>La condición de primer orden se estudia en <a href="tema.html?id=stationary-points">puntos estacionarios</a> y la de segundo orden usa la
      <a href="tema.html?id=hessian-curvature">Hessiana</a>. Con restricciones, estas condiciones se generalizan a los multiplicadores de
      <a href="tema.html?id=equality-constraints-lagrange">Lagrange</a> y a las condiciones <a href="tema.html?id=kkt-conditions">KKT</a>. Un método de primer orden alternativo es el
      <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a>.</p>`,
  });
})();
