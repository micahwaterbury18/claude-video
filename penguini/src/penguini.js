// penguini.js - the man himself, built entirely out of basic shapes.
//
// There is no downloaded 3D model here. Every part of him is a sphere, a
// capsule, a cylinder or a box, stacked up and coloured. That means he costs
// nothing, loads instantly, and you can change any part of him by editing a
// number in this file.
//
// He's built as a tree: the head is attached to the body, the beak is attached
// to the head, and so on. Move the body and everything follows.

import * as THREE from 'three';

// His personal palette. The game's world is navy and ice; the purple is HIS.
export const PENGZ = {
  feather: 0x171a22,   // soft black - never pure black, that reads as a hole
  belly: 0xf4efe4,     // cream
  tee: 0xefe8da,       // the oversized shirt, slightly warmer than his belly
  beak: 0xe9a93c,      // gold-orange
  purple: 0x8257e5,    // dreads, graphics, sneaker accents
  purpleDark: 0x5b3aa8,
  chrome: 0xe2eaf4,    // the chain
  shade: 0xf7f9fb,     // the white sunglasses
  gunmetal: 0x77839a,
  shortsBlack: 0x1b1e26,
};

/** Quick helper: a standard material in the game's chunky, matte style. */
function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.75,
    metalness: options.metalness ?? 0.0,
    flatShading: options.flatShading ?? false,
    ...options.extra,
  });
}

/**
 * The graphic on the front of his tee, drawn with code onto a canvas.
 *
 * A canvas is just a blank image we paint on in JavaScript - so this still
 * counts as "no downloaded assets". Change the words here and the shirt
 * changes.
 */
function createTeeGraphic() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Shirt colour fills the whole thing first.
  ctx.fillStyle = '#efe8da';
  ctx.fillRect(0, 0, 512, 512);

  // A few faint smudges so the shirt doesn't look factory-fresh. He's broke.
  ctx.fillStyle = 'rgba(120, 110, 95, 0.06)';
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // The word across the chest.
  ctx.fillStyle = '#3a2f4f';
  ctx.font = 'bold 62px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HEARTBROKEN', 256, 168);

  // A cracked heart underneath it.
  ctx.save();
  ctx.translate(256, 320);
  ctx.fillStyle = '#8257e5';
  ctx.beginPath();
  // Two lobes and a point - a heart, drawn the long way round.
  ctx.moveTo(0, 62);
  ctx.bezierCurveTo(-86, -6, -52, -78, 0, -34);
  ctx.bezierCurveTo(52, -78, 86, -6, 0, 62);
  ctx.fill();
  // The crack down the middle.
  ctx.strokeStyle = '#efe8da';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(2, -36);
  ctx.lineTo(-14, -4);
  ctx.lineTo(10, 6);
  ctx.lineTo(-6, 44);
  ctx.stroke();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The beanie, with the rolled brim. */
function createBeanie() {
  const group = new THREE.Group();
  const black = mat(0x1c1c24, { roughness: 0.95 });

  // The dome of the hat. It only covers the crown - pull it any lower and it
  // swallows his eyes, which is where the whole performance lives.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.475, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
    black
  );
  group.add(cap);

  // The thick rolled-up brim, sitting right on the join.
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.062, 12, 28), black);
  brim.rotation.x = Math.PI / 2;
  group.add(brim);

  // The little seam on top.
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), black);
  top.position.y = 0.235;
  group.add(top);

  group.traverse((o) => { o.castShadow = true; });
  return group;
}

/** The purple dreads hanging out from under the beanie. */
function createDreads() {
  const group = new THREE.Group();
  const purple = mat(PENGZ.purple, { roughness: 0.85 });
  const purpleDark = mat(PENGZ.purpleDark, { roughness: 0.85 });

  const count = 14;
  for (let i = 0; i < count; i++) {
    // Spread them round the back and sides of his head, not over his face.
    const angle = (i / count) * Math.PI * 2;
    const facing = Math.cos(angle); // +1 = front of head
    if (facing > 0.62) continue;    // skip the ones that would cover his eyes

    const length = 0.38 + (i % 3) * 0.11;
    const dread = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, length, 4, 8),
      i % 2 ? purple : purpleDark
    );

    const radius = 0.42;
    dread.position.set(
      Math.sin(angle) * radius,
      -0.10 - length * 0.35,
      Math.cos(angle) * radius
    );
    // Let them splay outward a little instead of hanging dead straight.
    dread.rotation.z = -Math.sin(angle) * 0.35;
    dread.rotation.x = Math.cos(angle) * 0.30;
    dread.castShadow = true;
    group.add(dread);
  }
  return group;
}

