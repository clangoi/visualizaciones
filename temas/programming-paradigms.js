(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const PARADIGMAS = {
    imperativo: {
      t: 'Imperativo', color: C.s1, mut: 3, efectos: 'modifica variables locales',
      cod: 'let suma = 0;\nfor (let i = 1; i <= 10; i++) {\n  if (i % 2 === 0) {\n    suma += i * i;\n  }\n}\nreturn suma;',
      f: () => { let suma = 0; for (let i = 1; i <= 10; i++) { if (i % 2 === 0) suma += i * i; } return suma; },
      idea: 'Una secuencia de instrucciones que cambia el estado paso a paso.',
    },
    funcional: {
      t: 'Funcional', color: C.s2, mut: 0, efectos: 'ninguno (funciones puras)',
      cod: 'return Array.from({ length: 10 }, (_, k) => k + 1)\n  .filter(n => n % 2 === 0)\n  .map(n => n * n)\n  .reduce((a, b) => a + b, 0);',
      f: () => Array.from({ length: 10 }, (_, k) => k + 1).filter((n) => n % 2 === 0).map((n) => n * n).reduce((a, b) => a + b, 0),
      idea: 'Una composición de funciones sobre valores inmutables, sin cambiar variables.',
    },
    objetos: {
      t: 'Orientado a objetos', color: C.s7, mut: 1, efectos: 'cada objeto guarda y cambia su estado',
      cod: 'class Acumulador {\n  total = 0;\n  agregar(n) { if (n % 2 === 0) this.total += n * n; }\n}\nconst a = new Acumulador();\nfor (let i = 1; i <= 10; i++) a.agregar(i);\nreturn a.total;',
      f: () => { class A { constructor() { this.total = 0; } agregar(n) { if (n % 2 === 0) this.total += n * n; } } const a = new A(); for (let i = 1; i <= 10; i++) a.agregar(i); return a.total; },
      idea: 'Datos y comportamiento agrupados en objetos que encapsulan su estado.',
    },
  };

  /* ---------- Fig. 1: un mismo problema, tres estilos ---------- */

  function montarComparacion(cuerpo) {
    let sel = 'imperativo';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Paradigma', valor: sel, opciones: Object.entries(PARADIGMAS).map(([k, p]) => [k, p.t]), alCambiar: (v) => { sel = v; dibujar(); } });
    const tarea = el('p', { class: 'subtitulo-viz' }, 'Problema: sumar los cuadrados de los números pares del 1 al 10.');
    const codigo = el('pre', { class: 'codigo-bdd' }), tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(tarea, codigo, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los tres programas dan el mismo resultado (4 + 16 + 36 + 64 + 100 = 220). Lo que cambia es cómo se organiza el razonamiento.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const p = PARADIGMAS[sel], r = p.f();
      codigo.textContent = p.cod;
      tabla.replaceChildren(el('tr', null, el('th', null, 'Paradigma'), el('th', null, 'Resultado'), el('th', null, 'Estado mutable'), el('th', null, 'Efectos')),
        ...Object.entries(PARADIGMAS).map(([k, q]) => el('tr', { class: k === sel ? 'activa' : null }, el('td', null, VIZ.ficha(q.t, { color: q.color })), el('td', null, String(q.f())), el('td', null, String(q.mut)), el('td', null, q.efectos))));
      registro.textContent = p.idea;
      lectura.set([['resultado de ejecutar este código', String(r)], ['variables que cambian de valor', String(p.mut)], ['líneas', String(p.cod.split('\n').length)]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: la traza de ejecución ---------- */

  function montarTraza(cuerpo) {
    let sel = 'imperativo', pasos = [], k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estilo', valor: sel, opciones: [['imperativo', 'imperativo (bucle y acumulador)'], ['funcional', 'funcional (tubería de arreglos)']], alCambiar: (v) => { sel = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Fíjese en qué cambia: en el estilo imperativo, la <em>misma variable</em> se reasigna una y otra vez; en el funcional, cada etapa produce un valor nuevo y no destruye el anterior.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function construir() {
      const p = [];
      if (sel === 'imperativo') { let suma = 0; p.push({ cols: ['i', 'suma'], fila: ['—', 0], nota: 'Se inicializa suma = 0.' }); for (let i = 1; i <= 10; i++) { const par = i % 2 === 0; if (par) suma += i * i; p.push({ cols: ['i', 'suma'], fila: [i, suma], nota: par ? `i = ${i} es par: suma ← suma + ${i * i} = ${suma} (se REASIGNA la variable).` : `i = ${i} es impar: no pasa nada.`, cambio: par }); } } else {
        const base = Array.from({ length: 10 }, (_, j) => j + 1), pares = base.filter((n) => n % 2 === 0), cuad = pares.map((n) => n * n), total = cuad.reduce((a, b) => a + b, 0);
        p.push({ cols: ['etapa', 'valor'], fila: ['entrada', `[${base.join(', ')}]`], nota: 'Un arreglo de entrada que no se modifica.' });
        p.push({ cols: ['etapa', 'valor'], fila: ['filter(par)', `[${pares.join(', ')}]`], nota: 'filter crea un arreglo nuevo con los pares; el original sigue igual.' });
        p.push({ cols: ['etapa', 'valor'], fila: ['map(n → n²)', `[${cuad.join(', ')}]`], nota: 'map crea otro arreglo nuevo con los cuadrados.' });
        p.push({ cols: ['etapa', 'valor'], fila: ['reduce(+)', String(total)], nota: 'reduce combina todo en un único valor. Ninguna variable fue reasignada.' });
      }
      return p;
    }
    function iniciar() { pasos = construir(); k = 0; return (function* () { for (let j = 1; j < pasos.length; j++) { k = j; yield; } })(); }
    function dibujar() {
      const hist = pasos.slice(0, k + 1);
      tabla.replaceChildren(el('tr', null, ...pasos[0].cols.map((c) => el('th', null, c))), ...hist.map((h, i) => el('tr', { class: i === k ? 'activa' : null }, ...h.fila.map((v) => el('td', null, String(v))))));
      registro.textContent = pasos[k].nota;
      const mut = sel === 'imperativo' ? hist.filter((h) => h.cambio).length + 1 : 0;
      lectura.set([['paso', `${k + 1} de ${pasos.length}`], ['asignaciones sobre la misma variable', String(mut)], ['valores nuevos creados', sel === 'imperativo' ? '0' : String(k)]]);
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('programming-paradigms', {
    intro: String.raw`
      <p>Un <strong>paradigma</strong> es una manera de organizar un programa. Los tres más usados en la web conviven en JavaScript y TypeScript: el <strong>imperativo</strong> (instrucciones que cambian el estado),
      el <strong>orientado a objetos</strong> (objetos que encapsulan datos y comportamiento) y el <strong>funcional</strong> (funciones puras que transforman valores sin modificarlos).</p>
      <p>Ninguno es «el mejor»: cada uno hace más fácil razonar sobre cierto tipo de problemas. Conocerlos ayuda a leer código ajeno y a elegir bien.</p>`,
    visualizaciones: [
      { titulo: 'Un problema, tres paradigmas', descripcion: 'Cambie de paradigma y compare el código de cada uno, cuántas variables cambian de valor y que el resultado es el mismo.', montar: montarComparacion },
      { titulo: 'La traza de la ejecución', descripcion: 'Avance paso a paso en el estilo imperativo y en el funcional: observe qué se reasigna y qué se crea de nuevo.', montar: montarTraza },
    ],
    teoria: String.raw`
      <h2>Comparación</h2>
      <table>
        <tr><th></th><th>Imperativo</th><th>Orientado a objetos</th><th>Funcional</th></tr>
        <tr><td>Unidad básica</td><td>instrucción</td><td>objeto (estado + métodos)</td><td>función</td></tr>
        <tr><td>Estado</td><td>variables mutables</td><td>encapsulado en objetos</td><td>inmutable; se crean valores nuevos</td></tr>
        <tr><td>Reutilización</td><td>procedimientos</td><td>herencia, composición</td><td>composición de funciones</td></tr>
        <tr><td>Se razona mejor sobre…</td><td>algoritmos paso a paso</td><td>entidades con ciclo de vida</td><td>transformaciones de datos</td></tr>
      </table>
      <h2>Funciones puras</h2>
      <p>Una función es <em>pura</em> si su resultado depende solo de sus argumentos y no tiene efectos secundarios (no modifica nada fuera de ella): \(f(x)\) vale siempre lo mismo. Eso la vuelve fácil de probar y de combinar: \((g \circ f)(x) = g(f(x))\). Es la idea que hay detrás de los <a href="tema.html?id=array-methods">métodos funcionales de arreglos</a> y de los componentes de <a href="tema.html?id=component-tree-props">React</a>.</p>
      <h2>En la práctica</h2>
      <ul>
        <li>JavaScript es <em>multiparadigma</em>: funciones de primera clase, clases y bucles conviven.</li>
        <li>La inmutabilidad evita errores por cambios inesperados, a costa de crear valores nuevos (que los motores optimizan mucho).</li>
        <li>Un buen diseño suele ser un «núcleo» funcional y puro rodeado de una «cáscara» imperativa que hace la entrada/salida.</li>
      </ul>
      <div class="recuadro">Los tipos de <a href="tema.html?id=typescript-static-typing">TypeScript</a> ayudan a cualquiera de los tres estilos. Y la elección también afecta a las pruebas: las funciones puras se prueban sin dobles (<a href="tema.html?id=unit-tests-mocks">unitarias y mocks</a>).</div>`,
  });
})();
