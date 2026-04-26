// ============================================================
// input.ts — Touch/mouse word selection (single + multi-touch duel)
// "CATCH A RIIIIIIIIDE!" — Scooter
// ============================================================

import type { Ball, InputConfig } from './types';

interface PathState {
  player: 1 | 2;
  balls: Ball[];
}

let canvas: HTMLCanvasElement | null = null;
let getBalls: (() => Ball[]) | null = null;
let areTouching: ((a: Ball, b: Ball) => boolean) | null = null;
let onWordSubmit: ((word: string, path: Ball[], player: 1 | 2) => void) | null = null;
let wordDisplay: HTMLElement | null = null;
let isValidPrefixFn: ((s: string) => boolean) | null = null;
let multiTouch = false;

// Laser mode (one-shot): when armed, the next pointer drag is a slash that fires a laser.
let laserArmed = false;
let laserStart: { x: number; y: number } | null = null;
let laserEnd: { x: number; y: number } | null = null;
let onLaserFire: ((s: { x: number; y: number }, e: { x: number; y: number }) => void) | null = null;

export function armLaser(handler: (s: { x: number; y: number }, e: { x: number; y: number }) => void) {
  laserArmed = true;
  laserStart = null;
  laserEnd = null;
  onLaserFire = handler;
}

export function isLaserArmed(): boolean { return laserArmed; }
export function getLaserLine() {
  return laserStart && laserEnd ? { start: laserStart, end: laserEnd } : null;
}

// Single-touch state (mouse / single-finger fallback)
let mousePath: PathState | null = null;
let mouseSelecting = false;
let usingTouch = false;

// Multi-touch: identifier -> PathState
const touchPaths: Map<number, PathState> = new Map();

// ==================== PUBLIC API ====================

