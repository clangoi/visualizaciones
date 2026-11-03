(function () {
  'use strict';
  const { color: C } = VIZ;
  const O = VIZ.opt;

  /* ---------- Ayudantes de modelación ---------- */

  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (i) => String(i + 1).replace(/\d/g, (d) => SUBS[d]);
  const trans = (A) => A[0].map((_, j) => A.map((f) => f[j]));
  const SEN = { '<=': '≤', '>=': '≥', '=': '=' };
  const SIG = { '>=0': '≥ 0', '<=0': '≤ 0', libre: 'libre' };

  // LP general; si el simplex ve un rayo mientras aún hay artificiales, el problema es infactible.
  function lpSeguro(c, A, sen, b, max) {
    const r = O.lp(c, A, sen, b, { max });
    if (r.estado !== 'noacotado') return r;
    const f = O.lp(c.map(() => 0), A, sen, b, { max: true });
    return f.estado === 'optimo' ? r : { estado: 'infactible' };
  }

  // Problema: { max, c, A, sen, b, signo } con signo[j] ∈ '>=0' | '<=0' | 'libre'.
  // Regla de transformación (la misma para máx y mín, invirtiendo el sentido «natural»).
  function dual(P) {
    return {
      max: !P.max,
      c: P.b.slice(),
      A: trans(P.A),
      b: P.c.slice(),
      sen: P.signo.map((s) => (s === 'libre' ? '=' : (s === '>=0') === P.max ? '>=' : '<=')),
      signo: P.sen.map((s) => (s === '=' ? 'libre' : (s === '<=') === P.max ? '>=0' : '<=0')),
    };
  }
  const igual = (P, Q) => JSON.stringify(P) === JSON.stringify(Q);

  // Resuelve P con VIZ.opt.lp: sustituye variables ≤ 0 por su negativo y parte las libres en dos.
  function resolver(P) {
    const cols = [];
    P.signo.forEach((s, j) => {
      if (s === '>=0') cols.push([j, 1]);
      else if (s === '<=0') cols.push([j, -1]);
      else cols.push([j, 1], [j, -1]);
    });
    const r = lpSeguro(cols.map(([j, f]) => f * P.c[j]), P.A.map((fila) => cols.map(([j, f]) => f * fila[j])), P.sen, P.b, P.max);
    if (r.estado !== 'optimo') return r;
    const x = P.c.map(() => 0);
    cols.forEach(([j, f], k) => { x[j] += f * r.x[k]; });
    return { estado: 'optimo', x, z: P.c.reduce((s, v, j) => s + v * x[j], 0) };
  }

  function lineal(coef, v) {
    let s = '';
    coef.forEach((a, j) => {
      if (Math.abs(a) < 1e-12) return;
      const t = (Math.abs(a) === 1 ? '' : VIZ.fmt(Math.abs(a))) + v + sub(j);
      s += s ? (a < 0 ? ' − ' : ' + ') + t : (a < 0 ? '−' : '') + t;
    });
    return s || '0';
  }
  function lineas(P, v) {
    const sg = '\u00a0'.repeat(5);
    const l = [`${P.max ? 'máx' : 'mín'}\u00a0\u00a0${lineal(P.c, v)}`];
    P.A.forEach((a, i) => l.push(`${i ? sg : 's.a.'}\u00a0${lineal(a, v)} ${SEN[P.sen[i]]} ${VIZ.fmt(P.b[i])}`));
    l.push(`${sg}\u00a0${P.signo.map((s, j) => `${v}${sub(j)} ${SIG[s]}`).join(', ')}`);
    return l;
  }
  function bloque(P, v) {
    return VIZ.el('div', { class: 'lista-mono' }, lineas(P, v).map((t) => VIZ.el('div', null, t)));
  }
  const estadoTexto = (r) => (r.estado === 'optimo' ? `óptimo ${VIZ.fmt(r.z)}` : r.estado === 'noacotado' ? 'no acotado' : 'infactible');

  /* ---------- Región factible 2-D (con desigualdades e igualdades) ---------- */

  function region(P, W) {
    const lo = P.signo.map((s, j) => (s === '>=0' ? 0 : [W.xmin, W.ymin][j]));
    const hi = P.signo.map((s, j) => (s === '<=0' ? 0 : [W.xmax, W.ymax][j]));
    const ineq = [], eq = [];
    P.A.forEach((a, i) => {
      if (P.sen[i] === '=') eq.push({ a, b: P.b[i] });
      else ineq.push(P.sen[i] === '<=' ? { a, b: P.b[i] } : { a: a.map((v) => -v), b: -P.b[i] });
    });
    const poli = O.poligono(ineq, { xmin: lo[0], xmax: hi[0], ymin: lo[1], ymax: hi[1] });
    const ok = (q) => q[0] >= lo[0] - 1e-9 && q[0] <= hi[0] + 1e-9 && q[1] >= lo[1] - 1e-9 && q[1] <= hi[1] + 1e-9
      && ineq.every((r) => r.a[0] * q[0] + r.a[1] * q[1] <= r.b + 1e-9)
      && eq.every((r) => Math.abs(r.a[0] * q[0] + r.a[1] * q[1] - r.b) < 1e-6);
    const segs = eq.map(({ a, b }) => {
      const runs = [];
      let run = [];
      for (let k = 0; k <= 240; k++) {
        const t = k / 240;
        const q = Math.abs(a[1]) > 1e-9
          ? [W.xmin + t * (W.xmax - W.xmin), 0]
          : [b / a[0], W.ymin + t * (W.ymax - W.ymin)];
        if (Math.abs(a[1]) > 1e-9) q[1] = (b - a[0] * q[0]) / a[1];
        const dentro = q[0] >= lo[0] - 1e-9 && q[0] <= hi[0] + 1e-9 && q[1] >= lo[1] - 1e-9 && q[1] <= hi[1] + 1e-9
          && ineq.every((r) => r.a[0] * q[0] + r.a[1] * q[1] <= r.b + 1e-9);
        if (dentro) run.push(q); else if (run.length) { runs.push(run); run = []; }
      }
      if (run.length) runs.push(run);
      return runs;
    });
    return { poli, ok, segs, tieneIgualdad: eq.length > 0 };
  }

  function recta(ctx, p, a, b, color, ancho, guion) {
    const d = p.d, pts = [];
    if (Math.abs(a[1]) > 1e-9) for (const x of [d.xmin, d.xmax]) pts.push([x, (b - a[0] * x) / a[1]]);
    else pts.push([b / a[0], d.ymin], [b / a[0], d.ymax]);
    VIZ.trazar(ctx, p, pts, color, ancho, guion);
  }

  function pintar(l, W, P, sol, colorR, nombres) {
    const { ctx } = l;
    l.limpiar();
    const p = VIZ.plano(l, W, { etiquetaX: nombres[0], etiquetaY: nombres[1] });
    p.ejes();
    const R = region(P, W);
    ctx.save();
    p.recortar();
    ctx.strokeStyle = C.eje;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.sx(0) + 0.5, p.y0); ctx.lineTo(p.sx(0) + 0.5, p.y1);
    ctx.moveTo(p.x0, p.sy(0) + 0.5); ctx.lineTo(p.x1, p.sy(0) + 0.5);
    ctx.stroke();
    if (R.poli.length >= 3 && !R.tieneIgualdad) {
      ctx.beginPath();
      R.poli.forEach(([x, y], k) => (k ? ctx.lineTo(p.sx(x), p.sy(y)) : ctx.moveTo(p.sx(x), p.sy(y))));
      ctx.closePath();
      ctx.fillStyle = VIZ.alfa(colorR, 0.2);
      ctx.fill();
    }
    P.A.forEach((a, i) => recta(ctx, p, a, P.b[i], C.tinta2, 1.5, P.sen[i] === '=' ? null : [6, 4]));
    R.segs.forEach((runs) => runs.forEach((run) => VIZ.trazar(ctx, p, run, colorR, 5)));
    if (sol.estado === 'optimo') recta(ctx, p, P.c, sol.z, C.apagado, 1.5, [3, 4]);
    ctx.restore();
    if (sol.estado === 'optimo') VIZ.marcador(ctx, p.sx(sol.x[0]), p.sy(sol.x[1]), C.s6, 6);
    ctx.font = VIZ.fuente(11);
    ctx.fillStyle = C.s8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const aviso = sol.estado === 'infactible' ? 'región vacía' : sol.estado === 'noacotado' ? 'objetivo no acotado' : '';
    if (aviso) ctx.fillText(aviso, p.x0 + 8, p.y1 + 6);
    return { p, R };
  }

  function panel(padre, nombres, colorR, P) {
    const l = VIZ.lienzo(padre, { proporcion: 0.85, altoMin: 230, altoMax: 380 });
    const tip = VIZ.tooltip(l);
    const e = { l, args: null, geo: null };
    e.dibujar = (W, Q, sol) => { e.args = [W, Q, sol]; e.geo = pintar(l, W, Q, sol, colorR, nombres); };
    l.alDibujar = () => e.args && e.dibujar(...e.args);
    l.canvas.addEventListener('pointermove', (ev) => {
      if (!e.geo) return;
      const { x, y } = l.posicion(ev);
      const { p, R } = e.geo;
      if (!p.dentro(x, y)) return tip.ocultar();
      const q = [p.ix(x), p.iy(y)], Q = e.args[1];
      tip.mostrar(x, y, `${nombres[0]} = <b>${VIZ.fmt(q[0], 3)}</b>, ${nombres[1]} = <b>${VIZ.fmt(q[1], 3)}</b>`
        + `<br>objetivo <b>${VIZ.fmt(Q.c[0] * q[0] + Q.c[1] * q[1])}</b><br>${R.ok(q) ? 'factible' : 'no factible'}`);
    });
    l.canvas.addEventListener('pointerleave', () => tip.ocultar());
    void P;
    return e;
  }

  /* ---------- Fig. 1: primal y dual lado a lado ---------- */

  const A2 = [[1, 2], [3, 1]];
  const FORMAS = {
    canon: { nombre: 'Máx con ≤ (forma canónica)', max: true, sen: ['<=', '<='], c: [2, 3], b: [8, 9],
      Wp: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
    dieta: { nombre: 'Mín con ≥ (como la dieta)', max: false, sen: ['>=', '>='], c: [3, 2], b: [6, 8],
      Wp: { xmin: 0, xmax: 14, ymin: 0, ymax: 14 }, Wd: { xmin: 0, xmax: 8, ymin: 0, ymax: 8 } },
    mixta: { nombre: 'Máx con una igualdad', max: true, sen: ['<=', '='], c: [2, 3], b: [8, 9],
      Wp: { xmin: 0, xmax: 6, ymin: 0, ymax: 13 }, Wd: { xmin: 0, xmax: 8, ymin: -8, ymax: 8 } },
  };

  function montarRegiones(cuerpo) {
    let forma = 'canon', c = FORMAS.canon.c.slice(), b = FORMAS.canon.b.slice();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Forma del primal', opciones: Object.entries(FORMAS).map(([k, f]) => [k, f.nombre]), valor: forma,
      alCambiar: (v) => {
        forma = v; c = FORMAS[v].c.slice(); b = FORMAS[v].b.slice();
        sc1.valor = c[0]; sc2.valor = c[1]; sb1.valor = b[0]; sb2.valor = b[1];
        actualizar();
      } });
    const sc1 = ctl.rango({ etiqueta: 'c₁', min: 1, max: 6, paso: 0.5, valor: c[0], alCambiar: (v) => { c[0] = v; actualizar(); } });
    const sc2 = ctl.rango({ etiqueta: 'c₂', min: 1, max: 6, paso: 0.5, valor: c[1], alCambiar: (v) => { c[1] = v; actualizar(); } });
    const sb1 = ctl.rango({ etiqueta: 'b₁', min: 4, max: 12, paso: 0.5, valor: b[0], alCambiar: (v) => { b[0] = v; actualizar(); } });
    const sb2 = ctl.rango({ etiqueta: 'b₂', min: 4, max: 12, paso: 0.5, valor: b[1], alCambiar: (v) => { b[1] = v; actualizar(); } });

    const cols = VIZ.el('div', { class: 'dos-columnas' });
    const izq = VIZ.el('div'), der = VIZ.el('div');
    cols.append(izq, der);
    cuerpo.appendChild(cols);
    VIZ.subtitulo(izq, 'Región del primal (en x)');
    const pp = panel(izq, ['x₁', 'x₂'], C.s1);
    VIZ.subtitulo(der, 'Región del dual (en y)');
    const pd = panel(der, ['y₁', 'y₂'], C.s2);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'región factible del primal' },
      { color: C.s2, texto: 'región factible del dual' },
      { color: C.tinta2, texto: 'frontera de una restricción (continua si es igualdad)', forma: 'linea' },
      { color: C.apagado, texto: 'curva de nivel del objetivo en el óptimo', forma: 'linea' },
      { color: C.s6, texto: 'solución óptima', forma: 'punto' },
    ]);
    const textos = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(textos);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pase el cursor sobre cualquiera de las dos regiones para ver el valor del objetivo en ese punto. Cada restricción del primal es una variable del dual, y cada variable del primal es una restricción del dual.');

    function actualizar() {
      const F = FORMAS[forma];
      const P = { max: F.max, c: c.slice(), A: A2, sen: F.sen, b: b.slice(), signo: ['>=0', '>=0'] };
      const D = dual(P);
      const rp = resolver(P), rd = resolver(D);
      pp.dibujar(F.Wp, P, rp);
      pd.dibujar(F.Wd, D, rd);
      textos.replaceChildren(bloque(P, 'x'), bloque(D, 'y'));
      const coinciden = rp.estado === 'optimo' && rd.estado === 'optimo' && Math.abs(rp.z - rd.z) < 1e-6;
      registro.textContent = coinciden
        ? `Primal y dual tienen el mismo valor óptimo ${VIZ.fmt(rp.z)}: el primal lo alcanza en (${rp.x.map((v) => VIZ.fmt(v, 3)).join(', ')}) y el dual en (${rd.x.map((v) => VIZ.fmt(v, 3)).join(', ')}).`
        : `Primal: ${estadoTexto(rp)}. Dual: ${estadoTexto(rd)}.`;
      lectura.set([
        ['primal', estadoTexto(rp)],
        ['dual', estadoTexto(rd)],
        ['diferencia', coinciden ? VIZ.fmt(Math.abs(rp.z - rd.z)) : '—'],
        ['y óptimo', rd.estado === 'optimo' ? `(${rd.x.map((v) => VIZ.fmt(v, 3)).join(', ')})` : '—'],
      ]);
    }
    actualizar();
  }

  /* ---------- Fig. 2: tabla de transformación interactiva ---------- */

  function montarTabla(cuerpo) {
    const c = [3, 2], A = [[1, 1], [2, 1], [1, 0]], b = [4, 6, 3];
    let obj = 'max';
    const sen = ['<=', '<=', '<='], signo = ['>=0', '>=0'];
    const ctl = VIZ.controles(cuerpo);
    const selObj = ctl.selector({ etiqueta: 'Objetivo', opciones: [['max', 'Maximizar'], ['min', 'Minimizar']], valor: obj, alCambiar: (v) => { obj = v; actualizar(); } });
    const selSen = sen.map((_, i) => ctl.selector({ etiqueta: `Restricción ${i + 1}`, opciones: [['<=', '≤'], ['>=', '≥'], ['=', '=']], valor: sen[i], alCambiar: (v) => { sen[i] = v; actualizar(); } }));
    const selSig = signo.map((_, j) => ctl.selector({ etiqueta: `Variable x${sub(j)}`, opciones: [['>=0', '≥ 0'], ['<=0', '≤ 0'], ['libre', 'libre']], valor: signo[j], alCambiar: (v) => { signo[j] = v; actualizar(); } }));
    const poner = (o, s, g) => {
      obj = o; selObj.valor = o;
      s.forEach((v, i) => { sen[i] = v; selSen[i].valor = v; });
      g.forEach((v, j) => { signo[j] = v; selSig[j].valor = v; });
      actualizar();
    };
    let semilla = 1;
    ctl.boton('Forma canónica de máximo', () => poner('max', ['<=', '<=', '<='], ['>=0', '>=0']), { primario: true });
    ctl.boton('Forma canónica de mínimo', () => poner('min', ['>=', '>=', '>='], ['>=0', '>=0']));
    ctl.boton('Sorteo', () => {
      const r = VIZ.semilla(semilla++ * 7919);
      const el = (xs) => xs[Math.floor(r() * xs.length)];
      poner(el(['max', 'min']), sen.map(() => el(['<=', '>=', '='])), signo.map(() => el(['>=0', '<=0', 'libre'])));
    });

    const salida = VIZ.el('div');
    cuerpo.appendChild(salida);
    cuerpo.dataset.sinLeyenda = 'no hay lienzo: la figura es una tabla de texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija el sentido de cada restricción y el signo de cada variable: la tabla de la derecha muestra la regla aplicada. Con «Sorteo» aparecen combinaciones que casi nunca se ven en un libro.');

    function actualizar() {
      const P = { max: obj === 'max', c, A, sen: sen.slice(), b, signo: signo.slice() };
      const D = dual(P), DD = dual(D);
      const rp = resolver(P), rd = resolver(D);
      const filas = [];
      P.sen.forEach((s, i) => filas.push([`restricción ${i + 1}: ${SEN[s]}`, `variable y${sub(i)}: ${SIG[D.signo[i]]}`]));
      P.signo.forEach((s, j) => filas.push([`variable x${sub(j)}: ${SIG[s]}`, `restricción ${j + 1}: ${SEN[D.sen[j]]}`]));
      const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', null, P.max ? 'Primal (máx)' : 'Primal (mín)'), VIZ.el('th', null, D.max ? 'Dual (máx)' : 'Dual (mín)'))),
        VIZ.el('tbody', null, filas.map((f) => VIZ.el('tr', null, VIZ.el('td', null, f[0]), VIZ.el('td', null, f[1])))));
      const cols = VIZ.el('div', { class: 'dos-columnas' }, VIZ.el('div', null, VIZ.subtitulo(VIZ.el('div'), 'Primal'), bloque(P, 'x')), VIZ.el('div', null, VIZ.subtitulo(VIZ.el('div'), 'Dual'), bloque(D, 'y')));
      const vuelta = VIZ.el('div', { class: 'dos-columnas' }, VIZ.el('div', null, VIZ.subtitulo(VIZ.el('div'), 'Dual del dual'), bloque(DD, 'x')));
      salida.replaceChildren(
        cols,
        VIZ.el('div', { class: 'caja-desplazable' }, tabla),
        vuelta,
      );
      const coincide = igual(P, DD);
      const ambos = rp.estado === 'optimo' && rd.estado === 'optimo';
      registro.textContent = coincide
        ? 'Al dualizar el dual se recupera exactamente el primal: la transformación es una involución.'
        : 'El dual del dual no coincide con el primal (no debería ocurrir).';
      lectura.set([
        ['¿dual del dual = primal?', coincide ? 'sí' : 'no'],
        ['primal', estadoTexto(rp)],
        ['dual', estadoTexto(rd)],
        ['mismo valor', ambos ? (Math.abs(rp.z - rd.z) < 1e-6 ? 'sí' : 'no') : '—'],
      ]);
    }
    actualizar();
  }

  VIZ.registrarTema('dual-construction', {
    intro: String.raw`
      <p>Todo problema de programación lineal viene acompañado de otro, su <strong>dual</strong>, que se escribe mecánicamente a
      partir de los mismos datos: cada <em>restricción</em> del primal se convierte en una <em>variable</em> del dual, cada
      <em>variable</em> del primal en una <em>restricción</em>, y los coeficientes del objetivo y los lados derechos intercambian
      papeles.</p>
      <p>Las dos figuras permiten ver la construcción desde dos ángulos: primero con las regiones factibles de ambos problemas
      (y su valor óptimo común), y luego con la tabla de reglas que decide el sentido de las restricciones y el signo de las
      variables duales.</p>`,
    visualizaciones: [
      {
        titulo: 'Primal y dual lado a lado',
        descripcion: 'Mueva \\(c\\) y \\(b\\) y observe cómo cambian las dos regiones; el valor óptimo de ambas coincide siempre. Pruebe las tres formas del primal: con una igualdad, la variable dual correspondiente queda libre y su región se extiende a valores negativos.',
        montar: montarRegiones,
      },
      {
        titulo: 'Tabla de transformación',
        descripcion: 'Cambie el objetivo, el sentido de cada restricción y el signo de cada variable, y lea el dual resultante. Compruebe que el dual del dual es el primal y que, cuando ambos tienen óptimo, sus valores coinciden.',
        montar: montarTabla,
      },
    ],
    teoria: String.raw`
      <h2>Problema primal y problema dual</h2>
      <p>Un programa lineal en <em>forma canónica de máximo</em> es</p>
      \[ \text{(P)}\quad \max\; c^\top x \quad\text{s.a.}\quad A x \le b,\; x \ge 0, \]
      <p>con \(A \in \mathbb{R}^{m\times n}\). Su dual es</p>
      \[ \text{(D)}\quad \min\; b^\top y \quad\text{s.a.}\quad A^\top y \ge c,\; y \ge 0. \]
      <p>El primal tiene \(n\) variables y \(m\) restricciones; el dual tiene \(m\) variables y \(n\) restricciones. Cada
      variable dual \(y_i\) es el <strong>multiplicador</strong> de la restricción \(i\) del primal: el factor con que esa
      desigualdad se suma a las demás para fabricar una cota superior de \(c^\top x\) (ver
      <a href="tema.html?id=weak-duality">Weak Duality</a>).</p>

      <h2>Tabla de transformación</h2>
      <table>
        <thead><tr><th>Primal (máx)</th><th>Dual (mín)</th></tr></thead>
        <tbody>
          <tr><td>restricción \(i\): \(\le\)</td><td>variable \(y_i \ge 0\)</td></tr>
          <tr><td>restricción \(i\): \(\ge\)</td><td>variable \(y_i \le 0\)</td></tr>
          <tr><td>restricción \(i\): \(=\)</td><td>variable \(y_i\) libre</td></tr>
          <tr><td>variable \(x_j \ge 0\)</td><td>restricción \(j\): \(\ge\)</td></tr>
          <tr><td>variable \(x_j \le 0\)</td><td>restricción \(j\): \(\le\)</td></tr>
          <tr><td>variable \(x_j\) libre</td><td>restricción \(j\): \(=\)</td></tr>
          <tr><td>coeficientes \(c_j\) del objetivo</td><td>lados derechos \(c_j\)</td></tr>
          <tr><td>lados derechos \(b_i\)</td><td>coeficientes \(b_i\) del objetivo</td></tr>
        </tbody>
      </table>
      <p>Si el primal es de <em>mínimo</em>, se lee la tabla de derecha a izquierda: una restricción \(\ge\) da una variable
      \(y_i \ge 0\), una \(\le\) da \(y_i \le 0\), y una variable \(x_j \ge 0\) da una restricción \(\le\) en el dual (de máximo).
      La regla de memoria es que «lo que favorece al problema» (una restricción que encaja con el sentido de la optimización)
      produce una variable dual no negativa.</p>
      <pre><code>dualizar(P):
    objetivo del dual ← el contrario (máx ↔ mín)
    c del dual ← b del primal;  b del dual ← c del primal;  A del dual ← Aᵀ
    para cada restricción i del primal:  signo de y_i ← según la tabla
    para cada variable x_j del primal:   sentido de la restricción j ← según la tabla
    devolver el nuevo problema</code></pre>

      <h2>El dual del dual es el primal</h2>
      <p>Aplicar la transformación dos veces devuelve el problema original: se transpone dos veces la matriz, se intercambian
      dos veces \(b\) y \(c\), y los signos y sentidos vuelven a su valor de partida. La segunda figura lo verifica con
      cualquier combinación de sentidos y signos. Por eso es indiferente cuál de los dos problemas se llama «primal».</p>
      <div class="recuadro"><p><strong>Forma canónica de mínimo.</strong> El dual de
      \(\min\, c^\top x \text{ s.a. } Ax \ge b,\ x \ge 0\) es \(\max\, b^\top y \text{ s.a. } A^\top y \le c,\ y \ge 0\).
      El problema de la dieta (<a href="tema.html?id=diet-problem">The Diet Problem</a>) tiene esa forma.</p></div>

      <h2>Ejemplo resuelto</h2>
      <p>Considere</p>
      \[ \max\; 2x_1 + 3x_2 \quad\text{s.a.}\quad x_1 + 2x_2 \le 8,\; 3x_1 + x_2 \le 9,\; x \ge 0. \]
      <p>Su dual es</p>
      \[ \min\; 8y_1 + 9y_2 \quad\text{s.a.}\quad y_1 + 3y_2 \ge 2,\; 2y_1 + y_2 \ge 3,\; y \ge 0. \]
      <p>En el primal, los vértices son \((0,0)\), \((3,0)\), \((2,3)\) y \((0,4)\) con objetivos \(0,\,6,\,13,\,12\); el óptimo es
      \(x^*=(2,3)\) con valor \(13\). En el dual, las dos restricciones se cruzan en
      \(y^*=(7/5,\,1/5)\), con valor \(8\cdot\tfrac75 + 9\cdot\tfrac15 = 13\). Los dos óptimos coinciden, como asegura la
      <a href="tema.html?id=strong-duality">dualidad fuerte</a>.</p>

      <h2>Conexiones</h2>
      <ul>
        <li>La construcción usa la forma de la <a href="tema.html?id=standard-form">forma estándar</a>: al agregar holguras, la restricción
        \(\le\) del primal se vuelve igualdad y su variable dual es libre en el problema estándar; el signo de \(y_i\) se recupera de la holgura.</li>
        <li>El Simplex resuelve ambos problemas a la vez: los costos reducidos de las holguras en el tablero final son las
        variables duales (<a href="tema.html?id=simplex-tableau">The Simplex Tableau</a>).</li>
        <li>Las condiciones de <a href="tema.html?id=complementary-slackness">holguras complementarias</a> relacionan restricciones y
        variables de ambos problemas, y los <a href="tema.html?id=shadow-prices">precios sombra</a> son los valores de \(y^*\).</li>
        <li>Los casos en que uno de los dos es no acotado o infactible se estudian en
        <a href="tema.html?id=optimality-certificates">Optimality Certificates</a>.</li>
      </ul>`,
  });
})();
