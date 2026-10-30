(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  // Expresiones aritméticas: hoja {t, hs: []}, negación {t: '−', hs: [E]}, binarias {t: '+' | '×', hs: [E, E]}.
  const hoja = (t) => ({ t, hs: [] });
  const un = (a) => ({ t: '−', hs: [a] });
  const bin = (t, a, b) => ({ t, hs: [a, b] });
  const txt = (n) => (n.hs.length === 0 ? n.t : n.hs.length === 1 ? n.t + txt(n.hs[0]) : `(${txt(n.hs[0])} ${n.t} ${txt(n.hs[1])})`);

  /* ---------- Fig. 1: construya una expresión con las reglas ---------- */

  function montarConstruccion(cuerpo) {
    let pila = [], log = [];
    const ctl = VIZ.controles(cuerpo);
    const agregar = (n, regla) => { pila.push(n); log.push(regla); dibujar(); };
    for (const b of ['x', 'y', '2', '3']) ctl.boton(`Base: ${b}`, () => agregar(hoja(b), `E → ${b}     (caso base)`));
    ctl.boton('Negar', () => { if (pila.length < 1) return; pila.push(un(pila.pop())); log.push('E → −E     (regla unaria)'); dibujar(); });
    ctl.boton('Sumar', () => { if (pila.length < 2) return; const b = pila.pop(), a = pila.pop(); pila.push(bin('+', a, b)); log.push('E → (E + E)     (regla binaria)'); dibujar(); });
    ctl.boton('Multiplicar', () => { if (pila.length < 2) return; const b = pila.pop(), a = pila.pop(); pila.push(bin('×', a, b)); log.push('E → (E × E)     (regla binaria)'); dibujar(); });
    ctl.boton('Ejemplo', () => { pila = [bin('×', bin('+', hoja('x'), hoja('2')), un(hoja('y')))]; log = ['Se construyó ((x + 2) × −y) con 3 bases y 3 reglas.']; dibujar(); }, { primario: true });
    ctl.boton('Vaciar', () => { pila = []; log = []; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 70 + 54 * Math.max(1, ...pila.map((n) => D.profGen(n))) });
    VIZ.leyenda(cuerpo, [{ color: VIZ.alfa(C.s6, 0.25), borde: C.s6, texto: 'caso base (hoja)', forma: 'cuadro' }, { color: C.superficie, borde: C.tinta2, texto: 'construido con una regla', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada botón es una regla: las bases crean expresiones, y las reglas combinan las últimas de la pila. Solo se obtienen expresiones bien formadas: nada más pertenece al conjunto.');

    function dibujar() {
      lienzo.ajustar(true);
    }
    function pintar() {
      lienzo.limpiar();
      const W = lienzo.ancho, totalH = pila.reduce((s, n) => s + Math.max(1, hojas(n)), 0) || 1;
      let x = 0;
      pila.forEach((n, i) => {
        const w = Math.max(70, (W * Math.max(1, hojas(n))) / totalH);
        D.arbol(lienzo, n, { ...D.GEN, x0: x, ancho: w, fila: 54, relleno: (r) => (r.n.hs.length ? null : VIZ.alfa(C.s6, 0.25)), borde: (r) => (r.n.hs.length ? C.tinta2 : C.s6) });
        if (i < pila.length - 1) { lienzo.ctx.strokeStyle = C.rejilla; lienzo.ctx.beginPath(); lienzo.ctx.moveTo(x + w, 10); lienzo.ctx.lineTo(x + w, lienzo.alto - 10); lienzo.ctx.stroke(); }
        x += w;
      });
      if (!pila.length) D.texto2(lienzo.ctx, 'La pila de expresiones está vacía: agregue una base.', W / 2, 40, { color: C.apagado, px: 12 });
      registro.textContent = log.slice(-6).join('\n') || 'Aún no se ha aplicado ninguna regla.';
      const top = pila[pila.length - 1];
      lectura.set([['expresiones en la pila', String(pila.length)], ['última', top ? txt(top) : '—'], ['tamaño (nodos)', top ? String(size(top)) : '—'], ['profundidad', top ? String(D.profGen(top)) : '—']]);
    }
    const hojas = (n) => (n.hs.length ? n.hs.reduce((s, h) => s + hojas(h), 0) : 1);
    const size = (n) => 1 + n.hs.reduce((s, h) => s + size(h), 0);
    lienzo.alDibujar = pintar;
    dibujar();
  }

  /* ---------- Fig. 2: derivación de una expresión ---------- */

  function analizar(s) {
    const t = s.replace(/\s+/g, '').replace(/\*/g, '×').replace(/-/g, '−');
    let i = 0;
    const err = (m) => { throw new Error(m); };
    function e() { let a = tt(); while (t[i] === '+') { i++; a = bin('+', a, tt()); } return a; }
    function tt() { let a = f(); while (t[i] === '×') { i++; a = bin('×', a, f()); } return a; }
    function f() {
      if (t[i] === '−') { i++; return un(f()); }
      if (t[i] === '(') { i++; const a = e(); if (t[i] !== ')') err('falta cerrar un paréntesis'); i++; return a; }
      const m = /^[0-9]+|^[a-z]/.exec(t.slice(i));
      if (!m) err(i >= t.length ? 'la expresión está incompleta' : `no se esperaba «${t[i]}»`);
      i += m[0].length;
      return hoja(m[0]);
    }
    const a = e();
    if (i < t.length) err(`sobra «${t[i]}»`);
    return a;
  }

  function montarDerivacion(cuerpo) {
    let arbol = analizar('(x + 2) * −y + 3'), pasos = [], k = 0, error = '';
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Expresión (use + × − y paréntesis)', valor: '(x + 2) * -y + 3', alCambiar: () => aplicar(), alEnter: () => aplicar() });
    campo.input.parentNode.classList.add('campo-formula');
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 70 + 54 * D.profGen(arbol) });
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'símbolo E todavía sin expandir', forma: 'cuadro' },
      { color: C.s2, texto: 'expansión de este paso', forma: 'cuadro' },
      { color: C.tinta, texto: 'ya expandido', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo, { grande: true });
    VIZ.nota(cuerpo, 'Cada paso reemplaza el E más a la izquierda por el lado derecho de una regla. El árbol muestra qué regla produjo cada nodo.');

    function aplicar() {
      try { arbol = analizar(campo.valor); error = ''; } catch (e) { error = e.message; }
      lienzo.ajustar(true);
      rep.reiniciar();
    }
    const expandir = (n) => (n.hs.length === 0 ? [n.t] : n.hs.length === 1 ? ['−', n.hs[0]] : ['(', n.hs[0], ` ${n.t} `, n.hs[1], ')']);
    const regla = (n) => (n.hs.length === 0 ? `E → ${n.t}` : n.hs.length === 1 ? 'E → −E' : `E → (E ${n.t} E)`);
    function iniciar() {
      pasos = D.derivar(arbol, expandir);
      k = 0;
      return (function* () { for (k = 1; k < pasos.length; k++) yield; k = pasos.length - 1; })();
    }
    function dibujar() {
      lienzo.limpiar();
      const hechos = new Set(pasos.slice(1, k + 1).map((p) => p.nodo));
      const actual = k > 0 ? pasos[k].nodo : null;
      D.arbol(lienzo, arbol, { ...D.GEN, fila: 54, relleno: (r) => (hechos.has(r.n) ? C.superficie : C.neutro), borde: (r) => (r.n === actual ? C.s2 : hechos.has(r.n) ? C.tinta : C.inactivo), anillo: (r) => (r.n === actual ? C.s2 : null), texto: (r) => (hechos.has(r.n) ? C.tinta : C.apagado) });
      registro.textContent = error ? `Error: ${error}.` : pasos.slice(0, k + 1).map((p, i) => `${i ? '⇒' : ' '} ${D.formaTxt(p.forma)}${i ? `     [${regla(p.nodo)}]` : ''}`).join('\n');
    }
    lienzo.alDibujar = () => pasos.length && dibujar();
    aplicar();
  }

  VIZ.registrarTema('structural-definitions', {
    intro: String.raw`
      <p>Para describir objetos que tienen forma de árbol —expresiones aritméticas, fórmulas, listas, programas— se usa una <strong>definición estructural</strong>: se indican los
      <em>casos base</em> (los objetos más simples) y las <em>reglas de construcción</em> que arman objetos nuevos a partir de otros.</p>
      <p>Cada objeto se corresponde con un <strong>árbol de derivación</strong> que registra cómo se construyó. Ese árbol es lo que permite después definir funciones y demostrar propiedades siguiendo la estructura.</p>`,
    visualizaciones: [
      {
        titulo: 'Construya una expresión con las reglas',
        descripcion: 'Use las bases y las reglas para armar expresiones. Observe que el árbol crece con la misma forma que la construcción, y que tamaño y profundidad se leen directamente de él.',
        montar: montarConstruccion,
      },
      {
        titulo: 'Derivación de una expresión',
        descripcion: 'Escriba una expresión y reproduzca su derivación por la izquierda. Pruebe agregar o quitar paréntesis y vea cómo cambia el árbol.',
        montar: montarDerivacion,
      },
    ],
    teoria: String.raw`
      <h2>Gramática de las expresiones</h2>
      <p>El conjunto \(\mathcal{E}\) de expresiones se define estructuralmente por:</p>
      \[ E \;::=\; x \;\mid\; y \;\mid\; n \;\mid\; -E \;\mid\; (E + E) \;\mid\; (E \times E) \]
      <p>Las tres primeras alternativas son los <strong>casos base</strong>; las otras tres, las <strong>reglas de construcción</strong>. Como todo conjunto
      <a href="tema.html?id=inductive-sets">definido inductivamente</a>, \(\mathcal{E}\) es el menor conjunto cerrado bajo esas reglas.</p>
      <h2>Árbol de derivación</h2>
      <p>Una derivación escoge una regla por cada \(E\) que aparece. El árbol cuyos nodos son esas reglas es el árbol de derivación. Cuando la gramática es <em>no ambigua</em> (como la completamente parentizada de arriba), cada expresión tiene un único árbol,
      y se puede leer su estructura sin duda: \(((x+2)\times -y)\) y \((x + (2 \times -y))\) son árboles distintos.</p>
      <h2>Funciones por recursión estructural</h2>
      <p>Una función sobre \(\mathcal{E}\) se define dando su valor en cada base y en cada regla en términos de los valores de las partes. Por ejemplo, el tamaño:</p>
      \[ \operatorname{tam}(x) = 1, \quad \operatorname{tam}(-A) = 1 + \operatorname{tam}(A), \quad \operatorname{tam}(A \,\square\, B) = 1 + \operatorname{tam}(A) + \operatorname{tam}(B). \]
      <p>Las métricas de tamaño y profundidad se estudian en <a href="tema.html?id=expression-metrics">Depth, Size &amp; Structural Recursion</a>, y las propiedades de estas funciones se demuestran con
      <a href="tema.html?id=structural-induction">inducción estructural</a>.</p>`,
  });
})();
