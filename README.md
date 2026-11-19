# Club Pingüi

Plataforma web de interacción social en 3D: avatares que se mueven en un espacio
compartido, chat de texto (general y por proximidad), salas privadas con permisos
de anfitrión y una **Isla de Minijuegos** con portales a cada modalidad.

La primera modalidad jugable es **Encuentra los pares**: un tablero 3D que se recorre
a pie, donde se voltea una carta pisándola y saltando, con formatos 1v1 y 2v2 por
equipos. Las otras cinco (TNT Run, karts, ciudad rol, coliseo melee y escondite) ya
tienen su portal en la isla y se muestran como «próximamente» hasta que se implementen.

## Requisitos

- Node.js >= 20
- npm

## Proyectos y carpetas

- `server/` — backend Node.js (Express + Socket.IO)
- `public/` — frontend servido por el backend (Three.js, Socket.IO client)
- `public/css` y `public/js` — estilos y código del frontend

## Documentación

- [`docs/GUIA_DESARROLLO.md`](docs/GUIA_DESARROLLO.md) — arrancar, probar, respaldar y desplegar.
- [`docs/PLAN_MEJORAS_2026-11.md`](docs/PLAN_MEJORAS_2026-11.md) — mejoras de jugabilidad ya implementadas.
- [`docs/PLAN_MODALIDADES_2026-12.md`](docs/PLAN_MODALIDADES_2026-12.md) — plan de las seis modalidades nuevas (pares, coliseo, escondite, TNT, karts y ciudad).
- [`docs/INVESTIGACION_HERRAMIENTAS_2026-11.md`](docs/INVESTIGACION_HERRAMIENTAS_2026-11.md) — investigación de herramientas, versiones, licencias y veredictos.
- [`docs/Manual_Usuario_ClubPingui.md`](docs/Manual_Usuario_ClubPingui.md) — controles y uso para jugadores.

## Cómo correrlo

```bash
npm install        # primera vez
npm start          # node server/index.js
npm run dev        # reinicia automáticamente en cada cambio (desarrollo)
```

Abrir `http://localhost:3000`.

## Variables de entorno

| Variable       | Uso                                                        | Por defecto      |
|----------------|------------------------------------------------------------|------------------|
| `PORT`         | Puerto del servidor HTTP/WebSocket                         | `3000`           |
| `DB_PATH`      | Ruta del archivo SQLite (volumen en producción)            | `./data/club.db` |
| `ENABLE_SPIKE` | Habilita las rutas de desarrollo `/spike` (`1`)            | `0`              |

## Despliegue en Railway

1. Sube este repo a GitHub.
2. En Railway crea un **New Project → Deploy from GitHub** y selecciona el repo.
3. Railway detecta Node y usa `npm start` (o el `Procfile` incluido). Debe inyectar la variable `PORT` automáticamente y dar HTTPS.
4. Añade un **Volume** al servicio y monta la base de datos de forma persistente:
   - Crea un volume (p. ej. `club-data`) en el servicio.
   - Define la variable de entorno `DB_PATH` apuntando al volumen, p. ej. `/data/club.db`.
   - Sin esto, la BD se pierde en cada deploy (los datos son efímeros).
5. (Opcional) Añade un check de salud apuntando a `GET /healthz`.
6. Consulta la URL pública que te da Railway.

Notas:
- **WebSocket:** Socket.IO está configurado con `websocket` + `polling`; el HTTPS de Railway ya reenvía correctamente ambos.
- **Sesiones:** se guardan en la base de datos con expiración de 30 días, así que sobreviven a cada redeploy (cuenta configurada una vez, se mantiene logueada).
- **Sesiones en memoria** (mapa del mundo, salas, voz) son por proceso: un redeploy reinicia el estado en vivo de las salas, pero los datos persistentes (cuentas, posiciones, historial) se conservan.

## Stack

- **3D:** Three.js (WebGL) — en el navegador, sin instalación.
- **Tiempo real:** Socket.IO (WebSocket) — sincronización de posiciones y chat.
- **Backend:** Node.js + Express.
- **DB (desde la Fase 2):** SQLite en desarrollo, migrable a MariaDB/MySQL.
- **Modos de juego:** registro compartido en `public/js/modeDefs.js` + controladores
  autoritativos en `server/modes/` (la isla y cada modo son salas ocultas persistentes).

## Seguridad y notas

- **Rate limit por IP** en `/api/login` y `/api/register`: máximo 20 intentos en 15
  minutos por IP; responde `429` superado el límite (mediante `req.ip`, requiere
  `trust proxy` correcto al usar un proxy/HTTPS).
- **Throttle por socket** en `server/game.js`: los eventos de alta frecuencia
  (`player:move`, `chat:message`, `voice:signal`, `combat:shoot`, `room:create`,
  `room:join`) tienen límites por segundo por conexión; los eventos que exceden
  el límite se descartan silenciosamente.
