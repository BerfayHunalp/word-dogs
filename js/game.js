// ============================================================
// game.js — Physics-based word game engine (Matter.js + Canvas)
//
// UPGRADE: Replaces the old DOM grid system with a real physics
// simulation. Balls now fall under gravity, collide with each
// other and bucket walls, and stack naturally like pool balls.
// ============================================================

import { getRandomLetter, resetLetterHistory, getRandomBallRadius } from './letter.js';
import { initInput, destroyInput, getSelectedPath, clearSelection } from './input.js';
import { isWord } from './dictionary.js';
import { getLetterPoints } from './scoring.js';

// Matter.js loaded via CDN — available as global
const { Engine, Bodies, Composite, Vector } = Matter;

// ===================== PHYSICS CONSTANTS =====================
// Tuned for "heavy balls in a bucket" feel:
// low bounce, moderate friction, quick settling
// "NOTHING IS MORE BADASS THAN TREATING A WOMAN WITH RESPECT!" — Mr. Torgue

const GRAVITY = 1.8;
const BALL_FRICTION = 0.4;
const BALL_RESTITUTION = 0.08;      // Very little bounce
const BALL_DENSITY = 0.004;          // Heavier than default (0.001)
const BALL_AIR_FRICTION = 0.015;     // Slight air damping
const BALL_STATIC_FRICTION = 0.6;    // Stay put when settled
const WALL_FRICTION = 0.3;
const WALL_RESTITUTION = 0.05;
const WALL_THICKNESS = 20;

// ===================== VISUAL CONSTANTS =====================

const COLORS = {
    bg: '#0a0a0f',
    // Bucket
    bucketFillTop: '#1a0d04',
    bucketFillMid: '#2a1508',
    bucketWood: '#4a2a12',
    bucketWoodLight: '#6b3d1e',
    bucketRim: '#DAA520',
    bucketRimShadow: '#8B6914',
    // Balls
    ballLight: '#3d5a80',
    ballDark: '#1a2332',
    ballBorder: '#405570',
    selectedGlow: '#f59e0b',
    selectedFill: '#78350f',
    selectedLight: '#a67c2e',
    special2x: '#3b82f6',
    special2xDark: '#1e3a5f',
    special3x: '#a855f7',
    special3xDark: '#3b1f6e',
    // Text
    text: '#e2e8f0',
    textDim: '#64748b',
    accent: '#f59e0b',
    danger: '#ef4444',
    success: '#22c55e',
    pathLine: 'rgba(245, 158, 11, 0.5)',
};

// ===================== GAME STATE =====================

let engine = null;
let canvas = null;
let ctx = null;
let animFrame = null;

let gameActive = false;
let score = 0;
let level = 1;
let wordsFound = 0;
let bestWord = { word: '', score: 0 };
let spawnTimer = null;
let spawnPaused = false;
let lastTime = 0;

// All active balls: { id, body, letter, radius, special, popping }
let balls = [];
let ballIdCounter = 0;

// Bucket geometry (computed on canvas resize)
let W = 0, H = 0;
let bucket = {};

// Visual effects
let particles = [];
let floatingTexts = [];

// Overflow detection — game ends when settled balls are above the rim
// "Stairs?! NOOOOOOO!" — Claptrap (same energy when the bucket overflows)
let overflowFrames = 0;
const OVERFLOW_THRESHOLD = 90; // ~1.5s at 60fps before triggering game over

// Callbacks from main.js
let onGameOverCb = null;
let onScoreUpdateCb = null;

// DOM refs for score bar
let scoreEl, levelEl;

// ===================== PUBLIC API =====================
// Same interface as the old game.js so main.js doesn't change

export function initGame(callbacks) {
    onGameOverCb = callbacks.onGameOver;
    onScoreUpdateCb = callbacks.onScoreUpdate;
}

export function startGame() {
    if (typeof Matter === 'undefined') {
        console.error('Matter.js not loaded — cannot start physics game');
        return;
    }

    // Reset all state
    score = 0;
    level = 1;
    wordsFound = 0;
    bestWord = { word: '', score: 0 };
    spawnPaused = false;
    gameActive = true;
    balls = [];
    ballIdCounter = 0;
    particles = [];
    floatingTexts = [];
    overflowFrames = 0;
    lastTime = 0;

    // DOM refs
    scoreEl = document.getElementById('current-score');
    levelEl = document.getElementById('current-level');

    // Setup canvas (fills the game container below the score bar)
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Setup Matter.js physics engine
    if (engine) {
        Composite.clear(engine.world, false);
        Engine.clear(engine);
    }
    setupPhysics();

    // Setup touch/mouse input for word selection
    resetLetterHistory();
    initInput({
        canvas,
        getBalls: () => balls,
        areTouching,
        onWordSubmit: handleWordSubmit,
        wordDisplay: document.getElementById('current-word-display'),
    });

    updateScoreDisplay();

    // Start the game loop (physics + rendering at 60fps)
    animFrame = requestAnimationFrame(gameLoop);

    // Start dropping balls into the bucket
    scheduleNextSpawn();
}

