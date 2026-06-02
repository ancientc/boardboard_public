import type { ClientEvent, ServerEvent } from "@/shared/schemas/events";

export type SyncStatus = "disconnected" | "connecting" | "connected";

/**
 * WebSocket client for the Board Durable Object.
 */
export class SyncClient {
  private ws: WebSocket | null = null;
  private status: SyncStatus = "disconnected";
  private onEvent?: (event: ServerEvent) => void;
  private onStatusChange?: (status: SyncStatus) => void;
  private url: string;

  constructor(boardId: string) {
    const proto = typeof window !== "undefined" && location.protocol === "https:" ? "wss" : "ws";
    const host = typeof window !== "undefined" ? location.host : "localhost:3000";
    this.url = `${proto}://${host}/api/boards/${boardId}/ws`;
  }

  connect() {
    this.setStatus("connecting");
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.setStatus("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as ServerEvent;
        this.onEvent?.(parsed);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.setStatus("disconnected");
      setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(event: ClientEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  setEventHandler(handler: (event: ServerEvent) => void) {
    this.onEvent = handler;
  }

  setStatusHandler(handler: (status: SyncStatus) => void) {
    this.onStatusChange = handler;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }
}
