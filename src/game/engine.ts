// ============================================================
// engine.ts — Physics game engine with combos, power-ups, slow-mo
// "NOTHING IS MORE BADASS THAN TREATING A WOMAN WITH RESPECT!" — Mr. Torgue
// ============================================================

import Matter from 'matter-js';
import { getRandomLetter, resetLetterHistory, getRandomBallRadius } from './letter';
import { initInput, destroyInput, getSelectedPath, clearSelection } from './input';
import { isWord, isValidPrefix } from './dictionary';
import { getLetterPoints, calculateWordScore } from './scoring';
import { SeededRng } from './seededRng';
import { getLangConfig } from '../i18n';
import type {
  Ball, BucketGeometry, GameCallbacks, GameStats,
  Particle, FloatingText, PowerUpType, ReplayFrame, ReplayData,
  InterferenceEffect,
} from './types';

const { Engine, Bodies, Composite, Vector } = Matter;

// ===================== CONSTANTS =====================

const GRAVITY = 1.8;
const BALL_FRICTION = 0.4;
const BALL_RESTITUTION = 0.08;
const BALL_DENSITY = 0.004;
const BALL_AIR_FRICTION = 0.015;
const BALL_STATIC_FRICTION = 0.6;
const WALL_FRICTION = 0.3;
const WALL_RESTITUTION = 0.05;
const WALL_THICKNESS = 20;

const COLORS = {
  bg: '#0a0a0f',
  bucketFillTop: '#1a0d04', bucketFillMid: '#2a1508',
  bucketWood: '#4a2a12', bucketWoodLight: '#6b3d1e',
  bucketRim: '#DAA520', bucketRimShadow: '#8B6914',
  ballLight: '#3d5a80', ballDark: '#1a2332', ballBorder: '#405570',
  selectedGlow: '#f59e0b', selectedFill: '#78350f', selectedLight: '#a67c2e',
  special2x: '#3b82f6', special2xDark: '#1e3a5f',
  special3x: '#a855f7', special3xDark: '#3b1f6e',
  powerSlow: '#22d3ee', powerRemove: '#f43f5e', powerDouble: '#facc15', powerBomb: '#ff6b35',
  text: '#e2e8f0', textDim: '#64748b', accent: '#f59e0b',
  danger: '#ef4444', success: '#22c55e',
  pathLine: 'rgba(245, 158, 11, 0.5)',
  comboGold: '#ffd700',
};

// ===================== STATE =====================

let engine: Matter.Engine | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animFrame: number | null = null;
let rng: SeededRng;

let gameActive = false;
let score = 0;
let level = 1;
let wordsFound = 0;
let bestWord = { word: '', score: 0 };
let spawnTimer: ReturnType<typeof setTimeout> | null = null;
let spawnPaused = false;
let lastTime = 0;

// Combo system: consecutive valid words within a time window
let comboCount = 0;
let comboTimer: ReturnType<typeof setTimeout> | null = null;
let maxCombo = 0;
const COMBO_WINDOW_MS = 3000; // 3s to keep combo alive

// Slow-motion for long words (5+ letters)
let slowMoFactor = 1; // 1 = normal, 0.3 = slow-mo
let slowMoTimer: ReturnType<typeof setTimeout> | null = null;

// Power-up active effects
let activeSlowDown = false;
let activeDoubleScore = false;
let slowDownTimer: ReturnType<typeof setTimeout> | null = null;
let doubleScoreTimer: ReturnType<typeof setTimeout> | null = null;

// Interference effects from multiplayer opponent
let interferences: InterferenceEffect[] = [];

// Balls, bucket, effects
let balls: Ball[] = [];
let ballIdCounter = 0;
let W = 0, H = 0;
let bucket: BucketGeometry = { topY: 0, bottomY: 0, leftTop: 0, rightTop: 0, leftBottom: 0, rightBottom: 0 };
let particles: Particle[] = [];
let floatingTexts: FloatingText[] = [];
let overflowFrames = 0;
const OVERFLOW_THRESHOLD = 90;

