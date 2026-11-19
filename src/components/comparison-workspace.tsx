"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CircleAlert, FlaskConical, LoaderCircle, RotateCcw, X } from "lucide-react";
import { ComparisonProgress, FindingsPanel } from "./findings-panel";
import { EvidenceExplorer, createExplorerMemory, initialExplorerState } from "./evidence-explorer";
import { ConfirmationDialog, type Confirmation } from "./confirmation-dialog";
import { SourcePanel } from "./source-panel";
import { ProjectToolbar, type SaveState } from "./project-toolbar";
import { StudioShell, type StudioMode } from "./studio-shell";
import { COMPARISON_CLIENT_TIMEOUT_MS, type ComparisonResult, type SourceId } from "@/lib/comparison-schema";
import { example } from "@/lib/example";
import { deleteProject, getActiveProjectId, getProject, hasAnnotations, insertRestoredProject, listProjects, markSourceEdited, saveProject, setActiveProjectId, withFindingReview, type FindingReview, type ImportedSourceFile, type ProjectSummary, type ResearchProject } from "@/lib/project-store";
import { buildMarkdownReport, reportFileName } from "@/lib/markdown-report";
import { backupFileName, LARGE_BACKUP_BYTES, parseProjectBackup, restoredProjectName, serializeProjectBackup } from "@/lib/project-backup";

type Connection = "checking" | "configured" | "connected" | "missing" | "unavailable";
type ActiveComparison = { controller: AbortController; projectId: string; timeoutId: number | null };
type PendingConfirmation = Confirmation & { resolve: (accepted: boolean) => void };

const reviewContent = "review marks, research notes, corrections, and exclusions";

