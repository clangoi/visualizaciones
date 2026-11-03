(function () {
  'use strict';
  const { color: C } = VIZ;
  /* ---------- Ayudantes de geometría 2-D (propios de este archivo) ---------- */

  const EPS = 1e-9;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const norma = (a) => Math.hypot(a[0], a[1]);
  const SUB = ['x₁', 'x₂', 'x₃'];
  // Texto de una forma lineal: [2, −1] → «2x₁ − x₂».
  function lineal(a) {
    let s = '';
    a.forEach((v, i) => {
      if (Math.abs(v) < 1e-12) return;
      const m = Math.abs(v), t = (m === 1 ? '' : VIZ.fmt(m)) + SUB[i];
      s += s ? (v < 0 ? ' − ' : ' + ') + t : (v < 0 ? '−' : '') + t;
    });
    return s || '0';
  }
  // Quita puntos repetidos y colineales de un polígono convexo.
  function limpiar(P) {
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const Q = [];
    for (const p of P) if (!Q.length || d(p, Q[Q.length - 1]) > 1e-7) Q.push(p);
    while (Q.length > 1 && d(Q[0], Q[Q.length - 1]) <= 1e-7) Q.pop();
    let cambio = true;
    while (cambio && Q.length > 2) {
      cambio = false;
      for (let i = 0; i < Q.length; i++) {
        const p = Q[(i + Q.length - 1) % Q.length], q = Q[i], r = Q[(i + 1) % Q.length];
        const cr = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
        if (Math.abs(cr) <= 1e-9 * d(p, q) * d(q, r)) { Q.splice(i, 1); cambio = true; break; }
      }
    }
    return Q;
  }
  // Analiza { x : A x ≤ b }: vértices reales, aristas acotadas y semirrectas (las esquinas de la caja grande son artificiales).
  function analizar(restr) {
    const P = limpiar(VIZ.opt.poligono(restr));
    const n = P.length, art = P.map((p) => Math.abs(p[0]) > 999 || Math.abs(p[1]) > 999);
    const aristas = [], rayos = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (n === 2 && i === 1) break;
      if (n < 2 || j === i) break;
      if (!art[i] && !art[j]) aristas.push([P[i], P[j]]);
      else if (!art[i] && art[j]) rayos.push({ o: P[i], d: unit([P[j][0] - P[i][0], P[j][1] - P[i][1]]) });
      else if (art[i] && !art[j]) rayos.push({ o: P[j], d: unit([P[i][0] - P[j][0], P[i][1] - P[j][1]]) });
    }
    const V = P.filter((_, i) => !art[i]);
    return { P, V, aristas, rayos, acotado: n > 0 && !art.some(Boolean), vacio: n === 0 };
  }
  function unit(v) { const L = norma(v) || 1; return [v[0] / L, v[1] / L]; }
  // Direcciones extremas distintas (de las semirrectas del borde).
  function direcciones(an) {
    const D = [];
    for (const r of an.rayos) if (!D.some((d) => dot(d, r.d) > 1 - 1e-9)) D.push(r.d);
    return D;
  }
  // max c·x sobre la región: { estado: 'vacio' | 'noacotado' | 'optimo', z, V (vértices óptimos), semirrectas (óptimas), tipo }.
  function resolver2d(restr, c, an = analizar(restr)) {
    if (an.vacio) return { estado: 'vacio', an };
    const D = direcciones(an);
    if (D.some((d) => dot(c, d) > 1e-9)) return { estado: 'noacotado', an, dir: D.find((d) => dot(c, d) > 1e-9) };
    let z = -Infinity;
    for (const p of an.V) z = Math.max(z, dot(c, p));
    const V = an.V.filter((p) => dot(c, p) >= z - 1e-9);
    const sem = an.rayos.filter((r) => Math.abs(dot(c, r.d)) <= 1e-9 && V.some((p) => Math.hypot(p[0] - r.o[0], p[1] - r.o[1]) < 1e-7));
    const tipo = sem.length ? 'semirrecta' : V.length > 1 ? 'arista' : 'vertice';
    return { estado: 'optimo', an, z, V, semirrectas: sem, tipo };
  }
  function area(P) {
    let s = 0;
    P.forEach((p, i) => { const q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; });
    return Math.abs(s) / 2;
  }
  // Activas en un punto: índices i con |aᵢ·x − bᵢ| ≤ tol.
  const activas = (restr, p, tol = 1e-7) => restr.map((r, i) => (Math.abs(dot(r.a, p) - r.b) <= tol ? i : -1)).filter((i) => i >= 0);

  /* ---------- Dibujo 2-D ---------- */

  // Plano con la misma escala en ambos ejes (para que las perpendiculares se vean perpendiculares).
  function planoIgual(l, d) {
    const margen = { izq: 34, der: 12, sup: 16, inf: 30 };
    const pw = l.ancho - margen.izq - margen.der, ph = l.alto - margen.sup - margen.inf;
    const s = Math.min(pw / (d.xmax - d.xmin), ph / (d.ymax - d.ymin));
    const cx = (d.xmin + d.xmax) / 2, cy = (d.ymin + d.ymax) / 2, hx = pw / s / 2, hy = ph / s / 2;
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen, etiquetaX: 'x₁', etiquetaY: 'x₂' });
  }
  function poligono(ctx, pl, P, relleno, borde, ancho = 2) {
    if (P.length < 2) return;
    ctx.save();
    pl.recortar();
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(pl.sx(p[0]), pl.sy(p[1])) : ctx.moveTo(pl.sx(p[0]), pl.sy(p[1]))));
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = ancho; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
  }
  // Recta a·x = b recortada al gráfico.
  function recta(ctx, pl, a, b, color, ancho = 2, guion) {
    const d = pl.d, ext = 60;
    let p, q;
    if (Math.abs(a[1]) >= Math.abs(a[0])) {
      const x0 = d.xmin - ext, x1 = d.xmax + ext;
      p = [x0, (b - a[0] * x0) / a[1]]; q = [x1, (b - a[0] * x1) / a[1]];
    } else {
      const y0 = d.ymin - ext, y1 = d.ymax + ext;
      p = [(b - a[1] * y0) / a[0], y0]; q = [(b - a[1] * y1) / a[0], y1];
    }
    ctx.save();
    pl.recortar();
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    if (guion) ctx.setLineDash(guion);
    ctx.beginPath(); ctx.moveTo(pl.sx(p[0]), pl.sy(p[1])); ctx.lineTo(pl.sx(q[0]), pl.sy(q[1])); ctx.stroke();
    ctx.restore();
  }
  function flecha(ctx, x0, y0, x1, y1, color, ancho = 2) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 3) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, h = Math.min(11, L * 0.6);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * h * 0.6, y1 - uy * h * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - ux * h + uy * h * 0.45, y1 - uy * h - ux * h * 0.45);
    ctx.lineTo(x1 - ux * h - uy * h * 0.45, y1 - uy * h + ux * h * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Flecha en coordenadas de datos.
  const flechaD = (ctx, pl, o, f, color, ancho) => flecha(ctx, pl.sx(o[0]), pl.sy(o[1]), pl.sx(f[0]), pl.sy(f[1]), color, ancho);
  function texto(ctx, t, x, y, color, alin = 'left', px = 11, peso = 400) {
    ctx.save();
    ctx.font = VIZ.fuente(px, peso); ctx.fillStyle = color; ctx.textAlign = alin; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
    ctx.restore();
  }
  // Arrastre con puntero: tomar(x, y) devuelve true si captura; mover(x, y) mientras se arrastra; pasar(x, y) sin botón.
  function interaccion(lienzo, { tomar, mover, pasar, salir }) {
    const cv = lienzo.canvas;
    let activo = false;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (ev) => {
      const p = lienzo.posicion(ev);
      if (tomar(p.x, p.y)) { activo = true; cv.setPointerCapture(ev.pointerId); ev.preventDefault(); }
    });
    cv.addEventListener('pointermove', (ev) => {
      const p = lienzo.posicion(ev);
      if (activo) mover(p.x, p.y); else if (pasar) pasar(p.x, p.y);
    });
    const fin = () => { activo = false; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (!activo && salir) salir(); });
  }
  const dentroDe = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ALTO_PLANO = { proporcion: 0.78, altoMin: 290, altoMax: 470 };

  // Problemas de ejemplo: max c·x  s.a.  R x ≤ b, x ≥ 0 (las restricciones R tienen b ≥ 0).
  const PROBLEMAS = {
    simple: {
      nombre: 'Sin degeneración', R: [{ a: [1, 1], b: 8 }, { a: [1, 3], b: 15 }, { a: [3, 1], b: 18 }],
    },
    degenerado: {
      nombre: 'Con un vértice degenerado', R: [{ a: [1, 3], b: 15 }, { a: [3, 1], b: 18 }, { a: [2, 1], b: 13 }, { a: [1, 1], b: 8 }],
    },
  };
  const OPC_PROBLEMA = Object.entries(PROBLEMAS).map(([k, v]) => [k, v.nombre]);
  const SIGNO = [{ a: [-1, 0], b: 0, nombre: 'x₁ ≥ 0' }, { a: [0, -1], b: 0, nombre: 'x₂ ≥ 0' }];
  // Lista completa con nombre y color: x₁ ≥ 0, x₂ ≥ 0, R1, R2, …
  const completas = (clave) => [...SIGNO, ...PROBLEMAS[clave].R.map((r, i) => ({ ...r, nombre: `R${i + 1}` }))].map((r, i) => ({ ...r, color: VIZ.series[i] }));
  const VARS = (m) => ['x₁', 'x₂', ...Array.from({ length: m }, (_, i) => `s${'₁₂₃₄₅₆₇₈'[i]}`)];
  const DOM = { xmin: -1, xmax: 10, ymin: -1, ymax: 9 };

  /* ---------- Fig. 1: restricciones activas ---------- */

  function montarActivas(cuerpo) {
    let clave = 'simple', snap = true, P = [3, 2], pl = null, iv = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: OPC_PROBLEMA, valor: clave, alCambiar: (v) => { clave = v; iv = 0; irAVertice(); } });
    ctl.casilla({ etiqueta: 'Imantar a vértices y aristas', valor: snap, alCambiar: (v) => { snap = v; } });
    ctl.boton('Siguiente vértice', () => { iv++; irAVertice(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    const leyenda = VIZ.leyenda(cuerpo);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre el punto P (con el imán activo se pega a vértices y aristas) o pulse «Siguiente vértice». Una restricción está activa cuando se cumple con igualdad: P está sobre su recta.');
    const rango2 = (S) => (S.length >= 2 && S.some((r, i) => S.some((q, j) => j > i && Math.abs(r.a[0] * q.a[1] - r.a[1] * q.a[0]) > 1e-9)) ? 2 : S.length ? 1 : 0);
    function irAVertice() {
      const an = analizar(completas(clave));
      const V = an.V.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      P = V[iv % V.length].slice();
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, DOM);
      pl.ejes();
      const R = completas(clave), an = analizar(R);
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.15), null);
      const act = activas(R, P, 1e-6);
      R.forEach((r, i) => recta(ctx, pl, r.a, r.b, r.color, act.includes(i) ? 4 : 1.8));
      poligono(ctx, pl, an.P, null, C.s6, 2);
      for (const v of an.V) VIZ.marcador(ctx, pl.sx(v[0]), pl.sy(v[1]), C.tinta, 4);
      VIZ.marcador(ctx, pl.sx(P[0]), pl.sy(P[1]), C.s7, 8);
      texto(ctx, 'P', pl.sx(P[0]) + 11, pl.sy(P[1]) - 11, C.tinta, 'left', 13, 600);
      leyenda.set([
        ...R.map((r) => ({ color: r.color, texto: r.nombre === 'x₁ ≥ 0' || r.nombre === 'x₂ ≥ 0' ? r.nombre : `${r.nombre}: ${lineal(r.a)} ≤ ${r.b}`, forma: 'linea' })),
        { color: VIZ.alfa(C.s6, 0.3), texto: 'región factible', forma: 'cuadro' },
        { color: C.s7, texto: 'punto P (trazo grueso = restricción activa en P)', forma: 'punto' },
      ]);
      const factible = R.every((r) => dot(r.a, P) <= r.b + 1e-6);
      lista.replaceChildren(...R.map((r, i) => {
        const h = r.b - dot(r.a, P), on = act.includes(i);
        return VIZ.el('div', { class: on ? 'activa' : '' }, VIZ.el('span', { style: { color: r.color, fontWeight: '600' } }, r.nombre.padEnd(6, '\u00a0')),
          lineal(r.a).padEnd(12, '\u00a0'), ` holgura\u00a0${VIZ.fmt(Math.abs(h) < 1e-9 ? 0 : h, 3).padStart(7, '\u00a0')}\u00a0\u00a0\u00a0`, on ? '= activa' : h < 0 ? 'violada' : 'inactiva');
      }));
      const S = act.map((i) => R[i]), rk = rango2(S);
      const tipo = !factible ? 'fuera de la región factible' : act.length === 0 ? 'punto interior' : act.length === 1 ? 'punto de una arista'
        : rk < 2 ? 'restricciones activas dependientes' : act.length === 2 ? 'vértice (2 activas independientes)' : `vértice degenerado (${act.length} activas)`;
      registro.textContent = `${act.length ? `Activas en P: ${act.map((i) => R[i].nombre).join(', ')}. ` : 'Ninguna restricción está activa en P. '}${tipo === 'vértice (2 activas independientes)' ? 'Dos rectas no paralelas se cortan en un único punto: P queda determinado por ellas, es un vértice.' : tipo === 'punto de una arista' ? 'Una sola restricción activa deja un grado de libertad: P puede deslizarse a lo largo de la recta.' : tipo.startsWith('vértice degenerado') ? 'Hay más restricciones activas que dimensiones: tres rectas pasan por el mismo punto.' : ''}`;
      lectura.set([
        ['restricciones activas', String(act.length)],
        ['rango de sus normales', String(rk)],
        ['tipo de punto', tipo],
        ['P', `(${VIZ.fmt(P[0], 3)}, ${VIZ.fmt(P[1], 3)})`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'grab';
    const mover = (x, y) => {
      let p = [dentroDe(pl.ix(x), DOM.xmin, DOM.xmax), dentroDe(pl.iy(y), DOM.ymin, DOM.ymax)];
      if (snap) {
        const R = completas(clave), an = analizar(R);
        const v = an.V.find((q) => Math.hypot(pl.sx(q[0]) - x, pl.sy(q[1]) - y) < 14);
        if (v) p = v.slice();
        else {
          let mejor = null, md = 9;
          R.forEach((r) => {
            const t = (dot(r.a, p) - r.b) / dot(r.a, r.a), q = [p[0] - t * r.a[0], p[1] - t * r.a[1]], d = Math.hypot(pl.sx(q[0]) - x, pl.sy(q[1]) - y);
            if (d < md && R.every((s) => dot(s.a, q) <= s.b + 1e-7)) { md = d; mejor = q; }
          });
          if (mejor) p = mejor;
        }
      }
      P = p;
      dibujar();
    };
    interaccion(lienzo, {
      tomar: (x, y) => { if (!pl) return false; mover(x, y); return true; },
      mover,
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const R = completas(clave), an = analizar(R);
        const v = an.V.find((q) => Math.hypot(pl.sx(q[0]) - x, pl.sy(q[1]) - y) < 10);
        if (v) tip.mostrar(x, y, `vértice (<b>${VIZ.fmt(v[0], 3)}</b>, <b>${VIZ.fmt(v[1], 3)}</b>)<br>activas: <b>${activas(R, v, 1e-6).map((i) => R[i].nombre).join(', ')}</b>`);
        else tip.ocultar();
      },
      salir: () => tip.ocultar(),
    });
    irAVertice();
  }

  /* ---------- Fig. 2: de la forma estándar a las bases ---------- */

  // Todas las bases de [A I] para R x + s = b: { base, x (n + m valores), factible, singular }.
  function bases(R) {
    const m = R.length, N = 2 + m, b = R.map((r) => r.b);
    const col = (j) => R.map((r, i) => (j < 2 ? r.a[j] : i === j - 2 ? 1 : 0));
    const cols = Array.from({ length: N }, (_, j) => col(j));
    const res = [];
    const elegir = (ini, acc) => {
      if (acc.length === m) { res.push(acc.slice()); return; }
      for (let j = ini; j < N; j++) { acc.push(j); elegir(j + 1, acc); acc.pop(); }
    };
    elegir(0, []);
    return res.map((B) => {
      const M = R.map((_, i) => B.map((j) => cols[j][i])), sol = VIZ.opt.resolver(M, b);
      if (!sol) return { base: B, singular: true };
      const x = Array(N).fill(0);
      B.forEach((j, k) => { x[j] = Math.abs(sol[k]) < 1e-9 ? 0 : sol[k]; });
      return { base: B, x, factible: x.every((v) => v >= -1e-9), singular: false };
    });
  }

  function montarBases(cuerpo) {
    let clave = 'simple', verInf = true, sel = 0, pl = null, filas = [], R = [], puntos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: OPC_PROBLEMA, valor: clave, alCambiar: (v) => { clave = v; sel = 0; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar soluciones básicas infactibles', valor: verInf, alCambiar: (v) => { verInf = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'solución básica factible (vértice)', forma: 'punto' },
      { color: C.s8, texto: 'solución básica infactible (alguna variable < 0)', forma: 'punto' },
      { color: C.s7, texto: 'base seleccionada', forma: 'punto' },
      { color: C.tenue, texto: 'rectas xⱼ = 0 y sᵢ = 0', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.3), texto: 'región factible', forma: 'cuadro' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila de la tabla o en un punto del gráfico para elegir una base. Las variables fuera de la base valen 0, es decir, sus rectas se cortan en el punto: cada base es la intersección de dos rectas. Solo algunas intersecciones caen en la región.');
    const NOM = () => VARS(R.length);
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, DOM);
      pl.ejes();
      const lista = completas(clave);
      R = PROBLEMAS[clave].R;
      const an = analizar(lista), nombres = NOM();
      filas = bases(R);
      puntos = filas.map((f, i) => ({ f, i })).filter(({ f }) => !f.singular && (verInf || f.factible)).map(({ f, i }) => ({ i, p: [f.x[0], f.x[1]], factible: f.factible }));
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.15), C.s6, 2);
      lista.forEach((r) => recta(ctx, pl, r.a, r.b, C.tenue, 1.5));
      const fs = filas[sel];
      if (fs && !fs.singular) fs.base && nombres.forEach((_, j) => {
        if (fs.base.includes(j)) return;
        const r = j < 2 ? SIGNO[j] : R[j - 2];
        recta(ctx, pl, r.a, r.b, C.s7, 3);
      });
      const fuera = puntos.filter(({ p }) => p[0] > DOM.xmax || p[1] > DOM.ymax || p[0] < DOM.xmin || p[1] < DOM.ymin).length;
      for (const { i, p, factible } of puntos) {
        if (p[0] > DOM.xmax || p[1] > DOM.ymax) continue;
        VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), factible ? C.s6 : C.s8, factible ? 6 : 4.5, factible ? 0 : 5);
        void i;
      }
      if (fs && !fs.singular) VIZ.marcador(ctx, pl.sx(fs.x[0]), pl.sy(fs.x[1]), C.s7, 8, 3);
      // Tabla
      const m = R.length, Nn = 2 + m;
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'base'), ...nombres.map((n) => VIZ.el('th', null, n)), VIZ.el('th', null, 'estado')),
        ...filas.map((f, i) => VIZ.el('tr', { class: 'clicable' + (i === sel ? ' activa' : ''), onclick: () => { sel = i; dibujar(); } },
          VIZ.el('td', { class: 'izq' }, `{${f.base.map((j) => nombres[j]).join(', ')}}`),
          ...Array.from({ length: Nn }, (_, j) => (f.singular ? VIZ.el('td', { class: 'vacia' }, '—')
            : VIZ.el('td', { style: { color: f.x[j] < -1e-9 ? C.s8 : null, fontWeight: f.base.includes(j) ? '600' : null } }, VIZ.fmt(f.x[j], 3)))),
          VIZ.el('td', null, f.singular ? 'singular' : f.factible ? 'BFS' : 'infactible')))));
      const total = filas.length, sing = filas.filter((f) => f.singular).length, fact = filas.filter((f) => f.factible);
      const distintos = new Set(fact.map((f) => `${VIZ.fmt(f.x[0], 6)},${VIZ.fmt(f.x[1], 6)}`)).size;
      if (fs && !fs.singular) {
        const nul = nombres.filter((_, j) => !fs.base.includes(j));
        registro.textContent = `Base {${fs.base.map((j) => nombres[j]).join(', ')}}: fuera de la base ${nul.join(' = ')} = 0 (rectas en trazo violeta); su intersección es (${VIZ.fmt(fs.x[0], 3)}, ${VIZ.fmt(fs.x[1], 3)}). ${fs.factible ? 'Todas las variables son ≥ 0: es una solución básica factible, un vértice.' : `Hay variables negativas (${nombres.filter((_, j) => fs.x[j] < -1e-9).join(', ')}): cae fuera de la región.`}`;
      } else registro.textContent = 'Esta base es singular: sus columnas son dependientes y no define un punto.';
      lectura.set([
        [`bases posibles C(${Nn}, ${m})`, String(total)],
        ['singulares', String(sing)],
        ['soluciones básicas factibles', String(fact.length)],
        ['vértices distintos', String(distintos)],
        ['fuera del gráfico', String(fuera)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    const cerca = (x, y) => puntos.filter(({ p }) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 10);
    interaccion(lienzo, {
      tomar: (x, y) => {
        if (!pl) return false;
        const c = cerca(x, y);
        if (c.length) { const k = c.findIndex(({ i }) => i === sel); sel = c[(k + 1) % c.length].i; dibujar(); }
        return false;
      },
      mover: () => {},
      pasar: (x, y) => {
        if (!pl) return;
        const c = cerca(x, y);
        if (!c.length) return tip.ocultar();
        const nombres = NOM();
        tip.mostrar(x, y, `punto (<b>${VIZ.fmt(c[0].p[0], 3)}</b>, <b>${VIZ.fmt(c[0].p[1], 3)}</b>) · ${c[0].factible ? 'factible' : 'infactible'}<br>` + c.map(({ i }) => `base {${filas[i].base.map((j) => nombres[j]).join(', ')}}`).join('<br>'));
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Fig. 3: el Simplex recorre vértices ---------- */

  function montarSimplex(cuerpo) {
    let clave = 'degenerado', ang = 30, regla = 'dantzig', est = null, tray = [], hist = [], pasosDeg = 0, mensaje = '', pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: OPC_PROBLEMA, valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Dirección del objetivo c', min: 0, max: 355, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Regla de entrada', opciones: [['dantzig', 'Dantzig (mayor costo reducido)'], ['bland', 'Bland (menor índice)']], valor: regla, alCambiar: (v) => { regla = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'camino del Simplex (vértice a vértice)', forma: 'linea' },
      { color: C.s6, texto: 'vértice actual', forma: 'punto' },
      { color: C.s7, texto: 'curva de nivel de c en el vértice actual', forma: 'linea' },
      { color: C.s1, texto: 'restricciones activas en el vértice actual', forma: 'linea' },
      { color: VIZ.alfa(C.s6, 0.3), texto: 'región factible', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso». Cada iteración del tableau es una base y, geométricamente, un vértice; entrar y salir una variable equivale a cambiar una restricción activa por otra. Con el problema degenerado y c a 30° hay un pivote que no mueve el punto.');
    const cvec = () => [Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)];
    function iniciar() {
      est = null; tray = []; hist = []; pasosDeg = 0; mensaje = 'Se parte del origen: x₁ = x₂ = 0 (restricciones x₁ ≥ 0 y x₂ ≥ 0 activas), todas las holguras en la base.';
      const R = PROBLEMAS[clave].R, gen = VIZ.opt.simplex(cvec(), R.map((r) => r.a), R.map((r) => r.b), { regla });
      return (function* () {
        for (const s of gen) {
          est = s;
          tray.push(s.x.map((v) => (Math.abs(v) < 1e-9 ? 0 : v)));
          const N = s.nombres, base = s.base.map((i) => N[i]).join(', ');
          if (s.estado === 'optimo') mensaje = `Óptimo: todos los costos reducidos son ≥ 0, así que ningún cambio de restricción activa mejora z. z = ${VIZ.fmt(s.z)} en (${s.x.map((v) => VIZ.fmt(v, 3)).join(', ')}).`;
          else if (s.estado === 'iterando') {
            const rr = s.razones[s.sale], degen = rr < 1e-9;
            if (degen) pasosDeg++;
            mensaje = `Iteración ${s.it}: entra ${N[s.entra]} (costo reducido ${VIZ.fmt(s.T[s.T.length - 1][s.entra])}), sale ${N[s.base[s.sale]]} (razón mínima ${VIZ.fmt(rr)}). ${degen ? 'Razón 0: paso degenerado, la base cambia pero el vértice es el mismo.' : 'Se avanza por una arista hasta el siguiente vértice.'}`;
          } else mensaje = s.estado === 'ciclaje' ? 'Se alcanzó el máximo de iteraciones (posible ciclaje).' : 'Problema no acotado.';
          hist.push([s.it, `{${base}}`, `(${s.x.map((v) => VIZ.fmt(v, 3)).join(', ')})`, VIZ.fmt(s.z)]);
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, DOM);
      pl.ejes();
      const R = completas(clave), an = analizar(R);
      poligono(ctx, pl, an.P, VIZ.alfa(C.s6, 0.15), null);
      R.forEach((r) => recta(ctx, pl, r.a, r.b, C.tenue, 1.5));
      poligono(ctx, pl, an.P, null, C.s6, 2);
      const cur = est ? est.x.map((v) => (Math.abs(v) < 1e-9 ? 0 : v)) : [0, 0];
      const c = cvec();
      if (est) {
        activas(R, cur, 1e-7).forEach((i) => recta(ctx, pl, R[i].a, R[i].b, C.s1, 3));
        recta(ctx, pl, c, dot(c, cur), C.s7, 1.8, [6, 4]);
      }
      for (let k = 1; k < tray.length; k++) {
        if (Math.hypot(tray[k][0] - tray[k - 1][0], tray[k][1] - tray[k - 1][1]) > 1e-9) flechaD(ctx, pl, tray[k - 1], tray[k], C.s2, 3);
      }
      tray.forEach((p, k) => { if (k < tray.length - 1) VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), C.s2, 4.5); });
      VIZ.marcador(ctx, pl.sx(cur[0]), pl.sy(cur[1]), C.s6, 8);
      flechaD(ctx, pl, [8.3, 0.2], [8.3 + 1.2 * c[0], 0.2 + 1.2 * c[1]], C.s7, 2.5);
      texto(ctx, 'c', pl.sx(8.3 + 1.2 * c[0]) + 8, pl.sy(0.2 + 1.2 * c[1]) - 6, C.tinta, 'left', 12, 600);
      registro.textContent = mensaje;
      lista.replaceChildren(...(hist.length ? hist.map((h, k) => VIZ.el('div', { class: k === hist.length - 1 ? 'activa' : '' }, `it ${h[0]}  base ${h[1]}  vértice ${h[2]}  z = ${h[3]}`)) : [VIZ.el('div', null, 'Pulse «Un paso» o «Hasta el final».')]));
      const act = activas(R, cur, 1e-7).map((i) => R[i].nombre);
      lectura.set([
        ['iteración', est ? String(est.it) : '—'],
        ['z actual', est ? VIZ.fmt(est.z) : '—'],
        ['vértice', `(${cur.map((v) => VIZ.fmt(v, 3)).join(', ')})`],
        ['restricciones activas', act.join(', ') || '—'],
        ['pasos degenerados', String(pasosDeg)],
        ['estado', est ? est.estado === 'optimo' ? 'óptimo' : est.estado === 'iterando' ? 'iterando' : est.estado : 'sin empezar'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl) return;
      const R = completas(clave), an = analizar(R), v = an.V.find((q) => Math.hypot(pl.sx(q[0]) - x, pl.sy(q[1]) - y) < 10);
      if (!v) return tip.ocultar();
      tip.mostrar(x, y, `vértice (<b>${VIZ.fmt(v[0], 3)}</b>, <b>${VIZ.fmt(v[1], 3)}</b>)<br>c·x = <b>${VIZ.fmt(dot(cvec(), v))}</b><br>activas: ${activas(R, v, 1e-6).map((i) => R[i].nombre).join(', ')}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('active-constraints-bfs', {
    intro: String.raw`
      <p>Una restricción \(a_i^\top x\le b_i\) está <strong>activa</strong> en un punto cuando se cumple con igualdad: el punto está sobre su frontera. En un punto interior no hay
      ninguna activa; sobre una arista hay una; y en un <strong>vértice</strong> hay al menos tantas, y linealmente independientes, como dimensiones tiene el espacio.</p>
      <p>Al pasar a <a href="tema.html?id=standard-form">forma estándar</a> con variables de holgura, «restricción activa» se traduce en «holgura igual a cero», y un vértice se convierte en una
      <strong>solución básica factible</strong>: las variables que valen cero fuera de la base son justamente las restricciones activas. Así, moverse de vértice en vértice es cambiar de base.</p>`,
    visualizaciones: [
      {
        titulo: 'Restricciones activas en cada punto',
        descripcion: 'Arrastre P y observe cuántas rectas pasan por él: ninguna dentro, una en una arista, dos en un vértice. Con el problema degenerado, el vértice (5, 3) tiene tres restricciones activas.',
        montar: montarActivas,
      },
      {
        titulo: 'Bases y soluciones básicas',
        descripcion: 'Cada fila es una elección de qué variables dejar fuera de la base. Elija filas y vea que su punto es la intersección de dos rectas; solo las de variables todas ≥ 0 son vértices. En el problema degenerado, varias bases comparten un mismo vértice.',
        montar: montarBases,
      },
      {
        titulo: 'El Simplex recorre bases y vértices',
        descripcion: 'Avance paso a paso: cada pivote cambia una restricción activa por otra y mueve P por una arista. Cambie c, la regla de entrada o el problema; con el degenerado a 30° observe un pivote que cambia de base sin mover el punto.',
        montar: montarSimplex,
      },
    ],
    teoria: String.raw`
      <h2>Restricciones activas y vértices</h2>
      <p>Sea \(P=\{x\in\mathbb{R}^n: a_i^\top x\le b_i,\ i=1,\dots,m\}\) y \(\bar x\in P\). El conjunto de índices activos es \(I(\bar x)=\{i : a_i^\top\bar x=b_i\}\).
      Entonces \(\bar x\) es un <a href="tema.html?id=polyhedra-vertices">vértice</a> si y solo si \(\{a_i : i\in I(\bar x)\}\) contiene \(n\) vectores linealmente independientes, es decir, si el sistema
      \(a_i^\top x=b_i\), \(i\in I(\bar x)\), tiene como única solución \(\bar x\). En el plano: dos rectas no paralelas.</p>
      <h2>Forma estándar y soluciones básicas</h2>
      <p>El problema \(\max c^\top x\) sujeto a \(Ax\le b,\ x\ge0\) se escribe con holguras \(s\ge0\) como</p>
      \[ \max\ c^\top x \quad\text{s.a.}\quad Ax + Is = b,\quad x,s\ge0, \]
      <p>con \(m\) ecuaciones y \(n+m\) variables. Una <strong>base</strong> \(B\) es un conjunto de \(m\) columnas de \([A\ I]\) linealmente independientes; la <strong>solución básica</strong> asociada fija en cero las
      \(n\) variables no básicas y resuelve \(B x_B=b\). Es <strong>factible</strong> si \(x_B\ge0\). Hay a lo sumo \(\binom{n+m}{m}\) bases.</p>
      <div class="recuadro"><p><strong>Teorema (vértice ⇔ solución básica factible).</strong> \(\bar x\) es vértice de \(\{x\ge0 : Ax\le b\}\) si y solo si su extensión \((\bar x,\ b-A\bar x)\) es una solución básica factible
      de la forma estándar. Las variables nulas fuera de la base son las restricciones activas: \(x_j=0\) (signo) o \(s_i=0\) (la restricción \(i\) está activa).</p></div>
      <h2>Degeneración</h2>
      <p>Si más de \(n\) restricciones son activas en un vértice, varias bases distintas representan el mismo punto: alguna variable <em>básica</em> vale cero. Se dice que el vértice (o la solución) es <strong>degenerado</strong>.
      Un pivote del Simplex que entra en un vértice así puede tener razón mínima 0 y cambiar de base sin moverse; si no se cuida la regla de entrada, puede incluso ciclar
      (véase <a href="tema.html?id=degeneracy-cycling">degeneración y ciclaje</a>).</p>
      <pre><code>enumerar vértices:  para cada base B de [A I]:
                        resolver B x_B = b;  si x_B ≥ 0: guardar el punto (x₁, …, x_n)
Simplex:            elegir una base factible inicial
                    mientras algún costo reducido sea negativo:
                        entra la variable j; sale la fila de razón mínima b_i / a_ij
                        pivotear  →  nueva base = vértice vecino</code></pre>
      <p>Un vértice es óptimo si y solo si ningún vecino mejora; véase <a href="tema.html?id=basic-feasible-solutions">soluciones básicas factibles</a>, <a href="tema.html?id=simplex-tableau">el tableau Simplex</a>
      y <a href="tema.html?id=extreme-points-directions">puntos extremos</a>.</p>`,
  });
})();
