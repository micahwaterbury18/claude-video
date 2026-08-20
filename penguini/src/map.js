// map.js - the map screen, and the "you have entered" sign.
//
// The map is drawn with code onto a canvas rather than built from an image, so
// it can never disagree with the actual city: the district boxes come from the
// same DISTRICTS list the game uses to work out where you are.

import { DISTRICTS, districtAt } from './districts.js';

// The slice of the world the map shows, in metres.
const BOUNDS = { minX: -95, maxX: 130, minZ: -240, maxZ: 125 };

function styles() {
  const style = document.createElement('style');
  style.textContent = `
    #map-screen {
      position: fixed; inset: 0; z-index: 24;
      display: flex; align-items: center; justify-content: center;
      background: rgba(5, 12, 21, 0.86);
      backdrop-filter: blur(8px);
      opacity: 0; pointer-events: none;
      transition: opacity .22s ease;
    }
    #map-screen.on { opacity: 1; pointer-events: auto; }

    #map-screen .frame {
      position: relative;
      width: min(92vw, 92vh, 720px);
      aspect-ratio: 1;
      border: 1px solid rgba(63,240,194,.25);
      border-radius: 18px;
      overflow: hidden;
      background: #071120;
      box-shadow: 0 24px 80px rgba(0,0,0,.6);
    }
    #map-screen canvas { width: 100%; height: 100%; display: block; }

    #map-screen .heading {
      position: absolute; top: 16px; left: 20px;
      font-size: 13px; font-weight: 700; letter-spacing: .3em; color: #3ff0c2;
    }
    #map-screen .close {
      position: absolute; top: 12px; right: 14px;
      font: inherit; font-size: 12px; letter-spacing: .18em;
      color: #eaf4ff; background: rgba(63,240,194,.1);
      border: 1px solid rgba(63,240,194,.35); border-radius: 999px;
      padding: 9px 16px; cursor: pointer;
    }

    /* The button that opens it, sat next to the HUD. */
    #map-button {
      position: fixed;
      top: max(14px, env(safe-area-inset-top));
      left: max(14px, env(safe-area-inset-left));
      z-index: 14;
      font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .18em;
      color: #eaf4ff; background: rgba(8,18,31,.62);
      border: 1px solid rgba(255,255,255,.09); border-radius: 10px;
      padding: 9px 13px; cursor: pointer;
      opacity: 0; transition: opacity .5s ease;
    }
    #map-button.on { opacity: 1; }

    /* The district name that slides in when you cross into somewhere new. */
    #district-sign {
      position: fixed; left: 0; right: 0;
      top: 26%;
      z-index: 13;
      text-align: center;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity .5s ease, transform .5s ease;
    }
    #district-sign.on { opacity: 1; transform: none; }
    #district-sign .name {
      font-size: clamp(26px, 6vw, 46px); font-weight: 900; letter-spacing: .1em;
      color: #f4f8ff; text-shadow: 0 0 30px rgba(63,240,194,.45), 0 4px 0 rgba(130,87,229,.7);
    }
    #district-sign .sub {
      margin-top: 6px; font-size: clamp(10px, 2.4vw, 13px);
      letter-spacing: .42em; color: #3ff0c2;
    }
  `;
  document.head.appendChild(style);
}

export function createMap(state, interactions) {
  styles();

  const screen = document.createElement('div');
  screen.id = 'map-screen';
  screen.innerHTML = `
    <div class="frame">
      <canvas width="720" height="720"></canvas>
      <div class="heading">COLD CITY</div>
      <button class="close" type="button">CLOSE</button>
    </div>`;
  document.body.appendChild(screen);

  const button = document.createElement('button');
  button.id = 'map-button';
  button.type = 'button';
  button.textContent = 'MAP';
  document.body.appendChild(button);

  const sign = document.createElement('div');
  sign.id = 'district-sign';
  sign.innerHTML = '<div class="name"></div><div class="sub"></div>';
  document.body.appendChild(sign);

  const canvas = screen.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  let open = false;
  let lastDistrict = null;
  let signTimer = null;

  // World metres -> pixels on the map.
  const toX = (x) => ((x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX)) * canvas.width;
  const toY = (z) => ((z - BOUNDS.minZ) / (BOUNDS.maxZ - BOUNDS.minZ)) * canvas.height;

  function draw(player) {
    ctx.fillStyle = '#071120';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Faint grid, so distances read.
    ctx.strokeStyle = 'rgba(120,160,200,.07)';
    ctx.lineWidth = 1;
    for (let g = -240; g <= 130; g += 25) {
      ctx.beginPath(); ctx.moveTo(0, toY(g)); ctx.lineTo(canvas.width, toY(g)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(g), 0); ctx.lineTo(toX(g), canvas.height); ctx.stroke();
    }

    // Districts.
    for (const d of DISTRICTS) {
      const x = toX(d.minX), y = toY(d.minZ);
      const w = toX(d.maxX) - x, h = toY(d.maxZ) - y;

      ctx.fillStyle = d.colour + '1c';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = d.colour + '77';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = d.colour + 'dd';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.name, x + w / 2, y + 22);
      ctx.fillStyle = 'rgba(234,244,255,.35)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(d.subtitle, x + w / 2, y + 38);
    }

    // Interaction points you can go to.
    for (const point of interactions.points) {
      const px = toX(point.marker.position.x);
      const py = toY(point.marker.position.z);
      const done = state.hasPlayed(point.scene);

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = done ? 'rgba(120,150,180,.6)' : '#ffd77a';
      ctx.fill();

      ctx.fillStyle = done ? 'rgba(200,220,240,.45)' : '#ffe9b8';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(point.label, px + 10, py + 4);
    }

    // Where you are, and which way you're facing.
    if (player) {
      const px = toX(player.position.x);
      const py = toY(player.position.z);
      const facing = player.userData.facing ?? player.rotation.y;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-facing);            // canvas y is world +z, so the sign flips
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7.5, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7.5, 8);
      ctx.closePath();
      ctx.fillStyle = '#3ff0c2';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(63,240,194,.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function show(player) { open = true; screen.classList.add('on'); draw(player); }
  function hide() { open = false; screen.classList.remove('on'); }

  screen.querySelector('.close').addEventListener('click', hide);
  screen.addEventListener('click', (e) => { if (e.target === screen) hide(); });

  return {
    get isOpen() { return open; },
    showButton() { button.classList.add('on'); },
    bind(getPlayer) {
      button.addEventListener('click', () => (open ? hide() : show(getPlayer())));
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM') (open ? hide() : show(getPlayer()));
        if (e.code === 'Escape' && open) hide();
      });
    },
    /** Called every frame: redraws while open, and watches for a new district. */
    update(player) {
      if (open) draw(player);

      const here = districtAt(player.position.x, player.position.z);
      if (here?.id !== lastDistrict?.id) {
        lastDistrict = here;
        if (here) {
          sign.querySelector('.name').textContent = here.name;
          sign.querySelector('.sub').textContent = here.subtitle;
          sign.classList.add('on');
          clearTimeout(signTimer);
          signTimer = setTimeout(() => sign.classList.remove('on'), 2600);
        } else {
          sign.classList.remove('on');
        }
      }
    },
  };
}
