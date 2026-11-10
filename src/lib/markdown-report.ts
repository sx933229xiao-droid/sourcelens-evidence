import { relationships, relationshipLabels } from "@/lib/comparison-schema";
import type { ResearchProject } from "@/lib/project-store";

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
  const { result, completedAt } = project.analysis;
  const sourceName = (source: "A" | "B") => plainText(project.sourceFiles[source]?.name ?? "Pasted text");
  const lines = [
    `# ${plainText(project.name)}`,
    "",
    "SourceLens research report",
    "",
    `- Analyzed at: ${new Date(completedAt).toISOString()}`,
    `- Source A: ${sourceName("A")}`,
    `- Source B: ${sourceName("B")}`,
    `- Findings: ${result.findings.length}`,
    `- Omitted findings: ${result.omittedFindings}`,
    ...(project.isExample ? ["- Material: Fictional example"] : []),
    "",
    "## Relationship summary",
    "",
    ...relationships.map((relationship) => `- ${relationshipLabels[relationship]}: ${result.findings.filter((finding) => finding.relationship === relationship).length}`),
    "",
    "## Findings",
  ];
  result.findings.forEach((finding, index) => {
    lines.push("", `### ${index + 1}. ${plainText(finding.topic)}`, "", `**Relationship:** ${relationshipLabels[finding.relationship]}`, "", plainText(finding.explanation), "", "**Original evidence**", "");
    finding.evidence.forEach(({ source, quote }) => {
      lines.push(`Source ${source} — ${sourceName(source)}`, "", quoteBlock(quote), "");
    });
  });
  if (result.omittedFindings > 0) lines.push("", `${result.omittedFindings} finding(s) were omitted because their structure or source excerpts could not be verified.`);
  lines.push("", "---", "", "SourceLens compares statements, not objective truth. Matching an excerpt confirms its presence in a source, not the truth of the claim. Always review the original evidence.", "");
  return lines.join("\n");
}

export function reportFileName(name: string): string {
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").slice(0, 80);
  return `sourcelens-${safeName || "report"}.md`;
}
