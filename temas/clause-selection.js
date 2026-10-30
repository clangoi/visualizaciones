(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const EST = [['ancho', 'ancho (en orden)', C.s1], ['unitaria', 'preferir cláusulas cortas', C.s2], ['soporte', 'conjunto de apoyo', C.s3], ['entrada', 'resolución de entrada', C.s4]];
  const TOPE = 4000;

  function palomar() {
    const cl = [], x = (i, j) => `x${i}${j}`;
    for (let i = 0; i <= 2; i++) cl.push([x(i, 1), x(i, 2)]);
    for (let j = 1; j <= 2; j++) for (let i = 0; i <= 2; i++) for (let k = i + 1; k <= 2; k++) cl.push([`¬${x(i, j)}`, `¬${x(k, j)}`]);
    return cl;
  }
  function aleatoria() {
    for (let s = 1; s < 200; s++) { const cl = D.sat3(VIZ.semilla(s * 17), 5, 26); if (!D.satisfacible(cl)) return cl; }
    return [];
  }
  const PROBLEMAS = {
    horn: { n: 'Cadena de implicaciones (Horn)', cl: () => [['p1'], ['¬p1', 'p2'], ['¬p2', 'p3'], ['¬p3', 'p4'], ['¬p4', 'p5'], ['¬p5', 'p6'], ['¬p6'], ['p3', 'p4'], ['¬p2', 'p6']], sop: [6] },
    pal: { n: 'Palomar: 3 palomas en 2 nidos', cl: palomar, sop: [0, 1, 2] },
    simple: { n: 'Cuatro cláusulas', cl: () => [['p', 'q'], ['¬p', 'r'], ['¬q', 'r'], ['¬r']], sop: [3] },
    azar: { n: '3-SAT aleatorio insatisfacible (5 var., 26 cláusulas)', cl: aleatoria, sop: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  };
  const memo = {};
  function correr(clave) {
    if (memo[clave]) return memo[clave];
    const P = PROBLEMAS[clave], cls = P.cl();
    return (memo[clave] = EST.map(([e, nombre, color]) => {
      const R = D.resolucion(cls, { estrategia: e, soporte: P.sop });
      const curva = [R.cl.length];
      while (curva.length <= TOPE && !R.listo()) { R.paso(); curva.push(R.cl.length); }
      return { e, nombre, color, pares: R.pares, gen: R.generadas, cl: R.cl.length, vacia: R.vacia >= 0, curva };
    }));
  }

  /* ---------- Fig. 1: cuánto trabaja cada estrategia ---------- */

  function montarBarras(cuerpo) {
    let clave = 'pal', metrica = 'pares', geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, v]) => [k, v.n]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Medida', opciones: [['pares', 'pares de cláusulas resueltos'], ['gen', 'resolventes generadas'], ['cl', 'cláusulas guardadas al final']], valor: metrica, alCambiar: (v) => { metrica = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, EST.map(([, t, c]) => ({ color: c, texto: t, forma: 'cuadro' })));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, `Cada estrategia corre hasta derivar □ o agotar los pares (tope de ${TOPE} pasos). Una barra marcada «sin □» no refutó el conjunto: esa estrategia es incompleta o llegó al tope.`);

    function dibujar() {
      const R = correr(clave), { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const max = Math.max(...R.map((r) => r[metrica]), 1), base = H - 48, top = 34, bw = Math.min(90, (W - 60) / 4 - 14), paso = (W - 40) / 4;
      geo = [];
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(20, base + 0.5); ctx.lineTo(W - 20, base + 0.5); ctx.stroke();
      R.forEach((r, i) => {
        const h = (r[metrica] / max) * (base - top), x = 20 + i * paso + (paso - bw) / 2;
        ctx.fillStyle = r.color; ctx.beginPath(); ctx.roundRect(x, base - h, bw, Math.max(2, h), [4, 4, 0, 0]); ctx.fill();
        D.texto2(ctx, VIZ.entero(r[metrica]), x + bw / 2, base - h - 10, { px: 12, peso: 600 });
        D.texto2(ctx, r.vacia ? '' : 'sin □', x + bw / 2, base - h - 26, { px: 11, color: C.s8, peso: 700 });
        D.texto2(ctx, r.nombre.length > 14 && W < 520 ? r.e : r.nombre, x + bw / 2, base + 16, { px: 10.5, color: C.tinta2 });
        geo.push({ x, w: bw, r });
      });
      const ok = R.filter((r) => r.vacia);
      const mejor = ok.length ? ok.reduce((m, r) => (r.pares < m.pares ? r : m)) : null;
      registro.textContent = mejor ? `Con «${mejor.nombre}» se llegó a □ con menos pares resueltos (${VIZ.entero(mejor.pares)}). ${R.filter((r) => !r.vacia).map((r) => `«${r.nombre}» no llegó a □.`).join(' ')}` : 'Ninguna estrategia alcanzó □ dentro del tope.';
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => x >= q.x && x <= q.x + q.w);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.r.nombre}</b>` + `<br>pares resueltos ${VIZ.entero(g.r.pares)}<br>resolventes ${VIZ.entero(g.r.gen)}<br>cláusulas ${VIZ.entero(g.r.cl)}<br>${g.r.vacia ? 'llegó a □' : 'sin □'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: cómo crece el conjunto de cláusulas ---------- */

  function montarCurvas(cuerpo) {
    let clave = 'pal', pl = null, activas = { ancho: true, unitaria: true, soporte: true, entrada: true };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Problema', opciones: Object.entries(PROBLEMAS).map(([k, v]) => [k, v.n]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.casillas(EST.map(([e, t, c]) => ({ clave: e, texto: t, color: c, activo: true })), (e) => { activas = { ...e }; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, EST.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })).concat([{ color: C.s6, texto: 'círculo lleno: llegó a □', forma: 'punto' }]));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea cuenta cuántas cláusulas hay tras cada paso. Una estrategia buena llega pronto a □ sin llenar la memoria de cláusulas que no hacen falta.');

    function dibujar() {
      const R = correr(clave), { ctx } = lienzo;
      lienzo.limpiar();
      const act = R.filter((r) => activas[r.e]);
      const xmax = Math.max(10, ...act.map((r) => r.curva.length - 1)), ymax = Math.max(10, ...act.map((r) => Math.max(...r.curva)));
      pl = VIZ.plano(lienzo, { xmin: 0, xmax, ymin: 0, ymax: ymax * 1.08 }, { etiquetaX: 'pasos (pares resueltos)', etiquetaY: 'cláusulas' });
      pl.ejes();
      for (const r of act) {
        VIZ.trazar(ctx, pl, r.curva.map((v, i) => [i, v]), r.color, 2);
        const i = r.curva.length - 1;
        ctx.beginPath(); ctx.arc(pl.sx(i), pl.sy(r.curva[i]), 5, 0, 7); ctx.fillStyle = r.vacia ? C.s6 : C.superficie; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = r.color; ctx.stroke();
      }
      lectura.set(R.map((r) => [r.nombre, `${r.vacia ? '□ en ' : 'sin □ tras '}${VIZ.entero(r.pares)} pasos`]));
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const i = Math.round(pl.ix(x));
      tip.mostrar(x, y, `paso <b>${i}</b>` + correr(clave).filter((r) => activas[r.e] && i < r.curva.length).map((r) => VIZ.filaTooltip(r.color, r.nombre, r.curva[i])).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('clause-selection', {
    intro: String.raw`
      <p>La resolución dice <em>qué</em> se puede hacer pero no <em>en qué orden</em>. Resolver todos los pares posibles genera una cantidad enorme de cláusulas, la mayoría inútiles. Las <strong>estrategias de selección</strong>
      deciden qué par resolver primero y qué pares ignorar.</p>
      <p>Una estrategia buena llega a la cláusula vacía con pocas resolventes. Pero hay una disyuntiva: restringir la búsqueda ahorra trabajo, a costa de perder <em>completitud</em> —la garantía de encontrar \(\Box\) siempre que exista—.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuánto trabaja cada estrategia',
        descripcion: 'Compare cuatro estrategias en cuatro problemas, con distintas medidas de trabajo. Busque dónde una estrategia restringida no llega a \\(\\Box\\).',
        montar: montarBarras,
      },
      {
        titulo: 'Cómo crece el conjunto de cláusulas',
        descripcion: 'Siga el tamaño del conjunto paso a paso. Apague estrategias para ver las demás y cotejar sus finales.',
        montar: montarCurvas,
      },
    ],
    teoria: String.raw`
      <h2>Estrategias comunes</h2>
      <table>
        <tr><th>Estrategia</th><th>Idea</th><th>¿Completa?</th></tr>
        <tr><td>Por niveles (ancho)</td><td>resolver primero con las cláusulas más antiguas</td><td>sí</td></tr>
        <tr><td>Preferir unitarias / cortas</td><td>las resolventes de cláusulas cortas son más cortas, y la meta \(\Box\) tiene largo 0</td><td>sí</td></tr>
        <tr><td>Conjunto de apoyo</td><td>al menos un padre viene de la negación de la conclusión o de resolventes derivadas de ella</td><td>sí, si el resto del conjunto es satisfacible</td></tr>
        <tr><td>Resolución de entrada</td><td>al menos un padre es una cláusula original</td><td>solo para cláusulas de Horn</td></tr>
      </table>
      <h2>Cláusulas de Horn</h2>
      <p>Una <em>cláusula de Horn</em> tiene a lo más un literal positivo (equivale a una implicación \(p_1 \land \cdots \land p_k \to q\)). Para conjuntos de Horn, la resolución de entrada es completa, y la propagación unitaria decide todo en tiempo lineal. Es la base de lenguajes como Prolog.</p>
      <h2>Redundancia</h2>
      <p>Pueden evitarse cláusulas inútiles descartando las <em>tautologías</em> (contienen \(p\) y \(\neg p\)) y las <em>subsumidas</em> (si \(C \subseteq D\), la cláusula \(D\) no agrega nada). Los solucionadores modernos usan además aprendizaje de cláusulas, que es una forma de resolución dirigida por conflictos
      (ver <a href="tema.html?id=satisfiability">DPLL</a>).</p>
      <h2>Costo en el peor caso</h2>
      <p>Hay familias de fórmulas, como el principio del palomar, cuyas refutaciones por resolución son exponencialmente largas en cualquier estrategia (Haken, 1985). Ningún orden de selección lo evita; ver <a href="tema.html?id=auto-verification">Automated Consequence Checking</a>.</p>`,
  });
})();
