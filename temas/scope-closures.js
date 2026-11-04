(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: cadena de alcances ---------- */

  function montarAlcance(cuerpo) {
    const est = { variable: 'x', desde: 'interna', sombra: false };
    let paso = -1, camino = [], hallado = null;
    const alcances = () => [
      { n: 'interna', vars: { z: '"interna"', ...(est.sombra ? { x: '"sombra"' } : {}) } },
      { n: 'externa', vars: { y: '"externa"' } },
      { n: 'global', vars: { x: '"global"' } },
    ];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Variable que se busca', valor: est.variable, opciones: [['x', 'x'], ['y', 'y'], ['z', 'z'], ['w', 'w (no existe)']], alCambiar: (v) => { est.variable = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Se usa dentro de', valor: est.desde, opciones: [['interna', 'interna()'], ['externa', 'externa()'], ['global', 'el nivel global']], alCambiar: (v) => { est.desde = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'interna() declara su propia x (sombreado)', valor: false, alCambiar: (v) => { est.sombra = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 270 : 250) });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'alcance que se revisa' }, { color: C.s6, texto: 'variable encontrada' }, { color: C.s8, texto: 'no existe: ReferenceError' }, { color: C.inactivo, texto: 'sin revisar' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La búsqueda sube de adentro hacia afuera y se detiene en la primera coincidencia: una <code>x</code> interna <em>sombrea</em> a la global.');

    function iniciar() {
      const lista = alcances(), i0 = lista.findIndex((a) => a.n === est.desde);
      camino = lista.slice(i0); paso = -1; hallado = null;
      return (function* () {
        for (let k = 0; k < camino.length; k++) {
          paso = k;
          if (est.variable in camino[k].vars) { hallado = camino[k]; yield; return; }
          yield;
        }
        hallado = false; yield;
      })();
    }
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const lista = alcances();
      const margen = Wd < 600 ? 22 : 40;
      lista.slice().reverse().forEach((a, d) => {
        const x = 6 + d * margen, y = 6 + d * 32, w = Wd - 12 - 2 * d * margen, h = H - 12 - 2 * d * 32;
        const k = camino.indexOf(camino.find((c) => c.n === a.n));
        const rev = k >= 0 && k <= paso, ok = hallado && hallado.n === a.n && k === paso, mal = hallado === false && rev;
        ctx.fillStyle = ok ? VIZ.alfa(C.s6, 0.18) : mal ? VIZ.alfa(C.s8, 0.1) : rev ? VIZ.alfa(C.s1, 0.12) : C.superficie;
        ctx.strokeStyle = ok ? C.s6 : mal ? C.s8 : rev ? C.s1 : C.inactivo; ctx.lineWidth = rev ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke();
        W.texto(ctx, `${a.n === 'global' ? 'ámbito global' : `function ${a.n}()`}`, x + 10, y + 14, { tam: 11, peso: 600, alinear: 'left' });
        const vars = Object.entries(a.vars);
        vars.forEach(([v, val], j) => W.texto(ctx, `let ${v} = ${val}`, x + w - 10, y + 14 + j * 15, { tam: 11, alinear: 'right', color: ok && v === est.variable ? C.s6 : C.tinta, peso: ok && v === est.variable ? 700 : 400 }));
      });
      const reveladas = camino.slice(0, paso + 1).map((c) => c.n);
      registro.textContent = paso < 0 ? `Se busca «${est.variable}» desde ${est.desde === 'global' ? 'el nivel global' : est.desde + '()'}. Pulse «Un paso».`
        : hallado ? `«${est.variable}» se encuentra en ${hallado.n === 'global' ? 'el ámbito global' : hallado.n + '()'} con valor ${hallado.vars[est.variable]}.`
          : hallado === false ? `«${est.variable}» no existe en ninguno de los ámbitos: ReferenceError.` : `«${est.variable}» no está en ${camino[paso].n}: se sube al siguiente ámbito.`;
      lectura.set([['ámbitos revisados', String(reveladas.length)], ['resultado', hallado ? hallado.vars[est.variable] : hallado === false ? 'ReferenceError' : '—']]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cierres con estado privado ---------- */

  function montarContadores(cuerpo) {
    let cont = [], siguiente = 1, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Crear contador', () => { cont.push({ id: siguiente++, n: 0 }); dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => { cont = []; siguiente = 1; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'función devuelta (el cierre)' }, { color: C.s2, texto: 'variable privada capturada' }]);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cada llamada a <code>crearContador()</code> crea su propia <code>cuenta</code>. Haga clic en un contador para llamarlo: los demás no se enteran.');
    cuerpo.insertBefore(el('pre', { class: 'codigo-bdd' }, 'function crearContador() {\n  let cuenta = 0;\n  return () => ++cuenta;   // recuerda «cuenta» aunque crearContador() ya terminó\n}'), lienzo.envoltura);

    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      geo = [];
      const w = Math.min(130, (Wd - 12) / Math.max(1, cont.length) - 8);
      cont.forEach((c, i) => {
        const x = 6 + i * (w + 8), y = 10;
        W.caja(ctx, x, y, w, 36, `contador${c.id}()`, { borde: C.s1, relleno: VIZ.alfa(C.s1, 0.15), tam: 11, peso: 600 });
        VIZ.dist.flecha(ctx, x + w / 2, y + 36, x + w / 2, y + 86, { color: C.tinta2 });
        W.caja(ctx, x, y + 90, w, 70, `cuenta\n${c.n}`, { borde: C.s2, relleno: VIZ.alfa(C.s2, 0.18), tam: 13, peso: 600 });
        geo.push({ x, y, w, h: 160, c });
      });
      if (!cont.length) W.texto(ctx, 'Cree un contador para empezar', Wd / 2, 100, { color: C.apagado, tam: 12 });
      registro.textContent = cont.length ? `${cont.length} cierre(s): ${cont.map((c) => `contador${c.id}() → ${c.n}`).join(', ')}. Cada uno tiene su propio entorno.` : 'Aún no hay cierres.';
    }
    lienzo.alDibujar = dibujar;
    const bajo = (ev) => { const { x, y } = lienzo.posicion(ev); return geo.find((g) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h); };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const g = bajo(ev); if (g) { g.c.n++; dibujar(); } });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const g = bajo(ev); if (!g) return tip.ocultar(); const { x, y } = lienzo.posicion(ev); tip.mostrar(x, y, `<b>contador${g.c.id}()</b><br>cuenta = ${g.c.n}<br>clic: llamar`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: var frente a let en un bucle ---------- */

  function montarBucle(cuerpo) {
    let modo = 'var', fase = 0, i = 0, salidas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Declaración del contador', valor: modo, opciones: [['var', 'var i'], ['let', 'let i']], alCambiar: (v) => { modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    cuerpo.appendChild(el('pre', { class: 'codigo-bdd' }, 'for (var i = 0; i < 3; i++) {   // o: for (let i = 0; …)\n  setTimeout(() => console.log(i), 0);\n}'));
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 190 });
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'variable i (entorno)' }, { color: C.s1, texto: 'callback creado' }, { color: C.s6, texto: 'valor impreso' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ejecute paso a paso: primero el bucle crea tres callbacks; después, ya terminado el bucle, se ejecutan.');
    function iniciar() {
      fase = 0; i = 0; salidas = [];
      return (function* () {
        for (let k = 0; k < 3; k++) { fase = k + 1; i = k; yield; }
        fase = 4; i = 3; yield;
        for (let k = 0; k < 3; k++) { salidas.push(modo === 'var' ? 3 : k); fase = 5 + k; yield; }
      })();
    }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const w = (Wd - 24) / 3;
      for (let k = 0; k < 3; k++) {
        const x = 8 + k * (w + 4), creado = fase >= k + 1;
        W.caja(ctx, x, 6, w - 8, 34, `callback ${k}`, { borde: creado ? C.s1 : C.inactivo, relleno: creado ? VIZ.alfa(C.s1, 0.15) : C.superficie, tam: 11, peso: 600 });
        if (!creado) continue;
        const unico = modo === 'var';
        const bx = unico ? (Wd - 80) / 2 : x, bw = unico ? 80 : w - 8;
        VIZ.dist.flecha(ctx, x + (w - 8) / 2, 40, bx + bw / 2, 84, { color: C.tinta2, ancho: 1.5 });
        if (!unico || k === 0) {
          const v = unico ? i : k;
          W.caja(ctx, bx, 88, bw, 40, `i = ${v}`, { borde: C.s2, relleno: VIZ.alfa(C.s2, 0.2), tam: 13, peso: 600 });
        }
      }
      salidas.forEach((v, k) => W.caja(ctx, 8 + k * (w + 4), 142, w - 8, 30, `imprime ${v}`, { borde: C.s6, relleno: VIZ.alfa(C.s6, 0.2), tam: 12, peso: 600 }));
      registro.textContent = fase === 0 ? 'Aún no empezó el bucle.' : fase <= 3 ? `Iteración ${fase - 1}: se crea el callback ${fase - 1}${modo === 'let' ? ' con su propia copia de i' : ' que apunta a la misma i'}.` : fase === 4 ? 'El bucle terminó' + (modo === 'var' ? ': la única i vale 3.' : ': cada callback conserva su i (0, 1, 2).') : `El callback ${fase - 5} imprime ${salidas[fase - 5]}.`;
      lectura.set([['declaración', modo], ['entornos de i', modo === 'var' ? '1 (compartido)' : '3 (uno por iteración)'], ['salida', salidas.length ? salidas.join(', ') : '—']]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('scope-closures', {
    intro: String.raw`
      <p>El <strong>alcance</strong> (<em>scope</em>) de una variable es la región del programa donde puede usarse. En JavaScript los alcances se anidan: una función ve sus propias variables,
      las de la función que la contiene y las globales, buscando siempre de adentro hacia afuera.</p>
      <p>Una <strong>clausura</strong> (<em>closure</em>) aparece cuando una función recuerda el entorno donde nació, aunque la función externa ya haya terminado. Es la base de los contadores privados,
      de los manejadores de eventos y de los <em>hooks</em> de React.</p>`,
    visualizaciones: [
      { titulo: 'Cadena de alcances', descripcion: 'Elija una variable y desde dónde se usa, y avance paso a paso. Active el sombreado para ver cómo una <code>x</code> interna oculta a la global.', montar: montarAlcance },
      { titulo: 'Contadores con estado privado', descripcion: 'Cree varios contadores y llámelos con un clic: cada clausura mantiene su propia variable, inaccesible desde fuera.', montar: montarContadores },
      { titulo: 'var frente a let en un bucle', descripcion: 'Ejecute el clásico bucle con <code>setTimeout</code> y compare qué imprime con <code>var</code> y con <code>let</code>.', montar: montarBucle },
    ],
    teoria: String.raw`
      <h2>Alcance léxico</h2>
      <p>El alcance se decide por <em>dónde está escrito</em> el código (léxico), no por quién lo llama. Cada función, bloque y módulo crea un <strong>entorno</strong>: una tabla de variables con una referencia al entorno que lo contiene.</p>
      <pre><code>buscar(nombre, entorno):
    mientras entorno ≠ nulo:
        si nombre ∈ entorno.variables: devolver entorno.variables[nombre]
        entorno ← entorno.padre
    lanzar ReferenceError</code></pre>
      <p>Con \(d\) niveles de anidamiento, una búsqueda cuesta a lo más \(d\) consultas de tabla.</p>
      <h2>var, let y const</h2>
      <table>
        <tr><th></th><th>alcance</th><th>reasignable</th><th>notas</th></tr>
        <tr><td><code>var</code></td><td>función</td><td>sí</td><td>se «eleva» (<em>hoisting</em>) con valor <code>undefined</code></td></tr>
        <tr><td><code>let</code></td><td>bloque</td><td>sí</td><td>en un <code>for</code> crea un entorno por iteración</td></tr>
        <tr><td><code>const</code></td><td>bloque</td><td>no</td><td>el valor referenciado sí puede mutar</td></tr>
      </table>
      <h2>Clausuras</h2>
      <p>Una función guarda una referencia a su entorno de creación, no una copia de los valores. Por eso <code>++cuenta</code> modifica la misma variable en cada llamada, y por eso los tres callbacks del bucle con <code>var</code> comparten una única <code>i</code> que vale 3 cuando por fin se ejecutan.</p>
      <div class="recuadro">Úselas para encapsular estado (patrón módulo), crear funciones especializadas (<code>sumarN(n)</code>) y recordar valores en manejadores. Cuidado: una clausura mantiene vivo todo su entorno, lo que puede retener memoria. Relacionado: <a href="tema.html?id=react-hooks">hooks de React</a> y <a href="tema.html?id=dom-events">eventos del DOM</a>.</div>`,
  });
})();
