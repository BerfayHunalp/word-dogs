import { describe, it, expect } from 'vitest';
import { SeededRng } from '../game/seededRng';

describe('SeededRng', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces values in [0, 1)', () => {
    const rng = new SeededRng(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRng(1);
    const b = new SeededRng(2);
    const aVals = Array.from({ length: 10 }, () => a.next());
    const bVals = Array.from({ length: 10 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('generates a random seed when none is provided', () => {
    const a = new SeededRng();
    const b = new SeededRng();
    // Seeds should (almost certainly) differ
    expect(a.seed).not.toBe(b.seed);
  });

  it('stores the seed as a readonly property', () => {
    const rng = new SeededRng(999);
    expect(rng.seed).toBe(999);
  });

  describe('nextInt', () => {
    it('produces integers in [min, max)', () => {
      const rng = new SeededRng(50);
      for (let i = 0; i < 500; i++) {
        const v = rng.nextInt(5, 10);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThan(10);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('handles single-value range', () => {
      const rng = new SeededRng(1);
      for (let i = 0; i < 20; i++) {
        expect(rng.nextInt(7, 8)).toBe(7);
      }
    });
  });

  describe('nextFloat', () => {
    it('produces floats in [min, max)', () => {
      const rng = new SeededRng(77);
      for (let i = 0; i < 500; i++) {
        const v = rng.nextFloat(2.5, 7.5);
        expect(v).toBeGreaterThanOrEqual(2.5);
        expect(v).toBeLessThan(7.5);
      }
    });
  });

  describe('clone', () => {
    it('creates an independent copy with the same state', () => {
      const rng = new SeededRng(42);
      // Advance the state
      rng.next(); rng.next(); rng.next();
      const cloned = rng.clone();

      // Both should produce the same sequence from here
      const origVals = Array.from({ length: 10 }, () => rng.next());
      const cloneVals = Array.from({ length: 10 }, () => cloned.next());
      expect(origVals).toEqual(cloneVals);
    });

    it('does not affect the original when mutated', () => {
      const rng = new SeededRng(42);
      const cloned = rng.clone();
      // Advance clone
      for (let i = 0; i < 100; i++) cloned.next();
      // Original should still produce the original sequence
      const fresh = new SeededRng(42);
      expect(rng.next()).toBe(fresh.next());
    });
  });

  it('known snapshot: seed 42 first 5 values', () => {
    const rng = new SeededRng(42);
    const values = Array.from({ length: 5 }, () => rng.next());
    // Snapshot — if the algorithm changes, this test catches it
    expect(values).toMatchSnapshot();
  });
});
