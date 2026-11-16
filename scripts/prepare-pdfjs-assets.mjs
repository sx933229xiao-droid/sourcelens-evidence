import { copyFile, cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distribution = path.dirname(require.resolve("pdfjs-dist/package.json"));
const destination = path.join(root, "public", "pdfjs");
await mkdir(destination, { recursive: true });
await Promise.all([
  copyFile(path.join(distribution, "build", "pdf.worker.min.mjs"), path.join(destination, "pdf.worker.min.mjs")),
  cp(path.join(distribution, "cmaps"), path.join(destination, "cmaps"), { recursive: true }),
  cp(path.join(distribution, "standard_fonts"), path.join(destination, "standard_fonts"), { recursive: true }),
]);
console.log("Prepared local PDF.js worker and text resources.");
