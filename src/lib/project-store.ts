import { z } from "zod";
import { relationships, type Finding, type SourceId } from "@/lib/comparison-schema";
import { isPdfPageMapValid, pdfPageMapSchema } from "@/lib/pdf-page-map";

const sourceFileSchema = z.object({
  name: z.string(),
  edited: z.boolean(),
  pdf: z.object({
    pageCount: z.number().int().positive(),
    fromPage: z.number().int().positive(),
    toPage: z.number().int().positive(),
    pageMap: pdfPageMapSchema.optional().catch(undefined),
  }).refine((range) => range.fromPage <= range.toPage && range.toPage <= range.pageCount).optional(),
});

export type ImportedSourceFile = z.infer<typeof sourceFileSchema>;

const findingReviewSchema = z.object({
  reviewed: z.boolean(),
  important: z.boolean(),
  note: z.string(),
  relationshipOverride: z.enum(relationships).optional(),
  explanationOverride: z.string().refine((value) => value.trim().length > 0).optional(),
  excluded: z.boolean().optional(),
});

export type FindingReview = z.infer<typeof findingReviewSchema>;

// Stored results are checked structurally, never re-scored or re-counted on restore.
export const researchProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  updatedAt: z.number().finite(),
  sources: z.object({ sourceA: z.string(), sourceB: z.string() }),
  sourceFiles: z.object({
    A: sourceFileSchema.nullable(),
    B: sourceFileSchema.nullable(),
  }),
  analysis: z.object({
    completedAt: z.number().finite(),
    reviewByFinding: z.record(z.string(), findingReviewSchema).optional(),
    result: z.object({
      findings: z.array(z.object({
        topic: z.string(),
        relationship: z.enum(relationships),
        explanation: z.string(),
        evidence: z.array(z.object({ source: z.enum(["A", "B"]), quote: z.string() })),
      })),
      omittedFindings: z.number().int().nonnegative(),
    }),
  }).nullable(),
  isExample: z.boolean(),
});

export type ResearchProject = z.infer<typeof researchProjectSchema>;
export type ProjectSummary = Pick<ResearchProject, "id" | "name" | "updatedAt">;

export async function sanitizeProjectPageMaps(project: ResearchProject, original: ResearchProject = project): Promise<{ project: ResearchProject; invalidPageSources: SourceId[] }> {
  let cleaned = project;
  const invalidPageSources: SourceId[] = [];
  for (const source of ["A", "B"] as const) {
    const file = project.sourceFiles[source];
    if (original.sourceFiles[source]?.pdf?.pageMap === undefined) continue;
    if (file?.pdf?.pageMap && !file.edited && await isPdfPageMapValid(file.pdf.pageMap, project.sources[source === "A" ? "sourceA" : "sourceB"], file.pdf)) continue;
    invalidPageSources.push(source);
    if (file?.pdf) {
      const pdf = { ...file.pdf };
      delete pdf.pageMap;
      cleaned = { ...cleaned, sourceFiles: { ...cleaned.sourceFiles, [source]: { ...file, pdf } } };
    }
  }
  return { project: cleaned, invalidPageSources };
}

export function markSourceEdited(file: ImportedSourceFile | null): ImportedSourceFile | null {
  if (!file) return null;
  if (!file.pdf) return { ...file, edited: true };
  const pdf = { ...file.pdf };
  delete pdf.pageMap;
  return { ...file, edited: true, pdf };
}

export function hasFindingCorrection(review: FindingReview | undefined): boolean {
  return Boolean(review?.relationshipOverride || review?.explanationOverride);
}

export function effectiveFinding(finding: Finding, review: FindingReview | undefined): Finding {
  if (!hasFindingCorrection(review)) return finding;
  return {
    ...finding,
    relationship: review?.relationshipOverride ?? finding.relationship,
    explanation: review?.explanationOverride ?? finding.explanation,
  };
}

