import { isAdjacent, getGridElement } from './bucket.js';
import { isValidPrefix } from './dictionary.js';

let selectedPath = []; // array of { row, col, letter, element }
let isSelecting = false;
let onSelectionComplete = null;
let wordDisplay = null;

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

function onMouseDown(e) {
    const cell = getCellFromEvent(e);
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

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;

    const cell = getCellFromElement(el);
    if (!cell) return;

    const last = selectedPath[selectedPath.length - 1];
    if (!last) return;

    // Check if backtracking (hovering over second-to-last)
    if (selectedPath.length >= 2) {
        const prev = selectedPath[selectedPath.length - 2];
        if (prev.row === cell.row && prev.col === cell.col) {
            // Backtrack: remove last from path
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

    // Prefix validation feedback
    wordDisplay.classList.remove('valid-prefix', 'invalid-prefix');
    if (word.length >= 2) {
        if (isValidPrefix(word)) {
            wordDisplay.classList.add('valid-prefix');
        } else {
            wordDisplay.classList.add('invalid-prefix');
        }
    }
}

function getCellFromEvent(e) {
    const target = e.target.closest('.grid-letter');
    if (!target || target.style.visibility === 'hidden') return null;
    return getCellFromElement(target);
}

function getCellFromElement(el) {
    const target = el.closest ? el.closest('.grid-letter') : null;
    if (!target || target.style.visibility === 'hidden') return null;
    if (!target.dataset.row || !target.dataset.col) return null;

    return {
        row: parseInt(target.dataset.row),
        col: parseInt(target.dataset.col),
        letter: target.dataset.letter,
        element: target
    };
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
