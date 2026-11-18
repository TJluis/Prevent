# Plan de implementación · Mejoras de jugabilidad Club Pingüi

**Fecha:** 17/11/2026
**Base de código:** `C:\Users\tslui\Downloads\Proyecto_ClubPingui\Proyecto_ClubPingui`
**Servidores:** juego 3050 · puerta/menú 3000 (tareas programadas `ClubPingui Servers`)
**Alcance:** 7 mejoras solicitadas tras probar la jugabilidad.

---

## 0. Diagnóstico del código actual

Antes de planear, esto es lo que realmente hace hoy el proyecto (verificado en el código, no supuesto).

### 0.1 Escudo — no es un escudo
| Hecho | Ubicación |
|---|---|
| `escudo` está definido como **arma melee**: `damage: 12`, `range: 2.1`, `arc: 3.3`, `cooldownMs: 450`, `mag: 0` | `public/js/weaponDefs.js:254-267` |
| No existe ningún estado de "bloqueo" en cliente ni servidor (no hay `blocking`, `block`, `shield` fuera del modelo) | `public/js/combat.js`, `server/game.js` |
| El servidor lo trata como melee genérico: cono de `arc`, daño plano | `server/game.js:701-721` |
| El cliente solo reproduce el golpe y pide `shoot` | `public/js/combat.js:699-706` |
| Modelo: rodela pequeña (esfera + toros), animación `bash` | `public/js/viewmodel.js:303-312`, `:617`, `:759-763` |
| Probabilidad de obtenerlo: cristal de arma (60 %) × 1/16 armas ≈ **3,75 % por cristal** | `server/game.js:389-395`, `itemDefs.js:88-93` |

**Conclusión:** el escudo "no funciona" porque **nunca se implementó como escudo**. Es un arma melee de 12 de daño (9 golpes para matar) con un modelo pequeño y baja probabilidad de aparecer. Hay que convertirlo en un objeto con bloqueo real, no "arreglar" un bug.

### 0.2 Objetos de la mochila — funcionan solo a medias
| Hecho | Ubicación |
|---|---|
| `inventory:use` exige `player.roomCode` y `player.alive`; solo comida; **si HP está al máximo retorna en silencio** | `server/game.js:849-866` |
| `inventory:throw` exige sala; usa `roomMembers(room)` | `server/game.js:868-898` |
| `roomMembers(lobbyRoom)` **siempre devuelve vacío** (los del lobby tienen `roomCode = null`, no `"LOBBY"`) | `server/game.js:152-158` |
| `crystal:offer` / `crystal:respond` exigen `player.roomCode` → **en el lobby no se pueden recoger cristales**, aunque el lobby sí genera cristales | `server/game.js:784-847`, `:420-427` |
| En el cliente, combate + inventario + loot se **desactivan fuera de sala privada** | `public/js/main.js:752-755` |
| Ruteo comida/arrojable del cliente es correcto | `public/js/inventory.js:88-94` |
| Sin feedback cuando el servidor rechaza (HP lleno, objeto inválido, sin sala) | `server/game.js:849-866` |
| Riesgo de índice obsoleto si se pulsa F dos veces dentro del throttle (400 ms) | `server/game.js:852` + `public/js/inventory.js:83-94` |

**Conclusión:** no hay un bug único; hay 4 causas acumuladas: (a) si se probó en el lobby, todo está desactivado; (b) curar a HP lleno no hace nada y no avisa; (c) el lobby tiene cristales pero no se pueden tomar; (d) falta feedback. Hay que arreglar las cuatro y añadir pruebas.

### 0.3 Alcance de armas — sin clases ni caída de daño
- Todo el balance vive en `public/js/weaponDefs.js`; `range` se usa igual para melee y para hitscan.
- No hay concepto de clase, ni distancia mínima, ni caída de daño: la pistola hace 12 a 1 m y a 14 m; la escopeta hace 8 × 5 perdigones a 9 m.
- `RAY_RADIUS = 0.7` fijo en cliente y servidor (`combat.js:8`, `game.js:183`).
- Armas actuales: 17 (11 de fuego/especiales + 6 melee). Sin precios ni tienda.

### 0.4 Puntaje y tienda — no existen
- Único marcador del servidor: `hockeyScores` (goles de hockey) → `server/game.js:48`, `:358-366`.
- No hay kills, muertes, rachas ni moneda.
- Las armas solo se obtienen de cristales (`crystal:offer/respond`), no hay compra.

### 0.5 Movimiento — solo 2D
- `WALK_SPEED = 6` (`public/js/main.js:84`); sin sprint, salto ni deslizamiento.
- Movimiento en `x/z` con colisiones 2D (`public/js/collision.js:5-41`); la altura sale del terreno + bob (`main.js:1140-1143`, `:1195-1198`).
- El servidor valida saltos de hasta 2,5 m por envío (50 ms) (`server/game.js:618-639`).
- Animación: `animateAvatar(group, now, dt, isMoving)` — sin poses de salto/slide (`public/js/avatar.js:620-679`).

### 0.6 Recarga — estado lógico, sin animación
- `startReload()` / `finishReload()` solo cambian un booleano y el texto del botón (`public/js/combat.js:357-373`).
- El viewmodel no tiene pose de recarga (`public/js/viewmodel.js:676-769`).
- Sonido de recarga ya existe (`combat.js:100-104`).

### 0.7 Imagen del servidor — existe pero está huérfana
- `assets/11dcffba10c84f61a2abea46a917bcef.jpeg` (1920×1080, 54 KB) está en la **raíz** `assets/`, no en `public/`, así que **no se sirve** (`server/index.js:30` sirve solo `public/`).
- No está referenciada en ningún HTML/CSS.
- El login usa el emoji 🐧 (`public/index.html:24-27`) y el favicon está desactivado: `<link rel="icon" href="data:,">` (`index.html:6`).
- El menú `/menu` usa emoji en la tarjeta (`server/redirect-server.js:41-46`).

### 0.8 Deuda técnica que afecta al plan
- **Los tests apuntan a otra carpeta:** `C:/xampp/htdocs/Proyecto_ClubPingui` (`public/test/t-servidor.mjs:8`, `t-auth.mjs:8`, `t-logica.mjs:4`, `opencode-loader.mjs:14`). Hoy ambas copias son idénticas, pero cualquier cambio en la carpeta de trabajo **no sería probado**. Hay que hacerlos relativos al archivo de test.
- `t-aletasdiff.mjs:26` y `t-tuningcheck.mjs:27` apuntan a `C:\Users\CINTHIA TOVAR\...` (no existe en este equipo).
- No hay `git` instalado ni script de respaldo; `.git` existe pero sin herramienta para usarlo.

