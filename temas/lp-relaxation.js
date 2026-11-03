(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* Problemas de ejemplo: max c·x  s.a.  a1 x + a2 y ≤ b,  x, y ≥ 0. */
  const PROBLEMAS = {
    clasico: { nombre: 'Dos recursos (clásico)', c: [5, 8], filas: [[1, 1, 6], [5, 9, 45]], dom: [0, 7, 0, 7] },
    esquina: { nombre: 'Esquina fraccionaria', c: [4, 3], filas: [[2, 1, 10.5], [1, 2, 9], [3, 4, 17]], dom: [0, 6.5, 0, 6] },
    lados: { nombre: 'Dos restricciones oblicuas', c: [3, 4], filas: [[2, 3, 12], [3, 1, 9]], dom: [0, 5, 0, 5] },
    ancho: { nombre: 'Región alargada', c: [7, 9], filas: [[-1, 3, 6], [7, 1, 35]], dom: [0, 6, 0, 6] },
  };

  const restricciones = (P) => [...P.filas.map(([a1, a2, b]) => ({ a: [a1, a2], b })), { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }];
  const cumple = (P, p) => p[0] >= -1e-9 && p[1] >= -1e-9 && P.filas.every(([a1, a2, b]) => a1 * p[0] + a2 * p[1] <= b + 1e-9);
  const valor = (c, p) => c[0] * p[0] + c[1] * p[1];

  /* Resuelve el problema con las variables marcadas como enteras. Devuelve el polígono, el óptimo relajado,
     las piezas factibles (puntos o segmentos) y el óptimo del problema con integralidad. */
  function resolver(P, c, ent) {
    const poli = O.poligono(restricciones(P), { xmin: -1, xmax: 50, ymin: -1, ymax: 50 });
    const lp = O.optimo2d(poli, c);
    const piezas = [];
    let mejor = null;
    const considerar = (p) => { const z = valor(c, p); if (!mejor || z > mejor.z + 1e-9) mejor = { x: p, z }; };
    const xmax = Math.ceil(Math.max(0, ...poli.map((p) => p[0]))), ymax = Math.ceil(Math.max(0, ...poli.map((p) => p[1])));
    if (!ent[0] && !ent[1]) { if (lp) mejor = { x: lp.x, z: lp.z }; return { poli, lp, piezas, ip: mejor }; }
    if (ent[0] && ent[1]) {
      for (let i = 0; i <= xmax; i++) for (let j = 0; j <= ymax; j++) if (cumple(P, [i, j])) { piezas.push({ p: [i, j] }); considerar([i, j]); }
      return { poli, lp, piezas, ip: mejor };
    }
    // Una sola variable entera: para cada valor fijo, la otra recorre un intervalo.
    const k = ent[0] ? 0 : 1, o = 1 - k;
    for (let v = 0; v <= (k === 0 ? xmax : ymax); v++) {
      let lo = 0, hi = Infinity, ok = true;
      for (const f of P.filas) {
        const resto = f[2] - f[k] * v;
        if (f[o] > 1e-12) hi = Math.min(hi, resto / f[o]);
        else if (f[o] < -1e-12) lo = Math.max(lo, resto / f[o]);
        else if (resto < -1e-9) ok = false;
      }
      if (!ok || lo > hi + 1e-9 || !Number.isFinite(hi)) continue;
      const mk = (t) => (k === 0 ? [v, t] : [t, v]);
      piezas.push({ a: mk(lo), b: mk(hi) });
      considerar(mk(c[o] > 0 ? hi : lo));
    }
    return { poli, lp, piezas, ip: mejor };
  }

  const fp = (p) => `(${VIZ.fmt(p[0], 3)}, ${VIZ.fmt(p[1], 3)})`;

  /* ---------- Fig. 1: la relajación en el plano ---------- */

  function montarPlano(cuerpo) {
    let clave = 'clasico', c = PROBLEMAS.clasico.c.slice(), ent = [true, true], elegido = null, sol = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, p]) => [k, p.nombre]), valor: clave, alCambiar: (v) => { clave = v; c = PROBLEMAS[v].c.slice(); s1.valor = c[0]; s2.valor = c[1]; elegido = null; dibujar(); } });
    const s1 = ctl.rango({ etiqueta: 'Ganancia c₁ (de x)', min: 0, max: 10, valor: c[0], alCambiar: (v) => { c[0] = v; dibujar(); } });
    const s2 = ctl.rango({ etiqueta: 'Ganancia c₂ (de y)', min: 0, max: 10, valor: c[1], alCambiar: (v) => { c[1] = v; dibujar(); } });
    ctl.casillas([{ clave: 'x', texto: 'x entera', activo: true }, { clave: 'y', texto: 'y entera', activo: true }], (e) => { ent = [e.x, e.y]; dibujar(); });
    ctl.boton('Quitar punto elegido', () => { elegido = null; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.8, altoMin: 300, altoMax: 520 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.25), borde: C.s1, texto: 'región relajada' },
      { color: C.tinta2, texto: 'solución entera factible', forma: 'punto' },
      { color: C.s2, texto: 'óptimo relajado', forma: 'punto' },
      { color: C.s6, texto: 'óptimo entero', forma: 'punto' },
      { color: C.s3, texto: 'redondeo factible', forma: 'punto' },
      { color: C.s8, texto: 'redondeo infactible', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el plano para probar el punto entero más cercano. Las rectas punteadas son curvas de nivel de la ganancia que pasan por cada óptimo.');

    function dibujar() {
      const P = PROBLEMAS[clave];
      const { ctx } = lienzo;
      lienzo.limpiar();
      sol = resolver(P, c, ent);
      const plano = VIZ.plano(lienzo, { xmin: P.dom[0], xmax: P.dom[1], ymin: P.dom[2], ymax: P.dom[3] }, { etiquetaX: 'x', etiquetaY: 'y' });
      geo = plano;
      plano.ejes();
      // Región relajada.
      ctx.beginPath();
      sol.poli.forEach((p, i) => (i ? ctx.lineTo(plano.sx(p[0]), plano.sy(p[1])) : ctx.moveTo(plano.sx(p[0]), plano.sy(p[1]))));
      ctx.closePath();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.12); ctx.fill();
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke();
      // Curvas de nivel por los dos óptimos.
      const nivel = (z, col) => {
        if (!(c[0] || c[1])) return;
        ctx.save(); ctx.beginPath(); ctx.rect(plano.x0, plano.y1, plano.x1 - plano.x0, plano.y0 - plano.y1); ctx.clip();
        ctx.setLineDash([5, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath();
        const pts = Math.abs(c[1]) > Math.abs(c[0])
          ? [[P.dom[0], (z - c[0] * P.dom[0]) / c[1]], [P.dom[1], (z - c[0] * P.dom[1]) / c[1]]]
          : [[(z - c[1] * P.dom[2]) / c[0], P.dom[2]], [(z - c[1] * P.dom[3]) / c[0], P.dom[3]]];
        ctx.moveTo(plano.sx(pts[0][0]), plano.sy(pts[0][1])); ctx.lineTo(plano.sx(pts[1][0]), plano.sy(pts[1][1]));
        ctx.stroke(); ctx.restore();
      };
      if (sol.lp && sol.ip) { nivel(sol.lp.z, C.s2); if (Math.abs(sol.ip.z - sol.lp.z) > 1e-9) nivel(sol.ip.z, C.s6); }
      // Conjunto entero factible.
      const enteros = ent[0] || ent[1];
      if (enteros) {
        const dos = ent[0] && ent[1];
        // Lattice de fondo: puntos enteros no factibles, muy tenues.
        if (dos) for (let i = Math.ceil(P.dom[0]); i <= P.dom[1]; i++) for (let j = Math.ceil(P.dom[2]); j <= P.dom[3]; j++) if (!cumple(P, [i, j])) { ctx.fillStyle = C.tenue; ctx.beginPath(); ctx.arc(plano.sx(i), plano.sy(j), 2, 0, 7); ctx.fill(); }
        for (const q of sol.piezas) {
          if (q.p) { ctx.fillStyle = C.tinta2; ctx.beginPath(); ctx.arc(plano.sx(q.p[0]), plano.sy(q.p[1]), 3.5, 0, 7); ctx.fill(); }
          else { ctx.strokeStyle = C.tinta2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(plano.sx(q.a[0]), plano.sy(q.a[1])); ctx.lineTo(plano.sx(q.b[0]), plano.sy(q.b[1])); ctx.stroke(); }
        }
      }
      // Redondeos del óptimo relajado.
      const redondeos = [];
      if (sol.lp && enteros) {
        const opciones = (k) => (ent[k] ? [...new Set([Math.floor(sol.lp.x[k] + 1e-9), Math.ceil(sol.lp.x[k] - 1e-9)])] : [sol.lp.x[k]]);
        for (const a of opciones(0)) for (const b of opciones(1)) {
          if (Math.abs(a - sol.lp.x[0]) < 1e-9 && Math.abs(b - sol.lp.x[1]) < 1e-9) continue;
          redondeos.push({ p: [a, b], ok: cumple(P, [a, b]), z: valor(c, [a, b]) });
        }
        for (const r of redondeos) VIZ.marcador(ctx, plano.sx(r.p[0]), plano.sy(r.p[1]), r.ok ? C.s3 : C.s8, r.ok ? 5 : 6, r.ok ? 0 : 5);
      }
      if (sol.ip && enteros) VIZ.marcador(ctx, plano.sx(sol.ip.x[0]), plano.sy(sol.ip.x[1]), C.s6, 6.5, 0);
      if (sol.lp) VIZ.marcador(ctx, plano.sx(sol.lp.x[0]), plano.sy(sol.lp.x[1]), C.s2, 6, 3);
      if (elegido) VIZ.marcador(ctx, plano.sx(elegido[0]), plano.sy(elegido[1]), C.tinta, 4, 1);

      // Lectura y registro.
      const buenos = redondeos.filter((r) => r.ok);
      const mejorR = buenos.length ? Math.max(...buenos.map((r) => r.z)) : null;
      const gap = sol.lp && sol.ip ? sol.lp.z - sol.ip.z : 0;
      lectura.set([
        ['óptimo relajado z_LP', sol.lp ? `${VIZ.fmt(sol.lp.z)} en ${fp(sol.lp.x)}` : '—'],
        ['óptimo entero z_IP', sol.ip && enteros ? `${VIZ.fmt(sol.ip.z)} en ${fp(sol.ip.x)}` : 'sin integralidad'],
        ['brecha z_LP − z_IP', enteros && sol.ip ? `${VIZ.fmt(gap)} (${VIZ.fmt(sol.ip.z ? (100 * gap) / Math.abs(sol.ip.z) : 0, 3)} %)` : '0'],
        ['redondeos factibles', enteros && sol.lp ? `${buenos.length} de ${redondeos.length}` : '—'],
        ['mejor redondeo', mejorR == null ? 'ninguno' : `${VIZ.fmt(mejorR)}${sol.ip && mejorR < sol.ip.z - 1e-9 ? ' (subóptimo)' : ''}`],
      ]);
      if (!enteros) registro.textContent = 'Sin restricciones de integralidad el problema es un LP: el óptimo está en un vértice y puede ser fraccionario.';
      else if (gap < 1e-9) registro.textContent = 'La relajación ya es entera: z_LP = z_IP, no hay brecha.';
      else registro.textContent = `El óptimo relajado ${fp(sol.lp.x)} es fraccionario. Redondearlo ${redondeos.length - buenos.length ? `produce ${redondeos.length - buenos.length} punto(s) infactible(s)` : 'da puntos factibles'}${mejorR != null && mejorR < sol.ip.z - 1e-9 ? ' y el mejor redondeo factible queda por debajo del óptimo entero' : ''}.`;
      if (elegido) {
        const ok = cumple(P, elegido);
        registro.textContent += ` Punto elegido ${fp(elegido)}: ${ok ? 'factible, z = ' + VIZ.fmt(valor(c, elegido)) : 'infactible'}.`;
      }
    }
    lienzo.alDibujar = dibujar;

    const cerca = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.dentro(x, y)) return null;
      const dos = ent[0] && ent[1];
      return { x, y, p: [ent[0] || dos ? Math.round(geo.ix(x)) : geo.ix(x), ent[1] || dos ? Math.round(geo.iy(y)) : geo.iy(y)] };
    };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const q = cerca(ev);
      if (!q) return tip.ocultar();
      const ok = cumple(PROBLEMAS[clave], q.p);
      tip.mostrar(q.x, q.y, `punto <b>${fp(q.p)}</b><br>${ok ? 'factible' : 'infactible'}<br>z = <b>${VIZ.fmt(valor(c, q.p))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const q = cerca(ev); if (q) { elegido = q.p; dibujar(); } });
    dibujar();
  }

  /* ---------- Fig. 2: mochila, cota fraccionaria y redondeo ---------- */

  function montarMochila(cuerpo) {
    let semilla = 3, n = 7, pesos = [], valores = [], cap = 20, capMax = 40, geo = [];
    const ctl = VIZ.controles(cuerpo);
    const rcap = ctl.rango({ etiqueta: 'Capacidad C', min: 8, max: 40, valor: cap, alCambiar: (v) => { cap = v; dibujar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; datos(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 295 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'objeto completo (x = 1)' },
      { color: C.s2, texto: 'objeto fraccionado (0 < x < 1)' },
      { color: C.s4, texto: 'objeto añadido por redondeo' },
      { color: C.s6, texto: 'óptimo entero' },
      { color: C.s8, texto: 'exceso sobre la capacidad' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre un objeto para ver su peso, valor y razón valor/peso. Los objetos se ordenan por razón decreciente: la relajación llena la mochila en ese orden y fracciona el último.');

    function datos() {
      const r = VIZ.semilla(semilla * 17 + 5);
      pesos = []; valores = [];
      for (let i = 0; i < n; i++) { const w = 3 + Math.floor(r() * 10); pesos.push(w); valores.push(w + 2 + Math.floor(r() * 9)); }
      capMax = Math.max(12, Math.floor(pesos.reduce((s, v) => s + v, 0) * 0.8));
      cap = Math.max(8, Math.floor(pesos.reduce((s, v) => s + v, 0) * 0.45));
      rcap.input.max = capMax; rcap.valor = cap; rcap.refrescar();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const rel = O.mochilaFraccionaria(valores, pesos, cap);
      const dp = O.mochila(valores, pesos, cap);
      const orden = rel.orden;
      const frac = orden.find((i) => rel.x[i] > 1e-9 && rel.x[i] < 1 - 1e-9);
      const abajo = orden.filter((i) => rel.x[i] >= 1 - 1e-9);
      const zAbajo = abajo.reduce((s, i) => s + valores[i], 0);
      const pesoArriba = abajo.reduce((s, i) => s + pesos[i], 0) + (frac != null ? pesos[frac] : 0);
      const total = Math.max(cap, pesoArriba) * 1.04;
      const izq = 12, der = W - 12, esc = (der - izq) / total, filaH = 62, sup = 26;
      geo = [];
      const filas = [
        { tit: 'Relajación lineal', z: rel.z, seg: orden.filter((i) => rel.x[i] > 1e-9).map((i) => ({ i, f: rel.x[i], col: rel.x[i] < 1 - 1e-9 ? C.s2 : C.s1 })) },
        { tit: 'Redondeo hacia arriba', z: zAbajo + (frac != null ? valores[frac] : 0), seg: [...abajo.map((i) => ({ i, f: 1, col: C.s1 })), ...(frac != null ? [{ i: frac, f: 1, col: C.s4 }] : [])] },
        { tit: 'Redondeo hacia abajo', z: zAbajo, seg: abajo.map((i) => ({ i, f: 1, col: C.s1 })) },
        { tit: 'Óptimo entero (programación dinámica)', z: dp.valor, seg: orden.filter((i) => dp.elegidos.includes(i)).map((i) => ({ i, f: 1, col: C.s6 })) },
      ];
      geo = [];
      filas.forEach((fila, r) => {
        const y = sup + r * filaH;
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(fila.tit, izq, y - 6);
        ctx.textAlign = 'right'; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11);
        ctx.fillText(`z = ${VIZ.fmt(fila.z)}`, der, y - 6);
        ctx.fillStyle = C.neutro; ctx.fillRect(izq, y, cap * esc, 30);
        let acum = 0;
        for (const s of fila.seg) {
          const w = pesos[s.i] * s.f * esc, x0 = izq + acum * esc;
          const excede = acum + pesos[s.i] * s.f > cap + 1e-9;
          ctx.fillStyle = s.col; ctx.fillRect(x0, y, w, 30);
          if (excede) {
            const e0 = Math.max(x0, izq + cap * esc);
            ctx.fillStyle = C.s8; ctx.fillRect(e0, y, x0 + w - e0, 30);
          }
          ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.strokeRect(x0, y, w, 30);
          if (w > 22) { ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = VIZ.fuente(11, 600); ctx.fillText(s.f < 1 - 1e-9 ? `${s.i + 1} · ${VIZ.fmt(s.f, 2)}` : String(s.i + 1), x0 + w / 2, y + 15); }
          geo.push({ x0, x1: x0 + w, y0: y, y1: y + 30, i: s.i, f: s.f, fila: fila.tit });
          acum += pesos[s.i] * s.f;
        }
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`peso ${VIZ.fmt(acum, 4)} de ${cap}`, izq, y + 33);
      });
      // Línea de capacidad.
      const xc = izq + cap * esc;
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xc, sup - 2); ctx.lineTo(xc, sup + 4 * filaH - 22); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('C', xc, sup + 4 * filaH - 20);
      const gapAbs = rel.z - dp.valor;
      lectura.set([
        ['cota de la relajación', VIZ.fmt(rel.z)],
        ['óptimo entero', VIZ.fmt(dp.valor)],
        ['brecha de integralidad', `${VIZ.fmt(gapAbs)} (${VIZ.fmt(dp.valor ? (100 * gapAbs) / dp.valor : 0, 3)} %)`],
        ['redondeo hacia abajo', `${VIZ.fmt(zAbajo)} (${VIZ.fmt(dp.valor - zAbajo)} menos que el óptimo)`],
        ['redondeo hacia arriba', frac != null ? `infactible: pesa ${pesoArriba} > ${cap}` : 'factible'],
      ]);
      registro.textContent = frac == null
        ? 'La mochila se llena justo con objetos completos: la relajación ya es entera.'
        : `La relajación toma completos los objetos de mayor razón y solo ${VIZ.fmt(rel.x[frac], 2)} del objeto ${frac + 1}: ninguna mochila real puede llevar media pieza. ` +
          (dp.valor < zAbajo + 1e-9 ? 'Aquí redondear hacia abajo resulta ser óptimo.' : `El óptimo entero (${VIZ.fmt(dp.valor)}) elige otra combinación de objetos.`);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `objeto <b>${g.i + 1}</b><br>peso ${pesos[g.i]}, valor ${valores[g.i]}<br>valor/peso ${VIZ.fmt(valores[g.i] / pesos[g.i], 3)}<br>fracción tomada <b>${VIZ.fmt(g.f, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    datos();
    dibujar();
  }

  VIZ.registrarTema('lp-relaxation', {
    intro: String.raw`
      <p>Un problema entero es difícil porque exige que ciertas variables sean enteras. La <strong>relajación lineal</strong> hace trampa a propósito:
      olvida esa exigencia, deja las variables moverse en un intervalo continuo y resuelve el programa lineal resultante, que sabemos resolver rápido.
      La respuesta casi nunca es entera, pero siempre dice algo valioso: ningún punto entero puede ser mejor que ella.</p>
      <p>Por eso la relajación es la pieza central de los resolvedores modernos: da una <em>cota</em> que se compara con la mejor solución entera conocida
      y que guía a la ramificación y a los cortes. Y por eso tampoco basta con <em>redondear</em> su solución: el punto redondeado puede violar las restricciones
      o quedar lejos del verdadero óptimo.</p>`,
    visualizaciones: [
      {
        titulo: 'Relajación y óptimo entero en el plano',
        descripcion: 'Elija un problema y cambie las ganancias \\(c_1, c_2\\): el óptimo relajado (rombo naranjo) salta de vértice en vértice mientras el óptimo entero (verde) se queda en un punto de la rejilla. Desmarque «x entera» o «y entera» para ver un problema mixto, y observe cuáles redondeos son infactibles.',
        montar: montarPlano,
      },
      {
        titulo: 'Mochila: cota fraccionaria frente a redondeo',
        descripcion: 'La relajación de la mochila toma una fracción del último objeto. Mueva la capacidad \\(C\\) y compare cuatro filas: relajación, redondeo hacia arriba (excede la capacidad), redondeo hacia abajo (queda corto) y el óptimo entero, que puede reordenar los objetos.',
        montar: montarMochila,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea el programa entero (maximización)</p>
      \[ z_{IP} = \max\{\, c^\top x \;:\; Ax \le b,\; x \ge 0,\; x \in \mathbb{Z}^n \,\}. \]
      <p>Su <strong>relajación lineal</strong> elimina la condición \(x \in \mathbb{Z}^n\):</p>
      \[ z_{LP} = \max\{\, c^\top x \;:\; Ax \le b,\; x \ge 0 \,\}. \]
      <p>Si solo algunas variables deben ser enteras (problema mixto, MILP), se relajan únicamente esas.</p>
      <div class="recuadro"><p><strong>Cota.</strong> Toda solución entera factible es factible para la relajación, por lo que
      \(z_{IP} \le z_{LP}\) (en minimización, \(z_{IP} \ge z_{LP}\)). Si el óptimo de la relajación resulta entero, también es óptimo del problema entero.</p></div>
      <h2>Brecha de integralidad</h2>
      <p>La diferencia \(z_{LP} - z_{IP}\) (o su versión relativa \((z_{LP}-z_{IP})/|z_{IP}|\)) mide qué tan floja es la relajación. Una formulación es mejor
      cuanto menor es esa brecha; en el extremo, si la región relajada coincide con la envoltura convexa de los puntos enteros, la brecha es cero (véase
      <a href="tema.html?id=valid-inequalities">desigualdades válidas y formulaciones fuertes</a>).</p>
      <h2>Ejemplo resuelto</h2>
      <p>Sea \(\max\, 5x + 8y\) sujeto a \(x + y \le 6\), \(5x + 9y \le 45\), \(x, y \ge 0\) enteros. La relajación tiene su óptimo donde se cortan las dos restricciones:
      de \(x + y = 6\) y \(5x + 9y = 45\) sale \(54 - 4x = 45\), así que</p>
      \[ x = \tfrac{9}{4},\quad y = \tfrac{15}{4},\quad z_{LP} = 5\cdot\tfrac{9}{4} + 8\cdot\tfrac{15}{4} = 41{,}25. \]
      <p>Ninguna de las cuatro formas de redondear sirve: \((2,4)\) y \((3,4)\) violan \(5x + 9y \le 45\) (dan 46 y 51); \((2,3)\) es factible pero vale 34 y \((3,3)\) vale 39.
      El óptimo entero es \((0,5)\) con \(z_{IP} = 40\), un punto que ni siquiera está cerca del óptimo relajado. La brecha es \(1{,}25\) (3,1 %).</p>
      <h2>Por qué redondear no basta</h2>
      <ul>
        <li><strong>Infactibilidad:</strong> en dimensión alta puede no existir ningún redondeo factible (por ejemplo, con restricciones de igualdad).</li>
        <li><strong>Subóptimo:</strong> aunque exista, puede estar arbitrariamente lejos del óptimo; el ejemplo anterior pierde una unidad completa.</li>
        <li><strong>Lejanía:</strong> el óptimo entero no tiene por qué ser vecino del óptimo relajado.</li>
      </ul>
      <p>Hay casos felices: si la matriz \(A\) es totalmente unimodular (flujos en redes, asignación, transporte con datos enteros) los vértices de la relajación ya son
      enteros y resolver el LP basta; véase <a href="tema.html?id=network-flow-model">el modelo de flujo en redes</a>.</p>
      <h2>Para qué se usa la relajación</h2>
      <ul>
        <li>Como <strong>cota superior</strong> en <a href="tema.html?id=milp-branch-and-bound">ramificación y acotamiento</a> (o <a href="tema.html?id=branch-and-bound">el método general</a>): un nodo se poda si su cota no supera al incumbente.</li>
        <li>Como punto de partida de los <a href="tema.html?id=cutting-planes">planos cortantes</a>, que la ajustan sin perder soluciones enteras.</li>
        <li>Para comparar formulaciones del mismo problema, por ejemplo el <a href="tema.html?id=knapsack-problem">problema de la mochila</a> con la cota fraccionaria por razón valor/peso.</li>
      </ul>
      <p>La clasificación de modelos según tengan o no variables enteras está en <a href="tema.html?id=problem-classes">LP, ILP, MILP y NLP</a>.</p>`,
  });
})();
