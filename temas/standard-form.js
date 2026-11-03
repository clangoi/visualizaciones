/* Forma estándar y variables de holgura: conversión paso a paso y correspondencia entre el plano y el sistema de ecuaciones. */
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

  /* ---------- Modelos de práctica ---------- */

  const MODELOS = {
    prod: { nombre: 'Producción (todas ≤)', sentido: 'max', c: [3, 2], vars: ['≥0', '≥0'], rest: [{ a: [1, 1], op: '<=', b: 5 }, { a: [2, 1], op: '<=', b: 8 }, { a: [1, 3], op: '<=', b: 12 }] },
    dieta: { nombre: 'Dieta (minimizar, restricciones ≥)', sentido: 'min', c: [2, 3], vars: ['≥0', '≥0'], rest: [{ a: [2, 1], op: '>=', b: 6 }, { a: [1, 3], op: '>=', b: 6 }] },
    mezcla: { nombre: 'Mezcla (una igualdad)', sentido: 'max', c: [4, 3], vars: ['≥0', '≥0'], rest: [{ a: [1, 1], op: '=', b: 6 }, { a: [2, 1], op: '<=', b: 10 }] },
    libre: { nombre: 'Variable libre y lado derecho negativo', sentido: 'max', c: [2, -1], vars: ['≥0', 'libre'], rest: [{ a: [1, 1], op: '<=', b: 6 }, { a: [0, -1], op: '<=', b: 3 }, { a: [1, 0], op: '<=', b: 4 }, { a: [-1, -1], op: '<=', b: -1 }] },
  };
  const OPS = { '<=': '≤', '>=': '≥', '=': '=' };

  // Convierte a max cᵀx, A x = b ≥ 0, x ≥ 0. Devuelve columnas, matriz y la lista de pasos que el reproductor recorre.
  function convertir(M) {
    const cols = [];
    M.vars.forEach((t, j) => {
      if (t === 'libre') cols.push({ nombre: `x${sub(j + 1)}⁺`, orig: j, signo: 1 }, { nombre: `x${sub(j + 1)}⁻`, orig: j, signo: -1 });
      else cols.push({ nombre: `x${sub(j + 1)}`, orig: j, signo: 1 });
    });
    const sg = M.sentido === 'min' ? -1 : 1;
    const filas = M.rest.map((r, i) => {
      let a = r.a.slice(), b = r.b, op = r.op, volteada = false;
      if (b < 0) { a = a.map((v) => -v); b = -b; op = op === '<=' ? '>=' : op === '>=' ? '<=' : '='; volteada = true; }
      return { a, b, op, volteada, i };
    });
    const extras = filas.filter((f) => f.op !== '=').map((f) => ({ nombre: (f.op === '<=' ? 's' : 'e') + sub(f.i + 1), fila: f.i, signo: f.op === '<=' ? 1 : -1 }));
    const nombres = [...cols.map((q) => q.nombre), ...extras.map((q) => q.nombre)];
    const A = filas.map((f) => [...cols.map((q) => f.a[q.orig] * q.signo), ...extras.map((q) => (q.fila === f.i ? q.signo : 0))]);
    const b = filas.map((f) => f.b);
    const c = [...cols.map((q) => sg * M.c[q.orig] * q.signo), ...extras.map(() => 0)];
    const pasos = [{ tipo: 'obj', texto: M.sentido === 'min'
      ? 'Minimizar z equivale a maximizar −z: se cambia el signo de todos los coeficientes del objetivo.'
      : 'El objetivo ya es de maximizar: no cambia.' }];
    const pasoVar = [];
    M.vars.forEach((t, j) => {
      if (t !== 'libre') return;
      pasoVar.push(pasos.length);
      pasos.push({ tipo: 'var', texto: `x${sub(j + 1)} es libre (puede ser negativa): se escribe x${sub(j + 1)} = x${sub(j + 1)}⁺ − x${sub(j + 1)}⁻ con ambas ≥ 0. Una columna pasa a ser dos.` });
    });
    const pasoFila = [];
    filas.forEach((f) => {
      pasoFila.push(pasos.length);
      const eq = `${expr(A[f.i], nombres)} = ${frac(f.b)}`;
      const previo = f.volteada ? `El lado derecho ${frac(M.rest[f.i].b)} es negativo: se multiplica la fila por −1 y el sentido se invierte. ` : '';
      const e = extras.find((q) => q.fila === f.i);
      const que = !e ? 'Ya es una igualdad: no se agrega nada.'
        : f.op === '<=' ? `Es ≤: se suma una variable de holgura ${e.nombre} ≥ 0, lo que sobra del recurso.`
          : `Es ≥: se resta una variable de exceso ${e.nombre} ≥ 0, lo que se pasa del mínimo exigido.`;
      pasos.push({ tipo: 'fila', texto: `R${sub(f.i + 1)}. ${previo}${que} Queda ${eq}.` });
    });
    pasos.push({ tipo: 'fin' });
    return { cols, extras, filas, nombres, A, b, c, sg, pasos, pasoVar, pasoFila };
  }

  // Resuelve el sistema estándar con Big-M y devuelve la solución en las variables originales y las holguras.
  function resolver(M, S) {
    const r = O.lp(S.c, S.A, S.b.map(() => '='), S.b, { max: true });
    if (r.estado !== 'optimo') return { estado: r.estado };
    const x = M.c.map((_, j) => S.cols.reduce((s, q, k) => s + (q.orig === j ? q.signo * r.x[k] : 0), 0));
    const holg = S.extras.map((q, k) => ({ nombre: q.nombre, v: r.x[S.cols.length + k] }));
    return { estado: 'optimo', x, holg, z: M.c.reduce((s, v, j) => s + v * x[j], 0) };
  }

  /* ---------- Fig. 1: conversión paso a paso ---------- */

  function montarConversion(cuerpo) {
    let clave = 'prod', M = MODELOS[clave], S = convertir(M), sol = resolver(M, S), paso = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: Object.entries(MODELOS).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; preparar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    cuerpo.dataset.sinLeyenda = 'tablas con texto: la fila activa se resalta y cada columna tiene su nombre; no hay colores con significado';
    const panel = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(panel);
    const izq = VIZ.el('div'), der = VIZ.el('div');
    panel.append(izq, der);
    VIZ.subtitulo(izq, 'Modelo original');
    const lista = VIZ.el('div', { class: 'lista-mono' });
    izq.appendChild(lista);
    VIZ.subtitulo(der, 'Forma estándar: max cᵀx, Ax = b, x ≥ 0');
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    der.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un modelo y pulse «Un paso»: cada paso convierte una pieza y rellena su fila en la tabla de la derecha. Al final se resuelve el sistema estándar y se vuelve a las variables originales.');

    function preparar() { M = MODELOS[clave]; S = convertir(M); sol = resolver(M, S); rep.reiniciar(); }
    function iniciar() {
      paso = -1;
      return (function* () { for (let k = 0; k < S.pasos.length; k++) { paso = k; yield; } })();
    }
    function dibujar() {
      const nombresX = M.c.map((_, j) => `x${sub(j + 1)}`);
      const lineas = [];
      lineas.push({ t: `${M.sentido === 'max' ? 'max' : 'min'} z = ${expr(M.c, nombresX)}`, p: 0 });
      lineas.push({ t: 'x: ' + M.vars.map((v, j) => `${nombresX[j]} ${v === 'libre' ? 'libre' : '≥ 0'}`).join(', '), p: S.pasoVar[0] ?? -1 });
      M.rest.forEach((r, i) => lineas.push({ t: `R${sub(i + 1)}: ${expr(r.a, nombresX)} ${OPS[r.op]} ${frac(r.b)}`, p: S.pasoFila[i] }));
      lista.replaceChildren(...lineas.map((l) => VIZ.el('div', { class: l.p === paso ? 'activa' : null }, l.t)));
      const fin = paso >= S.pasos.length - 1;
      const sal = (v) => VIZ.el('td', { style: { color: C.apagado } }, v);
      const filas = [VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'max z'), S.c.map((v) => VIZ.el('td', null, paso >= 0 ? frac(v) : '·')), paso >= 0 ? VIZ.el('td', null, '0') : sal('·'))];
      S.filas.forEach((f, i) => {
        const visible = paso >= S.pasoFila[i];
        filas.push(VIZ.el('tr', { class: S.pasoFila[i] === paso ? 'activa' : null }, VIZ.el('td', { class: 'izq' }, `R${sub(i + 1)}`),
          S.A[i].map((v) => (visible ? VIZ.el('td', null, frac(v)) : sal('·'))), visible ? VIZ.el('td', null, frac(S.b[i])) : sal('·')));
      });
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, ''), S.nombres.map((nm) => VIZ.el('th', null, nm)), VIZ.el('th', null, 'LD'))),
        VIZ.el('tbody', null, filas)));
      if (paso < 0) registro.textContent = 'Modelo original. Pulse «Un paso» para convertirlo: se necesita max, igualdades, lado derecho ≥ 0 y variables ≥ 0.';
      else if (!fin) registro.textContent = S.pasos[paso].texto;
      else if (sol.estado === 'optimo') {
        registro.textContent = `Forma estándar completa: ${S.nombres.length} columnas y ${S.filas.length} igualdades. Resuelta, da ${nombresX.map((nm, j) => `${nm} = ${frac(sol.x[j])}`).join(', ')}; ${sol.holg.map((h) => `${h.nombre} = ${frac(h.v)}`).join(', ') || 'sin holguras'}.`;
      } else registro.textContent = `El sistema estándar resulta ${sol.estado}.`;
      lectura.set([
        ['variables originales', String(M.c.length)],
        ['restricciones', String(M.rest.length)],
        ['columnas estándar', paso >= 0 ? String(S.nombres.length) : '—'],
        ['holguras / excesos', fin ? String(S.extras.length) : '—'],
        ['solución x*', fin && sol.estado === 'optimo' ? '(' + sol.x.map(frac).join(', ') + ')' : '—'],
        [`z* (${M.sentido})`, fin && sol.estado === 'optimo' ? frac(sol.z) : '—'],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el plano frente al sistema ---------- */

  function montarPlano(cuerpo) {
    const LIM = [[3, 8], [4, 12], [6, 16]];
    const b = B0.slice();
    let p = [1, 1], plano = null, poli = [];
    const ctl = VIZ.controles(cuerpo);
    LIM.forEach(([lo, hi], i) => ctl.rango({ etiqueta: `b${sub(i + 1)} de R${sub(i + 1)}`, min: lo, max: hi, paso: 0.5, valor: b[i], alCambiar: (v) => { b[i] = v; dibujar(); } }));
    ctl.boton('Ir al óptimo', () => { const o = O.optimo2d(poli, [3, 2]); if (o) { p = o.x.slice(); dibujar(); } }, { primario: true });
    ctl.boton('Ir al origen', () => { p = [0, 0]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...A0.map((_, i) => ({ color: COL_R[i], texto: `R${sub(i + 1)} (s${sub(i + 1)} = 0)`, forma: 'linea' })),
      { color: C.neutro, texto: 'región factible' },
      { color: C.s1, texto: 'punto interior', forma: 'punto' },
      { color: C.s2, texto: 'sobre una frontera', forma: 'punto' },
      { color: C.s6, texto: 'vértice', forma: 'punto' },
      { color: C.s8, texto: 'infactible', forma: 'punto' },
    ]);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre para mover el punto (se pega a un vértice si pasa cerca). Cada holgura sᵢ mide la distancia, en unidades de bᵢ, entre el punto y la recta Rᵢ. Mueva los deslizadores para desplazar las rectas.');

    const vars = () => {
      const s = A0.map((a, i) => b[i] - a[0] * p[0] - a[1] * p[1]);
      return { nombres: ['x₁', 'x₂', ...s.map((_, i) => 's' + sub(i + 1))], v: [p[0], p[1], ...s] };
    };
    const estado = () => {
      const { v } = vars();
      if (v.some((q) => q < -1e-9)) return { t: 'infactible', c: C.s8 };
      const nulas = v.filter((q) => Math.abs(q) < 1e-9).length;
      return nulas >= 2 ? { t: 'vértice', c: C.s6 } : nulas === 1 ? { t: 'frontera', c: C.s2 } : { t: 'interior', c: C.s1 };
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      poli = region(A0, b);
      rellenar(ctx, plano, poli, C.neutro);
      A0.forEach((a, i) => recta(ctx, plano, a, b[i], COL_R[i], { texto: `R${sub(i + 1)}`, t: 0.1 + 0.14 * i }));
      for (const [x, y] of poli) VIZ.marcador(ctx, plano.sx(x), plano.sy(y), C.tinta, 3.5);
      const est = estado();
      VIZ.marcador(ctx, plano.sx(p[0]), plano.sy(p[1]), est.c, 7);
      const { nombres, v } = vars();
      fichas.replaceChildren(...v.map((q, i) => VIZ.ficha(`${nombres[i]} = ${frac(q)}`, { color: q < -1e-9 ? C.s8 : Math.abs(q) < 1e-9 ? C.s2 : null, tinta: q < -1e-9 ? C.s8 : null })));
      const nulas = nombres.filter((_, i) => Math.abs(v[i]) < 1e-9);
      const neg = nombres.filter((_, i) => v[i] < -1e-9);
      registro.textContent = est.t === 'infactible'
        ? `Punto fuera de la región: ${neg.join(', ')} ${neg.length > 1 ? 'son negativas' : 'es negativa'} (la holgura negativa indica que la restricción se viola).`
        : est.t === 'vértice' ? `Vértice: ${nulas.length} variables en cero (${nulas.join(', ')}). Con n = 2 variables y m = 3 restricciones hay 5 columnas; un vértice anula al menos 2.`
          : est.t === 'frontera' ? `Sobre una frontera: ${nulas.join(', ')} vale 0, así que esa restricción está activa.`
            : 'Punto interior: ninguna variable es cero, todas las holguras son positivas.';
      lectura.set([
        ['punto (x₁, x₂)', `(${frac(p[0])}, ${frac(p[1])})`],
        ['variables en cero', nulas.length ? nulas.join(', ') : 'ninguna'],
        ['tipo', est.t],
        ['z = 3x₁ + 2x₂', VIZ.fmt(3 * p[0] + 2 * p[1])],
      ]);
    }
    lienzo.alDibujar = dibujar;
    arrastre(lienzo, (x, y, abajo) => {
      if (!plano) return;
      if (abajo) {
        let q = [Math.min(8, Math.max(0, plano.ix(x))), Math.min(8, Math.max(0, plano.iy(y)))];
        for (const [vx, vy] of poli) if (Math.hypot(plano.sx(vx) - x, plano.sy(vy) - y) < 12) q = [vx, vy];
        p = q;
        dibujar();
      }
      if (!plano.dentro(x, y)) return tip.ocultar();
      const px = plano.ix(x), py = plano.iy(y);
      const s = A0.map((a, i) => b[i] - a[0] * px - a[1] * py);
      tip.mostrar(x, y, `x₁ = <b>${VIZ.fmt(px, 3)}</b>, x₂ = <b>${VIZ.fmt(py, 3)}</b>` + s.map((q, i) => VIZ.filaTooltip(COL_R[i], 's' + sub(i + 1), VIZ.fmt(q, 3))).join(''));
    }, () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('standard-form', {
    intro: String.raw`
      <p>El Simplex no trabaja con desigualdades sino con <strong>ecuaciones</strong>. Para pasar de un modelo cualquiera a ese lenguaje se
      agrega una variable por cada desigualdad: una <em>holgura</em> mide lo que sobra de un recurso y un <em>exceso</em> lo que se pasa de un
      mínimo. Así, todas las restricciones se vuelven igualdades y las únicas desigualdades que quedan son los signos de las variables.</p>
      <p>Esa es la <strong>forma estándar</strong>. Lo valioso es que no cambia el problema: cada punto del poliedro corresponde a una solución
      del sistema, y los vértices del plano son exactamente las soluciones en que varias variables valen cero.</p>`,
    visualizaciones: [
      {
        titulo: 'Convertir un modelo a forma estándar',
        descripcion: 'Elija un modelo y avance paso a paso: observe cómo una desigualdad ≤ gana una holgura, una ≥ un exceso, y cómo una variable libre se parte en dos. Pruebe el último modelo: tiene una variable libre y un lado derecho negativo.',
        montar: montarConversion,
      },
      {
        titulo: 'El plano frente al sistema de ecuaciones',
        descripcion: 'Arrastre el punto por el plano y mire las cinco variables \\((x_1, x_2, s_1, s_2, s_3)\\): una holgura vale cero justo sobre su recta y es negativa al cruzarla. Lleve el punto a un vértice y cuente los ceros.',
        montar: montarPlano,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un programa lineal está en <strong>forma estándar</strong> cuando se escribe así:</p>
      \[ \max\; c^\top x \quad \text{s.a.}\quad Ax = b,\quad x \ge 0, \qquad A \in \mathbb{R}^{m\times n},\; b \ge 0. \]
      <p>Todo LP puede llevarse a esta forma sin perder soluciones. Las reglas son mecánicas:</p>
      <table>
        <thead><tr><th>Situación</th><th>Transformación</th></tr></thead>
        <tbody>
          <tr><td>Minimizar \(c^\top x\)</td><td>maximizar \(-c^\top x\) (el valor óptimo cambia de signo)</td></tr>
          <tr><td>\(a^\top x \le \beta\)</td><td>\(a^\top x + s = \beta\), con holgura \(s \ge 0\)</td></tr>
          <tr><td>\(a^\top x \ge \beta\)</td><td>\(a^\top x - e = \beta\), con exceso \(e \ge 0\)</td></tr>
          <tr><td>Variable libre \(x_j\)</td><td>\(x_j = x_j^+ - x_j^-\), con \(x_j^+, x_j^- \ge 0\)</td></tr>
          <tr><td>Variable \(x_j \le 0\)</td><td>\(x_j = -x_j'\), con \(x_j' \ge 0\)</td></tr>
          <tr><td>Lado derecho \(\beta &lt; 0\)</td><td>multiplicar la fila por \(-1\) (invierte el sentido)</td></tr>
        </tbody>
      </table>
      <h2>Interpretación de las holguras</h2>
      <p>Si la restricción \(i\) es \(a_i^\top x \le b_i\), la holgura es \(s_i = b_i - a_i^\top x\): la cantidad de recurso no usada. Es
      positiva en el interior, cero sobre la recta \(a_i^\top x = b_i\) (la restricción está <em>activa</em>) y negativa si el punto no es
      factible. Por eso el poliedro \(\{x : Ax \le b,\ x \ge 0\}\) y el conjunto \(\{(x,s) : Ax + s = b,\ (x,s) \ge 0\}\) son el mismo objeto
      visto de dos maneras, y \(x \mapsto (x,\, b - Ax)\) es una biyección entre ambos.</p>
      <div class="recuadro"><p><strong>Vértice y ceros.</strong> Con \(n\) variables originales y \(m\) restricciones, la forma estándar tiene \(n+m\) columnas y
      \(m\) ecuaciones. Un vértice del plano es un punto donde al menos \(n\) de esas \(n+m\) variables valen cero: se tocan \(n\) fronteras a la vez.</p></div>
      <h2>Ejemplo resuelto</h2>
      <p>El modelo \(\max\, 3x_1 + 2x_2\) con \(x_1 + x_2 \le 5\), \(2x_1 + x_2 \le 8\), \(x_1 + 3x_2 \le 12\) se convierte en</p>
      \[ \begin{aligned} x_1 + x_2 + s_1 &= 5\\ 2x_1 + x_2 + s_2 &= 8\\ x_1 + 3x_2 + s_3 &= 12 \end{aligned}\qquad x_1, x_2, s_1, s_2, s_3 \ge 0. \]
      <p>En \((x_1, x_2) = (3, 2)\) las holguras valen \(s_1 = 0\), \(s_2 = 0\) y \(s_3 = 12 - 3 - 6 = 3\): dos variables nulas y tres positivas,
      un vértice. El valor es \(z = 13\).</p>
      <h2>Conexiones</h2>
      <p>Que el sistema tenga \(m\) ecuaciones y \(n+m\) incógnitas es lo que permite elegir una <a href="tema.html?id=basic-feasible-solutions">base</a>:
      \(m\) columnas que se resuelven y las demás en cero. Esas soluciones se recorren con el <a href="tema.html?id=simplex-tableau">tableau</a>.
      Para el panorama de modelos equivalentes véase <a href="tema.html?id=equivalent-formulations">Equivalent Formulations</a>, y para la geometría
      de los vértices, <a href="tema.html?id=active-constraints-bfs">Active Constraints and Basic Feasible Solutions</a>.</p>`,
  });
})();
