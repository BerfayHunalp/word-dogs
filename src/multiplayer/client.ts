// ============================================================
// multiplayer/client.ts — WebSocket client for real-time 1v1
// "Stairs?! NOOOOOOO!" — Claptrap (but we're going UP in ranked)
// ============================================================

import type { InterferenceEffect, MultiplayerState } from '../game/types';

export type MultiplayerEvent =
  | { type: 'connected'; roomId: string; playerId: string }
  | { type: 'matched'; opponentName: string; seed: number }
  | { type: 'opponentScore'; score: number; level: number }
  | { type: 'interference'; effect: InterferenceEffect }
  | { type: 'opponentGameOver' }
  | { type: 'disconnected' }
  | { type: 'error'; message: string };

type EventHandler = (event: MultiplayerEvent) => void;

const WS_BASE = 'wss://wardogs-api.apexdiligence.workers.dev/ws';

let ws: WebSocket | null = null;
let handler: EventHandler | null = null;
let state: MultiplayerState = {
  roomId: '', playerId: '', opponentName: '', opponentScore: 0, opponentLevel: 1, connected: false,
};

export function getMultiplayerState(): MultiplayerState { return state; }

export function connectMultiplayer(onEvent: EventHandler, token?: string) {
  handler = onEvent;
  const url = token ? `${WS_BASE}?token=${encodeURIComponent(token)}` : WS_BASE;

  ws = new WebSocket(url);

  ws.onopen = () => {
    state.connected = true;
    ws!.send(JSON.stringify({ type: 'findMatch' }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      handleMessage(msg);
    } catch (e) {
      console.warn('WS parse error:', e);
    }
  };

  ws.onclose = () => {
    state.connected = false;
    handler?.({ type: 'disconnected' });
  };

  ws.onerror = () => {
    handler?.({ type: 'error', message: 'Connection failed' });
  };
}

export function disconnectMultiplayer() {
  if (ws) { ws.close(); ws = null; }
  state = { roomId: '', playerId: '', opponentName: '', opponentScore: 0, opponentLevel: 1, connected: false };
}

// Send score update to opponent
export function sendScoreUpdate(score: number, level: number) {
  send({ type: 'scoreUpdate', score, level });
}

// Send interference effect to opponent
export function sendInterference(effectType: string) {
  send({ type: 'interference', effectType, duration: 5000 });
}

// Notify server that our game is over
export function sendGameOver(finalScore: number) {
  send({ type: 'gameOver', finalScore });
}

function send(data: unknown) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'roomJoined':
      state.roomId = msg.roomId as string;
      state.playerId = msg.playerId as string;
      handler?.({ type: 'connected', roomId: state.roomId, playerId: state.playerId });
      break;

    case 'matchFound':
      state.opponentName = (msg.opponentName as string) || 'Joueur';
      handler?.({ type: 'matched', opponentName: state.opponentName, seed: msg.seed as number });
      break;

    case 'opponentScore':
      state.opponentScore = msg.score as number;
      state.opponentLevel = msg.level as number;
      handler?.({ type: 'opponentScore', score: state.opponentScore, level: state.opponentLevel });
      break;

    case 'interference':
      handler?.({
        type: 'interference',
        effect: {
          type: msg.effectType as InterferenceEffect['type'],
          duration: (msg.duration as number) || 5000,
          timestamp: Date.now(),
        },
      });
      break;

    case 'opponentGameOver':
      handler?.({ type: 'opponentGameOver' });
      break;

    default:
      console.log('Unknown WS message:', msg);
  }
}
