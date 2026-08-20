// npcs.js - the other penguins, and the seal cops.
//
// Cold City felt empty because nothing else in it moved. These aren't
// characters - you can't talk to them yet - they're traffic. But a street with
// six people crossing it reads as a place, and the same street with nobody on
// it reads as a diagram.
//
// Each one is deliberately cheap: seven shapes, no shadows cast, no per-frame
// allocation. There can be thirty of them on a phone without the frame rate
// noticing.

import * as THREE from 'three';
import { mergeColoured } from './merge.js';

const BODY_COLOURS = [0x1b1f28, 0x232a36, 0x2c2419, 0x1f2a2e];
const COAT_COLOURS = [0x6f7f96, 0x8a6d8f, 0x5f8377, 0x94795c, 0x4f6480];

/**
 * A background penguin, baked into ONE shape.
 *
 * Seven pieces, merged, with the colours painted into the points. That takes
 * twenty-five of them from a hundred and seventy-five draw calls to
 * twenty-five - see merge.js for why that matters.
 */
const EXTRA_GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.33, 0.5, 3, 8),
  belly: new THREE.SphereGeometry(0.26, 10, 8),
  head: new THREE.SphereGeometry(0.30, 12, 10),
  beak: new THREE.ConeGeometry(0.09, 0.22, 4),
  flipper: new THREE.CapsuleGeometry(0.07, 0.26, 2, 6),
  foot: new THREE.BoxGeometry(0.34, 0.1, 0.36),
};

const extraMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.87 });

function createExtra(rng) {
  const feather = BODY_COLOURS[Math.floor(rng() * BODY_COLOURS.length)];
  const coat = COAT_COLOURS[Math.floor(rng() * COAT_COLOURS.length)];

  const geometry = mergeColoured([
    { geometry: EXTRA_GEOMETRY.body, colour: coat, position: [0, 0.62, 0] },
    { geometry: EXTRA_GEOMETRY.belly, colour: 0xe8eef7, position: [0, 0.60, 0.18], scale: [0.8, 1.05, 0.55] },
    { geometry: EXTRA_GEOMETRY.head, colour: feather, position: [0, 1.15, 0] },
    { geometry: EXTRA_GEOMETRY.beak, colour: 0xe9a93c, position: [0, 1.10, 0.31], rotation: [Math.PI / 2, Math.PI / 4, 0] },
    { geometry: EXTRA_GEOMETRY.flipper, colour: feather, position: [-0.34, 0.62, 0] },
    { geometry: EXTRA_GEOMETRY.flipper, colour: feather, position: [0.34, 0.62, 0] },
    { geometry: EXTRA_GEOMETRY.foot, colour: 0xd08a2c, position: [0, 0.05, 0] },
  ]);

  const mesh = new THREE.Mesh(geometry, extraMaterial);
  mesh.userData.kind = 'penguin';
  return mesh;
}

/** A seal cop. Bigger, lower, unmistakable from a distance - and also one shape,
 *  except for the badge light, which has to change colour on its own. */
const SEAL_GEOMETRY = {
  body: new THREE.CapsuleGeometry(0.46, 0.9, 4, 10),
  head: new THREE.SphereGeometry(0.36, 12, 10),
  snout: new THREE.SphereGeometry(0.18, 8, 8),
  cap: new THREE.CylinderGeometry(0.30, 0.32, 0.18, 10),
  peak: new THREE.BoxGeometry(0.5, 0.05, 0.26),
};

const sealMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });

function createSeal() {
  const g = new THREE.Group();

  const geometry = mergeColoured([
    { geometry: SEAL_GEOMETRY.body, colour: 0x1c2c4a, position: [0, 0.5, 0], rotation: [0, 0, Math.PI / 2], scale: [1, 1, 0.85] },
    { geometry: SEAL_GEOMETRY.head, colour: 0x4a5568, position: [0, 0.95, 0.35], scale: [1, 0.92, 1.15] },
    { geometry: SEAL_GEOMETRY.snout, colour: 0x4a5568, position: [0, 0.86, 0.68], scale: [1, 0.7, 1.3] },
    { geometry: SEAL_GEOMETRY.cap, colour: 0x1c2c4a, position: [0, 1.22, 0.32] },
    { geometry: SEAL_GEOMETRY.peak, colour: 0x1c2c4a, position: [0, 1.14, 0.6] },
  ]);
  g.add(new THREE.Mesh(geometry, sealMaterial));

  // The badge light stays separate: it changes colour on its own, and a baked
  // shape has its colours frozen into it.
  const badge = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x6fc4ff })
  );
  badge.position.set(0.28, 0.86, 0.3);
  g.add(badge);
  g.userData.badge = badge;
  g.userData.kind = 'seal';
  return g;
}

