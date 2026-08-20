// missions.js - jobs, and keeping track of how far through one you are.
//
// Every mission lives in data/missions.json. This file only knows how to READ
// that: it has no idea what "the rig job" is. Adding a fourth mission means
// adding it to the data file, not coming in here.
//
// A mission is a list of objectives you finish in order. Each objective puts a
// marker in the world, a line on the HUD, and a diamond on the map.

import * as THREE from 'three';
import data from '../data/missions.json';

const MISSIONS = data.missions;

/** The glowing pillar that marks wherever you're supposed to be. */
function createObjectiveMarker() {
  const group = new THREE.Group();

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 5.5, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  column.position.y = 2.75;
  group.add(column);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.05, 30),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  group.add(ring);

  group.visible = false;
  return group;
}

function styles() {
  const style = document.createElement('style');
  style.textContent = `
    #mission-hud {
      position: fixed;
      left: max(14px, env(safe-area-inset-left));
      top: 58px;
      z-index: 14;
      max-width: min(52vw, 340px);
      pointer-events: none;
      opacity: 0;
      transform: translateX(-8px);
      transition: opacity .35s ease, transform .35s ease;
    }
    #mission-hud.on { opacity: 1; transform: none; }
    #mission-hud .title {
      font-size: 10px; font-weight: 700; letter-spacing: .24em; color: #ffd166;
    }
    #mission-hud .objective {
      margin-top: 5px; font-size: 14px; font-weight: 600; color: #eaf4ff;
      text-shadow: 0 2px 10px rgba(0,0,0,.7);
    }
    #mission-hud .count {
      margin-top: 3px; font-size: 12px; color: rgba(234,244,255,.6);
    }

    /* The big card that slides in when a mission starts or finishes. */
    #mission-card {
      position: fixed; left: 0; right: 0; top: 22%;
      z-index: 22; text-align: center; pointer-events: none;
      opacity: 0; transform: translateY(12px);
      transition: opacity .5s ease, transform .5s ease;
    }
    #mission-card.on { opacity: 1; transform: none; }
    #mission-card .kicker { font-size: 11px; letter-spacing: .4em; color: #ffd166; }
    #mission-card .name {
      margin-top: 8px; font-size: clamp(24px, 5.6vw, 42px); font-weight: 900;
      letter-spacing: .06em; color: #f4f8ff;
      text-shadow: 0 0 30px rgba(255,209,102,.45), 0 4px 0 rgba(130,87,229,.6);
    }
    #mission-card .brief {
      margin-top: 10px; font-size: clamp(12px, 2.6vw, 15px);
      color: rgba(234,244,255,.72); padding: 0 24px;
    }
  `;
  document.head.appendChild(style);
}

