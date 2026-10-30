(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.disc;

  /* ---------- Fig. 1: generaciones de un conjunto ---------- */

  // Cadenas de paréntesis balanceados: base ε; reglas w ↦ (w) y u, v ↦ uv.
  function dyck(maxLen, gens) {
    const gen = new Map([['', 0]]);
    for (let g = 1; g <= gens; g++) {
      const prev = [...gen].filter(([, k]) => k < g).map(([s]) => s);
      const nuevo = new Set();
      for (const w of prev) nuevo.add('(' + w + ')');
      for (const u of prev) for (const v of prev) nuevo.add(u + v);
      for (const s of nuevo) if (s.length <= maxLen && !gen.has(s)) gen.set(s, g);
    }
    return gen;
  }
  function multiplos(gens, tope) {
    const gen = new Map([[3, 0]]);
    for (let g = 1; g <= gens; g++) {
      const prev = [...gen].filter(([, k]) => k < g).map(([s]) => s);
      for (const x of prev) for (const y of prev) if (x + y < tope && !gen.has(x + y)) gen.set(x + y, g);
    }
    return gen;
  }

  function montarGeneraciones(cuerpo) {
    let tipo = 'num', t = 3, geo = null, gen = new Map();
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conjunto', opciones: [['num', 'M: 3 ∈ M; x, y ∈ M ⇒ x + y ∈ M'], ['par', 'B: ε ∈ B; w ∈ B ⇒ (w) ∈ B; u, v ∈ B ⇒ uv ∈ B']], valor: tipo, alCambiar: (v) => { tipo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Generaciones aplicadas', min: 0, max: 5, valor: t, alCambiar: (v) => { t = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 4 * Math.min(40, (w - 20) / 10) + 8 });
    const tip = VIZ.tooltip(lienzo);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'elemento de una generación anterior', forma: 'cuadro' },
      { color: C.s2, texto: 'elemento nuevo de esta generación', forma: 'cuadro' },
      { color: C.neutro, texto: 'todavía no está en el conjunto', forma: 'cuadro' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada generación aplica todas las reglas a lo que ya hay. El conjunto definido es la unión de todas las generaciones. Pase el cursor sobre un número para ver cuándo aparece.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      fichas.hidden = tipo === 'num';
      lienzo.envoltura.hidden = tipo !== 'num';
      if (tipo === 'num') {
        gen = multiplos(t, 40);
        lienzo.limpiar();
        const cw = Math.min(40, (W - 20) / 10), x0 = (W - 10 * cw) / 2;
        geo = { cw, x0 };
        for (let f = 0; f < 4; f++) D.tira(ctx, x0, f * cw + 4, 10 * cw, 10, (i) => {
          const n = f * 10 + i, g = gen.get(n);
          return g === undefined ? { fondo: C.neutro, texto: n, tinta: C.apagado } : { fondo: g === t && t > 0 ? C.s2 : C.tinta, texto: n, tinta: C.sobre };
        }, cw - 2);
        lectura.set([['elementos < 40', String(gen.size)], ['generación', String(t)], ['son todos múltiplos de 3', 'sí (invariante)']]);
      } else {
        gen = dyck(8, t);
        const lista = [...gen].sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]));
        fichas.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'cadenas de longitud ≤ 8:'), ...lista.map(([s, g]) => VIZ.ficha(s || 'ε', { color: g === t && t > 0 ? C.s2 : C.tinta, fondo: g === t && t > 0 ? VIZ.alfa(C.s2, 0.15) : null })));
        const porLong = [0, 2, 4, 6, 8].map((L) => lista.filter(([s]) => s.length === L).length);
        lectura.set([['cadenas', String(gen.size)], ['por longitud 0, 2, 4, 6, 8', porLong.join(', ')], ['total posible (Catalan)', '1, 1, 2, 5, 14']]);
      }
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (tipo !== 'num') return;
      const { x, y } = lienzo.posicion(ev);
      const c = Math.floor((x - geo.x0) / geo.cw), f = Math.floor((y - 4) / geo.cw), n = f * 10 + c;
      if (c < 0 || c > 9 || f < 0 || f > 3) return tip.ocultar();
      const g = gen.get(n);
      tip.mostrar(x, y, `<b>${n}</b>: ${g === undefined ? 'no está (aún)' : g === 0 ? 'caso base' : `aparece en la generación ${g}`}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    cuerpo.dataset.sinLeyenda = 'figura con dos vistas; la leyenda aplica a ambas';
    dibujar();
  }

  /* ---------- Fig. 2: ¿está en el conjunto? ---------- */

  const LENG = {
    mult: { nombre: 'M: múltiplos positivos de 3', ej: '21' },
    par: { nombre: 'B: paréntesis balanceados', ej: '(()())()' },
    uno: { nombre: 'L: 0ⁿ1ⁿ (con n ≥ 0)', ej: '000111' },
  };

  function derivar(clave, s) {
    const lineas = [];
    if (clave === 'mult') {
      if (!/^\d+$/.test(s)) return { ok: false, lineas: ['Escriba un número natural.'] };
      const m = +s;
      if (m > 0 && m % 3 === 0) {
        lineas.push('3 ∈ M   (caso base)');
        for (let k = 2; k <= m / 3 && k <= 8; k++) lineas.push(`${3 * k} = ${3 * (k - 1)} + 3 ∈ M   (regla de la suma)`);
        if (m / 3 > 8) lineas.push(`…  (${m / 3 - 8} pasos más)`, `${m} ∈ M`);
        return { ok: true, lineas };
      }
      return { ok: false, lineas: [`${m} no es un múltiplo positivo de 3.`, 'Invariante (por inducción estructural): todo elemento de M es múltiplo de 3. Lo cumple el caso base y las sumas lo conservan.'] };
    }
    if (clave === 'par') {
      let nivel = 0;
      for (let i = 0; i < s.length; i++) {
        if (s[i] !== '(' && s[i] !== ')') return { ok: false, lineas: [`El símbolo «${s[i]}» no es un paréntesis.`] };
        nivel += s[i] === '(' ? 1 : -1;
        if (nivel < 0) return { ok: false, lineas: [`En la posición ${i + 1} hay más «)» que «(» hasta ahí: ningún prefijo de un elemento de B puede tener más cierres.`] };
      }
      if (nivel) return { ok: false, lineas: [`Sobran ${nivel} paréntesis abiertos: en todo elemento de B hay tantos «(» como «)».`] };
      const der = (w) => {
        if (w === '') { lineas.push('ε ∈ B   (caso base)'); return; }
        let nv = 0, i = 0;
        do { nv += w[i] === '(' ? 1 : -1; i++; } while (nv > 0);
        const u = w.slice(1, i - 1), v = w.slice(i);
        der(u); lineas.push(`(${u || 'ε'}) ∈ B   (regla w ↦ (w))`);
        if (v) { der(v); lineas.push(`${w} = (${u || 'ε'})·${v} ∈ B   (regla uv)`); }
      };
      der(s);
      return { ok: true, lineas: lineas.slice(0, 18).concat(lineas.length > 18 ? ['…'] : []) };
    }
    const n = s.length / 2;
    if (/^(0*)(1*)$/.test(s) && s.split('0').length - 1 === n && s.split('1').length - 1 === n && s === '0'.repeat(n) + '1'.repeat(n)) {
      lineas.push('ε ∈ L   (caso base)');
      for (let k = 1; k <= n; k++) lineas.push(`${'0'.repeat(k)}${'1'.repeat(k)} = 0·(${k > 1 ? '0'.repeat(k - 1) + '1'.repeat(k - 1) : 'ε'})·1 ∈ L   (regla w ↦ 0w1)`);
      return { ok: true, lineas };
    }
    return { ok: false, lineas: ['La cadena no tiene la forma 0…01…1 con la misma cantidad de ceros y unos.', 'Invariante: en todo elemento de L, los ceros preceden a los unos y hay igual cantidad de cada uno.'] };
  }

  function montarDerivacion(cuerpo) {
    let clave = 'par';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Conjunto', opciones: Object.entries(LENG).map(([k, v]) => [k, v.nombre]), valor: clave, alCambiar: (v) => { clave = v; campo.valor = LENG[v].ej; evaluar(); } });
    const campo = ctl.texto({ etiqueta: 'Elemento a probar', valor: LENG[clave].ej, alCambiar: () => evaluar(), alEnter: () => evaluar() });
    ctl.boton('Derivar', () => evaluar(), { primario: true });
    const registro = VIZ.registro(cuerpo, { grande: true });
    const lectura = VIZ.lectura(cuerpo);
    cuerpo.dataset.sinLeyenda = 'figura de texto: sin lienzo';
    VIZ.nota(cuerpo, 'Una derivación es una lista de pasos, cada uno justificado por el caso base o por una regla aplicada a pasos anteriores. Si el elemento no está, falla un invariante.');

    function evaluar() {
      const s = campo.valor.trim().replace(/ε/g, '');
      const r = derivar(clave, s);
      registro.textContent = r.lineas.join('\n');
      lectura.set([['elemento', s || 'ε'], ['¿pertenece?', r.ok ? 'sí' : 'no'], ['pasos de la derivación', r.ok ? String(r.lineas.length) : '—']]);
    }
    evaluar();
  }

  VIZ.registrarTema('inductive-sets', {
    intro: String.raw`
      <p>Muchos conjuntos importantes no se describen listando sus elementos sino con <strong>reglas</strong>: unos elementos iniciales y maneras de fabricar elementos nuevos a partir de los que ya existen.
      Las expresiones aritméticas, las fórmulas lógicas, los programas bien escritos y las cadenas de paréntesis balanceados se definen así.</p>
      <p>Lo bueno de una definición inductiva es que viene con su propio método de demostración: si algo vale para los elementos base y se conserva con cada regla, vale para todo el conjunto.</p>`,
    visualizaciones: [
      {
        titulo: 'Generaciones de un conjunto',
        descripcion: 'Aplique las reglas generación por generación. Con la suma de múltiplos de 3 aparecen más números cada vez; con los paréntesis, las cadenas balanceadas de cada longitud.',
        montar: montarGeneraciones,
      },
      {
        titulo: 'Derivación y pertenencia',
        descripcion: 'Escriba un elemento y obtenga su derivación. Pruebe uno que no esté en el conjunto y vea qué invariante viola.',
        montar: montarDerivacion,
      },
    ],
    teoria: String.raw`
      <h2>Definición inductiva</h2>
      <p>Un conjunto \(S\) definido inductivamente consta de:</p>
      <ol>
        <li><strong>Base:</strong> ciertos elementos pertenecen a \(S\).</li>
        <li><strong>Reglas:</strong> si \(x_1, \dots, x_k \in S\) entonces \(f(x_1, \dots, x_k) \in S\).</li>
        <li><strong>Cláusula de clausura:</strong> nada más pertenece a \(S\).</li>
      </ol>
      <p>Formalmente, \(S\) es el <em>menor</em> conjunto que contiene a la base y es cerrado bajo las reglas, o equivalentemente
      \(S = \bigcup_{g \ge 0} S_g\), con \(S_0\) la base y \(S_{g+1} = S_g \cup \{f(\bar x) : \bar x \in S_g\}\).</p>
      <h2>Demostrar propiedades de S</h2>
      <div class="recuadro"><strong>Principio de inducción sobre S.</strong> Si \(P\) vale para la base y, siempre que valga para \(x_1,\dots,x_k\), vale para \(f(x_1,\dots,x_k)\), entonces \(P\) vale para todo elemento de \(S\).</div>
      <p>Por ejemplo, en \(M = \{3\} \cup \{x+y : x,y \in M\}\), la propiedad «\(3 \mid x\)» vale para el 3 y se conserva por sumas; luego todo elemento de \(M\) es múltiplo de 3 (y se puede ver que son todos).
      En las cadenas balanceadas, «tiene tantos paréntesis abiertos como cerrados» se conserva con \(w \mapsto (w)\) y con la concatenación.</p>
      <h2>Unicidad de la derivación</h2>
      <p>En algunos conjuntos cada elemento tiene una sola forma de derivarse (se dice que la definición es <em>no ambigua</em>) y entonces se pueden definir funciones recursivas sobre \(S\). En \(M\) hay muchas derivaciones de \(12\) (\(3+9\), \(6+6\), …);
      eso es un problema para definir funciones sobre \(M\) por la última regla, pero no para probar propiedades.
      La generalización a árboles y fórmulas está en <a href="tema.html?id=structural-definitions">Structural Definitions</a>.</p>`,
  });
})();
