// main.js - the starting point. Everything begins here.
//
// Four jobs:
//   1. Set up the renderer (the thing that actually draws pixels)
//   2. Build the world
//   3. Load Penguini and open the title screen
//   4. Run the game loop, which redraws the screen ~60 times a second
//
// The dialogue system and the HUD get plugged in here as we build them.

import * as THREE from 'three';
import {
  createWorld, createSkyline, createBlock, createAlley, createSnowfall, PALETTE,
} from './world.js';
import { createSky } from './sky.js';
import { createTitleScreen, TITLE_FOV } from './titlescreen.js';
import { loadPenguini } from './character.js';
import { TouchControls } from './controls.js';
import { createState } from './state.js';
import { createDialogue } from './dialogue.js';
import { createHUD } from './hud.js';
import { createInteractions } from './interactions.js';
import {
  cameraRig, poseWalking, placePlayer, updatePlayer, updateCamera,
  computeCameraTarget, computeLookTarget,
} from './player.js';

const boot = document.getElementById('boot');
const fatal = document.getElementById('fatal');

// ---------------------------------------------------------------------------
// 1. Renderer
// ---------------------------------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch (err) {
  // Some browsers and locked-down phones just can't do 3D. Say so in English
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

const GAME_FOV = 52;

const camera = new THREE.PerspectiveCamera(
  GAME_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  2000              // must clear the sky dome
);

const world = createWorld(scene);
createSkyline(scene);
const block = createBlock(scene);
const alley = createAlley(scene);
const snow = createSnowfall(scene);

// Everything you can walk into, in one list.
const colliders = [...block.colliders, ...alley.colliders];

const sky = createSky();
scene.add(sky.mesh);

// ---------------------------------------------------------------------------
// 3. Game state
// ---------------------------------------------------------------------------
// 'title'   - the opening shot, waiting for a start
// 'leaving' - the camera flying from his face out to behind his shoulder
// 'game'    - you're driving
let mode = 'title';
let transition = 0;

let title = null;
let player = null;      // the character's Object3D, once the game starts
let controls = null;    // the input device, created when he takes over

// --- the parts that make it a game rather than a walking simulator ---------
const state = createState();
state.load();                              // pick up where you left off

const hud = createHUD(state);

const dialogue = createDialogue(state, {
  // A conversation takes the controls away, so he doesn't wander off mid-scene.
  onOpen: () => controls?.resetAll(),
  onClose: () => controls?.resetAll(),
});

// The three spots on the block you can walk up to. Adding a fourth is one
// line here plus a scene in data/scenes.json.
const interactions = createInteractions(scene, state, dialogue, [
  { scene: 'ch1_frostbite', label: 'Talk to Slick', x: -15, z: 14.5, colour: 0xff4d8d },
  { scene: 'tuck_outside', label: 'Talk to Tuck', x: -8.5, z: 6.5, colour: 0x3ff0c2 },
  { scene: 'cindy_door', label: "Cindy's door", x: 8.6, z: -10, colour: 0xffb877 },
]);

// Reused every frame rather than allocated 60 times a second.
const titlePos = new THREE.Vector3();
const titleLook = new THREE.Vector3();
const gameplayPos = new THREE.Vector3();
const gameplayLook = new THREE.Vector3();
const blendedLook = new THREE.Vector3();

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

// Total time the simulation has actually stepped, which is the sum of the
// clamped deltas rather than wall-clock. On a slow machine those differ a lot,
// and measuring speed against wall-clock makes a slow frame rate look like a
// slow character.
let simTime = 0;

function frame() {
  requestAnimationFrame(frame);

  // getDelta = seconds since the last frame. Everything that moves is scaled
  // by it, so the game runs at the same speed on a slow phone and a fast PC.
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.05);   // clamp after tab-switch stalls
  simTime += delta;
  const elapsed = timer.getElapsed();

  if (title) {
    if (mode === 'title') {
      title.update(elapsed);
    } else if (mode === 'leaving') {
      // Ask the player where the gameplay camera wants to be, then blend from
      // the title shot to there. Arriving exactly on it means the handover
      // happens without a visible jump.
      computeCameraTarget(player, gameplayPos);
      computeLookTarget(player, gameplayLook);

      transition = Math.min(transition + delta * 0.6, 1);
      const t = transition * transition * (3 - 2 * transition);   // ease

      camera.position.lerpVectors(titlePos, gameplayPos, t);
      blendedLook.lerpVectors(titleLook, gameplayLook, t);
      camera.lookAt(blendedLook);

      camera.fov = TITLE_FOV + (GAME_FOV - TITLE_FOV) * t;
      camera.updateProjectionMatrix();

      if (transition >= 1) mode = 'game';
    } else {
      // Order matters. Move him using the camera basis you could see last
      // frame, then move the camera to follow.
      // A conversation freezes him where he stands.
      if (!dialogue.isOpen) {
        updatePlayer(player, camera, controls, delta, world, colliders);
      }
      updateCamera(camera, player, controls, delta, elapsed);
      interactions.update(player.position, elapsed, world.groundHeightAt);
    }
  } else {
    // Still loading. Show the empty street rather than a black rectangle.
    camera.position.set(0, 6.5, 26);
    camera.lookAt(0, 3, 0);
  }

  sky.update(elapsed, camera);
  snow.update(delta, elapsed, camera);

  // The bulb over the alley door swings a little.
  if (alley.alley.userData.bulb) {
    alley.alley.userData.bulb.position.x = -15 + Math.sin(elapsed * 0.8) * 0.06;
  }
  // Steam rises and fades.
  for (const puff of alley.alley.userData.steam.children) {
    const t = (elapsed * 0.4 + puff.userData.offset) % 3.2;
    puff.position.y = 0.4 + t * 1.1;
    puff.material.opacity = Math.max(0, 0.07 * (1 - t / 3.2));
  }

  renderer.render(scene, camera);
}

frame();

// ---------------------------------------------------------------------------
// 6. Load Penguini, then open the title screen
// ---------------------------------------------------------------------------
loadPenguini().then((character) => {
  title = createTitleScreen(scene, camera, character, () => {
    // Remember where the title shot was, so the fly-out has somewhere to
    // start from, then hand him over to the player.
    titlePos.copy(title.camera.pos);
    titleLook.copy(title.camera.look);
    // He becomes the player: pose him for walking, stand him on the street,
    // and only now put the joystick on screen.
    player = character.root;
    player.userData.parts = character.parts;
    poseWalking(character.parts);
    placePlayer(player, world);
    controls = new TouchControls();
    hud.show();
    mode = 'leaving';
  });

  // Only clear the loading screen once he's actually on screen.
  requestAnimationFrame(() => {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 700);
  });

  // Handy for poking at the game from the browser console while developing.
  window.PENGUINI = { scene, camera, renderer, world, sky, title, character, block, cameraRig,
                      get player() { return player; },
                      get controls() { return controls; },
                      get mode() { return mode; }, get transition() { return transition; },
                      // In-game seconds. Tests measure speed against this
                      // rather than wall-clock, so a slow frame rate can't
                      // masquerade as a slow character.
                      get elapsed() { return timer.getElapsed(); },
                      get simTime() { return simTime; },
                      state, dialogue, interactions, alley };
});
