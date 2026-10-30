(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  const G = M.dag([['Z₁', 0.1, 0.1], ['Z₂', 0.9, 0.1], ['Z₃', 0.5, 0.38], ['X', 0.12, 0.85], ['W', 0.5, 0.85], ['Y', 0.88, 0.85]],
    [[0, 2], [1, 2], [0, 3], [1, 5], [2, 3], [2, 5], [3, 4], [4, 5]]);
  const COEF = { '0,2': 0.9, '1,2': 0.9, '0,3': 0.8, '1,5': 0.8, '2,3': 0.7, '2,5': 0.7, '3,4': 0.8, '4,5': 0.75 };
  const L = G.nodos.map((n) => n.etiqueta), X = 3, Y = 5, VERDAD = 0.8 * 0.75;
  function textoCamino(cam) { let t = L[cam[0]]; for (let k = 1; k < cam.length; k++) t += (M.flecha(G, cam[k - 1], cam[k]) ? ' → ' : ' ← ') + L[cam[k]]; return t; }

  /* ---------- Fig. 1: elegir el conjunto de ajuste ---------- */

  function montarBackdoor(cuerpo) {
    let Z = new Set([2]), n = 4000, semilla = 1, D = M.simularSCM(G, COEF, n, semilla);
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Ajustar por {Z₁, Z₃}', () => { Z = new Set([0, 2]); dibujar(); }, { primario: true });
    ctl.boton('Solo {Z₃}', () => { Z = new Set([2]); dibujar(); });
    ctl.boton('Nada', () => { Z = new Set(); dibujar(); });
    ctl.boton('Nuevos datos', () => { semilla++; D = M.simularSCM(G, COEF, n, semilla); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 360 });
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'en el conjunto de ajuste', forma: 'punto' },
      { color: C.s2, texto: 'camino back-door abierto', forma: 'linea' },
      { color: C.s8, texto: 'ajuste inválido (descendiente de X)', forma: 'linea' },
      { color: C.s1, texto: 'camino causal X → W → Y', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en Z₁, Z₂, Z₃ o W para agregarlos o quitarlos del conjunto de ajuste. Ajustar solo por Z₃ bloquea X ← Z₃ → Y pero abre X ← Z₁ → Z₃ ← Z₂ → Y (Z₃ es un collider). Ajustar por W, un mediador, borra el efecto que se quiere medir.');
    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      const zs = [...Z], cams = M.caminos(G, X, Y), puerta = cams.filter((c) => M.flecha(G, c[1], X));
      const desc = M.descendientes(G, X), invalidos = zs.filter((z) => desc.has(z));
      const res = puerta.map((c) => ({ c, b: M.bloqueo(G, c, zs) }));
      const abiertas = new Set();
      res.forEach(({ c, b }) => { if (!b.bloqueado) for (let k = 1; k < c.length; k++) abiertas.add(`${Math.min(c[k - 1], c[k])},${Math.max(c[k - 1], c[k])}`); });
      geo = VIZ.grafo.dibujar(lienzo, G, {
        nodo: (i) => (Z.has(i) ? { relleno: desc.has(i) ? C.s8 : C.s4, borde: desc.has(i) ? C.s8 : C.s4, texto: C.sobre } : i === X || i === Y ? { borde: C.tinta, anillo: C.tinta } : {}),
        arista: (a) => (abiertas.has(`${Math.min(a.u, a.v)},${Math.max(a.u, a.v)}`) ? { color: C.s2, ancho: 3.5 } : (a.u === X || a.u === 4) && (a.v === 4 || a.v === Y) ? { color: C.s1, ancho: 3 } : { color: C.apagado, ancho: 1.5 }),
      });
      lista.replaceChildren(...res.map(({ c, b }) => VIZ.el('div', null,
        VIZ.el('span', { style: { color: b.bloqueado ? C.apagado : C.s2 } }, textoCamino(c)),
        `   ${b.bloqueado ? `bloqueado en ${L[b.en]}` : 'abierto'}`)));
      const valido = !invalidos.length && res.every((r) => r.b.bloqueado);
      const est = M.regresion(D, Y, [X, ...zs])[1];
      registro.textContent = invalidos.length ? `Inválido: ${invalidos.map((i) => L[i]).join(', ')} es descendiente de X.`
        : valido ? `{${zs.map((i) => L[i]).join(', ')}} cumple el criterio back-door: P(y | do(x)) = Σ_z P(y | x, z) P(z).`
          : `{${zs.map((i) => L[i]).join(', ') || '∅'}} deja ${res.filter((r) => !r.b.bloqueado).length} camino(s) back-door abierto(s): el ajuste está sesgado.`;
      lectura.set([
        ['¿criterio back-door?', valido ? 'sí' : 'no'],
        ['coeficiente de X ajustando por el conjunto', VIZ.fmt(est, 3)],
        ['efecto causal real', VIZ.fmt(VERDAD, 3)],
        ['sesgo', VIZ.fmt(est - VERDAD, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (e) => {
      const { x, y } = lienzo.posicion(e), i = VIZ.grafo.nodoEn(geo, x, y);
      if (i < 0 || i === X || i === Y) return;
      if (Z.has(i)) Z.delete(i); else Z.add(i);
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: el criterio front-door ---------- */

  function montarFrontdoor(cuerpo) {
    let conf = 1, n = 2000, semilla = 1, res = null, barras = [];
    const F = M.dag([['U', 0.5, 0.1], ['X', 0.1, 0.8], ['M', 0.5, 0.8], ['Y', 0.9, 0.8]], [[0, 1], [0, 3], [1, 2], [2, 3]]);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Confusión oculta U', min: 0, max: 1.5, paso: 0.05, valor: conf, formato: (v) => v.toFixed(2), alCambiar: (v) => { conf = v; calcular(); } });
    ctl.rango({ etiqueta: 'Muestra n', min: 100, max: 5000, paso: 100, valor: n, alCambiar: (v) => { n = v; }, alSoltar: () => calcular() });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 620 ? Math.round(w * 1.15) : Math.min(340, Math.round(w * 0.36))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'regresión ingenua Y ~ X', forma: 'cuadro' },
      { color: C.s1, texto: 'front-door (a través de M)', forma: 'cuadro' },
      { color: C.inactivo, texto: 'ajuste por U (imposible: U no se observa)', forma: 'cuadro' },
      { color: C.s6, texto: 'efecto real', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'U (por ejemplo, genética) causa X (fumar) e Y (cáncer) y no se mide, así que no hay ajuste back-door posible. Pero todo el efecto de X pasa por M (alquitrán), y M no tiene confusión con X: el efecto se recupera en dos etapas.');
    function calcular() {
      const coef = { '0,1': conf, '0,3': conf, '1,2': 0.9, '2,3': 0.6 };
      const D = M.simularSCM(F, coef, n, semilla);
      const ingenuo = M.regresion(D, 3, [1])[1], xm = M.regresion(D, 2, [1])[1], my = M.regresion(D, 3, [2, 1])[1], conU = M.regresion(D, 3, [1, 0])[1];
      res = { ingenuo, frente: xm * my, conU, verdad: 0.9 * 0.6, xm, my };
      dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const vertical = W < 620, wG = vertical ? W : W * 0.34, hG = vertical ? H * 0.32 : H;
      VIZ.grafo.dibujar({ ...lienzo, ancho: wG, alto: hG, ctx }, F, {
        nodo: (i) => (i === 0 ? { borde: C.inactivo, texto: C.apagado } : {}),
        arista: (a) => (a.u === 0 ? { color: C.inactivo, guiones: [4, 4], ancho: 1 + conf } : { color: C.s1, ancho: 2.5 }),
        debajo: (i) => ['no observada', 'fumar', 'alquitrán', 'cáncer'][i],
      });
      ctx.save();
      const ox = vertical ? 0 : wG, oy = vertical ? hG : 0;
      ctx.translate(ox, oy);
      const vals = [res.ingenuo, res.frente, res.conU, res.verdad];
      const pl = VIZ.plano({ ...lienzo, ancho: W - ox, alto: H - oy, ctx }, { xmin: -0.5, xmax: 2.5, ymin: Math.min(0, ...vals) * 1.1, ymax: Math.max(...vals) * 1.15 }, { etiquetaY: 'efecto estimado de X en Y', ticksX: [0, 1, 2], formatoX: (v) => ['ingenuo', 'front-door', 'con U'][v] || '' });
      pl.ejes();
      const bw = (pl.sx(1) - pl.sx(0)) * 0.5;
      barras = [];
      [[res.ingenuo, C.s8, 'ingenuo'], [res.frente, C.s1, 'front-door'], [res.conU, C.inactivo, 'ajustando por U']].forEach(([v, col, t], i) => {
        const x = pl.sx(i) - bw / 2, y0 = pl.sy(0), y1 = pl.sy(v);
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, Math.min(y0, y1), bw, Math.abs(y1 - y0) || 1, [4, 4, 0, 0]); ctx.fill();
        barras.push({ x0: x + ox, x1: x + bw + ox, t, v });
      });
      VIZ.trazar(ctx, pl, [[-0.5, res.verdad], [2.5, res.verdad]], C.s6, 2, [5, 4]);
      ctx.restore();
      lectura.set([
        ['X → M estimado', VIZ.fmt(res.xm, 3)],
        ['M → Y ajustando por X', VIZ.fmt(res.my, 3)],
        ['front-door = producto', VIZ.fmt(res.frente, 3)],
        ['ingenuo · real', `${VIZ.fmt(res.ingenuo, 3)} · ${VIZ.fmt(res.verdad, 3)}`],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e), q = barras.find((r) => x >= r.x0 && x <= r.x1);
      if (!q) return tip.ocultar();
      tip.mostrar(x, y, `${q.t}: <b>${VIZ.fmt(q.v, 3)}</b><br>real: <b>${VIZ.fmt(res.verdad, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('backdoor-frontdoor', {
    intro: String.raw`
      <p>Un efecto causal está <strong>identificado</strong> si se puede calcular a partir de la distribución de las variables observadas,
      sin experimentar. Los dos criterios gráficos más usados de Pearl dicen cuándo, y con qué fórmula.</p>
      <p>El <strong>criterio back-door</strong> indica qué variables controlar para cerrar los caminos de confusión (y cuáles no tocar). El
      <strong>criterio front-door</strong> permite estimar el efecto aun con un confusor no medido, si el efecto pasa por un mediador observado.</p>`,
    visualizaciones: [
      {
        titulo: 'Elegir el conjunto de ajuste',
        descripcion: 'Elija qué variables controlar y vea qué caminos back-door quedan abiertos y cuánto sesgo tiene la estimación.',
        montar: montarBackdoor,
      },
      {
        titulo: 'El criterio front-door',
        descripcion: 'Con confusión no medida, la regresión ingenua está sesgada; el estimador front-door no. Suba la confusión.',
        montar: montarFrontdoor,
      },
    ],
    teoria: String.raw`
      <h2>Criterio back-door</h2>
      <p>Un conjunto \(Z\) satisface el criterio back-door relativo a \((X, Y)\) si</p>
      <ol>
        <li>ningún nodo de \(Z\) es descendiente de \(X\), y</li>
        <li>\(Z\) bloquea todo camino entre \(X\) e \(Y\) que empiece con una flecha que <em>entra</em> en \(X\) (camino «por la puerta trasera»).</li>
      </ol>
      <div class="recuadro"><p>Si \(Z\) satisface el criterio,</p>
      \[ P(y \mid \operatorname{do}(x)) = \sum_z P(y \mid x, z)\, P(z). \]</div>
      <p>Es la <strong>fórmula de ajuste</strong>; en el caso lineal equivale al coeficiente de \(X\) en la regresión de \(Y\) sobre \(X\) y \(Z\). La condición 1
      excluye mediadores y descendientes (colliders) de \(X\); la 2 exige cerrar todos los caminos espurios, sin abrir otros al condicionar en colliders.</p>
      <h2>Criterio front-door</h2>
      <p>\(M\) satisface el criterio front-door relativo a \((X, Y)\) si</p>
      <ol>
        <li>\(M\) intercepta todos los caminos dirigidos de \(X\) a \(Y\);</li>
        <li>no hay caminos back-door abiertos de \(X\) a \(M\);</li>
        <li>todos los caminos back-door de \(M\) a \(Y\) están bloqueados por \(X\).</li>
      </ol>
      \[ P(y \mid \operatorname{do}(x)) = \sum_m P(m \mid x) \sum_{x'} P(y \mid m, x')\, P(x'). \]
      <p>En el caso lineal, el efecto es el producto del coeficiente de \(X\) en \(M\) por el de \(M\) en \(Y\) ajustando por \(X\).</p>
      <h2>Identificación y estimandos</h2>
      <p>Identificar es pasar de un estimando causal (\(P(y \mid \operatorname{do}(x))\)) a un estimando estadístico (una fórmula con probabilidades
      observables). Después viene la estimación con datos finitos: regresión, <a href="tema.html?id=matching">matching</a>,
      <a href="tema.html?id=propensity-score">propensity scores</a>. Si ningún criterio se cumple, el <em>do-cálculo</em> de Pearl (tres reglas) es completo:
      decide si el efecto es identificable y, si lo es, produce la fórmula.</p>`,
  });
})();