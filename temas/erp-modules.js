(function () {
  'use strict';
  const { color: C } = VIZ;
  const dinero = (v) => (v < 0 ? '−$' : '$') + VIZ.entero(Math.abs(v));

  /* ---------- Fig. 1: un pedido recorre los módulos ---------- */

  const MODS = [
    { id: 'ventas', nombre: 'Ventas', x: 0.16, y: 0.17, desc: 'Registra el pedido del cliente, fija el precio y calcula la comisión del vendedor.' },
    { id: 'inv', nombre: 'Inventarios', x: 0.5, y: 0.1, desc: 'Lleva las existencias de producto terminado y materia prima; reserva y despacha.' },
    { id: 'compras', nombre: 'Compras', x: 0.84, y: 0.17, desc: 'Emite órdenes de compra a proveedores cuando falta materia prima.' },
    { id: 'prod', nombre: 'Producción', x: 0.16, y: 0.83, desc: 'Planifica y ejecuta órdenes de producción; consume materia prima y genera producto.' },
    { id: 'fin', nombre: 'Finanzas', x: 0.5, y: 0.9, desc: 'Factura, registra cuentas por cobrar y por pagar y genera los asientos contables.' },
    { id: 'rrhh', nombre: 'RRHH', x: 0.84, y: 0.83, desc: 'Calcula horas de producción y comisiones que se pagan por nómina.' },
  ];
  const MP_POR_U = 2, P_MP = 8, MO_U = 5, COSTO_U = MP_POR_U * P_MP + MO_U, COMISION = 0.02;

  function montarPedido(cuerpo) {
    let q = 40, stock0 = 15, mp0 = 30, precio = 100;
    let E = null, activo = null, tocados = new Set(), notas = {}, mensaje = '', geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Unidades pedidas', min: 5, max: 80, valor: q, alCambiar: (v) => { q = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Producto terminado en bodega', min: 0, max: 80, valor: stock0, alCambiar: (v) => { stock0 = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Materia prima en bodega (kg)', min: 0, max: 120, valor: mp0, alCambiar: (v) => { mp0 = v; rep.reiniciar(); } });
    ctl.rango({ etiqueta: 'Precio unitario', min: 60, max: 150, valor: precio, formato: (v) => '$' + v, alCambiar: (v) => { precio = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 380 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'módulo que actúa en este paso' },
      { color: C.s1, texto: 'módulo ya actualizado por el pedido' },
      { color: C.inactivo, texto: 'sin movimientos todavía' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Pulse «Un paso» para avanzar un módulo a la vez. Pase el cursor sobre un módulo para ver su función. Cambie las existencias y repita: con poco stock el pedido activa Producción, Compras y RRHH.');

    function iniciar() {
      E = { pt: stock0, mp: mp0, cxc: 0, cxp: 0, ing: 0, cv: 0, com: 0 };
      activo = null; tocados = new Set(); notas = {};
      mensaje = `Pedido de ${q} unidades a $${precio}. Hay ${stock0} unidades terminadas y ${mp0} kg de materia prima.`;
      const ir = (m, nota, msg) => { activo = m; tocados.add(m); notas[m] = nota; mensaje = msg; };
      return (function* () {
        ir('ventas', `pedido × ${q}`, `Ventas registra el pedido: ${q} u. × $${precio} = ${dinero(q * precio)}. Todo queda en la base de datos única.`);
        yield;
        const falta = Math.max(0, q - E.pt);
        ir('inv', falta ? `faltan ${falta} u.` : 'hay stock', falta
          ? `Inventarios consulta las existencias en línea: hay ${E.pt} y se piden ${q}; faltan ${falta} unidades.`
          : `Inventarios ve ${E.pt} unidades disponibles: reserva ${q} sin necesidad de producir.`);
        yield;
        if (falta) {
          const necesita = MP_POR_U * falta;
          ir('prod', `orden × ${falta}`, `Producción abre una orden por ${falta} unidades; cada una necesita ${MP_POR_U} kg de materia prima (${necesita} kg en total).`);
          yield;
          if (E.mp < necesita) {
            const comprar = necesita - E.mp;
            E.mp += comprar; E.cxp += comprar * P_MP;
            ir('compras', `OC ${comprar} kg`, `Faltan ${comprar} kg de materia prima: Compras emite una orden de compra por ${dinero(comprar * P_MP)} y queda una cuenta por pagar.`);
            yield;
          }
          E.mp -= necesita; E.pt += falta;
          ir('prod', `+${falta} u.`, `Producción consume ${necesita} kg y entrega ${falta} unidades terminadas al inventario.`);
          yield;
          E.cxp += falta * MO_U;
          ir('rrhh', `nómina ${dinero(falta * MO_U)}`, `RRHH carga la mano de obra de la orden (${dinero(falta * MO_U)}) a la nómina por pagar.`);
          yield;
        }
        E.pt -= q;
        ir('inv', `despacho −${q}`, `Inventarios despacha ${q} unidades: quedan ${E.pt} terminadas en bodega.`);
        yield;
        E.com = q * precio * COMISION; E.cxp += E.com;
        ir('rrhh', `comisión ${dinero(E.com)}`, `RRHH calcula la comisión del vendedor (${COMISION * 100} % de la venta): ${dinero(E.com)} por pagar.`);
        yield;
        E.cxc += q * precio; E.ing += q * precio; E.cv += q * COSTO_U;
        ir('fin', `factura ${dinero(q * precio)}`, `Finanzas factura: cuentas por cobrar y ingresos suben ${dinero(q * precio)}; el costo de ventas sube ${dinero(q * COSTO_U)} (${q} × $${COSTO_U}).`);
        yield;
        activo = null;
        mensaje = `Pedido completo: seis módulos actualizados sin reingresar un solo dato. Utilidad del pedido ${dinero(E.ing - E.cv - E.com)}.`;
        yield;
      })();
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const nw = Math.min(104, W * 0.29), nh = 44;
      const cx = W / 2, cy = H / 2;
      geo = MODS.map((m) => ({ m, x: Math.max(nw / 2 + 2, Math.min(W - nw / 2 - 2, m.x * W)), y: m.y * H }));
      for (const g of geo) {
        const act = activo === g.m.id, toc = tocados.has(g.m.id);
        ctx.strokeStyle = act ? C.s2 : toc ? C.s1 : C.tenue; ctx.lineWidth = act ? 3.5 : toc ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(cx, cy); ctx.stroke();
      }
      ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(cx - 70, cy - 24, 140, 48, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Base de datos', cx, cy - 7); ctx.fillText('única', cx, cy + 8);
      for (const g of geo) {
        const act = activo === g.m.id, toc = tocados.has(g.m.id);
        ctx.fillStyle = C.superficie; ctx.strokeStyle = act ? C.s2 : toc ? C.s1 : C.inactivo; ctx.lineWidth = act ? 3.5 : toc ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(g.x - nw / 2, g.y - nh / 2, nw, nh, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(12, 600); ctx.fillText(g.m.nombre, g.x, g.y - 8);
        ctx.fillStyle = act ? C.s2 : C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.fillText(notas[g.m.id] || '—', g.x, g.y + 9, nw - 6);
      }
      registro.textContent = mensaje;
      lectura.set([
        ['producto terminado', `${E.pt} u.`], ['materia prima', `${E.mp} kg`],
        ['por cobrar', dinero(E.cxc)], ['por pagar', dinero(E.cxp)],
        ['ingresos', dinero(E.ing)], ['utilidad', dinero(E.ing - E.cv - E.com)],
      ]);
    }
    lienzo.alDibujar = () => E && dibujar();
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const g = geo.find((h) => Math.abs(x - h.x) <= 52 && Math.abs(y - h.y) <= 22);
      if (!g) return tip.ocultar();
      tip.mostrar(x, y, `<b>${g.m.nombre}</b><br>${g.m.desc}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.style.cursor = 'help';
    rep.reiniciar();
  }

  /* ---------- Fig. 2: silos frente a ERP ---------- */

  const DIAS = 45;
  function simularStock(semilla, k, erp) {
    const rnd = VIZ.semilla(semilla * 13 + 7);
    const dem = (m) => Math.max(0, Math.round(m + (rnd() + rnd() + rnd() - 1.5) * 4));
    let real = 80, vista = 80, rotas = 0, perdidas = 0, err = 0, conc = 0;
    const R = [real], V = [vista], mal = [0], rech = [0];
    for (let d = 1; d <= DIAS; d++) {
      if (d % 7 === 0) real += 126;
      if (erp) vista = real;
      const web = Math.min(real, dem(8)); real -= web;
      if (erp) vista = real;
      const t = dem(10);
      let m = 0, r = 0;
      if (vista >= t) {
        const vendido = Math.min(real, t);
        m = t - vendido; rotas += m; real -= vendido; vista -= t;
      } else if (real >= t) { r = t; perdidas += t; }
      if (erp) vista = real;
      else if (d % k === 0) { vista = real; conc++; }
      err += Math.abs(vista - real);
      R.push(real); V.push(vista); mal.push(m); rech.push(r);
    }
    return { R, V, mal, rech, rotas, perdidas, err: err / DIAS, conc };
  }

  function montarSilos(cuerpo) {
    let semilla = 1, k = 5, modo = 'silos', pl = null, hover = -1, S = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Arquitectura', opciones: [['silos', 'Silos: cada área con su copia'], ['erp', 'ERP: base de datos única']], valor: modo, alCambiar: (v) => { modo = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Días entre conciliaciones (silos)', min: 1, max: 14, valor: k, alCambiar: (v) => { k = v; dibujar(); } });
    ctl.boton('Nuevas ventas', () => { semilla++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'stock real en bodega', forma: 'linea' },
      { color: C.s2, texto: 'stock que ve Ventas', forma: 'linea' },
      { color: C.s8, texto: 'promesa incumplida (se vendió sin stock)', forma: 'circulo' },
      { color: C.s4, texto: 'venta rechazada habiendo stock', forma: 'circulo' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Ventas de tienda descuentan de su copia; la bodega recibe reposiciones cada 7 días y las ventas web salen directo de bodega. Pase el cursor sobre un día para ver ambas cifras.');

    function dibujar() {
      S = simularStock(semilla, k, modo === 'erp');
      const { ctx } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...S.R, ...S.V) * 1.08;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: DIAS, ymin: 0, ymax }, { etiquetaX: 'día', etiquetaY: 'unidades en stock' });
      pl.ejes();
      const pts = (a) => a.map((v, i) => [i, v]);
      VIZ.trazar(ctx, pl, pts(S.V), C.s2, 3);
      VIZ.trazar(ctx, pl, pts(S.R), C.tinta, 2);
      S.mal.forEach((m, i) => { if (m > 0) VIZ.marcador(ctx, pl.sx(i), pl.sy(S.R[i]), C.s8, 5); });
      S.rech.forEach((m, i) => { if (m > 0) VIZ.marcador(ctx, pl.sx(i), pl.sy(S.R[i]), C.s4, 5); });
      if (hover >= 0) {
        ctx.strokeStyle = C.apagado; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke(); ctx.setLineDash([]);
        VIZ.marcador(ctx, pl.sx(hover), pl.sy(S.V[hover]), C.s2, 4); VIZ.marcador(ctx, pl.sx(hover), pl.sy(S.R[hover]), C.tinta, 4);
      }
      registro.textContent = modo === 'erp'
        ? 'Con base única, la venta de la tienda y la web descuentan el mismo registro: Ventas siempre ve el stock real.'
        : `En silos, Ventas actualiza su copia cada ${k} días; entre conciliaciones ignora las ventas web y las reposiciones de bodega.`;
      lectura.set([
        ['promesas incumplidas', `${S.rotas} u.`], ['ventas rechazadas con stock', `${S.perdidas} u.`],
        ['error medio de la vista', `${VIZ.fmt(S.err, 3)} u.`], ['conciliaciones manuales', String(modo === 'erp' ? 0 : S.conc)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const d = Math.max(0, Math.min(DIAS, Math.round(pl.ix(x))));
      if (d !== hover) { hover = d; dibujar(); }
      tip.mostrar(x, y, `día <b>${d}</b>` + VIZ.filaTooltip(C.tinta, 'stock real', S.R[d]) + VIZ.filaTooltip(C.s2, 've Ventas', S.V[d])
        + (S.mal[d] ? VIZ.filaTooltip(C.s8, 'incumplido', S.mal[d] + ' u.') : '') + (S.rech[d] ? VIZ.filaTooltip(C.s4, 'rechazado', S.rech[d] + ' u.') : ''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 3: datos maestros duplicados ---------- */

  const MODULOS = ['Finanzas', 'Contabilidad', 'RRHH', 'Manufactura', 'Compras', 'Inventarios', 'Ventas', 'Distribución'];
  const ENT = [
    { n: 'Cliente', reg: 4000, usa: ['Finanzas', 'Contabilidad', 'Ventas', 'Distribución'] },
    { n: 'Producto', reg: 1200, usa: ['Manufactura', 'Compras', 'Inventarios', 'Ventas', 'Distribución'] },
    { n: 'Proveedor', reg: 300, usa: ['Finanzas', 'Contabilidad', 'Compras'] },
    { n: 'Empleado', reg: 250, usa: ['RRHH', 'Finanzas', 'Ventas', 'Manufactura'] },
    { n: 'Cuenta', reg: 400, usa: ['Finanzas', 'Contabilidad', 'Compras', 'Ventas', 'Inventarios'] },
  ];

  function montarMaestros(cuerpo) {
    let cambios = 10, minutos = 3, pl = null, hover = -1, filas = [];
    const ctl = VIZ.controles(cuerpo);
    const act = ctl.casillas(MODULOS.map((m) => ({ clave: m, texto: m, activo: true })), () => dibujar());
    ctl.rango({ etiqueta: 'Registros que cambian al mes', min: 1, max: 30, valor: cambios, formato: (v) => v + ' %', alCambiar: (v) => { cambios = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Minutos por actualizar una copia', min: 1, max: 10, valor: minutos, alCambiar: (v) => { minutos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 230, altoMax: 320 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s2, texto: 'copias del dato en silos (una por módulo que lo usa)' }, { color: C.s1, texto: 'copias con ERP (siempre una)' }]);
    const tabla = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(tabla);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Active o desactive módulos con las casillas: cada módulo que comparte un dato maestro agrega una copia que alguien debe mantener al día. Pase el cursor sobre un par de barras para ver el detalle.');

    function dibujar() {
      filas = ENT.map((e) => {
        const copias = e.usa.filter((m) => act[m]).length;
        const extra = e.reg * (cambios / 100) * Math.max(0, copias - 1);
        return { e, copias, extra, horas: (extra * minutos) / 60 };
      });
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: -0.5, xmax: ENT.length - 0.5, ymin: 0, ymax: 6 }, { etiquetaY: 'copias', ticksX: [], ticksY: [0, 1, 2, 3, 4, 5, 6] });
      pl.ejes();
      const w = (pl.sx(1) - pl.sx(0)) * 0.34;
      filas.forEach((f, i) => {
        const cx = pl.sx(i);
        [[f.copias, C.s2, -w], [f.copias ? 1 : 0, C.s1, 0]].forEach(([v, col, dx]) => {
          if (!v) return;
          const y = pl.sy(v);
          ctx.fillStyle = i === hover ? VIZ.alfa(col, 0.75) : col;
          ctx.beginPath(); ctx.roundRect(cx + dx - 1, y, w - 2, pl.y0 - y, [4, 4, 0, 0]); ctx.fill();
        });
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(f.e.n, cx, pl.y0 + 8);
      });
      const tot = filas.reduce((s, f) => ({ c: s.c + f.copias, x: s.x + f.extra, h: s.h + f.horas }), { c: 0, x: 0, h: 0 });
      tabla.replaceChildren(VIZ.el('table', { class: 'tabla-datos sin-corte' },
        VIZ.el('tr', null, ['Dato maestro', 'Registros', 'Copias en silos', 'Ediciones extra al mes', 'Horas al mes'].map((t) => VIZ.el('th', { class: t === 'Dato maestro' ? 'izq' : null }, t))),
        filas.map((f) => VIZ.el('tr', null, VIZ.el('td', { class: 'izq' }, f.e.n), VIZ.el('td', null, VIZ.entero(f.e.reg)), VIZ.el('td', null, f.copias), VIZ.el('td', null, VIZ.entero(f.extra)), VIZ.el('td', null, VIZ.fmt(f.horas, 3))))));
      lectura.set([
        ['copias en silos', String(tot.c)], ['copias con ERP', String(filas.filter((f) => f.copias).length)],
        ['ediciones duplicadas', `${VIZ.entero(tot.x)} / mes`], ['horas de conciliación', `${VIZ.fmt(tot.h, 3)} h / mes`],
        ['inconsistencias esperadas (2 %)', `${VIZ.fmt(tot.x * 0.02, 3)} / mes`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { if (hover >= 0) { hover = -1; dibujar(); } return tip.ocultar(); }
      const i = Math.round(pl.ix(x));
      if (i < 0 || i >= ENT.length) return tip.ocultar();
      if (i !== hover) { hover = i; dibujar(); }
      const f = filas[i];
      tip.mostrar(x, y, `<b>${f.e.n}</b> · ${VIZ.entero(f.e.reg)} registros` + VIZ.filaTooltip(C.s2, 'copias en silos', f.copias) + VIZ.filaTooltip(C.s1, 'copias con ERP', f.copias ? 1 : 0)
        + `<div>${VIZ.entero(f.extra)} ediciones extra · ${VIZ.fmt(f.horas, 3)} h al mes</div>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    dibujar();
  }

  VIZ.registrarTema('erp-modules', {
    intro: String.raw`
      <p>Un <strong>sistema de planificación de recursos empresariales</strong> (<em>ERP</em>) reúne en una sola aplicación los módulos que antes vivían
      separados: finanzas y contabilidad, recursos humanos, manufactura, compras, inventarios, ventas y distribución. Su rasgo esencial no es la
      cantidad de módulos, sino que todos escriben y leen una <strong>base de datos única</strong>.</p>
      <p>Por eso un solo evento de negocio, como una venta, deja huella coherente en varias áreas: reserva existencias, dispara producción o compras,
      calcula comisiones y genera la factura y los asientos contables, sin que nadie vuelva a digitar el pedido.</p>`,
    visualizaciones: [
      {
        titulo: 'Un pedido recorre los módulos',
        descripcion: 'Avance paso a paso y observe qué módulo actúa y cómo cambian las existencias, las cuentas por cobrar y por pagar y la utilidad. Reduzca el producto terminado y la materia prima en bodega: el mismo pedido activará también Producción, Compras y RRHH.',
        montar: montarPedido,
      },
      {
        titulo: 'Silos frente a base única',
        descripcion: 'En modo silos, alargue los días entre conciliaciones: la vista de Ventas (naranja) se separa del stock real y aparecen promesas incumplidas (rojo) y ventas rechazadas teniendo stock (amarillo). Cambie a ERP y la brecha desaparece.',
        montar: montarSilos,
      },
      {
        titulo: 'Datos maestros duplicados',
        descripcion: 'Cada módulo de un sistema aislado guarda su propia copia de clientes, productos o proveedores. Apague módulos y vea cuántas copias y horas de conciliación se evitan; con ERP siempre hay una sola copia.',
        montar: montarMaestros,
      },
    ],
    teoria: String.raw`
      <h2>Qué integra un ERP</h2>
      <p>Un ERP organiza la operación en <strong>módulos</strong> que comparten datos maestros (clientes, productos, proveedores, empleados, plan de cuentas) y
      datos transaccionales (pedidos, órdenes de compra, movimientos de bodega, asientos). Los módulos habituales son:</p>
      <table>
        <tr><th>Módulo</th><th>Registra</th><th>Alimenta a</th></tr>
        <tr><td>Ventas y distribución</td><td>pedidos, despachos</td><td>inventarios, finanzas</td></tr>
        <tr><td>Inventarios</td><td>existencias, reservas</td><td>compras, manufactura</td></tr>
        <tr><td>Compras</td><td>órdenes de compra, recepciones</td><td>cuentas por pagar</td></tr>
        <tr><td>Manufactura</td><td>órdenes de producción, lista de materiales</td><td>inventarios, costos</td></tr>
        <tr><td>Recursos humanos</td><td>nómina, horas, comisiones</td><td>contabilidad</td></tr>
        <tr><td>Finanzas y contabilidad</td><td>facturas, cobros, pagos, asientos</td><td>estados financieros</td></tr>
      </table>
      <h2>Un evento, muchos registros</h2>
      <p>La idea central es que un evento se captura <em>una vez</em> y se propaga. Con la lista de materiales de la primera figura (2 kg de materia prima a &#36;8 y
      &#36;5 de mano de obra por unidad, es decir &#36;21 de costo estándar), el pedido de 40 unidades a &#36;100 con 15 unidades en bodega y 30 kg de materia prima se resuelve así:</p>
      <ul>
        <li>Faltan \(40 - 15 = 25\) unidades: Producción necesita \(2 \cdot 25 = 50\) kg y Compras adquiere \(50 - 30 = 20\) kg por &#36;160.</li>
        <li>RRHH carga \(25 \cdot 5 = 125\) dólares de mano de obra y una comisión de \(0{,}02 \cdot 4000 = 80\) dólares.</li>
        <li>Finanzas factura &#36;4.000 y reconoce un costo de ventas de \(40 \cdot 21 = 840\) dólares.</li>
      </ul>
      \[ \text{utilidad del pedido} = 4000 - 840 - 80 = 3080. \]
      <p>Contablemente, el asiento de la venta es: <em>debe</em> cuentas por cobrar &#36;4.000 y costo de ventas &#36;840; <em>haber</em> ingresos &#36;4.000 e inventario &#36;840.</p>
      <h2>Silos frente a integración</h2>
      <p>En una organización con sistemas aislados cada área mantiene su copia y se sincroniza por correo, planillas o procesos por lotes. Si Ventas ve el stock
      de hace \(k\) días, el error de su vista crece con la actividad que no conoce: ventas por otros canales y reposiciones. El resultado son promesas que bodega no puede
      cumplir y ventas rechazadas sin necesidad. Si cada dato maestro vive en \(c\) copias y una fracción \(f\) de los \(N\) registros cambia cada mes, el trabajo duplicado es</p>
      \[ \text{ediciones extra} = N \cdot f \cdot (c - 1), \qquad \text{horas} = \frac{\text{ediciones extra} \cdot t}{60}, \]
      <p>con \(t\) los minutos por edición. Un ERP lleva \(c\) a 1 y elimina esa carga y las inconsistencias que acarrea.</p>
      <div class="recuadro"><p><strong>Advertencia.</strong> Integrar no es sólo tecnología: obliga a unificar definiciones (qué es un «cliente activo»), a acordar responsables de cada dato maestro
      y a rediseñar procesos. Muchas implementaciones fracasan por adaptar el ERP a procesos defectuosos en lugar de mejorarlos.</p></div>
      <h2>Conexiones</h2>
      <p>El ERP es el sistema transaccional por excelencia dentro de los <a href="tema.html?id=organizational-levels-is">niveles organizacionales</a> y es una pieza de los
      <a href="tema.html?id=is-components">componentes de un sistema de información</a>. Su eficacia se mide en el <a href="tema.html?id=cross-department-flow">flujo de información entre departamentos</a>;
      se relaciona con la <a href="tema.html?id=scm">gestión de la cadena de suministro</a> y el <a href="tema.html?id=crm">CRM</a>, y convive con sistemas anteriores mediante la
      <a href="tema.html?id=legacy-integration">integración de aplicaciones</a>.</p>`,
  });
})();
