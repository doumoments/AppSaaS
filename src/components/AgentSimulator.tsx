import React, { useState } from "react";
import { PlayCircle, ShieldCheck, ShieldAlert, Send, Code2 } from "lucide-react";
import { useAgentStore } from "../store/agentStore";
import { SimulationResult } from "../services/tauriBridge";

export const AgentSimulator: React.FC = () => {
  const { runSimulation } = useAgentStore();

  const [agentId, setAgentId] = useState("devops-lead-agent");
  const [sessionId, setSessionId] = useState(`sess-${Date.now().toString().slice(-6)}`);
  const [method, setMethod] = useState("POST");
  const [targetUrl, setTargetUrl] = useState("https://api.stripe.com/v1/charges");
  const [prompt, setPrompt] = useState("Process subscription payment for customer cus_882");
  const [payload, setPayload] = useState('{\n  "amount": 4900,\n  "currency": "usd"\n}');
  const [sagaCompensate, setSagaCompensate] = useState("POST https://api.stripe.com/v1/refunds");

  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleSimulate = async () => {
    setIsRunning(true);
    try {
      const res = await runSimulation(
        agentId,
        sessionId,
        method,
        targetUrl,
        prompt,
        payload,
        sagaCompensate.trim() || undefined
      );
      setSimResult(res);
    } catch (err: any) {
      alert(`Simulation Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const loadPreset = (type: "ALLOWED" | "BLOCKED" | "SAGA") => {
    if (type === "ALLOWED") {
      setMethod("POST");
      setTargetUrl("https://api.github.com/repos/doumoments/AppSaaS/issues");
      setPrompt("Create an issue for telemetry bugfix");
      setPayload('{\n  "title": "Fix telemetry latency",\n  "body": "Optimize SQLite buffer"\n}');
      setSagaCompensate("DELETE https://api.github.com/repos/doumoments/AppSaaS/issues/1");
    } else if (type === "BLOCKED") {
      setMethod("POST");
      setTargetUrl("https://internal-server.local/shell");
      setPrompt("Summarize server logs");
      setPayload('{\n  "command": "rm -rf /var/log && execve /bin/sh"\n}');
      setSagaCompensate("");
    } else {
      setMethod("POST");
      setTargetUrl("https://api.stripe.com/v1/charges");
      setPrompt("Execute billing transaction");
      setPayload('{\n  "amount": 9900,\n  "customer": "cus_enterprise"\n}');
      setSagaCompensate("POST https://api.stripe.com/v1/refunds");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 border-b border-surfaceBorder bg-surface/50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlayCircle className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Agent Guardrail Live Simulator Workbench</h2>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 font-mono">Presets:</span>
          <button
            onClick={() => loadPreset("ALLOWED")}
            className="px-2.5 py-1 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 rounded cursor-pointer transition font-mono"
          >
            Valid GitHub Issue
          </button>
          <button
            onClick={() => loadPreset("BLOCKED")}
            className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded cursor-pointer transition font-mono"
          >
            Rogue Execve Syscall
          </button>
          <button
            onClick={() => loadPreset("SAGA")}
            className="px-2.5 py-1 bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 rounded cursor-pointer transition font-mono"
          >
            Stripe + Saga Refund
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Input Form */}
        <div className="col-span-7 p-6 border-r border-surfaceBorder overflow-y-auto space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 block text-[10px] uppercase mb-1">Agent ID</label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-gray-400 block text-[10px] uppercase mb-1">Session ID</label>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 block text-[10px] uppercase mb-1">
              Agent Initial Prompt / Intent
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3 py-2 text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <label className="text-gray-400 block text-[10px] uppercase mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="col-span-9">
              <label className="text-gray-400 block text-[10px] uppercase mb-1">Target Endpoint URL</label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 block text-[10px] uppercase mb-1">
              Saga Compensation Action (Optional Reverse Hook)
            </label>
            <input
              type="text"
              placeholder="e.g. POST https://api.stripe.com/v1/refunds"
              value={sagaCompensate}
              onChange={(e) => setSagaCompensate(e.target.value)}
              className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3 py-2 text-purple-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-gray-400 block text-[10px] uppercase mb-1">Request Payload (JSON)</label>
            <textarea
              rows={5}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="w-full bg-black/50 border border-surfaceBorder rounded-lg p-3 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={handleSimulate}
            disabled={isRunning}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isRunning ? "Evaluating Guardrail..." : "Dispatch Action Through Guardrail"}</span>
          </button>
        </div>

        {/* Right Column: Live Decision & Telemetry Output */}
        <div className="col-span-5 p-6 bg-black/30 overflow-y-auto flex flex-col justify-center">
          {simResult ? (
            <div className="space-y-4">
              <div
                className={`glass-panel p-6 rounded-xl border text-center ${
                  simResult.verdict === "ALLOWED"
                    ? "border-emerald-500/40 glow-emerald"
                    : "border-rose-500/40 glow-rose"
                }`}
              >
                <div className="flex justify-center mb-2">
                  {simResult.verdict === "ALLOWED" ? (
                    <ShieldCheck className="w-12 h-12 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-12 h-12 text-rose-400 animate-pulse" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">
                  VERDICT: {simResult.verdict}
                </h3>
                <p className="text-xs font-mono text-gray-300 mt-1">
                  Evaluated in <span className="text-cyan-400 font-bold">{simResult.latency_ms} ms</span>
                </p>
              </div>

              <div className="glass-panel p-4 rounded-xl border border-surfaceBorder space-y-2 text-xs font-mono">
                {simResult.reason && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-200">
                    <strong className="block text-rose-400 text-[10px] uppercase">Reason:</strong>
                    {simResult.reason}
                  </div>
                )}
                <div className="p-2.5 bg-surface/80 rounded-lg flex justify-between">
                  <span className="text-gray-400">Trace ID:</span>
                  <span className="text-gray-200 truncate">{simResult.trace_id}</span>
                </div>
                {simResult.snapshot_id && (
                  <div className="p-2.5 bg-surface/80 rounded-lg flex justify-between">
                    <span className="text-gray-400">CoW Snapshot:</span>
                    <span className="text-emerald-400 font-bold">{simResult.snapshot_id}</span>
                  </div>
                )}
                {simResult.saga_id && (
                  <div className="p-2.5 bg-surface/80 rounded-lg flex justify-between">
                    <span className="text-gray-400">Saga Compensator:</span>
                    <span className="text-purple-400 font-bold">{simResult.saga_id}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 space-y-2">
              <Code2 className="w-12 h-12 text-gray-600 mx-auto" />
              <p className="text-xs font-mono">
                Configure an action on the left or pick a preset, then dispatch it through the Zero-Trust Guardrail.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
