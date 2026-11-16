"use client";

import { type ChangeEvent, type RefObject, memo, useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { type SourceId } from "@/lib/comparison-schema";
import { openPdf, type PdfSession } from "@/lib/pdf-import";
import type { ImportedSourceFile } from "@/lib/project-store";
import { PdfImportDialog } from "./pdf-import-dialog";

export type ExcerptLocation = { source: SourceId; quote: string };
const MAX_TEXT_FILE_BYTES = 50 * 1024 * 1024;

type SourcePanelProps = {
  source: SourceId;
  value: string;
  onChange: (source: SourceId, value: string) => void;
  onImport: (source: SourceId, value: string, file: ImportedSourceFile) => void;
  onImportingChange: (importing: boolean) => void;
  importedFile: ImportedSourceFile | null;
  readOnly: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  location: ExcerptLocation | null;
};

export const SourcePanel = memo(function SourcePanel({ source, value, onChange, onImport, onImportingChange, importedFile, readOnly, inputRef, location }: SourcePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importController = useRef<AbortController | null>(null);
  const highlightRef = useRef<HTMLElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [openingPdf, setOpeningPdf] = useState(false);
  const [pdfDraft, setPdfDraft] = useState<{ fileName: string; session: PdfSession } | null>(null);
  const [mode, setMode] = useState<"read" | "edit">(importedFile?.pdf ? "read" : "edit");
  const countId = `source-${source.toLowerCase()}-count`;
  const importErrorId = `source-${source.toLowerCase()}-import-error`;
  const quote = location?.quote;
  const matchStart = useMemo(() => quote ? value.indexOf(quote) : -1, [value, quote]);

  useEffect(() => () => { importController.current?.abort(); }, []);
  useEffect(() => { if (location) setMode("read"); }, [location]);
  useEffect(() => { if (!value) setMode("edit"); }, [value]);
  useEffect(() => {
    if (mode === "read" && location && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightRef.current.focus({ preventScroll: true });
    }
  }, [mode, location]);

  function cancelPdfImport() {
    const controller = importController.current;
    importController.current = null;
    controller?.abort();
    setOpeningPdf(false);
    setPdfDraft(null);
    onImportingChange(false);
  }

  function confirmPdfImport(text: string, file: ImportedSourceFile) {
    if (!pdfDraft || !importController.current || importController.current.signal.aborted) return;
    onImport(source, text, file);
    setMode("read");
    cancelPdfImport();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // Allow importing the same file again after editing its text.
    event.currentTarget.value = "";
    if (!file || readOnly) return;

    setImportError(null);
    if (!/\.(txt|md|pdf)$/i.test(file.name)) {
      setImportError("Choose a .txt, .md, or text-based .pdf file.");
      return;
    }
    const isPdf = /\.pdf$/i.test(file.name);
    if (!isPdf && file.size > MAX_TEXT_FILE_BYTES) {
      setImportError("This text file exceeds 50 MB. Choose a smaller file.");
      return;
    }

    const controller = new AbortController();
    importController.current = controller;
    let awaitingPreview = false;
    onImportingChange(true);
    try {
      if (isPdf) {
        setOpeningPdf(true);
        const session = await openPdf(file, controller.signal);
        if (importController.current !== controller || controller.signal.aborted) { await session.close(); return; }
        awaitingPreview = true;
        setOpeningPdf(false);
        setPdfDraft({ fileName: file.name, session });
        return;
      }
      // Match textarea line endings so imported Windows text still supports exact quote location.
      const text = (await file.text()).replace(/\r\n?/g, "\n");
      if (controller.signal.aborted) return;
      if (!text.trim()) {
        setImportError("This file is empty. Choose a file containing text.");
        return;
      }
      onImport(source, text, { name: file.name, edited: false });
      setMode("edit");
      inputRef.current?.focus();
    } catch (cause) {
      if (!controller.signal.aborted) setImportError(cause instanceof Error && isPdf ? cause.message : "This file could not be read. Please try again.");
    } finally {
      if (!awaitingPreview && importController.current === controller) {
        importController.current = null;
        setOpeningPdf(false);
        onImportingChange(false);
      }
    }
  }

  return (
    <section className={`source-panel source-${source.toLowerCase()}`} aria-labelledby={`source-${source}-title`}>
      <div className="source-header">
        <div className="source-identity">
          <span className="source-letter" aria-hidden="true">{source}</span>
          <div>
            <span className="source-title" id={`source-${source}-title`}>Source {source}</span>
            <p className="source-caption">
              {importedFile ? <><span className="source-filename" title={importedFile.name}>{importedFile.name}</span>{importedFile.edited && <span className="source-file-edited">· Edited</span>}</> : source === "A" ? "First reference" : "Second reference"}
            </p>
            {importedFile?.pdf && <p className="source-pdf-range">PDF · pages {importedFile.pdf.fromPage}–{importedFile.pdf.toPage} of {importedFile.pdf.pageCount}</p>}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" hidden disabled={readOnly} onChange={importFile} />
        <button type="button" className="source-import-button" disabled={readOnly} onClick={() => { setImportError(null); fileInputRef.current?.click(); }} aria-label={`Import file into Source ${source}`} title="Import UTF-8 TXT / Markdown or a text-based PDF up to 50 MB">
          <Upload size={13} strokeWidth={1.7} aria-hidden="true" />Import
        </button>
      </div>

      {importError && <p className="source-import-error" id={importErrorId} role="alert">{importError}</p>}
      {openingPdf && <div className="source-import-progress" role="status"><span>Opening PDF…</span><button type="button" onClick={cancelPdfImport}>Cancel</button></div>}
      {pdfDraft && <PdfImportDialog fileName={pdfDraft.fileName} session={pdfDraft.session} onConfirm={confirmPdfImport} onCancel={cancelPdfImport} />}
      <div className="source-view-tools" role="group" aria-label={`Source ${source} view`}><button type="button" aria-pressed={mode === "read"} disabled={!value} onClick={() => setMode("read")}>Read</button><button type="button" aria-pressed={mode === "edit"} disabled={readOnly} onClick={() => setMode("edit")}>Edit</button><span>{mode === "read" ? "Reading view" : readOnly ? "Read-only while busy" : "Editable text"}</span></div>

      {mode === "read" ? <div className="source-reader" role="region" aria-label={`Source ${source} reading view`} tabIndex={0}>{matchStart >= 0 && location ? <>{value.slice(0, matchStart)}<mark ref={highlightRef} tabIndex={-1}>{location.quote}</mark>{value.slice(matchStart + location.quote.length)}</> : value}</div> : <textarea
        ref={inputRef}
        id={`source-${source}-input`}
        aria-label={`Source ${source}`}
        className="source-input"
        value={value}
        onChange={(event) => { setImportError(null); onChange(source, event.target.value); }}
        readOnly={readOnly}
        spellCheck={false}
        aria-describedby={`${countId}${importError ? ` ${importErrorId}` : ""}`}
        placeholder={`Paste your ${source === "A" ? "first" : "second"} source here, or import TXT, Markdown, or a text-based PDF.\n\nAn article, report, announcement, or any text you want to compare. Keep the original wording so every finding can lead back to its source.`}
      />}

      <div className="source-footer" id={countId}>
        <span>{importedFile?.pdf ? "Extracted PDF text" : "Plain text"}</span>
        <span className="character-count">{value.length.toLocaleString("en-US")} characters</span>
      </div>
    </section>
  );
});
