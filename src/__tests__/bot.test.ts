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

  it('produces a larger vocabulary at higher Elo', () => {
    const low = profileFromElo(600);
    const high = profileFromElo(2200);
    expect(high.vocabSize).toBeGreaterThan(low.vocabSize);
  });

  it('clamps absurd Elo inputs into the valid range', () => {
    const tinyElo = profileFromElo(-500);
    const hugeElo = profileFromElo(99999);
    expect(tinyElo.elo).toBeGreaterThanOrEqual(400);
    expect(hugeElo.elo).toBeLessThanOrEqual(2400);
  });

  it('keeps tick around 10 seconds at the lowest Elo', () => {
    const low = profileFromElo(400);
    expect(low.tickMs).toBeGreaterThanOrEqual(8000);
    expect(low.tickMs).toBeLessThanOrEqual(11000);
  });

  it('keeps tick around 1 second at the highest Elo', () => {
    const high = profileFromElo(2400);
    expect(high.tickMs).toBeLessThanOrEqual(1500);
  });

  it('keeps the vocabulary tiny at the lowest Elo', () => {
    const low = profileFromElo(400);
    expect(low.vocabSize).toBeLessThan(50);
  });
});
