(function () {
  'use strict';
  const { color: C } = VIZ;
  const A = VIZ.aut;
  const E = A.ejemplos;
  const CLAVES = ['par-a', 'termina-01', 'contiene-aba', 'no-bb', 'a-antes-b', 'div3', 'par-a-par-b'];

  const todas = (alf, max) => { const r = ['']; let niv = ['']; for (let l = 1; l <= max; l++) { const s = []; for (const w of niv) for (const c of alf) s.push(w + c); r.push(...s); niv = s; } return r; };

  /* ---------- Fig. 1: qué «recuerda» cada estado ---------- */

  function montarSignificado(cuerpo) {
    let k = 'contiene-aba', palabra = 'babab', activo = -1, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Lenguaje', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; activo = -1; actualizar(); } });
    ctl.texto({ etiqueta: 'Palabra de prueba', valor: palabra, alCambiar: (v) => { palabra = v.replace(/\s/g, ''); actualizar(); }, alEnter: (v) => { palabra = v.replace(/\s/g, ''); actualizar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.28), borde: C.s1, texto: 'estado elegido / camino de la palabra' },
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'estado final de la palabra, si acepta' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    const tabla = VIZ.el('table', { class: 'tabla-datos texto' });
    caja.appendChild(tabla); cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    VIZ.nota(cuerpo, 'Diseñar un AFD es decidir qué información del pasado hay que recordar: un estado por cada «situación» distinta. Haga clic en un estado para resaltar su significado; la palabra de prueba pinta su camino.');

    function camino() {
      const aut = E[k].aut, T = A.delta(aut), qs = [aut.ini[0]];
      for (const c of palabra) { const j = aut.alf.indexOf(c); qs.push(j < 0 || T[qs[qs.length - 1]][j] < 0 ? -1 : T[qs[qs.length - 1]][j]); if (qs[qs.length - 1] < 0) break; }
      return qs;
    }
    function dibujar() {
      lienzo.limpiar();
      const aut = E[k].aut, qs = camino(), usados = new Set(qs), fin = qs[qs.length - 1];
      geo = A.dibujar(lienzo, aut, {
        nodo: (q) => (q === activo ? { relleno: VIZ.alfa(C.s1, 0.28), borde: C.s1, ancho: 3 } : q === fin && qs.length === palabra.length + 1 && aut.fin.has(q) ? { relleno: VIZ.alfa(C.s6, 0.28), borde: C.s6, ancho: 3 } : usados.has(q) ? { borde: C.s1, ancho: 2 } : null),
        arista: (de, a, sims) => { for (let i = 0; i + 1 < qs.length; i++) if (qs[i] === de && qs[i + 1] === a && sims.includes(palabra[i])) return { color: C.s1, ancho: 3 }; return null; },
      });
      const ok = A.acepta(E[k].aut, palabra);
      registro.textContent = `«${palabra || 'ε'}» ${ok ? 'se acepta' : 'se rechaza'} y la definición dice que ${E[k].f(palabra) ? 'pertenece' : 'no pertenece'} al lenguaje: ${ok === E[k].f(palabra) ? 'coinciden.' : 'NO coinciden (error en el autómata).'}`;
      tabla.replaceChildren(
        VIZ.el('tr', null, ['Estado', 'Qué recuerda'].map((t) => VIZ.el('th', null, t))),
        ...aut.nombres.map((nm, q) => VIZ.el('tr', { class: q === activo ? 'activa' : null }, VIZ.el('td', { class: 'izq' }, (aut.ini.includes(q) ? '→ ' : '') + (aut.fin.has(q) ? '* ' : '') + nm), VIZ.el('td', null, E[k].significado[q]))));
    }
    function actualizar() { lienzo.ajustar(true); dibujar(); }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => { const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y); activo = q === activo ? -1 : q; dibujar(); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev), q = A.nodoEn(geo, x, y); if (q < 0) return tip.ocultar(); tip.mostrar(x, y, `<b>${E[k].aut.nombres[q]}</b>: ${E[k].significado[q]}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: verificar contra la definición (y sabotear) ---------- */

  function montarVerificar(cuerpo) {
    let k = 'termina-01', N = 8, aut = A.copiar(E[k].aut), sabotajes = 0, rnd = VIZ.semilla(5);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Lenguaje', opciones: CLAVES.map((c) => [c, E[c].nombre]), valor: k, alCambiar: (v) => { k = v; restaurar(); } });
    ctl.rango({ etiqueta: 'Longitud máxima probada', min: 2, max: 10, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.boton('Sabotear una transición', () => {
      const e = aut.aristas[Math.floor(rnd() * aut.aristas.length)];
      const otro = (e.a + 1 + Math.floor(rnd() * (aut.n - 1))) % aut.n;
      aut = A.construir({ n: aut.n, nombres: aut.nombres, alf: aut.alf, ini: aut.ini, fin: [...aut.fin], trans: aut.aristas.map((x) => (x === e ? [x.de, x.s, otro] : [x.de, x.s, x.a])), pos: aut.pos });
      sabotajes++; dibujar();
    });
    ctl.boton('Restaurar', () => restaurar());
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 230 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'autómata y definición coinciden' },
      { color: C.s8, texto: 'contraejemplo: palabra donde discrepan' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Probar todas las palabras hasta una longitud no demuestra la corrección, pero encuentra casi cualquier error. Sabotee el autómata y observe el contraejemplo más corto.');
    function restaurar() { aut = A.copiar(E[k].aut); sabotajes = 0; lienzo.ajustar(true); dibujar(); }
    function dibujar() {
      lienzo.limpiar();
      const malas = [];
      const ws = todas(E[k].alf, N);
      for (const w of ws) if (A.acepta(aut, w) !== E[k].f(w)) malas.push(w);
      const mala = malas[0];
      let ruta = null;
      if (mala !== undefined) { const T = A.delta(aut); let q = aut.ini[0]; ruta = [q]; for (const c of mala) { q = T[q][aut.alf.indexOf(c)]; ruta.push(q); } }
      A.dibujar(lienzo, aut, {
        nodo: (q) => (ruta ? (ruta.includes(q) ? { borde: C.s8, ancho: 2.5 } : null) : { borde: C.s6, ancho: 2 }),
        arista: (de, a, sims) => { if (!ruta) return null; for (let i = 0; i + 1 < ruta.length; i++) if (ruta[i] === de && ruta[i + 1] === a && sims.includes(mala[i])) return { color: C.s8, ancho: 3 }; return null; },
      });
      registro.textContent = mala === undefined
        ? `Las ${VIZ.entero(ws.length)} palabras de longitud ≤ ${N} coinciden con la definición.`
        : `Contraejemplo más corto: «${mala || 'ε'}». El autómata ${A.acepta(aut, mala) ? 'la acepta' : 'la rechaza'} pero la definición dice que ${E[k].f(mala) ? 'pertenece' : 'no pertenece'} al lenguaje.`;
      lectura.set([['palabras probadas', VIZ.entero(ws.length)], ['discrepancias', VIZ.entero(malas.length)], ['sabotajes aplicados', String(sabotajes)], ['estados', String(aut.n)]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('dfa-construction', {
    intro: String.raw`
      <p>Diseñar un autómata es decidir <strong>qué hay que recordar</strong> mientras se lee la palabra. Para «número par de <em>a</em>» basta un bit; para «contiene <em>aba</em>» hay que saber qué parte del patrón se lleva ya emparejada.
      Cada estado representa una clase de historias que, de cara al futuro, se comportan igual.</p>
      <p>Una buena práctica es ir de la definición a los estados, completar todas las transiciones (incluido un estado de error si hace falta) y después <em>probar</em> el autómata contra la definición con todas las palabras cortas.</p>`,
    visualizaciones: [
      {
        titulo: 'Qué recuerda cada estado',
        descripcion: 'Elija un lenguaje y lea qué significa cada estado; escriba una palabra y siga su camino por el diagrama. Haga clic en un estado para resaltarlo.',
        montar: montarSignificado,
      },
      {
        titulo: 'Probar el autómata contra la definición',
        descripcion: 'Se comparan autómata y definición sobre todas las palabras hasta la longitud elegida. Sabotee una transición y observe el contraejemplo más corto.',
        montar: montarVerificar,
      },
    ],
    teoria: String.raw`
      <h2>Método de diseño</h2>
      <ol>
        <li><strong>Qué recordar.</strong> Liste las situaciones del pasado que importan para el futuro (paridades, el último símbolo, cuánto del patrón se ha emparejado, el resto módulo \(m\)).</li>
        <li><strong>Un estado por situación.</strong> El estado inicial corresponde a «no he leído nada»; los de aceptación, a las situaciones en que la palabra leída ya está en el lenguaje.</li>
        <li><strong>Transiciones.</strong> Para cada situación y cada símbolo, decida a qué situación se pasa. Complete la función: lo que no sirve va a un estado trampa.</li>
        <li><strong>Pruebe.</strong> Compare con la definición sobre todas las palabras cortas y razone por qué no faltan casos.</li>
      </ol>
      <h2>Patrones frecuentes</h2>
      <table>
        <tr><th>Lenguaje</th><th>Estados</th><th>Idea</th></tr>
        <tr><td>«cantidad de \(a\) congruente con \(r\) mod \(m\)»</td><td>\(m\)</td><td>un contador módulo \(m\)</td></tr>
        <tr><td>«termina en \(u\)» / «contiene \(u\)»</td><td>\(|u|+1\)</td><td>largo del mayor prefijo de \(u\) que es sufijo de lo leído (ver <a href="tema.html?id=prefix-function">función de prefijos</a>)</td></tr>
        <tr><td>«número binario divisible por \(m\)»</td><td>\(m\)</td><td>el resto \(r\); al leer el bit \(b\): \(r \leftarrow (2r + b) \bmod m\)</td></tr>
        <tr><td>«todas las \(a\) antes de las \(b\)»</td><td>3</td><td>fase 1, fase 2, error</td></tr>
      </table>
      <h2>Corrección</h2>
      <p>Se demuestra por inducción sobre \(|w|\) una <strong>invariante</strong>: «\(\hat\delta(q_0, w) = q\) si y solo si \(w\) cumple la propiedad \(P_q\)». Por ejemplo, en el autómata de divisibilidad por 3:
      \(\hat\delta(r_0, w) = r_i\) si y solo si el valor binario de \(w\) es \(\equiv i \pmod 3\). El paso inductivo usa \(\operatorname{val}(wb) = 2\operatorname{val}(w) + b\).</p>
      <div class="recuadro"><p>Probar todas las palabras hasta una longitud es una prueba, no una demostración. Pero si el AFD tiene \(k\) estados y la definición también se puede expresar con \(k'\) estados, basta con probar hasta longitud \(k\,k'\)
      (ver <a href="tema.html?id=regular-decision">equivalencia de autómatas</a>).</p></div>`,
  });
})();
