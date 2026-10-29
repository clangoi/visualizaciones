(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const P = (p) => `P${p + 1}`;
  const TMAX = 10;

  // Operación con intervalo en tiempo real: [p, 'W(x)1', inicio, fin].
  const h = (...l) => l.map(([p, s, t0, t1]) => { const m = s.match(/^([WR])\((\w)\)(\d+)$/); return { p, tipo: m[1], x: m[2], v: +m[3], t0, t1 }; });

  const EJEMPLOS = {
    basico: {
      nombre: 'Registro con lecturas concurrentes',
      ops: () => h([0, 'W(x)1', 0.4, 3.4], [0, 'W(x)2', 5, 7.6], [1, 'R(x)0', 0.9, 2.2], [1, 'R(x)1', 3.8, 5.6], [2, 'R(x)1', 2, 4.4], [2, 'R(x)2', 6.2, 8.6]),
    },
    secuencial: {
      nombre: 'Secuencial pero no linealizable',
      ops: () => h([0, 'W(x)1', 0.6, 2.4], [1, 'R(x)0', 3.4, 5.2], [1, 'R(x)1', 6, 7.8]),
    },
    inversion: {
      nombre: 'Lectura nueva y luego vieja',
      ops: () => h([0, 'W(x)1', 0.4, 8.4], [1, 'R(x)1', 1.2, 3], [2, 'R(x)0', 4, 5.8]),
    },
    retroceso: {
      nombre: 'Dos escrituras solapadas',
      ops: () => h([0, 'W(x)1', 0.4, 4.4], [1, 'W(x)2', 1, 5], [2, 'R(x)1', 5.6, 7.2], [0, 'R(x)1', 6.2, 8.2], [1, 'R(x)1', 7.4, 9.2]),
    },
  };

  // Dibuja la historia; marcas: { puntos, orden, estado(i) → { color, relleno, grosor } }.
  function dibujarHistoria(lienzo, ops, nProc, marcas = {}) {
    const { ctx } = lienzo;
    lienzo.limpiar();
    const geo = D.espacioTiempo(lienzo, {
      procesos: Array.from({ length: nProc }, (_, p) => P(p)), t: [0, TMAX], sup: 34, inf: 22,
      intervalos: ops.map((o, i) => {
        const e = (marcas.estado && marcas.estado(i)) || {};
        return { p: o.p, t0: o.t0, t1: o.t1, texto: e.texto || D.textoOp(o), color: e.color || C.tinta, relleno: e.relleno || (o.tipo === 'W' ? C.neutro : C.superficie), grosor: e.grosor || (o.tipo === 'R' ? 2 : 1.5), colorTexto: e.colorTexto };
      }),
    });
    if (marcas.puntos && marcas.orden) {
      const pts = marcas.orden.map((i) => ({ x: geo.x(marcas.puntos[i]), y: geo.y(ops[i].p) }));
      ctx.save();
      ctx.strokeStyle = VIZ.alfa(C.s2, 0.6); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.restore();
      pts.forEach((q, k) => {
        ctx.strokeStyle = C.s2; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(q.x, q.y - 13); ctx.lineTo(q.x, q.y + 13); ctx.stroke();
        VIZ.marcador(ctx, q.x, q.y - 13, C.s2, 4);
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.s2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), q.x, q.y - 24);
      });
    }
    // Eje de tiempo
    ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('tiempo real →', lienzo.ancho - 18, 2);
    return ops.map((o) => ({ x0: geo.x(o.t0), x1: geo.x(o.t1), y: geo.y(o.p), geo }));
  }

  /* ---------- Fig. 1: arrastrar operaciones ---------- */

  function montarArrastre(cuerpo) {
    const est = { ej: 'basico' };
    let ops, nProc = 3, cajas = [], arrastre = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Historia', valor: est.ej, opciones: Object.entries(EJEMPLOS).map(([k, e]) => [k, e.nombre]), alCambiar: (v) => { est.ej = v; cargar(); } });
    ctl.boton('Restaurar', () => cargar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => nProc * 60 + 50 });
    lienzo.canvas.style.cursor = 'grab';
    VIZ.leyenda(cuerpo, [
      { color: C.neutro, borde: C.tinta, texto: 'escritura (intervalo de invocación a respuesta)' },
      { color: C.superficie, borde: C.tinta, texto: 'lectura' },
      { color: C.s2, texto: 'punto de linealización y su orden', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre una operación a lo largo del tiempo. Un clic sin arrastrar sobre una lectura cambia el valor que devolvió.');

    function cargar() { ops = EJEMPLOS[est.ej].ops(); nProc = Math.max(...ops.map((o) => o.p)) + 1; lienzo.ajustar(true); }

    function dibujar() {
      const lin = D.linealizable(ops);
      const seq = D.secuencial(ops);
      cajas = dibujarHistoria(lienzo, ops, nProc, lin ? { puntos: lin.puntos, orden: lin.orden } : {});
      if (lin) registro.textContent = `Linealizable: cada operación tiene un instante dentro de su intervalo en que parece ocurrir de golpe, y en ese orden (${lin.orden.map((i) => D.textoOp(ops[i])).join(', ')}) el registro se comporta como uno secuencial.`;
      else {
        // Explicación: alguna lectura no puede ubicarse.
        const fijas = ops.map((o, i) => i).filter((i) => ops[i].tipo === 'R');
        let razon = '';
        for (const i of fijas) {
          const o = ops[i];
          const antes = ops.filter((w) => w.tipo === 'W' && w.x === o.x && w.t1 < o.t0);
          if (o.v === 0 && antes.length) { razon = ` ${D.textoOp(o)} de ${P(o.p)} empieza después de que terminó ${D.textoOp(antes[0])}: ya no puede ver el valor inicial.`; break; }
        }
        registro.textContent = `No es linealizable: ningún orden que respete el tiempo real deja todas las lecturas correctas.${razon}${seq ? ' Sí es secuencialmente consistente: ignorando el tiempo real, existe un orden válido.' : ''}`;
      }
      lectura.set([
        ['linealizable', lin ? 'sí' : 'no'],
        ['secuencial', seq ? 'sí' : 'no'],
        ['operaciones', String(ops.length)],
        ['pares en tiempo real', String(D.precedenciaReal(ops).reduce((s, l) => s + l.length, 0))],
      ]);
    }
    lienzo.alDibujar = () => ops && dibujar();

    const enCaja = (x, y) => cajas.findIndex((c) => x >= c.x0 - 3 && x <= c.x1 + 3 && Math.abs(y - c.y) <= 12);
    lienzo.canvas.addEventListener('pointerdown', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = enCaja(x, y);
      if (i < 0) return;
      const o = ops[i], geo = cajas[i].geo;
      const mismos = ops.filter((q, j) => j !== i && q.p === o.p);
      const lo = Math.max(0.1, ...mismos.filter((q) => q.t1 <= o.t0).map((q) => q.t1 + 0.2));
      const hi = Math.min(TMAX - 0.1, ...mismos.filter((q) => q.t0 >= o.t1).map((q) => q.t0 - 0.2));
      arrastre = { i, x0: x, t0: o.t0, largo: o.t1 - o.t0, lo, hi, movido: false, geo };
      lienzo.canvas.setPointerCapture(ev.pointerId);
      lienzo.canvas.style.cursor = 'grabbing';
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!arrastre) { lienzo.canvas.style.cursor = enCaja(x, y) >= 0 ? 'grab' : 'default'; return; }
      if (Math.abs(x - arrastre.x0) > 3) arrastre.movido = true;
      if (!arrastre.movido) return;
      const dt = arrastre.geo.t(x) - arrastre.geo.t(arrastre.x0);
      const o = ops[arrastre.i];
      o.t0 = Math.max(arrastre.lo, Math.min(arrastre.hi - arrastre.largo, arrastre.t0 + dt));
      o.t1 = o.t0 + arrastre.largo;
      dibujar();
    });
    const soltar = () => {
      if (!arrastre) return;
      const o = ops[arrastre.i];
      if (!arrastre.movido && o.tipo === 'R') {
        const vals = [0, ...ops.filter((w) => w.tipo === 'W' && w.x === o.x).map((w) => w.v)];
        o.v = vals[(vals.indexOf(o.v) + 1) % vals.length];
        dibujar();
      }
      arrastre = null;
      lienzo.canvas.style.cursor = 'grab';
    };
    lienzo.canvas.addEventListener('pointerup', soltar);
    lienzo.canvas.addEventListener('pointercancel', soltar);
    cargar();
  }

  /* ---------- Fig. 2: la búsqueda paso a paso ---------- */

  function montarBusqueda(cuerpo) {
    const est = { ej: 'retroceso' };
    let ops, nProc = 3, s = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Historia', valor: est.ej, opciones: Object.entries(EJEMPLOS).map(([k, e]) => [k, e.nombre]), alCambiar: (v) => { est.ej = v; cargar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => nProc * 60 + 50 });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'ya linealizada (número = posición)', forma: 'cuadro' },
      { color: C.s2, texto: 'candidata que se agrega', forma: 'cuadro' },
      { color: C.s8, texto: 'candidata rechazada (lectura incorrecta)', forma: 'cuadro' },
      { color: C.s4, texto: 'mínimas: ninguna pendiente terminó antes', forma: 'cuadro' },
    ]);
    const tira = VIZ.grafo.estructura(cuerpo, 'Orden parcial:');
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una operación es candidata si ninguna operación aún no elegida terminó antes de que ella empezara.');

    function cargar() { ops = EJEMPLOS[est.ej].ops(); nProc = Math.max(...ops.map((o) => o.p)) + 1; lienzo.ajustar(true); rep.reiniciar(); }

    function iniciar() {
      const pasos = [];
      const res = D.linealizable(ops, { pasos });
      s = { paso: null, k: 0, total: pasos.length, retrocesos: 0, res, fin: false };
      return (function* () {
        for (const p of pasos) {
          s.paso = p; s.k++;
          if (p.tipo === 'retrocede') s.retrocesos++;
          yield;
        }
        s.fin = true;
      })();
    }

    function minimas(orden) {
      const hecho = new Set(orden);
      return ops.map((_, i) => i).filter((i) => !hecho.has(i) && !ops.some((q, j) => !hecho.has(j) && j !== i && q.t1 < ops[i].t0));
    }

    function dibujar() {
      const orden = s.fin ? (s.res ? s.res.orden : []) : s.paso ? s.paso.orden : [];
      const pos = new Map(orden.map((i, k) => [i, k]));
      const cand = s.fin ? [] : minimas(s.paso && s.paso.tipo === 'agrega' ? orden.slice(0, -1) : orden);
      const actual = s.paso && !s.fin ? s.paso.i : -1;
      dibujarHistoria(lienzo, ops, nProc, {
        puntos: s.fin && s.res ? s.res.puntos : null, orden: s.fin && s.res ? s.res.orden : null,
        estado: (i) => {
          if (i === actual && s.paso.tipo === 'falla') return { color: C.s8, relleno: VIZ.alfa(C.s8, 0.15), grosor: 2.5 };
          if (i === actual && s.paso.tipo === 'agrega') return { color: C.s2, relleno: VIZ.alfa(C.s2, 0.2), grosor: 2.5, texto: `${D.textoOp(ops[i])} ·${pos.get(i) + 1}` };
          if (pos.has(i)) return { color: C.s1, relleno: VIZ.alfa(C.s1, 0.15), texto: `${D.textoOp(ops[i])} ·${pos.get(i) + 1}` };
          if (cand.includes(i)) return { color: C.s4, relleno: VIZ.alfa(C.s4, 0.15), grosor: 2 };
          return null;
        },
      });
      tira.set(orden.map((i, k) => ({ texto: `${k + 1}. ${D.textoOp(ops[i])} (${P(ops[i].p)})`, color: i === actual ? C.s2 : C.s1, tinta: C.tinta })), 'vacío');
      if (s.fin) registro.textContent = s.res ? `Linealizable. La búsqueda terminó tras ${s.k} pasos y ${s.retrocesos} retroceso${s.retrocesos === 1 ? '' : 's'}.` : `No es linealizable: se agotaron todas las alternativas (${s.retrocesos} retrocesos).`;
      else if (!s.paso) registro.textContent = 'Se busca un orden total que respete el tiempo real; se prueban primero las operaciones mínimas.';
      else {
        const o = ops[s.paso.i];
        const mem = {};
        s.paso.orden.forEach((i) => { if (ops[i].tipo === 'W' && i !== s.paso.i) mem[ops[i].x] = ops[i].v; });
        registro.textContent = s.paso.tipo === 'agrega' ? `Se agrega ${D.textoOp(o)} de ${P(o.p)} en la posición ${s.paso.orden.length}.`
          : s.paso.tipo === 'falla' ? `${D.textoOp(o)} de ${P(o.p)} no puede ir ahora: el registro vale ${mem[o.x] ?? 0}.`
            : `Callejón sin salida: se quita ${D.textoOp(o)} y se prueba otra candidata.`;
      }
      lectura.set([
        ['paso', `${s.k} de ${s.total}`],
        ['retrocesos', String(s.retrocesos)],
        ['linealizadas', `${orden.length} de ${ops.length}`],
        ['resultado', s.fin ? (s.res ? 'linealizable' : 'no linealizable') : '—'],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    cargar();
  }

  VIZ.registrarTema('linearizability', {
    intro: String.raw`
      <p>La <strong>linealizabilidad</strong> (Herlihy y Wing, 1990) es la garantía más fuerte y más natural para un objeto compartido:
      cada operación, aunque tarde un rato entre su invocación y su respuesta, debe parecer ocurrir <em>instantáneamente</em> en algún
      punto de ese intervalo, el <strong>punto de linealización</strong>. Visto desde afuera, el objeto replicado se comporta como si hubiera
      una sola copia.</p>
      <p>La diferencia con la <a href="tema.html?id=sequential-consistency">consistencia secuencial</a> es el tiempo real: si una operación
      termina antes de que otra empiece, la primera debe ir antes en el orden. Una lectura que empieza después de que una escritura terminó
      tiene que verla.</p>`,
    visualizaciones: [
      {
        titulo: 'Arrastre las operaciones',
        descripcion: 'Cada barra va de la invocación a la respuesta. Si existe una linealización, se dibujan sus puntos y su orden. Arrastre la lectura de «Secuencial pero no linealizable» hacia la izquierda hasta que se solape con la escritura.',
        montar: montarArrastre,
      },
      {
        titulo: 'Buscar una linealización',
        descripcion: 'El verificador de Wing y Gong elige en cada paso una operación mínima, comprueba que sea legal y retrocede si se atasca. «Dos escrituras solapadas» obliga a retroceder.',
        montar: montarBusqueda,
      },
    ],
    teoria: String.raw`
      <h2>Definición</h2>
      <p>En una historia cada operación \(o\) tiene una invocación \(\text{inv}(o)\) y una respuesta \(\text{res}(o)\). Se define el orden de
      tiempo real \(o_1 &lt;_H o_2 \iff \text{res}(o_1) &lt; \text{inv}(o_2)\): \(o_1\) terminó antes de que \(o_2\) empezara. Las operaciones con
      intervalos solapados son concurrentes.</p>
      <div class="recuadro"><p>\(H\) es <strong>linealizable</strong> si existe una secuencia legal \(S\) de todas sus operaciones tal que
      \(o_1 &lt;_H o_2 \Rightarrow o_1\) precede a \(o_2\) en \(S\). Equivalentemente: se puede elegir un instante \(t_o \in [\text{inv}(o), \text{res}(o)]\)
      para cada operación de modo que, ordenadas por \(t_o\), sean legales.</p></div>
      <p>Como el orden de programa de cada proceso está contenido en \(&lt;_H\), linealizable \(\Rightarrow\) secuencialmente consistente.</p>

      <h2>Localidad</h2>
      <div class="recuadro"><p><strong>Teorema</strong> (Herlihy y Wing). Una historia es linealizable si y solo si su restricción a cada objeto
      es linealizable.</p></div>
      <p>Esto permite verificar y construir sistemas objeto por objeto, algo que la consistencia secuencial no admite. Por eso la linealizabilidad
      es la noción de corrección estándar para estructuras de datos concurrentes.</p>

      <h2>Verificación</h2>
      <pre><code>WG(historia, estado):
    si no quedan operaciones: devolver verdadero
    para cada operación o mínima (ninguna pendiente terminó antes de inv(o)):
        si aplicar o al estado es legal:
            si WG(historia − o, estado tras o): devolver verdadero
    devolver falso</code></pre>
      <p>Decidir linealizabilidad es NP-completo en general (Gibbons y Korach), pero con memoización de (conjunto elegido, estado), como hace la
      figura y herramientas como Knossos o Porcupine, se verifican historias de miles de operaciones en la práctica.</p>

      <h2>Costo</h2>
      <p>Implementar un registro linealizable replicado exige comunicación en cada operación. El algoritmo ABD usa quórums de mayoría: una
      lectura consulta a una mayoría, toma el valor de mayor marca y lo <em>reescribe</em> en una mayoría antes de responder; sin esa
      reescritura aparece la inversión «lectura nueva y luego vieja». Ningún sistema linealizable puede seguir respondiendo en ambos lados de una
      partición (teorema CAP), y cada operación tarda al menos del orden del retardo de la red (Attiya y Welch, 1994). Los modelos
      <a href="tema.html?id=causal-consistency">causal</a> y <a href="tema.html?id=client-centric-consistency">centrados en el cliente</a>
      relajan esa exigencia.</p>`,
  });
})();