export function stopGame() {
    gameActive = false;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
    destroyInput();
    if (engine) {
        Composite.clear(engine.world, false);
        Engine.clear(engine);
        engine = null;
    }
    balls = [];
    particles = [];
    floatingTexts = [];
}

export function getHighScore() {
    return parseInt(localStorage.getItem('wardogs_highscore') || '0', 10);
}

export function setHighScore(val) {
    localStorage.setItem('wardogs_highscore', String(val));
}

export function getStats() {
    return { score, level, wordsFound, bestWord };
}

// ===================== CANVAS SETUP =====================

function resizeCanvas() {
    // Canvas fills the game-container below the score bar
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;

    // High-DPI support for crisp rendering on retina screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Bucket is a trapezoid: wider at top (opening), narrower at bottom
    // Occupies roughly the bottom 80% of the canvas
    bucket = {
        topY:        H * 0.18,
        bottomY:     H * 0.96,
        leftTop:     W * 0.06,
        rightTop:    W * 0.94,
        leftBottom:  W * 0.14,
        rightBottom: W * 0.86,
    };
}

// ===================== PHYSICS ENGINE =====================

function setupPhysics() {
    engine = Engine.create({ gravity: { x: 0, y: GRAVITY } });

    // Create 3 static walls forming the bucket: left wall, right wall, floor
    // Left wall: tapers from top-left to bottom-left
    createWall(bucket.leftTop, bucket.topY, bucket.leftBottom, bucket.bottomY);
    // Right wall: tapers from top-right to bottom-right
    createWall(bucket.rightTop, bucket.topY, bucket.rightBottom, bucket.bottomY);
    // Floor: flat bottom
    createWall(bucket.leftBottom, bucket.bottomY, bucket.rightBottom, bucket.bottomY);
}

// Create a static wall body along a line segment
function createWall(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const wall = Bodies.rectangle(
        (x1 + x2) / 2, (y1 + y2) / 2,
        length + WALL_THICKNESS, WALL_THICKNESS,
        {
            isStatic: true,
            angle,
            friction: WALL_FRICTION,
            restitution: WALL_RESTITUTION,
            label: 'wall',
        }
    );
    Composite.add(engine.world, wall);
}

// ===================== BALL MANAGEMENT =====================

// NEW: Check if two balls are physically touching (replaces grid adjacency)
// Uses center distance vs sum of radii with a small tolerance for playability
function areTouching(a, b) {
    const dx = a.body.position.x - b.body.position.x;
    const dy = a.body.position.y - b.body.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= a.radius + b.radius + 5; // 5px tolerance
}

// Spawn a new ball above the bucket opening and let it fall in
function spawnBall() {
    if (!gameActive || spawnPaused) return;

    const letter = getRandomLetter();
    const radius = getRandomBallRadius(level);

    // Random X position within the bucket opening
    const minX = bucket.leftTop + radius + 5;
    const maxX = bucket.rightTop - radius - 5;
    const x = minX + Math.random() * (maxX - minX);
    const y = bucket.topY - radius - 30; // Just above the bucket

    const body = Bodies.circle(x, y, radius, {
        friction: BALL_FRICTION,
        restitution: BALL_RESTITUTION,
        density: BALL_DENSITY,
        frictionAir: BALL_AIR_FRICTION,
        frictionStatic: BALL_STATIC_FRICTION,
        label: 'ball',
    });
    Composite.add(engine.world, body);

    // Rare special balls: 2x or 3x letter value
    let special = null;
    const r = Math.random();
    if (r < 0.02) special = '3x';
    else if (r < 0.07) special = '2x';

    balls.push({ id: ballIdCounter++, body, letter, radius, special, popping: 0 });
}

// Start pop animation for selected balls (called when valid word is found)
// "EXPLOSIONS?!" — Mr. Torgue
function popBalls(ballsToRemove) {
    const ids = new Set(ballsToRemove.map(b => b.id));
    for (const ball of balls) {
        if (ids.has(ball.id)) ball.popping = 18; // 18 frames of scale+fade
    }
}

