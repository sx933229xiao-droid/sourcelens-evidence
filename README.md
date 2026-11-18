# SourceLens

**AI-Powered Source Comparison & Evidence Tracing**

SourceLens is an independently developed AI workspace for comparing claims across two sources and tracing findings back to their original evidence. It is built for students, researchers, and creators who need to check what different sources actually say.

Prepare source documents in Workspace, then review their findings in Evidence Explorer. Compare excerpts side by side and open the full text in Source Inspector while keeping the finding in view. Mark findings reviewed or important, add research notes, and back up complete projects as JSON. PDF imports record physical page positions for exact excerpts, including cross-page and repeated matches.

## Demo

![SourceLens V0.8 Research Studio with findings, side-by-side evidence, and a highlighted PDF excerpt in Source Inspector](docs/images/sourcelens-v08-studio.jpg)

*SourceLens V0.8 running from its production build in Chromium. This fictional competition example uses locally authored findings and two text PDFs. The earlier V0.6 demo shows findings from a saved live-model comparison.* [V0.6 demo](docs/images/sourcelens-v06-demo.jpg)

AI compares the meaning of differently worded claims and explains differences in their context. Application code checks that every displayed quotation exists in its corresponding source. SourceLens uses a configurable OpenAI-compatible Chat Completions API. NVIDIA supplied hosted inference for the earlier live-model comparison. Google Cloud Run is being evaluated for hosting.

## Project Goals

- Compare information from two source documents.
- Identify agreements and potential conflicts.
- Provide AI-assisted explanations.
- Trace findings back to supporting passages.
- Present the results in a clear, interactive interface.

## Development Status

**V0.8.1 Research Studio runs locally with refined evidence transitions and improved Chinese and mixed-script typography.**

The production build passes. Workspace and Evidence Explorer share a fixed application bar and navigation. Evidence Explorer keeps findings, excerpts, and the original text within the same workspace. Build verification used saved analyses, text PDFs, and local responses for the comparison feedback.

### Implemented

- Resizable Findings, Detail, and Source Inspector panes with pointer and keyboard controls. Double-click either divider to restore the 24 / 46 / 30 split. Layout preferences persist in the browser.
- Source Inspector opens the selected excerpt in the complete imported text. It supports A/B switching, exact match selection, PDF page navigation, and returning to the same reading position. On smaller screens it opens as a drawer.
- Motion transitions connect mode and finding selection, filtering, review controls, and inspector movement. Browser reduced-motion preferences keep the same interactions with minimal movement.

