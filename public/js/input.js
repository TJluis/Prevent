const keys = new Set();

addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
});

addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

export function getInputDirection() {
  let dx = 0;
  let dz = 0;

  if (keys.has("w") || keys.has("arrowup")) dz -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dz += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  return { dx, dz };
}