# Plan de expansión · Modalidades de juego Club Pingüi

**Fecha:** 18/11/2026
**Base de código:** `C:\Users\tslui\Downloads\Proyecto_ClubPingui\Proyecto_ClubPingui`
**Documento hermano:** [`INVESTIGACION_HERRAMIENTAS_2026-11.md`](INVESTIGACION_HERRAMIENTAS_2026-11.md)
**Alcance:** seis modalidades nuevas — Encuentra los pares, Coliseo melee, Escondite, TNT Run, Karts y Ciudad rol (primera persona).

---

## 0. Resumen ejecutivo

La petición no es "añadir seis mapas": es convertir un **lobby con salas PVP** en una
**plataforma de modos**. Eso exige tres cosas antes de escribir el primer minijuego:

1. **Un contrato de modo** (reglas, estado, tick, fin de partida) para que cada modalidad
   sea un módulo conectable y no un `if` gigante dentro de `server/game.js`.
2. **Arenas propias** separadas de los mapas PVP, porque los seis modos necesitan
   geometría, spawns y límites distintos.
3. **Un orden** que respete el calendario académico: **versión estable 23/11/2026**,
   **entrega final 02/12/2026**, **aceptación 15/12/2026**.

**Decisión recomendada:** no meter modos nuevos antes del 23/11. Entre el 23/11 y el
02/12 solo se documenta y se prepara la infraestructura. La expansión real empieza el
**03/12/2026** y se entrega por olas, en este orden:

| Ola | Modo | Por qué en ese orden |
|---|---|---|
| 1 | Encuentra los pares | Turnos, sin física, sin red compleja. Valida el contrato de modo completo con el menor riesgo. |
| 2 | Coliseo melee | Reutiliza el 80 % del combate que ya existe; valida rondas, espectadores y *loadouts*. |
| 3 | Escondite | Reutiliza mapas y línea de visión; valida roles asimétricos y fases de partida. |
| 4 | TNT Run | Valida destrucción de escenario y *ticks* rápidos sin motor de física. |
| 5 | Karts | Primera modalidad que **sí** necesita física (Rapier) y predicción de cliente. |
| 6 | Ciudad rol | Mundo persistente, 30–50 jugadores, *interest management*. Es un proyecto aparte. |

**Esfuerzo total estimado:** ~55–65 días de trabajo enfocado (una persona + asistencia IA),
repartidos entre diciembre de 2026 y febrero de 2027.

### 0.1 Estado real (19/11/2026)

El usuario pidió adelantar las olas 1, 2 y 3, así que la base de la expansión, el
primer modo con combate y el primer modo de roles asimétricos ya están en el código
y probados:

| Entregado | Dónde |
|---|---|
| Registro de las seis modalidades (`live`/`soon`) | `public/js/modeDefs.js` |
| Isla con spawn, anillo de 6 portales y puerta del lobby | `public/js/hubDefs.js`, `public/js/world.js` |
| Salas ocultas persistentes `ISLA` y `MODO-<ID>` | `server/game.js` (`ensureHub`, `ensureModeRoom`) |
| Validación de portal (6 m) y guardas de combate/tienda | `server/game.js` (`mode:join`, `mode:action`) |
| Pares autoritativo con dos formatos (1v1 y 2v2) | `server/modes/pairs.js` |
| Tablero 3D físico, plataformas de equipo y atriles | `public/js/pairsBoard.js`, `public/js/pairsDefs.js` |
| HUD no modal y selector de formato | `public/js/pairs.js`, `public/index.html`, `public/css/style.css` |
| Coliseo autoritativo con 1v1, 2v2 y FFA | `server/modes/coliseo.js` |
| Arena circular 3D, loadout melee y HUD de rondas | `public/js/coliseoDefs.js`, `public/js/coliseo.js`, `public/js/world.js` |
| Mapa interno `coliseo` (52) con muro circular | `public/js/mapDefs.js`, `public/js/mapObstacles.js`, `public/js/collision.js` |
| Persistencia `duel_wins` y `duel_rounds` | `server/db.js` (`user_stats`) |
| Escondite autoritativo con roles y fases | `server/modes/escondite.js` |
| Contratos de escondites, LOS y claves de reconexión | `public/js/hideDefs.js`, `public/js/mapObstacles.js` |
| Aldea 3D con jaula, 12 escondites y HUD de rol | `public/js/world.js`, `public/js/escondite.js` |
| Mapa interno `escondite` (72) y portal en vivo | `public/js/mapDefs.js`, `public/js/hubDefs.js` |
| Persistencia `hide_wins` y `seek_wins` | `server/db.js` (`user_stats`) |
| Mapas internos `isla` (64) y `pares` (44) | `public/js/mapDefs.js`, `public/js/mapObstacles.js` |
| Suites de isla/modos/Pares, Coliseo y Escondite | `public/test/t-modos.mjs`, `public/test/t-coliseo.mjs`, `public/test/t-escondite.mjs` |

Las otras tres modalidades siguen en `status:"soon"`: su portal se ve, pero el
servidor responde «todavía no está disponible» sin cambiar de zona. Lo pendiente de
Pares, Coliseo y Escondite está al final de §3.1, §3.2 y §3.3.

---