---

## 1. Principios de implementación

1. **Servidor autoritativo** para daño, puntaje, compras, bloqueo y stamina. El cliente solo predice efectos visuales.
2. **Módulos puros compartidos** (`public/js/*Math.js`) para que las mismas fórmulas corran en cliente y servidor y se puedan testear sin navegador.
3. **Sin build step**: se mantiene el uso de ES modules directos. Nada de bundler.
4. **Cambios aditivos**: no romper cristales, hockey, chat, salas ni datos existentes (13 usuarios / 39 mensajes).
5. **Cada fase termina con tests verdes + prueba manual**, y es desplegable por separado.

---

## 2. Fases

Orden recomendado: **0 → 6 → 1 → 2 → 3 → 5 → 4**.
(6 es rápido e independiente; 2 define los precios que necesita 3; 5 usa los `reloadMs` de 2; 4 es la más delicada y va al final.)

---

### Fase 0 · Red de seguridad (0,5 día)

**Objetivo:** poder cambiar código sin miedo y que los tests prueben la copia correcta.

| Tarea | Archivos |
|---|---|
| Hacer relativas las rutas de test (`path.resolve(__dirname, "..", "..")` con `import.meta.url`) | `public/test/t-servidor.mjs:8`, `t-auth.mjs:8`, `t-logica.mjs:4`, `opencode-loader.mjs:14` |
| Quitar rutas de `CINTHIA TOVAR`; usar `os.tmpdir()` | `t-aletasdiff.mjs:26`, `t-tuningcheck.mjs:27` |
| Script de respaldo (zip de `public/ server/ docs/ scripts/` sin `node_modules` ni `data`) | `scripts/backup-proyecto.ps1` (nuevo) |
| Comando único de pruebas | `scripts/test-all.ps1` (nuevo) |
| Documentar el flujo (arrancar, probar, respaldar) | `docs/` |

**DoD:** `scripts\test-all.ps1` pasa (t-logica 7/7, t-auth 7/7, t-servidor 20/20) desde la carpeta de trabajo; respaldo generado.

> ✅ **Completada el 17/11/2026.** Tests relativos a `import.meta.url`, `opencode-loader.mjs` con raíz dinámica, `TUNER_OUT`/`TUNER_ESPERADO` con `SKIP` si faltan, `scripts/backup-proyecto.ps1`, `scripts/test-all.ps1` (exit 0) y `docs/GUIA_DESARROLLO.md`. Verificado: 7/7, 7/7 y 20/20. Respaldo: `backups\clubpingui_20261117_183627.zip`.

---

### Fase 6 · Imagen representativa del servidor (0,5 día)

**Objetivo:** que el servidor tenga identidad visual (login, menú, favicon y preview al compartir).

| Tarea | Archivos |
|---|---|
| Copiar/optimizar `assets/11dcffba…jpeg` → `public/assets/server-card.jpg` (1600×900, <300 KB) + `.webp` | `public/assets/` |
| Banner en la tarjeta de login (con `onerror` que lo oculta y deja el emoji) | `public/index.html:22-30`, `public/css/style.css` (`#join-card`, `:202`) |
| Miniatura en la tarjeta "Club Pingüi" del menú `/menu` (funciona a través del proxy) | `server/redirect-server.js:41-46` |
| Favicon real + `apple-touch-icon` + `manifest.webmanifest` | `public/index.html:6`, `public/assets/icons/` |
| Meta Open Graph/Twitter con URL absoluta (`https://pinguidev.corvet.dpdns.org/assets/server-card.jpg`) | `public/index.html` `<head>` |
| Cache de estáticos (`maxAge: "7d"` solo para `/assets`) | `server/index.js:30` |

**DoD:** la imagen se ve en `/` y `/menu`, el favicon aparece en la pestaña, y el preview del enlace muestra la imagen.

> ✅ **Completada el 17/11/2026.** `scripts\make-server-assets.ps1` genera `public\assets\server-card.jpg` (1600×900, 48,9 KB) y los iconos 32/180/192/512 desde el JPEG original. Banner en el login, miniatura con fallback 🐧 en `/menu`, favicon + `apple-touch-icon` + `manifest.webmanifest`, metadatos Open Graph/Twitter con URL absoluta y caché de 7 días solo para `/assets`. Verificado en navegador (imagen 1600×900 cargada, sin errores) y con `t-assets.mjs` (10/10).
>
> ⚠️ **WebP omitido:** este equipo no tiene ImageMagick, ffmpeg ni `sharp`; el JPEG de 48,9 KB ya cumple el objetivo (<300 KB). Si se añade un codificador, generar `server-card.webp` y servirlo con `<picture>`.
> ⚠️ **Preview externo:** las URLs de Open Graph apuntan a `https://pinguidev.corvet.dpdns.org/…`. El túnel ya funciona como servicio de Windows y el dominio responde **200**, así que el preview externo está operativo.

> ✅ Confirmado: se usa `assets/11dcffba…jpeg` en las **cuatro** ubicaciones (banner de login, miniatura de `/menu`, favicon e imagen de preview).

---

### Fase 1 · Mochila y escudo (2,25 días)

#### 1.0 Recoger cristales con Enter (0,25 día)

**Objetivo:** aceptar la oferta del cristal sin usar el ratón.

- `public/js/loot.js`: nueva función `acceptOffer()` que, si hay una oferta visible (`pendingOfferId` + panel no oculto), llama a `respond(true)` y devuelve `true`; si no, `false`. Se exporta en el objeto que devuelve `createLoot()`.
- `public/js/main.js` (keydown, ~163-180): con `Enter` y sin estar escribiendo, **primero** se intenta `loot.acceptOffer()`; solo si no hay oferta se enfoca el chat.
- El texto del botón muestra el atajo: `⚡ Equipar Arma (Enter)` / `🔄 Equipar / Cambiar (Enter)`.
- El panel sigue apareciendo solo al acercarse (≤1,4 m) y expira a los 8 s; Enter nunca recoge un cristal lejano.
- En móvil no cambia nada: se mantiene el botón táctil.

