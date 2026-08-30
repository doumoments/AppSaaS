import React, { useState } from "react";
import {
  History,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Layers,
  Database,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { useAgentStore } from "../store/agentStore";

export const TimeTravelConsole: React.FC = () => {
  const {
    snapshots,
    traces,
    selectedSessionId,
    setSelectedSessionId,
    triggerRollback,
  } = useAgentStore();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Group traces into unique sessions
  const sessions = Array.from(new Set(traces.map((t) => t.session_id)));
  const sessionTraces = traces.filter((t) => t.session_id === selectedSessionId);
  const sessionSnapshots = snapshots.filter((s) => s.session_id === selectedSessionId);

  const activeStep = sessionSnapshots[currentStepIndex] || sessionSnapshots[0];
  const activeTrace = sessionTraces[currentStepIndex] || sessionTraces[0];

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(sessionSnapshots.length - 1, prev + 1));
  };

  const handleRollback = async () => {
    if (selectedSessionId) {
      const msg = await triggerRollback(selectedSessionId);
      alert(msg);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="h-14 border-b border-surfaceBorder bg-surface/50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Time-Travel Debugging & Replay</h2>

          {/* Session Selector */}
          <select
            value={selectedSessionId || ""}
            onChange={(e) => {
              setSelectedSessionId(e.target.value);
              setCurrentStepIndex(0);
            }}
            className="bg-black/50 border border-surfaceBorder text-gray-200 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {sessions.map((s) => (
              <option key={s} value={s}>
                Session: {s}
              </option>
            ))}
            {sessions.length === 0 && <option value="">No Active Sessions</option>}
          </select>
        </div>

        {/* Step-by-Step Navigation & Rollback Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-black/40 border border-surfaceBorder rounded-lg p-1">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex <= 0}
              className="p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30 cursor-pointer"
              title="Step Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-2 text-cyan-400">
              Step {sessionSnapshots.length > 0 ? currentStepIndex + 1 : 0} / {sessionSnapshots.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentStepIndex >= sessionSnapshots.length - 1}
              className="p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30 cursor-pointer"
              title="Step Forward"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleRollback}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rollback Session</span>
          </button>
        </div>
      </div>

      {/* Main Time-Travel Split View */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Column: Interactive Timeline */}
        <div className="col-span-4 border-r border-surfaceBorder bg-surface/30 p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Execution Timeline (CoW Snapshots)
          </h3>

          <div className="space-y-2">
            {sessionSnapshots.map((snap, idx) => {
              const isSelected = idx === currentStepIndex;
              return (
                <div
                  key={snap.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-sm glow-cyan"
                      : "bg-surfaceCard/60 border-surfaceBorder hover:border-gray-600 text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-semibold text-cyan-300">
                      Step #{idx + 1}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(snap.captured_at * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-200 truncate">{snap.state_diff}</p>
                </div>
              );
            })}

            {sessionSnapshots.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-xs">
                No micro-snapshots recorded for this session yet. Run an agent or use the simulator to generate state.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Deep-Dive Memory & State Inspector */}
        <div className="col-span-8 p-6 overflow-y-auto bg-black/20 flex flex-col gap-6">
          {/* Active Step Overview Card */}
          <div className="glass-panel p-5 rounded-xl border border-surfaceBorder">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">
                  Snapshot State Inspection: Step #{currentStepIndex + 1}
                </h4>
              </div>
              {activeTrace && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                    activeTrace.verdict === "ALLOWED"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {activeTrace.verdict === "ALLOWED" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <ShieldAlert className="w-3 h-3" />
                  )}
                  {activeTrace.verdict}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs font-mono mb-4">
              <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
                <span className="text-gray-400 block text-[10px]">AGENT ID</span>
                <span className="text-white font-semibold">{activeStep?.agent_id || "N/A"}</span>
              </div>
              <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
                <span className="text-gray-400 block text-[10px]">LATENCY</span>
                <span className="text-cyan-400 font-semibold">{activeTrace?.latency_ms || 12} ms</span>
              </div>
              <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
                <span className="text-gray-400 block text-[10px]">SNAPSHOT ID</span>
                <span className="text-gray-300 truncate block">{activeStep?.id || "N/A"}</span>
              </div>
            </div>

            {/* Differential State Payload */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Copy-on-Write (CoW) State Delta (Memory Pages & Variables)
              </label>
              <pre className="p-4 bg-black/60 border border-surfaceBorder rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto max-h-64">
                {activeStep
                  ? JSON.stringify(JSON.parse(activeStep.state_diff || "{}"), null, 2)
                  : "// No active snapshot loaded"}
              </pre>
            </div>
          </div>

          {/* Intercepted Request Details */}
          {activeTrace && (
            <div className="glass-panel p-5 rounded-xl border border-surfaceBorder">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                Intercepted Action & Payload
              </h4>
              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder flex items-center justify-between">
                  <span className="text-gray-400">Action:</span>
                  <span className="text-cyan-300 font-bold">{activeTrace.action_type}</span>
                </div>
                {activeTrace.reason && (
                  <div className="p-3 bg-rose-950/40 rounded-lg border border-rose-800/40 text-rose-300">
                    <strong>Guardrail Reason:</strong> {activeTrace.reason}
                  </div>
                )}
                <div>
                  <span className="text-gray-400 block mb-1">Payload Body:</span>
                  <pre className="p-3 bg-black/60 border border-surfaceBorder rounded-lg text-gray-300 overflow-x-auto">
                    {activeTrace.payload || "{}"}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
