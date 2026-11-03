(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => '$' + VIZ.entero(v);
  const pct = (v) => VIZ.fmt(v * 100, 3) + ' %';

  /* ---------- Fig. 1: segmentación RFM ---------- */

  const SEG = [
    { id: 'campeones', nombre: 'Campeones', color: C.s6, forma: 0, accion: 'Programa de lealtad, ventas cruzadas y pedirles referidos.' },
    { id: 'nuevos', nombre: 'Nuevos u ocasionales', color: C.s1, forma: 1, accion: 'Bienvenida y segunda compra: llevarlos a más frecuencia.' },
    { id: 'riesgo', nombre: 'En riesgo', color: C.s4, forma: 2, accion: 'Campaña de reactivación personal antes de perderlos.' },
    { id: 'perdidos', nombre: 'Perdidos', color: C.s8, forma: 3, accion: 'Oferta de recuperación de bajo costo; no invertir de más.' },
  ];
  const clientes = (semilla, n) => {
    const rnd = VIZ.semilla(semilla * 101 + 3), u = (a, b) => a + (b - a) * rnd();
    return Array.from({ length: n }, (_, i) => {
      const t = rnd();
      let r, f;
      if (t < 0.15) { r = u(1, 60); f = u(8, 20); }
      else if (t < 0.4) { r = u(20, 120); f = u(4, 10); }
      else if (t < 0.6) { r = u(1, 60); f = u(1, 3.5); }
      else if (t < 0.85) { r = u(150, 330); f = u(4, 12); }
      else { r = u(200, 365); f = u(1, 3.5); }
      f = Math.round(f);
      const ticket = 40 + 160 * rnd() * rnd() * 1.6;
      return { id: i + 1, r: Math.round(r), f: Math.max(1, f), m: Math.round(f * ticket) };
    });
  };

  function montarRFM(cuerpo) {
    let semilla = 1, rcut = 90, fcut = 5, datos = clientes(semilla, 240), sel = -1, hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Recencia máxima de «reciente»', min: 30, max: 300, paso: 10, valor: rcut, formato: (v) => v + ' días', alCambiar: (v) => { rcut = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Frecuencia mínima de «frecuente»', min: 2, max: 15, valor: fcut, formato: (v) => v + ' compras', alCambiar: (v) => { fcut = v; dibujar(); } });
    ctl.boton('Nuevos clientes', () => { semilla++; datos = clientes(semilla, 240); sel = -1; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, SEG.map((s) => ({ color: s.color, texto: s.nombre })));
    const tabla = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(tabla);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada marca es un cliente: la forma indica el segmento y el tamaño, cuánto compró en el año. Mueva los umbrales para redefinir los segmentos y haga clic en un cliente para ver su ficha y la acción sugerida.');

    const seg = (c) => (c.r <= rcut ? (c.f >= fcut ? 0 : 1) : (c.f >= fcut ? 2 : 3));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 370, ymin: 0, ymax: 22 }, { etiquetaX: 'recencia (días desde la última compra)', etiquetaY: 'compras al año' });
      pl.ejes();
      // Cuadrantes: líneas de corte.
      ctx.save();
      ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.sx(rcut), pl.y1); ctx.lineTo(pl.sx(rcut), pl.y0); ctx.moveTo(pl.x0, pl.sy(fcut - 0.5)); ctx.lineTo(pl.x1, pl.sy(fcut - 0.5)); ctx.stroke();
      ctx.restore();
      const mmax = Math.max(...datos.map((c) => c.m));
      datos.forEach((c, i) => {
        const s = SEG[seg(c)], rad = 3 + 6 * Math.sqrt(c.m / mmax);
        ctx.globalAlpha = 0.85;
        VIZ.marcador(ctx, pl.sx(c.r), pl.sy(c.f), s.color, rad, s.forma);
        ctx.globalAlpha = 1;
        if (i === sel || i === hover) {
          ctx.strokeStyle = C.tinta; ctx.lineWidth = 2.5; ctx.beginPath(); VIZ.forma(ctx, pl.sx(c.r), pl.sy(c.f), rad + 3, s.forma); ctx.stroke();
        }
      });
      const tot = datos.reduce((s, c) => s + c.m, 0);
      const filas = SEG.map((s, k) => {
        const g = datos.filter((c) => seg(c) === k), ing = g.reduce((a, c) => a + c.m, 0);
        return { s, n: g.length, ing, prom: g.length ? ing / g.length : 0 };
      });
      tabla.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ['Segmento', 'Clientes', '% clientes', 'Ingreso anual', '% ingreso', 'Gasto medio'].map((t, i) => VIZ.el('th', { class: i ? null : 'izq' }, t))),
        filas.map((f) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, VIZ.ficha(f.s.nombre, { color: f.s.color })), VIZ.el('td', null, f.n), VIZ.el('td', null, pct(f.n / datos.length)),
          VIZ.el('td', null, dinero(f.ing)), VIZ.el('td', null, pct(f.ing / tot)), VIZ.el('td', null, dinero(f.prom))))));
      if (sel >= 0) {
        const c = datos[sel], s = SEG[seg(c)];
        registro.textContent = `Cliente ${c.id}: última compra hace ${c.r} días, ${c.f} compras y ${dinero(c.m)} al año → ${s.nombre}. ${s.accion}`;
      } else registro.textContent = 'Haga clic en un cliente para ver su ficha RFM (recencia, frecuencia, monto).';
      const top = filas[0];
      lectura.set([
        ['clientes', String(datos.length)], ['ingreso anual', dinero(tot)],
        ['campeones', pct(top.n / datos.length) + ' de los clientes'], ['ingreso de campeones', pct(top.ing / tot)],
        ['en riesgo', dinero(filas[2].ing) + ' en juego'],
      ]);
    }
    const buscar = (x, y) => {
      let mejor = -1, d2 = 14 * 14;
      datos.forEach((c, i) => { const d = (pl.sx(c.r) - x) ** 2 + (pl.sy(c.f) - y) ** 2; if (d < d2) { d2 = d; mejor = i; } });
      return mejor;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = pl && pl.dentro(x, y) ? buscar(x, y) : -1;
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const c = datos[i], s = SEG[seg(c)];
      tip.mostrar(x, y, `<b>Cliente ${c.id}</b>` + VIZ.filaTooltip(s.color, s.nombre, null) + `<div>recencia <b>${c.r}</b> días</div><div>frecuencia <b>${c.f}</b> compras</div><div>monto <b>${dinero(c.m)}</b></div>`);
    });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      sel = pl && pl.dentro(x, y) ? buscar(x, y) : -1;
      dibujar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: embudo de ventas y valor del cliente ---------- */

  const ETAPAS = ['Prospectos', 'Contactados', 'Oportunidades', 'Propuestas', 'Clientes'];
  function montarEmbudo(cuerpo) {
    let prosp = 4000, tasas = [40, 50, 60, 30], gasto = 60, margen = 25, ret = 90, desc = 10, hoverF = -1, hoverC = -1, plC = null, filasF = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Prospectos al mes', min: 1000, max: 10000, paso: 500, valor: prosp, formato: (v) => VIZ.entero(v), alCambiar: (v) => { prosp = v; dibujar(); } });
    const rt = tasas.map((t, i) => ctl.rango({ etiqueta: `Conversión ${ETAPAS[i].toLowerCase()} → ${ETAPAS[i + 1].toLowerCase()}`, min: 5, max: 95, paso: 5, valor: t, formato: (v) => v + ' %', alCambiar: (v) => { tasas[i] = v; dibujar(); } }));
    ctl.rango({ etiqueta: 'Gasto comercial mensual (miles)', min: 10, max: 200, paso: 5, valor: gasto, formato: (v) => '$' + v + ' mil', alCambiar: (v) => { gasto = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Margen mensual por cliente', min: 5, max: 60, valor: margen, formato: (v) => '$' + v, alCambiar: (v) => { margen = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Retención mensual', min: 70, max: 99, valor: ret, formato: (v) => v + ' %', alCambiar: (v) => { ret = v; dibujar(); } });
    const lf = VIZ.lienzo(cuerpo, { alto: 214 });
    const tipF = VIZ.tooltip(lf);
    VIZ.subtitulo(cuerpo, 'Valor acumulado de un cliente nuevo frente a lo que costó conseguirlo');
    const lc = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 230, altoMax: 330 });
    const tipC = VIZ.tooltip(lc);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'etapa del embudo' }, { color: C.s6, texto: 'cliente ganado' },
      { color: C.s2, texto: 'margen acumulado con la retención elegida', forma: 'linea' },
      { color: C.s3, texto: 'margen acumulado con 5 puntos más de retención', forma: 'linea' },
      { color: C.tinta, texto: 'costo de adquisición (CAC)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una etapa del embudo para sumarle 5 puntos de conversión (vuelve a 5 % al pasar de 95 %). Pase el cursor sobre la curva para ver el margen acumulado mes a mes y compare con el CAC.');

    const dm = () => Math.pow(1 + desc / 100, 1 / 12) - 1;
    const acumulado = (r, n) => { const x = r / (1 + dm()); let s = 0, p = 1; for (let t = 0; t <= n; t++) { s += margen * p; p *= x; } return s; };
    const clv = (r) => margen / (1 - r / (1 + dm()));
    function dibujar() {
      const cnt = [prosp]; tasas.forEach((t) => cnt.push(cnt[cnt.length - 1] * t / 100));
      const ganados = cnt[4], cac = ganados > 0 ? gasto * 1000 / ganados : Infinity;
      // Embudo.
      {
        const { ctx, ancho: W } = lf;
        lf.limpiar();
        const fh = 34, gap = 6;
        filasF = cnt.map((v, i) => {
          const w = Math.max(6, (W - 16) * v / cnt[0]);
          return { x: 8, y: 6 + i * (fh + gap), w, h: fh, v, i };
        });
        filasF.forEach((f) => {
          ctx.fillStyle = f.i === 4 ? C.s6 : C.s1;
          if (f.i === hoverF) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.7);
          ctx.beginPath(); ctx.roundRect(f.x, f.y, f.w, f.h, 4); ctx.fill();
          const txt = `${ETAPAS[f.i]} ${VIZ.entero(f.v)}` + (f.i ? ` (${tasas[f.i - 1]} %)` : '');
          ctx.font = VIZ.fuente(11, 500); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          const ancho = ctx.measureText(txt).width + 14;
          if (f.w > ancho) { ctx.fillStyle = C.sobre; ctx.fillText(txt, f.x + 8, f.y + f.h / 2); }
          else { ctx.fillStyle = C.tinta; ctx.fillText(txt, f.x + f.w + 6, f.y + f.h / 2); }
        });
      }
      // Valor del cliente.
      const r = ret / 100, r2 = Math.min(0.995, r + 0.05), N = 48;
      {
        const { ctx } = lc;
        lc.limpiar();
        const ymax = Math.max(acumulado(r2, N), Number.isFinite(cac) ? cac : 0) * 1.1;
        plC = VIZ.plano(lc, { xmin: 0, xmax: N, ymin: 0, ymax }, { etiquetaX: 'meses desde la adquisición', etiquetaY: 'dólares por cliente', formatoY: (v) => '$' + VIZ.fmt(v, 3) });
        plC.ejes();
        const pts = (rr) => Array.from({ length: N + 1 }, (_, n) => [n, acumulado(rr, n)]);
        VIZ.trazar(ctx, plC, pts(r2), C.s3, 2.5);
        VIZ.trazar(ctx, plC, pts(r), C.s2, 2.5);
        if (Number.isFinite(cac)) {
          VIZ.trazar(ctx, plC, [[0, cac], [N, cac]], C.tinta, 2, [6, 4]);
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          ctx.fillText('CAC ' + dinero(cac), plC.x1 - 4, plC.sy(cac) - 3);
        }
        if (hoverC >= 0) {
          ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(plC.sx(hoverC), plC.y1); ctx.lineTo(plC.sx(hoverC), plC.y0); ctx.stroke(); ctx.setLineDash([]);
          VIZ.marcador(ctx, plC.sx(hoverC), plC.sy(acumulado(r, hoverC)), C.s2, 4); VIZ.marcador(ctx, plC.sx(hoverC), plC.sy(acumulado(r2, hoverC)), C.s3, 4);
        }
      }
      let pay = null;
      for (let n = 0; n <= 600 && Number.isFinite(cac); n++) if (acumulado(r, n) >= cac) { pay = n; break; }
      const v0 = clv(r), v1 = clv(r2);
      registro.textContent = `CAC = $${VIZ.entero(gasto * 1000)} / ${VIZ.fmt(ganados, 3)} clientes = ${dinero(cac)}. CLV = margen / (1 − r/(1 + i)) = ${dinero(v0)}; ${v0 >= cac ? 'cada cliente deja más de lo que costó.' : 'cada cliente deja menos de lo que costó.'}`;
      lectura.set([
        ['clientes ganados al mes', VIZ.fmt(ganados, 3)], ['CAC', dinero(cac)], ['CLV', dinero(v0)],
        ['CLV / CAC', VIZ.fmt(v0 / cac, 3)], ['recuperación del CAC', pay == null ? 'no se recupera' : pay + ' meses'],
        ['CLV con +5 puntos de retención', `${dinero(v1)} (+${VIZ.fmt((v1 / v0 - 1) * 100, 3)} %)`],
      ]);
    }
    lf.alDibujar = () => dibujar(); lc.alDibujar = () => dibujar();
    lf.canvas.style.cursor = 'pointer';
    lf.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lf.posicion(ev);
      const f = filasF.find((h) => y >= h.y && y <= h.y + h.h);
      const i = f && f.i > 0 ? f.i : -1;
      if (i !== hoverF) { hoverF = i; dibujar(); }
      if (!f) return tipF.ocultar();
      tipF.mostrar(x, y, `<b>${ETAPAS[f.i]}</b>: ${VIZ.fmt(f.v, 4)} al mes` + (f.i ? `<br>conversión de la etapa anterior ${tasas[f.i - 1]} %<br>clic: +5 puntos` : ''));
    });
    lf.canvas.addEventListener('click', (ev) => {
      const { y } = lf.posicion(ev);
      const f = filasF.find((h) => y >= h.y && y <= h.y + h.h);
      if (!f || !f.i) return;
      const nuevo = tasas[f.i - 1] + 5 > 95 ? 5 : tasas[f.i - 1] + 5;
      tasas[f.i - 1] = nuevo; rt[f.i - 1].valor = nuevo; dibujar();
    });
    lf.canvas.addEventListener('pointerleave', () => { hoverF = -1; tipF.ocultar(); dibujar(); });
    lc.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lc.posicion(ev);
      if (!plC || !plC.dentro(x, y)) { if (hoverC >= 0) { hoverC = -1; dibujar(); } return tipC.ocultar(); }
      const n = Math.max(0, Math.min(48, Math.round(plC.ix(x))));
      if (n !== hoverC) { hoverC = n; dibujar(); }
      const r = ret / 100, r2 = Math.min(0.995, r + 0.05);
      tipC.mostrar(x, y, `mes <b>${n}</b>` + VIZ.filaTooltip(C.s2, 'retención actual', dinero(acumulado(r, n))) + VIZ.filaTooltip(C.s3, '+5 puntos', dinero(acumulado(r2, n))));
    });
    lc.canvas.addEventListener('pointerleave', () => { hoverC = -1; tipC.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('crm', {
    intro: String.raw`
      <p>La <strong>gestión de la relación con el cliente</strong> (<em>CRM</em>) reúne en un solo lugar la historia de cada cliente: qué compró, cuándo, por qué canal y
      en qué etapa de la venta está. Con esos datos la organización deja de tratar a todos igual y decide a quién llamar, a quién ofrecer qué y a quién no insistir.</p>
      <p>Dos preguntas ordenan el tema: <em>¿a qué clientes vale más la pena cuidar?</em> (segmentación) y <em>¿cuánto vale una relación a lo largo del tiempo frente a lo que cuesta
      conseguirla?</em> (embudo y valor del cliente). De ahí sale una conclusión práctica: retener suele rendir más que adquirir.</p>`,
    visualizaciones: [
      {
        titulo: 'Segmentación RFM de clientes',
        descripcion: 'Mueva los umbrales de recencia y frecuencia: los cuatro cuadrantes cambian de tamaño y la tabla muestra cuánto ingreso concentra cada segmento. Busque cuántos clientes «campeones» sostienen la mayor parte de las ventas y cuánto dinero está en el segmento en riesgo.',
        montar: montarRFM,
      },
      {
        titulo: 'Embudo de ventas y valor del cliente',
        descripcion: 'Suba la conversión de una etapa (haciendo clic en ella) y compare con subir la retención: observe cómo cambian el CAC, el CLV y los meses que tarda en recuperarse lo invertido. Pruebe una retención de 80 % y otra de 95 %.',
        montar: montarEmbudo,
      },
    ],
    teoria: String.raw`
      <h2>Qué hace un CRM</h2>
      <p>Un CRM integra tres capacidades: <strong>operativa</strong> (automatizar ventas, marketing y servicio), <strong>analítica</strong> (segmentar y predecir) y
      <strong>colaborativa</strong> (compartir la información del cliente entre áreas y canales). Su materia prima son los datos del cliente guardados en una base única, igual que en un
      <a href="tema.html?id=erp-modules">ERP</a>, pero orientados a la relación y no a la transacción.</p>
      <h2>Segmentación RFM</h2>
      <p>El análisis <em>RFM</em> describe a cada cliente con tres números: <strong>recencia</strong> (días desde su última compra), <strong>frecuencia</strong> (compras en el periodo) y
      <strong>monto</strong> (gasto total). Al cortar recencia y frecuencia en «alta» y «baja» resultan cuatro segmentos:</p>
      <table>
        <tr><th>Segmento</th><th>Recencia</th><th>Frecuencia</th><th>Acción típica</th></tr>
        <tr><td>Campeones</td><td>reciente</td><td>alta</td><td>fidelizar, pedir referidos</td></tr>
        <tr><td>Nuevos u ocasionales</td><td>reciente</td><td>baja</td><td>lograr la segunda compra</td></tr>
        <tr><td>En riesgo</td><td>antigua</td><td>alta</td><td>reactivar con urgencia</td></tr>
        <tr><td>Perdidos</td><td>antigua</td><td>baja</td><td>recuperar sin gastar de más</td></tr>
      </table>
      <p>Es una forma sencilla de agrupar; la <a href="tema.html?id=kmeans">agrupación por k-medias</a> hace algo parecido sin fijar los cortes a mano.</p>
      <h2>Embudo de ventas</h2>
      <p>Un embudo con etapas \(1, \dots, k\) y conversiones \(c_i\) entrega \(N \prod_i c_i\) clientes a partir de \(N\) prospectos. Con 4.000 prospectos y conversiones de
      40 %, 50 %, 60 % y 30 % resultan \(4000 \cdot 0{,}4 \cdot 0{,}5 \cdot 0{,}6 \cdot 0{,}3 = 144\) clientes. El <strong>costo de adquisición</strong> es</p>
      \[ \text{CAC} = \frac{\text{gasto comercial}}{\text{clientes ganados}} = \frac{60000}{144} \approx 417. \]
      <p>Como las conversiones se multiplican, mejorar cualquier etapa en la misma proporción tiene el mismo efecto sobre el total.</p>
      <h2>Valor del cliente en el tiempo (CLV)</h2>
      <p>Si un cliente deja un margen mensual \(m\), se mantiene cada mes con probabilidad \(r\) (retención) y el dinero se descuenta a una tasa mensual \(i\), el valor esperado es una serie geométrica:</p>
      \[ \text{CLV} = \sum_{t=0}^{\infty} m \left(\frac{r}{1+i}\right)^{t} = \frac{m}{1 - \dfrac{r}{1+i}}. \]
      <p>Con \(m = 25\), \(r = 0{,}90\) y una tasa anual de 10 % (\(i \approx 0{,}0080\)) resulta \(\text{CLV} = 25 / (1 - 0{,}9/1{,}008) \approx 233\), por debajo del CAC de 417: la relación no
      se paga a sí misma. Con \(r = 0{,}95\) el CLV sube a \(25 / (1 - 0{,}95/1{,}008) \approx 435\) y supera el CAC. Un cambio de cinco puntos en la retención casi duplica el valor.</p>
      <div class="recuadro"><p><strong>Retención frente a adquisición.</strong> El CLV crece con \(1/(1 - r)\) aproximadamente: cuanto mayor es \(r\), más sensible es a cada punto adicional.
      Por eso suele convenir más invertir en servicio y fidelización de los clientes existentes que sólo en ampliar el embudo. La regla práctica es exigir \(\text{CLV}/\text{CAC} \geq 3\).</p></div>
      <h2>Conexiones</h2>
      <p>Los datos del CRM alimentan la <a href="tema.html?id=bi-dss">inteligencia de negocios</a> y los <a href="tema.html?id=kpi-fundamentals">indicadores de gestión</a>; el valor del cliente se evalúa
      con la misma lógica de descuento de las <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>. Para integrar el CRM con facturación y bodega,
      véase el <a href="tema.html?id=cross-department-flow">flujo de información entre departamentos</a>.</p>`,
  });
})();
