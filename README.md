# FairFrame

**Reframe your UI—before your users do.**

FairFrame is a Chrome side panel for teams who ship web apps and care about **real-world UX and accessibility**. It grabs what’s on screen plus a structured snapshot of the page, then runs a **technical review**: rationale, checklists, CSS/HTML/ARIA patches, on-page highlights—and **optional AI-generated mockups** when a visual makes the fix obvious.

---

## Why the name?

**Fair** → inclusive design: contrast, targets, labels, keyboard paths.  
**Frame** → how the interface is *framed*—hierarchy, density, CTAs, clutter.  

Short, memorable, and aligned with what the tool actually does (not a generic “assistant” name).

---

## What FairFrame does (latest behavior)

| Layer | What you get |
|--------|----------------|
| **Gemini (text)** | Deep findings: `advancedRationale`, `implementationChecklist`, `codePatches`, concrete `suggestedFix` — aimed at senior ICs, not fluff. |
| **Gemini (image)** | Up to **2** mockups per run when the model’s `imageMockupPlan` says a wireframe helps — model **`gemini-3.1-flash-image-preview`** (toggle in Settings). |
| **Highlights** | Severity-colored overlays on the live page; hover/tap for details. |
| **Exports** | Markdown + JSON (`fairframe-report.*`). |

**Routing:** Your **own review URL** (non-demo) → **only** your server. **Demo URL + Gemini key** → Google. **Demo + no key** → offline sample data.

---

## Quick install

```bash
npm install
npm run build
```

Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → select the **`dist`** folder.

Pin **FairFrame** from the puzzle menu. Optional: **Extensions → Keyboard shortcuts** → **Run FairFrame review** (if you used an older build, re-bind the shortcut—command id changed).

---

## Settings (plain English)

1. **Gemini API key** ([Google AI Studio](https://aistudio.google.com/apikey)) — powers analysis + optional images.  
2. **Analysis model** — default `gemini-3.1-flash-lite-preview` (change if Google renames previews).  
3. **Image model** — default `gemini-3.1-flash-image-preview` for mockups.  
4. **Generate mockups** — on by default; turn off to save latency/cost.  
5. **Custom server URL** — if set to something other than the demo host, FairFrame **never** calls Gemini from the extension.

---

## Privacy (short)

FairFrame reads **the tab you run a check on**. The **last report** is stored **locally** (mockup images may be stripped if browser storage quota is tight). **Gemini** traffic is subject to [Google’s AI terms](https://ai.google.dev/terms). **Your server** → your policy.

---

## For developers

- **Stack:** TypeScript, Vite, React, Tailwind, MV3.  
- **Checks:** `npm run typecheck`, `npm run verify` (build + manifest/bundle smoke test).  
- **Key files:** `src/background/geminiAudit.ts`, `geminiImageMockup.ts`, `auditApi.ts`, `src/config/gemini.ts`.

Preview models and API fields (`responseModalities`, `imageConfig`) can change; the image path **retries without** `imageConfig` on **400** or common invalid-argument errors.

---

*FairFrame — frame the web fairly.*