// Replay recording
let replayFrames: ReplayFrame[] = [];
let gameStartTime = 0;

// Callbacks
let onGameOverCb: GameCallbacks['onGameOver'] | null = null;
let onScoreUpdateCb: GameCallbacks['onScoreUpdate'] | null = null;
// Multiplayer callback: send interference to opponent
let onSendInterference: ((type: string) => void) | null = null;

let scoreEl: HTMLElement | null = null;
let levelEl: HTMLElement | null = null;
let comboEl: HTMLElement | null = null;

// ===================== PUBLIC API =====================

export function initGame(callbacks: GameCallbacks) {
  onGameOverCb = callbacks.onGameOver;
  onScoreUpdateCb = callbacks.onScoreUpdate;
}

export function setMultiplayerCallback(cb: (type: string) => void) {
  onSendInterference = cb;
}

export function startGame(seedOverride?: number) {
  // Reset
  score = 0; level = 1; wordsFound = 0;
  bestWord = { word: '', score: 0 };
  spawnPaused = false; gameActive = true;
  balls = []; ballIdCounter = 0;
  particles = []; floatingTexts = [];
  overflowFrames = 0; lastTime = 0;
  comboCount = 0; maxCombo = 0;
  slowMoFactor = 1;
  activeSlowDown = false; activeDoubleScore = false;
  interferences = [];
  replayFrames = []; gameStartTime = performance.now();

  rng = new SeededRng(seedOverride);

  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  scoreEl = document.getElementById('current-score');
  levelEl = document.getElementById('current-level');
  comboEl = document.getElementById('combo-display');
  resizeCanvas();

  if (engine) { Composite.clear(engine.world, false); Engine.clear(engine); }
  setupPhysics();

  resetLetterHistory();
  initInput({
    canvas,
    getBalls: () => balls,
    areTouching,
    onWordSubmit: handleWordSubmit,
    wordDisplay: document.getElementById('current-word-display'),
    isValidPrefix,
  });

  updateScoreDisplay();
  animFrame = requestAnimationFrame(gameLoop);
  scheduleNextSpawn();
}

export function stopGame() {
  gameActive = false;
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
  if (comboTimer) { clearTimeout(comboTimer); comboTimer = null; }
  if (slowMoTimer) { clearTimeout(slowMoTimer); slowMoTimer = null; }
  if (slowDownTimer) { clearTimeout(slowDownTimer); slowDownTimer = null; }
  if (doubleScoreTimer) { clearTimeout(doubleScoreTimer); doubleScoreTimer = null; }
  destroyInput();
  if (engine) { Composite.clear(engine.world, false); Engine.clear(engine); engine = null; }
  balls = []; particles = []; floatingTexts = [];
}

export function getHighScore(): number {
  return parseInt(localStorage.getItem('wardogs_highscore') || '0', 10);
}
export function setHighScore(val: number) { localStorage.setItem('wardogs_highscore', String(val)); }

export function getReplayData(): ReplayData {
  return {
    seed: rng.seed,
    language: getLangConfig().code,
    frames: replayFrames,
    finalStats: { score, highScore: getHighScore(), wordsFound, bestWord: bestWord.word || '-', combo: comboCount, maxCombo },
  };
}

// Apply interference from multiplayer opponent
export function applyInterference(effect: InterferenceEffect) {
  interferences.push(effect);
  if (effect.type === 'bigBall') {
    // Spawn a large ball immediately
    spawnBall(true);
  } else if (effect.type === 'speedUp') {
    // Temporary speed boost on drops
    // handled in getSpawnInterval
    setTimeout(() => {
      interferences = interferences.filter(e => e !== effect);
    }, effect.duration);
  } else if (effect.type === 'scramble') {
    // Randomize letters on existing balls
    for (const ball of balls) {
      if (ball.popping === 0) ball.letter = getRandomLetter(rng);
    }
  }
}

