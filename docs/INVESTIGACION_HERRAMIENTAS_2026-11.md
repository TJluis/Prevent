# Investigación de herramientas · Expansión de modalidades Club Pingüi

**Fecha de corte:** 18/11/2026
**Método:** consulta directa a `registry.npmjs.org` (versión, licencia, fecha, tamaño
desempaquetado), documentación y notas de versión oficiales, y lectura del código del
proyecto. Cada cifra de versión de este documento se verificó ese día.
**Documento hermano:** [`PLAN_MODALIDADES_2026-12.md`](PLAN_MODALIDADES_2026-12.md)

---

## 0. Veredictos en una tabla

| Necesidad | Herramienta recomendada | Versión | Licencia | Veredicto |
|---|---|---|---|---|
| Render 3D | **three.js** (ya instalado) | `0.187.0` | MIT | **Mantener** |
| Física 3D | **Rapier** (`@dimforge/rapier3d-compat`) | `0.21.0` | Apache-2.0 | **Adoptar** solo para Karts |
| Multijugador | **Socket.IO** (actual) + **Colyseus** para Karts/Ciudad | `4.8.3` / `0.18.12` | MIT | **Híbrido por fases** |
| Assets 3D | **Blender 5.2 LTS** → glTF/GLB | 5.2 LTS | GPL-2.0+ (salida libre) | **Adoptar** |
| Puente IA↔Blender | **mcp-for-blender** (ex `blender-mcp`) | último | MIT | **Evaluar** (opcional) |
| Optimización glTF | **gltf-transform** + Draco/meshopt | `4.5.1` | MIT | **Adoptar** |
| Animación | **Mixamo** + `AnimationMixer` | — | Royalti-free | **Adoptar con restricción** |
| Audio | **Web Audio API** (actual) + `howler` si hace falta | `2.2.4` | MIT | **Mantener** |
| Postprocesado | **postprocessing** | `6.39.6` | Zlib | **Opcional** |
| Partículas | **three.quarks** | `0.18.0` | MIT | **Opcional** |
| Raycast BVH | **three-mesh-bvh** | `0.9.18` | MIT | **Solo si duele** |
| Navegación/IA | **recast-navigation** | `0.44.0` | MIT | **Solo bots de ciudad** |
| Pruebas E2E | **Playwright** | `1.65.1` | Apache-2.0 | **Adoptar** |
| Build | **Vite** | `8.3.8` | MIT | **No todavía** |
| Tipado | **TypeScript** | `7.0.2` | Apache-2.0 | **No todavía** |
| ECS | **bitECS** | `0.4.0` | MPL-2.0 | **No todavía** |
| Voz | **LiveKit Cloud** (no auto-hospedado) | — | Apache-2.0 | **Solo si se pide** |
| Motor completo | Godot / Unity / Babylon | — | — | **Descartar** |

---

## 1. El stack actual y su techo real

| Componente | Hoy | Medido / observado |
|---|---|---|
| Servidor | Node + Express 5 + Socket.IO 4.8 | 1 proceso, salas en memoria |
| Persistencia | SQLite (`better-sqlite3` 13.2.0) | WAL, 4 tablas + `spaces` sin uso |
| Cliente | Three.js 0.185.1 (instalado), WebGL | Sin build step, ES modules |
| Movimiento | 2D con `y` cosmética | `WALK_SPEED = 6`, colisiones AABB |
| Física | Ninguna | Sin gravedad real, sin cuerpos rígidos |
| Red | Estado por eventos, sin predicción | 60 sesiones, 619 ev/s, p95 132 ms |
| Audio | Web Audio con osciladores | Sin assets de audio externos |
| UI | HTML/CSS sobre canvas | Paneles, HUD, chat, tienda |

**Conclusión:** el stack aguanta bien lo que hace hoy. El techo aparece en tres sitios
concretos: (a) vehículos rápidos sin predicción, (b) más de ~60 sesiones por proceso,
(c) mundos persistentes con muchos objetos. Cada uno tiene una respuesta distinta.

---

## 2. Motores y render

### 2.1 Comparativa