/** Repeatable randomness, so the city looks the same every time you load it. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Populate the city.
 *
 * @param {Array<{points: number[][], kind?: string, speed?: number}>} routes
 *        each route is a loop of [x, z] the walker follows forever
 */
export function createNPCs(scene, world, routes) {
  const rng = seeded(20260820);
  const group = new THREE.Group();
  group.name = 'npcs';
  const walkers = [];

  for (const route of routes) {
    const count = route.count ?? 1;
    for (let n = 0; n < count; n++) {
      const mesh = route.kind === 'seal' ? createSeal() : createExtra(rng);
      const scale = route.kind === 'seal' ? 1 : 0.86 + rng() * 0.22;
      mesh.scale.setScalar(scale);
      group.add(mesh);

      walkers.push({
        mesh,
        points: route.points,
        // Spread them out along the route rather than stacking them at the start.
        leg: Math.floor(rng() * route.points.length),
        t: rng(),
        speed: (route.speed ?? 1.5) * (0.82 + rng() * 0.36),
        stride: rng() * Math.PI * 2,
        kind: route.kind ?? 'penguin',
        // Seals stop and stand about, because they are always on a break.
        pauseFor: 0,
        pauseChance: route.kind === 'seal' ? 0.004 : 0.0012,
      });
    }
  }

  scene.add(group);

  return {
    group,
    walkers,
    update(delta, elapsed) {
      for (const w of walkers) {
        // A seal that's chasing you is being driven by wanted.js instead, so
        // leave it alone - otherwise the route drags it back onto its beat
        // mid-pursuit.
        if (w.chasing) continue;

        const from = w.points[w.leg];
        const to = w.points[(w.leg + 1) % w.points.length];
        const dx = to[0] - from[0];
        const dz = to[1] - from[1];
        const length = Math.hypot(dx, dz) || 1;

        if (w.pauseFor > 0) {
          w.pauseFor -= delta;
        } else {
          if (Math.random() < w.pauseChance) w.pauseFor = 1.5 + Math.random() * 4;
          w.t += (w.speed * delta) / length;
          while (w.t >= 1) {
            w.t -= 1;
            w.leg = (w.leg + 1) % w.points.length;
          }
        }

        const nx = from[0] + dx * w.t;
        const nz = from[1] + dz * w.t;
        const walking = w.pauseFor <= 0;

        // Bob and roll while walking, stand still while paused.
        w.stride += walking ? delta * w.speed * 3.4 : 0;
        const bob = walking ? Math.abs(Math.sin(w.stride)) * 0.05 : 0;

        w.mesh.position.set(nx, world.groundHeightAt(nx, nz) + bob, nz);
        w.mesh.rotation.y = Math.atan2(dx, dz);
        w.mesh.rotation.z = walking ? Math.sin(w.stride) * 0.10 : 0;

        if (w.kind === 'seal' && w.mesh.userData.badge) {
          // The badge light pulses, slowly, like it isn't in a hurry either.
          const on = (Math.sin(elapsed * 2.2 + w.stride) + 1) * 0.5;
          w.mesh.userData.badge.material.color.setRGB(0.25 + on * 0.25, 0.6 + on * 0.2, 1);
        }
      }
    },
  };
}

/**
 * The routes people walk. Each is a loop; walkers go round it forever.
 * Kept out here so adding a new one is a couple of lines, not a code change.
 */
export const ROUTES = [
  // Igloo Row: neighbours going up and down their own street.
  { points: [[-5, 14], [-5, -60], [5, -60], [5, 14]], count: 3, speed: 1.3 },
  { points: [[-12, -20], [-12, -70], [11, -70], [11, -20]], count: 2, speed: 1.1 },

  // The road east, and the Boardwalk itself.
  { points: [[8, 4], [46, 4], [70, -6], [70, -30], [46, 4]], count: 3, speed: 1.6 },
  { points: [[52, -30], [52, 28], [88, 28], [88, -30]], count: 4, speed: 1.4 },
  { points: [[76, 12], [96, 12], [96, -18], [76, -18]], count: 3, speed: 1.7 },

  // The Docks: dockhands going between the containers.
  { points: [[-30, 46], [-30, 88], [10, 88], [10, 46]], count: 3, speed: 1.2 },

  // The Meridian plaza: people who work here, crossing quickly.
  { points: [[-28, -118], [28, -118], [28, -140], [-28, -140]], count: 3, speed: 1.9 },

  // Seal cops on patrol. Two pairs, one on the Row and one on the Boardwalk.
  { points: [[-8, 10], [-8, -46], [8, -46], [8, 10]], count: 2, kind: 'seal', speed: 0.9 },
  { points: [[44, 0], [96, 0], [96, 24], [44, 24]], count: 2, kind: 'seal', speed: 0.85 },
];
