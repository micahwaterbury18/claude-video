// interactions.js - the glowing spots on the street you can walk up to.
//
// Each one is a marker in the world plus a scene id. Walk close and a prompt
// appears; press E, or tap the prompt on a phone, and the conversation opens.

import * as THREE from 'three';

const REACH = 3.2;          // how close you have to be, in metres

/** The glowing pillar of light that marks a spot. */
function createMarker(colour) {
  const group = new THREE.Group();

  // A soft column you can see from across the block.
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.62, 3.4, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  column.position.y = 1.7;
  group.add(column);

  // A ring on the ground, so you can tell exactly where to stand.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.80, 28),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  // A diamond bobbing above it.
  const pip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.20),
    new THREE.MeshBasicMaterial({ color: colour })
  );
  pip.position.y = 2.1;
  group.add(pip);

  group.userData.pip = pip;
  group.userData.ring = ring;
  group.userData.column = column;
  return group;
}

export function createInteractions(scene, state, dialogue, spots) {
  const style = document.createElement('style');
  style.textContent = `
    #prompt {
      position: fixed;
      left: 50%;
      bottom: max(96px, calc(env(safe-area-inset-bottom) + 96px));
      transform: translate(-50%, 10px);
      z-index: 13;
      padding: 11px 20px;
      border-radius: 999px;
      background: rgba(8, 18, 31, 0.86);
      border: 1px solid rgba(63, 240, 194, 0.45);
      color: #eaf4ff;
      font-size: 13px;
      letter-spacing: 0.12em;
      white-space: nowrap;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease, transform .18s ease;
    }
    #prompt.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
    #prompt b { color: #3ff0c2; }
  `;
  document.head.appendChild(style);

  const prompt = document.createElement('div');
  prompt.id = 'prompt';
  document.body.appendChild(prompt);

  const points = spots.map((spot) => {
    const marker = createMarker(spot.colour ?? 0x3ff0c2);
    marker.position.set(spot.x, 0, spot.z);
    marker.name = `spot:${spot.scene}`;
    scene.add(marker);
    return { ...spot, marker };
  });

  let nearest = null;

  function trigger() {
    if (!nearest || dialogue.isOpen) return;
    if (nearest.action) nearest.action();
    else dialogue.open(nearest.scene);
    prompt.classList.remove('on');
  }

  prompt.addEventListener('click', trigger);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') trigger();
  });

  return {
    points,

    /** Replace the mission-giver spots. Story spots are left alone. */
    setDynamic(spots) {
      for (let i = points.length - 1; i >= 0; i--) {
        if (!points[i].dynamic) continue;
        scene.remove(points[i].marker);
        points.splice(i, 1);
      }
      for (const spot of spots) {
        const m = createMarker(spot.colour ?? 0xffd166);
        m.position.set(spot.x, 0, spot.z);
        m.name = `spot:${spot.id ?? spot.label}`;
        scene.add(m);
        points.push({ ...spot, marker: m, dynamic: true });
      }
      nearest = null;
    },
    /** Called every frame with where the player is. */
    update(playerPosition, elapsed, groundHeightAt) {
      let closest = null;
      let closestDistance = Infinity;

      for (const point of points) {
        const dx = playerPosition.x - point.marker.position.x;
        const dz = playerPosition.z - point.marker.position.z;
        const distance = Math.hypot(dx, dz);

        // Sit the marker on the snow, and bob the diamond.
        point.marker.position.y = groundHeightAt(point.marker.position.x, point.marker.position.z);
        point.marker.userData.pip.rotation.y = elapsed * 1.1;
        point.marker.userData.pip.position.y = 2.1 + Math.sin(elapsed * 2 + point.marker.position.x) * 0.13;

        // Brighten as you approach, so it feels like it notices you.
        const closeness = THREE.MathUtils.clamp(1 - (distance - REACH) / 6, 0, 1);
        point.marker.userData.ring.material.opacity = 0.35 + closeness * 0.5;
        point.marker.userData.column.material.opacity = 0.08 + closeness * 0.14;

        if (distance < closestDistance) {
          closestDistance = distance;
          closest = point;
        }
      }

      const inReach = closest && closestDistance <= REACH ? closest : null;

      if (inReach !== nearest) {
        nearest = inReach;
        if (nearest && !dialogue.isOpen) {
          const done = nearest.scene ? state.hasPlayed(nearest.scene) : false;
          prompt.innerHTML = `<b>E</b> &nbsp;${done ? 'again — ' : ''}${nearest.label}`;
          prompt.classList.add('on');
        } else {
          prompt.classList.remove('on');
        }
      }

      if (dialogue.isOpen) prompt.classList.remove('on');
    },
    hidePrompt() { prompt.classList.remove('on'); },
  };
}
