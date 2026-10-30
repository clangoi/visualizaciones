(function () {
  'use strict';
  const { color: C } = VIZ;
  const M = VIZ.min;

  // Retícula de los 5 productos más frecuentes: 31 conjuntos no vacíos (más ∅), por niveles.
  function reticula(T) {
    const top = M.PRODUCTOS.map((_, i) => i).sort((a, b) => M.soporte(T, [b]) - M.soporte(T, [a])).slice(0, 5).sort((a, b) => a - b);
    const nodos = [];
    for (let m = 0; m < 32; m++) {
      const loc = [0, 1, 2, 3, 4].filter((j) => (m >> j) & 1), X = loc.map((j) => top[j]);
      nodos.push({ m, loc, X, k: loc.length, sop: loc.length ? M.soporte(T, X) : 1 });
    }
    return { top, nodos };
  }
  const LETRAS = 'ABCDE';
  const etiqueta = (nd) => (nd.k ? nd.loc.map((j) => LETRAS[j]).join('') : '∅');
  function posiciones(nodos, W, H) {
    const filas = [0, 1, 2, 3, 4, 5].map((k) => nodos.filter((n) => n.k === k));
    const pos = new Map(), alto = (H - 30) / 5;
    filas.forEach((f, k) => f.forEach((n, i) => pos.set(n.m, { x: ((i + 0.5) / f.length) * W, y: 18 + k * alto })));
    return pos;
  }
  function dibujarReticula(lienzo, R, estilo) {
    const { ctx, ancho: W, alto: H } = lienzo;
    const pos = posiciones(R.nodos, W, H);
    const w = Math.min(54, W / 11), h = 22;
    for (const a of R.nodos) for (const b of R.nodos) {
      if (b.k !== a.k + 1 || (a.m & b.m) !== a.m) continue;
      const pa = pos.get(a.m), pb = pos.get(b.m), e = estilo.arista ? estilo.arista(a, b) : {};
      ctx.strokeStyle = e.color || C.tenue; ctx.lineWidth = e.ancho || 1; ctx.setLineDash(e.guiones || []);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y + h / 2); ctx.lineTo(pb.x, pb.y - h / 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const n of R.nodos) {
      const p = pos.get(n.m), e = estilo.nodo(n);
      if (e.anillo) { ctx.strokeStyle = e.anillo; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(p.x - w / 2 - 4, p.y - h / 2 - 4, w + 8, h + 8, 6); ctx.stroke(); }
      ctx.fillStyle = e.relleno || C.superficie; ctx.strokeStyle = e.borde || C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash(e.guiones || []);
      ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, 4); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = e.texto || C.tinta; ctx.font = VIZ.fuente(w < 40 ? 10 : 11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(etiqueta(n), p.x, p.y + 0.5);
    }
    return { pos, w, h };
  }
  const nodoEn = (geo, R, x, y) => R.nodos.find((n) => { const p = geo.pos.get(n.m); return Math.abs(p.x - x) <= geo.w / 2 + 2 && Math.abs(p.y - y) <= geo.h / 2 + 2; });
  const leyendaProductos = (R) => R.top.map((i, j) => `${LETRAS[j]} = ${M.PRODUCTOS[i]}`).join(' · ');

  /* ---------- Fig. 1: frecuentes, maximales y cerrados ---------- */

  function montarBorde(cuerpo) {
    let semilla = 1, minSop = 0.12, T = M.transacciones(200, semilla), R = reticula(T);
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Soporte mínimo', min: 0.02, max: 0.5, paso: 0.01, valor: minSop, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minSop = v; dibujar(); } });
    ctl.boton('Nuevas canastas', () => { semilla++; T = M.transacciones(200, semilla); R = reticula(T); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(300, Math.min(440, w * 0.55)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'frecuente (intensidad ∝ soporte)' },
      { color: C.superficie, texto: 'infrecuente', borde: C.inactivo },
      { color: C.s6, texto: 'maximal: frecuente sin superconjuntos frecuentes', forma: 'linea' },
      { color: C.s7, texto: 'cerrado: ningún superconjunto tiene su mismo soporte', forma: 'linea' },
    ]);
    const productos = VIZ.subtitulo(cuerpo, '');
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nivel tiene los itemsets de un tamaño; una línea une un conjunto con los que tienen un ítem más. Al subir el soporte mínimo, la frontera entre frecuentes e infrecuentes sube por la retícula. Pase el cursor para ver el soporte.');
    let geo = null;
    function dibujar() {
      lienzo.limpiar();
      const fr = (n) => n.sop >= minSop;
      const sup = (n) => R.nodos.filter((b) => b.k === n.k + 1 && (n.m & b.m) === n.m);
      const maximal = (n) => n.k && fr(n) && sup(n).every((b) => !fr(b));
      const cerrado = (n) => n.k && fr(n) && sup(n).every((b) => b.sop < n.sop - 1e-12);
      geo = dibujarReticula(lienzo, R, {
        nodo: (n) => (fr(n) || !n.k
          ? { relleno: VIZ.css(VIZ.enRampa(0.15 + 0.85 * Math.min(1, n.sop / 0.6))), borde: C.s1, texto: n.sop > 0.3 ? C.sobre : C.tinta, anillo: maximal(n) ? C.s6 : cerrado(n) ? C.s7 : null }
          : { relleno: C.superficie, borde: C.inactivo, texto: C.apagado }),
        arista: (a, b) => (fr(a) && fr(b) ? { color: C.s1, ancho: 1.5 } : {}),
      });
      productos.textContent = leyendaProductos(R);
      const F = R.nodos.filter((n) => n.k && fr(n));
      lectura.set([
        ['frecuentes', `${F.length} de 31`],
        ['maximales', String(F.filter(maximal).length)],
        ['cerrados', String(F.filter(cerrado).length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = geo && nodoEn(geo, R, x, y);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `${n.k ? M.nombreConj(n.X) : '∅'}<br>soporte <b>${M.pct(n.sop)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: Apriori recorre la retícula ---------- */

  function montarRecorrido(cuerpo) {
    let semilla = 2, minSop = 0.1, T = [], R = null, estado = new Map(), nivel = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Soporte mínimo', min: 0.02, max: 0.5, paso: 0.01, valor: minSop, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { minSop = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevas canastas', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.max(300, Math.min(440, w * 0.55)) });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'contado y frecuente' },
      { color: C.s8, texto: 'contado e infrecuente', forma: 'cuadro' },
      { color: C.superficie, texto: 'podado sin contar', borde: C.tenue },
      { color: C.inactivo, texto: 'nivel aún no visitado' },
    ]);
    const productos = VIZ.subtitulo(cuerpo, '');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Apriori recorre la retícula de arriba hacia abajo. Cuando un conjunto resulta infrecuente, todos los que cuelgan de él quedan podados: no se cuentan nunca.');
    function iniciar() {
      T = M.transacciones(200, semilla); R = reticula(T); estado = new Map([[0, 'frecuente']]); nivel = 0;
      return (function* () {
        for (let k = 1; k <= 5; k++) {
          nivel = k;
          const nodos = R.nodos.filter((n) => n.k === k);
          let contados = 0, podados = 0;
          for (const n of nodos) {
            const subs = n.loc.map((j) => n.m & ~(1 << j));
            if (subs.some((s) => estado.get(s) !== 'frecuente')) { estado.set(n.m, 'podado'); podados++; continue; }
            estado.set(n.m, n.sop >= minSop ? 'frecuente' : 'infrecuente'); contados++;
          }
          registro.dataset.msg = `Nivel ${k}: ${contados} conjuntos contados, ${podados} podados sin contar.`;
          yield;
          if (!nodos.some((n) => estado.get(n.m) === 'frecuente')) { registro.dataset.msg += ' Ningún frecuente: el algoritmo termina.'; for (const n of R.nodos) if (n.k > k) estado.set(n.m, 'podado'); yield; return; }
        }
      })();
    }
    function dibujar() {
      lienzo.limpiar();
      dibujarReticula(lienzo, R, {
        nodo: (n) => {
          const e = estado.get(n.m);
          if (e === 'frecuente') return { relleno: VIZ.alfa(C.s6, 0.18), borde: C.s6 };
          if (e === 'infrecuente') return { relleno: VIZ.alfa(C.s8, 0.12), borde: C.s8, texto: C.s8 };
          if (e === 'podado') return { relleno: C.superficie, borde: C.tenue, texto: C.apagado, guiones: [3, 3] };
          return { relleno: C.neutro, borde: C.inactivo, texto: C.tinta2 };
        },
        arista: (a, b) => (estado.get(a.m) === 'infrecuente' && estado.get(b.m) === 'podado' ? { color: C.s8, ancho: 1.5, guiones: [3, 3] } : {}),
      });
      productos.textContent = leyendaProductos(R);
      registro.textContent = nivel ? registro.dataset.msg : 'Pulse Un paso: el nivel 1 cuenta cada producto.';
      const v = [...estado.values()];
      lectura.set([
        ['contados', String(v.filter((e) => e === 'frecuente' || e === 'infrecuente').length - 1)],
        ['podados', String(v.filter((e) => e === 'podado').length)],
        ['frecuentes', String(v.filter((e) => e === 'frecuente').length - 1)],
        ['fuerza bruta', '31'],
      ]);
    }
    lienzo.alDibujar = () => R && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('itemset-lattice', {
    intro: String.raw`
      <p>Todos los itemsets posibles forman una <strong>retícula</strong>: arriba el conjunto vacío, abajo el conjunto de todos los
      ítems, y cada conjunto unido a los que tienen un ítem más. Con 5 ítems son 32 nodos; con \(d\), \(2^d\).</p>
      <p>Por la <strong>monotonía del soporte</strong>, los frecuentes forman una región conectada en la parte superior. Encontrar
      itemsets frecuentes es encontrar la <strong>frontera</strong> de esa región, y podar todo lo que queda bajo un nodo infrecuente.</p>`,
    visualizaciones: [
      {
        titulo: 'Frecuentes, maximales y cerrados',
        descripcion: 'La retícula de los cinco productos más vendidos. Mueva el soporte mínimo y observe la frontera; los anillos marcan los resúmenes compactos.',
        montar: montarBorde,
      },
      {
        titulo: 'Apriori recorre la retícula',
        descripcion: 'Nivel por nivel: qué se cuenta y qué se poda. Suba el soporte mínimo para ver podas más tempranas.',
        montar: montarRecorrido,
      },
    ],
    teoria: String.raw`
      <h2>La retícula</h2>
      <p>\((2^I, \subseteq)\) es un orden parcial con ínfimo \(\cap\) y supremo \(\cup\). Su <em>diagrama de Hasse</em> dibuja una arista entre
      \(X\) y \(X \cup \{i\}\). El nivel \(k\) tiene \(\binom dk\) nodos y en total hay \(2^d\).</p>
      <h2>Monotonía y poda</h2>
      <div class="recuadro"><p>\(X \subseteq Y \Rightarrow s(Y) \le s(X)\). Por lo tanto los itemsets frecuentes forman un
      <em>ideal de orden</em> (cerrado hacia arriba en el dibujo): si \(Y\) es frecuente, todos sus subconjuntos lo son. Y si \(X\) es
      infrecuente, todo el «cono» de superconjuntos bajo \(X\) también lo es y se poda.</p></div>
      <h2>Resúmenes compactos</h2>
      <ul>
        <li><strong>Maximales</strong>: frecuentes cuyos superconjuntos inmediatos son todos infrecuentes. Bastan para reconstruir
        <em>cuáles</em> son frecuentes (todos sus subconjuntos), pero no sus soportes.</li>
        <li><strong>Cerrados</strong>: frecuentes sin un superconjunto inmediato con el mismo soporte. Permiten reconstruir los
        frecuentes <em>y</em> sus soportes: \(s(X) = \max\{s(Z) : Z \text{ cerrado}, Z \supseteq X\}\).</li>
      </ul>
      <p>Siempre: maximales \(\subseteq\) cerrados \(\subseteq\) frecuentes. En datos densos, la diferencia de tamaño es de órdenes de magnitud.</p>
      <h2>Estrategias de recorrido</h2>
      <table>
        <tr><th>Estrategia</th><th>Algoritmo</th><th>Idea</th></tr>
        <tr><td>En anchura, de general a específico</td><td><a href="tema.html?id=apriori">Apriori</a></td><td>nivel por nivel, poda por subconjuntos</td></tr>
        <tr><td>En profundidad</td><td>Eclat, FP-growth</td><td>extiende prefijos; buena para itemsets largos</td></tr>
        <tr><td>Solo la frontera</td><td>MaxMiner, CHARM</td><td>busca maximales o cerrados directamente</td></tr>
      </table>`,
  });
})();