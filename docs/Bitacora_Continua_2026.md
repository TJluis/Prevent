# Bitácora continua · Club Pingüi

**Periodo de registro:** 29 de octubre de 2026 → 1 de diciembre de 2026
**Objetivo:** dejar trazabilidad de cada petición, acción y modificación de cara a la presentación final y a la entrega de módulos.

> Regla de trabajo: cada entrada registra la petición textual del usuario, lo que se hizo, los archivos tocados, cómo se probó y el resultado medido. Las entradas se numeran `BC-01`, `BC-02`, … y se reflejan también en `docs/bitacora.ps1` (entradas ID `FV*`).

---

## BC-01 · 29–30 Oct 2026 · Auditoría y corrección del visor móvil

### Petición
> «Realiza lo mismo en visor de móvil, quiero que veas bugs visuales más que nada y que todo funcione correctamente».

Además: registrar cada modificación hasta el 1 de diciembre y, al terminar móvil, ordenar módulos pendientes y proponer mejoras de los módulos existentes.

### Alcance
Se interpretó «visor de móvil» como la vista táctil real del juego (`body.touch-mode`), no una página aparte. Se auditó el juego completo (login → vestidor → partida → sala privada) dentro de un arnés de viewports.

### Herramienta de prueba creada
`public/debug/mobilecheck.html`: carga el juego en iframes de **844×390, 915×412, 812×375, 667×375, 640×360, 390×844 y 360×640**, inyecta `window.__forceTouch = true` y corrige la URL de socket.io del iframe (`http://localhost:3000`). Permite medir rectángulos reales con `getBoundingClientRect()` y comparar contra el viewport.

### Bugs encontrados y corregidos

| # | Bug (evidencia) | Corrección | Verificación |
|---|-----------------|------------|--------------|
| 1 | **Login cortado en horizontal.** `#join-card` medía 513 px; «Jugar/Crear cuenta» quedaban en y=396–458, fuera de 390 px. `overflow:hidden` impedía el scroll. | `#join-screen` con `100dvh`, scroll vertical y tarjeta con margen automático; media `max-height:620px` compacta badge, título, subtítulo, inputs y botones. | Tarjeta de **287 px** en 844×390 / 915×412 / 640×360; botones en y=273–311, visibles. |
| 2 | **Joystick invisible.** `#joy-base` era `position:absolute` dentro de `#joy-area` (y=195): un toque en (100,300) lo dibujaba en y=441, fuera de pantalla. El movimiento sí funcionaba. | `#joy-base` pasa a `position:fixed` (coordenadas de cliente del puntero). | Toque en (100,300) → base en **x=46, y=246 (108×108)**, dentro del viewport, stick desplazado correctamente. |
| 3 | **Hoja de Salas sin cierre.** No había ✕ ni cierre al tocar fuera; cubría el 62 % de la pantalla. | Se añadió `#rooms-close-btn` en el título, cierre al tocar fuera (listener en captura) y `openRoomsSheet()` cierra ajustes. | Abre/cierra con ✕ y con toque exterior; `sheet-rooms` se retira del `body`. |
| 4 | **Salas debajo del HUD.** `#rooms-panel` z-index 20 quedaba bajo `#combat-hud` (22), barra de objetos (25) y disparo (23). | `body.touch-mode #rooms-panel { z-index: 40 }`. | Panel en **z=40**, siempre por encima del HUD. |
| 5 | **Toques atravesaban la hoja.** `uiBlocked()` no consideraba `sheet-rooms`: la cámara/joystick se movían detrás. | `uiBlocked()` bloquea `sheet-rooms` y `#rooms-panel`. | Sin movimiento de cámara con la hoja abierta. |
| 6 | **Botones de esquina encimados.** `?` y `⚙` medían 46.8×28 por el padding global y se solapaban 12.8 px; eran óvalos. | `.corner-btn` con `padding:0`; en táctil 32×32, `?` en x=8 y `⚙` en x=48. | Dos círculos de **32×32** sin solape. |
| 7 | **Chat abierto por defecto en horizontal >820 px.** Tapaba el HUD y el HUD quedaba por encima del chat; `body.chat-open` solo ocultaba el HUD a ≤820 px. | `compactUi()` (touch-mode o ≤820 px) controla el colapso inicial y la reconfiguración; al abrir en táctil se ocultan `combat-hud`, `item-bar`, `touch-actions` y `fire-btn`. Toggle de 32×32. | Chat colapsado (116×55); al abrir (284×237) el HUD y los botones quedan en `display:none`. |
| 8 | **Vestidor inutilizable en 812×375.** Una sola columna, preview de 180 px y `#dress-controls` de **11 px**. | Media `(orientation:landscape) and (max-height:560px)`: dos columnas `minmax(0,42%) minmax(0,1fr)`, preview flexible y acciones con `margin-top:0`. | Columnas **315 + 421 px**, preview **322 px**, controles **260 px** con scroll, acciones visibles. |
| 9 | **HUD de combate encimado.** En 640×360 medía 399×122 y se solapaba 14–19 px con `#touch-actions`; «Recargar (R)» se partía en dos líneas. | Botones `white-space:nowrap` + `flex-shrink:0`, HP bar de 96 px, paddings compactos y etiqueta `↻`/`…` en táctil. | HUD de **243×59**; **0 solapes** en 844×390, 915×412, 812×375, 667×375 y 640×360. |
| 10 | **Detección táctil incorrecta.** `maxTouchPoints > 0` activaba el layout móvil en portátiles táctiles. | `isTouchMode()` usa `(pointer: coarse)` o `(any-pointer: coarse) && (hover: none)`. | Escritorio con `pointer:fine` + `maxTouchPoints:2` → **sin** `touch-mode`; arnés con `__forceTouch` → modo táctil. |
| 11 | **Header partido en 640×360.** `#header-place` saltaba a dos líneas (header de 48 px). | `min-width:0`, `nowrap`, `ellipsis` y `max-width:62vw`; acciones con `flex-shrink:0`. | Header de 44 px en una línea; texto con ellipsis en 360×640. |
| 12 | **Tap targets pequeños.** Menú ☰ 32×24 y toggle de chat ~20×24. | ☰ 36×32 y toggle 32×32. | Medidas confirmadas. |
| 13 | **Zoom automático en iOS.** Inputs de 13–14 px provocan zoom al enfocar. | `body.touch-mode input/textarea/select { font-size:16px }`. | Input de chat reporta **16 px**. |
| 14 | **Inventario no seleccionaba al tocar.** Solo `mousedown`/`dblclick`. | `pointerdown` con `pointerType === "touch"` + `touch-action:manipulation`. | Slot 0 con 🐟 queda `item-selected` al toque. |
| 15 | **Aviso de rotación ambiguo.** Decía «se juega mejor en horizontal». | Texto: «Gira tu dispositivo a horizontal · el joystick, el HUD y los botones necesitan el modo horizontal». | Visible solo en vertical dentro de partida. |

