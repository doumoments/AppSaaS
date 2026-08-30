/**
 * ChronosAgent SafeState TypeScript / Node.js SDK
 * Zero-Trust Runtime Guardrail & Deterministic Replay
 */

export interface PolicyConfig {
  maxExecutionTimeSec?: number;
  allowedDomains?: string[];
  blockedSyscalls?: string[];
  autoRollbackOnError?: boolean;
  agentPrompt?: string;
}

export class Policy {
  public maxExecutionTimeSec: number;
  public allowedDomains: string[];
  public blockedSyscalls: string[];
  public autoRollbackOnError: boolean;
  public agentPrompt?: string;

  constructor(config: PolicyConfig = {}) {
    this.maxExecutionTimeSec = config.maxExecutionTimeSec ?? 30;
    this.allowedDomains = config.allowedDomains ?? [
      "api.github.com",
      "api.stripe.com",
      "api.openai.com",
      "api.anthropic.com",
    ];
    this.blockedSyscalls = config.blockedSyscalls ?? [
      "sys_raw_socket",
      "execve",
      "unlink",
      "rmdir",
    ];
    this.autoRollbackOnError = config.autoRollbackOnError ?? true;
    this.agentPrompt = config.agentPrompt;
  }
}

export class SagaConnector {
  private registry: Map<string, string> = new Map();

  public register(action: string, compensate: string): void {
    this.registry.set(action, compensate);
  }

  public getCompensation(action: string): string | undefined {
    return this.registry.get(action);
  }
}

export interface ProtectedCallOptions {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  targetUrl: string;
  payload?: any;
  actionName?: string;
}

export class SafeStateRuntime {
  private proxyUrl: string;
  private policy: Policy;
  private saga: SagaConnector;
  private currentAgentId?: string;
  private currentSessionId?: string;

  constructor(options: {
    proxyUrl?: string;
    policy?: Policy;
    saga?: SagaConnector;
  } = {}) {
    this.proxyUrl = (options.proxyUrl ?? "http://127.0.0.1:4040").replace(/\/$/, "");
    this.policy = options.policy ?? new Policy();
    this.saga = options.saga ?? new SagaConnector();
  }

  public async protect<T>(
    agentId: string,
    sessionId: string,
    callback: () => Promise<T>
  ): Promise<T> {
    this.currentAgentId = agentId;
    this.currentSessionId = sessionId;
    try {
      return await callback();
    } finally {
      this.currentAgentId = undefined;
      this.currentSessionId = undefined;
    }
  }

  public async callApi<T = any>(options: ProtectedCallOptions): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Agent-ID": this.currentAgentId || "agent-anonymous",
      "X-Session-ID": this.currentSessionId || "session-default",
      "X-Target-URL": options.targetUrl,
    };

    if (this.policy.agentPrompt) {
      headers["X-Agent-Prompt"] = this.policy.agentPrompt;
    }

    if (options.actionName) {
      const compensation = this.saga.getCompensation(options.actionName);
      if (compensation) {
        headers["X-Saga-Compensate"] = compensation;
        headers["X-Saga-Service"] = options.targetUrl.split("/")[2] || "ExternalService";
      }
    }

    const response = await fetch(`${this.proxyUrl}/proxy`, {
      method: options.method,
      headers,
      body: options.payload ? JSON.stringify(options.payload) : undefined,
    });

    const data = await response.json();

    if (!response.ok || data.verdict === "BLOCKED") {
      throw new Error(`[ChronosAgent Guardrail Blocked] ${data.reason || JSON.stringify(data)}`);
    }

    return data as T;
  }
}
