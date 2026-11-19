# Guía de desarrollo · Club Pingüi

**Carpeta de trabajo:** `C:\Users\tslui\Downloads\Proyecto_ClubPingui\Proyecto_ClubPingui`
**Node:** 24.x portable en `%LOCALAPPDATA%\Programs\nodejs\node.exe`
**Puertos:** juego **3050** · puerta/menú **3000**

> Existe una copia antigua en `C:\xampp\htdocs\Proyecto_ClubPingui`. **No se toca**: todos los cambios y pruebas se hacen en la carpeta de trabajo indicada arriba. Desde la Fase 0 los tests calculan su raíz a partir de `import.meta.url`, así que siempre prueban la copia en la que están.

---

## 1. Arrancar y detener

```powershell
# Arrancar (no duplica si el puerto ya está ocupado)
powershell -ExecutionPolicy Bypass -File scripts\start-servers.ps1

# Detener (solo procesos node de los puertos 3000/3050)
powershell -ExecutionPolicy Bypass -File scripts\stop-servers.ps1
```

- Juego: <http://localhost:3050>
- Menú/puerta: <http://localhost:3000>
- Logs: `logs\game.log`, `logs\game.err.log`, `logs\redirect.log`, `logs\redirect.err.log`

Al iniciar sesión en Windows, la tarea programada **`ClubPingui Servers`** ejecuta `start-servers.ps1` automáticamente (sin permisos de administrador). El túnel de Cloudflare corre como **servicio de Windows** (`cloudflared`, inicio automático al encender el equipo, sin necesidad de iniciar sesión). La tarea antigua **`ClubPingui Tunnel`** quedó **desactivada** para no duplicar conectores.

---

## 2. Ejecutar las pruebas

Comando único (devuelve `exit 1` si algo falla):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-all.ps1
```

Suites incluidas:

| Suite | Qué comprueba | Resultado esperado |
|---|---|---|
| `t-logica.mjs` | armas, objetos, mapas, apariencia, colisiones | 8/8 |
| `t-auth.mjs` | registro, login, sesión, logout (BD temporal) | 7/7 |
| `t-servidor.mjs` | salas, movimiento (presupuesto anti-speed-hack), salto/sprint/slide, cristales, inventario (lobby/sala), combate, escudo, caída de daño, puntaje, tienda y persistencia de `user_stats` (BD temporal) | 45/45 |
| `t-combate.mjs` | matemáticas del bloqueo: arco frontal, anulación total, guard break | 18/18 |
| `t-armas.mjs` | clases, alcances, caída de daño, precios, radio de rayo, armas nuevas y recarga (estilos + progreso) | 13/13 |
| `t-movimiento.mjs` | salto (altura, sin doble salto), sprint (stamina, regeneración, bloqueo contra paredes) y deslizamiento (duración, cooldown, coste) | 8/8 |
| `t-loot.mjs` | oferta de cristal y recogida con Enter (`acceptOffer`) | 7/7 |
| `t-modos.mjs` | registro de modos y portales, mapas `isla`/`pares`/`coliseo`, obstáculos, partida de Pares determinista (1v1 y 2v2) y flujo real isla → portal → partida → isla | 13/13 |
| `t-coliseo.mjs` | formatos 1v1/2v2/FFA, loadout melee, spawns y límite circular, fases y rondas, espectador sin respawn, rechazo de armas de fuego, bloqueo de curación/lanzables/tienda y persistencia `duel_wins`/`duel_rounds` | 14/14 |
| `t-assets.mjs` | imagen de tarjeta, iconos, manifest, Open Graph y caché de `/assets` | 10/10 |

Suites auxiliares (se ejecutan aparte porque dependen de datos externos):

```powershell
# Geometría de armas: imprime un snapshot JSON, no pasa/falla
node public/test/runner.mjs public/test/t-armasbase.mjs

