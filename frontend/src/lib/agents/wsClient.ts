/* Lightweight WebSocket client with reconnect & heartbeat */
export interface AgentStreamEvent {
  type: string;
  [key: string]: unknown;
}

export interface WSClientOptions {
  url: string;
  token?: string;
  heartbeatIntervalMs?: number;
  reconnectDelayMs?: number;
  onEvent?: (e: AgentStreamEvent) => void;
  onStatusChange?: (s: 'connecting' | 'open' | 'closed' | 'error') => void;
}

export class AgentsWSClient {
  private ws: WebSocket | null = null;
  private opts: WSClientOptions;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;

  constructor(opts: WSClientOptions){
    this.opts = { heartbeatIntervalMs: 15000, reconnectDelayMs: 3000, ...opts };
  }

  connect(){
    this.closedByUser = false;
    const { url, token } = this.opts;
    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    this.changeStatus('connecting');
    this.ws = new WebSocket(fullUrl);
    this.ws.onopen = () => {
      this.changeStatus('open');
      this.startHeartbeat();
    };
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.changeStatus('closed');
      if(!this.closedByUser){
        this.scheduleReconnect();
      }
    };
    this.ws.onerror = () => {
      this.changeStatus('error');
    };
    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        this.opts.onEvent?.(data);
      } catch {
        this.opts.onEvent?.({ type: 'raw', raw: ev.data });
      }
    };
  }

  private scheduleReconnect(){
    if(this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.opts.reconnectDelayMs);
  }

  private startHeartbeat(){
    this.heartbeatTimer = setInterval(() => {
      try { this.ws?.send(JSON.stringify({ type: 'ping' })); } catch {/* ignore */}
    }, this.opts.heartbeatIntervalMs);
  }
  private stopHeartbeat(){
    if(this.heartbeatTimer){
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(obj: unknown){
    if(this.ws && this.ws.readyState === WebSocket.OPEN){
      this.ws.send(JSON.stringify(obj));
    }
  }

  close(){
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws?.close();
  }

  private changeStatus(s: 'connecting' | 'open' | 'closed' | 'error'){
    this.opts.onStatusChange?.(s);
  }
}
