import React, { useState } from "react";
import { GitFork, RotateCcw, ArrowRight, CheckCircle2, Clock, ShieldCheck, RefreshCw } from "lucide-react";
import { useAgentStore } from "../store/agentStore";

export const SagaDashboard: React.FC = () => {
  const { sagaRecords, selectedSessionId, triggerRollback, loadData } = useAgentStore();
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async () => {
    if (!selectedSessionId) return;
    setIsRollingBack(true);
    const msg = await triggerRollback(selectedSessionId);
    setIsRollingBack(false);
    alert(msg);
  };

  const pendingCount = sagaRecords.filter((r) => r.status === "pending").length;
  const executedCount = sagaRecords.filter((r) => r.status === "executed").length;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Header */}
      <div className="h-14 border-b border-surfaceBorder bg-surface/50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitFork className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Saga External Compensation Engine</h2>
          <span className="text-xs text-gray-400 font-mono px-2 py-0.5 rounded bg-black/40 border border-white/5">
            {sagaRecords.length} Compensations Registered
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-1.5 rounded-lg bg-surfaceCard border border-surfaceBorder text-gray-300 hover:text-white cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleRollback}
            disabled={isRollingBack || !selectedSessionId || pendingCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? "animate-spin" : ""}`} />
            <span>Execute Saga Rollback ({pendingCount} Pending)</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-3 gap-4 p-6 bg-surface/20 border-b border-surfaceBorder">
        <div className="glass-panel p-4 rounded-xl border border-surfaceBorder flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs uppercase font-mono block">Pending Rollbacks</span>
            <span className="text-2xl font-bold text-amber-400 mt-1 block">{pendingCount}</span>
          </div>
          <Clock className="w-8 h-8 text-amber-400/30" />
        </div>

        <div className="glass-panel p-4 rounded-xl border border-surfaceBorder flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs uppercase font-mono block">Executed Compensations</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block">{executedCount}</span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-400/30" />
        </div>

        <div className="glass-panel p-4 rounded-xl border border-surfaceBorder flex items-center justify-between">
          <div>
            <span className="text-gray-400 text-xs uppercase font-mono block">Zero-Trust Moat</span>
            <span className="text-2xl font-bold text-cyan-400 mt-1 block">100% Causal</span>
          </div>
          <ShieldCheck className="w-8 h-8 text-cyan-400/30" />
        </div>
      </div>

      {/* Main Saga Compensations Flow Graph */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Action & Compensating Graph (Saga Pairs)
        </h3>

        <div className="space-y-3">
          {sagaRecords.map((saga) => {
            const isPending = saga.status === "pending";

            return (
              <div
                key={saga.id}
                className="glass-panel p-4 rounded-xl border border-surfaceBorder flex items-center justify-between text-xs font-mono"
              >
                {/* Original Action */}
                <div className="flex-1 p-3 bg-surface/60 rounded-lg border border-surfaceBorder">
                  <span className="text-gray-400 block text-[10px] uppercase">Original Action (Agent Output)</span>
                  <span className="text-cyan-300 font-bold block mt-1">{saga.original_action}</span>
                  <span className="text-gray-400 text-[10px] block mt-1">
                    Service: {saga.target_service} | Agent: {saga.agent_id}
                  </span>
                </div>

                {/* Arrow Connector */}
                <div className="px-4 flex flex-col items-center justify-center text-gray-500">
                  <ArrowRight className="w-5 h-5 text-purple-400" />
                  <span className="text-[9px] uppercase font-bold mt-0.5 text-purple-300">Reversal</span>
                </div>

                {/* Compensating Action */}
                <div className="flex-1 p-3 bg-surface/60 rounded-lg border border-surfaceBorder">
                  <span className="text-gray-400 block text-[10px] uppercase">Compensating Saga Hook</span>
                  <span className="text-purple-300 font-bold block mt-1">{saga.compensating_action}</span>
                  <span className="text-gray-400 text-[10px] block mt-1">
                    Payload: {saga.details ? saga.details.substring(0, 40) + "..." : "{}"}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="ml-4 pl-4 border-l border-surfaceBorder flex flex-col items-end justify-center min-w-[120px]">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      isPending
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {saga.status}
                  </span>
                  <span className="text-[10px] text-gray-500 mt-1">
                    {new Date(saga.created_at * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}

          {sagaRecords.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-xs glass-panel rounded-xl">
              No Saga Compensations registered yet. Connect your agent with `SagaConnector.register(...)` or test with the Simulator.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
