(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: de la tabla a la fórmula ---------- */

  const V3 = ['p', 'q', 'r'];
  const PRES = {
    may: ['mayoría de p, q, r', (v) => (v.p + v.q + v.r >= 2)],
    par: ['paridad (número impar de V)', (v) => (v.p + v.q + v.r) % 2 === 1],
    pq: ['solo p ∧ ¬q', (v) => v.p && !v.q],
    imp: ['p → (q ∨ r)', (v) => !v.p || v.q || v.r],
    ceros: ['todas falsas', () => false],
  };
  const lit = (x, pos) => (pos ? x : '¬' + x);

  function montarTabla(cuerpo) {
    let sal = D.valuaciones(V3).map(PRES.may[1]).map(Boolean), semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función de partida', opciones: Object.entries(PRES).map(([k, v]) => [k, v[0]]), valor: 'may', alCambiar: (k) => { sal = D.valuaciones(V3).map(PRES[k][1]).map(Boolean); dibujar(); } });
    ctl.boton('Función aleatoria', () => { const r = VIZ.semilla(++semilla * 37); sal = sal.map(() => r() < 0.5); dibujar(); });
    const tabla = D.tabla(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de tabla: haga clic en la columna f para cambiar un valor';
    const dnf = VIZ.registro(cuerpo), cnf = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una fila para cambiar el valor de f. Cada fila verdadera aporta un término a la DNF (la conjunción que describe esa fila); cada fila falsa aporta una cláusula a la CNF (la negación de esa fila).');

    function dibujar() {
      const vals = D.valuaciones(V3);
      tabla.poner({ vars: V3, vals, cols: [{ t: 'f', f: (v, i) => sal[i], fuerte: true }], alClick: (i) => { sal[i] = !sal[i]; dibujar(); }, clase: (v, i) => (sal[i] ? 'modelo' : '') });
      const terminos = vals.filter((v, i) => sal[i]).map((v) => '(' + V3.map((x) => lit(x, v[x])).join(' ∧ ') + ')');
      const claus = vals.filter((v, i) => !sal[i]).map((v) => '(' + V3.map((x) => lit(x, !v[x])).join(' ∨ ') + ')');
      const D_ = terminos.length ? terminos.join(' ∨ ') : '⊥', C_ = claus.length ? claus.join(' ∧ ') : '⊤';
      dnf.textContent = `DNF canónica (filas verdaderas):\n${D_}`;
      cnf.textContent = `CNF canónica (filas falsas):\n${C_}`;
      const okD = D.resultados(D.leer(D_), V3).every((x, i) => x === sal[i]), okC = D.resultados(D.leer(C_), V3).every((x, i) => x === sal[i]);
      lectura.set([['filas verdaderas (términos)', String(terminos.length)], ['filas falsas (cláusulas)', String(claus.length)], ['DNF reproduce la tabla', okD ? '✓' : '✗'], ['CNF reproduce la tabla', okC ? '✓' : '✗']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: forma mínima con el método de Quine–McCluskey ---------- */

  const NV = ['p', 'q', 'r', 's'];
  const GRAY = [0, 1, 3, 2];
  const bits = (m) => m.toString(2).split('1').length - 1;

  function primos(min) {
    let cubos = new Map(min.map((m) => [`${m}:0`, { v: m, x: 0 }]));
    const res = [];
    while (cubos.size) {
      const arr = [...cubos.values()], usados = new Set(), sig = new Map();
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j], d = a.v ^ b.v;
        if (a.x === b.x && bits(d) === 1) { const c = { v: a.v & ~d, x: a.x | d }; sig.set(`${c.v}:${c.x}`, c); usados.add(a); usados.add(b); }
      }
      for (const c of arr) if (!usados.has(c)) res.push(c);
      cubos = sig;
    }
    return res;
  }
  const cubre = (c, m) => (m & ~c.x) === c.v;
  function cobertura(min) {
    const P = primos(min), elegidos = [];
    let faltan = new Set(min);
    for (const m of min) { const cs = P.filter((c) => cubre(c, m)); if (cs.length === 1 && !elegidos.includes(cs[0])) elegidos.push(cs[0]); }
    elegidos.forEach((c) => min.forEach((m) => { if (cubre(c, m)) faltan.delete(m); }));
    while (faltan.size) {
      const mejor = P.filter((c) => !elegidos.includes(c)).reduce((b, c) => ([...faltan].filter((m) => cubre(c, m)).length > ([...faltan].filter((m) => cubre(b, m)).length) ? c : b));
      elegidos.push(mejor);
      min.forEach((m) => { if (cubre(mejor, m)) faltan.delete(m); });
    }
    return { P, elegidos };
  }
  const txtCubo = (c) => { const L = NV.map((x, i) => ((c.x >> (3 - i)) & 1 ? null : lit(x, (c.v >> (3 - i)) & 1))).filter(Boolean); return L.length ? L.join(' ∧ ') : '⊤'; };
  const nlit = (c) => NV.length - bits(c.x);

  const F4 = {
    a: ['p ∨ (q ∧ r)', (v) => v.p || (v.q && v.r)],
    b: ['(p ∧ q) ∨ (r ∧ s)', (v) => (v.p && v.q) || (v.r && v.s)],
    c: ['paridad de p, q, r, s', (v) => (v.p + v.q + v.r + v.s) % 2 === 1],
    d: ['al menos tres V', (v) => v.p + v.q + v.r + v.s >= 3],
    e: ['(p → q) ∧ (r → s)', (v) => (!v.p || v.q) && (!v.r || v.s)],
  };

  function montarMinimizacion(cuerpo) {
    let f = Array(16).fill(false), geo = null;
    const poner = (k) => { D.valuaciones(NV).forEach((v, i) => { f[(15 - i)] = !!F4[k][1](v); }); };
    poner('b');
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Función', opciones: Object.entries(F4).map(([k, v]) => [k, v[0]]), valor: 'b', alCambiar: (k) => { poner(k); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(240, w * 0.6) });
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'el mapa vale V en esa celda', forma: 'cuadro' }, { color: C.neutro, borde: C.eje, texto: 'vale F', forma: 'cuadro' }, { color: C.s1, texto: 'puntos de colores: términos de la forma mínima que cubren la celda', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Mapa de Karnaugh de 4 variables (filas pq y columnas rs en código Gray: celdas vecinas difieren en una variable). Haga clic en una celda para cambiarla. Los grupos de 1, 2, 4 u 8 celdas vecinas son términos más cortos.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const min = [...Array(16).keys()].filter((m) => f[m]);
      const { elegidos } = min.length && min.length < 16 ? cobertura(min) : { elegidos: min.length ? [{ v: 0, x: 15 }] : [] };
      const cs = Math.min((W - 80) / 4, (H - 50) / 4, 56), ox = (W - 4 * cs) / 2 + 20, oy = 34;
      geo = { cs, ox, oy };
      ctx.font = VIZ.fuente(11, 500);
      GRAY.forEach((g, i) => {
        D.texto2(ctx, `${g >> 1}${g & 1}`, ox + i * cs + cs / 2, oy - 12, { color: C.tinta2, px: 11 });
        D.texto2(ctx, `${g >> 1}${g & 1}`, ox - 14, oy + i * cs + cs / 2, { color: C.tinta2, px: 11 });
      });
      D.texto2(ctx, 'rs', ox + 2 * cs, oy - 26, { color: C.apagado, px: 10.5 });
      D.texto2(ctx, 'pq', ox - 34, oy + 2 * cs, { color: C.apagado, px: 10.5 });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const m = (GRAY[r] << 2) | GRAY[c], x = ox + c * cs, y = oy + r * cs;
        D.caja(ctx, x + 1, y + 1, cs - 2, cs - 2, f[m] ? 'V' : 'F', { relleno: f[m] ? C.s6 : C.neutro, borde: f[m] ? C.s6 : C.eje, tinta: f[m] ? C.sobre : C.apagado, radio: 3, fuente: VIZ.fuente(13, 600) });
        elegidos.forEach((e, k) => { if (f[m] && cubre(e, m)) { ctx.beginPath(); ctx.arc(x + 9 + k * 9, y + cs - 9, 3.5, 0, 7); ctx.fillStyle = VIZ.series[k % 8]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = C.superficie; ctx.stroke(); } });
      }
      fichas.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'términos mínimos:'), ...(elegidos.length ? elegidos.map((e, k) => VIZ.ficha(txtCubo(e), { color: VIZ.series[k % 8] })) : [VIZ.el('span', { class: 'fichas-vacio' }, '⊥ (función siempre falsa)')]));
      const canon = min.length * 4, mini = elegidos.reduce((s, e) => s + nlit(e), 0);
      registro.textContent = `DNF canónica: ${min.length} términos de 4 literales = ${canon} literales.\nDNF mínima:   ${elegidos.length} término${elegidos.length === 1 ? '' : 's'}, ${mini} literales${elegidos.length ? '  →  ' + elegidos.map(txtCubo).map((t) => (elegidos.length > 1 ? `(${t})` : t)).join(' ∨ ') : ''}`;
      lectura.set([['filas verdaderas', `${min.length} de 16`], ['literales (canónica)', String(canon)], ['literales (mínima)', String(mini)], ['ahorro', canon ? `${Math.round((1 - mini / canon) * 100)} %` : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.ox) / geo.cs), r = Math.floor((y - geo.oy) / geo.cs);
      if (c < 0 || c > 3 || r < 0 || r > 3) return;
      const m = (GRAY[r] << 2) | GRAY[c];
      f[m] = !f[m]; dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('truth-table-normal-forms', {
    intro: String.raw`
      <p>La tabla de verdad de una función dice todo sobre ella, y de la tabla se lee directamente una fórmula. Cada fila donde la función vale V da un <strong>término</strong> que solo se cumple en esa fila;
      la disyunción de todos ellos es la <strong>forma normal disyuntiva canónica</strong>. Dualmente, cada fila donde vale F da una <strong>cláusula</strong> que solo se incumple en esa fila, y su conjunción es la CNF canónica.</p>
      <p>Las formas canónicas son correctas pero grandes. Agrupar términos vecinos permite obtener fórmulas equivalentes mucho más cortas.</p>`,
    visualizaciones: [
      {
        titulo: 'De la tabla a la fórmula',
        descripcion: 'Defina una función haciendo clic en las filas de la columna f y lea sus formas normales canónicas. Compruebe que la fórmula reproduce la tabla.',
        montar: montarTabla,
      },
      {
        titulo: 'Forma mínima con un mapa de Karnaugh',
        descripcion: 'Mire cuántos literales ahorra una DNF mínima respecto de la canónica. Cambie celdas del mapa y observe qué grupos aparecen.',
        montar: montarMinimizacion,
      },
    ],
    teoria: String.raw`
      <h2>Construcción</h2>
      <p>Dada \(f(p_1, \dots, p_n)\) con tabla de verdad conocida, para cada fila \(\sigma\) con \(f(\sigma) = 1\) se define el <em>minitérmino</em>
      \(m_\sigma = \bigwedge_i \ell_i\), con \(\ell_i = p_i\) si \(\sigma_i = 1\) y \(\ell_i = \neg p_i\) en otro caso. Solo \(\sigma\) lo hace verdadero. Entonces
      \[ f \;\equiv\; \bigvee_{\sigma:\, f(\sigma)=1} m_\sigma \qquad\text{(DNF canónica)}, \qquad f \;\equiv\; \bigwedge_{\sigma:\, f(\sigma)=0} \neg m_\sigma \qquad\text{(CNF canónica)}. \]
      La segunda es la primera aplicada a \(\neg f\), con De Morgan. Esto prueba que \(\{\neg,\land,\lor\}\) es <a href="tema.html?id=functional-completeness">funcionalmente completo</a>.</p>
      <h2>Formas mínimas</h2>
      <p>Cuando dos términos difieren en una sola variable, \(A \land p \;\lor\; A \land \neg p \equiv A\): se agrupan y desaparece una variable. El método de Quine–McCluskey repite esa fusión hasta obtener los <em>implicantes primos</em>, y luego elige un
      subconjunto que cubra todas las filas verdaderas. El mapa de Karnaugh hace visible la fusión: las celdas vecinas (en código Gray) difieren en una variable.</p>
      <h2>Tamaño</h2>
      <p>La forma canónica tiene \(n\) literales por término, hasta \(2^{n-1}\) términos. Hay funciones, como la paridad, cuya DNF mínima sigue teniendo \(2^{n-1}\) términos: no hay nada que agrupar. Por eso conviene
      <a href="tema.html?id=cnf-dnf">no transformar a forma normal sin necesidad</a>; el problema de minimizar es NP-difícil.</p>`,
  });
})();
