---
name: threejs-procedural-modeling
description: >-
  Modelado 3D procedural en three.js para este proyecto (sin Blender): geometrías
  BufferGeometry y primitivas, instancing, vertex colors, texturas canvas, low-poly y
  estética cartoon, merging y gestión de memoria/dispose. Usar cuando se pida crear un
  modelo/props/edificio/árbol/roca/objeto 3D en código, decorar un mapa, añadir obstáculos
  o props, o cuando se mencionen InstancedMesh, BufferGeometry, geometry.attributes,
  toNonIndexed, CanvasTexture, computeVertexNormals, MeshStandardMaterial con vertexColors.
---

# Modelado procedural en three.js (Proyecto ClubPinü)

En este repo **todo el contenido 3D es procedural** (no hay modelos externos): avatares,
árboles, rocas, cajas, iglúes, pilares, edificios, cristales y terreno se construyen en
código. No añadas dependencias a menos que la tarea lo pida; primero busca una solución
con las primitivas/buffer ya disponibles.

## Contrato del proyecto (IMPORTANTE)

- **three.js 0.185.1** (WebGL2, `three.module.js`), ES Modules, **sin bundler**.
  Import absoluto: `import * as THREE from "/vendor/three/three.module.js";`
- El servidor solo expone `/vendor/three` → `node_modules/three/build/`. Los addons de
  `examples/jsm` **NO están servidos**; para usarlos (GLTFLoader, SkeletonUtils,
  BufferGeometryUtils) hay que exponerlos primero (ver skill `blender-gltf-pipeline`).
- Nada de WebGPU/TSL/MeshStandardNodeMaterial: el renderer es `WebGLRenderer` WebGL2.
- Todo lo que entra en una escena debe poder limpiarse: `createWorld()` y
  `rebuildWorld()` reconstruyen la escena entera; `rebindScene` en combat/loot/hockey.

## Patrones existentes que debes reutilizar (no reinventes)

- `public/js/world.js`:
  - `makeCanvasTexture(size, draw)` → genera `CanvasTexture` con `SRGBColorSpace`.
  - `renderObstacle(o, mapId)` hace switch por `o.kind` (`pine/leaf/cactus/rock/crate/igl/pillar/building/ruin`). Para añadir un obstáculo nuevo: 1) añadir caso en `renderObstacle`, 2) crear la función constructora con la misma estética, 3) registrarlo en `MAP_DEFS[mapId].palette` si necesita paleta.
  - `MAP_DEFS` define `obstacles` (con `type: "box"|"circle"`, x/z, y para cordillera) y `palette` por mapa (claves por kind; `rock` es un número de color, los demás objetos).
  - `getMapObstacles(mapId)` alimenta colisiones (`collision.js`) y el minimapa (`minimap.js`). **Cualquier obstáculo nuevo debe aparecer ahí** o el jugador lo atraviesa sin que lo vea el render (o al revés).
  - `THEMES[mapId]` concentra colores (sky, fog, ground, wall, hemisphere, particles). Colores de nivel en `theme`, no hardcodeados en constructores.
  - Terreno: `cordilleraHeight`, `getTerrainHeightAt(mapId,x,z)`, `makeTerrain` (colores por vértice + normales). Objetos que "se asientan" en terreno deben usar `getTerrainHeightAt`.
  - `populate` coloca obstáculos con `renderObstacle` y los posiciona en `y = getTerrainHeightAt(...)`.
- Estética: cartoon/low-poly, materiales planos, `MeshStandardMaterial` con
  `roughness` alto (0.8-1) y `metalness` bajo, o `MeshPhongMaterial`; `MeshBasicMaterial`
  para brillos/wireframes/additivos.
- Regla de escala: 1 unidad ≈ 1 metro (avatares ~1.2 unidades de alto).

## Geometrías: qué usar

- Primitivas cubren el 90%: `BoxGeometry` (cuerpos/círculos, edificios), `SphereGeometry`/
  `IcosahedronGeometry` (cabezas, cristales), `ConeGeometry`/`CylinderGeometry` (árboles,
  columnas), `TorusGeometry`/`RingGeometry` (anillos, tiras de pista, aros de neón),
  `CircleGeometry`/`PlaneGeometry` (suelos, agua, estelas).
