import { AgentStreamEvent } from './wsClient';

export interface AgentCommandInput {
  agent: string;
  action: string;
  data?: Record<string, unknown>;
  correlationId?: string;
}

export interface DispatchedCommand {
  correlationId: string;
  runId?: number;
  status: string;
}

export class AgentCommandDispatcher {
  private apiBase: string;

  constructor(apiBase: string){
    this.apiBase = apiBase.replace(/\/$/, '');
  }

  async send(cmd: AgentCommandInput): Promise<DispatchedCommand> {
    const correlationId = cmd.correlationId || crypto.randomUUID();
    const res = await fetch(`${this.apiBase}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ agent: cmd.agent, action: cmd.action, data: cmd.data, correlationId })
    });
    if(!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Command failed');
    }
    const json = await res.json();
    return { correlationId: json.correlationId, runId: json.runId, status: json.status };
  }

  buildOptimisticEvent(cmd: AgentCommandInput, correlationId?: string): AgentStreamEvent {
    return {
      type: 'client_command',
      agent: cmd.agent,
      action: cmd.action,
      correlationId: correlationId || cmd.correlationId || crypto.randomUUID(),
      ts: new Date().toISOString()
    };
  }
}
