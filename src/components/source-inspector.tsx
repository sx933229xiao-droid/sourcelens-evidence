"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, LocateFixed, PanelRightClose } from "lucide-react";
import { motion } from "motion/react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { SourceId } from "@/lib/comparison-schema";
import { pdfPageLabel } from "@/lib/pdf-page-map";
import type { ImportedSourceFile } from "@/lib/project-store";
import { SourceReader, type ReaderControls, type ReaderMatch, type ReaderMemory } from "./source-reader";

type Props = {
  source: SourceId;
  text: string;
  file: ImportedSourceFile | null;
  match?: ReaderMatch;
  matchIndex: number;
  matchCount: number;
  citationKey: string;
  revision: number;
  memory: ReaderMemory;
  onSource: (source: SourceId) => void;
  onMatch: (index: number) => void;
  onJump: () => void;
  onClose?: () => void;
};

function MatchCounter({ index, count, onMatch }: { index: number; count: number; onMatch: (index: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft !== null) {
      const next = Number(draft) - 1;
      if (Number.isInteger(next) && next >= 0 && next < count && next !== index) onMatch(next);
    }
    setDraft(null);
  }

  return <div className="inspector-matches" role="group" aria-label="Quote occurrences">
    <button type="button" className="studio-icon icon-bordered" aria-label="Previous match" disabled={index === 0} onClick={() => onMatch(index - 1)}><ChevronUp size={16} aria-hidden="true" /></button>
    <button type="button" className="studio-icon icon-bordered" aria-label="Next match" disabled={index + 1 >= count} onClick={() => onMatch(index + 1)}><ChevronDown size={16} aria-hidden="true" /></button>
    <span className="match-number">Match {count > 1 ?
      <input type="number" min={1} max={count} aria-label="Quote match" value={draft ?? index + 1} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); commit(); }
        if (event.key === "Escape" && draft !== null) { event.preventDefault(); event.stopPropagation(); setDraft(null); }
      }} /> : "1"} of {count}</span>
  </div>;
}

export const SourceInspector = memo(function SourceInspector({
  source, text, file, match, matchIndex, matchCount, citationKey, revision, memory, onSource, onMatch, onJump, onClose,
}: Props) {
  const [reading, setReading] = useState<{ source: SourceId; page: number | null }>({ source, page: null });
  const visiblePage = reading.source === source ? reading.page : null;
  const setVisiblePage = useCallback((page: number | null) => {
    setReading((previous) => previous.source === source && previous.page === page ? previous : { source, page });
  }, [source]);
  const controls = useRef<ReaderControls>(null);
  const pageMap = file?.pdf?.pageMap;
  const pages = useMemo(() => pageMap?.pages.filter((span) => span.end > span.start).map((span) => span.page) ?? [], [pageMap]);
  const pageIndex = Math.max(0, visiblePage === null ? 0 : pages.indexOf(visiblePage));
  const page = pages[pageIndex];
  const quotePage = match?.pages ? pdfPageLabel(match.pages) : null;

  return <aside className="inspector-pane" aria-label="Original source" data-active-source={source}>
    <header className="inspector-toolbar">
      <h2>Source Inspector</h2>
      <div className="inspector-switch" role="group" aria-label="Source to inspect">
        {(["A", "B"] as const).map((id) => <button key={id} className="studio-toggle" type="button" aria-label={`Inspect Source ${id}`} aria-pressed={source === id} onClick={() => onSource(id)}>{id}</button>)}
      </div>
      {onClose && <button type="button" className="studio-icon" aria-label="Hide Source Inspector" title="Hide Source Inspector" onClick={onClose}><PanelRightClose size={17} aria-hidden="true" /></button>}
    </header>
    <div className="inspector-source-header">
      <div className="inspector-source-heading">
        <FileText size={19} strokeWidth={1.65} aria-hidden="true" />
        <div>
          <h3>Source {source}{page !== undefined && <span> · Page {page}</span>}</h3>
          <p title={file?.name}>{file?.name ?? "Pasted text"}{file?.edited ? " · Edited" : ""}</p>
        </div>
      </div>
      {page !== undefined && <div className="inspector-pages" role="group" aria-label="PDF pages">
        <button className="studio-icon" type="button" aria-label="Previous PDF page" disabled={pageIndex === 0} onClick={() => controls.current?.goToPage(pages[pageIndex - 1])}><ChevronLeft size={16} aria-hidden="true" /></button>
        <span aria-label={`PDF page ${page} of ${file?.pdf?.pageCount}`}>{page} / {file?.pdf?.pageCount}</span>
        <button className="studio-icon" type="button" aria-label="Next PDF page" disabled={pageIndex + 1 >= pages.length} onClick={() => controls.current?.goToPage(pages[pageIndex + 1])}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>}
    </div>
    <motion.div key={source} className="inspector-reading" initial={{ x: source === "A" ? -10 : 10, opacity: .86 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .16, ease: [.2, .78, .22, 1] }}>
      <SourceReader source={source} value={text} pageMap={pageMap} match={match} revision={revision} memory={memory} onPageChange={setVisiblePage} controls={controls} inspector />
    </motion.div>
    <footer className="inspector-footer">
      {!match && <p className="inspector-context-status">{text ? "No citation in this source for the selected finding." : "Import text in Workspace to inspect this source."}</p>}
      {match && <>
        <MatchCounter key={citationKey} index={matchIndex} count={matchCount} onMatch={onMatch} />
        <button type="button" className="button button-secondary inspector-jump" onClick={onJump}><LocateFixed size={15} aria-hidden="true" />Jump to quote</button>
        {(quotePage || file?.pdf) && <span className="inspector-match-page" aria-live="polite">{quotePage ?? "PDF page information unavailable"}</span>}
      </>}
    </footer>
  </aside>;
});