## 1. Estado de partida verificado

Todo lo siguiente está comprobado en el código, no supuesto.

| Hecho | Dónde |
|---|---|
| Límites actuales: 16 en lobby, 10 salas, 8 por sala | `server/game.js:30-32` |
| Una sala es un objeto plano: `{code, name, mapId, ownerId, ownerName, members:Set, chat:[]}` | `server/game.js:1366-1374` |
| El movimiento se valida en `player:move` y se retransmite a ciegas al canal | `server/game.js:877`, `:933`, `:935` |
| El tick de hockey corre a 50 ms; los cristales a 1000 ms | `server/game.js:1614-1615` |
| Velocidad de caminata `6 m/s`; el salto es cosmético | `public/js/main.js:93`, `:1444-1457` |
| Los mapas son datos puros compartidos cliente/servidor | `public/js/mapDefs.js:5-14`, `public/js/mapObstacles.js` |
| El combate ya distingue melee de hitscan por `weapon.class` | `public/js/weaponDefs.js`, `server/game.js:701-721` |
| El renderer es WebGL con sombras PCF y ACES | `public/js/world.js:2382-2393` |
| La persistencia es SQLite con `users`, `sessions`, `messages`, `user_stats` y una tabla `spaces` sin uso | `server/db.js:14-60` |
| El servidor es un solo proceso Node; no hay *sharding* ni Redis | `server/index.js` |
| Límite medido: ~60 sesiones concurrentes, 619 eventos/s, p95 RTT 132 ms, ~100 MB RSS | `docs/Reporte_Pruebas_Carga_A11.md` |

**Lectura:** el proyecto tiene una base sólida de movimiento, combate y salas, pero
**no tiene concepto de "modo"**. `mapId` es hoy la única variación de una sala. Ese es
el punto exacto de extensión.

---

## 2. Arquitectura objetivo

### 2.1 Principio rector

> Un modo es un **módulo de reglas** que se enchufa a una sala. El movimiento, la red,
> el chat, el HUD y el render se comparten; solo cambian reglas, arena, estado y condición
> de victoria.

Nada de ECS todavía (ver investigación, §12). Nada de migrar de motor. Se mantiene
**Three.js + Socket.IO + SQLite** y se añade **Rapier** solo donde haga falta (Karts).

### 2.2 Capas

```
public/js/
  modeDefs.js          ← registro de modos (datos puros, compartido)
  modeMath.js          ← fórmulas puras: puntaje, rondas, emparejamiento de cartas
  modePairs.js         ← reglas puras del tablero de pares
  modeColiseum.js      ← reglas puras de rondas y loadout melee
  modeHide.js          ← reglas puras de roles y fases
  modeTnt.js           ← rejilla, capas y caída de bloques
  modeKarts.js         ← vueltas, checkpoints y orden de llegada
  arenas.js            ← geometría de arenas (compartida con el servidor)

server/modes/
  index.js             ← registro y despacho
  pairs.js             ← controlador autoritativo
  coliseum.js
  hide.js
  tnt.js
  karts.js
```

`public/js/*` sigue siendo plano y sin build step. `server/modes/` es la primera
subcarpeta del servidor; se justifica porque cada modo puede superar las 300 líneas.

### 2.3 Contrato de modo

Cada modo implementa la misma interfaz. El servidor no sabe qué hay dentro.

```js
// server/modes/index.js
export const MODE_CONTROLLERS = {
  pares: createPairsMode,
  coliseo: createColiseoGame,
  escondite: createHideMode,
  tnt: createTntMode,
  karts: createKartsMode,
};

// Cada controlador devuelve:
{
  id,                       // "pares"
  tickMs,                   // 100 turnos · 50 acción · 33 karts
  minPlayers, maxPlayers,   // 2..6 · 2..8 · 3..12 · 4..16 · 2..8
  allowMidJoin,             // true = entra como espectador
  createState(room),        // estado inicial serializable
  onJoin(state, player),    // devuelve eventos
  onLeave(state, player),
  onAction(state, player, action),   // intención validada aquí
  tick(state, dtMs, now),   // avanza reglas, devuelve eventos
  isFinished(state),        // null | {winnerId, ranking}
  snapshot(state),          // lo que ve el cliente
}
```

Reglas de oro:

- El cliente **solo envía intenciones** (`{type:"flip", index:7}`), nunca resultados.
- Todo lo aleatorio (barajado, spawns, orden de turnos) se genera en el servidor con
  semilla guardada, para poder reproducir una partida en pruebas.
- El estado público se emite por `mode:state`; los eventos puntuales por `mode:event`.
- El estado privado (qué carta eres, qué rol tienes) va por `emit` individual, no por
  difusión de sala.

### 2.4 Eventos nuevos

| Evento | Dirección | Payload |
|---|---|---|
| `mode:list` | S→C | `[{id, name, players, max, status}]` |
| `mode:create` | C→S | `{modeId, isPublic, options}` |
| `mode:join` | C→S | `{code}` (o `{modeId}` para emparejamiento rápido) |
| `mode:state` | S→C | `{modeId, phase, remainingMs, public, you}` |
| `mode:action` | C→S | `{type, ...}` |
| `mode:event` | S→C | `{type, ...}` (volteo, golpe, bloque caído, meta) |
| `mode:result` | S→C | `{winnerId, ranking, rewards}` |
| `mode:left` | S→C | `{playerId}` |

