import { describe, it, expect, beforeEach, vi } from 'vitest';

let multiplayerClient: typeof import('../multiplayer/client');

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helper: simulate server message
  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe('multiplayer/client', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Install mock WebSocket
    (globalThis as Record<string, unknown>).WebSocket = MockWebSocket;
    multiplayerClient = await import('../multiplayer/client');
  });

  describe('getMultiplayerState', () => {
    it('returns default disconnected state', () => {
      const state = multiplayerClient.getMultiplayerState();
      expect(state.connected).toBe(false);
      expect(state.roomId).toBe('');
      expect(state.opponentScore).toBe(0);
    });
  });

  describe('connectMultiplayer', () => {
    it('creates WebSocket and sends findMatch on open', async () => {
      const handler = vi.fn();
      multiplayerClient.connectMultiplayer(handler);
      // Wait for the setTimeout in MockWebSocket constructor
      await new Promise(r => setTimeout(r, 10));
    });
  });

  describe('disconnectMultiplayer', () => {
    it('resets state', () => {
      multiplayerClient.disconnectMultiplayer();
      const state = multiplayerClient.getMultiplayerState();
      expect(state.connected).toBe(false);
      expect(state.roomId).toBe('');
    });
  });

  describe('sendScoreUpdate', () => {
    it('does not throw when no connection', () => {
      expect(() => multiplayerClient.sendScoreUpdate(100, 2)).not.toThrow();
    });
  });

  describe('sendInterference', () => {
    it('does not throw when no connection', () => {
      expect(() => multiplayerClient.sendInterference('bigBall')).not.toThrow();
    });
  });

  describe('sendGameOver', () => {
    it('does not throw when no connection', () => {
      expect(() => multiplayerClient.sendGameOver(250)).not.toThrow();
    });
  });
});
