(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;
  // Formato con signo menos tipográfico (U+2212) y ceros numéricos limpios.
  const fm = (v, d) => VIZ.fmt(Math.abs(v) < 1e-12 ? 0 : v, d).replace(/-/g, '−');

  /* Funciones de dos variables: nombre, dominio [xmin, xmax, ymin, ymax], punto inicial. */
  const FUN = {
    cuenco: { nombre: 'Cuenco elíptico', d: [-3, 3, -3, 3], p0: [1.6, 1.0], f: (x, y) => x * x + 3 * y * y },
    valle: { nombre: 'Valle curvo (banana)', d: [-2, 2, -1, 3], p0: [-1, 1.8], f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2 },
    silla: { nombre: 'Silla de montar', d: [-2, 2, -2, 2], p0: [1, 0.6], f: (x, y) => x * x - y * y },
    meseta: { nombre: 'Meseta con muro circular', d: [-4, 4, -4, 4], p0: [1.7, 0.5], f: (x, y) => 4 / (1 + Math.exp(-3 * (Math.hypot(x, y) - 2))) },
    ondas: { nombre: 'Colinas y hoyos', d: [-3.2, 3.2, -3.2, 3.2], p0: [0.8, -0.4], f: (x, y) => 2 * Math.sin(x) * Math.sin(y) + 0.12 * (x * x + y * y) },
    himmelblau: { nombre: 'Cuatro valles (Himmelblau)', d: [-5, 5, -5, 5], p0: [1.2, 1.0], f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2 },
  };
  const OPC_FUN = Object.entries(FUN).map(([k, v]) => [k, v.nombre]);

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

  /* ---------- Fig. 1: superficie 3-D proyectada ---------- */

  function montarSuperficie(cuerpo) {
    let clave = 'cuenco', az = 35, el = 38, nivelT = 0.5, hover = null;
    let datos = null; // { m, lo, hi }
    const N = 30;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; preparar(); dibujar(); } });
    const rAz = ctl.rango({ etiqueta: 'Giro (azimut)', min: -180, max: 180, valor: az, formato: (v) => v + '°', alCambiar: (v) => { az = v; dibujar(); } });
    const rEl = ctl.rango({ etiqueta: 'Elevación', min: 5, max: 85, valor: el, formato: (v) => v + '°', alCambiar: (v) => { el = v; dibujar(); } });
    const rNivel = ctl.rango({ etiqueta: 'Nivel c de la curva', min: 0, max: 100, valor: nivelT * 100, formato: (v) => (datos ? fm(nivelDe(v / 100)) : ''), alCambiar: (v) => { nivelT = v / 100; dibujar(); } });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.touchAction = 'pan-y';
    lienzo.canvas.style.cursor = 'grab';
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.1)), texto: 'altura baja' },
      { color: VIZ.css(VIZ.enRampa(0.95)), texto: 'altura alta' },
      { color: C.s2, texto: 'curva de nivel f = c (sobre la superficie y en la base)', forma: 'linea' },
      { color: C.s1, texto: 'punto bajo el cursor y su sombra en la base', forma: 'punto' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre la superficie para girarla (o use los controles) y pase el cursor para ver la altura. Mueva «Nivel c» y compare la curva naranja con su sombra en la base.');

    const nivelDe = (t) => datos.lo + (datos.hi - datos.lo) * t;
    function preparar() {
      const def = FUN[clave];
      const m = muestras(def.f, def.d, 40);
      datos = { m, lo: m.q(0.02), hi: m.q(0.98), def };
      rNivel.refrescar();
    }
    const zMap = (z) => ((Math.min(datos.hi, Math.max(datos.lo, z)) - datos.lo) / (datos.hi - datos.lo || 1) - 0.5) * 1.3;
    const ZBASE = -1.05;
    let polis = [];

    function dibujar() {
      if (!datos) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const { def } = datos, [x0, x1, y0, y1] = def.d;
      const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
      const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
      const proj = (X, Y, Z) => { const xr = X * ca - Y * sa, yr = X * sa + Y * ca; return [xr, Z * ce + yr * se, yr * ce - Z * se]; };
      let hmin = Infinity, hmax = -Infinity, vmin = Infinity, vmax = -Infinity;
      for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [ZBASE, 0.65]) {
        const [h, v] = proj(X, Y, Z);
        hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
      }
      const S = Math.min((W - 30) / (hmax - hmin), (H - 30) / (vmax - vmin));
      const ox = W / 2 - (S * (hmin + hmax)) / 2, oy = H / 2 + (S * (vmin + vmax)) / 2;
      const pt = (X, Y, Z) => { const [h, v, dp] = proj(X, Y, Z); return [ox + S * h, oy - S * v, dp]; };
      const XY = (i, j) => [-1 + (2 * i) / N, 1 - (2 * j) / N]; // i: x creciente; j: y decreciente (fila superior = ymax)
      const gx = (X) => x0 + ((X + 1) / 2) * (x1 - x0), gy = (Y) => y0 + ((Y + 1) / 2) * (y1 - y0);
      const c = nivelDe(nivelT);

      // Base: marco, rejilla ligera y sombra de la curva de nivel
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.eje;
      ctx.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([X, Y], k) => { const [px, py] = pt(X, Y, ZBASE); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = C.rejilla;
      for (let k = 1; k < 6; k++) {
        const u = -1 + (2 * k) / 6;
        ctx.beginPath(); let p1 = pt(u, -1, ZBASE), p2 = pt(u, 1, ZBASE); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
        p1 = pt(-1, u, ZBASE); p2 = pt(1, u, ZBASE); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }

      // Valores en los vértices
      const val = Array.from({ length: N + 1 }, (_, i) => Array.from({ length: N + 1 }, (_, j) => { const [X, Y] = XY(i, j); return def.f(gx(X), gy(Y)); }));
      const segs = (i, j, alt) => { // cruces de la curva f = c en la celda (i, j)
        const vs = [val[i][j], val[i + 1][j], val[i + 1][j + 1], val[i][j + 1]];
        const cs = [XY(i, j), XY(i + 1, j), XY(i + 1, j + 1), XY(i, j + 1)];
        const out = [];
        for (let k = 0; k < 4; k++) {
          const va = vs[k], vb = vs[(k + 1) % 4];
          if ((va > c) !== (vb > c)) {
            const t = (c - va) / (vb - va);
            const A = cs[k], B = cs[(k + 1) % 4];
            out.push(pt(A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), alt));
          }
        }
        return out;
      };
      // Sombra en la base
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const s = segs(i, j, ZBASE);
        for (let k = 0; k + 1 < s.length; k += 2) { ctx.moveTo(s[k][0], s[k][1]); ctx.lineTo(s[k + 1][0], s[k + 1][1]); }
      }
      ctx.stroke(); ctx.setLineDash([]);

      // Superficie: celdas de atrás hacia adelante; la curva se dibuja sobre su celda
      const celdas = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const es = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const P = es.map(([ii, jj]) => { const [X, Y] = XY(ii, jj); return pt(X, Y, zMap(val[ii][jj])); });
        const zm = (val[i][j] + val[i + 1][j] + val[i + 1][j + 1] + val[i][j + 1]) / 4;
        celdas.push({ i, j, P, zm, dp: (P[0][2] + P[1][2] + P[2][2] + P[3][2]) / 4 });
      }
      celdas.sort((p, q) => q.dp - p.dp);
      polis = [];
      ctx.lineJoin = 'round';
      for (const ce_ of celdas) {
        const { P } = ce_;
        ctx.beginPath();
        P.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.fillStyle = VIZ.css(VIZ.enRampa((zMap(ce_.zm) + 0.65) / 1.3));
        ctx.fill();
        ctx.strokeStyle = VIZ.alfa(C.sobre, 0.55); ctx.lineWidth = 0.6; ctx.stroke();
        const s = segs(ce_.i, ce_.j, zMap(c));
        if (s.length >= 2) {
          ctx.strokeStyle = C.s2; ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (let k = 0; k + 1 < s.length; k += 2) { ctx.moveTo(s[k][0], s[k][1]); ctx.lineTo(s[k + 1][0], s[k + 1][1]); }
          ctx.stroke();
        }
        polis.push(ce_);
      }

      // Cursor
      let lec = null;
      if (hover) {
        const { i, j } = hover;
        const [X, Y] = [(XY(i, j)[0] + XY(i + 1, j + 1)[0]) / 2, (XY(i, j)[1] + XY(i + 1, j + 1)[1]) / 2];
        const zv = def.f(gx(X), gy(Y));
        const top = pt(X, Y, zMap(zv)), base = pt(X, Y, ZBASE);
        ctx.strokeStyle = C.s1; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(base[0], base[1]); ctx.stroke(); ctx.setLineDash([]);
        VIZ.marcador(ctx, base[0], base[1], C.s1, 4);
        VIZ.marcador(ctx, top[0], top[1], C.s1, 5);
        lec = { x: gx(X), y: gy(Y), z: zv };
      }
      lectura.set([
        ['función', def.nombre],
        ['nivel c', fm(c)],
        ['rango de f', `${fm(datos.m.q(0))} a ${fm(datos.m.q(1))}`],
        ['bajo el cursor', lec ? `f(${fm(lec.x, 3)}, ${fm(lec.y, 3)}) = ${fm(lec.z, 4)}` : '—'],
        ['relación con c', lec ? (Math.abs(lec.z - c) < (datos.hi - datos.lo) * 0.02 ? 'sobre la curva' : lec.z > c ? 'por encima de c' : 'por debajo de c') : '—'],
      ]);
    }

    const dentro = (P, x, y) => {
      let r = false;
      for (let a = 0, b = 3; a < 4; b = a++) {
        if ((P[a][1] > y) !== (P[b][1] > y) && x < ((P[b][0] - P[a][0]) * (y - P[a][1])) / (P[b][1] - P[a][1]) + P[a][0]) r = !r;
      }
      return r;
    };
    let arrastre = null;
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      arrastre = { x: ev.clientX, y: ev.clientY, az, el, tipo: ev.pointerType };
      lienzo.canvas.setPointerCapture(ev.pointerId);
      lienzo.canvas.style.cursor = 'grabbing';
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = null; lienzo.canvas.style.cursor = 'grab'; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (arrastre) {
        az = Math.max(-180, Math.min(180, arrastre.az + (ev.clientX - arrastre.x) * 0.5));
        if (arrastre.tipo !== 'touch') el = Math.max(5, Math.min(85, arrastre.el - (ev.clientY - arrastre.y) * 0.4));
        az = Math.round(az); el = Math.round(el);
        rAz.valor = az;
        rEl.valor = el;
        dibujar();
        tip.ocultar();
        return;
      }
      const { x, y } = lienzo.posicion(ev);
      let h = null;
      for (let k = polis.length - 1; k >= 0; k--) if (dentro(polis[k].P, x, y)) { h = polis[k]; break; }
      hover = h;
      dibujar();
      if (!h) return tip.ocultar();
      const def = FUN[clave], [x0, x1, y0, y1] = def.d;
      const X = (-1 + (2 * (h.i + 0.5)) / N + 1) / 2, Y = (1 - (2 * (h.j + 0.5)) / N + 1) / 2;
      const px = x0 + X * (x1 - x0), py = y0 + Y * (y1 - y0);
      tip.mostrar(x, y, `x = <b>${fm(px, 3)}</b>, y = <b>${fm(py, 3)}</b><br>f = <b>${fm(def.f(px, py), 4)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.alDibujar = dibujar;
    preparar();
    dibujar();
  }

  /* ---------- Fig. 2: mapa de curvas de nivel y pendiente ---------- */

  function montarMapa(cuerpo) {
    let clave = 'cuenco', nN = 10, espaciado = 'igual';
    let P = FUN[clave].p0.slice(), m = null, img = null, capa = null, claveCapa = '', plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: OPC_FUN, valor: clave, alCambiar: (v) => { clave = v; P = FUN[v].p0.slice(); preparar(); dibujar(); } });
    ctl.rango({ etiqueta: 'Número de niveles', min: 4, max: 24, valor: nN, alCambiar: (v) => { nN = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Espaciado de niveles', opciones: [['igual', 'Igual en f'], ['cuadratico', 'Cuadrático (más juntos en la base)']], valor: espaciado, alCambiar: (v) => { espaciado = v; dibujar(); } });
    ctl.boton('Punto inicial', () => { P = FUN[clave].p0.slice(); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(280, Math.min(520, w * 0.85)) });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'crosshair';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'curvas de nivel', forma: 'linea' },
      { color: C.s1, texto: 'nivel inmediatamente inferior', forma: 'linea' },
      { color: C.s2, texto: 'nivel inmediatamente superior', forma: 'linea' },
      { color: C.tinta, texto: 'punto elegido y separación medida', forma: 'punto' },
      { color: VIZ.rampaGris[5], texto: 'f alta (fondo más oscuro)' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para elegir un punto. Donde las curvas se juntan, la pendiente ‖∇f‖ es grande; donde se separan (meseta, fondo del valle), es pequeña.');

    function preparar() {
      const def = FUN[clave];
      m = muestras(def.f, def.d, 100);
      img = imagenGris(m);
      claveCapa = '';
    }
    const niveles = () => {
      const lo = m.q(0.03), hi = m.q(0.97);
      return Array.from({ length: nN }, (_, k) => {
        const u = (k + 0.5) / nN;
        return lo + (hi - lo) * (espaciado === 'igual' ? u : u * u);
      });
    };
    // Distancia hasta alcanzar `nivel` partiendo de P en la dirección unitaria u.
    function distancia(f, u, nivel, sentido, tmax) {
      const g = (t) => f(P[0] + sentido * t * u[0], P[1] + sentido * t * u[1]) - nivel;
      const f0 = g(0);
      const paso = tmax / 600;
      let a = 0;
      for (let t = paso; t <= tmax; t += paso) {
        if ((g(t) > 0) !== (f0 > 0)) {
          let lo = a, hi = t;
          for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; ((g(mid) > 0) === (f0 > 0)) ? (lo = mid) : (hi = mid); }
          return (lo + hi) / 2;
        }
        a = t;
      }
      return NaN;
    }

    function dibujar() {
      if (!m) return;
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const def = FUN[clave], f = def.f;
      plano = planoIgual(lienzo, def.d);
      plano.ejes();
      const lv = niveles();
      const k2 = `${W}x${H}|${clave}|${nN}|${espaciado}`;
      if (k2 !== claveCapa) { capa = capaMapa(lienzo, plano, f, img, lv); claveCapa = k2; }
      ctx.drawImage(capa, 0, 0, W, H);

      const fP = f(P[0], P[1]), g = O.grad((x) => f(x[0], x[1]), P), ng = Math.hypot(g[0], g[1]);
      let inf = null, sup = null;
      lv.forEach((n) => { if (n <= fP) inf = n; else if (sup === null) sup = n; });
      ctx.save();
      plano.recortar();
      if (inf !== null) VIZ.ml.contorno(ctx, plano, f, inf, { color: C.s1, ancho: 2.5, paso: 3 });
      if (sup !== null) VIZ.ml.contorno(ctx, plano, f, sup, { color: C.s2, ancho: 2.5, paso: 3 });
      let medida = NaN, predicha = NaN;
      if (ng > 1e-9) {
        const u = [g[0] / ng, g[1] / ng];
        const diag = Math.hypot(def.d[1] - def.d[0], def.d[3] - def.d[2]);
        const t1 = sup !== null ? distancia(f, u, sup, 1, diag) : NaN, t0 = inf !== null ? distancia(f, u, inf, -1, diag) : NaN;
        if (Number.isFinite(t1) && Number.isFinite(t0)) {
          medida = t0 + t1;
          predicha = (sup - inf) / ng;
          const A = [plano.sx(P[0] - t0 * u[0]), plano.sy(P[1] - t0 * u[1])], B = [plano.sx(P[0] + t1 * u[0]), plano.sy(P[1] + t1 * u[1])];
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
          VIZ.marcador(ctx, A[0], A[1], C.s1, 3.5); VIZ.marcador(ctx, B[0], B[1], C.s2, 3.5);
        }
        flecha(ctx, plano.sx(P[0]), plano.sy(P[1]), plano.sx(P[0]) + 34 * u[0], plano.sy(P[1]) - 34 * u[1], C.tinta, 2);
      }
      VIZ.marcador(ctx, plano.sx(P[0]), plano.sy(P[1]), C.tinta, 5);
      ctx.restore();
      lectura.set([
        ['f en el punto', fm(fP)],
        ['niveles vecinos', `${inf !== null ? fm(inf, 3) : '—'} ≤ f < ${sup !== null ? fm(sup, 3) : '—'}`],
        ['pendiente ‖∇f‖', fm(ng, 3)],
        ['separación medida', Number.isFinite(medida) ? fm(medida, 3) : '—'],
        ['Δf / ‖∇f‖', Number.isFinite(predicha) ? fm(predicha, 3) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    let arrastre = false;
    const poner = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return;
      P = [plano.ix(x), plano.iy(y)];
      dibujar();
    };
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arrastre = true; lienzo.canvas.setPointerCapture(ev.pointerId); poner(ev); });
    lienzo.canvas.addEventListener('pointerup', () => { arrastre = false; });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastre) poner(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const f = FUN[clave].f, px = plano.ix(x), py = plano.iy(y), g = O.grad((q) => f(q[0], q[1]), [px, py]);
      tip.mostrar(x, y, `(${fm(px, 3)}, ${fm(py, 3)})<br>f = <b>${fm(f(px, py), 4)}</b><br>‖∇f‖ = <b>${fm(Math.hypot(g[0], g[1]), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    preparar();
    dibujar();
  }

  VIZ.registrarTema('surfaces-contours', {
    intro: String.raw`
      <p>Una función de dos variables \(f(x, y)\) se puede ver como una <strong>superficie</strong>: sobre cada punto del plano se levanta
      una altura \(f(x,y)\). Optimizar es buscar el punto más bajo (o más alto) de esa superficie, así que conviene saber leerla:
      dónde hay valles, colinas, mesetas y pasos de montaña.</p>
      <p>Como una superficie es incómoda de dibujar en papel, se la resume con un <strong>mapa de curvas de nivel</strong>: cada curva une
      los puntos con la misma altura, igual que en un mapa topográfico. Curvas muy juntas significan pendiente fuerte; curvas
      separadas, terreno casi plano. Las dos figuras muestran la misma idea desde ángulos distintos.</p>`,
    visualizaciones: [
      {
        titulo: 'Superficie en 3-D y su curva de nivel',
        descripcion: 'Una malla proyectada de \\(z = f(x,y)\\). La curva naranja es el conjunto \\(f = c\\): sobre la superficie y, punteada, su sombra en la base. Gire la superficie, cambie \\(c\\) y observe que en un cuenco la curva se encoge hasta un punto al bajar \\(c\\).',
        montar: montarSuperficie,
      },
      {
        titulo: 'Mapa de curvas de nivel y pendiente',
        descripcion: 'Elija un punto: la figura mide la distancia entre las curvas vecinas a lo largo del gradiente y la compara con \\(\\Delta f / \\|\\nabla f\\|\\). Pruebe la «meseta»: en el centro y lejos del muro las curvas casi desaparecen porque el gradiente es pequeño.',
        montar: montarMapa,
      },
    ],
    teoria: String.raw`
      <h2>Superficie y conjuntos de nivel</h2>
      <p>La <em>gráfica</em> de \(f:\mathbb{R}^2 \to \mathbb{R}\) es la superficie \(\{(x, y, f(x,y))\}\subset\mathbb{R}^3\). El <em>conjunto de nivel</em> \(c\) es</p>
      \[ L_c = \{(x,y) : f(x,y) = c\}, \]
      <p>la «rebanada» que se obtiene al cortar la superficie con el plano horizontal \(z = c\) y proyectarla a la base. El conjunto de
      <em>subnivel</em> \(\{f \le c\}\) es la región bajo esa curva; en optimización, los óptimos locales son los lugares donde esos
      subniveles aparecen (mínimos) o desaparecen (máximos) al variar \(c\).</p>

      <h2>Cómo se lee un mapa de curvas de nivel</h2>
      <ul>
        <li><strong>Mínimo o máximo local:</strong> curvas cerradas que se encogen hasta un punto (el cuenco de la figura 1).</li>
        <li><strong>Valle o cresta:</strong> curvas alargadas; la banana de Rosenbrock tiene un fondo curvo y estrecho.</li>
        <li><strong>Punto de silla:</strong> curvas con forma de hipérbola que se cruzan en una «X»; sube en una dirección y baja en otra.</li>
        <li><strong>Meseta:</strong> zona con curvas muy separadas, donde \(\nabla f \approx 0\) pero no hay un óptimo.</li>
      </ul>

      <h2>Separación de curvas y pendiente</h2>
      <p>Si dos curvas consecutivas están a alturas \(c\) y \(c + \Delta\), la distancia \(h\) entre ellas medida a lo largo del gradiente cumple, por el
      desarrollo de Taylor de primer orden,</p>
      \[ \Delta \approx \|\nabla f(x)\|\, h \quad\Longrightarrow\quad h \approx \frac{\Delta}{\|\nabla f(x)\|}. \]
      <p>La separación es inversamente proporcional a la pendiente. Por eso la segunda figura compara la distancia medida con
      \(\Delta f/\|\nabla f\|\): coinciden cuando las curvas están lo bastante cerca para que la superficie sea casi un plano.</p>

      <h2>Escala y elección de los niveles</h2>
      <p>El aspecto de un mapa depende de cómo se eligen los niveles: con niveles igualmente espaciados en \(f\), la separación visual
      refleja la pendiente real; con niveles espaciados cuadráticamente se ven más detalles cerca del mínimo. Tampoco son
      comparables dos mapas con distinta escala en los ejes: para que el gradiente se vea perpendicular a las curvas, ambos ejes deben tener
      la misma escala, como en la segunda figura.</p>

      <h2>Conexiones</h2>
      <p>La dirección perpendicular a las curvas es el gradiente: véase <a href="tema.html?id=gradients-directional-derivatives">Gradientes y derivadas direccionales</a>.
      Los puntos donde las curvas degeneran en un punto o una «X» son los <a href="tema.html?id=stationary-points">puntos estacionarios</a>, y su
      forma local la describe la <a href="tema.html?id=hessian-curvature">Hessiana</a>. Los algoritmos como el
      <a href="tema.html?id=descenso-gradiente">descenso de gradiente</a> recorren estos mapas perpendicularmente a las curvas.</p>`,
  });
})();
