import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Wifi,
  WifiOff,
  Sparkles,
  History,
  Activity,
  GitFork,
  Sliders,
  PlayCircle,
} from "lucide-react";
import { useLicenseStore } from "../store/licenseStore";
import { useAgentStore } from "../store/agentStore";

interface HeaderProps {
  onOpenActivation: () => void;
  onOpenSubscription: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenActivation,
  onOpenSubscription,
}) => {
  const { licenseState, payload, isOnline, fingerprint } = useLicenseStore();
  const { activeTab, setActiveTab } = useAgentStore();

  const getBadge = () => {
    switch (licenseState) {
      case "ACTIVE":
        return (
          <button
            onClick={onOpenSubscription}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SAFEGUARD ACTIVE ({payload?.plan?.toUpperCase() || "PRO"})</span>
          </button>
        );
      case "OFFLINE_GRACE_PERIOD":
        return (
          <button
            onClick={onOpenSubscription}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer animate-pulse"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>GRACE PERIOD</span>
          </button>
        );
      case "TAMPERED_CLOCK":
        return (
          <button
            onClick={onOpenActivation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>CLOCK TAMPERED</span>
          </button>
        );
      default:
        return (
          <button
            onClick={onOpenActivation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ACTIVATE DEVICE</span>
          </button>
        );
    }
  };

  const navItems = [
    { id: "console", label: "Time-Travel", icon: History },
    { id: "network", label: "Network Interceptor", icon: Activity },
    { id: "saga", label: "Saga Rollbacks", icon: GitFork },
    { id: "policy", label: "Security Policy", icon: Sliders },
    { id: "simulator", label: "Agent Simulator", icon: PlayCircle },
  ] as const;

  return (
    <header className="h-14 border-b border-surfaceBorder bg-surface/90 backdrop-blur px-4 flex items-center justify-between select-none z-20">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-white/20">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white">ChronosAgent</h1>
            <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 font-semibold">
              SafeState
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">
            HWID: {fingerprint ? `${fingerprint.substring(0, 8)}...` : "Detecting..."}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Connectivity & License Badges */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 px-2.5 py-1 rounded-md bg-gray-900/60 border border-gray-800">
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-gray-300">Daemon Active (Port 4040)</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-medium">Local-Only</span>
            </>
          )}
        </div>

        {getBadge()}
      </div>
    </header>
  );
};
