# Diseño 3D genérico

Para cualquier prop, vehículo, edificio, vegetación o elemento de escena que no sea un personaje, un terreno o un arma (ver los otros archivos de `references/` para esos casos). Los mismos principios de Three.js aplican a todo lo demás.

## Principios generales

- **Materiales**: usa `MeshStandardMaterial` o `MeshPhysicalMaterial` para que la iluminación de la escena responda de forma realista; reserva `MeshBasicMaterial` solo para elementos sin sombreado (UI, efectos planos).
- **Iluminación**: una escena 3D se lee mejor con al menos una luz direccional (sol) + una luz ambiental o hemisférica suave, en vez de solo luces puntuales — evita que las zonas en sombra se vean completamente negras.
- **Optimización de polígonos**: usa `BufferGeometry` siempre (no `Geometry`, deprecado), y para escenas con muchos objetos repetidos (rocas, vegetación, props del mapa) usa `InstancedMesh` en vez de clonar meshes individuales — el ahorro de rendimiento es enorme cuando hay cientos de instancias.
- **Exportación**: glTF/GLB como formato final para todo lo que entra a Three.js, igual que en los otros dominios. Evita FBX/OBJ como entrega final salvo que sea un paso intermedio hacia Blender.

## Código procedural vs. malla importada

Cuando el objeto se puede describir bien con geometría simple (cajas, cilindros, extrusiones, booleans), prioriza generarlo como código Three.js directo en vez de modelarlo en un programa externo e importar la malla. Esto es más ligero, más fácil de ajustar por IA después (cambiar un parámetro en vez de re-exportar un archivo), y evita acumular assets binarios pesados en el repositorio del proyecto. Resérvate Blender para cuando la forma realmente necesite esculpido orgánico, topología compleja o un flujo de trabajo que el código no puede describir razonablemente.

## Cuándo usar Blender vía `blender-mcp`

Ver `blender-mcp.md`. En resumen: formas orgánicas, escenas completas con iluminación/render de referencia, o generación de assets vía Poly Haven/Sketchfab/Hyper3D cuando el proyecto necesite variedad rápida (ej. poblar un mapa con vegetación variada).

## Convenciones del proyecto

- Nombre de archivo: `camelCaseEnIngles.js` o `.glb` según el backend usado (ej. `propBarrilHielo.js`, `edificioFaro.glb`), coherente con el resto del proyecto (`world.js`, `mapDefs.js`).
- Todo objeto que vaya a colocarse en el mapa debe tener su pivote en la base (donde toca el suelo), no en el centro del bounding box — es la misma convención que en `terrenos.md` y `personajes.md`, y es lo que permite anclar cada objeto al terreno de forma consistente desde `public/js`.

## Checklist de calidad antes de entregar

- [ ] Usa `MeshStandardMaterial`/`MeshPhysicalMaterial` salvo razón explícita para no hacerlo.
- [ ] La escena tiene al menos una fuente de luz ambiental además de la direccional.
- [ ] Si hay múltiples instancias del mismo objeto, se usó `InstancedMesh`.
- [ ] El pivote está en la base del objeto, no en el centro.
- [ ] El formato de entrega final es glTF/GLB o código Three.js puro, no un formato intermedio.
