(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;
  const TIPO = { local: 'local', envio: 'envío', recepcion: 'recepción' };

  // Controles comunes: procesos, eventos y «Nuevos datos».
  function controlesEjecucion(ctl, est, alCambiar) {
    ctl.rango({ etiqueta: 'Procesos', min: 2, max: 5, valor: est.n, alCambiar: (v) => { est.n = v; alCambiar(); } });
    ctl.rango({ etiqueta: 'Eventos', min: 6, max: 22, valor: est.k, alCambiar: (v) => { est.k = v; alCambiar(); } });
  }
  const altoDiagrama = (n) => (w) => Math.max(170, n() * (w < 600 ? 58 : 66) + 44);

  function tooltipEventos(lienzo, obtener) {
    const tip = VIZ.tooltip(lienzo);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { geo, ej, visible } = obtener();
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(geo.eventos, x, y, 12);
      if (i < 0 || (visible && !visible(i))) return tip.ocultar();
      const e = ej.eventos[i];
      const detalle = e.tipo === 'envio' ? ` a ${P(e.a)}` : e.tipo === 'recepcion' ? ` desde ${P(e.de)}` : '';
      tip.mostrar(x, y, `evento <b>${e.nombre}</b> en ${P(e.p)}<br>${TIPO[e.tipo]}${detalle}<br>L = <b>${e.L}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
  }

  /* ---------- Fig. 1: marcas paso a paso ---------- */

  function montarPasos(cuerpo) {
    const est = { n: 3, k: 14, semilla: 4 };
    let ej, i = -1, mensaje = '', geo = null;
    const ctl = VIZ.controles(cuerpo);
    controlesEjecucion(ctl, est, () => nuevo());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Nuevos datos', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoDiagrama(() => est.n) });
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'evento aún sin marca', forma: 'punto' },
      { color: C.tinta, texto: 'evento con su marca L encima', forma: 'punto' },
      { color: C.s2, texto: 'evento actual y el mensaje que recibe', forma: 'punto' },
      { color: C.tinta2, texto: 'mensaje entregado', forma: 'linea' },
    ]);
    const tira = VIZ.grafo.estructura(cuerpo, 'Orden total (L, i):');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada proceso guarda un solo entero. Pase el cursor por un evento para ver su tipo y su marca.');
    tooltipEventos(lienzo, () => ({ geo, ej, visible: (k) => k <= i }));

    function nuevo() { ej = D.ejecucion({ n: est.n, k: est.k, semilla: est.semilla * 13 + est.n }); rep.reiniciar(); }

    function iniciar() {
      i = -1;
      mensaje = `Todos los relojes empiezan en 0. Se recorren los ${ej.eventos.length} eventos en el orden en que ocurren.`;
      return (function* () {
        for (i = 0; i < ej.eventos.length; i++) {
          const e = ej.eventos[i], ant = e.L - 1;
          if (e.tipo === 'local') mensaje = `${e.nombre} en ${P(e.p)} (evento local): L = ${ant} + 1 = ${e.L}.`;
          else if (e.tipo === 'envio') mensaje = `${e.nombre} en ${P(e.p)} envía un mensaje a ${P(e.a)}: L = ${ant} + 1 = ${e.L}, y el mensaje lleva la marca ${e.L}.`;
          else {
            const s = ej.eventos[e.par];
            const mayor = s.L > e.Lprev;
            mensaje = `${e.nombre} en ${P(e.p)} recibe el mensaje de ${s.nombre} (marca ${s.L}): L = max(${e.Lprev}, ${s.L}) + 1 = ${e.L}` +
              (mayor ? ` — el reloj de ${P(e.p)} salta hacia adelante.` : '.');
          }
          yield;
        }
        i = ej.eventos.length;
        mensaje = `Listo. Si a → b entonces L(a) < L(b); ordenando por (L, número de proceso) se obtiene un orden total que extiende la causalidad.`;
      })();
    }

    function dibujar() {
      lienzo.limpiar();
      const ev = ej.eventos;
      const actual = i >= 0 && i < ev.length ? ev[i] : null;
      geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: est.n }, (_, p) => P(p)),
        t: [0.4, ej.tMax + 0.6],
        ahora: actual ? actual.t : null,
        mensajes: ej.mensajes.map(({ e, r }) => {
          const a = ev[e], b = ev[r];
          const recibido = r <= i, enviado = e <= i;
          return {
            p0: a.p, t0: a.t, p1: b.p, t1: b.t,
            color: actual && r === i ? C.s2 : recibido ? C.tinta2 : enviado ? C.apagado : C.tenue,
            ancho: actual && r === i ? 2.5 : 1.5,
            hasta: !recibido && enviado ? actual.t : null,
            guiones: !enviado ? [2, 4] : null,
          };
        }),
        eventos: ev.map((e, k) => ({
          p: e.p, t: e.t,
          relleno: k === i ? C.s2 : k < i ? C.tinta : C.inactivo,
          texto: k <= i ? String(e.L) : null, fijo: k === i,
          colorTexto: k === i ? C.s2 : C.tinta,
          sub: e.nombre,
        })),
      });
      const hechos = ev.slice(0, Math.max(0, Math.min(i + 1, ev.length)));
      const orden = hechos.slice().sort((a, b) => a.L - b.L || a.p - b.p);
      tira.set(orden.map((e) => ({
        texto: `${e.nombre} (${e.L},${e.p + 1})`,
        color: e === actual ? C.s2 : C.eje,
        fondo: e === actual ? C.s2 : null,
        tinta: e === actual ? C.sobre : null,
      })), 'aún no hay eventos con marca');
      registro.textContent = mensaje;
      const relojes = Array.from({ length: est.n }, (_, p) => {
        const ult = hechos.filter((e) => e.p === p).pop();
        return ult ? ult.L : 0;
      });
      lectura.set([
        ['eventos marcados', `${hechos.length} de ${ev.length}`],
        ['mensajes', String(ej.mensajes.length)],
        ['relojes', relojes.map((v, p) => `${P(p)}=${v}`).join(' ')],
        ['L máxima', String(Math.max(0, ...relojes))],
      ]);
    }
    lienzo.alDibujar = () => ej && dibujar();
    nuevo();
  }

  /* ---------- Fig. 2: causalidad frente a marcas ---------- */

  function montarCausalidad(cuerpo) {
    const est = { n: 3, k: 16, semilla: 9 };
    let ej, sel = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    controlesEjecucion(ctl, est, () => nuevo());
    ctl.boton('Nuevos datos', () => { est.semilla++; nuevo(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoDiagrama(() => est.n) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'evento elegido', forma: 'punto' },
      { color: C.s1, texto: 'pasado causal (→ elegido)', forma: 'punto' },
      { color: C.s3, texto: 'futuro causal (elegido →)', forma: 'punto' },
      { color: C.s4, texto: 'concurrente (∥)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un evento para elegirlo. Los números sobre los eventos son sus marcas de Lamport.');
    tooltipEventos(lienzo, () => ({ geo, ej }));

    const relacion = (a) => (a === sel ? 'sel' : ej.antes(a, sel) ? 'pasado' : ej.antes(sel, a) ? 'futuro' : 'concurrente');
    const confusos = (s) => ej.eventos.filter((e, a) => a !== s && !ej.antes(a, s) && !ej.antes(s, a) && e.L < ej.eventos[s].L).length;

    function nuevo() {
      ej = D.ejecucion({ n: est.n, k: est.k, semilla: est.semilla * 7 + est.n });
      // Elige de partida el evento con más concurrentes de marca menor: el caso que contradice la intuición.
      sel = 0;
      ej.eventos.forEach((_, a) => { if (confusos(a) > confusos(sel)) sel = a; });
      dibujar();
    }

    function dibujar() {
      lienzo.limpiar();
      const ev = ej.eventos, s = ev[sel];
      const COL = { sel: C.s2, pasado: C.s1, futuro: C.s3, concurrente: C.s4 };
      geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: est.n }, (_, p) => P(p)),
        t: [0.4, ej.tMax + 0.6],
        mensajes: ej.mensajes.map(({ e, r }) => {
          const ra = relacion(e), rb = relacion(r);
          const enPasado = (ra === 'pasado') && (rb === 'pasado' || rb === 'sel');
          const enFuturo = (ra === 'sel' || ra === 'futuro') && rb === 'futuro';
          return {
            p0: ev[e].p, t0: ev[e].t, p1: ev[r].p, t1: ev[r].t,
            color: enPasado ? C.s1 : enFuturo ? C.s3 : C.eje, ancho: enPasado || enFuturo ? 2.2 : 1.5,
          };
        }),
        eventos: ev.map((e, a) => ({
          p: e.p, t: e.t, relleno: COL[relacion(a)], anillo: a === sel ? C.s2 : null,
          texto: String(e.L), colorTexto: a === sel ? C.s2 : C.tinta, sub: e.nombre,
        })),
      });
      const cuenta = { pasado: 0, futuro: 0, concurrente: 0 };
      const menores = [];
      ev.forEach((e, a) => {
        const r = relacion(a);
        if (r !== 'sel') cuenta[r]++;
        if (r === 'concurrente' && e.L < s.L) menores.push(e);
      });
      const lista = (l) => l.slice(0, 4).map((e) => `${e.nombre} (L=${e.L})`).join(', ') + (l.length > 4 ? '…' : '');
      registro.textContent = menores.length
        ? `${s.nombre} tiene L = ${s.L}. ${lista(menores)} ${menores.length > 1 ? 'tienen' : 'tiene'} marca menor y sin embargo ${menores.length > 1 ? 'son concurrentes' : 'es concurrente'} con ${s.nombre}: L(a) < L(b) no implica a → b.`
        : `${s.nombre} tiene L = ${s.L}. Todo su pasado causal tiene marca menor y todo su futuro, marca mayor; ningún evento concurrente tiene marca menor.`;
      lectura.set([
        ['evento', `${s.nombre} en ${P(s.p)}, L = ${s.L}`],
        ['pasado', String(cuenta.pasado)],
        ['futuro', String(cuenta.futuro)],
        ['concurrentes', String(cuenta.concurrente)],
        ['concurrentes con L menor', String(menores.length)],
      ]);
    }
    lienzo.alDibujar = () => ej && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const a = D.cercano(geo.eventos, x, y, 14);
      if (a >= 0) { sel = a; dibujar(); }
    });
    nuevo();
  }

  VIZ.registrarTema('lamport-clocks', {
    intro: String.raw`
      <p>En un sistema distribuido no hay un reloj común: cada proceso tiene el suyo y los relojes físicos se desfasan. Aun así
      necesitamos saber qué eventos pudieron influir en cuáles. Lamport (1978) observó que basta con el orden <em>lógico</em>:
      un evento solo puede afectar a otro si hay una cadena de pasos locales y mensajes que los une.</p>
      <p>Un <strong>reloj de Lamport</strong> es un contador entero por proceso que avanza en cada evento y que, al recibir un mensaje,
      salta por delante de la marca que trae el mensaje. Así, si un evento causó otro, su marca es menor. Lo contrario, en cambio,
      no vale: una marca menor no prueba causalidad.</p>`,
    visualizaciones: [
      {
        titulo: 'Marcas de Lamport paso a paso',
        descripcion: 'Cada fila es un proceso y el tiempo avanza hacia la derecha. Observe cómo una recepción toma el máximo entre el reloj local y la marca del mensaje, y cómo crece el orden total (L, i) bajo el diagrama.',
        montar: montarPasos,
      },
      {
        titulo: 'Causalidad frente a marcas',
        descripcion: 'Elija un evento: se colorean su pasado y su futuro causal, y el resto es concurrente. Busque eventos concurrentes con marca menor: existen casi siempre.',
        montar: montarCausalidad,
      },
    ],
    teoria: String.raw`
      <h2>La relación «ocurre antes»</h2>
      <p>Un proceso es una secuencia de eventos: locales, envíos y recepciones. La relación <strong>ocurre antes</strong> \(\to\) es la menor
      relación transitiva tal que</p>
      <ol>
        <li>si \(a\) y \(b\) están en el mismo proceso y \(a\) va antes que \(b\), entonces \(a \to b\);</li>
        <li>si \(a\) es el envío de un mensaje y \(b\) su recepción, entonces \(a \to b\);</li>
        <li>si \(a \to b\) y \(b \to c\), entonces \(a \to c\).</li>
      </ol>
      <p>Dos eventos distintos son <strong>concurrentes</strong>, \(a \parallel b\), si ni \(a \to b\) ni \(b \to a\). La relación es un orden
      parcial estricto: nada garantiza que dos eventos sean comparables.</p>

      <h2>Algoritmo</h2>
      <pre><code>cada proceso i:  L ← 0
evento local o envío:
    L ← L + 1
    (si es envío) adjuntar L al mensaje
recepción de un mensaje con marca m:
    L ← max(L, m) + 1</code></pre>

      <h2>Condición de reloj</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Si \(a \to b\), entonces \(L(a) &lt; L(b)\).</p></div>
      <p><strong>Demostración.</strong> Basta revisar las dos reglas base, porque \(&lt;\) es transitivo. Dentro de un proceso, cada evento
      incrementa el contador, así que la marca crece estrictamente. En un mensaje, la recepción toma \(\max(L, m) + 1 &gt; m = L(\text{envío})\).
      Una cadena \(a \to \dots \to b\) es una sucesión de pasos de esos dos tipos.</p>
      <p>El recíproco es falso: \(L(a) &lt; L(b)\) es compatible con \(a \parallel b\). Lo único que se puede afirmar es la contrarrecíproca:
      si \(L(a) \ge L(b)\), entonces \(a \not\to b\). Para caracterizar exactamente la causalidad se necesita un vector por proceso:
      los <a href="tema.html?id=vector-clocks">relojes vectoriales</a>.</p>

      <h2>Orden total</h2>
      <p>Las marcas pueden repetirse en procesos distintos. Desempatando por el número de proceso,</p>
      \[ a \Rightarrow b \iff L(a) &lt; L(b) \ \lor\ \big(L(a) = L(b) \land i(a) &lt; i(b)\big), \]
      <p>se obtiene un orden total que <em>extiende</em> \(\to\): todos los procesos pueden ponerse de acuerdo en él sin comunicarse más.
      Es la base de la <a href="tema.html?id=mutual-exclusion">exclusión mutua de Lamport</a> y de la replicación de máquinas de estado:
      todas las réplicas ejecutan las órdenes en el orden \(\Rightarrow\).</p>

      <h2>Costo y límites</h2>
      <table>
        <tr><th>Aspecto</th><th>Reloj de Lamport</th><th>Reloj vectorial</th></tr>
        <tr><td>Estado por proceso</td><td>1 entero</td><td>\(n\) enteros</td></tr>
        <tr><td>Bytes extra por mensaje</td><td>\(O(1)\)</td><td>\(O(n)\)</td></tr>
        <tr><td>\(a \to b \Rightarrow\) marca menor</td><td>sí</td><td>sí</td></tr>
        <tr><td>Marca menor \(\Rightarrow a \to b\)</td><td>no</td><td>sí</td></tr>
      </table>
      <p>Charron-Bost (1991) demostró que ningún reloj con menos de \(n\) componentes puede caracterizar \(\to\) en general: la
      economía del reloj de Lamport tiene ese precio inevitable.</p>`,
  });
})();
