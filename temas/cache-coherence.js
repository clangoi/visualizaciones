(function () {
  'use strict';
  const { color: C } = VIZ;
  const D = VIZ.dist;
  const N = 3;
  const COL = { M: C.s2, S: C.s1, I: C.inactivo };

  function montar(cuerpo) {
    let s, rnd = VIZ.semilla(3);
    const ctl = VIZ.controles(cuerpo);
    for (let p = 0; p < N; p++) {
      ctl.boton(`P${p + 1} lee`, () => { acceso(p, 'R'); dibujar(); });
      ctl.boton(`P${p + 1} escribe`, () => { acceso(p, 'W'); dibujar(); });
    }
    ctl.boton('20 accesos al azar', () => { for (let k = 0; k < 20; k++) acceso(Math.floor(rnd() * N), rnd() < 0.3 ? 'W' : 'R'); dibujar(); }, { primario: true });
    ctl.boton('Reiniciar', () => reiniciar());

    const lienzo = VIZ.lienzo(cuerpo, { altoFn: (w) => (w < 600 ? 280 : 250) });
    VIZ.leyenda(cuerpo, [
      { color: C.s2, texto: 'M: única copia, modificada' }, { color: C.s1, texto: 'S: copia limpia, quizás compartida' }, { color: C.inactivo, texto: 'I: copia inválida' },
      { color: C.s8, texto: 'invalidación', forma: 'linea' }, { color: C.s3, texto: 'datos por el bus', forma: 'linea' },
    ]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Tres procesadores con caché comparten el bloque X a través de un bus. Cada caché escucha (snooping) lo que pasa por el bus.');

    function reiniciar() { s = { est: new Array(N).fill('I'), val: new Array(N).fill(null), mem: 0, cuenta: 0, aciertos: 0, fallos: 0, bus: 0, inval: 0, ult: null, log: 'Ninguna caché tiene el bloque X; la memoria tiene X = 0.' }; dibujar(); }

    function acceso(p, op) {
      const e = s.est[p], ult = { p, op, bus: null, inval: [], flush: null };
      if (op === 'R') {
        if (e !== 'I') { s.aciertos++; ult.texto = `P${p + 1} lee X = ${s.val[p]} de su caché (acierto, estado ${e}).`; }
        else {
          s.fallos++; s.bus++; ult.bus = 'BusRd';
          const duenio = s.est.findIndex((x) => x === 'M');
          if (duenio >= 0) { s.mem = s.val[duenio]; s.est[duenio] = 'S'; ult.flush = duenio; }
          s.est[p] = 'S'; s.val[p] = s.mem;
          ult.texto = `P${p + 1} falla y emite BusRd.${duenio >= 0 ? ` P${duenio + 1} tenía el bloque modificado: lo escribe en memoria (flush) y pasa a S.` : ''} P${p + 1} queda en S con X = ${s.mem}.`;
        }
      } else {
        s.cuenta++;
        if (e === 'M') { s.aciertos++; s.val[p] = 10 * s.cuenta; ult.texto = `P${p + 1} escribe X = ${s.val[p]} en su caché: ya era la única copia (M), sin tráfico.`; }
        else {
          if (e === 'S') s.aciertos++; else s.fallos++;
          s.bus++; ult.bus = e === 'S' ? 'BusUpgr' : 'BusRdX';
          const duenio = s.est.findIndex((x, q) => x === 'M' && q !== p);
          if (duenio >= 0) { s.mem = s.val[duenio]; ult.flush = duenio; }
          for (let q = 0; q < N; q++) if (q !== p && s.est[q] !== 'I') { s.est[q] = 'I'; ult.inval.push(q); s.inval++; }
          s.est[p] = 'M'; s.val[p] = 10 * s.cuenta;
          ult.texto = `P${p + 1} quiere escribir: emite ${ult.bus} para tener la única copia.${ult.inval.length ? ` Se invalida${ult.inval.length > 1 ? 'n' : ''} ${ult.inval.map((q) => `P${q + 1}`).join(' y ')}.` : ''} Escribe X = ${s.val[p]}; la memoria queda desactualizada (${s.mem}).`;
        }
      }
      s.ult = ult; s.log = ult.texto;
    }

    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      const yBus = H - 80, cw = Math.min(150, (W - 40) / N - 16);
      const xs = Array.from({ length: N }, (_, p) => W / 2 + (p - (N - 1) / 2) * (cw + 20));
      // Bus y memoria.
      ctx.strokeStyle = C.tinta; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, yBus); ctx.lineTo(W - 20, yBus); ctx.stroke();
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.tinta2; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('bus', 22, yBus - 4);
      const mx = W / 2, my = H - 40;
      ctx.fillStyle = C.fondo2; ctx.strokeStyle = C.tinta; ctx.lineWidth = 1.5;
      ctx.fillRect(mx - 70, my, 140, 34); ctx.strokeRect(mx - 70, my, 140, 34);
      ctx.beginPath(); ctx.moveTo(mx, yBus); ctx.lineTo(mx, my); ctx.stroke();
      ctx.font = VIZ.fuente(12, 500); ctx.fillStyle = C.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`memoria: X = ${s.mem}`, mx, my + 17);
      for (let p = 0; p < N; p++) {
        const x = xs[p], y = 18, e = s.est[p];
        ctx.font = VIZ.fuente(12, 600); ctx.fillStyle = C.tinta; ctx.fillText(`P${p + 1}`, x, y);
        ctx.fillStyle = e === 'I' ? C.neutro : VIZ.alfa(COL[e], 0.2); ctx.strokeStyle = COL[e]; ctx.lineWidth = s.ult && s.ult.p === p ? 3 : 1.5;
        ctx.beginPath(); ctx.roundRect(x - cw / 2, y + 14, cw, 60, 5); ctx.fill(); ctx.stroke();
        ctx.font = VIZ.fuente(20, 600); ctx.fillStyle = COL[e]; ctx.fillText(e, x - cw / 4, y + 44);
        ctx.font = VIZ.fuente(12, 500); ctx.fillStyle = e === 'I' ? C.apagado : C.tinta;
        ctx.fillText(e === 'I' ? 'X = —' : `X = ${s.val[p]}`, x + cw / 6, y + 44);
        ctx.strokeStyle = C.eje; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 74); ctx.lineTo(x, yBus); ctx.stroke();
        if (s.ult && s.ult.inval.includes(p)) D.flecha(ctx, x + 14, yBus - 4, x + 14, y + 80, { color: C.s8, ancho: 2.2 });
        if (s.ult && s.ult.flush === p) D.flecha(ctx, x - 14, y + 80, x - 14, yBus - 4, { color: C.s3, ancho: 2.2 });
        if (s.ult && s.ult.p === p && s.ult.bus) {
          D.flecha(ctx, x, y + 80, x, yBus - 4, { color: C.s3, ancho: 2.5 });
          D.etiqueta(ctx, s.ult.bus, x, (y + 80 + yBus) / 2, { color: C.s3, borde: C.s3, tam: 10 });
        }
      }
      registro.textContent = s.log;
      const accesos = s.aciertos + s.fallos;
      lectura.set([
        ['accesos', String(accesos)],
        ['aciertos', `${s.aciertos}${accesos ? ` (${Math.round((100 * s.aciertos) / accesos)} %)` : ''}`],
        ['transacciones en el bus', String(s.bus)],
        ['invalidaciones', String(s.inval)],
      ]);
    }
    lienzo.alDibujar = () => s && dibujar();
    reiniciar();
  }

  VIZ.registrarTema('cache-coherence', {
    intro: String.raw`
      <p>Cuando varios procesadores guardan copias de un mismo dato en sus cachés, una escritura en una copia deja a las otras desactualizadas. Un
      <strong>protocolo de coherencia</strong> asegura que todos vean una única historia de valores para cada dirección: nadie puede leer un valor viejo después de
      que otro escribió uno nuevo y la escritura se hizo visible.</p>
      <p>El protocolo <strong>MSI</strong> por invalidación da a cada copia uno de tres estados: <strong>M</strong> (modificado: única copia, distinta de la memoria),
      <strong>S</strong> (compartido, <em>shared</em>: copia limpia, puede haber otras) e <strong>I</strong> (inválido). Para escribir, un procesador debe ser el único con el bloque: invalida a los demás. El
      mismo problema, a escala de red, es el de la <strong>memoria compartida distribuida</strong> y el de toda caché replicada.</p>`,
    visualizaciones: [
      {
        titulo: 'El protocolo MSI',
        descripcion: 'Haga que los tres lean (todos en S), luego que P2 escriba: las otras copias se invalidan. Si P1 vuelve a leer, P2 debe entregar el valor (flush) y ambos quedan en S.',
        montar,
      },
    ],
    teoria: String.raw`
      <h2>Transiciones de MSI</h2>
      <table>
        <tr><th>Estado</th><th>Lectura propia</th><th>Escritura propia</th><th>Ve BusRd de otro</th><th>Ve BusRdX/BusUpgr de otro</th></tr>
        <tr><td>I</td><td>BusRd → S</td><td>BusRdX → M</td><td>—</td><td>—</td></tr>
        <tr><td>S</td><td>acierto</td><td>BusUpgr → M</td><td>—</td><td>→ I</td></tr>
        <tr><td>M</td><td>acierto</td><td>acierto</td><td>flush → S</td><td>flush → I</td></tr>
      </table>
      <p><strong>Invariante:</strong> para cada bloque, o hay una única copia en M, o cualquier cantidad en S que coinciden con la memoria. Como todas las transacciones pasan por el bus, que
      las ordena totalmente, las escrituras a una misma dirección quedan serializadas (coherencia). MESI agrega el estado E (exclusivo y limpio) para escribir sin transacción si nadie más
      leyó; MOESI, el O (dueño de una copia sucia compartida).</p>

      <h2>Invalidación o actualización</h2>
      <p>En lugar de invalidar, una escritura puede <em>difundir</em> el valor nuevo a todas las copias (protocolos de actualización, como Dragon). Conviene si los demás van a releer el dato
      pronto; si no, gasta ancho de banda en copias que nadie usará. La invalidación domina en la práctica.</p>

      <h2>Sin bus: directorios y memoria compartida distribuida</h2>
      <p>Sin un medio de difusión, un <strong>directorio</strong> guarda, por bloque, quiénes tienen copia, y las invalidaciones son mensajes punto a punto. La <strong>memoria compartida
      distribuida</strong> (DSM, Li y Hudak con Ivy, 1989) aplica lo mismo a páginas de memoria virtual entre computadores: una falla de página trae la página por la red, y una escritura
      invalida las copias remotas. El costo de cada falla es enorme, y aparece el <strong>falso compartir</strong>: dos procesos que escriben variables distintas de la misma página se la
      quitan mutuamente. Por eso los sistemas DSM relajan el modelo (consistencia de liberación, de entrada), propagando cambios solo en puntos de sincronización.</p>
      <p>Coherencia es un orden por dirección; la <a href="tema.html?id=sequential-consistency">consistencia secuencial</a> exige además un orden común entre direcciones, que los buffers de
      escritura rompen.</p>`,
  });
})();
