"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import type { ComparisonResult } from "@/lib/comparison-schema";

export function ComparisonProgress({ startedAt, onCancel }: { startedAt: number; onCancel: () => void }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000));
  useEffect(() => {
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return <div className="comparison-progress" role="status"><LoaderCircle size={16} className="spinner" aria-hidden="true" /><p>Comparing sources…</p><span className="elapsed-time" aria-hidden="true">{elapsedSeconds}s elapsed</span><button type="button" className="button button-secondary comparison-cancel" onClick={onCancel}>Cancel</button></div>;
}

export function FindingsPanel({ result, completedAt, loading, startedAt, onCancel, onOpenExplorer }: { result: ComparisonResult | null; completedAt?: number; loading: boolean; startedAt: number | null; onCancel: () => void; onOpenExplorer: () => void }) {
  if (loading && startedAt !== null) return <ComparisonProgress startedAt={startedAt} onCancel={onCancel} />;
  return <section className="workspace-summary" aria-label="Analysis summary"><div><strong>{result ? `${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"} ready to review` : "Start with two sources"}</strong><p>{result ? <>Last compared {completedAt ? new Date(completedAt).toLocaleString() : ""}.</> : "Paste or import your sources, then compare them to explore the evidence."}</p></div>{result && <button type="button" className="button button-secondary" onClick={onOpenExplorer}>Open Evidence Explorer <ArrowUpRight size={13} aria-hidden="true" /></button>}</section>;
}
