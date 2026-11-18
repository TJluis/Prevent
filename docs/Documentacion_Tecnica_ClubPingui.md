# Documentación Técnica — Club Pingüi

**Plataforma web 3D de interacción social y combate** · Servidor autoritativo Node.js + Express + Socket.IO, cliente three.js (WebGL).
**Versión:** Fase 4 (Cierre y Entrega) · **Fecha:** 28/09/2026

---

## 1. Resumen

Club Pingüi es una aplicación web multijugador en el navegador: los usuarios entran como
invitados o con cuenta, personalizan su pingüino, exploran mapas nevados procedurales,
chatean por texto y voz (proximidad), se unen a salas privadas, recolectan loot y armas y
combaten en primera/tercera persona. Todo el estado de juego es **autoritativo en el
servidor**; el cliente solo predice efectos visuales/sonoros.

El despliegue público se realiza con un túnel de Cloudflare (`pinguidev.corvet.dpdns.org`)
hacia el servidor local en el puerto 3050, a través de una puerta/reverse-proxy en el 3000.

---

## 2. Arquitectura

Diagrama de referencia: `docs/arquitectura_club_pingui.svg`.

```
Navegador (three.js + socket.io-client)
   │  HTTPS (túnel Cloudflare)  pinguidev.corvet.dpdns.org
   ▼
server/redirect-server.js  :3000   (reverse proxy sin dependencias; menu en /menu)
   │  WebSocket + HTTP
   ▼
server/index.js  :3050   (Express estático + Socket.IO + API /api)
   │
   ├─ server/game.js      → lógica de juego autoritativa (salas, movimiento, combate, loot)
   ├─ server/auth.js      → registro/login (scrypt) y token por sesión (cookie httpOnly)
   ├─ server/db.js        → SQLite (WAL) vía better-sqlite3
   └─ server/appearance.js→ validación de apariencia/skins/laberinto personalización
```

Puntos clave:
- **Un solo proceso Node** sirve WebSocket (websocket + polling de respaldo), estáticos y API.
- El middleware de auth se aplica en socket.io (`io.use`): un socket puede portar cuenta o ser invitado.
- Límites de concurrencia: lobby `MAX_LOBBY = 16`, salas `MAX_ROOMS = 10`, `MAX_ROOM_MEMBERS = 8`.

---

## 3. Stack

| Capa | Tecnología |
|------|------------|
| Cliente 3D | three.js (ESM), WebGL, estilo cartoon, shaders GLSL (cielo), CanvasTexture (suelos / playeras) |
| Transporte | Socket.IO v4 (WebSocket principal, polling como respaldo) |
| Cliente utilidades | módulos ES puros (`public/js/*.js`) sin framework |
| Servidor | Node.js ≥ 20 (ESM), Express, Socket.IO |
| Datos | better-sqlite3, `journal_mode = WAL` |
| Voz | WebRTC (RTCPeerConnection) con señalización relay por socket (`voice:signal`) |
| Despliegue | Proceso local + túnel Cloudflare; compatible con Railway (Procfile, variables de entorno) |

---

## 4. Estructura del proyecto

```
server/
  index.js            Arranque HTTP/WS, estáticos, /healthz, apagado limpio
  game.js             Lógica de juego autoritativa (núcleo)
  auth.js             Router REST /api + middleware de auth por socket
  db.js               Conexión SQLite e inicialización de esquema
  appearance.js       Normalización/validación de apariencia (SKIN_IDS)
  redirect-server.js  Puerta del puerto 3000 (proxy → 3050; menú en /menu)
public/
  index.html          Lobby y HUD (DOM + capas; menú ☰ y chat)
  js/                 network, main, world, avatar, garments, skinDefs, combat,
                      viewmodel, weaponDefs, itemDefs, inventory, loot, chat, voice,
                      input, collision, mapDefs, mapObstacles, minimap, dressing,
                      appearance, hockey, session, etc.
  css/style.css       HUD responsive (menú ☰, chat y hojas táctiles; breakpoints 1200/900/821/820/600)
  debug/fpv.html      Visor de telemetría FPV (validación de postura sin capturas)
  test/               Harness ESM + suites de prueba + prueba de carga
docs/                 Fases, bitácora (script OOXML), reportes, diagramas
```

---

## 5. Modelo de datos (SQLite)

| Tabla | Campos | Notas |
|-------|--------|-------|
| `users` | id, username (UNIQUE NOCASE), password_hash, color, appearance (JSON), last_x, last_z, created_at | scrypt con salt por usuario |
| `sessions` | token (PK), user_id → users, expires_at, created_at | 30 días; se purgan cada hora |
| `messages` | id, space_id → spaces, user_id (nullable → invitados), text, created_at | FK estricta; los invitados no persisten mensajes |
| `spaces` | id, name (UNIQUE) | lobby y salas |

