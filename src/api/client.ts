// ============================================================
// api/client.ts — Backend API client (auth, scores, leaderboard)
// ============================================================

const API_BASE = 'https://wardogs-api.apexdiligence.workers.dev';

let authToken: string | null = null;
let currentUser: { id: number; username: string; email: string } | null = null;

export function loadSession() {
  authToken = localStorage.getItem('wardogs_token');
  const data = localStorage.getItem('wardogs_user');
  if (data) try { currentUser = JSON.parse(data); } catch { currentUser = null; }
}

function saveSession(token: string, user: typeof currentUser) {
  authToken = token; currentUser = user;
  localStorage.setItem('wardogs_token', token);
  localStorage.setItem('wardogs_user', JSON.stringify(user));
}

function clearSession() {
  authToken = null; currentUser = null;
  localStorage.removeItem('wardogs_token');
  localStorage.removeItem('wardogs_user');
}

export function isLoggedIn() { return authToken !== null && currentUser !== null; }
export function getUser() { return currentUser; }
export function getToken() { return authToken; }

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string>) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

export async function signup(username: string, email: string, password: string) {
  const data = await api('/api/signup', { method: 'POST', body: JSON.stringify({ username, email, password }) });
  if (data.token) saveSession(data.token, data.user);
  return data;
}

export async function login(email: string, password: string) {
  const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data.token) saveSession(data.token, data.user);
  return data;
}

export function logout() { clearSession(); }

export async function submitScore(score: number, level: number, wordsFound: number, bestWord: string) {
  try { return await api('/api/scores', { method: 'POST', body: JSON.stringify({ score, level, wordsFound, bestWord }) }); }
  catch (e) { console.warn('Score submit failed:', e); return null; }
}

export async function getMyScores(limit = 20) {
  try { return await api(`/api/scores?limit=${limit}`); }
  catch { return null; }
}

export async function getLeaderboard(limit = 10) {
  try { return await api(`/api/leaderboard?limit=${limit}`); }
  catch { return null; }
}
