import { describe, it, expect } from 'vitest';
import { profileFromElo } from '../game/bot';

describe('bot.profileFromElo', () => {
  it('produces faster ticks at higher Elo', () => {
    const low = profileFromElo(600);
    const mid = profileFromElo(1200);
    const high = profileFromElo(2000);
    expect(low.tickMs).toBeGreaterThan(mid.tickMs);
    expect(mid.tickMs).toBeGreaterThan(high.tickMs);
  });

  it('produces longer max word length at higher Elo', () => {
    const low = profileFromElo(600);
    const high = profileFromElo(2000);
    expect(high.maxLen).toBeGreaterThanOrEqual(low.maxLen);
  });

  it('clamps absurd Elo inputs into the valid range', () => {
    const tinyElo = profileFromElo(-500);
    const hugeElo = profileFromElo(99999);
    expect(tinyElo.elo).toBeGreaterThanOrEqual(400);
    expect(hugeElo.elo).toBeLessThanOrEqual(2400);
  });

  it('keeps minLen <= maxLen for any sane Elo', () => {
    for (const elo of [400, 800, 1200, 1600, 2000, 2400]) {
      const p = profileFromElo(elo);
      expect(p.minLen).toBeLessThanOrEqual(p.maxLen);
      expect(p.minLen).toBeGreaterThanOrEqual(3);
      expect(p.maxLen).toBeLessThanOrEqual(8);
    }
  });

  it('whiff chance decreases with rising Elo', () => {
    const low = profileFromElo(500);
    const high = profileFromElo(2200);
    expect(high.whiffChance).toBeLessThan(low.whiffChance);
  });
});