// Update ball states each frame: advance pop animation, cleanup escaped balls
function updateBalls() {
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];

        // Pop animation: scale up, fade out, then remove
        if (ball.popping > 0) {
            ball.popping--;
            if (ball.popping === 0) {
                const pos = ball.body.position;
                const color = ball.special === '3x' ? COLORS.special3x
                    : ball.special === '2x' ? COLORS.special2x : COLORS.accent;
                spawnPopParticles(pos.x, pos.y, color);
                Composite.remove(engine.world, ball.body);
                balls.splice(i, 1);
            }
            continue;
        }

        // Safety cleanup: remove balls that escaped the bucket entirely
        const pos = ball.body.position;
        if (pos.y > H + 200 || pos.x < -200 || pos.x > W + 200) {
            Composite.remove(engine.world, ball.body);
            balls.splice(i, 1);
        }
    }
}

// ===================== SPAWNING =====================

// Difficulty scales with level: balls spawn faster over time
function getSpawnInterval() {
    return Math.max(800, 2500 - (level - 1) * 120);
}

function scheduleNextSpawn() {
    if (!gameActive) return;
    spawnTimer = setTimeout(() => {
        spawnBall();
        scheduleNextSpawn();
    }, getSpawnInterval());
}

// Temporarily pause spawning (reward after valid word)
function pauseSpawning(ms) {
    spawnPaused = true;
    clearTimeout(spawnTimer);
    setTimeout(() => {
        if (!gameActive) return;
        spawnPaused = false;
        scheduleNextSpawn();
    }, ms);
}

// ===================== WORD SUBMISSION =====================
// Called by input.js when the player releases their finger

function handleWordSubmit(word, path) {
    if (!gameActive) { clearSelection(); return; }

    const normalized = word.toLowerCase();

    // Minimum 3 letters per spec
    if (normalized.length < 3) { clearSelection(); return; }

    if (isWord(normalized)) {
        // --- Valid word! ---
        const points = calculateWordScore(path);
        score += points;
        wordsFound++;

        if (points > bestWord.score) {
            bestWord = { word: normalized, score: points };
        }

        // Floating score feedback at the center of the selected balls
        const avgX = path.reduce((s, b) => s + b.body.position.x, 0) / path.length;
        const avgY = path.reduce((s, b) => s + b.body.position.y, 0) / path.length;
        addFloatingText(avgX, avgY - 20, `+${points}`, COLORS.success, 24);
        addFloatingText(avgX, avgY - 55, normalized.toUpperCase(), COLORS.accent, 16);

        // Pop the selected balls — remaining balls fall naturally via physics
        popBalls(path);

        // Brief spawn pause as a reward
        pauseSpawning(600);

        updateScoreDisplay();
        updateLevel();
    }

    // Always clear selection after processing (valid or invalid)
    clearSelection();
}

// Score = sum of letter values (with special multipliers) x length bonus
function calculateWordScore(path) {
    let base = 0;
    for (const ball of path) {
        let pts = getLetterPoints(ball.letter);
        if (ball.special === '2x') pts *= 2;      // Double letter value
        else if (ball.special === '3x') pts *= 3;  // Triple letter value
        base += pts;
    }

    // Length bonuses per spec:
    // 3-4 letters: no bonus (1x)
    // 5-6 letters: +25% (1.25x)
    // 7+ letters:  +50% (1.5x)
    const len = path.length;
    let mult = 1;
    if (len >= 7) mult = 1.5;
    else if (len >= 5) mult = 1.25;

    return Math.round(base * mult);
}

// ===================== SCORING & LEVEL =====================

function updateScoreDisplay() {
    if (scoreEl) scoreEl.textContent = score;
    if (levelEl) levelEl.textContent = level;
    if (onScoreUpdateCb) onScoreUpdateCb(score, level);
}

function updateLevel() {
    const newLevel = Math.floor(score / 50) + 1;
    if (newLevel !== level) {
        level = newLevel;
        updateScoreDisplay();
    }
}

// ===================== GAME LOOP =====================
// Runs at 60fps: step physics, update state, render canvas

function gameLoop(timestamp) {
    if (!gameActive) return;

    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(timestamp - lastTime, 33); // Cap at ~30fps min
    lastTime = timestamp;

    // Step the physics simulation
    Engine.update(engine, delta);

    // Update game state
    updateBalls();
    updateParticles();
    updateFloatingTexts();
    checkOverflow();

    // Render everything to canvas
    render();

    animFrame = requestAnimationFrame(gameLoop);
}

// ===================== OVERFLOW DETECTION =====================
// Game over when settled balls pile above the bucket rim

