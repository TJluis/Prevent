# Club Pingüi

Plataforma web de interacción social en 3D: avatares que se mueven en un espacio
compartido, chat de texto (general y por proximidad) y salas privadas con
permisos de anfitrión.

## Requisitos

- Node.js >= 20
- npm

## Proyectos y carpetas

- `server/` — backend Node.js (Express + Socket.IO)
- `public/` — frontend servido por el backend (Three.js, Socket.IO client)
- `public/css` y `public/js` — estilos y código del frontend

## Cómo correrlo

```bash
npm install        # primera vez
npm start          # node server/index.js
npm run dev        # reinicia automáticamente en cada cambio (desarrollo)
```

Abrir `http://localhost:3000`.

## Stack

- **3D:** Three.js (WebGL) — en el navegador, sin instalación.
- **Tiempo real:** Socket.IO (WebSocket) — sincronización de posiciones y chat.
- **Backend:** Node.js + Express.
- **DB (desde la Fase 2):** SQLite en desarrollo, migrable a MariaDB/MySQL.

## Versionado

- Rama principal: `main` (siempre estable).
- Cada fase vive en su propia rama `fase/<numero>-<nombre>` (ej. `fase/1-mapa-y-chat`)
  y se integra a `main` solo cuando cumple su criterio de "hecho".
- Se etiqueta cada fase terminada con `v0.<fase>` (ej. `v0.0`, `v0.1`).
- Mensajes de commit en español, siguiendo el patrón
  `Fase N: <resumen de lo hecho>`.

## Roadmap

- **Fase 0** ✔ Entorno, repo y servidor base.
- **Fase 0.5** Spike de WebRTC (validar riesgo de voz antes de construir UI).
- **Fase 1** Mapa 3D + avatar + movimiento + sincronización + chat de texto.
- **Fase 2** Cuentas de usuario, persistencia (SQLite) e historial.
- **Fase 3** Salas privadas y permisos de anfitrión.
- **Fase 4** Voz de proximidad (WebRTC).
- **Fase 5** Pulido, rendimiento e interfaz.
- **Fase 6** Prueba con usuarios reales y despliegue.

Criterio de "hecho" de cada fase: definido en cada commit de planificación.