"use client";

import { FileText, FolderOpen, Layers3 } from "lucide-react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

export type StudioMode = "workspace" | "explorer";

type Props = {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  canOpenExplorer: boolean;
  modeLocked: boolean;
  toolbar: ReactNode;
  notices: ReactNode;
  children: ReactNode;
};

export function StudioShell({ mode, onModeChange, canOpenExplorer, modeLocked, toolbar, notices, children }: Props) {
  return (
    <MotionConfig reducedMotion="user">
    <div className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-brand" aria-label="SourceLens Research Studio">
          <span className="studio-brand-mark"><FileText size={19} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="studio-wordmark">SourceLens</span>
        </div>
        {toolbar}
      </header>
      <LayoutGroup id="studio-mode">
      <nav className="studio-rail" aria-label="Research Studio">
        <button type="button" className="studio-nav-item" aria-label="Workspace" title="Workspace" aria-current={mode === "workspace" ? "page" : undefined} disabled={modeLocked} onClick={() => onModeChange("workspace")}>
          {mode === "workspace" && <motion.span layoutId="active" className="studio-mode-mark" aria-hidden="true" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
          <FileText size={20} strokeWidth={1.7} aria-hidden="true" /><span className="studio-nav-label">Workspace</span>
        </button>
        <button type="button" className="studio-nav-item" aria-label="Evidence Explorer" title={canOpenExplorer ? "Evidence Explorer" : "Compare sources to open Evidence Explorer"} aria-current={mode === "explorer" ? "page" : undefined} disabled={modeLocked || !canOpenExplorer} onClick={() => onModeChange("explorer")}>
          {mode === "explorer" && <motion.span layoutId="active" className="studio-mode-mark" aria-hidden="true" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
          <Layers3 size={21} strokeWidth={1.7} aria-hidden="true" /><span className="studio-nav-label">Evidence Explorer</span>
        </button>
        <button type="button" className="studio-nav-item studio-rail-projects" aria-label="Projects" title="Projects" popoverTarget="studio-project-menu" disabled={modeLocked}>
          <FolderOpen size={20} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </nav>
      </LayoutGroup>
      <main className="studio-main">
        <div className="studio-notices">{notices}</div>
        <div className="studio-stage">
          <motion.div key={mode} className="studio-scene" initial={{ x: mode === "explorer" ? 12 : -12, opacity: .94 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: .18, ease: [.2, .78, .22, 1] }}>
            {children}
          </motion.div>
        </div>
      </main>
    </div>
    </MotionConfig>
  );
}
