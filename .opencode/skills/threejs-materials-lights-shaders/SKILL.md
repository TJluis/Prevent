---
name: threejs-materials-lights-shaders
description: >-
  Materiales, luces, sombras, niebla, tono, color y shaders en three.js para el estilo
  cartoon de este proyecto: MeshStandardMaterial/Phong/Basic, vertex colors,
  instancing, PBR, environment maps, puntos/luces direccionales y hemisphere, shadow maps,
  Fog/FogExp2, tone mapping ACESFilmic, colorSpace, y ShaderMaterial GLSL (vertex+fragment,
  uniforms) sin WebGPU/TSL. Usar cuando se pida mejorar la iluminación/shadows, materiales,
  niebla, efectos de agua/cielo/nieve, emisión, o cuando se mencionen MeshStandardMaterial,
  ShaderMaterial, tone mapping, fog, shadow, PBR, environment map, glsl.
---

# Materiales, luces y shaders (Proyecto ClubPinü)

Estética del proyecto: **cartoon / low-poly**, materiales planos con sombreado, niebla de
atmosfera, tono ACESFilmic. **Renderer fijo**: `WebGLRenderer` (WebGL2) del `createWorld`
en `public/js/world.js`. No se usa WebGPU ni TSL en el proyecto.

## Configuración actual de referencia (world.js)

- `renderer.toneMapping = THREE.ACESFilmicToneMapping`; sombras
  `PCFSoftShadowMap` (en r183+ pasó a llamarse `THREE.SoftShadowMap`, pero el repo usa
  `PCFSoftShadowMap`, que sigue existiendo como alias — no lo renombres).
- Luces por mundo (en `createWorld`): `AmbientLight(0xcfe8ff, 0.55)`,
  `HemisphereLight(theme.hemisphere, 0x7fa0c0, 0.8)` y `DirectionalLight(0xfff4df, 1.5)`
  con sombra 2048 y frustum ±60 (para cordillera el frustum ±60 NO cubre el mapa de 600:
  los árboles lejanos no proyectan sombra — decide si ampliar a costa de calidad o dejar).
- Niebla por tema: `scene.fog = new THREE.Fog(color, near, far)` con valores en
  `THEMES[mapId].fog` (nevado ~150, cordillera 90→420). La niebla afecta a los materiales
  estándar automáticamente; con `ShaderMaterial` se desactiva salvo que traigas uniforms.
- Cielo: `makeSky` (igual con `ShaderMaterial` con `BackSide`, gradiente por `vWorld.y`).
- Terreno: `MeshStandardMaterial` con **vertex colors** (`vertexColors: true`),
  `roughness 0.96`; color por bioma en CPU (ver `makeTerrain`).
- Materiales cartoon: `MeshPhong`/`MeshStandard` con `roughness ~0.8-1`, `metalness` bajo;
  `MeshBasicMaterial` para wireframes, brillos, y materiales `AdditiveBlending`+`depthWrite:
  false` (glow de cristales, nieve). Emisión: `emissive`+`emissiveIntensity` (pulso con seno
  en loot.js).

## Guía rápida de materiales

| Necesidad | Material |
| --- | --- |
| Piel/color plano, cartoon | `MeshMatcapMaterial` o `MeshStandardMaterial` + rough 1 |
| Objeto con reflejos suaves (agua, hielo) | `MeshStandardMaterial` rough 0.1-0.3, metalness 0.1-0.2 |
| Wireframe / glow / debug | `MeshBasicMaterial` (+`wireframe`, `AdditiveBlending`) |
| Material sin luces (UI en escena) | `MeshBasicMaterial`/`SpriteMaterial` |
| Nativo PBR (glTF) | lo que traiga el cargador; mejora con env map |
| Efectos custom | `ShaderMaterial` (GLSL ES 1.0 por defecto; GLSL3 con `material.glslVersion = THREE.GLSL3`) |

- `MeshStandardMaterial` necesita luz/env para lucir; en escenas sin env map usa
  `AmbientLight`+`HemisphereLight` decentes (como hace el juego).
- Colores: define con `new THREE.Color(0x...)` o hex. Con ACESFilmic, tonos muy saturados
  se comprimen; ajusta `intensity`.

