(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const R = (i) => `L${i + 1}`;

  const GARANTIAS = [
    { clave: 'mr', texto: 'Lecturas monótonas', color: C.s1 },
    { clave: 'mw', texto: 'Escrituras monótonas', color: C.s2 },
    { clave: 'ryw', texto: 'Leer lo escrito', color: C.s3 },
    { clave: 'wfr', texto: 'Escrituras siguen a lecturas', color: C.s7 },
  ];

  function montar(cuerpo) {
    const N = 3;
    let s, g;
    const ctl = VIZ.controles(cuerpo);
    g = ctl.casillas(GARANTIAS.map((x) => ({ clave: x.clave, texto: x.texto, activo: false })), () => dibujar());
    ctl.boton('Escribir', () => escribir(), { primario: true });
    ctl.boton('Leer', () => leer());
    ctl.boton('Ir a la réplica siguiente', () => { s.en = (s.en + 1) % N; s.log = `El cliente se conecta ahora a ${R(s.en)}.`; s.t += 0.5; s.camino.push({ p: s.en, t: s.t }); dibujar(); });
    ctl.boton('Propagar una actualización', () => propagar());
    ctl.boton('Otro cliente escribe', () => otro());
    ctl.boton('Ejemplo', () => ejemplo());
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 230 : 240) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'escritura del cliente', forma: 'punto' },
      { color: C.s3, texto: 'lectura del cliente', forma: 'punto' },
      { color: C.inactivo, texto: 'escritura de otro cliente', forma: 'punto' },
      { color: C.tinta2, texto: 'propagación perezosa', forma: 'linea' },
      { color: C.s7, texto: 'sincronización forzada por una garantía', forma: 'linea' },
      { color: C.s8, texto: 'violación de una garantía', forma: 'punto' },
    ]);
    const tablas = el('div');
    cuerpo.appendChild(tablas);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Las réplicas se actualizan entre sí sin prisa (botón «Propagar»). Marque garantías para que la sesión obligue a la réplica a ponerse al día antes de operar.');

    function reiniciar() {
      s = { t: 0.5, en: 0, escrituras: [], aplicadas: Array.from({ length: N }, () => []), ws: [], rs: [], ops: [], props: [], camino: [{ p: 0, t: 0.5 }], violaciones: 0, syncs: 0, log: 'El cliente está conectado a L1. Todas las réplicas tienen x = 0.' };
      dibujar();
    }
    const valor = (r) => { const a = s.aplicadas[r]; return a.length ? s.escrituras[a[a.length - 1]].v : 0; };
    const aplicar = (r, w) => { if (!s.aplicadas[r].includes(w)) s.aplicadas[r].push(w); };

    // Trae a la réplica r las escrituras que le faltan del conjunto dado (en orden), como lo exigiría una garantía.
    function ponerAlDia(r, conjunto, motivo) {
      const faltan = conjunto.filter((w) => !s.aplicadas[r].includes(w)).sort((a, b) => a - b);
      for (const w of faltan) {
        const origen = s.escrituras[w].r;
        s.props.push({ de: origen, a: r, t0: s.t, t1: s.t + 0.4, sync: true });
        aplicar(r, w);
        s.syncs++;
      }
      if (faltan.length) { s.t += 0.5; return `${R(r)} primero trae ${faltan.map((w) => `W${w + 1}`).join(', ')} (${motivo}). `; }
      return '';
    }

    function escribir() {
      const r = s.en;
      let pre = '';
      const faltaW = s.ws.filter((w) => !s.aplicadas[r].includes(w));
      const faltaR = s.rs.filter((w) => !s.aplicadas[r].includes(w));
      if (g.mw) pre += ponerAlDia(r, s.ws, 'escrituras monótonas');
      if (g.wfr) pre += ponerAlDia(r, s.rs, 'escrituras siguen a lecturas');
      const w = s.escrituras.length;
      s.escrituras.push({ r, v: 10 * (w + 1), propio: true });
      aplicar(r, w);
      const viola = [];
      if (!g.mw && faltaW.length) viola.push(`escrituras monótonas: W${w + 1} se aplica en ${R(r)} antes que ${faltaW.map((x) => `W${x + 1}`).join(', ')}`);
      if (!g.wfr && faltaR.length) viola.push(`escrituras siguen a lecturas: ${R(r)} no tiene ${faltaR.map((x) => `W${x + 1}`).join(', ')}, que el cliente ya leyó`);
      s.ws.push(w);
      s.ops.push({ p: r, t: s.t, tipo: 'W', texto: `W${w + 1}: x=${10 * (w + 1)}`, viola: viola.length > 0 });
      s.violaciones += viola.length;
      s.log = `${pre}El cliente escribe x = ${10 * (w + 1)} (W${w + 1}) en ${R(r)}.${viola.length ? ' Viola ' + viola.join('; ') + '.' : ''}`;
      s.t += 1; s.camino.push({ p: r, t: s.t - 1 });
      dibujar();
    }

    function leer() {
      const r = s.en;
      let pre = '';
      const faltaW = s.ws.filter((w) => !s.aplicadas[r].includes(w));
      const faltaR = s.rs.filter((w) => !s.aplicadas[r].includes(w));
      if (g.ryw) pre += ponerAlDia(r, s.ws, 'leer lo escrito');
      if (g.mr) pre += ponerAlDia(r, s.rs, 'lecturas monótonas');
      const v = valor(r);
      const viola = [];
      if (!g.ryw && faltaW.length) viola.push(`leer lo escrito: no ve ${faltaW.map((x) => `W${x + 1}`).join(', ')}`);
      if (!g.mr && faltaR.length) viola.push(`lecturas monótonas: ya había visto ${faltaR.map((x) => `W${x + 1}`).join(', ')}`);
      for (const w of s.aplicadas[r]) if (!s.rs.includes(w)) s.rs.push(w);
      s.ops.push({ p: r, t: s.t, tipo: 'R', texto: `R: x=${v}`, viola: viola.length > 0 });
      s.violaciones += viola.length;
      s.log = `${pre}El cliente lee x = ${v} en ${R(r)}.${viola.length ? ' Viola ' + viola.join('; ') + '.' : ''}`;
      s.t += 1; s.camino.push({ p: r, t: s.t - 1 });
      dibujar();
    }

    function propagar() {
      // La actualización pendiente más antigua: la primera escritura que alguna réplica aún no tiene.
      for (let w = 0; w < s.escrituras.length; w++) for (let r = 0; r < N; r++) {
        if (s.aplicadas[r].includes(w)) continue;
        const origen = s.escrituras[w].r;
        s.props.push({ de: origen, a: r, t0: s.t, t1: s.t + 0.8 });
        aplicar(r, w);
        s.log = `La réplica ${R(origen)} propaga W${w + 1} a ${R(r)}.`;
        s.t += 0.5;
        return dibujar();
      }
      s.log = 'No hay actualizaciones pendientes: todas las réplicas convergieron (consistencia eventual).';
      dibujar();
    }

    function otro() {
      const r = (s.en + 1) % N, w = s.escrituras.length;
      s.escrituras.push({ r, v: 10 * (w + 1), propio: false });
      aplicar(r, w);
      s.ops.push({ p: r, t: s.t, tipo: 'O', texto: `W${w + 1}: x=${10 * (w + 1)}` });
      s.log = `Otro cliente escribe x = ${10 * (w + 1)} (W${w + 1}) en ${R(r)}.`;
      s.t += 1;
      dibujar();
    }

    function ejemplo() {
      reiniciar();
      escribir();
      s.en = 1; s.t += 0.5; s.camino.push({ p: 1, t: s.t });
      leer();
      s.log = 'Ejemplo: el cliente escribe en L1, se mueve a L2 antes de que llegue la propagación y lee. ' + s.log + (g.ryw ? '' : ' Marque «Leer lo escrito» y repita el ejemplo.');
      dibujar();
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const tMax = Math.max(8, s.t + 1);
      const geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: N }, (_, i) => R(i)), t: [0, tMax], sup: 30, inf: 26,
        colorProceso: (p) => (p === s.en ? C.s4 : C.tinta),
        mensajes: s.props.map((m) => ({ p0: m.de, t0: m.t0, p1: m.a, t1: m.t1, color: m.sync ? C.s7 : C.tinta2, ancho: m.sync ? 2.2 : 1.3 })),
        eventos: s.ops.map((o) => ({
          p: o.p, t: o.t, relleno: o.viola ? C.s8 : o.tipo === 'W' ? C.s1 : o.tipo === 'R' ? C.s3 : C.inactivo,
          texto: o.texto, colorTexto: o.viola ? C.s8 : C.tinta, tam: 10, r: 5,
        })),
      });
      // Recorrido del cliente.
      ctx.save(); ctx.strokeStyle = VIZ.alfa(C.s4, 0.8); ctx.lineWidth = 2; ctx.setLineDash([2, 4]);
      ctx.beginPath(); s.camino.forEach((c, i) => { const x = geo.x(c.t), y = geo.y(c.p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
      const u = s.camino[s.camino.length - 1];
      VIZ.marcador(ctx, geo.x(Math.max(u.t, s.t - 0.6)), geo.y(s.en), C.s4, 6, 1);
      // Estado de réplicas y sesión.
      tablas.replaceChildren();
      for (let r = 0; r < N; r++) {
        const tira = VIZ.grafo.estructura(tablas, `${R(r)} (x = ${valor(r)}):`);
        tira.set(s.aplicadas[r].map((w) => ({ texto: `W${w + 1}`, color: s.escrituras[w].propio ? C.s1 : C.inactivo, tinta: s.escrituras[w].propio ? C.s1 : C.tinta2 })), 'sin escrituras');
      }
      registro.textContent = s.log;
      lectura.set([
        ['conectado a', R(s.en)],
        ['conjunto de escritura', s.ws.map((w) => `W${w + 1}`).join(' ') || '∅'],
        ['conjunto de lectura', s.rs.map((w) => `W${w + 1}`).join(' ') || '∅'],
        ['violaciones', String(s.violaciones)],
        ['sincronizaciones forzadas', String(s.syncs)],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    reiniciar();
  }

  VIZ.registrarTema('client-centric-consistency', {
    intro: String.raw`
      <p>Muchos almacenes replicados ofrecen solo <strong>consistencia eventual</strong>: si dejan de llegar escrituras, todas las réplicas terminan
      iguales, pero mientras tanto cada una puede estar atrasada. Para la mayoría de los usuarios eso no importa… salvo cuando un mismo usuario
      cambia de réplica: un teléfono que pasa de una antena a otra, o una aplicación detrás de un balanceador de carga.</p>
      <p>Los modelos <strong>centrados en el cliente</strong> (Terry et al., sistema Bayou, 1994) no prometen nada entre clientes distintos, pero sí
      que la <em>sesión</em> de un cliente se vea coherente: que no vea retroceder los datos, que vea lo que él mismo escribió y que sus escrituras se
      apliquen en orden, sin importar a qué réplica se conecte.</p>`,
    visualizaciones: [
      {
        titulo: 'Un cliente que cambia de réplica',
        descripcion: 'Pulse «Ejemplo»: el cliente escribe en L1, pasa a L2 y lee un valor viejo (violación en rojo). Active «Leer lo escrito» y repita: L2 trae primero la escritura (flecha violeta).',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Las cuatro garantías de sesión</h2>
      <p>La sesión guarda un <strong>conjunto de escritura</strong> \(WS\) (lo que escribió) y un <strong>conjunto de lectura</strong> \(RS\) (las escrituras
      que influyeron en lo que leyó). Antes de operar en la réplica \(L\), se exige:</p>
      <table>
        <tr><th>Garantía</th><th>Antes de…</th><th>\(L\) debe tener</th><th>Evita</th></tr>
        <tr><td>Lecturas monótonas</td><td>leer</td><td>\(RS\)</td><td>Ver un correo y que luego desaparezca</td></tr>
        <tr><td>Leer lo escrito</td><td>leer</td><td>\(WS\)</td><td>Cambiar la contraseña y que la nueva no funcione</td></tr>
        <tr><td>Escrituras monótonas</td><td>escribir</td><td>\(WS\)</td><td>Que la versión 2 de un archivo quede pisada por la 1</td></tr>
        <tr><td>Escrituras siguen a lecturas</td><td>escribir</td><td>\(RS\)</td><td>Una respuesta aplicada donde aún no existe la pregunta</td></tr>
      </table>
      <p>Si \(L\) no cumple, el sistema puede traer las escrituras que faltan (como la figura), redirigir al cliente o esperar.</p>

      <h2>Implementación con vectores de versión</h2>
      <p>Cada escritura recibe un identificador (réplica, número); un conjunto de escrituras se resume en un <strong>vector de versión</strong>
      \(V[j] = \) la mayor escritura de la réplica \(j\) incluida. Si cada réplica aplica las escrituras de cada origen en orden, «\(L\) tiene \(WS\)» se reduce a
      \(V_{WS} \le V_L\) componente a componente, como en los <a href="tema.html?id=vector-clocks">relojes vectoriales</a>. El cliente lleva sus dos vectores
      consigo y los presenta en cada operación.</p>

      <h2>Relación con otros modelos</h2>
      <p>Las cuatro garantías juntas, aplicadas a todas las sesiones, equivalen a la <a href="tema.html?id=causal-consistency">consistencia causal</a>
      (Brzezinski, Sobaniec y Wawrzyniak, 2004): son la causalidad vista desde un solo cliente. Son mucho más baratas que la
      <a href="tema.html?id=linearizability">linealizabilidad</a> y siguen funcionando cuando la red se particiona, siempre que el cliente pueda llegar a
      alguna réplica suficientemente actualizada.</p>`,
  });
})();
