import * as THREE from "/vendor/three/three.module.js";
import { DEFAULT_APPEARANCE } from "./appearance.js";
import { ANCHORS, SKIN_DEFS } from "./skinDefs.js";
import { buildConformingShell, buildCapShell, buildBand, surfaceFrontZAt, silhouetteRadiusAt } from "./garments.js";

function makeNameLabel(name, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = name.toUpperCase();
  const textWidth = ctx.measureText(text).width + 30;
  const x = (256 - textWidth) / 2;
  const y = 12;
  const h = 40;

  ctx.fillStyle = "rgba(10, 12, 20, 0.65)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, textWidth, h, 10);
  } else {
    ctx.rect(x, y, textWidth, h);
  }
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
  ctx.lineWidth = 4;
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  );
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

function addHat(group, appearance) {
  if (!appearance.hat) return;

  if (appearance.hat === "santa") {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xe83d54, roughness: 0.8 })
    );
    hat.position.y = 1.86;
    group.add(hat);

    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.33, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4f8fc })
    );
    brim.position.y = 1.62;
    group.add(brim);

    const pompom = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f8fc })
    );
    pompom.position.y = 2.18;
    group.add(pompom);
  } else if (appearance.hat === "tophat") {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.4 })
    );
    crown.position.y = 1.9;
    group.add(crown);

    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.4, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x141824, roughness: 0.4 })
    );
    brim.position.y = 1.62;
    group.add(brim);

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.24, 0.11, 12),
      new THREE.MeshStandardMaterial({ color: 0xc92a2a, roughness: 0.6 })
    );
    band.position.y = 1.74;
    group.add(band);
  } else if (appearance.hat === "beanie") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3f7fe0, roughness: 0.85 })
    );
    cap.position.y = 1.7;
    group.add(cap);

    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.33, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e6ab5, roughness: 0.85 })
    );
    brim.position.y = 1.55;
    group.add(brim);
  }
}

function addScarf(group, appearance) {
  if (!appearance.scarf) return;
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.09, 8, 18),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.scarf), roughness: 0.85 })
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 0.98, 0);
  group.add(scarf);

  const tail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.4),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(appearance.scarf),
      side: THREE.DoubleSide,
    })
  );
  tail.position.set(0, 0.9, 0.42);
  group.add(tail);
}

function addGlasses(group, appearance) {
  if (!appearance.glasses) return;

  if (appearance.glasses === "round") {
    const frame = new THREE.MeshStandardMaterial({ color: 0xd9a121, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.024, 8, 16),
        frame
      );
      lens.position.set(sx * 0.15, 1.38, 0.26);
      group.add(lens);
    }
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.022, 0.02),
      frame
    );
    bridge.position.set(0, 1.38, 0.26);
    group.add(bridge);
  } else if (appearance.glasses === "aviator" || appearance.glasses === "wayfarer") {
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.2,
      metalness: 0.4,
    });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.11, 0.04),
        lensMat
      );
      lens.position.set(sx * 0.15, 1.36, 0.25);
      lens.rotation.z = sx * (appearance.glasses === "aviator" ? 0.15 : 0);
      group.add(lens);
    }
  }
}

function addOutline(parent, geometry, scaleY, scaleXZ, pos) {
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x0d1016, side: THREE.BackSide })
  );
  outline.position.copy(pos);
  outline.scale.set(scaleXZ, scaleY, scaleXZ);
  outline.renderOrder = -1;
  parent.add(outline);
  return outline;
}

function mesh(geometry, color, x, y, z, roughness = 0.8) {
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness }));
  m.position.set(x, y, z);
  return m;
}

function addRow(group, color, x, y, z, w = 0.3, h = 0.07, d = 0.05) {
  group.add(mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z));
}