**DoD:** al acercarse a un cristal, pulsar `Enter` equipa el arma/objeto y el panel se cierra; con el chat enfocado, `Enter` sigue enviando el mensaje.

**Test:** `public/test/t-loot.mjs` (nuevo, 7/7): sin oferta `acceptOffer()` es `false`; cerca se pide la oferta; con oferta acepta y responde `{id, accept:true}`; no re-pide el cristal aceptado; un cristal lejano no se ofrece.

#### 1.1 Objetos (0,5–1 día)

**Política decidida:** el **lobby es social** (hockey, chat, vestidor) y **no tiene cristales**; las salas privadas son la única zona con cristales y objetos lanzables. La **comida sí se puede usar en el lobby** para curarse (no hay combate, así que no es una ventaja), y los **lanzables solo dentro de una sala**.

**Servidor (`server/game.js`):**
1. **Lobby sin cristales:** se eliminó `lobbyRoom` y su spawn. `crystalTick()` recorre solo `rooms.values()`, `broadcastCrystals()` emite siempre a `room:<código>` y `moveSocketToLobby()` envía `crystal:state {crystals: []}` para limpiar el cliente.
2. **`inventory:use`** (comida en sala **y** lobby) con `inventory:toast` en todos los rechazos:
   - muerto → `"Estás eliminado: espera a reaparecer"`
   - slot fuera de rango → `"Ese espacio está vacío"`
   - objeto desincronizado (`{slot,id,type}` no coincide) → reenvía `inventory:update` y avisa `"El inventario cambió. Inténtalo de nuevo."`
   - no es comida / definición inexistente → `"Ese objeto no se puede comer"` / `"Ese objeto no se puede usar"`
   - HP al máximo → `"Ya tienes la vida al máximo"` (no consume)
3. **`inventory:throw`** (solo sala): fuera de sala → `"Entra a una sala para lanzar objetos"`; también avisa de slot vacío, desincronización, objeto no lanzable, cooldown y dirección inválida.
4. **`crystal:offer`** emite `crystal:error` con motivo (`"Entra a una sala para recoger objetos"`, `"Acércate más al cristal"`, `"Ese cristal ya no está disponible"`).

**Cliente:**
- `inventory.js` pasa el objeto a `onUse(slot, item)` / `onThrow(slot, item)`.
- `network.js` envía `{slot, id, type}` y conecta `crystal:error`.
- `main.js`: la barra de objetos está **siempre visible en partida** (también en el lobby); comer funciona en lobby, lanzar muestra el aviso del servidor. Los avisos de inventario y los errores de cristal se muestran con `showToast` (además del historial del chat); `crystal:error` llama a `loot.rejectAsk()` para no repetir la petición.
- En móvil, **✋ usar** y **🎒 objetos** ya funcionan en el lobby; recargar y vista en 1.ª persona siguen siendo de sala.
- Ayuda del juego (`index.html`) actualizada: comida en lobby, lanzables solo en salas, cristales solo en salas.

**Tests (`t-servidor.mjs`, 22/22):**
- salir de sala envía `crystal:state` vacío al lobby;
- comer con HP lleno → aviso y no consume;
- slot vacío → aviso;
- objeto desincronizado → aviso + `inventory:update`;
- comer herido en el lobby → `combat:heal` al canal `lobby`;
- comer herido en sala → `combat:heal` al canal `room:*`;
- lanzar en el lobby → sin `item:spawn` y con aviso;
- pedir cristal desde el lobby → `crystal:error`.

**DoD:** los casos pasan, en partida se ve el aviso al curarse lleno y el lobby ya no muestra cristales.

> ✅ **Completada el 17/11/2026.** `t-servidor` 22/22 y suite completa en verde; verificado en navegador: barra de 5 huecos visible en el lobby, toasts reales del servidor (`"Ese espacio está vacío"`, `"Entra a una sala para lanzar objetos"`) y cero errores de consola.

#### 1.2 Escudo real (1–1,5 días)

**Diseño confirmado: bloqueo total con aguante.**
- Sigue siendo `kind: "melee"` para el golpe, pero gana un bloqueo frontal **que anula el 100 % del daño** mientras quede aguante.
- `weaponDefs.js`:
  ```js
  escudo: {
    // ...existente
    damage: 18, range: 2.2, arc: 1.9, cooldownMs: 700,
    block: { reduction: 1.0, arc: 2.4, staminaDrain: 28, moveScale: 0.55, breakMs: 1200 },
  }
  ```
- **Cliente:** mantener clic derecho (en 1.ª persona) o `Q` (en 3.ª persona, porque el clic derecho ya arrastra la cámara: `main.js:514-518`) → `combat:block {on:true|false}`. HUD con barra de "aguante" del escudo. Pose de bloqueo en el viewmodel (subir el escudo al pecho). Clic izquierdo mientras bloqueas = bash.
- **Servidor:** `player.blocking`, `player.blockStamina` (0-100). Validar que el arma sea `escudo`. En `damageTarget`:
  ```js
  const blocked = target.blocking && target.blockStamina > 0 &&
    frontDot(target, shooter) >= Math.cos(block.arc / 2);
  const dmg = blocked ? 0 : damage;   // bloqueo total
  ```
  Si el aguante llega a 0 → **guard break**: `blocking = false`, no puede volver a bloquear durante `breakMs` (1,2 s) y recibe daño normal. Regenerar aguante (14/s tras 600 ms sin bloquear) en el tick existente de 100 ms.
- **Contrapesos (para que el bloqueo total no sea invencible):**
  - 100 de aguante a 28/s ≈ **3,6 s** de bloqueo continuo.
  - Bloquear **impide disparar** y reduce la velocidad al 55 %.
  - El bloqueo solo cubre el **arco frontal de 2,4 rad** (≈ 137°); por la espalda entra daño completo.
  - Tras el guard break hay 1,2 s de vulnerabilidad total.
- **Eventos nuevos:** `combat:block` (C→S), `combat:blocked {targetId, x, z, damage, guardBreak}` (S→C) para chispas/sonido.
- **Modelo:** rehacer el escudo como escudo redondo visible (plano/cilindro grueso, `THREE.DoubleSide`; `mat()` en `viewmodel.js:68-77` no define `side`).
- **Balance:** aparece con más frecuencia (peso propio en `randomCrystalWeapon`) y precio de tienda bajo (Fase 3).