# Comparaciones con el tuner de aletas (se saltan si faltan los JSON)
$env:TUNER_OUT="C:\ruta\tuner-out.json"
$env:TUNER_ESPERADO="C:\ruta\tuning-esperado.json"
node public/test/runner.mjs public/test/t-aletasdiff.mjs
node public/test/runner.mjs public/test/t-tuningcheck.mjs
```

`t-aletasdiff` y `t-tuningcheck` usan `TUNER_OUT` / `TUNER_ESPERADO` o, si no se definen, `%TEMP%\opencode\*.json`. Si el archivo no existe, muestran `SKIP` y terminan con código 0 para no romper la suite.

---

## 2.1 Reglas de zonas e inventario (Fase 1.1)

- **Lobby:** social (hockey, chat, vestidor). **Sin cristales** y **sin lanzables**. La **comida sí se usa** para curarse; con la vida al máximo avisa y no la gasta.
- **Sala privada:** cristales de armas/comida/lanzables, combate y lanzamiento de objetos.
- El servidor valida `{slot, id, type}` en `inventory:use` / `inventory:throw`. Si el inventario del cliente está desincronizado, reenvía `inventory:update` y muestra `"El inventario cambió. Inténtalo de nuevo."`.
- Todos los rechazos llegan como `inventory:toast` (se muestran con `showToast`) y los cristales inválidos como `crystal:error`.

---

## 2.2 Mapas de sala y coberturas (Ajustes 4.2)

- **Tamaño:** los mapas de sala miden **120** (120 × 120) —selva, desierto, volcán, pradera, ciudad y gruta—; el lobby (Pueblo Nevado) sigue en **80** y Cordillera Nevada en **600**. El suelo escala su textura, la niebla y el frustum de sombras con el tamaño.
- **Coberturas:** `public/js/mapObstacles.js` es un módulo **puro** (sin three.js ni DOM) con los layouts de los seis mapas: selva 60, desierto 64, volcán 50, pradera 50, ciudad 48 y gruta 52. `world.js` los renderiza y `server/game.js` los usa para no generar cristales dentro de una cobertura (`isInsideObstacle`).
- **Principios PVP:** anillos de movimiento, tres carriles (exterior/medio/interior), coberturas altas y bajas alternadas, sin pasillos únicos y plaza central despejada (≥ 10 m en gruta, ≥ 15 m en el resto).
- **Spawns:** al entrar en una sala el servidor usa `clearRoomSpawn()` para aparecer en el anillo central libre; así nadie queda atrapado dentro de una caja o un árbol.
- **Loot:** `MAP_LOOT_COUNTS` sube a 6-9 cristales en los mapas de 120 (cordillera conserva 18).
- **Añadir un mapa nuevo:** crea su layout en `mapObstacles.js`, añádelo a `MAP_OBSTACLES`, define `size: 120` en `mapDefs.js` y su tema en `world.js` (`THEMES`). El test `t-logica` valida que las coberturas no se salgan del mapa y que el centro quede libre.

---

## 2.3 HUD, menú ☰ y chat (Ajustes 4.3-4.4)

- **Menú ☰ arriba a la izquierda:** `#menu-btn` es hijo directo de `#game` (no de `.header-actions`) y usa `.corner-btn` con `left:14px; top:14px` (táctil `8px`). La cabecera conserva el botón de 3.ª persona (`#fp-toggle`), que solo aparece dentro de una sala.
- **Contenido del menú:** Salas, Jugadores, Chat, separador `.mm-sep`, Vestidor, Información, Ajustes y Cerrar sesión. Los botones de esquina `?` y `⚙` ya no existen: sus acciones viven en el menú. `#mobile-menu` se ancla arriba a la izquierda (`top:54px; left:14px`, táctil `48px/8px`), con `transform-origin: top left`, `max-height: calc(100vh - 64px)` y scroll.
- **Accesibilidad:** `setupMobileMenu` mantiene `aria-expanded` en `#menu-btn` y `aria-hidden` + `inert` en `#mobile-menu` mediante `syncMenuAria()`. Al cerrar el menú el foco vuelve a `#menu-btn` para no dejar el foco dentro de un elemento oculto.
- **Paneles sociales bajo demanda:** `#rooms-panel` y `#online-panel` están ocultos por defecto (`display:none`, sin `.active`). `setSocialTab(page)` los muestra de uno en uno y añade `body.sheet-rooms` / `body.sheet-online`; en móvil se dibujan como hojas inferiores con botón ✕ (`#rooms-close-btn`, `#online-close-btn`) y cierre al tocar fuera.
- **Chat independiente (Ajustes 4.4):** `#chat` ya no es una pestaña ni una barra alargada. Colapsado es un **botón redondo 💬 de 46×46 abajo a la izquierda** (`left:14px; bottom:14px`; táctil `left:8px`), en la misma columna que el menú ☰ y visible en todas las plataformas. Al pulsarlo se abre el panel (270-320 px según ancho) que crece hacia arriba desde la esquina inferior izquierda; `#chat-toggle` cambia a `▾` y actualiza `aria-expanded`/`aria-label`. `Enter` abre el chat y enfoca el input.
- **Coordinación:** `main.js` registra la API del chat con `registerChat(chat)`. Abrir un panel social colapsa el chat; abrir el chat (`chat.open()` o el evento `clubpingui:chat-open`) cierra los paneles sociales. En táctil, `body.chat-open` oculta `#combat-hud`, `.item-bar`, `#touch-actions`, `#touch-motion`, `#fire-btn` y `#joy-base`; `touch.js` bloquea los controles mientras hay una hoja abierta (`sheet-rooms` / `sheet-online`).
- **Cierre de partida:** `leaveGame()` limpia `sheet-rooms`, `sheet-online`, `menu-open` y `chat-open` además del resto de clases del HUD.

