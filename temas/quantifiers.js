(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: ∀ y ∃ sobre un dominio finito ---------- */

  const FRASES = ['∀x P(x)', '∃x P(x)', '∀x ¬P(x)', '¬∃x P(x)', '∃x ¬P(x)', '¬∀x P(x)'];
  const EQUIV = { '∀x P(x)': 'equivale a ¬∃x ¬P(x)', '∃x P(x)': 'equivale a ¬∀x ¬P(x)', '∀x ¬P(x)': 'equivale a ¬∃x P(x)', '¬∃x P(x)': 'equivale a ∀x ¬P(x)', '∃x ¬P(x)': 'equivale a ¬∀x P(x)', '¬∀x P(x)': 'equivale a ∃x ¬P(x)' };

  function montarDominio(cuerpo) {
    let n = 6, P = [true, true, false, true, true, true, true, true, true, true], frase = FRASES[0], geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Sentencia', opciones: FRASES.map((f) => [f, f]), valor: frase, alCambiar: (v) => { frase = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Elementos del dominio', min: 2, max: 10, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.boton('Todos cumplen P', () => { P = P.map(() => true); dibujar(); });
    ctl.boton('Ninguno cumple P', () => { P = P.map(() => false); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 130 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'P(x) es verdadero', forma: 'punto' },
      { color: C.s6, texto: 'ejemplo que hace verdadero un ∃', forma: 'linea' },
      { color: C.s8, texto: 'contraejemplo que hace falso un ∀', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un elemento para cambiar si cumple P. En un dominio finito, ∀ es una conjunción y ∃ una disyunción. Compare las seis sentencias: tres pares equivalentes.');

    function dibujar() {
      const ast = D.leer(frase), { ctx, ancho: W } = lienzo;
      const m = { n, rel: { P: { ar: 1, d: P.slice(0, n) } } };
      const q = (ast.k === 'not' ? ast.a : ast), cuerpoQ = q.a;
      const pasa = Array.from({ length: n }, (_, i) => D.evaluaP(cuerpoQ, m, { x: i }));
      const valor = D.evaluaP(ast, m, {});
      const marcas = q.k === 'all' ? pasa.map((v, i) => (!v ? i : -1)).filter((i) => i >= 0) : pasa.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      lienzo.limpiar();
      const paso = Math.min(52, (W - 40) / n), x0 = (W - n * paso) / 2;
      geo = { paso, x0 };
      for (let i = 0; i < n; i++) {
        const x = x0 + i * paso + paso / 2;
        ctx.beginPath(); ctx.arc(x, 62, 16, 0, 7); ctx.fillStyle = P[i] ? C.s1 : C.superficie; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = P[i] ? C.s1 : C.eje; ctx.stroke();
        D.texto2(ctx, D.nombreElem(i), x, 62, { px: 12, peso: 600, color: P[i] ? C.sobre : C.tinta2 });
        if (marcas.includes(i) && marcas.indexOf(i) === 0) { ctx.beginPath(); ctx.arc(x, 62, 21, 0, 7); ctx.lineWidth = 3.5; ctx.strokeStyle = q.k === 'all' ? C.s8 : C.s6; ctx.stroke(); }
      }
      const letras = Array.from({ length: n }, (_, i) => D.nombreElem(i));
      const cuerpoTxt = (e) => D.texto(q.a).replace(/x/g, e);
      const exp = letras.map(cuerpoTxt).join(q.k === 'all' ? ' ∧ ' : ' ∨ ');
      registro.textContent = `${ast.k === 'not' ? '¬ ' : ''}(${exp})\n` + (q.k === 'all' ? (marcas.length ? `El elemento ${D.nombreElem(marcas[0])} es un contraejemplo: «${cuerpoTxt(D.nombreElem(marcas[0]))}» es falsa.` : 'Ningún contraejemplo: la conjunción es verdadera.') : (marcas.length ? `El elemento ${D.nombreElem(marcas[0])} es un ejemplo: «${cuerpoTxt(D.nombreElem(marcas[0]))}» es verdadera.` : 'Ningún elemento la cumple: la disyunción es falsa.'));
      lectura.set([['sentencia', D.texto(ast)], ['valor', valor ? 'V' : 'F'], ['elementos con P', `${P.slice(0, n).filter(Boolean).length} de ${n}`], ['relación', EQUIV[frase]]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x } = lienzo.posicion(ev);
      const i = Math.floor((x - geo.x0) / geo.paso);
      if (i >= 0 && i < n) { P[i] = !P[i]; dibujar(); }
    });
    dibujar();
  }

  /* ---------- Fig. 2: cuantificadores anidados ---------- */

  const LECT = {
    ae: '∀x ∃y R(x,y)', ea: '∃y ∀x R(x,y)', aa: '∀x ∀y R(x,y)', ee: '∃x ∃y R(x,y)',
  };

  function montarAnidados(cuerpo) {
    let n = 5, lect = 'ae', geo = null, R = Array.from({ length: 36 }, (_, k) => Math.floor(k / 6) === k % 6);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Lectura a resaltar', opciones: Object.entries(LECT).map(([k, v]) => [k, v]), valor: lect, alCambiar: (v) => { lect = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño del dominio', min: 3, max: 6, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.boton('Una sola fila llena', () => { R = R.map((_, k) => Math.floor(k / 6) === 0); dibujar(); });
    ctl.boton('Una sola columna llena', () => { R = R.map((_, k) => k % 6 === 0); dibujar(); });
    ctl.boton('Aleatoria', () => { const r = VIZ.semilla(Math.floor(Math.random() * 1e6)); R = R.map(() => r() < 0.5); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 250 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'R(x, y) verdadero', forma: 'cuadro' },
      { color: C.s6, texto: 'testigo o celda que cumple la lectura', forma: 'linea' },
      { color: C.s8, texto: 'contraejemplo: celda o fila donde falla', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Filas = x, columnas = y. ∀x∃y pide una celda azul en cada fila; ∃y∀x pide una columna entera azul. Haga clic en las celdas y compruebe que el orden de los cuantificadores cambia el significado.');

    const v = (i, j) => R[i * 6 + j];
    function valores() {
      const filas = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => v(i, j)));
      return {
        ae: filas.every((f) => f.some(Boolean)),
        ea: Array.from({ length: n }, (_, j) => filas.every((f) => f[j])).some(Boolean),
        aa: filas.every((f) => f.every(Boolean)),
        ee: filas.some((f) => f.some(Boolean)),
      };
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo, V = valores();
      lienzo.limpiar();
      const cs = Math.min(40, (W - 90) / n, 190 / n), ox = 50, oy = 40;
      geo = { cs, ox, oy };
      D.texto2(ctx, 'y →', ox + (n * cs) / 2, 14, { px: 11, color: C.tinta2 });
      D.texto2(ctx, 'x', 22, oy + (n * cs) / 2, { px: 11, color: C.tinta2 });
      for (let i = 0; i < n; i++) {
        D.texto2(ctx, D.nombreElem(i), ox + i * cs + cs / 2, oy - 10, { px: 11, color: C.apagado });
        D.texto2(ctx, D.nombreElem(i), ox - 12, oy + i * cs + cs / 2, { px: 11, color: C.apagado });
        for (let j = 0; j < n; j++) { ctx.fillStyle = v(i, j) ? C.s1 : C.neutro; ctx.fillRect(ox + j * cs + 1, oy + i * cs + 1, cs - 2, cs - 2); }
      }
      const marco = (i, j, c) => { ctx.lineWidth = 3; ctx.strokeStyle = c; ctx.strokeRect(ox + j * cs + 2, oy + i * cs + 2, cs - 4, cs - 4); };
      if (lect === 'ae') for (let i = 0; i < n; i++) { const j = Array.from({ length: n }, (_, q) => q).find((q) => v(i, q)); if (j !== undefined) marco(i, j, C.s6); else { ctx.lineWidth = 3; ctx.strokeStyle = C.s8; ctx.strokeRect(ox + 2, oy + i * cs + 2, n * cs - 4, cs - 4); } }
      else if (lect === 'ea') for (let j = 0; j < n; j++) {
        const lleno = Array.from({ length: n }, (_, i) => v(i, j)).every(Boolean);
        if (lleno) { ctx.lineWidth = 3; ctx.strokeStyle = C.s6; ctx.strokeRect(ox + j * cs + 2, oy + 2, cs - 4, n * cs - 4); }
        else { const i = Array.from({ length: n }, (_, q) => q).find((q) => !v(q, j)); marco(i, j, C.s8); }
      } else if (lect === 'aa') { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!v(i, j)) { marco(i, j, C.s8); i = n; break; } if (V.aa) { ctx.lineWidth = 3; ctx.strokeStyle = C.s6; ctx.strokeRect(ox + 2, oy + 2, n * cs - 4, n * cs - 4); } }
      else { outer: for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (v(i, j)) { marco(i, j, C.s6); break outer; } }
      const razon = { ae: V.ae ? 'cada fila tiene alguna celda azul' : 'hay una fila sin celdas azules', ea: V.ea ? 'hay una columna entera azul' : 'ninguna columna es toda azul', aa: V.aa ? 'todas las celdas son azules' : 'hay una celda que no es azul', ee: V.ee ? 'hay al menos una celda azul' : 'no hay ninguna celda azul' }[lect];
      registro.textContent = `${LECT[lect]} es ${V[lect] ? 'VERDADERA' : 'FALSA'}: ${razon}.`;
      lectura.set([['para todo x, existe y', V.ae ? 'V' : 'F'], ['existe y, para todo x', V.ea ? 'V' : 'F'], ['para todo x y todo y', V.aa ? 'V' : 'F'], ['existe x y existe y', V.ee ? 'V' : 'F']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const j = Math.floor((x - geo.ox) / geo.cs), i = Math.floor((y - geo.oy) / geo.cs);
      if (i >= 0 && j >= 0 && i < n && j < n) { R[i * 6 + j] = !R[i * 6 + j]; dibujar(); }
    });
    dibujar();
  }

  VIZ.registrarTema('quantifiers', {
    intro: String.raw`
      <p>Los <strong>cuantificadores</strong> dicen de cuántos elementos habla una fórmula. «\(\forall x\,P(x)\)» (para todo \(x\)) afirma que <em>todos</em> los objetos tienen la propiedad; «\(\exists x\,P(x)\)» (existe un \(x\)) afirma que <em>al menos uno</em> la tiene.</p>
      <p>En un dominio finito son conjunciones y disyunciones largas: \(\forall x\,P(x)\) equivale a \(P(a) \land P(b) \land \cdots\). Pero en un dominio infinito ya no se puede escribir así, y de ahí viene el poder expresivo de la lógica de predicados.</p>`,
    visualizaciones: [
      {
        titulo: '∀ y ∃ sobre un dominio finito',
        descripcion: 'Cambie qué elementos cumplen \\(P\\) y compare las seis sentencias. Busque el ejemplo que hace verdadero un \\(\\exists\\) y el contraejemplo que hace falso un \\(\\forall\\).',
        montar: montarDominio,
      },
      {
        titulo: 'Cuantificadores anidados',
        descripcion: 'En una matriz, compare \\(\\forall x \\exists y\\) con \\(\\exists y \\forall x\\). Con una sola columna llena la segunda es verdadera; con la diagonal, solo la primera.',
        montar: montarAnidados,
      },
    ],
    teoria: String.raw`
      <h2>Semántica de los cuantificadores</h2>
      \[ \mathcal{I} \models \forall x\,\varphi \iff \text{para todo } d \in |\mathcal{I}|,\ \mathcal{I} \models \varphi[x \mapsto d]; \qquad \mathcal{I} \models \exists x\,\varphi \iff \text{existe } d \in |\mathcal{I}| \text{ tal que } \mathcal{I} \models \varphi[x \mapsto d]. \]
      <p>Con dominio finito \(\{d_1, \dots, d_n\}\): \(\forall x\,\varphi \equiv \varphi(d_1) \land \cdots \land \varphi(d_n)\) y \(\exists x\,\varphi \equiv \varphi(d_1) \lor \cdots \lor \varphi(d_n)\). Por eso las leyes de De Morgan se trasladan a los cuantificadores
      (ver <a href="tema.html?id=quantifier-negation">Negating Quantifiers</a>).</p>
      <h2>El orden importa</h2>
      <p>\(\forall x\,\exists y\,R(x,y)\) dice que para cada \(x\) hay un \(y\) (que puede depender de \(x\)): «todos tienen un amigo». \(\exists y\,\forall x\,R(x,y)\) dice que hay un único \(y\) que sirve para todos los \(x\): «hay alguien a quien todos quieren».
      La segunda implica la primera, pero no al revés:</p>
      \[ \exists y\,\forall x\,R(x,y) \;\models\; \forall x\,\exists y\,R(x,y), \qquad \forall x\,\exists y\,R(x,y) \;\not\models\; \exists y\,\forall x\,R(x,y). \]
      <p>Los cuantificadores del mismo tipo conmutan: \(\forall x\forall y \equiv \forall y\forall x\) y \(\exists x\exists y \equiv \exists y\exists x\).</p>
      <h2>Con implicación o con conjunción</h2>
      <p>La estructura típica es \(\forall x\,(P(x) \to Q(x))\) («todo \(P\) es \(Q\)») y \(\exists x\,(P(x) \land Q(x))\) («algún \(P\) es \(Q\)»). Cambiarlas es un error clásico: \(\forall x\,(P(x) \land Q(x))\) afirma que <em>todo</em> es \(P\) y \(Q\); \(\exists x\,(P(x) \to Q(x))\) es verdadera con solo que algún elemento no cumpla \(P\).</p>`,
  });
})();
