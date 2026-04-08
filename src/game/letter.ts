// ============================================================
// letter.ts — Letter generation with seeded PRNG + language support
// "I have a lot of money, so I bought this hat." — Handsome Jack
// ============================================================

import { getLangConfig } from '../i18n';
import type { SeededRng } from './seededRng';

let recentLetters: string[] = [];
const MAX_CONSONANT_STREAK = 2;

// Pre-compute cumulative distribution for a weight map
function buildCumulative(weights: Record<string, number>, filter?: string[]) {
  const entries = filter
    ? filter.map(l => ({ letter: l, weight: weights[l] || 0 }))
    : Object.entries(weights).map(([letter, weight]) => ({ letter, weight }));

  const total = entries.reduce((s, e) => s + e.weight, 0);
  const result: { letter: string; threshold: number }[] = [];
  let sum = 0;
  for (const e of entries) {
    sum += e.weight;
    result.push({ letter: e.letter, threshold: sum / total });
  }
  return result;
}

function pickFromDist(dist: { letter: string; threshold: number }[], rng: SeededRng) {
  const r = rng.next();
  for (const entry of dist) {
    if (r <= entry.threshold) return entry.letter;
  }
  return dist[dist.length - 1].letter;
}

export function getRandomLetter(rng: SeededRng): string {
  const config = getLangConfig();
  const { letterWeights, vowels } = config;

  const recentConsonants = recentLetters.slice(-MAX_CONSONANT_STREAK);
  const needVowel = recentConsonants.length >= MAX_CONSONANT_STREAK &&
    recentConsonants.every(l => !vowels.includes(l));

  const dist = needVowel
    ? buildCumulative(letterWeights, vowels)
    : buildCumulative(letterWeights);

  const letter = pickFromDist(dist, rng);
  recentLetters.push(letter);
  if (recentLetters.length > 10) recentLetters.shift();
  return letter;
}

export function resetLetterHistory() {
  recentLetters = [];
}

// Ball radius varies; higher levels spawn occasional larger balls
export function getRandomBallRadius(rng: SeededRng, level: number): number {
  const base = 19 + rng.next() * 5; // 19-24px
  if (level >= 3 && rng.next() < Math.min(0.2, 0.04 * (level - 2))) {
    return base + 5 + rng.next() * 6; // 24-35px
  }
  return base;
}
