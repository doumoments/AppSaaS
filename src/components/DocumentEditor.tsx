// src/components/DocumentEditor.tsx
import React, { useEffect, useState } from "react";
import { Save, CheckCircle2, Lock, Download } from "lucide-react";
import { useDocumentStore } from "../store/documentStore";
import { useLicenseStore } from "../store/licenseStore";

export const DocumentEditor: React.FC = () => {
  const { documents, selectedDocumentId, updateDocument, isSaving } = useDocumentStore();
  const { licenseState } = useLicenseStore();

  const isReadOnly =
    licenseState === "READ_ONLY" ||
    licenseState === "EXPIRED" ||
    licenseState === "TAMPERED_CLOCK";

  const currentDoc = documents.find((d) => d.id === selectedDocumentId);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (currentDoc) {
      setTitle(currentDoc.title);
      setContent(currentDoc.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [currentDoc?.id]);

  if (!currentDoc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none text-gray-500">
        <p className="text-sm">Selecciona o crea un documento para comenzar a editar.</p>
      </div>
    );
  }

  const handleTitleChange = (newTitle: string) => {
    if (isReadOnly) return;
    setTitle(newTitle);
    updateDocument(currentDoc.id, newTitle, content, currentDoc.category);
  };

  const handleContentChange = (newContent: string) => {
    if (isReadOnly) return;
    setContent(newContent);
    updateDocument(currentDoc.id, title, newContent, currentDoc.category);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentDoc, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentDoc.title || "document"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Editor Top Bar */}
      <div className="h-12 border-b border-surfaceBorder px-6 flex items-center justify-between bg-surface/30">
        <input
          type="text"
          value={title}
          disabled={isReadOnly}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Título del documento..."
          className="text-sm font-bold text-white bg-transparent border-none focus:outline-none flex-1 mr-4 disabled:text-gray-400 placeholder-gray-600"
        />

        <div className="flex items-center gap-3">
          {isReadOnly ? (
            <span className="flex items-center gap-1 text-xs text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              <Lock className="w-3 h-3" />
              <span>Solo Lectura</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              {isSaving ? (
                <>
                  <Save className="w-3 h-3 animate-pulse text-indigo-400" />
                  <span>Guardando en SQLite (&lt;20ms)...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Guardado Local</span>
                </>
              )}
            </span>
          )}

          <button
            onClick={handleExportJson}
            title="Exportar documento local"
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 p-6 flex flex-col">
        <textarea
          value={content}
          disabled={isReadOnly}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Escribe tu contenido aquí... El guardado en SQLite local ocurre instantáneamente."
          className="w-full flex-1 bg-transparent border-none text-gray-200 placeholder-gray-600 font-mono text-sm leading-relaxed focus:outline-none resize-none disabled:text-gray-400"
        />
      </div>
    </main>
  );
};
