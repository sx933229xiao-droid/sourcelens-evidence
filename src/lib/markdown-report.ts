import { relationships, relationshipLabels } from "@/lib/comparison-schema";
import { effectiveFinding, hasFindingCorrection, hasFindingReview, type ResearchProject } from "@/lib/project-store";
import { findQuotePageMatches, quotePageSummary } from "@/lib/pdf-page-map";

function plainText(value: string): string {
  return value.replace(/[\\`*_{}\[\]<>()#!|~]/g, "\\$&");
}

function quoteBlock(quote: string): string {
  // A longer fence keeps Markdown and backticks in the source completely literal.
  const longest = Math.max(2, ...Array.from(quote.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}text\n${quote}\n${fence}`;
}

export function buildMarkdownReport(project: ResearchProject): string {
  if (!project.analysis) throw new Error("Compare sources before exporting a report.");
  const { result, completedAt, reviewByFinding } = project.analysis;
  const findings = result.findings.flatMap((finding, index) => {
    const review = reviewByFinding?.[index];
    return review?.excluded ? [] : [{ finding: effectiveFinding(finding, review), index, review }];
  });
  const excludedCount = result.findings.length - findings.length;
  const sourceName = (source: "A" | "B") => {
    const file = project.sourceFiles[source];
    let name = file?.name ?? "Pasted text";
    if (file?.pdf) name += ` · PDF pages ${file.pdf.fromPage}–${file.pdf.toPage} of ${file.pdf.pageCount}${file.edited ? " · Edited" : ""}`;
    return plainText(name);
  };
  const lines = [
    `# ${plainText(project.name)}`,
    "",
    "SourceLens research report",
    "",
    `- Analyzed at: ${new Date(completedAt).toISOString()}`,
    `- Source A: ${sourceName("A")}`,
    `- Source B: ${sourceName("B")}`,
    `- Findings: ${findings.length}`,
    `- Omitted findings: ${result.omittedFindings}`,
    ...(excludedCount ? [`- Findings excluded by review: ${excludedCount}`] : []),
    ...(project.isExample ? ["- Material: Fictional example"] : []),
    "",
    "## Relationship summary",
    "",
    ...relationships.map((relationship) => `- ${relationshipLabels[relationship]}: ${findings.filter(({ finding }) => finding.relationship === relationship).length}`),
    "",
    "## Findings",
  ];
  for (const { finding, index, review } of findings) {
    lines.push("", `### ${index + 1}. ${plainText(finding.topic)}`, "", `**Relationship:** ${relationshipLabels[finding.relationship]}`, "", plainText(finding.explanation), "");
    if (hasFindingCorrection(review)) lines.push("*Human-corrected finding*", "");
    if (hasFindingReview(review)) {
      lines.push("**Human review**", "", `- Reviewed: ${review.reviewed ? "Yes" : "No"}`, `- Important: ${review.important ? "Yes" : "No"}`, "");
      if (review.note.trim()) lines.push("**Research notes**", "", plainText(review.note), "");
    }
    lines.push("**Original evidence**", "");
    finding.evidence.forEach(({ source, quote }) => {
      const pageInfo = quotePageSummary(findQuotePageMatches(project.sources[source === "A" ? "sourceA" : "sourceB"], quote, project.sourceFiles[source]?.pdf?.pageMap));
      lines.push(`Source ${source} — ${sourceName(source)}${pageInfo ? ` · ${pageInfo}` : ""}`, "", quoteBlock(quote), "");
    });
  }
  if (result.omittedFindings > 0) lines.push("", `${result.omittedFindings} finding(s) were omitted because their structure or source excerpts could not be verified.`);
  lines.push("", "---", "", "SourceLens compares statements, not objective truth. Matching an excerpt confirms its presence in a source, not the truth of the claim. Always review the original evidence.", "");
  return lines.join("\n");
}

export function reportFileName(name: string): string {
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").slice(0, 80);
  return `sourcelens-${safeName || "report"}.md`;
}