---

## 2.4 Isla de Minijuegos y modos (Fase 8)

- **Cómo se entra:** desde el lobby, botón **🎮 Minijuegos** del menú ☰ o el portal del Pueblo Nevado (sur de la pista de hockey, `x:0 z:-25`). También con `E` al acercarse al portal (`PORTAL_TRIGGER_RADIUS = 3.2`).
- **La isla es una sala oculta persistente:** código reservado `ISLA`, mapa `isla` (64), 24 jugadores, `kind:"hub"`, `combat:false`. No aparece en `room:list`.
- **Cada modo es otra sala oculta persistente:** código `MODO-<ID>`, `kind:"mode"`, `modeId`, `status` (`waiting`/`playing`/`finished`) y `combat` (`false` salvo el Coliseo, que habilita el canal de golpes melee). El registro vive en `public/js/modeDefs.js` (datos puros, compartido cliente/servidor) y las reglas en `server/modes/`.
- **Validación del servidor:** `mode:join` exige estar en la isla y a menos de **6 m** del portal (el aviso del cliente aparece a 3,2 m). Desde el lobby hay que pasar primero por la isla; no se acepta un salto directo.
- **Portales «próximamente»:** `pares`, `coliseo` y `escondite` tienen `status:"live"`. Los otros tres (TNT Run, karts y ciudad rol) se dibujan en la isla pero responden con «<Modo> todavía no está disponible.» sin mover al jugador.
- **Salir:** el botón contextual del panel de zona muestra «← Volver a la isla» dentro de un modo y «Salir al lobby» en la isla. También `mode:leave`.
- **Mapas internos:** `isla` (64), `pares` (44), `coliseo` (52) y `escondite` (72) están en `mapDefs.js` con `room:false` para que no salgan en el selector de salas privadas; sus layouts están en `mapObstacles.js` y sus temas/monolitos/portales en `world.js`. El Coliseo sustituye el borde cuadrado por un muro circular (`collision.js` aplica `COLISEO_PLAY_RADIUS`). El Escondite usa una aldea con jaula central y doce coberturas compartidas por `hideDefs.js` y `mapObstacles.js`.
- **Añadir una modalidad:** define su entrada en `modeDefs.js`, crea su controlador en `server/modes/`, regístralo en `setupGame()` y añade su portal en `hubDefs.js`. `t-modos` valida que el registro, los mapas y los portales sigan coherentes.
- **Pares (minijuego 3D):** al entrar al portal se elige formato (1v1 · 16 cartas · 4×4 o 2v2 · 36 cartas · 6×6), cada formato con su propia sala `MODO-PARES-1V1`/`MODO-PARES-2V2`. El jugador camina sobre el tablero, pisa una carta y salta para voltearla; el servidor deduce la carta de la posición autoritativa y valida turno, cooldown y proximidad. Los equipos se eligen pisando su plataforma y la partida arranca con cuenta atrás cuando ambos bandos están completos. La pareja acertada vuela al atril del equipo y ese equipo repite turno. La cámara se eleva y fija sobre el tablero, con **zoom** por rueda, teclas `+`/`-` o botones del HUD, el HUD es no modal y el movimiento usa *yaw* fijo. Geometría y reglas compartidas: `pairsDefs.js`; render: `pairsBoard.js`; controlador: `server/modes/pairs.js`.
- **Pendiente de Pares:** espectadores, reconexión como espectador, estadísticas persistentes, revancha votada y más variantes de tablero.
- **Coliseo melee (minijuego de combate):** al entrar al portal se elige formato (1v1, 2v2 o todos contra todos hasta 8), cada uno con su sala `MODO-COLISEO-1V1`/`-2V2`/`-FFA`. La arena es circular (34 m de diámetro) y solo admite el loadout cuerpo a cuerpo (`daga`, `espada`, `maza`, `escudo`, `martillo`): el jugador elige arma y pulsa **Listo**, y la partida arranca cuando la sala está completa (equipos) o hay ≥2 listos (FFA). Cada ronda dura 90 s o hasta que quede un bando; al mejor de 5 (primero a 3). El servidor es autoritativo: asigna bandos, teletransporta al empezar la ronda, ignora `player:move` fuera de `fight`, valida que `combat:shoot` use un arma melee del loadout, bloquea el fuego amigo, no programa respawn (el eliminado es espectador hasta la ronda siguiente) y bloquea curación, lanzables, cristales y tienda. Al terminar, `user_stats` acumula `duel_wins` y `duel_rounds`. Reglas y geometría: `coliseoDefs.js`; controlador: `server/modes/coliseo.js`; HUD: `coliseo.js`.
- **Pendiente del Coliseo:** *feedback* de impacto (hit-stop, sacudida y sonido por golpe), revancha votada y espectadores de partidas ajenas.
- **Escondite (minijuego de roles):** sala oculta `MODO-ESCONDITE`, sin combate, en una aldea de 72 m con jaula central y doce escondites en anillo. De 3 a 12 jugadores pulsan **Listo** y el servidor elige un buscador con RNG sembrado; el resto son escondidos. Fases `waiting` → `hide` (90 s con el buscador teletransportado a (0,0) y con `player:move` ignorado) → `seek` (180 s) → `result`. El buscador etiqueta con `F` (`tag {targetId}`) si está a menos de 1,6 m y con línea de visión libre — las coberturas de `HIDE_COVERS` bloquean la etiqueta y el pulso — y usa el pulso de 8 m cada 30 s con `G`; los escondidos tienen tres esquivas de 0,55 s que recargan cada 25 s, también con `G`. El HUD es no modal y muestra fase, rol, reloj, escondidos vivos, recargas y avisos de detección; los escondidos dentro de un escondite se ven atenuados para el resto. Si todos son etiquetados gana el buscador; si queda uno, ganan los escondidos al terminar el tiempo. El evento público del pulso sanitiza `hits: []` y los aciertos van solo al buscador. Un desconectado conserva su rol 45 s (`stableHideKey`: `userId` o nombre normalizado) y el cliente auto-reconecta con `mode:rejoin`. Se bloquean disparos, cristales, tienda, curación, lanzables y bloqueo. `user_stats` acumula `hide_wins` y `seek_wins`. Contratos: `hideDefs.js` y `mapObstacles.js`; aldea: `world.js`; controlador: `server/modes/escondite.js`; HUD: `escondite.js`; suite: `t-escondite.mjs` (15/15).
- **Excepción de combate:** el Coliseo es el único modo con `combat:true`. El Escondite, como Pares, lo tiene en `false` y el servidor rechaza cualquier intento de disparar, bloquear, curar, lanzar objetos o comprar.

