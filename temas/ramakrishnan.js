(function () {
  'use strict';
  const { color: C, bdd: B } = VIZ;

  const EMP = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena'];
  const DEP = ['Ventas', 'TI', 'Finanzas', 'Legal'];

  function sqlDe(r) {
    const { llaveD, totalD, llaveE, totalE } = r;
    if (llaveD) {
      // Cada departamento tiene a lo más un director: la relación se absorbe en Departamento.
      return [
        'CREATE TABLE Empleado (rut CHAR(12) PRIMARY KEY, nombre TEXT);',
        '',
        'CREATE TABLE Dep_Dirige (            -- Departamento absorbe la relación',
        '  did    INT PRIMARY KEY,',
        '  nombre TEXT,',
        `  rut    CHAR(12)${totalD ? ' NOT NULL' : ''}${llaveE ? ' UNIQUE' : ''} REFERENCES Empleado,`,
        '  desde  DATE',
        ');',
        ...(totalE ? ['', '-- Participación total de Empleado: no se expresa con claves;', '-- requiere una aserción o un trigger.'] : []),
        ...(!totalD ? ['', '-- Sin NOT NULL: un departamento puede no tener director.'] : []),
      ].join('\n');
    }
    return [
      'CREATE TABLE Empleado (rut CHAR(12) PRIMARY KEY, nombre TEXT);',
      'CREATE TABLE Departamento (did INT PRIMARY KEY, nombre TEXT);',
      '',
      'CREATE TABLE Dirige (',
      '  rut   CHAR(12) REFERENCES Empleado,',
      '  did   INT      REFERENCES Departamento,',
      '  desde DATE,',
      `  PRIMARY KEY (${llaveE ? 'rut' : 'rut, did'})${llaveE ? '              -- cada empleado dirige a lo más uno' : ''}`,
      ');',
      ...(totalD || totalE ? ['', '-- Participación total sin restricción de llave: requiere una aserción', '-- (CHECK sobre otra tabla) o un trigger; las claves no bastan.'] : []),
    ].join('\n');
  }

  function montarNotacion(cuerpo) {
    const r = { llaveD: true, totalD: true, llaveE: false, totalE: false };
    let enlaces = new Set(['0-0', '2-1', '3-2']), elegido = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.casillas([
      { clave: 'llaveD', texto: 'llave: Departamento → a lo más un director', activo: r.llaveD },
      { clave: 'totalD', texto: 'total: todo Departamento tiene director', activo: r.totalD },
      { clave: 'llaveE', texto: 'llave: Empleado dirige a lo más uno', activo: r.llaveE },
      { clave: 'totalE', texto: 'total: todo Empleado dirige alguno', activo: r.totalE },
    ], (e) => { Object.assign(r, e); dibujar(); });
    ctl.boton('Ejemplo', () => { enlaces = new Set(['0-0', '2-1', '3-2']); elegido = null; dibujar(); }, { primario: true });
    ctl.boton('Vaciar pares', () => { enlaces.clear(); elegido = null; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 520 ? 400 : 330) });
    lienzo.canvas.style.cursor = 'pointer';
    VIZ.leyenda(cuerpo, [
      { color: C.tinta, texto: 'par (empleado, departamento)', forma: 'linea' },
      { color: C.s8, texto: 'viola la restricción de llave', forma: 'linea' },
      { color: C.s4, texto: 'entidad que viola la participación total', forma: 'punto' },
      { color: C.s1, texto: 'empleado elegido', forma: 'punto' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const codigo = VIZ.el('pre', { class: 'codigo-bdd' });
    cuerpo.appendChild(codigo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Marque las restricciones y vea cómo cambia el diagrama. En la instancia de abajo, haga clic en un empleado y luego en un departamento para agregar o quitar un par.');

    // Línea entre entidad y rombo según la notación: flecha = llave, gruesa = total.
    function lado(ctx, x1, x2, y, llave, total) {
      const dir = Math.sign(x1 - x2);
      ctx.strokeStyle = C.tinta; ctx.lineWidth = total ? 4.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x1 - dir * (llave ? 6 : 0), y); ctx.stroke();
      if (llave) {
        ctx.fillStyle = C.tinta;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - dir * 12, y - 7); ctx.lineTo(x1 - dir * 12, y + 7); ctx.closePath(); ctx.fill();
      }
    }

    let geo = null;
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const angosto = W < 520;
      const ew = angosto ? 96 : 120, eh = 32, y0 = 34;
      const xe = 10, xd = W - 10 - ew, xr = W / 2;
      // Diagrama: Empleado —— <dirige> —— Departamento, con la flecha apuntando AL rombo.
      lado(ctx, xr - 44, xe + ew, y0, r.llaveE, r.totalE);
      lado(ctx, xr + 44, xd, y0, r.llaveD, r.totalD);
      ctx.fillStyle = C.superficie; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xr, y0 - 20); ctx.lineTo(xr + 44, y0); ctx.lineTo(xr, y0 + 20); ctx.lineTo(xr - 44, y0); ctx.closePath(); ctx.fill(); ctx.stroke();
      B.texto(ctx, 'dirige', xr, y0, { alinear: 'center', color: C.tinta, px: 12, peso: 500 });
      B.caja(ctx, xe, y0 - eh / 2, ew, eh, 'Empleado', { px: angosto ? 11 : 12 });
      B.caja(ctx, xd, y0 - eh / 2, ew, eh, 'Departamento', { px: angosto ? 11 : 12 });

      // Instancia.
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, y0 + 40.5); ctx.lineTo(W - 10, y0 + 40.5); ctx.stroke();
      B.texto(ctx, 'instancia', 10, y0 + 52, { color: C.apagado, px: 10 });
      const top = y0 + 70, bot = H - 18;
      const xp = Math.max(80, W * 0.26), xc = Math.min(W - 90, W * 0.7);
      const yp = (i) => top + (i * (bot - top)) / (EMP.length - 1), yc = (i) => top + 6 + (i * (bot - top - 12)) / (DEP.length - 1);
      geo = { xp, xc, yp, yc };
      const porE = new Map(), porD = new Map();
      for (const e of enlaces) {
        const [a, b] = e.split('-').map(Number);
        porE.set(a, (porE.get(a) || 0) + 1);
        porD.set(b, (porD.get(b) || 0) + 1);
      }
      let malLlave = 0;
      for (const e of enlaces) {
        const [a, b] = e.split('-').map(Number);
        const mal = (r.llaveD && porD.get(b) > 1) || (r.llaveE && porE.get(a) > 1);
        if (mal) malLlave++;
        ctx.strokeStyle = mal ? C.s8 : C.tinta; ctx.lineWidth = mal ? 3 : 1.5;
        ctx.beginPath(); ctx.moveTo(xp + 8, yp(a)); ctx.lineTo(xc - 8, yc(b)); ctx.stroke();
      }
      let malTotal = 0;
      EMP.forEach((t, i) => {
        const falta = r.totalE && !porE.get(i);
        if (falta) malTotal++;
        VIZ.marcador(ctx, xp, yp(i), elegido === i ? C.s1 : falta ? C.s4 : C.tinta, elegido === i || falta ? 7 : 5.5);
        B.texto(ctx, t, xp - 14, yp(i), { alinear: 'right', px: 12, color: C.tinta });
      });
      DEP.forEach((t, i) => {
        const falta = r.totalD && !porD.get(i);
        if (falta) malTotal++;
        VIZ.marcador(ctx, xc, yc(i), falta ? C.s4 : C.tinta, falta ? 7 : 5.5);
        B.texto(ctx, t, xc + 14, yc(i), { px: 12, color: C.tinta });
      });
      const sim = [];
      if (r.llaveD && r.totalD) sim.push('Departamento: flecha gruesa = exactamente un director');
      else if (r.llaveD) sim.push('Departamento: flecha = a lo más un director');
      else if (r.totalD) sim.push('Departamento: línea gruesa = al menos un director');
      if (r.llaveE && r.totalE) sim.push('Empleado: flecha gruesa = dirige exactamente uno');
      else if (r.llaveE) sim.push('Empleado: flecha = dirige a lo más uno');
      else if (r.totalE) sim.push('Empleado: línea gruesa = dirige al menos uno');
      registro.textContent = (sim.length ? sim.join('\n') : 'Sin restricciones: líneas delgadas, la relación es N:M y la participación es parcial.') +
        `\n${malLlave || malTotal ? `La instancia viola ${malLlave ? `la llave (${malLlave} ${malLlave === 1 ? 'par' : 'pares'})` : ''}${malLlave && malTotal ? ' y ' : ''}${malTotal ? `la participación (${malTotal} ${malTotal === 1 ? 'entidad' : 'entidades'})` : ''}.` : 'La instancia cumple todas las restricciones.'}`;
      codigo.textContent = sqlDe(r);
      lectura.set([
        ['pares', String(enlaces.size)],
        ['violaciones de llave', String(malLlave)],
        ['violaciones de participación', String(malTotal)],
        ['tablas', r.llaveD ? '2' : '3'],
      ]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('click', (ev) => {
      if (!geo) return;
      const { x, y } = lienzo.posicion(ev);
      const ie = EMP.findIndex((_, i) => Math.abs(y - geo.yp(i)) < 12 && x > geo.xp - 80 && x < geo.xp + 14);
      const id = DEP.findIndex((_, i) => Math.abs(y - geo.yc(i)) < 12 && x > geo.xc - 14 && x < geo.xc + 90);
      if (ie >= 0) elegido = elegido === ie ? null : ie;
      else if (id >= 0 && elegido != null) {
        const e = `${elegido}-${id}`;
        if (enlaces.has(e)) enlaces.delete(e); else enlaces.add(e);
      }
      dibujar();
    });
    dibujar();
  }

  VIZ.registrarTema('ramakrishnan', {
    intro: String.raw`
      <p>El libro <em>Database Management Systems</em> de Raghu Ramakrishnan y Johannes Gehrke usa una notación E/R propia, muy usada en
      cursos universitarios. En vez de escribir 1, N o M junto a las líneas, marca las restricciones en la <strong>forma de la línea</strong>
      que une una entidad con una relación.</p>
      <p>Hay solo dos marcas y se combinan: una <strong>flecha</strong> hacia el rombo es una <em>restricción de llave</em> («a lo más
      uno») y una <strong>línea gruesa</strong> es una <em>participación total</em> («al menos uno»). Una flecha gruesa significa
      «exactamente uno».</p>`,
    visualizaciones: [
      {
        titulo: 'Flechas, líneas gruesas e instancias',
        descripcion: 'El ejemplo clásico del libro: Empleado dirige Departamento. Active y desactive las restricciones y vea el diagrama, las violaciones en la instancia y la traducción a SQL.',
        montar: montarNotacion,
      },
    ],
    teoria: String.raw`
      <h2>Las cuatro combinaciones</h2>
      <table>
        <tr><th>Línea de E al rombo R</th><th>Significado para cada e ∈ E</th><th>Cardinalidad (mín, máx)</th></tr>
        <tr><td>delgada</td><td>participa en cualquier número de pares, incluso ninguno</td><td>(0, N)</td></tr>
        <tr><td>flecha delgada</td><td>a lo más un par: <em>restricción de llave</em></td><td>(0, 1)</td></tr>
        <tr><td>gruesa</td><td>al menos un par: <em>participación total</em></td><td>(1, N)</td></tr>
        <tr><td>flecha gruesa</td><td>exactamente un par</td><td>(1, 1)</td></tr>
      </table>
      <div class="recuadro">Atención con la dirección de lectura. La flecha sale de Departamento: «cada departamento tiene a lo más un
      director». En la notación de Chen eso se escribe con un 1 junto a <em>Empleado</em>, al otro lado del rombo. La causa de muchas
      confusiones es justamente esa: Chen anota en el extremo opuesto.</div>

      <h2>Traducción a tablas</h2>
      <p>Una restricción de llave sobre \(E\) en \(R\) significa que la clave de \(E\) es clave de \(R\). Por eso la relación se puede
      <strong>absorber</strong> en la tabla de \(E\): se agrega a \(E\) la clave foránea de la otra entidad y los atributos de \(R\).</p>
      <ul>
        <li>Llave + participación total en \(E\): la clave foránea absorbida lleva <code>NOT NULL</code>.</li>
        <li>Participación total sin llave: <em>no</em> se puede expresar con claves; hace falta una aserción o un trigger.</li>
        <li>Llave en ambos lados (1:1): la clave foránea absorbida lleva además <code>UNIQUE</code>.</li>
      </ul>

      <h2>Otras construcciones de la notación</h2>
      <h3>Entidad débil</h3>
      <p>Se dibuja con un rectángulo de borde grueso y una relación identificadora también gruesa, con flecha gruesa: cada sección pertenece
      a exactamente un curso. Su clave es parcial (número de sección) y se completa con la clave del dueño; en SQL, la clave primaria es
      <code>(sigla, numero)</code> y la clave foránea usa <code>ON DELETE CASCADE</code>.</p>
      <h3>Jerarquías ISA</h3>
      <p>Un triángulo «ISA» bajo la entidad padre. Se declaran dos propiedades: <em>superposición</em> (¿puede una entidad pertenecer a dos
      subclases?) y <em>cobertura</em> (¿toda entidad del padre pertenece a alguna subclase?). Se traducen con una tabla por clase o con una
      tabla por subclase, como las estrategias de herencia de un <a href="tema.html?id=orm">ORM</a>.</p>
      <h3>Agregación</h3>
      <p>Un rectángulo punteado alrededor de una relación permite tratarla como entidad y relacionarla con otra («un empleado supervisa el
      patrocinio de un proyecto por un departamento»).</p>

      <h2>Conexiones</h2>
      <p>Es la misma información que la cardinalidad del <a href="tema.html?id=diagrama-er">diagrama E/R</a>, dibujada de otro modo. Las
      restricciones que no caben en claves se implementan con <a href="tema.html?id=logica-bdd">triggers</a>.</p>`,
  });
})();
