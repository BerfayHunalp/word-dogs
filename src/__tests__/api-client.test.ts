import { describe, it, expect, beforeEach, vi } from 'vitest';

let apiClient: typeof import('../api/client');

describe('api/client', () => {
  beforeEach(async () => {
    vi.resetModules();
    apiClient = await import('../api/client');
  });

  describe('session management', () => {
    it('isLoggedIn returns false initially', () => {
      apiClient.loadSession();
      expect(apiClient.isLoggedIn()).toBe(false);
    });

    it('isLoggedIn returns true when token + user exist in localStorage', () => {
      localStorage.setItem('wardogs_token', 'test-token');
      localStorage.setItem('wardogs_user', JSON.stringify({ id: 1, username: 'test', email: 'test@test.com' }));
      apiClient.loadSession();
      expect(apiClient.isLoggedIn()).toBe(true);
    });

    it('getUser returns null when not logged in', () => {
      apiClient.loadSession();
      expect(apiClient.getUser()).toBeNull();
    });

    it('getUser returns user data when logged in', () => {
      const user = { id: 1, username: 'testuser', email: 'test@test.com' };
      localStorage.setItem('wardogs_token', 'token');
      localStorage.setItem('wardogs_user', JSON.stringify(user));
      apiClient.loadSession();
      expect(apiClient.getUser()).toEqual(user);
    });

    it('logout clears session', () => {
      localStorage.setItem('wardogs_token', 'token');
      localStorage.setItem('wardogs_user', JSON.stringify({ id: 1, username: 'x', email: 'x@x.com' }));
      apiClient.loadSession();
      expect(apiClient.isLoggedIn()).toBe(true);

      apiClient.logout();
      expect(apiClient.isLoggedIn()).toBe(false);
      expect(apiClient.getUser()).toBeNull();
      expect(localStorage.getItem('wardogs_token')).toBeNull();
    });
  });

  describe('signup', () => {
    it('saves session on successful signup', async () => {
      const mockResponse = {
        token: 'new-token',
        user: { id: 5, username: 'newuser', email: 'new@test.com' },
      };
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await apiClient.signup('newuser', 'new@test.com', 'password123');
      expect(apiClient.isLoggedIn()).toBe(true);
      expect(apiClient.getUser()?.username).toBe('newuser');
      expect(apiClient.getToken()).toBe('new-token');
    });

    it('throws on server error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Email already used' }),
      });

      await expect(apiClient.signup('x', 'x@x.com', 'pass')).rejects.toThrow('Email already used');
    });
  });

  describe('login', () => {
    it('saves session on successful login', async () => {
      const mockResponse = {
        token: 'login-token',
        user: { id: 3, username: 'existing', email: 'e@test.com' },
      };
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await apiClient.login('e@test.com', 'password');
      expect(apiClient.isLoggedIn()).toBe(true);
      expect(apiClient.getToken()).toBe('login-token');
    });

    it('throws on invalid credentials', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      await expect(apiClient.login('wrong@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('submitScore', () => {
    it('returns null on failure instead of throwing', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('network'));
      apiClient.loadSession();
      const result = await apiClient.submitScore(100, 2, 5, 'HELLO');
      expect(result).toBeNull();
    });
  });

  describe('getMyScores', () => {
    it('returns score data on success', async () => {
      localStorage.setItem('wardogs_token', 'token');
      apiClient.loadSession();
      const mockData = { scores: [{ score: 100 }], stats: { bestScore: 100 } };
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await apiClient.getMyScores();
      expect(result).toEqual(mockData);
    });

    it('returns null on failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('fail'));
      const result = await apiClient.getMyScores();
      expect(result).toBeNull();
    });
  });

  describe('getLeaderboard', () => {
    it('returns null on failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('fail'));
      const result = await apiClient.getLeaderboard();
      expect(result).toBeNull();
    });
  });
});
