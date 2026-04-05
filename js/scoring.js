// French Scrabble letter point values
export const LETTER_POINTS = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
    J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
    S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10
};

// Length multipliers
const LENGTH_MULTIPLIER = {
    2: 1,
    3: 1,
    4: 1.5,
    5: 2,
    6: 2.5,
    7: 3,
    8: 4
};

export function scoreWord(word) {
    let base = 0;
    for (const ch of word.toUpperCase()) {
        base += LETTER_POINTS[ch] || 0;
    }
    const mult = LENGTH_MULTIPLIER[word.length] || 5;
    return Math.round(base * mult);
}

export function getLetterPoints(letter) {
    return LETTER_POINTS[letter.toUpperCase()] || 0;
}