**Tests:**
- `t-combate.mjs` (nuevo): `computeBlockedDamage()` puro → 100 % anulado de frente, 0 % anulado de espaldas, 0 % anulado si aguante 0 o durante guard break.
- `t-servidor.mjs`: bloqueo válido anula el daño; sin escudo no se puede bloquear; guard break desactiva el bloqueo 1,2 s; bloquear impide `combat:shoot`.

**DoD:** con escudo equipado, mantener bloqueo anula el daño frontal mientras quede aguante, lo consume y al agotarse deja 1,2 s de vulnerabilidad; el modelo se ve en 1.ª y 3.ª persona; golpe bash hace daño.

> ✅ **Completada el 17/11/2026.** `t-combate` 18/18 y `t-servidor` 33/33 (tests 20–29 y 21b). Verificado en navegador: Q mantiene el bloqueo y el aguante baja de 100 a 0 en ~3,6 s; HUD con `ROTO` y toast al romperse; velocidad 55 % (5,40 m → 2,97 m en el mismo tiempo); soltar y volver a pulsar reactiva el escudo; un segundo jugador ve el escudo levantado (`remoteGun.rotation.x = -0,45`).
>
> **Ajustes surgidos de la verificación:**
> - El keepalive del escudo ya no depende de `requestAnimationFrame`: un `setInterval` de 140 ms lo reenvía y vuelve a levantar el escudo si el servidor lo cortó por un hueco de red. El margen del servidor pasó de 450 ms a **1200 ms**.
> - Tras un guard break hay que **soltar y volver a pulsar**: `blockSuppressed` evita que el keepalive levante el escudo con 1 de aguante en bucle. El servidor tampoco alarga el castigo si el cliente reintenta durante el mismo.
> - Los reintentos durante el guard break son idempotentes en el servidor (`blockBrokenUntil` no se reinicia).
> - Al entrar en una sala, las armas de los jugadores que ya estaban se aplican tras `room:state` (el `welcome` llega antes y `myRoom` aún era `null`), así se ven sus escudos/armas y la pose de bloqueo.

---

### Fase 2 · Alcance por clase + armas nuevas (3 días)

#### 2.1 Clases y caída de daño

Nuevo módulo puro `public/js/weaponMath.js`:

```js
export const WEAPON_CLASSES = {
  melee:    { label: "Cuerpo a cuerpo", min: 1.8, max: 3.4 },
  sidearm:  { label: "Pistola",         min: 10,  max: 16 },
  smg:      { label: "Subfusil",        min: 10,  max: 14 },
  shotgun:  { label: "Escopeta",        min: 6,   max: 10 },
  rifle:    { label: "Rifle",           min: 16,  max: 26 },
  marksman: { label: "Precisión",       min: 26,  max: 42 },
  heavy:    { label: "Pesada",          min: 8,   max: 16 },
  launcher: { label: "Lanzagranadas",   min: 14,  max: 20 },
  special:  { label: "Especial",        min: 16,  max: 26 },
};

export function damageAtRange(weapon, dist) {
  const { rangeMin = 0, range, falloff = 1 } = weapon;
  if (dist <= rangeMin) return weapon.damage;
  if (dist >= range) return weapon.damage * falloff;
  const t = (dist - rangeMin) / (range - rangeMin);
  return weapon.damage * (1 - t * (1 - falloff));
}
```

- Añadir a cada arma: `class`, `rangeMin`, `falloff`, `price`.
- Servidor: reemplazar `weapon.damage` por `damageAtRange(weapon, dist)` en el bloque melee, splash y pellets (`server/game.js:701-781`).
- Cliente: usar `damageAtRange` solo para predicción/feedback (no autoridad).
- Escopeta: `falloff` agresivo (0,3) para que no sea francotirador.
- `RAY_RADIUS` por clase: `0.7` está bien; opcional `0.55` para marksman y `0.9` para escopeta.
- **Ajuste de implementación:** `heavy.min` baja de 10 a **8** para que el lanzallamas (8 m en la tabla) quede dentro de su propia clase.

#### 2.2 Tabla de rebalanceo (valores propuestos)

| Arma | Clase | Daño | rangeMin | range | falloff | Cadencia | Cargador | Precio |
|---|---|---|---|---|---|---|---|---|
| pistola | sidearm | 12 | 8 | 14 | 0.70 | 400 | 16 | 0 (gratis) |
| revolver *(nueva)* | sidearm | 30 | 9 | 15 | 0.75 | 520 | 6 | 900 |
| smg | smg | 7 | 6 | 13 | 0.55 | 150 | 32 | 600 |
| assault | rifle | 10 | 12 | 22 | 0.80 | 190 | 30 | 1200 |
| dmr *(nueva)* | marksman | 26 | 18 | 30 | 0.90 | 380 | 12 | 1800 |
| shotgun | shotgun | 8×5 | 4 | 9 | 0.30 | 800 | 6 | 900 |
| sniper | marksman | 55 | 25 | 38 | 0.95 | 1500 | 4 | 2200 |
| granade | launcher | 42 | — | 18 | — | 900 | 2 | 1600 |
| plasma | special | 45 | 14 | 22 | 0.85 | 1000 | 6 | 2000 |
| minigun | heavy | 8 | 9 | 16 | 0.60 | 130 | 80 | 2400 |
| llama | heavy | 6×3 | 3 | 8 | 0.45 | 260 | 50 | 1400 |
| laser | special | 14 | 12 | 20 | 0.90 | 150 | ∞ | 2600 |
| arco | special | 26 | 10 | 24 | 0.90 | 700 | 14 | 1100 |
| daga | melee | 20 | — | 2.0 | — | 320 | ∞ | 300 |
| espada | melee | 34 | — | 2.6 | — | 600 | ∞ | 800 |
| hacha | melee | 48 | — | 2.4 | — | 800 | ∞ | 900 |
| maza | melee | 42 | — | 2.4 | — | 700 | ∞ | 1000 |
| lanza | melee | 36 | — | 3.2 | — | 550 | ∞ | 1200 |
| escudo | melee | 18 | — | 2.2 | — | 700 | ∞ | 500 |
| martillo *(nueva)* | melee | 58 | — | 2.8 | — | 950 | ∞ | 700 |
| ballesta *(nueva)* | special | 48 | 15 | 26 | 0.90 | 900 | 5 | 1500 |

