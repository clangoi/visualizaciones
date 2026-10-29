(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const P = (i) => `P${i + 1}`;
  const MSJ = {
    REQ: { color: C.s1, texto: 'pedido' },
    OK: { color: C.s6, texto: 'permiso' },
    REL: { color: C.s3, texto: 'liberación' },
    TOKEN: { color: C.s7, texto: 'token' },
  };
  const DURACION = 2; // pasos dentro de la sección crítica

  /* Simulación síncrona: lo enviado en un paso se entrega en el siguiente.
     alg: 'central' (coordinador = índice n), 'ra' (Ricart–Agrawala) o 'token' (anillo). pide[i]: paso en que i pide entrar, o null. */
  function simular(n, alg, pide) {
    const estado = new Array(n).fill('libre'), resta = new Array(n).fill(0);
    const reloj = new Array(n).fill(0), marca = new Array(n).fill(null), oks = new Array(n).fill(0);
    const diferidos = Array.from({ length: n }, () => []);
    const coord = { ocupado: -1, cola: [] };
    let token = 0, vuelo = [], mensajes = 0, entradas = 0;
    const pasos = [];
    const pendientes = pide.filter((t) => t != null).length;
    const enviar = (de, a, tipo, extra = '') => { vuelo.push({ de, a, tipo, extra }); mensajes++; };
    const entrar = (i, notas) => { estado[i] = 'sc'; resta[i] = DURACION; entradas++; notas.push(`${P(i)} entra a la sección crítica`); };
    for (let t = 1; t < 300; t++) {
      const llegan = vuelo; vuelo = [];
      const notas = [];
      // 1. Entregar mensajes.
      for (const m of llegan) {
        if (alg === 'central') {
          if (m.tipo === 'REQ') {
            if (coord.ocupado < 0) { coord.ocupado = m.de; enviar(n, m.de, 'OK'); }
            else { coord.cola.push(m.de); notas.push(`el coordinador encola a ${P(m.de)}`); }
          } else if (m.tipo === 'OK') entrar(m.a, notas);
          else if (m.tipo === 'REL') {
            coord.ocupado = coord.cola.length ? coord.cola.shift() : -1;
            if (coord.ocupado >= 0) enviar(n, coord.ocupado, 'OK');
          }
        } else if (alg === 'ra') {
          const i = m.a;
          if (m.tipo === 'REQ') {
            reloj[i] = Math.max(reloj[i], m.ts) + 1;
            const yoPrimero = estado[i] === 'sc' || (estado[i] === 'espera' && (marca[i] < m.ts || (marca[i] === m.ts && i < m.de)));
            if (yoPrimero) { diferidos[i].push(m.de); notas.push(`${P(i)} difiere su respuesta a ${P(m.de)}`); }
            else { const ok = { de: i, a: m.de, tipo: 'OK' }; vuelo.push(ok); mensajes++; }
          } else if (m.tipo === 'OK') {
            oks[i]++;
            if (oks[i] === n - 1) entrar(i, notas);
          }
        } else if (m.tipo === 'TOKEN') token = m.a;
      }
      // 2. Salidas de la sección crítica.
      for (let i = 0; i < n; i++) {
        if (estado[i] !== 'sc') continue;
        if (--resta[i] > 0) continue;
        estado[i] = 'hecho';
        notas.push(`${P(i)} sale de la sección crítica`);
        if (alg === 'central') enviar(i, n, 'REL');
        else if (alg === 'ra') { for (const j of diferidos[i]) { vuelo.push({ de: i, a: j, tipo: 'OK' }); mensajes++; } diferidos[i] = []; }
      }
      // 3. Nuevos pedidos.
      for (let i = 0; i < n; i++) {
        if (pide[i] !== t) continue;
        estado[i] = 'espera';
        notas.push(`${P(i)} quiere entrar`);
        if (alg === 'central') enviar(i, n, 'REQ');
        else if (alg === 'ra') { reloj[i]++; marca[i] = reloj[i]; oks[i] = 0; for (let j = 0; j < n; j++) if (j !== i) { vuelo.push({ de: i, a: j, tipo: 'REQ', ts: marca[i], extra: `(${marca[i]},${i + 1})` }); mensajes++; } if (n === 1) entrar(i, notas); }
      }
      // 4. El token.
      if (alg === 'token' && !vuelo.some((m) => m.tipo === 'TOKEN')) {
        if (estado[token] === 'espera') entrar(token, notas);
        else if (estado[token] !== 'sc') enviar(token, (token + 1) % n, 'TOKEN');
      }
      const enSC = estado.filter((e) => e === 'sc').length;
      pasos.push({ t, mensajesPaso: vuelo.slice(), estado: estado.slice(), reloj: reloj.slice(), marca: marca.slice(), cola: coord.cola.slice(), ocupado: coord.ocupado, token, mensajes, entradas, notas, enSC });
      const quedan = estado.some((e) => e === 'espera' || e === 'sc') || pide.some((x) => x != null && x > t);
      if (!quedan && (alg === 'token' || !vuelo.length) && entradas === pendientes) break;
    }
    return pasos;
  }

  /* ---------- Fig. 1: tres algoritmos ---------- */

  function montarAlgoritmos(cuerpo) {
    const est = { n: 5, alg: 'ra', modo: 'vez', quienes: new Set([0, 2, 3]) };
    let pasos, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', valor: est.alg, opciones: [['central', 'Servidor central'], ['ra', 'Ricart–Agrawala'], ['token', 'Anillo con token']], alCambiar: (v) => { est.alg = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Procesos', min: 3, max: 7, valor: est.n, alCambiar: (v) => { est.n = v; est.quienes = new Set([...est.quienes].filter((q) => q < v)); rep.reiniciar(); } });
    ctl.selector({ etiqueta: 'Los pedidos llegan', valor: est.modo, opciones: [['vez', 'todos a la vez'], ['escalonados', 'escalonados']], alCambiar: (v) => { est.modo = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(430, Math.max(320, w * 0.48)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'pedido', forma: 'linea' }, { color: C.s6, texto: 'permiso', forma: 'linea' },
      { color: C.s3, texto: 'liberación', forma: 'linea' }, { color: C.s7, texto: 'token', forma: 'linea' },
      { color: C.s4, texto: 'esperando', forma: 'punto' }, { color: C.s6, texto: 'en sección crítica', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un proceso para que pida o deje de pedir la sección crítica (anillo azul = pedirá). Cada proceso permanece 2 pasos dentro.');

    function iniciar() {
      const lista = [...est.quienes].sort((a, b) => a - b);
      const pide = new Array(est.n).fill(null);
      lista.forEach((q, r) => { pide[q] = est.modo === 'vez' ? 1 : 1 + 3 * r; });
      pasos = simular(est.n, est.alg, pide);
      k = 0;
      return (function* () { for (k = 1; k <= pasos.length; k++) yield; k = pasos.length; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ps = k > 0 ? pasos[k - 1] : null;
      pos = D.circulo(W, H, est.n, { margen: 44 });
      const centro = { x: W / 2, y: H / 2 };
      const rr = 18;
      const donde = (i) => (i === est.n ? centro : pos[i]);
      if (est.alg === 'token') {
        ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
        const R = Math.hypot(pos[0].x - centro.x, pos[0].y - centro.y);
        ctx.beginPath(); ctx.arc(centro.x, centro.y, R, 0, Math.PI * 2); ctx.stroke();
      }
      if (ps) for (const m of ps.mensajesPaso) {
        D.mensaje(ctx, donde(m.de), donde(m.a), rr, { color: MSJ[m.tipo].color, ancho: 2, curva: est.alg === 'token' ? 14 : 8, texto: m.extra || null });
      }
      if (est.alg === 'central') {
        D.nodo(ctx, centro.x, centro.y, 'C', { r: 20, relleno: C.fondo2 });
        const cola = ps ? ps.cola.map(P).join(' ') : '';
        D.etiqueta(ctx, ps && ps.ocupado >= 0 ? `permiso: ${P(ps.ocupado)}` : 'libre', centro.x, centro.y + 34, { color: C.tinta2, tam: 10 });
        if (cola) D.etiqueta(ctx, `cola: ${cola}`, centro.x, centro.y + 50, { color: C.tinta2, tam: 10 });
      }
      for (let i = 0; i < est.n; i++) {
        const e = ps ? ps.estado[i] : 'libre';
        D.nodo(ctx, pos[i].x, pos[i].y, P(i), {
          r: rr, relleno: e === 'sc' ? C.s6 : e === 'espera' ? C.s4 : e === 'hecho' ? C.neutro : C.superficie,
          texto: e === 'sc' ? C.sobre : C.tinta, anillo: est.quienes.has(i) ? C.s1 : null,
        });
        let bajo = '';
        if (est.alg === 'ra' && ps) bajo = ps.marca[i] != null ? `reloj ${ps.reloj[i]} · pide (${ps.marca[i]},${i + 1})` : `reloj ${ps.reloj[i]}`;
        if (est.alg === 'token' && (ps ? ps.token : 0) === i) bajo = '● token';
        if (bajo) D.etiqueta(ctx, bajo, pos[i].x, pos[i].y + rr + 13, { color: bajo.includes('token') ? C.s7 : C.tinta2, tam: 10 });
      }
      const ent = ps ? ps.entradas : 0, msg = ps ? ps.mensajes : 0;
      registro.textContent = !ps ? 'Ningún proceso está en la sección crítica. Avance paso a paso.'
        : `Paso ${ps.t}: ${ps.notas.length ? ps.notas.join('; ') + '.' : 'los mensajes viajan.'}${ps.enSC > 1 ? ' ¡Dos procesos a la vez!' : ''}`;
      if (k === pasos.length && ps) registro.textContent += ` Fin: ${ent} entradas con ${msg} mensajes.`;
      const teo = { central: '3', ra: `2(n − 1) = ${2 * (est.n - 1)}`, token: `1 a ∞ (${est.n} por vuelta)` };
      lectura.set([
        ['paso', `${k} de ${pasos.length}`],
        ['entradas', String(ent)],
        ['mensajes', String(msg)],
        ['mensajes por entrada', ent ? VIZ.fmt(msg / ent, 3) : '—'],
        ['teoría', teo[est.alg]],
      ]);
    }
    lienzo.alDibujar = () => pasos && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 24);
      if (i < 0) return;
      if (est.quienes.has(i)) est.quienes.delete(i); else est.quienes.add(i);
      rep.reiniciar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: la actualización perdida ---------- */

  const CODIGO = (lock) => [...(lock ? ['lock()'] : []), 'r ← x', 'r ← r + 1', 'x ← r', ...(lock ? ['unlock()'] : [])];

  function montarCarrera(cuerpo) {
    let lock = false, s;
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Proteger con un lock', valor: lock, alCambiar: (v) => { lock = v; reiniciar(); } });
    ctl.boton('P1 avanza', () => avanzar(0));
    ctl.boton('P2 avanza', () => avanzar(1));
    ctl.boton('Intercalado peligroso', () => { reiniciar(); for (const p of lock ? [0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1] : [0, 1, 0, 1, 0, 1]) avanzar(p, true); dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 270 : 220) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'P1' }, { color: C.s2, texto: 'P2' },
      { color: C.s4, texto: 'bloqueado esperando el lock', forma: 'punto' },
      { color: C.s8, texto: 'actualización perdida', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada proceso suma 1 a la variable compartida x leyéndola en un registro propio r. Elija quién avanza en cada paso.');

    function reiniciar() { s = { pc: [0, 0], r: [null, null], x: 0, duenio: -1, log: [], bloq: [false, false] }; dibujar(); }

    function avanzar(p, silencioso) {
      const cod = CODIGO(lock);
      if (s.pc[p] >= cod.length) { s.log.push(`${P(p)} ya terminó.`); if (!silencioso) dibujar(); return; }
      const ins = cod[s.pc[p]];
      s.bloq = [false, false];
      if (ins === 'lock()') {
        if (s.duenio >= 0 && s.duenio !== p) { s.bloq[p] = true; s.log.push(`${P(p)} intenta tomar el lock, pero lo tiene ${P(s.duenio)}: espera.`); if (!silencioso) dibujar(); return; }
        s.duenio = p; s.log.push(`${P(p)} toma el lock.`);
      } else if (ins === 'unlock()') { s.duenio = -1; s.log.push(`${P(p)} libera el lock.`); }
      else if (ins === 'r ← x') { s.r[p] = s.x; s.log.push(`${P(p)} lee x = ${s.x}.`); }
      else if (ins === 'r ← r + 1') { s.r[p]++; s.log.push(`${P(p)} calcula r = ${s.r[p]} en su registro.`); }
      else { s.x = s.r[p]; s.log.push(`${P(p)} escribe x = ${s.x}.`); }
      s.pc[p]++;
      if (!silencioso) dibujar();
    }

    // Todas las intercalaciones posibles y sus resultados.
    function explorar() {
      const cod = CODIGO(lock), res = {};
      (function rec(pc, r, x, d) {
        if (pc[0] === cod.length && pc[1] === cod.length) { res[x] = (res[x] || 0) + 1; return; }
        for (let p = 0; p < 2; p++) {
          if (pc[p] >= cod.length) continue;
          const ins = cod[pc[p]];
          if (ins === 'lock()' && d >= 0 && d !== p) continue;
          const pc2 = pc.slice(), r2 = r.slice();
          let x2 = x, d2 = d;
          pc2[p]++;
          if (ins === 'lock()') d2 = p; else if (ins === 'unlock()') d2 = -1;
          else if (ins === 'r ← x') r2[p] = x; else if (ins === 'r ← r + 1') r2[p]++; else x2 = r2[p];
          rec(pc2, r2, x2, d2);
        }
      })([0, 0], [0, 0], 0, -1);
      return res;
    }

    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cod = CODIGO(lock);
      const angosto = W < 600;
      const cw = angosto ? (W - 24) / 2 : Math.min(230, W * 0.3);
      const xs = [8, W - 8 - cw];
      for (let p = 0; p < 2; p++) {
        const col = VIZ.series[p], x = xs[p], y = 8;
        ctx.strokeStyle = s.bloq[p] ? C.s4 : col; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cw, 30 + cod.length * 22 + 30);
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(P(p), x + 10, y + 14);
        ctx.font = VIZ.fuente(13);
        cod.forEach((ins, j) => {
          const yy = y + 38 + j * 22;
          const hecho = s.pc[p] > j, actual = s.pc[p] === j;
          if (actual) { ctx.fillStyle = s.bloq[p] ? VIZ.alfa(C.s4, 0.3) : VIZ.alfa(col, 0.12); ctx.fillRect(x + 4, yy - 10, cw - 8, 20); }
          ctx.fillStyle = hecho || actual ? C.tinta : C.apagado;
          ctx.fillText(`${actual ? '▸' : ' '} ${ins}`, x + 10, yy);
        });
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(12, 500);
        ctx.fillText(`r = ${s.r[p] == null ? '—' : s.r[p]}`, x + 10, y + 38 + cod.length * 22 + 6);
      }
      // Memoria compartida
      const mx = angosto ? W / 2 - 70 : W / 2 - 70, my = angosto ? 30 + cod.length * 22 + 60 : 40;
      const terminado = s.pc[0] === cod.length && s.pc[1] === cod.length;
      const perdida = terminado && s.x !== 2;
      ctx.fillStyle = perdida ? VIZ.alfa(C.s8, 0.12) : C.fondo2; ctx.fillRect(mx, my, 140, 70);
      ctx.strokeStyle = perdida ? C.s8 : C.tinta; ctx.lineWidth = 1.5; ctx.strokeRect(mx, my, 140, 70);
      ctx.textAlign = 'center'; ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600);
      ctx.fillText('memoria compartida', mx + 70, my + 16);
      ctx.font = VIZ.fuente(18, 500); ctx.fillStyle = perdida ? C.s8 : C.tinta;
      ctx.fillText(`x = ${s.x}`, mx + 70, my + 44);
      if (lock) { ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.fillText(`lock: ${s.duenio >= 0 ? P(s.duenio) : 'libre'}`, mx + 70, my + 86); }
      const res = explorar();
      const total = Object.values(res).reduce((a, b) => a + b, 0);
      registro.textContent = (s.log.length ? s.log[s.log.length - 1] : 'x empieza en 0. Si ambos suman 1, debería terminar en 2.') +
        (terminado ? (perdida ? ' Fin: x = 1. Ambos leyeron 0 antes de que el otro escribiera: se perdió una actualización.' : ' Fin: x = 2, correcto.') : '');
      lectura.set([
        ['x', String(s.x)],
        ['intercalaciones posibles', String(total)],
        ['terminan con x = 2', String(res[2] || 0)],
        ['terminan con x = 1', String(res[1] || 0)],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    reiniciar();
  }

  VIZ.registrarTema('mutual-exclusion', {
    intro: String.raw`
      <p>Cuando varios procesos comparten un recurso (un archivo, una impresora, un registro de una base de datos), a lo más uno a la vez debe
      estar en su <strong>sección crítica</strong>. En un solo computador se usa un lock en memoria compartida; en un sistema distribuido no hay
      memoria común y la exclusión mutua se logra con mensajes.</p>
      <p>Hay tres familias clásicas: pedir permiso a un <strong>coordinador</strong>, pedir permiso a <strong>todos</strong> y ordenarse por marcas
      de tiempo (Ricart–Agrawala), o hacer circular un <strong>token</strong> que autoriza a quien lo tiene. Se comparan por mensajes por entrada,
      demora y tolerancia a fallas.</p>`,
    visualizaciones: [
      {
        titulo: 'Tres algoritmos',
        descripcion: 'Avance paso a paso y compare los mensajes por entrada. En Ricart–Agrawala, cada pedido lleva (reloj de Lamport, id): gana la marca menor, y el perdedor difiere su permiso hasta salir.',
        montar: montarAlgoritmos,
      },
      {
        titulo: 'La actualización perdida',
        descripcion: 'Sin exclusión mutua, dos incrementos pueden producir x = 1. Pulse «Intercalado peligroso» con y sin lock y compare cuántas intercalaciones terminan mal.',
        montar: montarCarrera,
      },
    ],
    teoria: String.raw`
      <h2>Requisitos</h2>
      <ul>
        <li><strong>Seguridad:</strong> a lo más un proceso en la sección crítica.</li>
        <li><strong>Vivacidad:</strong> todo pedido termina siendo atendido (sin interbloqueo ni inanición).</li>
        <li><strong>Equidad</strong> (opcional): se atiende en el orden de los pedidos, por ejemplo según <a href="tema.html?id=lamport-clocks">marcas de Lamport</a>.</li>
      </ul>

      <h2>Servidor central</h2>
      <p>Pedido, permiso y liberación: <strong>3 mensajes</strong> por entrada y demora de 2 mensajes. Simple y equitativo, pero el coordinador es un punto
      único de falla y un cuello de botella; si cae, hay que <a href="tema.html?id=bully-algorithm">elegir otro</a>.</p>

      <h2>Ricart–Agrawala</h2>
      <pre><code>pedir:   estado ← ESPERA;  T ← reloj + 1;  enviar REQ(T, i) a los otros n − 1
al recibir REQ(Tj, j):
    si estado = DENTRO  o  (estado = ESPERA  y  (T, i) &lt; (Tj, j)):  diferir la respuesta a j
    si no:  enviar OK a j
entrar:  al recibir n − 1 OK
salir:   estado ← LIBRE;  enviar OK a todos los diferidos</code></pre>
      <p><strong>Seguridad.</strong> Si \(i\) y \(j\) estuvieran dentro a la vez, cada uno habría enviado OK al otro. Sea \((T_i, i) &lt; (T_j, j)\): \(i\) solo
      responde OK a \(j\) si no estaba pidiendo, y entonces su pedido posterior tendría marca mayor que \(T_j\) por la regla de los relojes, contradicción.
      Usa \(2(n-1)\) mensajes por entrada; con \(n\) puntos de falla en vez de uno. La variante de Maekawa pide permiso solo a un quórum de
      \(O(\sqrt{n})\) procesos.</p>

      <h2>Anillo con token</h2>
      <p>Un único token recorre el anillo; quien lo tiene puede entrar. La seguridad es trivial (hay un solo token) y no hay inanición: cada proceso espera a lo
      más una vuelta. Pero el token circula aunque nadie lo necesite, y si se pierde hay que detectarlo y regenerarlo.</p>
      <table>
        <tr><th>Algoritmo</th><th>Mensajes por entrada</th><th>Demora antes de entrar</th><th>Problemas</th></tr>
        <tr><td>Central</td><td>3</td><td>2</td><td>Caída del coordinador</td></tr>
        <tr><td>Ricart–Agrawala</td><td>\(2(n-1)\)</td><td>2</td><td>Caída de cualquier proceso</td></tr>
        <tr><td>Anillo con token</td><td>1 a \(\infty\)</td><td>0 a \(n-1\)</td><td>Pérdida del token</td></tr>
      </table>

      <h2>La actualización perdida</h2>
      <p><code>x ← x + 1</code> no es atómico: son tres instrucciones (leer, sumar, escribir). De las \(\binom{6}{3} = 20\) intercalaciones de dos procesos, solo
      2 dan el resultado correcto (una completa antes que la otra). Con el lock, las intercalaciones que mezclan las secciones críticas son imposibles y todas
      terminan en \(x = 2\). Lo mismo, a escala distribuida, es lo que garantizan los algoritmos anteriores; los
      <a href="tema.html?id=dining-philosophers">filósofos comensales</a> muestran qué pasa al necesitar varios locks a la vez.</p>`,
  });
})();
