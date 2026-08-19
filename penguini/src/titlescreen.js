// titlescreen.js - the first thing anyone sees.
//
// Penguini, furious, gun shoved at the lens, Cold City burning cold behind him.
// The title and the start button are ordinary HTML sitting on top of the 3D
// canvas, which keeps the text razor sharp on every screen.

import * as THREE from 'three';
import { createPenguini, poseFurious, aimArmAt } from './penguini.js';

// Where the camera sits for the title shot. Low and close, looking slightly
// up at him - the angle that makes someone look like a threat.
// A wide lens on purpose. Wide angle exaggerates whatever is nearest the
// camera, which is exactly what makes the pistol loom and his head sit back.
// The gameplay camera goes back to a normal 46 degrees.
export const TITLE_FOV = 64;
const TITLE_CAM = { pos: new THREE.Vector3(0.42, 1.06, 2.10), look: new THREE.Vector3(0.0, 1.44, 0) };

/** Build the HTML that sits over the 3D view. */
function createOverlay() {
  const el = document.createElement('div');
  el.id = 'title-ui';
  el.innerHTML = `
    <div class="title-stack">
      <h1>PENGUINI</h1>
      <p class="sub">COLD CITY</p>
      <button id="start-btn" type="button">PRESS START</button>
      <p class="hint">a story about getting rich, and what it costs</p>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #title-ui {
      position: fixed;
      inset: 0;
      z-index: 15;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: max(30px, env(safe-area-inset-top)) 24px 0;
      pointer-events: none;              /* clicks fall through except the button */
      transition: opacity 0.75s ease;
    }
    #title-ui.leaving { opacity: 0; }

    .title-stack { text-align: center; }

    /* On a wide screen there's room to put the type beside him instead of on
       top of him. On a phone it stays centred at the bottom. */
    @media (min-width: 860px) {
      #title-ui {
        align-items: flex-start;
        justify-content: flex-start;
        padding-left: clamp(40px, 6vw, 96px);
        padding-top: clamp(40px, 7vh, 84px);
      }
      .title-stack { text-align: left; }
      #title-ui .sub { letter-spacing: 0.55em; }
    }

    #title-ui h1 {
      font-size: clamp(44px, 10.5vw, 104px);
      font-weight: 900;
      letter-spacing: 0.06em;
      line-height: 0.9;
      color: #f4f8ff;
      /* The aurora green glow ties him to the sky behind him. */
      text-shadow: 0 0 34px rgba(63, 240, 194, 0.5), 0 6px 0 rgba(130, 87, 229, 0.85);
    }

    #title-ui .sub {
      margin-top: 6px;
      font-size: clamp(12px, 3vw, 17px);
      font-weight: 600;
      letter-spacing: 0.62em;
      text-indent: 0.62em;               /* balances the last letter's spacing */
      color: #3ff0c2;
    }

    #start-btn {
      pointer-events: auto;
      margin-top: 30px;
      padding: 15px 46px;
      font: inherit;
      font-size: clamp(14px, 3.4vw, 18px);
      font-weight: 700;
      letter-spacing: 0.28em;
      text-indent: 0.28em;
      color: #0a1624;
      background: #3ff0c2;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 0 34px rgba(63, 240, 194, 0.45);
      animation: pulse 2.4s ease-in-out infinite;
      transition: transform 0.15s ease, background 0.15s ease;
    }
    #start-btn:hover { background: #ff4d8d; color: #fff; transform: scale(1.04); }
    #start-btn:active { transform: scale(0.97); }

    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 30px rgba(63, 240, 194, 0.35); }
      50%      { box-shadow: 0 0 52px rgba(63, 240, 194, 0.75); }
    }
    /* Some people get motion sick from pulsing UI. Respect their setting. */
    @media (prefers-reduced-motion: reduce) {
      #start-btn { animation: none; }
    }

    #title-ui .hint {
      margin-top: 16px;
      font-size: clamp(10px, 2.6vw, 12px);
      letter-spacing: 0.16em;
      color: rgba(234, 244, 255, 0.5);
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(el);
  return el;
}

/**
 * Set up the title screen.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {Function} onStart called when the player hits the button
 */
export function createTitleScreen(scene, camera, onStart) {
  // --- Penguini, posed and lit for his close-up ---------------------------
  const model = createPenguini();
  poseFurious(model);

  // Stand him just off-centre so the title has room, and turn him to face the
  // lens with a bit of attitude in the angle.
  model.root.position.set(0.30, 0, 0.35);
  model.root.rotation.y = -0.16;
  scene.add(model.root);

  // Aim the arm straight at the lens so the pistol ends up right in front of
  // the camera - that's what makes it loom.
  const aimPoint = TITLE_CAM.pos.clone().add(new THREE.Vector3(-0.72, -0.52, 0.30));
  scene.updateMatrixWorld(true);
  aimArmAt(model.parts.armR, aimPoint, -0.28);

  // Then swing the muzzle across the frame WITHOUT moving the gun. A barrel
  // pointed dead-on is a featureless dark rectangle; turned side-on you read
  // the whole shape of the pistol and it still feels levelled at you.
  model.parts.pistol.rotation.y = 1.02;

  // --- lighting ------------------------------------------------------------
  // Note for later: three.js checks a light's `layers` against the CAMERA, not
  // against each object, so you cannot use layers to keep a light off the
  // ground. The way to control spill is distance and position - keep the lamps
  // close to him and they fall off before they reach much snow.

  // Two rim lights in the game's accent colours, tucked in behind him. They
  // draw a bright edge down his silhouette so he doesn't sink into the sky.
  const rimGreen = new THREE.PointLight(0x3ff0c2, 6, 2.6, 2);
  rimGreen.position.set(-1.15, 2.05, -0.65);
  scene.add(rimGreen);

  const rimPink = new THREE.PointLight(0xff4d8d, 7, 2.6, 2);
  rimPink.position.set(1.45, 1.75, -0.55);
  scene.add(rimPink);

  // Cold key from camera-left: this is the light doing the actual work on his
  // face, his beak and the side of the pistol.
  const key = new THREE.SpotLight(0xf2f7ff, 34, 7.5, 0.55, 0.62, 2);
  key.position.set(-0.95, 2.25, 2.45);
  key.target = model.root;
  scene.add(key);
  scene.add(key.target);

  // A soft fill from beside the camera so his front never goes to mud.
  const fill = new THREE.PointLight(0xdfe9fa, 13, 5.5, 2);
  fill.position.set(0.75, 1.45, 2.25);
  scene.add(fill);

  camera.fov = TITLE_FOV;
  camera.updateProjectionMatrix();
  camera.position.copy(TITLE_CAM.pos);
  camera.lookAt(TITLE_CAM.look);

  const overlay = createOverlay();

  let leaving = false;

  function start() {
    if (leaving) return;
    leaving = true;
    overlay.classList.add('leaving');
    setTimeout(() => overlay.remove(), 800);
    onStart();
  }

  overlay.querySelector('#start-btn').addEventListener('click', start);
  // Any key works too, the way an arcade cabinet would.
  window.addEventListener('keydown', start, { once: true });

  return {
    model,
    lights: { rimGreen, rimPink, key, fill },
    camera: TITLE_CAM,
    /** Called every frame: a slow breathing sway so the shot isn't a photo. */
    update(elapsed) {
      if (leaving) return;
      // A slow breathing sway. Small numbers on purpose - any more and he
      // looks like he's on a boat.
      const sway = Math.sin(elapsed * 0.9) * 0.016;
      model.root.rotation.y = -0.16 + sway;
      model.root.position.y = Math.abs(Math.sin(elapsed * 1.8)) * 0.012;
      // He's too angry to hold the gun perfectly still.
      model.parts.armR.rotation.z += Math.sin(elapsed * 2.6) * 0.0016;
    },
  };
}
