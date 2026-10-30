(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const hijosDpll = (n) => n.hijos;

  /* ---------- Fig. 1: búsqueda de un modelo con DPLL ---------- */

  function montarBusqueda(cuerpo) {
    const INI = '(p ∨ r ∨ s) ∧ (¬r ∨ ¬q ∨ ¬s) ∧ (¬s ∨ ¬q ∨ r) ∧ (¬q ∨ ¬p ∨ s) ∧ (p ∨ ¬r ∨ s) ∧ (q ∨ r)';
    let ast = D.leer(INI), res = null;
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: INI, alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; calcular(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [[INI, 'satisfacible, con retrocesos'], ['(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)', 'insatisfacible'], ['(p → q) ∧ (q → r) ∧ p ∧ ¬r', 'insatisfacible'], ['(p ∨ q ∨ r) ∧ (¬p ∨ ¬q) ∧ (¬q ∨ ¬r) ∧ (¬p ∨ ¬r)', 'exactamente uno']], valor: INI, alCambiar: (v) => { campo.valor = v; ast = D.leer(v); calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (res ? D.altoArbol(res.raiz, 52, (n) => D.profGen(n, hijosDpll)) : 100) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'asignación que satisface todas las cláusulas', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.25), borde: C.s8, texto: 'conflicto: alguna cláusula quedó vacía', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta2, texto: 'decisión o propagación (⌐ separa las unitarias)', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'DPLL decide un literal, propaga las cláusulas unitarias (las que quedan con un solo literal) y retrocede ante un conflicto. Cada nodo muestra la decisión y, tras «|», lo que se propagó.');

    function calcular() {
      const cls = D.clausulas(ast);
      res = D.dpllArbol(cls);
      lienzo.ajustar(true);
    }
    function dibujar() {
      lienzo.limpiar();
      D.arbolDpll(lienzo, res.raiz);
      const vars = D.vars(ast), tr = D.resultados(ast, vars), nm = tr.filter(Boolean).length;
      let hoja = res.raiz; while (hoja.hijos.length && hoja.hijos.some((h) => h.sat)) hoja = hoja.hijos.find((h) => h.sat);
      const modelo = res.sat ? vars.map((v) => `${v}=${v in hoja.asig ? (hoja.asig[v] ? 'V' : 'F') : '*'}`).join(', ') : null;
      registro.textContent = res.sat ? `Satisfacible. Un modelo: ${modelo}${modelo.includes('*') ? '   (* = cualquier valor)' : ''}.` : 'Insatisfacible: toda rama termina en conflicto, no existe modelo.';
      lectura.set([['clasificación', D.clase(tr)], ['variables', String(vars.length)], ['modelos', `${nm} de ${tr.length}`], ['nodos que visitó DPLL', String(res.nodos)], ['filas de la tabla', String(tr.length)]]);
    }
    lienzo.alDibujar = () => res && dibujar();
    calcular();
  }

  /* ---------- Fig. 2: transición de fase en 3-SAT ---------- */

  function montarTransicion(cuerpo) {
    let n = 10, semilla = 1, pts = [], pl = [null, null];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variables n', min: 6, max: 14, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.boton('Nuevo muestreo', () => { semilla++; calcular(); });
    VIZ.subtitulo(cuerpo, 'Fracción de fórmulas satisfacibles');
    const la = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 200, altoMax: 300 });
    VIZ.subtitulo(cuerpo, 'Costo medio de DPLL (nodos del árbol)');
    const lb = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 200, altoMax: 300 });
    const ta = VIZ.tooltip(la), tb = VIZ.tooltip(lb);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'fracción satisfacible', forma: 'linea' }, { color: C.s2, texto: 'nodos de DPLL en promedio', forma: 'linea' }, { color: C.apagado, texto: 'umbral teórico m/n ≈ 4,27', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto promedia 40 fórmulas aleatorias con m = (m/n)·n cláusulas de 3 literales. Con pocas cláusulas casi todo es satisfacible; con muchas, casi nada; y el cambio es brusco y es donde más cuesta decidir.');

    function calcular() {
      const rnd = VIZ.semilla(semilla * 7919 + n);
      pts = [];
      for (let r = 1; r <= 8; r += 0.5) {
        let sat = 0, nodos = 0;
        for (let i = 0; i < 40; i++) { const res = D.dpllArbol(D.sat3(rnd, n, Math.round(r * n)), 1e6); if (res.sat) sat++; nodos += res.nodos; }
        pts.push({ r, f: sat / 40, c: nodos / 40 });
      }
      dibujar();
    }
    function panel(l, i, clave, ymax, etiquetaY, color, formato) {
      const { ctx } = l;
      l.limpiar();
      const p = VIZ.plano(l, { xmin: 1, xmax: 8, ymin: 0, ymax }, { etiquetaX: 'cláusulas por variable (m/n)', etiquetaY, formatoY: formato });
      p.ejes();
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.beginPath(); ctx.moveTo(p.sx(4.27), p.y0); ctx.lineTo(p.sx(4.27), p.y1); ctx.stroke(); ctx.restore();
      VIZ.trazar(ctx, p, pts.map((q) => [q.r, q[clave]]), color, 2);
      pts.forEach((q) => VIZ.marcador(ctx, p.sx(q.r), p.sy(q[clave]), color, 3.5));
      pl[i] = p;
    }
    function dibujar() {
      const cmax = Math.max(...pts.map((q) => q.c)) * 1.1;
      panel(la, 0, 'f', 1, 'satisfacibles', C.s1, (v) => `${Math.round(v * 100)} %`);
      panel(lb, 1, 'c', cmax, 'nodos', C.s2, (v) => VIZ.fmt(v, 3));
      const umbral = pts.reduce((m, q) => (Math.abs(q.f - 0.5) < Math.abs(m.f - 0.5) ? q : m));
      lectura.set([['n', String(n)], ['ratio donde f ≈ 50 %', VIZ.fmt(umbral.r, 2)], ['costo máximo (nodos)', VIZ.fmt(Math.max(...pts.map((q) => q.c)), 3)], ['en ese ratio', `${Math.round(pts.reduce((m, q) => (q.c > m.c ? q : m)).r * 10) / 10} cláusulas por variable`]]);
    }
    la.alDibujar = () => pts.length && dibujar(); lb.alDibujar = la.alDibujar;
    for (const [l, t, i, k, f] of [[la, ta, 0, 'f', (v) => `${Math.round(v * 100)} %`], [lb, tb, 1, 'c', (v) => VIZ.fmt(v, 3)]]) {
      l.canvas.addEventListener('pointermove', (ev) => {
        const { x, y } = l.posicion(ev);
        if (!pl[i] || !pl[i].dentro(x, y)) return t.ocultar();
        const q = pts.reduce((m, o) => (Math.abs(o.r - pl[i].ix(x)) < Math.abs(m.r - pl[i].ix(x)) ? o : m));
        t.mostrar(x, y, `m/n = <b>${q.r}</b><br>${i ? 'nodos' : 'satisfacibles'} <b>${f(q[k])}</b>`);
      });
      l.canvas.addEventListener('pointerleave', () => t.ocultar());
    }
    calcular();
  }

  VIZ.registrarTema('satisfiability', {
    intro: String.raw`
      <p>Una fórmula es <strong>satisfacible</strong> si existe al menos una valuación que la hace verdadera; esa valuación es un <strong>modelo</strong>. Si no existe ninguna, es insatisfacible.
      Preguntar «¿hay una asignación que cumpla todas estas condiciones a la vez?» es el problema SAT, y aparece en verificación de hardware, planificación y criptografía.</p>
      <p>Probar todas las asignaciones cuesta \(2^n\). Los algoritmos modernos buscan inteligentemente: deciden una variable, propagan consecuencias y retroceden cuando chocan.</p>`,
    visualizaciones: [
      {
        titulo: 'Búsqueda de un modelo con DPLL',
        descripcion: 'Escriba una fórmula y mire el árbol de búsqueda: cada nodo es una decisión, y las ramas rojas son conflictos. Compare la cantidad de nodos con las filas de la tabla.',
        montar: montarBusqueda,
      },
      {
        titulo: 'Transición de fase de 3-SAT',
        descripcion: 'Aumente la proporción de cláusulas por variable: de casi todo satisfacible a casi nada, con un salto brusco. Observe que el costo de DPLL es máximo justo en el salto.',
        montar: montarTransicion,
      },
    ],
    teoria: String.raw`
      <h2>Definiciones</h2>
      <p>\(\varphi\) es <em>satisfacible</em> si existe \(v\) con \(\bar v(\varphi) = 1\); \(v\) es entonces un <em>modelo</em> de \(\varphi\), y se escribe \(v \models \varphi\).
      Relación con la clasificación de <a href="tema.html?id=tautologies">tautologías</a>: \(\varphi\) es una tautología \(\iff\) \(\neg\varphi\) es insatisfacible.</p>
      <h2>El algoritmo DPLL</h2>
      <p>Trabaja sobre un conjunto de cláusulas (ver <a href="tema.html?id=cnf-dnf">forma normal conjuntiva</a>):</p>
      <pre><code>DPLL(S):
    mientras haya una cláusula unitaria {l} en S:
        hacer l verdadero y simplificar S      (propagación unitaria)
    si S contiene la cláusula vacía: devolver INSATISFACIBLE
    si S está vacío: devolver SATISFACIBLE
    elegir un literal l de S
    devolver DPLL(S ∪ {l}) o DPLL(S ∪ {¬l})</code></pre>
      <h2>Complejidad y transición de fase</h2>
      <p>SAT es NP-completo (Cook–Levin), de modo que se espera un costo exponencial en el peor caso. Para fórmulas aleatorias de 3-CNF con \(n\) variables y \(m = \alpha n\) cláusulas, ocurre una <em>transición de fase</em>: para \(\alpha &lt; 4{,}27\) casi todas son satisfacibles y para \(\alpha &gt; 4{,}27\) casi ninguna, y las instancias más difíciles se concentran en torno al umbral.</p>
      <h2>Modelos y consecuencia</h2>
      <p>Contar o encontrar modelos es la base de la <a href="tema.html?id=logical-consequence">consecuencia lógica</a>: \(\Gamma \models \varphi\) si y solo si \(\Gamma \cup \{\neg\varphi\}\) es insatisfacible (ver <a href="tema.html?id=consequence-unsat">Consequence as Unsatisfiability</a>).</p>`,
  });
})();
