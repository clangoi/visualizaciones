/* Soluciones básicas factibles: elegir una base, calcular B⁻¹b y enumerar las C(n+m, m) bases frente a los vértices. */
(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* ---------- Ayudantes compartidos por los temas del Simplex ---------- */

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (i) => String(i).replace(/\d/g, (d) => SUB[+d]);
  const bonito = (nm) => nm.replace(/(\d+)/, (d) => sub(d)); // 'x1' → 'x₁'
  // Número como fracción exacta cuando el denominador es pequeño (los tableaux de ejemplo son racionales).
  function frac(v) {
    if (!Number.isFinite(v)) return VIZ.fmt(v);
    if (Math.abs(v) < 1e-9) return '0';
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-9) return String(r).replace('-', '−');
    for (let d = 2; d <= 60; d++) {
      const p = Math.round(v * d);
      if (Math.abs(v * d - p) < 1e-8 * d) return `${p < 0 ? '−' : ''}${Math.abs(p)}/${d}`;
    }
    return VIZ.fmt(v, 3);
  }
  // Expresión lineal «3x₁ − x₂» a partir de coeficientes y nombres.
  function expr(coefs, nombres) {
    let s = '';
    coefs.forEach((a, j) => {
      if (Math.abs(a) < 1e-12) return;
      const v = Math.abs(a) === 1 ? '' : frac(Math.abs(a));
      s += (s ? (a < 0 ? ' − ' : ' + ') : (a < 0 ? '−' : '')) + v + nombres[j];
    });
    return s || '0';
  }

  // Región { A x ≤ b, x ≥ 0 } dentro de [0, M]².
  function region(A, b, M = 8) {
    return O.poligono(A.map((a, i) => ({ a, b: b[i] })), { xmin: 0, xmax: M, ymin: 0, ymax: M });
  }
  // Extremos de la recta a·x = b recortada al dominio del plano (el par de puntos más alejados).
  function segmento(a, b, d) {
    const pts = [];
    if (Math.abs(a[1]) > 1e-12) for (const x of [d.xmin, d.xmax]) { const y = (b - a[0] * x) / a[1]; if (y >= d.ymin - 1e-9 && y <= d.ymax + 1e-9) pts.push([x, y]); }
    if (Math.abs(a[0]) > 1e-12) for (const y of [d.ymin, d.ymax]) { const x = (b - a[1] * y) / a[0]; if (x >= d.xmin - 1e-9 && x <= d.xmax + 1e-9) pts.push([x, y]); }
    let mejor = null, mx = -1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const q = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (q > mx) { mx = q; mejor = [pts[i], pts[j]]; }
    }
    return mejor;
  }
  function rellenar(ctx, plano, poli, color) {
    if (poli.length < 3) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Recta de una restricción con una etiqueta cerca del extremo superior (t desplaza la etiqueta a lo largo de la recta).
  function recta(ctx, plano, a, b, color, { ancho = 2, guion = null, texto = '', t = 0.12 } = {}) {
    const seg = segmento(a, b, plano.d);
    if (!seg) return;
    const [p, q] = seg[0][1] >= seg[1][1] ? seg : [seg[1], seg[0]];
    VIZ.trazar(ctx, plano, [p, q], color, ancho, guion);
    if (!texto) return;
    const x = plano.sx(p[0] + t * (q[0] - p[0])), y = plano.sy(p[1] + t * (q[1] - p[1]));
    ctx.save();
    ctx.font = VIZ.fuente(11, 600);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = x > plano.x1 - 40 ? 'right' : 'left';
    ctx.fillText(texto, x + (ctx.textAlign === 'left' ? 7 : -7), y + 9);
    ctx.restore();
  }
  // Pulsar o arrastrar sobre el lienzo: alPunto(x, y, arrastrando) en píxeles del lienzo.
  function arrastre(lienzo, alPunto, alSalir) {
    let abajo = false;
    const c = lienzo.canvas;
    c.style.cursor = 'crosshair';
    c.addEventListener('pointerdown', (ev) => { abajo = true; c.setPointerCapture(ev.pointerId); const { x, y } = lienzo.posicion(ev); alPunto(x, y, true); });
    c.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); alPunto(x, y, abajo); });
    const soltar = () => { abajo = false; };
    c.addEventListener('pointerup', soltar);
    c.addEventListener('pointercancel', soltar);
    c.addEventListener('pointerleave', () => { if (!abajo && alSalir) alSalir(); });
  }

  // Tableau como tabla HTML. est = { T, base, nombres, entra, sale, razones }.
  // Resalta la columna entrante, la fila saliente y el pivote. o.clic(j) hace pulsables las columnas con costo reducido negativo.
  function htmlTableau(est, o = {}) {
    const { T, base, nombres } = est, m = T.length - 1, N = nombres.length;
    const entra = o.entra ?? est.entra ?? -1, sale = o.sale ?? est.sale ?? -1, etiquetaZ = o.etiquetaZ || 'z';
    const razones = est.razones && est.razones.length ? est.razones : null;
    const fondo = (i, j) => {
      if (i === sale && j === entra) return { background: C.s7, color: C.sobre };
      if (j === entra) return { background: VIZ.alfa(C.s1, 0.16) };
      if (i === sale) return { background: VIZ.alfa(C.s2, 0.16) };
      return null;
    };
    const cab = VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'Base'),
      nombres.map((nm, j) => {
        const activa = o.clic && T[m][j] < -1e-9;
        return VIZ.el('th', { class: activa ? 'celda-clic' : null, title: activa ? 'Pulse para que entre a la base' : null, style: fondo(-1, j) || (activa ? { border: `1.5px solid ${C.s1}` } : null), onclick: activa ? () => o.clic(j) : null }, bonito(nm));
      }), VIZ.el('th', null, 'LD'), razones ? VIZ.el('th', null, 'razón') : null);
    const filas = T.slice(0, m).map((f, i) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq', style: fondo(i, -1) }, bonito(nombres[base[i]])),
      f.slice(0, N).map((v, j) => VIZ.el('td', { style: fondo(i, j) }, frac(v))),
      VIZ.el('td', { style: o.marcarCeros && Math.abs(f[N]) < 1e-9 ? { background: VIZ.alfa(C.s8, 0.2), fontWeight: 600 } : fondo(i, -1) }, frac(f[N])),
      razones ? VIZ.el('td', { style: fondo(i, -1) }, Number.isFinite(razones[i]) ? frac(razones[i]) : '—') : null));
    const fz = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, etiquetaZ),
      T[m].slice(0, N).map((v, j) => VIZ.el('td', { style: { ...(fondo(-1, j) || {}), ...(v < -1e-9 ? { fontWeight: 600 } : {}) } }, frac(v))),
      VIZ.el('td', { style: { fontWeight: 600 } }, frac(T[m][N])), razones ? VIZ.el('td') : null);
    return VIZ.el('div', { class: 'caja-desplazable' }, VIZ.el('table', { class: 'tabla-datos sin-corte' }, VIZ.el('thead', null, cab), VIZ.el('tbody', null, filas, fz)));
  }
  const LEYENDA_TABLEAU = [
    { color: C.s1, texto: 'columna entrante' },
    { color: C.s2, texto: 'fila saliente' },
    { color: C.s7, texto: 'pivote' },
  ];

  // Modelo de referencia: max 3x₁ + 2x₂  s.a.  x₁ + x₂ ≤ 5,  2x₁ + x₂ ≤ 8,  x₁ + 3x₂ ≤ 12.  Óptimo (3, 2), z = 13.
  const A0 = [[1, 1], [2, 1], [1, 3]];
  const B0 = [5, 8, 12];
  const COL_R = [C.s1, C.s2, C.s3, C.s4, C.s5, C.s7];
  // Flecha de (x0, y0) a (x1, y1) en píxeles.
  function flecha(ctx, x0, y0, x1, y1, color, ancho, guion) {
    const a = Math.atan2(y1 - y0, x1 - x0), h = 9;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho;
    if (guion) ctx.setLineDash(guion);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * h * 0.6, y1 - Math.sin(a) * h * 0.6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
    ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const NOMBRES = ['x₁', 'x₂', 's₁', 's₂', 's₃'];
  const TOL = 1e-7;
  const DOM = { xmin: -0.5, xmax: 13, ymin: -0.5, ymax: 9 };

  // Columna j de [A | I].
  const columna = (A, j) => (j < 2 ? A.map((f) => f[j]) : A.map((_, i) => (i === j - 2 ? 1 : 0)));
  function det3(M) {
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  }
  // Las 10 bases de [A | I] (3 columnas de 5): matriz B, solución básica completa y factibilidad.
  function enumerar(A, b) {
    const res = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) {
      const idx = [i, j, k];
      const cols = idx.map((q) => columna(A, q));
      const B = A.map((_, r) => cols.map((c) => c[r]));
      const xB = O.resolver(B, b);
      const x = Array(5).fill(0);
      if (xB) idx.forEach((q, t) => { x[q] = xB[t]; });
      res.push({ idx, B, det: det3(B), xB, x, factible: !!xB && xB.every((v) => v >= -TOL), id: res.length });
    }
    return res;
  }
  const nombreBase = (idx) => '{' + idx.map((q) => NOMBRES[q]).join(', ') + '}';
  // Dibuja el plano con la región, las rectas Rᵢ y las rectas x₁ = 0, x₂ = 0 (con énfasis en las pedidas).
  function fondoPlano(lienzo, A, b, enfasis = []) {
    const { ctx } = lienzo;
    const plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
    plano.ejes();
    const poli = O.poligono(A.map((a, i) => ({ a, b: b[i] })), { xmin: 0, xmax: 13, ymin: 0, ymax: 9 });
    rellenar(ctx, plano, poli, C.neutro);
    // Las variables no básicas valen cero sobre sus rectas: x₁ = 0, x₂ = 0, R₁, R₂, R₃.
    const rectas = [[[1, 0], 0, C.tinta2], [[0, 1], 0, C.tinta2], ...A.map((a, i) => [a, b[i], COL_R[i]])];
    rectas.forEach(([a, bb, col], q) => {
      const enf = enfasis.includes(q);
      recta(ctx, plano, a, bb, col, { ancho: enf ? 3.5 : 1.5, guion: enf ? null : [5, 4], texto: q >= 2 ? `R${sub(q - 1)}` : '', t: 0.08 + 0.1 * q });
    });
    return { plano, poli };
  }

  /* ---------- Fig. 1: elegir una base ---------- */

  function montarBase(cuerpo) {
    const bs = enumerar(A0, B0);
    let sel = 9; // {s₁, s₂, s₃}: el origen
    let plano = null;
    const ctl = VIZ.controles(cuerpo);
    const selector = ctl.selector({ etiqueta: 'Variables básicas', opciones: bs.map((q) => [q.id, nombreBase(q.idx)]), valor: sel, alCambiar: (v) => { sel = +v; dibujar(); } });
    ctl.boton('Siguiente base', () => { sel = (sel + 1) % bs.length; selector.valor = sel; dibujar(); }, { primario: true });
    ctl.boton('Siguiente base factible', () => { for (let k = 1; k <= bs.length; k++) { const q = bs[(sel + k) % bs.length]; if (q.factible) { sel = q.id; break; } } selector.valor = sel; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 260, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'solución básica factible (vértice)', forma: 'punto' },
      { color: C.s8, texto: 'básica no factible', forma: 'punto' },
      { color: C.s7, texto: 'base elegida', forma: 'punto' },
      { color: C.neutro, texto: 'región factible' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija una base en la lista o haga clic sobre un punto del plano. Las rectas gruesas son las variables no básicas, que valen cero; la solución básica es su intersección. Verde: cumple x ≥ 0; rojo: alguna variable básica es negativa.');

    const pt = (q) => [q.x[0], q.x[1]];
    function dibujar() {
      const q = bs[sel];
      const { ctx } = lienzo;
      lienzo.limpiar();
      const nb = [0, 1, 2, 3, 4].filter((i) => !q.idx.includes(i));
      ({ plano } = fondoPlano(lienzo, A0, B0, nb));
      bs.forEach((o) => { if (o.xB) VIZ.marcador(ctx, plano.sx(o.x[0]), plano.sy(o.x[1]), o.factible ? C.s6 : C.s8, 4.5, o.factible ? 0 : 5); });
      const [px, py] = pt(q);
      ctx.save();
      ctx.strokeStyle = C.s7;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(plano.sx(px), plano.sy(py), 11, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'B'), q.idx.map((i) => VIZ.el('th', null, NOMBRES[i])), VIZ.el('th', null, 'b'))),
        VIZ.el('tbody', null,
          q.B.map((f, r) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, `fila ${r + 1}`), f.map((v) => VIZ.el('td', null, frac(v))), VIZ.el('td', null, frac(B0[r])))),
          VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'x_B = B⁻¹b'), q.idx.map((i, t) => VIZ.el('td', { style: { fontWeight: 600, color: q.xB && q.xB[t] < -TOL ? C.s8 : null } }, q.xB ? frac(q.xB[t]) : '—')), VIZ.el('td')))));
      const negativas = q.xB ? q.idx.filter((_, t) => q.xB[t] < -TOL).map((i) => NOMBRES[i]) : [];
      const ceros = q.xB ? q.idx.filter((_, t) => Math.abs(q.xB[t]) <= TOL).map((i) => NOMBRES[i]) : [];
      registro.textContent = !q.xB ? `La matriz B de ${nombreBase(q.idx)} es singular: las columnas no forman una base.`
        : `Se fijan en 0 las no básicas ${nb.map((i) => NOMBRES[i]).join(' y ')} y se resuelve B x_B = b: ${q.idx.map((i, t) => `${NOMBRES[i]} = ${frac(q.xB[t])}`).join(', ')}. `
          + (q.factible ? `Todas son ≥ 0: es una solución básica factible, el vértice (${frac(px)}, ${frac(py)}).${ceros.length ? ' Hay una básica en cero: base degenerada.' : ''}`
            : `${negativas.join(' y ')} ${negativas.length > 1 ? 'son negativas' : 'es negativa'}: la solución básica no es factible, el punto (${frac(px)}, ${frac(py)}) está fuera de la región.`);
      lectura.set([
        ['base', nombreBase(q.idx)],
        ['det B', frac(q.det)],
        ['punto (x₁, x₂)', q.xB ? `(${frac(px)}, ${frac(py)})` : '—'],
        ['factible', q.factible ? 'sí' : 'no'],
        ['z = 3x₁ + 2x₂', q.xB ? VIZ.fmt(3 * px + 2 * py) : '—'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    arrastre(lienzo, (x, y, abajo) => {
      if (!plano) return;
      let cerca = null, dm = 14;
      bs.forEach((o) => { if (!o.xB) return; const d = Math.hypot(plano.sx(o.x[0]) - x, plano.sy(o.x[1]) - y); if (d < dm) { dm = d; cerca = o; } });
      lienzo.canvas.style.cursor = cerca ? 'pointer' : 'crosshair';
      if (cerca && abajo) { sel = cerca.id; selector.valor = sel; dibujar(); }
      if (cerca) tip.mostrar(x, y, `base <b>${nombreBase(cerca.idx)}</b><br>(x₁, x₂) = (${frac(cerca.x[0])}, ${frac(cerca.x[1])})<br>${cerca.factible ? 'factible' : 'no factible'}`);
      else tip.ocultar();
    }, () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: las diez bases ---------- */

  function montarEnumeracion(cuerpo) {
    const b = B0.slice();
    let bs = enumerar(A0, b), visto = 0, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'b₁ (lado derecho de R₁)', min: 3, max: 8, paso: 0.2, valor: b[0], alCambiar: (v) => { b[0] = v; bs = enumerar(A0, b); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 240, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'básica factible', forma: 'punto' },
      { color: C.s8, texto: 'básica no factible', forma: 'punto' },
      { color: C.s2, texto: 'base que se examina', forma: 'punto' },
      { color: C.neutro, texto: 'región factible' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable caja-alta' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para examinar una base a la vez, o «Hasta el final». Después deslice b₁ hasta 5,6: tres rectas se cortan en un mismo punto y varias bases factibles coinciden en un solo vértice (degeneración).');

    function iniciar() {
      visto = 0;
      return (function* () { for (let k = 1; k <= bs.length; k++) { visto = k; yield; } })();
    }
    const distintos = (n) => {
      const lista = [];
      bs.slice(0, n).filter((q) => q.factible).forEach((q) => { if (!lista.some((p) => Math.hypot(p[0] - q.x[0], p[1] - q.x[1]) < 1e-6)) lista.push([q.x[0], q.x[1]]); });
      return lista;
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      ({ plano } = fondoPlano(lienzo, A0, b, []));
      bs.slice(0, visto).forEach((q, k) => {
        if (!q.xB) return;
        VIZ.marcador(ctx, plano.sx(q.x[0]), plano.sy(q.x[1]), k === visto - 1 ? C.s2 : q.factible ? C.s6 : C.s8, k === visto - 1 ? 7 : 4.5, q.factible ? 0 : 5);
      });
      const fila = (q, k) => {
        const vis = k < visto;
        return VIZ.el('tr', { class: k === visto - 1 ? 'activa' : null }, VIZ.el('td', { class: 'izq' }, `${k + 1}. ${nombreBase(q.idx)}`),
          q.x.map((v, i) => VIZ.el('td', { style: vis && v < -TOL ? { color: C.s8, fontWeight: 600 } : null }, vis ? (q.xB ? frac(v) : '—') : '·')),
          VIZ.el('td', null, vis ? (q.factible ? 'sí' : 'no') : '·'));
      };
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'Base'), NOMBRES.map((n) => VIZ.el('th', null, n)), VIZ.el('th', null, 'factible'))),
        VIZ.el('tbody', null, bs.map(fila))));
      const fact = bs.slice(0, visto).filter((q) => q.factible).length, vert = distintos(visto).length;
      if (!visto) registro.textContent = `Hay C(5, 3) = ${bs.length} formas de elegir 3 variables básicas entre 5. Pulse «Un paso» para examinarlas una por una.`;
      else {
        const q = bs[visto - 1];
        const igual = q.factible ? bs.slice(0, visto - 1).find((o) => o.factible && Math.hypot(o.x[0] - q.x[0], o.x[1] - q.x[1]) < 1e-6) : null;
        registro.textContent = !q.xB ? `${nombreBase(q.idx)}: B singular, no es base.`
          : igual ? `${nombreBase(q.idx)} es factible y da el mismo vértice (${frac(q.x[0])}, ${frac(q.x[1])}) que ${nombreBase(igual.idx)}: vértice degenerado, varias bases para un punto.`
            : q.factible ? `${nombreBase(q.idx)}: factible. Corresponde al vértice (${frac(q.x[0])}, ${frac(q.x[1])}).`
              : `${nombreBase(q.idx)}: x_B tiene una componente negativa, el punto (${frac(q.x[0])}, ${frac(q.x[1])}) está fuera de la región.`;
      }
      lectura.set([
        ['bases examinadas', `${visto} de ${bs.length}`],
        ['factibles', String(fact)],
        ['vértices distintos', String(vert)],
        ['no factibles', String(visto - fact)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!plano) return;
      const { x, y } = lienzo.posicion(ev);
      let cerca = null, dm = 12;
      bs.slice(0, visto).forEach((o) => { if (!o.xB) return; const d = Math.hypot(plano.sx(o.x[0]) - x, plano.sy(o.x[1]) - y); if (d < dm) { dm = d; cerca = o; } });
      if (cerca) tip.mostrar(x, y, `base <b>${nombreBase(cerca.idx)}</b><br>(x₁, x₂) = (${frac(cerca.x[0])}, ${frac(cerca.x[1])})<br>${cerca.factible ? 'factible' : 'no factible'}`);
      else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('basic-feasible-solutions', {
    intro: String.raw`
      <p>Un sistema con más incógnitas que ecuaciones tiene infinitas soluciones. El truco del Simplex es mirar solo unas pocas: elegir
      <em>qué variables serán básicas</em>, fijar las demás en cero y resolver el sistema cuadrado que queda. Cada elección de columnas
      independientes es una <strong>base</strong> y produce una única <strong>solución básica</strong>.</p>
      <p>Si además esa solución cumple \(x \ge 0\), es una <strong>solución básica factible</strong>, y resulta ser exactamente un vértice del poliedro.
      Por eso buscar el óptimo de un LP se reduce a revisar un conjunto finito: las bases.</p>`,
    visualizaciones: [
      {
        titulo: 'Elegir una base y resolver B⁻¹b',
        descripcion: 'Elija tres variables básicas: las otras dos se anulan y el punto es la intersección de sus rectas. Pruebe la base \\(\\{x_1, s_1, s_2\\}\\): la solución sale del polígono y tiene componentes negativas.',
        montar: montarBase,
      },
      {
        titulo: 'Enumerar las diez bases',
        descripcion: 'Examine las \\(\\binom{5}{3}=10\\) bases una por una: cinco son factibles y coinciden con los vértices del polígono, las otras cinco caen fuera. Con \\(b_1 = 5{,}6\\) varias bases comparten un vértice.',
        montar: montarEnumeracion,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea el sistema estándar \(Ax = b\) con \(A\in\mathbb{R}^{m\times N}\) de rango \(m\). Una <strong>base</strong> es un conjunto \(\mathcal{B}\) de \(m\)
      índices cuyas columnas forman una matriz invertible \(B\). Las demás columnas forman \(N_{\mathcal N}\) (no básicas). La <strong>solución básica</strong> asociada es</p>
      \[ x_B = B^{-1} b, \qquad x_N = 0. \]
      <p>Es una <strong>solución básica factible</strong> (SBF) si \(x_B \ge 0\). Si alguna componente básica vale cero, la SBF es <em>degenerada</em>.</p>
      <h2>Por qué corresponde a un vértice</h2>
      <div class="recuadro"><p><strong>Teorema fundamental.</strong> Para \(P = \{x : Ax = b,\ x \ge 0\}\), un punto es SBF si y solo si es un punto extremo (vértice) de \(P\).
      Además, si el LP tiene óptimo, alguno se alcanza en una SBF.</p></div>
      <p>Idea de la prueba: las columnas de las variables positivas de un punto son linealmente independientes exactamente cuando el punto no se
      puede escribir como promedio de otros dos puntos de \(P\). Y \(m\) columnas independientes siempre se completan a una base.</p>
      <h2>Cuántas bases hay</h2>
      <p>A lo más \(\binom{N}{m}\), una cifra que crece muy rápido. En el ejemplo \(N = 5\), \(m = 3\), así que hay 10 candidatas y solo 5 son factibles:</p>
      <table>
        <thead><tr><th>Base</th><th>No básicas en 0</th><th>Solución</th><th>¿Factible?</th></tr></thead>
        <tbody>
          <tr><td>\(\{x_1,x_2,s_3\}\)</td><td>\(s_1,s_2\)</td><td>\((3,2)\), \(s_3=3\)</td><td>sí (óptimo)</td></tr>
          <tr><td>\(\{x_1,s_1,s_2\}\)</td><td>\(x_2,s_3\)</td><td>\(x_1=12\), \(s_1=-7\), \(s_2=-16\)</td><td>no</td></tr>
        </tbody>
      </table>
      <p>Revisar todas las bases sería exponencial; el Simplex recorre solo algunas, moviéndose entre bases vecinas (que difieren en una columna).</p>
      <h2>Degeneración</h2>
      <p>Si más de \(n\) restricciones pasan por un mismo punto (aquí, con \(b_1 = 5{,}6\), \(R_1\), \(R_2\) y \(R_3\) se cortan en \((2{,}4;\ 3{,}2)\)), ese vértice se obtiene
      desde varias bases distintas, todas con alguna variable básica en cero. Hay más bases factibles que vértices; esto tiene consecuencias para el
      algoritmo (véase <a href="tema.html?id=degeneracy-cycling">Degeneracy and Cycling</a>).</p>
      <h2>Conexiones</h2>
      <p>La forma del sistema viene de <a href="tema.html?id=standard-form">Standard Form and Slack Variables</a>; el recorrido eficiente entre bases se hace con el
      <a href="tema.html?id=simplex-tableau">tableau</a>. La geometría de las restricciones activas está en
      <a href="tema.html?id=active-constraints-bfs">Active Constraints and Basic Feasible Solutions</a> y la de los vértices en
      <a href="tema.html?id=polyhedra-vertices">Polyhedra, Polytopes and Vertices</a>.</p>`,
  });
})();