// ===================== CANVAS =====================

function resizeCanvas() {
  const rect = canvas!.getBoundingClientRect();
  W = rect.width; H = rect.height;
  const dpr = window.devicePixelRatio || 1;
  canvas!.width = W * dpr; canvas!.height = H * dpr;
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  bucket = {
    topY: H * 0.18, bottomY: H * 0.96,
    leftTop: W * 0.06, rightTop: W * 0.94,
    leftBottom: W * 0.14, rightBottom: W * 0.86,
  };
}

// ===================== PHYSICS =====================

function setupPhysics() {
  engine = Engine.create({ gravity: { x: 0, y: GRAVITY } });
  createWall(bucket.leftTop, bucket.topY, bucket.leftBottom, bucket.bottomY);
  createWall(bucket.rightTop, bucket.topY, bucket.rightBottom, bucket.bottomY);
  createWall(bucket.leftBottom, bucket.bottomY, bucket.rightBottom, bucket.bottomY);
}

function createWall(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const wall = Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len + WALL_THICKNESS, WALL_THICKNESS,
    { isStatic: true, angle, friction: WALL_FRICTION, restitution: WALL_RESTITUTION, label: 'wall' });
  Composite.add(engine!.world, wall);
}

// ===================== BALLS =====================

function areTouching(a: Ball, b: Ball): boolean {
  const dx = a.body.position.x - b.body.position.x;
  const dy = a.body.position.y - b.body.position.y;
  return Math.sqrt(dx * dx + dy * dy) <= a.radius + b.radius + 5;
}

function spawnBall(forceLarge = false) {
  if (!gameActive || spawnPaused) return;
  const letter = getRandomLetter(rng);
  let radius = getRandomBallRadius(rng, level);
  if (forceLarge) radius = 28 + rng.next() * 8; // Interference: big ball

  const minX = bucket.leftTop + radius + 5;
  const maxX = bucket.rightTop - radius - 5;
  const x = minX + rng.next() * (maxX - minX);
  const y = bucket.topY - radius - 30;

  const body = Bodies.circle(x, y, radius, {
    friction: BALL_FRICTION, restitution: BALL_RESTITUTION,
    density: BALL_DENSITY, frictionAir: BALL_AIR_FRICTION,
    frictionStatic: BALL_STATIC_FRICTION, label: 'ball',
  });
  Composite.add(engine!.world, body);

  // Special type
  let special: Ball['special'] = null;
  const r = rng.next();
  if (r < 0.02) special = '3x';
  else if (r < 0.07) special = '2x';

  // Power-up type (rare)
  let powerUp: PowerUpType = null;
  const p = rng.next();
  if (p < 0.01) powerUp = 'bomb';
  else if (p < 0.025) powerUp = 'slow';
  else if (p < 0.04) powerUp = 'remove';
  else if (p < 0.055) powerUp = 'double';

  const ball: Ball = { id: ballIdCounter++, body, letter, radius, special, popping: 0, powerUp };
  balls.push(ball);

  replayFrames.push({ time: performance.now() - gameStartTime, action: 'spawn', data: { letter, radius, x, special, powerUp } });
}

function popBalls(ballsToRemove: Ball[]) {
  const ids = new Set(ballsToRemove.map(b => b.id));
  for (const ball of balls) { if (ids.has(ball.id)) ball.popping = 18; }
}

function updateBalls() {
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    if (ball.popping > 0) {
      ball.popping--;
      if (ball.popping === 0) {
        const pos = ball.body.position;
        const col = ball.special === '3x' ? COLORS.special3x
          : ball.special === '2x' ? COLORS.special2x : COLORS.accent;
        spawnPopParticles(pos.x, pos.y, col);
        Composite.remove(engine!.world, ball.body);
        balls.splice(i, 1);
      }
      continue;
    }
    if (ball.body.position.y > H + 200) {
      Composite.remove(engine!.world, ball.body);
      balls.splice(i, 1);
    }
  }
}