| Opción | Fortaleza | Coste de adopción | Veredicto |
|---|---|---|---|
| **three.js** | Ya está; control total; ecosistema de addons | Cero | **Mantener** |
| Babylon.js | Motor completo, editor, física y depuración integradas | Reescribir render, materiales, controles y HUD | Descartar |
| PlayCanvas | Editor colaborativo en la nube | Dependencia de servicio; reescribir | Descartar |
| Godot 4 (HTML5) | Motor completo, gratis | Reescribir todo; build WASM pesado; el servidor Node actual se pierde | Descartar |
| Unity (WebGL) | Ecosistema enorme | Builds de decenas de MB; reescribir; licencia | Descartar |
| A-Frame | 3D declarativo, VR | No encaja con un juego de acción | Descartar |
| Phaser / PixiJS | Excelentes en 2D | El juego es 3D | No aplica |

**Por qué no migrar:** el proyecto tiene ~250 KB de lógica propia en `public/js`
(mundo procedural, avatar, combate, viewmodel, HUD). Migrar de motor significa tirar eso
y, con él, el calendario académico. Ninguna modalidad pedida **exige** otro motor.

### 2.2 WebGPU

three.js `r187` (30/10/2026) dedica ~79 % de sus líneas cambiadas al renderer WebGPU.
`WebGLRenderer` sigue siendo el camino estable y el que usa el proyecto.

| Hecho | Implicación |
|---|---|
| `WebGPURenderer` + TSL están madurando rápido | Atractivo a medio plazo |
| El proyecto usa `WebGLRenderer`, `ShaderMaterial` y sombras PCF | Migrar exige revisar materiales |
| Soporte de WebGPU varía por navegador y GPU | Riesgo en equipos de la escuela |

**Veredicto:** no migrar ahora. Revisar en 6–9 meses. El modo Ciudad puede beneficiarse,
pero no es requisito.

---

## 3. Física

### 3.1 Comparativa

| Motor | Versión | Licencia | WASM | Controlador de personaje | Vehículo | Mantenimiento |
|---|---|---|---|---|---|---|
| **Rapier** | `0.21.0` | Apache-2.0 | Sí (~14,7 MB desempaquetado, varios builds) | `KinematicCharacterController` | `DynamicRayCastVehicleController` | Activo (09/2026) |
| cannon-es | `0.20.0` | MIT | No | No | No | **Parado desde 08/2022** |
| Jolt | `1.1.1` | MIT | Sí (~45 MB) | Sí | Sí | Activo (10/2026) |
| Ammo.js | `0.0.10` | Zlib | Sí | Limitado | Sí | **Parado desde 2022** |

### 3.2 Por qué Rapier

- Es el único con **controlador de personaje cinemático** y **vehículo por raycast**
  documentados y con ejemplos oficiales de three.js
  (`physics_rapier_character_controller`, `physics_rapier_vehicle`).
- Apache-2.0 permite uso académico y comercial sin fricción.
- La variante `-compat` incluye el WASM en base64, así que no hay que configurar MIME
  types ni rutas de `.wasm` en el servidor estático.
- Determinismo suficiente para validar en servidor lo que el cliente predice.

### 3.3 Dónde se usa y dónde no

| Modo | ¿Física? | Motivo |
|---|---|---|
| Pares | No | Turnos sobre una rejilla |
| Coliseo | No | El combate actual ya valida distancias y conos |
| Escondite | No | Raycast de línea de visión, no simulación |
| TNT Run | No | Rejilla + comprobación de soporte |
| **Karts** | **Sí** | Vehículo, suspensión, derrape, colisiones a velocidad |
| Ciudad | No (o cinemática) | Personajes con controlador cinemático, no rígidos |

**Coste:** ~1,5 MB de WASM comprimido en el cliente para Karts. Se carga **solo** al
entrar a ese modo (import dinámico), no en el arranque.

**Riesgo:** Rapier en el servidor añade un segundo bucle de simulación que debe correr
al mismo paso que el tick de red. Mitigación: paso fijo de 16,6 ms con acumulador y
tope de 5 pasos por tick.

