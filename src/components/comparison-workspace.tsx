"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleAlert, FlaskConical, LoaderCircle, RotateCcw, X } from "lucide-react";
import { FindingsPanel } from "./findings-panel";
import { SourcePanel } from "./source-panel";
import { MAX_SOURCE_LENGTH, type ComparisonResult, type SourceId } from "@/lib/comparison-schema";
import { example } from "@/lib/example";

type Connection = "checking" | "configured" | "connected" | "missing" | "unavailable";

const connectionLabels: Record<Connection, string> = {
  checking: "Checking AI configuration",
  configured: "AI configured",
  connected: "AI connected",
  missing: "AI setup required",
  unavailable: "AI status unavailable",
};

export function ComparisonWorkspace() {
  const [sources, setSources] = useState({ sourceA: "", sourceB: "" });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExample, setIsExample] = useState(false);
  const [connection, setConnection] = useState<Connection>("checking");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sourceARef = useRef<HTMLTextAreaElement>(null);
  const sourceBRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Status unavailable");
        const status = await response.json();
        setConnection(status.configured ? "configured" : "missing");
      })
      .catch(() => setConnection("unavailable"));
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const hasInput = Boolean(sources.sourceA || sources.sourceB);
  const canCompare = Boolean(sources.sourceA.trim() && sources.sourceB.trim())
    && sources.sourceA.length <= MAX_SOURCE_LENGTH
    && sources.sourceB.length <= MAX_SOURCE_LENGTH
    && !loading;

  function updateSource(source: SourceId, value: string) {
    setSources((current) => ({ ...current, [source === "A" ? "sourceA" : "sourceB"]: value }));
    setResult(null);
    setError(null);
    setIsExample(false);
  }

  function loadExample() {
    setSources({ ...example });
    setResult(null);
    setError(null);
    setIsExample(true);
  }

  function clearWorkspace() {
    setSources({ sourceA: "", sourceB: "" });
    setResult(null);
    setError(null);
    setIsExample(false);
    sourceARef.current?.focus();
  }

  async function compare() {
    if (!canCompare) return;
    setLoading(true);
    setElapsedSeconds(0);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sources),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "This comparison could not be completed. Please try again.");
      setResult(payload as ComparisonResult);
      setConnection("connected");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The connection was interrupted. Your sources are still here; please try again.");
    } finally {
      setLoading(false);
    }
  }

  function locateExcerpt(source: SourceId, quote: string) {
    const input = source === "A" ? sourceARef.current : sourceBRef.current;
    if (!input) return;
    const start = input.value.indexOf(quote);
    if (start === -1) return;
    input.focus();
    input.setSelectionRange(start, start + quote.length);
    input.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        <form onSubmit={(event) => { event.preventDefault(); void compare(); }} onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canCompare) {
            event.preventDefault();
            void compare();
          }
        }}>
          <div className="workspace-intro">
            <div className="workspace-title-block">
              <p className="eyebrow">READ CLOSELY. COMPARE CLEARLY.</p>
              <h1>Compare sources<span className="title-period">.</span></h1>
              <p className="workspace-description">Find common ground, understand differences, and trace the evidence.</p>
            </div>
            <div className="workspace-actions">
              {hasInput && <button type="button" className="button button-clear" onClick={clearWorkspace} disabled={loading} title="Clear both sources"><RotateCcw size={14} aria-hidden="true" /><span>Clear</span></button>}
              <button type="button" className="button button-secondary" onClick={loadExample} disabled={loading}><FlaskConical size={15} strokeWidth={1.7} aria-hidden="true" />Try Example</button>
              <button type="submit" className="button button-primary" disabled={!canCompare} title="Compare sources (Ctrl / ⌘ + Enter)">{loading ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : null}{loading ? "Comparing…" : "Compare Sources"}{!loading && <ArrowRight size={16} aria-hidden="true" />}</button>
            </div>
          </div>

          {isExample && <div className="example-notice"><FlaskConical size={13} aria-hidden="true" /><span><strong>Fictional example</strong><span className="example-notice-divider">/</span>Competition application rules. Compare to generate a real AI analysis.</span></div>}

          {error && <div className="error-notice" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>Comparison unavailable</strong><p>{error}</p></div><button type="button" className="dismiss-error" onClick={() => setError(null)} aria-label="Dismiss error"><X size={16} aria-hidden="true" /></button></div>}

          <div className={`workspace-grid${result ? " has-results" : ""}`}>
            <div className="sources-grid">
              <SourcePanel source="A" value={sources.sourceA} onChange={(value) => updateSource("A", value)} readOnly={loading} inputRef={sourceARef} />
              <SourcePanel source="B" value={sources.sourceB} onChange={(value) => updateSource("B", value)} readOnly={loading} inputRef={sourceBRef} />
            </div>
            <FindingsPanel result={result} loading={loading} elapsedSeconds={elapsedSeconds} onLocate={locateExcerpt} />
          </div>

          <div className="workspace-notes">
            <p><span className="notes-marker" aria-hidden="true" />Compares statements, not objective truth. Always read the original evidence.</p>
            <p className="shortcut-hint"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><span>to compare</span></p>
          </div>
        </form>
      </main>

      <footer className="app-footer"><span className="version-label">SourceLens <span>V0.1</span></span><p>Sources are sent to your configured AI provider. This workspace clears on refresh.</p><a href="https://github.com/sx933229xiao-droid/sourcelens-evidence" target="_blank" rel="noreferrer">Project on GitHub <ArrowRight size={12} aria-hidden="true" /></a></footer>
      <span className="sr-only" role="status" aria-live="polite">{result ? `Comparison complete. ${result.findings.length} findings with matching source excerpts.` : ""}</span>
    </div>
  );
}
