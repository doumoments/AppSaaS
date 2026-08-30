// src/store/licenseStore.ts
// Zustand Global Store for Cryptographic License State and Hardware Identity

import { create } from "zustand";
import {
  getHardwareDiagnostics,
  getMachineFingerprint,
  saveLicenseCache,
  verifyLocalLicense,
} from "../services/tauriBridge";
import { HardwareInfo, LicensePayload, LicenseStateEnum } from "../types";

interface LicenseStore {
  licenseState: LicenseStateEnum;
  payload: LicensePayload | null;
  fingerprint: string;
  hardwareInfo: HardwareInfo | null;
  graceDaysRemaining: number | null;
  message: string;
  isLoading: boolean;
  isOnline: boolean;

  // Actions
  initLicense: () => Promise<void>;
  applyNewToken: (token: string) => Promise<boolean>;
  setOnlineStatus: (isOnline: boolean) => void;
}

export const useLicenseStore = create<LicenseStore>((set) => ({
  licenseState: "UNACTIVATED",
  payload: null,
  fingerprint: "",
  hardwareInfo: null,
  graceDaysRemaining: null,
  message: "Verificando licencia criptográfica...",
  isLoading: true,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  setOnlineStatus: (isOnline: boolean) => set({ isOnline }),

  initLicense: async () => {
    set({ isLoading: true });
    try {
      const fingerprint = await getMachineFingerprint();
      const hardwareInfo = await getHardwareDiagnostics();
      const verification = await verifyLocalLicense();

      let stateEnum: LicenseStateEnum = "EXPIRED";
      let graceDays: number | null = null;

      if (verification.is_valid) {
        if (typeof verification.state === "object" && "OfflineGracePeriod" in verification.state) {
          stateEnum = "OFFLINE_GRACE_PERIOD";
          graceDays = verification.state.OfflineGracePeriod.days_left;
        } else {
          stateEnum = "ACTIVE";
        }
      } else if (verification.state === "TamperedClock") {
        stateEnum = "TAMPERED_CLOCK";
      } else {
        stateEnum = "READ_ONLY";
      }

      set({
        licenseState: stateEnum,
        payload: verification.payload,
        fingerprint,
        hardwareInfo,
        graceDaysRemaining: graceDays,
        message: verification.message,
        isLoading: false,
      });
    } catch (e: any) {
      set({
        licenseState: "READ_ONLY",
        message: e.message || "Error al validar licencia",
        isLoading: false,
      });
    }
  },

  applyNewToken: async (token: string) => {
    set({ isLoading: true });
    try {
      await saveLicenseCache(token);
      const verification = await verifyLocalLicense(token);

      if (verification.is_valid) {
        set({
          licenseState: "ACTIVE",
          payload: verification.payload,
          graceDaysRemaining: null,
          message: "Dispositivo activado con éxito.",
          isLoading: false,
        });
        return true;
      } else {
        set({
          licenseState: "EXPIRED",
          message: verification.message,
          isLoading: false,
        });
        return false;
      }
    } catch (e: any) {
      set({
        message: e.message || "Error al aplicar token de licencia",
        isLoading: false,
      });
      return false;
    }
  },
}));