// ===================== SPAWNING =====================

function getSpawnInterval(): number {
  let interval = Math.max(800, 2500 - (level - 1) * 120);
  // Interference: speed up
  if (interferences.some(e => e.type === 'speedUp')) interval *= 0.6;
  // Power-up: slow down
  if (activeSlowDown) interval *= 1.5;
  return interval;
}

function scheduleNextSpawn() {
  if (!gameActive) return;
  spawnTimer = setTimeout(() => { spawnBall(); scheduleNextSpawn(); }, getSpawnInterval());
}

function pauseSpawning(ms: number) {
  spawnPaused = true;
  if (spawnTimer) clearTimeout(spawnTimer);
  setTimeout(() => { if (!gameActive) return; spawnPaused = false; scheduleNextSpawn(); }, ms);
}

// ===================== POWER-UP ACTIVATION =====================

function activatePowerUp(type: PowerUpType) {
  if (!type) return;
  replayFrames.push({ time: performance.now() - gameStartTime, action: 'powerup', data: { type } });

  if (type === 'slow') {
    activeSlowDown = true;
    if (slowDownTimer) clearTimeout(slowDownTimer);
    slowDownTimer = setTimeout(() => { activeSlowDown = false; }, 5000);
    addFloatingText(W / 2, H * 0.15, 'RALENTI!', COLORS.powerSlow, 22);
  } else if (type === 'remove') {
    // Remove 3 random non-selected balls
    const removable = balls.filter(b => b.popping === 0).slice(0, 3);
    popBalls(removable);
    addFloatingText(W / 2, H * 0.15, 'NETTOYAGE!', COLORS.powerRemove, 22);
  } else if (type === 'double') {
    activeDoubleScore = true;
    if (doubleScoreTimer) clearTimeout(doubleScoreTimer);
    doubleScoreTimer = setTimeout(() => { activeDoubleScore = false; }, 8000);
    addFloatingText(W / 2, H * 0.15, 'DOUBLE!', COLORS.powerDouble, 22);
  } else if (type === 'bomb') {
    // Remove all balls in a radius around the bomb ball
    const bombBalls = balls.filter(b => b.popping === 0);
    if (bombBalls.length > 5) {
      popBalls(bombBalls.slice(0, Math.min(8, bombBalls.length)));
    }
    addFloatingText(W / 2, H * 0.15, 'BOOM!', COLORS.powerBomb, 28);
  }
}

// ===================== WORD SUBMISSION =====================

function handleWordSubmit(word: string, path: Ball[]) {
  if (!gameActive) { clearSelection(); return; }
  const normalized = word.toLowerCase();
  if (normalized.length < 3) { clearSelection(); return; }

  if (isWord(normalized)) {
    // Check for power-ups in the path
    for (const ball of path) {
      if (ball.powerUp) activatePowerUp(ball.powerUp);
    }

    const points = calculateWordScore(path, comboCount);
    const finalPoints = activeDoubleScore ? points * 2 : points;
    score += finalPoints;
    wordsFound++;
    if (finalPoints > bestWord.score) bestWord = { word: normalized, score: finalPoints };

    // Combo system
    comboCount++;
    if (comboCount > maxCombo) maxCombo = comboCount;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { comboCount = 0; updateComboDisplay(); }, COMBO_WINDOW_MS);
    updateComboDisplay();

    // Slow-motion juice for 5+ letter words
    if (normalized.length >= 5) triggerSlowMo();

    // Floating feedback
    const avgX = path.reduce((s, b) => s + b.body.position.x, 0) / path.length;
    const avgY = path.reduce((s, b) => s + b.body.position.y, 0) / path.length;
    addFloatingText(avgX, avgY - 20, `+${finalPoints}`, COLORS.success, 24);
    addFloatingText(avgX, avgY - 55, normalized.toUpperCase(), COLORS.accent, 16);
    if (comboCount > 1) addFloatingText(avgX, avgY - 85, `COMBO x${comboCount}`, COLORS.comboGold, 18);

    // Multiplayer: send interference on 5+ letter words
    if (onSendInterference && normalized.length >= 5) {
      if (normalized.length >= 7) onSendInterference('scramble');
      else if (normalized.length >= 6) onSendInterference('speedUp');
      else onSendInterference('bigBall');
    }

    popBalls(path);
    pauseSpawning(600);
    replayFrames.push({ time: performance.now() - gameStartTime, action: 'word', data: { word: normalized, points: finalPoints, combo: comboCount } });
    updateScoreDisplay();
    updateLevel();
  }
  clearSelection();
}

