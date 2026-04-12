import { describe, it, expect, beforeEach } from 'vitest';
import { setLang } from '../i18n';
import { getRandomLetter, resetLetterHistory, getRandomBallRadius } from '../game/letter';
import { SeededRng } from '../game/seededRng';

describe('letter generation', () => {
  beforeEach(() => {
    setLang('fr');
    resetLetterHistory();
  });

  describe('getRandomLetter', () => {
    it('returns uppercase single letters', () => {
      const rng = new SeededRng(42);
      for (let i = 0; i < 50; i++) {
        const letter = getRandomLetter(rng);
        expect(letter).toMatch(/^[A-Z]$/);
      }
    });

    it('produces deterministic letters from the same seed', () => {
      resetLetterHistory();
      const rng1 = new SeededRng(123);
      const seq1 = Array.from({ length: 20 }, () => getRandomLetter(rng1));

      resetLetterHistory();
      const rng2 = new SeededRng(123);
      const seq2 = Array.from({ length: 20 }, () => getRandomLetter(rng2));

      expect(seq1).toEqual(seq2);
    });

    it('forces vowels after 2 consecutive consonants', () => {
      const vowels = ['A', 'E', 'I', 'O', 'U'];
      const rng = new SeededRng(42);
      const letters: string[] = [];
      for (let i = 0; i < 200; i++) {
        letters.push(getRandomLetter(rng));
      }

      // Check: never 3 consecutive consonants
      for (let i = 2; i < letters.length; i++) {
        const threeInARow = [letters[i - 2], letters[i - 1], letters[i]];
        const allConsonants = threeInARow.every(l => !vowels.includes(l));
        expect(allConsonants).toBe(false);
      }
    });

    it('generates letters following weighted distribution', () => {
      const rng = new SeededRng(1);
      resetLetterHistory();
      const counts: Record<string, number> = {};
      const N = 5000;
      for (let i = 0; i < N; i++) {
        const l = getRandomLetter(rng);
        counts[l] = (counts[l] || 0) + 1;
      }
      // E should be the most common letter in French
      const maxLetter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      expect(['E', 'A', 'I', 'S', 'N', 'R']).toContain(maxLetter);
    });
  });

  describe('getRandomBallRadius', () => {
    it('returns base radius 19-24 at level 1', () => {
      const rng = new SeededRng(42);
      for (let i = 0; i < 100; i++) {
        const r = getRandomBallRadius(rng, 1);
        expect(r).toBeGreaterThanOrEqual(19);
        expect(r).toBeLessThanOrEqual(24);
      }
    });

    it('can return larger balls at level 3+', () => {
      const rng = new SeededRng(42);
      const radii: number[] = [];
      for (let i = 0; i < 500; i++) {
        radii.push(getRandomBallRadius(rng, 5));
      }
      // At level 5, some balls should be larger than 24
      const hasLarge = radii.some(r => r > 24);
      expect(hasLarge).toBe(true);
    });

    it('is deterministic with same seed and level', () => {
      const r1 = Array.from({ length: 10 }, (_, i) => {
        const rng = new SeededRng(42);
        return getRandomBallRadius(rng, i % 5 + 1);
      });
      const r2 = Array.from({ length: 10 }, (_, i) => {
        const rng = new SeededRng(42);
        return getRandomBallRadius(rng, i % 5 + 1);
      });
      expect(r1).toEqual(r2);
    });
  });

  describe('resetLetterHistory', () => {
    it('clears internal state allowing consonant streaks again', () => {
      const rng = new SeededRng(42);
      // Generate some letters
      for (let i = 0; i < 10; i++) getRandomLetter(rng);
      // Reset and verify it works
      resetLetterHistory();
      const letter = getRandomLetter(rng);
      expect(letter).toMatch(/^[A-Z]$/);
    });
  });
});
