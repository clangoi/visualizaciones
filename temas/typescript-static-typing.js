(function () {
  'use strict';
  const { color: C, el } = VIZ;

  /* ---------- Fig. 1: qué atrapa el compilador antes de ejecutar ---------- */

  const CASOS = {
    suma: {
      t: 'sumar un texto como si fuera número',
      ts: 'function sumar(a: number, b: number) {\n  return a + b;\n}\nsumar("10", 3);',
      js: () => { const sumar = (a, b) => a + b; return sumar('10', 3); },
      err: [{ l: 4, m: 'Argument of type \'string\' is not assignable to parameter of type \'number\'.', estricto: false }],
    },
    typo: {
      t: 'error de tipeo en una propiedad',
      ts: 'interface Usuario { nombre: string }\nconst u: Usuario = { nombre: "Ana" };\nconsole.log(u.nonbre.toUpperCase());',
      js: () => { const u = { nombre: 'Ana' }; return u.nonbre.toUpperCase(); },
      err: [{ l: 3, m: 'Property \'nonbre\' does not exist on type \'Usuario\'. Did you mean \'nombre\'?', estricto: false }],
    },
    nulo: {
      t: 'valor que puede ser null',
      ts: 'function largo(s: string | null) {\n  return s.length;\n}\nlargo(null);',
      js: () => { const largo = (s) => s.length; return largo(null); },
      err: [{ l: 2, m: '\'s\' is possibly \'null\'.', estricto: true }],
    },
    falta: {
      t: 'falta un campo obligatorio',
      ts: 'interface Persona { nombre: string; edad: number }\nfunction anio(p: Persona) { return 2026 - p.edad; }\nanio({ nombre: "Ana" });',
      js: () => { const anio = (p) => 2026 - p.edad; return anio({ nombre: 'Ana' }); },
      err: [{ l: 3, m: 'Property \'edad\' is missing in type \'{ nombre: string; }\' but required in type \'Persona\'.', estricto: false }],
    },
  };
  const MODOS = { js: 'JavaScript (sin tipos)', ts: 'TypeScript', estricto: 'TypeScript con strict: true' };

  function montarCompilador(cuerpo) {
    let caso = 'suma', modo = 'ts';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Fragmento', valor: caso, opciones: Object.entries(CASOS).map(([k, c]) => [k, c.t]), alCambiar: (v) => { caso = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Lenguaje y modo', valor: modo, opciones: Object.entries(MODOS), alCambiar: (v) => { modo = v; dibujar(); } });
    const codigo = el('pre', { class: 'codigo-bdd' }), diag = el('div', { class: 'fichas' }), ejecucion = el('pre', { class: 'codigo-bdd' });
    cuerpo.append(codigo, el('p', { class: 'subtitulo-viz' }, 'Al compilar (antes de ejecutar)'), diag, el('p', { class: 'subtitulo-viz' }, 'Al ejecutar el JavaScript resultante'), ejecucion);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El código se ejecuta de verdad. En JavaScript el error aparece (o no) cuando corre; en TypeScript, el compilador lo señala antes de que el programa llegue a un usuario.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    function dibujar() {
      const c = CASOS[caso];
      codigo.textContent = modo === 'js' ? c.ts.replace(/: (number|string \| null|string|Usuario|Persona)/g, '').replace(/interface .*\n/g, '') : c.ts;
      const errores = modo === 'js' ? [] : c.err.filter((e) => !e.estricto || modo === 'estricto');
      diag.replaceChildren(...(modo === 'js' ? [VIZ.ficha('JavaScript no verifica tipos: no hay compilación', { color: C.inactivo })] : errores.length ? errores.map((e) => VIZ.ficha(`línea ${e.l}: error TS — ${e.m}`, { color: C.s8, fondo: VIZ.alfa(C.s8, 0.15) })) : [VIZ.ficha('sin errores de tipos', { color: C.s6, fondo: VIZ.alfa(C.s6, 0.18) })]));
      let salida, fallo = false;
      try { salida = String(c.js()); } catch (e) { salida = `${e.name}: ${e.message}`; fallo = true; }
      ejecucion.textContent = errores.length ? '(el compilador rechazó el programa: no se genera para ejecutar)' : fallo ? `✕ ${salida}   ← el error ocurre en producción` : `resultado: ${salida}`;
      const inesperado = !errores.length && (fallo || caso === 'suma' || caso === 'falta' || caso === 'typo');
      registro.textContent = errores.length ? 'El error se detecta al escribir/compilar el código, donde es barato corregirlo.' : inesperado ? 'Nadie lo detectó antes: el programa produce un resultado equivocado o falla al ejecutarse.' : 'El programa funciona.';
      lectura.set([['errores detectados al compilar', String(errores.length)], ['error al ejecutar', !errores.length && fallo ? 'sí' : 'no'], ['resultado inesperado', inesperado ? 'sí' : 'no'], ['modo', MODOS[modo]]]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: tipado estructural ---------- */

  const TIPOS = {
    punto: { t: 'interface Punto { x: number; y: number }', ok: (v) => v !== null && typeof v === 'object' && typeof v.x === 'number' && typeof v.y === 'number' },
    persona: { t: 'interface Persona { nombre: string; edad?: number }', ok: (v) => v !== null && typeof v === 'object' && typeof v.nombre === 'string' && (v.edad === undefined || typeof v.edad === 'number') },
    union: { t: 'type Id = number | string', ok: (v) => typeof v === 'number' || typeof v === 'string' },
    literal: { t: 'type Lado = "izq" | "der"', ok: (v) => v === 'izq' || v === 'der' },
    lista: { t: 'type Notas = number[]', ok: (v) => Array.isArray(v) && v.every((x) => typeof x === 'number') },
  };
  const VALORES = [
    '{ x: 1, y: 2 }', '{ x: 1, y: 2, z: 3 }', '{ x: "1", y: 2 }', '{ nombre: "Ana" }', '{ nombre: "Ana", edad: 30 }', '{ nombre: "Ana", edad: "30" }', '42', '"abc"', '"izq"', '"arriba"', '[5, 6, 7]', '[5, "6"]', 'null',
  ];

  function montarEstructural(cuerpo) {
    let tipo = 'punto';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo', valor: tipo, opciones: Object.entries(TIPOS).map(([k, t]) => [k, t.t]), alCambiar: (v) => { tipo = v; dibujar(); } });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.appendChild(el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'TypeScript es <em>estructural</em>: un valor sirve para un tipo si «tiene la forma» requerida, sin importar cómo se declaró. Observe que <code>{ x, y, z }</code> sí es un <code>Punto</code>.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    const NOTAS = { punto: 'Basta con tener x e y numéricos; propiedades extra (z) no impiden la asignación a una variable (solo a un literal directo).', persona: 'edad es opcional (?): puede faltar, pero si está debe ser número.', union: 'Una unión admite cualquiera de sus alternativas.', literal: 'Un tipo literal admite solo esos valores exactos.', lista: 'Un arreglo es Notas solo si todos sus elementos son números.' };
    function dibujar() {
      const T = TIPOS[tipo];
      const filas = VALORES.map((s) => { let v; try { v = new Function(`return (${s})`)(); } catch (e) { v = undefined; } return [s, T.ok(v)]; });
      tabla.replaceChildren(el('tr', null, el('th', null, 'Valor'), el('th', null, `¿asignable a ${T.t.split(' ')[1]}?`)), ...filas.map(([s, ok]) => el('tr', null, el('td', null, s), el('td', null, VIZ.ficha(ok ? 'sí' : 'no', { color: ok ? C.s6 : C.s8 })))));
      registro.textContent = NOTAS[tipo];
      lectura.set([['valores aceptados', `${filas.filter((f) => f[1]).length} de ${filas.length}`], ['tipo', T.t]]);
    }
    dibujar();
  }

  VIZ.registrarTema('typescript-static-typing', {
    intro: String.raw`
      <p>JavaScript es de <em>tipado dinámico</em>: los errores de tipo (sumar un texto, leer una propiedad inexistente) solo aparecen cuando el código se ejecuta, a veces en producción.
      <strong>TypeScript</strong> añade un sistema de <em>tipado estático</em>: se declaran los tipos y un compilador los comprueba <strong>antes</strong> de ejecutar, para luego convertir todo en JavaScript común.</p>
      <p>Los tipos funcionan además como documentación y permiten que el editor autocomplete y refactorice con seguridad.</p>`,
    parametros: [
      ['Fragmento (Fig. 1)', String.raw`Selector con cuatro programas de ejemplo: sumar un texto como si fuera número, error de tipeo en una propiedad, valor que puede ser null y falta un campo obligatorio. Cada uno ilustra otro error que un tipo puede prevenir; parte en el primero.`],
      ['Lenguaje y modo (Fig. 1)', String.raw`Selector con tres opciones: «JavaScript (sin tipos)», «TypeScript» y «TypeScript con strict: true» (parte en la segunda). En JavaScript no hay compilación; en TypeScript el compilador revisa los tipos; el modo estricto añade la comprobación de null, que solo cambia el resultado del fragmento «valor que puede ser null».`],
      ['Tipo (Fig. 2)', String.raw`Selector con cinco tipos: Punto, Persona, Id (número o texto), Lado (&quot;izq&quot; o &quot;der&quot;) y Notas (arreglo de números). Se comprueban trece valores de ejemplo contra el tipo elegido; parte en Punto.`],
    ],
    visualizaciones: [
      { titulo: 'Lo que atrapa el compilador', descripcion: 'Elija un fragmento con un error típico y compare JavaScript, TypeScript y el modo estricto: ¿cuándo se descubre cada problema?',
        ayuda: String.raw`<p>Un recuadro con el código del fragmento (sin anotaciones de tipo en modo JavaScript), el subtítulo «Al compilar (antes de ejecutar)» con fichas de diagnóstico, y «Al ejecutar el JavaScript resultante» con lo que ocurre al correrlo. Las fichas son grises si no hay compilación (JavaScript), rojas con «línea N: error TS» si el compilador encuentra un error y verdes con «sin errores de tipos» si no. Abajo se leen los errores detectados al compilar, si hubo error o resultado inesperado al ejecutar, y el modo.</p>
          <ul>
          <li><strong>Fragmento</strong>: cambia el código y el error de ese caso; «valor que puede ser null» solo se detecta en modo estricto.</li>
          <li><strong>Lenguaje y modo</strong>: en JavaScript no hay diagnósticos y el programa se ejecuta de verdad (lanza un error o da un resultado equivocado); en TypeScript y TypeScript estricto, si hay un error de tipos, se rechaza el programa y no se ejecuta.</li>
          <li>En TypeScript sin modo estricto, el fragmento de null no muestra errores y falla al ejecutarse.</li>
          </ul>`, montar: montarCompilador },
      { titulo: 'Tipado estructural', descripcion: 'Seleccione un tipo y compruebe qué valores se pueden asignar: lo que importa es la forma, no el nombre.',
        ayuda: String.raw`<p>Tabla de trece valores candidatos con dos columnas: el valor y «¿asignable a el tipo?», con una ficha verde «sí» o roja «no». Abajo se leen cuántos valores se aceptan y el tipo elegido; el texto bajo la figura resume la regla de ese tipo.</p>
          <ul>
          <li><strong>Tipo</strong>: cambia qué filas están en verde. Con Punto, un valor con campos de más, como <code>{ x: 1, y: 2, z: 3 }</code>, se acepta porque basta con tener la forma pedida.</li>
          <li>Con Persona la propiedad edad es opcional; con Id se acepta número o texto; con Lado, solo «izq» o «der»; con Notas, solo arreglos de números.</li>
          </ul>`, montar: montarEstructural },
    ],
    teoria: String.raw`
      <h2>Idea</h2>
      <p>Un tipo es un <em>conjunto de valores</em> permitidos, y el compilador comprueba que cada expresión pertenezca al conjunto que se espera. Asignar \(v\) a una variable de tipo \(T\) exige \(v \in T\); si no, hay un error de compilación.</p>
      <pre><code>function dobles(xs: number[]): number[] { return xs.map(x =&gt; x * 2); }
type Id = number | string;               // unión: conjunto unión
interface Punto { x: number; y: number } // objeto: «tiene al menos estas propiedades»</code></pre>
      <h2>Inferencia y modos</h2>
      <ul>
        <li><strong>Inferencia</strong>: no hay que anotarlo todo; <code>const n = 3</code> ya es <code>number</code>.</li>
        <li><code>strict</code> activa comprobaciones como <code>strictNullChecks</code> (<code>null</code> y <code>undefined</code> no son valores de cualquier tipo) y <code>noImplicitAny</code>.</li>
        <li><code>unknown</code> obliga a comprobar antes de usar; <code>any</code> desactiva la comprobación (úselo lo menos posible).</li>
      </ul>
      <h2>Alcance y límites</h2>
      <p>Los tipos <strong>se borran</strong> al compilar: no existen en tiempo de ejecución. Por eso los datos que llegan de fuera (una respuesta de <a href="tema.html?id=rest-api-crud">una API</a>) deben validarse en ejecución; el tipo solo describe lo que se <em>espera</em>.</p>
      <div class="recuadro">Beneficio práctico: un error atrapado al escribir cuesta segundos; el mismo error en producción cuesta horas (ver <a href="tema.html?id=software-quality">el costo de los defectos</a>). Para ver los distintos estilos de programar que TypeScript puede combinar, <a href="tema.html?id=programming-paradigms">paradigmas de programación</a>.</div>`,
  });
})();
