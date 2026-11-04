(function () {
  'use strict';
  const { color: C } = VIZ;

  // Simulación por ranuras de tiempo. Cada ranura el emisor puede enviar un segmento; el retardo de ida es D; el ACK tarda D.
  function simular(proto, N, p, D, n, sem) {
    const rnd = VIZ.semilla(sem * 7919 + 5), T = 2 * D + 2, tx = [];
    const llegaD = {}, llegaA = {};
    const enviado = Array(n).fill(-1e9), ackd = Array(n).fill(false), recib = Array(n).fill(false);
    let base = 0, sig = 0, esp = 0, t = 0;
    const enviar = (s, ret) => { const per = rnd() < p; tx.push({ t, s, per, ret }); enviado[s] = t; if (!per) (llegaD[t + D] = llegaD[t + D] || []).push(s); };
    const ack = (a) => { const per = rnd() < p; if (!per) (llegaA[t + D] = llegaA[t + D] || []).push(a); };
    while (base < n && t < 600) {
      for (const s of llegaD[t] || []) {
        if (proto === 'sr') { recib[s] = true; ack(s); }
        else if (s === esp) { esp++; ack(esp - 1); } else ack(esp - 1); // GBN: ACK acumulativo del último en orden
      }
      for (const a of llegaA[t] || []) {
        if (proto === 'sr') { ackd[a] = true; while (base < n && ackd[base]) base++; }
        else if (a >= base) base = a + 1;
      }
      let hecho = false;
      if (proto === 'sr') {
        for (let s = base; s < Math.min(n, base + N) && !hecho; s++) if (!ackd[s] && t - enviado[s] >= T) { enviar(s, true); hecho = true; }
        if (!hecho && sig < Math.min(n, base + N)) { enviar(sig, false); sig++; hecho = true; }
      } else {
        if (base < sig && t - enviado[base] >= T) { sig = base; }
        if (sig < Math.min(n, base + N)) { enviar(sig, enviado[sig] > -1e8); sig++; }
      }
      t++;
    }
    return { tx, total: t, n };
  }

  function montar(cuerpo) {
    let proto = 'gbn', N = 5, p = 10, D = 3, n = 20, sem = 1, res, geo;
    const ctl = VIZ.controles(cuerpo);
    ctl.selector({ etiqueta: 'Protocolo', opciones: [['gbn', 'Retroceder N (Go-Back-N)'], ['sr', 'Repetición selectiva']], valor: proto, alCambiar: (v) => { proto = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Ventana N (1 = parar y esperar)', min: 1, max: 12, valor: N, alCambiar: (v) => { N = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Probabilidad de pérdida', min: 0, max: 40, valor: p, formato: (v) => v + ' %', alCambiar: (v) => { p = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Retardo de un sentido (ranuras)', min: 1, max: 8, valor: D, alCambiar: (v) => { D = v; dibujar(); } });
    ctl.boton('Nueva pérdida al azar', () => { sem++; dibujar(); }, { primario: true });
    const lienzo = VIZ.lienzo(cuerpo, { proporcion: 0.55, altoMin: 280, altoMax: 400 });
    const tip = VIZ.tooltip(lienzo);
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'primer envío' }, { color: C.s2, texto: 'retransmisión' }, { color: C.s8, texto: 'segmento perdido', forma: 'punto' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cada punto es un envío: horizontal, el tiempo; vertical, el número de segmento. Go-Back-N retransmite todo desde el perdido; la repetición selectiva solo el perdido. Con N = 1 es parar y esperar.');
    function dibujar() {
      const { ctx, ancho: W, alto: H } = lienzo;
      lienzo.limpiar();
      res = simular(proto, N, p / 100, D, n, sem);
      const izq = 36, inf = 30, sup = 12, ex = (W - izq - 12) / Math.max(res.total, 1), ey = (H - inf - sup) / n; geo = { izq, ex, ey, sup };
      ctx.font = VIZ.fuente(10); ctx.fillStyle = C.apagado; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let s = 0; s < n; s += 5) { ctx.fillText(String(s), izq - 6, sup + (n - 1 - s + 0.5) * ey); ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(izq, sup + (n - 1 - s + 0.5) * ey); ctx.lineTo(W - 12, sup + (n - 1 - s + 0.5) * ey); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (let t = 0; t <= res.total; t += Math.ceil(res.total / 10)) ctx.fillText(String(t), izq + t * ex, H - inf + 8);
      ctx.textAlign = 'right'; ctx.fillText('tiempo (ranuras)', W - 12, H - 12); ctx.textAlign = 'left'; ctx.fillText('segmento', 2, 0);
      res.tx.forEach((x) => {
        const cx = izq + x.t * ex + 2, cy = sup + (n - 1 - x.s + 0.5) * ey;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(2.5, Math.min(5, ey / 2.2)), 0, 7); ctx.fillStyle = x.ret ? C.s2 : C.s1; ctx.fill();
        if (x.per) { ctx.strokeStyle = C.s8; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
      });
      const per = res.tx.filter((x) => x.per).length, ideal = n + 2 * D;
      lectura.set([['tiempo total', `${res.total} ranuras`], ['envíos', `${res.tx.length} (${res.tx.length - n} retransmisiones)`], ['segmentos perdidos', String(per)], ['utilización del emisor', `${VIZ.fmt((n / res.total) * 100, 3)} %`], ['mejor caso sin pérdidas', `${ideal} ranuras`]]);
    }
    lienzo.alDibujar = dibujar;
    lienzo.canvas.addEventListener('pointermove', (ev) => {
      if (!res) return;
      const { x, y } = lienzo.posicion(ev), q = res.tx.find((e) => Math.abs(geo.izq + e.t * geo.ex + 2 - x) < 5 && Math.abs(geo.sup + (n - 1 - e.s + 0.5) * geo.ey - y) < 6);
      if (q) tip.mostrar(x, y, `segmento <b>${q.s}</b><br>enviado en t = ${q.t}<br>${q.ret ? 'retransmisión' : 'primer envío'}${q.per ? '<br>se perdió' : ''}`); else tip.ocultar();
    });
    lienzo.canvas.addEventListener('pointerleave', () => tip.ocultar());
    dibujar();
  }

  VIZ.registrarTema('reliable-transfer', {
    intro: String.raw`
      <p>La red subyacente (IP) puede perder, duplicar o reordenar paquetes. Para ofrecer una entrega <strong>fiable y ordenada</strong> encima, la capa de transporte usa números de secuencia, confirmaciones (ACK), un temporizador y retransmisiones. La pregunta es cuántos segmentos puede haber «en vuelo» sin confirmar.</p>
      <p>Con <strong>parar y esperar</strong> solo uno: simple pero lento. Con una <strong>ventana deslizante</strong> se envían varios seguidos: <em>Go-Back-N</em> retrocede y reenvía todo desde el primer perdido; la <em>repetición selectiva</em> reenvía solo los perdidos.</p>`,
    visualizaciones: [
      { titulo: 'Entrega fiable con ventana deslizante', descripcion: 'Con N = 1 el emisor casi siempre espera. Aumente la ventana, luego la pérdida, y compare Go-Back-N con repetición selectiva en envíos y tiempo total.', montar },
    ],
    teoria: String.raw`
      <h2>Utilización</h2>
      <p>Si transmitir un segmento toma \(L/R\) y el RTT es \(\mathrm{RTT}\), parar y esperar utiliza el emisor</p>
      \[ U = \frac{L/R}{\mathrm{RTT} + L/R}. \]
      <p>Con un enlace de 1 Gbps, RTT de 30 ms y segmentos de 8 000 bits: \(L/R = 8\) µs y \(U \approx 0{,}027\,\%\). Con una ventana de \(N\) segmentos, \(U = N\,(L/R)/(\mathrm{RTT} + L/R)\); para llenar el enlace hay que alcanzar el <em>producto ancho de banda–retardo</em> \(R\cdot\mathrm{RTT}\).</p>
      <h2>Go-Back-N</h2>
      <pre><code>emisor:  puede enviar mientras sig &lt; base + N
         ACK(k) acumulativo → base ← k + 1
         timeout del más antiguo → reenviar base … sig − 1
receptor: acepta solo el segmento esperado;  responde ACK del último en orden</code></pre>
      <p>Simple, el receptor no guarda nada, pero una pérdida obliga a reenviar hasta \(N\) segmentos.</p>
      <h2>Repetición selectiva</h2>
      <p>El receptor guarda en búfer los segmentos fuera de orden y confirma cada uno; el emisor tiene un temporizador por segmento y reenvía solo el perdido. Exige que \(N \le 2^{k-1}\) con \(k\) bits de número de secuencia, o se confundirían segmentos nuevos con retransmisiones antiguas.</p>
      <p>TCP mezcla ambos: ACK acumulativos como Go-Back-N, pero guarda los segmentos fuera de orden y puede usar ACK selectivos (SACK); además, tres ACK repetidos dan <em>retransmisión rápida</em> antes del timeout. Ver los mensajes en <a href="tema.html?id=tcp-connection">TCP</a>, el tamaño de ventana impuesto por el receptor en <a href="tema.html?id=tcp-flow-control">control de flujo</a> y por la red en <a href="tema.html?id=tcp-congestion-control">control de congestión</a>.</p>`,
  });
})();
