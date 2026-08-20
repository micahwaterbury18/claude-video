// input.js - how the player tells Penguini where to go.
//
// One control, three ways to use it:
//
//   - Phone: press anywhere and drag. A joystick appears under your thumb,
//     wherever you put it, and follows your drag.
//   - Computer: click and drag. Identical behaviour, same code.
//   - Computer: WASD or the arrow keys, if you'd rather.
//
// Touch and mouse go down the same path because browsers report both as
// "pointer" events. That means there is no separate mobile code to keep in
// sync - a fix for one is a fix for both.
//
// Everything above produces the same three numbers, which is all the rest of
// the game ever sees:
//
//   x, y      which way you're pushing, from -1 to 1
//   strength  how hard, from 0 (nothing) to 1 (flat out)

const STICK_RADIUS = 62;    // how far from the centre the knob can travel, in pixels
const DEAD_ZONE = 6;        // ignore tiny drags, so a tap isn't a twitch of movement
const RUN_THRESHOLD = 0.72; // push past this much of the way and he runs

/** Build the joystick's on-screen ring and knob. */
function createStickElements() {
  const base = document.createElement('div');
  base.id = 'stick-base';

  const knob = document.createElement('div');
  knob.id = 'stick-knob';
  base.appendChild(knob);

  const style = document.createElement('style');
  style.textContent = `
    #stick-base {
      position: fixed;
      z-index: 12;
      width: ${STICK_RADIUS * 2}px;
      height: ${STICK_RADIUS * 2}px;
      margin-left: -${STICK_RADIUS}px;
      margin-top: -${STICK_RADIUS}px;
      border-radius: 50%;
      border: 2px solid rgba(63, 240, 194, 0.45);
      background: rgba(10, 22, 36, 0.30);
      pointer-events: none;              /* never eats a click */
      opacity: 0;
      transition: opacity 0.18s ease;
      backdrop-filter: blur(2px);
    }
    #stick-base.on { opacity: 1; }

    #stick-knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 54px;
      height: 54px;
      margin-left: -27px;
      margin-top: -27px;
      border-radius: 50%;
      background: rgba(63, 240, 194, 0.82);
      box-shadow: 0 0 22px rgba(63, 240, 194, 0.55);
    }

    /* A one-time hint, faded out after the player first moves. */
    #move-hint {
      position: fixed;
      left: 0; right: 0;
      bottom: max(30px, env(safe-area-inset-bottom));
      z-index: 12;
      text-align: center;
      font-size: 12px;
      letter-spacing: 0.2em;
      color: rgba(234, 244, 255, 0.55);
      pointer-events: none;
      transition: opacity 0.6s ease;
    }
    #move-hint.gone { opacity: 0; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(base);
  return { base, knob };
}

/**
 * Start listening for input.
 *
 * @returns an object the game loop reads every frame
 */
export function createInput() {
  const { base, knob } = createStickElements();

  const hint = document.createElement('div');
  hint.id = 'move-hint';
  hint.textContent = 'DRAG ANYWHERE TO MOVE';
  document.body.appendChild(hint);

  const state = { x: 0, y: 0, strength: 0, running: false };
  const keys = new Set();

  let pointerId = null;   // which finger/button is currently steering
  let originX = 0;
  let originY = 0;
  let hasMoved = false;

  function showStick(x, y) {
    base.style.left = `${x}px`;
    base.style.top = `${y}px`;
    base.classList.add('on');
    knob.style.transform = 'translate(0px, 0px)';
  }

  function hideStick() {
    base.classList.remove('on');
    knob.style.transform = 'translate(0px, 0px)';
  }

  function onPointerDown(event) {
    // Buttons and links keep working - only drags on empty space steer.
    if (event.target.closest('button, a, input')) return;
    if (pointerId !== null) return;

    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    showStick(originX, originY);
  }

  function onPointerMove(event) {
    if (event.pointerId !== pointerId) return;

    let dx = event.clientX - originX;
    let dy = event.clientY - originY;
    const distance = Math.hypot(dx, dy);

    if (distance < DEAD_ZONE) {
      state.x = 0; state.y = 0; state.strength = 0; state.running = false;
      knob.style.transform = 'translate(0px, 0px)';
      return;
    }

    // Clamp the knob to the ring, but keep the direction it was pushed.
    const clamped = Math.min(distance, STICK_RADIUS);
    const nx = dx / distance;
    const ny = dy / distance;
    knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;

    state.x = nx;
    state.y = ny;
    state.strength = clamped / STICK_RADIUS;
    state.running = state.strength > RUN_THRESHOLD;

    if (!hasMoved) {
      hasMoved = true;
      hint.classList.add('gone');
      setTimeout(() => hint.remove(), 800);
    }
  }

  function onPointerUp(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    state.x = 0; state.y = 0; state.strength = 0; state.running = false;
    hideStick();
  }

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  // If the browser takes the pointer away (a notification, a gesture), stop
  // moving rather than walking into a wall forever.
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('blur', () => {
    pointerId = null;
    state.x = 0; state.y = 0; state.strength = 0; state.running = false;
    hideStick();
  });

  // --- keyboard -----------------------------------------------------------
  const KEY_DIRECTIONS = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
  };

  window.addEventListener('keydown', (e) => {
    if (KEY_DIRECTIONS[e.code]) {
      keys.add(e.code);
      e.preventDefault();
      if (!hasMoved) { hasMoved = true; hint.classList.add('gone'); setTimeout(() => hint.remove(), 800); }
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.add('run');
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.delete('run');
  });

  return {
    state,
    /**
     * Called once a frame, before anything reads the state. The joystick keeps
     * its own values up to date as you drag; this folds the keyboard in on top,
     * so the two can't fight each other.
     */
    update() {
      if (pointerId !== null) return state;   // a drag always wins

      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = KEY_DIRECTIONS[code];
        if (dir) { x += dir[0]; y += dir[1]; }
      }

      const distance = Math.hypot(x, y);
      if (distance === 0) {
        state.x = 0; state.y = 0; state.strength = 0; state.running = false;
      } else {
        state.x = x / distance;
        state.y = y / distance;
        // Keys are on or off, so walking is the default and Shift runs.
        state.strength = keys.has('run') ? 1 : 0.62;
        state.running = keys.has('run');
      }
      return state;
    },
  };
}
