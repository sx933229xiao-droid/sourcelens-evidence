"use client";

import { ChevronLeft, MoveHorizontal, X } from "lucide-react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { Group, Panel, Separator, type GroupImperativeHandle, type Layout } from "react-resizable-panels";

export type ExplorerViewport = "desktop" | "tablet" | "phone";
export type ExplorerPreferences = {
  version: 1;
  sizes: { findings: number; detail: number; inspector: number };
  open: boolean;
  collapsedFindings: number;
};

const storageKey = "sourcelens.ui.v08";
export const defaultExplorerPreferences: ExplorerPreferences = {
  version: 1,
  sizes: { findings: 24, detail: 46, inspector: 30 },
  open: true,
  collapsedFindings: 24,
};

function requestedSizes(layout: Layout): ExplorerPreferences["sizes"] | null {
  const { findings, detail, inspector } = layout;
  const values = [findings, detail, inspector];
  if (values.some((size) => !Number.isFinite(size) || size <= 0 || size >= 100)) return null;
  const sum = findings + detail + inspector;
  if (Math.abs(sum - 100) > .1) return null;
  return { findings, detail, inspector };
}

export function loadExplorerPreferences(): ExplorerPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    const sizes = saved?.sizes && requestedSizes(saved.sizes);
    if (saved?.version === 1 && sizes && typeof saved.open === "boolean" &&
        Number.isFinite(saved.collapsedFindings) && saved.collapsedFindings > 0 && saved.collapsedFindings < 100) {
      return { version: 1, sizes, open: saved.open, collapsedFindings: saved.collapsedFindings };
    }
  } catch { /* A blocked or invalid preference can use the default. */ }
  return defaultExplorerPreferences;
}

export function writeExplorerPreferences(preferences: ExplorerPreferences) {
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); }
  catch { /* Resizing still works when browser storage is unavailable. */ }
}

function viewport(): ExplorerViewport {
  if (matchMedia("(min-width: 1104px)").matches) return "desktop";
  if (matchMedia("(min-width: 760px)").matches) return "tablet";
  return "phone";
}

function subscribeViewport(onChange: () => void) {
  const queries = [matchMedia("(min-width: 1104px)"), matchMedia("(min-width: 760px)")];
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

export function useExplorerViewport() {
  return useSyncExternalStore(subscribeViewport, viewport, () => "desktop");
}

function layoutFor(preferences: ExplorerPreferences): Layout {
  return preferences.open ? preferences.sizes : {
    findings: preferences.collapsedFindings,
    detail: 100 - preferences.collapsedFindings,
    inspector: 0,
  };
}

function InspectorReveal({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return <motion.div
    className="inspector-reveal" inert={!present} aria-hidden={present ? undefined : true}
    initial={reduced ? false : { clipPath: "inset(0 0 0 100%)", x: 12 }}
    animate={{ clipPath: "inset(0 0 0 0%)", x: 0 }}
    exit={reduced ? { opacity: 0 } : { clipPath: "inset(0 0 0 100%)", x: 8 }}
    transition={{ duration: reduced ? 0 : .18, ease: [.2, .78, .22, 1] }}
  >{children}</motion.div>;
}

export function ExplorerPanels({ preferences, onPreferences, groupRef, findings, detail, inspector }: {
  preferences: ExplorerPreferences;
  onPreferences: (next: ExplorerPreferences) => void;
  groupRef: RefObject<GroupImperativeHandle | null>;
  findings: ReactNode;
  detail: ReactNode;
  inspector: ReactNode;
}) {
  const initial = useRef(layoutFor(preferences));
  const wasOpen = useRef(preferences.open);
  const { open } = preferences;
  useLayoutEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    if (open) groupRef.current?.setLayout(layoutFor(preferences));
  }, [open, preferences, groupRef]);

  function reset() {
    const next = { ...defaultExplorerPreferences, open };
    groupRef.current?.setLayout(layoutFor(next));
    onPreferences(next);
  }

  return (
    <Group
      id="studio-evidence" orientation="horizontal" groupRef={groupRef}
      defaultLayout={initial.current} className="explorer-panels"
      resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}
      onLayoutChanged={(layout, { isUserInteraction, requestedLayout }) => {
        if (!isUserInteraction) return;
        if (!open) {
          const left = requestedLayout?.findings ?? layout.findings;
          if (Number.isFinite(left) && left > 0 && left < 100) onPreferences({ ...preferences, collapsedFindings: left });
          return;
        }
        const sizes = requestedSizes(requestedLayout ?? layout) ?? requestedSizes(layout);
        if (sizes) onPreferences({ ...preferences, sizes });
      }}
    >
      <Panel id="findings" minSize="216px" className="studio-panel">{findings}</Panel>
      <Separator id="resize-findings" className="studio-splitter" aria-label="Resize Findings" title="Drag, use arrow keys, or double-click to reset" disableDoubleClick onDoubleClick={reset}>
        <span className="splitter-grip" aria-hidden="true"><MoveHorizontal size={15} strokeWidth={1.8} /></span>
      </Separator>
      <Panel id="detail" minSize="432px" className="studio-panel">{detail}</Panel>
      <Separator id="resize-inspector" className={`studio-splitter${open ? "" : " splitter-closed"}`} aria-label="Resize Source Inspector" title="Drag, use arrow keys, or double-click to reset" disableDoubleClick disabled={!open} onDoubleClick={reset}>
        <span className="splitter-grip" aria-hidden="true"><MoveHorizontal size={15} strokeWidth={1.8} /></span>
      </Separator>
      <Panel id="inspector" minSize="304px" collapsible collapsedSize="0%" collapsedThreshold="304px" className="studio-panel">
        <AnimatePresence initial={false} onExitComplete={() => {
          if (!wasOpen.current) groupRef.current?.setLayout(layoutFor(preferences));
        }}>
          {open && <InspectorReveal key="inspector">{inspector}</InspectorReveal>}
        </AnimatePresence>
      </Panel>
    </Group>
  );
}

export function ExplorerDrawer({ kind, onClose, children }: { kind: "findings" | "inspector"; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const title = kind === "inspector" ? "Source Inspector" : "Findings";
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <motion.dialog
      ref={dialogRef} className={`studio-drawer drawer-${kind}`} aria-labelledby="studio-drawer-title"
      initial={reduced ? false : { x: kind === "inspector" ? "100%" : "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: reduced ? 0 : kind === "inspector" ? "100%" : "-100%" }}
      transition={{ duration: reduced ? 0 : .18, ease: [.2, .78, .22, 1] }}
      inert={!present}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.currentTarget !== event.target) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right) onClose();
      }}
    >
      <div className="drawer-command">
        <button type="button" className="studio-icon drawer-back" aria-label={`Close ${title}`} title="Back to finding" onClick={onClose}><ChevronLeft size={20} aria-hidden="true" /></button>
        <h2 id="studio-drawer-title">{title}</h2>
        <button type="button" className="studio-icon drawer-close" aria-label={`Close ${title}`} onClick={onClose}><X size={17} aria-hidden="true" /></button>
      </div>
      {children}
    </motion.dialog>
  );
}
