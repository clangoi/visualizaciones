(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  const prod = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm = (a) => Math.hypot(a[0], a[1]);
  const ptos = (v) => `(${VIZ.fmt(v[0], 3)}, ${VIZ.fmt(v[1], 3)})`;
  const SUB = ['₁', '₂', '₃', '₄'];

  function planoIgual(l, cx, cy, semi) {
    const m = { izq: 36, der: 12, sup: 12, inf: 26 };
    const pw = l.ancho - m.izq - m.der, ph = l.alto - m.sup - m.inf;
    const s = Math.min(pw, ph) / (2 * semi);
    const hx = pw / (2 * s), hy = ph / (2 * s);
    return VIZ.plano(l, { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, { margen: m });
  }
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
  function arrastrable(lienzo, alMover) {
    let activo = false;
    const c = lienzo.canvas;
    c.style.cursor = 'crosshair';
    c.addEventListener('pointerdown', (ev) => { activo = true; c.setPointerCapture(ev.pointerId); alMover(lienzo.posicion(ev), true); });
    c.addEventListener('pointermove', (ev) => alMover(lienzo.posicion(ev), activo));
    c.addEventListener('pointerup', () => { activo = false; });
    c.addEventListener('pointerleave', () => alMover(null, false));
  }

  /* ---------- Escenarios: min |x − c|² sujeto a a_j·x ≤ b_j ---------- */

  const ESCENARIOS = {
    triangulo: {
      nombre: 'Triángulo (restricciones independientes)',
      R: [{ a: [1, 1], b: 3 }, { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }],
      c: [2.6, 2.2], centro: [1.5, 1.2], semi: 3.6,
    },
    degenerado: {
      nombre: 'Tres rectas por un mismo punto (degenerado)',
      R: [{ a: [1, 1], b: 2 }, { a: [1, 0], b: 1 }, { a: [0, 1], b: 1 }],
      c: [2.2, 2], centro: [1, 1], semi: 3,
    },
  };
  const LISTA = Object.entries(ESCENARIOS).map(([k, e]) => [k, e.nombre]);
  const COMBOS = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
  const etiquetaConjunto = (S) => (S.length ? '{' + S.map((j) => 'g' + SUB[j]).join(', ') + '}' : '∅ (ninguna)');

  // Resuelve el sistema de KKT suponiendo activas exactamente las restricciones de S (μ_j = 0 para el resto).
  function resolverConjunto(R, c, S, tol = 1e-7) {
    const k = S.length, n = 2 + k;
    const M = Array.from({ length: n }, () => Array(n).fill(0)), rhs = Array(n).fill(0);
    for (let r = 0; r < 2; r++) { M[r][r] = 2; rhs[r] = 2 * c[r]; }
    S.forEach((j, i) => {
      for (let r = 0; r < 2; r++) { M[r][2 + i] = R[j].a[r]; M[2 + i][r] = R[j].a[r]; }
      rhs[2 + i] = R[j].b;
    });
    const sol = O.resolver(M, rhs);
    if (!sol) return { S, estado: 'singular', texto: 'sistema singular: los gradientes activos son linealmente dependientes (no hay multiplicadores únicos)' };
    const x = [sol[0], sol[1]], mu = R.map(() => 0);
    S.forEach((j, i) => { mu[j] = sol[2 + i]; });
    const g = R.map((q) => prod(q.a, x) - q.b);
    const r = { S, x, mu, g };
    const malo = g.findIndex((v, j) => !S.includes(j) && v > tol);
    if (malo >= 0) return { ...r, estado: 'infactible', texto: `infactible: g${SUB[malo]} = ${VIZ.fmt(g[malo], 3)} > 0` };
    const neg = S.find((j) => mu[j] < -tol);
    if (neg !== undefined) return { ...r, estado: 'dual', texto: `μ${SUB[neg]} = ${VIZ.fmt(mu[neg], 3)} < 0` };
    const cero = S.find((j) => Math.abs(mu[j]) <= tol);
    return { ...r, estado: 'kkt', texto: cero !== undefined ? `punto KKT (degenerado: μ${SUB[cero]} = 0 aunque g${SUB[cero]} = 0)` : 'punto KKT' };
  }
  const todos = (R, c) => COMBOS.map((S) => resolverConjunto(R, c, S));
  const primerKKT = (R, c) => todos(R, c).find((r) => r.estado === 'kkt') || resolverConjunto(R, c, []);

  function rellenar(ctx, p, R) {
    const paso = 5;
    ctx.save();
    ctx.fillStyle = VIZ.alfa(C.s3, 0.2);
    for (let px = p.x0; px < p.x1; px += paso) for (let py = p.y1; py < p.y0; py += paso) {
      const x = p.ix(px + paso / 2), y = p.iy(py + paso / 2);
      if (R.every((q) => q.a[0] * x + q.a[1] * y <= q.b)) ctx.fillRect(px, py, Math.min(paso, p.x1 - px), Math.min(paso, p.y0 - py));
    }
    ctx.restore();
  }
  function dibujarRestricciones(ctx, p, R, activas, escenario) {
    R.forEach((q, j) => {
      const act = activas.includes(j);
      ML.contorno(ctx, p, (x, y) => q.a[0] * x + q.a[1] * y - q.b, 0, { color: act ? C.tinta : C.eje, ancho: act ? 3.5 : 1.8, paso: 3 });
      const rp = [escenario.centro[0] + 1.6, escenario.centro[1] + 1.2], n2 = prod(q.a, q.a);
      const t = (q.b - prod(q.a, rp)) / n2, pie = [rp[0] + t * q.a[0], rp[1] + t * q.a[1]], nn = Math.sqrt(n2);
      const lx = p.sx(pie[0] + (0.22 * q.a[0]) / nn), ly = p.sy(pie[1] + (0.22 * q.a[1]) / nn);
      if (lx > p.x0 && lx < p.x1 && ly > p.y1 && ly < p.y0) {
        ctx.save(); ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = act ? C.tinta : C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('g' + SUB[j], lx, ly); ctx.restore();
      }
    });
  }
  function circulos(ctx, p, c, k) {
    ctx.save();
    p.recortar();
    ctx.strokeStyle = C.eje; ctx.lineWidth = 1.1;
    for (let r = 0.5; r <= k; r += 0.5) { ctx.beginPath(); ctx.arc(p.sx(c[0]), p.sy(c[1]), r * Math.abs(p.sx(1) - p.sx(0)), 0, 2 * Math.PI); ctx.stroke(); }
    ctx.restore();
  }
  function anilloCentro(ctx, p, c) {
    ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
    ctx.beginPath(); ctx.arc(p.sx(c[0]), p.sy(c[1]), 5.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  /* ---------- Fig. 1: enumerar conjuntos activos ---------- */

  function montarEnumeracion(cuerpo) {
    let esc = ESCENARIOS.triangulo, c = esc.c.slice(), res = todos(esc.R, c), actual = -1, vistos = new Set(), plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Escenario', opciones: LISTA, valor: 'triangulo', alCambiar: (v) => { esc = ESCENARIOS[v]; c = esc.c.slice(); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Probar los ocho conjuntos', () => { rep.detener(); COMBOS.forEach((_, i) => vistos.add(i)); actual = COMBOS.length - 1; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.66, altoMin: 290, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región factible', forma: 'cuadro' },
      { color: C.tinta, texto: 'restricciones supuestas activas', forma: 'linea' },
      { color: C.eje, texto: 'restricciones supuestas inactivas (μ = 0)', forma: 'linea' },
      { color: C.superficie, borde: C.apagado, texto: 'mínimo sin restricciones' },
      { color: C.s6, texto: 'solución del sistema: punto KKT', forma: 'punto' },
      { color: C.s8, texto: 'solución rechazada', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para probar cada conjunto activo, o haga clic en una fila de la tabla. Arrastre sobre el gráfico para mover el mínimo libre; en el escenario degenerado verá varios conjuntos que dan el mismo punto.');

    function iniciar() {
      vistos = new Set(); actual = -1; res = todos(esc.R, c);
      return (function* () { for (let i = 0; i < COMBOS.length; i++) { actual = i; vistos.add(i); yield; } })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, esc.centro[0], esc.centro[1], esc.semi);
      plano.ejes();
      rellenar(ctx, plano, esc.R);
      circulos(ctx, plano, c, 8);
      const r = actual >= 0 ? res[actual] : null;
      dibujarRestricciones(ctx, plano, esc.R, r ? r.S : [], esc);
      anilloCentro(ctx, plano, c);
      for (const q of res) if (vistos.has(res.indexOf(q)) && q.estado === 'kkt' && q !== r) VIZ.marcador(ctx, plano.sx(q.x[0]), plano.sy(q.x[1]), C.s6, 4);
      if (r && r.x) {
        const gf = [2 * (r.x[0] - c[0]), 2 * (r.x[1] - c[1])];
        flecha(ctx, plano.sx(r.x[0]), plano.sy(r.x[1]), (-gf[0] / (nrm(gf) || 1)) * 46, (gf[1] / (nrm(gf) || 1)) * 46, C.s2);
        VIZ.marcador(ctx, plano.sx(r.x[0]), plano.sy(r.x[1]), r.estado === 'kkt' ? C.s6 : C.s8, 7);
      }
      registro.textContent = !r ? 'Hay 2³ = 8 maneras de decidir qué restricciones están activas. Para cada una se resuelve el sistema (∇f + Σμ∇g = 0, g = 0 en las activas, μ = 0 en las demás) y se filtra.'
        : r.estado === 'singular' ? `Conjunto ${etiquetaConjunto(r.S)}: ${r.texto}.`
          : `Conjunto ${etiquetaConjunto(r.S)}: x = ${ptos(r.x)}, μ = (${r.mu.map((v) => VIZ.fmt(v, 3)).join(', ')}) → ${r.texto}.`;
      const kkt = res.filter((q, i) => vistos.has(i) && q.estado === 'kkt');
      lectura.set([
        ['conjuntos probados', `${vistos.size} de ${COMBOS.length}`], ['puntos KKT hallados', String(kkt.length)],
        ['puntos distintos', String(kkt.filter((q, i) => kkt.findIndex((w) => nrm([w.x[0] - q.x[0], w.x[1] - q.x[1]]) < 1e-6) === i).length)],
        ['mínimo libre', ptos(c)],
      ]);
      const filas = res.map((q, i) => {
        const v = vistos.has(i);
        const txt = !v ? 'pendiente' : q.estado === 'kkt' ? `<b>${q.texto}</b>` : q.texto;
        return `<tr data-i="${i}"><td>${i === actual ? '<b>▶ ' + etiquetaConjunto(q.S) + '</b>' : etiquetaConjunto(q.S)}</td><td>${v && q.x ? ptos(q.x) : '—'}</td><td>${v && q.mu ? '(' + q.mu.map((m) => VIZ.fmt(m, 2)).join(', ') + ')' : '—'}</td><td>${txt}</td></tr>`;
      }).join('');
      caja.innerHTML = `<table class="tabla-datos sin-corte"><thead><tr><th>Activas</th><th>x</th><th>(μ₁, μ₂, μ₃)</th><th>Veredicto</th></tr></thead><tbody>${filas}</tbody></table>`;
    }
    caja.addEventListener('click', (ev) => {
      const tr = ev.target.closest('tr[data-i]');
      if (!tr) return;
      rep.detener();
      actual = +tr.dataset.i; vistos.add(actual);
      dibujar();
    });
    lienzo.alDibujar = () => res.length && dibujar();
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { c = q; res = todos(esc.R, c); dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>` + esc.R.map((s, j) => `g${SUB[j]} = <b>${VIZ.fmt(prod(s.a, q) - s.b, 3)}</b>`).join('  '));
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cuándo se activa cada restricción al mover el mínimo libre ---------- */

  const CAMINOS = {
    g1: { nombre: 'Salir por g₁ (x + y ≤ 3)', de: [0.8, 0.7], a: [3.6, 2.9] },
    g3: { nombre: 'Salir por g₃ (y ≥ 0)', de: [1.2, 0.8], a: [1.6, -2] },
    esquina: { nombre: 'Salir hacia la esquina de g₁ y g₃', de: [1, 0.6], a: [4.4, -1.6] },
  };

  function montarBarrido(cuerpo) {
    const esc = ESCENARIOS.triangulo, R = esc.R;
    let cam = CAMINOS.g1, t = 0.3, muestras = [], plano = null, graf = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Trayectoria del mínimo libre', opciones: Object.entries(CAMINOS).map(([k, v]) => [k, v.nombre]), valor: 'g1', alCambiar: (v) => { cam = CAMINOS[v]; calcular(); dibujar(); } });
    const sT = ctl.rango({ etiqueta: 'Posición a lo largo de la trayectoria', min: 0, max: 1, paso: 0.005, valor: t, formato: (v) => Math.round(v * 100) + ' %', alCambiar: (v) => { t = v; dibujar(); } });
    ctl.boton('Ir al primer cambio de conjunto activo', () => {
      const i0 = muestras.findIndex((m, i) => i > 0 && m.S.join() !== muestras[0].S.join());
      t = i0 > 0 ? muestras[i0].t : 1; sT.valor = t; dibujar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Multiplicador μ (línea continua) y holgura −g (discontinua) de cada restricción en x*');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 200, altoMax: 280 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región factible', forma: 'cuadro' },
      { color: C.s6, texto: 'óptimo x*', forma: 'punto' },
      { color: C.s1, texto: 'g₁', forma: 'linea' }, { color: C.s2, texto: 'g₂', forma: 'linea' }, { color: C.s7, texto: 'g₃', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Deslice la posición del mínimo libre. Mientras está dentro, todo μ vale 0; al salir, el μ de la restricción cruzada crece desde 0 mientras su holgura −g se anula: nunca son positivos a la vez.');

    const COL = [C.s1, C.s2, C.s7];
    const centroEn = (u) => [cam.de[0] + u * (cam.a[0] - cam.de[0]), cam.de[1] + u * (cam.a[1] - cam.de[1])];
    function calcular() {
      muestras = Array.from({ length: 121 }, (_, i) => {
        const u = i / 120, k = primerKKT(R, centroEn(u));
        return { t: u, S: k.S, x: k.x, mu: k.mu, g: k.g };
      });
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, esc.centro[0] + 0.3, 0.5, 3.4);
      plano.ejes();
      rellenar(ctx, plano, R);
      const c = centroEn(t), k = primerKKT(R, c);
      circulos(ctx, plano, c, 8);
      dibujarRestricciones(ctx, plano, R, k.S, esc);
      VIZ.trazar(ctx, plano, [cam.de, cam.a], C.apagado, 1.5, [4, 4]);
      VIZ.trazar(ctx, plano, [c, k.x], C.s2, 2, [3, 3]);
      anilloCentro(ctx, plano, c);
      VIZ.marcador(ctx, plano.sx(k.x[0]), plano.sy(k.x[1]), C.s6, 7);
      registro.textContent = k.S.length === 0 ? 'El mínimo libre es factible: ninguna restricción está activa y todos los multiplicadores valen 0.'
        : `Restricciones activas: ${etiquetaConjunto(k.S)}. x* = ${ptos(k.x)}; multiplicadores ${k.S.map((j) => `μ${SUB[j]} = ${VIZ.fmt(k.mu[j], 3)}`).join(', ')}; las demás tienen μ = 0 y holgura positiva.`;
      lectura.set([
        ['mínimo libre', ptos(c)], ['x*', ptos(k.x)], ['activas', etiquetaConjunto(k.S)],
        ['μ', `(${k.mu.map((v) => VIZ.fmt(v, 3)).join(', ')})`], ['−g', `(${k.g.map((v) => VIZ.fmt(-v, 3)).join(', ')})`],
      ]);
      dibujarSeries();
    }
    function dibujarSeries() {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const mx = Math.max(1, ...muestras.map((m) => Math.max(...m.mu, ...m.g.map((v) => -v)))) * 1.1;
      graf = VIZ.plano(lienzo2, { xmin: 0, xmax: 1, ymin: 0, ymax: mx }, { etiquetaX: 'posición del mínimo libre', formatoX: (v) => Math.round(v * 100) + '%', margen: { izq: 40 } });
      graf.ejes();
      ctx.save(); graf.recortar();
      R.forEach((_, j) => {
        VIZ.trazar(ctx, graf, muestras.map((m) => [m.t, Math.max(0, -m.g[j])]), COL[j], 2, [5, 4]);
        VIZ.trazar(ctx, graf, muestras.map((m) => [m.t, m.mu[j]]), COL[j], 2.5);
      });
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(graf.sx(t), graf.y1); ctx.lineTo(graf.sx(t), graf.y0); ctx.stroke();
      ctx.restore();
    }
    lienzo.alDibujar = () => muestras.length && dibujar();
    lienzo2.alDibujar = () => muestras.length && dibujarSeries();
    lienzo2.canvas.style.cursor = 'pointer';
    const sobreSeries = (ev) => {
      const pos = lienzo2.posicion(ev);
      if (!graf || !graf.dentro(pos.x, pos.y)) return null;
      return { pos, i: Math.max(0, Math.min(120, Math.round(graf.ix(pos.x) * 120))) };
    };
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const s = sobreSeries(ev);
      if (!s) return tip2.ocultar();
      const m = muestras[s.i];
      tip2.mostrar(s.pos.x, s.pos.y, `posición <b>${Math.round(m.t * 100)} %</b>` + R.map((_, j) => VIZ.filaTooltip(COL[j], `g${SUB[j]}: μ ${VIZ.fmt(m.mu[j], 3)}, −g`, VIZ.fmt(Math.max(0, -m.g[j]), 3))).join(''));
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    lienzo2.canvas.addEventListener('click', (ev) => { const s = sobreSeries(ev); if (s) { t = muestras[s.i].t; sT.valor = t; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo.posicion(ev);
      if (!plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>` + R.map((s, j) => `g${SUB[j]} = <b>${VIZ.fmt(prod(s.a, q) - s.b, 3)}</b>`).join('  '));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
    dibujar();
  }

  VIZ.registrarTema('active-inactive-constraints', {
    intro: String.raw`
      <p>Cuando hay varias desigualdades, la dificultad de KKT es combinatoria: ¿cuáles restricciones están <em>activas</em> (pegadas al borde) en el óptimo y cuáles no? Una vez que se supone un conjunto
      activo, el problema se vuelve un sistema de ecuaciones que se sabe resolver; el resto es probar combinaciones y descartar las que no cuadran.</p>
      <p>Esa es la lógica de los métodos de <em>conjunto activo</em>, y también la de los vértices en el Simplex: cada conjunto activo propone un punto, y KKT decide si es el correcto.</p>`,
    visualizaciones: [
      {
        titulo: 'Probar conjuntos activos',
        descripcion: 'Recorra con «Un paso» las ocho combinaciones y vea cuál produce el punto KKT; luego arrastre el mínimo libre y repita. Pruebe el escenario degenerado y observe conjuntos distintos que dan el mismo punto.',
        montar: montarEnumeracion,
      },
      {
        titulo: 'Cuándo se activa cada restricción',
        descripcion: 'Mueva el mínimo libre fuera de la región y mire los multiplicadores: cada μ nace en 0 justo cuando la holgura de su restricción se agota. Use el botón para saltar al primer cambio de conjunto activo.',
        montar: montarBarrido,
      },
    ],
    teoria: String.raw`
      <h2>Idea</h2>
      <p>Las condiciones KKT contienen la holgura complementaria \(\mu_jg_j=0\): para cada restricción, o \(g_j=0\) (activa) o \(\mu_j=0\) (inactiva). Si se <em>fija</em> el conjunto activo \(S\subseteq\{1,\dots,p\}\), las ecuaciones pasan a ser</p>
      \[ \nabla f(x)+\sum_{j\in S}\mu_j\nabla g_j(x)=0,\qquad g_j(x)=0\ \ (j\in S),\qquad \mu_j=0\ \ (j\notin S), \]
      <p>un sistema de \(n+|S|\) ecuaciones con \(n+|S|\) incógnitas \((x,\mu_S)\). Si las restricciones y la función objetivo son lineales o cuadráticas, es un sistema lineal.</p>
      <h2>Algoritmo de enumeración</h2>
      <pre><code>para cada subconjunto S de {1, …, p}:
    resolver el sistema con las restricciones de S activas
    si no tiene solución única:          descartar (gradientes dependientes)
    si algún g_j(x) &gt; 0 con j ∉ S:        descartar (infactible)
    si algún μ_j &lt; 0 con j ∈ S:           descartar (signo dual incorrecto)
    en otro caso:                         x es un punto KKT</code></pre>
      <p>Hay \(2^p\) subconjuntos, lo que lo hace impracticable si \(p\) es grande; los métodos de conjunto activo y de punto interior evitan la enumeración. Pero en problemas pequeños es la mejor manera de entender KKT.</p>
      <h2>Qué significa cada filtro</h2>
      <ul>
        <li><strong>Infactible</strong>: el punto que resuelve el sistema viola una restricción que se supuso inactiva; esa restricción debió estar activa.</li>
        <li><strong>\(\mu_j<0\)</strong>: la restricción \(j\) «tira» hacia el interior de la región en lugar de empujar contra el borde; soltarla permitiría bajar \(f\). Debe ser inactiva.</li>
        <li><strong>Singular</strong>: con las activas elegidas, los gradientes son dependientes (por ejemplo, tres rectas concurrentes en el plano): los multiplicadores no son únicos o no existen.</li>
      </ul>
      <h2>Casos degenerados</h2>
      <p>Una restricción puede estar activa con multiplicador cero (\(g_j=0\) y \(\mu_j=0\)): es el caso <em>degenerado</em> (falla la complementariedad estricta). Ocurre justo en el instante en que la restricción pasa de inactiva a activa (figura 2) y, en el escenario de la figura 1,
      porque tres rectas se cortan en un punto, de modo que varios conjuntos activos distintos describen el mismo punto \(x^*=(1,1)\) y los multiplicadores no son únicos (falla LICQ).</p>
      <h2>Ejemplo resuelto</h2>
      <p>\(\min (x-2{,}6)^2+(y-2{,}2)^2\) con \(x+y\le3\), \(x\ge0\), \(y\ge0\). Con \(S=\varnothing\) el punto \((2{,}6;\,2{,}2)\) viola \(g_1=x+y-3=1{,}8>0\). Con \(S=\{g_1\}\) el sistema es
      \(2(x-2{,}6)+\mu_1=0\), \(2(y-2{,}2)+\mu_1=0\), \(x+y=3\), cuya solución es \(x^*=(1{,}7;\,1{,}3)\) y \(\mu_1=1{,}8\ge0\). Además \(x,y\ge0\) se cumple, luego es un punto KKT. Los demás conjuntos fallan por infactibilidad
      (por ejemplo, \(S=\{g_2\}\) da \(x=0\) y viola \(g_1\)), por signo de \(\mu\) o por singularidad (\(S=\{g_1,g_2,g_3\}\)).</p>
      <h2>Conexiones</h2>
      <p>Es el análogo no lineal de recorrer vértices con el <a href="tema.html?id=simplex-tableau">Simplex</a> (cada base es un conjunto activo). El resultado general se enuncia en <a href="tema.html?id=kkt-conditions">las condiciones KKT</a>;
      el efecto de relajar una restricción activa se estudia en <a href="tema.html?id=multiplier-interpretation">el significado de los multiplicadores</a>; y la degeneración se trata para LP en <a href="tema.html?id=degeneracy-cycling">degeneración y ciclaje</a>.</p>`,
  });
})();
