import React, { useState } from "react";
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  Terminal,
  Zap,
} from "lucide-react";
import { useAgentStore } from "../store/agentStore";
import { TraceRecord } from "../services/tauriBridge";

export const NetworkInspector: React.FC = () => {
  const { traces, loadData } = useAgentStore();
  const [filterVerdict, setFilterVerdict] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrace, setSelectedTrace] = useState<TraceRecord | null>(null);

  const filteredTraces = traces.filter((t) => {
    const matchesVerdict = filterVerdict === "ALL" || t.verdict === filterVerdict;
    const matchesSearch =
      t.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.agent_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.payload.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesVerdict && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Filter Bar */}
      <div className="h-14 border-b border-surfaceBorder bg-surface/50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Network & Syscall L7 Interceptor</h2>
          <span className="text-xs text-gray-400 font-mono px-2 py-0.5 rounded bg-black/40 border border-white/5">
            {traces.length} Total Interceptions
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search traces, endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/50 border border-surfaceBorder text-gray-200 text-xs rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-500 w-56"
            />
          </div>

          {/* Verdict Filter */}
          <div className="flex items-center gap-1 bg-black/40 border border-surfaceBorder rounded-lg p-1 text-xs">
            {["ALL", "ALLOWED", "BLOCKED"].map((v) => (
              <button
                key={v}
                onClick={() => setFilterVerdict(v)}
                className={`px-2.5 py-1 rounded cursor-pointer transition ${
                  filterVerdict === v
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadData()}
            className="p-1.5 rounded-lg bg-surfaceCard border border-surfaceBorder text-gray-300 hover:text-white cursor-pointer"
            title="Refresh feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Split Feed & Detail Inspector */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Table / List */}
        <div className="col-span-7 border-r border-surfaceBorder overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-surfaceBorder bg-surface/40 text-gray-400">
                <th className="py-2.5 px-4 font-semibold">VERDICT</th>
                <th className="py-2.5 px-4 font-semibold">ACTION / TARGET</th>
                <th className="py-2.5 px-4 font-semibold">AGENT ID</th>
                <th className="py-2.5 px-4 font-semibold text-right">LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {filteredTraces.map((trace) => {
                const isSelected = selectedTrace?.id === trace.id;
                const isAllowed = trace.verdict === "ALLOWED";

                return (
                  <tr
                    key={trace.id}
                    onClick={() => setSelectedTrace(trace)}
                    className={`border-b border-surfaceBorder/40 cursor-pointer transition ${
                      isSelected
                        ? "bg-cyan-500/10 text-white"
                        : "hover:bg-white/5 text-gray-300"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isAllowed
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {isAllowed ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <ShieldAlert className="w-3 h-3" />
                        )}
                        {trace.verdict}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-white truncate max-w-xs">
                      {trace.action_type}
                    </td>
                    <td className="py-3 px-4 text-gray-400 truncate max-w-[120px]">
                      {trace.agent_id}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-cyan-400">
                      {trace.latency_ms} ms
                    </td>
                  </tr>
                );
              })}

              {filteredTraces.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    No intercepted network traffic matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right Detail Pane */}
        <div className="col-span-5 p-6 overflow-y-auto bg-black/20">
          {selectedTrace ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Interception Inspector
                </h3>
                <span className="text-[11px] font-mono text-gray-400">
                  {new Date(selectedTrace.created_at * 1000).toLocaleString()}
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
                  <span className="text-gray-400 block text-[10px] uppercase">Action Endpoint</span>
                  <span className="text-cyan-300 font-bold text-sm block mt-0.5">
                    {selectedTrace.action_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
                    <span className="text-gray-400 block text-[10px] uppercase">Session ID</span>
                    <span className="text-gray-200 truncate block mt-0.5">{selectedTrace.session_id}</span>
                  </div>
                  <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
                    <span className="text-gray-400 block text-[10px] uppercase">Guardrail Overhead</span>
                    <span className="text-emerald-400 font-bold block mt-0.5 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      {selectedTrace.latency_ms} ms (&lt; 20ms standard)
                    </span>
                  </div>
                </div>

                {selectedTrace.reason && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-200">
                    <strong className="block text-rose-400 text-[10px] uppercase">Security Violation:</strong>
                    {selectedTrace.reason}
                  </div>
                )}

                <div>
                  <span className="text-gray-400 block text-[10px] uppercase mb-1">
                    Captured Request Body
                  </span>
                  <pre className="p-3 bg-black/70 border border-surfaceBorder rounded-lg text-gray-300 overflow-x-auto text-[11px] max-h-60">
                    {selectedTrace.payload || "{}"}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 py-12">
              <Activity className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-xs">Select any intercepted action from the list to inspect headers, payload, and guardrail decisions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