---

## 4. Multijugador

### 4.1 Comparativa

| Opción | Modelo | Predicción / lag comp | Coste | Encaje |
|---|---|---|---|---|
| **Socket.IO** (actual) | Eventos, servidor autoritativo manual | No | $0 | Salas, turnos, TNT, escondite |
| **Colyseus 0.18** | Salas + schema binario + parches | **Sí, integradas** | $0 (MIT) | Karts y Ciudad |
| Geckos.io | UDP sobre WebRTC | Manual | $0 | Requiere UDP; el túnel no lo da |
| Photon | SaaS | Sí | De pago | Dependencia externa |
| WebRTC P2P | Malla | — | $0 | Solo voz (ya se usa) |

### 4.2 Colyseus 0.18 en detalle

La versión 0.18 (publicada en 2026) es la última antes de 1.0 y se centró en juegos
rápidos:

- **Predicción de cliente y *lag compensation* integradas** — exactamente el problema
  de Karts.
- `@colyseus/schema` 5.0: codificador ~**2,4× más rápido**, cuantización de *floats*.
- *Request/response* tipado, plugins de sala, *matchmaking*.
- `@colyseus/database` con Drizzle (Postgres / PGlite).
- SDK `@colyseus/sdk` ~**58 KB gzip**.
- Demos oficiales de Karts, FPS, Air Hockey y MOBA.

Versiones verificadas: `colyseus@0.18.12`, `@colyseus/core@0.18.29`,
`@colyseus/schema@5.0.49`, `@colyseus/sdk@0.18.10`, `@colyseus/redis-driver@0.18.7`.

### 4.3 Decisión: híbrido, no migración

Migrar **todo** a Colyseus costaría semanas y rompería las suites actuales. El plan es:

1. Todo lo que ya funciona sigue en Socket.IO.
2. Karts estrena un proceso Colyseus **solo si el *spike* de 3 días sale bien**.
3. Ciudad decide entre Colyseus y Socket.IO con *interest management* según ese *spike*.
4. Si el *spike* falla, se implementa predicción manual sobre Socket.IO (más caro, pero
   sin dependencia nueva).

**Criterio de éxito del *spike*:** 4 karts, 3 vueltas, 120 ms de latencia simulada,
sin desincronización visible y con < 5 % de ancho de banda extra.

### 4.4 Lo que Socket.IO sí puede hacer

Con el patrón actual y algo de disciplina:

- Salas de 16 jugadores a 20 Hz (TNT, escondite).
- Turnos (Pares) sin ningún cambio de red.
- Coliseo a 30 Hz con *lag compensation* de 100 ms en el servidor.
- Ciudad hasta ~30 jugadores con *interest management* por celdas y tick de 10 Hz.

Lo que **no** puede sin predicción: vehículos a 30 m/s y disparos rápidos con *snap*.

---

## 5. Voz

| Opción | Coste | Requisitos | Veredicto |
|---|---|---|---|
| P2P actual (malla WebRTC) | $0 | Funciona hasta ~6 personas | **Mantener** en salas |
| LiveKit Cloud · Build | $0 | 5.000 min WebRTC/mes, 100 conexiones (consultado 18/11/2026) | **Si se necesita** |
| LiveKit Cloud · Ship | desde $50/mes | Equipos, voces, soporte | No necesario |
| LiveKit auto-hospedado | $0 + servidor | **UDP 50000-60000**, TURN 443, 7881 TCP | **Descartar tras el túnel** |

**Por qué no auto-hospedar:** Cloudflare Tunnel transporta HTTP/WebSocket sobre TCP, no
UDP. Sin UDP no hay WebRTC decente. Forzar TURN sobre TCP da latencia y cortes. Si algún
día se necesita voz para 20+ personas, se usa LiveKit Cloud, no un servicio local.

---

## 6. Assets 3D: Blender y glTF

### 6.1 Versiones

| Versión | Estado | Nota |
|---|---|---|
| **Blender 5.2 LTS** | **Recomendada** | Soporte largo; pipeline estable |
| Blender 5.3 | Publicada 10/11/2026 | Novedad: *3D Gaussian Splats* nativos (PLY/SPZ); no hace falta para este proyecto |