**Armas nuevas (4):** `revolver`, `dmr`, `martillo`, `ballesta`.
Cada una necesita: entrada en `WEAPONS`, entrada en `WEAPON_PARTS` (`viewmodel.js`), sonido, color y `price`. No hace falta geometría nueva: se reutilizan tipos de pieza existentes.
**Obtención (confirmado):** las 4 se venden en la tienda y además entran al pool de cristales (`randomCrystalWeapon`, `game.js:389`). Ninguna queda exclusiva de la tienda; comprar solo ahorra la espera del cristal.

#### 2.3 Validación automática
Nuevo `public/test/t-armas.mjs`:
- todo `id` único y `price > 0` (excepto pistola);
- `range` dentro de `[class.min, class.max]`;
- melee sin `pellets`; armas de fuego con `mag > 0` y `reloadMs > 0`;
- `falloff` en `(0, 1]`; `rangeMin < range`;
- `escudo.block` coherente.

**DoD:** `t-armas.mjs` verde, `t-armasbase.mjs` sigue midiendo las geometrías sin cambios inesperados, y las armas nuevas se ven y disparan en partida.

> ✅ **Completada el 17/11/2026.** `weaponMath.js` con clases, `damageAtRange` y radio por clase; las 21 armas tienen `class`, `rangeMin`, `falloff` y `price`. Servidor autoritativo aplicando la caída en melee, splash (por distancia al impacto) y perdigones. Cliente usa la misma matemática para predicción y el radio de impacto. Las 4 armas nuevas (`revolver`, `dmr`, `martillo`, `ballesta`) tienen modelo, sonido, precio y entran en el pool de cristales. `t-armas` 13/13 y `t-servidor` 34/34 (nuevo test 30: ballesta forzada por cristal, equipada y daño con caída a ~18 m). Verificado en navegador: los 4 modelos se construyen, se equipan y disparan sin errores de consola.

---

### Fase 3 · Puntaje y tienda dentro de salas (4 días)

#### 3.1 Modelo de datos

**Servidor (en memoria, por conexión):**
```js
player.score = 0;        // gastable en la tienda
player.kills = 0;
player.deaths = 0;
player.streak = 0;
player.lastHitBy = new Map(); // idAtacante -> timestamp (asistencias)
```

**Persistencia (opcional pero recomendada) — `server/db.js`:**
```sql
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  score_total INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
`CREATE TABLE IF NOT EXISTS` = migración segura con los 13 usuarios existentes.

#### 3.2 Reglas de puntaje (recomendadas)

| Acción | Puntos |
|---|---|
| Eliminar | +100 |
| Asistencia (daño en los últimos 6 s) | +40 |
| Racha: 2.ª baja seguida | +25 extra |
| Racha: 3.ª y siguientes | +50 extra (máx. +100) |
| Morir | 0 (reinicia racha) |
| Suicidio / caída | −25 (opcional) |

Anti-farmeo: mismo objetivo repetido dentro de 60 s → puntos de baja reducidos al 50 %.
Economía: una kill ≈ 100 puntos; armas medias 600–1200 (≈ 6–12 bajas).

**Eventos:**
- `score:update {playerId, score, kills, deaths, streak, delta, reason}` → a la zona.
- `score:state {players:[{id,name,score,kills,deaths}]}` → al entrar/cambiar de sala.
- Incluir `score/kills/deaths` en `playerSnapshot()` (`game.js:207-219`).

**HUD:** marcador propio junto a HP + tabla de los 5 mejores (tecla `Tab` o panel lateral). Reutilizar el patrón de `makeHud()` (`combat.js:242-291`).

#### 3.3 Tienda

**Servidor:**
```js
socket.on("shop:buy", ({ weaponId }) => {
  // validaciones: sala privada, vivo, arma existe, price > 0, score suficiente,
  // no es la que ya tengo, throttle
  player.score -= price;
  player.weaponId = weaponId;
  io.to(zone).emit("crystal:equip", { playerId, weaponId });
  socket.emit("shop:result", { ok: true, weaponId, score: player.score });
});
```
- La tienda **solo dentro de salas** (requisito).
- Si no alcanza: `{ok:false, reason:"score"}` y no se descuenta nada.
- Si ya tiene el arma: re-equipar gratis o `{ok:false, reason:"owned"}` (recomendado: re-equipar gratis).
- El cliente nunca envía precios.

**Cliente:** nuevo `public/js/shop.js` + panel `#shop-panel` en `index.html` + estilos en `style.css`.
- Catálogo derivado de `WEAPONS` (sin duplicar datos), agrupado por clase.
- Cada tarjeta: nombre, clase, daño, alcance, precio, estado (comprar / equipada / sin puntos).
- Abrir con `B` y con un botón dentro del panel de sala; cerrar con `Escape`.
- Móvil: hoja a pantalla completa; comprobar 360×640.

**Tests (`t-servidor.mjs`):**
- comprar sin sala → rechazo;
- comprar sin puntos → rechazo y score intacto;
- comprar con puntos → descuenta, equipa y emite `crystal:equip`;
- matar → +100, muerte → racha 0, asistencia → +40;
- mismo objetivo dos veces en <60 s → puntos reducidos.

**DoD:** en una sala de 2 jugadores se ven los puntos subir al matar, la tienda abre, compra y equipa, y el saldo baja correctamente.

> ✅ **Completada el 17/11/2026.** Puntaje autoritativo en `server/game.js` (`score/kills/deaths/streak`, anti-farmeo de 60 s, asistencias de 6 s, rachas de 2.ª y 3.ª+ baja) y persistencia en `user_stats` (`server/db.js`). Eventos `score:state`, `score:update` y `score:profile`; HUD de puntos, marcador con `Tab` (`public/js/scoreboard.js`) y tienda con `B` o botón de sala (`public/js/shop.js`). La tienda vende las 21 armas dentro de salas, descuenta en el servidor y reequipar el arma actual es gratis; los cristales siguen siendo la vía gratuita aleatoria. `t-servidor` 43/43 (tests 31–36: sin sala, sin puntos, compra/equipado/descuento, reequipar gratis, bajas/racha/muerte, asistencia +40, anti-farmeo y su caducidad, y muerto no compra; tests 37–39: persistencia y orden del historial en `user_stats`). Verificado en navegador con 3 bots en fila: 3 bajas → 325 pts, compra de la daga por 300 → 25 pts y arma equipada, tabla con `Tab` (mantener/cerrar), tienda con `B` y `Escape`, y cero errores de consola.

