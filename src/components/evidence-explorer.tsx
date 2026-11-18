"use client";

import {
  ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight, List, MessageSquare, PanelRightClose, PanelRightOpen,
  Search, SlidersHorizontal, TriangleAlert,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { relationships, relationshipLabels, type Finding, type Relationship, type SourceId } from "@/lib/comparison-schema";
import { pdfPageLabel } from "@/lib/pdf-page-map";
import type { FindingReview, ResearchProject } from "@/lib/project-store";
import { ExplorerDrawer, ExplorerPanels, loadExplorerPreferences, useExplorerViewport, writeExplorerPreferences, type ExplorerPreferences } from "./explorer-panels";
import { SourceInspector } from "./source-inspector";
import { findReaderMatches, type ReaderMatch, type ReaderMemory } from "./source-reader";

export type ExplorerState = {
  query: string;
  relationship: Relationship | "all";
  reviewStatus: "all" | "unreviewed" | "reviewed";
  importantOnly: boolean;
  selectedIndex: number | null;
  source: SourceId | null;
  evidenceIndex: number | null;
  occurrences: Record<string, number>;
  revision: number;
};

export type ExplorerMemory = {
  reader: ReaderMemory;
  listTop: number;
  listIndex: number | null;
  detailTop: number;
  detailIndex: number | null;
  searchRequest: number;
};

export function createExplorerMemory(): ExplorerMemory {
  return { reader: {}, listTop: 0, listIndex: null, detailTop: 0, detailIndex: null, searchRequest: 0 };
}

export function initialExplorerState(): ExplorerState {
  return {
    query: "", relationship: "all", reviewStatus: "all", importantOnly: false,
    selectedIndex: 0, source: null, evidenceIndex: null, occurrences: {}, revision: 0,
  };
}

type Analysis = NonNullable<ResearchProject["analysis"]>;
type FindingRow = { finding: Finding; index: number };
type Filters = Pick<ExplorerState, "query" | "relationship" | "reviewStatus" | "importantOnly">;
type Evidence = { index: number; source: SourceId; quote: string; matches: ReaderMatch[] };

type Props = {
  analysis: Analysis;
  sourceFiles: ResearchProject["sourceFiles"];
  sources: ResearchProject["sources"];
  state: ExplorerState;
  memory: ExplorerMemory;
  searchRequest: number;
  onStateChange: Dispatch<SetStateAction<ExplorerState>>;
  onReviewChange: (index: number, patch: Partial<FindingReview>) => void;
  readOnly: boolean;
};

function matchingFindings(analysis: Analysis, filters: Filters): FindingRow[] {
  const query = filters.query.trim().toLowerCase();
  return analysis.result.findings.map((finding, index) => ({ finding, index })).filter(({ finding, index }) => {
    const review = analysis.reviewByFinding?.[index];
    if (filters.relationship !== "all" && finding.relationship !== filters.relationship) return false;
    if (filters.reviewStatus === "reviewed" && !review?.reviewed) return false;
    if (filters.reviewStatus === "unreviewed" && review?.reviewed) return false;
    if (filters.importantOnly && !review?.important) return false;
    return !query || [finding.topic, finding.explanation, ...finding.evidence.map(({ quote }) => quote), review?.note ?? ""]
      .some((part) => part.toLowerCase().includes(query));
  });
}

function findSource(finding: Finding | undefined, preferred: SourceId): SourceId {
  return finding?.evidence.some(({ source }) => source === preferred) ? preferred : (finding?.evidence[0]?.source ?? preferred);
}

function RelationshipBadge({ relationship }: { relationship: Relationship }) {
  return <span className={`studio-relation relation-${relationship}`}>
    {relationship === "potential_conflict" && <TriangleAlert size={15} strokeWidth={1.9} aria-hidden="true" />}
    {relationshipLabels[relationship]}
  </span>;
}

const quickFilters = [
  { value: "all", label: "All" }, { value: "agreement", label: "Agreement" }, { value: "potential_conflict", label: "Conflict" },
] as const;

function FindingsNavigation({ analysis, visible, state, memory, searchRef, onFilters, onSelect }: {
  analysis: Analysis;
  visible: FindingRow[];
  state: ExplorerState;
  memory: ExplorerMemory;
  searchRef: RefObject<HTMLInputElement | null>;
  onFilters: (patch: Partial<Filters>) => void;
  onSelect: (index: number) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { findings, omittedFindings } = analysis.result;
  const { query, relationship, reviewStatus, importantOnly, selectedIndex } = state;
  const filtered = Boolean(query || relationship !== "all" || reviewStatus !== "all" || importantOnly);
  const advancedActive = reviewStatus !== "all" || importantOnly || !quickFilters.some((item) => item.value === relationship);
  const reviewed = findings.reduce((count, _, index) => count + (analysis.reviewByFinding?.[index]?.reviewed ? 1 : 0), 0);
  const relationCounts = useMemo(() => {
    const counts = new Map<Relationship, number>();
    for (const { relationship: item } of findings) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
  }, [findings]);
  const arrangement = visible.map(({ index }) => index).join(",");

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const pane = listRef.current;
      if (!pane) return;
      pane.scrollTop = memory.listTop;
      if (memory.listIndex === selectedIndex) return;
      memory.listIndex = selectedIndex;
      const row = pane.querySelector('[aria-current="true"]');
      if (!row) return;
      const box = pane.getBoundingClientRect();
      const item = row.getBoundingClientRect();
      if (item.top < box.top) pane.scrollTop += item.top - box.top - 8;
      if (item.bottom > box.bottom) pane.scrollTop += item.bottom - box.bottom + 8;
    });
    return () => cancelAnimationFrame(frame);
  }, [memory, selectedIndex]);

  return <nav className="studio-findings" aria-label="Findings">
    <div className="findings-controls">
      <div className="findings-heading">
        <h2>Findings <span>{findings.length}</span></h2>
        <button type="button" className={`studio-icon${advancedActive ? " filter-active" : ""}`} aria-label="Finding filters" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)} title="Finding filters"><SlidersHorizontal size={17} aria-hidden="true" /></button>
      </div>
      <label className="explorer-search"><Search size={17} strokeWidth={1.7} aria-hidden="true" /><span className="sr-only">Filter findings</span><input ref={searchRef} type="search" value={query} onChange={(event) => onFilters({ query: event.target.value })} placeholder="Filter findings…" /></label>
      <div className="findings-quick-filters" role="group" aria-label="Quick relationship filters">
        {quickFilters.map(({ value, label }) => <button type="button" aria-label={label} key={value} aria-pressed={relationship === value} onClick={() => onFilters({ relationship: value })}>{label}{value !== "all" && <span className="filter-count">{relationCounts.get(value) ?? 0}</span>}</button>)}
      </div>
      {advanced && <div className="findings-advanced">
        <label>Relationship<select value={relationship} onChange={(event) => onFilters({ relationship: event.target.value as Filters["relationship"] })}><option value="all">All relationships</option>{relationships.map((value) => <option key={value} value={value}>{relationshipLabels[value]}</option>)}</select></label>
        <label>Review status<select value={reviewStatus} onChange={(event) => onFilters({ reviewStatus: event.target.value as Filters["reviewStatus"] })}><option value="all">All findings</option><option value="unreviewed">Not reviewed</option><option value="reviewed">Reviewed</option></select></label>
        <label className="studio-check"><input type="checkbox" checked={importantOnly} onChange={(event) => onFilters({ importantOnly: event.target.checked })} />Important only</label>
      </div>}
      <div className="findings-counts">
        <span>{filtered ? `${visible.length} of ${findings.length} shown` : `${reviewed} of ${findings.length} reviewed`}</span>
        {filtered && <button type="button" className="studio-link" onClick={() => onFilters({ query: "", relationship: "all", reviewStatus: "all", importantOnly: false })}>Clear filters</button>}
      </div>
      {omittedFindings > 0 && <p className="findings-omitted">{omittedFindings} {omittedFindings === 1 ? "finding omitted" : "findings omitted"} during evidence verification.</p>}
    </div>
    <motion.div layoutScroll ref={listRef} className="findings-scroll" onScroll={(event) => { memory.listTop = event.currentTarget.scrollTop; }}>
      {visible.length ? <ul>
        <LayoutGroup id="studio-findings">
        {visible.map(({ finding, index }) => {
          const review = analysis.reviewByFinding?.[index];
          const selected = index === selectedIndex;
          return <motion.li key={index} layout="position" layoutDependency={arrangement} transition={{ layout: { duration: .17, ease: [.2, .78, .22, 1] } }}>
            <button type="button" className="studio-finding-row" aria-current={selected ? "true" : undefined} aria-label={`Finding ${index + 1}: ${finding.topic}`} onClick={() => onSelect(index)}>
              {selected && <motion.span layoutId="active" className="studio-finding-mark" aria-hidden="true" transition={{ type: "spring", stiffness: 460, damping: 39 }} />}
              <span className="studio-row-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="studio-row-body">
                <span className="studio-row-title">{finding.topic}</span>
                <span className="studio-row-status"><RelationshipBadge relationship={finding.relationship} />{review?.reviewed && <Check size={13} aria-label="Reviewed" />}{review?.important && <Bookmark size={13} fill="currentColor" aria-label="Important" />}{review?.note.trim() && <MessageSquare size={12} aria-label="Has research notes" />}</span>
                <span className="studio-row-summary">{finding.explanation}</span>
              </span>
            </button>
          </motion.li>;
        })}
        </LayoutGroup>
      </ul> : <p className="studio-empty">No findings match these filters.</p>}
    </motion.div>
  </nav>;
}

