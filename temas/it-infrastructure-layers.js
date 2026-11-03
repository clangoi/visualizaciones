(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Las siete capas de una aplicación empresarial y de qué otras capas depende cada una.
     `x` es la posición horizontal relativa y `fila` la altura (0 = base). */
  const CAPAS = [
    { id: 'energia', corto: 'Energía y clima', nombre: 'Centro de datos: energía y refrigeración', ej: 'UPS, generador, aire acondicionado, sala segura', deps: [], x: 0.5, fila: 0 },
    { id: 'servidores', corto: 'Servidores', nombre: 'Servidores físicos', ej: 'CPU, memoria, discos locales, tarjetas de red', deps: ['energia'], x: 0.18, fila: 1 },
    { id: 'almacenamiento', corto: 'Almacenam.', nombre: 'Almacenamiento compartido', ej: 'cabinas SAN/NAS, discos, cintas de respaldo', deps: ['energia', 'red'], x: 0.5, fila: 1 },
    { id: 'red', corto: 'Red', nombre: 'Redes', ej: 'switches, routers, enlaces a Internet, firewall', deps: ['energia'], x: 0.82, fila: 1 },
    { id: 'virtual', corto: 'SO y virtualiz.', nombre: 'Sistema operativo y virtualización', ej: 'Linux/Windows, hipervisor, máquinas virtuales', deps: ['servidores', 'almacenamiento'], x: 0.34, fila: 2 },
    { id: 'plataforma', corto: 'BD y middleware', nombre: 'Bases de datos y middleware', ej: 'motor de base de datos, servidor de aplicaciones, colas', deps: ['virtual', 'red'], x: 0.34, fila: 3 },
    { id: 'aplicacion', corto: 'Aplicaciones', nombre: 'Aplicaciones empresariales', ej: 'ERP, CRM, correo, sitio web', deps: ['plataforma', 'red'], x: 0.5, fila: 4 },
  ];
  const POR_ID = new Map(CAPAS.map((c) => [c.id, c]));
  // Orden en que una capa tiene todas sus dependencias antes que ella.
  const ORDEN = ['energia', 'red', 'servidores', 'almacenamiento', 'virtual', 'plataforma', 'aplicacion'];

  // Capas caídas cuando falla `raiz`: mapa id → { onda, tipo }. Con respaldo, la falla no se propaga.
  function propagar(raiz, respaldo) {
    const est = new Map();
    if (!raiz) return est;
    if (respaldo) { est.set(raiz, { onda: 0, tipo: 'absorbida' }); return est; }
    est.set(raiz, { onda: 0, tipo: 'raiz' });
    for (let o = 1; o < 10; o++) {
      const nuevas = CAPAS.filter((c) => !est.has(c.id) && c.deps.some((d) => est.has(d)));
      if (!nuevas.length) break;
      nuevas.forEach((c) => est.set(c.id, { onda: o, tipo: 'cae' }));
    }
    return est;
  }
  const impacto = (id) => propagar(id, false).size;

  // Dibuja la pila de capas y devuelve las cajas para detectar clics.
  // estilo(id) → { relleno, tinta, borde, grueso, linea2 }; arista(dep, id) → color o null.
  function dibujarPila(lienzo, estilo, arista) {
    const { ctx, ancho: W } = lienzo;
    const w = Math.min(138, W * 0.29), h = 36;
    const caja = (c) => ({ id: c.id, x: c.x * W - w / 2, y: 14 + (4 - c.fila) * 62, w, h });
    const cajas = CAPAS.map(caja);
    const de = new Map(cajas.map((b) => [b.id, b]));
    for (const c of CAPAS) for (const d of c.deps) {
      const a = de.get(d), b = de.get(c.id);
      const col = arista(d, c.id);
      let x0, y0, x1, y1;
      if (POR_ID.get(d).fila === c.fila) { x0 = a.x + (a.x < b.x ? w : 0); y0 = a.y + h / 2; x1 = b.x + (a.x < b.x ? 0 : w); y1 = y0; }
      else { x0 = a.x + w / 2; y0 = a.y; x1 = b.x + w / 2; y1 = b.y + h; }
      ctx.strokeStyle = col.color; ctx.lineWidth = col.ancho; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ctx.fillStyle = col.color; ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x1 - 8 * Math.cos(ang - 0.4), y1 - 8 * Math.sin(ang - 0.4)); ctx.lineTo(x1 - 8 * Math.cos(ang + 0.4), y1 - 8 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
    }
    for (const b of cajas) {
      const e = estilo(b.id), c = POR_ID.get(b.id);
      ctx.fillStyle = e.relleno; ctx.strokeStyle = e.borde; ctx.lineWidth = e.grueso || 1.5;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = e.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = VIZ.fuente(10.5, 600); ctx.fillText(c.corto, b.x + b.w / 2, b.y + 14);
      ctx.font = VIZ.fuente(10, 400); ctx.fillText(e.linea2, b.x + b.w / 2, b.y + 27);
    }
    return cajas;
  }
  const caja = (cajas, x, y) => cajas.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  const lista = (ids) => ids.map((i) => POR_ID.get(i).corto).join(', ') || '—';

  /* ---------- Fig. 1: propagación de una falla ---------- */

  function montarPropagacion(cuerpo) {
    let fallo = 'energia', respaldo = false, olas = new Map(), onda = 0, cajas = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({
      etiqueta: 'Capa que falla', opciones: CAPAS.map((c) => [c.id, c.corto]), valor: fallo,
      alCambiar: (v) => { fallo = v; rep.reiniciar(); },
    });
    ctl.casilla({ etiqueta: 'La capa tiene respaldo redundante', valor: respaldo, alCambiar: (v) => { respaldo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 316 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta, texto: 'capa operativa' },
      { color: C.s8, texto: 'falla de origen' },
      { color: C.s2, texto: 'cae por depender de una capa caída' },
      { color: C.s4, texto: 'falla absorbida por el respaldo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una capa para hacerla fallar (o use el selector) y pulse «Un paso» para ver cómo la falla sube, onda por onda. Active el respaldo para ver que la redundancia la contiene. Pase el cursor sobre una capa para ver su radio de impacto.');

    function iniciar() {
      olas = propagar(fallo, respaldo);
      onda = 0;
      return (function* () {
        const max = Math.max(...[...olas.values()].map((v) => v.onda));
        for (let o = 1; o <= max; o++) { onda = o; yield; }
      })();
    }
    const visible = (id) => olas.has(id) && olas.get(id).onda <= onda;
    function dibujar() {
      lienzo.limpiar();
      cajas = dibujarPila(lienzo, (id) => {
        const v = visible(id) ? olas.get(id) : null;
        if (!v) return { relleno: C.superficie, tinta: C.tinta, borde: C.tinta, linea2: 'operativa' };
        if (v.tipo === 'absorbida') return { relleno: C.s4, tinta: C.tinta, borde: C.tinta, grueso: 3, linea2: 'respaldo activo' };
        if (v.tipo === 'raiz') return { relleno: C.s8, tinta: C.sobre, borde: C.tinta, grueso: 3, linea2: 'FALLA' };
        return { relleno: C.s2, tinta: C.sobre, borde: C.tinta, linea2: `cae (onda ${v.onda})` };
      }, (d, id) => (visible(d) && visible(id) && !respaldo ? { color: C.s8, ancho: 3 } : { color: C.eje, ancho: 1.5 }));
      lienzo.ctx.fillStyle = C.apagado; lienzo.ctx.font = VIZ.fuente(10); lienzo.ctx.textAlign = 'left'; lienzo.ctx.textBaseline = 'top';
      lienzo.ctx.fillText('las flechas van de la capa que sostiene a la que depende de ella', 6, lienzo.alto - 13);
      const caidas = CAPAS.filter((c) => visible(c.id) && olas.get(c.id).tipo !== 'absorbida').map((c) => c.id);
      const total = [...olas.values()].filter((v) => v.tipo !== 'absorbida').length;
      const maxOnda = Math.max(0, ...[...olas.values()].map((v) => v.onda));
      registro.textContent = respaldo
        ? `${POR_ID.get(fallo).nombre} falla, pero su respaldo toma el relevo: ninguna otra capa se entera. Es el valor de la redundancia.`
        : onda === 0
          ? `Falla ${POR_ID.get(fallo).nombre}. Aún no se propaga: pulse «Un paso».`
          : `Onda ${onda}: ${lista(CAPAS.filter((c) => olas.get(c.id) && olas.get(c.id).onda === onda).map((c) => c.id))} ${CAPAS.filter((c) => olas.get(c.id) && olas.get(c.id).onda === onda).length > 1 ? 'caen' : 'cae'} porque dependen de una capa que ya no responde.`;
      const worst = CAPAS.map((c) => [c.id, impacto(c.id)]).sort((a, b) => b[1] - a[1])[0];
      lectura.set([
        ['capas caídas ahora', `${caidas.length} de ${CAPAS.length}`],
        ['alcance final', respaldo ? '0 capas' : `${total} de ${CAPAS.length}`],
        ['ondas de propagación', String(respaldo ? 0 : maxOnda)],
        ['aplicaciones', visible('aplicacion') && olas.get('aplicacion').tipo !== 'absorbida' ? 'sin servicio' : 'en servicio'],
        ['mayor radio de impacto', `${POR_ID.get(worst[0]).corto} (${worst[1]} capas)`],
      ]);
    }
    lienzo.alDibujar = () => olas.size && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = caja(cajas, x, y);
      if (!b) return;
      fallo = b.id; sel.valor = b.id; rep.reiniciar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = caja(cajas, x, y);
      if (!b) { hover = null; return tip.ocultar(); }
      const c = POR_ID.get(b.id);
      hover = b.id;
      tip.mostrar(x, y, `<b>${c.nombre}</b><br>${c.ej}<br>depende de: ${lista(c.deps)}<br>si falla, caen <b>${impacto(c.id)}</b> de ${CAPAS.length} capas`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  /* ---------- Fig. 2: diagnóstico de un incidente ---------- */

  const ESTRATEGIAS = { abajo: 'De abajo hacia arriba', arriba: 'De arriba hacia abajo', manual: 'Manual (clic en las capas)' };

  // Causa raíz identificada: capa que no responde y cuyas dependencias se probaron y responden.
  function identificada(pr) {
    for (const [id, abajo] of pr) if (abajo && POR_ID.get(id).deps.every((d) => pr.get(d) === false)) return id;
    return null;
  }
  function* diagnostico(estr, caidas, pr, sondear) {
    if (estr === 'abajo') {
      for (const id of ORDEN) {
        if (identificada(pr)) return;
        if (!pr.has(id)) { sondear(id); yield id; }
      }
    } else if (estr === 'arriba') {
      let n = 'aplicacion';
      while (!identificada(pr)) {
        let sig = null;
        for (const d of POR_ID.get(n).deps) {
          if (!pr.has(d)) { sondear(d); yield d; }
          if (pr.get(d)) { sig = d; break; }
        }
        if (!sig) return;
        n = sig;
      }
    }
  }
  // Sondeos promedio de una estrategia sobre las siete causas raíz posibles.
  function promedioSondeos(estr) {
    let tot = 0;
    for (const r of CAPAS) {
      const caidas = propagar(r.id, false), pr = new Map([['aplicacion', true]]);
      let n = 0;
      for (const _ of diagnostico(estr, caidas, pr, (id) => { pr.set(id, caidas.has(id)); n++; }));
      tot += n;
    }
    return tot / CAPAS.length;
  }

  function montarDiagnostico(cuerpo) {
    let semilla = 1, estr = 'abajo', raiz = 'red', caidas = new Map(), pr = new Map(), cajas = [], sondeos = 0, msg = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estrategia', opciones: Object.entries(ESTRATEGIAS), valor: estr, alCambiar: (v) => { estr = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevo incidente', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 316 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, borde: C.inactivo, texto: 'sin sondear' },
      { color: C.s6, texto: 'sondeada: responde' },
      { color: C.s8, texto: 'sondeada: no responde' },
      { color: C.superficie, borde: C.s7, texto: 'causa raíz identificada' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El único síntoma es «las aplicaciones no responden». Sondee capas con un clic (modo manual) o deje que una estrategia lo haga con el reproductor; la causa raíz es la capa caída cuyas dependencias responden. Pulse «Nuevo incidente» para otra falla.');

    function sondear(id) {
      pr.set(id, caidas.has(id)); sondeos++;
      msg = `Sondeo ${sondeos}: ${POR_ID.get(id).corto} ${caidas.has(id) ? 'no responde' : 'responde, así que se descarta junto con lo que sostiene'}.`;
    }
    function iniciar() {
      raiz = CAPAS[Math.floor(VIZ.semilla(semilla * 977 + 5)() * CAPAS.length)].id;
      caidas = propagar(raiz, false);
      pr = new Map([['aplicacion', true]]); sondeos = 0;
      msg = 'Síntoma: las aplicaciones no responden. ¿Qué capa es la causa raíz?';
      return diagnostico(estr, caidas, pr, sondear);
    }
    function dibujar() {
      lienzo.limpiar();
      const causa = identificada(pr);
      cajas = dibujarPila(lienzo, (id) => {
        const base = pr.has(id) ? (pr.get(id) ? { relleno: C.s8, tinta: C.sobre, linea2: 'no responde' } : { relleno: C.s6, tinta: C.sobre, linea2: 'responde' }) : { relleno: C.neutro, tinta: C.apagado, linea2: '?' };
        return causa === id ? { ...base, borde: C.s7, grueso: 4, linea2: 'CAUSA RAÍZ' } : { ...base, borde: pr.has(id) ? C.tinta : C.inactivo };
      }, () => ({ color: C.eje, ancho: 1.5 }));
      if (causa) registro.textContent = `${msg} Causa raíz: ${POR_ID.get(causa).nombre}, identificada con ${sondeos} sondeos.`;
      else registro.textContent = msg;
      const pa = promedioSondeos('abajo'), pt = promedioSondeos('arriba');
      lectura.set([
        ['sondeos usados', String(sondeos)],
        ['estado', causa ? 'causa identificada' : 'buscando'],
        ['promedio de abajo hacia arriba', VIZ.fmt(pa, 3)],
        ['promedio de arriba hacia abajo', VIZ.fmt(pt, 3)],
        ['causa real', causa ? POR_ID.get(raiz).corto : 'oculta'],
      ]);
    }
    lienzo.alDibujar = () => caidas.size && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = caja(cajas, x, y);
      if (!b || pr.has(b.id) || identificada(pr)) return;
      sondear(b.id); dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = caja(cajas, x, y);
      if (!b) return tip.ocultar();
      const c = POR_ID.get(b.id);
      tip.mostrar(x, y, `<b>${c.nombre}</b><br>${c.ej}<br>depende de: ${lista(c.deps)}<br>estado: <b>${pr.has(b.id) ? (pr.get(b.id) ? 'no responde' : 'responde') : 'sin sondear'}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('it-infrastructure-layers', {
    intro: String.raw`
      <p>La <strong>infraestructura de TI</strong> es todo lo que sostiene a las aplicaciones de una organización: la energía y la sala del centro de datos, las redes,
      los servidores, el almacenamiento, el sistema operativo y la virtualización, y las bases de datos y el <em>middleware</em>. Se entiende mejor como una pila de capas,
      donde cada una presta un servicio a la de arriba.</p>
      <p>Esa pila tiene una consecuencia práctica: lo que usted ve fallar (una aplicación lenta o caída) casi nunca es lo que realmente se rompió. Saber qué capa depende de cuál
      permite estimar el alcance de una falla y encontrar su origen sin probar a ciegas.</p>`,
    visualizaciones: [
      {
        titulo: 'Cómo sube una falla por las capas',
        descripcion: 'Elija una capa que falla y avance onda por onda: las que dependen de ella caen en cadena. Pruebe la energía (cae todo) y luego una capa alta (casi nada), y active el respaldo redundante.',
        montar: montarPropagacion,
      },
      {
        titulo: 'Encontrar la capa culpable',
        descripcion: 'Solo se ve que las aplicaciones no responden. Sondee capas a mano o compare las estrategias «de abajo hacia arriba» y «de arriba hacia abajo»; la lectura muestra cuántos sondeos necesita cada una en promedio.',
        montar: montarDiagnostico,
      },
    ],
    teoria: String.raw`
      <h2>Definición: las capas de la infraestructura</h2>
      <p>La infraestructura reúne <em>hardware</em> (servidores, almacenamiento, equipos de red), <em>software</em> de base (sistema operativo, hipervisor, bases de datos, <em>middleware</em>)
      y las instalaciones que los alojan (el <em>centro de datos</em>: energía, refrigeración, seguridad física). Las aplicaciones de negocio se construyen encima.</p>
      <table>
        <tr><th>Capa</th><th>Ejemplo</th><th>De qué depende</th></tr>
        <tr><td>Centro de datos</td><td>UPS, generador, refrigeración</td><td>suministro eléctrico externo</td></tr>
        <tr><td>Redes</td><td>switches, enlaces, firewall</td><td>energía</td></tr>
        <tr><td>Servidores</td><td>CPU, memoria, discos locales</td><td>energía</td></tr>
        <tr><td>Almacenamiento</td><td>cabinas SAN/NAS</td><td>energía, red</td></tr>
        <tr><td>SO y virtualización</td><td>hipervisor, máquinas virtuales</td><td>servidores, almacenamiento</td></tr>
        <tr><td>Plataforma</td><td>base de datos, servidor de aplicaciones</td><td>virtualización, red</td></tr>
        <tr><td>Aplicaciones</td><td>ERP, CRM, correo</td><td>plataforma, red</td></tr>
      </table>
      <h2>Dependencias y propagación de fallas</h2>
      <p>Si \(D(x)\) son las capas de las que depende directamente la capa \(x\), el conjunto de capas caídas \(F\) cuando falla una capa \(r\) es la menor familia que cumple</p>
      \[ r \in F, \qquad x \in F \ \text{si}\ D(x) \cap F \neq \varnothing. \]
      <p>Es una clausura en un grafo de dependencias sin ciclos. El <em>radio de impacto</em> de \(r\) es \(|F|\): la energía arrastra a las siete capas; una falla en la aplicación, solo a sí misma.
      La <strong>redundancia</strong> corta la propagación: si la capa tiene un reemplazo listo, \(F = \varnothing\) desde el punto de vista del usuario.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Como las siete capas son ancestros de la aplicación, ésta funciona solo si todas funcionan: están «en serie». Si cada una tiene disponibilidad 99,9 %:</p>
      \[ A = 0{,}999^{7} \approx 0{,}99302, \qquad (1 - A)\cdot 8\,760\ \text{h} \approx 61\ \text{h al año}. \]
      <p>Cada capa individual parece excelente (8,8 horas de caída al año) y la aplicación, sin embargo, queda unas 61 horas fuera de servicio. Por eso se invierte en redundancia en las capas bajas, que arrastran más.</p>
      <h2>Diagnóstico</h2>
      <p>Para localizar el origen se busca una capa que no responda y cuyas dependencias sí respondan. Probar «de abajo hacia arriba» cuesta, en el peor caso, una prueba por capa; seguir las dependencias que fallan
      «de arriba hacia abajo» suele necesitar menos cuando la causa está en el medio de la pila. En la figura puede verificarlo con los promedios exactos sobre las siete causas posibles.</p>
      <div class="recuadro"><p><strong>Idea clave.</strong> Un síntoma en la capa alta no dice nada sobre la capa de origen: se razona siguiendo el grafo de dependencias, no el aspecto de la pantalla.</p></div>
      <h2>Conexiones</h2>
      <p>Las capas pueden compartirse con un proveedor según el modelo de servicio en la nube (<a href="tema.html?id=cloud-service-models">IaaS, PaaS y SaaS</a>); la
      <a href="tema.html?id=virtualization">virtualización</a> separa el sistema operativo del hardware; la disponibilidad se calcula en
      <a href="tema.html?id=scalability-availability">escalabilidad y disponibilidad</a>; y su gestión cotidiana en
      <a href="tema.html?id=infrastructure-administration">administración de infraestructura</a>.</p>`,
  });
})();
