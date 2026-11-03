(function () {
  'use strict';
  const { color: C } = VIZ;

  const NIVELES = [
    { t: 'Digitización', sub: 'cambia el formato' },
    { t: 'Digitalización', sub: 'cambia el proceso' },
    { t: 'Transformación', sub: 'cambia el negocio' },
  ];
  // nivel: 0 digitización, 1 digitalización, 2 transformación digital.
  const INICIATIVAS = [
    { t: 'Escanear los contratos en papel y guardarlos como PDF.', nivel: 0, por: 'solo cambia el soporte de la información: del papel al archivo; el trabajo con los contratos sigue igual.' },
    { t: 'Pasar el archivo de fichas clínicas de papel a imágenes digitales.', nivel: 0, por: 'convierte documentos en datos digitales, pero nadie los usa de otra manera.' },
    { t: 'Reemplazar el formulario de papel por un PDF que se imprime, se firma y se archiva.', nivel: 0, por: 'el formato es digital, pero el proceso (imprimir, firmar, archivar) no cambió.' },
    { t: 'Convertir las grabaciones de reuniones de casete a archivos de audio.', nivel: 0, por: 'es una conversión de formato; no cambia cómo se usan las reuniones.' },
    { t: 'Facturación electrónica con aprobación automática según reglas.', nivel: 1, por: 'cambia el proceso de punta a punta: emisión, validación, aprobación y registro sin papel ni digitación.' },
    { t: 'Portal donde los empleados piden vacaciones y permisos con flujo de aprobación y trazabilidad.', nivel: 1, por: 'rediseña el proceso con datos digitales, pero la empresa sigue ofreciendo lo mismo.' },
    { t: 'Seguimiento de despachos con GPS y alertas automáticas de atraso.', nivel: 1, por: 'mejora un proceso existente (logística) con tecnología; el negocio sigue siendo transportar.' },
    { t: 'Conciliación bancaria automática integrada con la contabilidad.', nivel: 1, por: 'el proceso cambia y se integra, no el modelo de ingresos.' },
    { t: 'Un banco que atiende solo por app, sin sucursales, con cuentas en minutos.', nivel: 2, por: 'cambia la propuesta de valor y el canal completo: es otro modelo de negocio.' },
    { t: 'Un fabricante de maquinaria que cobra por hora de uso medida con sensores, no por la venta de la máquina.', nivel: 2, por: 'cambia cómo se genera ingreso (de producto a servicio) gracias a los datos.' },
    { t: 'Una editorial que vende suscripciones a contenidos y datos en vez de libros.', nivel: 2, por: 'el producto y la forma de cobrar son nuevos; los libros pasan a ser un canal más.' },
    { t: 'Una cadena de tiendas que abre una plataforma donde venden terceros.', nivel: 2, por: 'pasa de vender productos propios a orquestar una red de vendedores y compradores.' },
  ];

  /* ---------- Fig. 1: clasificar iniciativas ---------- */

  function montarClasificar(cuerpo) {
    let semilla = 1, orden = [], asign = [], sel = 0, intentos = 0, aciertos = 0, pos = [], geo = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    NIVELES.forEach((n, k) => ctl.boton(n.t, () => asignar(k), { primario: k === 1 }));
    ctl.boton('Mezclar y reiniciar', () => { semilla++; reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => 30 + Math.ceil(INICIATIVAS.length / Math.max(3, Math.floor((w - 16) / 34))) * 34 + 62 + 4 * 34 + 10 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.inactivo, texto: 'sin clasificar', forma: 'punto' },
      { color: C.s6, texto: 'bien clasificada', forma: 'punto' },
      { color: C.s8, texto: 'mal clasificada', forma: 'punto' },
      { color: C.tinta, texto: 'anillo: iniciativa elegida', forma: 'punto' },
    ]);
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija una iniciativa (clic en su número o en su fila) y luego pulse el botón del nivel, o haga clic en la columna. Pregúntese: ¿cambia solo el formato, cambia el proceso o cambia lo que la empresa ofrece y cómo cobra? Se puede reclasificar cuantas veces quiera.');

    function reiniciar() {
      const rnd = VIZ.semilla(semilla * 31 + 5);
      orden = INICIATIVAS.map((_, i) => i);
      for (let i = orden.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
      asign = orden.map(() => -1); sel = 0; intentos = 0; aciertos = 0;
      registro.textContent = 'Elija una iniciativa y clasifíquela.';
      tabla(); dibujar();
    }
    function tabla() {
      caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos texto' },
        orden.map((idx, k) => VIZ.el('tr', { class: 'clicable' + (k === sel ? ' activa' : ''), onclick: () => { sel = k; tabla(); dibujar(); } },
          VIZ.el('td', null, String(k + 1)), VIZ.el('td', null, INICIATIVAS[idx].t)))));
    }
    function asignar(c) {
      if (sel < 0) return;
      const it = INICIATIVAS[orden[sel]], ok = it.nivel === c;
      const antes = asign[sel];
      asign[sel] = c; intentos++;
      if (ok) aciertos++;
      registro.textContent = ok
        ? `Correcto. «${NIVELES[c].t}»: ${it.por}`
        : `No: la iniciativa ${sel + 1} no es ${NIVELES[c].t.toLowerCase()}. Es «${NIVELES[it.nivel].t}»: ${it.por}`;
      if (antes >= 0 && ok) registro.textContent += ' (reclasificada)';
      const sig = asign.findIndex((v, k) => v < 0 && k !== sel);
      if (sig >= 0) sel = sig;
      tabla(); dibujar();
    }
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const r = 14, paso = 34, porFila = Math.max(3, Math.floor((W - 16) / paso));
      const topY = 26, colY = topY + Math.ceil(INICIATIVAS.length / porFila) * paso + 6, colW = W / 3;
      pos = [];
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Sin clasificar', 8, 16);
      NIVELES.forEach((n, c) => {
        const x = c * colW;
        ctx.fillStyle = C.neutro; ctx.fillRect(x + 3, colY, colW - 6, lienzo.alto - colY - 4);
        if (hover === 100 + c) { ctx.fillStyle = VIZ.alfa(C.s1, 0.1); ctx.fillRect(x + 3, colY, colW - 6, lienzo.alto - colY - 4); }
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 700); ctx.textAlign = 'center';
        ctx.fillText(n.t, x + colW / 2, colY + 20);
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10); ctx.fillText(n.sub, x + colW / 2, colY + 36);
      });
      geo = { colY, colW };
      const colCont = [0, 0, 0], libre = [];
      asign.forEach((c, k) => {
        let x, y;
        if (c < 0) { const j = libre.length; libre.push(k); x = 8 + r + (j % porFila) * paso; y = topY + r + Math.floor(j / porFila) * paso; }
        else {
          const porCol = Math.max(2, Math.floor((colW - 12) / paso)), j = colCont[c]++;
          x = c * colW + 6 + r + (j % porCol) * paso; y = colY + 52 + r + Math.floor(j / porCol) * paso;
        }
        pos.push({ x, y, k });
        const bien = c >= 0 && INICIATIVAS[orden[k]].nivel === c;
        const fondo = c < 0 ? C.inactivo : bien ? C.s6 : C.s8;
        if (k === sel) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
        VIZ.marcador(ctx, x, y, fondo, r);
        ctx.fillStyle = C.sobre; ctx.font = VIZ.fuente(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), x, y + 0.5);
      });
      const hechas = asign.filter((v) => v >= 0).length;
      const bienes = asign.filter((v, k) => v >= 0 && INICIATIVAS[orden[k]].nivel === v).length;
      lectura.set([
        ['clasificadas', `${hechas} de ${INICIATIVAS.length}`],
        ['bien clasificadas', String(bienes)],
        ['intentos', String(intentos)],
        ['aciertos / intentos', intentos ? `${Math.round((100 * aciertos) / intentos)} %` : '—'],
      ]);
    }
    lienzo.alDibujar = () => orden.length && dibujar();
    const bajo = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const p = pos.find((q) => Math.hypot(q.x - x, q.y - y) <= 17);
      return { x, y, p, col: geo && y >= geo.colY ? Math.min(2, Math.floor(x / geo.colW)) : -1 };
    };
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!geo) return;
      const { x, y, p, col } = bajo(ev);
      const nuevo = p ? -1 : col >= 0 ? 100 + col : -1;
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (!p) return tip.ocultar();
      tip.mostrar(x, y, `<b>${p.k + 1}.</b> ${INICIATIVAS[orden[p.k]].t}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { p, col } = bajo(ev);
      if (p) { sel = p.k; tabla(); dibujar(); } else if (col >= 0) asignar(col);
    });
    reiniciar();
  }

  /* ---------- Fig. 2: madurez y dependencias entre niveles ---------- */

  const PASOS = 40; // trimestres
  const RITMO = 0.06; // avance máximo por trimestre si todo el presupuesto va a un solo nivel
  const PESOS = [1, 3, 8]; // valor relativo de completar cada nivel

  function montarMadurez(cuerpo) {
    let w = [3, 3, 3], D = [0, 0, 0], t = 0, desperdicio = 0, hist = [], pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    NIVELES.forEach((n, k) => ctl.rango({ etiqueta: `Presupuesto a ${n.t.toLowerCase()}`, min: 0, max: 10, paso: 1, valor: w[k], alCambiar: (v) => { w[k] = v; rep.reiniciar(); } }));
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2.5 });
    ctl.boton('Todo en transformación', () => { setW([0, 0, 10]); });
    ctl.boton('Reparto equilibrado', () => { setW([3, 3, 3]); });
    const rangos = [...ctl.caja.querySelectorAll('input[type=range]')].slice(0, 3);
    function setW(nw) { w = nw.slice(); rangos.forEach((r, k) => { r.value = w[k]; r.dispatchEvent(new Event('input')); }); }
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'digitización completada', forma: 'linea' },
      { color: C.s2, texto: 'digitalización completada', forma: 'linea' },
      { color: C.s7, texto: 'transformación completada', forma: 'linea' },
      { color: C.tinta, texto: 'valor creado (índice 0–100)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada trimestre se reparte el esfuerzo según los pesos. Un nivel no puede ir más allá del que lo sostiene: sin datos digitales no hay procesos digitales, y sin procesos digitales no hay un negocio nuevo. Pruebe «Todo en transformación»: el dinero se gasta y no avanza nada.');

    const cap = [() => 1, () => Math.min(1, D[0] + 0.1), () => D[1]];
    const valor = () => (100 * D.reduce((s, d, k) => s + d * PESOS[k], 0)) / PESOS.reduce((s, x) => s + x, 0);
    function iniciar() {
      D = [0, 0, 0]; t = 0; desperdicio = 0; hist = [{ D: [0, 0, 0], v: 0 }];
      return (function* () {
        const tot = w.reduce((s, x) => s + x, 0);
        for (t = 1; t <= PASOS; t++) {
          if (tot === 0) { yield; hist.push({ D: D.slice(), v: valor() }); continue; }
          const antes = D.slice();
          const nuevo = D.slice();
          for (let k = 0; k < 3; k++) {
            const pedido = (RITMO * w[k]) / tot;
            const real = Math.max(0, Math.min(pedido, cap[k]() - D[k]));
            nuevo[k] = D[k] + real; desperdicio += pedido - real;
          }
          D = nuevo;
          hist.push({ D: D.slice(), v: valor() });
          const bloq = [0, 1, 2].filter((k) => w[k] > 0 && D[k] - antes[k] < (RITMO * w[k]) / tot - 1e-9);
          registro.textContent = bloq.length
            ? `Trimestre ${t}: «${bloq.map((k) => NIVELES[k].t.toLowerCase()).join('» y «')}» no puede avanzar más que el nivel que lo sostiene; parte del presupuesto se pierde.`
            : `Trimestre ${t}: el presupuesto se convierte en avance en los tres niveles.`;
          yield;
        }
      })();
    }
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: PASOS, ymin: 0, ymax: 100 }, { etiquetaX: 'trimestre', etiquetaY: '% completado' });
      pl.ejes();
      [[0, C.s1], [1, C.s2], [2, C.s7]].forEach(([k, c]) => VIZ.trazar(ctx, pl, hist.map((h, i) => [i, h.D[k] * 100]), c, 2.5));
      VIZ.trazar(ctx, pl, hist.map((h, i) => [i, h.v]), C.tinta, 3.5);
      const u = hist[hist.length - 1];
      if (hover >= 0 && hover < hist.length) {
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke();
        const h = hist[hover];
        [[h.D[0] * 100, C.s1], [h.D[1] * 100, C.s2], [h.D[2] * 100, C.s7], [h.v, C.tinta]].forEach(([v, c]) => VIZ.marcador(ctx, pl.sx(hover), pl.sy(v), c, 4));
      }
      const tot = w.reduce((s, x) => s + x, 0);
      lectura.set([
        ['trimestre', String(hist.length - 1)],
        ['digitización', `${Math.round(u.D[0] * 100)} %`],
        ['digitalización', `${Math.round(u.D[1] * 100)} %`],
        ['transformación', `${Math.round(u.D[2] * 100)} %`],
        ['valor creado', VIZ.fmt(u.v, 3)],
        ['presupuesto sin efecto', tot ? `${Math.round((100 * desperdicio) / (RITMO * Math.max(1, hist.length - 1)))} %` : '—'],
      ]);
      if (hist.length === 1) registro.textContent = `Pesos: ${w.join(' · ')} (digitización · digitalización · transformación). Pulse «Reproducir» para avanzar trimestre a trimestre.`;
    }
    lienzo.alDibujar = () => hist.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!pl) return;
      const { x, y } = lienzo.posicion(ev);
      if (!pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = Math.min(PASOS, Math.max(0, Math.round(pl.ix(x))));
      dibujar();
      if (hover >= hist.length) return tip.ocultar();
      const h = hist[hover];
      tip.mostrar(x, y, `trimestre <b>${hover}</b>` + VIZ.filaTooltip(C.s1, 'digitización', `${Math.round(h.D[0] * 100)} %`) + VIZ.filaTooltip(C.s2, 'digitalización', `${Math.round(h.D[1] * 100)} %`) + VIZ.filaTooltip(C.s7, 'transformación', `${Math.round(h.D[2] * 100)} %`) + VIZ.filaTooltip(C.tinta, 'valor', VIZ.fmt(h.v, 3)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    rep.reiniciar();
  }

  VIZ.registrarTema('digitization-vs-transformation', {
    intro: String.raw`
      <p>Tres palabras que suelen usarse como si fueran una sola, y que describen cambios muy distintos. La <strong>digitización</strong> convierte información analógica en digital (escanear un contrato). La <strong>digitalización</strong> usa lo digital para rehacer un proceso (facturar, aprobar y registrar sin papel). La <strong>transformación digital</strong> cambia el modelo de negocio: qué se ofrece, a quién y cómo se cobra, apoyándose en datos y tecnología.</p>
      <p>Confundirlas lleva a decisiones caras: una empresa puede gastar años en digitizar archivos y creer que se transformó. Las dos figuras ayudan a distinguirlas: primero clasificando ejemplos reales y luego viendo por qué cada nivel depende del anterior y por qué el valor grande está en el último.</p>`,
    visualizaciones: [
      {
        titulo: 'Clasifique iniciativas por lo que cambian',
        descripcion: 'Clasifique las doce iniciativas en digitización, digitalización o transformación. Equivóquese a propósito con alguna y lea la explicación; los casos de frontera, como el PDF que se imprime, son los más instructivos.',
        montar: montarClasificar,
      },
      {
        titulo: 'Madurez: cada nivel apoya al siguiente',
        descripcion: 'Reparta el esfuerzo entre los tres niveles y reproduzca 40 trimestres. Compare «Reparto equilibrado» con «Todo en transformación» y observe cuánto presupuesto se pierde cuando se salta un nivel.',
        montar: montarMadurez,
      },
    ],
    teoria: String.raw`
      <h2>Tres niveles, tres preguntas</h2>
      <table>
        <tr><th>Nivel</th><th>Qué cambia</th><th>Pregunta clave</th><th>Ejemplo</th></tr>
        <tr><td>Digitización</td><td>el formato de la información</td><td>¿Está en forma digital?</td><td>escanear facturas de papel</td></tr>
        <tr><td>Digitalización</td><td>el proceso de trabajo</td><td>¿Funciona mejor o distinto con datos digitales?</td><td>facturación electrónica con aprobación automática</td></tr>
        <tr><td>Transformación digital</td><td>el modelo de negocio</td><td>¿Qué ofrecemos y cómo ganamos dinero?</td><td>pasar de vender máquinas a cobrar por uso</td></tr>
      </table>
      <p>Cada nivel es condición del siguiente, pero no lo garantiza. Un proceso digitalizado conserva su lógica anterior (ver <a href="tema.html?id=business-process-anatomy">anatomía de un proceso de negocio</a>); una transformación exige además cambiar clientes, competencia, datos, innovación y valor, como describen los <a href="tema.html?id=five-digital-domains">cinco dominios</a>, y apoyarse en <a href="tema.html?id=digital-business-models">nuevos modelos de negocio</a> y <a href="tema.html?id=platforms-network-effects">plataformas</a>.</p>
      <h2>Modelo de dependencias</h2>
      <p>Sea \(D_1, D_2, D_3 \in [0,1]\) el avance en cada nivel. Si el presupuesto se reparte con pesos \(s_k\) y el ritmo máximo por trimestre es \(\rho\), el avance de un nivel está limitado por el del nivel que lo sostiene:</p>
      \[ D_k(t+1) = D_k(t) + \min\!\big(\rho\, s_k,\; \text{tope}_k - D_k(t)\big), \qquad \text{tope}_1 = 1,\ \text{tope}_2 = D_1 + 0{,}1,\ \text{tope}_3 = D_2 . \]
      <p>El valor creado pondera más los niveles altos,</p>
      \[ V = 100\cdot\frac{1\cdot D_1 + 3\cdot D_2 + 8\cdot D_3}{12} . \]
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Con pesos iguales (\(s = 1/3\)) y \(\rho = 0{,}06\), cada nivel pide \(0{,}02\) por trimestre y ninguno topa con su límite; a los 40 trimestres \(D_1 = D_2 = D_3 = 0{,}8\) y \(V = 80\). Con todo el presupuesto en el nivel 3, \(D_3 \le D_2 = 0\) para siempre: se gasta el 100 % del esfuerzo y se obtiene \(V = 0\). Con todo en el nivel 1, \(D_1\) llega a 100 % en 17 trimestres y se detiene, y \(V = 100/12 \approx 8{,}3\).</p></div>
      <h2>Madurez</h2>
      <p>Una organización suele recorrer etapas: documentos digitales, procesos digitalizados e integrados, datos que guían decisiones y, por último, productos y servicios que antes no existían. La <a href="tema.html?id=change-management">gestión del cambio</a> es lo que permite que las personas sigan ese camino a la par de la tecnología.</p>`,
  });
})();
