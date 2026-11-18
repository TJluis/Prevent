---
name: pingui-3d
description: Usa esta skill para cualquier trabajo de diseño 3D dentro del proyecto Club Pingui — creación de personajes 3D animados, mapas extensos con terreno/relieve, armas 3D, o cualquier otro asset para Three.js/WebGL. Actívala siempre que el usuario pida modelar, riggear, animar, texturizar, generar terreno, construir un mapa, diseñar un arma, o mejorar/refinar cualquier objeto, personaje, entorno o prop en 3D — incluso si no usa la palabra "3D" explícitamente (ej. "arma para el personaje", "el relieve del mapa", "que se vea más profesional", "dale más detalle"). Úsala también cuando se pida conectar con Blender vía MCP o integrar un asset con el mundo del juego.
license: MIT
---

# Pingui 3D — Forge de assets para Club Pingui

Skill para producir assets 3D consistentes y de calidad profesional para Club Pingui. Motor del proyecto: **Three.js / WebGL** en navegador, con la escena construida proceduralmente en `public/js` (`world.js`, `mapDefs.js`, `weaponDefs.js`) y assets externos importados como glTF/GLB.

Cubre tres dominios prioritarios — **personajes animados**, **mapas/terrenos con relieve** y **armas** — más un modo genérico para cualquier otro objeto 3D.

## Flujo de trabajo (siempre, sin excepción)

1. **Clasifica la petición** en uno de los dominios: `personaje`, `terreno`, `arma`, `genérico`. Si no está claro, pregunta en una sola línea antes de generar nada.
2. **Carga la referencia correspondiente** de `references/` ANTES de escribir código — cada una documenta convenciones, librerías recomendadas y checklist de calidad propios del dominio. No improvises sin haberla leído.
3. **Decide el backend**:
   - **Código procedural directo en Three.js** — rápido, ligero, ideal para prototipos y para todo lo que debe vivir en el navegador junto a la escena del juego.
   - **Blender vía `blender-mcp`** — cuando se necesite geometría orgánica compleja, esculpido, generación de terreno con geometry nodes/simulación, rigging avanzado o un render de referencia antes de llevarlo a Three.js. Ver `references/blender-mcp.md`.
4. **Genera en pasadas, nunca de un solo golpe**: boceto/primitivas → proporciones y silueta → detalle → optimización. Después de cada pasada, describe o muestra el resultado antes de seguir — como lo haría un artista 3D revisando su propio trabajo, no como una entrega ciega de una sola vez.
5. **Aplica el checklist de calidad del dominio** (está al final de cada archivo de referencia) antes de dar por terminado el asset.
6. **Integra con el mundo del juego**: todo asset final debe quedar listo para colocarse en el mapa del proyecto — posición/escala/anclaje (pivote) claros, nombres de mesh y de archivo consistentes con el proyecto (camelCase en inglés: `world.js`, `mapDefs.js`, `weaponDefs.js`), sin dependencias externas rotas ni rutas absolutas.

## Dominios

| Dominio | Cuándo usarlo | Referencia |
|---|---|---|
| 🧍 Personajes animados 3D | Personajes, NPCs, avatares, animación de huesos | `references/personajes.md` |
| 🗺️ Mapas y terrenos con relieve | Niveles, islas, montañas, mapas extensos | `references/terrenos.md` |
| 🔫 Armas 3D | Espadas, armas de fuego, props de combate | `references/armas.md` |
| 🎨 Genérico | Cualquier otro prop, escena, vehículo, edificio | `references/general.md` |

## Reglas fijas para todo el proyecto

- El motor es Three.js/WebGL. Todo asset final debe poder cargarse ahí — **glTF/GLB es el formato preferido** sobre FBX/OBJ.
- Prioriza código procedural y token-eficiente sobre archivos de malla pesados cuando el resultado final lo permita (ver nota de "reconstrucción por código" en `references/general.md`). Esto mantiene los assets ligeros y fáciles de iterar con la IA.
- No regeneres desde cero si ya existe un asset similar en el proyecto — refínalo.
- Nombra cada script/asset de forma descriptiva y coherente con el resto del proyecto (convención **camelCase en inglés**, no español): `personajePinguinoGuardia.js`, `terrenoIslaNorte.js`, `armaLanzaHielo.js`. Esto mantiene consistencia con los archivos existentes (`world.js`, `mapDefs.js`, `weaponDefs.js`).
- Nunca entregues un asset sin pasar el checklist de calidad de su dominio.

## Cuándo usar Blender vía `blender-mcp`

Si el servidor `blender-mcp` está configurado en este proyecto de OpenCode (ver `references/blender-mcp.md` para instalarlo si no lo está), úsalo para:

- Esculpido orgánico de personajes (rostros, anatomía).
- Generación de terreno con geometry nodes o simulación física.
- Retopología de mallas generadas proceduralmente.
- Renders de referencia rápidos antes de portar el resultado a Three.js.

Exporta siempre el resultado final a **glTF/GLB** para que entre limpio al pipeline de Three.js del proyecto.

## Si el pedido no encaja en ningún dominio

Usa `references/general.md`: ahí están los principios de Three.js que aplican a cualquier objeto (materiales, iluminación, optimización de polígonos, exportación), generalizados a partir de los tres dominios prioritarios.
