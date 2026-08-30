// src/components/DocumentEditor.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Save, CheckCircle2, Lock, Download, FileText } from "lucide-react";
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
  const [category, setCategory] = useState("General");

  useEffect(() => {
    if (currentDoc) {
      setTitle(currentDoc.title);
      setContent(currentDoc.content);
      setCategory(currentDoc.category || "General");
    } else {
      setTitle("");
      setContent("");
      setCategory("General");
    }
  }, [currentDoc?.id]);

  const handleTitleChange = (newTitle: string) => {
    if (isReadOnly || !currentDoc) return;
    setTitle(newTitle);
    updateDocument(currentDoc.id, newTitle, content, category);
  };

  const handleContentChange = (newContent: string) => {
    if (isReadOnly || !currentDoc) return;
    setContent(newContent);
    updateDocument(currentDoc.id, title, newContent, category);
  };

  const handleCategoryChange = (newCategory: string) => {
    if (isReadOnly || !currentDoc) return;
    setCategory(newCategory);
    updateDocument(currentDoc.id, title, content, newCategory);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (currentDoc && !isReadOnly) {
          updateDocument(currentDoc.id, title, content, category);
        }
      }
    },
    [currentDoc, isReadOnly, title, content, category, updateDocument]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleExportJson = () => {
    if (!currentDoc) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentDoc, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentDoc.title || "document"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportMarkdown = () => {
    if (!currentDoc) return;
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(`# ${currentDoc.title}\n\n${currentDoc.content}`);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${currentDoc.title || "document"}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  if (!currentDoc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none text-gray-500">
        <div className="w-12 h-12 rounded-xl bg-surfaceBorder/40 border border-surfaceBorder flex items-center justify-center mb-3">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-300">Ningún documento seleccionado</p>
        <p className="text-xs text-gray-500 mt-1">Crea un nuevo documento o selecciona uno del menú lateral.</p>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Editor Top Bar */}
      <div className="h-12 border-b border-surfaceBorder px-6 flex items-center justify-between bg-surface/40 backdrop-blur">
        <div className="flex items-center gap-3 flex-1 mr-4">
          <input
            type="text"
            value={title}
            disabled={isReadOnly}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Título del documento..."
            className="text-sm font-bold text-white bg-transparent border-none focus:outline-none flex-1 disabled:text-gray-400 placeholder-gray-600"
          />

          <select
            value={category}
            disabled={isReadOnly}
            onChange={(e) => handleCategoryChange(e.target.value)}
            aria-label="Categoría del documento"
            className="text-[11px] bg-surfaceBorder/40 border border-surfaceBorder text-gray-300 rounded px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value="General">General</option>
            <option value="Facturación">Facturación</option>
            <option value="Contratos">Contratos</option>
            <option value="Notas Técnicas">Notas Técnicas</option>
            <option value="Proyectos">Proyectos</option>
          </select>
        </div>

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
                  <span className="font-mono text-indigo-300">Guardando en SQLite (&lt;20ms)...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="font-mono text-emerald-400/90">SQLite Local OK</span>
                </>
              )}
            </span>
          )}

          <div className="flex items-center gap-1.5 border-l border-surfaceBorder pl-3">
            <button
              onClick={handleExportMarkdown}
              title="Exportar a Markdown (.md)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3 text-indigo-400" />
              <span>.MD</span>
            </button>

            <button
              onClick={handleExportJson}
              title="Exportar a JSON (.json)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3 text-purple-400" />
              <span>.JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 p-6 flex flex-col">
        <textarea
          value={content}
          disabled={isReadOnly}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Escribe tu contenido aquí... El guardado en SQLite local ocurre instantáneamente con cero latencia de red."
          className="w-full flex-1 bg-transparent border-none text-gray-200 placeholder-gray-600 font-mono text-sm leading-relaxed focus:outline-none resize-none disabled:text-gray-400"
        />
      </div>

      {/* Editor Bottom Bar: Stats */}
      <div className="h-7 border-t border-surfaceBorder px-6 flex items-center justify-between text-[10px] text-gray-500 font-mono bg-surface/20 select-none">
        <div className="flex items-center gap-4">
          <span>{wordCount} palabras</span>
          <span>{charCount} caracteres</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span>Atajo: <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px]">Ctrl+S</kbd></span>
        </div>
      </div>
    </main>
  );
};
