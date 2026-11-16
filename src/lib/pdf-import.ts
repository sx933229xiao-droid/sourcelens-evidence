export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const AUTO_PREVIEW_PAGE_LIMIT = 5;

export type PdfExtraction = { text: string; emptyPages: number[] };
export type PdfSession = {
  pageCount: number;
  extract: (fromPage: number, toPage: number, onProgress: (done: number, total: number) => void) => Promise<PdfExtraction>;
  close: () => Promise<void>;
};

export function formatPdfTextItems(items: readonly unknown[]): string {
  return items.map((item) => {
    if (!item || typeof item !== "object" || !("str" in item) || typeof item.str !== "string") return "";
    return item.str + ("hasEOL" in item && item.hasEOL ? "\n" : "");
  }).join("").replace(/\r\n?/g, "\n").trim();
}

function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("PDF import cancelled.", "AbortError");
}

export async function openPdf(file: File, signal: AbortSignal): Promise<PdfSession> {
  if (file.size > MAX_PDF_BYTES) throw new Error("This PDF exceeds 50 MB. Choose a smaller file.");
  checkAborted(signal);
  // Browser-only lazy loading keeps PDF parsing out of server rendering and the initial bundle.
  const { getDocument, GlobalWorkerOptions, version } = await import("pdfjs-dist");
  checkAborted(signal);
  const data = new Uint8Array(await file.arrayBuffer());
  checkAborted(signal);
  GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker.min.mjs?v=${version}`;
  const task = getDocument({ data, cMapUrl: "/pdfjs/cmaps/", standardFontDataUrl: "/pdfjs/standard_fonts/" });
  let closing: Promise<void> | null = null;
  const close = () => {
    if (!closing) {
      signal.removeEventListener("abort", onAbort);
      closing = task.destroy();
    }
    return closing;
  };
  const onAbort = () => { void close().catch(() => {}); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const document = await task.promise;
    checkAborted(signal);
    return {
      pageCount: document.numPages,
      close,
      async extract(fromPage, toPage, onProgress) {
        if (!Number.isInteger(fromPage) || !Number.isInteger(toPage) || fromPage < 1 || toPage < fromPage || toPage > document.numPages) throw new Error("Choose a valid page range.");
        checkAborted(signal);
        const texts: string[] = [];
        const emptyPages: number[] = [];
        for (let number = fromPage; number <= toPage; number++) {
          checkAborted(signal);
          const page = await document.getPage(number);
          try {
            const content = await page.getTextContent();
            checkAborted(signal);
            const text = formatPdfTextItems(content.items);
            texts.push(text);
            if (!text) emptyPages.push(number);
          } finally { page.cleanup(); }
          onProgress(number - fromPage + 1, toPage - fromPage + 1);
        }
        return { text: texts.join("\n\n").trim(), emptyPages };
      },
    };
  } catch (cause) {
    await close().catch(() => {});
    checkAborted(signal);
    if (cause instanceof Error && cause.name === "PasswordException") throw new Error("Password-protected PDFs are not supported. Choose an unencrypted text PDF.");
    if (cause instanceof Error && cause.name === "InvalidPDFException") throw new Error("This PDF could not be read. Choose a valid text PDF.");
    throw new Error("This PDF could not be opened. Try another text-based PDF.");
  }
}
