(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  // Formato con signo menos tipográfico (U+2212) y ceros numéricos limpios.
  const fm = (v, d) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v, d).replace(/-/g, '−');

  /* Funciones polinomiales (y una periódica) con varios puntos estacionarios. */
  const FUN = {
    cubica: { nombre: 'x³ − 3x + y²', d: [-3, 3, -2.5, 2.5], f: (x, y) => x ** 3 - 3 * x + y * y },
    pozo: { nombre: '(x² − 1)² + y² (doble pozo)', d: [-2, 2, -1.6, 1.6], f: (x, y) => (x * x - 1) ** 2 + y * y },
    tablero: { nombre: 'x³ − 3x + y³ − 3y', d: [-2.8, 2.8, -2.8, 2.8], f: (x, y) => x ** 3 - 3 * x + y ** 3 - 3 * y },
    himmelblau: { nombre: 'Himmelblau', d: [-5, 5, -5, 5], f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2 },
    mono: { nombre: 'Silla del mono: x³ − 3xy²', d: [-2, 2, -2, 2], f: (x, y) => x ** 3 - 3 * x * y * y },
    periodica: { nombre: 'sen x + sen y', d: [-5, 5, -5, 5], f: (x, y) => Math.sin(x) + Math.sin(y) },
  };
  const OPC_FUN = Object.entries(FUN).map(([k, v]) => [k, v.nombre]);
  const grad = (f, p) => O.grad((q) => f(q[0], q[1]), p);
  const fv = (def) => (q) => def.f(q[0], q[1]);

  /* Clasificación por los valores propios de la Hessiana (tolerancia 10⁻³). */
  const TIPOS = {
    min: { texto: 'mínimo local', corto: 'mínimo', figura: 'círculo', color: C.s1, forma: 0 },
    max: { texto: 'máximo local', corto: 'máximo', figura: 'cuadrado', color: C.s8, forma: 1 },
    silla: { texto: 'punto de silla', corto: 'silla', figura: 'rombo', color: C.s2, forma: 3 },
    indet: { texto: 'degenerado (H singular)', corto: 'degenerado', figura: 'triángulo', color: C.apagado, forma: 2 },
  };
  function tipoDe(H) {
    const ev = O.propios(H).map((q) => q.valor), tol = 1e-3;
    if (ev.every((v) => v > tol)) return 'min';
    if (ev.every((v) => v < -tol)) return 'max';
    if (ev.some((v) => v > tol) && ev.some((v) => v < -tol)) return 'silla';
    return 'indet';
  }
  // Newton desde una rejilla de puntos iniciales: lista de puntos estacionarios distintos.
  const cacheTodos = {};
  function todos(clave) {
    if (cacheTodos[clave]) return cacheTodos[clave];
    const def = FUN[clave], F = fv(def), [x0, x1, y0, y1] = def.d, res = [];
    const G = 14;
    for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) {
      let x = [x0 + ((x1 - x0) * i) / G + 0.013, y0 + ((y1 - y0) * j) / G - 0.007];
      for (let k = 0; k < 80; k++) {
        const g = grad(def.f, x);
        if (Math.hypot(g[0], g[1]) < 1e-7) break;
        const xn = O.newton(F, x);
        if (!xn || !xn.every(Number.isFinite) || Math.abs(xn[0]) > 20 || Math.abs(xn[1]) > 20) { x = null; break; }
        x = xn;
      }
      if (!x) continue;
      const g = grad(def.f, x);
      const mx = (x1 - x0) * 0.04, my = (y1 - y0) * 0.04;
      if (Math.hypot(g[0], g[1]) > 1e-6 || x[0] < x0 - mx || x[0] > x1 + mx || x[1] < y0 - my || x[1] > y1 + my) continue;
      if (res.some((r) => Math.hypot(r.x[0] - x[0], r.x[1] - x[1]) < 0.02)) continue;
      const H = O.hess(F, x);
      res.push({ x, tipo: tipoDe(H), f: def.f(x[0], x[1]), H });
    }
    res.sort((a, b) => a.x[0] - b.x[0] || a.x[1] - b.x[1]);
    return (cacheTodos[clave] = res);
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

  const leyendaTipos = () => Object.values(TIPOS).map((t) => ({ color: t.color, texto: `${t.corto} (${t.figura})`, forma: 'punto' }));

  /* ---------- Fig. 1: búsqueda de puntos estacionarios con Newton ---------- */

  function montarBusqueda(cuerpo) {
    let clave = 'cubica', S = [1.4, 1.2], semilla = 1, mostrarTodos = false;
    let x = S.slice(), tray = [], msg = '', final = null, descubiertos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; descubiertos = []; S = centro(); preparar(); rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Mostrar todos los puntos estacionarios', valor: false, alCambiar: (v) => { mostrarTodos = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Punto inicial al azar', () => { semilla++; const r = VIZ.semilla(semilla * 97 + 13), d = FUN[clave].d; S = [d[0] + r() * (d[1] - d[0]), d[2] + r() * (d[3] - d[2])]; rep.reiniciar(); });
    ctl.boton('Borrar hallazgos', () => { descubiertos = []; rep.reiniciar(); });
    const centro = () => { const d = FUN[clave].d; return [d[0] + 0.78 * (d[1] - d[0]), d[2] + 0.75 * (d[3] - d[2])]; };
    S = centro();

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      ...leyendaTipos(),
      { color: C.s1, texto: 'iteraciones de Newton', forma: 'linea' },
      { color: C.tinta, texto: 'punto inicial', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el mapa para elegir un punto inicial y pulse «Hasta el final» (o «Un paso»): Newton converge a un punto con ∇f = 0 cercano, que se clasifica con la Hessiana. Pruebe distintos puntos para descubrir todos.');

    function preparar() { mapa.preparar(FUN[clave]); }
    function iniciar() {
      x = S.slice(); tray = [x.slice()]; final = null;
      msg = `Punto inicial (${fm(x[0], 3)}, ${fm(x[1], 3)}). Newton resuelve H d = −∇f y avanza x ← x + d.`;
      const def = FUN[clave], F = fv(def);
      return (function* () {
        for (let k = 0; k < 60; k++) {
          const g = grad(def.f, x), ng = Math.hypot(g[0], g[1]);
          if (ng < 1e-7) {
            const H = O.hess(F, x), tp = tipoDe(H);
            final = { x: x.slice(), tipo: tp };
            if (!descubiertos.some((q) => Math.hypot(q.x[0] - x[0], q.x[1] - x[1]) < 0.02)) descubiertos.push({ x: x.slice(), tipo: tp });
            msg = `‖∇f‖ = ${fm(ng, 2)} ≈ 0: punto estacionario en (${fm(x[0], 4)}, ${fm(x[1], 4)}), clasificado como ${TIPOS[tp].texto}.`;
            yield; return;
          }
          const xn = O.newton(F, x);
          if (!xn || !xn.every(Number.isFinite) || Math.abs(xn[0]) > 50 || Math.abs(xn[1]) > 50) { msg = 'La Hessiana es singular o el paso se disparó: Newton no puede continuar desde aquí.'; yield; return; }
          x = xn; tray.push(x.slice());
          msg = `Paso ${k + 1}: ‖∇f‖ pasó a ${fm(Math.hypot(...grad(def.f, x)), 3)}.`;
          yield;
        }
        msg = 'Se agotaron las iteraciones sin llegar a ∇f = 0.';
      })();
    }
    function marca(ctx, plano, q) {
      const t = TIPOS[q.tipo];
      VIZ.marcador(ctx, plano.sx(q.x[0]), plano.sy(q.x[1]), t.color, 6, t.forma);
    }
    let visibles = [];
    function dibujar() {
      const def = FUN[clave], { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      ctx.save();
      plano.recortar();
      const lista = mostrarTodos ? todos(clave) : descubiertos;
      visibles = lista;
      if (mostrarTodos) for (const q of lista) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(plano.sx(q.x[0]), plano.sy(q.x[1]), 10, 0, 7); ctx.stroke(); }
      VIZ.trazar(ctx, plano, tray, VIZ.alfa(C.superficie, 0.85), 4.5);
      VIZ.trazar(ctx, plano, tray, C.s1, 2);
      tray.slice(1).forEach(([qx, qy]) => { ctx.fillStyle = C.s1; ctx.beginPath(); ctx.arc(plano.sx(qx), plano.sy(qy), 2.5, 0, 7); ctx.fill(); });
      ctx.fillStyle = C.tinta; ctx.fillRect(plano.sx(S[0]) - 4, plano.sy(S[1]) - 4, 8, 8);
      for (const q of lista) marca(ctx, plano, q);
      ctx.restore();
      registro.textContent = msg;
      const g = grad(def.f, x), H = O.hess(fv(def), x);
      const ev = O.propios(H).map((q) => q.valor);
      lectura.set([
        ['hallados', `${descubiertos.length} de ${todos(clave).length}`],
        ['x actual', `(${fm(x[0], 4)}, ${fm(x[1], 4)})`],
        ['‖∇f‖', fm(Math.hypot(g[0], g[1]), 3)],
        ['valores propios de H', ev.map((v) => fm(v, 3)).join(' ; ')],
        ['clasificación', final ? TIPOS[final.tipo].texto : 'aún no estacionario'],
      ]);
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(mx, my)) return;
      S = [plano.ix(mx), plano.iy(my)];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(mx, my)) return tip.ocultar();
      const cerca = visibles.find((q) => Math.hypot(plano.sx(q.x[0]) - mx, plano.sy(q.x[1]) - my) < 11);
      if (cerca) {
        const ev2 = O.propios(cerca.H || O.hess(fv(FUN[clave]), cerca.x)).map((q) => fm(q.valor, 3)).join(' ; ');
        return tip.mostrar(mx, my, `<b>${TIPOS[cerca.tipo].texto}</b><br>(${fm(cerca.x[0], 4)}, ${fm(cerca.x[1], 4)})<br>f = ${fm(FUN[clave].f(cerca.x[0], cerca.x[1]), 4)}<br>λ(H) = ${ev2}`);
      }
      const qx = plano.ix(mx), qy = plano.iy(my), g = grad(FUN[clave].f, [qx, qy]);
      tip.mostrar(mx, my, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(FUN[clave].f(qx, qy), 4)}</b><br>‖∇f‖ = <b>${fm(Math.hypot(g[0], g[1]), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cortes por un punto estacionario ---------- */

  function montarCortes(cuerpo) {
    let clave = 'cubica', idx = 1, theta = 20;
    const REF = [[0, C.s1], [45, C.s3], [90, C.s4], [135, C.s7]];
    const ctl = VIZ.controles(cuerpo);
    const selPt = ctl.selector({ etiqueta: 'Punto estacionario', opciones: [['0', '…']], valor: '0', alCambiar: (v) => { idx = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; llenar(); preparar(); dibujar(); } });
    const rTheta = ctl.rango({ etiqueta: 'Dirección del corte (ángulo)', min: 0, max: 360, valor: theta, formato: (v) => v + '°', alCambiar: (v) => { theta = v; dibujar(); } });
    const bAnim = ctl.boton('Animar', () => { if (anim.activo) anim.detener(); else anim.iniciar(); }, { primario: true });
    const anim = VIZ.bucle((dt) => { theta = (theta + dt * 0.03) % 360; rTheta.valor = Math.round(theta); dibujar(); return true; }, () => { bAnim.textContent = 'Animar'; });
    bAnim.addEventListener('click', () => { if (anim.activo) bAnim.textContent = 'Detener'; });
    new IntersectionObserver((es) => { if (!es[0].isIntersecting) anim.detener(); }).observe(cuerpo);

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(260, Math.min(420, w * 0.62)) });
    const tipM = VIZ.tooltip(lienzo);
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'corte elegido', forma: 'linea' },
      ...REF.map(([a, c]) => ({ color: c, texto: `corte a ${a}°`, forma: 'linea' })),
      { color: C.tinta, texto: 'punto estacionario', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Variación de f a lo largo de cada corte: f(p + t u) − f(p)');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 220, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'corte elegido', forma: 'linea' },
      ...REF.map(([a, c]) => ({ color: c, texto: `${a}°`, forma: 'linea' })),
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todas las curvas son planas en t = 0 (porque ∇f = 0), pero en un mínimo todas suben, en un máximo todas bajan y en una silla unas suben y otras bajan. Gire el corte, o pulse «Animar», y busque la dirección donde cambia el signo.');

    const lista = () => todos(clave);
    function llenar() {
      const L = lista();
      idx = Math.max(0, L.findIndex((q) => q.tipo === 'silla'));
      selPt.select.replaceChildren(...L.map((q, i) => VIZ.el('option', { value: i }, `${TIPOS[q.tipo].texto} en (${fm(q.x[0], 3)}, ${fm(q.x[1], 3)})`)));
      selPt.valor = String(idx);
    }
    function preparar() { mapa.preparar(FUN[clave]); }
    let plano2 = null, curvas = null, rad = 1;
    function dibujar() {
      const def = FUN[clave], q = lista()[idx], { ctx } = lienzo;
      if (!q) return;
      const plano = mapa.base(def, clave);
      const px = plano.sx(q.x[0]), py = plano.sy(q.x[1]), R = 70;
      ctx.save();
      plano.recortar();
      const seg = (a, c, w, g) => {
        const r = (a * Math.PI) / 180;
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(g || []);
        ctx.beginPath(); ctx.moveTo(px - R * Math.cos(r), py + R * Math.sin(r)); ctx.lineTo(px + R * Math.cos(r), py - R * Math.sin(r)); ctx.stroke();
      };
      REF.forEach(([a, c]) => seg(a, c, 1.5, [4, 3]));
      seg(theta, C.s2, 3);
      ctx.setLineDash([]);
      VIZ.marcador(ctx, px, py, C.tinta, 5.5);
      ctx.restore();

      // Cortes
      rad = 0.2 * Math.min(def.d[1] - def.d[0], def.d[3] - def.d[2]);
      const mk = (a) => {
        const r = (a * Math.PI) / 180, u = [Math.cos(r), Math.sin(r)];
        return Array.from({ length: 101 }, (_, k) => { const t = -rad + (2 * rad * k) / 100; return [t, def.f(q.x[0] + t * u[0], q.x[1] + t * u[1]) - q.f]; });
      };
      curvas = [...REF.map(([a, c]) => ({ a, c, pts: mk(a) })), { a: theta, c: C.s2, pts: mk(theta), sel: true }];
      let M = 0;
      for (const c of curvas) for (const [, v] of c.pts) M = Math.max(M, Math.abs(v));
      M = M || 1;
      lienzo2.limpiar();
      plano2 = VIZ.plano(lienzo2, { xmin: -rad, xmax: rad, ymin: -M * 1.08, ymax: M * 1.08 }, { etiquetaX: 't', etiquetaY: 'f(p + t u) − f(p)' });
      plano2.ejes();
      const c2 = lienzo2.ctx;
      c2.strokeStyle = C.tinta2; c2.lineWidth = 1;
      c2.beginPath(); c2.moveTo(plano2.x0, plano2.sy(0) + 0.5); c2.lineTo(plano2.x1, plano2.sy(0) + 0.5); c2.stroke();
      for (const c of curvas) VIZ.trazar(c2, plano2, c.pts, c.c, c.sel ? 3 : 1.5);
      VIZ.marcador(c2, plano2.sx(0), plano2.sy(0), C.tinta, 4.5);

      const r = (theta * Math.PI) / 180, u = [Math.cos(r), Math.sin(r)];
      const H = q.H, cur = u[0] * (H[0][0] * u[0] + H[0][1] * u[1]) + u[1] * (H[1][0] * u[0] + H[1][1] * u[1]);
      const ev = O.propios(H).map((w) => w.valor), g = grad(def.f, q.x);
      registro.textContent = Math.abs(cur) < 1e-3 ? 'En esta dirección la curvatura es nula: f es plana hasta segundo orden y hay que mirar términos de orden superior.'
        : cur > 0 ? `En esta dirección f sube a ambos lados de p (curvatura ${fm(cur, 3)} > 0): p parece un mínimo sobre este corte.`
          : `En esta dirección f baja a ambos lados de p (curvatura ${fm(cur, 3)} < 0): p parece un máximo sobre este corte.`;
      lectura.set([
        ['punto', `(${fm(q.x[0], 4)}, ${fm(q.x[1], 4)})`],
        ['clasificación', TIPOS[q.tipo].texto],
        ['‖∇f‖', fm(Math.hypot(g[0], g[1]), 2)],
        ['curvatura uᵀHu', fm(cur, 3)],
        ['λ(H)', ev.map((v) => fm(v, 3)).join(' ; ')],
      ]);
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    lienzo2.alDibujar = () => dibujar();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (!plano2 || !curvas || !plano2.dentro(x, y)) return tip.ocultar();
      const k = Math.max(0, Math.min(100, Math.round(((plano2.ix(x) + rad) / (2 * rad)) * 100)));
      tip.mostrar(x, y, `t = <b>${fm(curvas[0].pts[k][0], 3)}</b>` + curvas.map((c) => VIZ.filaTooltip(c.c, c.sel ? `${Math.round(c.a)}° (elegido)` : `${c.a}°`, fm(c.pts[k][1], 3))).join(''));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(x, y)) return;
      let mejor = -1, dm = 24;
      lista().forEach((q, i) => { const d = Math.hypot(plano.sx(q.x[0]) - x, plano.sy(q.x[1]) - y); if (d < dm) { dm = d; mejor = i; } });
      if (mejor >= 0) { idx = mejor; selPt.valor = String(idx); dibujar(); }
    });
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(x, y)) return tipM.ocultar();
      const qx = plano.ix(x), qy = plano.iy(y);
      tipM.mostrar(x, y, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(FUN[clave].f(qx, qy), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tipM.ocultar());
    llenar();
    preparar();
    dibujar();
  }

  VIZ.registrarTema('stationary-points', {
    intro: String.raw`
      <p>Un <strong>punto estacionario</strong> de una función es un lugar donde la superficie es plana a primer orden: el gradiente vale cero y no hay
      ninguna dirección en la que f baje o suba «de inmediato». Allí pueden estar el fondo de un valle (mínimo), la cima de una colina (máximo) o
      un paso de montaña (punto de silla). Todo óptimo local sin restricciones es un punto estacionario, pero no al revés.</p>
      <p>Por eso resolver \(\nabla f(x)=0\) es el primer paso para optimizar, y clasificar lo que se encuentra es el segundo. Las funciones polinomiales
      permiten ver varios puntos de cada tipo en un mismo mapa; la primera figura los busca con el método de Newton y la segunda los examina desde
      todas las direcciones.</p>`,
    visualizaciones: [
      {
        titulo: 'Búsqueda de puntos con gradiente cero',
        descripcion: 'Haga clic en un punto inicial y ejecute Newton: converge a un punto con \\(\\nabla f = 0\\) y lo clasifica según los valores propios de la Hessiana. Marque «Mostrar todos» para comprobar cuántos hay (Himmelblau tiene nueve).',
        montar: montarBusqueda,
      },
      {
        titulo: 'Cortes por un punto estacionario',
        descripcion: 'Elija un punto y gire la dirección del corte. En un mínimo todas las curvas suben; en un punto de silla algunas suben y otras bajan, y todas son planas en \\(t = 0\\). Pruebe la silla del mono, donde la curvatura es nula en todas las direcciones.',
        montar: montarCortes,
      },
    ],
    teoria: String.raw`
      <h2>Definición y condición necesaria de primer orden</h2>
      <p>Sea \(f:\mathbb{R}^n\to\mathbb{R}\) diferenciable. Un punto \(x^*\) es <strong>estacionario</strong> (o crítico) si \(\nabla f(x^*) = 0\).</p>
      <div class="recuadro"><p><strong>Teorema (Fermat).</strong> Si \(x^*\) es un mínimo o máximo local de \(f\) y \(f\) es diferenciable en \(x^*\), entonces \(\nabla f(x^*)=0\).</p></div>
      <p><em>Demostración.</em> Si \(\nabla f(x^*)\ne 0\), la dirección \(d=-\nabla f(x^*)\) cumple \(\nabla f(x^*)\cdot d=-\|\nabla f(x^*)\|^2&lt;0\) y, por el desarrollo de
      Taylor, \(f(x^*+td)&lt;f(x^*)\) para \(t&gt;0\) pequeño: \(x^*\) no sería un mínimo local. Con \(-d\) se descarta el máximo. \(\square\)</p>
      <p>El recíproco es falso: \(f(x)=x^3\) tiene \(f'(0)=0\) sin ser extremo, y \(f(x,y)=x^2-y^2\) tiene un punto de silla en el origen.</p>

      <h2>Tipos de puntos estacionarios</h2>
      <table>
        <tr><th>Tipo</th><th>Comportamiento cerca de \(x^*\)</th><th>Hessiana \(H=\nabla^2 f(x^*)\)</th></tr>
        <tr><td>Mínimo local estricto</td><td>\(f(x)&gt;f(x^*)\) alrededor</td><td>\(H\succ 0\) (suficiente)</td></tr>
        <tr><td>Máximo local estricto</td><td>\(f(x)&lt;f(x^*)\) alrededor</td><td>\(H\prec 0\) (suficiente)</td></tr>
        <tr><td>Punto de silla</td><td>sube en unas direcciones y baja en otras</td><td>\(H\) indefinida</td></tr>
        <tr><td>Degenerado</td><td>depende de términos de orden superior</td><td>\(H\) singular (algún valor propio 0)</td></tr>
      </table>

      <h2>Ejemplos resueltos</h2>
      <p><strong>\(f(x,y)=x^3-3x+y^2\).</strong> El gradiente es \(\nabla f=(3x^2-3,\;2y)\), que se anula en \((1,0)\) y \((-1,0)\). La Hessiana es
      \(H=\operatorname{diag}(6x,\,2)\): en \((1,0)\) vale \(\operatorname{diag}(6,2)\succ0\) (mínimo local) y en \((-1,0)\) vale \(\operatorname{diag}(-6,2)\) (indefinida: silla).</p>
      <p><strong>\(f(x,y)=x^3-3x+y^3-3y\).</strong> Los puntos son \((\pm1,\pm1)\) con \(H=\operatorname{diag}(6x,6y)\): mínimo en \((1,1)\), máximo en \((-1,-1)\) y dos sillas en \((1,-1)\) y \((-1,1)\).
      Este «tablero» muestra los tres tipos a la vez.</p>
      <p><strong>Silla del mono \(f=x^3-3xy^2\).</strong> Solo hay el punto \((0,0)\), con \(\nabla f=(3x^2-3y^2,\,-6xy)=0\) y \(H(0,0)=0\): es degenerado, la prueba de segundo orden no concluye
      (la superficie tiene tres «valles» y tres «colinas» alrededor, de ahí su nombre).</p>
      <p><strong>Himmelblau.</strong> \(\nabla f=0\) es un sistema de dos ecuaciones cúbicas con nueve soluciones reales: cuatro mínimos (todos con \(f=0\)), un máximo local en
      \(\approx(-0.271,-0.923)\) y cuatro sillas. Las figuras lo comprueban numéricamente.</p>

      <h2>Cómo se buscan: el método de Newton</h2>
      <p>Resolver \(\nabla f(x)=0\) es un sistema no lineal; el método de Newton lo linealiza en cada iterado:</p>
      <pre><code>x ← x₀
mientras ‖∇f(x)‖ &gt; ε:
    resolver H(x) d = −∇f(x)
    x ← x + d
devolver x</code></pre>
      <p>Cerca de un punto estacionario con \(H\) no singular converge cuadráticamente, pero <em>no distingue</em> mínimos de máximos y sillas: va al punto estacionario más
      «atractivo» desde el punto inicial. Por eso la figura 1 clasifica el resultado después. Si \(H\) es singular (como en la silla del mono), la convergencia es solo lineal. Véase
      <a href="tema.html?id=unconstrained-optimality-conditions">condiciones de optimalidad sin restricciones</a>.</p>

      <h2>Conexiones</h2>
      <p>Los puntos estacionarios son los lugares donde el <a href="tema.html?id=gradients-directional-derivatives">gradiente</a> se anula; su carácter lo decide la
      <a href="tema.html?id=hessian-curvature">Hessiana</a>. En un <a href="tema.html?id=surfaces-contours">mapa de curvas de nivel</a> aparecen como centros de curvas cerradas (mínimo o máximo) o como
      cruces en «X» (silla).  Los algoritmos como el <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a> terminan en un punto estacionario, que puede ser una silla.</p>`,
  });
})();
