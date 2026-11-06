"use client";

import type { RefObject } from "react";
import { FileText } from "lucide-react";
import { MAX_SOURCE_LENGTH, type SourceId } from "@/lib/comparison-schema";

type SourcePanelProps = {
  source: SourceId;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function SourcePanel({ source, value, onChange, readOnly, inputRef }: SourcePanelProps) {
  const overLimit = value.length > MAX_SOURCE_LENGTH;
  const countId = `source-${source.toLowerCase()}-count`;

  return (
    <section className={`source-panel source-${source.toLowerCase()}`} aria-labelledby={`source-${source}-title`}>
      <div className="source-header">
        <div className="source-identity">
          <span className="source-letter" aria-hidden="true">{source}</span>
          <div>
            <label className="source-title" id={`source-${source}-title`} htmlFor={`source-${source}-input`}>Source {source}</label>
            <p className="source-caption">{source === "A" ? "First reference" : "Second reference"}</p>
          </div>
        </div>
        <FileText size={16} strokeWidth={1.5} className="source-file-icon" aria-hidden="true" />
      </div>

      <textarea
        ref={inputRef}
        id={`source-${source}-input`}
        className="source-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        aria-describedby={countId}
        aria-invalid={overLimit}
        placeholder={`Paste your ${source === "A" ? "first" : "second"} source here.\n\nAn article, report, announcement, or any text you want to compare. Keep the original wording so every finding can lead back to its source.`}
      />

      <div className={`source-footer${overLimit ? " over-limit" : ""}`} id={countId}>
        <span>{overLimit ? "Text exceeds limit" : readOnly ? "Reading source…" : "Plain text"}</span>
        <span className="character-count">{value.length.toLocaleString("en-US")} <span>/ {MAX_SOURCE_LENGTH.toLocaleString("en-US")}</span></span>
      </div>
    </section>
  );
}
