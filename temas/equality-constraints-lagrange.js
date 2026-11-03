(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  /* ---------- Ayudantes ---------- */

  const prod = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm = (a) => Math.hypot(a[0], a[1]);
  const cruz = (a, b) => a[0] * b[1] - a[1] * b[0];
  const ptos = (v) => `(${VIZ.fmt(v[0], 3)}, ${VIZ.fmt(v[1], 3)})`;
  const grados = (r) => ((r * 180) / Math.PI + 360) % 360;

  // Plano con la misma escala en ambos ejes (para que los ángulos se vean bien).
  function planoIgual(l, cx, cy, semi) {
    const m = { izq: 36, der: 12, sup: 12, inf: 26 };
    const pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw, ph) / (2 * semi);
    const hx = pw / (2 * s), hy = ph / (2 * s);
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen: m });
  }
  // Flecha en píxeles desde (x, y) con desplazamiento (dx, dy).
  function flecha(ctx, x, y, dx, dy, color, ancho = 2.5) {
    const L = Math.hypot(dx, dy);
    if (L < 2) return;
    const a = Math.atan2(dy, dx), c = Math.min(10, L * 0.5), x1 = x + dx, y1 = y + dy;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1 - Math.cos(a) * c * 0.6, y1 - Math.sin(a) * c * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - c * Math.cos(a - 0.4), y1 - c * Math.sin(a - 0.4));
    ctx.lineTo(x1 - c * Math.cos(a + 0.4), y1 - c * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // Flecha con dirección v (datos) y largo fijo en píxeles; devuelve la posición de la punta.
  function flechaDir(ctx, p, pt, v, largo, color, etiqueta) {
    const n = nrm(v);
    if (n < 1e-9) return;
    const x = p.sx(pt[0]), y = p.sy(pt[1]), dx = (v[0] / n) * largo, dy = (-v[1] / n) * largo;
    flecha(ctx, x, y, dx, dy, color);
    if (etiqueta) {
      ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(etiqueta, x + dx * 1.2 + (dx >= 0 ? 6 : -6), y + dy * 1.2); ctx.restore();
    }
  }

  /* ---------- Problemas: min f(x, y) sujeto a h(x, y) = 0, con la restricción parametrizada ---------- */

  const DOS_PI = 2 * Math.PI;
  const PROBLEMAS = {
    circulo: {
      nombre: 'Función lineal sobre un círculo',
      f: (x, y) => x + 2 * y, h: (x, y) => x * x + y * y - 4,
      curva: (t) => [2 * Math.cos(t), 2 * Math.sin(t)], t0: 0, t1: DOS_PI,
      centro: [0, 0], semi: 3.1, niveles: [-4, -3, -2, -1, 0, 1, 2, 3, 4], uIni: 0.08,
    },
    recta: {
      nombre: 'Distancia a un punto desde una recta',
      f: (x, y) => (x - 3) ** 2 + (y - 1) ** 2, h: (x, y) => x + y - 2,
      curva: (t) => [t, 2 - t], t0: -2.5, t1: 5.5,
      centro: [1.5, 1], semi: 4.2, niveles: [0.5, 2, 4, 8, 13, 20, 28], uIni: 0.15,
    },
    elipse: {
      nombre: 'Distancia a un punto desde una elipse',
      f: (x, y) => (x - 1.2) ** 2 + (y - 1.4) ** 2, h: (x, y) => (x * x) / 4 + y * y - 1,
      curva: (t) => [2 * Math.cos(t), Math.sin(t)], t0: 0, t1: DOS_PI,
      centro: [0.6, 0.5], semi: 3.3, niveles: [0.3, 0.8, 1.6, 2.6, 4, 6, 9, 13], uIni: 0.55,
    },
    parabola: {
      nombre: 'Distancia a un punto desde una parábola',
      f: (x, y) => (x - 0.5) ** 2 + (y - 3) ** 2, h: (x, y) => y - x * x,
      curva: (t) => [t, t * t], t0: -2.4, t1: 2.4,
      centro: [0.3, 2.4], semi: 3.6, niveles: [0.5, 1.5, 3, 5, 8, 12, 18], uIni: 0.1,
    },
  };
  const LISTA = Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]);

  // Calcula, una sola vez por problema, las muestras de la curva y sus puntos críticos.
  function preparar(P) {
    if (P.listo) return P;
    P.F = (q) => P.f(q[0], q[1]);
    P.H = (q) => P.h(q[0], q[1]);
    P.gf = (q) => O.grad(P.F, q);
    P.gh = (q) => O.grad(P.H, q);
    P.tangente = (t) => { const e = 1e-5, a = P.curva(t - e), b = P.curva(t + e); return [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)]; };
    P.tDe = (u) => P.t0 + u * (P.t1 - P.t0);
    const N = 600;
    P.muestras = Array.from({ length: N + 1 }, (_, i) => { const t = P.tDe(i / N); return { t, u: i / N, p: P.curva(t) }; });
    const d = (t) => prod(P.gf(P.curva(t)), P.tangente(t));
    P.crit = [];
    let prev = d(P.t0);
    for (let i = 1; i <= N; i++) {
      const di = d(P.muestras[i].t);
      if (prev * di < 0) {
        let a = P.muestras[i - 1].t, b = P.muestras[i].t, da = prev;
        for (let k = 0; k < 50; k++) { const m = (a + b) / 2, dm = d(m); if (da * dm <= 0) b = m; else { a = m; da = dm; } }
        const t = (a + b) / 2, q = P.curva(t), gf = P.gf(q), gh = P.gh(q);
        P.crit.push({ t, u: (t - P.t0) / (P.t1 - P.t0), p: q, f: P.F(q), lam: -prod(gf, gh) / prod(gh, gh), tipo: prev < 0 ? 'mínimo' : 'máximo' });
      }
      prev = di;
    }
    P.fmin = Math.min(...P.muestras.map((m) => P.F(m.p)));
    P.fmax = Math.max(...P.muestras.map((m) => P.F(m.p)));
    P.listo = true;
    return P;
  }
  // Punto de la curva más cercano a un punto (en datos) → posición u ∈ [0, 1].
  function cercano(P, q) {
    let mejor = 0, dm = Infinity;
    for (const m of P.muestras) { const dd = (m.p[0] - q[0]) ** 2 + (m.p[1] - q[1]) ** 2; if (dd < dm) { dm = dd; mejor = m.u; } }
    return mejor;
  }

  // Curvas de nivel de f y la restricción, con los puntos críticos marcados.
  function escena(lienzo, P, nivelActual) {
    const { ctx } = lienzo;
    lienzo.limpiar();
    const p = planoIgual(lienzo, P.centro[0], P.centro[1], P.semi);
    p.ejes();
    ctx.save();
    p.recortar();
    for (const c of P.niveles) ML.contorno(ctx, p, P.f, c, { color: C.eje, ancho: 1.2, paso: 6 });
    if (nivelActual != null) ML.contorno(ctx, p, P.f, nivelActual, { color: C.s2, ancho: 2.2, paso: 4 });
    VIZ.trazar(ctx, p, P.muestras.map((m) => m.p), C.tinta, 3);
    ctx.restore();
    for (const c of P.crit) {
      ctx.save(); ctx.strokeStyle = C.s6; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.sx(c.p[0]), p.sy(c.p[1]), 8, 0, DOS_PI); ctx.stroke(); ctx.restore();
    }
    return p;
  }
  function arrastrable(lienzo, alMover) {
    let activo = false;
    const c = lienzo.canvas;
    c.style.cursor = 'crosshair';
    c.addEventListener('pointerdown', (ev) => { activo = true; c.setPointerCapture(ev.pointerId); alMover(lienzo.posicion(ev), true); });
    c.addEventListener('pointermove', (ev) => alMover(lienzo.posicion(ev), activo));
    c.addEventListener('pointerup', () => { activo = false; });
    c.addEventListener('pointerleave', () => alMover(null, false));
  }

  /* ---------- Fig. 1: moverse sobre la restricción ---------- */

  function montarMovimiento(cuerpo) {
    let P = preparar(PROBLEMAS.circulo), u = P.uIni, k = -1, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'circulo', alCambiar: (v) => { P = preparar(PROBLEMAS[v]); u = P.uIni; k = -1; sPos.valor = u; dibujar(); } });
    const sPos = ctl.rango({ etiqueta: 'Posición sobre la restricción', min: 0, max: 1, paso: 0.001, valor: u, formato: (v) => Math.round(v * 100) + ' %', alCambiar: (v) => { u = v; dibujar(); } });
    ctl.boton('Siguiente punto crítico', () => { k = (k + 1) % P.crit.length; u = P.crit[k].u; sPos.valor = u; dibujar(); }, { primario: true });
    ctl.boton('Ir al mínimo restringido', () => {
      const m = P.crit.filter((c) => c.tipo === 'mínimo').sort((a, b) => a.f - b.f)[0] || P.crit[0];
      u = m.u; sPos.valor = u; dibujar();
    });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'restricción h = 0', forma: 'linea' },
      { color: C.eje, texto: 'curvas de nivel de f', forma: 'linea' },
      { color: C.s2, texto: '∇f y nivel que pasa por el punto', forma: 'linea' },
      { color: C.s1, texto: '∇h', forma: 'linea' },
      { color: C.s3, texto: 'tangente', forma: 'linea' },
      { color: C.superficie, borde: C.s6, texto: 'punto con ∇f ∥ ∇h' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre el gráfico (o use el control) para mover el punto sobre la restricción; se ajusta a la curva. Las flechas muestran solo la dirección de los gradientes, con el mismo largo.');

    function dibujar() {
      const { ctx } = lienzo;
      const t = P.tDe(u), q = P.curva(t), gf = P.gf(q), gh = P.gh(q), T = P.tangente(t);
      plano = escena(lienzo, P, P.F(q));
      // tangente
      const tn = nrm(T), L = 70;
      ctx.save();
      ctx.strokeStyle = C.s3; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(plano.sx(q[0]) - (T[0] / tn) * L, plano.sy(q[1]) + (T[1] / tn) * L); ctx.lineTo(plano.sx(q[0]) + (T[0] / tn) * L, plano.sy(q[1]) - (T[1] / tn) * L); ctx.stroke();
      ctx.restore();
      flechaDir(ctx, plano, q, gh, 50, C.s1, '∇h');
      flechaDir(ctx, plano, q, gf, 50, C.s2, '∇f');
      VIZ.marcador(ctx, plano.sx(q[0]), plano.sy(q[1]), C.tinta, 6);
      const sinA = cruz(gf, gh) / (nrm(gf) * nrm(gh) || 1);
      const ang = (Math.atan2(cruz(gh, gf), prod(gh, gf)) * 180) / Math.PI;
      const paralelo = Math.abs(sinA) < 0.03;
      const dfds = prod(gf, T) / tn, lam = -prod(gf, gh) / prod(gh, gh);
      let cerca = null;
      for (const c of P.crit) if (!cerca || Math.abs(c.u - u) < Math.abs(cerca.u - u)) cerca = c;
      registro.textContent = paralelo
        ? `∇f es paralelo a ∇h: ninguna dirección tangente cambia f a primer orden. Es un punto estacionario (${cerca.tipo} de f sobre la curva), con λ = ${VIZ.fmt(lam, 3)}.`
        : `∇f tiene componente a lo largo de la curva (${VIZ.fmt(dfds, 3)}): si se desplaza ${dfds < 0 ? 'hacia delante' : 'hacia atrás'}, f baja. Aún se puede mejorar.`;
      lectura.set([
        ['punto', ptos(q)], ['f', VIZ.fmt(P.F(q))],
        ['ángulo ∇h → ∇f', VIZ.fmt(ang, 3) + '°'], ['df/ds', VIZ.fmt(dfds, 3)],
        ['λ', VIZ.fmt(lam, 3)], ['estado', paralelo ? 'paralelos' : 'no paralelos'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { u = cercano(P, q); sPos.valor = u; dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt(P.f(q[0], q[1]))}</b><br>h = <b>${VIZ.fmt(P.h(q[0], q[1]))}</b>`);
    });
    dibujar();
  }

  /* ---------- Fig. 2: direcciones factibles y derivada direccional ---------- */

  function montarDirecciones(cuerpo) {
    let P = preparar(PROBLEMAS.recta), u = 0.3, theta = 45, k = -1, plano = null, curvas = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'recta', alCambiar: (v) => { P = preparar(PROBLEMAS[v]); u = P.uIni; k = -1; sPos.valor = u; dibujar(); } });
    const sPos = ctl.rango({ etiqueta: 'Posición sobre la restricción', min: 0, max: 1, paso: 0.001, valor: u, formato: (v) => Math.round(v * 100) + ' %', alCambiar: (v) => { u = v; dibujar(); } });
    const sAng = ctl.rango({ etiqueta: 'Dirección d (ángulo)', min: 0, max: 359, paso: 1, valor: theta, formato: (v) => v + '°', alCambiar: (v) => { theta = v; dibujar(); } });
    const poner = (g) => { theta = Math.round(g) % 360; sAng.valor = theta; dibujar(); };
    const estado = () => { const t = P.tDe(u), q = P.curva(t); return { t, q, gf: P.gf(q), gh: P.gh(q), T: P.tangente(t) }; };
    ctl.boton('Alinear con la tangente', () => { const e = estado(); poner(grados(Math.atan2(e.T[1], e.T[0]))); }, { primario: true });
    ctl.boton('Alinear con −∇f', () => { const e = estado(); poner(grados(Math.atan2(-e.gf[1], -e.gf[0]))); });
    ctl.boton('Siguiente punto crítico', () => { k = (k + 1) % P.crit.length; u = P.crit[k].u; sPos.valor = u; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 420 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Cambio de f y de h a primer orden según la dirección d');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 190, altoMax: 260 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: '∇f; curva ∇f·d', forma: 'linea' },
      { color: C.s1, texto: '∇h; curva ∇h·d', forma: 'linea' },
      { color: C.s3, texto: 'tangente (∇h·d = 0)', forma: 'linea' },
      { color: C.tinta, texto: 'dirección d', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Gire d con el control. Solo las dos direcciones donde la curva azul cruza el cero son factibles a primer orden; en el óptimo la curva naranja también vale cero allí. Pase el cursor por el gráfico inferior para leer valores.');

    function dibujar() {
      const { ctx } = lienzo;
      const { q, gf, gh, T } = estado();
      const a = (theta * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)];
      plano = escena(lienzo, P, P.F(q));
      const tn = nrm(T), L = 80;
      ctx.save();
      ctx.strokeStyle = C.s3; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(plano.sx(q[0]) - (T[0] / tn) * L, plano.sy(q[1]) + (T[1] / tn) * L); ctx.lineTo(plano.sx(q[0]) + (T[0] / tn) * L, plano.sy(q[1]) - (T[1] / tn) * L); ctx.stroke();
      ctx.restore();
      flechaDir(ctx, plano, q, gh, 44, C.s1, '∇h');
      flechaDir(ctx, plano, q, gf, 44, C.s2, '∇f');
      flechaDir(ctx, plano, q, d, 66, C.tinta, 'd');
      VIZ.marcador(ctx, plano.sx(q[0]), plano.sy(q[1]), C.tinta, 6);
      const dh = prod(gh, d), df = prod(gf, d), nh = nrm(gh);
      const tangente = Math.abs(dh) < 0.04 * nh;
      registro.textContent = !tangente
        ? `d no es tangente: ∇h·d = ${VIZ.fmt(dh, 3)} ≠ 0, así que h deja de valer 0 a primer orden y d no es factible.`
        : Math.abs(df) < 0.02 * nrm(gf) ? `d es tangente y ∇f·d ≈ 0: ninguna de las dos direcciones factibles mejora f a primer orden.`
          : df < 0 ? `d es tangente y ∇f·d = ${VIZ.fmt(df, 3)} < 0: es una dirección factible de descenso; el punto no es óptimo.`
            : `d es tangente y ∇f·d = ${VIZ.fmt(df, 3)} > 0: sube f; pruebe la dirección opuesta (también factible).`;
      lectura.set([['punto', ptos(q)], ['∇h·d', VIZ.fmt(dh, 3)], ['∇f·d', VIZ.fmt(df, 3)], ['d', tangente ? 'tangente' : 'no factible']]);
      dibujarCurvas(gf, gh);
    }
    function dibujarCurvas(gf, gh) {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const M = Math.max(nrm(gf), nrm(gh), 1e-6) * 1.15;
      curvas = VIZ.plano(lienzo2, { xmin: 0, xmax: 360, ymin: -M, ymax: M }, { etiquetaX: 'ángulo de d (°)', formatoX: (v) => v + '°', margen: { izq: 48 } });
      curvas.ejes();
      ctx.save(); ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(curvas.x0, curvas.sy(0)); ctx.lineTo(curvas.x1, curvas.sy(0)); ctx.stroke(); ctx.restore();
      const serie = (g) => Array.from({ length: 181 }, (_, i) => { const t = i * 2, r = (t * Math.PI) / 180; return [t, g[0] * Math.cos(r) + g[1] * Math.sin(r)]; });
      VIZ.trazar(ctx, curvas, serie(gh), C.s1, 2);
      VIZ.trazar(ctx, curvas, serie(gf), C.s2, 2);
      const aT = grados(Math.atan2(gh[0], -gh[1])); // ∇h·d = 0 ⇔ d ⟂ ∇h
      for (const g0 of [aT, (aT + 180) % 360]) {
        const r = (g0 * Math.PI) / 180;
        VIZ.marcador(ctx, curvas.sx(g0), curvas.sy(gh[0] * Math.cos(r) + gh[1] * Math.sin(r)), C.s3, 5);
        VIZ.marcador(ctx, curvas.sx(g0), curvas.sy(gf[0] * Math.cos(r) + gf[1] * Math.sin(r)), C.s3, 4);
      }
      ctx.save(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(curvas.sx(theta), curvas.y1); ctx.lineTo(curvas.sx(theta), curvas.y0); ctx.stroke(); ctx.restore();
    }
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = () => dibujar();
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo2.posicion(ev);
      if (!curvas || !curvas.dentro(pos.x, pos.y)) return tip2.ocultar();
      const { gf, gh } = estado();
      const g = Math.round(curvas.ix(pos.x)), r = (g * Math.PI) / 180;
      tip2.mostrar(pos.x, pos.y, `d a <b>${g}°</b>` + VIZ.filaTooltip(C.s2, '∇f·d', VIZ.fmt(gf[0] * Math.cos(r) + gf[1] * Math.sin(r), 3)) + VIZ.filaTooltip(C.s1, '∇h·d', VIZ.fmt(gh[0] * Math.cos(r) + gh[1] * Math.sin(r), 3)));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo2.canvas.addEventListener('click', (ev) => { const pos = lienzo2.posicion(ev); if (curvas && curvas.dentro(pos.x, pos.y)) { theta = Math.round(curvas.ix(pos.x)) % 360; sAng.valor = theta; dibujar(); } });
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { u = cercano(P, q); sPos.valor = u; dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt(P.f(q[0], q[1]))}</b>`);
    });
    dibujar();
  }

  /* ---------- Fig. 3: bajar la curva de nivel hasta tocar la restricción ---------- */

  function montarNivel(cuerpo) {
    let P = preparar(PROBLEMAS.elipse), nivel = 0, plano = null;
    const ctl = VIZ.controles(cuerpo);
    const rangoNivel = () => { const s = P.fmax - P.fmin; return [P.fmin - 0.35 * s, P.fmax + 0.2 * s]; };
    const nivelDe = (v) => { const [a, b] = rangoNivel(); return a + v * (b - a); };
    const posDe = (c) => { const [a, b] = rangoNivel(); return (c - a) / (b - a); };
    const valorIni = () => P.fmin + 0.5 * (P.fmax - P.fmin);
    ctl.selector({ etiqueta: 'Problema', opciones: LISTA, valor: 'elipse', alCambiar: (v) => { P = preparar(PROBLEMAS[v]); ajustarRango(); dibujar(); } });
    const sNivel = ctl.rango({ etiqueta: 'Nivel c de la curva f = c', min: 0, max: 1, paso: 0.0005, valor: 0.5, formato: (v) => VIZ.fmt(nivelDe(v), 3), alCambiar: (v) => { nivel = nivelDe(v); dibujar(); } });
    function ajustarRango() { nivel = valorIni(); sNivel.valor = posDe(nivel); }
    const irA = (c) => { nivel = c; sNivel.valor = posDe(c); dibujar(); };
    ctl.boton('Nivel = mínimo restringido', () => irA(P.fmin), { primario: true });
    ctl.boton('Nivel = máximo restringido', () => irA(P.fmax));
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 300, altoMax: 470 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'restricción h = 0', forma: 'linea' },
      { color: C.s2, texto: 'curva de nivel f = c', forma: 'linea' },
      { color: C.s1, texto: 'cruce de ambas (punto factible con f = c)', forma: 'punto' },
      { color: C.s6, texto: 'tangencia (extremo)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva el nivel c: la curva naranja se mueve y cruza la restricción en 0, 2 o más puntos. Los valores extremos de f sobre la curva son exactamente los niveles en que la naranja solo la roza (tangencia).');

    function cruces() {
      const out = [];
      let prev = P.F(P.muestras[0].p) - nivel;
      for (let i = 1; i < P.muestras.length; i++) {
        const cur = P.F(P.muestras[i].p) - nivel;
        if (prev * cur < 0) {
          const a = P.muestras[i - 1].t, b = P.muestras[i].t, s = prev / (prev - cur);
          out.push(P.curva(a + s * (b - a)));
        }
        prev = cur;
      }
      return out;
    }
    function dibujar() {
      const { ctx } = lienzo;
      plano = escena(lienzo, P, nivel);
      const pts = cruces();
      for (const q of pts) VIZ.marcador(ctx, plano.sx(q[0]), plano.sy(q[1]), C.s1, 5.5);
      const tol = 0.004 * (P.fmax - P.fmin);
      const tang = P.crit.filter((c) => Math.abs(c.f - nivel) < tol);
      for (const c of tang) VIZ.marcador(ctx, plano.sx(c.p[0]), plano.sy(c.p[1]), C.s6, 7);
      registro.textContent = nivel < P.fmin - tol ? `Con c = ${VIZ.fmt(nivel, 3)} < ${VIZ.fmt(P.fmin, 3)}, la curva de nivel no toca la restricción: ningún punto factible alcanza ese valor.`
        : tang.length ? `La curva de nivel roza la restricción en ${tang.length === 1 ? 'un punto' : tang.length + ' puntos'} (tangencia): ahí ∇f ∥ ∇h y f toma un valor extremo sobre la curva.`
          : nivel > P.fmax + tol ? `Con c = ${VIZ.fmt(nivel, 3)} > ${VIZ.fmt(P.fmax, 3)}, tampoco hay cruces: f no llega tan alto sobre la restricción.`
            : `La curva cruza la restricción en ${pts.length} punto(s): cruzar transversalmente significa que sobre la restricción hay puntos con f menor y con f mayor que c.`;
      lectura.set([['nivel c', VIZ.fmt(nivel, 4)], ['cruces', String(pts.length)], ['mínimo de f en h = 0', VIZ.fmt(P.fmin, 4)], ['máximo de f en h = 0', VIZ.fmt(P.fmax, 4)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt(P.f(q[0], q[1]))}</b><br>h = <b>${VIZ.fmt(P.h(q[0], q[1]))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    ajustarRango();
    dibujar();
  }

  VIZ.registrarTema('equality-constraints-lagrange', {
    intro: String.raw`
      <p>Una <strong>restricción de igualdad</strong> \(h(x)=0\) obliga a quedarse sobre una curva (o superficie). Ya no se puede avanzar
      en cualquier dirección: solo en las <em>tangentes</em> a la curva. El óptimo es entonces el punto donde, moviéndose por la curva, ya no se
      puede mejorar \(f\).</p>
      <p>La condición clave es geométrica: en el óptimo la curva de nivel de \(f\) es <strong>tangente</strong> a la restricción, o dicho con gradientes,
      \(\nabla f\) es paralelo a \(\nabla h\). El factor de proporcionalidad es el <strong>multiplicador de Lagrange</strong> \(\lambda\).</p>`,
    visualizaciones: [
      {
        titulo: 'Muévase sobre la restricción',
        descripcion: 'Arrastre el punto por la curva negra y observe los dos gradientes: solo en los círculos verdes \\(\\nabla f\\) y \\(\\nabla h\\) quedan paralelos. Pruebe «Siguiente punto crítico» y compare los valores de \\(\\lambda\\).',
        montar: montarMovimiento,
      },
      {
        titulo: 'Direcciones factibles y derivada direccional',
        descripcion: 'Gire la dirección \\(d\\): solo las tangentes son factibles (\\(\\nabla h\\cdot d=0\\)). Pruebe «Alinear con la tangente» y vea cuándo \\(\\nabla f\\cdot d\\) deja de ser negativa.',
        montar: montarDirecciones,
      },
      {
        titulo: 'Bajar el nivel hasta rozar la restricción',
        descripcion: 'Cambie el nivel \\(c\\) de la curva \\(f=c\\) y cuente los cruces con la restricción. Pruebe los botones de mínimo y máximo: en esos niveles hay tangencia.',
        montar: montarNivel,
      },
    ],
    teoria: String.raw`
      <h2>El problema con una igualdad</h2>
      <p>Se busca</p>
      \[ \min_{x\in\mathbb{R}^n} f(x) \quad\text{sujeto a}\quad h(x)=0, \]
      <p>con \(f\) y \(h\) diferenciables. El conjunto factible \(\{x : h(x)=0\}\) es una curva en el plano (una superficie en dimensión mayor).
      Se supone que \(\nabla h(x^*)\neq 0\) (la restricción es <em>regular</em>), de modo que cerca de \(x^*\) el conjunto factible es una curva suave.</p>
      <h2>Direcciones tangentes</h2>
      <p>Una dirección \(d\) es <strong>factible a primer orden</strong> si mantiene \(h\) constante: \(h(x+\varepsilon d)\approx h(x)+\varepsilon\,\nabla h(x)^\top d\), de modo que
      se necesita \(\nabla h(x)^\top d=0\). Estas direcciones forman el <em>espacio tangente</em> \(T(x)=\{d:\nabla h(x)^\top d=0\}\), una recta en el plano.</p>
      <h2>Condición necesaria de primer orden</h2>
      <p>Si \(x^*\) es un mínimo local, ninguna dirección tangente puede disminuir \(f\): \(\nabla f(x^*)^\top d\ge 0\) para todo \(d\in T(x^*)\). Como \(T\) es un espacio lineal (si \(d\) sirve, \(-d\) también),
      se obtiene \(\nabla f(x^*)^\top d=0\) para todo \(d\in T\); es decir, \(\nabla f(x^*)\perp T(x^*)\), lo que equivale a que \(\nabla f(x^*)\) sea múltiplo de \(\nabla h(x^*)\):</p>
      \[ \nabla f(x^*) + \lambda^*\,\nabla h(x^*) = 0 \qquad\text{para algún }\lambda^*\in\mathbb{R}. \]
      <p>El signo es una convención (aquí \(\nabla f=-\lambda\nabla h\); con \(-\lambda\) se obtiene la otra). Con varias igualdades, \(\nabla f+\sum_i\lambda_i\nabla h_i=0\).
      Despejando, \(\lambda=-\dfrac{\nabla f\cdot\nabla h}{\|\nabla h\|^2}\) en cualquier punto donde los gradientes sean paralelos.</p>
      <h2>Curvas de nivel tangentes</h2>
      <p>El gradiente \(\nabla f\) es perpendicular a la curva de nivel de \(f\) que pasa por el punto, y \(\nabla h\) lo es a la restricción. Que los gradientes sean paralelos significa que
      ambas curvas comparten tangente: la curva de nivel <em>roza</em> la restricción sin cruzarla. Si la cruzara, habría puntos factibles a ambos lados de ese nivel y se podría bajar.</p>
      <div class="recuadro"><p>La condición es <strong>necesaria, no suficiente</strong>: también la cumplen los máximos y otros puntos estacionarios de \(f\) restringida. En la figura 1 aparecen todos con círculo verde.
      Distinguirlos exige segundo orden (ver <a href="tema.html?id=constrained-nlp-solving">Solving Constrained Nonlinear Problems</a>) o comparar valores.</p></div>
      <h2>Ejemplo resuelto</h2>
      <p>Minimizar \(f=x+2y\) sobre \(x^2+y^2=4\). Se plantea \(\nabla f=(1,2)\), \(\nabla h=(2x,2y)\), y \(1+2\lambda x=0\), \(2+2\lambda y=0\), de donde \(y=2x\). Con \(5x^2=4\):
      \(x=\mp 2/\sqrt5\), \(y=\mp 4/\sqrt5\). El mínimo es \((-2/\sqrt5,-4/\sqrt5)\) con \(f=-2\sqrt5\approx-4{,}47\) y \(\lambda=\sqrt5/4\approx 0{,}56\); el otro punto es el máximo, con \(f=+2\sqrt5\).</p>
      <h2>Conexiones</h2>
      <p>La condición se resume formando la <a href="tema.html?id=lagrangian-function">función lagrangiana</a>. Con desigualdades aparecen las
      <a href="tema.html?id=inequality-constraints">restricciones de desigualdad</a> y las <a href="tema.html?id=kkt-conditions">condiciones KKT</a>. Sin restricciones se recupera
      \(\nabla f=0\), como en el <a href="tema.html?id=descenso-gradiente">descenso del gradiente</a>. El tamaño de \(\lambda\) mide cuánto mejora el óptimo si se relaja la restricción
      (<a href="tema.html?id=multiplier-interpretation">significado geométrico de los multiplicadores</a>).</p>`,
  });
})();