export function initInput(config: InputConfig) {
  canvas = config.canvas;
  getBalls = config.getBalls;
  areTouching = config.areTouching;
  onWordSubmit = config.onWordSubmit;
  wordDisplay = config.wordDisplay;
  isValidPrefixFn = config.isValidPrefix;
  multiTouch = !!config.multiTouch;

  mousePath = null;
  mouseSelecting = false;
  usingTouch = false;
  touchPaths.clear();

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

export function destroyInput() {
  if (canvas) {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
    canvas.removeEventListener('mousedown', onMouseDown);
  }
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  mousePath = null;
  mouseSelecting = false;
  touchPaths.clear();
  updateWordDisplay();
}

// Backwards-compat: single-path getter (returns first active path)
export function getSelectedPath(): Ball[] {
  if (mousePath) return mousePath.balls;
  const first = touchPaths.values().next().value;
  return first ? first.balls : [];
}

// All active paths (for rendering with player-colored highlights)
export function getActivePaths(): PathState[] {
  const out: PathState[] = [];
  if (mousePath) out.push(mousePath);
  for (const p of touchPaths.values()) out.push(p);
  return out;
}

export function clearSelection() {
  mousePath = null;
  mouseSelecting = false;
  touchPaths.clear();
  updateWordDisplay();
}

// ==================== TOUCH ====================

function onTouchStart(e: TouchEvent) {
  usingTouch = true;
  e.preventDefault();
  if (laserArmed) {
    const t = e.changedTouches[0];
    if (t) { const p = touchPos(t); laserStart = p; laserEnd = p; }
    return;
  }
  for (const t of Array.from(e.changedTouches)) {
    const p = touchPos(t);
    const player = pickPlayer(p.x);
    const ball = findClaimableBall(p.x, p.y);
    if (!ball) continue;
    touchPaths.set(t.identifier, { player, balls: [ball] });
  }
  updateWordDisplay();
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault();
  if (laserArmed) {
    const t = e.changedTouches[0];
    if (t && laserStart) laserEnd = touchPos(t);
    return;
  }
  for (const t of Array.from(e.changedTouches)) {
    const path = touchPaths.get(t.identifier);
    if (!path) continue;
    const p = touchPos(t);
    extendPath(path, p.x, p.y);
  }
  updateWordDisplay();
}

function onTouchEnd(e: TouchEvent) {
  e.preventDefault();
  if (laserArmed) {
    fireLaserIfAny();
    return;
  }
  for (const t of Array.from(e.changedTouches)) {
    const path = touchPaths.get(t.identifier);
    if (!path) continue;
    submitPath(path);
    touchPaths.delete(t.identifier);
  }
  updateWordDisplay();
}

// ==================== MOUSE ====================

function onMouseDown(e: MouseEvent) {
  if (usingTouch) return;
  const p = mousePos(e);
  if (laserArmed) { laserStart = p; laserEnd = p; mouseSelecting = true; return; }
  const player = pickPlayer(p.x);
  const ball = findClaimableBall(p.x, p.y);
  if (!ball) return;
  mouseSelecting = true;
  mousePath = { player, balls: [ball] };
  updateWordDisplay();
}

function onMouseMove(e: MouseEvent) {
  if (usingTouch || !mouseSelecting) return;
  const p = mousePos(e);
  if (laserArmed) { if (laserStart) laserEnd = p; return; }
  if (!mousePath) return;
  extendPath(mousePath, p.x, p.y);
  updateWordDisplay();
}

function onMouseUp() {
  if (usingTouch) return;
  if (!mouseSelecting) return;
  mouseSelecting = false;
  if (laserArmed) { fireLaserIfAny(); return; }
  if (mousePath) submitPath(mousePath);
  mousePath = null;
  updateWordDisplay();
}

function fireLaserIfAny() {
  if (laserStart && laserEnd && onLaserFire) {
    onLaserFire(laserStart, laserEnd);
  }
  laserArmed = false;
  laserStart = null;
  laserEnd = null;
  onLaserFire = null;
}

// ==================== HELPERS ====================

function touchPos(t: Touch) {
  const r = canvas!.getBoundingClientRect();
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}
function mousePos(e: MouseEvent) {
  const r = canvas!.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function pickPlayer(x: number): 1 | 2 {
  if (!multiTouch) return 1;
  const r = canvas!.getBoundingClientRect();
  return x < r.width / 2 ? 1 : 2;
}

// Returns a ball if it's not claimed by any other active path
function findClaimableBall(x: number, y: number): Ball | null {
  const all = getBalls!();
  let closest: Ball | null = null;
  let closestDist = Infinity;
  for (const ball of all) {
    if (ball.popping > 0) continue;
    const dx = x - ball.body.position.x;
    const dy = y - ball.body.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= ball.radius * 1.3 && dist < closestDist) {
      if (isClaimed(ball)) continue;
      closest = ball; closestDist = dist;
    }
  }
  return closest;
}

function isClaimed(ball: Ball): boolean {
  if (mousePath?.balls.some(b => b.id === ball.id)) return true;
  for (const p of touchPaths.values()) if (p.balls.some(b => b.id === ball.id)) return true;
  return false;
}

function extendPath(path: PathState, x: number, y: number) {
  const ball = pickBallAt(x, y, path);
  if (!ball) return;
  const last = path.balls[path.balls.length - 1];
  if (!last || ball.id === last.id) return;

  // Backtrack
  if (path.balls.length >= 2 && ball.id === path.balls[path.balls.length - 2].id) {
    path.balls.pop();
    return;
  }
  if (path.balls.some(b => b.id === ball.id)) return;
  if (!areTouching!(last, ball)) return;
  if (isClaimedByOther(ball, path)) return;
  path.balls.push(ball);
}

function pickBallAt(x: number, y: number, _ownPath: PathState): Ball | null {
  void _ownPath;
  const all = getBalls!();
  let closest: Ball | null = null;
  let closestDist = Infinity;
  for (const ball of all) {
    if (ball.popping > 0) continue;
    const dx = x - ball.body.position.x;
    const dy = y - ball.body.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= ball.radius * 1.3 && dist < closestDist) {
      closest = ball; closestDist = dist;
    }
  }
  return closest;
}

function isClaimedByOther(ball: Ball, ownPath: PathState): boolean {
  if (mousePath && mousePath !== ownPath && mousePath.balls.some(b => b.id === ball.id)) return true;
  for (const p of touchPaths.values()) {
    if (p === ownPath) continue;
    if (p.balls.some(b => b.id === ball.id)) return true;
  }
  return false;
}

function submitPath(path: PathState) {
  const word = path.balls.map(b => b.letter).join('');
  if (onWordSubmit && word.length > 0) onWordSubmit(word, [...path.balls], path.player);
}

function updateWordDisplay() {
  if (!wordDisplay) return;
  // Show whichever path is longest (most relevant during a race)
  let longest: Ball[] = mousePath?.balls ?? [];
  for (const p of touchPaths.values()) {
    if (p.balls.length > longest.length) longest = p.balls;
  }
  const word = longest.map(b => b.letter).join('');
  wordDisplay.textContent = word;
  wordDisplay.classList.remove('valid-prefix', 'invalid-prefix');
  if (word.length >= 2) {
    wordDisplay.classList.add(isValidPrefixFn?.(word) ? 'valid-prefix' : 'invalid-prefix');
  }
}
