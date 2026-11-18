# Mapas extensos con terreno y relieve

Dominio prioritario de Club Pingui. Cubre generación de terreno procedural, relieve, y cómo poblar mapas grandes sin matar el rendimiento del navegador.

## Elegir el método de generación de relieve

| Método | Cuándo usarlo |
|---|---|
| **Diamond-Square / Perlin / Simplex** (ruido procedural) | Islas, montañas, terrenos fantásticos sin referencia real. Es el caso por defecto de Club Pingui. |
| **Heightmap desde imagen** | Cuando ya existe un diseño de nivel dibujado a mano (imagen en escala de grises = altura). |
| **Datos reales de elevación** | Solo si el mapa representa un lugar geográfico real. |

## Librería recomendada: `THREE.Terrain`

Motor de generación procedural de terreno para Three.js. Soporta Diamond-Square, Perlin, Simplex, Worley (celular), fault lines y más, además de una función para esparcir meshes de decoración (árboles, rocas) sobre el terreno generado.

```javascript
import { Mesh, MeshStandardMaterial, Scene, CylinderGeometry } from "three";
import { Terrain, scatterMeshes } from "@repcomm/three.terrain";

const intervals = 63;
const terrain = new Terrain({
  material: new MeshStandardMaterial({ color: 0x44dd66 }),
  heightmap: DiamondSquare, // o Perlin, Simplex, Worley
  maxHeight: 250,
  minHeight: -100,
  widthSegments: intervals,
  width: 1024,
  heightSegments: intervals,
  height: 1024,
});

const scene = new Scene();
scene.add(terrain);

// Poblar el relieve con decoración (rocas, vegetación, props)
const decoraciones = scatterMeshes(terrain.children[0].geometry, {
  mesh: new Mesh(new CylinderGeometry(2, 2, 12, 6)),
  w: intervals,
  h: intervals,
  spread: 0.02,
  randomness: Math.random,
});
terrain.add(decoraciones);
```

## Mapas MUY extensos: LOD y streaming

Un solo mesh de terreno gigante mata el rendimiento. Para mapas extensos:

1. **Divide el mapa en tiles** (ej. cuadrícula de 3x3 o más, cada tile con su propio nivel de detalle).
2. **Genera tiles de forma continua** conforme la cámara se mueve, reciclando los tiles que quedan fuera de vista (patrón "terreno infinito"). El punto crítico es que el ruido de cada tile debe encajar perfectamente en los bordes con los tiles vecinos — usa la misma semilla de ruido con offset de coordenadas, nunca ruido independiente por tile.
3. Si el proyecto necesita algo más robusto que un sistema casero, **`procedural-gl-js`** (construido sobre Three.js) trae un sistema de nivel de detalle acelerado por GPU pensado justo para paisajes extensos, con streaming de datos de elevación y buen rendimiento en móvil — considerarlo si el terreno casero empieza a costar demasiado mantenimiento.

## Integración con el mundo del juego

- Cada tile de terreno debe registrarse con sus coordenadas de mundo (no locales), para que el resto del proyecto pueda anclar personajes, armas y props sobre el relieve correcto.
- Las alturas de spawn de personajes/props deben calcularse con un raycast vertical contra la geometría del terreno, nunca con un valor fijo — el relieve varía.

## Convenciones del proyecto

- Nombre de archivo: `camelCaseEnIngles.js` (ej. `terrenoIslaNorte.js`), coherente con el resto del proyecto.
- Documenta la semilla de ruido usada por zona, para poder regenerar o extender el mapa de forma consistente.

## Checklist de calidad antes de entregar

- [ ] El relieve no tiene "escalones" visibles bruscos salvo que sea intencional (acantilados).
- [ ] Los bordes entre tiles (si aplica) encajan sin costuras.
- [ ] La decoración (rocas, vegetación) sigue el contorno del relieve, no flota ni se hunde.
- [ ] El framerate se mantiene estable al recorrer el mapa completo (revisar segmentos/polycount si no).
- [ ] Las coordenadas de spawn/anclaje están calculadas por raycast, no hardcodeadas.