// ===================== SLOW-MOTION =====================

function triggerSlowMo() {
  slowMoFactor = 0.3;
  if (slowMoTimer) clearTimeout(slowMoTimer);
  slowMoTimer = setTimeout(() => { slowMoFactor = 1; }, 800);
}

// ===================== SCORING =====================

function updateScoreDisplay() {
  if (scoreEl) scoreEl.textContent = String(score);
  if (levelEl) levelEl.textContent = String(level);
  if (onScoreUpdateCb) onScoreUpdateCb(score, level);
}

function updateComboDisplay() {
  if (comboEl) {
    comboEl.textContent = comboCount > 1 ? `COMBO x${comboCount}` : '';
    comboEl.style.opacity = comboCount > 1 ? '1' : '0';
  }
}

function updateLevel() {
  const newLevel = Math.floor(score / 50) + 1;
  if (newLevel !== level) { level = newLevel; updateScoreDisplay(); }
}

// ===================== GAME LOOP =====================

function gameLoop(timestamp: number) {
  if (!gameActive) return;
  if (!lastTime) lastTime = timestamp;
  const rawDelta = Math.min(timestamp - lastTime, 33);
  lastTime = timestamp;

  // Apply slow-motion factor to physics step
  const delta = rawDelta * slowMoFactor;
  Engine.update(engine!, delta);

  updateBalls(); updateParticles(); updateFloatingTexts();
  checkOverflow();
  render();
  animFrame = requestAnimationFrame(gameLoop);
}

// ===================== OVERFLOW =====================

function checkOverflow() {
  let has = false;
  for (const ball of balls) {
    if (ball.popping > 0) continue;
    if (Vector.magnitude(ball.body.velocity) < 1.5 && ball.body.position.y < bucket.topY - ball.radius * 0.5) {
      has = true; break;
    }
  }
  if (has) { overflowFrames++; if (overflowFrames >= OVERFLOW_THRESHOLD) triggerGameOver(); }
  else overflowFrames = Math.max(0, overflowFrames - 2);
}

// "I once killed a man just to watch him die. Then I got bored." — Handsome Jack
function triggerGameOver() {
  gameActive = false;
  if (spawnTimer) clearTimeout(spawnTimer);
  if (animFrame) cancelAnimationFrame(animFrame);
  destroyInput();
  const hs = getHighScore();
  if (score > hs) setHighScore(score);
  if (onGameOverCb) onGameOverCb({ score, highScore: Math.max(score, hs), wordsFound, bestWord: bestWord.word || '-', combo: comboCount, maxCombo });
}

// ===================== RENDERING =====================
// "It's like Christmas!" — Claptrap

function render() {
  ctx!.clearRect(0, 0, W, H);
  drawBackground(); drawBucketInterior(); drawBalls();
  drawSelectionPath(); drawBucketWalls(); drawOverflowWarning();
  drawActiveEffects(); drawParticlesLayer(); drawFloatingTextsLayer();
}

function drawBackground() { ctx!.fillStyle = COLORS.bg; ctx!.fillRect(0, 0, W, H); }

