(function () {
  'use strict';
  const { color: C } = VIZ;
  const recortar = (ctx, texto, ancho) => {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
    return t + '…';
  };

  /* ---------- Fig. 1: cuánto cuesta adivinar una contraseña ---------- */

  const ALFABETOS = [
    { id: 'dig', n: 'Dígitos', N: 10, u: 'dígitos', col: C.s1 },
    { id: 'min', n: 'Minúsculas', N: 26, u: 'letras', col: C.s2 },
    { id: 'alnum', n: 'Letras y dígitos', N: 62, u: 'caracteres', col: C.s3 },
    { id: 'imp', n: 'Todos los imprimibles', N: 94, u: 'caracteres', col: C.s4 },
    { id: 'pal', n: 'Palabras al azar (lista de 7 776)', N: 7776, u: 'palabras', col: C.s7 },
  ];
  const ATAQUES = [
    { id: 'blq', n: 'En línea con bloqueo (1 intento por segundo)', r: 1 },
    { id: 'lin', n: 'En línea sin límite (1 000 por segundo)', r: 1e3 },
    { id: 'lento', n: 'Hash lento con sal, una GPU (10 000 por segundo)', r: 1e4 },
    { id: 'rapido', n: 'Hash rápido sin sal, GPU (10 000 millones por segundo)', r: 1e10 },
  ];
  const HITOS = [[3600, '1 hora'], [86400, '1 día'], [3.156e7, '1 año'], [3.156e9, '1 siglo'], [3.156e13, '1 millón de años']];

  function tiempoLegible(s) {
    if (s < 1e-3) return 'menos de 1 ms';
    if (s < 1) return `${VIZ.fmt(s * 1000, 3)} ms`;
    if (s < 60) return `${VIZ.fmt(s, 3)} s`;
    if (s < 3600) return `${VIZ.fmt(s / 60, 3)} min`;
    if (s < 86400) return `${VIZ.fmt(s / 3600, 3)} h`;
    if (s < 3.156e7) return `${VIZ.fmt(s / 86400, 3)} días`;
    const a = s / 3.156e7;
    if (a < 1e6) return `${VIZ.fmt(a, 3)} años`;
    if (a < 1e9) return `${VIZ.fmt(a / 1e6, 3)} millones de años`;
    if (a < 1.38e10) return `${VIZ.fmt(a / 1e9, 3)} mil millones de años`;
    return `${VIZ.fmt(a / 1.38e10, 2)} veces la edad del universo`;
  }

  function montarContrasenas(cuerpo) {
    let alf = ALFABETOS[2], largo = 8, ataque = ATAQUES[2], pl = null, hover = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Alfabeto', opciones: ALFABETOS.map((a) => [a.id, `${a.n} (${a.N.toLocaleString('es-CL')})`]), valor: alf.id, alCambiar: (v) => { alf = ALFABETOS.find((a) => a.id === v); dibujar(); } });
    ctl.rango({ etiqueta: 'Largo (caracteres o palabras)', min: 4, max: 24, valor: largo, alCambiar: (v) => { largo = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Ataque', opciones: ATAQUES.map((a) => [a.id, a.n]), valor: ataque.id, alCambiar: (v) => { ataque = ATAQUES.find((a) => a.id === v); dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.62, altoMin: 300, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, ALFABETOS.map((a) => ({ color: a.col, texto: a.n, forma: 'linea' })).concat([{ color: C.apagado, texto: 'hitos de tiempo', forma: 'linea' }]));
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada línea es el tiempo promedio para adivinar por fuerza bruta una clave elegida al azar. Cambie el ataque y el alfabeto, mueva el largo y observe que alargar la clave pesa más que ampliar el alfabeto. Pase el cursor para comparar alfabetos.');

    const segundos = (a, L, at) => (a.N ** L / 2) / at.r;
    function dibujar() {
      const { ctx } = lienzo;
      lienzo.limpiar();
      pl = VIZ.plano(lienzo, { xmin: 4, xmax: 24, ymin: 1e-3, ymax: 1e24 }, { logY: true, etiquetaX: 'largo', etiquetaY: 'segundos (promedio)', ticksX: [4, 8, 12, 16, 20, 24], ticksY: [1e-3, 1, 1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24] });
      pl.ejes();
      ctx.save(); pl.recortar();
      ctx.font = VIZ.fuente(10); ctx.textBaseline = 'bottom'; ctx.textAlign = 'right';
      HITOS.forEach(([s, t]) => {
        const y = pl.sy(s);
        ctx.setLineDash([3, 4]); ctx.strokeStyle = C.apagado; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pl.x0, y); ctx.lineTo(pl.x1, y); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = C.apagado; ctx.fillText(t, pl.x1 - 4, y - 2);
      });
      ctx.restore();
      ALFABETOS.forEach((a) => {
        const pts = [];
        for (let L = 4; L <= 24; L++) pts.push([L, segundos(a, L, ataque)]);
        ctx.save(); pl.recortar();
        VIZ.trazar(ctx, pl, pts, a === alf ? a.col : VIZ.alfa(a.col, 0.5), a === alf ? 3 : 1.5);
        ctx.restore();
      });
      const s = segundos(alf, largo, ataque);
      ctx.save(); pl.recortar(); VIZ.marcador(ctx, pl.sx(largo), pl.sy(Math.max(s, 1e-3)), alf.col, 6); ctx.restore();
      if (hover) {
        ctx.strokeStyle = C.tenue; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pl.sx(hover), pl.y1); ctx.lineTo(pl.sx(hover), pl.y0); ctx.stroke();
      }
      const bits = largo * Math.log2(alf.N);
      registro.textContent = `${alf.N.toLocaleString('es-CL')}^${largo} combinaciones; en promedio se prueba la mitad: ${tiempoLegible(s)} a ${ataque.r.toLocaleString('es-CL')} intentos por segundo.`;
      lectura.set([
        ['combinaciones', `${alf.N}^${largo} ≈ ${VIZ.fmt(alf.N ** largo, 3)}`],
        ['entropía', `${VIZ.fmt(bits, 3)} bits`],
        ['tiempo promedio', tiempoLegible(s)],
        ['peor caso', tiempoLegible(s * 2)],
        ['¿resiste un año?', s >= 3.156e7 ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!pl || !pl.dentro(x, y)) { hover = null; tip.ocultar(); return dibujar(); }
      hover = Math.max(4, Math.min(24, Math.round(pl.ix(x))));
      dibujar();
      tip.mostrar(x, y, `largo <b>${hover}</b>` + ALFABETOS.map((a) => VIZ.filaTooltip(a.col, a.n, tiempoLegible(segundos(a, hover, ataque)))).join(''));
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    dibujar();
  }

  /* ---------- Fig. 2: factores de autenticación ---------- */

  const FACTORES = [
    { id: 'pw', n: 'Contraseña (algo que sabe)', corto: 'contraseña', p: 0.3 },
    { id: 'tok', n: 'Código en el teléfono (algo que tiene)', corto: 'teléfono', p: 0.06 },
    { id: 'bio', n: 'Huella digital (algo que es)', corto: 'huella', p: 0.01 },
  ];
  const CAMPANAS = {
    phishing: { n: 'Phishing masivo', p: [0.3, 0.08, 0.002] },
    filtrada: { n: 'Contraseñas filtradas y reutilizadas', p: [0.6, 0.01, 0.001] },
    sim: { n: 'Robo del chip del teléfono (SIM swap)', p: [0.25, 0.3, 0.001] },
  };

  function montarFactoresAutenticacion(cuerpo) {
    let semilla = 1, sel = -1, hover = -1, geo = null, u = [];
    const prob = FACTORES.map((f) => f.p);
    const ctl = VIZ.controles(cuerpo);
    const sCamp = ctl.selector({ etiqueta: 'Tipo de ataque', opciones: Object.entries(CAMPANAS).map(([k, c]) => [k, c.n]), valor: 'phishing', alCambiar: (v) => { CAMPANAS[v].p.forEach((p, k) => { prob[k] = p; rP[k].valor = p; }); dibujar(); } });
    const rP = FACTORES.map((f, k) => ctl.rango({ etiqueta: `Atacante obtiene ${f.corto}`, min: 0, max: 1, paso: 0.005, valor: prob[k], formato: (v) => `${VIZ.fmt(v * 100, 3)} %`, alCambiar: (v) => { prob[k] = v; dibujar(); } }));
    const activos = ctl.casillas(FACTORES.map((f) => ({ clave: f.id, texto: `Exigir ${f.n}`, activo: f.id === 'pw' })), () => dibujar());
    ctl.boton('Nuevo ataque', () => { semilla++; generar(); sel = -1; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => { const cols = w < 520 ? 20 : 25; return Math.ceil(400 / cols) * Math.floor(w / cols) + 8; } });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s6, texto: 'cuenta segura' }, { color: C.s4, texto: 'segura, pero el atacante obtuvo parte de los factores' }, { color: C.s8, texto: 'cuenta comprometida' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es una cuenta de una empresa de 400. Marque los factores que se exigen para entrar: una cuenta cae solo si el atacante obtiene todos. Haga clic en un punto para ver qué obtuvo el atacante en esa cuenta.');

    function generar() {
      const rnd = VIZ.semilla(semilla * 7919);
      u = Array.from({ length: 400 }, () => FACTORES.map(() => rnd()));
    }
    const estadoCuenta = (i) => {
      const exigidos = FACTORES.map((f, k) => (activos[f.id] ? k : -1)).filter((k) => k >= 0);
      const obtenidos = exigidos.filter((k) => u[i][k] < prob[k]);
      return { exigidos, obtenidos, caida: exigidos.length === 0 || obtenidos.length === exigidos.length };
    };
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const cols = W < 520 ? 20 : 25, c = Math.floor(W / cols), x0 = (W - c * cols) / 2;
      geo = { cols, c, x0 };
      let caidas = 0, parciales = 0;
      for (let i = 0; i < 400; i++) {
        const e = estadoCuenta(i);
        const x = x0 + (i % cols) * c + c / 2, y = 4 + Math.floor(i / cols) * c + c / 2;
        if (e.caida) caidas++;
        const parcial = !e.caida && e.obtenidos.length > 0;
        if (parcial) parciales++;
        ctx.beginPath(); ctx.arc(x, y, c * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = e.caida ? C.s8 : parcial ? C.s4 : C.s6; ctx.fill();
        if (i === sel || i === hover) { ctx.lineWidth = 2.5; ctx.strokeStyle = C.tinta; ctx.stroke(); }
      }
      const exigidos = FACTORES.filter((f) => activos[f.id]);
      const teorica = exigidos.length ? exigidos.reduce((p, f) => p * prob[FACTORES.indexOf(f)], 1) : 1;
      if (sel >= 0) {
        const e = estadoCuenta(sel);
        registro.textContent = `Cuenta ${sel + 1}: el atacante ${e.exigidos.length ? 'obtuvo ' + (e.obtenidos.map((k) => FACTORES[k].corto).join(' y ') || 'ningún factor') + ` de los ${e.exigidos.length} exigidos` : 'no enfrentó ningún factor'} → ${e.caida ? 'cuenta comprometida' : 'cuenta segura'}.`;
      } else {
        registro.textContent = exigidos.length
          ? `Se exige ${exigidos.map((f) => f.corto).join(' + ')}: probabilidad teórica de caída = ${exigidos.map((f) => VIZ.fmt(prob[FACTORES.indexOf(f)] * 100, 3) + ' %').join(' × ')} = ${VIZ.fmt(teorica * 100, 3)} %.`
          : 'Sin ningún factor exigido, cualquier persona entra: todas las cuentas caen.';
      }
      lectura.set([
        ['cuentas comprometidas', `${caidas} de 400`],
        ['tasa observada', `${VIZ.fmt((caidas / 4), 3)} %`],
        ['tasa teórica', `${VIZ.fmt(teorica * 100, 3)} %`],
        ['segura con ataque parcial', String(parciales)],
        ['factores exigidos', String(exigidos.length)],
      ]);
    }
    const indice = (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const col = Math.floor((x - geo.x0) / geo.c), fila = Math.floor((y - 4) / geo.c);
      const i = fila * geo.cols + col;
      return col >= 0 && col < geo.cols && fila >= 0 && i >= 0 && i < 400 ? { i, x, y } : null;
    };
    lienzo.alDibujar = () => u.length && dibujar();
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const r = indice(ev);
      const nuevo = r ? r.i : -1;
      if (nuevo !== hover) { hover = nuevo; dibujar(); }
      if (!r) return tip.ocultar();
      const e = estadoCuenta(r.i);
      tip.mostrar(r.x, r.y, `<b>cuenta ${r.i + 1}</b>` + FACTORES.map((f, k) => `<br>${f.corto}: ${u[r.i][k] < prob[k] ? 'obtenida' : 'no obtenida'}${activos[f.id] ? '' : ' (no exigida)'}`).join('') + `<br>${e.caida ? 'comprometida' : 'segura'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = -1; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => { const r = indice(ev); if (r) { sel = r.i; dibujar(); } });
    sCamp.valor = 'phishing';
    generar();
    dibujar();
  }

  /* ---------- Fig. 3: matriz de permisos por rol ---------- */

  const ROLES = ['Practicante', 'Analista', 'Contador', 'Soporte TI', 'Gerente'];
  const ROL_CORTO = ['Prac.', 'Anal.', 'Cont.', 'TI', 'Ger.'];
  const PERMISOS = ['Leer clientes', 'Editar clientes', 'Ver nómina', 'Aprobar pagos', 'Administrar servidores', 'Leer auditoría', 'Borrar registros'];
  const USUARIOS = [
    { n: 'Beto', roles: [0], necesita: [0] },
    { n: 'Ana', roles: [1], necesita: [0, 1] },
    { n: 'Carla', roles: [2, 1], necesita: [0, 2, 3] },
    { n: 'Dante', roles: [3], necesita: [4] },
    { n: 'Elena', roles: [4], necesita: [0, 3, 5] },
  ];
  // Matriz inicial, con privilegios de sobra (como ocurre en una organización que nunca los revisa).
  const INICIAL = [[0, 1, 2], [0, 1, 2, 5], [0, 1, 2, 3], [0, 4, 5, 6], [0, 1, 2, 3, 4, 5]];

  function montarRoles(cuerpo) {
    const M = INICIAL.map((l) => PERMISOS.map((_, p) => l.includes(p)));
    let uSel = 0, pSel = 3, hover = null, geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Usuario', opciones: USUARIOS.map((u, k) => [k, `${u.n} (${u.roles.map((r) => ROLES[r]).join(' + ')})`]), valor: uSel, alCambiar: (v) => { uSel = +v; dibujar(); } });
    ctl.selector({ etiqueta: 'Intenta…', opciones: PERMISOS.map((p, k) => [k, p]), valor: pSel, alCambiar: (v) => { pSel = +v; dibujar(); } });
    ctl.boton('Aplicar mínimo privilegio', () => {
      M.forEach((fila) => fila.fill(false));
      USUARIOS.forEach((u) => u.roles.forEach((r) => u.necesita.forEach((p) => { M[r][p] = true; })));
      dibujar();
    }, { primario: true });
    ctl.boton('Restaurar permisos iniciales', () => { M.forEach((fila, r) => PERMISOS.forEach((_, p) => { fila[p] = INICIAL[r].includes(p); })); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 40 + PERMISOS.length * 34 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [
      { color: C.s1, texto: 'permiso concedido y necesario' }, { color: C.s2, texto: 'permiso de más' },
      { color: C.sobre, borde: C.s8, texto: 'permiso que falta' }, { color: C.sobre, borde: C.eje, texto: 'no concedido' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const cajaTabla = VIZ.el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(cajaTabla);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada columna es un rol. Haga clic en una celda para conceder o quitar un permiso. Elija un usuario y una acción para probar si puede realizarla; luego pulse «Aplicar mínimo privilegio» y compruebe que nadie pierde lo que necesita.');

    const concedidos = (u) => PERMISOS.map((_, p) => u.roles.some((r) => M[r][p]));
    const necesitaRol = (r, p) => USUARIOS.some((u) => u.roles.includes(r) && u.necesita.includes(p));
    const faltaRol = (r, p) => !M[r][p] && necesitaRol(r, p) && !USUARIOS.filter((u) => u.roles.includes(r) && u.necesita.includes(p)).every((u) => concedidos(u)[p]);
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const izq = W < 500 ? 118 : 200, top = 30, fila = 34, cw = (W - izq - 6) / ROLES.length;
      geo = { izq, top, fila, cw };
      ctx.font = VIZ.fuente(11, 600); ctx.fillStyle = C.tinta2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ROLES.forEach((r, k) => ctx.fillText(W < 500 ? ROL_CORTO[k] : r, izq + (k + 0.5) * cw, 14));
      PERMISOS.forEach((p, i) => {
        const y = top + i * fila;
        ctx.font = VIZ.fuente(11, i === pSel ? 600 : 400); ctx.fillStyle = C.tinta; ctx.textAlign = 'left';
        ctx.fillText(recortar(ctx, p, izq - 12), 6, y + fila / 2);
        ROLES.forEach((_, r) => {
          const x = izq + r * cw + 3, w = cw - 6;
          const dado = M[r][i], nec = necesitaRol(r, i);
          ctx.beginPath(); ctx.roundRect(x, y + 3, w, fila - 6, 4);
          if (dado) { ctx.fillStyle = nec ? C.s1 : C.s2; ctx.fill(); }
          else { ctx.fillStyle = C.superficie; ctx.fill(); ctx.strokeStyle = faltaRol(r, i) ? C.s8 : C.eje; ctx.lineWidth = faltaRol(r, i) ? 2.5 : 1; ctx.stroke(); }
          if (hover && hover.r === r && hover.p === i) { ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.stroke(); }
        });
      });
      const u = USUARIOS[uSel], g = concedidos(u);
      const via = u.roles.filter((r) => M[r][pSel]).map((r) => ROLES[r]);
      registro.textContent = `${u.n} intenta «${PERMISOS[pSel]}»: ${g[pSel] ? `PERMITIDO por el rol ${via.join(' y ')}` : 'DENEGADO, ninguno de sus roles lo incluye'}${g[pSel] && !u.necesita.includes(pSel) ? '; su trabajo no lo requiere (privilegio de más)' : ''}.`;
      let exceso = 0, falta = 0;
      const filas = USUARIOS.map((us) => {
        const gr = concedidos(us);
        const de = PERMISOS.filter((_, p) => gr[p] && !us.necesita.includes(p)), fa = PERMISOS.filter((_, p) => !gr[p] && us.necesita.includes(p));
        exceso += de.length; falta += fa.length;
        return `<tr><td class="izq">${us.n}</td><td class="izq">${us.roles.map((r) => ROLES[r]).join(' + ')}</td><td>${de.length}</td><td>${fa.length}</td><td class="izq">${de.concat(fa.map((x) => '(falta) ' + x)).join(', ') || '—'}</td></tr>`;
      });
      cajaTabla.innerHTML = `<table class="tabla-datos texto"><tr><th>Usuario</th><th>Roles</th><th>De más</th><th>Faltan</th><th>Detalle</th></tr>${filas.join('')}</table>`;
      const conflicto = USUARIOS.filter((us) => { const gr = concedidos(us); return gr[3] && gr[6]; }).map((us) => us.n);
      lectura.set([
        ['permisos de más', String(exceso)], ['permisos que faltan', String(falta)],
        ['permisos concedidos', String(M.reduce((s, f) => s + f.filter(Boolean).length, 0))],
        ['aprueban y borran registros', conflicto.length ? conflicto.join(', ') : 'nadie'],
      ]);
    }
    const celda = (x, y) => {
      const r = Math.floor((x - geo.izq) / geo.cw), p = Math.floor((y - geo.top) / geo.fila);
      return r >= 0 && r < ROLES.length && p >= 0 && p < PERMISOS.length ? { r, p } : null;
    };
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'pointer';
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celda(x, y);
      hover = c; dibujar();
      if (!c) return tip.ocultar();
      const quienes = USUARIOS.filter((u) => u.roles.includes(c.r)).map((u) => u.n);
      tip.mostrar(x, y, `<b>${ROLES[c.r]}</b> · ${PERMISOS[c.p]}<br>${M[c.r][c.p] ? 'concedido' : 'no concedido'}${necesitaRol(c.r, c.p) ? ', necesario' : ''}<br>titulares: ${quienes.join(', ') || 'nadie'}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => { hover = null; tip.ocultar(); dibujar(); });
    lienzo.canvas.addEventListener('click', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      const c = celda(x, y);
      if (c) { M[c.r][c.p] = !M[c.r][c.p]; dibujar(); }
    });
    dibujar();
  }

  VIZ.registrarTema('authentication-access-control', {
    intro: String.raw`
      <p>Tres preguntas distintas protegen un sistema: <strong>autenticación</strong> (¿quién es usted?), <strong>autorización</strong> (¿qué tiene permitido hacer?) y
      <strong>control de acceso</strong> (el mecanismo que aplica esas reglas cada vez que alguien intenta algo). Confundirlas es una fuente común de errores: iniciar sesión no significa poder verlo todo.</p>
      <p>Una contraseña por sí sola es un factor débil, porque se adivina, se filtra o se entrega a un sitio falso. Combinar factores de distinto tipo y conceder a cada persona solo los permisos que su trabajo
      requiere (<em>mínimo privilegio</em>) limita el daño cuando una cuenta cae.</p>`,
    visualizaciones: [
      {
        titulo: 'Cuánto tarda adivinar una contraseña',
        descripcion: 'Compare alfabetos y ataques sobre una escala logarítmica. Pruebe 8 caracteres con «hash rápido»: cae en segundos; luego suba el largo a 14 o use cuatro palabras al azar.',
        montar: montarContrasenas,
      },
      {
        titulo: 'Factores de autenticación contra un ataque',
        descripcion: 'Con solo contraseña, el ataque derriba a casi un tercio de las cuentas; exija además el teléfono o la huella y cuente cuántas caen. Pruebe «SIM swap» para ver cuándo falla el segundo factor.',
        montar: montarFactoresAutenticacion,
      },
      {
        titulo: 'Matriz de permisos por rol',
        descripcion: 'La matriz inicial concede de más. Pruebe a un usuario con una acción, quite celdas naranjas a mano y luego compare con «Aplicar mínimo privilegio»; el borde rojo marca lo que falta.',
        montar: montarRoles,
      },
    ],
    teoria: String.raw`
      <h2>Autenticar, autorizar, controlar</h2>
      <table>
        <tr><th>Concepto</th><th>Pregunta</th><th>Ejemplo</th></tr>
        <tr><td>Identificación</td><td>¿Quién dice ser?</td><td>nombre de usuario</td></tr>
        <tr><td>Autenticación</td><td>¿Lo demuestra?</td><td>contraseña, código del teléfono, huella</td></tr>
        <tr><td>Autorización</td><td>¿Qué puede hacer?</td><td>«el rol Contador puede aprobar pagos»</td></tr>
        <tr><td>Registro (auditoría)</td><td>¿Qué hizo?</td><td>bitácora de accesos y cambios</td></tr>
      </table>
      <p>Los factores de autenticación son de tres tipos: <em>algo que se sabe</em> (clave), <em>algo que se tiene</em> (teléfono, llave de seguridad) y <em>algo que se es</em> (biometría). La autenticación multifactor (MFA)
      exige factores de <strong>tipos distintos</strong>: dos contraseñas siguen siendo un solo tipo de factor.</p>
      <h2>Fuerza de una contraseña</h2>
      <p>Una clave elegida al azar con un alfabeto de \(N\) símbolos y largo \(L\) tiene \(N^L\) posibilidades, es decir, entropía \(H = L \log_2 N\) bits. Un atacante que prueba \(r\) claves por segundo necesita en promedio</p>
      \[ T = \frac{N^L}{2\,r} \text{ segundos.} \]
      <p>Alargar la clave multiplica el tiempo por \(N\) con cada símbolo; ampliar el alfabeto solo sube la base. Las claves que las personas inventan tienen mucha menos entropía que las aleatorias (nombres, fechas,
      sustituciones previsibles), por lo que la fuerza bruta real empieza por diccionarios.</p>
      <div class="recuadro"><p><strong>Ejemplo resuelto.</strong> Ocho caracteres con letras y dígitos: \(62^8 \approx 2{,}18 \times 10^{14}\) claves, \(H \approx 47{,}6\) bits. Contra un hash rápido a \(10^{10}\) intentos por segundo,
      \(T = 2{,}18 \times 10^{14} / (2 \times 10^{10}) \approx 10\,900\) s, unas tres horas. Con cuatro palabras al azar de una lista de \(7\,776\): \(7776^4 \approx 3{,}7 \times 10^{15}\) (51,7 bits), unas 51 horas en el mismo ataque
      y mucho más fácil de recordar.</p></div>
      <h2>Probabilidad de comprometer una cuenta con MFA</h2>
      <p>Si el atacante obtiene cada factor exigido de manera independiente con probabilidades \(p_1, \dots, p_k\), la cuenta cae solo si obtiene todos:</p>
      \[ P(\text{cae}) = \prod_{j=1}^{k} p_j. \]
      <p>Con \(p_1 = 0{,}3\) para la clave, un segundo factor con \(p_2 = 0{,}06\) baja la probabilidad a \(1{,}8\,\%\). La independencia es la clave: si ambos factores pasan por el mismo canal (un SIM swap que captura el teléfono y
      también el correo de recuperación), la reducción es menor.</p>
      <h2>Control de acceso basado en roles</h2>
      <p>En <em>RBAC</em> los permisos se agrupan en roles y los usuarios reciben roles. El <strong>mínimo privilegio</strong> exige que cada rol incluya solo lo que sus titulares necesitan; la <strong>separación de funciones</strong> evita
      que una misma persona pueda iniciar y aprobar una operación (o aprobar pagos y borrar los registros que lo evidencian). Si \(P_u\) son los permisos concedidos a \(u\) y \(N_u\) los que necesita,
      los privilegios de más son \(P_u \setminus N_u\) y los faltantes \(N_u \setminus P_u\); el objetivo es que ambos conjuntos queden vacíos.</p>
      <h2>Conexiones</h2>
      <p>Estas defensas protegen la confidencialidad de la <a href="tema.html?id=cia-triad">tríada CIA</a>. El factor humano que los atacantes explotan se estudia en
      <a href="tema.html?id=malware-phishing-social-engineering">phishing e ingeniería social</a>, y el cifrado y el hash que guardan las claves en <a href="tema.html?id=data-protection">protección de datos</a>.</p>`,
  });
})();
