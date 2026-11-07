"use client";

import { type ChangeEvent, type RefObject, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { MAX_SOURCE_LENGTH, type SourceId } from "@/lib/comparison-schema";

export type ImportedSourceFile = { name: string; edited: boolean };

type SourcePanelProps = {
  source: SourceId;
  value: string;
  onChange: (value: string) => void;
  onImport: (value: string, fileName: string) => void;
  onImportingChange: (importing: boolean) => void;
  importedFile: ImportedSourceFile | null;
  readOnly: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function SourcePanel({ source, value, onChange, onImport, onImportingChange, importedFile, readOnly, inputRef }: SourcePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const overLimit = value.length > MAX_SOURCE_LENGTH;
  const countId = `source-${source.toLowerCase()}-count`;
  const importErrorId = `source-${source.toLowerCase()}-import-error`;

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // Allow importing the same file again after editing its text.
    event.currentTarget.value = "";
    if (!file || readOnly) return;

    setImportError(null);
    if (!/\.(txt|md)$/i.test(file.name)) {
      setImportError("Choose a .txt or .md file.");
      return;
    }
    // A valid 10,000-character UTF-8 text fits within this read limit.
    if (file.size > MAX_SOURCE_LENGTH * 4) {
      setImportError("This file is too large. Choose a text with up to 10,000 characters.");
      return;
    }

    onImportingChange(true);
    try {
      // Match textarea line endings so imported Windows text still supports exact quote location.
      const text = (await file.text()).replace(/\r\n?/g, "\n");
      if (!text.trim()) {
        setImportError("This file is empty. Choose a file containing text.");
        return;
      }
      if (text.length > MAX_SOURCE_LENGTH) {
        setImportError("This file exceeds 10,000 characters. Shorten it before importing.");
        return;
      }
      onImport(text, file.name);
      inputRef.current?.focus();
    } catch {
      setImportError("This file could not be read. Please try again.");
    } finally {
      onImportingChange(false);
    }
  }

  return (
    <section className={`source-panel source-${source.toLowerCase()}`} aria-labelledby={`source-${source}-title`}>
      <div className="source-header">
        <div className="source-identity">
          <span className="source-letter" aria-hidden="true">{source}</span>
          <div>
            <label className="source-title" id={`source-${source}-title`} htmlFor={`source-${source}-input`}>Source {source}</label>
            <p className="source-caption">
              {importedFile ? <><span className="source-filename" title={importedFile.name}>{importedFile.name}</span>{importedFile.edited && <span className="source-file-edited">· Edited</span>}</> : source === "A" ? "First reference" : "Second reference"}
            </p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.md" hidden disabled={readOnly} onChange={importFile} />
        <button type="button" className="source-import-button" disabled={readOnly} onClick={() => { setImportError(null); fileInputRef.current?.click(); }} aria-label={`Import file into Source ${source}`} title="Import a UTF-8 .txt or .md file">
          <Upload size={13} strokeWidth={1.7} aria-hidden="true" />Import
        </button>
      </div>

      {importError && <p className="source-import-error" id={importErrorId} role="alert">{importError}</p>}

      <textarea
        ref={inputRef}
        id={`source-${source}-input`}
        className="source-input"
        value={value}
        onChange={(event) => { setImportError(null); onChange(event.target.value); }}
        readOnly={readOnly}
        spellCheck={false}
        aria-describedby={`${countId}${importError ? ` ${importErrorId}` : ""}`}
        aria-invalid={overLimit}
        placeholder={`Paste your ${source === "A" ? "first" : "second"} source here, or import a .txt / .md file.\n\nAn article, report, announcement, or any text you want to compare. Keep the original wording so every finding can lead back to its source.`}
      />

      <div className={`source-footer${overLimit ? " over-limit" : ""}`} id={countId}>
        <span>{overLimit ? "Text exceeds limit" : readOnly ? "Reading source…" : "Plain text"}</span>
        <span className="character-count">{value.length.toLocaleString("en-US")} <span>/ {MAX_SOURCE_LENGTH.toLocaleString("en-US")}</span></span>
      </div>
    </section>
  );
}
