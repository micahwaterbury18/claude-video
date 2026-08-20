// controls.js - two thumbsticks, and nothing else.
//
//   LEFT  stick  -> look. Swings the camera around him.
//   RIGHT stick  -> move. Walks him about.
//
// It knows nothing about the camera, the player or 3D. It reports two pushes
// and that's all. That ignorance matters: when the thing reading a stick and
// the stick itself both know about the camera, they end up fighting.
//
//   move {x, y, magnitude}   -1..1, y POSITIVE is forward
//   look {x, y, magnitude}   -1..1, y POSITIVE is up
//
// Both are a PUSH, not a movement. Hold the look stick over and the camera
// keeps turning for as long as you hold it, the way a stick works on a
// controller - it isn't a drag.
//
// One invisible full-screen layer catches every pointer, and each stick tracks
// its own pointer id, so two thumbs never cancel each other. The visible knobs
// have pointer-events:none and never receive an event in their lives, because
// a knob that listens for its own events stops hearing them the moment your
// finger slides off it.

const MAX_RADIUS = 62;   // how far from its centre a knob can travel, in pixels
const DEADZONE = 0.16;   // ignore tiny pushes, so a tap isn't a twitch

export class TouchControls {
  constructor() {
    this.move = { x: 0, y: 0, magnitude: 0 };
    this.look = { x: 0, y: 0, magnitude: 0 };

    this._keys = new Set();
    this._sticks = {
      look: this._makeStick('look', '#cfe8f5'),
      move: this._makeStick('move', '#3ff0c2'),
    };

    this._buildLayer();
    this._bind();
  }

  // --- the on-screen furniture --------------------------------------------
  _makeStick(name, colour) {
    const base = document.createElement('div');
    base.className = 'stick-base';
    base.style.cssText = `
      position:absolute; width:${MAX_RADIUS * 2}px; height:${MAX_RADIUS * 2}px;
      margin:-${MAX_RADIUS}px 0 0 -${MAX_RADIUS}px;
      border:2px solid ${colour}44; border-radius:50%;
      background:rgba(10,22,36,.22);
      pointer-events:none; opacity:0; transition:opacity .12s;
    `;

    const knob = document.createElement('div');
    knob.className = 'stick-knob';
    knob.style.cssText = `
      position:absolute; width:54px; height:54px; margin:-27px 0 0 -27px;
      background:${colour}cc; border-radius:50%;
      box-shadow:0 0 22px ${colour}66;
      pointer-events:none; opacity:0; transition:opacity .12s;
    `;

    return {
      name, base, knob,
      pointerId: null,
      origin: { x: 0, y: 0 },
      vector: this[name],
    };
  }

  _buildLayer() {
    const layer = document.createElement('div');
    layer.id = 'input-layer';
    layer.style.cssText = `
      position:fixed; inset:0; z-index:5;
      touch-action:none; -webkit-user-select:none; user-select:none;
      -webkit-tap-highlight-color:transparent;
    `;
    for (const stick of Object.values(this._sticks)) {
      layer.append(stick.base, stick.knob);
    }
    document.body.appendChild(layer);
    this.layer = layer;
  }

  _bind() {
    const L = this.layer;
    L.addEventListener('pointerdown', (e) => this._down(e));
    L.addEventListener('pointermove', (e) => this._drag(e));
    L.addEventListener('pointerup', (e) => this._up(e));
    L.addEventListener('pointercancel', (e) => this._up(e));
    L.addEventListener('lostpointercapture', (e) => this._up(e));

    // Safety nets. Without these a stick sticks on a phone call, a
    // notification shade, or an app switch, and he walks off on his own.
    window.addEventListener('blur', () => this.resetAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAll();
    });

    window.addEventListener('keydown', (e) => this._keys.add(e.code));
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));
  }

  _down(e) {
    // Capturing means every later event for this finger comes to us even if it
    // leaves the element, or the window. That's what makes "drag off the
    // bottom of the screen and let go" actually stop him.
    this.layer.setPointerCapture(e.pointerId);

    // LEFT half looks, RIGHT half moves.
    const stick = e.clientX < window.innerWidth / 2 ? this._sticks.look : this._sticks.move;
    if (stick.pointerId !== null) return;   // that thumb is already down

    stick.pointerId = e.pointerId;
    stick.origin.x = e.clientX;
    stick.origin.y = e.clientY;
    stick.base.style.left = stick.knob.style.left = `${e.clientX}px`;
    stick.base.style.top = stick.knob.style.top = `${e.clientY}px`;
    stick.base.style.opacity = stick.knob.style.opacity = '1';
  }

  _drag(e) {
    for (const stick of Object.values(this._sticks)) {
      if (e.pointerId !== stick.pointerId) continue;

      let dx = e.clientX - stick.origin.x;
      let dy = e.clientY - stick.origin.y;
      const distance = Math.hypot(dx, dy);
      const clamped = Math.min(distance, MAX_RADIUS);
      if (distance > 0) {
        dx = (dx / distance) * clamped;
        dy = (dy / distance) * clamped;
      }

      stick.knob.style.left = `${stick.origin.x + dx}px`;
      stick.knob.style.top = `${stick.origin.y + dy}px`;

      const nx = dx / MAX_RADIUS;
      const ny = -dy / MAX_RADIUS;         // screen y counts down; up is positive
      const magnitude = Math.hypot(nx, ny);

      if (magnitude < DEADZONE) {
        stick.vector.x = stick.vector.y = stick.vector.magnitude = 0;
      } else {
        // Rescale past the deadzone so nothing lurches at its edge.
        const scaled = (magnitude - DEADZONE) / (1 - DEADZONE);
        stick.vector.x = (nx / magnitude) * scaled;
        stick.vector.y = (ny / magnitude) * scaled;
        stick.vector.magnitude = scaled;
      }
    }
  }

  _up(e) {
    for (const stick of Object.values(this._sticks)) {
      if (e.pointerId === stick.pointerId) this._release(stick);
    }
  }

  _release(stick) {
    stick.pointerId = null;
    stick.vector.x = stick.vector.y = stick.vector.magnitude = 0;
    stick.base.style.opacity = stick.knob.style.opacity = '0';
  }

  resetAll() {
    for (const stick of Object.values(this._sticks)) this._release(stick);
    this._keys.clear();
  }

  /** Merge a stick with a set of keys into one vector. */
  _merge(vector, up, down, left, right) {
    let x = vector.x;
    let y = vector.y;
    if (this._keys.has(up[0]) || this._keys.has(up[1])) y += 1;
    if (this._keys.has(down[0]) || this._keys.has(down[1])) y -= 1;
    if (this._keys.has(right[0]) || this._keys.has(right[1])) x += 1;
    if (this._keys.has(left[0]) || this._keys.has(left[1])) x -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, magnitude: Math.min(m, 1) };
  }

  /** Walking. WASD joins in. */
  getMove() {
    return this._merge(this.move,
      ['KeyW', 'KeyW'], ['KeyS', 'KeyS'], ['KeyA', 'KeyA'], ['KeyD', 'KeyD']);
  }

  /** Looking. Arrow keys join in. */
  getLook() {
    return this._merge(this.look,
      ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'],
      ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight']);
  }

  dispose() {
    this.resetAll();
    this.layer.remove();
  }
}
