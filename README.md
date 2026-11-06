# SourceLens

**AI-Powered Source Comparison & Evidence Tracing**

SourceLens is an independent software project that helps students, researchers, and creators compare information from multiple sources.

Instead of producing only a general AI summary, SourceLens aims to identify agreements, potential contradictions, and missing information while connecting findings to their original evidence.

## Project Goals

- Compare information from two source documents.
- Identify agreements and potential conflicts.
- Provide AI-assisted explanations.
- Trace findings back to supporting passages.
- Present the results in a clear, interactive interface.

## Development Status

**V0 running locally — first real AI comparison verified November 7, 2026.**

The Next.js application runs locally and its production build passes. On November 7, a real NVIDIA-hosted model call completed through **Try Example → Compare Sources → Findings → Original Evidence**. The local provider configuration uses `https://integrate.api.nvidia.com/v1` with `nvidia/nemotron-3.5-lightning-30b-a3b`; the API key is kept only in the Git-ignored local environment file.

### Implemented

- Two plain-text sources, up to 10,000 characters each.
- A fictional **Try Example** that fills the inputs; it does not supply precomputed results.
- One server-side request to an OpenAI-compatible Chat Completions API per comparison.
- Five relationships: Agreement, Potential Conflict, Context Difference, Single-Source Claim, and Needs Review.
- Findings with a topic, explanation, and expandable original excerpts; **Locate in source** selects the matching text in the input.
- Independent validation of findings. Invalid findings are omitted while valid findings remain visible; unreadable responses or responses with no usable findings return an error.
- Desktop and narrow-screen layouts, loading feedback, input limits, and errors that preserve the source text.

### Verified for this delivery

- Production build, including TypeScript checking.
- Browser operation of source inputs, example loading, and missing-configuration feedback.
- An inline check that valid findings survive alongside invalid citations, with no separate test framework or test directory.
- A real-model browser comparison of the fictional competition example: the deadline was marked as a potential conflict, individual eligibility as an agreement, and team eligibility as a single-source claim from Source B.
- Expansion of original excerpts and **Locate in source**, including selection of the exact individual-eligibility sentence in Source A.

This verifies the complete AI-to-evidence workflow for this example; it does not establish accuracy across arbitrary documents or every relationship category. No precomputed comparison results are used.

## Run Locally

Use Node.js 22 and npm. In PowerShell:

```powershell
Set-Location 'W:\CodeX HKSBS\sourcelens-evidence'
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

For a production build and local production server:

```powershell
npm run build
npm start
```

`npm run build` performs the production compilation and TypeScript check. The application is bound to the local machine by default. Public hosting has not been set up.

## How Evidence Is Handled

SourceLens compares statements rather than deciding objective truth. Different dates may indicate a potential conflict, an update, or different conditions. A missing statement is not treated as disagreement.

Every displayed quote must be an exact substring of its corresponding submitted source. Agreement, Potential Conflict, and Context Difference require evidence from both sources. An invalid quote or invalid structure removes that finding, and the interface reports the number omitted. Matching an excerpt verifies its presence in the input, **not** the truth of the claim or the correctness of the AI explanation.

Analysis is tied to the submitted text: inputs are locked during a request, and editing either source clears previous results. A comparison times out after 60 seconds and can be retried manually.

## Data and Credentials

The app has no database, accounts, or document history. Inputs and results stay in the current page's memory and clear on refresh. Source text is sent to your configured AI provider; the provider's own data policies apply. Application code does not log complete source text.

API credentials are used only on the server. `.env.local` and other real environment files are ignored by Git; `.env.example` contains placeholders only. Never add credentials with a `NEXT_PUBLIC_` prefix or commit a real API key.

## Current Limits

V0 accepts two pasted texts only. File uploads, URL fetching, PDF parsing, persistent projects, exports, and external fact checking are not implemented. AI can miss claims or misclassify relationships, and exact-quote validation can omit otherwise useful findings if the model alters their quotations. Review the original sources before relying on a conclusion.

## Implementation

- Next.js App Router, React, TypeScript, Tailwind CSS, and custom CSS.
- React component state for the workspace; Zod for input and per-finding validation.
- `src/app/api/compare/route.ts`: comparison endpoint.
- `src/lib/llm.ts`: server-only provider call and prompt.
- `src/lib/comparison-schema.ts`: types, validation, and exact-quote checks.
- `src/components/`: workspace, source inputs, and evidence browsing.

## Planned Cloud Infrastructure

Google Cloud Run is being evaluated as a hosting option for the web application and its server-side AI integration endpoints.

Cloud deployment has not yet been completed.

## Hackathon Participation

This project is being developed for the [Global AI Builder's Challenge 2026](https://global-ai-builders-challenge.devpost.com/).

Pre-hackathon work and improvements made during the official competition period will be identified separately in the final submission.

The V0 implementation is pre-hackathon work completed on November 6, 2026, starting from README-only commit `3007754`. The first real-model integration check and claim-splitting prompt adjustment followed on November 7. At the beginning of the official development period, record the then-current commit and describe subsequent event contributions separately.

## Development

Maintained by an independent developer.

The formal repository is `W:\CodeX HKSBS\sourcelens-evidence`. Temporary files and local development logs belong in `W:\CodeX HKSXMCSK\SourceLens`; generated dependencies and Next.js build output remain in their standard Git-ignored project directories.