// Renderiza una skin desde sus definiciones (SKIN_DEFS en skinDefs.js).
// Cada parte se ancla a un punto nombrado (ANCHORS) + offset: así los
// accesorios y la ropa se ajustan solos si cambia el modelo base.
// "Cylinder" anclado a "neck" = prenda que abraza el torso (chaqueta,
// playera, short, chaleco); "Helmet" = media esfera superior (casco/gorra);
// "Plane" con "text"/"dynamic" = número o nombre de camiseta (dynamic se
// resuelve desde la apariencia y cae al fallback "text"); "back" = la pieza
// se pega a la espalda (z negativa, textura espejada); "sway" = oscilación.
const skinGeometries = {
  Box: THREE.BoxGeometry,
  Sphere: THREE.SphereGeometry,
  Cone: THREE.ConeGeometry,
  Cylinder: THREE.CylinderGeometry,
  Torus: THREE.TorusGeometry,
  Capsule: THREE.CapsuleGeometry,
};

// Textura con texto (número de camiseta o nombre en la espalda). El tamaño de
// fuente se ajusta para que quepa en el lienzo; "mirror" invierte el lienzo
// horizontalmente para que el texto se lea bien desde la espalda (la pieza
// trasera se gira PI rf en Y).
function makeTextTexture(text, color, mirror) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const str = String(text);
  ctx.font = "bold 96px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(str).width;
  const fontPx = w > 0 ? Math.max(20, Math.floor((110 / w) * 96)) : 96;
  ctx.font = `bold ${fontPx}px system-ui, sans-serif`;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.textAlign = "center";
  }
  ctx.fillStyle = color;
  ctx.fillText(str, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function resolvePlaneText(part, appearance, avatarName) {
  let value = part.dynamic && appearance ? appearance[part.dynamic] : undefined;
  if (value == null || value === "") value = part.text;
  if ((value == null || value === "") && part.fallbackToName) value = avatarName || "";
  return value == null ? "" : String(value);
}

function addSkin(group, appearance, name) {
  const def = appearance.skin ? SKIN_DEFS[appearance.skin] : null;
  if (!def || !def.parts) return;

  for (const part of def.parts) {
    const anchor = ANCHORS[part.anchor] || [0, 0, 0];
    const offset = part.offset || [0, 0, 0];
    const setPos = (m) => {
      let px = anchor[0] + offset[0];
      const py = anchor[1] + offset[1];
      let pz = anchor[2] + offset[2];
      // Anclaje a superficie: la Z se deriva de la propia silueta del cuerpo
      // en la altura de la pieza (piezas como corbata, placa, número...).
      if (part.back) {
        pz = -(silhouetteRadiusAt(py, Math.PI) + (part.surfaceZ || 0));
      } else if (part.surface) {
        pz = surfaceFrontZAt(py) + part.surfaceZ;
      }
      m.position.set(px, py, pz);
      if (part.rot) m.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
      if (part.sway) m.userData.sway = part.sway;
      group.add(m);
    };

    if (part.mesh === "Garment") {
      const mesh = new THREE.Mesh(
        buildConformingShell(part.args),
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7, side: THREE.DoubleSide })
      );
      mesh.castShadow = true;
      // La malla se genera en coordenadas absolutas del grupo (sin offset).
      mesh.position.set(0, 0, 0);
      mesh.userData.garment = true;
      mesh.userData.garmentType = "shell";
      if (part.sway) mesh.userData.sway = part.sway;
      group.add(mesh);
      continue;
    }

    if (part.mesh === "CapShell") {
      const mesh = new THREE.Mesh(
        buildCapShell(part.args),
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7, side: THREE.DoubleSide })
      );
      mesh.castShadow = true;
      mesh.position.set(0, 0, 0);
      mesh.userData.garment = true;
      mesh.userData.garmentType = "cap";
      group.add(mesh);
      continue;
    }

    if (part.mesh === "Band") {
      const mesh = new THREE.Mesh(
        buildBand(part.args),
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.75, side: THREE.DoubleSide })
      );
      mesh.castShadow = true;
      mesh.position.set(0, 0, 0);
      mesh.userData.garment = true;
      mesh.userData.garmentType = "shell";
      mesh.userData.band = true;
      group.add(mesh);
      continue;
    }

    if (part.mesh === "Helmet") {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(part.args[0], part.args[1] || 18, part.args[2] || 14, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7 })
      );
      setPos(mesh);
      continue;
    }

    if (part.mesh === "Plane") {
      const isText = part.text != null || part.dynamic != null;
      const text = isText ? resolvePlaneText(part, appearance, name) : null;
      const material =
        text != null
          ? new THREE.MeshBasicMaterial({
              map: makeTextTexture(text, part.textColor || "#ffffff", part.back === true),
              transparent: true,
              side: THREE.DoubleSide,
            })
          : new THREE.MeshStandardMaterial({ color: part.color || 0xffffff, roughness: 0.7, side: THREE.DoubleSide });
      setPos(new THREE.Mesh(new THREE.PlaneGeometry(part.args[0], part.args[1]), material));
      continue;
    }

    const mk = skinGeometries[part.mesh];
    if (!mk) continue;
    setPos(
      new THREE.Mesh(
        new mk(...part.args),
        new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7 })
      )
    );
  }
}