Se mantienen intactos `room:*`, `player:*`, `chat:*`, `combat:*`, `crystal:*`,
`inventory:*`, `hockey:*`, `score:*`. Los modos **no** reutilizan `combat:shot` para
reglas propias; lo reutilizan solo para el efecto visual del melee en Coliseo.

### 2.5 Sala con modo

```js
const room = {
  code, name, mapId, ownerId, ownerName,
  members: new Set(),
  chat: [],
  modeId: "pares",        // nuevo
  mode: null,             // estado del controlador
  status: "waiting",      // waiting | playing | finished
  isPublic: true,
  spectators: new Set(),  // nuevos
  createdAt, startedAt,
};
```

Compatibilidad: una sala sin `modeId` se comporta **exactamente** como hoy (PVP libre).
Así los tests actuales y las salas existentes no se rompen.

### 2.6 Cámara y controles por modo

`modeDefs.js` declara restricciones que `main.js` respeta:

```js
{ id:"ciudad", camera:"first", allowThirdPerson:false, allowCombat:false }
{ id:"coliseo", camera:"both", allowRanged:false, loadout:"melee" }
{ id:"karts", camera:"chase", allowJump:false, movement:"vehicle" }
```

Hoy `main.js` alterna 1.ª/3.ª persona libremente. La restricción se aplica en el
punto donde se lee la tecla de cámara, no en el renderer.

---

## 3. Las seis modalidades

### 3.1 Encuentra los pares

**Concepto:** tablero de cartas 3D en una arena pequeña. El jugador camina sobre el
tablero, pisa una carta y salta para voltearla. Por turnos, cada bando voltea dos
cartas: si coinciden, suma, las cartas vuelan a su atril y repite turno; si no, pasa
el turno. Gana quien más parejas encuentre.

| Aspecto | Definición |
|---|---|
| Jugadores | 1v1 (2) y 2v2 (4); un equipo por plataforma |
| Tablero | 1v1 → 4×4 (8 parejas); 2v2 → 6×6 (18 parejas) |
| Duración | 3–6 min |
| Arena | Plataforma de 22 m, sin obstáculos; cámara elevada y fija sobre el tablero |
| Estado servidor | `cards[]`, `teams[]` (miembros, marcador, atril), `turnTeam`, `status`, `countdownMs`, `waitMs` |
| Acciones | `mode:action {type:"team"}` (se deduce la plataforma) · `{type:"flip"}` (se deduce la carta pisada) |
| Trampa clásica | Saltar dos veces sobre la misma carta o voltear fuera de turno; se resuelve con `waitMs` y la posición autoritativa |
| Victoria | Mayor número de parejas al agotar el tablero |
| Persistencia | `user_stats` gana `pairs_wins`, `pairs_games` (pendiente) |
| Esfuerzo | **4 días** |
| Estado | **✔ Implementado (18/11/2026)** salvo lo listado abajo |

**Implementado:** tablero 3D real (malla, cartas, plataformas y atriles), selector de
formato al entrar al portal, elección de equipo pisando la plataforma, cuenta atrás
cuando ambos equipos están completos, turno por equipo, volteo autoritativo al saltar
sobre la carta, vuelo de la pareja al atril del equipo ganador y reinicio de la ronda.
La cámara elevada permite **zoom** con la rueda del ratón, las teclas `+`/`-` o los
botones del HUD (0,55×–1,9×) para leer mejor las cartas. El servidor deduce la carta de
la posición autoritativa y valida turno, cooldown y proximidad; nunca envía emojis de
cartas ocultas. HUD DOM no modal, cámara elevada dentro de la arena, fundido de
entrada/salida y vuelta a la isla. Suite `t-modos` con **13/13** (incluye partida
determinista, 2v2 con sala propia y el flujo real isla → portal → partida → isla).

**Pendiente de Pares:** espectadores y reconexión como espectador, estadísticas
persistentes (`pairs_wins`/`pairs_games`), revancha votada y más variantes de tablero.

**Por qué primero:** ejercita el 100 % del contrato (turnos, estado privado, fin de
partida, espectadores, revancha) sin física ni *netcode* difícil. Si el contrato falla,
falla barato.

**DoD (original):** dos navegadores completan una partida; el servidor rechaza voltear
fuera de turno, índice inválido y tercer volteo; recarga de página a mitad vuelve como
espectador; test `t-mode-pares.mjs` con 12 aserciones. La suite se integró como
`t-modos.mjs` (13 aserciones) y el rediseño 3D sustituyó el tablero DOM; el resto del
DoD (espectadores/reconexión) queda para la siguiente tanda.

---

### 3.2 Coliseo melee

**Concepto:** arena circular cerrada, solo armas melee, rondas al mejor de 5.