function FindingDetail({ selected, index, previous, next, total, review, evidence, sourceFiles, active, state, outsideFilters, memory, readOnly, phone, inspectorOpen, inspectorToggle, onShowFindings, onToggleInspector, onSelect, onCitation, onReview }: {
  selected?: Finding;
  index: number | null;
  previous?: number;
  next?: number;
  total: number;
  review?: FindingReview;
  evidence: Evidence[];
  sourceFiles: Props["sourceFiles"];
  active?: Evidence;
  state: ExplorerState;
  outsideFilters: boolean;
  memory: ExplorerMemory;
  readOnly: boolean;
  phone: boolean;
  inspectorOpen: boolean;
  inspectorToggle: RefObject<HTMLButtonElement | null>;
  onShowFindings: () => void;
  onToggleInspector: () => void;
  onSelect: (index: number) => void;
  onCitation: (citation: Evidence) => void;
  onReview: Props["onReviewChange"];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const oldIndex = useRef(index);
  const direction = oldIndex.current === index ? 0 : (index ?? 0) > (oldIndex.current ?? 0) ? 1 : -1;
  useLayoutEffect(() => {
    const body = scrollRef.current;
    if (!body) return;
    body.scrollTop = memory.detailIndex === index ? memory.detailTop : 0;
    memory.detailTop = body.scrollTop;
    memory.detailIndex = index;
    oldIndex.current = index;
  }, [index, memory]);

  return <article className="studio-finding-detail" aria-label="Selected finding">
    <header className="finding-command">
      {phone && <button type="button" className="studio-icon icon-bordered" onClick={onShowFindings} aria-label="Open findings"><List size={17} aria-hidden="true" /></button>}
      <div className="finding-stepper" role="group" aria-label="Move between findings">
        <button type="button" className="studio-icon" aria-label="Previous finding" disabled={previous === undefined} onClick={() => { if (previous !== undefined) onSelect(previous); }}><ChevronLeft size={17} aria-hidden="true" /></button>
        <button type="button" className="studio-icon" aria-label="Next finding" disabled={next === undefined} onClick={() => { if (next !== undefined) onSelect(next); }}><ChevronRight size={17} aria-hidden="true" /></button>
      </div>
      <span className="finding-position">{selected && index !== null ? `Finding ${String(index + 1).padStart(2, "0")} of ${total}` : `${total} findings`}</span>
      <button ref={inspectorToggle} type="button" className="studio-icon finding-inspector-trigger" title={inspectorOpen ? "Hide Source Inspector" : "Show Source Inspector"} aria-label={inspectorOpen ? "Hide Source Inspector from detail" : "Show Source Inspector"} aria-expanded={inspectorOpen} onClick={onToggleInspector}>{inspectorOpen ? <PanelRightClose size={18} aria-hidden="true" /> : <PanelRightOpen size={18} aria-hidden="true" />}</button>
    </header>
    <div className="finding-scroll" ref={scrollRef} onScroll={(event) => { memory.detailTop = event.currentTarget.scrollTop; }}>
      {selected && index !== null ? <motion.div key={index} className="finding-content" initial={direction ? { y: 9 * direction, opacity: .86 } : false} animate={{ y: 0, opacity: 1 }} transition={{ duration: .16, ease: [.2, .78, .22, 1] }}>
        <header className="finding-text">
          <RelationshipBadge relationship={selected.relationship} />
          {outsideFilters && <span className="finding-outside">Outside current filters</span>}
          <h1>{selected.topic}</h1>
          <p>{selected.explanation}</p>
        </header>
        <div className="studio-evidence-grid">
          {(["A", "B"] as const).map((source) => {
            const items = evidence.filter((item) => item.source === source);
            if (!items.length) return <div key={source} className={`studio-quote-card quote-${source.toLowerCase()} quote-empty`}><h3>Source {source}</h3><p>Not cited in this finding.</p></div>;
            return <section key={source} className="studio-evidence-source" aria-label={`Source ${source} evidence`}>
              {items.map((item) => {
                const occurrence = state.occurrences[`${index}:${item.index}`] ?? 0;
                const match = item.matches[occurrence] ?? item.matches[0];
                const page = match?.pages;
                const pageText = page ? pdfPageLabel(page).replace("PDF ", "") : sourceFiles[source]?.pdf ? "Page unavailable" : "";
                const isActive = inspectorOpen && active?.index === item.index;
                return <div key={item.index} className={`studio-quote-card quote-${source.toLowerCase()}${isActive ? " quote-active" : ""}`}>
                  <button type="button" className="quote-command" aria-label={`Open Source ${source} citation ${items.indexOf(item) + 1}`} onClick={() => onCitation(item)} disabled={!match}>
                    <span>Source {source}</span>{pageText && <span className="quote-page-label">{pageText}</span>}<ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                  <blockquote onClick={() => { if (match && window.getSelection()?.isCollapsed !== false) onCitation(item); }}>{item.quote}</blockquote>
                </div>;
              })}
            </section>;
          })}
        </div>
        <fieldset className="studio-review" disabled={readOnly}>
          <legend className="sr-only">Your review</legend>
          <div className="studio-review-actions">
            <motion.button type="button" className="studio-review-button" whileTap={readOnly ? undefined : { scale: .96 }} transition={{ duration: .12 }} aria-pressed={Boolean(review?.reviewed)} onClick={() => onReview(index, { reviewed: !review?.reviewed })}><span className="review-check"><Check size={15} strokeWidth={2} aria-hidden="true" /></span>Reviewed</motion.button>
            <motion.button type="button" className="studio-review-button" whileTap={readOnly ? undefined : { scale: .96 }} transition={{ duration: .12 }} aria-pressed={Boolean(review?.important)} onClick={() => onReview(index, { important: !review?.important })}><Bookmark size={19} strokeWidth={1.7} fill={review?.important ? "currentColor" : "none"} aria-hidden="true" />Important</motion.button>
          </div>
          <label htmlFor="research-notes">Research notes</label>
          <div className="studio-notes">
            <textarea id="research-notes" key={index} rows={5} value={review?.note ?? ""} onChange={(event) => onReview(index, { note: event.target.value })} placeholder="Add your observations or questions…" />
            <div>{(review?.note.length ?? 0).toLocaleString("en-US")} characters</div>
          </div>
        </fieldset>
      </motion.div> : <div className="finding-empty"><Search size={24} strokeWidth={1.5} aria-hidden="true" /><h1>No matching findings</h1><p>Try a different search or clear the filters.</p></div>}
    </div>
  </article>;
}

export function EvidenceExplorer({ analysis, sourceFiles, sources, state, memory, searchRequest, onStateChange, onReviewChange, readOnly }: Props) {
  const viewport = useExplorerViewport();
  const desktop = viewport === "desktop";
  const phone = viewport === "phone";
  const [preferences, setPreferences] = useState(loadExplorerPreferences);
  const [drawer, setDrawer] = useState<"findings" | "inspector" | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);
  const groupRef = useRef<GroupImperativeHandle>(null);
  const inspectorToggle = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { findings } = analysis.result;
  const { query, relationship, reviewStatus, importantOnly, selectedIndex } = state;
  const selected = selectedIndex === null ? undefined : findings[selectedIndex];
  const visible = useMemo(() => matchingFindings(analysis, { query, relationship, reviewStatus, importantOnly }), [analysis, query, relationship, reviewStatus, importantOnly]);
  const aMap = sourceFiles.A?.pdf?.pageMap;
  const bMap = sourceFiles.B?.pdf?.pageMap;
  const { sourceA, sourceB } = sources;
  const evidence = useMemo((): Evidence[] => (selected?.evidence ?? []).map(({ source, quote }, index) => ({
    source, quote, index, matches: findReaderMatches(source === "A" ? sourceA : sourceB, quote, source === "A" ? aMap : bMap),
  })), [selected, sourceA, sourceB, aMap, bMap]);

  const activeSource = state.source ?? evidence.find((item) => item.matches.length)?.source ?? "A";
  const active = evidence.find((item) => item.source === activeSource && item.index === state.evidenceIndex && item.matches.length)
    ?? evidence.find((item) => item.source === activeSource && item.matches.length);
  const activeKey = active ? `${selectedIndex}:${active.index}` : "";
  const matchCount = active?.matches.length ?? 0;
  const matchIndex = Math.max(0, Math.min(matchCount - 1, state.occurrences[activeKey] ?? 0));
  const inspectorOpen = desktop ? preferences.open : drawer === "inspector";
  const outsideFilters = Boolean(selected && !visible.some(({ index }) => index === selectedIndex));

  const updatePreferences = useCallback((next: ExplorerPreferences) => {
    setPreferences(next);
    writeExplorerPreferences(next);
  }, []);

  const setDesktopOpen = useCallback((open: boolean) => {
    if (open === preferences.open) return;
    const left = groupRef.current?.getLayout().findings;
    updatePreferences({ ...preferences, open, collapsedFindings: open ? preferences.collapsedFindings : (left ?? preferences.sizes.findings) });
  }, [preferences, updatePreferences]);

  const closeInspector = useCallback(() => {
    setDesktopOpen(false);
    inspectorToggle.current?.focus({ preventScroll: true });
  }, [setDesktopOpen]);

  useEffect(() => { setDrawer(null); }, [viewport]);
  useEffect(() => {
    if (searchRequest === memory.searchRequest) return;
    memory.searchRequest = searchRequest;
    if (phone) setDrawer("findings");
    setFocusSearch(true);
  }, [memory, phone, searchRequest]);
  useEffect(() => {
    if (!focusSearch) return;
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus();
      setFocusSearch(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusSearch]);

  function select(current: ExplorerState, index: number | null): ExplorerState {
    if (index === current.selectedIndex) return current;
    return {
      ...current, selectedIndex: index, evidenceIndex: null, revision: current.revision + 1,
      source: findSource(index === null ? undefined : findings[index], current.source ?? activeSource),
    };
  }

  function selectFinding(index: number) {
    onStateChange((current) => select(current, index));
    if (phone) setDrawer(null);
  }

  function setFilters(patch: Partial<Filters>) {
    onStateChange((current) => {
      const next = { ...current, ...patch };
      const matches = matchingFindings(analysis, next);
      return matches.some(({ index }) => index === next.selectedIndex) ? next : select(next, matches[0]?.index ?? null);
    });
  }

  function openCitation(citation: Evidence) {
    if (desktop) setDesktopOpen(true);
    else setDrawer("inspector");
    onStateChange((current) => ({ ...current, source: citation.source, evidenceIndex: citation.index, revision: current.revision + 1 }));
  }

  const changeSource = useCallback((source: SourceId) => {
    if (source === activeSource) return;
    onStateChange((current) => ({ ...current, source, evidenceIndex: null, revision: current.revision + 1 }));
  }, [activeSource, onStateChange]);

  const moveToMatch = useCallback((index: number) => {
    if (!activeKey || index < 0 || index >= matchCount) return;
    onStateChange((current) => ({ ...current, occurrences: { ...current.occurrences, [activeKey]: index }, revision: current.revision + 1 }));
  }, [activeKey, matchCount, onStateChange]);

  const jumpToQuote = useCallback(() => {
    onStateChange((current) => ({ ...current, revision: current.revision + 1 }));
  }, [onStateChange]);

  const navigation = <FindingsNavigation analysis={analysis} visible={visible} state={state} memory={memory} searchRef={searchRef} onFilters={setFilters} onSelect={selectFinding} />;
  const detail = <FindingDetail
    key="detail" selected={selected} index={selectedIndex} total={findings.length}
    previous={selectedIndex === null ? undefined : visible.findLast(({ index }) => index < selectedIndex)?.index}
    next={visible.find(({ index }) => selectedIndex === null || index > selectedIndex)?.index}
    review={selectedIndex === null ? undefined : analysis.reviewByFinding?.[selectedIndex]}
    evidence={evidence} sourceFiles={sourceFiles} active={active} state={state} outsideFilters={outsideFilters}
    memory={memory} readOnly={readOnly} phone={phone} inspectorOpen={inspectorOpen} inspectorToggle={inspectorToggle}
    onShowFindings={() => setDrawer("findings")}
    onToggleInspector={() => { if (desktop) setDesktopOpen(!inspectorOpen); else setDrawer("inspector"); }}
    onSelect={selectFinding} onCitation={openCitation} onReview={onReviewChange}
  />;
  const inspector = inspectorOpen && <SourceInspector
    source={activeSource} text={activeSource === "A" ? sourceA : sourceB} file={sourceFiles[activeSource]}
    match={active?.matches[matchIndex]} matchCount={matchCount} matchIndex={matchIndex} citationKey={activeKey}
    revision={state.revision} memory={memory.reader} onSource={changeSource} onMatch={moveToMatch}
    onJump={jumpToQuote} onClose={desktop ? closeInspector : undefined}
  />;

  return (
    <section className={`studio-explorer explorer-${viewport}`} aria-label="Evidence Explorer">
      {desktop ? <ExplorerPanels preferences={preferences} onPreferences={updatePreferences} groupRef={groupRef} findings={navigation} detail={detail} inspector={inspector} /> : <>
        <div className="explorer-compact">{!phone && navigation}{detail}</div>
        <AnimatePresence initial={false}>
          {drawer && <ExplorerDrawer key={drawer} kind={drawer} onClose={() => setDrawer(null)}>{drawer === "findings" ? navigation : inspector}</ExplorerDrawer>}
        </AnimatePresence>
      </>}
    </section>
  );
}
