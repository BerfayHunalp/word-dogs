import { getRandomLetter, createFallingLetter, resetLetterHistory } from './letter.js';
import { initBucket, addLetter, getColumns, removeCells, isOverflow, getCurrentRows, getMaxRows } from './bucket.js';
import { initInput, destroyInput, clearSelection } from './input.js';
import { isWord } from './dictionary.js';
import { scoreWord } from './scoring.js';

let score = 0;
let level = 1;
let wordsFound = 0;
let bestWord = { word: '', score: 0 };
let dropInterval = null;
let isPaused = false;
let isGameActive = false;

// Callbacks
let onGameOver = null;
let onScoreUpdate = null;

// DOM refs
let fallZone = null;
let scoreEl = null;
let levelEl = null;
let floatContainer = null;

export function initGame(callbacks) {
    onGameOver = callbacks.onGameOver;
    onScoreUpdate = callbacks.onScoreUpdate;
    fallZone = document.getElementById('fall-zone');
    scoreEl = document.getElementById('current-score');
    levelEl = document.getElementById('current-level');
    floatContainer = document.getElementById('float-scores');
}

export function startGame() {
    score = 0;
    level = 1;
    wordsFound = 0;
    bestWord = { word: '', score: 0 };
    isPaused = false;
    isGameActive = true;

    resetLetterHistory();
    initBucket();
    initInput(onWordAttempt);
    updateScoreDisplay();

    // Clear fall zone
    fallZone.innerHTML = '';

    // Start dropping letters
    scheduleNextDrop();
}

export function stopGame() {
    isGameActive = false;
    isPaused = false;
    if (dropInterval) {
        clearTimeout(dropInterval);
        dropInterval = null;
    }
    destroyInput();
}

function getDifficulty() {
    const lvl = Math.floor(score / 50);
    return {
        dropInterval: Math.max(500, 1500 - lvl * 100),
        fallDuration: Math.max(800, 2000 - lvl * 120),
    };
}

function scheduleNextDrop() {
    if (!isGameActive || isPaused) return;
    const diff = getDifficulty();
    dropInterval = setTimeout(() => {
        dropLetter();
        scheduleNextDrop();
    }, diff.dropInterval);
}

function dropLetter() {
    if (!isGameActive || isPaused) return;

    const letter = getRandomLetter();
    const columns = getColumns();
    const targetCol = Math.floor(Math.random() * columns);
    const diff = getDifficulty();

    const fallingEl = createFallingLetter(letter, fallZone, targetCol, columns, diff.fallDuration);

    // When fall animation ends, add to bucket
    const onTransitionEnd = () => {
        fallingEl.removeEventListener('transitionend', onTransitionEnd);
        fallingEl.remove();

        if (!isGameActive) return;

        const success = addLetter(letter, targetCol);
        if (!success || isOverflow()) {
            triggerGameOver();
            return;
        }

        // Update level
        const newLevel = Math.floor(score / 50) + 1;
        if (newLevel !== level) {
            level = newLevel;
            updateScoreDisplay();
        }
    };

    fallingEl.addEventListener('transitionend', onTransitionEnd);
}

function onWordAttempt(word, path) {
    if (!isGameActive) return;

    const normalizedWord = word.toLowerCase();

    if (normalizedWord.length < 2) {
        shakeLetters(path);
        return;
    }

    if (isWord(normalizedWord)) {
        // Valid word!
        const points = scoreWord(normalizedWord);
        score += points;
        wordsFound++;

        if (points > bestWord.score) {
            bestWord = { word: normalizedWord, score: points };
        }

        // Get position for float score (use first letter position)
        const firstEl = path[0].element;
        const rect = firstEl.getBoundingClientRect();
        const containerRect = floatContainer.getBoundingClientRect();
        const x = rect.left - containerRect.left + rect.width / 2;
        const y = rect.top - containerRect.top;

        showFloatScore(points, normalizedWord, x, y);

        // Remove cells from bucket
        const cells = path.map(p => ({
            row: p.row,
            col: p.col,
            letter: p.letter,
            element: p.element
        }));

        // Pause drops briefly as reward
        isPaused = true;
        clearTimeout(dropInterval);

        removeCells(cells).then(() => {
            updateScoreDisplay();
            // Resume drops after reward pause
            setTimeout(() => {
                isPaused = false;
                scheduleNextDrop();
            }, 500);
        });
    } else {
        // Invalid word
        shakeLetters(path);
    }
}

function shakeLetters(path) {
    for (const p of path) {
        p.element.classList.add('shake', 'invalid');
        p.element.addEventListener('animationend', () => {
            p.element.classList.remove('shake', 'invalid');
        }, { once: true });
    }
}

function showFloatScore(points, word, x, y) {
    // Show points
    const scoreFloat = document.createElement('div');
    scoreFloat.classList.add('float-score');
    scoreFloat.textContent = `+${points}`;
    scoreFloat.style.left = `${x}px`;
    scoreFloat.style.top = `${y}px`;
    floatContainer.appendChild(scoreFloat);

    // Show word
    const wordFloat = document.createElement('div');
    wordFloat.classList.add('float-word');
    wordFloat.textContent = word;
    wordFloat.style.left = `${x}px`;
    wordFloat.style.top = `${y - 30}px`;
    floatContainer.appendChild(wordFloat);

    // Clean up after animation
    setTimeout(() => {
        scoreFloat.remove();
        wordFloat.remove();
    }, 1200);
}

function updateScoreDisplay() {
    if (scoreEl) scoreEl.textContent = score;
    if (levelEl) levelEl.textContent = level;
    if (onScoreUpdate) onScoreUpdate(score, level);
}

function triggerGameOver() {
    isGameActive = false;
    if (dropInterval) {
        clearTimeout(dropInterval);
        dropInterval = null;
    }
    destroyInput();

    // Save high score
    const highScore = getHighScore();
    if (score > highScore) {
        setHighScore(score);
    }

    if (onGameOver) {
        onGameOver({
            score,
            highScore: Math.max(score, highScore),
            wordsFound,
            bestWord: bestWord.word || '-'
        });
    }
}

export function getHighScore() {
    return parseInt(localStorage.getItem('wardogs_highscore') || '0', 10);
}

export function setHighScore(val) {
    localStorage.setItem('wardogs_highscore', String(val));
}

export function getStats() {
    return { score, level, wordsFound, bestWord };
}
