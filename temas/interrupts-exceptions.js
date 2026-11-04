(function () {
  'use strict';
  const { color: C } = VIZ;

  const ZONAS = ['Programa', 'Núcleo', 'Hardware'];
  const EVENTOS = {
    disco: { nombre: 'Interrupción: el disco terminó una lectura', tipo: 'asíncrona', pasos: [
      [0, 'El programa ejecuta sus instrucciones con normalidad.'],
      [2, 'El controlador del disco termina y levanta la línea de interrupción.'],
      [2, 'Al terminar la instrucción en curso, la CPU guarda el contador de programa y el estado, y pasa a modo núcleo.'],
      [1, 'Consulta el vector de interrupciones y salta al manejador del disco.'],
      [1, 'El manejador copia el resultado y despierta al proceso que esperaba el bloque.'],
      [1, 'Retorno de interrupción: restaura el estado guardado.'],
      [0, 'El programa continúa justo donde estaba, sin enterarse.'] ] },
    reloj: { nombre: 'Interrupción: el temporizador vence', tipo: 'asíncrona', pasos: [
      [0, 'El programa lleva ejecutando todo su quantum.'],
      [2, 'El reloj de hardware dispara una interrupción periódica.'],
      [1, 'El núcleo guarda el contexto y llama al manejador del reloj.'],
      [1, 'El manejador actualiza la hora y descubre que el quantum se agotó.'],
      [1, 'Llama al planificador, que elige otro proceso (cambio de contexto).'],
      [0, 'Otro programa continúa; el primero espera su turno.'] ] },
    divcero: { nombre: 'Excepción: división por cero', tipo: 'síncrona', pasos: [
      [0, 'El programa ejecuta una división con divisor 0.'],
      [2, 'La CPU detecta la condición: no puede producir un resultado.'],
      [1, 'Trampa al manejador de la excepción, en modo núcleo.'],
      [1, 'El núcleo no puede corregir el error: envía la señal SIGFPE al proceso.'],
      [1, 'Sin manejador de señal, el proceso termina y se libera su memoria.'] ] },
    falla: { nombre: 'Excepción: falla de página', tipo: 'síncrona', pasos: [
      [0, 'El programa accede a una dirección cuya página no está en memoria.'],
      [2, 'La MMU no encuentra una traducción válida y avisa a la CPU.'],
      [1, 'Excepción de falla de página: el núcleo toma el control.'],
      [1, 'El núcleo verifica que el acceso es legal y busca un marco libre.'],
      [2, 'Ordena leer la página desde el disco (el proceso se bloquea).'],
      [1, 'Cuando termina la lectura, actualiza la tabla de páginas.'],
      [0, 'Se reintenta la misma instrucción y esta vez sí funciona.'] ] },
  };

  function montarFlujo(cuerpo) {
    let ev = 'disco', k = 0;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Evento', opciones: Object.entries(EVENTOS).map(([v, e]) => [v, e.nombre]), valor: ev, alCambiar: (v) => { ev = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 230 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'programa interrumpido' }, { color: C.s2, texto: 'manejador en el núcleo' }, { color: C.s3, texto: 'hardware' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Una interrupción llega en cualquier momento y el programa continúa después; una excepción la causa la propia instrucción y a veces se reintenta.');
    function iniciar() { k = 0; return (function* () { for (let j = 1; j <= EVENTOS[ev].pasos.length; j++) { k = j; yield; } })(); }
    function dibujar() {
      const e = EVENTOS[ev];
      lienzo.limpiar();
      VIZ.sor.flujo(lienzo, ZONAS, e.pasos.map(([z]) => ({ z })), k);
      registro.textContent = k ? `${k}. ${e.pasos[k - 1][1]}` : 'Pulse «Un paso» para comenzar.';
      lectura.set([['tipo', e.tipo], ['paso', `${k} de ${e.pasos.length}`], ['vuelve a la misma instrucción', ev === 'falla' ? 'sí (se reintenta)' : ev === 'divcero' ? 'no (el proceso muere)' : 'a la siguiente']]);
    }
    lienzo.alDibujar = dibujar;
    rep.reiniciar();
  }

  function montarSobrecosto(cuerpo) {
    let frec = 500, costo = 20, semilla = 1;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Interrupciones por segundo', min: 100, max: 20000, paso: 100, valor: frec, alCambiar: (v) => { frec = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Costo de cada manejador (µs)', min: 1, max: 100, valor: costo, alCambiar: (v) => { costo = v; dibujar(); } });
    ctl.boton('Nuevos instantes', () => { semilla++; dibujar(); });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 120 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'programa de usuario' }, { color: C.s2, texto: 'manejador de interrupción' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'La barra muestra 10 ms de ejecución. A tasas altas el manejador roba una fracción apreciable de la CPU (hay sistemas que agrupan interrupciones para evitarlo).');
    function dibujar() {
      const { ctx, ancho: W } = lienzo;
      lienzo.limpiar();
      const ventana = 10000, x0 = 10, ancho = W - 20; // µs
      ctx.fillStyle = C.s1; ctx.fillRect(x0, 36, ancho, 36);
      const n = Math.min(400, Math.round((frec * ventana) / 1e6));
      const rnd = VIZ.semilla(semilla);
      const tiempos = Array.from({ length: n }, () => rnd() * ventana).sort((a, b) => a - b);
      for (const t of tiempos) { ctx.fillStyle = C.s2; ctx.fillRect(x0 + (t / ventana) * ancho, 36, Math.max(1.5, (costo / ventana) * ancho), 36); }
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('0 ms', x0, 78); ctx.textAlign = 'right'; ctx.fillText('10 ms', x0 + ancho, 78);
      const sobre = Math.min(1, (frec * costo) / 1e6);
      lectura.set([['en esta ventana', `${n} interrupciones`], ['CPU en manejadores', `${VIZ.fmt(sobre * 100, 3)} %`], ['CPU útil', `${VIZ.fmt((1 - sobre) * 100, 3)} %`]]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('interrupts-exceptions', {
    intro: String.raw`
      <p>Sin interrupciones, la CPU tendría que preguntar una y otra vez si el disco ya terminó (<em>polling</em>). Con ellas, el dispositivo avisa y la CPU atiende el aviso,
      deja lo que hacía y lo retoma después. Las <strong>interrupciones</strong> vienen del exterior y son asíncronas; las <strong>excepciones</strong> las provoca la instrucción en curso
      (división por cero, falla de página) y son síncronas.</p>
      <p>Ambas usan el mismo mecanismo: guardar el estado, entrar al núcleo por un vector de manejadores y volver. Además de reaccionar a los dispositivos, son la base de la
      multitarea: la interrupción del reloj es lo que le quita la CPU a un programa que no quiere soltarla.</p>`,
    visualizaciones: [
      { titulo: 'Qué pasa cuando llega un evento', descripcion: 'Recorra cuatro eventos: dos interrupciones y dos excepciones. Compare quién genera el evento y si el programa reintenta su instrucción.', montar: montarFlujo },
      { titulo: 'Sobrecosto de las interrupciones', descripcion: 'Suba la frecuencia o el costo del manejador y observe la fracción de CPU que ya no queda para el programa.', montar: montarSobrecosto },
    ],
    teoria: String.raw`
      <h2>Tratamiento</h2>
      <pre><code>al terminar cada instrucción:
    si hay interrupción pendiente y están habilitadas:
        guardar PC y estado en la pila del núcleo
        modo ← núcleo
        PC ← vector[número_de_interrupción]
manejador:  atender el evento;  retornar con iret   # restaura PC y modo</code></pre>
      <p>Mientras se atiende una interrupción, las del mismo nivel o inferior se enmascaran para no anidarse sin control. Los manejadores deben ser <strong>cortos</strong>: la parte
      larga se difiere a una "mitad inferior" que corre después, con las interrupciones habilitadas.</p>
      <h2>Interrupción frente a excepción</h2>
      <table class="tabla-datos"><tr><th class="izq"></th><th>Interrupción</th><th>Excepción</th></tr>
      <tr><td class="izq">origen</td><td>dispositivo o reloj</td><td>instrucción en ejecución</td></tr>
      <tr><td class="izq">momento</td><td>asíncrona</td><td>síncrona</td></tr>
      <tr><td class="izq">retorno</td><td>a la instrucción siguiente</td><td>a la misma (falla) o no vuelve (aborto)</td></tr></table>
      <h2>Costo</h2>
      <p>Con tasa \(\lambda\) y costo \(c\) por manejador, la fracción de CPU consumida es \(\lambda c\) (con \(\lambda c \ll 1\)): 10 000 interrupciones por segundo de 20 µs consumen 20 %.
      Cuando la tasa sube (redes rápidas) se pasa de interrupciones a <em>polling</em> o a interrupciones agrupadas.</p>
      <p>La interrupción del reloj es la que dispara el <a href="tema.html?id=context-switch">cambio de contexto</a> en un sistema <em>apropiativo</em>; las trampas de las
      <a href="tema.html?id=system-calls">llamadas al sistema</a> usan el mismo mecanismo.</p>`,
  });
})();
