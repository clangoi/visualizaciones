(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: dominio, predicados y relación ---------- */

  function montarModelo(cuerpo) {
    let n = 5, P = [true, false, true, true, false, false, false, false], Q = [false, true, true, false, false, false, false, false], edit = 'P';
    let R = Array.from({ length: 64 }, () => false);
    [[0, 1], [1, 2], [2, 3], [3, 4], [2, 2]].forEach(([i, j]) => { R[i * 8 + j] = true; });
    let ast = D.leer('P(x) ∧ Q(x)'), geoE = null, geoR = null;
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { etiqueta: 'Fórmula con x (y y) libres', valor: 'P(x) ∧ Q(x)', simbolos: ['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')'], alCambiar: (r) => { if (r.error) { registro.textContent = D.mensaje(campo.valor, r); return; } ast = r.ast; dibujar(); } });
    ctl.rango({ etiqueta: 'Elementos del dominio', min: 3, max: 8, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Al hacer clic en un punto, editar', opciones: [['P', 'predicado P'], ['Q', 'predicado Q']], valor: edit, alCambiar: (v) => { edit = v; } });
    const cols = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(cols);
    const le = VIZ.lienzo(cols, { alto: 150 });
    const lr = VIZ.lienzo(cols, { alto: 220 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'el predicado vale V para ese elemento', forma: 'punto' },
      { color: C.s6, texto: 'anillo: el elemento (o par) satisface la fórmula', forma: 'linea' },
      { color: C.s1, texto: 'celda azul: R(x, y) verdadera', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en los puntos de P o Q (a la izquierda) o en las celdas de R (a la derecha) para cambiar la interpretación. La fórmula con x libre define un subconjunto del dominio; con x e y, un conjunto de pares.');

    const modelo = () => ({ n, rel: { P: { ar: 1, d: P.slice(0, n) }, Q: { ar: 1, d: Q.slice(0, n) }, R: { ar: 2, d: Array.from({ length: n * n }, (_, k) => R[Math.floor(k / n) * 8 + (k % n)]) } } });
    function dibujar() {
      const m = modelo(), libres = D.libres(ast), { ctx } = le;
      const sat = new Set(), satR = new Set();
      let valor = null;
      if (libres.length === 0) valor = D.evaluaP(ast, m, {});
      else if (libres.length === 1) for (let i = 0; i < n; i++) { if (D.evaluaP(ast, m, { [libres[0]]: i })) sat.add(i); }
      else if (libres.length === 2) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D.evaluaP(ast, m, { [libres[0]]: i, [libres[1]]: j })) satR.add(i * n + j);
      le.limpiar();
      const paso = Math.min(44, (le.ancho - 70) / n), x0 = 56;
      geoE = { paso, x0 };
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const x = x0 + i * paso + paso / 2;
        D.texto2(ctx, D.nombreElem(i), x, 16, { px: 12, peso: 600, color: C.tinta2 });
        if (sat.has(i)) { ctx.beginPath(); ctx.arc(x, 16, 13, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = C.s6; ctx.stroke(); }
        [['P', P, 54], ['Q', Q, 94]].forEach(([nom, V, y]) => {
          ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fillStyle = V[i] ? C.s1 : C.superficie; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = V[i] ? C.s1 : C.eje; ctx.stroke();
          if (i === 0) D.texto2(ctx, nom, 30, y, { px: 13, peso: 600, color: C.tinta2 });
        });
      }
      lr.limpiar();
      const cs = Math.min(30, (lr.ancho - 60) / n, (220 - 50) / n), ox = 40, oy = 36;
      geoR = { cs, ox, oy };
      D.texto2(lr.ctx, 'R(fila, columna)', ox, 14, { alinea: 'left', px: 11, color: C.tinta2 });
      for (let i = 0; i < n; i++) {
        D.texto2(lr.ctx, D.nombreElem(i), ox + i * cs + cs / 2, oy - 8, { px: 10.5, color: C.apagado });
        D.texto2(lr.ctx, D.nombreElem(i), ox - 10, oy + i * cs + cs / 2, { px: 10.5, color: C.apagado });
        for (let j = 0; j < n; j++) {
          lr.ctx.fillStyle = R[i * 8 + j] ? C.s1 : C.neutro; lr.ctx.fillRect(ox + j * cs + 1, oy + i * cs + 1, cs - 2, cs - 2);
          if (satR.has(i * n + j)) { lr.ctx.lineWidth = 2.5; lr.ctx.strokeStyle = C.s6; lr.ctx.strokeRect(ox + j * cs + 2, oy + i * cs + 2, cs - 4, cs - 4); }
        }
      }
      const lst = (S) => '{' + [...S].map((i) => D.nombreElem(i)).join(', ') + '}';
      registro.textContent = libres.length === 0 ? `La fórmula no tiene variables libres: es una sentencia y vale ${valor ? 'V' : 'F'} en esta interpretación.`
        : libres.length === 1 ? `{${libres[0]} : ${D.texto(ast)}} = ${lst(sat)}   (${sat.size} de ${n} elementos)`
          : libres.length === 2 ? `Pares (${libres[0]}, ${libres[1]}) que satisfacen la fórmula: ${satR.size} de ${n * n}.` : 'Use a lo más dos variables libres (x, y).';
      lectura.set([['dominio', '{' + Array.from({ length: n }, (_, i) => D.nombreElem(i)).join(', ') + '}'], ['P', lst(P.slice(0, n).flatMap((v, i) => (v ? [i] : [])))], ['Q', lst(Q.slice(0, n).flatMap((v, i) => (v ? [i] : [])))], ['pares de R', String(R.filter((v, k) => v && Math.floor(k / 8) < n && k % 8 < n).length)]]);
    }
    le.alDibujar = dibujar; lr.alDibujar = dibujar;
    le.canvas.style.cursor = 'pointer'; lr.canvas.style.cursor = 'pointer';
    le.canvas.addEventListener('click', (ev) => {
      const { x, y } = le.posicion(ev);
      const i = Math.floor((x - geoE.x0) / geoE.paso);
      if (i < 0 || i >= n) return;
      if (Math.abs(y - 54) < 14) P[i] = !P[i]; else if (Math.abs(y - 94) < 14) Q[i] = !Q[i]; else (edit === 'P' ? (P[i] = !P[i]) : (Q[i] = !Q[i]));
      dibujar();
    });
    lr.canvas.addEventListener('click', (ev) => {
      const { x, y } = lr.posicion(ev);
      const j = Math.floor((x - geoR.ox) / geoR.cs), i = Math.floor((y - geoR.oy) / geoR.cs);
      if (i < 0 || j < 0 || i >= n || j >= n) return;
      R[i * 8 + j] = !R[i * 8 + j]; dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: la misma fórmula en distintas interpretaciones ---------- */

  const ESTR = [
    ['x < y', (x, y) => x < y], ['x ≤ y', (x, y) => x <= y], ['y = x + 1 (mód k)', (x, y, k) => y === (x + 1) % k], ['|x − y| = 1', (x, y) => Math.abs(x - y) === 1], ['x divide a y (en 1…k)', (x, y) => (y + 1) % (x + 1) === 0],
  ];
  const FORM = ['∀x ∃y R(x,y)', '∃x ∀y R(x,y)', '∀x ¬R(x,x)', '∀x ∀y (R(x,y) → R(y,x))', '∀x ∀y ∀z (R(x,y) ∧ R(y,z) → R(x,z))', '∃x ∀y (x = y ∨ R(x,y))'];

  function montarInterpretaciones(cuerpo) {
    let k = 4, sel = [0, 0];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Tamaño del dominio k', min: 3, max: 7, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 200 });
    cuerpo.dataset.sinLeyenda = 'la tabla muestra V/F; el lienzo dibuja la relación R de la celda elegida';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una fórmula y cada columna una interpretación de R sobre un dominio de k elementos. Haga clic en una celda para ver la relación. La misma fórmula puede ser verdadera en una interpretación y falsa en otra.');
    const asts = FORM.map(D.leer);

    function modelo(c) { return { n: k, rel: { R: D.relacion(k, 2, (x, y) => ESTR[c][1](x, y, k)) } }; }
    function dibujar() {
      const tab = VIZ.el('table', { class: 'tabla-datos tabla-verdad sin-corte' });
      tab.appendChild(VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', null, 'fórmula'), ...ESTR.map(([t]) => VIZ.el('th', null, `R(x,y): ${t}`)))));
      tab.appendChild(VIZ.el('tbody', null, asts.map((a, f) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, D.texto(a)), ...ESTR.map((_, c) => {
        const v = D.evaluaP(a, modelo(c), {});
        const td = VIZ.el('td', { class: `${v ? 'v' : 'f'} celda-clic${sel[0] === f && sel[1] === c ? ' fuerte' : ''}` }, v ? 'V' : 'F');
        td.addEventListener('click', () => { sel = [f, c]; dibujar(); });
        return td;
      })))));
      caja.replaceChildren(tab);
      const m = modelo(sel[1]), v = D.evaluaP(asts[sel[0]], m, {});
      lienzo.limpiar();
      lienzo.ctx.save(); lienzo.ctx.translate(0, 8); D.dibujarModelo(lienzo, { n: k, rel: m.rel }); lienzo.ctx.restore();
      registro.textContent = `«${D.texto(asts[sel[0]])}» con R(x, y) ⇔ ${ESTR[sel[1]][0]} sobre un dominio de ${k} elementos:  ${v ? 'VERDADERA' : 'FALSA'}.`;
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('predicates-domains', {
    intro: String.raw`
      <p>La lógica proposicional no puede hablar de objetos: «Sócrates es mortal» es una sola proposición indivisible. La <strong>lógica de predicados</strong> abre esa caja. Hay <strong>objetos</strong> (los elementos de un <em>dominio</em>),
      <strong>predicados</strong> que dicen propiedades de ellos (\(P(x)\): «\(x\) es primo») y <strong>relaciones</strong> entre varios (\(R(x,y)\): «\(x\) es menor que \(y\)»).</p>
      <p>El significado de una fórmula ya no depende solo de valores V/F, sino de una <strong>interpretación</strong>: qué dominio se usa y a qué subconjunto o relación corresponde cada símbolo. Cambie la interpretación y la misma fórmula puede cambiar de valor.</p>`,
    visualizaciones: [
      {
        titulo: 'Dominio, predicados y relación',
        descripcion: 'Construya una interpretación con clics y mire qué elementos o pares satisfacen una fórmula con variables libres. Pruebe \\(P(x) \\land \\neg Q(x)\\) y \\(R(x,y) \\land R(y,x)\\).',
        montar: montarModelo,
      },
      {
        titulo: 'La misma fórmula en otras interpretaciones',
        descripcion: 'Seis fórmulas sobre cinco relaciones clásicas. Observe que ninguna fórmula es verdadera en todas: depende de la interpretación.',
        montar: montarInterpretaciones,
      },
    ],
    teoria: String.raw`
      <h2>Lenguaje e interpretación</h2>
      <p>Una <strong>interpretación</strong> \(\mathcal{I}\) consta de un dominio no vacío \(|\mathcal{I}|\) y, para cada símbolo:</p>
      <ul>
        <li>cada predicado unario \(P\) se interpreta como un subconjunto \(P^{\mathcal{I}} \subseteq |\mathcal{I}|\);</li>
        <li>cada predicado de aridad \(k\), como una relación \(R^{\mathcal{I}} \subseteq |\mathcal{I}|^k\);</li>
        <li>cada constante, como un elemento del dominio.</li>
      </ul>
      <h2>Fórmulas atómicas y compuestas</h2>
      <p>\(P(x)\), \(R(x,y)\) y \(x = y\) son fórmulas atómicas. Con los conectivos proposicionales y los <a href="tema.html?id=quantifiers">cuantificadores</a> se arman fórmulas compuestas. Una fórmula con variables libres no es verdadera ni falsa por sí sola: define un conjunto de elementos (o de tuplas)
      que la satisfacen, que es lo que muestra la primera figura.</p>
      <h2>Ejemplos</h2>
      <table>
        <tr><th>Fórmula</th><th>Dice que…</th><th>Verdadera en…</th></tr>
        <tr><td>\(\forall x\,\exists y\; R(x,y)\)</td><td>todo elemento está relacionado con alguno</td><td>sucesor módulo \(k\); falsa en \(&lt;\) (el mayor no tiene)</td></tr>
        <tr><td>\(\forall x\,\neg R(x,x)\)</td><td>R es irreflexiva</td><td>\(&lt;\); falsa en \(\le\)</td></tr>
        <tr><td>\(\forall x\forall y\,(R(x,y) \to R(y,x))\)</td><td>R es simétrica</td><td>«vecinos»; falsa en \(&lt;\)</td></tr>
      </table>
      <p>Esto se formaliza en <a href="tema.html?id=scope-variables">Scope, Free &amp; Bound Variables</a>; la búsqueda de interpretaciones que refutan un razonamiento, en <a href="tema.html?id=models-countermodels">Models &amp; Countermodels</a>.</p>`,
  });
})();
