(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;
  const J = B.JERARQUIAS;
  const CIS = ['cp', 'edad', 'sexo'];
  const DIAGS = ['Gripe', 'Diabetes', 'Cáncer', 'Hepatitis', 'VIH'];

  function controlesNiveles(ctl, niveles, alCambiar) {
    for (const a of CIS) ctl.rango({ etiqueta: `Nivel de ${a}`, min: 0, max: J[a].niveles - 1, valor: niveles[a], formato: (v) => J[a].nombres[v], alCambiar: (v) => { niveles[a] = v; alCambiar(); } });
  }
  function porClase(T) {
    return B.clases(T, CIS).map((c) => {
      const cuenta = new Map();
      c.indices.forEach((i) => cuenta.set(T.filas[i].diagnostico, (cuenta.get(T.filas[i].diagnostico) || 0) + 1));
      const n = c.indices.length;
      const H = -[...cuenta.values()].reduce((s, x) => s + (x / n) * Math.log(x / n), 0);
      return { ...c, cuenta, n, distinta: cuenta.size, entropica: Math.exp(H) };
    });
  }

  /* ---------- Fig. 1: l-diversidad distinta y entrópica ---------- */

  function montarL(cuerpo) {
    const R = B.clinicos();
    const niveles = { cp: 2, edad: 2, sexo: 0 };
    let l = 2;
    const ctl = VIZ.controles(cuerpo);
    controlesNiveles(ctl, niveles, () => dibujar());
    ctl.rango({ etiqueta: 'l objetivo', min: 2, max: 4, valor: l, alCambiar: (v) => { l = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 34 + 30 * Math.max(1, porClase(B.anonimizar(R, niveles)).length) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, DIAGS.map((d, i) => ({ color: VIZ.series[i], texto: d })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila del gráfico es una clase de equivalencia y sus colores, los diagnósticos que contiene. Las clases marcadas ✗ no tienen l valores distintos.');
    let geo = [];
    // Redimensionar el lienzo (su alto depende del número de clases) vuelve a pintar.
    const dibujar = () => lienzo.ajustar(true);
    function pintar() {
      const T = B.anonimizar(R, niveles);
      const cl = porClase(T);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const angosto = W < 560, izq = angosto ? 10 : 200, der = 116, fh = 30;
      const maxN = Math.max(...cl.map((c) => c.n));
      geo = [];
      cl.forEach((c, i) => {
        const y = 24 + i * fh;
        if (!angosto) B.texto(ctx, c.clave, izq - 10, y + fh / 2, { alinear: 'right', px: 11, color: C.tinta });
        let x = izq;
        const u = (W - izq - der) / maxN;
        DIAGS.forEach((d, j) => {
          const n = c.cuenta.get(d) || 0;
          if (!n) return;
          ctx.fillStyle = VIZ.series[j];
          ctx.fillRect(x, y + (angosto ? 12 : 5), n * u - 2, fh - (angosto ? 14 : 10));
          x += n * u;
        });
        if (angosto) B.texto(ctx, c.clave, izq, y + 5, { px: 10, color: C.tinta });
        const ok = c.distinta >= l;
        B.texto(ctx, `${ok ? '✓' : '✗'} ${c.distinta} · ${VIZ.fmt(c.entropica, 2)}`, W - der + 8, y + fh / 2 + (angosto ? 4 : 0), { px: 11, color: ok ? C.s6 : C.s8, peso: 500 });
        geo.push({ y, h: fh, c });
      });
      B.texto(ctx, 'l distinta · entróp.', W - der + 8, 10, { px: 10, color: C.apagado });
      const lD = Math.min(...cl.map((c) => c.distinta)), lE = Math.min(...cl.map((c) => c.entropica));
      const k = Math.min(...cl.map((c) => c.n));
      registro.textContent = lD >= l
        ? `La tabla es ${lD}-diversa: en cada clase hay al menos ${lD} diagnósticos distintos.`
        : `No es ${l}-diversa: ${cl.filter((c) => c.distinta < l).length} clases tienen menos de ${l} diagnósticos distintos${cl.some((c) => c.distinta === 1) ? ' (alguna es homogénea: revela el diagnóstico)' : ''}.`;
      lectura.set([
        ['k', String(k)],
        ['l distinta', String(lD)],
        ['l entrópica', VIZ.fmt(lE, 3)],
        ['clases', String(cl.length)],
      ]);
    }
    lienzo.alDibujar = pintar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => y >= q.y && y < q.y + q.h);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.c.clave}</b> · ${g.c.n} filas` + DIAGS.filter((d) => g.c.cuenta.get(d)).map((d) => VIZ.filaTooltip(VIZ.series[DIAGS.indexOf(d)], d, g.c.cuenta.get(d))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: t-cercanía ---------- */

  function montarT(cuerpo) {
    const R = B.clinicos();
    const niveles = { cp: 2, edad: 3, sexo: 1 };
    let elegida = 0;
    const ctl = VIZ.controles(cuerpo);
    controlesNiveles(ctl, niveles, () => { elegida = 0; dibujar(); });
    const sel = ctl.selector({ etiqueta: 'Clase', valor: '0', opciones: [['0', '—']], alCambiar: (v) => { elegida = +v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 230, altoMax: 300 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.apagado, texto: 'distribución en toda la tabla' },
      { color: C.s1, texto: 'distribución en la clase elegida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una clase puede ser 2-diversa y aun así tener 3 veces más cáncer que la tabla completa: eso es lo que mide t.');
    let geo = [];
    function dibujar() {
      const T = B.anonimizar(R, niveles);
      const cl = porClase(T);
      sel.select.replaceChildren(...cl.map((c, i) => VIZ.el('option', { value: String(i) }, `${c.clave} (${c.n})`)));
      elegida = Math.min(elegida, cl.length - 1); sel.valor = String(elegida);
      const glob = DIAGS.map((d) => R.filas.filter((f) => f.diagnostico === d).length / R.filas.length);
      const dist = (c) => DIAGS.map((d) => (c.cuenta.get(d) || 0) / c.n);
      // Distancia de variación total (= EMD con distancia 1 entre categorías distintas).
      const tv = (p) => 0.5 * p.reduce((s, v, i) => s + Math.abs(v - glob[i]), 0);
      const c = cl[elegida], p = dist(c);
      const { ctx } = lienzo;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: DIAGS.length, ymin: 0, ymax: 1 }, { etiquetaY: 'proporción', ticksX: [], formatoY: (v) => `${Math.round(100 * v)} %` });
      plano.ejes();
      geo = [];
      const g = plano.sx(1) - plano.sx(0), w = g * 0.32;
      DIAGS.forEach((d, i) => {
        const x = plano.sx(i) + g * 0.16;
        ctx.fillStyle = C.apagado; ctx.beginPath(); ctx.roundRect(x, plano.sy(glob[i]), w, plano.y0 - plano.sy(glob[i]), [4, 4, 0, 0]); ctx.fill();
        ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x + w + 2, plano.sy(p[i]), w, plano.y0 - plano.sy(p[i]), [4, 4, 0, 0]); ctx.fill();
        B.texto(ctx, d, plano.sx(i + 0.5), plano.y0 + 12, { alinear: 'center', px: 11 });
        geo.push({ x0: plano.sx(i), x1: plano.sx(i + 1), d, g: glob[i], p: p[i] });
      });
      const ts = cl.map((q) => tv(dist(q)));
      registro.textContent = `Clase ${c.clave}: distancia a la distribución global t = ${VIZ.fmt(ts[elegida], 3)}. La tabla es t-cercana con t = ${VIZ.fmt(Math.max(...ts), 3)} (el máximo sobre las clases).`;
      lectura.set([
        ['t de la clase', VIZ.fmt(ts[elegida], 3)],
        ['t de la tabla', VIZ.fmt(Math.max(...ts), 3)],
        ['l distinta de la clase', String(c.distinta)],
        ['clases', String(cl.length)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const q = geo.find((z) => x >= z.x0 && x < z.x1);
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, `<b>${q.d}</b>` + VIZ.filaTooltip(C.apagado, 'tabla', `${Math.round(100 * q.g)} %`) + VIZ.filaTooltip(C.s1, 'clase', `${Math.round(100 * q.p)} %`));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('l-diversidad', {
    intro: String.raw`
      <p>El <a href="tema.html?id=k-anonimato">k-anonimato</a> esconde a la persona entre \(k\) filas, pero si todas tienen el mismo
      diagnóstico, esconderse no sirve. La <strong>l-diversidad</strong> (Machanavajjhala y colegas, 2006) exige además que en cada clase de
      equivalencia el atributo sensible tome al menos \(l\) valores «bien representados».</p>
      <p>Tampoco basta siempre. Si en la población hay 10 % de cáncer y en una clase hay 50 %, el atacante aprendió mucho aunque la clase
      tenga cuatro diagnósticos distintos. La <strong>t-cercanía</strong> pide que la distribución en cada clase se parezca a la global.</p>`,
    visualizaciones: [
      {
        titulo: 'l-diversidad por clase',
        descripcion: 'Diagnósticos dentro de cada clase de equivalencia, con su l distinta y su l entrópica. Busque niveles de generalización que hagan la tabla 2-diversa y luego 3-diversa.',
        montar: montarL,
      },
      {
        titulo: 't-cercanía',
        descripcion: 'Compare la distribución de diagnósticos de una clase con la de toda la tabla. La distancia entre ambas es el t de la clase.',
        montar: montarT,
      },
    ],
    teoria: String.raw`
      <h2>l-diversidad</h2>
      <p>Para una clase \(E\) con proporciones \(p(E, s)\) de cada valor sensible \(s\):</p>
      <ul>
        <li><strong>Distinta</strong>: \(E\) contiene al menos \(l\) valores distintos.</li>
        <li><strong>Entrópica</strong>: \(H(E) = -\sum_s p(E,s)\log p(E,s) \ge \log l\), es decir \(e^{H(E)} \ge l\). Castiga las clases
        donde un valor domina.</li>
        <li><strong>Recursiva \((c, l)\)</strong>: con las frecuencias ordenadas \(r_1 \ge r_2 \ge \dots\), exige \(r_1 &lt; c\,(r_l + r_{l+1} + \cdots)\).</li>
      </ul>
      <p>Una tabla es l-diversa si todas sus clases lo son. Como la entropía de una mezcla es al menos la mínima de las partes, la
      l-diversidad entrópica también es monótona y se busca en el mismo <a href="tema.html?id=anonimizacion">retículo</a>.</p>
      <div class="recuadro">l-diversidad no considera el <em>significado</em> de los valores: una clase con «úlcera gástrica, gastritis,
      cáncer de estómago» es 3-diversa, pero revela que la persona tiene un problema estomacal (ataque de similitud). Y con un atributo muy
      desbalanceado (1 % VIH) puede ser imposible de lograr sin destruir la tabla.</div>

      <h2>t-cercanía</h2>
      <p>Li, Li y Venkatasubramanian (2007): una clase es t-cercana si la distancia entre su distribución \(P_E\) y la distribución global
      \(Q\) del atributo sensible es a lo más \(t\):</p>
      \[ D(P_E, Q) \le t. \]
      <p>La distancia propuesta es la <strong>EMD</strong> (<em>earth mover's distance</em>). Para un atributo categórico con distancia 1 entre
      valores distintos, la EMD es la distancia de variación total, \(\tfrac12 \sum_s |p_E(s) - q(s)|\), que es la que usa la figura. Para
      atributos ordenados (salarios), la distancia entre valores es su diferencia de posición y la EMD tiene en cuenta cuán lejos están.</p>
      <p>El precio es la utilidad: con \(t\) pequeño, ninguna clase puede tener correlación entre los cuasi-identificadores y el atributo
      sensible, que suele ser justo lo que el análisis quiere estudiar.</p>`,
  });
})();
