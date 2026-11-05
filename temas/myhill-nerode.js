(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.ejemplos;
  const cuenta = (w, c) => [...w].filter((x) => x === c).length;
  const LENG = {
    'par-a': { nombre: 'Número par de a', f: E['par-a'].f, aut: E['par-a'].aut },
    'contiene-aba': { nombre: 'Contiene «aba»', f: E['contiene-aba'].f, aut: E['contiene-aba'].aut },
    'a-antes-b': { nombre: 'a*b*', f: E['a-antes-b'].f, aut: E['a-antes-b'].aut },
    'no-bb': { nombre: 'Sin dos b seguidas', f: E['no-bb'].f, aut: E['no-bb'].aut },
    anbn: { nombre: 'aⁿbⁿ (no regular)', f: (w) => /^a*b*$/.test(w) && cuenta(w, 'a') === cuenta(w, 'b') },
    igual: { nombre: 'igual cantidad de a y b (no regular)', f: (w) => cuenta(w, 'a') === cuenta(w, 'b') },
    pal: { nombre: 'palíndromos (no regular)', f: (w) => w === [...w].reverse().join('') },
  };
  const CLAVES = Object.keys(LENG);
  const palabras = (max) => { const r = ['']; let niv = ['']; for (let l = 1; l <= max; l++) { const s = []; for (const w of niv) for (const c of 'ab') s.push(w + c); r.push(...s); niv = s; } return r; };
  const firma = (f, u, sufijos) => sufijos.map((z) => (f(u + z) ? 1 : 0)).join('');
  const cortas = (f, u, sufijos, n = 3) => sufijos.filter((z) => f(u + z)).slice(0, n).map((z) => z || 'ε');

  /* ---------- Fig. 1: clases de equivalencia de los prefijos ---------- */

  function montarClases(cuerpo) {
    let k = 'contiene-aba', P = 4, S = 5, u = 'ab', v = 'ba';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Lenguaje', opciones: CLAVES.map((c) => [c, LENG[c].nombre]), valor: k, alCambiar: (x) => { k = x; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud máxima de prefijos', min: 1, max: 6, valor: P, alCambiar: (x) => { P = x; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud máxima de sufijos', min: 1, max: 7, valor: S, alCambiar: (x) => { S = x; dibujar(); } });
    ctl.texto({ etiqueta: 'Prefijo u', valor: u, alCambiar: (x) => { u = x.replace(/[^ab]/g, ''); dibujar(); } });
    ctl.texto({ etiqueta: 'Prefijo v', valor: v, alCambiar: (x) => { v = x.replace(/[^ab]/g, ''); dibujar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Dos prefijos u y v son equivalentes si ningún sufijo z hace que uz y vz difieran en pertenencia a L. Aquí «ningún» se comprueba hasta la longitud de sufijo elegida. Compare con el AFD mínimo: coincide para los regulares.');

    function dibujar() {
      const L = LENG[k], pref = palabras(P), suf = palabras(S);
      const grupos = new Map();
      for (const w of pref) { const f = firma(L.f, w, suf); if (!grupos.has(f)) grupos.set(f, []); grupos.get(f).push(w); }
      const clases = [...grupos.values()];
      tabla.replaceChildren(VIZ.el('tr', null, ['Clase', 'Prefijos (primeros)', 'Algunos sufijos z con uz ∈ L'].map((t) => VIZ.el('th', null, t))),
        ...clases.map((g, i) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, `[${g[0] || 'ε'}]`), VIZ.el('td', { class: 'izq' }, g.slice(0, 9).map((w) => w || 'ε').join(', ') + (g.length > 9 ? ` … (${g.length})` : '')),
          VIZ.el('td', { class: 'izq' }, cortas(L.f, g[0], suf).join(', ') || '— ninguno (clase de rechazo)'))));
      const z = suf.find((s) => L.f(u + s) !== L.f(v + s));
      const minimo = L.aut ? A.minimizar(L.aut).min.n : null;
      registro.textContent = z !== undefined ? `u = «${u || 'ε'}» y v = «${v || 'ε'}» NO son equivalentes: el sufijo «${z || 'ε'}» los distingue (${L.f(u + z) ? 'uz ∈ L, vz ∉ L' : 'uz ∉ L, vz ∈ L'}).` : `u = «${u || 'ε'}» y v = «${v || 'ε'}» no se distinguen con sufijos de longitud ≤ ${S}: pertenecen a la misma clase.`;
      lectura.set([['clases de prefijos', String(clases.length)], ['prefijos considerados', String(pref.length)], ['estados del AFD mínimo', minimo === null ? 'no existe (no regular)' : String(minimo)], ['índice finito', minimo === null ? 'parece infinito: crece con la longitud' : 'sí']]);
    }
    dibujar();
  }

  /* ---------- Fig. 2: ¿se estabiliza el número de clases? ---------- */

  function montarCrecimiento(cuerpo) {
    let hover = null, plano = null, datos = null;
    const CURVAS = ['par-a', 'contiene-aba', 'a-antes-b', 'anbn', 'pal'];
    const S = 7, PM = 7;
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CURVAS.map((c, i) => ({ color: VIZ.series[i], texto: LENG[c].nombre, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Número de clases de equivalencia entre los prefijos de longitud ≤ P, distinguiendo con sufijos de longitud ≤ 7. En un lenguaje regular la curva se aplana en el índice (número de estados del AFD mínimo); en uno no regular sigue creciendo.');
    function calcular() {
      const suf = palabras(S), pref = palabras(PM);
      datos = CURVAS.map((c) => {
        const f = LENG[c].f, firmas = pref.map((w) => firma(f, w, suf));
        return Array.from({ length: PM + 1 }, (_, p) => new Set(firmas.filter((_, i) => pref[i].length <= p)).size);
      });
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const mx = Math.max(...datos.flat());
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: PM, ymin: 1, ymax: mx * 1.1 }, { logY: true, etiquetaX: 'P (longitud máxima de prefijo)', etiquetaY: 'clases', ticksX: Array.from({ length: PM + 1 }, (_, i) => i) });
      plano.ejes();
      datos.forEach((ys, i) => {
        const pts = ys.map((y, p) => [p, y]);
        VIZ.trazar(ctx, plano, pts, VIZ.series[i], 2);
        pts.forEach(([x, y]) => VIZ.marcador(ctx, plano.sx(x), plano.sy(y), VIZ.series[i], x === hover ? 4.5 : 2.5));
      });
      const p = hover == null ? PM : hover;
      lectura.set([['P', String(p)], ...CURVAS.map((c, i) => [LENG[c].nombre.replace(' (no regular)', ''), String(datos[i][p])])]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(PM, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `P = <b>${hover}</b>` + CURVAS.map((c, i) => VIZ.filaTooltip(VIZ.series[i], LENG[c].nombre.replace(' (no regular)', ''), datos[i][hover])).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('myhill-nerode', {
    intro: String.raw`
      <p>¿Cuántos estados necesita, como mínimo, un autómata para un lenguaje? Dos palabras \(u\) y \(v\) deben ir a <em>estados distintos</em> si algún sufijo \(z\) separa sus destinos: \(uz\in L\) pero \(vz\notin L\). Si no existe tal sufijo, pueden compartir estado.</p>
      <p>El <strong>teorema de Myhill-Nerode</strong> convierte esta idea en una caracterización exacta: un lenguaje es regular si y solo si esa relación tiene <em>finitas</em> clases, y el número de clases es el tamaño del autómata mínimo.</p>`,
    visualizaciones: [
      {
        titulo: 'Clases de equivalencia de los prefijos',
        descripcion: 'Agrupe los prefijos según los sufijos que los distinguen. Compare el número de clases con los estados del AFD mínimo y pruebe dos prefijos concretos.',
        montar: montarClases,
      },
      {
        titulo: '¿Se estabiliza el número de clases?',
        descripcion: 'Para lenguajes regulares la curva se aplana; para aⁿbⁿ y los palíndromos sigue creciendo: no hay un número finito de clases.',
        montar: montarCrecimiento,
      },
    ],
    teoria: String.raw`
      <h2>La relación de Myhill-Nerode</h2>
      <p>Para \(L \subseteq \Sigma^*\) se define sobre \(\Sigma^*\)</p>
      \[ u \equiv_L v \iff \forall z \in \Sigma^*:\ (uz \in L \iff vz \in L). \]
      <p>Es una equivalencia, y es compatible con la concatenación por la derecha: \(u \equiv_L v \Rightarrow ua \equiv_L va\). La clase de \(u\) se identifica con su <strong>lenguaje residual</strong> \(u^{-1}L = \{ z : uz \in L \}\): dos prefijos son equivalentes cuando tienen el mismo residual.</p>
      <h2>El teorema</h2>
      <div class="recuadro"><p><strong>Teorema (Myhill-Nerode).</strong> Son equivalentes: (1) \(L\) es regular; (2) \(L\) es unión de clases de una congruencia por la derecha de índice finito; (3) \(\equiv_L\) tiene un número finito de clases. Además, ese número es el de estados del AFD mínimo de \(L\).</p></div>
      <p><em>Esquema.</em> (1)⇒(3): si \(M\) es un AFD con \(k\) estados, \(\hat\delta(q_0,u) = \hat\delta(q_0,v)\) implica \(u \equiv_L v\), luego \(\equiv_L\) tiene a lo más \(k\) clases. (3)⇒(1): se construye el autómata de clases \(Q = \Sigma^*/{\equiv_L}\), \(\delta([u],a) = [ua]\), inicial \([\varepsilon]\), finales \(\{[u] : u \in L\}\); está bien definido por la compatibilidad y acepta \(L\). Este autómata es el mínimo: cualquier otro AFD tiene al menos una clase de palabras por estado.</p>
      <h2>Usos</h2>
      <ul>
        <li><strong>Cota inferior de estados.</strong> Si hay \(m\) palabras dos a dos distinguibles, todo AFD necesita al menos \(m\) estados (así se demostró la explosión en <a href="tema.html?id=subset-blowup">State Explosion in Determinization</a>).</li>
        <li><strong>No regularidad.</strong> Si hay infinitas palabras dos a dos distinguibles, \(L\) no es regular. Para \(L = \{a^nb^n\}\), las palabras \(a^i\) y \(a^j\) (\(i \ne j\)) se distinguen con \(b^i\), luego hay infinitas clases.</li>
        <li><strong>Minimización.</strong> El AFD mínimo es el autómata de clases; los algoritmos de <a href="tema.html?id=dfa-minimization">minimización</a> lo calculan sin conocer \(L\) más que por un AFD.</li>
      </ul>
      <div class="recuadro"><p>A diferencia del <a href="tema.html?id=pumping-lemma">lema de bombeo</a>, que solo da una condición necesaria, Myhill-Nerode es una <strong>caracterización</strong>: sirve tanto para probar que un lenguaje es regular como para probar que no lo es.</p></div>`,
  });
})();
