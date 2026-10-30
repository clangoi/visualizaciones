(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  /* ---------- Fig. 1: permutar etiquetas ---------- */

  function montarPermutaciones(cuerpo) {
    let efecto = 0.5, n = 20, semilla = 1, A = [], B = [], obs = 0, nulos = [], etiquetas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Diferencia real entre grupos', min: 0, max: 1.5, paso: 0.05, valor: efecto, formato: (v) => v.toFixed(2), alCambiar: (v) => { efecto = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Datos por grupo', min: 5, max: 100, valor: n, alCambiar: (v) => { n = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 4 });
    ctl.boton('Nuevos datos', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 320, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'etiqueta A en esta permutación', forma: 'punto' }, { color: C.s2, texto: 'etiqueta B', forma: 'cuadro' },
      { color: C.inactivo, texto: 'diferencias bajo la hipótesis nula', forma: 'cuadro' },
      { color: C.s8, texto: 'tan o más extremas que la observada', forma: 'cuadro' },
      { color: C.tinta, texto: 'diferencia observada', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Si los grupos no difieren, las etiquetas A y B son intercambiables. Cada paso las baraja y recalcula la diferencia de medias. El p-valor es la fracción de permutaciones con una diferencia al menos tan grande (en valor absoluto) como la observada.');
    function iniciar() {
      const rnd = VIZ.semilla(semilla * 17 + n);
      A = Array.from({ length: n }, () => VIZ.normal(rnd)); B = Array.from({ length: n }, () => efecto + VIZ.normal(rnd));
      obs = M.media(B) - M.media(A); nulos = []; etiquetas = [...A.map(() => 0), ...B.map(() => 1)];
      const r2 = VIZ.semilla(semilla * 3);
      return (function* () {
        for (let k = 0; k < 2000; k++) {
          etiquetas = M.barajar(etiquetas.slice(), r2);
          const todos = [...A, ...B], a = todos.filter((_, i) => !etiquetas[i]), b = todos.filter((_, i) => etiquetas[i]);
          nulos.push(M.media(b) - M.media(a));
          yield;
        }
      })();
    }
    let ph = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const todos = [...A, ...B], hA = 70;
      const pa = VIZ.plano({ ...lienzo, alto: hA, ctx }, { xmin: Math.min(...todos) - 0.3, xmax: Math.max(...todos) + 0.3, ymin: 0, ymax: 2 }, { ticksY: [], margen: { izq: 40, sup: 4, inf: 22 } });
      pa.ejes();
      todos.forEach((v, i) => VIZ.marcador(ctx, pa.sx(v), pa.sy(etiquetas[i] ? 1.4 : 0.6), etiquetas[i] ? C.s2 : C.s1, 3.2, etiquetas[i] ? 1 : 0));
      ctx.save(); ctx.translate(0, hA + 8);
      const lim = Math.max(Math.abs(obs), ...nulos.map(Math.abs), 0.5) * 1.1, bins = 50;
      const c = new Array(bins).fill(0); nulos.forEach((v) => c[Math.min(bins - 1, Math.floor(((v + lim) / (2 * lim)) * bins))]++);
      ph = VIZ.plano({ ...lienzo, alto: H - hA - 8, ctx }, { xmin: -lim, xmax: lim, ymin: 0, ymax: Math.max(5, ...c) * 1.1 }, { etiquetaX: 'diferencia de medias B − A', etiquetaY: 'permutaciones', margen: { izq: 40 } });
      ph.ejes();
      const w = (ph.x1 - ph.x0) / bins;
      c.forEach((k, b) => {
        if (!k) return;
        const centro = -lim + ((b + 0.5) * 2 * lim) / bins, y = ph.sy(k);
        ctx.fillStyle = Math.abs(centro) >= Math.abs(obs) ? C.s8 : C.inactivo;
        ctx.beginPath(); ctx.roundRect(ph.x0 + b * w + 1, y, w - 2, ph.y0 - y, [3, 3, 0, 0]); ctx.fill();
      });
      for (const v of [obs, -obs]) VIZ.trazar(ctx, ph, [[v, 0], [v, ph.d.ymax]], C.tinta, v === obs ? 2.5 : 1.2, v === obs ? null : [3, 3]);
      ctx.restore();
      ph.oy = hA + 8;
      const extremos = nulos.filter((v) => Math.abs(v) >= Math.abs(obs)).length;
      const se = Math.sqrt(M.varianza(A) / n + M.varianza(B) / n), z = obs / se;
      registro.textContent = nulos.length ? `Permutación ${nulos.length}: diferencia ${VIZ.fmt(nulos[nulos.length - 1], 3)}.` : `Diferencia observada: ${VIZ.fmt(obs, 3)}. Pulse Un paso para barajar las etiquetas.`;
      lectura.set([
        ['diferencia observada', VIZ.fmt(obs, 3)],
        ['p-valor por permutación', nulos.length ? VIZ.fmt((extremos + 1) / (nulos.length + 1), 3) : '—'],
        ['p-valor de la prueba t (aprox. normal)', VIZ.fmt(2 * (1 - M.Phi(Math.abs(z))), 3)],
        ['permutaciones', String(nulos.length)],
      ]);
    }
    lienzo.alDibujar = () => A.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!ph || !ph.dentro(x, y - ph.oy)) return tip.ocultar();
      const v = ph.ix(x);
      tip.mostrar(x, y, `diferencia ≈ <b>${VIZ.fmt(v, 3)}</b><br>permutaciones con |dif| ≥ |${VIZ.fmt(v, 2)}|: <b>${M.pct(nulos.filter((q) => Math.abs(q) >= Math.abs(v)).length / Math.max(1, nulos.length))}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: comparar distribuciones completas ---------- */

  function montarKS(cuerpo) {
    let dm = 0, razon = 2, n = 60, semilla = 1, res = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Diferencia de medias', min: 0, max: 1.5, paso: 0.05, valor: dm, formato: (v) => v.toFixed(2), alCambiar: (v) => { dm = v; calcular(); } });
    ctl.rango({ etiqueta: 'Razón de desviaciones B / A', min: 0.3, max: 3, paso: 0.1, valor: razon, formato: (v) => v.toFixed(1), alCambiar: (v) => { razon = v; calcular(); } });
    ctl.rango({ etiqueta: 'Datos por grupo', min: 10, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; }, alSoltar: () => calcular() });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 280, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'función de distribución empírica de A', forma: 'linea' }, { color: C.s2, texto: 'de B', forma: 'linea' }, { color: C.s8, texto: 'distancia KS (máxima separación)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con medias iguales y varianzas distintas, una prueba de medias no ve nada, pero las funciones de distribución se cruzan y se separan en las colas. El p-valor del estadístico KS se calcula con 500 permutaciones.');
    const ecdf = (v) => { const s = v.slice().sort((a, b) => a - b); return (x) => { let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= x) lo = m + 1; else hi = m; } return lo / s.length; }; };
    const ksDe = (a, b) => { const Fa = ecdf(a), Fb = ecdf(b); let mx = 0, en = 0; for (const x of [...a, ...b]) { const d = Math.abs(Fa(x) - Fb(x)); if (d > mx) { mx = d; en = x; } } return { d: mx, en }; };
    function calcular() {
      const rnd = VIZ.semilla(semilla * 7 + n);
      const A = Array.from({ length: n }, () => VIZ.normal(rnd)), B = Array.from({ length: n }, () => dm + razon * VIZ.normal(rnd));
      const ks = ksDe(A, B), todos = [...A, ...B];
      let ext = 0;
      for (let k = 0; k < 500; k++) { const p = M.barajar(todos.slice(), rnd); if (ksDe(p.slice(0, n), p.slice(n)).d >= ks.d - 1e-12) ext++; }
      const se = Math.sqrt(M.varianza(A) / n + M.varianza(B) / n), z = (M.media(B) - M.media(A)) / se;
      res = { A, B, ks, pKS: (ext + 1) / 501, pT: 2 * (1 - M.Phi(Math.abs(z))) };
      dibujar();
    }
    let pl = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const todos = [...res.A, ...res.B], lo = Math.min(...todos), hi = Math.max(...todos);
      pl = VIZ.plano(lienzo, { xmin: lo, xmax: hi, ymin: 0, ymax: 1 }, { etiquetaX: 'valor', etiquetaY: 'F(x)', formatoY: (v) => `${Math.round(v * 100)}%` });
      pl.ejes();
      for (const [v, col] of [[res.A, C.s1], [res.B, C.s2]]) {
        const s = v.slice().sort((a, b) => a - b), pts = [[lo, 0]];
        s.forEach((x, i) => { pts.push([x, i / s.length], [x, (i + 1) / s.length]); });
        pts.push([hi, 1]);
        VIZ.trazar(ctx, pl, pts, col, 2);
      }
      const Fa = ecdf(res.A), Fb = ecdf(res.B), x = res.ks.en;
      VIZ.trazar(ctx, pl, [[x, Fa(x)], [x, Fb(x)]], C.s8, 3);
      lectura.set([
        ['estadístico KS', VIZ.fmt(res.ks.d, 3)],
        ['p-valor KS (permutación)', VIZ.fmt(res.pKS, 3)],
        ['p-valor de diferencia de medias', VIZ.fmt(res.pT, 3)],
        ['medias A · B', `${VIZ.fmt(M.media(res.A), 3)} · ${VIZ.fmt(M.media(res.B), 3)}`],
      ]);
    }
    lienzo.alDibujar = () => res && dibujar();
    lienzo.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = lienzo.posicion(e);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const v = pl.ix(x), Fa = ecdf(res.A)(v), Fb = ecdf(res.B)(v);
      tip.mostrar(x, y, `x = <b>${VIZ.fmt(v, 3)}</b>` + VIZ.filaTooltip(C.s1, 'F_A', M.pct(Fa, 0)) + VIZ.filaTooltip(C.s2, 'F_B', M.pct(Fb, 0)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('permutation-test', {
    intro: String.raw`
      <p>Una <strong>prueba de permutación</strong> responde «¿podría esta diferencia deberse al azar?» sin fórmulas ni supuestos de normalidad.
      Si el tratamiento no tuviera efecto, las etiquetas de grupo serían arbitrarias: barajarlas muchas veces muestra qué diferencias produce
      el azar solo, y el <strong>p-valor</strong> es la fracción de esas barajas que igualan o superan lo observado.</p>
      <p>La misma idea sirve para cualquier estadístico: diferencias de medias, distancias entre distribuciones, lift de una regla de asociación,
      o la ganancia de un modelo sobre otro.</p>`,
    visualizaciones: [
      {
        titulo: 'Permutar etiquetas',
        descripcion: 'Dos grupos, la diferencia observada y la distribución nula construida barajando etiquetas. Lleve la diferencia real a 0 y vea cómo crece el p-valor.',
        montar: montarPermutaciones,
      },
      {
        titulo: 'Comparar distribuciones completas',
        descripcion: 'Funciones de distribución empíricas y la prueba de Kolmogorov–Smirnov, que detecta diferencias que una prueba de medias no ve.',
        montar: montarKS,
      },
    ],
    teoria: String.raw`
      <h2>Prueba de permutación</h2>
      <pre><code>t_obs ← T(datos, etiquetas)
para k ← 1 hasta K:
    etiquetas* ← permutación al azar de las etiquetas
    t_k ← T(datos, etiquetas*)
p ← (1 + #{k : |t_k| ≥ |t_obs|}) / (K + 1)</code></pre>
      <p>Bajo la hipótesis nula de <strong>intercambiabilidad</strong> (las etiquetas no importan), \(t_{\text{obs}}\) es una más entre las permutaciones y el
      p-valor es exacto para cualquier \(K\) (sumar 1 arriba y abajo evita p = 0). Con todas las \(\binom{2n}{n}\) permutaciones es la prueba exacta de Fisher–Pitman.</p>
      <div class="recuadro"><p>El p-valor es \(P(\text{estadístico tan extremo} \mid H_0)\), no la probabilidad de que \(H_0\) sea cierta. Un p-valor chico con
      \(n\) enorme puede corresponder a una diferencia irrelevante: informe siempre el tamaño del efecto y su intervalo.</p></div>
      <h2>Kolmogorov–Smirnov</h2>
      \[ D = \sup_x \bigl|\hat F_A(x) - \hat F_B(x)\bigr|. \]
      <p>Es sensible a cualquier diferencia de distribución (ubicación, escala, forma). Bajo \(H_0\) su distribución no depende de \(F\); para muestras
      chicas o con empates se obtiene por permutación.</p>
      <h2>Comparaciones múltiples</h2>
      <p>Al probar muchas hipótesis (muchas reglas, muchos genes, muchos subgrupos), un 5 % de ellas saldrá significativa por azar. Se corrige con
      Bonferroni (\(\alpha/m\)) o controlando la tasa de falsos descubrimientos (Benjamini–Hochberg). Las permutaciones permiten corregir usando el
      máximo del estadístico sobre todas las pruebas en cada permutación.</p>
      <p>En inferencia causal, permutar el tratamiento es la base de la <a href="tema.html?id=causal-refutation">refutación con placebo</a>.</p>`,
  });
})();