export function createAvatar(name, color, appearance = DEFAULT_APPEARANCE) {
  const group = new THREE.Group();
  group.userData.initScale = 1;
  group.userData.initY = 0;

  const skinDef = appearance.skin ? SKIN_DEFS[appearance.skin] : null;
  const bodyColor = skinDef?.colors?.body ?? appearance.body;
  const bellyColor = skinDef?.colors?.belly ?? appearance.belly;
  const beakColor = skinDef?.colors?.beak ?? appearance.beak;

  // Cuando la skin viste TODO el cuerpo (hideBelly) se omite la esfera de la
  // panza: esa piel sobrante es lo que "se sale" de la ropa en los dobladillos.
  const hideBelly = skinDef?.hideBelly === true;

  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bodyColor), roughness: 0.7 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bellyColor), roughness: 0.6 });

  // Cuerpo: la cápsula principal primero => ownColor() toma el color del cuerpo.
  // Proporción cartoon: más ancho y bajo (silueta de pera redondeada).
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.3, 6, 16), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  if (!hideBelly) {
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 14, 12),
      bellyMat
    );
    belly.userData.belly = true;
    belly.scale.set(1, 1.15, 0.5);
    belly.position.set(0, 0.58, 0.3);
    group.add(belly);
  }

  // Cola (detección cartoon)
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bellyMat);
  tail.position.set(0, 0.28, -0.38);
  group.add(tail);

  // Alas tipo aleta real de pingüino (silueta teardrop, aplanadas de lado y
  // apuntando abajo-atrás, pegadas al cuerpo -> cartoon).
  const wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.2, 6, 10), bodyMat);
    upper.position.y = -0.18;
    upper.castShadow = true;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bodyMat);
    tip.position.y = -0.42;
    tip.castShadow = true;
    wing.add(upper, tip);
    wing.scale.set(1, 1, 0.55);            // aplanada => silueta de aleta al girar
    wing.position.set(sx * 0.52, 0.82, 0.02);
    wing.userData.home = wing.position.clone();   // hombro en reposo (para el agarre)
    wing.userData.tipPos = new THREE.Vector3(0, -0.42, 0); // punta = "mano"
    wing.rotation.z = sx * 0.12;
    wing.rotation.x = sx < 0 ? -0.25 : 0.25;
    group.add(wing);
    wings.push(wing);
  }

  // Patas planas naranjas: más cortas y gordas
  const feetMat = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.7 });
  const feet = [];
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), feetMat);
    foot.scale.set(1.1, 0.3, 1.3);
    foot.position.set(sx * 0.19, 0.05, 0.06);
    group.add(foot);
    feet.push(foot);
  }

  // Cabeza grande de caricatura (más grande que el cuerpo)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), bodyMat);
  head.position.y = 1.32;
  head.castShadow = true;
  group.add(head);

  // Copete de plumas
  const quiff = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), bodyMat);
  quiff.position.set(0, 1.66, -0.04);
  quiff.rotation.x = -0.6;
  group.add(quiff);

  // Pico naranja caricaturesco (redondeado, corto y ancho)
  const beak = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 10),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(beakColor) })
  );
  beak.scale.set(1, 0.8, 1.4);
  beak.position.set(0, 1.27, 0.3);
  group.add(beak);

  // Boca sonriente: arco (media tora) en forma de sonrisa ∪
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.016, 6, 14, Math.PI),
    bellyMat
  );
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, 1.18, 0.27);
  group.add(mouth);

  // Ojos grandes con blanco + pupila + doble brillo (estilo anime/cartoon)
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.2 });
  const glintMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), whiteMat);
    white.scale.set(1, 1.15, 0.6);
    eye.add(white);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), pupilMat);
    pupil.position.set(sx * 0.015, 0, 0.06);
    eye.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), glintMat);
    glint.position.set(sx * 0.035, 0.05, 0.1);
    eye.add(glint);

    const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), glintMat);
    glint2.position.set(sx * 0.02, -0.045, 0.1);
    eye.add(glint2);

    eye.position.set(sx * 0.15, 1.38, 0.26);
    group.add(eye);
    eyes.push(eye);
  }

  // Cejas expresivas más marcadas (alegres: más altas hacia afuera)
  const browMat = new THREE.MeshStandardMaterial({ color: 0x17202a, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.014), browMat);
    brow.position.set(sx * 0.15, 1.52, 0.28);
    brow.rotation.z = sx * 0.18;
    group.add(brow);
  }

  // Mejillas rosadas más grandes
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xff9fb5,
    roughness: 0.8,
    transparent: true,
    opacity: 0.6,
  });
  for (const sx of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), blushMat);
    blush.scale.set(1, 0.8, 0.7);
    blush.position.set(sx * 0.24, 1.24, 0.22);
    group.add(blush);
  }

  addGlasses(group, appearance);
  addScarf(group, appearance);
  addHat(group, appearance);
  addSkin(group, appearance, name);

  const label = makeNameLabel(name, color);
  label.position.y = 2.05;
  group.add(label);

  group.userData.limbs = {
    leftWing: wings[0],
    rightWing: wings[1],
    leftFoot: feet[0],
    rightFoot: feet[1],
    leftEye: eyes[0],
    rightEye: eyes[1],
    head,
    quiff,
    body,
  };

  return group;
}

