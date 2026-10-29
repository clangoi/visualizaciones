(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  /* Simula una elección en un anillo unidireccional (índice i envía a i + 1) en pasos síncronos:
     en cada paso todos los mensajes en tránsito avanzan un enlace.
     alg = 'cr' (Chang–Roberts) o 'lista' (cada mensaje junta los ids de todos). */
  function simular(ids, iniciadores, alg) {
    const n = ids.length, sig = (i) => (i + 1) % n;
    const part = new Array(n).fill(false), conoce = new Array(n).fill(null);
    const pasos = [], cuenta = { E: 0, L: 0 };
    let lider = -1, vuelo = [];
    for (const i of iniciadores) {
      part[i] = true;
      vuelo.push(alg === 'cr' ? { de: i, a: sig(i), tipo: 'E', v: ids[i] } : { de: i, a: sig(i), tipo: 'E', lista: [ids[i]], origen: i });
    }
    const foto = (texto) => pasos.push({ mensajes: vuelo, part: part.slice(), conoce: conoce.slice(), lider, texto });
    foto(`${iniciadores.length === n ? 'Todos los nodos inician' : `${iniciadores.map((i) => ids[i]).join(', ')} ${iniciadores.length > 1 ? 'inician' : 'inicia'}`} la elección enviando ${alg === 'cr' ? 'su id' : 'una lista con su id'} al vecino.`);
    vuelo.forEach((m) => cuenta[m.tipo]++);
    for (let g = 0; g < 4 * n * n + 10 && vuelo.length; g++) {
      const sal = [], notas = [];
      for (const m of vuelo) {
        const a = m.a, yo = ids[a];
        if (alg === 'cr') {
          if (m.tipo === 'E') {
            if (m.v > yo) { part[a] = true; sal.push({ de: a, a: sig(a), tipo: 'E', v: m.v }); notas.push(`${yo} reenvía ${m.v}`); }
            else if (m.v < yo) {
              if (!part[a]) { part[a] = true; sal.push({ de: a, a: sig(a), tipo: 'E', v: yo }); notas.push(`${yo} cambia ${m.v} por su ${yo}`); }
              else notas.push(`${yo} descarta ${m.v}`);
            } else {
              lider = a; conoce[a] = yo;
              sal.push({ de: a, a: sig(a), tipo: 'L', v: yo });
              notas.push(`${yo} recibe su propio id: es el máximo y se proclama líder`);
            }
          } else if (m.v !== yo) { conoce[a] = m.v; part[a] = false; sal.push({ de: a, a: sig(a), tipo: 'L', v: m.v }); }
          else notas.push(`el anuncio vuelve a ${yo}: todos conocen al líder`);
        } else {
          if (m.tipo === 'E') {
            if (a === m.origen) {
              const max = Math.max(...m.lista);
              if (lider < 0) lider = ids.indexOf(max);
              conoce[a] = max;
              sal.push({ de: a, a: sig(a), tipo: 'L', lista: m.lista, origen: a, v: max });
              notas.push(`la lista de ${yo} dio la vuelta: el máximo es ${max}`);
            } else { part[a] = true; sal.push({ de: a, a: sig(a), tipo: 'E', lista: [...m.lista, yo], origen: m.origen }); }
          } else if (a !== m.origen) { conoce[a] = m.v; sal.push({ de: a, a: sig(a), tipo: 'L', lista: m.lista, origen: m.origen, v: m.v }); }
          else notas.push(`el anuncio de ${yo} terminó su vuelta`);
        }
      }
      vuelo = sal;
      vuelo.forEach((m) => cuenta[m.tipo]++);
      const anuncios = sal.filter((m) => m.tipo === 'L').length;
      foto(`Paso ${pasos.length}. ${notas.length ? notas.join('; ') + '.' : 'Los mensajes avanzan un enlace.'}${anuncios && !notas.length ? ' El anuncio del líder sigue su vuelta.' : ''}`);
    }
    pasos[pasos.length - 1].texto = `Fin: líder ${ids[lider]}. Se enviaron ${cuenta.E} mensajes de elección y ${cuenta.L} de anuncio.`;
    return { pasos, cuenta, lider };
  }

  // Arco de flecha sobre la circunferencia, del ángulo a0 al a1 (sentido horario).
  function arco(ctx, cx, cy, R, a0, a1, r, color, ancho) {
    const d = (r + 4) / R;
    if (a1 < a0) a1 += Math.PI * 2;
    const b0 = a0 + d, b1 = a1 - d;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho;
    ctx.beginPath(); ctx.arc(cx, cy, R, b0, b1); ctx.stroke();
    const x = cx + R * Math.cos(b1), y = cy + R * Math.sin(b1), t = b1 + Math.PI / 2, s = 6 + ancho;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - s * Math.cos(t - 0.42), y - s * Math.sin(t - 0.42));
    ctx.lineTo(x - s * Math.cos(t + 0.42), y - s * Math.sin(t + 0.42));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ---------- Fig. 1: elección paso a paso ---------- */

  function montarAnillo(cuerpo) {
    const est = { n: 8, alg: 'cr', todos: false, semilla: 2, ini: new Set([0, 3]) };
    let ids, sim, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Nodos', min: 3, max: 12, valor: est.n, alCambiar: (v) => { est.n = v; est.ini = new Set([0]); nuevo(); } });
    ctl.selector({ etiqueta: 'Algoritmo', valor: est.alg, opciones: [['cr', 'Chang–Roberts'], ['lista', 'Anillo con lista']],
      alCambiar: (v) => { est.alg = v; rep.reiniciar(); } });
    ctl.casilla({ etiqueta: 'Todos inician', valor: est.todos, alCambiar: (v) => { est.todos = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    ctl.boton('Nuevos ids', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(460, Math.max(320, w * 0.55)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'mensaje de elección', forma: 'linea' },
      { color: C.s6, texto: 'anuncio del líder / líder', forma: 'linea' },
      { color: C.s4, texto: 'participante', forma: 'punto' },
      { color: C.s1, texto: 'iniciador (anillo)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Los mensajes giran en sentido horario. Haga clic en un nodo para agregarlo o quitarlo de los iniciadores.');

    function nuevo() {
      const rnd = VIZ.semilla(est.semilla * 41 + est.n);
      const pool = Array.from({ length: 99 }, (_, i) => i + 1);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      ids = pool.slice(0, est.n);
      rep.reiniciar();
    }

    function iniciar() {
      const ini = est.todos ? ids.map((_, i) => i) : [...est.ini].filter((i) => i < est.n);
      if (!ini.length) ini.push(0);
      sim = simular(ids, ini, est.alg);
      k = 0;
      return (function* () { for (k = 1; k < sim.pasos.length; k++) yield; k = sim.pasos.length - 1; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ps = sim.pasos[Math.min(k, sim.pasos.length - 1)];
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 48, rr = 16;
      pos = D.circulo(W, H, est.n, { radio: R });
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // Mensajes en tránsito (pueden ir varios por el mismo enlace: se apilan las etiquetas).
      const porEnlace = {};
      for (const m of ps.mensajes) {
        const col = m.tipo === 'E' ? C.s2 : C.s6;
        arco(ctx, cx, cy, R, pos[m.de].a, pos[m.a].a, rr, col, 2.5);
        const j = (porEnlace[m.de] = (porEnlace[m.de] || 0) + 1) - 1;
        let am = (pos[m.de].a + pos[m.a].a) / 2;
        if (m.a === 0) am += Math.PI;
        const txt = m.lista ? (m.lista.length > 3 ? `[…${m.lista.slice(-2).join(',')}]` : `[${m.lista.join(',')}]`) : String(m.v);
        const Rr = R + 24 + j * 17;
        D.etiqueta(ctx, m.tipo === 'L' ? `líder ${m.v}` : txt, cx + Rr * Math.cos(am), cy + Rr * Math.sin(am), { color: col, borde: col, tam: 10 });
      }
      ids.forEach((id, i) => {
        const esLider = ps.lider === i && ps.conoce[i] === id;
        D.nodo(ctx, pos[i].x, pos[i].y, String(id), {
          r: rr,
          relleno: esLider ? C.s6 : ps.part[i] ? C.s4 : ps.conoce[i] != null ? C.neutro : C.superficie,
          texto: esLider ? C.sobre : C.tinta,
          anillo: (est.todos || est.ini.has(i)) ? C.s1 : null,
        });
      });
      registro.textContent = ps.texto;
      const hasta = { E: 0, L: 0 };
      sim.pasos.slice(0, k + 1).forEach((p) => p.mensajes.forEach((m) => hasta[m.tipo]++));
      lectura.set([
        ['paso', `${Math.min(k, sim.pasos.length - 1)} de ${sim.pasos.length - 1}`],
        ['mensajes de elección', String(hasta.E)],
        ['anuncios', String(hasta.L)],
        ['total', String(hasta.E + hasta.L)],
        ['máximo id', String(Math.max(...ids))],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 22);
      if (i < 0) return;
      if (est.ini.has(i) && est.ini.size > 1) est.ini.delete(i); else est.ini.add(i);
      rep.reiniciar();
    });
    nuevo();
  }

  /* ---------- Fig. 2: mensajes según n ---------- */

  function montarCosto(cuerpo) {
    let semilla = 1, datos = [], hover = null, plano = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.boton('Otras permutaciones al azar', () => { semilla++; calcular(); dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const SERIES = [
      ['lista', C.s1, 'anillo con lista: 2n²'],
      ['peor', C.s2, 'Chang–Roberts, ids decrecientes'],
      ['azar', C.s3, 'Chang–Roberts, ids al azar'],
      ['mejor', C.s4, 'Chang–Roberts, ids crecientes'],
    ];
    VIZ.leyenda(cuerpo, SERIES.map(([, c, t]) => ({ color: c, texto: t, forma: 'linea' })));
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Todos los nodos inician a la vez. «Crecientes» y «decrecientes» se refieren al sentido en que viajan los mensajes. Se cuentan también los n mensajes del anuncio final.');

    function calcular() {
      const rnd = VIZ.semilla(semilla * 977);
      datos = [];
      for (let n = 2; n <= 40; n += 2) {
        const todos = Array.from({ length: n }, (_, i) => i);
        const tot = (ids, alg) => { const c = simular(ids, todos, alg).cuenta; return c.E + c.L; };
        const crec = todos.map((i) => i + 1), dec = crec.slice().reverse();
        let suma = 0;
        for (let r = 0; r < 20; r++) {
          const p = crec.slice();
          for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
          suma += tot(p, 'cr');
        }
        datos.push({ n, lista: tot(crec, 'lista'), peor: tot(dec, 'cr'), azar: suma / 20, mejor: tot(crec, 'cr') });
      }
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 40, ymin: 0, ymax: 3300 }, { etiquetaX: 'nodos n', etiquetaY: 'mensajes' });
      plano.ejes();
      for (const [k, c] of SERIES) {
        VIZ.trazar(ctx, plano, datos.map((d) => [d.n, d[k]]), c, 2);
        if (hover) VIZ.marcador(ctx, plano.sx(hover.n), plano.sy(hover[k]), c, 4.5);
      }
      if (hover) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(plano.sx(hover.n) + 0.5, plano.y1); ctx.lineTo(plano.sx(hover.n) + 0.5, plano.y0); ctx.stroke();
      }
      const u = datos[datos.length - 1];
      const H = Array.from({ length: u.n }, (_, i) => 1 / (i + 1)).reduce((s, v) => s + v, 0);
      lectura.set([
        ['n', String(u.n)],
        ['peor: n(n+1)/2 + n', String(u.peor)],
        ['al azar (medido)', VIZ.fmt(u.azar, 4)],
        ['n·Hₙ + n (esperado)', VIZ.fmt(u.n * H + u.n, 4)],
        ['mejor: 3n − 1', String(u.mejor)],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      const n = Math.round(plano.ix(x) / 2) * 2;
      hover = datos.find((d) => d.n === n) || null;
      dibujar();
      if (hover) tip.mostrar(x, y, `n = <b>${hover.n}</b>` + SERIES.map(([k, c, t]) => VIZ.filaTooltip(c, t, VIZ.fmt(hover[k], 4))).join(''));
      else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('ring-election', {
    intro: String.raw`
      <p>Cuando los procesos forman un <strong>anillo lógico</strong> y cada uno solo conoce a su vecino, la elección de líder se hace
      haciendo girar mensajes. El objetivo es el mismo que en el <a href="tema.html?id=bully-algorithm">algoritmo del matón</a>: que todos
      terminen reconociendo como líder al proceso de identificador máximo.</p>
      <p>En el <strong>anillo con lista</strong> cada mensaje de elección da la vuelta completa anotando los identificadores por los que pasa.
      <strong>Chang–Roberts</strong> (1979) es más económico: cada nodo deja pasar solo identificadores mayores que el suyo, así que los
      mensajes de los candidatos débiles mueren pronto y solo el del máximo completa la vuelta.</p>`,
    visualizaciones: [
      {
        titulo: 'Elección en el anillo',
        descripcion: 'Avance paso a paso: en cada paso todos los mensajes cruzan un enlace. Compare los dos algoritmos con «Todos inician» marcado y observe cuántos mensajes de Chang–Roberts mueren en el primer salto.',
        montar: montarAnillo,
      },
      {
        titulo: 'Mensajes según el orden de los ids',
        descripcion: 'Con Chang–Roberts el costo depende de cómo están ordenados los identificadores: cuadrático en el peor caso y \\(O(n \\log n)\\) en promedio.',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Chang–Roberts</h2>
      <p>Anillo unidireccional, identificadores únicos y comparables, sin fallas durante la elección.</p>
      <pre><code>al iniciar:  participante ← verdadero;  enviar ELECTION(id)
al recibir ELECTION(j):
    si j &gt; id:  participante ← verdadero;  reenviar ELECTION(j)
    si j &lt; id y no participante:  participante ← verdadero;  enviar ELECTION(id)
    si j &lt; id y participante:  descartar
    si j = id:  soy el líder;  enviar ELECTED(id)
al recibir ELECTED(k) con k ≠ id:  líder ← k;  reenviar</code></pre>
      <p><strong>Corrección.</strong> Ningún nodo descarta el identificador máximo \(M\) (nadie es mayor), así que vuelve a su dueño. Todo otro
      identificador \(j\) se descarta a más tardar al llegar al nodo \(M\). Por lo tanto exactamente un nodo recibe su propio identificador.</p>

      <h2>Costo de Chang–Roberts</h2>
      <p>Si todos inician, el mensaje de \(j\) avanza hasta el primer nodo con identificador mayor. Con \(n\) nodos:</p>
      <ul>
        <li><strong>Peor caso</strong> (identificadores decrecientes en el sentido de viaje): el \(k\)-ésimo mayor recorre \(k\) enlaces, en total
        \(\sum_{k=1}^{n} k = \tfrac{n(n+1)}{2}\) mensajes de elección.</li>
        <li><strong>Mejor caso</strong> (crecientes): cada mensaje muere en un salto salvo el máximo: \(2n - 1\).</li>
        <li><strong>Promedio</strong> sobre permutaciones al azar: el mensaje del \(k\)-ésimo mayor recorre en esperanza unos \(n/k\) enlaces
        (necesita encontrar uno de los \(k-1\) mayores), y en total</li>
      </ul>
      \[ \mathbb{E}[\text{mensajes}] \approx \sum_{k=1}^{n} \frac{n}{k} = n H_n \approx n \ln n. \]
      <p>Más los \(n\) mensajes del anuncio. Hirschberg y Sinclair (1980) consiguen \(O(n \log n)\) también en el peor caso con un anillo
      bidireccional: cada candidato explora vecindarios de radio \(1, 2, 4, \dots\) y abandona si encuentra uno mayor; y
      \(\Omega(n \log n)\) es una cota inferior para algoritmos basados en comparaciones.</p>

      <h2>Anillo con lista</h2>
      <p>Cada mensaje acumula los identificadores y da la vuelta completa; al volver a su origen, este elige el máximo y lo anuncia con otra vuelta.
      Tolera nodos caídos si cada uno puede saltarse a un vecino muerto, y varios iniciadores llegan al mismo líder porque todos ven la lista completa.
      Con \(n\) iniciadores cuesta \(n \cdot n\) mensajes de elección, más largos (\(O(n)\) identificadores cada uno), y otros \(n \cdot n\) si cada iniciador anuncia el resultado: \(2n^2\).</p>
      <table>
        <tr><th>Algoritmo</th><th>Peor caso</th><th>Promedio</th><th>Tamaño de mensaje</th></tr>
        <tr><td>Anillo con lista</td><td>\(\Theta(n^2)\)</td><td>\(\Theta(n^2)\)</td><td>\(O(n)\) ids</td></tr>
        <tr><td>Chang–Roberts</td><td>\(\Theta(n^2)\)</td><td>\(\Theta(n \log n)\)</td><td>1 id</td></tr>
        <tr><td>Hirschberg–Sinclair</td><td>\(O(n \log n)\)</td><td>\(O(n \log n)\)</td><td>1 id + distancia</td></tr>
      </table>`,
  });
})();
