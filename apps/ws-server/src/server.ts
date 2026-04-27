import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { SYMBOLS, type Symbol } from '@exness/shared';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { Redis } from 'ioredis';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { consumeTicket } from './auth.js';
import { SubscriptionRegistry } from './subscriptions.js';

const HEARTBEAT_MS = 30_000;
const GUEST_PREFIX = 'guest:';

export function startWsServer(redis: Redis): SubscriptionRegistry {
  const reg = new SubscriptionRegistry();

  const httpServer = createServer((_req, res) => {
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    void (async () => {
      let userId: string;
      try {
        const sub = await consumeTicket(req.url, redis);
        userId = sub ?? `${GUEST_PREFIX}${randomUUID()}`;
      } catch {
        userId = `${GUEST_PREFIX}${randomUUID()}`;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        onConnect(ws, userId, reg);
      });
    })();
  });

  httpServer.listen(env.WS_SERVER_PORT, () => {
    logger.info({ port: env.WS_SERVER_PORT }, 'ws-server listening');
  });

  return reg;
}

function onConnect(ws: WebSocket, userId: string, reg: SubscriptionRegistry): void {
  reg.register(ws, userId);
  ws.send(JSON.stringify({ type: 'welcome', userId, serverTime: Date.now() }));

  let alive = true;
  const heartbeat = setInterval(() => {
    if (!alive) {
      ws.terminate();
      return;
    }
    alive = false;
    ws.ping();
  }, HEARTBEAT_MS);

  ws.on('pong', () => {
    alive = true;
  });

  ws.on('message', (raw: RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string; assets?: string[]; ts?: number };
      if (msg.type === 'subscribe' && Array.isArray(msg.assets)) {
        for (const a of msg.assets) {
          if (SYMBOLS.includes(a as Symbol)) reg.subscribe(ws, a as Symbol);
        }
      } else if (msg.type === 'unsubscribe' && Array.isArray(msg.assets)) {
        for (const a of msg.assets) {
          if (SYMBOLS.includes(a as Symbol)) reg.unsubscribe(ws, a as Symbol);
        }
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: msg.ts ?? Date.now() }));
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'INVALID_INPUT', message: 'bad frame' }));
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeat);
    reg.unregister(ws);
  });
}
