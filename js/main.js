import { loadDictionary, isDictionaryReady } from './dictionary.js';
import { initGame, startGame, stopGame, getHighScore } from './game.js';

// Screen elements
const splashScreen = document.getElementById('splash-screen');
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const gameoverScreen = document.getElementById('gameover-screen');

// Buttons
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const menuBtn = document.getElementById('menu-btn');

// Score displays
const menuHighScore = document.getElementById('menu-high-score');
const finalScore = document.getElementById('final-score');
const finalHighScore = document.getElementById('final-high-score');
const finalWords = document.getElementById('final-words');
const finalBestWord = document.getElementById('final-best-word');

// ========== SCREEN MANAGEMENT ==========
function showScreen(screen) {
    [splashScreen, menuScreen, gameScreen, gameoverScreen].forEach(s => {
        s.classList.remove('active');
    });
    screen.classList.add('active');
}

// ========== SPLASH ==========
async function init() {
    showScreen(splashScreen);

    // Load dictionary in parallel with splash timer
    const dictPromise = loadDictionary();
    const splashPromise = new Promise(resolve => setTimeout(resolve, 3000));

    await Promise.all([dictPromise, splashPromise]);

    if (!isDictionaryReady()) {
        console.warn('Dictionary failed to load, using fallback');
    }

    showMenu();
}

// ========== MENU ==========
function showMenu() {
    menuHighScore.textContent = getHighScore();
    showScreen(menuScreen);
}

// ========== GAME ==========
function launchGame() {
    showScreen(gameScreen);

    initGame({
        onGameOver: (stats) => {
            showGameOver(stats);
        },
        onScoreUpdate: (score, level) => {
            // Could add effects here
        }
    });

    startGame();
}

// ========== GAME OVER ==========
function showGameOver(stats) {
    finalScore.textContent = stats.score;
    finalHighScore.textContent = stats.highScore;
    finalWords.textContent = stats.wordsFound;
    finalBestWord.textContent = stats.bestWord;
    showScreen(gameoverScreen);
}

// ========== EVENT LISTENERS ==========
startBtn.addEventListener('click', () => {
    launchGame();
});

retryBtn.addEventListener('click', () => {
    stopGame();
    launchGame();
});

menuBtn.addEventListener('click', () => {
    stopGame();
    showMenu();
});

// ========== INIT ==========
init();
