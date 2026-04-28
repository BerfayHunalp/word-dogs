// ============================================================
// elo.ts — Hidden per-player Elo rating used to calibrate bot strength.
// Rating is never shown in the UI; it only steers AI difficulty.
// ============================================================

import type { Difficulty } from './types';

const KEY = 'wardogs_elo';
const DEFAULT_ELO = 1000;
const MIN_ELO = 400;
const MAX_ELO = 2400;
const K_FACTOR = 32;

export function getElo(): number {
  const raw = localStorage.getItem(KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n)) return clamp(n);
  return DEFAULT_ELO;
}

function clamp(n: number) {
  return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(n)));
}

export function setElo(value: number) {
  localStorage.setItem(KEY, String(clamp(value)));
}

// Standard Elo expected score against an opponent at `oppElo`.
function expected(playerElo: number, oppElo: number): number {
  return 1 / (1 + Math.pow(10, (oppElo - playerElo) / 400));
}

// Convert a head-to-head match result (player vs bot scores) into Elo delta.
// If scores tie, count as a 0.5 actual.
// Map current Elo → Difficulty bucket. Default Elo (1000) lands in 'normal'.
export function difficultyFromElo(elo: number = getElo()): Difficulty {
  if (elo < 700) return 'egoFriendly';
  if (elo < 1000) return 'easy';
  if (elo < 1400) return 'normal';
  return 'hard';
}

export function updateEloFromMatch(playerScore: number, botScore: number, botElo: number): { before: number; after: number; delta: number } {
  const before = getElo();
  const total = playerScore + botScore;
  // Actual is share of total points (smoothed so a single big word doesn't fully decide).
  // Pure win/loss: actual = playerScore > botScore ? 1 : playerScore < botScore ? 0 : 0.5
  // We blend share-of-points with win/loss to react sensibly to close games.
  const share = total > 0 ? playerScore / total : 0.5;
  const winLoss = playerScore > botScore ? 1 : playerScore < botScore ? 0 : 0.5;
  const actual = 0.5 * share + 0.5 * winLoss;
  const exp = expected(before, botElo);
  const after = clamp(before + K_FACTOR * (actual - exp));
  setElo(after);
  return { before, after, delta: after - before };
}
