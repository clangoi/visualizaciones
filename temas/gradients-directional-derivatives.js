(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  // Formato con signo menos tipográfico (U+2212) y ceros numéricos limpios.
  const fm = (v, d) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v, d).replace(/-/g, '−');

  const FUN = {
    cuenco: { nombre: 'Cuenco inclinado', d: [-3, 3, -3, 3], p0: [1.6, 1.1], f: (x, y) => x * x + x * y + 2 * y * y },
    valle: { nombre: 'Valle curvo (banana)', d: [-2, 2, -1, 3], p0: [-1, 1.8], f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2 },
    silla: { nombre: 'Silla de montar', d: [-2, 2, -2, 2], p0: [1, 0.6], f: (x, y) => x * x - y * y },
    ondas: { nombre: 'Colinas y hoyos', d: [-3.2, 3.2, -3.2, 3.2], p0: [0.8, -0.4], f: (x, y) => 2 * Math.sin(x) * Math.sin(y) + 0.12 * (x * x + y * y) },
    himmelblau: { nombre: 'Cuatro valles (Himmelblau)', d: [-5, 5, -5, 5], p0: [1.2, 1.0], f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2 },
  };
  const OPC_FUN = Object.entries(FUN).map(([k, v]) => [k, v.nombre]);
  const grad = (f, p) => O.grad((q) => f(q[0], q[1]), p);

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

  /* ---------- Fig. 1: derivadas parciales y gradiente ---------- */

  function montarGradiente(cuerpo) {
    let clave = 'cuenco', P = FUN[clave].p0.slice(), gmax = 1, verParciales = true;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; P = FUN[v].p0.slice(); preparar(); dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar las componentes ∂f/∂x y ∂f/∂y', valor: verParciales, alCambiar: (v) => { verParciales = v; dibujar(); } });
    ctl.boton('Punto inicial', () => { P = FUN[clave].p0.slice(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'gradiente ∇f', forma: 'linea' },
      { color: C.s3, texto: '∂f/∂x', forma: 'linea' },
      { color: C.s4, texto: '∂f/∂y', forma: 'linea' },
      { color: C.s2, texto: 'curva de nivel que pasa por el punto', forma: 'linea' },
      { color: C.tinta, texto: 'punto elegido', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Cortes por el punto: la derivada parcial es la pendiente de cada corte');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 170, altoMax: 240 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'corte f(x, y₀) y su tangente', forma: 'linea' },
      { color: C.s4, texto: 'corte f(x₀, y) y su tangente', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre en el mapa para mover el punto. El gradiente (azul) siempre corta la curva naranja en ángulo recto y apunta hacia donde f crece más rápido.');

    function preparar() { mapa.preparar(FUN[clave]); gmax = gradMax(FUN[clave]); }

    function dibujar() {
      const def = FUN[clave], f = def.f;
      const { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      const g = grad(f, P), ng = Math.hypot(g[0], g[1]);
      const px = plano.sx(P[0]), py = plano.sy(P[1]);
      ctx.save();
      plano.recortar();
      VIZ.ml.contorno(ctx, plano, f, f(P[0], P[1]), { color: C.s2, ancho: 2.5, paso: 3 });
      const L = largoFlecha(ng, gmax), k = ng > 1e-9 ? L / ng : 0;
      if (verParciales && ng > 1e-9) {
        ctx.setLineDash([4, 3]);
        flecha(ctx, px, py, px + g[0] * k, py, C.s3, 2.5);
        flecha(ctx, px + g[0] * k, py, px + g[0] * k, py - g[1] * k, C.s4, 2.5);
        ctx.setLineDash([]);
      }
      if (ng > 1e-9) {
        flecha(ctx, px, py, px + g[0] * k, py - g[1] * k, C.s1, 3);
        // Marca de ángulo recto entre el gradiente y la tangente
        const ux = g[0] / ng, uy = -g[1] / ng, tx = -uy, ty = ux, r = 9;
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px + r * ux, py + r * uy);
        ctx.lineTo(px + r * (ux + tx), py + r * (uy + ty));
        ctx.lineTo(px + r * tx, py + r * ty);
        ctx.stroke();
      }
      VIZ.marcador(ctx, px, py, C.tinta, 5);
      ctx.restore();
      dibujarCortes(g);
      const ang = Math.atan2(g[1], g[0]) * 180 / Math.PI;
      registro.textContent = ng > 1e-6
        ? `En (${fm(P[0], 3)}, ${fm(P[1], 3)}) la función sube ${fm(Math.abs(g[0]), 3)} por unidad ${g[0] >= 0 ? 'hacia +x' : 'hacia −x'} y ${fm(Math.abs(g[1]), 3)} ${g[1] >= 0 ? 'hacia +y' : 'hacia −y'}; juntas dan el gradiente.`
        : 'El gradiente es (casi) nulo: el punto es estacionario y no hay dirección de máximo ascenso.';
      lectura.set([
        ['f(x, y)', fm(f(P[0], P[1]))],
        ['∂f/∂x', fm(g[0])],
        ['∂f/∂y', fm(g[1])],
        ['‖∇f‖', fm(ng)],
        ['ángulo de ∇f', ng > 1e-9 ? fm(ang, 4) + '°' : '—'],
      ]);
    }
    lienzo.alDibujar = () => { preparar(); dibujar(); };

    // Cortes unidimensionales
    let cortes = null;
    function dibujarCortes(g) {
      const def = FUN[clave], f = def.f, { ctx, ancho: W, alto: H } = lienzo2;
      lienzo2.limpiar();
      const mitad = W / 2;
      const mk = (i) => {
        const dom = i === 0 ? [def.d[0], def.d[1]] : [def.d[2], def.d[3]];
        const fn = i === 0 ? (t) => f(t, P[1]) : (t) => f(P[0], t);
        let lo = Infinity, hi = -Infinity;
        const pts = [];
        for (let k = 0; k <= 120; k++) { const t = dom[0] + ((dom[1] - dom[0]) * k) / 120; const v = fn(t); pts.push([t, v]); lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const q = (hi - lo) * 0.08 || 1;
        const margen = i === 0 ? { izq: 44, der: mitad + 8, sup: 22, inf: 26 } : { izq: mitad + 44, der: 10, sup: 22, inf: 26 };
        const p = VIZ.plano(lienzo2, { xmin: dom[0], xmax: dom[1], ymin: lo - q, ymax: hi + q }, { margen });
        return { p, pts, fn, dom, v0: i === 0 ? P[0] : P[1] };
      };
      cortes = [mk(0), mk(1)];
      const col = [C.s3, C.s4], pend = [g[0], g[1]], nom = ['f(x, y₀)', 'f(x₀, y)'];
      cortes.forEach((c, i) => {
        c.p.ejes();
        const { p } = c;
        ctx.save();
        p.recortar();
        VIZ.trazar(ctx, p, c.pts, col[i], 2);
        const v = c.fn(c.v0), s = (c.dom[1] - c.dom[0]) * 0.18;
        VIZ.trazar(ctx, p, [[c.v0 - s, v - pend[i] * s], [c.v0 + s, v + pend[i] * s]], C.tinta, 1.8, [4, 3]);
        VIZ.marcador(ctx, p.sx(c.v0), p.sy(v), C.tinta, 4.5);
        ctx.restore();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${nom[i]}   pendiente = ${fm(pend[i], 3)}`, p.x0 + 4, 4);
      });
      void H;
    }
    lienzo2.alDibujar = () => cortes && dibujar();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      if (!cortes) return;
      const { x, y } = lienzo2.posicion(ev);
      const i = cortes.findIndex((c) => c.p.dentro(x, y));
      if (i < 0) return tip2.ocultar();
      const c = cortes[i], t = c.p.ix(x);
      tip2.mostrar(x, y, `${i === 0 ? 'x' : 'y'} = <b>${fm(t, 3)}</b><br>f = <b>${fm(c.fn(t), 4)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());

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
      const f = FUN[clave].f, qx = plano.ix(x), qy = plano.iy(y), g = grad(f, [qx, qy]);
      tip.mostrar(x, y, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(f(qx, qy), 4)}</b><br>∇f = (<b>${fm(g[0], 3)}</b>, <b>${fm(g[1], 3)}</b>)`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    dibujar();
  }

  /* ---------- Fig. 2: derivada direccional ---------- */

  function montarDireccional(cuerpo) {
    let clave = 'cuenco', P = FUN[clave].p0.slice(), theta = 30, gmax = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; P = FUN[v].p0.slice(); preparar(); dibujar(); } });
    const rTheta = ctl.rango({ etiqueta: 'Dirección u (ángulo)', min: 0, max: 360, valor: theta, formato: (v) => v + '°', alCambiar: (v) => { theta = v; dibujar(); } });
    const angGrad = () => { const g = grad(FUN[clave].f, P); return ((Math.atan2(g[1], g[0]) * 180) / Math.PI + 360) % 360; };
    const fijar = (a) => { theta = Math.round(((a % 360) + 360) % 360); rTheta.valor = theta; dibujar(); };
    ctl.boton('Máximo ascenso (+∇f)', () => fijar(angGrad()), { primario: true });
    ctl.boton('Máximo descenso (−∇f)', () => fijar(angGrad() + 180));
    ctl.boton('Tangente a la curva (⊥ ∇f)', () => fijar(angGrad() + 90));

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'dirección u', forma: 'linea' },
      { color: C.s1, texto: 'gradiente ∇f', forma: 'linea' },
      { color: C.apagado, texto: 'círculo de direcciones unitarias', forma: 'linea' },
      { color: C.tinta, texto: 'punto elegido', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Derivada direccional según el ángulo de u');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 190, altoMax: 260 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'Dᵤf(θ) = ∇f · u', forma: 'linea' },
      { color: C.s6, texto: 'Dᵤf < 0: la función baja', forma: 'cuadro' },
      { color: C.s8, texto: 'Dᵤf > 0: la función sube', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el ángulo o use los botones. Dᵤf es máxima (= ‖∇f‖) en la dirección del gradiente, vale 0 sobre la tangente a la curva de nivel y es mínima en la dirección opuesta. Haga clic en el mapa para cambiar el punto.');

    function preparar() { mapa.preparar(FUN[clave]); gmax = gradMax(FUN[clave]); }
    let plano2 = null;
    function dibujar() {
      const def = FUN[clave], f = def.f, { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      const g = grad(f, P), ng = Math.hypot(g[0], g[1]);
      const a = (theta * Math.PI) / 180, u = [Math.cos(a), Math.sin(a)];
      const px = plano.sx(P[0]), py = plano.sy(P[1]), R = 62;
      ctx.save();
      plano.recortar();
      VIZ.ml.contorno(ctx, plano, f, f(P[0], P[1]), { color: C.tinta2, ancho: 1.8, paso: 3 });
      ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (ng > 1e-9) { const L = largoFlecha(ng, gmax); flecha(ctx, px, py, px + (g[0] / ng) * L, py - (g[1] / ng) * L, C.s1, 3); }
      flecha(ctx, px, py, px + R * u[0], py - R * u[1], C.s2, 3);
      VIZ.marcador(ctx, px, py, C.tinta, 5);
      ctx.restore();

      const Du = g[0] * u[0] + g[1] * u[1];
      const h = 1e-4, num = (f(P[0] + h * u[0], P[1] + h * u[1]) - f(P[0], P[1])) / h;
      const angRel = ng > 1e-9 ? ((theta - angGrad() + 540) % 360) - 180 : NaN;
      registro.textContent = ng < 1e-9 ? 'En un punto estacionario toda derivada direccional vale 0.'
        : Math.abs(Du) < 0.02 * ng ? 'u es casi tangente a la curva de nivel: f no cambia a primer orden.'
          : Du > 0 ? `u forma ${fm(Math.abs(angRel), 3)}° con el gradiente: al avanzar en u, f sube ${fm(Du, 3)} por unidad.`
            : `u forma ${fm(Math.abs(angRel), 3)}° con el gradiente: u es una dirección de descenso (f baja ${fm(-Du, 3)} por unidad).`;
      lectura.set([
        ['u', `(${fm(u[0], 3)}, ${fm(u[1], 3)})`],
        ['∇f · u', fm(Du)],
        ['(f(x+hu) − f(x))/h', fm(num)],
        ['‖∇f‖ (máximo posible)', fm(ng)],
        ['cociente Dᵤf / ‖∇f‖ = cos', ng > 1e-9 ? fm(Du / ng, 3) : '—'],
      ]);
      dibujarCurva(g, ng);
    }
    function dibujarCurva(g, ng) {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const M = Math.max(ng, 1e-6) * 1.2;
      plano2 = VIZ.plano(lienzo2, { xmin: 0, xmax: 360, ymin: -M, ymax: M }, { etiquetaX: 'θ (grados)', etiquetaY: 'Dᵤf', ticksX: [0, 45, 90, 135, 180, 225, 270, 315, 360] });
      const p = plano2;
      const D = (t) => g[0] * Math.cos((t * Math.PI) / 180) + g[1] * Math.sin((t * Math.PI) / 180);
      // Bandas de signo
      ctx.save();
      p.recortar();
      for (let t = 0; t < 360; t += 2) {
        const m = D(t + 1);
        ctx.fillStyle = VIZ.alfa(m < 0 ? C.s6 : C.s8, 0.1);
        ctx.fillRect(p.sx(t), p.y1, p.sx(t + 2) - p.sx(t) + 0.5, p.y0 - p.y1);
      }
      ctx.restore();
      p.ejes();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x0, p.sy(0) + 0.5); ctx.lineTo(p.x1, p.sy(0) + 0.5); ctx.stroke();
      const pts = [];
      for (let t = 0; t <= 360; t += 2) pts.push([t, D(t)]);
      VIZ.trazar(ctx, p, pts, C.s2, 2);
      VIZ.marcador(ctx, p.sx(theta), p.sy(D(theta)), C.s2, 5);
      if (ng > 1e-9) {
        const ag = angGrad();
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
        ctx.fillText('máx', p.sx(ag), p.sy(ng) - 3);
        ctx.textBaseline = 'top';
        ctx.fillText('mín', p.sx((ag + 180) % 360), p.sy(-ng) + 3);
      }
    }
    lienzo2.alDibujar = () => dibujar();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (!plano2 || !plano2.dentro(x, y)) return tip2.ocultar();
      const t = Math.round(plano2.ix(x)), g = grad(FUN[clave].f, P), r = (t * Math.PI) / 180;
      tip2.mostrar(x, y, `θ = <b>${t}°</b><br>Dᵤf = <b>${fm(g[0] * Math.cos(r) + g[1] * Math.sin(r), 3)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo2.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo2.posicion(ev);
      if (plano2 && plano2.dentro(x, y)) fijar(plano2.ix(x));
    });
    lienzo2.canvas.style.cursor = 'pointer';

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
      const f = FUN[clave].f, qx = plano.ix(x), qy = plano.iy(y);
      tip.mostrar(x, y, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(f(qx, qy), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    preparar();
    dibujar();
  }

  /* ---------- Fig. 3: direcciones de descenso y descenso más pronunciado ---------- */

  function montarDescenso(cuerpo) {
    let clave = 'cuenco', P0 = FUN[clave].p0.slice(), modo = 'pronunciado', theta = 200, t0 = 1, gmax = 1;
    let x = P0.slice(), tray = [], cur = null, msg = '', iter = 0, ensayos = 0;
    const C1 = 0.1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; P0 = FUN[v].p0.slice(); preparar(); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Dirección en cada paso', opciones: [['pronunciado', 'Máximo descenso (−∇f)'], ['fija', 'Dirección fija (ángulo)']], valor: modo, alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Ángulo de la dirección fija', min: 0, max: 360, valor: theta, formato: (v) => v + '°', alCambiar: (v) => { theta = v; if (modo === 'fija') rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Paso inicial t₀', min: 0.05, max: 4, paso: 0.05, valor: t0, formato: (v) => fm(v, 3), alCambiar: (v) => { t0 = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    ctl.boton('Punto inicial', () => { P0 = FUN[clave].p0.slice(); rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: alturaMapa });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    const mapa = crearMapa(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'direcciones de descenso (∇f · d < 0)', forma: 'cuadro' },
      { color: C.s1, texto: 'trayectoria (pasos aceptados)', forma: 'linea' },
      { color: C.s2, texto: 'dirección d del paso actual', forma: 'linea' },
      { color: C.s8, texto: 'ensayo rechazado (no cumple Armijo)', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Búsqueda lineal: φ(t) = f(x + t d) y la condición de Armijo');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.3, altoMin: 190, altoMax: 260 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'φ(t)', forma: 'linea' },
      { color: C.apagado, texto: 'recta de Armijo f(x) + c₁ t ∇f·d', forma: 'linea' },
      { color: C.s6, texto: 't aceptado', forma: 'punto' },
      { color: C.s8, texto: 't rechazado', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el mapa para elegir el punto inicial. Con «dirección fija», pruebe ángulos dentro y fuera del semicírculo verde: fuera de él, la dirección no baja y el algoritmo se detiene.');

    function preparar() { mapa.preparar(FUN[clave]); gmax = gradMax(FUN[clave]); }
    const F = (p) => FUN[clave].f(p[0], p[1]);

    // Dirección, pendiente y valor en el punto actual (sin probar todavía ningún paso).
    function preparar1() {
      const g = grad(FUN[clave].f, x), a = (theta * Math.PI) / 180;
      const d = modo === 'pronunciado' ? [-g[0], -g[1]] : [Math.cos(a), Math.sin(a)];
      return { x: x.slice(), d, s: g[0] * d[0] + g[1] * d[1], f0: F(x), t: null, ok: null, trial: null, g };
    }
    function iniciar() {
      x = P0.slice(); tray = [x.slice()]; iter = 0; ensayos = 0;
      cur = Math.hypot(...grad(FUN[clave].f, x)) < 1e-4 ? null : preparar1();
      msg = 'Punto inicial. En cada paso se prueba t₀ y se divide por 2 hasta que f baje lo que predice la recta de Armijo.';
      return (function* () {
        for (let k = 0; k < 80; k++) {
          const g = grad(FUN[clave].f, x), ng = Math.hypot(g[0], g[1]);
          if (ng < 1e-4) { cur = null; msg = `‖∇f‖ = ${fm(ng, 2)} ≈ 0: punto estacionario, el algoritmo termina.`; yield; return; }
          cur = preparar1();
          const { d, s, f0 } = cur;
          if (s >= -1e-9) { msg = `∇f·d = ${fm(s, 3)} ≥ 0: d no es dirección de descenso; no hay paso t que baje f a primer orden.`; yield; return; }
          let t = t0;
          for (;;) {
            const xn = [x[0] + t * d[0], x[1] + t * d[1]], fn = F(xn), ok = fn <= f0 + C1 * t * s;
            cur.t = t; cur.ok = ok; cur.trial = xn; ensayos++;
            msg = ok ? `t = ${fm(t, 3)}: f baja de ${fm(f0, 4)} a ${fm(fn, 4)} (≤ recta de Armijo): se acepta.`
              : `t = ${fm(t, 3)}: f(x + t d) = ${fm(fn, 4)} queda por encima de la recta de Armijo; se divide t entre 2.`;
            if (ok) { x = xn; tray.push(xn.slice()); iter++; yield; break; }
            yield;
            t /= 2;
            if (t < 1e-12) { msg = 'El paso se hizo demasiado pequeño: se detiene.'; return; }
          }
        }
      })();
    }
    function dibujar() {
      const def = FUN[clave], { ctx } = lienzo;
      const plano = mapa.base(def, clave);
      const base = cur ? cur.x : x;
      ctx.save();
      plano.recortar();
      const bx = plano.sx(base[0]), by = plano.sy(base[1]);
      if (cur) {
        // Semidisco de direcciones de descenso: {d : ∇f·d < 0}
        const ag = Math.atan2(-cur.g[1], cur.g[0]); // ángulo de ∇f en pantalla
        ctx.fillStyle = VIZ.alfa(C.s6, 0.2);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, 64, ag + Math.PI / 2, ag + (3 * Math.PI) / 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.s6; ctx.lineWidth = 1.5; ctx.stroke();
      }
      VIZ.trazar(ctx, plano, tray, VIZ.alfa(C.superficie, 0.85), 4.5);
      VIZ.trazar(ctx, plano, tray, C.s1, 2);
      tray.slice(0, -1).forEach(([qx, qy]) => VIZ.marcador(ctx, plano.sx(qx), plano.sy(qy), C.s1, 3));
      if (cur) {
        const nd = Math.hypot(cur.d[0], cur.d[1]), L = 60;
        flecha(ctx, bx, by, bx + (cur.d[0] / nd) * L, by - (cur.d[1] / nd) * L, C.s2, 3);
        if (cur.trial) {
          const tx = plano.sx(cur.trial[0]), ty = plano.sy(cur.trial[1]);
          if (!cur.ok) VIZ.marcador(ctx, tx, ty, C.s8, 4.5, 5);
        }
      }
      VIZ.marcador(ctx, plano.sx(x[0]), plano.sy(x[1]), C.tinta, 5.5);
      VIZ.marcador(ctx, plano.sx(P0[0]), plano.sy(P0[1]), C.tinta2, 3.5, 1);
      ctx.restore();
      registro.textContent = msg;
      const gnow = grad(FUN[clave].f, x);
      lectura.set([
        ['iteración', String(iter)],
        ['f(x)', fm(F(x))],
        ['‖∇f‖', fm(Math.hypot(gnow[0], gnow[1]), 3)],
        ['∇f · d', cur ? fm(cur.s, 3) : '—'],
        ['ensayos de t', String(ensayos)],
      ]);
      dibujarPhi();
    }
    let plano2 = null, datosPhi = null;
    function dibujarPhi() {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      datosPhi = null;
      if (!cur) {
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(msg.includes('no es dirección') ? 'd no es de descenso: φ′(0) ≥ 0' : 'sin búsqueda lineal en curso', lienzo2.ancho / 2, lienzo2.alto / 2);
        return;
      }
      const tmax = Math.max(t0, cur.t || t0) * 1.25;
      const phi = (t) => F([cur.x[0] + t * cur.d[0], cur.x[1] + t * cur.d[1]]);
      const arm = (t) => cur.f0 + C1 * t * cur.s;
      const pts = [];
      let lo = arm(tmax), mx = -Infinity;
      for (let k = 0; k <= 160; k++) { const t = (tmax * k) / 160, v = phi(t); pts.push([t, v]); lo = Math.min(lo, v); mx = Math.max(mx, v); }
      const span = Math.max(cur.f0 - lo, Math.abs(cur.s) * tmax * 0.1, 1e-9);
      const hi = Math.min(mx, cur.f0 + 2.5 * span);
      const q = (hi - lo) * 0.08 || 1;
      plano2 = VIZ.plano(lienzo2, { xmin: 0, xmax: tmax, ymin: lo - q, ymax: hi + q }, { etiquetaX: 't', etiquetaY: 'φ(t)' });
      plano2.ejes();
      ctx.save();
      plano2.recortar();
      VIZ.trazar(ctx, plano2, pts, C.s1, 2);
      VIZ.trazar(ctx, plano2, [[0, arm(0)], [tmax, arm(tmax)]], C.apagado, 1.5, [4, 3]);
      if (cur.t != null) VIZ.marcador(ctx, plano2.sx(cur.t), plano2.sy(phi(cur.t)), cur.ok ? C.s6 : C.s8, 5);
      ctx.restore();
      datosPhi = { phi, arm };
    }
    lienzo2.alDibujar = () => dibujar();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo2.posicion(ev);
      if (!datosPhi || !plano2 || !plano2.dentro(mx, my)) return tip2.ocultar();
      const t = plano2.ix(mx);
      tip2.mostrar(mx, my, `t = <b>${fm(t, 3)}</b><br>φ(t) = <b>${fm(datosPhi.phi(t), 4)}</b><br>Armijo = ${fm(datosPhi.arm(t), 4)}`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());

    lienzo.canvas.addEventListener('click', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(mx, my)) return;
      P0 = [plano.ix(mx), plano.iy(my)];
      rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x: mx, y: my } = lienzo.posicion(ev), plano = mapa.plano;
      if (!plano || !plano.dentro(mx, my)) return tip.ocultar();
      const qx = plano.ix(mx), qy = plano.iy(my), g = grad(FUN[clave].f, [qx, qy]);
      tip.mostrar(mx, my, `(${fm(qx, 3)}, ${fm(qy, 3)})<br>f = <b>${fm(FUN[clave].f(qx, qy), 4)}</b><br>∇f = (${fm(g[0], 3)}, ${fm(g[1], 3)})`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.alDibujar = () => { preparar(); dibujar(); };
    preparar();
    rep.reiniciar();
  }

  VIZ.registrarTema('gradients-directional-derivatives', {
    intro: String.raw`
      <p>En una variable, la derivada dice cuánto cambia la función al dar un paso a la derecha. En dos o más variables hay infinitas
      direcciones posibles, y la pregunta natural es: <em>¿en qué dirección conviene moverse?</em> El <strong>gradiente</strong>
      \(\nabla f\) reúne las derivadas parciales en un vector y responde: apunta hacia donde la función crece más rápido, y es siempre
      perpendicular a la curva de nivel que pasa por el punto.</p>
      <p>De ahí sale la idea central de la optimización sin restricciones: para <em>bajar</em> hay que moverse en una dirección que forme
      un ángulo mayor que 90° con el gradiente. La más pronunciada es \(-\nabla f\), pero hay todo un semiplano de direcciones de descenso.
      Las tres figuras muestran las derivadas parciales, la derivada direccional y un descenso con búsqueda lineal.</p>`,
    visualizaciones: [
      {
        titulo: 'Derivadas parciales y gradiente',
        descripcion: 'Cada derivada parcial es la pendiente de un corte de la superficie (gráfico inferior). Mueva el punto y compruebe que el vector azul \\(\\nabla f\\) es perpendicular a la curva naranja; en el fondo del cuenco se encoge a cero.',
        montar: montarGradiente,
      },
      {
        titulo: 'Derivada direccional',
        descripcion: 'Gire la dirección \\(u\\) y vea cómo \\(D_u f = \\nabla f \\cdot u\\) dibuja una sinusoide de amplitud \\(\\|\\nabla f\\|\\). Pruebe los tres botones: máximo ascenso, máximo descenso y la tangente a la curva (\\(D_u f = 0\\)).',
        montar: montarDireccional,
      },
      {
        titulo: 'Direcciones de descenso y búsqueda lineal',
        descripcion: 'El semicírculo verde reúne las direcciones con \\(\\nabla f \\cdot d < 0\\). Ejecute el descenso más pronunciado con búsqueda lineal de Armijo y observe cómo se acepta o se rechaza cada paso \\(t\\); luego pruebe una dirección fija fuera del semicírculo.',
        montar: montarDescenso,
      },
    ],
    teoria: String.raw`
      <h2>Derivadas parciales y gradiente</h2>
      <p>Para \(f:\mathbb{R}^n\to\mathbb{R}\) diferenciable, la derivada parcial respecto de \(x_i\) es la derivada de la función de una variable que se obtiene
      fijando las demás coordenadas, y el <strong>gradiente</strong> es el vector de todas ellas:</p>
      \[ \frac{\partial f}{\partial x_i}(x) = \lim_{h\to 0}\frac{f(x + h e_i) - f(x)}{h}, \qquad \nabla f(x) = \left(\frac{\partial f}{\partial x_1}, \dots, \frac{\partial f}{\partial x_n}\right). \]
      <p>Cuando no se tiene una fórmula, se aproxima con diferencias centrales: \(\partial_i f(x) \approx \dfrac{f(x + h e_i) - f(x - h e_i)}{2h}\), con error \(O(h^2)\).
      Es lo que calculan las figuras (con \(h = 10^{-5}\)).</p>

      <h2>Derivada direccional</h2>
      <p>Para un vector unitario \(u\) (\(\|u\| = 1\)), la derivada direccional es la derivada de \(\varphi(t) = f(x + t u)\) en \(t = 0\). Si \(f\) es diferenciable, la regla de la cadena da</p>
      \[ D_u f(x) = \varphi'(0) = \nabla f(x)\cdot u = \|\nabla f(x)\|\cos\theta, \]
      <p>donde \(\theta\) es el ángulo entre \(u\) y \(\nabla f(x)\). Por tanto \(D_u f\) es máxima (\(= \|\nabla f\|\)) cuando \(\theta = 0\), mínima (\(= -\|\nabla f\|\)) cuando
      \(\theta = \pi\), y nula cuando \(u \perp \nabla f\), es decir, al moverse a lo largo de la curva de nivel. Esa es la sinusoide de la figura 2.</p>

      <h2>El gradiente es perpendicular a las curvas de nivel</h2>
      <p>Sea \(\gamma(t)\) una curva dentro de \(\{f = c\}\). Entonces \(f(\gamma(t)) = c\) y, derivando, \(\nabla f(\gamma(t))\cdot\gamma'(t) = 0\): el gradiente es
      ortogonal a todo vector tangente de la curva. Además, \(\nabla f\) apunta hacia el lado donde \(f\) aumenta.</p>

      <h2>Direcciones de descenso</h2>
      <div class="recuadro"><p>Si \(\nabla f(x)\cdot d &lt; 0\), existe \(\bar t&gt;0\) tal que \(f(x + t d) &lt; f(x)\) para todo \(t\in(0,\bar t)\). Entonces \(d\) es una <strong>dirección de descenso</strong>.</p></div>
      <p>Se prueba con el desarrollo de Taylor: \(f(x + td) = f(x) + t\,\nabla f(x)\cdot d + o(t)\), y el término lineal es negativo. Las direcciones de descenso forman un
      semiespacio abierto; entre ellas, la de máximo descenso (normalizada) es \(-\nabla f/\|\nabla f\|\), porque minimiza \(\nabla f\cdot u\) con \(\|u\|=1\) (desigualdad de Cauchy–Schwarz).
      Si \(\nabla f(x)=0\) no hay dirección de descenso de primer orden: es un punto estacionario.</p>

      <h2>Algoritmo: descenso con búsqueda lineal de Armijo</h2>
      <pre><code>x ← x₀
repetir mientras ‖∇f(x)‖ &gt; ε:
    d ← −∇f(x)                  (o cualquier d con ∇f(x)·d &lt; 0)
    t ← t₀
    mientras f(x + t d) &gt; f(x) + c₁ t ∇f(x)·d:
        t ← t / 2
    x ← x + t d</code></pre>
      <p>La condición de Armijo exige que f baje al menos una fracción \(c_1\in(0,1)\) de lo que predice la tangente (la recta punteada de la figura 3). Como \(\varphi'(0) &lt; 0\),
      siempre existe un \(t\) que la cumple, así que el bucle interno termina. Con la dirección \(-\nabla f\) y pasos de Armijo, todo punto límite es estacionario.
      Con una dirección fija, el método se detiene cuando el gradiente se vuelve perpendicular a ella (\(\nabla f\cdot d \ge 0\)), que no es un óptimo salvo por casualidad.</p>

      <h2>Conexiones</h2>
      <p>El mapa de curvas de nivel se explica en <a href="tema.html?id=surfaces-contours">Superficies y curvas de nivel</a>. Donde \(\nabla f = 0\) comienzan los
      <a href="tema.html?id=stationary-points">puntos estacionarios</a>; la curvatura que decide si son mínimos viene de la
      <a href="tema.html?id=hessian-curvature">Hessiana</a>. Una versión de este algoritmo con más variantes es el <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a>.</p>`,
  });
})();
