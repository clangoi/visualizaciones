(function () {
  'use strict';
  const { color: C } = VIZ;
  const G = VIZ.gram;
  const PRESETS = [
    { nombre: 'Un ciclo improductivo y una variable inalcanzable', txt: 'S -> aS | A | C; A -> a; B -> aa; C -> aCb' },
    { nombre: 'S → AB | a (B improductiva)', txt: 'S -> AB | a; A -> a' },
    { nombre: 'Cadena de variables', txt: 'S -> aSb | ab | X; X -> Y; Y -> X; Z -> bZ | b' },
    { nombre: 'Ya está simplificada', txt: 'S -> aSb | ab' },
  ];
  const leer = (txt) => G.parsear(txt.replace(/;/g, '\n'));
  const filtrarProductivas = (g) => { const P = G.productivas(g).final; return { ini: g.ini, reglas: g.reglas.filter((r) => P.has(r.izq) && r.der.every((s) => !G.esVar(s) || P.has(s))) }; };
  const filtrarAlcanzables = (g) => { const R = G.alcanzables(g).final; return { ini: g.ini, reglas: g.reglas.filter((r) => R.has(r.izq)) }; };

  /* ---------- Fig. 1: productivas y alcanzables ronda a ronda ---------- */

  function montarAlgoritmo(cuerpo) {
    let txt = PRESETS[0].txt, g = null, error = null, fase = '', ronda = 0, conj = new Set(), g1 = null, g2 = null, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: PRESETS.map((p, i) => [i, p.nombre]), valor: 0, alCambiar: (v) => { txt = PRESETS[+v].txt; campo.valor = txt; rep.reiniciar(); } });
    const campo = ctl.texto({ etiqueta: 'O escriba la suya (reglas separadas por ;)', valor: txt, alCambiar: (v) => { txt = v; rep.reiniciar(); }, alEnter: (v) => { txt = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const chips = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(chips);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.28), borde: C.s6, texto: 'productiva / alcanzable (ya demostrado)' },
      { color: C.neutro, borde: C.inactivo, texto: 'aún no se sabe' },
      { color: VIZ.alfa(C.s8, 0.28), borde: C.s8, texto: 'inútil: se elimina' },
    ]);
    VIZ.subtitulo(cuerpo, 'Gramática en este paso');
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Primero se calculan las variables <em>productivas</em> (las que derivan alguna cadena de terminales) y se eliminan las demás junto con sus reglas. Luego, sobre lo que queda, se calculan las <em>alcanzables</em> desde el símbolo inicial. El orden importa (ver la figura siguiente).');

    function iniciar() {
      const r = leer(txt);
      error = r.error || null; g = r.g || null; fase = ''; ronda = 0; conj = new Set(); g1 = null; g2 = null; msg = '';
      if (!g) return (function* () {})();
      const prod = G.productivas(g);
      g1 = filtrarProductivas(g); const alc = G.alcanzables(g1); g2 = filtrarAlcanzables(g1);
      return (function* () {
        fase = 'inicio'; msg = 'Se parte con todas las variables sin clasificar.'; yield;
        fase = 'prod'; conj = new Set();
        msg = 'Productivas, ronda 0: una variable es productiva si tiene una regla cuyo lado derecho solo tiene terminales o variables ya productivas.'; yield;
        for (let i = 0; i < prod.rondas.length; i++) { ronda = i + 1; prod.rondas[i].forEach((v) => conj.add(v)); msg = `Productivas, ronda ${ronda}: se agregan ${prod.rondas[i].join(', ')}.`; yield; }
        fase = 'quitarP'; msg = G.variables(g).some((v) => !prod.final.has(v)) ? `Improductivas: ${G.variables(g).filter((v) => !prod.final.has(v)).join(', ')}. Se eliminan junto con toda regla que las mencione.` : 'No hay variables improductivas.'; yield;
        fase = 'alc'; conj = new Set([g1.ini]); msg = 'Alcanzables, ronda 0: el símbolo inicial.'; yield;
        for (let i = 1; i < alc.rondas.length; i++) { ronda = i; alc.rondas[i].forEach((v) => conj.add(v)); msg = `Alcanzables, ronda ${i}: se agregan ${alc.rondas[i].join(', ')}.`; yield; }
        fase = 'fin'; const quitadas = G.variables(g1).filter((v) => !alc.final.has(v)); msg = quitadas.length ? `Inalcanzables: ${quitadas.join(', ')}. Se eliminan. Resultado: una gramática sin símbolos inútiles que genera el mismo lenguaje.` : 'No hay variables inalcanzables. La gramática ya no tiene símbolos inútiles.'; yield;
      })();
    }
    function dibujar() {
      if (error) { chips.replaceChildren(); lista.replaceChildren(); registro.textContent = error; lectura.set([['estado', 'error']]); return; }
      const vars = G.variables(g), prod = G.productivas(g).final, enG2 = new Set(G.variables(g2));
      const estado = (v) => {
        if (fase === 'inicio' || fase === '') return 0;
        if (fase === 'prod') return conj.has(v) ? 1 : 0;
        if (fase === 'quitarP') return prod.has(v) ? 1 : 2;
        if (fase === 'alc') return !prod.has(v) ? 2 : conj.has(v) ? 1 : 0;
        return enG2.has(v) ? 1 : 2;
      };
      chips.replaceChildren(...vars.map((v) => { const e = estado(v), c = e === 1 ? C.s6 : e === 2 ? C.s8 : C.inactivo; return VIZ.ficha(v, { color: c, fondo: e ? VIZ.alfa(c, 0.2) : null, redonda: true }); }));
      const actual = fase === 'inicio' || fase === 'prod' ? g : fase === 'quitarP' || fase === 'alc' ? g1 : g2;
      lista.replaceChildren(...G.aTexto(actual).split('\n').map((l) => VIZ.el('div', null, l)));
      registro.textContent = msg;
      lectura.set([['variables', String(vars.length)], ['reglas', `${actual.reglas.length} (antes ${g.reglas.length})`], ['improductivas', String(vars.filter((v) => !prod.has(v)).length)], ['inalcanzables (tras quitar improductivas)', String(G.variables(g1).filter((v) => !G.alcanzables(g1).final.has(v)).length)], ['variables finales', String(enG2.size)]]);
    }
    rep.reiniciar();
  }

  /* ---------- Fig. 2: el orden de las dos eliminaciones ---------- */

  function montarOrden(cuerpo) {
    let txt = PRESETS[1].txt;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Gramática', opciones: PRESETS.map((p, i) => [i, p.nombre]), valor: 1, alCambiar: (v) => { txt = PRESETS[+v].txt; campo.valor = txt; dibujar(); } });
    const campo = ctl.texto({ etiqueta: 'O escriba la suya (reglas separadas por ;)', valor: txt, alCambiar: (v) => { txt = v; dibujar(); }, alEnter: (v) => { txt = v; dibujar(); } });
    const caja = VIZ.el('div', { class: 'dos-columnas' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'dos listas de texto; los símbolos inútiles que quedan se marcan en rojo';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Eliminar primero lo improductivo y después lo inalcanzable deja siempre una gramática limpia. En el orden inverso pueden quedar variables inútiles: al quitar una variable improductiva, otras dejan de ser alcanzables, pero ya no se revisan.');
    const panel = (titulo, grm, buenos) => {
      const inutiles = new Set(G.variables(grm).filter((v) => !G.variables(G.depurar(grm).g2).includes(v)));
      return VIZ.el('div', null, VIZ.el('p', { class: 'subtitulo-viz' }, titulo),
        VIZ.el('div', { class: 'lista-mono' }, ...G.aTexto(grm).split('\n').filter(Boolean).map((l) => VIZ.el('div', { style: { color: [...inutiles].some((v) => l.startsWith(v + ' ')) ? C.s8 : null } }, l))),
        VIZ.el('p', { class: 'nota-viz' }, inutiles.size ? `Quedan símbolos inútiles: ${[...inutiles].join(', ')}.` : 'Sin símbolos inútiles.'), buenos);
    };
    function dibujar() {
      const r = leer(txt);
      caja.replaceChildren();
      if (r.error) { registro.textContent = r.error; lectura.set([['estado', 'error']]); return; }
      const g = r.g, A = filtrarAlcanzables(filtrarProductivas(g)), B = filtrarProductivas(filtrarAlcanzables(g));
      caja.append(panel('1.º improductivas, 2.º inalcanzables', A, null), panel('1.º inalcanzables, 2.º improductivas', B, null));
      const limpio = (grm) => G.variables(grm).length === G.variables(G.depurar(grm).g2).length;
      registro.textContent = limpio(A) && !limpio(B) ? 'El orden «inalcanzables primero» deja símbolos inútiles; el orden correcto no.' : limpio(A) && limpio(B) ? 'Con esta gramática ambos órdenes dan el mismo resultado; pruebe «S → AB | a».' : 'Hay símbolos inútiles en ambos resultados.';
      lectura.set([['variables originales', String(G.variables(g).length)], ['variables en el orden correcto', String(G.variables(A).length)], ['variables en el orden inverso', String(G.variables(B).length)]]);
    }
    dibujar();
  }

  VIZ.registrarTema('grammar-simplification', {
    intro: String.raw`
      <p>Una gramática puede tener <strong>símbolos inútiles</strong>: variables que nunca aparecen en la derivación de una palabra. Unas son <em>improductivas</em> (no pueden terminar nunca, como \(C \to aCb\) sin otra regla) y otras <em>inalcanzables</em> (no se pueden obtener desde el símbolo inicial). Sacarlas no cambia el lenguaje y hace la gramática más pequeña y fácil de analizar.</p>
      <p>Se detectan con dos cálculos de «punto fijo» muy parecidos a una búsqueda en un grafo, y deben aplicarse en el orden correcto.</p>`,
    visualizaciones: [
      {
        titulo: 'Productivas y alcanzables, ronda a ronda',
        descripcion: 'Avance paso a paso: en cada ronda se agregan las variables que ya se pueden demostrar productivas (o alcanzables). Cambie la gramática y observe qué se elimina.',
        montar: montarAlgoritmo,
      },
      {
        titulo: 'El orden importa',
        descripcion: 'Compare los dos órdenes posibles de eliminación. Con S → AB | a, empezar por lo inalcanzable deja una variable inútil (A).',
        montar: montarOrden,
      },
    ],
    teoria: String.raw`
      <h2>Variables útiles</h2>
      <p>Una variable \(A\) es <strong>útil</strong> si existe una derivación \(S \Rightarrow^* \alpha A \beta \Rightarrow^* w\) con \(w \in \Sigma^*\). Es <strong>productiva</strong> (o generadora) si \(A \Rightarrow^* w\) para alguna \(w \in \Sigma^*\), y <strong>alcanzable</strong> si \(S \Rightarrow^* \alpha A \beta\). Una variable útil es productiva y alcanzable; el recíproco falla si se calcula en el orden equivocado.</p>
      <h2>Variables productivas</h2>
      <pre><code>P ← ∅
repetir:
    para cada regla A → X₁…Xₖ:
        si todo Xᵢ es terminal o está en P:  agregar A a P
hasta que P no cambie</code></pre>
      <p>Es el menor conjunto tal que \(A \in P\) si algún lado derecho de \(A\) consta solo de terminales y elementos de \(P\). Corrección: por inducción sobre la altura de un árbol de derivación mínimo.</p>
      <h2>Variables alcanzables</h2>
      <pre><code>R ← { S }
repetir:
    para cada regla A → α con A ∈ R:  agregar a R las variables de α
hasta que R no cambie</code></pre>
      <h2>Orden</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Si se eliminan primero las variables no productivas (con todas las reglas que las usen) y luego las no alcanzables, la gramática resultante no tiene símbolos inútiles y genera el mismo lenguaje (si \(L(G) \ne \varnothing\)).</p></div>
      <p>El orden inverso falla: en \(S \to AB \mid a,\ A \to a\), todas las variables son alcanzables, pero \(B\) es improductiva. Al quitar \(B\) (y la regla \(S \to AB\)), \(A\) deja de ser alcanzable y queda como símbolo inútil. Cada cálculo se hace en tiempo lineal en el tamaño de la gramática.</p>
      <h2>Otras simplificaciones</h2>
      <ul>
        <li>Eliminar producciones \(A \to \varepsilon\) y producciones unitarias \(A \to B\): ver <a href="tema.html?id=chomsky-normal-form">Chomsky Normal Form &amp; CYK</a>.</li>
        <li>Eliminar la recursión por la izquierda y factorizar por la izquierda, para el análisis descendente.</li>
        <li>Ninguna de ellas elimina la <a href="tema.html?id=grammar-ambiguity">ambigüedad</a>.</li>
      </ul>
      <p>Si el símbolo inicial es improductivo, \(L(G) = \varnothing\): así se decide la <em>vacuidad</em> de un lenguaje libre de contexto.</p>`,
  });
})();
