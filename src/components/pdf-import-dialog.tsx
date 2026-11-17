"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, LoaderCircle, X } from "lucide-react";
import { AUTO_PREVIEW_PAGE_LIMIT, type PdfSession } from "@/lib/pdf-import";
import type { ImportedSourceFile } from "@/lib/project-store";
import type { PdfPageMap } from "@/lib/pdf-page-map";

type PdfImportDialogProps = {
  fileName: string;
  session: PdfSession;
  onConfirm: (text: string, file: ImportedSourceFile) => void;
  onCancel: () => void;
};

export function PdfImportDialog({ fileName, session, onConfirm, onCancel }: PdfImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  const autoStarted = useRef(false);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState(String(session.pageCount));
  const [applied, setApplied] = useState<{ fromPage: number; toPage: number } | null>(null);
  const [preview, setPreview] = useState("");
  const [original, setOriginal] = useState("");
  const [pageMap, setPageMap] = useState<PdfPageMap>();
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [emptyPages, setEmptyPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const first = Number(from);
  const last = Number(to);
  const validRange = /^\d+$/.test(from) && /^\d+$/.test(to) && first >= 1 && last >= first && last <= session.pageCount;
  const rangeChanged = !applied || first !== applied.fromPage || last !== applied.toPage;
  const edited = preview !== original;
  const canImport = Boolean(applied && validRange && !rangeChanged && !extracting && !error && preview.trim());

  useEffect(() => {
    alive.current = true;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { alive.current = false; dialog?.close(); };
  }, []);

  async function extractRange(fromPage: number, toPage: number) {
    setExtracting(true);
    setError(null);
    setProgress({ done: 0, total: toPage - fromPage + 1 });
    try {
      const result = await session.extract(fromPage, toPage, (done, total) => { if (alive.current) setProgress({ done, total }); });
      if (!alive.current) return;
      setApplied({ fromPage, toPage });
      setPreview(result.text);
      setOriginal(result.text);
      setPageMap(result.pageMap);
      setEmptyPages(result.emptyPages.length);
      if (!result.text.trim()) setError("These pages contain no extractable text. Scanned or image-only pages need OCR, which is not supported here.");
    } catch {
      if (alive.current) setError("These pages could not be read. Try another page range or PDF.");
    } finally { if (alive.current) setExtracting(false); }
  }

  useEffect(() => {
    if (!autoStarted.current && session.pageCount <= AUTO_PREVIEW_PAGE_LIMIT) {
      autoStarted.current = true;
      void extractRange(1, session.pageCount);
    }
  }, [session]);

  return createPortal(
    <dialog ref={dialogRef} className="pdf-dialog" aria-labelledby="pdf-import-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <form className="pdf-dialog-form" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); if (canImport && applied) onConfirm(preview, { name: fileName, edited, pdf: { pageCount: session.pageCount, ...applied, ...(!edited && pageMap ? { pageMap } : {}) } }); }}>
        <header className="pdf-dialog-header">
          <div><p className="eyebrow"><FileText size={13} aria-hidden="true" />PDF IMPORT</p><h2 id="pdf-import-title">Preview PDF text.</h2><p className="pdf-file-name" title={fileName}>{fileName} <span>· {session.pageCount} {session.pageCount === 1 ? "page" : "pages"}</span></p></div>
          <button type="button" className="pdf-close" onClick={onCancel} aria-label="Cancel PDF import"><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="pdf-range-bar">
          <div className="pdf-range-inputs"><label>From page<input type="number" min={1} max={session.pageCount} step={1} value={from} onChange={(event) => { setFrom(event.target.value); setError(null); }} disabled={extracting} /></label><span aria-hidden="true">—</span><label>To page<input type="number" min={1} max={session.pageCount} step={1} value={to} onChange={(event) => { setTo(event.target.value); setError(null); }} disabled={extracting} /></label></div>
          <div className="pdf-extract-actions">
            <button type="button" className="button button-secondary" disabled={extracting} onClick={() => { setFrom("1"); setTo(String(session.pageCount)); void extractRange(1, session.pageCount); }}>Extract all pages</button>
            <button type="button" className="button button-secondary" disabled={!validRange || extracting} onClick={() => { void extractRange(first, last); }}>{extracting ? <LoaderCircle size={14} className="spinner" aria-hidden="true" /> : null}{extracting ? "Extracting…" : "Extract selected pages"}</button>
          </div>
        </div>
        <div className="pdf-preview-info" role="status">{extracting ? `Extracting page ${progress.done} of ${progress.total}…` : !applied ? "Extract all pages or choose a range to preview." : rangeChanged ? "Extract the new range before importing. This replaces any preview edits." : `Pages ${applied.fromPage}–${applied.toPage}. Check the reading order and edit if needed.`}</div>
        {!validRange && <p className="pdf-message" role="alert">Choose whole page numbers from 1 to {session.pageCount}, with the start before or equal to the end.</p>}
        {error && <p className="pdf-message" role="alert">{error}</p>}
        {!error && emptyPages > 0 && <p className="pdf-message">{emptyPages} selected {emptyPages === 1 ? "page has" : "pages have"} no extractable text. Review the preview for missing content.</p>}
        {applied && !rangeChanged && !extracting && (edited || !pageMap) && <p className="pdf-edit-note">{edited ? "Preview edited · PDF page references will be unavailable." : "PDF page references could not be recorded. The text can still be imported."}</p>}
        <label className="sr-only" htmlFor="pdf-text-preview">PDF text preview</label>
        <textarea id="pdf-text-preview" className="pdf-preview" value={preview} disabled={!applied || extracting} spellCheck={false} onChange={(event) => setPreview(event.target.value)} placeholder="Extracted text will appear here for review." aria-describedby="pdf-character-count" />
        <footer className="pdf-dialog-footer">
          <p id="pdf-character-count" className="pdf-character-count">{preview.length.toLocaleString("en-US")} characters</p>
          <div><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={!canImport}>Import text</button></div>
        </footer>
      </form>
    </dialog>, document.body,
  );
}