- **Voz (WebRTC) y micrófono** requieren un *contexto seguro*: HTTPS (o
  `localhost`). En producción usa el HTTPS del proveedor; HTTP plano bloqueará
  el acceso al micrófono.
- Las contraseñas se guardan con `scrypt` (salt por usuario). Las sesiones duran
  30 días y se limpian de forma periódica.

## Versionado

- Rama principal: `main` (siempre estable).
- Cada fase vive en su propia rama `fase/<numero>-<nombre>` (ej. `fase/1-mapa-y-chat`)
  y se integra a `main` solo cuando cumple su criterio de "hecho".
- Se etiqueta cada fase terminada con `v0.<fase>` (ej. `v0.0`, `v0.1`).
- Mensajes de commit en español, siguiendo el patrón
  `Fase N: <resumen de lo hecho>`.

## Roadmap

- **Fase 0** ✔ Entorno, repo y servidor base.
- **Fase 0.5** ✔ Spike de WebRTC: señalización validada y audio entre dos pestañas funcionando.
- **Fase 1** ✔ Mapa 3D + avatar + movimiento + sincronización + chat de texto.
- **Fase 2** ✔ Cuentas de usuario, persistencia (SQLite) e historial.
- **Fase 3** ✔ Salas privadas y permisos de anfitrión.
- **Fase 4** ✔ Voz de proximidad (WebRTC).
- **Fase 5** ✔ Pulido, rendimiento e interfaz (avatars con orientación y animación, chat colapsable con horas relativas, minimapa, cabecera, mejoras de luces/cámara, pausa de render en pestaña oculta, recuperación WebGL, diseño responsive).
- **Fase 6** Despliegue y prueba con usuarios reales.
  - **6.1** ✔ Preparar para el despliegue (config por entorno, sesiones persistentes, healthcheck, spike aislado, Procfile, guía Railway).
  - **6.2** ✔ Prueba con usuarios reales (desplegar y recopilar feedback).
- **Fase 7** Pulido y balance del combate + diseño de interfaz.
  - Arreglar los solapamientos del HUD (HP/munición, chat, minimapa, salas y lista en línea).
  - HUD de combate centrado en la parte inferior, sobre las instrucciones.
  - Actualizar el texto de controles (disparo con clic izquierdo, recarga con `R`, cámara con clic derecho).
  - Balancear el combate: daño por disparo, cadencia, tamaño de cargador, tiempo de recarga y regeneración de vida.
  - Criterio de "hecho": la UI no se superpone en resoluciones de 360px a 1920px y todas las pruebas de regresión siguen pasando.
  - **7.1** ✔ Animación de muerte "líquida": al ser abatido, el pingüino se derrite/colapsa hacia el suelo dejando un charco en el lugar, y al reaparecer (10s) se materializa levantándose desde el charco. El charco permanece como marca durante todo el respawn. Criterio: la animación aplica por igual al jugador propio y a los demás (client-side), y se ve correctamente tanto al morir como al revivir.
  - **7.2** ✔ Personalización del avatar: pantalla de vestidor al entrar (cuerpo, panza, pico, sombrero, bufanda, lentes + vista previa 3D y aleatorio), persistencia por cuenta (`PUT /api/me/appearance`) y vestidor reabrible dentro del juego (botón "👕 Vestidor").
  - **7.3** ✔ Skins: selector de trajes al final del módulo de personalización — traje, playero, programador, sencillo, táctico, voleibol, sombrero de paja, pirata, ninja y fiesta — con variantes visuales en el avatar (cliente y servidor validan el mismo set).
- **Fase 8** Expansión de modalidades (plan en `docs/PLAN_MODALIDADES_2026-12.md`).
  - **8.0** ✔ Isla de Minijuegos: portal en el lobby, sala persistente oculta `ISLA` con mapa propio y seis portales (uno por modalidad). Los portales «próximamente» avisan sin cambiar de zona.
  - **8.1** ✔ Encuentra los pares: minijuego 3D con dos formatos (1v1 · 16 cartas · 4×4 y 2v2 · 36 cartas · 6×6, cada uno en su sala oculta). Se elige equipo pisando una plataforma, la partida arranca con cuenta atrás, el jugador pisa una carta y salta para voltearla, y la pareja acertada vuela al atril del equipo. Servidor autoritativo en `server/modes/pairs.js`, render en `pairsBoard.js`, HUD no modal y cámara elevada sobre el tablero.
  - **8.2** Coliseo melee · **8.3** Escondite · **8.4** TNT Run · **8.5** Karts · **8.6** Ciudad rol — pendientes.

Criterio de "hecho" de cada fase: definido en cada commit de planificación.