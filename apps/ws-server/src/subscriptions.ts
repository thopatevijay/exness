import { type Symbol } from '@exness/shared';
import type { WebSocket } from 'ws';

// Each connected socket → which user, which symbols subscribed
export type SocketState = {
  userId: string;
  symbols: Set<Symbol>;
};

export class SubscriptionRegistry {
  private bySocket = new Map<WebSocket, SocketState>();
  private byUser = new Map<string, Set<WebSocket>>();
  private bySymbol = new Map<Symbol, Set<WebSocket>>();

  register(ws: WebSocket, userId: string): void {
    this.bySocket.set(ws, { userId, symbols: new Set() });
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Set());
    this.byUser.get(userId)!.add(ws);
  }

  unregister(ws: WebSocket): void {
    const state = this.bySocket.get(ws);
    if (!state) return;
    for (const sym of state.symbols) {
      this.bySymbol.get(sym)?.delete(ws);
    }
    this.byUser.get(state.userId)?.delete(ws);
    if (this.byUser.get(state.userId)?.size === 0) this.byUser.delete(state.userId);
    this.bySocket.delete(ws);
  }

  subscribe(ws: WebSocket, sym: Symbol): void {
    const state = this.bySocket.get(ws);
    if (!state) return;
    state.symbols.add(sym);
    if (!this.bySymbol.has(sym)) this.bySymbol.set(sym, new Set());
    this.bySymbol.get(sym)!.add(ws);
  }

  unsubscribe(ws: WebSocket, sym: Symbol): void {
    const state = this.bySocket.get(ws);
    if (!state) return;
    state.symbols.delete(sym);
    this.bySymbol.get(sym)?.delete(ws);
  }

  socketsForSymbol(sym: Symbol): Set<WebSocket> | undefined {
    return this.bySymbol.get(sym);
  }

  socketsForUser(userId: string): Set<WebSocket> | undefined {
    return this.byUser.get(userId);
  }

  size(): number {
    return this.bySocket.size;
  }
}
