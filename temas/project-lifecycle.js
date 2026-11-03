(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Fases del ciclo de vida. a–b: tramo del eje «avance del proyecto» (0 = inicio, 1 = fin). */
  const FASES = [
    { id: 'prep', nombre: 'Preparación', a: 0, b: 0.15, color: C.s1, texto: 'se justifica el proyecto: acta de constitución, caso de negocio aprobado y registro de interesados' },
    { id: 'plan', nombre: 'Planificación', a: 0.15, b: 0.35, color: C.s2, texto: 'se define cómo se hará: plan del proyecto, línea base de alcance (EDT), cronograma y presupuesto' },
    { id: 'ejec', nombre: 'Ejecución', a: 0.35, b: 0.8, color: C.s3, texto: 'se construye y se entrega: el equipo produce los entregables comprometidos' },
    { id: 'mon', nombre: 'Monitoreo y control', a: 0, b: 1, color: C.s4, texto: 'corre en paralelo a todo el proyecto: compara lo real con la línea base, gestiona cambios y emite informes de estado' },
    { id: 'cierre', nombre: 'Cierre', a: 0.8, b: 1, color: C.s5, texto: 'se formaliza la aceptación, se registran las lecciones aprendidas y se cierran los contratos' },
  ];
  const PRINCIPALES = [FASES[0], FASES[1], FASES[2], FASES[4]];
  const faseDe = (x) => PRINCIPALES.find((f) => x >= f.a && x < f.b) || PRINCIPALES[3];
  const pct = (v) => `${Math.round(v * 100)} %`;

  /* ---------- Fig. 1: costo de cambiar según la fase ---------- */

  function montarCosto(cuerpo) {
    let c0 = 8, M = 40, V = 80, x = 0.55, idx = -1, plano = null;
    const costo = (u) => c0 * Math.pow(M, u);

    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Costo de un cambio en la preparación', min: 2, max: 40, valor: c0, formato: (v) => `${v} h`, alCambiar: (v) => { c0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Multiplicador al cierre (×)', min: 5, max: 100, valor: M, formato: (v) => `×${v}`, alCambiar: (v) => { M = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Valor del cambio (horas que ahorra)', min: 10, max: 400, paso: 5, valor: V, formato: (v) => `${v} h`, alCambiar: (v) => { V = v; dibujar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...FASES.map((f, i) => ({ color: f.color, texto: `${i + 1} ${f.nombre}` })),
      { color: C.tinta, texto: 'costo de un cambio', forma: 'linea' },
      { color: C.apagado, texto: 'valor del cambio', forma: 'linea' },
      { color: C.s6, texto: 'zona en que conviene cambiar' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en el gráfico para situar un cambio solicitado en cualquier punto del proyecto, o use Reproducir para recorrer las fases. Pase el cursor sobre la curva para leer su costo.');

    function iniciar() {
      idx = -1; x = 0;
      return (function* () {
        for (let i = 0; i < FASES.length; i++) {
          idx = i;
          x = i === 3 ? 0.5 : (FASES[i].a + FASES[i].b) / 2;
          yield;
        }
      })();
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax: costo(1) * 1.08 },
        { margen: { sup: 78, izq: 46, der: 14 }, etiquetaX: 'avance del proyecto', etiquetaY: 'horas por cambio', formatoX: (v) => pct(v), ticksX: [0, 0.2, 0.4, 0.6, 0.8, 1] });
      const xs = Math.log(V / c0) / Math.log(M); // avance hasta el cual cambiar cuesta menos de lo que aporta
      const zona = Math.max(0, Math.min(1, xs));
      if (xs > 0) {
        ctx.fillStyle = VIZ.alfa(C.s6, 0.1);
        ctx.fillRect(plano.sx(0), plano.y1, plano.sx(zona) - plano.sx(0), plano.y0 - plano.y1);
      }
      plano.ejes();
      // Bandas de fases.
      const filas = [[18, 26, [0, 1, 2, 4]], [48, 16, [3]]];
      ctx.font = VIZ.fuente(10, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      for (const [y, h, lista] of filas) {
        for (const i of lista) {
          const f = FASES[i], x0 = plano.sx(f.a), w = plano.sx(f.b) - x0;
          const activa = idx === i || (idx < 0 && faseDe(x) === f);
          ctx.fillStyle = VIZ.alfa(f.color, activa ? 0.6 : 0.22);
          ctx.fillRect(x0 + 1, y, w - 2, h);
          ctx.strokeStyle = f.color; ctx.lineWidth = activa ? 2 : 1;
          ctx.strokeRect(x0 + 1, y, w - 2, h);
          ctx.fillStyle = C.tinta;
          ctx.fillText(ctx.measureText(f.nombre).width + 8 < w ? f.nombre : String(i + 1), x0 + w / 2, y + h / 2 + 1);
        }
      }
      // Curva, valor del cambio y umbral.
      const pts = [];
      for (let u = 0; u <= 1.0001; u += 0.01) pts.push([u, costo(u)]);
      VIZ.trazar(ctx, plano, pts, C.tinta, 2.5);
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      const yV = plano.sy(Math.min(V, plano.d.ymax));
      ctx.beginPath(); ctx.moveTo(plano.x0, yV); ctx.lineTo(plano.x1, yV); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('valor del cambio', plano.x1 - 4, yV - 3);
      ctx.restore();
      if (xs > 0 && xs < 1) {
        ctx.strokeStyle = C.s6; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(plano.sx(xs), plano.y1); ctx.lineTo(plano.sx(xs), plano.y0); ctx.stroke();
      }
      // Cambio solicitado.
      ctx.strokeStyle = C.s8; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(plano.sx(x), plano.y1); ctx.lineTo(plano.sx(x), plano.y0); ctx.stroke(); ctx.setLineDash([]);
      VIZ.marcador(ctx, plano.sx(x), plano.sy(costo(x)), C.s8, 5.5);

      const f = idx >= 0 ? FASES[idx] : faseDe(x);
      const mult = Math.pow(M, x), ok = costo(x) <= V;
      const queFase = xs <= 0 ? 'ninguna (ni en la preparación se paga)' : xs >= 1 ? 'todas' : `hasta ${pct(xs)} del avance (${faseDe(xs).nombre.toLowerCase()})`;
      registro.textContent = `${f.nombre}: ${f.texto}. Un cambio aquí cuesta ${VIZ.fmt(costo(x), 3)} h (×${VIZ.fmt(mult, 3)} respecto de la preparación) y ${ok ? 'todavía conviene' : 'ya no conviene'}: ahorra ${V} h.`;
      lectura.set([
        ['avance', pct(x)],
        ['fase', f.nombre],
        ['costo del cambio', `${VIZ.fmt(costo(x), 3)} h`],
        ['múltiplo', `×${VIZ.fmt(mult, 3)}`],
        ['conviene cambiar en', queFase],
      ]);
    }
    lienzo.alDibujar = () => plano && dibujar();

    const aAvance = (ev) => { const p = lienzo.posicion(ev); return plano && plano.dentro(p.x, p.y) ? { ...p, u: Math.max(0, Math.min(1, plano.ix(p.x))) } : null; };
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const p = aAvance(ev);
      if (!p) return;
      rep.detener(); idx = -1; x = p.u; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const p = aAvance(ev);
      if (!p) return tip.ocultar();
      const f = faseDe(p.u);
      tip.mostrar(p.x, p.y, `avance <b>${pct(p.u)}</b><br>fase <b>${f.nombre}</b><br>costo del cambio <b>${VIZ.fmt(costo(p.u), 3)} h</b><br>múltiplo <b>×${VIZ.fmt(Math.pow(M, p.u), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
    x = 0.55; idx = -1; dibujar();
  }

  /* ---------- Fig. 2: entregables por fase ---------- */

  const TIPOS = {
    erp: { nombre: 'Implantación de un ERP', cuotas: [0.1, 0.2, 0.58, 0.12], ejec: ['Módulos configurados', 'Datos maestros migrados', 'Usuarios capacitados'] },
    app: { nombre: 'App móvil para clientes', cuotas: [0.08, 0.15, 0.65, 0.12], ejec: ['Prototipo validado', 'Versión beta', 'Versión candidata aprobada'] },
    nube: { nombre: 'Migración a la nube', cuotas: [0.12, 0.23, 0.53, 0.12], ejec: ['Entorno base (landing zone) listo', 'Cargas migradas', 'Prueba de conmutación superada'] },
  };
  const COMUNES = {
    prep: ['Acta de constitución', 'Caso de negocio aprobado', 'Registro de interesados'],
    plan: ['Plan de gestión del proyecto', 'Línea base de alcance (EDT)', 'Cronograma y presupuesto aprobados'],
    cierre: ['Aceptación formal del cliente', 'Lecciones aprendidas', 'Contratos cerrados y archivo'],
  };
  const FRAC = [0.4, 0.75, 1];

  function montarEntregables(cuerpo) {
    let tipo = 'erp', sem = 30, w = 0, filas = [], dias = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de proyecto', opciones: Object.entries(TIPOS).map(([k, t]) => [k, t.nombre]), valor: tipo, alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Duración total', min: 12, max: 60, valor: sem, formato: (v) => `${v} semanas`, alCambiar: (v) => { sem = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 5 * 46 + 36 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...FASES.map((f, i) => ({ color: f.color, texto: `${i + 1} ${f.nombre}` })),
      { color: C.tinta, texto: 'entregable aprobado' },
      { color: C.superficie, borde: C.tinta, texto: 'entregable pendiente' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Reproduzca el proyecto semana a semana o haga clic en el gráfico para saltar a una semana. Pase el cursor sobre un rombo para ver el entregable y la semana en que vence. Cambie el tipo de proyecto: las fases se reparten distinto.');

    function armar() {
      const [p, pl, e, c] = TIPOS[tipo].cuotas.map((q) => q * sem);
      const tramos = { prep: [0, p], plan: [p, p + pl], ejec: [p + pl, p + pl + e], cierre: [p + pl + e, sem], mon: [p, sem] };
      const nombres = { ...COMUNES, ejec: TIPOS[tipo].ejec };
      filas = ['prep', 'plan', 'ejec', 'mon', 'cierre'].map((id, i) => {
        const [a, b] = tramos[id];
        const entregables = id === 'mon' ? [] : nombres[id].map((n, k) => ({ n, vence: a + (b - a) * FRAC[k] }));
        return { id, fase: FASES[i], a, b, entregables };
      });
      dias = [];
      for (let t = 2; t <= sem; t += 2) if (t >= tramos.mon[0]) dias.push(t);
    }

    function iniciar() {
      armar(); w = 0;
      return (function* () { while (w < sem) { w++; yield; } })();
    }
    const hechos = () => filas.reduce((s, f) => s + f.entregables.filter((e) => e.vence <= w + 1e-9).length, 0);
    const faseSemana = () => {
      if (w <= 0) return 'aún no comienza';
      const f = filas.find((r) => r.id !== 'mon' && w > r.a - 1e-9 && w <= r.b + 1e-9) || filas[4];
      return f.fase.nombre + (f.id !== 'prep' && w > filas[3].a ? ' (con monitoreo y control)' : '');
    };

    let geo = null;
    function dibujar() {
      if (!filas.length) armar();
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = 10, der = 12, top = 6, alto = 46;
      const sx = (t) => izq + (t / sem) * (W - izq - der);
      geo = { sx, izq, der, items: [] };
      filas.forEach((f, i) => {
        const y = top + i * alto;
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${i + 1} ${f.fase.nombre}${f.id === 'mon' ? ' · informe de estado cada 2 semanas' : ''}`, izq, y + 1);
        ctx.fillStyle = VIZ.alfa(f.fase.color, 0.28);
        ctx.fillRect(sx(f.a), y + 16, sx(f.b) - sx(f.a), 16);
        ctx.fillStyle = f.fase.color;
        const avance = Math.max(0, Math.min(f.b, w) - f.a);
        if (avance > 0) ctx.fillRect(sx(f.a), y + 16, sx(f.a + avance) - sx(f.a), 16);
        for (const e of f.entregables) {
          const ok = e.vence <= w + 1e-9, cx = sx(e.vence), cy = y + 24;
          ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 9, cy); ctx.closePath();
          ctx.fillStyle = ok ? C.tinta : C.superficie; ctx.fill();
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.stroke();
          geo.items.push({ cx, cy, txt: `<b>${e.n}</b><br>fase: ${f.fase.nombre}<br>vence en la semana <b>${VIZ.fmt(e.vence, 3)}</b> (${ok ? 'aprobado' : 'pendiente'})` });
        }
        if (f.id === 'mon') for (const t of dias) {
          const ok = t <= w, cx = sx(t), cy = y + 24;
          ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fillStyle = ok ? C.tinta : C.superficie; ctx.fill(); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.2; ctx.stroke();
          geo.items.push({ cx, cy, txt: `<b>Informe de estado</b><br>semana <b>${t}</b> (${ok ? 'emitido' : 'pendiente'})` });
        }
      });
      // Eje de semanas y cursor.
      const yb = top + 5 * alto + 4;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(izq, yb + 0.5); ctx.lineTo(W - der, yb + 0.5); ctx.stroke();
      ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const t of VIZ.ticks(0, sem, Math.max(3, Math.floor(W / 70)))) { ctx.fillText(String(t), sx(t), yb + 5); ctx.beginPath(); ctx.moveTo(sx(t), yb); ctx.lineTo(sx(t), yb + 3); ctx.stroke(); }
      ctx.strokeStyle = C.s8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx(w), top); ctx.lineTo(sx(w), yb); ctx.stroke();
      const nEnt = filas.reduce((s, f) => s + f.entregables.length, 0), h = hechos(), inf = dias.filter((t) => t <= w).length;
      const prox = filas.flatMap((f) => f.entregables.map((e) => ({ ...e, fase: f.fase }))).filter((e) => e.vence > w + 1e-9).sort((a, b) => a.vence - b.vence)[0];
      registro.textContent = w <= 0
        ? `Semana 0: el proyecto «${TIPOS[tipo].nombre}» dura ${sem} semanas y debe producir ${nEnt} entregables. El primero es «${filas[0].entregables[0].n}».`
        : `Semana ${w}: ${faseSemana()}. ${prox ? `Próximo entregable: «${prox.n}» (semana ${VIZ.fmt(prox.vence, 3)}).` : 'Todos los entregables están aprobados: el proyecto se puede cerrar.'}`;
      lectura.set([
        ['semana', `${w} de ${sem}`],
        ['fase', faseSemana()],
        ['entregables aprobados', `${h} de ${nEnt}`],
        ['informes de estado', `${inf} de ${dias.length}`],
        ['avance del calendario', pct(w / sem)],
      ]);
    }
    lienzo.alDibujar = () => dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x } = lienzo.posicion(ev);
      rep.detener();
      w = Math.max(0, Math.min(sem, Math.round(((x - geo.izq) / (lienzo.ancho - geo.izq - geo.der)) * sem)));
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const it = geo && geo.items.find((q) => Math.abs(q.cx - x) < 10 && Math.abs(q.cy - y) < 10);
      if (it) tip.mostrar(x, y, it.txt); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('project-lifecycle', {
    intro: String.raw`
      <p>Todo proyecto tecnológico, sea implantar un ERP, lanzar una aplicación o migrar a la nube, atraviesa las mismas etapas:
      <strong>preparación</strong> (justificar y autorizar), <strong>planificación</strong> (decidir cómo), <strong>ejecución</strong> (construir),
      <strong>monitoreo y control</strong> (comparar lo real con el plan, durante todo el proyecto) y <strong>cierre</strong> (aceptar y aprender).
      Cada fase termina en entregables concretos, y pasar a la siguiente suele requerir una aprobación.</p>
      <p>Conocer el ciclo importa porque <strong>cambiar de idea cuesta más cuanto más avanzado está el proyecto</strong>: una corrección en el papel es barata;
      la misma corrección con el sistema ya programado, probado y capacitado puede costar decenas de veces más.</p>`,
    visualizaciones: [
      {
        titulo: 'El costo de cambiar según el avance',
        descripcion: 'Recorra las fases o haga clic en cualquier punto para situar un cambio. Suba el valor del cambio y vea cómo crece la zona verde; suba el multiplicador y observe cómo la curva se hace más empinada.',
        montar: montarCosto,
      },
      {
        titulo: 'Entregables y puertas de aprobación',
        descripcion: 'Reproduzca el proyecto semana a semana y observe qué fase está activa y qué entregables ya se aprobaron. Cambie el tipo de proyecto y la duración: las fases mantienen su orden pero cambian de proporción.',
        montar: montarEntregables,
      },
    ],
    teoria: String.raw`
      <h2>Las cinco fases</h2>
      <table>
        <tr><th>Fase</th><th>Pregunta que responde</th><th>Entregables típicos</th></tr>
        <tr><td>Preparación</td><td>¿Vale la pena y quién lo autoriza?</td><td>acta de constitución, caso de negocio, registro de interesados</td></tr>
        <tr><td>Planificación</td><td>¿Qué, cuándo, con quién y a qué costo?</td><td>plan del proyecto, EDT, cronograma, presupuesto, plan de riesgos</td></tr>
        <tr><td>Ejecución</td><td>¿Se está construyendo lo acordado?</td><td>incrementos del producto, capacitación, datos migrados</td></tr>
        <tr><td>Monitoreo y control</td><td>¿Vamos según la línea base?</td><td>informes de estado, solicitudes de cambio, indicadores de valor ganado</td></tr>
        <tr><td>Cierre</td><td>¿Se aceptó y qué aprendimos?</td><td>acta de aceptación, lecciones aprendidas, cierre de contratos</td></tr>
      </table>
      <p>El monitoreo y control no es una etapa posterior: se superpone con la planificación, la ejecución y el cierre. Las fases de una metodología <em>predictiva</em> se recorren una vez;
      en una <em>ágil</em> se repiten en ciclos cortos (ver <a href="tema.html?id=waiting-and-service-time">tiempos de espera</a> para el análisis de flujo y
      <a href="tema.html?id=waterfall-vs-agile">cascada frente a ágil</a>).</p>
      <h2>Costo de cambiar</h2>
      <p>Una regla empírica (atribuida a Boehm) dice que corregir un defecto o un requisito cuesta más cuanto más tarde se detecta. Un modelo simple, que usa la figura 1, es exponencial:</p>
      \[ C(x) = C_0\, M^{x}, \qquad x \in [0,1], \]
      <p>donde \(C_0\) es el costo en la preparación y \(M\) el multiplicador al cierre. Un cambio con valor \(V\) conviene mientras \(C(x) \le V\), es decir, hasta</p>
      \[ x^{*} = \frac{\ln(V / C_0)}{\ln M}. \]
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con \(C_0 = 8\) h, \(M = 40\) y un cambio que ahorra \(V = 80\) h:
      \(x^{*} = \ln 10 / \ln 40 \approx 2{,}303 / 3{,}689 = 0{,}62\). Hasta el 62 % del avance (ya en plena ejecución) conviene incorporarlo;
      después, cuesta más de lo que ahorra y es mejor dejarlo para una versión posterior. En el avance 0,55, el costo es \(8 \cdot 40^{0{,}55} \approx 61\) h.</p></div>
      <p>El multiplicador no es una ley de la naturaleza: depende de la práctica. Pruebas automáticas, entrega continua y requisitos revisados temprano reducen \(M\); es la razón de ser de
      <a href="tema.html?id=devops-ci-cd">DevOps y la entrega continua</a>.</p>
      <h2>Puertas de aprobación</h2>
      <p>Al final de cada fase, un comité decide si el proyecto continúa, se corrige o se cancela. La decisión se apoya en el
      <a href="tema.html?id=business-case">caso de negocio</a>, que se actualiza con la información nueva, y en la
      <a href="tema.html?id=triple-constraint">triple restricción</a> (alcance, tiempo, costo). Los riesgos y los interesados se gestionan durante todo el ciclo
      (<a href="tema.html?id=project-risks-stakeholders">riesgos e interesados</a>), el cronograma se detalla en
      <a href="tema.html?id=schedules-resources">cronogramas y recursos</a> y los cambios de personas y procesos, en
      <a href="tema.html?id=change-management">gestión del cambio</a>.</p>`,
  });
})();
