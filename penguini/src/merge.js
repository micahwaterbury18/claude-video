// merge.js - squash a pile of little shapes into one.
//
// Every separate mesh is a separate instruction to the graphics card, and
// phones have a budget for those. A background penguin made of seven shapes
// costs seven instructions; twenty-five of them cost a hundred and seventy
// five, which is most of a frame gone on scenery nobody looks at.
//
// The trick is that they never move relative to each other - the whole penguin
// turns as one - so they can be baked into a single shape. The only thing you
// lose is separate materials, and you get that back by painting the colour
// into the shape's own points instead.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

/**
 * @param {Array<{geometry, colour, position?, rotation?, scale?}>} parts
 * @returns {THREE.BufferGeometry} one geometry, coloured per point
 */
export function mergeColoured(parts) {
  const pieces = [];

  for (const part of parts) {
    const g = part.geometry.clone();

    _pos.fromArray(part.position ?? [0, 0, 0]);
    _euler.fromArray(part.rotation ?? [0, 0, 0]);
    _quat.setFromEuler(_euler);
    _scale.fromArray(part.scale ?? [1, 1, 1]);
    g.applyMatrix4(_matrix.compose(_pos, _quat, _scale));

    // Paint the colour onto every point of this piece.
    const colour = new THREE.Color(part.colour);
    const count = g.attributes.position.count;
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colours[i * 3] = colour.r;
      colours[i * 3 + 1] = colour.g;
      colours[i * 3 + 2] = colour.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));

    // Merging refuses to combine shapes with different attribute lists, and
    // nothing here is textured, so drop the texture coordinates.
    g.deleteAttribute('uv');
    g.deleteAttribute('uv1');

    pieces.push(g);
  }

  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  return merged;
}
