(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Ayudantes ---------- */

  function leerTrazas(txt) {
    const pares = [];
    for (const tok of String(txt).toLowerCase().split(/[\s,;]+/)) {
      if (!tok) continue;
      const [t, m] = tok.split(':');
      const traza = t.replace(/[^a-j]/g, '');
      if (traza) pares.push([traza, Math.max(1, Math.min(50, parseInt(m, 10) || 1))]);
    }
    return pares;
  }
  const CASOS = {
    bucle1: {
      nombre: 'Bucle de longitud 1',
      texto: 'abc:3 abbc:2 abbbc:1',
      real: 'a, luego b una o más veces, luego c.',
      falla: 'b > b se anota b ‖ b. Una plaza exigiría b # b, así que b queda desconectada: α no explica ni la traza más simple.',
      resaltar: [['b', 'b']],
    },
    bucle2: {
      nombre: 'Bucle de longitud 2',
      texto: 'abcd:3 abcbcd:2 abcbcbcd:1',
      real: 'a, luego el par b, c repetido una o más veces, luego d.',
      falla: 'b > c y c > b se anotan b ‖ c: α ve dos actividades concurrentes y no el ciclo b → c → b. Se pierden los arcos entre ellas y c no recibe ficha.',
      resaltar: [['b', 'c'], ['c', 'b']],
    },
    nolocal: {
      nombre: 'Dependencia a distancia',
      texto: 'acd:5 bce:5',
      real: 'Si empezó con a termina con d; si empezó con b termina con e.',
      falla: 'La elección inicial determina la final, pero α solo ve relaciones locales: crea ({a,b},{c}) y ({c},{d,e}) y permite ace y bcd, que nunca ocurren.',
      resaltar: [],
    },
    opcional: {
      nombre: 'Actividad opcional (invisible)',
      texto: 'abcd:4 acd:3',
      real: 'a, luego b opcional, luego c y d.',
      falla: 'a → b → c y también a → c: la plaza (a, c) exige una ficha que b no produce, y c necesita las dos plazas. La traza acd queda bloqueada. Haría falta una transición invisible (τ) que salte b.',
      resaltar: [['a', 'c']],
    },
    duplicada: {
      nombre: 'Actividad que aparece dos veces',
      texto: 'abac:5',
      real: 'a, b, otra vez a (una tarea distinta con el mismo nombre) y c.',
      falla: 'a > b y b > a se anotan a ‖ b. α tiene una transición por etiqueta y no puede separar las dos tareas llamadas a; b queda desconectada.',
      resaltar: [['a', 'b'], ['b', 'a']],
    },
  };
  const opcionesCasos = Object.entries(CASOS).map(([k, v]) => [k, v.nombre]);

  function compilar(texto) {
    const log = P.logSimple(leerTrazas(texto));
    const alfa = P.alfa(log);
    return { log, vars: P.variantes(log), alfa, pos: P.posDeRed(alfa.red) };
  }
  const esFinal = (red, m) => Object.keys(m).every((k) => (k === red.fin ? m[k] === 1 : !(m[k] > 0)));
  function modeloRed(red) {
    const tr = red.trans.filter((t) => !t.silenciosa);
    return {
      inicio: () => P.marcadoInicial(red),
      pasos: (m) => tr.filter((t) => P.habilitada(red, m, t.id)).map((t) => [t.nombre, P.disparar(red, m, t.id)]),
      fin: (m) => esFinal(red, m),
    };
  }
  // Trazas completas de hasta L eventos que acepta la red (con tope).
  function aceptadas(red, L, tope = 400) {
    const m = modeloRed(red), res = [];
    let corte = false;
    const dfs = (s, pref) => {
      if (res.length >= tope) { corte = true; return; }
      if (m.fin(s) && pref.length) res.push(pref);
      if (pref.length >= L) return;
      for (const [a, s2] of m.pasos(s)) dfs(s2, pref + a);
    };
    dfs(m.inicio(), '');
    return { lista: res, corte };
  }
  function dibujarRed(lienzo, red, pos, marcado, o = {}) {
    const { nodos, aristas } = P.nodosDeRed(red, marcado, {
      plaza: (p) => ({
        ...(p.id === red.ini ? { tipo: 'inicio' } : p.id === red.fin ? { tipo: 'fin' } : { etiqueta: p.id }),
        ...(o.plaza ? o.plaza(p) : {}),
      }),
      trans: (t) => (o.trans ? o.trans(t) : {}),
    });
    return P.dibujarGrafo(lienzo, nodos, aristas, pos, { etiquetasPlazas: true });
  }

  /* ---------- Fig. 1: dónde falla α ---------- */

  function montarFallos(cuerpo) {
    let clave = 'bucle1', dato = null, sel = 0, k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Caso', opciones: opcionesCasos, valor: clave, alCambiar: (v) => { clave = v; sel = 0; k = 0; calcular(); } });
    const selV = ctl.selector({ etiqueta: 'Variante a reproducir', opciones: [['0', '—']], valor: '0', alCambiar: (v) => { sel = +v; k = 0; ajustarK(); dibujar(); } });
    const rk = ctl.rango({ etiqueta: 'Evento reproducido', min: 0, max: 1, valor: 0, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'transición que se dispara en este evento', forma: 'cuadro' },
      { color: C.s8, texto: 'plaza sin ficha cuando hacía falta (ficha artificial)', forma: 'cuadro' },
      { color: C.s4, texto: 'plaza con ficha sobrante al terminar', forma: 'cuadro' },
      { color: C.apagado, texto: 'actividad sin ningún arco: α no la conectó', forma: 'cuadro' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const texto = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(texto);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija un caso y reproduzca cada variante evento por evento: observe dónde se queda sin ficha. Las celdas rojas de la huella son las relaciones que engañan a α.');

    function calcular() {
      dato = compilar(CASOS[clave].texto);
      dato.rep = dato.vars.map((v) => P.reproducir(dato.alfa.red, v.traza));
      selV.select.replaceChildren(...dato.vars.map((v, i) => VIZ.el('option', { value: String(i) }, `${v.traza.join('')}  (×${v.n})`)));
      selV.valor = '0';
      ajustarK();
      dibujar();
    }
    function ajustarK() { const max = dato.rep[sel].pasos.length - 1; rk.max = max; k = Math.min(k, max); rk.valor = k; }
    function dibujar() {
      lienzo.limpiar();
      const caso = CASOS[clave], red = dato.alfa.red, r = dato.rep[sel], paso = r.pasos[k], fin = k === r.pasos.length - 1;
      const conectada = new Set(red.arcos.flat());
      dibujarRed(lienzo, red, dato.pos, paso.marcado, {
        plaza: (p) => (paso.faltantes.includes(p.id) ? { anillo: C.s8 } : fin && (paso.marcado[p.id] || 0) > 0 ? { anillo: C.s4 } : {}),
        trans: (t) => (paso.trans === t.id ? { anillo: C.s2, relleno: VIZ.alfa(C.s2, 0.15) } : !conectada.has(t.id) ? { borde: C.apagado, colorTexto: C.apagado } : {}),
      });
      const h = dato.alfa.huella, COL = { '→': C.s1, '←': C.s3, '‖': C.s2, '#': null };
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, VIZ.el('th', null, ''), ...h.acts.map((b) => VIZ.el('th', null, b)))),
        VIZ.el('tbody', null, ...h.acts.map((a) => VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, a), ...h.acts.map((b) => {
          const rel = h.rel[a][b], malo = caso.resaltar.some(([x, y]) => x === a && y === b);
          return VIZ.el('td', { style: { background: malo ? VIZ.alfa(C.s8, 0.3) : COL[rel] ? VIZ.alfa(COL[rel], 0.18) : null, fontWeight: malo ? '700' : '400' } }, rel);
        }))))));
      texto.replaceChildren(VIZ.el('div', null, `Proceso real: ${caso.real}`), VIZ.el('div', { style: { color: C.s8 } }, `Por qué falla: ${caso.falla}`));
      const tot = dato.vars.reduce((s, v) => s + v.n, 0);
      const fit = dato.vars.reduce((s, v, i) => s + v.n * dato.rep[i].fitness, 0) / tot;
      const ok = dato.vars.filter((v, i) => dato.rep[i].fitness > 0.9999).length;
      const sueltas = red.trans.filter((t) => !conectada.has(t.id)).map((t) => t.nombre);
      registro.textContent = fin
        ? `Fin de ${dato.vars[sel].traza.join('')}: ${r.m} ficha(s) faltante(s) y ${r.r} sobrante(s); fitness ${VIZ.fmt(r.fitness, 3)}.`
        : k === 0 ? 'Marcado inicial: una ficha en «inicio».'
          : `Evento ${k}: ${paso.act}${paso.faltantes.length ? `, no había ficha en ${paso.faltantes.join(', ')}: se crea una artificial.` : ' se dispara con las fichas disponibles.'}`;
      lectura.set([
        ['variantes que la red reproduce', `${ok} de ${dato.vars.length}`],
        ['fitness del registro', VIZ.fmt(fit, 3)],
        ['plazas descubiertas', String(red.plazas.length)],
        ['actividades sin arcos', sueltas.length ? sueltas.join(', ') : 'ninguna'],
      ]);
    }
    lienzo.alDibujar = () => dato && dibujar();
    calcular();
  }

  /* ---------- Fig. 2: comportamiento permitido frente al visto ---------- */

  function montarComportamiento(cuerpo) {
    let clave = 'nolocal', L = 5, dato = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    const selCaso = ctl.selector({ etiqueta: 'Caso', opciones: opcionesCasos, valor: clave, alCambiar: (v) => { clave = v; calcular(); } });
    ctl.rango({ etiqueta: 'Longitud máxima de traza', min: 3, max: 9, valor: L, alCambiar: (v) => { L = v; calcular(); } });
    ctl.boton('Probar con otro caso', () => { const ks = Object.keys(CASOS); clave = ks[(ks.indexOf(clave) + 1) % ks.length]; selCaso.valor = clave; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 220, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['ambas', 'en el registro y en el modelo', C.s6], ['extra', 'solo en el modelo (comportamiento extra)', C.s8], ['perdida', 'solo en el registro (α no la reproduce)', C.s2]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t })));
    const lista = VIZ.el('div', { class: 'fichas' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El gráfico cuenta, por longitud de traza, qué comportamiento comparten el registro y la red de α. Pase el cursor por una barra. Cada ficha de abajo es una traza completa: verde, la vieron ambos; roja, solo la red la permite; naranja, solo el registro.');

    function calcular() {
      const caso = CASOS[clave], d = compilar(caso.texto);
      const reg = new Set(d.vars.map((v) => v.traza.join('')));
      const ac = aceptadas(d.alfa.red, L);
      const modelo = new Set(ac.lista);
      const filas = [];
      for (let l = 1; l <= L; l++) {
        const a = ac.lista.filter((t) => t.length === l), r = [...reg].filter((t) => t.length === l);
        filas.push({ l, ambas: a.filter((t) => reg.has(t)).length, extra: a.filter((t) => !reg.has(t)).length, perdida: r.filter((t) => !modelo.has(t)).length });
      }
      dato = { caso, reg, ac, modelo, filas };
      dibujar();
    }
    let plano = null;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const { filas, reg, ac, modelo, caso } = dato;
      const maxY = Math.max(2, ...filas.map((f) => Math.max(f.ambas, f.extra, f.perdida)));
      plano = VIZ.plano(lienzo, { xmin: 0.5, xmax: L + 0.5, ymin: 0, ymax: maxY * 1.15 }, { etiquetaX: 'longitud de la traza', etiquetaY: 'trazas distintas', ticksX: filas.map((f) => f.l), formatoX: (v) => String(v), formatoY: (v) => VIZ.entero(v) });
      plano.ejes();
      const w = Math.min(70, (plano.x1 - plano.x0) / L) * 0.8, bw = w / SER.length;
      filas.forEach((f, i) => SER.forEach(([key, , col], j) => {
        const v = f[key]; if (!v) return;
        const x = plano.sx(f.l) - w / 2 + j * bw, y = plano.sy(v);
        ctx.fillStyle = i === hover ? VIZ.alfa(col, 0.7) : col;
        ctx.beginPath(); ctx.roundRect(x + 1, y, Math.max(1, bw - 2), plano.y0 - y, [3, 3, 0, 0]); ctx.fill();
      }));
      const todas = [...new Set([...ac.lista, ...reg])].sort((a, b) => a.length - b.length || a.localeCompare(b));
      const fichas = todas.slice(0, 60).map((t) => {
        const enReg = reg.has(t), enMod = modelo.has(t);
        return VIZ.ficha(t, enReg && enMod ? { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) } : enMod ? { color: C.s8, tinta: C.s8 } : { color: C.s2, tinta: C.s2 });
      });
      lista.replaceChildren(...(fichas.length ? fichas : [VIZ.el('span', { class: 'fichas-vacio' }, 'ninguna traza')]), ...(todas.length > 60 ? [VIZ.el('span', { class: 'fichas-vacio' }, ` … ${todas.length - 60} más`)] : []));
      const sum = (key) => filas.reduce((s, f) => s + f[key], 0);
      registro.textContent = `${caso.nombre}. ${caso.falla}`;
      lectura.set([
        ['variantes del registro', String(reg.size)],
        ['trazas que acepta la red (≤ L)', ac.corte ? `${ac.lista.length}+` : String(ac.lista.length)],
        ['comportamiento extra', String(sum('extra'))],
        ['variantes que la red no reproduce', String(sum('perdida'))],
      ]);
    }
    lienzo.alDibujar = () => dato && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.max(0, Math.min(dato.filas.length - 1, Math.round(plano.ix(x)) - 1));
      if (i !== hover) { hover = i; dibujar(); }
      const f = dato.filas[i];
      tip.mostrar(x, y, `longitud = <b>${f.l}</b>` + SER.map(([key, t, c]) => VIZ.filaTooltip(c, t, String(f[key]))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (dato) dibujar(); });
    calcular();
  }

  VIZ.registrarTema('alpha-limitations', {
    intro: String.raw`
      <p>El algoritmo α redescubre bien los procesos estructurados cuando el registro está completo y limpio, pero se equivoca de manera sistemática ante varios patrones
      comunes: <strong>bucles cortos</strong>, <strong>dependencias a distancia</strong>, <strong>actividades opcionales o invisibles</strong> y <strong>tareas con el mismo nombre</strong>.
      Todos tienen el mismo origen: α solo mira qué actividad sigue directamente a cuál.</p>
      <p>Entender cada fallo ayuda a elegir después el algoritmo adecuado: casi todas las ideas del <a href="tema.html?id=heuristic-miner">minero heurístico</a> y del
      <a href="tema.html?id=inductive-miner">minero inductivo</a> existen para evitar estos problemas.</p>`,
    visualizaciones: [
      {
        titulo: 'Cinco casos donde α falla',
        descripcion: 'Elija un caso y reproduzca sus variantes sobre la red que descubre α: verá exactamente dónde falta una ficha. Observe en la huella la celda roja que causa el error.',
        montar: montarFallos,
      },
      {
        titulo: 'Lo que permite la red y lo que se vio',
        descripcion: 'Compare, por longitud de traza, las que están en el registro con las que acepta la red. En la dependencia a distancia aparece comportamiento extra; en la actividad opcional, una variante perdida.',
        montar: montarComportamiento,
      },
    ],
    teoria: String.raw`
      <h2>Bucles de longitud 1 y 2</h2>
      <p>Si una actividad se repite de inmediato, \(a &gt;_L a\), la huella la marca \(a \parallel a\). Para que \(a\) entre en una plaza se exige \(a \,\#\, a\) (la actividad debe ser
      independiente de sí misma dentro de su grupo), de modo que queda fuera de \(X_L\) y la transición no tiene arcos. En un bucle de longitud 2 (\(b, c, b, c\)) aparecen
      \(b &gt; c\) y \(c &gt; b\): se interpretan como paralelas y se pierde la causalidad. Una extensión conocida, α<sup>+</sup>, trata los bucles de longitud 1 y 2 con un
      preproceso.</p>
      <p>Los bucles de longitud 3 o más sí se descubren cuando el resto del modelo es estructurado: véase el ejemplo con ciclo del tema <a href="tema.html?id=alpha-algorithm">algoritmo α</a>.</p>
      <h2>Dependencias no locales</h2>
      <p>En una red de libre elección (<em>free-choice</em>), si dos transiciones comparten una plaza de entrada, comparten todas. Hay procesos reales donde una decisión
      anterior condiciona otra posterior, es decir, que no son de libre elección. El comportamiento depende de algo que ocurrió <em>varios pasos antes</em>, pero α solo
      construye relaciones locales entre actividades vecinas.</p>
      <p>Para \(L = \{\langle a,c,d\rangle, \langle b,c,e\rangle\}\) α produce \(\alpha(L)\) con las plazas \((\{a,b\},\{c\})\) y \((\{c\},\{d,e\})\); esa red acepta además
      \(\langle a,c,e\rangle\) y \(\langle b,c,d\rangle\). El modelo tiene fitness 1, pero baja precisión. Un modelo correcto necesita dos caminos separados (a…d y b…e) o una plaza que “recuerde” la elección
      inicial; ninguna de las dos cosas se deduce de relaciones locales. Modelos más ricos, como las <a href="tema.html?id=causal-nets">redes causales</a>, sí pueden expresarla.</p>
      <h2>Actividades opcionales e invisibles</h2>
      <p>Una actividad que puede saltarse produce \(a \to b \to c\) y a la vez \(a \to c\). α crea una plaza para cada una y \(c\) queda esperando una ficha que \(b\) no
      produce cuando se salta. El modelo correcto necesita una <em>transición silenciosa</em> \(\tau\) (invisible: no deja evento en el registro), que α no puede
      introducir porque solo construye transiciones con etiqueta. Lo mismo vale para una elección con una rama vacía.</p>
      <h2>Tareas duplicadas</h2>
      <p>Cuando la misma etiqueta nombra dos pasos distintos del proceso (por ejemplo, una “revisión” inicial y otra final), α, que tiene una transición por etiqueta,
      mezcla ambas y crea relaciones contradictorias (\(a \to b\) y \(b \to a\) pasan a \(a \parallel b\)). Se evita renombrando con información del ciclo de vida o del contexto,
      o con algoritmos que admiten transiciones con etiquetas repetidas.</p>
      <h2>Ruido y frecuencia</h2>
      <p>α no distingue una sucesión que ocurrió una vez de una que ocurrió miles de veces, de modo que cualquier ruido altera el modelo
      (<a href="tema.html?id=noise-and-incompleteness">ruido e incompletitud</a>). Tampoco garantiza que la red resultante sea correcta como red de flujo de trabajo: puede tener
      <a href="tema.html?id=soundness">interbloqueos</a> o actividades que nunca pueden dispararse.</p>
      <h2>Qué se hizo después</h2>
      <table>
        <tr><th>Problema</th><th>Idea posterior</th></tr>
        <tr><td>ruido y frecuencias</td><td>dependencias con umbral de frecuencia: <a href="tema.html?id=heuristic-miner">minero heurístico</a></td></tr>
        <tr><td>bucles, opcionales, tau</td><td>cortes del registro: <a href="tema.html?id=inductive-miner">minero inductivo</a>, que garantiza modelos correctos</td></tr>
        <tr><td>dependencias no locales</td><td>redes causales y vínculos entre eventos distantes</td></tr>
        <tr><td>visión global</td><td>comparación de métodos en <a href="tema.html?id=discovery-comparison">comparación de algoritmos</a></td></tr>
      </table>
      <h2>Conexiones</h2>
      <p>Todo parte de las <a href="tema.html?id=footprint-matrix">relaciones de huella</a> y del <a href="tema.html?id=process-discovery">enfoque general de descubrimiento</a>; los cuatro criterios de
      calidad de ese tema (fitness, precisión, generalización, simplicidad) permiten ver qué sacrifica cada caso.</p>`,
  });
})();
