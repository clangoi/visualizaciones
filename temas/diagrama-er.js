(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  // Cardinalidad «izq:der» de Profesor —dicta— Curso.
  const CARD = {
    '1:1': { izq: '1', der: '1', texto: 'cada profesor dicta a lo más un curso y cada curso tiene a lo más un profesor' },
    '1:N': { izq: '1', der: 'N', texto: 'un profesor dicta muchos cursos; cada curso tiene a lo más un profesor' },
    'N:1': { izq: 'N', der: '1', texto: 'cada profesor dicta a lo más un curso; un curso puede tener muchos profesores' },
    'N:M': { izq: 'N', der: 'M', texto: 'sin límites: cualquier profesor con cualquier curso' },
  };

  function ovalo(ctx, x, y, rx, ry, texto, { clave = false, multivalor = false, px = 11 } = {}) {
    ctx.fillStyle = C.superficie;
    ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (multivalor) { ctx.beginPath(); ctx.ellipse(x, y, rx - 3, ry - 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(px, 400);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y + 0.5);
    if (clave) {
      const w = ctx.measureText(texto).width;
      ctx.beginPath(); ctx.moveTo(x - w / 2, y + 7); ctx.lineTo(x + w / 2, y + 7); ctx.stroke();
    }
  }
  function rombo(ctx, x, y, w, h, texto, color = C.tinta) {
    ctx.fillStyle = C.superficie; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - w / 2, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.font = VIZ.fuente(12, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y + 0.5);
  }

  function traduccion(card, multivalor) {
    const prof = ['CREATE TABLE Profesor (', '  rut     CHAR(12) PRIMARY KEY', '  nombre  TEXT'];
    const curso = ['CREATE TABLE Curso (', '  sigla   CHAR(7) PRIMARY KEY', '  titulo  TEXT'];
    const extra = [];
    if (card === '1:N') curso.push('  rut_profesor CHAR(12) REFERENCES Profesor  -- el lado N recibe la clave', '  semestre     TEXT');
    else if (card === 'N:1') prof.push('  sigla_curso CHAR(7) REFERENCES Curso  -- el lado N recibe la clave', '  semestre    TEXT');
    else if (card === '1:1') curso.push('  rut_profesor CHAR(12) UNIQUE REFERENCES Profesor  -- UNIQUE: a lo más uno', '  semestre     TEXT');
    else extra.push('CREATE TABLE Dicta (                -- N:M: tabla propia', '  rut      CHAR(12) REFERENCES Profesor,', '  sigla    CHAR(7)  REFERENCES Curso,', '  semestre TEXT,', '  PRIMARY KEY (rut, sigla)', ');');
    const coma = (x) => (x.includes('--') ? x.replace(/\s+--/, ',  --') : x + ',');
    const cerrar = (l) => l.map((x, i) => (i > 0 && i < l.length - 1 ? coma(x) : x)).concat(');');
    const partes = [cerrar(prof), cerrar(curso)];
    if (multivalor) partes.push(['CREATE TABLE TelefonoProfesor (    -- atributo multivalor', '  rut      CHAR(12) REFERENCES Profesor,', '  telefono TEXT,', '  PRIMARY KEY (rut, telefono)', ');']);
    if (extra.length) partes.push(extra);
    return partes.map((p) => p.join('\n')).join('\n\n');
  }

  /* ---------- Fig. 1: diagrama y traducción ---------- */

  function montarDiagrama(cuerpo) {
    let card = 'N:M', multivalor = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Cardinalidad', valor: card, opciones: Object.keys(CARD).map((k) => [k, k]), alCambiar: (v) => { card = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'teléfono multivalor', valor: multivalor, alCambiar: (v) => { multivalor = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.36, altoMin: 230, altoMax: 290 });
    cuerpo.dataset.sinLeyenda = 'el diagrama usa formas, no colores: rectángulo = entidad, rombo = relación, óvalo = atributo';
    const registro = VIZ.registro(cuerpo);
    const codigo = VIZ.el('pre', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambie la cardinalidad y observe qué tabla recibe la clave foránea o si aparece una tabla nueva.');

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 520;
      const ew = angosto ? 74 : 96, eh = 34, cy = H * 0.62;
      const xi = 10 + ew / 2, xd = W - 10 - ew / 2, xr = W / 2;
      const px = angosto ? 10 : 11;
      // Atributos.
      const atr = (x0, lista) => lista.forEach(([t, o], i) => {
        const n = lista.length, x = x0 + (i - (n - 1) / 2) * (angosto ? 56 : 74), y = cy - 78 + (i % 2) * 14;
        ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x0, cy - eh / 2); ctx.stroke();
        ovalo(ctx, x, y, angosto ? 26 : 34, 12, t, { ...o, px });
      });
      atr(Math.max(xi, angosto ? 70 : 90), [['rut', { clave: true }], ['nombre', {}], ...(multivalor ? [['teléfono', { multivalor: true }]] : [])]);
      atr(Math.min(xd, W - (angosto ? 70 : 90)), [['sigla', { clave: true }], ['titulo', {}]]);
      // Líneas y rombo.
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xi + ew / 2, cy); ctx.lineTo(xd - ew / 2, cy); ctx.stroke();
      ctx.strokeStyle = C.tinta2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xr, cy + 20); ctx.lineTo(xr, cy + 42); ctx.stroke();
      ovalo(ctx, xr, cy + 54, angosto ? 32 : 38, 12, 'semestre', { px });
      rombo(ctx, xr, cy, angosto ? 76 : 96, 42, 'dicta');
      B.caja(ctx, xi - ew / 2, cy - eh / 2, ew, eh, 'Profesor');
      B.caja(ctx, xd - ew / 2, cy - eh / 2, ew, eh, 'Curso');
      const c = CARD[card];
      ctx.font = VIZ.fuente(14, 600); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(c.izq, (xi + ew / 2 + xr - 48) / 2, cy - 4);
      ctx.fillText(c.der, (xd - ew / 2 + xr + 48) / 2, cy - 4);
      registro.textContent = `${card}: ${c.texto}.`;
      codigo.textContent = traduccion(card, multivalor);
      lectura.set([
        ['tablas', String(2 + (card === 'N:M' ? 1 : 0) + (multivalor ? 1 : 0))],
        ['clave foránea en', card === 'N:M' ? 'Dicta' : card === 'N:1' ? 'Profesor' : 'Curso'],
        ['¿UNIQUE extra?', card === '1:1' ? 'sí' : 'no'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  /* ---------- Fig. 2: instancias que respetan (o no) la cardinalidad ---------- */

  function montarInstancias(cuerpo) {
    const PROF = ['Rosa', 'Tomás', 'Úrsula', 'Víctor'];
    const CURSOS = ['IIC2413', 'IIC2133', 'MAT1610', 'IIC3633', 'FIS1514'];
    let card = '1:N', enlaces = new Set(['0-0', '0-1', '1-2', '2-2', '3-4']), elegido = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Restricción', valor: card, opciones: Object.keys(CARD).map((k) => [k, k]), alCambiar: (v) => { card = v; dibujar(); } });
    ctl.boton('Vaciar', () => { enlaces.clear(); elegido = null; dibujar(); });
    ctl.boton('Ejemplo', () => { enlaces = new Set(['0-0', '0-1', '1-2', '2-2', '3-4']); elegido = null; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.5, altoMin: 250, altoMax: 320 });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta2, texto: 'par en la relación dicta', forma: 'linea' },
      { color: C.s8, texto: 'par que viola la cardinalidad', forma: 'linea' },
      { color: C.s1, texto: 'profesor elegido', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga clic en un profesor y luego en un curso para agregar o quitar el par.');

    let geo = null;
    function violaciones() {
      const malos = new Set();
      const porProf = new Map(), porCurso = new Map();
      for (const e of enlaces) {
        const [p, c] = e.split('-');
        porProf.set(p, [...(porProf.get(p) || []), e]);
        porCurso.set(c, [...(porCurso.get(c) || []), e]);
      }
      const izqUno = CARD[card].izq === '1', derUno = CARD[card].der === '1';
      // 1:N → cada curso con a lo más un profesor; N:1 → cada profesor con a lo más un curso.
      if (izqUno) for (const l of porCurso.values()) if (l.length > 1) l.forEach((e) => malos.add(e));
      if (derUno) for (const l of porProf.values()) if (l.length > 1) l.forEach((e) => malos.add(e));
      return malos;
    }
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const xp = Math.max(70, W * 0.22), xc = Math.min(W - 70, W * 0.78);
      const yp = (i) => 30 + (i * (H - 60)) / (PROF.length - 1), yc = (i) => 24 + (i * (H - 48)) / (CURSOS.length - 1);
      geo = { xp, xc, yp, yc };
      const malos = violaciones();
      for (const e of enlaces) {
        const [p, c] = e.split('-').map(Number);
        ctx.strokeStyle = malos.has(e) ? C.s8 : C.tinta2; ctx.lineWidth = malos.has(e) ? 3 : 1.5;
        ctx.beginPath(); ctx.moveTo(xp + 8, yp(p)); ctx.lineTo(xc - 8, yc(c)); ctx.stroke();
      }
      PROF.forEach((t, i) => {
        VIZ.marcador(ctx, xp, yp(i), elegido === i ? C.s1 : C.tinta, elegido === i ? 7 : 5.5);
        B.texto(ctx, t, xp - 14, yp(i), { alinear: 'right', px: 12, color: C.tinta });
      });
      CURSOS.forEach((t, i) => {
        VIZ.marcador(ctx, xc, yc(i), C.tinta, 5.5);
        B.texto(ctx, t, xc + 14, yc(i), { px: 12, color: C.tinta });
      });
      B.texto(ctx, 'Profesor', xp, 10, { alinear: 'center', color: C.apagado, px: 10 });
      B.texto(ctx, 'Curso', xc, 10, { alinear: 'center', color: C.apagado, px: 10 });
      registro.textContent = malos.size
        ? `La instancia viola ${card}: ${CARD[card].texto}.`
        : `La instancia cumple ${card}.`;
      lectura.set([['pares', String(enlaces.size)], ['pares en conflicto', String(malos.size)], ['restricción', card]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const ip = PROF.findIndex((_, i) => Math.hypot(x - geo.xp, y - geo.yp(i)) < 18 || (Math.abs(y - geo.yp(i)) < 12 && x < geo.xp + 10 && x > geo.xp - 80));
      const ic = CURSOS.findIndex((_, i) => Math.hypot(x - geo.xc, y - geo.yc(i)) < 18 || (Math.abs(y - geo.yc(i)) < 12 && x > geo.xc - 10 && x < geo.xc + 80));
      if (ip >= 0) elegido = elegido === ip ? null : ip;
      else if (ic >= 0 && elegido != null) {
        const e = `${elegido}-${ic}`;
        if (enlaces.has(e)) enlaces.delete(e); else enlaces.add(e);
      }
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('diagrama-er', {
    intro: String.raw`
      <p>El <strong>modelo entidad-relación</strong> (Peter Chen, 1976) es la etapa de diseño <em>conceptual</em>: antes de pensar en
      tablas, se dibujan las cosas del dominio (<strong>entidades</strong>), sus propiedades (<strong>atributos</strong>) y cómo se vinculan
      (<strong>relaciones</strong>). El diagrama se discute con quienes conocen el negocio, y después se traduce casi mecánicamente a un
      esquema relacional.</p>
      <p>Lo más importante de un diagrama no son las cajas, sino las <strong>restricciones</strong>: cuántas veces puede participar cada
      entidad en una relación. De ellas depende dónde va cada clave foránea.</p>`,
    visualizaciones: [
      {
        titulo: 'Del diagrama a las tablas',
        descripcion: 'Profesor dicta Curso, con un atributo de la relación (semestre). Cambie la cardinalidad: con 1:N la clave viaja al lado N; con N:M nace una tabla propia.',
        montar: montarDiagrama,
      },
      {
        titulo: 'Instancias y cardinalidad',
        descripcion: 'Una relación es un conjunto de pares. Agregue pares y vea cuáles violan la cardinalidad elegida; con N:M nunca hay conflictos.',
        montar: montarInstancias,
      },
    ],
    teoria: String.raw`
      <h2>Elementos</h2>
      <table>
        <tr><th>Elemento</th><th>Símbolo</th><th>Ejemplo</th></tr>
        <tr><td>conjunto de entidades</td><td>rectángulo</td><td>Profesor, Curso</td></tr>
        <tr><td>atributo</td><td>óvalo (clave subrayada)</td><td><u>rut</u>, nombre</td></tr>
        <tr><td>atributo multivalor</td><td>óvalo doble</td><td>teléfonos</td></tr>
        <tr><td>atributo derivado</td><td>óvalo punteado</td><td>edad (de la fecha de nacimiento)</td></tr>
        <tr><td>relación</td><td>rombo</td><td>dicta</td></tr>
        <tr><td>entidad débil</td><td>rectángulo doble</td><td>Sección (depende de Curso)</td></tr>
      </table>
      <p>Una relación \(R\) entre conjuntos de entidades \(E_1, \dots, E_k\) es un subconjunto de \(E_1 \times \cdots \times E_k\). Sus
      atributos (como semestre) describen al par, no a ninguna entidad por separado.</p>

      <h2>Cardinalidad</h2>
      <p>En una relación binaria entre \(E\) y \(F\):</p>
      <ul>
        <li><strong>1:1</strong>: cada \(e\) se relaciona con a lo más un \(f\), y viceversa.</li>
        <li><strong>1:N</strong>: cada \(f\) se relaciona con a lo más un \(e\); un \(e\) puede tener muchos \(f\).</li>
        <li><strong>N:M</strong>: sin restricción.</li>
      </ul>
      <p>La <em>participación</em> dice además si cada entidad debe aparecer al menos una vez (total) o puede no aparecer (parcial).
      Distintos libros dibujan esto de formas distintas; la <a href="tema.html?id=ramakrishnan">notación de Ramakrishnan</a> usa flechas y
      líneas gruesas.</p>

      <h2>Traducción a tablas</h2>
      <pre><code>para cada conjunto de entidades E:  tabla E(clave, atributos simples)
para cada atributo multivalor A de E:  tabla E_A(clave de E, A)
para cada relación R entre E y F:
    si R es N:M:  tabla R(clave de E, clave de F, atributos de R)
    si R es 1:N (un E por cada F):  agregar a F la clave de E y los atributos de R
    si R es 1:1:  como 1:N, con UNIQUE sobre la clave foránea</code></pre>
      <div class="recuadro">La traducción de 1:N «absorbe» la relación en la tabla del lado N. Es correcta porque cada fila de ese lado tiene
      a lo más un valor para la clave foránea; con N:M eso no se cumple, y una fila necesitaría una lista de claves, lo que el modelo
      relacional no permite.</div>

      <h2>Conexiones</h2>
      <p>El resultado es un <a href="tema.html?id=modelo-relacional">esquema relacional</a> con claves y claves foráneas. Si el diagrama tenía
      errores (un atributo en la entidad equivocada), aparecerán como redundancia, que las
      <a href="tema.html?id=formas-normales">formas normales</a> permiten detectar.</p>`,
  });
})();