---

## 3. Recursos de imagen (Fase 6)

El banner del login, la miniatura de `/menu`, el favicon y la imagen de Open Graph salen de un único JPEG. Para regenerarlos (por ejemplo, si cambias la imagen original):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\make-server-assets.ps1
```

Genera, usando `System.Drawing` (no hace falta ImageMagick ni ffmpeg):

| Archivo | Uso |
|---|---|
| `public\assets\server-card.jpg` (1600×900) | banner del login, miniatura de `/menu`, `og:image` |
| `public\assets\icons\icon-32.png` / `icon-192.png` | favicon |
| `public\assets\icons\icon-180.png` | `apple-touch-icon` |
| `public\assets\icons\icon-512.png` / `icon-192.png` | `manifest.webmanifest` |

- Origen: `assets\11dcffba10c84f61a2abea46a917bcef.jpeg`.
- Solo `/assets` tiene caché de 7 días; HTML/JS/CSS siguen con caché corta para ver los cambios al recargar.
- No se genera WebP porque este equipo no tiene codificador; el JPEG pesa <50 KB.
- Las URLs de Open Graph usan `https://pinguidev.corvet.dpdns.org/…`, así que el preview externo depende del túnel.

---

## 4. Respaldo

```powershell
# Solo código (public, server, docs, scripts, config)
powershell -ExecutionPolicy Bypass -File scripts\backup-proyecto.ps1

# Código + copia cruda de data\club.db*
powershell -ExecutionPolicy Bypass -File scripts\backup-proyecto.ps1 -ConDatos
```

