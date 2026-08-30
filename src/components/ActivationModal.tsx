import React, { useState } from "react";
import { X, Sparkles, Key, Laptop, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useLicenseStore } from "../store/licenseStore";

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({ isOpen, onClose }) => {
  const { activateOnline, fingerprint } = useLicenseStore();
  const [licenseKey, setLicenseKey] = useState("");
  const [deviceName, setDeviceName] = useState("Developer Workstation");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    const success = await activateOnline(licenseKey.trim(), deviceName.trim());
    setIsLoading(false);

    if (success) {
      setStatusMessage({
        type: "success",
        text: "Device activated and cryptographically signed with Ed25519!",
      });
      setTimeout(() => {
        onClose();
      }, 1800);
    } else {
      setStatusMessage({
        type: "error",
        text: "Activation failed. Please verify your license key or device limit in Supabase.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel border border-surfaceBorder rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surfaceBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Activate Hardware Device</h3>
              <p className="text-[11px] text-gray-400">ChronosAgent Offline Cryptographic Licensing</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-mono">
          {/* Fingerprint Info */}
          <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
            <span className="text-gray-400 block text-[10px] uppercase mb-1">Local Hardware Identifier (SHA-256)</span>
            <span className="text-cyan-300 font-bold break-all block text-[11px]">
              {fingerprint || "Detecting Hardware Fingerprint..."}
            </span>
          </div>

          <div>
            <label className="text-gray-300 block mb-1 uppercase text-[10px] font-bold">
              Device Display Name
            </label>
            <div className="relative">
              <Laptop className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full bg-black/50 border border-surfaceBorder rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                placeholder="e.g. MacBook Pro M3 or Windows Station"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-gray-300 block mb-1 uppercase text-[10px] font-bold">
              Commercial License Key
            </label>
            <div className="relative">
              <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="w-full bg-black/50 border border-surfaceBorder rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                placeholder="CHRONOS-XXXX-XXXX-XXXX"
                required
              />
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-[11px] ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                  : "bg-rose-950/60 border border-rose-800 text-rose-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoading ? "Validating Cryptographic Signature..." : "Activate & Bind Device"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