// ------------------------------------------------ AGARRE DEL ARMA (3ª persona) ------------------------------------------------
// Sin arma las aletas cuelgan (reposo/aleteo). Con arma, las DOS van a los
// puntos de agarre que publica el modelo (viewmodel.buildWeaponGroup ->
// userData.grips) para que parezca que el pingüino sujeta el arma con las dos
// aletas, en vez de que le queden colgando en vertical al cogERLA.
//
// Técnica: la aleta es una cápsula que cuelga de su hombro por su eje -Y, así
// que basta apuntar ese eje al agarre (Quaternion.setFromUnitVectors) y
// deslizar el hombro un poco hacia el objetivo cuando el agarre queda fuera de
// alcance. El estiramiento (scale.y) reutiliza el squash & stretch cartoon que
// ya hace el cuerpo al andar: las armas largas estiran las aletas un poco más.
const WING_DOWN = new THREE.Vector3(0, -1, 0); // eje de la aleta (la punta mira a -Y)
const WING_REACH = 0.42;                       // hombro -> punta de la aleta
const WING_STRETCH = 1.45;                     // estiramiento máximo al agarrar
const WING_PULL = 0.2;                         // cuánto se acerca el hombro al agarre
const WING_RISE = 0.28;                        // las aletas no suben del hombro (no tapan la cara)
const WING_GAP = 0.16;                         // separación mínima entre las dos aletas
const WING_CRADLE = 0.03;                      // las aletas cradlean el arma por debajo
const WING_BREATHE = 0.012;                    // respiración del agarre (no queda congelado)
const ARM_EASE = 7;                            // velocidad de entrada/salida del agarre

const _gr = new THREE.Vector3();
const _gl = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Registra el arma que lleva el avatar en 3ª persona (null = sin arma).
export function setAvatarWeapon(group, gun) {
  if (!group || !group.userData) return;
  group.userData.weaponGroup = gun || null;
}

