import React, { useState } from "react";
import { X, ShieldCheck, Laptop, Lock, Mail, Loader2, Sparkles } from "lucide-react";
import { supabase, activateDeviceLicense } from "../services/supabase";
import { useLicenseStore } from "../store/licenseStore";

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({ isOpen, onClose }) => {
  const { fingerprint, applyNewToken } = useLicenseStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [deviceName, setDeviceName] = useState("Mi Estación de Trabajo");
  const [manualToken, setManualToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatusMessage({
          type: "success",
          text: "Cuenta creada. Revisa tu correo o inicia sesión para activar tu dispositivo.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Auto-trigger device activation
        const res = await activateDeviceLicense(fingerprint, deviceName);
        if (res.success && res.license_token) {
          const applied = await applyNewToken(res.license_token);
          if (applied) {
            setStatusMessage({ type: "success", text: "¡Dispositivo activado y firmado criptográficamente con éxito!" });
            setTimeout(() => onClose(), 1200);
          } else {
            setStatusMessage({ type: "error", text: "Error al verificar la firma criptográfica local." });
          }
        } else {
          setStatusMessage({ type: "error", text: res.error || "No se pudo activar el dispositivo." });
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Error de autenticación." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualTokenApply = async () => {
    if (!manualToken.trim()) return;
    setIsLoading(true);
    setStatusMessage(null);

    const success = await applyNewToken(manualToken.trim());
    setIsLoading(false);

    if (success) {
      setStatusMessage({ type: "success", text: "Token de licencia offline aplicado con éxito." });
      setTimeout(() => onClose(), 1200);
    } else {
      setStatusMessage({ type: "error", text: "Firma criptográfica inválida o huella de hardware no coincide." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-surface border border-surfaceBorder rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surfaceBorder flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Activación de Licencia Pro</h2>
              <p className="text-xs text-gray-400">Vinculación criptográfica Ed25519 con Supabase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Machine Fingerprint Card */}
          <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1.5 font-medium text-gray-300">
                <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                Huella Criptográfica Local (Hardware ID):
              </span>
            </div>
            <p className="text-xs font-mono text-indigo-300 bg-indigo-950/40 p-2 rounded border border-indigo-900/40 break-all select-all">
              {fingerprint || "Calculando huella de hardware..."}
            </p>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
                  : "bg-rose-950/60 border-rose-800/60 text-rose-300"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSupabaseAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Nombre del Dispositivo</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Ej. PC Principal Oficina"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Correo Electrónico (Supabase Auth)</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isSignUp ? "Registrar y Activar" : "Iniciar Sesión y Activar Dispositivo"}</span>
                </>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {isSignUp ? "¿Ya tienes cuenta? Inicia sesión aquí" : "¿No tienes cuenta? Regístrate aquí"}
              </button>
            </div>
          </form>

          {/* Manual Offline Token Section */}
          <div className="pt-4 border-t border-gray-800 space-y-2">
            <label className="block text-xs font-medium text-gray-400">
              O activa manualmente con un Token Criptográfico Offline:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Pega aquí el token firmado en Base64"
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleManualTokenApply}
                disabled={isLoading || !manualToken}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-200 rounded-lg transition-colors disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
