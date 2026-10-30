(function () {
  'use strict';
  const { color: C } = VIZ;
  const DL = VIZ.dl;

  const NOM = DL.CLASES_OBJ.map(([n]) => n);

  /* ---------- Fig. 1: intersección sobre unión ---------- */

  function montarIoU(cuerpo) {
    let real = { x: 0.3, y: 0.3, w: 0.35, h: 0.3 }, pred = { x: 0.42, y: 0.38, w: 0.35, h: 0.3 }, umbral = 0.5, geo = null, arrastrando = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Ancho de la caja predicha', min: 0.1, max: 0.7, paso: 0.01, valor: pred.w, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pred.w = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Alto de la caja predicha', min: 0.1, max: 0.7, paso: 0.01, valor: pred.h, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { pred.h = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Umbral de IoU', min: 0.3, max: 0.9, paso: 0.05, valor: umbral, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { umbral = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s6, texto: 'caja real (ground truth)', forma: 'linea' }, { color: C.s2, texto: 'caja predicha', forma: 'linea' }, { color: C.s1, texto: 'intersección', forma: 'cuadro' }, { color: C.apagado, texto: 'unión', forma: 'cuadro' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Arrastre la caja predicha (o haga clic para mover su centro). El IoU es el área de la intersección dividida por el área de la unión: 1 si coinciden, 0 si no se tocan.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo, S = Math.min(H - 8, W * 0.55), X = 4, Y = 4;
      lienzo.limpiar();
      DL.dibujarEscena(ctx, X, Y, S, S, []);
      const ix = Math.max(real.x, pred.x), iy = Math.max(real.y, pred.y), iw = Math.min(real.x + real.w, pred.x + pred.w) - ix, ih = Math.min(real.y + real.h, pred.y + pred.h) - iy;
      ctx.fillStyle = VIZ.alfa(C.apagado, 0.14); ctx.fillRect(X + real.x * S, Y + real.y * S, real.w * S, real.h * S); ctx.fillRect(X + pred.x * S, Y + pred.y * S, pred.w * S, pred.h * S);
      if (iw > 0 && ih > 0) { ctx.fillStyle = VIZ.alfa(C.s1, 0.5); ctx.fillRect(X + ix * S, Y + iy * S, iw * S, ih * S); }
      DL.caja(ctx, X, Y, S, S, real, C.s6, { ancho: 3 }); DL.caja(ctx, X, Y, S, S, pred, C.s2, { ancho: 3 });
      geo = { X, Y, S };
      const I = iw > 0 && ih > 0 ? iw * ih : 0, A = real.w * real.h, B = pred.w * pred.h, U = A + B - I, iou = I / U;
      // Medidor a la derecha.
      const mx = X + S + 28, mw = Math.max(40, W - mx - 16);
      if (mw > 60) {
        ctx.fillStyle = C.tinta2; ctx.font = VIZ.fuente(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('IoU = intersección / unión', mx, 10);
        ctx.fillStyle = C.rejilla; ctx.fillRect(mx, 32, mw, 16);
        ctx.fillStyle = iou >= umbral ? C.s6 : C.s8; ctx.fillRect(mx, 32, mw * iou, 16);
        ctx.strokeStyle = C.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx + mw * umbral, 28); ctx.lineTo(mx + mw * umbral, 52); ctx.stroke();
        ctx.fillStyle = C.tinta; ctx.font = VIZ.fuente(18, 600); ctx.fillText(VIZ.fmt(iou, 3), mx, 62);
        ctx.font = VIZ.fuente(11); ctx.fillStyle = C.tinta2;
        [`intersección = ${VIZ.fmt(I, 3)}`, `área real = ${VIZ.fmt(A, 3)}`, `área predicha = ${VIZ.fmt(B, 3)}`, `unión = ${VIZ.fmt(A, 3)} + ${VIZ.fmt(B, 3)} − ${VIZ.fmt(I, 3)} = ${VIZ.fmt(U, 3)}`].forEach((t, i) => ctx.fillText(t, mx, 96 + i * 18));
      }
      registro.textContent = iou >= umbral ? `IoU ${VIZ.fmt(iou, 3)} ≥ ${VIZ.fmt(umbral, 2)}: la detección cuenta como acierto (verdadero positivo).` : `IoU ${VIZ.fmt(iou, 3)} < ${VIZ.fmt(umbral, 2)}: la detección cuenta como error (falso positivo).`;
      lectura.set([['IoU', VIZ.fmt(iou, 3)], ['umbral', VIZ.fmt(umbral, 2)], ['resultado', iou >= umbral ? 'verdadero positivo' : 'falso positivo'], ['desplazamiento del centro', VIZ.fmt(Math.hypot(pred.x + pred.w / 2 - real.x - real.w / 2, pred.y + pred.h / 2 - real.y - real.h / 2), 3)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.style.cursor = 'move';
    const mover = (ev) => { const { x, y } = lienzo.posicion(ev); pred.x = Math.max(0, Math.min(1 - pred.w, (x - geo.X) / geo.S - pred.w / 2)); pred.y = Math.max(0, Math.min(1 - pred.h, (y - geo.Y) / geo.S - pred.h / 2)); dibujar(); };
    lienzo.canvas.addEventListener('pointerdown', (ev) => { arrastrando = true; lienzo.canvas.setPointerCapture(ev.pointerId); mover(ev); });
    lienzo.canvas.addEventListener('pointermove', (ev) => { if (arrastrando) mover(ev); });
    lienzo.canvas.addEventListener('pointerup', () => { arrastrando = false; });
    dibujar();
  }

  /* ---------- Fig. 2: supresión de no máximos ---------- */

  function montarNMS(cuerpo) {
    let umbral = 0.5, semilla = 1, objs = [], cand = [], estado = [], actual = -1, msg = '', geo = null;
    const ctl = VIZ.controles(cuerpo);
    ctl.rango({ etiqueta: 'Umbral de IoU para suprimir', min: 0.1, max: 0.9, paso: 0.05, valor: umbral, formato: (v) => VIZ.fmt(v, 2), alCambiar: (v) => { umbral = v; rep.reiniciar(); } });
    const rep = VIZ.reproductor(ctl, { iniciar, dibujar, velocidad: 0 });
    ctl.boton('Nuevas detecciones', () => { semilla++; rep.reiniciar(); });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.6, altoMin: 300, altoMax: 440 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.inactivo, texto: 'candidata pendiente', forma: 'linea' }, { color: C.s2, texto: 'la de mayor confianza (se examina)', forma: 'linea' }, { color: C.s6, texto: 'conservada', forma: 'linea' }, { color: C.s8, texto: 'suprimida (IoU alto con una conservada)', forma: 'linea' }]);
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada paso toma la candidata con mayor confianza, la conserva y elimina las pendientes de su misma clase que se le parecen demasiado. Con un umbral bajo se suprime de más (objetos cercanos se pierden); con uno alto quedan duplicados.');
    function iniciar() {
      objs = DL.escena(semilla + 5, 3);
      const r = VIZ.semilla(semilla * 17 + 2);
      cand = [];
      objs.forEach((o, k) => { const m = 4 + Math.floor(r() * 2); for (let q = 0; q < m; q++) { const d = 0.04 + 0.04 * r(); cand.push({ clase: o.clase, x: o.x + (r() - 0.5) * 2 * d, y: o.y + (r() - 0.5) * 2 * d, w: o.w * (1 + (r() - 0.5) * 0.4), h: o.h * (1 + (r() - 0.5) * 0.4), conf: 0.35 + 0.6 * r() }); } });
      estado = cand.map(() => 'pend'); actual = -1; msg = `${cand.length} candidatas: varias por objeto, con confianzas distintas.`;
      return (function* () {
        for (;;) {
          const idx = cand.map((_, i) => i).filter((i) => estado[i] === 'pend').sort((a, b) => cand[b].conf - cand[a].conf);
          if (!idx.length) { actual = -1; msg = `Terminado: se conservan ${estado.filter((e) => e === 'cons').length} de ${cand.length} candidatas.`; return; }
          const i = idx[0]; actual = i; estado[i] = 'cons';
          const sup = idx.slice(1).filter((j) => cand[j].clase === cand[i].clase && DL.iou(cand[i], cand[j]) > umbral);
          sup.forEach((j) => { estado[j] = 'sup'; });
          msg = `Se conserva la candidata ${NOM[cand[i].clase]} (confianza ${VIZ.fmt(cand[i].conf, 2)}) y se suprimen ${sup.length} con IoU > ${VIZ.fmt(umbral, 2)}.`;
          yield;
        }
      })();
    }
    function dibujar() {
      if (!cand.length) return;
      const { ctx, ancho: W, alto: H } = lienzo, S = Math.min(H - 8, W - 8), X = (W - S) / 2, Y = 4;
      lienzo.limpiar();
      DL.dibujarEscena(ctx, X, Y, S, S, objs);
      geo = { X, Y, S };
      cand.forEach((c, i) => { if (estado[i] === 'sup') DL.caja(ctx, X, Y, S, S, c, C.s8, { ancho: 1.5, guiones: [4, 4] }); });
      cand.forEach((c, i) => { if (estado[i] === 'pend') DL.caja(ctx, X, Y, S, S, c, C.inactivo, { ancho: 1.5 }); });
      cand.forEach((c, i) => { if (estado[i] === 'cons') DL.caja(ctx, X, Y, S, S, c, i === actual ? C.s2 : C.s6, { ancho: i === actual ? 3.5 : 2.5, etiqueta: VIZ.fmt(c.conf, 2) }); });
      registro.textContent = msg;
      const nc = estado.filter((e) => e === 'cons').length, ns = estado.filter((e) => e === 'sup').length, np = estado.filter((e) => e === 'pend').length;
      lectura.set([['candidatas', String(cand.length)], ['conservadas', String(nc)], ['suprimidas', String(ns)], ['pendientes', String(np)], ['objetos reales', String(objs.length)]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      const { x, y } = lienzo.posicion(ev);
      if (!geo) return;
      const i = cand.findIndex((c) => x >= geo.X + c.x * geo.S && x <= geo.X + (c.x + c.w) * geo.S && y >= geo.Y + c.y * geo.S && y <= geo.Y + (c.y + c.h) * geo.S);
      if (i >= 0) tip.mostrar(x, y, `${NOM[cand[i].clase]} · confianza <b>${VIZ.fmt(cand[i].conf, 2)}</b><br>estado: ${{ pend: 'pendiente', cons: 'conservada', sup: 'suprimida' }[estado[i]]}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    rep.reiniciar();
  }

  VIZ.registrarTema('iou-nms', {
    intro: String.raw`
      <p>Para decidir si una caja predicha «acertó» hace falta un número que mida cuánto se parece a la caja real: la <strong>Intersección sobre Unión</strong> (<em>Intersection over Union</em>, IoU). Vale 1 si coinciden y 0 si no se tocan; por convención, un IoU ≥ 0,5 cuenta como acierto.</p>
      <p>Un detector, además, tiende a proponer muchas cajas casi iguales para un mismo objeto. La <strong>supresión de no máximos</strong> (<em>Non-Maximum Suppression</em>, NMS) las limpia: se queda con la más confiable y descarta las que se le superponen demasiado.</p>`,
    visualizaciones: [
      { titulo: 'Intersección sobre unión', descripcion: 'Arrastre la caja naranja sobre la verde y cambie su tamaño. Busque un IoU de 0,5 y observe que dos cajas pueden «parecerse» y aun así no llegar.', montar: montarIoU },
      { titulo: 'Supresión de no máximos paso a paso', descripcion: 'Avance con «Un paso» y observe qué candidatas se conservan. Pruebe un umbral bajo (0,2) y uno alto (0,8).', montar: montarNMS },
    ],
    teoria: String.raw`
      <h2>IoU</h2>
      <p>Para dos cajas \(A\) y \(B\):</p>
      \[ \operatorname{IoU}(A,B) = \frac{|A\cap B|}{|A\cup B|} = \frac{|A\cap B|}{|A|+|B|-|A\cap B|}\in[0,1]. \]
      <p>Con \(A=[x_1,y_1,x_2,y_2]\), la intersección es \(\max(0,\min(x_2,x_2')-\max(x_1,x_1'))\cdot\max(0,\min(y_2,y_2')-\max(y_1,y_1'))\). Una detección es un <em>verdadero positivo</em> si \(\operatorname{IoU}\ge\tau\) con una caja real de la misma clase aún sin emparejar; si no, es un <em>falso positivo</em>.</p>
      <h2>Supresión de no máximos</h2>
      <pre><code>ordenar las cajas por confianza, de mayor a menor
conservadas ← lista vacía
mientras queden cajas:
    b ← la de mayor confianza; moverla a conservadas
    para cada caja c restante de la misma clase que b:
        si IoU(b, c) &gt; τ: eliminar c</code></pre>
      <p>Se ejecuta por clase y tiene costo \(O(n^2)\) en el peor caso. El umbral \(\tau\) (típicamente 0,45–0,6) es un compromiso: bajo, suprime objetos cercanos; alto, deja duplicados.</p>
      <h2>Métrica: mAP</h2>
      <p>Variando el umbral de confianza se obtiene una curva precisión–exhaustividad (ver <a href="tema.html?id=imbalanced-metrics">Classification Metrics</a>); su área es la <em>precisión promedio</em> (AP) de la clase, y el promedio entre clases es el <strong>mAP</strong>. Se suele reportar mAP@0,5 y mAP@[0,5:0,95].</p>
      <div class="recuadro"><p>El IoU también se usa como <em>pérdida</em> de localización (GIoU, DIoU, CIoU), porque la distancia L2 entre coordenadas no refleja bien qué tan bien se solapan las cajas.</p></div>
      <p>Véase <a href="tema.html?id=object-detection">Object Detection</a> para el contexto.</p>`,
  });
})();
