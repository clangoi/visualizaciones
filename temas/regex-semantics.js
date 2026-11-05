(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const EJEMPLOS = ['(a|b)*abb', 'a*b*', '(ab)*|b', '(0|1)*1(0|1)', 'a(b|c)*', 'ε|a|aa', '(a|b)(a|b)*'];

  /* ---------- Fig. 1: expresión, árbol y lenguaje ---------- */

  function montarArbol(cuerpo) {
    let texto = '(a|b)*abb', palabra = 'babb', r = null, N = 5;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Expresión regular', valor: texto, alCambiar: (v) => { texto = v; actualizar(); }, alEnter: (v) => { texto = v; actualizar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { texto = v; campo.valor = v; actualizar(); } } });
    ctl.texto({ etiqueta: 'Palabra a probar', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, ''); dibujar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, ''); dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud máxima listada', min: 2, max: 7, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    cuerpo.dataset.sinLeyenda = 'el árbol no usa color con significado; el veredicto va en palabras';
    VIZ.subtitulo(cuerpo, 'Palabras del lenguaje, por longitud y orden alfabético');
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Sintaxis: <code>|</code> unión, yuxtaposición concatena, <code>*</code> estrella, <code>+</code> una o más, <code>?</code> opcional, <code>ε</code> palabra vacía, <code>∅</code> lenguaje vacío, <code>\\</code> escapa un símbolo especial.');

    function actualizar() { r = A.parsear(texto); dibujar(); }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      if (r.error) {
        ctx.fillStyle = C.s8; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`Error en la posición ${r.pos + 1}: ${r.error}.`, 12, H / 2);
        lista.replaceChildren(); registro.textContent = 'La expresión no está bien formada.'; lectura.set([['¿bien formada?', 'no']]);
        return;
      }
      const raiz = A.arbolRegex(r.ast);
      VIZ.web.arbol(ctx, raiz, W, H, (n) => ({ relleno: n.hijos.length ? C.neutro : C.superficie }), { tam: 12 });
      const nfa = A.thompson(r.ast), pal = A.ordenar(A.lenguaje(r.ast, N));
      lista.replaceChildren(VIZ.el('div', null, pal.length ? pal.slice(0, 60).map((w) => w || 'ε').join('   ') + (pal.length > 60 ? `   … (${pal.length - 60} más)` : '') : '∅ (ninguna palabra de longitud ≤ ' + N + ')'));
      const ok = A.acepta(nfa, palabra);
      registro.textContent = `«${palabra || 'ε'}» ${ok ? 'pertenece' : 'no pertenece'} al lenguaje de ${A.aTexto(r.ast)}.`;
      lectura.set([['expresión normalizada', A.aTexto(r.ast)], ['nodos del árbol', String(A.posorden(r.ast).length)], ['palabras de longitud ≤ ' + N, String(pal.length)], ['palabra de prueba', ok ? 'pertenece' : 'no pertenece']]);
    }
    lienzo.alDibujar = () => r && dibujar();
    actualizar();
  }

  /* ---------- Fig. 2: semántica subexpresión por subexpresión ---------- */

  function montarSemantica(cuerpo) {
    let texto = '(a|b)*b', N = 3;
    const ctl = VIZ.controles(cuerpo);
    const campo = ctl.texto({ etiqueta: 'Expresión regular', valor: texto, alCambiar: (v) => { texto = v; dibujar(); }, alEnter: (v) => { texto = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ejemplos', opciones: [['', '— elegir —'], ...EJEMPLOS.map((e) => [e, e])], valor: '', alCambiar: (v) => { if (v) { texto = v; campo.valor = v; dibujar(); } } });
    ctl.rango({ etiqueta: 'Longitud máxima', min: 1, max: 5, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de texto';
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es una subexpresión (de las hojas hacia la raíz) con su lenguaje, recortado a la longitud elegida. La regla de cada operador aparece en la última columna.');
    const REGLA = { sim: 'L(a) = {a}', eps: 'L(ε) = {ε}', vacio: 'L(∅) = ∅', uni: 'L(r) ∪ L(s)', cat: 'L(r) · L(s)', est: 'L(r)* = ⋃ L(r)ᵏ' };
    function dibujar() {
      const r = A.parsear(texto);
      if (r.error) { tabla.replaceChildren(); registro.textContent = `Error en la posición ${r.pos + 1}: ${r.error}.`; return; }
      const sub = A.posorden(r.ast).filter((x, i, a) => a.findIndex((y) => A.aTexto(y) === A.aTexto(x)) === i);
      tabla.replaceChildren(VIZ.el('tr', null, ['Subexpresión', 'Lenguaje (longitud ≤ ' + N + ')', 'Regla'].map((t) => VIZ.el('th', null, t))),
        ...sub.map((x, i) => {
          const L = A.ordenar(A.lenguaje(x, N));
          return VIZ.el('tr', { class: i === sub.length - 1 ? 'activa' : null }, VIZ.el('td', { class: 'izq' }, A.aTexto(x)),
            VIZ.el('td', null, L.length ? '{ ' + L.slice(0, 12).map((w) => w || 'ε').join(', ') + (L.length > 12 ? ', …' : '') + ' }' : '∅'),
            VIZ.el('td', { class: 'izq' }, REGLA[x.t]));
        }));
      registro.textContent = `La última fila es L(${A.aTexto(r.ast)}) hasta longitud ${N}: ${A.lenguaje(r.ast, N).size} palabras.`;
    }
    dibujar();
  }

  VIZ.registrarTema('regex-semantics', {
    intro: String.raw`
      <p>Una <strong>expresión regular</strong> describe un lenguaje con una fórmula: los símbolos se describen a sí mismos y se combinan con tres operaciones —unión, concatenación y estrella—. La expresión \((a|b)^*abb\) denota «las palabras sobre \(\{a,b\}\) que terminan en \(abb\)».</p>
      <p>La definición es <em>recursiva</em>, así que cada expresión es un árbol y su lenguaje se calcula de las hojas hacia la raíz. Los lenguajes que se pueden describir así son exactamente los que reconoce un autómata finito (teorema de Kleene).</p>`,
    visualizaciones: [
      {
        titulo: 'Árbol de sintaxis y lenguaje',
        descripcion: 'Escriba una expresión: se dibuja su árbol, se listan sus palabras más cortas y se prueba si una palabra pertenece. Pruebe errores como «(a» o «*a».',
        montar: montarArbol,
      },
      {
        titulo: 'Semántica operación por operación',
        descripcion: 'Cada subexpresión muestra el lenguaje que denota; compruebe cómo la estrella genera las potencias y la unión reúne las alternativas.',
        montar: montarSemantica,
      },
    ],
    teoria: String.raw`
      <h2>Sintaxis</h2>
      <p>Las expresiones regulares sobre \(\Sigma\) se definen por inducción:</p>
      <ul>
        <li>\(\varnothing\), \(\varepsilon\) y cada símbolo \(a \in \Sigma\) son expresiones;</li>
        <li>si \(r\) y \(s\) son expresiones, también \((r \mid s)\) (unión), \((r\,s)\) (concatenación) y \((r^*)\) (estrella).</li>
      </ul>
      <p>Por convención la estrella liga más fuerte que la concatenación, y ésta más que la unión; así \(ab^*|c\) significa \((a(b^*))\mid c\). Se abrevian \(r^+ = r r^*\) y \(r? = r \mid \varepsilon\).</p>
      <h2>Semántica</h2>
      \[ L(\varnothing) = \varnothing, \quad L(\varepsilon) = \{\varepsilon\}, \quad L(a) = \{a\}, \]
      \[ L(r \mid s) = L(r) \cup L(s), \quad L(rs) = L(r)\cdot L(s), \quad L(r^*) = L(r)^*. \]
      <p>Un lenguaje es <strong>regular</strong> si es \(L(r)\) para alguna expresión \(r\). Distintas expresiones pueden denotar el mismo lenguaje: \((a|b)^* = (a^*b^*)^*\).</p>
      <h2>Identidades útiles</h2>
      <table>
        <tr><th>Identidad</th><th>Nombre</th></tr>
        <tr><td>\(r \mid s = s \mid r\), \(r\mid r = r\), \(r \mid \varnothing = r\)</td><td>la unión es conmutativa, idempotente, con neutro \(\varnothing\)</td></tr>
        <tr><td>\(r\varepsilon = \varepsilon r = r\), \(r\varnothing = \varnothing r = \varnothing\)</td><td>neutro y absorbente de la concatenación</td></tr>
        <tr><td>\(r(s\mid t) = rs \mid rt\)</td><td>distributividad</td></tr>
        <tr><td>\((r^*)^* = r^*\), \(\varnothing^* = \varepsilon\), \(r^* = \varepsilon \mid r r^*\)</td><td>identidades de la estrella</td></tr>
        <tr><td>\((r \mid s)^* = (r^*s^*)^*\)</td><td>una estrella absorbe a la otra</td></tr>
      </table>
      <div class="recuadro"><p><strong>Teorema de Kleene.</strong> Un lenguaje es regular si y solo si lo reconoce un autómata finito. Las dos direcciones se prueban con constructivos: de expresión a autómata con la
      <a href="tema.html?id=thompson-construction">construcción de Thompson</a>, y de autómata a expresión por <a href="tema.html?id=state-elimination">eliminación de estados</a>.</p></div>
      <h2>Ojo con las expresiones «prácticas»</h2>
      <p>Las bibliotecas de expresiones regulares (POSIX, PCRE) agregan clases de caracteres, anclas, grupos y referencias hacia atrás. Estas últimas ya no describen solo lenguajes regulares.
      Se estudian en <a href="tema.html?id=practical-regex">Practical Regular Expressions</a>.</p>`,
  });
})();
