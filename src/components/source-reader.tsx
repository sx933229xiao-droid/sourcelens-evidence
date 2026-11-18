"use client";

import { memo, type Ref, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import type { SourceId } from "@/lib/comparison-schema";
import { findQuotePageMatches, type PdfPageMap, type QuotePageMatch } from "@/lib/pdf-page-map";

export type ReaderMatch = Pick<QuotePageMatch, "start" | "end"> & { pages?: Pick<QuotePageMatch, "fromPage" | "toPage"> };
export type ReaderMemory = Partial<Record<SourceId, { top: number; max: number; width: number; revision: number }>>;
export type ReaderControls = { goToPage: (page: number) => void };

export function containsHan(text: string) {
  return /[\u3400-\u9fff\uf900-\ufaff\u{20000}-\u{323af}]/u.test(text);
}

export function findReaderMatches(text: string, quote: string, pageMap?: PdfPageMap): ReaderMatch[] {
  if (!quote) return [];
  if (pageMap) {
    const mapped = findQuotePageMatches(text, quote, pageMap);
    if (mapped.length) return mapped.map(({ start, end, fromPage, toPage }) => ({ start, end, pages: { fromPage, toPage } }));
  }
  const matches: ReaderMatch[] = [];
  for (let start = text.indexOf(quote); start >= 0; start = text.indexOf(quote, start + 1)) {
    matches.push({ start, end: start + quote.length });
  }
  return matches;
}

type Props = {
  source: SourceId;
  value: string;
  pageMap?: PdfPageMap;
  match?: ReaderMatch;
  revision?: number;
  memory?: ReaderMemory;
  onPageChange?: (page: number | null) => void;
  controls?: Ref<ReaderControls>;
  inspector?: boolean;
};

type TextBlock = { text: string; start: number; page?: number; hasText?: boolean };

function textBlocks(value: string, pageMap?: PdfPageMap): TextBlock[] {
  if (!pageMap) return [{ text: value, start: 0 }];
  return pageMap.pages.map((page, index) => {
    const start = index === 0 ? 0 : page.start;
    const end = pageMap.pages[index + 1]?.start ?? value.length;
    return { start, page: page.page, text: value.slice(start, end), hasText: page.end > page.start };
  });
}

export const SourceReader = memo(function SourceReader({ source, value, pageMap, match, revision = 0, memory, onPageChange, controls, inspector = false }: Props) {
  const pane = useRef<HTMLDivElement>(null);
  const pageElements = useRef<{ page: number; node: HTMLElement }[]>([]);
  const pendingScroll = useRef<number | null>(null);
  const pendingReport = useRef<number | null>(null);
  const applied = useRef<number | null>(null);
  const start = match?.start;
  const end = match?.end;
  const quotePage = match?.pages?.fromPage;
  const hasHan = useMemo(() => containsHan(value), [value]);
  const blocks = useMemo(() => textBlocks(value, pageMap), [value, pageMap]);
  const contents = useMemo(() => blocks.map((block) => {
    const from = start === undefined ? 0 : Math.max(0, start - block.start);
    const to = end === undefined ? 0 : Math.min(block.text.length, end - block.start);
    const body = from < to
      ? <>{block.text.slice(0, from)}<mark key={revision} data-quote-start={start}>{block.text.slice(from, to)}</mark>{block.text.slice(to)}</>
      : block.text;
    return block.page === undefined
      ? <span key="plain">{body}</span>
      : <span key={block.page} data-reading-page={block.hasText ? block.page : undefined}>{body}</span>;
  }), [blocks, start, end, revision]);

  useLayoutEffect(() => {
    pageElements.current = Array.from(pane.current?.querySelectorAll<HTMLElement>("[data-reading-page]") ?? [], (node) => ({
      page: Number(node.dataset.readingPage),
      node,
    }));
  }, [blocks]);

  const remember = useCallback((node: HTMLDivElement) => {
    // Exit animations are not a new reading position, even if the panel has already narrowed.
    if (!memory || applied.current === null || !node.clientHeight || !node.clientWidth || node.closest("[inert]")) return;
    memory[source] = {
      top: node.scrollTop,
      max: Math.max(0, node.scrollHeight - node.clientHeight),
      width: node.clientWidth,
      revision: applied.current,
    };
  }, [memory, source]);

  const reportPosition = useCallback(() => {
    const node = pane.current;
    if (!node || !node.clientHeight || !node.clientWidth || node.closest("[inert]")) return;
    remember(node);
    if (!onPageChange) return;
    const pages = pageElements.current;
    if (!pages.length) { onPageChange(null); return; }
    const readingLine = node.getBoundingClientRect().top + 26;
    let low = 0;
    let high = pages.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (pages[middle].node.getBoundingClientRect().top <= readingLine) low = middle;
      else high = middle - 1;
    }
    onPageChange(pages[low].page);
  }, [remember, onPageChange]);

  function reportAfterScroll() {
    if (pendingReport.current !== null) return;
    pendingReport.current = requestAnimationFrame(() => {
      pendingReport.current = null;
      reportPosition();
    });
  }

  useLayoutEffect(() => {
    const node = pane.current;
    return () => {
      if (pendingReport.current !== null) cancelAnimationFrame(pendingReport.current);
      pendingReport.current = null;
      if (node) remember(node);
    };
  }, [remember]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      pendingScroll.current = null;
      const node = pane.current;
      if (!node || !node.clientHeight || !node.clientWidth || node.closest("[inert]")) return;
      const saved = memory?.[source];
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      const mark = node.querySelector<HTMLElement>("mark[data-quote-start]");
      if (saved && (!mark || (applied.current === null && saved.revision === revision))) {
        const top = node.clientWidth === saved.width || saved.max === 0 ? saved.top : saved.top / saved.max * max;
        node.scrollTo({ top, behavior: "instant" });
      } else if (mark) {
        // Cancel any earlier smooth scroll before deciding whether the new target needs one.
        if (applied.current !== null) node.scrollTo({ top: node.scrollTop, behavior: "instant" });
        const view = node.getBoundingClientRect();
        const rect = mark.getBoundingClientRect();
        const alreadyReadable = applied.current !== null && rect.top >= view.top + 20 && rect.bottom <= view.bottom - 20;
        if (!alreadyReadable) {
          const page = quotePage === undefined ? undefined : pageElements.current.find((item) => item.page === quotePage);
          const pageTop = page?.node.getBoundingClientRect().top;
          const nearPageStart = pageTop !== undefined && rect.top >= pageTop && rect.top - pageTop < node.clientHeight * .52;
          // Keep the page's opening lines intact when they fit above the citation.
          const anchor = nearPageStart ? pageTop - 22 : rect.top - node.clientHeight * .34;
          const top = Math.max(0, Math.min(max, node.scrollTop + anchor - view.top));
          const near = applied.current !== null && Math.abs(top - node.scrollTop) < node.clientHeight;
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          node.scrollTo({ top, behavior: near && !reduce ? "smooth" : "instant" });
        }
      }
      applied.current = revision;
      reportPosition();
    });
    pendingScroll.current = frame;
    return () => {
      cancelAnimationFrame(frame);
      if (pendingScroll.current === frame) pendingScroll.current = null;
    };
  }, [source, value, pageMap, revision, start, end, quotePage, memory, reportPosition]);

  useImperativeHandle(controls, () => ({
    goToPage(page) {
      const node = pane.current;
      const anchor = pageElements.current.find((item) => item.page === page)?.node;
      if (!node || !anchor) return;
      if (pendingScroll.current !== null) {
        cancelAnimationFrame(pendingScroll.current);
        pendingScroll.current = null;
      }
      applied.current = revision;
      node.scrollTo({
        top: node.scrollTop + anchor.getBoundingClientRect().top - node.getBoundingClientRect().top - 22,
        behavior: "instant",
      });
      reportPosition();
    },
  }), [revision, reportPosition]);

  return (
    <div ref={pane} className={inspector ? "source-reader inspector-reader" : "source-reader"} role="region" aria-label={`Source ${source} reading view`} tabIndex={0} onScroll={reportAfterScroll}>
      <div className="source-prose" data-han={hasHan ? "" : undefined}>{value ? contents : <p className="studio-empty">This source has no text.</p>}</div>
    </div>
  );
});