function drawBucketInterior() {
  ctx!.beginPath();
  ctx!.moveTo(bucket.leftTop, bucket.topY); ctx!.lineTo(bucket.rightTop, bucket.topY);
  ctx!.lineTo(bucket.rightBottom, bucket.bottomY); ctx!.lineTo(bucket.leftBottom, bucket.bottomY);
  ctx!.closePath();
  const g = ctx!.createLinearGradient(0, bucket.topY, 0, bucket.bottomY);
  g.addColorStop(0, COLORS.bucketFillTop); g.addColorStop(0.3, COLORS.bucketFillMid);
  g.addColorStop(0.7, COLORS.bucketFillMid); g.addColorStop(1, COLORS.bucketFillTop);
  ctx!.fillStyle = g; ctx!.fill();
}

function drawBalls() {
  const sel = new Set(getSelectedPath().map(b => b.id));
  for (const ball of balls) {
    if (ball.popping > 0) { drawPoppingBall(ball); continue; }
    const { x, y } = ball.body.position;
    const r = ball.radius;
    const isSel = sel.has(ball.id);

    if (isSel) {
      ctx!.save(); ctx!.shadowColor = COLORS.selectedGlow; ctx!.shadowBlur = 15;
      ctx!.beginPath(); ctx!.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx!.fillStyle = 'rgba(245,158,11,0.12)'; ctx!.fill(); ctx!.restore();
    }

    if (ball.special || ball.powerUp) {
      ctx!.save();
      ctx!.shadowColor = ball.powerUp ? getPowerColor(ball.powerUp) : (ball.special === '3x' ? COLORS.special3x : COLORS.special2x);
      ctx!.shadowBlur = 8;
    }

    ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2);
    let gL: string, gD: string, border: string;
    if (isSel) { gL = COLORS.selectedLight; gD = COLORS.selectedFill; border = COLORS.selectedGlow; }
    else if (ball.powerUp) { const c = getPowerColors(ball.powerUp); gL = c[0]; gD = c[1]; border = c[2]; }
    else if (ball.special === '2x') { gL = '#2563eb'; gD = COLORS.special2xDark; border = COLORS.special2x; }
    else if (ball.special === '3x') { gL = '#7c3aed'; gD = COLORS.special3xDark; border = COLORS.special3x; }
    else { gL = COLORS.ballLight; gD = COLORS.ballDark; border = COLORS.ballBorder; }

    const grad = ctx!.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
    grad.addColorStop(0, gL); grad.addColorStop(1, gD);
    ctx!.fillStyle = grad; ctx!.fill();
    ctx!.strokeStyle = border; ctx!.lineWidth = isSel ? 3 : 2; ctx!.stroke();

    if (ball.special || ball.powerUp) ctx!.restore();

    // Letter
    ctx!.fillStyle = isSel ? '#fff' : COLORS.text;
    ctx!.font = `bold ${Math.round(r * 1.05)}px 'Russo One', sans-serif`;
    ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
    ctx!.fillText(ball.letter, x, y - 1);

    // Points
    ctx!.fillStyle = isSel ? 'rgba(255,255,255,0.7)' : COLORS.textDim;
    ctx!.font = `bold ${Math.round(r * 0.42)}px Inter, sans-serif`;
    ctx!.textAlign = 'center'; ctx!.textBaseline = 'top';
    ctx!.fillText(String(getLetterPoints(ball.letter)), x + r * 0.35, y + r * 0.25);

    // Badge
    if (ball.special) {
      ctx!.fillStyle = ball.special === '3x' ? COLORS.special3x : COLORS.special2x;
      ctx!.font = `bold ${Math.round(r * 0.4)}px Inter, sans-serif`;
      ctx!.textAlign = 'center'; ctx!.textBaseline = 'bottom';
      ctx!.fillText(ball.special, x, y - r * 0.45);
    }
    if (ball.powerUp) {
      ctx!.fillStyle = getPowerColor(ball.powerUp);
      ctx!.font = `bold ${Math.round(r * 0.35)}px Inter, sans-serif`;
      ctx!.textAlign = 'center'; ctx!.textBaseline = 'bottom';
      ctx!.fillText(getPowerIcon(ball.powerUp), x, y - r * 0.45);
    }
  }
}

