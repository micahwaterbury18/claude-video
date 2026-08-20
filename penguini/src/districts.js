// districts.js - the rest of Cold City.
//
// Four districts, stacked from the water up, exactly as the story bible lays
// them out:
//
//   THE DOCKS      +z, down by the water. Bera's. Cranes, containers, piers.
//   IGLOO ROW      the middle. Where he lives. Built in world.js.
//   THE BOARDWALK  +x, east. Kodi's. Fish market, arcade, Fathom's basement.
//   THE MERIDIAN   -z, north. Bear money. The towers you can see from
//                  everywhere, and the plaza at their feet.
//
// Every district returns colliders so you can't walk through it, and a
// bounding box so the map screen and the "you have entered" sign know where
// you are.

import * as THREE from 'three';
import { PALETTE } from './world.js';
import { mergeColoured } from './merge.js';

/** Districts, in the order the map screen draws them. */
export const DISTRICTS = [
  { id: 'igloo', name: 'IGLOO ROW', subtitle: 'BLOCK 9', minX: -30, maxX: 30, minZ: -105, maxZ: 26, colour: '#8fb4dd' },
  { id: 'boardwalk', name: 'THE BOARDWALK', subtitle: "KODI'S", minX: 34, maxX: 108, minZ: -46, maxZ: 40, colour: '#ff4d8d' },
  { id: 'docks', name: 'THE DOCKS', subtitle: 'BERA FAMILY', minX: -60, maxX: 34, minZ: 30, maxZ: 108, colour: '#7fd6c4' },
  { id: 'meridian', name: 'THE MERIDIAN', subtitle: 'YOU DO NOT LIVE HERE', minX: -70, maxX: 70, minZ: -230, maxZ: -106, colour: '#c9a4ff' },
];

/** Which district a point is in, or null out in the snow between them. */
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
  }
  return null;
}

const mats = {
  wall: new THREE.MeshStandardMaterial({ color: 0x27313f, roughness: 0.92, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.95, flatShading: true }),
  woodPale: new THREE.MeshStandardMaterial({ color: 0x6a5642, roughness: 0.95, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0x3b4756, roughness: 0.6, metalness: 0.25 }),
  ice: new THREE.MeshStandardMaterial({ color: 0xbdd3ea, roughness: 0.94, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: 0x0b1a2b, roughness: 0.25, metalness: 0.5 }),
};

function neon(colour, w, h) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), new THREE.MeshBasicMaterial({ color: colour }));
}

/**
 * Roads: strips of cleared, salted ground linking the districts, so the city
 * reads as connected rather than as islands floating in snow.
 */
export function createRoads(scene) {
  const roads = new THREE.Group();
  roads.name = 'roads';
  const road = new THREE.MeshStandardMaterial({ color: 0x8fa3bb, roughness: 0.99 });

  const strips = [
    { x: 0, z: -40, w: 15, d: 150, r: 0 },      // Igloo Row, north-south
    { x: 34, z: 4, w: 14, d: 74, r: Math.PI / 2 }, // east to the Boardwalk
    { x: 4, z: 52, w: 14, d: 60, r: 0 },        // south to the Docks
    { x: 0, z: -120, w: 22, d: 60, r: 0 },      // north to the Meridian
    { x: 70, z: 0, w: 13, d: 78, r: 0 },        // the Boardwalk's own strip
  ];

  for (const s of strips) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.08, s.d), road);
    mesh.position.set(s.x, 0.05, s.z);
    mesh.rotation.y = s.r;
    mesh.receiveShadow = true;
    roads.add(mesh);
  }

  scene.add(roads);
  return roads;
}

/**
 * The Boardwalk. Loud, young, and the only place in the game with a queue.
 */
