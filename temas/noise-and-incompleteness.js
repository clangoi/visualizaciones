(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Ayudantes ---------- */

  const A = (x) => P.act(x, { dur: 5 });
  const par = (p) => `({${p.A.join(',')}},{${p.B.join(',')}})`;

  function dibujarRed(lienzo, red, pos, o = {}) {
    const { nodos, aristas } = P.nodosDeRed(red, {}, {
      plaza: (p) => ({
        ...(p.id === red.ini ? { tipo: 'inicio' } : p.id === red.fin ? { tipo: 'fin' } : { etiqueta: p.id }),
        ...(o.plaza ? o.plaza(p) : {}),
      }),
    });
    return P.dibujarGrafo(lienzo, nodos, aristas, pos, { etiquetasPlazas: true });
  }

  // Tabla de huellas con las celdas distintas de la verdadera resaltadas.
  function tablaHuella(h, verdad) {
    const acts = [...new Set([...h.acts, ...verdad.acts])].sort();
    const rel = (m, a, b) => (m.rel[a] && m.rel[a][b]) || '#';
    const COL = { '→': C.s1, '←': C.s3, '‖': C.s2, '#': null };
    return VIZ.el('table', { class: 'tabla-datos sin-corte' },
      VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', null, ''), ...acts.map((b) => VIZ.el('th', null, b)))),
      VIZ.el('tbody', null, ...acts.map((a) => VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, a), ...acts.map((b) => {
        const r = rel(h, a, b), mal = r !== rel(verdad, a, b);
        return VIZ.el('td', { title: `${a} ${r} ${b}${mal ? ` (en el proceso real: ${rel(verdad, a, b)})` : ''}`, style: { background: mal ? VIZ.alfa(C.s8, 0.3) : COL[r] ? VIZ.alfa(COL[r], 0.18) : null, fontWeight: mal ? '700' : '400' } }, r);
      })))));
  }
  function celdasMal(h, verdad) {
    const acts = [...new Set([...h.acts, ...verdad.acts])];
    const rel = (m, a, b) => (m.rel[a] && m.rel[a][b]) || '#';
    let n = 0;
    for (const a of acts) for (const b of acts) if (a <= b && rel(h, a, b) !== rel(verdad, a, b)) n++;
    return n;
  }

  /* ---------- Fig. 1: ruido ---------- */

  // Proceso real: a, luego b y c en paralelo, luego d o e, y f.
  const ARBOL = P.sec(A('a'), P.y(A('b'), A('c')), P.xor([A('d'), A('e')]), A('f'));
  const REAL = P.simular(ARBOL, 400, 7, { espera: 1 });
  const ALFA_REAL = P.alfa(REAL);
  const CLAVES_REAL = new Set(P.variantes(REAL).map((v) => v.clave));
  const NOMBRES_REAL = new Set(ALFA_REAL.red.plazas.map((p) => p.nombre));

  function montarRuido(cuerpo) {
    let n = 120, ruido = 0.1, umbral = 0, semilla = 1, dato = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos en el registro', min: 20, max: 300, paso: 10, valor: n, alCambiar: (v) => { n = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ruido (casos alterados)', min: 0, max: 0.4, paso: 0.01, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.rango({ etiqueta: 'Filtrar variantes con menos de', min: 0, max: 10, paso: 0.5, valor: umbral, formato: (v) => `${VIZ.fmt(v, 2)} % de los casos`, alCambiar: (v) => { umbral = v; calcular(); } });
    ctl.boton('Nuevo registro', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s8, texto: 'plaza (o celda) que no está en el proceso real', forma: 'cuadro' },
      { color: C.s6, texto: 'variante del proceso real', forma: 'cuadro' },
      { color: C.s4, texto: 'variante con ruido', forma: 'cuadro' },
      { color: C.tenue, texto: 'variante filtrada antes de aplicar α', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El proceso real tiene 4 variantes (b y c en paralelo, d o e). El ruido intercambia o borra un evento en algunas trazas. Suba el ruido y α inventa plazas; luego suba el filtro para descartar las variantes raras y recupere el modelo.');

    function calcular() {
      const log = P.simular(ARBOL, n, semilla * 131 + 5, { espera: 1, ruido });
      const vars = P.variantes(log);
      let mantener = vars.filter((v) => (v.n / log.length) * 100 >= umbral);
      if (!mantener.length) mantener = [vars[0]];
      const ks = new Set(mantener.map((v) => v.clave));
      const logF = log.filter((c) => ks.has(P.trazaDe(c).join('›')));
      const alfa = P.alfa(logF);
      dato = { log, vars, ks, logF, alfa, pos: P.posDeRed(alfa.red) };
      dibujar();
    }
    function dibujar() {
      lienzo.limpiar();
      const { log, vars, ks, logF, alfa } = dato;
      dibujarRed(lienzo, alfa.red, dato.pos, { plaza: (p) => (p.id !== alfa.red.ini && p.id !== alfa.red.fin && !NOMBRES_REAL.has(p.nombre) ? { anillo: C.s8 } : {}) });
      const top = vars.slice(0, 8);
      lista.replaceChildren(...top.map((v) => {
        const real = CLAVES_REAL.has(v.clave), fuera = !ks.has(v.clave);
        const col = fuera ? C.apagado : real ? C.s6 : C.s4;
        return VIZ.el('div', null, VIZ.el('span', { style: { color: col, fontWeight: '600' } }, fuera ? '✂' : real ? '✓' : '·'), `  ${v.traza.join('')}  ×${v.n}  (${VIZ.fmt((100 * v.n) / log.length, 2)} %)${real ? '' : '  ruido'}`);
      }), ...(vars.length > 8 ? [VIZ.el('div', { style: { color: C.apagado } }, `… y ${vars.length - 8} variantes más`)] : []));
      caja.replaceChildren(tablaHuella(alfa.huella, ALFA_REAL.huella));
      const ruidosos = log.filter((c) => !CLAVES_REAL.has(P.trazaDe(c).join('›'))).length;
      const mal = celdasMal(alfa.huella, ALFA_REAL.huella);
      const nombres = new Set(alfa.red.plazas.map((p) => p.nombre));
      const sobran = [...nombres].filter((x) => !NOMBRES_REAL.has(x)).length, faltan = [...NOMBRES_REAL].filter((x) => !nombres.has(x)).length;
      const fit = P.media(P.variantes(REAL).map((v) => P.reproducir(alfa.red, v.traza).fitness));
      registro.textContent = !sobran && !faltan ? 'α recuperó exactamente el modelo real.'
        : `La red tiene ${sobran} plaza(s) que no existen en el proceso real y le faltan ${faltan}; ${mal} celda(s) de la huella difieren.`;
      lectura.set([
        ['casos con ruido real', `${ruidosos} de ${log.length}`],
        ['variantes (tras filtrar)', `${vars.length} (${ks.size})`],
        ['casos usados por α', String(logF.length)],
        ['celdas de la huella erróneas', String(mal)],
        ['plazas espurias / perdidas', `${sobran} / ${faltan}`],
        ['fitness medio de las 4 variantes reales', VIZ.fmt(fit, 3)],
      ]);
    }
    lienzo.alDibujar = () => dato && dibujar();
    calcular();
  }

  /* ---------- Fig. 2: incompletitud ---------- */

  const SERIES2 = {
    eleccion: ['Elección entre 3 ramas', P.sec(A('a'), P.xor([A('b'), A('c'), A('d')]), A('e'))],
    par3: ['Paralelo de 3 actividades (6 órdenes)', P.sec(A('a'), P.y(A('b'), A('c'), A('d')), A('e'))],
    par4: ['Paralelo de 4 actividades (24 órdenes)', P.sec(A('a'), P.y(A('b'), A('c'), A('d'), A('e')), A('f'))],
    mixto: ['Paralelo y elección', P.sec(A('a'), P.y(A('b'), A('c')), P.xor([A('d'), A('e')]), A('f'))],
  };
  const clavesPares = (log) => {
    const s = new Set();
    for (const c of log) {
      const t = P.trazaDe(c);
      s.add('I' + t[0]); s.add('F' + t[t.length - 1]);
      for (let i = 0; i + 1 < t.length; i++) s.add(t[i] + t[i + 1]);
    }
    return s;
  };

  function montarCompletitud(cuerpo) {
    let clave = 'par3', semilla = 1, N = 80, R = 40, datos = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Proceso real', opciones: Object.entries(SERIES2).map(([k, v]) => [k, v[0]]), valor: clave, alCambiar: (v) => { clave = v; calcular(); } });
    ctl.rango({ etiqueta: 'Corridas simuladas', min: 10, max: 100, paso: 10, valor: R, alCambiar: (v) => { R = v; calcular(); } });
    ctl.boton('Nuevas corridas', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 250, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['cobertura', 'pares a > b ya observados (media)', C.s1], ['exacto', 'corridas donde α ya da el modelo exacto', C.s2]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada corrida simula 80 casos del proceso real y mide, tras 1, 2, 3… casos, qué parte de las sucesiones directas posibles ya se vio. Pase el cursor por la gráfica. Con paralelismo hacen falta muchos más casos que con una elección.');

    function calcular() {
      const [, arbol] = SERIES2[clave];
      const verdad = clavesPares(P.simular(arbol, 4000, 99, { espera: 1 }));
      const cob = new Array(N).fill(0), ex = new Array(N).fill(0);
      for (let r = 0; r < R; r++) {
        const log = P.simular(arbol, N, semilla * 1009 + r * 17 + 3, { espera: 1 });
        const vistos = new Set();
        for (let i = 0; i < N; i++) {
          for (const k of clavesPares([log[i]])) vistos.add(k);
          cob[i] += vistos.size / verdad.size;
          if (vistos.size === verdad.size) ex[i]++;
        }
      }
      datos = { verdad: verdad.size, cobertura: cob.map((v) => v / R), exacto: ex.map((v) => v / R) };
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 1, xmax: N, ymin: 0, ymax: 1.02 }, { etiquetaX: 'casos en el registro', etiquetaY: 'fracción', formatoY: (v) => VIZ.fmt(v, 2) });
      plano.ejes();
      for (const [k, , c] of SER) VIZ.trazar(ctx, plano, datos[k].map((v, i) => [i + 1, v]), c, 2);
      if (hover >= 0) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plano.sx(hover + 1) + 0.5, plano.y1); ctx.lineTo(plano.sx(hover + 1) + 0.5, plano.y0); ctx.stroke();
        for (const [k, , c] of SER) VIZ.marcador(ctx, plano.sx(hover + 1), plano.sy(datos[k][hover]), c, 4);
      }
      const primero = (q) => { const i = datos.exacto.findIndex((v) => v >= q); return i < 0 ? `más de ${N}` : String(i + 1); };
      lectura.set([
        ['sucesiones directas posibles (incl. inicios y finales)', String(datos.verdad)],
        ['casos para que la mitad de las corridas sea exacta', primero(0.5)],
        ['casos para el 90 % de las corridas', primero(0.9)],
        ['pares vistos tras 10 casos', `${VIZ.fmt(100 * datos.cobertura[9], 3)} %`],
      ]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      hover = Math.max(0, Math.min(N - 1, Math.round(plano.ix(x)) - 1));
      dibujar();
      tip.mostrar(x, y, `casos = <b>${hover + 1}</b>` + SER.map(([k, t, c]) => VIZ.filaTooltip(c, t.split(' (')[0], VIZ.fmt(datos[k][hover], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (datos) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('noise-and-incompleteness', {
    intro: String.raw`
      <p>Un registro real casi nunca es una muestra perfecta del proceso. Tiene <strong>ruido</strong> (eventos mal registrados, trazas truncadas, pasos
      intercambiados) y es <strong>incompleto</strong>: algunos comportamientos posibles simplemente todavía no ocurrieron. El algoritmo α, en cambio, supone que cada
      par observado es verdad y que todo par posible fue observado.</p>
      <p>Aquí se ve la consecuencia: un solo orden raro convierte una causalidad en paralelo, y unas pocas trazas de menos dejan un paralelo convertido
      en una secuencia. La pregunta práctica es cuántos casos hacen falta y cómo limpiar antes de descubrir.</p>`,
    visualizaciones: [
      {
        titulo: 'Ruido: una traza rara cambia la red',
        descripcion: 'Suba el ruido y mire cómo aparecen plazas que no existen en el proceso real y celdas erróneas en la huella. Luego suba el filtro de variantes raras para que α vuelva al modelo correcto.',
        montar: montarRuido,
      },
      {
        titulo: 'Incompletitud: cuántos casos bastan',
        descripcion: 'Curva de pares a > b ya vistos y de corridas en que α ya reconstruye el modelo exacto. Compare una elección con paralelos de 3 y de 4 actividades.',
        montar: montarCompletitud,
      },
    ],
    teoria: String.raw`
      <h2>Ruido</h2>
      <p>El <strong>ruido</strong> son trazas o eventos que no corresponden al comportamiento normal del proceso: errores de captura, eventos fuera de orden por relojes
      desincronizados, excepciones, casos truncados por el corte del extracto (véase <a href="tema.html?id=event-log-quality">calidad de registros</a>). Como α solo usa
      la <em>presencia</em> de un par \(a &gt; b\) y no su frecuencia, el efecto es desproporcionado:</p>
      <ul>
        <li>Una traza con \(b\) y \(c\) intercambiados añade \(c &gt; b\) y puede convertir \(b \to c\) en \(b \parallel c\), eliminando la plaza entre ellos.</li>
        <li>Un evento borrado crea una sucesión directa nueva \(a &gt; c\) que salta una actividad y vuelve la red más permisiva o inconsistente.</li>
        <li>Una sola traza con inicio o fin distinto añade elementos a \(T_I\) o \(T_O\).</li>
      </ul>
      <p>Si una fracción \(\varepsilon\) de los casos está alterada y cada alteración produce una variante nueva, con \(n\) casos habrá del orden de \(\varepsilon n\)
      variantes de ruido, cada una con frecuencia \(\approx 1/n\). Esa diferencia de frecuencia es lo que explotan los filtros.</p>
      <h2>Cómo se maneja</h2>
      <ul>
        <li><strong>Filtrar antes de descubrir</strong>: descartar variantes cuya frecuencia relativa es menor que un umbral, como en la figura. Funciona mientras el ruido no repita siempre la misma variante.</li>
        <li><strong>Umbrales de frecuencia</strong> en el algoritmo: el <a href="tema.html?id=heuristic-miner">minero heurístico</a> exige que una dependencia \(a \Rightarrow b\) tenga una medida alta, no solo que exista.</li>
        <li><strong>Descubrimiento robusto</strong>: el <a href="tema.html?id=inductive-miner">minero inductivo</a> con filtros y el <a href="tema.html?id=split-miner">Split Miner</a> recortan aristas poco frecuentes.</li>
      </ul>
      <h2>Incompletitud</h2>
      <p>Un registro es <strong>completo con respecto a \(&gt;_L\)</strong> si contiene toda sucesión directa que el proceso permite: para todo \(a, b\) con \(a &gt; b\) posible en el modelo, existe alguna traza con \(\langle \dots, a, b, \dots \rangle\).
      Es la condición que pide α. Es mucho menos que ver todas las trazas: un paralelo de \(k\) actividades tiene \(k!\) órdenes, pero solo hace falta ver cada par consecutivo
      posible, que son \(k(k-1)\) pares.</p>
      <p>Aun así, el número de casos necesario crece. Si los \(k!\) órdenes de un paralelo fuesen equiprobables, una sucesión directa concreta \(a &gt; b\) aparece en una traza con
      probabilidad \(\dfrac{(k-1)!}{k!} = \dfrac{1}{k}\) (se pegan \(a\) y \(b\) y se permutan \(k-1\) bloques). Hay \(k(k-1)\) pares que ver, de modo que, como en el problema del coleccionista de
      cupones, hacen falta del orden de \(k \ln\bigl(k(k-1)\bigr)\) trazas; la figura lo mide por simulación para \(k = 3\) y \(k = 4\).</p>
      <div class="recuadro"><p><strong>Nota.</strong> Estas simulaciones asumen que todos los órdenes ocurren con la misma frecuencia. En procesos reales, algunos órdenes casi nunca se dan
      (un cliente siempre paga antes de que se despache) y la completitud efectiva puede tardar muchísimo más.</p></div>
      <h2>Efecto sobre el modelo</h2>
      <p>La incompletitud produce el error contrario al ruido: un paralelo observado en un solo orden se interpreta como secuencia, y una elección con una rama sin ver desaparece. El
      modelo descubierto tiene <em>buen ajuste</em> pero <em>poca generalización</em>: acepta menos de lo que el proceso permite. Medir esa diferencia con casos no usados para descubrir
      es la idea de la validación cruzada en minería de procesos; véase <a href="tema.html?id=fitness-precision">fitness y precisión</a>.</p>
      <h2>Conexiones</h2>
      <p>Ambos problemas vienen de que α opera sobre la <a href="tema.html?id=footprint-matrix">matriz de huellas</a> sin frecuencias. Esto, junto con
      <a href="tema.html?id=alpha-limitations">sus limitaciones estructurales</a>, motiva a los demás algoritmos del <a href="tema.html?id=process-discovery">descubrimiento</a>. Las trazas con un patrón
      infrecuente se analizan como <a href="tema.html?id=traces-and-variants">variantes</a>.</p>`,
  });
})();