---

## 6. API REST (`/api`)

| Ruta | Método | Descripción | Errores |
|------|--------|-------------|---------|
| `/api/register` | POST | Crea cuenta (usuario + contraseña) | 400/409/429 |
| `/api/login` | POST | Inicia sesión, firma cookie httpOnly | 401/429 |
| `/api/logout` | POST | Cierra sesión, borra token | 401 |
| `/api/me` | GET | Devuelve perfil de la sesión | 401 |
| `/api/me/appearance` | PUT | Guarda la apariencia/skins del usuario | 400/401 |

- **Rate limit por IP** en register/login: 20 intentos en 15 min (`429`).
- **`GET /healthz`** (fuera de `/api`): `{ok, sessions}`; 503 si la BD falla.
- Errores de body JSON inválido → `400 {error}`; 404 JSON bajo `/api`.

---

## 7. Protocolo Socket.IO

### Cliente → servidor (`emit`)

| Evento | Payload | Throttle | Efecto |
|--------|---------|----------|--------|
| `player:join` | `{name}` | – | Entra al lobby; `welcome` con el snapshot |
| `player:move` | `{x,z}` | 40/1000 ms | Valida distancia ≤ 2.5 (anti-teleport) y transmite `player:moved` |
| `chat:message` | `{text}` | 6/1000 ms | Reenvía a lobby/sala; persiste si hay userId |
| `voice:signal` | `{targetId,...}` | 40/1000 ms | Relay de señalización WebRTC |
| `combat:shoot` | `{dx,dz}` | por arma (cooldown) | Disparo autoritativo; melee = arco, proyectiles con edad > 6 s se eliminan |
| `crystal:offer` | `{crystalId}` | – | Ofrece recoger un cristal (arma/comida/lanzable) |
| `crystal:respond` | `{crystalId,accept}` | – | Acepta/rechaza; si acepta se equipa (arma) o entra al inventario |
| `inventory:use` | `{slot}` | – | Solo en sala |
| `inventory:throw` | `{slot,dx,dz}` | – | Lanza objeto |
| `room:create` | `{name,mapId}` | 5/1000 ms | Crea sala; emite `room:state` |
| `room:join` | `{code}` | 5/1000 ms | Une a sala; valida existencia y cupo |
| `room:leave` | – | – | Abandona sala |
| `room:kick` | `{targetId}` | – | Solo el anfitrión |
| `room:close` | – | – | Cierra y expulsa a todos |

### Servidor → cliente (`on`)

`welcome`, `game:full`, `player:joined`, `player:moved`, `player:left`,
`chat:message`, `chat:history`, `room:state`, `room:list`, `room:kicked`,
`room:closed`, `room:ownerChanged`, `room:error`, `voice:signal`,
`combat:shot`, `combat:boom`, `combat:eliminated`, `combat:revived`,
`combat:regen`, `combat:slow`, `combat:heal`, `crystal:state`, `crystal:offer`,
`crystal:equip`, `inventory:update`, `inventory:toast`, `item:spawn`,
`hockey:state`, `hockey:goal`.

---

## 8. Reglas de juego (servidor autoritativo)

- **Movimiento:** posición validada por cámara de distancia; saltos > 2.5 se descartan (anti-teleport/sniping). El salto (Fase 4) envía `y` acotada a `[0, 3]` solo para animar a los remotos y **no** afecta al combate, que sigue siendo 2D. `ensureAliveForZone` revive al cambiar de zona.
- **Zonas:** el servidor coloca al jugador al entrar a cada zona. En salas usa `clearRoomSpawn()`, que busca un punto libre de coberturas en el anillo central (anillos deterministas + respaldo aleatorio); en el lobby y en la cordillera conserva el *nudge* de siempre.
- **Mapas de sala:** miden **120 m** (120 × 120) salvo Cordillera Nevada (600) y el Pueblo Nevado del lobby (80). Los layouts de coberturas viven en `public/js/mapObstacles.js` (módulo puro compartido con el servidor): 50-64 obstáculos por mapa, tres carriles, simetría 180° y plaza central despejada. `randomCrystalSpot` descarta posiciones dentro de un obstáculo con 1,1 m de margen.
- **Cadencia:** cada arma tiene cooldown propio; un solo `combat:shot` con `dx/dz` normalizados.
- **Vida/regeneración:** HP global con regeneración; `combat:slow` con duración explícita (`until`); al ser abatido → `combat:eliminated` y respawn.
- **Loot/cristales:** `makeCrystal` con tipo aleatorio ponderado; ofertas con expiración (`crystalTick` es un temporizador real — el respawn y la caducidad corren con `Date.now()`), entrega en lote con trayectoria.
- **Inventario:** uno por jugador; `inventory:use` restringido a sala; `inventory:throw` genera `item:spawn`.
- **Salas:** códigos únicos, permisos de anfitrión (`room:kick`, `room:close`), `room:list` expone `ownerId`.
- **Hockey:** mini-juego con estado y goles (`hockey:state`, `hockey:goal`).
- **Voz:** la señalización WebRTC se relay por el servidor; el audio es peer-to-peer.

