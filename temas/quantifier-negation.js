(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  const LEYES = ['qAll', 'qEx', 'negImp', 'dmY', 'dmO', 'dn'].map((id) => D.LEYES.find((l) => l.id === id));

  // Modelos aleatorios de 3 elementos para las relaciones que usa la fórmula.
  function modelosAleatorios(preds, cuantos, semilla) {
    const rnd = VIZ.semilla(semilla);
    return Array.from({ length: cuantos }, () => ({ n: 3, rel: Object.fromEntries(preds.map((p) => [p.n, D.relacion(3, p.ar, () => rnd() < 0.5)])) }));
  }

  /* ---------- Fig. 1: empuje la negación hacia los átomos ---------- */

  function montarEmpuje(cuerpo) {
    const INI = '¬∀x (P(x) → ∃y R(x,y))';
    let pasos = [], k = 0, error = '';
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: INI, simbolos: ['¬', '∧', '∨', '→', '∀', '∃', '(', ')'], alCambiar: (r) => { if (r.error) { error = D.mensaje(campo.valor, r); registro.textContent = error; return; } error = ''; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.75, velMax: 4 });
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso aplica una ley a la primera subfórmula donde encaja: ¬∀ → ∃¬, ¬∃ → ∀¬, De Morgan, ¬(A → B) → A ∧ ¬B, ¬¬A → A. Se comprueba cada paso en 80 interpretaciones aleatorias.');

    function iniciar() {
      let a = D.leer(campo.valor);
      const trazas = [{ ast: a, ley: 'fórmula inicial' }];
      for (let guard = 0; guard < 30; guard++) {
        let hecho = false;
        for (const l of LEYES) { const r = D.aplicarLey(a, l); if (r) { a = r; trazas.push({ ast: a, ley: l.nombre }); hecho = true; break; } }
        if (!hecho) break;
      }
      pasos = trazas; k = 0;
      return (function* () { for (k = 1; k < pasos.length; k++) yield; k = pasos.length - 1; })();
    }
    function dibujar() {
      if (error) { registro.textContent = error; return; }
      const preds = D.predicados(pasos[0].ast), modelos = modelosAleatorios(preds, 80, 5);
      const concuerda = (a) => modelos.every((m) => D.evaluaP(a, m, {}) === D.evaluaP(pasos[0].ast, m, {}));
      lista.replaceChildren(...pasos.slice(0, k + 1).map((p, i) => VIZ.el('div', { class: i === k ? 'activa' : null }, `${i}.  ${D.texto(p.ast)}${i ? `     [${p.ley}]  ${D.libres(pasos[0].ast).length ? '' : concuerda(p.ast) ? '✓' : '✗'}` : ''}`)));
      const fin = k === pasos.length - 1;
      registro.textContent = fin ? `Forma final: ${D.texto(pasos[k].ast)}\nLas negaciones solo afectan a fórmulas atómicas (forma normal negativa). Cada paso conservó el valor de verdad en las 80 interpretaciones probadas.` : 'Pulse «Un paso» para aplicar la siguiente ley.';
      lectura.set([['paso', `${k} de ${pasos.length - 1}`], ['¬ restantes sobre compuestas', String(contar(pasos[k].ast))], ['sentencia', D.libres(pasos[0].ast).length ? 'no (hay variables libres)' : 'sí']]);
    }
    const contar = (a) => (a.k === 'not' && a.a.k !== 'pred' && a.a.k !== 'var' && a.a.k !== 'eq' ? 1 : 0) + D.hijos(a).reduce((s, h) => s + contar(h), 0);
    rep.reiniciar();
  }

  /* ---------- Fig. 2: ¿son equivalentes? ---------- */

  const PARES = [
    ['¬∀x P(x)', '∃x ¬P(x)', 'negación de ∀'], ['¬∃x P(x)', '∀x ¬P(x)', 'negación de ∃'], ['∀x (P(x) ∧ Q(x))', '∀x P(x) ∧ ∀x Q(x)', '∀ distribuye sobre ∧'],
    ['∃x (P(x) ∨ Q(x))', '∃x P(x) ∨ ∃x Q(x)', '∃ distribuye sobre ∨'], ['∃x (P(x) ∧ Q(x))', '∃x P(x) ∧ ∃x Q(x)', '∃ NO distribuye sobre ∧'],
    ['∀x (P(x) ∨ Q(x))', '∀x P(x) ∨ ∀x Q(x)', '∀ NO distribuye sobre ∨'], ['∀x ∃y R(x,y)', '∃y ∀x R(x,y)', 'orden de cuantificadores'], ['¬∀x (P(x) → Q(x))', '∃x (P(x) ∧ ¬Q(x))', 'negación de «todo P es Q»'],
  ];

  function montarEquivalencia(cuerpo) {
    let A = D.leer(PARES[0][0]), B = D.leer(PARES[0][1]), n = 3, res = null, error = '';
    const ctl = VIZ.controles(cuerpo);
    const ca = D.campoFormula(cuerpo, ctl, { etiqueta: 'Fórmula A', valor: PARES[0][0], simbolos: ['¬', '∧', '∨', '→', '↔', '∀', '∃', '(', ')'], alCambiar: (r) => { if (r.error) { error = D.mensaje(ca.valor, r); registro.textContent = error; return; } error = ''; A = r.ast; calcular(); } });
    const cb = D.campoFormula(cuerpo, ctl, { etiqueta: 'Fórmula B', valor: PARES[0][1], simbolos: false, alCambiar: (r) => { if (r.error) { error = D.mensaje(cb.valor, r); registro.textContent = error; return; } error = ''; B = r.ast; calcular(); } });
    ctl.selector({ etiqueta: 'Pares conocidos', opciones: PARES.map((p, i) => [i, p[2]]), valor: 0, alCambiar: (v) => { const [a, b] = PARES[+v]; ca.valor = a; cb.valor = b; A = D.leer(a); B = D.leer(b); calcular(); } });
    ctl.rango({ etiqueta: 'Tamaño máximo del dominio', min: 1, max: 4, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (res && res.m ? D.altoModelo(res.m) + 10 : 40) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'el elemento cumple el predicado (o R vale V)', forma: 'punto' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se prueban todas las interpretaciones con dominio de 1 a n elementos. Si alguna da valores distintos a A y a B, se muestra: es un contramodelo de la equivalencia. Que no aparezca ninguno no prueba la equivalencia (solo hasta el tamaño probado).');

    function calcular() {
      const preds = D.predicados(A, B);
      res = { m: null, total: 0, tam: 0 };
      for (let t = 1; t <= n && !res.m; t++) {
        const bits = preds.reduce((s, p) => s + t ** p.ar, 0);
        if (bits > 19) { res.limite = t; break; }
        D.recorrer(preds, t, (m) => { res.total++; if (D.evaluaP(A, m, {}) !== D.evaluaP(B, m, {})) { res.m = m; res.tam = t; return true; } return false; });
      }
      lienzo.ajustar(true);
    }
    function dibujar() {
      lienzo.limpiar();
      if (res.m) { lienzo.ctx.save(); lienzo.ctx.translate(0, 6); D.dibujarModelo(lienzo, res.m); lienzo.ctx.restore(); }
      const f = (a) => (res.m ? (D.evaluaP(a, res.m, {}) ? 'V' : 'F') : '—');
      registro.textContent = error || (res.m ? `No son equivalentes: en la interpretación de ${res.tam} elemento${res.tam > 1 ? 's' : ''} que se muestra, A vale ${f(A)} y B vale ${f(B)}.`
        : `A y B coinciden en las ${VIZ.entero(res.total)} interpretaciones probadas${res.limite ? ` (se detuvo antes de tamaño ${res.limite}: demasiadas interpretaciones)` : ''}. Es evidencia a favor de la equivalencia, no una demostración.`);
      lectura.set([['interpretaciones probadas', VIZ.entero(res.total)], ['mayor dominio probado', String(res.m ? res.tam : Math.min(n, (res.limite || n + 1) - 1))], ['A ≡ B', res.m ? 'no' : 'hasta donde se probó']]);
    }
    lienzo.alDibujar = () => res && dibujar();
    calcular();
  }

  VIZ.registrarTema('quantifier-negation', {
    intro: String.raw`
      <p>Negar «todos los cisnes son blancos» no es decir «ningún cisne es blanco», sino «<strong>existe</strong> un cisne que no es blanco». Un solo contraejemplo basta. Esa es la regla central: <strong>negar un cuantificador lo cambia de tipo</strong> y empuja la negación hacia dentro.</p>
      <p>Con estas leyes cualquier negación se puede llevar hasta los átomos, y se puede decidir cuándo dos fórmulas con cuantificadores dicen lo mismo —o cuándo una creencia popular, como que \(\exists\) distribuye sobre \(\land\), es falsa.</p>`,
    visualizaciones: [
      {
        titulo: 'Empuje la negación hacia los átomos',
        descripcion: 'Reproduzca cómo una negación atraviesa cuantificadores y conectivos paso a paso. Cada paso se verifica en interpretaciones aleatorias.',
        montar: montarEmpuje,
      },
      {
        titulo: '¿Son equivalentes?',
        descripcion: 'Compare dos fórmulas con cuantificadores en todas las interpretaciones pequeñas. Si difieren, verá el contramodelo; pruebe cómo falla \\(\\exists x\\,(P \\land Q) \\equiv \\exists x\\,P \\land \\exists x\\,Q\\).',
        montar: montarEquivalencia,
      },
    ],
    teoria: String.raw`
      <h2>Leyes de negación</h2>
      \[ \neg\forall x\,\varphi \equiv \exists x\,\neg\varphi, \qquad \neg\exists x\,\varphi \equiv \forall x\,\neg\varphi. \]
      <p>Son las leyes de De Morgan generalizadas: \(\forall\) es una conjunción y \(\exists\) una disyunción. Junto con \(\neg(A \to B) \equiv A \land \neg B\), permiten calcular la negación de enunciados típicos:</p>
      <table>
        <tr><th>Enunciado</th><th>Su negación</th></tr>
        <tr><td>\(\forall x\,(P(x) \to Q(x))\): todo \(P\) es \(Q\)</td><td>\(\exists x\,(P(x) \land \neg Q(x))\): algún \(P\) no es \(Q\)</td></tr>
        <tr><td>\(\exists x\,(P(x) \land Q(x))\): algún \(P\) es \(Q\)</td><td>\(\forall x\,(P(x) \to \neg Q(x))\): ningún \(P\) es \(Q\)</td></tr>
        <tr><td>\(\forall x\,\exists y\,R(x,y)\)</td><td>\(\exists x\,\forall y\,\neg R(x,y)\)</td></tr>
      </table>
      <h2>Distribución de cuantificadores</h2>
      <ul>
        <li>\(\forall x\,(A \land B) \equiv \forall x\,A \land \forall x\,B\) y \(\exists x\,(A \lor B) \equiv \exists x\,A \lor \exists x\,B\).</li>
        <li>Solo hay una dirección: \(\exists x\,(A \land B) \models \exists x\,A \land \exists x\,B\) y \(\forall x\,A \lor \forall x\,B \models \forall x\,(A \lor B)\).</li>
      </ul>
      <p>La prueba de que la dirección contraria falla es un contramodelo: en un dominio con dos elementos, \(P = \{a\}\), \(Q = \{b\}\) hacen verdadera a \(\exists x P \land \exists x Q\) y falsa a \(\exists x (P \land Q)\).</p>
      <h2>Cuidado con el recorrido finito</h2>
      <p>Probar todos los dominios hasta cierto tamaño solo da un contramodelo (si existe) o evidencia. En lógica de predicados no hay algoritmo que decida todas las equivalencias: el problema es indecidible. Ver también <a href="tema.html?id=models-countermodels">Models &amp; Countermodels</a> y las equivalencias proposicionales en
      <a href="tema.html?id=logical-equivalence">Logical Equivalence</a>.</p>`,
  });
})();