function poseWingsForGun(group, gun, k, now) {
  const { leftWing, rightWing } = group.userData.limbs;
  const grips = gun.userData && gun.userData.grips;
  if (!grips || !grips.right || !grips.left) return;

  // Se usa la matriz real del arma (combat.update la recompone en cada frame
  // para el retroceso y el barrido cuerpo a cuerpo): las aletas la siguen.
  gun.updateMatrix();
  _gr.fromArray(grips.right).applyMatrix4(gun.matrix);
  _gl.fromArray(grips.left).applyMatrix4(gun.matrix);

  // El arma va girada 180° en Y para apuntar al frente del pingüino, así que el
  // agarre "right" del modelo cae del lado izquierdo: se reparte por posición.
  const flip = _gr.x < _gl.x;
  const targets = [
    { wing: flip ? rightWing : leftWing, grip: flip ? _gl : _gr },
    { wing: flip ? leftWing : rightWing, grip: flip ? _gr : _gl },
  ];

  // Separación mínima: las dos aletas no se solapan ni se meten en la misma.
  const midX = (_gr.x + _gl.x) * 0.5;
  const spread = Math.abs(_gr.x - _gl.x);
  if (spread < WING_GAP) {
    const push = (WING_GAP - spread) * 0.5;
    if (_gr.x >= _gl.x) {
      _gr.x = midX + push;
      _gl.x = midX - push;
    } else {
      _gr.x = midX - push;
      _gl.x = midX + push;
    }
  }

  const breathe = Math.sin(now * 0.0026) * WING_BREATHE;
  const gripOf = (t) => {
    _aim.set(t.grip.x, t.grip.y + WING_CRADLE + breathe, t.grip.z);
    return _aim;
  };

  // Estiramiento compartido por las dos aletas -> silueta simétrica.
  let maxDist = 0;
  for (const t of targets) {
    if (!t.wing) continue;
    const d = gripOf(t).sub(t.wing.userData.home).length();
    if (d > maxDist) maxDist = d;
  }
  const stretch = Math.max(1, Math.min(WING_STRETCH, maxDist / WING_REACH));
  const reach = WING_REACH * stretch;

  for (const t of targets) {
    const wing = t.wing;
    if (!wing) continue;
    const home = wing.userData.home;
    const dist = gripOf(t).sub(home).length();
    if (dist < 1e-4) continue;
    _aim.divideScalar(dist);
    if (_aim.y > WING_RISE) {
      _aim.y = WING_RISE;
      _aim.normalize();
    }
    _q.setFromUnitVectors(WING_DOWN, _aim);
    wing.quaternion.slerp(_q, k);
    const pull = Math.max(0, Math.min(WING_PULL, (dist - reach) * 0.8));
    wing.position.copy(home).addScaledVector(_aim, -pull);
    wing.scale.y = 1 + (stretch - 1) * k;
  }
}

