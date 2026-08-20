// controls.js - a dumb input device.
//
// It outputs two things and knows nothing else: no camera, no player, no 3D.
// That ignorance is the point. When the thing reading the stick and the stick
// itself both know about the camera, they end up fighting each other.
//
//   move  {x, y}   -1..1, and y POSITIVE means forward
//   look  {dx,dy}  pixels dragged since the last frame, consumed each frame
//
// One invisible full-screen layer catches every pointer. Left half walks,
// right half turns the camera, each tracking its own pointer id so two thumbs
// never cancel each other. The visible knob is pure decoration - it has
// pointer-events:none and never receives an event in its life, because a knob
// that listens for its own events stops hearing them the moment your finger
// slides off it.

export class TouchControls {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.deadzone = 0.15;
    this.maxRadius = 60;

    this._movePointer = null;
    this._lookPointer = null;
    this._origin = { x: 0, y: 0 };
    this._lookLast = { x: 0, y: 0 };
    this._keys = new Set();

    this._buildDOM();
    this._bind();
  }

  _buildDOM() {
    const layer = document.createElement('div');
    layer.id = 'input-layer';
    layer.style.cssText = `
      position:fixed; inset:0; z-index:5;
      touch-action:none; -webkit-user-select:none; user-select:none;
      -webkit-tap-highlight-color:transparent;
    `;

    const base = document.createElement('div');
    base.style.cssText = `
      position:absolute; width:120px; height:120px; margin:-60px 0 0 -60px;
      border:2px solid rgba(207,232,245,.35); border-radius:50%;
      pointer-events:none; opacity:0; transition:opacity .12s;
    `;

    const knob = document.createElement('div');
    knob.style.cssText = `
      position:absolute; width:52px; height:52px; margin:-26px 0 0 -26px;
      background:rgba(63,240,194,.75); border-radius:50%;
      box-shadow:0 0 20px rgba(63,240,194,.45);
      pointer-events:none; opacity:0; transition:opacity .12s;
    `;

    layer.append(base, knob);
    document.body.appendChild(layer);
    this.layer = layer;
    this.base = base;
    this.knob = knob;
  }

  _bind() {
    const L = this.layer;
    L.addEventListener('pointerdown', (e) => this._down(e));
    L.addEventListener('pointermove', (e) => this._move(e));
    L.addEventListener('pointerup', (e) => this._up(e));
    L.addEventListener('pointercancel', (e) => this._up(e));
    L.addEventListener('lostpointercapture', (e) => this._up(e));

    // Safety nets. Without these the stick sticks on a phone call, a
    // notification shade, or an app switch, and he walks off on his own.
    window.addEventListener('blur', () => this.resetAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAll();
    });

    // Desktop keyboard feeds the same vector, so there's one code path.
    window.addEventListener('keydown', (e) => this._keys.add(e.code));
    window.addEventListener('keyup', (e) => this._keys.delete(e.code));
  }

  _down(e) {
    // Capturing the pointer means every later event for this finger comes to
    // us even if it leaves the element, or the window entirely. That's what
    // makes "drag off the bottom of the screen and let go" stop him.
    this.layer.setPointerCapture(e.pointerId);
    const leftHalf = e.clientX < window.innerWidth / 2;

    if (leftHalf && this._movePointer === null) {
      this._movePointer = e.pointerId;
      this._origin.x = e.clientX;
      this._origin.y = e.clientY;
      this.base.style.left = this.knob.style.left = e.clientX + 'px';
      this.base.style.top = this.knob.style.top = e.clientY + 'px';
      this.base.style.opacity = this.knob.style.opacity = '1';
    } else if (!leftHalf && this._lookPointer === null) {
      this._lookPointer = e.pointerId;
      this._lookLast.x = e.clientX;
      this._lookLast.y = e.clientY;
    }
  }

  _move(e) {
    if (e.pointerId === this._movePointer) {
      let dx = e.clientX - this._origin.x;
      let dy = e.clientY - this._origin.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, this.maxRadius);

      if (dist > 0) {
        dx = (dx / dist) * clamped;
        dy = (dy / dist) * clamped;
      }

      this.knob.style.left = (this._origin.x + dx) + 'px';
      this.knob.style.top = (this._origin.y + dy) + 'px';

      const nx = dx / this.maxRadius;
      const ny = -dy / this.maxRadius;    // screen y counts downward; up = forward
      const mag = Math.hypot(nx, ny);

      if (mag < this.deadzone) {
        this.move.x = this.move.y = 0;
      } else {
        // Rescale past the deadzone, so he doesn't lurch the instant you
        // cross its edge.
        const scaled = (mag - this.deadzone) / (1 - this.deadzone);
        this.move.x = (nx / mag) * scaled;
        this.move.y = (ny / mag) * scaled;
      }
    }

    if (e.pointerId === this._lookPointer) {
      this.look.dx += e.clientX - this._lookLast.x;
      this.look.dy += e.clientY - this._lookLast.y;
      this._lookLast.x = e.clientX;
      this._lookLast.y = e.clientY;
    }
  }

  _up(e) {
    if (e.pointerId === this._movePointer) this._resetMove();
    if (e.pointerId === this._lookPointer) this._lookPointer = null;
  }

  _resetMove() {
    this._movePointer = null;
    this.move.x = 0;
    this.move.y = 0;
    this.base.style.opacity = this.knob.style.opacity = '0';
  }

  resetAll() {
    this._resetMove();
    this._lookPointer = null;
    this.look.dx = this.look.dy = 0;
    this._keys.clear();
  }

  /** Call once a frame, AFTER the camera has used the values. */
  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = this.look.dy = 0;
    return l;
  }

  /** Stick and keyboard, merged into one vector. */
  getMove() {
    let x = this.move.x;
    let y = this.move.y;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) y += 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) y -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) x += 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) x -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, magnitude: Math.min(m, 1) };
  }

  /** Take the layer off the screen (used when a dialogue takes over). */
  dispose() {
    this.resetAll();
    this.layer.remove();
  }
}
