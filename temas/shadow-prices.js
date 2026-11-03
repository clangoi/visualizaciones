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


  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (i) => String(i + 1).replace(/\d/g, (d) => SUBS[d]);
  const limpio = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
  const par = (v, d = 3) => `(${v.map((q) => VIZ.fmt(limpio(q), d)).join(', ')})`;

  // Problema de trabajo: dos productos, cuatro restricciones.
  const c = [5, 4];
  const A = [[6, 4], [1, 2], [-1, 1], [0, 1]];
  const B0 = [24, 6, 1, 2];
  const REC = ['Materia prima M1', 'Materia prima M2', 'Límite de B sobre A', 'Demanda máxima de B'];
  const UNI = ['t', 't', 'u', 'u'];
  const W = { xmin: 0, xmax: 5.5, ymin: 0, ymax: 4.5 };

  function resolver(b) {
    let u = null;
    for (const s of O.simplex(c, A, b, { regla: 'bland' })) u = s;
    return u;
  }
  const igualVec = (u, v) => u.every((q, k) => Math.abs(q - v[k]) < 1e-7);

  /* ---------- Fig. 1: aumentar un recurso ---------- */

  function montarDelta(cuerpo) {
    let k = 0, delta = 1;
    const base = resolver(B0);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Recurso que cambia', opciones: REC.map((n, i) => [String(i), `${i + 1}. ${n}`]), valor: '0', alCambiar: (v) => { k = +v; dibujar(); } });
    const sd = ctl.rango({ etiqueta: 'Cambio Δ del lado derecho', min: -6, max: 6, paso: 0.25, valor: delta, formato: (v) => (v > 0 ? '+' : '') + VIZ.fmt(v), alCambiar: (v) => { delta = v; dibujar(); } });
    ctl.boton('Δ = +1 unidad', () => { delta = 1; sd.valor = 1; dibujar(); }, { primario: true });
    ctl.boton('Δ = 0', () => { delta = 0; sd.valor = 0; dibujar(); });

    const pp = panel(cuerpo, ['x₁', 'x₂'], C.s1);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región con el recurso modificado' },
      { color: C.apagado, texto: 'región original', forma: 'linea' },
      { color: C.s2, texto: 'restricción que cambia', forma: 'linea' },
      { color: C.tinta, texto: 'óptimo original', forma: 'punto' },
      { color: C.s6, texto: 'nuevo óptimo', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un recurso y mueva Δ. Con Δ = +1 el óptimo sube exactamente yᵢ si la base no cambia. Para los recursos con holgura (3 y 4) el óptimo no se mueve; para Δ grande el cambio real se aparta del lineal.');

    function dibujar() {
      const b = B0.slice();
      b[k] = Math.max(0, b[k] + delta);
      const d = b[k] - B0[k];
      const nuevo = resolver(b);
      const yk = base.duales[k];
      pp.W = W;
      pp.poli = poliPrimal({ A, b, c }, W);
      pp.rectas = [];
      const orig = poliPrimal({ A, b: B0, c }, W);
      pp.extra = (ctx, p) => {
        ctx.save();
        p.recortar();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = C.apagado;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        orig.forEach(([x, y], q) => (q ? ctx.lineTo(p.sx(x), p.sy(y)) : ctx.moveTo(p.sx(x), p.sy(y))));
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        A.forEach((a, i) => { if (i !== k) recta(ctx, p, a, B0[i], C.tinta2, 1, [6, 4]); });
        recta(ctx, p, A[k], B0[k], C.tenue, 1.5, [2, 3]);
        recta(ctx, p, A[k], b[k], C.s2, 3);
        ctx.restore();
        VIZ.marcador(ctx, p.sx(base.x[0]), p.sy(base.x[1]), C.tinta, 5);
        VIZ.marcador(ctx, p.sx(nuevo.x[0]), p.sy(nuevo.x[1]), C.s6, 6.5);
      };
      pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>z = <b>${VIZ.fmt(dot(c, q))}</b>`;
      pp.dibujar();
      const real = nuevo.z - base.z, lineal = yk * d;
      const mismaBase = igualVec(nuevo.duales, base.duales);
      registro.textContent = d === 0 ? 'Sin cambio: el óptimo es el original.'
        : yk < 1e-9 ? `El recurso ${k + 1} tiene holgura en el óptimo original (precio sombra 0): ${Math.abs(real) < 1e-9 ? 'cambiar su disponibilidad no modifica el óptimo' : 'al reducirlo tanto se pasó su límite de validez y el óptimo sí cambia'}.`
          : mismaBase ? `Δ = ${VIZ.fmt(d)}: el óptimo cambia ${VIZ.fmt(real)} = ${VIZ.fmt(yk)} × ${VIZ.fmt(d)}, exactamente lo que predice el precio sombra, porque la base óptima no cambia.`
            : `Δ = ${VIZ.fmt(d)} es demasiado grande: cambió la base óptima (otras restricciones se vuelven activas) y el cambio real ${VIZ.fmt(real)} ya no es ${VIZ.fmt(lineal)}.`;
      lectura.set([
        ['z* original', VIZ.fmt(base.z)],
        ['z* nuevo', VIZ.fmt(nuevo.z)],
        ['cambio real', VIZ.fmt(limpio(real))],
        [`precio sombra y${sub(k)} × Δ`, VIZ.fmt(limpio(lineal))],
        ['¿misma base?', mismaBase ? 'sí' : 'no'],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: z*(bᵢ) y su pendiente ---------- */

  const RANGO = [40, 12, 4, 5];

  function montarCurva(cuerpo) {
    let k = 0, bi = B0[0];
    const cache = {};
    const muestras = (i) => {
      if (!cache[i]) {
        const N = 160, pts = [];
        for (let q = 0; q <= N; q++) {
          const b = B0.slice();
          b[i] = (RANGO[i] * q) / N;
          const s = resolver(b);
          pts.push({ b: b[i], z: s.z, y: s.duales[i] });
        }
        cache[i] = pts;
      }
      return cache[i];
    };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Recurso', opciones: REC.map((n, i) => [String(i), `${i + 1}. ${n}`]), valor: '0',
      alCambiar: (v) => { k = +v; bi = B0[k]; sb.input.max = RANGO[k]; sb.valor = bi; dibujar(); } });
    const sb = ctl.rango({ etiqueta: 'Disponibilidad bᵢ', min: 0, max: RANGO[0], paso: 0.1, valor: bi, formato: (v) => VIZ.fmt(v), alCambiar: (v) => { bi = v; dibujar(); } });

    const l1 = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 220, altoMax: 340 });
    const tip1 = VIZ.tooltip(l1);
    VIZ.subtitulo(cuerpo, 'Precio sombra yᵢ(bᵢ) = pendiente de la curva');
    const l2 = VIZ.lienzo(cuerpo, { proporcion: 0.22, altoMin: 120, altoMax: 170 });
    const tip2 = VIZ.tooltip(l2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'valor óptimo z*(bᵢ)', forma: 'linea' },
      { color: C.s2, texto: 'recta tangente con pendiente yᵢ', forma: 'linea' },
      { color: C.s6, texto: 'bᵢ elegido', forma: 'punto' },
      { color: C.s3, texto: 'precio sombra en cada tramo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre sobre la curva o use el control deslizante. Mientras bᵢ está en un tramo recto, el precio sombra es constante; en cada quiebre cambia la base óptima y baja el precio, hasta llegar a 0 cuando el recurso sobra.');

    let p1 = null, p2 = null;
    const actual = () => {
      const pts = muestras(k);
      const s = resolver(B0.map((v, i) => (i === k ? bi : v)));
      return { pts, s, y: s.duales[k] };
    };
    function dibujar() {
      const { pts, s, y } = actual();
      const zmax = Math.max(...pts.map((q) => q.z)) * 1.08 + 0.5, ymax = Math.max(...pts.map((q) => q.y)) * 1.15 + 0.1;
      let ctx = l1.ctx;
      l1.limpiar();
      p1 = VIZ.plano(l1, { xmin: 0, xmax: RANGO[k], ymin: 0, ymax: zmax }, { etiquetaX: `b${sub(k)}`, etiquetaY: 'z*' });
      p1.ejes();
      VIZ.trazar(ctx, p1, pts.map((q) => [q.b, q.z]), C.s1, 3);
      ctx.save();
      p1.recortar();
      VIZ.trazar(ctx, p1, [[0, s.z - y * bi], [RANGO[k], s.z + y * (RANGO[k] - bi)]], C.s2, 2, [6, 4]);
      ctx.restore();
      VIZ.marcador(ctx, p1.sx(bi), p1.sy(s.z), C.s6, 6);
      ctx = l2.ctx;
      l2.limpiar();
      p2 = VIZ.plano(l2, { xmin: 0, xmax: RANGO[k], ymin: 0, ymax }, { etiquetaX: `b${sub(k)}`, etiquetaY: `y${sub(k)}`, margen: { inf: 30 } });
      p2.ejes();
      VIZ.trazar(ctx, p2, pts.map((q) => [q.b, q.y]), C.s3, 3);
      VIZ.marcador(ctx, p2.sx(bi), p2.sy(y), C.s6, 5);
      // extensión del tramo con el mismo precio
      let a = pts.findIndex((q) => q.b >= bi - 1e-9);
      if (a < 0) a = pts.length - 1;
      let lo = a, hi = a;
      while (lo > 0 && Math.abs(pts[lo - 1].y - y) < 1e-7) lo--;
      while (hi < pts.length - 1 && Math.abs(pts[hi + 1].y - y) < 1e-7) hi++;
      const tramo = `${VIZ.fmt(pts[lo].b)} ≤ b${sub(k)} ≤ ${VIZ.fmt(pts[hi].b)}`;
      registro.textContent = y > 1e-9
        ? `Con b${sub(k)} = ${VIZ.fmt(bi)} el recurso es escaso: cada unidad más vale y${sub(k)} = ${VIZ.fmt(y)}. Ese precio se mantiene (aprox.) para ${tramo}.`
        : `Con b${sub(k)} = ${VIZ.fmt(bi)} el recurso sobra: su precio sombra es 0 y tener más no sirve de nada.`;
      lectura.set([
        [`b${sub(k)}`, VIZ.fmt(bi)],
        ['z*', VIZ.fmt(s.z)],
        [`precio sombra y${sub(k)}`, VIZ.fmt(limpio(y))],
        ['tramo con el mismo precio', tramo],
        ['x*', par(s.x)],
      ]);
    }
    const dato = (ev, l, p, fijar) => { const q = l.posicion(ev); return fijar || p.dentro(q.x, q.y) ? { x: q.x, y: q.y } : null; };
    let arrastra = false;
    l1.canvas.addEventListener('pointerdown', (ev) => { const q = dato(ev, l1, p1, false); if (!q) return; arrastra = true; l1.canvas.setPointerCapture(ev.pointerId); fijar(q.x); });
    l1.canvas.addEventListener('pointerup', () => { arrastra = false; });
    function fijar(px) {
      bi = Math.min(RANGO[k], Math.max(0, Math.round(p1.ix(px) * 10) / 10));
      sb.valor = bi;
      dibujar();
    }
    l1.canvas.addEventListener('pointermove', (ev) => {
      const q = dato(ev, l1, p1, arrastra);
      if (arrastra && q) return fijar(q.x);
      if (!q) return tip1.ocultar();
      const b = Math.min(RANGO[k], Math.max(0, p1.ix(q.x)));
      const s = resolver(B0.map((v, i) => (i === k ? b : v)));
      tip1.mostrar(q.x, q.y, `b${sub(k)} = <b>${VIZ.fmt(b, 3)}</b><br>z* = <b>${VIZ.fmt(s.z)}</b><br>y${sub(k)} = <b>${VIZ.fmt(limpio(s.duales[k]))}</b>`);
    });
    l1.canvas.addEventListener('pointerleave', () => tip1.ocultar());
    l2.canvas.addEventListener('pointermove', (ev) => {
      const q = dato(ev, l2, p2, false);
      if (!q) return tip2.ocultar();
      const b = Math.min(RANGO[k], Math.max(0, p2.ix(q.x)));
      const s = resolver(B0.map((v, i) => (i === k ? b : v)));
      tip2.mostrar(q.x, q.y, `b${sub(k)} = <b>${VIZ.fmt(b, 3)}</b><br>y${sub(k)} = <b>${VIZ.fmt(limpio(s.duales[k]))}</b>`);
    });
    l2.canvas.addEventListener('pointerleave', () => tip2.ocultar());
    l1.canvas.style.cursor = 'ew-resize';
    l1.alDibujar = dibujar;
    l2.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('shadow-prices', {
    intro: String.raw`
      <p>Una variable dual es un <strong>precio sombra</strong>: cuánto mejora el valor óptimo si se dispone de una unidad
      adicional del recurso que representa su restricción. Un recurso escaso, que limita el óptimo, tiene un precio positivo;
      uno que sobra tiene precio cero, porque tener más no ayuda.</p>
      <p>Esa interpretación es local: el precio vale mientras el recurso varíe dentro de un rango en el que la base óptima
      no cambia. Más allá, otras restricciones pasan a ser las que limitan, y el precio cambia. Las figuras muestran ambas
      caras: el efecto de una unidad más y la función completa \(z^*(b_i)\), cuya pendiente es el precio.</p>`,
    visualizaciones: [
      {
        titulo: 'Una unidad más de un recurso',
        descripcion: 'Elija un recurso y mueva Δ: la región cambia y el nuevo óptimo se desplaza. Compare el cambio real de z* con yᵢ·Δ; coinciden para Δ pequeño y se separan al pasar el límite de validez. Pruebe el recurso 3, que sobra.',
        montar: montarDelta,
      },
      {
        titulo: 'El óptimo como función del recurso',
        descripcion: 'La curva z*(bᵢ) es lineal por tramos y cóncava; su pendiente en cada punto es el precio sombra. Arrastre sobre la curva y observe cómo el precio baja en los quiebres hasta llegar a 0.',
        montar: montarCurva,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(z^*(b) = \max\{c^\top x : Ax \le b,\ x \ge 0\}\). Si \(y^*\) es solución óptima del dual, el <strong>precio sombra</strong> del
      recurso \(i\) es \(y_i^*\), y cuando la base óptima no cambia</p>
      \[ \frac{\partial z^*}{\partial b_i} = y_i^*, \qquad z^*(b + \Delta e_i) = z^*(b) + y_i^*\,\Delta. \]
      <p>La razón es la <a href="tema.html?id=strong-duality">dualidad fuerte</a>: \(z^*(b) = b^\top y^*\), y mientras \(y^*\) siga siendo factible
      y óptimo para el dual (la base no cambia), el valor es lineal en \(b\) con gradiente \(y^*\).</p>

      <h2>Recursos escasos y recursos sobrantes</h2>
      <p>Por las <a href="tema.html?id=complementary-slackness">holguras complementarias</a>, \(y_i^*(b_i - A_i x^*) = 0\). Una restricción con holgura positiva
      tiene precio 0: una unidad más no mejora nada. Una restricción con precio positivo está activa, y toda la unidad
      adicional se convierte en objetivo.</p>

      <h2>Ejemplo resuelto</h2>
      <p>Dos productos con beneficios \(5\) y \(4\), y restricciones \(6x_1 + 4x_2 \le 24\) (M1), \(x_1 + 2x_2 \le 6\) (M2),
      \(-x_1 + x_2 \le 1\) y \(x_2 \le 2\). El óptimo es \(x^* = (3,\,3/2)\) con \(z^* = 21\). Las restricciones 1 y 2 están activas y el dual
      resuelve \(6y_1 + y_2 = 5\), \(4y_1 + 2y_2 = 4\): \(y^* = (3/4,\,1/2,\,0,\,0)\), con \(b^\top y^* = 18 + 3 = 21\). Una tonelada más de
      M1 vale \(3/4\) y una de M2, \(1/2\). Para \(b_1 = 25\) el nuevo óptimo es \(21.75\), exactamente \(21 + 3/4\). Las restricciones
      de mercado tienen holgura (\(-3 + 1.5 = -1.5 \le 1\) y \(1.5 \le 2\)) y precio 0.</p>

      <h2>Límite de validez</h2>
      <p>El precio \(y_i^*\) solo es válido para \(b_i\) dentro de un intervalo \([b_i^-, b_i^+]\) en el que la base óptima sigue siendo
      factible (ver <a href="tema.html?id=rhs-ranges">Resource Availability Ranges</a>). Fuera de él, \(z^*(b_i)\) sigue siendo una función
      <em>cóncava lineal por tramos</em>: la pendiente solo puede bajar al aumentar \(b_i\) (rendimientos decrecientes). En un
      quiebre el precio sombra no es único: hay un precio por la izquierda y otro por la derecha.</p>

      <h2>Conexiones</h2>
      <ul>
        <li>La relación con la forma de la solución se detalla en <a href="tema.html?id=multiplier-interpretation">Geometric Meaning of Multipliers</a>:
        los multiplicadores de Lagrange y KKT son los precios sombra del caso no lineal.</li>
        <li>Para saber hasta dónde vale el precio use el análisis de <a href="tema.html?id=basis-stability">estabilidad de la base</a>.</li>
        <li>Con el Simplex, \(y^*\) es la fila \(z\) bajo las holguras del <a href="tema.html?id=simplex-tableau">tablero óptimo</a>.</li>
        <li>Con variables enteras, el valor de un recurso adicional ya no es un precio lineal (<a href="tema.html?id=lp-relaxation">relajación lineal</a>).</li>
      </ul>`,
  });
})();
