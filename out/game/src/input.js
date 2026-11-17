// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (confirm, pause, enter car, punch, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. The mouse
// position is kept in canvas pixels for aiming.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['Escape', 'KeyP']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || CONFIRM.has(event.code) || ENTER.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
    if (event.button === 0) actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** Movement vector, normalised, in screen space (x right, y down). */
    move() {
      const x = ([...RIGHT].some((c) => keys.has(c)) ? 1 : 0) - ([...LEFT].some((c) => keys.has(c)) ? 1 : 0);
      const y = ([...DOWN].some((c) => keys.has(c)) ? 1 : 0) - ([...UP].some((c) => keys.has(c)) ? 1 : 0);
      const len = Math.hypot(x, y);
      if (len === 0) return { x: 0, y: 0 };
      return { x: x / len, y: y / len };
    },
    /** Driving: throttle -1..1 (W/S or arrows) and steering -1..1 (A/D or arrows). */
    drive() {
      const throttle = ([...UP].some((c) => keys.has(c)) ? 1 : 0) - ([...DOWN].some((c) => keys.has(c)) ? 0.6 : 0);
      const steer = ([...RIGHT].some((c) => keys.has(c)) ? 1 : 0) - ([...LEFT].some((c) => keys.has(c)) ? 1 : 0);
      return { throttle, steer };
    },
    running() {
      return [...RUN].some((c) => keys.has(c));
    },
    /** Mouse position in canvas pixels, and whether the button is held (for shooting). */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