## Luces y sombras

- Regla: **3-5 luces como máximo**; más luces = costo por pixel.
- `DirectionalLight` = sol/neón direccional, con sombra. Frustum de sombra apretado =
  mejor calidad; mapa grande (cordillera) = sombras lejanas se pierden (usar `CSM` si se
  quiere, `examples/jsm/csm/CSM.js`, no servido aún).
- `HemisphereLight` da luz ambiental graduada (cielo/piso): barato y clave para estética
  cartoon.
- `PointLight`/`SpotLight` solo para focos (cristales, neon); sombras de points son caras.
- **Sombras**: `mesh.castShadow = true` SOLO en lo que proyecta; `receiveShadow` en suelos/
  mesas. El `sun.shadow.mapSize.set(2048,2048)` es el estándar; PCF soft evita dientes.
  Bias bajo (`-0.0004`) para evitar acne; sube `normalBias` si ves manchas.

## Environment maps / reflejos

- `MeshStandardMaterial` brilla de verdad con un env map:
  `scene.environment = pmremGenerator.fromScene(scene).texture` (genera uno procedural
  desde RoomEnvironment: `import "three/addons/environments/RoomEnvironment.js"` — no
  servido, o genera tu propio sky dome para reflejos).
- Sirve también para que los glTF PBR (ver skill `blender-gltf-pipeline`) dejen de verse
  grises. En cartoon NO es imprescindible.

## Niebla

- `scene.fog = new THREE.Fog(color, near, far)`: lineal. `FogExp2(color, density)`: con
  densidad pequeña (0.001-0.01). Sube `far` en mapas grandes y ajusta densidad por tema.
- El cielo `makeSky` se dibuja sin niebla (ShaderMaterial sin fog): para que se funda con
  la niebla usa color de horizonte ≈ color de fog.
- `material.fog = false` desactiva niebla por material (sprites de glow, partículas).

## Tone mapping y color space (no romper lo que ya funciona)

- El renderer YA usa ACESFilmic + `outputColorSpace` por defecto. No cambies
  `renderer.outputEncoding`/`outputColorSpace` sin motivo (romperías el balance actual).
- Texturas procedimentales: `texture.colorSpace = THREE.SRGBColorSpace` (patrón
  `makeCanvasTexture`). Las normales/roughness van en linear (sin tocar).
- Colores fuertes en `Material.color`: con ACES se "aplastan"; si un color se ve plano,
  sube la luz, no la saturación del hex.

## ShaderMaterial (GLSL, sin TSL/WebGPU)

Ejemplo base para efectos (viento en hierba, agua, toon):
```js
const mat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `...`,
  fragmentShader: `...`,
  transparent: true,
});
```
- Un `ShaderMaterial` con `fog: false` (por defecto) NO recibe niebla. Para que la reciba:
  `mat.fog = true` + merge de `UniformsLib.fog` con `UniformsUtils.merge([UniformsLib.fog, tusUniforms])` y las definiciones `#include <fog_pars_vertex>` etc. en los shaders.
- Mantén el estilo: normales suaves, `#include <color_pars_fragment>` para vertex colors.
- Performance: usa `mix()/step()` en vez de `if/else` donde puedas; pocos `varying`.
- **No** migres a `MeshStandardNodeMaterial`/TSL: este repo corre en WebGL2.
- Para animar: pasa `uTime` como `performance.now()*0.001` desde el `loop` de main.js
  (patrón `world.update(dt)`), no un `requestAnimationFrame` propio.

## Pitfalls
- Material nuevo por malla = más draw calls: comparte materiales (patrón del proyecto).
- `emissiveIntensity` alto + ACES = apagón/ruido: balancea con luces.
- Partículas/glow: garantiza `depthWrite: false` para que no se "corten" contra el terreno.
- Sombras en agua/mesas transparentes: `receiveShadow` con transparencia se ve raro;
  usa `transparent: true` + `depthWrite: false` con moderación.
- Niebla muy densa + cielo no empastado = línea de horizonte visible: alinea `horizon`
  del cielo con el color del fog.