- Complete `.sourcelens.json` project backups, including both sources, Findings, human annotations, analysis time, and available PDF page indices. Export uses the latest in-memory project, including notes waiting for autosave.
- Validated restoration as a new project with a new ID. Existing projects are never overwritten; duplicate names receive a restored-copy suffix. Creation and active-project selection commit in one IndexedDB transaction.
- Core-data or finding-reference errors reject restoration. If only an optional PDF page index is invalid, the rest of the complete project is restored with a clear page-information warning.
- PDF page references based on the exact imported text. Cross-page excerpts retain their page span; repeated excerpts expose each occurrence and can open the selected match in the source.
- Source or preview edits invalidate page mapping. Older projects remain usable with unknown excerpt pages; original PDFs are not stored.
- Workspace for source preparation and analysis; Evidence Explorer for reviewing results. Projects with a saved analysis open in Explorer, and new successful comparisons open it automatically.
- Independent Findings navigation, side-by-side Source A / B excerpts, original-source location, and a distinct view for findings that cite only one source.
- Per-finding Reviewed and Important marks and plain-text research notes, saved with the current analysis. Notes use the existing 500ms autosave; marks save immediately.
- Combined keyword, relationship, review-status, and important-only filters. Search includes finding topics, explanations, excerpts, and research notes.
- Cancellable confirmation before editing a source, replacing imported text, or comparing again when human annotations exist. A successful new comparison starts with no annotations; failure or cancellation keeps them.
- Markdown adds review content only to findings with actual annotations. Unannotated projects keep their previous export format.
- Browser-local text PDF import up to 50 MB, using a locally served PDF.js Worker. Documents of up to five pages automatically preview all pages; longer documents show their page count first and offer full-document or selected-range extraction.
- An editable PDF preview with inclusive page ranges, progress, cancellation, a live character count, and explicit confirmation, without a character limit.
- Read / Edit source views in Workspace. Click a source excerpt in Explorer to highlight its exact match in Source Inspector.
- PDF file name, Edited status, selected page range, and available page index survive project switching, refresh, and backup restoration; Markdown reports include reliable per-excerpt page references.
- Create, rename, switch, and delete local research projects from a compact toolbar. Each project contains two sources and its latest successful analysis.
- Native IndexedDB storage with 500ms text autosave, immediate saves for imports and analysis, and submission of pending changes before switching projects. The interface distinguishes saving, saved, and failed writes.
- Restore source text, file names, Edited markers, Findings, omitted-finding counts, and analysis time without calling AI again.
- Markdown reports containing all findings, relationship counts, source names, and verbatim evidence, independent of the on-screen relationship filter.
- Two editable plain-text sources without an application character limit, with paste, local UTF-8 `.txt` / `.md` import, and text extracted from full PDFs or selected pages. Each imported file is limited to 50 MB to protect browser resources.
- An **Import** button in each source panel, the imported file name, and an **Edited** marker after changing imported text. Reimporting the same file restores its original content; Clear and Try Example reset file labels.
- A fictional **Try Example** that fills the inputs; it does not supply precomputed results.
- One server-side request to an OpenAI-compatible Chat Completions API per comparison.
- Complete source text is submitted in that single request, without automatic truncation, compression, splitting, or retries. The configured model service determines its context capacity.
- Cancellable comparisons with elapsed time, a 240-second model-service timeout, and a 255-second browser fallback. Existing successful findings remain readable during another comparison and survive cancellation or failure.
- Five relationships: Agreement, Potential Conflict, Context Difference, Single-Source Claim, and Needs Review.
- Selectable findings with a topic, explanation, and paired original excerpts.
- Independent validation of findings. Invalid findings are omitted while valid findings remain visible; unreadable responses or responses with no usable findings return an error.
- Desktop and narrow-screen layouts, loading feedback, file-size protection, and errors that preserve source text and any previous successful analysis.
- Desktop Explorer keeps the Findings list, review detail, and Inspector side by side. On phones, the detail screen opens Findings and Inspector as drawers, and Workspace switches between the two source editors.

### V0.8.1 verification — November 18, 2026

- Production build and TypeScript passed. Recorded Chromium moving between Findings of different heights. The selected row keeps its own background and a fixed-size blue marker moves with the selection. Frame measurements confirmed translation with no scaling.
- Checked directional Finding and source changes, citation activation, rapid consecutive selection, and reduced motion. For a quote already in view, Inspector keeps the current scroll position and emphasizes the exact text.
- Reviewed the repository's Chinese and English documents at desktop, narrow desktop, and phone widths. Verified font fallback and upright Chinese quotations in Chromium. A real PDF confirmed the 39th match on page 11, cross-page highlighting on pages 2–3, and scroll retention during note saving.

### V0.8 verification — November 18, 2026

- Production build and TypeScript passed. Real Chromium screenshots and a desktop/phone recording show live resizing, reload and double-click reset, mode and Finding changes, A/B context, and opening and closing the Inspector.
- Checked keyboard resizing, reduced motion, scroll retention during review autosave and mode changes, rapid Finding changes, and source fallback when a Finding cites only one source. Window resizing preserved the saved desktop preference.
- The 14-page TraceMonkey PDF verified the 39th exact match on page 11, the cross-page quote on pages 2–3, and native range extraction of 11,064 characters from pages 2–3.
- Browser checks exercised TXT import, notes and IndexedDB restoration, Markdown, backup restoration as a new copy, invalid quote rejection, optional-index recovery, and edit protection. Comparison cancellation and failure were verified with local responses.

### V0.7 verification — November 17, 2026

- One production build passed, including TypeScript checking. Lightweight checks cover complete backup round-trips, core-data rejection, optional-index recovery, UTF-16 positions, blank-page trimming, cross-page and repeated excerpts, and legacy Markdown compatibility. No dependency or test framework was added.
- The real 14-page TraceMonkey PDF supplied 82,817 characters for a local page-index fixture. Its 39th exact `TraceMonkey` match showed PDF page 11 and highlighted character offset 65,736. A separate excerpt spanning pages 2–3 showed that range in Explorer and Markdown.
- Browser export and restoration preserved full source text, Findings, original analysis time, omitted count, Reviewed / Important marks, and the latest multiline notes. Restoration created a new ID and a distinct name, retained the prior project, and survived refresh.
- A mismatched page fingerprint restored the complete sources, analysis, and notes while removing the index and displaying a warning. An invalid source quote was rejected without changing the current project or project count.
- Native browser PDF.js extraction of pages 2–3 produced 11,064 characters and a verified two-page index. Cancelling an annotated source edit retained its index; accepting the edit removed the analysis and index. Editing the PDF preview likewise imported complete edited text without stale page metadata.
- At a 375px CSS viewport, the new project-transfer controls and stacked Explorer had no horizontal overflow. Local fixtures tested data and UI behavior; no new AI analysis, model-capacity probe, or pressure test was performed.

