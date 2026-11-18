---
name: threejs-animation-rigging
description: >-
  Animación 3D en three.js para este proyecto: AnimationMixer, AnimationClip,
  AnimationAction, KeyframeTrack, crossfade y blending con setEffectiveWeight/timeScale,
  rigging/skinning (SkinnedMesh, Skeleton, bones), morph targets, y animaciones procedurales
  en el loop de main.js (bob, rebotes, flotación, fundidos). Usar cuando se pida animar un
  personaje/modelo/pieza, hacer que algo camine/vuele/brille/rebote, crear personajes humanos 3D,
  o cuando se mencionen clips, bones, skinning, mixer, keyframes, tween.
---

# Animación y rigging en three.js (Proyecto ClubPinü)

El juego **no usa aún modelos riggeados**: los avatares son grupos de primitivas animados
en el loop (`main.js`) con senos/twens (bob, basepivot, fondir). Esta skill cubre ambos
mundos: (A) animación procedural como la actual y (B) el sistema formal de clips
(`AnimationMixer`) para cuando lleguen modelos glTF riggeados.

## (A) Animación procedural (lo que ya existe)

- Todo ocurre en el `loop(now)` de `public/js/main.js`: `dt` viene de `performance.now()`
  capado a 0.05. Patrones vigentes:
  - *Bob de caminar*: `Math.abs(Math.sin(now * 0.012)) * 0.07` sumado a la altura del
    terreno (`position.y = getTerrainHeightAt(...) + bob`).
  - *Flotación de cristales*: `group.position.y = ground + CRYSTAL_HEIGHT + Math.sin(t*1.1)*0.12` (loot.js).
  - *Rotación continua*: `mesh.rotation.y += dt * speed` para girar espigas/interiores.
  - *Pulso de opacidad/emisión*: `0.5 + 0.5 * Math.sin(t * freq)` (emissiveIntensity, glow).
  - *Fundir (melt/rise)*: tween `e = clamp01(dt*k)` con interp lineal en combat.js.
- Reglas: NO acumules `time += dt` a la vez que usas `now` (elige uno por animación);
  usa variables cerradas por objeto, no globales; reutiliza ángulos ya presentes
  (`cameraYaw`) en vez de nuevos inputs.

## (B) Sistema formal de clips (cuando haya modelos glTF riggeados)

Documentación oficial de referencia por clase: AnimationClip, AnimationMixer,
AnimationAction, KeyframeTrack, PropertyBinding, SkinnedMesh, Skeleton, MorphTargetMesh.

### Flujo estándar
1. Carga el glTF (ver skill `blender-gltf-pipeline`) y conserva
   `gltf.animations` (sus `AnimationClip`s).
2. `const mixer = new THREE.AnimationMixer(gltf.scene)` — un mixer por raíz; varios
   personajes = varios mixers.
3. `const act = mixer.clipAction(AnimationClip.findByName(clips, "Walk")); act.play()`
4. En el render loop: `mixer.update(dt)` — con el `dt` real de `main.js` loop (mismo
   patrón que `world.update`/`combat.update`). Sin `update`, la animación se congela.

### Estado del personaje (state machine mínima)
```js
let current = null;
function transitionTo(next, duration = 0.25) {
  if (current === next) return;
  next.reset().play().setEffectiveWeight(1);
  if (current) current.crossFadeTo(next, duration, true);
  current = next;
}
```
- `crossFadeTo(nextAction, duration, true)` produce transición suave idle→walk→run.
- `action.clampWhenFinished = true` para one-shots (golpe, salto) que terminen en pose
  final; `setLoop(THREE.LoopRepeat)` para cíclicos.
- Mezcla de velocidad: `walk.setEffectiveWeight(0.5)` para trote parcial; `timeScale`
  para acelerar/desacelerar (efecto "cámara lenta" o caminata rápida).
- `action.enabled = false` y `.stop()` liberan; `mixer.stopAllAction()` para cortar todo.
- Root motion: el glTF no debe arrastrar el hips en el clip a menos que lo gestiones tú
  (mover el `group` con la lógica de juego, no desde la animación).

### Skinning / rigging
- Componentes: `Bones` + `Skeleton` + `SkinnedMesh` (cargados desde glTF) o creados a
  mano con `Bone`/`SkeletonHelper`. `skinnedMesh.bind(skeleton)` tras componer.
- Clonar personajes riggeados: `SkeletonUtils.clone(gltf.scene)` (un clon por jugador,
  misma geometría/material por referencia). Está en
  `node_modules/three/examples/jsm/utils/SkeletonUtils.js` — NO servido aún por el
  servidor (ver skill `blender-gltf-pipeline` para exponer addons).
- Retargeting entre rigs con jerarquías/nombres distintos: `SkeletonUtils.retargetClip(...)`
  (avanzado, úsalo solo si el glTF lo exige).
- Morph targets (expresiones, blending de forma): clips que animan
  `morphTargetInfluences`; carga desde glTF con `Mesh.morphTargetDictionary`.

### Pitfalls
- `mixer.update()` con un `dt` gigante (pestaña en segundo plano) te desplaza los clips:
  capa `dt` a 0.05 como ya hace el loop.
- Mezclar clips de rigs distintos = "pops" violentos: valida que compartan jerarquía/nombres.
- CPU cost: muchos `KeyframeTrack` = coste alto; borra tracks innecesarios al preprocesar.
- Dos llamadas `mixer.update` por frame duplican velocidad; llama **una vez** por raíz por frame.
- `AnimationObjectGroup` permite un clip compartido entre muchos objetos (partículas de
  logo), pero ojo con el estado.

## Lo que NO tocar
- No sustituyas el `loop` existente por `THREE.Clock`: el juego usa `performance.now()`
  + `dt` explícito. Integra `mixer.update(dt)` dentro del flujo actual, no agreges otro reloj.
- Mantén las animaciones procedurales para props (cristales, glow, nieve) y reserva clips
  para personajes riggeados.