---

### Fase 5 · Animaciones de recarga (2 días)

**Viewmodel (`public/js/viewmodel.js`):**
- Añadir `vm.startReload(ms)`, `vm.endReload()`, `vm.reloadStart`, `vm.reloadDur`.
- Pose procedural durante la recarga (sin animar piezas sueltas):
  ```js
  const rp = clamp01((now - vm.reloadStart) / vm.reloadDur);
  const k = Math.sin(rp * Math.PI);
  group.position.y -= 0.09 * k;
  group.rotation.x += 0.50 * k;
  group.rotation.z += 0.35 * k;
  // la aleta izquierda viaja al cargador y vuelve
  ```
- Estilos por arma: `mag` (pistola/smg/rifle/dmr), `shell` (escopeta: 3 pulsos), `bolt` (sniper: cerrojo), `spin` (minigun), `none` (melee/laser).
- `FIRE_MS` y `fireStyle` ya existen (`viewmodel.js:507-514`, `:613-620`); se añade `reloadStyle`.

**Conexión (`combat.js` + `main.js`):**
- `createCombat()` recibe `onReloadStart(weapon)` / `onReloadEnd()`; `startReload()` (`combat.js:357`) los llama.
- `main.js:601-604` ya pasa `onOwnFire`; se añaden los dos callbacks a `viewRig`.
- Anillo de progreso en el botón `#reload-btn` (usar `reloadEnd` en `combat.update()`).
- Cancelar animación al cambiar de arma (`setWeapon`, `combat.js:411`), morir o recargar de nuevo.

**Tercera persona (opcional, +0,5 día):**
- `combat:reload {weaponId, ms}` C→S (rate-limit 2/s) → `combat:reloading {playerId, weaponId, ms}` S→C; inclinar el arma del remoto.

**Tests:** `reloadProgress()` puro (0→1, clamp) + checklist visual por estilo.

**DoD:** cada arma tiene una recarga visible y distinta; el HUD muestra el progreso; nada queda "atorado" al cambiar de arma.

> ✅ **Completada el 17/11/2026.** `viewmodel.js` expone `startReload(ms)`, `endReload()` y la función pura `reloadProgress()`; la pose procedural usa los estilos `mag` (pistolas/fusiles), `shell` (escopeta, 3 pulsos), `bolt` (francotirador/arco/ballesta), `spin` (minigun) y `none` (melee/láser). `combat.js` avisa con `onReloadStart`/`onReloadEnd`, cancela la recarga al cambiar de arma, morir o salir del combate, y pinta el anillo de progreso (`--reload`) en `#reload-btn`. `t-armas` 13/13 (tests de estilo y de `reloadProgress`). Verificado en navegador en 1.ª persona: pistola, escopeta, francotirador, minigun y láser; anillo 0→100→0, ammo rellenada al terminar, cancelación correcta y cero errores de consola.

---

### Fase 4 · Salto, sprint y deslizamiento (3 días)

**Nuevo módulo puro `public/js/motion.js`:**
```js
export const MOTION = {
  gravity: 22, jumpV: 7.2, sprintMult: 1.55,
  slideMult: 1.8, slideMs: 550, slideCooldownMs: 800,
  staminaMax: 100, sprintDrain: 18, regen: 14, regenDelayMs: 600, slideCost: 25,
};
export function stepMotion(state, input, dt) { /* devuelve {y, vy, speedMult, sprinting, sliding, jumping, stamina} */ }
```

**Cliente (`main.js`):**
- Estado: `playerY`, `vy`, `grounded`, `stamina`, `slidingUntil`, `slideCooldownUntil`.
- Teclas: `Shift` = sprint (mantener), `Space` = salto, `C` o `Ctrl` = deslizarse (solo si sprintando).
- **Conflicto a resolver:** hoy `Space` dispara (`main.js:173-175`). Pasa a ser salto; disparar queda en clic izquierdo (ya funciona, `main.js:519-521`). Actualizar el texto de ayuda en `index.html`.
- Física: `y` = terreno + salto; aterrizar con `y <= 0`.
- Sprint: ×1,55 con stamina; slide: ×1,8 durante 550 ms y luego decae; el slide cuesta 25 de stamina.
- Cámara/avatar: `myAvatar.position.y = terreno + playerY + bob`; FOV +6 suave al sprintar.
- Colisiones siguen 2D (`collision.js`): el salto es cosmético y **no** sirve para esquivar balas (el combate es 2D). Documentarlo.

**Servidor (`server/game.js:618-639`):**
- Aceptar `{x, z, y}` con `y` limitado a `[0, 3]`; **ignorar `y` para el combate**.
- Reenviar `y`, `sprint`, `slide` en `player:moved` para animar a los remotos.
- Mantener el límite de 2,5 m por envío: a 11 m/s son 0,55 m cada 50 ms → seguro.

**Animación (`avatar.js:620`):**
- Extender a `animateAvatar(group, now, dt, isMoving, pose = {})`.
- `jump`: alas arriba, cuerpo estirado; `slide`: inclinación ~1,1 rad y altura reducida; `sprint`: ciclo más rápido y amplitud mayor; `block`: escudo al frente.
- Actualizar las 2 llamadas en `main.js:1143` y `:1161`.

**Móvil (`touch.js`):** botones `#t-jump`, `#t-sprint` (interruptor: tocar para activar/desactivar) y `#t-slide`; añadir al layout táctil y comprobar que no tapan el joystick ni el botón de disparo.

**Tests (`t-movimiento.mjs`):** altura máxima ≈ 1,18 m; no hay doble salto; sprint consume y regenera stamina; slide dura 550 ms y respeta cooldown; `y` nunca < 0.

**DoD:** se salta, sprintar y deslizarse con teclado y móvil; los demás jugadores ven la animación; el servidor rechaza posiciones imposibles.

