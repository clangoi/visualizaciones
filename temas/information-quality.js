(function () {
  'use strict';
  const { color: C } = VIZ;
  const SI = VIZ.si;
  const REG = SI.REGIONES;
  const REG_COL = { Norte: C.s1, Centro: C.s2, Sur: C.s3 };
  const pct = (v) => VIZ.fmt(v * 100, 3) + ' %';
  const mon = (v) => '$' + VIZ.entero(v);

  // Un escenario es una tabla de ventas con números aleatorios fijos por fila: así, subir un deslizador
  // solo suma filas defectuosas (nunca cambia las que ya lo eran) y la figura responde sin saltos.
  function escenario(semilla, meses) {
    const filas = SI.ventas(semilla, meses, 14), rnd = VIZ.semilla(semilla * 7 + 1);
    const az = filas.map(() => ({ e: rnd(), c: rnd(), d: rnd(), k: rnd(), f: rnd() < 0.5 ? 10 : 0.1 }));
    const real = Object.fromEntries(REG.map((r) => [r, filas.filter((x) => x.region === r).reduce((s, x) => s + x.ingreso, 0)]));
    return { filas, az, meses, real };
  }
  const lider = (tot) => REG.slice().sort((a, b) => tot[b] - tot[a]);

  // p: { exac, comp, dup, cons } fracciones de filas afectadas y retraso en meses sin cargar.
  function degradar(esc, p) {
    const tot = { Norte: 0, Centro: 0, Sur: 0, otros: 0 };
    let cargadas = 0, conError = 0, vacias = 0, variantes = 0, repetidas = 0;
    esc.filas.forEach((r, i) => {
      if (r.mes >= esc.meses - p.retraso) return;
      const a = esc.az[i];
      cargadas++;
      let v = r.ingreso;
      if (a.e < p.exac) { v *= a.f; conError++; }
      const reps = a.d < p.dup ? 2 : 1;
      if (reps === 2) repetidas++;
      let dest = r.region;
      if (a.c < p.comp) { dest = 'otros'; vacias++; } else if (a.k < p.cons) { dest = 'otros'; variantes++; }
      tot[dest] += v * reps;
    });
    const n = Math.max(1, cargadas);
    const dim = {
      exac: 1 - conError / n, comp: 1 - vacias / n, opor: (esc.meses - p.retraso) / esc.meses,
      dup: 1 - repetidas / (n + repetidas), cons: 1 - variantes / n,
    };
    return { tot, dim, cargadas };
  }
  const cero = { exac: 0, comp: 0, dup: 0, cons: 0, retraso: 0 };

  const DIMS = [
    ['exac', 'Exactitud'], ['comp', 'Completitud'], ['opor', 'Oportunidad'], ['dup', 'Unicidad'], ['cons', 'Consistencia'],
  ];

  /* ---------- Fig. 1: degradar los datos y mirar la decisión ---------- */

  function montarDegradar(cuerpo) {
    const MESES = 12;
    let semilla = 1, esc = escenario(semilla, MESES), p = { ...cero }, res = null, zonas = [];
    const ctl = VIZ.controles(cuerpo);
    const sl = {};
    const porc = (v) => `${Math.round(v * 100)} %`;
    sl.exac = ctl.rango({ etiqueta: 'Errores de captura (×10 o ÷10)', min: 0, max: 0.4, paso: 0.01, valor: 0, formato: porc, alCambiar: (v) => { p.exac = v; dibujar(); } });
    sl.comp = ctl.rango({ etiqueta: 'Región vacía', min: 0, max: 0.4, paso: 0.01, valor: 0, formato: porc, alCambiar: (v) => { p.comp = v; dibujar(); } });
    sl.opor = ctl.rango({ etiqueta: 'Retraso de carga', min: 0, max: 6, paso: 1, valor: 0, formato: (v) => `${v} ${v === 1 ? 'mes' : 'meses'}`, alCambiar: (v) => { p.retraso = v; dibujar(); } });
    sl.dup = ctl.rango({ etiqueta: 'Registros duplicados', min: 0, max: 0.4, paso: 0.01, valor: 0, formato: porc, alCambiar: (v) => { p.dup = v; dibujar(); } });
    sl.cons = ctl.rango({ etiqueta: 'Región mal escrita («norte »)', min: 0, max: 0.4, paso: 0.01, valor: 0, formato: porc, alCambiar: (v) => { p.cons = v; dibujar(); } });
    ctl.boton('Datos perfectos', () => { p = { ...cero }; Object.values(sl).forEach((s) => { s.valor = 0; }); dibujar(); });
    ctl.boton('Nuevos datos', () => { semilla++; esc = escenario(semilla, MESES); dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      ...REG.map((r) => ({ color: REG_COL[r], texto: `${r} según el sistema` })),
      { color: C.apagado, texto: 'ingreso sin región reconocible' },
      { color: C.tenue, borde: C.eje, texto: 'valor real' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La base es una tabla simulada de 12 meses (168 ventas). Cada deslizador agrega un defecto distinto; las barras claras muestran lo que realmente se vendió. Con un defecto pequeño la región líder puede cambiar: esa es la decisión que se pone en riesgo. Pase el cursor sobre las barras.');

    function dibujar() {
      res = degradar(esc, p);
      const { ctx } = lienzo;
      lienzo.limpiar();
      zonas = [];
      const grupos = [...REG, 'otros'];
      const maxv = Math.max(...grupos.map((g) => Math.max(res.tot[g], esc.real[g] || 0)));
      const pl = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0, ymax: maxv * 1.15 }, { etiquetaY: 'ingreso total ($)', ticksX: [], formatoY: (v) => VIZ.entero(v), margen: { izq: 70, sup: 34 } });
      pl.ejes();
      const lObs = lider(res.tot), lReal = lider(esc.real);
      grupos.forEach((g, i) => {
        const xa = pl.sx(i + 0.1), w = (pl.sx(i + 0.9) - xa) / 2 - 2;
        if (g !== 'otros') {
          const yr = pl.sy(esc.real[g]);
          ctx.fillStyle = C.tenue; ctx.strokeStyle = C.eje; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(xa, yr, w, pl.y0 - yr, [4, 4, 0, 0]); ctx.fill(); ctx.stroke();
        }
        const xb = xa + w + 4, yo = pl.sy(res.tot[g]);
        ctx.fillStyle = g === 'otros' ? C.apagado : REG_COL[g];
        ctx.beginPath(); ctx.roundRect(xb, yo, w, Math.max(0, pl.y0 - yo), [4, 4, 0, 0]); ctx.fill();
        ctx.textAlign = 'center'; ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11);
        ctx.fillText(g === 'otros' ? 'sin región' : g, xa + w + 2, pl.y0 + 16);
        if (g !== 'otros') {
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600);
          ctx.fillText(`${lObs.indexOf(g) + 1}.º`, xb + w / 2, yo - 6);
        }
        const e = esc.real[g] ? res.tot[g] / esc.real[g] - 1 : null;
        zonas.push({ x: xa - 2, y: pl.y1, w: 2 * w + 8, h: pl.y0 - pl.y1, html: `<b>${g === 'otros' ? 'sin región reconocible' : g}</b>` + (g !== 'otros' ? `<br>real <b>${mon(esc.real[g])}</b> (${lReal.indexOf(g) + 1}.º)` : '') + `<br>según el sistema <b>${mon(res.tot[g])}</b>` + (g !== 'otros' ? ` (${lObs.indexOf(g) + 1}.º)<br>error <b>${e >= 0 ? '+' : '−'}${pct(Math.abs(e))}</b>` : '') });
      });
      const cambia = lObs[0] !== lReal[0];
      const totReal = REG.reduce((s, r) => s + esc.real[r], 0), totObs = grupos.reduce((s, g) => s + res.tot[g], 0);
      const calidad = DIMS.reduce((s, [k]) => s + res.dim[k], 0) / 5;
      const debil = DIMS.slice().sort((a, b) => res.dim[a[0]] - res.dim[b[0]])[0];
      registro.textContent = `Calidad por dimensión: ${DIMS.map(([k, n]) => `${n.toLowerCase()} ${pct(res.dim[k])}`).join(', ')}. ` + (cambia ? `La decisión cambia: el sistema recomienda ${lObs[0]} cuando la líder real es ${lReal[0]}.` : `La decisión se mantiene: ${lReal[0]} sigue siendo la líder.`);
      lectura.set([
        ['región líder real', lReal[0]],
        ['región líder según el sistema', lObs[0]],
        ['¿decisión correcta?', cambia ? 'no' : 'sí'],
        ['error del ingreso total', `${totObs >= totReal ? '+' : '−'}${pct(Math.abs(totObs / totReal - 1))}`],
        ['calidad global (promedio)', pct(calidad)],
        ['dimensión más débil', debil[1]],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const z = zonas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (z) tip.mostrar(x, y, z.html); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: cuánto aguanta la decisión ---------- */

  const DEFECTOS = [
    ['exac', 'Errores de captura'], ['comp', 'Región vacía'], ['opor', 'Retraso de carga'], ['dup', 'Duplicados'], ['cons', 'Región mal escrita'], ['todos', 'Todos a la vez'],
  ];
  const NIVELES = Array.from({ length: 11 }, (_, i) => i * 0.05);
  const parametros = (defecto, nivel, meses) => {
    const p = { ...cero };
    const retraso = Math.round(nivel * meses);
    if (defecto === 'todos') return { exac: nivel, comp: nivel, dup: nivel, cons: nivel, retraso };
    if (defecto === 'opor') p.retraso = retraso; else p[defecto] = nivel;
    return p;
  };

  function montarAguante(cuerpo) {
    const MESES = 12;
    let defecto = 'exac', pruebas = 60, base = 1, curva = [], sel = -1, pl = null, hover = -1;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Defecto', opciones: DEFECTOS, valor: defecto, alCambiar: (v) => { defecto = v; calcular(); } });
    ctl.rango({ etiqueta: 'Bases simuladas por nivel', min: 20, max: 200, paso: 20, valor: pruebas, alCambiar: (v) => { pruebas = v; calcular(); } });
    ctl.boton('Nuevas pruebas', () => { base += 1000; calcular(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'decisiones correctas (% de bases)', forma: 'linea' },
      { color: C.s8, texto: 'error medio del ingreso de la región líder', forma: 'linea' },
      { color: C.apagado, texto: 'elegir al azar (33 %)', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Para cada nivel se generan bases distintas, se les inyecta el defecto y se cuenta cuántas veces la región líder sigue siendo la correcta. Haga clic en un nivel para fijarlo y compare defectos con el selector.');

    function calcular() {
      curva = NIVELES.map((nivel) => {
        let ok = 0, err = 0, brecha = 0;
        for (let s = 0; s < pruebas; s++) {
          const esc = escenario(base + s, MESES), res = degradar(esc, parametros(defecto, nivel, MESES));
          const lr = lider(esc.real), lo = lider(res.tot);
          if (lr[0] === lo[0]) ok++;
          err += Math.abs(res.tot[lr[0]] / esc.real[lr[0]] - 1);
          brecha += esc.real[lr[0]] / esc.real[lr[1]] - 1;
        }
        return { nivel, ok: ok / pruebas, err: err / pruebas, brecha: brecha / pruebas };
      });
      dibujar();
    }
    function dibujar() {
      if (!curva.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 0.5, ymin: 0, ymax: 100 }, { etiquetaX: defecto === 'opor' ? 'meses sin cargar (% de los 12)' : 'intensidad del defecto (% de registros)', etiquetaY: '%', formatoX: (v) => Math.round(v * 100) + ' %', ticksX: NIVELES.filter((_, i) => i % 2 === 0) });
      pl.ejes();
      VIZ.trazar(ctx, pl, [[0, 100 / 3], [0.5, 100 / 3]], C.apagado, 1.5, [3, 4]);
      VIZ.trazar(ctx, pl, curva.map((c) => [c.nivel, c.ok * 100]), C.s6, 2);
      VIZ.trazar(ctx, pl, curva.map((c) => [c.nivel, Math.min(100, c.err * 100)]), C.s8, 2);
      curva.forEach((c, i) => {
        VIZ.marcador(ctx, pl.sx(c.nivel), pl.sy(c.ok * 100), C.s6, i === hover || i === sel ? 6 : 3.5);
        VIZ.marcador(ctx, pl.sx(c.nivel), pl.sy(Math.min(100, c.err * 100)), C.s8, i === hover || i === sel ? 6 : 3.5, 1);
      });
      if (sel >= 0) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(pl.sx(curva[sel].nivel), pl.y1); ctx.lineTo(pl.sx(curva[sel].nivel), pl.y0); ctx.stroke(); ctx.setLineDash([]); }
      const c10 = curva[2], c = sel >= 0 ? curva[sel] : curva[2];
      const caida = curva.find((q) => q.ok < 0.9);
      registro.textContent = `${DEFECTOS.find((d) => d[0] === defecto)[1]} al ${Math.round(c.nivel * 100)} %: la decisión es correcta en ${pct(c.ok)} de ${pruebas} bases y el ingreso de la región líder se equivoca en promedio ${pct(c.err)}.`;
      lectura.set([
        ['correctas con 10 % de defecto', pct(c10.ok)],
        ['error del ingreso con 10 %', pct(c10.err)],
        ['primer nivel bajo 90 % de aciertos', caida ? Math.round(caida.nivel * 100) + ' %' : 'ninguno'],
        ['ventaja media de la líder', pct(curva[0].brecha)],
        ['nivel seleccionado', Math.round(c.nivel * 100) + ' %'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const nivelCercano = (x) => (pl ? Math.max(0, Math.min(10, Math.round(pl.ix(x) / 0.05))) : -1);
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = -1; tip.ocultar(); return dibujar(); }
      hover = nivelCercano(x);
      dibujar();
      const c = curva[hover];
      tip.mostrar(x, y, `defecto <b>${Math.round(c.nivel * 100)} %</b>` + VIZ.filaTooltip(C.s6, 'decisiones correctas', pct(c.ok)) + VIZ.filaTooltip(C.s8, 'error del ingreso líder', pct(c.err)));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const { x } = lienzo.posicion(ev); sel = nivelCercano(x); dibujar(); });
    calcular();
  }

  VIZ.registrarTema('information-quality', {
    intro: String.raw`
      <p>Una decisión es tan buena como la información que la sostiene. La <strong>calidad de la información</strong> se describe con
      varias dimensiones: que sea <em>exacta</em>, <em>completa</em>, <em>oportuna</em>, <em>consistente</em>, sin duplicados y
      <em>relevante</em> para quien decide. Un defecto en cualquiera de ellas no siempre se nota en el informe, pero puede cambiar la acción
      que se toma.</p>
      <p>Aquí se degrada a propósito una tabla de ventas y se mide algo concreto: si la región que el sistema recomienda sigue siendo la
      correcta. Verá que la calidad no es un lujo contable, sino una condición de la decisión.</p>`,
    visualizaciones: [
      {
        titulo: 'Degradar los datos',
        descripcion: 'Suba cada defecto y compare las barras del sistema con el valor real. Pruebe con 10 % de errores de captura y luego con 3 meses de retraso: el ranking de regiones puede cambiar con defectos pequeños.',
        montar: montarDegradar,
      },
      {
        titulo: 'Cuánto aguanta la decisión',
        descripcion: 'Para cada defecto e intensidad se simulan muchas bases y se cuenta cuántas veces la decisión sigue siendo correcta. Compare el retraso con los duplicados, o pruebe «Todos a la vez».',
        montar: montarAguante,
      },
    ],
    teoria: String.raw`
      <h2>Dimensiones de la calidad</h2>
      <table>
        <tr><th>Dimensión</th><th>Pregunta</th><th>Medida típica</th><th>Defecto simulado</th></tr>
        <tr><td>Exactitud</td><td>¿El valor es el real?</td><td>\(1 - \dfrac{\text{registros con error}}{\text{registros}}\)</td><td>un cero de más o de menos</td></tr>
        <tr><td>Completitud</td><td>¿Están todos los campos y registros?</td><td>\(1 - \dfrac{\text{campos vacíos}}{\text{campos}}\)</td><td>región vacía</td></tr>
        <tr><td>Oportunidad</td><td>¿Llega a tiempo para decidir?</td><td>periodos cargados / periodos esperados</td><td>meses sin cargar</td></tr>
        <tr><td>Unicidad</td><td>¿Cada hecho aparece una vez?</td><td>\(1 - \dfrac{\text{duplicados}}{\text{registros}}\)</td><td>ventas repetidas</td></tr>
        <tr><td>Consistencia</td><td>¿Se escribe igual en todas partes?</td><td>valores que cumplen el formato / total</td><td>«norte » en lugar de «Norte»</td></tr>
        <tr><td>Relevancia</td><td>¿Sirve para esta decisión?</td><td>juicio del usuario</td><td>no se simula: no se mide en la base</td></tr>
      </table>
      <h2>Por qué importa</h2>
      <p>Una decisión que elige la región con mayor ingreso es \(d = \arg\max_g T_g\), con \(T_g = \sum_{i \in g} x_i\). Si un defecto
      desplaza cada total en \(\varepsilon_g\), la decisión se conserva solo si la ventaja de la líder, \(T_1 - T_2\), supera el cambio
      relativo de los totales. Con regiones parecidas la ventaja es pequeña (unos pocos por ciento) y casi cualquier defecto la invierte.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Si Norte vende 5,2 millones y Centro 5,0 millones, la ventaja es \(5{,}2/5{,}0 - 1 = 4\,\%\). Si el 8 % de las ventas de Norte llega con la región vacía,
      su total observado baja a \(5{,}2 \times 0{,}92 = 4{,}78\) millones y Centro pasa a liderar: la decisión se invierte con un
      defecto de calidad menor que el margen. En cambio, un error uniforme que afecte a todas por igual no cambia el ranking.</p>
      <div class="recuadro">La calidad se gestiona en el origen: validar al capturar cuesta mucho menos que corregir un informe ya usado.</div>
      <h2>Cómo se mejora</h2>
      <p>Reglas de validación en los formularios, catálogos únicos (una sola forma de escribir «Norte»), claves para detectar duplicados,
      monitoreo de la hora de carga y responsables de datos. Todo esto es parte del gobierno de datos y del proceso
      <a href="tema.html?id=etl-process">ETL</a>.</p>
      <h2>Conexiones</h2>
      <p>La diferencia entre dato, información y conocimiento está en <a href="tema.html?id=data-information-knowledge">Data, Information and Knowledge</a>;
      la protección de los datos, en <a href="tema.html?id=data-protection">Data Protection</a>; y el costo de decidir con datos defectuosos
      reaparece en <a href="tema.html?id=dashboards-reports">Dashboards and Management Reports</a>.</p>`,
  });
})();