### V0.6 verification — November 16, 2026

- Production build and TypeScript check passed. A duplicate-property diagnostic in the first build was corrected before the successful build. Lightweight checks cover legacy records, original-index annotation binding, sparse annotation removal, literal notes, and unchanged unannotated Markdown.
- Browser operation verified Reviewed / Important marks, multiline notes, combined filters including note keywords, preservation of a selected finding outside the current filters, and clearing filters without changing an eligible selection.
- Immediate project switching and refresh restored the correct marks and notes. Original-source location opened the exact quote in Workspace; returning to Explorer retained the selected finding.
- Source editing, TXT replacement, PDF replacement, and a new comparison all offered cancellable annotation protection. Cancelling preserved the original sources and review; cancelling PDF replacement also retained the preview. Accepting a source edit cleared its analysis and annotations, and subsequent typing did not prompt again.
- Controlled local responses verified review controls paused during comparison, cancellation and failure retaining annotations, and a successful replacement clearing them even when the finding contents were the same. These are lifecycle checks, not new real-model analysis or accuracy evidence.
- A downloaded annotated report contained all findings but only one human-review block for the annotated finding. The original V0.3 real-model project restored three findings; its new unannotated export was byte-for-byte identical to its previous report.
- At a 375px CSS viewport, the page had no horizontal overflow; navigation and A/B evidence stacked correctly. No test framework or new dependency was added.

### V0.5 verification — November 16, 2026

- One production build passed, including TypeScript checking. Lightweight local checks verify complete long inputs, verbatim evidence beyond the former limit, unchanged prompt and request parameters, output-limit rejection, and cancellation / timeout during response-body reading. No test framework was added.
- The real 14-page TraceMonkey PDF extracted and imported all 82,817 characters. Equivalent TXT (82,817 characters) and Markdown (82,847 characters) files imported completely, including their final text.
- Read / Edit, editing at the end of the long Markdown source, immediate project switching, and refresh preserved the complete sources, PDF pages 1–14 of 14, and Edited status. Selected-page extraction produced 6,332 characters for page 2; cancelling an extraction or preview retained the imported full document.
- A temporary local HTTP response checked the actual comparison cancellation path and explicit context-capacity error without contacting an inference provider. It received both full sources; cancelling closed the upstream request, restored editing, and preserved the text. Capacity rejection also retained both sources. These are request-lifecycle checks, not a real AI comparison or capacity benchmark.
- The saved V0.3 real-model project restored all three findings. Its newly downloaded Markdown report was byte-for-byte identical to the previous report. Legacy storage, omitted counts, PDF provenance, and Markdown checks also passed.

### V0.4 verification — November 16, 2026

