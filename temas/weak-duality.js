(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* ---------- Ayudantes ---------- */

  const trans = (A) => A[0].map((_, j) => A.map((f) => f[j]));
  const dot = (u, v) => u.reduce((s, a, k) => s + a * v[k], 0);

  // LP general; un rayo con artificiales positivos significa infactible.
  function lpSeguro(c, A, sen, b, max) {
    const r = O.lp(c, A, sen, b, { max });
    if (r.estado !== 'noacotado') return r;
    const f = O.lp(c.map(() => 0), A, sen, b, { max: true });
    return f.estado === 'optimo' ? r : { estado: 'infactible' };
  }
  // Primal: máx cᵀx, Ax ≤ b, x ≥ 0.  Dual: mín bᵀy, Aᵀy ≥ c, y ≥ 0.
  function resolverPar(K) {
    const m = K.A.length, n = K.c.length;
    return {
      p: lpSeguro(K.c, K.A, Array(m).fill('<='), K.b, true),
      d: lpSeguro(K.b, trans(K.A), Array(n).fill('>='), K.c, false),
    };
  }
  const factiblePrimal = (K, x) => x.every((v) => v >= -1e-9) && K.A.every((a, i) => dot(a, x) <= K.b[i] + 1e-9);
  const factibleDual = (K, y) => y.every((v) => v >= -1e-9) && trans(K.A).every((a, j) => dot(a, y) >= K.c[j] - 1e-9);
  function poliPrimal(K, W) {
    return O.poligono([...K.A.map((a, i) => ({ a, b: K.b[i] })), { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }], W);
  }
  function poliDual(K, W) {
    return O.poligono([...trans(K.A).map((a, j) => ({ a: a.map((v) => -v), b: -K.c[j] })), { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }], W);
  }
  const estadoTexto = (r) => (r.estado === 'optimo' ? VIZ.fmt(r.z) : r.estado === 'noacotado' ? 'no acotado' : 'infactible');

  function recta(ctx, p, a, b, color, ancho, guion) {
    const d = p.d, pts = [];
    if (Math.abs(a[1]) > 1e-9) for (const x of [d.xmin, d.xmax]) pts.push([x, (b - a[0] * x) / a[1]]);
    else pts.push([b / a[0], d.ymin], [b / a[0], d.ymax]);
    VIZ.trazar(ctx, p, pts, color, ancho, guion);
  }

  // Panel con región poligonal; clic o arrastre para colocar un punto.
  function panel(padre, nombres, colorR) {
    const l = VIZ.lienzo(padre, { proporcion: 0.85, altoMin: 230, altoMax: 380 });
    const tip = VIZ.tooltip(l);
    const e = { l, W: null, poli: [], rectas: [], extra: null, p: null, alClic: null, tooltip: null };
    e.dibujar = () => {
      if (!e.W) return;
      const { ctx } = l;
      l.limpiar();
      const p = e.p = VIZ.plano(l, e.W, { etiquetaX: nombres[0], etiquetaY: nombres[1] });
      p.ejes();
      ctx.save();
      p.recortar();
      ctx.strokeStyle = C.eje;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.sx(0) + 0.5, p.y0); ctx.lineTo(p.sx(0) + 0.5, p.y1);
      ctx.moveTo(p.x0, p.sy(0) + 0.5); ctx.lineTo(p.x1, p.sy(0) + 0.5);
      ctx.stroke();
      if (e.poli.length >= 3) {
        ctx.beginPath();
        e.poli.forEach(([x, y], k) => (k ? ctx.lineTo(p.sx(x), p.sy(y)) : ctx.moveTo(p.sx(x), p.sy(y))));
        ctx.closePath();
        ctx.fillStyle = VIZ.alfa(colorR, 0.2);
        ctx.fill();
      }
      e.rectas.forEach((r) => recta(ctx, p, r.a, r.b, C.tinta2, 1.5, [6, 4]));
      ctx.restore();
      if (e.poli.length < 3) {
        ctx.font = VIZ.fuente(11);
        ctx.fillStyle = C.s8;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('región vacía', p.x0 + 8, p.y1 + 6);
      }
      if (e.extra) e.extra(ctx, p);
    };
    l.alDibujar = e.dibujar;
    let arrastrando = false;
    const dato = (ev, fijar) => {
      const { x, y } = l.posicion(ev);
      if (!e.p) return null;
      if (!fijar && !e.p.dentro(x, y)) return null;
      const d = e.p.d;
      return { q: [Math.min(d.xmax, Math.max(d.xmin, e.p.ix(x))), Math.min(d.ymax, Math.max(d.ymin, e.p.iy(y)))], x, y };
    };
    l.canvas.addEventListener('pointerdown', (ev) => {
      const k = dato(ev, false);
      if (!k || !e.alClic) return;
      arrastrando = true;
      l.canvas.setPointerCapture(ev.pointerId);
      tip.ocultar();
      e.alClic(k.q);
    });
    l.canvas.addEventListener('pointermove', (ev) => {
      if (arrastrando) { const k = dato(ev, true); if (k) e.alClic(k.q); return; }
      const k = dato(ev, false);
      const h = k && e.tooltip ? e.tooltip(k.q) : null;
      if (h) tip.mostrar(k.x, k.y, h); else tip.ocultar();
    });
    l.canvas.addEventListener('pointerup', () => { arrastrando = false; });
    l.canvas.addEventListener('pointerleave', () => tip.ocultar());
    if (colorR) l.canvas.style.cursor = 'crosshair';
    return e;
  }

  const CASOS = {
    acotado: { nombre: 'Primal y dual acotados', c: [2, 3], A: [[1, 2], [3, 1]], b: [8, 9], x: [1, 1], y: [2, 2],
      Wp: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
    noacotado: { nombre: 'Primal no acotado', c: [1, 1], A: [[1, -1], [-1, 1]], b: [2, 2], x: [1, 1], y: [2, 1],
      Wp: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 }, Wd: { xmin: 0, xmax: 6, ymin: 0, ymax: 6 } },
    infactible: { nombre: 'Primal infactible', c: [1, 1], A: [[1, 1], [-1, -1]], b: [4, -6], x: [1, 1], y: [2, 1],
      Wp: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
  };

  /* ---------- Fig. 1: un par de puntos y la recta de valores ---------- */

  function montarPar(cuerpo) {
    let caso = 'acotado', K = CASOS.acotado, x = K.x.slice(), y = K.y.slice(), sol = resolverPar(K), semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(CASOS).map(([k, c]) => [k, c.nombre]), valor: caso,
      alCambiar: (v) => { caso = v; K = CASOS[v]; x = K.x.slice(); y = K.y.slice(); sol = resolverPar(K); preparar(); } });
    ctl.boton('Par factible al azar', () => {
      const r = VIZ.semilla(semilla++ * 977);
      for (let k = 0; k < 4000; k++) { const q = [r() * K.Wp.xmax, r() * K.Wp.ymax]; if (factiblePrimal(K, q)) { x = q; break; } }
      for (let k = 0; k < 4000; k++) { const q = [r() * K.Wd.xmax, r() * K.Wd.ymax]; if (factibleDual(K, q)) { y = q; break; } }
      dibujarTodo();
    }, { primario: true });
    ctl.boton('Poner ambos en el óptimo', () => {
      if (sol.p.estado === 'optimo') x = sol.p.x.slice();
      if (sol.d.estado === 'optimo') y = sol.d.x.slice();
      dibujarTodo();
    });

    const cols = VIZ.el('div', { class: 'dos-columnas' });
    const izq = VIZ.el('div'), der = VIZ.el('div');
    cols.append(izq, der);
    cuerpo.appendChild(cols);
    VIZ.subtitulo(izq, 'Primal: elija x');
    const pp = panel(izq, ['x₁', 'x₂'], C.s1);
    VIZ.subtitulo(der, 'Dual: elija y');
    const pd = panel(der, ['y₁', 'y₂'], C.s2);
    VIZ.subtitulo(cuerpo, 'Recta de valores');
    const tira = VIZ.lienzo(cuerpo, { alto: 110 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región del primal y valor cᵀx' },
      { color: C.s2, texto: 'región del dual y valor bᵀy' },
      { color: C.s6, texto: 'valor óptimo común', forma: 'punto' },
      { color: C.s3, texto: 'brecha bᵀy − cᵀx' },
      { color: C.s8, texto: 'punto no factible (su valor no cuenta)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre sobre cada región para mover x y y. Los puntos fuera de su región se dibujan huecos y en rojo: para ellos la desigualdad de la dualidad débil no se garantiza.');

    const marca = (ctx, p, q, ok, color, forma) => {
      const px = p.sx(q[0]), py = p.sy(q[1]);
      if (ok) VIZ.marcador(ctx, px, py, color, 6, forma);
      else {
        ctx.save();
        ctx.fillStyle = C.superficie;
        ctx.strokeStyle = C.s8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        VIZ.forma(ctx, px, py, 6, forma);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };

    function preparar() {
      pp.W = K.Wp; pd.W = K.Wd;
      pp.poli = poliPrimal(K, K.Wp); pd.poli = poliDual(K, K.Wd);
      pp.rectas = K.A.map((a, i) => ({ a, b: K.b[i] }));
      pd.rectas = trans(K.A).map((a, j) => ({ a, b: K.c[j] }));
      dibujarTodo();
    }
    pp.extra = (ctx, p) => {
      if (sol.p.estado === 'optimo') VIZ.marcador(ctx, p.sx(sol.p.x[0]), p.sy(sol.p.x[1]), C.s6, 5);
      marca(ctx, p, x, factiblePrimal(K, x), C.s1, 0);
    };
    pd.extra = (ctx, p) => {
      if (sol.d.estado === 'optimo') VIZ.marcador(ctx, p.sx(sol.d.x[0]), p.sy(sol.d.x[1]), C.s6, 5);
      marca(ctx, p, y, factibleDual(K, y), C.s2, 1);
    };
    pp.alClic = (q) => { x = q; dibujarTodo(); };
    pd.alClic = (q) => { y = q; dibujarTodo(); };
    pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>cᵀx = <b>${VIZ.fmt(dot(K.c, q))}</b><br>${factiblePrimal(K, q) ? 'factible' : 'no factible'}`;
    pd.tooltip = (q) => `y = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>bᵀy = <b>${VIZ.fmt(dot(K.b, q))}</b><br>${factibleDual(K, q) ? 'factible' : 'no factible'}`;

    function dibujarTira() {
      const { ctx, ancho: W, alto: H } = tira;
      tira.limpiar();
      const cx = dot(K.c, x), by = dot(K.b, y);
      const zs = sol.p.estado === 'optimo' ? sol.p.z : null;
      const vals = [cx, by, 0, ...(zs != null ? [zs] : [])];
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const m = (hi - lo) * 0.08 + 1;
      const izq = 24, der = W - 24, yy = 52;
      const sx = (v) => izq + ((v - (lo - m)) / (hi + m - (lo - m))) * (der - izq);
      ctx.strokeStyle = C.eje;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(izq, yy); ctx.lineTo(der, yy); ctx.stroke();
      ctx.font = VIZ.fuente(10);
      ctx.fillStyle = C.apagado;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const t of VIZ.ticks(lo - m, hi + m, Math.max(2, Math.floor((der - izq) / 70)))) {
        ctx.beginPath(); ctx.moveTo(sx(t), yy); ctx.lineTo(sx(t), yy + 4); ctx.stroke();
        ctx.fillText(VIZ.fmt(t), sx(t), yy + 7);
      }
      const fx = factiblePrimal(K, x), fy = factibleDual(K, y);
      if (fx && fy) {
        ctx.fillStyle = VIZ.alfa(C.s3, 0.35);
        ctx.fillRect(Math.min(sx(cx), sx(by)), yy - 9, Math.abs(sx(by) - sx(cx)), 18);
      }
      if (zs != null) VIZ.marcador(ctx, sx(zs), yy, C.s6, 6, 3);
      const punto = (v, ok, color, forma, texto, arriba) => {
        const px = sx(v);
        if (ok) VIZ.marcador(ctx, px, yy, color, 6, forma);
        else {
          ctx.save(); ctx.fillStyle = C.superficie; ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.beginPath(); VIZ.forma(ctx, px, yy, 6, forma); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        ctx.font = VIZ.fuente(11, 600);
        ctx.fillStyle = ok ? C.tinta : C.s8;
        ctx.textAlign = 'center';
        ctx.textBaseline = arriba ? 'bottom' : 'top';
        ctx.fillText(texto, Math.min(der - 28, Math.max(izq + 28, px)), arriba ? yy - 14 : yy + 26);
      };
      punto(cx, fx, C.s1, 0, `cᵀx = ${VIZ.fmt(cx, 3)}`, true);
      punto(by, fy, C.s2, 1, `bᵀy = ${VIZ.fmt(by, 3)}`, false);
    }
    tira.alDibujar = dibujarTira;

    function dibujarTodo() {
      pp.dibujar(); pd.dibujar(); dibujarTira();
      const cx = dot(K.c, x), by = dot(K.b, y), fx = factiblePrimal(K, x), fy = factibleDual(K, y);
      const zs = sol.p.estado === 'optimo' ? sol.p.z : null;
      if (fx && fy) registro.textContent = `Ambos son factibles: cᵀx = ${VIZ.fmt(cx)} ≤ bᵀy = ${VIZ.fmt(by)}. La brecha es ${VIZ.fmt(by - cx)}, y el óptimo ${zs != null ? VIZ.fmt(zs) : ''} queda entre los dos valores.`;
      else if (fx) registro.textContent = `x es factible, pero y no cumple Aᵀy ≥ c, y ≥ 0: bᵀy = ${VIZ.fmt(by)} no es una cota válida${sol.d.estado === 'infactible' ? ' (de hecho el dual no tiene ningún punto factible, y el objetivo del primal crece sin límite)' : ''}.`;
      else if (fy) registro.textContent = `y es factible, pero x no cumple Ax ≤ b, x ≥ 0: cᵀx = ${VIZ.fmt(cx)} no es una cota inferior válida${sol.p.estado === 'infactible' ? ' (de hecho el primal no tiene ningún punto factible)' : ''}.`;
      else registro.textContent = 'Ninguno de los dos puntos es factible: la dualidad débil no dice nada sobre ellos.';
      lectura.set([
        ['cᵀx', VIZ.fmt(cx)],
        ['bᵀy', VIZ.fmt(by)],
        ['brecha bᵀy − cᵀx', fx && fy ? VIZ.fmt(by - cx) : 'sin garantía'],
        ['óptimo primal', estadoTexto(sol.p)],
        ['óptimo dual', estadoTexto(sol.d)],
      ]);
    }
    preparar();
  }

  /* ---------- Fig. 2: todos los pares factibles caen sobre la diagonal ---------- */

  function montarNube(cuerpo) {
    let c = [2, 3], b = [8, 9], N = 150, semilla = 1, conOptimo = true, puntos = [], sol = null, M = 1, hover = -1;
    const A = [[1, 2], [3, 1]];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'c₁', min: 1, max: 6, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; generar(); } });
    ctl.rango({ etiqueta: 'c₂', min: 1, max: 6, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; generar(); } });
    ctl.rango({ etiqueta: 'b₁', min: 4, max: 12, paso: 0.5, valor: b[0], alCambiar: (v) => { b[0] = v; generar(); } });
    ctl.rango({ etiqueta: 'b₂', min: 4, max: 12, paso: 0.5, valor: b[1], alCambiar: (v) => { b[1] = v; generar(); } });
    ctl.rango({ etiqueta: 'Pares', min: 20, max: 400, paso: 10, valor: N, alCambiar: (v) => { N = v; generar(); } });
    ctl.casilla({ etiqueta: 'Incluir el par óptimo', valor: conOptimo, alCambiar: (v) => { conOptimo = v; generar(); } });
    ctl.boton('Nuevo sorteo', () => { semilla++; generar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'par factible (x, y): cᵀx contra bᵀy', forma: 'punto' },
      { color: C.s6, texto: 'par óptimo (valores iguales)', forma: 'punto' },
      { color: C.apagado, texto: 'diagonal bᵀy = cᵀx', forma: 'linea' },
      { color: C.neutro, borde: C.rejilla, texto: 'zona prohibida: bᵀy < cᵀx' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un par (x, y) elegido al azar dentro de las dos regiones. Pase el cursor sobre un punto para ver su brecha. Mueva c y b: la nube se desplaza, pero jamás cruza la diagonal.');

    function generar() {
      const K = { A, b, c };
      sol = resolverPar(K);
      const r = VIZ.semilla(semilla * 7919 + 13);
      const polP = poliPrimal(K, { xmin: 0, xmax: 20, ymin: 0, ymax: 20 });
      const xm = Math.max(...polP.map((q) => q[0])), ym = Math.max(...polP.map((q) => q[1]));
      const ymax = 1.6 * Math.max(...c) + 2;
      puntos = [];
      for (let k = 0; k < 60000 && puntos.length < N; k++) {
        const x = [r() * xm, r() * ym];
        if (!factiblePrimal(K, x)) continue;
        let y = null;
        for (let t = 0; t < 400 && !y; t++) { const q = [r() * ymax, r() * ymax]; if (factibleDual(K, q)) y = q; }
        if (y) puntos.push({ x, y, cx: dot(c, x), by: dot(b, y) });
      }
      if (conOptimo) puntos.push({ x: sol.p.x, y: sol.d.x, cx: sol.p.z, by: sol.d.z, optimo: true });
      M = Math.max(sol.p.z, ...puntos.map((q) => Math.max(q.cx, q.by))) * 1.06;
      dibujar();
    }

    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: M, ymin: 0, ymax: M }, { etiquetaX: 'cᵀx (valor del primal)', etiquetaY: 'bᵀy (valor del dual)' });
      plano.ejes();
      ctx.save();
      plano.recortar();
      ctx.beginPath();
      ctx.moveTo(plano.sx(0), plano.sy(0)); ctx.lineTo(plano.sx(M), plano.sy(0)); ctx.lineTo(plano.sx(M), plano.sy(M)); ctx.closePath();
      ctx.fillStyle = C.neutro;
      ctx.fill();
      ctx.restore();
      VIZ.trazar(ctx, plano, [[0, 0], [M, M]], C.apagado, 1.5, [3, 4]);
      puntos.forEach((q, k) => {
        if (q.optimo) return;
        ctx.fillStyle = VIZ.alfa(C.s1, k === hover ? 1 : 0.55);
        ctx.beginPath();
        ctx.arc(plano.sx(q.cx), plano.sy(q.by), k === hover ? 5 : 3.2, 0, 2 * Math.PI);
        ctx.fill();
      });
      puntos.forEach((q) => { if (q.optimo) VIZ.marcador(ctx, plano.sx(q.cx), plano.sy(q.by), C.s6, 6.5, 3); });
      const viol = puntos.filter((q) => q.by < q.cx - 1e-9).length;
      const brechas = puntos.filter((q) => !q.optimo).map((q) => q.by - q.cx);
      const min = brechas.length ? Math.min(...brechas) : 0;
      registro.textContent = viol === 0
        ? `Los ${puntos.length} pares cumplen cᵀx ≤ bᵀy: todos quedan sobre la diagonal. El óptimo común ${VIZ.fmt(sol.p.z)} es la única forma de tocarla.`
        : `${viol} pares violan la desigualdad (no debería ocurrir).`;
      lectura.set([
        ['pares', String(puntos.length)],
        ['violaciones', String(viol)],
        ['brecha mínima', VIZ.fmt(min)],
        ['brecha media', VIZ.fmt(brechas.length ? brechas.reduce((s, v) => s + v, 0) / brechas.length : 0)],
        ['valor óptimo', VIZ.fmt(sol.p.z)],
      ]);
    }
    lienzo.alDibujar = () => puntos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let mejor = -1, md = 12;
      puntos.forEach((q, k) => { const d = Math.hypot(plano.sx(q.cx) - x, plano.sy(q.by) - y); if (d < md) { md = d; mejor = k; } });
      if (mejor !== hover) { hover = mejor; dibujar(); }
      if (mejor < 0) return tip.ocultar();
      const q = puntos[mejor];
      tip.mostrar(x, y, `cᵀx = <b>${VIZ.fmt(q.cx)}</b><br>bᵀy = <b>${VIZ.fmt(q.by)}</b><br>brecha <b>${VIZ.fmt(q.by - q.cx)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { tip.ocultar(); if (hover >= 0) { hover = -1; dibujar(); } });
    generar();
  }

  VIZ.registrarTema('weak-duality', {
    intro: String.raw`
      <p>La <strong>dualidad débil</strong> es la observación más sencilla y más útil de toda la teoría: cualquier solución
      factible del dual acota a cualquier solución factible del primal. En un problema de maximizar, cada punto factible del
      primal es una cota inferior del óptimo, y cada punto factible del dual es una cota superior.</p>
      <p>Por eso un par de soluciones factibles, una de cada problema, atrapa al valor óptimo entre dos números. La distancia
      entre ellos es una <em>brecha</em>: si vale cero, ambas soluciones son óptimas, y si es pequeña, ninguna puede estar muy
      lejos del óptimo.</p>`,
    visualizaciones: [
      {
        titulo: 'Un par factible y su brecha',
        descripcion: 'Arrastre x en la región del primal y y en la del dual, y observe en la recta de valores que cᵀx nunca pasa a bᵀy mientras ambos sean factibles. Pruebe sacar y de su región (la cota deja de ser válida) y los otros dos problemas: si el primal no es acotado, el dual no tiene ningún punto factible.',
        montar: montarPar,
      },
      {
        titulo: 'Nube de pares factibles',
        descripcion: 'Cada punto enfrenta el valor de un x factible con el de un y factible. Cambie c y b y compruebe que todos los pares quedan sobre la diagonal; solo el par óptimo la toca.',
        montar: montarNube,
      },
    ],
    teoria: String.raw`
      <h2>Enunciado y demostración</h2>
      <p>Sean (P) \(\max\, c^\top x\) s.a. \(Ax \le b,\ x \ge 0\) y su dual (D) \(\min\, b^\top y\) s.a. \(A^\top y \ge c,\ y \ge 0\)
      (ver <a href="tema.html?id=dual-construction">Constructing the Dual</a>).</p>
      <div class="recuadro"><p><strong>Teorema (dualidad débil).</strong> Si \(x\) es factible para (P) y \(y\) es factible para (D),
      entonces \(c^\top x \le b^\top y\).</p></div>
      <p><em>Demostración.</em> Como \(x \ge 0\) y \(A^\top y \ge c\), se tiene \(c^\top x \le (A^\top y)^\top x = y^\top A x\).
      Como \(y \ge 0\) y \(Ax \le b\), se tiene \(y^\top A x \le y^\top b\). Encadenando,</p>
      \[ c^\top x \;\le\; y^\top A x \;\le\; b^\top y. \]
      <p>La primera desigualdad usa la factibilidad dual y \(x \ge 0\); la segunda usa la factibilidad primal y \(y \ge 0\). Es
      exactamente la idea de multiplicador: \(y_i\) es el peso con que se suma la restricción \(i\).</p>

      <h2>Consecuencias</h2>
      <ul>
        <li><strong>Cotas.</strong> Para cualquier \(y\) factible, \(z^* \le b^\top y\); para cualquier \(x\) factible, \(c^\top x \le z^*\).
        La <em>brecha</em> \(b^\top y - c^\top x \ge 0\) mide cuánto se puede mejorar.</li>
        <li><strong>Certificado de optimalidad.</strong> Si \(c^\top \bar x = b^\top \bar y\) con ambos factibles, los dos son óptimos: ninguna
        solución del primal puede superar a \(b^\top \bar y\) (ver <a href="tema.html?id=optimality-certificates">Optimality Certificates</a>).</li>
        <li><strong>No acotado implica infactible.</strong> Si (P) es no acotado, no existe ningún \(y\) factible, porque acotaría al objetivo.
        Simétricamente, si (D) es no acotado, (P) es infactible. El recíproco falla: ambos pueden ser infactibles a la vez
        (ver <a href="tema.html?id=strong-duality">Strong Duality</a>).</li>
      </ul>

      <h2>Ejemplo resuelto</h2>
      <p>Con \(\max\, 2x_1 + 3x_2\) s.a. \(x_1 + 2x_2 \le 8,\ 3x_1 + x_2 \le 9\): el punto \(x = (1,1)\) es factible con \(c^\top x = 5\);
      el punto \(y = (2,2)\) cumple \(y_1 + 3y_2 = 8 \ge 2\) y \(2y_1 + y_2 = 6 \ge 3\), con \(b^\top y = 16 + 18 = 34\). Luego
      \(5 \le z^* \le 34\). Con \(y = (7/5,\,1/5)\) la cota baja a \(13\), y con \(x = (2,3)\) sube a \(13\): la brecha se cierra y
      \(z^* = 13\).</p>

      <h2>Cuando un problema no tiene óptimo</h2>
      <p>En el caso \(\max\, x_1 + x_2\) s.a. \(x_1 - x_2 \le 2,\ -x_1 + x_2 \le 2\) la región del primal es una franja infinita en
      la dirección \((1,1)\) y el objetivo crece sin límite. El dual exige \(y_1 - y_2 \ge 1\) y \(-y_1 + y_2 \ge 1\), que no se pueden
      cumplir juntas: región vacía, tal como pide la dualidad débil. En el caso opuesto, \(x_1 + x_2 \le 4\) junto con
      \(-x_1 - x_2 \le -6\) no tiene solución, y el dual, que minimiza \(4y_1 - 6y_2\) con \(y_1 - y_2 \ge 1\), baja sin límite
      (\(y_2 \to \infty\)).</p>

      <h2>Conexiones</h2>
      <p>La brecha es el criterio de parada de los métodos de punto interior y de la mayoría de los resolvedores de
      <a href="tema.html?id=milp-branch-and-bound">programación entera</a> (ver <a href="tema.html?id=node-pruning-gap">Pruning and Optimality Gap</a>).
      Cuando la brecha se anula se cumplen las <a href="tema.html?id=complementary-slackness">holguras complementarias</a>, y la
      variable dual \(y_i\) resulta ser el <a href="tema.html?id=shadow-prices">precio sombra</a> del recurso \(i\).</p>`,
  });
})();
