(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.pat;

  // Selección secuencial: hacia adelante (SFS) agrega la mejor; hacia atrás (SBS) quita la que menos hace perder.
  function* secuencial(X, y, d, adelante, est) {
    let S = adelante ? [] : [...Array(d).keys()];
    est.S = S.slice(); est.historia = [];
    if (!adelante) est.historia.push({ S: S.slice(), J: P.fisher(X, y, S) });
    while (adelante ? S.length < d : S.length > 1) {
      est.cand = new Array(d).fill(null);
      est.elegida = -1;
      for (let f = 0; f < d; f++) {
        if (adelante === S.includes(f)) continue;
        const T = adelante ? [...S, f] : S.filter((g) => g !== f);
        est.cand[f] = P.fisher(X, y, T);
        est.evaluaciones++;
        est.actual = f;
        est.mensaje = `${adelante ? 'Agregar' : 'Quitar'} «${est.nombres[f]}»: J = ${est.cand[f].toFixed(3)}.`;
        yield;
      }
      let mejor = -1;
      est.cand.forEach((v, f) => { if (v != null && (mejor < 0 || v > est.cand[mejor])) mejor = f; });
      est.elegida = mejor; est.actual = -1;
      S = adelante ? [...S, mejor] : S.filter((g) => g !== mejor);
      est.S = S.slice();
      est.historia.push({ S: S.slice(), J: est.cand[mejor] });
      est.mensaje = `Se ${adelante ? 'agrega' : 'quita'} «${est.nombres[mejor]}» (J = ${est.cand[mejor].toFixed(3)}). Ahora hay ${S.length} característica${S.length === 1 ? '' : 's'}.`;
      yield;
    }
    est.cand = new Array(d).fill(null);
    est.mensaje = 'Terminado: la historia guarda el mejor subconjunto encontrado para cada tamaño.';
  }

  // SFFS (Pudil et al., 1994): después de cada adición, quita mientras eso mejore al mejor conocido del tamaño menor.
  function sffs(X, y, d) {
    const mejor = new Array(d + 1).fill(-Infinity), sub = new Array(d + 1).fill(null);
    let S = [], evals = 0;
    for (let guardia = 0; S.length < d && guardia < 200; guardia++) {
      let f0 = -1, j0 = -Infinity;
      for (let f = 0; f < d; f++) if (!S.includes(f)) { const J = P.fisher(X, y, [...S, f]); evals++; if (J > j0) { j0 = J; f0 = f; } }
      S = [...S, f0];
      if (j0 > mejor[S.length]) { mejor[S.length] = j0; sub[S.length] = S.slice(); }
      while (S.length > 2) {
        let g0 = -1, jg = -Infinity;
        for (const g of S) { const J = P.fisher(X, y, S.filter((h) => h !== g)); evals++; if (J > jg) { jg = J; g0 = g; } }
        if (jg > mejor[S.length - 1] + 1e-12) {
          S = S.filter((h) => h !== g0);
          mejor[S.length] = jg; sub[S.length] = S.slice();
        } else break;
      }
    }
    return { mejor, sub, evals };
  }

  /* ---------- Fig. 1: paso a paso ---------- */

  function montarPasos(cuerpo) {
    let adelante = true, semilla = 1, datos = P.caracteristicas(semilla), est = null;
    const d = datos.nombres.length;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Método', opciones: [['sfs', 'SFS: selección hacia adelante'], ['sbs', 'SBS: eliminación hacia atrás']], valor: 'sfs',
      alCambiar: (v) => { adelante = v === 'sfs'; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });
    ctl.boton('Nuevos datos', () => { semilla++; datos = P.caracteristicas(semilla); rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 280, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'ya en el subconjunto (SFS) / ya quitada (SBS)' },
      { color: C.inactivo, texto: 'candidata evaluada' },
      { color: C.s2, texto: 'candidata que se evalúa' },
      { color: C.s6, texto: 'candidata elegida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es el J que tendría el subconjunto si se agrega (o quita) esa característica. Observe el paso 3 de SFS: LBP₁ y LBP₂ solas aportan poco y quedan para el final, aunque juntas son de las mejores.');

    function iniciar() {
      est = { S: [], cand: new Array(d).fill(null), actual: -1, elegida: -1, evaluaciones: 0, historia: [], nombres: datos.nombres, mensaje: adelante ? 'Se parte del conjunto vacío.' : 'Se parte de las diez características.' };
      return secuencial(datos.X, datos.y, d, adelante, est);
    }
    let plano = null;
    function dibujar() {
      if (!est) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const jmax = Math.max(1, ...est.cand.filter((v) => v != null), ...est.historia.map((h) => h.J)) * 1.12;
      plano = VIZ.plano(lienzo, { xmin: -0.5, xmax: d - 0.5, ymin: 0, ymax: jmax }, { etiquetaY: 'J de Fisher', margen: { izq: 44, inf: 54 },
        ticksX: [], formatoX: () => '' });
      plano.ejes();
      const bw = plano.sx(1) - plano.sx(0);
      ctx.save();
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'center';
      for (let f = 0; f < d; f++) {
        const x = plano.sx(f - 0.5) + 2, w = bw - 4;
        const fuera = adelante ? est.S.includes(f) : !est.S.includes(f);
        if (fuera) {
          ctx.fillStyle = C.tinta;
          ctx.fillRect(x, plano.y0 - 6, w, 6);
          const orden = adelante ? est.S.indexOf(f) + 1 : null;
          if (orden) { ctx.fillStyle = C.tinta; ctx.fillText(`#${orden}`, x + w / 2, plano.y0 - 12); }
        } else if (est.cand[f] != null) {
          const v = est.cand[f];
          ctx.fillStyle = f === est.elegida ? C.s6 : f === est.actual ? C.s2 : C.inactivo;
          ctx.beginPath(); ctx.roundRect(x, plano.sy(v), w, plano.y0 - plano.sy(v), [4, 4, 0, 0]); ctx.fill();
        }
        ctx.fillStyle = C.tinta2;
        ctx.save();
        ctx.translate(x + w / 2, plano.y0 + 8);
        ctx.rotate(bw < 60 ? -Math.PI / 5 : 0);
        ctx.textAlign = bw < 60 ? 'right' : 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(datos.nombres[f], 0, 0);
        ctx.restore();
      }
      ctx.restore();
      const ult = est.historia[est.historia.length - 1];
      registro.textContent = est.mensaje;
      lectura.set([
        ['tamaño actual', String(est.S.length)],
        ['J actual', ult ? ult.J.toFixed(3) : '0'],
        ['evaluaciones de J', String(est.evaluaciones)],
        ['subconjunto', est.S.map((j) => datos.nombres[j]).join(', ') || '∅'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || x < plano.x0 || x > plano.x1) return tip.ocultar();
      const f = Math.round(plano.ix(x));
      if (f < 0 || f >= d) return tip.ocultar();
      tip.mostrar(x, y, `<b>${datos.nombres[f]}</b><br>${est.cand[f] != null ? `J si se ${adelante ? 'agrega' : 'quita'}: <b>${est.cand[f].toFixed(3)}</b>` : 'sin evaluar en este paso'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: comparación con el óptimo ---------- */

  function montarComparacion(cuerpo) {
    let semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'óptimo (búsqueda exhaustiva)', forma: 'linea' },
      { color: C.s1, texto: 'SFS', forma: 'linea' },
      { color: C.s2, texto: 'SBS', forma: 'linea' },
      { color: C.s3, texto: 'SFFS (flotante)', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada tamaño m, el J del subconjunto que entrega cada método. Donde una curva queda bajo la negra, el método no encontró el óptimo. Pase el cursor para ver los subconjuntos.');

    let filas = [], plano = null, datos = null, evals = {};
    function calcular() {
      datos = P.caracteristicas(semilla);
      const { X, y, nombres } = datos, d = nombres.length;
      const correr = (adelante) => {
        const est = { evaluaciones: 0, nombres };
        for (const _ of secuencial(X, y, d, adelante, est));
        return est;
      };
      const f = correr(true), b = correr(false), fl = sffs(X, y, d);
      evals = { sfs: f.evaluaciones, sbs: b.evaluaciones, sffs: fl.evals, exh: 2 ** d - 1 };
      filas = [];
      for (let m = 1; m < d; m++) {
        let opt = null;
        for (const s of P.combinaciones(d, m)) { const J = P.fisher(X, y, s); if (!opt || J > opt.J) opt = { s, J }; }
        const hf = f.historia.find((h) => h.S.length === m), hb = b.historia.find((h) => h.S.length === m);
        filas.push({ m, opt, sfs: hf, sbs: hb, sffs: { S: fl.sub[m], J: fl.mejor[m] } });
      }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...filas.map((f) => f.opt.J)) * 1.08;
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: filas.length, ymin: 0, ymax }, { etiquetaX: 'características elegidas m', etiquetaY: 'J de Fisher', ticksX: filas.map((f) => f.m) });
      plano.ejes();
      const SER = [['opt', C.tinta, 2.5], ['sfs', C.s1, 2], ['sbs', C.s2, 2], ['sffs', C.s3, 2]];
      for (const [k, col, w] of SER) {
        VIZ.trazar(ctx, plano, filas.filter((f) => f[k] && f[k].S !== null).map((f) => [f.m, f[k].J]), col, w, k === 'sffs' ? [5, 4] : null);
        for (const f of filas) if (f[k] && Number.isFinite(f[k].J)) VIZ.marcador(ctx, plano.sx(f.m), plano.sy(f[k].J), col, k === 'opt' ? 4.5 : 3.5, k === 'opt' ? 0 : SER.findIndex((s) => s[0] === k));
      }
      const fallas = (k) => filas.filter((f) => f[k] && f[k].J < f.opt.J - 1e-9).length;
      lectura.set([
        ['tamaños donde SFS falla', `${fallas('sfs')} de ${filas.length}`],
        ['donde SBS falla', `${fallas('sbs')} de ${filas.length}`],
        ['donde SFFS falla', `${fallas('sffs')} de ${filas.length}`],
        ['evaluaciones SFS / SBS / SFFS', `${evals.sfs} / ${evals.sbs} / ${evals.sffs}`],
        ['evaluaciones exhaustiva', VIZ.entero(evals.exh)],
      ]);
    }
    lienzo.alDibujar = () => filas.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) return tip.ocultar();
      const f = filas.find((q) => q.m === Math.round(plano.ix(x)));
      if (!f) return tip.ocultar();
      const n = (s) => (s ? s.map((j) => datos.nombres[j]).join(', ') : '—');
      tip.mostrar(x, y, `m = <b>${f.m}</b>` + VIZ.filaTooltip(C.tinta, `óptimo ${f.opt.J.toFixed(3)}`, '') + `<small>${n(f.opt.s)}</small>`
        + VIZ.filaTooltip(C.s1, `SFS ${f.sfs.J.toFixed(3)}`, '') + VIZ.filaTooltip(C.s2, `SBS ${f.sbs.J.toFixed(3)}`, '')
        + VIZ.filaTooltip(C.s3, `SFFS ${Number.isFinite(f.sffs.J) ? f.sffs.J.toFixed(3) : '—'}`, ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    calcular();
  }

  VIZ.registrarTema('sfs', {
    intro: String.raw`
      <p>La <strong>selección secuencial hacia adelante</strong> (SFS, <em>Sequential Forward Selection</em>) construye el
      subconjunto de características de a una: en cada paso prueba agregar cada característica que falta y se queda con la que
      más mejora el criterio. Es un algoritmo <a href="tema.html?id=greedy">voraz</a>: nunca revisa una decisión ya tomada.</p>
      <p>Cuesta del orden de \(d \cdot m\) evaluaciones en vez de las \(\binom{d}{m}\) de la
      <a href="tema.html?id=exhaustive-search">búsqueda exhaustiva</a>, y suele quedar cerca del óptimo. Falla cuando dos
      características solo sirven juntas: ninguna de las dos gana por sí sola el paso en que se decide.</p>`,
    visualizaciones: [
      {
        titulo: 'Selección secuencial paso a paso',
        descripcion: 'Las barras muestran el criterio de Fisher con cada candidata. Compare el orden en que SFS agrega características con el orden en que SBS las quita.',
        montar: montarPasos,
      },
      {
        titulo: 'SFS, SBS y SFFS frente al óptimo',
        descripcion: 'El valor de J alcanzado por cada método para cada número de características, comparado con el máximo exacto.',
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <pre><code>S ← ∅
mientras |S| &lt; m:
    f* ← argmax_{f ∉ S} J(S ∪ {f})
    S ← S ∪ {f*}
devolver S</code></pre>
      <p>Paso \(k\): se evalúan \(d - k\) candidatas. En total, \(\sum_{k=0}^{m-1} (d - k) = m d - \frac{m(m-1)}{2} = O(d\,m)\)
      evaluaciones del criterio.</p>
      <h2>Eliminación hacia atrás (SBS)</h2>
      <p>SBS hace lo contrario: parte de las \(d\) características y en cada paso quita la que menos reduce \(J\). Tiende a
      conservar parejas complementarias, porque las evalúa juntas desde el principio, pero sus primeros pasos son caros (se
      evalúan subconjuntos grandes) y necesita que el criterio esté bien definido con todas las características.</p>
      <h2>El efecto de anidamiento</h2>
      <p>En SFS, una característica agregada no se puede sacar; en SBS, una quitada no vuelve. Los subconjuntos quedan
      <em>anidados</em>: \(S_1 \subset S_2 \subset \dots\). El óptimo no tiene por qué serlo: en los datos de la figura, el mejor
      par incluye el perímetro, pero el mejor trío lo reemplaza por la pareja LBP₁ y LBP₂.</p>
      <h2>Búsqueda flotante (SFFS)</h2>
      <p>Pudil, Novovičová y Kittler (1994) agregaron un retroceso condicional:</p>
      <pre><code>S ← ∅;  mejor[k] ← −∞ para todo k
repetir hasta |S| = m:
    agregar f* = argmax J(S ∪ {f})                         (paso de SFS)
    mientras |S| &gt; 2:
        g* ← argmax_{g ∈ S} J(S − {g})
        si J(S − {g*}) &gt; mejor[|S| − 1]:  S ← S − {g*}   (retroceder)
        si no:  salir
    actualizar mejor[|S|]</code></pre>
      <p>Solo retrocede si el subconjunto más chico es mejor que todos los de ese tamaño vistos antes, así que no entra en ciclos.
      Su costo no tiene una cota tan simple, pero en la práctica es pocas veces el de SFS y casi siempre encuentra el óptimo.</p>
      <h2>Criterios</h2>
      <p>Con un criterio de <em>filtro</em> como el <a href="tema.html?id=fisher">de Fisher</a>, la selección es rápida e independiente
      del clasificador. Con un criterio <em>envolvente</em> (<em>wrapper</em>), \(J\) es la exactitud de validación cruzada del
      clasificador que se usará después (por ejemplo <a href="tema.html?id=knn">k vecinos</a> o <a href="tema.html?id=lda-qda">LDA</a>):
      es más lento, pero mide lo que importa. En ese caso hay que evaluar el resultado final con datos que la selección nunca vio,
      porque elegir entre muchos subconjuntos sobreajusta la validación.</p>`,
  });
})();
