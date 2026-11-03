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

  // Envoltura convexa (cadena monótona): índices de los vértices en sentido antihorario.
  function envoltura(pts) {
    const idx = pts.map((_, i) => i).sort((i, j) => pts[i][0] - pts[j][0] || pts[i][1] - pts[j][1]);
    const cr = (o, a, b) => (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
    const mitad = (orden) => {
      const h = [];
      for (const i of orden) {
        while (h.length >= 2 && cr(h[h.length - 2], h[h.length - 1], i) <= 1e-12) h.pop();
        h.push(i);
      }
      h.pop();
      return h;
    };
    if (pts.length < 3) return idx;
    return mitad(idx).concat(mitad(idx.slice().reverse()));
  }

  /* ---------- Fig. 1: pesos y coordenadas baricéntricas ---------- */

  function montarMezcla(cuerpo) {
    const V = [[1.5, 1.5], [8.5, 2.5], [4.5, 7]];
    const COL = [C.s1, C.s2, C.s3], NOM = ['A', 'B', 'C'];
    let lam = [0.4, 0.35, 0.25], pl = null, arrastre = -1;
    const ctl = VIZ.controles(cuerpo);
    const sl = NOM.map((n, i) => ctl.rango({
      etiqueta: `λ${'₁₂₃'[i]} (peso de ${n})`, min: 0, max: 1, paso: 0.01, valor: lam[i], formato: (v) => VIZ.fmt(v, 2),
      alCambiar: (v) => fijar(i, v),
    }));
    ctl.boton('Pesos iguales', () => { lam = [1 / 3, 1 / 3, 1 / 3]; sincronizar(); dibujar(); });
    ctl.boton('Vértices por defecto', () => { V[0] = [1.5, 1.5]; V[1] = [8.5, 2.5]; V[2] = [4.5, 7]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'A', forma: 'punto' }, { color: C.s2, texto: 'B', forma: 'punto' }, { color: C.s3, texto: 'C', forma: 'punto' },
      { color: VIZ.alfa(C.s2, 0.3), texto: 'subtriángulo opuesto a un vértice: su área relativa es su peso', forma: 'cuadro' },
      { color: C.tinta, texto: 'P = λ₁A + λ₂B + λ₃C', forma: 'punto' },
      { color: C.s8, texto: 'P fuera del triángulo (algún λ < 0)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre P (los pesos se recalculan), un vértice (P lo sigue con los mismos pesos) o los deslizadores. Fuera del triángulo los pesos suman 1 pero uno es negativo: es una combinación afín, no convexa.');

    const punto = () => [lam[0] * V[0][0] + lam[1] * V[1][0] + lam[2] * V[2][0], lam[0] * V[0][1] + lam[1] * V[1][1] + lam[2] * V[2][1]];
    function baricentricas(p) {
      const det = (V[0][0] - V[2][0]) * (V[1][1] - V[2][1]) - (V[1][0] - V[2][0]) * (V[0][1] - V[2][1]);
      if (Math.abs(det) < 1e-6) return null;
      const l1 = ((p[0] - V[2][0]) * (V[1][1] - V[2][1]) - (V[1][0] - V[2][0]) * (p[1] - V[2][1])) / det;
      const l2 = ((V[0][0] - V[2][0]) * (p[1] - V[2][1]) - (p[0] - V[2][0]) * (V[0][1] - V[2][1])) / det;
      return [l1, l2, 1 - l1 - l2];
    }
    function fijar(i, v) {
      const resto = 1 - v, s = lam.reduce((t, x, j) => (j === i ? t : t + Math.max(0, x)), 0);
      lam = lam.map((x, j) => (j === i ? v : s > 1e-9 ? (Math.max(0, x) * resto) / s : resto / 2));
      sincronizar();
      dibujar();
    }
    function sincronizar() { sl.forEach((s, i) => { s.valor = dentroDe(lam[i], 0, 1); }); }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: 0, xmax: 10, ymin: 0, ymax: 8.5 });
      pl.ejes();
      const P = punto(), dentro = lam.every((l) => l >= -1e-9);
      const px = (p) => [pl.sx(p[0]), pl.sy(p[1])];
      poligono(ctx, pl, V, VIZ.alfa(C.tinta, 0.04), C.tinta2, 2);
      if (dentro) {
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3, k = (i + 2) % 3;
          poligono(ctx, pl, [P, V[j], V[k]], VIZ.alfa(COL[i], 0.3), null);
        }
      }
      ctx.save();
      ctx.strokeStyle = dentro ? C.tinta2 : C.s8; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]);
      for (const v of V) { const [x0, y0] = px(P), [x1, y1] = px(v); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      ctx.restore();
      V.forEach((v, i) => {
        const [x, y] = px(v);
        VIZ.marcador(ctx, x, y, COL[i], 7);
        texto(ctx, `${NOM[i]} (${VIZ.fmt(lam[i], 2)})`, x + (i === 1 ? -12 : 12), y + (i === 2 ? -14 : 16), C.tinta, i === 1 ? 'right' : 'left', 12, 600);
      });
      VIZ.marcador(ctx, ...px(P), dentro ? C.tinta : C.s8, 6, dentro ? 0 : 5);
      texto(ctx, 'P', px(P)[0] + 10, px(P)[1] - 10, dentro ? C.tinta : C.s8, 'left', 12, 600);
      const soporte = lam.filter((l) => l > 1e-9).length;
      const clase = !dentro ? 'combinación afín (no convexa)' : soporte === 1 ? 'un vértice' : soporte === 2 ? 'punto de una arista' : 'punto interior';
      registro.textContent = dentro
        ? `P = ${lam.map((l, i) => `${VIZ.fmt(l, 2)}·${NOM[i]}`).join(' + ')}: pesos no negativos que suman 1, así que P pertenece al triángulo (${clase}).`
        : `P queda fuera: el peso ${NOM[lam.findIndex((l) => l < -1e-9)]} = ${VIZ.fmt(Math.min(...lam), 2)} es negativo. Una combinación convexa nunca sale del triángulo.`;
      lectura.set([
        ['λ₁ (A)', VIZ.fmt(lam[0], 3)], ['λ₂ (B)', VIZ.fmt(lam[1], 3)], ['λ₃ (C)', VIZ.fmt(lam[2], 3)],
        ['suma de pesos', VIZ.fmt(lam[0] + lam[1] + lam[2], 3)],
        ['P', `(${VIZ.fmt(P[0], 3)}, ${VIZ.fmt(P[1], 3)})`],
        ['tipo', clase],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'grab';
    interaccion(lienzo, {
      tomar: (x, y) => {
        if (!pl) return false;
        arrastre = V.findIndex((v) => Math.hypot(pl.sx(v[0]) - x, pl.sy(v[1]) - y) < 14);
        if (arrastre < 0) arrastre = 3;
        if (arrastre === 3) { const l = baricentricas([pl.ix(x), pl.iy(y)]); if (l) { lam = l; sincronizar(); dibujar(); } }
        return true;
      },
      mover: (x, y) => {
        const p = [dentroDe(pl.ix(x), 0.2, 9.8), dentroDe(pl.iy(y), 0.2, 8.3)];
        if (arrastre < 3) V[arrastre] = p;
        else { const l = baricentricas([pl.ix(x), pl.iy(y)]); if (l) { lam = l; sincronizar(); } }
        dibujar();
      },
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) return tip.ocultar();
        const l = baricentricas([pl.ix(x), pl.iy(y)]);
        if (l) tip.mostrar(x, y, `pesos en este punto<br>λ = (<b>${l.map((q) => VIZ.fmt(q, 2)).join('</b>, <b>')}</b>)`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  /* ---------- Fig. 2: envoltura convexa y un LP sobre ella ---------- */

  function montarEnvoltura(cuerpo) {
    let n = 14, semilla = 1, ang = 40, minimizar = false, pts = [], pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Puntos', min: 4, max: 40, valor: n, alCambiar: (v) => { n = v; generar(); dibujar(); } });
    ctl.rango({ etiqueta: 'Dirección de c', min: 0, max: 355, paso: 5, valor: ang, formato: (v) => `${v}°`, alCambiar: (v) => { ang = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Minimizar en vez de maximizar', valor: minimizar, alCambiar: (v) => { minimizar = v; dibujar(); } });
    ctl.boton('Nuevos puntos', () => { semilla++; generar(); dibujar(); }, { primario: true });
    ctl.boton('Quitar el último', () => { if (pts.length > 3) { pts.pop(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, ALTO_PLANO);
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'vértice de la envoltura', forma: 'punto' },
      { color: C.inactivo, texto: 'punto interior o en el borde', forma: 'punto' },
      { color: VIZ.alfa(C.s1, 0.2), texto: 'envoltura convexa', forma: 'cuadro' },
      { color: C.s2, texto: 'dirección c y curva de nivel del óptimo', forma: 'linea' },
      { color: C.s6, texto: 'óptimo de c·x', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para agregar un punto. Gire c: el óptimo siempre salta de un vértice de la envoltura a otro, y ningún punto interior gana jamás.');
    function generar() {
      const rnd = VIZ.semilla(semilla * 101 + 7);
      pts = Array.from({ length: n }, () => [dentroDe(5 + 2.3 * VIZ.normal(rnd), 0.5, 9.5), dentroDe(4 + 1.7 * VIZ.normal(rnd), 0.5, 7.5)]);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = planoIgual(lienzo, { xmin: 0, xmax: 10, ymin: 0, ymax: 8 });
      pl.ejes();
      const H = envoltura(pts), esV = new Set(H);
      const sg = minimizar ? -1 : 1, c = [sg * Math.cos((ang * Math.PI) / 180), sg * Math.sin((ang * Math.PI) / 180)];
      poligono(ctx, pl, H.map((i) => pts[i]), VIZ.alfa(C.s1, 0.14), C.s1, 2);
      let mejor = 0;
      pts.forEach((p, i) => { if (dot(c, p) > dot(c, pts[mejor]) + 1e-12) mejor = i; });
      const z = dot(c, pts[mejor]);
      recta(ctx, pl, c, z, C.s2, 2, [6, 4]);
      const cen = [5, 4];
      flechaD(ctx, pl, cen, [cen[0] + 1.6 * c[0], cen[1] + 1.6 * c[1]], C.s2, 3);
      texto(ctx, 'c', pl.sx(cen[0] + 1.6 * c[0]) + 8, pl.sy(cen[1] + 1.6 * c[1]) - 8, C.tinta, 'left', 13, 600);
      pts.forEach((p, i) => {
        if (i === mejor) return;
        VIZ.marcador(ctx, pl.sx(p[0]), pl.sy(p[1]), esV.has(i) ? C.s1 : C.inactivo, i === hover ? 6 : 4.5);
      });
      VIZ.marcador(ctx, pl.sx(pts[mejor][0]), pl.sy(pts[mejor][1]), C.s6, 7.5, 6);
      const inter = pts.map((p, i) => (esV.has(i) ? -Infinity : dot(c, p)));
      const zInt = Math.max(...inter), zVert = Math.max(...H.map((i) => dot(c, pts[i])));
      registro.textContent = `Entre los ${pts.length} puntos, ${minimizar ? 'minimizar' : 'maximizar'} c·x da ${VIZ.fmt(sg * z)} en (${VIZ.fmt(pts[mejor][0], 3)}, ${VIZ.fmt(pts[mejor][1], 3)}), que ${esV.has(mejor) ? 'es un vértice de la envoltura' : 'está en el borde de la envoltura'}.`;
      lectura.set([
        ['puntos', String(pts.length)],
        ['vértices de la envoltura', String(H.length)],
        ['puntos interiores', String(pts.length - H.length)],
        [`mejor c·x entre todos`, VIZ.fmt(sg * z)],
        ['mejor c·x entre los vértices', VIZ.fmt(sg * zVert)],
        ['mejor c·x entre interiores', Number.isFinite(zInt) ? VIZ.fmt(sg * zInt) : '—'],
      ]);
      this_geo = { H, esV, c, sg };
    }
    let this_geo = null;
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    interaccion(lienzo, {
      tomar: (x, y) => {
        if (!pl || !pl.dentro(x, y) || pts.length >= 60) return false;
        pts.push([pl.ix(x), pl.iy(y)]);
        dibujar();
        return false;
      },
      mover: () => {},
      pasar: (x, y) => {
        if (!pl || !pl.dentro(x, y)) { hover = -1; return tip.ocultar(); }
        const h = pts.findIndex((p) => Math.hypot(pl.sx(p[0]) - x, pl.sy(p[1]) - y) < 10);
        if (h !== hover) { hover = h; dibujar(); }
        if (h < 0) return tip.ocultar();
        const p = pts[h];
        tip.mostrar(x, y, `punto (<b>${VIZ.fmt(p[0], 3)}</b>, <b>${VIZ.fmt(p[1], 3)}</b>)<br>c·x = <b>${VIZ.fmt(this_geo.sg * dot(this_geo.c, p))}</b><br>${this_geo.esV.has(h) ? 'vértice de la envoltura' : 'interior'}`);
      },
      salir: () => { hover = -1; tip.ocultar(); dibujar(); },
    });
    generar();
    dibujar();
  }

  VIZ.registrarTema('convex-combinations', {
    intro: String.raw`
      <p>Una <strong>combinación convexa</strong> de unos puntos es una mezcla con pesos no negativos que suman 1: un promedio ponderado. Con dos puntos recorre el
      segmento que los une; con tres, el triángulo; con muchos, la <strong>envoltura convexa</strong>, la «banda elástica» más pequeña que los rodea.</p>
      <p>Esta idea explica por qué la programación lineal es tan manejable: como \(c\cdot x\) es lineal, el valor de una mezcla es la mezcla de los valores, y nunca puede superar al
      mejor de los puntos mezclados. Por eso el óptimo se busca solo entre los <a href="tema.html?id=extreme-points-directions">puntos extremos</a>.</p>`,
    visualizaciones: [
      {
        titulo: 'Pesos y coordenadas baricéntricas',
        descripcion: 'Mueva los pesos o arrastre P dentro del triángulo y vea que cada peso es el área relativa del subtriángulo opuesto; saque P del triángulo para ver aparecer un peso negativo.',
        montar: montarMezcla,
      },
      {
        titulo: 'Envoltura convexa y un LP sobre ella',
        descripcion: 'Gire la dirección c y agregue puntos con clic: el mejor valor de c·x siempre se alcanza en un vértice de la envoltura, nunca en un punto interior.',
        montar: montarEnvoltura,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Dados \(x_1,\dots,x_k \in \mathbb{R}^n\), una <strong>combinación convexa</strong> es</p>
      \[ x = \sum_{i=1}^{k}\lambda_i x_i, \qquad \lambda_i \ge 0, \quad \sum_{i=1}^{k}\lambda_i = 1. \]
      <p>Si se elimina la condición \(\lambda_i \ge 0\) se obtiene una <em>combinación afín</em>, que recorre toda la recta (con dos puntos) o todo el plano (con tres no alineados).
      Un conjunto \(S\) es <a href="tema.html?id=convex-sets-functions">convexo</a> si contiene todas las combinaciones convexas de sus puntos; basta comprobarlo con pares.</p>
      <h2>Envoltura convexa</h2>
      <p>\(\operatorname{conv}(X)\) es el conjunto de todas las combinaciones convexas de puntos de \(X\); es el menor conjunto convexo que contiene a \(X\) y la intersección de
      todos los convexos que lo contienen. Sus vértices son un subconjunto de \(X\). En el plano se calcula en \(O(n\log n)\) con la cadena monótona de Andrew:</p>
      <pre><code>ordenar los puntos por (x, y)
para cada punto p en orden:                  # cadena inferior
    mientras |h| ≥ 2 y giro(h[−2], h[−1], p) ≤ 0: quitar h[−1]
    agregar p
repetir en orden inverso para la cadena superior
devolver la unión sin repetir los extremos</code></pre>
      <p>donde \(\text{giro}(o,a,b) = (a-o)\times(b-o)\) es positivo si el recorrido gira a la izquierda.</p>
      <h2>Coordenadas baricéntricas</h2>
      <p>Para un triángulo \(ABC\) y un punto \(P\), los pesos únicos con \(P=\lambda_1A+\lambda_2B+\lambda_3C\), \(\sum\lambda_i=1\) cumplen \(\lambda_1 = \dfrac{\text{área}(PBC)}{\text{área}(ABC)}\) y análogamente los demás.
      \(P\) está dentro si y solo si los tres son no negativos, y sobre una arista si alguno es cero.</p>
      <p><strong>Teorema de Carathéodory.</strong> En \(\mathbb{R}^n\), todo punto de \(\operatorname{conv}(X)\) es combinación convexa de a lo sumo \(n+1\) puntos de \(X\).</p>
      <h2>Un LP sobre la envoltura</h2>
      <div class="recuadro"><p>Si \(x=\sum\lambda_ix_i\) es combinación convexa, entonces \(c^\top x = \sum\lambda_i\,c^\top x_i \le \max_i c^\top x_i\). Por tanto
      \(\max\{c^\top x : x\in\operatorname{conv}(X)\}\) se alcanza en algún punto de \(X\), y se puede tomar un vértice de la envoltura.</p></div>
      <p>El óptimo es un promedio de los valores de los puntos mezclados; solo iguala al máximo si todos los puntos con peso positivo son también óptimos, lo que ocurre en una arista
      cuando \(c\) es normal a ella (<a href="tema.html?id=optimal-solution-geometry">óptimos alternativos</a>).</p>
      <h2>Conexiones</h2>
      <ul>
        <li>Un poliedro acotado es la envoltura de sus vértices: <a href="tema.html?id=polyhedra-vertices">poliedros y vértices</a>; si es no acotado hace falta sumar direcciones (<a href="tema.html?id=extreme-points-directions">teorema de representación</a>).</li>
        <li>La relajación de un problema entero reemplaza un conjunto discreto por su envoltura: <a href="tema.html?id=lp-relaxation">relajación lineal</a>.</li>
        <li>Los semiespacios cuya intersección da la envoltura: <a href="tema.html?id=halfspaces-hyperplanes">semiespacios e hiperplanos</a>.</li>
      </ul>`,
  });
})();
