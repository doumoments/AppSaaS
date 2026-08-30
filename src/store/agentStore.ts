import { create } from "zustand";
import {
  tauriBridge,
  TraceRecord,
  CoWSnapshot,
  SagaRecord,
  SecurityPolicy,
  SimulationResult,
} from "../services/tauriBridge";

interface AgentStore {
  traces: TraceRecord[];
  snapshots: CoWSnapshot[];
  sagaRecords: SagaRecord[];
  policy: SecurityPolicy | null;
  selectedSessionId: string | null;
  timeTravelStep: number;
  isLoading: boolean;
  activeTab: "console" | "network" | "saga" | "policy" | "simulator";

  setActiveTab: (tab: "console" | "network" | "saga" | "policy" | "simulator") => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setTimeTravelStep: (step: number) => void;
  loadData: () => Promise<void>;
  updatePolicy: (policy: SecurityPolicy) => Promise<void>;
  triggerRollback: (sessionId: string) => Promise<string>;
  runSimulation: (
    agentId: string,
    sessionId: string,
    method: string,
    targetUrl: string,
    prompt: string,
    payload: string,
    sagaCompensate?: string
  ) => Promise<SimulationResult>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  traces: [],
  snapshots: [],
  sagaRecords: [],
  policy: null,
  selectedSessionId: null,
  timeTravelStep: 0,
  isLoading: false,
  activeTab: "console",

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedSessionId: (sessionId) => {
    set({ selectedSessionId: sessionId, timeTravelStep: 0 });
    get().loadData();
  },
  setTimeTravelStep: (step) => set({ timeTravelStep: step }),

  loadData: async () => {
    set({ isLoading: true });
    try {
      const traces = await tauriBridge.getRecentTraces(50);
      const policy = await tauriBridge.getSecurityPolicy();
      const sid = get().selectedSessionId || (traces.length > 0 ? traces[0].session_id : undefined);

      const snapshots = await tauriBridge.getCoWSnapshots(sid);
      const sagaRecords = await tauriBridge.getSagaCompensations(sid);

      set({
        traces,
        snapshots,
        sagaRecords,
        policy,
        selectedSessionId: sid || null,
        isLoading: false,
      });
    } catch (err) {
      console.error("Failed to load agent store data:", err);
      set({ isLoading: false });
    }
  },

  updatePolicy: async (policy: SecurityPolicy) => {
    try {
      await tauriBridge.updateSecurityPolicy(policy);
      set({ policy });
    } catch (err) {
      console.error("Failed to update policy:", err);
    }
  },

  triggerRollback: async (sessionId: string) => {
    try {
      const res = await tauriBridge.triggerSagaRollback(sessionId);
      await get().loadData();
      return res.message;
    } catch (err: any) {
      return `Rollback error: ${err.message}`;
    }
  },

  runSimulation: async (
    agentId,
    sessionId,
    method,
    targetUrl,
    prompt,
    payload,
    sagaCompensate
  ) => {
    const res = await tauriBridge.simulateAgentAction(
      agentId,
      sessionId,
      method,
      targetUrl,
      prompt,
      payload,
      sagaCompensate
    );
    await get().loadData();
    return res;
  },
}));
