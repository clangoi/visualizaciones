(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt, ML = VIZ.ml;

  const prod = (a, b) => a[0] * b[0] + a[1] * b[1];
  const nrm = (a) => Math.hypot(a[0], a[1]);
  const ptos = (v) => `(${VIZ.fmt(v[0], 3)}, ${VIZ.fmt(v[1], 3)})`;
  const SUB = ['₁', '₂', '₃'];
  const S2 = Math.SQRT2;

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
  function circulos(ctx, p, c, k) {
    ctx.save();
    p.recortar();
    ctx.strokeStyle = C.eje; ctx.lineWidth = 1.1;
    for (let r = 0.5; r <= k; r += 0.5) { ctx.beginPath(); ctx.arc(p.sx(c[0]), p.sy(c[1]), r * Math.abs(p.sx(1) - p.sx(0)), 0, 2 * Math.PI); ctx.stroke(); }
    ctx.restore();
  }
  function anillo(ctx, p, c) {
    ctx.save(); ctx.strokeStyle = C.apagado; ctx.lineWidth = 2; ctx.fillStyle = C.superficie;
    ctx.beginPath(); ctx.arc(p.sx(c[0]), p.sy(c[1]), 5.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function rellenar(ctx, p, G) {
    const paso = 5;
    ctx.save();
    ctx.fillStyle = VIZ.alfa(C.s3, 0.2);
    for (let px = p.x0; px < p.x1; px += paso) for (let py = p.y1; py < p.y0; py += paso) {
      if (G(p.ix(px + paso / 2), p.iy(py + paso / 2)) <= 0) ctx.fillRect(px, py, Math.min(paso, p.x1 - px), Math.min(paso, p.y0 - py));
    }
    ctx.restore();
  }

  /* ---------- Fig. 1: -∇f como combinación de gradientes activos ---------- */

  const R3 = [{ a: [1, 1], b: 3 }, { a: [-1, 0], b: 0 }, { a: [0, -1], b: 0 }];
  const COMBOS = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2]];
  function kkt(c) {
    for (const S of COMBOS) {
      const n = 2 + S.length, M = Array.from({ length: n }, () => Array(n).fill(0)), rhs = Array(n).fill(0);
      for (let r = 0; r < 2; r++) { M[r][r] = 2; rhs[r] = 2 * c[r]; }
      S.forEach((j, i) => { for (let r = 0; r < 2; r++) { M[r][2 + i] = R3[j].a[r]; M[2 + i][r] = R3[j].a[r]; } rhs[2 + i] = R3[j].b; });
      const s = O.resolver(M, rhs);
      if (!s) continue;
      const x = [s[0], s[1]], mu = R3.map(() => 0);
      S.forEach((j, i) => { mu[j] = s[2 + i]; });
      if (R3.every((q, j) => S.includes(j) || prod(q.a, x) - q.b <= 1e-7) && S.every((j) => mu[j] >= -1e-7)) return { x, mu, S };
    }
    return { x: c.slice(), mu: [0, 0, 0], S: [] };
  }

  function montarFuerzas(cuerpo) {
    let c = [3.2, 2.4], plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Empuja contra una pared', () => { c = [3, 2.2]; dibujar(); }, { primario: true });
    ctl.boton('Empuja contra una esquina', () => { c = [4.2, -1.2]; dibujar(); });
    ctl.boton('Dentro (sin fuerzas)', () => { c = [0.9, 0.7]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.66, altoMin: 290, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región factible', forma: 'cuadro' },
      { color: C.s2, texto: '−∇f (fuerza hacia el mínimo libre)', forma: 'linea' },
      { color: C.s1, texto: 'μ₁∇g₁ (pared oblicua)', forma: 'linea' },
      { color: C.s7, texto: 'μ∇g de las paredes x ≥ 0, y ≥ 0', forma: 'linea' },
      { color: C.s6, texto: 'óptimo (equilibrio)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre el mínimo libre (círculo hueco) hacia fuera del triángulo. En el óptimo, la fuerza −∇f queda equilibrada por las flechas de las paredes activas; la longitud de cada una es μ·‖∇g‖, un multiplicador mayor es una pared que empuja más.');

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, 1.6, 0.9, 3.5);
      plano.ejes();
      rellenar(ctx, plano, (x, y) => Math.max(...R3.map((q) => prod(q.a, [x, y]) - q.b)));
      circulos(ctx, plano, c, 9);
      R3.forEach((q) => ML.contorno(ctx, plano, (x, y) => prod(q.a, [x, y]) - q.b, 0, { color: C.tinta, ancho: 2.5, paso: 3 }));
      anillo(ctx, plano, c);
      const k = kkt(c), gf = [2 * (k.x[0] - c[0]), 2 * (k.x[1] - c[1])];
      const X = plano.sx(k.x[0]), Y = plano.sy(k.x[1]), esc = 22; // píxeles por unidad de fuerza
      // parte acumulada: cada pared apilada como un polígono de fuerzas
      let px = X, py = Y;
      k.S.forEach((j) => {
        const f = [k.mu[j] * R3[j].a[0], k.mu[j] * R3[j].a[1]];
        flecha(ctx, px, py, f[0] * esc, -f[1] * esc, j === 0 ? C.s1 : C.s7);
        px += f[0] * esc; py -= f[1] * esc;
      });
      flecha(ctx, X, Y, -gf[0] * esc, gf[1] * esc, C.s2, 3);
      VIZ.marcador(ctx, X, Y, C.s6, 7);
      const res = [gf[0], gf[1]];
      k.S.forEach((j) => { res[0] += k.mu[j] * R3[j].a[0]; res[1] += k.mu[j] * R3[j].a[1]; });
      registro.textContent = !k.S.length ? 'Mínimo libre dentro: ninguna pared empuja, ∇f = 0 y todos los multiplicadores son 0.'
        : `Equilibrio: −∇f = ${k.S.map((j) => `${VIZ.fmt(k.mu[j], 3)}·∇g${SUB[j]}`).join(' + ')}. ${k.S.length === 2 ? 'Esquina: dos paredes se reparten la fuerza (diagonal del paralelogramo).' : 'Una sola pared contrarresta la fuerza.'} Los pesos son no negativos porque las paredes solo empujan hacia dentro.`;
      lectura.set([
        ['óptimo x*', ptos(k.x)], ['−∇f', ptos([-gf[0], -gf[1]])],
        ...k.S.map((j) => [`μ${SUB[j]}`, VIZ.fmt(k.mu[j], 4)]), ['residuo', VIZ.fmt(nrm(res), 2)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { c = q; dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>f = <b>${VIZ.fmt((q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2)}</b>`);
    });
    dibujar();
  }

  /* ---------- Fig. 2: sensibilidad p*(ε) y pendiente −μ ---------- */

  const FORMAS = {
    disco: {
      nombre: 'Disco: x² + y² ≤ 2 + ε',
      g: (x, y, e) => x * x + y * y - (2 + e), gr: (x, y) => [2 * x, 2 * y],
      proy: (c, e) => { const r = Math.sqrt(2 + e), n = nrm(c); return n <= r ? c.slice() : [(c[0] * r) / n, (c[1] * r) / n]; },
    },
    semiplano: {
      nombre: 'Semiplano: (x + y)/√2 ≤ 1,4 + ε',
      g: (x, y, e) => (x + y) / S2 - (1.4 + e), gr: () => [1 / S2, 1 / S2],
      proy: (c, e) => { const s = (c[0] + c[1]) / S2 - (1.4 + e); return s <= 0 ? c.slice() : [c[0] - s / S2, c[1] - s / S2]; },
    },
  };

  function montarSensibilidad(cuerpo) {
    let F = FORMAS.disco, c = [2, 2], eps = 0, plano = null, graf = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Restricción', opciones: Object.entries(FORMAS).map(([k, f]) => [k, f.nombre]), valor: 'disco', alCambiar: (v) => { F = FORMAS[v]; dibujar(); } });
    const sCx = ctl.rango({ etiqueta: 'Mínimo libre, coordenada x', min: -3, max: 3, paso: 0.05, valor: c[0], formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { c[0] = v; dibujar(); } });
    const sCy = ctl.rango({ etiqueta: 'Mínimo libre, coordenada y', min: -3, max: 3, paso: 0.05, valor: c[1], formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { c[1] = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Relajación ε de la restricción', min: -1.2, max: 1.5, paso: 0.01, valor: eps, formato: (v) => VIZ.fmt(v, 3), alCambiar: (v) => { eps = v; dibujar(); } });
    ctl.boton('Poner el mínimo libre dentro', () => { c = [0.3, 0.2]; sCx.valor = c[0]; sCy.valor = c[1]; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 270, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.subtitulo(cuerpo, 'Valor óptimo p*(ε) en función de la relajación');
    const lienzo2 = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 210, altoMax: 290 });
    const tip2 = VIZ.tooltip(lienzo2);
    VIZ.leyenda(cuerpo, [
      { color: C.s3, texto: 'región con ε', forma: 'cuadro' },
      { color: C.apagado, texto: 'frontera con ε = 0', forma: 'linea' },
      { color: C.s6, texto: 'óptimo x*(ε)', forma: 'punto' },
      { color: C.s1, texto: 'p*(ε)', forma: 'linea' },
      { color: C.s2, texto: 'tangente de pendiente −μ', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Aumente ε (región más grande): si la restricción está activa, el valor óptimo baja con pendiente −μ; si no, no cambia. Compare la pendiente medida con −μ en la lectura, y ponga el mínimo libre dentro para ver μ = 0.');

    const pv = (e) => { const x = F.proy(c, e); return (x[0] - c[0]) ** 2 + (x[1] - c[1]) ** 2; };
    function info() {
      const x = F.proy(c, eps), gf = [2 * (x[0] - c[0]), 2 * (x[1] - c[1])];
      const activa = F.g(x[0], x[1], eps) > -1e-9, gg = F.gr(x[0], x[1]);
      const mu = activa ? Math.max(0, -prod(gf, gg) / prod(gg, gg)) : 0;
      const h = 1e-4, pend = (pv(eps + h) - pv(eps - h)) / (2 * h);
      return { x, activa, mu, pend };
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = planoIgual(lienzo, 0, 0, 3.7);
      plano.ejes();
      rellenar(ctx, plano, (x, y) => F.g(x, y, eps));
      circulos(ctx, plano, c, 9);
      ML.contorno(ctx, plano, (x, y) => F.g(x, y, 0), 0, { color: C.apagado, ancho: 1.8, guiones: [5, 4], paso: 3 });
      ML.contorno(ctx, plano, (x, y) => F.g(x, y, eps), 0, { color: C.tinta, ancho: 2.5, paso: 3 });
      anillo(ctx, plano, c);
      const I = info();
      VIZ.marcador(ctx, plano.sx(I.x[0]), plano.sy(I.x[1]), C.s6, 7);
      registro.textContent = I.activa ? `Restricción activa: μ = ${VIZ.fmt(I.mu, 4)}. Al relajar ε en una unidad, el valor óptimo cambia a primer orden en ${VIZ.fmt(-I.mu, 3)} (pendiente medida: ${VIZ.fmt(I.pend, 4)}).`
        : 'Restricción inactiva: μ = 0. Relajarla o apretarla un poco no cambia el óptimo ni su valor (la pendiente es 0).';
      lectura.set([['ε', VIZ.fmt(eps, 3)], ['x*', ptos(I.x)], ['p*(ε)', VIZ.fmt(pv(eps), 4)], ['μ', VIZ.fmt(I.mu, 4)], ['dp*/dε medida', VIZ.fmt(I.pend, 4)], ['−μ', VIZ.fmt(-I.mu, 4)]]);
      dibujarCurva(I);
    }
    function dibujarCurva(I) {
      const { ctx } = lienzo2;
      lienzo2.limpiar();
      const pts = Array.from({ length: 121 }, (_, i) => { const e = -1.2 + (i * 2.7) / 120; return [e, pv(e)]; });
      const mx = Math.max(...pts.map((q) => q[1]), 0.5) * 1.1;
      graf = VIZ.plano(lienzo2, { xmin: -1.2, xmax: 1.5, ymin: 0, ymax: mx }, { etiquetaX: 'ε', etiquetaY: 'p*', margen: { izq: 44 } });
      graf.ejes();
      ctx.save(); graf.recortar();
      VIZ.trazar(ctx, graf, pts, C.s1, 2.5);
      const p0 = pv(eps);
      VIZ.trazar(ctx, graf, [[-1.2, p0 + I.mu * 0 - I.mu * (-1.2 - eps)], [1.5, p0 - I.mu * (1.5 - eps)]], C.s2, 2, [6, 4]);
      ctx.restore();
      VIZ.marcador(ctx, graf.sx(eps), graf.sy(p0), C.s6, 6);
    }
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = () => dibujar();
    arrastrable(lienzo, (pos, arrastrando) => {
      if (!pos || !plano || !plano.dentro(pos.x, pos.y)) return tip.ocultar();
      const q = [plano.ix(pos.x), plano.iy(pos.y)];
      if (arrastrando) { c = q; sCx.valor = Math.max(-3, Math.min(3, q[0])); sCy.valor = Math.max(-3, Math.min(3, q[1])); dibujar(); }
      tip.mostrar(pos.x, pos.y, `(${VIZ.fmt(q[0], 3)}, ${VIZ.fmt(q[1], 3)})<br>g = <b>${VIZ.fmt(F.g(q[0], q[1], eps), 3)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointermove', (ev) => {
      const pos = lienzo2.posicion(ev);
      if (!graf || !graf.dentro(pos.x, pos.y)) return tip2.ocultar();
      const e = graf.ix(pos.x);
      tip2.mostrar(pos.x, pos.y, `ε = <b>${VIZ.fmt(e, 3)}</b><br>p*(ε) = <b>${VIZ.fmt(pv(e), 4)}</b>`);
    });
    lienzo2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    dibujar();
  }

  VIZ.registrarTema('multiplier-interpretation', {
    intro: String.raw`
      <p>Un multiplicador tiene dos lecturas complementarias. <strong>Geométrica</strong>: en el óptimo, la fuerza \(-\nabla f\) que arrastra hacia el mínimo libre se reparte entre las «paredes» activas, y cada multiplicador es
      cuánto empuja la pared correspondiente. Como las paredes solo empujan hacia dentro, los pesos no pueden ser negativos.</p>
      <p><strong>Económica</strong>: el multiplicador mide cuánto mejora el valor óptimo si se relaja la restricción en una unidad. Es el análogo no lineal del precio sombra del Simplex: una restricción
      con \(\mu=0\) sobra, y una con \(\mu\) grande es un cuello de botella.</p>`,
    visualizaciones: [
      {
        titulo: 'Los multiplicadores como pesos de fuerzas',
        descripcion: 'Arrastre el mínimo libre fuera del triángulo y vea cómo −∇f se descompone en las flechas de las paredes activas. Pruebe los botones: contra una pared actúa una sola fuerza, en la esquina dos, dentro ninguna.',
        montar: montarFuerzas,
      },
      {
        titulo: 'Sensibilidad: relajar la restricción',
        descripcion: 'Mueva ε y compare la pendiente de \\(p^*(\\varepsilon)\\) con \\(-\\mu\\). Pruebe poner el mínimo libre dentro de la región: \\(\\mu=0\\) y la curva es plana.',
        montar: montarSensibilidad,
      },
    ],
    teoria: String.raw`
      <h2>Lectura geométrica</h2>
      <p>La estacionariedad de KKT puede escribirse</p>
      \[ -\nabla f(x^*)=\sum_{j\in A(x^*)}\mu_j\,\nabla g_j(x^*),\qquad \mu_j\ge0. \]
      <p>El miembro derecho es una combinación con pesos no negativos de los gradientes activos: pertenece al <strong>cono</strong> que generan. Geométricamente, \(-\nabla f\) es la dirección en que \(f\) baja más rápido; el óptimo es un punto donde esa dirección
      <em>sale</em> de la región, atrapada por las paredes. Si \(-\nabla f\) cayera fuera del cono, habría una dirección factible de descenso (lema de Farkas). Con una igualdad el peso puede tener cualquier signo, porque esa pared empuja por ambos lados.</p>
      <h2>Lectura como sensibilidad</h2>
      <p>Sea \(p^*(\varepsilon)\) el valor óptimo de \(\min f(x)\) sujeto a \(g_j(x)\le\varepsilon_j\). Bajo regularidad y segundo orden suficiente,</p>
      \[ \frac{\partial p^*}{\partial\varepsilon_j}\Big|_{\varepsilon=0}=-\mu_j. \]
      <p>Demostración corta: \(p^*(\varepsilon)=L(x^*(\varepsilon),\mu(\varepsilon);\varepsilon)\), con \(L=f+\sum\mu_j(g_j-\varepsilon_j)\). Por el teorema de la envolvente solo cuenta la derivada explícita de \(L\) respecto de \(\varepsilon_j\), que es \(-\mu_j\).
      Como \(\mu_j\ge0\), relajar una restricción nunca empeora el óptimo; si \(\mu_j=0\) no lo cambia a primer orden.</p>
      <h2>Ejemplo resuelto</h2>
      <p>\(\min (x-2)^2+(y-2)^2\) con \(x^2+y^2\le2+\varepsilon\). Con \(r=\sqrt{2+\varepsilon}\) y centro a distancia \(2\sqrt2\): \(p^*(\varepsilon)=(2\sqrt2-r)^2\). Entonces
      \((p^*)'(0)=-\dfrac{2\sqrt2-r}{r}\Big|_{r=\sqrt2}=-1=-\mu\), pues en \(x^*=(1,1)\) \(\nabla f=(-2,-2)=-1\cdot(2,2)\) da \(\mu=1\).</p>
      <h2>Conexiones</h2>
      <p>Es el equivalente de los <a href="tema.html?id=shadow-prices">precios sombra</a> y de las variables duales en LP (<a href="tema.html?id=strong-duality">dualidad fuerte</a>). El conjunto de condiciones completo está en
      <a href="tema.html?id=kkt-conditions">KKT</a> y la restricción de igualdad correspondiente en <a href="tema.html?id=equality-constraints-lagrange">Lagrange</a>; en el análisis postóptimo se corresponde con
      los <a href="tema.html?id=rhs-ranges">rangos de disponibilidad</a>.</p>`,
  });
})();
