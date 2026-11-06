"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, CircleAlert, LoaderCircle, ScanText } from "lucide-react";
import {
  type ComparisonResult,
  type Relationship,
  type SourceId,
  relationships,
  relationshipLabels,
} from "@/lib/comparison-schema";

type FindingsPanelProps = {
  result: ComparisonResult | null;
  loading: boolean;
  elapsedSeconds: number;
  onLocate: (source: SourceId, quote: string) => void;
};

const relationshipDescriptions: Record<Relationship, string> = {
  agreement: "Where the claims align",
  potential_conflict: "Statements that may disagree",
  context_difference: "A different scope or condition",
  single_source_claim: "Identified in one source only",
  needs_review: "More context is needed",
};

export function FindingsPanel({ result, loading, elapsedSeconds, onLocate }: FindingsPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [filter, setFilter] = useState<Relationship | "all">("all");

  useEffect(() => {
    setExpanded(0);
    setFilter("all");
  }, [result]);

  const visible = result?.findings
    .map((finding, index) => ({ finding, index }))
    .filter(({ finding }) => filter === "all" || finding.relationship === filter) ?? [];

  return (
    <section className="findings-panel" aria-labelledby="findings-title" aria-busy={loading}>
      <div className="findings-header">
        <div className="findings-heading">
          <ScanText size={18} strokeWidth={1.6} aria-hidden="true" />
          <h2 id="findings-title">Findings</h2>
          {result && <span className="finding-count">{result.findings.length}</span>}
        </div>
        <span className="panel-eyebrow">{loading ? "IN PROGRESS" : result ? "SOURCE COMPARISON" : "EVIDENCE FIRST"}</span>
      </div>

      {loading ? (
        <div className="findings-loading" role="status">
          <span className="loading-icon"><LoaderCircle size={27} strokeWidth={1.3} className="spinner" aria-hidden="true" /></span>
          <p className="eyebrow">READING BOTH SOURCES</p>
          <h3>Connecting the claims.</h3>
          <p>Comparing statements and matching findings to the original passages.</p>
          <span className="elapsed-time" aria-hidden="true">{elapsedSeconds}s elapsed</span>
        </div>
      ) : result ? (
        <>
          <div className="findings-toolbar">
            <span>{result.findings.length} {result.findings.length === 1 ? "finding" : "findings"} · 2 sources</span>
            <div className="filter-control">
              <label className="sr-only" htmlFor="relationship-filter">Filter by relationship</label>
              <select id="relationship-filter" value={filter} onChange={(event) => setFilter(event.target.value as Relationship | "all")}>
                <option value="all">All relationships</option>
                {relationships.map((relationship) => (
                  <option key={relationship} value={relationship}>{relationshipLabels[relationship]}</option>
                ))}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </div>
          </div>

          <div className="findings-scroll">
            {result.omittedFindings > 0 && (
              <div className="omission-note" role="status">
                <CircleAlert size={14} aria-hidden="true" />
                <span>{result.omittedFindings} {result.omittedFindings === 1 ? "finding was" : "findings were"} omitted because the structure or source excerpts could not be verified.</span>
              </div>
            )}

            {visible.length === 0 && <p className="no-findings">No findings in this relationship.</p>}

            {visible.map(({ finding, index }) => {
              const isExpanded = expanded === index;
              const detailsId = `finding-${index}-evidence`;

              return (
                <article className={`finding${isExpanded ? " is-expanded" : ""}`} key={index}>
                  <button
                    className="finding-trigger"
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                    onClick={() => setExpanded(isExpanded ? null : index)}
                  >
                    <div className="finding-topline">
                      <span className={`relationship-tag ${finding.relationship}`}><span className="relationship-dot" />{relationshipLabels[finding.relationship]}</span>
                      <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="finding-topic"><h3>{finding.topic}</h3><ChevronDown size={16} className="finding-chevron" aria-hidden="true" /></div>
                    <p className="finding-explanation">{finding.explanation}</p>
                    {!isExpanded && <span className="show-evidence">View source evidence <ArrowUpRight size={12} aria-hidden="true" /></span>}
                  </button>

                  <div className="finding-evidence" id={detailsId} hidden={!isExpanded}>
                    <div className="evidence-section-title">ORIGINAL EVIDENCE <span>Matched to your sources</span></div>
                    {(["A", "B"] as const).map((source) => {
                      const excerpts = finding.evidence.filter((evidence) => evidence.source === source);
                      return (
                        <div className={`evidence-source evidence-${source.toLowerCase()}`} key={source}>
                          <div className="evidence-source-heading"><span className="evidence-source-label"><span className="source-letter">{source}</span>Source {source}</span>{excerpts.length > 0 && <span className="excerpt-match" title="These excerpts appear verbatim in the source. This does not verify the claim's truth."><Check size={12} aria-hidden="true" />Matched excerpt</span>}</div>
                          {excerpts.length > 0 ? excerpts.map(({ quote }, quoteIndex) => (
                            <div className="excerpt" key={quoteIndex}>
                              <blockquote>{quote}</blockquote>
                              <button type="button" className="locate-button" onClick={() => onLocate(source, quote)}>Locate in source <ArrowUpRight size={12} aria-hidden="true" /></button>
                            </div>
                          )) : <p className="source-absence">No corresponding claim identified in Source {source} in this comparison.</p>}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="findings-footnote"><Check size={13} aria-hidden="true" /><span>Every displayed excerpt matches its original source.</span></div>
        </>
      ) : (
        <div className="findings-empty">
          <div className="empty-introduction">
            <h3>See the relationship.<br /><span>Follow the evidence.</span></h3>
            <p>Add two sources and compare. Your findings will connect each claim to the words behind it.</p>
          </div>
          <div className="relationship-guide" aria-label="Five ways sources can relate">
            <p className="guide-title">A LITTLE MORE NUANCE</p>
            {relationships.map((relationship) => (
              <div className="guide-row" key={relationship}>
                <span className={`relationship-dot ${relationship}`} />
                <div><span className="guide-label">{relationshipLabels[relationship]}</span><span className="guide-description">{relationshipDescriptions[relationship]}</span></div>
              </div>
            ))}
          </div>
          <p className="empty-footnote">Different wording doesn’t always mean disagreement.</p>
        </div>
      )}
    </section>
  );
}
