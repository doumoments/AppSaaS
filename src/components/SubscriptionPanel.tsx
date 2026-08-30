import React from "react";
import { X, ShieldCheck, Cpu, CreditCard, RefreshCw } from "lucide-react";
import { useLicenseStore } from "../store/licenseStore";

interface SubscriptionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenActivation: () => void;
}

export const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({
  isOpen,
  onClose,
  onOpenActivation,
}) => {
  const { payload, hardwareInfo, licenseState, graceDaysRemaining, initLicense } = useLicenseStore();

  if (!isOpen) return null;

  const formatDate = (timestampSec?: number) => {
    if (!timestampSec) return "N/A";
    return new Date(timestampSec * 1000).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surfaceBorder flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Suscripción y Diagnósticos de Hardware</h2>
              <p className="text-xs text-gray-400">Detalles de licencia Ed25519 e identidad local</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* License Status Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-gray-900 border border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Plan Comercial</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {payload?.plan?.toUpperCase() || "PRO COMMERCIAL"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-gray-400 block mb-0.5">Estado:</span>
                <span className="font-semibold text-white">{licenseState}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Vencimiento del Token:</span>
                <span className="font-semibold text-white">{formatDate(payload?.expires_at)}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Periodo de Gracia Offline:</span>
                <span className="font-semibold text-amber-300">
                  {graceDaysRemaining ? `${graceDaysRemaining} días restantes` : `${payload?.grace_days || 14} días`}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">Emisión:</span>
                <span className="font-semibold text-gray-300">{formatDate(payload?.issued_at)}</span>
              </div>
            </div>
          </div>

          {/* Hardware Diagnostics Card */}
          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Identidad de Hardware Criptográfico (Rust sysinfo):
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 pt-1">
              <div>
                <span className="text-gray-500 block">Equipo (Host):</span>
                <span className="text-gray-200 font-mono">{hardwareInfo?.hostname || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Sistema Operativo:</span>
                <span className="text-gray-200">{hardwareInfo ? `${hardwareInfo.os_name} ${hardwareInfo.os_version}` : "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Procesador (CPU):</span>
                <span className="text-gray-200 truncate block">{hardwareInfo?.cpu_brand || "N/A"} ({hardwareInfo?.cpu_core_count || 0} núcleos)</span>
              </div>
              <div>
                <span className="text-gray-500 block">Memoria RAM Total:</span>
                <span className="text-gray-200">{hardwareInfo?.total_memory_mb ? `${Math.round(hardwareInfo.total_memory_mb / 1024)} GB` : "N/A"}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-800/80">
              <span className="text-[11px] text-gray-500 block mb-1">Hash SHA-256 de Hardware (Inmutable):</span>
              <p className="text-[11px] font-mono text-indigo-300 bg-indigo-950/40 p-2 rounded border border-indigo-900/40 break-all select-all">
                {hardwareInfo?.machine_fingerprint || "Calculando..."}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                initLicense();
              }}
              className="flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar con Supabase</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenActivation();
              }}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Reactivar Dispositivo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
