(function () {
  'use strict';
  const { color: C } = VIZ;
  const W = VIZ.web;

  /* ---------- Fig. 1: atributos de calidad y perfil del proyecto ---------- */

  const ATRIBUTOS = ['Funcionalidad', 'Rendimiento', 'Seguridad', 'Usabilidad', 'Mantenibilidad', 'Fiabilidad', 'Portabilidad', 'Compatibilidad'];
  const PERFILES = {
    banca: { t: 'Banca en línea', v: [5, 3, 5, 4, 3, 5, 2, 3] },
    juego: { t: 'Juego móvil', v: [4, 5, 2, 5, 2, 3, 4, 3] },
    blog: { t: 'Blog personal', v: [3, 2, 2, 4, 4, 2, 3, 2] },
    salud: { t: 'Sistema médico', v: [5, 3, 5, 3, 4, 5, 2, 4] },
  };
  const PRESUPUESTO = 24;

  function montarRadar(cuerpo) {
    let perfil = 'banca';
    const esfuerzo = [3, 3, 3, 3, 3, 3, 3, 3];
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Tipo de proyecto', valor: perfil, opciones: Object.entries(PERFILES).map(([k, p]) => [k, p.t]), alCambiar: (v) => { perfil = v; dibujar(); } });
    const sl = ATRIBUTOS.map((a, i) => ctl.rango({ etiqueta: a, min: 0, max: 5, valor: esfuerzo[i], alCambiar: (v) => { esfuerzo[i] = v; dibujar(); } }));
    ctl.boton('Ajustar al perfil', () => { PERFILES[perfil].v.forEach((v, i) => { esfuerzo[i] = v; sl[i].valor = v; }); dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => Math.round(Math.min(340, Math.max(260, w * 0.55))) });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'esfuerzo que usted asigna' }, { color: C.s2, texto: 'importancia que pide el proyecto', forma: 'linea' }, { color: C.s8, texto: 'atributo con déficit' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, `Tiene un presupuesto de ${PRESUPUESTO} puntos de esfuerzo para repartir entre los ocho atributos. Dar más a uno quita a otro: la calidad es una cuestión de compromisos.`);
    let geo = null;
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const cx = Wd / 2, cy = H / 2 + 6, R = Math.min(Wd / 2 - 70, H / 2 - 34), n = ATRIBUTOS.length, ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const pt = (i, v) => [cx + R * (v / 5) * Math.cos(ang(i)), cy + R * (v / 5) * Math.sin(ang(i))];
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
      for (let r = 1; r <= 5; r++) { ctx.beginPath(); ATRIBUTOS.forEach((_, i) => { const [x, y] = pt(i, r); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
      ATRIBUTOS.forEach((a, i) => { const [x, y] = pt(i, 5); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); W.texto(ctx, a, cx + (R + 12) * Math.cos(ang(i)), cy + (R + 12) * Math.sin(ang(i)), { tam: Wd < 500 ? 9 : 11, alinear: Math.cos(ang(i)) > 0.3 ? 'left' : Math.cos(ang(i)) < -0.3 ? 'right' : 'center', base: Math.sin(ang(i)) > 0.5 ? 'top' : Math.sin(ang(i)) < -0.5 ? 'bottom' : 'middle', color: C.tinta2 }); });
      const ideal = PERFILES[perfil].v;
      ctx.beginPath(); ideal.forEach((v, i) => { const [x, y] = pt(i, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.strokeStyle = C.s2; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); esfuerzo.forEach((v, i) => { const [x, y] = pt(i, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.fillStyle = VIZ.alfa(C.s1, 0.2); ctx.fill(); ctx.strokeStyle = C.s1; ctx.lineWidth = 2.5; ctx.stroke();
      esfuerzo.forEach((v, i) => { const [x, y] = pt(i, v); VIZ.marcador(ctx, x, y, esfuerzo[i] < ideal[i] ? C.s8 : C.s1, 4); });
      geo = { cx, cy, R, n, ang };
      const usado = esfuerzo.reduce((a, b) => a + b, 0), cubierto = ideal.reduce((s, v, i) => s + Math.min(v, esfuerzo[i]), 0) / ideal.reduce((a, b) => a + b, 0);
      const peor = ATRIBUTOS.map((a, i) => [a, ideal[i] - esfuerzo[i]]).sort((x, y) => y[1] - x[1])[0];
      registro.textContent = usado > PRESUPUESTO ? `Se pasó del presupuesto por ${usado - PRESUPUESTO} puntos: no puede dar todo.` : peor[1] > 0 ? `El mayor déficit para «${PERFILES[perfil].t}» está en ${peor[0]}: pide ${ideal[ATRIBUTOS.indexOf(peor[0])]} y recibe ${esfuerzo[ATRIBUTOS.indexOf(peor[0])]}.` : 'Todos los atributos alcanzan lo que pide el proyecto.';
      lectura.set([['esfuerzo usado', `${usado} de ${PRESUPUESTO}`], ['necesidad cubierta', `${Math.round(cubierto * 100)} %`], ['atributos con déficit', String(ideal.filter((v, i) => esfuerzo[i] < v).length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev); if (!geo) return;
      const a = Math.atan2(y - geo.cy, x - geo.cx), i = Math.round(((a + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / geo.n)) % geo.n;
      if (Math.hypot(x - geo.cx, y - geo.cy) > geo.R + 30) return tip.ocultar();
      tip.mostrar(x, y, `<b>${ATRIBUTOS[i]}</b><br>esfuerzo ${esfuerzo[i]} · pide ${PERFILES[perfil].v[i]}`);
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  /* ---------- Fig. 2: costo de corregir un defecto según cuándo se halla ---------- */

  const FASES = [{ n: 'Requisitos', costo: 1 }, { n: 'Diseño', costo: 3 }, { n: 'Código', costo: 6 }, { n: 'Pruebas', costo: 15 }, { n: 'Producción', costo: 80 }];
  const ESTRATEGIAS = { tardia: { t: 'pruebas solo al final', d: [0.03, 0.07, 0.1, 0.5, 0.3] }, temprana: { t: 'revisiones y pruebas desde el inicio', d: [0.2, 0.25, 0.3, 0.2, 0.05] } };

  function montarCosto(cuerpo) {
    const est = { defectos: 100, estrategia: 'tardia' };
    let barras = [];
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Defectos introducidos', min: 20, max: 300, paso: 10, valor: est.defectos, alCambiar: (v) => { est.defectos = v; dibujar(); } });
    ctl.selector({ etiqueta: 'Estrategia de verificación', valor: est.estrategia, opciones: Object.entries(ESTRATEGIAS).map(([k, e]) => [k, e.t]), alCambiar: (v) => { est.estrategia = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.45, altoMin: 240, altoMax: 340 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'defectos hallados en esta fase' }, { color: C.s2, texto: 'costo de corregirlos (unidades relativas)' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Corregir un defecto cuesta más cuanto más tarde se descubre. Compare cuánto se paga en total con cada estrategia: lo que cambia es <em>cuándo</em> se encuentran los defectos.');
    const costoTotal = (k) => FASES.reduce((s, f, i) => s + est.defectos * ESTRATEGIAS[k].d[i] * f.costo, 0);
    function dibujar() {
      const { ctx, ancho: Wd, alto: H } = lienzo;
      lienzo.limpiar();
      const d = ESTRATEGIAS[est.estrategia].d, costos = FASES.map((f, i) => est.defectos * d[i] * f.costo), max = Math.max(...costos, est.defectos * 0.5) * 1.1;
      const izq = 40, inf = 34, w = (Wd - izq - 10) / FASES.length;
      barras = [];
      FASES.forEach((f, i) => {
        const x = izq + i * w, h1 = ((est.defectos * d[i]) / (est.defectos * 0.5)) * (H - inf - 20) * 0.5, h2 = (costos[i] / max) * (H - inf - 20);
        ctx.fillStyle = C.s1; ctx.beginPath(); ctx.roundRect(x + 4, H - inf - h1, w / 2 - 6, h1, [4, 4, 0, 0]); ctx.fill();
        ctx.fillStyle = C.s2; ctx.beginPath(); ctx.roundRect(x + w / 2, H - inf - h2, w / 2 - 6, h2, [4, 4, 0, 0]); ctx.fill();
        W.texto(ctx, f.n, x + w / 2, H - inf + 14, { tam: Wd < 500 ? 9 : 11, color: C.tinta2 });
        W.texto(ctx, `×${f.costo}`, x + w / 2, H - inf + 27, { tam: 10, color: C.apagado });
        barras.push({ x, w, f, n: est.defectos * d[i], c: costos[i] });
      });
      ctx.strokeStyle = C.eje; ctx.beginPath(); ctx.moveTo(izq, H - inf + 0.5); ctx.lineTo(Wd - 10, H - inf + 0.5); ctx.stroke();
      const a = costoTotal('tardia'), b = costoTotal('temprana'), actual = costoTotal(est.estrategia);
      registro.textContent = `Con «${ESTRATEGIAS[est.estrategia].t}», corregir los ${est.defectos} defectos cuesta ${VIZ.entero(actual)} unidades. ${est.estrategia === 'tardia' ? `Detectarlos antes lo bajaría a ${VIZ.entero(b)}.` : `Dejar las pruebas para el final lo subiría a ${VIZ.entero(a)}.`}`;
      lectura.set([['costo total', VIZ.entero(actual)], ['cuestan las pruebas tardías', VIZ.entero(a)], ['cuestan las tempranas', VIZ.entero(b)], ['defectos que llegan a producción', String(Math.round(est.defectos * d[4]))]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => { const { x, y } = lienzo.posicion(ev); const b = barras.find((q) => x >= q.x && x <= q.x + q.w); if (!b) return tip.ocultar(); tip.mostrar(x, y, `<b>${b.f.n}</b><br>${VIZ.fmt(b.n, 3)} defectos<br>costo unitario ×${b.f.costo}<br>costo total ${VIZ.entero(b.c)}`); });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('software-quality', {
    intro: String.raw`
      <p>Un programa de calidad no es solo uno «sin errores»: es uno que hace lo que se necesita (<strong>requisitos funcionales</strong>) y lo hace <em>bien</em> —rápido, seguro, usable, mantenible— (<strong>requisitos no funcionales</strong>, o atributos de calidad).</p>
      <p>El <strong>aseguramiento de calidad</strong> (QA) es el conjunto de prácticas para lograrlo durante todo el desarrollo, no solo al final. Su idea central: cuanto antes se detecta un problema, más barato es corregirlo.</p>`,
    visualizaciones: [
      { titulo: 'Atributos de calidad y compromisos', descripcion: 'Elija un tipo de proyecto, reparta su presupuesto de esfuerzo entre ocho atributos y compare con lo que ese proyecto realmente necesita.', montar: montarRadar },
      { titulo: 'El costo de hallar un defecto tarde', descripcion: 'Compare dos estrategias de verificación y vea cuánto se paga en total y cuántos defectos llegan a producción.', montar: montarCosto },
    ],
    teoria: String.raw`
      <h2>Requisitos funcionales y no funcionales</h2>
      <table>
        <tr><th>Tipo</th><th>Pregunta</th><th>Ejemplo</th></tr>
        <tr><td>Funcional</td><td>¿qué hace el sistema?</td><td>«el usuario puede pagar con tarjeta»</td></tr>
        <tr><td>No funcional</td><td>¿qué tan bien lo hace?</td><td>«el pago responde en menos de 2 s, con 99,9 % de disponibilidad»</td></tr>
      </table>
      <p>Los atributos de calidad del modelo ISO/IEC 25010 incluyen adecuación funcional, eficiencia de desempeño, compatibilidad, usabilidad, fiabilidad, seguridad, mantenibilidad y portabilidad. Para ser verificables deben ser <strong>medibles</strong>: «rápido» no es un requisito, «p95 &lt; 300 ms» sí.</p>
      <h2>Verificación y validación</h2>
      <ul>
        <li><strong>Verificación</strong>: «¿construimos el producto <em>correctamente</em>?», comprobar que cumple la especificación (revisiones, pruebas unitarias).</li>
        <li><strong>Validación</strong>: «¿construimos el producto <em>correcto</em>?», comprobar que satisface la necesidad real (pruebas de aceptación con usuarios).</li>
      </ul>
      <h2>Costo de los defectos</h2>
      <p>Si \(d_i\) defectos se hallan en la fase \(i\) y corregirlos cuesta \(c_i\) (que crece de forma aproximadamente exponencial: requisitos \(\ll\) producción), el costo total es</p>
      \[ C = \sum_i d_i\, c_i . \]
      <p>Desplazar defectos hacia las fases tempranas («<em>shift left</em>») reduce \(C\) aunque el número de defectos sea el mismo. Las cifras de la figura son ilustrativas; lo que importa es la forma de la curva.</p>
      <div class="recuadro">Las herramientas para verificar son las <a href="tema.html?id=test-pyramid">pruebas automáticas</a> y la <a href="tema.html?id=git-code-review">revisión de código</a>; la mantenibilidad depende además del control de versiones y de escribir <a href="tema.html?id=tdd-cycle">código guiado por pruebas</a>.</div>`,
  });
})();
