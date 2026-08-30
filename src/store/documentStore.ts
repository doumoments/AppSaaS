// src/store/documentStore.ts
// Local-First SQLite Document Storage with Instant State Synchronization (<20ms)

import { create } from "zustand";
import { deleteLocalDocument, listLocalDocuments, saveLocalDocument } from "../services/tauriBridge";
import { LocalDocument } from "../types";

interface DocumentStore {
  documents: LocalDocument[];
  selectedDocumentId: string | null;
  searchQuery: string;
  isSaving: boolean;
  isLoading: boolean;

  // Actions
  loadDocuments: () => Promise<void>;
  selectDocument: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  createDocument: () => Promise<LocalDocument>;
  updateDocument: (id: string, title: string, content: string, category?: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  selectedDocumentId: null,
  searchQuery: "",
  isSaving: false,
  isLoading: false,

  loadDocuments: async () => {
    set({ isLoading: true });
    try {
      let docs = await listLocalDocuments();
      if (docs.length === 0) {
        // Seed initial local welcome document
        const initialDoc: LocalDocument = {
          id: "welcome-local-doc",
          title: "🚀 Bienvenido a AppSaaS (Local-First Engine)",
          category: "Guía",
          content: `# Arquitectura Local-First Comercial

Esta aplicación almacena y procesa todos tus datos directamente en **SQLite local** incrustado, garantizando latencias ultra-bajas (<20ms) sin depender de conexión a internet.

### 🛡️ Licenciamiento Criptográfico Offline:
- **Firma Asimétrica:** Verificación matemática con Ed25519.
- **Hardware Fingerprint:** Huella digital única de la máquina.
- **Anti-Tamper:** Detección de alteración en el reloj del sistema.
- **Modo Offline:** Periodo de gracia de hasta 14-30 días sin conexión.

Escribe libremente y experimenta el guardado instantáneo en SQLite.`,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        await saveLocalDocument(initialDoc);
        docs = [initialDoc];
      }

      set({
        documents: docs,
        selectedDocumentId: docs[0]?.id || null,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  selectDocument: (id: string | null) => set({ selectedDocumentId: id }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  createDocument: async () => {
    const newDoc: LocalDocument = {
      id: "doc_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: "Nuevo Documento Local",
      content: "",
      category: "general",
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    set({ isSaving: true });
    await saveLocalDocument(newDoc);
    const docs = await listLocalDocuments();
    set({
      documents: docs,
      selectedDocumentId: newDoc.id,
      isSaving: false,
    });
    return newDoc;
  },

  updateDocument: async (id: string, title: string, content: string, category = "general") => {
    const existing = get().documents.find((d) => d.id === id);
    if (!existing) return;

    const updated: LocalDocument = {
      ...existing,
      title,
      content,
      category,
      updated_at: Date.now(),
    };

    // Optimistic local state update
    const currentDocs = get().documents.map((d) => (d.id === id ? updated : d));
    set({ documents: currentDocs, isSaving: true });

    // Background instant SQLite commit (<20ms)
    await saveLocalDocument(updated);
    set({ isSaving: false });
  },

  removeDocument: async (id: string) => {
    const nextSelected = get().documents.filter((d) => d.id !== id)[0]?.id || null;
    await deleteLocalDocument(id);
    const docs = await listLocalDocuments();
    set({
      documents: docs,
      selectedDocumentId: nextSelected,
    });
  },
}));
