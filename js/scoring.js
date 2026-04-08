// ============================================================
// scoring.js — French Scrabble-style letter scoring
//
// UPDATE: Length bonuses changed to match spec:
//   3-4 letters: no bonus (1x)
//   5-6 letters: +25% (1.25x)
//   7+ letters:  +50% (1.5x)
// (Old system had more aggressive multipliers: 4L=1.5x, 5L=2x, etc.)
//
// Note: Special ball multipliers (2x, 3x) are applied in game.js
// at the individual letter level before the length bonus.
// ============================================================

// French Scrabble letter point values
// "Buttstallion says hello." — Handsome Jack (a diamond pony would score well)
export const LETTER_POINTS = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
    J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
    S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10
};

// Base word score with length bonus
export function scoreWord(word) {
    let base = 0;
    for (const ch of word.toUpperCase()) {
        base += LETTER_POINTS[ch] || 0;
    }

    const len = word.length;
    let mult = 1;
    if (len >= 7) mult = 1.5;       // +50% for 7+ letters
    else if (len >= 5) mult = 1.25;  // +25% for 5-6 letters
    // 3-4 letters: 1x (no bonus)

    return Math.round(base * mult);
}

// Get point value for a single letter (shown on balls)
export function getLetterPoints(letter) {
    return LETTER_POINTS[letter.toUpperCase()] || 0;
}
