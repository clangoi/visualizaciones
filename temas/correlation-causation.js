(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: una causa común ---------- */

  function montarConfusor(cuerpo) {
    let aZX = 0.8, aZY = 0.8, efecto = 0, azar = false, semilla = 1, D = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Calor → helados', min: 0, max: 1.5, paso: 0.05, valor: aZX, formato: (v) => v.toFixed(2), alCambiar: (v) => { aZX = v; generar(); } });
    ctl.rango({ etiqueta: 'Calor → ahogamientos', min: 0, max: 1.5, paso: 0.05, valor: aZY, formato: (v) => v.toFixed(2), alCambiar: (v) => { aZY = v; generar(); } });
    ctl.rango({ etiqueta: 'Efecto real helados → ahogamientos', min: -0.5, max: 0.5, paso: 0.05, valor: efecto, formato: (v) => v.toFixed(2), alCambiar: (v) => { efecto = v; generar(); } });
    ctl.casilla({ etiqueta: 'asignar los helados al azar (experimento)', valor: azar, alCambiar: (v) => { azar = v; generar(); } });
    ctl.boton('Nuevos datos', () => { semilla++; generar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.3) : Math.min(400, Math.round(w * 0.42))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'día frío', forma: 'punto' },
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'día caluroso', forma: 'punto' },
      { color: C.s2, texto: 'pendiente observada', forma: 'linea' },
      { color: C.s6, texto: 'efecto causal real', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con el efecto real en 0, helados y ahogamientos están correlacionados solo porque ambos suben con el calor. Si los helados se asignan al azar (la flecha calor → helados se corta), la pendiente cae al efecto real.');
    const G = M.dag([['Z', 0.5, 0.12], ['X', 0.15, 0.85], ['Y', 0.85, 0.85]], [[0, 1], [0, 2], [1, 2]]);
    function generar() {
      const coef = { '0,1': azar ? 0 : aZX, '0,2': aZY, '1,2': efecto };
      D = M.simularSCM(G, coef, 400, semilla);
      dibujar();
    }
    let pl = null, ox = 0, oy = 0;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wG = vertical ? W : W * 0.32, hG = vertical ? H * 0.32 : H;
      VIZ.grafo.dibujar({ ...lienzo, ancho: wG, alto: hG, ctx }, G, {
        arista: (a) => (a.u === 0 && a.v === 1 && azar ? { color: C.tenue, guiones: [4, 4] } : a.u === 1 ? { color: Math.abs(efecto) > 0 ? C.s6 : C.tenue, ancho: 2, guiones: efecto ? null : [3, 3] } : { color: C.apagado, ancho: 1.5 + Math.max(aZX, aZY) }),
        debajo: (i) => ['calor', azar ? 'helados (azar)' : 'helados', 'ahogamientos'][i],
      });
      ox = vertical ? 0 : wG; oy = vertical ? hG : 0;
      ctx.save(); ctx.translate(ox, oy);
      const sub = { ...lienzo, ancho: W - ox, alto: H - oy, ctx };
      pl = VIZ.plano(sub, { xmin: -4, xmax: 4, ymin: -4.5, ymax: 4.5 }, { etiquetaX: 'consumo de helados (estandarizado)', etiquetaY: 'ahogamientos', margen: { izq: 40 } });
      pl.ejes();
      const zs = D.map((d) => d[0]), zl = M.cuantil(zs, 0.02), zh = M.cuantil(zs, 0.98);
      M.dispersion(ctx, pl, D.map((d) => ({ x: d[1], y: d[2], z: d[0] })), { color: (p) => VIZ.css(VIZ.enRampa(0.1 + 0.9 * Math.min(1, Math.max(0, (p.z - zl) / (zh - zl))))), r: 2.6 });
      const b = M.regresion(D, 2, [1]);
      ctx.save(); pl.recortar();
      VIZ.trazar(ctx, pl, [[-4, b[0] - 4 * b[1]], [4, b[0] + 4 * b[1]]], C.s2, 2.5);
      VIZ.trazar(ctx, pl, [[-4, b[0] - 4 * efecto], [4, b[0] + 4 * efecto]], C.s6, 2, [5, 4]);
      ctx.restore(); ctx.restore();
      const bz = M.regresion(D, 2, [1, 0]);
      lectura.set([
        ['correlación helados–ahogamientos', VIZ.fmt(M.correlacion(D.map((d) => d[1]), D.map((d) => d[2])), 3)],
        ['pendiente observada', VIZ.fmt(b[1], 3)],
        ['pendiente controlando por el calor', VIZ.fmt(bz[1], 3)],
        ['efecto causal real', VIZ.fmt(efecto, 3)],
      ]);
    }
    lienzo.alDibujar = () => D.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x - ox, y - oy)) return tip.ocultar();
      tip.mostrar(x, y, `helados <b>${VIZ.fmt(pl.ix(x - ox), 2)}</b><br>ahogamientos según la recta <b>${VIZ.fmt((() => { const b = M.regresion(D, 2, [1]); return b[0] + b[1] * pl.ix(x - ox); })(), 2)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    generar();
  }

  /* ---------- Fig. 2: la paradoja de Simpson ---------- */

  function montarSimpson(cuerpo) {
    let sesgo = 0.8, ventaja = 0.05;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Fracción de casos graves que recibe A', min: 0.2, max: 0.95, paso: 0.05, valor: sesgo, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { sesgo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ventaja real de A en cada grupo', min: -0.1, max: 0.15, paso: 0.01, valor: ventaja, formato: (v) => `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} pts`, alCambiar: (v) => { ventaja = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'tratamiento A' }, { color: C.s2, texto: 'tratamiento B' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, '1.000 pacientes: 500 leves y 500 graves. Los casos graves se recuperan menos con cualquier tratamiento. Si A se da sobre todo a los graves, A gana en cada grupo y aun así pierde en el total.');
    let barras = [];
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const base = { leve: 0.85, grave: 0.55 };
      const nA = { leve: Math.round(500 * (1 - sesgo)), grave: Math.round(500 * sesgo) }, nB = { leve: 500 - nA.leve, grave: 500 - nA.grave };
      const tasa = (g, t) => base[g] + (t === 'A' ? ventaja : 0);
      const tot = (t, n) => (n.leve * tasa('leve', t) + n.grave * tasa('grave', t)) / (n.leve + n.grave);
      const grupos = [['leves', tasa('leve', 'A'), tasa('leve', 'B'), nA.leve, nB.leve], ['graves', tasa('grave', 'A'), tasa('grave', 'B'), nA.grave, nB.grave], ['todos', tot('A', nA), tot('B', nB), nA.leve + nA.grave, nB.leve + nB.grave]];
      const pl = VIZ.plano(lienzo, { xmin: -0.5, xmax: 2.5, ymin: 0, ymax: 1 }, { etiquetaY: 'tasa de recuperación', ticksX: [0, 1, 2], formatoX: (v) => (grupos[v] || [''])[0], formatoY: (v) => `${Math.round(v * 100)}%` });
      pl.ejes();
      const bw = (pl.sx(1) - pl.sx(0)) * 0.3;
      barras = [];
      grupos.forEach(([g, a, b, na, nb], i) => [[a, C.s1, 'A', na], [b, C.s2, 'B', nb]].forEach(([v, col, t, n], j) => {
        const x = pl.sx(i) - bw + j * bw;
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x + 1, pl.sy(v), bw - 2, pl.y0 - pl.sy(v), [4, 4, 0, 0]); ctx.fill();
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`${Math.round(v * 100)}%`, x + bw / 2, pl.sy(v) + 4);
        barras.push({ x0: x, x1: x + bw, g, t, v, n });
      }));
      const [, ta, tb] = grupos[2];
      lectura.set([
        ['A en cada grupo', ventaja >= 0 ? 'mejor' : 'peor'],
        ['A en el total', ta > tb ? 'mejor' : ta < tb ? 'peor' : 'igual'],
        ['diferencia total A − B', `${VIZ.fmt((ta - tb) * 100, 3)} pts`],
        ['efecto ajustado por gravedad', `${VIZ.fmt(ventaja * 100, 3)} pts`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), b = barras.find((q) => x >= q.x0 && x <= q.x1);
      if (!b) return tip.ocultar();
      tip.mostrar(x, y, `${b.g}, tratamiento <b>${b.t}</b><br>${b.n} pacientes, recuperación <b>${M.pct(b.v)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('correlation-causation', {
    intro: String.raw`
      <p>Que dos variables estén correlacionadas no dice que una cause la otra. Las ventas de helados y los ahogamientos suben y
      bajan juntos, pero prohibir los helados no salvaría a nadie: ambos dependen del calor, una <strong>variable de confusión</strong>.</p>
      <p>Distinguir asociación de causalidad exige un <strong>modelo causal</strong>: supuestos explícitos sobre qué causa qué. Con él se
      puede decidir qué comparar y qué ajustar, y saber cuándo los datos observacionales bastan y cuándo hace falta un experimento.</p>`,
    visualizaciones: [
      {
        titulo: 'Una causa común',
        descripcion: 'El calor causa helados y ahogamientos. Compare la pendiente observada con el efecto real, y vea qué pasa al controlar por el calor o al aleatorizar.',
        montar: montarConfusor,
      },
      {
        titulo: 'La paradoja de Simpson',
        descripcion: 'Un tratamiento mejor en cada subgrupo que parece peor en el total. Mueva la asignación de tratamientos según gravedad.',
        montar: montarSimpson,
      },
    ],
    teoria: String.raw`
      <h2>Asociación frente a causalidad</h2>
      <p>La asociación es una propiedad de la distribución observada, \(P(Y \mid X)\). La causalidad pregunta qué pasaría si se
      <em>interviniera</em> \(X\): \(P(Y \mid \operatorname{do}(X = x))\) (ver el <a href="tema.html?id=do-operator">operador do</a>). Las dos coinciden
      solo si no hay caminos no causales entre \(X\) e \(Y\).</p>
      <h2>Fuentes de asociación sin causa</h2>
      <ul>
        <li><strong>Confusión</strong>: una causa común \(X \leftarrow Z \to Y\).</li>
        <li><strong>Causalidad inversa</strong>: \(Y \to X\).</li>
        <li><strong>Sesgo de selección</strong>: condicionar en un efecto común \(X \to S \leftarrow Y\) (ver <a href="tema.html?id=conditional-independence">independencia condicional</a>).</li>
        <li><strong>Azar</strong>: con muchas variables, algunas correlaciones grandes aparecen por casualidad.</li>
      </ul>
      <h2>Paradoja de Simpson</h2>
      <p>Una asociación puede invertir su signo al desagregar por una tercera variable. Con \(Z\) = gravedad:</p>
      \[ P(Y \mid X) = \sum_z P(Y \mid X, z)\,P(z \mid X), \]
      <p>y si \(P(z \mid X)\) depende mucho de \(X\) (A se da a los graves), el promedio ponderado favorece a B aunque \(P(Y \mid A, z) &gt; P(Y \mid B, z)\)
      en cada \(z\). ¿Cuál cifra es la correcta? Depende del grafo: si la gravedad causa la elección del tratamiento, hay que ajustar
      (<a href="tema.html?id=backdoor-frontdoor">criterio back-door</a>); si el tratamiento afectara la gravedad, no.</p>
      <h2>Experimentos</h2>
      <div class="recuadro"><p>Asignar \(X\) al azar corta todas las flechas que entran en \(X\): ninguna causa común puede influir en quién recibe qué.
      Por eso en un experimento aleatorizado \(P(Y \mid X) = P(Y \mid \operatorname{do}(X))\), y la diferencia de medias estima el efecto causal promedio.</p></div>`,
  });
})();