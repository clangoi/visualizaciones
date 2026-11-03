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
  const TOL = 1e-9;

  const A = [[1, 1], [2, 1], [0, 1]];
  const c = [3, 4], b = [10, 16, 7];
  const NOMBRES = ['horno', 'mano de obra', 'demanda de B'];
  const colA = (j) => A.map((a) => a[j]);

  function simplexFinal() {
    let u = null;
    for (const s of O.simplex(c, A, b, { regla: 'bland' })) u = s;
    return u;
  }

  /* ---------- Fig. 1: verificar un par (x, y) ---------- */

  function montarVerificar(cuerpo) {
    const opt = simplexFinal();
    let x = [3, 6], y = [2, 1, 1];
    const ctl = VIZ.controles(cuerpo);
    const sx1 = ctl.rango({ etiqueta: 'x₁', min: 0, max: 11, paso: 0.25, valor: x[0], alCambiar: (v) => { x[0] = v; dibujar(); } });
    const sx2 = ctl.rango({ etiqueta: 'x₂', min: 0, max: 11, paso: 0.25, valor: x[1], alCambiar: (v) => { x[1] = v; dibujar(); } });
    const sy = [0, 1, 2].map((i) => ctl.rango({ etiqueta: `y${sub(i)}`, min: 0, max: 8, paso: 0.25, valor: y[i], alCambiar: (v) => { y[i] = v; dibujar(); } }));
    const poner = (nx, ny) => { x = nx.slice(); y = ny.slice(); sx1.valor = x[0]; sx2.valor = x[1]; sy.forEach((s, i) => { s.valor = y[i]; }); dibujar(); };
    ctl.boton('Par óptimo', () => poner(opt.x, opt.duales), { primario: true });
    ctl.boton('Factible, no óptimo', () => poner([6, 4], [5, 0, 0]));
    ctl.boton('y con una violación', () => poner(opt.x, [1, 1, 0]));
    ctl.boton('Perturbar', () => poner(x.map((v) => Math.max(0, v + 0.5)), y));

    const pp = panel(cuerpo, ['x₁', 'x₂'], C.s1);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región factible del primal' },
      { color: C.s1, texto: 'x factible', forma: 'punto' },
      { color: C.s8, texto: 'x no factible (hueco)', forma: 'punto' },
      { color: C.apagado, texto: 'curva de nivel cᵀx = bᵀy', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre x sobre la región o mueva los controles de y. No se resuelve ningún LP: basta comprobar tres cosas. Si las tres se cumplen, x e y son óptimos aunque usted no sepa cómo se encontraron.');

    pp.W = { xmin: 0, xmax: 11, ymin: 0, ymax: 11 };
    pp.poli = poliPrimal({ A, b, c }, pp.W);
    pp.rectas = A.map((a, i) => ({ a, b: b[i] }));
    pp.alClic = (q) => { x = [Math.round(q[0] * 4) / 4, Math.round(q[1] * 4) / 4]; sx1.valor = x[0]; sx2.valor = x[1]; dibujar(); };
    pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>cᵀx = <b>${VIZ.fmt(dot(c, q))}</b>`;

    function dibujar() {
      const fx = factiblePrimal({ A, b }, x), by = dot(b, y), cx = dot(c, x);
      pp.extra = (ctx, p) => {
        ctx.save();
        p.recortar();
        recta(ctx, p, c, by, C.apagado, 1.5, [3, 4]);
        ctx.restore();
        VIZ.marcador(ctx, p.sx(opt.x[0]), p.sy(opt.x[1]), C.s6, 4);
        if (fx) VIZ.marcador(ctx, p.sx(x[0]), p.sy(x[1]), C.s1, 7);
        else { ctx.save(); ctx.fillStyle = C.superficie; ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.sx(x[0]), p.sy(x[1]), 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); ctx.restore(); }
      };
      pp.dibujar();

      const hs = A.map((a, i) => dot(a, x)), ds = [0, 1].map((j) => dot(colA(j), y));
      const filas = [];
      const fila = (cond, valor, ok, clase) => filas.push(VIZ.el('tr', { class: clase || null }, VIZ.el('td', { class: 'izq' }, cond), VIZ.el('td', null, valor), VIZ.el('td', null, ok ? 'cumple' : 'falla')));
      fila('x ≥ 0', par(x), x.every((v) => v >= -TOL));
      A.forEach((a, i) => fila(`A${sub(i)}x ≤ b${sub(i)}  (${NOMBRES[i]})`, `${VIZ.fmt(limpio(hs[i]), 3)} ≤ ${VIZ.fmt(b[i])}`, hs[i] <= b[i] + TOL));
      fila('y ≥ 0', par(y), y.every((v) => v >= -TOL));
      [0, 1].forEach((j) => fila(`A${sub(j)}ᵀy ≥ c${sub(j)}`, `${VIZ.fmt(limpio(ds[j]), 3)} ≥ ${VIZ.fmt(c[j])}`, ds[j] >= c[j] - TOL));
      const igual = Math.abs(cx - by) < 1e-7;
      fila('cᵀx = bᵀy', `${VIZ.fmt(cx)} y ${VIZ.fmt(by)}`, igual);
      const fy = factibleDual({ A, c }, y);
      const certificado = fx && fy && igual;
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['Condición', 'Valores', 'Resultado'].map((h) => VIZ.el('th', null, h)))),
        VIZ.el('tbody', null, filas)),
      VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['', 'x₁', 'x₂', 's₁', 's₂', 's₃'].map((h, j) => VIZ.el('th', { class: j === 0 ? 'izq' : null }, h)))),
        VIZ.el('tbody', null,
          VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'fila z del tablero óptimo'), opt.T[3].slice(0, 5).map((v) => VIZ.el('td', null, VIZ.fmt(limpio(v), 3)))),
          VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'holgura dual de su y'), [ds[0] - c[0], ds[1] - c[1], ...y].map((v) => VIZ.el('td', null, VIZ.fmt(limpio(v), 3)))))));
      registro.textContent = certificado ? 'Las tres condiciones se cumplen: (x, y) es un certificado de optimalidad. Ningún punto factible puede superar a cᵀx, porque bᵀy lo acota.'
        : !fx && !fy ? 'Ni x ni y son factibles: el par no prueba nada.'
          : !fx ? 'x no es factible: no puede ser solución, aunque y lo fuera.'
            : !fy ? 'y no es factible para el dual: bᵀy no es una cota válida, así que no certifica nada.'
              : `Ambos son factibles, pero la brecha bᵀy − cᵀx = ${VIZ.fmt(by - cx)} es positiva: x es una cota inferior y y una superior, no un certificado. Busque cerrar la brecha.`;
      lectura.set([
        ['x factible', fx ? 'sí' : 'no'],
        ['y factible', fy ? 'sí' : 'no'],
        ['cᵀx', VIZ.fmt(cx)],
        ['bᵀy', VIZ.fmt(by)],
        ['veredicto', certificado ? 'certificado' : 'no certifica'],
      ]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: Farkas, certificado de infactibilidad ---------- */

  const AF = [[1, 1], [-1, -1], [1, 0]];

  function montarFarkas(cuerpo) {
    let t = 6;
    const y = [0, 0, 0];
    const bF = () => [4, -t, 3];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Mínimo t de x₁ + x₂ (restricción 2)', min: 0, max: 8, paso: 0.5, valor: t, alCambiar: (v) => { t = v; dibujar(); } });
    const sy = [0, 1, 2].map((i) => ctl.rango({ etiqueta: `y${sub(i)}`, min: 0, max: 3, paso: 0.05, valor: y[i], alCambiar: (v) => { y[i] = v; dibujar(); } }));
    ctl.boton('Buscar certificado (LP)', () => {
      const r = lpSeguro(bF(), trans(AF).concat([[1, 1, 1]]), ['>=', '>=', '='], [0, 0, 1], false);
      if (r.estado === 'optimo' && r.z < -1e-9) { r.x.forEach((v, i) => { y[i] = Math.round(v * 20) / 20; sy[i].valor = y[i]; }); dibujar(); }
      else { registro.textContent = 'El LP no halla ningún y ≥ 0 con Aᵀy ≥ 0 y bᵀy < 0: el sistema es factible, así que por Farkas no existe certificado.'; }
    }, { primario: true });
    ctl.boton('y = (1, 1, 0)', () => { [1, 1, 0].forEach((v, i) => { y[i] = v; sy[i].valor = v; }); dibujar(); });
    ctl.boton('y = 0', () => { y.fill(0); sy.forEach((s) => { s.valor = 0; }); dibujar(); });

    const pp = panel(cuerpo, ['x₁', 'x₂'], C.s1);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'conjunto factible (si existe)' },
      { color: C.tinta2, texto: 'restricción del sistema', forma: 'linea' },
      { color: C.s8, texto: 'combinación Σ yᵢ (restricción i)', forma: 'linea' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con t = 6 el sistema es contradictorio (x₁ + x₂ ≤ 4 y ≥ 6). Pulse «Buscar certificado» o fije y = (1, 1, 0): la suma de las dos restricciones da 0 ≤ −2. Baje t por debajo de 4 y verá que ningún y sirve.');

    pp.W = { xmin: -2, xmax: 8, ymin: -2, ymax: 8 };
    pp.tooltip = (q) => `x = (<b>${VIZ.fmt(q[0], 3)}</b>, <b>${VIZ.fmt(q[1], 3)}</b>)<br>${factiblePrimal({ A: AF, b: bF() }, q) ? 'cumple el sistema' : 'viola el sistema'}`;

    function dibujar() {
      const b = bF();
      const w = trans(AF).map((col) => dot(col, y)); // Aᵀy
      const by = dot(b, y);
      pp.poli = poliPrimal({ A: AF, b }, { xmin: 0, xmax: 8, ymin: 0, ymax: 8 });
      pp.rectas = AF.map((a, i) => ({ a, b: b[i] }));
      pp.extra = (ctx, p) => {
        if (Math.abs(w[0]) + Math.abs(w[1]) > 1e-9) {
          ctx.save();
          p.recortar();
          recta(ctx, p, w, by, C.s8, 3);
          ctx.restore();
        }
        if (pp.poli.length < 3) { ctx.font = VIZ.fuente(11); ctx.fillStyle = C.s8; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('conjunto factible vacío', p.x0 + 8, p.y1 + 6); }
      };
      pp.dibujar();
      const okY = y.every((v) => v >= 0);
      const okW = w.every((v) => v >= -TOL);
      const okB = by < -TOL;
      const vacio = pp.poli.length < 3;
      const fila = (cond, valor, ok) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, cond), VIZ.el('td', null, valor), VIZ.el('td', null, ok ? 'cumple' : 'falla'));
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['Condición de Farkas', 'Valor', 'Resultado'].map((h) => VIZ.el('th', null, h)))),
        VIZ.el('tbody', null,
          fila('y ≥ 0', par(y), okY),
          fila('Aᵀy ≥ 0', par(w), okW),
          fila('bᵀy < 0', VIZ.fmt(limpio(by)), okB))));
      const cert = okY && okW && okB;
      registro.textContent = cert
        ? `Certificado válido: sumando las restricciones con pesos y se obtiene ${VIZ.fmt(limpio(w[0]))}·x₁ + ${VIZ.fmt(limpio(w[1]))}·x₂ ≤ ${VIZ.fmt(by)}; el lado izquierdo es ≥ 0 para todo x ≥ 0 y el derecho es negativo. El sistema es infactible.`
        : vacio ? 'El sistema es infactible pero este y no lo prueba: pulse «Buscar certificado».'
          : 'El sistema tiene solución; por el lema de Farkas ningún y puede cumplir a la vez las tres condiciones.';
      lectura.set([
        ['sistema', vacio ? 'infactible' : 'factible'],
        ['Aᵀy', par(w)],
        ['bᵀy', VIZ.fmt(limpio(by))],
        ['¿y es certificado?', cert ? 'sí' : 'no'],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('optimality-certificates', {
    intro: String.raw`
      <p>Un <strong>certificado de optimalidad</strong> es una prueba corta que se verifica sin repetir la búsqueda. Para un
      programa lineal basta un par \((x, y)\): un punto factible del primal, otro factible del dual y la igualdad de sus
      valores. La <a href="tema.html?id=weak-duality">dualidad débil</a> garantiza entonces que ningún otro punto puede ser mejor.</p>
      <p>También hay certificados negativos: cuando un sistema de desigualdades no tiene solución, existe una combinación
      de ellas que lo demuestra (lema de Farkas). Verificar cualquiera de los dos cuesta unas pocas multiplicaciones de matrices,
      aunque encontrarlos haya costado un algoritmo entero.</p>`,
    visualizaciones: [
      {
        titulo: 'Verificar un par primal-dual',
        descripcion: 'Mueva x y y y observe cuáles de las condiciones se cumplen; solo cuando las tres lo hacen aparece un certificado. Compare la última fila de abajo con la fila z del tablero del Simplex: los costos reducidos son las holguras duales.',
        montar: montarVerificar,
      },
      {
        titulo: 'Certificado de infactibilidad (Farkas)',
        descripcion: 'Con t = 6 el sistema es contradictorio. Pulse «Buscar certificado», o pruebe y = (1, 1, 0): la combinación de restricciones queda a la izquierda de los ejes. Luego baje t hasta 4 o menos y vea que no existe ningún y.',
        montar: montarFarkas,
      },
    ],
    teoria: String.raw`
      <h2>Certificado de optimalidad</h2>
      <div class="recuadro"><p><strong>Proposición.</strong> Si \(\bar x\) es factible para (P), \(\bar y\) es factible para (D) y
      \(c^\top \bar x = b^\top \bar y\), entonces \(\bar x\) es óptimo para (P) y \(\bar y\) lo es para (D).</p></div>
      <p>Para cualquier \(x\) factible, \(c^\top x \le b^\top \bar y = c^\top \bar x\) por dualidad débil; por simetría, vale lo mismo
      para el dual. Verificar el certificado consiste en cuatro comprobaciones:</p>
      <pre><code>certificar(x, y):
    1. x ≥ 0  y  A x ≤ b                  (factibilidad primal)
    2. y ≥ 0  y  Aᵀ y ≥ c                 (factibilidad dual)
    3. cᵀx = bᵀy                          (brecha cero)
    devolver «óptimo» si las tres se cumplen</code></pre>
      <p>Con las <a href="tema.html?id=complementary-slackness">holguras complementarias</a> la tercera condición puede sustituirse por
      \(y_i(b_i - A_i x) = 0\) y \(x_j(A_j^\top y - c_j) = 0\), ya que la brecha es la suma de esos productos.</p>

      <h2>Ejemplo resuelto</h2>
      <p>Con \(\max\, 3x_1 + 4x_2\) s.a. \(x_1 + x_2 \le 10,\ 2x_1 + x_2 \le 16,\ x_2 \le 7\), tome \(\bar x = (3,7)\) y \(\bar y = (3,0,1)\).
      Primal: \(3 + 7 = 10 \le 10\), \(6 + 7 = 13 \le 16\), \(7 \le 7\). Dual: \(y_1 + 2y_2 = 3 \ge 3\) y \(y_1 + y_2 + y_3 = 4 \ge 4\), con
      \(\bar y \ge 0\). Valores: \(c^\top \bar x = 9 + 28 = 37 = 30 + 0 + 7 = b^\top \bar y\). Es un certificado. En cambio, \(\bar y = (5,0,0)\)
      es factible pero \(b^\top \bar y = 50\) deja una brecha de \(13\) frente a \(37\): es solo una cota.</p>

      <h2>Relación con el Simplex</h2>
      <p>En un tablero del Simplex, \(y^\top = c_B^\top B^{-1}\) cumple siempre \(c^\top x = b^\top y\) y las holguras complementarias
      (las básicas tienen costo reducido 0). Lo que puede fallar antes del final es la factibilidad dual. Los costos reducidos son
      exactamente las holguras duales:</p>
      \[ \bar c_j = A_j^\top y - c_j \;\;(\text{variable } x_j), \qquad \bar c_{n+i} = y_i \;\;(\text{holgura } s_i). \]
      <p>El tablero es óptimo precisamente cuando todos son \(\ge 0\), es decir, cuando \(y\) es factible para el dual: el criterio de parada
      del Simplex <em>es</em> la comprobación de este certificado (ver <a href="tema.html?id=simplex-tableau">The Simplex Tableau</a>).</p>

      <h2>Certificado de infactibilidad: lema de Farkas</h2>
      <div class="recuadro"><p><strong>Lema de Farkas (variante).</strong> Exactamente una de las dos afirmaciones es cierta:
      (a) existe \(x \ge 0\) con \(Ax \le b\); (b) existe \(y \ge 0\) con \(A^\top y \ge 0\) y \(b^\top y &lt; 0\).</p></div>
      <p>Si (b) vale, un \(x\) de (a) daría \(0 \le (A^\top y)^\top x = y^\top A x \le y^\top b &lt; 0\), absurdo. El otro sentido es un teorema
      de separación de convexos. Ejemplo: \(x_1 + x_2 \le 4\) y \(-x_1 - x_2 \le -6\) con \(y = (1,1)\) da \(0 \le -2\).</p>
      <p>Este certificado es el que explica los casos con problemas infactibles o no acotados de la
      <a href="tema.html?id=strong-duality">dualidad fuerte</a>: si el primal es infactible, el dual es infactible o tiene un rayo
      de mejora, que es otro certificado. Un problema no acotado se certifica con una dirección \(d \ge 0\), \(Ad \le 0\), \(c^\top d &gt; 0\)
      (ver <a href="tema.html?id=unbounded-infeasible">Unbounded and Infeasible Problems</a>).</p>

      <h2>Por qué importan</h2>
      <p>Los certificados permiten confiar en un resolvedor sin confiar en su código, y son la base de las cotas en
      <a href="tema.html?id=node-pruning-gap">ramificación y acotamiento</a>: cada nodo se poda gracias a una cota dual válida. El análogo
      para problemas no lineales es el conjunto de condiciones de <a href="tema.html?id=kkt-conditions">Karush-Kuhn-Tucker</a>.</p>`,
  });
})();
