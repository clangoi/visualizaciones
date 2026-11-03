(function () {
  'use strict';
  const { color: C, fmt } = VIZ;
  const O = VIZ.opt;

  // Color de cada mínimo: el global en verde, los locales con la serie en orden.
  const COLORES_LOCALES = [C.s1, C.s2, C.s7, C.s3, C.s4, C.s5, C.s8];
  const colorDe = (k, global) => (global ? C.s6 : COLORES_LOCALES[k % COLORES_LOCALES.length]);

  // Arrastre de asas; clic(x, y) puede crear una asa y devolver su índice.
  function interaccion(lienzo, { asas, mover, clic, hover, salir }) {
    const cv = lienzo.canvas;
    let arr = -1;
    const cerca = (x, y) => {
      let m = -1, d = 15;
      asas().forEach(([px, py], i) => { const q = Math.hypot(px - x, py - y); if (q < d) { d = q; m = i; } });
      return m;
    };
    cv.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let i = cerca(x, y);
      if (i < 0 && clic) i = clic(x, y);
      if (i == null || i < 0) return;
      arr = i;
      cv.setPointerCapture(ev.pointerId);
      mover(i, x, y);
    });
    cv.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arr >= 0) return mover(arr, x, y);
      cv.style.cursor = cerca(x, y) >= 0 ? 'grab' : 'crosshair';
      if (hover) hover(x, y);
    });
    const fin = () => { arr = -1; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (arr < 0 && salir) salir(); });
  }

  /* ---------- Fig. 1: paisaje en una dimensión ---------- */

  function montarUno(cuerpo) {
    const A = -5, B = 5;
    let rug = 1, eta = 0.05, eps = 0.5, starts = [-4.2, -1.6, 2.2, 4.3], semilla = 1;
    let runs = [], mensaje = '', plano = null, an = null;
    const f = (x) => 0.12 * x * x + 0.1 * x + rug * (Math.sin(1.7 * x + 0.4) + 0.5 * Math.sin(3.3 * x));
    const d = (x) => O.grad((v) => f(v[0]), [x])[0];
    const paso = (x) => Math.min(B, Math.max(A, x - eta * d(x)));

    // Descenso desde x0 hasta converger; devuelve el punto final.
    function descender(x0) {
      let x = x0;
      for (let k = 0; k < 600; k++) { const nx = paso(x); if (Math.abs(nx - x) < 1e-7) return x; x = nx; }
      return x;
    }
    const destino = (x, mins) => {
      let m = -1, dm = 0.08;
      mins.forEach((q, i) => { if (Math.abs(q.x - x) < dm) { dm = Math.abs(q.x - x); m = i; } });
      return m;
    };

    // Mínimos locales (por cambio de signo de la derivada), global y cuencas.
    function analizar() {
      const N = 2000, xs = Array.from({ length: N + 1 }, (_, i) => A + ((B - A) * i) / N), ds = xs.map(d);
      const mins = [];
      if (ds[0] > 0) mins.push({ x: A });
      for (let i = 0; i < N; i++) {
        if (ds[i] < 0 && ds[i + 1] >= 0) {
          let a = xs[i], b = xs[i + 1];
          for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (d(m) < 0) a = m; else b = m; }
          mins.push({ x: (a + b) / 2 });
        }
      }
      if (ds[N] < 0) mins.push({ x: B });
      mins.forEach((q) => { q.f = f(q.x); });
      let g = 0;
      mins.forEach((q, i) => { if (q.f < mins[g].f - 1e-9) g = i; });
      let loc = 0;
      mins.forEach((q, i) => { q.global = i === g; q.color = colorDe(q.global ? 0 : loc++, q.global); });
      const ys = xs.map(f);
      const cuenca = Array.from({ length: 301 }, (_, i) => destino(descender(A + ((B - A) * i) / 300), mins));
      const fracGlobal = cuenca.filter((c) => c === g).length / cuenca.length;
      return { mins, g, fmin: Math.min(...ys), fmax: Math.max(...ys), cuenca, fracGlobal };
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Rugosidad del paisaje', min: 0, max: 1.6, paso: 0.05, valor: rug, formato: (v) => fmt(v, 2), alCambiar: (v) => { rug = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Tamaño de paso η', min: 0.01, max: 0.2, paso: 0.01, valor: eta, formato: (v) => fmt(v, 2), alCambiar: (v) => { eta = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Radio de la vecindad ε', min: 0.05, max: 3, paso: 0.05, valor: eps, formato: (v) => fmt(v, 2), alCambiar: (v) => { eps = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Inicios al azar', () => {
      const r = VIZ.semilla(semilla++ * 53);
      starts = Array.from({ length: 5 }, () => +(A + 0.3 + r() * (B - A - 0.6)).toFixed(2));
      rep.reiniciar();
    });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 270, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic sobre la curva para agregar un punto de partida (hasta 6) o arrástrelos. La franja inferior pinta cada x del color del mínimo al que llega el descenso desde allí.');

    function recalcular() { an = analizar(); leyenda.set(leyendaItems()); rep.reiniciar(); }
    function leyendaItems() {
      const it = an.mins.map((q, i) => ({ color: q.color, texto: `${q.global ? 'mínimo global' : 'mínimo local'}: x = ${fmt(q.x, 3)}, f = ${fmt(q.f, 3)}`, forma: 'punto', i }));
      it.push({ color: C.tinta2, texto: 'iterado del descenso', forma: 'punto' });
      if (an.cuenca.some((c) => c < 0)) it.push({ color: C.inactivo, texto: 'sin converger', forma: 'cuadro' });
      return it;
    }

    function iniciar() {
      runs = starts.map((x0) => ({ x: x0, tr: [x0], fin: false, dest: -1 }));
      mensaje = `${starts.length} puntos de partida. Cada paso aplica x ← x − η·f′(x) con f′ calculada numéricamente.`;
      return (function* () {
        for (let it = 1; it <= 600; it++) {
          let activos = 0;
          for (const q of runs) {
            if (q.fin) continue;
            const nx = paso(q.x);
            if (Math.abs(nx - q.x) < 1e-7) { q.fin = true; q.dest = destino(q.x, an.mins); continue; }
            q.x = nx; q.tr.push(nx); activos++;
          }
          mensaje = `Iteración ${it}: ${activos} de ${runs.length} puntos siguen bajando; |f′| máximo = ${fmt(Math.max(0, ...runs.filter((q) => !q.fin).map((q) => Math.abs(d(q.x)))))}.`;
          yield;
          if (!activos) break;
        }
        runs.forEach((q) => { if (!q.fin) { q.fin = true; q.dest = destino(q.x, an.mins); } });
        mensaje = 'Terminado: ' + runs.map((q, i) => `inicio ${i + 1} → ${q.dest < 0 ? 'sin converger' : an.mins[q.dest].global ? 'mínimo global' : 'mínimo local en x = ' + fmt(q.x, 3)}`).join('; ') + '.';
        yield;
      })();
    }

    function dibujar() {
      if (!an) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pad = 0.14 * (an.fmax - an.fmin);
      plano = VIZ.plano(lienzo, { xmin: A, xmax: B, ymin: an.fmin - pad, ymax: an.fmax + pad * 0.5 }, { etiquetaX: 'x', etiquetaY: 'f(x)' });
      plano.ejes();
      // Franja de cuencas de atracción.
      const n = an.cuenca.length, w = (plano.x1 - plano.x0) / n;
      an.cuenca.forEach((c, i) => {
        ctx.fillStyle = c < 0 ? C.inactivo : an.mins[c].color;
        ctx.fillRect(plano.x0 + i * w, plano.y0 - 9, w + 0.6, 9);
      });
      // Vecindades ε de cada mínimo.
      an.mins.forEach((q) => {
        const lo = Math.max(A, q.x - eps), hi = Math.min(B, q.x + eps);
        let ok = true;
        for (let k = 0; k <= 200; k++) if (f(lo + ((hi - lo) * k) / 200) < q.f - 1e-9) { ok = false; break; }
        q.ok = ok;
        ctx.fillStyle = VIZ.alfa(q.color, ok ? 0.16 : 0.07);
        ctx.fillRect(plano.sx(lo), plano.y1, plano.sx(hi) - plano.sx(lo), plano.y0 - plano.y1 - 10);
      });
      const pts = [];
      for (let i = 0; i <= 400; i++) { const x = A + ((B - A) * i) / 400; pts.push([x, f(x)]); }
      VIZ.trazar(ctx, plano, pts, C.tinta, 2);
      an.mins.forEach((q) => {
        const x = plano.sx(q.x), y = plano.sy(q.f);
        if (q.ok) VIZ.marcador(ctx, x, y, q.color, q.global ? 7 : 5.5, q.global ? 6 : 0);
        else {
          ctx.save(); ctx.strokeStyle = q.color; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
          ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      });
      // Iterados y puntos actuales.
      runs.forEach((q, i) => {
        ctx.fillStyle = VIZ.alfa(C.tinta2, 0.55);
        q.tr.forEach((x) => { ctx.beginPath(); ctx.arc(plano.sx(x), plano.sy(f(x)), 1.8, 0, Math.PI * 2); ctx.fill(); });
        const c = q.fin && q.dest >= 0 ? an.mins[q.dest].color : q.fin ? C.inactivo : C.tinta2;
        VIZ.marcador(ctx, plano.sx(q.x), plano.sy(f(q.x)), c, 4.5);
        ctx.save();
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(i + 1), plano.sx(starts[i]), plano.sy(f(starts[i])) - 9);
        ctx.restore();
      });
      registro.textContent = mensaje;
      const g = an.mins[an.g], fin = runs.length && runs.every((q) => q.fin);
      const alG = runs.filter((q) => q.fin && q.dest === an.g).length;
      lectura.set([
        ['mínimos locales', String(an.mins.length)],
        ['mínimo global', `x = ${fmt(g.x, 3)}, f = ${fmt(g.f, 3)}`],
        ['inicios que llegan al global', fin ? `${alG} de ${runs.length}` : '—'],
        ['cuenca del global', `${fmt(an.fracGlobal * 100, 3)} % del dominio`],
        ['mínimos válidos con ε', `${an.mins.filter((q) => q.ok).length} de ${an.mins.length}`],
      ]);
    }
    lienzo.alDibujar = dibujar;

    interaccion(lienzo, {
      asas: () => (plano ? starts.map((x) => [plano.sx(x), plano.sy(f(x))]) : []),
      clic: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return -1;
        if (starts.length >= 6) starts.shift();
        starts.push(plano.ix(x));
        return starts.length - 1;
      },
      mover: (i, x) => { starts[i] = Math.min(B, Math.max(A, plano.ix(x))); rep.reiniciar(); },
      hover: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return tip.ocultar();
        const u = plano.ix(x), dst = destino(descender(u), an.mins);
        tip.mostrar(x, y, `x = <b>${fmt(u, 3)}</b><br>f = <b>${fmt(f(u), 3)}</b><br>f′ = <b>${fmt(d(u), 3)}</b><br>descenso desde aquí → <b>${dst < 0 ? 'sin converger' : an.mins[dst].global ? 'mínimo global' : 'mínimo local x = ' + fmt(an.mins[dst].x, 3)}</b>`);
      },
      salir: () => tip.ocultar(),
    });
    an = analizar();
    leyenda.set(leyendaItems());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: paisaje en el plano ---------- */

  const DOM = { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };

  // Paisaje: suma de pozos gaussianos (depende de la semilla) o un cuenco elíptico convexo.
  function crearPaisaje(tipo, semilla) {
    if (tipo === 'convexo') {
      const a = Math.PI / 5, c = Math.cos(a), s = Math.sin(a);
      return { f: (x, y) => { const u = c * (x - 0.5) + s * (y + 0.3), v = -s * (x - 0.5) + c * (y + 0.3); return 0.25 * u * u + 0.05 * v * v; }, pozos: [] };
    }
    const K = tipo === 'dos' ? 2 : 4, r = VIZ.semilla(semilla * 7919 + K), pozos = [];
    for (let intentos = 0; pozos.length < K && intentos < 400; intentos++) {
      const p = { cx: -3.6 + 7.2 * r(), cy: -3.6 + 7.2 * r(), a: 1.6 + 1.8 * r(), s: 0.8 + 0.6 * r() };
      if (pozos.every((q) => Math.hypot(q.cx - p.cx, q.cy - p.cy) > 2.6)) pozos.push(p);
    }
    return {
      f: (x, y) => 0.04 * (x * x + y * y) - pozos.reduce((t, p) => t + p.a * Math.exp(-((x - p.cx) ** 2 + (y - p.cy) ** 2) / (2 * p.s * p.s)), 0),
      pozos,
    };
  }

  function montarDos(cuerpo) {
    let tipo = 'cuatro', semilla = 1, eta = 0.15, mostrarCuencas = true, P = [-3.2, 2.6];
    let paisaje = null, an = null, runs = [], multi = null, mensaje = '', plano = null, trayecto = [P.slice()], fin = false;
    const F = (v) => paisaje.f(v[0], v[1]);
    const limitar = (v) => v.map((q) => Math.min(5, Math.max(-5, q)));
    const norma = (g) => Math.hypot(g[0], g[1]);
    // Un paso de descenso con longitud limitada a 0.6.
    const paso = (x) => {
      const g = O.grad(F, x), n = norma(g);
      const k = Math.min(1, 0.6 / Math.max(1e-12, eta * n));
      return { x: limitar([x[0] - eta * k * g[0], x[1] - eta * k * g[1]]), g: n };
    };
    function descender(x0) {
      let x = x0.slice(), tr = [x.slice()], n = 1;
      for (let it = 0; it < 400; it++) {
        const s = paso(x);
        if (s.g < 1e-4) break;
        x = s.x; tr.push(x.slice());
      }
      n = norma(O.grad(F, x));
      return { x, tr, g: n };
    }
    // Un punto final es mínimo si el gradiente es casi nulo y la Hessiana es definida positiva.
    const esMinimo = (r) => r.g < 2e-3 && (O.clasificar(O.hess(F, r.x)) === 'mínimo local');

    function analizar() {
      const G = 28;
      const cel = [];
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const x0 = [-5 + ((i + 0.5) * 10) / G, -5 + ((j + 0.5) * 10) / G];
        const r = descender(x0);
        cel.push({ i, j, r, ok: esMinimo(r) });
      }
      const grupos = [];
      for (const c of cel) {
        if (!c.ok) { c.k = -1; continue; }
        let g = grupos.find((q) => Math.hypot(q.x[0] - c.r.x[0], q.x[1] - c.r.x[1]) < 0.35);
        if (!g) { g = { x: c.r.x, f: F(c.r.x), n: 0 }; grupos.push(g); }
        c.g = g; g.n++;
      }
      grupos.sort((a, b) => a.f - b.f);
      let loc = 0;
      grupos.forEach((g, i) => { g.global = i === 0; g.color = colorDe(g.global ? 0 : loc++, g.global); });
      cel.forEach((c) => { c.k = c.ok ? grupos.indexOf(c.g) : -1; });
      let fmn = Infinity, fmx = -Infinity;
      for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) { const v = paisaje.f(-5 + i / 6, -5 + j / 6); fmn = Math.min(fmn, v); fmx = Math.max(fmx, v); }
      return { G, cel, mins: grupos, fmin: fmn, fmax: fmx, fracGlobal: cel.filter((c) => c.k === 0).length / cel.length };
    }
    const destinoDe = (x) => {
      let m = -1, dm = 0.4;
      an.mins.forEach((q, i) => { const dd = Math.hypot(q.x[0] - x[0], q.x[1] - x[1]); if (dd < dm) { dm = dd; m = i; } });
      return m;
    };

    function recalcular() {
      paisaje = crearPaisaje(tipo, semilla);
      an = analizar();
      multi = null;
      leyenda.set(items());
      rep.reiniciar();
    }

    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Paisaje', opciones: [['cuatro', 'Cuatro pozos'], ['dos', 'Dos pozos'], ['convexo', 'Cuenco convexo']], valor: tipo, alCambiar: (v) => { tipo = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Tamaño de paso η', min: 0.02, max: 0.5, paso: 0.01, valor: eta, formato: (v) => fmt(v, 2), alSoltar: (v) => { eta = v; recalcular(); }, alCambiar: (v) => { eta = v; } });
    ctl.casilla({ etiqueta: 'Colorear las cuencas de atracción', valor: mostrarCuencas, alCambiar: (v) => { mostrarCuencas = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 3 });
    ctl.boton('Multiarranque (16)', () => {
      const r = VIZ.semilla(semilla * 31 + 5);
      multi = Array.from({ length: 16 }, () => descender([-4.6 + 9.2 * r(), -4.6 + 9.2 * r()])).map((q) => ({ ...q, k: esMinimo(q) ? destinoDe(q.x) : -1 }));
      dibujar();
    });
    ctl.boton('Nuevo paisaje', () => { semilla++; recalcular(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.82, altoMin: 300, altoMax: 480 });
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para elegir el punto de partida (círculo vacío) y pulse Reproducir. «Multiarranque» lanza 16 descensos al azar y cuenta cuántos llegan al mínimo global.');

    function items() {
      const it = an.mins.map((q) => ({ color: q.color, texto: `${q.global ? 'mínimo global' : 'mínimo local'} (${fmt(q.x[0], 2)}, ${fmt(q.x[1], 2)}), f = ${fmt(q.f, 3)}`, forma: 'punto' }));
      it.push({ color: C.s2, texto: 'trayectoria del descenso', forma: 'linea' });
      if (an.cel.some((c) => c.k < 0)) it.push({ color: C.inactivo, texto: 'sin converger a un mínimo', forma: 'cuadro' });
      return it;
    }

    function iniciar() {
      trayecto = [P.slice()];
      fin = false;
      mensaje = `Inicio en (${fmt(P[0], 3)}, ${fmt(P[1], 3)}) con f = ${fmt(F(P), 3)}. Cada paso baja en dirección −∇f, con ∇f calculado por diferencias finitas.`;
      return (function* () {
        let x = P.slice();
        for (let it = 1; it <= 400; it++) {
          const s = paso(x);
          if (s.g < 1e-4) break;
          x = s.x; trayecto.push(x.slice());
          mensaje = `Iteración ${it}: x = (${fmt(x[0], 3)}, ${fmt(x[1], 3)}), f = ${fmt(F(x), 4)}, |∇f| = ${fmt(s.g)}.`;
          yield;
        }
        fin = true;
        const k = esMinimo({ x, g: norma(O.grad(F, x)) }) ? destinoDe(x) : -1;
        mensaje = k < 0 ? 'El descenso se detuvo sin llegar a un mínimo (punto casi estacionario o límite del dominio).'
          : an.mins[k].global ? `Llegó al mínimo global en (${fmt(x[0], 3)}, ${fmt(x[1], 3)}), f = ${fmt(F(x), 4)}.`
            : `Quedó atrapado en un mínimo local: f = ${fmt(F(x), 4)}, ${fmt(F(x) - an.mins[0].f, 3)} por encima del global.`;
        yield;
      })();
    }

    function dibujar() {
      if (!an) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      if (mostrarCuencas) {
        const w = (plano.x1 - plano.x0) / an.G, h = (plano.y0 - plano.y1) / an.G;
        an.cel.forEach((c) => {
          ctx.fillStyle = VIZ.alfa(c.k < 0 ? C.inactivo : an.mins[c.k].color, c.k < 0 ? 0.3 : 0.2);
          const xa = Math.round(plano.x0 + c.i * w), xb = Math.round(plano.x0 + (c.i + 1) * w);
          const ya = Math.round(plano.y1 + (an.G - 1 - c.j) * h), yb = Math.round(plano.y1 + (an.G - c.j) * h);
          ctx.fillRect(xa, ya, xb - xa, yb - ya);
        });
      }
      const ng = 10;
      for (let k = 1; k <= ng; k++) VIZ.ml.contorno(ctx, plano, (x, y) => paisaje.f(x, y), an.fmin + ((an.fmax - an.fmin) * k * k) / (ng * ng + 4), { color: C.eje, ancho: 1 });
      if (multi) multi.forEach((q) => {
        VIZ.trazar(ctx, plano, q.tr, VIZ.alfa(C.tinta2, 0.45), 1.2);
        VIZ.marcador(ctx, plano.sx(q.x[0]), plano.sy(q.x[1]), q.k < 0 ? C.inactivo : an.mins[q.k].color, 3.5);
      });
      an.mins.forEach((q) => VIZ.marcador(ctx, plano.sx(q.x[0]), plano.sy(q.x[1]), q.color, q.global ? 7 : 5.5, q.global ? 6 : 0));
      VIZ.trazar(ctx, plano, trayecto, C.s2, 2.5);
      const u = trayecto[trayecto.length - 1];
      VIZ.marcador(ctx, plano.sx(u[0]), plano.sy(u[1]), C.s2, 5);
      ctx.save();
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
      ctx.beginPath(); ctx.arc(plano.sx(P[0]), plano.sy(P[1]), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      registro.textContent = mensaje;
      const k = fin && esMinimo({ x: u, g: norma(O.grad(F, u)) }) ? destinoDe(u) : -2;
      const ml = multi ? multi.filter((q) => q.k === 0).length : null;
      lectura.set([
        ['mínimos locales', String(an.mins.length)],
        ['f del global', an.mins.length ? fmt(an.mins[0].f, 4) : '—'],
        ['f actual', fmt(F(u), 4)],
        ['destino', k === -2 ? 'en curso' : k < 0 ? 'ninguno' : an.mins[k].global ? 'global' : 'local'],
        ['cuenca del global', `${fmt(an.fracGlobal * 100, 3)} % del dominio`],
        ['multiarranque', multi ? `${ml} de ${multi.length} al global` : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;

    interaccion(lienzo, {
      asas: () => (plano ? [[plano.sx(P[0]), plano.sy(P[1])]] : []),
      clic: (x, y) => (plano && plano.dentro(x, y) ? 0 : -1),
      mover: (i, x, y) => {
        P = [Math.min(5, Math.max(-5, plano.ix(x))), Math.min(5, Math.max(-5, plano.iy(y)))];
        rep.reiniciar();
      },
      hover: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return tip.ocultar();
        const u = [plano.ix(x), plano.iy(y)], r = descender(u), k = esMinimo(r) ? destinoDe(r.x) : -1;
        tip.mostrar(x, y, `x = <b>(${fmt(u[0], 3)}, ${fmt(u[1], 3)})</b><br>f = <b>${fmt(F(u), 3)}</b><br>el descenso desde aquí llega a: <b>${k < 0 ? 'ningún mínimo' : an.mins[k].global ? 'el mínimo global' : 'un mínimo local'}</b>`);
      },
      salir: () => tip.ocultar(),
    });
    recalcular();
  }

  VIZ.registrarTema('local-global-optima', {
    intro: String.raw`
      <p>Un <strong>óptimo local</strong> es un punto que nadie de su entorno mejora; un <strong>óptimo global</strong> es el que no mejora ningún
      punto factible. En un paisaje con varios valles, el fondo del valle más cercano es un óptimo local, pero puede estar bastante por encima del
      mejor fondo posible.</p>
      <p>Los algoritmos de descenso solo ven lo que hay a su alrededor, así que terminan en el valle donde empezaron. Aquí lo comprobará lanzándolos
      desde distintos puntos de partida, y verá cuándo el problema es tan amable que local y global son lo mismo.</p>`,
    visualizaciones: [
      {
        titulo: 'Valles en una dimensión',
        descripcion: 'Agregue puntos de partida con clic y pulse Reproducir: cada uno cae en el valle más cercano. Suba la rugosidad para crear más valles, baje a 0 y quedará una parábola con un solo mínimo; con η grande los saltos cambian de valle y la franja inferior se fragmenta.',
        montar: montarUno,
      },
      {
        titulo: 'Cuencas de atracción en el plano',
        descripcion: 'Elija el punto de partida (clic o arrastre) y observe el descenso por las curvas de nivel; las zonas coloreadas muestran a qué mínimo llega el descenso desde cada punto. Pruebe «Cuenco convexo»: ahí hay un solo mínimo y todos los caminos llegan a él.',
        montar: montarDos,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>Sea \(f : F \to \mathbb{R}\) con \(F\) el conjunto factible y \(B_\varepsilon(x^\ast) = \{x : \lVert x - x^\ast\rVert < \varepsilon\}\) la bola de radio \(\varepsilon\).</p>
      <ul>
        <li>\(x^\ast \in F\) es un <strong>mínimo local</strong> si existe \(\varepsilon > 0\) tal que \(f(x^\ast) \le f(x)\) para todo \(x \in F \cap B_\varepsilon(x^\ast)\).</li>
        <li>\(x^\ast\) es un <strong>mínimo global</strong> si \(f(x^\ast) \le f(x)\) para <em>todo</em> \(x \in F\).</li>
        <li>Es <em>estricto</em> si la desigualdad es estricta para \(x \ne x^\ast\).</li>
      </ul>
      <p>Todo mínimo global es local, pero no al revés. En la primera figura la vecindad \(\varepsilon\) hace visible el cuantificador «existe \(\varepsilon\)»: para \(\varepsilon\) pequeño todo fondo de valle cumple la definición; al agrandar el radio, los fondos menos profundos dejan de cumplirla porque la vecindad ya incluye puntos más bajos.</p>
      <h2>Descenso por gradiente</h2>
      <pre><code>x ← x₀
repetir:
    g ← ∇f(x)              (aquí, por diferencias finitas centradas)
    si |g| &lt; tolerancia: parar
    x ← x − η · g</code></pre>
      <p>El método solo mira la pendiente local, por lo que el resultado depende del punto inicial: el conjunto de puntos que terminan en un mínimo dado es su <strong>cuenca de atracción</strong>. Con un \(\eta\) pequeño, el iterado sigue el flujo \(\dot{x} = -\nabla f(x)\) y las cuencas quedan separadas por las «crestas» entre valles; con un \(\eta\) grande puede saltar la cresta y las cuencas se mezclan.</p>
      <h2>Cuándo local = global</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Si \(F\) es un conjunto convexo y \(f\) es una función convexa en \(F\), todo mínimo local es global.</p></div>
      <p><em>Demostración.</em> Sea \(x^\ast\) un mínimo local y suponga que existe \(y \in F\) con \(f(y) < f(x^\ast)\). Para \(t \in (0,1]\), el punto \(x_t = (1-t)x^\ast + t y\) está en \(F\) por convexidad y, por convexidad de \(f\),</p>
      \[ f(x_t) \le (1-t) f(x^\ast) + t f(y) < f(x^\ast). \]
      <p>Como \(x_t \to x^\ast\) cuando \(t \to 0\), hay puntos arbitrariamente cercanos a \(x^\ast\) con valor menor, lo que contradice que sea mínimo local. \(\square\)</p>
      <p>Por eso el cuenco elíptico de la segunda figura tiene una sola cuenca. Fuera de la convexidad no hay garantía: puede haber muchos mínimos locales y distinguirlos del global es, en general, un problema difícil. Se usan entonces <em>multiarranque</em> (varios descensos desde puntos distintos, como en el botón de la figura), recocido simulado o métodos de ramificación y acotamiento.</p>
      <h2>Conexiones</h2>
      <p>Aprenda a reconocer la convexidad en <a href="tema.html?id=convex-sets-functions">conjuntos y funciones convexas</a>. El descenso por gradiente se estudia con más detalle en <a href="tema.html?id=descenso-gradiente">Gradient Descent</a>, y la caracterización de los puntos candidatos en <a href="tema.html?id=stationary-points">puntos estacionarios</a>. La definición de óptimo para un modelo completo está en <a href="tema.html?id=optimization-problem-anatomy">anatomía de un problema de optimización</a>.</p>`,
  });
})();
