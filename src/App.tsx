import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { OfflineBanner } from "./components/OfflineBanner";
import { TimeTravelConsole } from "./components/TimeTravelConsole";
import { NetworkInspector } from "./components/NetworkInspector";
import { SagaDashboard } from "./components/SagaDashboard";
import { PolicyEditor } from "./components/PolicyEditor";
import { AgentSimulator } from "./components/AgentSimulator";
import { ActivationModal } from "./components/ActivationModal";
import { SubscriptionPanel } from "./components/SubscriptionPanel";
import { useLicenseStore } from "./store/licenseStore";
import { useAgentStore } from "./store/agentStore";

export function App() {
  const { initLicense, setOnlineStatus } = useLicenseStore();
  const { activeTab, loadData } = useAgentStore();

  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);

  useEffect(() => {
    // 1. Initialize cryptographic license verification & Agent telemetry
    initLicense();
    loadData();

    // 2. Setup network connectivity listeners
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic telemetry refresh
    const interval = setInterval(() => {
      loadData();
    }, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-gray-100 font-sans overflow-hidden bg-cyber-grid">
      {/* Top Application Header */}
      <Header
        onOpenActivation={() => setIsActivationOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
      />

      {/* Offline Grace Period & Anti-Tamper Banner */}
      <OfflineBanner onOpenActivation={() => setIsActivationOpen(true)} />

      {/* Main Tab Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === "console" && <TimeTravelConsole />}
        {activeTab === "network" && <NetworkInspector />}
        {activeTab === "saga" && <SagaDashboard />}
        {activeTab === "policy" && <PolicyEditor />}
        {activeTab === "simulator" && <AgentSimulator />}
      </main>

      {/* Modals & Overlays */}
      <ActivationModal
        isOpen={isActivationOpen}
        onClose={() => setIsActivationOpen(false)}
      />

      <SubscriptionPanel
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        onOpenActivation={() => {
          setIsSubscriptionOpen(false);
          setIsActivationOpen(true);
        }}
      />
    </div>
  );
}

export default App;
