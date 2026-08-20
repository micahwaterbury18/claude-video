// wanted.js - Heat, and what it costs you.
//
// Until now Heat was a number that went up and never did anything. Here is
// where it starts to mean something:
//
//   0-19   nobody is looking for you
//   20-39  * one star   - a seal will follow you if it sees you
//   40-59  **           - they close in, and they're faster
//   60-79  ***          - more of them, from further away
//   80+    ****         - every seal in the district
//
// Heat cools off on its own, but only while nobody has eyes on you. Standing
// in front of a cop keeps it exactly where it is.
//
// Get caught and you're busted: you lose most of your cash, all your heat, and
// you wake up outside the station on Igloo Row.

import * as THREE from 'three';

export const WANTED = {
  starAt: [20, 40, 60, 80],   // heat needed for each star
  coolPerSecond: 0.55,        // how fast it drains when nobody can see you
  seeDistance: [0, 26, 34, 44, 60],  // how far a seal can spot you, per star
  chaseSpeed: [0, 3.1, 3.8, 4.4, 5.0],
  catchDistance: 1.9,
  bustCashLoss: 0.6,          // you keep 40% of what you were carrying
  stationAt: { x: 6, z: 18 }, // where you wake up
};

function styles() {
  const style = document.createElement('style');
  style.textContent = `
    #wanted {
      position: fixed;
      top: max(58px, calc(env(safe-area-inset-top) + 58px));
      right: max(14px, env(safe-area-inset-right));
      z-index: 14;
      display: flex; gap: 4px;
      pointer-events: none;
      opacity: 0; transition: opacity .3s ease;
    }
    #wanted.on { opacity: 1; }
    #wanted .star {
      width: 22px; height: 22px;
      color: #ff6b6b;
      filter: drop-shadow(0 0 8px rgba(255,107,107,.7));
      animation: starpulse 1.1s ease-in-out infinite;
    }
    @keyframes starpulse { 0%,100% { opacity: .75; } 50% { opacity: 1; } }

    /* Red vignette that creeps in as the heat rises. */
    #heat-vignette {
      position: fixed; inset: 0; z-index: 11;
      pointer-events: none; opacity: 0;
      background: radial-gradient(ellipse at center, transparent 45%, rgba(190,30,45,.55) 100%);
      transition: opacity .6s ease;
    }

    #busted {
      position: fixed; inset: 0; z-index: 26;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(6,10,18,.92);
      opacity: 0; pointer-events: none;
      transition: opacity .5s ease;
    }
    #busted.on { opacity: 1; pointer-events: auto; }
    #busted .word {
      font-size: clamp(40px, 12vw, 96px); font-weight: 900; letter-spacing: .12em;
      color: #ff6b6b; text-shadow: 0 0 40px rgba(255,107,107,.5);
    }
    #busted .detail { margin-top: 14px; font-size: 14px; color: rgba(234,244,255,.7); }
  `;
  document.head.appendChild(style);
}

const STAR_SVG = `<svg class="star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>`;

export function createWanted(state, npcs, world) {
  styles();

  const bar = document.createElement('div');
  bar.id = 'wanted';
  document.body.appendChild(bar);

  const vignette = document.createElement('div');
  vignette.id = 'heat-vignette';
  document.body.appendChild(vignette);

  const busted = document.createElement('div');
  busted.id = 'busted';
  busted.innerHTML = '<div class="word">BUSTED</div><div class="detail"></div>';
  document.body.appendChild(busted);

  let level = 0;
  let seen = false;
  let bustedUntil = 0;
  const seals = npcs.walkers.filter((w) => w.kind === 'seal');

  function levelFor(heat) {
    let n = 0;
    for (const threshold of WANTED.starAt) if (heat >= threshold) n++;
    return n;
  }

  function drawStars(n) {
    if (n !== bar.children.length) {
      bar.innerHTML = STAR_SVG.repeat(n);
    }
    bar.classList.toggle('on', n > 0);
  }

  function bust(player) {
    const lost = Math.round(state.data.cash * WANTED.bustCashLoss);
    state.apply({ cash: -lost, heat: -state.data.heat, cred: -2 });

    busted.querySelector('.detail').textContent =
      lost > 0 ? `They took $${lost}. You keep what was in your shoe.` : 'You had nothing on you. Small mercies.';
    busted.classList.add('on');
    bustedUntil = performance.now() + 2600;

    // Put him outside the station, and send every seal back to its route.
    player.position.set(WANTED.stationAt.x, world.groundHeightAt(WANTED.stationAt.x, WANTED.stationAt.z), WANTED.stationAt.z);
    for (const s of seals) s.chasing = false;

    setTimeout(() => busted.classList.remove('on'), 2600);
  }

  return {
    get level() { return level; },
    get isBusted() { return performance.now() < bustedUntil; },
    get seen() { return seen; },
    /** Seals currently chasing, so the minimap can draw them red. */
    get chasers() { return seals.filter((s) => s.chasing); },

    update(delta, player) {
      const heat = state.data.heat;
      level = levelFor(heat);
      drawStars(level);
      vignette.style.opacity = String(Math.min(0.9, heat / 130));

      if (this.isBusted) return;

      seen = false;
      const sight = WANTED.seeDistance[level] ?? 0;
      const speed = WANTED.chaseSpeed[level] ?? 0;

      for (const seal of seals) {
        const dx = player.position.x - seal.mesh.position.x;
        const dz = player.position.z - seal.mesh.position.z;
        const distance = Math.hypot(dx, dz);

        if (level > 0 && distance < sight) {
          seal.chasing = true;
          seen = true;
        } else if (seal.chasing && distance > sight * 1.6) {
          // Lost you. Back to standing around.
          seal.chasing = false;
        }

        if (!seal.chasing) continue;

        // Walk straight at him. No pathfinding yet - they get stuck on
        // buildings, which honestly reads as fairly true to life.
        const step = (speed * delta) / (distance || 1);
        const nx = seal.mesh.position.x + dx * step;
        const nz = seal.mesh.position.z + dz * step;
        seal.mesh.position.set(nx, world.groundHeightAt(nx, nz), nz);
        seal.mesh.rotation.y = Math.atan2(dx, dz);
        seal.pauseFor = 0;

        if (distance < WANTED.catchDistance) bust(player);
      }

      // Heat only cools while nobody has eyes on you.
      if (!seen && heat > 0) {
        state.data.heat = Math.max(0, heat - WANTED.coolPerSecond * delta);
      }
    },
  };
}