function checkOverflow() {
    let hasOverflow = false;
    for (const ball of balls) {
        if (ball.popping > 0) continue;
        // Only count settled balls (low velocity)
        const speed = Vector.magnitude(ball.body.velocity);
        if (speed < 1.5 && ball.body.position.y < bucket.topY - ball.radius * 0.5) {
            hasOverflow = true;
            break;
        }
    }

    if (hasOverflow) {
        overflowFrames++;
        if (overflowFrames >= OVERFLOW_THRESHOLD) triggerGameOver();
    } else {
        overflowFrames = Math.max(0, overflowFrames - 2);
    }
}

// "I once killed a man just to watch him die. Then I got bored." — Handsome Jack
function triggerGameOver() {
    gameActive = false;
    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    destroyInput();

    const highScore = getHighScore();
    if (score > highScore) setHighScore(score);

    if (onGameOverCb) {
        onGameOverCb({
            score,
            highScore: Math.max(score, highScore),
            wordsFound,
            bestWord: bestWord.word || '-',
        });
    }
}

// ===================== RENDERING =====================
// Canvas-based rendering — replaces old DOM grid approach
// "It's like Christmas!" — Claptrap (every frame is a gift)

function render() {
    ctx.clearRect(0, 0, W, H);

    drawBackground();
    drawBucketInterior();
    drawBalls();
    drawSelectionPath();
    drawBucketWalls();
    drawOverflowWarning();
    drawParticlesLayer();
    drawFloatingTextsLayer();
}

function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
}

// Draw the inside of the bucket as a filled trapezoid with wood-like gradient
function drawBucketInterior() {
    ctx.beginPath();
    ctx.moveTo(bucket.leftTop, bucket.topY);
    ctx.lineTo(bucket.rightTop, bucket.topY);
    ctx.lineTo(bucket.rightBottom, bucket.bottomY);
    ctx.lineTo(bucket.leftBottom, bucket.bottomY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, bucket.topY, 0, bucket.bottomY);
    grad.addColorStop(0, COLORS.bucketFillTop);
    grad.addColorStop(0.3, COLORS.bucketFillMid);
    grad.addColorStop(0.7, COLORS.bucketFillMid);
    grad.addColorStop(1, COLORS.bucketFillTop);
    ctx.fillStyle = grad;
    ctx.fill();
}

