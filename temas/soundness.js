(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Redes de ejemplo ---------- */

  const pl = (id, nombre) => ({ id, nombre: nombre || id });
  const tr = (id, nombre, silenciosa) => ({ id, nombre, silenciosa: !!silenciosa });

  // Familia: a, luego una bifurcación (Y u O) en b y c, una unión (Y u O) y d. `x` agrega una transición que exige b y c a la vez.
  function familia(split, join, x) {
    const plazas = [pl('ini'), pl('p1'), pl('qb'), pl('qc'), pl('p2'), pl('fin')];
    const trans = [tr('ta', 'a'), tr('tb', 'b'), tr('tc', 'c'), tr('td', 'd')];
    const arcos = [['ini', 'ta'], ['ta', 'p1'], ['tb', 'qb'], ['tc', 'qc'], ['p2', 'td'], ['td', 'fin']];
    if (split === 'y') {
      plazas.push(pl('pb'), pl('pc')); trans.push(tr('ts', 'τ', true));
      arcos.push(['p1', 'ts'], ['ts', 'pb'], ['ts', 'pc'], ['pb', 'tb'], ['pc', 'tc']);
    } else arcos.push(['p1', 'tb'], ['p1', 'tc']);
    if (join === 'y') { trans.push(tr('tj', 'τ', true)); arcos.push(['qb', 'tj'], ['qc', 'tj'], ['tj', 'p2']); }
    else { trans.push(tr('tj1', 'τ', true), tr('tj2', 'τ', true)); arcos.push(['qb', 'tj1'], ['tj1', 'p2'], ['qc', 'tj2'], ['tj2', 'p2']); }
    if (x) { trans.push(tr('tx', 'x')); arcos.push(['qb', 'tx'], ['qc', 'tx'], ['tx', 'p2']); }
    return { plazas, trans, arcos, ini: 'ini', fin: 'fin' };
  }
  // Correcta con retrabajo: tras b se termina con c o se repite desde p1 con r.
  function conBucle() {
    return {
      plazas: [pl('ini'), pl('p1'), pl('p2'), pl('fin')],
      trans: [tr('ta', 'a'), tr('tb', 'b'), tr('tc', 'c'), tr('tr', 'r')],
      arcos: [['ini', 'ta'], ['ta', 'p1'], ['p1', 'tb'], ['tb', 'p2'], ['p2', 'tc'], ['tc', 'fin'], ['p2', 'tr'], ['tr', 'p1']],
      ini: 'ini', fin: 'fin',
    };
  }
  const EJEMPLOS = {
    ok: { texto: 'Correcta (Y + Y)', red: () => familia('y', 'y'), pista: 'Las dos ramas se ejecutan y se sincronizan: siempre se puede llegar a [fin] y sin fichas de más.' },
    bucle: { texto: 'Correcta con bucle', red: conBucle, pista: 'Un bucle no rompe la corrección mientras siempre exista una salida hacia [fin].' },
    bloqueo: { texto: 'Bloqueo (O + Y)', red: () => familia('o', 'y'), pista: 'Solo una rama se ejecuta, pero la unión espera las dos: la red queda detenida antes de [fin].' },
    residuos: { texto: 'Fichas sobrantes (Y + O)', red: () => familia('y', 'o'), pista: 'Las dos ramas se ejecutan pero cada una pasa por separado: d se dispara dos veces y quedan fichas de más.' },
    muerta: { texto: 'Transición muerta (O + O + x)', red: () => familia('o', 'o', true), pista: 'x exige b y c a la vez, pero solo una de ellas se ejecuta: x nunca puede dispararse.' },
  };

  /* ---------- Grafo de marcados y criterios ---------- */

  const clave = (m) => Object.keys(m).filter((k) => m[k] > 0).sort().map((k) => (m[k] > 1 ? `${k}×${m[k]}` : k)).join('+') || '∅';
  const LIMPIA = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v > 0));

  // Exploración en anchura; `tope` limita el número de marcados por si la red no es acotada.
  function explorar(red, tope = 60) {
    const m0 = P.marcadoInicial(red), k0 = clave(m0);
    const estados = new Map([[k0, { key: k0, m: m0 }]]), aristas = [], cola = [k0];
    let truncado = false;
    while (cola.length) {
      const k = cola.shift(), m = estados.get(k).m;
      for (const t of red.trans) {
        if (!P.habilitada(red, m, t.id)) continue;
        const n = LIMPIA(P.disparar(red, m, t.id)), kn = clave(n);
        if (!estados.has(kn)) {
          if (estados.size >= tope) { truncado = true; continue; }
          estados.set(kn, { key: kn, m: n }); cola.push(kn);
        }
        aristas.push({ de: k, a: kn, t: t.id });
      }
    }
    return { estados, aristas, truncado, inicial: k0 };
  }
  // Los tres criterios de corrección sobre el grafo completo.
  function verificar(red, g) {
    const final = clave({ [red.fin]: 1 });
    const alcanza = new Set(g.estados.has(final) ? [final] : []);
    for (let cambio = true; cambio;) {
      cambio = false;
      for (const e of g.aristas) if (alcanza.has(e.a) && !alcanza.has(e.de)) { alcanza.add(e.de); cambio = true; }
    }
    const sinSalida = [...g.estados.keys()].filter((k) => !alcanza.has(k));
    const impropios = [...g.estados.values()].filter((e) => (e.m[red.fin] || 0) > 0 && e.key !== final).map((e) => e.key);
    const usadas = new Set(g.aristas.map((e) => e.t));
    const muertas = red.trans.filter((t) => !usadas.has(t.id));
    return {
      final, sinSalida, impropios, muertas,
      opcion: sinSalida.length === 0, propia: impropios.length === 0, vivas: muertas.length === 0,
      sound: sinSalida.length === 0 && impropios.length === 0 && muertas.length === 0 && !g.truncado,
    };
  }
  const nombreT = (red, id) => { const t = red.trans.find((x) => x.id === id); return t.silenciosa ? 'τ' : t.nombre; };

  // Dibuja el grafo de marcados. visibles: Set de claves a mostrar (o null = todos).
  function dibujarRG(lienzo, red, g, pos, v, o = {}) {
    const vis = o.visibles;
    const nodos = [...g.estados.values()].filter((e) => !vis || vis.has(e.key)).map((e) => {
      const esFinal = e.key === v.final, malo = v.sinSalida.includes(e.key), impropio = v.impropios.includes(e.key);
      const mostrar = o.verde !== false;
      return {
        id: e.key, tipo: 'act', etiqueta: e.key, fuente: 11,
        relleno: o.resaltar && o.resaltar.has(e.key) ? o.resaltarColor : esFinal && mostrar ? VIZ.alfa(C.s6, 0.35) : o.colorear && malo ? VIZ.alfa(C.s8, 0.3) : o.colorear && impropio ? VIZ.alfa(C.s4, 0.45) : C.superficie,
        anillo: e.key === o.actual ? C.s1 : e.key === o.expandiendo ? C.s2 : null,
        borde: e.key === g.inicial ? C.s6 : o.frontera && o.frontera.has(e.key) ? C.s4 : C.tinta,
      };
    });
    const aristas = g.aristas.filter((e) => !vis || (vis.has(e.de) && vis.has(e.a))).map((e) => ({ de: e.de, a: e.a, etiqueta: nombreT(red, e.t), color: C.apagado }));
    return P.dibujarGrafo(lienzo, nodos, aristas, pos, { margenX: 40, margenY: 26, fuente: 11 });
  }
  function disposicion(g) {
    const ids = [...g.estados.keys()];
    const pos = P.disponer(ids, g.aristas.map((e) => [e.de, e.a]));
    const capas = new Map();
    Object.values(pos).forEach((p) => capas.set(p.x, (capas.get(p.x) || 0) + 1));
    return { pos, maxCapa: Math.max(1, ...capas.values()) };
  }

  /* ---------- Fig. 1: juego de fichas y grafo de marcados ---------- */

  function montarJuego(cuerpo) {
    let clv = 'bloqueo', red = null, g = null, v = null, pos = null, posRG = null, m = null, hist = [], geoRed = null, altoRG = 220, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Red de ejemplo', opciones: Object.entries(EJEMPLOS).map(([k, e]) => [k, e.texto]), valor: clv, alCambiar: (k) => { clv = k; cargar(); } });
    ctl.boton('Disparo al azar', () => {
      const hab = red.trans.filter((t) => P.habilitada(red, m, t.id));
      if (!hab.length) return dibujar();
      const rnd = VIZ.semilla(semilla++ * 977 + hist.length);
      disparar(hab[Math.floor(rnd() * hab.length)].id);
    }, { primario: true });
    ctl.boton('Reiniciar', () => cargar());

    const lienzoRed = VIZ.lienzo(cuerpo, { proporcion: 0.38, altoMin: 230, altoMax: 340 });
    VIZ.subtitulo(cuerpo, 'Grafo de marcados (todos los estados alcanzables)');
    const lienzoRG = VIZ.lienzo(cuerpo, { altoFn: () => altoRG });
    VIZ.leyenda(cuerpo, [
      { color: VIZ.alfa(C.s6, 0.3), borde: C.s6, texto: 'transición habilitada (clic para disparar)', forma: 'cuadro' },
      { color: VIZ.alfa(C.s6, 0.35), borde: C.tinta, texto: 'marcado final [fin]', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.tinta, texto: 'desde aquí no se puede llegar a [fin]', forma: 'cuadro' },
      { color: VIZ.alfa(C.s4, 0.45), borde: C.tinta, texto: 'fichas de más en fin o junto a fin', forma: 'cuadro' },
      { color: C.s1, texto: 'marcado actual', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una transición resaltada de la red para dispararla (o use «Disparo al azar»): el marcado actual se marca con un anillo azul en el grafo de abajo. Pruebe llegar a un marcado sin salida en «Bloqueo» y a fichas sobrantes en «Fichas sobrantes».');

    function cargar() {
      red = EJEMPLOS[clv].red();
      g = explorar(red); v = verificar(red, g);
      const d = disposicion(g); posRG = d.pos; altoRG = Math.max(200, d.maxCapa * 46 + 40);
      pos = P.posDeRed(red);
      m = P.marcadoInicial(red); hist = [];
      lienzoRG.ajustar(true); lienzoRed.ajustar(true);
    }
    function disparar(id) {
      m = LIMPIA(P.disparar(red, m, id));
      hist.push(nombreT(red, id));
      dibujar();
    }
    function dibujar() {
      if (!red) return;
      lienzoRed.limpiar();
      const hab = new Set(red.trans.filter((t) => P.habilitada(red, m, t.id)).map((t) => t.id));
      const { nodos, aristas } = P.nodosDeRed(red, m, {
        plaza: () => ({}),
        trans: (t) => (hab.has(t.id) ? { relleno: VIZ.alfa(C.s6, 0.3), borde: C.s6 } : {}),
      });
      geoRed = P.dibujarGrafo(lienzoRed, nodos, aristas, pos, { etiquetasPlazas: true });
      lienzoRG.limpiar();
      dibujarRG(lienzoRG, red, g, posRG, v, { colorear: true, actual: clave(m) });
      const kc = clave(m), final = kc === v.final;
      const impropio = v.impropios.includes(kc), sinSalida = v.sinSalida.includes(kc);
      registro.textContent = `Marcado [${kc}]${hist.length ? ` tras ${hist.join(' → ')}` : ' (inicial)'}. ` + (final ? 'Es el marcado final: la instancia terminó correctamente.'
        : hab.size === 0 ? 'No hay transiciones habilitadas y no es el final: bloqueo (deadlock).'
          : impropio ? 'Hay una ficha en «fin» pero también fichas en otras plazas: terminación impropia.'
            : sinSalida ? 'Desde este marcado ya no es posible llegar a [fin].' : `Habilitadas: ${[...hab].map((id) => nombreT(red, id)).join(', ')}. ${EJEMPLOS[clv].pista}`);
      const si = (ok, txt) => (ok ? 'sí' : `no${txt ? ' (' + txt + ')' : ''}`);
      lectura.set([
        ['marcados alcanzables', String(g.estados.size)],
        ['terminación posible', si(v.opcion, `${v.sinSalida.length} marcado(s) sin salida`)],
        ['terminación propia', si(v.propia, `${v.impropios.length} marcado(s) con fichas de más`)],
        ['sin transiciones muertas', si(v.vivas, v.muertas.map((t) => t.nombre).join(', '))],
        ['¿sound?', v.sound ? 'sí' : 'no'],
      ]);
    }
    lienzoRed.alDibujar = dibujar; lienzoRG.alDibujar = dibujar;
    lienzoRed.canvas.style.cursor = 'pointer';
    lienzoRed.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzoRed.posicion(ev);
      let mejor = null, dm = 24;
      for (const gn of geoRed.nodos.values()) {
        const t = red.trans.find((q) => q.id === gn.n.id);
        if (!t || !P.habilitada(red, m, t.id)) continue;
        const d = Math.hypot(x - gn.x, y - gn.y);
        if (d < dm) { dm = d; mejor = t.id; }
      }
      if (mejor) disparar(mejor);
    });
    cargar();
  }

  /* ---------- Fig. 2: el verificador paso a paso ---------- */

  function montarVerificador(cuerpo) {
    let split = 'o', join = 'y', conX = false, red = null, g = null, v = null, pos = null, posRG = null, altoRG = 220;
    let vistos = new Set(), cola = [], actual = null, etapa = 'explorar', texto = '', hechas = 0, geoRed = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Bifurcación tras a', opciones: [['y', 'Y: b y c se ejecutan'], ['o', 'O: b o c']], valor: split, alCambiar: (k) => { split = k; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Unión antes de d', opciones: [['y', 'Y: espera b y c'], ['o', 'O: basta b o c']], valor: join, alCambiar: (k) => { join = k; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Agregar x (exige b y c a la vez)', valor: conX, alCambiar: (b) => { conX = b; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });

    const lienzoRed = VIZ.lienzo(cuerpo, { proporcion: 0.34, altoMin: 220, altoMax: 320 });
    VIZ.subtitulo(cuerpo, 'Grafo de marcados que se va descubriendo');
    const lienzoRG = VIZ.lienzo(cuerpo, { altoFn: () => altoRG });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'marcado que se expande ahora', forma: 'punto' },
      { color: C.s4, texto: 'borde: marcado en la cola', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.3), borde: C.tinta, texto: 'marcado sin salida / transición muerta', forma: 'cuadro' },
      { color: VIZ.alfa(C.s4, 0.45), borde: C.tinta, texto: 'terminación impropia', forma: 'cuadro' },
      { color: VIZ.alfa(C.s6, 0.35), borde: C.tinta, texto: 'marcado final', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie la bifurcación y la unión: Y/Y y O/O son correctas; O/Y se bloquea; Y/O deja fichas de más. Con «x» y bifurcación O, x nunca puede dispararse. Con «Un paso» se expande un marcado; al terminar, tres pasos más evalúan los criterios.');

    function iniciar() {
      red = familia(split, join, conX);
      g = explorar(red); v = verificar(red, g);
      const d = disposicion(g); posRG = d.pos; altoRG = Math.max(200, d.maxCapa * 46 + 40);
      pos = P.posDeRed(red);
      vistos = new Set([g.inicial]); cola = [g.inicial]; actual = null; etapa = 'explorar'; hechas = 0;
      texto = `Se parte del marcado inicial [${g.inicial}]. Se expande cada marcado de la cola disparando todo lo habilitado.`;
      lienzoRed.ajustar(true); lienzoRG.ajustar(true);
      return (function* () {
        while (cola.length) {
          actual = cola.shift(); hechas++;
          const sal = g.aristas.filter((e) => e.de === actual);
          const nuevos = [];
          sal.forEach((e) => { if (!vistos.has(e.a)) { vistos.add(e.a); cola.push(e.a); nuevos.push(e.a); } });
          texto = sal.length
            ? `Marcado [${actual}]: habilita ${sal.map((e) => nombreT(red, e.t)).join(', ')}. ${nuevos.length ? `Descubre ${nuevos.map((k) => `[${k}]`).join(', ')}.` : 'Todos sus sucesores ya se conocían.'}`
            : actual === v.final ? `Marcado [${actual}]: es el final, no habilita nada.` : `Marcado [${actual}]: no habilita ninguna transición y no es el final.`;
          yield;
        }
        actual = null; etapa = 'c1';
        texto = v.opcion ? `Terminación posible: desde los ${g.estados.size} marcados se puede llegar a [${v.final}] (búsqueda hacia atrás desde el final).`
          : `Terminación posible: FALLA. Desde ${v.sinSalida.map((k) => `[${k}]`).join(', ')} no se puede llegar a [${v.final}].`;
        yield;
        etapa = 'c2';
        texto = v.propia ? 'Terminación propia: toda vez que «fin» tiene ficha, es el único lugar con fichas.'
          : `Terminación propia: FALLA. ${v.impropios.map((k) => `[${k}]`).join(', ')} tiene ficha en «fin» y fichas en otras plazas.`;
        yield;
        etapa = 'c3';
        texto = v.vivas ? 'Sin transiciones muertas: toda transición se dispara en algún marcado alcanzable.'
          : `Sin transiciones muertas: FALLA. ${v.muertas.map((t) => t.nombre).join(', ')} no se dispara en ningún marcado alcanzable.`;
        yield;
        etapa = 'fin';
        texto = v.sound ? 'La red es sound: cumple los tres criterios.' : 'La red NO es sound: incumple al menos un criterio.';
      })();
    }
    function dibujar() {
      if (!red) return;
      const terminada = etapa !== 'explorar';
      lienzoRed.limpiar();
      const { nodos, aristas } = P.nodosDeRed(red, P.marcadoInicial(red), {
        trans: (t) => (['c3', 'fin'].includes(etapa) && v.muertas.includes(t) ? { relleno: VIZ.alfa(C.s8, 0.35), borde: C.s8 } : {}),
      });
      geoRed = P.dibujarGrafo(lienzoRed, nodos, aristas, pos, { etiquetasPlazas: true });
      lienzoRG.limpiar();
      const mostrar = etapa === 'c1' || etapa === 'c2' || etapa === 'c3' || etapa === 'fin';
      dibujarRG(lienzoRG, red, g, posRG, {
        ...v, sinSalida: ['c1', 'fin', 'c2', 'c3'].includes(etapa) ? v.sinSalida : [], impropios: ['c2', 'c3', 'fin'].includes(etapa) ? v.impropios : [],
      }, { visibles: terminada ? null : vistos, colorear: true, expandiendo: actual, frontera: new Set(cola), verde: mostrar || vistos.has(v.final) });
      registro.textContent = texto;
      const ver = (ok, etapas) => (etapas.includes(etapa) ? (ok ? 'sí' : 'no') : '…');
      lectura.set([
        ['marcados descubiertos', String(terminada ? g.estados.size : vistos.size)],
        ['marcados expandidos', String(hechas)],
        ['en la cola', String(cola.length)],
        ['terminación posible', ver(v.opcion, ['c1', 'c2', 'c3', 'fin'])],
        ['terminación propia', ver(v.propia, ['c2', 'c3', 'fin'])],
        ['sin transiciones muertas', ver(v.vivas, ['c3', 'fin'])],
        ['¿sound?', ver(v.sound, ['fin'])],
      ]);
    }
    lienzoRed.alDibujar = dibujar; lienzoRG.alDibujar = dibujar;
    rep.reiniciar();
  }

  VIZ.registrarTema('soundness', {
    intro: String.raw`
      <p>Un modelo de proceso puede dibujarse sin errores y aun así ser <strong>incorrecto</strong>: puede bloquearse antes de terminar, dejar tareas a medio hacer al llegar al final, o contener
      actividades que nunca podrán ejecutarse. La <em>corrección</em> (<em>soundness</em>) de una red de flujo de trabajo reúne exactamente tres garantías que evitan esos defectos.</p>
      <p>Se comprueba explorando todos los estados que la red puede alcanzar (su grafo de marcados): una propiedad de comportamiento, no de dibujo. Es el paso previo a medir
      cualquier otra cosa: un modelo no sound no sirve como referencia para comprobar la conformidad de un registro.</p>`,
    visualizaciones: [
      {
        titulo: 'Juego de fichas y grafo de marcados',
        descripcion: 'Juegue con fichas sobre cinco redes (bifurcación + unión) y vea en qué marcado del grafo está. En «Bloqueo», dispare a, luego b o c, y llegará a un marcado en rojo sin salida; en «Fichas sobrantes», d se dispara dos veces y termina con fichas de más.',
        montar: montarJuego,
      },
      {
        titulo: 'Verificador paso a paso',
        descripcion: 'Construya la red eligiendo cómo se bifurca y cómo se une, y ejecute la comprobación: primero se explora el grafo de marcados, luego se evalúan los tres criterios. Pruebe O con Y (se bloquea), Y con O (fichas de más) y O con O agregando x (transición muerta).',
        montar: montarVerificador,
      },
    ],
    teoria: String.raw`
      <h2>Redes de flujo de trabajo</h2>
      <p>Una <strong>workflow net</strong> es una red de Petri con una única plaza de inicio \(i\) (sin arcos de entrada), una única plaza final \(o\) (sin arcos de salida) y tal que todo nodo está en algún camino de \(i\) a \(o\).
      Vea <a href="tema.html?id=workflow-nets">workflow nets y alcanzabilidad</a>. El estado inicial es \([i]\) (una ficha en \(i\)) y el estado esperado al terminar, \([o]\).</p>
      <h2>Definición de soundness</h2>
      <p>Sea \(R(N, M)\) el conjunto de marcados alcanzables desde \(M\). La red \(N\) es <strong>sound</strong> si cumple:</p>
      <ol>
        <li><strong>Terminación posible</strong> (<em>option to complete</em>): \(\forall M \in R(N,[i]):\ [o] \in R(N, M)\). Desde cualquier estado alcanzable aún se puede terminar.</li>
        <li><strong>Terminación propia</strong> (<em>proper completion</em>): \(\forall M \in R(N,[i]):\ M \ge [o] \Rightarrow M = [o]\). Si hay ficha en \(o\), no queda ninguna otra.</li>
        <li><strong>Sin transiciones muertas</strong>: \(\forall t\ \exists M, M' \in R(N,[i]):\ M \xrightarrow{t} M'\). Toda actividad puede ocurrir en alguna ejecución.</li>
      </ol>
      <p>Una red sound es siempre <em>acotada</em> (el grafo de marcados es finito), lo que hace decidible la comprobación. Equivale a que la red con una transición extra \(t^{*}\) de \(o\) a \(i\) sea <em>viva y acotada</em>.</p>
      <h2>Algoritmo de comprobación</h2>
      <pre><code>explorar el grafo de marcados desde [i] en anchura (con tope de estados)
opción ← todo marcado alcanza [o]            (búsqueda hacia atrás desde [o])
propia ← no existe M con M(o) ≥ 1 y M ≠ [o]
vivas  ← toda transición etiqueta alguna arista del grafo
devolver opción ∧ propia ∧ vivas</code></pre>
      <h2>Los defectos típicos</h2>
      <table>
        <tr><th>Estructura</th><th>Problema</th><th>Criterio que falla</th></tr>
        <tr><td>Bifurcación O + unión Y</td><td>la unión espera una rama que no se ejecutó</td><td>terminación posible (bloqueo)</td></tr>
        <tr><td>Bifurcación Y + unión O</td><td>las ramas pasan de largo y d se dispara dos veces</td><td>terminación propia (fichas sobrantes)</td></tr>
        <tr><td>Transición que exige ramas exclusivas</td><td>nunca se habilita</td><td>sin transiciones muertas</td></tr>
      </table>
      <p>La regla práctica: <em>cada bifurcación Y debe cerrarse con una unión Y, y cada bifurcación O con una unión O</em>. Los bucles son correctos mientras siempre quede una salida.</p>
      <h2>Costo y conexiones</h2>
      <p>El grafo de marcados puede ser exponencial en el número de ramas paralelas (el paralelismo multiplica los estados), por eso para redes grandes se usan resultados estructurales (redes de libre elección, reducciones) o semánticas simbólicas.
      Los modelos descubiertos por el <a href="tema.html?id=alpha-algorithm">algoritmo Alfa</a> pueden no ser sound (vea <a href="tema.html?id=alpha-limitations">sus limitaciones</a>), a diferencia de los de los <a href="tema.html?id=process-trees">árboles de procesos</a>,
      que lo son por construcción. Las medidas de <a href="tema.html?id=token-based-replay">reproducción de fichas</a>, <a href="tema.html?id=alignments">alineamientos</a> y <a href="tema.html?id=fitness-precision">fitness y precisión</a> presuponen un modelo correcto.
      El mismo formalismo aparece en las <a href="tema.html?id=petri-nets">redes de Petri</a> en general.</p>`,
  });
})();
