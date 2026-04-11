# FairFrame

Chrome **MV3** side panel: **Gemini** (default host) or **your review API** + viewport JPEGs + DOM → UX/a11y findings, optional image mockups, overlays, Markdown/JSON export.

**Default host:** requires a **Gemini API key** ([AI Studio](https://aistudio.google.com/apikey)). There is **no offline/demo analysis** on that host.

---

## Behavior

| Topic | Detail |
|--------|--------|
| **Routing** | **Non-demo URL** → POST JSON to your server only. **Demo host + Gemini key** → Google `generateContent` + optional image mockups. |
| **Capture** | **Pre-expand** (async scroll, when `scrollBeforeCapture`) hydrates lazy DOM *before* screenshots; **VLM** uses **async** content-script scroll + **rAF settle** per strip (window or largest **overflow** container), overlapping tiles, cap **`maxVlmStrips`** (default 20, max 32); then scroll restored. **DOM** collect skips a second expand if pre-expand succeeded. |
| **Issues** | Gemini prompt targets **UX + UI critic breadth** (layout, type, IA, copy, trust, patterns) as well as a11y/SEO; **`analysisTags`** include e.g. `visual_design`, `copy_tone`, `ia_navigation`. **`boundingBox`** should match DOM `box` when the selector exists; the extension **fills missing boxes** from the snapshot for overlays. |
| **History** | Last **24** runs (lite) in `chrome.storage.local` → next run on same URL: comparison + prior context to Gemini. |
| **Session** | Latest UI state in `chrome.storage.session` (large blobs may be stripped on quota). |
| **Side panel** | **Overview / Issues / Page / Log** tabs; **Issues** and **Log** scroll inside the panel so long runs stay usable. After a successful run, the panel switches to **Issues**. |

Reports use a **desktop** metadata label.

---

## Install

```bash
npm install && npm run build
```

`chrome://extensions` → Developer mode → **Load unpacked** → **`dist`**.

Shortcut: **Run FairFrame review** in `chrome://extensions/shortcuts`.

---

## Settings

1. **Gemini API key** — required on default host; can validate from the side panel. For **local dev**, add `GEMINI_API_KEY=your_key` to a project **`.env`** file; **`npm run build`** runs `sync-env` and writes **`public/config.local.json`** (gitignored). The **background** loads that file when **Chrome storage has no saved** Gemini key (saved key from Options / panel always wins).  
2. **Models** — `gemini-3-flash-preview` (audit default), `gemini-3.1-flash-image-preview` (mockups). Preview IDs change — see [Gemini models](https://ai.google.dev/gemini-api/docs/models).  
3. **Mockups** — on by default.  
4. **Custom review URL** — not the demo host → extension does **not** call Gemini.

---

## Privacy

Reads the tab you audit. Data is **local** except **Gemini** or **your server**. [Google AI terms](https://ai.google.dev/terms) apply for Gemini.

---

## Developers

`npm run typecheck` · `npm run verify`

**Core:** `src/background/index.ts`, `auditApi.ts` (`enrichIssuesFromDomSnapshot`), `geminiAudit.ts`, `geminiImageMockup.ts`, `fullPageCapture.ts`, `auditRunHistory.ts`, `src/content/auditDom.ts`, `src/sidepanel/App.tsx`.

**Shipped defaults:** `public/fairframe.config.json` (Gemini model from extension build, TTS engine, capture limits) is copied into `dist/`; the background still accepts legacy `webmacaw.config.json` if you keep that file in an old unpacked build.

**Gemini JSON:** Responses use `responseMimeType: application/json` plus optional **`responseJsonSchema`** ([structured output](https://ai.google.dev/gemini-api/docs/structured-output)); if the API rejects the schema, the client retries without it. The parser also strips markdown code fences and extracts a balanced root `{...}` object when the model adds extra prose.
