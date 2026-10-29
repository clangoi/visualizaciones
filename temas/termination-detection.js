(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const M = (i) => `M${i}`;

  /* Cómputo de fondo: las máquinas activas envían trabajo (que activa al receptor) o se vuelven pasivas.
     Los mensajes de trabajo son instantáneos, como supone el algoritmo. El token va de la máquina i + 1 a la i;
     la máquina 0 inicia cada sondeo enviándolo a la n − 1. colores = false: versión ingenua sin colores. */
  function simular(n, semilla, colores, presupuesto = 26) {
    const rnd = VIZ.semilla(semilla);
    const activo = new Array(n).fill(false), negro = new Array(n).fill(false);
    activo[0] = true;
    activo[Math.floor(n / 2)] = true;
    let token = { en: 0, negro: false, viajando: false }, quedan = presupuesto, sondeos = 0;
    const pasos = [];
    let real = null, detectada = null;
    for (let t = 1; t <= 400 && detectada == null; t++) {
      const envios = [], notas = [];
      // Cómputo
      for (let i = 0; i < n; i++) {
        if (!activo[i]) continue;
        if (quedan > 0 && rnd() < 0.45) {
          let j = Math.floor(rnd() * (n - 1)); if (j >= i) j++;
          envios.push([i, j]);
          quedan--;
          if (colores) negro[i] = true;
          if (!activo[j]) notas.push(`${M(i)} envía trabajo a ${M(j)}, que se activa`);
          activo[j] = true;
        } else if (rnd() < 0.35) activo[i] = false;
      }
      if (real == null && activo.every((a) => !a)) real = t;
      // Token: un salto por paso.
      let paseToken = null;
      if (t === 1) {
        sondeos++; negro[0] = false;
        token = { en: n - 1, negro: false }; paseToken = [0, n - 1];
        notas.push('M0 inicia un sondeo: envía un token blanco a la máquina de mayor número');
      } else if (token.en !== 0) {
        const h = token.en;
        if (!activo[h]) {
          const col = token.negro || negro[h];
          if (negro[h] && !token.negro) notas.push(`${M(h)} es negra: el token se vuelve negro`);
          negro[h] = false;
          token = { en: h - 1, negro: col };
          paseToken = [h, h - 1];
        }
      } else if (!activo[0]) {
        if (!token.negro && !negro[0]) {
          detectada = t;
          notas.push(activo.some((a) => a) ? 'M0 recibe un token blanco, es blanca y está pasiva: declara terminación… ¡pero hay máquinas activas!' : 'M0 recibe un token blanco, es blanca y está pasiva: declara terminación, correctamente.');
        } else {
          notas.push(`El token vuelve ${token.negro ? 'negro' : 'blanco, pero M0 es negra'}: el sondeo falla y M0 inicia otro`);
          sondeos++; negro[0] = false;
          token = { en: n - 1, negro: false }; paseToken = [0, n - 1];
        }
      }
      pasos.push({ t, activo: activo.slice(), negro: negro.slice(), token: { ...token }, envios, paseToken, notas, sondeos, real, detectada, quedan });
    }
    return { pasos, real, detectada, falsa: detectada != null && (real == null || detectada < real) };
  }

  function montar(cuerpo) {
    const est = { n: 6, colores: true, semilla: 0 };
    let sim, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Reglas', valor: 'dfg', opciones: [['dfg', 'DFG: máquinas y token con colores'], ['ingenua', 'Ingenua: el token solo verifica pasividad']],
      alCambiar: (v) => { est.colores = v === 'dfg'; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Máquinas', min: 3, max: 9, valor: est.n, alCambiar: (v) => { est.n = v; est.semilla = 0; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 1 });
    ctl.boton('Otro cómputo', () => { est.semilla = (est.semilla || buscarFalla()) + 1; rep.reiniciar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(430, Math.max(320, w * 0.48)) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'activa', forma: 'punto' },
      { color: C.superficie, borde: C.tinta, texto: 'pasiva', forma: 'punto' },
      { color: C.tinta, texto: 'máquina negra (anillo)', forma: 'punto' },
      { color: C.s2, texto: 'mensaje de trabajo', forma: 'linea' },
      { color: C.s7, texto: 'paso del token (◇ blanco, ◆ negro)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El cómputo arranca con dos máquinas activas y un presupuesto de 26 mensajes de trabajo. Compare las reglas con «Otro cómputo».');

    // Semilla en que la versión ingenua se equivoca, para empezar con un ejemplo elocuente.
    function buscarFalla() {
      for (let s = 1; s < 300; s++) if (simular(est.n, s * 31 + est.n, false).falsa) return s;
      return 1;
    }

    function iniciar() {
      if (!est.semilla) est.semilla = buscarFalla();
      sim = simular(est.n, est.semilla * 31 + est.n, est.colores);
      k = 0;
      return (function* () { for (k = 1; k <= sim.pasos.length; k++) yield; k = sim.pasos.length; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ps = k > 0 ? sim.pasos[k - 1] : null;
      pos = D.circulo(W, H, est.n, { margen: 46 });
      const cx = W / 2, cy = H / 2, R = Math.hypot(pos[0].x - cx, pos[0].y - cy), rr = 18;
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      if (ps) {
        for (const [a, b] of ps.envios) D.mensaje(ctx, pos[a], pos[b], rr, { color: C.s2, ancho: 2, curva: 10 });
        if (ps.paseToken) D.mensaje(ctx, pos[ps.paseToken[0]], pos[ps.paseToken[1]], rr, { color: C.s7, ancho: 2.5, curva: ps.paseToken[0] === 0 ? -20 : 0 });
      }
      for (let i = 0; i < est.n; i++) {
        const activa = ps ? ps.activo[i] : i === 0 || i === Math.floor(est.n / 2);
        const negra = ps ? ps.negro[i] : false;
        D.nodo(ctx, pos[i].x, pos[i].y, M(i), { r: rr, relleno: activa ? C.s1 : C.superficie, texto: activa ? C.sobre : C.tinta, anillo: negra ? C.tinta : null });
      }
      // Token
      const tk = ps ? ps.token : { en: 0, negro: false };
      const a = Math.atan2(pos[tk.en].y - cy, pos[tk.en].x - cx);
      const tx = pos[tk.en].x + Math.cos(a) * 32, ty = pos[tk.en].y + Math.sin(a) * 32;
      ctx.save();
      ctx.translate(tx, ty); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = tk.negro ? C.tinta : C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 2;
      ctx.fillRect(-6, -6, 12, 12); ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
      const detect = ps && ps.detectada != null;
      registro.textContent = !ps ? 'M0 y otra máquina empiezan activas. M0 lanzará el primer sondeo.'
        : `Paso ${ps.t}: ${ps.notas.length ? ps.notas.join('; ').replace(/[^.!?…]$/, (c) => c + '.') : ps.envios.length ? `${ps.envios.length} mensaje${ps.envios.length > 1 ? 's' : ''} de trabajo.` : 'el cómputo sigue.'}`;
      if (detect && k === sim.pasos.length) registro.textContent += sim.falsa ? ' La detección fue falsa: una máquina ya visitada fue reactivada por detrás del token.' : ` Terminación real en el paso ${sim.real}; detectada ${sim.pasos[k - 1].t - sim.real} pasos después.`;
      lectura.set([
        ['paso', String(ps ? ps.t : 0)],
        ['activas', String(ps ? ps.activo.filter(Boolean).length : 2)],
        ['sondeos', String(ps ? ps.sondeos : 0)],
        ['terminación real', ps && ps.real != null ? `paso ${ps.real}` : 'aún no'],
        ['detectada', detect ? (sim.falsa ? `paso ${ps.detectada} (¡falsa!)` : `paso ${ps.detectada}`) : 'aún no'],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    rep.reiniciar();
  }

  VIZ.registrarTema('termination-detection', {
    intro: String.raw`
      <p>Un cómputo distribuido termina cuando todos los procesos están <strong>pasivos</strong> y no hay mensajes en tránsito. Ningún proceso lo
      ve por sí solo: un proceso pasivo puede ser reactivado por un mensaje de otro. Detectar la terminación es necesario para saber cuándo
      se puede leer el resultado de un cálculo distribuido, liberar recursos o pasar a la siguiente fase.</p>
      <p>El algoritmo de <strong>Dijkstra, Feijen y van Gasteren</strong> (1983) hace circular un <strong>token</strong> por un anillo. La idea
      ingenua, «si el token encuentra a todos pasivos, terminó», falla: una máquina ya visitada puede ser reactivada por otra que el token aún
      no visita. La solución es pintar de negro a quien envía trabajo, y ennegrecer el token al pasar por una máquina negra.</p>`,
    visualizaciones: [
      {
        titulo: 'El token en el anillo',
        descripcion: 'Avance paso a paso. Con las reglas ingenuas, el ejemplo inicial declara la terminación mientras una máquina sigue activa. Cambie a DFG: el mismo cómputo vuelve negro el token y M0 lanza otro sondeo.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Modelo</h2>
      <p>Máquinas \(M_0, \dots, M_{N-1}\), cada una activa o pasiva. Solo una máquina activa puede enviar mensajes; una máquina pasiva solo se activa al recibir
      uno; una activa puede volverse pasiva en cualquier momento. En la versión original los mensajes de trabajo son instantáneos; el token viaja de
      \(M_{i+1}\) a \(M_i\), y \(M_0\) lo envía a \(M_{N-1}\) al iniciar un sondeo.</p>

      <h2>Reglas</h2>
      <ol>
        <li>Una máquina solo pasa el token cuando está pasiva.</li>
        <li>Una máquina que envía un mensaje de trabajo se vuelve <strong>negra</strong>.</li>
        <li>Al pasar el token, una máquina negra lo vuelve negro; una blanca lo deja como llegó. Después de pasarlo, la máquina se vuelve blanca.</li>
        <li>\(M_0\) declara la terminación si recibe un token blanco, es blanca y está pasiva. Si no, inicia un nuevo sondeo con un token blanco.</li>
      </ol>

      <h2>Corrección</h2>
      <p>Sea \(t\) la posición del token: ya visitó \(M_{N-1}, \dots, M_{t+1}\). La invariante es</p>
      \[ P_0 \lor P_1 \lor P_2, \]
      <ul>
        <li>\(P_0\): todas las máquinas visitadas (\(i &gt; t\)) están pasivas;</li>
        <li>\(P_1\): alguna máquina no visitada (\(i \le t\)) es negra;</li>
        <li>\(P_2\): el token es negro.</li>
      </ul>
      <p>Al iniciar el sondeo vale \(P_0\) (no hay visitadas). Si una máquina \(j\) activa a una visitada, \(P_0\) puede romperse, pero \(j\) se vuelve negra:
      si \(j \le t\) vale \(P_1\), y si \(j &gt; t\), \(j\) estaba activa, así que \(P_0\) ya era falsa y valía \(P_1\) o \(P_2\). Cuando el token pasa por una
      máquina negra, \(P_1\) puede perderse, pero se gana \(P_2\). Al volver a \(M_0\) blanca, pasiva y con token blanco, \(P_1\) y \(P_2\) son falsas, así que
      vale \(P_0\) para todas: terminó.</p>
      <div class="recuadro"><p>Sin colores, \(P_1\) y \(P_2\) no existen y nada protege \(P_0\): un mensaje de una máquina no visitada a una visitada produce una
      detección falsa, como en la figura.</p></div>

      <h2>Costo y variantes</h2>
      <p>Cada sondeo cuesta \(N\) mensajes de control; después de la terminación real basta, a lo más, un sondeo fallido y uno exitoso. El algoritmo de
      <strong>Safra</strong> extiende la idea a mensajes asíncronos con contadores de enviados y recibidos. Otras técnicas: <strong>Dijkstra–Scholten</strong>
      (árbol de difusión con acuses, parecido al <a href="tema.html?id=probe-echo">probe/echo</a>), recuperación de pesos (Huang) y
      <a href="tema.html?id=chandy-lamport">instantáneas</a>, ya que la terminación es una propiedad estable.</p>`,
  });
})();
