// ============================================================
// bot.ts — Word-playing bot whose tempo and vocabulary scale with Elo.
// The bot has its own virtual "side game": it picks valid words from
// the dictionary and scores them, generating opponent score over time.
// ============================================================

import { getRandomWordOfLength } from './dictionary';
import { getLangConfig } from '../i18n';

export interface BotProfile {
  elo: number;
  tickMs: number;       // time between scoring attempts
  minLen: number;       // word length range
  maxLen: number;
  whiffChance: number;  // probability the tick yields no word (bot fumbled)
}

// Map Elo → playing profile. Tuned so that around Elo 1000 the bot scores
// ~30-50 pts/min, comparable to a relaxed human player.
export function profileFromElo(elo: number): BotProfile {
  const e = Math.max(400, Math.min(2400, elo));
  // Faster ticks at higher Elo
  const tickMs = Math.max(700, Math.round(6500 - (e - 400) * 2.5));
  // Longer words at higher Elo
  const minLen = Math.max(3, Math.min(7, Math.floor(3 + (e - 700) / 400)));
  const maxLen = Math.max(minLen + 1, Math.min(8, Math.floor(4 + (e - 700) / 250)));
  // Higher Elo bots whiff less often
  const whiffChance = Math.max(0.05, Math.min(0.55, 0.6 - (e - 400) / 4000));
  return { elo: e, tickMs, minLen, maxLen, whiffChance };
}

function scoreWord(word: string): number {
  const cfg = getLangConfig();
  let base = 0;
  for (const ch of word.toUpperCase()) base += cfg.letterPoints[ch] ?? 0;
  // Length bonus matches the player-facing scoring.ts curve
  const len = word.length;
  const mult = len >= 7 ? 1.5 : len >= 5 ? 1.25 : 1;
  return Math.round(base * mult);
}

export interface BotInstance {
  stop: () => void;
  getElo: () => number;
}

// Start a bot that calls onScore(points, word) at intervals dictated by Elo.
// The caller decides what to do with those scores (typically: add to opponent
// score in the engine and update UI).
export function startBot(elo: number, onScore: (points: number, word: string) => void): BotInstance {
  const profile = profileFromElo(elo);
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    if (Math.random() >= profile.whiffChance) {
      const word = getRandomWordOfLength(profile.minLen, profile.maxLen);
      if (word) onScore(scoreWord(word), word);
    }
    // Add a small jitter so the bot doesn't feel metronomic
    const jitter = profile.tickMs * (0.8 + Math.random() * 0.4);
    setTimeout(tick, jitter);
  };
  // First action after the initial tick delay
  setTimeout(tick, profile.tickMs);

  return {
    stop: () => { stopped = true; },
    getElo: () => profile.elo,
  };
}
