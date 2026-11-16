(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const leerLista = (txt) => txt.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const r = D.analizar(s); if (r.error) throw new Error(`«${s}»: ${r.error}`); return r.ast; });
  const y = (L) => L.reduce((s, a) => ({ k: 'and', a: s, b: a }));

  /* ---------- Fig. 1: de las premisas al veredicto ---------- */

  const EJ = [
    ['p → q; q → r; p', 'r', 'cadena de implicaciones'], ['p ∨ q; ¬p ∨ r; ¬q ∨ r', 'r', 'casos'], ['p → q; q', 'p', 'afirmar el consecuente'],
    ['(p ∧ q) → r; p', 'q → r', 'exportación'], ['p ↔ q; q ↔ r', 'p ↔ r', 'transitividad de ↔'], ['p → q', 'q → p', 'conversa'],
  ];

  function montarTuberia(cuerpo) {
    const ctl = VIZ.controles(cuerpo);
    const cp = ctl.texto({ etiqueta: 'Premisas (separadas por «;»)', valor: EJ[0][0], alCambiar: () => verificar() });
    const cc = ctl.texto({ etiqueta: 'Conclusión', valor: EJ[0][1], alCambiar: () => verificar() });
    for (const c of [cp, cc]) { c.input.parentNode.classList.add('campo-formula'); c.input.addEventListener('input', () => verificar()); }
    ctl.selector({ etiqueta: 'Ejemplos', opciones: EJ.map(([a, b, n], i) => [i, n]), valor: 0, alCambiar: (v) => { const [a, b] = EJ[+v]; cp.valor = a; cc.valor = b; verificar(); } });
    D.simbolos(cuerpo, cp.input, ['¬', '∧', '∨', '→', '↔', '(', ')', ';']);
    ctl.boton('Verificar', () => verificar(), { primario: true });
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un verificador automático no mira la tabla de verdad: niega la conclusión, pasa todo a cláusulas y resuelve. Aquí se contrasta su veredicto con la tabla, que es el método independiente.');

    function verificar() {
      let prem, conc;
      try { prem = leerLista(cp.valor); conc = D.leer(cc.valor); } catch (e) { registro.textContent = e.message; return; }
      const neg = { k: 'not', a: conc }, todas = [...prem, neg];
      const cls = D.clausulas(y(todas));
      const R = D.resolucion(cls, { estrategia: 'unitaria' });
      let n = 0;
      while (n < 5000 && !R.listo()) { R.paso(); n++; }
      const refuta = R.vacia >= 0;
      const lineas = [
        `1. Negar la conclusión:   ${[...prem.map(D.texto), '¬(' + D.texto(conc) + ')'].join('  ;  ')}`,
        '2. Pasar a cláusulas (CNF):',
        ...todas.map((a, i) => `     ${i === todas.length - 1 ? '¬φ' : `γ${i + 1}`}:  ${D.forma(a, 'cnf').map(D.clTxt).join(' ') || '(sin cláusulas: tautología)'}`),
        `3. Resolución (cláusulas cortas primero):  ${R.cl.length} cláusulas, ${R.pares} pares resueltos`,
        refuta ? `     se derivó □ (en ${R.derivacion().length} cláusulas útiles)` : n >= 5000 ? '     tope alcanzado sin □' : '     saturado sin derivar □',
        `4. Veredicto por resolución:  ${refuta ? 'Γ ⊨ φ  (VÁLIDO)' : n >= 5000 ? 'sin veredicto' : 'Γ ⊭ φ  (INVÁLIDO)'}`,
      ];
      const vars = [...new Set(todas.flatMap(D.vars))];
      let coincide = '—';
      if (vars.length <= 10) {
        const t = D.verificar(prem, conc);
        lineas.push(`5. Comprobación con tabla de verdad (${t.vals.length} filas):  ${t.valido ? 'VÁLIDO' : `INVÁLIDO, contraejemplo ${D.valTexto(t.contra.v, t.vars)}`}`);
        coincide = (t.valido === refuta) || n >= 5000 ? '✓' : '✗';
        lineas.push(`6. ¿Coinciden los dos métodos?  ${coincide === '✓' ? 'Sí ✓' : 'No ✗'}`);
      }
      registro.textContent = lineas.join('\n');
      lectura.set([['cláusulas de partida', String(cls.length)], ['pares resueltos', String(R.pares)], ['veredicto', refuta ? 'válido' : 'inválido'], ['coincide con la tabla', coincide]]);
    }
    verificar();
  }

  /* ---------- Fig. 2: resolución frente a tabla de verdad ---------- */

  function cadena(n) {
    const cl = [['p1']];
    for (let i = 1; i < n; i++) cl.push([`¬p${i}`, `p${i + 1}`]);
    cl.push([`¬p${n}`]);
    return cl;
  }
  function palomar(n) {
    const cl = [], x = (i, j) => `x${i}_${j}`;
    for (let i = 0; i <= n; i++) cl.push(Array.from({ length: n }, (_, j) => x(i, j + 1)));
    for (let j = 1; j <= n; j++) for (let i = 0; i <= n; i++) for (let k = i + 1; k <= n; k++) cl.push([`¬${x(i, j)}`, `¬${x(k, j)}`]);
    return cl;
  }
  const FAM = {
    cadena: { nombre: 'Cadena de implicaciones p₁, p₁ → p₂, …, ¬pₙ', ns: [2, 4, 6, 8, 10, 12, 14, 16, 18], cl: cadena, vars: (n) => n, tope: 5000 },
    palomar: { nombre: 'Principio del palomar: n + 1 palomas en n nidos', ns: [1, 2, 3], cl: palomar, vars: (n) => n * (n + 1), tope: 1500 },
  };
  const memo = {};
  function serie(clave) {
    if (memo[clave]) return memo[clave];
    const F = FAM[clave];
    return (memo[clave] = F.ns.map((n) => {
      const R = D.resolucion(F.cl(n), { estrategia: 'unitaria' });
      let k = 0; while (k < F.tope && !R.listo()) { R.paso(); k++; }
      return { n, v: F.vars(n), filas: 2 ** F.vars(n), pasos: R.pares, ok: R.vacia >= 0, cl: F.cl(n).length };
    }));
  }

  function montarComparacion(cuerpo) {
    let clave = 'cadena', pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Familia de problemas', opciones: Object.entries(FAM).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'filas de la tabla de verdad (2 elevado al número de variables)', forma: 'linea' }, { color: C.s1, texto: 'pares resueltos hasta derivar □', forma: 'linea' }, { color: C.s8, texto: 'círculo vacío: tope alcanzado sin □', forma: 'punto' }]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En una cadena de implicaciones la resolución necesita unos n pasos mientras la tabla crece como 2ⁿ. En el palomar, en cambio, cualquier refutación por resolución es exponencial: la comparación se estrecha y desaparece.');

    function dibujar() {
      const S = serie(clave), { ctx } = lienzo;
      lienzo.limpiar();
      const xs = S.map((o) => o.n);
      pl = VIZ.plano(lienzo, { xmin: Math.min(...xs) - 0.3, xmax: Math.max(...xs) + 0.3, ymin: 1, ymax: Math.max(...S.map((o) => Math.max(o.filas, o.pasos))) * 3 }, { logY: true, etiquetaX: 'n', etiquetaY: 'trabajo', ticksX: xs, formatoX: (v) => String(v) });
      pl.ejes();
      VIZ.trazar(ctx, pl, S.map((o) => [o.n, o.filas]), C.s2, 2);
      VIZ.trazar(ctx, pl, S.map((o) => [o.n, Math.max(1, o.pasos)]), C.s1, 2);
      S.forEach((o) => { VIZ.marcador(ctx, pl.sx(o.n), pl.sy(o.filas), C.s2, 4); ctx.beginPath(); ctx.arc(pl.sx(o.n), pl.sy(Math.max(1, o.pasos)), 5, 0, 7); ctx.fillStyle = o.ok ? C.s1 : C.superficie; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.ok ? C.s1 : C.s8; ctx.stroke(); });
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['n', 'variables', 'cláusulas', 'filas de la tabla', 'pares resueltos', '¿llegó a □?'].map((t) => VIZ.el('th', null, t)))),
        VIZ.el('tbody', null, S.map((o) => VIZ.el('tr', null, [o.n, o.v, o.cl, VIZ.entero(o.filas), VIZ.entero(o.pasos), o.ok ? 'sí' : 'no (tope)'].map((t) => VIZ.el('td', null, String(t))))))));
      const u = S[S.length - 1];
      lectura.set([['mayor n', String(u.n)], ['filas de la tabla', VIZ.entero(u.filas)], ['pares resueltos', VIZ.entero(u.pasos)], ['cociente tabla / resolución', u.pasos ? VIZ.fmt(u.filas / u.pasos, 3) : '—']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const S = serie(clave), o = S.reduce((m, q) => (Math.abs(q.n - pl.ix(x)) < Math.abs(m.n - pl.ix(x)) ? q : m));
      tip.mostrar(x, y, `n = <b>${o.n}</b>` + VIZ.filaTooltip(C.s2, 'filas', VIZ.entero(o.filas)) + VIZ.filaTooltip(C.s1, 'pares resueltos', VIZ.entero(o.pasos)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('auto-verification', {
    intro: String.raw`
      <p>Un <strong>verificador automático</strong> de consecuencias convierte la pregunta «¿se sigue \(\varphi\) de \(\Gamma\)?» en una cadena de pasos mecánicos: negar la conclusión, pasar todo a cláusulas, aplicar resolución
      y mirar si aparece \(\Box\). Toda la lógica de las secciones anteriores se junta en esta tubería.</p>
      <p>Para comprobar que el resultado es de fiar se puede contrastar con una tabla de verdad. La comparación también muestra cuándo la resolución <em>gana</em> a la tabla, y cuándo no.</p>`,
    parametros: [
      ['Premisas y Conclusión (Fig. 1)', String.raw`Cajas de texto con el argumento a comprobar: premisas separadas por «;» y una conclusión. La figura se recalcula al escribir; si una fórmula no se entiende, el panel muestra el mensaje de error.`],
      ['Ejemplos (Fig. 1)', String.raw`Selector con seis argumentos: cadena de implicaciones, casos, afirmar el consecuente, exportación, transitividad de ↔ y conversa. Al elegir uno se reemplazan las premisas y la conclusión.`],
      ['Verificar (Fig. 1)', String.raw`Botón que vuelve a ejecutar la tubería con el texto actual (negación, cláusulas, resolución, veredicto) y la contrasta con la tabla de verdad. La figura también se recalcula sola al escribir.`],
      ['Familia de problemas (Fig. 2)', String.raw`Selector con dos familias: la cadena de implicaciones \(p_1, p_1 \to p_2, \dots, \neg p_n\) y el principio del palomar con \(n+1\) palomas en \(n\) nidos. Cambia la serie de valores de \(n\) que se compara.`],
    ],
    visualizaciones: [
      {
        titulo: 'De las premisas al veredicto',
        descripcion: 'Escriba premisas y conclusión. Siga la tubería completa: negación, cláusulas, resolución y veredicto, contrastado con la tabla de verdad.',
        ayuda: String.raw`<p>Es una figura de texto, sin lienzo: un panel numerado muestra las etapas de la tubería y debajo una lectura con cuatro cifras. Los pasos son: 1) negar la conclusión, 2) pasar cada fórmula a cláusulas (la negada aparece como ¬φ), 3) resolución dando prioridad a las cláusulas cortas, con el número de cláusulas y de pares resueltos, 4) veredicto por resolución (válido si se derivó □; inválido si se saturó sin □; «sin veredicto» si se alcanzó el tope de 5000 pasos). Si hay 10 variables o menos, se añaden 5) la comprobación por tabla de verdad (con un contraejemplo si es inválido) y 6) si ambos métodos coinciden.</p>
          <ul>
          <li><strong>Premisas / Conclusión</strong>: al cambiarlas cambian las cláusulas de partida, los pares resueltos y el veredicto.</li>
          <li><strong>Ejemplos</strong>: carga un argumento ya escrito, válido o no, para ver ambos veredictos.</li>
          <li><strong>Verificar</strong>: reejecuta el cálculo; en la lectura, «coincide con la tabla» muestra ✓ o ✗ (o — si hay más de 10 variables y no se hace la tabla).</li>
          </ul>`,
        montar: montarTuberia,
      },
      {
        titulo: 'Resolución frente a tabla de verdad',
        descripcion: 'En una cadena de implicaciones la resolución es muy superior a la tabla. En el principio del palomar la ventaja se pierde: allí toda refutación crece exponencialmente.',
        ayuda: String.raw`<p>El eje horizontal es \(n\) y el vertical el trabajo, en escala logarítmica. La línea naranja (con cuadrados) cuenta las filas de la tabla de verdad, \(2^{\text{variables}}\); la línea azul cuenta los pares resueltos hasta derivar □. Cada punto azul es un círculo lleno si se derivó □ y vacío (relleno del fondo) si se alcanzó el tope sin □. Debajo hay una tabla con n, variables, cláusulas, filas, pares resueltos y si llegó a □, y una lectura con los valores del mayor \(n\). Al pasar el puntero se ve el \(n\) más cercano con sus dos cifras.</p>
          <ul>
          <li><strong>Familia de problemas</strong>: en la cadena (\(n\) de 2 a 18) la curva azul crece mucho menos que la naranja; en el palomar (\(n\) de 1 a 3, con \(n(n+1)\) variables) ambas crecen con rapidez y la ventaja de la resolución se estrecha.</li>
          </ul>`,
        montar: montarComparacion,
      },
    ],
    teoria: String.raw`
      <h2>La tubería</h2>
      <ol>
        <li><strong>Refutación:</strong> \(\Gamma \models \varphi\) si y solo si \(\Gamma \cup \{\neg\varphi\}\) es insatisfacible.</li>
        <li><strong>Forma clausal:</strong> cada fórmula se lleva a <a href="tema.html?id=cnf-dnf">CNF</a>; el resultado es un conjunto de cláusulas \(S\).</li>
        <li><strong>Saturación:</strong> <a href="tema.html?id=resolution-refutation">resolución</a> con una <a href="tema.html?id=clause-selection">estrategia</a> hasta \(\Box\) o hasta agotar los pares.</li>
        <li><strong>Veredicto:</strong> \(\Box\) derivada \(\Rightarrow\) \(\Gamma \models \varphi\); saturación sin \(\Box\) \(\Rightarrow\) \(\Gamma \not\models \varphi\), y las cláusulas finales describen un contraejemplo.</li>
      </ol>
      <h2>Corrección y confianza</h2>
      <p>Como la resolución es correcta y completa, el veredicto coincide siempre con el de la tabla de verdad. Un verificador real también <em>produce el certificado</em>: la derivación de \(\Box\), que se puede comprobar paso a paso con un programa muy simple —cada línea es una resolvente de dos anteriores—. Esa idea, un buscador complejo y un comprobador simple, es la base de los demostradores confiables.</p>
      <h2>Cuándo gana la resolución</h2>
      <table>
        <tr><th>Problema</th><th>Tabla de verdad</th><th>Resolución</th></tr>
        <tr><td>Cadena de \(n\) implicaciones</td><td>\(2^n\) filas</td><td>\(\Theta(n)\) pasos</td></tr>
        <tr><td>Palomar con \(n+1\) palomas y \(n\) nidos</td><td>\(2^{n(n+1)}\) filas</td><td>\(2^{\Omega(n)}\) pasos (Haken)</td></tr>
      </table>
      <p>El palomar muestra un límite: existen fórmulas insatisfacibles sencillas de enunciar para las cuales ninguna refutación por resolución es corta. Para otras lógicas más expresivas hace falta la
      <a href="tema.html?id=predicates-domains">lógica de predicados</a>, donde la verificación automática ya no es siempre posible (la consecuencia es indecidible, aunque semi-decidible).</p>`,
  });
})();
