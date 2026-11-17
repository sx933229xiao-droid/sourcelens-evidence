import { z } from "zod";

export const pdfPageMapSchema = z.object({
  textHash: z.string().regex(/^[a-f0-9]{64}$/),
  pages: z.array(z.object({
    page: z.number().int().positive(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })).min(1),
});

export type PdfPageMap = z.infer<typeof pdfPageMapSchema>;
export type PdfPageSpan = PdfPageMap["pages"][number];
export type QuotePageMatch = { start: number; end: number; fromPage: number; toPage: number };

// Offsets use JS string positions (UTF-16), matching indexOf and slice throughout the reader.
export function indexPdfText(pageTexts: readonly string[], fromPage: number): { text: string; pages: PdfPageSpan[] } {
  const parts = pageTexts.map((text) => text.trim());
  const joined = parts.join("\n\n");
  const leading = joined.length - joined.trimStart().length;
  const text = joined.trim();
  const clamp = (offset: number) => Math.max(0, Math.min(text.length, offset - leading));
  let cursor = 0;
  const pages = parts.map((part, index) => {
    const start = cursor;
    cursor += part.length;
    const end = cursor;
    cursor += 2;
    return { page: fromPage + index, start: clamp(start), end: clamp(end) };
  });
  return { text, pages };
}

export async function createPdfPageMap(text: string, pages: PdfPageSpan[]): Promise<PdfPageMap> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const textHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { textHash, pages };
}

export async function isPdfPageMapValid(value: unknown, text: string, range: { fromPage: number; toPage: number }): Promise<boolean> {
  const parsed = pdfPageMapSchema.safeParse(value);
  if (!parsed.success) return false;
  const map = parsed.data;
  if (map.pages.length !== range.toPage - range.fromPage + 1) return false;
  let previousEnd = 0;
  for (let index = 0; index < map.pages.length; index++) {
    const span = map.pages[index];
    if (span.page !== range.fromPage + index || span.start < previousEnd || span.end < span.start || span.end > text.length) return false;
    previousEnd = span.end;
  }
  const rebuilt = indexPdfText(map.pages.map(({ start, end }) => text.slice(start, end)), range.fromPage);
  if (rebuilt.text !== text || rebuilt.pages.some((span, index) => span.start !== map.pages[index].start || span.end !== map.pages[index].end)) return false;
  try { return (await createPdfPageMap(text, map.pages)).textHash === map.textHash; }
  catch { return false; }
}

// Maps are verified when generated or loaded, not re-hashed for each excerpt render.
export function findQuotePageMatches(text: string, quote: string, map?: PdfPageMap): QuotePageMatch[] {
  if (!map || !quote) return [];
  const matches: QuotePageMatch[] = [];
  let pageIndex = 0;
  for (let start = text.indexOf(quote); start !== -1; start = text.indexOf(quote, start + 1)) {
    const end = start + quote.length;
    while (pageIndex < map.pages.length && map.pages[pageIndex].end <= start) pageIndex++;
    let fromPage: number | undefined;
    let toPage: number | undefined;
    for (let index = pageIndex; index < map.pages.length && map.pages[index].start < end; index++) {
      const span = map.pages[index];
      if (span.end > span.start && span.end > start) {
        fromPage ??= span.page;
        toPage = span.page;
      }
    }
    if (fromPage !== undefined && toPage !== undefined) matches.push({ start, end, fromPage, toPage });
  }
  return matches;
}

export function pdfPageLabel(match: Pick<QuotePageMatch, "fromPage" | "toPage">): string {
  return match.fromPage === match.toPage ? `PDF p. ${match.fromPage}` : `PDF pp. ${match.fromPage}–${match.toPage}`;
}

export function quotePageSummary(matches: QuotePageMatch[]): string | null {
  if (!matches.length) return null;
  const labels = [...new Set(matches.map(pdfPageLabel))];
  return matches.length === 1 ? labels[0] : `${matches.length} exact matches: ${labels.join("; ")}`;
}
