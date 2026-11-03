(function () {
  'use strict';
  const { color: C } = VIZ;
  const pct = (v) => `${Math.round(v * 100)} %`;

  /* ---------- Fig. 1: matriz de derechos de decisión ---------- */

  // Arquetipos de gobierno de TI (Weill y Ross) con puntajes didácticos 0–1 en cuatro criterios.
  const CRIT = [['vel', 'Velocidad'], ['ali', 'Alineamiento'], ['inn', 'Innovación local'], ['efi', 'Eficiencia de costos']];
  const ARQ = [
    { id: 'mn', corto: 'Monarquía de negocio', txt: 'deciden los ejecutivos de negocio', p: { vel: 0.7, ali: 0.6, inn: 0.5, efi: 0.5 } },
    { id: 'mt', corto: 'Monarquía de TI', txt: 'decide el área de TI', p: { vel: 0.6, ali: 0.4, inn: 0.3, efi: 0.9 } },
    { id: 'fe', corto: 'Feudal', txt: 'cada unidad de negocio decide por sí sola', p: { vel: 0.9, ali: 0.2, inn: 0.9, efi: 0.2 } },
    { id: 'fd', corto: 'Federal', txt: 'el centro y las unidades deciden juntos', p: { vel: 0.4, ali: 0.9, inn: 0.6, efi: 0.7 } },
    { id: 'du', corto: 'Duopolio', txt: 'TI y un grupo de negocio deciden juntos', p: { vel: 0.5, ali: 0.8, inn: 0.5, efi: 0.7 } },
    { id: 'an', corto: 'Anarquía', txt: 'decide cada persona', p: { vel: 1, ali: 0, inn: 1, efi: 0 } },
  ];
  // Cinco decisiones de TI y cuánto pesa cada criterio en ellas.
  const DEC = [
    { nombre: 'Principios de TI', w: { vel: 1, ali: 3, inn: 1, efi: 1 } },
    { nombre: 'Arquitectura', w: { vel: 1, ali: 2, inn: 1, efi: 3 } },
    { nombre: 'Infraestructura', w: { vel: 1, ali: 1, inn: 0.5, efi: 4 } },
    { nombre: 'Aplicaciones de negocio', w: { vel: 3, ali: 1, inn: 3, efi: 1 } },
    { nombre: 'Inversión y prioridades', w: { vel: 1, ali: 4, inn: 1, efi: 2 } },
  ];
  const PRESETS = {
    central: { nombre: 'Centralizado (todo en TI)', v: ['mt', 'mt', 'mt', 'mt', 'mt'] },
    descentral: { nombre: 'Descentralizado (todo feudal)', v: ['fe', 'fe', 'fe', 'fe', 'fe'] },
    federal: { nombre: 'Federal recomendado', v: ['mn', 'mt', 'mt', 'du', 'fd'] },
    propia: { nombre: 'Personalizada', v: null },
  };
  const puntaje = (sel) => Object.fromEntries(CRIT.map(([k]) => [k, DEC.reduce((q, d, i) => q + d.w[k] * ARQ.find((a) => a.id === sel[i]).p[k], 0) / DEC.reduce((q, d) => q + d.w[k], 0)]));

  function montarMatriz(cuerpo) {
    let sel = PRESETS.federal.v.slice(), pesoCult = 0.5, geo = [];
    const ctl = VIZ.controles(cuerpo);
    const sPre = ctl.selector({ etiqueta: 'Punto de partida', opciones: Object.entries(PRESETS).map(([k, v]) => [k, v.nombre]), valor: 'federal', alCambiar: (v) => { if (PRESETS[v].v) { sel = PRESETS[v].v.slice(); pintar(); } } });
    ctl.rango({ etiqueta: 'Cultura: peso del alineamiento frente a la autonomía', min: 0, max: 1, paso: 0.05, valor: pesoCult, formato: pct, alCambiar: (v) => { pesoCult = v; pintar(); } });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.4, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'su matriz' }, { color: C.inactivo, texto: 'todo centralizado' }, { color: C.s2, texto: 'todo descentralizado' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una celda de la tabla para dar a esa decisión el derecho de decisión del arquetipo de su columna. Los puntajes son supuestos didácticos entre 0 y 1; el índice de éxito pondera alineamiento y eficiencia (peso de cultura) frente a velocidad e innovación local.');

    const tabla = VIZ.el('table', { class: 'tabla-datos sin-corte texto' });
    caja.appendChild(tabla);
    tabla.appendChild(VIZ.el('tr', null, VIZ.el('th', null, 'Decisión'), ...ARQ.map((a) => VIZ.el('th', { title: a.txt }, a.corto))));
    const celdas = DEC.map((d, i) => {
      const fila = VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, d.nombre));
      const cs = ARQ.map((a) => {
        const td = VIZ.el('td', { class: 'clicable', title: a.txt, onclick: () => { sel[i] = a.id; sPre.valor = 'propia'; pintar(); } }, '');
        fila.appendChild(td); return td;
      });
      tabla.appendChild(fila); return cs;
    });
    const indice = (p) => (pesoCult * (p.ali + p.efi) + (1 - pesoCult) * (p.vel + p.inn)) / 2;

    function pintar() {
      celdas.forEach((cs, i) => cs.forEach((td, j) => {
        const on = sel[i] === ARQ[j].id;
        td.textContent = on ? '●' : '○';
        td.style.color = on ? C.s1 : C.apagado;
        td.style.fontWeight = on ? 700 : 400;
      }));
      dibujar();
    }
    function dibujar() {
      const P = puntaje(sel), P1 = puntaje(PRESETS.central.v), P2 = puntaje(PRESETS.descentral.v);
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const izq = 8, inf = 34, sup = 14, gw = (W - 2 * izq) / CRIT.length, bw = Math.min(30, gw / 4);
      geo = [];
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, H - inf + 0.5); ctx.lineTo(W - izq, H - inf + 0.5); ctx.stroke();
      CRIT.forEach(([k, nom], c) => {
        [[P1[k], C.inactivo, 'todo centralizado'], [P[k], C.s1, 'su matriz'], [P2[k], C.s2, 'todo descentralizado']].forEach(([v, col, t], j) => {
          const x = izq + c * gw + gw / 2 + (j - 1) * (bw + 2) - bw / 2, h = v * (H - inf - sup);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, H - inf - h, bw, h, [4, 4, 0, 0]); ctx.fill();
          geo.push({ x, w: bw, k: c, v, col, t });
        });
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(nom, izq + c * gw + gw / 2, H - inf + 8);
      });
      const e = indice(P);
      registro.textContent = `Índice de éxito = ${pct(e)} (cultura ${pct(pesoCult)} orientada al alineamiento). ` + DEC.map((d, i) => `${d.nombre}: ${ARQ.find((a) => a.id === sel[i]).corto}`).join('; ') + '.';
      lectura.set([...CRIT.map(([k, n]) => [n, pct(P[k])]), ['índice de éxito', pct(e)], ['central / descentral.', `${pct(indice(P1))} / ${pct(indice(P2))}`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), b = geo.find((q) => x >= q.x && x <= q.x + q.w);
      if (!b) return tip.ocultar();
      tip.mostrar(x, y, `<b>${CRIT[b.k][1]}</b>` + VIZ.filaTooltip(b.col, b.t, pct(b.v)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    pintar();
  }

  /* ---------- Fig. 2: cultura y gobernanza ante muchas decisiones ---------- */

  const TIPOS = [['erp', 'Sistema corporativo (necesita estándar común)', 0.8], ['campo', 'Aplicación de terreno (necesita autonomía local)', 0.25], ['mixta', 'Mezcla de iniciativas', 0.5]];
  const UMBRAL = 0.55; // puntaje mínimo para considerar exitosa la iniciativa

  function montarSimulacion(cuerpo) {
    let semilla = 1, tipo = 'erp', g = 0.5, cult = 0.5, plazo = 40, base = [], hover = -1, pl = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de decisión de TI', opciones: TIPOS.map(([k, t]) => [k, t]), valor: tipo, alCambiar: (v) => { tipo = v; sorteo(); } });
    ctl.rango({ etiqueta: 'Gobernanza: centralización', min: 0, max: 1, paso: 0.05, valor: g, formato: pct, alCambiar: (v) => { g = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Cultura: apertura al cambio', min: 0, max: 1, paso: 0.05, valor: cult, formato: pct, alCambiar: (v) => { cult = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Plazo para decidir', min: 10, max: 80, paso: 5, valor: plazo, formato: (v) => `${v} d`, alCambiar: (v) => { plazo = v; dibujar(); } });
    ctl.boton('Nuevas iniciativas', () => { semilla++; sorteo(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'iniciativa exitosa' }, { color: C.s8, texto: 'fracasa (desalineada, rechazada o tardía)' }, { color: C.tinta, texto: 'umbral de éxito y plazo', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una de 150 iniciativas. Mueva la centralización: un sistema corporativo pide valores altos, una aplicación de terreno bajos, y centralizar demasiado alarga el tiempo de decisión (derecha). Baje la apertura cultural y vea cómo se hunden los puntajes aunque la gobernanza sea la correcta.');

    function sorteo() {
      const rnd = VIZ.semilla(semilla * 977), media = TIPOS.find((t) => t[0] === tipo)[2];
      base = Array.from({ length: 150 }, () => ({ e: Math.max(0, Math.min(1, media + 0.2 * VIZ.normal(rnd))), u: rnd(), a: 0.15 * VIZ.normal(rnd) }));
      dibujar();
    }
    const evaluar = (q, gg) => {
      const tiempo = 5 + 55 * gg * (0.6 + 0.8 * q.u), ali = 1 - Math.abs(gg - q.e), ape = Math.max(0, Math.min(1, cult + q.a));
      const puntaje = ali * (0.4 + 0.6 * ape);
      return { tiempo, ali, puntaje, ok: puntaje >= UMBRAL && tiempo <= plazo };
    };
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 70, ymin: 0, ymax: 1 }, { etiquetaX: 'tiempo de decisión (días)', etiquetaY: 'puntaje = alineamiento × adopción', formatoY: (v) => VIZ.fmt(v, 2) });
      pl.ejes();
      const res = base.map((q) => evaluar(q, g));
      ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pl.x0, pl.sy(UMBRAL)); ctx.lineTo(pl.x1, pl.sy(UMBRAL)); ctx.moveTo(pl.sx(plazo), pl.y1); ctx.lineTo(pl.sx(plazo), pl.y0); ctx.stroke(); ctx.restore();
      res.forEach((r, i) => {
        ctx.beginPath(); ctx.arc(pl.sx(r.tiempo), pl.sy(r.puntaje), i === hover ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = VIZ.alfa(r.ok ? C.s6 : C.s8, i === hover ? 1 : 0.7); ctx.fill();
      });
      ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('umbral', pl.x0 + 4, pl.sy(UMBRAL) - 2);
      ctx.textAlign = plazo > 55 ? 'right' : 'left'; ctx.textBaseline = 'top';
      ctx.fillText('plazo', pl.sx(plazo) + (plazo > 55 ? -4 : 4), pl.y1 + 2);
      lienzo.res = res;
      const ok = res.filter((r) => r.ok).length;
      const mejor = Array.from({ length: 21 }, (_, k) => k / 20).map((gg) => [gg, base.filter((q) => evaluar(q, gg).ok).length / base.length]).sort((a, b) => b[1] - a[1])[0];
      const tarde = res.filter((r) => r.puntaje >= UMBRAL && r.tiempo > plazo).length;
      registro.textContent = `${ok} de ${base.length} iniciativas cumplen puntaje ≥ ${UMBRAL} y plazo ≤ ${plazo} d. ${tarde} habrían funcionado pero decidirlas tardó demasiado. Con esta cultura y este plazo, la centralización que más éxitos da es ${pct(mejor[0])}.`;
      lectura.set([['éxito', pct(ok / base.length)], ['tiempo medio de decisión', `${VIZ.fmt(res.reduce((q, r) => q + r.tiempo, 0) / res.length, 3)} d`], ['alineamiento medio', pct(res.reduce((q, r) => q + r.ali, 0) / res.length)], ['correctas pero tardías', String(tarde)], ['mejor centralización', pct(mejor[0])], ['éxito en ese punto', pct(mejor[1])]]);
    }
    lienzo.alDibujar = () => base.length && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev); let m = -1, md = 100;
      (lienzo.res || []).forEach((r, i) => { const d = (pl.sx(r.tiempo) - x) ** 2 + (pl.sy(r.puntaje) - y) ** 2; if (d < md) { md = d; m = i; } });
      if (m !== hover) { hover = m; dibujar(); }
      if (m < 0) return tip.ocultar();
      const r = lienzo.res[m], q = base[m];
      tip.mostrar(x, y, `<b>Iniciativa ${m + 1}</b><br>estandarización necesaria <b>${pct(q.e)}</b><br>tiempo de decisión <b>${VIZ.fmt(r.tiempo, 3)} d</b><br>alineamiento <b>${pct(r.ali)}</b>` + VIZ.filaTooltip(r.ok ? C.s6 : C.s8, r.ok ? 'exitosa' : 'fracasa', null));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); if (base.length) dibujar(); });
    sorteo();
  }

  VIZ.registrarTema('culture-governance', {
    intro: String.raw`
      <p>La <strong>cultura organizacional</strong> es el conjunto de valores, hábitos y supuestos compartidos que explica por qué una empresa adopta o rechaza un sistema, aunque técnicamente funcione. La <strong>gobernanza de TI</strong> es el conjunto de reglas que fija <em>quién decide qué</em>: quién define los principios, la arquitectura, la infraestructura, las aplicaciones y las inversiones.</p>
      <p>Centralizar acelera el alineamiento y reduce duplicaciones, pero lentifica y ahoga la innovación local; descentralizar hace lo contrario. La mejor gobernanza no es una sola: se ajusta a cada decisión, y rinde solo si la cultura la acompaña.</p>`,
    visualizaciones: [
      {
        titulo: 'Matriz de derechos de decisión',
        descripcion: 'Asigne un arquetipo de gobierno a cada una de las cinco decisiones y compare con los extremos «todo centralizado» y «todo descentralizado». Pruebe el punto de partida federal, cambie una celda a la vez y mueva el peso cultural del alineamiento.',
        montar: montarMatriz,
      },
      {
        titulo: 'Gobernanza y cultura frente a 150 iniciativas',
        descripcion: 'Cambie el tipo de decisión y busque la centralización que maximiza los éxitos; luego baje la apertura al cambio o acorte el plazo y observe cuándo la gobernanza correcta ya no alcanza.',
        montar: montarSimulacion,
      },
    ],
    teoria: String.raw`
      <h2>Gobernanza de TI: quién decide qué</h2>
      <p>El marco de Weill y Ross separa cinco decisiones de TI (principios, arquitectura, infraestructura, necesidades de aplicaciones de negocio, inversión y priorización) y seis arquetipos de quién decide: monarquía de negocio, monarquía de TI, feudal, federal, duopolio y anarquía. La <em>matriz de derechos de decisión</em> es la tabla decisión × arquetipo que cada empresa llena con una elección por fila.</p>
      <p>En la primera figura el resultado de cada criterio \(k\) es un promedio ponderado de los puntajes de los arquetipos elegidos:</p>
      \[ P_k = \frac{\sum_{d} w_{d,k}\; p_{a(d),k}}{\sum_{d} w_{d,k}}, \qquad \text{índice} = \tfrac{1}{2}\big[\lambda\,(P_{\text{ali}} + P_{\text{efi}}) + (1-\lambda)\,(P_{\text{vel}} + P_{\text{inn}})\big], \]
      <p>donde \(a(d)\) es el arquetipo elegido para la decisión \(d\), \(w_{d,k}\) el peso del criterio en esa decisión y \(\lambda\) el peso cultural del alineamiento. Los números son supuestos didácticos, no mediciones: lo que importa es la lógica de compromiso.</p>
      <h2>Cultura y ajuste</h2>
      <p>En la segunda figura cada iniciativa tiene una necesidad de estandarización \(e\) (alta para un ERP, baja para una aplicación de terreno). Con centralización \(g\):</p>
      \[ \text{alineamiento} = 1 - |g - e|, \qquad \text{puntaje} = \text{alineamiento} \times (0{,}4 + 0{,}6\,a), \qquad t = 5 + 55\,g\,(0{,}6 + 0{,}8u) \ \text{días}, \]
      <p>con \(a\) la apertura al cambio de quienes deben adoptar el sistema y \(u\) un sorteo que representa lo complejo de cada caso. Una iniciativa tiene éxito si el puntaje supera 0,55 <em>y</em> se decide dentro del plazo. Así la gobernanza ajusta el alineamiento, la cultura multiplica la adopción y la centralización paga con tiempo.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Un sistema corporativo con \(e = 0{,}8\) bajo \(g = 0{,}8\) tiene alineamiento 1; con apertura \(a = 0{,}5\) el puntaje es \(1 \times 0{,}7 = 0{,}70\) y supera el umbral, pero tarda unos \(5 + 55 \times 0{,}8 = 49\) días. Si el plazo es de 40 días, fracasa por tardío aunque sea la gobernanza correcta.</p></div>
      <h2>Conexiones</h2>
      <p>La estructura formal de la empresa, vista en <a href="tema.html?id=organizational-structures">estructuras organizacionales</a>, determina qué arquetipos son viables. El resultado de una gobernanza sana es el <a href="tema.html?id=strategic-alignment">alineamiento estratégico de TI</a>, y los criterios de priorización de inversiones están en <a href="tema.html?id=it-investment-decisions">decisiones de inversión en TI</a>. Para el rol del cambio cultural en proyectos, véase <a href="tema.html?id=change-management">gestión del cambio</a>.</p>`,
  });
})();
