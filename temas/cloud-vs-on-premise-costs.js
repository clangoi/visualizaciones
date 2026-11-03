(function () {
  'use strict';
  const { color: C } = VIZ;

  // Supuestos (USD, por vCPU): iguales en las tres figuras y en la teoría.
  const HORAS = 8760;
  const DESC = { demanda: 0, res1: 0.35, res3: 0.55 };
  const NOMBRE_NUBE = { demanda: 'nube bajo demanda', res1: 'nube reservada a 1 año', res3: 'nube reservada a 3 años' };
  const usd = (v) => `$${VIZ.entero(v)}`;

  const localAnual = (p) => p.capex / p.vida + p.capex * p.opex;           // costo anual equivalente por vCPU
  const nubeAnual = (p, u, op) => (op === 'demanda' ? u * HORAS * p.precio : HORAS * p.precio * (1 - DESC[op])); // las reservas se pagan use o no

  /* ---------- Fig. 1: costo acumulado ---------- */

  function montarAcumulado(cuerpo) {
    const P = { capex: 600, vida: 5, opex: 0.25, precio: 0.045 };
    let vcpu = 100, util = 0.4, anios = 5, op = 'demanda', pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Capacidad contratada', min: 20, max: 400, paso: 10, valor: vcpu, formato: (v) => `${v} vCPU`, alCambiar: (v) => { vcpu = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Utilización media', min: 5, max: 100, paso: 5, valor: util * 100, formato: (v) => `${v} %`, alCambiar: (v) => { util = v / 100; dibujar(); } });
    ctl.rango({ etiqueta: 'Horizonte', min: 1, max: 8, valor: anios, formato: (v) => `${v} años`, alCambiar: (v) => { anios = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Compromiso en la nube', opciones: Object.entries(NOMBRE_NUBE), valor: op, alCambiar: (v) => { op = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'local: inversión inicial (CAPEX) y gasto anual (OPEX)', forma: 'linea' },
      { color: C.s2, texto: 'nube: solo gasto operativo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Costos por vCPU: servidor propio 600 con vida útil de 5 años y 25 % anual de operación; nube a 0,045 por hora. El local parte con un salto (la compra) y se repite al cumplirse la vida útil. Cambie la utilización y vea si se cruzan las curvas. Pase el cursor para ver cada año.');

    const local = (t) => vcpu * P.capex * (1 + Math.floor(t / P.vida - 1e-9) * (t > 0 ? 1 : 0)) + vcpu * P.capex * P.opex * t;
    const nube = (t) => vcpu * nubeAnual(P, util, op) * t;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const pts = (f) => { const a = []; for (let t = 0; t <= anios + 1e-9; t += 0.05) a.push([t, f(t)]); return a; };
      const ymax = Math.max(local(anios), nube(anios), 1) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: anios, ymin: 0, ymax }, { etiquetaX: 'años', etiquetaY: 'costo acumulado (USD)', formatoY: (v) => VIZ.entero(v), formatoX: (v) => String(v) });
      pl.ejes();
      VIZ.trazar(ctx, pl, pts(local), C.s1, 2.5);
      VIZ.trazar(ctx, pl, pts(nube), C.s2, 2.5);
      let eq = null;
      for (let t = 0.05; t <= anios + 1e-9; t += 0.05) if (nube(t) > local(t) && nube(t - 0.05) <= local(t - 0.05)) { eq = t; break; }
      if (eq !== null) { VIZ.marcador(ctx, pl.sx(eq), pl.sy(nube(eq)), C.tinta, 5); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`equilibrio: ${VIZ.fmt(eq, 3)} años`, pl.sx(eq) + 8, pl.sy(nube(eq)) - 6); }
      if (hover >= 0) { VIZ.marcador(ctx, pl.sx(hover), pl.sy(local(hover)), C.s1, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(nube(hover)), C.s2, 4); }
      const L = local(anios), N = nube(anios);
      registro.textContent = eq !== null
        ? `La nube sale más barata hasta los ${VIZ.fmt(eq, 3)} años; después, el servidor propio ya amortizó su compra y resulta más económico. A ${anios} años: local ${usd(L)}, nube ${usd(N)}.`
        : (N <= L ? `En ${anios} años la nube cuesta ${usd(N)} frente a ${usd(L)} en local: nunca se cruzan y la nube es más barata en todo el horizonte.` : `La nube cuesta ${usd(N)} frente a ${usd(L)} en local: con esta utilización el servidor propio es más barato desde el principio... salvo el primer año, en que debe pagar la compra completa.`);
      lectura.set([
        ['inversión inicial local (CAPEX)', usd(vcpu * P.capex)],
        ['operación local por año (OPEX)', usd(vcpu * P.capex * P.opex)],
        ['nube por año', usd(vcpu * nubeAnual(P, util, op))],
        [`costo total a ${anios} años`, `local ${usd(L)} · nube ${usd(N)}`],
        ['diferencia (nube − local)', `${N - L < 0 ? '−' : '+'}${usd(Math.abs(N - L))}`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const t = Math.max(0, Math.round(pl.ix(x) * 4) / 4);
      if (t !== hover) { hover = t; dibujar(); }
      tip.mostrar(x, y, `año <b>${VIZ.fmt(t, 3)}</b>` + VIZ.filaTooltip(C.s1, 'local', usd(local(t))) + VIZ.filaTooltip(C.s2, 'nube', usd(nube(t))));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: punto de equilibrio según utilización ---------- */

  function montarEquilibrio(cuerpo) {
    const P = { capex: 600, vida: 5, opex: 0.25, precio: 0.045 };
    let u = 0.5, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Utilización media de la capacidad', min: 0, max: 100, paso: 5, valor: u * 100, formato: (v) => `${v} %`, alCambiar: (v) => { u = v / 100; dibujar(); } });
    ctl.rango({ etiqueta: 'Precio local por vCPU', min: 300, max: 1200, paso: 50, valor: P.capex, formato: (v) => usd(v), alCambiar: (v) => { P.capex = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Operación local (por año)', min: 10, max: 40, valor: P.opex * 100, formato: (v) => `${v} % de la compra`, alCambiar: (v) => { P.opex = v / 100; dibujar(); } });
    ctl.rango({ etiqueta: 'Vida útil del equipo', min: 3, max: 7, valor: P.vida, formato: (v) => `${v} años`, alCambiar: (v) => { P.vida = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Precio de la nube por vCPU-hora', min: 0.02, max: 0.1, paso: 0.005, valor: P.precio, formato: (v) => String(v).replace('.', ','), alCambiar: (v) => { P.precio = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    const SER = [['local', 'servidor propio', C.s1], ['demanda', 'nube bajo demanda', C.s2], ['res1', 'nube reservada a 1 año', C.s3], ['res3', 'nube reservada a 3 años', C.s4]];
    VIZ.leyenda(cuerpo, SER.map(([, t, c]) => ({ color: c, texto: t, forma: 'linea' })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea es el costo anual de una vCPU. El servidor propio y las reservas cuestan lo mismo se use o no; el bajo demanda crece con el uso. Mueva la utilización y los precios para ver dónde cambia la opción más barata. Pase el cursor sobre el gráfico.');

    const costo = (k, x) => (k === 'local' ? localAnual(P) : nubeAnual(P, x, k));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(nubeAnual(P, 1, 'demanda'), localAnual(P)) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 1, ymin: 0, ymax }, { etiquetaX: 'utilización media', etiquetaY: 'USD por vCPU al año', formatoX: (v) => `${Math.round(v * 100)} %`, formatoY: (v) => VIZ.entero(v), ticksX: [0, 0.2, 0.4, 0.6, 0.8, 1] });
      pl.ejes();
      SER.forEach(([k, , c]) => VIZ.trazar(ctx, pl, [[0, costo(k, 0)], [1, costo(k, 1)]], c, 2.5));
      const eq = localAnual(P) / nubeAnual(P, 1, 'demanda');
      if (eq <= 1) { VIZ.marcador(ctx, pl.sx(eq), pl.sy(localAnual(P)), C.tinta, 5); ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`${VIZ.fmt(eq * 100, 3)} %`, pl.sx(eq) + 8, pl.sy(localAnual(P)) - 6); }
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl.sx(u), pl.y0); ctx.lineTo(pl.sx(u), pl.y1); ctx.stroke(); ctx.setLineDash([]);
      const vals = SER.map(([k, t]) => [k, t, costo(k, u)]), mejor = vals.reduce((m, v) => (v[2] < m[2] ? v : m));
      registro.textContent = eq <= 1
        ? `Contra la nube bajo demanda, el servidor propio empieza a convenir desde ${VIZ.fmt(eq * 100, 3)} % de utilización. A ${Math.round(u * 100)} %, lo más barato es ${mejor[1]} (${usd(mejor[2])} por vCPU al año).`
        : `Con estos precios la nube bajo demanda es más barata que el servidor propio incluso a utilización completa. A ${Math.round(u * 100)} %, lo más barato es ${mejor[1]}.`;
      lectura.set([
        ['costo anual del servidor propio', `${usd(localAnual(P))} por vCPU`],
        ['utilización de equilibrio (bajo demanda)', eq <= 1 ? `${VIZ.fmt(eq * 100, 3)} %` : 'sin cruce'],
        ...vals.slice(1).map(([k, t, v]) => [`${t} a ${Math.round(u * 100)} %`, usd(v)]),
        ['opción más barata', mejor[1]],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const v = Math.max(0, Math.min(1, pl.ix(x)));
      tip.mostrar(x, y, `utilización <b>${VIZ.fmt(v * 100, 3)} %</b>` + SER.map(([k, t, c]) => VIZ.filaTooltip(c, t, usd(costo(k, v)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 3: carga constante o variable ---------- */

  const SEMANAS = 52;
  const PERFILES = {
    constante: { t: 'Constante (sistema de producción 24×7)', factor: 1.1 },
    diurna: { t: 'Diurna (oficina: picos en horario laboral)', factor: 2.8 },
    campana: { t: 'Estacional (campañas y temporada alta)', factor: 1.3 },
    esporadica: { t: 'Con picos esporádicos (cierres, pruebas)', factor: 1.5 },
  };
  function generar(perfil, semilla) {
    const rnd = VIZ.semilla(semilla * 53 + 7), nor = () => VIZ.normal(rnd);
    return Array.from({ length: SEMANAS }, (_, w) => {
      let v;
      if (perfil === 'constante') v = 60 + 3 * nor();
      else if (perfil === 'diurna') v = 36 + 3 * nor();
      else if (perfil === 'campana') v = 25 + 70 * Math.exp(-(((w - 47) / 3) ** 2)) + 35 * Math.exp(-(((w - 20) / 2.5) ** 2)) + 3 * nor();
      else v = 20 + 2 * nor() + (rnd() < 0.12 ? 25 + 45 * rnd() : 0);
      return Math.max(5, v);
    });
  }

  function montarPerfil(cuerpo) {
    const P = { capex: 600, vida: 5, opex: 0.25, precio: 0.045 };
    let perfil = 'campana', semilla = 1, reserva = 25, serie = [], pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Perfil de carga', opciones: Object.entries(PERFILES).map(([k, v]) => [k, v.t]), valor: perfil, alCambiar: (v) => { perfil = v; nuevo(false); } });
    const rr = ctl.rango({ etiqueta: 'Capacidad reservada en la nube (1 año)', min: 0, max: 140, paso: 5, valor: reserva, formato: (v) => `${v} vCPU`, alCambiar: (v) => { reserva = v; dibujar(); } });
    ctl.boton('Nuevo año', () => { semilla++; nuevo(false); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'carga media de cada semana' },
      { color: C.tinta, texto: 'capacidad local (dimensionada para el pico)', forma: 'linea' },
      { color: C.s3, texto: 'capacidad reservada en la nube', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El servidor propio debe cubrir el pico (la carga media semanal por el factor de pico del perfil); la nube cobra lo que se usa. La reserva (35 % más barata) se paga siempre, y lo que la excede se paga bajo demanda. Elija un perfil, busque a mano la mejor reserva y compare con la óptima.');

    const pico = () => Math.max(...serie) * PERFILES[perfil].factor;
    const costoLocal = () => pico() * localAnual(P);
    const costoDemanda = () => serie.reduce((s, v) => s + v * 168 * P.precio, 0);
    const costoMixto = (R) => R * HORAS * P.precio * (1 - DESC.res1) + serie.reduce((s, v) => s + Math.max(0, v - R) * 168 * P.precio, 0);
    function nuevo(mantener) {
      serie = generar(perfil, semilla);
      if (!mantener) { reserva = Math.round(Math.min(...serie) / 5) * 5; rr.valor = reserva; rr.refrescar(); }
      dibujar();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(pico(), reserva, ...serie) * 1.1;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: SEMANAS, ymin: 0, ymax }, { etiquetaX: 'semana del año', etiquetaY: 'vCPU', ticksX: [0, 13, 26, 39, 52] });
      pl.ejes();
      serie.forEach((v, w) => {
        const x = pl.sx(w) + 1, wd = pl.sx(w + 1) - pl.sx(w) - 2, y = pl.sy(v);
        ctx.fillStyle = w === hover ? VIZ.alfa(C.s1, 0.7) : C.s1;
        ctx.beginPath(); ctx.roundRect(x, y, Math.max(1, wd), pl.y0 - y, [3, 3, 0, 0]); ctx.fill();
      });
      VIZ.trazar(ctx, pl, [[0, pico()], [SEMANAS, pico()]], C.tinta, 2);
      VIZ.trazar(ctx, pl, [[0, reserva], [SEMANAS, reserva]], C.s3, 2, [6, 3]);
      let mejorR = 0, mejorC = Infinity;
      for (let R = 0; R <= Math.max(...serie); R += 1) { const c = costoMixto(R); if (c < mejorC) { mejorC = c; mejorR = R; } }
      const opciones = [['servidor propio', costoLocal()], ['nube bajo demanda', costoDemanda()], [`nube con ${reserva} vCPU reservadas`, costoMixto(reserva)]];
      const gana = opciones.reduce((m, o) => (o[1] < m[1] ? o : m));
      const media = serie.reduce((s, v) => s + v, 0) / SEMANAS;
      registro.textContent = `Utilización media del servidor propio: ${VIZ.fmt(100 * media / pico(), 3)} % (pico ${VIZ.fmt(pico(), 3)} vCPU, media ${VIZ.fmt(media, 3)}). Lo más barato es ${gana[0]} (${usd(gana[1])} al año). La mejor reserva sería de ${mejorR} vCPU (${usd(mejorC)}).`;
      lectura.set([
        ['servidor propio (capacidad para el pico)', usd(opciones[0][1])],
        ['nube bajo demanda', usd(opciones[1][1])],
        [`nube con ${reserva} vCPU reservadas`, usd(opciones[2][1])],
        ['mejor reserva posible', `${mejorR} vCPU → ${usd(mejorC)}`],
        ['utilización del servidor propio', `${VIZ.fmt(100 * media / pico(), 3)} %`],
      ]);
    }
    lienzo.alDibujar = () => serie.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const w = Math.max(0, Math.min(SEMANAS - 1, Math.floor(pl.ix(x))));
      if (w !== hover) { hover = w; dibujar(); }
      tip.mostrar(x, y, `semana <b>${w + 1}</b>` + VIZ.filaTooltip(C.s1, 'carga media', VIZ.fmt(serie[w], 3) + ' vCPU') + `<div>bajo demanda: <b>${usd(serie[w] * 168 * P.precio)}</b></div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (serie.length) dibujar(); });
    nuevo(false);
  }

  VIZ.registrarTema('cloud-vs-on-premise-costs', {
    intro: String.raw`
      <p>Comprar servidores propios y arrendar capacidad en la nube son dos formas distintas de pagar por lo mismo. Lo primero es un gasto de capital (<strong>CAPEX</strong>): una inversión grande al inicio que se amortiza durante la vida útil del equipo.
      Lo segundo es un gasto operativo (<strong>OPEX</strong>): pagos periódicos proporcionales al uso. Cambia la contabilidad, pero sobre todo cambia quién carga con el riesgo de equivocarse en el tamaño.</p>
      <p>Para comparar hay que mirar el <em>costo total de propiedad</em> (TCO) y el perfil de uso: un servidor propio cuesta lo mismo esté ocupado o ocioso, y por eso conviene a cargas constantes y altamente utilizadas; la nube cobra por lo que se usa y conviene a cargas variables o inciertas.</p>`,
    visualizaciones: [
      {
        titulo: 'CAPEX y OPEX en el tiempo',
        descripcion: 'Compare el costo acumulado de comprar y de arrendar. Baje la utilización y la nube gana; súbala y el servidor propio termina por alcanzarla. Pruebe las reservas a 1 y 3 años.',
        montar: montarAcumulado,
      },
      {
        titulo: 'Punto de equilibrio según utilización',
        descripcion: 'Cada línea es el costo anual de una vCPU. Busque el cruce entre el servidor propio y la nube bajo demanda, y cambie los precios para ver cómo se mueve.',
        montar: montarEquilibrio,
      },
      {
        titulo: 'Carga constante o variable',
        descripcion: 'Elija un perfil de carga y compare servidor propio (dimensionado para el pico), nube bajo demanda y nube con una reserva. Busque a mano la reserva que minimiza el costo.',
        montar: montarPerfil,
      },
    ],
    teoria: String.raw`
      <h2>CAPEX, OPEX y costo total de propiedad</h2>
      <p>El <em>CAPEX</em> es la inversión inicial (servidores, licencias, instalación); el <em>OPEX</em>, el gasto recurrente (energía, espacio, soporte, personal, o la factura mensual de la nube). El TCO suma todo lo que cuesta tener y operar la solución durante un horizonte \(H\):</p>
      \[ \mathrm{TCO}_{\text{local}}(H) = K\left(1 + \left\lfloor \tfrac{H}{V} \right\rfloor\right) + o\,K\,H, \qquad \mathrm{TCO}_{\text{nube}}(H) = H \cdot 8\,760\; p\; u\; n, \]
      <p>donde \(K\) es la inversión en compra, \(V\) la vida útil (se repite la compra al renovar), \(o\) la fracción anual de operación, \(p\) el precio por vCPU-hora, \(u\) la utilización media y \(n\) las vCPU. En la nube con reserva se paga \(8\,760\,p\,(1-d)\) por vCPU aunque no se use, con descuento \(d\).</p>
      <h2>Punto de equilibrio</h2>
      <p>Por vCPU, el servidor propio cuesta al año \(c_L = K/V + oK\) (por ejemplo 600/5 + 0,25 · 600 = 270). La nube bajo demanda cuesta \(8\,760\,p\,u\). Ambas se igualan en</p>
      \[ u^{*} = \frac{c_L}{8\,760\,p} = \frac{270}{394{,}2} \approx 68{,}5\,\%. \]
      <p>Con utilización menor, la nube bajo demanda es más barata; con mayor, el servidor propio. Una reserva a 1 año cuesta \(394{,}2 \times 0{,}65 = 256{,}2\) por vCPU, y a 3 años \(394{,}2 \times 0{,}45 = 177{,}4\): menos que lo propio si la carga es estable y se usa gran parte del año.</p>
      <h2>Ejemplo resuelto</h2>
      <p>100 vCPU a 40 % de utilización durante 5 años: servidor propio, \(60\,000 + 5 \times 15\,000 = 135\,000\) USD; nube bajo demanda, \(100 \times 0{,}4 \times 394{,}2 = 15\,768\) USD por año, o sea \(78\,840\) USD. La nube ahorra cerca de 42 %. Con 90 % de utilización pasa lo contrario: \(35\,478\) USD al año en la nube (177 390 en cinco años) frente a 135 000 propios.</p>
      <h2>Carga variable</h2>
      <p>El servidor propio se dimensiona para el pico \(P\) y su costo es \(P\,c_L\) aunque el promedio sea mucho menor; su utilización es \(\bar{d}/P\). En la nube bajo demanda el costo es proporcional al área bajo la curva de carga. Con una reserva \(R\) (descuento \(d\)), el costo es</p>
      \[ C(R) = R\cdot 8\,760\,p\,(1-d) + p\sum_{s} 168\,\max(0,\, d_s - R), \]
      <p>donde \(d_s\) es la carga media de la semana \(s\). El mínimo está donde reservar una vCPU adicional deja de compensar: cuando la carga supera \(R\) menos de la fracción \(1-d\) del año. Así, lo estable se reserva, lo variable se paga por uso y los picos se dejan a la elasticidad.</p>
      <div class="recuadro"><p><strong>Cuidado.</strong> El TCO real incluye costos que la figura no modela: personal, licencias, migración, transferencia de datos, riesgo de dependencia de un proveedor y el valor de poder crecer o reducirse sin comprar. Los precios cambian con el tiempo: la comparación debe revisarse cada vez que se renueva la plataforma.</p></div>
      <h2>Evolución de plataformas</h2>
      <p>Hace dos décadas todo era CAPEX; la virtualización permitió aprovechar mejor cada equipo, la nube pública volvió OPEX el cómputo y hoy conviven los modelos híbridos. Cada paso movió la decisión desde «cuánto comprar» hacia «cuánto reservar y cuánto pagar por uso».</p>
      <h2>Conexiones</h2>
      <p>Qué capas administra el proveedor se estudia en <a href="tema.html?id=cloud-service-models">IaaS, PaaS y SaaS</a>; el ahorro de consolidar en <a href="tema.html?id=virtualization">virtualización</a>; el costo de la redundancia en
      <a href="tema.html?id=scalability-availability">escalabilidad y disponibilidad</a>; y la gestión del ciclo de vida del equipo en <a href="tema.html?id=infrastructure-administration">administración de infraestructura</a>.</p>`,
  });
})();
