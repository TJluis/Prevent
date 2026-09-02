import * as THREE from "/vendor/three/three.module.js";

export const BOUNDARY = 20;

export const CRATES = [
  { x: 5, z: 3, w: 2, d: 2 },
  { x: -6, z: 4, w: 2, d: 2 },
  { x: 0, z: -7, w: 3, d: 3 },
  { x: -8, z: -4, w: 2, d: 2 },
  { x: 8, z: -2, w: 1.5, d: 1.5 },
];

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);

  let renderer;
  try {
    if (!window.WebGL2RenderingContext) {
      throw new Error("WebGL2 no está disponible en este navegador");
    }
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    throw new Error(
      "No se pudo inicializar el 3D (" + err.message + "). Activa la aceleración de hardware de tu navegador."
    );
  }

  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.domElement.className = "penguin-canvas";

  const container = document.getElementById("game");
  container.prepend(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(12, 22, 10);
  sun.castShadow = true;
  scene.add(ambient, sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(BOUNDARY * 2, BOUNDARY * 2),
    new THREE.MeshStandardMaterial({ color: 0x3b6ea5 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(BOUNDARY * 2, 20, 0xffffff, 0xffffff);
  grid.position.y = 0.01;
  scene.add(grid);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xc83e4d });
  const wallLong = new THREE.BoxGeometry(BOUNDARY * 2, 1, 0.3);
  const wallShort = new THREE.BoxGeometry(0.3, 1, BOUNDARY * 2);

  const north = new THREE.Mesh(wallLong, wallMaterial);
  north.position.set(0, 0.5, -BOUNDARY);
  const south = new THREE.Mesh(wallLong, wallMaterial);
  south.position.set(0, 0.5, BOUNDARY);
  const west = new THREE.Mesh(wallShort, wallMaterial);
  west.position.set(-BOUNDARY, 0.5, 0);
  const east = new THREE.Mesh(wallShort, wallMaterial);
  east.position.set(BOUNDARY, 0.5, 0);
  scene.add(north, south, west, east);

  const crateGeometry = new THREE.BoxGeometry(2, 2, 2);
  const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x9a6b2f });
  for (const crate of CRATES) {
    const mesh = new THREE.Mesh(crateGeometry, crateMaterial);
    mesh.scale.set(crate.w / 2, 1, crate.d / 2);
    mesh.position.set(crate.x, 1, crate.z);
    mesh.castShadow = true;
    scene.add(mesh);
  }

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { scene, camera, renderer };
}