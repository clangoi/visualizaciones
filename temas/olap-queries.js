(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const nombreMes = (m) => `${MESES[m % 12]} ${2023 + Math.floor(m / 12)}`;
  const dinero = (v) => `$${VIZ.entero(v)}`;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  // Cubo de ventas: 24 meses × 3 regiones × 3 productos × 2 canales.
  const cubo = (semilla) => S.ventas(semilla, 24, 14).map((r) => ({ ...r, margen: r.ingreso - r.costo, anioS: String(r.anio), trimS: `T${r.trim}` }));
  const MEDIDAS = [['ingreso', 'Ingreso', dinero], ['unidades', 'Unidades', (v) => VIZ.entero(v)], ['margen', 'Margen bruto', dinero]];

  /* ---------- Fig. 1: roll-up y drill-down ---------- */

  function montarJerarquia(cuerpo) {
    let semilla = 1, datos = cubo(1), nivel = 0, anio = null, trim = null, medida = 'ingreso', dividir = 'ninguna', op = '', barras = [], hover = -1, pl = null;
    const NIV = ['anio', 'trim', 'mes'];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Medida', opciones: MEDIDAS.map(([k, n]) => [k, n]), valor: medida, alCambiar: (v) => { medida = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Subtotales por', opciones: [['ninguna', 'ninguna'], ['region', 'región'], ['producto', 'producto'], ['canal', 'canal']], valor: dividir, alCambiar: (v) => { dividir = v; dibujar(); } });
    ctl.boton('Roll-up (subir un nivel)', () => {
      if (nivel === 0) return;
      nivel--; if (nivel === 1) trim = null; if (nivel === 0) anio = null;
      op = 'Roll-up: se suben los detalles a un nivel más agregado.'; dibujar();
    }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; datos = cubo(semilla); nivel = 0; anio = null; trim = null; op = ''; dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.42, altoMin: 250, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en una barra para hacer drill-down (año → trimestre → mes) y use «Roll-up» para volver. Agregue subtotales por región, producto o canal: cada barra se divide y su suma sigue siendo la barra. Pase el cursor para ver los valores exactos.');

    const fmt = () => MEDIDAS.find((m) => m[0] === medida)[2];
    const filtro = () => datos.filter((r) => (anio === null || r.anio === anio) && (trim === null || r.trim === trim));
    const cats = () => (dividir === 'ninguna' ? [] : dividir === 'region' ? S.REGIONES : dividir === 'producto' ? S.PRODUCTOS : S.CANALES);
    const etiqueta = (k) => (nivel === 0 ? String(k) : nivel === 1 ? `T${k}` : nombreMes(k));
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      const f = filtro(), campo = NIV[nivel];
      const claves = [...new Set(f.map((r) => r[campo]))].sort((a, b) => a - b);
      const ag = S.agrupar(f, dividir === 'ninguna' ? [campo] : [campo, dividir], medida);
      const val = (k, c) => (ag.find((g) => g.clave[0] === k && (dividir === 'ninguna' || g.clave[1] === c)) || { valor: 0 }).valor;
      const tot = claves.map((k) => (dividir === 'ninguna' ? val(k) : cats().reduce((s, c) => s + val(k, c), 0)));
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: claves.length, ymin: 0, ymax: Math.max(1, ...tot) * 1.12 }, { etiquetaY: fmt()(0) === '$0' ? 'ingreso en $' : MEDIDAS.find((m) => m[0] === medida)[1].toLowerCase(), ticksX: [], formatoY: (v) => VIZ.entero(v), margen: { izq: 70 } });
      pl.ejes();
      barras = [];
      const ancho = (pl.x1 - pl.x0) / claves.length;
      claves.forEach((k, i) => {
        const x = pl.x0 + i * ancho + 3, w = ancho - 6;
        let base = 0;
        const partes = dividir === 'ninguna' ? [[null, tot[i]]] : cats().map((c) => [c, val(k, c)]);
        partes.forEach(([c, v], j) => {
          const y0 = pl.sy(base), y1 = pl.sy(base + v);
          ctx.fillStyle = c === null ? C.s1 : C['s' + (j + 1)];
          if (i === hover) ctx.fillStyle = VIZ.alfa(ctx.fillStyle, 0.75);
          ctx.beginPath(); ctx.roundRect(x, y1, w, y0 - y1, j === partes.length - 1 ? [4, 4, 0, 0] : 0); ctx.fill();
          base += v;
        });
        ctx.font = VIZ.fuente(11, 500); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(etiqueta(k), x + w / 2, pl.y0 + 6);
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textBaseline = 'bottom';
        if (ancho > 46) ctx.fillText(VIZ.fmt(tot[i] / 1000, 3) + (medida === 'unidades' ? ' mil' : ' mil'), x + w / 2, pl.sy(tot[i]) - 3);
        barras.push({ x, w, k, tot: tot[i], partes });
      });
      ley.set(dividir === 'ninguna' ? [{ color: C.s1, texto: MEDIDAS.find((m) => m[0] === medida)[1].toLowerCase() }] : cats().map((c, j) => ({ color: C['s' + (j + 1)], texto: c })));
      const total = tot.reduce((s, v) => s + v, 0);
      const ruta = ['Todos los años', anio !== null ? String(anio) : null, trim !== null ? `T${trim}` : null].filter(Boolean).join(' › ');
      registro.textContent = `${ruta}${op ? ' · ' + op : ''}`;
      const cima = tot.indexOf(Math.max(...tot));
      lectura.set([
        ['nivel', ['año', 'trimestre', 'mes'][nivel]],
        ['barras', String(claves.length)],
        ['total visible', fmt()(total)],
        ['mayor barra', `${etiqueta(claves[cima])}: ${fmt()(tot[cima])}`],
        ['participación de la mayor', pct(tot[cima] / total)],
        ['filas de hechos resumidas', String(f.length)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const hallar = (x) => barras.findIndex((b) => x >= b.x && x <= b.x + b.w);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = pl && pl.dentro(x, y) ? hallar(x) : -1;
      lienzo.canvas.style.cursor = i >= 0 && nivel < 2 ? 'pointer' : 'default';
      if (i !== hover) { hover = i; dibujar(); }
      if (i < 0) return tip.ocultar();
      const b = barras[i];
      tip.mostrar(x, y, `<b>${etiqueta(b.k)}</b> · ${fmt()(b.tot)}` + (dividir === 'ninguna' ? '' : b.partes.map(([c, v], j) => VIZ.filaTooltip(C['s' + (j + 1)], c, fmt()(v))).join('')) + (nivel < 2 ? '<br>clic: drill-down' : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const i = pl && pl.dentro(x, y) ? hallar(x) : -1;
      if (i < 0 || nivel >= 2) return;
      const k = barras[i].k;
      if (nivel === 0) anio = k; else trim = k;
      nivel++;
      op = `Drill-down: se baja a ${nivel === 1 ? 'los trimestres de ' + anio : 'los meses de T' + trim + ' ' + anio}.`;
      hover = -1; dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: slice y dice ---------- */

  function montarCorte(cuerpo) {
    const datos = cubo(1), DIMS = { region: S.REGIONES, producto: S.PRODUCTOS, canal: S.CANALES, anio: ['2023', '2024'] };
    const sel = { region: new Set(S.REGIONES), producto: new Set(S.PRODUCTOS), canal: new Set(S.CANALES), anio: new Set(['2023', '2024']) };
    const nombres = { region: 'región', producto: 'producto', canal: 'canal', anio: 'año' };
    const sels = {};
    let celdas = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    const sincronizar = () => Object.keys(sel).forEach((d) => { sels[d].valor = sel[d].size === DIMS[d].length ? 'todos' : sel[d].size === 1 ? [...sel[d]][0] : 'varios'; });
    Object.keys(DIMS).forEach((d) => {
      sels[d] = ctl.selector({
        etiqueta: nombres[d][0].toUpperCase() + nombres[d].slice(1), opciones: [['todos', 'todos'], ...DIMS[d].map((v) => [v, v]), ['varios', '(varios)']], valor: 'todos',
        alCambiar: (v) => { if (v === 'varios') return sincronizar(); sel[d] = new Set(v === 'todos' ? DIMS[d] : [v]); dibujar(); },
      });
    });
    ctl.boton('Cubo completo', () => { Object.keys(sel).forEach((d) => { sel[d] = new Set(DIMS[d]); }); sincronizar(); dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w >= 560 ? 250 : 470) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'celda dentro del corte (más oscura = más ingreso)' }, { color: C.tenue, texto: 'celda fuera del corte' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'El cubo tiene tres ejes visibles (región, producto, canal) y el año como cuarto. Fije una dimensión en un solo valor para un <em>slice</em>; deje varios valores en una o más dimensiones para un <em>dice</em>. También puede hacer clic en una región, un producto o un canal del dibujo para incluirlo o excluirlo.');

    const celdaVal = (c, r, p) => datos.filter((x) => x.canal === c && x.region === r && x.producto === p && sel.anio.has(String(x.anio)));
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ancha = W >= 560, pw = ancha ? (W - 16) / 2 : W - 8, izq = 66, ph = 224;
      const tam = Math.min(70, (pw - izq - 4) / 3), alto = Math.min(52, (ph - 70) / 3);
      const vmax = Math.max(...S.CANALES.flatMap((c) => S.REGIONES.flatMap((r) => S.PRODUCTOS.map((p) => celdaVal(c, r, p).reduce((s, x) => s + x.ingreso, 0)))));
      celdas = [];
      let totalSel = 0, nSel = 0, nHechos = 0;
      S.CANALES.forEach((c, ci) => {
        const ox = ancha ? 4 + ci * (pw + 8) : 4, oy = ancha ? 0 : ci * 236;
        ctx.font = VIZ.fuente(12, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = sel.canal.has(c) ? C.tinta : C.apagado;
        ctx.fillText(`Canal ${c}`, ox, oy + 4);
        celdas.push({ x: ox, y: oy + 2, w: 90, h: 18, dim: 'canal', v: c });
        S.PRODUCTOS.forEach((p, j) => {
          ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = sel.producto.has(p) ? C.tinta2 : C.apagado; ctx.textAlign = 'center';
          ctx.fillText(p, ox + izq + j * tam + tam / 2, oy + 26);
          celdas.push({ x: ox + izq + j * tam, y: oy + 22, w: tam, h: 18, dim: 'producto', v: p });
        });
        S.REGIONES.forEach((r, i) => {
          const y = oy + 44 + i * alto;
          ctx.font = VIZ.fuente(10, 500); ctx.fillStyle = sel.region.has(r) ? C.tinta2 : C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(r, ox, y + alto / 2);
          celdas.push({ x: ox, y, w: izq - 4, h: alto, dim: 'region', v: r });
          S.PRODUCTOS.forEach((p, j) => {
            const hechos = celdaVal(c, r, p), v = hechos.reduce((s, x) => s + x.ingreso, 0);
            const dentro = sel.canal.has(c) && sel.region.has(r) && sel.producto.has(p), x = ox + izq + j * tam;
            ctx.fillStyle = dentro ? VIZ.css(VIZ.enRampa(0.15 + 0.85 * (v / vmax))) : C.tenue;
            ctx.beginPath(); ctx.roundRect(x + 1, y + 1, tam - 2, alto - 2, 4); ctx.fill();
            if (hover && hover.c === c && hover.r === r && hover.p === p) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
            ctx.font = VIZ.fuente(11, dentro ? 600 : 400); ctx.fillStyle = dentro ? (v / vmax > 0.55 ? C.sobre : C.tinta) : C.apagado; ctx.textAlign = 'center';
            ctx.fillText(VIZ.fmt(v / 1000, 3) + ' mil', x + tam / 2, y + alto / 2);
            celdas.push({ x: x + 1, y: y + 1, w: tam - 2, h: alto - 2, celda: { c, r, p, v, hechos } });
            if (dentro) { totalSel += v; nSel++; nHechos += hechos.length; }
          });
        });
      });
      const total = datos.reduce((s, x) => s + x.ingreso, 0), tamanos = Object.keys(sel).map((d) => sel[d].size);
      const restr = Object.keys(sel).filter((d) => sel[d].size < DIMS[d].length);
      const operacion = !restr.length ? 'cubo completo' : restr.length === 1 && sel[restr[0]].size === 1 ? 'slice' : 'dice';
      const where = restr.map((d) => `${nombres[d]} ${sel[d].size === 1 ? '= ' + [...sel[d]][0] : 'IN (' + [...sel[d]].join(', ') + ')'}`).join(' AND ');
      registro.textContent = operacion === 'cubo completo' ? 'Cubo completo: ninguna dimensión está restringida.'
        : `${operacion === 'slice' ? 'Slice' : 'Dice'}: WHERE ${where}. ${operacion === 'slice' ? 'Una dimensión queda fija y el cubo pierde una dimensión.' : 'Se conserva un sub-cubo con varios valores.'}`;
      lectura.set([
        ['operación', operacion],
        ['celdas en el corte', `${nSel} de 18`],
        ['filas de hechos', `${nHechos} de ${datos.length}`],
        ['ingreso del corte', dinero(totalSel)],
        ['parte del ingreso total', pct(totalSel / total)],
        ['ingreso medio por hecho', nHechos ? dinero(totalSel / nHechos) : '—'],
      ]);
      void tamanos;
    }
    lienzo.alDibujar = dibujar;
    const bajo = (x, y) => celdas.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const q = bajo(x, y);
      lienzo.canvas.style.cursor = q ? 'pointer' : 'default';
      const nuevo = q && q.celda ? { c: q.celda.c, r: q.celda.r, p: q.celda.p } : null;
      if ((nuevo && nuevo.c + nuevo.r + nuevo.p) !== (hover && hover.c + hover.r + hover.p)) { hover = nuevo; dibujar(); }
      if (!q || !q.celda) return tip.ocultar();
      const { c, r, p, v, hechos } = q.celda;
      tip.mostrar(x, y, `<b>${r} · ${p} · ${c}</b><br>ingreso <b>${dinero(v)}</b><br>unidades <b>${hechos.reduce((s, h) => s + h.unidades, 0)}</b><br>${hechos.length} filas de hechos`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const q = bajo(x, y);
      if (!q || !q.dim) return;
      const s = sel[q.dim];
      if (s.has(q.v)) { if (s.size > 1) s.delete(q.v); } else s.add(q.v);
      sincronizar(); dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 3: pivot ---------- */

  function montarPivot(cuerpo) {
    const datos = cubo(1);
    const DIM = { region: ['región', 'region'], producto: ['producto', 'producto'], canal: ['canal', 'canal'], anio: ['año', 'anioS'], trim: ['trimestre', 'trimS'] };
    let filas = 'region', cols = 'producto', medida = 'ingreso', relativo = false, foco = null;
    cuerpo.dataset.sinLeyenda = 'tabla numérica: cada celda muestra su valor y el sombreado azul crece con él';
    const ctl = VIZ.controles(cuerpo);
    const opts = Object.entries(DIM).map(([k, v]) => [k, v[0]]);
    const sF = ctl.selector({ etiqueta: 'Filas', opciones: opts, valor: filas, alCambiar: (v) => { filas = v; if (cols === v) { cols = Object.keys(DIM).find((k) => k !== v); sC.valor = cols; } foco = null; dibujar(); } });
    const sC = ctl.selector({ etiqueta: 'Columnas', opciones: opts, valor: cols, alCambiar: (v) => { cols = v; if (filas === v) { filas = Object.keys(DIM).find((k) => k !== v); sF.valor = filas; } foco = null; dibujar(); } });
    ctl.selector({ etiqueta: 'Medida', opciones: MEDIDAS.map(([k, n]) => [k, n]), valor: medida, alCambiar: (v) => { medida = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Mostrar como % del total', alCambiar: (v) => { relativo = v; dibujar(); } });
    ctl.boton('Intercambiar ejes (pivot)', () => { [filas, cols] = [cols, filas]; sF.valor = filas; sC.valor = cols; foco = null; dibujar(); }, { primario: true });
    const caja = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija qué dimensión va en filas y cuál en columnas, o intercambie los ejes con un clic. Haga clic en una celda para ver los hechos que la forman. Los totales de fila y columna son los subtotales del cubo; la esquina es el total general.');

    function dibujar() {
      const p = S.pivot(datos, DIM[filas][1], DIM[cols][1], medida), f = MEDIDAS.find((m) => m[0] === medida)[2];
      let vmax = 0;
      p.filas.forEach((r) => p.cols.forEach((c) => { vmax = Math.max(vmax, p.celda(r, c)); }));
      const mostrar = (v) => (relativo ? pct(v / p.total) : f(v));
      const tabla = VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, `${DIM[filas][0]} \\ ${DIM[cols][0]}`), ...p.cols.map((c) => VIZ.el('th', null, c)), VIZ.el('th', null, 'total')),
        ...p.filas.map((r) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, r),
          ...p.cols.map((c) => {
            const v = p.celda(r, c), act = foco && foco.r === r && foco.c === c;
            return VIZ.el('td', {
              class: 'celda-clic', style: { background: VIZ.css(VIZ.enRampa(0.05 + 0.45 * (v / vmax))), border: act ? `2px solid ${C.tinta}` : null },
              onclick: () => { foco = { r, c }; dibujar(); },
            }, mostrar(v));
          }),
          VIZ.el('td', { style: { fontWeight: 600 } }, mostrar(p.totalFila(r))))),
        VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, 'total'), ...p.cols.map((c) => VIZ.el('td', { style: { fontWeight: 600 } }, mostrar(p.totalCol(c)))), VIZ.el('td', { style: { fontWeight: 700 } }, mostrar(p.total))));
      caja.replaceChildren(tabla);
      const nom = MEDIDAS.find((m) => m[0] === medida)[1].toLowerCase();
      if (foco) {
        const h = datos.filter((x) => String(x[DIM[filas][1]]) === foco.r && String(x[DIM[cols][1]]) === foco.c);
        registro.textContent = `Celda «${foco.r} × ${foco.c}»: ${h.length} filas de hechos, ${nom} ${f(p.celda(foco.r, foco.c))} (${pct(p.celda(foco.r, foco.c) / p.total)} del total).`;
      } else registro.textContent = `Pivot de ${nom}: ${DIM[filas][0]} en filas y ${DIM[cols][0]} en columnas. Haga clic en una celda para ver sus hechos.`;
      let mayor = { v: -1 };
      p.filas.forEach((r) => p.cols.forEach((c) => { if (p.celda(r, c) > mayor.v) mayor = { v: p.celda(r, c), r, c }; }));
      lectura.set([
        ['celdas', String(p.filas.length * p.cols.length)],
        ['total general', f(p.total)],
        ['celda mayor', `${mayor.r} × ${mayor.c}`],
        ['valor de la celda mayor', f(mayor.v)],
        ['fila mayor', p.filas.reduce((a, r) => (p.totalFila(r) > p.totalFila(a) ? r : a))],
        ['columna mayor', p.cols.reduce((a, c) => (p.totalCol(c) > p.totalCol(a) ? c : a))],
      ]);
    }
    dibujar();
  }

  VIZ.registrarTema('olap-queries', {
    intro: String.raw`
      <p>El procesamiento analítico en línea (<strong>OLAP</strong>) consulta los datos como un <em>cubo</em>: una medida (ingreso, unidades) repartida a lo largo de dimensiones (tiempo, región, producto, canal).
      Sus operaciones básicas son agregar o desagregar siguiendo una jerarquía (<em>roll-up</em> y <em>drill-down</em>), recortar el cubo (<em>slice</em> y <em>dice</em>) y rotarlo para mirarlo desde otro eje (<em>pivot</em>).</p>
      <p>Las tres figuras usan el mismo cubo de ventas simuladas, con 24 meses, 3 regiones, 3 productos y 2 canales. Todos los totales se calculan de verdad desde las 336 filas de hechos, de modo que los subtotales siempre suman.</p>`,
    visualizaciones: [
      {
        titulo: 'Roll-up y drill-down',
        descripcion: 'Haga clic en un año para bajar a sus trimestres y en un trimestre para bajar a sus meses; con «Roll-up» regresa. Agregue subtotales por región y compruebe que las partes suman la barra.',
        montar: montarJerarquia,
      },
      {
        titulo: 'Slice y dice',
        descripcion: 'Fije una dimensión en un solo valor (slice) y luego deje dos valores en otra (dice). Haga clic en una región o producto del dibujo para incluirlo o excluirlo y mire cuánto del ingreso total queda.',
        montar: montarCorte,
      },
      {
        titulo: 'Tabla dinámica (pivot)',
        descripcion: 'Cambie las dimensiones de filas y columnas, o intercambie los ejes. Pruebe año contra trimestre y active el porcentaje del total: los totales de fila y columna no cambian de lugar, sino de lectura.',
        montar: montarPivot,
      },
    ],
    teoria: String.raw`
      <h2>El cubo y sus jerarquías</h2>
      <p>Un cubo de \(d\) dimensiones asigna a cada combinación de valores \((v_1, \dots, v_d)\) una medida agregada. Cada dimensión tiene <strong>jerarquías</strong>: tiempo (mes → trimestre → año), geografía
      (comuna → región → país). Subir en la jerarquía agrega; bajar detalla.</p>
      <table>
        <tr><th>Operación</th><th>Qué hace</th><th>Equivalente en SQL</th></tr>
        <tr><td>Roll-up</td><td>Agrega a un nivel superior (mes → trimestre)</td><td><code>GROUP BY trimestre</code> en vez de <code>GROUP BY mes</code></td></tr>
        <tr><td>Drill-down</td><td>Detalla a un nivel inferior (año → trimestre)</td><td>agregar un nivel a <code>GROUP BY</code> con <code>WHERE año = 2024</code></td></tr>
        <tr><td>Slice</td><td>Fija una dimensión en un valor; el cubo pierde una dimensión</td><td><code>WHERE región = 'Norte'</code></td></tr>
        <tr><td>Dice</td><td>Selecciona un sub-cubo con varios valores en una o más dimensiones</td><td><code>WHERE región IN (…) AND producto IN (…)</code></td></tr>
        <tr><td>Pivot</td><td>Rota los ejes: cambia qué dimensión va en filas y cuál en columnas</td><td>consulta con <code>CASE</code> o <code>PIVOT</code></td></tr>
      </table>
      <h2>Totales y subtotales</h2>
      <p>Como la suma es asociativa, agregar en cualquier orden da el mismo total. Si \(m(a, b)\) es el ingreso de la fila \(a\) y la columna \(b\):</p>
      \[ T_a = \sum_b m(a, b), \qquad T^b = \sum_a m(a, b), \qquad T = \sum_a T_a = \sum_b T^b. \]
      <p>Con \(d\) dimensiones, el cubo completo tiene \(2^d\) <em>agregaciones</em> (cada subconjunto de dimensiones que se conserva); aquí, con 4 dimensiones, 16. Precalcular algunas es el compromiso entre tiempo de consulta y espacio.</p>
      <p><strong>Ejemplo.</strong> Si en la región Norte el trimestre T1 de 2024 vende 120 000, 130 000 y 125 000 en sus tres meses, el roll-up a trimestre muestra 375 000; el drill-down desde ese valor reabre los tres meses. Si el slice «región = Norte» concentra
      el 33 % del ingreso total y se agrega «producto = Equipos», el dice resultante es un subconjunto estricto del anterior: la parte nunca supera al todo.</p>
      <div class="recuadro"><p><strong>Cuidado con las medidas no aditivas.</strong> Los ingresos se suman, pero un precio promedio o un margen porcentual no: al hacer roll-up se recalculan como razón de sumas, no como suma (ni promedio) de razones.</p></div>
      <h2>Conexiones</h2>
      <p>Las consultas OLAP se ejecutan sobre un <a href="tema.html?id=data-warehouse-marts">almacén en esquema estrella</a>, alimentado por <a href="tema.html?id=etl-process">ETL</a>; sus resultados se presentan en
      <a href="tema.html?id=dashboards-reports">tableros e informes</a>. La base teórica de agrupar y agregar está en <a href="tema.html?id=sql">SQL</a>.</p>`,
  });
})();
