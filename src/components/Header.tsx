// src/components/Header.tsx
import React from "react";
import { ShieldCheck, ShieldAlert, Cpu, Wifi, WifiOff, Sparkles } from "lucide-react";
import { useLicenseStore } from "../store/licenseStore";

interface HeaderProps {
  onOpenActivation: () => void;
  onOpenSubscription: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenActivation, onOpenSubscription }) => {
  const { licenseState, payload, isOnline, fingerprint } = useLicenseStore();

  const getBadge = () => {
    switch (licenseState) {
      case "ACTIVE":
        return (
          <button
            onClick={onOpenSubscription}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>LICENCIA ACTIVA ({payload?.plan?.toUpperCase() || "PRO"})</span>
          </button>
        );
      case "OFFLINE_GRACE_PERIOD":
        return (
          <button
            onClick={onOpenSubscription}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer animate-pulse"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>PERIODO DE GRACIA</span>
          </button>
        );
      case "TAMPERED_CLOCK":
        return (
          <button
            onClick={onOpenActivation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>RELOJ ALTERADO</span>
          </button>
        );
      default:
        return (
          <button
            onClick={onOpenActivation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ACTIVAR DISPOSITIVO</span>
          </button>
        );
    }
  };

  return (
    <header className="h-14 border-b border-surfaceBorder bg-surface/80 backdrop-blur px-4 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            AppSaaS <span className="text-[10px] text-indigo-400 font-mono px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">Local-First</span>
          </h1>
          <p className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
            HWID: {fingerprint ? `${fingerprint.substring(0, 10)}...` : "Detectando..."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 px-2.5 py-1 rounded-md bg-gray-900/60 border border-gray-800">
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-gray-300">En Línea</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-medium">Fuera de Línea</span>
            </>
          )}
        </div>

        {getBadge()}
      </div>
    </header>
  );
};
