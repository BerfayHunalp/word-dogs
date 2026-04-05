import { loadDictionary, isDictionaryReady } from './dictionary.js';
import { initGame, startGame, stopGame, getHighScore } from './game.js';
import { loadSession, isLoggedIn, getUser, signup, login, logout, submitScore, getMyScores } from './api.js';

// Screen elements
const splashScreen = document.getElementById('splash-screen');
const authScreen = document.getElementById('auth-screen');
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const profileScreen = document.getElementById('profile-screen');

// Auth elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const skipAuthBtn = document.getElementById('skip-auth-btn');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// Menu elements
const startBtn = document.getElementById('start-btn');
const profileBtn = document.getElementById('profile-btn');
const userBadge = document.getElementById('user-badge');
const userBadgeName = document.getElementById('user-badge-name');
const logoutLink = document.getElementById('logout-link');
const menuHighScore = document.getElementById('menu-high-score');

// Game over elements
const retryBtn = document.getElementById('retry-btn');
const menuBtn = document.getElementById('menu-btn');
const finalScore = document.getElementById('final-score');
const finalHighScore = document.getElementById('final-high-score');
const finalWords = document.getElementById('final-words');
const finalBestWord = document.getElementById('final-best-word');

// Profile elements
const profileUsername = document.getElementById('profile-username');
const profileBestScore = document.getElementById('profile-best-score');
const profileTotalGames = document.getElementById('profile-total-games');
const profileTotalWords = document.getElementById('profile-total-words');
const profileHistory = document.getElementById('profile-history');
const profileBackBtn = document.getElementById('profile-back-btn');

// ========== SCREEN MANAGEMENT ==========
function showScreen(screen) {
    [splashScreen, authScreen, menuScreen, gameScreen, gameoverScreen, profileScreen].forEach(s => {
        s.classList.remove('active');
    });
    screen.classList.add('active');
}

// ========== SPLASH ==========
async function init() {
    showScreen(splashScreen);

    // Load session
    loadSession();

    // Load dictionary in parallel with splash timer
    const dictPromise = loadDictionary();
    const splashPromise = new Promise(resolve => setTimeout(resolve, 3000));

    await Promise.all([dictPromise, splashPromise]);

    if (!isDictionaryReady()) {
        console.warn('Dictionary failed to load, using fallback');
    }

    // If already logged in, go to menu. Otherwise show auth.
    if (isLoggedIn()) {
        showMenu();
    } else {
        showAuth();
    }
}

// ========== AUTH ==========
function showAuth() {
    loginError.textContent = '';
    signupError.textContent = '';
    loginForm.style.display = '';
    signupForm.style.display = 'none';
    showScreen(authScreen);
}

showSignupLink.addEventListener('click', e => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = '';
    loginError.textContent = '';
    signupError.textContent = '';
});

showLoginLink.addEventListener('click', e => {
    e.preventDefault();
    loginForm.style.display = '';
    signupForm.style.display = 'none';
    loginError.textContent = '';
    signupError.textContent = '';
});

loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await login(email, password);
        showMenu();
    } catch (err) {
        loginError.textContent = err.message;
    }
});

signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    signupError.textContent = '';
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        await signup(username, email, password);
        showMenu();
    } catch (err) {
        signupError.textContent = err.message;
    }
});

skipAuthBtn.addEventListener('click', () => {
    showMenu();
});

// ========== MENU ==========
function showMenu() {
    menuHighScore.textContent = getHighScore();

    if (isLoggedIn()) {
        const user = getUser();
        userBadge.style.display = '';
        userBadgeName.textContent = user.username;
        profileBtn.style.display = '';
    } else {
        userBadge.style.display = 'none';
        profileBtn.style.display = 'none';
    }

    showScreen(menuScreen);
}

logoutLink.addEventListener('click', e => {
    e.preventDefault();
    logout();
    showAuth();
});

// ========== GAME ==========
startBtn.addEventListener('click', () => {
    launchGame();
});

function launchGame() {
    showScreen(gameScreen);

    initGame({
        onGameOver: (stats) => {
            // Submit score to backend if logged in
            if (isLoggedIn()) {
                submitScore(stats.score, Math.floor(stats.score / 50) + 1, stats.wordsFound, stats.bestWord);
            }
            showGameOver(stats);
        },
        onScoreUpdate: () => {}
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

retryBtn.addEventListener('click', () => {
    stopGame();
    launchGame();
});

menuBtn.addEventListener('click', () => {
    stopGame();
    showMenu();
});

// ========== PROFILE ==========
profileBtn.addEventListener('click', async () => {
    const user = getUser();
    if (!user) return;

    profileUsername.textContent = `@${user.username}`;
    profileBestScore.textContent = '-';
    profileTotalGames.textContent = '-';
    profileTotalWords.textContent = '-';
    profileHistory.innerHTML = '<p style="color:var(--text-dim)">Chargement...</p>';

    showScreen(profileScreen);

    const data = await getMyScores(20);
    if (data) {
        profileBestScore.textContent = data.stats.bestScore;
        profileTotalGames.textContent = data.stats.totalGames;
        profileTotalWords.textContent = data.stats.totalWords;

        if (data.scores.length === 0) {
            profileHistory.innerHTML = '<p style="color:var(--text-dim)">Aucune partie jouée</p>';
        } else {
            profileHistory.innerHTML = data.scores.map(s => `
                <div class="history-item">
                    <span class="history-score">${s.score}</span>
                    <span class="history-words">${s.words_found} mots</span>
                    <span class="history-date">${new Date(s.played_at).toLocaleDateString('fr-FR')}</span>
                </div>
            `).join('');
        }
    } else {
        profileHistory.innerHTML = '<p style="color:var(--text-dim)">Impossible de charger l\'historique</p>';
    }
});

profileBackBtn.addEventListener('click', () => {
    showMenu();
});

// ========== INIT ==========
init();