> Nota: los botones de esquina `?`/`⚙` y las pestañas sociales descritos en esta auditoría se sustituyeron por el menú ☰ en **BC-02**.

### Archivos modificados
- `public/css/style.css` — login responsive, joystick fixed, botones de esquina, chat/HUD táctil, salas z-40, vestidor horizontal, inputs 16 px, header con ellipsis, barra de objetos.
- `public/index.html` — botón ✕ de salas y texto del aviso de rotación.
- `public/js/touch.js` — detección táctil por puntero y bloqueo de UI con la hoja de salas.
- `public/js/chat.js` — colapso del chat con `compactUi()`.
- `public/js/hud.js` — cierre de salas (✕ y toque fuera) y cierre de ajustes al abrir salas.
- `public/js/combat.js` — etiqueta de recarga compacta (`↻` / `…`) en táctil.
- `public/js/inventory.js` — selección por `pointerdown` en táctil.
- `public/debug/mobilecheck.html` — **nuevo** arnés de viewports móviles.

### Pruebas ejecutadas
- Login invitado → vestidor → partida → sala privada, en 844×390, 915×412, 812×375, 667×375, 640×360, 390×844 y 360×640.
- Medición de rectángulos y detección automática de solapes/fuera de viewport en cada tamaño.
- Simulación de punteros táctiles (`PointerEvent` con `pointerType:"touch"`) para joystick, inventario y cierre de salas.
- Consola del arnés: **0 errores**.
- Escritorio (`/`): `body` sin `touch-mode`, menú ☰ y `#touch-hud` ocultos.

### Estado
**Completado y verificado.** Sin cambios pendientes en móvil.

---

## BC-02 · 18 Nov 2026 · Reorganización del HUD: menú ☰ y chat independiente

### Petición
> «Quiero el menú hamburguesa arriba a la izquierda con Salas/Jugadores/Chat y el chat abajo a la derecha, separado».

