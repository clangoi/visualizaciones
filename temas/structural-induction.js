(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Propiedades que se verifican nodo por nodo ---------- */

  // datos(nodo, hijos) → {v: valor del nodo, nota, ok, texto}
  const PROP = {
    hojas: {
      nombre: 'hojas = conectivos binarios + 1',
      datos: (a, h) => {
        const [hh, bb] = h.length === 0 ? [1, 0] : h.length === 1 ? h[0].v : [h[0].v[0] + h[1].v[0], h[0].v[1] + h[1].v[1] + 1];
        return { v: [hh, bb], nota: `${hh}/${bb}`, ok: hh === bb + 1, texto: `hojas = ${hh}, binarios = ${bb}: ${hh} = ${bb} + 1` };
      },
    },
    tam: {
      nombre: 'tamaño ≤ 2^(profundidad + 1) − 1',
      datos: (a, h) => {
        const t = 1 + h.reduce((s, x) => s + x.v[0], 0), d = h.length ? 1 + Math.max(...h.map((x) => x.v[1])) : 0;
        return { v: [t, d], nota: `${t}≤${2 ** (d + 1) - 1}`, ok: t <= 2 ** (d + 1) - 1, texto: `tamaño = ${t}, profundidad = ${d}: ${t} ≤ 2^${d + 1} − 1 = ${2 ** (d + 1) - 1}` };
      },
    },
    parent: {
      nombre: 'tantos « ( » como « ) » (forma totalmente parentizada)',
      datos: (a, h) => {
        const [o, c] = h.length === 2 ? [h[0].v[0] + h[1].v[0] + 1, h[0].v[1] + h[1].v[1] + 1] : h.length === 1 ? h[0].v : [0, 0];
        return { v: [o, c], nota: `(${o} )${c}`, ok: o === c, texto: `abiertos = ${o}, cerrados = ${c}` };
      },
    },
  };

  /* ---------- Fig. 1: demostración sobre un árbol ---------- */

  function montarDemostracion(cuerpo) {
    let clave = 'hojas', ast = D.leer('(p ∧ ¬q) → (r ∨ (p ↔ q))'), orden = [], datos = new Map(), k = 0, error = '';
    const ctl = VIZ.controles(cuerpo);
    const campo = D.campoFormula(cuerpo, ctl, { valor: '(p ∧ ¬q) → (r ∨ (p ↔ q))', alCambiar: (r) => { if (r.error) { error = D.mensaje(campo.valor, r); registro.textContent = error; return; } error = ''; ast = r.ast; lienzo.ajustar(true); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Propiedad P(φ)', opciones: Object.entries(PROP).map(([c, v]) => [c, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => D.altoArbol(ast) });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'subfórmula que se está verificando', forma: 'cuadro' },
      { color: VIZ.alfa(C.s1, 0.2), borde: C.s1, texto: 'hijos: se usa su hipótesis inductiva', forma: 'cuadro' },
      { color: C.superficie, borde: C.tinta, texto: 'P ya verificada', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La inducción estructural es un recorrido de las hojas hacia la raíz: en cada nodo se supone P para los hijos y se verifica P para el nodo.');

    function iniciar() {
      orden = []; datos = new Map(); k = 0;
      (function post(a) { D.hijos(a).forEach(post); orden.push(a); })(ast);
      return (function* () {
        for (const a of orden) {
          const hijos = D.hijos(a).map((x) => datos.get(x));
          datos.set(a, PROP[clave].datos(a, hijos));
          k++;
          yield;
        }
      })();
    }
    function dibujar() {
      lienzo.limpiar();
      const a = k ? orden[k - 1] : null, hijos = a ? D.hijos(a) : [];
      D.arbol(lienzo, ast, {
        relleno: (r) => (r.n === a ? VIZ.alfa(C.s2, 0.3) : hijos.includes(r.n) ? VIZ.alfa(C.s1, 0.2) : null),
        borde: (r) => (r.n === a ? C.s2 : hijos.includes(r.n) ? C.s1 : datos.has(r.n) ? C.tinta : C.inactivo),
        nota: (r) => (datos.has(r.n) ? datos.get(r.n).nota : null),
      });
      if (error) registro.textContent = error;
      else if (!a) registro.textContent = 'Pulse «Un paso»: se empieza por las hojas (casos base).';
      else {
        const d = datos.get(a);
        const hip = hijos.length ? `Hipótesis inductiva: P vale para ${hijos.map((x) => `«${D.texto(x)}»`).join(' y ')}.\n` : 'Caso base (átomo).\n';
        registro.textContent = `${hip}Subfórmula «${D.texto(a)}»: ${d.texto} ${d.ok ? '✓' : '✗'}`;
      }
      lectura.set([['propiedad', PROP[clave].nombre], ['subfórmulas verificadas', `${k} de ${orden.length}`], ['conclusión', k === orden.length && orden.length ? `P(φ) vale para «${D.texto(ast)}»` : 'en curso']]);
    }
    lienzo.alDibujar = () => orden.length && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: busque contraejemplos ---------- */

  const cuenta = (a, f) => (f(a) ? 1 : 0) + D.hijos(a).reduce((s, h) => s + cuenta(h, f), 0);
  const CAND = {
    hojas: { nombre: 'hojas = binarios + 1', ok: (a) => cuenta(a, (x) => D.hijos(x).length === 0) === cuenta(a, (x) => D.hijos(x).length === 2) + 1 },
    tam: { nombre: 'tamaño ≥ profundidad + 1', ok: (a) => D.tam(a) >= D.prof(a) + 1 },
    neg: { nombre: 'hay menos ¬ que variables', ok: (a) => cuenta(a, (x) => x.k === 'not') < cuenta(a, (x) => x.k === 'var') },
    bin: { nombre: 'tiene algún conectivo binario', ok: (a) => cuenta(a, (x) => D.hijos(x).length === 2) > 0 },
    mas: { nombre: 'más variables que conectivos', ok: (a) => cuenta(a, (x) => x.k === 'var') > cuenta(a, (x) => D.hijos(x).length > 0) },
    par: { nombre: 'tamaño impar', ok: (a) => D.tam(a) % 2 === 1 },
  };

  function montarContraejemplos(cuerpo) {
    let clave = 'neg', semilla = 1, mejor = null, cumplen = 0, total = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Propiedad a poner a prueba', opciones: Object.entries(CAND).map(([c, v]) => [c, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; muestrear(); } });
    ctl.boton('Nuevo muestreo', () => { semilla++; muestrear(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (mejor ? D.altoArbol(mejor) : 90) });
    cuerpo.dataset.sinLeyenda = 'solo se dibuja el árbol del contraejemplo más pequeño';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Se generan 3000 fórmulas al azar. Una propiedad verdadera para todas las fórmulas no tiene contraejemplo (aunque eso no la demuestra); una falsa suele delatarse con una fórmula pequeña.');

    function muestrear() {
      const rnd = VIZ.semilla(semilla * 313);
      mejor = null; cumplen = 0; total = 3000;
      for (let i = 0; i < total; i++) {
        const a = D.aleatoria(rnd, ['p', 'q', 'r'], 1 + Math.floor(rnd() * 5), ['and', 'or', 'imp', 'iff', 'not']);
        if (CAND[clave].ok(a)) cumplen++;
        else if (!mejor || D.tam(a) < D.tam(mejor)) mejor = a;
      }
      lienzo.ajustar(true);
      for (const a of [D.leer('p'), D.leer('¬p'), D.leer('¬¬p')]) if (!CAND[clave].ok(a) && (!mejor || D.tam(a) < D.tam(mejor))) { mejor = a; lienzo.ajustar(true); }
    }
    function dibujar() {
      lienzo.limpiar();
      if (mejor) D.arbol(lienzo, mejor, { borde: () => C.s8, relleno: () => VIZ.alfa(C.s8, 0.12) });
      else D.texto2(lienzo.ctx, 'Sin contraejemplos en la muestra', lienzo.ancho / 2, 44, { color: C.s6, px: 13, peso: 600 });
      registro.textContent = mejor
        ? `La propiedad «${CAND[clave].nombre}» falla en ${total - cumplen} fórmulas. La más pequeña es «${D.texto(mejor)}»: una inducción estructural no puede probar la propiedad, porque el paso falla en este nodo.`
        : `Ninguna de las ${total} fórmulas viola «${CAND[clave].nombre}». Eso es evidencia, no demostración: se prueba con inducción estructural, verificando que cada regla conserva la propiedad.`;
      lectura.set([['fórmulas generadas', String(total)], ['la cumplen', String(cumplen)], ['contraejemplos', String(total - cumplen)], ['menor contraejemplo (nodos)', mejor ? String(D.tam(mejor)) : '—']]);
    }
    lienzo.alDibujar = dibujar;
    muestrear();
  }

  VIZ.registrarTema('structural-induction', {
    intro: String.raw`
      <p>La <strong>inducción estructural</strong> es la inducción para objetos definidos por reglas, como las fórmulas. En vez de recorrer números, se recorre la construcción:
      se prueba la propiedad para los <em>casos base</em> y se prueba que cada <em>regla de construcción</em> la conserva.</p>
      <p>Es una demostración que se lee como un recorrido del árbol sintáctico de abajo hacia arriba. Cuando una regla no conserva la propiedad, aparece de inmediato el contraejemplo más pequeño.</p>`,
    visualizaciones: [
      {
        titulo: 'La demostración como recorrido del árbol',
        descripcion: 'Escriba una fórmula y verifique una propiedad nodo por nodo: en cada paso se usa la propiedad de los hijos para concluirla en el padre.',
        montar: montarDemostracion,
      },
      {
        titulo: 'Busque contraejemplos',
        descripcion: 'Ponga a prueba propiedades verdaderas y falsas con miles de fórmulas aleatorias. Las falsas se delatan con una fórmula mínima; las verdaderas no tienen ninguna.',
        montar: montarContraejemplos,
      },
    ],
    teoria: String.raw`
      <h2>El principio</h2>
      <div class="recuadro"><strong>Inducción estructural sobre fórmulas.</strong> Sea \(P\) una propiedad de fórmulas. Si
      <ol>
        <li>\(P(p)\) para cada variable proposicional \(p\);</li>
        <li>\(P(A) \Rightarrow P(\neg A)\);</li>
        <li>\(P(A) \land P(B) \Rightarrow P(A \circ B)\) para cada conectivo binario \(\circ\);</li>
      </ol>
      entonces \(P(\varphi)\) para toda fórmula \(\varphi\).</div>
      <p>Es un caso de la inducción sobre un <a href="tema.html?id=inductive-sets">conjunto definido inductivamente</a>; también se puede ver como una <a href="tema.html?id=simple-vs-strong">inducción fuerte</a> sobre el tamaño de la fórmula.</p>
      <h2>Ejemplo: hojas y conectivos binarios</h2>
      <p>Afirmación: toda fórmula tiene exactamente un conectivo binario menos que hojas. Base: un átomo tiene 1 hoja y 0 conectivos. Negación: no cambia hojas ni binarios. Binaria: si \(A\) tiene \(h_A\) hojas y \(b_A = h_A - 1\) binarios, y análogamente \(B\),
      entonces \(A \circ B\) tiene \(h_A + h_B\) hojas y \(b_A + b_B + 1 = (h_A + h_B) - 1\) binarios.</p>
      <h2>Ejemplo: paréntesis balanceados</h2>
      <p>En la forma totalmente parentizada \((A \circ B)\), el número de «(» es \(o_A + o_B + 1\) y el de «)» es \(c_A + c_B + 1\); como \(o_A = c_A\) y \(o_B = c_B\) por hipótesis, también coinciden. El mismo argumento aparece en
      <a href="tema.html?id=wff">la gramática de las fórmulas bien formadas</a>.</p>
      <h2>Errores comunes</h2>
      <p>Una propiedad puede fallar en una sola regla —por ejemplo, «hay menos \(\neg\) que variables» falla con \(\neg\neg p\)— y entonces el recorrido no se puede completar. Hay que probar <em>todas</em> las reglas, incluidas las unarias.
      Recuerde también que una propiedad que se cumple en muchos ejemplos no está demostrada hasta cerrar todos los casos de la definición.</p>`,
  });
})();