| Aspecto | Definición |
|---|---|
| Jugadores | 2–8 (1v1, 2v2, FFA) |
| Arena | Coliseo de 34 m de diámetro, arena central, gradas, 4 pilares, sin cobertura alta |
| Loadout | `daga`, `espada`, `maza`, `escudo`, `martillo`; se elige antes de la ronda |
| Rondas | 90 s o hasta que quede un bando; 3 s de cuenta atrás entre rondas |
| Reglas | HP 100, sin curación, sin cristales, sin lanzables, sin armas de fuego |
| *Game feel* | *hit-stop* de 60 ms, sacudida de cámara, *knockback* y sonido por impacto |
| Estado servidor | `round`, `scores{}`, `phase` (`countdown`/`fight`/`roundEnd`/`matchEnd`), `loadouts{}` |
| Acciones | `pickWeapon {weaponId}` · `ready` |
| Victoria | Primer bando a 3 rondas |
| Persistencia | `user_stats` gana `duel_wins`, `duel_rounds` |
| Esfuerzo | **5 días** |

**Reutilización:** el cono melee ya existe (`arc`, `range`, `cooldownMs`), el escudo con
aguante ya existe, y `combat:shot` ya transporta el golpe. El trabajo real es:
filtrar el arsenal, resetear posiciones, gestionar rondas y espectadores, y pulir el
*feedback*.

**Riesgo principal:** que el 1v1 se sienta "ping-pong" por el *netcode* actual (sin
predicción). Mitigación: el melee ya es tolerante (cono amplio, 450 ms de *cooldown*);
si hace falta, se añade *lag compensation* de 100 ms en el servidor.

**DoD:** 1v1 y 2v2 completos; un arma de fuego solicitada por un cliente manipulado se
rechaza; al morir se pasa a espectador con cámara libre; test `t-mode-coliseo.mjs`.

**Estado (18/11/2026): entregado.** Se implementaron las tres variantes (1v1, 2v2 y
FFA hasta 8) con una sala oculta por formato (`MODO-COLISEO-<VARIANTE>`), el
controlador autoritativo de fases (`waiting`/`countdown`/`fight`/`roundEnd`/`matchEnd`),
el marcador al mejor de 5, el loadout melee y la persistencia `duel_wins`/`duel_rounds`.

Decisiones de implementación que conviene recordar:

| Tema | Cómo quedó |
|---|---|
| Entrada | Solo en `waiting` o `countdown`; en partida en curso el servidor responde «La partida ya está en marcha. Espera al reinicio». |
| Movimiento | El servidor ignora `player:move` fuera de `fight` y aplica `coliseoClamp` al círculo de 16,35 m. |
| Armas | `combat:shoot` descarta cualquier arma que no sea melee del loadout; no hay fuego amigo entre compañeros de bando. |
| Bajas | Sin respawn ni puntos de kill: el jugador queda espectador hasta la ronda siguiente. |
| Curación y lanzables | `inventory:use`, `inventory:throw`, cristales y tienda quedan bloqueados dentro del Coliseo. |
| Espectador | La cámara sigue libre, pero el cliente no puede moverse ni golpear hasta que empieza la ronda. |
| Suite | Se llama `t-coliseo.mjs` (patrón `t-*.mjs` del proyecto) y cubre 14 bloques, no 18 aserciones sueltas. |

Queda pendiente para una tanda futura el *feedback* de impacto (hit-stop, sacudida y
sonido por golpe) y la revancha votada; el reinicio automático a los 12 s ya funciona.

---

### 3.3 Escondite

**Concepto:** un buscador y N escondidos. Fase de escondite, fase de búsqueda, última
persona sin atrapar gana (o el buscador si atrapa a todos).

| Aspecto | Definición |
|---|---|
| Jugadores | 3–12 |
| Roles | 1 buscador, resto escondidos; el buscador se elige al azar con semilla |
| Fases | `waiting` (sin temporizador, arranca cuando todos están listos) → `hide` 90 s (buscador congelado en jaula) → `seek` 180 s → `result` |
| Arena | Mapa dedicado `escondite` (72 m) con jaula central en (0,0), doce escondites en anillo (radio 29,5) y coberturas a radio 24 que bloquean la LOS desde la jaula |
| Habilidades | Escondido: 3 esquivas de 0,55 s cada 25 s (`G`). Buscador: pulso de detección de 8 m cada 30 s (`G`) |
| Detección | Distancia < 1,6 m + línea de visión libre (segmento contra `HIDE_COVERS`) |
| Estado servidor | `phase`, `round`, `seekerId`, `players[]` (`role`, `tagged`, `dashes`, `dashUntil`, `pulseMs`, `offline`) |
| Acciones | `ready` · `tag {targetId}` (`F`, solo buscador) · `dash` · `pulse` |
| Victoria | Escondido: sobrevivir. Buscador: atrapar a todos antes del tiempo |
| Persistencia | `user_stats` gana `hide_wins`, `seek_wins` |
| Esfuerzo | **5 días** |

**Riesgo principal:** mapas actuales tienen pasillos rectos y poca verticalidad; sin
escondites reales el modo muere en 30 s. Mitigación: se creó un mapa dedicado con doce
escondites auditados y prueba de línea de visión desde la jaula para cada uno.

**Estado (19/11/2026): entregado.** Se implementó el modo completo sobre el contrato
de `modeDefs.js`. Se adelantó respecto al calendario de la Ola 2 por petición del
usuario, después del Coliseo y siguiendo el orden real Pares → Coliseo → Escondite.

Decisiones de implementación que conviene recordar:

