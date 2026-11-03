(function () {
  'use strict';
  const { color: C } = VIZ;

  const recortar = (ctx, texto, ancho) => {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: balance de la tríada ---------- */

  // Efecto didáctico de cada control sobre confidencialidad (c), integridad (i) y disponibilidad (d), en puntos.
  const CONTROLES = [
    { id: 'cif', n: 'Cifrado de datos', c: 25, i: 8, d: -6 },
    { id: 'mfa', n: 'Autenticación multifactor', c: 22, i: 6, d: -8 },
    { id: 'firma', n: 'Firmas digitales y hashes', c: 0, i: 26, d: -3 },
    { id: 'resp', n: 'Respaldos frecuentes', c: -6, i: 10, d: 22 },
    { id: 'red', n: 'Servidores redundantes', c: -5, i: 0, d: 28 },
    { id: 'aud', n: 'Registros de auditoría', c: 6, i: 14, d: -3 },
    { id: 'blq', n: 'Bloqueo tras intentos fallidos', c: 10, i: 2, d: -9 },
    { id: 'dlp', n: 'Prevención de fuga de datos', c: 16, i: 4, d: -7 },
    { id: 'doble', n: 'Aprobación doble de cambios', c: 2, i: 18, d: -10 },
  ];
  const PERFILES = {
    banco: { n: 'Banco', meta: [80, 90, 70] },
    hospital: { n: 'Hospital', meta: [75, 85, 90] },
    estudio: { n: 'Estudio jurídico', meta: [90, 70, 45] },
    prensa: { n: 'Medio de prensa', meta: [35, 80, 85] },
  };
  const PROPS = ['Confidencialidad', 'Integridad', 'Disponibilidad'];
  const BASE = 30;

  function montarBalance(cuerpo) {
    let perfil = 'banco', hover = -1, ultimo = '';
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Perfil de la organización', opciones: Object.entries(PERFILES).map(([k, p]) => [k, p.n]), valor: perfil, alCambiar: (v) => { perfil = v; dibujar(); } });
    let prev = {};
    const estado = ctl.casillas(CONTROLES.map((c) => ({ clave: c.id, texto: c.n, activo: false })), (e) => {
      const cambio = CONTROLES.find((c) => e[c.id] !== prev[c.id]);
      prev = { ...e };
      if (cambio) ultimo = `${e[cambio.id] ? 'Activar' : 'Quitar'} «${cambio.n}» ${e[cambio.id] ? 'suma' : 'resta'} C ${signo(cambio.c)}, I ${signo(cambio.i)}, D ${signo(cambio.d)} puntos.`;
      dibujar();
    });
    prev = { ...estado };
    ctl.boton('Quitar todos', () => { /* restablece las casillas */
      cuerpo.querySelectorAll('.grupo-casillas input').forEach((i) => { if (i.checked) { i.checked = false; i.dispatchEvent(new Event('change')); } });
      ultimo = 'Sin controles, cada propiedad queda en el nivel base de ' + BASE + ' puntos.';
      dibujar();
    });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(380, Math.max(300, w * 0.62))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'nivel alcanzado con los controles activos' },
      { color: C.apagado, texto: 'meta del perfil', forma: 'linea' },
      { color: C.s8, texto: 'propiedad por debajo de su meta' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Active controles con las casillas; los puntajes son pesos didácticos, no mediciones. Pase el cursor sobre un vértice del triángulo para ver qué controles lo suben o lo bajan.');

    function signo(v) { return v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '±0'; }
    const puntaje = () => [0, 1, 2].map((k) => Math.max(0, Math.min(100, BASE + CONTROLES.reduce((s, c) => s + (estado[c.id] ? [c.c, c.i, c.d][k] : 0), 0))));
    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2 + 14, R = Math.min(W / 2 - 78, H / 2 - 52);
      const ang = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
      const pt = (k, v) => [cx + (R * v / 100) * Math.cos(ang[k]), cy + (R * v / 100) * Math.sin(ang[k])];
      geo = { pt, W, H };
      for (const nivel of [25, 50, 75, 100]) {
        ctx.beginPath();
        [0, 1, 2].forEach((k) => { const [x, y] = pt(k, nivel); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.strokeStyle = nivel === 100 ? C.eje : C.rejilla; ctx.lineWidth = 1; ctx.stroke();
        const [lx, ly] = pt(0, nivel);
        ctx.fillStyle = C.apagado; ctx.font = VIZ.fuente(10); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(String(nivel), lx + 4, ly + 2);
      }
      [0, 1, 2].forEach((k) => { const [x, y] = pt(k, 100); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); });
      const meta = PERFILES[perfil].meta, p = puntaje();
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); meta.forEach((v, k) => { const [x, y] = pt(k, v); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); p.forEach((v, k) => { const [x, y] = pt(k, v); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.2); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.stroke();
      p.forEach((v, k) => {
        const [x, y] = pt(k, v);
        VIZ.marcador(ctx, x, y, v < meta[k] ? C.s8 : C.s1, k === hover ? 7 : 5);
        const [ex, ey] = pt(k, 100);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta;
        ctx.textAlign = k === 0 ? 'center' : k === 1 ? 'left' : 'right';
        ctx.textBaseline = k === 0 ? 'bottom' : 'top';
        ctx.fillText(PROPS[k], ex + (k === 1 ? 8 : k === 2 ? -8 : 0), ey + (k === 0 ? -8 : 8));
        ctx.font = VIZ.fuente(11); ctx.fillStyle = v < meta[k] ? C.s8 : C.tinta2;
        ctx.fillText(`${v} / ${meta[k]}`, ex + (k === 1 ? 8 : k === 2 ? -8 : 0), ey + (k === 0 ? -22 : 22));
      });
      const faltan = p.map((v, k) => (v < meta[k] ? PROPS[k] : null)).filter(Boolean);
      const activos = CONTROLES.filter((c) => estado[c.id]).length;
      registro.textContent = (ultimo ? ultimo + ' ' : '') + (faltan.length ? `Para el perfil «${PERFILES[perfil].n}» falta: ${faltan.join(', ')}.` : `El perfil «${PERFILES[perfil].n}» queda cubierto.`);
      lectura.set([
        ['confidencialidad', `${p[0]} de ${meta[0]}`],
        ['integridad', `${p[1]} de ${meta[1]}`],
        ['disponibilidad', `${p[2]} de ${meta[2]}`],
        ['controles activos', `${activos} de ${CONTROLES.length}`],
        ['cumple el perfil', faltan.length ? 'no' : 'sí'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = puntaje();
      let mejor = -1, dmin = 34;
      [0, 1, 2].forEach((k) => { const [px, py] = geo.pt(k, p[k]); const d = Math.hypot(px - x, py - y); if (d < dmin) { dmin = d; mejor = k; } });
      if (mejor !== hover) { hover = mejor; dibujar(); }
      if (mejor < 0) return tip.ocultar();
      const filas = CONTROLES.filter((c) => estado[c.id] && [c.c, c.i, c.d][mejor] !== 0)
        .map((c) => VIZ.filaTooltip([c.c, c.i, c.d][mejor] > 0 ? C.s6 : C.s8, c.n, signo([c.c, c.i, c.d][mejor])));
      tip.mostrar(x, y, `<b>${PROPS[mejor]}</b>: ${p[mejor]}<br>base ${BASE}` + (filas.join('') || '<br>sin controles que la modifiquen'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    ultimo = '';
    dibujar();
  }

  /* ---------- Fig. 2: incidentes por propiedad violada ---------- */

  // Severidad por propiedad: 0 no afectada, 1 secundaria, 2 importante, 3 principal.
  const INCIDENTES = [
    { n: 'Filtración de la base de clientes', s: [3, 0, 0], que: 'Personas no autorizadas leen datos personales; nada se pierde ni se altera.', ctl: 'Cifrado en reposo, mínimo privilegio y monitoreo de accesos.' },
    { n: 'Ransomware cifra los servidores', s: [1, 1, 3], que: 'Los archivos existen pero nadie puede usarlos; si además se roban copias, también hay pérdida de confidencialidad.', ctl: 'Respaldos aislados, segmentación de red y plan de recuperación.' },
    { n: 'Empleado altera saldos', s: [0, 3, 0], que: 'Los datos siguen disponibles y reservados, pero dejaron de ser correctos.', ctl: 'Aprobación doble, registros de auditoría inmodificables.' },
    { n: 'Ataque DDoS al sitio web', s: [0, 0, 3], que: 'El servicio se satura de solicitudes y los clientes no pueden comprar.', ctl: 'Capacidad elástica, filtrado de tráfico y redundancia.' },
    { n: 'Laptop robada sin cifrar', s: [3, 0, 1], que: 'Quien la tiene lee los discos; la persona además pierde su equipo de trabajo.', ctl: 'Cifrado de disco completo y borrado remoto.' },
    { n: 'Almacenamiento en la nube público por error', s: [3, 0, 0], que: 'Una mala configuración deja los archivos legibles desde internet.', ctl: 'Revisión automática de configuraciones y bloqueo de acceso público por defecto.' },
    { n: 'Malware altera archivos de configuración', s: [0, 3, 1], que: 'El sistema funciona con parámetros manipulados y puede fallar después.', ctl: 'Sumas de verificación, firmas y control de cambios.' },
    { n: 'Corte de energía sin respaldo', s: [0, 1, 3], que: 'Los equipos se apagan; las transacciones en curso pueden quedar a medias.', ctl: 'UPS, generador y sitio alterno.' },
    { n: 'Correo falso cambia cuenta de pago', s: [1, 3, 0], que: 'Un engaño modifica un dato de pago y el dinero va a otra cuenta.', ctl: 'Confirmación por otro canal y autorización doble.' },
    { n: 'Borrado accidental de una base', s: [0, 2, 3], que: 'Un descuido elimina datos de producción y el sistema se detiene hasta restaurar.', ctl: 'Respaldos frecuentes, permisos de borrado separados y entorno de pruebas.' },
  ];

  function montarIncidentes(cuerpo) {
    let foco = 'todas', practica = false, revelado = false, sel = -1, hover = -1;
    const guess = INCIDENTES.map(() => [false, false, false]);
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Resaltar propiedad', opciones: [['todas', 'Todas'], ['0', 'Confidencialidad'], ['1', 'Integridad'], ['2', 'Disponibilidad']], valor: foco, alCambiar: (v) => { foco = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Modo práctica (ocultar la clasificación)', valor: false, alCambiar: (v) => { practica = v; revelado = false; guess.forEach((g) => g.fill(false)); registro.textContent = v ? 'Marque con clic las propiedades que cada incidente viola de forma principal y pulse «Revisar respuestas».' : 'Haga clic en un incidente para ver qué ocurrió y qué control lo habría evitado.'; dibujar(); } });
    ctl.boton('Revisar respuestas', () => { if (practica) revelado = true; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 36 + INCIDENTES.length * 32 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(1)), texto: 'violación principal' },
      { color: VIZ.css(VIZ.enRampa(0.6)), texto: 'importante' },
      { color: VIZ.css(VIZ.enRampa(0.25)), texto: 'secundaria' },
      { color: C.sobre, borde: C.eje, texto: 'no afectada' },
      { color: C.s6, texto: 'respuesta correcta (práctica)' },
      { color: C.s8, texto: 'respuesta errónea (práctica)' },
    ]);
    const registro = VIZ.registro(cuerpo);
    registro.textContent = 'Haga clic en un incidente para ver qué ocurrió y qué control lo habría evitado.';
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada fila es un incidente típico y las tres columnas son las propiedades de la tríada. Elija una propiedad para resaltarla, o active la práctica: marque lo que usted cree que se violó y revise.');

    let geo = null;
    const principal = (s) => s.map((v) => v >= 2);
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const colW = 46, izq = W < 500 ? 140 : 280, x0 = izq + 8, rowH = 32, top = 30;
      geo = { izq, x0, colW, rowH, top };
      ctx.font = VIZ.fuente(11, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = C.tinta2;
      ['C', 'I', 'D'].forEach((l, k) => ctx.fillText(l, x0 + k * colW + colW / 2, 14));
      let aciertos = 0;
      INCIDENTES.forEach((inc, r) => {
        const y = top + r * rowH;
        if (r === sel || r === hover) { ctx.fillStyle = r === sel ? VIZ.alfa(C.s1, 0.1) : C.neutro; ctx.fillRect(0, y, W, rowH - 2); }
        ctx.font = VIZ.fuente(11, r === sel ? 600 : 400); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(recortar(ctx, inc.n, izq - 12), 8, y + rowH / 2 - 1);
        const pr = principal(inc.s);
        let ok = true;
        for (let k = 0; k < 3; k++) {
          const x = x0 + k * colW + 3, w = colW - 6, v = inc.s[k];
          const atenuar = foco !== 'todas' && String(k) !== foco;
          const oculto = practica && !revelado;
          ctx.beginPath(); ctx.roundRect(x, y + 2, w, rowH - 6, 4);
          if (oculto) {
            ctx.fillStyle = guess[r][k] ? VIZ.alfa(C.s1, 0.25) : C.superficie; ctx.fill();
            ctx.strokeStyle = guess[r][k] ? C.s1 : C.eje; ctx.lineWidth = guess[r][k] ? 2 : 1; ctx.stroke();
          } else {
            ctx.fillStyle = v ? VIZ.css(VIZ.enRampa(v === 3 ? 1 : v === 2 ? 0.6 : 0.25)) : C.superficie;
            if (atenuar) ctx.globalAlpha = 0.25;
            ctx.fill(); ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
            if (practica && revelado) {
              const bien = guess[r][k] === pr[k];
              if (!bien) ok = false;
              ctx.strokeStyle = bien ? C.s6 : C.s8; ctx.lineWidth = 2.5; ctx.stroke();
              if (guess[r][k]) { ctx.fillStyle = v >= 2 ? C.sobre : C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'center'; ctx.fillText('✓', x + w / 2, y + rowH / 2 - 1); }
            }
          }
        }
        if (practica && revelado && ok) aciertos++;
      });
      const cuenta = [0, 1, 2].map((k) => INCIDENTES.filter((i) => i.s[k] >= 2).length);
      lectura.set(practica && revelado
        ? [['incidentes acertados', `${aciertos} de ${INCIDENTES.length}`], ['puntaje', VIZ.fmt((aciertos / INCIDENTES.length) * 100, 3) + ' %']]
        : [['violan C', String(cuenta[0])], ['violan I', String(cuenta[1])], ['violan D', String(cuenta[2])], ['con varias propiedades', String(INCIDENTES.filter((i) => i.s.filter((v) => v >= 2).length > 1).length)]]);
    }
    const fila = (y) => Math.floor((y - geo.top) / geo.rowH);
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = fila(y);
      const nuevo = r >= 0 && r < INCIDENTES.length ? r : -1;
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (nuevo < 0) return tip.ocultar();
      const inc = INCIDENTES[nuevo];
      const nom = ['confidencialidad', 'integridad', 'disponibilidad'];
      tip.mostrar(x, y, `<b>${inc.n}</b>` + (practica && !revelado ? '<br>clasificación oculta' : inc.s.map((v, k) => (v ? `<br>${nom[k]}: ${['', 'secundaria', 'importante', 'principal'][v]}` : '')).join('')));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const r = fila(y);
      if (r < 0 || r >= INCIDENTES.length) return;
      const k = Math.floor((x - geo.x0) / geo.colW);
      if (practica && !revelado && k >= 0 && k < 3) guess[r][k] = !guess[r][k];
      sel = r;
      const inc = INCIDENTES[r];
      registro.textContent = practica && !revelado ? `«${inc.n}»: ${guess[r].map((g, i) => (g ? 'CID'[i] : '')).join('') || 'sin marcar'}.` : `${inc.n}. ${inc.que} Control útil: ${inc.ctl}`;
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('cia-triad', {
    intro: String.raw`
      <p>La seguridad de la información se resume en tres propiedades: <strong>confidencialidad</strong> (solo quien debe puede ver los datos),
      <strong>integridad</strong> (los datos son correctos y nadie los altera sin autorización) y <strong>disponibilidad</strong> (los datos y servicios
      están cuando se necesitan). Un incidente siempre puede describirse como la violación de una o varias de ellas.</p>
      <p>Lo difícil es que reforzar una propiedad suele debilitar otra: bloquear una cuenta tras tres intentos protege contra adivinadores, pero también permite
      que un atacante deje a un usuario legítimo sin acceso. Elegir controles es repartir el esfuerzo según lo que la organización más necesita proteger.</p>`,
    visualizaciones: [
      {
        titulo: 'Balance de la tríada con controles',
        descripcion: 'Active controles y observe cómo se mueve el triángulo frente a la meta del perfil. Pruebe «Banco» con solo respaldos y redundancia: la disponibilidad sube pero la confidencialidad queda baja.',
        montar: montarBalance,
      },
      {
        titulo: 'Incidentes según la propiedad violada',
        descripcion: 'Cada incidente real viola una o varias propiedades. Resalte una columna, haga clic en las filas para leer el control que habría ayudado, o active la práctica y clasifique usted.',
        montar: montarIncidentes,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <table>
        <tr><th>Propiedad</th><th>Pregunta que responde</th><th>Se pierde cuando…</th><th>Controles típicos</th></tr>
        <tr><td>Confidencialidad</td><td>¿Quién puede ver los datos?</td><td>alguien no autorizado los lee</td><td>cifrado, control de acceso, clasificación</td></tr>
        <tr><td>Integridad</td><td>¿Son correctos y completos?</td><td>se modifican o corrompen sin permiso</td><td>hashes, firmas digitales, control de cambios</td></tr>
        <tr><td>Disponibilidad</td><td>¿Están cuando se necesitan?</td><td>el sistema se cae o se bloquea</td><td>redundancia, respaldos, planes de continuidad</td></tr>
      </table>
      <p>La tríada se conoce como <em>CIA</em> (por sus siglas en inglés). Otros modelos añaden propiedades como la autenticidad (saber quién es quién) y el no repudio
      (que nadie pueda negar una acción), pero las tres anteriores son la base.</p>
      <h2>Compromisos entre propiedades</h2>
      <p>Si \(C, I, D\) son los niveles alcanzados, cada control \(k\) los modifica con un efecto \((\Delta C_k, \Delta I_k, \Delta D_k)\) y la organización necesita metas \((C^*, I^*, D^*)\):</p>
      \[ C = C_0 + \sum_{k \in \text{activos}} \Delta C_k, \qquad \text{cumple} \iff C \ge C^*,\; I \ge I^*,\; D \ge D^*. \]
      <p>Un control puede tener efecto negativo: el cifrado fuerte exige gestionar claves (si se pierden, los datos quedan inaccesibles), el MFA añade pasos que pueden fallar y las copias de
      respaldo multiplican los lugares donde podrían robarse los datos.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Un hospital parte de \(30\) puntos en cada propiedad. Activa respaldos (\(+22\) en D), servidores redundantes (\(+28\) en D) y
      cifrado (\(+25\) en C). Obtiene \(D = 30 + 22 + 28 - 6 = 74\), \(C = 30 - 6 - 5 + 25 = 44\) e \(I = 30 + 10 + 0 + 8 = 48\). Sus metas son \(D^* = 90\), \(C^* = 75\) e \(I^* = 85\):
      no cumple ninguna, y la brecha mayor está en integridad y confidencialidad, no en disponibilidad. Este tipo de cálculo obliga a decidir qué controles agregar en lugar de comprar «más seguridad» en general.</p></div>
      <h2>Incidentes y propiedad violada</h2>
      <p>Una filtración de datos viola la confidencialidad; un empleado que cambia saldos, la integridad; un ataque de denegación de servicio, la disponibilidad. El <em>ransomware</em> es
      principalmente un ataque a la disponibilidad, pero con «doble extorsión» también roba datos y viola la confidencialidad.</p>
      <h2>Conexiones</h2>
      <p>Cómo se combinan amenazas y debilidades en un riesgo medible se ve en <a href="tema.html?id=threats-vulnerabilities-risk">amenazas, vulnerabilidades y riesgo</a>; los mecanismos que
      protegen la confidencialidad en <a href="tema.html?id=authentication-access-control">autenticación y control de acceso</a> y <a href="tema.html?id=data-protection">protección de datos</a>;
      y la disponibilidad se trabaja en <a href="tema.html?id=backups-disaster-recovery">respaldos y recuperación ante desastres</a>.</p>`,
  });
})();
