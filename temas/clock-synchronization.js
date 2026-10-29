(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;

  /* ---------- Fig. 1: deriva y resincronización ---------- */

  function montarDeriva(cuerpo) {
    const est = { rho: 100, intervalo: 30, rtt: 40, semilla: 2 };
    let datos, plano = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Deriva máxima ρ', min: 10, max: 300, paso: 10, valor: est.rho, formato: (v) => `${v} ppm`, alCambiar: (v) => { est.rho = v; calcular(); } });
    ctl.rango({ etiqueta: 'Resincronizar cada', min: 5, max: 120, paso: 5, valor: est.intervalo, formato: (v) => `${v} min`, alCambiar: (v) => { est.intervalo = v; calcular(); } });
    ctl.rango({ etiqueta: 'Ida y vuelta al servidor', min: 0, max: 200, paso: 10, valor: est.rtt, formato: (v) => `${v} ms`, alCambiar: (v) => { est.rtt = v; calcular(); } });
    ctl.boton('Otros relojes', () => { est.semilla++; calcular(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'reloj A', forma: 'linea' }, { color: C.s2, texto: 'reloj B', forma: 'linea' }, { color: C.s3, texto: 'reloj C', forma: 'linea' },
      { color: C.apagado, texto: '±ρ·Δ: desfase máximo antes de resincronizar', forma: 'linea' },
    ]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Desfase de cada reloj respecto del tiempo real (UTC) durante 4 horas. Al resincronizar, el desfase queda dentro de ±RTT/2. Pase el cursor por el gráfico.');

    function calcular() {
      const rnd = VIZ.semilla(est.semilla * 41);
      datos = ['A', 'B', 'C'].map((n, j) => {
        const deriva = (rnd() * 2 - 1) * est.rho * 1e-6; // s por s
        const fase = rnd() * est.intervalo;
        const pts = [];
        let off = (rnd() * 2 - 1) * est.rtt / 2, periodo = Math.floor(-fase / est.intervalo);
        for (let t = 0; t <= 240; t += 0.5) {
          const k = Math.floor((t - fase) / est.intervalo);
          if (k !== periodo) { periodo = k; off = (rnd() * 2 - 1) * est.rtt / 2; } // resincronización: queda dentro de ±RTT/2
          else off += deriva * 30 * 1000; // 0,5 min = 30 s → ms
          pts.push([t, off]);
        }
        return { n, color: VIZ.series[j], pts, deriva };
      });
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const cota = est.rho * 1e-6 * est.intervalo * 60 * 1000 + est.rtt / 2;
      const ym = Math.max(cota, ...datos.flatMap((d) => d.pts.map((p) => Math.abs(p[1])))) * 1.15;
      plano = VIZ.plano(lienzo, { xmin: 0, xmax: 240, ymin: -ym, ymax: ym }, { etiquetaX: 'tiempo real (min)', etiquetaY: 'desfase respecto de UTC (ms)' });
      plano.ejes();
      VIZ.trazar(ctx, plano, [[0, cota], [240, cota]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, plano, [[0, -cota], [240, -cota]], C.apagado, 1.5, [3, 4]);
      for (const d of datos) VIZ.trazar(ctx, plano, d.pts, d.color, 2);
      if (hover != null) for (const d of datos) VIZ.marcador(ctx, plano.sx(hover), plano.sy(d.pts[hover * 2][1]), d.color, 4);
      const maxDif = Math.max(...datos[0].pts.map((_, i) => Math.max(...datos.map((d) => d.pts[i][1])) - Math.min(...datos.map((d) => d.pts[i][1]))));
      lectura.set([
        ['deriva en el intervalo', `${VIZ.fmt(est.rho * 1e-6 * est.intervalo * 60 * 1000, 3)} ms`],
        ['cota de desfase con UTC', `${VIZ.fmt(cota, 3)} ms`],
        ['máxima diferencia entre relojes', `${VIZ.fmt(maxDif, 3)} ms`],
        ['cota entre relojes', `${VIZ.fmt(2 * cota, 3)} ms`],
      ]);
    }
    lienzo.alDibujar = () => datos && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!plano || !plano.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(0, Math.min(240, Math.round(plano.ix(x))));
      dibujar();
      tip.mostrar(x, y, `t = <b>${hover} min</b>` + datos.map((d) => VIZ.filaTooltip(d.color, `reloj ${d.n}`, `${VIZ.fmt(d.pts[hover * 2][1], 3)} ms`)).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    calcular();
  }

  /* ---------- Fig. 2: Cristian y Berkeley ---------- */

  function montarAlgoritmos(cuerpo) {
    const est = { alg: 'cristian', semilla: 3 };
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Algoritmo', valor: est.alg, opciones: [['cristian', 'Cristian (servidor de tiempo)'], ['berkeley', 'Berkeley (promedio)']], alCambiar: (v) => { est.alg = v; dibujar(); } });
    ctl.boton('Otras demoras', () => { est.semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (est.alg === 'cristian' ? 190 : 260) + (w < 600 ? 10 : 0) });
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'pedido / consulta', forma: 'linea' }, { color: C.s2, texto: 'respuesta / ajuste', forma: 'linea' },
      { color: C.tinta, texto: 'lectura del reloj local en ese evento', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El eje horizontal es el tiempo real; sobre cada evento, la hora que marca el reloj del proceso (en segundos dentro del minuto). Las demoras de ida y vuelta son distintas y desconocidas.');

    function dibujar() {
      lienzo.ajustar(true);
    }
    lienzo.alDibujar = () => {
      lienzo.limpiar();
      const rnd = VIZ.semilla(est.semilla * 7 + (est.alg === 'cristian' ? 0 : 1));
      const f = (v) => v.toFixed(2);
      if (est.alg === 'cristian') {
        const desfase = 1.2 + rnd() * 2, ida = 0.3 + rnd() * 0.9, vuelta = 0.3 + rnd() * 0.9;
        const t0 = 1, ts = t0 + ida, t1 = ts + vuelta;
        const real = (t) => 20 + t; // hora real (s) del servidor, exacta
        const cli = (t) => 20 + t + desfase;
        const T0 = cli(t0), T1 = cli(t1), Ts = real(ts);
        const nuevo = Ts + (T1 - T0) / 2, error = nuevo - real(t1);
        D.espacioTiempo(lienzo, {
          procesos: ['Cliente', 'Servidor'], t: [0, t1 + 1.5], margenIzq: 64, sup: 34, inf: 34,
          mensajes: [{ p0: 0, t0, p1: 1, t1: ts, color: C.s1, ancho: 2 }, { p0: 1, t0: ts, p1: 0, t1, color: C.s2, ancho: 2, texto: `T = ${f(Ts)}` }],
          eventos: [
            { p: 0, t: t0, texto: `T₀ = ${f(T0)}`, fijo: true }, { p: 1, t: ts, texto: `T = ${f(Ts)}`, abajo: true, fijo: true },
            { p: 0, t: t1, texto: `T₁ = ${f(T1)} → ${f(nuevo)}`, relleno: C.s2, fijo: true },
          ],
        });
        registro.textContent = `El cliente estima que la respuesta tardó la mitad del viaje: T + (T₁ − T₀)/2 = ${f(Ts)} + ${f((T1 - T0) / 2)} = ${f(nuevo)}. ` +
          `Como la ida (${f(ida)} s) y la vuelta (${f(vuelta)} s) no son iguales, queda un error de ${f(error)} s, siempre menor que (T₁ − T₀)/2.`;
        lectura.set([
          ['desfase antes', `${f(desfase)} s`],
          ['ida y vuelta T₁ − T₀', `${f(T1 - T0)} s`],
          ['error después', `${f(error)} s`],
          ['cota ±(T₁ − T₀)/2', `${f((T1 - T0) / 2)} s`],
        ]);
      } else {
        const n = 4;
        const desf = Array.from({ length: n }, () => (rnd() * 2 - 1) * 3);
        desf[n - 1] += 12; // un reloj muy desviado
        const lect = (p, t) => 20 + t + desf[p];
        const tc = 0.6, msgs = [], evs = [{ p: 0, t: tc, texto: f(lect(0, tc)), fijo: true }];
        const difs = [0];
        for (let p = 1; p < n; p++) {
          const ida = 0.3 + rnd() * 0.5, vuelta = 0.3 + rnd() * 0.5, tp = tc + ida, tv = tp + vuelta;
          msgs.push({ p0: 0, t0: tc, p1: p, t1: tp, color: C.s1, ancho: 1.6 });
          msgs.push({ p0: p, t0: tp, p1: 0, t1: tv, color: C.s1, ancho: 1.6, guiones: [4, 3] });
          evs.push({ p, t: tp, texto: f(lect(p, tp)), fijo: true });
          // El maestro supone que la respuesta tardó la mitad de la ida y vuelta.
          difs.push(lect(p, tp) + (tv - tc) / 2 - lect(0, tv));
        }
        const orden = difs.slice().sort((x, y) => x - y), mediana = (orden[1] + orden[2]) / 2;
        const usados = difs.filter((d) => Math.abs(d - mediana) < 6);
        const prom = usados.reduce((x, y) => x + y, 0) / usados.length;
        const tAj = 3.2;
        const ajuste = difs.map((d) => prom - d);
        for (let p = 1; p < n; p++) msgs.push({ p0: 0, t0: tAj, p1: p, t1: tAj + 0.5 + 0.1 * p, color: C.s2, ancho: 2, texto: `${ajuste[p] >= 0 ? '+' : '−'}${f(Math.abs(ajuste[p]))}` });
        evs.push({ p: 0, t: tAj, texto: `ajuste ${ajuste[0] >= 0 ? '+' : '−'}${f(Math.abs(ajuste[0]))}`, relleno: C.s2, fijo: true });
        D.espacioTiempo(lienzo, {
          procesos: ['Maestro', ...Array.from({ length: n - 1 }, (_, i) => `Esclavo ${i + 1}`)], t: [0, 4.6], margenIzq: 70, sup: 30, inf: 24,
          mensajes: msgs, eventos: evs,
        });
        const despues = desf.map((d, p) => d + ajuste[p]);
        const rango = (v) => Math.max(...v) - Math.min(...v);
        registro.textContent = `El maestro estima las diferencias de cada reloj con el suyo (${difs.slice(1).map((d) => (d >= 0 ? '+' : '−') + f(Math.abs(d))).join(', ')} s), descarta el muy desviado y promedia el resto: ${prom >= 0 ? '+' : '−'}${f(Math.abs(prom))} s. A cada uno le envía cuánto ajustar, no una hora absoluta, para que la demora del aviso no importe.`;
        lectura.set([
          ['diferencia máxima antes', `${f(rango(desf))} s`],
          ['relojes promediados', `${usados.length} de ${n}`],
          ['diferencia máxima después', `${f(rango(despues))} s`],
        ]);
      }
    };
    dibujar();
  }

  VIZ.registrarTema('clock-synchronization', {
    intro: String.raw`
      <p>Cada computador mide el tiempo con un oscilador de cuarzo que no es perfecto: avanza un poco más rápido o más lento que el tiempo real, típicamente entre
      10 y 100 partes por millón (de un segundo a casi diez por día). Dos relojes que alguna vez coincidieron se separan sin límite: es la <strong>deriva</strong>.
      Para registrar eventos, ordenar archivos o expirar <em>leases</em> entre máquinas, hay que resincronizarlos periódicamente.</p>
      <p>Sincronizar por la red tiene un problema de fondo: el mensaje que trae la hora tarda un tiempo desconocido. Los algoritmos de
      <strong>Cristian</strong> y <strong>NTP</strong> estiman esa demora con la ida y vuelta; el de <strong>Berkeley</strong> no busca la hora exacta sino que todos
      coincidan entre sí. Cuando basta el orden de los eventos, los <a href="tema.html?id=lamport-clocks">relojes lógicos</a> evitan el problema.</p>`,
    visualizaciones: [
      {
        titulo: 'Deriva y resincronización',
        descripcion: 'Cada reloj se desvía a su propio ritmo y se corrige en cada sincronización. Alargue el intervalo o aumente la deriva y observe cómo crece la banda; aumente la ida y vuelta y verá que no se puede bajar de ±RTT/2.',
        montar: montarDeriva,
      },
      {
        titulo: 'Cristian y Berkeley',
        descripcion: 'Con Cristian, el cliente corrige su hora con la del servidor más la mitad del viaje. Con Berkeley, un maestro promedia las diferencias de todos, ignorando los relojes muy desviados.',
        montar: montarAlgoritmos,
      },
    ],
    teoria: String.raw`
      <h2>Deriva</h2>
      <p>Si \(C(t)\) es la lectura del reloj en el tiempo real \(t\), un reloj con deriva máxima \(\rho\) cumple</p>
      \[ 1 - \rho \le \frac{dC}{dt} \le 1 + \rho. \]
      <p>Dos relojes con derivas opuestas se separan hasta \(2\rho\Delta\) en un intervalo \(\Delta\). Para que nunca difieran en más de \(\delta\), hay que resincronizar al
      menos cada \(\Delta = \delta / (2\rho)\). Un reloj nunca debe retroceder: si va adelantado, se lo hace avanzar más lento hasta alcanzar la hora correcta.</p>

      <h2>Algoritmo de Cristian (1989)</h2>
      <p>El cliente anota \(T_0\), pide la hora, recibe \(T\) del servidor y anota \(T_1\). Supone que la respuesta tardó la mitad de la ida y vuelta:</p>
      \[ C \leftarrow T + \frac{T_1 - T_0}{2}, \qquad |\text{error}| \le \frac{T_1 - T_0}{2} - t_{\min}, \]
      <p>donde \(t_{\min}\) es la demora mínima de un mensaje. Repetir y quedarse con la ida y vuelta más corta da la mejor cota.</p>

      <h2>NTP</h2>
      <p>NTP intercambia cuatro marcas \(T_1\) (envío del cliente), \(T_2\) (llegada al servidor), \(T_3\) (envío del servidor), \(T_4\) (llegada al cliente) y estima</p>
      \[ \theta = \frac{(T_2 - T_1) + (T_3 - T_4)}{2}, \qquad \delta = (T_4 - T_1) - (T_3 - T_2), \]
      <p>desfase y demora, descontando el tiempo de proceso del servidor. Organiza los servidores en estratos (estrato 1 conectado a relojes atómicos o GPS) y filtra
      varias muestras. Logra unos milisegundos en Internet y menos de uno en una red local.</p>

      <h2>Algoritmo de Berkeley (1989)</h2>
      <p>Sin una fuente de hora exacta, un maestro consulta los relojes de todos, estima sus diferencias con la ida y vuelta, descarta los que se alejan demasiado y
      envía a cada uno el ajuste para llevarlo al promedio. El resultado es <em>sincronización interna</em> (todos coinciden) sin <em>sincronización externa</em> (con UTC).</p>
      <table>
        <tr><th>Algoritmo</th><th>Referencia</th><th>Sincronización</th></tr>
        <tr><td>Cristian</td><td>Un servidor con hora exacta</td><td>Externa</td></tr>
        <tr><td>Berkeley</td><td>El promedio del grupo</td><td>Interna</td></tr>
        <tr><td>NTP</td><td>Jerarquía de servidores, UTC</td><td>Externa</td></tr>
        <tr><td>PTP (IEEE 1588)</td><td>Reloj maestro, marcas en hardware</td><td>Externa, submicrosegundo</td></tr>
      </table>
      <p>Google Spanner usa relojes atómicos y GPS y expone la incertidumbre como un intervalo \([t - \varepsilon, t + \varepsilon]\), esperando \(\varepsilon\) antes de confirmar
      para que el orden de las marcas coincida con el real.</p>`,
  });
})();