### Alcance
Reordenar el HUD sin tocar la lógica de juego: el botón ☰ pasa a la esquina superior izquierda y absorbe las pestañas sociales y los accesos de `?`/`⚙`; el chat deja de ser una pestaña y se ancla abajo a la derecha.

### Cambios
- **☰ arriba a la izquierda:** `#menu-btn` sale de `.header-actions` y es hijo directo de `#game` (`.corner-btn`, `left:14px; top:14px`; táctil `8px`). La cabecera conserva el botón de 3.ª persona.
- **Menú:** Salas, Jugadores, Chat, separador, Vestidor, Información, Ajustes y Cerrar sesión. Se eliminan `#social-tabs`, `#info-btn` y `#settings-btn`; `setupHelp`/`setupSettings` ya no dependen de ellos.
- **Paneles bajo demanda:** `#rooms-panel` y `#online-panel` ocultos por defecto; `setSocialTab()` los alterna y en móvil son hojas inferiores (`sheet-rooms` / `sheet-online`) con ✕ y cierre al tocar fuera. `touch.js` bloquea los controles con una hoja abierta.
- **Chat abajo a la derecha:** sin `.social-page`; expandido sobre el minimapa en escritorio y burbuja 💬 de 46×46 junto al disparo en táctil. `chat.js` expone `open()/close()/isOpen()` y emite `clubpingui:chat-open`.
- **Coordinación:** `registerChat()` conecta chat y paneles; abrir uno cierra/colapsa el otro. `leaveGame()` limpia también `sheet-online`.

### Archivos modificados
- `public/index.html` — `#menu-btn`, `#mobile-menu`, paneles sociales, `#chat`.
- `public/css/style.css` — `.corner-btn`, `#mobile-menu`, `#chat`, hojas táctiles y reglas de colapso.
- `public/js/hud.js` — `registerChat`, `setSocialTab`, `openRoomsSheet`, `openOnlineSheet`, `closeSocialPanels`, `syncMenuAria`.
- `public/js/chat.js` — `applyCollapsed`, `open/close/isOpen`, icono 💬 y evento de apertura.
- `public/js/main.js` — `registerChat(chat)` y limpieza de `sheet-online`.
- `public/js/touch.js` — `uiBlocked()` incluye `sheet-online`.

### Pruebas ejecutadas
- Escritorio 912×670: ☰ en `(14,14)`, menú abre/cierra, Salas/Jugadores/Chat funcionan, ajustes e info abren y el chat se expande/colapsa.
- Táctil: ☰ en `(8,8)`, menú `214×323` con scroll, chat burbuja de 46×46 en `(734,598)` junto al disparo, hojas de Salas/Jugadores a lo ancho con ✕ y cierre exterior.
- `scripts\test-all.ps1`: todas las suites en verde (`t-servidor` 45/45, `t-logica` 8/8, `t-combate` 18/18, `t-armas` 13/13, `t-movimiento` 8/8, `t-loot` 7/7, `t-assets` 10/10, `t-auth` 7/7).
- Consola: **0 errores**; solo el warning preexistente `PCFSoftShadowMap`.

### Estado
**Completado y verificado** en escritorio y táctil.

> Corrección posterior en **BC-03**: el chat pasa a la izquierda y se abre con un botón redondo.

---

## BC-03 · 18 Nov 2026 · Chat a la izquierda con botón redondo

### Petición
> «La hamburguesa me gustó donde está; pon el chat del lado contrario, en la parte inferior de donde está la hamburguesa, y que sea sólo un botón simple el que abra el chat, no uno alargado».

### Cambios
- **Chat abajo a la izquierda:** `#chat` se ancla en `left:14px; bottom:14px` (táctil `left:8px`), en la misma columna que ☰. Deja la esquina inferior derecha libre para el minimapa (escritorio) y el disparo (táctil).
- **Un solo botón:** el chat queda colapsado por defecto en todas las plataformas y se dibuja como botón circular 💬 de 46×46 (`body:not(.chat-open) #chat`); se elimina la barra alargada. Al abrirlo, el panel (270-320 px) crece hacia arriba desde la esquina y el toggle pasa a `▾`.
- **Accesibilidad:** `#chat-toggle` actualiza `aria-expanded` y `aria-label` («Abrir chat» / «Cerrar chat»). `Enter` abre el chat y enfoca el input.
- **Táctil:** al abrir el chat se ocultan `#touch-motion` y `#joy-base` además del HUD de combate; `body.chat-open` solo oculta la resistencia en táctil, no en escritorio.

