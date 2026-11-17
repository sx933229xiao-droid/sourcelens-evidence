import { z } from "zod";
import { verifyFindings } from "@/lib/comparison-schema";
import { researchProjectSchema, sanitizeProjectPageMaps, type ResearchProject } from "@/lib/project-store";
import { reportFileName } from "@/lib/markdown-report";

export const LARGE_BACKUP_BYTES = 100 * 1024 * 1024;
const backupSchema = z.object({
  format: z.literal("sourcelens-project"),
  version: z.literal(1),
  exportedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  project: z.unknown(),
});

function validateCore(project: ResearchProject) {
  if (!project.name.trim() || !Number.isFinite(new Date(project.updatedAt).getTime())) throw new Error("The backup contains invalid project metadata.");
  if (!project.analysis) return;
  if (!Number.isFinite(new Date(project.analysis.completedAt).getTime())) throw new Error("The backup contains an invalid analysis date.");
  const result = project.analysis.result;
  // Validate without replacing, filtering, normalizing, or recounting the saved analysis.
  const checked = verifyFindings({ findings: result.findings }, project.sources);
  if (!checked || checked.findings.length !== result.findings.length || result.findings.some((finding) => finding.evidence.some(({ source, quote }) => !project.sources[source === "A" ? "sourceA" : "sourceB"].includes(quote)))) {
    throw new Error("A finding or source excerpt in this backup is invalid. The project was not restored.");
  }
  for (const key of Object.keys(project.analysis.reviewByFinding ?? {})) {
    if (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(Number(key)) || Number(key) >= result.findings.length) throw new Error("A review annotation does not belong to a finding in this backup.");
  }
}

async function validateProject(value: unknown) {
  const parsed = researchProjectSchema.safeParse(value);
  if (!parsed.success) throw new Error("The backup is missing required project data or contains invalid fields.");
  validateCore(parsed.data);
  return sanitizeProjectPageMaps(parsed.data, value as ResearchProject);
}

export async function serializeProjectBackup(project: ResearchProject) {
  const validated = await validateProject(project);
  const json = JSON.stringify({ format: "sourcelens-project", version: 1, exportedAt: new Date().toISOString(), project: validated.project }, null, 2);
  return { json, invalidPageSources: validated.invalidPageSources };
}

export async function parseProjectBackup(text: string) {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("This file is not a valid JSON project backup."); }
  const header = value as { format?: unknown; version?: unknown } | null;
  if (header?.format !== "sourcelens-project") throw new Error("Choose a SourceLens .sourcelens.json project backup.");
  if (header.version !== 1) throw new Error("This backup version is not supported by this version of SourceLens.");
  const envelope = backupSchema.safeParse(value);
  if (!envelope.success) throw new Error("This backup has invalid or missing metadata.");
  return validateProject(envelope.data.project);
}

export function backupFileName(name: string): string {
  return reportFileName(name).replace(/\.md$/, ".sourcelens.json");
}

export function restoredProjectName(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;
  for (let index = 1; ; index++) {
    const suffix = index === 1 ? " (restored)" : ` (restored ${index})`;
    const candidate = name.slice(0, 80 - suffix.length).trimEnd() + suffix;
    if (!existing.has(candidate)) return candidate;
  }
}
