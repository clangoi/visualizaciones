(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const P = (i) => `P${i + 1}`;
  const SITIOS = ['Sitio A', 'Sitio B', 'Sitio C'];

  // 9 procesos, 3 por sitio. Aristas de espera i → j: «i espera un recurso que tiene j».
  function crear(semilla, conCiclo) {
    const rnd = VIZ.semilla(semilla);
    const n = 9, aristas = new Set();
    const sitio = (i) => Math.floor(i / 3);
    let ciclo = null;
    if (conCiclo) {
      // Un ciclo que cruza los tres sitios.
      ciclo = [Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 3), 6 + Math.floor(rnd() * 3)];
      if (rnd() < 0.5) ciclo.splice(1, 0, ciclo[0] === 0 ? 1 : 0);
      ciclo.forEach((a, k) => aristas.add(`${a}-${ciclo[(k + 1) % ciclo.length]}`));
    }
    // Aristas extra que no cierran ciclos: solo de índice menor a mayor «en otro sentido» (orden total) para no crear ciclos nuevos.
    for (let k = 0; k < 6; k++) {
      const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n);
      if (a === b) continue;
      const [u, v] = a < b ? [a, b] : [b, a];
      if (!aristas.has(`${v}-${u}`) && (conCiclo ? rnd() < 0.6 : true)) aristas.add(`${u}-${v}`);
    }
    const lista = [...aristas].map((x) => x.split('-').map(Number));
    // Si se pidió sin ciclo, se eliminan las aristas «hacia atrás» (de mayor a menor índice).
    return { n, sitio, ciclo, aristas: conCiclo ? lista : lista.filter(([u, v]) => u < v) };
  }

  // Chandy–Misra–Haas: el iniciador envía la sonda (i, origen, destino) por sus aristas; cada proceso bloqueado la reenvía una vez.
  function simular(g, ini) {
    const pasos = [], visto = new Set([ini]);
    let frontera = [ini], detectado = null, total = 0, entreSitios = 0;
    const padre = {};
    for (let r = 0; r < 20 && frontera.length && !detectado; r++) {
      const sondas = [], nueva = [];
      for (const u of frontera) for (const [a, b] of g.aristas) {
        if (a !== u) continue;
        sondas.push({ de: a, a: b, sonda: `(${ini + 1},${a + 1},${b + 1})` });
        total++; if (g.sitio(a) !== g.sitio(b)) entreSitios++;
        if (b === ini && !detectado) { detectado = { ultimo: a }; }
        if (!visto.has(b)) { visto.add(b); padre[b] = a; nueva.push(b); }
      }
      frontera = nueva;
      pasos.push({ sondas, visto: new Set(visto), total, entreSitios, detectado });
    }
    let ciclo = null;
    if (detectado) { ciclo = [ini]; let x = detectado.ultimo; const cam = []; while (x !== ini && x != null) { cam.push(x); x = padre[x]; } ciclo = [ini, ...cam.reverse()]; }
    return { pasos, ciclo };
  }

  function montar(cuerpo) {
    const est = { semilla: 3, conCiclo: true, ini: 0 };
    let g, sim, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.casilla({ etiqueta: 'Con un interbloqueo', valor: est.conCiclo, alCambiar: (v) => { est.conCiclo = v; nuevo(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevo grafo de espera', () => { est.semilla++; nuevo(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 520 : 300) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.eje, texto: 'espera a (i → j: i necesita algo que tiene j)', forma: 'linea' },
      { color: C.s2, texto: 'sondas enviadas en este paso', forma: 'linea' },
      { color: C.s1, texto: 'proceso al que llegó la sonda', forma: 'punto' },
      { color: C.s8, texto: 'ciclo: interbloqueo detectado', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada sitio solo conoce sus propias aristas de espera. Haga clic en un proceso para que él inicie la detección.');

    function nuevo() {
      g = crear(est.semilla * 29 + 1, est.conCiclo);
      const conSalida = g.aristas.map(([a]) => a);
      est.ini = g.ciclo ? g.ciclo[0] : conSalida.length ? Math.min(...conSalida) : 0;
      rep.reiniciar();
    }
    function iniciar() {
      sim = simular(g, est.ini);
      k = 0;
      return (function* () { for (k = 1; k <= sim.pasos.length; k++) yield; k = sim.pasos.length; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 600;
      const caja = (s) => (angosto ? { x: 10, y: 10 + s * (H - 20) / 3, w: W - 20, h: (H - 20) / 3 - 10 } : { x: 10 + s * (W - 20) / 3, y: 10, w: (W - 20) / 3 - 12, h: H - 20 });
      SITIOS.forEach((nm, s) => {
        const c = caja(s);
        ctx.fillStyle = C.fondo2; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(nm, c.x + 8, c.y + 6);
      });
      pos = Array.from({ length: g.n }, (_, i) => {
        const c = caja(g.sitio(i)), j = i % 3;
        return angosto ? { x: c.x + c.w * (0.2 + 0.3 * j), y: c.y + c.h * (j === 1 ? 0.38 : 0.68) } : { x: c.x + c.w * (j === 1 ? 0.72 : 0.32), y: c.y + c.h * (0.25 + 0.27 * j) };
      });
      const ps = k > 0 ? sim.pasos[k - 1] : null;
      const fin = k >= sim.pasos.length;
      const enCiclo = (a, b) => fin && sim.ciclo && sim.ciclo.some((x, i) => x === a && sim.ciclo[(i + 1) % sim.ciclo.length] === b);
      for (const [a, b] of g.aristas) {
        const activa = ps && ps.sondas.some((sd) => sd.de === a && sd.a === b);
        D.mensaje(ctx, pos[a], pos[b], 16, { color: enCiclo(a, b) ? C.s8 : activa ? C.s2 : C.eje, ancho: enCiclo(a, b) || activa ? 3 : 1.5, curva: 6 });
      }
      if (ps) for (const sd of ps.sondas) {
        const m = { x: (pos[sd.de].x * 0.4 + pos[sd.a].x * 0.6), y: (pos[sd.de].y * 0.4 + pos[sd.a].y * 0.6) - 10 };
        D.etiqueta(ctx, sd.sonda, m.x, m.y, { color: C.s2, borde: C.s2, tam: 10 });
      }
      for (let i = 0; i < g.n; i++) {
        const llego = ps && ps.visto.has(i);
        D.nodo(ctx, pos[i].x, pos[i].y, P(i), { r: 16, relleno: llego ? VIZ.alfa(C.s1, 0.3) : C.superficie, anillo: i === est.ini ? C.s1 : fin && sim.ciclo && sim.ciclo.includes(i) ? C.s8 : null });
      }
      if (!ps) registro.textContent = `${P(est.ini)} lleva mucho tiempo bloqueado y sospecha un interbloqueo: inicia una detección enviando sondas por sus aristas de espera.`;
      else if (ps.detectado) registro.textContent = `La sonda (${est.ini + 1}, ${ps.detectado.ultimo + 1}, ${est.ini + 1}) volvió a ${P(est.ini)}: hay un ciclo ${sim.ciclo.map(P).join(' → ')} → ${P(est.ini)}. Interbloqueo; hay que abortar a una víctima.`;
      else if (fin) registro.textContent = `Las sondas se agotaron sin volver a ${P(est.ini)}: ${P(est.ini)} no está en un ciclo (puede estar esperando a alguien que sí lo está, o solo esperando).`;
      else registro.textContent = `Paso ${k}: los procesos alcanzados que también están bloqueados reenvían la sonda por sus propias aristas de espera.`;
      lectura.set([
        ['sondas', String(ps ? ps.total : 0)],
        ['entre sitios', String(ps ? ps.entreSitios : 0)],
        ['interbloqueo', fin ? (sim.ciclo ? 'sí' : 'no') : '—'],
        ['iniciador', P(est.ini)],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 20);
      if (i >= 0) { est.ini = i; rep.reiniciar(); }
    });
    nuevo();
  }

  VIZ.registrarTema('deadlock-detection', {
    intro: String.raw`
      <p>Hay <strong>interbloqueo</strong> cuando un grupo de procesos espera, en ciclo, recursos que tienen otros del mismo grupo (ver los
      <a href="tema.html?id=dining-philosophers">filósofos comensales</a>). Con un solo computador basta buscar un ciclo en el <strong>grafo de espera</strong>.
      En un sistema distribuido, en cambio, cada sitio conoce solo sus aristas: el ciclo puede atravesar varias máquinas y nadie lo ve completo.</p>
      <p>El algoritmo de <strong>Chandy, Misra y Haas</strong> (1983) busca el ciclo persiguiendo las aristas: un proceso bloqueado envía una
      <strong>sonda</strong> a quienes espera, estos la reenvían a quienes ellos esperan, y si la sonda vuelve al iniciador, hay un ciclo.</p>`,
    visualizaciones: [
      {
        titulo: 'Sondas por el grafo de espera',
        descripcion: 'Avance paso a paso. La sonda (i, j, k) significa «iniciada por Pi, enviada por Pj a Pk». Si vuelve a Pi, el ciclo queda en rojo. Quite el interbloqueo y verá que las sondas se agotan.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Condiciones y estrategias</h2>
      <p>Un interbloqueo requiere exclusión mutua, retener y esperar, no expropiación y espera circular (Coffman). Frente a ellos hay cuatro estrategias: ignorarlos,
      <strong>prevenirlos</strong> (romper una condición, por ejemplo ordenando los recursos), <strong>evitarlos</strong> (conceder solo pedidos seguros, como el algoritmo
      del banquero, que exige conocer las necesidades máximas) o <strong>detectarlos</strong> y recuperarse. En sistemas distribuidos se usan sobre todo la prevención
      (con marcas de tiempo: <em>wait-die</em> y <em>wound-wait</em>) y la detección.</p>

      <h2>Detección centralizada</h2>
      <p>Un coordinador junta los grafos de espera locales y busca ciclos. Si la información llega desfasada puede encontrar un <strong>interbloqueo fantasma</strong>: una
      arista que ya desapareció en un sitio todavía figura en el grafo global. Se evita marcando los mensajes con <a href="tema.html?id=lamport-clocks">relojes de Lamport</a>
      o tomando una <a href="tema.html?id=chandy-lamport">instantánea consistente</a>.</p>

      <h2>Chandy–Misra–Haas (modelo AND)</h2>
      <pre><code>Pi bloqueado inicia:  para cada Pk que Pi espera: enviar sonda(i, i, k)

Pk recibe sonda(i, j, k):
    si k = i:  ¡interbloqueo!
    si Pk está bloqueado y no había reenviado sondas de i:
        para cada Pm que Pk espera:  enviar sonda(i, k, m)</code></pre>
      <p>Dentro de un sitio, la sonda se propaga sin mensajes; solo cuesta cruzar sitios. Cada proceso reenvía una sola vez cada sonda de un iniciador, así que se envían
      a lo más \(|E|\) sondas.</p>
      <div class="recuadro"><p><strong>Corrección.</strong> Si la sonda de \(P_i\) vuelve a \(P_i\), existe un camino de aristas de espera de \(P_i\) a sí mismo, formado por procesos
      que estaban bloqueados cuando la reenviaron; como un proceso bloqueado en el modelo AND no se desbloquea mientras espera, el ciclo sigue existiendo: no hay
      falsos positivos. Si \(P_i\) está en un ciclo, la sonda lo recorre: no hay falsos negativos.</p></div>
      <p>La detección de un interbloqueo es una propiedad estable, como la <a href="tema.html?id=termination-detection">terminación</a>. Detectado el ciclo, se aborta a una
      víctima (por ejemplo, la transacción más joven) y se liberan sus recursos.</p>`,
  });
})();