| Tema | Cómo quedó |
|---|---|
| Fase inicial | El plan preveía 20 s de `lobby`; se implementó `waiting` sin reloj: arranca cuando hay ≥3 jugadores y todos pulsan «Listo». |
| Arena | En vez de reutilizar mapas de sala (120 m), se añadió `escondite` (72 m) con jaula central y aldea procedural, para garantizar cobertura real. |
| Buscador | Elegido con RNG sembrado e inyectable en tests; teletransportado a (0,0) durante `hide`, con `player:move` ignorado por el servidor y bloqueo local en el cliente. |
| Etiqueta | `F` elige al escondido más cercano del que haya recibido actualizaciones; el servidor valida distancia < 1,6 m, rol, fase y línea de visión libre. |
| Pulso | `G` llama a `pulse`; el evento público de sala lleva `hits: []` y solo el buscador recibe los aciertos por `emit` individual. |
| Esquivas | Se agotan de tres en tres y se recargan de golpe a los 25 s del primer uso (`tick()` del controlador). |
| Reconexión | Gracia de 45 s con `stableHideKey` (`userId` para cuentas, nombre normalizado para invitados); el servidor emite `mode:rejoin` y el cliente reingresa con `mode:join {rejoin:true}`. |
| Ocultación | Quien está dentro de un escondite se ve atenuado para el resto; al terminar la partida el buscador ve a todos. |
| Sin combate | `combat:false`: disparos, bloqueo, cristales, tienda, curación y lanzables se rechazan dentro del modo. |
| Suite | `t-escondite.mjs` (15/15), integrada en `scripts/test-all.ps1`; cubre contrato, LOS, controlador, persistencia y servidor real con Socket.IO simulado. |

**DoD verificado:** 3 partidas completas con semillas distintas (victoria del buscador
y victoria de los escondidos por tiempo); las coberturas bloquean la etiqueta a 1,4 m;
el buscador no se mueve durante `hide`; la reconexión conserva el rol 45 s y expira
después; la batería completa queda en 11/11.

---

### 3.4 TNT Run

**Concepto:** capas de bloques que desaparecen al pisarlas. El último que queda en pie
gana. Sin motor de física: rejilla y soporte.

| Aspecto | Definición |
|---|---|
| Jugadores | 4–16 |
| Arena | 5 capas de 16×16 bloques (1,5 m entre capas), isla flotante sobre el vacío |
| Regla | Al pisar un bloque, arranca una mecha de 600 ms; luego cae y deja hueco |
| Caída | Si no hay bloque bajo los pies → eliminado (no hay daño, no hay *respawn*) |
| Ritmo | 20 Hz de tick; 8 bloques por segundo máximo por jugador |
| Estado servidor | `layers[]` como bitset, `pending[]`, `alive[]`, `eliminated[]` |
| Acciones | Solo movimiento; el servidor deriva el bloque pisado de `x,z` |
| Victoria | Último vivo; si el tiempo llega a 5 min, gana el que esté en la capa más alta |
| Persistencia | `user_stats` gana `tnt_wins`, `tnt_blocks` |
| Esfuerzo | **6 días** |

**Rendimiento:** 5 × 256 = 1280 bloques. Se renderizan con un `InstancedMesh` por capa
(5 *draw calls*) y se actualizan matrices al caer. No hace falta `BatchedMesh` ni física.

**Riesgo principal:** el anti-cheat de movimiento actual permite 2,5 m por envío; un
cliente manipulado podría "volar" entre capas. Mitigación: validar caída contra la
rejilla y limitar el cambio de altura por tick; el salto se desactiva en este modo.

**DoD:** partida de 8 bots termina en < 5 min; no se puede quedar flotando; los bloques
caen con animación y sonido; test `t-mode-tnt.mjs` sobre la rejilla pura.

---

### 3.5 Karts

**Concepto:** carreras de 8 jugadores en un circuito cerrado, 3 vueltas, con derrape y
potenciadores.

| Aspecto | Definición |
|---|---|
| Jugadores | 2–8 (12 con *sharding*) |
| Física | Rapier `DynamicRayCastVehicleController` (chasis dinámico + 4 ruedas por raycast) |
| Pista | *Spline* cerrada extruida a malla, 6 m de ancho, muros invisibles, 3 zonas de *boost* |
| Validación | 12 checkpoints por vuelta, en orden; el servidor rechaza saltos de checkpoint |
| Red | 20 Hz de estado, predicción de cliente + reconciliación; inputs con *buffer* de 150 ms |
| Cámara | Persecución con FOV dinámico; sin 1.ª persona en la primera versión |
| Estado servidor | `racers{id: {lap, checkpoint, progress, speed, position}}`, `racePhase`, `finishOrder[]` |
| Acciones | `input {throttle, brake, steer, drift}` a 30 Hz |
| Victoria | Primer *finishOrder* completo; ranking por vueltas + checkpoints + tiempo |
| Persistencia | `user_stats` gana `kart_wins`, `kart_best_lap_ms` |
| Esfuerzo | **10 días** + **3 días de spike** de física/predicción |

**Riesgo principal:** es la modalidad más difícil técnicamente. El *netcode* actual
(Socket.IO, sin predicción) no sirve para un vehículo rápido. Dos caminos:

