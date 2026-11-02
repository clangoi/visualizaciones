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
  const EJ = {
    mixto: ['Elección y paralelo (clásico)', 'abcd:3 acbd:2 aed:2'],
    eleccion: ['Elección seguida de paralelo', 'abdef:2 abedf:2 acdef:2 acedf:2'],
    paralelo3: ['Tres actividades en paralelo', 'abcde:1 abdce:1 acbde:1 acdbe:1 adbce:1 adcbe:1'],
    ciclo: ['Ciclo de longitud 3', 'abcf:3 abcdbcf:2 abcdbcdbcf:1'],
  };
  const opcionesEj = Object.entries(EJ).map(([k, v]) => [k, v[0]]);

  function editor(ctl, inicial, alCambiar, libre = true) {
    let clave = inicial;
    const sel = ctl.selector({ etiqueta: 'Registro de ejemplo', opciones: opcionesEj, valor: clave, alCambiar: (v) => { clave = v; if (txt) txt.valor = EJ[v][1]; alCambiar(EJ[v][1]); } });
    const txt = libre ? ctl.texto({ etiqueta: 'Trazas (traza:veces)', valor: EJ[clave][1], alCambiar: (v) => alCambiar(v) }) : null;
    return { sel, txt };
  }
  function compilar(texto) {
    const log = P.logSimple(leerTrazas(texto));
    if (!log.length || P.actividades(log).length > 10) return null;
    const alfa = P.alfa(log);
    return { log, vars: P.variantes(log), alfa, pos: P.posDeRed(alfa.red) };
  }
  const par = (p) => `({${p.A.join(',')}},{${p.B.join(',')}})`;
  const conj = (a) => `{${a.join(', ')}}`;
  const esFinal = (red, m) => Object.keys(m).every((k) => (k === red.fin ? m[k] === 1 : !(m[k] > 0)));

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

  /* ---------- Fig. 1: α paso a paso ---------- */

  function montarPasos(cuerpo) {
    let texto = EJ.mixto[1], dato = null, est = null;
    const ctl = VIZ.controles(cuerpo);
    editor(ctl, 'mixto', (v) => { texto = v; rep.reiniciar(); });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'inicio, fin o plaza recién creada', forma: 'cuadro' },
      { color: C.s1, texto: 'conjunto A del par que se examina', forma: 'cuadro' },
      { color: C.s2, texto: 'conjunto B del par que se examina', forma: 'cuadro' },
    ]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance con Un paso. Los pares de X<sub>L</sub> pasan a Y<sub>L</sub> solo si ningún otro par los contiene; cada par de Y<sub>L</sub> se vuelve una plaza. Cambie el registro para ver otras bifurcaciones.');

    function iniciar() {
      dato = compilar(texto);
      est = { fase: 0, xi: 0, actual: -1, rev: -1, estado: new Map(), nPl: 0, msg: dato ? 'Pulse Un paso para empezar con el conjunto de actividades T_L.' : 'Escriba al menos una traza válida (letras a–j).' };
      if (!dato) return (function* () {})();
      return (function* () {
        const { alfa } = dato;
        est.fase = 1; est.msg = `T_L: las ${alfa.huella.acts.length} actividades que aparecen en el registro; cada una será una transición.`; yield;
        est.fase = 2; est.msg = `T_I: actividades que inician alguna traza ${conj(alfa.Ti)}. Reciben un arco desde la plaza de inicio.`; yield;
        est.fase = 3; est.msg = `T_O: actividades que terminan alguna traza ${conj(alfa.To)}. Envían un arco a la plaza de fin.`; yield;
        est.fase = 4;
        for (let i = 0; i < alfa.X.length; i++) {
          est.xi = i + 1; est.actual = i;
          est.msg = `Candidato ${par(alfa.X[i])}: todo a ∈ A causa a todo b ∈ B (a → b), y dentro de A y de B las actividades son # entre sí.`;
          yield;
        }
        est.actual = -1; est.fase = 5;
        for (let i = 0; i < alfa.X.length; i++) {
          const p = alfa.X[i];
          est.rev = i;
          const mayor = alfa.X.find((q) => q !== p && p.A.every((a) => q.A.includes(a)) && p.B.every((b) => q.B.includes(b)));
          est.estado.set(i, mayor ? 'descartado' : 'maximal');
          est.msg = mayor ? `${par(p)} ⊆ ${par(mayor)}: no es maximal, se descarta.` : `${par(p)}: ningún otro par lo contiene, es maximal y entra en Y_L.`;
          yield;
        }
        est.rev = -1; est.fase = 6;
        for (let j = 0; j < alfa.Y.length; j++) {
          est.nPl = j + 1;
          est.msg = `Plaza p${j + 1} para ${par(alfa.Y[j])}: arcos desde cada elemento de ${conj(alfa.Y[j].A)} hacia p${j + 1}, y de p${j + 1} a cada elemento de ${conj(alfa.Y[j].B)}.`;
          yield;
        }
        est.fase = 7;
        est.msg = `Red completa: ${alfa.red.plazas.length} plazas, ${alfa.red.trans.length} transiciones y ${alfa.red.arcos.length} arcos.`;
      })();
    }

    function dibujar() {
      lienzo.limpiar();
      if (!dato) { registro.textContent = est.msg; lista.replaceChildren(VIZ.el('div', null, 'Sin registro válido.')); lectura.set([['casos', '0']]); return; }
      const { alfa, pos } = dato, full = alfa.red;
      // Partes visibles de la red según la fase.
      const idsPl = new Set();
      if (est.fase >= 2) idsPl.add(full.ini);
      if (est.fase >= 3) idsPl.add(full.fin);
      for (let j = 0; j < est.nPl; j++) idsPl.add('p' + (j + 1));
      const vis = {
        ini: full.ini, fin: full.fin,
        plazas: full.plazas.filter((p) => idsPl.has(p.id)),
        trans: est.fase >= 1 ? full.trans : [],
      };
      const ids = new Set([...vis.plazas.map((p) => p.id), ...vis.trans.map((t) => t.id)]);
      vis.arcos = full.arcos.filter(([a, b]) => ids.has(a) && ids.has(b));
      const actual = est.actual >= 0 ? alfa.X[est.actual] : est.rev >= 0 ? alfa.X[est.rev] : null;
      dibujarRed(lienzo, vis, pos, {}, {
        plaza: (p) => (p.id === 'p' + est.nPl && est.fase === 6 ? { anillo: C.s6 } : (p.id === full.ini && est.fase === 2) || (p.id === full.fin && est.fase === 3) ? { anillo: C.s6 } : {}),
        trans: (t) => {
          const a = t.nombre;
          if (est.fase === 2 && alfa.Ti.includes(a)) return { anillo: C.s6 };
          if (est.fase === 3 && alfa.To.includes(a)) return { anillo: C.s6 };
          if (actual && (est.fase === 4 || est.fase === 5)) {
            if (actual.A.includes(a)) return { anillo: C.s1, relleno: VIZ.alfa(C.s1, 0.15) };
            if (actual.B.includes(a)) return { anillo: C.s2, relleno: VIZ.alfa(C.s2, 0.15) };
          }
          return {};
        },
      });
      // Panel de conjuntos.
      const filas = [];
      filas.push(VIZ.el('div', null, `T_L = ${est.fase >= 1 ? conj(alfa.huella.acts) : '…'}`));
      filas.push(VIZ.el('div', null, `T_I = ${est.fase >= 2 ? conj(alfa.Ti) : '…'}    T_O = ${est.fase >= 3 ? conj(alfa.To) : '…'}`));
      const fichasX = alfa.X.slice(0, est.xi).map((p, i) => {
        const e = est.estado.get(i);
        if (e === 'maximal') return VIZ.ficha(par(p), { color: C.s6, fondo: VIZ.alfa(C.s6, 0.12) });
        if (e === 'descartado') return VIZ.ficha('✂ ' + par(p), { color: C.tenue, tinta: C.apagado });
        return VIZ.ficha(par(p), i === est.actual ? { color: C.s2, fondo: VIZ.alfa(C.s2, 0.12) } : { color: C.inactivo, tinta: C.tinta2 });
      });
      filas.push(VIZ.el('div', null, VIZ.el('span', { class: 'fichas-titulo' }, 'X_L'), VIZ.el('span', { class: 'fichas' }, ...(fichasX.length ? fichasX : [VIZ.el('span', { class: 'fichas-vacio' }, '…')]))));
      const maximales = alfa.X.map((p, i) => (est.estado.get(i) === 'maximal' ? p : null)).filter(Boolean);
      filas.push(VIZ.el('div', null, VIZ.el('span', { class: 'fichas-titulo' }, 'Y_L'), VIZ.el('span', { class: 'fichas' }, ...(maximales.length ? maximales.map((p, j) => VIZ.ficha(`p${j + 1} ${par(p)}`, { color: j < est.nPl ? C.s6 : C.inactivo })) : [VIZ.el('span', { class: 'fichas-vacio' }, '…')]))));
      lista.replaceChildren(...filas);
      registro.textContent = est.msg;
      lectura.set([
        ['|T_L| actividades', String(alfa.huella.acts.length)],
        ['|T_I| / |T_O|', `${alfa.Ti.length} / ${alfa.To.length}`],
        ['|X_L| candidatos', String(alfa.X.length)],
        ['|Y_L| maximales', String(alfa.Y.length)],
        ['plazas creadas', String(est.nPl)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  /* ---------- Fig. 2: leer la red y jugar con las fichas ---------- */

  function tieneCiclo(red) {
    const sal = new Map();
    red.arcos.forEach(([a, b]) => { if (!sal.has(a)) sal.set(a, []); sal.get(a).push(b); });
    const col = new Map();
    const dfs = (u) => {
      col.set(u, 1);
      for (const v of sal.get(u) || []) { if (col.get(v) === 1) return true; if (!col.get(v) && dfs(v)) return true; }
      col.set(u, 2);
      return false;
    };
    return [...sal.keys()].some((u) => !col.get(u) && dfs(u));
  }

  function montarJuego(cuerpo) {
    let clave = 'mixto', dato = null, marcado = {}, traza = [], variante = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Red descubierta de', opciones: opcionesEj, valor: clave, alCambiar: (v) => { clave = v; variante = 0; compilarEj(); } });
    const selV = ctl.selector({ etiqueta: 'Variante a reproducir', opciones: [['0', '—']], valor: '0', alCambiar: (v) => { variante = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Disparar al azar', () => {
      const hab = dato.alfa.red.trans.filter((t) => P.habilitada(dato.alfa.red, marcado, t.id));
      if (hab.length) disparar(hab[Math.floor(Math.random() * hab.length)]);
    });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'transición habilitada (clic para disparar)', forma: 'cuadro' },
      { color: C.s2, texto: 'plaza de elección (XOR): varias salidas o entradas', forma: 'cuadro' },
      { color: C.s7, texto: 'transición que bifurca o une en paralelo (AND)', forma: 'cuadro' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una plaza con dos salidas ofrece una elección: la ficha va por una sola. Una transición con dos salidas pone fichas en ambas ramas, que luego pueden dispararse en cualquier orden. Haga clic en las transiciones habilitadas o reproduzca una variante.');

    function compilarEj() {
      dato = compilar(EJ[clave][1]);
      selV.select.replaceChildren(...dato.vars.map((v, i) => VIZ.el('option', { value: String(i) }, `${v.traza.join('')}  (×${v.n})`)));
      selV.valor = String(variante);
      rep.reiniciar();
    }
    function reiniciarFichas() { marcado = P.marcadoInicial(dato.alfa.red); traza = []; }
    function disparar(t) {
      const red = dato.alfa.red;
      const ent = P.entradas(red, t.id), sal = P.salidas(red, t.id);
      marcado = P.disparar(red, marcado, t.id);
      traza.push(t.nombre);
      const extra = sal.length > 1 ? ` Produce ${sal.length} fichas a la vez: las ramas quedan en paralelo.` : '';
      registro.textContent = `Disparó ${t.nombre}: consume de {${ent.join(', ')}} y produce en {${sal.join(', ')}}.${extra}` + (esFinal(red, marcado) ? ` Fin del caso con «${traza.join('')}».` : '');
      dibujar();
    }
    function iniciar() {
      reiniciarFichas();
      registro.textContent = 'Una ficha en «inicio». Las transiciones con anillo verde pueden dispararse.';
      return (function* () {
        const v = dato.vars[variante].traza, red = dato.alfa.red;
        for (;;) {
          const prefijo = traza.length <= v.length && traza.every((a, i) => a === v[i]);
          if (!prefijo) reiniciarFichas();
          if (traza.length >= v.length) return;
          const t = red.trans.find((u) => u.nombre === v[traza.length]);
          disparar(t);
          yield;
        }
      })();
    }
    function dibujar() {
      lienzo.limpiar();
      const red = dato.alfa.red;
      const hab = new Set(red.trans.filter((t) => P.habilitada(red, marcado, t.id)).map((t) => t.id));
      const nSal = (id) => red.arcos.filter(([a]) => a === id).length, nEnt = (id) => red.arcos.filter(([, b]) => b === id).length;
      geo = dibujarRed(lienzo, red, dato.pos, marcado, {
        plaza: (p) => (p.id !== red.ini && p.id !== red.fin && (nSal(p.id) > 1 || nEnt(p.id) > 1) ? { anillo: C.s2 } : {}),
        trans: (t) => ({
          ...(nSal(t.id) > 1 || nEnt(t.id) > 1 ? { relleno: VIZ.alfa(C.s7, 0.25) } : {}),
          ...(hab.has(t.id) ? { anillo: C.s6 } : {}),
        }),
      });
      lienzo.canvas.style.cursor = hab.size ? 'pointer' : 'default';
      const enLog = dato.vars.some((v) => v.clave === traza.join('›'));
      const fichas = Object.values(marcado).reduce((s, v) => s + Math.max(0, v), 0);
      lectura.set([
        ['transiciones habilitadas', hab.size ? [...hab].map((id) => id.slice(2)).join(', ') : 'ninguna'],
        ['fichas en la red', String(fichas)],
        ['traza disparada', traza.length ? traza.join('') : '—'],
        ['¿está en el registro?', esFinal(red, marcado) ? (enLog ? 'sí, completa' : 'no (comportamiento nuevo)') : 'caso en curso'],
        ['¿hay ciclos?', tieneCiclo(red) ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = () => dato && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev), n = P.nodoEn(geo, x, y);
      if (!n) return;
      const t = dato.alfa.red.trans.find((u) => u.id === n.id);
      if (t && P.habilitada(dato.alfa.red, marcado, t.id)) { rep.detener(); disparar(t); }
    });
    compilarEj();
  }

  /* ---------- Fig. 3: edite el registro, vea la red ---------- */

  function montarEditar(cuerpo) {
    let texto = EJ.mixto[1], dato = null, sel = 0, k = 0;
    const ctl = VIZ.controles(cuerpo);
    editor(ctl, 'mixto', (v) => { texto = v; sel = 0; k = 0; calcular(); });
    const selV = ctl.selector({ etiqueta: 'Variante', opciones: [['0', '—']], valor: '0', alCambiar: (v) => { sel = +v; k = 0; ajustarK(); dibujar(); } });
    const rk = ctl.rango({ etiqueta: 'Evento reproducido', min: 0, max: 1, valor: 0, alCambiar: (v) => { k = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 400 });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'transición que se dispara en este evento', forma: 'cuadro' },
      { color: C.s8, texto: 'ficha faltante: se crea artificialmente', forma: 'cuadro' },
      { color: C.s4, texto: 'ficha sobrante al final del caso', forma: 'cuadro' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Agregue una traza que α no pueda explicar (por ejemplo, acb sin la a, o abbd) y observe en la tabla qué variantes dejan de encajar. Haga clic en una fila o mueva «Evento reproducido» para ver la ficha avanzar por la red.');

    function calcular() {
      const d = compilar(texto);
      if (!d) { dato = null; dibujar(); return; }
      d.rep = d.vars.map((v) => P.reproducir(d.alfa.red, v.traza));
      dato = d;
      selV.select.replaceChildren(...d.vars.map((v, i) => VIZ.el('option', { value: String(i) }, `${v.traza.join('')}  (×${v.n})`)));
      selV.valor = String(sel);
      ajustarK();
      dibujar();
    }
    function ajustarK() {
      if (!dato) return;
      const max = dato.rep[sel].pasos.length - 1;
      rk.max = max; k = Math.min(k, max); rk.valor = k;
    }
    function dibujar() {
      lienzo.limpiar();
      if (!dato) { registro.textContent = 'Escriba al menos una traza válida (letras a–j).'; caja.replaceChildren(); lectura.set([['casos', '0']]); return; }
      const red = dato.alfa.red, r = dato.rep[sel], paso = r.pasos[k];
      const fin = k === r.pasos.length - 1;
      dibujarRed(lienzo, red, dato.pos, paso.marcado, {
        plaza: (p) => (paso.faltantes.includes(p.id) ? { anillo: C.s8 } : fin && (paso.marcado[p.id] || 0) > 0 ? { anillo: C.s4 } : {}),
        trans: (t) => (paso.trans === t.id ? { anillo: C.s2, relleno: VIZ.alfa(C.s2, 0.15) } : {}),
      });
      const fm = (x) => VIZ.fmt(x, 3);
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('thead', null, VIZ.el('tr', null, ['Variante', 'Casos', 'p', 'c', 'm', 'r', 'Fitness'].map((t, i) => VIZ.el('th', { class: i === 0 ? 'izq' : null }, t)))),
        VIZ.el('tbody', null, ...dato.vars.map((v, i) => {
          const q = dato.rep[i];
          return VIZ.el('tr', { class: 'clicable' + (i === sel ? ' activa' : ''), onclick: () => { sel = i; k = 0; selV.valor = String(i); ajustarK(); dibujar(); } },
            VIZ.el('td', { class: 'izq' }, v.traza.join('')), VIZ.el('td', null, String(v.n)), VIZ.el('td', null, String(q.p)), VIZ.el('td', null, String(q.c)),
            VIZ.el('td', null, String(q.m)), VIZ.el('td', null, String(q.r)), VIZ.el('td', { style: { color: q.fitness > 0.9999 ? C.tinta : C.s8, fontWeight: '600' } }, fm(q.fitness)));
        }))));
      const tot = dato.vars.reduce((s, v) => s + v.n, 0);
      const fit = dato.vars.reduce((s, v, i) => s + v.n * dato.rep[i].fitness, 0) / tot;
      const exactas = dato.vars.filter((v, i) => dato.rep[i].fitness > 0.9999).length;
      registro.textContent = fin
        ? `Fin de la variante ${dato.vars[sel].traza.join('')}: ${r.m} ficha(s) faltante(s) y ${r.r} sobrante(s); fitness ${fm(r.fitness)}.`
        : paso.sinTransicion ? `La actividad ${paso.act} no tiene transición.`
          : k === 0 ? 'Marcado inicial: una ficha en «inicio».'
            : `Evento ${k}: ${paso.act}${paso.faltantes.length ? `, faltaba ficha en ${paso.faltantes.join(', ')}: se crea una artificial.` : ' se dispara sin problemas.'}`;
      lectura.set([
        ['plazas descubiertas', String(red.plazas.length)],
        ['variantes que encajan', `${exactas} de ${dato.vars.length}`],
        ['fitness del registro', fm(fit)],
        ['p (producidas)  c (consumidas)', `${r.p}  ${r.c}`],
        ['m (faltantes)  r (sobrantes)', `${r.m}  ${r.r}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    calcular();
  }

  VIZ.registrarTema('alpha-algorithm', {
    intro: String.raw`
      <p>El <strong>algoritmo α</strong> (van der Aalst, Weijters y Maruster, 2004) fue el primero en descubrir una red de Petri a partir de un registro con
      garantías formales. Trabaja solo con la <a href="tema.html?id=footprint-matrix">matriz de huellas</a>: busca pares de grupos de actividades \((A, B)\) tales que
      todas las de \(A\) causen a todas las de \(B\), y cada par se vuelve una plaza que conecta unas con otras.</p>
      <p>De la forma de esas plazas sale el significado: dos actividades que comparten plaza de entrada son una elección; una transición que
      alimenta dos plazas arranca ramas paralelas; un arco que vuelve atrás forma un ciclo.</p>`,
    visualizaciones: [
      {
        titulo: 'α paso a paso',
        descripcion: 'Siga cada conjunto: T<sub>L</sub>, T<sub>I</sub>, T<sub>O</sub>, los candidatos X<sub>L</sub>, los maximales Y<sub>L</sub> y las plazas. Observe qué pares se descartan por estar contenidos en otro.',
        montar: montarPasos,
      },
      {
        titulo: 'Leer la red: elecciones, paralelos y ciclos',
        descripcion: 'Dispare las transiciones a mano y compruebe que una plaza con dos salidas obliga a escoger, mientras que una transición con dos salidas abre ramas concurrentes. Pruebe el registro con ciclo.',
        montar: montarJuego,
      },
      {
        titulo: 'Edite el registro, vea la red',
        descripcion: 'Cambie las trazas y compare la red con su reproducción: cada variante muestra fichas producidas, consumidas, faltantes y sobrantes. Agregue una traza «extraña» y mire cuál plaza falla.',
        montar: montarEditar,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>Sea \(L\) un registro sobre el conjunto de actividades \(T\). El algoritmo α construye una red de Petri \(\alpha(L) = (P_L, T_L, F_L)\) en ocho pasos:</p>
      <ol>
        <li>\(T_L = \{\, t \in T \mid \exists \sigma \in L : t \in \sigma \,\}\): las actividades observadas.</li>
        <li>\(T_I = \{\, t \mid \exists \sigma \in L : t = \text{primera}(\sigma) \,\}\).</li>
        <li>\(T_O = \{\, t \mid \exists \sigma \in L : t = \text{última}(\sigma) \,\}\).</li>
        <li>\(X_L = \{ (A, B) \mid A, B \subseteq T_L,\ A, B \neq \emptyset,\ \forall a \in A\ \forall b \in B : a \to_L b,\ \forall a_1, a_2 \in A : a_1 \,\#_L\, a_2,\ \forall b_1, b_2 \in B : b_1 \,\#_L\, b_2 \}\).</li>
        <li>\(Y_L = \{ (A, B) \in X_L \mid \nexists (A', B') \in X_L : A \subseteq A' \wedge B \subseteq B' \wedge (A, B) \neq (A', B') \}\): los pares maximales.</li>
        <li>\(P_L = \{ p_{(A,B)} \mid (A, B) \in Y_L \} \cup \{ i_L, o_L \}\).</li>
        <li>\(F_L = \{ (a, p_{(A,B)}) \mid (A,B) \in Y_L,\ a \in A \} \cup \{ (p_{(A,B)}, b) \mid (A,B) \in Y_L,\ b \in B \} \cup \{ (i_L, t) \mid t \in T_I \} \cup \{ (t, o_L) \mid t \in T_O \}\).</li>
        <li>Resultado: \((P_L, T_L, F_L)\), con una ficha en \(i_L\) y marcado final con una ficha en \(o_L\).</li>
      </ol>
      <pre><code>Tl ← actividades del registro
Ti ← primeras actividades;  To ← últimas actividades
Xl ← {(A, B) : A → B completo, A y B sin relaciones internas}
Yl ← pares maximales de Xl
crear una plaza por cada par de Yl
unir cada a ∈ A con la plaza y la plaza con cada b ∈ B
unir inicio con Ti y To con fin</code></pre>
      <h2>Ejemplo</h2>
      <p>Para \(L_1 = \{\langle a,b,c,d\rangle, \langle a,c,b,d\rangle, \langle a,e,d\rangle\}\): \(T_I = \{a\}\), \(T_O = \{d\}\). Entre los candidatos están
      \((\{a\},\{b\})\), \((\{a\},\{e\})\) y \((\{a\},\{b,e\})\); este último contiene a los otros dos, de modo que solo él pasa a \(Y_L\).
      Quedan cuatro pares maximales:</p>
      \[ Y_L = \{ (\{a\},\{b,e\}),\ (\{a\},\{c,e\}),\ (\{b,e\},\{d\}),\ (\{c,e\},\{d\}) \}. \]
      <p>Observe que \((\{a\},\{b,c\})\) no es candidato porque \(b \parallel c\): paralelas no pueden ser alternativas de la misma plaza. Al disparar \(a\),
      las plazas \(p_{(\{a\},\{b,e\})}\) y \(p_{(\{a\},\{c,e\})}\) reciben una ficha cada una. \(b\) y \(c\) consumen una cada uno (en cualquier orden), pero \(e\)
      necesita las dos: si se dispara \(e\), ni \(b\) ni \(c\) pueden hacerlo, y viceversa.</p>
      <h2>Qué estructuras reconoce</h2>
      <table>
        <tr><th>En la huella</th><th>En la red</th></tr>
        <tr><td>\(a \to b\)</td><td>secuencia: una plaza entre \(a\) y \(b\)</td></tr>
        <tr><td>\(a \to b,\ a \to c,\ b \,\#\, c\)</td><td>elección: una plaza con dos salidas</td></tr>
        <tr><td>\(a \to b,\ a \to c,\ b \parallel c\)</td><td>paralelo: \(a\) pone una ficha en cada rama</td></tr>
        <tr><td>\(b \to d,\ c \to d,\ b \,\#\, c\)</td><td>unión de una elección: una plaza con dos entradas</td></tr>
        <tr><td>\(b \to d,\ c \to d,\ b \parallel c\)</td><td>sincronización: \(d\) necesita una ficha de cada rama</td></tr>
      </table>
      <h2>Garantías y costo</h2>
      <div class="recuadro"><p><strong>Teorema (van der Aalst et al.).</strong> Si el proceso es una red de flujo de trabajo estructurada, sin bucles de longitud 1 ni 2 y sin
      lugares implícitos, y el registro es <em>completo con respecto a \(&gt;_L\)</em> (aparece toda sucesión directa posible), α reconstruye una red equivalente.</p></div>
      <p>El cálculo de \(X_L\) revisa subconjuntos de \(T_L\), es decir, \(O(2^{|T_L|})\) candidatos en el peor caso, aunque las implementaciones prácticas podan los conjuntos
      que ya no son independientes. Por eso la figura limita el alfabeto a diez actividades.</p>
      <h2>Reproducir el registro</h2>
      <p>Para medir qué tan bien la red explica un caso se reproduce con fichas: \(p\) fichas producidas, \(c\) consumidas, \(m\) faltantes (creadas para poder disparar) y
      \(r\) sobrantes al terminar; el ajuste es</p>
      \[ \text{fitness} = \tfrac12 \left(1 - \frac{m}{c}\right) + \tfrac12 \left(1 - \frac{r}{p}\right). \]
      <p>Se detalla en <a href="tema.html?id=token-based-replay">reproducción de fichas</a>.</p>
      <h2>Conexiones</h2>
      <p>α parte del <a href="tema.html?id=footprint-matrix">análisis de huellas</a> y produce una <a href="tema.html?id=petri-nets">red de Petri</a> que, si se cumplen las
      hipótesis, es una <a href="tema.html?id=workflow-nets">red de flujo de trabajo</a>. Sus fallos con ruido y registros incompletos se ven en
      <a href="tema.html?id=noise-and-incompleteness">ruido e incompletitud</a> y sus límites estructurales en <a href="tema.html?id=alpha-limitations">limitaciones de α</a>.
      Es el punto de partida del <a href="tema.html?id=process-discovery">descubrimiento de procesos</a>.</p>`,
  });
})();