export function createMissions(scene, state, world) {
  styles();

  const hud = document.createElement('div');
  hud.id = 'mission-hud';
  hud.innerHTML = '<div class="title"></div><div class="objective"></div><div class="count"></div>';
  document.body.appendChild(hud);

  const card = document.createElement('div');
  card.id = 'mission-card';
  card.innerHTML = '<div class="kicker"></div><div class="name"></div><div class="brief"></div>';
  document.body.appendChild(card);

  const marker = createObjectiveMarker();
  scene.add(marker);

  // Pickups for "collect" objectives - a small floating diamond each.
  const pickupGeometry = new THREE.OctahedronGeometry(0.42);
  const pickupMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const pickups = [];

  let active = null;      // { mission, index, collected: Set }
  let cardTimer = null;

  function showCard(kicker, name, brief, hold = 3400) {
    card.querySelector('.kicker').textContent = kicker;
    card.querySelector('.name').textContent = name;
    card.querySelector('.brief').textContent = brief || '';
    card.classList.add('on');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => card.classList.remove('on'), hold);
  }

  function clearPickups() {
    for (const p of pickups) scene.remove(p);
    pickups.length = 0;
  }

  function currentObjective() {
    return active ? active.mission.objectives[active.index] : null;
  }

  /** Put the world markers where the current objective says. */
  function refreshMarkers() {
    clearPickups();
    const objective = currentObjective();
    if (!objective) { marker.visible = false; return; }

    if (objective.type === 'collect') {
      marker.visible = false;
      objective.points.forEach(([x, z], i) => {
        if (active.collected.has(i)) return;
        const pickup = new THREE.Mesh(pickupGeometry, pickupMaterial);
        pickup.position.set(x, world.groundHeightAt(x, z) + 1.1, z);
        pickup.userData.index = i;
        scene.add(pickup);
        pickups.push(pickup);
      });
    } else if (objective.x !== undefined) {
      marker.visible = true;
      marker.position.set(objective.x, world.groundHeightAt(objective.x, objective.z), objective.z);
    } else {
      // "evade" has nowhere to stand - the objective is a state, not a place.
      marker.visible = false;
    }

    updateHUD();
  }

  function updateHUD() {
    const objective = currentObjective();
    if (!objective) { hud.classList.remove('on'); return; }
    hud.classList.add('on');
    hud.querySelector('.title').textContent = active.mission.title;
    hud.querySelector('.objective').textContent = objective.label;
    hud.querySelector('.count').textContent = objective.type === 'collect'
      ? `${active.collected.size} / ${objective.points.length}`
      : `${active.index + 1} of ${active.mission.objectives.length}`;
  }

  function advance() {
    active.index += 1;
    if (active.index >= active.mission.objectives.length) return finish();
    active.collected = new Set();
    refreshMarkers();
  }

  function finish() {
    const mission = active.mission;
    state.apply(mission.rewards);
    state.markPlayed(`mission:${mission.id}`);
    active = null;
    clearPickups();
    marker.visible = false;
    hud.classList.remove('on');
    showCard('MISSION COMPLETE', mission.title, mission.outro, 5200);
  }

  function start(mission) {
    active = { mission, index: 0, collected: new Set() };
    showCard('NEW JOB', mission.title, mission.brief);
    refreshMarkers();
  }

  return {
    get active() { return active; },
    get currentObjective() { return currentObjective(); },

    /** Missions you're allowed to pick up right now. */
    available() {
      return MISSIONS.filter((m) => {
        if (state.hasPlayed(`mission:${m.id}`)) return false;
        if (active?.mission.id === m.id) return false;
        for (const [flag, wanted] of Object.entries(m.requires ?? {})) {
          if (!!state.flag(flag) !== wanted) return false;
        }
        return true;
      });
    },

    start,
    abandon() {
      if (!active) return;
      active = null;
      clearPickups();
      marker.visible = false;
      hud.classList.remove('on');
    },

    /** Called when a dialogue scene finishes, in case an objective wanted it. */
    onSceneFinished(sceneId) {
      const objective = currentObjective();
      if (objective?.type === 'talk' && objective.scene === sceneId) advance();
    },

    /**
     * Every frame. Checks whether the player has done the current objective.
     * @param {number} wantedLevel so an "evade" objective knows when it's done
     */
    update(player, elapsed, wantedLevel) {
      const objective = currentObjective();
      if (!objective) return;

      // Spin the markers so they read as game objects, not scenery.
      marker.rotation.y = elapsed * 0.6;
      for (const p of pickups) {
        p.rotation.y = elapsed * 1.8;
        p.position.y = world.groundHeightAt(p.position.x, p.position.z) + 1.1 + Math.sin(elapsed * 2.4 + p.userData.index) * 0.16;
      }

      const px = player.position.x;
      const pz = player.position.z;

      if (objective.type === 'goto') {
        if (Math.hypot(px - objective.x, pz - objective.z) <= (objective.radius ?? 5)) advance();

      } else if (objective.type === 'talk') {
        // Handled by onSceneFinished - walking there just shows the marker.

      } else if (objective.type === 'collect') {
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          if (Math.hypot(px - p.position.x, pz - p.position.z) > 2.2) continue;
          active.collected.add(p.userData.index);
          scene.remove(p);
          pickups.splice(i, 1);
          updateHUD();
        }
        if (active.collected.size >= objective.points.length) advance();

      } else if (objective.type === 'evade') {
        if (wantedLevel === 0) advance();
      }
    },
  };
}
