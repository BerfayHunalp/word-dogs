// ============================================================
// scoring.ts — Scrabble-style scoring with combos and power-ups
// "Buttstallion says hello." — Handsome Jack
// ============================================================

import { getLangConfig } from '../i18n';
import type { Ball } from './types';

export function getLetterPoints(letter: string): number {
  const config = getLangConfig();
  return config.letterPoints[letter.toUpperCase()] || 0;
}

// Calculate word score: letter values + special multipliers + length bonus + combo bonus
export function calculateWordScore(path: Ball[], comboCount: number): number {
  let base = 0;
  let hasDoublePowerUp = false;

  for (const ball of path) {
    // Wildcards score 0 (Scrabble blank rule)
    let pts = ball.wildcard ? 0 : getLetterPoints(ball.letter);
    if (ball.special === '2x') pts *= 2;
    else if (ball.special === '3x') pts *= 3;
    if (ball.powerUp === 'double') hasDoublePowerUp = true;
    base += pts;
  }

  // Length bonus: 3-4=1x, 5-6=1.25x, 7+=1.5x
  const len = path.length;
  let mult = 1;
  if (len >= 7) mult = 1.5;
  else if (len >= 5) mult = 1.25;

  // Combo bonus: +10% per consecutive word
  const comboMult = 1 + comboCount * 0.1;

  // Double power-up: 2x final score
  const powerMult = hasDoublePowerUp ? 2 : 1;

  return Math.round(base * mult * comboMult * powerMult);
}
