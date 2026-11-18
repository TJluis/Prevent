import { getMapBoundary, getMapObstacles } from "./world.js";

const SIZE = 160;

const BOX_COLORS = {
  igl: "rgba(120, 190, 235, 0.85)",
  building: "rgba(120, 140, 230, 0.9)",
  ruin: "rgba(216, 181, 122, 0.9)",
  crate: "rgba(200, 160, 105, 0.9)",
};
const CIRCLE_COLORS = {
  pine: "rgba(120, 200, 140, 0.9)",
  leaf: "rgba(90, 190, 120, 0.9)",
  cactus: "rgba(110, 180, 90, 0.95)",
  rock: "rgba(165, 170, 180, 0.95)",
  pillar: "rgba(90, 95, 130, 0.95)",
  stalagmite: "rgba(120, 230, 200, 0.9)",
  shroom: "rgba(200, 120, 230, 0.9)",
};

export function createMinimap() {
  const canvas = document.getElementById("minimap");
  const ctx = canvas.getContext("2d");
  let lastDraw = 0;
  let cacheBoundary = 40;

  function range() {
    return cacheBoundary * 2;
  }
  function toScreen(boundary, coord) {
    return ((coord + boundary) / (boundary * 2)) * SIZE;
  }
  function toSize(boundary, coord) {
    return (coord / (boundary * 2)) * SIZE;
  }

  function draw(me, positions, mapId) {
    const now = performance.now();
    if (now - lastDraw < 100) return;
    lastDraw = now;
    cacheBoundary = getMapBoundary(mapId || "nevado");

    ctx.clearRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = "rgba(10, 18, 32, 0.45)";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, SIZE, SIZE, 10) : ctx.rect(0, 0, SIZE, SIZE);
    ctx.fill();

    // obstáculos
    const boundary = cacheBoundary;
    for (const obstacle of getMapObstacles(mapId || "nevado")) {
      const sx = toScreen(boundary, obstacle.x);
      const sz = toScreen(boundary, obstacle.z);
      if (obstacle.type === "box") {
        ctx.fillStyle = BOX_COLORS[obstacle.kind] || "rgba(170, 200, 225, 0.85)";
        ctx.fillRect(
          sx - toSize(boundary, obstacle.w) / 2,
          sz - toSize(boundary, obstacle.d) / 2,
          Math.max(2, toSize(boundary, obstacle.w)),
          Math.max(2, toSize(boundary, obstacle.d))
        );
      } else {
        ctx.fillStyle = CIRCLE_COLORS[obstacle.kind] || "rgba(170, 200, 225, 0.9)";
        ctx.beginPath();
        ctx.arc(sx, sz, Math.max(1.5, toSize(boundary, obstacle.r * 2)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (mapId === "nevado") {
      ctx.fillStyle = "rgba(140, 190, 235, 0.35)";
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, (16.5 / range()) * SIZE, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, (16 / range()) * SIZE, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    for (let i = 1; i < 8; i++) {
      const pos = (i / 8) * SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, SIZE);
      ctx.moveTo(0, pos);
      ctx.lineTo(SIZE, pos);
      ctx.stroke();
    }

    positions.forEach((player) => {
      const sx = toScreen(boundary, player.x);
      const sz = toScreen(boundary, player.z);
      ctx.beginPath();
      ctx.arc(sx, sz, 4, 0, Math.PI * 2);
      ctx.fillStyle = player.color || "#8b93a7";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    if (me) {
      const sx = toScreen(boundary, me.x);
      const sz = toScreen(boundary, me.z);
      ctx.beginPath();
      ctx.arc(sx, sz, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#4c84ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  return {
    update(me, positions, mapId) {
      draw(me, positions, mapId);
    },
    clear() {
      ctx.clearRect(0, 0, SIZE, SIZE);
    },
  };
}