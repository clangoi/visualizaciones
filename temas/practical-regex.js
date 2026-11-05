(function () {
  'use strict';
  const { color: C } = VIZ;

  const PRESETS = [
    { nombre: 'Números enteros y decimales', re: '\\d+(\\.\\d+)?', texto: 'Hay 12 manzanas, 3.5 kg de pan y 100 monedas.' },
    { nombre: 'Voraz frente a perezoso: <.+>', re: '<.+>', texto: '<b>negrita</b> y <i>cursiva</i>' },
    { nombre: 'Perezoso: <.+?>', re: '<.+?>', texto: '<b>negrita</b> y <i>cursiva</i>' },
    { nombre: 'Fechas con grupos', re: '(\\d{4})-(\\d{2})-(\\d{2})', texto: 'Ingreso 2024-03-15; salida 2024-04-02.' },
    { nombre: 'Palabras que empiezan con mayúscula', re: '\\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+', texto: 'Ana vive en Santiago pero trabaja en Valparaíso.' },
    { nombre: 'Correo simple', re: '[\\w.]+@[\\w.]+\\.[a-z]{2,}', texto: 'Escriba a ana.p@correo.cl o a info@sitio.com.' },
    { nombre: 'Alternación: gato|perro', re: 'gato|perro|pez', texto: 'Tengo un gato, dos perros y un pez.' },
  ];
  const ANIDADO = /\([^)]*[+*][^)]*\)[+*{]/;

  /* ---------- Fig. 1: probador ---------- */

  function montarProbador(cuerpo) {
    let re = PRESETS[0].re, texto = PRESETS[0].texto, i = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Ejemplos', opciones: PRESETS.map((p, k) => [k, p.nombre]), valor: 0, alCambiar: (v) => { const p = PRESETS[+v]; re = p.re; texto = p.texto; campo.valor = re; campoT.valor = texto; dibujar(); } });
    const campo = ctl.texto({ etiqueta: 'Patrón', valor: re, alCambiar: (v) => { re = v; dibujar(); }, alEnter: (v) => { re = v; dibujar(); } });
    const campoT = ctl.texto({ etiqueta: 'Texto (hasta 200 caracteres)', valor: texto, alCambiar: (v) => { texto = v.slice(0, 200); dibujar(); }, alEnter: (v) => { texto = v.slice(0, 200); dibujar(); } });
    ctl.casilla({ etiqueta: 'Ignorar mayúsculas (i)', valor: i, alCambiar: (v) => { i = v; dibujar(); } });
    const salida = VIZ.el('div', { class: 'formula-viz' });
    cuerpo.appendChild(salida);
    cuerpo.dataset.sinLeyenda = 'los colores distinguen coincidencias consecutivas; la tabla las numera';
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Sintaxis estilo PCRE/JavaScript: <code>\\d \\w \\s</code> clases, <code>[a-z]</code> conjuntos, <code>. * + ? {n,m}</code> cuantificadores (voraces; con <code>?</code> detrás, perezosos), <code>( )</code> grupos, <code>|</code> alternación, <code>\\b</code> límite de palabra.');

    function dibujar() {
      tabla.replaceChildren(); salida.replaceChildren();
      if (ANIDADO.test(re)) { registro.textContent = 'Este patrón tiene cuantificadores anidados: con un motor de retroceso puede tardar un tiempo exponencial. Pruébelo en «Backtracking vs Automata Matching» con textos cortos.'; return; }
      let rx;
      try { rx = new RegExp(re, 'g' + (i ? 'i' : '')); } catch (e) { registro.textContent = 'Patrón inválido: ' + e.message.replace(/^Invalid regular expression: /, ''); return; }
      const ms = [...texto.matchAll(rx)].slice(0, 60);
      const partes = [];
      let pos = 0;
      ms.forEach((m, k) => {
        if (m[0] === '') return;
        partes.push(texto.slice(pos, m.index));
        partes.push(VIZ.el('mark', { style: { background: VIZ.alfa(VIZ.series[k % 4 === 0 ? 0 : k % 4 === 1 ? 1 : k % 4 === 2 ? 2 : 3], 0.35) } }, m[0]));
        pos = m.index + m[0].length;
      });
      partes.push(texto.slice(pos));
      salida.append(...partes);
      const ng = ms.length ? ms[0].length - 1 : 0;
      tabla.replaceChildren(VIZ.el('tr', null, ['#', 'Coincidencia', 'Posición', ...Array.from({ length: ng }, (_, g) => 'Grupo ' + (g + 1))].map((t) => VIZ.el('th', null, t))),
        ...ms.filter((m) => m[0] !== '').map((m, k) => VIZ.el('tr', null, VIZ.el('td', null, String(k + 1)), VIZ.el('td', { class: 'izq' }, m[0]), VIZ.el('td', null, `${m.index}–${m.index + m[0].length}`), ...Array.from({ length: ng }, (_, g) => VIZ.el('td', { class: m[g + 1] === undefined ? 'vacia' : null }, m[g + 1] === undefined ? '—' : m[g + 1])))));
      registro.textContent = ms.filter((m) => m[0] !== '').length ? `${ms.filter((m) => m[0] !== '').length} coincidencia(s). Se buscan de izquierda a derecha y no se solapan.` : 'Ninguna coincidencia.';
    }
    dibujar();
  }

  /* ---------- Fig. 2: qué caracteres acepta una clase ---------- */

  const MUESTRA = 'abcdefghijklmnopqrstuvwxyzáéíóúñüABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.,;:!?@#$%&()[]{}+*/=<>\'" \t\n'.split('');
  const NOMBRE = { ' ': '·', '\t': '⇥', '\n': '↵' };
  const CLASES = ['\\d', '\\w', '\\s', '[a-f0-9]', '[^aeiou]', '.', '[A-Za-z]', '\\W', '[áéíóúñü]', '[.,;:!?]'];

  function montarClases(cuerpo) {
    let clase = '[a-f0-9]', celdas = [];
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Clase de caracteres (un carácter)', valor: clase, alCambiar: (v) => { clase = v; dibujar(); }, alEnter: (v) => { clase = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...CLASES.map((c) => [c, c])], valor: '', alCambiar: (v) => { if (v) { clase = v; campo.valor = v; dibujar(); } } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 20 + Math.ceil(MUESTRA.length / Math.max(8, Math.floor(w / 34))) * 34 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'el carácter coincide' },
      { color: C.neutro, borde: C.rejilla, texto: 'no coincide' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda es un carácter de una muestra (letras, tildes, dígitos, signos, espacio, tabulación, salto de línea). Observe que <code>\\w</code> no incluye las letras con tilde y que <code>.</code> no incluye el salto de línea.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      let rx;
      try { rx = new RegExp('^(?:' + clase + ')$'); } catch (e) { registro.textContent = 'Clase inválida: ' + e.message.replace(/^Invalid regular expression: /, ''); lectura.set([['coincidencias', '—']]); return; }
      const cols = Math.max(8, Math.floor(W / 34)), cw = Math.min(40, (W - 8) / cols);
      celdas = [];
      let n = 0;
      MUESTRA.forEach((ch, k) => {
        const x = 4 + (k % cols) * cw, y = 6 + Math.floor(k / cols) * 34, ok = rx.test(ch);
        if (ok) n++;
        ctx.fillStyle = ok ? VIZ.alfa(C.s6, 0.3) : C.neutro; ctx.strokeStyle = ok ? C.s6 : C.rejilla; ctx.lineWidth = ok ? 1.5 : 1;
        ctx.beginPath(); ctx.roundRect(x + 1, y, cw - 3, 28, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ok ? C.tinta : C.inactivo; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(NOMBRE[ch] || ch, x + cw / 2 - 0.5, y + 14.5);
        celdas.push({ x, y, w: cw - 2, h: 28, ch, ok });
      });
      registro.textContent = `«${clase}» coincide con ${n} de los ${MUESTRA.length} caracteres de la muestra.`;
      lectura.set([['coinciden', String(n)], ['no coinciden', String(MUESTRA.length - n)], ['patrón', clase]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), c = celdas.find((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h);
      if (!c) return tip.ocultar();
      tip.mostrar(x, y, `<b>${VIZ.web.esc(NOMBRE[c.ch] || c.ch)}</b> · U+${c.ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}<br>${c.ok ? 'coincide' : 'no coincide'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('practical-regex', {
    intro: String.raw`
      <p>Las <strong>expresiones regulares prácticas</strong> —las de <code>grep</code>, de los editores y de los lenguajes de programación— parten de la teoría (unión, concatenación, estrella) y le agregan comodidades: clases de caracteres, cuantificadores como <code>+</code>, <code>?</code> y <code>{n,m}</code>, grupos que capturan, anclas y escapes.</p>
      <p>Dos familias de sintaxis dominan: <strong>POSIX</strong> (la de <code>grep</code> y <code>sed</code>) y <strong>PCRE</strong> (Perl, Python, JavaScript, PHP…). La diferencia de fondo no es la sintaxis sino qué pasa cuando hay varias formas de coincidir: POSIX busca la coincidencia más larga; PCRE toma la primera que encuentra su orden de prioridades, voraz o perezoso.</p>`,
    visualizaciones: [
      {
        titulo: 'Probar un patrón sobre un texto',
        descripcion: 'Elija un ejemplo o escriba su patrón: se marcan las coincidencias y se muestran sus grupos. Compare «&lt;.+&gt;» (voraz) con «&lt;.+?&gt;» (perezoso).',
        montar: montarProbador,
      },
      {
        titulo: 'Qué caracteres acepta una clase',
        descripcion: 'Escriba una clase como \\d, [^aeiou] o [a-f0-9] y vea cuáles caracteres de una muestra coinciden. Note los casos de las letras con tilde y del salto de línea.',
        montar: montarClases,
      },
    ],
    teoria: String.raw`
      <h2>Elementos de la sintaxis</h2>
      <table>
        <tr><th>Construcción</th><th>Significado</th><th>En la teoría</th></tr>
        <tr><td><code>a</code>, <code>\.</code></td><td>un carácter (con escape si es especial)</td><td>símbolo</td></tr>
        <tr><td><code>.</code></td><td>cualquier carácter (salvo salto de línea)</td><td>unión de todos los símbolos</td></tr>
        <tr><td><code>[abc]</code>, <code>[a-z]</code>, <code>[^0-9]</code></td><td>clase de caracteres, rango o negación</td><td>unión finita de símbolos</td></tr>
        <tr><td><code>\d \w \s</code></td><td>dígito, carácter de palabra, espacio</td><td>clases predefinidas</td></tr>
        <tr><td><code>r|s</code></td><td>alternación</td><td>\(r \mid s\)</td></tr>
        <tr><td><code>rs</code></td><td>concatenación</td><td>\(rs\)</td></tr>
        <tr><td><code>r*</code>, <code>r+</code>, <code>r?</code></td><td>cero o más, una o más, opcional</td><td>\(r^*\), \(rr^*\), \(r\mid\varepsilon\)</td></tr>
        <tr><td><code>r{n,m}</code></td><td>entre \(n\) y \(m\) repeticiones</td><td>abreviatura: \(r^n (r?)^{m-n}\)</td></tr>
        <tr><td><code>^ &#36; \b</code></td><td>anclas: inicio, fin, límite de palabra</td><td>condiciones sobre el contexto</td></tr>
        <tr><td><code>( )</code></td><td>grupo que además <em>captura</em> la subcadena</td><td>—</td></tr>
      </table>
      <h2>Voraz, perezoso y más larga</h2>
      <p>Un cuantificador <em>voraz</em> (<code>*</code>, <code>+</code>) consume cuanto puede y retrocede solo si hace falta; uno <em>perezoso</em> (<code>*?</code>, <code>+?</code>) consume lo mínimo. Con <code>&lt;.+&gt;</code> sobre <code>&lt;b&gt;x&lt;/b&gt;</code> la coincidencia voraz es toda la cadena; la perezosa, solo <code>&lt;b&gt;</code>. POSIX exige la coincidencia <strong>más larga</strong> en el sentido de las posiciones de inicio más a la izquierda, mientras PCRE devuelve la <strong>primera</strong> que encuentra en su orden de prueba.</p>
      <h2>Más allá de lo regular</h2>
      <div class="recuadro"><p>Las <em>referencias hacia atrás</em> (<code>\1</code>) permiten reconocer lenguajes como \(\{ww\}\), que <strong>no son regulares</strong> (se refutan con el <a href="tema.html?id=pumping-lemma">lema de bombeo</a>). Los motores que las admiten usan retroceso y el problema de coincidencia pasa a ser NP-completo. Las anclas y los grupos sin referencia, en cambio, siguen siendo regulares.</p></div>
      <h2>Cómo se evalúa</h2>
      <p>Hay dos grandes estrategias de implementación: motores con <strong>retroceso</strong> (Perl, Python, Java, JavaScript), flexibles pero con riesgo de tiempo exponencial, y motores de <strong>autómata</strong> (<code>grep</code>, RE2), de tiempo lineal. Se comparan en <a href="tema.html?id=regex-backtracking">Backtracking vs Automata Matching</a>. El mismo formalismo sustenta el análisis léxico de los compiladores (<a href="tema.html?id=lexical-analysis">Lexical Analysis &amp; Tokens</a>).</p>`,
  });
})();
