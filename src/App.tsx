import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { OfflineBanner } from "./components/OfflineBanner";
import { DocumentList } from "./components/DocumentList";
import { DocumentEditor } from "./components/DocumentEditor";
import { ActivationModal } from "./components/ActivationModal";
import { SubscriptionPanel } from "./components/SubscriptionPanel";
import { useLicenseStore } from "./store/licenseStore";
import { useDocumentStore } from "./store/documentStore";

export function App() {
  const { initLicense, setOnlineStatus } = useLicenseStore();
  const { loadDocuments } = useDocumentStore();

  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);

  useEffect(() => {
    // 1. Initialize cryptographic license verification and SQLite documents
    initLicense();
    loadDocuments();

    // 2. Setup network connectivity listeners
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-gray-100 font-sans overflow-hidden">
      {/* Top Application Header */}
      <Header
        onOpenActivation={() => setIsActivationOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
      />

      {/* Offline Grace Period & Clock Tamper Warning Banner */}
      <OfflineBanner onOpenActivation={() => setIsActivationOpen(true)} />

      {/* Main Workspace (Local-First Document Engine) */}
      <div className="flex-1 flex overflow-hidden">
        <DocumentList />
        <DocumentEditor />
      </div>

      {/* Modals and Overlays */}
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
