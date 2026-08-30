#!/usr/bin/env python3
"""
ChronosAgent SafeState - Autonomous AI Agent Protection Demo
Demonstrates Zero-Trust Runtime Guardrails, Interception, and Saga Compensations.
"""

import sys
import os
import time

# Ensure chronos_agent SDK is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sdk", "python")))

from chronos_agent import SafeStateRuntime, Policy, SagaConnector, GuardrailViolationError

def run_simulation():
    print("==================================================================")
    print(" 🛡️  CHRONOSAGENT SAFESTATE: AUTONOMOUS AI AGENT GUARDRAIL DEMO  ")
    print("==================================================================\n")

    # 1. Define Security Governance Policy
    policy = Policy(
        max_execution_time_sec=15,
        allowed_domains=["api.github.com", "api.stripe.com", "api.openai.com"],
        blocked_syscalls=["sys_raw_socket", "execve", "unlink", "rmdir"],
        auto_rollback_on_error=True,
        agent_prompt="Analyze user traffic and report billing summaries"
    )

    # 2. Register Saga Compensation Reversals
    saga = SagaConnector()
    saga.register(
        action="stripe.charge.create",
        compensate="stripe.refund.create"
    )
    saga.register(
        action="github.issue.create",
        compensate="github.issue.delete"
    )

    # 3. Initialize Runtime
    runtime = SafeStateRuntime(
        proxy_url="http://127.0.0.1:4040",
        policy=policy,
        saga=saga
    )

    agent_id = "devops-billing-agent-01"
    session_id = f"session-demo-{int(time.time())}"

    print(f"[*] Initializing Protected Execution Sandbox for Agent: '{agent_id}'")
    print(f"[*] Session ID: {session_id}")
    print(f"[*] Policy: Max Time={policy.max_execution_time_sec}s | Allowed={policy.allowed_domains}")
    print(f"[*] Blocked Patterns={policy.blocked_syscalls}\n")

    with runtime.protect(agent_id=agent_id, session_id=session_id):
        # Scenario A: Legitimate External API Call with Saga Registration
        print("[TEST 1] Executing Authorized Billing Action (POST https://api.stripe.com/v1/charges)...")
        try:
            res = runtime.call_api(
                method="POST",
                target_url="https://api.stripe.com/v1/charges",
                payload={"amount": 4900, "currency": "usd", "customer": "cus_9941"},
                action_name="stripe.charge.create"
            )
            print(f" -> ✅ VERDICT: ALLOWED (Latency: {res.get('latency_ms', 0)}ms)")
            print(f" -> 🔄 Saga Compensation Registered: 'stripe.refund.create'")
        except Exception as e:
            print(f" -> ⚠️ Notice: {e}")

        print("\n------------------------------------------------------------------\n")

        # Scenario B: Rogue / Hallucinated Malicious Syscall Attempt
        print("[TEST 2] Agent attempts rogue command execution (execve /rm -rf /data)...")
        try:
            runtime.call_api(
                method="POST",
                target_url="https://internal-worker.local/execute",
                payload={"command": "rm -rf /data && execve /bin/sh"},
                action_name="system.shell.execute"
            )
            print(" -> ❌ UNEXPECTED: Command was allowed!")
        except GuardrailViolationError as gv:
            print(f" -> 🛡️ BLOCKED DETERMINISTICALLY BY ZERO-TRUST GUARDRAIL!")
            print(f" -> Details: {gv}")
            print(" -> 🔁 Saga Compensator triggered: Rolling back prior side-effects...")

    print("\n==================================================================")
    print(" ✅ DEMO EXECUTION COMPLETE. All traces recorded in local SQLite.")
    print("==================================================================")

if __name__ == "__main__":
    run_simulation()
