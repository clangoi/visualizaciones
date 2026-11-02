(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Modelos, fitness y precisión (ayudantes de este tema) ---------- */

  const ACTS = 'abcdef';
  // Proceso de referencia: a, luego b y c en paralelo, luego d o e, y por último f.
  const MUNDO = P.sec(P.act('a'), P.y(P.act('b'), P.act('c')), P.xor([P.act('d'), P.act('e')]), P.act('f'));
  const VARIANTES_MUNDO = [['abcdf', 4], ['acbdf', 3], ['abcef', 2], ['acbef', 1]];

  // Variantes de un registro como [{ s: 'abcdf', n }].
  const variantesDe = (log) => P.variantes(log).map((v) => ({ s: v.traza.join(''), n: v.n }));

  // Costo mínimo de alinear la traza `a` con la palabra `b` (movimientos de registro y de modelo de costo 1).
  function distancia(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, a[i - 1] === b[j - 1] ? prev[j - 1] : Infinity);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Un modelo expone: ini (estado), paso(estado, a) → estado | null, habil(estado) → { acts, fin }, lenguaje (palabras o null si es infinito y lo permite todo).
  function modeloTrazas(palabras) {
    const pref = new Set(), comp = new Set(palabras);
    palabras.forEach((w) => { for (let i = 0; i <= w.length; i++) pref.add(w.slice(0, i)); });
    return {
      ini: '', lenguaje: [...comp],
      paso: (s, a) => (pref.has(s + a) ? s + a : null),
      habil: (s) => ({ acts: [...ACTS].filter((a) => pref.has(s + a)), fin: comp.has(s) }),
    };
  }
  function lenguajeRed(red, tope = 11, cap = 300) {
    const out = [];
    const final = (m) => (m[red.fin] || 0) === 1 && Object.keys(m).every((k) => k === red.fin || !m[k]);
    (function dfs(m, w) {
      if (out.length >= cap) return;
      if (final(m)) out.push(w);
      if (w.length >= tope) return;
      for (const t of red.trans) if (P.habilitada(red, m, t.id)) dfs(P.disparar(red, m, t.id), w + t.nombre);
    })(P.marcadoInicial(red), '');
    return [...new Set(out)];
  }
  function modeloRed(red) {
    const final = (m) => (m[red.fin] || 0) === 1 && Object.keys(m).every((k) => k === red.fin || !m[k]);
    return {
      red, ini: P.marcadoInicial(red), lenguaje: lenguajeRed(red),
      paso: (m, a) => { const t = red.trans.find((x) => x.nombre === a); return t && P.habilitada(red, m, t.id) ? P.disparar(red, m, t.id) : null; },
      habil: (m) => ({ acts: [...new Set(red.trans.filter((t) => P.habilitada(red, m, t.id)).map((t) => t.nombre))], fin: final(m) }),
    };
  }
  // «Flower model»: cualquier secuencia de actividades, en cualquier orden y cantidad.
  const modeloFlor = () => ({ ini: '', lenguaje: null, paso: (s) => s, habil: () => ({ acts: [...ACTS], fin: true }) });
  const modeloExacto = () => modeloRed(P.alfa(P.logSimple(VARIANTES_MUNDO)).red);

  // Fitness por alineamientos: 1 − costo total / costo del peor alineamiento posible.
  function fitnessDe(modelo, vars) {
    if (!modelo.lenguaje) return 1;
    const palabras = modelo.lenguaje, minLen = palabras.length ? Math.min(...palabras.map((w) => w.length)) : 0;
    let costo = 0, peor = 0;
    for (const v of vars) {
      const c = palabras.length ? Math.min(...palabras.map((w) => (w === v.s ? 0 : distancia(v.s, w)))) : v.s.length;
      costo += c * v.n; peor += (v.s.length + minLen) * v.n;
    }
    return peor ? 1 - costo / peor : 1;
  }

  // Precisión por «aristas que escapan» (ETC): en cada prefijo del registro se compara lo que el modelo habilita con lo que el registro hizo.
  // Devuelve { precision, prefijos: Map(prefijo → { n, obs, ok, E, esc }) }.
  function precisionDe(modelo, vars) {
    const mapa = new Map();
    for (const v of vars) {
      let estado = modelo.ini, ok = true;
      for (let i = 0; i <= v.s.length; i++) {
        const k = v.s.slice(0, i);
        let e = mapa.get(k);
        if (!e) { e = { n: 0, obs: new Set(), ok, E: null, esc: [] }; mapa.set(k, e); if (ok) { const h = modelo.habil(estado); e.E = [...h.acts, ...(h.fin ? ['■'] : [])]; } }
        e.n += v.n;
        const sig = i < v.s.length ? v.s[i] : '■';
        e.obs.add(sig);
        if (i < v.s.length && ok) { const st = modelo.paso(estado, v.s[i]); if (st === null) ok = false; else estado = st; }
      }
    }
    let esc = 0, hab = 0;
    for (const e of mapa.values()) {
      if (!e.ok) continue;
      e.esc = e.E.filter((x) => !e.obs.has(x));
      esc += e.n * e.esc.length; hab += e.n * e.E.length;
    }
    return { precision: hab ? 1 - esc / hab : 1, prefijos: mapa, esc, hab };
  }

  const EXACTO = modeloExacto();
  const NOMBRES = ['Restrictivo', 'Exacto', 'Permisivo'];
  const DESCR = [
    'Restrictivo: solo permite las variantes más frecuentes del registro. No permite nada de más (precisión alta) pero deja casos fuera (fitness bajo).',
    'Exacto: la red que descubre el algoritmo Alfa del proceso. Reproduce el comportamiento sin permitir mucho más.',
    'Permisivo (flower model): cualquier secuencia de actividades en cualquier orden. Reproduce todo (fitness 1) pero casi todo lo que permite nunca ocurre (precisión baja).',
  ];
  const modelos = (vars, k) => [modeloTrazas(vars.slice(0, k).map((v) => v.s)), EXACTO, modeloFlor()];
  const datosLog = (n, ruido, semilla) => variantesDe(P.simular(MUNDO, n, semilla, { ruido }));

  /* ---------- Fig. 1: tres modelos, dos medidas ---------- */

  function montarComparacion(cuerpo) {
    let k = 1, ruido = 0, semilla = 3, sel = -1, res = null, vars = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Variantes del modelo restrictivo', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.4, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'fitness: ¿el modelo reproduce el registro?', forma: 'cuadro' },
      { color: C.s2, texto: 'precisión: ¿el modelo evita permitir de más?', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Registro de 100 casos del proceso de referencia. Con una sola variante el restrictivo es preciso pero poco fiel; al subir las variantes su fitness llega a 1. Con ruido, el «exacto» pierde fitness (el registro tiene desvíos que el proceso no permite). Haga clic en un modelo para leer su descripción.');

    function calcular() {
      vars = datosLog(100, ruido, semilla);
      const ms = modelos(vars, k);
      res = ms.map((m) => { const f = fitnessDe(m, vars), p = precisionDe(m, vars).precision; return { f, p, F: f + p ? 2 * f * p / (f + p) : 0 }; });
      dibujar();
    }
    function dibujar() {
      if (!res) return;
      lienzo.limpiar();
      const plano = VIZ.plano(lienzo, { xmin: 0, xmax: 3, ymin: 0, ymax: 1.05 }, { ticksX: [], ticksY: [0, 0.25, 0.5, 0.75, 1], formatoY: (v) => VIZ.fmt(v, 2), margen: { inf: 30 } });
      plano.ejes();
      const { ctx } = lienzo;
      geo = [];
      const bw = Math.min(46, (plano.sx(1) - plano.sx(0)) * 0.3);
      res.forEach((r, i) => {
        const gx = plano.sx(i + 0.5);
        [[r.f, C.s1, -bw], [r.p, C.s2, 0]].forEach(([v, col, off]) => {
          const top = plano.sy(v);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(gx + off + 1, top, bw - 2, plano.y0 - top, [4, 4, 0, 0]); ctx.fill();
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(VIZ.fmt(v, 2), gx + off + bw / 2, top - 3);
        });
        if (i === sel) { ctx.strokeStyle = C.s7; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(gx - bw - 4, plano.y1, 2 * bw + 8, plano.y0 - plano.y1 + 2, 6); ctx.stroke(); }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textBaseline = 'top';
        ctx.fillText(i === 0 ? `${NOMBRES[0]} (${Math.min(k, vars.length)})` : NOMBRES[i], gx, plano.y0 + 8);
        geo.push({ x0: gx - bw - 4, x1: gx + bw + 4, i });
      });
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      const idx = sel >= 0 ? sel : 1;
      lectura.set([
        ['modelo', NOMBRES[idx]], ['fitness', VIZ.fmt(res[idx].f, 3)], ['precisión', VIZ.fmt(res[idx].p, 3)], ['media armónica', VIZ.fmt(res[idx].F, 3)],
        ['variantes en el registro', String(vars.length)],
      ]);
      registro.textContent = sel >= 0 ? DESCR[sel] : 'Ningún modelo elegido: se muestran las cifras del exacto. Haga clic en un modelo para ver qué permite.';
    }
    lienzo.alDibujar = dibujar;
    const sobre = (x) => geo.findIndex((g) => x >= g.x0 && x <= g.x1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), i = sobre(x);
      if (i < 0) return tip.ocultar();
      tip.mostrar(x, y, `<b>${NOMBRES[i]}</b>${VIZ.filaTooltip(C.s1, 'fitness', VIZ.fmt(res[i].f, 3))}${VIZ.filaTooltip(C.s2, 'precisión', VIZ.fmt(res[i].p, 3))}media armónica <b>${VIZ.fmt(res[i].F, 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const i = sobre(lienzo.posicion(ev).x); sel = i === sel ? -1 : i; dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: aristas que escapan por prefijo ---------- */

  function montarPrefijos(cuerpo) {
    let modo = 1, k = 2, nCasos = 12, ruido = 0, semilla = 2, calc = null, geo = null, maxCapa = 4;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Modelo', opciones: NOMBRES.map((t, i) => [String(i), t]), valor: String(modo), alCambiar: (v) => { modo = +v; calcular(); } });
    ctl.rango({ etiqueta: 'Variantes del restrictivo', min: 1, max: 8, valor: k, alCambiar: (v) => { k = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos en el registro', min: 3, max: 40, valor: nCasos, alCambiar: (v) => { nCasos = v; calcular(); } });
    ctl.rango({ etiqueta: 'Casos con ruido', min: 0, max: 0.3, paso: 0.05, valor: ruido, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ruido = v; calcular(); } });
    ctl.boton('Nuevos datos', () => { semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => Math.max(250, maxCapa * 46 + 50) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta, texto: 'prefijo sin aristas que escapan', forma: 'cuadro' },
      { color: VIZ.alfa(C.s8, 0.25), borde: C.tinta, texto: 'el modelo habilita algo que el registro no hizo (aristas que escapan)', forma: 'cuadro' },
      { color: C.neutro, borde: C.tinta, texto: 'el modelo no puede reproducir este prefijo (no se evalúa)', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada nodo es un prefijo del registro (el grosor de las flechas es la frecuencia) y el número rojo cuenta lo que el modelo habilita pero el registro nunca hizo. Cambie al permisivo y todos los nodos se tiñen; con el restrictivo no hay escapes. Haga clic en un nodo para ver el detalle de su prefijo.');
    let sel = null;

    function calcular() {
      const vars = datosLog(nCasos, ruido, semilla);
      const m = modelos(vars, k)[modo];
      const r = precisionDe(m, vars);
      const claves = [...r.prefijos.keys()];
      const aristas = claves.filter((c) => c.length).map((c) => [c.slice(0, -1), c]);
      const pos = P.disponer(claves, aristas);
      const capas = new Map();
      Object.values(pos).forEach((p) => capas.set(p.x, (capas.get(p.x) || 0) + 1));
      maxCapa = Math.max(...capas.values());
      calc = { r, claves, aristas, pos, n: vars.reduce((s, v) => s + v.n, 0), vars };
      sel = null;
      lienzo.ajustar(true);
    }
    function dibujar() {
      if (!calc) return;
      lienzo.limpiar();
      const { r } = calc;
      const nodos = calc.claves.map((c) => {
        const e = r.prefijos.get(c);
        return {
          id: c, tipo: c ? 'act' : 'inicio', etiqueta: c ? c[c.length - 1] : '',
          relleno: !e.ok ? C.neutro : e.esc.length ? VIZ.alfa(C.s8, Math.min(0.5, 0.12 + 0.1 * e.esc.length)) : C.superficie,
          anillo: c === sel ? C.s1 : null,
          insignia: e.ok && e.esc.length ? `+${e.esc.length}` : null, colorInsignia: C.s8,
        };
      });
      const aristas = calc.aristas.map(([de, a]) => ({ de, a, ancho: 1 + 4 * r.prefijos.get(a).n / calc.n, color: C.apagado }));
      geo = P.dibujarGrafo(lienzo, nodos, aristas, calc.pos, { margenX: 28, margenY: 34, fuente: 12 });
      const prec = r.precision;
      lectura.set([
        ['precisión', VIZ.fmt(prec, 3)], ['prefijos distintos', String(calc.claves.length)],
        ['aristas habilitadas', VIZ.entero(r.hab)], ['aristas que escapan', VIZ.entero(r.esc)],
      ]);
      const e = sel !== null ? r.prefijos.get(sel) : null;
      registro.textContent = e
        ? (e.ok
          ? `Prefijo «${sel || 'ε'}» (${e.n} caso(s)): el modelo habilita {${e.E.join(', ')}}; el registro siguió con {${[...e.obs].join(', ')}}. ${e.esc.length ? `Escapan {${e.esc.join(', ')}}.` : 'No escapa nada.'}  («■» significa «terminar».)`
          : `Prefijo «${sel}»: el modelo ya no puede reproducirlo, así que no se evalúa.`)
        : `Precisión = 1 − ${VIZ.entero(r.esc)}/${VIZ.entero(r.hab)} = ${VIZ.fmt(prec, 3)}. Cada caso aporta en cada prefijo las aristas habilitadas y las que escapan.`;
    }
    lienzo.alDibujar = dibujar;
    const sobre = (ev) => { const { x, y } = lienzo.posicion(ev); const n = geo ? P.nodoEn(geo, x, y) : null; return { x, y, n }; };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, n } = sobre(ev);
      if (!n) return tip.ocultar();
      const e = calc.r.prefijos.get(n.id);
      tip.mostrar(x, y, `prefijo <b>${n.id || 'ε'}</b> · ${e.n} caso(s)<br>${e.ok ? `habilitado: ${e.E.join(' ')}<br>observado: ${[...e.obs].join(' ')}<br>escapa: <b>${e.esc.join(' ') || 'nada'}</b>` : 'no reproducible por el modelo'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => { const { n } = sobre(ev); sel = n && n.id !== sel ? n.id : null; dibujar(); });
    calcular();
  }

  VIZ.registrarTema('fitness-precision', {
    intro: String.raw`
      <p>Un buen modelo de proceso debe cumplir dos promesas a la vez. Primero, <strong>reproducir</strong> lo que ocurrió: eso es el <em>fitness</em>.
      Segundo, <strong>no permitir mucho más</strong> de lo que ocurrió: eso es la <em>precisión</em>. Un modelo que solo describe el lunes pasado es muy preciso y casi inútil;
      uno que admite cualquier secuencia lo reproduce todo y no dice nada.</p>
      <p>Los dos extremos tienen nombre: el <em>modelo de trazas</em> (restrictivo) y el <em>flower model</em> (permisivo). Las figuras los comparan con el modelo exacto y muestran
      de dónde sale la precisión, prefijo por prefijo.</p>`,
    visualizaciones: [
      {
        titulo: 'Restrictivo, exacto y permisivo',
        descripcion: 'Tres modelos frente a un registro de 100 casos. Con 1 variante el restrictivo tiene precisión 1 y fitness cercano a 0,82; súbala hasta 4 y llega a 1. Luego agregue ruido: el exacto ya no tiene fitness 1, y el permisivo sigue en 1 con precisión baja.',
        montar: montarComparacion,
      },
      {
        titulo: 'Aristas que escapan por prefijo',
        descripcion: 'La precisión se calcula sobre el árbol de prefijos del registro: en cada nodo, el modelo habilita ciertas actividades y el registro hizo otras. Cambie al modelo permisivo y observe cuántos nodos acumulan escapes; con el restrictivo ninguno.',
        montar: montarPrefijos,
      },
    ],
    teoria: String.raw`
      <h2>Dos preguntas distintas</h2>
      <p>Sea \(L\) un registro (multiconjunto de trazas) y \(M\) un modelo con lenguaje \(\mathcal{L}(M)\) (el conjunto de trazas completas que permite).</p>
      <ul>
        <li><strong>Fitness</strong>: qué parte de \(L\) puede reproducir \(M\). Si \(L \subseteq \mathcal{L}(M)\), el fitness es 1. Se puede medir con la <a href="tema.html?id=token-based-replay">reproducción de fichas</a> o con <a href="tema.html?id=alignments">alineamientos</a>:
        \(\text{fitness}(L, M) = 1 - \dfrac{\sum_{\sigma \in L} \gamma^{*}(\sigma, M)}{\sum_{\sigma \in L} \big(|\sigma| + |w_{\min}|\big)}\).</li>
        <li><strong>Precisión</strong>: qué parte de lo que permite \(M\) aparece de verdad en \(L\). Si \(\mathcal{L}(M) \subseteq L\), la precisión es 1.</li>
      </ul>
      <h2>Precisión por aristas que escapan</h2>
      <p>La medida <em>ETC</em> (<em>escaping edges</em>) recorre todos los prefijos \(p\) del registro. Sea \(E_M(p)\) el conjunto de actividades que el modelo habilita tras reproducir \(p\) (más «terminar», si puede acabar allí) y \(O_L(p)\) el conjunto de las que el registro hizo realmente después de \(p\). Con \(f(p)\) la frecuencia del prefijo:</p>
      \[ \text{precisión}(L, M) = 1 - \frac{\sum_p f(p)\,\big|E_M(p) \setminus O_L(p)\big|}{\sum_p f(p)\,\big|E_M(p)\big|}. \]
      <pre><code>para cada prefijo p del registro (con su frecuencia f):
    E ← actividades habilitadas por el modelo tras p
    O ← actividades que siguen a p en el registro
    escapes ← escapes + f · |E − O|;  habilitadas ← habilitadas + f · |E|
devolver 1 − escapes / habilitadas</code></pre>
      <p>Los prefijos que el modelo no puede reproducir se omiten (en la práctica se usa el prefijo alineado), por lo que la precisión no castiga el mal fitness.</p>
      <h2>Los extremos</h2>
      <table>
        <tr><th>Modelo</th><th>Fitness</th><th>Precisión</th><th>Problema</th></tr>
        <tr><td>Modelo de trazas (solo las variantes vistas)</td><td>1</td><td>1</td><td>No generaliza: es el registro con otro nombre</td></tr>
        <tr><td>Solo las variantes más frecuentes</td><td>&lt; 1</td><td>1</td><td>Deja casos reales fuera</td></tr>
        <tr><td>Flower model</td><td>1</td><td>muy baja</td><td>No dice nada del orden</td></tr>
        <tr><td>Modelo exacto</td><td>cerca de 1</td><td>cerca de 1</td><td>Depende de la calidad del registro</td></tr>
      </table>
      <p>En la figura, el flower model sobre seis actividades habilita siete opciones (seis actividades y terminar) en cada prefijo, mientras el registro usa una o dos: casi todas escapan, por eso su precisión es de apenas 0,19.</p>
      <h2>Compromiso</h2>
      <p>Mejorar un lado empeora el otro: añadir comportamiento al modelo sube el fitness y baja la precisión, y quitarlo hace lo contrario. Por eso se reportan juntas o resumidas con su media armónica
      \(F = 2fp/(f+p)\). Con ruido o registros incompletos, además, el modelo que más se ajusta al registro puede ajustarse a sus errores: esa es la tercera dimensión,
      la <a href="tema.html?id=generalization-simplicity">generalización</a>, junto con la simplicidad. Un modelo debe además ser <a href="tema.html?id=soundness">correcto</a>
      para que estas medidas tengan sentido. Los modelos de ejemplo salen del <a href="tema.html?id=alpha-algorithm">algoritmo Alfa</a>.</p>`,
  });
})();
