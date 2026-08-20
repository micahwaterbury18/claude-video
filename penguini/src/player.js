// player.js - moving Penguini, and the camera that watches him.
//
// The one rule that keeps this working:
//
//   cameraRig.yaw is written ONLY by drag input.
//
// Never set it from the player's facing, and never set the player's facing
// straight from it. The stick is read relative to the camera, so if the camera
// also chased the player's facing the two would feed each other and he'd spin
// on the spot. They are deliberately separate.
//
// The direction the stick means is taken from the camera itself, via
// getWorldDirection, rather than rebuilt from an angle with sines and cosines.
// That's not a style preference: a hand-written version of that formula is how
// "up" ended up walking him backwards, and the version below cannot get the
// sign wrong because it asks the camera where it is actually looking.

import * as THREE from 'three';
import { resolveCollisions } from './world.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _target = new THREE.Vector3();

export const cameraRig = {
  yaw: 0,            // radians - ONLY drag input writes this
  pitch: 0.25,
  distance: 7,
  height: 1.6,
};

export const MOVEMENT = {
  speed: 4.5,           // metres per second at a full push
  turnSharpness: 12,    // higher = he snaps round faster
  radius: 0.55,         // how fat he is, for bumping into buildings
};

export const WADDLE = {
  roll: 0.20,           // radians of side-to-side lean, about 11 degrees
  bob: 0.055,           // how far he rises and falls, in metres
  wag: 0.09,            // a little yaw shimmy on top
  stepsPerMetre: 1.15,  // tied to distance walked, not to time, so the waddle
                        // can never desync from how fast he's going
};

const LOOK_SENSITIVITY = 0.005;

/**
 * Reset his arms out of the title-screen pose into something he can walk in.
 * Only applies to the stand-in; a real model gets posed through its own rig.
 */
export function poseWalking(parts) {
  if (!parts) return;
  parts.armR.rotation.set(0.12, 0, -0.26);
  parts.armL.rotation.set(0.12, 0, 0.26);
  parts.head.rotation.set(0, 0, 0);
  parts.head.position.z = 0;
  parts.torso.rotation.y = 0;
  parts.beakLower.rotation.x = 0.06;
  parts.brows.children.forEach((brow) => {
    brow.rotation.z = brow.userData.side * -0.16;
    brow.position.y = 0.166;
    brow.position.x = brow.userData.side * 0.118;
  });
  // He isn't waving a gun around while walking down his own street.
  if (parts.pistol) parts.pistol.visible = false;
}

/** Put him on the street, facing down it, with the camera behind him. */
export function placePlayer(player, world) {
  player.position.set(0, world.groundHeightAt(0, 6), 6);
  player.rotation.set(0, Math.PI, 0);   // he faces -z, down the block
  cameraRig.yaw = 0;                    // so the camera sits on the +z side
  player.userData.stride = 0;
  player.userData.moving = false;
}

/** Where the camera wants to sit, without moving it. Used by the title fly-in. */
export function computeCameraTarget(player, out) {
  const cp = Math.cos(cameraRig.pitch);
  _offset.set(
    Math.sin(cameraRig.yaw) * cp,
    Math.sin(cameraRig.pitch) + 0.5,
    Math.cos(cameraRig.yaw) * cp
  ).multiplyScalar(cameraRig.distance);
  return out.copy(player.position).setY(player.position.y + cameraRig.height).add(_offset);
}

/** The point on him the camera aims at. */
export function computeLookTarget(player, out) {
  return out.copy(player.position).setY(player.position.y + cameraRig.height);
}

/**
 * Move him. Call this BEFORE updateCamera, so he moves using the basis you
 * could actually see last frame.
 */
export function updatePlayer(player, camera, controls, dt, world, colliders) {
  const input = controls.getMove();

  // The camera's own axes, flattened onto the ground.
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) return;   // camera pointing straight down
  _fwd.normalize();
  _right.crossVectors(_fwd, WORLD_UP).normalize();

  _dir.set(0, 0, 0)
    .addScaledVector(_right, input.x)
    .addScaledVector(_fwd, input.y);

  const moving = _dir.lengthSq() > 1e-6;
  player.userData.moving = moving;

  if (moving) {
    // Normalising before scaling by magnitude is what stops diagonals being
    // 1.4x faster than straight lines.
    _dir.normalize();
    player.position.addScaledVector(_dir, MOVEMENT.speed * input.magnitude * dt);
    resolveCollisions(player.position, MOVEMENT.radius, colliders);
  }

  // --- facing ------------------------------------------------------------
  // Written from the direction he's travelling. Never from the camera.
  let facing = player.userData.facing ?? player.rotation.y;
  if (moving) {
    const targetYaw = Math.atan2(_dir.x, _dir.z);
    let difference = targetYaw - facing;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    facing += difference * Math.min(1, MOVEMENT.turnSharpness * dt);
  }
  player.userData.facing = facing;

  // --- the waddle --------------------------------------------------------
  const speed = moving ? MOVEMENT.speed * input.magnitude : 0;
  player.userData.stride = (player.userData.stride ?? 0)
    + speed * dt * WADDLE.stepsPerMetre * Math.PI;
  const stride = player.userData.stride;

  // Fade it out as he slows, so a standing penguin doesn't rock.
  const swing = Math.min(1, speed / MOVEMENT.speed);
  const roll = Math.sin(stride) * WADDLE.roll * swing;
  const bob = Math.abs(Math.sin(stride)) * WADDLE.bob * swing;
  const wag = Math.sin(stride) * WADDLE.wag * swing;

  // Follow the bumps in the snow instead of skating over them.
  const ground = world.groundHeightAt(player.position.x, player.position.z);
  player.position.y = ground + bob;
  player.rotation.set(0, facing + wag, roll);

  // Arms swing opposite the roll. Only the stand-in has arms we can grab.
  const parts = player.userData.parts;
  if (parts) {
    const armSwing = Math.sin(stride) * 0.42 * swing;
    parts.armR.rotation.x = 0.12 + armSwing;
    parts.armL.rotation.x = 0.12 - armSwing;
  }
}

/** Move the camera to follow him. Call this AFTER updatePlayer. */
export function updateCamera(camera, player, controls, dt) {
  const look = controls.consumeLook();
  cameraRig.yaw -= look.dx * LOOK_SENSITIVITY;
  cameraRig.pitch = THREE.MathUtils.clamp(
    cameraRig.pitch - look.dy * LOOK_SENSITIVITY,
    -0.2,
    0.9
  );

  computeLookTarget(player, _target);
  computeCameraTarget(player, _offset);

  // Frame-rate independent easing: the same result whether a frame took 5
  // milliseconds or 50.
  camera.position.lerp(_offset, 1 - Math.pow(0.001, dt));
  camera.lookAt(_target);
}
