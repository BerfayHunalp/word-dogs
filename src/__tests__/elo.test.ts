import { describe, it, expect, beforeEach } from 'vitest';
import { getElo, setElo, updateEloFromMatch } from '../game/elo';

describe('elo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 1000 by default', () => {
    expect(getElo()).toBe(1000);
  });

  it('persists set value', () => {
    setElo(1234);
    expect(getElo()).toBe(1234);
  });

  it('clamps to [400, 2400]', () => {
    setElo(99);
    expect(getElo()).toBe(400);
    setElo(9999);
    expect(getElo()).toBe(2400);
  });

  it('rises on a clear win against equal-Elo bot', () => {
    setElo(1000);
    const result = updateEloFromMatch(500, 100, 1000);
    expect(result.delta).toBeGreaterThan(0);
    expect(getElo()).toBeGreaterThan(1000);
  });

  it('falls on a clear loss against equal-Elo bot', () => {
    setElo(1000);
    const result = updateEloFromMatch(50, 400, 1000);
    expect(result.delta).toBeLessThan(0);
    expect(getElo()).toBeLessThan(1000);
  });

  it('barely moves on tie', () => {
    setElo(1000);
    const result = updateEloFromMatch(200, 200, 1000);
    expect(Math.abs(result.delta)).toBeLessThan(5);
  });

  it('rewards beating a higher-rated bot more than an equal one', () => {
    setElo(1000);
    updateEloFromMatch(500, 100, 1500);
    const afterUpset = getElo();
    setElo(1000);
    updateEloFromMatch(500, 100, 1000);
    const afterEven = getElo();
    expect(afterUpset).toBeGreaterThan(afterEven);
  });
});
