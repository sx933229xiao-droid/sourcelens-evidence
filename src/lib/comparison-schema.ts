import { z } from "zod";

export const MAX_SOURCE_LENGTH = 10_000;

export const relationships = [
  "agreement",
  "potential_conflict",
  "context_difference",
  "single_source_claim",
  "needs_review",
] as const;

export type Relationship = (typeof relationships)[number];
export type SourceId = "A" | "B";

export const relationshipLabels: Record<Relationship, string> = {
  agreement: "Agreement",
  potential_conflict: "Potential conflict",
  context_difference: "Context difference",
  single_source_claim: "Single-source claim",
  needs_review: "Needs review",
};

const sourceText = z.string().min(1).max(MAX_SOURCE_LENGTH).refine(
  (value) => value.trim().length > 0,
  "Enter source text, not just whitespace.",
);

export const comparisonRequestSchema = z.object({
  sourceA: sourceText,
  sourceB: sourceText,
});

export type ComparisonRequest = z.infer<typeof comparisonRequestSchema>;

const findingSchema = z.object({
  topic: z.string().trim().min(1),
  relationship: z.enum(relationships),
  explanation: z.string().trim().min(1),
  evidence: z.array(z.object({
    source: z.enum(["A", "B"]),
    quote: z.string().trim().min(1),
  })).min(1),
});

export type Finding = z.infer<typeof findingSchema>;

export type ComparisonResult = {
  findings: Finding[];
  omittedFindings: number;
};

// Validate findings independently: one bad citation must not discard good work.
export function verifyFindings(
  data: unknown,
  sources: ComparisonRequest,
): ComparisonResult | null {
  const envelope = z.object({ findings: z.array(z.unknown()) }).safeParse(data);
  if (!envelope.success) return null;

  const findings: Finding[] = [];

  for (const candidate of envelope.data.findings) {
    const parsed = findingSchema.safeParse(candidate);
    if (!parsed.success) continue;

    const finding = parsed.data;
    const validQuotes = finding.evidence.every(({ source, quote }) =>
      (source === "A" ? sources.sourceA : sources.sourceB).includes(quote),
    );
    if (!validQuotes) continue;

    const citedSources = new Set(finding.evidence.map(({ source }) => source));
    const needsBothSources = [
      "agreement", "potential_conflict", "context_difference",
    ].includes(finding.relationship);

    if (needsBothSources && citedSources.size !== 2) continue;
    if (finding.relationship === "single_source_claim" && citedSources.size !== 1) continue;

    findings.push(finding);
  }

  return {
    findings,
    omittedFindings: envelope.data.findings.length - findings.length,
  };
}
