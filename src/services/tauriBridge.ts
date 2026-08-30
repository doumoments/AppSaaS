import { invoke } from "@tauri-apps/api/core";

export interface LicensePayload {
  license_id: string;
  user_id: string;
  machine_fingerprint: string;
  plan: string;
  expires_at: number;
  issued_at: number;
}

export interface VerificationResult {
  is_valid: boolean;
  payload?: LicensePayload;
  error?: string;
  days_remaining: number;
}

export interface TraceRecord {
  id: string;
  agent_id: string;
  session_id: string;
  action_type: string;
  payload: string;
  verdict: "ALLOWED" | "BLOCKED" | "ROLLED_BACK";
  reason?: string;
  latency_ms: number;
  created_at: number;
}

export interface CoWSnapshot {
  id: string;
  session_id: string;
  agent_id: string;
  step_index: number;
  state_diff: string;
  captured_at: number;
}

export interface SagaRecord {
  id: string;
  session_id: string;
  agent_id: string;
  original_action: string;
  compensating_action: string;
  target_service: string;
  status: "pending" | "executed" | "failed";
  details: string;
  created_at: number;
  executed_at?: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  max_execution_time_sec: number;
  allowed_domains: string[];
  blocked_syscalls: string[];
  auto_rollback_on_error: boolean;
  updated_at: number;
}

export interface SimulationResult {
  verdict: string;
  reason?: string;
  latency_ms: number;
  trace_id: string;
  snapshot_id?: string;
  saga_id?: string;
}

const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

// In-memory fallback state for browser testing
let mockTraces: TraceRecord[] = [
  {
    id: "tr-init-1",
    agent_id: "devops-auto-fixer-01",
    session_id: "sess-production-104",
    action_type: "POST https://api.stripe.com/v1/charges",
    payload: JSON.stringify({ amount: 4900, currency: "usd", customer: "cus_demo99" }),
    verdict: "ALLOWED",
    latency_ms: 12,
    created_at: Date.now() / 1000 - 120,
  },
  {
    id: "tr-init-2",
    agent_id: "devops-auto-fixer-01",
    session_id: "sess-production-104",
    action_type: "POST https://internal-worker.local/shell",
    payload: JSON.stringify({ command: "rm -rf /data && execve /bin/sh" }),
    verdict: "BLOCKED",
    reason: "Blocked dangerous pattern/syscall detected: 'execve'",
    latency_ms: 6,
    created_at: Date.now() / 1000 - 60,
  },
];

let mockSagaRecords: SagaRecord[] = [
  {
    id: "saga-init-1",
    session_id: "sess-production-104",
    agent_id: "devops-auto-fixer-01",
    original_action: "POST https://api.stripe.com/v1/charges",
    compensating_action: "POST https://api.stripe.com/v1/refunds",
    target_service: "Stripe",
    status: "executed",
    details: "Charge $49.00 refunded due to downstream command failure",
    created_at: Date.now() / 1000 - 120,
    executed_at: Date.now() / 1000 - 58,
  },
];

let mockSnapshots: CoWSnapshot[] = [
  {
    id: "cow-init-1",
    session_id: "sess-production-104",
    agent_id: "devops-auto-fixer-01",
    step_index: Date.now() / 1000 - 120,
    state_diff: JSON.stringify({ action: "POST", url: "https://api.stripe.com/v1/charges", balance_delta: "+$49.00" }),
    captured_at: Date.now() / 1000 - 120,
  },
];

let mockPolicy: SecurityPolicy = {
  id: "default",
  name: "Production Guardrail Policy",
  max_execution_time_sec: 30,
  allowed_domains: ["api.github.com", "api.stripe.com", "api.openai.com", "api.anthropic.com"],
  blocked_syscalls: ["sys_raw_socket", "execve", "unlink", "rmdir"],
  auto_rollback_on_error: true,
  updated_at: Date.now() / 1000,
};

