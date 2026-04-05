// Wardogs API — Cloudflare Worker with D1

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Simple JWT-like token using HMAC-SHA256
const TOKEN_SECRET = 'wardogs-secret-change-in-production';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Auth routes
            if (path === '/api/signup' && request.method === 'POST') {
                return await handleSignup(request, env);
            }
            if (path === '/api/login' && request.method === 'POST') {
                return await handleLogin(request, env);
            }

            // Protected routes
            const user = await authenticate(request, env);

            if (path === '/api/me' && request.method === 'GET') {
                return json({ user: { id: user.id, username: user.username, email: user.email } });
            }
            if (path === '/api/scores' && request.method === 'POST') {
                return await handleSubmitScore(request, env, user);
            }
            if (path === '/api/scores' && request.method === 'GET') {
                return await handleGetScores(request, env, user);
            }
            if (path === '/api/leaderboard' && request.method === 'GET') {
                return await handleLeaderboard(request, env);
            }

            return json({ error: 'Not found' }, 404);
        } catch (err) {
            if (err.message === 'Unauthorized') {
                return json({ error: 'Non autorisé' }, 401);
            }
            console.error(err);
            return json({ error: 'Erreur serveur' }, 500);
        }
    }
};

// ========== AUTH ==========

async function handleSignup(request, env) {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
        return json({ error: 'Tous les champs sont requis' }, 400);
    }
    if (username.length < 3 || username.length > 20) {
        return json({ error: 'Nom d\'utilisateur: 3-20 caractères' }, 400);
    }
    if (password.length < 6) {
        return json({ error: 'Mot de passe: 6 caractères minimum' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Email invalide' }, 400);
    }

    // Check if username or email already taken
    const existing = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? OR email = ?'
    ).bind(username, email).first();

    if (existing) {
        return json({ error: 'Nom d\'utilisateur ou email déjà utilisé' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await env.DB.prepare(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).bind(username, email, passwordHash).run();

    const userId = result.meta.last_row_id;
    const token = await createToken(userId);

    return json({ token, user: { id: userId, username, email } }, 201);
}

async function handleLogin(request, env) {
    const { email, password } = await request.json();

    if (!email || !password) {
        return json({ error: 'Email et mot de passe requis' }, 400);
    }

    const user = await env.DB.prepare(
        'SELECT id, username, email, password_hash FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
        return json({ error: 'Email ou mot de passe incorrect' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        return json({ error: 'Email ou mot de passe incorrect' }, 401);
    }

    // Update last login
    await env.DB.prepare(
        'UPDATE users SET last_login = datetime(\'now\') WHERE id = ?'
    ).bind(user.id).run();

    const token = await createToken(user.id);
    return json({ token, user: { id: user.id, username: user.username, email: user.email } });
}

// ========== SCORES ==========

async function handleSubmitScore(request, env, user) {
    const { score, level, wordsFound, bestWord } = await request.json();

    if (typeof score !== 'number' || score < 0) {
        return json({ error: 'Score invalide' }, 400);
    }

    await env.DB.prepare(
        'INSERT INTO scores (user_id, score, level, words_found, best_word) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, score, level || 1, wordsFound || 0, bestWord || null).run();

    return json({ success: true });
}

async function handleGetScores(request, env, user) {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    const scores = await env.DB.prepare(
        'SELECT score, level, words_found, best_word, played_at FROM scores WHERE user_id = ? ORDER BY played_at DESC LIMIT ?'
    ).bind(user.id, limit).all();

    // Also get personal best and total games
    const stats = await env.DB.prepare(
        'SELECT MAX(score) as best_score, COUNT(*) as total_games, SUM(words_found) as total_words FROM scores WHERE user_id = ?'
    ).bind(user.id).first();

    return json({
        scores: scores.results,
        stats: {
            bestScore: stats.best_score || 0,
            totalGames: stats.total_games || 0,
            totalWords: stats.total_words || 0
        }
    });
}

async function handleLeaderboard(request, env) {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    const leaderboard = await env.DB.prepare(`
        SELECT u.username, s.score, s.level, s.words_found, s.best_word, s.played_at
        FROM scores s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.score DESC
        LIMIT ?
    `).bind(limit).all();

    return json({ leaderboard: leaderboard.results });
}

// ========== CRYPTO HELPERS ==========

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, salt);
    const hashHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
    const [saltHex, storedHash] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, salt);
    const hashHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === storedHash;
}

async function createToken(userId) {
    const payload = {
        sub: userId,
        exp: Date.now() + TOKEN_EXPIRY,
    };
    const encoded = btoa(JSON.stringify(payload));
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(encoded));
    const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${encoded}.${sigHex}`;
}

async function verifyToken(token) {
    const [encoded, sigHex] = token.split('.');
    if (!encoded || !sigHex) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const sig = new Uint8Array(sigHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(encoded));
    if (!valid) return null;

    const payload = JSON.parse(atob(encoded));
    if (payload.exp < Date.now()) return null;

    return payload;
}

async function authenticate(request, env) {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
        throw new Error('Unauthorized');
    }

    const token = auth.slice(7);
    const payload = await verifyToken(token);
    if (!payload) throw new Error('Unauthorized');

    const user = await env.DB.prepare(
        'SELECT id, username, email FROM users WHERE id = ?'
    ).bind(payload.sub).first();

    if (!user) throw new Error('Unauthorized');
    return user;
}

// ========== UTILS ==========

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
}
