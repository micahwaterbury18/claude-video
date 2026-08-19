// sky.js - the night sky over Cold City: stars and the aurora.
//
// This is the one place in the project with GPU code (GLSL) in it. The short
// version of how it works: we put the camera inside a giant sphere and, for
// every pixel on that sphere, we run a little program that answers "what colour
// is the sky in this exact direction?" That program draws a navy gradient,
// sprinkles stars into it, and then paints the aurora on top.
//
// You don't need to understand the GLSL to change the look - the colours and
// the brightness are all set from plain JavaScript at the bottom of this file.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The GPU program, part 1: work out which direction each pixel is looking.
// ---------------------------------------------------------------------------
const vertexShader = /* glsl */ `
  varying vec3 vDir;

  void main() {
    // The sphere is centred on the camera, so a point's position on the sphere
    // IS the direction you're looking to see it.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// The GPU program, part 2: pick a colour for that direction.
// ---------------------------------------------------------------------------
const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vDir;

  uniform float uTime;      // seconds since the game started - drives movement
  uniform vec3 uHorizon;    // sky colour down at the rooftops
  uniform vec3 uZenith;     // sky colour straight up
  uniform vec3 uGreen;      // aurora green
  uniform vec3 uPink;       // hot pink, used at the tips of the curtains
  uniform float uAurora;    // overall aurora brightness (0 = off)

  // --- random numbers ------------------------------------------------------
  // Shaders have no random() function, so we fake one: scramble a coordinate
  // into a repeatable "random-looking" number between 0 and 1.
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  // --- noise ---------------------------------------------------------------
  // Smooth blobby randomness. This is what makes the aurora look like fabric
  // instead of static.
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);   // smooth the edges between cells
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Layer three sizes of noise on top of each other: big soft shapes plus
  // finer detail. Standard trick, called "fractal brownian motion".
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  // --- stars ---------------------------------------------------------------
  float starField(vec3 dir) {
    vec3 cell = dir * 320.0;
    vec3 id = floor(cell);
    vec3 f = fract(cell) - 0.5;

    float roll = hash13(id);
    float exists = step(0.9915, roll);          // only ~1 cell in 120 gets a star
    float dot_ = smoothstep(0.30, 0.0, length(f));
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + roll * 90.0);

    return exists * dot_ * twinkle;
  }

  // --- the aurora ----------------------------------------------------------
  // The aurora is drawn as four overlapping "curtains" hanging in a ring
  // around you. For each curtain we ask two questions about the direction
  // you're looking:
  //   - how far around the horizon is it?  (that picks the ribbon shape)
  //   - how high up is it?                 (that decides top, bottom, colour)
  // Feeding the ring position into the noise is what keeps the ribbons
  // vertical, and what makes the whole thing seamless when you spin around.
  vec3 aurora(vec3 dir) {
    float up = dir.y;
    if (up < 0.015) return vec3(0.0);          // nothing below the horizon

    // Your compass direction, as a point on a circle. Going all the way round
    // returns to the same place, so there's no visible seam behind you.
    vec2 ring = normalize(dir.xz + vec2(1e-5));

    vec3 total = vec3(0.0);
    const int CURTAINS = 4;

    for (int i = 0; i < CURTAINS; i++) {
      float fi = float(i);

      // Bigger K = more, narrower ribbons around the horizon.
      float k = 3.2 + fi * 2.1;
      vec2 q = ring * k;

      // Each curtain drifts at its own speed. Slow: a lap takes minutes.
      q += vec2(uTime * (0.028 + fi * 0.011), uTime * 0.019 - fi * 3.7);

      // The silhouette of this curtain: where it starts and where it ends.
      // Both edges are driven by noise so no two stretches of sky match.
      float shape = fbm(q);
      float hem = fbm(q * 0.7 + 41.0);
      float base = 0.015 + fi * 0.012 + hem * 0.07;    // ragged bottom edge
      float top = base + 0.17 + shape * 0.38;          // ragged top edge

      // Fade in over the bottom edge, out slowly toward the ragged top.
      float vertical =
        smoothstep(base, base + 0.075, up) *
        (1.0 - smoothstep(top - 0.22, top, up));

      // Break the curtain into separate ribbons with gaps between them.
      float density = smoothstep(0.32, 0.86, fbm(q * 2.4 + 17.0));

      // Fine vertical strands running down the face of each ribbon.
      float strands = 0.72 + 0.28 * noise(ring * k * 7.0);

      // Where this pixel sits inside the curtain, 0 at the bottom, 1 at the top.
      float frac = clamp((up - base) / max(top - base, 0.001), 0.0, 1.0);

      // Green through the body of the curtain, with a hot pink fringe along
      // the bottom edge - real auroras do this, and it's the game's two accent
      // colours meeting in the sky.
      float pinkness = smoothstep(0.26, 0.0, frac) * 0.95 + pow(frac, 3.0) * 0.30;
      vec3 tint = mix(uGreen, uPink, clamp(pinkness, 0.0, 1.0));

      total += tint * vertical * density * strands * (1.0 - fi * 0.16);
    }

    // Large slow-moving gaps, so parts of the sky are clear at any moment.
    float gaps = 0.25 + 0.90 * smoothstep(0.28, 0.72, fbm(ring * 1.4 + uTime * 0.012));

    return total * 0.62 * gaps * uAurora;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = max(dir.y, 0.0);

    // 1. The plain night gradient.
    vec3 colour = mix(uHorizon, uZenith, pow(up, 0.85));

    // 2. Stars, thinning out near the horizon where city glow would drown them.
    float stars = starField(dir) * smoothstep(0.02, 0.35, dir.y);
    colour += vec3(0.85, 0.92, 1.0) * stars * 0.9;

    // 3. Aurora over the top.
    colour += aurora(dir);

    // 4. A faint green wash sitting on the horizon, like light off the ice.
    colour += uGreen * 0.055 * exp(-abs(dir.y) * 10.0);

    gl_FragColor = vec4(colour, 1.0);
  }
`;

/**
 * Build the sky dome.
 *
 * Returns an object with the mesh (to add to the scene) and an update()
 * function that the game loop calls once per frame.
 */
export function createSky() {
  const uniforms = {
    uTime: { value: 0 },
    // Every colour is written as a hex code, the same format you'd use in a
    // paint program. Change these and the whole mood changes.
    uHorizon: { value: new THREE.Color(0x16294a) },
    uZenith: { value: new THREE.Color(0x070e1e) },
    uGreen: { value: new THREE.Color(0x3ff0c2) },
    uPink: { value: new THREE.Color(0xff4d8d) },
    uAurora: { value: 1.0 },
  };

  const geometry = new THREE.SphereGeometry(900, 48, 32);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    // BackSide = paint the INSIDE of the sphere, because we're standing in it.
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // it's always on screen; don't waste time checking
  mesh.renderOrder = -1; // draw it first, behind everything else
  mesh.name = 'sky';

  return {
    mesh,
    uniforms,
    /**
     * @param {number} elapsed seconds since the game started
     * @param {THREE.Camera} camera
     */
    update(elapsed, camera) {
      uniforms.uTime.value = elapsed;
      // Keep the dome pinned to the camera so you can never walk up to the sky.
      mesh.position.copy(camera.position);
    },
  };
}
