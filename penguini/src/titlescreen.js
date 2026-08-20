// titlescreen.js - the first thing anyone sees.
//
// Penguini, furious, gun shoved at the lens, Cold City burning cold behind him.
// The title and the start button are ordinary HTML sitting on top of the 3D
// canvas, which keeps the text razor sharp on every screen.

import * as THREE from 'three';
import { poseFurious, aimArmAt } from './penguini.js';
import { createStreetlights, createNeonSign } from './world.js';

// Where the camera sits for the title shot. Low and close, looking slightly
// up at him - the angle that makes someone look like a threat.
// A wide lens on purpose. Wide angle exaggerates whatever is nearest the
// camera, which is exactly what makes the pistol loom and his head sit back.
// The gameplay camera goes back to a normal 46 degrees.
export const TITLE_FOV = 64;
const TITLE_CAM = { pos: new THREE.Vector3(0.42, 1.06, 2.10), look: new THREE.Vector3(0.0, 1.38, 0) };

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
 * Deliberately lit by nothing but the street: one streetlamp and the neon sign
 * over the Krill King, both of which are real objects in the world. No special
 * title-only lighting rig. That means what you see on this screen is honestly
 * what the game looks like - if the opening shot flatters him, the game would
 * be a let-down, and that trade is never worth making.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {object} character from loadPenguini(): { root, parts, source }
 * @param {Function} onStart called when the player hits the button
 */
export function createTitleScreen(scene, camera, character, onStart) {
  const { root, parts } = character;

  // Frame whoever turned up. Aiming at his actual eyeline means dropping in a
  // model with different proportions gives a sensible shot straight away
  // instead of a picture of his chest.
  TITLE_CAM.look.y = character.eyeHeight ?? 1.38;
  TITLE_CAM.pos.y = (character.eyeHeight ?? 1.38) - 0.32;

  root.position.set(0.30, 0, 0.35);
  root.rotation.y = -0.16;
  scene.add(root);

  // The stand-in is assembled from shapes we control, so we can pose it. A
  // loaded model has its own rig and gets posed through that instead, once it
  // has one - so everything here is optional.
  if (parts) {
    poseFurious(character);

    // Aim the arm at the lens so the pistol ends up right in front of the
    // camera - that's what makes it loom.
    const aimPoint = TITLE_CAM.pos.clone().add(new THREE.Vector3(-0.72, -0.52, 0.30));
    scene.updateMatrixWorld(true);
    aimArmAt(parts.armR, aimPoint, -0.28);

    // Swing the muzzle across the frame without moving the gun: a barrel
    // pointed dead-on is a featureless rectangle, but turned side-on you read
    // the whole shape of the pistol and it still feels levelled at you.
    parts.pistol.rotation.y = 1.02;
  }

  // --- the only lighting: the street itself --------------------------------
  const lamps = createStreetlights(scene, [
    // Close, behind and to his left: the reason there's a warm edge down one
    // side of him.
    { x: -3.15, z: -2.30, face: 1, intensity: 40, shadows: true },
    // In front and to his right, out of shot. Without a lamp on this side
    // nothing lights his face and he reads as a dark shape.
    { x: 4.10, z: 2.60, face: -1, intensity: 34 },
    // Further down the block, purely for depth.
    { x: 7.5, z: -14, face: -1, intensity: 22 },
    { x: -8.5, z: -26, face: 1, intensity: 22 },
  ]);

  // The Krill King's sign, off to his right. Hot pink, so he picks up the
  // colour of the criminal world along that edge.
  // Off at the kerb, not in the middle of the road - he has to walk past this
// spot the whole game.
  const sign = createNeonSign(scene, new THREE.Vector3(6.9, 3.0, -1.1));

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
    character,
    lamps,
    sign,
    camera: TITLE_CAM,
    /** Called every frame: a slow breathing sway so the shot isn't a photo. */
    update(elapsed) {
      if (leaving) return;
      // Small numbers on purpose - any more and he looks like he's on a boat.
      root.rotation.y = -0.16 + Math.sin(elapsed * 0.9) * 0.016;
      root.position.y = Math.abs(Math.sin(elapsed * 1.8)) * 0.012;
      // The neon flickers, because it's a cheap sign on a cheap block.
      const flicker = 0.86 + 0.14 * Math.sin(elapsed * 21.0) * Math.sin(elapsed * 3.3);
      sign.glow.intensity = 14 * flicker;
    },
  };
}