> ✅ **Completada el 17/11/2026.** Nuevo módulo puro `public/js/motion.js` (`MOTION`, `createMotionState`, `stepMotion`) con gravedad 22, salto 7,2 m/s (~1,18 m de altura), sprint ×1,55 con stamina 100 (consumo 18/s, regeneración 14/s tras 600 ms) y deslizamiento ×1,8 durante 550 ms con 800 ms de cooldown y coste de 25. En el cliente `Shift` corre, `Espacio` salta y `C`/`Ctrl` se desliza solo corriendo; el salto es **cosmético** y no esquiva balas (el combate sigue siendo 2D). El servidor acepta `y` acotada a `[0, 3]` y retransmite `y`, `sprint` y `slide` en `player:moved`; `animateAvatar` recibe una pose (`jumping`, `sprinting`, `sliding`) y los remotos interpolan la altura. Móvil: botones `🦘`, `💨` (mantener) y `🛷` sobre el joystick, sin tapar el joystick ni el disparo. `t-movimiento` 7/7 y `t-servidor` 44/44 (test 07b: acotado y retransmisión). Verificado en navegador: 6,00 m/s andando, 9,30 m/s con sprint (×1,55), deslizamiento a 10,8 m/s durante ~550 ms, salto de ~1,1 m y un segundo jugador viendo `targetY`, `sprint`, `slide` y las poses (`rotX` -0,12 salto, -0,95 slide, 0,18 sprint).

> 🔧 **Ajustes 4.1 (18/11/2026).** Barra de resistencia fina sobre el inventario (`#motion-stamina`): aparece al bajar de 100 y se desvanece al llenarse, con colores lima → ámbar → rojo y posición adaptada en salas (`body.in-room`). Correr contra una pared ya no gasta stamina: `stepMotion` recibe `blocked` y `main.js` lo calcula comparando el avance real con el pedido. Abrir la tienda o el marcador bloquea también salto y deslizamiento (`uiOpen` incluye `shop.isOpen()` y `scoreboard.isOpen()`). Sprint móvil pasa a interruptor (`click` + `aria-pressed`; se apaga al morir). FOV +6 suave al sprintar. Servidor: presupuesto anti-speed-hack de 13 m/s que recorta el exceso (tope duro 2,5 m por envío) en lugar de descartar el paquete. `t-movimiento` 8/8 y `t-servidor` 45/45 (test 07c: recorte del presupuesto).

> 🔧 **Ajustes 4.2 (18/11/2026).** Revisión visual y ampliación de mapas. (1) **Inventario fuera del lobby:** `body:not(.in-room) .item-bar` y `#t-inv` se ocultan por completo (también en móvil); las teclas 1-5 y F siguen funcionando y la barra de resistencia baja a `bottom:64px`. (2) **Panel de sala colapsable:** botón `#room-info-toggle` (▾/▸) junto al título; al colapsar se oculta `#room-place` y el título pasa a `Nombre (CÓDIGO)`, con `aria-expanded`/`aria-label`. El estado se reinicia al entrar o salir de una sala, no al cambiar de anfitrión. (3) **Mapas de sala a 120 m** (selva, desierto, volcán, pradera, ciudad, gruta): el suelo escala textura, niebla y sombras; la vegetación decorativa duplica su densidad y la cúpula de la gruta acompaña el tamaño. (4) **Nuevo `public/js/mapObstacles.js`**, módulo puro compartido cliente/servidor, con 60/64/50/50/48/52 coberturas diseñadas con principios PVP (anillos, tres carriles, coberturas escalonadas, simetría 180° y plaza central libre). (5) **Servidor:** `randomCrystalSpot` descarta puntos dentro de obstáculos (1,1 m de margen) y `clearRoomSpawn()` hace aparecer al jugador en el anillo central libre. `MAP_LOOT_COUNTS` sube a 6-9 en los mapas grandes. (6) **Tests:** el runner de `t-logica` ejecuta de verdad los callbacks (antes guardaba la función y daba falsos positivos), se corrigen `b.x`→`b` y `DEFAULT_WEAPON_ID`→`WEAPON_DEFAULT_ID`, `rollCrystalType` se prueba de forma determinista y se añade el test de mapas/coberturas → **8/8**; `t-servidor` 45/45 con spawn libre de coberturas; suite completa en verde. Verificado en navegador: lobby sin inventario, toggle del panel y los seis mapas a 120 m con sus coberturas, sin errores de consola.

> 🔧 **Ajustes 4.3 (18/11/2026).** Reorganización del HUD. (1) **Menú ☰ arriba a la izquierda:** `#menu-btn` sale de `.header-actions` y pasa a ser hijo directo de `#game` con `.corner-btn` (`left:14px; top:14px`; táctil `8px`). El menú (`#mobile-menu`) se ancla arriba a la izquierda con origen `top left`, `max-height` y scroll, y ahora contiene **Salas, Jugadores, Chat**, un separador y **Vestidor, Información, Ajustes, Cerrar sesión**. Los botones de esquina `?` y `⚙` se eliminan y sus acciones pasan al menú. (2) **Sin pestañas sociales:** se elimina `#social-tabs`; `#rooms-panel` y `#online-panel` quedan ocultos por defecto y se abren desde el menú (`setSocialTab`, `openRoomsSheet`, `openOnlineSheet`, `closeSocialPanels`). En móvil son hojas inferiores (`body.sheet-rooms` / `body.sheet-online`) con ✕ y cierre al tocar fuera; `touch.js` bloquea los controles mientras están abiertas. (3) **Chat independiente abajo a la derecha:** `#chat` deja de ser `.social-page`, se ancla sobre el minimapa en escritorio (`bottom:186px`) y en táctil se colapsa en burbuja 💬 de 46×46 junto al disparo; al abrirse ocupa `bottom:12px; right:8px` y `body.chat-open` oculta el HUD de combate. (4) **Coordinación chat/paneles:** `registerChat(chat)` conecta ambos; abrir un panel colapsa el chat y abrir el chat (o el evento `clubpingui:chat-open`) cierra los paneles. (5) **Accesibilidad y limpieza:** `syncMenuAria()` mantiene `aria-expanded`, `aria-hidden` e `inert`, el foco vuelve a `#menu-btn` al cerrar y `leaveGame()` limpia `sheet-rooms`/`sheet-online`. Suite completa en verde (`t-servidor` 45/45, `t-logica` 8/8) y verificado en navegador en escritorio y viewport táctil, sin errores de consola (solo el warning preexistente de `PCFSoftShadowMap`).

