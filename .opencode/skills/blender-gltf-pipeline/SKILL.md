---
name: blender-gltf-pipeline
description: >-
  Pipe de assets 3D externos al proyecto: exportar desde Blender a glTF/GLB optimizado
  (PBR, texturas 1024/2048, sin nodos complejos), comprimir con gltf-transform (Draco /
  KTX2 / meshopt), cargar con GLTFLoader/DRACOLoader, y exponer los addons de three
  (examples/jsm) en el servidor de este proyecto. Usar cuando se pida importar un modelo
  exterior (.blend/.fbx/.obj/.glb), un personaje riggeado, o cuando se mencionen
  GLTFLoader, DRACOLoader, gltf-transform, draco, ktx2, meshopt, .glb.
---

# Blender → glTF → three.js (Proyecto ClubPinü)

Este juego usa **exclusivamente contenido procedural en código** hoy. Si el usuario pide
traer modelos externos, respeta este pipe para que carguen rápido, sin bugs y con el
estilo del proyecto.

## Antes de empezar: el estado del servidor

`server/index.js` sirve `/vendor/three` → `node_modules/three/build/` **solo los builds**
(`three.module.js`, etc.). Los **addons de `examples/jsm` NO están disponibles** aún.
Para cargar glTF necesitas exponerlos:

```js
// server/index.js — añadir (después del static de /vendor/three)
app.use("/vendor/three/examples", express.static(path.join(__dirname, "..", "node_modules", "three", "examples")));
```

Luego en cliente:

```js
import { GLTFLoader } from "/vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "/vendor/three/examples/jsm/loaders/DRACOLoader.js";
```

También estarán disponibles así: `SkeletonUtils` (clone/retarget), `BufferGeometryUtils`
(mergeGeometries) y los módulos de Draco. No copies archivos dentro de `public/`: el
servidor ya sirve `node_modules` bajo `/vendor`.

## Exportar desde Blender (glTF 2.0, no OBJ/FBX)

- **Usa glTF/GLB.** Los loaders de OBJ/FBX de three están poco mantenidos.
- File → Export → **glTF 2.0**:
  - Formato: **`.glb`** (binario, self-contained). `.gltf` con texturas separadas solo si
    vas a swap de texturas en runtime; **nunca** `glTF-Embedded` (base64 +30% de peso).
  - Mesh: "Apply Modifiers", "Include Custom Properties" desactivado salvo necesidad,
    "Tangents" activado (puede elevar vértices).
  - Animations: **"Animation > Always sample animations"** si mueves el Action Editor.
  - Recuerda: curvas y no-mesh se deben convertir a malla antes de exportar.
- **Materiales**: usando el **Principled BSDF estándar, sin nodos raros**. El exportador
  glTF solo soporta lo estándar; cualquier setup complejo de nodos se pierde o sale raro.
  Aplica `Apply All Modifiers`, asegúrate de `Apply Rotation/Scale` (Ctrl+A) en los
  huesos/mallas (evita problemas de escala y skinning).
- **Texturas**: 1024×1024 o 2048×2048 máximo (justificado); texturas > 4096 se niegan.
  Para empaquetado metal-roughness puedes combinar canales (R=AO, G=Roughness, B=Metallic)
  para ahorrar memoria.
- **Rig animado**: rig + pose de repos, calcular animación en el Action Editor y exportar
  con "Always sample". Testea primero en el [glTF Viewer](https://gltf-viewer.donmccurdy.com/)
  o el Babylon Sandbox antes de tocar código del juego.
- **Unidades**: Blender 1 m = 1 u en three (match del proyecto). Si el modelo viene
  grande/pequeño, ajusta escala en el código con `gltf.scene.scale.setScalar(k)`, no
  revientes el glb.

## Optimización / compresión (pipeline)

1. **Primero** silencia en Blender lo que puedas (decimate con moderación; corta UVs).
2. Con [gltf-transform](https://gltf-transform.dev/) (CLI o JS/Node):
   - `gltf-transform optimize model.glb out.glb --compress draco` (mallas; -90/95%)
   - `gltf-transform optimize model.glb out.glb --compress ktx2` (texturas KTX2/Basis)
   - `gltf-transform optimize model.glb out.glb --texture-compress ktx2 --mesh-compress draco --texture-size [1024,1024]`
   - Combinable con `--meshopt --compress` (EXT_meshopt_compression).
3. En el juego, decoders:
   - DRACOLoader:
     ```js
     const draco = new DRACOLoader();
     draco.setDecoderPath("/vendor/three/examples/jsm/libs/draco/");
     loader.setDRACOLoader(draco);
     ```
   - KTX2Loader requiere decodificador + `loader.setKTX2Loader(ktx2)` (y transcompilar
     con `--texture-compress ktx2`). Si evitas KTX2 por simplicidad inicial, texturas
     PNG/WebP normales + Draco en mallas es aceptable.
4. Presupuesto móvil: modelo principal < 1-3 MB; mallas Draco; texturas ≤ 1024.

## Uso en el cliente (cargar escena + clips)

```js
loader.load("/assets/models/mi_personaje.glb", (gltf) => {
  scene.add(gltf.scene);
  // clips:  gltf.animations
}, (xhr) => {/* progreso */}, (err) => console.error(err));
```

- Con `AnimationMixer` y `clipAction` ver la skill `threejs-animation-rigging`.
- Los materiales PBR brillan mejor con **environment map** o con la iluminación actual
  (ambient + hemisphere + directional). Si un glTF "se ve gris/oscuro", casi siempre es
  luz, no el archivo: sube `hemisphere`/`ambient` o añade `scene.environment`.
- Tonos/colores: el renderer ya aplica `ACESFilmicToneMapping`; no cambies `outputColorSpace`
  por culpa del glTF.
- **Integración con este mundo**: los modelos externos deben entrar en el ciclo de vida
  de `createWorld`/`rebuildWorld` (crear, añadir a `scene`, liberar en dispose) y respetar
  `getTerrainHeightAt` si pisan terreno de cordillera. No cuelgues cargas globales que
  sobrevivan a `rebuildWorld`.

## Dónde poner los assets

- Carpeta sugerida: `public/assets/models/` (y `public/assets/textures/`).
- Recuerda que `express.static("public")` ya las sirve en `/assets/...`.

## Verificación
1. `node --check` en los archivos JS tocados.
2. Prueba el glB en el glTF Viewer antes de integrarlo.
3. Recarga `http://localhost:3000` y comprueba consola (cargas 404, CORS no aplica por
   el mismo origen).