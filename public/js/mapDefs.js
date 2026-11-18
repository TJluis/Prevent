// Los mapas de sala miden 120 (el doble de área que el lobby de 80) para que
// los bucles de movimiento y las coberturas tengan espacio. Cordillera Nevada
// conserva su escala de 600 y el Pueblo Nevado (lobby) sigue en 80 porque su
// pista de hockey y su decoración están dimensionadas para ese recinto.
export const MAPS = [
  { id: "nevado", name: "Pueblo Nevado", room: false, size: 80 },
  { id: "selva", name: "Selva Tropical", room: true, size: 120 },
  { id: "desierto", name: "Desierto Árido", room: true, size: 120 },
  { id: "volcan", name: "Tierras Volcánicas", room: true, size: 120 },
  { id: "pradera", name: "Pradera de Flores", room: true, size: 120 },
  { id: "ciudad", name: "Ciudad Neón", room: true, size: 120 },
  { id: "cordillera", name: "Cordillera Nevada", room: true, size: 600 },
  { id: "gruta", name: "Gruta Luminosa", room: true, size: 120 },
];

export function getMap(id) {
  return MAPS.find((map) => map.id === id) || MAPS[0];
}

export function getRoomMaps() {
  return MAPS.filter((map) => map.room);
}

export function getMapBoundary(id) {
  return getMap(id).size / 2;
}

// Más superficie = más cristales para que el combate no se concentre en el
// centro. Los mapas de 120 reparten entre 6 y 9 objetos; cordillera mantiene 18.
export const MAP_LOOT_COUNTS = {
  volcan: 6,
  selva: 7,
  pradera: 7,
  desierto: 8,
  ciudad: 9,
  cordillera: 18,
  gruta: 9,
};