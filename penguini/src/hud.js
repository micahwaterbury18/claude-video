// hud.js - the three numbers in the corner.
//
// Cash, Heat and Cred. Built and Took are deliberately NOT here: the player
// isn't supposed to know they're being measured.

const STATS = [
  { key: 'cash', label: 'CASH', colour: '#8ef0a8', format: (v) => `$${v}` },
  { key: 'heat', label: 'HEAT', colour: '#ff6b6b', format: (v) => `${v}` },
  { key: 'cred', label: 'CRED', colour: '#3ff0c2', format: (v) => `${v}` },
];

export function createHUD(state) {
  const style = document.createElement('style');
  style.textContent = `
    #hud {
      position: fixed;
      top: max(14px, env(safe-area-inset-top));
      right: max(14px, env(safe-area-inset-right));
      z-index: 14;
      display: flex;
      gap: 14px;
      pointer-events: none;
      opacity: 0;
      transition: opacity .5s ease;
    }
    #hud.on { opacity: 1; }

    #hud .stat {
      min-width: 62px;
      text-align: right;
      background: rgba(8, 18, 31, 0.55);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 7px 11px;
      backdrop-filter: blur(4px);
    }
    #hud .label {
      font-size: 9px;
      letter-spacing: 0.2em;
      color: rgba(234,244,255,.45);
    }
    #hud .value {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.25;
      transition: color .3s ease;
    }
    /* A quick flash when a number moves, so a choice visibly costs something. */
    #hud .stat.bumped { animation: bump .5s ease; }
    @keyframes bump {
      0%   { transform: none; }
      35%  { transform: scale(1.14); }
      100% { transform: none; }
    }

    /* Heat high enough to matter turns the whole tile red and pulses it. */
    #hud .stat.hot { border-color: rgba(255,107,107,.5); animation: hot 1.6s ease-in-out infinite; }
    @keyframes hot {
      0%,100% { box-shadow: 0 0 0 rgba(255,107,107,0); }
      50%     { box-shadow: 0 0 18px rgba(255,107,107,.45); }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'hud';
  const tiles = {};

  for (const stat of STATS) {
    const tile = document.createElement('div');
    tile.className = 'stat';
    tile.innerHTML = `<div class="label">${stat.label}</div><div class="value"></div>`;
    tile.querySelector('.value').style.color = stat.colour;
    root.appendChild(tile);
    tiles[stat.key] = { tile, value: tile.querySelector('.value') };
  }
  document.body.appendChild(root);

  state.subscribe((data, changes) => {
    for (const stat of STATS) {
      const { tile, value } = tiles[stat.key];
      value.textContent = stat.format(data[stat.key]);
      if (changes[stat.key]) {
        tile.classList.remove('bumped');
        void tile.offsetWidth;           // restart the animation
        tile.classList.add('bumped');
      }
      if (stat.key === 'heat') tile.classList.toggle('hot', data.heat >= 40);
    }
  });

  return {
    show() { root.classList.add('on'); },
    hide() { root.classList.remove('on'); },
  };
}
