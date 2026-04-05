// API client for Wardogs backend
const API_BASE = 'https://wardogs-api.apexdiligence.workers.dev';

let authToken = null;
let currentUser = null;

export function setApiBase(url) {
    // Called once when we know the backend URL
    window.__WARDOGS_API = url;
}

function getBase() {
    return window.__WARDOGS_API || API_BASE;
}

// ========== AUTH ==========

export function loadSession() {
    authToken = localStorage.getItem('wardogs_token');
    const userData = localStorage.getItem('wardogs_user');
    if (userData) {
        try {
            currentUser = JSON.parse(userData);
        } catch { currentUser = null; }
    }
    return { token: authToken, user: currentUser };
}

export function saveSession(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem('wardogs_token', token);
    localStorage.setItem('wardogs_user', JSON.stringify(user));
}

export function clearSession() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('wardogs_token');
    localStorage.removeItem('wardogs_user');
}

export function isLoggedIn() {
    return authToken !== null && currentUser !== null;
}

export function getUser() {
    return currentUser;
}

// ========== API CALLS ==========

async function apiCall(path, options = {}) {
    const base = getBase();
    if (!base) {
        console.warn('API base not configured');
        return null;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${base}${path}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Erreur serveur');
    }
    return data;
}

export async function signup(username, email, password) {
    const data = await apiCall('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
    });
    if (data && data.token) {
        saveSession(data.token, data.user);
    }
    return data;
}

export async function login(email, password) {
    const data = await apiCall('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    if (data && data.token) {
        saveSession(data.token, data.user);
    }
    return data;
}

export async function submitScore(score, level, wordsFound, bestWord) {
    try {
        return await apiCall('/api/scores', {
            method: 'POST',
            body: JSON.stringify({ score, level, wordsFound, bestWord })
        });
    } catch (err) {
        console.warn('Failed to submit score:', err);
        return null;
    }
}

export async function getMyScores(limit = 20) {
    try {
        return await apiCall(`/api/scores?limit=${limit}`);
    } catch (err) {
        console.warn('Failed to fetch scores:', err);
        return null;
    }
}

export async function getLeaderboard(limit = 10) {
    try {
        return await apiCall(`/api/leaderboard?limit=${limit}`);
    } catch (err) {
        console.warn('Failed to fetch leaderboard:', err);
        return null;
    }
}

export function logout() {
    clearSession();
}
