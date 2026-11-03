(function () {
  'use strict';
  const { color: C, fmt } = VIZ;
  const O = VIZ.opt;

  function interaccion(lienzo, { asas, mover, hover, salir }) {
    const cv = lienzo.canvas;
    let arr = -1;
    const cerca = (x, y) => {
      let m = -1, d = 16;
      asas().forEach(([px, py], i) => { const q = Math.hypot(px - x, py - y); if (q < d) { d = q; m = i; } });
      return m;
    };
    cv.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = cerca(x, y);
      if (i < 0) return;
      arr = i;
      cv.setPointerCapture(ev.pointerId);
      mover(i, x, y);
    });
    cv.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arr >= 0) return mover(arr, x, y);
      cv.style.cursor = cerca(x, y) >= 0 ? 'grab' : 'default';
      if (hover) hover(x, y);
    });
    const fin = () => { arr = -1; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (arr < 0 && salir) salir(); });
  }

  function poligono(ctx, plano, poli, relleno, borde, guiones) {
    if (!poli.length) return;
    ctx.save();
    ctx.beginPath();
    poli.forEach(([x, y], i) => (i ? ctx.lineTo(plano.sx(x), plano.sy(y)) : ctx.moveTo(plano.sx(x), plano.sy(y))));
    ctx.closePath();
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    if (borde) { ctx.strokeStyle = borde; ctx.lineWidth = 2; if (guiones) ctx.setLineDash(guiones); ctx.stroke(); }
    ctx.restore();
  }
  const limpio = (poli) => poli.map((p) => p.map((v) => Math.round(v * 1e9) / 1e9));

  // Texto de una combinación lineal: 2x₁ − x₂ + 3x₃.
  function lineal(coefs, nombres) {
    let s = '';
    coefs.forEach((c, j) => {
      if (Math.abs(c) < 1e-12) return;
      const a = Math.abs(c), cs = a === 1 ? '' : fmt(a);
      s += (s ? (c < 0 ? ' − ' : ' + ') : (c < 0 ? '−' : '')) + cs + nombres[j];
    });
    return s || '0';
  }

  /* ---------- Fig. 1: transformaciones paso a paso ---------- */

  // Modelo original: x₁ ≥ 0, x₂ libre; cuatro restricciones ≤.
  const ROWS = [
    { a: [1, 0], b: 5 },
    { a: [0, -1], b: 3 },
    { a: [1, -1], b: 7 },
    { a: [1, 1], b: 9 },
  ];
  const ORIG = ROWS.concat([{ a: [-1, 0], b: 0 }]);
  const POLI = limpio(O.poligono(ORIG));
  const DOM = { xmin: -1, xmax: 7, ymin: -4, ymax: 10 };

  function montarTransformar(cuerpo) {
    let c1 = 2, c2 = -1, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Coeficiente c₁', min: -3, max: 3, paso: 0.5, valor: c1, alCambiar: (v) => { c1 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Coeficiente c₂', min: -3, max: 3, paso: 0.5, valor: c2, alCambiar: (v) => { c2 = v; dibujar(); } });
    const T = ctl.casillas([
      { clave: 'sentido', texto: 'máx → mín (objetivo −c)', activo: true },
      { clave: 'signo', texto: 'multiplicar restricciones por −1', activo: false },
      { clave: 'holgura', texto: 'holguras: ≤ → =', activo: false },
      { clave: 'libre', texto: 'x₂ = x₂⁺ − x₂⁻', activo: true },
      { clave: 'error', texto: 'cometer un error de signo', activo: false },
    ], () => dibujar());

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.75, altoMin: 290, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'región del modelo original' },
      { color: C.s1, texto: 'óptimo del modelo original', forma: 'cuadro' },
      { color: C.s2, texto: 'óptimo del modelo transformado, de vuelta en x', forma: 'punto' },
      { color: C.s8, texto: 'región del transformado si es distinta', forma: 'linea' },
    ]);
    const modelos = VIZ.el('div', { class: 'dos-columnas' });
    const preA = VIZ.el('pre', { class: 'lista-mono' }), preB = VIZ.el('pre', { class: 'lista-mono' });
    modelos.append(preA, preB);
    cuerpo.appendChild(modelos);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Active transformaciones una a una y compare los dos modelos escritos arriba: el punto naranja siempre cae sobre el cuadrado azul. Con «error de signo» (requiere máx → mín o el cambio de signo) la equivalencia se rompe.');

    // Construye el modelo transformado y lo resuelve con VIZ.opt.lp.
    function construir() {
      const nom = ['x₁', 'x₂'];
      let c = [c1, c2], filas = ROWS.map((r) => ({ a: r.a.slice(), s: '<=', b: r.b }));
      let nombres = nom.slice();
      if (T.libre) { c = [c1, c2, -c2]; filas.forEach((r) => r.a.push(-r.a[1])); nombres = ['x₁', 'x₂⁺', 'x₂⁻']; }
      let efect = filas.map((r) => ({ a: r.a.slice(), s: r.s, b: r.b })); // restricciones tal como quedan, para dibujar la región
      if (T.signo) filas.forEach((r) => { r.a = r.a.map((v) => -v); r.b = -r.b; r.s = T.error ? '<=' : '>='; });
      efect = filas.map((r) => ({ a: r.a.slice(), s: r.s, b: r.b }));
      if (T.holgura) {
        filas.forEach((r, i) => nombres.push('s' + '₁₂₃₄'[i]));
        filas.forEach((r, i) => {
          filas.forEach((q, k) => q.a.push(k === i ? (r.s === '<=' ? 1 : -1) : 0));
        });
        filas.forEach((r) => { r.s = '='; });
        c = c.concat(filas.map(() => 0));
      }
      let cobj = c.slice(), min = false;
      if (T.sentido) { min = true; cobj = T.error && !T.signo ? c.slice() : c.map((v) => -v); }
      // El resolvedor exige variables ≥ 0: si x₂ sigue libre, se divide internamente.
      let A = filas.map((r) => r.a.slice()), cc = cobj.slice(), divide = false;
      if (!T.libre) { divide = true; A = A.map((r) => [...r, -r[1]]); cc = [...cc, -cc[1]]; }
      const r = O.lp(cc, A, filas.map((q) => q.s), filas.map((q) => q.b), { max: !min });
      let x = null, zB = null;
      if (r.estado === 'optimo') {
        const y = r.x;
        x = [y[0], T.libre ? y[1] - y[2] : y[1] - (divide ? y[y.length - 1] : 0)];
        zB = r.z;
      }
      // Textos de los modelos.
      const rel = (s) => (s === '<=' ? '≤' : s === '>=' ? '≥' : '=');
      const textoB = `${min ? 'mín' : 'máx'} ${lineal(cobj, nombres)}\ns.a.\n` + filas.map((q) => `  ${lineal(q.a, nombres)} ${rel(q.s)} ${fmt(q.b)}`).join('\n')
        + `\n  ${nombres.join(', ')} ≥ 0` + (!T.libre ? ' (x₂ libre)' : '');
      return { x, zB, estado: r.estado, min, textoB, efect, nvars: nombres.length, nfilas: filas.length, divide };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const opt = O.optimo2d(POLI, [c1, c2]);
      const B = construir();
      poligono(ctx, plano, POLI, VIZ.alfa(C.s1, 0.2), C.s1);
      const f = (x, y) => c1 * x + c2 * y;
      if (c1 || c2) {
        const sub = Math.max(Math.abs(c1), Math.abs(c2)) * 2;
        for (let k = -8; k <= 8; k++) VIZ.ml.contorno(ctx, plano, f, opt.z + k * sub, { color: C.tenue, ancho: 1 });
      }
      // Región efectiva del modelo transformado (vista en x₁, x₂).
      const filasX = B.efect.map((q) => {
        const a = [q.a[0], T.libre ? q.a[1] : q.a[1]];
        const m = q.s === '>=' ? -1 : 1;
        return { a: [m * a[0], m * a[1]], b: m * q.b };
      });
      const poliB = limpio(O.poligono(filasX.concat([{ a: [-1, 0], b: 0 }])));
      const igual = poliB.length === POLI.length && poliB.every((p, i) => Math.abs(p[0] - POLI[i][0]) + Math.abs(p[1] - POLI[i][1]) < 1e-6);
      if (!igual) poligono(ctx, plano, poliB, null, C.s8, [6, 4]);
      VIZ.marcador(ctx, plano.sx(opt.x[0]), plano.sy(opt.x[1]), C.s1, 7, 1);
      let zOrigDeB = null, equivalente = false, factOrig = false;
      if (B.x) {
        zOrigDeB = f(B.x[0], B.x[1]);
        factOrig = ORIG.every((r) => r.a[0] * B.x[0] + r.a[1] * B.x[1] <= r.b + 1e-6);
        equivalente = factOrig && Math.abs(zOrigDeB - opt.z) < 1e-6;
        ctx.save();
        ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.fillStyle = C.superficie;
        ctx.beginPath(); ctx.arc(plano.sx(B.x[0]), plano.sy(B.x[1]), 9, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        VIZ.marcador(ctx, plano.sx(B.x[0]), plano.sy(B.x[1]), C.s2, 4);
      }
      preA.textContent = `Modelo original\nmáx ${lineal([c1, c2], ['x₁', 'x₂'])}\ns.a.\n` + ROWS.map((r) => `  ${lineal(r.a, ['x₁', 'x₂'])} ≤ ${fmt(r.b)}`).join('\n') + '\n  x₁ ≥ 0, x₂ libre';
      preB.textContent = `Modelo transformado\n${B.textoB}`;
      const aplicadas = [T.sentido && 'máx → mín', T.signo && 'signo de restricciones', T.holgura && 'holguras', T.libre && 'variable libre'].filter(Boolean);
      registro.textContent = B.estado !== 'optimo' ? `El modelo transformado resultó ${B.estado}: la transformación no conserva el problema.`
        : equivalente ? `Transformaciones: ${aplicadas.length ? aplicadas.join(', ') : 'ninguna'}. El óptimo vuelve al mismo punto y el mismo valor ${fmt(opt.z)} (en el modelo transformado vale ${fmt(B.zB)}${B.min ? ', con signo cambiado' : ''}).`
          : `¡No equivalente! El transformado da x = (${fmt(B.x[0], 3)}, ${fmt(B.x[1], 3)}) con valor original ${fmt(zOrigDeB)}${factOrig ? '' : ' (ni siquiera factible en el original)'}, y el verdadero óptimo es ${fmt(opt.z)}.`;
      lectura.set([
        ['óptimo original', `${fmt(opt.z)} en (${fmt(opt.x[0], 3)}, ${fmt(opt.x[1], 3)})`],
        ['valor del transformado', B.zB == null ? '—' : fmt(B.zB)],
        ['mismo punto (x₁, x₂)', B.x ? `(${fmt(B.x[0], 3)}, ${fmt(B.x[1], 3)})` : '—'],
        ['variables / filas', `${B.nvars} / ${B.nfilas}`],
        ['equivalente', equivalente ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const u = plano.ix(x), v = plano.iy(y);
      tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>objetivo = <b>${fmt(c1 * u + c2 * v, 3)}</b><br>${ORIG.every((r) => r.a[0] * u + r.a[1] * v <= r.b) ? 'factible' : 'infactible'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: valor absoluto y máximo linealizados ---------- */

  const RES2 = [
    { a: [1, 0], b: 6 }, { a: [0, 1], b: 5 }, { a: [-1, -1], b: -3 }, { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 },
  ];
  const POLI2 = limpio(O.poligono(RES2));
  const DOM2 = { xmin: -1, xmax: 9, ymin: -1, ymax: 7.5 };

  function montarAbsoluto(cuerpo) {
    let norma = 'l1', P = [7.6, 4.2], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Objetivo con valor absoluto', opciones: [['l1', 'mín |x₁ − p₁| + |x₂ − p₂|'], ['linf', 'mín máx(|x₁ − p₁|, |x₂ − p₂|)']], valor: norma, alCambiar: (v) => { norma = v; dibujar(); } });
    ctl.boton('Poner p dentro de la región', () => { P = [3, 2.5]; dibujar(); });
    ctl.boton('Poner p lejos', () => { P = [7.6, 4.2]; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'región factible' },
      { color: C.eje, texto: 'curvas de nivel del objetivo con |·|', forma: 'linea' },
      { color: C.s1, texto: 'óptimo del LP linealizado', forma: 'cuadro' },
      { color: C.s2, texto: 'óptimo hallado buscando directamente con |·|', forma: 'punto' },
      { color: C.tinta, texto: 'p (arrastrable)', forma: 'punto' },
    ]);
    const pre = VIZ.el('pre', { class: 'lista-mono' });
    cuerpo.appendChild(pre);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre p. El LP con variables auxiliares t (arriba, con los números actuales) y la búsqueda directa sobre la función con valores absolutos dan el mismo valor.');

    const g = () => (norma === 'l1' ? (x, y) => Math.abs(x - P[0]) + Math.abs(y - P[1]) : (x, y) => Math.max(Math.abs(x - P[0]), Math.abs(y - P[1])));
    // LP: variables (x₁, x₂, t₁, t₂) o (x₁, x₂, t).
    function lp() {
      const A = [], b = [];
      if (norma === 'l1') {
        [[0, 2], [1, 3]].forEach(([i, t]) => {
          const f = [0, 0, 0, 0]; f[i] = 1; f[t] = -1; A.push(f); b.push(P[i]);
          const h = [0, 0, 0, 0]; h[i] = -1; h[t] = -1; A.push(h); b.push(-P[i]);
        });
      } else {
        [0, 1].forEach((i) => {
          const f = [0, 0, -1]; f[i] = 1; A.push(f); b.push(P[i]);
          const h = [0, 0, -1]; h[i] = -1; A.push(h); b.push(-P[i]);
        });
      }
      const n = A[0].length;
      RES2.forEach((r) => { const f = Array(n).fill(0); f[0] = r.a[0]; f[1] = r.a[1]; A.push(f); b.push(r.b); });
      const c = norma === 'l1' ? [0, 0, 1, 1] : [0, 0, 1];
      const res = O.lp(c, A, A.map(() => '<='), b, { max: false });
      return { res, A, b, c };
    }
    function directo() {
      const f = g(), cand = POLI2.slice();
      for (let i = 0; i < POLI2.length; i++) {
        const p = POLI2[i], q = POLI2[(i + 1) % POLI2.length];
        for (let k = 0; k <= 400; k++) cand.push([p[0] + ((q[0] - p[0]) * k) / 400, p[1] + ((q[1] - p[1]) * k) / 400]);
      }
      for (let x = 0; x <= 6; x += 0.03) for (let y = 0; y <= 5; y += 0.03) if (RES2.every((r) => r.a[0] * x + r.a[1] * y <= r.b + 1e-9)) cand.push([x, y]);
      let m = null, v = Infinity;
      cand.forEach((q) => { const w = f(q[0], q[1]); if (w < v - 1e-12) { v = w; m = q; } });
      return { x: m, v };
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, DOM2, { etiquetaX: 'x₁', etiquetaY: 'x₂' });
      plano.ejes();
      const L = lp(), D = directo(), f = g();
      poligono(ctx, plano, POLI2, VIZ.alfa(C.s1, 0.2), C.s1);
      for (let k = 1; k <= 7; k++) VIZ.ml.contorno(ctx, plano, f, k * 1.0, { color: C.rejilla, ancho: 1 });
      const ok = L.res.estado === 'optimo';
      if (ok) VIZ.ml.contorno(ctx, plano, f, L.res.z + 1e-9, { color: C.s2, ancho: 1.8, guiones: [4, 3] });
      VIZ.marcador(ctx, plano.sx(P[0]), plano.sy(P[1]), C.tinta, 6, 5);
      if (D.x) { ctx.save(); ctx.strokeStyle = C.s2; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(plano.sx(D.x[0]), plano.sy(D.x[1]), 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if (ok) VIZ.marcador(ctx, plano.sx(L.res.x[0]), plano.sy(L.res.x[1]), C.s1, 6, 1);
      const nm = ['x₁', 'x₂', norma === 'l1' ? 't₁' : 't', 't₂'].slice(0, L.c.length);
      const filasTxt = [];
      const nr = L.A.length - RES2.length;
      for (let i = 0; i < nr; i++) filasTxt.push(`  ${lineal(L.A[i], nm)} ≤ ${fmt(L.b[i])}`);
      pre.textContent = `LP linealizado (x ≥ 0, t ≥ 0)\nmín ${lineal(L.c, nm)}\ns.a.\n${filasTxt.join('\n')}\n  + las ${RES2.length} restricciones originales sobre x₁, x₂`;
      const dif = ok ? Math.abs(L.res.z - D.v) : NaN;
      registro.textContent = ok
        ? `Cada |xᵢ − pᵢ| se reemplaza por una variable tᵢ con tᵢ ≥ xᵢ − pᵢ y tᵢ ≥ −(xᵢ − pᵢ); al minimizar, tᵢ se queda en el valor absoluto. El LP vale ${fmt(L.res.z)} y la búsqueda directa ${fmt(D.v)}.`
        : 'El LP no se pudo resolver.';
      const tsLP = ok ? L.res.x.slice(2) : [];
      lectura.set([
        ['valor del LP', ok ? fmt(L.res.z) : '—'],
        ['valor directo', fmt(D.v)],
        ['diferencia', ok ? fmt(dif, 2) : '—'],
        ['x óptimo (LP)', ok ? `(${fmt(L.res.x[0], 3)}, ${fmt(L.res.x[1], 3)})` : '—'],
        ['t en el óptimo', tsLP.map((v) => fmt(v, 3)).join(', ') || '—'],
        ['variables / filas', `${L.c.length} / ${L.A.length}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    interaccion(lienzo, {
      asas: () => (plano ? [[plano.sx(P[0]), plano.sy(P[1])]] : []),
      mover: (i, x, y) => {
        P = [Math.round(Math.min(DOM2.xmax, Math.max(DOM2.xmin, plano.ix(x))) * 20) / 20, Math.round(Math.min(DOM2.ymax, Math.max(DOM2.ymin, plano.iy(y))) * 20) / 20];
        dibujar();
      },
      hover: (x, y) => {
        if (!plano || !plano.dentro(x, y)) return tip.ocultar();
        const u = plano.ix(x), v = plano.iy(y);
        tip.mostrar(x, y, `x = <b>(${fmt(u, 3)}, ${fmt(v, 3)})</b><br>objetivo = <b>${fmt(g()(u, v), 3)}</b><br>${RES2.every((r) => r.a[0] * u + r.a[1] * v <= r.b) ? 'factible' : 'infactible'}`);
      },
      salir: () => tip.ocultar(),
    });
    dibujar();
  }

  VIZ.registrarTema('equivalent-formulations', {
    intro: String.raw`
      <p>El mismo problema puede escribirse de muchas maneras: maximizar o minimizar, con desigualdades \(\le\) o \(\ge\), con igualdades y variables
      de holgura, con variables libres o no negativas. Dos formulaciones son <strong>equivalentes</strong> si de la solución de una se obtiene
      la de la otra y el valor óptimo coincide, salvo el cambio de signo al pasar de máximo a mínimo.</p>
      <p>Saber transformar modelos es práctico: cada método pide una forma concreta (el Simplex, por ejemplo, la forma estándar) y funciones como el
      valor absoluto, que no son lineales, se pueden reescribir para que el problema siga siendo un LP.</p>`,
    visualizaciones: [
      {
        titulo: 'Transformaciones que no cambian el óptimo',
        descripcion: 'Active las casillas una por una y lea cómo se reescribe el modelo; el punto naranja (óptimo del transformado) cae siempre sobre el cuadrado azul. Active «error de signo» junto a una transformación de signo y verá una región roja distinta y un óptimo equivocado.',
        montar: montarTransformar,
      },
      {
        titulo: 'Valor absoluto y máximo como LP',
        descripcion: 'Arrastre p: el óptimo es el punto de la región más cercano a p según la norma elegida. Compare el LP con variables auxiliares t y la búsqueda directa sobre |·|: coinciden, también cuando p cae dentro de la región (valor 0).',
        montar: montarAbsoluto,
      },
    ],
    teoria: String.raw`
      <h2>Equivalencias básicas</h2>
      <table>
        <tr><th>transformación</th><th>regla</th></tr>
        <tr><td>maximizar ↔ minimizar</td><td>\(\max f = -\min(-f)\); mismo punto óptimo, valor con signo opuesto</td></tr>
        <tr><td>cambio de sentido</td><td>\(a^\top x \le b \iff -a^\top x \ge -b\) (al multiplicar por \(-1\) la desigualdad se invierte)</td></tr>
        <tr><td>desigualdad → igualdad</td><td>\(a^\top x \le b \iff a^\top x + s = b,\ s \ge 0\) (holgura); para \(\ge\), \(a^\top x - s = b\) (exceso)</td></tr>
        <tr><td>igualdad → desigualdades</td><td>\(a^\top x = b \iff a^\top x \le b\) y \(a^\top x \ge b\)</td></tr>
        <tr><td>variable libre</td><td>\(x = x^+ - x^-\) con \(x^+, x^- \ge 0\)</td></tr>
        <tr><td>cota inferior distinta de 0</td><td>\(x \ge \ell\): sustituir \(x = \ell + x'\) con \(x' \ge 0\)</td></tr>
      </table>
      <p>En la primera figura, el modelo original tiene \(x_2\) libre y restricciones \(\le\); tras las cuatro transformaciones queda en <em>forma estándar</em> (mínimo, igualdades, variables no negativas), con 8 variables. Un error típico es multiplicar por \(-1\) y olvidar invertir la desigualdad: se obtiene otra región factible y otro problema.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Para \(\max\ 2x_1 - x_2\) con \(x_1 \le 5,\ -x_2 \le 3,\ x_1 - x_2 \le 7,\ x_1 + x_2 \le 9,\ x_1 \ge 0\): como el objetivo prefiere \(x_2\) pequeño y \(x_1\) grande, el óptimo está en \(x_1 = 5\) con \(x_1 - x_2 = 7\), es decir \(x^\ast = (5, -2)\) y valor 12. Con \(x_2 = x_2^+ - x_2^-\) se tiene \(x_2^+ = 0,\ x_2^- = 2\); el valor del problema de mínimo \(-2x_1 + x_2^+ - x_2^-\) es \(-12\).</p>
      <h2>Valor absoluto y máximo</h2>
      <p>Minimizar una suma de valores absolutos con coeficientes positivos es un LP:</p>
      \[ \min \sum_i |x_i - p_i| \;\iff\; \min \sum_i t_i \quad \text{s.a.}\quad t_i \ge x_i - p_i,\ \ t_i \ge -(x_i - p_i). \]
      <p>Como \(t_i\) se minimiza, en el óptimo \(t_i = \max(x_i - p_i,\ p_i - x_i) = |x_i - p_i|\). Del mismo modo,</p>
      \[ \min \max_i |x_i - p_i| \;\iff\; \min t \quad \text{s.a.}\quad -t \le x_i - p_i \le t \ \ \forall i. \]
      <p>El truco depende del signo: minimizar \(|x|\) o \(\max\) de funciones convexas es linealizable, pero <em>maximizar</em> un valor absoluto no lo es (el problema deja de ser convexo y necesita variables enteras; véase <a href="tema.html?id=piecewise-linear">funciones lineales por tramos</a>).</p>
      <h2>Por qué importa</h2>
      <p>Las equivalencias permiten llevar cualquier LP a la <a href="tema.html?id=standard-form">forma estándar</a> que usa el <a href="tema.html?id=simplex-tableau">tableau del Simplex</a>, y construir el <a href="tema.html?id=dual-construction">dual</a> de forma sistemática. Revise también la <a href="tema.html?id=optimization-problem-anatomy">anatomía del problema</a> y la clasificación en <a href="tema.html?id=problem-classes">LP, ILP, MILP y NLP</a>.</p>`,
  });
})();