**Regla:** LTS para producir, última solo para experimentar.

### 6.2 Pipeline del proyecto

```
Blender (modelar, UV, materiales PBR simples)
  → exportar .glb (glTF 2.0)
  → gltf-transform optimize (Draco / meshopt / KTX2)
  → public/assets/models/*.glb
  → GLTFLoader + DRACOLoader (addons de three servidos por Express)
```

El proyecto ya documenta este pipe en `.opencode/skills/blender-gltf-pipeline/SKILL.md`.
Hoy **no hay ningún `.glb`**: todo es procedural. La expansión introduce los primeros
(vehículos, muebles, edificios de ciudad).

### 6.3 Presupuesto de assets

| Tipo | Triángulos | Textura | Peso objetivo |
|---|---|---|---|
| Kart | < 6.000 | 1024² | < 800 KB |
| Mueble | < 1.500 | 512² o color plano | < 120 KB |
| Edificio | < 4.000 | 1024² atlas | < 600 KB |
| Avatar externo | < 12.000 | 2048² | < 2 MB |

Se sirve por el túnel de Cloudflare, así que cada MB cuenta.

### 6.4 Optimización

| Herramienta | Versión | Licencia | Uso |
|---|---|---|---|
| `@gltf-transform/cli` | `4.5.1` | MIT | `optimize`, `draco`, `meshopt`, `webp` |
| `draco3d` | `1.5.9` | Apache-2.0 | Compresión de geometría |
| `meshoptimizer` | `1.3.0` | MIT | Alternativa a Draco, mejor para GPUs móviles |
| `sharp` | `0.35.5` | Apache-2.0 | Redimensionar texturas en el pipeline |

**Recomendación:** meshopt para móvil, Draco para escritorio; nunca ambos en el mismo
archivo. KTX2 solo si aparecen texturas grandes.

### 6.5 mcp-for-blender (ex `blender-mcp`)

| Dato | Valor |
|---|---|
| Paquete | `mcp-for-blender` (el viejo `blender-mcp` sigue funcionando) |
| Licencia | MIT |
| Instalación | `uvx mcp-for-blender` |
| Requisitos | Blender ≥ 3.0, Python ≥ 3.10 |
| Integraciones | Poly Haven (CC0), Poly Pizza (CC0/CC-BY), Sketchfab, generación IA |
| Soporte | OpenCode, Claude, Cursor y otros clientes MCP |

**Veredicto:** útil para prototipar muebles y edificios rápido, **opcional**. No es una
dependencia del juego: si falla, el pipeline manual con Blender sigue funcionando.
Advertencia: es un proyecto de terceros, no oficial de Blender Foundation.

### 6.6 Licencias de arte

| Fuente | Licencia | Uso comercial | Redistribuir el asset suelto |
|---|---|---|---|
| Poly Haven | CC0 | Sí | Sí |
| Poly Pizza | CC0 / CC-BY | Sí (con atribución en CC-BY) | Sí |
| Kenney | CC0 | Sí | Sí |
| Sketchfab | Variable por modelo | Comprobar | Comprobar |
| **Mixamo** | Royalti-free | **Sí** | **No**: prohíbe redistribuir personajes/animaciones como assets sueltos |
| Freesound | CC0 / CC-BY | Según licencia | Según licencia |

**Implicación para Mixamo:** se puede usar en el juego publicado, pero **no** se pueden
subir los `.fbx` originales al repositorio como si fueran un pack de assets. Se guardan
solo los `.glb` integrados y se documenta la fuente.

---

## 7. Animación

| Enfoque | Ventaja | Desventaja | Uso |
|---|---|---|---|
| **Procedural** (actual) | Cero assets, estilo propio, control total | Limitado para acciones complejas | Pingüino, emotes, carreras |
| **Mixamo + AnimationMixer** | Animaciones humanoides listas | Requiere rig; estilo ajeno | Ciudad, trabajos |
| **Rig propio en Blender** | Coherencia visual | Tiempo de animador | Solo si se invierte en arte |
| **Máquina de estados** | Evita animaciones cruzadas | Hay que diseñarla | Todos los modos |

