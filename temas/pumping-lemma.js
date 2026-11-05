(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.ejemplos;
  const CLAVES = ['par-a', 'contiene-aba', 'no-bb', 'termina-01', 'div3'];

  /* ---------- Fig. 1: bombear una palabra larga en un AFD ---------- */

  function montarBombeo(cuerpo) {
    let k = 'contiene-aba', palabra = 'bbabaab', veces = 3, geo = null;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'AFD', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; palabra = E[k].alf[0] === '0' ? '110101' : 'bbabaab'; campo.valor = palabra; dibujar(); } });
    void sel;
    const campo = ctl.texto({ etiqueta: 'Palabra w (de longitud ≥ n)', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, ''); dibujar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, ''); dibujar(); } });
    ctl.rango({ etiqueta: 'Veces que se repite y (i)', min: 0, max: 5, valor: veces, alCambiar: (v) => { veces = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 330 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.3), borde: C.s1, texto: 'x: antes del ciclo' },
      { color: VIZ.alfa(C.s2, 0.3), borde: C.s2, texto: 'y: el ciclo (se puede repetir)' },
      { color: VIZ.alfa(C.s3, 0.3), borde: C.s3, texto: 'z: después del ciclo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Si |w| ≥ n (el número de estados), el recorrido repite algún estado antes de n pasos (principio del palomar). El tramo entre las dos visitas es un ciclo y: se puede recorrer 0, 1, 2… veces y el autómata termina en el mismo estado.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo, aut = E[k].aut, T = A.delta(aut), n = aut.n;
      lienzo.limpiar();
      const w = [...palabra].filter((c) => aut.alf.includes(c)).join('');
      const qs = [aut.ini[0]];
      for (const c of w) qs.push(T[qs[qs.length - 1]][aut.alf.indexOf(c)]);
      let a = -1, b = -1;
      const vistos = new Map();
      for (let i = 0; i <= Math.min(w.length, n); i++) { if (vistos.has(qs[i])) { a = vistos.get(qs[i]); b = i; break; } vistos.set(qs[i], i); }
      const x = a >= 0 ? w.slice(0, a) : w, y = a >= 0 ? w.slice(a, b) : '', z = a >= 0 ? w.slice(b) : '';
      const bombeada = x + y.repeat(veces) + z, ok0 = A.acepta(aut, w), ok = A.acepta(aut, bombeada);
      const fila = (t, yy, partes, etiqueta) => {
        const celda = Math.max(14, Math.min(26, Math.floor((W - 130) / Math.max(8, t.length))));
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(etiqueta, 56, yy + celda / 2);
        let i = 0;
        for (const [s, col] of partes) for (const ch of s) {
          ctx.fillStyle = VIZ.alfa(col, 0.3); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
          ctx.fillRect(64 + i * celda, yy, celda, celda); ctx.strokeRect(64.5 + i * celda, yy + 0.5, celda - 1, celda - 1);
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(Math.min(13, celda - 6), 600); ctx.textAlign = 'center'; ctx.fillText(ch, 64 + i * celda + celda / 2, yy + celda / 2 + 0.5);
          i++;
        }
        if (!t.length) { ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.fillText('ε', 64, yy + celda / 2); }
        return 64 + i * celda;
      };
      fila(w, 8, a >= 0 ? [[x, C.s1], [y, C.s2], [z, C.s3]] : [[w, C.s1]], 'w');
      const fin = fila(bombeada, 42, [[x, C.s1], [y.repeat(veces), C.s2], [z, C.s3]], 'xyⁱz');
      ctx.fillStyle = ok ? C.s6 : C.s8; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'left'; ctx.fillText(ok ? '∈ L' : '∉ L', fin + 10, 42 + 12);
      const ciclo = new Set(a >= 0 ? qs.slice(a, b + 1) : []);
      geo = A.dibujar(lienzo, aut, {
        caja: { x: 0, y: 76, w: W, h: 250 }, radio: 16,
        nodo: (q) => (ciclo.has(q) ? { relleno: VIZ.alfa(C.s2, 0.28), borde: C.s2, ancho: 3 } : qs.includes(q) ? { borde: C.s1, ancho: 2.5 } : null),
        arista: (de, a2, sims) => { for (let i = 0; i < qs.length - 1; i++) if (qs[i] === de && qs[i + 1] === a2 && sims.includes(w[i])) return i >= a && i < b && a >= 0 ? { color: C.s2, ancho: 3 } : { color: C.s1, ancho: 2.5 }; return null; },
      });
      registro.textContent = w.length < n
        ? `|w| = ${w.length} < n = ${n}: la palabra es más corta que el número de estados y puede no repetir ninguno; el lema no dice nada.`
        : a >= 0
          ? `Estados recorridos: ${qs.map((q) => aut.nombres[q]).join(' → ')}. Se repite ${aut.nombres[qs[a]]} (pasos ${a} y ${b}), así que x = «${x || 'ε'}», y = «${y}», z = «${z || 'ε'}»; |xy| = ${a + y.length} ≤ n = ${n}. ${ok === ok0 ? `xy^${veces}z se comporta igual que w: ${ok ? 'se acepta' : 'se rechaza'}.` : 'ERROR: no debería cambiar'}`
          : 'La palabra no repite ningún estado en sus primeros n pasos.';
      lectura.set([['n (estados)', String(n)], ['|w|', String(w.length)], ['|xy|', a >= 0 ? String(a + y.length) : '—'], ['|y|', String(y.length)], ['w ∈ L', ok0 ? 'sí' : 'no'], [`xy^${veces}z ∈ L`, ok ? 'sí' : 'no']]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = geo ? A.nodoEn(geo, x, y) : -1;
      if (q < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${E[k].aut.nombres[q]}</b>: ${E[k].significado[q]}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: el juego contra el adversario ---------- */

  const cuenta = (w, c) => [...w].filter((x) => x === c).length;
  const LENG = {
    anbn: { nombre: 'aⁿbⁿ', f: (w) => /^a*b*$/.test(w) && cuenta(w, 'a') === cuenta(w, 'b'), ej: (p) => 'a'.repeat(p) + 'b'.repeat(p), regular: false },
    igual: { nombre: 'igual cantidad de a y de b', f: (w) => cuenta(w, 'a') === cuenta(w, 'b'), ej: (p) => 'a'.repeat(p) + 'b'.repeat(p), regular: false },
    cuad: { nombre: 'a^(n²): longitud cuadrado perfecto', f: (w) => /^a*$/.test(w) && Number.isInteger(Math.sqrt(w.length)), ej: (p) => 'a'.repeat(p * p), regular: false },
    pal: { nombre: 'palíndromos sobre {a, b}', f: (w) => w === [...w].reverse().join(''), ej: (p) => 'a'.repeat(p) + 'b' + 'a'.repeat(p), regular: false },
    astarb: { nombre: 'a*b* (regular: control)', f: (w) => /^a*b*$/.test(w), ej: (p) => 'a'.repeat(p) + 'b'.repeat(p), regular: true },
  };

  function montarJuego(cuerpo) {
    let k = 'anbn', p = 4, palabra = LENG[k].ej(p);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Lenguaje L', opciones: Object.entries(LENG).map(([c, l]) => [c, l.nombre]), valor: k, alCambiar: (v) => { k = v; palabra = LENG[k].ej(p); campo.valor = palabra; dibujar(); } });
    ctl.rango({ etiqueta: 'Longitud de bombeo p', min: 2, max: 6, valor: p, alCambiar: (v) => { p = v; palabra = LENG[k].ej(p); campo.valor = palabra; dibujar(); } });
    const campo = ctl.texto({ etiqueta: 'Su palabra w ∈ L, |w| ≥ p', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, '').slice(0, 40); dibujar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, '').slice(0, 40); dibujar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto sin-corte' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla de texto: el veredicto de cada descomposición va en palabras y color de texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Usted elige w; el adversario elige cómo partirla en xyz con |xy| ≤ p y |y| ≥ 1; usted elige i. Si para <em>toda</em> partición existe un i que saca xyⁱz de L, L no puede ser regular. Pruebe palabras malas: «a^p b^p» funciona, pero «(ab)^p» no.');

    function dibujar() {
      const L = LENG[k], w = palabra;
      const valida = L.f(w) && w.length >= p;
      const filas = [VIZ.el('tr', null, ['x', 'y', 'z', 'i = 0', 'i = 2', 'i = 3', 'refutada con'].map((t) => VIZ.el('th', null, t)))];
      let refutadas = 0, total = 0;
      if (valida) {
        for (let a = 0; a < p; a++) for (let b = a + 1; b <= p; b++) {
          const x = w.slice(0, a), y = w.slice(a, b), z = w.slice(b);
          if (!y) continue;
          total++;
          const res = [0, 2, 3].map((i) => L.f(x + y.repeat(i) + z));
          const malo = [0, 2, 3].find((i, j) => !res[j]);
          if (malo !== undefined) refutadas++;
          const cel = (ok) => VIZ.el('td', { style: { color: ok ? C.s6 : C.s8, fontWeight: ok ? 400 : 700 } }, ok ? '∈ L' : '∉ L');
          filas.push(VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, x || 'ε'), VIZ.el('td', { class: 'izq' }, y), VIZ.el('td', { class: 'izq' }, z || 'ε'), cel(res[0]), cel(res[1]), cel(res[2]),
            VIZ.el('td', { style: { color: malo !== undefined ? C.s8 : C.s6, fontWeight: 700 } }, malo !== undefined ? `i = ${malo}` : 'ninguna (el adversario gana)')));
        }
      }
      tabla.replaceChildren(...(valida ? filas : []));
      registro.textContent = !L.f(w) ? `«${w || 'ε'}» no pertenece a L: elija una palabra del lenguaje.` : w.length < p ? `La palabra debe tener al menos p = ${p} símbolos.`
        : refutadas === total ? `Las ${total} descomposiciones posibles se refutan: con esta w el lema de bombeo se contradice, luego L no es regular.`
          : `${total - refutadas} descomposición(es) resisten el bombeo: el adversario se salva con ${L.regular ? 'un lenguaje regular, como era de esperar' : 'su elección de w; pruebe otra palabra'}.`;
      lectura.set([['p', String(p)], ['|w|', String(w.length)], ['descomposiciones xyz', String(total)], ['refutadas', String(refutadas)], ['¿L es regular?', L.regular ? 'sí (control)' : 'no']]);
    }
    dibujar();
  }

  VIZ.registrarTema('pumping-lemma', {
    intro: String.raw`
      <p>Un autómata con \(n\) estados que lee una palabra de \(n\) o más símbolos <strong>pasa dos veces por un mismo estado</strong>: es el principio del palomar. El tramo entre las dos visitas es un ciclo, y como el autómata no recuerda cuántas veces lo recorrió, puede recorrerse cualquier número de veces sin cambiar el resultado.</p>
      <p>De esta observación sale el <strong>lema de bombeo</strong>, la herramienta clásica para demostrar que un lenguaje <em>no</em> es regular: se escoge una palabra y se muestra que ninguna forma de «bombearla» se queda dentro del lenguaje.</p>`,
    visualizaciones: [
      {
        titulo: 'El ciclo que se puede repetir',
        descripcion: 'Escriba una palabra de al menos n símbolos: se localiza el primer estado repetido, se parte la palabra en x, y y z, y se repite y las veces que usted indique.',
        montar: montarBombeo,
      },
      {
        titulo: 'El juego del lema de bombeo',
        descripcion: 'Usted elige w; el adversario ensaya todas las descomposiciones permitidas. Compruebe que aⁿbⁿ se refuta, que una mala w no basta y que a*b* resiste.',
        montar: montarJuego,
      },
    ],
    teoria: String.raw`
      <h2>Enunciado</h2>
      <div class="recuadro"><p><strong>Lema de bombeo.</strong> Si \(L\) es regular, existe un entero \(p \ge 1\) (la <em>longitud de bombeo</em>) tal que toda palabra \(w \in L\) con \(|w| \ge p\) puede escribirse como \(w = xyz\) con</p>
      <p>\[ |y| \ge 1, \qquad |xy| \le p, \qquad xy^iz \in L \ \text{ para todo } i \ge 0. \]</p></div>
      <h2>Demostración</h2>
      <p>Sea \(M\) un AFD con \(p\) estados para \(L\), y \(w = a_1\cdots a_m \in L\) con \(m \ge p\). Los estados \(q_0, q_1, \dots, q_p\) del recorrido de \(w\) son \(p+1\) y solo hay \(p\) estados distintos: existen \(j &lt; l \le p\) con \(q_j = q_l\). Tomando \(x = a_1\cdots a_j\), \(y = a_{j+1}\cdots a_l\), \(z = a_{l+1}\cdots a_m\), se tiene \(|y| \ge 1\) y \(|xy| = l \le p\). Como \(\hat\delta(q_j, y) = q_j\), repetir \(y\) \(i\) veces lleva de \(q_0\) a \(q_j\) y luego a \(q_m\): el mismo estado final que \(w\). Así \(xy^iz \in L\) para todo \(i\). \(\blacksquare\)</p>
      <h2>Cómo usarlo para refutar (juego de cuantificadores)</h2>
      <p>El enunciado alterna \(\exists p\; \forall w\; \exists xyz\; \forall i\). Para probar que \(L\) <strong>no</strong> es regular, se niega: \(\forall p\;\exists w\;\forall xyz\;\exists i\). Es un juego:</p>
      <ol>
        <li>el adversario elige \(p\);</li>
        <li><strong>usted</strong> elige \(w \in L\) con \(|w| \ge p\) (la elección clave);</li>
        <li>el adversario elige la partición \(xyz\) con \(|xy|\le p\), \(|y|\ge 1\);</li>
        <li><strong>usted</strong> elige \(i\) y muestra que \(xy^iz \notin L\).</li>
      </ol>
      <p>Ejemplo \(L = \{a^nb^n\}\): con \(w = a^pb^p\), como \(|xy| \le p\), \(y\) cae entre las \(a\); luego \(xy^2z\) tiene más \(a\) que \(b\) y queda fuera de \(L\). Con \(w = (ab)^p\) no funciona, porque \(y\) podría ser \(ab\).</p>
      <h2>Advertencias</h2>
      <ul>
        <li>El lema es una condición <strong>necesaria</strong>, no suficiente: existen lenguajes no regulares que cumplen el enunciado. Para una caracterización exacta se usa <a href="tema.html?id=myhill-nerode">Myhill-Nerode</a>.</li>
        <li>No sirve para probar que un lenguaje <em>es</em> regular: para eso se da un autómata o una expresión.</li>
        <li>También se puede refutar usando propiedades de clausura: si \(L\) fuera regular, \(L \cap a^*b^*\) lo sería; pero \(L \cap a^*b^* = \{a^nb^n\}\) no lo es.</li>
      </ul>`,
  });
})();
