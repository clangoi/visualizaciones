/* Bases de datos y privacidad: relaciones pequeñas de ejemplo, operadores del álgebra relacional,
   tablas HTML con filas y celdas resaltadas, páginas de disco dibujadas en canvas y un conjunto
   de registros clínicos con jerarquías de generalización para k-anonimato y l-diversidad. */
(function () {
  'use strict';
  const { el, color: C } = VIZ;

  /* ---------- Relaciones ---------- */

  // Una relación es { nombre, atributos, filas }, con cada fila como objeto { atributo: valor }.
  function rel(nombre, atributos, filas) {
    return {
      nombre, atributos,
      filas: filas.map((f) => (Array.isArray(f) ? Object.fromEntries(atributos.map((a, i) => [a, f[i]])) : { ...f })),
    };
  }
  const claveFila = (f, atributos) => atributos.map((a) => String(f[a])).join('\u0001');
  function sinDuplicados(filas, atributos) {
    const vistos = new Set();
    return filas.filter((f) => { const k = claveFila(f, atributos); if (vistos.has(k)) return false; vistos.add(k); return true; });
  }

  const seleccionar = (R, pred, nombre) => rel(nombre || `σ(${R.nombre})`, R.atributos, R.filas.filter(pred));
  const proyectar = (R, atr, nombre) =>
    rel(nombre || `π(${R.nombre})`, atr, sinDuplicados(R.filas.map((f) => Object.fromEntries(atr.map((a) => [a, f[a]]))), atr));
  const renombrar = (R, mapa, nombre) => rel(nombre || R.nombre, R.atributos.map((a) => mapa[a] || a),
    R.filas.map((f) => Object.fromEntries(R.atributos.map((a) => [mapa[a] || a, f[a]]))));
  function producto(R, S, nombre) {
    const comunes = R.atributos.filter((a) => S.atributos.includes(a));
    const nr = (a) => (comunes.includes(a) ? `${R.nombre}.${a}` : a);
    const ns = (a) => (comunes.includes(a) ? `${S.nombre}.${a}` : a);
    const atr = [...R.atributos.map(nr), ...S.atributos.map(ns)];
    const filas = [];
    for (const r of R.filas) for (const s of S.filas) {
      const f = {};
      R.atributos.forEach((a) => { f[nr(a)] = r[a]; });
      S.atributos.forEach((a) => { f[ns(a)] = s[a]; });
      filas.push(f);
    }
    return rel(nombre || `${R.nombre} × ${S.nombre}`, atr, filas);
  }
  // Junta natural: iguala los atributos con el mismo nombre.
  function juntar(R, S, nombre) {
    const comunes = R.atributos.filter((a) => S.atributos.includes(a));
    const atr = [...R.atributos, ...S.atributos.filter((a) => !comunes.includes(a))];
    const filas = [];
    for (const r of R.filas) for (const s of S.filas) if (comunes.every((a) => r[a] === s[a])) filas.push({ ...s, ...r });
    return rel(nombre || `${R.nombre} ⋈ ${S.nombre}`, atr, filas);
  }
  const union = (R, S, nombre) => rel(nombre || `${R.nombre} ∪ ${S.nombre}`, R.atributos, sinDuplicados([...R.filas, ...S.filas], R.atributos));
  function diferencia(R, S, nombre) {
    const enS = new Set(S.filas.map((f) => claveFila(f, R.atributos)));
    return rel(nombre || `${R.nombre} − ${S.nombre}`, R.atributos, R.filas.filter((f) => !enS.has(claveFila(f, R.atributos))));
  }
  function interseccion(R, S, nombre) {
    const enS = new Set(S.filas.map((f) => claveFila(f, R.atributos)));
    return rel(nombre || `${R.nombre} ∩ ${S.nombre}`, R.atributos, R.filas.filter((f) => enS.has(claveFila(f, R.atributos))));
  }
  // R ÷ S: valores de los atributos de R que no están en S y que aparecen combinados con todas las filas de S.
  function division(R, S, nombre) {
    const resto = R.atributos.filter((a) => !S.atributos.includes(a));
    const pares = new Set(R.filas.map((f) => claveFila(f, R.atributos)));
    const candidatos = proyectar(R, resto).filas;
    const filas = candidatos.filter((c) => S.filas.every((s) => pares.has(claveFila({ ...c, ...s }, R.atributos))));
    return rel(nombre || `${R.nombre} ÷ ${S.nombre}`, resto, filas);
  }

  /* ---------- Tablas HTML ---------- */

  // Contenedor de varias tablas lado a lado (se apilan en pantallas angostas).
  const grupoTablas = (padre) => { const e = el('div', { class: 'tablas-bdd' }); padre.appendChild(e); return e; };

  // Dibuja una relación como tabla. o: { titulo, claves: [atributos subrayados], fila(f, i) → color,
  //   celda(f, a, i) → color, tachada(f, i), maxFilas, vacio, atributos }.
  function tabla(R, o = {}) {
    const atr = o.atributos || R.atributos;
    const claves = new Set(o.claves || []);
    const max = o.maxFilas || Infinity;
    const filas = R.filas.slice(0, max);
    const titulo = o.titulo === false ? null
      : el('p', { class: 'tabla-bdd-titulo' }, `${o.titulo || R.nombre} · ${R.filas.length} ${R.filas.length === 1 ? 'fila' : 'filas'}`);
    const cuerpo = filas.map((f, i) => {
      const cf = o.fila && o.fila(f, i);
      const tr = el('tr', { class: o.tachada && o.tachada(f, i) ? 'tachada' : null },
        ...atr.map((a) => {
          const cc = (o.celda && o.celda(f, a, i)) || cf;
          const v = f[a];
          return el('td', { class: v == null ? 'vacia' : null, style: cc ? { background: VIZ.alfa(cc, 0.18) } : null }, v == null ? 'NULL' : String(v));
        }));
      if (o.alPasar) tr.addEventListener('pointerenter', () => o.alPasar(f, i));
      if (o.alClic) { tr.classList.add('clicable'); tr.addEventListener('click', () => o.alClic(f, i)); }
      return tr;
    });
    if (!filas.length) cuerpo.push(el('tr', null, el('td', { class: 'vacia', colspan: atr.length }, o.vacio || '(vacía)')));
    if (R.filas.length > max) cuerpo.push(el('tr', null, el('td', { class: 'vacia', colspan: atr.length }, `… ${R.filas.length - max} ${R.filas.length - max === 1 ? 'fila más' : 'filas más'}`)));
    return el('div', { class: 'tabla-bdd' }, titulo,
      el('table', { class: 'tabla-datos texto' },
        el('tr', null, ...atr.map((a) => el('th', { class: claves.has(a) ? 'clave' : null }, a))),
        ...cuerpo));
  }

  /* ---------- Canvas: páginas, flechas y cajas ---------- */

  function flecha(ctx, x1, y1, x2, y2, color = C.tinta2, ancho = 1.5, punta = 7) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = ancho;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(ang) * punta * 0.6, y2 - Math.sin(ang) * punta * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - punta * Math.cos(ang - 0.4), y2 - punta * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - punta * Math.cos(ang + 0.4), y2 - punta * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
  }

  // Caja con texto centrado. o: { relleno, borde, ancho, tinta, px, peso }
  function caja(ctx, x, y, w, h, texto, o = {}) {
    ctx.fillStyle = o.relleno || C.superficie;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = o.borde || C.tinta;
    ctx.lineWidth = o.ancho || 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (texto != null) {
      ctx.fillStyle = o.tinta || C.tinta;
      ctx.font = VIZ.fuente(o.px || 12, o.peso || 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(texto), x + w / 2, y + h / 2 + 0.5);
    }
  }

  // Página de disco con `items` (cada uno { texto, color }) en filas; devuelve el rectángulo.
  function pagina(ctx, x, y, w, h, items, o = {}) {
    ctx.fillStyle = o.fondo || C.superficie;
    ctx.fillRect(x, y, w, h);
    const filas = o.capacidad || Math.max(1, items.length);
    const fh = h / filas;
    items.forEach((it, i) => {
      if (!it) return;
      if (it.color) { ctx.fillStyle = it.relleno ? it.color : VIZ.alfa(it.color, 0.22); ctx.fillRect(x + 1, y + i * fh + 1, w - 2, fh - 2); }
      ctx.fillStyle = it.relleno ? C.sobre : it.tinta || C.tinta;
      ctx.font = VIZ.fuente(Math.min(12, Math.max(9, fh * 0.62)), 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (fh >= 9) ctx.fillText(String(it.texto), x + w / 2, y + (i + 0.5) * fh + 0.5);
    });
    ctx.strokeStyle = o.borde || C.tinta;
    ctx.lineWidth = o.grosor || 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (o.etiqueta) {
      ctx.fillStyle = o.tintaEtiqueta || C.apagado;
      ctx.font = VIZ.fuente(10);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(o.etiqueta, x + w / 2, y - 3);
    }
    return { x, y, w, h };
  }

  // Texto en canvas con alineación a la izquierda.
  function texto(ctx, t, x, y, o = {}) {
    ctx.fillStyle = o.color || C.tinta2;
    ctx.font = VIZ.fuente(o.px || 11, o.peso || 400);
    ctx.textAlign = o.alinear || 'left';
    ctx.textBaseline = o.base || 'middle';
    ctx.fillText(t, x, y);
  }

  /* ---------- Datos de ejemplo: universidad ---------- */

  function universidad() {
    return {
      alumnos: rel('Alumnos', ['rol', 'nombre', 'carrera', 'ingreso'], [
        [101, 'Ana', 'Informática', 2022], [102, 'Bruno', 'Civil', 2021], [103, 'Carla', 'Informática', 2023],
        [104, 'Diego', 'Eléctrica', 2022], [105, 'Elena', 'Civil', 2023], [106, 'Felipe', 'Informática', 2021],
      ]),
      cursos: rel('Cursos', ['sigla', 'titulo', 'creditos'], [
        ['IIC2413', 'Bases de Datos', 10], ['IIC2133', 'Estructuras de Datos', 10], ['MAT1610', 'Cálculo I', 10], ['IIC3633', 'Privacidad', 5],
      ]),
      inscripciones: rel('Inscripciones', ['rol', 'sigla', 'nota'], [
        [101, 'IIC2413', 6.2], [101, 'IIC2133', 5.5], [102, 'MAT1610', 4.1], [103, 'IIC2413', 6.8], [103, 'IIC3633', 6.0],
        [104, 'IIC2413', 3.9], [104, 'MAT1610', 5.0], [106, 'IIC2133', 6.5], [106, 'IIC2413', 5.8], [106, 'IIC3633', 4.4],
        [106, 'MAT1610', 5.2],
      ]),
    };
  }

  /* ---------- Datos de ejemplo: registros clínicos ---------- */

  // Atributos clasificados: IdE (identificador explícito), CId (cuasi-identificador), AS (sensible), AnS (no sensible).
  const TIPOS_CLINICOS = { nombre: 'IdE', rut: 'IdE', cp: 'CId', edad: 'CId', sexo: 'CId', diagnostico: 'AS', canal: 'AnS' };
  function clinicos() {
    return rel('Pacientes', ['nombre', 'rut', 'cp', 'edad', 'sexo', 'diagnostico', 'canal'], [
      ['Ana Rojas', '12.345.678-5', '7510', 28, 'F', 'Gripe', 'web'],
      ['Bruno Díaz', '9.876.543-2', '7511', 29, 'M', 'Gripe', 'presencial'],
      ['Carla Soto', '15.111.222-3', '7512', 24, 'F', 'Diabetes', 'web'],
      ['Diego Muñoz', '16.222.333-4', '7513', 23, 'M', 'Gripe', 'teléfono'],
      ['Elena Vera', '8.333.444-5', '7520', 47, 'F', 'Cáncer', 'presencial'],
      ['Felipe Lagos', '10.444.555-6', '7521', 41, 'M', 'Hepatitis', 'web'],
      ['Gabriela Paz', '11.555.666-7', '7520', 45, 'F', 'Cáncer', 'teléfono'],
      ['Hugo Pino', '7.666.777-8', '7522', 43, 'M', 'Cáncer', 'presencial'],
      ['Inés Toro', '13.777.888-9', '8320', 35, 'F', 'VIH', 'web'],
      ['Jorge Leiva', '14.888.999-0', '8321', 32, 'M', 'Diabetes', 'presencial'],
      ['Karen Fuentes', '17.999.000-1', '8320', 36, 'F', 'Gripe', 'web'],
      ['Luis Araya', '6.000.111-2', '8322', 39, 'M', 'Hepatitis', 'teléfono'],
    ]);
  }

  // Jerarquías de generalización por atributo: nivel 0 = valor original, último nivel = «*».
  const JERARQUIAS = {
    cp: { niveles: 4, nombres: ['exacto', '751*', '75**', '****'], f: (v, n) => (n >= 3 ? '****' : v.slice(0, 4 - n) + '*'.repeat(n)) },
    edad: {
      niveles: 4, nombres: ['exacta', 'tramo de 5', 'tramo de 10', '*'],
      f: (v, n) => {
        if (n === 0) return v;
        if (n >= 3) return '*';
        const t = n === 1 ? 5 : 10, a = Math.floor(v / t) * t;
        return `${a}–${a + t - 1}`;
      },
    },
    sexo: { niveles: 2, nombres: ['exacto', '*'], f: (v, n) => (n ? '*' : v) },
  };
  const generalizar = (atributo, valor, nivel) => (JERARQUIAS[atributo] ? JERARQUIAS[atributo].f(valor, nivel) : valor);

  // Aplica niveles { cp, edad, sexo } y elimina identificadores explícitos; devuelve una relación nueva.
  function anonimizar(R, niveles, { quitar = ['nombre', 'rut'] } = {}) {
    const atr = R.atributos.filter((a) => !quitar.includes(a));
    return rel(`${R.nombre}*`, atr, R.filas.map((f) => Object.fromEntries(atr.map((a) => [a, niveles[a] != null ? generalizar(a, f[a], niveles[a]) : f[a]]))));
  }

  // Clases de equivalencia según los cuasi-identificadores: lista de { clave, indices }.
  function clases(R, cis) {
    const m = new Map();
    R.filas.forEach((f, i) => {
      const k = cis.map((a) => String(f[a])).join(' · ');
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(i);
    });
    return [...m].map(([clave, indices]) => ({ clave, indices }));
  }
  const kAnonimato = (R, cis) => Math.min(...clases(R, cis).map((c) => c.indices.length));
  function lDiversidad(R, cis, sensible) {
    let distinta = Infinity, entropica = Infinity;
    for (const c of clases(R, cis)) {
      const cuenta = new Map();
      c.indices.forEach((i) => cuenta.set(R.filas[i][sensible], (cuenta.get(R.filas[i][sensible]) || 0) + 1));
      distinta = Math.min(distinta, cuenta.size);
      const n = c.indices.length;
      const H = -[...cuenta.values()].reduce((s, x) => s + (x / n) * Math.log(x / n), 0);
      entropica = Math.min(entropica, Math.exp(H));
    }
    return { distinta, entropica };
  }

  // Muestra de Laplace con escala b.
  const laplace = (rnd, b) => { const u = rnd() - 0.5; return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); };

  VIZ.bdd = {
    rel, sinDuplicados, seleccionar, proyectar, renombrar, producto, juntar, union, diferencia, interseccion, division,
    grupoTablas, tabla, flecha, caja, pagina, texto,
    universidad, clinicos, TIPOS_CLINICOS, JERARQUIAS, generalizar, anonimizar, clases, kAnonimato, lDiversidad, laplace,
  };
})();