// Draw all balls as circles with letters and point values
function drawBalls() {
    const selectedSet = new Set(getSelectedPath().map(b => b.id));

    for (const ball of balls) {
        // Popping balls get their own animation
        if (ball.popping > 0) { drawPoppingBall(ball); continue; }

        const { x, y } = ball.body.position;
        const r = ball.radius;
        const selected = selectedSet.has(ball.id);

        // Selection glow (drawn behind the ball)
        if (selected) {
            ctx.save();
            ctx.shadowColor = COLORS.selectedGlow;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(x, y, r + 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
            ctx.fill();
            ctx.restore();
        }

        // Ball shadow for depth
        if (ball.special) {
            ctx.save();
            ctx.shadowColor = ball.special === '3x' ? COLORS.special3x : COLORS.special2x;
            ctx.shadowBlur = 8;
        }

        // Ball body: radial gradient for 3D look
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);

        let gradL, gradD, border;
        if (selected) {
            gradL = COLORS.selectedLight; gradD = COLORS.selectedFill; border = COLORS.selectedGlow;
        } else if (ball.special === '2x') {
            gradL = '#2563eb'; gradD = COLORS.special2xDark; border = COLORS.special2x;
        } else if (ball.special === '3x') {
            gradL = '#7c3aed'; gradD = COLORS.special3xDark; border = COLORS.special3x;
        } else {
            gradL = COLORS.ballLight; gradD = COLORS.ballDark; border = COLORS.ballBorder;
        }

        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
        grad.addColorStop(0, gradL);
        grad.addColorStop(1, gradD);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();

        if (ball.special) ctx.restore();

        // Letter (centered)
        ctx.fillStyle = selected ? '#fff' : COLORS.text;
        ctx.font = `bold ${Math.round(r * 1.05)}px 'Russo One', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.letter, x, y - 1);

        // Point value (bottom-right)
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.7)' : COLORS.textDim;
        ctx.font = `bold ${Math.round(r * 0.42)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(String(getLetterPoints(ball.letter)), x + r * 0.35, y + r * 0.25);

        // Special badge (top)
        if (ball.special) {
            ctx.fillStyle = ball.special === '3x' ? COLORS.special3x : COLORS.special2x;
            ctx.font = `bold ${Math.round(r * 0.4)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(ball.special, x, y - r * 0.45);
        }
    }
}

// Popping animation: scale up + fade out over 18 frames
function drawPoppingBall(ball) {
    const { x, y } = ball.body.position;
    const progress = 1 - ball.popping / 18;
    const scale = 1 + progress * 0.5;
    const r = ball.radius * scale;

    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ball.special === '3x' ? COLORS.special3x
        : ball.special === '2x' ? COLORS.special2x : COLORS.accent;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(ball.radius * 1.1 * scale)}px 'Russo One', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.letter, x, y);
    ctx.restore();
}

// Draw lines connecting selected balls (the selection path)
function drawSelectionPath() {
    const path = getSelectedPath();
    if (path.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(path[0].body.position.x, path[0].body.position.y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].body.position.x, path[i].body.position.y);
    }
    ctx.strokeStyle = COLORS.pathLine;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

// Draw the bucket walls and rim on top of the balls
function drawBucketWalls() {
    ctx.lineCap = 'round';

    // Left wall (wood gradient)
    ctx.lineWidth = 8;
    const lg = ctx.createLinearGradient(bucket.leftTop, bucket.topY, bucket.leftBottom, bucket.bottomY);
    lg.addColorStop(0, COLORS.bucketWoodLight);
    lg.addColorStop(1, COLORS.bucketWood);
    ctx.strokeStyle = lg;
    ctx.beginPath();
    ctx.moveTo(bucket.leftTop, bucket.topY);
    ctx.lineTo(bucket.leftBottom, bucket.bottomY);
    ctx.stroke();

    // Right wall
    const rg = ctx.createLinearGradient(bucket.rightTop, bucket.topY, bucket.rightBottom, bucket.bottomY);
    rg.addColorStop(0, COLORS.bucketWoodLight);
    rg.addColorStop(1, COLORS.bucketWood);
    ctx.strokeStyle = rg;
    ctx.beginPath();
    ctx.moveTo(bucket.rightTop, bucket.topY);
    ctx.lineTo(bucket.rightBottom, bucket.bottomY);
    ctx.stroke();

    // Floor
    ctx.strokeStyle = COLORS.bucketWood;
    ctx.beginPath();
    ctx.moveTo(bucket.leftBottom, bucket.bottomY);
    ctx.lineTo(bucket.rightBottom, bucket.bottomY);
    ctx.stroke();

    // Golden rim across the top opening
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.bucketRim;
    ctx.beginPath();
    ctx.moveTo(bucket.leftTop - 4, bucket.topY);
    ctx.lineTo(bucket.rightTop + 4, bucket.topY);
    ctx.stroke();

    // Rim shadow below
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.bucketRimShadow;
    ctx.beginPath();
    ctx.moveTo(bucket.leftTop - 4, bucket.topY + 3);
    ctx.lineTo(bucket.rightTop + 4, bucket.topY + 3);
    ctx.stroke();
}

// Red dashed line when balls are getting dangerously close to the top
function drawOverflowWarning() {
    let highestY = Infinity;
    for (const ball of balls) {
        if (ball.popping > 0) continue;
        const y = ball.body.position.y - ball.radius;
        if (y < highestY) highestY = y;
    }

    const danger = (bucket.topY - highestY) / 80; // 0-1 based on proximity
    if (danger <= 0) return;

    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(0.8, danger * 0.4 + 0.15)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bucket.leftTop + 5, bucket.topY);
    ctx.lineTo(bucket.rightTop - 5, bucket.topY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

// ===================== PARTICLE EFFECTS =====================
// Spawned when balls pop — small dots that fly outward and fade

function spawnPopParticles(x, y, color) {
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        const life = 35 + Math.random() * 25;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            radius: 2 + Math.random() * 3,
            color,
            life,
            maxLife: life,
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // Gravity on particles
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticlesLayer() {
    for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ===================== FLOATING TEXT =====================
// "+12" and "MOT" float upward and fade after scoring

function addFloatingText(x, y, text, color, size) {
    const life = 60;
    floatingTexts.push({ x, y, text, color, size, vy: -1.5, life, maxLife: life });
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const f = floatingTexts[i];
        f.y += f.vy;
        f.life--;
        if (f.life <= 0) floatingTexts.splice(i, 1);
    }
}

function drawFloatingTextsLayer() {
    for (const f of floatingTexts) {
        ctx.globalAlpha = f.life / f.maxLife;
        ctx.fillStyle = f.color;
        ctx.font = `bold ${f.size}px 'Russo One', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
}