- Production build and TypeScript check passed. Targeted checks cover legacy project compatibility, exact analysis restoration, PDF metadata in storage and reports, text-item formatting, and rejection above 50 MB. No test framework was added.
- The [PDF.js Hello World PDF](https://github.com/mozilla/pdf.js/blob/master/examples/learning/helloworld.pdf) opened as a one-page document, automatically previewed `Hello, world!`, and restored correctly after import and refresh.
- The [14-page TraceMonkey research paper](https://github.com/mozilla/pdf.js/blob/master/web/compressed.tracemonkey-pldi-09.pdf) initially showed only its page count and range controls, with no extracted preview. Explicit full extraction produced 82,817 characters and disabled import. Selecting page 2 produced 6,332 characters; preview edits, page range, and Edited status persisted after refresh.
- The [55-page Alibaba Java development handbook](https://github.com/alibaba/p3c/blob/master/Java%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C(%E9%BB%84%E5%B1%B1%E7%89%88).pdf) extracted 1,499 characters from PDF page 6, including readable Chinese and code identifiers. A separate PDF.js CJK fixture also extracted successfully.
- Cancelling an oversized preview or an in-progress extraction preserved the existing sources and left import controls usable. Project switching restored both PDF sources. Read / Edit switching preserved the text exactly. A 375px CSS viewport had no horizontal overflow and kept the confirmation button visible.
- Saved V0.3 real-model findings restored with all three findings; evidence location highlighted the exact original sentence. A new export of that legacy project was byte-for-byte identical to the original report. This verification made zero new AI calls; a new PDF-to-AI comparison was not run.

### Earlier verification (V0.1–V0.3)

- V0.3: project creation and renaming, loading the example into an empty named project without an overwrite confirmation, and a real NVIDIA comparison returning three findings in about 39.9 seconds.
- V0.3: original-evidence location and a downloaded Markdown report containing all three findings while the interface displayed only Potential conflict.
- V0.3: targeted checks preserving cached Findings, a nonzero `omittedFindings` value, analysis time, file metadata, and oversized drafts exactly; report checks for all five relationship counts and literal Markdown evidence. No test framework was added.
- V0.3 browser follow-up on November 10: reopened the saved real-model project and refreshed it, retaining all three Findings. The Markdown report exported after restoration was byte-for-byte identical to the original, including `omittedFindings` and analysis time. The server comparison count stayed at one; no new AI call was made during this pass.
- V0.3: edited both sources and immediately switched projects, then switched back and refreshed. The latest draft text survived, the active project was restored, and the real-model project retained its separate sources and results.
- V0.3 in the in-app browser: imported Chinese UTF-8 TXT with Windows line endings and a Markdown file; verified normalized text, file names, Edited markers, refresh recovery, and project switching. Reimporting the same file restored its text and cleared Edited. An explicitly created empty project also survived refresh.
- V0.3 layout checks: the restored desktop results retained the 55:45 split; narrow-screen controls had no horizontal overflow at the measured CSS viewport widths of 323px and 395px.
- V0.3 user-assisted deletion check: after editing the disposable imported project and initiating deletion, the user accepted the native confirmation. Reloading restored the other saved empty project; the deleted project was absent and did not reappear.
- Remaining browser coverage: confirmed Clear / Try Example overwrites are not yet verified. Native confirmation-dialog automation timed out in both the Edge extension and the in-app browser; deletion was verified with manual confirmation as described above. Clear did show a confirmation and the original draft remained intact afterward; this does not establish the confirmed overwrite paths. These follow-ups found no application regression in the completed scenarios and made no runtime-code changes.
- Production build, including TypeScript checking.
- Browser operation of source inputs, example loading, and missing-configuration feedback.
- An inline check that valid findings survive alongside invalid citations, with no separate test framework or test directory.
- A real-model browser comparison of the fictional competition example: the deadline was marked as a potential conflict, individual eligibility as an agreement, and team eligibility as a single-source claim from Source B.
- Expansion of original excerpts and **Locate in source**, including selection of the exact individual-eligibility sentence in Source A.
- A V0.1 live comparison retained the three expected findings. Desktop findings width increased from 35% before analysis to 45% afterward; the narrow-screen result view remained a single column without horizontal overflow.
- V0.2 browser operation: imported a TXT with Chinese text and Windows line endings into Source A, imported Markdown into Source B, edited imported text, and reimported the same file. The comparison button remained available with valid sources, and the narrow-screen import controls did not cause horizontal overflow.

This verifies the complete AI-to-evidence workflow for this example; it does not establish accuracy across arbitrary documents or every relationship category. No precomputed comparison results are used.

### V0.1 response timing

One real example comparison with the existing NVIDIA Lightning model took **44,272ms**: **44,157ms** until provider response headers, **115ms** receiving the response body, and **1ms** parsing and verifying findings. The provider reported 3,733 completion tokens, including 3,374 reasoning tokens (about 90%). One timing line is written to the server console per successful comparison; it contains durations and token counts, without source text or credentials.

For this non-streaming request, the wait before headers can include connection setup, provider queueing, and generation; these timings cannot isolate pure inference from network or queue time. The observed delay is in the external provider call rather than local parsing or evidence validation. V0.5 leaves the existing inference parameters and prompt unchanged; it does not automatically adjust reasoning or output budgets. The five relationship types and citation validation remain in place.

## Run Locally

Use Node.js 22.13 or later within the Node.js 22 release line, and npm. In PowerShell:

```powershell
git clone https://github.com/sx933229xiao-droid/sourcelens-evidence.git
Set-Location sourcelens-evidence
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` with your provider's configuration:

```dotenv
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-model-name
LLM_API_KEY=your-api-key
```

`LLM_BASE_URL` must include the provider's API version prefix, without `/chat/completions`; SourceLens appends that path. The provider must accept `model` and `messages` and return text in `choices[0].message.content`. SourceLens requests JSON in the prompt and validates the response itself; it does not require a provider-specific structured-output feature.

```powershell
npm run dev
```

Open **http://127.0.0.1:3000** (or the port printed by Next.js). Click **Try Example**, then **Compare Sources**. A configured status means the environment variables are present; only a successful comparison confirms a working provider connection. Restart the server after changing AI configuration.

To use a local source, click **Import** in Source A or Source B and choose a UTF-8 `.txt` or `.md` file of up to 50 MB. Its complete text fills the existing editor and its name appears in the panel header. Markdown remains plain text, ready to compare. You can continue editing; the file on disk is not changed. Windows line endings are normalized to the editor's line endings so excerpt location continues to use the displayed text. Empty, unreadable, or oversized files show a panel message without replacing the current source.

For PDF files, see the workflow below. The dev and build scripts prepare the PDF.js Worker, CMaps, and standard fonts from the installed package; no external PDF CDN is needed at runtime.

For a production build and local production server:

```powershell
npm run build
npm start
```

`npm run build` performs the production compilation and TypeScript check. The application is bound to the local machine by default. Public hosting has not been set up.

## How Evidence Is Handled

SourceLens compares statements rather than deciding objective truth. Different dates may indicate a potential conflict, an update, or different conditions. A missing statement is not treated as disagreement.

Every displayed quote must be an exact substring of its corresponding submitted source. Agreement, Potential Conflict, and Context Difference require evidence from both sources. An invalid quote or invalid structure removes that finding, and the interface reports the number omitted. Matching an excerpt verifies its presence in the input, **not** the truth of the claim or the correctness of the AI explanation.

Analysis is tied to the submitted text: editing, imports, review changes, and project operations are locked during a request, while source reading and existing findings remain available. Editing either source clears its previous analysis and review; annotated analyses require confirmation first. Reopening a saved project does not repeat the AI call or change its findings, omitted count, or analysis time. When unchanged sources are explicitly compared again, failure or cancellation preserves the last successful result and its annotations.

Use **Cancel** to stop waiting and resume editing immediately. Cancellation is passed to the server and provider request, and late responses cannot replace the current project or a later comparison; provider-side processing may not stop immediately. The model-service call times out after 240 seconds, including response reading. The browser allows 255 seconds before its fallback timeout. Retry manually when needed. If the configured service rejects the input capacity, SourceLens keeps the complete text and asks you to edit it or select fewer PDF pages. An explicit `finish_reason: "length"` is treated as incomplete output and does not replace a successful analysis.

## PDF Import and Reading

Choose a local text-based `.pdf` file of up to 50 MB from either source's **Import** control. SourceLens loads it locally and reads its page count. Documents with five pages or fewer automatically extract an initial full preview. For longer documents, choose **Extract all pages**, or set an inclusive **From page / To page** range and click **Extract selected pages**. Text extraction runs page by page in a browser Worker and can be cancelled.

Every PDF requires preview confirmation before replacing a source. Review the reading order, adjust the range, or edit the preview. **Import text** is enabled when the applied range is valid and its preview contains non-whitespace text, without a character limit. Changing page inputs requires extracting that range before importing; extracting again replaces preview edits. If the current analysis has review marks or notes, replacing its source requires an additional confirmation. Cancel leaves the current source and analysis intact.

PDF page numbers count pages in the file, starting at 1; they may differ from printed page labels. The source header identifies the imported range. Unedited V0.7 imports also record each page's character positions in the final text and bind them to a SHA-256 fingerprint of its UTF-8 bytes. This lets Explorer and Markdown identify pages for each exact excerpt.

If a quote occurs more than once, use the Inspector's arrows or match number to select an exact occurrence. Use the page arrows to browse the imported PDF text and **Jump to quote** to return to the active match. Reports continue to list all matching page ranges.

Preview edits and later source edits are marked **Edited** and remove page mapping. Cancelling an edit leaves the index intact. An older project without an index remains usable, but its quote pages are unknown; SourceLens does not infer page boundaries from text length or the imported range. Reimporting still replaces the source and invalidates its current analysis and review after any required confirmation.

PDF imports open in **Read** mode in Workspace. Use **Edit** to revise the same text. Explorer's Inspector uses the same imported text with a read-only highlight. To select a different PDF range, reimport the original file.

## Evidence Explorer and Reviews

Select a finding to read its explanation and original Source A / B excerpts. Click an excerpt to inspect it in the complete imported text. Use A/B in the Inspector to switch sources. Moving to another finding keeps the current source when that finding cites it, and follows the other source when needed. Closing and reopening the Inspector on the same finding restores your reading position.

Use **Reviewed**, **Important**, and **Research notes** independently. Reviewed records that you examined the finding. The AI relationship, including **Needs review**, remains separate from your review status. The top bar shows project saving feedback.

Filters combine with each other. Use the top search button or Ctrl/⌘+K to focus **Filter findings**. If changing a review makes the current finding stop matching, its detail remains open with an **Outside current filters** notice. Changing filter controls selects a matching finding where possible. Selections and filters reset when opening another project.

Drag either desktop divider, or focus it and use the arrow keys. Double-click a divider to reset the split. The desktop layout and Inspector visibility are browser preferences. On a smaller window, the Inspector opens from the finding's toolbar or an excerpt.

Annotations belong to the current analysis. Before an annotated source is changed or replaced, SourceLens lets you cancel; a new comparison also asks first, and clears annotations only if it succeeds. Export a report to keep a readable copy before replacing the analysis. No annotations are automatically transferred between analyses.

## Local Research Projects and Reports

Use **Project actions** for **New project**, **Rename project**, **Restore project**, and **Delete project**. The project selector returns to an earlier project. Deleting a local record asks for confirmation. Explicitly created or named projects are retained even when empty.

Text edits save after a 500ms pause. Imports, successful analyses, renaming, and confirmed Clear / Try Example actions save immediately. Switching projects submits pending edits first. Wait for **Saved locally** before refreshing or closing; unsaved changes trigger a leave-page warning, and a failed save keeps the current data visible with a **Retry** action.

**Clear** keeps the project but removes its sources, analysis, and review. **Try Example** replaces them with the fictional example. These actions ask for confirmation only when source content or an analysis would be overwritten. Their confirmation also identifies any review notes that would be removed. Editing or importing a source invalidates the existing analysis and its annotations; annotated analyses require confirmation first. Older source versions and analysis history are not retained.

**Export → Export Markdown** downloads the full current analysis, including project and source names, the original analysis time, relationship counts, and evidence. Findings with marks or a nonempty note include human review. Reports include the latest notes, even before autosave, and all findings in the analysis.

Reliable PDF quote pages are appended to the corresponding evidence labels. Multiple exact matches remain labelled as multiple matches. Without a verified index, no guessed page references are added, and older reports retain their previous format.

## Project Backups and Restoration

Use **Export → Export backup** for a complete `.sourcelens.json` snapshot, including projects that do not yet have an analysis. It captures the current in-memory sources and review. The file uses `format: "sourcelens-project"`, `version: 1`, an export timestamp, and the complete project data. It contains no provider credentials, original PDF bytes, or view preferences.

Choose **Project actions → Restore project** and select the backup. SourceLens validates its format, version, project fields, finding excerpts, and review-index associations before saving. It preserves the original analysis and omitted count without calling AI. Restoration creates a new ID and resolves name collisions with `(restored)` and a sequence number. The new record and active-project pointer commit together after pending work has been saved.

Invalid core data or source references reject the import and leave the current project available. An invalid optional PDF index is discarded independently, with a warning; complete source text, Findings, and human notes are kept. A fingerprint checks text/index consistency, not the authenticity of an external PDF that is no longer available.

Backups do not inherit the source-file import limit. Files larger than 100 MB require confirmation before reading, and can be cancelled at that point. Browser memory and storage space still apply. Backups have structural and reference validation rather than a whole-file checksum, encryption, or cloud synchronization. Markdown is the readable report; JSON is the restorable project backup.

## Data and Credentials

Projects are stored in this browser's IndexedDB, without a cloud database or accounts. Only current source text, file names and Edited markers, PDF ranges and available page indices, the latest analysis with its human annotations, and necessary project metadata are retained. Original files, unselected PDF text, old versions, raw provider responses, and generated reports are not stored. Imported sources and project backups are read in the browser, without uploading their files to the app server. PDF parsing resources are released when preview is confirmed or cancelled. Only clicking **Compare Sources** sends the current source text to your configured AI provider; review marks, notes, and page indices are not added to that request. The provider's own data policies apply. Application code does not log complete source text.

Local projects belong to the browser profile and exact site origin, including the port. `localhost` and `127.0.0.1` use separate storage locations. Clearing site data, private browsing, or browser storage eviction can remove saved projects. Use a consistent address and export backups of useful projects. SourceLens is intended for editing in one tab. Projects remain until deleted or browser data is cleared.

API credentials are used only on the server. `.env.local` and other real environment files are ignored by Git; `.env.example` contains placeholders only. Never add credentials with a `NEXT_PUBLIC_` prefix or commit a real API key.

## Current Limits

SourceLens compares two texts per project. UTF-8 TXT / Markdown and text-based PDF imports each have a 50 MB file limit. Browser memory and local storage space still apply. The configured OpenAI-compatible service determines the available context and output capacity. SourceLens submits the complete sources once and preserves them when analysis fails. Research notes are plain text and belong to the current analysis.

Scanned/image-only pages need OCR, and password-protected PDFs are unsupported. Complex columns, tables, and footnotes can affect extraction order; review and edit the preview. SourceLens displays extracted text, not original PDF page images, and does not reconstruct complex layouts. Page mapping is unavailable for edited text or older imports without recorded boundaries. URL fetching, Word import, analysis history, and external fact checking are not implemented. AI can miss claims or misclassify relationships, and exact-quote validation can omit otherwise useful findings if the model alters their quotations. Review the original sources before relying on a conclusion.

## Implementation

- Next.js App Router, React, TypeScript, Tailwind CSS, and custom CSS.
- React component state for the workspace; Zod for input and per-finding validation.
- `react-resizable-panels` for desktop dividers and Motion for React for presentation transitions. Layout preferences use browser local storage.
- Native IndexedDB for local projects; no database or state-management dependency.
- `pdfjs-dist` 6.5.438, loaded on demand in the browser; matching Worker and text resources served locally.
- `src/lib/pdf-import.ts`: local document sessions, selected-page extraction, progress, and cleanup.
- `src/lib/pdf-page-map.ts`: final-text page spans, UTF-8 SHA-256 consistency checks, and exact quote occurrence resolution.
- `src/lib/project-backup.ts`: versioned project backup serialization and validation, with optional-index recovery.
- `src/components/pdf-import-dialog.tsx`: page-range selection and editable preview confirmation.
- `scripts/prepare-pdfjs-assets.mjs`: generated static resources for dev/build, excluded from Git.
- `src/lib/project-store.ts`: project records and local storage operations.
- `src/lib/markdown-report.ts`: Markdown report generation.
- `src/app/api/compare/route.ts`: comparison endpoint.
- `src/lib/llm.ts`: server-only provider call and prompt.
- `src/lib/comparison-schema.ts`: types, validation, and exact-quote checks.
- `src/components/`: workspace, source inputs, and evidence browsing.

## Planned Cloud Infrastructure

Google Cloud Run is being evaluated as a hosting option for the web application and its server-side AI integration endpoints.

Hosting the Next.js application would let people access the workspace in a browser without running Node.js locally, while keeping provider credentials and AI requests on the server. Model inference is currently supplied through NVIDIA's hosted API; no model is hosted on Google Cloud at this stage.

Cloud deployment has not yet been completed.

## Hackathon Participation

This project is being developed for the [Global AI Builder's Challenge 2026](https://global-ai-builders-challenge.devpost.com/).

Pre-hackathon work and improvements made during the official competition period will be identified separately in the final submission.

The V0 implementation is pre-hackathon work completed on November 6, 2026, starting from README-only commit `3007754`. The first real-model integration check and claim-splitting prompt adjustment followed on November 7. At the beginning of the official development period, record the then-current commit and describe subsequent event contributions separately.

## Development

Maintained by an independent developer.

Develop from a local clone using the setup instructions above. Keep credentials, generated dependencies, build output, logs, and temporary files out of version control.

For AI-assisted continuation, start with [AGENTS.md](AGENTS.md). When resuming an existing checkout, reuse its dependencies and `.env.local`; the clone and environment-copy steps above are for first-time setup.
