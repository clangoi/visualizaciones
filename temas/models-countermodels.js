(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const leerLista = (txt) => txt.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const r = D.analizar(s); if (r.error) throw new Error(`«${s}»: ${r.error}`); return r.ast; });

  // Busca una interpretación (y valores para las constantes libres) que haga verdaderas las premisas y falsa la conclusión.
  function buscar(prem, conc, maxN, buscarModelo = false) {
    const preds = D.predicados(...prem, conc), consts = [...new Set([...prem, conc].flatMap(D.libres))];
    let revisadas = 0;
    for (let n = 1; n <= maxN; n++) {
      if (preds.reduce((s, p) => s + n ** p.ar, 0) > 19) return { limite: n, revisadas };
      let hallado = null;
      D.recorrer(preds, n, (m) => {
        const tot = n ** consts.length;
        for (let c = 0; c < tot; c++) {
          const asig = {};
          consts.forEach((x, q) => { asig[x] = Math.floor(c / n ** q) % n; });
          revisadas++;
          const premV = prem.every((a) => D.evaluaP(a, m, asig));
          if (buscarModelo ? premV : premV && !D.evaluaP(conc, m, asig)) { hallado = { m, asig, n }; return true; }
        }
        return false;
      });
      if (hallado) return { ...hallado, revisadas };
    }
    return { revisadas };
  }

  /* ---------- Fig. 1: contramodelos ---------- */

  const EJ = [
    ['∀x P(x)', '∃x P(x)', 'toda cosa → alguna cosa (válido)'], ['∃x P(x)', '∀x P(x)', 'alguna cosa → toda cosa (inválido)'],
    ['∃y ∀x R(x,y)', '∀x ∃y R(x,y)', 'un y para todos → cada x tiene un y (válido)'], ['∀x ∃y R(x,y)', '∃y ∀x R(x,y)', 'cada x tiene un y → un y para todos (inválido)'],
    ['∀x (P(x) → Q(x)); P(a)', 'Q(a)', 'modus ponens con constante (válido)'], ['∀x (P(x) ∨ Q(x))', '∀x P(x) ∨ ∀x Q(x)', '∀ sobre ∨ (inválido)'],
  ];

  function montarContramodelo(cuerpo) {
    let n = 3, r = null, prem = leerLista(EJ[3][0]), conc = D.leer(EJ[3][1]);
    const ctl = VIZ.controles(cuerpo);
    const cp = ctl.texto({ etiqueta: 'Premisas (separadas por «;»)', valor: EJ[3][0], alCambiar: () => leer() });
    const cc = ctl.texto({ etiqueta: 'Conclusión', valor: EJ[3][1], alCambiar: () => leer() });
    for (const c of [cp, cc]) { c.input.parentNode.classList.add('campo-formula'); c.input.addEventListener('input', () => leer()); }
    ctl.selector({ etiqueta: 'Ejemplos', opciones: EJ.map((e, i) => [i, e[2]]), valor: 3, alCambiar: (v) => { cp.valor = EJ[+v][0]; cc.valor = EJ[+v][1]; leer(); } });
    ctl.rango({ etiqueta: 'Tamaño máximo del dominio', min: 1, max: 4, valor: n, alCambiar: (v) => { n = v; leer(); } });
    D.simbolos(cuerpo, cp.input, ['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')', ';']);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (r && r.m ? D.altoModelo(r.m) + 10 : 30) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'el elemento cumple el predicado (o R vale V)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Un contramodelo es una interpretación que hace verdaderas todas las premisas y falsa la conclusión: refuta el razonamiento. Si hay constantes (a, b), también se prueban todas sus asignaciones.');

    function leer() {
      try { prem = leerLista(cp.valor); conc = D.leer(cc.valor); } catch (e) { registro.textContent = e.message; return; }
      r = buscar(prem, conc, n);
      lienzo.ajustar(true);
    }
    function dibujar() {
      if (!r) return;
      lienzo.limpiar();
      if (r.m) { lienzo.ctx.save(); lienzo.ctx.translate(0, 6); D.dibujarModelo(lienzo, r.m); lienzo.ctx.restore(); }
      const cs = r.m ? Object.entries(r.asig) : [];
      registro.textContent = r.m ? `Contramodelo con ${r.n} elemento${r.n > 1 ? 's' : ''}${cs.length ? ` (${cs.map(([k, v]) => `${k} = ${D.nombreElem(v)}`).join(', ')})` : ''}: las premisas son verdaderas y «${D.texto(conc)}» es falsa. El razonamiento NO es válido.`
        : `No hay contramodelo con dominios de hasta ${r.limite ? r.limite - 1 : n} elementos (${VIZ.entero(r.revisadas)} casos revisados)${r.limite ? '; se detuvo por tamaño' : ''}. Es evidencia de validez (el razonamiento puede ser válido), no una prueba.`;
      lectura.set([['casos revisados', VIZ.entero(r.revisadas)], ['contramodelo', r.m ? `sí, con ${r.n} elemento${r.n > 1 ? 's' : ''}` : 'no encontrado'], ['dominio máximo', String(r.limite ? r.limite - 1 : n)]]);
    }
    lienzo.alDibujar = dibujar;
    leer();
  }

  /* ---------- Fig. 2: silogismos ---------- */

  const SIL = [
    { n: 'Barbara', p: ['∀x (B(x) → C(x))', '∀x (A(x) → B(x))'], c: '∀x (A(x) → C(x))', e: 'Todos los B son C. Todos los A son B. Luego todos los A son C.' },
    { n: 'Celarent', p: ['∀x (B(x) → ¬C(x))', '∀x (A(x) → B(x))'], c: '∀x (A(x) → ¬C(x))', e: 'Ningún B es C. Todos los A son B. Luego ningún A es C.' },
    { n: 'Darii', p: ['∀x (B(x) → C(x))', '∃x (A(x) ∧ B(x))'], c: '∃x (A(x) ∧ C(x))', e: 'Todos los B son C. Algún A es B. Luego algún A es C.' },
    { n: 'Ferio', p: ['∀x (B(x) → ¬C(x))', '∃x (A(x) ∧ B(x))'], c: '∃x (A(x) ∧ ¬C(x))', e: 'Ningún B es C. Algún A es B. Luego algún A no es C.' },
    { n: 'Falacia: dos particulares', p: ['∃x (A(x) ∧ B(x))', '∃x (B(x) ∧ C(x))'], c: '∃x (A(x) ∧ C(x))', e: 'Algún A es B. Algún B es C. Luego algún A es C. (Los B pueden ser distintos.)' },
    { n: 'Falacia: medio no distribuido', p: ['∀x (A(x) → B(x))', '∀x (C(x) → B(x))'], c: '∀x (A(x) → C(x))', e: 'Todos los A son B. Todos los C son B. Luego todos los A son C. (Los gatos y los perros son animales.)' },
    { n: 'Falacia: existencia', p: ['∀x (A(x) → B(x))'], c: '∃x (A(x) ∧ B(x))', e: 'Todos los A son B. Luego algún A es B. (Falla si no hay ningún A.)' },
  ];

  function montarSilogismos(cuerpo) {
    let i = 0, r = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Silogismo', opciones: SIL.map((s, k) => [k, s.n]), valor: 0, alCambiar: (v) => { i = +v; calcular(); } });
    const ej = VIZ.registro(cuerpo);
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (r && r.m ? D.altoModelo(r.m) + 10 : 30) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'el elemento pertenece al conjunto A, B o C', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los silogismos válidos no admiten contramodelo; los inválidos sí, con muy pocos elementos. Si el silogismo es válido, se muestra en cambio un modelo cualquiera de las premisas.');

    function calcular() {
      const S = SIL[i], prem = S.p.map(D.leer), conc = D.leer(S.c);
      const contra = buscar(prem, conc, 3);
      r = contra.m ? { ...contra, valido: false } : { ...buscar(prem, conc, 3, true), valido: true };
      lienzo.ajustar(true);
    }
    function dibujar() {
      const S = SIL[i];
      lienzo.limpiar();
      if (r.m) { lienzo.ctx.save(); lienzo.ctx.translate(0, 6); D.dibujarModelo(lienzo, r.m); lienzo.ctx.restore(); }
      ej.textContent = `${S.e}\nFormalización:  ${S.p.join('  ;  ')}  ⊨  ${S.c}`;
      registro.textContent = r.valido ? `VÁLIDO (no hay contramodelo con dominios de hasta 3 elementos). Se muestra un modelo de las premisas: en él, la conclusión también es verdadera.`
        : `INVÁLIDO. Contramodelo con ${r.n} elemento${r.n > 1 ? 's' : ''}: las premisas son verdaderas y la conclusión es falsa.`;
      lectura.set([['forma', S.n], ['veredicto', r.valido ? 'válido' : 'inválido'], ['casos revisados', VIZ.entero(r.revisadas)]]);
    }
    lienzo.alDibujar = () => r && dibujar();
    calcular();
  }

  VIZ.registrarTema('models-countermodels', {
    intro: String.raw`
      <p>En lógica de predicados, \(\Gamma \models \varphi\) significa que <em>toda interpretación</em> que haga verdaderas las premisas hace verdadera la conclusión. Ahora las interpretaciones son estructuras, no filas de una tabla, y hay infinitas.
      Aun así, el método para refutar un argumento es el mismo: encontrar un <strong>contramodelo</strong>, una interpretación que cumple las premisas y viola la conclusión.</p>
      <p>Los contramodelos suelen ser pequeñísimos. Para razonamientos que parecen razonables —como los silogismos de Aristóteles— permiten separar con claridad los válidos de los falaces.</p>`,
    visualizaciones: [
      {
        titulo: 'Busque un contramodelo',
        descripcion: 'Escriba premisas y una conclusión con cuantificadores y busque una interpretación pequeña que los refute. Contraste \\(\\forall\\exists\\) con \\(\\exists\\forall\\) y \\(\\forall x\\,P \\to \\exists x\\,P\\).',
        montar: montarContramodelo,
      },
      {
        titulo: 'Silogismos de Aristóteles',
        descripcion: 'Cuatro formas válidas y tres falacias clásicas. En las falacias aparece el contramodelo que las refuta; en las válidas, un modelo de las premisas.',
        montar: montarSilogismos,
      },
    ],
    teoria: String.raw`
      <h2>Consecuencia, validez y modelos</h2>
      <table>
        <tr><th>Noción</th><th>Definición</th></tr>
        <tr><td>Modelo de \(\varphi\)</td><td>interpretación \(\mathcal{I}\) con \(\mathcal{I} \models \varphi\)</td></tr>
        <tr><td>Satisfacible</td><td>tiene algún modelo</td></tr>
        <tr><td>Válida</td><td>todas las interpretaciones son modelos (por ejemplo \(\forall x\,P(x) \to \exists x\,P(x)\))</td></tr>
        <tr><td>Consecuencia \(\Gamma \models \varphi\)</td><td>todo modelo de \(\Gamma\) es modelo de \(\varphi\)</td></tr>
        <tr><td>Contramodelo</td><td>modelo de \(\Gamma \cup \{\neg\varphi\}\)</td></tr>
      </table>
      <h2>Por qué se supone un dominio no vacío</h2>
      <p>Con la convención usual, \(\forall x\,P(x) \to \exists x\,P(x)\) es válida: siempre hay al menos un elemento. Si se admitieran dominios vacíos dejaría de serlo; es la razón por la que «Todos los A son B, luego algún A es B» es una falacia en la lógica moderna (los A pueden ser ninguno).</p>
      <h2>Qué se puede decidir</h2>
      <ul>
        <li>Para <em>lógica proposicional</em>, la validez es decidible (tabla de verdad, resolución).</li>
        <li>Para la <em>lógica de predicados</em>, la validez es solo <em>semidecidible</em> (Church–Turing): si un razonamiento es válido, hay un procedimiento que lo confirma; si no, puede no terminar.</li>
        <li>Si hay un contramodelo finito, la búsqueda lo hallará tarde o temprano. Si solo hay contramodelos infinitos (como \(\forall x\exists y\,R \land \forall x \neg R(x,x) \land \text{transitiva}\)), la búsqueda por tamaño no los verá.</li>
      </ul>
      <h2>Conexiones</h2>
      <p>Las equivalencias y la negación de cuantificadores se ven en <a href="tema.html?id=quantifier-negation">Negating Quantifiers</a>; el caso proposicional, con la tabla como método, en <a href="tema.html?id=logical-consequence">Logical Consequence</a>.</p>`,
  });
})();