- **A (recomendado):** *spike* con Colyseus 0.18 en un proceso aparte, que ya trae
  predicción y *lag compensation*; el resto del juego sigue en Socket.IO.
- **B:** implementar predicción y reconciliación a mano sobre Socket.IO. Más control,
  más días, más riesgo.

El *spike* decide. Si Colyseus no encaja, se hace B con el vehículo "cinemático
autoritativo" y se acepta un poco de *rubber-banding*.

**DoD:** 4 bots completan 3 vueltas sin desincronizarse; un cliente con 150 ms de latencia
puede conducir; no se puede cortar la pista; el kart no atraviesa muros; test
`t-mode-karts.mjs` sobre checkpoints y ranking.

---

### 3.6 Ciudad rol (primera persona)

**Concepto:** un distrito persistente donde 30–50 jugadores conviven, coleccionan
objetos, amueblan su casa, trabajan y rolean. **Solo primera persona.**

Esta modalidad no es "otra sala": es otro producto. Necesita cosas que hoy no existen.

| Necesidad | Estado actual | Trabajo |
|---|---|---|
| Mundo persistente | Salas en memoria que mueren al cerrarse | Proceso/shard con estado duradero |
| 30–50 jugadores | Límite práctico ~60 sesiones totales | *Interest management* por celdas de 20 m |
| Objetos colocados | Nada | Tabla `city_objects` + editor de rejilla |
| Coleccionables | Cristales efímeros | Tabla `city_collectibles` con *respawn* y contador por usuario |
| Economía | Puntos de sesión | Moneda persistente + topes anti-farm |
| Casas | Nada | Parcelas (`city_plots`) + permisos + muebles |
| Trabajos/rol | Nada | 3 trabajos simples (repartidor, pescador, minero) con minijuego de 30 s |
| Assets | Todo procedural | Muebles y edificios low-poly (Blender → glTF) o procedurales |
| Moderación | Chat + reportes básicos | Registro de reportes, silenciar, zonas seguras |

**Arquitectura propuesta:** un **servidor de mundo** separado del servidor de salas.
Socket.IO con *namespaces* (`/city`) y celdas de interés; o Colyseus si el *spike* de
Karts sale bien. El lobby y las salas PVP siguen en el proceso actual.

**Esfuerzo:** **20–25 días**, en 5 subfases:

| Subfase | Entrega | Días |
|---|---|---|
| C1 | Distrito procedural + 30 jugadores con *interest management* + cámara FP bloqueada | 6 |
| C2 | Coleccionables persistentes + inventario + economía | 5 |
| C3 | Parcelas y editor de muebles | 6 |
| C4 | 3 trabajos con minijuego | 4 |
| C5 | Moderación, zonas seguras, pulido y carga | 4 |

**Riesgo principal:** el rendimiento. 50 avatares con etiquetas y animación superan lo
medido. Mitigación: etiquetas solo a < 15 m, animación a 15 Hz para lejanos, *culling*
por celda, y prueba de carga específica antes de C2.

**DoD:** 30 bots + 2 humanos durante 20 min sin caídas; el RTT p95 se mantiene < 200 ms;
un objeto colocado sobrevive a reinicio del servidor; un jugador no ve a quien está a
más de 40 m; la cámara no sale de primera persona.

---

## 4. Calendario

Hoy es **18/11/2026**.

| Fecha | Hito | Qué se hace |
|---|---|---|
| 18–22/11 | Congelación | Solo documentación, pruebas y estabilización. **Nada de modos nuevos.** |
| 23/11 | **Versión estable** | Tag `v0.2`; demo con lo que ya existe |
| 24/11–02/12 | Cierre académico | Documentos, presentación, pruebas de regresión. Como máximo, el **contrato de modo** sin UI |
| 02/12 | **Entrega final** | Proyecto cerrado y respaldado |
| 03–07/12 | Ola 0 | Fundaciones de modos + Encuentra los pares |
| 08–12/12 | Ola 1 | Coliseo melee |
| 13–15/12 | **Aceptación** | Demo estable de las dos primeras olas |
| 16–22/12 | Ola 2 | Escondite |
| 23/12–05/01 | Ola 3 | TNT Run (con pausa navideña) |
| 06–18/01 | Ola 4 | Karts (*spike* + implementación) |
| 19/01–20/02 | Ola 5 | Ciudad rol |

Si el usuario quiere **antes** del 02/12 algo visible, la única opción honesta es
**Encuentra los pares** en versión mínima (tablero 4×4, 2–4 jugadores, sin equipos, sin
persistencia) en **3 días**. Eso consume el margen de estabilización; el plan lo marca
como riesgo, no como recomendación. Se adelantó el 18/11/2026 y terminó yendo más allá
del mínimo: tablero 3D físico, 1v1 y 2v2 por equipos y atriles.

**Adelanto del 18/11/2026:** también se entregó la **Ola 2 (Coliseo melee)** en el orden
real del proyecto (Pares → Coliseo), aunque la tabla rotule «Ola 1» como Coliseo y
«Ola 2» como Escondite.

**Adelanto del 19/11/2026:** se entregó el **Escondite** (rotulado «Ola 2» en la tabla,
tercero en el orden real). Quedan en vivo Pares, Coliseo y Escondite; el siguiente
entregable es **TNT Run**.

