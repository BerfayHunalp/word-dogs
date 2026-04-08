// ============================================================
// letter.js — Letter generation with French frequency weighting
//
// UPDATE: Removed DOM element creation (now done on canvas).
// Added getRandomBallRadius() for physics ball sizes.
// Letter frequency logic unchanged — still French-weighted.
// ============================================================

// French letter frequencies (weights out of ~10000)
// Source: French text corpus frequency analysis
const LETTER_WEIGHTS = {
    E: 1210, A: 711, I: 659, S: 651, N: 639, R: 607, T: 592,
    O: 502, L: 496, U: 449, D: 367, C: 318, M: 262, P: 249,
    G: 123, B: 114, V: 111, H: 111, F: 111, Q: 65,
    Y: 46, X: 38, J: 34, K: 29, W: 17, Z: 15
};

const VOWELS = ['A', 'E', 'I', 'O', 'U'];

// Pre-compute cumulative distribution for weighted random selection
const letters = Object.keys(LETTER_WEIGHTS);
const totalWeight = Object.values(LETTER_WEIGHTS).reduce((a, b) => a + b, 0);
const cumulative = [];
let sum = 0;
for (const l of letters) {
    sum += LETTER_WEIGHTS[l];
    cumulative.push({ letter: l, threshold: sum / totalWeight });
}

// Vowel-only distribution (used when forcing a vowel after consonant streak)
const vowelWeights = VOWELS.map(v => ({ letter: v, weight: LETTER_WEIGHTS[v] }));
const vowelTotal = vowelWeights.reduce((a, b) => a + b.weight, 0);
const vowelCumulative = [];
let vSum = 0;
for (const v of vowelWeights) {
    vSum += v.weight;
    vowelCumulative.push({ letter: v.letter, threshold: vSum / vowelTotal });
}

// Track recent letters to prevent frustrating consonant floods
// "I have a lot of money, so I bought this hat." — Handsome Jack
let recentLetters = [];
const MAX_CONSONANT_STREAK = 2; // Force a vowel after 2 consecutive consonants

function pickFromDist(dist) {
    const r = Math.random();
    for (const entry of dist) {
        if (r <= entry.threshold) return entry.letter;
    }
    return dist[dist.length - 1].letter;
}

// Get a random letter, weighted by French frequency
// Prevents long consonant streaks (frustrating for word building)
export function getRandomLetter() {
    const recentConsonants = recentLetters.slice(-MAX_CONSONANT_STREAK);
    const needVowel = recentConsonants.length >= MAX_CONSONANT_STREAK &&
        recentConsonants.every(l => !VOWELS.includes(l));

    const letter = needVowel ? pickFromDist(vowelCumulative) : pickFromDist(cumulative);

    recentLetters.push(letter);
    if (recentLetters.length > 10) recentLetters.shift();

    return letter;
}

// Reset on game start
export function resetLetterHistory() {
    recentLetters = [];
}

// NEW: Generate a random ball radius for the physics engine
// Base size varies slightly (19-24px). Higher levels occasionally
// spawn larger balls (24-35px) to increase difficulty via physics
// pressure — bigger balls take more space in the bucket.
export function getRandomBallRadius(level) {
    const base = 19 + Math.random() * 5; // 19-24px base

    // Higher levels: growing chance of larger balls
    if (level >= 3 && Math.random() < Math.min(0.2, 0.04 * (level - 2))) {
        return base + 5 + Math.random() * 6; // 24-35px larger ball
    }

    return base;
}