export function createBoardwalk(scene) {
  const group = new THREE.Group();
  group.name = 'boardwalk';
  const colliders = [];

  // The boardwalk itself: planking raised a step above the snow.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(56, 0.35, 68), mats.wood);
  deck.position.set(70, 0.18, -2);
  deck.receiveShadow = true;
  group.add(deck);

  // Plank lines, so it doesn't read as one brown slab. All 22 are baked into a
  // single shape - they never move, so there's no reason to draw them 22 times.
  const plankGeometry = new THREE.BoxGeometry(56, 0.06, 0.5);
  const planks = [];
  for (let i = 0; i < 22; i++) {
    planks.push({ geometry: plankGeometry, colour: 0x6a5642, position: [70, 0.37, -34 + i * 3.1] });
  }
  group.add(new THREE.Mesh(mergeColoured(planks), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));

  // Fish market stalls down one side: striped awnings, crates, lamps.
  const awningColours = [0xff4d8d, 0x3ff0c2, 0xffb877, 0xf2f4f7];
  for (let i = 0; i < 7; i++) {
    const x = 50 + (i % 2) * 40;
    const z = -28 + i * 9;

    const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 3.4), mats.woodPale);
    counter.position.set(x, 0.9, z);
    counter.castShadow = true;
    group.add(counter);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 4.4),
      new THREE.MeshStandardMaterial({ color: awningColours[i % 4], roughness: 0.9 }));
    awning.position.set(x, 3.0, z);
    awning.rotation.x = 0.16;
    awning.castShadow = true;
    group.add(awning);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.9, 6), mats.metal);
      leg.position.set(x + side * 3.1, 1.5, z + 1.9);
      group.add(leg);
    }

    // Only every third stall gets a real light. Lights are the expensive part
    // of a scene, and the awnings read fine lit by their neighbour's.
    if (i % 3 === 0) {
      const lamp = new THREE.PointLight(0xffd0a0, 20, 16, 2);
      lamp.position.set(x, 2.7, z);
      group.add(lamp);
    }

    colliders.push({ x, z, r: 3.4 });
  }

  // The arcade: a squat block with a lot of light coming out of it.
  const arcade = new THREE.Mesh(new THREE.BoxGeometry(15, 7, 12), mats.wall);
  arcade.position.set(93, 3.5, 14);
  arcade.castShadow = true;
  group.add(arcade);
  colliders.push({ x: 93, z: 14, r: 9.2 });

  const arcadeSign = neon(0x3ff0c2, 10, 1.6);
  arcadeSign.position.set(93, 5.6, 8.1);
  group.add(arcadeSign);
  const arcadeGlow = new THREE.PointLight(0x3ff0c2, 30, 22, 2);
  arcadeGlow.position.set(93, 5, 6);
  group.add(arcadeGlow);

  // Fathom's place: a stairwell going down under the boardwalk, with one bulb.
  const stairwell = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x151c27, roughness: 0.95 }));
  stairwell.position.set(56, 0.7, 22);
  group.add(stairwell);
  const stairMouth = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({ color: 0x2a1c34 }));
  stairMouth.rotation.x = -Math.PI / 2;
  stairMouth.position.set(56, 1.42, 22);
  group.add(stairMouth);
  const fathomLight = new THREE.PointLight(0xb98cff, 14, 10, 2);
  fathomLight.position.set(56, 1.2, 22);
  group.add(fathomLight);
  colliders.push({ x: 56, z: 22, r: 2.9 });

  // Kodi's corner: a couple of parked snowmobiles and a lot of pink.
  for (let i = 0; i < 3; i++) {
    const sled = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 3.4),
      new THREE.MeshStandardMaterial({ color: i === 1 ? 0x8257e5 : 0x2b3446, roughness: 0.6, metalness: 0.3 }));
    body.position.y = 0.8;
    body.castShadow = true;
    sled.add(body);
    const ski = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 3.8), mats.metal);
    ski.position.y = 0.3;
    sled.add(ski);
    sled.position.set(84 + i * 3.2, 0.35, -30);
    sled.rotation.y = 0.2 + i * 0.15;
    group.add(sled);
    colliders.push({ x: 84 + i * 3.2, z: -30, r: 1.7 });
  }

  const kodiSign = neon(PALETTE.pink, 7, 1.4);
  kodiSign.position.set(88, 4.4, -36);
  group.add(kodiSign);
  const kodiGlow = new THREE.PointLight(PALETTE.pink, 26, 20, 2);
  kodiGlow.position.set(88, 3.6, -34);
  group.add(kodiGlow);

  scene.add(group);
  return { group, colliders };
}

/**
 * The Docks. The oldest money in the city, and the coldest part of it.
 */
