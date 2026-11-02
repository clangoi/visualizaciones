(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Redes de ejemplo ---------- */

  // plazas: ids (además de 'i' y 'f'); trans: [id, nombre, entradas, salidas].
  function red(nombre, plazas, trans, ejemplo, nota) {
    const ids = ['i', ...plazas, 'f'];
    const arcos = [];
    trans.forEach(([id, , e, s]) => { e.forEach((p) => arcos.push([p, id])); s.forEach((p) => arcos.push([id, p])); });
    return { nombre, ejemplo, nota, plazas: ids.map((id) => ({ id, nombre: id })), trans: trans.map(([id, n]) => ({ id, nombre: n })), arcos, ini: 'i', fin: 'f' };
  }
  const BASICAS = {
    sec: red('Secuencia', ['p1', 'p2'], [['ta', 'a', ['i'], ['p1']], ['tb', 'b', ['p1'], ['p2']], ['tc', 'c', ['p2'], ['f']]], 'abc',
      'Cada transición consume la ficha de su plaza de entrada y la deposita en la siguiente: un solo orden posible.'),
    elec: red('Elección (XOR)', ['p1', 'p2'], [['ta', 'a', ['i'], ['p1']], ['tb', 'b', ['p1'], ['p2']], ['tc', 'c', ['p1'], ['p2']], ['td', 'd', ['p2'], ['f']]], 'acd',
      'La plaza p1 tiene una sola ficha y dos transiciones de salida: al disparar una, la otra deja de estar habilitada.'),
    and: red('Concurrencia (AND)', ['p1', 'p2', 'p3', 'p4'], [['ta', 'a', ['i'], ['p1', 'p2']], ['tb', 'b', ['p1'], ['p3']], ['tc', 'c', ['p2'], ['p4']], ['td', 'd', ['p3', 'p4'], ['f']]], 'acbd',
      'a produce dos fichas: b y c quedan habilitadas a la vez y pueden dispararse en cualquier orden; d espera a ambas.'),
    ciclo: red('Ciclo', ['p1', 'p2'], [['ta', 'a', ['i'], ['p1']], ['tb', 'b', ['p1'], ['p2']], ['tc', 'c', ['p2'], ['p1']], ['td', 'd', ['p2'], ['f']]], 'abcbd',
      'En p2 se elige entre repetir (c vuelve a p1) o terminar (d): el lenguaje es infinito.'),
  };
  const FALLAS = {
    deadlock: red('Bloqueo (XOR con AND)', ['p1', 'p2', 'p3'], [['ta', 'a', ['i'], ['p1']], ['tb', 'b', ['p1'], ['p2']], ['tc', 'c', ['p1'], ['p3']], ['td', 'd', ['p2', 'p3'], ['f']]], 'abd',
      'La elección b o c deja una sola ficha, pero d necesita fichas en p2 y en p3: la red se bloquea.'),
    noacotada: red('No acotada', ['p1', 'p2', 'p3', 'p4'], [['ta', 'a', ['i'], ['p1', 'p2']], ['tg', 'g', ['p2'], ['p2', 'p3']], ['tb', 'b', ['p1'], ['p4']], ['te', 'e', ['p4'], ['f']]], 'abe',
      'g se puede disparar sin fin y cada disparo deja una ficha nueva en p3 que nadie consume.'),
    doble: red('Fichas duplicadas', ['p1', 'p2', 'p3'], [['ta', 'a', ['i'], ['p1', 'p2']], ['tb', 'b', ['p1'], ['p3']], ['tc', 'c', ['p2'], ['p3']], ['td', 'd', ['p3'], ['f']]], 'abcdd',
      'a abre dos ramas en paralelo pero p3 las junta como si fueran una elección: d se dispara dos veces y f recibe dos fichas.'),
  };

  /* ---------- Semántica y análisis ---------- */

  const clave = (m) => Object.keys(m).filter((p) => m[p] > 0).sort().map((p) => `${p}:${m[p]}`).join(',');
  const texto = (m) => {
    const t = Object.keys(m).filter((p) => m[p] > 0).sort().map((p) => (m[p] > 1 ? `${p}×${m[p]}` : p));
    return t.length ? t.join(' + ') : '∅';
  };
  const habilitadas = (r, m) => r.trans.filter((t) => P.habilitada(r, m, t.id));
  const esFinal = (r, m) => clave(m) === `${r.fin}:1`;

  // Exploración del grafo de marcados (con tope de fichas por plaza y de estados).
  function analizar(r) {
    const TOPE_FICHAS = 6, TOPE_ESTADOS = 600;
    const ini = P.marcadoInicial(r);
    const vistos = new Map([[clave(ini), ini]]);
    const cola = [ini];
    let bloqueos = 0, maxFichas = 1, noAcotada = false, finLimpio = false, sobrantes = false, truncado = false;
    while (cola.length) {
      const m = cola.shift();
      const hab = habilitadas(r, m);
      Object.values(m).forEach((v) => { maxFichas = Math.max(maxFichas, v); });
      if (esFinal(r, m)) finLimpio = true;
      else if ((m[r.fin] || 0) > 0) sobrantes = true;
      if (!hab.length && !esFinal(r, m) && !((m[r.fin] || 0) > 0)) bloqueos++;
      if (Object.values(m).some((v) => v > TOPE_FICHAS)) { noAcotada = true; continue; }
      for (const t of hab) {
        const n = P.disparar(r, m, t.id), k = clave(n);
        if (!vistos.has(k)) {
          if (vistos.size >= TOPE_ESTADOS) { truncado = true; continue; }
          vistos.set(k, n); cola.push(n);
        }
      }
    }
    return { estados: vistos.size, bloqueos, maxFichas, noAcotada: noAcotada || truncado, finLimpio, sobrantes };
  }

  // Secuencias de disparo que llevan del marcado inicial al marcado final (a lo sumo `largo` disparos).
  function secuenciasCompletas(r, largo) {
    const res = [];
    const rec = (m, s) => {
      if (esFinal(r, m)) { res.push(s); return; }
      if (s.length >= largo) return;
      for (const t of habilitadas(r, m)) rec(P.disparar(r, m, t.id), s + t.nombre);
    };
    rec(P.marcadoInicial(r), '');
    return [...new Set(res)].sort((a, b) => a.length - b.length || a.localeCompare(b));
  }

  /* ---------- Dibujo ---------- */

  const posRed = new WeakMap();
  function orientada(r, ancho) {
    if (!posRed.has(r)) posRed.set(r, P.posDeRed(r));
    const base = posRed.get(r), g = new Map();
    for (const k in base) { const c = base[k].x.toFixed(4); g.set(c, (g.get(c) || 0) + 1); }
    const capas = g.size, carriles = Math.max(1, ...g.values());
    const vertical = capas * 64 + 60 > ancho, pos = {};
    for (const k in base) pos[k] = vertical ? { x: base[k].y, y: base[k].x } : base[k];
    return { pos, alto: vertical ? capas * 52 + 50 : Math.max(220, carriles * 64 + 60) };
  }
  // marcas: { hab: Set de transiciones habilitadas, ult: id disparada, bloq: id bloqueada }.
  function dibujarRed(lienzo, r, m, marcas = {}) {
    const { nodos, aristas } = P.nodosDeRed(r, m, {
      plaza: (p) => ({ borde: p.id === r.ini ? C.s6 : C.tinta, anillo: p.id === r.ini ? C.s6 : null }),
      trans: (t) => ({ anillo: marcas.bloq === t.id ? C.s8 : marcas.ult === t.id ? C.s2 : marcas.hab && marcas.hab.has(t.id) ? C.s4 : null, relleno: marcas.hab && marcas.hab.has(t.id) ? VIZ.alfa(C.s4, 0.18) : C.superficie }),
    });
    lienzo.limpiar();
    return P.dibujarGrafo(lienzo, nodos, aristas, orientada(r, lienzo.ancho).pos, { etiquetasPlazas: true, fuente: 11, margenX: 40, margenY: 34 });
  }

  /* ---------- Juego de fichas (figuras 1 y 3) ---------- */

  function montarJuego(redes, { analisis = false, nota }) {
    return function (cuerpo) {
      let clave0 = Object.keys(redes)[0], r = redes[clave0], m = P.marcadoInicial(r), hist = [], traza = [], ult = null, geo = null, alto = 260, mensaje = '';
      const ctl = VIZ.controles(cuerpo);
      ctl.selector({ etiqueta: 'Red', opciones: Object.entries(redes).map(([k, v]) => [k, v.nombre]), valor: clave0, alCambiar: (v) => { clave0 = v; r = redes[v]; reiniciar(); } });
      ctl.boton('Disparo al azar', () => { const h = habilitadas(r, m); if (!h.length) { mensaje = 'No hay transiciones habilitadas.'; return dibujar(); } disparar(h[Math.floor(Math.random() * h.length)]); }, { primario: true });
      ctl.boton('Deshacer', () => { if (!hist.length) return; ({ m, traza, ult } = hist.pop()); mensaje = 'Se deshizo el último disparo.'; dibujar(); });
      ctl.boton('Reiniciar', () => reiniciar());
      const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
      VIZ.leyenda(cuerpo, [
        { color: C.s4, texto: 'transición habilitada: haga clic', forma: 'cuadro' },
        { color: C.s2, texto: 'último disparo', forma: 'cuadro' },
        { color: C.s6, texto: 'plaza inicial (i); la final es f', forma: 'cuadro' },
        { color: C.tinta, texto: 'ficha (punto, o su número si hay varias)', forma: 'punto' },
      ]);
      const registro = VIZ.registro(cuerpo);
      const lectura = VIZ.lectura(cuerpo);
      VIZ.nota(cuerpo, nota);

      function reiniciar() { m = P.marcadoInicial(r); hist = []; traza = []; ult = null; mensaje = `${r.nota}`; dibujar(); }
      function disparar(t) {
        hist.push({ m, traza, ult });
        const ent = P.entradas(r, t.id), sal = P.salidas(r, t.id);
        m = P.disparar(r, m, t.id); traza = [...traza, t.nombre]; ult = t.id;
        mensaje = `Dispara ${t.nombre}: consume ${ent.join(' y ')} y produce ${sal.join(' y ')}. Marcado ahora: ${texto(m)}.`;
        dibujar();
      }
      function dibujar() {
        const o = orientada(r, lienzo.ancho);
        if (o.alto !== alto) { alto = o.alto; lienzo.ajustar(true); return; }
        const hab = habilitadas(r, m);
        geo = dibujarRed(lienzo, r, m, { hab: new Set(hab.map((t) => t.id)), ult });
        registro.textContent = mensaje;
        const fin = esFinal(r, m);
        const filas = [
          ['marcado', texto(m)],
          ['habilitadas', hab.length ? hab.map((t) => t.nombre).join(', ') : fin ? '— (terminó)' : '— (bloqueo)'],
          ['secuencia disparada', traza.join(' ') || '—'],
        ];
        if (analisis) {
          const a = analizar(r);
          filas.push(['marcados alcanzables', a.noAcotada ? 'infinitos (≥ 600)' : String(a.estados)]);
          filas.push(['propiedades', [a.bloqueos ? `${a.bloqueos} marcado(s) bloqueado(s)` : 'sin bloqueos', a.noAcotada ? 'no acotada' : `acotada (máx. ${a.maxFichas} ficha${a.maxFichas > 1 ? 's' : ''})`, a.sobrantes ? 'fichas sobrantes al terminar' : 'termina limpio'].join(' · ')]);
        } else filas.push(['¿terminó?', fin ? 'sí: una ficha en f' : 'no']);
        lectura.set(filas);
      }
      lienzo.alDibujar = dibujar;
      lienzo.canvas.style.cursor = 'pointer';
      lienzo.canvas.addEventListener('click', (ev) => {
        const { x, y } = lienzo.posicion(ev), g = geo && P.nodoEn(geo, x, y);
        const t = g && r.trans.find((q) => q.id === g.id);
        if (!t) return;
        if (P.habilitada(r, m, t.id)) disparar(t);
        else { mensaje = `${t.nombre} no está habilitada: falta ficha en ${P.entradas(r, t.id).filter((p) => !(m[p] > 0)).join(', ')}.`; dibujar(); }
      });
      reiniciar();
    };
  }

  /* ---------- Fig. 2: reproducir una secuencia ---------- */

  function montarSecuencia(cuerpo) {
    let clave0 = 'and', r = BASICAS[clave0], entrada = r.ejemplo, m = P.marcadoInicial(r), ult = null, bloq = null, mensaje = '', alto = 260, i = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Red', opciones: Object.entries(BASICAS).map(([k, v]) => [k, v.nombre]), valor: clave0, alCambiar: (v) => { clave0 = v; r = BASICAS[v]; entrada = r.ejemplo; cajaTexto.valor = entrada; rep.reiniciar(); } });
    const cajaTexto = ctl.texto({ etiqueta: 'Secuencia de disparos', valor: entrada, alCambiar: (v) => { entrada = v.replace(/\s+/g, ''); rep.reiniciar(); }, alEnter: (v) => { entrada = v.replace(/\s+/g, ''); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    VIZ.leyenda(cuerpo, [
      { color: C.s4, texto: 'transición habilitada', forma: 'cuadro' },
      { color: C.s2, texto: 'último disparo', forma: 'cuadro' },
      { color: C.s8, texto: 'disparo imposible: falta una ficha', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Escriba una secuencia con las letras de las transiciones (por ejemplo abcd) y reprodúzcala paso a paso. Se detiene en el primer disparo imposible. Pruebe órdenes que no están en la lista de secuencias completas, como abd.');

    function iniciar() {
      m = P.marcadoInicial(r); ult = null; bloq = null; i = 0;
      mensaje = `Marcado inicial: ${texto(m)}. Secuencia a reproducir: ${entrada || '(vacía)'}.`;
      return (function* () {
        for (const ch of entrada) {
          const t = r.trans.find((q) => q.nombre === ch);
          if (!t) { mensaje = `«${ch}» no es una transición de esta red.`; bloq = null; yield; return; }
          if (!P.habilitada(r, m, t.id)) {
            bloq = t.id;
            mensaje = `Falla en el disparo ${i + 1}: ${ch} no está habilitada porque falta ficha en ${P.entradas(r, t.id).filter((p) => !(m[p] > 0)).join(', ')}.`;
            yield; return;
          }
          m = P.disparar(r, m, t.id); ult = t.id; i++;
          mensaje = `Dispara ${ch}: marcado ${texto(m)}.`;
          yield;
        }
        mensaje += esFinal(r, m) ? ' Fin de la secuencia: marcado final [f], terminación limpia.' : ' Fin de la secuencia sin llegar al marcado final.';
      })();
    }
    function dibujar() {
      const o = orientada(r, lienzo.ancho);
      if (o.alto !== alto) { alto = o.alto; lienzo.ajustar(true); return; }
      geo = dibujarRed(lienzo, r, m, { hab: new Set(habilitadas(r, m).map((t) => t.id)), ult, bloq });
      registro.textContent = mensaje;
      const todas = secuenciasCompletas(r, 8);
      lista.replaceChildren(VIZ.el('div', null, `Secuencias completas (≤ 8 disparos): ${todas.length}`), ...todas.slice(0, 12).map((s) => VIZ.el('div', { class: s === entrada ? 'activa' : null }, s.split('').join(' → '))), ...(todas.length > 12 ? [VIZ.el('div', null, `… y ${todas.length - 12} más`)] : []));
      lectura.set([
        ['disparos hechos', `${i} de ${entrada.length}`],
        ['marcado', texto(m)],
        ['¿secuencia completa válida?', todas.includes(entrada) ? 'sí' : 'no'],
        ['ficha en f', m[r.fin] > 0 ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('petri-nets', {
    intro: String.raw`
      <p>Una <strong>red de Petri</strong> describe un proceso con dos tipos de nodos: las <em>plazas</em> (círculos), que guardan <em>fichas</em> y representan
      condiciones o estados parciales, y las <em>transiciones</em> (rectángulos), que representan actividades. Las flechas conectan plazas con transiciones y
      al revés. El estado de la red es su <em>marcado</em>: cuántas fichas hay en cada plaza.</p>
      <p>Una transición puede dispararse cuando todas sus plazas de entrada tienen una ficha; al hacerlo consume esas fichas y deposita una en cada plaza de
      salida. Con solo esa regla se expresan secuencia, elección, concurrencia y ciclos, y por eso las redes de Petri son el lenguaje de modelos que más usan
      los algoritmos de descubrimiento y de conformidad.</p>`,
    visualizaciones: [
      {
        titulo: 'Juego de fichas',
        descripcion: 'Dispare transiciones haciendo clic en las que tienen anillo amarillo. En la red de concurrencia, b y c quedan habilitadas a la vez; en la de elección, disparar una apaga la otra.',
        montar: montarJuego(BASICAS, { analisis: false, nota: 'Haga clic en una transición habilitada para dispararla; «Disparo al azar» elige una por usted y «Deshacer» recupera el marcado anterior. Una transición con anillo amarillo es la que puede dispararse ahora.' }),
      },
      {
        titulo: 'Reproducir una secuencia de disparos',
        descripcion: 'Escriba una traza y vea si la red puede reproducirla. En la red de concurrencia, «abcd» y «acbd» funcionan (b y c conmutan) y «abd» falla en d: falta la ficha de p4.',
        montar: montarSecuencia,
      },
      {
        titulo: 'Cuando una red no se comporta bien',
        descripcion: 'Tres redes defectuosas. Juegue hasta ver el bloqueo, las fichas que crecen sin límite o las fichas sobrantes, y compare con el análisis exhaustivo de la lectura.',
        montar: montarJuego(FALLAS, { analisis: true, nota: 'Dispare transiciones con clic hasta provocar el defecto. La lectura explora todos los marcados alcanzables: cuántos son, si alguno queda bloqueado, si el número de fichas está acotado y si se termina sin fichas sobrantes.' }),
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Una red de Petri es una tripla \(N = (P, T, F)\) con plazas \(P\), transiciones \(T\) (\(P \cap T = \emptyset\)) y arcos
      \(F \subseteq (P \times T) \cup (T \times P)\). Para un nodo \(x\), su <em>preconjunto</em> es \({}^{\bullet}x = \{ y \mid (y, x) \in F \}\) y su
      <em>postconjunto</em> es \(x^{\bullet} = \{ y \mid (x, y) \in F \}\). Un <em>marcado</em> es una función \(M : P \to \mathbb{N}\).</p>
      <h2>Regla de disparo</h2>
      <p>La transición \(t\) está <em>habilitada</em> en \(M\) si \(M(p) \ge 1\) para todo \(p \in {}^{\bullet}t\). Al dispararse produce el marcado</p>
      \[ M'(p) = M(p) - [p \in {}^{\bullet}t] + [p \in t^{\bullet}], \qquad \text{y se escribe } M \xrightarrow{t} M'. \]
      <pre><code>habilitada(t, M):  para todo p ∈ •t:  M(p) ≥ 1
disparar(t, M):    para p ∈ •t: M(p) ← M(p) − 1
                   para p ∈ t•: M(p) ← M(p) + 1</code></pre>
      <h2>Patrones de control de flujo</h2>
      <table>
        <tr><th>Patrón</th><th>Estructura</th><th>Comportamiento</th></tr>
        <tr><td>Secuencia</td><td>\(t_1 \to p \to t_2\)</td><td>\(t_2\) solo tras \(t_1\)</td></tr>
        <tr><td>Elección (XOR)</td><td>una plaza con varias transiciones de salida</td><td>una sola dispara: compiten por la misma ficha</td></tr>
        <tr><td>Concurrencia (AND)</td><td>una transición con varias plazas de salida; otra con varias de entrada</td><td>ramas independientes, sincronizadas al final</td></tr>
        <tr><td>Ciclo</td><td>un arco de vuelta a una plaza anterior</td><td>lenguaje infinito</td></tr>
      </table>
      <h2>Lenguaje y propiedades</h2>
      <p>Las secuencias de disparo \(\sigma = \langle t_1, \dots, t_n \rangle\) con \(M_0 \xrightarrow{\sigma} M_f\) forman el <em>lenguaje</em> de la red. Tres
      propiedades básicas se comprueban explorando el grafo de marcados alcanzables:</p>
      <ul>
        <li><strong>Acotamiento</strong>: existe \(k\) tal que ningún marcado alcanzable tiene más de \(k\) fichas en una plaza. Si una transición puede
        producir más fichas de las que consume en un ciclo, la red no es acotada y el grafo es infinito.</li>
        <li><strong>Bloqueo</strong> (<em>deadlock</em>): un marcado alcanzable, distinto del final, sin transiciones habilitadas.</li>
        <li><strong>Terminación limpia</strong>: cuando hay ficha en la plaza final, no queda ninguna otra.</li>
      </ul>
      <div class="recuadro"><p><strong>Elección frente a concurrencia.</strong> La regla es la misma; la diferencia es la estructura. Dos transiciones que
      comparten una plaza de entrada con una sola ficha están en <em>conflicto</em>; si cada una tiene su propia ficha, son <em>concurrentes</em> y sus
      disparos conmutan: \(M \xrightarrow{b\,c} M'\) y \(M \xrightarrow{c\,b} M'\).</p></div>
      <h2>Conexiones</h2>
      <p>Una red con plaza inicial, plaza final y todos sus nodos en caminos de una a otra es una <a href="tema.html?id=workflow-nets">workflow net</a>, y la
      propiedad que queremos que cumpla es la <a href="tema.html?id=soundness">solidez</a>. El <a href="tema.html?id=alpha-algorithm">algoritmo Alfa</a> construye
      redes de Petri desde un registro, y el <a href="tema.html?id=token-based-replay">token-based replay</a> las usa para medir conformidad. Cada
      <a href="tema.html?id=bpmn-gateways">compuerta BPMN</a> y cada operador de un <a href="tema.html?id=process-trees">árbol de procesos</a> tiene una
      traducción directa a una red de Petri.</p>`,
  });
})();
