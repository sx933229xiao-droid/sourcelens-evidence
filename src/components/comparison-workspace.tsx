"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CircleAlert, FlaskConical, LoaderCircle, RotateCcw, X } from "lucide-react";
import { ComparisonProgress, FindingsPanel } from "./findings-panel";
import { EvidenceExplorer, initialExplorerState } from "./evidence-explorer";
import { ConfirmationDialog, type Confirmation } from "./confirmation-dialog";
import { SourcePanel, type ExcerptLocation } from "./source-panel";
import { ProjectToolbar, type SaveState } from "./project-toolbar";
import { COMPARISON_CLIENT_TIMEOUT_MS, type ComparisonResult, type SourceId } from "@/lib/comparison-schema";
import { example } from "@/lib/example";
import { deleteProject, getActiveProjectId, getProject, hasAnnotations, listProjects, saveProject, setActiveProjectId, withFindingReview, type FindingReview, type ImportedSourceFile, type ProjectSummary, type ResearchProject } from "@/lib/project-store";
import { buildMarkdownReport, reportFileName } from "@/lib/markdown-report";

type Connection = "checking" | "configured" | "connected" | "missing" | "unavailable";
type ActiveComparison = { controller: AbortController; projectId: string; timeoutId: number | null };
type PendingConfirmation = Confirmation & { resolve: (accepted: boolean) => void };

const connectionLabels: Record<Connection, string> = {
  checking: "Checking AI configuration",
  configured: "AI configured",
  connected: "AI connected",
  missing: "AI setup required",
  unavailable: "AI status unavailable",
};

function newDraft(name = "Untitled project"): ResearchProject {
  return { id: crypto.randomUUID(), name, updatedAt: Date.now(), sources: { sourceA: "", sourceB: "" }, sourceFiles: { A: null, B: null }, analysis: null, isExample: false };
}

function projectSummary(project: ResearchProject): ProjectSummary {
  return { id: project.id, name: project.name, updatedAt: project.updatedAt };
}

