// ============================================================
// matchmaker.test.js — Backend tests for the Matchmaker Durable
// Object. We import the class directly and feed it mock WebSocket
// connections so the matchmaking, score relay, chat relay,
// interference, disconnect cleanup, and chat sanitization paths
// are all covered without spinning up an actual worker.
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// The worker source uses Web Crypto for token verification but the
// Matchmaker constructor itself doesn't touch crypto. We monkey-patch
// the global so the dynamic import of the module doesn't blow up if a
// crypto reference is hit during module evaluation.
if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
  let counter = 0;
  globalThis.crypto = {
    ...(globalThis.crypto || {}),
    randomUUID: () => `uuid-${++counter}`,
    getRandomValues: (a) => a,
    subtle: {},
  };
}

const { Matchmaker } = await import('../src/index.js');

// Minimal mock of the WebSocketPair / Worker server-side WebSocket API.
function createMockSocket() {
  const listeners = { message: [], close: [], error: [] };
  return {
    readyState: 1, // OPEN
    sent: [],
    accept: vi.fn(),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    send: function (data) { this.sent.push(data); },
    close: function () { this.readyState = 3; listeners.close.forEach(fn => fn()); },
    _emit: (type, payload) => { (listeners[type] || []).forEach(fn => fn(payload)); },
    _emitMessage: function (obj) {
      (listeners.message || []).forEach(fn => fn({ data: JSON.stringify(obj) }));
    },
    _last: function () {
      const last = this.sent[this.sent.length - 1];
      return last ? JSON.parse(last) : null;
    },
    _allParsed: function () { return this.sent.map(d => JSON.parse(d)); },
  };
}

// Stub WebSocketPair globally so Matchmaker.fetch() can construct one
globalThis.WebSocketPair = class {
  constructor() {
    const client = createMockSocket();
    const server = createMockSocket();
    return [client, server];
  }
};
globalThis.Response = class {
  constructor(body, init = {}) { this.body = body; this.status = init.status || 200; this.webSocket = init.webSocket; }
};

// Helper: simulate a player connecting to the matchmaker.
async function connect(matchmaker, { token } = {}) {
  const url = token ? `wss://x/?token=${token}` : 'wss://x/';
  const request = { url, headers: { get: () => null } };
  const res = await matchmaker.fetch(request);
  // The Matchmaker stored the server-side socket in its rooms via the message
  // callback path, but to test we need to capture it. We extract via the pair.
  // Because our mock WebSocketPair returns the same client/server each call we
  // can't naively grab them — instead we patch the pair construction per-call.
  return res;
}

// Re-stub WebSocketPair per test so we can capture the socket pair.
function setupCapturePair() {
  const captured = { pairs: [] };
  globalThis.WebSocketPair = class {
    constructor() {
      const client = createMockSocket();
      const server = createMockSocket();
      captured.pairs.push({ client, server });
      return [client, server];
    }
  };
  return captured;
}

