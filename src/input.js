// input.js - keyboard, mouse/touch and gamepad, reduced to game actions.
export class Input {
  constructor(el, toInternal) {
    this.down = new Set();
    this.pressed = [];
    this.pointer = null;
    this.clicks = [];
    this.toInternal = toInternal;
    addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.push(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    const pos = (e) => this.toInternal(e.clientX, e.clientY);
    el.addEventListener('pointermove', (e) => { this.pointer = pos(e); });
    el.addEventListener('pointerdown', (e) => { this.pointer = pos(e); this.clicks.push(pos(e)); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.pad = { prev: {}, now: {} };
  }

  // gamepad buttons become synthetic key presses
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x);
    const now = {};
    if (p) {
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      now.PadA = b(0); now.PadB = b(1); now.PadX = b(2); now.PadY = b(3);
      now.PadLB = b(4); now.PadRB = b(5); now.PadStart = b(9);
      now.PadUp = b(12) || p.axes[1] < -0.6; now.PadDown = b(13) || p.axes[1] > 0.6;
      now.PadLeft = b(14) || p.axes[0] < -0.6; now.PadRight = b(15) || p.axes[0] > 0.6;
    }
    for (const k in now) if (now[k] && !this.pad.now[k]) this.pressed.push(k);
    this.pad.now = now;
  }

  take() {
    this.pollPad();
    const p = this.pressed;
    const c = this.clicks;
    this.pressed = [];
    this.clicks = [];
    return { keys: p, clicks: c };
  }

  held(...codes) { return codes.some(c => this.down.has(c) || this.pad.now[c]); }
}

export const ACT = {
  forward: ['KeyW', 'ArrowUp', 'PadUp'],
  back: ['KeyS', 'ArrowDown', 'PadDown'],
  turnL: ['KeyA', 'ArrowLeft', 'PadLeft'],
  turnR: ['KeyD', 'ArrowRight', 'PadRight'],
  strafeL: ['KeyQ', 'PadLB'],
  strafeR: ['KeyE', 'PadRB'],
  confirm: ['Space', 'Enter', 'NumpadEnter', 'PadA'],
  cancel: ['Escape', 'Backspace', 'PadB'],
  bag: ['Tab', 'KeyB', 'PadX'],
  map: ['KeyM', 'PadY'],
  mute: ['KeyN'],
  crt: ['KeyV'],
  ps1: ['KeyP'],
  cashout: ['KeyC'],
  n1: ['Digit1'], n2: ['Digit2'], n3: ['Digit3'], n4: ['Digit4'],
};

export const is = (code, act) => ACT[act].includes(code);
