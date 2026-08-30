// src/components/OfflineBanner.tsx
import React from "react";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { useLicenseStore } from "../store/licenseStore";

interface OfflineBannerProps {
  onOpenActivation: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenActivation }) => {
  const { licenseState, graceDaysRemaining, isOnline, initLicense } = useLicenseStore();

  if (licenseState === "ACTIVE" && isOnline) {
    return null;
  }

  if (licenseState === "TAMPERED_CLOCK") {
    return (
      <div className="bg-rose-950/80 border-b border-rose-800/50 px-4 py-2 flex items-center justify-between text-xs text-rose-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
          <span>
            <strong>Alteración de Reloj Detectada:</strong> La fecha local es anterior a la última ejecución registrada. Sincroniza el reloj del sistema o activa tu licencia en línea.
          </span>
        </div>
        <button
          onClick={onOpenActivation}
          className="px-2.5 py-1 bg-rose-800/60 hover:bg-rose-700/80 rounded text-rose-100 font-semibold text-[11px] transition-colors"
        >
          Sincronizar Licencia
        </button>
      </div>
    );
  }

  if (licenseState === "OFFLINE_GRACE_PERIOD") {
    return (
      <div className="bg-amber-950/80 border-b border-amber-800/50 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <strong>Modo Offline Activo:</strong> Operando bajo periodo de gracia criptográfico. Quedan <strong>{graceDaysRemaining ?? 14} días</strong> para sincronizar con Supabase.
          </span>
        </div>
        <button
          onClick={() => initLicense()}
          className="flex items-center gap-1 px-2.5 py-1 bg-amber-800/60 hover:bg-amber-700/80 rounded text-amber-100 font-semibold text-[11px] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reintentar Conexión</span>
        </button>
      </div>
    );
  }

  if (licenseState === "READ_ONLY" || licenseState === "EXPIRED") {
    return (
      <div className="bg-purple-950/80 border-b border-purple-800/50 px-4 py-2 flex items-center justify-between text-xs text-purple-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span>
            <strong>Modo Solo Lectura:</strong> La licencia expiró o el periodo de gracia ha concluido. Puedes ver y exportar tus datos locales, pero la creación de nuevos registros está deshabilitada.
          </span>
        </div>
        <button
          onClick={onOpenActivation}
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-semibold text-[11px] transition-colors"
        >
          Activar Licencia Pro
        </button>
      </div>
    );
  }

  return null;
};