export const tauriBridge = {
  async getMachineFingerprint(): Promise<string> {
    if (isTauri) {
      return await invoke<string>("get_machine_fingerprint");
    }
    return "0d8f99e43b17c91a4572dbbf8923a41cd89912aa44901fbc34a17ef88912ef01";
  },

  async verifyLocalLicense(token: string): Promise<VerificationResult> {
    if (isTauri) {
      return await invoke<VerificationResult>("verify_local_license", { token });
    }
    return {
      is_valid: true,
      payload: {
        license_id: "lic-mock-pro",
        user_id: "usr-dev-local",
        machine_fingerprint: "0d8f99e43b17c91a4572dbbf8923a41cd89912aa44901fbc34a17ef88912ef01",
        plan: "pro",
        expires_at: Date.now() / 1000 + 86400 * 30,
        issued_at: Date.now() / 1000,
      },
      days_remaining: 30,
    };
  },

  async saveCachedLicense(token: string): Promise<void> {
    if (isTauri) {
      await invoke("save_cached_license", { token });
    } else {
      localStorage.setItem("chronosagent_license_cache", token);
    }
  },

  async loadCachedLicense(): Promise<string | null> {
    if (isTauri) {
      return await invoke<string | null>("load_cached_license");
    }
    return localStorage.getItem("chronosagent_license_cache");
  },

  async getRecentTraces(limit: number = 50): Promise<TraceRecord[]> {
    if (isTauri) {
      return await invoke<TraceRecord[]>("get_recent_traces", { limit });
    }
    return [...mockTraces];
  },

  async getCoWSnapshots(sessionId?: string): Promise<CoWSnapshot[]> {
    if (isTauri) {
      return await invoke<CoWSnapshot[]>("get_cow_snapshots", { sessionId });
    }
    if (sessionId) {
      return mockSnapshots.filter((s) => s.session_id === sessionId);
    }
    return [...mockSnapshots];
  },

  async getSagaCompensations(sessionId?: string): Promise<SagaRecord[]> {
    if (isTauri) {
      return await invoke<SagaRecord[]>("get_saga_compensations", { sessionId });
    }
    if (sessionId) {
      return mockSagaRecords.filter((s) => s.session_id === sessionId);
    }
    return [...mockSagaRecords];
  },

  async triggerSagaRollback(sessionId: string): Promise<{ executed_count: number; message: string }> {
    if (isTauri) {
      return await invoke<{ executed_count: number; message: string }>("trigger_saga_rollback", { sessionId });
    }
    let count = 0;
    mockSagaRecords = mockSagaRecords.map((r) => {
      if (r.session_id === sessionId && r.status === "pending") {
        count++;
        return { ...r, status: "executed", executed_at: Date.now() / 1000 };
      }
      return r;
    });
    return {
      executed_count: count,
      message: `Simulated rollback completed. ${count} compensating actions executed.`,
    };
  },

  async getSecurityPolicy(): Promise<SecurityPolicy> {
    if (isTauri) {
      return await invoke<SecurityPolicy>("get_security_policy");
    }
    return { ...mockPolicy };
  },

  async updateSecurityPolicy(policy: SecurityPolicy): Promise<void> {
    if (isTauri) {
      await invoke("update_security_policy", { policy });
    } else {
      mockPolicy = { ...policy };
    }
  },

  async simulateAgentAction(
    agentId: string,
    sessionId: string,
    method: string,
    targetUrl: string,
    prompt: string,
    payload: string,
    sagaCompensate?: string
  ): Promise<SimulationResult> {
    if (isTauri) {
      return await invoke<SimulationResult>("simulate_agent_action", {
        agentId,
        sessionId,
        method,
        targetUrl,
        prompt,
        payload,
        sagaCompensate,
      });
    }

    // Browser simulation logic
    const lowerBody = payload.toLowerCase();
    const isDomainAllowed = mockPolicy.allowed_domains.some((d) => targetUrl.includes(d));
    const hasBlockedSyscall = mockPolicy.blocked_syscalls.some((s) => lowerBody.includes(s.toLowerCase()));
    const isDestructive = lowerBody.includes("rm -rf") || lowerBody.includes("drop table");

    const nowTs = Date.now() / 1000;
    const traceId = `tr-${Date.now()}`;

    if (!isDomainAllowed || hasBlockedSyscall || isDestructive) {
      const reason = !isDomainAllowed
        ? `Domain not allowed: ${targetUrl}`
        : hasBlockedSyscall
        ? `Blocked dangerous pattern detected in payload`
        : `Destructive operation blocked`;

      const blockedTrace: TraceRecord = {
        id: traceId,
        agent_id: agentId,
        session_id: sessionId,
        action_type: `${method} ${targetUrl}`,
        payload,
        verdict: "BLOCKED",
        reason,
        latency_ms: 8,
        created_at: nowTs,
      };
      mockTraces.unshift(blockedTrace);

      if (mockPolicy.auto_rollback_on_error) {
        mockSagaRecords = mockSagaRecords.map((r) =>
          r.session_id === sessionId && r.status === "pending"
            ? { ...r, status: "executed", executed_at: nowTs }
            : r
        );
      }

      return {
        verdict: "BLOCKED",
        reason,
        latency_ms: 8,
        trace_id: traceId,
      };
    }

    // Allowed
    const snapshotId = `cow-${Date.now()}`;
    mockSnapshots.unshift({
      id: snapshotId,
      session_id: sessionId,
      agent_id: agentId,
      step_index: nowTs,
      state_diff: JSON.stringify({ action: method, url: targetUrl }),
      captured_at: nowTs,
    });

    let sagaId: string | undefined;
    if (sagaCompensate) {
      sagaId = `saga-${Date.now()}`;
      mockSagaRecords.unshift({
        id: sagaId,
        session_id: sessionId,
        agent_id: agentId,
        original_action: `${method} ${targetUrl}`,
        compensating_action: sagaCompensate,
        target_service: targetUrl.split("/")[2] || "ExternalAPI",
        status: "pending",
        details: payload,
        created_at: nowTs,
      });
    }

    const allowedTrace: TraceRecord = {
      id: traceId,
      agent_id: agentId,
      session_id: sessionId,
      action_type: `${method} ${targetUrl}`,
      payload,
      verdict: "ALLOWED",
      latency_ms: 14,
      created_at: nowTs,
    };
    mockTraces.unshift(allowedTrace);

    return {
      verdict: "ALLOWED",
      latency_ms: 14,
      trace_id: traceId,
      snapshot_id: snapshotId,
      saga_id: sagaId,
    };
  },
};
