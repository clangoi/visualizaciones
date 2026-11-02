(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  // Proceso de referencia: a, luego b y c en paralelo, luego d o e, y por último f.
  const MUNDO = P.sec(P.act('a'), P.y(P.act('b'), P.act('c')), P.xor([P.act('d'), P.act('e')]), P.act('f'));
  // Modelo de referencia: el que descubre el algoritmo Alfa con un registro limpio.
  const RED = P.alfa(P.logSimple([['abcdf', 4], ['acbdf', 3], ['abcef', 2], ['acbef', 1]])).red;
  const POS = P.posDeRed(RED);
  const ACTS = 'abcdef';

  const PRESETS = [
    ['abcdf', 'ajusta perfectamente'],
    ['acbef', 'ajusta (otro orden y otra rama)'],
    ['abdf', 'falta c'],
    ['abcd', 'falta f (queda una ficha)'],
    ['abcdcf', 'c repetida'],
    ['adbcf', 'd antes de tiempo'],
    ['abcdef', 'd y e juntas'],
    ['bacdf', 'empieza por b'],
  ];

  const nombrePlaza = (p) => (p.id === 'ini' ? 'inicio' : p.id === 'fin' ? 'fin' : `entre {${p.A.join(',')}} y {${p.B.join(',')}}`);
  const plazaPorId = (id) => RED.plazas.find((p) => p.id === id);

  // Reproduce cada variante del registro y suma, por plaza, las fichas faltantes y las sobrantes.
  function diagnostico(log) {
    const falt = {}, sobra = {};
    RED.plazas.forEach((p) => { falt[p.id] = 0; sobra[p.id] = 0; });
    const filas = [];
    let P_ = 0, C_ = 0, M_ = 0, R_ = 0, n = 0;
    for (const v of P.variantes(log)) {
      const r = P.reproducir(RED, v.traza);
      const ps = r.pasos;
      for (let i = 1; i < ps.length; i++) {
        ps[i].faltantes.forEach((id) => { falt[id] += v.n; });
        if (ps[i].final && ps[i].m > ps[i - 1].m) falt[RED.fin] += v.n;
      }
      const fin = ps[ps.length - 1].marcado;
      Object.keys(fin).forEach((id) => { if (fin[id] > 0) sobra[id] += v.n * fin[id]; });
      P_ += v.n * r.p; C_ += v.n * r.c; M_ += v.n * r.m; R_ += v.n * r.r; n += v.n;
      filas.push({ v, r });
    }
    const fitness = 0.5 * (1 - M_ / Math.max(1, C_)) + 0.5 * (1 - R_ / Math.max(1, P_));
    return { falt, sobra, filas, P_, C_, M_, R_, n, fitness };
  }

  /* ---------- Fig. 1: reproducción paso a paso ---------- */

  function montarPasoAPaso(cuerpo) {
    let texto = 'abdf', res = null, k = 0;
    const ctl = VIZ.controles(cuerpo);
    const fijar = (t) => {
      texto = [...t.toLowerCase()].filter((c) => ACTS.includes(c)).join('').slice(0, 14);
      ent.valor = texto;
      rep.reiniciar();
    };
    ctl.selector({
      etiqueta: 'Traza de ejemplo',
      opciones: PRESETS.map(([t, d]) => [t, `${t} · ${d}`]),
      valor: texto,
      alCambiar: (v) => fijar(v),
    });
    const ent = ctl.texto({ etiqueta: 'O escriba una traza (letras a–f)', valor: texto, alCambiar: fijar, alEnter: fijar });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'transición que se dispara', forma: 'cuadro' },
      { color: C.s8, texto: 'ficha faltante creada para poder disparar', forma: 'punto' },
      { color: C.s4, texto: 'ficha sobrante al terminar', forma: 'punto' },
    ]);
    const fichas = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(fichas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija una traza o escríbala. Con «Un paso» avanza un evento: la ficha negra es un token; el anillo rojo marca dónde hubo que inventar una ficha. Al final se consume la ficha de «fin» y se cuenta lo que quedó.');

    function iniciar() {
      res = P.reproducir(RED, [...texto]);
      k = 0;
      return (function* () {
        for (let i = 1; i < res.pasos.length; i++) { k = i; yield; }
      })();
    }

    function narrar(s, previo) {
      if (k === 0) return 'Marcado inicial: una ficha en «inicio». Ya se produjo 1 ficha (p = 1).';
      if (s.final) {
        const finFalta = s.m > previo.m;
        return `Fin de la traza: se consume la ficha de «fin»${finFalta ? ' (no estaba: falta una ficha más)' : ''}. Quedan ${s.r} ficha(s) sin consumir (r = ${s.r}).`;
      }
      if (s.sinTransicion) return `«${s.act}» no existe en el modelo: no hay transición que disparar, el evento se ignora.`;
      const t = RED.trans.find((x) => x.id === s.trans);
      const nin = P.entradas(RED, t.id).length, nout = P.salidas(RED, t.id).length;
      const falta = s.faltantes.length
        ? ` Faltaba ${s.faltantes.length === 1 ? 'una ficha' : s.faltantes.length + ' fichas'} en ${s.faltantes.map((id) => `«${nombrePlaza(plazaPorId(id))}»`).join(' y ')}: se crea y se cuenta como faltante.`
        : ' Todas sus plazas de entrada tenían ficha.';
      return `Dispara «${s.act}»: consume ${nin} y produce ${nout}.${falta}`;
    }

    function dibujar() {
      if (!res) return;
      const s = res.pasos[k], previo = res.pasos[Math.max(0, k - 1)];
      lienzo.limpiar();
      const finFalta = s.final && s.m > previo.m;
      const { nodos, aristas } = P.nodosDeRed(RED, s.marcado, {
        plaza: (p) => ({ anillo: s.faltantes.includes(p.id) || (finFalta && p.id === RED.fin) ? C.s8 : s.final && (s.marcado[p.id] || 0) > 0 ? C.s4 : null }),
        trans: (t) => ({
          relleno: t.id === s.trans ? C.s2 : C.superficie,
          colorTexto: t.id === s.trans ? C.sobre : C.tinta,
          insignia: t.id === s.trans && s.faltantes.length ? `falta ×${s.faltantes.length}` : null,
          colorInsignia: C.s8,
        }),
      });
      P.dibujarGrafo(lienzo, nodos, aristas, POS);
      fichas.replaceChildren(VIZ.el('span', { class: 'fichas-titulo' }, 'Traza:'),
        ...(texto.length ? [...texto].map((a, i) => VIZ.ficha(a, i + 1 < k || (s.final && i + 1 <= texto.length) ? { color: C.tinta } : i + 1 === k ? { color: C.s2, fondo: C.s2, tinta: C.sobre } : { color: C.inactivo, tinta: C.apagado })) : [VIZ.el('span', { class: 'fichas-vacio' }, '(vacía)')]));
      registro.textContent = narrar(s, previo);
      const f = s.final ? res.fitness : null;
      lectura.set([
        ['producidas p', String(s.p)],
        ['consumidas c', String(s.c)],
        ['faltantes m', String(s.m)],
        ['sobrantes r', s.final ? String(s.r) : '—'],
        ['fitness', f === null ? '—' : VIZ.fmt(f, 3)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: fitness de un registro completo ---------- */

  function montarRegistro(cuerpo) {
    let ruido = 0.15, nCasos = 120, semilla = 3, sel = -1, diag = null, vars = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.6, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; sel = -1; calcular(); } });
    ctl.rango({ etiqueta: 'Casos en el registro', min: 20, max: 300, paso: 10, valor: nCasos, alCambiar: (v) => { nCasos = v; sel = -1; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; sel = -1; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'variante que ajusta perfecto (fitness 1)', forma: 'cuadro' },
      { color: C.s2, texto: 'variante con desviaciones', forma: 'cuadro' },
      { color: C.s1, texto: 'variante elegida (clic)', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada columna es una variante: su ancho es la fracción de casos que la siguen y su alto, su fitness. Suba el ruido y vea cómo aparecen columnas bajas y estrechas. Haga clic en una columna para ver sus conteos p, c, m, r.');

    function calcular() {
      const log = P.simular(MUNDO, nCasos, semilla, { ruido });
      diag = diagnostico(log);
      vars = diag.filas;
      dibujar();
    }

    function dibujar() {
      if (!diag) return;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 1.05 }, {
        etiquetaX: '% de casos (ancho = frecuencia de la variante)', etiquetaY: 'fitness de la variante',
        formatoX: (v) => v + ' %', ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => VIZ.fmt(v, 2),
      });
      plano.ejes();
      const { ctx } = lienzo;
      geo = [];
      let acum = 0;
      vars.forEach((f, i) => {
        const w = 100 * f.v.n / diag.n;
        const x0 = plano.sx(acum), x1 = plano.sx(acum + w), top = plano.sy(f.r.fitness);
        const perfecto = f.r.fitness > 0.9999;
        ctx.fillStyle = i === sel ? C.s1 : perfecto ? C.s6 : C.s2;
        const ancho = Math.max(1, x1 - x0 - 2);
        ctx.beginPath(); ctx.roundRect(x0 + 1, top, ancho, plano.y0 - top, [4, 4, 0, 0]); ctx.fill();
        if (ancho > 36) {
          ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(f.v.clave.replace(/›/g, ''), (x0 + x1) / 2, top + 4);
        }
        geo.push({ x0, x1, i });
        acum += w;
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const perf = vars.filter((f) => f.r.fitness > 0.9999).reduce((s, f) => s + f.v.n, 0);
      lectura.set([
        ['p (producidas)', VIZ.entero(diag.P_)],
        ['c (consumidas)', VIZ.entero(diag.C_)],
        ['m (faltantes)', VIZ.entero(diag.M_)],
        ['r (sobrantes)', VIZ.entero(diag.R_)],
        ['fitness del registro', VIZ.fmt(diag.fitness, 3)],
        ['casos sin desviación', `${perf} de ${diag.n}`],
      ]);
      if (sel >= 0) {
        const f = vars[sel];
        registro.textContent = `Variante «${f.v.clave.replace(/›/g, '')}», ${f.v.n} caso(s): p = ${f.r.p}, c = ${f.r.c}, m = ${f.r.m}, r = ${f.r.r}; fitness = 0.5·(1 − ${f.r.m}/${f.r.c}) + 0.5·(1 − ${f.r.r}/${f.r.p}) = ${VIZ.fmt(f.r.fitness, 3)}.`;
      } else {
        registro.textContent = `Fitness del registro = 0.5·(1 − ${diag.M_}/${diag.C_}) + 0.5·(1 − ${diag.R_}/${diag.P_}) = ${VIZ.fmt(diag.fitness, 3)}. Se suman los contadores de todos los casos antes de dividir, no se promedian los fitness.`;
      }
    }
    lienzo.alDibujar = dibujar;
    const buscar = (x) => geo.find((g) => x >= g.x0 && x <= g.x1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = buscar(x);
      if (!g) return tip.ocultar();
      const f = vars[g.i];
      tip.mostrar(x, y, `<b>${f.v.clave.replace(/›/g, '')}</b> · ${f.v.n} caso(s)<br>p ${f.r.p} · c ${f.r.c} · m ${f.r.m} · r ${f.r.r}<br>fitness <b>${VIZ.fmt(f.r.fitness, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const g = buscar(lienzo.posicion(ev).x);
      sel = g && g.i !== sel ? g.i : -1;
      dibujar();
    });
    calcular();
  }

  /* ---------- Fig. 3: dónde se acumulan los problemas ---------- */

  function montarMapa(cuerpo) {
    let ruido = 0.35, semilla = 5, modo = 'ambos', sel = null, diag = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({
      etiqueta: 'Mostrar', valor: modo,
      opciones: [['ambos', 'faltantes + sobrantes'], ['falt', 'solo faltantes (m)'], ['sobra', 'solo sobrantes (r)']],
      alCambiar: (v) => { modo = v; dibujar(); },
    });
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.8, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0.15)), texto: 'pocas fichas problemáticas', forma: 'cuadro' },
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'muchas fichas problemáticas', forma: 'cuadro' },
      { color: C.s1, texto: 'plaza elegida (clic)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El color de cada plaza indica cuántas fichas faltantes o sobrantes se acumularon allí en todo el registro (el número es el total). Haga clic en una plaza para ver qué variantes la causan; pase el cursor para ver el detalle.');

    function calcular() {
      diag = diagnostico(P.simular(MUNDO, 150, semilla, { ruido }));
      dibujar();
    }
    const valor = (id) => (modo === 'falt' ? diag.falt[id] : modo === 'sobra' ? diag.sobra[id] : diag.falt[id] + diag.sobra[id]);

    function dibujar() {
      if (!diag) return;
      lienzo.limpiar();
      const mx = Math.max(1, ...RED.plazas.map((p) => valor(p.id)));
      const { nodos, aristas } = P.nodosDeRed(RED, {}, {
        plaza: (p) => {
          const v = valor(p.id);
          return { relleno: v > 0 ? VIZ.css(VIZ.enRampa(0.15 + 0.85 * v / mx)) : C.superficie, anillo: sel === p.id ? C.s1 : null, insignia: v > 0 ? String(v) : null, colorInsignia: C.tinta2 };
        },
      });
      geo = P.dibujarGrafo(lienzo, nodos, aristas, POS);
      lectura.set([
        ['fichas faltantes m', VIZ.entero(diag.M_)],
        ['fichas sobrantes r', VIZ.entero(diag.R_)],
        ['plaza más afectada', (() => { const id = RED.plazas.map((p) => p.id).sort((a, b) => valor(b) - valor(a))[0]; return valor(id) ? nombrePlaza(plazaPorId(id)) : '—'; })()],
        ['fitness del registro', VIZ.fmt(diag.fitness, 3)],
      ]);
      if (sel) {
        const causas = diag.filas.map(({ v, r }) => {
          let f = 0, s = 0;
          for (let i = 1; i < r.pasos.length; i++) {
            if (r.pasos[i].faltantes.includes(sel)) f++;
            if (r.pasos[i].final && sel === RED.fin && r.pasos[i].m > r.pasos[i - 1].m) f++;
          }
          s = r.pasos[r.pasos.length - 1].marcado[sel] || 0;
          return { clave: v.clave.replace(/›/g, ''), n: v.n, f, s };
        }).filter((c) => c.f || c.s).sort((a, b) => b.n - a.n).slice(0, 3);
        registro.textContent = causas.length
          ? `Plaza «${nombrePlaza(plazaPorId(sel))}»: la afectan sobre todo ${causas.map((c) => `«${c.clave}» (${c.n} caso(s), ${c.f ? 'falta ficha' : 'sobra ficha'})`).join(', ')}.`
          : `Plaza «${nombrePlaza(plazaPorId(sel))}»: ningún caso deja fichas faltantes ni sobrantes aquí.`;
      } else registro.textContent = 'Haga clic en una plaza para ver qué variantes la afectan.';
    }
    lienzo.alDibujar = dibujar;
    const sobre = (ev) => {
      const { x, y } = lienzo.posicion(ev), n = geo ? P.nodoEn(geo, x, y) : null;
      return { x, y, n: n && n.tipo === 'plaza' ? n : null };
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, n } = sobre(ev);
      if (!n || !diag) return tip.ocultar();
      tip.mostrar(x, y, `plaza <b>${nombrePlaza(plazaPorId(n.id))}</b><br>faltantes <b>${diag.falt[n.id]}</b><br>sobrantes <b>${diag.sobra[n.id]}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { n } = sobre(ev);
      sel = n && n.id !== sel ? n.id : null;
      dibujar();
    });
    calcular();
  }

  VIZ.registrarTema('token-based-replay', {
    intro: String.raw`
      <p>La <strong>reproducción de fichas</strong> (<em>token-based replay</em>) es la forma más directa de comprobar si un registro cumple un modelo:
      se toma cada traza y se «juega» sobre la red de Petri, disparando en orden las transiciones de sus eventos. Si una transición no está habilitada,
      se <em>inventa</em> la ficha que faltaba y se anota; al terminar, las fichas que sobran también se anotan.</p>
      <p>Cuatro contadores resumen la historia: fichas producidas, consumidas, faltantes y restantes. De ellos sale el <em>fitness</em>, un número entre 0 y 1
      que dice qué tanto del comportamiento observado cabe en el modelo, y además se puede ver <em>dónde</em> de la red se acumulan los problemas.</p>`,
    visualizaciones: [
      {
        titulo: 'Reproducción de una traza',
        descripcion: 'Avance evento por evento sobre la red y vea cuándo se crea una ficha faltante (anillo rojo) y cuántas sobran al final. Pruebe «abdf» (falta c), «abcd» (falta f) y «abcdddf» (d repetida) y compare sus contadores m y r.',
        montar: montarPasoAPaso,
      },
      {
        titulo: 'Fitness de un registro completo',
        descripcion: 'Un registro simulado con ruido: una columna por variante, de ancho proporcional a su frecuencia. Pruebe 0 % de ruido (todo ajusta) y luego 40 %: el fitness del registro cae poco porque las variantes desviadas son estrechas.',
        montar: montarRegistro,
      },
      {
        titulo: 'Mapa de problemas sobre el modelo',
        descripcion: 'Las fichas faltantes y sobrantes de todo el registro, acumuladas por plaza. Cambie entre faltantes y sobrantes y haga clic en una plaza oscura: las variantes que la causan suelen ser omisiones o intercambios de actividades vecinas.',
        montar: montarMapa,
      },
    ],
    teoria: String.raw`
      <h2>Comprobación de conformidad</h2>
      <p>La <em>comprobación de conformidad</em> (<em>conformance checking</em>) compara un registro de eventos con un modelo y responde dos preguntas:
      ¿cuánto de lo observado permite el modelo? y ¿dónde y cómo difieren? Es el contrapunto del <a href="tema.html?id=process-discovery">descubrimiento</a>:
      allí se construye el modelo desde el registro; aquí se contrastan ambos. Una versión más fina que la reproducción de fichas son los
      <a href="tema.html?id=alignments">alineamientos</a>.</p>
      <h2>Reproducción de fichas</h2>
      <p>Sea \(N\) una red de Petri con marcado inicial \([\text{inicio}]\) y marcado final \([\text{fin}]\), y \(\sigma = \langle a_1,\dots,a_n\rangle\) una traza.
      Cada transición visible está etiquetada con una actividad.</p>
      <pre><code>p ← 1;  c ← 0;  m ← 0           (la ficha inicial cuenta como producida)
para cada evento a de σ:
    t ← transición con etiqueta a   (si no existe, ignorar el evento)
    para cada plaza de entrada q de t:
        si q no tiene ficha: crear una ficha en q;  m ← m + 1
    consumir una ficha de cada entrada;       c ← c + |•t|
    producir una ficha en cada salida;        p ← p + |t•|
consumir la ficha de «fin» (si falta, m ← m + 1);  c ← c + 1
r ← fichas que quedaron en toda la red</code></pre>
      <h2>Fitness</h2>
      \[ \text{fitness}(\sigma) = \tfrac12\left(1 - \frac{m}{c}\right) + \tfrac12\left(1 - \frac{r}{p}\right). \]
      <p>Si no hay faltantes ni sobrantes (\(m = r = 0\)), el fitness es 1 y la traza es reproducible. Para un registro \(L\) se <strong>suman</strong> los contadores de todos los casos
      (cada variante tantas veces como casos tenga) antes de dividir:</p>
      \[ \text{fitness}(L) = \tfrac12\left(1 - \frac{\sum m}{\sum c}\right) + \tfrac12\left(1 - \frac{\sum r}{\sum p}\right). \]
      <h2>Ejemplo</h2>
      <p>Con el modelo de las figuras (a, luego b y c en paralelo, luego d o e, y f), la traza \(\langle a,b,d,f\rangle\) produce \(p = 6\) y consume \(c = 6\) fichas.
      Al disparar \(d\) falta la ficha de la plaza que debía dejar \(c\) (\(m = 1\)); como \(c\) nunca se ejecutó, esa plaza conserva una ficha al final (\(r = 1\)). Entonces
      \(\text{fitness} = \tfrac12(1 - \tfrac16) + \tfrac12(1 - \tfrac16) \approx 0{,}833\).
      La omisión de una actividad deja siempre un par faltante/sobrante; un orden equivocado puede dejar varios.</p>
      <h2>Alcances y límites</h2>
      <ul>
        <li>Es muy rápida (lineal en la longitud de la traza), por lo que escala a registros grandes y localiza el problema en plazas concretas.</li>
        <li>Con transiciones silenciosas o duplicadas la reproducción puede <em>engañar</em>: crear fichas para saltar un bloque deja caminos «gratis». Por eso hay trazas muy desviadas con fitness alto; los <a href="tema.html?id=alignments">alineamientos</a> dan el costo mínimo exacto.</li>
        <li>Mide solo una dimensión de calidad. Un modelo que lo permite todo tiene fitness 1; vea <a href="tema.html?id=fitness-precision">fitness y precisión</a>.</li>
        <li>Agregado sobre todos los casos, el mapa de plazas con más fichas faltantes o sobrantes alimenta el <a href="tema.html?id=deviation-analysis">análisis de desviaciones</a>. El modelo reproducido suele ser una red de Petri como las de <a href="tema.html?id=petri-nets">redes de Petri</a>.</li>
      </ul>`,
  });
})();