export function createDocks(scene) {
  const group = new THREE.Group();
  group.name = 'docks';
  const colliders = [];

  // Open water past the edge of the ice.
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 120), mats.water);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-10, -0.35, 150);
  group.add(sea);

  // Piers reaching out over it.
  for (let i = 0; i < 3; i++) {
    const x = -34 + i * 30;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 42), mats.wood);
    pier.position.set(x, 0.5, 96);
    pier.receiveShadow = true;
    group.add(pier);

    for (let p = 0; p < 6; p++) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.2, 6), mats.wood);
      pile.position.set(x + (p % 2 ? 3.6 : -3.6), -0.6, 78 + p * 6.4);
      group.add(pile);
    }
  }

  // Shipping containers, stacked. Cheap way to make a place feel industrial.
  const containerColours = [0x8a4038, 0x2f5f6b, 0x6b6330, 0x3d3f56, 0x7a4a6b];
  const containerGeometry = new THREE.BoxGeometry(9.6, 3.2, 5.2);
  const containers = [];
  for (let i = 0; i < 16; i++) {
    const x = -48 + (i % 6) * 11 + ((i * 7) % 3);
    const z = 46 + Math.floor(i / 6) * 13;
    const stack = (i * 5) % 3 === 0 ? 2 : 1;
    for (let s = 0; s < stack; s++) {
      containers.push({
        geometry: containerGeometry,
        colour: containerColours[(i + s) % 5],
        position: [x, 1.6 + s * 3.25, z],
        rotation: [0, ((i * 13) % 7) * 0.02, 0],
      });
    }
    colliders.push({ x, z, r: 5.4 });
  }
  // Twenty-one containers, five colours, one draw call.
  const containerMesh = new THREE.Mesh(
    mergeColoured(containers),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })
  );
  containerMesh.castShadow = true;
  containerMesh.receiveShadow = true;
  group.add(containerMesh);

  // A crane over the whole thing.
  const crane = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 24, 2.2), mats.metal);
  tower.position.y = 12;
  tower.castShadow = true;
  crane.add(tower);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 1.6), mats.metal);
  jib.position.set(8, 23, 0);
  crane.add(jib);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 5), mats.metal);
  cable.position.set(18, 18, 0);
  crane.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mats.metal);
  hook.position.set(18, 13.2, 0);
  crane.add(hook);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4d6a }));
  beacon.position.set(0, 24.6, 0);
  crane.add(beacon);
  crane.position.set(-40, 0, 62);
  group.add(crane);
  colliders.push({ x: -40, z: 62, r: 2.4 });
  group.userData.craneBeacon = beacon;

  // Harbour floodlights, cold and unfriendly.
  for (const [x, z] of [[-20, 50], [-46, 84]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 9, 7), mats.metal);
    post.position.set(x, 4.5, z);
    post.castShadow = true;
    group.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.9), new THREE.MeshBasicMaterial({ color: 0xdfe9fa }));
    head.position.set(x, 9.1, z);
    group.add(head);
    const light = new THREE.PointLight(0xcfe0f5, 34, 26, 2);
    light.position.set(x, 8.6, z);
    group.add(light);
    colliders.push({ x, z, r: 0.7 });
  }

  scene.add(group);
  return { group, colliders };
}

/**
 * The plaza at the foot of the Meridian towers.
 *
 * Deliberately empty and over-lit. Nothing to do here, nowhere to sit, and it
 * is the cleanest ground in the game.
 */
export function createMeridianPlaza(scene) {
  const group = new THREE.Group();
  group.name = 'meridian';
  const colliders = [];

  const slab = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 60),
    new THREE.MeshStandardMaterial({ color: 0xdde7f2, roughness: 0.4 }));
  slab.position.set(0, 0.25, -130);
  slab.receiveShadow = true;
  group.add(slab);

  // Glass tower bases, so the towers meet the ground instead of hovering.
  for (const [x, z, w, d] of [[-46, -150, 22, 20], [-14, -168, 26, 22], [20, -152, 20, 20], [48, -176, 24, 22]]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 3, 7, d + 3),
      new THREE.MeshStandardMaterial({ color: 0x16202f, roughness: 0.35, metalness: 0.3 }));
    base.position.set(x, 3.5, z);
    base.castShadow = true;
    group.add(base);

    const lobby = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xdfe9fa }));
    lobby.position.set(x, 2.4, z + d / 2 + 1.7);
    group.add(lobby);

    // Only two of the four towers get a real lobby light. Three.js loops over
    // every light in the scene for every lit pixel, so the count is a budget.
    if (x < 0) {
      const lobbyLight = new THREE.PointLight(0xdfe9fa, 34, 30, 2);
      lobbyLight.position.set(x, 3, z + d / 2 + 4);
      group.add(lobbyLight);
    }

    colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
  }

  // A fountain, switched off and frozen solid.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 1.2, 20), mats.ice);
  basin.position.set(0, 0.9, -120);
  basin.castShadow = true;
  group.add(basin);
  const frozen = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 8), mats.ice);
  frozen.position.set(0, 3.2, -120);
  group.add(frozen);
  colliders.push({ x: 0, z: -120, r: 6.2 });

  scene.add(group);
  return { group, colliders };
}
