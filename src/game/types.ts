// ============================================================
// types.ts — Shared types for the game engine
// "I'm the conductor of the poop train!" — Psycho (shared types are the rails)
// ============================================================

import type Matter from 'matter-js';

export interface Ball {
  id: number;
  body: Matter.Body;
  letter: string;
  radius: number;
  special: SpecialType;
  popping: number;
  powerUp: PowerUpType;
  wildcard?: boolean;
  // Epoch ms — ball is "shiny" while now < glowEndsAt; popping during glow boosts score.
  glowEndsAt?: number;
}

export type SpecialType = null | '2x' | '3x';
export type PowerUpType = null | 'slow' | 'remove' | 'double' | 'bomb';
export type Difficulty = 'egoFriendly' | 'easy' | 'normal' | 'hard';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number; y: number;
  text: string;
  color: string;
  size: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface BucketGeometry {
  topY: number;
  bottomY: number;
  leftTop: number;
  rightTop: number;
  leftBottom: number;
  rightBottom: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  wordsFound: number;
  bestWord: string;
  combo: number;
  maxCombo: number;
}

export interface GameCallbacks {
  onGameOver: (stats: GameStats) => void;
  onScoreUpdate: (score: number, level: number) => void;
  onGaugeUpdate?: (gauge: number, max: number) => void;
}

export interface InputConfig {
  canvas: HTMLCanvasElement;
  getBalls: () => Ball[];
  areTouching: (a: Ball, b: Ball) => boolean;
  onWordSubmit: (word: string, path: Ball[], player: 1 | 2) => void;
  wordDisplay: HTMLElement | null;
  isValidPrefix: (s: string) => boolean;
  multiTouch?: boolean;
}

// Multiplayer
export interface MultiplayerState {
  roomId: string;
  playerId: string;
  opponentName: string;
  opponentScore: number;
  opponentLevel: number;
  connected: boolean;
}

export interface InterferenceEffect {
  type: 'bigBall' | 'speedUp' | 'scramble';
  duration: number;
  timestamp: number;
}

// Replay
export interface ReplayFrame {
  time: number;
  action: 'spawn' | 'word' | 'powerup';
  data: unknown;
}

export interface ReplayData {
  seed: number;
  language: string;
  frames: ReplayFrame[];
  finalStats: GameStats;
}

// Language config
export interface LanguageConfig {
  code: string;
  name: string;
  letterWeights: Record<string, number>;
  letterPoints: Record<string, number>;
  vowels: string[];
  dictionaryUrl: string;
  localDictPath: string;
}
