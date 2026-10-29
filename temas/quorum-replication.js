(function () {
  'use strict';
  const { color: C } = VIZ;

  const comb = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  // Probabilidad de que un quórum de lectura al azar no toque ninguna réplica de la última escritura (sin propagación posterior).
  const pVieja = (N, R, W) => comb(N - W, R) / comb(N, R);

  /* ---------- Fig. 1: lecturas y escrituras con quórums ---------- */

  function montarQuorums(cuerpo) {
    const est = { N: 5, R: 2, W: 2 };
    let s, rnd = VIZ.semilla(5), pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Réplicas N', min: 3, max: 9, valor: est.N, alCambiar: (v) => { est.N = v; est.R = Math.min(est.R, v); est.W = Math.min(est.W, v); rR.valor = est.R; rW.valor = est.W; reiniciar(); } });
    const rR = ctl.rango({ etiqueta: 'Quórum de lectura R', min: 1, max: 9, valor: est.R, alCambiar: (v) => { est.R = Math.min(v, est.N); rR.valor = est.R; dibujar(); } });
    const rW = ctl.rango({ etiqueta: 'Quórum de escritura W', min: 1, max: 9, valor: est.W, alCambiar: (v) => { est.W = Math.min(v, est.N); rW.valor = est.W; dibujar(); } });
    ctl.boton('Escribir', () => escribir(), { primario: true });
    ctl.boton('Leer', () => leer());
    ctl.boton('Propagar en segundo plano', () => propagar());
    ctl.boton('100 operaciones al azar', () => { for (let k = 0; k < 100; k++) (rnd() < 0.5 ? escribir : leer)(true); dibujar(); });
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 170 });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'quórum de la última escritura' }, { color: C.s1, texto: 'quórum de la última lectura' },
      { color: C.s6, texto: 'en ambos: la intersección' }, { color: C.inactivo, texto: 'réplica caída' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada réplica guarda (versión, valor). Una lectura consulta R réplicas al azar y se queda con la versión más alta. Haga clic en una réplica para hacerla caer o revivirla.');

    function reiniciar() { s = { ver: new Array(est.N).fill(0), caida: new Array(est.N).fill(false), ultima: 0, qW: [], qR: [], lecturas: 0, viejas: 0, fallidas: 0, log: 'Todas las réplicas tienen la versión 0.' }; dibujar(); }
    const vivas = () => s.ver.map((_, i) => i).filter((i) => !s.caida[i]);
    const elegir = (k) => { const v = vivas(); for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; } return v.slice(0, k); };

    function escribir(silencio) {
      if (vivas().length < est.W) { s.fallidas++; s.log = `No hay ${est.W} réplicas vivas: la escritura no puede completarse.`; if (!silencio) dibujar(); return; }
      const q = elegir(est.W);
      // El cliente primero averigua la versión vigente (aquí, la última conocida) y escribe la siguiente.
      s.ultima++;
      q.forEach((i) => { s.ver[i] = s.ultima; });
      s.qW = q; s.qR = [];
      s.log = `Escritura de la versión ${s.ultima} en ${q.map((i) => `R${i + 1}`).join(', ')}.`;
      if (!silencio) dibujar();
    }
    function leer(silencio) {
      if (vivas().length < est.R) { s.fallidas++; s.log = `No hay ${est.R} réplicas vivas: la lectura no puede completarse.`; if (!silencio) dibujar(); return; }
      const q = elegir(est.R);
      const v = Math.max(...q.map((i) => s.ver[i]));
      s.qR = q; s.lecturas++;
      const vieja = v < s.ultima;
      if (vieja) s.viejas++;
      s.log = `Lectura en ${q.map((i) => `R${i + 1}`).join(', ')}: la versión más alta es ${v}.${vieja ? ` ¡Vieja! La última es ${s.ultima}: el quórum de lectura no tocó a ninguna réplica que la tuviera.` : ' Es la última.'}`;
      if (!silencio) dibujar();
    }
    function propagar() {
      const atrasadas = vivas().filter((i) => s.ver[i] < s.ultima);
      if (!atrasadas.length) { s.log = 'Todas las réplicas vivas están al día.'; return dibujar(); }
      const i = atrasadas[0];
      s.ver[i] = Math.max(...vivas().map((j) => s.ver[j]));
      s.log = `La anti-entropía lleva a R${i + 1} a la versión ${s.ver[i]}.`;
      dibujar();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const n = est.N, ancho = Math.min(80, (W - 20) / n - 8);
      pos = [];
      for (let i = 0; i < n; i++) {
        const x = W / 2 + (i - (n - 1) / 2) * (ancho + 8), y = 60;
        pos.push({ x, y: y + 25 });
        const enW = s.qW.includes(i), enR = s.qR.includes(i);
        const col = s.caida[i] ? C.inactivo : enW && enR ? C.s6 : enW ? C.s2 : enR ? C.s1 : C.tinta;
        ctx.fillStyle = s.caida[i] ? C.neutro : enW || enR ? VIZ.alfa(col, 0.18) : C.superficie;
        ctx.strokeStyle = col; ctx.lineWidth = enW || enR ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(x - ancho / 2, y, ancho, 50, 4); ctx.fill(); ctx.stroke();
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = s.caida[i] ? C.inactivo : C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`R${i + 1}`, x, y - 12);
        ctx.font = VIZ.fuente(15, 500); ctx.fillStyle = s.caida[i] ? C.inactivo : s.ver[i] === s.ultima ? C.tinta : C.s8;
        ctx.fillText(s.caida[i] ? '—' : `v${s.ver[i]}`, x, y + 25);
      }
      ctx.font = VIZ.fuente(12, 500); ctx.textAlign = 'center';
      const ok = est.R + est.W > est.N;
      ctx.fillStyle = ok ? C.s6 : C.s8;
      ctx.fillText(`R + W = ${est.R + est.W} ${ok ? '>' : '≤'} N = ${est.N}: ${ok ? 'todo quórum de lectura toca la última escritura' : 'puede leerse una versión vieja'}`, W / 2, 140);
      registro.textContent = s.log;
      lectura.set([
        ['última versión', String(s.ultima)],
        ['lecturas', String(s.lecturas)],
        ['lecturas viejas', `${s.viejas}${s.lecturas ? ` (${Math.round((100 * s.viejas) / s.lecturas)} %)` : ''}`],
        ['operaciones fallidas', String(s.fallidas)],
        ['P(lectura vieja) teórica', VIZ.fmt(pVieja(est.N, est.R, est.W), 3)],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = pos.findIndex((p) => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 32);
      if (i < 0) return;
      s.caida[i] = !s.caida[i];
      s.log = `R${i + 1} ${s.caida[i] ? 'cae' : 'vuelve (con la versión que tenía)'}. Quedan ${vivas().length} vivas: ${vivas().length >= est.W ? 'se puede escribir' : 'no se puede escribir'} y ${vivas().length >= est.R ? 'leer' : 'no se puede leer'}.`;
      dibujar();
    });
    reiniciar();
  }

  /* ---------- Fig. 2: el mapa de (R, W) ---------- */

  function montarMapa(cuerpo) {
    let N = 7, hover = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Réplicas N', min: 3, max: 12, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(380, Math.max(260, w * 0.45)) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: VIZ.css(VIZ.enRampa(0)), texto: 'P(lectura vieja) = 0' }, { color: VIZ.css(VIZ.enRampa(1)), texto: 'P cercana a 1' },
      { color: C.s6, texto: 'frontera R + W = N + 1', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada celda es una configuración (R, W), con la probabilidad de leer una versión vieja si la escritura no se propagó más allá de su quórum. Pase el cursor por una celda.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 46, inf = 34, lado = Math.min((W - izq - 20) / N, (H - inf - 14) / N);
      geo = { izq, inf, lado, H };
      for (let r = 1; r <= N; r++) for (let w = 1; w <= N; w++) {
        const p = pVieja(N, r, w), x = izq + (r - 1) * lado, y = H - inf - w * lado;
        ctx.fillStyle = VIZ.css(VIZ.enRampa(p));
        ctx.fillRect(x + 1, y + 1, lado - 2, lado - 2);
        if (hover && hover.r === r && hover.w === w) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, lado - 2, lado - 2); }
        if (lado > 30) { ctx.font = VIZ.fuente(10); ctx.fillStyle = p > 0.5 ? C.sobre : C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p === 0 ? '0' : VIZ.fmt(p, 2), x + lado / 2, y + lado / 2); }
      }
      // Frontera escalonada R + W = N + 1.
      ctx.strokeStyle = C.s6; ctx.lineWidth = 3; ctx.beginPath();
      for (let r = 1; r <= N; r++) {
        const w = N + 1 - r, x0 = izq + (r - 1) * lado, x1 = x0 + lado, y = H - inf - (w - 1) * lado;
        if (r === 1) ctx.moveTo(x0, y); else ctx.lineTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let r = 1; r <= N; r++) ctx.fillText(String(r), izq + (r - 0.5) * lado, H - inf + 4);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let w = 1; w <= N; w++) ctx.fillText(String(w), izq - 6, H - inf - (w - 0.5) * lado);
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('R →', izq + N * lado + 4, H - inf + 16);
      ctx.textBaseline = 'top'; ctx.fillText('↑ W', 2, 0);
      lectura.set([
        ['mayoría (R = W)', `${Math.floor(N / 2) + 1}`],
        ['leer uno, escribir todos', `R = 1, W = ${N}`],
        ['ejemplo Dynamo (N = 3)', 'R = 2, W = 2'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const r = Math.floor((x - geo.izq) / geo.lado) + 1, w = Math.floor((geo.H - geo.inf - y) / geo.lado) + 1;
      if (r < 1 || r > N || w < 1 || w > N) { hover = null; tip.ocultar(); return dibujar(); }
      hover = { r, w }; dibujar();
      tip.mostrar(x, y, `R = <b>${r}</b>, W = <b>${w}</b><br>P(lectura vieja) <b>${VIZ.fmt(pVieja(N, r, w), 3)}</b><br>tolera ${N - r} caídas para leer y ${N - w} para escribir`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('quorum-replication', {
    intro: String.raw`
      <p>Con \(N\) réplicas de un dato, no hace falta escribir en todas ni leer de todas. Basta con que cada escritura llegue a un <strong>quórum de escritura</strong> de \(W\) réplicas
      y cada lectura consulte un <strong>quórum de lectura</strong> de \(R\), siempre que ambos conjuntos se intersequen: entonces toda lectura encuentra al menos una réplica con la
      última versión, y la reconoce por su número.</p>
      <p>La condición es \(R + W &gt; N\). Ajustando \(R\) y \(W\) se elige el equilibrio entre latencia de lectura, latencia de escritura y cuántas réplicas pueden estar caídas.
      Si se permite \(R + W \le N\), las operaciones son más rápidas pero se puede leer un valor viejo: es la consistencia eventual configurable de Dynamo, Cassandra y Riak.</p>`,
    visualizaciones: [
      {
        titulo: 'Lecturas y escrituras con quórums',
        descripcion: 'Con N = 5, R = 2 y W = 2, pulse «100 operaciones al azar» y vea cuántas lecturas son viejas. Suba R a 4 (R + W = 6 > 5): ninguna lo es. Haga caer réplicas hasta que no quede un quórum.',
        montar: montarQuorums,
      },
      {
        titulo: 'El mapa de (R, W)',
        descripcion: 'Sobre la frontera verde (R + W > N) la probabilidad de leer algo viejo es exactamente 0. Bajo ella crece rápidamente.',
        montar: montarMapa,
      },
    ],
    teoria: String.raw`
      <h2>Condiciones de quórum</h2>
      <p>Gifford (1979) propuso asignar votos a las réplicas y exigir:</p>
      \[ R + W &gt; N \qquad\text{(lectura y escritura se intersecan)}, \qquad 2W &gt; N \qquad\text{(dos escrituras se intersecan)}. \]
      <p>La primera garantiza que una lectura vea la última escritura confirmada; la segunda, que dos escrituras concurrentes no avancen sin verse, de modo que los números de versión
      formen un orden total. Cada escritura lee primero la versión vigente de un quórum y escribe la siguiente.</p>

      <h2>Probabilidad de leer algo viejo</h2>
      <p>Si una escritura alcanzó exactamente \(W\) réplicas y una lectura elige \(R\) al azar, la lectura no ve la escritura cuando todas sus réplicas están entre las \(N - W\) restantes:</p>
      \[ \Pr[\text{vieja}] = \frac{\binom{N-W}{R}}{\binom{N}{R}}, \]
      <p>que vale 0 si \(R &gt; N - W\). En la práctica la anti-entropía y la <em>reparación en la lectura</em> (reescribir la versión nueva en las réplicas atrasadas que se consultaron)
      reducen la ventana en que una réplica queda vieja.</p>

      <h2>Configuraciones típicas</h2>
      <table>
        <tr><th>Configuración</th><th>Ventaja</th><th>Desventaja</th></tr>
        <tr><td>\(R = 1, W = N\)</td><td>Lecturas rápidas</td><td>Una réplica caída impide escribir</td></tr>
        <tr><td>\(R = N, W = 1\)</td><td>Escrituras rápidas</td><td>Una réplica caída impide leer</td></tr>
        <tr><td>\(R = W = \lfloor N/2 \rfloor + 1\)</td><td>Tolera minorías caídas en ambas</td><td>Ambas esperan a una mayoría</td></tr>
        <tr><td>\(R + W \le N\)</td><td>Mínima latencia y máxima disponibilidad</td><td>Consistencia solo eventual</td></tr>
      </table>
      <p>Que los quórums se intersequen no basta para la <a href="tema.html?id=linearizability">linealizabilidad</a> cuando hay operaciones concurrentes: el algoritmo ABD agrega que la
      lectura reescriba lo leído en un quórum de escritura antes de responder. Los quórums de mayoría son también el corazón de <a href="tema.html?id=paxos">Paxos</a> y
      <a href="tema.html?id=raft">Raft</a>, y la razón de que un sistema partido en dos no pueda seguir aceptando escrituras en la minoría (<a href="tema.html?id=cap-theorem">CAP</a>).</p>`,
  });
})();
