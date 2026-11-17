"use client";

import { useMemo } from "react";
import { ArrowUpRight, Check, MessageSquare, Search, Star } from "lucide-react";
import { relationships, relationshipLabels, type Relationship, type SourceId } from "@/lib/comparison-schema";
import type { FindingReview, ImportedSourceFile, ResearchProject } from "@/lib/project-store";
import { findQuotePageMatches, pdfPageLabel, quotePageSummary } from "@/lib/pdf-page-map";

export type ExplorerState = {
  query: string;
  relationship: Relationship | "all";
  reviewStatus: "all" | "unreviewed" | "reviewed";
  importantOnly: boolean;
  selectedIndex: number | null;
  occurrences: Record<string, number>;
};

export function initialExplorerState(): ExplorerState {
  return { query: "", relationship: "all", reviewStatus: "all", importantOnly: false, selectedIndex: 0, occurrences: {} };
}

type Analysis = NonNullable<ResearchProject["analysis"]>;
type Props = {
  analysis: Analysis;
  sourceFiles: ResearchProject["sourceFiles"];
  sources: ResearchProject["sources"];
  state: ExplorerState;
  onStateChange: (state: ExplorerState) => void;
  onReviewChange: (index: number, patch: Partial<FindingReview>) => void;
  onLocate: (source: SourceId, quote: string, start?: number) => void;
  readOnly: boolean;
};

function matchingFindings(analysis: Analysis, state: ExplorerState) {
  const query = state.query.trim().toLowerCase();
  return analysis.result.findings.map((finding, index) => ({ finding, index })).filter(({ finding, index }) => {
    const review = analysis.reviewByFinding?.[index];
    if (state.relationship !== "all" && finding.relationship !== state.relationship) return false;
    if (state.reviewStatus === "reviewed" && !review?.reviewed) return false;
    if (state.reviewStatus === "unreviewed" && review?.reviewed) return false;
    if (state.importantOnly && !review?.important) return false;
    return !query || [finding.topic, finding.explanation, ...finding.evidence.map(({ quote }) => quote), review?.note ?? ""].some((text) => text.toLowerCase().includes(query));
  });
}

function EvidenceExcerpt({ source, quote, text, file, occurrence, onOccurrence, onLocate }: { source: SourceId; quote: string; text: string; file: ImportedSourceFile | null; occurrence: number; onOccurrence: (index: number) => void; onLocate: Props["onLocate"] }) {
  const map = file?.pdf?.pageMap;
  const matches = useMemo(() => findQuotePageMatches(text, quote, map), [text, quote, map]);
  const index = Math.max(0, Math.min(occurrence, matches.length - 1));
  const match = matches[index];
  const summary = quotePageSummary(matches);
  return <div className="explorer-excerpt"><blockquote>{quote}</blockquote>{file?.pdf && <p className={`quote-pages${match ? "" : " unavailable"}`} title={!map && file.edited ? "The source was edited after import." : undefined}>{summary ?? "PDF page information unavailable"}</p>}{matches.length > 1 && <div className="occurrence-controls" role="group" aria-label="Quote occurrences"><button type="button" disabled={index === 0} onClick={() => onOccurrence(index - 1)} aria-label="Previous match">Previous</button><label>Match <input type="number" aria-label="Quote match" min={1} max={matches.length} value={index + 1} onChange={(event) => { const next = Number(event.target.value) - 1; if (Number.isInteger(next) && next >= 0 && next < matches.length) onOccurrence(next); }} /> of {matches.length}</label><button type="button" disabled={index === matches.length - 1} onClick={() => onOccurrence(index + 1)} aria-label="Next match">Next</button><span>{match && pdfPageLabel(match)}</span></div>}<button type="button" className="locate-button" onClick={() => onLocate(source, quote, match?.start)}>View in source <ArrowUpRight size={12} aria-hidden="true" /></button></div>;
}