---

## 5. Fundaciones (Ola 0) — el trabajo que no se ve

Sin esto, cada modo duplica código y el proyecto se vuelve inmantenible.

| Tarea | Archivos | Días |
|---|---|---|
| `modeDefs.js` + registro de modos | `public/js/modeDefs.js`, `server/modes/index.js` | 1 |
| Extender sala con `modeId`, `status`, `spectators` | `server/game.js` | 0,5 |
| Eventos `mode:*` en cliente y servidor | `public/js/network.js`, `server/game.js` | 0,5 |
| Arenas compartidas + `kind` en `MAPS` | `public/js/arenas.js`, `public/js/mapDefs.js`, `public/js/world.js` | 1 |
| Restricciones de cámara/arsenal por modo | `public/js/main.js`, `public/js/combat.js` | 0,5 |
| HUD de modo (fase, tiempo, marcador, turno) | `public/js/hud.js`, `public/css/style.css` | 1 |
| Espectadores + reconexión con gracia de 45 s | `server/game.js` | 1 |
| Emparejamiento rápido + lista filtrada por modo | `server/game.js`, `public/js/main.js` | 0,5 |
| Suites `t-mode-*.mjs` + `scripts/test-all.ps1` | `public/test/` | 1 |

**Total Ola 0: ~6 días.** Es el peaje. Sin él, las seis modalidades cuestan el doble.

---

## 6. Persistencia

Migraciones **aditivas** (`CREATE TABLE IF NOT EXISTS`), nunca destructivas.

```sql
-- Resultados de cualquier modo
CREATE TABLE IF NOT EXISTS mode_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode_id TEXT NOT NULL,
  room_code TEXT,
  winner_id INTEGER,
  payload TEXT NOT NULL,          -- ranking y métricas en JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ciudad: objetos colocados
CREATE TABLE IF NOT EXISTS city_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  plot_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL,
  rot REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ciudad: parcelas
CREATE TABLE IF NOT EXISTS city_plots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER REFERENCES users(id),
  district TEXT NOT NULL,
  x REAL NOT NULL, z REAL NOT NULL,
  size REAL NOT NULL DEFAULT 8,
  name TEXT
);

-- Ciudad: coleccionables recogidos
CREATE TABLE IF NOT EXISTS city_collectibles (
  user_id INTEGER NOT NULL REFERENCES users(id),
  collectible_id TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, collectible_id)
);
```

`user_stats` se amplía con columnas por modo (`pairs_wins`, `duel_wins`,
`hide_wins`, `tnt_wins`, `kart_wins`, `city_level`). SQLite permite `ALTER TABLE ADD
COLUMN`; se comprueba con `PRAGMA table_info` antes de añadir.

**Respaldo obligatorio antes de cada migración**, con servidores detenidos.

---

## 7. Pruebas

