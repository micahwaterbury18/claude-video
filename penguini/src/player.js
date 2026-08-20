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

// The point the camera watches. Smoothed, so it lags his bobbing slightly.
const followPoint = new THREE.Vector3();
followPoint.initialised = false;
const CAMERA_FOLLOW_RATE = 9;

export const cameraRig = {
  yaw: 0,          // which way round him the camera sits
  pitch: 0.22,     // how high above him, in radians. 0 = level with his head.
  distance: 6.4,   // how far back
  height: 1.25,    // how far up his body the camera aims
};

export const LOOK = {
  turnRate: 1.7,   // radians per second at a full push (about 97 deg/sec)
  pitchRate: 1.1,
  minPitch: 0.02,  // never drop to ground level - you'd see through the snow
  maxPitch: 1.05,  // never go directly overhead
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

export const RECENTRE = {
  rate: 2.4,          // how fast the camera drifts round behind him
  idleRate: 1.1,      // ...and when he's standing still
  // Past this angle the camera stops chasing. See the note in updateCamera:
  // this is the one number keeping him from spinning on the spot.
  holdAngle: 2.1,     // radians, about 120 degrees
  manualPause: 1.0,   // seconds to leave the camera alone after you drag it
};

let lastManualLook = -Infinity;

/** Shortest way round from a to b, in radians. */
function shortestAngle(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

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
  cameraRig.pitch = 0.22;
  followPoint.initialised = false;      // don't glide in from the last game
  player.userData.stride = 0;
  player.userData.moving = false;
}

/**
 * Where the camera sits, relative to the point it's aiming at.
 *
 * A proper orbit: always exactly `distance` away, on a sphere around him. The
 * old version added half a distance of height on top, which meant "pitch"
 * didn't mean anything you could reason about and the camera sat on the roof.
 */
function orbitOffset(out) {
  const horizontal = Math.cos(cameraRig.pitch) * cameraRig.distance;
  return out.set(
    Math.sin(cameraRig.yaw) * horizontal,
    Math.sin(cameraRig.pitch) * cameraRig.distance,
    Math.cos(cameraRig.yaw) * horizontal
  );
}

/** Where the camera wants to sit, without moving it. Used by the title fly-in. */
export function computeCameraTarget(player, out) {
  orbitOffset(_offset);
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
export function updateCamera(camera, player, controls, dt, elapsed = 0) {
  const look = controls.getLook();

  // The look stick is a PUSH, not a drag: hold it over and the camera keeps
  // turning. Multiplying by dt is what stops it spinning faster on a fast
  // phone than a slow one.
  if (look.magnitude > 0) {
    cameraRig.yaw -= look.x * LOOK.turnRate * dt;
    cameraRig.pitch = THREE.MathUtils.clamp(
      cameraRig.pitch + look.y * LOOK.pitchRate * dt,
      LOOK.minPitch,
      LOOK.maxPitch
    );
    lastManualLook = elapsed;
  }

  // --- swing round behind him -------------------------------------------
  // The camera sits at player + (sin yaw, cos yaw) * distance, so to be BEHIND
  // him the yaw wants to be his facing turned around: facing + PI.
  //
  // This is the loop that used to make him spin, so it's worth being precise
  // about why it now doesn't. The move stick is read relative to the camera,
  // so the camera moving changes what that stick means:
  //
  //   holding FORWARD -> he faces away from the camera, which is exactly where
  //                      the camera already wants to be. Stable, no drift.
  //   holding SIDEWAYS -> he turns across, the camera follows, and he curves
  //                      into a wide circle. Every third-person game does this.
  //   holding BACK    -> he turns toward the camera, the camera swings behind
  //                      him, "back" now points the other way, and he turns
  //                      again. THAT is the spin.
  //
  // Only the last runs away, and it's the only one where he ends up more than
  // about 120 degrees off the camera. Past that angle the camera stops chasing
  // and lets him walk at it, which is what you'd want to see anyway.
  const facing = player.userData.facing ?? player.rotation.y;
  const wantedYaw = facing + Math.PI;
  const difference = shortestAngle(cameraRig.yaw, wantedYaw);
  const manualRecently = elapsed - lastManualLook < RECENTRE.manualPause;

  if (!manualRecently) {
    if (player.userData.moving) {
      if (Math.abs(difference) < RECENTRE.holdAngle) {
        cameraRig.yaw += difference * (1 - Math.exp(-RECENTRE.rate * dt));
      }
    } else {
      // Standing still: nothing is being held, so nothing can feed back.
      // Settle in behind him gently, from any angle at all.
      cameraRig.yaw += difference * (1 - Math.exp(-RECENTRE.idleRate * dt));
    }
  }

  // --- place it ----------------------------------------------------------
  // Smooth the POINT the camera is watching, then put the camera on its orbit
  // around that point. Smoothing the camera's position instead is what made it
  // sail over his head: easing a position toward a target that has swung round
  // to the far side cuts a straight line across the middle - straight through
  // him - rather than going round. Here the camera is always exactly on the
  // circle, so it can only ever sweep around him.
  computeLookTarget(player, _target);

  if (!followPoint.initialised) {
    followPoint.copy(_target);
    followPoint.initialised = true;
  }
  followPoint.lerp(_target, 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt));

  orbitOffset(_offset);
  camera.position.copy(followPoint).add(_offset);
  camera.lookAt(followPoint);
}
