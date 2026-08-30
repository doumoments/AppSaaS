import { X, ShieldCheck, Calendar, HardDrive, Check } from "lucide-react";
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
  const { payload, daysRemaining, fingerprint } = useLicenseStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel border border-surfaceBorder rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surfaceBorder flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Subscription & Cryptographic Licensing</h3>
              <p className="text-[11px] text-gray-400">ChronosAgent Enterprise Cloud & Local-First Guardrail</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs font-mono">
          {/* Active Plan Card */}
          <div className="p-4 bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                Current Plan
              </span>
              <h4 className="text-lg font-black text-white mt-0.5">
                {payload?.plan?.toUpperCase() || "PRO COMMERCIAL"} TIER
              </h4>
              <p className="text-gray-400 text-[11px] mt-1">Unlimited Micro-sandboxes & Saga Rollbacks</p>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[11px]">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
              <span className="text-gray-400 text-[10px] block mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-400" />
                DAYS REMAINING
              </span>
              <span className="text-white font-bold text-sm">{daysRemaining} Days</span>
            </div>

            <div className="p-3 bg-surface/80 rounded-lg border border-surfaceBorder">
              <span className="text-gray-400 text-[10px] block mb-1 flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-cyan-400" />
                DEVICE BINDING
              </span>
              <span className="text-cyan-300 font-bold text-sm truncate block">
                {fingerprint?.substring(0, 10)}...
              </span>
            </div>
          </div>

          {/* Features checklist */}
          <div className="p-4 bg-surface/40 rounded-xl border border-surfaceBorder space-y-2">
            <span className="text-gray-400 text-[10px] uppercase font-bold block mb-2">
              Plan Entitlements
            </span>
            <div className="space-y-1.5 text-gray-300 text-[11px]">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero-Trust Intent Firewall (&lt;15ms Latency)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copy-on-Write (CoW) State Differential Snapshots</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saga External Compensation API Reversals</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Offline Cryptographic Verification (Ed25519)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenActivation();
              }}
              className="px-4 py-2 bg-surfaceCard hover:bg-white/10 text-gray-200 border border-surfaceBorder rounded-lg transition cursor-pointer"
            >
              Re-bind Hardware ID
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
