// ============================================================
// input.js — Touch/mouse word selection on the physics canvas
//
// UPGRADE: Replaces old DOM-based mouse selection with
// canvas-aware touch-first input. Ball hit detection uses
// physics body positions. Adjacency = physical contact, not
// grid neighbors. Includes "soft magnetism" (generous hit
// radius) for easier mobile selection.
// ============================================================

import { isValidPrefix } from './dictionary.js';

// Config — injected by game.js via initInput()
let canvas = null;
let getBalls = null;      // () => balls array
let areTouching = null;   // (ballA, ballB) => boolean
let onWordSubmit = null;  // (word, path) => void
let wordDisplay = null;   // DOM element for live word display

// Selection state
let selectedPath = [];    // Array of ball references
let isSelecting = false;
let usingTouch = false;   // Prevent double-fire on hybrid devices

// ===================== PUBLIC API =====================

// Initialize input handlers — called by game.js on game start
// Config object avoids circular imports (input.js doesn't import game.js)
export function initInput(config) {
    canvas = config.canvas;
    getBalls = config.getBalls;
    areTouching = config.areTouching;
    onWordSubmit = config.onWordSubmit;
    wordDisplay = config.wordDisplay;

    selectedPath = [];
    isSelecting = false;
    usingTouch = false;

    // Touch events (mobile-first)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // Mouse events (desktop fallback)
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

// Remove all event listeners — called on game stop
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

// Get current selection (read by game.js for rendering highlights)
export function getSelectedPath() {
    return selectedPath;
}

// Clear selection and reset word display
export function clearSelection() {
    selectedPath = [];
    isSelecting = false;
    updateWordDisplay();
}

// ===================== TOUCH EVENTS =====================

function onTouchStart(e) {
    usingTouch = true;
    e.preventDefault();
    const pos = touchToCanvas(e.touches[0]);
    handleStart(pos.x, pos.y);
}

function onTouchMove(e) {
    e.preventDefault();
    const pos = touchToCanvas(e.touches[0]);
    handleMove(pos.x, pos.y);
}

function onTouchEnd(e) {
    e.preventDefault();
    handleEnd();
}

// ===================== MOUSE EVENTS =====================

function onMouseDown(e) {
    if (usingTouch) return; // Ignore mouse on touch devices
    const pos = mouseToCanvas(e);
    handleStart(pos.x, pos.y);
}

function onMouseMove(e) {
    if (usingTouch || !isSelecting) return;
    const pos = mouseToCanvas(e);
    handleMove(pos.x, pos.y);
}

function onMouseUp() {
    if (usingTouch) return;
    handleEnd();
}

// ===================== COORDINATE HELPERS =====================

function touchToCanvas(touch) {
    const rect = canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

function mouseToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ===================== SELECTION LOGIC =====================

// Find the closest non-popping ball to (x, y) within hit range
// Uses a generous 1.3x radius for "soft magnetism" — makes mobile
// selection feel forgiving without being imprecise
// "CATCH A RIIIIIIIIDE!" — Scooter (catching letters since 2026)
function findBallAt(x, y) {
    const allBalls = getBalls();
    let closest = null;
    let closestDist = Infinity;

    for (const ball of allBalls) {
        if (ball.popping > 0) continue;
        const pos = ball.body.position;
        const dx = x - pos.x;
        const dy = y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = ball.radius * 1.3; // Soft magnetism
        if (dist <= hitRadius && dist < closestDist) {
            closest = ball;
            closestDist = dist;
        }
    }
    return closest;
}

// Finger/mouse went down — start a new selection path
function handleStart(x, y) {
    const ball = findBallAt(x, y);
    if (!ball) return;

    isSelecting = true;
    selectedPath = [ball];
    updateWordDisplay();
}

// Finger/mouse is moving — extend, backtrack, or ignore
function handleMove(x, y) {
    if (!isSelecting) return;

    const ball = findBallAt(x, y);
    if (!ball) return;

    const last = selectedPath[selectedPath.length - 1];
    if (!last) return;

    // Same ball — ignore
    if (ball.id === last.id) return;

    // Backtracking: hovering over the second-to-last ball undoes the last step
    if (selectedPath.length >= 2) {
        const prev = selectedPath[selectedPath.length - 2];
        if (ball.id === prev.id) {
            selectedPath.pop();
            updateWordDisplay();
            return;
        }
    }

    // Already in path — ignore (each ball used only once per word)
    if (selectedPath.some(b => b.id === ball.id)) return;

    // Must be physically touching the last selected ball
    if (!areTouching(last, ball)) return;

    // Valid addition to the path
    selectedPath.push(ball);
    updateWordDisplay();
}

// Finger/mouse released — submit the word
// "SHHOOOOTTT MEEE IN THE FACE!" — Face McShooty (submit that word already)
function handleEnd() {
    if (!isSelecting) return;
    isSelecting = false;

    const word = selectedPath.map(b => b.letter).join('');

    if (onWordSubmit && word.length > 0) {
        // game.js will validate, score, and call clearSelection()
        onWordSubmit(word, [...selectedPath]);
    } else {
        // Empty selection — just clear
        selectedPath = [];
        updateWordDisplay();
    }
}

// ===================== WORD DISPLAY =====================
// Updates the live word indicator in the HTML score bar
// Shows green for valid prefix, red for invalid prefix

function updateWordDisplay() {
    if (!wordDisplay) return;
    const word = selectedPath.map(b => b.letter).join('');
    wordDisplay.textContent = word;

    wordDisplay.classList.remove('valid-prefix', 'invalid-prefix');
    if (word.length >= 2) {
        if (isValidPrefix(word)) {
            wordDisplay.classList.add('valid-prefix');
        } else {
            wordDisplay.classList.add('invalid-prefix');
        }
    }
}