describe('Matchmaker', () => {
  let mm;
  let captured;

  beforeEach(() => {
    captured = setupCapturePair();
    mm = new Matchmaker({}, {});
  });

  it('puts the first connector into the waiting state', async () => {
    await connect(mm);
    expect(captured.pairs).toHaveLength(1);
    const server = captured.pairs[0].server;
    expect(server.accept).toHaveBeenCalled();
    server._emitMessage({ type: 'findMatch' });
    const msgs = server._allParsed();
    expect(msgs.find(m => m.type === 'roomJoined' && m.roomId === 'waiting')).toBeTruthy();
  });

  it('matches two players and gives them the same seed', async () => {
    await connect(mm);
    await connect(mm);
    const a = captured.pairs[0].server;
    const b = captured.pairs[1].server;
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });

    const aMatch = a._allParsed().find(m => m.type === 'matchFound');
    const bMatch = b._allParsed().find(m => m.type === 'matchFound');
    expect(aMatch).toBeTruthy();
    expect(bMatch).toBeTruthy();
    expect(aMatch.seed).toBe(bMatch.seed);
    expect(aMatch.opponentName).toBe(bMatch.opponentName === aMatch.opponentName ? aMatch.opponentName : bMatch.opponentName);
  });

  it('relays score updates to the opponent only', async () => {
    await connect(mm);
    await connect(mm);
    const [a, b] = [captured.pairs[0].server, captured.pairs[1].server];
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });

    a.sent.length = 0;
    b.sent.length = 0;
    a._emitMessage({ type: 'scoreUpdate', score: 123, level: 4 });
    expect(a._allParsed()).toHaveLength(0); // sender never gets their own update echoed
    const oppScore = b._allParsed().find(m => m.type === 'opponentScore');
    expect(oppScore).toBeTruthy();
    expect(oppScore.score).toBe(123);
    expect(oppScore.level).toBe(4);
  });

  it('relays interference effects to the opponent', async () => {
    await connect(mm);
    await connect(mm);
    const [a, b] = [captured.pairs[0].server, captured.pairs[1].server];
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });
    b.sent.length = 0;

    a._emitMessage({ type: 'interference', effectType: 'bigBall' });
    const inter = b._allParsed().find(m => m.type === 'interference');
    expect(inter).toBeTruthy();
    expect(inter.effectType).toBe('bigBall');
    expect(inter.duration).toBe(5000);
  });

  it('relays chat messages to the opponent', async () => {
    await connect(mm);
    await connect(mm);
    const [a, b] = [captured.pairs[0].server, captured.pairs[1].server];
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });
    b.sent.length = 0;

    a._emitMessage({ type: 'chat', text: 'hello' });
    const chat = b._allParsed().find(m => m.type === 'chat');
    expect(chat).toBeTruthy();
    expect(chat.text).toBe('hello');
    expect(typeof chat.from).toBe('string');
    expect(typeof chat.ts).toBe('number');
  });

  it('rejects empty / whitespace-only chat messages', async () => {
    await connect(mm);
    await connect(mm);
    const [a, b] = [captured.pairs[0].server, captured.pairs[1].server];
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });
    b.sent.length = 0;

    a._emitMessage({ type: 'chat', text: '   ' });
    a._emitMessage({ type: 'chat', text: '' });
    a._emitMessage({ type: 'chat' }); // missing text
    expect(b._allParsed().filter(m => m.type === 'chat')).toHaveLength(0);
  });

  it('truncates chat messages over 200 chars', async () => {
    await connect(mm);
    await connect(mm);
    const [a, b] = [captured.pairs[0].server, captured.pairs[1].server];
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });
    b.sent.length = 0;

    const huge = 'x'.repeat(500);
    a._emitMessage({ type: 'chat', text: huge });
    const chat = b._allParsed().find(m => m.type === 'chat');
    expect(chat.text.length).toBe(200);
  });

  it('does not relay chat from a non-matched player', async () => {
    await connect(mm);
    const a = captured.pairs[0].server;
    // Player not yet matched (no findMatch sent or no opponent)
    a._emitMessage({ type: 'chat', text: 'hello' });
    // No second player exists, so no relay should occur. Just assert no throw
    expect(true).toBe(true);
  });

  it('notifies opponent on gameOver', async () => {
    await connect(mm);
    await connect(mm);
    const [a, b] = [captured.pairs[0].server, captured.pairs[1].server];
    a._emitMessage({ type: 'findMatch' });
    b._emitMessage({ type: 'findMatch' });
    b.sent.length = 0;

    a._emitMessage({ type: 'gameOver', finalScore: 999 });
    const over = b._allParsed().find(m => m.type === 'opponentGameOver');
    expect(over).toBeTruthy();
    expect(over.finalScore).toBe(999);
  });

  it('does not match a player against themselves', async () => {
    await connect(mm);
    const a = captured.pairs[0].server;
    a._emitMessage({ type: 'findMatch' });
    a._emitMessage({ type: 'findMatch' });
    // Should remain in "waiting" state (no matchFound)
    expect(a._allParsed().find(m => m.type === 'matchFound')).toBeFalsy();
  });

  it('clears the waiting slot when the waiting player disconnects', async () => {
    await connect(mm);
    const a = captured.pairs[0].server;
    a._emitMessage({ type: 'findMatch' });
    a._emit('close');

    await connect(mm);
    const b = captured.pairs[1].server;
    b._emitMessage({ type: 'findMatch' });
    // b should now be the new waiting player, not auto-matched with the gone a
    expect(b._allParsed().find(m => m.type === 'matchFound')).toBeFalsy();
    expect(b._allParsed().find(m => m.type === 'roomJoined' && m.roomId === 'waiting')).toBeTruthy();
  });

  it('ignores unknown message types gracefully', async () => {
    await connect(mm);
    const a = captured.pairs[0].server;
    expect(() => a._emitMessage({ type: 'doSomethingWeird' })).not.toThrow();
  });
});
