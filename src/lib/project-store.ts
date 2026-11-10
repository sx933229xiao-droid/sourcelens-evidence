import { z } from "zod";
import { relationships } from "@/lib/comparison-schema";

// Stored results are checked structurally, never re-scored or re-counted on restore.
export const researchProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  updatedAt: z.number().finite(),
  sources: z.object({ sourceA: z.string(), sourceB: z.string() }),
  sourceFiles: z.object({
    A: z.object({ name: z.string(), edited: z.boolean() }).nullable(),
    B: z.object({ name: z.string(), edited: z.boolean() }).nullable(),
  }),
  analysis: z.object({
    completedAt: z.number().finite(),
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

const summarySchema = researchProjectSchema.pick({ id: true, name: true, updatedAt: true });
let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Local saving is unavailable in this browser."));
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
      request.onerror = () => reject(new Error("Local storage could not be opened. Your current sources are still here."));
      request.onblocked = () => reject(new Error("Close other SourceLens tabs, then retry local saving."));
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
    transaction.onabort = () => reject(new Error("Your changes could not be saved locally. Check browser storage space and retry."));
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
      if (!summary.success) { reject(new Error("A saved project could not be read. Its data has not been changed.")); return; }
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
  if (!project.success) throw new Error("This project could not be restored. Its saved data has not been changed.");
  return project.data;
}

export function saveProject(project: ResearchProject): Promise<void> {
  return write(["projects"], (transaction) => { transaction.objectStore("projects").put(project); });
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
