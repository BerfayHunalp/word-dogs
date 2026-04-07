import { getLetterPoints } from './scoring.js';

// French letter frequencies (weights out of ~10000)
const LETTER_WEIGHTS = {
    E: 1210, A: 711, I: 659, S: 651, N: 639, R: 607, T: 592,
    O: 502, L: 496, U: 449, D: 367, C: 318, M: 262, P: 249,
    G: 123, B: 114, V: 111, H: 111, F: 111, Q: 65,
    Y: 46, X: 38, J: 34, K: 29, W: 17, Z: 15
};

const VOWELS = ['A', 'E', 'I', 'O', 'U'];
const CONSONANTS = Object.keys(LETTER_WEIGHTS).filter(l => !VOWELS.includes(l));

// Build cumulative distribution
const letters = Object.keys(LETTER_WEIGHTS);
const totalWeight = Object.values(LETTER_WEIGHTS).reduce((a, b) => a + b, 0);
const cumulative = [];
let sum = 0;
for (const l of letters) {
    sum += LETTER_WEIGHTS[l];
    cumulative.push({ letter: l, threshold: sum / totalWeight });
}

// Vowel-only distribution
const vowelWeights = VOWELS.map(v => ({ letter: v, weight: LETTER_WEIGHTS[v] }));
const vowelTotal = vowelWeights.reduce((a, b) => a + b.weight, 0);
const vowelCumulative = [];
let vSum = 0;
for (const v of vowelWeights) {
    vSum += v.weight;
    vowelCumulative.push({ letter: v.letter, threshold: vSum / vowelTotal });
}

let recentLetters = [];
const MAX_CONSONANT_STREAK = 2;

function pickFromDist(dist) {
    const r = Math.random();
    for (const entry of dist) {
        if (r <= entry.threshold) return entry.letter;
    }
    return dist[dist.length - 1].letter;
}

export function getRandomLetter() {
    // Check consonant streak — force vowel if needed
    const recentConsonants = recentLetters.slice(-MAX_CONSONANT_STREAK);
    const needVowel = recentConsonants.length >= MAX_CONSONANT_STREAK &&
        recentConsonants.every(l => !VOWELS.includes(l));

    let letter;
    if (needVowel) {
        letter = pickFromDist(vowelCumulative);
    } else {
        letter = pickFromDist(cumulative);
    }

    recentLetters.push(letter);
    if (recentLetters.length > 10) recentLetters.shift();

    return letter;
}

export function resetLetterHistory() {
    recentLetters = [];
}

// Generate a random organic shape for a letter tile
export function generateRandomShape() {
    const r = () => Math.floor(15 + Math.random() * 50); // 15%-64%
    const borderRadius = `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
    const rotation = Math.random() * 36 - 18; // -18° to +18°
    const size = 36 + Math.floor(Math.random() * 20); // 36-55px
    const wobbleSpeed = 0.8 + Math.random() * 1.4; // 0.8-2.2s
    return { borderRadius, rotation, size, wobbleSpeed };
}

// Create a falling letter DOM element
export function createFallingLetter(letter, fallZone, targetCol, columns, fallDuration, shape) {
    const el = document.createElement('div');
    el.classList.add('falling-letter');
    el.textContent = letter;

    // Apply random shape
    const letterSize = shape ? shape.size : 46;
    if (shape) {
        el.style.borderRadius = shape.borderRadius;
        el.style.rotate = `${shape.rotation}deg`;
        el.style.width = `${letterSize}px`;
        el.style.height = `${letterSize}px`;
        el.style.animationDuration = `${shape.wobbleSpeed}s`;
    }

    // Position horizontally based on target column
    const zoneWidth = fallZone.clientWidth;
    const colWidth = zoneWidth / columns;
    const x = targetCol * colWidth + (colWidth - letterSize) / 2;
    el.style.left = `${x}px`;
    el.style.top = `${-(letterSize + 6)}px`;
    el.style.transitionDuration = `${fallDuration}ms`;

    fallZone.appendChild(el);

    // Trigger fall animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.top = `${fallZone.clientHeight - letterSize - 4}px`;
        });
    });

    return el;
}

// Create a grid letter DOM element
export function createGridLetterElement(letter, shape) {
    const el = document.createElement('div');
    el.classList.add('grid-letter');
    el.dataset.letter = letter;

    // Apply random shape
    if (shape) {
        el.style.borderRadius = shape.borderRadius;
        el.style.rotate = `${shape.rotation}deg`;
    }

    const span = document.createElement('span');
    span.textContent = letter;
    el.appendChild(span);

    const pts = document.createElement('span');
    pts.classList.add('letter-points');
    pts.textContent = getLetterPoints(letter);
    el.appendChild(pts);

    // Landing animation
    el.classList.add('landing');
    el.addEventListener('animationend', () => {
        el.classList.remove('landing');
    }, { once: true });

    return el;
}