function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pageRecoveryNotice(sources: SourceId[]): string {
  return sources.length ? ` PDF page information is unavailable for ${sources.map((source) => `Source ${source}`).join(" and ")}. The sources, findings, and reviews were kept.` : "";
}

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
  const [transferNotice, setTransferNotice] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<Connection>("checking");
  const [comparisonStartedAt, setComparisonStartedAt] = useState<number | null>(null);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<StudioMode>("workspace");
  const [mobileSource, setMobileSource] = useState<SourceId>("A");
  const [searchRequest, setSearchRequest] = useState(0);
  const [explorerState, setExplorerState] = useState(initialExplorerState);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const explorerMemory = useRef(createExplorerMemory());
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

  function resetExplorer(analysis?: ResearchProject["analysis"]) {
    explorerMemory.current = createExplorerMemory();
    setExplorerState(initialExplorerState(analysis));
    setSearchRequest(0);
  }

  function adoptProject(next: ResearchProject, saved: boolean) {
    cancelSaveTimer();
    projectRef.current = next;
    dirtyRef.current = false;
    setProject(next);
    setSaveState(saved ? "saved" : "idle");
    setStorageError(null);
    setTransferNotice(null);
    setError(null);
    setComparisonNotice(null);
    setMode(next.analysis ? "explorer" : "workspace");
    setMobileSource("A");
    resetExplorer(next.analysis);
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
  const modeLocked = importing || restoring || transitioning || Boolean(confirmation);
  const hasInput = Boolean(sources.sourceA || sources.sourceB);
  const canCompare = Boolean(sources.sourceA.trim() && sources.sourceB.trim())
    && !busy;

  const searchFindings = useCallback(() => {
    if (!result || modeLocked) return;
    setMode("explorer");
    setSearchRequest((current) => current + 1);
  }, [result, modeLocked]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && result && !modeLocked && !event.isComposing && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        searchFindings();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [result, modeLocked, searchFindings]);

  const updateSource = useCallback(async (source: SourceId, value: string, file?: ImportedSourceFile): Promise<boolean> => {
    const current = projectRef.current;
    if (!current || activeComparison.current || pendingConfirmation.current || restoring || transitioning) return false;
    if (file === undefined && current.sources[source === "A" ? "sourceA" : "sourceB"] === value) return true;
    if (hasAnnotations(current.analysis) && !await confirmAction({
      title: file ? `Replace Source ${source}?` : `Edit Source ${source}?`,
      message: file ? `Importing this text will clear the current analysis and its ${reviewContent}. Cancel to keep them, or export a backup before replacing the source.` : `Changing the source will clear the current analysis and its ${reviewContent}. Cancel to keep them, or export a backup before editing.`,
      confirmLabel: file ? "Replace source" : "Edit source",
    })) return false;
    if (projectRef.current !== current) return false;
    const existingFile = current.sourceFiles[source];
    const updated = changeProject({
      ...current,
      sources: { ...current.sources, [source === "A" ? "sourceA" : "sourceB"]: value },
      sourceFiles: { ...current.sourceFiles, [source]: file !== undefined ? file : markSourceEdited(existingFile) },
      analysis: null,
      isExample: false,
    });
    setError(null);
    setComparisonNotice(null);
    setMode("workspace");
    resetExplorer();
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
    if (hasResearchContent(current) && !await confirmAction({ title: "Load the example?", message: `This replaces the sources and analysis in “${current.name}”${hasAnnotations(current.analysis) ? `, including your ${reviewContent}` : ""}.`, confirmLabel: "Load example" })) return;
    if (projectRef.current !== current) return;
    const updated = changeProject({ ...current, sources: { ...example }, sourceFiles: { A: null, B: null }, analysis: null, isExample: true });
    setError(null);
    setComparisonNotice(null);
    setMode("workspace");
    resetExplorer();
    void persist(updated).catch(() => {});
  }

  async function clearWorkspace() {
    const current = projectRef.current;
    if (!current || busy) return;
    if (hasResearchContent(current) && !await confirmAction({ title: "Clear this workspace?", message: `This removes both sources and the analysis${hasAnnotations(current.analysis) ? `, including your ${reviewContent}` : ""}. The project itself will be kept.`, confirmLabel: "Clear workspace" })) return;
    if (projectRef.current !== current) return;
    const updated = changeProject({ ...current, sources: { sourceA: "", sourceB: "" }, sourceFiles: { A: null, B: null }, analysis: null, isExample: false });
    setError(null);
    setComparisonNotice(null);
    setMode("workspace");
    resetExplorer();
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
    if (!current || busy || !await confirmAction({ title: `Delete “${current.name}”?`, message: `This permanently removes the project, its sources, analysis, and any ${reviewContent}.`, confirmLabel: "Delete project" })) return;
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
    downloadFile(buildMarkdownReport(current), reportFileName(current.name), "text/markdown;charset=utf-8");
  }

  async function exportBackup() {
    const current = projectRef.current;
    if (!current || busy) return;
    setTransitioning(true);
    setTransferNotice(null);
    try {
      const backup = await serializeProjectBackup(current);
      downloadFile(backup.json, backupFileName(current.name), "application/json;charset=utf-8");
      setTransferNotice({ kind: backup.invalidPageSources.length ? "warning" : "success", text: `Backup exported for “${current.name}”.` + pageRecoveryNotice(backup.invalidPageSources) });
    } catch (cause) { setTransferNotice({ kind: "error", text: cause instanceof Error ? cause.message : "The project backup could not be created." }); }
    finally { setTransitioning(false); }
  }

  async function restoreBackup(file: File) {
    if (busy) return;
    setTransitioning(true);
    setTransferNotice(null);
    try {
      if (file.size > LARGE_BACKUP_BYTES && !await confirmAction({ title: "Open a large backup?", message: "This backup is larger than 100 MB. Reading it may use substantial browser memory. You can cancel before the file is read.", confirmLabel: "Read backup" })) return;
      const validated = await parseProjectBackup(await file.text());
      await flushSave();
      const names = new Set(projects.map((item) => item.name));
      const activeName = projectRef.current?.name;
      if (activeName) names.add(activeName);
      const restored: ResearchProject = { ...validated.project, id: crypto.randomUUID(), name: restoredProjectName(validated.project.name, names), updatedAt: Date.now() };
      await insertRestoredProject(restored);
      setProjects((current) => includeProject(current, restored));
      adoptProject(restored, true);
      setTransferNotice({ kind: validated.invalidPageSources.length ? "warning" : "success", text: `Restored “${restored.name}” as a new project.` + pageRecoveryNotice(validated.invalidPageSources) });
    } catch (cause) { setTransferNotice({ kind: "error", text: cause instanceof Error ? cause.message : "The backup could not be restored. Your current project is unchanged." }); }
    finally { setTransitioning(false); }
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
    if (hasAnnotations(current.analysis) && !await confirmAction({ title: "Run a new comparison?", message: `If the new comparison succeeds, it will replace these findings and clear their ${reviewContent}. Cancelling or a failed comparison keeps them. Export a backup first if you want a copy.`, confirmLabel: "Compare sources" })) return;
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
      resetExplorer(updated.analysis);
      setMode("explorer");
      setConnection("connected");
      await persist(updated).catch(() => {});
    } catch (cause) {
      if (activeComparison.current === active) setError(cause instanceof Error ? cause.message : "The connection was interrupted. Try comparing again.");
    } finally {
      finishComparison(active);
    }
  }

  return (
    <>
      <StudioShell
        mode={mode} onModeChange={setMode} modeLocked={modeLocked} canOpenExplorer={Boolean(result)}
        toolbar={<ProjectToolbar
          project={project} projects={projects} saveState={saveState} mode={mode} disabled={busy}
          searchEnabled={Boolean(result) && !modeLocked} onSearch={searchFindings}
          onSelect={selectProject} onCreate={createProject} onRename={renameProject} onDelete={removeProject}
          onExport={exportReport} onBackup={() => { void exportBackup(); }} onRestore={restoreBackup}
        />}
        notices={<>
          {transferNotice && <div className={`project-transfer-notice ${transferNotice.kind}`} role={transferNotice.kind === "error" ? "alert" : "status"}><p>{transferNotice.text}</p><button type="button" onClick={() => setTransferNotice(null)} aria-label="Dismiss project message"><X size={15} aria-hidden="true" /></button></div>}
          {storageError && <div className="error-notice storage-notice" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Could not save this project</strong><p>{storageError}</p></div><button type="button" className="storage-retry" disabled={busy} onClick={() => { void retrySaving(); }}>Retry</button></div>}
          {error && <div className="error-notice" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Could not complete the comparison</strong><p>{error}</p><p>Your sources, previous findings, and review notes are unchanged.</p></div><button type="button" className="dismiss-error" onClick={() => setError(null)} aria-label="Dismiss error"><X size={16} aria-hidden="true" /></button></div>}
          {comparisonNotice && <p className="comparison-notice" role="status">{comparisonNotice}</p>}
          {loading && comparisonStartedAt !== null && <ComparisonProgress startedAt={comparisonStartedAt} onCancel={cancelComparison} />}
        </>}
      >
        {mode === "workspace" ? <form className="studio-workspace" onSubmit={(event) => { event.preventDefault(); void compare(); }} onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canCompare) {
            event.preventDefault();
            void compare();
          }
        }}>
          <div className="studio-workspace-toolbar">
            <div className="studio-workspace-heading">
              <h1>Sources</h1>
              <span className={`studio-connection connection-${connection}`} title={connectionLabels[connection]}><span />{connectionLabels[connection]}</span>
              {isExample && <span className="studio-example">Fictional example</span>}
            </div>
            <div className="workspace-actions">
              {hasInput && <button type="button" className="button button-clear" onClick={() => { void clearWorkspace(); }} disabled={busy} title="Clear both sources"><RotateCcw size={14} aria-hidden="true" /><span>Clear</span></button>}
              <button type="button" className="button button-secondary" onClick={() => { void loadExample(); }} disabled={busy}><FlaskConical size={15} strokeWidth={1.7} aria-hidden="true" />Try Example</button>
              <button type="submit" className="button button-primary" disabled={!canCompare} title="Compare sources (Ctrl / ⌘ + Enter)">{loading ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : null}{loading ? "Comparing…" : "Compare Sources"}{!loading && <ArrowRight size={16} aria-hidden="true" />}</button>
            </div>
          </div>
          <FindingsPanel result={result} completedAt={project?.analysis?.completedAt} onOpenExplorer={() => setMode("explorer")} />
          {annotated && <p className="studio-annotation-note">Editing a source clears this analysis and its review after confirmation.</p>}
          <div className="studio-mobile-sources" role="group" aria-label="Source to edit">
            {(["A", "B"] as const).map((source) => <button className="studio-toggle" type="button" key={source} aria-pressed={source === mobileSource} disabled={importing} onClick={() => setMobileSource(source)}>Source {source}</button>)}
          </div>
          <div className="studio-source-grid" data-mobile-source={mobileSource} key={project?.id ?? "restoring"}>
            <SourcePanel source="A" value={sources.sourceA} onChange={updateSource} onImport={updateSource} onImportingChange={setImporting} importedFile={sourceFiles.A} readOnly={busy} inputRef={sourceARef} />
            <SourcePanel source="B" value={sources.sourceB} onChange={updateSource} onImport={updateSource} onImportingChange={setImporting} importedFile={sourceFiles.B} readOnly={busy} inputRef={sourceBRef} />
          </div>
        </form> : project?.analysis && <EvidenceExplorer analysis={project.analysis} sourceFiles={sourceFiles} sources={sources} state={explorerState} memory={explorerMemory.current} searchRequest={searchRequest} onStateChange={setExplorerState} onReviewChange={updateReview} readOnly={busy} />}
      </StudioShell>
      {confirmation && <ConfirmationDialog {...confirmation} onConfirm={() => resolveConfirmation(true)} onCancel={() => resolveConfirmation(false)} />}
      <span className="sr-only" role="status" aria-live="polite">{result && !loading ? `${result.findings.length} findings with matching source excerpts.` : ""}</span>
    </>
  );
}
