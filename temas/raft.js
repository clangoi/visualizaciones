(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const N = 5, TICK = 5, LATIDO = 50;
  const S = (i) => `S${i + 1}`;

  /* Simulación de Raft (Ongaro y Ousterhout, 2014) en milisegundos. Mensajes con demora de 15 a 35 ms. */
  function crear(semilla) {
    const rnd = VIZ.semilla(semilla);
    const plazo = (t) => t + 150 + rnd() * 150;
    const s = {
      t: 0, rnd, msgs: [], elecciones: 0, log: 'Todos empiezan como seguidores en el término 0, con temporizadores de elección al azar entre 150 y 300 ms.',
      nodos: Array.from({ length: N }, () => ({ rol: 'seguidor', termino: 0, voto: null, votos: new Set(), registro: [], confirmado: 0, plazo: 0, caido: false, sig: [], match: [], ultimoLatido: 0 })),
      plazoNuevo: plazo,
    };
    s.nodos.forEach((n) => { n.plazo = plazo(0); });
    return s;
  }

  function enviar(s, de, a, tipo, datos) { s.msgs.push({ de, a, tipo, ...datos, t0: s.t, t1: s.t + 15 + s.rnd() * 20 }); }
  const ultimoTermino = (n) => (n.registro.length ? n.registro[n.registro.length - 1].termino : 0);
  const mayoria = Math.floor(N / 2) + 1;

  function bajar(s, i, termino) {
    const n = s.nodos[i];
    n.termino = termino; n.rol = 'seguidor'; n.voto = null; n.plazo = s.plazoNuevo(s.t);
  }

  function enviarAppend(s, i, j) {
    const n = s.nodos[i], prev = n.sig[j] - 1;
    enviar(s, i, j, 'AE', { termino: n.termino, prev, prevTerm: prev >= 0 ? n.registro[prev].termino : 0, entradas: n.registro.slice(n.sig[j]), confirmado: n.confirmado });
  }

  function paso(s) {
    s.t += TICK;
    // Entregar mensajes.
    const llegan = s.msgs.filter((m) => m.t1 <= s.t);
    s.msgs = s.msgs.filter((m) => m.t1 > s.t);
    for (const m of llegan) {
      const n = s.nodos[m.a];
      if (n.caido) continue;
      if (m.termino > n.termino) bajar(s, m.a, m.termino);
      if (m.tipo === 'RV') {
        const alDia = m.ultTerm > ultimoTermino(n) || (m.ultTerm === ultimoTermino(n) && m.ultIdx >= n.registro.length);
        const da = m.termino === n.termino && (n.voto == null || n.voto === m.de) && alDia;
        if (da) { n.voto = m.de; n.plazo = s.plazoNuevo(s.t); }
        enviar(s, m.a, m.de, 'RVR', { termino: n.termino, da });
      } else if (m.tipo === 'RVR') {
        if (n.rol === 'candidato' && m.termino === n.termino && m.da) {
          n.votos.add(m.de);
          if (n.votos.size >= mayoria) {
            n.rol = 'lider';
            n.sig = new Array(N).fill(n.registro.length); n.match = new Array(N).fill(0);
            s.log = `${S(m.a)} reúne ${n.votos.size} votos de 5 y es líder del término ${n.termino}. Envía latidos para que nadie más inicie una elección.`;
            for (let j = 0; j < N; j++) if (j !== m.a) enviarAppend(s, m.a, j);
            n.ultimoLatido = s.t;
          }
        }
      } else if (m.tipo === 'AE') {
        if (m.termino < n.termino) { enviar(s, m.a, m.de, 'AER', { termino: n.termino, ok: false }); continue; }
        n.rol = 'seguidor'; n.plazo = s.plazoNuevo(s.t);
        const coincide = m.prev < 0 || (n.registro[m.prev] && n.registro[m.prev].termino === m.prevTerm);
        if (!coincide) { enviar(s, m.a, m.de, 'AER', { termino: n.termino, ok: false }); continue; }
        // Agregar entradas, borrando las que estén en conflicto.
        m.entradas.forEach((e, k) => {
          const idx = m.prev + 1 + k;
          if (n.registro[idx] && n.registro[idx].termino !== e.termino) n.registro.length = idx;
          if (!n.registro[idx]) n.registro[idx] = e;
        });
        n.confirmado = Math.max(n.confirmado, Math.min(m.confirmado, m.prev + 1 + m.entradas.length));
        enviar(s, m.a, m.de, 'AER', { termino: n.termino, ok: true, match: m.prev + 1 + m.entradas.length });
      } else if (m.tipo === 'AER') {
        if (n.rol !== 'lider' || m.termino !== n.termino) continue;
        if (m.ok) {
          n.match[m.de] = Math.max(n.match[m.de], m.match); n.sig[m.de] = n.match[m.de];
          // Confirmar el mayor índice replicado en una mayoría con entrada del término actual.
          for (let k = n.registro.length; k > n.confirmado; k--) {
            const copias = 1 + n.match.filter((x, j) => j !== m.a && x >= k).length;
            if (copias >= mayoria && n.registro[k - 1].termino === n.termino) { n.confirmado = k; s.log = `La entrada ${k} está en una mayoría: el líder ${S(m.a)} la confirma (commit) y se lo informará a los demás en el próximo latido.`; break; }
          }
        } else { n.sig[m.de] = Math.max(0, n.sig[m.de] - 1); enviarAppend(s, m.a, m.de); }
      }
    }
    // Temporizadores.
    s.nodos.forEach((n, i) => {
      if (n.caido) return;
      if (n.rol === 'lider') {
        if (s.t - n.ultimoLatido >= LATIDO) { n.ultimoLatido = s.t; for (let j = 0; j < N; j++) if (j !== i) enviarAppend(s, i, j); }
      } else if (s.t >= n.plazo) {
        n.rol = 'candidato'; n.termino++; n.voto = i; n.votos = new Set([i]); n.plazo = s.plazoNuevo(s.t);
        s.elecciones++;
        s.log = `${S(i)} no recibió latidos a tiempo: pasa a candidato, sube al término ${n.termino}, vota por sí mismo y pide votos.`;
        for (let j = 0; j < N; j++) if (j !== i) enviar(s, i, j, 'RV', { termino: n.termino, ultIdx: n.registro.length, ultTerm: ultimoTermino(n) });
      }
    });
  }

  function montar(cuerpo) {
    let s = crear(1), semilla = 1, visible = true, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Velocidad', min: 0.1, max: 2, paso: 0.1, valor: 0.5, formato: (v) => `${v.toFixed(1)}× (ms simulados por ms)`, alCambiar: (v) => { vel = v; } });
    let vel = 0.5, acum = 0;
    const bucle = VIZ.bucle((dt) => {
      if (!visible) return false;
      acum += dt * vel;
      while (acum >= TICK) { acum -= TICK; paso(s); }
      dibujar();
      return true;
    }, () => { bPlay.textContent = 'Reproducir'; });
    const bPlay = ctl.boton('Reproducir', () => { if (bucle.activo) bucle.detener(); else { bPlay.textContent = 'Pausar'; bucle.iniciar(); } }, { primario: true });
    ctl.boton('Avanzar 50 ms', () => { for (let k = 0; k < 10; k++) paso(s); dibujar(); });
    ctl.boton('Comando del cliente', () => {
      const l = s.nodos.findIndex((n) => n.rol === 'lider' && !n.caido);
      if (l < 0) { s.log = 'No hay líder: el cliente debe esperar a que termine la elección.'; return dibujar(); }
      const n = s.nodos[l];
      n.registro.push({ termino: n.termino, cmd: `x${n.registro.length + 1}` });
      s.log = `El líder ${S(l)} agrega la entrada ${n.registro.length} a su registro (término ${n.termino}) y la replicará con el próximo latido.`;
      dibujar();
    });
    ctl.boton('Hacer caer al líder', () => {
      const l = s.nodos.findIndex((n) => n.rol === 'lider' && !n.caido);
      if (l < 0) { s.log = 'No hay un líder vivo en este momento.'; return dibujar(); }
      s.nodos[l].caido = true; s.log = `${S(l)} cae. Los seguidores dejarán de recibir latidos y, al vencer el primer temporizador, empezará una elección.`;
      dibujar();
    });
    ctl.boton('Reiniciar', () => { semilla++; s = crear(semilla); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(380, Math.max(300, w * 0.42)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.superficie, borde: C.tinta, texto: 'seguidor' }, { color: C.s4, texto: 'candidato' }, { color: C.s6, texto: 'líder' },
      { color: C.s1, texto: 'temporizador de elección', forma: 'linea' },
      { color: C.s2, texto: 'pedido de voto', forma: 'punto' }, { color: C.s7, texto: 'latido / entradas', forma: 'punto' },
    ]);
    VIZ.subtitulo(cuerpo, 'Registros (color = término de cada entrada; borde grueso = confirmada):');
    const lienzo2 = VIZ.lienzo(cuerpo, { altoFn: () => N * 26 + 10 });
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un servidor para hacerlo caer o revivirlo. Los servidores conservan término, voto y registro al caer (están en disco).');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      geo = D.circulo(W, H, N, { margen: 46 });
      const rr = 20;
      for (const m of s.msgs) {
        const a = geo[m.de], b = geo[m.a], f = Math.min(1, (s.t - m.t0) / (m.t1 - m.t0));
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        const col = m.tipo === 'RV' || m.tipo === 'RVR' ? C.s2 : C.s7;
        ctx.strokeStyle = VIZ.alfa(col, 0.25); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke();
        VIZ.marcador(ctx, x, y, col, m.tipo.endsWith('R') ? 2.5 : 3.5, m.tipo.endsWith('R') ? 1 : 0);
      }
      s.nodos.forEach((n, i) => {
        const p = geo[i];
        // Temporizador de elección (arco).
        if (!n.caido && n.rol !== 'lider') {
          const f = Math.max(0, Math.min(1, (n.plazo - s.t) / 300));
          ctx.strokeStyle = C.s1; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, rr + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
        }
        D.nodo(ctx, p.x, p.y, S(i), { r: rr, caido: n.caido, relleno: n.rol === 'lider' ? C.s6 : n.rol === 'candidato' ? C.s4 : C.superficie, texto: n.rol === 'lider' ? C.sobre : C.tinta });
        D.etiqueta(ctx, `término ${n.termino}${n.voto != null && n.rol !== 'lider' ? ` · votó ${S(n.voto)}` : ''}`, p.x, p.y + rr + 16, { color: C.tinta2, tam: 10 });
      });
      // Registros
      const c2 = lienzo2.ctx, W2 = lienzo2.ancho;
      lienzo2.limpiar();
      const ancho = Math.min(30, (W2 - 50) / Math.max(10, ...s.nodos.map((n) => n.registro.length)));
      s.nodos.forEach((n, i) => {
        const y = 5 + i * 26;
        c2.font = VIZ.fuente(11, 600); c2.fillStyle = n.caido ? C.inactivo : C.tinta; c2.textAlign = 'left'; c2.textBaseline = 'middle';
        c2.fillText(S(i), 2, y + 10);
        n.registro.forEach((e, k) => {
          const x = 36 + k * ancho;
          c2.fillStyle = VIZ.alfa(VIZ.series[(e.termino - 1) % 8], 0.75);
          c2.fillRect(x, y, ancho - 3, 20);
          c2.strokeStyle = C.tinta; c2.lineWidth = k < n.confirmado ? 2.5 : 0.8;
          c2.strokeRect(x + 0.5, y + 0.5, ancho - 4, 19);
          if (ancho >= 18) { c2.fillStyle = C.sobre; c2.textAlign = 'center'; c2.font = VIZ.fuente(10, 600); c2.fillText(String(e.termino), x + (ancho - 3) / 2, y + 10.5); c2.textAlign = 'left'; }
        });
        if (!n.registro.length) { c2.fillStyle = C.apagado; c2.font = VIZ.fuente(10); c2.fillText('vacío', 36, y + 10); }
      });
      registro.textContent = s.log;
      const lider = s.nodos.findIndex((n) => n.rol === 'lider' && !n.caido);
      lectura.set([
        ['tiempo', `${s.t} ms`],
        ['líder', lider >= 0 ? `${S(lider)} (término ${s.nodos[lider].termino})` : 'ninguno'],
        ['elecciones iniciadas', String(s.elecciones)],
        ['entradas confirmadas', String(Math.max(0, ...s.nodos.map((n) => n.confirmado)))],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo2.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(geo, x, y, 26);
      if (i < 0) return;
      const n = s.nodos[i];
      n.caido = !n.caido;
      if (!n.caido) { n.rol = 'seguidor'; n.plazo = s.plazoNuevo(s.t); s.log = `${S(i)} vuelve como seguidor, con su término y su registro intactos.`; }
      else s.log = `${S(i)} cae.`;
      dibujar();
    });
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (!visible) bucle.detener(); }).observe(lienzo.canvas);
    // Un primer tramo para que la figura no empiece vacía: hasta tener líder y una entrada confirmada.
    for (let k = 0; k < 120 && !s.nodos.some((n) => n.rol === 'lider'); k++) paso(s);
    dibujar();
  }

  VIZ.registrarTema('raft', {
    intro: String.raw`
      <p><strong>Raft</strong> (Ongaro y Ousterhout, 2014) es un algoritmo de consenso para mantener un <strong>registro replicado</strong>: una secuencia de comandos que
      todos los servidores aplican en el mismo orden, para que la máquina de estados que construyen (una base de datos, un servicio de configuración) sea la misma en
      todos. Ofrece las mismas garantías que <a href="tema.html?id=paxos">Paxos</a>, pero fue diseñado para ser comprensible: separa el problema en elección de líder,
      replicación del registro y seguridad.</p>
      <p>El tiempo se divide en <strong>términos</strong> numerados, cada uno con a lo más un líder. El líder recibe los comandos de los clientes, los agrega a su registro y
      los replica; una entrada está <strong>confirmada</strong> cuando la tiene una mayoría. Si los seguidores dejan de oír al líder, uno de ellos se postula en un término nuevo.</p>`,
    visualizaciones: [
      {
        titulo: 'Elección y replicación',
        descripcion: 'Reproduzca, envíe comandos del cliente y haga caer al líder. Observe el temporizador (arco azul): el primero que vence inicia la elección. Con dos servidores caídos todavía hay mayoría (3 de 5); con tres, nada avanza.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Elección de líder</h2>
      <p>Cada servidor es <strong>seguidor</strong>, <strong>candidato</strong> o <strong>líder</strong>. Un seguidor que no recibe latidos durante un plazo al azar (150–300 ms) se
      vuelve candidato: incrementa su término, vota por sí mismo y envía <code>RequestVote</code>. Cada servidor vota a lo más una vez por término, y solo por un candidato cuyo
      registro esté al menos tan actualizado como el suyo (último término mayor, o igual con un registro igual o más largo). Quien reúne una mayoría es líder. Los plazos al azar
      hacen improbable que dos candidatos dividan los votos una y otra vez. Ver un término mayor en cualquier mensaje hace volver a seguidor.</p>

      <h2>Replicación</h2>
      <p>El líder envía <code>AppendEntries</code> con las entradas nuevas y el índice y término de la entrada anterior; el seguidor rechaza si no tiene esa entrada, y el líder
      retrocede hasta encontrar el punto en común y sobrescribe lo que sigue. Así se mantiene la propiedad de coincidencia:</p>
      <div class="recuadro"><p><strong>Coincidencia de registros.</strong> Si dos registros tienen una entrada con el mismo índice y término, son idénticos hasta ese índice.</p></div>
      <p>Una entrada del término actual que está en una mayoría queda <strong>confirmada</strong>, junto con todas las anteriores. El líder nunca confirma por conteo entradas de
      términos anteriores (podrían ser sobrescritas); se confirman indirectamente al confirmar una del término actual.</p>

      <h2>Seguridad</h2>
      <p><strong>Completitud del líder:</strong> si una entrada fue confirmada en un término, aparece en el registro de todos los líderes de términos posteriores. La razón es la
      misma que en Paxos: la mayoría que guardó la entrada y la mayoría que votó por el nuevo líder comparten un servidor, que no vota por un candidato con registro menos
      actualizado. De aquí sale que todas las máquinas de estado aplican los mismos comandos en el mismo orden.</p>

      <h2>Costo y uso</h2>
      <p>Con \(2f + 1\) servidores tolera \(f\) caídas. En operación normal, cada comando cuesta un viaje de ida y vuelta del líder a una mayoría. Lo usan etcd (Kubernetes),
      Consul, CockroachDB y TiKV. Como Paxos, garantiza seguridad siempre y vivacidad solo cuando la red es suficientemente estable: con un plazo de elección mucho mayor que la
      demora de los mensajes y menor que el tiempo medio entre fallas.</p>`,
  });
})();
