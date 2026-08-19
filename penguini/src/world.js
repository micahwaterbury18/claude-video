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
  const hemi = new THREE.HemisphereLight(PALETTE.aurora, PALETTE.night, 0.16);
  scene.add(hemi);

  // The moon. Cold, pale blue, low in the sky, off to one side so everything
  // casts a long shadow.
  const moon = new THREE.DirectionalLight(0xc3dcff, 0.70);
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
