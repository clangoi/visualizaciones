(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: destructuring, rest y spread ---------- */

  const EJEMPLOS = {
    obj: { t: 'Destructuring de objeto', cod: 'const usuario = { nombre: "Ana", edad: 30, ciudad: "Lima" };\nconst { nombre, edad: años } = usuario;', res: [['nombre', '"Ana"'], ['años', '30']] },
    arr: { t: 'Destructuring de arreglo', cod: 'const [primero, , tercero = 0, ...resto] = [10, 20, 30, 40, 50];', res: [['primero', '10'], ['tercero', '30'], ['resto', '[40, 50]']] },
    def: { t: 'Valores por omisión', cod: 'const { puerto = 3000, host = "localhost" } = { host: "api.com" };', res: [['puerto', '3000 (omisión)'], ['host', '"api.com"']] },
    rest: { t: 'Parámetros rest', cod: 'const sumar = (...nums) => nums.reduce((a, x) => a + x, 0);\nconst r = sumar(1, 2, 3, 4);', res: [['nums', '[1, 2, 3, 4]'], ['r', '10']] },
    spread: { t: 'Spread de objetos', cod: 'const base = { a: 1, b: 2 };\nconst copia = { ...base, b: 20, c: 3 };', res: [['copia', '{ a: 1, b: 20, c: 3 }'], ['base', '{ a: 1, b: 2 } (sin cambios)']] },
    flecha: { t: 'Funciones flecha y this', cod: 'const doble = x => x * 2;\nconst puntos = [1, 2, 3].map(doble);', res: [['doble', 'x => x * 2'], ['puntos', '[2, 4, 6]']] },
  };

  function montarSintaxis(cuerpo) {
    let sel = 'obj';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Sintaxis', valor: sel, opciones: Object.entries(EJEMPLOS).map(([k, e]) => [k, e.t]), alCambiar: (v) => { sel = v; dibujar(); } });
    const codigo = el('pre', { class: 'codigo-bdd' });
    const tabla = el('table', { class: 'tabla-datos texto' });
    cuerpo.append(codigo, el('div', { class: 'caja-desplazable' }, tabla));
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'La tabla muestra qué variables quedan creadas y con qué valor tras ejecutar el código.');
    cuerpo.dataset.sinLeyenda = 'figura sin canvas';
    const NOTAS = {
      obj: 'Se extraen propiedades por nombre; «edad: años» las renombra.', arr: 'Se extraen por posición; una coma vacía salta un elemento y «...resto» recoge lo que sobra.',
      def: 'El valor por omisión solo se usa si la propiedad es undefined.', rest: '«...» en parámetros recoge los argumentos en un arreglo real.',
      spread: 'El spread copia las propiedades; las que se escriben después sobrescriben a las anteriores.', flecha: 'Las flechas son más cortas y no crean su propio this: lo toman del entorno.',
    };
    function dibujar() {
      const e = EJEMPLOS[sel];
      codigo.textContent = e.cod;
      tabla.replaceChildren(el('tr', null, el('th', null, 'Variable'), el('th', null, 'Valor')), ...e.res.map(([a, b]) => el('tr', null, el('td', null, a), el('td', null, b))));
      registro.textContent = NOTAS[sel];
    }
    dibujar();
  }

  /* ---------- Fig. 2: el spread es una copia superficial ---------- */

  function montarCopia(cuerpo) {
    let profunda = false, a = 1, c = 1, tocaCopia = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de copia', valor: 'super', opciones: [['super', '{ ...orig } (superficial)'], ['prof', 'structuredClone(orig) (profunda)']], alCambiar: (v) => { profunda = v === 'prof'; reiniciar(); } });
    ctl.boton('copia.a = 99', () => { a = 99; dibujar(); });
    ctl.boton('copia.dir.ciudad = "Lima"', () => { c = 'Lima'; tocaCopia = true; dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'objeto original' }, { color: C.s2, texto: 'copia' }, { color: C.s3, texto: 'objeto anidado (compartido o no)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las flechas son <em>referencias</em>: con una copia superficial, <code>dir</code> sigue apuntando al mismo objeto, así que modificarlo desde la copia también cambia el original.');
    function reiniciar() { a = 1; c = 'Santiago'; tocaCopia = false; dibujar(); }
    function dibujar() {
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const bw = Math.min(150, Wd / 2 - 20), x1 = 10, x2 = Wd - bw - 10, xm = (Wd - bw) / 2;
      W.caja(ctx, x1, 10, bw, 64, `original\na: 1\ndir →`, { borde: C.s1, relleno: VIZ.alfa(C.s1, 0.15), tam: 11 });
      W.caja(ctx, x2, 10, bw, 64, `copia\na: ${a}\ndir →`, { borde: C.s2, relleno: VIZ.alfa(C.s2, 0.15), tam: 11 });
      const ciudad1 = profunda ? 'Santiago' : c, ciudad2 = c;
      if (profunda) {
        W.caja(ctx, x1, 150, bw, 46, `{ ciudad:\n"Santiago" }`, { borde: C.s3, relleno: VIZ.alfa(C.s3, 0.18), tam: 11 });
        W.caja(ctx, x2, 150, bw, 46, `{ ciudad:\n"${ciudad2}" }`, { borde: C.s3, relleno: VIZ.alfa(C.s3, 0.18), tam: 11 });
        VIZ.dist.flecha(ctx, x1 + bw * 0.7, 74, x1 + bw / 2, 150, { color: C.tinta2 }); VIZ.dist.flecha(ctx, x2 + bw * 0.3, 74, x2 + bw / 2, 150, { color: C.tinta2 });
      } else {
        W.caja(ctx, xm, 150, bw, 46, `{ ciudad:\n"${ciudad2}" }`, { borde: C.s3, relleno: VIZ.alfa(C.s3, 0.18), tam: 11 });
        VIZ.dist.flecha(ctx, x1 + bw * 0.7, 74, xm + bw * 0.3, 150, { color: C.tinta2 }); VIZ.dist.flecha(ctx, x2 + bw * 0.3, 74, xm + bw * 0.7, 150, { color: C.tinta2 });
      }
      registro.textContent = !tocaCopia ? (profunda ? 'structuredClone duplicó también el objeto anidado: son independientes.' : 'El spread copió «a» pero reutilizó la referencia a «dir».') : profunda ? 'Se cambió la ciudad de la copia; el original sigue con «Santiago».' : 'Se cambió la ciudad desde la copia… ¡y el original también cambió: comparten el mismo objeto!';
      lectura.set([['original.dir.ciudad', `"${ciudad1}"`], ['copia.dir.ciudad', `"${ciudad2}"`], ['original.a', '1'], ['copia.a', String(a)]]);
    }
    lienzo.alDibujar = dibujar;
    reiniciar();
  }

  /* ---------- Fig. 3: módulos y tree shaking ---------- */

  const MODS = {
    app: { x: 0.5, y: 0.1, kb: 4, usa: { 'utils/fecha': ['formatear'], 'utils/texto': ['mayus'], 'ui/boton': ['Boton'] } },
    'utils/fecha': { x: 0.2, y: 0.55, kb: 30, exports: { formatear: 6, parsear: 12, zonas: 12 } },
    'utils/texto': { x: 0.5, y: 0.55, kb: 20, exports: { mayus: 2, slug: 8, traducir: 10 } },
    'ui/boton': { x: 0.8, y: 0.55, kb: 14, exports: { Boton: 5, Icono: 9 } },
  };
  function montarModulos(cuerpo) {
    let shake = false;
    const usadoExtra = { 'utils/fecha': new Set(['formatear']), 'utils/texto': new Set(['mayus']), 'ui/boton': new Set(['Boton']) };
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'tree shaking (el empaquetador elimina lo no importado)', valor: false, alCambiar: (v) => { shake = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 240 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'código importado' }, { color: C.inactivo, texto: 'código que nadie usa' }, { color: C.s6, texto: 'incluido en el paquete' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La aplicación solo importa una función de cada módulo (<code>import { formatear } from "utils/fecha"</code>). Active el tree shaking y vea cuánto código se descarta.');
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const pos = (k) => [MODS[k].x * Wd, MODS[k].y * H];
      let incluido = MODS.app.kb, total = MODS.app.kb;
      for (const [k, m] of Object.entries(MODS)) {
        if (k === 'app') continue;
        const [x, y] = pos(k);
        VIZ.dist.flecha(ctx, pos('app')[0], pos('app')[1] + 20, x, y - 4, { color: C.tinta2 });
        total += m.kb;
        const w = Math.min(Wd / 3 - 10, 140);
        const lista = Object.entries(m.exports);
        let usadoKb = 0;
        W.texto(ctx, k, x, y + 8, { tam: 11, peso: 600 });
        lista.forEach(([nom, kb], i) => {
          const usado = usadoExtra[k].has(nom);
          if (usado) usadoKb += kb;
          const fuera = shake && !usado;
          W.caja(ctx, x - w / 2, y + 22 + i * 26, w, 22, `${nom} · ${kb} KB`, { borde: usado ? C.s1 : C.inactivo, relleno: fuera ? C.superficie : VIZ.alfa(usado ? C.s1 : C.inactivo, 0.2), tam: 10, guiones: fuera ? [3, 3] : null, tinta: fuera ? C.apagado : C.tinta });
        });
        incluido += shake ? usadoKb : m.kb;
      }
      const [ax, ay] = pos('app');
      W.caja(ctx, ax - 50, ay - 10, 100, 30, `app.js · ${MODS.app.kb} KB`, { borde: C.s6, relleno: VIZ.alfa(C.s6, 0.2), tam: 11, peso: 600 });
      registro.textContent = shake ? `Con tree shaking el paquete incluye ${incluido} KB de ${total} KB: se eliminaron ${total - incluido} KB de exportaciones sin uso.` : `Sin tree shaking se incluyen los módulos completos: ${incluido} KB, aunque solo se usan 3 funciones.`;
      lectura.set([['tamaño total del código', `${total} KB`], ['en el paquete', `${incluido} KB`], ['ahorro', `${Math.round((1 - incluido / total) * 100)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('modern-js-syntax', {
    intro: String.raw`
      <p>Desde ES2015 (<em>ECMAScript 6</em>), JavaScript incorporó una sintaxis que dice más con menos: <strong>funciones flecha</strong>, <strong>destructuring</strong> para extraer valores de objetos y arreglos,
      el operador <strong>spread/rest</strong> (<code>...</code>) y <strong>módulos</strong> con <code>import</code> y <code>export</code>.</p>
      <p>Aprenderlas es necesario para leer código actual, pero también conviene saber qué ocurre debajo: por ejemplo, copiar un objeto con <code>...</code> <em>no</em> copia lo que hay dentro de sus propiedades.</p>`,
    visualizaciones: [
      { titulo: 'Destructuring, rest y spread', descripcion: 'Recorra los distintos usos de la sintaxis moderna y compare el código con las variables que quedan definidas.', montar: montarSintaxis },
      { titulo: 'Copia superficial frente a profunda', descripcion: 'Copie un objeto con spread y modifique su objeto anidado: observe qué pasa con el original. Luego pruebe con una copia profunda.', montar: montarCopia },
      { titulo: 'Módulos y tree shaking', descripcion: 'Una aplicación importa solo parte de tres módulos; active el tree shaking y compare el tamaño del paquete.', montar: montarModulos },
    ],
    teoria: String.raw`
      <h2>Valores y referencias</h2>
      <p>Los números, textos y booleanos se copian por valor; los objetos y arreglos, por <strong>referencia</strong>: una variable guarda <em>dónde</em> está el objeto. Asignar <code>b = a</code> hace que ambas apunten al mismo objeto. El spread crea un objeto nuevo pero copia las referencias de sus propiedades: una copia de <em>un solo nivel</em>, de costo \(O(k)\) para \(k\) propiedades.</p>
      <h2>Destructuring</h2>
      <pre><code>const { a, b: nuevoNombre, c = 5, ...resto } = objeto;
const [x, , z, ...cola] = arreglo;
function f({ id, nombre }) { … }           // en parámetros</code></pre>
      <h2>Funciones flecha</h2>
      <p><code>(a, b) =&gt; a + b</code> es una expresión de función corta. Se diferencia de <code>function</code> en que <strong>no tiene su propio <code>this</code></strong> ni <code>arguments</code>: los toma del entorno donde se escribió, lo que las hace ideales para callbacks.</p>
      <h2>Módulos ES</h2>
      <p>Cada archivo es un módulo con su propio alcance; lo que se quiere compartir se marca con <code>export</code> y se trae con <code>import</code>. Como las dependencias se declaran de forma <em>estática</em>, una herramienta de empaquetado puede construir el grafo completo y descartar las exportaciones que nadie importa (<em>tree shaking</em>), reduciendo lo que viaja por la red.</p>
      <div class="recuadro">El mismo concepto existe en Node.js en dos versiones, CommonJS (<code>require</code>) y módulos ES; la diferencia se explica en <a href="tema.html?id=npm-modules">npm y módulos</a>.</div>`,
  });
})();
