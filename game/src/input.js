// input.js - keyboard and mouse state for Sunset Bay.
// Movement reads held keys every frame; actions such as entering a car
// or firing read one-shot presses that are consumed once per frame.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 480, y: 270, down: false, clicked: false };
    this.anyGesture = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.anyGesture = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; this.anyGesture = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True only on the frame the key went down; consumes the press.
  tap(...codes) {
    for (const c of codes) {
      if (this.pressed.has(c)) { this.pressed.delete(c); return true; }
    }
    return false;
  }

  axisX() {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  axisY() {
    return (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
  }

  isSprinting() {
    return this.down('ShiftLeft', 'ShiftRight');
  }

  // Called at the end of each frame so one-shot state never leaks.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