**Recomendación:** mantener el pingüino procedural como identidad y usar Mixamo solo
para el avatar alternativo de ciudad o para NPCs. La máquina de estados
(`idle/walk/run/drift/hit/fall`) se comparte entre modos.

---

## 8. Audio

| Herramienta | Versión | Licencia | Veredicto |
|---|---|---|---|
| Web Audio API (actual) | nativa | — | **Mantener** para SFX sintetizados |
| Howler.js | `2.2.4` | MIT | Útil si se añaden muchos archivos y *sprites* |
| jsfxr / BFXR | — | libre | Efectos retro |
| Freesound | — | CC0/CC-BY | Ambiente y golpes |

**Recomendación:** no introducir Howler hasta que haya más de ~15 sonidos con
posicionamiento. Hoy el audio sintetizado funciona y pesa cero.

---

## 9. UI, postprocesado y *game feel*

| Necesidad | Herramienta | Versión | Veredicto |
|---|---|---|---|
| Menús y HUD | HTML/CSS (actual) | — | **Mantener** |
| UI dentro de 3D | `CSS2DRenderer` / `CSS3DRenderer` | incl. en three | Puntual |
| React en 3D | `@react-three/fiber` `9.8.2` | MIT | No: introduce build step |
| Postprocesado | `postprocessing` `6.39.6` | Zlib | Opcional (bloom suave, viñeta) |
| Partículas | `three.quarks` `0.18.0` | MIT | Opcional (explosiones, nieve) |
| Partículas alternativas | `three-nebula` `13.3.0` | MIT | No: Quarks es más ligero |
| Materiales toon | `MeshToonMaterial` + outline | incl. en three | **Recomendado** para unificar estilo |
| Shaders propios | `three-custom-shader-material` `6.4.0` | MIT | Solo si hace falta |
| Depuración en vivo | `lil-gui` `0.21.0` | MIT | **Sí**, en desarrollo |
| Rendimiento | `stats.js` `0.17.0` | MIT | **Sí**, en desarrollo |

**Game feel (lo que más cambia la percepción):**

1. *Hit-stop* de 40–80 ms al impactar melee.
2. Sacudida de cámara con decaimiento exponencial.
3. *Knockback* con curva de aceleración, no lineal.
4. FOV dinámico al esprintar/derrapar (+6°).
5. Sonido por acción (golpe, salto, caída, meta).
6. Animación de *anticipación* antes del golpe.

Nada de esto exige una librería nueva; es trabajo de `combat.js`, `viewmodel.js` y
`main.js`.

---

## 10. IA y navegación

| Librería | Versión | Última actualización | Veredicto |
|---|---|---|---|
| **recast-navigation** | `0.44.0` | 30/10/2026 | **Solo bots de ciudad** (navmesh real) |
| three-pathfinding | `1.3.0` | 05/2024 | Alternativa simple |
| yuka | `0.7.8` | 09/2022 | No: parado |
| easystarjs | `0.4.4` | 06/2022 | Solo rejillas 2D; no aplica |

Los bots de las pruebas de carga **no necesitan navegación**: se mueven con guiones.
Solo los NPCs de ciudad necesitan navmesh, y eso es fase C5.

---

## 11. Rendimiento de escena

| Técnica | Cuándo | Herramienta |
|---|---|---|
| `InstancedMesh` | Muchos objetos idénticos (bloques TNT, árboles, farolas) | three |
| `BatchedMesh` | Muchos objetos distintos con el mismo material | three |
| *Frustum culling* | Siempre | three (automático) |
| BVH de raycast | Muchos raycasts contra mallas grandes | `three-mesh-bvh` `0.9.18` |
| LOD | Ciudad con edificios lejanos | `LOD` de three |
| *Interest management* | > 20 jugadores | propio (rejilla de celdas) |
| Texturas comprimidas | Assets externos | KTX2 + `sharp` |

