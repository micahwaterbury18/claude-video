// minimap.js - the little round map in the corner.
//
// Drawn from the same data the game runs on: the collider list is the
// buildings, the NPC list is the people, the mission's objective is the
// waypoint. Nothing here is a separate copy that can drift out of date.
//
// It rotates with you, GTA-style, so up on the minimap is always the way
// you're facing.

const RADIUS = 74;        // pixels
const RANGE = 46;         // how many metres across the edge of it is

export function createMinimap(colliders, npcs, missions, wanted, interactions) {
  const style = document.createElement('style');
  style.textContent = `
    #minimap {
      position: fixed;
      left: max(14px, env(safe-area-inset-left));
      bottom: max(14px, env(safe-area-inset-bottom));
      z-index: 12;
      width: ${RADIUS * 2}px; height: ${RADIUS * 2}px;
      border-radius: 50%;
      border: 2px solid rgba(207,232,245,.22);
      background: rgba(6,14,25,.72);
      overflow: hidden;
      pointer-events: none;
      opacity: 0; transition: opacity .5s ease;
      box-shadow: 0 8px 30px rgba(0,0,0,.5);
    }
    #minimap.on { opacity: 1; }
    #minimap.hot { border-color: rgba(255,107,107,.65); }
    #minimap canvas { width: 100%; height: 100%; display: block; }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'minimap';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RADIUS * 2;
  root.appendChild(canvas);
  document.body.appendChild(root);

  const ctx = canvas.getContext('2d');
  const C = RADIUS;
  const scale = RADIUS / RANGE;

  return {
    show() { root.classList.add('on'); },

    update(player) {
      const px = player.position.x;
      const pz = player.position.z;
      const facing = player.userData.facing ?? player.rotation.y;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(9,20,34,.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(C, C);
      // Rotate the WORLD so that the way he's facing points up the screen.
      ctx.rotate(facing);

      // Buildings: only the ones near enough to be on the dial.
      ctx.fillStyle = 'rgba(150,180,210,.30)';
      for (const c of colliders) {
        const dx = c.x - px;
        const dz = c.z - pz;
        if (Math.abs(dx) > RANGE + c.r || Math.abs(dz) > RANGE + c.r) continue;
        ctx.beginPath();
        // Canvas y grows downward and world z grows "into" the screen, so the
        // z term is negated to keep the map the right way round.
        ctx.arc(dx * scale, -dz * scale, Math.max(2, c.r * scale), 0, Math.PI * 2);
        ctx.fill();
      }

      // People.
      for (const w of npcs.walkers) {
        const dx = w.mesh.position.x - px;
        const dz = w.mesh.position.z - pz;
        if (Math.abs(dx) > RANGE || Math.abs(dz) > RANGE) continue;
        const chasing = w.chasing;
        ctx.fillStyle = w.kind === 'seal'
          ? (chasing ? '#ff5d5d' : '#6fc4ff')
          : 'rgba(220,235,250,.5)';
        ctx.beginPath();
        ctx.arc(dx * scale, -dz * scale, w.kind === 'seal' ? 3.4 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Places you can talk to somebody.
      for (const point of interactions.points) {
        const dx = point.marker.position.x - px;
        const dz = point.marker.position.z - pz;
        if (Math.abs(dx) > RANGE || Math.abs(dz) > RANGE) continue;
        ctx.fillStyle = '#ffd77a';
        ctx.beginPath();
        ctx.arc(dx * scale, -dz * scale, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // The current objective, and an arrow at the rim if it's off the dial.
      const objective = missions.currentObjective;
      const target = objective?.type === 'collect'
        ? objective.points.find((_, i) => !missions.active.collected.has(i))
        : (objective && objective.x !== undefined ? [objective.x, objective.z] : null);

      if (target) {
        const dx = target[0] - px;
        const dz = target[1] - pz;
        const distance = Math.hypot(dx, dz);
        ctx.fillStyle = '#ffd166';

        if (distance < RANGE) {
          ctx.beginPath();
          ctx.arc(dx * scale, -dz * scale, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Pin it to the edge, pointing the way.
          const k = (RADIUS - 9) / (distance * scale);
          ctx.beginPath();
          ctx.arc(dx * scale * k, -dz * scale * k, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // You, always dead centre, always pointing up.
      ctx.save();
      ctx.translate(C, C);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5.5, 6);
      ctx.closePath();
      ctx.fillStyle = '#3ff0c2';
      ctx.fill();
      ctx.restore();

      root.classList.toggle('hot', wanted.level > 0);
    },
  };
}
