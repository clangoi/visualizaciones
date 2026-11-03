(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => VIZ.fmt(v, 3) + ' %';

  // Rendimiento de una función de elasticidad constante entre tecnología (T) y organización (O), ambas en [0, 100].
  // rho < 0: complementarias (se necesitan); rho = 1: sustitutas (una compensa a la otra); rho → 0: Cobb-Douglas.
  function rendimiento(T, O, rho) {
    if (T <= 0 || O <= 0) return rho < 1 ? 0 : (T + O) / 2;
    if (Math.abs(rho) < 1e-6) return Math.sqrt(T * O);
    return Math.pow(0.5 * Math.pow(T, rho) + 0.5 * Math.pow(O, rho), 1 / rho);
  }
  const claro = (v) => Math.max(0, Math.min(100, v));

  /* ---------- Fig. 1: la superficie de rendimiento ---------- */

  function montarSuperficie(cuerpo) {
    let rho = -1.5, T0 = 80, O0 = 25, B = 30, pl = null, arrastrando = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Complementariedad (ρ)', min: -4, max: 1, paso: 0.25, valor: rho, formato: (v) => (v >= 1 ? 'sustitutas' : v <= -3 ? 'muy complementarias' : VIZ.fmt(v, 3)), alCambiar: (v) => { rho = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Presupuesto de mejora', min: 0, max: 60, paso: 5, valor: B, formato: (v) => `${v} puntos`, alCambiar: (v) => { B = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Tecnología actual', min: 0, max: 100, paso: 1, valor: T0, formato: (v) => `${v}`, alCambiar: (v) => { T0 = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Organización actual', min: 0, max: 100, paso: 1, valor: O0, formato: (v) => `${v}`, alCambiar: (v) => { O0 = v; dibujar(); } });
    const rT = ctl.caja.querySelectorAll('input[type=range]')[2], rO = ctl.caja.querySelectorAll('input[type=range]')[3];
    const sinc = () => { [[rT, T0], [rO, O0]].forEach(([r, v]) => { r.value = v; r.dispatchEvent(new Event('input')); }); };
    ctl.boton('Todo a tecnología', () => { T0 = claro(T0 + B); sinc(); }, {});
    ctl.boton('Todo a organización', () => { O0 = claro(O0 + B); sinc(); }, {});
    ctl.boton('Reparto óptimo', () => { const m = mejor(); T0 = claro(T0 + m.s * B); O0 = claro(O0 + (1 - m.s) * B); sinc(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 460 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...[0.1, 0.35, 0.6, 0.85].map((t, i) => ({ color: VIZ.css(VIZ.enRampa(t)), texto: ['rendimiento bajo', 'medio-bajo', 'medio-alto', 'alto'][i] })),
      { color: C.tinta, texto: 'organización actual (arrastrable)' },
      { color: C.s2, texto: 'reparto del presupuesto', forma: 'linea' },
      { color: C.s6, texto: 'reparto óptimo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic o arrastre sobre el mapa para fijar dónde está hoy la organización. La línea naranja muestra todos los repartos posibles del presupuesto entre tecnología y organización; el punto verde es el mejor. Cambie ρ: con complementariedad alta, invertir solo en un lado casi no rinde.');

    const P = (T, O) => rendimiento(T, O, rho);
    function mejor() {
      let best = { s: 0, p: -1 };
      for (let i = 0; i <= 100; i++) { const s = i / 100, p = P(claro(T0 + s * B), claro(O0 + (1 - s) * B)); if (p > best.p + 1e-9) best = { s, p }; }
      return best;
    }

    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 100, ymin: 0, ymax: 100 }, { etiquetaX: 'tecnología (0–100)', etiquetaY: 'organización: procesos, habilidades, cultura (0–100)' });
      const celdas = 40;
      for (let i = 0; i < celdas; i++) for (let j = 0; j < celdas; j++) {
        const v = P((i + 0.5) * 100 / celdas, (j + 0.5) * 100 / celdas), banda = Math.min(9, Math.floor(v / 10));
        ctx.fillStyle = VIZ.css(VIZ.enRampa(banda / 9));
        const x = pl.sx(i * 100 / celdas), y = pl.sy((j + 1) * 100 / celdas);
        ctx.fillRect(x, y, pl.sx((i + 1) * 100 / celdas) - x + 0.5, pl.sy(j * 100 / celdas) - y + 0.5);
      }
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, 0], [100, 100]], C.superficie, 1.5, [4, 4]);
      const T1 = claro(T0 + B), O1 = claro(O0 + B);
      ctx.strokeStyle = C.s2; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pl.sx(T1), pl.sy(O0)); ctx.lineTo(pl.sx(T0), pl.sy(O1)); ctx.stroke();
      const m = mejor(), Tm = claro(T0 + m.s * B), Om = claro(O0 + (1 - m.s) * B);
      VIZ.marcador(ctx, pl.sx(Tm), pl.sy(Om), C.s6, 7, 6);
      VIZ.marcador(ctx, pl.sx(T0), pl.sy(O0), C.tinta, 6.5);
      const p0 = P(T0, O0), pT = P(T1, O0), pO = P(T0, O1);
      const h = 1;
      const dT = (P(claro(T0 + h), O0) - P(claro(T0 - h), O0)) / (claro(T0 + h) - claro(T0 - h) || 1);
      const dO = (P(T0, claro(O0 + h)) - P(T0, claro(O0 - h))) / (claro(O0 + h) - claro(O0 - h) || 1);
      lectura.set([
        ['rendimiento actual', VIZ.fmt(p0, 3)],
        ['todo a tecnología', VIZ.fmt(pT, 3)],
        ['todo a organización', VIZ.fmt(pO, 3)],
        ['reparto óptimo', `${Math.round(m.s * 100)} % tecnología → ${VIZ.fmt(m.p, 3)}`],
        ['ganancia por punto de tecnología', VIZ.fmt(dT, 2)],
        ['ganancia por punto de organización', VIZ.fmt(dO, 2)],
      ]);
      const lado = T0 > O0 ? 'la organización' : T0 < O0 ? 'la tecnología' : 'ninguno';
      registro.textContent = `Hoy tecnología ${T0} y organización ${O0}: rendimiento ${VIZ.fmt(p0, 3)}. ` + (rho < 1 && Math.abs(T0 - O0) > 10 ? `El lado débil es ${lado}: cada punto ahí rinde ${VIZ.fmt(Math.max(dT, dO) / Math.max(1e-9, Math.min(dT, dO)), 3)} veces lo que rinde en el otro.` : 'Con niveles parecidos, mejorar uno solo rinde poco.');
    }
    lienzo.alDibujar = dibujar;
    function fijar(ev) {
      const { x, y } = lienzo.posicion(ev);
      T0 = Math.round(claro(pl.ix(x))); O0 = Math.round(claro(pl.iy(y)));
      sinc();
    }
    lienzo.canvas.style.cursor = 'crosshair';
    lienzo.canvas.addEventListener('pointerdown', (ev) => { if (!pl) return; arrastrando = true; lienzo.canvas.setPointerCapture(ev.pointerId); fijar(ev); });
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (arrastrando) fijar(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const T = pl.ix(x), O = pl.iy(y);
      tip.mostrar(x, y, `tecnología <b>${Math.round(T)}</b><br>organización <b>${Math.round(O)}</b><br>rendimiento <b>${VIZ.fmt(P(T, O), 3)}</b>`);
    });
    lienzo.canvas.addEventListener('pointerup', () => { arrastrando = false; });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: implementación fallida y ajuste mutuo ---------- */

  const MESES = 36;
  function montarAjuste(cuerpo) {
    let aO = 0.12, aT = 0.1, Tcap = 90, O0 = 25, t = MESES, curvas = [], pl = null;
    const RHO = -1.5, META = 70;
    const ESC = [
      { id: 'impuesta', nombre: 'Se impone la tecnología (nadie se adapta)', col: C.s1, o: false, tt: false },
      { id: 'org', nombre: 'Solo la organización se adapta', col: C.s2, o: true, tt: false },
      { id: 'tec', nombre: 'Solo la tecnología se ajusta', col: C.s3, o: false, tt: true },
      { id: 'mutuo', nombre: 'Ajuste mutuo', col: C.s4, o: true, tt: true },
    ];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Aprendizaje de la organización', min: 0, max: 0.3, paso: 0.01, valor: aO, formato: (v) => `${Math.round(v * 100)} % al mes`, alCambiar: (v) => { aO = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Personalización de la tecnología', min: 0, max: 0.3, paso: 0.01, valor: aT, formato: (v) => `${Math.round(v * 100)} % al mes`, alCambiar: (v) => { aT = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Capacidad de la tecnología instalada', min: 50, max: 100, paso: 5, valor: Tcap, formato: (v) => `${v}`, alCambiar: (v) => { Tcap = v; recalcular(); } });
    ctl.rango({ etiqueta: 'Preparación inicial de la organización', min: 5, max: 70, paso: 5, valor: O0, formato: (v) => `${v}`, alCambiar: (v) => { O0 = v; recalcular(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 2, velMax: 5 });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.46, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [...ESC.map((e) => ({ color: e.col, texto: e.nombre, forma: 'linea' })), { color: C.apagado, texto: `umbral de éxito (${META})`, forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El sistema se pone en marcha en el mes 0 con tecnología avanzada y una organización poco preparada. Reproduzca los 36 meses y compare las cuatro estrategias; ponga uno de los dos aprendizajes en 0 % y vea qué pasa. Pase el cursor para leer cada mes.');

    function recalcular() {
      curvas = ESC.map((e) => {
        let O = O0, fit = 0.4;
        const serie = [];
        for (let m = 0; m <= MESES; m++) {
          serie.push(rendimiento(Tcap * fit, O, RHO));
          if (e.o) O += aO * (Tcap - O);
          if (e.tt) fit += aT * (1 - fit);
        }
        return { ...e, serie };
      });
      rep.reiniciar();
      t = MESES; dibujar();
    }
    function iniciar() { t = 0; return (function* () { for (let m = 1; m <= MESES; m++) { t = m; yield; } })(); }
    const cuando = (s) => { const i = s.findIndex((v) => v >= META); return i < 0 ? 'nunca' : `mes ${i}`; };
    function dibujar() {
      if (!curvas.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: MESES, ymin: 0, ymax: 100 }, { etiquetaX: 'meses desde la puesta en marcha', etiquetaY: 'rendimiento del sistema (0–100)' });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, META], [MESES, META]], C.apagado, 1.5, [3, 4]);
      curvas.forEach((c) => {
        VIZ.trazar(ctx, pl, c.serie.slice(0, t + 1).map((v, m) => [m, v]), c.col, c.id === 'mutuo' ? 3 : 2);
        if (t > 0 && t < MESES) VIZ.marcador(ctx, pl.sx(t), pl.sy(c.serie[t]), c.col, 4);
      });
      const [a, b, c, d] = curvas;
      lectura.set([
        ['rendimiento final: se impone', VIZ.fmt(a.serie[t], 3)],
        ['rendimiento final: ajuste mutuo', VIZ.fmt(d.serie[t], 3)],
        ['alcanza el umbral: solo organización', cuando(b.serie.slice(0, t + 1))],
        ['alcanza el umbral: solo tecnología', cuando(c.serie.slice(0, t + 1))],
        ['alcanza el umbral: ajuste mutuo', cuando(d.serie.slice(0, t + 1))],
        ['techo posible', VIZ.fmt(Tcap, 3)],
      ]);
      const exito = a.serie[t] >= META;
      registro.textContent = t === 0 ? `Mes 0: la tecnología rinde ${VIZ.fmt(Tcap * 0.4, 3)} efectivos y la organización parte en ${O0}; el rendimiento es ${VIZ.fmt(a.serie[0], 3)}. Pulse Reproducir.`
        : `Mes ${t}: ${exito ? 'incluso sin adaptarse el sistema supera el umbral.' : `imponer la tecnología deja el rendimiento en ${VIZ.fmt(a.serie[t], 3)}`}; con ajuste mutuo es ${VIZ.fmt(d.serie[t], 3)}${d.serie[t] >= META ? ' y ya supera el umbral' : ''}.`;
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) return tip.ocultar();
      const m = Math.max(0, Math.min(t, Math.round(pl.ix(x))));
      tip.mostrar(x, y, `mes <b>${m}</b>` + curvas.map((c) => VIZ.filaTooltip(c.col, c.nombre, VIZ.fmt(c.serie[m], 3))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    recalcular();
  }

  VIZ.registrarTema('sociotechnical-systems', {
    intro: String.raw`
      <p>Un <strong>sistema sociotécnico</strong> es aquel donde el rendimiento nace de la interacción entre una parte técnica (equipos,
      software, datos) y una parte social (personas, estructura, cultura, incentivos). Ninguna de las dos funciona sola: la mejor
      plataforma no entrega nada si nadie la usa bien, y un equipo muy motivado se frena si la herramienta no calza con su trabajo.</p>
      <p>Muchas implementaciones fracasan por tratar el proyecto como un asunto puramente técnico. Estas figuras separan los dos lados y
      muestran cuánto cuesta ignorar uno, y cómo el <em>ajuste mutuo</em> (cambiar la organización y también la herramienta) llega a buen
      puerto más rápido que cualquier lado por separado.</p>`,
    visualizaciones: [
      {
        titulo: 'Superficie de rendimiento',
        descripcion: 'El color es el rendimiento en función de tecnología y organización. Arrastre el punto a una zona desequilibrada (tecnología 80, organización 25) y compare invertir todo en un lado con el reparto óptimo; baje ρ para volver más complementarios ambos factores.',
        montar: montarSuperficie,
      },
      {
        titulo: 'Implementación y ajuste mutuo',
        descripcion: 'Una plataforma potente llega a una organización poco preparada. Observe cómo evolucionan cuatro estrategias en 36 meses y pruebe llevar uno de los aprendizajes a 0 %.',
        montar: montarAjuste,
      },
    ],
    teoria: String.raw`
      <h2>Interdependencia</h2>
      <p>En un sistema sociotécnico el resultado no es la suma de dos aportes sino una función conjunta. Un modelo simple es una función de
      elasticidad constante (CES):</p>
      \[ R(T, O) = \Big( \tfrac12 T^{\rho} + \tfrac12 O^{\rho} \Big)^{1/\rho}, \]
      <p>donde \(T\) es el nivel tecnológico, \(O\) el organizacional y \(\rho \le 1\) mide la sustituibilidad. Con \(\rho = 1\), \(R = (T+O)/2\): un
      factor compensa al otro. Cuando \(\rho \to -\infty\), \(R \to \min(T, O)\): el eslabón débil manda. Con \(\rho \to 0\) se obtiene
      \(\sqrt{TO}\). En sistemas de información reales \(\rho\) suele ser negativo, porque la tecnología sin procesos ni habilidades no
      rinde, y al revés.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Una empresa tiene \(T = 80\) y \(O = 25\) y puede mejorar 30 puntos. Con \(\rho = -1{,}5\):</p>
      <ul>
        <li>todo a tecnología: \(R(100, 25) \approx 36{,}7\);</li>
        <li>todo a organización: \(R(80, 55) \approx 64{,}6\), que además es el óptimo: ningún reparto lo supera.</li>
      </ul>
      <p>Aun con tecnología ya fuerte, el punto marginal más valioso está del lado débil. La derivada \(\partial R/\partial O\) es mucho mayor
      que \(\partial R/\partial T\), y por eso la figura marca un reparto desigual.</p>
      <h2>Ajuste mutuo</h2>
      <p>La literatura sobre implementación (Leavitt, Orlikowski) describe el cambio como adaptación en ambos sentidos. Una dinámica sencilla:</p>
      \[ O_{t+1} = O_t + a_O\,(T - O_t), \qquad f_{t+1} = f_t + a_T\,(1 - f_t), \qquad R_t = R(T f_t,\, O_t), \]
      <p>donde \(a_O\) es la velocidad con que la organización aprende (capacitación, nuevos procesos), \(a_T\) la de la personalización
      de la herramienta y \(f_t\) la fracción de su capacidad que realmente calza con el trabajo. Imponer la tecnología (\(a_O = a_T = 0\)) congela el
      rendimiento; cada lado por separado avanza hasta que el otro se convierte en la restricción; el ajuste mutuo sube más rápido porque
      elimina los dos cuellos de botella a la vez.</p>
      <div class="recuadro">Implementar un sistema es un proyecto de cambio organizacional que incluye tecnología, no al revés.</div>
      <h2>Por qué fallan las implementaciones</h2>
      <p>Resistencia al cambio, procesos que nadie rediseñó, capacitación tardía, incentivos que premian el comportamiento antiguo y
      una herramienta rígida que obliga a hacer trabajos innecesarios. Todas son brechas del lado social que ninguna mejora técnica
      cierra.</p>
      <h2>Conexiones</h2>
      <p>Los componentes de un sistema se describen en <a href="tema.html?id=is-components">Components of an Information System</a>; la gestión del
      cambio, en <a href="tema.html?id=change-management">Change Management and Organizational Innovation</a>; y la medición de si el proyecto logró algo,
      en <a href="tema.html?id=adoption-success-evaluation">Technology Adoption and Project Success</a>.</p>`,
  });
})();