export function hasFindingReview(review: FindingReview | undefined): review is FindingReview {
  return Boolean(review && (review.reviewed || review.important || review.note.trim() || review.excluded || hasFindingCorrection(review)));
}

export function hasAnnotations(analysis: ResearchProject["analysis"]): boolean {
  return Object.values(analysis?.reviewByFinding ?? {}).some(hasFindingReview);
}

export function withFindingReview(analysis: NonNullable<ResearchProject["analysis"]>, index: number, patch: Partial<FindingReview>): NonNullable<ResearchProject["analysis"]> {
  if (!Number.isInteger(index) || index < 0 || index >= analysis.result.findings.length) return analysis;
  const reviews = { ...analysis.reviewByFinding };
  const previous = reviews[index] ?? { reviewed: false, important: false, note: "" };
  const review = { ...previous, ...patch };
  if (hasFindingReview(review)) reviews[index] = review;
  else delete reviews[index];
  const updated = { ...analysis };
  if (Object.keys(reviews).length) updated.reviewByFinding = reviews;
  else delete updated.reviewByFinding;
  return updated;
}

const summarySchema = researchProjectSchema.pick({ id: true, name: true, updatedAt: true });
let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support local project storage."));
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sourcelens", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("projects", { keyPath: "id" });
        request.result.createObjectStore("meta");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = null; };
        resolve(request.result);
      };
      request.onerror = () => reject(new Error("Local storage could not be opened. Your work is still available on this page."));
      request.onblocked = () => reject(new Error("Close other SourceLens tabs, then try saving again."));
    }).catch((error) => { database = null; throw error; });
  }
  return database;
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Saved data could not be read."));
  });
}

async function write(stores: string[], change: (transaction: IDBTransaction) => void): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error("Your changes are still on this page. Check available browser storage, then retry saving."));
    transaction.onerror = () => { /* onabort reports the failed transaction. */ };
    change(transaction);
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const summaries: ProjectSummary[] = [];
    const request = db.transaction("projects").objectStore("projects").openCursor();
    request.onerror = () => reject(new Error("Your saved projects could not be read."));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(summaries.sort((a, b) => b.updatedAt - a.updatedAt)); return; }
      const summary = summarySchema.safeParse(cursor.value);
      if (!summary.success) { reject(new Error("A saved project could not be opened. Its stored data has been left intact.")); return; }
      summaries.push(summary.data);
      cursor.continue();
    };
  });
}

export async function getProject(id: string): Promise<ResearchProject | null> {
  const db = await openDatabase();
  const stored = await readRequest(db.transaction("projects").objectStore("projects").get(id));
  if (stored === undefined) return null;
  const project = researchProjectSchema.safeParse(stored);
  if (!project.success) throw new Error("This project could not be opened. Its stored data has been left intact.");
  return (await sanitizeProjectPageMaps(project.data, stored as ResearchProject)).project;
}

export function saveProject(project: ResearchProject): Promise<void> {
  return write(["projects"], (transaction) => { transaction.objectStore("projects").put(project); });
}

export function insertRestoredProject(project: ResearchProject): Promise<void> {
  return write(["projects", "meta"], (transaction) => {
    transaction.objectStore("projects").add(project);
    transaction.objectStore("meta").put(project.id, "activeProjectId");
  });
}

export async function getActiveProjectId(): Promise<string | null> {
  const db = await openDatabase();
  const id = await readRequest(db.transaction("meta").objectStore("meta").get("activeProjectId"));
  return typeof id === "string" ? id : null;
}

export function setActiveProjectId(id: string): Promise<void> {
  return write(["meta"], (transaction) => { transaction.objectStore("meta").put(id, "activeProjectId"); });
}

export function deleteProject(id: string, nextId: string | null): Promise<void> {
  return write(["projects", "meta"], (transaction) => {
    transaction.objectStore("projects").delete(id);
    const meta = transaction.objectStore("meta");
    if (nextId) meta.put(nextId, "activeProjectId");
    else meta.delete("activeProjectId");
  });
}
