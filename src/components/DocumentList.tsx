// src/components/DocumentList.tsx
import React from "react";
import { Plus, Search, FileText, Trash2, Database } from "lucide-react";
import { useDocumentStore } from "../store/documentStore";
import { useLicenseStore } from "../store/licenseStore";

export const DocumentList: React.FC = () => {
  const {
    documents,
    selectedDocumentId,
    searchQuery,
    selectDocument,
    setSearchQuery,
    createDocument,
    removeDocument,
  } = useDocumentStore();

  const { licenseState } = useLicenseStore();
  const isReadOnly = licenseState === "READ_ONLY" || licenseState === "EXPIRED" || licenseState === "TAMPERED_CLOCK";

  const filteredDocs = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 border-r border-surfaceBorder bg-surface/40 flex flex-col h-full select-none">
      {/* Top action bar */}
      <div className="p-3 border-b border-surfaceBorder flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>SQLite Local ({documents.length})</span>
        </div>

        <button
          onClick={() => createDocument()}
          disabled={isReadOnly}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-medium transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-surfaceBorder/60">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en SQLite local..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-900/90 border border-gray-800 rounded-md text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Document Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredDocs.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            No se encontraron documentos locales.
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isSelected = doc.id === selectedDocumentId;
            return (
              <div
                key={doc.id}
                onClick={() => selectDocument(doc.id)}
                className={`group px-3 py-2.5 rounded-lg flex items-start justify-between gap-2 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-white shadow-sm"
                    : "hover:bg-gray-800/50 text-gray-300 border border-transparent"
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText
                    className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      isSelected ? "text-indigo-400" : "text-gray-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold truncate">
                      {doc.title || "Documento sin título"}
                    </h4>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      {doc.content
                        ? doc.content.replace(/[#*`_]/g, "").substring(0, 40)
                        : "Documento vacío..."}
                    </p>
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDocument(doc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-rose-400 transition-opacity"
                    title="Eliminar documento local"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