export function animateAvatar(group, now, dt, isMoving, pose = {}) {
  if (!group || !group.userData || !group.userData.limbs) return;
  const { leftWing, rightWing, leftFoot, rightFoot, leftEye, rightEye, head, quiff, body } =
    group.userData.limbs;
  const jumping = !!pose.jumping;
  const sliding = !!pose.sliding;
  const sprinting = !!pose.sprinting && !sliding && !jumping;

  // Parpadeo: cada ~3.2s un plaf cerrado rápido (1 frame de poblado al 20%)
  const blinkCycle = (now * 0.001) % 3.2;
  let blink = 0;
  if (blinkCycle < 0.16) {
    blink = (1 - Math.abs(blinkCycle - 0.08) / 0.08) * 0.95;
  }
  const blinkScaleY = 1 - blink;
  if (leftEye) leftEye.scale.y = blinkScaleY;
  if (rightEye) rightEye.scale.y = blinkScaleY;

  if (isMoving) {
    const time = now * (sprinting ? 0.02 : 0.014);
    // Bamboleo de cuerpo (waddle roll)
    group.rotation.z = Math.sin(time) * 0.08;

    // Aleteo cartoon (alas-ancla aletean hacia fuera-abajo)
    if (leftWing) {
      leftWing.rotation.z = -0.12 - Math.sin(time * 1.3) * 0.22;
      leftWing.rotation.x = -0.25;
    }
    if (rightWing) {
      rightWing.rotation.z = 0.12 + Math.sin(time * 1.3) * 0.22;
      rightWing.rotation.x = 0.25;
    }

    // Pasitos alternados
    if (leftFoot) leftFoot.position.z = 0.06 + Math.cos(time) * 0.1;
    if (rightFoot) rightFoot.position.z = 0.06 - Math.cos(time) * 0.1;

    // Inclinación suave de cabeza
    if (head) head.position.y = 1.32 + Math.abs(Math.sin(time * 1.5)) * 0.03;
    if (quiff) quiff.rotation.x = -0.6 + Math.sin(time * 2) * 0.1;

    // Squash & stretch: se estira al moverse (scala local del cuerpo, no del grupo)
    if (body) body.scale.set(1 + Math.abs(Math.sin(time * 1.3)) * 0.08, 1 - 0.05, 1 + 0.03);
  } else {
    const idleTime = now * 0.003;
    group.rotation.z = 0;
    if (leftWing) {
      leftWing.rotation.z = -0.12 + Math.sin(idleTime) * 0.04;
      leftWing.rotation.x = -0.25;
    }
    if (rightWing) {
      rightWing.rotation.z = 0.12 - Math.sin(idleTime) * 0.04;
      rightWing.rotation.x = 0.25;
    }
    if (leftFoot) leftFoot.position.z = 0.06;
    if (rightFoot) rightFoot.position.z = 0.06;
    if (head) head.position.y = 1.32 + Math.sin(idleTime * 1.5) * 0.015;
    if (quiff) quiff.rotation.x = -0.6 + Math.sin(idleTime) * 0.05;

    // Squash & stretch respirando suave en inactivo
    if (body) body.scale.set(1 + Math.sin(idleTime * 2) * 0.02, 1 - Math.sin(idleTime * 2) * 0.02, 1);
  }

  // Fase 4: pose de salto / sprint / deslizamiento. El grupo se inclina en
  // rotación X (el morro del pingüino apunta a +Z) y las aletas acompañan.
  group.rotation.x = sliding ? -0.95 : sprinting ? 0.18 : jumping ? -0.12 : 0;
  if (jumping) {
    if (leftWing) {
      leftWing.rotation.z = -0.95;
      leftWing.rotation.x = -0.45;
    }
    if (rightWing) {
      rightWing.rotation.z = 0.95;
      rightWing.rotation.x = 0.45;
    }
    if (leftFoot) leftFoot.position.z = 0.02;
    if (rightFoot) rightFoot.position.z = 0.02;
  } else if (sliding) {
    if (leftWing) {
      leftWing.rotation.z = -0.05;
      leftWing.rotation.x = -0.55;
    }
    if (rightWing) {
      rightWing.rotation.z = 0.05;
      rightWing.rotation.x = 0.55;
    }
    if (leftFoot) leftFoot.position.z = 0.22;
    if (rightFoot) rightFoot.position.z = 0.22;
  }

  // Ropa colgante (corbata, fajín, cintas...): oscilación sutil que acompaña
  // al movimiento del pingüino.
  const swayTime = (isMoving ? now * 0.014 : now * 0.003);
  group.traverse((obj) => {
    const sway = obj.userData && obj.userData.sway;
    if (!sway) return;
    obj.rotation.z = Math.sin(swayTime * (sway.speed || 2)) * (sway.amp || 0.05);
  });

  // Agarre: con arma las dos aletas la sujetan; sin arma vuelven al hombro.
  const gun = group.userData.weaponGroup;
  let armK = group.userData.armK || 0;
  armK = gun
    ? Math.min(1, armK + dt * ARM_EASE)
    : Math.max(0, armK - dt * ARM_EASE);
  group.userData.armK = armK;
  if (armK > 0.001 && gun) {
    poseWingsForGun(group, gun, armK, now);
  } else {
    if (leftWing) {
      leftWing.position.copy(leftWing.userData.home);
      leftWing.scale.y = 1;
    }
    if (rightWing) {
      rightWing.position.copy(rightWing.userData.home);
      rightWing.scale.y = 1;
    }
  }
}