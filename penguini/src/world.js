// world.js - the physical world of Cold City.
//
// Right now that means the snow underfoot and the lighting. Buildings,
// streetlights and collision come next; they'll be added to this file.

import * as THREE from 'three';

// The game's palette, in one place. Every colour used anywhere in the world
// should come from here so the look stays consistent.
export const PALETTE = {
  night: 0x0a1624,      // deep navy - the base colour of everything
  snow: 0xd7e5f7,       // ice white, very slightly blue
  snowShadow: 0x7f9ac0, // the blue you see in a footprint
  pink: 0xff4d8d,       // signage, and the criminal world
  aurora: 0x3ff0c2,     // the sky, and anything hopeful
  window: 0xffd79a,     // warm light from inside, seen from the cold street
};

/**
 * A cheap repeatable bumpiness function.
 *
 * Real snow isn't a flat table. We nudge each point of the ground up and down
 * by a few centimetres using overlapping sine waves - it costs nothing and it
 * stops the ground reading as a sheet of paper.
 */
function drift(x, z) {
  return (
    Math.sin(x * 0.06) * Math.cos(z * 0.05) * 1.3 +
    Math.sin(x * 0.017 + z * 0.021) * 2.2 +
    Math.cos(z * 0.13) * 0.45 +
    Math.sin(x * 0.21 + z * 0.09) * 0.22
  );
}

/**
 * Build the ground: one big plane of snow.
 */
function createGround() {
  // 600m across, cut into a grid so we have points to push around.
  const geometry = new THREE.PlaneGeometry(600, 600, 90, 90);

  // A plane is born standing up like a wall, so lay it flat.
  geometry.rotateX(-Math.PI / 2);

  // Push every point of the grid up or down a little.
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, drift(x, z));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  // Tint each point of the ground by how high it sits: the crests of the drifts
  // catch the light and read almost white, the hollows go blue. Without this
  // the snow looks like a sheet of painted water.
  const crest = new THREE.Color(PALETTE.snow);
  const hollow = new THREE.Color(PALETTE.snowShadow);
  const colours = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i);
    // drift() returns roughly -4 to +4, so squash that into a 0-1 blend.
    const blend = THREE.MathUtils.clamp(height / 8 + 0.5, 0, 1);
    mixed.copy(hollow).lerp(crest, blend);
    colours[i * 3] = mixed.r;
    colours[i * 3 + 1] = mixed.g;
    colours[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    // flatShading gives each triangle one solid colour instead of a smooth
    // blend. That's the paper-cutout look, and it's deliberate.
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/**
 * Light the scene like a freezing clear night.
 */
function createLights(scene) {
  // Sky light: aurora green pouring down from above, navy bouncing up off the
  // ground. This one light does most of the work in selling "arctic night".
  const hemi = new THREE.HemisphereLight(0x8fd7cd, PALETTE.night, 0.30);
  scene.add(hemi);

  // The moon. Cold, pale blue, low in the sky, off to one side so everything
  // casts a long shadow.
  const moon = new THREE.DirectionalLight(0xc9dfff, 0.85);
  moon.position.set(-70, 90, 40);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 320;
  // How wide an area gets crisp shadows. Bigger = covers more, looks blurrier.
  moon.shadow.camera.left = -90;
  moon.shadow.camera.right = 90;
  moon.shadow.camera.top = 90;
  moon.shadow.camera.bottom = -90;
  moon.shadow.bias = -0.0008;
  scene.add(moon);

  // The faintest amount of fill so nothing goes pure black.
  scene.add(new THREE.AmbientLight(0x16283f, 0.14));

  return { hemi, moon };
}

/**
 * Build the whole world and add it to the scene.
 */
export function createWorld(scene) {
  // Fog in the game's own navy. It hides the edge of the ground plane and
  // makes distance feel cold. Ground fades out between 45m and 260m away.
  scene.fog = new THREE.Fog(0x101f38, 45, 250);

  const ground = createGround();
  scene.add(ground);

  const lights = createLights(scene);

  return { ground, lights, groundHeightAt: drift };
}

/**
 * The lit windows on a tower, painted with code onto a canvas.
 *
 * We make one image of a grid of windows - some lit, some dark - and hang it
 * on every tower. Because each tower is a different size, the grid stretches
 * differently on each one, so they don't look copy-pasted.
 */
function createWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark glass everywhere to start.
  ctx.fillStyle = '#0b1524';
  ctx.fillRect(0, 0, 128, 256);

  const cols = 6;
  const rows = 20;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Most windows are dark. It's the middle of the night.
      const roll = Math.random();
      if (roll > 0.42) continue;
      // Warm interiors - the lit rooms above the freezing street.
      ctx.fillStyle = roll > 0.36 ? '#ff9d5c' : '#ffd79a';
      ctx.fillRect(x * 21 + 5, y * 12.8 + 3.5, 12, 6.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Cold City's skyline.
 *
 * Two things, and the contrast between them IS the game: low domed igloos down
 * at street level, and the Meridian towers standing over them. The story bible
 * is explicit that the towers have to be visible from every street on Block 9 -
 * so they're built tall and set back, not dropped onto the block.
 */
export function createSkyline(scene) {
  const city = new THREE.Group();
  city.name = 'skyline';

  const windows = createWindowTexture();

  // --- the Meridian: bear money, forty floors of it ------------------------
  const towerSpecs = [
    { x: -46, z: -150, w: 22, d: 20, h: 96 },
    { x: -14, z: -168, w: 26, d: 22, h: 124 },  // Whitlock's, the tall one
    { x: 20, z: -152, w: 20, d: 20, h: 84 },
    { x: 48, z: -176, w: 24, d: 22, h: 104 },
    { x: -78, z: -186, w: 20, d: 20, h: 70 },
    { x: 78, z: -160, w: 18, d: 18, h: 62 },
    { x: 4, z: -206, w: 30, d: 24, h: 140 },
    { x: -40, z: -214, w: 22, d: 22, h: 88 },
  ];

  for (const spec of towerSpecs) {
    const glass = new THREE.MeshStandardMaterial({
      color: 0x0d1a2e,
      roughness: 0.35,
      metalness: 0.25,
      emissive: 0xffffff,
      emissiveMap: windows,
      emissiveIntensity: 1.5,
      map: windows,
    });

    const tower = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), glass);
    tower.position.set(spec.x, spec.h / 2, spec.z);
    city.add(tower);

    // A red aircraft light on top of the tall ones, blinking.
    if (spec.h > 90) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4d6a })
      );
      beacon.position.set(spec.x, spec.h + 1.5, spec.z);
      beacon.userData.beacon = true;
      city.add(beacon);
    }
  }

  // --- Igloo Row: where he actually lives ---------------------------------
  const iglooMat = new THREE.MeshStandardMaterial({
    color: 0xb9cde4,
    roughness: 0.97,
    flatShading: true,
  });
  const doorGlow = new THREE.MeshBasicMaterial({ color: 0xffb066 });

  for (let i = 0; i < 22; i++) {
    // Two rows of domes either side of the street, receding into the fog.
    const side = i % 2 ? 1 : -1;
    const along = -38 - Math.floor(i / 2) * 16 - (i % 2) * 7;
    const radius = 2.9 + ((i * 7) % 5) * 0.45;

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.5),
      iglooMat
    );
    dome.position.set(side * (19 + ((i * 3) % 6)), 0, along);
    dome.castShadow = true;
    dome.receiveShadow = true;
    city.add(dome);

    // The warm doorway - the only warmth at street level.
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.35), doorGlow);
    door.position.set(dome.position.x - side * radius * 0.86, 0.95, along + 0.6);
    city.add(door);
  }

  scene.add(city);
  return city;
}