**Dato de partida:** 1280 bloques de TNT en 5 `InstancedMesh` son triviales para la GPU.
El cuello de botella será el *tick* del servidor y el ancho de banda, no el render.

---

## 12. ECS, TypeScript y build

| Herramienta | Versión | Licencia | Veredicto |
|---|---|---|---|
| bitECS | `0.4.0` | **MPL-2.0** | No ahora |
| miniplex | `2.0.0` | MIT | No ahora |
| TypeScript | `7.0.2` | Apache-2.0 | No ahora |
| Vite | `8.3.8` | MIT | No ahora |

**Por qué no ECS:** un ECS se paga cuando hay cientos de entidades con sistemas que
combinan. Hoy hay ~16 jugadores, ~10 cristales y ~8 salas. Reescribir el núcleo a ECS
costaría 2–3 semanas y no desbloquea ninguna modalidad. El contrato de modo (§2.3 del
plan) da el 80 % del beneficio con el 10 % del coste.

**Por qué no TypeScript/build:** el proyecto funciona sin build step, los tests corren
los módulos directamente y el túnel sirve archivos estáticos. Introducir Vite obliga a
revisar rutas, `vendor/three`, caché y despliegue. Se puede adoptar JSDoc + `checkJs`
selectivo si se quiere tipado sin build.

**Excepción:** si el *spike* de Colyseus sale bien, ese proceso aparte **sí** usará
TypeScript y su propio build, porque Colyseus está diseñado así. No afecta al cliente.

---

## 13. Pruebas y despliegue

| Herramienta | Versión | Uso |
|---|---|---|
| Suites propias (`public/test/*.mjs`) | — | Lógica pura y servidor real |
| `socket.io-client` | `4.8.4` | Bots de carga |
| **Playwright** | `1.65.1` | E2E de navegador real (cámara, HUD, táctil) |
| Chrome DevTools | — | FPS, memoria, red |
| `scripts/test-all.ps1` | — | Comando único |
| `scripts/backup-proyecto.ps1` | — | Respaldo zip por fase |

**Playwright** es la incorporación más valiosa: permite probar que la cámara queda en
primera persona en ciudad, que el HUD de modo aparece y que el tablero de Pares responde,
sin intervención manual. Se instala como `devDependency` y se ejecuta en CI local.

---

## 14. Costos

| Concepto | Coste | Nota |
|---|---|---|
| three.js, Rapier, Colyseus, Socket.IO | $0 | Licencias permisivas |
| Blender | $0 | GPL; los modelos exportados son tuyos |
| glTF, Draco, meshopt | $0 | Estándar abierto |
| Mixamo | $0 | Royalti-free con restricción de redistribución |
| Poly Haven / Poly Pizza / Kenney | $0 | CC0 (o CC-BY con atribución) |
| Cloudflare Tunnel | $0 | Ya en uso |
| LiveKit Cloud Build | $0 | 5.000 min/mes, 100 conexiones (18/11/2026) |
| LiveKit Cloud Ship | desde $50/mes | No necesario |
| Colyseus Cloud | de pago | No necesario: se auto-hospeda el proceso |
| Servidor adicional para ciudad | $0 local / variable en nube | Depende del despliegue final |

**Coste total de la expansión: $0 en licencias.** El coste real es tiempo.

---

## 15. Matriz herramienta × modalidad

| Herramienta | Pares | Coliseo | Escondite | TNT | Karts | Ciudad |
|---|---|---|---|---|---|---|
| Contrato de modo | ● | ● | ● | ● | ● | ● |
| Rapier | — | — | — | — | ● | ○ |
| Colyseus | — | ○ | — | ○ | ● | ● |
| glTF/Blender | ○ | ○ | — | — | ● | ● |
| Mixamo | — | ○ | — | — | — | ● |
| postprocessing | — | ○ | — | — | ○ | ○ |
| three.quarks | — | ● | ○ | ● | ● | ○ |
| three-mesh-bvh | — | — | ● | — | ○ | ● |
| recast-navigation | — | — | — | — | — | ● |
| Playwright | ● | ● | ● | ● | ● | ● |

