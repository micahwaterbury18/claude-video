// player.js - Penguini as something you steer, plus the camera that watches him.
//
// Two decisions here shape how the whole game feels, so they're at the top
// where you can find them:
//
//   1. He has momentum. Push and he takes a moment to get going; let go and he
//      slides to a stop. Turning has a radius - he leans into it rather than
//      pivoting on the spot. A waddle needs a beat to be funny, and a penguin
//      who turns instantly reads as a robot.
//   2. The waddle is big. Full side-to-side roll, enough that walking in a
//      straight line looks like an achievement.
//
// Both are free to change: every number below is named, and none of them are
// buried in the maths.

import * as THREE from 'three';
import { resolveCollisions } from './world.js';

export const MOVEMENT = {
  walkSpeed: 2.5,        // metres per second at a gentle push
  runSpeed: 5.4,         // ...and at a full one
  acceleration: 7.0,     // how quickly he reaches that speed (per second)
  braking: 6.0,          // how quickly he stops when you let go (per second)
  turnRate: 6.5,         // radians per second - lower feels heavier
  radius: 0.55,          // how fat he is, for bumping into buildings
};

export const WADDLE = {
  roll: 0.20,            // radians of side-to-side lean, about 11 degrees
  bob: 0.055,            // how far he rises and falls, in metres
  wag: 0.09,             // a little yaw shimmy on top
  stepsPerMetre: 1.15,   // tied to distance travelled, not to time, so the
                         // waddle can never desync from how fast he's going
};

export const CAMERA = {
  distance: 5.4,
  height: 2.5,
  lookHeight: 1.35,
  followRate: 4.2,       // how fast the camera catches up to him
  swingRate: 2.2,        // how fast it swings round behind him
};

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

/**
 * Make Penguini playable.
 *
 * @param {object} character from loadPenguini()
 * @param {object} world from createWorld()
 * @param {Array} colliders from createBlock()
 */
export function createPlayer(character, world, colliders) {
  const root = character.root;
  const parts = character.parts;

  poseWalking(parts);

  // Put him in the middle of the street, facing down it - and stood ON the
  // snow, not at zero, or he's buried up to the knees during the fly-out.
  root.position.set(0, world.groundHeightAt(0, 6), 6);
  root.rotation.set(0, Math.PI, 0);

  const velocity = new THREE.Vector3();
  let facing = Math.PI;        // the direction he's actually pointing
  let cameraYaw = Math.PI;     // the direction the camera is looking from
  let stride = 0;              // how far he's walked, in "steps"
  let bodyY = world.groundHeightAt(0, 6);   // ground height under his feet

  // Reused each frame so we're not creating objects 60 times a second.
  const wanted = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  /** Where the camera wants to sit, given where he is right now. */
  function computeCameraTarget(out) {
    out.set(
      root.position.x - Math.sin(cameraYaw) * CAMERA.distance,
      bodyY + CAMERA.height,
      root.position.z - Math.cos(cameraYaw) * CAMERA.distance
    );
    // Never let it sink under the snow.
    const groundAtCamera = world.groundHeightAt(out.x, out.z);
    out.y = Math.max(out.y, groundAtCamera + 1.2);
    return out;
  }

  /** The point on him the camera should be aimed at. */
  function computeLookTarget(out) {
    return out.set(root.position.x, bodyY + CAMERA.lookHeight, root.position.z);
  }

  return {
    root,
    get position() { return root.position; },
    // The title screen's fly-in asks for both of these so it can arrive
    // exactly where gameplay starts, and hand over without a jump.
    computeCameraTarget,
    computeLookTarget,

    /**
     * @param {number} delta seconds since the last frame
     * @param {object} input from createInput().update()
     * @param {THREE.PerspectiveCamera} camera
     */
    update(delta, input, camera) {
      // --- which way is "forward"? ---------------------------------------
      // Up on the stick means away from the camera, not north. That's what
      // makes a third-person control scheme feel natural instead of like
      // steering a remote-control car that's pointed at you.
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      wanted.set(
        input.x * cos - input.y * sin,
        0,
        input.x * sin + input.y * cos
      );

      const pushing = input.strength > 0.01;
      const topSpeed = input.running ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed;

      // Easing toward a target has to account for how long the frame was, or
      // the game literally moves faster on a faster computer. Doing it through
      // exp() is the standard fix: the result is identical whether the frame
      // took 5 milliseconds or 50.
      if (pushing) {
        wanted.normalize().multiplyScalar(topSpeed * input.strength);
        velocity.lerp(wanted, 1 - Math.exp(-MOVEMENT.acceleration * delta));
      } else {
        velocity.multiplyScalar(Math.exp(-MOVEMENT.braking * delta));
        if (velocity.lengthSq() < 0.0004) velocity.set(0, 0, 0);   // settle
      }

      const speed = velocity.length();

      // --- move, then get pushed back out of anything he walked into -----
      root.position.x += velocity.x * delta;
      root.position.z += velocity.z * delta;
      resolveCollisions(root.position, MOVEMENT.radius, colliders);

      // --- turn toward where he's going ----------------------------------
      if (speed > 0.15) {
        const target = Math.atan2(velocity.x, velocity.z);
        // Take the shorter way round, so he never spins 350 degrees to turn 10.
        let difference = target - facing;
        while (difference > Math.PI) difference -= Math.PI * 2;
        while (difference < -Math.PI) difference += Math.PI * 2;
        facing += THREE.MathUtils.clamp(
          difference,
          -MOVEMENT.turnRate * delta,
          MOVEMENT.turnRate * delta
        );
      }

      // --- the waddle ------------------------------------------------------
      stride += speed * delta * WADDLE.stepsPerMetre * Math.PI;
      // Fade it out as he slows, so a standing penguin doesn't rock.
      const swing = Math.min(1, speed / MOVEMENT.walkSpeed);
      const roll = Math.sin(stride) * WADDLE.roll * swing;
      const bob = Math.abs(Math.sin(stride)) * WADDLE.bob * swing;
      const wag = Math.sin(stride) * WADDLE.wag * swing;

      // Follow the bumps in the snow instead of skating over them.
      bodyY = world.groundHeightAt(root.position.x, root.position.z);

      root.position.y = bodyY + bob;
      root.rotation.set(0, facing + wag, roll);

      // Arms swing opposite the roll. Only the stand-in has arms we can grab.
      if (parts) {
        const armSwing = Math.sin(stride) * 0.42 * swing;
        parts.armR.rotation.x = 0.12 + armSwing;
        parts.armL.rotation.x = 0.12 - armSwing;
      }

      // --- camera ----------------------------------------------------------
      // Swing round behind him as he turns, but lazily, so quick direction
      // changes don't whip the view around.
      if (speed > 0.4) {
        let difference = facing - cameraYaw;
        while (difference > Math.PI) difference -= Math.PI * 2;
        while (difference < -Math.PI) difference += Math.PI * 2;
        cameraYaw += difference * (1 - Math.exp(-CAMERA.swingRate * delta));
      }

      computeCameraTarget(cameraTarget);
      camera.position.lerp(cameraTarget, 1 - Math.exp(-CAMERA.followRate * delta));

      computeLookTarget(lookTarget);
      camera.lookAt(lookTarget);
    },
  };
}