function includeProject(projects: ProjectSummary[], project: ResearchProject): ProjectSummary[] {
  return [...projects.filter((item) => item.id !== project.id), projectSummary(project)].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function readWorkspace() {
  const [projects, activeId] = await Promise.all([listProjects(), getActiveProjectId()]);
  const id = projects.find((item) => item.id === activeId)?.id ?? projects[0]?.id;
  const project = id ? await getProject(id) : null;
  return { projects, project };
}

export function ComparisonWorkspace() {
  const [project, setProject] = useState<ResearchProject | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("restoring");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<Connection>("checking");
  const [comparisonStartedAt, setComparisonStartedAt] = useState<number | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"workspace" | "explorer">("workspace");
  const [explorerState, setExplorerState] = useState(initialExplorerState);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [locatedExcerpt, setLocatedExcerpt] = useState<ExcerptLocation | null>(null);
  const projectRef = useRef<ResearchProject | null>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<Promise<void> | null>(null);
  const deletingProjectId = useRef<string | null>(null);
  const activeComparison = useRef<ActiveComparison | null>(null);
  const pendingConfirmation = useRef<PendingConfirmation | null>(null);
  const sourceARef = useRef<HTMLTextAreaElement>(null);
  const sourceBRef = useRef<HTMLTextAreaElement>(null);

  const sources = project?.sources ?? { sourceA: "", sourceB: "" };
  const sourceFiles = project?.sourceFiles ?? { A: null, B: null };
  const result = project?.analysis?.result ?? null;
  const isExample = project?.isExample ?? false;
  const annotated = hasAnnotations(project?.analysis ?? null);

  const confirmAction = useCallback((request: Confirmation): Promise<boolean> => {
    if (pendingConfirmation.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      const pending = { ...request, resolve };
      pendingConfirmation.current = pending;
      setConfirmation(pending);
    });
  }, []);

  function resolveConfirmation(accepted: boolean) {
    const pending = pendingConfirmation.current;
    pendingConfirmation.current = null;
    setConfirmation(null);
    pending?.resolve(accepted);
  }

  function adoptProject(next: ResearchProject, saved: boolean) {
    cancelSaveTimer();
    projectRef.current = next;
    dirtyRef.current = false;
    setProject(next);
    setSaveState(saved ? "saved" : "idle");
    setStorageError(null);
    setError(null);
    setComparisonNotice(null);
    setLocatedExcerpt(null);
    setMode(next.analysis ? "explorer" : "workspace");
    setExplorerState(initialExplorerState());
  }

  useEffect(() => {
    let cancelled = false;
    readWorkspace().then((workspace) => {
      if (cancelled) return;
      setProjects(workspace.projects);
      adoptProject(workspace.project ?? newDraft(), Boolean(workspace.project));
    }).catch((cause) => {
      if (cancelled) return;
      adoptProject(newDraft(), false);
      setSaveState("error");
      setStorageError(cause instanceof Error ? cause.message : "Local saving is unavailable. You can still work in this page.");
    }).finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, []);

  function cancelSaveTimer() {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }

  function persist(snapshot: ResearchProject): Promise<void> {
    cancelSaveTimer();
    // IndexedDB serializes its own transactions. Keep only the latest pending save;
    // each write owns its captured project ID and never replaces current page state.
    if (projectRef.current?.id !== snapshot.id || deletingProjectId.current === snapshot.id) return Promise.resolve();
    const operation: Promise<void> = (async () => {
      await saveProject(snapshot);
      if (projectRef.current?.id === snapshot.id) await setActiveProjectId(snapshot.id);
      setProjects((current) => includeProject(current, snapshot));
      if (projectRef.current === snapshot) {
        dirtyRef.current = false;
        setSaveState("saved");
        setStorageError(null);
      }
    })().catch((cause) => {
      if (projectRef.current === snapshot) {
        setSaveState("error");
        setStorageError(cause instanceof Error ? cause.message : "Your changes could not be saved locally. Please retry.");
      }
      throw cause;
    }).finally(() => { if (pendingSave.current === operation) pendingSave.current = null; });
    pendingSave.current = operation;
    return operation;
  }

  async function flushSave() {
    cancelSaveTimer();
    if (pendingSave.current) await pendingSave.current.catch(() => {});
    const current = projectRef.current;
    if (current && dirtyRef.current) await persist(current);
  }

  function changeProject(next: ResearchProject): ResearchProject {
    const updated = { ...next, updatedAt: Date.now() };
    projectRef.current = updated;
    dirtyRef.current = true;
    setProject(updated);
    setSaveState("saving");
    return updated;
  }

  useEffect(() => {
    if (restoring || !project || !dirtyRef.current) return;
    saveTimer.current = window.setTimeout(() => {
      if (projectRef.current === project && dirtyRef.current) void persist(project).catch(() => {});
    }, 500);
    return cancelSaveTimer;
  }, [project, restoring]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !pendingSave.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") void flushSave().catch(() => {}); };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Status unavailable");
        const status = await response.json();
        setConnection(status.configured ? "configured" : "missing");
      })
      .catch(() => setConnection("unavailable"));
  }, []);

  useEffect(() => () => {
    const active = activeComparison.current;
    activeComparison.current = null;
    if (active?.timeoutId !== null && active?.timeoutId !== undefined) window.clearTimeout(active.timeoutId);
    active?.controller.abort();
    pendingConfirmation.current?.resolve(false);
    pendingConfirmation.current = null;
  }, []);

  const busy = loading || importing || restoring || transitioning || Boolean(confirmation);
  const hasInput = Boolean(sources.sourceA || sources.sourceB);
  const canCompare = Boolean(sources.sourceA.trim() && sources.sourceB.trim())
    && !busy;

  const updateSource = useCallback(async (source: SourceId, value: string, file?: ImportedSourceFile): Promise<boolean> => {
    const current = projectRef.current;
    if (!current || activeComparison.current || pendingConfirmation.current || restoring || transitioning) return false;
    if (file === undefined && current.sources[source === "A" ? "sourceA" : "sourceB"] === value) return true;
    if (hasAnnotations(current.analysis) && !await confirmAction({
      title: file ? `Replace Source ${source}?` : `Edit Source ${source}?`,
      message: file ? "Importing this text will clear the current analysis, review marks, and research notes. Cancel to keep them, or export a report before replacing the source." : "Changing the source will clear the current analysis, review marks, and research notes. Cancel to keep them, or export a report before editing.",
      confirmLabel: file ? "Replace source" : "Edit source",
    })) return false;
    if (projectRef.current !== current) return false;
    const existingFile = current.sourceFiles[source];
    const updated = changeProject({
      ...current,
      sources: { ...current.sources, [source === "A" ? "sourceA" : "sourceB"]: value },
      sourceFiles: { ...current.sourceFiles, [source]: file !== undefined ? file : existingFile ? { ...existingFile, edited: true } : null },
      analysis: null,
      isExample: false,
    });
    setError(null);
    setComparisonNotice(null);
    setLocatedExcerpt(null);
    setMode("workspace");
    setExplorerState(initialExplorerState());
    if (file !== undefined) void persist(updated).catch(() => {});
    return true;
  }, [restoring, transitioning, confirmAction]);

  const updateReview = useCallback((index: number, patch: Partial<FindingReview>) => {
    const current = projectRef.current;
    if (!current?.analysis || current.id !== project?.id || current.analysis.result !== result || activeComparison.current || pendingConfirmation.current || restoring || transitioning) return;
    const updated = changeProject({ ...current, analysis: withFindingReview(current.analysis, index, patch) });
    if (patch.note === undefined) void persist(updated).catch(() => {});
  }, [project?.id, result, restoring, transitioning]);

  function hasResearchContent(current: ResearchProject): boolean {
    return Boolean(current.sources.sourceA.trim() || current.sources.sourceB.trim() || current.analysis);
  }

  async function loadExample() {
    const current = projectRef.current;
    if (!current || busy) return;
    if (hasResearchContent(current) && !await confirmAction({ title: "Load the example?", message: `This replaces the sources and analysis in “${current.name}”${hasAnnotations(current.analysis) ? ", including your review marks and research notes" : ""}.`, confirmLabel: "Load example" })) return;
    if (projectRef.current !== current) return;
    const updated = changeProject({ ...current, sources: { ...example }, sourceFiles: { A: null, B: null }, analysis: null, isExample: true });
    setLocatedExcerpt(null);
    setError(null);
    setComparisonNotice(null);
    setMode("workspace");
    setExplorerState(initialExplorerState());
    void persist(updated).catch(() => {});
  }

  async function clearWorkspace() {
    const current = projectRef.current;
    if (!current || busy) return;
    if (hasResearchContent(current) && !await confirmAction({ title: "Clear this workspace?", message: `This removes both sources and the analysis${hasAnnotations(current.analysis) ? ", including your review marks and research notes" : ""}. The project itself will be kept.`, confirmLabel: "Clear workspace" })) return;
    if (projectRef.current !== current) return;
    const updated = changeProject({ ...current, sources: { sourceA: "", sourceB: "" }, sourceFiles: { A: null, B: null }, analysis: null, isExample: false });
    setLocatedExcerpt(null);
    setError(null);
    setComparisonNotice(null);
    setMode("workspace");
    setExplorerState(initialExplorerState());
    void persist(updated).catch(() => {});
    sourceARef.current?.focus();
  }

  async function selectProject(id: string) {
    if (busy || id === projectRef.current?.id) return;
    setTransitioning(true);
    try {
      await flushSave();
      const next = await getProject(id);
      if (!next) throw new Error("This project no longer exists. Refresh the project list and retry.");
      await setActiveProjectId(id);
      adoptProject(next, true);
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "The project could not be opened."); }
    finally { setTransitioning(false); }
  }

  async function createProject(): Promise<boolean> {
    if (busy) return false;
    setTransitioning(true);
    try {
      await flushSave();
      const names = new Set([...projects.map((item) => item.name), projectRef.current?.name]);
      let name = "Untitled project";
      for (let index = 2; names.has(name); index++) name = `Untitled project ${index}`;
      const next = newDraft(name);
      await saveProject(next);
      await setActiveProjectId(next.id);
      setProjects((current) => includeProject(current, next));
      adoptProject(next, true);
      return true;
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "A project could not be created."); return false; }
    finally { setTransitioning(false); }
  }

  async function renameProject(name: string): Promise<boolean> {
    const current = projectRef.current;
    if (!current || busy || !name.trim() || name.trim().length > 80) return false;
    setTransitioning(true);
    try {
      changeProject({ ...current, name: name.trim() });
      await flushSave();
      return true;
    } catch { return false; }
    finally { setTransitioning(false); }
  }

  async function removeProject() {
    const current = projectRef.current;
    if (!current || busy || !await confirmAction({ title: `Delete “${current.name}”?`, message: "This permanently removes the project, its sources, analysis, and any review notes.", confirmLabel: "Delete project" })) return;
    setTransitioning(true);
    deletingProjectId.current = current.id;
    cancelSaveTimer();
    try {
      if (pendingSave.current) await pendingSave.current.catch(() => {});
      const remaining = projects.filter((item) => item.id !== current.id);
      const next = remaining[0] ? await getProject(remaining[0].id) : null;
      await deleteProject(current.id, next?.id ?? null);
      setProjects(remaining);
      adoptProject(next ?? newDraft(), Boolean(next));
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "The project could not be deleted."); }
    finally { deletingProjectId.current = null; setTransitioning(false); }
  }

  async function retrySaving() {
    if (busy) return;
    setTransitioning(true);
    try {
      if (dirtyRef.current) await flushSave();
      else {
        const workspace = await readWorkspace();
        setProjects(workspace.projects);
        adoptProject(workspace.project ?? newDraft(), Boolean(workspace.project));
      }
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "Local saving is unavailable. Please retry."); }
    finally { setTransitioning(false); }
  }

  function exportReport() {
    const current = projectRef.current;
    if (!current?.analysis || busy) return;
    const url = URL.createObjectURL(new Blob([buildMarkdownReport(current)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFileName(current.name);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function finishComparison(active: ActiveComparison): boolean {
    if (activeComparison.current !== active) return false;
    activeComparison.current = null;
    if (active.timeoutId !== null) window.clearTimeout(active.timeoutId);
    setLoading(false);
    setComparisonStartedAt(null);
    return true;
  }

  function cancelComparison() {
    const active = activeComparison.current;
    if (!active || !finishComparison(active)) return;
    active.controller.abort();
    setComparisonNotice("Comparison cancelled. Your sources and review are unchanged.");
  }

  async function compare() {
    const current = projectRef.current;
    if (!canCompare || !current || activeComparison.current || pendingConfirmation.current) return;
    if (hasAnnotations(current.analysis) && !await confirmAction({ title: "Run a new comparison?", message: "If the new comparison succeeds, it will replace these findings, review marks, and research notes. Cancelling or a failed comparison keeps them. Export a report first if you want a copy.", confirmLabel: "Compare sources" })) return;
    if (projectRef.current !== current || activeComparison.current) return;
    const active: ActiveComparison = { controller: new AbortController(), projectId: current.id, timeoutId: null };
    activeComparison.current = active;
    setLoading(true);
    setComparisonStartedAt(Date.now());
    setError(null);
    setComparisonNotice(null);
    active.timeoutId = window.setTimeout(() => {
      if (!finishComparison(active)) return;
      active.controller.abort();
      setError("No response after 255 seconds. Check the connection and try comparing again.");
    }, COMPARISON_CLIENT_TIMEOUT_MS);

    try {
      await flushSave().catch(() => {});
      if (activeComparison.current !== active) return;
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current.sources),
        signal: active.controller.signal,
      });
      const payload = await response.json().catch(() => {
        throw new Error("The server returned an unreadable response. Try comparing again.");
      });
      if (activeComparison.current !== active || projectRef.current?.id !== active.projectId) return;
      if (!response.ok) throw new Error(payload.error || "This comparison could not be completed. Please try again.");
      finishComparison(active);
      const updated = changeProject({ ...current, analysis: { result: payload as ComparisonResult, completedAt: Date.now() } });
      setExplorerState(initialExplorerState());
      setMode("explorer");
      setConnection("connected");
      await persist(updated).catch(() => {});
    } catch (cause) {
      if (activeComparison.current === active) setError(cause instanceof Error ? cause.message : "The connection was interrupted. Try comparing again.");
    } finally {
      finishComparison(active);
    }
  }

  function locateExcerpt(source: SourceId, quote: string) {
    const text = projectRef.current?.sources[source === "A" ? "sourceA" : "sourceB"];
    if (text?.includes(quote)) { setLocatedExcerpt({ source, quote }); setMode("workspace"); }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="SourceLens home">
          <svg className="brand-mark" width="31" height="31" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="9" fill="currentColor" /><path d="M12 10h11v17H12zM17 14h11v17H17z" stroke="white" strokeWidth="1.7" /><path d="M20 19h5m-5 4h5m-5 4h3" stroke="white" strokeWidth="1.3" /></svg>
          <span>SourceLens</span>
        </a>
        <span className="header-divider" aria-hidden="true" />
        <span className="workspace-label">Research workspace</span>
        <div className={`connection-status ${connection}`} title={connection === "configured" ? "Server configuration is present. A successful comparison confirms the connection." : connectionLabels[connection]}>
          <span className="connection-dot" />{connectionLabels[connection]}
        </div>
      </header>

      <main className="main-content">
        <ProjectToolbar project={project} projects={projects} saveState={saveState} disabled={busy} onSelect={selectProject} onCreate={createProject} onRename={renameProject} onDelete={removeProject} onExport={exportReport} />
        {storageError && <div className="error-notice storage-notice" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Could not save this project</strong><p>{storageError}</p></div><button type="button" className="storage-retry" disabled={busy} onClick={() => { void retrySaving(); }}>Retry</button></div>}
        <div className="workspace-modes" role="group" aria-label="Workspace mode"><button type="button" aria-pressed={mode === "workspace"} disabled={importing || restoring || transitioning || Boolean(confirmation)} onClick={() => setMode("workspace")}>Workspace</button><button type="button" aria-pressed={mode === "explorer"} disabled={!result || importing || restoring || transitioning || Boolean(confirmation)} onClick={() => setMode("explorer")}>Evidence Explorer</button></div>
        {error && <div className="error-notice" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Could not complete the comparison</strong><p>{error}</p><p>Your sources, previous findings, and review notes are unchanged.</p></div><button type="button" className="dismiss-error" onClick={() => setError(null)} aria-label="Dismiss error"><X size={16} aria-hidden="true" /></button></div>}
        {comparisonNotice && <p className="comparison-notice" role="status">{comparisonNotice}</p>}
        {isExample && <div className="example-notice"><FlaskConical size={13} aria-hidden="true" /><span>Fictional example · Sample competition rules.</span></div>}
        {mode === "workspace" ? <form onSubmit={(event) => { event.preventDefault(); void compare(); }} onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canCompare) {
            event.preventDefault();
            void compare();
          }
        }}>
          <div className="workspace-intro">
            <div className="workspace-title-block">
              <p className="eyebrow">YOUR SOURCES</p>
              <h1>Compare sources<span className="title-period">.</span></h1>
              <p className="workspace-description">Prepare two sources, then compare the claims they make.</p>
            </div>
            <div className="workspace-actions">
              {hasInput && <button type="button" className="button button-clear" onClick={() => { void clearWorkspace(); }} disabled={busy} title="Clear both sources"><RotateCcw size={14} aria-hidden="true" /><span>Clear</span></button>}
              <button type="button" className="button button-secondary" onClick={() => { void loadExample(); }} disabled={busy}><FlaskConical size={15} strokeWidth={1.7} aria-hidden="true" />Try Example</button>
              <button type="submit" className="button button-primary" disabled={!canCompare} title="Compare sources (Ctrl / ⌘ + Enter)">{loading ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : null}{loading ? "Comparing…" : "Compare Sources"}{!loading && <ArrowRight size={16} aria-hidden="true" />}</button>
            </div>
          </div>

          <FindingsPanel result={result} completedAt={project?.analysis?.completedAt} loading={loading} startedAt={comparisonStartedAt} onCancel={cancelComparison} onOpenExplorer={() => setMode("explorer")} />
          {annotated && <div className="annotation-notice"><p>Your review belongs to this analysis. Editing sources or replacing the analysis clears its marks and notes. Export a report to keep a copy.</p><button type="button" disabled={busy} onClick={exportReport}>Export report</button></div>}
          <div className="workspace-grid workspace-editing">
            <div className="sources-grid" key={project?.id ?? "restoring"}>
              <SourcePanel source="A" value={sources.sourceA} onChange={updateSource} onImport={updateSource} onImportingChange={setImporting} importedFile={sourceFiles.A} readOnly={busy} inputRef={sourceARef} location={locatedExcerpt?.source === "A" ? locatedExcerpt : null} />
              <SourcePanel source="B" value={sources.sourceB} onChange={updateSource} onImport={updateSource} onImportingChange={setImporting} importedFile={sourceFiles.B} readOnly={busy} inputRef={sourceBRef} location={locatedExcerpt?.source === "B" ? locatedExcerpt : null} />
            </div>
          </div>

          <div className="workspace-notes">
            <p><span className="notes-marker" aria-hidden="true" />SourceLens compares statements, not objective truth.</p>
            <p className="shortcut-hint"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><span>to compare</span></p>
          </div>
        </form> : project?.analysis && <><div className="explorer-intro"><div><p className="eyebrow">REVIEW THE EVIDENCE</p><h1>Evidence Explorer<span className="title-period">.</span></h1></div><p>Compare excerpts, record observations, and track your review.</p></div>{loading && comparisonStartedAt !== null && <ComparisonProgress startedAt={comparisonStartedAt} onCancel={cancelComparison} />}<EvidenceExplorer analysis={project.analysis} sourceFiles={sourceFiles} state={explorerState} onStateChange={setExplorerState} onReviewChange={updateReview} onLocate={locateExcerpt} readOnly={busy} /></>}
      </main>

      <footer className="app-footer"><span className="version-label">SourceLens <span>V0.6</span></span><p>Projects and reviews stay in this browser. Sources are sent to AI when you compare.</p><a href="https://github.com/sx933229xiao-droid/sourcelens-evidence" target="_blank" rel="noreferrer">Project on GitHub <ArrowRight size={12} aria-hidden="true" /></a></footer>
      {confirmation && <ConfirmationDialog {...confirmation} onConfirm={() => resolveConfirmation(true)} onCancel={() => resolveConfirmation(false)} />}
      <span className="sr-only" role="status" aria-live="polite">{result && !loading ? `${result.findings.length} findings with matching source excerpts.` : ""}</span>
    </div>
  );
}