/** The chain, built as real links so it catches the light properly. */
function createChain() {
  const group = new THREE.Group();
  const silver = mat(PENGZ.chrome, { roughness: 0.32, metalness: 0.25 });

  const links = 22;
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    // Sweep an arc from one shoulder, down across the chest, to the other.
    const a = Math.PI * (1 - t);
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.011, 6, 12), silver);
    link.position.set(Math.cos(a) * 0.26, -Math.sin(a) * 0.30, 0.20 + Math.sin(a) * 0.06);
    // Every other link turns 90 degrees, the way a real chain does.
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    link.rotation.x = Math.PI / 2;
    group.add(link);
  }

  // The pendant hanging at the bottom of the loop.
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.10, 0.035), silver);
  tag.position.set(0, -0.345, 0.27);
  group.add(tag);

  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.135, 0.065, 0.01),
    mat(PENGZ.purple, { roughness: 0.4 })
  );
  face.position.set(0, -0.345, 0.29);
  group.add(face);

  return group;
}

/** One arm: a flipper, with the striped undershirt sleeve showing. */
function createArm(side) {
  // side is -1 for his right (screen left) or +1 for his left.
  const pivot = new THREE.Group();

  // The tee's short sleeve.
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.14, 4, 12), mat(PENGZ.tee));
  sleeve.position.y = -0.10;
  pivot.add(sleeve);

  // Striped forearm - the long-sleeve undershirt from the drawing.
  const stripes = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10 - i * 0.006, 0.095 - i * 0.006, 0.062, 12),
      mat(i % 2 ? 0x1c1c24 : 0xe8e2d6)
    );
    ring.position.y = -0.26 - i * 0.062;
    stripes.add(ring);
  }
  pivot.add(stripes);

  // The flipper hand itself.
  const flipper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.10, 4, 10), mat(PENGZ.feather));
  flipper.position.y = -0.60;
  pivot.add(flipper);

  pivot.traverse((o) => { o.castShadow = true; });
  pivot.userData.side = side;
  return pivot;
}

/** The pistol. Boxes and cylinders, nothing fancy. */
function createPistol() {
  const group = new THREE.Group();
  const metal = mat(PENGZ.gunmetal, { roughness: 0.42, metalness: 0.20 });
  const grip = mat(0x2a2f3a, { roughness: 0.9 });

  // Slide along the top.
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.10, 0.40), metal);
  slide.position.set(0, 0.05, 0.10);
  group.add(slide);

  // Barrel poking out the front.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 12), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.045, 0.33);
  group.add(barrel);

  // The frame under the slide.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.06, 0.26), metal);
  frame.position.set(0, -0.02, 0.05);
  group.add(frame);

  // Handle, raked back the way a pistol grip is.
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.24, 0.10), grip);
  handle.position.set(0, -0.16, -0.06);
  handle.rotation.x = -0.22;
  group.add(handle);

  // Trigger guard.
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 12, Math.PI), metal);
  guard.rotation.y = Math.PI / 2;
  guard.position.set(0, -0.075, 0.02);
  group.add(guard);

  group.traverse((o) => { o.castShadow = true; });
  group.scale.setScalar(1.05);
  return group;
}

/**
 * Build Penguini.
 *
 * Returns the whole model plus handles on the parts that move, so other files
 * can pose him without knowing how he's put together.
 */
