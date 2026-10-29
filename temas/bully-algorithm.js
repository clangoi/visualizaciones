(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const P = (i) => `P${i + 1}`;
  const TIPOS = {
    E: { color: C.s2, nombre: 'ELECTION' },
    OK: { color: C.s3, nombre: 'OK' },
    C: { color: C.s6, nombre: 'COORDINATOR' },
  };

  /* Simula el algoritmo en rondas síncronas: lo enviado en una ronda llega en la siguiente.
     Un proceso que envió ELECTION en la ronda r y no recibió OK hasta la ronda r + 2 se proclama coordinador. */
  function simular(n, caidos, ini) {
    const vivo = (i) => !caidos.has(i);
    const inicio = new Array(n).fill(-1), ok = new Array(n).fill(false), conoce = new Array(n).fill(-1);
    const rondas = [], cuenta = { E: 0, OK: 0, C: 0 };
    let r = 0, vuelo = [];
    const foto = () => ({ inicio: inicio.slice(), ok: ok.slice(), conoce: conoce.slice() });
    const eleccion = (p, sal) => { inicio[p] = r; for (let q = p + 1; q < n; q++) sal.push({ de: p, a: q, tipo: 'E' }); };
    let sal = [];
    eleccion(ini, sal);
    const nadieArriba = ini === n - 1;
    rondas.push({ mensajes: sal, ...foto(), texto: nadieArriba
      ? `${P(ini)} detecta la caída del coordinador, pero no hay procesos con id mayor: espera un instante y se proclama.`
      : `${P(ini)} detecta que el coordinador no responde y envía ELECTION a todos los procesos con id mayor: ${sal.map((m) => P(m.a)).join(', ')}.` });
    for (const m of sal) cuenta[m.tipo]++;
    vuelo = sal;
    for (r = 1; r < 40; r++) {
      sal = [];
      const oks = [], nuevos = [], coords = [];
      for (const m of vuelo) {
        if (!vivo(m.a)) continue;
        if (m.tipo === 'E') {
          sal.push({ de: m.a, a: m.de, tipo: 'OK' });
          oks.push(`${P(m.a)}→${P(m.de)}`);
          if (inicio[m.a] < 0) { eleccion(m.a, sal); nuevos.push(P(m.a)); }
        } else if (m.tipo === 'OK') ok[m.a] = true;
        else conoce[m.a] = m.de;
      }
      for (let p = 0; p < n; p++) {
        if (vivo(p) && inicio[p] >= 0 && inicio[p] < r && !ok[p] && r === inicio[p] + 2) {
          conoce[p] = p;
          for (let q = 0; q < p; q++) sal.push({ de: p, a: q, tipo: 'C' });
          coords.push(P(p));
        }
      }
      const pendiente = inicio.some((t, p) => vivo(p) && t >= 0 && !ok[p] && conoce[p] !== p && r < t + 2);
      if (!sal.length && !pendiente) break;
      for (const m of sal) cuenta[m.tipo]++;
      const partes = [];
      if (oks.length) partes.push(`OK: ${oks.join(', ')}.`);
      if (nuevos.length) partes.push(`${nuevos.join(', ')} ${nuevos.length > 1 ? 'inician sus propias elecciones' : 'inicia su propia elección'} hacia los mayores.`);
      if (coords.length) partes.push(`${coords.join(', ')} no recibió ningún OK a tiempo: se proclama coordinador y avisa a todos los menores.`);
      if (!partes.length) partes.push('Nadie envía nada: los que esperan OK cuentan el plazo (timeout).');
      if (vuelo.some((m) => !vivo(m.a))) partes.push(`Los mensajes a ${[...new Set(vuelo.filter((m) => !vivo(m.a)).map((m) => P(m.a)))].join(', ')} se pierden: está caído.`);
      rondas.push({ mensajes: sal, ...foto(), texto: `Ronda ${r}. ${partes.join(' ')}` });
      vuelo = sal;
    }
    const coord = conoce.findIndex((c, p) => c === p);
    rondas.push({ mensajes: [], ...foto(), texto: `Fin: todos los procesos vivos reconocen a ${P(coord)}, el de mayor id entre los que funcionan.` });
    return { rondas, cuenta, coord };
  }

  /* ---------- Fig. 1: elección paso a paso ---------- */

  function montarEleccion(cuerpo) {
    const est = { n: 6, ini: 1, caidos: new Set([5]) };
    let sim, k = 0, pos = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Procesos', min: 4, max: 8, valor: est.n, alCambiar: (v) => {
      est.n = v; est.caidos = new Set([v - 1]); est.ini = Math.min(est.ini, v - 2); rIni.max = v - 1; rIni.valor = est.ini + 1; rep.reiniciar();
    } });
    const rIni = ctl.rango({ etiqueta: 'Inicia la elección', min: 1, max: est.n - 1, valor: est.ini + 1, formato: (v) => `P${v}`,
      alCambiar: (v) => { est.ini = v - 1; est.caidos.delete(est.ini); rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: -0.5 });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.min(440, Math.max(300, w * 0.5)) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'ELECTION', forma: 'linea' },
      { color: C.s3, texto: 'OK', forma: 'linea' },
      { color: C.s6, texto: 'COORDINATOR / coordinador', forma: 'linea' },
      { color: C.s4, texto: 'en elección', forma: 'punto' },
      { color: C.inactivo, texto: 'caído (mensaje perdido)', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un proceso para hacerlo caer o revivirlo. Lo enviado en una ronda llega en la siguiente.');

    function iniciar() {
      sim = simular(est.n, est.caidos, est.ini);
      k = 0;
      return (function* () { for (k = 1; k < sim.rondas.length; k++) yield; k = sim.rondas.length - 1; })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ro = sim.rondas[Math.min(k, sim.rondas.length - 1)];
      pos = D.circulo(W, H, est.n, { margen: 40 });
      const rr = 17;
      for (const m of ro.mensajes) {
        const caido = est.caidos.has(m.a);
        D.mensaje(ctx, pos[m.de], pos[m.a], rr, { color: caido ? C.inactivo : TIPOS[m.tipo].color, ancho: caido ? 1.5 : 2.2, guiones: caido ? [4, 4] : null, curva: 10 });
      }
      for (let i = 0; i < est.n; i++) {
        const caido = est.caidos.has(i);
        const esCoord = ro.conoce[i] === i;
        const enEleccion = ro.inicio[i] >= 0 && !esCoord;
        D.nodo(ctx, pos[i].x, pos[i].y, P(i), {
          r: rr, caido,
          relleno: esCoord ? C.s6 : enEleccion ? (ro.ok[i] ? VIZ.alfa(C.s4, 0.35) : C.s4) : C.superficie,
          texto: esCoord ? C.sobre : C.tinta,
          anillo: i === est.ini ? C.s1 : null,
        });
        const bajo = caido ? 'caído' : esCoord ? 'coordinador' : ro.conoce[i] >= 0 ? `coord. ${P(ro.conoce[i])}` : ro.ok[i] ? 'recibió OK' : '';
        if (bajo) D.etiqueta(ctx, bajo, pos[i].x, pos[i].y + rr + 13, { color: caido ? C.apagado : C.tinta2, tam: 10 });
      }
      registro.textContent = ro.texto;
      const hasta = { E: 0, OK: 0, C: 0 };
      sim.rondas.slice(0, k + 1).forEach((x) => x.mensajes.forEach((m) => hasta[m.tipo]++));
      lectura.set([
        ['ronda', `${Math.min(k, sim.rondas.length - 1)} de ${sim.rondas.length - 1}`],
        ['ELECTION', String(hasta.E)],
        ['OK', String(hasta.OK)],
        ['COORDINATOR', String(hasta.C)],
        ['total', String(hasta.E + hasta.OK + hasta.C)],
      ]);
    }
    lienzo.alDibujar = () => sim && dibujar();
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = D.cercano(pos, x, y, 22);
      if (i < 0 || i === est.ini) return;
      if (est.caidos.has(i)) est.caidos.delete(i); else est.caidos.add(i);
      rep.reiniciar();
    });
    rep.reiniciar();
  }

  /* ---------- Fig. 2: costo según quién inicia ---------- */

  function montarCosto(cuerpo) {
    let n = 10, datos = [], geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Procesos n', min: 4, max: 20, valor: n, alCambiar: (v) => { n = v; calcular(); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'ELECTION' }, { color: C.s3, texto: 'OK' }, { color: C.s6, texto: 'COORDINATOR' },
      { color: C.apagado, texto: 'peor caso: (n − 1)² + n − 2', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El coordinador Pn acaba de caer y un único proceso detecta la falla. Pase el cursor por una barra.');

    function calcular() {
      datos = [];
      for (let i = 0; i < n - 1; i++) datos.push(simular(n, new Set([n - 1]), i).cuenta);
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const peor = (n - 1) ** 2 + n - 2;
      const ymax = Math.max(...datos.map((d) => d.E + d.OK + d.C)) * 1.12;
      const plano = VIZ.plano(lienzo, { xmin: 0.4, xmax: n - 0.4, ymin: 0, ymax },
        { etiquetaX: 'proceso que inicia', etiquetaY: 'mensajes', formatoX: (v) => `P${v}`, ticksX: datos.map((_, i) => i + 1).filter((v) => n <= 12 || v % 2 === 1) });
      plano.ejes();
      const ancho = Math.max(4, (plano.sx(1) - plano.sx(0)) * 0.7);
      geo = { plano, ancho };
      datos.forEach((d, i) => {
        const x = plano.sx(i + 1) - ancho / 2;
        let base = 0;
        const capas = [['E', C.s2], ['OK', C.s3], ['C', C.s6]];
        capas.forEach(([t, col], j) => {
          const y0 = plano.sy(base), y1 = plano.sy(base + d[t]);
          ctx.fillStyle = hover === i || hover < 0 ? col : VIZ.alfa(col, 0.45);
          ctx.beginPath();
          ctx.roundRect(x, y1, ancho, y0 - y1 - (base > 0 ? 1 : 0), j === capas.length - 1 ? [4, 4, 0, 0] : 0);
          ctx.fill();
          base += d[t];
        });
      });
      // Referencia del peor caso (inicia P1).
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      const yp = plano.sy(peor);
      ctx.beginPath(); ctx.moveTo(plano.x0, yp); ctx.lineTo(plano.x1, yp); ctx.stroke(); ctx.restore();
      const tot = datos.map((d) => d.E + d.OK + d.C);
      lectura.set([
        ['peor caso (inicia P1)', String(tot[0])],
        ['mejor caso (inicia P' + (n - 1) + ')', String(tot[n - 2])],
        ['n²', String(n * n)],
        ['fórmula del peor caso', String(peor)],
      ]);
    }
    lienzo.alDibujar = () => datos.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo || !geo.plano.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      const i = Math.round(geo.plano.ix(x)) - 1;
      hover = i >= 0 && i < datos.length ? i : -1;
      dibujar();
      if (hover < 0) return tip.ocultar();
      const d = datos[hover];
      tip.mostrar(x, y, `inicia <b>P${hover + 1}</b>` + VIZ.filaTooltip(C.s2, 'ELECTION', d.E) + VIZ.filaTooltip(C.s3, 'OK', d.OK) +
        VIZ.filaTooltip(C.s6, 'COORDINATOR', d.C) + `total <b>${d.E + d.OK + d.C}</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    calcular();
    dibujar();
  }

  VIZ.registrarTema('bully-algorithm', {
    intro: String.raw`
      <p>Muchos sistemas distribuidos designan un <strong>coordinador</strong>: el que asigna turnos, guarda el registro maestro o decide
      el orden de las operaciones. Cuando el coordinador cae, los demás deben ponerse de acuerdo en uno nuevo. El
      <strong>algoritmo del matón</strong> (<em>bully</em>, García-Molina 1982) supone que cada proceso tiene un identificador único y
      conoce los de todos los demás, y elige siempre al proceso vivo de identificador más alto.</p>
      <p>Quien detecta la caída desafía a todos los que tienen identificador mayor. Si alguno responde, ese «matón» toma el control de la
      elección y el desafiante se retira; si nadie responde a tiempo, el desafiante gana y se lo comunica a los menores.</p>`,
    visualizaciones: [
      {
        titulo: 'Elección paso a paso',
        descripcion: 'Avance ronda a ronda. Pruebe a que inicie P1 o el proceso más alto vivo, y a hacer caer también al segundo más alto: gana siempre el mayor que sigue vivo.',
        montar: montarEleccion,
      },
      {
        titulo: 'Mensajes según quién inicia',
        descripcion: 'Cuantos más procesos haya por encima del que detecta la falla, más elecciones se encadenan. El peor caso es cuadrático en \\(n\\).',
        montar: montarCosto,
      },
    ],
    teoria: String.raw`
      <h2>Supuestos</h2>
      <ul>
        <li>Identificadores únicos y totalmente ordenados, conocidos por todos.</li>
        <li>Canales confiables y un sistema <strong>síncrono</strong>: existe una cota \(T\) para el tiempo de ida y vuelta de un mensaje,
        así que un <em>timeout</em> detecta correctamente que un proceso está caído.</li>
        <li>Los procesos fallan deteniéndose (<em>crash</em>) y pueden volver.</li>
      </ul>

      <h2>Algoritmo</h2>
      <pre><code>al detectar que el coordinador no responde, Pi:
    enviar ELECTION a todo Pj con j &gt; i
    si nadie responde OK antes de T:
        coordinador ← i;  enviar COORDINATOR a todo Pj con j &lt; i
    si no: esperar COORDINATOR (y reiniciar la elección si no llega)

al recibir ELECTION de Pj (j &lt; i):
    responder OK;  si aún no está en elección: iniciar una elección

al recibir COORDINATOR de Pk:
    coordinador ← k

al volver de una caída: iniciar una elección</code></pre>
      <p>Un proceso que vuelve con el identificador más alto gana de inmediato y desplaza al coordinador vigente: de ahí el nombre.</p>

      <h2>Corrección</h2>
      <p>Sea \(M\) el mayor identificador vivo. Toda elección que empiece debajo de \(M\) termina llegando a \(M\) (cada proceso que recibe
      ELECTION inicia la suya hacia arriba), y \(M\) no recibe ningún OK porque los que están sobre él están caídos. Ningún otro proceso puede
      proclamarse: todo \(P_i\) con \(i &lt; M\) recibe el OK de \(M\). Con un detector de fallas perfecto, todos terminan aceptando a \(M\).</p>
      <div class="recuadro"><p><strong>Advertencia.</strong> Si el sistema no es síncrono, un proceso lento parece caído: dos procesos pueden
      creerse coordinadores a la vez (<em>split brain</em>). Sin cotas de tiempo, el consenso determinista es imposible
      (Fischer, Lynch y Paterson, 1985), y los sistemas reales usan elección con quórum y mandatos numerados (Raft, Paxos).</p></div>

      <h2>Costo</h2>
      <p>Si el coordinador \(P_n\) cae y lo detecta \(P_i\), cada \(P_j\) con \(i \le j \le n-1\) termina enviando ELECTION a los \(n - j\)
      procesos mayores, recibe OK de los \(n - 1 - j\) vivos, y \(P_{n-1}\) envía \(n-2\) COORDINATOR:</p>
      \[ \underbrace{\sum_{j=i}^{n-1} (n-j)}_{\text{ELECTION}} + \underbrace{\sum_{j=i}^{n-1} (n-1-j)}_{\text{OK}} + (n-2). \]
      <table>
        <tr><th>Caso</th><th>Quién detecta</th><th>Mensajes</th></tr>
        <tr><td>Mejor</td><td>\(P_{n-1}\)</td><td>\(1 + (n-2) = n-1\)</td></tr>
        <tr><td>Peor</td><td>\(P_1\)</td><td>\(\tfrac{n(n-1)}{2} + \tfrac{(n-1)(n-2)}{2} + n-2 = (n-1)^2 + n - 2 = \Theta(n^2)\)</td></tr>
      </table>
      <p>La <a href="tema.html?id=ring-election">elección en anillo</a> usa en cambio \(O(n \log n)\) o \(O(n^2)\) mensajes según la variante,
      sin necesitar que cada proceso conozca a todos.</p>`,
  });
})();
