(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Abstracciones del estado ---------- */

  const ABSTRACCIONES = {
    sec: { nombre: 'Pasado: secuencia', corto: 'pasado (secuencia)' },
    con: { nombre: 'Pasado: conjunto de actividades', corto: 'pasado (conjunto)' },
    vent: { nombre: 'Ventana de las k últimas', corto: 'ventana k' },
    fut: { nombre: 'Futuro: secuencia restante', corto: 'futuro (secuencia)' },
  };
  const cad = (a) => (a.length ? a.join('') : 'ε');

  // Estado de la traza `t` tras haber ejecutado i eventos.
  function estado(abs, t, i, k) {
    if (abs === 'sec') return cad(t.slice(0, i));
    if (abs === 'fut') return cad(t.slice(i));
    if (abs === 'vent') return cad(t.slice(Math.max(0, i - k), i));
    return '{' + [...new Set(t.slice(0, i))].sort().join(',') + '}';
  }

  // Sistema de transición vacío y operación de incorporar un evento.
  function vacio() { return { estados: new Map(), trans: new Map() }; }
  function nodo(ts, id) {
    if (!ts.estados.has(id)) ts.estados.set(id, { id, n: 0, inicial: false, final: false });
    return ts.estados.get(id);
  }
  // Incorpora el evento i de la traza t (n veces); devuelve [estadoOrigen, estadoDestino, esNuevo].
  function incorporar(ts, abs, k, t, i, n) {
    const antes = ts.estados.size, tAntes = ts.trans.size;
    const de = estado(abs, t, i, k), a = estado(abs, t, i + 1, k);
    const s = nodo(ts, de), z = nodo(ts, a);
    if (i === 0) s.inicial = true;
    s.n += n;
    if (i + 1 === t.length) { z.final = true; z.n += n; }
    const clave = de + '\u0001' + t[i] + '\u0001' + a;
    if (!ts.trans.has(clave)) ts.trans.set(clave, { de, a, act: t[i], n: 0 });
    ts.trans.get(clave).n += n;
    return { de, a, nuevoEstado: ts.estados.size > antes, nuevaTrans: ts.trans.size > tAntes, act: t[i] };
  }
  // Un sistema es determinista si, desde cada estado, cada etiqueta lleva a un único estado.
  function determinista(ts) {
    const v = new Map();
    for (const t of ts.trans.values()) {
      const k = t.de + '\u0001' + t.act;
      if (v.has(k) && v.get(k) !== t.a) return false;
      v.set(k, t.a);
    }
    return true;
  }

  /* ---------- Fig. 1: construcción paso a paso ---------- */

  const LOGS = {
    par: { nombre: 'Elección y paralelo', trazas: [['abcd', 3], ['acbd', 2], ['aed', 2]] },
    bucle: { nombre: 'Con bucle', trazas: [['abd', 3], ['abcbd', 2], ['abcbcbd', 1]] },
  };

  function montarConstruccion(cuerpo) {
    let log = 'par', abs = 'sec', k = 2, ts = vacio(), hecho = 0, ultimo = null, alto = 300, posBase = null;
    const eventos = () => LOGS[log].trazas.flatMap(([s, n]) => [...s].map((_, i) => ({ t: [...s], i, n })));
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Registro', opciones: Object.entries(LOGS).map(([c, v]) => [c, v.nombre]), valor: log, alCambiar: (v) => { log = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Abstracción del estado', opciones: Object.entries(ABSTRACCIONES).map(([c, v]) => [c, v.nombre]), valor: abs, alCambiar: (v) => { abs = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'k de la ventana', min: 1, max: 3, valor: k, alCambiar: (v) => { k = v; if (abs === 'vent') rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => alto });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'estado inicial', forma: 'cuadro' },
      { color: C.s2, texto: 'último estado o transición agregada', forma: 'cuadro' },
      { color: C.tinta, texto: 'estado final (algún caso termina ahí)', forma: 'cuadro' },
      { color: C.s1, texto: 'transición (grosor = casos)', forma: 'linea' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma un evento de una traza, calcula el estado antes y después con la abstracción elegida y agrega al sistema los estados y la transición que falten. Cambie la abstracción y compare el tamaño final.');
    let mensaje = '';

    function iniciar() {
      ts = vacio(); hecho = 0; ultimo = null;
      // La disposición se calcula con el sistema completo, para que los nodos no se muevan al avanzar.
      const completo = vacio();
      eventos().forEach((e) => incorporar(completo, abs, k, e.t, e.i, e.n));
      const ids = [...completo.estados.keys()];
      posBase = P.disponer(ids, [...completo.trans.values()].map((t) => [t.de, t.a]));
      mensaje = 'Sistema vacío. Cada paso incorpora un evento del registro.';
      const lista = eventos();
      return (function* () {
        for (const e of lista) {
          ultimo = incorporar(ts, abs, k, e.t, e.i, e.n);
          hecho++;
          const pre = e.t.slice(0, e.i).join('') || 'ε';
          mensaje = `Caso «${e.t.join('')}», evento ${e.i + 1}: tras «${pre}» ocurre ${ultimo.act}. Estado ${ultimo.de} → ${ultimo.a}`
            + (ultimo.nuevoEstado ? ' (estado nuevo)' : ultimo.nuevaTrans ? ' (transición nueva)' : ' (ya existía: solo cuenta)') + '.';
          yield;
        }
        mensaje = `Registro completo: ${ts.estados.size} estados y ${ts.trans.size} transiciones con la abstracción «${ABSTRACCIONES[abs].corto}».`;
      })();
    }

    function dibujar() {
      if (!posBase) return;
      const ids = [...posBase ? Object.keys(posBase) : []];
      // Orientación según el ancho disponible.
      const g = new Map();
      ids.forEach((id) => g.set(posBase[id].x.toFixed(4), (g.get(posBase[id].x.toFixed(4)) || 0) + 1));
      const capas = g.size, carriles = Math.max(1, ...g.values());
      const vertical = capas * 78 + 60 > lienzo.ancho;
      const pos = {};
      ids.forEach((id) => { pos[id] = vertical ? { x: posBase[id].y, y: posBase[id].x } : posBase[id]; });
      const necesario = vertical ? capas * 56 + 50 : Math.max(240, carriles * 58 + 60);
      if (necesario !== alto) { alto = necesario; lienzo.ajustar(true); return; }
      const maxN = Math.max(1, ...[...ts.trans.values()].map((t) => t.n));
      const nodos = ids.map((id) => {
        const e = ts.estados.get(id);
        const reciente = ultimo && (id === ultimo.a || id === ultimo.de) && rep && !rep.terminado;
        if (!e) return { id, tipo: 'act', etiqueta: id, borde: C.tenue, colorTexto: C.tenue };
        return { id, tipo: 'act', etiqueta: id, borde: e.final ? C.tinta : e.inicial ? C.s6 : C.tinta2, anillo: reciente ? C.s2 : e.inicial ? C.s6 : null, relleno: e.final ? C.neutro : C.superficie };
      });
      const agr = new Map();
      for (const t of ts.trans.values()) {
        const clave = t.de + '\u0001' + t.a;
        if (!agr.has(clave)) agr.set(clave, { de: t.de, a: t.a, act: [], n: 0, nuevo: false });
        const r = agr.get(clave);
        r.act.push(t.act); r.n += t.n;
        if (ultimo && t.de === ultimo.de && t.a === ultimo.a && t.act === ultimo.act) r.nuevo = true;
      }
      const aristas = [...agr.values()].map((r) => ({ de: r.de, a: r.a, etiqueta: r.act.join(','), color: r.nuevo ? C.s2 : C.s1, ancho: 1.5 + (2.5 * r.n) / maxN, colorTexto: C.tinta, curva: pos[r.a] && pos[r.de] && pos[r.a].x <= pos[r.de].x && r.a !== r.de ? 34 : undefined }));
      lienzo.limpiar();
      P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 11, margenX: 44, margenY: 30 });
      const total = eventos().length;
      registro.textContent = mensaje;
      lista.replaceChildren(...LOGS[log].trazas.map(([s, n]) => VIZ.el('div', null, `${n} × ${[...s].join(' → ')}`)));
      lectura.set([
        ['estados', String(ts.estados.size)],
        ['transiciones', String(ts.trans.size)],
        ['eventos incorporados', `${hecho} de ${total}`],
        ['¿determinista?', determinista(ts) ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: explosión de estados ---------- */

  const NOMBRES = 'bcdef';
  function montarExplosion(cuerpo) {
    let ramas = 4, casos = 200, k = 2, semilla = 1, serie = [], plano = null, hover = -1;
    const SER = [['sec', C.s1], ['con', C.s3], ['vent', C.s2], ['fut', C.s7]];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Actividades en paralelo', min: 2, max: 5, valor: ramas, alCambiar: (v) => { ramas = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos del registro', min: 20, max: 400, paso: 10, valor: casos, alCambiar: (v) => { casos = v; calcular(); } });
    ctl.rango({ etiqueta: 'k de la ventana', min: 1, max: 3, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...SER.map(([c, col]) => ({ color: col, texto: (c === 'vent' ? `ventana de ${k}` : ABSTRACCIONES[c].corto) + (c === 'fut' ? ' (discontinua: casi coincide con el pasado exacto)' : ''), forma: 'linea' })),
      { color: C.apagado, texto: 'máximo teórico del pasado (secuencia)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada caso es a, las actividades en paralelo en orden aleatorio y z. Pase el cursor para ver cuántos estados tiene cada abstracción tras N casos. Suba las actividades en paralelo: el pasado exacto explota, el conjunto casi no.');
    const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

    function calcular() {
      const hijos = [...NOMBRES.slice(0, ramas)].map((c) => P.act(c));
      const log = P.simular(P.sec(P.act('a'), P.y(...hijos), P.act('z')), casos, semilla * 13 + ramas);
      const conj = { sec: new Set(), con: new Set(), vent: new Set(), fut: new Set() };
      serie = [];
      log.forEach((c) => {
        const t = P.trazaDe(c);
        for (let i = 0; i <= t.length; i++) for (const a of Object.keys(conj)) conj[a].add(estado(a, t, i, k));
        serie.push({ sec: conj.sec.size, con: conj.con.size, vent: conj.vent.size, fut: conj.fut.size });
      });
      dibujar();
    }
    const teorico = () => { let s = 2 + fact(ramas); for (let j = 1; j <= ramas; j++) s += fact(ramas) / fact(ramas - j); return s; };
    function dibujar() {
      if (!serie.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      const T = teorico(), ymax = Math.max(T, ...SER.map(([c]) => serie[serie.length - 1][c])) * 1.1;
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: serie.length, ymin: 0, ymax }, { etiquetaX: 'casos procesados', etiquetaY: 'estados', formatoX: (v) => String(Math.round(v)), formatoY: (v) => VIZ.entero(v) });
      plano.ejes();
      ctx.save(); plano.recortar();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(plano.x0, plano.sy(T)); ctx.lineTo(plano.x1, plano.sy(T)); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`máx. ${VIZ.entero(T)}`, plano.x1, plano.sy(T) - 3);
      for (const [c, col] of SER) VIZ.trazar(ctx, plano, serie.map((s, i) => [i + 1, s[c]]), col, 2, c === 'fut' ? [7, 5] : null);
      if (hover >= 0) for (const [c, col] of SER) VIZ.marcador(ctx, plano.sx(hover + 1), plano.sy(serie[hover][c]), col, 4);
      const f = serie[serie.length - 1];
      lectura.set([
        ['pasado (secuencia)', `${VIZ.entero(f.sec)} de ${VIZ.entero(T)}`],
        ['pasado (conjunto)', `${VIZ.entero(f.con)} (teórico ${2 ** ramas + 2})`],
        [`ventana de ${k}`, VIZ.entero(f.vent)],
        ['futuro (secuencia)', VIZ.entero(f.fut)],
        ['órdenes posibles', VIZ.entero(fact(ramas))],
      ]);
      registro.textContent = `Con ${ramas} actividades en paralelo hay ${fact(ramas)} órdenes posibles. Tras ${serie.length} casos, el pasado exacto distingue ${f.sec} estados; el conjunto de actividades, solo ${f.con}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(serie.length - 1, Math.round(plano.ix(x)) - 1));
      if (i !== hover) { hover = i; dibujar(); }
      tip.mostrar(x, y, `tras <b>${i + 1}</b> casos` + SER.map(([c, col]) => VIZ.filaTooltip(col, c === 'vent' ? `ventana de ${k}` : ABSTRACCIONES[c].corto, VIZ.entero(serie[i][c]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('transition-systems', {
    intro: String.raw`
      <p>Un <strong>sistema de transición</strong> es el modelo más general de comportamiento: un conjunto de <em>estados</em> y de
      <em>transiciones</em> etiquetadas con actividades que llevan de un estado a otro. Un caso es un camino desde un estado inicial hasta uno final.
      La pregunta clave es qué significa «estar en un estado», porque el registro de eventos solo contiene actividades, no estados.</p>
      <p>La respuesta es una <strong>función de abstracción</strong> que resume lo que se recuerda del pasado (o se sabe del futuro) de un caso. Una que
      recuerda poco produce modelos pequeños que mezclan situaciones distintas; una que recuerda mucho distingue todo, pero crece sin control.</p>`,
    visualizaciones: [
      {
        titulo: 'Construcción del sistema de transición',
        descripcion: 'Reproduzca el registro evento por evento y cambie la abstracción: con el pasado exacto el sistema es un árbol, con el conjunto de actividades los órdenes paralelos se funden.',
        montar: montarConstruccion,
      },
      {
        titulo: 'Explosión de estados',
        descripcion: 'Cuente los estados de cada abstracción según crece el número de actividades en paralelo. Pruebe 5 actividades y compare el pasado exacto con el conjunto.',
        montar: montarExplosion,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Un sistema de transición es una tupla \(TS = (S, A, T, S_{\text{ini}}, S_{\text{fin}})\) con \(S\) estados, \(A\) actividades,
      \(T \subseteq S \times A \times S\) transiciones, y conjuntos de estados iniciales y finales. Un caso \(\sigma = \langle a_1, \dots, a_n \rangle\)
      es <em>reproducible</em> si existen \(s_0 \in S_{\text{ini}}, s_1, \dots, s_n \in S_{\text{fin}}\) con \((s_{i-1}, a_i, s_i) \in T\).</p>
      <h2>Abstracciones del estado</h2>
      <p>Dado un prefijo \(\sigma_{1..i}\) (y el sufijo \(\sigma_{i+1..n}\)), se define el estado mediante una función de abstracción
      \(\text{abs}(\sigma, i)\). Las clásicas (van der Aalst et al.) son:</p>
      <table>
        <tr><th>Abstracción</th><th>Estado tras \(i\) eventos</th><th>Efecto</th></tr>
        <tr><td>Pasado, secuencia</td><td>\(\langle \sigma_1, \dots, \sigma_i \rangle\)</td><td>exacta; el sistema es un árbol de prefijos</td></tr>
        <tr><td>Pasado, conjunto</td><td>\(\{\sigma_1, \dots, \sigma_i\}\)</td><td>ignora orden y repeticiones; acíclica salvo bucles de un nodo</td></tr>
        <tr><td>Ventana de \(k\)</td><td>\(\langle \sigma_{i-k+1}, \dots, \sigma_i \rangle\)</td><td>\(k = 1\) da el <a href="tema.html?id=directly-follows-graphs">DFG</a>; admite ciclos</td></tr>
        <tr><td>Futuro, secuencia</td><td>\(\langle \sigma_{i+1}, \dots, \sigma_n \rangle\)</td><td>usa el sufijo: sirve para análisis a posteriori y predicción</td></tr>
      </table>
      <h2>Construcción</h2>
      <pre><code>S ← ∅;  T ← ∅
para cada traza σ del registro:
    para i ← 0 hasta |σ| − 1:
        s ← abs(σ, i);  s' ← abs(σ, i + 1)
        S ← S ∪ {s, s'};  T ← T ∪ {(s, σ_{i+1}, s')}
    marcar abs(σ, 0) como inicial y abs(σ, |σ|) como final</code></pre>
      <h2>Explosión de estados</h2>
      <p>Con un bloque de \(m\) actividades en paralelo, el pasado exacto distingue cada orden parcial: hay
      \(\sum_{j=0}^{m} \frac{m!}{(m-j)!}\) prefijos posibles del bloque, mientras que el pasado como conjunto solo distingue los \(2^m\) subconjuntos.
      La abstracción es un compromiso entre dos riesgos: el <em>sobreajuste</em> (estados que memorizan los casos del registro) y la
      <em>mezcla</em> (un mismo estado con futuros incompatibles).</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Un sistema de transición no se vuelve compacto por ser un buen modelo, sino por una
      buena abstracción. Una <a href="tema.html?id=petri-nets">red de Petri</a> representa los \(2^m\) estados del paralelismo con solo \(m\) plazas
      y \(m\) transiciones; esa es su ventaja frente a listar estados.</p></div>
      <h2>Conexiones</h2>
      <p>La <em>región</em> de un sistema de transición es un conjunto de estados que se comporta como una plaza; la <em>síntesis de redes por
      regiones</em> convierte un TS en una red de Petri. El <a href="tema.html?id=workflow-nets">grafo de alcanzabilidad</a> de una red es un sistema de
      transición cuyos estados son marcados. El análisis de <a href="tema.html?id=process-discovery">descubrimiento de procesos</a> compara este enfoque con
      el algoritmo Alfa y con los mineros heurísticos.</p>`,
  });
})();