---

## 9. Seguridad

- Contraseñas con **scrypt** (salt por usuario) — nunca en claro.
- Sesiones por token aleatorio en cookie **httpOnly**; expiración 30 días y purga periódica.
- Rate limit por IP en auth; throttle por socket sobre eventos de alta frecuencia.
- `x-powered-by` desactivado; `trust proxy` activo (HTTPS detrás de proxy).
- La única escritura de chat se hace **solo si existe `userId`** (los invitados no persisten mensajes → evita violaciones de FK que tumbarían el hilo del servidor).
- Invitados no pueden persistir nada sensible; la apariencia se normaliza en cliente y servidor.

---

## 10. Despliegue

### Local (entorno actual)
```bash
npm install
$env:PORT = "3050"; node server/index.js     # o npm start
node server/redirect-server.js               # puerta 3000 → 3050
```
Verificación: `GET http://127.0.0.1:3050/healthz` → `{ok:true}`.

### Público (túnel Cloudflare)
`pinguidev.corvet.dpdns.org` → localhost:3000 (redirect-server) → 127.0.0.1:3050.
Túnel gestionado remotamente por token, ejecutado como **servicio de Windows** `cloudflared`
(inicio automático al arrancar el equipo; no requiere sesión iniciada).

### Cloud/Railway
`Procfile` → `web: npm start`. Variables: `PORT` (inyectada), `DB_PATH` (apuntar a un
**volumen** persistente, p. ej. `/data/club.db`), `ENABLE_SPIKE=0`. Healthcheck
opcional sobre `/healthz`. El despliegue se enlaza por GitHub.

---

## 11. Pruebas y aseguramiento de calidad

Harness ESM en `public/test/` (loader que mapea `/vendor/three` a `node_modules` y
permite importar módulos de servidor/cliente en Node 24 con mocks de Socket.IO).

| Suite | Checks | Estado |
|-------|--------|--------|
| `t-servidor.mjs` (protocolo) | 45 | ✅ 45/45 · incluye salto/sprint/slide, presupuesto anti-speed-hack, puntaje, rachas, asistencias, anti-farmeo, tienda y persistencia de `user_stats` (1 skip ocasional por RNG de `bola_nieve`) |
| `t-logica.mjs` | 8 | ✅ 8/8 · incluye tamaños de mapa (120), coberturas por mapa, centro libre y `isInsideObstacle` |
| `t-auth.mjs` | 7 | ✅ 7/7 |
| `t-combate.mjs` | 18 | ✅ 18/18 |
| `t-armas.mjs` | 13 | ✅ 13/13 |
| `t-movimiento.mjs` | 8 | ✅ 8/8 |
| `t-loot.mjs` | 7 | ✅ 7/7 |
| `t-assets.mjs` | 10 | ✅ 10/10 |
| Carga `load.mjs` | 60 bots · 25 s | ✅ 60/60 admitidos, p95 chat 132 ms, RSS 100 MB, 0 disconnects |

Ejecutar:
```bash
node public/test/runner.mjs public/test/t-servidor.mjs
node public/test/load.mjs        # LOAD_BOTS, LOAD_DURATION_MS, LOAD_PORT opcionales
```

### Hallazgo relevante de las pruebas de carga (28/09)
`crystalTick` declaraba un segundo `const now` dentro del bucle de salas (TDZ): cualquier
cristal en estado *offered* al ejecutarse el tick apagaba el servidor. Corregido
renombrando la variable interna (`tickNow`). No aparecía en las suites de protocolo porque
esas simulan los temporizadores.

---

## 12. Archivos clave para mantenimiento

- `server/game.js` — la mayor parte de reglas y eventos; constantes de límites en las primeras líneas.
- `public/js/weaponDefs.js` / `itemDefs.js` — catálogo de armas (17) e ítems (datos centralizados).
- `public/js/skinDefs.js` + `garments.js` — skins y ropa conforme data-driven.
- `public/js/network.js` — mapa completo de eventos cliente↔servidor.
- `docs/bitacora.ps1` — genera `Bitacora_Modificaciones_ClubPingui.docx` (OOXML puro) con rúbricas por modificación (M01…FV5.1).
- `docs/Practica_Organizacion_Fases_ClubPingui.html` — actividades A1–A15 y cronograma académico.