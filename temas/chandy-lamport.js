(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;

  /* ---------- Simulación: sucursales que se transfieren dinero por canales FIFO ---------- */

  function simular({ n = 3, semilla = 1, tSnap = 4, ini = 0 }) {
    const rnd = VIZ.semilla(semilla);
    const saldo = new Array(n).fill(100);
    const total = 100 * n;
    const eventos = [], msgs = [];
    const cola = [];
    const ultimoCanal = {};
    const llegada = (de, a, t) => {
      const k = `${de}-${a}`;
      const tl = Math.max(t + 0.8 + rnd() * 2.2, (ultimoCanal[k] || 0) + 0.15); // FIFO: nadie adelanta en un canal
      ultimoCanal[k] = tl;
      return tl;
    };
    for (let t = 0.4; t < 9; t += 0.35 + rnd() * 0.7) cola.push({ t, tipo: 'envio', p: Math.floor(rnd() * n) });
    cola.push({ t: tSnap, tipo: 'inicio', p: ini });
    // Estado de la instantánea
    const reg = new Array(n).fill(null), grabando = Array.from({ length: n }, () => new Array(n).fill(false));
    const canal = Array.from({ length: n }, () => Array.from({ length: n }, () => []));
    const registrar = (p, t, motivo) => {
      reg[p] = { saldo: saldo[p], t };
      eventos.push({ p, t, tipo: 'registro', saldo: saldo[p], texto: motivo });
      for (let q = 0; q < n; q++) if (q !== p) {
        grabando[q][p] = true;
        const m = { de: p, a: q, t0: t + 0.02, t1: llegada(p, q, t), marcador: true };
        msgs.push(m);
        cola.push({ t: m.t1, tipo: 'llegada', m });
      }
    };
    for (let g = 0; g < 2000 && cola.length; g++) {
      cola.sort((a, b) => a.t - b.t);
      const e = cola.shift();
      if (e.tipo === 'envio') {
        const p = e.p;
        let q = Math.floor(rnd() * (n - 1)); if (q >= p) q++;
        const monto = 5 * (1 + Math.floor(rnd() * 6));
        if (saldo[p] < monto) continue;
        saldo[p] -= monto;
        const m = { de: p, a: q, t0: e.t, t1: llegada(p, q, e.t), monto };
        msgs.push(m);
        eventos.push({ p, t: e.t, tipo: 'envio', saldo: saldo[p], m });
        cola.push({ t: m.t1, tipo: 'llegada', m });
      } else if (e.tipo === 'inicio') {
        registrar(e.p, e.t, `${P(e.p)} inicia la instantánea: registra su saldo (${saldo[e.p]}) y envía un marcador por cada canal de salida.`);
      } else {
        const m = e.m, p = m.a;
        if (m.marcador) {
          if (!reg[p]) {
            registrar(p, e.t, `${P(p)} recibe su primer marcador (desde ${P(m.de)}): registra su saldo (${saldo[p]}), anota el canal ${P(m.de)}→${P(p)} como vacío y reenvía marcadores.`);
            grabando[m.de][p] = false;
          } else {
            grabando[m.de][p] = false;
            const c = canal[m.de][p];
            eventos.push({ p, t: e.t, tipo: 'cierre', texto: `${P(p)} recibe el marcador de ${P(m.de)}: deja de grabar ese canal, cuyo estado es ${c.length ? c.map((x) => x.monto).join(' + ') : 'vacío'}.` });
          }
        } else {
          saldo[p] += m.monto;
          // ¿p ya registró y aún graba el canal de m.de? Entonces el mensaje está «en tránsito» en la instantánea.
          if (reg[p] && grabando[m.de][p]) { canal[m.de][p].push(m); m.enCanal = true; }
          eventos.push({ p, t: e.t, tipo: 'recepcion', saldo: saldo[p], m });
        }
      }
    }
    eventos.sort((a, b) => a.t - b.t);
    const tMax = Math.max(...eventos.map((e) => e.t), ...msgs.map((m) => m.t1)) + 0.4;
    return { n, eventos, msgs, reg, canal, total, tMax };
  }

  /* ---------- Fig. 1: la instantánea paso a paso ---------- */

  function montarInstantanea(cuerpo) {
    const est = { semilla: 3, tSnap: 3.5, ini: 0 };
    let sim, k = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Momento en que empieza', min: 1, max: 7, paso: 0.25, valor: est.tSnap, formato: (v) => `t = ${v}`, alCambiar: (v) => { est.tSnap = v; rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Inicia', valor: '0', opciones: [['0', 'P1'], ['1', 'P2'], ['2', 'P3']], alCambiar: (v) => { est.ini = +v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Nuevos datos', () => { est.semilla++; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 250 : 270) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'transferencia', forma: 'linea' },
      { color: C.s7, texto: 'marcador / corte de la instantánea', forma: 'linea' },
      { color: C.s6, texto: 'estado registrado', forma: 'punto' },
      { color: C.s2, texto: 'transferencia en tránsito (estado de canal)', forma: 'linea' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada sucursal empieza con 100. Las transferencias viajan por canales FIFO; el dinero total es siempre 300, pero nunca está todo en las sucursales a la vez.');

    function iniciar() {
      sim = simular({ semilla: est.semilla * 19, tSnap: est.tSnap, ini: est.ini });
      k = -1;
      return (function* () { for (k = 0; k < sim.eventos.length; k++) yield; k = sim.eventos.length; })();
    }

    function dibujar() {
      lienzo.limpiar();
      const ahora = k < 0 ? 0 : k >= sim.eventos.length ? sim.tMax : sim.eventos[k].t;
      const vis = sim.eventos.filter((_, i) => i <= k);
      const regs = vis.filter((e) => e.tipo === 'registro');
      const corte = regs.length === sim.n ? Array.from({ length: sim.n }, (_, p) => regs.find((e) => e.p === p).t) : null;
      D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: sim.n }, (_, p) => P(p)), t: [0, sim.tMax], sup: 30, inf: 28,
        ahora: k >= 0 && k < sim.eventos.length ? ahora : null,
        corte, colorCorte: C.s7,
        mensajes: sim.msgs.filter((m) => m.t0 <= ahora + 1e-9).map((m) => ({
          p0: m.de, t0: m.t0, p1: m.a, t1: m.t1, hasta: ahora < m.t1 ? ahora : null,
          color: m.marcador ? C.s7 : m.enCanal && m.t1 <= ahora ? C.s2 : C.s1, ancho: m.enCanal && m.t1 <= ahora ? 2.6 : 1.5,
          guiones: m.marcador ? [5, 3] : null, texto: m.marcador ? null : String(m.monto),
        })),
        eventos: vis.filter((e) => e.tipo !== 'cierre').map((e) => ({
          p: e.p, t: e.t, r: e.tipo === 'registro' ? 6 : 3.5,
          relleno: e.tipo === 'registro' ? C.s6 : C.tinta2, anillo: e === sim.eventos[k] ? C.s2 : null,
          texto: e.tipo === 'registro' ? String(e.saldo) : null, colorTexto: C.s6, fijo: e.tipo === 'registro',
        })),
      });
      // Tabla de la instantánea
      const reg = new Array(sim.n).fill(null);
      regs.forEach((e) => { reg[e.p] = e.saldo; });
      const canales = [];
      for (let a = 0; a < sim.n; a++) for (let b = 0; b < sim.n; b++) if (a !== b) {
        const enC = sim.msgs.filter((m) => m.enCanal && m.de === a && m.a === b && m.t1 <= ahora);
        if (enC.length) canales.push(`${P(a)}→${P(b)}: ${enC.map((m) => m.monto).join(' + ')}`);
      }
      const sumaReg = reg.reduce((s, v) => s + (v || 0), 0);
      const sumaCanal = sim.msgs.filter((m) => m.enCanal && m.t1 <= ahora).reduce((s, m) => s + m.monto, 0);
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th', { class: 'izq' }, 'sucursal'), ...Array.from({ length: sim.n }, (_, p) => el('th', null, P(p))), el('th', null, 'canales'), el('th', null, 'total')),
        el('tr', null, el('td', { class: 'izq' }, 'registrado'), ...reg.map((v) => el('td', null, v == null ? '—' : String(v))),
          el('td', null, String(sumaCanal)), el('td', { style: { fontWeight: 600 } }, String(sumaReg + sumaCanal)))));
      const e = sim.eventos[k];
      registro.textContent = k < 0 ? 'Las sucursales transfieren dinero entre sí. En el instante elegido, una de ellas iniciará la instantánea.'
        : k >= sim.eventos.length ? `Instantánea completa: ${reg.join(' + ')} en sucursales + ${sumaCanal} en tránsito = ${sumaReg + sumaCanal}. Se conserva el total aunque ningún instante real tuvo exactamente ese estado.`
          : e.texto || (e.tipo === 'envio' ? `${P(e.p)} transfiere ${e.m.monto} a ${P(e.m.a)}.` : `${P(e.p)} recibe ${e.m.monto} de ${P(e.m.de)}${e.m.enCanal ? ': ya registró su saldo y aún graba ese canal, así que este dinero queda en el estado del canal.' : '.'}`);
      lectura.set([
        ['dinero real', String(sim.total)],
        ['registrado en sucursales', String(sumaReg)],
        ['en tránsito registrado', String(sumaCanal)],
        ['canales no vacíos', canales.join('; ') || '—'],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    rep.reiniciar();
  }

  /* ---------- Fig. 2: cortes consistentes ---------- */

  function montarCortes(cuerpo) {
    const est = { n: 3, semilla: 6 };
    let ej, corte, geo = null, arrastre = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Procesos', min: 2, max: 4, valor: est.n, alCambiar: (v) => { est.n = v; nuevo(); } });
    ctl.boton('Nuevos datos', () => { est.semilla++; nuevo(); }, { primario: true });
    ctl.boton('Corte vertical', () => { corte = corte.map(() => ej.tMax / 2); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => est.n * (w < 600 ? 56 : 64) + 50 });
    lienzo.canvas.style.cursor = 'ew-resize';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'evento antes del corte', forma: 'punto' },
      { color: C.inactivo, texto: 'evento después del corte', forma: 'punto' },
      { color: C.s4, texto: 'mensaje en tránsito (cruza hacia el futuro)', forma: 'linea' },
      { color: C.s8, texto: 'mensaje huérfano (recibido sin haber sido enviado)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre el corte sobre cada línea de proceso. El corte es consistente si ningún mensaje lo cruza del futuro al pasado.');

    function nuevo() {
      ej = D.ejecucion({ n: est.n, k: 14, semilla: est.semilla * 29 + est.n, pLocal: 0.15 });
      corte = new Array(est.n).fill(ej.tMax / 2);
      lienzo.ajustar(true);
    }
    const antes = (e) => e.t <= corte[e.p];

    function dibujar() {
      lienzo.limpiar();
      let huerfanos = 0, transito = 0;
      const mensajes = ej.mensajes.map(({ e, r }) => {
        const a = ej.eventos[e], b = ej.eventos[r];
        const huerfano = !antes(a) && antes(b), enTransito = antes(a) && !antes(b);
        if (huerfano) huerfanos++;
        if (enTransito) transito++;
        return { p0: a.p, t0: a.t, p1: b.p, t1: b.t, color: huerfano ? C.s8 : enTransito ? C.s4 : C.eje, ancho: huerfano || enTransito ? 2.6 : 1.5 };
      });
      geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: est.n }, (_, p) => P(p)), t: [0.3, ej.tMax + 0.7], corte, colorCorte: huerfanos ? C.s8 : C.s7,
        mensajes,
        eventos: ej.eventos.map((e) => ({ p: e.p, t: e.t, relleno: antes(e) ? C.tinta : C.inactivo, r: 4.5 })),
      });
      // Asas del corte
      corte.forEach((t, p) => VIZ.marcador(lienzo.ctx, geo.x(t), geo.y(p), huerfanos ? C.s8 : C.s7, 6, 3));
      registro.textContent = huerfanos
        ? `Inconsistente: ${huerfanos} mensaje${huerfanos > 1 ? 's' : ''} se recibe${huerfanos > 1 ? 'n' : ''} antes del corte pero se envía${huerfanos > 1 ? 'n' : ''} después. Ese estado global registraría un efecto sin su causa.`
        : `Consistente: el pasado del corte está cerrado bajo «ocurre antes». ${transito ? `${transito} mensaje${transito > 1 ? 's' : ''} en tránsito forma${transito > 1 ? 'n' : ''} parte del estado de los canales.` : 'No hay mensajes en tránsito.'}`;
      lectura.set([
        ['consistente', huerfanos ? 'no' : 'sí'],
        ['huérfanos', String(huerfanos)],
        ['en tránsito', String(transito)],
        ['eventos en el pasado', `${ej.eventos.filter(antes).length} de ${ej.eventos.length}`],
      ]);
    }
    lienzo.alDibujar = () => ej && dibujar();
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const p = Math.max(0, Math.min(est.n - 1, geo.p(y)));
      if (Math.abs(geo.y(p) - y) > 26) return;
      arrastre = p;
      lienzo.canvas.setPointerCapture(ev.pointerId);
      corte[p] = Math.max(0.3, Math.min(ej.tMax + 0.7, geo.t(x)));
      dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (arrastre < 0) return;
      const { x } = lienzo.posicion(ev);
      corte[arrastre] = Math.max(0.3, Math.min(ej.tMax + 0.7, geo.t(x)));
      dibujar();
    });
    const soltar = () => { arrastre = -1; };
    lienzo.canvas.addEventListener('pointerup', soltar);
    lienzo.canvas.addEventListener('pointercancel', soltar);
    nuevo();
  }

  VIZ.registrarTema('chandy-lamport', {
    intro: String.raw`
      <p>Para detectar un interbloqueo, guardar un punto de control o simplemente contar el dinero de un banco distribuido, hace falta
      un <strong>estado global</strong>: el estado de cada proceso más los mensajes que viajan por los canales. Sin un reloj común no se puede
      «congelar todo a las 12:00»; si cada proceso anota su estado en un momento cualquiera, una transferencia puede contarse dos veces o ninguna.</p>
      <p>El algoritmo de <strong>Chandy y Lamport</strong> (1985) obtiene un estado <em>consistente</em> sin detener el sistema, usando
      mensajes especiales, los <strong>marcadores</strong>, que separan en cada canal lo que pasó antes de la instantánea de lo que pasó después.
      Solo requiere canales FIFO.</p>`,
    visualizaciones: [
      {
        titulo: 'Instantánea con marcadores',
        descripcion: 'Avance evento por evento. Los marcadores (violeta) se propagan por todos los canales; las transferencias que llegan a un proceso que ya registró su saldo, por un canal del que aún no llega el marcador, quedan en el estado del canal (naranjo).',
        montar: montarInstantanea,
      },
      {
        titulo: 'Cortes consistentes',
        descripcion: 'Un corte elige un instante en cada proceso. Mueva sus puntos hasta producir un mensaje huérfano (rojo): el corte deja de ser consistente.',
        montar: montarCortes,
      },
    ],
    teoria: String.raw`
      <h2>Cortes</h2>
      <p>Un <strong>corte</strong> \(K\) es un prefijo de la historia de cada proceso; su <em>frontera</em> es el último evento incluido en cada uno.
      \(K\) es <strong>consistente</strong> si</p>
      \[ e \in K \ \land\ e' \to e \ \Rightarrow\ e' \in K, \]
      <p>es decir, si está cerrado hacia el pasado bajo la relación <a href="tema.html?id=lamport-clocks">ocurre antes</a>. Basta revisar los
      mensajes: un corte es inconsistente exactamente cuando contiene la recepción de un mensaje pero no su envío. Los mensajes enviados dentro y
      recibidos fuera son el <strong>estado de los canales</strong>.</p>

      <h2>Algoritmo</h2>
      <pre><code>iniciador:
    registrar el estado propio
    enviar un marcador por cada canal de salida
    empezar a grabar cada canal de entrada

al recibir un marcador por el canal c:
    si aún no registró su estado:
        registrar el estado propio;  estado(c) ← vacío
        enviar un marcador por cada canal de salida
        empezar a grabar los demás canales de entrada
    si no:
        dejar de grabar c;  estado(c) ← lo recibido por c desde que empezó a grabar

al recibir un mensaje normal por un canal que se está grabando: agregarlo a estado(c)</code></pre>
      <p>Termina cuando cada proceso recibió un marcador por cada canal de entrada. Con \(e\) canales usa \(e\) marcadores, y cualquier proceso, o
      varios a la vez, pueden iniciar.</p>

      <h2>Corrección</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> El estado registrado corresponde a un corte consistente: si \(e' \to e\) y \(e\) ocurrió antes
      de que su proceso registrara, entonces \(e'\) también ocurrió antes de que el suyo registrara.</p></div>
      <p>Basta verlo para un mensaje \(m\) de \(p\) a \(q\). Si \(p\) envió \(m\) <em>después</em> de registrar, también envió antes el marcador por ese
      canal; por FIFO, el marcador llega a \(q\) antes que \(m\), y \(q\) registra a más tardar entonces: la recepción de \(m\) queda fuera del corte.
      Además, \(m\) se cuenta exactamente una vez: en el estado de \(p\) (aún no enviado), en el canal (enviado antes del marcador, recibido después de
      que \(q\) registró) o en el estado de \(q\).</p>
      <p>El estado registrado quizás nunca existió en ningún instante real, pero es <em>alcanzable</em>: existe una ejecución equivalente que pasa
      por él. Por eso sirve para detectar <strong>propiedades estables</strong> (terminación, interbloqueo, pérdida de un token): si son verdaderas en
      la instantánea, siguen siéndolo ahora. La <a href="tema.html?id=termination-detection">detección de terminación</a> es un caso particular.</p>`,
  });
})();
