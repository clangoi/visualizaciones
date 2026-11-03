(function () {
  'use strict';
  const { color: C } = VIZ;

  const NOMBRES = ['Inicio de sesión único', 'Reporte de ventas', 'Notificaciones por correo', 'Exportar a Excel', 'Panel de control', 'Integración con ERP', 'Modo oscuro',
    'Firma electrónica', 'Chat de soporte', 'Carga masiva de datos', 'Búsqueda avanzada', 'App móvil', 'Auditoría de cambios', 'Personalizar tema'];
  const CATS = ['M', 'S', 'C', 'W'];
  const CAT_NOMBRE = { M: 'Must (debe)', S: 'Should (debería)', C: 'Could (podría)', W: 'Won’t (no ahora)' };
  const CAT_COLOR = { M: C.s1, S: C.s2, C: C.s3, W: C.inactivo };

  /* ---------- Fig. 1: priorizar con MoSCoW y valor/esfuerzo ---------- */

  function montarPriorizar(cuerpo) {
    let semilla = 1, presupuesto = 30, reqs = [], pl = null, geo = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Presupuesto del release', min: 10, max: 70, valor: presupuesto, formato: (v) => `${v} pts`, alCambiar: (v) => { presupuesto = v; dibujar(); } });
    ctl.boton('Asignar por valor/esfuerzo', () => { asignarPorRazon(); dibujar(); }, { primario: true });
    ctl.boton('Nuevos requerimientos', () => { semilla++; nuevos(); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'Must' }, { color: C.s2, texto: 'Should' }, { color: C.s3, texto: 'Could' }, { color: C.inactivo, texto: 'Won’t' },
      { color: C.superficie, borde: C.tinta2, texto: 'círculo vacío: no cabe en el presupuesto', forma: 'punto' }, { color: C.apagado, texto: 'corte por valor/esfuerzo', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un requerimiento para cambiar su categoría (Must → Should → Could → Won’t). Se financia primero lo Must, luego lo Should y lo Could, en el orden de la lista. Las asignaciones iniciales siguen a «quien grita más»: corríjalas con valor/esfuerzo.');

    function nuevos() {
      const rnd = VIZ.semilla(semilla * 23 + 7);
      reqs = NOMBRES.map((nombre, i) => {
        const e = [1, 2, 3, 5, 8, 13][Math.floor(rnd() * 6)], v = Math.max(1, Math.min(10, Math.round(2 + 6 * rnd() + (e > 5 ? 1 : 0) + 2 * rnd())));
        const u = rnd();
        return { id: `R${i + 1}`, nombre, e, v, cat: u < 0.3 ? 'M' : u < 0.6 ? 'S' : u < 0.85 ? 'C' : 'W', jx: (((i * 37) % 7) - 3) * 0.06 };
      });
    }
    // Financiamiento por categoría: Must, Should, Could en orden; entra lo que cabe.
    function financiarMoscow() {
      let usado = 0;
      const set = new Set();
      for (const c of ['M', 'S', 'C']) for (const r of reqs) if (r.cat === c && usado + r.e <= presupuesto) { set.add(r.id); usado += r.e; }
      return { set, usado };
    }
    // Óptimo exacto de la mochila (programación dinámica).
    function optimo() {
      const B = presupuesto, mejor = Array.from({ length: reqs.length + 1 }, () => new Array(B + 1).fill(0));
      reqs.forEach((r, i) => { for (let b = 0; b <= B; b++) mejor[i + 1][b] = Math.max(mejor[i][b], b >= r.e ? mejor[i][b - r.e] + r.v : -1); });
      const set = new Set();
      for (let i = reqs.length, b = B; i > 0; i--) if (mejor[i][b] !== mejor[i - 1][b]) { set.add(reqs[i - 1].id); b -= reqs[i - 1].e; }
      return { valor: mejor[reqs.length][B], set };
    }
    // Corte del enfoque voraz por valor/esfuerzo.
    function corteRazon() {
      let usado = 0, theta = Infinity;
      for (const r of [...reqs].sort((a, b) => b.v / b.e - a.v / a.e)) if (usado + r.e <= presupuesto) { usado += r.e; theta = Math.min(theta, r.v / r.e); }
      return Number.isFinite(theta) ? theta : 0;
    }
    function asignarPorRazon() {
      let usado = 0;
      const orden = [...reqs].sort((a, b) => b.v / b.e - a.v / a.e);
      orden.forEach((r) => {
        r.cat = usado + r.e <= presupuesto * 0.6 ? 'M' : usado + r.e <= presupuesto ? 'S' : usado + r.e <= presupuesto * 1.35 ? 'C' : 'W';
        if (r.cat === 'M' || r.cat === 'S') usado += r.e;
      });
    }
    function dibujar() {
      if (!reqs.length) return;
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 14.5, ymin: 0, ymax: 11 }, { etiquetaX: 'esfuerzo (puntos)', etiquetaY: 'valor para el negocio (1–10)', formatoY: (v) => String(Math.round(v)) });
      pl.ejes();
      const fin = financiarMoscow(), opt = optimo(), th = corteRazon();
      if (th > 0) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(pl.sx(0), pl.sy(0)); const xe = Math.min(14.5, 11 / th); ctx.lineTo(pl.sx(xe), pl.sy(xe * th)); ctx.stroke(); ctx.restore();
      }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('mucho valor, poco esfuerzo', pl.x0 + 6, pl.y1 + 2);
      geo = [];
      reqs.forEach((r) => {
        const x = pl.sx(r.e + r.jx), y = pl.sy(r.v), financiado = fin.set.has(r.id), col = CAT_COLOR[r.cat];
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
        if (financiado) { ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke(); }
        ctx.font = VIZ.fuente(10, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(r.id, x + 10, y);
        geo.push({ x, y, r, financiado });
      });
      const valor = reqs.filter((r) => fin.set.has(r.id)).reduce((s, r) => s + r.v, 0);
      const mustFuera = reqs.filter((r) => r.cat === 'M' && !fin.set.has(r.id));
      const buenosFuera = reqs.filter((r) => !fin.set.has(r.id) && opt.set.has(r.id));
      registro.textContent = `Con ${presupuesto} pts se financian ${fin.set.size} requerimientos (${fin.usado} pts) que suman valor ${valor}; el máximo posible con ese presupuesto es ${opt.valor}. `
        + (buenosFuera.length ? `Quedaron fuera ${buenosFuera.map((r) => r.id).join(', ')}, que estaban en la mejor combinación.` : 'Su selección coincide en valor con la mejor combinación.')
        + (mustFuera.length ? ` Atención: ${mustFuera.map((r) => r.id).join(', ')} es Must y no cabe.` : '');
      lectura.set([
        ['esfuerzo comprometido', `${fin.usado} de ${presupuesto} pts`],
        ['valor capturado', String(valor)],
        ['valor máximo posible', String(opt.valor)],
        ['eficiencia de la selección', `${VIZ.fmt((100 * valor) / opt.valor, 3)} %`],
        ['requerimientos Must sin financiar', String(mustFuera.length)],
        ['valor perdido por mala priorización', String(opt.valor - valor)],
      ]);
    }
    lienzo.alDibujar = dibujar;
    const buscar = (x, y) => geo.find((g) => (g.x - x) ** 2 + (g.y - y) ** 2 <= 100);
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = buscar(x, y);
      lienzo.canvas.style.cursor = g ? 'pointer' : 'default';
      if (!g) return tip.ocultar();
      const r = g.r;
      tip.mostrar(x, y, `<b>${r.id} · ${r.nombre}</b><br>valor ${r.v} · esfuerzo ${r.e} pts<br>valor/esfuerzo <b>${VIZ.fmt(r.v / r.e, 3)}</b>` + VIZ.filaTooltip(CAT_COLOR[r.cat], CAT_NOMBRE[r.cat], null) + (g.financiado ? 'financiado' : 'sin presupuesto'));
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev), g = buscar(x, y);
      if (!g) return;
      g.r.cat = CATS[(CATS.indexOf(g.r.cat) + 1) % 4];
      dibujar();
    });
    nuevos();
    dibujar();
  }

  /* ---------- Fig. 2: costo de un defecto de requisitos ---------- */

  const FASES = ['Revisión de requisitos', 'Revisión de diseño', 'Pruebas', 'Producción'];
  const COSTO = [2, 10, 40, 200]; // horas de corrección de un defecto según la fase en que se detecta

  function montarCostoDefecto(cuerpo) {
    let R = 100, d = 0.15, vol = 0.2, tr = false, ef = [0.4, 0.4, 0.7], pl = null, filas = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Defectos por requisito al redactar', min: 0.05, max: 0.3, paso: 0.01, valor: d, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { d = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Volatilidad (requisitos que cambian)', min: 0, max: 0.6, paso: 0.05, valor: vol, formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { vol = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Eficacia de la revisión de requisitos', min: 0, max: 0.9, paso: 0.05, valor: ef[0], formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ef[0] = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Eficacia de la revisión de diseño', min: 0, max: 0.9, paso: 0.05, valor: ef[1], formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ef[1] = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Eficacia de las pruebas', min: 0, max: 0.95, paso: 0.05, valor: ef[2], formato: (v) => `${Math.round(v * 100)} %`, alCambiar: (v) => { ef[2] = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Matriz de trazabilidad', valor: tr, alCambiar: (v) => { tr = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 260, altoMax: 360 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'costo de corregir los defectos hallados en la fase (horas)' }, { color: C.s8, texto: 'fase donde ya llegaron al usuario' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Un proyecto de ${R} requisitos. Cada fase detecta una fracción de los defectos que le llegan, y corregirlos cuesta 2, 10, 40 o 200 horas según dónde se hallen. Suba la eficacia de las revisiones tempranas, o active la trazabilidad, y vea cómo el costo migra a la izquierda.`);

    function calcular() {
      // La trazabilidad permite verificar cobertura (+15 % de eficacia relativa) y reduce los defectos que introduce cada cambio.
      const extra = R * vol * (tr ? 0.12 : 0.3);
      let restante = R * d + extra;
      const total = restante;
      filas = FASES.map((n, i) => {
        const e = i === 3 ? 1 : Math.min(0.97, ef[i] * (tr ? 1.15 : 1));
        const nd = restante * e;
        restante -= nd;
        return { n, nd, costo: nd * COSTO[i], unit: COSTO[i] };
      });
      return total;
    }
    function dibujar() {
      const total = calcular();
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ymax = Math.max(...filas.map((f) => f.costo), 10) * 1.2;
      pl = VIZ.plano(lienzo, { xmin: 0, xmax: 4, ymin: 0, ymax }, { etiquetaY: 'horas de corrección', formatoY: (v) => VIZ.entero(v), ticksX: [], margen: { inf: 36 } });
      pl.ejes();
      filas.forEach((f, i) => {
        const xa = pl.sx(i) + 8, w = pl.sx(i + 1) - pl.sx(i) - 16, y = pl.sy(f.costo);
        ctx.fillStyle = i === 3 ? C.s8 : C.s1;
        ctx.beginPath(); ctx.roundRect(xa, y, w, Math.max(1, pl.y0 - y), [4, 4, 0, 0]); ctx.fill();
        ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${VIZ.fmt(f.nd, 3)} def.`, xa + w / 2, y - 3);
        ctx.font = VIZ.fuente(W < 520 ? 9 : 10); ctx.fillStyle = C.tinta2; ctx.textBaseline = 'top';
        const partes = f.n.split(' ');
        partes.forEach((p, k) => ctx.fillText(p, xa + w / 2, pl.y0 + 6 + k * 12));
      });
      const costo = filas.reduce((s, f) => s + f.costo, 0);
      const todoPrimera = total * COSTO[0], sinRevisiones = total * (ef[2] * (tr ? 1.15 : 1) > 0.97 ? 0.97 : ef[2] * (tr ? 1.15 : 1)) * COSTO[2] + total * (1 - Math.min(0.97, ef[2] * (tr ? 1.15 : 1))) * COSTO[3];
      const enProd = filas[3];
      registro.textContent = `Se introdujeron ${VIZ.fmt(total, 3)} defectos de requisitos; ${VIZ.fmt(enProd.nd, 3)} llegan a producción y consumen ${VIZ.fmt((100 * enProd.costo) / Math.max(costo, 1e-9), 3)} % del costo. Sin revisiones tempranas el costo sería ${VIZ.entero(sinRevisiones)} h.`;
      lectura.set([
        ['defectos totales', VIZ.fmt(total, 3)],
        ['costo total de corrección', `${VIZ.entero(costo)} h`],
        ['costo medio por defecto', `${VIZ.fmt(costo / Math.max(total, 1e-9), 3)} h`],
        ['si todo se hallara al redactar', `${VIZ.entero(todoPrimera)} h`],
        ['sin revisiones tempranas', `${VIZ.entero(sinRevisiones)} h`],
        ['ahorro por las revisiones', `${VIZ.fmt((100 * (sinRevisiones - costo)) / Math.max(sinRevisiones, 1e-9), 3)} %`],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !filas.length || x < pl.x0 || x > pl.x1 || y < pl.y1 - 10 || y > pl.y0 + 40) return tip.ocultar();
      const i = Math.max(0, Math.min(3, Math.floor(pl.ix(x))));
      const f = filas[i];
      tip.mostrar(x, y, `<b>${f.n}</b><br>${VIZ.fmt(f.nd, 3)} defectos hallados<br>${f.unit} h por defecto<br>costo <b>${VIZ.entero(f.costo)} h</b>`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('requirements-management', {
    intro: String.raw`
      <p>La <strong>gestión de requerimientos</strong> es el trabajo de capturar lo que el negocio necesita, acordarlo, ordenarlo y mantenerlo coherente mientras el proyecto avanza. Casi siempre hay más peticiones
      que presupuesto, por eso lo central es <em>priorizar</em>: decidir qué entra en el próximo release y qué espera. Una técnica común es MoSCoW (<em>Must, Should, Could, Won’t</em>); otra, comparar el valor de cada requerimiento con su esfuerzo.</p>
      <p>Los errores de requisitos son los más caros de la ingeniería de software porque se propagan: un malentendido al redactar se diseña, se programa y se prueba antes de descubrirse. Las dos figuras muestran qué se pierde
      cuando se prioriza mal y cuánto cuesta cada defecto según la fase en que se detecta.</p>`,
    visualizaciones: [
      {
        titulo: 'Priorizar con MoSCoW y valor/esfuerzo',
        descripcion: 'Cambie las categorías con clic y compare el valor capturado con el máximo posible. Pruebe «Asignar por valor/esfuerzo» y vea cómo suben la eficiencia y la cantidad de requerimientos Must que caben; luego reduzca el presupuesto.',
        montar: montarPriorizar,
      },
      {
        titulo: 'Costo de un defecto de requisitos',
        descripcion: 'Suba la eficacia de las revisiones tempranas y active la trazabilidad: los defectos se hallan antes y el costo cae. Aumente la volatilidad para ver cómo los cambios traen defectos nuevos.',
        montar: montarCostoDefecto,
      },
    ],
    teoria: String.raw`
      <h2>Ciclo de la gestión de requerimientos</h2>
      <ol>
        <li><strong>Captura</strong>: entrevistas, talleres, observación, historias de usuario; cada requerimiento con un identificador, un dueño y un criterio de aceptación.</li>
        <li><strong>Análisis y validación</strong>: se eliminan ambigüedades y contradicciones, y se confirma con los interesados.</li>
        <li><strong>Priorización</strong>: se decide el orden con un criterio explícito.</li>
        <li><strong>Trazabilidad</strong>: se vincula cada requerimiento con su origen, su diseño, su código y sus pruebas.</li>
        <li><strong>Control de cambios</strong>: cada cambio se evalúa, se aprueba o se rechaza, y se mide la volatilidad.</li>
      </ol>
      <h2>Técnicas de priorización</h2>
      <table>
        <tr><th>Categoría MoSCoW</th><th>Significado</th><th>Si no se hace</th></tr>
        <tr><td>Must</td><td>imprescindible para el release</td><td>el release no tiene sentido</td></tr>
        <tr><td>Should</td><td>importante, pero hay alternativa provisional</td><td>dolor, no fracaso</td></tr>
        <tr><td>Could</td><td>deseable si sobra tiempo o presupuesto</td><td>casi no se nota</td></tr>
        <tr><td>Won’t</td><td>acordado fuera de este release</td><td>se reevalúa más adelante</td></tr>
      </table>
      <p>MoSCoW ordena por necesidad pero no usa los costos. Con valor \(v_i\) y esfuerzo \(e_i\) se busca el conjunto \(S\) que maximiza el valor dentro del presupuesto \(B\), un problema de mochila:</p>
      \[ \max \sum_{i \in S} v_i \quad \text{sujeto a} \quad \sum_{i \in S} e_i \le B. \]
      <p>La regla voraz por razón \(v_i/e_i\) descendente es una buena aproximación y la figura calcula además el óptimo exacto por programación dinámica, con costo \(O(nB)\).</p>
      <h2>Costo de un defecto según la fase</h2>
      <p>Una corrección que toma \(c_0\) horas al redactar cuesta una cifra creciente después: aquí 2, 10, 40 y 200 horas al detectarse en revisión de requisitos, revisión de diseño, pruebas y producción (la forma de la curva de Boehm). Si se introducen
      \(D\) defectos y la fase \(k\) detecta la fracción \(\varepsilon_k\) de los que le llegan,</p>
      \[ n_k = D\,\varepsilon_k \prod_{j<k}(1-\varepsilon_j), \qquad \text{costo} = \sum_k n_k\,c_k. \]
      <p>La <em>volatilidad</em> (porcentaje de requisitos que cambian en un periodo) aumenta \(D\): cada cambio es una nueva oportunidad de error, y más aún si no hay trazabilidad que muestre qué diseño y qué pruebas toca.</p>
      <h2>Ejemplo resuelto</h2>
      <p>Con 100 requisitos, 15 % de defectos y sin cambios, \(D=15\). Con eficacias de 40 % (requisitos), 40 % (diseño) y 70 % (pruebas): se hallan 6 en requisitos (12 h), 3,6 en diseño (36 h), 3,78 en pruebas (151 h) y 1,62 llegan a producción (324 h):
      523 h en total. Sin revisiones tempranas, las pruebas hallarían 10,5 defectos (420 h) y 4,5 llegarían a producción (900 h): 1 320 h. Dos revisiones de pocas horas evitan unas 800 horas de correcciones.</p>
      <div class="recuadro"><p><strong>Advertencia.</strong> «Todo es Must» es el modo de falla más común de MoSCoW: si más de la mitad del esfuerzo es Must, no hay margen y la priorización ya no ordena nada. Una regla útil es limitar lo Must a cerca del 60 % del presupuesto.</p></div>
      <h2>Conexiones</h2>
      <p>El backlog de <a href="tema.html?id=scrum">Scrum</a> es una lista priorizada de requerimientos; en la <a href="tema.html?id=waterfall-vs-agile">cascada</a> se congelan al comienzo y por eso los cambios tardíos cuestan más.
      Qué construir y cuánto vale se justifica en el <a href="tema.html?id=business-case">caso de negocio</a>, y el equilibrio con plazo y costo se ve en <a href="tema.html?id=triple-constraint">alcance, tiempo, costo y calidad</a>. Los requisitos no funcionales también tienen defectos:
      vea <a href="tema.html?id=buy-vs-build">comprar o construir</a>.</p>`,
  });
})();
