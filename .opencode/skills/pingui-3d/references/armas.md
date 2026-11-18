# Armas 3D

Dominio prioritario de Club Pingui. Cubre modelado de armas (cuerpo a cuerpo y a distancia) listas para acoplarse a un personaje.

## Flujo recomendado

1. **Modelado hard-surface con primitivas** — la mayoría de las armas (espadas, lanzas, pistolas, rifles) se construyen bien combinando cajas, cilindros y conos con boolean/extrusión, no con esculpido orgánico. Empieza con el bloqueo de proporciones (largo total, grosor de agarre, balance visual) antes de detallar.
2. **Low-poly por defecto** — un arma casi nunca necesita más polígonos que el personaje que la porta. Prioriza detalle con normal maps/materiales antes que con geometría, salvo en el proyecto se busque un estilo explícitamente más detallado.
3. **Pivote y escala correctos** — el punto de origen (pivot) del modelo debe estar donde la mano del personaje la sostiene (el agarre), no en el centro geométrico del arma. Esto es lo que permite acoplarla como hijo del hueso de la mano sin ajustes manuales cada vez.
4. **Materiales**: define al menos metal base + variante con desgaste (scratches/rust vía textura o vertex color) para que el mismo modelo sirva para versiones "nueva" y "usada" del arma sin duplicar geometría.

## Acople a personajes riggeados

Cuando el arma debe ir en la mano de un personaje ya riggeado (ver `personajes.md`):

```javascript
const manoDerecha = personaje.getObjectByName("mixamorigRightHand");
manoDerecha.add(arma); // el pivote del arma ya debe estar alineado al agarre
arma.position.set(0, 0, 0);
arma.rotation.set(0, 0, 0); // ajustar solo si el agarre no quedó perfectamente alineado
```

Si el personaje es no-humanoide (ej. pingüino sosteniendo un arma con una aleta), documenta el offset de rotación/posición necesario junto al asset — no va a ser cero.

## Backend recomendado

- **Formas geométricas simples y hard-surface**: código procedural directo en Three.js es suficiente y más rápido de iterar.
- **Armas con detalle orgánico o grabados complejos**: Blender vía `blender-mcp` (ver `blender-mcp.md`), exportando a GLB al final.

## Convenciones del proyecto

- Nombre de archivo: `camelCaseEnIngles.glb` o `.js` si es puramente procedural (ej. `armaLanzaHielo.glb`), coherente con el resto del proyecto.
- Incluye siempre las dimensiones reales aproximadas (largo/ancho) en un comentario, para mantener consistencia de escala entre armas del mismo proyecto.

## Checklist de calidad antes de entregar

- [ ] El pivote está en el punto de agarre, no en el centro del modelo.
- [ ] La escala es consistente con otras armas ya existentes en el proyecto.
- [ ] Existe al menos una variante de material (nueva/desgastada) si el diseño del juego lo requiere.
- [ ] El polycount es razonable comparado con el personaje que la porta (no la domina visualmente sin razón).
- [ ] Se probó acoplada a la mano/aleta del personaje objetivo, no solo de forma aislada.
