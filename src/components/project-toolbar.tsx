"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download, FolderOpen, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import type { ProjectSummary, ResearchProject } from "@/lib/project-store";

export type SaveState = "restoring" | "idle" | "saving" | "saved" | "error";

type ProjectToolbarProps = {
  project: ResearchProject | null;
  projects: ProjectSummary[];
  saveState: SaveState;
  disabled: boolean;
  onSelect: (id: string) => Promise<void>;
  onCreate: () => Promise<boolean>;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onExport: () => void;
};

const saveLabels: Record<SaveState, string> = { restoring: "Restoring…", idle: "Ready to save locally", saving: "Saving…", saved: "Saved locally", error: "Not saved" };

export function ProjectToolbar({ project, projects, saveState, disabled, onSelect, onCreate, onRename, onDelete, onExport }: ProjectToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setName(project?.name ?? ""); }, [project?.id, project?.name]);
  useEffect(() => { if (editing) { nameRef.current?.focus(); nameRef.current?.select(); } }, [editing]);

  return (
    <section className="project-bar" aria-label="Research projects">
      <div className="project-navigation">
        <FolderOpen size={16} strokeWidth={1.6} className="project-folder" aria-hidden="true" />
        {editing ? (
          <form className="project-name-form" onSubmit={async (event) => { event.preventDefault(); if (name.trim() && await onRename(name.trim())) setEditing(false); }}>
            <input ref={nameRef} aria-label="Project name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setEditing(false); setName(project?.name ?? ""); } }} disabled={disabled} />
            <button type="submit" className="project-action" disabled={disabled || !name.trim()}>Save</button>
            <button type="button" className="project-action" disabled={disabled} onClick={() => { setEditing(false); setName(project?.name ?? ""); }}>Cancel</button>
          </form>
        ) : (
          <div className="project-select-wrap">
            <label className="sr-only" htmlFor="project-select">Current research project</label>
            <select id="project-select" value={project?.id ?? ""} disabled={disabled || !project} onChange={(event) => { void onSelect(event.target.value); }} title={project?.name}>
              {!project && <option value="">Restoring projects…</option>}
              {project && !projects.some((item) => item.id === project.id) && <option value={project.id}>{project.name}</option>}
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </div>
        )}
        {!editing && <button type="button" className="project-action" disabled={disabled} onClick={async () => { if (await onCreate()) setEditing(true); }}><Plus size={13} aria-hidden="true" />New<span className="project-action-extra"> Project</span></button>}
        {!editing && <button type="button" className="project-action" disabled={disabled || !project} onClick={() => { setName(project?.name ?? ""); setEditing(true); }} title="Rename project"><Pencil size={12} aria-hidden="true" />Rename</button>}
        {!editing && <button type="button" className="project-action project-delete" disabled={disabled || !project} onClick={() => { void onDelete(); }} title="Delete project"><Trash2 size={12} aria-hidden="true" /><span className="sr-only">Delete project</span></button>}
      </div>
      <div className="project-tools">
        <span className={`save-status save-${saveState}`} role="status" aria-live="polite">{saveState === "saving" || saveState === "restoring" ? <LoaderCircle size={12} className="spinner" aria-hidden="true" /> : saveState === "saved" ? <Check size={12} aria-hidden="true" /> : null}{saveLabels[saveState]}</span>
        <button type="button" className="project-export" disabled={disabled || !project?.analysis} onClick={onExport}><Download size={13} aria-hidden="true" />Export Markdown</button>
      </div>
    </section>
  );
}