● necesario · ○ útil · — no aplica

---

## 16. Riesgos de adopción

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Rapier rompe el bucle actual | Media | Alto | Cargarlo solo en Karts, con *feature flag* |
| Colyseus no encaja con el servidor actual | Media | Alto | *Spike* de 3 días con criterio de salida claro |
| glTF pesa demasiado por el túnel | Alta | Medio | Presupuesto por asset + Draco/meshopt |
| Mixamo con estilo incoherente | Alta | Bajo | Solo para ciudad; el pingüino sigue procedural |
| `mcp-for-blender` inestable | Media | Bajo | Es opcional; el pipeline manual basta |
| Playwright añade minutos a cada corrida | Media | Bajo | Solo suites E2E, no en cada guardado |
| Dependencia de terceros abandona el proyecto | Baja | Medio | Licencias permisivas + código en el repo |

---

## 17. Fuentes consultadas

**Registro npm** (`https://registry.npmjs.org/<paquete>`, consultado 18/11/2026):
`three`, `@dimforge/rapier3d-compat`, `colyseus`, `@colyseus/core`, `@colyseus/schema`,
`@colyseus/sdk`, `@colyseus/redis-driver`, `bitecs`, `miniplex`, `@gltf-transform/cli`,
`three.quarks`, `postprocessing`, `cannon-es`, `jolt-physics`, `howler`, `playwright`,
`vite`, `typescript`, `lil-gui`, `three-mesh-bvh`, `three-custom-shader-material`,
`three-nebula`, `recast-navigation`, `three-pathfinding`, `easystarjs`, `yuka`,
`livekit-client`, `livekit-server-sdk`, `better-sqlite3`.

**Documentación y notas de versión:**

- Colyseus 0.18 — <https://colyseus.io/blog/colyseus-018-is-here/>
- Migración a 0.18 — <https://docs.colyseus.io/migrating/0.18>
- Rapier, controlador de personaje — <https://rapier.rs/docs/user_guides/templates_injected/character_controller>
- Rapier, vehículo — <https://rapier.rs/docs/user_guides/python/vehicle_controller>
- three.js, ejemplo Rapier — <https://github.com/mrdoob/three.js/blob/dev/examples/physics_rapier_character_controller.html>
- three.js r187 — <https://github.com/mrdoob/three.js/releases/tag/r187>
- three.js, guía de migración — <https://github.com/mrdoob/three.js/wiki/Migration-Guide>
- Blender 5.3 — <https://developer.blender.org/docs/release_notes/5.3/>
- mcp-for-blender — <https://github.com/ahujasid/mcp-for-blender>
- Mixamo FAQ — <https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html>
- LiveKit, auto-hospedaje — <https://docs.livekit.io/home/self-hosting/vm>
- LiveKit, precios — <https://livekit.io/pricing>
- Cloudflare Tunnel — <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>

**Código del proyecto leído:** `server/game.js`, `server/index.js`, `server/db.js`,
`public/js/main.js`, `public/js/world.js`, `public/js/mapDefs.js`,
`public/js/mapObstacles.js`, `public/js/weaponDefs.js`, `public/js/network.js`,
`public/js/avatar.js`, `docs/Reporte_Pruebas_Carga_A11.md`,
`.opencode/skills/blender-gltf-pipeline/SKILL.md`.

---

## 18. Conclusión

No hace falta una herramienta exótica ni un motor nuevo. Hace falta:

1. **Un contrato de modo** — trabajo propio, 6 días.
2. **Rapier** — solo para Karts, 1,5 MB bajo demanda.
3. **Colyseus** — solo si el *spike* demuestra que Karts lo necesita.
4. **Blender + glTF + gltf-transform** — para los primeros assets externos.
5. **Playwright** — para no probar a mano lo que se puede automatizar.

Todo lo demás (Babylon, Godot, Unity, ECS, WebGPU, LiveKit auto-hospedado, cannon-es,
Ammo.js) se descarta con motivo escrito. La decisión importante no es qué instalar,
sino **en qué orden** y **qué no se toca antes del 02/12/2026**.
