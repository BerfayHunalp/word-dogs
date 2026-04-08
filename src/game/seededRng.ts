// ============================================================
// seededRng.ts — Deterministic seeded PRNG (mulberry32)
// Used for: replay system, mirrored letter streams in multiplayer
// "The loot is ALWAYS predetermined. Always." — Marcus Kincaid
// ============================================================

export class SeededRng {
  private state: number;
  readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.state = this.seed;
  }

  // Returns a float in [0, 1) — drop-in replacement for Math.random()
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Random int in [min, max)
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  // Random float in [min, max)
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Clone with same state (for branching)
  clone(): SeededRng {
    const copy = new SeededRng(this.seed);
    copy.state = this.state;
    return copy;
  }
}
