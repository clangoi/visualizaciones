(function () {
  'use strict';
  const { color: C, el } = VIZ;

  const ESC = {
    seguro: { nombre: 'Estado seguro (ejemplo clásico)', disp: [3, 3, 2], max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]], asig: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]] },
    inseguro: { nombre: 'Estado inseguro', disp: [1, 0, 1], max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]], asig: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [3, 3, 2]] },
  };

  function montarBanquero(cuerpo) {
    let esc = 'seguro', trab, fin, orden, msg, fase;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Estado', opciones: Object.entries(ESC).map(([v, e]) => [v, e.nombre]), valor: esc, alCambiar: (v) => { esc = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0.5 });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla; el estado de cada proceso se indica con texto';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Algoritmo de seguridad: busque un proceso cuya necesidad máxima pendiente quepa en lo disponible (Trabajo); suponga que termina y devuelve sus recursos. Si todos terminan, el estado es seguro.');
    const E = () => ESC[esc], nec = (i) => E().max[i].map((m, j) => m - E().asig[i][j]);
    function iniciar() {
      trab = E().disp.slice(); fin = E().asig.map(() => false); orden = []; msg = `Trabajo = Disponible = (${trab.join(', ')}).`; fase = 0;
      return (function* () {
        yield;
        for (;;) {
          const i = fin.findIndex((f, k) => !f && nec(k).every((x, j) => x <= trab[j]));
          if (i < 0) { fase = fin.every(Boolean) ? 1 : 2; msg = fase === 1 ? `Todos terminaron: estado SEGURO. Secuencia segura: ${orden.map((x) => 'P' + x).join(' → ')}.` : `Ningún proceso pendiente cabe en (${trab.join(', ')}): estado INSEGURO (puede haber interbloqueo).`; yield; return; }
          trab = trab.map((v, j) => v + E().asig[i][j]); fin[i] = true; orden.push(i);
          msg = `P${i} cabe (necesidad (${nec(i).join(', ')}) ≤ trabajo): termina y devuelve su asignación. Trabajo = (${trab.join(', ')}).`; yield;
        }
      })();
    }
    function dibujar() {
      if (!trab) return;
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        el('tr', null, ['proceso', 'asignado (A B C)', 'máximo', 'necesidad', 'estado'].map((h, i) => el('th', { class: i === 0 || i === 4 ? 'izq' : '' }, h))),
        E().asig.map((a, i) => el('tr', null, el('td', { class: 'izq' }, 'P' + i), el('td', null, a.join(' ')), el('td', null, E().max[i].join(' ')), el('td', null, nec(i).join(' ')),
          el('td', { class: 'izq', style: { color: fin[i] ? C.s6 : C.tinta2, fontWeight: 600 } }, fin[i] ? `terminado (#${orden.indexOf(i) + 1})` : 'pendiente')))));
      registro.textContent = msg;
      lectura.set([['trabajo (A B C)', trab.join(' ')], ['terminados', `${fin.filter(Boolean).length} de ${fin.length}`], ['veredicto', fase === 1 ? 'seguro' : fase === 2 ? 'inseguro' : 'en cálculo']]);
    }
    rep.reiniciar();
  }

  function montarCiclo(cuerpo) {
    let n = 4, orden = false, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Procesos y recursos', min: 2, max: 8, valor: n, alCambiar: (v) => { n = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Pedir los recursos en orden global (menor número primero)', valor: orden, alCambiar: (v) => { orden = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.7, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'proceso que avanza', forma: 'punto' }, { color: C.s8, texto: 'proceso bloqueado en el ciclo', forma: 'punto' }, { color: C.tinta, texto: 'recurso retenido (arista)', forma: 'linea' }, { color: C.s4, texto: 'recurso solicitado (arista)', forma: 'linea' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada proceso i toma su recurso Ri y luego pide R(i+1). Con el orden global, el último proceso debe pedir primero R0 y el ciclo ya no puede cerrarse.');
    let nodos = [];
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34;
      // Con orden, el último proceso pide R0 antes de R(n−1): retiene R0? No: aún no tiene nada porque R0 lo tiene P0.
      const tiene = (i) => (orden && i === n - 1 ? [] : [i]);
      const pide = (i) => (orden && i === n - 1 ? 0 : (i + 1) % n);
      const dueno = Array(n).fill(-1); for (let i = 0; i < n; i++) tiene(i).forEach((r) => { dueno[r] = i; });
      // bloqueado = pide un recurso con dueño distinto, sigue la cadena hasta ciclo
      const bloq = Array(n).fill(false);
      for (let i = 0; i < n; i++) { let j = i, pasos = 0; while (pasos++ <= n) { const d = dueno[pide(j)]; if (d < 0) break; if (d === i) { bloq[i] = true; break; } j = d; } }
      const pp = (i) => [cx + R * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), cy + R * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)];
      const rr = (i) => [cx + R * 0.55 * Math.cos((2 * Math.PI * (i + 0.5)) / n - Math.PI / 2), cy + R * 0.55 * Math.sin((2 * Math.PI * (i + 0.5)) / n - Math.PI / 2)];
      const flecha = (a, b, col, disc) => {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.setLineDash(disc ? [5, 4] : []);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), ra = 13;
        ctx.beginPath(); ctx.moveTo(a[0] + ra * Math.cos(ang), a[1] + ra * Math.sin(ang)); ctx.lineTo(b[0] - ra * Math.cos(ang), b[1] - ra * Math.sin(ang)); ctx.stroke(); ctx.setLineDash([]);
        const ex = b[0] - ra * Math.cos(ang), ey = b[1] - ra * Math.sin(ang);
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 9 * Math.cos(ang - 0.4), ey - 9 * Math.sin(ang - 0.4)); ctx.lineTo(ex - 9 * Math.cos(ang + 0.4), ey - 9 * Math.sin(ang + 0.4)); ctx.fill();
      };
      for (let i = 0; i < n; i++) { tiene(i).forEach((r) => flecha(rr(r), pp(i), C.tinta, false)); flecha(pp(i), rr(pide(i)), C.s4, true); }
      nodos = [];
      for (let i = 0; i < n; i++) {
        const [x, y] = pp(i), [rx, ry] = rr(i);
        ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fillStyle = bloq[i] ? C.s8 : C.s6; ctx.fill();
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P' + i, x, y + 0.5);
        ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.fillRect(rx - 12, ry - 10, 24, 20); ctx.strokeRect(rx - 12, ry - 10, 24, 20);
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.fillText('R' + i, rx, ry + 0.5);
        nodos.push({ x, y, i });
      }
      const k = bloq.filter(Boolean).length;
      lectura.set([['procesos en el ciclo', String(k)], ['interbloqueo', k ? 'sí' : 'no'], ['recursos libres', String(dueno.filter((d) => d < 0).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), q = nodos.find((o) => Math.hypot(o.x - x, o.y - y) < 16);
      if (q) tip.mostrar(x, y, `<b>P${q.i}</b><br>retiene ${orden && q.i === n - 1 ? 'nada' : 'R' + q.i}<br>pide R${orden && q.i === n - 1 ? 0 : (q.i + 1) % n}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('deadlock-banker', {
    intro: String.raw`
      <p>Un <strong>interbloqueo</strong> (<em>deadlock</em>) ocurre cuando varios procesos esperan recursos que otros del grupo retienen, de modo que ninguno puede avanzar. Cada uno tiene lo que el siguiente necesita: un círculo de esperas.</p>
      <p>Se puede <em>prevenir</em> negando una de sus condiciones (por ejemplo, ordenando los recursos), <em>evitar</em> negando solicitudes que llevarían a un estado inseguro (algoritmo del banquero), o <em>detectar</em> y recuperarse después.</p>`,
    visualizaciones: [
      { titulo: 'Algoritmo del banquero: ¿es seguro el estado?', descripcion: 'Recorra el algoritmo de seguridad en un estado seguro y en uno inseguro. Observe qué ocurre cuando ningún proceso pendiente cabe en lo disponible.', montar: montarBanquero },
      { titulo: 'Espera circular y orden de recursos', descripcion: 'Con cada proceso reteniendo un recurso y pidiendo el siguiente se forma un ciclo. Active el orden global de adquisición y vea desaparecer el interbloqueo.', montar: montarCiclo },
    ],
    teoria: String.raw`
      <h2>Condiciones de Coffman</h2>
      <p>Hay interbloqueo solo si se cumplen las cuatro a la vez:</p>
      <ol><li><strong>Exclusión mutua</strong>: el recurso no se comparte.</li><li><strong>Retención y espera</strong>: se retiene uno mientras se pide otro.</li><li><strong>Sin expropiación</strong>: no se le puede quitar el recurso al que lo tiene.</li><li><strong>Espera circular</strong>: existe un ciclo \(P_0 \to P_1 \to \dots \to P_0\).</li></ol>
      <p>Prevenir es negar una: pedir todo de una vez (rompe 2), expropiar (rompe 3), o numerar los recursos y exigir pedirlos en orden creciente (rompe 4, y es lo que se hace con los <a href="tema.html?id=locks-atomics">locks</a>; también resuelve los <a href="tema.html?id=dining-philosophers">filósofos comensales</a>).</p>
      <h2>Algoritmo del banquero</h2>
      <p>Con \(n\) procesos y \(m\) tipos de recurso: <em>Disponible</em> (vector de \(m\)), <em>Máximo</em> y <em>Asignado</em> (matrices \(n\times m\)); <em>Necesidad</em> \(= \text{Máximo} - \text{Asignado}\).</p>
      <pre><code>Trabajo ← Disponible;  Terminó[i] ← falso para todo i
repetir:
    buscar i con Terminó[i] = falso  y  Necesidad[i] ≤ Trabajo
    si no existe:  parar
    Trabajo ← Trabajo + Asignado[i];  Terminó[i] ← verdadero
estado seguro  ⇔  Terminó[i] = verdadero para todo i</code></pre>
      <p>Una solicitud se concede solo si, suponiendo concedida, el estado resultante sigue siendo seguro. Cuesta \(O(m n^2)\) por solicitud.</p>
      <div class="recuadro">Seguro ⇒ sin interbloqueo; inseguro <em>no</em> implica interbloqueo, solo que ya no se puede garantizar que no ocurra.</div>
      <h2>Detección y recuperación</h2>
      <p>Con un solo ejemplar de cada recurso basta buscar ciclos en el grafo de espera (cuesta \(O(n^2)\)). Para recuperarse se termina a algún proceso o se le expropia un recurso. En <a href="tema.html?id=deadlock-detection">sistemas distribuidos</a> se hace con mensajes.</p>`,
  });
})();
