# Reporte de Pruebas de Carga y Concurrencia — Club Pingüi (A11)

**Fecha:** 28/09/2026 · **Actividad académica:** A11 · **Estado:** Completado

## Objetivo

Verificar que el servidor real de Club Pingüi (Express + Socket.IO, Node.js) soporta
varios usuarios conectados de forma concurrente con latencias aceptables y sin caídas,
antes del cierre y publicación (Fase 4).

## Método

- Se escribió `public/test/load.mjs`, un test end-to-end que **levanta el servidor real
  en el mismo proceso** (`server/index.js`, `PORT=3311`, base de datos SQLite temporal)
  y le conecta **bots reales de `socket.io-client`** por WebSocket (`transports: websocket`,
  `reconnection: false`).
- Roles de los bots (parametrizables por env):
  - **Lobby residents** (se quedan el lobby): mueven al personaje y chatean.
  - **Creadores de sala**: crean una sala cada uno (máximo 10 por servidor).
  - **Joiners**: se unen a las salas existentes, se mueven, recogen y equipan armas
    (cristales vía `crystal:offer`/`crystal:respond`), disparan y chatean.
- Carga generada: `player:move` cada ~60 ms por bot, `chat:message` cada 2–4 s y ráfagas
  de `combat:shoot` en sala. Cuando el lobby está lleno, el servidor responde `game:full`
  y el bot reintenta la admisión (se cuenta cada evento).
- Métricas: latencia de conexión y de admisión (`welcome`), **RTT de chat end-to-end**
  (token `__RTT<ts>` incrustado: el bot emisor mide cuánto tarda en recibir su propio
  broadcast), eventos `player:moved` recibidos/segundo, `game:full`, errores de conexión,
  disconnects inesperados y memoria RSS del proceso.

## Hallazgo crítico durante el smoke test

La primera corrida (smoke) destapó un **bug crítico de producción** en `server/game.js`:
`crystalTick()` declaraba un segundo `const now` dentro del bucle de salas que eclipsaba
al `now` exterior, dejando en zona muerta (TDZ) la comparación de expiración de ofertas
de cristales — cualquier cristal en estado `offered` al ejecutarse el tick lanzaba
`ReferenceError` y el manejador de `uncaughtException` **apagaba todo el servidor**.

- **Corrección:** la variable interna se renombró a `tickNow` (1 línea).
- No había sido detectada antes porque las suites de protocolo simulan los temporizadores
  y `crystalTick` nunca se ejecuta en ellas.
- Tras el fix, el smoke y la corrida plena pasan sin excepciones.

## Resultados

### Smoke (validación del harness) — 16 bots, 9 s

| Métrica | Valor |
|---------|-------|
| Conexiones admitidas | 16/16 |
| Salas creadas / bots en sala | 3/3 · 14/14 |
| Armas obtenidas / disparos | 14 / 32 |
| `player:moved` recibidos/s | ~404 |
| RTT chat end-to-end (p50 / p95) | 11 / 13 ms |
| Errores de conexión / disconnects | 0 / 0 |
| RSS | 94.7 MB |

### Corrida plena — 60 bots, 25 s

| Métrica | Valor |
|---------|-------|
| Conexiones intentadas | 60 |
| **Admitidos en lobby** | **60/60 (100 %)** |
| `game:full` (lobby a capacidad) | 73 · todos reintentados sin pérdida |
| Errores de conexión | 0 |
| Disconnects inesperados | 0 |
| Lobby → salas creadas | 10/10 |
| Bots en sala | 52/52 |
| Armas obtenidas (flujo cristales) | 52 |
| Disparos | 387 |
| `player:moved` recibidos/s | ~619 |
| Conexión (p50 / p95) | 511 / 548 ms |
| Admisión (p50 / p95 / max) | 1144 / 1959 / 2071 ms |
| **RTT chat end-to-end (p50 / p95 / max)** | **118 / 132 / 133 ms** |
| Memoria RSS del proceso | 100.4 MB |

## Criterios de aceptación

| Criterio | Umbral | Resultado |
|----------|--------|-----------|
| Admisión completa bajo carga | 100 % | ✅ 60/60 |
| RTT de chat end-to-end p95 | < 250 ms | ✅ 132 ms |
| Disconnects no intencionales | 0 | ✅ 0 |
| Memoria (RSS) | < 400 MB | ✅ 100.4 MB |
| `game:full` sin pérdida de usuarios | reintentos efectivos | ✅ 73/73 |

## Conclusión

El servidor maneja 60 sesiones concurrentes reales (lobby + 10 salas) con admisión total,
sin desconexiones inesperadas, con RTT de chat p95 de 132 ms y ~619 eventos `player:moved`/s
procesados, usando ~100 MB de RAM. La carga también sirvió como prueba de robustez y
permitió descubrir y corregir el bug crítico de `crystalTick`. A11 queda cubierto.