export function EvidenceExplorer({ analysis, sourceFiles, sources, state, onStateChange, onReviewChange, onLocate, readOnly }: Props) {
  const { findings, omittedFindings } = analysis.result;
  const visible = useMemo(() => matchingFindings(analysis, state), [analysis, state.query, state.relationship, state.reviewStatus, state.importantOnly]);
  const selectedIndex = state.selectedIndex;
  const selected = selectedIndex !== null ? findings[selectedIndex] : undefined;
  const review = selectedIndex !== null ? analysis.reviewByFinding?.[selectedIndex] : undefined;
  const outsideFilters = selected && !visible.some(({ index }) => index === selectedIndex);
  const reviewedCount = findings.reduce((count, _finding, index) => count + (analysis.reviewByFinding?.[index]?.reviewed ? 1 : 0), 0);
  const filtered = Boolean(state.query || state.relationship !== "all" || state.reviewStatus !== "all" || state.importantOnly);

  function changeFilters(patch: Partial<ExplorerState>) {
    const next = { ...state, ...patch };
    const matches = matchingFindings(analysis, next);
    if (!matches.some(({ index }) => index === next.selectedIndex)) next.selectedIndex = matches[0]?.index ?? null;
    onStateChange(next);
  }

  function clearFilters() {
    changeFilters({ ...initialExplorerState(), selectedIndex: state.selectedIndex, occurrences: state.occurrences });
  }

  return (
    <section className="evidence-explorer" aria-label="Evidence Explorer">
      <div className="explorer-filters">
        <label className="explorer-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search findings</span><input type="search" value={state.query} onChange={(event) => changeFilters({ query: event.target.value })} placeholder="Search findings, excerpts, or notes" /></label>
        <label className="explorer-select"><span>Relationship</span><select value={state.relationship} onChange={(event) => changeFilters({ relationship: event.target.value as ExplorerState["relationship"] })}><option value="all">All relationships</option>{relationships.map((relationship) => <option key={relationship} value={relationship}>{relationshipLabels[relationship]}</option>)}</select></label>
        <label className="explorer-select"><span>Review status</span><select value={state.reviewStatus} onChange={(event) => changeFilters({ reviewStatus: event.target.value as ExplorerState["reviewStatus"] })}><option value="all">All findings</option><option value="unreviewed">Not reviewed</option><option value="reviewed">Reviewed</option></select></label>
        <label className="important-filter"><input type="checkbox" checked={state.importantOnly} onChange={(event) => changeFilters({ importantOnly: event.target.checked })} /><Star size={13} aria-hidden="true" />Important only</label>
        <button type="button" className="clear-filters" disabled={!filtered} onClick={clearFilters}>Clear filters</button>
      </div>
      <div className="explorer-counts"><span>{visible.length} of {findings.length} findings</span><span>{reviewedCount} of {findings.length} reviewed</span></div>
      {omittedFindings > 0 && <p className="explorer-omissions">{omittedFindings} {omittedFindings === 1 ? "finding was" : "findings were"} omitted because the structure or excerpts could not be verified.</p>}
      <div className="explorer-layout">
        <nav className="finding-navigation" aria-label="Findings">
          <h2>Findings</h2>
          {visible.length ? <ul>{visible.map(({ finding, index }) => {
            const itemReview = analysis.reviewByFinding?.[index];
            return <li key={index}><button type="button" className={`finding-nav-item${index === selectedIndex ? " is-selected" : ""}`} aria-current={index === selectedIndex ? "true" : undefined} aria-label={`Finding ${index + 1}: ${finding.topic}`} onClick={() => onStateChange({ ...state, selectedIndex: index })}>
              <span className="finding-nav-top"><span className="finding-number">{String(index + 1).padStart(2, "0")}</span><span className="finding-marks">{itemReview?.reviewed && <Check size={13} aria-label="Reviewed" />}{itemReview?.important && <Star size={13} fill="currentColor" aria-label="Important" />}{itemReview?.note.trim() && <MessageSquare size={12} aria-label="Has research notes" />}</span></span>
              <span className="finding-nav-title">{finding.topic}</span><span className={`relationship-tag ${finding.relationship}`}><span className="relationship-dot" />{relationshipLabels[finding.relationship]}</span>
            </button></li>;
          })}</ul> : <div className="explorer-empty-list"><p>No findings match these filters.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
        </nav>
        {selected && selectedIndex !== null ? <article className="finding-detail" aria-label="Selected finding">
          <header className="finding-detail-header"><div className="finding-detail-labels"><span className={`relationship-tag ${selected.relationship}`}><span className="relationship-dot" />{relationshipLabels[selected.relationship]}</span><span className="finding-number">Finding {selectedIndex + 1}</span></div><h2>{selected.topic}</h2><p>{selected.explanation}</p>{outsideFilters && <span className="outside-filters" role="status">Outside current filters · you can finish your review here.</span>}</header>
          <div className="evidence-pair">{(["A", "B"] as const).map((source) => {
            const file = sourceFiles[source];
            const excerpts = selected.evidence.filter((evidence) => evidence.source === source);
            return <section className={`evidence-column evidence-${source.toLowerCase()}`} key={source} aria-label={`Source ${source} evidence`}>
              <header><span className="source-letter">{source}</span><div><h3>Source {source}</h3><p className="evidence-file" title={file?.name}>{file?.name ?? "Pasted text"}</p>{file?.pdf && <p className="evidence-file">Imported PDF pages {file.pdf.fromPage}–{file.pdf.toPage} of {file.pdf.pageCount}</p>}</div></header>
              {excerpts.length ? excerpts.map(({ quote }, index) => { const key = `${selectedIndex}:${source}:${index}`; return <EvidenceExcerpt key={key} source={source} quote={quote} text={sources[source === "A" ? "sourceA" : "sourceB"]} file={file} occurrence={state.occurrences[key] ?? 0} onOccurrence={(value) => onStateChange({ ...state, occurrences: { ...state.occurrences, [key]: value } })} onLocate={onLocate} />; }) : <p className="evidence-not-cited">Not cited in this finding.</p>}
            </section>;
          })}</div>
          <fieldset className="finding-review" disabled={readOnly}><legend>Your review</legend><div className="review-actions"><button type="button" className={`review-toggle${review?.reviewed ? " is-active" : ""}`} aria-pressed={Boolean(review?.reviewed)} onClick={() => onReviewChange(selectedIndex, { reviewed: !review?.reviewed })}><Check size={14} aria-hidden="true" />{review?.reviewed ? "Reviewed" : "Mark reviewed"}</button><button type="button" className={`review-toggle review-important${review?.important ? " is-active" : ""}`} aria-pressed={Boolean(review?.important)} onClick={() => onReviewChange(selectedIndex, { important: !review?.important })}><Star size={14} fill={review?.important ? "currentColor" : "none"} aria-hidden="true" />{review?.important ? "Important" : "Mark important"}</button></div><label className="review-notes-label" htmlFor="research-notes">Research notes</label><textarea id="research-notes" rows={5} value={review?.note ?? ""} onChange={(event) => onReviewChange(selectedIndex, { note: event.target.value })} placeholder="Add your observations or questions…" /><p className="review-help">Your review is saved with this analysis. Marking a finding reviewed does not verify the claim.</p></fieldset>
          <p className="explorer-footnote">Excerpts match the saved sources. Open the source to review their context.</p>
        </article> : <div className="finding-detail explorer-empty-detail"><h2>{visible.length ? "Choose a finding" : "No matching findings"}</h2><p>{visible.length ? "Select a finding to compare its evidence and add your review." : "Try a different search or clear the filters."}</p></div>}
      </div>
    </section>
  );
}