> 🔧 **Ajustes 4.4 (18/11/2026).** Corrección de posición del chat. El menú ☰ se mantiene arriba a la izquierda. (1) **Chat a la izquierda:** `#chat` pasa de la esquina inferior derecha a la **inferior izquierda**, en la misma columna que el menú (`left:14px; bottom:14px`; táctil `left:8px`), de modo que escritorio y móvil comparten la misma ubicación. (2) **Sólo un botón:** el chat queda **colapsado por defecto en todas las plataformas** y se muestra como un **botón redondo 💬 de 46×46** (`body:not(.chat-open) #chat`); ya no es una barra alargada. Al pulsarlo se abre el panel (270-320 px según ancho) creciendo hacia arriba desde la esquina, con `#chat-toggle` en `▾` y `aria-expanded`/`aria-label` sincronizados. (3) **Entrada y táctil:** `Enter` abre el chat y enfoca el input; en táctil el panel abierto oculta también `#touch-motion` y `#joy-base` para no dejar controles debajo, y `body.chat-open` deja de ocultar la barra de resistencia en escritorio (solo aplica en táctil). Verificado en navegador: botón 46×46 en `(14,610)` / táctil `(8,610)`, panel abierto en la esquina inferior izquierda sin tapar el menú, `Enter` y cierre al abrir Salas/Jugadores, sin errores de consola.

---

## 3. Orden, esfuerzo y dependencias

| # | Fase | Días | Depende de | Entregable |
|---|---|---|---|---|
| ✅ 0 | Red de seguridad | 0,5 | — | Tests relativos + respaldo |
| ✅ 6 | Imagen del servidor | 0,5 | — | Banner, favicon, OG |
| ✅ 1 | Mochila + escudo | 2,25 | 0 | ✅ Enter + 1.1 objetos + 1.2 escudo |
| ✅ 2 | Alcance + armas | 3 | 0 | ✅ Clases, caída de daño, 4 armas, precios |
| ✅ 3 | Puntaje + tienda | 4 | 2 | Puntos, marcador, tienda en salas |
| ✅ 5 | Recarga animada | 2 | 2 | Pose de recarga por arma + progreso |
| ✅ 4 | Salto/sprint/slide | 3 | 1 | Movimiento vertical + stamina + poses |

**Total ≈ 15 días de trabajo** (≈ 10–12 si se solapan 5 y 6 con 3).
Cada fase se puede publicar sola: no hay migraciones destructivas ni cambios de protocolo incompatibles.

---

## 4. Pruebas

**Automatizadas** (se ejecutan desde la raíz del proyecto):

```powershell
# Comando único (recomendado): ejecuta todas las suites base y resume
powershell -ExecutionPolicy Bypass -File scripts\test-all.ps1

# Suites base por separado
node public/test/runner.mjs public/test/t-logica.mjs
node public/test/runner.mjs public/test/t-auth.mjs
node public/test/runner.mjs public/test/t-combate.mjs
node public/test/runner.mjs public/test/t-armas.mjs
node public/test/runner.mjs public/test/t-servidor.mjs
node public/test/runner.mjs public/test/t-loot.mjs
node public/test/runner.mjs public/test/t-assets.mjs

# Otras suites previstas
node public/test/runner.mjs public/test/t-movimiento.mjs   # Fase 4

# Geometría (regresión, imprime snapshot)
node public/test/runner.mjs public/test/t-armasbase.mjs
```

**Manuales por fase** (checklist corto):
- Escudo: bloquear de frente / de espaldas / sin aguante / sin escudo.
- Objetos: curar con HP lleno, curar herido, lanzar en sala, recoger cristal.
- Armas: matar a 1 m, a media distancia y al máximo; comparar con la tabla.
- Tienda: sin puntos, con puntos, arma ya equipada, salir y volver a entrar.
- Recarga: cada estilo; cambiar de arma a mitad; morir a mitad.
- Movimiento: salto en cuesta, slide contra pared, sprint sin stamina, móvil 360×640.
- Regresión: chat, salas, hockey, voz, `/healthz`, login con los 13 usuarios.

---

## 5. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Tests apuntaban a `C:\xampp\...` | Cambios sin verificar | ✅ Fase 0: ya son relativos |
| Sin git instalado | Difícil revertir | `scripts/backup-proyecto.ps1` + zip por fase |
| `Space` ya dispara | Cambio de controles molesto | Actualizar ayuda + aviso en el parche |
| Clic derecho ya arrastra cámara | Bloqueo imposible en 3.ª persona | `Q` en 3.ª persona; clic derecho solo en 1.ª |
| Salto/slide vs anti-cheat 2,5 m | Rechazos de posición | Velocidades dentro del límite; test explícito |
| Economía explotable | Inflación de puntos | Rendimientos decrecientes por víctima + racha con tope |
| Migración SQLite | Pérdida de datos | Solo `CREATE TABLE IF NOT EXISTS`; respaldo previo |
| Caché del navegador en módulos ES | Cambios no visibles | `Cache-Control: no-cache` en HTML; `?v=` en el `<script>` de entrada |
| UI táctil saturada | Botones inaccesibles | Probar 360×640 y 412×915 antes de cerrar la fase |

---

## 6. Decisiones confirmadas

| Tema | Decisión |
|---|---|
| **Escudo** | **Bloqueo total con aguante**: anula el 100 % del daño frontal mientras quede aguante (~3,6 s), arco frontal 2,4 rad, guard break de 1,2 s al agotarse, movimiento al 55 % y sin poder disparar mientras bloquea. |
| **Puntaje** | **Sesión + histórico en BD**: los puntos de la sesión se gastan en la tienda; kills, muertes y mejor racha se guardan en `user_stats` (SQLite). |
| **Imagen** | **Las cuatro**: banner del login, miniatura en `/menu`, favicon/iconos y metadatos Open Graph para el preview del enlace. |
| **Armas nuevas** | **Tienda + cristales**: `revolver`, `dmr`, `martillo` y `ballesta` se venden y también entran al pool aleatorio de cristales. |
| **Recoger cristales** | **Enter**: con una oferta visible, `Enter` la acepta; si no hay oferta, sigue enfocando el chat. El botón táctil se mantiene. |
| **Lobby** | **Social, sin cristales ni lanzables**: hockey, chat y vestidor. La comida se puede usar para curarse; los cristales y los objetos lanzables son exclusivos de las salas privadas. |

Con esto no queda ninguna decisión bloqueante: se puede empezar por la **Fase 0** y seguir el orden propuesto.