Los zip se guardan en `backups\clubpingui_AAAAMMDD_HHMMSS.zip`.

- Git está en `C:\Program Files\Git\cmd\git.exe` (no siempre en el `PATH` de la shell). El repo está conectado a `https://github.com/TJluis/Prevent.git`, rama `main`.
- El zip sigue siendo la red de seguridad rápida; el commit + push es el respaldo definitivo.
- Antes de un respaldo con `-ConDatos`, detén los servidores (`stop-servers.ps1`) para que la copia de SQLite sea consistente.
- Recomendado: un zip por fase terminada.

---

## 5. Flujo recomendado por cambio

1. `scripts\backup-proyecto.ps1` (red de seguridad).
2. Editar en la carpeta de trabajo.
3. `scripts\test-all.ps1` → debe terminar en 0.
4. Reiniciar servidores si se tocó `server/` (los cambios de `public/` se ven al recargar con `Ctrl+F5`).
5. Probar en el navegador: <http://localhost:3000>.
6. `scripts\backup-proyecto.ps1` al cerrar la fase.

---

## 6. Túnel de Cloudflare (servicio de Windows)

- Servicio: **`cloudflared`**, estado `Running`, inicio `Automatic` (arranca al encender el PC, sin login).
- Comando de instalación (consola **elevada**): `cloudflared-windows-amd64.exe service install <token>`; automatizado en `scripts\install-tunnel-service.ps1 -Token <token>`.
- El token incluye cuenta, ID de túnel y secreto (`a`/`t`/`s`), así que **no necesita** `config.yml` ni el JSON de credenciales. La configuración de ingress se gestiona desde el dashboard de Cloudflare.
- Credenciales locales de referencia: `C:\Cloudflared\Cloudflared\20b6aaac-ba6e-47f2-9651-255f780138f7.json` (reconstruidas desde el token).
- Verificación: `Get-Service cloudflared`, `https://pinguidev.corvet.dpdns.org` debe responder **200**.
- La tarea programada **`ClubPingui Tunnel`** está desactivada. `start-tunnel.ps1` detecta el servicio y no lanza un segundo conector.
- Hay un proceso de *quick tunnel* ajeno en `%TEMP%` para el puerto 8099: **no tocarlo**.

---

## 7. Datos

- Base de datos: `data\club.db` (SQLite). Contiene usuarios, mensajes y (a partir de la Fase 3) `user_stats`.
- Copia de la BD vacía anterior: `data\_empty_backup_20261113_175350\`.
- Las suites `t-auth` y `t-servidor` usan una BD temporal (`%TEMP%\pingui-*.db`) y **no** tocan `data\club.db`.

---

## 8. Documentación de la expansión

Antes de programar cualquier modalidad nueva, leer estos dos documentos en este orden:

| Documento | Para qué |
|---|---|
| [`PLAN_MODALIDADES_2026-12.md`](PLAN_MODALIDADES_2026-12.md) | Contrato de modo, las seis modalidades, fases, esfuerzos, calendario, pruebas y riesgos. |
| [`INVESTIGACION_HERRAMIENTAS_2026-11.md`](INVESTIGACION_HERRAMIENTAS_2026-11.md) | Versiones, licencias, costos y veredicto de cada herramienta (Rapier, Colyseus, Blender, glTF, LiveKit…). |

Reglas que salen de esos documentos y aplican desde ya:

1. **Nada de modos nuevos antes del 23/11/2026** (versión estable). Primero se cierra y se respalda.
   - **Excepción aprobada (18/11/2026):** el usuario pidió adelantar las olas 1 y 2. Se implementaron la isla, Pares y el Coliseo melee con la versión estable ya respaldada y todas las suites en verde; el resto de modalidades siguen sujetas a la regla.
2. Toda modalidad implementa el **contrato de modo** (`public/js/modeDefs.js` + `server/modes/`); no se añaden `if` de modo dentro de `server/game.js`.
3. El cliente envía **intenciones**, nunca resultados; el servidor valida.
4. Cada ola termina con `scripts\test-all.ps1` en 0, prueba manual en dos navegadores y respaldo zip.
5. No se toca el *quick tunnel* del puerto 8099 ni el túnel `pinguidev.corvet.dpdns.org`.