### Archivos modificados
- `public/css/style.css` — posición del chat, estado colapsado circular, reglas táctiles.
- `public/js/chat.js` — colapso inicial, textos/ARIA del toggle y `chat-open` global.
- `public/js/main.js` — `Enter` llama a `chat.open()`.
- `public/index.html` — botón `#chat-toggle` con 💬 y ARIA.

### Pruebas ejecutadas
- Escritorio 912×670: botón 💬 en `(14,610)` de 46×46; abierto en `(14,385)` de 270×271, sin tapar ☰ en `(14,14)`.
- Táctil: botón en `(8,610)` de 46×46; abierto en `(8,434)` de 320×224, con disparo, acciones, salto/sprint/slide y joystick ocultos.
- Abrir Salas colapsa el chat; `Enter` lo abre y enfoca el input.
- Consola: **0 errores**.

### Estado
**Completado y verificado.**

---

## Módulos pendientes (orden sugerido)

> Criterio: impacto en la demo del 1 de diciembre → riesgo técnico → costo.

| Prioridad | Módulo | Estado | Qué falta | Por qué importa |
|-----------|--------|--------|-----------|-----------------|
| 1 | **Audio / música** | Parcial | Música de fondo por mapa y mezcla de volumen; sonidos de pasos y ambiente | Es lo que más «vende» la sensación de juego en la demo y hoy solo hay efectos de combate. |
| 2 | **Tutorial / onboarding** | No existe | Primer ingreso guiado: moverse, entrar a sala, recoger cristal, equipar arma, disparar | Reduce la explicación en vivo y evita que la demo se trabe por desconocimiento. |
| 3 | **Espectador / cámara de muerte** | No existe | Cámara libre o seguimiento al matar/morir y botón de respawn claro | Hoy al morir solo aparece el overlay de cuenta regresiva; se pierde el ritmo de la partida. |
| 4 | **Persistencia de partida** | Parcial | Guardar inventario/estadísticas por cuenta y ranking simple | Da continuidad entre sesiones y material para la presentación (progreso). |
| 5 | **Espectáculo de mapas** | Funcional | Clima por mapa (nieve/hojas/brasas) y variación de hora | Los mapas ya están decorados; el clima es la mejora visual con mejor costo/beneficio. |
| 6 | **Accesibilidad** | No existe | Remapeo de teclas, tamaño de UI, subtítulos de sonidos, opción daltónica | Punto fácil de rúbrica y mejora real de usabilidad. |
| 7 | **Anti-abuso / moderación** | Parcial | Filtro de chat, límite de velocidad y reportes | Necesario si la plataforma se publica más allá de la demo. |

### Mejoras propuestas para módulos existentes

| Módulo | Mejora concreta | Impacto |
|--------|-----------------|---------|
| **Combate** | Indicador de daño direccional y hitmarker; retroceso por arma visible en 3.ª persona | Feedback inmediato, se siente más pulido. |
| **Armas / tuner** | Guardar presets del tuner en `localStorage` y botón «copiar JSON» | Acelera el ajuste fino sin tocar código. |
| **Móvil** | Botón de recarga con estado visual (anillo de progreso) y vibración corta al disparar (`navigator.vibrate`) | Feedback táctil sin costo de rendimiento. |
| **Vestidor** | Vista previa con giro automático y botón «aleatorio» que no repita la skin actual | Mejor primera impresión. |
| **Chat** | Historial persistente por sesión y aviso de mensajes no leídos en la pastilla | Evita perder conversación al colapsar. |
| **Salas** | Filtro por mapa y botón «copiar código» | Facilita organizar la demo con invitados. |
| **Mundo** | LOD o `frustumCulled` agresivo en decorado instanciado para móviles de gama baja | Mantiene 60 fps en teléfonos. |
| **HUD** | Modo compacto automático por altura (ya iniciado) y ocultar etiquetas tras 3 s | Menos ruido visual en pantalla pequeña. |

---

## Próximas entradas

- **BC-02** · Clima y música por mapa (si se aprueba prioridad 1/5).
- **BC-03** · Tutorial de primer ingreso.
- **BC-04** · Cierre de módulos y ensayo general de la demo.

Cada entrada se agregará aquí y en `docs/bitacora.ps1` (`$mods`), regenerando `docs/Bitacora_Modificaciones_ClubPingui.docx` con:

```powershell
powershell -ExecutionPolicy Bypass -File .\docs\bitacora.ps1
```
