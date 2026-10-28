(function () {
  'use strict';
  const { el, color: C, bdd: B } = VIZ;
  const EOF = 'EOF';

  // Operadores con interfaz open / next / close escritos como generadores que emiten eventos.
  function plan(tipo, evento) {
    const { alumnos } = B.universidad();
    function* llamar(nodo, metodo) {
      yield* evento('llamada', nodo, metodo);
      const r = yield* nodo[metodo]();
      yield* evento('retorno', nodo, metodo, r);
      return r;
    }
    const scan = {
      nombre: 'Scan(Alumnos)', pos: 0, memoria: () => 1,
      * open() { scan.pos = 0; }, * close() {},
      * next() { return scan.pos < alumnos.filas.length ? alumnos.filas[scan.pos++] : EOF; },
    };
    const sel = {
      nombre: "σ carrera = 'Informática'", hijo: scan, memoria: () => 1,
      * open() { yield* llamar(scan, 'open'); }, * close() { yield* llamar(scan, 'close'); },
      * next() {
        for (;;) {
          const t = yield* llamar(scan, 'next');
          if (t === EOF || t.carrera === 'Informática') return t;
          yield* evento('descarta', sel, null, t);
        }
      },
    };
    const orden = {
      nombre: 'Sort(ingreso)', hijo: sel, buf: [], i: 0, memoria: () => orden.buf.length,
      * open() {
        yield* llamar(sel, 'open');
        orden.buf = []; orden.i = 0;
        for (;;) { const t = yield* llamar(sel, 'next'); if (t === EOF) break; orden.buf.push(t); }
        orden.buf.sort((a, b) => a.ingreso - b.ingreso);
        yield* llamar(sel, 'close');
      },
      * close() {},
      * next() { return orden.i < orden.buf.length ? orden.buf[orden.i++] : EOF; },
    };
    const abajo = tipo === 'sort' ? orden : sel;
    const proy = {
      nombre: 'π nombre, ingreso', hijo: abajo, memoria: () => 1,
      * open() { yield* llamar(abajo, 'open'); }, * close() { yield* llamar(abajo, 'close'); },
      * next() { const t = yield* llamar(abajo, 'next'); return t === EOF ? EOF : { nombre: t.nombre, ingreso: t.ingreso }; },
    };
    const nodos = tipo === 'sort' ? [proy, orden, sel, scan] : [proy, sel, scan];
    return { raiz: proy, nodos, llamar };
  }

  const txtTupla = (t) => (t === EOF ? 'EOF' : t && typeof t === 'object' ? (t.nombre || '') + (t.rol ? ` (${t.rol})` : '') : '');

  function montarIterador(cuerpo) {
    let tipo = 'pipe', p = null, pila = [], ultimo = null, salida = [], llamadas = 0, maxMem = 0, historia = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Plan', valor: tipo, opciones: [['pipe', 'segmentado: π ← σ ← Scan'], ['sort', 'con ORDER BY (operador bloqueante)']], alCambiar: (v) => { tipo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1.5 });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => (tipo === 'sort' ? 310 : 240) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'llamada en curso (pila de llamadas)' },
      { color: C.s2, texto: 'tupla que sube al padre', forma: 'linea' },
      { color: C.s8, texto: 'tupla descartada por σ' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const hist = el('div', { class: 'lista-mono caja-alta' });
    cuerpo.appendChild(hist);
    const caja = B.grupoTablas(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Avance de a un evento. En el plan segmentado nunca hay más de una tupla en vuelo; el Sort, en cambio, debe consumir toda su entrada antes de devolver la primera.');

    function iniciar() {
      pila = []; ultimo = null; salida = []; llamadas = 0; maxMem = 0; historia = [];
      function* evento(tipoEv, nodo, metodo, valor) {
        if (tipoEv === 'llamada') { pila.push(nodo); llamadas++; }
        ultimo = { tipoEv, nodo, metodo, valor };
        const prof = '  '.repeat(Math.max(0, pila.length - 1));
        if (tipoEv === 'llamada') historia.push(`${prof}${nodo.nombre}.${metodo}()`);
        else if (tipoEv === 'retorno') historia.push(`${prof}← ${metodo === 'next' ? txtTupla(valor) : 'ok'}`);
        else historia.push(`${prof}  ✗ ${txtTupla(valor)} no cumple`);
        maxMem = Math.max(maxMem, ...p.nodos.map((n) => n.memoria()));
        yield;
        if (tipoEv === 'retorno') pila.pop();
      }
      p = plan(tipo, evento);
      return (function* () {
        yield* p.llamar(p.raiz, 'open');
        for (;;) {
          const t = yield* p.llamar(p.raiz, 'next');
          if (t === EOF) break;
          salida.push(t);
        }
        yield* p.llamar(p.raiz, 'close');
        ultimo = null;
        historia.push(`fin: ${salida.length} tuplas entregadas al cliente`);
      })();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      if (!p) return;
      const bw = Math.min(230, W * 0.5), bh = 34, dy = 70, x = 20;
      p.nodos.forEach((n, i) => {
        const y = 14 + i * dy;
        const activo = pila.includes(n), actual = ultimo && ultimo.nodo === n;
        if (i < p.nodos.length - 1) {
          const sube = ultimo && ultimo.tipoEv === 'retorno' && ultimo.nodo === p.nodos[i + 1] && ultimo.metodo === 'next';
          const baja = ultimo && ultimo.tipoEv === 'llamada' && ultimo.nodo === p.nodos[i + 1];
          ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + bw / 2, y + bh); ctx.lineTo(x + bw / 2, y + dy); ctx.stroke();
          if (baja) {
            B.flecha(ctx, x + bw / 2 - 14, y + bh + 4, x + bw / 2 - 14, y + dy - 4, C.s1, 2);
            B.texto(ctx, `${ultimo.metodo}()`, x + bw / 2 - 22, y + bh + 18, { alinear: 'right', color: C.s1, px: 11, peso: 500 });
          }
          if (sube) {
            B.flecha(ctx, x + bw / 2 + 14, y + dy - 4, x + bw / 2 + 14, y + bh + 4, C.s2, 2);
            B.texto(ctx, txtTupla(ultimo.valor), x + bw / 2 + 22, y + bh + 18, { color: C.s2, px: 11, peso: 500 });
          }
        }
        const descarta = actual && ultimo.tipoEv === 'descarta';
        B.caja(ctx, x, y, bw, bh, n.nombre, {
          borde: descarta ? C.s8 : activo ? C.s1 : C.tinta2, ancho: activo || descarta ? 3 : 1.5,
          relleno: actual ? VIZ.alfa(descarta ? C.s8 : C.s1, 0.08) : C.superficie, px: W < 500 ? 11 : 12,
        });
        if (n.memoria() > 1) B.texto(ctx, `${n.memoria()} tuplas en memoria`, x + bw + 12, y + bh / 2, { color: C.s7, px: 11 });
        if (descarta) B.texto(ctx, `✗ ${txtTupla(ultimo.valor)}`, x + bw + 12, y + bh / 2, { color: C.s8, px: 11, peso: 500 });
      });
      const tope = ultimo ? (ultimo.tipoEv === 'llamada' ? `${ultimo.nodo.nombre}.${ultimo.metodo}()` : ultimo.tipoEv === 'retorno' ? `${ultimo.nodo.nombre}.${ultimo.metodo}() devuelve ${ultimo.metodo === 'next' ? txtTupla(ultimo.valor) : 'ok'}` : `σ descarta ${txtTupla(ultimo.valor)}`) : rep.terminado ? 'El plan terminó.' : 'El cliente llamará open() y luego next() hasta recibir EOF.';
      registro.textContent = tope;
      hist.replaceChildren(...historia.slice(-60).map((h, i, a) => el('div', { class: i === a.length - 1 ? 'activa' : null }, h)));
      hist.scrollTop = hist.scrollHeight;
      caja.replaceChildren(B.tabla(B.rel('Salida al cliente', ['nombre', 'ingreso'], salida), { vacio: '(todavía nada)' }));
      lectura.set([
        ['llamadas', String(llamadas)],
        ['profundidad de la pila', String(pila.length)],
        ['tuplas entregadas', String(salida.length)],
        ['máximo en memoria', `${maxMem} ${maxMem === 1 ? 'tupla' : 'tuplas'}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
    lienzo.ajustar(true);
  }

  VIZ.registrarTema('iterador', {
    intro: String.raw`
      <p>Un plan de consulta es un árbol de operadores. El <strong>modelo de iteradores</strong> (o modelo Volcano) da a todos los
      operadores la misma interfaz de tres métodos: <code>open()</code> prepara, <code>next()</code> devuelve la siguiente tupla (o EOF) y
      <code>close()</code> libera recursos. Un operador no sabe qué hay debajo: solo le pide tuplas a sus hijos.</p>
      <p>El control fluye de arriba hacia abajo y los datos de abajo hacia arriba, <strong>de a una tupla</strong>. Así una consulta puede
      empezar a entregar resultados antes de haber leído toda la tabla, y la memoria que usa no depende del tamaño de los datos, salvo
      cuando un operador es <em>bloqueante</em>.</p>`,
    visualizaciones: [
      {
        titulo: 'open, next y close en un plan',
        descripcion: 'Siga cada llamada por el árbol de operadores. Compare el plan segmentado con uno que tiene un Sort: observe cuántas tuplas debe guardar el Sort y cuándo sale la primera tupla al cliente.',
        montar: montarIterador,
      },
    ],
    teoria: String.raw`
      <h2>La interfaz</h2>
      <pre><code>Selección(hijo, θ):
    open():  hijo.open()
    next():
        repetir:
            t ← hijo.next()
            si t = EOF o θ(t):  devolver t
    close(): hijo.close()

Proyección(hijo, A):
    next():  t ← hijo.next();  devolver EOF si t = EOF, si no π_A(t)</code></pre>
      <p>Componer operadores es solo pasar uno como hijo de otro. El cliente ejecuta el plan con</p>
      <pre><code>raíz.open()
mientras (t ← raíz.next()) ≠ EOF:  enviar t
raíz.close()</code></pre>

      <h2>Segmentación y operadores bloqueantes</h2>
      <p>Si ningún operador necesita ver toda su entrada, la tupla atraviesa el plan completo sin escribirse en ninguna parte:
      <strong>segmentación</strong> (<em>pipelining</em>). La memoria es \(O(\text{profundidad del plan})\) tuplas.</p>
      <p>Un operador es <strong>bloqueante</strong> si no puede devolver su primera tupla sin haber leído toda su entrada: ordenar, agrupar
      con hash, construir la tabla de una junta hash. Si su entrada no cabe en memoria, debe escribirla en disco
      (<a href="tema.html?id=external-merge-sort">ordenamiento externo</a>).</p>
      <div class="recuadro"><code>LIMIT 10</code> sobre un plan segmentado detiene la ejecución tras 10 llamadas a <code>next()</code>:
      el costo depende de cuántas tuplas se piden, no del tamaño de la tabla. Sobre un plan con ORDER BY sin índice, primero se ordena todo.</div>

      <h2>Costo y alternativas</h2>
      <p>Cada tupla cuesta varias llamadas a funciones virtuales, una por operador. Para consultas analíticas sobre millones de filas eso
      pesa, y los motores modernos usan <strong>ejecución vectorizada</strong> (<code>next()</code> devuelve un lote de 1 000 tuplas) o
      <strong>compilación</strong> del plan a código máquina que fusiona los operadores en un solo ciclo.</p>
      <p>Los operadores concretos se ven en <a href="tema.html?id=operadores-lineales">operadores lineales</a>,
      <a href="tema.html?id=nested-loop-join">nested loop join</a> y <a href="tema.html?id=block-nested-loop-join">block nested loop join</a>.</p>`,
  });
})();
