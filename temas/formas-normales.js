(function () {
  'use strict';
  const { el, color: C } = VIZ;

  // Esquemas de ejemplo: atributos y dependencias funcionales [X, Y].
  const ESQUEMAS = {
    inscripcion: {
      nombre: 'Inscripción',
      atr: ['rol', 'nombre', 'sigla', 'titulo', 'nota'],
      df: [[['rol'], ['nombre']], [['sigla'], ['titulo']], [['rol', 'sigla'], ['nota']]],
    },
    empleados: {
      nombre: 'Empleados',
      atr: ['rut', 'nombre', 'depto', 'jefe', 'proyecto', 'horas'],
      df: [[['rut'], ['nombre', 'depto']], [['depto'], ['jefe']], [['rut', 'proyecto'], ['horas']]],
    },
    direccion: {
      nombre: 'Dirección',
      atr: ['calle', 'ciudad', 'cp'],
      df: [[['calle', 'ciudad'], ['cp']], [['cp'], ['ciudad']]],
    },
    abstracto: {
      nombre: 'R(A, B, C, D, E, G)',
      atr: ['A', 'B', 'C', 'D', 'E', 'G'],
      df: [[['A', 'B'], ['C']], [['C'], ['A']], [['B', 'C'], ['D']], [['A', 'C', 'D'], ['B']], [['D'], ['E', 'G']], [['B', 'E'], ['C']], [['C', 'G'], ['B', 'D']], [['C', 'E'], ['A', 'G']]],
    },
  };
  const txtDF = ([x, y]) => `${x.join(' ')} → ${y.join(' ')}`;
  const sub = (a, b) => a.every((v) => b.includes(v));

  function clausura(X, df) {
    const r = new Set(X);
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const [x, y] of df) if (x.every((a) => r.has(a)) && y.some((a) => !r.has(a))) { y.forEach((a) => r.add(a)); cambio = true; }
    }
    return r;
  }
  function subconjuntos(atr) {
    const out = [];
    for (let m = 1; m < 1 << atr.length; m++) out.push(atr.filter((_, i) => m & (1 << i)));
    return out.sort((a, b) => a.length - b.length);
  }
  function claves(atr, df) {
    const sup = subconjuntos(atr).filter((X) => sub(atr, [...clausura(X, df)]));
    return sup.filter((X) => !sup.some((Y) => Y.length < X.length && sub(Y, X)));
  }
  // Forma normal más alta de R (atributos atr) bajo df (proyectadas por clausura).
  function formaNormal(atr, df) {
    const K = claves(atr, df), primos = new Set(K.flat());
    let bcnf = true, tres = true, dos = true;
    for (const X of subconjuntos(atr)) {
      if (X.length === atr.length) continue;
      const dep = [...clausura(X, df)].filter((a) => atr.includes(a) && !X.includes(a));
      if (!dep.length) continue;
      const esSuper = K.some((k) => sub(k, X));
      if (esSuper) continue;
      bcnf = false;
      if (dep.some((a) => !primos.has(a))) tres = false;
      if (K.some((k) => X.length < k.length && sub(X, k)) && dep.some((a) => !primos.has(a))) dos = false;
    }
    return bcnf ? 'BCNF' : tres ? '3NF' : dos ? '2NF' : '1NF';
  }
  // Primera dependencia que viola BCNF en R: X → (X⁺ ∩ R) − X con X no superclave.
  function violacion(atr, df) {
    for (const X of subconjuntos(atr)) {
      if (X.length === atr.length) continue;
      const cl = [...clausura(X, df)].filter((a) => atr.includes(a));
      if (cl.length > X.length && cl.length < atr.length) return [X, cl.filter((a) => !X.includes(a))];
    }
    return null;
  }

  /* ---------- Fig. 1: clausura de atributos ---------- */

  function montarClausura(cuerpo) {
    let clave = 'inscripcion', X = ['rol'], conj = new Set(), activa = -1, nuevos = new Set(), mensaje = '';
    const ctl = VIZ.controles(cuerpo);
    let casillas = null, grupo = null;
    ctl.selector({
      etiqueta: 'Esquema', valor: clave, opciones: Object.entries(ESQUEMAS).map(([k, v]) => [k, v.nombre]),
      alCambiar: (v) => { clave = v; X = [ESQUEMAS[v].atr[0]]; armarCasillas(); rep.reiniciar(); },
    });
    function armarCasillas() {
      if (grupo) grupo.remove();
      casillas = ctl.casillas(ESQUEMAS[clave].atr.map((a) => ({ clave: a, texto: a, activo: X.includes(a) })),
        (e) => { X = ESQUEMAS[clave].atr.filter((a) => e[a]); rep.reiniciar(); });
      grupo = ctl.caja.querySelector('.grupo-casillas');
    }
    armarCasillas();
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    VIZ.subtitulo(cuerpo, 'Dependencias funcionales');
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const fichas = VIZ.grafo.estructura(cuerpo, 'X⁺ =');
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'dependencia que se examina' },
      { color: C.s6, texto: 'atributo en X (inicio)' },
      { color: C.s2, texto: 'agregado en este paso' },
      { color: C.tinta, texto: 'agregado antes' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque los atributos de X y ejecute: el algoritmo recorre las dependencias hasta que una vuelta completa no agrega nada.');

    function iniciar() {
      const E = ESQUEMAS[clave];
      conj = new Set(X); activa = -1; nuevos = new Set();
      mensaje = X.length ? `X⁺ empieza como X = {${X.join(', ')}}.` : 'Elija al menos un atributo.';
      return (function* () {
        if (!X.length) return;
        let cambio = true, vuelta = 0;
        while (cambio) {
          cambio = false; vuelta++;
          for (let i = 0; i < E.df.length; i++) {
            const [x, y] = E.df[i];
            activa = i; nuevos = new Set();
            if (x.every((a) => conj.has(a))) {
              const agrega = y.filter((a) => !conj.has(a));
              agrega.forEach((a) => { conj.add(a); nuevos.add(a); });
              if (agrega.length) cambio = true;
              mensaje = agrega.length ? `Vuelta ${vuelta}: {${x.join(', ')}} ⊆ X⁺, se agrega ${agrega.join(', ')}.` : `Vuelta ${vuelta}: ${txtDF(E.df[i])} se cumple, pero no agrega nada nuevo.`;
            } else mensaje = `Vuelta ${vuelta}: falta ${x.filter((a) => !conj.has(a)).join(', ')} en X⁺; ${txtDF(E.df[i])} no se aplica todavía.`;
            yield;
          }
        }
        activa = -1; nuevos = new Set();
        const sup = conj.size === E.atr.length;
        mensaje = `Una vuelta completa sin cambios: X⁺ = {${[...conj].join(', ')}}. ${sup ? 'X es superclave.' : 'X no es superclave.'}`;
      })();
    }
    function dibujar() {
      const E = ESQUEMAS[clave];
      lista.replaceChildren(...E.df.map((d, i) => el('div', { class: i === activa ? 'activa' : null }, txtDF(d))));
      fichas.set(E.atr.filter((a) => conj.has(a)).map((a) => (X.includes(a)
        ? { texto: a, color: C.s6, tinta: C.s6 }
        : nuevos.has(a) ? { texto: a, color: C.s2, fondo: C.s2, tinta: C.sobre } : { texto: a })), 'vacío');
      registro.textContent = mensaje;
      const K = claves(E.atr, E.df);
      lectura.set([
        ['|X⁺|', `${conj.size} de ${E.atr.length}`],
        ['¿superclave?', conj.size === E.atr.length ? 'sí' : 'no'],
        ['claves candidatas', K.map((k) => `{${k.join(',')}}`).join(' ')],
        ['forma normal', formaNormal(E.atr, E.df)],
      ]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: descomposición en BCNF ---------- */

  function montarBCNF(cuerpo) {
    let clave = 'empleados', rels = [], pasos = [], mensaje = '', ultima = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Esquema', valor: clave, opciones: Object.entries(ESQUEMAS).map(([k, v]) => [k, v.nombre]),
      alCambiar: (v) => { clave = v; rep.reiniciar(); },
    });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lista = el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s1, 0.18), texto: 'relación que se acaba de crear' },
      { color: C.s8, texto: 'dependencia que viola BCNF', forma: 'linea' },
      { color: C.s6, texto: 'relación en BCNF', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Con «Dirección» la descomposición en BCNF pierde la dependencia calle ciudad → cp: compárela con los otros esquemas.');

    function iniciar() {
      const E = ESQUEMAS[clave];
      rels = [{ atr: [...E.atr], nivel: 0, nombre: 'R' }];
      pasos = []; ultima = null; let n = 0;
      mensaje = `${E.nombre} está en ${formaNormal(E.atr, E.df)}. Buscar una dependencia X → Y con X no superclave.`;
      return (function* () {
        for (;;) {
          const i = rels.findIndex((r) => !r.hecha && violacion(r.atr, E.df));
          if (i < 0) break;
          const r = rels[i], [X, Y] = violacion(r.atr, E.df);
          const R1 = [...X, ...Y].sort((a, b) => E.atr.indexOf(a) - E.atr.indexOf(b));
          const R2 = r.atr.filter((a) => !Y.includes(a));
          r.hecha = true; r.viola = `${X.join(' ')} → ${Y.join(' ')}`;
          const h1 = { atr: R1, nivel: r.nivel + 1, nombre: `R${++n}` }, h2 = { atr: R2, nivel: r.nivel + 1, nombre: `R${++n}` };
          rels.splice(i + 1, 0, h1, h2);
          ultima = new Set([h1, h2]);
          mensaje = `${r.nombre}(${r.atr.join(', ')}) viola BCNF con ${r.viola}: {${X.join(', ')}} no es superclave de ${r.nombre}. Se divide en ${h1.nombre} = X ∪ Y y ${h2.nombre} = ${r.nombre} − Y.`;
          yield;
        }
        ultima = null;
        mensaje = 'Todas las hojas están en BCNF. La descomposición es sin pérdida en cada paso, porque la intersección X es clave de R₁.';
      })();
    }
    function preservadas() {
      const E = ESQUEMAS[clave];
      const hojas = rels.filter((r) => !r.hecha).map((r) => r.atr);
      // X → Y se preserva si al cerrar X usando solo proyecciones sobre las hojas se obtiene Y.
      return E.df.filter(([x, y]) => {
        const Z = new Set(x);
        let cambio = true;
        while (cambio) {
          cambio = false;
          for (const h of hojas) {
            const t = [...clausura([...Z].filter((a) => h.includes(a)), E.df)].filter((a) => h.includes(a) && !Z.has(a));
            if (t.length) { t.forEach((a) => Z.add(a)); cambio = true; }
          }
        }
        return y.every((a) => Z.has(a));
      });
    }
    function dibujar() {
      const E = ESQUEMAS[clave];
      lista.replaceChildren(...rels.map((r) => {
        const hoja = !r.hecha;
        const fn = formaNormal(r.atr, E.df);
        return el('div', { class: ultima && ultima.has(r) ? 'activa' : null },
          '\u00a0\u00a0'.repeat(r.nivel * 2) + (r.nivel ? '└ ' : '') + `${r.nombre}(${r.atr.join(', ')})  `,
          el('span', { style: { color: r.viola ? C.s8 : fn === 'BCNF' ? C.s6 : C.tinta2 } },
            r.viola ? `viola: ${r.viola}` : hoja && fn === 'BCNF' ? 'BCNF' : fn));
      }));
      registro.textContent = mensaje;
      const hojas = rels.filter((r) => !r.hecha);
      const pres = preservadas();
      lectura.set([
        ['relaciones', String(hojas.length)],
        ['forma normal inicial', formaNormal(E.atr, E.df)],
        ['dependencias preservadas', `${pres.length} de ${E.df.length}`],
        ['sin pérdida', 'sí'],
      ]);
    }
    rep.reiniciar();
  }

  VIZ.registrarTema('formas-normales', {
    intro: String.raw`
      <p>Un mal esquema guarda el mismo hecho muchas veces. Si la tabla de inscripciones repite el nombre del alumno en cada fila, cambiar ese
      nombre exige tocar muchas filas (<em>anomalía de actualización</em>), un alumno sin cursos no tiene dónde guardarse (<em>de
      inserción</em>) y borrar su último curso borra al alumno (<em>de eliminación</em>).</p>
      <p>Las <strong>dependencias funcionales</strong> formalizan «el rol determina el nombre», y las <strong>formas normales</strong> son
      condiciones sobre ellas que garantizan que no haya redundancia. Normalizar es descomponer la tabla en otras más pequeñas sin perder
      información.</p>`,
    visualizaciones: [
      {
        titulo: 'Clausura de un conjunto de atributos',
        descripcion: 'El algoritmo que calcula X⁺, todo lo que X determina. Pruebe en el esquema abstracto con X = {B, C} o {C, E}, y compare con las claves candidatas.',
        montar: montarClausura,
      },
      {
        titulo: 'Descomposición en BCNF',
        descripcion: 'Mientras alguna relación tenga una dependencia X → Y con X no superclave, se divide en dos. Observe qué dependencias sobreviven a la descomposición.',
        montar: montarBCNF,
      },
    ],
    teoria: String.raw`
      <h2>Dependencias funcionales</h2>
      <p>En \(R\), la dependencia \(X \to Y\) se cumple si dos tuplas que coinciden en \(X\) coinciden en \(Y\):</p>
      \[ \forall\, t_1, t_2 \in r:\; t_1[X] = t_2[X] \;\Rightarrow\; t_1[Y] = t_2[Y]. \]
      <p>Los <strong>axiomas de Armstrong</strong> derivan todas las dependencias implicadas por un conjunto \(F\), y son correctos y
      completos:</p>
      <ul>
        <li>Reflexividad: si \(Y \subseteq X\), entonces \(X \to Y\).</li>
        <li>Aumentación: si \(X \to Y\), entonces \(XZ \to YZ\).</li>
        <li>Transitividad: si \(X \to Y\) e \(Y \to Z\), entonces \(X \to Z\).</li>
      </ul>
      <h3>Clausura</h3>
      <pre><code>clausura(X, F):
    X⁺ ← X
    repetir:
        para cada (A → B) en F:
            si A ⊆ X⁺:  X⁺ ← X⁺ ∪ B
    hasta que X⁺ no cambie
    devolver X⁺</code></pre>
      <p>\(X \to Y\) se deduce de \(F\) si y solo si \(Y \subseteq X^+\), y \(X\) es superclave si y solo si \(X^+ = R\). El algoritmo hace
      a lo más \(|R|\) vueltas, cada una de costo \(O(|F|\cdot|R|)\).</p>

      <h2>Formas normales</h2>
      <table>
        <tr><th>Forma</th><th>Condición para toda \(X \to A\) no trivial</th></tr>
        <tr><td>1NF</td><td>valores atómicos (sin listas en una celda)</td></tr>
        <tr><td>2NF</td><td>ningún atributo no primo depende de una parte propia de una clave</td></tr>
        <tr><td>3NF</td><td>\(X\) es superclave, o \(A\) es primo (pertenece a alguna clave)</td></tr>
        <tr><td>BCNF</td><td>\(X\) es superclave</td></tr>
      </table>
      <p>Cada una implica la anterior: BCNF ⊂ 3NF ⊂ 2NF ⊂ 1NF.</p>

      <h2>Descomposición</h2>
      <pre><code>BCNF(R, F):
    si existe X → Y en F⁺ con X ⊂ R, X no superclave de R:
        R₁ ← X ∪ Y;  R₂ ← R − (Y − X)
        devolver BCNF(R₁) ∪ BCNF(R₂)
    devolver {R}</code></pre>
      <div class="recuadro"><strong>Sin pérdida.</strong> La descomposición de \(R\) en \(R_1, R_2\) es sin pérdida (la junta natural
      reconstruye \(R\) exactamente) si y solo si \(R_1 \cap R_2 \to R_1\) o \(R_1 \cap R_2 \to R_2\). En cada paso, \(R_1 \cap R_2 = X\) y
      \(X \to R_1\), así que el algoritmo nunca pierde información.</div>
      <p>Lo que sí puede perder es la <strong>preservación de dependencias</strong>: en Dirección(calle, ciudad, cp), BCNF separa
      (cp, ciudad) de (calle, cp) y la dependencia calle ciudad → cp ya no se puede verificar dentro de una sola tabla. La 3NF, en cambio,
      siempre admite una descomposición sin pérdida <em>y</em> que preserva dependencias (algoritmo de síntesis con un recubrimiento
      mínimo). Por eso en la práctica se acepta 3NF cuando BCNF rompe una dependencia importante.</p>

      <h2>Conexiones</h2>
      <p>Las claves que resultan son las del <a href="tema.html?id=modelo-relacional">modelo relacional</a>; un buen
      <a href="tema.html?id=diagrama-er">diagrama E/R</a> suele producir tablas ya en BCNF. Desnormalizar a propósito (por rendimiento) es
      común en <a href="tema.html?id=nosql">bases NoSQL</a> y en vistas materializadas.</p>`,
  });
})();
