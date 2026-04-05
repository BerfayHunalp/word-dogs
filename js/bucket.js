import { createGridLetterElement } from './letter.js';
import { invalidatePositionCache } from './input.js';

const COLUMNS = 6;
const MAX_ROWS = 8;

// Grid stored as flat array, row-major (bottom row first)
// Each cell: { letter, element, row, col } or null
let grid = []; // array of rows, each row = array of COLUMNS cells
let gridEl = null;
let lastDropCol = -1; // track last column for bounce mechanic

export function initBucket() {
    gridEl = document.getElementById('letter-grid');
    gridEl.innerHTML = '';
    grid = [];
    lastDropCol = -1;
}

export function getColumns() {
    return COLUMNS;
}

export function getMaxRows() {
    return MAX_ROWS;
}

export function getCurrentRows() {
    return grid.length;
}

// Find the target column for a new letter (with bounce)
export function getTargetColumn() {
    // Pick a random column
    let col = Math.floor(Math.random() * COLUMNS);
    return col;
}

// Add a letter to the bucket. Returns true if successful, false if overflow.
export function addLetter(letter, preferredCol) {
    let col = preferredCol !== undefined ? preferredCol : Math.floor(Math.random() * COLUMNS);

    // Bounce mechanic: if same column as last drop, bounce to adjacent
    if (col === lastDropCol) {
        col = bounceToAdjacent(col);
    }
    lastDropCol = col;

    // Find the first row (from bottom) that has an empty slot in this column
    let targetRow = -1;
    for (let r = 0; r < grid.length; r++) {
        if (grid[r][col] === null) {
            targetRow = r;
            break;
        }
    }

    // If no empty slot in existing rows, add a new row
    if (targetRow === -1) {
        if (grid.length >= MAX_ROWS) {
            return false; // Overflow!
        }
        grid.push(new Array(COLUMNS).fill(null));
        targetRow = grid.length - 1;
    }

    // Create the element
    const el = createGridLetterElement(letter);
    grid[targetRow][col] = { letter, element: el, row: targetRow, col };

    // Render
    renderGrid();

    // Spawn splash particles on landing
    requestAnimationFrame(() => spawnSplashParticles(el));

    return true;
}

function bounceToAdjacent(col) {
    // Try 4 directions: left, right, left+1, right+1
    const directions = [];
    if (col > 0) directions.push(col - 1);
    if (col < COLUMNS - 1) directions.push(col + 1);
    if (col > 1) directions.push(col - 2);
    if (col < COLUMNS - 2) directions.push(col + 2);

    // Shuffle directions for randomness
    for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    // Pick the first direction that has the shortest stack
    let bestCol = col;
    let bestHeight = Infinity;
    for (const c of directions) {
        const height = getColumnHeight(c);
        if (height < bestHeight) {
            bestHeight = height;
            bestCol = c;
        }
    }

    return bestCol;
}

function getColumnHeight(col) {
    let height = 0;
    for (let r = 0; r < grid.length; r++) {
        if (grid[r][col] !== null) height = r + 1;
    }
    return height;
}

// Render the grid to the DOM (bottom row first visually = last in DOM flex order)
function renderGrid() {
    gridEl.innerHTML = '';

    // We render top-to-bottom visually, which means highest row index first
    for (let r = grid.length - 1; r >= 0; r--) {
        for (let c = 0; c < COLUMNS; c++) {
            const cell = grid[r][c];
            if (cell) {
                cell.element.dataset.row = r;
                cell.element.dataset.col = c;
                gridEl.appendChild(cell.element);
            } else {
                // Empty placeholder
                const placeholder = document.createElement('div');
                placeholder.classList.add('grid-letter');
                placeholder.style.visibility = 'hidden';
                gridEl.appendChild(placeholder);
            }
        }
    }

    // Update danger state
    const bucket = document.getElementById('bucket');
    if (grid.length >= MAX_ROWS - 1) {
        bucket.classList.add('danger');
    } else {
        bucket.classList.remove('danger');
    }

    // Invalidate input position cache after DOM changes
    invalidatePositionCache();
}

// Get cell at row, col
export function getCell(row, col) {
    if (row < 0 || row >= grid.length) return null;
    if (col < 0 || col >= COLUMNS) return null;
    return grid[row][col];
}

// Check adjacency (horizontal, vertical, diagonal)
export function isAdjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2);
}

// Remove cells and apply gravity
export function removeCells(cells) {
    // Mark cells for explosion animation
    for (const cell of cells) {
        if (cell && cell.element) {
            cell.element.classList.add('explode');
        }
    }

    // After animation, actually remove
    return new Promise(resolve => {
        setTimeout(() => {
            for (const cell of cells) {
                if (cell && grid[cell.row] && grid[cell.row][cell.col] === cell) {
                    grid[cell.row][cell.col] = null;
                }
            }
            applyGravity();
            cleanEmptyTopRows();
            renderGrid();
            resolve();
        }, 400);
    });
}

// Apply gravity: letters fall down to fill empty cells below
function applyGravity() {
    for (let c = 0; c < COLUMNS; c++) {
        // Collect non-null cells in this column from bottom up
        const columnCells = [];
        for (let r = 0; r < grid.length; r++) {
            if (grid[r][c] !== null) {
                columnCells.push(grid[r][c]);
            }
        }
        // Place them back from bottom
        for (let r = 0; r < grid.length; r++) {
            if (r < columnCells.length) {
                columnCells[r].row = r;
                columnCells[r].col = c;
                grid[r][c] = columnCells[r];
            } else {
                grid[r][c] = null;
            }
        }
    }
}

// Remove empty rows from the top
function cleanEmptyTopRows() {
    while (grid.length > 0) {
        const topRow = grid[grid.length - 1];
        if (topRow.every(cell => cell === null)) {
            grid.pop();
        } else {
            break;
        }
    }
}

export function isOverflow() {
    return grid.length > MAX_ROWS;
}

// Get all non-null cells (for game over animation etc.)
export function getAllCells() {
    const cells = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < COLUMNS; c++) {
            if (grid[r][c]) cells.push(grid[r][c]);
        }
    }
    return cells;
}

// Get grid element for position calculations
export function getGridElement() {
    return gridEl;
}

// Splash particles when a letter lands in the bucket
function spawnSplashParticles(letterEl) {
    const container = document.getElementById('splash-particles');
    if (!container) return;

    const rect = letterEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const cx = rect.left - containerRect.left + rect.width / 2;
    const cy = rect.top - containerRect.top;

    const count = 6 + Math.floor(Math.random() * 4); // 6-9 particles
    const colors = ['#f59e0b', '#fbbf24', '#d97706', '#e2e8f0', '#94a3b8'];

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('splash-particle');

        // Random direction — slight upward bias to spill over bucket rim
        const angle = -Math.PI * 0.2 + Math.random() * -Math.PI * 0.6; // upward arc
        const speed = 20 + Math.random() * 40;
        const dx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
        const dy = Math.sin(angle) * speed;

        particle.style.left = `${cx}px`;
        particle.style.top = `${cy}px`;
        particle.style.setProperty('--dx', `${dx}px`);
        particle.style.setProperty('--dy', `${dy}px`);
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.width = `${3 + Math.random() * 5}px`;
        particle.style.height = particle.style.width;

        container.appendChild(particle);

        // Cleanup after animation
        setTimeout(() => particle.remove(), 600);
    }
}
