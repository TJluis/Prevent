# Personajes animados 3D

Dominio prioritario de Club Pingui. Cubre modelado, rigging, animación y export de personajes para Three.js.

## Flujo recomendado

1. **Bloqueo de silueta y proporciones** — antes de cualquier detalle, define la silueta del personaje con primitivas simples (cápsulas, esferas, cajas) en las proporciones correctas. Un personaje se lee primero por su silueta; si no se distingue en negro sobre blanco, el detalle no la va a salvar.
2. **Topología pensada para animación** — si el modelo se va a riggear, evita geometría innecesariamente densa en zonas rígidas (torso, cabeza) y concentra los polígonos en zonas de flexión (codos, rodillas, cuello, base de aletas/alas si aplica).
3. **Rigging**:
   - **Camino rápido (recomendado por defecto):** Mixamo. Sube el modelo en T-pose, deja que Mixamo detecte las articulaciones (ajusta manualmente si el personaje no es completamente humanoide, ej. pingüinos con aletas en vez de brazos), descarga en FBX y convierte a glTF para Three.js.
   - **Camino con más control:** Blender vía `blender-mcp` (ver `blender-mcp.md`) para rigging manual o personajes no-humanoides donde Mixamo falla (más de 2 brazos/piernas, colas, alas).
4. **Animación**:
   - Reutiliza la librería de animaciones de Mixamo (caminar, correr, idle, saltar) como base y solo crea animaciones custom para acciones específicas del personaje.
   - Para movimiento secundario (orejas, colas, ropa, aletas que se mecen) usa la librería `wiggle` de Three.js (`npm install wiggle`) sobre huesos ya riggeados — es más barato que animar esos huesos a mano y da vida al personaje sin trabajo extra:

```javascript
import { WiggleBone } from "wiggle";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
loader.load("/personaje.gltf", ({ scene }) => {
  const mesh = scene.getObjectByName("SkinnedMesh");
  const wiggleBones = [];
  mesh.skeleton.bones.forEach((bone) => {
    if (bone.parent.isBone) {
      wiggleBones.push(WiggleBone(bone, { velocity: 0.5 }));
    }
  });
  function tick() {
    wiggleBones.forEach((wb) => wb.update());
    requestAnimationFrame(tick);
  }
  tick();
});
```

5. **Export**: siempre a GLB (glTF binario) con las animaciones embebidas — un solo archivo por personaje, sin texturas ni buffers sueltos, para que el pipeline de Three.js del proyecto lo cargue sin dependencias externas.

## Convenciones del proyecto

- Nombre de archivo: `camelCaseEnIngles.glb` (ej. `personajePinguinoGuardia.glb`), coherente con el resto del proyecto.
- Nombre del skeleton root: `Armature` (estándar de Mixamo/Blender, no lo renombres — rompe la reutilización de animaciones).
- Si el personaje es no-humanoide (aletas, pico, cola), documenta en un comentario junto al asset qué huesos de Mixamo se remapearon a qué partes del cuerpo.

## Checklist de calidad antes de entregar

- [ ] La silueta se reconoce sin detalle ni color (test de silueta en negro).
- [ ] El rig soporta al menos: idle, caminar, y una acción específica del personaje.
- [ ] No hay geometría duplicada ni normales invertidas visibles.
- [ ] El archivo final es un único `.glb` con animaciones embebidas.
- [ ] El pivote/origen del modelo está en los pies (para que se pare correctamente sobre el terreno del mapa), no en el centro del bounding box.
