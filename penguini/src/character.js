// character.js - gets Penguini into the game, however he was made.
//
// There are two possible Penguinis:
//
//   1. A real 3D model file (penguini.glb), sculpted or generated properly.
//      This is the one we want. Drop the file into public/models/ and the game
//      picks it up automatically - no code changes.
//   2. The stand-in built out of spheres and cylinders in penguini.js, used
//      only when no model file is present, so the game always runs.
//
// Everything downstream - the title screen, walking, the camera - talks to
// whichever one loaded through the same handful of properties, so swapping the
// model in changes how he LOOKS and nothing else.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPenguini } from './penguini.js';

// Where the game looks for the model. `public/` files are copied to the site
// as-is, so this path works locally and once deployed.
const MODEL_URL = `${import.meta.env.BASE_URL}models/penguini.glb`;

// How tall he should be in the game, in metres. The character sheet says 5'2",
// which is 1.57m - but he's a cartoon with a huge head, so we go a little
// shorter and let the head do the talking. Whatever scale the model file
// arrives at, we rescale it to this.
export const PENGUINI_HEIGHT = 1.55;

/**
 * Scale and centre a loaded model so it stands on the ground at the right
 * height, no matter what units or origin the tool that made it used.
 *
 * Generated models come out at wildly different sizes - some 1 unit tall, some
 * 100. This measures the thing and fixes it rather than trusting the file.
 */
function normalise(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.y > 0) {
    object.scale.multiplyScalar(PENGUINI_HEIGHT / size.y);
  }

  // Re-measure after scaling, then drop him so his feet touch y = 0 and he's
  // centred left-to-right on his own origin.
  const scaled = new THREE.Box3().setFromObject(object);
  const centre = new THREE.Vector3();
  scaled.getCenter(centre);
  object.position.x -= centre.x;
  object.position.z -= centre.z;
  object.position.y -= scaled.min.y;

  return { size, scaled };
}

/**
 * Load Penguini.
 *
 * Always resolves - if the model is missing or broken, you get the stand-in
 * and a clear message in the browser console rather than a blank screen.
 *
 * @returns {Promise<{root: THREE.Object3D, parts: object|null, source: string,
 *                    animations: THREE.AnimationClip[]}>}
 */
export async function loadPenguini() {
  try {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    const root = gltf.scene;
    root.name = 'penguini';

    // Everything in the city casts and receives shadow, including him.
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      // Generated models often ship with materials set to render both sides,
      // which doubles the work for no gain on a solid character.
      if (o.material && o.material.side === THREE.DoubleSide) {
        o.material.side = THREE.FrontSide;
      }
    });

    const { size } = normalise(root);

    // Worth knowing when a generated model turns up too heavy for a phone.
    let triangles = 0;
    root.traverse((o) => {
      if (o.isMesh && o.geometry.index) triangles += o.geometry.index.count / 3;
      else if (o.isMesh) triangles += o.geometry.attributes.position.count / 3;
    });

    const skinned = [];
    root.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });

    console.info(
      `[penguini] loaded model: ${Math.round(triangles).toLocaleString()} triangles, ` +
      `${gltf.animations.length} animation(s), ` +
      `${skinned.length ? 'rigged' : 'NOT rigged - he cannot be animated yet'}, ` +
      `original height ${size.y.toFixed(2)} units`
    );

    return {
      root,
      parts: null,
      source: 'model',
      animations: gltf.animations,
      height: PENGUINI_HEIGHT,
      // Roughly where his eyes are. Used to frame the title shot, so a model
      // with different proportions still gets pointed at rather than
      // decapitated by a hard-coded number.
      eyeHeight: PENGUINI_HEIGHT * 0.84,
    };
  } catch (err) {
    // A missing file is the normal case until the model exists, so this is
    // information, not a crash.
    console.info(
      `[penguini] no model at ${MODEL_URL} - using the built-from-shapes ` +
      `stand-in. Drop a .glb there to replace him.`,
      err.message
    );

    const model = createPenguini();
    return {
      root: model.root,
      parts: model.parts,
      source: 'primitives',
      animations: [],
      height: PENGUINI_HEIGHT,
      eyeHeight: 1.38,
    };
  }
}
