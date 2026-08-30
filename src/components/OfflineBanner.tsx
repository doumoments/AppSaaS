import React from "react";
import { ShieldAlert, AlertTriangle, RefreshCw } from "lucide-react";
import { useLicenseStore } from "../store/licenseStore";

interface OfflineBannerProps {
  onOpenActivation: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenActivation }) => {
  const { licenseState, daysRemaining, errorMessage } = useLicenseStore();

  if (licenseState === "ACTIVE") {
    return null;
  }

  if (licenseState === "TAMPERED_CLOCK") {
    return (
      <div className="bg-rose-950/80 border-b border-rose-800/60 px-4 py-2 flex items-center justify-between text-xs text-rose-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
          <span>
            <strong>System Clock Alteration Detected:</strong> {errorMessage || "Anti-tamper integrity failed. Please adjust your clock to continue."}
          </span>
        </div>
        <button
          onClick={onOpenActivation}
          className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded font-medium transition cursor-pointer"
        >
          Re-synchronize
        </button>
      </div>
    );
  }

  if (licenseState === "OFFLINE_GRACE_PERIOD") {
    return (
      <div className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>
            <strong>Offline Grace Period:</strong> You have {daysRemaining} days remaining before license verification is required.
          </span>
        </div>
        <button
          onClick={onOpenActivation}
          className="px-2.5 py-1 bg-amber-800 hover:bg-amber-700 text-white rounded font-medium flex items-center gap-1 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Verify Online</span>
        </button>
      </div>
    );
  }

  if (licenseState === "UNLICENSED" || licenseState === "EXPIRED") {
    return (
      <div className="bg-cyan-950/80 border-b border-cyan-800/60 px-4 py-2 flex items-center justify-between text-xs text-cyan-200">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span>
            <strong>Evaluation Mode:</strong> Local AI Guardrail active. Activate your commercial license to enable team synchronization and unlimited micro-sandboxes.
          </span>
        </div>
        <button
          onClick={onOpenActivation}
          className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-medium transition cursor-pointer shadow-sm"
        >
          Activate License
        </button>
      </div>
    );
  }

  return null;
};
