(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Generadores de registros centrados en objetos (reproducibles con semilla) ---------- */

  // Cada dominio: tipos (nombre, color), abreviaturas para pantallas angostas, objetos y eventos ordenados por tiempo.
  function armar(nombre, tipos, abrev, objetos, evs) {
    evs.sort((a, b) => a.t - b.t || a.i - b.i);
    evs.forEach((e, k) => { e.n = k + 1; });
    return {
      nombre, tipos, abrev, evs, objetos,
      tipoDe: Object.fromEntries(objetos), color: Object.fromEntries(tipos.map(([t, c]) => [t, c])),
      acts: [...new Set(evs.map((e) => e.act))],
    };
  }

  function educacion(sem) {
    const rnd = VIZ.semilla(sem * 31 + 7), evs = [], objetos = [];
    let i = 0;
    const ev = (t, act, objs) => evs.push({ t, act, objs, i: i++ });
    const est = Array.from({ length: 6 }, (_, k) => 's' + (k + 1));
    est.forEach((s) => objetos.push([s, 'estudiante']));
    const cursos = ['c1', 'c2'], examen = { c1: 'e1', c2: 'e2' };
    cursos.forEach((c) => objetos.push([c, 'curso']));
    cursos.forEach((c) => objetos.push([examen[c], 'evaluación']));
    const lista = { c1: [], c2: [] };
    est.forEach((s, k) => {
      let en = cursos.filter(() => rnd() < 0.7);
      if (!en.length) en = [cursos[k % 2]];
      en.forEach((c) => { lista[c].push(s); ev(k * 0.4 + (c === 'c2' ? 0.1 : 0), 'Matricular', [s, c]); });
    });
    cursos.forEach((c, ci) => {
      const alum = lista[c], e = examen[c];
      let t = 10 + ci * 1.7;
      for (let w = 0; w < 3; w++) { ev(t += 2, 'Dictar clase', [c, ...alum]); alum.forEach((s) => { if (rnd() < 0.85) ev(t += 0.3, 'Entregar tarea', [s, c]); }); }
      alum.forEach((s) => ev(t += 0.4, 'Rendir evaluación', [s, e, c]));
      ev(t += 3, 'Calificar', [e, c]);
      ev(t += 2, 'Publicar notas', [c, e, ...alum]);
      const reclamos = alum.filter(() => rnd() < 0.3);
      reclamos.forEach((s) => ev(t += 0.5, 'Reclamar nota', [s, e, c]));
      if (reclamos.length) ev(t += 2, 'Revisar nota', [e, c]);
    });
    return armar('Educación', [['estudiante', C.s1], ['curso', C.s2], ['evaluación', C.s3]],
      { 'Matricular': 'Matricular', 'Dictar clase': 'Clase', 'Entregar tarea': 'Tarea', 'Rendir evaluación': 'Rendir', 'Calificar': 'Calificar', 'Publicar notas': 'Notas', 'Reclamar nota': 'Reclamar', 'Revisar nota': 'Revisar' }, objetos, evs);
  }

  function salud(sem) {
    const rnd = VIZ.semilla(sem * 53 + 11), evs = [], objetos = [];
    let i = 0;
    const ev = (t, act, objs) => evs.push({ t, act, objs, i: i++ });
    const camas = ['b1', 'b2', 'b3'], libre = { b1: 0, b2: 0, b3: 0 };
    camas.forEach((b) => objetos.push([b, 'cama']));
    let nx = 0;
    for (let k = 0; k < 7; k++) {
      const p = 'p' + (k + 1);
      objetos.push([p, 'paciente']);
      const llegada = k * 4;
      const b = camas.slice().sort((a, z) => libre[a] - libre[z] || a.localeCompare(z))[0];
      let t = Math.max(llegada, libre[b]);
      ev(t, 'Admitir', [p, b]);
      const nEx = 1 + Math.floor(rnd() * 3);
      let ultimo = t;
      for (let j = 0; j < nEx; j++) {
        const x = 'x' + (++nx);
        objetos.push([x, 'examen']);
        let u = t + 1 + j * 1.5 + rnd();
        ev(u, 'Solicitar examen', [p, x]);
        ev(u += 1 + rnd(), 'Tomar muestra', [x]);
        ev(u += 1 + rnd() * 2, 'Analizar muestra', [x]);
        ev(u += 1 + rnd(), 'Informar resultado', [x, p]);
        ultimo = Math.max(ultimo, u);
      }
      const alta = ultimo + 2 + rnd() * 3;
      ev(alta, 'Dar de alta', [p, b]);
      ev(alta + 1.5, 'Limpiar cama', [b]);
      libre[b] = alta + 3;
    }
    return armar('Salud', [['paciente', C.s1], ['examen', C.s2], ['cama', C.s3]],
      { 'Admitir': 'Admitir', 'Solicitar examen': 'Solicitar', 'Tomar muestra': 'Muestra', 'Analizar muestra': 'Analizar', 'Informar resultado': 'Informar', 'Dar de alta': 'Alta', 'Limpiar cama': 'Limpiar' }, objetos, evs);
  }

  /* ---------- Motor común: grafo de sucesión por tipo de objeto ---------- */

  // Aristas (tipo, de, a) con el número de objetos que pasaron de una actividad a otra.
  function aristasDe(evs, tipoDe) {
    const ult = new Map(), m = new Map();
    for (const e of evs) for (const o of e.objs) {
      if (ult.has(o)) { const k = [tipoDe[o], ult.get(o), e.act].join('\u0001'); m.set(k, (m.get(k) || 0) + 1); }
      ult.set(o, e.act);
    }
    return [...m.entries()].map(([k, n]) => { const [tipo, de, a] = k.split('\u0001'); return { tipo, de, a, n }; });
  }
  // Ruta de un objeto: pares consecutivos de actividades en sus eventos.
  function rutaDe(evs, o) {
    const r = new Map(), mios = evs.filter((e) => e.objs.includes(o));
    for (let k = 1; k < mios.length; k++) { const key = mios[k - 1].act + '\u0001' + mios[k].act; r.set(key, (r.get(key) || 0) + 1); }
    return { r, mios };
  }

  const CURVA = (tipos) => Object.fromEntries(tipos.map(([t], i) => [t, [0, 30, -30][i]]));
  const SALTO = (tipos) => Object.fromEntries(tipos.map(([t], i) => [t, [40, 70, -40][i]]));
  const altoGrafo = (w) => (w >= 640 ? 360 : 560);

  // Disposición en serpiente: las actividades van en orden de aparición, de izquierda a derecha y de vuelta,
  // en filas de 4 (pantallas anchas) o de 2 (angostas). Así ningún nodo tapa a otro y el flujo se sigue con la vista.
  function disposicion(ds, ancho) {
    const cols = ancho >= 640 ? 4 : 2, n = ds.acts.length, filas = Math.ceil(n / cols), p = {}, capa = {};
    ds.acts.forEach((a, i) => {
      const r = Math.floor(i / cols);
      let c = i % cols;
      if (r % 2) c = cols - 1 - c;
      p[a] = { x: c / (cols - 1), y: filas > 1 ? r / (filas - 1) : 0.5 };
      capa[a] = i;
    });
    return { p, capa };
  }

  // Dibuja el grafo. o: { evs, tipos (activos), min, sel (objeto seguido), nodoSel }.
  function dibujar(lienzo, ds, o) {
    lienzo.limpiar();
    const { p, capa } = disposicion(ds, lienzo.ancho), curva = CURVA(ds.tipos), salto = SALTO(ds.tipos);
    const todas = aristasDe(o.evs, ds.tipoDe), ruta = o.sel ? rutaDe(ds.evs, o.sel).r : null;
    const visibles = todas.filter((e) => o.tipos[e.tipo] && e.n >= o.min);
    const freq = new Map(ds.acts.map((a) => [a, 0]));
    for (const e of o.evs) freq.set(e.act, freq.get(e.act) + 1);
    const nombre = (a) => (lienzo.ancho < 640 ? ds.abrev[a] : a);
    const nodos = ds.acts.map((a) => ({
      id: a, tipo: 'act', etiqueta: `${nombre(a)} ×${freq.get(a)}`,
      relleno: a === o.nodoSel ? VIZ.alfa(C.s2, 0.2) : C.superficie, borde: a === o.nodoSel ? C.s2 : freq.get(a) ? C.tinta : C.tenue, colorTexto: freq.get(a) ? C.tinta : C.apagado,
    }));
    const aristas = visibles.map((e) => {
      const enRuta = ruta && o.sel && ruta.has(e.de + '\u0001' + e.a) && ds.tipoDe[o.sel] === e.tipo;
      const base = VIZ.alfa(ds.color[e.tipo], ruta && !enRuta ? 0.28 : 1);
      return { de: e.de, a: e.a, etiqueta: enRuta ? `${ruta.get(e.de + '\u0001' + e.a)}×` : e.n, ancho: enRuta ? 5 : 1.6 + Math.min(2.4, e.n * 0.35), color: base, colorTexto: ruta && !enRuta ? C.apagado : C.tinta2, curva: (capa[e.a] - capa[e.de] > 1 ? salto[e.tipo] : undefined) || curva[e.tipo] };
    });
    const info = P.dibujarGrafo(lienzo, nodos, aristas, p, { fuente: 10, margenX: 80, margenY: 54 });
    info.visibles = visibles; info.freq = freq;
    return info;
  }

  const leyendaTipos = (ds) => ds.tipos.map(([t, c]) => ({ color: c, texto: `objetos «${t}»`, forma: 'linea' }));
  const plural = (t) => (t === 'examen' ? 'exámenes' : t.endsWith('n') ? t.replace('ó', 'o') + 'es' : t + 's');

  /* ---------- Fig. 1: educación, filtrar y navegar ---------- */

  function montarEducacion(cuerpo) {
    const ds = educacion(1);
    let tipos = Object.fromEntries(ds.tipos.map(([t]) => [t, true])), min = 1, curso = 'todos', nodoSel = null, info = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Curso', opciones: [['todos', 'todos los cursos'], ['c1', 'curso c1'], ['c2', 'curso c2']], valor: curso, alCambiar: (v) => { curso = v; nodoSel = null; redibujar(); } });
    ctl.rango({ etiqueta: 'Mínimo de objetos por arista', min: 1, max: 6, valor: min, alCambiar: (v) => { min = v; redibujar(); } });
    ctl.casillas(ds.tipos.map(([t, c]) => ({ clave: t, texto: plural(t), color: c, activo: true })), (e) => { tipos = e; redibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoGrafo });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...leyendaTipos(ds), { color: C.s2, texto: 'actividad seleccionada', forma: 'punto' }]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada color es un tipo de objeto con su propio recorrido; una arista etiquetada con n significa que n objetos de ese tipo pasaron de una actividad a la otra. Haga clic en una actividad para ver qué objetos toca. Apague tipos para ver la vista de un solo objeto, o filtre por curso para ver un subproceso.');

    const evsVis = () => ds.evs.filter((e) => curso === 'todos' || e.objs.includes(curso));
    function redibujar() {
      const evs = evsVis();
      info = dibujar(lienzo, ds, { evs, tipos, min, nodoSel });
      const objs = new Set(evs.flatMap((e) => e.objs));
      lectura.set([
        ['eventos', `${evs.length} de ${ds.evs.length}`], ['objetos', String(objs.size)],
        ['aristas visibles', String(info.visibles.length)], ['objetos por evento', VIZ.fmt(evs.reduce((s, e) => s + e.objs.length, 0) / Math.max(1, evs.length), 3)],
      ]);
      if (nodoSel) {
        const es = evs.filter((e) => e.act === nodoSel);
        lista.replaceChildren(VIZ.el('div', null, `«${nodoSel}»: ${es.length} eventos`),
          ...ds.tipos.map(([t, c]) => {
            const os = [...new Set(es.flatMap((e) => e.objs).filter((o) => ds.tipoDe[o] === t))];
            return VIZ.el('div', null, VIZ.el('span', { style: { color: c, fontWeight: '600' } }, `${plural(t)}`.padEnd(13)), `${String(os.length).padStart(2)} distintos: ${os.join(' ') || '—'}`);
          }));
        registro.textContent = `En «${nodoSel}» cada evento toca en promedio ${VIZ.fmt(es.reduce((s, e) => s + e.objs.length, 0) / Math.max(1, es.length), 3)} objetos de ${ds.tipos.length} tipos: por eso pertenece a varios recorridos a la vez.`;
      } else {
        lista.replaceChildren(VIZ.el('div', null, 'Haga clic en una actividad del grafo para ver sus objetos.'));
        registro.textContent = curso === 'todos' ? 'Vista completa: tres tipos de objeto entrelazados en un mismo modelo.' : `Filtro: solo los ${evs.length} eventos que tocan al curso ${curso}.`;
      }
    }
    lienzo.alDibujar = redibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = info && P.nodoEn(info, x, y);
      nodoSel = n && n.id !== nodoSel ? n.id : null;
      redibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = info && P.nodoEn(info, x, y);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `<b>${n.id}</b><br>${info.freq.get(n.id)} eventos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    redibujar();
  }

  /* ---------- Fig. 2: salud, seguir un objeto por el modelo ---------- */

  function montarSalud(cuerpo) {
    let semilla = 1, ds = salud(semilla), tipos = null, sel = 'b1', info = null;
    const ctl = VIZ.controles(cuerpo);
    const opciones = () => ds.objetos.map(([o, t]) => [o, `${o} (${t})`]);
    const selector = ctl.selector({ etiqueta: 'Objeto a seguir', opciones: opciones(), valor: sel, alCambiar: (v) => { sel = v; redibujar(); } });
    ctl.boton('Nuevos datos', () => {
      semilla++; ds = salud(semilla);
      selector.select.replaceChildren(...opciones().map(([v, t]) => VIZ.el('option', { value: v }, t)));
      if (!ds.tipoDe[sel]) sel = 'b1';
      selector.valor = sel; redibujar();
    }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoGrafo });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...leyendaTipos(ds), { color: C.apagado, texto: 'trazo grueso: ruta del objeto elegido (n× = veces que la recorre)', forma: 'linea' }]);
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija una cama y verá un ciclo que ningún paciente recorre solo: Admitir → Dar de alta → Limpiar cama → Admitir. Elija un paciente y su ruta cruza la de sus exámenes en «Informar resultado». Haga clic en una actividad del grafo para listar los eventos del objeto elegido que ocurren allí.');

    let nodoSel = null;
    function redibujar() {
      tipos = Object.fromEntries(ds.tipos.map(([t]) => [t, true]));
      info = dibujar(lienzo, ds, { evs: ds.evs, tipos, min: 1, sel, nodoSel });
      const { mios } = rutaDe(ds.evs, sel);
      const relacion = new Map();
      for (const e of mios) for (const o of e.objs) if (o !== sel) relacion.set(o, (relacion.get(o) || 0) + 1);
      const grupos = ds.tipos.map(([t, c]) => [t, c, [...relacion.keys()].filter((o) => ds.tipoDe[o] === t)]).filter(([, , os]) => os.length);
      lista.replaceChildren(
        VIZ.el('div', null, `ruta: ${mios.map((e) => e.act).join(' › ')}`),
        ...grupos.map(([t, c, os]) => VIZ.el('div', null, VIZ.el('span', { style: { color: c, fontWeight: '600' } }, plural(t).padEnd(10)), ` comparte eventos con: ${os.map((o) => `${o} (${relacion.get(o)})`).join(' ')}`)));
      if (nodoSel) {
        const aqui = mios.filter((e) => e.act === nodoSel);
        registro.textContent = aqui.length ? `${sel} participa ${aqui.length} vez(veces) en «${nodoSel}», junto a ${[...new Set(aqui.flatMap((e) => e.objs).filter((o) => o !== sel))].join(', ') || 'ningún otro objeto'}.` : `${sel} nunca pasa por «${nodoSel}».`;
      } else registro.textContent = `Objeto ${sel} (${ds.tipoDe[sel]}): ${mios.length} eventos y ${relacion.size} objetos relacionados. Su ruta es el trazo grueso del grafo.`;
      lectura.set([
        ['eventos del objeto', String(mios.length)], ['objetos relacionados', String(relacion.size)],
        ['tipos con los que interactúa', String(grupos.length)], ['eventos del registro', String(ds.evs.length)], ['objetos del registro', String(ds.objetos.length)],
      ]);
    }
    lienzo.alDibujar = redibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = info && P.nodoEn(info, x, y);
      nodoSel = n && n.id !== nodoSel ? n.id : null;
      redibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), n = info && P.nodoEn(info, x, y);
      if (!n) return tip.ocultar();
      tip.mostrar(x, y, `<b>${n.id}</b><br>${info.freq.get(n.id)} eventos en el registro`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    redibujar();
  }

  VIZ.registrarTema('ocpm-applications', {
    intro: String.raw`
      <p>Los procesos reales no viven aislados: un estudiante cursa varias asignaturas, y cada asignatura tiene varios estudiantes y evaluaciones; un paciente se hace
      exámenes, ocupa una cama y esa cama pasa luego a otro paciente. Un modelo con un solo tipo de caso obliga a mirar estos procesos por separado y a perder cómo se afectan entre sí.</p>
      <p>La <strong>visualización centrada en objetos</strong> dibuja en un mismo grafo una ruta por tipo de objeto, con un color por tipo. Las actividades que tocan varios tipos son los puntos de
      encuentro, y ahí se ven las dependencias: la evaluación que no se califica retrasa las notas de todo un curso, la cama que no se limpia detiene el ingreso del paciente siguiente.</p>`,
    visualizaciones: [
      {
        titulo: 'Procesos de un curso universitario',
        descripcion: 'Un modelo con tres tipos de objeto: estudiante, curso y evaluación. Filtre por curso, apague tipos y suba el mínimo de objetos por arista; haga clic en «Publicar notas»: toca al curso, a la evaluación y a todos sus estudiantes.',
        montar: montarEducacion,
      },
      {
        titulo: 'Seguir una cama, un paciente o un examen',
        descripcion: 'En un hospital con tres tipos de objeto, elija una cama: su ruta es un ciclo entre pacientes. Luego elija un paciente o un examen y compare cómo se entrelazan; «Nuevos datos» cambia quién usa cada cama.',
        montar: montarSalud,
      },
    ],
    teoria: String.raw`
      <h2>Un grafo con una capa por tipo</h2>
      <p>Dado un registro centrado en objetos \(L\) (ver <a href="tema.html?id=object-centric-event-logs">Object-Centric Event Logs</a>), la traza de cada objeto \(o\) es la secuencia de sus eventos
      \(\sigma_o=\langle e_1,\dots,e_m\rangle\). Para cada tipo \(\tau\) y cada par de actividades \(a,b\), el peso de la arista es</p>
      \[ w_\tau(a,b)=\bigl|\{(o,k): \text{tipo}(o)=\tau,\ \text{act}(e_k)=a,\ \text{act}(e_{k+1})=b\}\bigr|, \]
      <p>es decir, cuántas veces un objeto de tipo \(\tau\) pasó de \(a\) a \(b\) en su propia traza. Cada evento cuenta una sola vez para su actividad, aunque toque muchos objetos, y cada tipo produce su propia
      capa. Es la versión multi-tipo del <a href="tema.html?id=directly-follows-graphs">grafo de sucesión directa</a>.</p>
      <pre><code>para cada objeto o:  σ_o ← eventos de o ordenados por tiempo
para cada tipo τ, cada o de tipo τ, cada par consecutivo (a, b) de σ_o:
    w[τ][a][b] += 1
dibujar nodos = actividades (con frecuencia de eventos)
dibujar aristas = (τ, a, b) con w ≥ umbral, un color por τ</code></pre>
      <h2>Interpretación y lectura</h2>
      <ul>
        <li><strong>Actividad compartida</strong>: nodo por el que pasan aristas de varios colores. Es un punto de sincronización entre tipos.</li>
        <li><strong>Ciclo de un tipo</strong>: la cama pasa por <em>Admitir → Dar de alta → Limpiar cama → Admitir</em>; el ciclo existe porque la cama es un recurso reutilizado, no porque un paciente se repita.</li>
        <li><strong>Muchos a muchos</strong>: «Publicar notas» pertenece a un curso, una evaluación y varios estudiantes; en un modelo plano habría que duplicarla o elegir un tipo.</li>
      </ul>
      <h2>Educación y salud</h2>
      <p>En <em>educación</em>, los objetos son estudiantes, cursos y evaluaciones, y los vínculos (matrícula, evaluación de un curso) son relaciones objeto–objeto: el modelo permite ver, por ejemplo, si
      los reclamos de nota se concentran en un curso. En <em>salud</em>, pacientes, exámenes y camas permiten medir esperas de resultados y rotación de camas sin mezclar ambos flujos en una misma traza.</p>
      <div class="recuadro">Los grafos centrados en objetos crecen rápido: cinco tipos y veinte actividades pueden dar cientos de aristas. Por eso las herramientas permiten filtrar por tipo, por frecuencia mínima (el control
      «mínimo de objetos») y por un objeto concreto, que es lo que hacen las dos figuras.</div>
      <h2>Conexiones</h2>
      <p>El riesgo de aplanar este tipo de procesos (convergencia y divergencia) se vio en <a href="tema.html?id=object-centric-event-logs">Object-Centric Event Logs</a>. Los modelos formales equivalentes
      son las redes de Petri con arcos variables (<a href="tema.html?id=petri-nets">Petri Nets</a>). Para más dominios, vea
      <a href="tema.html?id=process-mining-applications">Applications in Industry, Education and Healthcare</a>, y para los números sobre estas rutas,
      <a href="tema.html?id=resource-workload">Resource Workload and Bottlenecks</a>.</p>`,
  });
})();
