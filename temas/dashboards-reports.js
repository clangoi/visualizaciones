(function () {
  'use strict';
  const { color: C } = VIZ;
  const S = VIZ.si;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const nombreMes = (m) => `${MESES[m % 12]} ${String(2023 + Math.floor(m / 12)).slice(2)}`;
  const dinero = (v) => `$${VIZ.entero(v)}`;
  const pct = (v) => `${VIZ.fmt(v * 100, 3)} %`;
  const miles = (v) => `${VIZ.fmt(v / 1000, 3)} mil`;
  const suma = (f, c) => f.reduce((s, r) => s + r[c], 0);
  const cubo = (semilla) => S.ventas(semilla, 24, 14);

  /* ---------- Fig. 1: tablero frente a reporte tabular ---------- */

  const NIVELES = {
    estrategico: { n: 'Estratégico (gerencia general)', pregunta: '¿Crecemos y con qué margen?' },
    tactico: { n: 'Táctico (gerencia comercial)', pregunta: '¿Cómo evoluciona cada mes y cada producto?' },
    operativo: { n: 'Operativo (jefe de ventas)', pregunta: '¿Qué pasó en los últimos meses y por canal?' },
  };

  function montarTablero(cuerpo) {
    let semilla = 1, datos = cubo(1), nivel = 'tactico', vista = 'tablero', fReg = '', fProd = '', zonas = [], hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Nivel del lector', opciones: Object.entries(NIVELES).map(([k, v]) => [k, v.n]), valor: nivel, alCambiar: (v) => { nivel = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Vista', opciones: [['tablero', 'Tablero (gráficos)'], ['reporte', 'Reporte tabular']], valor: vista, alCambiar: (v) => { vista = v; dibujar(); } });
    const sReg = ctl.selector({ etiqueta: 'Región', opciones: [['', 'todas'], ...S.REGIONES.map((r) => [r, r])], valor: fReg, alCambiar: (v) => { fReg = v; dibujar(); } });
    const sProd = ctl.selector({ etiqueta: 'Producto', opciones: [['', 'todos'], ...S.PRODUCTOS.map((r) => [r, r])], valor: fProd, alCambiar: (v) => { fProd = v; dibujar(); } });
    ctl.boton('Limpiar filtros', () => { fReg = ''; fProd = ''; sReg.valor = ''; sProd.valor = ''; dibujar(); }, { primario: true });
    ctl.boton('Nuevos datos', () => { semilla++; datos = cubo(semilla); dibujar(); });

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w >= 620 ? 340 : 480) });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'valor mostrado (o selección actual)' }, { color: C.tenue, texto: 'resto, cuando hay un filtro por clic' }]);
    const caja = VIZ.el('div', { class: 'caja-desplazable caja-alta' });
    cuerpo.appendChild(caja);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'En el tablero, haga clic en una barra de región o de producto para filtrar todo lo demás (otro clic la quita). Cambie el nivel del lector: el gerente general necesita 3 cifras; el jefe de ventas, el detalle reciente. Compare con el reporte tabular y fíjese en cuántas cifras debe leer.');

    const filtrado = (omitir) => datos.filter((r) => (omitir === 'region' || !fReg || r.region === fReg) && (omitir === 'producto' || !fProd || r.producto === fProd));
    const kpis = () => {
      const f = filtrado();
      const mes = (m) => f.filter((r) => r.mes === m);
      const anio = (a) => f.filter((r) => r.anio === a);
      const marg = (g) => 1 - suma(g, 'costo') / Math.max(1, suma(g, 'ingreso'));
      if (nivel === 'estrategico') return [['ingreso 2024', dinero(suma(anio(2024), 'ingreso'))], ['crecimiento interanual', pct(suma(anio(2024), 'ingreso') / suma(anio(2023), 'ingreso') - 1)], ['margen bruto 2024', pct(marg(anio(2024)))]];
      if (nivel === 'tactico') return [['ingreso dic 24', dinero(suma(mes(23), 'ingreso'))], ['vs dic 23', pct(suma(mes(23), 'ingreso') / suma(mes(11), 'ingreso') - 1)], ['margen dic 24', pct(marg(mes(23)))], ['unidades dic 24', VIZ.entero(suma(mes(23), 'unidades'))], ['ingreso 2024', dinero(suma(anio(2024), 'ingreso'))]];
      const u = mes(23);
      return [['unidades dic 24', VIZ.entero(suma(u, 'unidades'))], ['ingreso por unidad', dinero(suma(u, 'ingreso') / Math.max(1, suma(u, 'unidades')))], ['% del ingreso por web', pct(suma(u.filter((r) => r.canal === 'Web'), 'ingreso') / Math.max(1, suma(u, 'ingreso')))], ['ingreso dic 24', dinero(suma(u, 'ingreso'))]];
    };
    // Datos del gráfico principal según el nivel.
    function principal() {
      const f = filtrado();
      if (nivel === 'estrategico') return { tipo: 'barras', items: [...Array(8).keys()].map((q) => ({ k: q, label: `T${(q % 4) + 1} ${String(23 + Math.floor(q / 4)).padStart(2, '0')}`, v: suma(f.filter((r) => r.anio === 2023 + Math.floor(q / 4) && r.trim === (q % 4) + 1), 'ingreso') })), titulo: 'Ingreso por trimestre' };
      if (nivel === 'tactico') return { tipo: 'linea', items: [...Array(24).keys()].map((m) => ({ k: m, label: nombreMes(m), v: suma(f.filter((r) => r.mes === m), 'ingreso') })), titulo: 'Ingreso mensual' };
      return { tipo: 'barras', items: [18, 19, 20, 21, 22, 23].map((m) => ({ k: m, label: nombreMes(m), v: suma(f.filter((r) => r.mes === m), 'unidades') })), titulo: 'Unidades por mes (últimos 6)' };
    }
    function dibujar() {
      const tablero = vista === 'tablero';
      lienzo.envoltura.hidden = !tablero; ley.caja.hidden = !tablero; caja.hidden = tablero;
      const k = kpis();
      if (tablero) {
        pintar();
      } else {
        const p = principal(), f = filtrado();
        const filas = nivel === 'estrategico' ? [...Array(8).keys()] : nivel === 'tactico' ? [...Array(24).keys()] : [18, 19, 20, 21, 22, 23];
        const sel = (q) => f.filter((r) => (nivel === 'estrategico' ? r.anio === 2023 + Math.floor(q / 4) && r.trim === (q % 4) + 1 : r.mes === q));
        const etq = (q) => (nivel === 'estrategico' ? p.items[q].label : nombreMes(q));
        const cols = ['unidades', ...S.REGIONES, ...S.PRODUCTOS, 'total ingreso', 'margen'];
        caja.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
          VIZ.el('tr', null, VIZ.el('th', { class: 'izq' }, 'periodo'), ...cols.map((c) => VIZ.el('th', null, c))),
          ...filas.map((q) => { const g = sel(q); return VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, etq(q)), VIZ.el('td', null, VIZ.entero(suma(g, 'unidades'))),
            ...S.REGIONES.map((r) => VIZ.el('td', null, VIZ.entero(suma(g.filter((x) => x.region === r), 'ingreso')))), ...S.PRODUCTOS.map((r) => VIZ.el('td', null, VIZ.entero(suma(g.filter((x) => x.producto === r), 'ingreso')))),
            VIZ.el('td', null, VIZ.entero(suma(g, 'ingreso'))), VIZ.el('td', null, pct(1 - suma(g, 'costo') / Math.max(1, suma(g, 'ingreso'))))); })));
        var cifras = filas.length * (cols.length);
      }
      const p0 = principal();
      const nCifras = tablero ? k.length + p0.items.length + 6 : cifras;
      registro.textContent = `${NIVELES[nivel].n}: «${NIVELES[nivel].pregunta}» ` + (fReg || fProd ? `Filtro activo: ${[fReg, fProd].filter(Boolean).join(' + ')}.` : 'Sin filtros.');
      lectura.set([...k.slice(0, 4), ['cifras que debe leer el lector', String(nCifras)], ['vista', tablero ? 'tablero' : 'reporte tabular']]);
    }
    function pintar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const ancha = W >= 620, pad = 8, gap = 14;
      const hA = ancha ? 170 : 170, hB = ancha ? H - hA - gap - 2 * pad : (H - hA - gap * 2 - 2 * pad) / 2;
      const rA = { x: pad, y: pad, w: W - 2 * pad, h: hA };
      const wB = ancha ? (W - 2 * pad - gap) / 2 : W - 2 * pad;
      const rB = { x: pad, y: pad + hA + gap, w: wB, h: hB };
      const rC = ancha ? { x: pad + wB + gap, y: rB.y, w: wB, h: hB } : { x: pad, y: rB.y + hB + gap, w: wB, h: hB };
      zonas = [];
      // Panel principal
      const p = principal(), vmax = Math.max(1, ...p.items.map((i) => i.v)) * 1.12;
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(p.titulo, rA.x, rA.y);
      const ax = rA.x + 6, aw = rA.w - 12, ay = rA.y + 22, ah = rA.h - 22 - 18, n = p.items.length;
      ctx.strokeStyle = C.eje; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay + ah + 0.5); ctx.lineTo(ax + aw, ay + ah + 0.5); ctx.stroke();
      p.items.forEach((it, i) => {
        const cx = p.tipo === 'linea' ? ax + (i / (n - 1)) * aw : ax + (i + 0.5) * (aw / n);
        it.x = cx; it.y = ay + ah - (it.v / vmax) * ah;
        zonas.push({ x: cx - aw / n / 2, y: rA.y, w: aw / n, h: rA.h, tip: `<b>${it.label}</b><br>${p.titulo.split(' (')[0].toLowerCase()}: <b>${p.titulo.startsWith('Unidades') ? VIZ.entero(it.v) : dinero(it.v)}</b>` });
        if (p.tipo === 'barras') {
          ctx.fillStyle = hover === `A${i}` ? VIZ.alfa(C.s1, 0.7) : C.s1;
          const w = aw / n - 6;
          ctx.beginPath(); ctx.roundRect(cx - w / 2, it.y, w, ay + ah - it.y, [4, 4, 0, 0]); ctx.fill();
          ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(it.label, cx, ay + ah + 4);
          if (aw / n > 44) { ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textBaseline = 'bottom'; ctx.fillText(miles(it.v), cx, it.y - 2); }
        }
      });
      if (p.tipo === 'linea') {
        VIZ.trazar(ctx, { sx: (v) => p.items[v].x, sy: (v) => v }, p.items.map((it, i) => [i, it.y]), C.s1, 2.5);
        [0, 11, 23].forEach((i) => { ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = i === 0 ? 'left' : i === 23 ? 'right' : 'center'; ctx.textBaseline = 'top'; ctx.fillText(p.items[i].label, p.items[i].x, ay + ah + 4); });
        const m = typeof hover === 'string' && hover[0] === 'A' ? +hover.slice(1) : 23;
        VIZ.marcador(ctx, p.items[m].x, p.items[m].y, C.s1, 5);
      }
      // Paneles de filtro
      const panelBarras = (r, titulo, dim, cats, actual) => {
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(titulo, r.x, r.y);
        const vals = cats.map((c) => suma(filtrado(dim).filter((x) => x[dim] === c), 'ingreso')), m = Math.max(1, ...vals), izq = 62, fila = (r.h - 22) / cats.length;
        cats.forEach((c, i) => {
          const y = r.y + 22 + i * fila, w = (vals[i] / m) * (r.w - izq - 62), activo = !actual || actual === c;
          ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(c, r.x, y + fila / 2);
          ctx.fillStyle = activo ? C.s1 : C.tenue;
          if (hover === `${dim}${i}`) ctx.fillStyle = VIZ.alfa(C.s1, 0.7);
          ctx.beginPath(); ctx.roundRect(r.x + izq, y + 3, Math.max(2, w), Math.max(8, fila - 8), [0, 4, 4, 0]); ctx.fill();
          ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(10, 600); ctx.fillText(miles(vals[i]), r.x + izq + w + 5, y + fila / 2);
          zonas.push({ x: r.x, y, w: r.w, h: fila, filtro: [dim, c], id: `${dim}${i}`, tip: `<b>${c}</b><br>ingreso <b>${dinero(vals[i])}</b><br>clic: ${actual === c ? 'quitar filtro' : 'filtrar por ' + c}` });
        });
      };
      panelBarras(rB, 'Ingreso por región', 'region', S.REGIONES, fReg);
      panelBarras(rC, 'Ingreso por producto', 'producto', S.PRODUCTOS, fProd);
      // Hover de la zona principal
    }
    lienzo.alDibujar = () => dibujar();
    const bajo = (x, y) => zonas.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), z = bajo(x, y);
      lienzo.canvas.style.cursor = z && z.filtro ? 'pointer' : 'default';
      const idx = z ? (z.id || `A${zonas.filter((q) => !q.id).indexOf(z)}`) : null;
      if (idx !== hover) { hover = idx; pintar(); }
      if (!z) return tip.ocultar();
      tip.mostrar(x, y, z.tip);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); pintar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), z = bajo(x, y);
      if (!z || !z.filtro) return;
      const [d, v] = z.filtro;
      if (d === 'region') { fReg = fReg === v ? '' : v; sReg.valor = fReg; } else { fProd = fProd === v ? '' : v; sProd.valor = fProd; }
      dibujar();
    });
    dibujar();
  }

  /* ---------- Fig. 2: elegir el gráfico adecuado ---------- */

  const PREGUNTAS = {
    comparacion: { n: '¿Qué región vende más? (comparar categorías)', dato: 'categorías' },
    evolucion: { n: '¿Cómo evolucionó el ingreso? (tiempo)', dato: 'serie' },
    composicion: { n: '¿Cuánto aporta cada producto? (composición)', dato: 'categorías' },
    relacion: { n: '¿Cómo se relacionan unidades e ingreso? (relación)', dato: 'pares' },
    distribucion: { n: '¿Cómo se reparte el ingreso por venta? (distribución)', dato: 'valores' },
  };
  const GRAFICOS = [['barras', 'Barras'], ['lineas', 'Líneas'], ['apiladas', 'Barras apiladas'], ['torta', 'Circular (torta)'], ['dispersion', 'Dispersión'], ['histograma', 'Histograma']];
  // Juicio de adecuación por pregunta y gráfico (con su razón).
  const JUICIO = {
    comparacion: { barras: ['adecuado', 'la longitud de una barra se compara con precisión desde una base común'], lineas: ['inadecuado', 'la línea sugiere un orden y una continuidad que las regiones no tienen'], apiladas: ['aceptable', 'sirve si interesa también la parte de cada producto, pero solo la base se compara bien'], torta: ['inadecuado', 'los ángulos y áreas se comparan peor que las longitudes'] },
    evolucion: { barras: ['aceptable', 'muestra cada mes, pero 24 barras ocultan la forma de la tendencia'], lineas: ['adecuado', 'la pendiente de la línea muestra de inmediato el crecimiento y la estacionalidad'], apiladas: ['aceptable', 'permite ver la mezcla de productos, pero solo el producto de la base se sigue con claridad'], torta: ['inadecuado', 'el tiempo no es una parte de un todo: 24 sectores no dicen nada'] },
    composicion: { barras: ['adecuado', 'tres barras permiten comparar con exactitud las partes'], lineas: ['inadecuado', 'unir partes de un todo con una línea no tiene sentido'], apiladas: ['adecuado', 'una barra al 100 % muestra la parte de cada producto en el total'], torta: ['aceptable', 'sirve solo con pocas partes y diferencias grandes; aquí hay 3'] },
    relacion: { dispersion: ['adecuado', 'cada punto es una venta: la nube muestra la relación y su dispersión'] },
    distribucion: { histograma: ['adecuado', 'agrupa las ventas por rangos y muestra la forma de la distribución'] },
  };

  function montarElegir(cuerpo) {
    const datos = cubo(1);
    let preg = 'comparacion', graf = 'barras', hover = -1, zonas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Pregunta del gerente', opciones: Object.entries(PREGUNTAS).map(([k, v]) => [k, v.n]), valor: preg, alCambiar: (v) => { preg = v; dibujar(); } });
    const sGraf = ctl.selector({ etiqueta: 'Gráfico elegido', opciones: GRAFICOS, valor: graf, alCambiar: (v) => { graf = v; dibujar(); } });
    ctl.boton('Probar el gráfico recomendado', () => { graf = Object.entries(JUICIO[preg]).find(([, j]) => j[0] === 'adecuado')[0]; sGraf.valor = graf; dibujar(); }, { primario: true });

    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    const ley = VIZ.leyenda(cuerpo, []);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Elija una pregunta y un gráfico. El sistema dibuja los datos reales de esa pregunta con el gráfico elegido, cuando es posible, y dice si es adecuado, aceptable o inadecuado. Pruebe una torta con 24 meses: se ve por qué no conviene. Pase el cursor sobre las marcas para ver valores.');

    const porRegion = () => S.REGIONES.map((r) => [r, suma(datos.filter((x) => x.region === r), 'ingreso')]);
    const porProducto = () => S.PRODUCTOS.map((r) => [r, suma(datos.filter((x) => x.producto === r), 'ingreso')]);
    const serie = () => [...Array(24).keys()].map((m) => S.PRODUCTOS.map((p) => suma(datos.filter((x) => x.mes === m && x.producto === p), 'ingreso')));
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      zonas = [];
      const dato = PREGUNTAS[preg].dato, j = JUICIO[preg][graf];
      let leyenda = [], marcas = 0;
      const cats = preg === 'composicion' ? porProducto() : porRegion();
      const texto = (t) => { ctx.font = VIZ.fuente(12); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, W / 2, H / 2); };
      if (!j) texto(`Un gráfico de ${GRAFICOS.find((g) => g[0] === graf)[1].toLowerCase()} no puede mostrar datos de tipo «${dato}».`);
      else if (graf === 'barras' && dato === 'categorías') {
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: cats.length, ymin: 0, ymax: Math.max(...cats.map((c) => c[1])) * 1.12 }, { ticksX: [], formatoY: (v) => miles(v) });
        pl.ejes(); const w = (pl.x1 - pl.x0) / cats.length;
        cats.forEach(([c, v], i) => {
          ctx.fillStyle = hover === i ? VIZ.alfa(C.s1, 0.7) : C.s1; ctx.beginPath(); ctx.roundRect(pl.x0 + i * w + 8, pl.sy(v), w - 16, pl.y0 - pl.sy(v), [4, 4, 0, 0]); ctx.fill();
          ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(c, pl.x0 + (i + 0.5) * w, pl.y0 + 6);
          zonas.push({ x: pl.x0 + i * w, y: pl.y1, w, h: pl.y0 - pl.y1, tip: `<b>${c}</b><br>ingreso <b>${dinero(v)}</b>` });
        });
        marcas = cats.length; leyenda = [{ color: C.s1, texto: 'ingreso' }];
      } else if ((graf === 'barras' || graf === 'lineas') && dato === 'serie') {
        const s = serie().map((a) => a.reduce((x, y) => x + y, 0));
        const pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: 24.5, ymin: 0, ymax: Math.max(...s) * 1.12 }, { ticksX: [1, 6, 12, 18, 24], formatoY: (v) => miles(v), etiquetaX: 'mes' });
        pl.ejes();
        if (graf === 'lineas') { VIZ.trazar(ctx, pl, s.map((v, i) => [i + 1, v]), C.s1, 2.5); if (hover >= 0) VIZ.marcador(ctx, pl.sx(hover + 1), pl.sy(s[hover]), C.s1, 5); }
        else s.forEach((v, i) => { const w = pl.sx(1) - pl.sx(0) - 2; ctx.fillStyle = hover === i ? VIZ.alfa(C.s1, 0.7) : C.s1; ctx.beginPath(); ctx.roundRect(pl.sx(i + 1) - w / 2, pl.sy(v), w, pl.y0 - pl.sy(v), [3, 3, 0, 0]); ctx.fill(); });
        s.forEach((v, i) => zonas.push({ x: pl.sx(i + 1) - (pl.sx(1) - pl.sx(0)) / 2, y: pl.y1, w: pl.sx(1) - pl.sx(0), h: pl.y0 - pl.y1, tip: `<b>${nombreMes(i)}</b><br>ingreso <b>${dinero(v)}</b>` }));
        marcas = 24; leyenda = [{ color: C.s1, texto: 'ingreso mensual', forma: graf === 'lineas' ? 'linea' : 'cuadro' }];
      } else if (graf === 'lineas' && dato === 'categorías') {
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: cats.length, ymin: 0, ymax: Math.max(...cats.map((c) => c[1])) * 1.12 }, { ticksX: [], formatoY: (v) => miles(v) });
        pl.ejes(); const w = (pl.x1 - pl.x0) / cats.length;
        VIZ.trazar(ctx, pl, cats.map(([, v], i) => [i + 0.5, v]), C.s1, 2.5);
        cats.forEach(([c, v], i) => { VIZ.marcador(ctx, pl.sx(i + 0.5), pl.sy(v), C.s1, 5); ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(c, pl.sx(i + 0.5), pl.y0 + 6); zonas.push({ x: pl.x0 + i * w, y: pl.y1, w, h: pl.y0 - pl.y1, tip: `<b>${c}</b><br>ingreso <b>${dinero(v)}</b>` }); });
        marcas = cats.length; leyenda = [{ color: C.s1, texto: 'ingreso', forma: 'linea' }];
      } else if (graf === 'apiladas' && dato === 'categorías') {
        const tot = cats.reduce((s, c) => s + c[1], 0), x0 = 40, w = W - 80, y = H / 2 - 28;
        let x = x0;
        cats.forEach(([c, v], i) => {
          const ww = (v / tot) * w; ctx.fillStyle = C['s' + (i + 1)]; ctx.fillRect(x, y, ww, 56);
          ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pct(v / tot), x + ww / 2, y + 28);
          zonas.push({ x, y, w: ww, h: 56, tip: `<b>${c}</b><br>${dinero(v)} (${pct(v / tot)})` }); x += ww;
        });
        ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('0 %', x0, y + 62); ctx.textAlign = 'right'; ctx.fillText('100 %', x0 + w, y + 62);
        marcas = cats.length; leyenda = cats.map(([c], i) => ({ color: C['s' + (i + 1)], texto: c }));
      } else if (graf === 'apiladas' && dato === 'serie') {
        const s = serie(), pl = VIZ.plano(lienzo, { xmin: 0.5, xmax: 24.5, ymin: 0, ymax: Math.max(...s.map((a) => a.reduce((x, y) => x + y, 0))) * 1.12 }, { ticksX: [1, 6, 12, 18, 24], formatoY: (v) => miles(v), etiquetaX: 'mes' });
        pl.ejes(); const w = pl.sx(1) - pl.sx(0) - 2;
        s.forEach((a, i) => { let b = 0; a.forEach((v, k) => { ctx.fillStyle = C['s' + (k + 1)]; ctx.fillRect(pl.sx(i + 1) - w / 2, pl.sy(b + v), w, pl.sy(b) - pl.sy(b + v)); b += v; });
          zonas.push({ x: pl.sx(i + 1) - w / 2, y: pl.y1, w, h: pl.y0 - pl.y1, tip: `<b>${nombreMes(i)}</b>` + a.map((v, k) => VIZ.filaTooltip(C['s' + (k + 1)], S.PRODUCTOS[k], dinero(v))).join('') }); });
        marcas = 72; leyenda = S.PRODUCTOS.map((p, k) => ({ color: C['s' + (k + 1)], texto: p }));
      } else if (graf === 'torta' && (dato === 'categorías' || dato === 'serie')) {
        const items = dato === 'serie' ? serie().map((a, i) => [nombreMes(i), a.reduce((x, y) => x + y, 0)]) : cats, tot = items.reduce((s, c) => s + c[1], 0), r = Math.min(H / 2 - 14, W / 2 - 20), cx = W / 2, cy = H / 2;
        let a0 = -Math.PI / 2;
        items.forEach(([c, v], i) => {
          const a1 = a0 + (v / tot) * 2 * Math.PI; ctx.fillStyle = C['s' + ((i % 8) + 1)]; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (dato !== 'serie') { const am = (a0 + a1) / 2; ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.sobre; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pct(v / tot), cx + 0.62 * r * Math.cos(am), cy + 0.62 * r * Math.sin(am)); }
          zonas.push({ angulo: [a0, a1], cx, cy, r, tip: `<b>${c}</b><br>${dinero(v)} (${pct(v / tot)})` }); a0 = a1;
        });
        marcas = items.length; leyenda = dato === 'serie' ? [{ color: C.s1, texto: '24 meses, colores que se repiten cada 8' }] : items.map(([c], i) => ({ color: C['s' + (i + 1)], texto: c }));
      } else if (graf === 'dispersion') {
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: 30, ymin: 0, ymax: Math.max(...datos.map((r) => r.ingreso)) * 1.08 }, { etiquetaX: 'unidades por venta', etiquetaY: 'ingreso por venta', formatoY: (v) => miles(v) });
        pl.ejes(); datos.forEach((r) => { ctx.fillStyle = VIZ.alfa(C.s1, 0.55); ctx.beginPath(); ctx.arc(pl.sx(r.unidades), pl.sy(r.ingreso), 3.5, 0, 7); ctx.fill(); });
        zonas.push({ plano: pl }); marcas = datos.length; leyenda = [{ color: C.s1, texto: 'una venta', forma: 'punto' }];
      } else if (graf === 'histograma') {
        const nb = 12, max = Math.max(...datos.map((r) => r.ingreso)), w0 = max / nb, bins = Array(nb).fill(0);
        datos.forEach((r) => { bins[Math.min(nb - 1, Math.floor(r.ingreso / w0))]++; });
        const pl = VIZ.plano(lienzo, { xmin: 0, xmax: max, ymin: 0, ymax: Math.max(...bins) * 1.12 }, { etiquetaX: 'ingreso por venta', etiquetaY: 'ventas', formatoX: (v) => miles(v), formatoY: (v) => String(Math.round(v)) });
        pl.ejes(); bins.forEach((n, i) => { ctx.fillStyle = hover === i ? VIZ.alfa(C.s1, 0.7) : C.s1; ctx.beginPath(); ctx.roundRect(pl.sx(i * w0) + 1, pl.sy(n), pl.sx(w0) - pl.x0 - 2, pl.y0 - pl.sy(n), [3, 3, 0, 0]); ctx.fill();
          zonas.push({ x: pl.sx(i * w0), y: pl.y1, w: pl.sx(w0) - pl.x0, h: pl.y0 - pl.y1, tip: `entre <b>${dinero(i * w0)}</b> y <b>${dinero((i + 1) * w0)}</b><br><b>${n}</b> ventas` }); });
        marcas = nb; leyenda = [{ color: C.s1, texto: 'cantidad de ventas en el rango' }];
      } else texto('Este gráfico no puede mostrar estos datos.');
      ley.set(leyenda);
      const mejor = Object.entries(JUICIO[preg]).filter(([, q]) => q[0] === 'adecuado').map(([g]) => GRAFICOS.find((x) => x[0] === g)[1]);
      registro.textContent = j ? `${GRAFICOS.find((g) => g[0] === graf)[1]}: ${j[0]}. ${j[1][0].toUpperCase() + j[1].slice(1)}.` : `Sin juicio: los datos de esta pregunta son de tipo «${dato}» y este gráfico no los representa.`;
      lectura.set([['tipo de dato', dato], ['marcas dibujadas', j ? String(marcas) : '0'], ['adecuación', j ? j[0] : 'no aplica'], ['gráfico recomendado', mejor.join(' o ')]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      let i = -1;
      const z = zonas.find((q, k) => {
        let ok = false;
        if (q.angulo) { const dx = x - q.cx, dy = y - q.cy; let a = Math.atan2(dy, dx); if (a < -Math.PI / 2) a += 2 * Math.PI; ok = Math.hypot(dx, dy) <= q.r && a >= q.angulo[0] && a <= q.angulo[1]; }
        else if (q.plano) ok = q.plano.dentro(x, y);
        else ok = x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h;
        if (ok) i = k; return ok;
      });
      if (i !== hover) { hover = i; if (graf !== 'torta') dibujar(); }
      if (!z) return tip.ocultar();
      if (z.plano) {
        const pl = z.plano, ux = pl.ix(x), uy = pl.iy(y);
        const r = datos.reduce((a, b) => (Math.hypot(pl.sx(b.unidades) - x, pl.sy(b.ingreso) - y) < Math.hypot(pl.sx(a.unidades) - x, pl.sy(a.ingreso) - y) ? b : a));
        void ux; void uy;
        return tip.mostrar(x, y, `${nombreMes(r.mes)} · ${r.region} · ${r.producto}<br>${r.unidades} unidades<br>ingreso <b>${dinero(r.ingreso)}</b>`);
      }
      tip.mostrar(x, y, z.tip);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('dashboards-reports', {
    intro: String.raw`
      <p>Un <strong>reporte</strong> entrega las cifras completas, ordenadas en tablas; un <strong>tablero</strong> (<em>dashboard</em>) selecciona pocos indicadores y los dibuja para que se entiendan de un vistazo y
      se puedan explorar con filtros. Ninguno es mejor en general: depende de quién lee y qué pregunta tiene. La gerencia general necesita tres cifras y una tendencia; quien opera ventas, el detalle del último mes.</p>
      <p>Diseñar bien es decidir qué mostrar a cada nivel, qué gráfico responde cada pregunta y cómo se conectan los filtros para que un clic en una región actualice todo el tablero.</p>`,
    visualizaciones: [
      {
        titulo: 'Tablero frente a reporte tabular',
        descripcion: 'Cambie el nivel del lector y compare cuántas cifras debe leer en el tablero y en el reporte. En el tablero haga clic en una región: todo se filtra a la vez.',
        montar: montarTablero,
      },
      {
        titulo: 'Qué gráfico para qué pregunta',
        descripcion: 'Para cada pregunta, pruebe gráficos distintos con los mismos datos. Intente una torta con 24 meses, o líneas para comparar regiones, y vea qué se pierde.',
        montar: montarElegir,
      },
    ],
    teoria: String.raw`
      <h2>Reporte y tablero</h2>
      <table>
        <tr><th></th><th>Reporte gerencial</th><th>Tablero (dashboard)</th></tr>
        <tr><td>Contenido</td><td>Tablas detalladas, completas</td><td>Pocos indicadores y gráficos</td></tr>
        <tr><td>Uso</td><td>Consultar, verificar, archivar</td><td>Vigilar, detectar desvíos, explorar</td></tr>
        <tr><td>Interacción</td><td>Casi nula (se imprime o exporta)</td><td>Filtros enlazados, desglose</td></tr>
        <tr><td>Actualización</td><td>Periódica (mensual)</td><td>Frecuente (diaria o continua)</td></tr>
      </table>
      <h2>Qué mostrar a cada nivel</h2>
      <p>Siguiendo los <a href="tema.html?id=organizational-levels-is">niveles organizacionales</a>, el tablero cambia según quién decide:</p>
      <table>
        <tr><th>Nivel</th><th>Pregunta típica</th><th>Indicadores</th><th>Detalle</th></tr>
        <tr><td>Estratégico</td><td>¿Crecemos y con qué margen?</td><td>Ingreso anual, crecimiento interanual, margen</td><td>Trimestral</td></tr>
        <tr><td>Táctico</td><td>¿Cómo evoluciona cada área?</td><td>Ingreso, margen y unidades del mes, por región y producto</td><td>Mensual</td></tr>
        <tr><td>Operativo</td><td>¿Qué pasó últimamente?</td><td>Unidades, ingreso por unidad, mezcla de canales</td><td>Últimos meses</td></tr>
      </table>
      <h2>Elegir el gráfico</h2>
      <p>La pregunta determina el gráfico, porque cada codificación visual se lee con distinta precisión (posición y longitud mejor que ángulo y área):</p>
      <table>
        <tr><th>Pregunta</th><th>Gráfico</th><th>Evitar</th></tr>
        <tr><td>Comparar categorías</td><td>Barras</td><td>Tortas, líneas</td></tr>
        <tr><td>Evolución en el tiempo</td><td>Líneas (o barras si son pocos periodos)</td><td>Tortas</td></tr>
        <tr><td>Composición de un todo</td><td>Barra al 100 %, torta con pocas partes</td><td>Muchos sectores</td></tr>
        <tr><td>Relación entre dos medidas</td><td>Dispersión</td><td>Barras</td></tr>
        <tr><td>Distribución</td><td>Histograma</td><td>Promedios sin dispersión</td></tr>
      </table>
      <h2>Filtros enlazados</h2>
      <p>En un tablero con filtros cruzados, cada gráfico aplica todos los filtros salvo el de su propia dimensión (para poder ver y cambiar la selección). Si \(F\) es el conjunto de filtros activos y \(m_g\) la medida del gráfico sobre la dimensión \(g\):</p>
      \[ m_g(c) = \sum_{x \,\in\, \text{hechos}} \mathbb{1}[x_g = c]\;\cdot\;\mathbb{1}[x \text{ cumple } F \setminus \{g\}]\;\cdot\; \text{ingreso}(x). \]
      <p>Ejemplo: con el filtro «producto = Software», el gráfico por región suma solo ventas de software, y las barras de producto siguen mostrando los tres productos con «Software» resaltado.</p>
      <div class="recuadro"><p><strong>Menos es más.</strong> Un tablero con veinte gráficos obliga a leer veinte cifras, es decir, otro reporte. Se compara el número de cifras que debe leer el usuario en cada vista, como en la primera figura.</p></div>
      <h2>Conexiones</h2>
      <p>Los indicadores salen de las <a href="tema.html?id=olap-queries">consultas OLAP</a>; cómo se eligen, miden y se les fijan metas se desarrolla en <a href="tema.html?id=kpi-fundamentals">KPIs</a> y en los
      <a href="tema.html?id=control-dashboards">tableros de control de gestión</a>. El trabajo previo de exploración se ve en <a href="tema.html?id=exploratory-data-analysis">análisis exploratorio</a>.</p>`,
  });
})();