export function createPenguini({ shades: wearShades = false } = {}) {
  const root = new THREE.Group();
  root.name = 'penguini';

  const feather = mat(PENGZ.feather, { roughness: 0.82 });

  // --- legs and sneakers ---------------------------------------------------
  const legs = new THREE.Group();
  for (const side of [-1, 1]) {
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.20, 10), mat(0x1b1e26));
    shin.position.set(side * 0.17, 0.24, 0);
    legs.add(shin);

    // Chunky sneaker: a wide box with a thick sole.
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.40), mat(0xf2f4f7));
    shoe.position.set(side * 0.17, 0.11, 0.05);
    legs.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.075, 0.415), mat(PENGZ.purple));
    sole.position.set(side * 0.17, 0.038, 0.05);
    legs.add(sole);

    // A stripe down the side instead of anyone's logo.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), mat(PENGZ.purpleDark));
    stripe.position.set(side * 0.17, 0.13, -0.02);
    legs.add(stripe);
  }
  legs.traverse((o) => { o.castShadow = true; });
  root.add(legs);

  // --- shorts --------------------------------------------------------------
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.42, 16), mat(PENGZ.shortsBlack));
  shorts.position.y = 0.50;
  shorts.castShadow = true;
  root.add(shorts);

  // --- torso, wearing the oversized tee ------------------------------------
  const torso = new THREE.Group();
  torso.position.y = 0.62;

  const teeMaterial = mat(PENGZ.tee, { roughness: 0.88 });
  teeMaterial.map = createTeeGraphic();

  // The shirt is deliberately wider at the bottom - it's three sizes too big.
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.60, 20), teeMaterial);
  tee.position.y = 0.18;
  tee.castShadow = true;
  torso.add(tee);

  // Rounded shoulders so the shirt doesn't end in a flat disc.
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 12), mat(PENGZ.tee));
  shoulders.position.y = 0.46;
  shoulders.scale.set(1, 0.62, 0.92);
  shoulders.castShadow = true;
  torso.add(shoulders);

  const armR = createArm(-1);
  armR.position.set(-0.30, 0.44, 0);
  torso.add(armR);

  const armL = createArm(1);
  armL.position.set(0.30, 0.44, 0);
  torso.add(armL);

  const chain = createChain();
  chain.position.y = 0.46;
  torso.add(chain);

  root.add(torso);

  // --- head ----------------------------------------------------------------
  // Big head, small body. That ratio is most of the cartoon.
  const head = new THREE.Group();
  head.position.y = 1.30;

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.47, 26, 20), feather);
  skull.scale.set(1, 0.98, 0.96);
  skull.castShadow = true;
  head.add(skull);

  // The white face patch penguins have.
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 18), mat(PENGZ.belly));
  face.scale.set(0.86, 0.78, 0.70);
  face.position.set(0, -0.12, 0.17);
  head.add(face);

  // Beak, in two halves so he can open his mouth and yell.
  const beakUpper = new THREE.Mesh(new THREE.ConeGeometry(0.150, 0.34, 4), mat(PENGZ.beak, { flatShading: true }));
  beakUpper.rotation.x = Math.PI / 2;
  beakUpper.rotation.z = Math.PI / 4;
  beakUpper.scale.set(1.05, 1, 0.72);   // slightly wide, still has depth
  beakUpper.position.set(0, -0.035, 0.520);
  head.add(beakUpper);

  const beakLower = new THREE.Group();          // a hinge, so it swings open
  beakLower.position.set(0, -0.095, 0.435);
  const beakLowerMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.132, 0.29, 4),
    mat(0xcf8f2c, { flatShading: true })
  );
  beakLowerMesh.rotation.x = Math.PI / 2;
  beakLowerMesh.rotation.z = Math.PI / 4;
  beakLowerMesh.scale.set(1.05, 1, 0.62);
  beakLowerMesh.position.set(0, -0.005, 0.085);
  beakLower.add(beakLowerMesh);

  // The dark inside of his mouth, visible when he's yelling.
  // The dark of his throat. It lives at the hinge, so opening the beak reveals
  // it rather than dragging a red blob down onto his chest.
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), mat(0x51202c, { roughness: 1 }));
  mouth.scale.set(1.15, 0.85, 0.75);
  mouth.position.set(0, 0.035, -0.01);
  beakLower.add(mouth);
  head.add(beakLower);

  // Eyes.
  const eyes = new THREE.Group();
  const pupils = [];
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 14), mat(0xfdfdfd, { roughness: 0.35 }));
    white.position.set(side * 0.163, 0.010, wearShades ? 0.330 : 0.375);
    white.scale.set(1, 1.0, 0.66);
    eyes.add(white);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.047, 12, 10), mat(0x101318, { roughness: 0.3 }));
    pupil.position.set(side * 0.168, -0.008, wearShades ? 0.390 : 0.432);
    eyes.add(pupil);
    pupils.push(pupil);
  }
  head.add(eyes);

  // Eyebrows. These do almost all the work of the expression.
  const brows = new THREE.Group();
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.048, 0.05), mat(0x14161d));
    brow.position.set(side * 0.170, 0.135, 0.430);
    brow.userData.side = side;
    brows.add(brow);
  }
  head.add(brows);

  // The white shades, pushed up onto the beanie. Down over the eyes they hide
  // his expression, and right now his expression is the whole point.
  const shades = new THREE.Group();
  // Very slightly see-through, so his furious eyes read as a ghost behind the
  // lenses instead of being hidden completely.
  const lensMat = mat(0xffffff, {
    roughness: 0.20,
    extra: { transparent: true, opacity: 0.93 },
  });
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.086, 16, 12), lensMat);
    lens.scale.set(1.34, 0.60, 0.30);
    lens.position.set(side * 0.142, 0, 0.325);
    shades.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.030, 0.045), lensMat);
  bridge.position.set(0, 0.002, 0.335);
  shades.add(bridge);
  shades.position.set(0, 0.055, 0.130);
  shades.rotation.x = -0.06;
  // Off by default - you can read his face without them, and the anger is the
  // point. Pass { shades: true } to createPenguini() to put them back on.
  if (wearShades) head.add(shades);

  const beanie = createBeanie();
  beanie.position.y = 0.205;
  head.add(beanie);

  const dreads = createDreads();
  dreads.position.y = 0.10;
  head.add(dreads);

  root.add(head);

  // --- the pistol ----------------------------------------------------------
  const pistol = createPistol();
  // Sits in his right flipper. Positioned relative to the arm, so when the arm
  // swings, the gun swings with it.
  // The gun has to point the same way the arm does. Without this rotation the
  // barrel aims at the sky no matter where the arm swings.
  pistol.rotation.x = Math.PI / 2;
  pistol.position.set(0, -0.72, 0.02);
  armR.add(pistol);

  return {
    root,
    parts: { head, torso, armL, armR, legs, beakLower, brows, pupils, shades, pistol, eyes },
  };
}

