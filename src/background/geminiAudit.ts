/**
 * FairFrame → Google Gemini API (generateContent, v1beta).
 * JSON output: https://ai.google.dev/gemini-api/docs/json-mode
 */
import type { AuditRequestPayload } from "../types/audit";

const MAX_NODES_FOR_GEMINI = 280;
const MAX_JSON_CHARS = 180_000;

const JSON_SCHEMA_HINT = `Return ONE JSON object only (no markdown fences), with this exact shape:

{
  "summary": { "total": number, "critical": number, "major": number, "minor": number, "suggestion": number },
  "issues": [
    {
      "id": string (stable id e.g. "ux-1", "a11y-2"),
      "selector": string (prefer exact selector from DOM snapshot),
      "category": "ux" | "accessibility" | "seo",
      "type": string (snake_case id),
      "severity": "critical" | "major" | "minor" | "suggestion",
      "description": string (1–2 sentence exec summary),
      "impactedUsers": string[],
      "suggestedFix": string (detailed: may include CSS blocks, HTML snippets, ARIA — use clear section labels),
      "wcagReference": string (optional; cite WCAG 2.2 success criterion when applicable),
      "boundingBox": { "x": number, "y": number, "width": number, "height": number } (optional),
      "advancedRationale": string (required for major/critical: evidence from DOM+viewport, contrast ratios if estimable, AA vs AAA, regression/perf trade-offs),
      "implementationChecklist": string[] (concrete steps: implement, unit/a11y test, visual QA, rollout),
      "codePatches": { "css": string (optional), "html": string (optional), "aria": string (optional) } (optional)
    }
  ],
  "imageMockupPlan": [
    { "issueId": string, "generationPrompt": string }
  ] (optional; 0–2 items ONLY for issues where a visual mockup materially helps — layout/hierarchy/tap-target/cluster problems; omit for pure copy-only fixes),
  "notes": string (optional; methodology, limits, or follow-up audits)
}`;

function buildSystemInstruction(): string {
  return `You are a principal frontend engineer + accessibility specialist + product designer auditing a production webpage for an experienced engineering team.

Audience: senior ICs and tech leads — NOT beginners. Avoid vague advice like "improve contrast" without specifics.

Inputs:
1) Optional JPEG: current browser viewport (visual truth for hierarchy, density, affordances, approximate contrast).
2) JSON DOM snapshot: selectors, roles, ARIA, names, boxes (document coordinates), computed colors, typography, visibility.

Rules:
- Tie claims to snapshot data or visible pixels. State uncertainty when inferring (e.g. keyboard traps) rather than hallucinating.
- For each non-trivial issue, include advancedRationale (why it fails, who loses, WCAG level when relevant) and implementationChecklist.
- codePatches should be copy-paste oriented (scoped selectors, minimal diffs). Use modern semantic HTML and ARIA patterns.
- suggestedFix must be technically actionable (sizes in px/rem, contrast targets, focus rings, hit slop).
- imageMockupPlan: at most 2 entries. Each generationPrompt must be rich art direction (layout, annotations, component states) for an image model to render a wireframe/mockup. Only when visuals clarify the fix.
- Prefer selectors from the provided DOM JSON so the extension overlay resolves.

${JSON_SCHEMA_HINT}`;
}

function slimPayloadForGemini(payload: AuditRequestPayload): { jsonText: string; nodeCount: number } {
  let nodes = payload.dom.nodes.slice(0, MAX_NODES_FOR_GEMINI);
  const body = {
    meta: payload.meta,
    dom: { nodes },
  };
  let jsonText = JSON.stringify(body);
  while (jsonText.length > MAX_JSON_CHARS && nodes.length > 40) {
    nodes = nodes.slice(0, Math.floor(nodes.length * 0.85));
    jsonText = JSON.stringify({ meta: payload.meta, dom: { nodes } });
  }
  return { jsonText, nodeCount: nodes.length };
}

export async function analyzeAuditWithGemini(params: {
  apiKey: string;
  model: string;
  payload: AuditRequestPayload;
}): Promise<{ parsed: unknown; notesExtra: string }> {
  const { apiKey, model, payload } = params;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const { jsonText, nodeCount } = slimPayloadForGemini(payload);

  const userText = `Perform a technical UX + accessibility audit.

DOM snapshot (${nodeCount} nodes; meta includes URL, title, viewport). Cross-check with the viewport image if attached.

--- DOM_JSON ---
${jsonText}
--- END ---`;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (payload.screenshotViewportJpegBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: payload.screenshotViewportJpegBase64,
      },
    });
  }
  parts.push({ text: userText });

  const body = {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(data.error.message);

  const raw =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || "";

  if (!raw) throw new Error("Empty response from Gemini.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned text that was not valid JSON. Try running the check again.");
  }

  return {
    parsed,
    notesExtra: `Analysis model ${model}; ${nodeCount} DOM nodes sent.`,
  };
}
