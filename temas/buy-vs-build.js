(function () {
  'use strict';
  const { color: C } = VIZ;

  /* Modelo de costos en miles de USD. Persona-mes: 9. Paquete: licencia por usuario-año con alza anual, implementación de 40,
     costo de la brecha (trabajo manual por lo que el paquete no cubre) y, si se personaliza, costo único y mantenimiento de la personalización.
     A medida: desarrollo, mantenimiento anual del 18 % y 12 de infraestructura. El retraso hasta producción cuesta U × 0,08 por mes. */
  const PM_COSTO = 9, LIC = 0.55, MANUAL = 0.9, RETRASO = 0.08, TASA = 0.08;
  const OPC = [
    { id: 'comprar', n: 'Comprar el paquete', c: C.s1 },
    { id: 'personalizar', n: 'Comprar y personalizar', c: C.s2 },
    { id: 'medida', n: 'Desarrollar a medida', c: C.s3 },
  ];

  function modelo({ U, a, PM, p }) {
    const retraso = (m) => m * U * RETRASO, cc = (1 - a) * PM * PM_COSTO, mc = ((1 - a) * PM) / 6;
    const lic = (t) => LIC * U * Math.pow(1 + p, t - 1);
    const f = {
      comprar: (t) => (t === 0 ? 40 + retraso(3) : lic(t) + (1 - a) * U * MANUAL),
      personalizar: (t) => (t === 0 ? 40 + cc + retraso(3 + mc) : lic(t) + 0.15 * cc + 0.1 * (1 - a) * U * MANUAL),
      medida: (t) => (t === 0 ? PM * PM_COSTO + retraso(PM / 6) : 0.18 * PM * PM_COSTO + 12),
    };
    const meses = { comprar: 3, personalizar: 3 + mc, medida: PM / 6 }, ajuste = { comprar: a, personalizar: Math.min(1, a + 0.9 * (1 - a)), medida: 1 };
    const acum = {};
    OPC.forEach((o) => {
      let s = 0;
      acum[o.id] = Array.from({ length: 11 }, (_, t) => { s += f[o.id](t) / Math.pow(1 + TASA, t); return s; });
    });
    return { f, acum, meses, ajuste };
  }
  // Primer instante (años, interpolado) en que A cuesta menos que B acumulado; null si no ocurre en 10 años.
  function cruce(A, B) {
    if (A[0] <= B[0]) return 0;
    for (let t = 1; t <= 10; t++) if (A[t] <= B[t]) return t - 1 + (A[t - 1] - B[t - 1]) / ((A[t - 1] - B[t - 1]) - (A[t] - B[t]));
    return null;
  }
  const k$ = (v) => `${VIZ.entero(v)} mil`;

  /* ---------- Fig. 1: costo total a varios años ---------- */

  function montarCostoTotal(cuerpo) {
    let U = 500, a = 0.75, PM = 80, p = 0.05, H = 5, m = null, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Usuarios', min: 50, max: 1000, paso: 50, valor: U, formato: (v) => String(v), alCambiar: (v) => { U = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ajuste del paquete a los requerimientos', min: 0.4, max: 0.95, paso: 0.05, valor: a, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { a = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tamaño del sistema a medida', min: 30, max: 200, paso: 10, valor: PM, formato: (v) => `${v} persona-mes`, alCambiar: (v) => { PM = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Alza anual de la licencia', min: 0, max: 0.15, paso: 0.01, valor: p, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { p = v; dibujar(); } });
    const rH = ctl.rango({ etiqueta: 'Horizonte de evaluación', min: 1, max: 10, valor: H, formato: (v) => `${v} años`, alCambiar: (v) => { H = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, OPC.map((o) => ({ color: o.c, texto: o.n, forma: 'linea' })).concat([{ color: C.tinta, texto: 'horizonte elegido', forma: 'linea' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Costo total de propiedad acumulado en miles de USD, descontado al 8 % anual (el año 0 incluye implementación y el costo del retraso hasta producción). Haga clic en el gráfico para fijar el horizonte; pase el cursor para ver cada opción.');

    function dibujar() {
      m = modelo({ U, a, PM, p });
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...OPC.map((o) => m.acum[o.id][10])) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 10, ymin: 0, ymax }, { etiquetaX: 'años', etiquetaY: 'costo acumulado (miles de USD)', formatoY: (v) => VIZ.entero(v), formatoX: (v) => String(Math.round(v)), ticksX: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
      pl.ejes();
      OPC.forEach((o) => VIZ.trazar(ctx, pl, m.acum[o.id].map((v, t) => [t, v]), o.c, 2.5));
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.sx(H), pl.y1); ctx.lineTo(pl.sx(H), pl.y0); ctx.stroke();
      OPC.forEach((o) => VIZ.marcador(ctx, pl.sx(H), pl.sy(m.acum[o.id][H]), o.c, 4.5));
      const x1 = cruce(m.acum.medida, m.acum.comprar), x2 = cruce(m.acum.personalizar, m.acum.comprar);
      [[x1, m.acum.medida, C.s3], [x2, m.acum.personalizar, C.s2]].forEach(([x, serie, col]) => {
        if (x == null || x <= 0 || x > 10) return;
        const t0 = Math.floor(x), y = serie[t0] + (serie[Math.min(10, t0 + 1)] - serie[t0]) * (x - t0);
        VIZ.marcador(ctx, pl.sx(x), pl.sy(y), col, 5, 3);
      });
      const orden = OPC.map((o) => ({ ...o, v: m.acum[o.id][H] })).sort((u, w) => u.v - w.v);
      registro.textContent = `A ${H} año(s) lo más barato es «${orden[0].n.toLowerCase()}» (${k$(orden[0].v)} USD en valor presente), ${VIZ.fmt((100 * (orden[1].v - orden[0].v)) / orden[1].v, 2)} % menos que la siguiente. `
        + (x1 != null ? (x1 > 0 ? `Desarrollar a medida sale más barato que comprar desde el año ${VIZ.fmt(x1, 3)} (rombo).` : 'Desarrollar a medida es más barato desde el comienzo.') : 'En 10 años desarrollar a medida no llega a compensar su inversión inicial.');
      lectura.set([
        ...OPC.map((o) => [`costo a ${H} años · ${o.n.toLowerCase()}`, k$(m.acum[o.id][H])]),
        ['punto de equilibrio: medida contra comprar', x1 == null ? 'no en 10 años' : x1 === 0 ? 'desde el inicio' : `año ${VIZ.fmt(x1, 3)}`],
        ['punto de equilibrio: personalizar contra comprar', x2 == null ? 'no en 10 años' : x2 === 0 ? 'desde el inicio' : `año ${VIZ.fmt(x2, 3)}`],
        ['puesta en producción', `${VIZ.fmt(m.meses.comprar, 2)} / ${VIZ.fmt(m.meses.personalizar, 2)} / ${VIZ.fmt(m.meses.medida, 2)} meses`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return;
      H = Math.max(1, Math.min(10, Math.round(pl.ix(x)))); rH.valor = H; dibujar();
    });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !m || !pl.dentro(x, y)) return tip.ocultar();
      const t = Math.max(0, Math.min(10, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `año <b>${t}</b>` + OPC.map((o) => VIZ.filaTooltip(o.c, o.n, k$(m.acum[o.id][t]))).join('') + `<div class="fila">gasto del año: ${OPC.map((o) => VIZ.entero(m.f[o.id](t))).join(' / ')}</div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: matriz de decisión ---------- */

  const CRIT = [
    { id: 'costo', n: 'Costo total (5 años)', c: C.s1, w: 8 },
    { id: 'ajuste', n: 'Ajuste a los requerimientos', c: C.s2, w: 6 },
    { id: 'plazo', n: 'Plazo de puesta en marcha', c: C.s3, w: 4 },
    { id: 'indep', n: 'Independencia del proveedor', c: C.s4, w: 3 },
    { id: 'riesgo', n: 'Bajo riesgo de ejecución', c: C.s7, w: 5 },
  ];
  // Valoración cualitativa (1 a 5, mayor es mejor) de lo que no sale del modelo de costos.
  const CUALI = { comprar: { indep: 1.5, riesgo: 4.5 }, personalizar: { indep: 2.5, riesgo: 3 }, medida: { indep: 5, riesgo: 2 } };

  function montarMatriz(cuerpo) {
    let a = 0.75, w = CRIT.map((c) => c.w), pl = null, res = [], geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ajuste del paquete a los requerimientos', min: 0.4, max: 0.95, paso: 0.05, valor: a, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { a = v; dibujar(); } });
    const rs = CRIT.map((c, i) => ctl.rango({ etiqueta: `Peso: ${c.n.toLowerCase()}`, min: 0, max: 10, valor: w[i], formato: (v) => String(v), alCambiar: (v) => { w[i] = v; dibujar(); } }));
    ctl.boton('Solo el costo importa', () => { w = [10, 0, 0, 0, 0]; rs.forEach((r, i) => { r.valor = w[i]; }); dibujar(); });
    ctl.boton('Pesos iniciales', () => { w = CRIT.map((c) => c.w); rs.forEach((r, i) => { r.valor = w[i]; }); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 3 * 62 + 46 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, CRIT.map((c) => ({ color: c.color || c.c, texto: c.n })));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada barra es el puntaje ponderado (0 a 100) de una opción; sus segmentos muestran cuánto aporta cada criterio. Costo, ajuste y plazo salen del modelo de costos (usuarios 500, 80 persona-mes); independencia y riesgo son valoraciones cualitativas típicas. Mueva los pesos y vea cuándo cambia el ganador.');

    function puntajes(pesos) {
      const mod = modelo({ U: 500, a, PM: 80, p: 0.05 });
      const costo = OPC.map((o) => mod.acum[o.id][5]), minC = Math.min(...costo), minM = Math.min(...OPC.map((o) => mod.meses[o.id]));
      const tot = pesos.reduce((s, v) => s + v, 0) || 1;
      return OPC.map((o, i) => {
        const sc = [5 * minC / costo[i], 5 * mod.ajuste[o.id], 5 * minM / mod.meses[o.id], CUALI[o.id].indep, CUALI[o.id].riesgo];
        const parte = sc.map((s, k) => (pesos[k] * s) / tot * 20);
        return { ...o, sc, parte, total: parte.reduce((s, v) => s + v, 0), costo: costo[i] };
      });
    }
    function dibujar() {
      res = puntajes(w);
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const x0 = W < 520 ? 96 : 150, x1 = W - 44, bh = 34;
      geo = [];
      ctx.textBaseline = 'middle';
      res.forEach((r, i) => {
        const y = 14 + i * 62;
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        const partes = r.n.split(' ');
        const mitad = Math.ceil(partes.length / 2);
        ctx.fillText(partes.slice(0, mitad).join(' '), 4, y + bh / 2 - 7); ctx.fillText(partes.slice(mitad).join(' '), 4, y + bh / 2 + 7);
        let x = x0;
        r.parte.forEach((p, k) => {
          const wpx = (p / 100) * (x1 - x0);
          if (wpx > 0.5) { ctx.fillStyle = CRIT[k].c; ctx.fillRect(x, y, wpx, bh); ctx.strokeStyle = C.superficie; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, wpx - 1), bh - 1); }
          geo.push({ x, y, w: wpx, h: bh, r, k, p });
          x += wpx;
        });
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(13, 600); ctx.textAlign = 'left';
        ctx.fillText(VIZ.fmt(r.total, 3), x + 6, y + bh / 2);
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + 0.5, y - 4); ctx.lineTo(x0 + 0.5, y + bh + 4); ctx.stroke();
      });
      const mejor = res.reduce((m, r) => (r.total > m.total ? r : m));
      // Sensibilidad: peso del costo (0 a 10) para el que cambia el ganador, con los demás pesos fijos.
      let cambio = null, ganadorPrev = null;
      for (let c = 0; c <= 10; c += 0.25) {
        const g = puntajes([c, ...w.slice(1)]).reduce((m, r) => (r.total > m.total ? r : m)).id;
        if (ganadorPrev && g !== ganadorPrev && cambio == null) cambio = { c, de: ganadorPrev, a: g };
        ganadorPrev = g;
      }
      const nom = (id) => OPC.find((o) => o.id === id).n.toLowerCase();
      registro.textContent = `Gana «${mejor.n.toLowerCase()}» con ${VIZ.fmt(mejor.total, 3)} puntos. `
        + (cambio ? `Si el peso del costo pasa de ${w[0]} a ${VIZ.fmt(cambio.c, 3)}, el ganador cambia a «${nom(cambio.a)}» (o de «${nom(cambio.de)}»).` : 'Variar el peso del costo entre 0 y 10 no cambia al ganador.');
      lectura.set([
        ...res.map((r) => [`puntaje · ${r.n.toLowerCase()}`, `${VIZ.fmt(r.total, 3)} / 100`]),
        ['ajuste real tras personalizar', `${Math.round(100 * Math.min(1, a + 0.9 * (1 - a)))} %`],
        ['peso del costo que cambia al ganador', cambio ? VIZ.fmt(cambio.c, 3) : 'ninguno'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((q) => q.w > 0.5 && x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.r.n}</b>` + VIZ.filaTooltip(CRIT[g.k].c, CRIT[g.k].n, null) + `<br>puntaje del criterio ${VIZ.fmt(g.r.sc[g.k], 3)} / 5<br>peso ${w[g.k]}<br>aporta <b>${VIZ.fmt(g.p, 3)}</b> puntos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('buy-vs-build', {
    intro: String.raw`
      <p>Cuando una organización necesita un sistema nuevo tiene tres caminos: <strong>comprar</strong> un paquete que ya existe, <strong>comprar y personalizarlo</strong>, o <strong>desarrollarlo a medida</strong>.
      Comprar es más rápido y barato al principio, pero el paquete nunca calza al cien por ciento con los procesos y la licencia se paga todos los años. Desarrollar a medida ajusta perfectamente, pero exige una inversión fuerte, tarda más
      y deja a la organización mantenedora de su propio software.</p>
      <p>La decisión no se resuelve mirando el precio de lista: hay que comparar el <em>costo total de propiedad</em> en el horizonte de uso, el ajuste, el plazo, el riesgo y la dependencia del proveedor.
      Las figuras calculan los costos de las tres opciones y los combinan en una matriz de decisión ponderada.</p>`,
    visualizaciones: [
      {
        titulo: 'Costo total de las tres opciones',
        descripcion: 'Compare el costo acumulado de comprar, personalizar y desarrollar. Suba los usuarios o el alza de la licencia y vea cómo el desarrollo a medida llega antes al punto de equilibrio; baje el ajuste del paquete y mire el costo de la brecha.',
        montar: montarCostoTotal,
      },
      {
        titulo: 'Matriz de decisión ponderada',
        descripcion: 'Cambie la importancia de cada criterio. Con «Solo el costo importa» y con el ajuste en 95 % gana el paquete; dé peso al ajuste y a la independencia del proveedor y observe cuándo el ganador cambia.',
        montar: montarMatriz,
      },
    ],
    teoria: String.raw`
      <h2>Costo total de propiedad</h2>
      <p>El costo total de propiedad (TCO) suma todo lo que cuesta tener el sistema durante su vida útil, en valor presente con tasa de descuento \(r\):</p>
      \[ \text{TCO}(H) = \sum_{t=0}^{H} \frac{I_t + O_t}{(1+r)^t}, \]
      <p>donde \(I_t\) son inversiones y \(O_t\) costos de operación del año \(t\). En las figuras, \(r = 8\,\%\) y los costos están en miles de USD:</p>
      <table>
        <tr><th>Concepto</th><th>Comprar</th><th>Comprar y personalizar</th><th>A medida</th></tr>
        <tr><td>Año 0</td><td>implementación + retraso (3 meses)</td><td>implementación + personalización \((1-a)\cdot PM\cdot 9\) + retraso</td><td>desarrollo \(PM\cdot 9\) + retraso \(PM/6\) meses</td></tr>
        <tr><td>Cada año</td><td>licencia \(0{,}55\,U\,(1+p)^{t-1}\) + brecha \((1-a)\,U\cdot 0{,}9\)</td><td>licencia + 15 % de la personalización + 10 % de la brecha</td><td>18 % del desarrollo + 12 de infraestructura</td></tr>
      </table>
      <p>Aquí \(U\) son los usuarios, \(a\) el ajuste del paquete (fracción de requerimientos que cubre), \(PM\) el tamaño en persona-mes y \(p\) el alza anual de la licencia. El <em>punto de equilibrio</em> entre dos opciones es el primer instante en que el
      TCO acumulado de una pasa a ser menor que el de la otra.</p>
      <h2>Decisión multicriterio</h2>
      <p>Si el criterio \(k\) tiene peso \(w_k\) y la opción \(j\) obtiene puntaje \(s_{jk}\in[0,5]\), el puntaje ponderado es</p>
      \[ P_j = \frac{20}{\sum_k w_k} \sum_k w_k\, s_{jk}. \]
      <p>El costo se puntúa como \(5\,\min_j \text{TCO}_j/\text{TCO}_j\) y el plazo como \(5\,\min_j m_j/m_j\); el ajuste es 5 por la fracción de requerimientos cubiertos. La independencia del proveedor y el riesgo de ejecución son juicios: (1,5; 2,5; 5) y
      (4,5; 3; 2) para comprar, personalizar y construir. Por eso hay que mirar la <em>sensibilidad</em>: si un cambio pequeño de pesos cambia al ganador, la decisión es frágil.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con 500 usuarios, ajuste de 75 %, 80 persona-mes y alza de licencia de 5 %, el costo acumulado a 5 años es de unos 1 814 mil USD comprando, 1 830 mil personalizando y 1 819 mil desarrollando: casi un empate. Pero a 10 años son 3 165, 2 980 y 2 203 mil:
      lo barato de comprar se paga con una licencia que sube todos los años y una brecha de 112 mil USD anuales de trabajo manual. Con 200 usuarios y 80 persona-mes, en cambio, el paquete es más barato durante los 10 años. Con un ajuste de 95 % la brecha casi desaparece y comprar es más barato hasta el año 7,5.</p>
      <div class="recuadro"><p><strong>Riesgos que no están en la tabla.</strong> El software a medida puede fracasar en plazo y costo, y la organización debe retener a quienes lo conocen. El paquete crea dependencia del proveedor: alzas de precio, cambios de producto o fin de soporte.
      Una alternativa intermedia es comprar lo estándar (contabilidad, remuneraciones) y construir solo lo que diferencia al negocio.</p></div>
      <h2>Conexiones</h2>
      <p>Los beneficios y costos de cada alternativa alimentan el <a href="tema.html?id=business-case">caso de negocio</a> y las <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>. Un paquete integrado típico es un
      <a href="tema.html?id=erp-modules">ERP</a>; la opción de arrendar en lugar de comprar se estudia en <a href="tema.html?id=cloud-vs-on-premise-costs">nube contra infraestructura propia</a>. Una vez elegido, la
      <a href="tema.html?id=adoption-success-evaluation">implementación y adopción</a> determinan si el valor se obtiene.</p>`,
  });
})();
