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
  const ID = [[0, 0], [0, 0]];
  void ID;

  // Problema de trabajo: máx cᵀx, A x ≤ b, x ≥ 0, con tres restricciones y dos variables.
  const A = [[1, 1], [2, 1], [0, 1]];
  const NOMBRES = ['Horno', 'Mano de obra', 'Demanda de B'];
  const W = { xmin: 0, xmax: 11, ymin: 0, ymax: 11 };
  const K0 = { c: [3, 4], b: [10, 16, 7] };

  // Simplex hasta el final: devuelve x, z y los duales y de la fila z.
  function simplexFinal(c, b) {
    let u = null;
    for (const s of O.simplex(c, A, b, { regla: 'bland' })) u = s;
    return u;
  }
  const holguras = (b, x) => A.map((a, i) => b[i] - dot(a, x));
  const colA = (j) => A.map((a) => a[j]);
  const dualHolgura = (c, y) => c.map((cj, j) => dot(colA(j), y) - cj);

  /* ---------- Fig. 1: producto de cada par restricción-variable ---------- */

  function montarOptimo(cuerpo) {
    const c = K0.c.slice(), b = K0.b.slice();
    const ctl = VIZ.controles(cuerpo);
    const act = () => dibujar();
    ctl.rango({ etiqueta: 'c₁ (beneficio de A)', min: 1, max: 6, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; act(); } });
    ctl.rango({ etiqueta: 'c₂ (beneficio de B)', min: 1, max: 6, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; act(); } });
    ctl.rango({ etiqueta: 'b₁ (horno)', min: 6, max: 14, paso: 0.5, valor: b[0], alCambiar: (v) => { b[0] = v; act(); } });
    ctl.rango({ etiqueta: 'b₂ (mano de obra)', min: 8, max: 20, paso: 0.5, valor: b[1], alCambiar: (v) => { b[1] = v; act(); } });
    ctl.rango({ etiqueta: 'b₃ (demanda de B)', min: 3, max: 10, paso: 0.5, valor: b[2], alCambiar: (v) => { b[2] = v; act(); } });

    const pp = panel(cuerpo, ['x₁', 'x₂'], C.s1);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región factible' },
      { color: C.s2, texto: 'restricción activa (holgura 0)', forma: 'linea' },
      { color: C.tenue, texto: 'restricción con holgura (y = 0)', forma: 'linea' },
      { color: C.apagado, texto: 'curva de nivel del objetivo', forma: 'linea' },
      { color: C.s6, texto: 'óptimo', forma: 'punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mueva los recursos: cuando una restricción deja de tocar el óptimo, su y se anula; cuando una variable se anula, su holgura dual deja de serlo. Los productos de la tabla son siempre 0.');

    function dibujar() {
      const s = simplexFinal(c, b);
      const x = s.x, y = s.duales, h = holguras(b, x), r = dualHolgura(c, y);
      pp.W = W;
      pp.poli = poliPrimal({ A, b, c }, W);
      pp.rectas = [];
      pp.extra = (ctx, p) => {
        ctx.save();
        p.recortar();
        A.forEach((a, i) => recta(ctx, p, a, b[i], h[i] < 1e-7 ? C.s2 : C.tenue, h[i] < 1e-7 ? 3 : 1.5, h[i] < 1e-7 ? null : [6, 4]));
        recta(ctx, p, c, s.z, C.apagado, 1.5, [3, 4]);
        ctx.restore();
        VIZ.marcador(ctx, p.sx(x[0]), p.sy(x[1]), C.s6, 6.5);
      };
      pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>cᵀx = <b>${VIZ.fmt(dot(c, q))}</b>`;
      pp.dibujar();

      const fila = (...t) => VIZ.el('tr', null, t.map((v, k) => VIZ.el('td', { class: k === 0 ? 'izq' : null }, v)));
      const cab = (...t) => VIZ.el('tr', null, t.map((v, k) => VIZ.el('th', { class: k === 0 ? 'izq' : null }, v)));
      const sumaP = x.reduce((q, xj, j) => q + xj * limpio(r[j]), 0);
      const sumaD = y.reduce((q, yi, i) => q + yi * limpio(h[i]), 0);
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null,
          cab('restricción primal', 'holgura sᵢ', 'variable dual yᵢ', 'yᵢ·sᵢ'),
        ),
        VIZ.el('tbody', null, A.map((_, i) => VIZ.el('tr', { class: h[i] < 1e-7 ? 'activa' : null },
          VIZ.el('td', { class: 'izq' }, `${i + 1}. ${NOMBRES[i]}`), VIZ.el('td', null, VIZ.fmt(limpio(h[i]), 3)), VIZ.el('td', null, VIZ.fmt(limpio(y[i]), 3)), VIZ.el('td', null, VIZ.fmt(limpio(y[i] * h[i]), 3))))),
        VIZ.el('thead', null, cab('variable primal', 'valor xⱼ', 'holgura dual rⱼ', 'xⱼ·rⱼ')),
        VIZ.el('tbody', null, c.map((_, j) => VIZ.el('tr', { class: x[j] < 1e-7 ? null : 'activa' },
          VIZ.el('td', { class: 'izq' }, `x${sub(j)} (${j ? 'B' : 'A'})`), VIZ.el('td', null, VIZ.fmt(limpio(x[j]), 3)), VIZ.el('td', null, VIZ.fmt(limpio(r[j]), 3)), VIZ.el('td', null, VIZ.fmt(limpio(x[j] * r[j]), 3)))))));
      const hechas = h.map((q, i) => (q < 1e-7 ? i + 1 : 0)).filter(Boolean);
      registro.textContent = `Restricciones activas: ${hechas.join(' y ')}; las demás tienen holgura y por eso su variable dual vale 0. Cada variable positiva tiene holgura dual 0: su restricción dual se cumple con igualdad.`;
      lectura.set([
        ['x*', par(x)],
        ['y*', par(y)],
        ['cᵀx* = bᵀy*', `${VIZ.fmt(dot(c, x))} = ${VIZ.fmt(dot(b, y))}`],
        ['Σ yᵢ sᵢ', VIZ.fmt(limpio(sumaD))],
        ['Σ xⱼ rⱼ', VIZ.fmt(limpio(sumaP))],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: reconstruir y desde un vértice ---------- */

  // A partir de un vértice x̂: ecuaciones de holgura complementaria y sistema para y.
  function reconstruir(c, b, x) {
    const h = holguras(b, x), m = A.length, eqs = [], rhs = [], textos = [];
    x.forEach((xj, j) => {
      if (xj > 1e-7) {
        eqs.push(colA(j)); rhs.push(c[j]);
        textos.push(`x${sub(j)} = ${VIZ.fmt(xj, 3)} > 0  ⇒  ${A.map((a, i) => (a[j] ? `${a[j] === 1 ? '' : a[j]}y${sub(i)}` : null)).filter(Boolean).join(' + ')} = ${VIZ.fmt(c[j])}`);
      }
    });
    h.forEach((hi, i) => {
      if (hi > 1e-7) {
        const e = Array(m).fill(0); e[i] = 1;
        eqs.push(e); rhs.push(0);
        textos.push(`s${sub(i)} = ${VIZ.fmt(hi, 3)} > 0  ⇒  y${sub(i)} = 0`);
      }
    });
    if (eqs.length !== m) return { textos, y: null, motivo: eqs.length < m ? 'degenerado' : 'sobredeterminado' };
    const y = O.resolver(eqs, rhs);
    return { textos, y, motivo: y ? null : 'singular' };
  }

  function montarReconstruir(cuerpo) {
    let c = K0.c.slice(), b = K0.b.slice(), sel = 0, verts = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'c₁', min: 1, max: 6, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; dibujar(); } });
    ctl.rango({ etiqueta: 'c₂', min: 1, max: 6, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; dibujar(); } });
    ctl.boton('Siguiente vértice', () => { sel = (sel + 1) % verts.length; dibujar(); }, { primario: true });
    ctl.boton('Ir al óptimo', () => { const s = simplexFinal(c, b); sel = verts.findIndex((q) => Math.hypot(q[0] - s.x[0], q[1] - s.x[1]) < 1e-6); dibujar(); });

    const pp = panel(cuerpo, ['x₁', 'x₂'], C.s1);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región factible' },
      { color: C.tinta2, texto: 'vértice (clic para elegirlo)', forma: 'punto' },
      { color: C.s7, texto: 'vértice elegido', forma: 'punto' },
      { color: C.s6, texto: 'elegido y certificado por un y factible', forma: 'punto' },
      { color: C.s8, texto: 'elegido y y inválido: no es óptimo', forma: 'punto' },
    ]);
    const sistema = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(sistema);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic cerca de un vértice (o use «Siguiente vértice»). Las holguras complementarias fijan y sin resolver ningún LP: si sale y ≥ 0 y cumple las restricciones duales de las variables nulas, el vértice es óptimo.');

    pp.alClic = (q) => {
      let mejor = 0, md = Infinity;
      verts.forEach((v, k) => { const d = Math.hypot(v[0] - q[0], v[1] - q[1]); if (d < md) { md = d; mejor = k; } });
      sel = mejor; dibujar();
    };

    function dibujar() {
      const K = { A, b, c };
      verts = poliPrimal(K, W);
      if (sel >= verts.length) sel = 0;
      const x = verts[sel].map(limpio);
      const rec = reconstruir(c, b, x);
      const h = holguras(b, x);
      let veredicto = 'indeterminado', checks = [];
      if (rec.y) {
        const y = rec.y.map(limpio), r = dualHolgura(c, y);
        const yOk = y.every((v) => v >= -1e-7);
        const rOk = r.every((v) => v >= -1e-7);
        checks = [
          `y ≥ 0: ${y.map((v, i) => `y${sub(i)} = ${VIZ.fmt(v, 3)}`).join(', ')}  ${yOk ? '✓' : '✗'}`,
          `Aᵀy ≥ c: ${r.map((v, j) => `A${sub(j)}ᵀy − c${sub(j)} = ${VIZ.fmt(limpio(v), 3)}`).join(', ')}  ${rOk ? '✓' : '✗'}`,
          `cᵀx = ${VIZ.fmt(dot(c, x))},  bᵀy = ${VIZ.fmt(dot(b, y))}`,
        ];
        veredicto = yOk && rOk ? 'optimo' : 'no';
      }
      pp.W = W;
      pp.poli = verts.length ? verts : [];
      pp.rectas = [];
      pp.extra = (ctx, p) => {
        ctx.save();
        p.recortar();
        A.forEach((a, i) => recta(ctx, p, a, b[i], C.tinta2, 1.5, h[i] < 1e-7 ? null : [6, 4]));
        ctx.restore();
        verts.forEach((v, k) => {
          const esSel = k === sel;
          const col = !esSel ? C.tinta2 : veredicto === 'optimo' ? C.s6 : veredicto === 'no' ? C.s8 : C.s7;
          if (esSel) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.sx(v[0]), p.sy(v[1]), 11, 0, 2 * Math.PI); ctx.stroke(); }
          VIZ.marcador(ctx, p.sx(v[0]), p.sy(v[1]), col, esSel ? 6 : 4.5);
        });
      };
      pp.tooltip = (q) => {
        let mejor = null, md = 0.6;
        verts.forEach((v) => { const d = Math.hypot(v[0] - q[0], v[1] - q[1]); if (d < md) { md = d; mejor = v; } });
        return mejor ? `vértice (<b>${VIZ.fmt(mejor[0], 3)}</b>, <b>${VIZ.fmt(mejor[1], 3)}</b>)<br>cᵀx = <b>${VIZ.fmt(dot(c, mejor))}</b>` : `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)`;
      };
      pp.dibujar();
      sistema.replaceChildren(...[`Vértice x̂ = ${par(x)}`, ...rec.textos, ...(rec.y ? [`Solución del sistema: y = ${par(rec.y)}`, ...checks] : [
        rec.motivo === 'degenerado' ? 'Vértice degenerado: hay más restricciones activas de las necesarias, las holguras no determinan y de forma única.' : 'El sistema no tiene solución única.'])].map((t) => VIZ.el('div', null, t)));
      registro.textContent = veredicto === 'optimo' ? 'El y reconstruido es factible para el dual y vale lo mismo que x̂: x̂ es óptimo, y ese y es su certificado.'
        : veredicto === 'no' ? 'Las holguras complementarias fijaron un y que no es factible para el dual: x̂ no puede ser óptimo (ningún y puede certificarlo).'
          : 'No se puede decidir con un solo sistema: pruebe con otro vértice.';
      lectura.set([
        ['vértice', par(x)],
        ['restricciones activas', String(h.filter((q) => q < 1e-7).length)],
        ['ecuaciones de holgura', String(rec.textos.length)],
        ['veredicto', veredicto === 'optimo' ? 'óptimo' : veredicto === 'no' ? 'no óptimo' : '—'],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('complementary-slackness', {
    intro: String.raw`
      <p>Las <strong>holguras complementarias</strong> son el puente entre las dos mitades de un par primal-dual: una
      restricción del primal que sobra (tiene holgura) no tiene valor económico, así que su variable dual es cero; y una
      variable del primal que se usa (es positiva) obliga a que su restricción dual se cumpla con igualdad.</p>
      <p>Lo más útil es que funcionan en los dos sentidos. Si usted conoce la solución del primal, las holguras le dicen
      qué ecuaciones debe cumplir la del dual y, resolviéndolas, la reconstruye sin ejecutar ningún algoritmo.</p>`,
    visualizaciones: [
      {
        titulo: 'Holguras y productos en el óptimo',
        descripcion: 'La tabla multiplica cada holgura del primal por su variable dual, y cada variable por su holgura dual; todos los productos son 0. Cambie los recursos hasta que una restricción deje de ser activa: su variable dual desaparece.',
        montar: montarOptimo,
      },
      {
        titulo: 'Reconstruir el dual desde un vértice',
        descripcion: 'Elija un vértice: las holguras complementarias generan un sistema lineal para y. Si la solución es no negativa y cumple Aᵀy ≥ c, el vértice es óptimo; pruebe el vértice (6, 4), que parece bueno pero no pasa la prueba.',
        montar: montarReconstruir,
      },
    ],
    teoria: String.raw`
      <h2>Las condiciones</h2>
      <p>Sea \(x\) factible para (P) \(\max\, c^\top x,\ Ax \le b,\ x \ge 0\) y \(y\) factible para (D) \(\min\, b^\top y,\ A^\top y \ge c,\ y \ge 0\).
      Entonces \(x\) e \(y\) son óptimos si y solo si</p>
      \[ y_i\,(b_i - A_i x) = 0 \quad (i = 1,\dots,m), \qquad x_j\,(A_j^\top y - c_j) = 0 \quad (j = 1,\dots,n). \]
      <p>Aquí \(A_i\) es la fila \(i\) y \(A_j\) la columna \(j\) de \(A\). En palabras: <em>si una restricción tiene holgura, su
      variable dual es 0; si una variable es positiva, su restricción dual es una igualdad.</em> Equivalen a «una de las dos
      cantidades de cada par es cero».</p>

      <h2>Demostración</h2>
      <p>En la demostración de la <a href="tema.html?id=weak-duality">dualidad débil</a> se encadenó
      \(c^\top x \le y^\top A x \le b^\top y\). La brecha se reparte entre las dos desigualdades:</p>
      \[ b^\top y - c^\top x = \underbrace{\sum_i y_i\,(b_i - A_i x)}_{\ge 0} + \underbrace{\sum_j x_j\,(A_j^\top y - c_j)}_{\ge 0}. \]
      <p>Todos los sumandos son no negativos (por factibilidad), así que la brecha vale cero exactamente cuando cada producto es
      cero. Y por <a href="tema.html?id=strong-duality">dualidad fuerte</a>, brecha cero equivale a optimalidad de ambos.</p>

      <h2>Reconstruir el dual desde el primal</h2>
      <pre><code>reconstruir_y(x̂):
    para cada restricción i con holgura &gt; 0:       y_i ← 0
    para cada variable j con x̂_j &gt; 0:              exigir  A_jᵀ y = c_j
    resolver el sistema lineal para y
    si y ≥ 0 y  A_jᵀ y ≥ c_j  en las variables nulas:  x̂ es óptimo (y es su certificado)
    si no:  x̂ no es óptimo</code></pre>
      <p>En un vértice no degenerado de un problema con \(m\) restricciones, el número de ecuaciones es exactamente \(m\): cada
      restricción inactiva aporta una, y cada variable positiva otra, mientras que las activas y las variables nulas no
      aportan nada.</p>

      <h2>Ejemplo resuelto</h2>
      <p>Sea \(\max\, 3x_1 + 4x_2\) s.a. \(x_1 + x_2 \le 10,\ 2x_1 + x_2 \le 16,\ x_2 \le 7\). El vértice \((3,7)\) tiene las
      restricciones 1 y 3 activas y la 2 con holgura \(16 - 13 = 3\). Entonces \(y_2 = 0\) y, como \(x_1, x_2 > 0\),</p>
      \[ y_1 + 2y_2 = 3,\qquad y_1 + y_2 + y_3 = 4 \;\Longrightarrow\; y = (3,\,0,\,1). \]
      <p>Es no negativo y \(b^\top y = 30 + 7 = 37 = c^\top x\): \((3,7)\) es óptimo. En cambio, en \((6,4)\) las restricciones activas
      son la 1 y la 2, así que \(y_3 = 0\), \(y_1 + 2y_2 = 3\) y \(y_1 + y_2 = 4\) dan \(y = (5,\,-1,\,0)\), que no es factible
      (\(y_2 &lt; 0\)): el vértice no es óptimo, pues \(c^\top x = 34 &lt; 37\).</p>

      <h2>Conexiones</h2>
      <ul>
        <li>En el <a href="tema.html?id=simplex-tableau">tablero del Simplex</a>, una variable básica tiene costo reducido 0 (holgura dual cero) y una
        no básica tiene valor 0: las holguras complementarias se cumplen en cada tablero; lo que falla antes del óptimo es
        la factibilidad dual (<a href="tema.html?id=optimality-certificates">Optimality Certificates</a>).</li>
        <li>Con una restricción activa y variable dual cero el vértice es <a href="tema.html?id=degeneracy-cycling">degenerado</a> y el
        sistema anterior queda indeterminado.</li>
        <li>Son el caso lineal de las condiciones de <a href="tema.html?id=kkt-conditions">Karush-Kuhn-Tucker</a>, donde la holgura complementaria
        \(\mu_i\, g_i(x) = 0\) aparece para cada desigualdad.</li>
        <li>El valor de \(y_i\) es el <a href="tema.html?id=shadow-prices">precio sombra</a> del recurso: una restricción con holgura vale 0.</li>
      </ul>`,
  });
})();
