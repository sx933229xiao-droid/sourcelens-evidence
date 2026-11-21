"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CircleAlert, Download, Ellipsis, LoaderCircle, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { motion } from "motion/react";
import type { ProjectSummary, ResearchProject } from "@/lib/project-store";

export type SaveState = "restoring" | "idle" | "saving" | "saved" | "error";

type ProjectToolbarProps = {
  project: ResearchProject | null;
  projects: ProjectSummary[];
  saveState: SaveState;
  disabled: boolean;
  searchEnabled: boolean;
  onSearch: () => void;
  onSelect: (id: string) => Promise<void>;
  onCreate: () => Promise<boolean>;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onExport: () => void;
  onBackup: () => void;
  onRestore: (file: File) => Promise<void>;
};

const saveLabels: Record<SaveState, string> = {
  restoring: "Opening…",
  idle: "Draft",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function ProjectToolbar({ project, projects, saveState, disabled, searchEnabled, onSearch, onSelect, onCreate, onRename, onDelete, onExport, onBackup, onRestore }: ProjectToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const projectMenu = useRef<HTMLDivElement>(null);
  const exportMenu = useRef<HTMLDivElement>(null);
  useEffect(() => { setName(project?.name ?? ""); }, [project?.id, project?.name]);
  useEffect(() => { if (editing) { nameRef.current?.focus(); nameRef.current?.select(); } }, [editing]);

  async function createAndRename() {
    if (await onCreate()) setEditing(true);
  }

  function cancelRename() {
    setEditing(false);
    setName(project?.name ?? "");
  }

  return (
    <section className="studio-project-bar" aria-label="Research projects">
      <div className="studio-breadcrumb">
        {editing ? (
          <form className="studio-rename" onSubmit={async (event) => { event.preventDefault(); if (name.trim() && await onRename(name.trim())) setEditing(false); }}>
            <input ref={nameRef} aria-label="Project name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") cancelRename(); }} disabled={disabled} />
            <button type="submit" className="studio-icon" aria-label="Save project name" disabled={disabled || !name.trim()}><Check size={16} aria-hidden="true" /></button>
            <button type="button" className="studio-link" onClick={cancelRename}>Cancel</button>
          </form>
        ) : (
          <div className="studio-project-select">
            <label className="sr-only" htmlFor="project-select">Current research project</label>
            <select id="project-select" value={project?.id ?? ""} disabled={disabled || !project} onChange={(event) => { void onSelect(event.target.value); }} title={project?.name}>
              {!project && <option value="">Opening projects…</option>}
              {project && !projects.some((item) => item.id === project.id) && <option value={project.id}>{project.name}</option>}
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </div>
        )}
        {!editing && (
          <button type="button" className="button button-secondary studio-new-project" disabled={disabled} aria-label="New project" title="New project" onClick={createAndRename}>
            <Plus size={15} aria-hidden="true" /><span>New project</span>
          </button>
        )}
      </div>
      <button type="button" className="studio-search-trigger" onClick={onSearch} disabled={!searchEnabled} aria-label="Search findings" aria-keyshortcuts="Control+K Meta+K">
        <Search size={16} strokeWidth={1.7} aria-hidden="true" /><span>Search findings, quotes, or notes…</span><kbd>Ctrl K</kbd>
      </button>
      <div className="studio-top-actions">
        <span className={`studio-save save-${saveState}`} role="status" title={saveState === "saved" ? "Saved locally" : saveLabels[saveState]}>
          {saveState === "saving" || saveState === "restoring" ? <LoaderCircle size={15} className="spinner" aria-hidden="true" /> : saveState === "saved" ? <motion.span className="studio-save-check" aria-hidden="true" initial={{ scale: .75, opacity: .55 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: .14 }}><Check size={16} /></motion.span> : saveState === "error" ? <CircleAlert size={15} aria-hidden="true" /> : null}
          <span>{saveLabels[saveState]}</span>
        </span>
        <button type="button" className="studio-export button button-secondary" popoverTarget="studio-export-menu" disabled={disabled || !project} aria-label="Export"><Download className="studio-export-icon" size={16} aria-hidden="true" /><span>Export</span><ChevronDown size={12} aria-hidden="true" /></button>
        <button type="button" className="studio-icon" popoverTarget="studio-project-menu" disabled={disabled} aria-label="Project actions" title="Project actions"><Ellipsis size={21} aria-hidden="true" /></button>
      </div>
      <div id="studio-export-menu" ref={exportMenu} popover="auto" className="studio-popover studio-export-menu" aria-label="Export options">
        <button type="button" disabled={disabled || !project?.analysis} onClick={() => { exportMenu.current?.hidePopover(); onExport(); }}><Download size={15} aria-hidden="true" />Export Markdown</button>
        <button type="button" disabled={disabled || !project} onClick={() => { exportMenu.current?.hidePopover(); onBackup(); }}><Download size={15} aria-hidden="true" />Export backup</button>
      </div>
      <div id="studio-project-menu" ref={projectMenu} popover="auto" className="studio-popover" aria-label="Project actions">
        <button type="button" disabled={disabled} onClick={() => { projectMenu.current?.hidePopover(); void createAndRename(); }}><Plus size={15} aria-hidden="true" />New project</button>
        <button type="button" disabled={disabled || !project} onClick={() => { projectMenu.current?.hidePopover(); setName(project?.name ?? ""); setEditing(true); }}><Pencil size={15} aria-hidden="true" />Rename project</button>
        <button type="button" disabled={disabled} onClick={() => { projectMenu.current?.hidePopover(); backupInputRef.current?.click(); }}><Upload size={15} aria-hidden="true" />Restore project</button>
        <button type="button" className="studio-destructive" disabled={disabled || !project} onClick={() => { projectMenu.current?.hidePopover(); void onDelete(); }}><Trash2 size={15} aria-hidden="true" />Delete project</button>
      </div>
      <input ref={backupInputRef} type="file" aria-label="Project backup file" accept=".sourcelens.json,.json,application/json" hidden disabled={disabled} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void onRestore(file); }} />
    </section>
  );
}
