// main.js - the starting point. Everything begins here.
//
// Three jobs:
//   1. Set up the renderer (the thing that actually draws pixels)
//   2. Build the world
//   3. Run the game loop, which redraws the screen ~60 times a second
//
// The penguin, the city and the dialogue system all get plugged in here as we
// build them.

import * as THREE from 'three';
import { createWorld, PALETTE } from './world.js';
import { createSky } from './sky.js';

const boot = document.getElementById('boot');
const fatal = document.getElementById('fatal');

// ---------------------------------------------------------------------------
// 1. Renderer
// ---------------------------------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,      // smooth the jagged edges
    powerPreference: 'high-performance',
  });
} catch (err) {
  // Some browsers / locked-down phones just can't do 3D. Say so in English
  // rather than showing a blank screen.
  console.error(err);
  boot.remove();
  fatal.style.display = 'flex';
  throw err;
}

renderer.setSize(window.innerWidth, window.innerHeight);
// Phone screens pack in 3x the pixels. Drawing all of them murders the frame
// rate for almost no visible gain, so we cap it.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// No tone mapping on purpose: we want the flat poster colours we picked, not a
// film-camera version of them.
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(PALETTE.night);
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// 2. Scene, camera, world
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  58,                                       // field of view, in degrees
  window.innerWidth / window.innerHeight,   // aspect ratio
  0.1,                                      // nearest thing that can be seen
  2000                                      // furthest - must clear the sky dome
);

const world = createWorld(scene);

const sky = createSky();
scene.add(sky.mesh);

// ---------------------------------------------------------------------------
// 3. Placeholder camera move
// ---------------------------------------------------------------------------
// There's no penguin yet, so the camera drifts slowly around the middle of the
// block just so you can see the sky move. This whole block gets deleted the
// moment player.js exists.
const CAMERA_RADIUS = 34;
const CAMERA_HEIGHT = 7;
const CAMERA_SPEED = 0.045;   // radians per second - about 2.3 minutes a lap

function moveCameraPlaceholder(elapsed) {
  const angle = elapsed * CAMERA_SPEED;
  camera.position.set(
    Math.cos(angle) * CAMERA_RADIUS,
    CAMERA_HEIGHT + Math.sin(elapsed * 0.15) * 1.2,
    Math.sin(angle) * CAMERA_RADIUS
  );
  // Aim above the horizon so the aurora is always in frame.
  camera.lookAt(0, 9, 0);
}

// ---------------------------------------------------------------------------
// 4. Keep the canvas matching the window size
// ---------------------------------------------------------------------------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
}
window.addEventListener('resize', onResize);
// Phones fire this when you turn them sideways.
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

// ---------------------------------------------------------------------------
// 5. The game loop
// ---------------------------------------------------------------------------
// Timer tracks how much time passes between frames. It also automatically
// pauses when you switch browser tabs, so the game doesn't jump forward.
const timer = new THREE.Timer();
timer.connect(document);

function frame() {
  // Ask the browser to call us again on the next screen refresh.
  requestAnimationFrame(frame);

  // getDelta = seconds since the last frame. Everything that moves is scaled
  // by this, so the game runs at the same speed on a slow phone and a fast PC.
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.1);
  const elapsed = timer.getElapsed();

  moveCameraPlaceholder(elapsed);
  sky.update(elapsed, camera);

  renderer.render(scene, camera);

  // (delta will be used the moment anything is actually animating)
  void delta;
}

// Hide the loading text once we've drawn the first real frame.
requestAnimationFrame(() => {
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 700);
});

frame();

// Handy for poking at the game from the browser console while developing.
window.PENGUINI = { scene, camera, renderer, world, sky };
