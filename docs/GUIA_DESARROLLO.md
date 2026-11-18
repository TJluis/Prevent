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

- No hay `git` instalado en este equipo; el respaldo en zip es la red de seguridad.
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
