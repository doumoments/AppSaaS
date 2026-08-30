import React, { useState, useEffect } from "react";
import { Sliders, Save, Plus, X, Shield, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAgentStore } from "../store/agentStore";
import { SecurityPolicy } from "../services/tauriBridge";

export const PolicyEditor: React.FC = () => {
  const { policy, updatePolicy } = useAgentStore();
  const [formData, setFormData] = useState<SecurityPolicy | null>(policy);
  const [newDomain, setNewDomain] = useState("");
  const [newSyscall, setNewSyscall] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (policy) {
      setFormData(policy);
    }
  }, [policy]);

  if (!formData) {
    return <div className="p-8 text-gray-500 text-xs">Loading active security policy...</div>;
  }

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    if (!formData.allowed_domains.includes(newDomain.trim())) {
      setFormData({
        ...formData,
        allowed_domains: [...formData.allowed_domains, newDomain.trim()],
      });
    }
    setNewDomain("");
  };

  const handleRemoveDomain = (domain: string) => {
    setFormData({
      ...formData,
      allowed_domains: formData.allowed_domains.filter((d) => d !== domain),
    });
  };

  const handleAddSyscall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSyscall.trim()) return;
    if (!formData.blocked_syscalls.includes(newSyscall.trim())) {
      setFormData({
        ...formData,
        blocked_syscalls: [...formData.blocked_syscalls, newSyscall.trim()],
      });
    }
    setNewSyscall("");
  };

  const handleRemoveSyscall = (syscall: string) => {
    setFormData({
      ...formData,
      blocked_syscalls: formData.blocked_syscalls.filter((s) => s !== syscall),
    });
  };

  const handleSave = async () => {
    await updatePolicy({ ...formData, updated_at: Date.now() / 1000 });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Header */}
      <div className="h-14 border-b border-surfaceBorder bg-surface/50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Zero-Trust Guardrail Governance Policy</h2>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-500/20 transition cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Apply Policy Changes</span>
            </>
          )}
        </button>
      </div>

      {/* Main Settings Form */}
      <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
        {/* Policy Name & Execution Timeout */}
        <div className="glass-panel p-6 rounded-xl border border-surfaceBorder space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1">
              Policy Profile Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-black/50 border border-surfaceBorder rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Max Execution Timeout per Agent Step
              </label>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {formData.max_execution_time_sec} seconds
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={formData.max_execution_time_sec}
              onChange={(e) =>
                setFormData({ ...formData, max_execution_time_sec: parseInt(e.target.value) })
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-surfaceBorder/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Autonomous Saga Rollback on Error</span>
              <span className="text-[11px] text-gray-400">
                Instantly trigger reverse API compensations when an agent hallucinates or violates policy.
              </span>
            </div>
            <input
              type="checkbox"
              checked={formData.auto_rollback_on_error}
              onChange={(e) =>
                setFormData({ ...formData, auto_rollback_on_error: e.target.checked })
              }
              className="w-4 h-4 accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Allowed External Domains */}
        <div className="glass-panel p-6 rounded-xl border border-surfaceBorder space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Allowed External Domains (L7 Proxy Whitelist)
            </h3>
            <span className="text-[11px] text-gray-400">
              {formData.allowed_domains.length} Domains Authorized
            </span>
          </div>

          <form onSubmit={handleAddDomain} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. api.github.com, api.stripe.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="flex-1 bg-black/50 border border-surfaceBorder rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Domain</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {formData.allowed_domains.map((dom) => (
              <span
                key={dom}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono flex items-center gap-2"
              >
                <span>{dom}</span>
                <button
                  onClick={() => handleRemoveDomain(dom)}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Blocked Syscalls & Dangerous Patterns */}
        <div className="glass-panel p-6 rounded-xl border border-surfaceBorder space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Prohibited Syscalls & Command Patterns (Zero-Trust Blocklist)
            </h3>
            <span className="text-[11px] text-gray-400">
              {formData.blocked_syscalls.length} Guardrails Active
            </span>
          </div>

          <form onSubmit={handleAddSyscall} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. sys_raw_socket, execve, unlink, rmdir"
              value={newSyscall}
              onChange={(e) => setNewSyscall(e.target.value)}
              className="flex-1 bg-black/50 border border-surfaceBorder rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pattern</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {formData.blocked_syscalls.map((sc) => (
              <span
                key={sc}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono flex items-center gap-2"
              >
                <span>{sc}</span>
                <button
                  onClick={() => handleRemoveSyscall(sc)}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
