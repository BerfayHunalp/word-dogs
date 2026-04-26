// ============================================================
// bot.ts — Word-playing bot whose strength is set by two simple knobs:
//   1. how often it plays (max words per second, derived from Elo)
//   2. how big its vocabulary is (random sample of the full dictionary)
// ============================================================

import { sampleWords } from './dictionary';
import { getLangConfig } from '../i18n';

export interface BotProfile {
  elo: number;
  tickMs: number;       // mean time between scoring attempts
  vocabSize: number;    // size of the bot's dictionary subset
}

// Map Elo → profile. Elo 400 ≈ 1 word per 10s, vocab ~30 words.
// Elo 2400 ≈ 1 word per second, vocab ~50k (effectively the full dict).
export function profileFromElo(elo: number): BotProfile {
  const e = Math.max(400, Math.min(2400, elo));
  const t = (e - 400) / 2000; // 0..1

  // Linear from 10000ms (1 / 10s) at 400 → 1000ms (1/s) at 2400.
  const tickMs = Math.round(10000 - t * 9000);

  // Exponential vocab so a few hundred Elo unlocks a meaningful jump.
  // 30 words at 400 → ~50000 at 2400.
  const vocabSize = Math.round(30 * Math.pow(50000 / 30, t));

  return { elo: e, tickMs, vocabSize };
}

function scoreWord(word: string): number {
  const cfg = getLangConfig();
  let base = 0;
  for (const ch of word.toUpperCase()) base += cfg.letterPoints[ch] ?? 0;
  const len = word.length;
  const mult = len >= 7 ? 1.5 : len >= 5 ? 1.25 : 1;
  return Math.round(base * mult);
}

export interface BotInstance {
  stop: () => void;
  getElo: () => number;
  getVocabSize: () => number;
}

// Start a bot. The vocabulary is sampled once at start and the bot only ever
// plays words from that subset, so its strength is shaped by `vocabSize`.
export function startBot(elo: number, onScore: (points: number, word: string) => void): BotInstance {
  const profile = profileFromElo(elo);
  const vocab = sampleWords(profile.vocabSize);
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    if (vocab.length > 0) {
      const word = vocab[Math.floor(Math.random() * vocab.length)];
      onScore(scoreWord(word), word);
    }
    // Slight jitter so the rate is the *mean*, not metronomic.
    const jitter = profile.tickMs * (0.7 + Math.random() * 0.6);
    setTimeout(tick, jitter);
  };
  setTimeout(tick, profile.tickMs);

  return {
    stop: () => { stopped = true; },
    getElo: () => profile.elo,
    getVocabSize: () => vocab.length,
  };
}
