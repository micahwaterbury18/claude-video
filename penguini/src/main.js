// main.js - the starting point. Everything begins here.
//
// Three jobs:
//   1. Set up the renderer (the thing that actually draws pixels)
//   2. Build the world and the title screen
//   3. Run the game loop, which redraws the screen ~60 times a second
//
// The penguin's movement, the dialogue system and the HUD all get plugged in
// here as we build them.

import * as THREE from 'three';
import { createWorld, createSkyline, PALETTE } from './world.js';
import { createSky } from './sky.js';
import { createTitleScreen, TITLE_FOV } from './titlescreen.js';

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

const GAME_FOV = 46;

const camera = new THREE.PerspectiveCamera(
  GAME_FOV,                                 // field of view, in degrees
  window.innerWidth / window.innerHeight,   // aspect ratio
  0.1,                                      // nearest thing that can be seen
  2000                                      // furthest - must clear the sky dome
);

const world = createWorld(scene);
createSkyline(scene);

const sky = createSky();
scene.add(sky.mesh);

// ---------------------------------------------------------------------------
// 3. Title screen
// ---------------------------------------------------------------------------
// The game opens on Penguini's face. Pressing start swings the camera away
// from him and out into the street.
let mode = 'title';
let transition = 0;

const title = createTitleScreen(scene, camera, () => {
  mode = 'leaving';
});

// Where the camera ends up once the game starts. This is a placeholder until
// the third-person camera exists - it just drifts around the block.
const GAME_CAM = { radius: 30, height: 6.5, speed: 0.045 };

function gameCameraPosition(elapsed, out) {
  const angle = elapsed * GAME_CAM.speed;
  return out.set(
    Math.cos(angle) * GAME_CAM.radius,
    GAME_CAM.height + Math.sin(elapsed * 0.15) * 1.2,
    Math.sin(angle) * GAME_CAM.radius
  );
}

const scratchPos = new THREE.Vector3();
const scratchLook = new THREE.Vector3();

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

  if (mode === 'title') {
    title.update(elapsed);
  } else {
    // Swing out from his face to the street over about two and a half seconds.
    if (mode === 'leaving') {
      transition = Math.min(transition + delta * 0.4, 1);
      if (transition >= 1) mode = 'game';
    }

    // Ease the movement so it glides instead of snapping.
    const t = transition * transition * (3 - 2 * transition);

    gameCameraPosition(elapsed, scratchPos);
    camera.position.lerpVectors(title.camera.pos, scratchPos, t);

    scratchLook.lerpVectors(title.camera.look, new THREE.Vector3(0, 5.5, 0), t);
    camera.lookAt(scratchLook);

    // Ease the wide title lens back to the normal gameplay one.
    camera.fov = TITLE_FOV + (GAME_FOV - TITLE_FOV) * t;
    camera.updateProjectionMatrix();

    // Fade the title lighting out as we pull away from him.
    title.lights.rimGreen.intensity = 6 * (1 - t);
    title.lights.rimPink.intensity = 7 * (1 - t);
    title.lights.key.intensity = 34 * (1 - t);
    title.lights.fill.intensity = 13 * (1 - t);
  }

  sky.update(elapsed, camera);
  renderer.render(scene, camera);
}

// Hide the loading text once we've drawn the first real frame.
requestAnimationFrame(() => {
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 700);
});

frame();

// Handy for poking at the game from the browser console while developing.
window.PENGUINI = { scene, camera, renderer, world, sky, title };
