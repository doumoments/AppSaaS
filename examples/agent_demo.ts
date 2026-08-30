import { SafeStateRuntime, Policy, SagaConnector } from "../sdk/typescript/src/index.ts";

async function main() {
  console.log("==================================================================");
  console.log(" 🛡️  CHRONOSAGENT SAFESTATE: TYPESCRIPT AGENT GUARDRAIL DEMO     ");
  console.log("==================================================================\n");

  const policy = new Policy({
    maxExecutionTimeSec: 20,
    allowedDomains: ["api.github.com", "api.stripe.com"],
    blockedSyscalls: ["sys_raw_socket", "execve", "unlink"],
    autoRollbackOnError: true,
    agentPrompt: "Synchronize issue tracker with GitHub repo",
  });

  const saga = new SagaConnector();
  saga.register("github.issue.create", "github.issue.delete");

  const runtime = new SafeStateRuntime({
    proxyUrl: "http://127.0.0.1:4040",
    policy,
    saga,
  });

  const agentId = "ts-github-sync-bot";
  const sessionId = `sess-${Date.now()}`;

  await runtime.protect(agentId, sessionId, async () => {
    console.log("[1] Calling GitHub API to create ticket...");
    try {
      const res = await runtime.callApi({
        method: "POST",
        targetUrl: "https://api.github.com/repos/doumoments/AppSaaS/issues",
        payload: { title: "Automated sync bugfix", body: "Issue content" },
        actionName: "github.issue.create",
      });
      console.log(" -> ✅ VERDICT: ALLOWED:", res);
    } catch (err: any) {
      console.log(" -> Notice:", err.message);
    }

    console.log("\n[2] Attempting prohibited raw socket / shell call...");
    try {
      await runtime.callApi({
        method: "POST",
        targetUrl: "https://external-host.com/raw_socket",
        payload: { sys: "sys_raw_socket" },
      });
      console.log(" -> ❌ UNEXPECTED: Prohibited action succeeded!");
    } catch (err: any) {
      console.log(" -> 🛡️ DETERMINISTIC BLOCK SUCCESS:", err.message);
    }
  });

  console.log("\n✅ TypeScript Demo Completed Successfully.");
}

main().catch(console.error);