function drawPoppingBall(ball: Ball) {
  const { x, y } = ball.body.position;
  const progress = 1 - ball.popping / 18;
  const r = ball.radius * (1 + progress * 0.5);
  ctx!.save(); ctx!.globalAlpha = 1 - progress;
  ctx!.beginPath(); ctx!.arc(x, y, r, 0, Math.PI * 2);
  ctx!.fillStyle = ball.special === '3x' ? COLORS.special3x : ball.special === '2x' ? COLORS.special2x : COLORS.accent;
  ctx!.fill();
  ctx!.fillStyle = '#fff'; ctx!.font = `bold ${Math.round(ball.radius * 1.1 * (1 + progress * 0.5))}px 'Russo One', sans-serif`;
  ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'; ctx!.fillText(ball.letter, x, y);
  ctx!.restore();
}

function drawSelectionPath() {
  const path = getSelectedPath();
  if (path.length < 2) return;
  ctx!.beginPath();
  ctx!.moveTo(path[0].body.position.x, path[0].body.position.y);
  for (let i = 1; i < path.length; i++) ctx!.lineTo(path[i].body.position.x, path[i].body.position.y);
  ctx!.strokeStyle = COLORS.pathLine; ctx!.lineWidth = 4; ctx!.lineCap = 'round'; ctx!.lineJoin = 'round'; ctx!.stroke();
}

function drawBucketWalls() {
  ctx!.lineCap = 'round'; ctx!.lineWidth = 8;
  const lg = ctx!.createLinearGradient(bucket.leftTop, bucket.topY, bucket.leftBottom, bucket.bottomY);
  lg.addColorStop(0, COLORS.bucketWoodLight); lg.addColorStop(1, COLORS.bucketWood);
  ctx!.strokeStyle = lg; ctx!.beginPath(); ctx!.moveTo(bucket.leftTop, bucket.topY); ctx!.lineTo(bucket.leftBottom, bucket.bottomY); ctx!.stroke();
  const rg = ctx!.createLinearGradient(bucket.rightTop, bucket.topY, bucket.rightBottom, bucket.bottomY);
  rg.addColorStop(0, COLORS.bucketWoodLight); rg.addColorStop(1, COLORS.bucketWood);
  ctx!.strokeStyle = rg; ctx!.beginPath(); ctx!.moveTo(bucket.rightTop, bucket.topY); ctx!.lineTo(bucket.rightBottom, bucket.bottomY); ctx!.stroke();
  ctx!.strokeStyle = COLORS.bucketWood; ctx!.beginPath(); ctx!.moveTo(bucket.leftBottom, bucket.bottomY); ctx!.lineTo(bucket.rightBottom, bucket.bottomY); ctx!.stroke();
  ctx!.lineWidth = 4; ctx!.strokeStyle = COLORS.bucketRim; ctx!.beginPath(); ctx!.moveTo(bucket.leftTop - 4, bucket.topY); ctx!.lineTo(bucket.rightTop + 4, bucket.topY); ctx!.stroke();
  ctx!.lineWidth = 2; ctx!.strokeStyle = COLORS.bucketRimShadow; ctx!.beginPath(); ctx!.moveTo(bucket.leftTop - 4, bucket.topY + 3); ctx!.lineTo(bucket.rightTop + 4, bucket.topY + 3); ctx!.stroke();
}