/**
 * Streetlights along Block 9.
 *
 * These are real lights in the world, not decoration - they're what makes the
 * street readable at night, and they're what lights Penguini when he's stood
 * under one. The title screen deliberately uses these and nothing else, so the
 * opening shot is lit by the same lamps as the gameplay.
 */
export function createStreetlights(scene, positions) {
  const group = new THREE.Group();
  group.name = 'streetlights';

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.85 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd7a0 });

  const lights = [];

  for (const spot of positions) {
    const post = new THREE.Group();
    post.position.set(spot.x, 0, spot.z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.2, 8), poleMat);
    pole.position.y = 2.6;
    pole.castShadow = true;
    post.add(pole);

    // The arm that reaches out over the street.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(spot.face * 0.55, 5.1, 0);
    post.add(arm);

    // The glowing lamp head. MeshBasicMaterial ignores lighting, so it stays
    // bright - that's what sells it as the source rather than a lit object.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), lampMat);
    head.position.set(spot.face * 1.05, 4.98, 0);
    post.add(head);

    // The light itself: warm, and falling off fast so each lamp owns a pool of
    // snow instead of washing out the whole block.
    const bulb = new THREE.PointLight(0xffc98a, spot.intensity ?? 26, 16, 2);
    bulb.position.set(spot.face * 1.05, 4.9, 0);
    bulb.castShadow = spot.shadows ?? false;
    if (bulb.castShadow) {
      bulb.shadow.mapSize.set(1024, 1024);
      bulb.shadow.camera.far = 18;
      bulb.shadow.bias = -0.004;
    }
    post.add(bulb);
    lights.push(bulb);

    group.add(post);
  }

  scene.add(group);
  return { group, lights };
}

/**
 * The neon sign over the Krill King - hot pink, the colour this game uses for
 * the criminal world. It's a light as well as a prop, so anyone stood near it
 * picks up a pink edge for free.
 */
export function createNeonSign(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const tube = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.14, 0.10),
    new THREE.MeshBasicMaterial({ color: PALETTE.pink })
  );
  group.add(tube);

  const glow = new THREE.PointLight(PALETTE.pink, 14, 9, 2);
  glow.position.set(0, -0.2, 0.4);
  group.add(glow);

  scene.add(group);
  return { group, glow };
}
