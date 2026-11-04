(function () {
  'use strict';
  const { color: C, el } = VIZ;
  const hex = (b) => b.map((x) => x.toString(16).padStart(2, '0')).join(' ');

  function montarCifrado(cuerpo) {
    let msg = 'Transferir 100 a Ana', clave = 'secreto', alt = 0, mac = false;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Mensaje', valor: msg, alCambiar: (v) => { msg = v.slice(0, 32); dibujar(); } });
    ctl.texto({ etiqueta: 'Clave compartida', valor: clave, alCambiar: (v) => { clave = v; dibujar(); } });
    ctl.rango({ etiqueta: 'Byte que altera el atacante (0 = ninguno)', min: 0, max: 32, valor: alt, alCambiar: (v) => { alt = v; dibujar(); } });
    ctl.casilla({ etiqueta: 'Agregar código de autenticación (MAC)', valor: mac, alCambiar: (v) => { mac = v; dibujar(); } });
    const caja = el('div', { class: 'caja-desplazable' });
    cuerpo.appendChild(caja);
    cuerpo.dataset.sinLeyenda = 'tabla con el resultado de cada paso';
    const registro = VIZ.registro(cuerpo);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cifrado de juguete (flujo pseudoaleatorio con XOR) solo para ilustrar: no usar en la práctica. El cifrado oculta el contenido, pero no impide que un atacante altere bytes; el MAC sí lo detecta.');
    function dibujar() {
      if (!msg) { registro.textContent = 'Escriba un mensaje.'; return; }
      const cif = VIZ.sor.cifrar(msg, clave), tag = mac ? VIZ.sor.hash64(msg, clave) : null;
      const rec = cif.slice(); if (alt >= 1 && alt <= rec.length) rec[alt - 1] ^= 0x20;
      const des = VIZ.sor.descifrar(rec, clave), tag2 = mac ? VIZ.sor.hash64(des, clave) : null;
      const ok = !mac ? true : tag === tag2;
      caja.replaceChildren(el('table', { class: 'tabla-datos sin-corte' },
        [['mensaje', msg], ['cifrado (hex)', hex(cif)], ['MAC enviado', tag || '—'], ['recibido (hex)', hex(rec)], ['descifrado', des], ['MAC recalculado', tag2 || '—']]
          .map(([k, v]) => el('tr', null, el('td', { class: 'izq' }, k), el('td', { style: k === 'descifrado' && des !== msg ? { color: C.s8, fontWeight: 600 } : {} }, v)))));
      registro.textContent = alt < 1 ? 'Sin ataque: el receptor descifra el mensaje original' + (mac ? ' y el MAC coincide.' : '.')
        : mac ? (ok ? 'El MAC coincide (¿byte fuera del mensaje?).' : 'El MAC recalculado no coincide con el recibido: el receptor rechaza el mensaje alterado.')
          : `Sin MAC, el receptor acepta «${des}» sin darse cuenta de que fue modificado.`;
      lectura.set([['confidencialidad', 'sí: sin la clave no se lee'], ['integridad', mac ? 'sí: se detecta la alteración' : 'no: se puede alterar sin que se note'], ['mensaje aceptado', alt >= 1 && mac && !ok ? 'rechazado' : des.slice(0, 24)]]);
    }
    dibujar();
  }

  function montarAvalancha(cuerpo) {
    let txt = 'Transferir 100 a Ana', pos = 10;
    const ctl = VIZ.controles(cuerpo);
    ctl.texto({ etiqueta: 'Texto', valor: txt, alCambiar: (v) => { txt = v.slice(0, 40); dibujar(); } });
    ctl.rango({ etiqueta: 'Carácter que cambia (1 bit)', min: 1, max: 40, valor: pos, alCambiar: (v) => { pos = v; dibujar(); } });
    const lienzo = VIZ.lienzo(cuerpo, { alto: 130 });
    VIZ.leyenda(cuerpo, [{ color: C.s1, texto: 'bit igual en ambos' }, { color: C.s8, texto: 'bit distinto' }]);
    const lectura = VIZ.lectura(cuerpo);
    VIZ.nota(cuerpo, 'Cambiar un solo bit de la entrada altera alrededor de la mitad de los bits del resumen (efecto avalancha). Hash de 32 bits de juguete, no seguro.');
    function dibujar() {
      const { ctx, ancho: W } = lienzo; lienzo.limpiar();
      if (!txt) return;
      const i = Math.min(pos, txt.length) - 1, t2 = txt.slice(0, i) + String.fromCharCode(txt.charCodeAt(i) ^ 1) + txt.slice(i + 1);
      const a = VIZ.sor.hash(txt), b = VIZ.sor.hash(t2), cw = Math.min(26, (W - 20) / 16);
      [a, b].forEach((h, r) => { for (let k = 0; k < 32; k++) { const x = 10 + (k % 16) * cw, y = 10 + r * 60 + Math.floor(k / 16) * 26, bit = (h >>> (31 - k)) & 1, difiere = ((a ^ b) >>> (31 - k)) & 1; ctx.fillStyle = difiere ? C.s8 : C.s1; ctx.globalAlpha = bit ? 1 : 0.35; ctx.fillRect(x, y, cw - 2, 22); ctx.globalAlpha = 1; } });
      let d = 0; for (let k = 0; k < 32; k++) d += ((a ^ b) >>> k) & 1;
      lectura.set([['hash original', VIZ.sor.hex(a, 8)], ['hash modificado', VIZ.sor.hex(b, 8)], ['bits distintos', `${d} de 32`], ['esperado al azar', '16 de 32']]);
    }
    lienzo.alDibujar = dibujar;
    dibujar();
  }

  VIZ.registrarTema('symmetric-encryption-mac', {
    intro: String.raw`
      <p>Proteger una comunicación significa garantizar tres cosas: <strong>confidencialidad</strong> (solo los autorizados leen el contenido), <strong>integridad</strong> (nadie lo altera sin que se note) y <strong>autenticación</strong> (se sabe quién lo envió). Se obtienen con herramientas distintas, y es un error común creer que el cifrado las da todas.</p>
      <p>El <strong>cifrado simétrico</strong> usa una misma clave en ambos extremos y da confidencialidad. Para integridad y autenticación se añade un <strong>código de autenticación de mensaje</strong> (MAC): una etiqueta que solo puede calcular quien conoce la clave.</p>`,
    visualizaciones: [
      { titulo: 'Cifrar y autenticar', descripcion: 'Altere un byte del mensaje cifrado, primero sin MAC y luego con MAC. Cambie la clave: el descifrado ya no coincide.', montar: montarCifrado },
      { titulo: 'Efecto avalancha de un hash', descripcion: 'Cambie un único bit del texto y compare los bits del resumen: cerca de la mitad cambian.', montar: montarAvalancha },
    ],
    teoria: String.raw`
      <h2>Cifrado simétrico</h2>
      <p>Cifrado por bloques (AES) o de flujo (ChaCha20): \(c = E_k(m)\), \(m = D_k(c)\). Su seguridad descansa en la clave: con \(n\) bits hay \(2^n\) claves, y probarlas todas es inviable para \(n \ge 128\). El problema es cómo compartir la clave: lo resuelve el <a href="tema.html?id=tls-key-exchange">intercambio de claves</a>.</p>
      <h2>Integridad: hash y MAC</h2>
      <p>Una función hash \(H\) comprime cualquier mensaje a un resumen fijo, es difícil de invertir y cambia mucho ante cambios mínimos (avalancha). Pero cualquiera puede calcularla; para autenticar se mezcla con la clave:</p>
      \[ \text{MAC}_k(m) = H\bigl((k \oplus \text{opad}) \,\|\, H((k \oplus \text{ipad}) \,\|\, m)\bigr) \quad (\text{HMAC}). \]
      <p>El emisor envía \((m, \text{MAC}_k(m))\); el receptor recalcula y compara. Un atacante sin \(k\) no puede fabricar una etiqueta válida para un mensaje alterado.</p>
      <h2>Por qué cifrar no basta</h2>
      <p>En los cifrados de flujo, invertir un bit del texto cifrado invierte el mismo bit del texto claro: el atacante modifica el mensaje a ciegas. Por eso los protocolos modernos usan <strong>cifrado autenticado</strong> (AES-GCM, ChaCha20-Poly1305), que cifra y calcula la etiqueta en un solo paso. Esto se aplica en <a href="tema.html?id=tls-key-exchange">TLS</a> y en el <a href="tema.html?id=ipsec-vpn">ESP de IPsec</a>.</p>
      <p>Una suma de verificación o un <a href="tema.html?id=error-detection-crc">CRC</a> sirve contra el ruido, pero no contra un adversario, que puede recalcularlos tras alterar el mensaje.</p>`,
  });
})();
