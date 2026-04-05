import { isAdjacent, getGridElement } from './bucket.js';
import { isValidPrefix } from './dictionary.js';

let selectedPath = [];
let isSelecting = false;
let onSelectionComplete = null;
let wordDisplay = null;

// Cache letter element positions for precision hit-testing
let letterPositionCache = [];
let cacheValid = false;

export function initInput(callback) {
    onSelectionComplete = callback;
    wordDisplay = document.getElementById('current-word-display');

    const gridEl = getGridElement();

    gridEl.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Prevent text selection and context menu
    gridEl.addEventListener('contextmenu', e => e.preventDefault());
    gridEl.addEventListener('selectstart', e => e.preventDefault());
}

export function destroyInput() {
    const gridEl = getGridElement();
    if (gridEl) {
        gridEl.removeEventListener('mousedown', onMouseDown);
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

// Rebuild position cache for all visible grid letters
export function invalidatePositionCache() {
    cacheValid = false;
}

function rebuildCache() {
    letterPositionCache = [];
    const letters = document.querySelectorAll('.grid-letter[data-row]');
    letters.forEach(el => {
        if (el.style.visibility === 'hidden') return;
        const rect = el.getBoundingClientRect();
        letterPositionCache.push({
            element: el,
            row: parseInt(el.dataset.row),
            col: parseInt(el.dataset.col),
            letter: el.dataset.letter,
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2,
            halfW: rect.width / 2,
            halfH: rect.height / 2,
            // Expanded hit area (20% larger) for easier targeting
            hitRadius: Math.max(rect.width, rect.height) * 0.6
        });
    });
    cacheValid = true;
}

// Find closest letter to mouse position using cached rects
// More precise than elementFromPoint — uses center distance + expanded hit area
function findLetterAtPoint(x, y) {
    if (!cacheValid) rebuildCache();

    let closest = null;
    let closestDist = Infinity;

    for (const entry of letterPositionCache) {
        const dx = x - entry.cx;
        const dy = y - entry.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Must be within expanded hit radius
        if (dist <= entry.hitRadius && dist < closestDist) {
            closestDist = dist;
            closest = entry;
        }
    }

    return closest;
}

function onMouseDown(e) {
    // Rebuild cache on each selection start (letters may have changed)
    rebuildCache();

    const cell = findLetterAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    e.preventDefault();
    isSelecting = true;
    selectedPath = [];
    addToPath(cell);
    updateDisplay();
}

function onMouseMove(e) {
    if (!isSelecting) return;
    e.preventDefault();

    const cell = findLetterAtPoint(e.clientX, e.clientY);
    if (!cell) return;

    const last = selectedPath[selectedPath.length - 1];
    if (!last) return;

    // Same cell as current last — ignore
    if (last.row === cell.row && last.col === cell.col) return;

    // Check if backtracking (hovering over second-to-last)
    if (selectedPath.length >= 2) {
        const prev = selectedPath[selectedPath.length - 2];
        if (prev.row === cell.row && prev.col === cell.col) {
            const removed = selectedPath.pop();
            removed.element.classList.remove('selected');
            updateDisplay();
            return;
        }
    }

    // Check if already in path
    if (selectedPath.some(p => p.row === cell.row && p.col === cell.col)) return;

    // Check adjacency
    if (!isAdjacent(last.row, last.col, cell.row, cell.col)) return;

    addToPath(cell);
    updateDisplay();
}

function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const word = selectedPath.map(p => p.letter).join('');

    // Clear visual selection
    for (const p of selectedPath) {
        p.element.classList.remove('selected');
    }

    // Callback with path and word
    if (onSelectionComplete && word.length >= 2) {
        onSelectionComplete(word, [...selectedPath]);
    }

    selectedPath = [];
    updateDisplay();
}

function addToPath(cell) {
    cell.element.classList.add('selected');
    selectedPath.push(cell);
}

function updateDisplay() {
    if (!wordDisplay) return;
    const word = selectedPath.map(p => p.letter).join('');
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

export function clearSelection() {
    for (const p of selectedPath) {
        p.element.classList.remove('selected');
    }
    selectedPath = [];
    if (wordDisplay) {
        wordDisplay.textContent = '';
        wordDisplay.classList.remove('valid-prefix', 'invalid-prefix');
    }
}
