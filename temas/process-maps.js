(function () {
  'use strict';
  const { color: C } = VIZ;
  const P = VIZ.proc;

  /* ---------- Datos: mapa de una distribuidora de equipos tecnológicos ---------- */

  const sub = (n, ...acts) => ({ n, acts });
  const CATS = [
    { id: 'gestion', nombre: 'Procesos de gestión', color: C.s7 },
    { id: 'principal', nombre: 'Procesos principales (cadena de valor)', color: C.s1 },
    { id: 'apoyo', nombre: 'Procesos de apoyo', color: C.s3 },
  ];
  const PROCESOS = [
    { id: 'plan', cat: 'gestion', n: 'Planificación estratégica', subs: [sub('Definir objetivos anuales', 'Analizar el mercado', 'Fijar metas', 'Aprobar el plan'), sub('Hacer seguimiento', 'Reunir indicadores', 'Revisar desviaciones')] },
    { id: 'cal', cat: 'gestion', n: 'Gestión de calidad', subs: [sub('Auditar procesos', 'Planificar la auditoría', 'Ejecutar la auditoría', 'Informar hallazgos'), sub('Gestionar no conformidades', 'Registrar la no conformidad', 'Definir acción correctiva', 'Verificar su cierre')] },
    { id: 'rie', cat: 'gestion', n: 'Gestión de riesgos', subs: [sub('Identificar riesgos', 'Levantar riesgos con las áreas', 'Evaluar probabilidad e impacto'), sub('Mitigar', 'Definir controles', 'Monitorear controles')] },
    { id: 'cap', cat: 'principal', n: 'Captar clientes', subs: [sub('Prospectar', 'Identificar clientes potenciales', 'Contactar al cliente'), sub('Calificar la oportunidad', 'Evaluar la necesidad', 'Estimar el tamaño de la compra')] },
    { id: 'ven', cat: 'principal', n: 'Vender', subs: [sub('Cotizar', 'Levantar requerimientos', 'Armar la cotización', 'Enviar al cliente'), sub('Negociar', 'Revisar condiciones', 'Acordar el precio'), sub('Cerrar la venta', 'Registrar la orden', 'Confirmar el pago')] },
    { id: 'pre', cat: 'principal', n: 'Preparar pedido', subs: [sub('Abastecer', 'Verificar stock', 'Solicitar reposición'), sub('Armar el pedido', 'Retirar productos', 'Empacar', 'Etiquetar')] },
    { id: 'ent', cat: 'principal', n: 'Entregar', subs: [sub('Despachar', 'Asignar transportista', 'Entregar al transportista'), sub('Confirmar la entrega', 'Recibir comprobante', 'Notificar al cliente')] },
    { id: 'pos', cat: 'principal', n: 'Posventa', subs: [sub('Atender reclamos', 'Registrar el reclamo', 'Investigar', 'Resolver'), sub('Gestionar garantías', 'Validar la garantía', 'Reparar o reponer')] },
    { id: 'per', cat: 'apoyo', n: 'Gestión de personas', subs: [sub('Contratar', 'Definir el perfil', 'Reclutar', 'Seleccionar', 'Contratar'), sub('Desarrollar', 'Detectar necesidades', 'Capacitar')] },
    { id: 'ti', cat: 'apoyo', n: 'Tecnología', subs: [sub('Operar sistemas', 'Monitorear servicios', 'Atender incidentes'), sub('Gestionar accesos', 'Crear usuarios', 'Revisar permisos')] },
    { id: 'fin', cat: 'apoyo', n: 'Finanzas y contabilidad', subs: [sub('Facturar y cobrar', 'Emitir factura', 'Conciliar pagos', 'Gestionar morosidad'), sub('Pagar', 'Aprobar facturas de proveedores', 'Ejecutar el pago')] },
    { id: 'com', cat: 'apoyo', n: 'Compras', subs: [sub('Cotizar proveedores', 'Solicitar cotizaciones', 'Comparar ofertas'), sub('Emitir orden de compra', 'Aprobar la orden', 'Enviarla al proveedor')] },
  ];
  const nActs = (p) => p.subs.reduce((s, x) => s + x.acts.length, 0);
  const TOTAL_SUBS = PROCESOS.reduce((s, p) => s + p.subs.length, 0);
  const TOTAL_ACTS = PROCESOS.reduce((s, p) => s + nActs(p), 0);
  const NIVELES = ['Nivel 0: procesos', 'Nivel 1: subprocesos', 'Nivel 2: actividades'];

  // Parte el texto en a lo sumo dos líneas que quepan en `ancho` píxeles.
  function partir(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return [texto];
    const pal = texto.split(' ');
    let mejor = [texto, ''];
    for (let i = 1; i < pal.length; i++) {
      const a = pal.slice(0, i).join(' '), b = pal.slice(i).join(' ');
      if (Math.max(ctx.measureText(a).width, ctx.measureText(b).width) < Math.max(ctx.measureText(mejor[0]).width, ctx.measureText(mejor[1]).width)) mejor = [a, b];
    }
    return mejor;
  }

  /* ---------- Fig. 1: el mapa de nivel alto y sus niveles ---------- */

  function montarMapa(cuerpo) {
    let sel = PROCESOS.find((p) => p.id === 'ven'), nivel = 2, todos = false, hover = null, rects = [];
    let mensaje = 'Haga clic en un proceso del mapa para expandirlo.';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Nivel de detalle', min: 0, max: 2, valor: nivel, formato: (v) => NIVELES[v], alCambiar: (v) => { nivel = v; mensaje = `Se muestra hasta el ${NIVELES[v].toLowerCase()}.`; dibujar(); } });
    ctl.casilla({ etiqueta: 'Expandir todos los procesos', valor: todos, alCambiar: (v) => { todos = v; mensaje = v ? 'Se muestra la jerarquía completa de la empresa.' : `Solo se expande «${sel.n}».`; dibujar(); } });
    ctl.boton('Siguiente proceso', () => { sel = PROCESOS[(PROCESOS.indexOf(sel) + 1) % PROCESOS.length]; mensaje = `Proceso elegido: «${sel.n}».`; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 3 * 68 + 2 * 8 + 4 });
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, CATS.map((c) => ({ color: c.color, texto: c.nombre })));
    const lista = VIZ.el('div', { class: 'lista-mono' });
    cuerpo.appendChild(lista);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un proceso del mapa (o en «Siguiente proceso») y cambie el nivel de detalle: el mapa es el nivel 0 y cada nivel agrega el desglose de lo anterior. Pase el cursor para ver cuántos subprocesos y actividades tiene.');

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      rects = [];
      const mx = 8, gap = 6, bandaH = 68;
      CATS.forEach((cat, i) => {
        const y0 = i * (bandaH + 8), ps = PROCESOS.filter((p) => p.cat === cat.id), n = ps.length;
        ctx.fillStyle = C.fondo2; ctx.fillRect(0, y0, W, bandaH);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(cat.nombre.toUpperCase(), mx, y0 + 4);
        const bw = (W - 2 * mx - (n - 1) * gap) / n, by = y0 + 20, bh = 42, punta = cat.id === 'principal' ? 9 : 0;
        ps.forEach((p, k) => {
          const x = mx + k * (bw + gap);
          ctx.beginPath();
          ctx.moveTo(x, by); ctx.lineTo(x + bw - punta, by); if (punta) ctx.lineTo(x + bw, by + bh / 2); ctx.lineTo(x + bw - punta, by + bh); ctx.lineTo(x, by + bh);
          if (punta && k > 0) ctx.lineTo(x + punta * 0.4, by + bh / 2);
          ctx.closePath();
          ctx.fillStyle = VIZ.alfa(cat.color, p === hover ? 0.4 : 0.22); ctx.fill();
          ctx.strokeStyle = p === sel ? C.tinta : cat.color; ctx.lineWidth = p === sel ? 3 : 1.5; ctx.stroke();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const ls = partir(ctx, p.n, bw - 16 - punta);
          ls.forEach((t, j) => ctx.fillText(t, x + (bw - punta) / 2 + 2, by + bh / 2 + (j - (ls.length - 1) / 2) * 12));
          rects.push({ x, y: by, w: bw, h: bh, p });
        });
      });
      // Lista jerárquica según el nivel elegido.
      const ps = todos ? PROCESOS : [sel], lineas = [];
      ps.forEach((p) => {
        lineas.push({ t: `● ${p.n}`, activa: p === sel });
        if (nivel >= 1) p.subs.forEach((s) => {
          lineas.push({ t: `    ○ ${s.n}` });
          if (nivel >= 2) s.acts.forEach((a) => lineas.push({ t: `        – ${a}` }));
        });
      });
      lista.replaceChildren(...lineas.map((l) => VIZ.el('div', { class: l.activa ? 'activa' : null }, l.t)));
      registro.textContent = mensaje;
      lectura.set([
        ['proceso elegido', sel.n],
        ['subprocesos / actividades', `${sel.subs.length} / ${nActs(sel)}`],
        ['actividades por subproceso', VIZ.fmt(nActs(sel) / sel.subs.length, 3)],
        ['líneas visibles', String(lineas.length)],
        ['en toda la empresa', `${PROCESOS.length} procesos, ${TOTAL_SUBS} subprocesos, ${TOTAL_ACTS} actividades`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const buscar = (ev) => { const { x, y } = lienzo.posicion(ev); return { x, y, r: rects.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) }; };
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y, r } = buscar(ev);
      const h = r ? r.p : null;
      if (h !== hover) { hover = h; dibujar(); }
      if (!r) return tip.ocultar();
      tip.mostrar(x, y, `<b>${r.p.n}</b><br>${r.p.subs.length} subprocesos<br>${nActs(r.p)} actividades`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { r } = buscar(ev);
      if (!r) return;
      sel = r.p; mensaje = `Proceso elegido: «${sel.n}» (${NIVELES[nivel].toLowerCase()}).`; dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: descubrir el proceso desde varias fuentes ---------- */

  // Atención de reclamos. id → nombre completo, nombre corto y subproceso del nivel 1.
  const ACT = {
    rec: ['Recibir reclamo', 'Recibir', 'Recepción'], reg: ['Registrar en el sistema', 'Registrar', 'Recepción'], cla: ['Clasificar el reclamo', 'Clasificar', 'Análisis'],
    inv: ['Investigar el caso', 'Investigar', 'Análisis'], ped: ['Pedir información al cliente', 'Pedir info', 'Análisis'], res: ['Resolver', 'Resolver', 'Resolución'],
    cal: ['Control de calidad', 'Control cal.', 'Resolución'], apr: ['Aprobar compensación', 'Aprobar', 'Resolución'], not: ['Notificar al cliente', 'Notificar', 'Cierre'], cer: ['Cerrar el caso', 'Cerrar', 'Cierre'],
  };
  const IDS = Object.keys(ACT);
  const REALES = IDS.filter((i) => i !== 'cal');
  const SUBPROC = ['Recepción', 'Análisis', 'Resolución', 'Cierre'];
  // Flujo real (con un ciclo de «pedir información» y una aprobación opcional) y flujo documentado en el manual.
  const ARISTAS_REALES = [['rec', 'reg'], ['reg', 'cla'], ['cla', 'inv'], ['inv', 'ped'], ['ped', 'inv'], ['inv', 'res'], ['res', 'apr'], ['res', 'not'], ['apr', 'not'], ['not', 'cer']];
  const ARISTAS = ARISTAS_REALES.concat([['res', 'cal'], ['cal', 'apr']]);
  const FUENTES = [
    { id: 'eje', n: 'Entrevista: ejecutivo de atención', sabe: ['rec', 'reg', 'cla', 'not', 'cer'] },
    { id: 'ana', n: 'Entrevista: analista', sabe: ['inv', 'ped', 'res'] },
    { id: 'jef', n: 'Entrevista: jefatura', sabe: ['cla', 'res', 'cal', 'apr', 'not'] },
    { id: 'obs', n: 'Observación en terreno', sabe: ['rec', 'reg', 'cla', 'inv', 'ped', 'res'] },
    { id: 'log', n: 'Registro del sistema', sabe: ['reg', 'cla', 'inv', 'res', 'apr', 'not', 'cer'] },
    { id: 'man', n: 'Manual de procedimientos', sabe: ['rec', 'reg', 'cla', 'inv', 'res', 'cal', 'apr', 'not', 'cer'] },
  ];
  const POS = P.disponer(IDS, ARISTAS);

  function montarDescubrimiento(cuerpo) {
    let semilla = 1, completitud = 0.9, real = false, geo = null;
    let mensaje = 'Marque las fuentes que consulta. Cada una conoce una parte del proceso.';
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Completitud de cada fuente', min: 0.4, max: 1, paso: 0.05, valor: completitud, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { completitud = v; mensaje = 'Con menos completitud cada fuente olvida más actividades que conoce.'; dibujar(); } });
    const usar = ctl.casillas(FUENTES.map((f) => ({ clave: f.id, texto: f.n, activo: f.id === 'eje' })), (e) => { mensaje = `${FUENTES.filter((f) => e[f.id]).length} de ${FUENTES.length} fuentes consultadas.`; dibujar(); });
    ctl.casilla({ etiqueta: 'Mostrar la realidad', valor: real, alCambiar: (v) => { real = v; mensaje = v ? 'Se muestran las actividades reales aún no descubiertas y las que solo existen en el papel.' : 'Solo se muestra lo descubierto.'; dibujar(); } });
    ctl.boton('Consultar todas las fuentes', () => { FUENTES.forEach((f) => { usar[f.id] = true; }); cuerpo.querySelectorAll('.grupo-casillas input').forEach((i) => { i.checked = true; }); mensaje = 'Se consultaron las seis fuentes: compare qué actividades confirman varias.'; dibujar(); }, { primario: true });
    ctl.boton('Nueva muestra', () => { semilla++; mensaje = 'Nueva muestra: cada fuente olvida otras actividades.'; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 800 ? 470 : 300) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'confirmada por 2 o más fuentes' }, { color: C.s4, texto: 'una sola fuente: a verificar' },
      { color: C.inactivo, texto: 'aún no descubierta' }, { color: C.s8, texto: 'documentada pero no se hace' },
      { color: C.s2, texto: 'falta un paso entre dos actividades', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Consulte las fuentes de a una y observe cómo se completa el mapa. Los nodos amarillos tienen una sola fuente y deben verificarse; el manual describe un «control de calidad» que nadie hace. Active «Mostrar la realidad» para evaluar el resultado.');

    // Qué fuentes mencionan cada actividad (con olvidos reproducibles).
    function menciones() {
      const m = {};
      IDS.forEach((i) => { m[i] = []; });
      FUENTES.forEach((f, fi) => {
        if (!usar[f.id]) return;
        f.sabe.forEach((a, ai) => { if (VIZ.semilla(semilla * 977 + fi * 53 + ai * 7 + 3)() < completitud) m[a].push(f); });
      });
      return m;
    }
    let ult = null;
    function dibujar() {
      const m = menciones(); ult = m;
      const { ancho: W } = lienzo;
      const estrecho = W < 800;
      lienzo.limpiar();
      const hallada = (i) => m[i].length > 0;
      const visibles = IDS.filter((i) => hallada(i) || (real && i !== 'cal'));
      const pos = {};
      visibles.forEach((i) => { pos[i] = estrecho ? { x: POS[i].y, y: POS[i].x } : POS[i]; });
      const nodos = visibles.map((i) => {
        const n = m[i].length, id = i;
        if (!n) return { id, tipo: 'act', etiqueta: ACT[i][1], relleno: C.neutro, borde: C.inactivo, colorTexto: C.apagado, insignia: '?', colorInsignia: C.inactivo };
        const base = n >= 2 ? C.s1 : C.s4;
        const o = { id, tipo: 'act', etiqueta: ACT[i][1], relleno: VIZ.alfa(base, 0.25), borde: base };
        if (real && i === 'cal') { o.borde = C.s8; o.anillo = C.s8; o.insignia = 'no se hace'; o.colorInsignia = C.s8; }
        return o;
      });
      // Aristas entre actividades visibles; si hay actividades ocultas en medio se marca el salto.
      const hijos = (a) => ARISTAS.filter((e) => e[0] === a).map((e) => e[1]);
      const aristas = [], vistas = new Set();
      const agregar = (de, a, salto) => { const k = de + '>' + a; if (vistas.has(k)) return; vistas.add(k); aristas.push({ de, a, guiones: salto, color: salto ? C.s2 : C.eje, ancho: salto ? 2 : 1.5 }); };
      visibles.forEach((u) => {
        const recorrer = (v, salto, prof) => {
          if (prof > 4) return;
          if (visibles.includes(v)) { agregar(u, v, salto); return; }
          hijos(v).forEach((w) => recorrer(w, true, prof + 1));
        };
        hijos(u).forEach((v) => recorrer(v, false, 0));
      });
      const { ctx } = lienzo;
      geo = P.dibujarGrafo(lienzo, nodos, aristas, pos, { fuente: 10, margenX: 44, margenY: 34 });
      if (!visibles.length) { ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(12, 500); ctx.textAlign = 'center'; ctx.fillText('Marque al menos una fuente', W / 2, lienzo.alto / 2); }
      const halladas = IDS.filter(hallada), reales = halladas.filter((i) => i !== 'cal');
      const conf = halladas.filter((i) => m[i].length >= 2).length, unica = halladas.filter((i) => m[i].length === 1).length;
      const completos = SUBPROC.filter((s) => REALES.filter((i) => ACT[i][2] === s).every(hallada)).length;
      registro.textContent = mensaje;
      lectura.set([
        ['fuentes consultadas', `${FUENTES.filter((f) => usar[f.id]).length} de ${FUENTES.length}`],
        ['cobertura de la realidad', `${reales.length} de ${REALES.length} actividades (${VIZ.fmt((reales.length / REALES.length) * 100, 3)} %)`],
        ['confirmadas por 2 o más fuentes', String(conf)],
        ['a verificar (una sola fuente)', String(unica)],
        ['documentadas pero inexistentes', String(hallada('cal') ? 1 : 0)],
        ['subprocesos del nivel 1 completos', `${completos} de ${SUBPROC.length}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo || !ult) return;
      const { x, y } = lienzo.posicion(ev);
      const g = P.nodoEn(geo, x, y);
      if (!g) return tip.ocultar();
      const f = ult[g.id];
      tip.mostrar(x, y, `<b>${ACT[g.id][0]}</b><br>subproceso: ${ACT[g.id][2]}<br>` + (f.length ? f.map((q) => q.n).join('<br>') : 'ninguna fuente consultada la menciona')
        + (real ? `<br><b>${g.id === 'cal' ? 'No se hace en la práctica' : 'Existe en la práctica'}</b>` : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('process-maps', {
    intro: String.raw`
      <p>Un <strong>mapa de procesos</strong> es la vista de pájaro de una organización: qué procesos la hacen funcionar y cómo se relacionan. Se ordena en tres familias:
      los <em>procesos principales</em>, que crean valor para el cliente (captar, vender, entregar), los de <em>apoyo</em>, que los hacen posibles (personas, tecnología, finanzas),
      y los de <em>gestión</em>, que fijan el rumbo y lo controlan.</p>
      <p>Cada proceso se expande en niveles de detalle: del mapa se baja a subprocesos y luego a actividades. Para llenar esos niveles hay que <strong>descubrir</strong>
      cómo se trabaja de verdad, con entrevistas, observación y registros, porque ninguna fuente sola cuenta la historia completa.</p>`,
    visualizaciones: [
      {
        titulo: 'Del mapa a las actividades',
        descripcion: 'Elija un proceso y suba el nivel de detalle de 0 a 2: cada nivel desglosa al anterior. Active «Expandir todos» para ver cuántas líneas tiene toda la empresa detallada.',
        montar: montarMapa,
      },
      {
        titulo: 'Descubrir un proceso con varias fuentes',
        descripcion: 'Parta con una sola entrevista y agregue fuentes de a una: el mapa se completa y aparecen actividades confirmadas. Fíjese en el «control de calidad» del manual, que el registro y la observación no ven.',
        montar: montarDescubrimiento,
      },
    ],
    teoria: String.raw`
      <h2>Niveles de un mapa de procesos</h2>
      <p>Un mapa organiza los procesos en una jerarquía. El nivel 0 es el mapa de la organización; cada proceso se descompone en subprocesos (nivel 1) y estos en actividades (nivel 2),
      hasta el punto en que una actividad se asigna a una persona.</p>
      <table>
        <tr><th>Nivel</th><th>Qué contiene</th><th>Ejemplo</th><th>Quién lo usa</th></tr>
        <tr><td>0 · Mapa</td><td>procesos principales, de apoyo y de gestión</td><td>Vender, Compras, Gestión de riesgos</td><td>dirección</td></tr>
        <tr><td>1 · Subprocesos</td><td>etapas con un resultado propio</td><td>Cotizar, Negociar, Cerrar la venta</td><td>jefaturas</td></tr>
        <tr><td>2 · Actividades</td><td>pasos con responsable, entrada y salida</td><td>Armar la cotización</td><td>quienes ejecutan</td></tr>
      </table>
      <p>Una regla práctica es mantener entre 3 y 9 elementos por nivel: con menos el nivel no aporta, con más deja de leerse. Si un proceso tiene \(S\) subprocesos y \(A\) actividades,
      la ramificación media del nivel 2 es \(A/S\). En el ejemplo, Vender tiene \(S = 3\) y \(A = 7\), de modo que \(A/S \approx 2{,}3\); toda la empresa suma 12 procesos, 25 subprocesos y 59 actividades.</p>
      <div class="recuadro"><p><strong>Consistencia entre niveles.</strong> Cada actividad pertenece a un único subproceso; las entradas y salidas de un subproceso expandido deben coincidir con las del subproceso en el nivel superior,
      y ninguna actividad aparece en un nivel sin existir en el siguiente. Si no, los mapas se contradicen.</p></div>
      <h2>Descubrimiento de procesos</h2>
      <p>Las fuentes se complementan porque fallan de maneras distintas:</p>
      <table>
        <tr><th>Fuente</th><th>Aporta</th><th>Sesgo típico</th></tr>
        <tr><td>Entrevistas</td><td>el porqué y las excepciones</td><td>cada persona solo conoce su tramo; cuenta cómo <em>debería</em> ser</td></tr>
        <tr><td>Observación</td><td>el trabajo real, incluidos los atajos</td><td>costosa; la gente cambia al sentirse observada</td></tr>
        <tr><td>Registros del sistema</td><td>qué ocurrió, cuándo y cuántas veces</td><td>no ve el trabajo fuera del sistema (llamadas, planillas)</td></tr>
        <tr><td>Documentación</td><td>el proceso oficial</td><td>desactualizada; describe controles que ya nadie hace</td></tr>
      </table>
      <p>Si cada fuente conoce la actividad con probabilidad \(q_i\) de forma independiente, la actividad se descubre con probabilidad \(1 - \prod_i (1 - q_i)\). Con tres fuentes de \(q = 0{,}6\) se pasa de 60 % a \(1 - 0{,}4^3 = 93{,}6\ \%\) de cobertura, y una actividad
      mencionada por dos o más fuentes independientes es mucho más fiable que una mencionada por una sola: esa <em>triangulación</em> es la que muestra la segunda figura.</p>
      <h3>Ejemplo resuelto</h3>
      <p>El proceso de reclamos tiene 9 actividades reales. El ejecutivo de atención conoce 5, el analista 3 y el registro del sistema 7 (no ve la recepción por teléfono ni el pedido de información por correo). La unión de las tres fuentes cubre las 9, pero el manual
      suma un «control de calidad» que ninguna otra fuente confirma: es una actividad documentada que no se hace, y detectarla es parte del trabajo del analista.</p>
      <h2>Conexiones</h2>
      <p>El mapa de nivel alto es la <a href="tema.html?id=value-chain">cadena de valor</a> de la empresa y cada proceso se detalla como en <a href="tema.html?id=business-process-anatomy">anatomía de un proceso</a>.
      Las actividades se dibujan en <a href="tema.html?id=bpmn-gateways">BPMN</a> (ver también <a href="tema.html?id=bpmn-events-tasks">eventos, tareas y subprocesos</a>), y el descubrimiento automático a partir de registros es el tema de
      <a href="tema.html?id=process-discovery">descubrimiento de procesos</a> y de los <a href="tema.html?id=event-logs">registros de eventos</a>. La asignación de responsables se hace con la <a href="tema.html?id=raci-matrix">matriz RACI</a>.</p>`,
  });
})();
