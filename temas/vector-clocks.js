(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;

  function controlesEjecucion(ctl, est, alCambiar) {
    ctl.rango({ etiqueta: 'Procesos', min: 2, max: 4, valor: est.n, alCambiar: (v) => { est.n = v; alCambiar(); } });
    ctl.rango({ etiqueta: 'Eventos', min: 6, max: 18, valor: est.k, alCambiar: (v) => { est.k = v; alCambiar(); } });
  }
  const altoDiagrama = (n) => (w) => Math.max(180, n() * (w < 600 ? 62 : 72) + 48);

  /* ---------- Fig. 1: vectores paso a paso ---------- */

  function montarPasos(cuerpo) {
    const est = { n: 3, k: 12, semilla: 3 };
    let ej, i = -1, mensaje = '', geo = null;
    const ctl = VIZ.controles(cuerpo);
    controlesEjecucion(ctl, est, () => nuevo());
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Nuevos datos', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoDiagrama(() => est.n) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'evento aún sin vector', forma: 'punto' },
      { color: C.tinta, texto: 'evento con su vector encima', forma: 'punto' },
      { color: C.s2, texto: 'evento actual y el mensaje que recibe', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La componente j del vector de un evento cuenta cuántos eventos de Pj conoce. Pase el cursor por un evento para ver el detalle.');

    function nuevo() { ej = D.ejecucion({ n: est.n, k: est.k, semilla: est.semilla * 17 + est.n }); rep.reiniciar(); }

    function iniciar() {
      i = -1;
      mensaje = `Cada proceso empieza con el vector ${D.vec(new Array(est.n).fill(0))}.`;
      return (function* () {
        for (i = 0; i < ej.eventos.length; i++) {
          const e = ej.eventos[i], k = e.p + 1;
          if (e.tipo === 'recepcion') {
            const s = ej.eventos[e.par];
            const fusion = e.Vprev.map((v, j) => Math.max(v, s.V[j]));
            mensaje = `${e.nombre} en ${P(e.p)} recibe de ${s.nombre} el vector ${D.vec(s.V)}: máximo con ${D.vec(e.Vprev)} = ${D.vec(fusion)}; luego V[${k}] + 1 → ${D.vec(e.V)}.`;
          } else {
            mensaje = `${e.nombre} en ${P(e.p)} (${e.tipo === 'envio' ? `envío a ${P(e.a)}; el mensaje lleva el vector` : 'local'}): V[${k}] + 1 → ${D.vec(e.V)}.`;
          }
          yield;
        }
        i = ej.eventos.length;
        mensaje = 'Listo. a → b exactamente cuando V(a) ≤ V(b) componente a componente y V(a) ≠ V(b).';
      })();
    }

    function dibujar() {
      lienzo.limpiar();
      const ev = ej.eventos, actual = i >= 0 && i < ev.length ? ev[i] : null;
      geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: est.n }, (_, p) => P(p)),
        t: [0.3, ej.tMax + 0.7],
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
          p: e.p, t: e.t, relleno: k === i ? C.s2 : k < i ? C.tinta : C.inactivo,
          texto: k <= i ? D.vec(e.V) : null, tam: 10, fijo: k === i, colorTexto: k === i ? C.s2 : C.tinta, sub: e.nombre,
        })),
      });
      registro.textContent = mensaje;
      const hechos = ev.slice(0, Math.max(0, Math.min(i + 1, ev.length)));
      const vectores = Array.from({ length: est.n }, (_, p) => {
        const ult = hechos.filter((e) => e.p === p).pop();
        return ult ? ult.V : new Array(est.n).fill(0);
      });
      lectura.set([
        ['eventos', `${hechos.length} de ${ev.length}`],
        ...vectores.map((V, p) => [`vector de ${P(p)}`, D.vec(V)]),
      ]);
    }
    lienzo.alDibujar = () => ej && dibujar();
    lienzo.canvas.addEventListener('pointermove', (evt) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(evt);
      const k = D.cercano(geo.eventos, x, y, 12);
      if (k < 0 || k > i) return tip.ocultar();
      const e = ej.eventos[k];
      tip.mostrar(x, y, `evento <b>${e.nombre}</b> en ${P(e.p)}<br>V = <b>${D.vec(e.V)}</b><br>conoce ${e.V.reduce((s, v) => s + v, 0) - 1} eventos previos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    nuevo();
  }

  /* ---------- Fig. 2: comparar dos eventos ---------- */

  function montarComparar(cuerpo) {
    const est = { n: 3, k: 14, semilla: 5 };
    let ej, A = 0, B = 1, turno = 0, geo = null;
    const ctl = VIZ.controles(cuerpo);
    controlesEjecucion(ctl, est, () => nuevo());
    ctl.boton('Nuevos datos', () => { est.semilla++; nuevo(); }, { primario: true });
    ctl.boton('Intercambiar a y b', () => { [A, B] = [B, A]; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: altoDiagrama(() => est.n) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'evento a', forma: 'punto' },
      { color: C.s2, texto: 'evento b', forma: 'punto' },
      { color: C.s3, texto: 'mensajes de una cadena causal entre ellos', forma: 'linea' },
    ]);
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en dos eventos: el primer clic elige a y el segundo b, y así sucesivamente.');

    function nuevo() {
      ej = D.ejecucion({ n: est.n, k: est.k, semilla: est.semilla * 23 + est.n });
      // De partida, un par concurrente en procesos distintos.
      A = 0; B = 1;
      outer: for (let a = 0; a < ej.eventos.length; a++) for (let b = ej.eventos.length - 1; b > a; b--) {
        if (ej.eventos[a].p !== ej.eventos[b].p && !ej.antes(a, b) && !ej.antes(b, a) && ej.eventos[a].L < ej.eventos[b].L) { A = a; B = b; break outer; }
      }
      turno = 0;
      dibujar();
    }

    function dibujar() {
      lienzo.limpiar();
      const ev = ej.eventos, a = ev[A], b = ev[B];
      const [x, y] = ej.antes(A, B) ? [A, B] : ej.antes(B, A) ? [B, A] : [-1, -1];
      // Mensajes en alguna cadena x → … → y.
      const enCadena = (e, r) => x >= 0 && (e === x || ej.antes(x, e)) && (r === y || ej.antes(r, y));
      geo = D.espacioTiempo(lienzo, {
        procesos: Array.from({ length: est.n }, (_, p) => P(p)),
        t: [0.3, ej.tMax + 0.7],
        mensajes: ej.mensajes.map(({ e, r }) => ({
          p0: ev[e].p, t0: ev[e].t, p1: ev[r].p, t1: ev[r].t,
          color: enCadena(e, r) ? C.s3 : C.eje, ancho: enCadena(e, r) ? 2.4 : 1.5,
        })),
        eventos: ev.map((e, k) => ({
          p: e.p, t: e.t, relleno: k === A ? C.s1 : k === B ? C.s2 : C.inactivo,
          anillo: k === A ? C.s1 : k === B ? C.s2 : null,
          texto: k === A || k === B ? D.vec(e.V) : null, tam: 10, fijo: true,
          colorTexto: k === A ? C.s1 : C.s2, sub: k === A ? 'a' : k === B ? 'b' : null,
        })),
      });
      // Tabla componente a componente.
      const filas = a.V.map((va, j) => {
        const vb = b.V[j];
        const s = va < vb ? '<' : va > vb ? '>' : '=';
        return el('tr', null, el('td', { class: 'izq' }, `V[${j + 1}]  (${P(j)})`), el('td', null, String(va)),
          el('td', { style: { color: s === '<' ? C.s1 : s === '>' ? C.s2 : C.apagado } }, s), el('td', null, String(vb)));
      });
      caja.replaceChildren(el('table', { class: 'tabla-datos' },
        el('tr', null, el('th', { class: 'izq' }, 'componente'), el('th', null, 'V(a)'), el('th', null, ''), el('th', null, 'V(b)')),
        filas));
      const ab = D.precede(a.V, b.V), ba = D.precede(b.V, a.V);
      let rel, texto;
      if (A === B) { rel = 'mismo evento'; texto = 'Elija dos eventos distintos.'; }
      else if (ab) { rel = 'a → b'; texto = `Todas las componentes de V(a) son ≤ que las de V(b) y alguna es menor: a ocurre antes que b.`; }
      else if (ba) { rel = 'b → a'; texto = `Todas las componentes de V(b) son ≤ que las de V(a) y alguna es menor: b ocurre antes que a.`; }
      else {
        rel = 'a ∥ b';
        texto = 'Hay una componente donde gana a y otra donde gana b: ningún evento conoce al otro, son concurrentes.' +
          (a.L !== b.L ? ` Lamport les da L = ${a.L} y ${b.L}, y eso no revela la concurrencia.` : '');
      }
      registro.textContent = texto;
      lectura.set([
        ['relación', rel],
        ['V(a)', `${D.vec(a.V)} en ${P(a.p)}`],
        ['V(b)', `${D.vec(b.V)} en ${P(b.p)}`],
        ['Lamport', `L(a)=${a.L}, L(b)=${b.L}`],
      ]);
    }
    lienzo.alDibujar = () => ej && dibujar();
    lienzo.canvas.addEventListener('click', (evt) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(evt);
      const k = D.cercano(geo.eventos, x, y, 14);
      if (k < 0) return;
      if (turno === 0) A = k; else B = k;
      turno = 1 - turno;
      dibujar();
    });
    nuevo();
  }

  VIZ.registrarTema('vector-clocks', {
    intro: String.raw`
      <p>Un <a href="tema.html?id=lamport-clocks">reloj de Lamport</a> garantiza que las causas tienen marca menor, pero no permite
      distinguir una causa de un evento concurrente. Un <strong>reloj vectorial</strong> resuelve esto guardando, en cada proceso, un
      contador por <em>cada</em> proceso del sistema: la componente \(j\) dice cuántos eventos de \(P_j\) conoce, directa o
      indirectamente, quien tiene el vector.</p>
      <p>Al recibir un mensaje, el proceso toma el máximo componente a componente entre su vector y el que trae el mensaje: aprende todo
      lo que el emisor sabía. Comparar dos vectores dice exactamente si un evento ocurrió antes que otro o si son concurrentes.</p>`,
    visualizaciones: [
      {
        titulo: 'Relojes vectoriales paso a paso',
        descripcion: 'Observe la recepción: primero el máximo componente a componente y después el incremento de la componente propia. Las componentes ajenas solo cambian al recibir.',
        montar: montarPasos,
      },
      {
        titulo: 'Comparar dos eventos',
        descripcion: 'Elija dos eventos y compare sus vectores fila por fila. Si una cadena causal los une, se dibuja en aguamarina; si no, hay componentes que se contradicen.',
        montar: montarComparar,
      },
    ],
    teoria: String.raw`
      <h2>Algoritmo</h2>
      <p>Con \(n\) procesos, cada \(P_i\) mantiene un vector \(V_i \in \mathbb{N}^n\), inicialmente \(\mathbf{0}\).</p>
      <pre><code>evento local o envío en Pi:
    Vi[i] ← Vi[i] + 1
    (si es envío) adjuntar Vi al mensaje
recepción en Pi de un mensaje con vector W:
    para j ← 1 hasta n:  Vi[j] ← max(Vi[j], W[j])
    Vi[i] ← Vi[i] + 1</code></pre>
      <p>Se escribe \(V(e)\) para el vector de \(P_i\) justo después del evento \(e\).</p>

      <h2>Orden entre vectores</h2>
      \[ V \le W \iff \forall j:\ V[j] \le W[j], \qquad V &lt; W \iff V \le W \ \land\ V \ne W. \]
      <p>Es un orden parcial: \([2,0,1]\) y \([1,1,1]\) no son comparables.</p>

      <h2>Caracterización de la causalidad</h2>
      <div class="recuadro"><p><strong>Teorema.</strong> Para eventos \(a \ne b\): \(\quad a \to b \iff V(a) &lt; V(b)\), y por lo tanto
      \(a \parallel b \iff V(a) \not\le V(b) \land V(b) \not\le V(a)\).</p></div>
      <p><strong>(⇒)</strong> Igual que para Lamport: dentro de un proceso los vectores no decrecen y la componente propia crece; en un mensaje,
      el máximo garantiza \(V(\text{envío}) \le V(\text{recepción})\) y el incremento rompe la igualdad. Por transitividad vale para cadenas.</p>
      <p><strong>(⇐)</strong> Sea \(a\) el \(k\)-ésimo evento de \(P_i\), es decir \(V(a)[i] = k\). Por inducción sobre el algoritmo,
      \(V(b)[i]\) es el número de eventos de \(P_i\) que están en el pasado causal de \(b\) (o son \(b\)). Si \(V(a) \le V(b)\), entonces
      \(V(b)[i] \ge k\): el \(k\)-ésimo evento de \(P_i\), que es \(a\), está en el pasado causal de \(b\).</p>
      <p>De la demostración sale una prueba más barata: si \(a\) ocurre en \(P_i\),
      \[ a \to b \iff V(a)[i] \le V(b)[i] \quad (a \ne b). \]</p>

      <h2>Costo y usos</h2>
      <p>Cada mensaje lleva \(n\) enteros, y eso es inevitable si se quiere caracterizar \(\to\) (Charron-Bost, 1991). Se usan en:</p>
      <ul>
        <li><strong>Entrega causal</strong> de mensajes: retener un mensaje hasta haber entregado todo lo que su emisor conocía
        (ver <a href="tema.html?id=causal-consistency">consistencia causal</a>).</li>
        <li><strong>Detección de conflictos</strong> en almacenes replicados (Dynamo, Riak): dos versiones con vectores incomparables son
        escrituras concurrentes que hay que reconciliar.</li>
        <li><strong>Depuración</strong>: detectar carreras entre eventos concurrentes y construir
        <a href="tema.html?id=chandy-lamport">cortes consistentes</a>.</li>
      </ul>
      <p>Los <em>version vectors</em> son la misma idea indexada por réplica en lugar de por proceso, y las
      <em>matrix clocks</em> guardan además lo que cada proceso sabe que saben los demás.</p>`,
  });
})();