### 7.1 Automatizadas

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-all.ps1
```

Se añaden, una por modo y una por contrato:

| Suite | Qué prueba | Aserciones objetivo |
|---|---|---|
| `t-mode-core.mjs` | Contrato: join, leave, tick, snapshot, fin | 20 |
| `t-modos.mjs` ✔ | Registro y portales, mapas `isla`/`pares`/`coliseo`, obstáculos, partida determinista y flujo real isla → portal → partida → isla | 13 (implementadas) |
| `t-mode-pares.mjs` | Barajado con semilla, turnos, parejas, empate | 15 |
| `t-coliseo.mjs` ✔ | Formatos, loadout melee, rondas, espectador, rechazo de armas de fuego y persistencia | 14 (implementadas) |
| `t-escondite.mjs` ✔ | Contrato, coberturas y LOS, roles sembrados, fases, etiquetas, esquivas, pulso, gracia, persistencia y servidor real | 15 (implementadas) |
| `t-mode-tnt.mjs` | Rejilla, caída, último vivo, empate por altura | 14 |
| `t-mode-karts.mjs` | Checkpoints en orden, vueltas, ranking | 16 |
| `t-mode-ciudad.mjs` | Interés por celda, persistencia de objetos | 12 |

Las suites `t-modos`, `t-coliseo` y `t-escondite` ya están en `scripts\test-all.ps1`
(11 suites en verde); las demás se irán añadiendo con cada ola. Todas usan el patrón
existente: servidor real en proceso con `PORT` y `DB_PATH` temporales, bots de
`socket.io-client`, sin navegador.

### 7.2 Manuales por ola

- Dos navegadores + una pestaña incógnito (3 jugadores) por modo.
- Móvil 360×640 y 412×915: HUD de modo, botones táctiles, cámara.
- Cliente manipulado: enviar `mode:action` fuera de turno, índice inválido, acción de
  otro jugador. Todo debe rechazarse sin tumbar la sala.
- Recarga a mitad de partida → espectador → revancha.
- Reiniciar `server/index.js` después de cada cambio de modos (Node no recarga `modeDefs.js` ni los controladores en caliente).
- Salir y volver a entrar → sin estado zombi.
- 8 pestañas simultáneas → FPS y RTT aceptables.

### 7.3 Carga

Se extiende `public/test/load.mjs` con un escenario por modo. Objetivos:

| Modo | Sesiones | Eventos/s | p95 RTT |
|---|---|---|---|
| Pares | 24 (4 salas × 6) | < 300 | < 150 ms |
| Coliseo | 16 (2 salas × 8) | < 900 | < 150 ms |
| TNT | 16 | < 1200 | < 180 ms |
| Karts | 8 | < 1500 | < 120 ms |
| Ciudad | 50 | < 2500 | < 200 ms |

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Meter modos antes del 23/11 | Se rompe la versión estable | Congelación explícita; solo docs hasta el 23/11 |
| `server/game.js` ya tiene ~1600 líneas | Cada modo lo engorda | Controladores en `server/modes/`; `game.js` solo despacha |
| Sin predicción en Socket.IO | Karts y Coliseo se sienten con lag | *Spike* Colyseus para Karts; *lag compensation* para melee |
| Mapas sin escondites | Escondite aburrido | Auditoría de 12 escondites antes de programar el modo |
| 50 jugadores en ciudad | Caídas y FPS | *Interest management* por celdas desde el día 1; prueba de carga antes de C2 |
| Assets externos pesados | Carga lenta por el túnel | glTF + Draco/meshopt; presupuesto < 2 MB por distrito |
| Licencias de assets | Problema legal en entrega | Solo CC0 (Poly Haven, Poly Pizza, Kenney) o Mixamo con su restricción |
| Economía explotable | Inflación en ciudad | Topes diarios, *diminishing returns*, validación servidor |
| Migración SQLite | Pérdida de datos | `ALTER TABLE` aditivo + respaldo previo |
| Caché del navegador | Cambios invisibles | `?v=` en el script de entrada; `no-cache` en HTML |
| Túnel Cloudflare sin UDP | Voz y WebRTC no funcionan | Voz actual P2P se mantiene; LiveKit Cloud si se necesita, nunca auto-hospedado tras el túnel |

---

## 9. Decisiones que necesito de ti

| Tema | Opciones | Recomendación |
|---|---|---|
| **Alcance antes del 02/12** | (a) nada nuevo · (b) Pares mínimo · (c) Pares + Coliseo | **(a)**, y como mucho (b) si aceptas el riesgo |
| **Orden de modos** | El propuesto u otro | Pares → Coliseo → Escondite → TNT → Karts → Ciudad |
| **Karts: red** | Colyseus en proceso aparte · predicción manual | *Spike* de 3 días y decidir con datos |
| **Ciudad: alcance** | Solo distrito + coleccionables · + casas · + trabajos | Empezar por distrito + coleccionables (C1–C2) |
| **Assets** | Todo procedural · mixto con glTF | Mixto: procedural para arena, glTF para muebles y karts |
| **Cámara en ciudad** | FP estricta · FP con transición a 3.ª en vehículos | FP estricta salvo vehículo |

---

## 10. Criterios de aceptación global

La expansión se considera terminada cuando:

1. Las seis modalidades se crean, juegan y cierran sin tocar código de otra.
2. `scripts\test-all.ps1` termina en 0 con las suites base **y** las de modo.
3. Ninguna suite existente cambia de resultado (regresión cero).
4. Un jugador nuevo entra desde el menú, elige modo y juega sin leer documentación.
5. El servidor aguanta la tabla de carga de §7.3 sin superar los umbrales.
6. Cada modo tiene su respaldo zip y su entrada en la bitácora.
7. El túnel `pinguidev.corvet.dpdns.org` sigue respondiendo 200 y el *quick tunnel*
   del puerto 8099 sigue intacto.

---

## 11. Decisiones confirmadas (18/11/2026)

| Tema | Decisión |
|---|---|
| **Trabajo antes del 23/11** | **Congelación total**: no se toca código de juego. Solo estabilización, pruebas y respaldo de la versión estable. |
| **Inicio de la Ola 0** | **24/11/2026**, con la versión estable ya cerrada y etiquetada. |
| **Orden de modalidades** | Pares → Coliseo → Escondite → TNT Run → Karts → Ciudad rol. |
| **Alcance pre-entrega (02/12)** | Ninguna modalidad nueva; como máximo, el contrato de modo sin UI si sobra margen. |
| **Karts** | *Spike* de 3 días con Colyseus 0.18 antes de comprometerse; si falla, predicción manual sobre Socket.IO. |
| **Ciudad** | Empieza por distrito + coleccionables (C1–C2); casas y trabajos después. |
| **Assets** | Mixto: procedural para arenas, glTF (Blender → gltf-transform) para karts, muebles y edificios. |
| **Adelanto de las olas 1 y 2** | **Aprobado (18/11/2026):** se implementaron la isla, Pares y Coliseo antes del 24/11 por petición del usuario, con la versión estable respaldada y las 10 suites en verde. |
| **Adelanto del Escondite** | **Aprobado (19/11/2026):** se implementó el Escondite como tercer modo, con contratos compartidos, HUD integrado, suite propia y 11 suites en verde. No se tocó el *quick tunnel* ni `pinguidev.corvet.dpdns.org`. |

Con esto no queda ninguna decisión bloqueante. La isla, Pares, Coliseo y Escondite ya
están entregados; el siguiente entregable es **TNT Run**.
