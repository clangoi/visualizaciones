(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: grafo de commits, ramas y fusiones ---------- */

  function montarGit(cuerpo) {
    let commits, ramas, actual, contador, nota;
    const reiniciar = () => {
      commits = [{ id: 'c0', padres: [], rama: 'main', msg: 'inicio' }]; ramas = { main: 'c0' }; actual = 'main'; contador = 1; nota = 'Repositorio nuevo con un commit en main.'; dibujar();
    };
    const lista = () => Object.keys(ramas);
    const ctl = VIZ.controles(cuerpo);
    const sel = ctl.selector({ etiqueta: 'Rama actual (HEAD)', valor: 'main', opciones: [['main', 'main']], alCambiar: (v) => { actual = v; nota = `git switch ${v}: HEAD ahora apunta a ${v}.`; dibujar(); } });
    ctl.boton('git commit', () => commit(), { primario: true });
    ctl.boton('git switch -c feature', () => crearRama());
    ctl.boton('git merge feature → main', () => fusionar());
    ctl.boton('Reiniciar', () => reiniciar());
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: () => 210 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'rama main' }, { color: C.s2, texto: 'rama feature' }, { color: C.s7, texto: 'commit de fusión (dos padres)' }, { color: C.tinta, texto: 'HEAD (rama actual)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Haga commits en <code>main</code>, cree <code>feature</code>, haga commits en ambas y fusione: si las dos divergieron, Git crea un commit con dos padres.');
    function commit() { const id = `c${contador++}`; commits.push({ id, padres: [ramas[actual]], rama: actual, msg: `cambio ${id}` }); ramas[actual] = id; nota = `git commit: nuevo commit ${id} en ${actual}; la rama avanza.`; dibujar(); }
    function crearRama() { if (ramas.feature) { nota = 'La rama «feature» ya existe: use el selector para cambiar a ella.'; dibujar(); return; } ramas.feature = ramas[actual]; actual = 'feature'; nota = `git switch -c feature: nueva rama apuntando al mismo commit (${ramas.feature}); no se copió nada.`; dibujar(); }
    const ancestros = (id, s = new Set()) => { s.add(id); commits.find((c) => c.id === id).padres.forEach((p) => ancestros(p, s)); return s; };
    function fusionar() {
      if (!ramas.feature) { nota = 'Primero cree la rama feature.'; return dibujar(); }
      if (actual !== 'main') { nota = 'Para fusionar feature en main, cambie primero a main.'; return dibujar(); }
      if (ancestros(ramas.main).has(ramas.feature)) { nota = 'Nada que fusionar: main ya contiene todo lo de feature.'; return dibujar(); }
      if (ancestros(ramas.feature).has(ramas.main)) { ramas.main = ramas.feature; nota = 'Avance rápido (fast-forward): main solo movió su puntero; no se creó un commit.'; return dibujar(); }
      const id = `c${contador++}`; commits.push({ id, padres: [ramas.main, ramas.feature], rama: 'main', msg: 'merge feature', fusion: true }); ramas.main = id; nota = `git merge: las ramas habían divergido, así que se crea el commit de fusión ${id} con dos padres.`; dibujar();
    }
    let pos = [];
    function dibujar() {
      sel.select.replaceChildren(...lista().map((r) => { const o = document.createElement('option'); o.value = r; o.textContent = r; return o; })); sel.valor = actual;
      const { ctx, ancho: Wd } = lienzo;
      lienzo.limpiar();
      const carril = { main: 50, feature: 130 }, paso = Math.min(70, (Wd - 80) / Math.max(commits.length, 5));
      pos = commits.map((c, i) => ({ c, x: 40 + i * paso, y: carril[c.rama] || 50 }));
      pos.forEach((p) => p.c.padres.forEach((id) => { const q = pos.find((r) => r.c.id === id); ctx.strokeStyle = C.eje; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }));
      pos.forEach((p) => { ctx.fillStyle = p.c.fusion ? C.s7 : p.c.rama === 'main' ? C.s1 : C.s2; ctx.strokeStyle = C.superficie; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fill(); ctx.stroke(); W.texto(ctx, p.c.id, p.x, p.y, { tam: 9, color: C.sobre, peso: 600 }); });
      Object.entries(ramas).forEach(([nom, id], k) => { const p = pos.find((q) => q.c.id === id); W.caja(ctx, p.x - 28, p.y + (nom === 'feature' || p.y > 90 ? 16 : -40) + (k && p.c.id === ramas.main && nom !== 'main' ? 24 : 0), 56, 20, nom + (nom === actual ? ' ← HEAD' : ''), { borde: nom === actual ? C.tinta : C.eje, tam: 9, peso: nom === actual ? 700 : 400, relleno: nom === actual ? VIZ.alfa(C.tinta, 0.08) : C.superficie }); });
      registro.textContent = nota;
      lectura.set([['commits', String(commits.length)], ['ramas', lista().join(', ')], ['HEAD', actual], ['commits de fusión', String(commits.filter((c) => c.fusion).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const p = pos.find((q) => Math.hypot(q.x - x, q.y - y) < 12); if (!p) return tip.ocultar(); tip.mostrar(x, y, `<b>${p.c.id}</b> · ${p.c.msg}<br>padres: ${p.c.padres.join(', ') || 'ninguno'}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    reiniciar();
  }

  /* ---------- Fig. 2: pull request y revisión de código ---------- */

  function montarRevision(cuerpo) {
    const est = { ci: true, cambios: true };
    VIZ.web.figuraSecuencia(cuerpo, {
      actores: [{ nombre: 'Autora' }, { nombre: 'Repositorio' }, { nombre: 'CI' }, { nombre: 'Revisor' }],
      mensajes: () => {
        const m = [
          { de: 0, a: 1, texto: 'git push (rama feature)', color: C.s1, nota: 'La autora sube su rama; main no se toca.' },
          { de: 0, a: 1, texto: 'abrir Pull Request', color: C.s1, nota: 'El PR propone fusionar la rama en main y abre la conversación.' },
          { de: 1, a: 2, texto: 'ejecutar pruebas', color: C.s3, nota: 'Cada push dispara la integración continua: pruebas, linter, análisis.' },
        ];
        if (!est.ci) {
          m.push({ de: 2, a: 1, texto: '✕ pruebas fallan', color: C.s8, nota: 'El CI marca el PR en rojo: no se puede fusionar hasta corregir.' });
          m.push({ de: 0, a: 1, texto: 'push con la corrección', color: C.s1, nota: 'La autora arregla el fallo y vuelve a subir.' });
          m.push({ de: 1, a: 2, texto: 'ejecutar pruebas', color: C.s3, nota: 'El CI corre otra vez.' });
        }
        m.push({ de: 2, a: 1, texto: '✓ pruebas pasan', color: C.s6, nota: 'El CI aprueba: lo mecánico está verificado.' });
        m.push({ de: 1, a: 3, texto: 'solicitar revisión', color: C.s2, nota: 'Una persona revisa lo que las máquinas no ven: claridad, diseño, casos que faltan.' });
        if (est.cambios) {
          m.push({ de: 3, a: 0, texto: 'comentarios: cambios pedidos', color: C.s4, nota: 'El revisor señala un caso sin probar y un nombre confuso.' });
          m.push({ de: 0, a: 1, texto: 'push con ajustes', color: C.s1, nota: 'La autora responde a cada comentario con commits nuevos.' });
          m.push({ de: 1, a: 2, texto: 'ejecutar pruebas', color: C.s3, nota: 'El CI vuelve a validar los ajustes.' });
        }
        m.push({ de: 3, a: 1, texto: 'aprobar', color: C.s6, nota: 'El revisor aprueba.' });
        m.push({ de: 1, a: 1, texto: 'merge a main + borrar rama', color: C.s7, nota: 'Se fusiona (a menudo con squash) y la rama de trabajo se elimina.' });
        return m;
      },
      controles(ctl, reiniciar) {
        ctl.casillas([{ clave: 'ci', texto: 'las pruebas pasan a la primera', activo: true }, { clave: 'cambios', texto: 'el revisor pide cambios', activo: true }], (e) => { Object.assign(est, e); reiniciar(); });
      },
      leyenda: [{ color: C.s1, texto: 'acciones de la autora' }, { color: C.s3, texto: 'automatización' }, { color: C.s2, texto: 'revisión humana' }, { color: C.s6, texto: 'aprobado' }, { color: C.s8, texto: 'fallo' }, { color: C.s7, texto: 'fusión' }],
      lectura: (hasta, msgs) => [['paso', `${Math.max(0, hasta + 1)} de ${msgs.length}`], ['rondas de CI', String(msgs.filter((x) => x.texto === 'ejecutar pruebas').length)], ['rondas de revisión', est.cambios ? '2' : '1']],
      nota: 'La revisión de código y la integración continua se complementan: el CI revisa lo que es mecánico para que las personas se concentren en el diseño.',
    });
  }

  VIZ.registrarTema('git-code-review', {
    intro: String.raw`
      <p>El <strong>control de versiones</strong> guarda la historia completa de un proyecto como una cadena de <em>commits</em>: instantáneas con autor, fecha y mensaje. Permite volver atrás, ver quién cambió qué y,
      sobre todo, que varias personas trabajen a la vez en <strong>ramas</strong> separadas que luego se <strong>fusionan</strong>.</p>
      <p>Para que lo que entra a la rama principal sea bueno, los equipos añaden una <strong>revisión de código</strong>: otra persona lee el cambio (en un <em>pull request</em>) antes de aprobarlo.</p>`,
    visualizaciones: [
      { titulo: 'Commits, ramas y fusiones', descripcion: 'Haga commits, cree <code>feature</code> y fusione. Compare lo que ocurre cuando main no avanzó (avance rápido) y cuando las ramas divergieron (commit de fusión).', montar: montarGit },
      { titulo: 'Pull request y revisión', descripcion: 'Recorra el ciclo de un PR; haga fallar el CI o pida cambios en la revisión y vea cuántas rondas se agregan.', montar: montarRevision },
    ],
    teoria: String.raw`
      <h2>El grafo de commits</h2>
      <p>La historia es un <em>grafo acíclico dirigido</em>: cada commit apunta a su(s) padre(s). Una <strong>rama</strong> es solo un puntero a un commit, por lo que crearla cuesta \(O(1)\) y no copia archivos. <code>HEAD</code> indica la rama activa.</p>
      <pre><code>git switch -c feature      # crear y cambiar a la rama
git commit -m "agrega filtro"
git switch main
git merge feature          # avance rápido o commit de fusión</code></pre>
      <h2>Fusiones</h2>
      <ul>
        <li><strong>Avance rápido</strong>: si <code>main</code> es ancestro de <code>feature</code>, basta mover el puntero.</li>
        <li><strong>Fusión de tres vías</strong>: si divergieron, Git combina los cambios a partir del ancestro común; si ambas ramas tocaron las mismas líneas hay un <em>conflicto</em> que alguien debe resolver.</li>
        <li><strong>Rebase</strong>: reaplica los commits de la rama sobre la punta de main para una historia lineal.</li>
      </ul>
      <h2>Buenas prácticas colaborativas</h2>
      <ul>
        <li>Commits pequeños y atómicos, con mensajes que expliquen el <em>porqué</em>.</li>
        <li>Ramas cortas: mientras más tiempo vive una rama, más probable es el conflicto.</li>
        <li>Pull requests pequeños (idealmente &lt; 400 líneas): la calidad de la revisión cae con el tamaño.</li>
        <li>El revisor mira corrección, claridad, pruebas, seguridad y mantenibilidad; los estilos los automatiza un <em>linter</em>.</li>
      </ul>
      <div class="recuadro">El flujo completo (ramas, PR, pruebas automáticas, despliegue) es la base de la <a href="tema.html?id=devops-ci-cd">entrega continua</a>. Qué verifican esas pruebas: <a href="tema.html?id=test-pyramid">pirámide de pruebas</a>.</div>`,
  });
})();
