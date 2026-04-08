// ============================================================
// input.ts — Touch/mouse word selection on the physics canvas
// "CATCH A RIIIIIIIIDE!" — Scooter (catching letters since 2026)
// ============================================================

import type { Ball, InputConfig } from './types';

let canvas: HTMLCanvasElement | null = null;
let getBalls: (() => Ball[]) | null = null;
let areTouching: ((a: Ball, b: Ball) => boolean) | null = null;
let onWordSubmit: ((word: string, path: Ball[]) => void) | null = null;
let wordDisplay: HTMLElement | null = null;
let isValidPrefixFn: ((s: string) => boolean) | null = null;

let selectedPath: Ball[] = [];
let isSelecting = false;
let usingTouch = false;

// ==================== PUBLIC API ====================

export function initInput(config: InputConfig) {
  canvas = config.canvas;
  getBalls = config.getBalls;
  areTouching = config.areTouching;
  onWordSubmit = config.onWordSubmit;
  wordDisplay = config.wordDisplay;
  isValidPrefixFn = config.isValidPrefix;

  selectedPath = [];
  isSelecting = false;
  usingTouch = false;

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

export function destroyInput() {
  if (canvas) {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('mousedown', onMouseDown);
  }
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  selectedPath = [];
  isSelecting = false;
  updateWordDisplay();
}

export function getSelectedPath(): Ball[] { return selectedPath; }
export function clearSelection() {
  selectedPath = [];
  isSelecting = false;
  updateWordDisplay();
}

// ==================== EVENT HANDLERS ====================

function onTouchStart(e: TouchEvent) { usingTouch = true; e.preventDefault(); const p = touchPos(e.touches[0]); handleStart(p.x, p.y); }
function onTouchMove(e: TouchEvent) { e.preventDefault(); const p = touchPos(e.touches[0]); handleMove(p.x, p.y); }
function onTouchEnd(e: TouchEvent) { e.preventDefault(); handleEnd(); }
function onMouseDown(e: MouseEvent) { if (usingTouch) return; const p = mousePos(e); handleStart(p.x, p.y); }
function onMouseMove(e: MouseEvent) { if (usingTouch || !isSelecting) return; const p = mousePos(e); handleMove(p.x, p.y); }
function onMouseUp() { if (usingTouch) return; handleEnd(); }

function touchPos(t: Touch) { const r = canvas!.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; }
function mousePos(e: MouseEvent) { const r = canvas!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

// ==================== SELECTION LOGIC ====================

// "SHHOOOOTTT MEEE IN THE FACE!" — Face McShooty
function findBallAt(x: number, y: number): Ball | null {
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

function handleStart(x: number, y: number) {
  const ball = findBallAt(x, y);
  if (!ball) return;
  isSelecting = true;
  selectedPath = [ball];
  updateWordDisplay();
}

function handleMove(x: number, y: number) {
  if (!isSelecting) return;
  const ball = findBallAt(x, y);
  if (!ball) return;
  const last = selectedPath[selectedPath.length - 1];
  if (!last || ball.id === last.id) return;

  // Backtrack
  if (selectedPath.length >= 2 && ball.id === selectedPath[selectedPath.length - 2].id) {
    selectedPath.pop();
    updateWordDisplay();
    return;
  }

  if (selectedPath.some(b => b.id === ball.id)) return;
  if (!areTouching!(last, ball)) return;

  selectedPath.push(ball);
  updateWordDisplay();
}

function handleEnd() {
  if (!isSelecting) return;
  isSelecting = false;
  const word = selectedPath.map(b => b.letter).join('');
  if (onWordSubmit && word.length > 0) {
    onWordSubmit(word, [...selectedPath]);
  } else {
    selectedPath = [];
    updateWordDisplay();
  }
}

function updateWordDisplay() {
  if (!wordDisplay) return;
  const word = selectedPath.map(b => b.letter).join('');
  wordDisplay.textContent = word;
  wordDisplay.classList.remove('valid-prefix', 'invalid-prefix');
  if (word.length >= 2) {
    wordDisplay.classList.add(isValidPrefixFn?.(word) ? 'valid-prefix' : 'invalid-prefix');
  }
}