- Composiciones: agrupa piezas en `THREE.Group` y escala/rota el grupo. Así se puede
  animar ("brillo", "fundir", "subir") sin tocar las piezas. Es el patrón de
  `createAvatar` (avatar.js), `pineTree`, `iglooGroup`, `pillar`, `rockMesh`.
- Formas orgánicas: usa `ExtrudeGeometry`/`LatheGeometry` con poco detalle, o desplaza
  vértices a mano sobre `BufferGeometry` (ver `makeTerrain`). Para "rocas" con bultos,
  `IcosahedronGeometry(radius, 0)` + `geometry.attributes.position` jitter + `computeVertexNormals()`.
- Curvas de montaña/pista: `CatmullRomCurve3` con `TubeGeometry`, o `Shape` + `ExtrudeGeometry`.

## Vertex colors (1 solo draw call)

- `geometry.setAttribute("color", new THREE.BufferAttribute(float32Array, 3))` + material
  `vertexColors: true`.
- Útil para biomas (arena→hierba→roca→nieve en `makeTerrain`), terrenos, o variación
  porcixel sin texturas.
- Con sombreado plano (`flatShading: true`) o `toNonIndexed()` para colores distintos por
  cara (cada vértice de la cara necesita su propio color).
- Prefiere modificar normales con `geometry.computeVertexNormals()` tras desplazar
  vértices; NO normalizar a mano salvo necesidad (coste/bugs).

## Instancing y repetición (MUY importante para 60 fps)

- El cuello de botella son los **draw calls**, no los vértices. Meta: < 100 draw calls.
- Mismo objeto repetido (pinos, rocas, cristales, partículas, luces decorativas):
  usa `THREE.InstancedMesh(geometry, material, count)`.
  - Posiciona con `inst.setMatrixAt(i, matrix)` (compón con `THREE.Object3D` auxiliar o
    `Matrix4.compose`).
  - Actualiza `instanceMatrix.needsUpdate = true` si cambias matrices.
  - Abate con escala 0: `matrix.makeScale(0,0,0)` y `mesh.count = nVisible`.
  - Alternativa desde r156: `BatchedMesh` (distintas geometrías, material compartido).
- Comparte materiales entre mallas idénticas (`const mat = new ...; m.material = mat`),
  tres.js agrupa por material igual.
- Estático y plantón: fusiona geometrías (`BufferGeometryUtils.mergeGeometries`) y súmalo
  a la escena una sola vez.

## Texturas procedimentales (sin descargar nada)

- `makeCanvasTexture(512, (ctx, size) => {...})` es el patrón del proyecto (suelos,
  pista de hielo, glow). Úsalo para: madera/suelo con ruido, gradientes de nieve, spots.
- Ley: generar con `ctx` y asignar `texture.colorSpace = THREE.SRGBColorSpace`.
- Glow/bloom falso: sprite con textura radial de canvas (`createRadialGradient`) +
  `AdditiveBlending` + `depthWrite: false` (patrón `makeGlowTexture` de loot.js).

## Reglas de caja (pitfalls)

- Posicionar en `y=0` asume suelo plano; si es en cordillera usa `getTerrainHeightAt`
  para "asentar" la pieza sobre el terreno.
- `InstancedMesh` sigue el frustum culling normalmente; respeta `mesh.count` si activas
  o desactivas instancias (no dejes instancias fantasma con matrices basura: preincializa
  con `makeScale(0,0,0)`).
- Rota con `group` / `mesh.rotation`; no rotes cada frame desde el material.
- Para discos/suelos usa `rotation.x = -Math.PI / 2` (PlaneGeometry está en el plano XY).
- `dispose()`: al eliminar un mundo (`rebuildWorld`) o un obstáculo, libera
  `geometry.dispose()`, `material.dispose()`, `texture.dispose()` (patrón de
  `removeCrystal` en loot.js). No guardes referencias a mallas de un mundo viejo tras
  `rebuildWorld`.

## Checklist al añadir un modelo nuevo
1. ¿Se puede derivar de primitivas + grupos? → sí, hazlo.
2. ¿Se repite? → InstancedMesh o comparte material.
3. ¿Necesita paleta por mapa? → métela en `MAP_DEFS[mapId].palette` y pásala por `renderObstacle`.
4. ¿Colisiona? → obstáculo en `getMapObstacles` (también lo pinta el minimapa).
5. ¿Suelo con terreno? → "asienta" con `getTerrainHeightAt`.
6. Verifica con `node --check` el archivo y recarga `http://localhost:3000`.