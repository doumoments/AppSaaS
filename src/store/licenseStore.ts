import { create } from "zustand";
import { tauriBridge, LicensePayload, VerificationResult } from "../services/tauriBridge";
import { supabaseRPC } from "../services/supabase";

export type LicenseState =
  | "UNINITIALIZED"
  | "ACTIVE"
  | "OFFLINE_GRACE_PERIOD"
  | "TAMPERED_CLOCK"
  | "EXPIRED"
  | "UNLICENSED";

interface LicenseStore {
  licenseState: LicenseState;
  fingerprint: string | null;
  payload: LicensePayload | null;
  daysRemaining: number;
  isOnline: boolean;
  errorMessage: string | null;
  initLicense: () => Promise<void>;
  activateOnline: (licenseKey: string, deviceName: string) => Promise<boolean>;
  setOnlineStatus: (status: boolean) => void;
}

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  licenseState: "UNINITIALIZED",
  fingerprint: null,
  payload: null,
  daysRemaining: 0,
  isOnline: navigator.onLine,
  errorMessage: null,

  setOnlineStatus: (status: boolean) => set({ isOnline: status }),

  initLicense: async () => {
    try {
      const hwid = await tauriBridge.getMachineFingerprint();
      set({ fingerprint: hwid });

      const cachedToken = await tauriBridge.loadCachedLicense();

      if (!cachedToken) {
        set({ licenseState: "UNLICENSED" });
        return;
      }

      // Verify offline cryptographic signature
      const res: VerificationResult = await tauriBridge.verifyLocalLicense(cachedToken);

      if (res.is_valid && res.payload) {
        set({
          licenseState: "ACTIVE",
          payload: res.payload,
          daysRemaining: res.days_remaining,
          errorMessage: null,
        });
      } else {
        if (res.error?.includes("clock") || res.error?.includes("tamper")) {
          set({
            licenseState: "TAMPERED_CLOCK",
            errorMessage: res.error,
          });
        } else if (res.error?.includes("expired")) {
          set({
            licenseState: "EXPIRED",
            errorMessage: "Your commercial subscription license has expired.",
          });
        } else {
          set({
            licenseState: "OFFLINE_GRACE_PERIOD",
            errorMessage: res.error || "Offline verification warning",
          });
        }
      }
    } catch (err: any) {
      console.error("License initialization failed:", err);
      set({
        licenseState: "UNLICENSED",
        errorMessage: err.message || "Failed to initialize cryptographic license",
      });
    }
  },

  activateOnline: async (licenseKey: string, deviceName: string) => {
    try {
      const hwid = get().fingerprint || (await tauriBridge.getMachineFingerprint());
      const rpcRes = await supabaseRPC.activateDeviceLicense(licenseKey, hwid, deviceName);

      if (!rpcRes.success) {
        set({ errorMessage: rpcRes.error || "Activation failed" });
        return false;
      }

      // Construct signed token payload for local verification
      const payloadObj = {
        license_id: rpcRes.license_id,
        user_id: rpcRes.user_id,
        machine_fingerprint: hwid,
        plan: rpcRes.plan,
        expires_at: rpcRes.expires_at,
        issued_at: rpcRes.issued_at,
      };

      const payloadB64 = btoa(JSON.stringify(payloadObj));
      // Mock signature for offline verification
      const mockToken = `${payloadB64}.909465fb30e096f87bc3ecba52288495c0ef7613a8210045ff15d9ca9b7e56b6`;

      await tauriBridge.saveCachedLicense(mockToken);
      await get().initLicense();
      return true;
    } catch (err: any) {
      set({ errorMessage: err.message || "Activation request failed" });
      return false;
    }
  },
}));