/**
 * Point an arm at a spot in the world.
 *
 * Guessing rotation angles by eye is a losing game - you nudge one number and
 * three others go wrong. This does the maths instead: it works out the
 * direction from his shoulder to whatever you name, and swings the arm to
 * match exactly. The gun is bolted to the arm, so the gun follows.
 */
export function aimArmAt(arm, targetWorld, roll = 0) {
  arm.updateWorldMatrix(true, false);

  const shoulder = new THREE.Vector3().setFromMatrixPosition(arm.matrixWorld);
  const direction = new THREE.Vector3().subVectors(targetWorld, shoulder).normalize();

  // Work in the shoulder's own space rather than the world's.
  const intoParent = new THREE.Matrix4().copy(arm.parent.matrixWorld).invert();
  const aim = direction.clone().transformDirection(intoParent).normalize();

  // Pointing the arm is only half the job: the arm can still spin on its own
  // axis, and a pistol rolled onto its side looks like a mistake. So we build
  // the rotation from three axes instead of one - where the arm points, AND
  // which way is up for the hand holding the gun.
  const armDown = aim.clone().negate();          // the arm's own -Y
  const worldUp = new THREE.Vector3(0, 1, 0).transformDirection(intoParent);

  let sideways = new THREE.Vector3().crossVectors(worldUp, aim);
  if (sideways.lengthSq() < 1e-6) sideways.set(1, 0, 0);   // aiming straight up
  sideways.normalize();

  const forward = new THREE.Vector3().crossVectors(sideways, armDown).normalize();

  const basis = new THREE.Matrix4().makeBasis(sideways, armDown, forward);
  arm.quaternion.setFromRotationMatrix(basis);

  // An optional twist of the wrist, in radians, for attitude.
  if (roll) arm.rotateY(roll);
}

/**
 * Pose him for the title screen: gun thrust at the camera, mid-yell.
 *
 * Everything here is an angle in radians. 0.4 is about 23 degrees. Nudge these
 * numbers and the pose changes - it's the fastest thing in the project to
 * experiment with.
 */
export function poseFurious(model) {
  const { head, armR, armL, beakLower, brows, torso } = model.parts;

  // The right arm is aimed separately with aimArmAt(), because it has to point
  // at wherever the camera actually is. See titlescreen.js.

  // Left arm flung out and back, the way you do when you're shouting.
  armL.rotation.z = 0.46;
  armL.rotation.x = -0.20;
  armL.rotation.y = -0.28;

  // Head thrust forward and cocked - leaning INTO the argument.
  head.rotation.x = 0.13;
  head.rotation.z = -0.07;
  head.position.z = 0.06;

  // Shoulders squared up and twisted behind the gun arm.
  torso.rotation.y = 0.10;

  // Mouth wide open. This is the yell.
  beakLower.rotation.x = 0.52;

  // Brows driven down hard toward the middle of his face. Anger, in one line.
  brows.children.forEach((brow) => {
    const side = brow.userData.side;
    brow.rotation.z = side * -0.60;
    brow.position.y = 0.100;
  });
}