function drawOverflowWarning() {
  let highestY = Infinity;
  for (const ball of balls) { if (ball.popping > 0) continue; const y = ball.body.position.y - ball.radius; if (y < highestY) highestY = y; }
  const danger = (bucket.topY - highestY) / 80;
  if (danger <= 0) return;
  ctx!.save(); ctx!.setLineDash([8, 6]);
  ctx!.strokeStyle = `rgba(239,68,68,${Math.min(0.8, danger * 0.4 + 0.15)})`;
  ctx!.lineWidth = 2; ctx!.beginPath();
  ctx!.moveTo(bucket.leftTop + 5, bucket.topY); ctx!.lineTo(bucket.rightTop - 5, bucket.topY); ctx!.stroke();
  ctx!.setLineDash([]); ctx!.restore();
}

function drawActiveEffects() {
  // Slow-mo vignette
  if (slowMoFactor < 1) {
    ctx!.save();
    const g = ctx!.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'transparent'); g.addColorStop(1, 'rgba(34,211,238,0.12)');
    ctx!.fillStyle = g; ctx!.fillRect(0, 0, W, H);
    ctx!.restore();
  }
  // Active power-up indicators
  let indicatorY = bucket.topY - 25;
  if (activeSlowDown) { ctx!.fillStyle = COLORS.powerSlow; ctx!.font = 'bold 12px Inter'; ctx!.textAlign = 'left'; ctx!.fillText('RALENTI', 10, indicatorY); indicatorY -= 18; }
  if (activeDoubleScore) { ctx!.fillStyle = COLORS.powerDouble; ctx!.font = 'bold 12px Inter'; ctx!.textAlign = 'left'; ctx!.fillText('x2 SCORE', 10, indicatorY); }
}

// ===================== EFFECTS =====================

function spawnPopParticles(x: number, y: number, color: string) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4, life = 35 + Math.random() * 25;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, radius: 2 + Math.random() * 3, color, life, maxLife: life });
  }
}

function updateParticles() { for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; if (p.life <= 0) particles.splice(i, 1); } }
function drawParticlesLayer() { for (const p of particles) { ctx!.globalAlpha = p.life / p.maxLife; ctx!.beginPath(); ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx!.fillStyle = p.color; ctx!.fill(); } ctx!.globalAlpha = 1; }

function addFloatingText(x: number, y: number, text: string, color: string, size: number) { floatingTexts.push({ x, y, text, color, size, vy: -1.5, life: 60, maxLife: 60 }); }
function updateFloatingTexts() { for (let i = floatingTexts.length - 1; i >= 0; i--) { const f = floatingTexts[i]; f.y += f.vy; f.life--; if (f.life <= 0) floatingTexts.splice(i, 1); } }
function drawFloatingTextsLayer() { for (const f of floatingTexts) { ctx!.globalAlpha = f.life / f.maxLife; ctx!.fillStyle = f.color; ctx!.font = `bold ${f.size}px 'Russo One', sans-serif`; ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle'; ctx!.fillText(f.text, f.x, f.y); } ctx!.globalAlpha = 1; }

// ===================== POWER-UP HELPERS =====================

function getPowerColor(type: PowerUpType): string {
  if (type === 'slow') return COLORS.powerSlow;
  if (type === 'remove') return COLORS.powerRemove;
  if (type === 'double') return COLORS.powerDouble;
  if (type === 'bomb') return COLORS.powerBomb;
  return COLORS.accent;
}

function getPowerColors(type: PowerUpType): [string, string, string] {
  if (type === 'slow') return ['#06b6d4', '#0e4f5c', COLORS.powerSlow];
  if (type === 'remove') return ['#e11d48', '#5c1029', COLORS.powerRemove];
  if (type === 'double') return ['#eab308', '#5c4a08', COLORS.powerDouble];
  if (type === 'bomb') return ['#ea580c', '#5c2508', COLORS.powerBomb];
  return [COLORS.ballLight, COLORS.ballDark, COLORS.ballBorder];
}

function getPowerIcon(type: PowerUpType): string {
  if (type === 'slow') return 'SLO';
  if (type === 'remove') return 'CLR';
  if (type === 'double') return 'x2';
  if (type === 'bomb') return 'BOM';
  return '';
}
